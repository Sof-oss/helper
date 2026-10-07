"use strict";
/* Карточки игроков: снимки всех игроков + файл для сайта top100-players.json.
 * Вызывается из build-top100.js после сборки рейтинга, отдельно не запускается.
 *
 * 1. Снимок top100/players/<дата_время>.json — все игроки по ID (ID не меняется при смене ника):
 *    {cols:[...], p:{ID:[ник, группировка, нет сигнала, уровень, показатели..., боссы...]}}.
 *    Обновление раз в сутки -> один снимок в день, хранятся все (сжимаются git'ом хорошо).
 * 2. top100-players.json — то, что открывает карточка:
 *    dates  — моменты снимков (мс), по ним строятся графики и считаются периоды; factions — цвета группировок;
 *    metrics/bosses — порядок показателей в массивах;
 *    players — ID -> {n ник, g группировка, z «В Зоне», off нет сигнала, l уровень, v показатели, b боссы,
 *               r места во всех рейтингах (среди всех игроков, null — показатель 0),
 *               s ряд [индекс даты, уровень, ...показатели] (null — неизвестно; точка пишется, только если что-то изменилось),
 *               gh смены группировки [индекс даты, группировка], nh смены ника [индекс даты, старый ник, новый ник]}.
 * Старые снимки рейтинга (top100/history, только топ-100 и по нику) тоже идут в графики:
 * ник сопоставляется с ID по снимкам игроков, группировки и уровня в них нет */
const fs = require("fs");
const path = require("path");

function buildPlayers(o) {
  const { players, sources, bossCols, inputDir, outputFile, snapId, snapTime, legacySnaps, updated, factionColors } = o;
  const dir = path.join(inputDir, "players");
  const METRICS = sources.map(s => s.key);
  const cols = ["level"].concat(
    METRICS,
    bossCols.map(b => "b:" + b)
  );
  const num = v => (Number.isFinite(v) ? v : 0);

  /* ---------- снимок этого запуска ---------- */
  const snap = { cols, p: {} };
  for (const pl of players) {
    if (!pl.id) continue;
    snap.p[pl.id] = [pl.nick, pl.group, pl.inactive, num(pl.level)].concat(
      sources.map(s => num(pl.values[s.column])),
      bossCols.map(b => num(pl.bosses[b]))
    );
  }
  fs.mkdirSync(dir, { recursive: true });
  const files = fs
    .readdirSync(dir)
    .filter(f => /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  const lastFile = files[files.length - 1];
  const same =
    lastFile &&
    JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir, lastFile), "utf8")).p) === JSON.stringify(snap.p);
  if (!same) {
    /* одна строка на игрока, чтобы git-diff читался */
    const text =
      '{"cols":' +
      JSON.stringify(cols) +
      ',"p":{\n' +
      Object.keys(snap.p)
        .map(id => JSON.stringify(id) + ":" + JSON.stringify(snap.p[id]))
        .join(",\n") +
      "\n}}\n";
    fs.writeFileSync(path.join(dir, snapId + ".json"), text);
    files.push(snapId + ".json");
  }

  /* ---------- все точки истории ---------- */
  const playerSnaps = files.map(f => {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    return { id: f.replace(".json", ""), cols: d.cols, p: d.p };
  });
  const firstPlayerMs = playerSnaps.length ? snapTime(playerSnaps[0].id) : Infinity;
  /* ник -> ID по всем снимкам игроков (последний выигрывает) */
  const idByNick = {};
  for (const s of playerSnaps) for (const id of Object.keys(s.p)) idByNick[s.p[id][0]] = id;
  for (const pl of players) if (pl.id) idByNick[pl.nick] = pl.id;

  /* точка: ID -> {nick, group, off, vals{col: число}} ; у старых снимков рейтинга group = undefined */
  const points = [];
  for (const ls of legacySnaps) {
    const ms = snapTime(ls.id);
    if (ms >= firstPlayerMs) continue;
    const byId = {};
    for (const key of METRICS) {
      const sec = ls.data[key];
      if (!sec) continue;
      for (const nick of Object.keys(sec)) {
        const v = sec[nick],
          id = idByNick[nick];
        if (!id || !Array.isArray(v)) continue;
        (byId[id] = byId[id] || { nick, vals: {} }).vals[key] = v[1];
      }
    }
    points.push({ ms, byId });
  }
  for (const s of playerSnaps) {
    const ci = {};
    s.cols.forEach((c, i) => {
      ci[c] = i + 3;
    });
    const byId = {};
    for (const id of Object.keys(s.p)) {
      const r = s.p[id],
        vals = {};
      for (const c of ["level"].concat(METRICS)) if (ci[c] !== undefined) vals[c] = r[ci[c]];
      byId[id] = { nick: r[0], group: r[1], off: r[2], vals };
    }
    points.push({ ms: snapTime(s.id), byId });
  }
  points.sort((a, b) => a.ms - b.ms);
  const dates = points.map(p => p.ms);

  /* ---------- места среди всех игроков ---------- */
  const ranks = {};
  for (const s of sources) {
    players
      .filter(pl => num(pl.values[s.column]) > 0)
      .sort((a, b) => b.values[s.column] - a.values[s.column] || a.order - b.order)
      .forEach((pl, i) => {
        (ranks[pl.id] = ranks[pl.id] || {})[s.key] = i + 1;
      });
  }

  /* ---------- карточки ---------- */
  const out = {};
  for (const pl of players) {
    if (!pl.id) continue;
    const s = [],
      gh = [],
      nh = [];
    let prevRow = null,
      prevGroup,
      prevNick;
    points.forEach((pt, di) => {
      const e = pt.byId[pl.id];
      if (!e) return;
      const row = [e.vals.level === undefined ? null : e.vals.level].concat(
        METRICS.map(k => (e.vals[k] === undefined ? null : e.vals[k]))
      );
      const key = JSON.stringify(row);
      if (key !== prevRow) {
        s.push([di].concat(row));
        prevRow = key;
      }
      if (e.group !== undefined && e.group !== prevGroup) {
        gh.push([di, e.group]);
        prevGroup = e.group;
      }
      if (e.nick !== prevNick) {
        if (prevNick !== undefined) nh.push([di, prevNick, e.nick]);
        prevNick = e.nick;
      }
    });
    /* последняя точка ряда должна быть последним снимком, иначе «без изменений» выглядит как обрыв */
    const lastDi = dates.length - 1;
    if (s.length && s[s.length - 1][0] !== lastDi && points[lastDi].byId[pl.id])
      s.push([lastDi].concat(s[s.length - 1].slice(1)));
    const card = {
      n: pl.nick,
      g: pl.group,
      z: pl.zone || "",
      off: pl.inactive,
      l: num(pl.level),
      v: sources.map(x => num(pl.values[x.column])),
      b: bossCols.map(b => num(pl.bosses[b])),
      r: METRICS.map(k => (ranks[pl.id] && ranks[pl.id][k]) || null),
      s
    };
    if (gh.length) card.gh = gh;
    if (nh.length) card.nh = nh;
    out[pl.id] = card;
  }
  /* цвета всех группировок, что встречаются у игроков (не только в топ-100) */
  const factions = {};
  for (const id of Object.keys(out)) {
    for (const g of [out[id].g].concat((out[id].gh || []).map(x => x[1])))
      if (g && factionColors && factionColors[g]) factions[g] = factionColors[g];
  }
  const json = { updated, dates, metrics: METRICS, bosses: bossCols, factions, players: out };
  fs.writeFileSync(outputFile, JSON.stringify(json));
  console.log(
    "Карточки игроков:",
    Object.keys(out).length,
    "| точек истории:",
    dates.length,
    "| " + path.basename(outputFile) + " " + (fs.statSync(outputFile).size / 1024).toFixed(0) + " КБ",
    same ? "| снимок игроков не изменился" : ""
  );
}

module.exports = { buildPlayers };
