// Service Worker for Asistencia 2026 - PWA
const CACHE_NAME = 'asistencia-cache-v2';

// Assets to cache immediately on installation
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon.svg'
];

// Install event: cache the precache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event: apply caching strategies
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // Skip dev server internal requests, local/dev servers, non-GET requests, chrome extensions, and Supabase database requests
    if (
        url.includes('/@vite/') ||
        url.includes('/@react-refresh') ||
        url.includes('localhost') ||
        url.includes('127.0.0.1') ||
        url.startsWith('chrome-extension:') ||
        url.includes('.supabase.co') ||
        event.request.method !== 'GET'
    ) {
        return;
    }

    // Determine if it's a static hashed asset (Vite builds place compiled JS/CSS in /assets/)
    const isHashedAsset = url.includes('/assets/');

    if (isHashedAsset) {
        // Cache-First strategy for hashed assets (they never change, their name is unique)
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                });
            })
        );
    } else {
        // Network-First strategy for non-hashed assets (HTML, manifest, icons, etc.)
        // This ensures updates are seen immediately when online, while still providing offline fallback.
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    // If successful, update the cache and return
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // If offline, try to get from cache
                    return caches.match(event.request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // SPA fallback: if navigating to a page and offline, serve the cached index.html
                        if (event.request.mode === 'navigate') {
                            return caches.match('/');
                        }
                    });
                })
        );
    }
});
