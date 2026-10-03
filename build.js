#!/usr/bin/env node
"use strict";
/* Сборка для деплоя: исходники из корня -> ./dist
 * 1. Таблицы «Информации» и «Топ-100» дописываются прямо в HTML: их видят поисковики и те, у кого выключен JS.
 *    Разметку рисуют те же info.js / info-tasks.js / top100.js, что работают в браузере, поэтому она совпадает.
 * 2. Ссылки на css, js и картинки получают ?v=<хэш содержимого>, после деплоя старый кэш не подтянется.
 * Запуск: node build.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");

/* в dist не попадает служебное и исходники сборки (CSV рейтинга нужны только для build-top100.js) */
const SKIP = new Set([
  ".git", ".github", ".gitignore", "dist", "node_modules", "top100",
  "README.md", "build.js", "build-top100.js", "build-top100.bat", "package.json", "package-lock.json"
]);

/* ---------- копирование ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const name of fs.readdirSync(ROOT)) {
  if (SKIP.has(name)) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
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
console.log("Готово: " + pages + " стр. в " + path.relative(process.cwd(), OUT));
