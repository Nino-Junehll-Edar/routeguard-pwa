// Service Worker for RouteGuard PWA
// Implements caching strategy for offline functionality, background sync, and map tiles

const CACHE_NAME = 'routeguard-pwa-v1';
const OFFLINE_URL = '/offline.html';
const MAP_TILES_CACHE_NAME = 'routeguard-pwa-map-tiles-v1';

// Assets to cache on install (app shell)
const ASSETS_TO_CACHE = [
  '/',
  '/map',
  '/report-hazard',
  '/profile',
  '/route',
  '/agency-request',
  '/admin/agency-requests',
  '/notifications',
  '/login',
  '/register',
  OFFLINE_URL
];

// Import background sync functionality
importScripts('/lib/backgroundSync.js');
importScripts('/lib/mapTileCache.js');

// Install event - cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      }),
      caches.open(MAP_TILES_CACHE_NAME).then((cache) => {
        console.log('Service Worker: Opening map tiles cache');
      })
    ])
    .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches and set up background sync
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== MAP_TILES_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
    .then(() => self.clients.claim())
    .then(() => {
      // Register background sync
      registerBackgroundSync();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Handle map tile requests separately
  if (event.request.url.includes('.tile.openstreetmap.org/')) {
    event.respondWith(
      caches.open(MAP_TILES_CACHE_NAME)
        .then((cache) => {
          return cache.match(event.request)
            .then((cachedResponse) => {
              // Return cached tile if found
              if (cachedResponse) {
                return cachedResponse;
              }

              // Otherwise, fetch from network and cache
              return fetch(event.request)
                .then((networkResponse) => {
                  // Don't cache non-200 responses
                  if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                  }

                  // Clone the response for caching
                  const responseToCache = networkResponse.clone();

                  // Cache the tile with a reasonable expiration (we'll rely on HTTP cache headers)
                  cache.put(event.request, responseToCache);

                  return networkResponse;
                });
            });
        })
        .catch(() => {
          // If everything fails, return a transparent placeholder or error image
          return new Response('', {
            status: 404,
            headers: { 'Content-Type': 'image/png' }
          });
        })
    );
    return;
  }

  // Skip other cross-origin requests (like to Supabase)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise, go to network and cache the response
        return fetch(event.request)
          .then((networkResponse) => {
            // Don't cache non-200 responses or non-GET requests
            if (
              !networkResponse ||
              networkResponse.status !== 200 ||
              event.request.method !== 'GET'
            ) {
              return networkResponse;
            }

            // Clone the response because it's a stream that can only be consumed once
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          })
          .catch(() => {
            // If network fails, try to return an offline page
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// Background sync event listener - sync queued actions when network is available
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queued-actions') {
    event.waitUntil(syncQueuedActions());
  }
});

// Also listen for periodic sync if supported
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-queued-actions') {
    event.waitUntil(syncQueuedActions());
  }
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});