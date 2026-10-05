/* Главная: 3D-заставка при первом заходе и живой фон Зоны.
   Подключается только на главной (<script type="module" src="home-3d.js">), собирается build.js.
   Сам этот файл крошечный: он только решает, что нужно, и догружает части по требованию (папка 3d/ в dist):
   — заставка (zone-intro) скачивается лишь при первом заходе;
   — живой фон (zone-bg) не скачивается на очень слабых устройствах, при экономии трафика и медленной сети — там остаётся обычный CSS-фон;
   — фон стартует, когда страница уже загрузилась и браузер свободен, чтобы не мешать первой отрисовке.
   three.js — общий кусок, браузер скачивает его один раз и берёт из кэша.
   При «Уменьшить движение» в системе или без WebGL ничего не запускается — остаётся обычный сайт */
/* диагностика: откройте главную с ?debug3d — поверх страницы появится журнал запуска 3D (для отладки на iPhone/iPad) */
const DBG = /[?&]debug3d/.test(location.search);
const dlog = window.__z3d = (...a) => {
  if (!DBG) return;
  let box = document.getElementById("z3d-log");
  if (!box) {
    box = document.createElement("pre"); box.id = "z3d-log";
    box.style.cssText = "position:fixed;left:6px;right:6px;bottom:6px;max-height:55vh;overflow:auto;z-index:99999;margin:0;padding:8px;background:rgba(0,0,0,.85);color:#9f9;font:11px/1.35 monospace;white-space:pre-wrap;pointer-events:auto;border:1px solid #3a3";
    (document.body || document.documentElement).appendChild(box);
  }
  box.textContent += (performance.now() / 1000).toFixed(2) + "s " + a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" ") + "\n";
};
if (DBG) {
  addEventListener("error", e => dlog("JS ERROR", e.message, (e.filename || "").split("/").pop() + ":" + e.lineno));
  addEventListener("unhandledrejection", e => dlog("PROMISE ERROR", String(e.reason && (e.reason.stack || e.reason))));
  const ce = console.error, cw = console.warn;
  console.error = (...a) => { dlog("console.error", a.map(String).join(" ").slice(0, 600)); ce.apply(console, a); };
  console.warn = (...a) => { dlog("console.warn", a.map(String).join(" ").slice(0, 600)); cw.apply(console, a); };
}
const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const conn = navigator.connection || {};
/* Apple (iPhone, iPad, Mac на Safari и любом браузере на iOS/iPadOS — там все браузеры на движке Safari)
   ради защиты от слежки занижает число ядер в navigator.hardwareConcurrency, поэтому этому числу там не верим.
   Остальным: совсем слабое железо (2 ядра или ≤2 ГБ памяти), экономия трафика или медленная сеть (2G/3G) */
const apple = /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
const weak = (!apple && (navigator.hardwareConcurrency || 8) <= 2) || (navigator.deviceMemory || 8) <= 2
  || conn.saveData === true || /2g|3g/.test(conn.effectiveType || "");
const hasGL = (() => {
  try {
    const gl = document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl");
    if (!gl) return false;
    const lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext();   // пробный контекст сразу освобождаем
    return true;
  } catch (e) { return false; }
})();
const unblock = () => root.classList.remove("intro-pending");
/* после загрузки страницы и в свободную минуту браузера */
const whenIdle = () => new Promise(ok => {
  const go = () => (window.requestIdleCallback ? requestIdleCallback(() => ok(), { timeout: 2000 }) : setTimeout(ok, 200));
  if (document.readyState === "complete") go(); else addEventListener("load", go, { once: true });
});

async function main() {
  dlog("ua", navigator.userAgent);
  dlog("reduce", reduce, "hasGL", hasGL, "weak", weak, "apple", apple, "cores", navigator.hardwareConcurrency, "mem", navigator.deviceMemory, "ric", typeof window.requestIdleCallback, "size", innerWidth + "x" + innerHeight, "dpr", devicePixelRatio);
  if (reduce || !hasGL) return unblock();
  const introWanted = () => root.classList.contains("intro-pending") && !window.__introSkip;
  if (introWanted()) {
    const { runIntro } = await import("./zone-intro.js");
    /* пока качалась заставка, мог сработать запасной таймер в <head> (3 с) — тогда страница уже открыта, заставку не показываем */
    if (introWanted()) await runIntro(); else unblock();
  } else unblock();
  dlog("intro done");
  if (weak) return dlog("STOP: weak");
  await whenIdle();
  dlog("idle -> import zone-bg");
  const { startBackground } = await import("./zone-bg.js");
  dlog("zone-bg loaded");
  const r = startBackground();
  dlog("startBackground ->", r ? "ok" : "null");
}
main().catch(e => { dlog("MAIN FAIL", String(e && (e.stack || e))); console.warn("3D главной не запустилось", e); unblock(); });
