// Client API and State Management for UltraPC Atelier Storefront
const UPC_CLIENT = {
  cart: [],
  currentUser: null,
  products: [],
  currentRoute: 'home',
  selectedRigParts: {
    cpu: 'prod-cpu-intel-14900ks',
    motherboard: 'prod-mb-rog-maximus-z790-dark-hero',
    ram: 'prod-ram-gskill-trident-z5-64gb',
    gpu: 'prod-gpu-rog-4090-white',
    cooling: 'prod-cool-ek-velocity2-direct-die',
    psu: 'prod-psu-seasonic-tx1600',
    case: 'prod-case-lianli-o11-evo-xl',
    storage: 'prod-ssd-samsung-990-pro-4tb'
  },

  async init() {
    this.loadLocalCart();
    await this.checkAuth();
    await this.fetchProducts();
    this.bindEvents();
    this.handleRoute();
    window.addEventListener('popstate', () => this.handleRoute());
  },

  loadLocalCart() {
    try {
      const stored = localStorage.getItem('upc_cart');
      this.cart = stored ? JSON.parse(stored) : [];
    } catch (e) {
      this.cart = [];
    }
    this.updateCartBadge();
  },

  saveCart() {
    localStorage.setItem('upc_cart', JSON.stringify(this.cart));
    this.updateCartBadge();
  },

  async updateCartBadge() {
    const badge = document.getElementById('cartCountBadge');
    const totalLabel = document.getElementById('cartHeaderTotal');
    const totalQty = this.cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    if (badge) badge.textContent = totalQty;

    // Validate with server to get authentic sum
    if (this.cart.length > 0) {
      try {
        const res = await fetch('/api/cart/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: this.cart })
        });
        const data = await res.json();
        if (totalLabel && data.total !== undefined) {
          totalLabel.textContent = `$${data.total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        }
      } catch (err) {
        // fallback
      }
    } else {
      if (totalLabel) totalLabel.textContent = '$0';
    }
  },

  async checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated) {
        this.currentUser = data.user;
        this.renderUserBadge();
      } else {
        this.currentUser = null;
        this.renderUserBadge();
      }
    } catch (e) {
      this.currentUser = null;
    }
  },

  renderUserBadge() {
    const btn = document.getElementById('accountHeaderBtn');
    if (!btn) return;
    if (this.currentUser) {
      btn.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-on-primary font-mono text-xs">
            ${this.currentUser.name.slice(0, 2).toUpperCase()}
          </div>
          <span class="hidden md:inline font-label-sm text-label-sm text-on-surface">${this.currentUser.name.split(' ')[0]}</span>
        </div>
      `;
      btn.title = `Logged in as ${this.currentUser.email}`;
    } else {
      btn.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">person</span>
        </div>
      `;
      btn.title = 'Sign In / Account';
    }
  },

  async fetchProducts() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      this.products = data.products || [];
    } catch (e) {
      this.products = [];
    }
  },

  bindEvents() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-path]');
      if (target) {
        e.preventDefault();
        const route = target.getAttribute('data-path');
        this.navigateTo(route);
      }
    });

    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.navigateTo('pc-components', { q: searchInput.value.trim() });
        }
      });
    }

    // Ctrl+K Shortcut focus search
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = document.getElementById('globalSearchInput');
        if (input) input.focus();
      }
    });
  },

  navigateTo(route, params = {}) {
    this.currentRoute = route;
    let url = `#${route}`;
    if (params && Object.keys(params).length > 0) {
      url += '?' + new URLSearchParams(params).toString();
    }
    window.location.hash = url;
    this.handleRoute();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  handleRoute() {
    const rawHash = window.location.hash.replace(/^#/, '');
    const [pathPart, queryPart] = rawHash.split('?');
    const route = pathPart || 'home';
    const params = new URLSearchParams(queryPart || '');

    // Highlight active nav item
    document.querySelectorAll('nav a[data-path]').forEach(link => {
      if (link.getAttribute('data-path') === route) {
        link.classList.add('text-primary', 'font-bold');
        link.classList.remove('text-on-surface-variant');
      } else {
        link.classList.remove('text-primary', 'font-bold');
        link.classList.add('text-on-surface-variant');
      }
    });

    const mainContainer = document.getElementById('appContentContainer');
    if (!mainContainer) return;

    switch (route) {
      case 'home':
        this.renderHomePage(mainContainer);
        break;
      case 'pre-built-rigs':
        this.renderPreBuiltRigsPage(mainContainer);
        break;
      case 'custom-configurator':
        this.renderConfiguratorPage(mainContainer);
        break;
      case 'pc-components':
      case 'liquid-cooling':
      case 'peripherals':
        this.renderComponentsPage(mainContainer, route, params.get('q'));
        break;
      case 'repair-service':
        this.renderRepairPage(mainContainer);
        break;
      case 'shopping-cart':
        this.renderShoppingCartPage(mainContainer);
        break;
      case 'checkout':
        this.renderCheckoutPage(mainContainer);
        break;
      case 'account-overview':
        this.renderAccountPage(mainContainer);
        break;
      case 'admin-dashboard':
        this.renderAdminPage(mainContainer);
        break;
      default:
        this.renderHomePage(mainContainer);
    }
  },

  // ---------------- ROUTE RENDERERS ----------------

  renderHomePage(container) {
    const originalHome = document.getElementById('homeStaticTemplate');
    if (originalHome) {
      container.innerHTML = originalHome.innerHTML;
      this.hydrateHomeInteractions();
    }
  },

  hydrateHomeInteractions() {
    // Connect dynamic real repair tracking form on homepage
    const ticketForm = document.getElementById('homeTicketForm');
    if (ticketForm) {
      ticketForm.onsubmit = async (e) => {
        e.preventDefault();
        const input = document.getElementById('homeTicketInput');
        const id = input ? input.value.trim() : '';
        if (id) {
          await this.trackTicketDirectly(id);
        }
      };
    }
  },

  async trackTicketDirectly(ticketId) {
    const resultBox = document.getElementById('ticketResultBox');
    if (!resultBox) return;

    resultBox.innerHTML = `
      <div class="p-6 flex items-center justify-center gap-3 text-on-surface-variant">
        <span class="inline-block w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
        <span class="font-mono text-sm">Querying real-time workshop diagnostic database for ${ticketId}...</span>
      </div>
    `;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
      const res = await fetch(`/api/repairs/track/${encodeURIComponent(ticketId)}`);
      const data = await res.json();

      if (!res.ok || !data.found) {
        resultBox.innerHTML = `
          <div class="p-5 flex items-start gap-4 text-error">
            <span class="material-symbols-outlined text-[24px]">error</span>
            <div class="flex flex-col gap-1">
              <span class="font-headline-sm text-sm font-bold uppercase">No Repair Record Found</span>
              <p class="font-body-sm text-sm text-on-surface-variant">${data.error || 'The requested ticket ID does not exist in our active or historical records.'}</p>
              <div class="mt-2 flex gap-3">
                <button onclick="UPC_CLIENT.navigateTo('repair-service')" class="px-3 py-1.5 rounded bg-primary-container text-on-primary text-xs uppercase font-bold">Open RMA Portal</button>
              </div>
            </div>
          </div>
        `;
        return;
      }

      const t = data.ticket;
      resultBox.innerHTML = `
        <div class="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-tertiary/20 flex items-center justify-center text-tertiary">
              <span class="material-symbols-outlined text-[28px]">biotech</span>
            </div>
            <div class="flex flex-col">
              <div class="flex items-center gap-2">
                <span class="font-label-md text-label-md font-mono text-on-surface font-bold">Ticket #${t.id}</span>
                <span class="px-2.5 py-0.5 rounded-full bg-tertiary-container/30 text-tertiary font-label-sm text-label-sm font-bold uppercase">Phase ${t.phase} / 5</span>
                <span class="px-2 py-0.5 rounded bg-surface-container font-mono text-[11px] text-outline uppercase">${t.hardware_model}</span>
              </div>
              <span class="font-body-md text-body-md text-on-surface mt-1">${t.phase_name}</span>
              <p class="font-body-sm text-body-sm text-on-surface-variant italic mt-0.5">"${t.technician_notes}"</p>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-6">
            <div class="flex flex-col min-w-[200px]">
              <div class="flex justify-between font-label-sm text-label-sm mb-1 font-mono">
                <span class="text-outline">BENCH PROGRESS</span>
                <span class="text-tertiary font-bold">${t.progress_percent}% COMPLETE</span>
              </div>
              <div class="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                <div class="h-full bg-gradient-to-r from-primary to-tertiary rounded-full" style="width: ${t.progress_percent}%"></div>
              </div>
            </div>
            <div class="flex items-center gap-2 text-on-surface font-label-sm text-label-sm font-mono bg-surface-container-highest px-3 py-2 rounded-lg">
              <span class="material-symbols-outlined text-primary text-[18px]">local_shipping</span>
              <span>EST. SHIP: ${t.estimated_dispatch || 'In Diagnostics'}</span>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      resultBox.innerHTML = `<div class="p-4 text-error">Network error retrieving repair status. Please try again.</div>`;
    }
  },

  renderPreBuiltRigsPage(container) {
    const rigs = this.products.filter(p => p.category === 'rig');
    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-6 lg:px-12 py-12">
        <div class="flex flex-col gap-2 mb-10">
          <div class="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-wider">
            <span class="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
            Handcrafted In-House • Precision Hydro-Tested
          </div>
          <h1 class="font-display-hero-mobile md:font-display-hero text-on-surface uppercase font-bold tracking-tight">Enthusiast Pre-Built Rigs</h1>
          <p class="font-body-lg text-on-surface-variant max-w-3xl">
            Designed for those who demand maximum sustained clock rates without building from scratch. Every UltraPC Atelier rig is hand-bent, pressure-tested, binned, and thermally guaranteed.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          ${rigs.map(rig => {
            const specs = typeof rig.specs_json === 'string' ? JSON.parse(rig.specs_json) : rig.specs_json;
            return `
              <div class="flex flex-col justify-between rounded-2xl bg-surface-container p-6 shadow-xl border border-outline-variant/30 hover:border-primary/50 transition-all duration-300 group">
                <div>
                  <div class="flex items-center justify-between mb-4">
                    <span class="px-3 py-1 rounded-full bg-primary/20 text-primary font-label-sm font-bold uppercase">${rig.tier}</span>
                    <span class="font-label-sm text-emerald-400 font-semibold flex items-center gap-1">
                      <span class="w-2 h-2 rounded-full bg-emerald-400"></span> ${rig.stock} Ready
                    </span>
                  </div>

                  <div class="w-full h-56 rounded-xl bg-surface-container-lowest overflow-hidden mb-6 flex items-center justify-center relative">
                    <img src="${rig.image_url}" alt="${rig.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                  </div>

                  <h3 class="font-headline-sm text-on-surface font-bold uppercase mb-2">${rig.name}</h3>
                  <p class="font-body-sm text-on-surface-variant line-clamp-2 mb-6">${rig.short_desc}</p>

                  <div class="space-y-2 py-3 border-y border-surface-container-highest font-mono text-xs text-on-surface-variant">
                    <div class="flex justify-between"><span>CPU</span><span class="text-on-surface font-semibold">${specs.cpu || 'N/A'}</span></div>
                    <div class="flex justify-between"><span>GPU</span><span class="text-primary font-semibold">${specs.gpu || 'N/A'}</span></div>
                    <div class="flex justify-between"><span>RAM</span><span class="text-on-surface font-semibold">${specs.ram || 'N/A'}</span></div>
                    <div class="flex justify-between"><span>NVMe</span><span class="text-tertiary font-semibold">${specs.storage || 'N/A'}</span></div>
                  </div>
                </div>

                <div class="mt-6 pt-4 flex items-center justify-between">
                  <div class="flex flex-col">
                    <span class="font-label-sm text-outline uppercase">Starting Price</span>
                    <span class="font-headline-sm font-mono text-on-surface font-bold">$${rig.price.toLocaleString()}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <button onclick="UPC_CLIENT.addToCart('${rig.id}')" class="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md uppercase font-bold transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                      Order Rig
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  renderConfiguratorPage(container) {
    const cpus = this.products.filter(p => p.category === 'cpu');
    const mbs = this.products.filter(p => p.category === 'motherboard');
    const rams = this.products.filter(p => p.category === 'ram');
    const gpus = this.products.filter(p => p.category === 'gpu');
    const coolers = this.products.filter(p => p.category === 'cooling');
    const psus = this.products.filter(p => p.category === 'psu');
    const cases = this.products.filter(p => p.category === 'case');
    const storages = this.products.filter(p => p.category === 'storage');

    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-6 lg:px-12 py-12">
        <div class="flex flex-col gap-2 mb-8">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container text-tertiary font-mono text-xs uppercase w-max">
            <span class="material-symbols-outlined text-[16px]">view_in_ar</span> Real-Time Hardware Architecture Configurator
          </div>
          <h1 class="font-display-hero-mobile md:font-display-hero text-on-surface uppercase font-bold tracking-tight">Custom PC Atelier Studio</h1>
          <p class="font-body-lg text-on-surface-variant max-w-3xl">
            Select silicon and cooling hardware validated in real-time by our electrical and mechanical compatibility engine.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <!-- Left: Component Selectors (8 cols) -->
          <div class="lg:col-span-8 space-y-6">
            ${this.renderConfigSlot('Processor (CPU)', 'cpu', cpus)}
            ${this.renderConfigSlot('Motherboard', 'motherboard', mbs)}
            ${this.renderConfigSlot('System Memory (RAM)', 'ram', rams)}
            ${this.renderConfigSlot('Graphics Card (GPU)', 'gpu', gpus)}
            ${this.renderConfigSlot('Thermal Cooling System', 'cooling', coolers)}
            ${this.renderConfigSlot('Power Supply Unit (PSU)', 'psu', psus)}
            ${this.renderConfigSlot('Chassis / Case', 'case', cases)}
            ${this.renderConfigSlot('Primary NVMe Storage', 'storage', storages)}
          </div>

          <!-- Right: Live Compatibility & Rig Summary (4 cols sticky) -->
          <div class="lg:col-span-4 sticky top-40 space-y-6">
            <div class="p-6 rounded-2xl bg-surface-container border border-outline-variant/40 shadow-xl" id="configSummaryBox">
              <h3 class="font-headline-sm text-on-surface font-bold uppercase mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-primary">analytics</span> Build Telemetry
              </h3>

              <div id="compatibilityFeedback" class="mb-4">
                <div class="p-3 rounded-lg bg-surface-container-high text-xs text-on-surface-variant font-mono">
                  Evaluating electrical rails & sockets...
                </div>
              </div>

              <div class="space-y-3 py-4 border-y border-surface-container-highest font-mono text-xs">
                <div class="flex justify-between text-on-surface-variant">
                  <span>ESTIMATED LOAD:</span>
                  <span class="text-tertiary font-bold" id="estTdpReadout">-- W</span>
                </div>
                <div class="flex justify-between text-on-surface-variant">
                  <span>RECOMMENDED PSU:</span>
                  <span class="text-on-surface font-bold" id="recPsuReadout">-- W</span>
                </div>
                <div class="flex justify-between text-on-surface-variant">
                  <span>TOTAL BUILD PRICE:</span>
                  <span class="text-primary font-bold text-lg" id="buildTotalReadout">$0.00</span>
                </div>
              </div>

              <div class="mt-6 flex flex-col gap-3">
                <button id="addCustomBuildBtn" onclick="UPC_CLIENT.deployCustomBuild()" class="w-full py-3.5 rounded-lg bg-gradient-to-r from-primary to-secondary text-on-primary font-label-lg uppercase tracking-wider font-bold shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:brightness-110 transition-all">
                  Deploy Custom Build to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.validateCurrentConfig();
  },

  renderConfigSlot(title, slotName, options) {
    const currentVal = this.selectedRigParts[slotName] || '';
    return `
      <div class="p-5 rounded-xl bg-surface-container-low border border-outline-variant/20 shadow-sm">
        <label class="block font-label-md text-on-surface uppercase font-bold mb-3 flex items-center justify-between">
          <span>${title}</span>
          <span class="text-xs text-primary font-mono uppercase font-normal">${options.length} Verified Options</span>
        </label>
        <select onchange="UPC_CLIENT.onConfigPartChange('${slotName}', this.value)" class="w-full bg-surface-container px-4 py-3 rounded-lg font-body-sm text-on-surface border border-outline-variant/40 focus:border-primary focus:outline-none font-mono">
          <option value="">-- Choose Hardware Component --</option>
          ${options.map(opt => `
            <option value="${opt.id}" ${opt.id === currentVal ? 'selected' : ''}>
              ${opt.name} ($${opt.price.toLocaleString()}) - ${opt.short_desc}
            </option>
          `).join('')}
        </select>
      </div>
    `;
  },

  async onConfigPartChange(slot, productId) {
    this.selectedRigParts[slot] = productId;
    await this.validateCurrentConfig();
  },

  async validateCurrentConfig() {
    const feedbackBox = document.getElementById('compatibilityFeedback');
    const tdpLabel = document.getElementById('estTdpReadout');
    const psuLabel = document.getElementById('recPsuReadout');
    const totalLabel = document.getElementById('buildTotalReadout');
    const deployBtn = document.getElementById('addCustomBuildBtn');

    // Calculate sum price
    let sum = 0;
    for (const [slot, id] of Object.entries(this.selectedRigParts)) {
      if (id) {
        const p = this.products.find(prod => prod.id === id);
        if (p) sum += p.price;
      }
    }
    if (totalLabel) totalLabel.textContent = `$${sum.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    try {
      const res = await fetch('/api/configurator/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_parts: this.selectedRigParts })
      });
      const data = await res.json();

      if (tdpLabel) tdpLabel.textContent = `${data.estimatedTdpWatts} W`;
      if (psuLabel) psuLabel.textContent = `${data.recommendedPsuWatts} W`;

      if (feedbackBox) {
        if (!data.valid) {
          feedbackBox.innerHTML = `
            <div class="p-3 rounded-lg bg-error/10 border border-error/30 text-error text-xs font-mono space-y-1">
              <div class="font-bold flex items-center gap-1"><span class="material-symbols-outlined text-sm">warning</span> COMPATIBILITY ISSUE DETECTED</div>
              ${data.errors.map(err => `<div>• ${err}</div>`).join('')}
            </div>
          `;
          if (deployBtn) {
            deployBtn.disabled = true;
            deployBtn.classList.add('opacity-50', 'cursor-not-allowed');
          }
        } else {
          let warningHtml = '';
          if (data.warnings && data.warnings.length > 0) {
            warningHtml = `
              <div class="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-1 mt-2">
                <div class="font-bold flex items-center gap-1"><span class="material-symbols-outlined text-sm">info</span> HEADROOM ADVISORY</div>
                ${data.warnings.map(w => `<div>• ${w}</div>`).join('')}
              </div>
            `;
          }
          feedbackBox.innerHTML = `
            <div class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
              <span class="material-symbols-outlined text-sm">verified</span> All selected components are electrically and mechanically compatible.
            </div>
            ${warningHtml}
          `;
          if (deployBtn) {
            deployBtn.disabled = false;
            deployBtn.classList.remove('opacity-50', 'cursor-not-allowed');
          }
        }
      }
    } catch (e) {
      // fallback
    }
  },

  deployCustomBuild() {
    const customRigItem = {
      id: 'prod-rig-apex-titan', // base rig archetype
      quantity: 1,
      config_details: {
        build_type: 'UltraPC Custom Configured Atelier Rig',
        parts: this.selectedRigParts,
        configured_at: new Date().toISOString()
      }
    };
    this.cart.push(customRigItem);
    this.saveCart();
    this.navigateTo('shopping-cart');
  },

  renderComponentsPage(container, categoryRoute, searchQuery = '') {
    let catFilter = 'all';
    if (categoryRoute === 'liquid-cooling') catFilter = 'cooling';
    if (categoryRoute === 'peripherals') catFilter = 'peripheral';

    let filtered = this.products;
    if (catFilter !== 'all') {
      filtered = filtered.filter(p => p.category === catFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.short_desc.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-6 lg:px-12 py-12">
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div class="flex flex-col gap-1">
            <span class="font-label-sm text-secondary uppercase tracking-wider">Atelier Component Supply</span>
            <h1 class="font-headline-lg uppercase text-on-surface">${categoryRoute === 'liquid-cooling' ? 'Liquid Cooling & Thermal' : (categoryRoute === 'peripherals' ? 'Esport & Studio Peripherals' : 'Enthusiast Grade Hardware')}</h1>
            <p class="font-body-md text-on-surface-variant">Real-time inventory from our binned laboratory stock.</p>
          </div>

          <div class="flex items-center gap-2 overflow-x-auto pb-2">
            <button onclick="UPC_CLIENT.filterComponentCategory('all')" class="cat-pill px-4 py-2 rounded-lg ${catFilter === 'all' ? 'bg-primary-container text-on-primary' : 'bg-surface-container-high text-on-surface'} font-label-md uppercase font-semibold">All</button>
            <button onclick="UPC_CLIENT.filterComponentCategory('gpu')" class="cat-pill px-4 py-2 rounded-lg bg-surface-container-high text-on-surface font-label-md uppercase font-semibold">GPU</button>
            <button onclick="UPC_CLIENT.filterComponentCategory('cpu')" class="cat-pill px-4 py-2 rounded-lg bg-surface-container-high text-on-surface font-label-md uppercase font-semibold">CPU</button>
            <button onclick="UPC_CLIENT.filterComponentCategory('ram')" class="cat-pill px-4 py-2 rounded-lg bg-surface-container-high text-on-surface font-label-md uppercase font-semibold">RAM</button>
            <button onclick="UPC_CLIENT.filterComponentCategory('cooling')" class="cat-pill px-4 py-2 rounded-lg ${catFilter === 'cooling' ? 'bg-primary-container text-on-primary' : 'bg-surface-container-high text-on-surface'} font-label-md uppercase font-semibold">Water Cooling</button>
            <button onclick="UPC_CLIENT.filterComponentCategory('storage')" class="cat-pill px-4 py-2 rounded-lg bg-surface-container-high text-on-surface font-label-md uppercase font-semibold">Storage</button>
            <button onclick="UPC_CLIENT.filterComponentCategory('peripheral')" class="cat-pill px-4 py-2 rounded-lg ${catFilter === 'peripheral' ? 'bg-primary-container text-on-primary' : 'bg-surface-container-high text-on-surface'} font-label-md uppercase font-semibold">Peripherals</button>
          </div>
        </div>

        ${filtered.length === 0 ? `
          <div class="p-12 text-center rounded-2xl bg-surface-container border border-outline-variant/30 text-on-surface-variant">
            <span class="material-symbols-outlined text-[48px] text-outline mb-2">search_off</span>
            <h3 class="font-headline-sm uppercase text-on-surface">No Hardware Matches Found</h3>
            <p class="font-body-sm mt-1">Try modifying your search or filtration criteria.</p>
          </div>
        ` : `
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="catalogDynamicGrid">
            ${filtered.map(item => `
              <div class="group flex flex-col justify-between rounded-xl bg-surface-container p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(139,92,246,0.30)] shadow-sm">
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-primary uppercase font-bold">${item.tier || item.category}</span>
                    <span class="px-2 py-0.5 rounded-full ${item.stock > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-error/10 text-error'} font-label-sm font-semibold flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full ${item.stock > 0 ? 'bg-emerald-400' : 'bg-error'}"></span>
                      ${item.stock > 0 ? `${item.stock} In Stock` : 'Out of Stock'}
                    </span>
                  </div>
                  <div class="w-full h-44 rounded-lg bg-surface-container-lowest overflow-hidden mb-4 flex items-center justify-center p-2 relative">
                    <img class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" src="${item.image_url}" alt="${item.name}"/>
                  </div>
                  <h3 class="font-headline-sm text-sm text-on-surface font-bold leading-snug">${item.name}</h3>
                  <p class="font-body-sm text-xs text-on-surface-variant mt-1 line-clamp-2">${item.short_desc}</p>
                </div>
                <div class="mt-6 pt-4 flex items-center justify-between border-t border-surface-container-highest">
                  <div class="flex flex-col">
                    <span class="font-label-sm text-outline uppercase text-[10px]">Price</span>
                    <span class="font-headline-sm text-sm font-mono text-on-surface font-bold">$${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <button onclick="UPC_CLIENT.addToCart('${item.id}')" ${item.stock <= 0 ? 'disabled' : ''} class="px-3.5 py-1.5 rounded-lg ${item.stock > 0 ? 'bg-surface-container-highest hover:bg-primary hover:text-on-primary' : 'bg-surface-container-high opacity-40 cursor-not-allowed'} text-on-surface font-label-md text-xs uppercase font-bold transition-all shadow-sm">
                    ${item.stock > 0 ? 'Add' : 'Sold Out'}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  },

  filterComponentCategory(cat) {
    const cards = document.querySelectorAll('#catalogDynamicGrid > div');
    const buttons = document.querySelectorAll('.cat-pill');
    buttons.forEach(b => {
      b.classList.remove('bg-primary-container', 'text-on-primary');
      b.classList.add('bg-surface-container-high', 'text-on-surface');
    });
    if (event) {
      event.currentTarget.classList.add('bg-primary-container', 'text-on-primary');
      event.currentTarget.classList.remove('bg-surface-container-high');
    }

    const items = cat === 'all' ? this.products : this.products.filter(p => p.category === cat);
    this.renderFilteredCatalogCards(items);
  },

  renderFilteredCatalogCards(items) {
    const grid = document.getElementById('catalogDynamicGrid');
    if (!grid) return;
    grid.innerHTML = items.map(item => `
      <div class="group flex flex-col justify-between rounded-xl bg-surface-container p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(139,92,246,0.30)] shadow-sm">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-primary uppercase font-bold">${item.tier || item.category}</span>
            <span class="px-2 py-0.5 rounded-full ${item.stock > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-error/10 text-error'} font-label-sm font-semibold flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full ${item.stock > 0 ? 'bg-emerald-400' : 'bg-error'}"></span>
              ${item.stock > 0 ? `${item.stock} In Stock` : 'Out of Stock'}
            </span>
          </div>
          <div class="w-full h-44 rounded-lg bg-surface-container-lowest overflow-hidden mb-4 flex items-center justify-center p-2 relative">
            <img class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" src="${item.image_url}" alt="${item.name}"/>
          </div>
          <h3 class="font-headline-sm text-sm text-on-surface font-bold leading-snug">${item.name}</h3>
          <p class="font-body-sm text-xs text-on-surface-variant mt-1 line-clamp-2">${item.short_desc}</p>
        </div>
        <div class="mt-6 pt-4 flex items-center justify-between border-t border-surface-container-highest">
          <div class="flex flex-col">
            <span class="font-label-sm text-outline uppercase text-[10px]">Price</span>
            <span class="font-headline-sm text-sm font-mono text-on-surface font-bold">$${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <button onclick="UPC_CLIENT.addToCart('${item.id}')" ${item.stock <= 0 ? 'disabled' : ''} class="px-3.5 py-1.5 rounded-lg ${item.stock > 0 ? 'bg-surface-container-highest hover:bg-primary hover:text-on-primary' : 'bg-surface-container-high opacity-40 cursor-not-allowed'} text-on-surface font-label-md text-xs uppercase font-bold transition-all shadow-sm">
            ${item.stock > 0 ? 'Add' : 'Sold Out'}
          </button>
        </div>
      </div>
    `).join('');
  },

  renderRepairPage(container) {
    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-6 lg:px-12 py-12">
        <div class="flex flex-col gap-2 mb-8">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container text-tertiary font-mono text-xs uppercase w-max">
            <span class="material-symbols-outlined text-[16px]">build_circle</span> ISO 9001 Atelier Diagnostics
          </div>
          <h1 class="font-display-hero-mobile md:font-display-hero text-on-surface uppercase font-bold tracking-tight">RMA & Hardware Care Portal</h1>
          <p class="font-body-lg text-on-surface-variant max-w-3xl">
            Live tracking for nitrogen pressure sweeps, ultrasonic block decontamination, silicon binning, and warranty service.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <!-- Left: Track Existing Ticket (6 cols) -->
          <div class="lg:col-span-6 p-6 sm:p-8 rounded-2xl bg-surface-container border border-outline-variant/30 shadow-xl">
            <h3 class="font-headline-sm text-on-surface font-bold uppercase mb-2 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">search</span> Track Existing Ticket
            </h3>
            <p class="font-body-sm text-on-surface-variant mb-6">Enter your UPC ticket identifier (e.g. UPC-92841) to inspect bench progress.</p>

            <form onsubmit="UPC_CLIENT.handleDedicatedTicketSearch(event)" class="space-y-4">
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">fingerprint</span>
                <input id="dedicatedTicketInput" value="UPC-92841" class="w-full bg-surface-container-lowest pl-11 pr-4 py-3 rounded-lg font-mono text-sm text-on-surface placeholder:text-outline focus:outline-none border border-outline-variant/40" placeholder="UPC-XXXXX..."/>
              </div>
              <button type="submit" class="w-full py-3 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md uppercase font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                Query Telemetry
              </button>
            </form>

            <div id="dedicatedTicketResult" class="mt-6 rounded-xl bg-surface-container-low border border-outline-variant/20 p-4">
              <span class="text-xs text-outline font-mono">Submit ticket above to view active lab bench status.</span>
            </div>
          </div>

          <!-- Right: Book New Repair / RMA (6 cols) -->
          <div class="lg:col-span-6 p-6 sm:p-8 rounded-2xl bg-surface-container border border-outline-variant/30 shadow-xl">
            <h3 class="font-headline-sm text-on-surface font-bold uppercase mb-2 flex items-center gap-2">
              <span class="material-symbols-outlined text-tertiary">add_circle</span> Dispatch RMA Ticket
            </h3>
            <p class="font-body-sm text-on-surface-variant mb-6">Generate an authenticated ticket and pre-paid white-glove transit label.</p>

            <form onsubmit="UPC_CLIENT.handleCreateTicket(event)" class="space-y-4">
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">Customer Full Name</label>
                <input id="rmaCustomerName" required value="${this.currentUser ? this.currentUser.name : ''}" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block font-label-sm uppercase text-outline mb-1">Email Address</label>
                  <input id="rmaEmail" type="email" required value="${this.currentUser ? this.currentUser.email : ''}" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
                </div>
                <div>
                  <label class="block font-label-sm uppercase text-outline mb-1">Phone</label>
                  <input id="rmaPhone" type="tel" placeholder="+1 (555) 000-0000" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block font-label-sm uppercase text-outline mb-1">Hardware / Rig Model</label>
                  <input id="rmaModel" required placeholder="e.g. Apex Horizon RTX 4090" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
                </div>
                <div>
                  <label class="block font-label-sm uppercase text-outline mb-1">Serial Number (Optional)</label>
                  <input id="rmaSerial" placeholder="UPC-TITAN-XXXX" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
                </div>
              </div>
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">Diagnostic Issue Description</label>
                <textarea id="rmaIssue" rows="3" required placeholder="Describe symptoms, thermal alarms, leak status, or desired overhaul..." class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"></textarea>
              </div>
              <button type="submit" class="w-full py-3 rounded-lg bg-surface-container-highest hover:bg-tertiary-container text-on-surface hover:text-on-tertiary font-label-md uppercase font-bold tracking-wider transition-all">
                Submit Hardware for Laboratory Intake
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    // auto trigger initial lookup for the sample
    this.queryDedicatedTicket('UPC-92841');
  },

  async handleDedicatedTicketSearch(e) {
    e.preventDefault();
    const val = document.getElementById('dedicatedTicketInput').value.trim();
    if (val) this.queryDedicatedTicket(val);
  },

  async queryDedicatedTicket(ticketId) {
    const box = document.getElementById('dedicatedTicketResult');
    if (!box) return;
    box.innerHTML = `<span class="text-xs text-primary font-mono animate-pulse">Querying database for ${ticketId}...</span>`;

    try {
      const res = await fetch(`/api/repairs/track/${encodeURIComponent(ticketId)}`);
      const data = await res.json();
      if (!res.ok || !data.found) {
        box.innerHTML = `<span class="text-xs text-error font-mono">${data.error}</span>`;
        return;
      }
      const t = data.ticket;
      box.innerHTML = `
        <div class="space-y-3 font-mono text-xs">
          <div class="flex items-center justify-between pb-2 border-b border-surface-container-highest">
            <span class="text-primary font-bold">TICKET #${t.id}</span>
            <span class="px-2 py-0.5 rounded bg-tertiary/20 text-tertiary font-bold">PHASE ${t.phase} / 5</span>
          </div>
          <div><span class="text-outline">RIG:</span> <span class="text-on-surface">${t.hardware_model}</span></div>
          <div><span class="text-outline">CURRENT OPERATION:</span> <span class="text-tertiary font-bold">${t.phase_name}</span></div>
          <div><span class="text-outline">TECHNICIAN REMARKS:</span> <p class="text-on-surface-variant italic mt-1">"${t.technician_notes}"</p></div>
          <div class="pt-2">
            <div class="flex justify-between mb-1"><span>BENCH PROGRESS</span><span class="text-tertiary font-bold">${t.progress_percent}%</span></div>
            <div class="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
              <div class="h-full bg-gradient-to-r from-primary to-tertiary" style="width: ${t.progress_percent}%"></div>
            </div>
          </div>
          <div class="pt-1 text-on-surface"><span class="text-outline">DISPATCH ETA:</span> ${t.estimated_dispatch || 'Pending Test Cycle'}</div>
        </div>
      `;
    } catch (e) {
      box.innerHTML = `<span class="text-xs text-error font-mono">Failed to load repair record.</span>`;
    }
  },

  async handleCreateTicket(e) {
    e.preventDefault();
    const payload = {
      customer_name: document.getElementById('rmaCustomerName').value,
      customer_email: document.getElementById('rmaEmail').value,
      customer_phone: document.getElementById('rmaPhone').value,
      hardware_model: document.getElementById('rmaModel').value,
      serial_number: document.getElementById('rmaSerial').value,
      issue_description: document.getElementById('rmaIssue').value
    };

    try {
      const res = await fetch('/api/repairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to submit RMA ticket.');
        return;
      }
      alert(`RMA Ticket #${data.ticketId} successfully registered in UltraPC database!`);
      const input = document.getElementById('dedicatedTicketInput');
      if (input) input.value = data.ticketId;
      this.queryDedicatedTicket(data.ticketId);
    } catch (err) {
      alert('Network error submitting repair ticket.');
    }
  },

  async renderShoppingCartPage(container) {
    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="max-w-4xl mx-auto px-6 py-20 text-center">
          <div class="w-20 h-20 rounded-full bg-surface-container mx-auto flex items-center justify-center text-outline mb-4">
            <span class="material-symbols-outlined text-[36px]">shopping_bag</span>
          </div>
          <h2 class="font-headline-lg uppercase text-on-surface font-bold">Your Atelier Cart is Empty</h2>
          <p class="font-body-md text-on-surface-variant max-w-md mx-auto mt-2 mb-8">
            You haven't added any flagship custom rigs, components, or liquid cooling gear to your manifest yet.
          </p>
          <button onclick="UPC_CLIENT.navigateTo('pc-components')" class="px-8 py-3.5 rounded-lg bg-primary text-on-primary font-label-md uppercase font-bold shadow-[0_0_20px_rgba(139,92,246,0.3)]">
            Explore Hardware Catalog
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="max-w-5xl mx-auto px-6 py-12">
        <h1 class="font-display-hero-mobile text-on-surface uppercase font-bold mb-8">Hardware Manifest / Cart</h1>
        <div id="cartServerValidating" class="p-8 text-center text-on-surface-variant font-mono">
          <span class="inline-block w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin mr-2"></span>
          Verifying real-time silicon pricing and warehouse stock...
        </div>
      </div>
    `;

    try {
      const res = await fetch('/api/cart/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: this.cart })
      });
      const data = await res.json();

      container.innerHTML = `
        <div class="max-w-5xl mx-auto px-6 py-12">
          <div class="flex items-center justify-between mb-8">
            <h1 class="font-display-hero-mobile text-on-surface uppercase font-bold">Hardware Manifest</h1>
            <button onclick="UPC_CLIENT.clearCart()" class="text-xs text-error font-mono hover:underline">Clear Manifest</button>
          </div>

          ${!data.valid && data.errors && data.errors.length > 0 ? `
            <div class="mb-6 p-4 rounded-xl bg-error/10 border border-error/40 text-error text-xs font-mono">
              <div class="font-bold mb-1 flex items-center gap-1"><span class="material-symbols-outlined text-sm">warning</span> INVENTORY NOTICE</div>
              ${data.errors.map(e => `<div>• ${e}</div>`).join('')}
            </div>
          ` : ''}

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div class="lg:col-span-8 space-y-4">
              ${data.items.map(item => `
                <div class="p-4 rounded-xl bg-surface-container flex flex-col sm:flex-row items-center justify-between gap-4 border border-outline-variant/20 shadow-sm">
                  <div class="flex items-center gap-4 w-full sm:w-auto">
                    <img src="${item.image_url}" class="w-16 h-16 rounded-lg object-contain bg-surface-container-lowest p-1" alt="${item.name}"/>
                    <div>
                      <h4 class="font-headline-sm text-sm text-on-surface font-bold">${item.name}</h4>
                      <span class="font-mono text-xs text-outline">$${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })} each</span>
                      ${item.config_details ? `<div class="text-[11px] text-tertiary font-mono">Custom Configured Atelier Build</div>` : ''}
                    </div>
                  </div>
                  <div class="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                    <div class="flex items-center gap-2 bg-surface-container-lowest px-2 py-1 rounded-lg">
                      <button onclick="UPC_CLIENT.updateCartQty('${item.id}', ${item.quantity - 1})" class="text-outline hover:text-on-surface font-bold px-2">-</button>
                      <span class="font-mono text-xs text-on-surface font-bold">${item.quantity}</span>
                      <button onclick="UPC_CLIENT.updateCartQty('${item.id}', ${item.quantity + 1})" class="text-outline hover:text-on-surface font-bold px-2">+</button>
                    </div>
                    <span class="font-mono text-sm text-primary font-bold min-w-[80px] text-right">$${item.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <button onclick="UPC_CLIENT.removeFromCart('${item.id}')" class="text-outline hover:text-error transition-colors">
                      <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="lg:col-span-4 p-6 rounded-2xl bg-surface-container border border-outline-variant/30 shadow-xl space-y-4">
              <h3 class="font-headline-sm text-on-surface font-bold uppercase">Order Summary</h3>
              <div class="space-y-2 py-3 border-y border-surface-container-highest font-mono text-xs text-on-surface-variant">
                <div class="flex justify-between"><span>SUBTOTAL</span><span class="text-on-surface">$${data.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                <div class="flex justify-between"><span>EST. TAX (8.25%)</span><span class="text-on-surface">$${data.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                <div class="flex justify-between"><span>SHIPPING</span><span class="${data.shipping === 0 ? 'text-emerald-400 font-bold' : 'text-on-surface'}">${data.shipping === 0 ? 'FREE OVERNIGHT' : '$' + data.shipping.toFixed(2)}</span></div>
                <div class="flex justify-between text-base text-primary font-bold pt-2 border-t border-surface-container-highest">
                  <span>TOTAL</span>
                  <span>$${data.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <button onclick="UPC_CLIENT.navigateTo('checkout')" class="w-full py-3.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md uppercase font-bold tracking-wider shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all">
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="p-8 text-center text-error">Failed to validate cart with server.</div>`;
    }
  },

  renderCheckoutPage(container) {
    if (this.cart.length === 0) {
      this.navigateTo('shopping-cart');
      return;
    }

    container.innerHTML = `
      <div class="max-w-4xl mx-auto px-6 py-12">
        <h1 class="font-display-hero-mobile text-on-surface uppercase font-bold mb-8">Secure Hardware Checkout</h1>
        <form onsubmit="UPC_CLIENT.handlePlaceOrder(event)" class="space-y-6">
          <div class="p-6 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4">
            <h3 class="font-headline-sm text-on-surface font-bold uppercase">1. Client & Dispatch Destination</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">Recipient Name</label>
                <input id="checkoutName" required value="${this.currentUser ? this.currentUser.name : ''}" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
              </div>
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">Contact Email</label>
                <input id="checkoutEmail" type="email" required value="${this.currentUser ? this.currentUser.email : ''}" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
              </div>
            </div>
            <div>
              <label class="block font-label-sm uppercase text-outline mb-1">Street Address</label>
              <input id="checkoutAddress" required placeholder="123 Tech Parkway, Suite 100" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">City</label>
                <input id="checkoutCity" required placeholder="San Francisco" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
              </div>
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">State</label>
                <input id="checkoutState" required placeholder="CA" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
              </div>
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">Postal Code</label>
                <input id="checkoutZip" required placeholder="94107" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
              </div>
            </div>
          </div>

          <div class="p-6 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4">
            <h3 class="font-headline-sm text-on-surface font-bold uppercase">2. Payment Verification</h3>
            <p class="font-body-sm text-on-surface-variant">UltraPC uses server-side encrypted simulated payment gateways for authorized enterprise test transactions.</p>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 p-3 rounded-lg bg-surface-container-low border border-primary/40 cursor-pointer">
                <input type="radio" name="paymentMethod" value="Credit Card (Visa/Mastercard)" checked/>
                <span class="font-mono text-xs text-on-surface">Credit Card (Stripe Gateway)</span>
              </label>
              <label class="flex items-center gap-2 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 cursor-pointer">
                <input type="radio" name="paymentMethod" value="Affirm 0% APR Financing"/>
                <span class="font-mono text-xs text-tertiary">Affirm 0% APR Financing</span>
              </label>
            </div>
          </div>

          <button type="submit" id="submitOrderBtn" class="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-secondary text-on-primary font-label-lg uppercase tracking-wider font-bold shadow-[0_0_25px_rgba(139,92,246,0.4)] hover:brightness-110 transition-all">
            Authorize Payment & Dispatch Build Order
          </button>
        </form>
      </div>
    `;
  },

  async handlePlaceOrder(e) {
    e.preventDefault();
    const btn = document.getElementById('submitOrderBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="inline-block w-4 h-4 rounded-full border-2 border-on-primary border-t-transparent animate-spin mr-2"></span> Processing Order Against Real Inventory...`;
    }

    const payload = {
      customer_name: document.getElementById('checkoutName').value,
      email: document.getElementById('checkoutEmail').value,
      shipping_address: document.getElementById('checkoutAddress').value,
      shipping_city: document.getElementById('checkoutCity').value,
      shipping_state: document.getElementById('checkoutState').value,
      shipping_zip: document.getElementById('checkoutZip').value,
      shipping_country: 'United States',
      payment_method: document.querySelector('input[name="paymentMethod"]:checked').value,
      items: this.cart
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to place order.');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Authorize Payment & Dispatch Build Order';
        }
        return;
      }

      // Empty cart on confirmed order
      this.cart = [];
      this.saveCart();
      await this.fetchProducts(); // refresh stock numbers

      // Render Order Confirmation
      const container = document.getElementById('appContentContainer');
      container.innerHTML = `
        <div class="max-w-2xl mx-auto px-6 py-16 text-center">
          <div class="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-6">
            <span class="material-symbols-outlined text-[42px]">verified</span>
          </div>
          <span class="px-3 py-1 rounded-full bg-surface-container text-tertiary font-mono text-xs uppercase">Order Authenticated</span>
          <h1 class="font-display-hero-mobile text-on-surface uppercase font-bold mt-2">Order Confirmed!</h1>
          <p class="font-body-md text-on-surface-variant mt-2 mb-6">
            Thank you for your order. Your rig has entered the UltraPC Atelier queue for precision assembly and 48-hour thermal load testing.
          </p>

          <div class="p-6 rounded-xl bg-surface-container border border-outline-variant/30 text-left font-mono text-xs space-y-2 mb-8">
            <div class="flex justify-between"><span class="text-outline">ORDER NUMBER:</span><span class="text-primary font-bold">${data.orderId}</span></div>
            <div class="flex justify-between"><span class="text-outline">TOTAL PAID:</span><span class="text-on-surface font-bold">$${data.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
            <div class="flex justify-between"><span class="text-outline">ORDER STATUS:</span><span class="text-emerald-400 font-bold uppercase">${data.order_status}</span></div>
            <div class="flex justify-between"><span class="text-outline">TRACKING ID:</span><span class="text-tertiary font-bold">${data.trackingNumber}</span></div>
          </div>

          <div class="flex gap-4 justify-center">
            <button onclick="UPC_CLIENT.navigateTo('home')" class="px-6 py-3 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-md uppercase font-semibold">
              Return Home
            </button>
            <button onclick="UPC_CLIENT.navigateTo('account-overview')" class="px-6 py-3 rounded-lg bg-primary text-on-primary font-label-md uppercase font-bold">
              View Order in Profile
            </button>
          </div>
        </div>
      `;
    } catch (err) {
      alert('Network error while placing order.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Authorize Payment & Dispatch Build Order';
      }
    }
  },

  async renderAccountPage(container) {
    if (!this.currentUser) {
      // Render Login / Register tabs
      container.innerHTML = `
        <div class="max-w-md mx-auto px-6 py-16">
          <div class="p-8 rounded-2xl bg-surface-container border border-outline-variant/30 shadow-2xl">
            <div class="flex items-center justify-center gap-4 mb-6 border-b border-surface-container-highest pb-4">
              <button id="authTabLogin" onclick="UPC_CLIENT.switchAuthTab('login')" class="font-headline-sm text-sm uppercase font-bold text-primary pb-1 border-b-2 border-primary">Sign In</button>
              <button id="authTabRegister" onclick="UPC_CLIENT.switchAuthTab('register')" class="font-headline-sm text-sm uppercase font-bold text-outline pb-1">Register</button>
            </div>

            <!-- Login Form -->
            <form id="loginForm" onsubmit="UPC_CLIENT.handleLogin(event)" class="space-y-4">
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">Email Address</label>
                <input id="loginEmail" type="email" required placeholder="pilot@domain.com" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
              </div>
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">Password</label>
                <input id="loginPassword" type="password" required placeholder="••••••••" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
              </div>
              <button type="submit" class="w-full py-3 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md uppercase font-bold transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                Authenticate
              </button>
              <div class="p-3 rounded bg-surface-container-low text-xs text-outline font-mono">
                Admin Demo: <span class="text-primary font-bold">admin@ultrapc.com</span> / <span class="text-primary font-bold">AdminPass2025!</span>
              </div>
            </form>

            <!-- Register Form (Hidden by default) -->
            <form id="registerForm" onsubmit="UPC_CLIENT.handleRegister(event)" class="space-y-4 hidden">
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">Full Name</label>
                <input id="regName" required placeholder="Alex Mercer" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
              </div>
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">Email Address</label>
                <input id="regEmail" type="email" required placeholder="alex@domain.com" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
              </div>
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">Password (Min 8 Characters)</label>
                <input id="regPassword" type="password" minlength="8" required placeholder="••••••••" class="w-full bg-surface-container-lowest px-4 py-2.5 rounded-lg text-sm text-on-surface border border-outline-variant/40 focus:outline-none"/>
              </div>
              <button type="submit" class="w-full py-3 rounded-lg bg-tertiary-container hover:bg-tertiary text-on-tertiary-container hover:text-on-tertiary font-label-md uppercase font-bold transition-all">
                Create Atelier Account
              </button>
            </form>
          </div>
        </div>
      `;
      return;
    }

    // Render Authenticated Account Dashboard
    container.innerHTML = `
      <div class="max-w-6xl mx-auto px-6 py-12">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <span class="px-3 py-1 rounded-full bg-primary/20 text-primary font-mono text-xs uppercase font-bold">${this.currentUser.role} Account</span>
            <h1 class="font-display-hero-mobile text-on-surface uppercase font-bold mt-2">Welcome, ${this.currentUser.name}</h1>
            <span class="text-on-surface-variant font-mono text-xs">${this.currentUser.email}</span>
          </div>
          <div class="flex items-center gap-3">
            ${this.currentUser.role === 'admin' ? `
              <button onclick="UPC_CLIENT.navigateTo('admin-dashboard')" class="px-4 py-2 rounded-lg bg-surface-container-high hover:bg-primary hover:text-on-primary text-on-surface font-label-md uppercase font-bold transition-all">
                Admin Panel
              </button>
            ` : ''}
            <button onclick="UPC_CLIENT.handleLogout()" class="px-4 py-2 rounded-lg bg-error/20 hover:bg-error text-error hover:text-on-error font-label-md uppercase font-bold transition-all">
              Log Out
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <!-- Left: User Profile & Shipping (5 cols) -->
          <div class="lg:col-span-5 p-6 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4">
            <h3 class="font-headline-sm text-on-surface font-bold uppercase">Shipping Protocol & Profile</h3>
            <form onsubmit="UPC_CLIENT.handleUpdateProfile(event)" class="space-y-3 font-body-sm">
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">Full Name</label>
                <input id="profName" value="${this.currentUser.name}" class="w-full bg-surface-container-lowest px-4 py-2 rounded-lg text-sm text-on-surface border border-outline-variant/40"/>
              </div>
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">Phone Number</label>
                <input id="profPhone" value="${this.currentUser.profile?.phone || ''}" placeholder="+1 (555) 012-3456" class="w-full bg-surface-container-lowest px-4 py-2 rounded-lg text-sm text-on-surface border border-outline-variant/40"/>
              </div>
              <div>
                <label class="block font-label-sm uppercase text-outline mb-1">Shipping Address</label>
                <input id="profAddress" value="${this.currentUser.profile?.shipping_address || ''}" placeholder="Street address" class="w-full bg-surface-container-lowest px-4 py-2 rounded-lg text-sm text-on-surface border border-outline-variant/40"/>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <input id="profCity" value="${this.currentUser.profile?.shipping_city || ''}" placeholder="City" class="bg-surface-container-lowest px-3 py-2 rounded-lg text-sm text-on-surface border border-outline-variant/40"/>
                <input id="profState" value="${this.currentUser.profile?.shipping_state || ''}" placeholder="State" class="bg-surface-container-lowest px-3 py-2 rounded-lg text-sm text-on-surface border border-outline-variant/40"/>
                <input id="profZip" value="${this.currentUser.profile?.shipping_zip || ''}" placeholder="Zip" class="bg-surface-container-lowest px-3 py-2 rounded-lg text-sm text-on-surface border border-outline-variant/40"/>
              </div>
              <button type="submit" class="w-full py-2.5 rounded-lg bg-surface-container-highest hover:bg-primary hover:text-on-primary text-on-surface font-label-md uppercase font-bold transition-all mt-2">
                Update Record
              </button>
            </form>
          </div>

          <!-- Right: Order History (7 cols) -->
          <div class="lg:col-span-7 p-6 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4">
            <h3 class="font-headline-sm text-on-surface font-bold uppercase">Order History</h3>
            <div id="userOrdersList" class="space-y-3 font-mono text-xs">
              <span class="text-outline">Loading your authenticated orders from database...</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.fetchUserOrders();
  },

  async fetchUserOrders() {
    const list = document.getElementById('userOrdersList');
    if (!list) return;

    try {
      const res = await fetch('/api/user/orders');
      const data = await res.json();
      if (!data.orders || data.orders.length === 0) {
        list.innerHTML = `<span class="text-outline">No orders found on your account.</span>`;
        return;
      }
      list.innerHTML = data.orders.map(o => `
        <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-primary font-bold">${o.id}</span>
              <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase">${o.order_status}</span>
            </div>
            <div class="text-outline mt-1">${new Date(o.created_at).toLocaleDateString()} • Tracking: ${o.tracking_number}</div>
          </div>
          <span class="text-on-surface font-bold text-sm">$${o.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      `).join('');
    } catch (e) {
      list.innerHTML = `<span class="text-error">Error loading orders.</span>`;
    }
  },

  switchAuthTab(mode) {
    const tabLogin = document.getElementById('authTabLogin');
    const tabRegister = document.getElementById('authTabRegister');
    const formLogin = document.getElementById('loginForm');
    const formRegister = document.getElementById('registerForm');

    if (mode === 'login') {
      tabLogin.className = "font-headline-sm text-sm uppercase font-bold text-primary pb-1 border-b-2 border-primary";
      tabRegister.className = "font-headline-sm text-sm uppercase font-bold text-outline pb-1";
      formLogin.classList.remove('hidden');
      formRegister.classList.add('hidden');
    } else {
      tabRegister.className = "font-headline-sm text-sm uppercase font-bold text-primary pb-1 border-b-2 border-primary";
      tabLogin.className = "font-headline-sm text-sm uppercase font-bold text-outline pb-1";
      formRegister.classList.remove('hidden');
      formLogin.classList.add('hidden');
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Authentication failed.');
        return;
      }
      await this.checkAuth();
      this.navigateTo('account-overview');
    } catch (err) {
      alert('Network error logging in.');
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('regName').value,
      email: document.getElementById('regEmail').value,
      password: document.getElementById('regPassword').value
    };

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Registration failed.');
        return;
      }
      await this.checkAuth();
      this.navigateTo('account-overview');
    } catch (err) {
      alert('Network error creating account.');
    }
  },

  async handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    this.currentUser = null;
    this.renderUserBadge();
    this.navigateTo('home');
  },

  async handleUpdateProfile(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('profName').value,
      phone: document.getElementById('profPhone').value,
      shipping_address: document.getElementById('profAddress').value,
      shipping_city: document.getElementById('profCity').value,
      shipping_state: document.getElementById('profState').value,
      shipping_zip: document.getElementById('profZip').value
    };

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Update failed');
        return;
      }
      alert('Profile updated successfully.');
      await this.checkAuth();
    } catch (e) {
      alert('Network error updating profile.');
    }
  },

  async renderAdminPage(container) {
    if (!this.currentUser || this.currentUser.role !== 'admin') {
      container.innerHTML = `
        <div class="max-w-md mx-auto px-6 py-20 text-center text-error">
          <span class="material-symbols-outlined text-[48px] mb-2">lock</span>
          <h2 class="font-headline-md uppercase font-bold">Access Denied</h2>
          <p class="font-body-sm text-on-surface-variant mt-2 mb-6">Administrator privileges required to access Atelier telemetry.</p>
          <button onclick="UPC_CLIENT.navigateTo('account-overview')" class="px-6 py-2.5 rounded-lg bg-surface-container font-mono text-xs uppercase">Sign in as Admin</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-6 lg:px-12 py-12">
        <h1 class="font-display-hero-mobile text-on-surface uppercase font-bold mb-8">UltraPC Atelier Control Matrix</h1>
        <div id="adminMatrixContent" class="space-y-8 font-mono text-xs">
          <span class="text-primary animate-pulse">Calculating authoritative database statistics...</span>
        </div>
      </div>
    `;

    try {
      const res = await fetch('/api/admin/stats');
      const stats = await res.json();

      const matrix = document.getElementById('adminMatrixContent');
      if (!matrix) return;

      matrix.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="p-5 rounded-xl bg-surface-container border border-outline-variant/30">
            <span class="text-outline uppercase">Total Realized Revenue</span>
            <div class="text-2xl text-primary font-bold mt-2">$${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="p-5 rounded-xl bg-surface-container border border-outline-variant/30">
            <span class="text-outline uppercase">Total Orders Persisted</span>
            <div class="text-2xl text-on-surface font-bold mt-2">${stats.totalOrders}</div>
          </div>
          <div class="p-5 rounded-xl bg-surface-container border border-outline-variant/30">
            <span class="text-outline uppercase">Active Bench Repairs</span>
            <div class="text-2xl text-tertiary font-bold mt-2">${stats.activeRepairs}</div>
          </div>
          <div class="p-5 rounded-xl bg-surface-container border border-outline-variant/30">
            <span class="text-outline uppercase">Low Stock Alerts</span>
            <div class="text-2xl ${stats.lowStockCount > 0 ? 'text-amber-400' : 'text-emerald-400'} font-bold mt-2">${stats.lowStockCount} Parts</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <!-- Recent Orders Table (7 cols) -->
          <div class="lg:col-span-7 p-6 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4">
            <h3 class="font-headline-sm text-sm text-on-surface font-bold uppercase">Recent Client Orders</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="text-outline border-b border-surface-container-highest pb-2">
                    <th class="py-2">Order ID</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-surface-container-highest">
                  ${stats.recentOrders.map(o => `
                    <tr>
                      <td class="py-2.5 text-primary font-bold">${o.id}</td>
                      <td class="text-on-surface">${o.customer_name}</td>
                      <td class="text-on-surface font-bold">$${o.total.toFixed(2)}</td>
                      <td><span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase">${o.order_status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Active Repairs Management (5 cols) -->
          <div class="lg:col-span-5 p-6 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4">
            <h3 class="font-headline-sm text-sm text-on-surface font-bold uppercase">Active Bench Tickets</h3>
            <div class="space-y-3">
              ${stats.repairList.map(r => `
                <div class="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col gap-1">
                  <div class="flex items-center justify-between">
                    <span class="text-tertiary font-bold">${r.id}</span>
                    <span class="text-outline">Phase ${r.phase} / 5 (${r.progress_percent}%)</span>
                  </div>
                  <div class="text-on-surface font-semibold">${r.customer_name} - ${r.hardware_model}</div>
                  <div class="text-outline italic">"${r.phase_name}"</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      // fallback
    }
  },

  // ---------------- CART HELPERS ----------------

  addToCart(productId) {
    const existing = this.cart.find(i => i.id === productId && !i.config_details);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      this.cart.push({ id: productId, quantity: 1 });
    }
    this.saveCart();

    // Visual feedback
    alert('Hardware unit added to cart manifest.');
  },

  updateCartQty(productId, newQty) {
    if (newQty <= 0) {
      this.removeFromCart(productId);
      return;
    }
    const item = this.cart.find(i => i.id === productId);
    if (item) {
      item.quantity = newQty;
      this.saveCart();
      const container = document.getElementById('appContentContainer');
      if (this.currentRoute === 'shopping-cart') {
        this.renderShoppingCartPage(container);
      }
    }
  },

  removeFromCart(productId) {
    this.cart = this.cart.filter(i => i.id !== productId);
    this.saveCart();
    const container = document.getElementById('appContentContainer');
    if (this.currentRoute === 'shopping-cart') {
      this.renderShoppingCartPage(container);
    }
  },

  clearCart() {
    this.cart = [];
    this.saveCart();
    const container = document.getElementById('appContentContainer');
    if (this.currentRoute === 'shopping-cart') {
      this.renderShoppingCartPage(container);
    }
  }
};

window.UPC_CLIENT = UPC_CLIENT;
document.addEventListener('DOMContentLoaded', () => UPC_CLIENT.init());
