/* Цвета и фон текущей темы (группировки) берём прямо из CSS-переменных сайта,
   поэтому 3D всегда совпадает с выбранной темой */
export function hexToRgb(hex) {
  const m = String(hex)
    .trim()
    .match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [0.37, 0.54, 0.79];
}
export function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const raw = cs.getPropertyValue("--bg-img").trim();
  const m = raw.match(/url\(\s*["']?([^"')]+)["']?\s*\)/);
  /* Safari (WebKit) отдаёт значение CSS-переменной с экранированием: url(assets\/bg-merc\.webp\?v\=…).
     Без снятия «\» адрес превращается в assets//bg-merc/.webp/?v… и картинка не грузится */
  const unesc = u =>
    u.replace(/\\(?:([0-9a-f]{1,6})\s?|(.))/gi, (_, hex, ch) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : ch));
  return {
    key: document.documentElement.dataset.theme || "merc",
    accent: hexToRgb(cs.getPropertyValue("--accent")),
    accent2: hexToRgb(cs.getPropertyValue("--accent-2")),
    dim: parseFloat(cs.getPropertyValue("--bg-dim")) || 0.45,
    bg: m ? new URL(unesc(m[1]), document.baseURI).href : null
  };
}
/* слабое устройство: меньше частиц и ниже разрешение */
export const isMobile = matchMedia("(max-width:760px), (pointer:coarse)").matches;
export const lowPower = isMobile || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
