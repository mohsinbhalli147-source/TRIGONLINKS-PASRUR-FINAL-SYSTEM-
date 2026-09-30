/**
 * Trigon Links ISP Suite service worker.
 *
 * The previous version of this file did nothing. `install` only called
 * `skipWaiting()` and never opened a cache, so `fetch` fell back to
 * `caches.match()` against a cache that was always empty. Offline that resolved
 * to `undefined`, and handing `undefined` to `respondWith` throws, so the browser
 * reported a bare network error instead of anything the app could render.
 *
 * What this version does, and deliberately not do:
 *
 * - Precaches the app shell only: the document, the manifest and the icons.
 *   The hashed JS and CSS bundles are cached the first time they load.
 * - Never touches `/api/...` or any cross-origin request. Those go straight to
 *   the network. Caching them would mean serving a stale session or a stale
 *   customer record to a signed-in operator, which is a security problem, not a
 *   performance win. The panel already refuses to run without the server
 *   (see App.tsx), so there is nothing to gain by caching its responses.
 * - Versions the cache and drops old ones on activate, so a deploy does not
 *   leave a previous build pinned in place.
 */

// Bump when the shell changes so a deploy evicts the previous cache.
const CACHE_NAME = 'trigon-isp-suite-v1';

// The document and the assets needed to render it before any bundle loads.
// The hashed bundles are not listed here: their names change per build, so they
// are cached at runtime by the fetch handler instead.
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Individually, so one 404 cannot fail the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
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

/**
 * Navigations, and the hashed build output. Never the API.
 *
 * `request` is passed as well as the parsed `url` because the navigation mode
 * lives on the Request; a URL object has no `mode`, so reading it from there
 * silently drops every real navigation on the floor.
 */
function isCacheable(url, request) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  return (
    request.mode === 'navigate' ||
    url.pathname.startsWith('/assets/') ||
    SHELL.includes(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (!isCacheable(url, request)) return;

  // Navigations: fresh document when possible, cached shell when not, so a
  // dropped connection still shows the app's own "cannot reach the server"
  // screen instead of the browser's offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((cached) => cached || Response.error())
      )
    );
    return;
  }

  // Hashed assets: serve from cache, refresh in the background. A build that
  // changes the file name produces a new URL, so there is no stale-hit risk.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
