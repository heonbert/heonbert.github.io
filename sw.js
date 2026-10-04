// Service worker for 유목의 물빛사진.
// Pages, scripts and data: the network first, the cache only when offline.
// Pictures, fonts and 3D models, which do not change under the same name within one version:
// the cache first, with a limit on how many are kept. Film and sound are never cached.
// VERSION is stamped by tools/build_misc.py; a new version discards everything kept by the old one.
const VERSION = 'yumok-554139b55c';
const PAGES = VERSION + '-pages', FILES = VERSION + '-files';
const KEEP = 420;                                  // how many pictures, fonts and models to keep
const LASTING = /\.(?:webp|jpe?g|png|ico|svg|woff2?|glb)$/i;
const NEVER = /\.(?:mp4|mp3|webm|pdf)$/i;

self.addEventListener('install', event => {
    event.waitUntil(caches.open(PAGES).then(cache => cache.addAll(['/', '/style.css', '/motion.css', '/motion.js'])).catch(() => {}));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(names => Promise.all(names.filter(n => !n.startsWith(VERSION)).map(n => caches.delete(n)))));
    self.clients.claim();
});

async function trim(cache) {
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - KEEP; i++) await cache.delete(keys[i]);     // the oldest first
}

async function lasting(request) {
    const cache = await caches.open(FILES);
    const hit = await cache.match(request);
    if (hit) return hit;
    const response = await fetch(request);
    if (response.status === 200 && response.type === 'basic') {
        cache.put(request, response.clone()).then(() => trim(cache)).catch(() => {});
    }
    return response;
}

async function fresh(request) {
    try {
        const response = await fetch(request);
        if (response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(PAGES).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
    } catch (err) {
        const hit = await caches.match(request);
        if (hit) return hit;
        throw err;
    }
}

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET' || request.headers.has('range')) return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || NEVER.test(url.pathname)) return;
    event.respondWith(LASTING.test(url.pathname) ? lasting(request) : fresh(request));
});
