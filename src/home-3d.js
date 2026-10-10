/* Главная: живой фон Зоны.
   Подключается только на главной (<script type="module" src="home-3d.js">), собирается build.js.
   Сам этот файл крошечный: он только решает, нужен ли фон, и догружает его по требованию (папка 3d/ в dist):
   - живой фон (zone-bg) не скачивается на очень слабых устройствах, при экономии трафика и медленной сети - там остаётся обычный CSS-фон;
   - фон стартует, когда страница уже загрузилась и браузер свободен, чтобы не мешать первой отрисовке.
   three.js - общий кусок, браузер скачивает его один раз и берёт из кэша.
   При «Уменьшить движение» в системе, без WebGL и на слабых устройствах ничего не запускается - остаётся обычный сайт */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const conn = navigator.connection || {};
/* Apple (iPhone, iPad, Mac на Safari и любом браузере на iOS/iPadOS - там все браузеры на движке Safari)
   ради защиты от слежки занижает число ядер в navigator.hardwareConcurrency, поэтому этому числу там не верим.
   Остальным: совсем слабое железо (2 ядра или ≤2 ГБ памяти), экономия трафика или медленная сеть (2G/3G) */
const apple = /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
const weak =
  (!apple && (navigator.hardwareConcurrency || 8) <= 2) ||
  (navigator.deviceMemory || 8) <= 2 ||
  conn.saveData === true ||
  /2g|3g/.test(conn.effectiveType || "");
const hasGL = () => {
  try {
    const gl =
      document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl");
    if (!gl) return false;
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext(); // пробный контекст сразу освобождаем
    return true;
  } catch (e) {
    return false;
  }
};
/* поисковые и прочие роботы, проверки скорости, автоматизированные браузеры: им 3D не нужен
   (Googlebot, YandexBot и т. п. - по слову bot/crawl/spider; телефоны Cubot - не роботы) */
const ua = navigator.userAgent;
const bot =
  navigator.webdriver === true ||
  (/bot|crawl|spider|slurp|lighthouse|pagespeed|headless|prerender|mediapartners|inspectiontool/i.test(ua) &&
    !/cubot/i.test(ua));
/* после загрузки страницы и в свободную минуту браузера */
const whenIdle = () =>
  new Promise(ok => {
    const go = () =>
      window.requestIdleCallback ? requestIdleCallback(() => ok(), { timeout: 2000 }) : setTimeout(ok, 200);
    if (document.readyState === "complete") go();
    else addEventListener("load", go, { once: true });
  });

async function main() {
  if (reduce || bot || weak || !hasGL()) return;
  /* пока открыт ПДА новичка (intro.js), сайт спрятан - фон запускаем после «Войти» */
  if (document.documentElement.classList.contains("intro"))
    await new Promise(ok => addEventListener("zone-intro-done", ok, { once: true }));
  /* фон - только когда страница уже загрузилась: на скорость первой отрисовки он не влияет */
  await whenIdle();
  const { startBackground } = await import("./zone-bg.js");
  startBackground();
}
main().catch(e => console.warn("3D главной не запустилось", e));
