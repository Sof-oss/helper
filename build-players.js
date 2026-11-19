"use strict";
/* Карточки игроков: снимки всех игроков + файл для сайта top100-players.json. */
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

  /* снимок этого запуска */
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

  /* все точки истории */
  const playerSnaps = files.map(f => {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    return { id: f.replace(".json", ""), cols: d.cols, p: d.p };
  });
  const firstPlayerMs = playerSnaps.length ? snapTime(playerSnaps[0].id) : Infinity;
  /* ник -> все ID, когда-либо носившие этот ник, и первые известные показатели каждого ID в снимках игроков:
     старые снимки рейтинга хранят только ник, поэтому новичку-тёзке нельзя приклеивать чужую историю с более
     высокими показателями - значения в игре не убывают */
  const idsByNick = new Map();
  const addNick = (nick, id) => {
    if (!nick || !id) return;
    let set = idsByNick.get(nick);
    if (!set) idsByNick.set(nick, (set = new Set()));
    set.add(id);
  };
  const firstSnapInfo = {};
  playerSnaps.forEach((s, si) => {
    const ci = {};
    s.cols.forEach((c, i) => {
      ci[c] = i + 3;
    });
    for (const id of Object.keys(s.p)) {
      const r = s.p[id];
      addNick(r[0], id);
      if (!firstSnapInfo[id]) {
        const vals = {};
        for (const k of METRICS) if (ci[k] !== undefined) vals[k] = r[ci[k]];
        firstSnapInfo[id] = { idx: si, vals };
      }
    }
  });
  for (const pl of players) if (pl.id) addNick(pl.nick, pl.id);

  const pickLegacyId = (nick, vals) => {
    const ids = idsByNick.get(nick);
    if (!ids || !ids.size) return null;
    const keys = Object.keys(vals);
    let bestId = null,
      bestIdx = Infinity,
      bestDiff = Infinity;
    for (const id of ids) {
      const info = firstSnapInfo[id];
      if (!info) continue;
      let ok = true,
        diff = 0;
      for (const k of keys) {
        const fv = info.vals[k];
        if (fv === undefined) continue;
        if (vals[k] > fv) {
          ok = false;
          break;
        }
        diff += fv - vals[k];
      }
      if (!ok) continue;
      if (info.idx < bestIdx || (info.idx === bestIdx && diff < bestDiff)) {
        bestId = id;
        bestIdx = info.idx;
        bestDiff = diff;
      }
    }
    return bestId;
  };

  /* точка: ID -> {nick, group, off, vals{col: число}} ; у старых снимков рейтинга group = undefined */
  const points = [];
  for (const ls of legacySnaps) {
    const ms = snapTime(ls.id);
    if (ms >= firstPlayerMs) continue;
    const byNick = {};
    for (const key of METRICS) {
      const sec = ls.data[key];
      if (!sec) continue;
      for (const nick of Object.keys(sec)) {
        const v = sec[nick];
        if (!Array.isArray(v)) continue;
        (byNick[nick] = byNick[nick] || {})[key] = v[1];
      }
    }
    const byId = {};
    for (const [nick, vals] of Object.entries(byNick)) {
      const id = pickLegacyId(nick, vals);
      if (!id) continue;
      byId[id] = { nick, vals };
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

  /* места среди всех игроков */
  const ranks = {};
  for (const s of sources) {
    players
      .filter(pl => num(pl.values[s.column]) > 0)
      .sort((a, b) => b.values[s.column] - a.values[s.column] || a.order - b.order)
      .forEach((pl, i) => {
        (ranks[pl.id] = ranks[pl.id] || {})[s.key] = i + 1;
      });
  }

  /* карточки */
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
  const colorsLow = factionColors
    ? Object.fromEntries(Object.entries(factionColors).map(([k, v]) => [k.trim().toLowerCase(), v]))
    : {};
  for (const id of Object.keys(out)) {
    for (const g of [out[id].g].concat((out[id].gh || []).map(x => x[1]))) {
      if (!g) continue;
      const c = (factionColors && factionColors[g]) || colorsLow[g.trim().toLowerCase()];
      if (c) factions[g] = c;
    }
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
