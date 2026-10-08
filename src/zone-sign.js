/* Знак радиации из волн-дуг - один источник для всего сайта: шапка (живой SVG, бьётся вместе с сердцем),
   картинки логотипа и иконок (previews/logo.html) и заставка (zone-intro.js: знак, в который складываются волны).
   Координаты - в квадрате 100×100, центр знака (50, 50) */
export const SIGN = {
  logo: { radii: [28.5, 36, 43.5], width: 2.2, fade: 0.1 },
  /* favicon: две волны толще */
  small: { radii: [33.5, 44.5], width: 4.5, fade: 0.12 }
};
/* лопасти по 60° с центрами на 30°, 150° и 270° (y вверх); в SVG y вниз */
const BLADES = [-30, -150, 90];
const f = n => +n.toFixed(2);
const pt = (r, deg) => [f(50 + r * Math.cos((deg * Math.PI) / 180)), f(50 + r * Math.sin((deg * Math.PI) / 180))];
const arcs = r =>
  BLADES.map(a => {
    const [x1, y1] = pt(r, a - 30),
      [x2, y2] = pt(r, a + 30);
    return `M${x1} ${y1}A${r} ${r} 0 0 1 ${x2} ${y2}`;
  }).join("");
const sectors = (r0, r1) =>
  BLADES.map(a => {
    const [x1, y1] = pt(r1, a - 30),
      [x2, y2] = pt(r1, a + 30),
      [x3, y3] = pt(r0, a + 30),
      [x4, y4] = pt(r0, a - 30);
    return `M${x1} ${y1}A${r1} ${r1} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${r0} ${r0} 0 0 0 ${x4} ${y4}Z`;
  }).join("");

/* свечение - стопка широких полупрозрачных обводок (без SVG-фильтров: они одинаково выглядят везде и дёшевы в анимации) */
const glow = (d, w, col) =>
  Array.from({ length: 7 }, (_, i) => {
    const k = 2.6 - i * 0.23; // от широкой и прозрачной к узкой и плотной - мягкий, без ступенек ореол
    return `<path d="${d}" stroke="${col}" stroke-width="${f(w * k)}" opacity="${f(0.04 + i * 0.02)}"/>`;
  }).join("");

/* SVG знака. Классы rs-flare / rs-pulse оживляет CSS шапки (styles.css), в картинках они невидимы */
export function signSVG(o = SIGN.logo, id = "rs") {
  const { radii, width } = o;
  const r0 = f(radii[0] - width),
    r1 = f(radii[radii.length - 1] + width),
    w = width * 2;
  const waves = radii
    .map((r, i) => {
      const k = f(1 - i * o.fade),
        d = arcs(r);
      return (
        `<g opacity="${k}">` +
        glow(d, w, "#ff5a10") +
        `<path d="${d}" stroke="#ff7a1c" stroke-width="${f(w)}"/>` +
        `<path d="${d}" stroke="#ffb65a" stroke-width="${f(w * 0.5)}"/>` +
        `<path d="${d}" stroke="#fff0cf" stroke-width="${f(w * 0.17)}"/></g>` +
        `<g class="rs-flare rs-f${i + 1}" opacity="0">${glow(d, w * 1.2, "#ffa040")}` +
        `<path d="${d}" stroke="#fff6e0" stroke-width="${f(w * 0.6)}"/></g>`
      );
    })
    .join("");
  return (
    `<svg class="rad-sign" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<defs><radialGradient id="${id}-core"><stop offset="0" stop-color="#ff4628" stop-opacity=".36"/>` +
    `<stop offset="1" stop-color="#ff2814" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}-ember" gradientUnits="userSpaceOnUse" cx="50" cy="50" r="${r1}">` +
    `<stop offset="${f(r0 / r1)}" stop-color="#8c2406" stop-opacity=".75"/><stop offset="1" stop-color="#501204" stop-opacity=".6"/></radialGradient>` +
    `</defs>` +
    `<circle cx="50" cy="50" r="36" fill="url(#${id}-core)"/>` +
    `<path d="${sectors(r0, r1)}" fill="url(#${id}-ember)"/>` +
    `<g fill="none">${waves}` +
    `<circle class="rs-pulse" cx="50" cy="50" r="48" stroke="#ffb060" stroke-width="1.6" opacity="0"/>` +
    `<circle class="rs-pulse rs-p2" cx="50" cy="50" r="48" stroke="#ffb060" stroke-width="1.2" opacity="0"/></g></svg>`
  );
}
