#!/usr/bin/env node
"use strict";
/* CSV из выгрузок рейтинга -> top100-data.js
 * Запуск: node build-top100.js [папка_с_csv] [путь_к_top100-data.js]
 * По умолчанию CSV берутся из ./top100, результат пишется в ./top100-data.js
 *
 * Кроме самих данных скрипт считает изменения с прошлого обновления:
 *  1. TOP100_DELTA — прирост метрики;
 *  2. TOP100_RANK  — изменение места.
 * Оба считаются по снимку прошлого запуска top100/history/<дата_время>.json,
 * который скрипт складывает сам (ник -> [место, значение]).
 * Если CSV не изменились с прошлого запуска, новый снимок не создаётся и сравнение идёт с тем, что было до него.
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

/* ---------- дата сборки по Москве ---------- */
const p = Object.fromEntries(new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
}).formatToParts(new Date()).map(x => [x.type, x.value]));
const stamp = `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}:${p.second}`;
const snapId = `${p.year}-${p.month}-${p.day}_${p.hour}-${p.minute}-${p.second}`;   // имя снимка этого запуска
const KEEP_SNAPSHOTS = 50;                                                           // старше удаляем (в git они остаются)

/* ---------- снимки запусков ----------
   Новые: 2026-10-04_12-30-17.json. Старые недельные (2026-W40.json) тоже читаем, они считаются самыми давними */
function readSnapshots() {
  if (!fs.existsSync(historyDir)) return [];
  const files = fs.readdirSync(historyDir).filter(f => /^(\d{4}-W\d{2}|\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.json$/.test(f));
  const weekly = files.filter(f => /-W\d{2}\.json$/.test(f)).sort();
  const timed = files.filter(f => !/-W\d{2}\.json$/.test(f)).sort();
  return weekly.concat(timed).map(f => ({ id: f.replace(".json", ""), data: JSON.parse(fs.readFileSync(path.join(historyDir, f), "utf8")) }));
}

/* старые снимки хранили только место числом, новые — [место, значение] */
function readEntry(v) {
  if (Array.isArray(v)) return { rank: v[0], value: v[1] };
  return { rank: v, value: undefined };
}

/* данные снимка совпадают с текущими (старый формат без значений за совпадение не считаем) */
function sameData(old, now) {
  const keys = Object.keys(now);
  if (!old || Object.keys(old).length !== keys.length) return false;
  return keys.every(k => {
    const a = old[k], b = now[k];
    if (!a) return false;
    const nicks = Object.keys(b);
    if (Object.keys(a).length !== nicks.length) return false;
    return nicks.every(n => Array.isArray(a[n]) && a[n][0] === b[n][0] && a[n][1] === b[n][1]);
  });
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

/* сравниваем со снимком прошлого запуска; если данные не менялись, берём тот, что был до него */
const snaps = readSnapshots();
const latest = snaps[snaps.length - 1] || null;
const unchanged = !!latest && sameData(latest.data, snapshot);
const previous = unchanged ? (snaps[snaps.length - 2] || null) : latest;
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

/* складываем снимок этого запуска (если данные те же, что в последнем снимке, не плодим дубли).
   Каждая запись в одну строку, чтобы git-diff читался */
fs.mkdirSync(historyDir, { recursive: true });
if (!unchanged) {
  const snapText = "{\n" + Object.keys(snapshot).map(k =>
    ` ${JSON.stringify(k)}: {\n` +
    Object.keys(snapshot[k]).map(n => `  ${JSON.stringify(n)}: ${JSON.stringify(snapshot[k][n])}`).join(",\n") +
    "\n }").join(",\n") + "\n}\n";
  fs.writeFileSync(path.join(historyDir, snapId + ".json"), snapText);
  /* храним последние KEEP_SNAPSHOTS снимков */
  const all = readSnapshots();
  all.slice(0, Math.max(0, all.length - KEEP_SNAPSHOTS)).forEach(sn => fs.unlinkSync(path.join(historyDir, sn.id + ".json")));
}

const header = "/* Топ-100: [ник, уровень, значение, покинул отряд (0/1)[, место]]. Место = индекс+1, если не указано пятым элементом */\n";
const notes =
  "/* TOP100_DELTA — прирост метрики с прошлого обновления (по снимку), null — не было данных */\n" +
  "/* TOP100_RANK  — изменение места с прошлого обновления: + поднялся, − опустился, null — новичок */\n";
fs.writeFileSync(outputFile,
  header +
  `window.TOP100_UPDATED=${JSON.stringify(stamp)};\n` +
  notes +
  `window.TOP100_DELTA=${JSON.stringify(compact(metricDeltas))};\n` +
  `window.TOP100_RANK=${JSON.stringify(compact(rankDeltas))};\n` +
  `window.TOP100_HISTORY=${JSON.stringify({ id: unchanged && latest ? latest.id : snapId, from: previous ? previous.id : null })}\n` +
  blocks.join("\n") + "\n");
console.log("Готово:", outputFile, "| дата:", stamp,
  "| сравнение с:", previous ? previous.id : "нет",
  "| смен мест:", rankChanges);
console.log("Приросты по разделам:", Object.entries(deltaSource).map(([k, v]) => k + "=" + v).join(", "));
if (unchanged) console.log("Данные не изменились с прошлого запуска, новый снимок не добавлен.");
if (!previous) console.log("Прошлого снимка нет: стрелки появятся после следующего обновления с новыми данными.");
