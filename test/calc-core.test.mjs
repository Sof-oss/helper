/* Тесты ядра калькулятора: npm test (node --test) */
import test from "node:test";
import assert from "node:assert/strict";
import { TALENTS } from "../talents.js";
import {
  SETS,
  ITEMS,
  ALL_ITEMS,
  clampLevel,
  clampArena,
  arenaBonus,
  baseDamageByLevel,
  freeBase,
  toBits,
  buildHashOf,
  parseBuild,
  sanitizeTalents
} from "../src/calc-core.js";

test("уровень: целое 1–100", () => {
  assert.equal(clampLevel(12.5), 13);
  assert.equal(clampLevel("12.4"), 12);
  assert.equal(clampLevel(""), 1);
  assert.equal(clampLevel("abc"), 1);
  assert.equal(clampLevel(-5), 1);
  assert.equal(clampLevel(0), 1);
  assert.equal(clampLevel(999), 100);
  assert.equal(clampLevel("37"), 37);
});

test("базовый урон на 1 уровне совпадает с игрой", () => {
  assert.deepEqual(baseDamageByLevel(1), { grenade: 56, gl: 115, gauss: 367, knife: 47, pistol: 49, auto: 55 });
});

test("бесплатные удары растут на 2% за уровень", () => {
  assert.equal(freeBase(46, 1), 47);
  assert.equal(freeBase(46, 2), Math.round(46 * 1.02 * 1.02));
});

test("бесплатные удары совпадают с игрой на 24 и 25 уровне", () => {
  const b24 = baseDamageByLevel(24),
    b25 = baseDamageByLevel(25);
  assert.deepEqual([b24.knife, b24.pistol, b24.auto], [74, 77, 87]);
  /* замер в игре: билд #l=25&s=1023&i=15&t=505505505000010000000000000 - нож 143, пистолет 202, автомат 280 */
  assert.deepEqual([b25.knife, b25.pistol, b25.auto], [75, 79, 89]);
});

test("урон растёт с уровнем и не убывает", () => {
  let prev = baseDamageByLevel(1);
  for (let l = 2; l <= 100; l++) {
    const cur = baseDamageByLevel(l);
    for (const k of Object.keys(cur)) assert.ok(cur[k] >= prev[k], k + " на " + l + " уровне");
    prev = cur;
  }
});

test("ссылка на билд: туда и обратно", () => {
  const gear = ["HEAD_001", "JACKET_001", "PANTS_001", "JACKET_003", "JACKET_016"];
  const b = { level: 42, gear, arena: 250, talents: {} };
  b.talents[TALENTS[0][0]] = 5;
  const child = TALENTS.find(t => t[9].length === 1 && t[9][0] === TALENTS[0][0]);
  b.talents[child[0]] = 3;
  const back = parseBuild("https://heart-of-the-zone.ru/calculator#" + buildHashOf(b));
  assert.equal(back.level, 42);
  assert.deepEqual(back.gear.sort(), gear.sort());
  assert.equal(back.arena, 250);
  assert.deepEqual(back.talents, b.talents);
});

test("ссылка на билд: мусор и края", () => {
  assert.equal(parseBuild(""), null);
  assert.equal(parseBuild("https://heart-of-the-zone.ru/calculator"), null);
  assert.equal(parseBuild("#l=12.5").level, 12);
  assert.equal(parseBuild("#l=-3").level, 1);
  assert.equal(parseBuild("#l=500").level, 100);
  assert.equal(parseBuild("l=7&s=abc").gear.length, 0);
  assert.deepEqual(parseBuild("#t=9999").talents[TALENTS[0][0]], 5, "ранг выше 5 обрезается");
  assert.equal(parseBuild("#a=999").arena, 999);
  assert.equal(parseBuild("#a=-10").arena, 0);
});

test("старые ссылки с s/i читаются как вещи и новые бонусы", () => {
  const b = parseBuild("#l=25&s=1&i=1&t=0");
  assert.deepEqual(b.gear.sort(), ["HEAD_001", "JACKET_001", "JACKET_003", "PANTS_001"].sort());
  assert.equal(b.arena, 0);
  assert.equal(parseBuild("#l=25&s=1023").gear.length, 26, "все вещи первых 10 комплектов");
});

test("арена: бонусы по формуле", () => {
  assert.deepEqual(arenaBonus(0), { knife: 0, pistol: 0, auto: 0, grenade: 0, gl: 0, gauss: 0 });
  assert.deepEqual(arenaBonus(250), { knife: 5, pistol: 6, auto: 6, grenade: 6, gl: 14, gauss: 45 });
  assert.deepEqual(arenaBonus(500), { knife: 11, pistol: 12, auto: 13, grenade: 13, gl: 28, gauss: 90 });
  assert.deepEqual(arenaBonus(1000), { knife: 23, pistol: 24, auto: 26, grenade: 27, gl: 56, gauss: 180 });
  assert.equal(clampArena(900), 900);
  assert.equal(clampArena(-1), 0);
  assert.equal(clampArena(12.5), 13);
  assert.equal(clampArena("12.4"), 12);
  assert.equal(clampArena(""), 0);
  assert.equal(clampArena("abc"), 0);
});

test("новый ивентовый комплект и разбивка по вещам", () => {
  const set = SETS.find(s => s.code === "SET_012");
  assert.ok(set && set.isNew);
  assert.deepEqual(
    set.items.map(i => i.name),
    ["Хоккейная маска", "Потёртая куртка", "Старые джинсы"]
  );
  assert.equal(ALL_ITEMS.length, 36);
  assert.ok(ITEMS.every(i => !set.items.some(x => x.code === i.code)));
});

test("таланты без выполненных требований отбрасываются", () => {
  const child = TALENTS.find(t => t[9].length);
  const r = sanitizeTalents({ [child[0]]: 5 });
  assert.equal(r[child[0]], undefined);
  const ok = sanitizeTalents({ ...Object.fromEntries(child[9].map(q => [q, 5])), [child[0]]: 2 });
  // предки самого child тоже должны быть выполнены - проверяем только если они корневые
  if (child[9].every(q => !TALENTS.find(t => t[0] === q)[9].length)) assert.equal(ok[child[0]], 2);
});

test("сумма очков талантов не больше 135", () => {
  const all = sanitizeTalents(Object.fromEntries(TALENTS.map(t => [t[0], 99])));
  const sum = Object.values(all).reduce((a, b) => a + b, 0);
  assert.equal(sum, TALENTS.length * 5);
  assert.ok(sum <= 135);
});

test("toBits", () => {
  assert.equal(toBits(new Set([0, 2])), 5);
  assert.equal(toBits([]), 0);
});
