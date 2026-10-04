/* Главная: 3D-заставка при первом заходе и живой фон Зоны.
   Подключается только на главной (<script type="module" src="home-3d.js">), собирается build.js в один файл.
   При «Уменьшить движение» в системе или без WebGL ничего не запускается — остаётся обычный сайт */
import { startBackground } from "./zone-bg.js";
import { runIntro, shouldShowIntro } from "./zone-intro.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasGL = (() => {
  try {
    const gl = document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl");
    if (!gl) return false;
    const lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext();   // пробный контекст сразу освобождаем
    return true;
  } catch (e) { return false; }
})();

async function main() {
  if (reduce || !hasGL) { document.documentElement.classList.remove("intro-pending"); return; }
  if (shouldShowIntro()) await runIntro();
  else document.documentElement.classList.remove("intro-pending");
  startBackground();
}
main().catch(e => { console.warn("3D главной не запустилось", e); document.documentElement.classList.remove("intro-pending"); });
