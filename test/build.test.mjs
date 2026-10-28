import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("build.js: страницы, CSP, sitemap и статическая оболочка SW", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "hotz-build-"));
  try {
    const r = spawnSync(process.execPath, ["build.js"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 180000,
      env: { ...process.env, BUILD_OUT: out }
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const read = f => fs.readFileSync(path.join(out, f), "utf8");

    const index = read("index.html");
    assert.match(index, /<meta http-equiv="Content-Security-Policy"/);
    assert.match(index, /bundle-[\w-]+\.css\?v=/);
    assert.doesNotMatch(index, /<!--\s*@include/);
    assert.doesNotMatch(index, /\u2014/, "длинное тире сборка должна заменять на дефис");

    const top100 = read("top100.html");
    assert.match(top100, /id="top100Results" role="status"/);
    assert.match(top100, /top100-data\.js\?v=/);

    const sw = read("sw.js");
    const m = /PRECACHE=(\[[^\]]*\])/.exec(sw);
    assert.ok(m, "в sw.js должен быть список PRECACHE");
    const precache = JSON.parse(m[1]);
    assert.ok(precache.includes("/offline"), "офлайн-страница входит в оболочку");
    assert.ok(
      precache.some(u => u.startsWith("/bundle-")),
      "css страниц входят в оболочку"
    );
    assert.ok(
      precache.some(u => /^\/ui\.js\?v=/.test(u)),
      "общие js входят в оболочку"
    );
    assert.ok(!precache.includes("/"), "страницы не входят в статическую оболочку");
    assert.ok(!precache.includes("/top100"), "страница Топ-100 не входит в оболочку");
    assert.ok(!precache.some(u => /^\/top100-data\.js/.test(u)), "данные Топ-100 не входят в оболочку");

    const sitemap = read("sitemap.xml");
    assert.match(sitemap, /https:\/\/heart-of-the-zone\.ru\/top100/);
    assert.doesNotMatch(sitemap, /\/build<\/loc>/);
    assert.doesNotMatch(sitemap, /\/p\/\d+<\/loc>/);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
