// Basic Service Worker for PWA installability
const CACHE_NAME = 'asistencia-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Skip dev server internal requests and localhost
    if (
        event.request.url.includes('/@vite/') ||
        event.request.url.includes('/@react-refresh') ||
        event.request.url.includes('localhost') ||
        event.request.url.includes('127.0.0.1')
    ) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
