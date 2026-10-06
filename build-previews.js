#!/usr/bin/env node
"use strict";
/* Ссылки на карточки игроков с превью «Личное дело сталкера». Запускается после build.js (npm run build).
 * 1. dist/p/<id>.html для каждого игрока: заголовок, описание и картинка для соцсетей и мессенджеров,
 *    посетителя страница сразу переводит на /top100#p=<id> (там открывается карточка).
 *    Ссылки вида /top100#p=<id> тоже работают, но соцсети не видят, что после #, и показывают общее превью Топ-100.
 * 2. dist/og/p/<id>.jpg — личная картинка 1200×630 для игроков, у которых есть место в топ-100 хотя бы одного рейтинга.
 *    Рисует Chrome по шаблону previews/dossier.html (нужен playwright-core и установленный Chrome/Edge;
 *    в GitHub Actions Chrome уже есть). Нет Chrome — у всех будет общая картинка assets/preview-dossier.jpg.
 * node build-previews.js --generic — перерисовать общую картинку assets/preview-dossier.jpg (её коммитят в репозиторий) */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");
const SITE = "https://heart-of-the-zone.ru";
const GENERIC = "assets/preview-dossier.jpg";
const W = 1200, H = 630;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = n => Number(n || 0).toLocaleString("ru-RU").replace(/\u202f|\u00a0/g, " ");

/* названия, цвета показателей и эмблемы — из тех же файлов, что использует сайт */
const tabsSrc = fs.readFileSync(path.join(ROOT, "top100.js"), "utf8");
const TABS = [...tabsSrc.matchAll(/key:"(\w+)",label:"([^"]+)"[^}]*?accent:"(#[0-9a-fA-F]+)"/g)].map(m => ({ key: m[1], label: m[2], accent: m[3] }));
const uiSrc = fs.readFileSync(path.join(ROOT, "ui.js"), "utf8");
const GLYPHS = Object.fromEntries([...uiSrc.matchAll(/^\s*(merc|dolg|svoboda|science|monolith|rassvet|loners): '(.*)',?\s*$/gm)].map(m => [m[1], m[2]]));
const FACTION_KEY = Object.fromEntries([...uiSrc.matchAll(/\{ key: "(\w+)", label: "([^"]+)"/g)].map(m => [m[2], m[1]]));
/* звания — как в player-card.js */
const TITLES = [[30, "Легенда"], [25, "Мастер"], [20, "Ветеран"], [10, "Опытный"], [0, "Новичок"]];
const titleOf = l => TITLES.find(t => (l || 0) >= t[0])[1];

function shield(color, ch) {
  const c = esc(color);
  return '<svg viewBox="0 0 64 72"><path d="M7 3h50a3 3 0 0 1 3 3v34c0 14-12 24-28 30C16 64 4 54 4 40V6a3 3 0 0 1 3-3z" fill="#0b0f14" stroke="' + c + '" stroke-width="3.5" stroke-linejoin="round"/>'
    + '<path d="M5.8 4.8h52.4V13H5.8z" fill="' + c + '"/><path d="M10 18h44v21c0 11-9 18-22 23C19 57 10 50 10 39z" fill="none" stroke="' + c + '" stroke-opacity=".5" stroke-width="1.2" stroke-dasharray="3 2.5"/>'
    + '<text x="32" y="48" text-anchor="middle" font-family="Oswald,Arial,sans-serif" font-size="26" font-weight="600" fill="' + c + '">' + esc(ch) + "</text></svg>";
}
function factionColor(data, g) {
  if (!g) return "#8196a9";
  if (data.factions && data.factions[g]) return data.factions[g];
  let h = 0; for (const c of g) h = (h * 31 + c.charCodeAt(0)) % 360;
  return "hsl(" + h + " 55% 62%)";
}

/* данные для шаблона */
function cardData(data, id) {
  const p = data.players[id], M = data.metrics, key = FACTION_KEY[p.g];
  const color = factionColor(data, p.g);
  const places = M.map((k, i) => ({ k, i, r: p.r[i] })).filter(x => x.r && TABS.some(t => t.key === x.k))
    .sort((a, b) => a.r - b.r || TABS.findIndex(t => t.key === a.k) - TABS.findIndex(t => t.key === b.k));
  const tab = k => TABS.find(t => t.key === k);
  const best = places[0];
  return {
    num: String(id).padStart(6, "0"), nick: p.n, color, off: !!p.off,
    bg: key ? "../assets/bg-" + key + "-1280.webp" : null,
    patch: key && GLYPHS[key] ? '<svg viewBox="0 0 64 72">' + GLYPHS[key] + "</svg>" : shield(color, ((p.g || p.n).replace(/[^\p{L}\p{N}]/gu, "")[0] || "?").toUpperCase()),
    rows: [["Группировка", p.g || "Одиночка", true], ["Звание", titleOf(p.l)], ["Уровень", String(p.l)], ...(p.z ? [["В Зоне", p.z]] : [])],
    tiles: places.slice(0, 4).map(x => ({ label: tab(x.k).label, value: fmt(p.v[x.i]), rank: x.r, accent: tab(x.k).accent })),
    stamp: best && best.r === 1 ? ['<span><span class="no">№</span>1</span>', tab(best.k).label] : best && best.r <= 10 ? ["Топ-10", "Зоны"] : null,
    foot: "Данные на " + String(data.updated || "").slice(0, 10),
    places
  };
}

function findChrome() {
  const list = [process.env.CHROME_PATH];
  if (process.platform === "win32") {
    for (const base of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean))
      list.push(base + "\\Google\\Chrome\\Application\\chrome.exe", base + "\\Microsoft\\Edge\\Application\\msedge.exe");
  } else {
    list.push("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    try { list.push(execFileSync("which", ["chromium"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()); } catch (e) {}
  }
  return list.find(f => f && fs.existsSync(f)) || null;
}

async function openBrowser() {
  let pw;
  try { pw = require("playwright-core"); } catch (e) { return { why: "нет playwright-core (npm install)" }; }
  const exe = findChrome();
  if (!exe) return { why: "не найден Chrome или Edge (можно указать путь в CHROME_PATH)" };
  const browser = await pw.chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--force-color-profile=srgb"] });
  return { browser };
}
async function newShooter(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(ROOT, "previews", "dossier.html").replace(/\\/g, "/"));
  return async (d, file) => {
    await page.evaluate(x => window.render(x), d);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, type: "jpeg", quality: 80 });
  };
}

async function generic() {
  const { browser, why } = await openBrowser();
  if (!browser) { console.error("Не получилось: " + why); process.exit(1); }
  const shoot = await newShooter(browser);
  await shoot({
    num: null, nick: null, title: "Личное дело", color: "#d9a52c", off: false, bg: "../assets/bg-merc-1280.webp",
    patch: shield("#d9a52c", "?"),
    rows: [["Группировка", null], ["Звание", null], ["Уровень", null]],
    tiles: TABS.slice(0, 4).map(t => ({ label: t.label, value: null, rank: null, accent: t.accent })),
    stamp: ["Секретно", "сеть сталкеров"], foot: "Карточки игроков · Топ-100"
  }, path.join(ROOT, GENERIC));
  await browser.close();
  console.log("Готово: " + GENERIC);
}

async function main() {
  if (!fs.existsSync(OUT)) { console.error("Сначала node build.js"); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "top100-players.json"), "utf8"));
  const ids = Object.keys(data.players);
  /* версия картинок меняется и при новых данных, и при смене оформления карточки —
     иначе мессенджеры и соцсети берут из своего кэша старую картинку по тому же адресу */
  const vh = crypto.createHash("sha1").update(String(data.updated));
  for (const f of ["build-previews.js", "ui.js", "top100.js", "top100/factions.json", ...fs.readdirSync(path.join(ROOT, "previews")).map(f => "previews/" + f)]) {
    const fp = path.join(ROOT, f);
    if (fs.existsSync(fp) && fs.statSync(fp).isFile()) vh.update(f).update(fs.readFileSync(fp));
  }
  const ver = vh.digest("hex").slice(0, 8);
  const genericVer = crypto.createHash("sha1").update(fs.readFileSync(path.join(ROOT, GENERIC))).digest("hex").slice(0, 8);

  /* личные картинки — тем, у кого есть место в топ-100 */
  const withImg = new Set();
  const want = ids.filter(id => data.players[id].r.some(r => r && r <= 100));
  const { browser, why } = await openBrowser();
  if (browser) {
    const t0 = Date.now(), queue = want.slice();
    await Promise.all([0, 1, 2, 3].map(async () => {
      const shoot = await newShooter(browser);
      while (queue.length) { const id = queue.shift(); await shoot(cardData(data, id), path.join(OUT, "og", "p", id + ".jpg")); withImg.add(id); }
    }));
    await browser.close();
    console.log("Превью «Личное дело»: " + withImg.size + " картинок за " + ((Date.now() - t0) / 1000).toFixed(0) + " с");
  } else console.log("Превью «Личное дело»: личные картинки пропущены — " + why + ". У всех общая картинка");

  /* страницы-ссылки /p/<id> */
  fs.mkdirSync(path.join(OUT, "p"), { recursive: true });
  for (const id of ids) {
    const p = data.players[id], d = cardData(data, id);
    const target = "/top100#p=" + encodeURIComponent(id);
    const title = p.n + " — личное дело сталкера";
    const desc = [(p.g || "Одиночка") + " · " + titleOf(p.l) + ", " + p.l + " ур.",
      ...d.places.slice(0, 3).map(x => TABS.find(t => t.key === x.k).label + " " + fmt(p.v[x.i]) + " (#" + x.r + ")")].join(" · ");
    const img = withImg.has(id) ? SITE + "/og/p/" + id + ".jpg?v=" + ver : SITE + "/" + GENERIC + "?v=" + genericVer;
    const html = '<!doctype html>\n<html lang="ru"><head><meta charset="utf-8">\n'
      + "<title>" + esc(title) + " · Сердце Зоны</title>\n"
      + '<meta name="viewport" content="width=device-width,initial-scale=1">\n<meta name="robots" content="noindex,follow">\n'
      + '<meta name="description" content="' + esc(desc) + '">\n<link rel="canonical" href="' + SITE + '/top100">\n'
      + '<meta property="og:type" content="profile">\n<meta property="og:site_name" content="Сердце Зоны">\n'
      + '<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="' + esc(desc) + '">\n'
      + '<meta property="og:url" content="' + SITE + "/p/" + encodeURIComponent(id) + '">\n'
      + '<meta property="og:image" content="' + esc(img) + '">\n<meta property="og:image:width" content="' + W + '">\n<meta property="og:image:height" content="' + H + '">\n'
      + '<meta property="og:image:alt" content="' + esc(title) + '">\n<meta property="og:locale" content="ru_RU">\n<meta name="twitter:card" content="summary_large_image">\n'
      + '<meta name="theme-color" content="#070d18">\n'
      + "<script>location.replace(" + JSON.stringify(target) + ")</script>\n"
      + '</head><body style="background:#07090b;color:#dfe7ee;font:16px system-ui,sans-serif;padding:40px;text-align:center">'
      + '<a href="' + target + '" style="color:#aec8ec">Открыть карточку игрока ' + esc(p.n) + "</a></body></html>\n";
    fs.writeFileSync(path.join(OUT, "p", id + ".html"), html);
  }
  console.log("Ссылки на карточки: " + ids.length + " стр. в dist/p");
}

(process.argv.includes("--generic") ? generic() : main()).catch(e => { console.error(e); process.exit(1); });
