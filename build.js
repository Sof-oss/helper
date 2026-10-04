#!/usr/bin/env node
"use strict";
/* Сборка для деплоя: исходники из корня -> ./dist
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
  ".git", ".github", ".gitignore", "dist", "node_modules", "top100",
  "README.md", "build.js", "build-top100.js", "build-top100.bat", "package.json", "package-lock.json"
]);

/* файлы внутри папок, которые не нужны в dist (баннер в шапке сейчас закомментирован) */
const SKIP_PATHS = new Set(["assets/promo-banner.webp"]);
const rel = p => path.relative(ROOT, p).split(path.sep).join("/");

/* ---------- копирование ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const name of fs.readdirSync(ROOT)) {
  if (SKIP.has(name)) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true, filter: src => !SKIP_PATHS.has(rel(src)) });
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

const PRERENDER = {
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
  for (const name of fs.readdirSync(OUT).filter(f => /\.(css|js)$/.test(f))) {
    const file = path.join(OUT, name);
    const src = fs.readFileSync(file, "utf8");
    const out = esbuild.transformSync(src, { loader: name.endsWith(".css") ? "css" : "js", minify: true, legalComments: "none", charset: "utf8" }).code;
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
  if (PRERENDER[name]) html = PRERENDER[name](html, runPageScripts(html));
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
  return [page, ...new Set(deps)];
}
const smSrc = path.join(ROOT, "sitemap.xml");
if (fs.existsSync(smSrc)) {
  const sm = fs.readFileSync(smSrc, "utf8").replace(/<url><loc>([^<]+)<\/loc>(?:<lastmod>[^<]*<\/lastmod>)?<\/url>/g, (m, loc) => {
    const page = new URL(loc).pathname.replace(/^\//, "") || "index.html";
    if (!fs.existsSync(path.join(ROOT, page))) return m;
    const date = (page === "top100.html" && top100Date()) || gitDate(pageDeps(page));
    return "<url><loc>" + loc + "</loc><lastmod>" + date + "</lastmod></url>";
  });
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), sm);
}
console.log("Готово: " + pages + " стр. в " + path.relative(process.cwd(), OUT));
