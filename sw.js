// Service Worker PWA: acelera la carga y permite abrir la app sin conexión.
// Nunca intercepta peticiones a Supabase ni a APIs externas.
const CACHE = 'boda-fp-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/ref_vestimenta_damas_caballeros.jpg',
  './assets/ref_traje_novio.jpg',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './js/app.js',
  './js/config.js',
  './js/db.js',
  './js/icons.js',
  './js/pdf.js',
  './js/receipts.js',
  './js/ui.js',
  './js/updater.js',
  './js/vendor/html2pdf.bundle.min.js',
  './js/data/seed.js',
  './js/modules/registry.js',
  './js/modules/panel.js',
  './js/modules/principios.js',
  './js/modules/tareas.js',
  './js/modules/invitados.js',
  './js/modules/mesas.js',
  './js/modules/presupuesto.js',
  './js/modules/proveedores.js',
  './js/modules/equipo.js',
  './js/modules/web.js',
  './boda/index.html',
  './boda/boda.css',
  './boda/boda.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Nunca cachear Supabase ni CDNs aquí
  if (url.pathname.endsWith('/version.json') || url.pathname.includes('/downloads/')) return; // Nunca cachear manifest de versión ni APK

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
