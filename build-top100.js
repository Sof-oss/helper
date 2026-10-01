#!/usr/bin/env node
"use strict";
/* CSV из выгрузок рейтинга -> top100-data.js
 * Запуск: node build-top100.js [папка_с_csv] [путь_к_top100-data.js]
 * По умолчанию CSV берутся из ./top100, результат пишется в ./top100-data.js */
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

/* число из выгрузки: «1 839», «217 843» (обычные и неразрывные пробелы) */
const toNumber = v => Number(String(v).replace(/[\s\u00A0\u202F]/g, ""));

/* колонки: 0 место, 1 ник, 2 уровень, 3 значение, остальные (Δ) пропускаем.
   Если место пропущено, настоящее сохраняем пятым элементом, чтобы нижние не сдвигались */
function csvToRows(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(text).slice(1); // без заголовка
  return rows.map(([rank, nick, level, value], i) => {
    const inactive = nick.startsWith(INACTIVE_MARK) ? 1 : 0;
    const cleanNick = inactive ? nick.slice(INACTIVE_MARK.length) : nick;
    const row = [cleanNick, toNumber(level), toNumber(value), inactive];
    if (toNumber(rank) !== i + 1) row.push(toNumber(rank));
    return row;
  });
}

const SOURCES = [
  { file: "heart-of-the-zone-top100-talents.csv", varName: "TOP100_TALENTS" },
  { file: "heart-of-the-zone-top100-camp_defenses.csv", varName: "TOP100_DEFENSE" },
  { file: "heart-of-the-zone-top100-expeditions.csv", varName: "TOP100_EXPEDITIONS" },
  { file: "heart-of-the-zone-top100-collections.csv", varName: "TOP100_COLLECTIONS" },
  { file: "heart-of-the-zone-top100-stashes.csv", varName: "TOP100_STASHES" },
  { file: "heart-of-the-zone-top100-reputation.csv", varName: "TOP100_REPUTATION" },
  { file: "heart-of-the-zone-top100-bosses.csv", varName: "TOP100_BOSSES" },
];

/* CSV лежат в top100/ рядом со скриптом */
const inputDir = process.argv[2] || path.join(__dirname, "top100");
const outputFile = process.argv[3] || path.join(process.cwd(), "top100-data.js");

const blocks = SOURCES.map(({ file, varName }) => {
  const filePath = path.join(inputDir, file);
  if (!fs.existsSync(filePath)) throw new Error("Не найден файл: " + filePath);
  const rows = csvToRows(filePath);
  const body = rows.map(r => JSON.stringify(r)).join(",\n");
  return `window.${varName}=[\n${body}\n];`;
});

/* дата сборки по Москве, ДД.ММ.ГГГГ ЧЧ:ММ:СС. Хранится в data-файле, чтобы шла вместе с данными */
const p = Object.fromEntries(new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
}).formatToParts(new Date()).map(x => [x.type, x.value]));
const stamp = `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}:${p.second}`;

const header = "/* Топ-100: [ник, уровень, значение, покинул отряд (0/1)[, место]]. Место = индекс+1, если не указано пятым элементом */\n";
fs.writeFileSync(outputFile, header + `window.TOP100_UPDATED=${JSON.stringify(stamp)};\n` + blocks.join("\n") + "\n");
console.log("Готово:", outputFile, "| дата:", stamp);
