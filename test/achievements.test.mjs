/* Тесты системы достижений (achievements.js): каталог, расчёт статусов, очков, группировок и значков. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ZA from "../achievements.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const METRICS = ["talents", "defense", "expeditions", "collections", "stashes", "reputation", "bosses"];
const BOSSES = ["Альфа-пёс", "Болотная тварь", "Боров", "Излом", "Крыса", "Упырь"];

test("каталог достижений: уникальные id, картинки, непустые поля и рост очков по сложности", () => {
  assert.ok(ZA.DEFINITIONS.length >= 60, "в каталоге должно быть не меньше 60 достижений");
  const ids = new Set();
  const icons = new Set();
  const bySeries = new Map();

  for (const def of ZA.DEFINITIONS) {
    assert.ok(def.id && !ids.has(def.id), "дублирующийся id: " + def.id);
    ids.add(def.id);
    assert.ok(def.name && def.desc, "нужны название и описание для " + def.id);
    assert.ok(def.points > 0, "очки должны быть положительными для " + def.id);
    assert.ok(ZA.RARITIES[def.rarity], "неизвестная редкость у " + def.id);
    assert.ok(def.icon && !icons.has(def.icon), "у каждого достижения своя картинка/иконка: " + def.id);
    icons.add(def.icon);

    if (def.bossImg) {
      assert.ok(fs.existsSync(path.join(ROOT, def.bossImg.slice(1))), "файл босса должен существовать: " + def.bossImg);
    } else {
      assert.ok(ZA.GLYPHS[def.icon], "должен быть SVG-глиф для " + def.icon);
    }

    if (def.series) {
      if (!bySeries.has(def.series)) bySeries.set(def.series, []);
      bySeries.get(def.series).push(def);
    }
  }

  for (const [series, list] of bySeries) {
    list.sort((a, b) => a.tier - b.tier);
    for (let i = 1; i < list.length; i++) {
      assert.ok(
        list[i].points > list[i - 1].points,
        `серия ${series}: более сложный уровень ${list[i].id} (${list[i].points}) должен давать больше очков, чем ${list[i - 1].id} (${list[i - 1].points})`
      );
    }
  }
});

test("parseZoneDays: корректно разбирает дни, месяцы и годы", () => {
  assert.equal(ZA.parseZoneDays(""), 0);
  assert.equal(ZA.parseZoneDays("0 дней"), 0);
  assert.equal(ZA.parseZoneDays("1 день"), 1);
  assert.equal(ZA.parseZoneDays("14 дней"), 14);
  assert.equal(ZA.parseZoneDays("1 месяц"), 30);
  assert.equal(ZA.parseZoneDays("6 месяцев"), 180);
  assert.equal(ZA.parseZoneDays("1 год"), 365);
  assert.equal(ZA.parseZoneDays("1 год 2 месяца 5 дней"), 430);
});

test("analyzeFactions: вступление, выход, смены, срок в одной группировке и лидерство", () => {
  const day = 864e5;
  const t0 = Date.UTC(2026, 9, 1);
  const dates = [t0, t0 + 10 * day, t0 + 12 * day, t0 + 47 * day];
  const player = {
    g: "Долг",
    gh: [
      [0, "Свобода"],
      [1, ""],
      [2, "Долг"]
    ]
  };
  const f = ZA.analyzeFactions(player, dates, [1, "Долг"]);
  assert.equal(f.inFactionNow, true);
  assert.equal(f.everInFaction, true);
  assert.equal(f.everLeft, true);
  assert.equal(f.factionChanges, 1);
  assert.equal(f.maxStayDays, 35);
  assert.equal(f.isCurrentLeader, true);
  assert.equal(f.everLeader, true);

  const exLeader = ZA.analyzeFactions(
    {
      g: "",
      gh: [
        [0, "Свобода"],
        [1, ""]
      ]
    },
    dates,
    [0, "Свобода"]
  );
  assert.equal(exLeader.isCurrentLeader, false);
  assert.equal(exLeader.everLeader, true);
  assert.equal(exLeader.everLeft, true);

  /* частая смена группировок: 3 смены в пределах 30 дней открывают «Перекати-поле», а разнесённые по времени - нет */
  const rapidDates = [t0, t0 + 5 * day, t0 + 12 * day, t0 + 20 * day];
  const rapidPlayer = {
    g: "Учёные",
    gh: [
      [0, "Долг"],
      [1, "Свобода"],
      [2, "Наёмники"],
      [3, "Учёные"]
    ]
  };
  const rapidFac = ZA.analyzeFactions(rapidPlayer, rapidDates, null);
  assert.equal(rapidFac.factionChanges, 3);
  assert.equal(rapidFac.maxSwitchesIn30d, 3);
  const rapidEval = ZA.evaluate(rapidPlayer, { metrics: METRICS, bosses: BOSSES, dates: rapidDates });
  const rapidById = Object.fromEntries(rapidEval.items.map(x => [x.id, x]));
  assert.equal(rapidById["fac-frequent"].status, "unlocked");

  const slowDates = [t0, t0 + 10 * day, t0 + 50 * day, t0 + 95 * day];
  const slowFac = ZA.analyzeFactions(rapidPlayer, slowDates, null);
  assert.equal(slowFac.factionChanges, 3);
  assert.equal(slowFac.maxSwitchesIn30d, 1);
  const slowEval = ZA.evaluate(rapidPlayer, { metrics: METRICS, bosses: BOSSES, dates: slowDates });
  const slowById = Object.fromEntries(slowEval.items.map(x => [x.id, x]));
  assert.equal(slowById["fac-frequent"].status, "in_progress");
  assert.equal(slowById["fac-frequent"].current, 1);
});

test("evaluate: разделение на unlocked / in_progress / locked, цепочки серий и очки", () => {
  const day = 864e5;
  const t0 = Date.UTC(2026, 9, 1);
  const dates = [t0, t0 + 20 * day];
  const player = {
    n: "Сталкер",
    g: "Долг",
    z: "2 месяца",
    l: 12,
    v: [19, 3, 9, 1, 876, 16280, 395],
    b: [67, 0, 14, 0, 314, 0],
    r: [87, 396, 337, 285, 238, 280, 146],
    gh: [[0, "Долг"]],
    nh: []
  };

  const res = ZA.evaluate(player, { metrics: METRICS, bosses: BOSSES, dates, leaderInfo: null });
  const byId = Object.fromEntries(res.items.map(x => [x.id, x]));

  /* уровень 12: 5 и 10 получены, 20 - в процессе (следующая ступень), 25 и 30 - не получены */
  assert.equal(byId["lvl-5"].status, "unlocked");
  assert.equal(byId["lvl-10"].status, "unlocked");
  assert.equal(byId["lvl-20"].status, "in_progress");
  assert.equal(byId["lvl-20"].pct, 60);
  assert.equal(byId["lvl-25"].status, "locked");
  assert.equal(byId["lvl-30"].status, "locked");

  /* группировки: вступил, 20 дней -> 7 и 14 получены, 30 - в процессе, 90 и 180 - закрыты, не выходил, не лидер */
  assert.equal(byId["fac-join"].status, "unlocked");
  assert.equal(byId["fac-leave"].status, "locked");
  assert.equal(byId["fac-leader-now"].status, "locked");
  assert.equal(byId["fac-leader-ever"].status, "locked");
  assert.equal(byId["fac-stay-7"].status, "unlocked");
  assert.equal(byId["fac-stay-14"].status, "unlocked");
  assert.equal(byId["fac-stay-30"].status, "in_progress");
  assert.equal(byId["fac-stay-90"].status, "locked");

  /* боссы: Боров 14/15 -> в процессе (93%), Излом 0 -> не получено, Бестиарий 3/6 -> в процессе (50%) */
  assert.equal(byId["boar-15"].status, "in_progress");
  assert.equal(byId["boar-15"].pct, 93);
  assert.equal(byId["izlom-1"].status, "locked");
  assert.equal(byId["boss-all"].status, "in_progress");
  assert.equal(byId["boss-all"].pct, 50);

  /* рейтинги: лучший #87 -> rank-100 получен, rank-10 в процессе, rank-1 закрыт */
  assert.equal(byId["rank-100"].status, "unlocked");
  assert.equal(byId["rank-10"].status, "in_progress");
  assert.equal(byId["rank-1"].status, "locked");

  /* сводка консистентна */
  assert.equal(res.summary.unlocked + res.summary.inProgress + res.summary.locked, res.summary.total);
  const manualPts = res.items.filter(x => x.status === "unlocked").reduce((s, x) => s + x.points, 0);
  assert.equal(res.summary.earnedPoints, manualPts);
  assert.ok(res.summary.earnedPoints > 0 && res.summary.earnedPoints < res.summary.totalPoints);

  /* фильтрация и сортировка */
  const inProg = ZA.filterItems(res.items, "in_progress", "all");
  assert.equal(inProg.length, res.summary.inProgress);
  for (let i = 1; i < inProg.length; i++) {
    assert.ok(inProg[i - 1].pct >= inProg[i].pct, "достижения «В процессе» сортируются по убыванию процента");
  }
  const bossUnlocked = ZA.filterItems(res.items, "unlocked", "bosses");
  assert.ok(bossUnlocked.every(x => x.status === "unlocked" && x.category === "bosses"));

  /* badgeHtml рендерит и SVG, и портреты боссов */
  assert.match(ZA.badgeHtml(byId["lvl-5"]), /<svg /);
  assert.match(ZA.badgeHtml(byId["rat-50"]), /<img src="\/assets\/bosses\/rat-cut\.webp"/);
});
