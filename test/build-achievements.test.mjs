import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ZA = require("../achievements.js");
const BA = require("../build-achievements.js");

const SAMPLE_METRICS = ["reputation", "bosses", "stashes", "talents", "collections", "expeditions", "defense"];
const SAMPLE_BOSSES = [
  "Псевдогигант",
  "Кровосос",
  "Химера",
  "Контролёр",
  "Бюрер",
  "Полтергейст",
  "Зомбированный",
  "Псевдособака",
  "Снорк",
  "Плоть"
];

test("ZoneAchievements.formatOwnership: корректные проценты и количество в скобках", () => {
  const zero = ZA.formatOwnership(0, 2917);
  assert.equal(zero.pctText, "0%");
  assert.equal(zero.label, "0% игроков (0)");

  const tiny = ZA.formatOwnership(1, 2917);
  assert.equal(tiny.pctText, "<0,1%");
  assert.equal(tiny.label, "<0,1% игроков (1)");

  const rare = ZA.formatOwnership(9, 2917);
  assert.equal(rare.pctText, "0,3%");
  assert.equal(rare.label, "0,3% игроков (9)");

  const mid = ZA.formatOwnership(1406, 2917);
  assert.equal(mid.pctText, "48,2%");
  assert.equal(mid.label, "48,2% игроков (1 406)");

  const full = ZA.formatOwnership(2917, 2917);
  assert.equal(full.pctText, "100%");
  assert.equal(full.label, "100% игроков (2 917)");
});

test("computeAchievementsBoard: сортировка по очкам, статистика владельцев, лидеры и редчайшая награда", () => {
  const now = Date.UTC(2026, 10, 19);
  const d0 = now - 40 * 864e5;
  const playersData = {
    updated: "19.11.2026 12:00:00",
    metrics: SAMPLE_METRICS,
    bosses: SAMPLE_BOSSES,
    dates: [d0, now],
    factions: { Долг: "#e0574f", Свобода: "#5fd08a" },
    players: {
      101: {
        n: "Ветеран",
        g: "Долг",
        l: 30,
        z: "60 дней",
        v: [250000, 1200, 600, 120, 40, 250, 80],
        r: [3, 5, 12, 20, 15, 8, 40],
        b: [120, 110, 90, 80, 70, 60, 50, 40, 30, 20],
        gh: [[0, "Долг"]],
        s: []
      },
      202: {
        n: "Новичок",
        g: "",
        l: 6,
        z: "2 дня",
        v: [500, 2, 1, 0, 0, 1, 0],
        r: [null, null, null, null, null, null, null],
        b: [0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
        gh: [],
        s: []
      },
      303: {
        n: "Охотник",
        g: "Свобода",
        l: 22,
        z: "20 дней",
        v: [45000, 200, 120, 40, 10, 50, 15],
        r: [45, 30, 80, null, null, 70, null],
        b: [20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
        gh: [[0, "Свобода"]],
        s: []
      }
    }
  };

  const leaders = { 101: [1, "Долг"] };
  const board = BA.computeAchievementsBoard(playersData, leaders, 10);

  assert.equal(board.totalPlayers, 3);
  assert.equal(board.totalAchievements, ZA.DEFINITIONS.length);
  assert.equal(board.top.length, 3);

  assert.equal(board.top[0].id, "101");
  assert.equal(board.top[0].r, 1);
  assert.equal(board.top[1].id, "303");
  assert.equal(board.top[1].r, 2);
  assert.equal(board.top[2].id, "202");
  assert.equal(board.top[2].r, 3);
  assert.ok(board.top[0].pts > board.top[1].pts && board.top[1].pts > board.top[2].pts);

  assert.equal(board.ranks["101"], 1);
  assert.equal(board.ranks["303"], 2);
  assert.equal(board.ranks["202"], 3);

  /* лидерство выдано только игроку 101 */
  assert.equal(board.stats["fac-leader-now"], 1);
  /* уровень 5 есть у всех троих (6, 22, 30) */
  assert.equal(board.stats["lvl-5"], 3);
  /* самое редкое из открытых - ровно 1 владелец */
  assert.ok(board.rarest);
  assert.equal(board.rarest.count, 1);

  assert.deepEqual(board.factions, { Долг: 1, Свобода: 1 });

  /* пререндер HTML содержит ссылки на карточку с вкладкой достижений и без длинных тире */
  const statsHtml = BA.renderHeroStats(board);
  const rowsHtml = BA.renderTopRows(board);
  assert.match(statsHtml, /data-pc-open="101" data-pc-open-tab="achievements"/);
  assert.match(statsHtml, /data-achp-jump="/);
  assert.doesNotMatch(statsHtml, /В базе/);
  assert.match(rowsHtml, /data-pc-open="303" data-pc-open-tab="achievements"/);
  assert.doesNotMatch(statsHtml + rowsHtml, /\u2014/);
});
