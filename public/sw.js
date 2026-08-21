/* 基础 Service Worker：网络优先、离线缓存兜底。
   仅缓存同源 GET 静态资源；存档保存在 localStorage，不进入缓存。 */
const CACHE = "pl-test-static-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response && response.status === 200) {
          const clone = response.clone();
          await caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      } catch {
        const cached = await caches.match(request);
        return cached ?? new Response("离线：当前资源尚未缓存", { status: 503 });
      }
    })()
  );
});