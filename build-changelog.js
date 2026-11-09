/* «Новости сайта»: записи пишутся руками в site-news.json, сообщения коммитов в новости не попадают.
   Скрипт дописывает только пункты «Добавлен гайд» для новых гайдов и готовит changelog.js для страницы. */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const FILE = path.join(__dirname, "changelog.js");
const DRY = process.argv.includes("--dry");
const NEWS_FILE = path.join(__dirname, "site-news.json");
const news = JSON.parse(fs.readFileSync(NEWS_FILE, "utf8"));
function validate(data) {
  if (data.version !== 1 || !Array.isArray(data.entries) || !Array.isArray(data.importedSources))
    throw new Error("site-news.json: нужны version: 1, entries и importedSources");
  if (!data.importedSources.every(x => typeof x === "string"))
    throw new Error("site-news.json: importedSources должен содержать только строки");
  for (const e of data.entries) {
    if (
      !e ||
      typeof e.date !== "string" ||
      !/^\d{4}-\d\d-\d\d$/.test(e.date) ||
      !Number.isFinite(Date.parse(e.date)) ||
      new Date(e.date).toISOString().slice(0, 10) !== e.date
    )
      throw new Error("site-news.json: неверная дата, ожидается ГГГГ-ММ-ДД");
    if (
      typeof e.title !== "string" ||
      !e.title.trim() ||
      !Array.isArray(e.items) ||
      !e.items.every(
        i => Array.isArray(i) && i.length === 2 && ["new", "up", "fix"].includes(i[0]) && typeof i[1] === "string"
      )
    )
      throw new Error("site-news.json: нужны заголовок title и items: [[тип, текст]] (new/up/fix)");
    if (e.hidden !== undefined && typeof e.hidden !== "boolean")
      throw new Error("site-news.json: hidden должен быть true или false");
  }
}
validate(news);
const imported = new Set(news.importedSources);
/* гайды (адрес папки), которые не попадают в «Что нового?» */
const SKIP_GUIDES = [];
/* "прямые кавычки" вне HTML-тегов - в «ёлочки», как на сайте */
const quotes = s =>
  s
    .split(/(<[^>]*>)/)
    .map(part => (part.startsWith("<") ? part : part.replace(/"([^"<>]*)"/g, "«$1»")))
    .join("");

let src = fs.readFileSync(FILE, "utf8");
const DATA_RE = /window\.CHANGELOG\s*=\s*\[[\s\S]*?\];(?=\s*\(function)/;
if (!DATA_RE.test(src)) throw new Error("build-changelog: нет массива CHANGELOG в changelog.js");

/* опубликованные гайды -> пункты «Добавлен гайд» */
const GuideMD = require("./guide-md.js");
const GUIDES_DIR = path.join(__dirname, "guides");
const guideDays = new Map();
const mentioned = JSON.stringify(news.entries);
for (const slug of fs.existsSync(GUIDES_DIR) ? fs.readdirSync(GUIDES_DIR).sort() : []) {
  const md = path.join(GUIDES_DIR, slug, "index.md");
  if (imported.has("guide:" + slug) || SKIP_GUIDES.includes(slug) || !fs.existsSync(md)) continue;
  const { meta } = GuideMD.parse(fs.readFileSync(md, "utf8"));
  if (!meta.title || /^(true|yes|da|да)$/i.test(meta.draft || "")) continue;
  /* день, когда index.md появился в main (по first-parent: merge-коммит PR = публикация) */
  let date = "";
  try {
    date = execSync(
      'git log --first-parent --diff-filter=A --date=format-local:%Y-%m-%d --format=%ad -- "guides/' +
        slug +
        '/index.md"',
      { cwd: __dirname, encoding: "utf8", env: { ...process.env, TZ: "Europe/Moscow" } }
    )
      .trim()
      .split("\n")
      .pop();
  } catch (e) {}
  if (!/^\d{4}-\d\d-\d\d$/.test(date)) date = /^\d{4}-\d\d-\d\d$/.test(meta.date || "") ? meta.date : "";
  if (!date) continue;
  /* гайд уже упомянут в записи, написанной руками, - второй раз не пишем */
  const name = meta.title.replace(/^[«"]|[»"]$/g, "");
  if (mentioned.includes("/guide/" + slug) || mentioned.includes("«" + quotes(name) + "»")) {
    imported.add("guide:" + slug);
    continue;
  }
  const esc = s => GuideMD.esc(String(s).trim());
  const text =
    'Добавлен гайд <a href="/guide/' +
    slug +
    '">«' +
    esc(quotes(name)) +
    "»</a>" +
    (meta.author ? ". Автор - " + esc(meta.author) : "");
  if (!guideDays.has(date)) guideDays.set(date, { items: [], sources: [] });
  guideDays.get(date).items.push(["new", text]);
  guideDays.get(date).sources.push("guide:" + slug);
}
const added = [];
for (const [date, g] of guideDays) {
  g.sources.forEach(s => imported.add(s));
  added.push({ date, title: g.items.length > 1 ? "Новые гайды" : "Новый гайд", items: g.items });
}
news.entries.unshift(...added.sort((a, b) => b.date.localeCompare(a.date)));
news.importedSources = [...imported].sort();
validate(news);
/* Сортируется только выдача сайта. */
const visible = news.entries
  .filter(e => !e.hidden)
  .slice()
  .sort((a, b) => b.date.localeCompare(a.date));
const data = visible.map(({ date, title, items }) => ({ date, title, items }));
const output = "window.CHANGELOG=" + JSON.stringify(data, null, 2) + ";";
const json = JSON.stringify(news, null, 2) + "\n";
console.log("build-changelog: новых записей " + added.length + ", опубликовано " + data.length);
if (DRY) console.log(json);
else {
  const before = JSON.parse(fs.readFileSync(NEWS_FILE, "utf8"));
  if (JSON.stringify(before) !== JSON.stringify(news)) fs.writeFileSync(NEWS_FILE, json);
  fs.writeFileSync(
    FILE,
    src.replace(DATA_RE, () => output)
  );
}
