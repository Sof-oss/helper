/* Знак радиации логотипа: цельные лопасти с неоновой кромкой и гравировкой, вокруг - кольцо со шкалой, как у дозиметра.
   r0/r1 - внутренний и внешний радиус лопастей, edge - толщина кромки, engrave - радиусы гравировки, ring - кольцо */
export const SIGN = {
  logo: { r0: 24, r1: 45.5, edge: 1.6, engrave: [31, 38.5], ring: { r: 49.2, w: 1.4, scale: 47.3 } },
  /* favicon и мелкие иконки: без кольца и гравировки, кромка толще - читается и в 16 px */
  small: { r0: 22, r1: 47, edge: 2.6, engrave: [], ring: null }
};
/* лопасти по 60° с центрами на 30°, 150° и 270° (y вверх); в SVG y вниз */
const BLADES = [-30, -150, 90];
const f = n => +n.toFixed(2);
const pt = (r, deg) => [f(50 + r * Math.cos((deg * Math.PI) / 180)), f(50 + r * Math.sin((deg * Math.PI) / 180))];
const arcs = (r, half) =>
  BLADES.map(a => {
    const [x1, y1] = pt(r, a - half),
      [x2, y2] = pt(r, a + half);
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
const ring = r => `M${f(50 - r)} 50a${r} ${r} 0 1 0 ${f(2 * r)} 0a${r} ${r} 0 1 0 ${f(-2 * r)} 0`;

/* свечение - стопка широких полупрозрачных обводок (без SVG-фильтров: они одинаково выглядят везде и дёшевы в анимации) */
const glow = (d, w, col, n = 6) =>
  Array.from({ length: n }, (_, i) => {
    const k = 3 - i * 0.36; // от широкой и прозрачной к узкой и плотной - мягкий, без ступенек ореол
    return `<path d="${d}" stroke="${col}" stroke-width="${f(w * k)}" opacity="${f(0.05 + i * 0.025)}"/>`;
  }).join("");
/* неоновая линия: ореол, цветная середина и светлая сердцевина */
const neon = (d, w, extra = "") =>
  glow(d, w, "#ff6a14") +
  `<path d="${d}" stroke="#ff8a2a" stroke-width="${f(w)}"${extra}/>` +
  `<path d="${d}" stroke="#ffd29a" stroke-width="${f(w * 0.3)}"${extra}/>`;

/* SVG знака. Классы rs-* оживляет CSS шапки (styles.css, удар сердца): rs-heat - накал лопастей, rs-f1..rs-f3 - вспышки
   гравировки и кромки по очереди изнутри наружу, rs-ring - вспышка кольца, rs-pulse - волна от сердца к кольцу.
   В картинках (иконки, превью) всё это невидимо: у вспышек opacity="0" */
export function signSVG(o = SIGN.logo, id = "rs") {
  const { r0, r1, edge, engrave, ring: rg } = o;
  const blades = sectors(r0, r1);
  const eng = engrave.map((r, i) => arcs(r, 25 + i * 1.5));
  let s =
    `<svg class="rad-sign" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<defs><radialGradient id="${id}-core"><stop offset="0" stop-color="#ff4628" stop-opacity=".45"/>` +
    `<stop offset="1" stop-color="#ff2814" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}-ember" gradientUnits="userSpaceOnUse" cx="50" cy="50" r="${r1}">` +
    `<stop offset="${f(r0 / r1)}" stop-color="#7a1c05"/><stop offset="1" stop-color="#2a0903"/></radialGradient>` +
    `<radialGradient id="${id}-heat" gradientUnits="userSpaceOnUse" cx="50" cy="50" r="${r1}">` +
    `<stop offset="${f(r0 / r1)}" stop-color="#ff7a1c" stop-opacity=".55"/><stop offset="1" stop-color="#ff3a0a" stop-opacity=".1"/></radialGradient>` +
    `</defs>` +
    `<circle cx="50" cy="50" r="38" fill="url(#${id}-core)"/>` +
    `<path d="${blades}" fill="url(#${id}-ember)"/>` +
    `<path class="rs-heat" d="${blades}" fill="url(#${id}-heat)" opacity="0"/>` +
    `<g fill="none" stroke-linejoin="round" stroke-linecap="round">`;
  eng.forEach(d => (s += `<path d="${d}" stroke="#ffc27a" stroke-width=".7" opacity=".6"/>`));
  s += neon(blades, edge);
  if (rg)
    s +=
      neon(ring(rg.r), rg.w) +
      `<path d="${ring(rg.scale)}" stroke="#ffb060" stroke-width="1.1" stroke-dasharray=".9 1.6" opacity=".8"/>`;
  /* вспышки: гравировка (по очереди), потом кромка лопастей, потом кольцо */
  eng.forEach(
    (d, i) =>
      (s += `<g class="rs-flare rs-f${i + 1}" opacity="0">${glow(d, 1.4, "#ffa040", 4)}<path d="${d}" stroke="#fff6e0" stroke-width=".9"/></g>`)
  );
  s += `<g class="rs-flare rs-f3" opacity="0">${glow(blades, edge * 1.2, "#ffa040", 4)}<path d="${blades}" stroke="#fff6e0" stroke-width="${f(edge * 0.6)}"/></g>`;
  if (rg)
    s +=
      `<g class="rs-ring" opacity="0">${glow(ring(rg.r), rg.w * 1.3, "#ffa040", 4)}<path d="${ring(rg.r)}" stroke="#fff6e0" stroke-width="${f(rg.w * 0.7)}"/></g>` +
      `<circle class="rs-pulse" cx="50" cy="50" r="${rg.r}" stroke="#ffb060" stroke-width="1.6" opacity="0"/>` +
      `<circle class="rs-pulse rs-p2" cx="50" cy="50" r="${rg.r}" stroke="#ffb060" stroke-width="1.2" opacity="0"/>`;
  return s + `</g></svg>`;
}

/* кардиограмма под надписью логотипа: тусклая линия, по ней бежит яркая «комета» (три слоя - ореол, след и голова),
   а пик QRS вспыхивает в момент удара сердца (styles.css). Ширина - по надписи, поэтому preserveAspectRatio="none" */
const ECG = "M0 8H92l3-3 3 3h5l3 6 4-14 4 12 3-4H200";
const QRS = "M103 8l3 6 4-14 4 12 3-4";
export function ecgSVG() {
  return (
    `<svg class="logo-ecg" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true">` +
    `<g fill="none" stroke-linejoin="round" stroke-linecap="round">` +
    `<path class="ecg-line" d="${ECG}"/>` +
    [1, 2, 3].map(i => `<path class="ecg-run ecg-r${i}" pathLength="100" d="${ECG}"/>`).join("") +
    `<path class="ecg-qrs" d="${QRS}"/></g></svg>`
  );
}
