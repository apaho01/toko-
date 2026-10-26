const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'ultrapc.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for performance and relational integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    phone TEXT,
    company TEXT,
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_zip TEXT,
    shipping_country TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'rig', 'gpu', 'cpu', 'ram', 'cooling', 'storage', 'motherboard', 'psu', 'case', 'peripheral'
    tier TEXT,              -- 'Enthusiast', 'Esport', 'Workstation', etc.
    price REAL NOT NULL,
    compare_at_price REAL,
    stock INTEGER NOT NULL DEFAULT 0,
    short_desc TEXT NOT NULL,
    long_desc TEXT,
    specs_json TEXT NOT NULL DEFAULT '{}',
    image_url TEXT NOT NULL,
    featured INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    guest_email TEXT,
    customer_name TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_state TEXT NOT NULL,
    shipping_zip TEXT NOT NULL,
    shipping_country TEXT NOT NULL,
    subtotal REAL NOT NULL,
    tax REAL NOT NULL,
    shipping_cost REAL NOT NULL,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed'
    order_status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed', 'assembling', 'benchmarking', 'shipped', 'delivered', 'cancelled'
    tracking_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    item_total REAL NOT NULL,
    config_details TEXT, -- JSON for custom configurator build components
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS repair_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    hardware_model TEXT NOT NULL,
    serial_number TEXT,
    issue_description TEXT NOT NULL,
    phase INTEGER NOT NULL DEFAULT 1, -- 1: Intake & Physical Check, 2: Deep Diagnostic Sweep, 3: Decontamination / Component Replacement, 4: Pressure & Hydro-Leak Sweep, 5: Final Bench Stress & QC
    phase_name TEXT NOT NULL DEFAULT 'Intake & Visual Inspection',
    progress_percent INTEGER NOT NULL DEFAULT 15,
    estimated_dispatch TEXT,
    technician_notes TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'waiting_parts', 'dispatched'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS custom_builds (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    build_name TEXT NOT NULL,
    config_json TEXT NOT NULL,
    total_price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Password hashing utility
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

// Seed initial system data if products table is empty
const productCountRow = db.prepare('SELECT COUNT(*) as cnt FROM products').get();
if (productCountRow.cnt === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, slug, name, category, tier, price, compare_at_price, stock,
      short_desc, long_desc, specs_json, image_url, featured
    ) VALUES (
      @id, @slug, @name, @category, @tier, @price, @compare_at_price, @stock,
      @short_desc, @long_desc, @specs_json, @image_url, @featured
    )
  `);

  const initialProducts = [
    // Pre-Built Flagship Rig
    {
      id: 'prod-rig-apex-titan',
      slug: 'apex-horizon-rtx4090-titan',
      name: 'APEX HORIZON RTX 4090 OC TITAN',
      category: 'rig',
      tier: 'Flagship Tier 0',
      price: 5299.00,
      compare_at_price: 5799.00,
      stock: 4,
      short_desc: 'Hand-crafted hardline liquid cooled flagship rig with binned i9-14900KS and RTX 4090 24GB.',
      long_desc: 'Uncompromising Power. Precision Liquid Cooled. Hand-built with custom sand-blasted acrylic manifolds, dual 480mm radiators, and hand-selected silicon binned for maximum sustained clock speeds under 24/7 hyper-load.',
      specs_json: JSON.stringify({
        cpu: 'Intel Core i9-14900KS (6.2 GHz Binned)',
        gpu: 'ASUS ROG Strix RTX 4090 24GB Waterblock OC',
        ram: '64GB DDR5-7200 CL34 G.Skill Trident Z5',
        storage: '4TB Gen5 NVMe SSD (14,000 MB/s)',
        cooling: 'EK-Quantum Distro Block Hardline Loop',
        psu: 'Seasonic TX-1600 Titanium ATX 3.0',
        case: 'Lian Li O11 Dynamic EVO XL Custom Acrylic'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAP15SruE8HHBO08yUvGekPwMRio612M6Ouj-2_OVSelnY_adgvV1jjUZun2SisfRs0E561szApUD-fdtO1Z0uueTY2MEdISvpvCQaG5GlDriE6a6UjFgg-WnSqM9SMof0VDngOGF0PwoGGwCjIIb5872J7lHSPbcy8OfjmkMFhzIP-AQ2S9OWk7ooSWhWwW-_uc-2SIztuInVNiPxBgRaPcqNwTlvsUQ9m4_XdxCwP-xJfKQGLMDvT3w',
      featured: 1
    },
    {
      id: 'prod-rig-valkyrie-7950x3d',
      slug: 'valkyrie-esport-am5-4080s',
      name: 'VALKYRIE ESPORT RTX 4080 SUPER',
      category: 'rig',
      tier: 'Esport Tournament',
      price: 3499.00,
      compare_at_price: 3799.00,
      stock: 6,
      short_desc: 'Tournament ready AM5 esports workstation tuned for 540Hz low latency competitive play.',
      long_desc: 'Engineered specifically for hyper-competitive esport leagues and simulation enthusiasts. Featuring AMD Ryzen 9 7950X3D with 144MB 3D V-Cache and RTX 4080 Super with custom copper cold plate cooling.',
      specs_json: JSON.stringify({
        cpu: 'AMD Ryzen 9 7950X3D (16C/32T 144MB V-Cache)',
        gpu: 'MSI GeForce RTX 4080 Super 16GB Gaming X Trio',
        ram: '32GB DDR5-6000 CL30 Corsair Dominator Titanium',
        storage: '2TB Samsung 990 PRO Gen4 NVMe (7450 MB/s)',
        cooling: 'Arctic Liquid Freezer III 360 A-RGB',
        psu: 'Corsair RM1000x Shift Gold Fully Modular',
        case: 'NZXT H9 Flow Dual Chamber Matte Black'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTXPzS0ayzme3ykSIuXPA-9SyiRR0QhkmGlcL-SbdEjzfU8PVW89V6Vc_cWpVrmiQJAY_90rXYt2Km8kzMDLjTqtoSFp8FkgIo6KhtHntrc5AnoAGXiRLbU0LPfH6y_HX7VXHSK3upt0mErZohYTvJj3FxlId1Ap7qL0EgDLbnkfKFmEgGXBD7NJDkjS7MxURxvv3Zxe5QvbBoK5ojKXrkyzAFmkpRg_6ncT9mc0SuT6Mz9ckKMI_prg',
      featured: 1
    },
    {
      id: 'prod-rig-quantum-ai',
      slug: 'quantum-ai-dual-4090-workstation',
      name: 'QUANTUM WORKSTATION DUAL RTX 4090',
      category: 'rig',
      tier: 'Deep Learning & 3D Render',
      price: 8999.00,
      compare_at_price: 9499.00,
      stock: 2,
      short_desc: 'Dual RTX 4090 48GB VRAM compute powerhouse for local LLM inference, 3D VFX, and CAD.',
      long_desc: 'Built on AMD Threadripper PRO architectural stability. Dual blower RTX 4090 with active EK liquid loop and 128GB ECC DDR5 for uninterrupted month-long render batches.',
      specs_json: JSON.stringify({
        cpu: 'AMD Ryzen Threadripper 7960X (24C/48T)',
        gpu: '2x ASUS ROG Strix RTX 4090 (48GB Total VRAM)',
        ram: '128GB DDR5-5600 Quad-Channel ECC Reg',
        storage: '8TB Crucial T700 Gen5 NVMe RAID-0',
        cooling: 'Dual 420mm Radiator Enterprise Loop',
        psu: 'Super Flower Leadex 2000W Titanium',
        case: 'Fractal Define 7 XL Heavy Sound Dampened'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAP15SruE8HHBO08yUvGekPwMRio612M6Ouj-2_OVSelnY_adgvV1jjUZun2SisfRs0E561szApUD-fdtO1Z0uueTY2MEdISvpvCQaG5GlDriE6a6UjFgg-WnSqM9SMof0VDngOGF0PwoGGwCjIIb5872J7lHSPbcy8OfjmkMFhzIP-AQ2S9OWk7ooSWhWwW-_uc-2SIztuInVNiPxBgRaPcqNwTlvsUQ9m4_XdxCwP-xJfKQGLMDvT3w',
      featured: 0
    },

    // GPUs
    {
      id: 'prod-gpu-rog-4090-white',
      slug: 'asus-rog-strix-rtx-4090-white',
      name: 'ASUS ROG Strix RTX 4090 OC White Edition',
      category: 'gpu',
      tier: 'Flagship AD102',
      price: 1999.99,
      compare_at_price: 2199.99,
      stock: 3,
      short_desc: 'White Edition, 2640 MHz Boost Clock, Ada Lovelace Architectural Masterpiece.',
      long_desc: 'ASUS ROG Strix GeForce RTX 4090 OC White Edition graphics card product shot, triple axial fans, geometric futuristic shroud, polished titanium heatsink fins, glowing subtle violet ambient accent lights.',
      specs_json: JSON.stringify({
        vram: '24GB GDDR6X',
        interface: 'PCIe 4.0 x16',
        tdp: 450,
        length_mm: 357,
        slots: 3.5,
        connectors: '1x 16-pin 12VHPWR'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZ4dp42aj-y6UEoSnLFwmnWxkkAKCSRpBi6c18QLPOLGjTip0PDUhiqC_sdCWHQU-Y0BOwKT7npN_DtaB7NiV6ndxofz2rAeiqKStyOAIKqv7ZD2T1eH1cL1Wz_3au5xyTqWhlA3zNaWQmB26wi9gEcWDTY38iV-rdy8wEAsWrrIehKjHUpIAFWDSXnjhU98EqcFdpGvlg8oYhGzAksVSAW2pbDhMdSSl2zTdMza7NjZJEjHFIwPuQVw',
      featured: 1
    },
    {
      id: 'prod-gpu-msi-suprim-liquid-4090',
      slug: 'msi-suprim-liquid-x-rtx-4090',
      name: 'MSI Suprim Liquid X RTX 4090 24G',
      category: 'gpu',
      tier: 'Hybrid AIO',
      price: 2099.99,
      compare_at_price: 2249.99,
      stock: 5,
      short_desc: 'Integrated Closed-Loop 240mm Radiator, Silent TORX 5.0 High Pressure Fans.',
      long_desc: 'Combines air and liquid cooling in a sleek brushed aluminum design. Features integrated low-profile pump and 240mm black aluminum radiator with zero RPM silent fan curve.',
      specs_json: JSON.stringify({
        vram: '24GB GDDR6X',
        interface: 'PCIe 4.0 x16',
        tdp: 450,
        length_mm: 280,
        radiator_mm: 240,
        slots: 2.0,
        connectors: '1x 16-pin 12VHPWR'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTXPzS0ayzme3ykSIuXPA-9SyiRR0QhkmGlcL-SbdEjzfU8PVW89V6Vc_cWpVrmiQJAY_90rXYt2Km8kzMDLjTqtoSFp8FkgIo6KhtHntrc5AnoAGXiRLbU0LPfH6y_HX7VXHSK3upt0mErZohYTvJj3FxlId1Ap7qL0EgDLbnkfKFmEgGXBD7NJDkjS7MxURxvv3Zxe5QvbBoK5ojKXrkyzAFmkpRg_6ncT9mc0SuT6Mz9ckKMI_prg',
      featured: 1
    },
    {
      id: 'prod-gpu-rtx-4080s-proart',
      slug: 'asus-proart-geforce-rtx-4080-super',
      name: 'ASUS ProArt GeForce RTX 4080 Super OC',
      category: 'gpu',
      tier: 'Pro Studio / Esport',
      price: 1149.99,
      compare_at_price: 1199.99,
      stock: 7,
      short_desc: '16GB GDDR6X, 2.5-slot compact high-density cooling, minimalist matte black & bronze accents.',
      long_desc: 'Crafted for creators and esports gamers desiring clean industrial lines and absolute stability. Fits in smaller SFF cases while delivering full 4K ray tracing performance.',
      specs_json: JSON.stringify({
        vram: '16GB GDDR6X',
        interface: 'PCIe 4.0 x16',
        tdp: 320,
        length_mm: 300,
        slots: 2.5,
        connectors: '1x 16-pin 12VHPWR'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZ4dp42aj-y6UEoSnLFwmnWxkkAKCSRpBi6c18QLPOLGjTip0PDUhiqC_sdCWHQU-Y0BOwKT7npN_DtaB7NiV6ndxofz2rAeiqKStyOAIKqv7ZD2T1eH1cL1Wz_3au5xyTqWhlA3zNaWQmB26wi9gEcWDTY38iV-rdy8wEAsWrrIehKjHUpIAFWDSXnjhU98EqcFdpGvlg8oYhGzAksVSAW2pbDhMdSSl2zTdMza7NjZJEjHFIwPuQVw',
      featured: 0
    },

    // CPUs
    {
      id: 'prod-cpu-amd-7950x3d',
      slug: 'amd-ryzen-9-7950x3d',
      name: 'AMD Ryzen 9 7950X3D',
      category: 'cpu',
      tier: 'Flagship AM5',
      price: 649.99,
      compare_at_price: 699.99,
      stock: 12,
      short_desc: '16 Cores, 32 Threads, 5.7 GHz Max Boost with 144MB 3D V-Cache Technology.',
      long_desc: 'The ultimate gaming and creator hybrid processor. Dual CCX design featuring AMD 3D V-Cache for record-breaking 1% minimum framerates in modern titles.',
      specs_json: JSON.stringify({
        socket: 'AM5',
        cores: 16,
        threads: 32,
        base_clock: '4.2 GHz',
        boost_clock: '5.7 GHz',
        tdp: 120,
        ram_gen: 'DDR5'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBViSGwgjhGMjz5pxJPxvMZbF7iYb4ZQ4k4rLNL1ivS0BgHSB996GgLJXaeOHifKkisjzFax447SlBj7hNSS3o-0hBn9BYQjtG_0pLg6_iZkoGDf8zXjYr28m88HYO830LOwnsauj3IVnLOeTz1KLWmzP6bCOtYVYat1Gee_P4JB6-z5ga17cDqLP3OIOMO6PWRLEH5mlHWhSlUjmYyKLWwC-bXePCiMOzmtJaorWkSNX_z28Q6v-0Lpw',
      featured: 1
    },
    {
      id: 'prod-cpu-intel-14900ks',
      slug: 'intel-core-i9-14900ks',
      name: 'Intel Core i9-14900KS Special Edition',
      category: 'cpu',
      tier: 'Special Edition LGA1700',
      price: 699.00,
      compare_at_price: 749.00,
      stock: 4,
      short_desc: '24 Cores (8P + 16E), 32 Threads, record 6.2 GHz Thermal Velocity Boost.',
      long_desc: 'Hand-binned silicon direct from Intel with unparalleled single-core velocity. Requires high-end liquid cooling with minimum 360mm radiator.',
      specs_json: JSON.stringify({
        socket: 'LGA1700',
        cores: 24,
        threads: 32,
        base_clock: '3.2 GHz',
        boost_clock: '6.2 GHz',
        tdp: 253,
        ram_gen: 'DDR5'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAw5M63TR7B1WbFjESOa5D9iTdX-nHue2n8TymPLWA-xBmCvKHaDtK3_dIu9Scb_T4GuuSv94oLjmTQH0RLc5ieLn40l-M-gy1WFknsvp2nglMusixz52eHoStnov7cDPTpN2r8c_KsgJ1PFvkJaBEI38oHAkIDUcOBB3-kJuzoUHSbq2t4Yd2llkISBuCvVqKyMVpjW7UHUwS9xaKzWLQ_-LvRf9EgfnURnffo625-Gq8uSL0DqKoOLQ',
      featured: 1
    },
    {
      id: 'prod-cpu-amd-7800x3d',
      slug: 'amd-ryzen-7-7800x3d',
      name: 'AMD Ryzen 7 7800X3D Gaming King',
      category: 'cpu',
      tier: 'Gaming Benchmark AM5',
      price: 449.99,
      compare_at_price: 499.99,
      stock: 9,
      short_desc: '8 Cores, 16 Threads, 104MB Cache, 5.0 GHz Boost - Pure Esports Dominance.',
      long_desc: 'Consistently ranked the best pure gaming CPU on the market. Single CCD architecture eliminates inter-core latency with massive L3 V-Cache.',
      specs_json: JSON.stringify({
        socket: 'AM5',
        cores: 8,
        threads: 16,
        base_clock: '4.2 GHz',
        boost_clock: '5.0 GHz',
        tdp: 120,
        ram_gen: 'DDR5'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBViSGwgjhGMjz5pxJPxvMZbF7iYb4ZQ4k4rLNL1ivS0BgHSB996GgLJXaeOHifKkisjzFax447SlBj7hNSS3o-0hBn9BYQjtG_0pLg6_iZkoGDf8zXjYr28m88HYO830LOwnsauj3IVnLOeTz1KLWmzP6bCOtYVYat1Gee_P4JB6-z5ga17cDqLP3OIOMO6PWRLEH5mlHWhSlUjmYyKLWwC-bXePCiMOzmtJaorWkSNX_z28Q6v-0Lpw',
      featured: 0
    },

    // RAM
    {
      id: 'prod-ram-gskill-trident-z5-64gb',
      slug: 'g-skill-trident-z5-rgb-64gb-ddr5-6400',
      name: 'G.SKILL Trident Z5 RGB 64GB (2x32GB)',
      category: 'ram',
      tier: 'DDR5 6400',
      price: 239.99,
      compare_at_price: 269.99,
      stock: 14,
      short_desc: '2x32GB Kit DDR5-6400 CL32, Intel XMP 3.0 & AMD EXPO, hand-screened SK Hynix dies.',
      long_desc: 'High-speed enthusiast DDR5 memory designed with brushed aluminum heatspreader and crystalline lighting diffuser bar for luminous RGB effects.',
      specs_json: JSON.stringify({
        capacity_gb: 64,
        modules: '2x32GB',
        generation: 'DDR5',
        speed_mhz: 6400,
        cas_latency: 'CL32',
        voltage: '1.40V'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA_KgeJ11ILoJ3K5gcZBkVsDqBLmCaQUtxmcsxEK3FOYI5_vzYOacMhkquPQ1E5Axh_PJciAaHmvwxpJhxXHSA2-PAoNx7Z2haY-oQembkhVohs2piHrPPT1VzX6cL-4XPZqecAHMccL2mcjxAqkaqJQeamwno7_DMRAuRbFTgJ7ngOxmw5hXACYiAF8wzzRsHNaOhUp-KKrs40n9B0U7aGiMxwJBXdmy1YkwJ-d5fy7-5Vv7s2RCQrKg',
      featured: 1
    },
    {
      id: 'prod-ram-corsair-dominator-titanium-64gb',
      slug: 'corsair-dominator-titanium-64gb-ddr5-7200',
      name: 'Corsair Dominator Titanium 64GB (2x32GB) 7200MHz',
      category: 'ram',
      tier: 'DDR5 7200 First Edition',
      price: 329.99,
      compare_at_price: 369.99,
      stock: 2,
      short_desc: '64GB DDR5 7200MHz, patented DHX cooling, interchangeable top bar, CL34.',
      long_desc: 'Corsair Dominator Titanium First Edition memory modules, matte gunmetal finish with swappable top heat spreader bar and programmable DHX cooling via iCUE.',
      specs_json: JSON.stringify({
        capacity_gb: 64,
        modules: '2x32GB',
        generation: 'DDR5',
        speed_mhz: 7200,
        cas_latency: 'CL34',
        voltage: '1.45V'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCONiVgEWfyWWP0SsGyO1UXq5bS1T_80CKkxB8sH64E3FTZMDsqxZ21T8dPJ6zTmHEablLa5eGLsc5sXvdUghof2oaOxNGZDtBgdUlBiJKObqii97p-daOkZmdF78_ynLICrCqF59jdd_S3XZp44zZpM2krAV83F_c4ol5Rr6Qki_rj7YEJ-ym5vn1tTgpWHCMutGgo5VRoXuAui6mIY28KCoC8VSiECf3vcyPpaqTnP4TCWOvu3Z2v4Q',
      featured: 1
    },

    // Motherboards
    {
      id: 'prod-mb-rog-maximus-z790-dark-hero',
      slug: 'asus-rog-maximus-z790-dark-hero',
      name: 'ASUS ROG Maximus Z790 Dark Hero',
      category: 'motherboard',
      tier: 'LGA1700 Flagship',
      price: 699.99,
      compare_at_price: 749.99,
      stock: 8,
      short_desc: 'Intel Z790 LGA1700, 20+1+2 power stages, DDR5 8000+ MT/s OC, PCIe 5.0, Wi-Fi 7.',
      long_desc: 'Monolithic matte black design with Polymo Lighting I/O shroud, integrated PCIe 5.0 M.2 slot with thermal pipe, dual Thunderbolt 4 ports, and SupremeFX ALC4082 audio.',
      specs_json: JSON.stringify({
        socket: 'LGA1700',
        chipset: 'Intel Z790',
        form_factor: 'ATX',
        ram_gen: 'DDR5',
        ram_slots: 4,
        pcie_version: '5.0',
        m2_slots: 5
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZ4dp42aj-y6UEoSnLFwmnWxkkAKCSRpBi6c18QLPOLGjTip0PDUhiqC_sdCWHQU-Y0BOwKT7npN_DtaB7NiV6ndxofz2rAeiqKStyOAIKqv7ZD2T1eH1cL1Wz_3au5xyTqWhlA3zNaWQmB26wi9gEcWDTY38iV-rdy8wEAsWrrIehKjHUpIAFWDSXnjhU98EqcFdpGvlg8oYhGzAksVSAW2pbDhMdSSl2zTdMza7NjZJEjHFIwPuQVw',
      featured: 0
    },
    {
      id: 'prod-mb-rog-crosshair-x670e-hero',
      slug: 'asus-rog-crosshair-x670e-hero',
      name: 'ASUS ROG Crosshair X670E Hero',
      category: 'motherboard',
      tier: 'AM5 Flagship',
      price: 649.99,
      compare_at_price: 699.99,
      stock: 6,
      short_desc: 'AMD X670E AM5, 18+2 teamed power stages, DDR5 EXPO, PCIe 5.0, Wi-Fi 6E.',
      long_desc: 'Uncompromising power delivery for AMD Ryzen 7000/9000 Series processors with dual USB4 Type-C 40Gbps, massive VRM heatsinks, and Quick-Release PCIe Slot button.',
      specs_json: JSON.stringify({
        socket: 'AM5',
        chipset: 'AMD X670E',
        form_factor: 'ATX',
        ram_gen: 'DDR5',
        ram_slots: 4,
        pcie_version: '5.0',
        m2_slots: 4
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZ4dp42aj-y6UEoSnLFwmnWxkkAKCSRpBi6c18QLPOLGjTip0PDUhiqC_sdCWHQU-Y0BOwKT7npN_DtaB7NiV6ndxofz2rAeiqKStyOAIKqv7ZD2T1eH1cL1Wz_3au5xyTqWhlA3zNaWQmB26wi9gEcWDTY38iV-rdy8wEAsWrrIehKjHUpIAFWDSXnjhU98EqcFdpGvlg8oYhGzAksVSAW2pbDhMdSSl2zTdMza7NjZJEjHFIwPuQVw',
      featured: 0
    },

    // Cooling
    {
      id: 'prod-cool-ek-velocity2-direct-die',
      slug: 'ek-quantum-velocity2-direct-die-lga1700',
      name: 'EK-Quantum Velocity² Direct Die D-RGB',
      category: 'cooling',
      tier: 'Delidded Custom Loop',
      price: 189.99,
      compare_at_price: 209.99,
      stock: 3,
      short_desc: 'Nickel + Plexi delidded Intel contact block with integrated D-RGB backlight.',
      long_desc: 'Precision CNC machined nickel-plated copper cold plate directly contacting the exposed silicon die for up to 18°C lower core thermals under max wattage.',
      specs_json: JSON.stringify({
        socket: 'LGA1700',
        material: 'Nickel Plated Copper / Plexi',
        threads: 'G1/4 inch',
        rgb: 'Addressable D-RGB 5V',
        flow_profile: 'High Flow Direct Jet'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuASSmE7bXzQ_hcLfwmNH-0iAutQ_WKxFduZxR_Hn6raQjKQnWDM2GVOWa1xJm-T81tgUveM6qlL2tS7ecnraf6-0DJ73DfwAg3VHq7TomxrAUvsf_xuaH6kPxWpUZHxiymQyeZvC251kfA492C4vPeJPNiJdMDAjxG5bgsoz_m4b8mzG9KS4Slqk6lhIoooJKrr3swJ0YH1FXes7MydcZ5Q4InDJg1mZbZFk8iqE7rmz7QMkZEWrR2t8w',
      featured: 1
    },
    {
      id: 'prod-cool-arctic-freezer-iii-360',
      slug: 'arctic-liquid-freezer-iii-360-argb',
      name: 'Arctic Liquid Freezer III 360 A-RGB',
      category: 'cooling',
      tier: 'All-In-One Liquid 360',
      price: 139.99,
      compare_at_price: 159.99,
      stock: 15,
      short_desc: '38mm thick radiator, VRM active cooling fan, integrated cable management.',
      long_desc: 'Award-winning thermal dissipation featuring upgraded in-house PWM pump and 40mm VRM fan to actively cool motherboard power phases.',
      specs_json: JSON.stringify({
        socket: 'LGA1700, AM5, AM4',
        radiator_mm: 360,
        radiator_thickness_mm: 38,
        fans: '3x 120mm P12 PWM PST A-RGB'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTXPzS0ayzme3ykSIuXPA-9SyiRR0QhkmGlcL-SbdEjzfU8PVW89V6Vc_cWpVrmiQJAY_90rXYt2Km8kzMDLjTqtoSFp8FkgIo6KhtHntrc5AnoAGXiRLbU0LPfH6y_HX7VXHSK3upt0mErZohYTvJj3FxlId1Ap7qL0EgDLbnkfKFmEgGXBD7NJDkjS7MxURxvv3Zxe5QvbBoK5ojKXrkyzAFmkpRg_6ncT9mc0SuT6Mz9ckKMI_prg',
      featured: 0
    },

    // Storage
    {
      id: 'prod-ssd-samsung-990-pro-4tb',
      slug: 'samsung-990-pro-4tb-heatsink',
      name: 'Samsung 990 PRO 4TB NVMe SSD with Heatsink',
      category: 'storage',
      tier: 'PCIe 4.0 Top Tier',
      price: 349.99,
      compare_at_price: 399.99,
      stock: 11,
      short_desc: 'M.2 2280 NVMe SSD with Custom Aluminum Heatsink, 7,450 MB/s Read, 2,400 TBW.',
      long_desc: 'Samsung 990 PRO 4TB PCIe 4.0 NVMe M.2 solid state drive with integrated matte black heatsink and futuristic red LED accent edge, angled studio macro.',
      specs_json: JSON.stringify({
        capacity_tb: 4,
        interface: 'PCIe Gen 4.0 x4, NVMe 2.0',
        read_mb_s: 7450,
        write_mb_s: 6900,
        tbw: 2400,
        cache: '4GB LPDDR4'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD2Lpl9GgX8XriZsPq0J03i1MflkntohnBqq8gdvFkB7BIp1YpCosGDV80m14-iPHCVVXa5dMo2-4J-KsTQ3VMyrv4_yXFCfQMcxn1U9juS2G4it2uuGx187gfAH0j1j-EWE5y8Rktir9_GfOt_dDLqyS7FBjW_aNStQF-kCMg-Wt9937V0aHZ5LGuiAvCRqnt7NWLXjl-X9Fl49ps2uAF1jPFm0XY3ea8fvHkhZjjCtm6mQdPX6TdtEQ',
      featured: 1
    },

    // Power Supplies
    {
      id: 'prod-psu-seasonic-tx1600',
      slug: 'seasonic-prime-tx-1600-titanium-atx30',
      name: 'Seasonic Prime TX-1600 Titanium ATX 3.0',
      category: 'psu',
      tier: '80 PLUS Titanium Flagship',
      price: 599.99,
      compare_at_price: 649.99,
      stock: 5,
      short_desc: '1600W, Native Dual 12V-2x6 PCIe 5.1, 12-Year Warranty, Micro Tolerance Load Reg.',
      long_desc: 'Clean continuous electrical stability with 0.5% micro-tolerance load regulation and whisper-quiet 135mm Fluid Dynamic Bearing fan.',
      specs_json: JSON.stringify({
        wattage: 1600,
        efficiency: '80 PLUS Titanium',
        modularity: 'Full Modular',
        atx_standard: 'ATX 3.0 / PCIe 5.0 12VHPWR Ready',
        warranty_years: 12
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCONiVgEWfyWWP0SsGyO1UXq5bS1T_80CKkxB8sH64E3FTZMDsqxZ21T8dPJ6zTmHEablLa5eGLsc5sXvdUghof2oaOxNGZDtBgdUlBiJKObqii97p-daOkZmdF78_ynLICrCqF59jdd_S3XZp44zZpM2krAV83F_c4ol5Rr6Qki_rj7YEJ-ym5vn1tTgpWHCMutGgo5VRoXuAui6mIY28KCoC8VSiECf3vcyPpaqTnP4TCWOvu3Z2v4Q',
      featured: 0
    },

    // Cases
    {
      id: 'prod-case-lianli-o11-evo-xl',
      slug: 'lian-li-o11-dynamic-evo-xl-black',
      name: 'Lian Li O11 Dynamic EVO XL - Black',
      category: 'case',
      tier: 'Enthusiast Show Chassis',
      price: 244.99,
      compare_at_price: 269.99,
      stock: 7,
      short_desc: 'Full tower dual chamber, pillar-less tempered glass, tri-radiator 420mm support.',
      long_desc: 'Engineered for extreme liquid cooling builds. Features reversible chassis configuration, multi-way GPU upright bracket, and toolless tempered glass panels.',
      specs_json: JSON.stringify({
        form_factor_support: 'E-ATX, ATX, Micro-ATX, Mini-ITX',
        gpu_max_length_mm: 460,
        psu_max_length_mm: 220,
        radiator_support_mm: 'Up to 3x 420mm simultaneously',
        dimensions_mm: '522 x 304 x 531.9'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAP15SruE8HHBO08yUvGekPwMRio612M6Ouj-2_OVSelnY_adgvV1jjUZun2SisfRs0E561szApUD-fdtO1Z0uueTY2MEdISvpvCQaG5GlDriE6a6UjFgg-WnSqM9SMof0VDngOGF0PwoGGwCjIIb5872J7lHSPbcy8OfjmkMFhzIP-AQ2S9OWk7ooSWhWwW-_uc-2SIztuInVNiPxBgRaPcqNwTlvsUQ9m4_XdxCwP-xJfKQGLMDvT3w',
      featured: 0
    },

    // Peripherals
    {
      id: 'prod-periph-rog-pg248qp-540hz',
      slug: 'asus-rog-swift-pro-pg248qp-540hz',
      name: 'ASUS ROG Swift Pro PG248QP 540Hz OLED/E-TN',
      category: 'peripheral',
      tier: 'Esport Tournament Display',
      price: 899.00,
      compare_at_price: 999.00,
      stock: 4,
      short_desc: '24.1-inch FHD 540Hz (OC) Esports-TN, 0.2ms, ULMB 2, NVIDIA G-SYNC Reflex Analyzer.',
      long_desc: 'The fastest esports gaming monitor ever designed. Ergonomic base with retractable claws to allow hyper-close mousepad and keyboard setups for professional tournaments.',
      specs_json: JSON.stringify({
        screen_size_inch: 24.1,
        refresh_rate_hz: 540,
        resolution: '1920x1080',
        response_time: '0.2ms GTG',
        technology: 'Esports-TN with ULMB 2'
      }),
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZ4dp42aj-y6UEoSnLFwmnWxkkAKCSRpBi6c18QLPOLGjTip0PDUhiqC_sdCWHQU-Y0BOwKT7npN_DtaB7NiV6ndxofz2rAeiqKStyOAIKqv7ZD2T1eH1cL1Wz_3au5xyTqWhlA3zNaWQmB26wi9gEcWDTY38iV-rdy8wEAsWrrIehKjHUpIAFWDSXnjhU98EqcFdpGvlg8oYhGzAksVSAW2pbDhMdSSl2zTdMza7NjZJEjHFIwPuQVw',
      featured: 0
    }
  ];

  for (const item of initialProducts) {
    insertProduct.run(item);
  }
}

// Seed default admin and initial repair ticket if not present
const adminCheck = db.prepare("SELECT * FROM users WHERE email = 'admin@ultrapc.com'").get();
if (!adminCheck) {
  const { hash, salt } = hashPassword('AdminPass2025!');
  const adminId = 'usr-admin-master-01';
  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, name, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(adminId, 'admin@ultrapc.com', hash, salt, 'UltraPC Chief Architect', 'admin');

  db.prepare(`
    INSERT INTO user_profiles (user_id, phone, company, shipping_address, shipping_city, shipping_state, shipping_zip, shipping_country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(adminId, '+1 (415) 890-7722', 'UltraPC Atelier HQ', '100 Silicon Way, Suite 400', 'San Francisco', 'CA', '94107', 'United States');
}

// Also seed the featured live ticket referenced on the storefront so lookup works instantly with authentic database data
const ticketCheck = db.prepare("SELECT * FROM repair_tickets WHERE id = 'UPC-92841'").get();
if (!ticketCheck) {
  db.prepare(`
    INSERT INTO repair_tickets (
      id, customer_name, customer_email, customer_phone, hardware_model, serial_number,
      issue_description, phase, phase_name, progress_percent, estimated_dispatch, technician_notes, status
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    'UPC-92841',
    'Marcus Vance',
    'm.vance@vanguard-esports.gg',
    '+1 (503) 555-0199',
    'Titan Horizon RTX 4090 Custom Acrylic Loop',
    'UPC-TITAN-094',
    'Annual loop decontamination, ultrasonic radiator flush, and liquid metal TIM re-application.',
    4,
    'Custom Loop Pressure Testing & Hydro-Leak Sweep',
    85,
    'Tomorrow 4:00 PM PST',
    'Ultrasonic flush completed with 0 particulate detected. Pressure held at 0.75 bar for 12 hours with zero decay.',
    'active'
  );
}

module.exports = {
  db,
  hashPassword,
  verifyPassword
};
