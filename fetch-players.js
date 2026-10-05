#!/usr/bin/env node
"use strict";
/* Выгрузка ВСЕХ игроков «Сердце Зоны» из API игры -> top100/heart-of-the-zone-top100-all.csv
 * Запуск: node fetch-players.js [токен]   (или переменная окружения ZONE_TOKEN; без токена скрипт спросит его сам)
 *
 * Где взять токен: открыть игру в браузере на компьютере -> F12 -> Network -> Fetch/XHR ->
 * любой запрос к korzhik-studio.ru/api/... -> Headers -> authorization: Bearer <токен>.
 * Токен живёт около суток, сохранять его никуда не нужно (и нельзя коммитить в репозиторий).
 *
 * Как работает:
 *  1. /api/users/search постранично (по 100) — список всех игроков: id, ник, уровень, репутация, последний вход, группировка;
 *  2. /api/users/<id>/profile — подробности (таланты, боссы, тайники и т. д.) только для тех, у кого есть прогресс
 *     (репутация > 0 или уровень > 1): у остальных все показатели нулевые, их профили не запрашиваем;
 *  3. CSV в том же формате, что раньше, — его читает build-top100.js.
 * Запросы идут понемногу (по 3 одновременно, с паузой) и повторяются при ошибках, чтобы не нагружать сервер игры.
 *
 * Параметры: --limit=N — взять только N профилей (для проверки), --out=путь — куда писать CSV */
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const API = "https://korzhik-studio.ru/api";
const PAGE = 100;              // больше 100 за раз сервер не отдаёт
const PARALLEL = 3;            // одновременных запросов профилей
const PAUSE_MS = 120;          // пауза после каждого запроса
const OFFLINE_DAYS = 5;        // «Нет сигнала»: не заходил дольше стольких дней
const BOSSES = ["Альфа-пёс", "Болотная тварь", "Боров", "Излом", "Крыса", "Упырь"];

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith("--")).map(a => { const [k, v] = a.slice(2).split("="); return [k, v ?? true]; }));
const tokenArg = process.argv.slice(2).find(a => !a.startsWith("--"));
const OUT = args.out || path.join(__dirname, "top100", "heart-of-the-zone-top100-all.csv");
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function askToken() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const t = await new Promise(ok => rl.question("Вставьте токен (authorization: Bearer ...) и нажмите Enter:\n> ", ok));
  rl.close();
  return t;
}
const cleanToken = t => String(t || "").trim().replace(/^authorization:\s*/i, "").replace(/^bearer\s+/i, "").replace(/^["']|["']$/g, "");

function tokenInfo(t) {
  try {
    const p = JSON.parse(Buffer.from(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    return p.exp ? new Date(p.exp * 1000) : null;
  } catch (e) { return undefined; }
}

let TOKEN = "";
async function get(url, tries = 5) {
  for (let i = 1; ; i++) {
    let res;
    try {
      res = await fetch(API + url, { headers: { accept: "application/json", authorization: "Bearer " + TOKEN } });
    } catch (e) {
      if (i >= tries) throw new Error(`Нет связи с сервером игры (${url}): ${e.message}`);
      await sleep(1000 * i); continue;
    }
    if (res.status === 401 || res.status === 403) throw new Error("Сервер не принял токен (" + res.status + "). Скорее всего, он устарел — возьмите новый.");
    if (res.ok) return res.json();
    if (i >= tries || (res.status < 500 && res.status !== 429)) throw new Error(`Ошибка ${res.status} на ${url}`);
    await sleep((res.status === 429 ? 5000 : 1000) * i);   // сервер просит притормозить — ждём дольше
  }
}

/* «В Зоне»: сколько прошло с регистрации, как в игре — «4 месяца», «12 дней» */
function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  return n + " " + (a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many);
}
function inZone(createdIso, now) {
  const c = new Date(createdIso);
  if (isNaN(c)) return "";
  const days = Math.max(0, Math.floor((now - c) / 864e5));
  const m = Math.round(days / 30.44);                     // как в игре: до ближайшего месяца
  if (m >= 1) return plural(m, "месяц", "месяца", "месяцев");
  return plural(days, "день", "дня", "дней");
}
const csvField = v => { const s = String(v ?? ""); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

(async () => {
  TOKEN = cleanToken(tokenArg || process.env.ZONE_TOKEN || await askToken());
  if (!TOKEN) throw new Error("Токен не указан");
  const exp = tokenInfo(TOKEN);
  if (exp === undefined) throw new Error("Это не похоже на токен: нужна строка из заголовка authorization после слова Bearer");
  if (exp && exp < new Date()) throw new Error("Токен истёк " + exp.toLocaleString("ru-RU") + ". Возьмите новый.");

  /* 1. список всех игроков */
  const list = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await get(`/users/search?search=&limit=${PAGE}&offset=${offset}`);
    list.push(...(page.items || []));
    process.stdout.write(`\rСписок игроков: ${list.length} из ${page.total ?? "?"}   `);
    if (!page.has_more || !(page.items || []).length) break;
    await sleep(PAUSE_MS);
  }
  console.log();
  const byId = new Map(list.map(u => [u.user_id, u]));

  /* 2. профили игроков с прогрессом */
  let todo = [...byId.values()].filter(u => (u.reputation || 0) > 0 || (u.level || 1) > 1).sort((a, b) => b.reputation - a.reputation);
  if (args.limit) todo = todo.slice(0, Number(args.limit));
  const profiles = new Map();
  let done = 0, failed = 0;
  const queue = todo.slice();
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    for (let u; (u = queue.shift());) {
      try { profiles.set(u.user_id, await get(`/users/${u.user_id}/profile`)); }
      catch (e) { if (/токен/.test(e.message)) throw e; failed++; console.warn("\n  пропущен", u.user_id, e.message); }
      done++;
      if (done % 10 === 0 || done === todo.length) process.stdout.write(`\rПрофили: ${done} из ${todo.length}   `);
      await sleep(PAUSE_MS);
    }
  }));
  console.log();

  /* 3. CSV: одна строка на игрока, по убыванию репутации */
  const now = new Date();
  const head = ["№", "ID", "Ник", "В Зоне", "Группировка", "Уровень", "Репутация", "Таланты", "Убито боссов",
    ...BOSSES.map(b => "Боссы: " + b), "Собрано коллекций", "Завершено экспедиций", "Защищено лагерей", "Собрано тайников", "Нет сигнала"];
  const rows = todo.filter(u => profiles.has(u.user_id)).map(u => {
    const p = profiles.get(u.user_id), s = byId.get(u.user_id);
    const kills = Object.fromEntries((p.boss_kills || []).map(b => [b.name, b.kills]));
    const last = new Date(s.last_login);
    return {
      rep: p.reputation ?? s.reputation ?? 0,
      cells: [p.user_id, p.name ?? s.name, inZone(p.created_at, now), (p.clan && p.clan.name) || (s.clan && s.clan.name) || "—",
        p.level ?? s.level, p.reputation ?? s.reputation ?? 0, p.talents ?? 0, p.bosses ?? 0, ...BOSSES.map(b => kills[b] ?? 0),
        p.collections ?? 0, p.explorations ?? 0, p.camp_defenses ?? 0, p.stashes ?? 0,
        !isNaN(last) && now - last > OFFLINE_DAYS * 864e5 ? "да" : ""]
    };
  }).sort((a, b) => b.rep - a.rep);
  const text = "\uFEFF" + [head, ...rows.map((r, i) => [i + 1, ...r.cells])].map(r => r.map(csvField).join(";")).join("\r\n") + "\r\n";
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text);
  console.log(`Готово: ${rows.length} игроков с прогрессом (всего в игре ${list.length}) -> ${path.relative(process.cwd(), OUT) || OUT}` + (failed ? `, не удалось получить ${failed} профилей` : ""));
})().catch(e => { console.error("\nОшибка:", e.message); process.exit(1); });
