// Palestra service worker: the app shell opens offline, even on a cold reload.
// The build (vite.config.ts, swPrecache) injects the list of built files and a
// version derived from it. Same-origin GET only: Firebase traffic goes to other
// origins and is never touched (Firestore keeps its own IndexedDB cache).
const PRECACHE = /*__PRECACHE__*/[];
const CACHE = 'palestra-shell-' + '/*__VERSION__*/dev';
// Module scripts carry an Origin header the precache requests did not: a
// `Vary: Origin` response would never match without ignoreVary.
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // Drop the caches of previous builds.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('palestra-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function putIfOk(req, res) {
  if (res && res.ok && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/__/')) return; // Firebase reserved URLs (auth handler)

  if (req.mode === 'navigate') {
    // Network first so a deploy shows up at once; cached shell when offline.
    event.respondWith(
      fetch(req)
        .then((res) => putIfOk(new Request('/'), res))
        .catch(() => caches.match('/', MATCH).then((hit) => hit || Response.error())),
    );
    return;
  }

  // Hashed assets and icons: cache first.
  event.respondWith(caches.match(req, MATCH).then((hit) => hit || fetch(req).then((res) => putIfOk(req, res))));
});
