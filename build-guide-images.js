#!/usr/bin/env node
"use strict";
/* Картинки гайдов для телефонов и соцсетей. Запускается перед build.js (npm run build, деплой).
 * Для каждой картинки guides/<адрес>/<файл> шире 800 px рядом кладётся уменьшенная копия <файл>-800w.webp:
 * build.js добавляет её в srcset, и телефон скачивает её вместо оригинала на 1600 px.
 * Для обложки гайда (первая картинка) рядом кладётся og.jpg 1200×630: VK и часть мессенджеров не показывают
 * превью в WebP. Готовые файлы не перерисовываются - их можно закоммитить вместе с гайдом.
 * Рисует Chrome (build-chrome.js). Нет Chrome - скрипт только предупреждает: сайт соберётся без уменьшенных копий */
const fs = require("fs");
const path = require("path");
const GuideMD = require("./guide-md.js");
const { openBrowser } = require("./build-chrome.js");

const ROOT = __dirname;
const DIR = path.join(ROOT, "guides");
const SMALL = 800;
const OG_W = 1200,
  OG_H = 630;
const IMG = /\.(webp|jpe?g|png)$/i;
const isGenerated = f => /-800w\.webp$/i.test(f) || f === "og.jpg";

const jobs = [];
if (fs.existsSync(DIR)) {
  for (const slug of fs.readdirSync(DIR)) {
    const md = path.join(DIR, slug, "index.md");
    if (!fs.existsSync(md)) continue;
    const files = fs.readdirSync(path.join(DIR, slug));
    for (const f of files.filter(f => IMG.test(f) && !isGenerated(f))) {
      const small = f.replace(IMG, "") + "-800w.webp";
      if (!files.includes(small))
        jobs.push({ kind: "small", src: path.join(DIR, slug, f), out: path.join(DIR, slug, small) });
    }
    const cover = GuideMD.firstImage(GuideMD.parse(fs.readFileSync(md, "utf8")).body);
    const coverFile = cover && cover.replace(/^\.\//, "");
    if (coverFile && files.includes(coverFile) && !files.includes("og.jpg"))
      jobs.push({ kind: "og", src: path.join(DIR, slug, coverFile), out: path.join(DIR, slug, "og.jpg") });
  }
}

async function main() {
  if (!jobs.length) return console.log("Картинки гайдов: всё готово");
  const { browser, why } = await openBrowser();
  if (!browser) {
    console.warn("Предупреждение: картинки гайдов не уменьшены - " + why);
    return;
  }
  const page = await browser.newPage();
  let made = 0;
  for (const j of jobs) {
    const ext = path.extname(j.src).slice(1).toLowerCase().replace("jpg", "jpeg");
    const dataUrl = "data:image/" + ext + ";base64," + fs.readFileSync(j.src).toString("base64");
    const out = await page.evaluate(
      async ({ dataUrl, kind, SMALL, OG_W, OG_H }) => {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        const c = document.createElement("canvas");
        const g = c.getContext("2d");
        g.imageSmoothingQuality = "high";
        if (kind === "small") {
          if (img.naturalWidth <= SMALL) return null;
          c.width = SMALL;
          c.height = Math.round((img.naturalHeight * SMALL) / img.naturalWidth);
          g.drawImage(img, 0, 0, c.width, c.height);
          return c.toDataURL("image/webp", 0.8);
        }
        /* обложка: заполнить 1200×630 с обрезкой по центру, как object-fit: cover */
        c.width = OG_W;
        c.height = OG_H;
        const k = Math.max(OG_W / img.naturalWidth, OG_H / img.naturalHeight);
        const w = img.naturalWidth * k,
          h = img.naturalHeight * k;
        g.fillStyle = "#0b0f16";
        g.fillRect(0, 0, OG_W, OG_H);
        g.drawImage(img, (OG_W - w) / 2, (OG_H - h) / 2, w, h);
        return c.toDataURL("image/jpeg", 0.85);
      },
      { dataUrl, kind: j.kind, SMALL, OG_W, OG_H }
    );
    if (!out) continue;
    fs.writeFileSync(j.out, Buffer.from(out.split(",")[1], "base64"));
    made++;
  }
  await browser.close();
  console.log("Картинки гайдов: создано " + made + " (уменьшенные копии и обложки og.jpg)");
}
main().catch(e => {
  console.warn("Предупреждение: картинки гайдов не уменьшены - " + e.message);
});
