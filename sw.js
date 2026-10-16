// Offline support for Roseln Village (index.html) and its map (map.html).
// Bump VERSION whenever you upload a new build so phones pick up the change.
const VERSION = 'roseln-village-v1';
const CORE = ['./', 'index.html', 'familien.html', 'map.html', 'karte.html', 'data/de_karte.json', 'arms.svg', 'manifest-de.webmanifest', 'data/records_de.json', 'data/de.json', 'vorfahren.html', 'manifest.webmanifest', 'manifest-map.webmanifest', 'roseln1869.png',
  'data/people.json', 'data/records.json',
  'sat_village.jpg', 'sat_valley.jpg', 'sat_mures.jpg', 'sat_ontario.jpg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'photos/anna_hartel_1859.jpg', 'photos/michael_thoma_1838.jpg', 'photos/johann_balthes_1884.jpg',
  'photos/mathilde_balthes_1926.jpg', 'photos/sophia_hermann_1850.jpg', 'photos/sofia_thome_1890.jpg',
  'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js'];
const TILE_CACHE = 'roseln-village-tiles', TILE_LIMIT = 600;
const PAGES = ['map.html', 'families.html', 'familien.html', 'karte.html', 'vorfahren.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('roseln-village') && k !== VERSION && k !== TILE_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
async function trimTiles() {
  const c = await caches.open(TILE_CACHE), keys = await c.keys();
  for (let i = 0; i < keys.length - TILE_LIMIT; i++) await c.delete(keys[i]);
}
// network first, falling back to the copy cached under `key`
function netFirst(req, key) {
  return fetch(req).then(r => {
    if (r && r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(key, copy)); }
    return r;
  }).catch(() => caches.match(key).then(h => h || caches.match('./')));
}
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Satellite tiles: network first, fall back to the tiles already seen.
  if (url.hostname === 'server.arcgisonline.com') {
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone(); caches.open(TILE_CACHE).then(c => c.put(e.request, copy)).then(trimTiles); return r;
    }).catch(() => caches.match(e.request)));
    return;
  }
  // Pages: network first so a new upload shows up straight away; each page cached under its own name.
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    const page = PAGES.find(p => url.pathname.endsWith(p)) || 'index.html';
    e.respondWith(netFirst(e.request, page));
    return;
  }
  // The shared family data: network first too, so corrections reach both apps at once.
  if (url.origin === location.origin && url.pathname.includes('/data/')) {
    e.respondWith(netFirst(e.request, 'data/' + url.pathname.split('/data/').pop()));
    return;
  }
  // Images, fonts, map library: cache first, refresh in the background.
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => {
      if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => hit);
    return hit || net;
  }));
});
