// Service worker — membuat menu tetap tampil saat sinyal jelek / offline.
//
// PENTING: setiap kali Anda mengubah index.html, css/ atau js/, naikkan VERSION
// (mis. 'bakery-v2') supaya pelanggan mendapat versi terbaru.
// Perubahan data/menu.json TIDAK perlu menaikkan versi (selalu diambil dari jaringan dulu).

const VERSION = 'bakery-v3';
const IMG_CACHE = 'bakery-images';

const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/cart.js',
  'js/whatsapp.js',
  'manifest.json',
  'data/menu.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'images/qris.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('bakery-') && k !== VERSION && k !== IMG_CACHE)
            .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.endsWith('/data/menu.json')) {
    event.respondWith(networkFirst(req));
  } else if (url.pathname.includes('/images/')) {
    event.respondWith(staleWhileRevalidate(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

// HTML, CSS, JS, ikon: cepat & bisa offline
async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
    return res;
  } catch (err) {
    if (req.mode === 'navigate') {
      const fallback = await caches.match('index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

// menu.json: harga/stok terbaru langsung muncul bila online
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

// Foto produk: tampil dari cache dulu, diperbarui di belakang layar
async function staleWhileRevalidate(req) {
  const cache = await caches.open(IMG_CACHE);
  const hit = await cache.match(req);
  const fetching = fetch(req)
    .then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
    .catch(() => null);
  return hit || (await fetching) || Response.error();
}
