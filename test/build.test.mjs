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
      env: { ...process.env, BUILD_OUT: out, METRIKA_ID: "12345678" }
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
    /* сводка в шапке, строки-капсулы и спрайт эмблем - сразу в HTML; эмблемы из ui.js, а не только щитки с буквой */
    assert.match(top100, /class="t100-stat lead"/);
    assert.match(top100, /<tr role="row" class="t100-row/);
    const sprite = /<svg id="top100Emblems"[^>]*>([\s\S]*?)<\/svg>/.exec(top100);
    assert.ok(sprite && /<symbol id="t100e-0"/.test(sprite[1]), "спрайт эмблем группировок в HTML");
    assert.ok(
      sprite[1]
        .split("<symbol")
        .slice(1)
        .some(x => !x.includes("<text")),
      "в спрайте есть эмблемы ui.js"
    );

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
    /* окна калькулятора - отдельные куски calc/*.js: они в оболочке, иначе офлайн окна не откроются */
    const calcChunks = fs.readdirSync(path.join(out, "calc")).filter(f => f.endsWith(".js"));
    assert.deepEqual(
      calcChunks.map(f => f.replace(/-\w+\.js$/, "")).sort(),
      ["calc-compare", "calc-talents", "calc-tokens"],
      "куски окон калькулятора без общего chunk-*.js"
    );
    assert.ok(
      calcChunks.every(f => precache.includes("/calc/" + f)),
      "куски калькулятора входят в оболочку"
    );
    assert.match(read("calculator.html"), /<script type="module" src="calculator\.js\?v=/);
    /* тур - через загрузчик: tour.js не в <script src>, но в оболочке SW */
    assert.doesNotMatch(index, /<script[^>]*src="[^"]*tour\.js/);
    assert.match(index, /загрузчик тура/);
    assert.ok(
      precache.some(u => /^\/tour\.js\?v=/.test(u)),
      "tour.js входит в оболочку"
    );
    assert.ok(!precache.includes("/"), "страницы не входят в статическую оболочку");
    assert.ok(!precache.includes("/top100"), "страница Топ-100 не входит в оболочку");
    assert.ok(!precache.some(u => /^\/top100-data\.js/.test(u)), "данные Топ-100 не входят в оболочку");

    /* Яндекс Метрика: счётчик и уведомление о cookie на страницах (и собранных из них), адреса Метрики в CSP;
       на офлайн-странице счётчика нет */
    const csp = html => /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)[1];
    const guidePage = fs.readdirSync(path.join(out, "guide")).find(f => f.endsWith(".html"));
    for (const f of [
      "index.html",
      "calculator.html",
      "build.html",
      "info-tasks.html",
      "404.html",
      "guide/" + guidePage
    ]) {
      const html = read(f);
      assert.equal(html.match(/mc\.yandex\.ru\/metrika\/tag\.js/g)?.length, 1, f + ": один счётчик Метрики");
      assert.match(html, /var id=12345678/, f);
      assert.match(html, /tag\.js\?id="\+id/, f + ": tag.js с номером счётчика, как в коде из Метрики");
      assert.match(csp(html), /script-src [^;]*https:\/\/mc\.yandex\.ru/, f + ": CSP разрешает tag.js");
      assert.match(csp(html), /connect-src [^;]*https:\/\/mc\.yandex\.com/, f + ": CSP разрешает отправку");
      assert.match(csp(html), /frame-src [^;]*blob: https:\/\/mc\.yandex\.ru/, f + ": CSP для карты кликов");
    }
    assert.match(index, /<p id="privacy">/, "абзац о статистике в «Правовой информации»");
    assert.match(read("calculator.html"), /id="shareBuild" data-goal="calc_share"/);
    const offline = read("offline.html");
    assert.doesNotMatch(offline, /mc\.yandex/, "на офлайн-странице счётчика нет");
    assert.match(csp(offline), /frame-src 'none'/);

    const sitemap = read("sitemap.xml");
    assert.match(sitemap, /https:\/\/heart-of-the-zone\.ru\/top100/);
    assert.doesNotMatch(sitemap, /\/build<\/loc>/);
    assert.doesNotMatch(sitemap, /\/p\/\d+<\/loc>/);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
