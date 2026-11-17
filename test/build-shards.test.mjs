import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { SHARD_COUNT, shardOf, buildShards } = require(path.join(ROOT, "build-shards.js"));

test("shardOf распределяет ID детерминированно по 16 шардам", () => {
  assert.equal(SHARD_COUNT, 16);
  for (const id of ["523", "431", "1", "999999", "abc-42"]) {
    const s = shardOf(id);
    assert.ok(Number.isInteger(s) && s >= 0 && s < SHARD_COUNT);
    assert.equal(shardOf(id), s);
  }
});

test("buildShards создаёт лёгкий индекс и 16 полных шардов", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "hotz-shards-"));
  try {
    const res = buildShards(ROOT, out);
    assert.ok(res, "top100-players.json должен существовать и шардироваться");
    assert.ok(res.idxKb * 2 < res.origKb, `ожидалось уменьшение индекса >50%: ${res.idxKb} КБ vs ${res.origKb} КБ`);

    const orig = JSON.parse(fs.readFileSync(path.join(ROOT, "top100-players.json"), "utf8"));
    const index = JSON.parse(fs.readFileSync(path.join(out, "top100-index.json"), "utf8"));

    assert.equal(index.dates, undefined, "индекс не должен тащить массив всех дат истории");
    assert.deepEqual(Object.keys(index.players).length, Object.keys(orig.players).length);

    const sampleId = Object.keys(orig.players)[0];
    assert.equal(index.players[sampleId].s, undefined, "в индексе не должно быть истории s");
    assert.equal(index.players[sampleId].n, orig.players[sampleId].n);

    const shardFile = path.join(out, "top100-shards", shardOf(sampleId) + ".json");
    assert.ok(fs.existsSync(shardFile));
    const shard = JSON.parse(fs.readFileSync(shardFile, "utf8"));
    assert.ok(Array.isArray(shard.dates) && shard.dates.length > 0);
    assert.deepEqual(shard.players[sampleId], orig.players[sampleId]);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("build.js синхронизирует счётчик снаряжения, фильтры Топ-100 и шарды в dist", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "hotz-proto-build-"));
  try {
    const r = spawnSync(process.execPath, ["build.js"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 180000,
      env: { ...process.env, BUILD_OUT: out }
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);

    const calcHtml = fs.readFileSync(path.join(out, "calculator.html"), "utf8");
    assert.match(calcHtml, /id="equipmentCount">0 \/ 39<\/b>/, "счётчик должен соответствовать реальным 39 вещам");
    assert.match(calcHtml, /id="calcDockGo"/);
    assert.match(calcHtml, /id="calcDockClose"/);

    const top100Html = fs.readFileSync(path.join(out, "top100.html"), "utf8");
    assert.match(top100Html, /id="top100FiltersToggle"/);
    assert.match(top100Html, /id="top100ToolsDrawer"/);
    assert.match(top100Html, /id="top100FactionsMore"/);

    const swJs = fs.readFileSync(path.join(out, "sw.js"), "utf8");
    assert.match(swJs, /index\\\.json/);
    assert.match(swJs, /top100-shards/);
    assert.ok(fs.existsSync(path.join(out, "top100-index.json")));
    assert.ok(fs.existsSync(path.join(out, "top100-shards", "0.json")));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
