/* GanyanSosyal Service Worker
   Amaç: GitHub Pages'e yeni dosya yüklenince çerez/önbellek temizlemeye gerek kalmasın.
   Strateji: sayfa (HTML) ve kendi dosyaları için "önce ağ" (cache:'no-store'),
   internet yoksa son çalışan kopya. Firebase / Google istekleri ellenmez. */
const CACHE = 'ganyansosyal-offline-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Firebase, fontlar vb. dokunma
  e.respondWith((async () => {
    try {
      // Ağ 3 sn'de yanıt vermezse (yavaş bağlantı) açılışı bekletme, son kopyayı göster
      const net = fetch(req, {cache: 'no-store'});
      let fresh;
      if (req.mode === 'navigate') {
        const slow = new Promise(r => setTimeout(() => r(null), 3000));
        fresh = await Promise.race([net, slow]);
        if (!fresh) {
          const hit = await caches.match(req, {ignoreSearch: true});
          if (hit) { net.then(r => r && r.ok && caches.open(CACHE).then(c => c.put(req, r.clone()))).catch(() => {}); return hit; }
          fresh = await net;
        }
      } else {
        fresh = await net;
      }
      if (fresh && fresh.ok) {
        const c = await caches.open(CACHE);
        c.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const hit = await caches.match(req, {ignoreSearch: true});
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const home = await caches.match(self.location.pathname.replace(/sw\.js$/, ''), {ignoreSearch: true})
                  || await caches.match(self.location.pathname.replace(/sw\.js$/, 'index.html'), {ignoreSearch: true});
        if (home) return home;
      }
      throw err;
    }
  })());
});
