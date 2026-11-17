"use strict";

/* Разделение top100-players.json на лёгкий индекс (поиск, «Моё место») и 16 шардов истории игроков */
const fs = require("fs");
const path = require("path");

const SHARD_COUNT = 16;

function shardOf(id) {
  const s = String(id || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % SHARD_COUNT;
}

function buildShards(rootDir, outDir) {
  const srcFile = path.join(rootDir, "top100-players.json");
  if (!fs.existsSync(srcFile)) return null;

  const raw = JSON.parse(fs.readFileSync(srcFile, "utf8"));
  const indexPlayers = {};
  const shards = Array.from({ length: SHARD_COUNT }, () => ({}));

  for (const id of Object.keys(raw.players || {})) {
    const p = raw.players[id];
    indexPlayers[id] = {
      n: p.n,
      g: p.g,
      z: p.z || "",
      off: p.off,
      l: p.l,
      v: p.v,
      r: p.r
    };
    shards[shardOf(id)][id] = p;
  }

  const indexData = {
    updated: raw.updated,
    metrics: raw.metrics,
    bosses: raw.bosses,
    factions: raw.factions,
    players: indexPlayers
  };
  const indexFile = path.join(outDir, "top100-index.json");
  fs.writeFileSync(indexFile, JSON.stringify(indexData));

  const shardsDir = path.join(outDir, "top100-shards");
  fs.mkdirSync(shardsDir, { recursive: true });
  let totalShardBytes = 0;
  for (let i = 0; i < SHARD_COUNT; i++) {
    const sf = path.join(shardsDir, i + ".json");
    const content = JSON.stringify({
      updated: raw.updated,
      dates: raw.dates,
      metrics: raw.metrics,
      bosses: raw.bosses,
      factions: raw.factions,
      players: shards[i]
    });
    fs.writeFileSync(sf, content);
    totalShardBytes += Buffer.byteLength(content);
  }

  const origKb = (fs.statSync(srcFile).size / 1024).toFixed(0);
  const idxKb = (fs.statSync(indexFile).size / 1024).toFixed(0);
  const avgShardKb = (totalShardBytes / SHARD_COUNT / 1024).toFixed(0);
  console.log(
    "Шарды игроков: top100-players.json " +
      origKb +
      " КБ -> индекс " +
      idxKb +
      " КБ + 16 шардов (~" +
      avgShardKb +
      " КБ/шард)"
  );

  return { origKb: Number(origKb), idxKb: Number(idxKb), shardCount: SHARD_COUNT };
}

module.exports = { SHARD_COUNT, shardOf, buildShards };
