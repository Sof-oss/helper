/* Ядро калькулятора без DOM: данные снаряжения, формулы базового урона, уровень и ссылка на билд.
   Импортируется app.js (собирается в calculator.js) и тестами (test/calc-core.test.mjs) */
import { TALENTS } from "../talents.js";

export const SETS = [
  { name: "Первый день в зоне", bonuses: { knife: 5, pistol: 5, auto: 5 } },
  { name: "Любитель прогулок", bonuses: { grenade: 6, gl: 11, gauss: 36 } },
  { name: "Марафонец", bonuses: { knife: 9, pistol: 10, auto: 11 } },
  { name: "Полевой", bonuses: { grenade: 16, gl: 34, gauss: 108 } },
  { name: "Болотник", bonuses: { knife: 14, pistol: 14, auto: 16 } },
  { name: "Омон", bonuses: { grenade: 30, gl: 62, gauss: 198 } },
  { name: "КХК-01", bonuses: { grenade: 41, gl: 85, gauss: 270 }, critGaussChance: 0.01, critGaussDamage: 100 },
  { name: "Рубеж-М", bonuses: { grenade: 50, gl: 102, gauss: 324 }, critChance: 0.02, critDamage: 50 },
  { name: "Научный сотрудник", bonuses: { knife: 18, pistol: 19, auto: 22 } },
  { name: "Копатель", bonuses: { grenade: 22, gl: 45, gauss: 144 }, critGrenadeChance: 0.01, critGrenadeDamage: 75 },
  { name: "Жестянка", bonuses: { grenade: 60, gl: 124, gauss: 396 }, critChance: 0.03, critDamage: 75 }
];
export const ITEMS = [
  { name: "Футболка «Сердце Зоны»", bonuses: { grenade: 1, gl: 2, gauss: 7 } },
  { name: "Кожаная куртка", bonuses: { grenade: 3, gl: 7, gauss: 22 } },
  { name: "Бандитский плащ", bonuses: { grenade: 2, gl: 5, gauss: 14 } },
  { name: "Комбинезон «Рассвет»", bonuses: { knife: 12, pistol: 12, auto: 14 }, cooldown: 0.03, freeNoCooldown: 0.01 }
];
export const MIN_LEVEL = 1,
  MAX_LEVEL = 100,
  MAX_RANK = 5;

/* уровень персонажа: целое 1–100; дробное округляется, мусор и пустое — 1 */
export function clampLevel(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return MIN_LEVEL;
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, n));
}

/* бесплатные удары растут на 2% за уровень от значения на 1 уровне (47/49/55), подтверждено замерами на 1 и 24 уровне */
export const freeBase = (atLevel1, level) => Math.round(atLevel1 * Math.pow(1.02, level - 1));
export function baseDamageByLevel(level) {
  return {
    grenade: Math.round(55 * Math.pow(1.02, level)),
    gl: Math.round(113 * Math.pow(1.02, level)),
    gauss: Math.round(360 * Math.pow(1.02, level)),
    knife: freeBase(47, level),
    pistol: freeBase(49, level),
    auto: freeBase(55, level)
  };
}

/* ранги талантов: только известные таланты, целые 0–5, и только если требования (предки на 5/5) выполнены */
export function sanitizeTalents(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  TALENTS.forEach(t => {
    const r = Math.max(0, Math.min(MAX_RANK, Math.floor(Number(raw[t[0]]) || 0)));
    if (r && t[9].every(q => (out[q] || 0) >= MAX_RANK)) out[t[0]] = r;
  });
  return out;
}

/* билд в ссылке: уровень, снаряжение и таланты после # */
export const toBits = s => [...s].reduce((a, i) => a | (1 << i), 0);
export function buildHashOf(b) {
  const p = new URLSearchParams();
  p.set("l", String(clampLevel(b.level)));
  p.set("s", String(toBits(b.sets)));
  p.set("i", String(toBits(b.items)));
  p.set("t", TALENTS.map(t => b.talents[t[0]] || 0).join(""));
  return p.toString();
}
/* разбор билда: принимает ссылку целиком, хвост после # или просто l=..&s=..; ранги без выполненных требований отбрасываются */
export function parseBuild(raw) {
  const p = new URLSearchParams(String(raw || "").replace(/^[^#]*#/, ""));
  if (!["l", "s", "i", "t"].some(k => p.has(k))) return null;
  const sm = parseInt(p.get("s"), 10) || 0,
    im = parseInt(p.get("i"), 10) || 0,
    ts = p.get("t") || "";
  const b = { level: clampLevel(parseInt(p.get("l"), 10) || 1), sets: [], items: [], talents: {} };
  SETS.forEach((_, i) => {
    if ((sm >> i) & 1) b.sets.push(i);
  });
  ITEMS.forEach((_, i) => {
    if ((im >> i) & 1) b.items.push(i);
  });
  b.talents = sanitizeTalents(Object.fromEntries(TALENTS.map((t, i) => [t[0], parseInt(ts[i], 10) || 0])));
  return b;
}
