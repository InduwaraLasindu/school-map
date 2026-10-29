/* School Navigator offline shell. Floor images are cached only after they are visited. */
const CACHE_VERSION = 'school-navigator-v3';
const APP_SHELL = ['./', './index.html', './enhancements.css', './enhancements.js', './logo.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('school-navigator-') && key !== CACHE_VERSION).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const requestURL = new URL(event.request.url);
  const isAppShell = requestURL.pathname.endsWith('/index.html') ||
    requestURL.pathname.endsWith('/') ||
    requestURL.pathname.endsWith('/enhancements.css') ||
    requestURL.pathname.endsWith('/enhancements.js');
  if (isAppShell) {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
    }
    return response;
  })));
});
