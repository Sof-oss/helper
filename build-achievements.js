/* Сборка рейтинга по очкам достижений и глобальной статистики редкости наград.
   Используется из build.js: собирает achievements-data.json и пререндер для achievements.html. */
"use strict";
const fs = require("fs");
const path = require("path");
const ZA = require("./achievements.js");

const esc = s =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const fmt = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function factionColor(name, factionsMap) {
  if (!name) return "";
  if (factionsMap) {
    if (factionsMap[name]) return factionsMap[name];
    const low = name.trim().toLowerCase();
    for (const k of Object.keys(factionsMap)) if (k.trim().toLowerCase() === low) return factionsMap[k];
  }
  return "";
}

/* чистая функция расчёта: принимает top100-players.json и карту лидеров -> данные рейтинга и статистики */
function computeAchievementsBoard(playersData, leadersMap, topLimit) {
  const limit = Number(topLimit) > 0 ? Number(topLimit) : 100;
  const players = (playersData && playersData.players) || {};
  const metrics = (playersData && playersData.metrics) || [];
  const bosses = (playersData && playersData.bosses) || [];
  const dates = (playersData && playersData.dates) || [];
  const factionsMap = (playersData && playersData.factions) || {};
  const repIdx = metrics.indexOf("reputation");
  const ids = Object.keys(players);

  const counts = {};
  for (const d of ZA.DEFINITIONS) counts[d.id] = 0;

  const rows = [];
  let maxPoints = 0;

  for (const id of ids) {
    const p = players[id];
    if (!p) continue;
    const leaderInfo = leadersMap ? leadersMap[String(id)] || null : null;
    const ev = ZA.evaluate(p, { metrics, bosses, dates, leaderInfo });
    if (!maxPoints) maxPoints = ev.summary.totalPoints;

    for (const it of ev.items) {
      if (it.status === "unlocked") counts[it.id] = (counts[it.id] || 0) + 1;
    }

    const rep = repIdx >= 0 && Array.isArray(p.v) ? Number(p.v[repIdx]) || 0 : 0;
    const g = p.g && p.g !== "-" ? String(p.g).trim() : "";
    rows.push({
      id: String(id),
      n: String(p.n || ""),
      g,
      col: factionColor(g, factionsMap),
      lv: Number(p.l) || 0,
      pts: ev.summary.earnedPoints,
      u: ev.summary.unlocked,
      ip: ev.summary.inProgress,
      rk: ev.summary.rankTitle,
      off: p.off ? 1 : 0,
      _rep: rep
    });
  }

  rows.sort(
    (a, b) =>
      b.pts - a.pts || b.u - a.u || b._rep - a._rep || b.lv - a.lv || String(a.id).localeCompare(String(b.id), "en")
  );

  const top = rows.slice(0, limit).map((row, idx) => ({
    r: idx + 1,
    id: row.id,
    n: row.n,
    g: row.g,
    col: row.col,
    lv: row.lv,
    pts: row.pts,
    u: row.u,
    ip: row.ip,
    rk: row.rk,
    off: row.off
  }));

  const ranks = {};
  for (const row of top) ranks[row.id] = row.r;

  const factions = {};
  for (const row of top) {
    if (!row.g) continue;
    factions[row.g] = (factions[row.g] || 0) + 1;
  }

  /* самое редкое достижение среди открытых хотя бы одним игроком (иначе минимальное по числу владельцев) */
  const totalPlayers = rows.length;
  const defsWithCount = ZA.DEFINITIONS.map(d => ({
    id: d.id,
    name: d.name,
    rarity: d.rarity,
    points: d.points,
    count: counts[d.id] || 0
  }));
  const unlockedAny = defsWithCount.filter(d => d.count > 0);
  const rarestPool = unlockedAny.length ? unlockedAny : defsWithCount;
  rarestPool.sort((a, b) => a.count - b.count || b.points - a.points || a.name.localeCompare(b.name, "ru"));
  const rarestItem = rarestPool[0] || null;
  const rarest = rarestItem
    ? {
        id: rarestItem.id,
        name: rarestItem.name,
        count: rarestItem.count,
        pctText: ZA.formatOwnership(rarestItem.count, totalPlayers).pctText
      }
    : null;

  return {
    updated: (playersData && playersData.updated) || "",
    totalPlayers,
    totalAchievements: ZA.DEFINITIONS.length,
    maxPoints: maxPoints || ZA.DEFINITIONS.reduce((s, d) => s + d.points, 0),
    stats: counts,
    rarest,
    factions,
    ranks,
    top
  };
}

function renderHeroStats(board) {
  const leader = board.top[0];
  const lastTop = board.top[board.top.length - 1];

  const leaderCard = leader
    ? '<div class="achp-stat">' +
      '<span class="achp-stat-lbl">Лидер</span>' +
      '<button type="button" class="achp-stat-link" data-pc-open="' +
      esc(leader.id) +
      '" data-pc-open-tab="achievements">' +
      esc(leader.n) +
      "</button>" +
      '<span class="achp-stat-sub">' +
      fmt(leader.pts) +
      " очк. · " +
      leader.u +
      "/" +
      board.totalAchievements +
      "</span>" +
      "</div>"
    : "";

  const threshCard = lastTop
    ? '<div class="achp-stat">' +
      '<span class="achp-stat-lbl">Порог Топ-' +
      board.top.length +
      "</span>" +
      '<b class="achp-stat-val">' +
      fmt(lastTop.pts) +
      "</b>" +
      '<span class="achp-stat-sub">' +
      lastTop.r +
      "-е место · " +
      lastTop.u +
      "/" +
      board.totalAchievements +
      "</span>" +
      "</div>"
    : "";

  const rarestCard = board.rarest
    ? '<div class="achp-stat">' +
      '<span class="achp-stat-lbl">Самое редкое</span>' +
      '<button type="button" class="achp-stat-link" data-achp-jump="' +
      esc(board.rarest.id) +
      '">' +
      esc(board.rarest.name) +
      "</button>" +
      '<span class="achp-stat-sub">' +
      esc(board.rarest.pctText) +
      " игроков (" +
      fmt(board.rarest.count) +
      ")</span>" +
      "</div>"
    : "";

  return leaderCard + threshCard + rarestCard;
}

function renderTopRows(board) {
  const sleepSvg =
    '<span class="t100-off" title="Не заходил в игру больше 5 дней" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg></span>';
  return board.top
    .map(row => {
      const medal =
        row.r <= 3
          ? '<span class="achp-medal m' + row.r + '" aria-label="' + row.r + ' место">' + row.r + "</span>"
          : '<span class="achp-pos">' + row.r + "</span>";
      const pct = board.totalAchievements ? Math.round((row.u / board.totalAchievements) * 100) : 0;
      const dotStyle = row.col ? ' style="--fc:' + esc(row.col) + '"' : "";
      const facCell = row.g
        ? '<span class="achp-fac"' + dotStyle + "><i></i>" + esc(row.g) + "</span>"
        : '<span class="achp-fac none">-</span>';
      return (
        '<tr class="' +
        (row.r <= 3 ? "is-top" + row.r : "") +
        (row.off ? " is-off" : "") +
        '" data-achp-id="' +
        esc(row.id) +
        '">' +
        '<td class="c-rank">' +
        medal +
        "</td>" +
        '<td class="c-name"><button type="button" class="achp-player" data-pc-open="' +
        esc(row.id) +
        '" data-pc-open-tab="achievements">' +
        esc(row.n) +
        "</button>" +
        (row.off ? sleepSvg : "") +
        "</td>" +
        '<td class="c-fac">' +
        facCell +
        "</td>" +
        '<td class="c-lvl">' +
        row.lv +
        "</td>" +
        '<td class="c-cnt"><span class="achp-cnt-val">' +
        row.u +
        "/" +
        board.totalAchievements +
        '</span><span class="achp-cnt-bar" aria-hidden="true"><i style="width:' +
        pct +
        '%"></i></span></td>' +
        '<td class="c-rk">' +
        esc(row.rk) +
        "</td>" +
        '<td class="c-pts"><b>' +
        fmt(row.pts) +
        "</b></td>" +
        "</tr>"
      );
    })
    .join("");
}

function buildAchievements(rootDir, opts) {
  const playersPath = path.join(rootDir, "top100-players.json");
  const playersData = JSON.parse(fs.readFileSync(playersPath, "utf8"));
  let leadersMap = opts && opts.leaders ? opts.leaders : null;
  if (!leadersMap) {
    try {
      const fx = require("./build-factions.js")(rootDir);
      leadersMap = fx && fx.cards && fx.cards.leaders ? fx.cards.leaders : {};
    } catch (e) {
      leadersMap = {};
    }
  }
  const board = computeAchievementsBoard(playersData, leadersMap, 100);
  const dates = Array.isArray(playersData.dates) ? playersData.dates : [];
  const history = dates.length ? String(dates[dates.length - 1]) : "";
  return {
    data: board,
    history,
    statsHtml: renderHeroStats(board),
    rowsHtml: renderTopRows(board)
  };
}

module.exports = buildAchievements;
module.exports.computeAchievementsBoard = computeAchievementsBoard;
module.exports.renderHeroStats = renderHeroStats;
module.exports.renderTopRows = renderTopRows;
