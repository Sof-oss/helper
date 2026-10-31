export function hexToRgb(hex) {
  const m = String(hex)
    .trim()
    .match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [0.37, 0.54, 0.79];
}
/* Safari (WebKit) отдаёт значение CSS-переменной с экранированием: url(assets\/bg-merc\.webp\?v\=…). */
const unesc = u =>
  u.replace(/\\(?:([0-9a-f]{1,6})\s?|(.))/gi, (_, hex, ch) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : ch));
const cssUrl = raw => {
  const m = String(raw)
    .trim()
    .match(/url\(\s*["']?([^"')]+)["']?\s*\)/);
  return m ? new URL(unesc(m[1]), document.baseURI).href : null;
};
export function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  return {
    key: document.documentElement.dataset.theme || "merc",
    accent: hexToRgb(cs.getPropertyValue("--accent")),
    accent2: hexToRgb(cs.getPropertyValue("--accent-2")),
    dim: parseFloat(cs.getPropertyValue("--bg-dim")) || 0.45,
    bg: cssUrl(cs.getPropertyValue("--bg-img")),
    /* карта глубины фото (zone3d.css, build-depth.py) */
    depth: cssUrl(cs.getPropertyValue("--depth-img"))
  };
}
/* слабое устройство: меньше частиц и ниже разрешение */
export const isMobile = matchMedia("(max-width:760px), (pointer:coarse)").matches;
export const lowPower = isMobile || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
