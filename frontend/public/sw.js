/**
 * LinguaLearn Service Worker v3
 * FIX: Removed skipWaiting() + clients.claim() — these caused instant
 *      page reloads on every SW update (the infinite refresh loop).
 * - Offline caching (app shell + dictionary cache)
 * - Network-first for API calls
 * - Cache-first for static assets
 */

const STATIC_CACHE = 'lingualearn-static-v3';
const API_CACHE    = 'lingualearn-api-v3';

const PRECACHE = [
  '/',
  '/manifest.json',
];

// Install — precache app shell
// FIX: Removed self.skipWaiting() — it forced immediate activation and
//      triggered clients.claim() → hard page reload loop.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE))
    // No skipWaiting — new SW waits until all tabs are closed
  );
});

// Activate — clean old caches
// FIX: Removed self.clients.claim() — it caused the active page to be
//      "claimed" by the new SW immediately, triggering a reload loop.
self.addEventListener('activate', (event) => {
  const keep = [STATIC_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => !keep.includes(n)).map(n => caches.delete(n)))
    )
    // No clients.claim() — avoids forced reload of current page
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and non-http
  if (!url.protocol.startsWith('http')) return;

  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    // Cache dictionary lookups for offline use
    if (url.pathname.includes('/dictionary/lookup')) {
      event.respondWith(
        fetch(event.request)
          .then(res => {
            const clone = res.clone();
            caches.open(API_CACHE).then(c => c.put(event.request, clone));
            return res;
          })
          .catch(() => caches.match(event.request))
      );
    }
    // Other API: network only (no caching)
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;

        // Only cache JS/CSS/images/fonts — not HTML pages
        if (url.pathname.match(/\.(js|css|svg|png|jpg|jpeg|webp|woff2?)$/)) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(event.request, clone));
        }

        return res;
      }).catch(() => {
        // Offline fallback — only for page navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
