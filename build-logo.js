#!/usr/bin/env node
"use strict";
/* Логотип и иконки сайта из previews/logo.html (знак радиации из src/zone-sign.js + 3D-сердце из src/zone-heart.js).
 * node build-logo.js - перерисовать assets/heart-logo.webp, assets/heart-core.webp, знак в partials/header.html,
 * favicon.svg, favicon.ico, favicon-32.png, apple-touch-icon.png, иконки приложения icon-192.png, icon-512.png,
 * icon-maskable-512.png (manifest.webmanifest), общее превью assets/preview.jpg и превью разделов
 * assets/preview-<раздел>.jpg (previews/site.html).
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

/* обложки разделов для соцсетей: assets/preview-<ключ>.jpg; on - номер подсвеченного раздела внизу картинки */
const SECTION_PREVIEWS = {
  calculator: {
    k: "Сердце Зоны · онлайн-помощник",
    h1: "Калькулятор<br>урона",
    size: 104,
    p: "Урон оружия с учётом уровня, снаряжения и талантов",
    bg: "bg-merc-1280",
    on: 1
  },
  top100: {
    k: "Сердце Зоны · онлайн-помощник",
    h1: "Топ-100",
    p: "Лучшие сталкеры в семи рейтингах и их личные дела",
    bg: "bg-dolg-1280",
    on: 2
  },
  info: {
    k: "Сердце Зоны · онлайн-помощник",
    h1: "Информация",
    p: "Таланты и опыт по уровням, задания локаций, боссы",
    bg: "bg-science-1280",
    on: 3
  },
  guides: {
    k: "Сердце Зоны · онлайн-помощник",
    h1: "Гайды",
    p: "Советы и прохождения от самих игроков",
    bg: "bg-svoboda-1280",
    on: 4
  }
};

/* ICO с PNG внутри: заголовок 6 байт, по 16 байт на картинку, потом сами PNG */
function icoFile(icons) {
  const head = Buffer.alloc(6 + 16 * icons.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(icons.length, 4);
  let offset = head.length;
  icons.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size % 256, e);
    head.writeUInt8(size % 256, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(png.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...icons.map(x => x.png)]);
}

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
  /* иконки приложения (manifest.webmanifest); у maskable поле шире - Android обрезает её кругом или скруглённым квадратом */
  out("icon-192.png", buf(await render({ size: 192, bg: true, pad: 0.08 })));
  out("icon-512.png", buf(await render({ size: 512, bg: true, pad: 0.08 })));
  out("icon-maskable-512.png", buf(await render({ size: 512, bg: true, pad: 0.2 })));
  /* favicon.svg - картинка 64 px в WebP внутри SVG (~4 КБ вместо 22 КБ с PNG 96 px) */
  const fav = (await render({ size: 64, bands: 2, type: "image/webp", quality: 0.8 })).split(",")[1];
  out(
    "favicon.svg",
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/webp;base64,' +
      fav +
      '"/></svg>\n'
  );
  /* favicon.ico для ботов, RSS-читалок и старых браузеров: 16, 32 и 48 px, внутри - PNG */
  const icons = [];
  for (const size of [16, 32, 48]) icons.push({ size, png: buf(await render({ size, bands: 2 })) });
  out("favicon.ico", icoFile(icons));

  /* общее превью сайта 1200×628 */
  await page.setViewportSize({ width: 1200, height: 628 });
  await page.goto(base + "/previews/site.html");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ROOT, "assets/preview.jpg"), type: "jpeg", quality: 88 });

  /* превью разделов: своя обложка у калькулятора, Топ-100, «Информации» и гайдов (та же страница с параметрами) */
  for (const [name, o] of Object.entries(SECTION_PREVIEWS)) {
    await page.goto(base + "/previews/site.html?" + name + "#" + encodeURIComponent(JSON.stringify(o)));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(ROOT, "assets/preview-" + name + ".jpg"), type: "jpeg", quality: 85 });
  }

  await browser.close();
  server.close();
  console.log("Логотип, иконки и превью обновлены");
})().catch(e => {
  console.error(e);
  process.exit(1);
});
