// This is a basic service worker for the RouteGuard PWA.
// In a production app, you would want to implement caching strategies, background sync, etc.

const CACHE_NAME = 'routeguard-pwa-cache-v1';
const urlsToCache = [
  '/',
  '/map',
  '/report-hazard',
  '/profile',
  '/route',
  '/agency-request',
  '/admin/agency-requests',
  // Add other routes as needed
  // We'll also cache static assets like CSS, JS, images, etc.
  // For simplicity, we'll rely on vite's built-in caching for now.
];

// Install the service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Cache and return requests
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Update the service worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// We can also handle push notifications here if we were using FCM
// For now, we are using the browser's Notification API directly from the app.
// So we don't need to handle push in the service worker for this MVP.