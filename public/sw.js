const CACHE_NAME = 'timestamp-camera-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch (dummy service worker to satisfy PWA installability)
  event.respondWith(fetch(event.request).catch(() => new Response("Network error")));
});
