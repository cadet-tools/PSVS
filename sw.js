/* CADET PERSONĀLS — bezsaistes kešs. Kešo TIKAI programmas failus (kodu, bibliotēkas).
   Personu dati un dokumenti caur šo nekad neiet: tie tiek lasīti tieši no datora mapes. */
const CACHE = 'cadet-stable-1.22.0', PREFIX = 'cadet-stable-';
const CORE = ['./', 'index.html', 'app.bundle.js', 'PS_LOGO.png', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/version\.json$/.test(url.pathname)) return;   // versijas pārbaude vienmēr no tīkla
  const isCode = req.mode === 'navigate' || /\/(index\.html|app\.bundle\.js|manifest\.webmanifest)$/.test(url.pathname) || /\/templates\/[^/]+\.docx$/.test(url.pathname) || url.pathname.endsWith('/');
  if (isCode) {
    // tīkls vispirms — atjauninājumi pienāk uzreiz; bez interneta — no keša
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
  } else {
    // bibliotēkas (pdf.js, atpazīšana, ikonas) — kešs vispirms
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })));
  }
});
/* Paziņojuma klikšķis: atver (vai fokusē) rīka logu un pāriet uz vajadzīgo sadaļu */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const page = e.notification.data?.page || 'dashboard';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list.find(x => x.url.startsWith(self.registration.scope));
    if (c) { c.postMessage({ type: 'cp-open', page }); return c.focus(); }
    return self.clients.openWindow(self.registration.scope);
  }));
});
