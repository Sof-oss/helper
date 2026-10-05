/* Главная: 3D-заставка при первом заходе и живой фон Зоны.
   Подключается только на главной (<script type="module" src="home-3d.js">), собирается build.js.
   Сам этот файл крошечный: он только решает, что нужно, и догружает части по требованию (папка 3d/ в dist):
   — заставка (zone-intro) скачивается лишь при первом заходе;
   — живой фон (zone-bg) не скачивается на очень слабых устройствах, при экономии трафика и медленной сети — там остаётся обычный CSS-фон;
   — фон стартует, когда страница уже загрузилась и браузер свободен, чтобы не мешать первой отрисовке.
   three.js — общий кусок, браузер скачивает его один раз и берёт из кэша.
   При «Уменьшить движение» в системе или без WebGL ничего не запускается — остаётся обычный сайт */
const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const conn = navigator.connection || {};
/* совсем слабое железо (2 ядра или ≤2 ГБ памяти), включённая экономия трафика или медленная сеть (2G/3G) */
const weak = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2
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
  if (reduce || !hasGL) return unblock();
  const introWanted = () => root.classList.contains("intro-pending") && !window.__introSkip;
  if (introWanted()) {
    const { runIntro } = await import("./zone-intro.js");
    /* пока качалась заставка, мог сработать запасной таймер в <head> (3 с) — тогда страница уже открыта, заставку не показываем */
    if (introWanted()) await runIntro(); else unblock();
  } else unblock();
  if (weak) return;
  await whenIdle();
  const { startBackground } = await import("./zone-bg.js");
  startBackground();
}
main().catch(e => { console.warn("3D главной не запустилось", e); unblock(); });
