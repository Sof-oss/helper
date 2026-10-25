/* Service worker: сайт открывается без сети и ставится на телефон как приложение (manifest.webmanifest).
   Регистрирует его sw-register.js (build.js подключает его и manifest на каждую страницу).
   build.js при сборке подставляет в dist/sw.js версию и список статической оболочки - offline.html и css/js/
   шрифтов/иконок/картинок страниц. Сами страницы и данные Топ-100 в версию и precache не входят: они меняются
   каждый день, а оболочка должна обновляться только при правке статики. Новая версия = новый sw.js: браузер
   ставит его сам, старый кэш оболочки удаляется.
   Стратегии:
   - страницы: сначала сеть (если сеть молчит дольше 4 с - сохранённая копия), без сети - сохранённая копия
     (кэшируется при первом открытии) или страница offline;
   - данные Топ-100 (top100-data.js, top100-players.json): всегда сначала сеть, кэш - только без сети;
   - файлы с ?v=, шрифты и куски 3D (/3d/*-хэш.js): из кэша, их содержимое по этому адресу не меняется;
   - остальное своё (картинки гайдов, фоны): из кэша сразу, в фоне обновляем.
   Чужие адреса (капча, приём гайдов), не-GET запросы, видео и запросы с Range не трогаем */
"use strict";
const VERSION = "__SW_VERSION__";
const PRECACHE = "__SW_PRECACHE__";
const SHELL = "zone-shell-" + VERSION;
const PAGES = "zone-pages";
const DATA = "zone-data";
const RUNTIME = "zone-runtime";
const RUNTIME_MAX = 160;
const NET_TIMEOUT = 4000;

/* адреса с ?v= - по содержимому: их можно брать из HTTP-кэша. У остальных (offline, постеры без ?v) содержимое
   по адресу может измениться, поэтому на установке запрашиваем свежую копию */
const precacheRequest = u => new Request(u, { cache: /\?v=/.test(u) ? "default" : "reload" });

self.addEventListener("install", e => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then(c => c.addAll(PRECACHE.map(precacheRequest)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith("zone-shell-") && k !== SHELL).map(k => caches.delete(k)));
      await self.clients.claim();
      /* страница, которая уже открыта в момент установки, не проходила через fetch SW - сохраняем её и ассеты,
         чтобы после первого же визита раздел открывался без сети */
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(clients.map(c => cachePage(c.url)));
    })()
  );
});

/* /calculator.html и /calculator, /index.html и / - одна страница */
function pageKey(url) {
  const p = url.pathname.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");
  return url.origin + (p || "/");
}
async function put(cacheName, key, res) {
  /* 206 (часть файла) cache.put не принимает и бросает ошибку, поэтому кэшируем только полные ответы */
  if (!res || res.status !== 200 || res.type !== "basic") return;
  try {
    const c = await caches.open(cacheName);
    await c.put(key, res);
  } catch {}
}
async function trim(cacheName, max) {
  const c = await caches.open(cacheName),
    keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
const timeout = ms => new Promise(res => setTimeout(() => res(null), ms));

async function page(req, url) {
  const key = pageKey(url);
  const cached = () =>
    caches
      .match(key, { ignoreSearch: true })
      .then(r => r || caches.match(key + "/", { ignoreSearch: true }))
      .then(r => r || null);
  const net = fetch(req).then(res => {
    if (res.ok) put(PAGES, key, res.clone()).then(() => trim(PAGES, 60));
    return res;
  });
  net.catch(() => {});
  try {
    /* сеть подвисла - отдаём сохранённую копию, если она есть, иначе ждём сеть дальше */
    const first = await Promise.race([net, timeout(NET_TIMEOUT).then(() => cached())]);
    if (first) return first;
    return await net;
  } catch {
    return (await cached()) || (await caches.match("/offline")) || Response.error();
  }
}
async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res.ok) await put(cacheName, req, res.clone());
    return res;
  } catch {
    /* без сети годится и прошлая версия данных (другой ?v=) */
    return (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true })) || Response.error();
  }
}
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await put(RUNTIME, req, res.clone());
    trim(RUNTIME, RUNTIME_MAX);
  }
  return res;
}
/* сохранить страницу и её файлы с ?v= (например, картинки гайда) в кэш: для вкладок, открытых до установки SW */
const PAGE_ASSET = /<(?:link|script|img)\b[^>]*?\s(?:href|src)="([^"]+\?v=[^"]+)"/g;
async function cachePage(url) {
  try {
    const res = await fetch(url, { cache: "reload" });
    if (!res.ok) return;
    await put(PAGES, pageKey(new URL(url)), res.clone());
    const html = await res.text();
    const assets = [...html.matchAll(PAGE_ASSET)]
      .map(m => new URL(m[1], url))
      .filter(u => u.origin === self.location.origin);
    /* данные Топ-100 - в DATA (их потом читает networkFirst), остальные файлы - в общий кэш */
    const data = assets.filter(u => /^\/top100-data\.js$/.test(u.pathname));
    const rest = assets.filter(u => !data.includes(u));
    await Promise.all([
      ...data.map(u =>
        fetch(u.href)
          .then(r => (r.ok ? put(DATA, new Request(u.href), r) : null))
          .catch(() => {})
      ),
      ...rest.map(u => cacheFirst(new Request(u.href)).catch(() => {}))
    ]);
  } catch {}
}
async function staleWhileRevalidate(req, e) {
  const hit = await caches.match(req);
  const net = fetch(req)
    .then(async res => {
      if (res.ok) {
        await put(RUNTIME, req, res.clone());
        trim(RUNTIME, RUNTIME_MAX);
      }
      return res;
    })
    .catch(() => null);
  if (hit) {
    e.waitUntil(net);
    return hit;
  }
  return (await net) || Response.error();
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;
  /* видео и любые запросы с Range (браузер просит файл кусками) отдаём браузеру как есть */
  if (req.headers.has("range") || req.destination === "video" || req.destination === "audio") return;
  if (req.mode === "navigate") {
    e.respondWith(page(req, url));
    return;
  }
  if (/^\/top100-(?:data\.js|players\.json)$/.test(url.pathname)) {
    e.respondWith(networkFirst(req, DATA));
    return;
  }
  if (url.searchParams.has("v") || /^\/(?:3d|assets\/fonts)\//.test(url.pathname)) {
    e.respondWith(cacheFirst(req));
    return;
  }
  e.respondWith(staleWhileRevalidate(req, e));
});
