const CACHE_NAME = 'dseu-unfiltered-cache-v1';
const OFFLINE_URL = '/offline.html';

// Install event - cache offline assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        OFFLINE_URL,
        '/favicon.svg'
      ]);
    })
  );
  // Force active service worker to take control
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - handle offline falling back
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and skip socket/chrome extensions requests
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If response is valid, clone and cache it for offline fallback if it is a static asset
        if (response && response.status === 200) {
          const url = new URL(event.request.url);
          if (url.pathname.match(/\.(js|css|svg|png|jpg|jpeg|woff2)$/)) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
        }
        return response;
      })
      .catch(() => {
        // If fetch fails, try to return asset from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If the request was for a webpage, return offline.html
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match(OFFLINE_URL);
          }
        });
      })
  );
});
