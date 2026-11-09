/* Скриншоты собранного сайта (dist/) на компьютере и телефоне + ошибки консоли, CSP и битые запросы.
   node .claude/skills/verify-and-ship/screenshots.mjs [--pages /,/calculator] [--out папка] [--theme dolg]
     [--ls ключ=значение] [--url http://localhost:3000] [--only desktop|mobile] [--viewport] [--tour] [--serve]
   Без --url сам отдаёт dist/ на свободном порту (адреса без .html, как GitHub Pages). Код выхода 1 - нашлись ошибки. */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DIST = path.join(ROOT, "dist");
const require = createRequire(path.join(ROOT, "package.json"));

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};
const flag = name => argv.includes("--" + name);
const PAGES = opt("pages", "/,/calculator,/top100,/factions,/info,/guides")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
const OUT = path.resolve(opt("out", path.join(os.tmpdir(), "hotz-shots")));
const VIEWS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};
const ONLY = opt("only", "");
/* интро ПДА для новичков закрыло бы страницу; подсказку темы и кнопку тура глушим, чтобы кадры были стабильны */
const STORAGE = { zonePdaSeen: "1", zoneThemeHintSeen: "1" };
if (!flag("tour")) STORAGE.zoneTourSeen = "1";
if (opt("theme")) STORAGE.zoneTheme = opt("theme");
argv.forEach((a, i) => {
  if (a === "--ls" && argv[i + 1]) {
    const [k, ...v] = argv[i + 1].split("=");
    STORAGE[k] = v.join("=");
  }
});

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};
/* те же правила, что у dev.js: /calculator -> calculator.html, /guide/x -> guide/x.html, иначе 404.html */
function resolve(p) {
  try {
    p = decodeURIComponent(p);
  } catch (e) {
    return null;
  }
  const file = path.normalize(path.join(DIST, p));
  if (!file.startsWith(DIST)) return null;
  const tries = p.endsWith("/")
    ? [path.join(file, "index.html")]
    : [file, file + ".html", path.join(file, "index.html")];
  return tries.find(f => fs.existsSync(f) && fs.statSync(f).isFile()) || null;
}
function startServer(port) {
  const server = http.createServer((req, res) => {
    let file = resolve(new URL(req.url, "http://x").pathname),
      status = 200;
    if (!file) [file, status] = [path.join(DIST, "404.html"), 404];
    res.writeHead(status, {
      "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store"
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(ok => server.listen(port, "127.0.0.1", () => ok(server)));
}

if (!opt("url") && !fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("Нет dist/index.html - сначала node build.js");
  process.exit(2);
}

if (flag("serve")) {
  const port = +opt("port", "3000");
  await startServer(port);
  console.log(
    "dist/ на http://localhost:" + port + "/ (service worker тоже отдаётся - для проверки без него лучше dev.js)"
  );
} else {
  await shoot();
}

function findBrowser(pw) {
  const fromRepo = require("./build-chrome.js").findChrome();
  if (fromRepo) return fromRepo;
  /* браузер, скачанный npx playwright install chromium (~/.cache/ms-playwright) */
  try {
    const exe = pw.chromium.executablePath();
    if (exe && fs.existsSync(exe)) return exe;
  } catch (e) {}
  return null;
}

async function shoot() {
  const pw = require("playwright-core");
  const exe = findBrowser(pw);
  if (!exe) {
    console.error("Не найден Chrome/Chromium: укажите CHROME_PATH или npx playwright install chromium");
    process.exit(2);
  }
  let server = null,
    base = opt("url");
  if (!base) {
    server = await startServer(0);
    base = "http://localhost:" + server.address().port;
  }
  base = base.replace(/\/$/, "");
  fs.mkdirSync(OUT, { recursive: true });
  if (OUT.startsWith(ROOT + path.sep)) console.warn("Внимание: скриншоты внутри репозитория - не закоммитьте их");

  const browser = await pw.chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
  let problems = 0;
  try {
    for (const [view, conf] of Object.entries(VIEWS)) {
      if (ONLY && ONLY !== view) continue;
      /* service worker выключен: иначе можно увидеть закэшированную старую сборку */
      const context = await browser.newContext({ ...conf, serviceWorkers: "block", locale: "ru-RU" });
      await context.addInitScript(s => {
        try {
          for (const k in s) localStorage.setItem(k, s[k]);
        } catch (e) {}
        window.__csp = [];
        document.addEventListener("securitypolicyviolation", e =>
          window.__csp.push(e.violatedDirective + " " + (e.blockedURI || "inline") + " (" + e.sourceFile + ")")
        );
      }, STORAGE);
      for (const p of PAGES) {
        const page = await context.newPage();
        const errors = [];
        page.on("console", m => {
          if (m.type() === "error") errors.push("console: " + m.text());
        });
        page.on("pageerror", e => errors.push("исключение: " + e.message));
        page.on("requestfailed", r => {
          const why = r.failure() ? r.failure().errorText : "";
          if (!/ERR_ABORTED/.test(why)) errors.push("запрос не прошёл: " + r.url() + " " + why);
        });
        page.on("response", r => {
          if (r.status() >= 400) errors.push("HTTP " + r.status() + ": " + r.url());
        });
        const name = (p.replace(/^\/|\/$/g, "").replace(/[^\w-]+/g, "_") || "home") + "-" + view + ".png";
        try {
          await page.goto(base + p, { waitUntil: "load", timeout: 30000 });
          await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
          await page.waitForTimeout(700);
          for (const v of await page.evaluate(() => window.__csp)) errors.push("CSP: " + v);
          await page.screenshot({ path: path.join(OUT, name), fullPage: !flag("viewport"), timeout: 30000 });
        } catch (e) {
          errors.push("не удалось снять: " + e.message.split("\n")[0]);
        }
        problems += errors.length;
        console.log((errors.length ? "!! " : "ok ") + path.join(OUT, name));
        for (const e of [...new Set(errors)]) console.log("     " + e);
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }
  console.log(problems ? "Есть ошибки: " + problems : "Ошибок консоли, CSP и запросов нет");
  process.exitCode = problems ? 1 : 0;
}
