// Service worker aplikacji „Dyżury”. Zmień VERSION po każdej aktualizacji plików, aby wymusić odświeżenie cache.
const VERSION = 'dyzury-v2';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  // każdy plik osobno – brak jednego nie blokuje instalacji service workera
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(()=>{})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Dane z bazy zawsze prosto z sieci (Firestore ma własną synchronizację)
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('firebaseio.com')) return;

  // Strona: najpierw sieć (zawsze świeża wersja), w razie braku internetu – cache
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Reszta (ikony, Font Awesome, skrypty Firebase): z cache, w tle odświeżana
  const cacheable = url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'www.gstatic.com';
  if (!cacheable) return;
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
