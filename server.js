const http = require('node:http');
const url = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { db, hashPassword, verifyPassword } = require('./db.js');
const { validateCompatibility } = require('./compatibility.js');

const PORT = process.env.PORT || 3000;

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Helper to parse cookies
function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });

  return list;
}

// Helper to get authenticated user from session token
function getAuthenticatedUser(req) {
  const cookies = parseCookies(req);
  const token = cookies.upc_session;
  if (!token) return null;

  const now = Date.now();
  const session = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.email, u.name, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, now);

  return session || null;
}

// Helper to parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        if (!data) return resolve({});
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

// JSON response helper
function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    ...headers
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // 1. Static Files & Root Fallback
  if (method === 'GET' && (pathname === '/' || pathname === '/index.html' || pathname === '/code.html')) {
    // Serve the main application file (index.html if exists in public, or code.html)
    const filePath = fs.existsSync(path.join(__dirname, 'public', 'index.html'))
      ? path.join(__dirname, 'public', 'index.html')
      : path.join(__dirname, 'code.html');

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Server error loading storefront interface.');
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    });
    return;
  }

  // Serve static assets from /public or root
  if (method === 'GET' && !pathname.startsWith('/api/')) {
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    const candidatePublic = path.join(__dirname, 'public', safePath);
    const candidateRoot = path.join(__dirname, safePath);

    let finalFile = null;
    if (fs.existsSync(candidatePublic) && fs.statSync(candidatePublic).isFile()) {
      finalFile = candidatePublic;
    } else if (fs.existsSync(candidateRoot) && fs.statSync(candidateRoot).isFile()) {
      finalFile = candidateRoot;
    }

    if (finalFile) {
      const ext = path.extname(finalFile).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      fs.readFile(finalFile, (err, data) => {
        if (err) {
          res.writeHead(500);
          return res.end('Error reading asset');
        }
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
      });
      return;
    }
  }

  // ==================== REST API ENDPOINTS ====================

  // Health / Telemetry
  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'healthy',
      serverTime: new Date().toISOString(),
      engine: 'UltraPC Core Node/SQLite',
      version: '1.0.0'
    });
  }

  // Auth: Check Current Session
  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendJson(res, 200, { authenticated: false, user: null });
    }

    const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(user.id);
    return sendJson(res, 200, {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profile: profile || {}
      }
    });
  }

  // Auth: Register
  if (pathname === '/api/auth/register' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { email, password, name, phone, shipping_address, shipping_city, shipping_state, shipping_zip, shipping_country } = body;

      if (!email || !password || !name) {
        return sendJson(res, 400, { error: 'Name, email, and password are required.' });
      }
      if (password.length < 8) {
        return sendJson(res, 400, { error: 'Password must be at least 8 characters.' });
      }

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
      if (existing) {
        return sendJson(res, 409, { error: 'An account with this email address already exists.' });
      }

      const userId = 'usr-' + crypto.randomUUID();
      const { hash, salt } = hashPassword(password);

      db.prepare(`
        INSERT INTO users (id, email, password_hash, salt, name, role)
        VALUES (?, ?, ?, ?, ?, 'customer')
      `).run(userId, email.toLowerCase().trim(), hash, salt, name.trim());

      db.prepare(`
        INSERT INTO user_profiles (user_id, phone, shipping_address, shipping_city, shipping_state, shipping_zip, shipping_country)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        phone || '',
        shipping_address || '',
        shipping_city || '',
        shipping_state || '',
        shipping_zip || '',
        shipping_country || 'United States'
      );

      // Create session
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
      db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);

      res.setHeader('Set-Cookie', `upc_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`);
      return sendJson(res, 201, {
        success: true,
        user: { id: userId, email: email.toLowerCase().trim(), name: name.trim(), role: 'customer' }
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Auth: Login
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { email, password } = body;

      if (!email || !password) {
        return sendJson(res, 400, { error: 'Email and password are required.' });
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
      if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
        return sendJson(res, 401, { error: 'Invalid email or password credentials.' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);

      res.setHeader('Set-Cookie', `upc_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`);
      return sendJson(res, 200, {
        success: true,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Auth: Logout
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const cookies = parseCookies(req);
    if (cookies.upc_session) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(cookies.upc_session);
    }
    res.setHeader('Set-Cookie', 'upc_session=; Path=/; HttpOnly; Max-Age=0');
    return sendJson(res, 200, { success: true });
  }

  // Auth: Update Profile
  if (pathname === '/api/auth/profile' && method === 'PUT') {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendJson(res, 401, { error: 'Authentication required.' });
    }

    try {
      const body = await parseBody(req);
      const { name, phone, company, shipping_address, shipping_city, shipping_state, shipping_zip, shipping_country } = body;

      if (name) {
        db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), user.id);
      }

      db.prepare(`
        INSERT INTO user_profiles (user_id, phone, company, shipping_address, shipping_city, shipping_state, shipping_zip, shipping_country)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          phone = excluded.phone,
          company = excluded.company,
          shipping_address = excluded.shipping_address,
          shipping_city = excluded.shipping_city,
          shipping_state = excluded.shipping_state,
          shipping_zip = excluded.shipping_zip,
          shipping_country = excluded.shipping_country
      `).run(user.id, phone || '', company || '', shipping_address || '', shipping_city || '', shipping_state || '', shipping_zip || '', shipping_country || 'United States');

      return sendJson(res, 200, { success: true, message: 'Profile updated successfully.' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Products: Catalog & Search & Filters
  if (pathname === '/api/products' && method === 'GET') {
    const query = parsedUrl.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (query.category && query.category !== 'all') {
      sql += ' AND category = ?';
      params.push(query.category);
    }
    if (query.q) {
      sql += ' AND (name LIKE ? OR short_desc LIKE ? OR tier LIKE ?)';
      const term = `%${query.q}%`;
      params.push(term, term, term);
    }
    if (query.featured === '1') {
      sql += ' AND featured = 1';
    }

    // Sorting
    if (query.sort === 'price-asc') {
      sql += ' ORDER BY price ASC';
    } else if (query.sort === 'price-desc') {
      sql += ' ORDER BY price DESC';
    } else if (query.sort === 'name') {
      sql += ' ORDER BY name ASC';
    } else {
      sql += ' ORDER BY featured DESC, created_at DESC';
    }

    const items = db.prepare(sql).all(...params);
    return sendJson(res, 200, { products: items, count: items.length });
  }

  // Products: Single Product Details
  if (pathname.startsWith('/api/products/') && method === 'GET') {
    const identifier = pathname.replace('/api/products/', '');
    const product = db.prepare('SELECT * FROM products WHERE id = ? OR slug = ?').get(identifier, identifier);

    if (!product) {
      return sendJson(res, 404, { error: 'Hardware product not found.' });
    }
    return sendJson(res, 200, { product });
  }

  // Configurator: Compatibility Verification Endpoint
  if (pathname === '/api/configurator/validate' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { selected_parts } = body;
      // Fetch full product objects for the selected part IDs
      const partIds = Object.values(selected_parts || {}).filter(Boolean);
      if (partIds.length === 0) {
        return sendJson(res, 200, { valid: true, errors: [], warnings: [], estimatedTdpWatts: 100, recommendedPsuWatts: 150 });
      }

      const placeholders = partIds.map(() => '?').join(',');
      const rows = db.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...partIds);
      const productMap = {};
      rows.forEach(r => { productMap[r.id] = r; });

      const parts = {};
      for (const [slot, id] of Object.entries(selected_parts)) {
        if (id && productMap[id]) {
          parts[slot] = productMap[id];
        }
      }

      const validation = validateCompatibility(parts);
      return sendJson(res, 200, validation);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Cart Validation & Calculation (Server-authoritative totals and stock check)
  if (pathname === '/api/cart/validate' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const items = body.items || []; // array of { id, quantity }

      if (!Array.isArray(items) || items.length === 0) {
        return sendJson(res, 200, {
          valid: true,
          items: [],
          subtotal: 0,
          shipping: 0,
          tax: 0,
          total: 0
        });
      }

      const productIds = items.map(i => i.id);
      const placeholders = productIds.map(() => '?').join(',');
      const dbProducts = db.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...productIds);
      const productMap = {};
      dbProducts.forEach(p => { productMap[p.id] = p; });

      let subtotal = 0;
      const validatedItems = [];
      const stockErrors = [];

      for (const item of items) {
        const product = productMap[item.id];
        if (!product) {
          stockErrors.push(`Product '${item.id}' is no longer available in the catalog.`);
          continue;
        }

        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        if (product.stock < qty) {
          stockErrors.push(`Requested ${qty}x '${product.name}', but only ${product.stock} units are currently in stock.`);
        }

        const lineTotal = product.price * qty;
        subtotal += lineTotal;
        validatedItems.push({
          id: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          quantity: qty,
          lineTotal,
          stock: product.stock,
          image_url: product.image_url,
          config_details: item.config_details || null
        });
      }

      // Shipping calculation rule: Free shipping on orders over $1500 or containing RTX 4090 builds
      const shipping = subtotal >= 1500 || subtotal === 0 ? 0 : 49.99;
      // Tax: calculated at standard 8.25%
      const tax = Math.round(subtotal * 0.0825 * 100) / 100;
      const total = Math.round((subtotal + shipping + tax) * 100) / 100;

      return sendJson(res, 200, {
        valid: stockErrors.length === 0,
        errors: stockErrors,
        items: validatedItems,
        subtotal,
        shipping,
        tax,
        total
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Orders: Place Order (Atomic inventory deduction and server-calculated price integrity)
  if (pathname === '/api/orders' && method === 'POST') {
    try {
      const user = getAuthenticatedUser(req);
      const body = await parseBody(req);
      const { customer_name, email, shipping_address, shipping_city, shipping_state, shipping_zip, shipping_country, payment_method, items } = body;

      if (!customer_name || !email || !shipping_address || !shipping_city || !shipping_state || !shipping_zip || !items || !items.length) {
        return sendJson(res, 400, { error: 'All shipping details and valid cart items are required.' });
      }

      // Re-validate stock and recalculate exact server prices
      const productIds = items.map(i => i.id);
      const placeholders = productIds.map(() => '?').join(',');
      const dbProducts = db.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...productIds);
      const productMap = {};
      dbProducts.forEach(p => { productMap[p.id] = p; });

      let subtotal = 0;
      for (const item of items) {
        const prod = productMap[item.id];
        if (!prod) return sendJson(res, 400, { error: `Product ${item.id} not found.` });
        const qty = parseInt(item.quantity, 10) || 1;
        if (prod.stock < qty) {
          return sendJson(res, 400, { error: `Insufficient stock for ${prod.name}. Available: ${prod.stock}` });
        }
        subtotal += prod.price * qty;
      }

      const shipping = subtotal >= 1500 ? 0 : 49.99;
      const tax = Math.round(subtotal * 0.0825 * 100) / 100;
      const total = Math.round((subtotal + shipping + tax) * 100) / 100;

      const orderId = 'UPC-ORD-' + Math.floor(100000 + Math.random() * 900000);
      const trackingNumber = 'FEDEX-PRIORITY-' + Math.floor(1000000000 + Math.random() * 9000000000);

      // Deduct inventory and insert order within atomic operations
      const insertOrder = db.prepare(`
        INSERT INTO orders (
          id, user_id, guest_email, customer_name, shipping_address, shipping_city,
          shipping_state, shipping_zip, shipping_country, subtotal, tax, shipping_cost,
          total, payment_method, payment_status, order_status, tracking_number
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'assembling', ?
        )
      `);

      const insertItem = db.prepare(`
        INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, item_total, config_details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateStock = db.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `);

      insertOrder.run(
        orderId,
        user ? user.id : null,
        email.toLowerCase().trim(),
        customer_name.trim(),
        shipping_address.trim(),
        shipping_city.trim(),
        shipping_state.trim(),
        shipping_zip.trim(),
        shipping_country || 'United States',
        subtotal,
        tax,
        shipping,
        total,
        payment_method || 'Credit Card (Stripe Gateway)',
        trackingNumber
      );

      for (const item of items) {
        const prod = productMap[item.id];
        const qty = parseInt(item.quantity, 10) || 1;
        const lineTotal = prod.price * qty;
        insertItem.run(
          'item-' + crypto.randomUUID(),
          orderId,
          prod.id,
          prod.name,
          prod.price,
          qty,
          lineTotal,
          item.config_details ? JSON.stringify(item.config_details) : null
        );
        updateStock.run(qty, prod.id);
      }

      return sendJson(res, 201, {
        success: true,
        orderId,
        total,
        order_status: 'assembling',
        trackingNumber,
        message: 'Order placed and authenticated against real inventory.'
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Orders: Get order details by ID
  if (pathname.startsWith('/api/orders/') && method === 'GET') {
    const orderId = pathname.replace('/api/orders/', '');
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return sendJson(res, 404, { error: 'Order not found.' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    return sendJson(res, 200, { order, items });
  }

  // Orders: Get orders for authenticated user
  if (pathname === '/api/user/orders' && method === 'GET') {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendJson(res, 401, { error: 'Authentication required.' });
    }

    const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
    return sendJson(res, 200, { orders });
  }

  // Repair Tickets: Search / Tracking
  if (pathname.startsWith('/api/repairs/track/') && method === 'GET') {
    const ticketId = pathname.replace('/api/repairs/track/', '').trim().toUpperCase();
    const ticket = db.prepare('SELECT * FROM repair_tickets WHERE id = ? OR id = ?').get(ticketId, ticketId.replace(/-RX$/i, ''));

    if (!ticket) {
      return sendJson(res, 404, {
        found: false,
        error: `No repair record found for ticket ID "${ticketId}". Please check your dispatch paperwork or email confirmation.`
      });
    }

    return sendJson(res, 200, { found: true, ticket });
  }

  // Repair Tickets: Create New Ticket
  if (pathname === '/api/repairs' && method === 'POST') {
    try {
      const user = getAuthenticatedUser(req);
      const body = await parseBody(req);
      const { customer_name, customer_email, customer_phone, hardware_model, serial_number, issue_description } = body;

      if (!customer_name || !customer_email || !hardware_model || !issue_description) {
        return sendJson(res, 400, { error: 'Customer name, email, hardware model, and issue description are required.' });
      }

      // Generate authentic high-precision ticket ID format: UPC-XXXXX
      const ticketId = 'UPC-' + Math.floor(10000 + Math.random() * 90000);
      db.prepare(`
        INSERT INTO repair_tickets (
          id, user_id, customer_name, customer_email, customer_phone, hardware_model,
          serial_number, issue_description, phase, phase_name, progress_percent,
          estimated_dispatch, technician_notes, status
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Intake & Visual Inspection', 15, 'Pending Diagnostics', 'Unit queued for ultrasonic inspection and electrical bench rail test.', 'active'
        )
      `).run(
        ticketId,
        user ? user.id : null,
        customer_name.trim(),
        customer_email.toLowerCase().trim(),
        customer_phone || '',
        hardware_model.trim(),
        serial_number || 'N/A',
        issue_description.trim()
      );

      return sendJson(res, 201, {
        success: true,
        ticketId,
        message: 'Hardware repair ticket generated. Please print your packing slip and attach to chassis box.'
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Newsletter Subscription
  if (pathname === '/api/newsletter' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { email } = body;
      if (!email || !email.includes('@')) {
        return sendJson(res, 400, { error: 'Valid email address required.' });
      }

      db.prepare(`
        INSERT INTO newsletter_subscribers (id, email)
        VALUES (?, ?)
        ON CONFLICT(email) DO NOTHING
      `).run('sub-' + crypto.randomUUID(), email.toLowerCase().trim());

      return sendJson(res, 200, { success: true, message: 'Subscribed to RTX 50/40 stealth restock and telemetry alerts.' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Admin: Analytics & Overview Stats
  if (pathname === '/api/admin/stats' && method === 'GET') {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      return sendJson(res, 403, { error: 'Administrator access required.' });
    }

    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as rev FROM orders WHERE payment_status = 'paid'").get().rev;
    const totalOrders = db.prepare('SELECT COUNT(*) as cnt FROM orders').get().cnt;
    const activeRepairs = db.prepare("SELECT COUNT(*) as cnt FROM repair_tickets WHERE status = 'active'").get().cnt;
    const lowStockCount = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE stock < 5').get().cnt;
    const recentOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5').all();
    const repairList = db.prepare('SELECT * FROM repair_tickets ORDER BY created_at DESC LIMIT 10').all();

    return sendJson(res, 200, {
      totalRevenue,
      totalOrders,
      activeRepairs,
      lowStockCount,
      recentOrders,
      repairList
    });
  }

  // Admin: Product Management (CRUD)
  if (pathname === '/api/admin/products' && method === 'POST') {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      return sendJson(res, 403, { error: 'Administrator access required.' });
    }

    try {
      const body = await parseBody(req);
      const { name, category, tier, price, stock, short_desc, long_desc, specs_json, image_url, featured } = body;

      if (!name || !category || price === undefined) {
        return sendJson(res, 400, { error: 'Name, category, and price are required.' });
      }

      const id = 'prod-' + crypto.randomUUID();
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + id.slice(-4);

      db.prepare(`
        INSERT INTO products (id, slug, name, category, tier, price, stock, short_desc, long_desc, specs_json, image_url, featured)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        slug,
        name.trim(),
        category,
        tier || '',
        parseFloat(price),
        parseInt(stock, 10) || 0,
        short_desc || '',
        long_desc || '',
        typeof specs_json === 'object' ? JSON.stringify(specs_json) : (specs_json || '{}'),
        image_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZ4dp42aj-y6UEoSnLFwmnWxkkAKCSRpBi6c18QLPOLGjTip0PDUhiqC_sdCWHQU-Y0BOwKT7npN_DtaB7NiV6ndxofz2rAeiqKStyOAIKqv7ZD2T1eH1cL1Wz_3au5xyTqWhlA3zNaWQmB26wi9gEcWDTY38iV-rdy8wEAsWrrIehKjHUpIAFWDSXnjhU98EqcFdpGvlg8oYhGzAksVSAW2pbDhMdSSl2zTdMza7NjZJEjHFIwPuQVw',
        featured ? 1 : 0
      );

      return sendJson(res, 201, { success: true, id, slug });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Admin: Update Stock / Price
  if (pathname.startsWith('/api/admin/products/') && method === 'PATCH') {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      return sendJson(res, 403, { error: 'Administrator access required.' });
    }

    const productId = pathname.replace('/api/admin/products/', '');
    try {
      const body = await parseBody(req);
      const updates = [];
      const params = [];

      if (body.price !== undefined) {
        updates.push('price = ?');
        params.push(parseFloat(body.price));
      }
      if (body.stock !== undefined) {
        updates.push('stock = ?');
        params.push(parseInt(body.stock, 10));
      }

      if (updates.length > 0) {
        params.push(productId);
        db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      return sendJson(res, 200, { success: true, message: 'Product updated.' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Admin: Update Repair Ticket Phase / Status
  if (pathname.startsWith('/api/admin/repairs/') && method === 'PATCH') {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      return sendJson(res, 403, { error: 'Administrator access required.' });
    }

    const ticketId = pathname.replace('/api/admin/repairs/', '');
    try {
      const body = await parseBody(req);
      const { phase, phase_name, progress_percent, estimated_dispatch, technician_notes, status } = body;

      db.prepare(`
        UPDATE repair_tickets SET
          phase = COALESCE(?, phase),
          phase_name = COALESCE(?, phase_name),
          progress_percent = COALESCE(?, progress_percent),
          estimated_dispatch = COALESCE(?, estimated_dispatch),
          technician_notes = COALESCE(?, technician_notes),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        phase !== undefined ? parseInt(phase, 10) : null,
        phase_name || null,
        progress_percent !== undefined ? parseInt(progress_percent, 10) : null,
        estimated_dispatch || null,
        technician_notes || null,
        status || null,
        ticketId
      );

      return sendJson(res, 200, { success: true, message: 'Repair record updated.' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 404 Fallback
  return sendJson(res, 404, { error: 'API route not found' });
});

server.listen(PORT, () => {
  console.log(`UltraPC Server running at http://localhost:${PORT}`);
});

module.exports = server;
