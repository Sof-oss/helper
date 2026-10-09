/* Тесты расчёта изменений Топ-100 (build-top100.js): npm test.
   Скрипт запускается целиком на временной папке с CSV и снимками истории, проверяется готовый top100-data.js */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "build-top100.js");
const DAY = 864e5;
const KEYS = ["talents", "defense", "expeditions", "collections", "stashes", "reputation", "bosses"];
const HEAD = [
  "№",
  "Ник",
  "Уровень",
  "Группировка",
  "Нет сигнала",
  "ID",
  "Таланты",
  "Защищено лагерей",
  "Завершено экспедиций",
  "Собрано коллекций",
  "Собрано тайников",
  "Репутация",
  "Убито боссов"
];

/* имя снимка по московскому времени, как его пишет скрипт */
const snapName = ms => {
  const d = new Date(ms + 3 * 3600e3);
  const z = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())}_${z(d.getUTCHours())}-${z(d.getUTCMinutes())}-${z(d.getUTCSeconds())}`;
};

/* строка игрока: все показатели равны value, кроме талантов */
const row = (n, nick, talents, value, extra = {}) =>
  [
    n,
    nick,
    30,
    extra.group || "-",
    extra.off || "нет",
    extra.id || "id" + n,
    talents,
    value,
    value,
    value,
    value,
    value,
    value
  ].join(";");

function setup(csvRows, snaps) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "top100-test-"));
  fs.writeFileSync(path.join(dir, "heart-of-the-zone-top100-all.csv"), [HEAD.join(";"), ...csvRows].join("\n") + "\n");
  fs.mkdirSync(path.join(dir, "history"));
  for (const [name, data] of Object.entries(snaps))
    fs.writeFileSync(path.join(dir, "history", name + ".json"), JSON.stringify(data));
  return dir;
}

function run(dir) {
  const out = path.join(dir, "top100-data.js");
  const log = execFileSync(process.execPath, [SCRIPT, dir, out], { encoding: "utf8" });
  const window = {};
  vm.runInNewContext(fs.readFileSync(out, "utf8"), { window });
  /* объекты из другого контекста vm: через JSON, чтобы deepEqual сравнивал по содержимому */
  return { window: JSON.parse(JSON.stringify(window)), log };
}

/* снимок: для каждого раздела одинаковый список ник -> [место, значение] */
const snapAll = (talents, other) => Object.fromEntries(KEYS.map(k => [k, k === "talents" ? talents : other]));

test("изменение места, прирост и новички за сутки; совпавшие периоды не дублируются", () => {
  const dir = setup(
    [
      row(1, "Альфа", "1 900", 50),
      row(2, "Бета", "1 800", 40),
      row(3, "Гамма", "1 700", 30),
      row(4, "Новичок", "10", 1)
    ],
    {
      [snapName(Date.now() - 2 * DAY)]: snapAll(
        { Бета: [1, 1750], Альфа: [2, 1500], Гамма: [3, 1700] },
        { Альфа: [1, 45], Бета: [2, 40], Гамма: [3, 30] }
      )
    }
  );
  const { window } = run(dir);
  /* единственный снимок годится и «с прошлого обновления», и «за сутки»: остаётся одна кнопка «За сутки» */
  assert.deepEqual(
    window.TOP100_PERIODS.map(p => p.key),
    ["d1"]
  );
  const ch = window.TOP100_CHANGES.d1;
  assert.equal(ch.rank.talents["Альфа"], 1); // поднялся со 2-го на 1-е
  assert.equal(ch.rank.talents["Бета"], -1);
  assert.equal(ch.rank.talents["Новичок"], null); // новый в списке
  assert.ok(!("Гамма" in ch.rank.talents)); // место то же - ключа нет
  assert.equal(ch.delta.talents["Альфа"], 400); // «1 900» с пробелом читается как число
  assert.equal(ch.delta.talents["Бета"], 50);
  assert.ok(!("Гамма" in ch.delta.talents)); // прирост 0 не пишется
  assert.equal(ch.delta.defense["Альфа"], 5);
  assert.ok(!("Новичок" in ch.delta.talents)); // у новичка прироста нет
  fs.rmSync(dir, { recursive: true });
});

test("ник с лишними пробелами в старом снимке узнаётся, прирост не теряется", () => {
  const dir = setup([row(1, "Сталкер Вася", 200, 5)], {
    [snapName(Date.now() - 2 * DAY)]: snapAll({ " Сталкер  Вася ": [1, 150] }, { " Сталкер  Вася ": [1, 5] })
  });
  const ch = run(dir).window.TOP100_CHANGES.d1;
  assert.equal(ch.delta.talents["Сталкер Вася"], 50);
  assert.ok(!("Сталкер Вася" in ch.rank.talents));
  fs.rmSync(dir, { recursive: true });
});

test("без истории периодов нет, снимок создаётся; повторный запуск без изменений снимок не дублирует", () => {
  const dir = setup([row(1, "Альфа", 100, 1), row(2, "Бета", 90, 1)], {});
  const first = run(dir);
  assert.deepEqual(first.window.TOP100_PERIODS, []);
  assert.equal(fs.readdirSync(path.join(dir, "history")).length, 1);
  assert.deepEqual(
    first.window.TOP100_TALENTS.slice(0, 2).map(r => r[0]),
    ["Альфа", "Бета"]
  );
  const second = run(dir);
  assert.match(second.log, /Данные не изменились/);
  assert.equal(fs.readdirSync(path.join(dir, "history")).length, 1);
  fs.rmSync(dir, { recursive: true });
});

test("неполный период: истории меньше недели - берётся самый ранний снимок с пометкой partial", () => {
  const now = Date.now();
  const dir = setup([row(1, "Альфа", 300, 1)], {
    [snapName(now - 3 * DAY)]: snapAll({ Альфа: [1, 100] }, { Альфа: [1, 1] }),
    [snapName(now - 2 * 3600e3)]: snapAll({ Альфа: [1, 250] }, { Альфа: [1, 1] })
  });
  const { window } = run(dir);
  const byKey = Object.fromEntries(window.TOP100_PERIODS.map(p => [p.key, p]));
  assert.ok(byKey.last && !byKey.last.partial);
  assert.equal(window.TOP100_CHANGES.last.delta.talents["Альфа"], 50);
  assert.ok(byKey.d1 && !byKey.d1.partial);
  assert.equal(window.TOP100_CHANGES.d1.delta.talents["Альфа"], 200);
  /* за неделю и за месяц база та же, что у «за сутки» - кнопки не дублируются */
  assert.ok(!byKey.d7 && !byKey.d30);
  fs.rmSync(dir, { recursive: true });
});
