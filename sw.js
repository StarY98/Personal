/* 个人业务看板 PWA Service Worker
   策略：页面导航走网络优先（保证每次上传新 personal.html 后能看到新数据），
   离线时回退到缓存；图标/清单等静态资源走缓存优先。 */
const CACHE = "tianhe-pwa-v1";
const SHELL = [
  "./personal.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
  "./icons/icon-maskable-512.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "reload" });
        if (res && res.ok) await cache.put(url, res);
      } catch (e) { /* 某个资源缺失时不阻塞安装 */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          await cache.put("./personal.html", fresh.clone());
        }
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE);
        return (await cache.match(req)) ||
               (await cache.match("./personal.html")) ||
               new Response("当前处于离线状态，请联网后重新打开。", {
                 status: 503,
                 headers: { "Content-Type": "text/plain;charset=utf-8" }
               });
      }
    })());
    return;
  }

  if (/\.(?:png|jpg|jpeg|svg|ico|json|css|js|webp)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok) await cache.put(req, res.clone());
        return res;
      } catch (e) {
        return new Response("", { status: 404 });
      }
    })());
  }
});
