const fs = require('fs');

let html = fs.readFileSync('code.html.bak', 'utf8');

// 1. Add script tag for app.js in head
html = html.replace('</head>', '<script src="/app.js" defer></script></head>');

// 2. Wrap main content with template and dynamic container
const mainMarker = '<main class="w-full pt-36 bg-surface"><div class="flex flex-col w-full">';
const mainEndMarker = '</div></main>';

const startIdx = html.indexOf(mainMarker);
const endIdx = html.lastIndexOf(mainEndMarker);

if (startIdx !== -1 && endIdx !== -1) {
  const content = html.substring(startIdx + mainMarker.length, endIdx);
  const newMain = '<main class="w-full pt-36 bg-surface"><div id="appContentContainer" class="flex flex-col w-full min-h-[70vh]"></div><template id="homeStaticTemplate">' + content + '</template></main>';
  html = html.substring(0, startIdx) + newMain + html.substring(endIdx + mainEndMarker.length);
  console.log('Main content successfully wrapped with app container and template!');
} else {
  console.error('Markers not found', startIdx, endIdx);
}

// 3. Fix header search input ID
html = html.replace(
  'placeholder="Search GPUs, custom rigs, cooling parts..." type="text"',
  'placeholder="Search GPUs, custom rigs, cooling parts..." type="text" id="globalSearchInput"'
);

// 4. Fix header account button ID
html = html.replace(
  'data-path="account-overview" href="#"><div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><span class="material-symbols-outlined text-on-primary text-[18px]">person</span></div></a>',
  'data-path="account-overview" id="accountHeaderBtn" href="#"><div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><span class="material-symbols-outlined text-on-primary text-[18px]">person</span></div></a>'
);

// 5. Fix Cart badge and cart total
html = html.replace(
  '<span class="absolute -top-2 -right-2 px-1.5 py-0.2 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm leading-none">2</span>',
  '<span id="cartCountBadge" class="absolute -top-2 -right-2 px-1.5 py-0.2 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm leading-none">0</span>'
);
html = html.replace(
  '<span class="font-label-md text-label-md text-on-surface font-mono font-bold leading-none mt-1">$4,899</span>',
  '<span id="cartHeaderTotal" class="font-label-md text-label-md text-on-surface font-mono font-bold leading-none mt-1">$0</span>'
);

// 6. Fix home ticket form
html = html.replace(
  '<form class="flex flex-col sm:flex-row gap-2" onsubmit="handleTicketTrack(event)">',
  '<form id="homeTicketForm" class="flex flex-col sm:flex-row gap-2" onsubmit="UPC_CLIENT.handleTicketTrack(event)">'
);
html = html.replace(
  'id="ticketInput"',
  'id="homeTicketInput"'
);

// 7. Fix home hero CTA buttons
html = html.replace(
  '<button class="flex items-center gap-2 px-6 py-3.5 rounded-lg bg-gradient-to-r from-primary-container to-secondary-container text-on-primary font-label-lg text-label-lg uppercase tracking-wider font-bold shadow-[0_0_20px_rgba(139,92,246,0.40)] hover:brightness-110 hover:shadow-[0_0_30px_rgba(139,92,246,0.60)] transition-all" type="button">',
  '<button onclick="UPC_CLIENT.navigateTo(\'custom-configurator\')" class="flex items-center gap-2 px-6 py-3.5 rounded-lg bg-gradient-to-r from-primary-container to-secondary-container text-on-primary font-label-lg text-label-lg uppercase tracking-wider font-bold shadow-[0_0_20px_rgba(139,92,246,0.40)] hover:brightness-110 hover:shadow-[0_0_30px_rgba(139,92,246,0.60)] transition-all" type="button">'
);
html = html.replace(
  '<button class="flex items-center gap-2 px-4 py-3.5 rounded-lg bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-md text-label-md uppercase tracking-wider font-semibold transition-colors" type="button">\n<span class="material-symbols-outlined text-[18px]">analytics</span>\n<span>Benchmarks</span>\n</button>',
  '<button onclick="document.getElementById(\'benchmarkSection\')?.scrollIntoView({behavior:\'smooth\'})" class="flex items-center gap-2 px-4 py-3.5 rounded-lg bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-md text-label-md uppercase tracking-wider font-semibold transition-colors" type="button"><span class="material-symbols-outlined text-[18px]">analytics</span><span>Benchmarks</span></button>'
);

// 8. Give benchmark section an ID
html = html.replace(
  '<section class="max-w-7xl mx-auto px-6 lg:px-12 py-12 mb-16">',
  '<section id="benchmarkSection" class="max-w-7xl mx-auto px-6 lg:px-12 py-12 mb-16">'
);

// 9. Wire static catalog "Add" buttons to real cart
html = html.replaceAll(
  '<button class="px-3.5 py-2 rounded-lg bg-surface-container-highest hover:bg-primary hover:text-on-primary text-on-surface font-label-md text-label-md uppercase font-bold transition-all shadow-sm" type="button">\n                Add\n              </button>',
  '<button onclick="UPC_CLIENT.addToCart(this.closest(\'[data-category]\')?.getAttribute(\'data-product-id\') || \'prod-gpu-rog-4090-white\')" class="px-3.5 py-2 rounded-lg bg-surface-container-highest hover:bg-primary hover:text-on-primary text-on-surface font-label-md text-label-md uppercase font-bold transition-all shadow-sm" type="button">Add</button>'
);

// Add data-product-id attributes to static home cards
html = html.replace('data-category="gpu">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-primary uppercase font-bold">GPU • AD102</span>', 'data-category="gpu" data-product-id="prod-gpu-rog-4090-white">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-primary uppercase font-bold">GPU • AD102</span>');
html = html.replace('data-category="cpu">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-tertiary uppercase font-bold">CPU • AM5</span>', 'data-category="cpu" data-product-id="prod-cpu-amd-7950x3d">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-tertiary uppercase font-bold">CPU • AM5</span>');
html = html.replace('data-category="ram">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-secondary uppercase font-bold">RAM • DDR5</span>', 'data-category="ram" data-product-id="prod-ram-gskill-trident-z5-64gb">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-secondary uppercase font-bold">RAM • DDR5</span>');
html = html.replace('data-category="cooling">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-tertiary uppercase font-bold">COOLING • DIRECT DIE</span>', 'data-category="cooling" data-product-id="prod-cool-ek-velocity2-direct-die">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-tertiary uppercase font-bold">COOLING • DIRECT DIE</span>');
html = html.replace('data-category="cpu">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-tertiary uppercase font-bold">CPU • SPECIAL ED.</span>', 'data-category="cpu" data-product-id="prod-cpu-intel-14900ks">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-tertiary uppercase font-bold">CPU • SPECIAL ED.</span>');
html = html.replace('data-category="gpu">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-primary uppercase font-bold">GPU • HYBRID AIO</span>', 'data-category="gpu" data-product-id="prod-gpu-msi-suprim-liquid-4090">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-primary uppercase font-bold">GPU • HYBRID AIO</span>');
html = html.replace('data-category="ram">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-secondary uppercase font-bold">RAM • 7200MHz</span>', 'data-category="ram" data-product-id="prod-ram-corsair-dominator-titanium-64gb">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-secondary uppercase font-bold">RAM • 7200MHz</span>');
html = html.replace('data-category="storage">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-tertiary uppercase font-bold">SSD • PCIE 4.0</span>', 'data-category="storage" data-product-id="prod-ssd-samsung-990-pro-4tb">\n<div>\n<div class="flex items-center justify-between mb-3">\n<span class="px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-tertiary uppercase font-bold">SSD • PCIE 4.0</span>');

// 10. Update newsletter form in footer
html = html.replace(
  '<div class="flex max-w-md gap-space-xs"><input class="flex-1 bg-surface-container px-3 py-2 rounded-lg font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-high" placeholder="developer@domain.com" type="email"/><button class="px-4 py-2 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md uppercase tracking-wide font-bold hover:bg-primary transition-all" type="button">Join</button></div>',
  '<form onsubmit="event.preventDefault(); const em=this.querySelector(\'input\').value; fetch(\'/api/newsletter\', {method:\'POST\', headers:{\'Content-Type\':\'application/json\'}, body:JSON.stringify({email:em})}).then(r=>r.json()).then(d=>alert(d.message||d.error));" class="flex max-w-md gap-space-xs"><input required class="flex-1 bg-surface-container px-3 py-2 rounded-lg font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-high" placeholder="developer@domain.com" type="email"/><button class="px-4 py-2 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md uppercase tracking-wide font-bold hover:bg-primary transition-all" type="submit">Join</button></form>'
);

fs.writeFileSync('public/index.html', html);
fs.writeFileSync('code.html', html);
console.log('Successfully wrote public/index.html and code.html!');
