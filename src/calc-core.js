/* Ядро калькулятора без DOM: данные снаряжения, формулы базового урона, уровень и ссылка на билд. */
import { TALENTS } from "../talents.js";
import { SETS, ITEMS } from "./gear-data.js";
import { BASE_DAMAGE_LEVEL0, ARENA_COEF_PERCENT } from "./arena-data.js";

export { SETS, ITEMS };

export const ALL_ITEMS = [...SETS.flatMap(s => s.items), ...ITEMS];
export const ITEM_BY_CODE = Object.fromEntries(ALL_ITEMS.map(i => [i.code, i]));
/* старые одиночные вещи: индексы прежнего ITEMS - для чтения старых ссылок и localStorage */
const LEGACY_STANDALONE = ["JACKET_003", "JACKET_008", "JACKET_009", "JACKET_011"];

export const MIN_LEVEL = 1,
  MAX_LEVEL = 100,
  MAX_RANK = 5;

/* уровень персонажа: целое 1–100; дробное округляется, мусор и пустое - 1 */
export function clampLevel(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return MIN_LEVEL;
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, n));
}
/* сумма характеристик арены: целое неотрицательное число, без верхнего предела */
export function clampArena(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}
/* бонусы к урону: floor(базовый урон 0 уровня × очки × 0.05 / 100) для каждого оружия */
export function arenaBonus(points) {
  const p = clampArena(points),
    share = (p * ARENA_COEF_PERCENT) / 100;
  return {
    knife: Math.floor(BASE_DAMAGE_LEVEL0.knife * share),
    pistol: Math.floor(BASE_DAMAGE_LEVEL0.pistol * share),
    auto: Math.floor(BASE_DAMAGE_LEVEL0.auto * share),
    grenade: Math.floor(BASE_DAMAGE_LEVEL0.grenade * share),
    gl: Math.floor(BASE_DAMAGE_LEVEL0.gl * share),
    gauss: Math.floor(BASE_DAMAGE_LEVEL0.gauss * share)
  };
}

/* базовый урон растёт на 2% за уровень от значения на 0 уровне, округление в конце. */
export const freeBase = (atLevel0, level) => Math.round(atLevel0 * Math.pow(1.02, level));
export function baseDamageByLevel(level) {
  const out = {};
  for (const k in BASE_DAMAGE_LEVEL0) out[k] = freeBase(BASE_DAMAGE_LEVEL0[k], level);
  return out;
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

/* индекс вещи -> бит в маске. */
const itemIndex = new Map(ALL_ITEMS.map((it, i) => [it.code, i]));
export function gearToMask(gear) {
  let mask = 0;
  for (const code of gear || []) {
    const i = itemIndex.get(code);
    if (i != null) mask += 2 ** i;
  }
  return mask;
}
export function gearFromMask(mask) {
  const out = [];
  const n = Number(mask) || 0;
  for (let i = 0; i < ALL_ITEMS.length; i++) if (Math.floor(n / 2 ** i) % 2) out.push(ALL_ITEMS[i].code);
  return out;
}
export const toBits = s => [...s].reduce((a, i) => a | (1 << i), 0);

/* билд в ссылке: уровень, вещи (маска в base36), характеристики арены и таланты после # */
export function buildHashOf(b) {
  const p = new URLSearchParams();
  p.set("l", String(clampLevel(b.level)));
  p.set("g", gearToMask(b.gear).toString(36));
  p.set("a", String(clampArena(b.arena)));
  p.set("t", TALENTS.map(t => b.talents[t[0]] || 0).join(""));
  return p.toString();
}
/* разбор билда: новый формат g/a и старые ссылки s/i (комплекты/одиночные вещи) */
export function parseBuild(raw) {
  const p = new URLSearchParams(String(raw || "").replace(/^[^#]*#/, ""));
  if (!["l", "g", "a", "s", "i", "t"].some(k => p.has(k))) return null;
  let gear = [];
  if (p.has("g")) gear = gearFromMask(parseInt(p.get("g"), 36));
  else {
    const sm = parseInt(p.get("s"), 10) || 0,
      im = parseInt(p.get("i"), 10) || 0;
    SETS.forEach((s, i) => {
      if ((sm >> i) & 1) gear.push(...s.items.map(x => x.code));
    });
    LEGACY_STANDALONE.forEach((code, i) => {
      if ((im >> i) & 1) gear.push(code);
    });
  }
  const ts = p.get("t") || "";
  return {
    level: clampLevel(parseInt(p.get("l"), 10) || 1),
    gear: [...new Set(gear)].filter(code => ITEM_BY_CODE[code]),
    arena: clampArena(parseInt(p.get("a"), 10) || 0),
    talents: sanitizeTalents(Object.fromEntries(TALENTS.map((t, i) => [t[0], parseInt(ts[i], 10) || 0])))
  };
}
