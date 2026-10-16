/* GanyanSosyal Service Worker
   Strateji: önce önbellek (anında açılır), arkada ağdan güncelle.
   Yeni dosya yüklenince bir sonraki açılışta otomatik gelir.
   Firebase SDK dosyaları (sürüm numaralı) önbellekten sunulur.
   Firestore / Auth / diğer API istekleri ellenmez. */
const CACHE = 'ganyansosyal-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const okRes = r => r && (r.ok || r.type === 'opaque');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Firebase SDK (sürüm numaralı, değişmez): önbellekten
  if (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (okRes(res)) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;   // diğer dış istekler: dokunma

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, {ignoreSearch: true});
    // Arkada güncelle (kullanıcıyı bekletmez)
    const update = fetch(req, {cache: 'no-store'}).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    if (hit) { update.catch(() => {}); return hit; }
    try { return await update; }
    catch (err) {
      if (req.mode === 'navigate') {
        const home = await cache.match(self.location.pathname.replace(/sw\.js$/, ''), {ignoreSearch: true})
                  || await cache.match(self.location.pathname.replace(/sw\.js$/, 'index.html'), {ignoreSearch: true});
        if (home) return home;
      }
      throw err;
    }
  })());
});
