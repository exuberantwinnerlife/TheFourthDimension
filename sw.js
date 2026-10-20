/* The Fourth Dimension: offline copy of the app.
   This file never touches your logged data. It only keeps a copy of the app itself,
   so the app opens with no signal and installs to the Home Screen. */
const V = 'fd-app-1';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('fd-app-') && k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (req, res) => caches.open(V).then(c => c.put(req, res)).catch(() => {});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  // The page itself: always try for the newest version, fall back to the saved copy when offline or slow.
  if (r.mode === 'navigate') {
    e.respondWith((async () => {
      const cached = await caches.match('index.html');
      const net = fetch(r).then(res => {
        if (res.ok) put('index.html', res.clone());
        return res;
      });
      net.catch(() => {});
      if (!cached) return net;
      const slow = new Promise(ok => setTimeout(() => ok(cached), 4000));
      try { return await Promise.race([net, slow]); } catch (err) { return cached; }
    })());
    return;
  }

  // Icons, manifest and fonts: use the saved copy right away and refresh it in the background.
  if (u.origin === location.origin || /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(r).then(hit => {
      const net = fetch(r).then(res => {
        if (res.ok || res.type === 'opaque') put(r, res.clone());
        return res;
      }).catch(() => hit || Response.error());
      return hit || net;
    }));
  }
});
