#!/usr/bin/env node
"use strict";
/* Локальная проверка сайта: node dev.js (или двойной клик по dev.bat).
   1. Собирает сайт (node build.js) в dist/.
   2. Запускает сервер http://localhost:3000 с адресами как на GitHub Pages (/top100, /calculator, 404.html).
   3. Следит за файлами проекта: после сохранения сайт пересобирается сам, а открытые вкладки обновляются.
      Изменили site-news.json - перед сборкой запускается ещё build-changelog.js.
   Только для проверки на своём ПК, на сайт не попадает (build.js его пропускает).
   - Офлайн-кэш (service worker) здесь выключен, чтобы браузер не показывал старую версию.
     Проверить офлайн-режим: node dev.js --sw
   - Картинки гайдов и превью (build-guide-images.js, build-previews.js) здесь не пересобираются - их делает деплой.
   Параметры: --port 3001 - другой порт, --no-open - не открывать браузер */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");
const args = process.argv.slice(2);
const SW = args.includes("--sw");
const OPEN = !args.includes("--no-open");
let port = +(args[args.indexOf("--port") + 1] || 0) || 3000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};

/* ---------- сборка ---------- */
const time = () => new Date().toTimeString().slice(0, 8);
function run(file) {
  return new Promise(ok => {
    const p = spawn(process.execPath, [file], { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", c => (err += c));
    p.on("close", code => ok({ code, err }));
  });
}
let building = false,
  again = false,
  newsChanged = false,
  quietUntil = 0,
  lastError = "";
async function build(reason) {
  if (building) {
    again = true;
    return;
  }
  building = true;
  send("building");
  const t0 = Date.now();
  console.log(time() + "  сборка" + (reason ? " (" + reason + ")" : "") + "...");
  let res = { code: 0, err: "" };
  if (newsChanged) {
    newsChanged = false;
    res = await run("build-changelog.js");
  }
  if (res.code === 0) res = await run("build.js");
  /* сборка сама пишет файлы (changelog.js) - их изменения не должны запускать её снова */
  quietUntil = Date.now() + 400;
  building = false;
  if (res.code === 0) {
    lastError = "";
    /* предупреждения сборки (битые ссылки на файлы и т. п.) - тоже показываем */
    if (res.err.trim()) console.log(res.err.trim());
    console.log(time() + "  готово за " + ((Date.now() - t0) / 1000).toFixed(1) + " с - страница обновится сама");
    send("reload");
  } else {
    lastError = res.err.trim() || "сборка завершилась с ошибкой";
    console.log("\n" + time() + "  ОШИБКА СБОРКИ - в браузере пока прошлая версия:\n" + lastError + "\n");
    send("error", lastError.split("\n").slice(0, 3).join(" "));
  }
  if (again) {
    again = false;
    build("ещё изменения");
  }
}

/* ---------- слежение за файлами ---------- */
const IGNORE = /^(dist|node_modules|\.git|\.github)([\\/]|$)|(^|[\\/])\.|~$|\.(tmp|swp)$/;
let timer = null,
  changed = new Set();
function watch() {
  try {
    fs.watch(ROOT, { recursive: true }, (ev, name) => {
      if (!name) return;
      name = String(name);
      if (IGNORE.test(name) || Date.now() < quietUntil) return;
      if (name === "changelog.js" && building) return;
      if (name === "site-news.json") newsChanged = true;
      changed.add(name.replace(/\\/g, "/"));
      clearTimeout(timer);
      timer = setTimeout(() => {
        const list = [...changed];
        changed.clear();
        build(list.slice(0, 3).join(", ") + (list.length > 3 ? " и ещё " + (list.length - 3) : ""));
      }, 250);
    });
  } catch (e) {
    console.log("Не получилось следить за файлами (" + e.message + ") - после правок перезапустите dev.bat");
  }
}

/* ---------- живое обновление вкладок ---------- */
const clients = new Set();
function send(event, data) {
  for (const res of clients) res.write("event: " + event + "\ndata: " + JSON.stringify(data || "") + "\n\n");
}
/* скрипт для страниц: подключается отдельным файлом (встроенный запретила бы Content-Security-Policy сайта) */
const RELOAD_JS = `(function () {
  var box = null;
  function badge(text, bad) {
    if (!box) {
      box = document.createElement("div");
      box.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:2147483647;max-width:min(560px,90vw);padding:8px 12px;border-radius:8px;font:13px/1.35 system-ui,sans-serif;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.5);pointer-events:none";
      document.documentElement.appendChild(box);
    }
    box.style.background = bad ? "#b3261e" : "rgba(20,30,40,.92)";
    box.textContent = text;
    box.hidden = !text;
  }
  var es = new EventSource("/__dev/events");
  es.addEventListener("building", function () { badge("Сборка..."); });
  es.addEventListener("reload", function () { location.reload(); });
  es.addEventListener("error", function (e) {
    if (e.data) badge("Ошибка сборки: " + JSON.parse(e.data) + " (подробности - в окне dev.bat)", true);
  });
  es.onerror = function () { badge("dev.bat остановлен - перезапустите его", true); };
  es.onopen = function () { if (box && /остановлен/.test(box.textContent)) location.reload(); };
})();
`;
/* вместо офлайн-кэша - «пустой» service worker: он удаляет себя и кэш, если раньше был установлен настоящий */
const KILL_SW = `self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (k) { return Promise.all(k.map(function (c) { return caches.delete(c); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll(); })
      .then(function (list) { list.forEach(function (c) { c.navigate(c.url); }); })
  );
});
`;

/* ---------- сервер ---------- */
function resolve(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath);
  } catch (e) {
    return null;
  }
  const file = path.normalize(path.join(OUT, p));
  if (!file.startsWith(OUT)) return null;
  const tries = [file];
  if (p.endsWith("/")) tries.unshift(path.join(file, "index.html"));
  else tries.push(file + ".html", path.join(file, "index.html"));
  return tries.find(f => fs.existsSync(f) && fs.statSync(f).isFile()) || null;
}
function serve(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/__dev/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    res.write("retry: 1000\n\n");
    if (lastError) res.write("event: error\ndata: " + JSON.stringify(lastError.split("\n")[0]) + "\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (url.pathname === "/__dev/reload.js") {
    res.writeHead(200, { "content-type": TYPES[".js"], "cache-control": "no-store" });
    return res.end(RELOAD_JS);
  }
  if (url.pathname === "/sw.js" && !SW) {
    res.writeHead(200, { "content-type": TYPES[".js"], "cache-control": "no-store" });
    return res.end(KILL_SW);
  }
  let file = resolve(url.pathname),
    status = 200;
  if (!file) {
    status = 404;
    file = path.join(OUT, "404.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "content-type": TYPES[".txt"] });
      return res.end("404 - нет такого файла. Сайт ещё не собран?");
    }
  }
  const ext = path.extname(file).toLowerCase();
  const head = { "content-type": TYPES[ext] || "application/octet-stream", "cache-control": "no-store" };
  if (ext === ".html") {
    const html = fs.readFileSync(file, "utf8").replace(/<\/body>/i, '<script src="/__dev/reload.js"></script></body>');
    res.writeHead(status, head);
    return res.end(html);
  }
  res.writeHead(status, head);
  fs.createReadStream(file).pipe(res);
}

function openBrowser(url) {
  if (!OPEN) return;
  const cmd =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  try {
    spawn(cmd[0], cmd[1], { stdio: "ignore", detached: true }).unref();
  } catch (e) {}
}

function listen() {
  const server = http.createServer(serve);
  server.on("error", e => {
    if (e.code === "EADDRINUSE" && port < 3020) {
      port++;
      listen();
    } else {
      console.log("Не удалось запустить сервер: " + e.message);
      process.exit(1);
    }
  });
  server.listen(port, "127.0.0.1", () => {
    const url = "http://localhost:" + port + "/";
    console.log("\nСайт: " + url + (SW ? "  (офлайн-кэш включён)" : ""));
    console.log("Правьте файлы - сайт пересоберётся сам. Остановить: Ctrl+C или закрыть это окно.\n");
    openBrowser(url);
  });
}

(async () => {
  await build("запуск");
  watch();
  listen();
})();
