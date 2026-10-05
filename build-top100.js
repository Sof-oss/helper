#!/usr/bin/env node
"use strict";
/* CSV из выгрузок рейтинга -> top100-data.js
 * Запуск: node build-top100.js [папка_с_csv] [путь_к_top100-data.js]
 * По умолчанию CSV берутся из ./top100, результат пишется в ./top100-data.js
 *
 * Кроме самих данных скрипт считает изменения за несколько периодов (TOP100_PERIODS / TOP100_CHANGES):
 *  1. delta — прирост метрики;
 *  2. rank  — изменение места.
 * Периоды: с прошлого обновления, за 24 часа, за неделю, за месяц.
 * Считается по снимкам прошлых запусков top100/history/<дата_время>.json,
 * которые скрипт складывает сам (ник -> [место, значение]).
 * Для периода берётся самый свежий снимок, которому уже не меньше нужного срока.
 * Если истории не хватает, берём самый ранний снимок и помечаем период как неполный.
 * Если CSV не изменились с прошлого запуска, новый снимок не создаётся.
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
const MSK = 3 * 3600 * 1000;   // Москва без перехода на летнее время
const DAY = 864e5;
const nowMs = Date.now();
const mskParts = ms => Object.fromEntries(new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
}).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
const fmtStamp = ms => { const q = mskParts(ms); return `${q.day}.${q.month}.${q.year} ${q.hour}:${q.minute}:${q.second}`; };
const p = mskParts(nowMs);
const snapId = `${p.year}-${p.month}-${p.day}_${p.hour}-${p.minute}-${p.second}`;   // имя снимка этого запуска
const KEEP_SNAPSHOTS = 50;   // последние столько храним всегда
const KEEP_DAYS = 40;        // и всё, что моложе: этого хватает на период «месяц» (в git старое остаётся)

/* ---------- снимки запусков ----------
   Новые: 2026-10-04_12-30-17.json (время по Москве).
   Старые недельные (2026-W40.json) тоже читаем, они считаются самыми давними */
function readSnapshots() {
  if (!fs.existsSync(historyDir)) return [];
  const files = fs.readdirSync(historyDir).filter(f => /^(\d{4}-W\d{2}|\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.json$/.test(f));
  const weekly = files.filter(f => /-W\d{2}\.json$/.test(f)).sort();
  const timed = files.filter(f => !/-W\d{2}\.json$/.test(f)).sort();
  return weekly.concat(timed).map(f => ({ id: f.replace(".json", ""), data: JSON.parse(fs.readFileSync(path.join(historyDir, f), "utf8")) }));
}

/* момент снимка в мс по его имени; недельный снимок считаем понедельником той недели */
function snapTime(id) {
  let m = id.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - MSK;
  m = id.match(/^(\d{4})-W(\d{2})$/);
  const jan4 = new Date(Date.UTC(+m[1], 0, 4));
  const week1 = jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * DAY;
  return week1 + (+m[2] - 1) * 7 * DAY - MSK;
}

/* дата для подписи на сайте: ДД.ММ.ГГГГ ЧЧ:ММ (у недельного снимка времени нет, только дата) */
function fmtTime(id) {
  const d = new Date(snapTime(id) + MSK);
  const z = n => String(n).padStart(2, "0");
  const date = `${z(d.getUTCDate())}.${z(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
  return /-W\d{2}$/.test(id) ? date : `${date} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}`;
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
const snapshot = {};
const current = {};   // ключ -> ник -> {rank, value}

for (const { file, varName, key } of SOURCES) {
  const filePath = path.join(inputDir, file);
  if (!fs.existsSync(filePath)) throw new Error("Не найден файл: " + filePath);
  const { rows, metricDelta } = csvToRows(filePath);
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

/* если данные не менялись, последний снимок равен текущим данным и базой быть не может */
const snaps = readSnapshots();
const latest = snaps[snaps.length - 1] || null;
const unchanged = !!latest && sameData(latest.data, snapshot);
/* момент, к которому относятся данные: если CSV не менялись, это время последнего снимка, а не время запуска.
   Иначе повторный запуск сдвигал бы «Обновлено» и периоды, хотя рейтинг тот же */
const dataMs = unchanged ? snapTime(latest.id) : nowMs;
const stamp = fmtStamp(dataMs);
const previous = unchanged ? (snaps[snaps.length - 2] || null) : latest;
const older = (unchanged ? snaps.slice(0, -1) : snaps).slice().sort((a, b) => snapTime(a.id) - snapTime(b.id));

/* раздел не изменился ни в одной строке, хотя остальные обновились, — скорее всего, его CSV забыли выгрузить заново */
if (!unchanged && latest) {
  const same = SOURCES.filter(({ key }) => {
    const a = latest.data[key], b = snapshot[key];
    if (!a) return false;
    const nicks = Object.keys(b);
    return Object.keys(a).length === nicks.length && nicks.every(n => Array.isArray(a[n]) && a[n][0] === b[n][0] && a[n][1] === b[n][1]);
  });
  if (same.length && same.length < SOURCES.length) {
    console.warn("\n⚠ ВНИМАНИЕ: не изменились с прошлого обновления: " + same.map(x => x.file).join(", "));
    console.warn("  Остальные разделы обновились. Проверьте, что эти CSV выгружены заново и лежат в папке top100 под этими именами.\n");
  }
}

/* сравнение раздела со снимком base: изменение места и прирост значения.
   useCsv — разрешить запасной прирост из CSV, когда в снимке нет значений (только для «с прошлого обновления») */
function compareWith(base, key, useCsv) {
  const prev = (base && base.data && base.data[key]) || null;
  const hasValues = !!prev && Object.values(prev).some(v => Array.isArray(v));
  const rank = {};
  const delta = {};
  let moves = 0;
  let source = "нет данных";
  if (prev) {
    for (const nick of Object.keys(current[key])) {
      const now = current[key][nick];
      const was = prev[nick] === undefined ? undefined : readEntry(prev[nick]);
      if (!was) rank[nick] = null;                                   // новичок в списке
      else if (was.rank !== now.rank) { rank[nick] = was.rank - now.rank; moves++; }
      if (hasValues && was && was.value !== undefined) delta[nick] = now.value - was.value;
    }
  }
  if (hasValues) { source = "снимок"; return { rank, delta, moves, source }; }
  if (useCsv && TRUSTED_CSV_DELTA.has(key)) return { rank, delta: csvDeltas[key], moves, source: "csv" };
  return { rank, delta: {}, moves, source };
}

/* нули не пишем: отсутствие ключа = «без изменений» */
const compactMap = map => {
  const out = {};
  for (const nick of Object.keys(map)) if (map[nick] !== 0) out[nick] = map[nick];
  return out;
};

/* ---------- периоды ----------
   last — с прошлого обновления, остальные — за срок ms.
   Период, у которого база совпала с уже добавленным, пропускаем: кнопка была бы дублем */
const PERIODS = [
  { key: "last", label: "С прошлого обновления" },
  { key: "d1", label: "За 24 часа", ms: DAY },
  { key: "d7", label: "За неделю", ms: 7 * DAY },
  { key: "d30", label: "За месяц", ms: 30 * DAY },
];

const periods = [];
const changes = {};
const usedBases = new Set();

for (const per of PERIODS) {
  let base = null, partial = false;
  if (per.key === "last") base = previous;
  else if (older.length) {
    const target = dataMs - per.ms;
    for (const sn of older) if (snapTime(sn.id) <= target) base = sn;   // самый свежий из достаточно старых
    if (!base) { base = older[0]; partial = true; }                      // истории не хватает
  }
  if (base && usedBases.has(base.id)) continue;

  const delta = {}, rank = {};
  let moves = 0;
  const src = [];
  for (const { key } of SOURCES) {
    const r = compareWith(base, key, per.key === "last");
    delta[key] = compactMap(r.delta);
    rank[key] = compactMap(r.rank);
    moves += r.moves;
    src.push(key + "=" + r.source);
  }
  /* без базы период бывает только у «с прошлого обновления»: тогда в нём одни приросты репутации из CSV */
  if (!base && !Object.values(delta).some(m => Object.keys(m).length)) continue;

  if (base) usedBases.add(base.id);
  periods.push({ key: per.key, label: per.label, from: base ? fmtTime(base.id) : null, partial });
  changes[per.key] = { delta, rank };
  console.log(`Период «${per.label}»:`, base ? "с " + base.id : "по данным игры", partial ? "(неполный)" : "",
    "| смен мест:", moves, "| приросты:", src.join(", "));
}

/* складываем снимок этого запуска (если данные те же, что в последнем снимке, не плодим дубли).
   Каждая запись в одну строку, чтобы git-diff читался */
fs.mkdirSync(historyDir, { recursive: true });
if (!unchanged) {
  const snapText = "{\n" + Object.keys(snapshot).map(k =>
    ` ${JSON.stringify(k)}: {\n` +
    Object.keys(snapshot[k]).map(n => `  ${JSON.stringify(n)}: ${JSON.stringify(snapshot[k][n])}`).join(",\n") +
    "\n }").join(",\n") + "\n}\n";
  fs.writeFileSync(path.join(historyDir, snapId + ".json"), snapText);
  /* чистим только то, что и за пределами последних KEEP_SNAPSHOTS, и старше KEEP_DAYS */
  const all = readSnapshots();
  const cutoff = nowMs - KEEP_DAYS * DAY;
  all.slice(0, Math.max(0, all.length - KEEP_SNAPSHOTS))
    .filter(sn => snapTime(sn.id) < cutoff)
    .forEach(sn => fs.unlinkSync(path.join(historyDir, sn.id + ".json")));
}

const header = "/* Топ-100: [ник, уровень, значение, покинул отряд (0/1)[, место]]. Место = индекс+1, если не указано пятым элементом */\n";
const notes =
  "/* TOP100_PERIODS — периоды изменений для переключателя: ключ, подпись, с какого момента считаем, неполный ли период */\n" +
  "/* TOP100_CHANGES — по ключу периода: delta (прирост метрики) и rank (изменение места: + поднялся, − опустился, null — новичок) */\n";
fs.writeFileSync(outputFile,
  header +
  `window.TOP100_UPDATED=${JSON.stringify(stamp)};\n` +
  notes +
  `window.TOP100_PERIODS=${JSON.stringify(periods)};\n` +
  `window.TOP100_CHANGES={\n${periods.map(per => ` ${JSON.stringify(per.key)}:${JSON.stringify(changes[per.key])}`).join(",\n")}\n};\n` +
  `window.TOP100_HISTORY=${JSON.stringify({ id: unchanged && latest ? latest.id : snapId, from: previous ? previous.id : null })}\n` +
  blocks.join("\n") + "\n");
console.log("Готово:", outputFile, "| дата:", stamp, "| периодов:", periods.map(per => per.key).join(", ") || "нет");
if (unchanged) console.log("Данные не изменились с прошлого запуска, новый снимок не добавлен.");
if (!previous) console.log("Прошлого снимка нет: стрелки появятся после следующего обновления с новыми данными.");
