/**
 * LinguaLearn Service Worker v4 — Full Offline Support
 *
 * Strategy:
 *  - App shell (HTML/JS/CSS) : Cache-first → network fallback
 *  - Dictionary API GET      : Network-first → cache fallback
 *  - Vocabulary GET          : Network-first → cache fallback (short TTL)
 *  - Mutations (POST/PATCH/DELETE): Network-only (handled by IndexedDB queue)
 *  - TTS audio              : Cache-first (MP3 blobs, keyed by text+voice)
 *  - Other API              : Network-only
 *
 * FIX (v3): No skipWaiting / clients.claim() — prevents reload loop.
 */

const STATIC_CACHE = 'll-static-v4';
const API_CACHE    = 'll-api-v4';
const TTS_CACHE    = 'll-tts-v4';

const KEEP_CACHES  = [STATIC_CACHE, API_CACHE, TTS_CACHE];

// Pages/assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(() => {}) // Don't fail install if precache fails
    // No skipWaiting — avoids reload loop
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(n => !KEEP_CACHES.includes(n))
          .map(n => caches.delete(n))
      )
    )
    // No clients.claim() — avoids forced reload
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET entirely (POST/PATCH/DELETE handled by offline queue)
  if (req.method !== 'GET') return;

  // Skip non-http(s)
  if (!url.protocol.startsWith('http')) return;

  // ── TTS audio: cache-first (long TTL — audio doesn't change) ───────────────
  if (url.pathname.startsWith('/api/') && url.pathname.includes('/tts')) {
    event.respondWith(cacheThenNetwork(req, TTS_CACHE));
    return;
  }

  // ── Dictionary lookup: network-first → cache fallback ──────────────────────
  if (url.pathname.includes('/dictionary/lookup') ||
      url.pathname.includes('/dictionary/search') ||
      url.pathname.includes('/dictionary/suggest')) {
    event.respondWith(networkThenCache(req, API_CACHE));
    return;
  }

  // ── Vocabulary GET: network-first → cache fallback ─────────────────────────
  if (url.pathname.includes('/vocabulary/list') ||
      url.pathname.includes('/vocabulary/due') ||
      url.pathname.includes('/vocabulary/review/summary') ||
      url.pathname.includes('/vocabulary/stats')) {
    event.respondWith(networkThenCache(req, API_CACHE, 60 * 5)); // 5 min TTL
    return;
  }

  // ── Other API: network-only (auth, player, library, etc.) ──────────────────
  if (url.pathname.startsWith('/api/')) {
    return; // Let the browser handle it normally
  }

  // ── Static assets: cache-first → network fallback ──────────────────────────
  if (url.pathname.match(/\.(js|css|svg|png|jpg|jpeg|webp|ico|woff2?)$/)) {
    event.respondWith(cacheThenNetwork(req, STATIC_CACHE));
    return;
  }

  // ── Navigation (HTML pages): network-first → app shell fallback ────────────
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/').then(r => r || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // ── Everything else: network with cache fallback ────────────────────────────
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then(r => r || new Response('Offline', { status: 503 })))
  );
});

// ── Strategy helpers ──────────────────────────────────────────────────────────

/** Cache-first: return cached if available, otherwise fetch + cache */
async function cacheThenNetwork(req, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type !== 'opaque') {
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

/** Network-first: fetch → cache; if network fails return cached */
async function networkThenCache(req, cacheName, ttlSeconds = 0) {
  const cache = await caches.open(cacheName);

  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const toCache = res.clone();
      // Add TTL header if requested
      if (ttlSeconds > 0) {
        const headers = new Headers(toCache.headers);
        headers.set('sw-cached-at', String(Date.now()));
        headers.set('sw-ttl', String(ttlSeconds * 1000));
        // Can't modify headers on real response — store as-is
      }
      cache.put(req, toCache);
    }
    return res;
  } catch {
    // Network failed — try cache
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ offline: true, error: 'Network unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ── Background Sync (if supported) ───────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'll:sync') {
    // The actual sync is handled by useOffline.ts in the app
    // SW sync event just signals the app to wake up
    event.waitUntil(Promise.resolve());
  }
});

// ── Push message from app ─────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    // Only skip waiting if explicitly requested by user action
    self.skipWaiting();
  }
  if (event.data?.type === 'CACHE_WORDS') {
    // Pre-cache a word lookup result sent from the app
    const { url, data } = event.data;
    if (url && data) {
      caches.open(API_CACHE).then(cache => {
        const res = new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' },
        });
        cache.put(url, res);
      });
    }
  }
});
