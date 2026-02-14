// Service Worker - 유목의 물빛사진 PWA
var CACHE_NAME = 'yumok-v1';

// 설치 시 기본 셸 캐싱
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll([
                '/',
                '/style.css',
                '/bookmark.js',
                '/popup_gallery.js',
                '/assets/photographer/leedongjoo.jpg'
            ]);
        })
    );
    self.skipWaiting();
});

// 활성화 시 이전 캐시 정리
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.filter(function(name) {
                    return name !== CACHE_NAME;
                }).map(function(name) {
                    return caches.delete(name);
                })
            );
        })
    );
    self.clients.claim();
});

// 네트워크 우선, 실패 시 캐시 (사진 갤러리이므로 항상 최신 우선)
self.addEventListener('fetch', function(event) {
    // GET 요청만, http(s)만 캐시 (chrome-extension 등 제외)
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        fetch(event.request).then(function(response) {
            // 성공하면 캐시에도 저장 (same-origin만)
            if (response.status === 200 && response.type === 'basic') {
                var responseClone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, responseClone);
                }).catch(function() {});
            }
            return response;
        }).catch(function() {
            // 오프라인이면 캐시에서 반환
            return caches.match(event.request);
        })
    );
});
