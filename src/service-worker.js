import { build, files, version } from '$service-worker';

const self = globalThis;
const assetCache = `routeguard-assets-${version}`;
const tileCache = 'routeguard-map-tiles-v1';
const assets = [...build, ...files];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(assetCache).then((cache) => cache.addAll(assets))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('routeguard-assets-') && key !== assetCache)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isMapTile = url.hostname.endsWith('.tile.openstreetmap.org');

  if (isMapTile) {
    event.respondWith((async () => {
      const cache = await caches.open(tileCache);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(assetCache);
        await cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request).catch(() => undefined);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const offlinePage = await caches.match('/offline.html').catch(() => undefined);
        return offlinePage || new Response('RouteGuard is offline.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
      return new Response(null, { status: 503, statusText: 'Service Unavailable' });
    }
  })());
});