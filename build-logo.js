#!/usr/bin/env node
"use strict";
/* Логотип и иконки сайта из previews/logo.html (знак радиации из src/zone-sign.js + 3D-сердце из src/zone-heart.js).
 * node build-logo.js - перерисовать assets/heart-logo.webp, assets/heart-core.webp, знак в partials/header.html,
 * favicon.svg, favicon-32.png, apple-touch-icon.png и общее превью assets/preview.jpg (previews/site.html).
 * Нужны playwright-core и Chrome/Edge (или CHROME=путь). Результат коммитят в репозиторий, при деплое не запускается */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright-core");

const ROOT = __dirname;
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".webp": "image/webp",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".css": "text/css"
};

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

const buf = url => Buffer.from(url.split(",")[1], "base64");
const out = (name, data) => fs.writeFileSync(path.join(ROOT, name), data);

(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || undefined,
    channel: process.env.CHROME ? undefined : "chrome",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
  });
  const page = await browser.newPage();
  page.on("pageerror", e => console.error(e));
  await page.goto(base + "/previews/logo.html");
  await page.waitForFunction(() => window.ready);
  const render = o => page.evaluate(o => window.renderLogo(o), o);

  out("assets/heart-logo.webp", buf(await render({ size: 192, type: "image/webp", quality: 0.92 })));
  /* шапка: живой SVG-знак (бьётся вместе с сердцем, styles.css) и поверх - картинка одного сердца */
  out("assets/heart-core.webp", buf(await render({ size: 208, heartOnly: true, type: "image/webp", quality: 0.92 })));
  const { signSVG } = await import("./src/zone-sign.js");
  const hp = path.join(ROOT, "partials/header.html");
  const header = fs.readFileSync(hp, "utf8");
  const logo =
    '<span class="rad-logo" aria-hidden="true">' +
    signSVG() +
    '<img src="/assets/heart-core.webp" width="52" height="52" alt="" decoding="async"></span>';
  const re = /<span class="rad-logo" aria-hidden="true">[\s\S]*?<\/span>/;
  if (!re.test(header)) throw new Error("build-logo: не найден логотип в partials/header.html");
  fs.writeFileSync(
    hp,
    header.replace(re, () => logo)
  );

  out("favicon-32.png", buf(await render({ size: 32, bands: 2 })));
  out("apple-touch-icon.png", buf(await render({ size: 180, bg: true, pad: 0.08 })));
  const fav = (await render({ size: 96, bands: 2 })).split(",")[1];
  out(
    "favicon.svg",
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><image width="96" height="96" href="data:image/png;base64,' +
      fav +
      '"/></svg>\n'
  );

  /* общее превью сайта 1200×628 */
  await page.setViewportSize({ width: 1200, height: 628 });
  await page.goto(base + "/previews/site.html");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ROOT, "assets/preview.jpg"), type: "jpeg", quality: 88 });

  await browser.close();
  server.close();
  console.log("Логотип, иконки и превью обновлены");
})().catch(e => {
  console.error(e);
  process.exit(1);
});
