#!/usr/bin/env node
"use strict";
/* CSV из выгрузок рейтинга -> top100-data.js
 * Запуск: node build-top100.js [папка_с_csv] [путь_к_top100-data.js]
 * По умолчанию CSV берутся из ./top100, результат пишется в ./top100-data.js
 *
 * Кроме самих данных скрипт собирает недельные изменения:
 *  1. TOP100_DELTA — прирост метрики за неделю;
 *  2. TOP100_RANK  — изменение места.
 * Оба считаются по снимку прошлой недели top100/history/<год-Wнеделя>.json,
 * который скрипт складывает сам (ник -> [место, значение]).
 * Оба объекта: ник -> число (+ вверх, − вниз), null — новый в списке, нет ключа — данных нет. */
const fs = require("fs");
const path = require("path");

/* парсер CSV: кавычки, "" внутри поля, CRLF/LF, переносы в кавычках */
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* игнор */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ""));
}

const INACTIVE_MARK = "📡";

/* число из выгрузки: «1 839», «217 843», «+5 482» (обычные и неразрывные пробелы).
   Прочерк и пустое поле дают NaN, дальше такие значения пропускаем */
const toNumber = v => Number(String(v).replace(/[\s\u00A0\u202F]/g, ""));

/* Колонка «Δ» в выгрузках игры считается за разный срок: у репутации за последнее обновление,
   у боссов за несколько. Верим ей только там, где проверено, и только пока нет своего снимка со значениями */
const TRUSTED_CSV_DELTA = new Set(["reputation"]);

/* колонки: 0 место, 1 ник, 2 уровень, 3 значение, дальше «Δ Ур.» и «Δ <метрика>».
   Если место пропущено, настоящее сохраняем пятым элементом, чтобы нижние не сдвигались. */
function csvToRows(filePath) {
  const table = parseCsv(fs.readFileSync(filePath, "utf8"));
  const head = (table[0] || []).map(h => h.trim());
  const rows = table.slice(1);
  const metricDeltaIdx = head.length > 4 && /^Δ/i.test(head[head.length - 1]) ? head.length - 1 : -1;
  const metricDelta = {};
  const parsed = rows.map(([rank, nick, level, value, ...rest], i) => {
    const inactive = nick.startsWith(INACTIVE_MARK) ? 1 : 0;
    const cleanNick = inactive ? nick.slice(INACTIVE_MARK.length) : nick;
    if (metricDeltaIdx > 0) {
      const n = toNumber(rest[metricDeltaIdx - 4]);
      if (Number.isFinite(n)) metricDelta[cleanNick] = n;
    }
    const row = [cleanNick, toNumber(level), toNumber(value), inactive];
    if (toNumber(rank) !== i + 1) row.push(toNumber(rank));
    return row;
  });
  return { rows: parsed, metricDelta, hasDeltaColumn: metricDeltaIdx > 0 };
}

const SOURCES = [
  { file: "heart-of-the-zone-top100-talents.csv", varName: "TOP100_TALENTS", key: "talents" },
  { file: "heart-of-the-zone-top100-camp_defenses.csv", varName: "TOP100_DEFENSE", key: "defense" },
  { file: "heart-of-the-zone-top100-expeditions.csv", varName: "TOP100_EXPEDITIONS", key: "expeditions" },
  { file: "heart-of-the-zone-top100-collections.csv", varName: "TOP100_COLLECTIONS", key: "collections" },
  { file: "heart-of-the-zone-top100-stashes.csv", varName: "TOP100_STASHES", key: "stashes" },
  { file: "heart-of-the-zone-top100-reputation.csv", varName: "TOP100_REPUTATION", key: "reputation" },
  { file: "heart-of-the-zone-top100-bosses.csv", varName: "TOP100_BOSSES", key: "bosses" },
];

/* CSV лежат в top100/ рядом со скриптом */
const inputDir = process.argv[2] || path.join(__dirname, "top100");
const outputFile = process.argv[3] || path.join(process.cwd(), "top100-data.js");
const historyDir = path.join(inputDir, "history");

/* ---------- снимки по неделям ---------- */
/* ключ недели по Москве вида 2026-W40, неделя начинается с понедельника */
function weekKey(date) {
  const msk = new Date(date.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
  const d = new Date(Date.UTC(msk.getFullYear(), msk.getMonth(), msk.getDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // четверг этой недели
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
  const week = 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
  return d.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}
const thisWeek = weekKey(new Date());

function readSnapshots() {
  if (!fs.existsSync(historyDir)) return [];
  return fs.readdirSync(historyDir)
    .filter(f => /^\d{4}-W\d{2}\.json$/.test(f))
    .sort()
    .map(f => ({ week: f.replace(".json", ""), data: JSON.parse(fs.readFileSync(path.join(historyDir, f), "utf8")) }));
}

/* старые снимки хранили только место числом, новые — [место, значение] */
function readEntry(v) {
  if (Array.isArray(v)) return { rank: v[0], value: v[1] };
  return { rank: v, value: undefined };
}

/* ---------- данные ---------- */
const blocks = [];
const csvDeltas = {};
const metricDeltas = {};
const rankDeltas = {};
const snapshot = {};
let csvDeltaCategories = 0;
const current = {};   // ключ -> ник -> {rank, value}

for (const { file, varName, key } of SOURCES) {
  const filePath = path.join(inputDir, file);
  if (!fs.existsSync(filePath)) throw new Error("Не найден файл: " + filePath);
  const { rows, metricDelta, hasDeltaColumn } = csvToRows(filePath);
  if (hasDeltaColumn) csvDeltaCategories++;
  csvDeltas[key] = metricDelta;
  current[key] = {};
  snapshot[key] = {};
  rows.forEach((r, i) => {
    const rank = r[4] || i + 1;
    current[key][r[0]] = { rank, value: r[2] };
    snapshot[key][r[0]] = [rank, r[2]];
  });
  blocks.push(`window.${varName}=[\n${rows.map(r => JSON.stringify(r)).join(",\n")}\n];`);
}

/* сравниваем с ближайшим снимком предыдущей недели */
const previous = readSnapshots().filter(s => s.week < thisWeek).pop() || null;
let rankChanges = 0;
const deltaSource = {};   // для лога: откуда взяты приросты по разделу

for (const { key } of SOURCES) {
  const prev = (previous && previous.data && previous.data[key]) || null;
  const prevHasValues = !!prev && Object.values(prev).some(v => Array.isArray(v));
  const rankMoves = {};
  const valueMoves = {};

  for (const nick of Object.keys(current[key])) {
    const now = current[key][nick];
    if (prev) {
      const was = prev[nick] === undefined ? undefined : readEntry(prev[nick]);
      if (!was) rankMoves[nick] = null;                              // новичок в списке
      else if (was.rank !== now.rank) { rankMoves[nick] = was.rank - now.rank; rankChanges++; }
      if (prevHasValues && was && was.value !== undefined) valueMoves[nick] = now.value - was.value;
    }
  }

  if (prevHasValues) {
    metricDeltas[key] = valueMoves;
    deltaSource[key] = "снимок";
  } else if (TRUSTED_CSV_DELTA.has(key)) {
    metricDeltas[key] = csvDeltas[key];
    deltaSource[key] = "csv";
  } else {
    metricDeltas[key] = {};
    deltaSource[key] = "нет данных";
  }
  if (previous) rankDeltas[key] = rankMoves;
}

/* нули не пишем: отсутствие ключа = «без изменений» */
const compact = obj => {
  const out = {};
  for (const key of Object.keys(obj)) {
    const map = {};
    for (const nick of Object.keys(obj[key])) if (obj[key][nick] !== 0) map[nick] = obj[key][nick];
    out[key] = map;
  }
  return out;
};

/* складываем снимок текущей недели (повторный запуск в ту же неделю перезаписывает).
   Каждая запись в одну строку, чтобы git-diff читался */
fs.mkdirSync(historyDir, { recursive: true });
const snapText = "{\n" + Object.keys(snapshot).map(k =>
  ` ${JSON.stringify(k)}: {\n` +
  Object.keys(snapshot[k]).map(n => `  ${JSON.stringify(n)}: ${JSON.stringify(snapshot[k][n])}`).join(",\n") +
  "\n }").join(",\n") + "\n}\n";
fs.writeFileSync(path.join(historyDir, thisWeek + ".json"), snapText);

/* дата сборки по Москве, ДД.ММ.ГГГГ ЧЧ:ММ:СС */
const p = Object.fromEntries(new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
}).formatToParts(new Date()).map(x => [x.type, x.value]));
const stamp = `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}:${p.second}`;

const header = "/* Топ-100: [ник, уровень, значение, покинул отряд (0/1)[, место]]. Место = индекс+1, если не указано пятым элементом */\n";
const notes =
  "/* TOP100_DELTA — прирост метрики к прошлой неделе (по снимку), null — не было данных */\n" +
  "/* TOP100_RANK  — изменение места к прошлой неделе: + поднялся, − опустился, null — новичок */\n";
fs.writeFileSync(outputFile,
  header +
  `window.TOP100_UPDATED=${JSON.stringify(stamp)};\n` +
  notes +
  `window.TOP100_DELTA=${JSON.stringify(compact(metricDeltas))};\n` +
  `window.TOP100_RANK=${JSON.stringify(compact(rankDeltas))};\n` +
  `window.TOP100_HISTORY=${JSON.stringify({ week: thisWeek, from: previous ? previous.week : null })}\n` +
  blocks.join("\n") + "\n");
console.log("Готово:", outputFile, "| дата:", stamp,
  "| прошлый снимок:", previous ? previous.week : "нет",
  "| смен мест:", rankChanges);
console.log("Приросты по разделам:", Object.entries(deltaSource).map(([k, v]) => k + "=" + v).join(", "));
if (!previous) console.log("Прошлой недели в history нет: стрелки мест появятся после следующего запуска в новую неделю.");
