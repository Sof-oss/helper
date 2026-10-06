#!/usr/bin/env node
"use strict";
/* Общая выгрузка рейтинга (один CSV) -> top100-data.js
 * Запуск: node build-top100.js [папка_с_csv] [путь_к_top100-data.js]
 * По умолчанию CSV берётся из ./top100/heart-of-the-zone-top100-all.csv, результат пишется в ./top100-data.js
 *
 * В CSV одна строка на игрока и все показатели сразу (разделитель «;» или «,», определяется сам).
 * Каждый раздел рейтинга получается сортировкой этих игроков по своей колонке.
 * Группировка берётся из колонки «Группировка» (а не из ника), «—» = без группировки.
 * Цвета группировок хранятся в top100/factions.json: новая группировка получает свой цвет автоматически
 * и сохраняет его между обновлениями. На сайт уходят только группировки, которые есть в текущем рейтинге,
 * поэтому плашка пропавшей группировки исчезает сама.
 *
 * Кроме самих данных скрипт считает изменения за несколько периодов (TOP100_PERIODS / TOP100_CHANGES):
 *  1. delta — прирост метрики;
 *  2. rank  — изменение места.
 * Периоды: с прошлого обновления, за 24 часа, за неделю, за месяц.
 * Считается по снимкам прошлых запусков top100/history/<дата_время>.json,
 * которые скрипт складывает сам (ник -> [место, значение]).
 * Для периода берётся самый свежий снимок, которому уже не меньше нужного срока.
 * Если истории не хватает, берём самый ранний снимок и помечаем период как неполный.
 * Если CSV не изменился с прошлого запуска, новый снимок не создаётся.
 * Оба объекта: ник -> число (+ вверх, − вниз), null — новый в списке, нет ключа — данных нет. */
const fs = require("fs");
const path = require("path");

/* парсер CSV (sep — разделитель): кавычки, "" внутри поля, CRLF/LF, переносы в кавычках */
function parseCsv(text, sep) {
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
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\r") { /* игнор */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ""));
}

/* число из выгрузки: «1 839», «217 843» (обычные и неразрывные пробелы).
   Прочерк и пустое поле дают NaN */
const toNumber = v => Number(String(v).replace(/[\s\u00A0\u202F]/g, ""));

const CSV_FILE = "heart-of-the-zone-top100-all.csv";
const NO_GROUP = new Set(["", "—", "-", "–"]);
let BOSS_COLS = [];   // виды боссов из CSV, заполняет readPlayers

/* разделы рейтинга: колонка общего CSV -> переменная в top100-data.js */
const SOURCES = [
  { column: "Таланты", varName: "TOP100_TALENTS", key: "talents" },
  { column: "Защищено лагерей", varName: "TOP100_DEFENSE", key: "defense" },
  { column: "Завершено экспедиций", varName: "TOP100_EXPEDITIONS", key: "expeditions" },
  { column: "Собрано коллекций", varName: "TOP100_COLLECTIONS", key: "collections" },
  { column: "Собрано тайников", varName: "TOP100_STASHES", key: "stashes" },
  { column: "Репутация", varName: "TOP100_REPUTATION", key: "reputation" },
  { column: "Убито боссов", varName: "TOP100_BOSSES", key: "bosses" },
];

/* общий CSV -> игроки {nick, level, group, inactive, order, values{колонка: число}} */
function readPlayers(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0];
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ";" : ",";
  const table = parseCsv(text, sep);
  const head = (table[0] || []).map(h => h.trim());
  const col = name => {
    const i = head.findIndex(h => h.toLowerCase() === name.toLowerCase());
    if (i < 0) throw new Error(`В ${path.basename(filePath)} нет колонки «${name}». Колонки: ${head.join(", ")}`);
    return i;
  };
  const iRank = col("№"), iNick = col("Ник"), iLevel = col("Уровень"), iGroup = col("Группировка"), iOff = col("Нет сигнала");
  /* для карточек игроков: ID, «В Зоне» и боссы по видам (колонки «Боссы: …»); если колонок нет, карточки без них */
  const opt = name => head.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const iId = opt("ID"), iZone = opt("В Зоне");
  const bossIdx = head.map((h, i) => [h, i]).filter(([h]) => /^Боссы:\s*/i.test(h)).map(([h, i]) => [h.replace(/^Боссы:\s*/i, ""), i]);
  BOSS_COLS = bossIdx.map(b => b[0]);
  const metricIdx = Object.fromEntries(SOURCES.map(s => [s.column, col(s.column)]));
  return table.slice(1).filter(r => r.length > 1 && String(r[iNick] || "").trim()).map((r, i) => {
    const group = String(r[iGroup] || "").trim();
    const values = {};
    for (const c of Object.keys(metricIdx)) values[c] = toNumber(r[metricIdx[c]]);
    const order = toNumber(r[iRank]);
    const bosses = {};
    for (const [b, bi] of bossIdx) bosses[b] = toNumber(r[bi]);
    return {
      id: iId >= 0 ? String(r[iId] || "").trim() : "",
      zone: iZone >= 0 ? String(r[iZone] || "").trim() : "",
      bosses,
      nick: r[iNick],
      level: toNumber(r[iLevel]),
      group: NO_GROUP.has(group) ? "" : group,
      inactive: /^(да|yes|1|true|\+)$/i.test(String(r[iOff] || "").trim()) ? 1 : 0,
      order: Number.isFinite(order) ? order : i + 1,
      values,
    };
  });
}

/* раздел: игроки по убыванию значения, при равенстве — в порядке общей выгрузки (по репутации).
   Строка: [ник, уровень, значение, давно не заходил (0/1)] */
/* в разделе только первые TOP_N: в CSV теперь все игроки (fetch-players.js), на сайт идёт топ по каждому показателю */
const TOP_N = Number(process.env.TOP_N) || 100;
function sectionRows(players, column) {
  return players
    .filter(pl => Number.isFinite(pl.values[column]) && pl.values[column] > 0)
    .sort((a, b) => b.values[column] - a.values[column] || a.order - b.order)
    .slice(0, TOP_N)
    .map(pl => [pl.nick, pl.level, pl.values[column], pl.inactive]);
}

/* ---------- цвета группировок ----------
   top100/factions.json: {"Группировка": "#rrggbb"}. Цвета можно править руками, скрипт их не трогает.
   Новой группировке подбирается оттенок, максимально далёкий от уже занятых */
const hexToHue = hex => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  const [r, g, b] = m.slice(1).map(x => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return null;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))).toString(16).padStart(2, "0");
  return "#" + f(0) + f(8) + f(4);
}
function pickColor(used) {
  const hues = used.map(hexToHue).filter(h => h !== null);
  const dist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  let best = 0, bestD = -1;
  for (let h = 0; h < 360; h += 5) {
    const d = hues.length ? Math.min(...hues.map(x => dist(x, h))) : 360;
    if (d > bestD) { bestD = d; best = h; }
  }
  /* когда оттенков много и они близки, чередуем яркость, чтобы соседние всё равно различались */
  const l = bestD < 20 && hues.length % 2 ? 72 : 62;
  return hslToHex(best, 62, l);
}
/* стартовые цвета: сняты с эмблем (вики S.T.A.L.K.E.R.) и осветлены под тёмный интерфейс */
const DEFAULT_FACTION_COLORS = {
  "Наёмники": "#5f8ac9",
  "Долг": "#d9483f",
  "Свобода": "#4fb058",
  "Учёные": "#57c4f0",
  "Монолит": "#d9a52c",
  "Вольные сталкеры": "#e0c94d",
  "Winx club": "#b98ae0",
};

/* CSV лежит в top100/ рядом со скриптом */
const inputDir = process.argv[2] || path.join(__dirname, "top100");
const outputFile = process.argv[3] || path.join(process.cwd(), "top100-data.js");
const historyDir = path.join(inputDir, "history");
const factionsFile = path.join(inputDir, "factions.json");

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
  const load = f => ({ id: f.replace(".json", ""), data: JSON.parse(fs.readFileSync(path.join(historyDir, f), "utf8")) });
  const timedSnaps = timed.map(load);
  /* недельный снимок, у которого есть копия с точным временем (переименованный файл забыли удалить), пропускаем:
     иначе он попадает в историю дважды и под неверной датой (понедельник недели) */
  const weeklySnaps = weekly.map(load).filter(w => {
    const dup = timedSnaps.some(t => sameData(t.data, w.data));
    if (dup) console.warn("Пропущен " + w.id + ".json: те же данные есть в снимке с точным временем, этот файл можно удалить");
    return !dup;
  });
  return weeklySnaps.concat(timedSnaps);
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
const csvPath = path.join(inputDir, CSV_FILE);
if (!fs.existsSync(csvPath)) throw new Error("Не найден файл: " + csvPath);
const players = readPlayers(csvPath);
if (!players.length) throw new Error("В " + CSV_FILE + " нет ни одного игрока");

const blocks = [];
const snapshot = {};
const current = {};   // ключ -> ник -> {rank, value}

for (const { column, varName, key } of SOURCES) {
  const rows = sectionRows(players, column);
  current[key] = {};
  snapshot[key] = {};
  rows.forEach((r, i) => {
    current[key][r[0]] = { rank: i + 1, value: r[2] };
    snapshot[key][r[0]] = [i + 1, r[2]];
  });
  blocks.push(`window.${varName}=[\n${rows.map(r => JSON.stringify(r)).join(",\n")}\n];`);
}

/* группировки: цвет из factions.json, новым — новый цвет (файл дописывается).
   В данные сайта идут только группировки текущего рейтинга, по числу игроков */
let factionColors = {};
if (fs.existsSync(factionsFile)) factionColors = JSON.parse(fs.readFileSync(factionsFile, "utf8"));
else factionColors = { ...DEFAULT_FACTION_COLORS };
/* группировки считаем только по игрокам, попавшим хотя бы в один раздел рейтинга */
const shown = new Set(Object.values(current).flatMap(sec => Object.keys(sec)));
const groupCount = {};
players.forEach(pl => { if (pl.group && shown.has(pl.nick)) groupCount[pl.group] = (groupCount[pl.group] || 0) + 1; });
const groupsNow = Object.keys(groupCount).sort((a, b) => groupCount[b] - groupCount[a] || a.localeCompare(b, "ru"));
const added = [];
for (const g of groupsNow) {
  if (!factionColors[g]) { factionColors[g] = pickColor(Object.values(factionColors)); added.push(g); }
}
if (added.length || !fs.existsSync(factionsFile)) {
  fs.mkdirSync(inputDir, { recursive: true });
  fs.writeFileSync(factionsFile, "{\n" + Object.keys(factionColors).map(g => `  ${JSON.stringify(g)}: ${JSON.stringify(factionColors[g])}`).join(",\n") + "\n}\n");
}
if (added.length) console.log("Новые группировки:", added.map(g => g + " " + factionColors[g]).join(", "));
const factionsOut = groupsNow.map(g => ({ name: g, color: factionColors[g] }));
const groupOfNick = {};
players.forEach(pl => { if (pl.group && shown.has(pl.nick)) groupOfNick[pl.nick] = pl.group; });

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

/* смена ника: снимки рейтинга хранят игроков по нику, а ник меняется (например, приписка группировки).
   ID игрока -> все его ники по снимкам игроков (top100/players, их пишет build-players.js).
   Без этого сменивший ник получал бы «new», а его прирост терялся */
const idOfNick = {};
players.forEach(pl => { if (pl.id) idOfNick[pl.nick] = pl.id; });
const playersDir = path.join(inputDir, "players");
const nickAt = {};      // снимок -> ID -> ник в тот момент
const nicksOfId = {};   // ID -> все известные ники
if (fs.existsSync(playersDir)) {
  for (const f of fs.readdirSync(playersDir).filter(f => /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/.test(f))) {
    const pp = JSON.parse(fs.readFileSync(path.join(playersDir, f), "utf8")).p || {};
    const at = nickAt[f.replace(".json", "")] = {};
    for (const id of Object.keys(pp)) {
      at[id] = pp[id][0];
      (nicksOfId[id] = nicksOfId[id] || new Set()).add(pp[id][0]);
    }
  }
}
players.forEach(pl => { if (pl.id) (nicksOfId[pl.id] = nicksOfId[pl.id] || new Set()).add(pl.nick); });
/* запись игрока в снимке base. Ищем по порядку:
   1) тот же ник; 2) ник этого ID на момент снимка (снимок игроков с тем же временем);
   3) ник без лишних пробелов: разные выгрузки по-разному сохраняли пробелы в начале, в конце и внутри ника;
   4) прошлые ники этого ID. Чужой ник не берём: если у найденного ника сейчас другой ID, это другой игрок */
const normNick = n => String(n).normalize("NFKC").replace(/\s+/g, " ").trim();
const normCache = new WeakMap();
function normIndex(prev) {
  if (!normCache.has(prev)) {
    const m = {};
    for (const n of Object.keys(prev)) { const k = normNick(n); m[k] = m[k] === undefined ? n : null; }   // null — неоднозначно
    normCache.set(prev, m);
  }
  return normCache.get(prev);
}
let renamed = 0;
function prevEntry(prev, baseId, nick) {
  if (prev[nick] !== undefined) return prev[nick];
  const id = idOfNick[nick];
  const ok = n => n != null && n !== nick && prev[n] !== undefined && (!id || !idOfNick[n] || idOfNick[n] === id);
  let old = id && nickAt[baseId] ? nickAt[baseId][id] : undefined;
  if (!ok(old)) {
    const idx = normIndex(prev);
    old = [nick, ...(id ? nicksOfId[id] || [] : [])].map(n => idx[normNick(n)]).find(ok);
  }
  if (!ok(old)) return undefined;
  renamed++;
  return prev[old];
}

/* сравнение раздела со снимком base: изменение места и прирост значения */
function compareWith(base, key) {
  const prev = (base && base.data && base.data[key]) || null;
  const hasValues = !!prev && Object.values(prev).some(v => Array.isArray(v));
  const rank = {};
  const delta = {};
  let moves = 0;
  let source = "нет данных";
  if (prev) {
    for (const nick of Object.keys(current[key])) {
      const now = current[key][nick];
      const raw = prevEntry(prev, base.id, nick);
      const was = raw === undefined ? undefined : readEntry(raw);
      if (!was) rank[nick] = null;                                   // новичок в списке
      else if (was.rank !== now.rank) { rank[nick] = was.rank - now.rank; moves++; }
      if (hasValues && was && was.value !== undefined) delta[nick] = now.value - was.value;
    }
  }
  if (hasValues) source = "снимок";
  return { rank, delta: hasValues ? delta : {}, moves, source };
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
    const r = compareWith(base, key);
    delta[key] = compactMap(r.delta);
    rank[key] = compactMap(r.rank);
    moves += r.moves;
    src.push(key + "=" + r.source);
  }
  /* без снимка сравнивать не с чем */
  if (!base) continue;

  if (base) usedBases.add(base.id);
  periods.push({ key: per.key, label: per.label, from: base ? fmtTime(base.id) : null, partial });
  changes[per.key] = { delta, rank };
  console.log(`Период «${per.label}»:`, "с " + base.id, partial ? "(неполный)" : "",
    "| смен мест:", moves, "| приросты:", src.join(", ") + (renamed ? " | узнаны по ID после смены ника: " + renamed : ""));
  renamed = 0;
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

const header = "/* Топ-100: [ник, уровень, значение, давно не заходил (0/1)]. Место = индекс+1 */\n";
const notes =
  "/* TOP100_PERIODS — периоды изменений для переключателя: ключ, подпись, с какого момента считаем, неполный ли период */\n" +
  "/* TOP100_CHANGES — по ключу периода: delta (прирост метрики) и rank (изменение места: + поднялся, − опустился, null — новичок) */\n" +
  "/* TOP100_FACTIONS — группировки текущего рейтинга с цветами (из top100/factions.json), TOP100_GROUPS — ник -> группировка */\n";
fs.writeFileSync(outputFile,
  header +
  `window.TOP100_UPDATED=${JSON.stringify(stamp)};\n` +
  notes +
  `window.TOP100_PERIODS=${JSON.stringify(periods)};\n` +
  `window.TOP100_CHANGES={\n${periods.map(per => ` ${JSON.stringify(per.key)}:${JSON.stringify(changes[per.key])}`).join(",\n")}\n};\n` +
  `window.TOP100_FACTIONS=${JSON.stringify(factionsOut)};\n` +
  `window.TOP100_GROUPS=${JSON.stringify(groupOfNick)};\n` +
  `window.TOP100_HISTORY=${JSON.stringify({ id: unchanged && latest ? latest.id : snapId, from: previous ? previous.id : null })}\n` +
  blocks.join("\n") + "\n");
console.log("Готово:", outputFile, "| дата:", stamp, "| периодов:", periods.map(per => per.key).join(", ") || "нет");
if (unchanged) console.log("Данные не изменились с прошлого запуска, новый снимок не добавлен.");
if (!previous) console.log("Прошлого снимка нет: стрелки появятся после следующего обновления с новыми данными.");

/* карточки игроков (build-players.js): снимок всех игроков и top100-players.json рядом с top100-data.js */
require("./build-players.js").buildPlayers({
  players, sources: SOURCES, bossCols: BOSS_COLS, inputDir,
  outputFile: path.join(path.dirname(outputFile), "top100-players.json"),
  snapId: unchanged && latest ? latest.id : snapId, snapTime,
  legacySnaps: readSnapshots(), updated: stamp, factionColors
});
