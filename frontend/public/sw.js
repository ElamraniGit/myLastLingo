/**
 * LinguaLearn Service Worker v2
 * - Offline caching (app shell + dictionary cache)
 * - Network-first for API calls
 * - Cache-first for static assets
 */

const CACHE_NAME = 'lingualearn-v2';
const STATIC_CACHE = 'lingualearn-static-v2';
const API_CACHE = 'lingualearn-api-v2';

const PRECACHE = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
];

// Install — precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  const keep = [STATIC_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(n => !keep.includes(n)).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // API calls: network-first, cache dictionary lookups for offline
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
      return;
    }
    // Other API: network only
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(res => {
        if (!res || res.status !== 200) return res;

        // Cache JS/CSS/images
        if (url.pathname.match(/\.(js|css|svg|png|jpg|woff2?)$/)) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(event.request, clone));
        }

        return res;
      }).catch(() => {
        // Offline fallback — return cached home page
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
