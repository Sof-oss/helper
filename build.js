#!/usr/bin/env node
"use strict";
/* Сборка для деплоя: исходники из корня -> ./dist
 * 0. Общие куски (partials/header.html, partials/footer.html) подставляются вместо <!-- @include имя -->,
 *    в шапке помечается активный пункт меню: так меню правится в одном месте, а не в каждой странице.
 * 0б. 3D главной (src/home-3d.js + three.js) собирается esbuild: маленький home-3d.js и догружаемые части в dist/3d/.
 * 1. Таблицы «Информации» и «Топ-100» дописываются прямо в HTML: их видят поисковики и те, у кого выключен JS.
 *    Разметку рисуют те же info.js / info-tasks.js / top100.js, что работают в браузере, поэтому она совпадает.
 * 2. Стили страницы склеиваются в один файл (bundle-*.css), css и js сжимаются esbuild.
 * 3. Ссылки на css, js и картинки получают ?v=<хэш содержимого>, после деплоя старый кэш не подтянется.
 * 4. В sitemap.xml дописывается lastmod: дата последнего коммита страницы и её css/js, у Топ-100 — время выгрузки рейтинга.
 * Запуск: npm install (один раз, ставит esbuild), затем node build.js. Без esbuild сборка тоже пройдёт, но без сжатия */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

let esbuild = null;
try { esbuild = require("esbuild"); } catch (e) {
  console.warn("Предупреждение: esbuild не установлен (npm install), css и js не будут сжаты");
}

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");

/* в dist не попадает служебное и исходники сборки (CSV рейтинга нужны только для build-top100.js) */
const SKIP = new Set([
  ".git", ".github", ".gitignore", "dist", "node_modules", "top100", "partials", "src",
  "README.md", "build.js", "build-top100.js", "build-top100.bat", "package.json", "package-lock.json"
]);


/* ---------- копирование ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const name of fs.readdirSync(ROOT)) {
  if (SKIP.has(name)) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
}

/* ---------- 3D главной ----------
   src/home-3d.js — маленький загрузчик; заставка (zone-intro.js), живой фон (zone-bg.js) и общий кусок three.js
   собираются в отдельные файлы dist/3d/*-<хэш>.js и скачиваются только когда нужны. Хэш в имени — защита от старого кэша.
   Из three.js попадает только используемое. Без esbuild 3D не собирается: главная работает с обычным фоном */
if (esbuild) {
  const r = esbuild.buildSync({
    entryPoints: [path.join(ROOT, "src", "home-3d.js")], outdir: OUT, entryNames: "[name]", chunkNames: "3d/[name]-[hash]",
    bundle: true, splitting: true, format: "esm", minify: true, target: "es2020", legalComments: "none", charset: "utf8", metafile: true
  });
  const parts = Object.entries(r.metafile.outputs).map(([f, o]) => path.basename(f).replace(/-[A-Z0-9]{8}\.js$/, ".js").replace(/^chunk\.js$/, "three.js (общий)") + " " + (o.bytes / 1024).toFixed(0) + " КБ");
  console.log("3D главной: " + parts.join(", "));
} else {
  console.warn("Предупреждение: без esbuild 3D главной не собран");
}

/* ---------- общие куски страниц ----------
   <!-- @include header active="/calculator" --> -> partials/header.html; ссылки с href="/calculator" получают
   class="active" и aria-current="page". Без active (страница 404) ничего не подсвечивается.
   Неизвестный кусок или active без пункта меню роняют сборку, чтобы не выпустить страницу без шапки */
const INCLUDE = /<!--\s*@include\s+([\w-]+)(?:\s+active="([^"]*)")?\s*-->\n?/g;
const partial = name => {
  const file = path.join(ROOT, "partials", name + ".html");
  if (!fs.existsSync(file)) throw new Error("Нет файла partials/" + name + ".html");
  return fs.readFileSync(file, "utf8");
};
function applyIncludes(html, from) {
  return html.replace(INCLUDE, (m, name, active) => {
    let part = partial(name);
    if (active !== undefined) {
      const link = '<a href="' + active + '"';
      if (!part.includes(link)) throw new Error(from + ": в partials/" + name + ".html нет пункта меню " + active);
      part = part.split(link).join('<a class="active" href="' + active + '" aria-current="page"');
    }
    return part.endsWith("\n") ? part : part + "\n";
  });
}
for (const name of fs.readdirSync(OUT).filter(f => f.endsWith(".html"))) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, applyIncludes(fs.readFileSync(file, "utf8"), name));
}

/* ---------- пререндер ---------- */
/* заглушка DOM: скрипты страницы пишут в innerHTML по id, мы забираем то, что они туда положили */
function fakeDom() {
  const els = {};
  const el = id => (els[id] = els[id] || {
    innerHTML: "", textContent: "", dataset: {}, hidden: false,
    classList: { toggle() {} }, setAttribute() {}, addEventListener() {}, insertAdjacentHTML() {}, focus() {},
    querySelector: () => el("_" + id)
  });
  const document = { getElementById: el, querySelectorAll: () => [], querySelector: () => null, addEventListener() {} };
  return { els, document };
}

/* прогоняет скрипты страницы в том же порядке, что в HTML, возвращает заполненные элементы */
function runPageScripts(htmlSrc) {
  const { els, document } = fakeDom();
  const sandbox = { document, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const m of htmlSrc.matchAll(/<script src="([^"]+)"><\/script>/g)) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, m[1]), "utf8"), sandbox, { filename: m[1] });
  }
  return els;
}

/* кладёт inner в пустой элемент с нужным id; если элемента нет, сборка падает, а не молча выпускает пустую страницу */
function fill(html, id, inner, attrs) {
  if (!inner) throw new Error("Пустой рендер для #" + id);
  const re = new RegExp('(<(\\w+)[^>]*\\sid="' + id + '"[^>]*)>[^<]*</\\2>');
  if (!re.test(html)) throw new Error("В HTML нет элемента #" + id);
  return html.replace(re, (_, open, tag) => open + (attrs || "") + ">" + inner + "</" + tag + ">");
}

/* прогоняет только перечисленные скрипты (для страниц, где остальные скрипты в заглушке DOM не нужны) */
function runScripts(files) {
  const { els, document } = fakeDom();
  const sandbox = { document, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, { filename: f });
  return els;
}

const PRERENDER = {
  /* «Что нового?» на главной уходит в HTML готовым, чтобы был виден сразу и поисковикам */
  "index.html": html => fill(html, "homeNews", runScripts(["changelog.js"]).homeNews.innerHTML),
  "info.html": (html, els) => {
    html = fill(html, "infoTabs", els.infoTabs.innerHTML);
    html = fill(html, "infoGroups", els.infoGroups.innerHTML, ' data-active="' + els.infoGroups.dataset.active + '"');
    return fill(html, "tasksRoot", els.tasksRoot.innerHTML);
  },
  /* у рейтинга в HTML уходит стартовая вкладка; остальные рисует JS по клику */
  "top100.html": (html, els) => {
    html = fill(html, "top100Tabs", els.top100Tabs.innerHTML);
    html = fill(html, "top100TableWrap", els.top100TableWrap.innerHTML);
    return fill(html, "top100Updated", els.top100Updated.textContent);
  }
};

/* ---------- склейка стилей ----------
   Все локальные <link rel="stylesheet"> страницы по порядку склеиваются в один bundle-<хэш>.css в корне dist,
   поэтому относительные url() внутри стилей остаются верными. Одинаковые наборы на разных страницах
   дают один и тот же файл. Исходные css в dist после этого не нужны и удаляются */
const LOCAL_CSS = /<link rel="stylesheet" href="(\/?)([^":]+\.css)">\n?/g;
const bundledCss = new Set();
for (const name of fs.readdirSync(OUT).filter(f => f.endsWith(".html"))) {
  const file = path.join(OUT, name);
  let html = fs.readFileSync(file, "utf8");
  const links = [...html.matchAll(LOCAL_CSS)];
  if (links.length < 1) continue;
  const list = links.map(m => m[2]);
  const css = list.map(f => "/* " + f + " */\n" + fs.readFileSync(path.join(OUT, f), "utf8")).join("\n");
  const bundle = "bundle-" + crypto.createHash("sha1").update(list.join("|")).digest("hex").slice(0, 8) + ".css";
  fs.writeFileSync(path.join(OUT, bundle), css);
  list.forEach(f => bundledCss.add(f));
  let first = true;
  html = html.replace(LOCAL_CSS, (m, slash) => {
    if (!first) return "";
    first = false;
    return '<link rel="stylesheet" href="' + slash + bundle + '">\n';
  });
  fs.writeFileSync(file, html);
}
bundledCss.forEach(f => fs.rmSync(path.join(OUT, f)));

/* ---------- сжатие ----------
   js — обычные скрипты (не модули) с общими глобальными именами: esbuild без format не переименовывает
   имена верхнего уровня, поэтому app.js / polish.js / talents.js продолжают видеть друг друга */
if (esbuild) {
  let saved = 0;
  for (const name of fs.readdirSync(OUT).filter(f => /\.(css|js)$/.test(f) && f !== "home-3d.js")) {
    const file = path.join(OUT, name);
    const src = fs.readFileSync(file, "utf8");
    const out = esbuild.transformSync(src, { loader: name.endsWith(".css") ? "css" : "js", minify: true, target: name.endsWith(".css") ? ["chrome100", "safari15", "firefox100"] : "es2020", legalComments: "none", charset: "utf8" }).code;
    saved += src.length - out.length;
    fs.writeFileSync(file, out);
  }
  console.log("Сжатие css и js: −" + (saved / 1024).toFixed(1) + " КБ");
}

/* ---------- версии файлов ---------- */
const hashCache = new Map();
function fileHash(rel) {
  if (!hashCache.has(rel)) {
    hashCache.set(rel, crypto.createHash("sha1").update(fs.readFileSync(path.join(OUT, rel))).digest("hex").slice(0, 8));
  }
  return hashCache.get(rel);
}

/* "assets/x.webp" или "/styles.css" -> с ?v=. Внешние, data: и якоря не трогаем */
function version(url, from) {
  if (/^([a-z]+:)?\/\//i.test(url) || /^(data:|#)/.test(url) || url.includes("?")) return url;
  const rel = url.startsWith("/") ? url.slice(1) : url;
  if (!fs.existsSync(path.join(OUT, rel))) {
    console.warn("Предупреждение: в " + from + " нет файла для ссылки " + url);
    return url;
  }
  return url + "?v=" + fileHash(rel);
}

/* сначала css: версии картинок и шрифтов внутри, потом хэш самих css попадёт в HTML уже с ними */
for (const name of fs.readdirSync(OUT).filter(f => f.endsWith(".css"))) {
  const file = path.join(OUT, name);
  const css = fs.readFileSync(file, "utf8").replace(/url\((["']?)([^"')]+)\1\)/g, (m, q, u) => "url(" + q + version(u, name) + q + ")");
  fs.writeFileSync(file, css);
}

/* ---------- html ---------- */
let pages = 0;
for (const name of fs.readdirSync(OUT).filter(f => f.endsWith(".html"))) {
  let html = fs.readFileSync(path.join(OUT, name), "utf8");
  const before = html.length;
  /* обработчику с одним аргументом скрипты страницы не нужны — он сам решает, что прогнать */
  if (PRERENDER[name]) html = PRERENDER[name].length > 1 ? PRERENDER[name](html, runPageScripts(html)) : PRERENDER[name](html);
  html = html
    .replace(/(<link\b[^>]*?\shref=")([^"]+)(")/g, (m, a, u, b) => a + version(u, name) + b)
    .replace(/(<script\b[^>]*?\ssrc=")([^"]+)(")/g, (m, a, u, b) => a + version(u, name) + b);
  fs.writeFileSync(path.join(OUT, name), html);
  pages++;
  console.log(name.padEnd(16), (before / 1024).toFixed(1) + " КБ -> " + (html.length / 1024).toFixed(1) + " КБ");
}

/* ---------- sitemap.xml: lastmod ----------
   Дата страницы — последний коммит её html и подключённых css/js (в GitHub Actions нужен checkout с fetch-depth: 0).
   У Топ-100 — время выгрузки рейтинга из top100-data.js (по Москве): страница меняется вместе с данными */
function gitDate(files) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", ...files], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (out) return out;
  } catch (e) {}
  return new Date(Math.max(...files.map(f => fs.statSync(path.join(ROOT, f)).mtimeMs))).toISOString();
}
function top100Date() {
  const m = fs.readFileSync(path.join(ROOT, "top100-data.js"), "utf8").match(/TOP100_UPDATED="(\d\d)\.(\d\d)\.(\d{4}) (\d\d:\d\d:\d\d)"/);
  return m ? m[3] + "-" + m[2] + "-" + m[1] + "T" + m[4] + "+03:00" : null;
}
function pageDeps(page) {
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  const deps = [...html.matchAll(/(?:href|src)="\/?([^":?#]+\.(?:css|js))"/g)].map(m => m[1]).filter(f => fs.existsSync(path.join(ROOT, f)));
  /* меню и подвал из partials тоже влияют на дату страницы */
  const parts = [...html.matchAll(/<!--\s*@include\s+([\w-]+)/g)].map(m => "partials/" + m[1] + ".html").filter(f => fs.existsSync(path.join(ROOT, f)));
  return [page, ...new Set([...deps, ...parts])];
}
const smSrc = path.join(ROOT, "sitemap.xml");
if (fs.existsSync(smSrc)) {
  const sm = fs.readFileSync(smSrc, "utf8").replace(/<url><loc>([^<]+)<\/loc>(?:<lastmod>[^<]*<\/lastmod>)?<\/url>/g, (m, loc) => {
    /* адреса в sitemap без .html (/calculator), файл страницы — calculator.html */
    const slug = new URL(loc).pathname.replace(/^\//, "");
    const page = !slug ? "index.html" : slug.endsWith(".html") ? slug : slug + ".html";
    if (!fs.existsSync(path.join(ROOT, page))) return m;
    const date = (page === "top100.html" && top100Date()) || gitDate(pageDeps(page));
    return "<url><loc>" + loc + "</loc><lastmod>" + date + "</lastmod></url>";
  });
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), sm);
}
console.log("Готово: " + pages + " стр. в " + path.relative(process.cwd(), OUT));
