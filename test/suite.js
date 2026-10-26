const assert = require('node:assert');
const http = require('node:http');
const server = require('../server.js');
const { db } = require('../db.js');
const { validateCompatibility } = require('../compatibility.js');

const PORT = 3000;

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- RUNNING ULTRAPC COMPLETE QA SUITE ---');

  try {
    // 1. Health check
    const health = await request({ host: 'localhost', port: PORT, path: '/api/health', method: 'GET' });
    assert.strictEqual(health.statusCode, 200, 'Health endpoint should return 200');
    assert.strictEqual(health.body.status, 'healthy');
    console.log('✓ API Health Check Passed');

    // 2. Compatibility Engine Test
    const partsMismatched = {
      cpu: { name: 'AMD Ryzen 9 7950X3D', specs_json: JSON.stringify({ socket: 'AM5', tdp: 120 }) },
      motherboard: { name: 'ASUS ROG Z790', specs_json: JSON.stringify({ socket: 'LGA1700', ram_gen: 'DDR5' }) },
      ram: { name: 'DDR5 6400', specs_json: JSON.stringify({ generation: 'DDR5' }) },
      gpu: { name: 'RTX 4090', specs_json: JSON.stringify({ tdp: 450, length_mm: 360 }) },
      psu: { name: '500W PSU', specs_json: JSON.stringify({ wattage: 500 }) },
      case: { name: 'SFF Chassis', specs_json: JSON.stringify({ gpu_max_length_mm: 300 }) }
    };
    const compResult = validateCompatibility(partsMismatched);
    assert.strictEqual(compResult.valid, false, 'Mismatched parts must fail compatibility');
    assert.ok(compResult.errors.some(e => e.includes('Socket Mismatch')), 'Must detect socket mismatch');
    assert.ok(compResult.errors.some(e => e.includes('Chassis Clearance')), 'Must detect GPU length clearance failure');
    assert.ok(compResult.errors.some(e => e.includes('Insufficient Power')), 'Must detect insufficient PSU wattage');
    console.log('✓ Hardware Compatibility Engine Constraints Passed');

    // 3. Products Catalog API
    const productsRes = await request({ host: 'localhost', port: PORT, path: '/api/products', method: 'GET' });
    assert.strictEqual(productsRes.statusCode, 200);
    assert.ok(productsRes.body.products.length >= 10, 'Catalog should contain initialized hardware products');
    const flagship = productsRes.body.products.find(p => p.id === 'prod-rig-apex-titan');
    assert.ok(flagship, 'Apex Horizon RTX 4090 rig must exist in DB');
    console.log(`✓ Products Catalog API Passed (${productsRes.body.products.length} products verified)`);

    // 4. Cart Server Validation
    const cartRes = await request(
      { host: 'localhost', port: PORT, path: '/api/cart/validate', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { items: [{ id: 'prod-gpu-rog-4090-white', quantity: 1 }] }
    );
    assert.strictEqual(cartRes.statusCode, 200);
    assert.strictEqual(cartRes.body.valid, true);
    assert.strictEqual(cartRes.body.items[0].price, 1999.99);
    assert.strictEqual(cartRes.body.shipping, 0, 'Orders over $1500 must receive free shipping');
    console.log('✓ Cart Server-Side Pricing & Stock Validation Passed');

    // 5. User Registration & Session Auth
    const testEmail = `test.pilot.${Date.now()}@vanguard.gg`;
    const regRes = await request(
      { host: 'localhost', port: PORT, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { email: testEmail, password: 'SecurePassword2025!', name: 'Test Pilot' }
    );
    assert.strictEqual(regRes.statusCode, 201);
    const sessionCookie = regRes.headers['set-cookie'] ? regRes.headers['set-cookie'][0].split(';')[0] : '';
    assert.ok(sessionCookie.startsWith('upc_session='), 'Must set secure session cookie');
    console.log('✓ User Registration & Session Cookie Generation Passed');

    // 6. Check Auth Profile
    const meRes = await request({
      host: 'localhost', port: PORT, path: '/api/auth/me', method: 'GET',
      headers: { 'Cookie': sessionCookie }
    });
    assert.strictEqual(meRes.statusCode, 200);
    assert.strictEqual(meRes.body.authenticated, true);
    assert.strictEqual(meRes.body.user.email, testEmail);
    console.log('✓ Authenticated Session Verification Passed');

    // 7. Order Placement & Inventory Deduction
    const stockBefore = db.prepare("SELECT stock FROM products WHERE id = 'prod-ssd-samsung-990-pro-4tb'").get().stock;
    const orderRes = await request(
      {
        host: 'localhost', port: PORT, path: '/api/orders', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie }
      },
      {
        customer_name: 'Test Pilot',
        email: testEmail,
        shipping_address: '742 Evergreen Terrace',
        shipping_city: 'Springfield',
        shipping_state: 'OR',
        shipping_zip: '97477',
        payment_method: 'Credit Card',
        items: [{ id: 'prod-ssd-samsung-990-pro-4tb', quantity: 1 }]
      }
    );
    assert.strictEqual(orderRes.statusCode, 201);
    assert.ok(orderRes.body.orderId.startsWith('UPC-ORD-'), 'Order ID must follow UPC-ORD format');
    const stockAfter = db.prepare("SELECT stock FROM products WHERE id = 'prod-ssd-samsung-990-pro-4tb'").get().stock;
    assert.strictEqual(stockAfter, stockBefore - 1, 'Inventory stock must decrement atomically on confirmed order');
    console.log(`✓ Order Placement & Stock Integrity Passed (Order: ${orderRes.body.orderId})`);

    // 8. Repair Tracking Lookup
    const repairRes = await request({
      host: 'localhost', port: PORT, path: '/api/repairs/track/UPC-92841', method: 'GET'
    });
    assert.strictEqual(repairRes.statusCode, 200);
    assert.strictEqual(repairRes.body.ticket.id, 'UPC-92841');
    assert.strictEqual(repairRes.body.ticket.phase, 4);
    assert.strictEqual(repairRes.body.ticket.progress_percent, 85);
    console.log('✓ Real Repair Tracking Database Query Passed');

    // 9. Admin Stats Protection
    const adminFailRes = await request({
      host: 'localhost', port: PORT, path: '/api/admin/stats', method: 'GET',
      headers: { 'Cookie': sessionCookie } // Normal user session
    });
    assert.strictEqual(adminFailRes.statusCode, 403, 'Normal user must be forbidden from admin stats');

    // Login as Admin
    const adminLoginRes = await request(
      { host: 'localhost', port: PORT, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { email: 'admin@ultrapc.com', password: 'AdminPass2025!' }
    );
    assert.strictEqual(adminLoginRes.statusCode, 200);
    const adminCookie = adminLoginRes.headers['set-cookie'][0].split(';')[0];

    const adminStatsRes = await request({
      host: 'localhost', port: PORT, path: '/api/admin/stats', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(adminStatsRes.statusCode, 200);
    assert.ok(adminStatsRes.body.totalOrders >= 1);
    console.log('✓ Admin Role Authorization & Metrics Aggregation Passed');

    console.log('\n>>> ALL 9 ARCHITECTURAL TESTS SUCCEEDED WITH ZERO FAILURES <<<');
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
