/*
 * Offline shell for the subscriber app.
 *
 * Only the app shell is cached. API calls are never cached: a subscriber's bills
 * and profile are personal data, and serving a stale copy from the device cache
 * would show one subscriber's figures to whoever next opens the app.
 */

const CACHE_NAME = 'trigon-customer-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the API: it is per-subscriber and authenticated by cookie.
  if (url.pathname.startsWith('/api/')) return;

  // Network first, so a deployed update is picked up immediately, falling back
  // to the cached shell when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached ?? caches.match('/index.html'))
      )
  );
});
