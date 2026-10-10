/* «Новости сайта»: импорт новых коммитов в site-news.json и подготовка changelog.js для страницы.
   Редактируйте только site-news.json: date, title, items. Импорт НЕ меняет существующие записи.
   importedSources - служебная память импорта: не удаляйте её (она защищает от дублей и возвращения удалённых новостей).
   hidden: true скрывает запись. Можно также удалять запись из entries.
   node build-changelog.js --dry - проверить без записи файлов.
   GitHub Actions сохраняет изменённый site-news.json в репозитории, чтобы его можно было править на GitHub.
*/
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
/* коммиты, которые не попадают в «Что нового?» */
const SKIP = [
  "4f0c2d1" // «Задания» - тот же пункт вошёл в «Раздел «Информация»» (3033095)
];
/* гайды (адрес папки), которые не попадают в «Что нового?» */
const SKIP_GUIDES = [];
/* исправления опечаток в сообщениях коммитов: [что искать, на что заменить] */
const TYPOS = [
  [/хэллуин/g, "хэллоуин"],
  [/Хэллуин/g, "Хэллоуин"]
];
const TAG = /^\s*(new|upd|update|up|fix)\s*:\s*(.+?)\s*$/i;
/* upd: и update: - то же, что up: (частая опечатка) */
const KIND = { new: "new", up: "up", upd: "up", update: "up", fix: "fix" };
/* "прямые кавычки" вне HTML-тегов - в «ёлочки», как на сайте */
const quotes = s =>
  s
    .split(/(<[^>]*>)/)
    .map(part => (part.startsWith("<") ? part : part.replace(/"([^"<>]*)"/g, "«$1»")))
    .join("");
/* первая буква - заглавная, даже если в коммите написали с маленькой (ссылка <a …> в начале не мешает) */
const capital = s =>
  s.replace(/\u2014/g, "-").replace(/^((?:<[^>]*>)*)(\p{Ll})/u, (m, tags, ch) => tags + ch.toUpperCase());

let log = "";
try {
  log = execSync("git log --no-merges --date=format-local:%Y-%m-%d --format=%H%x1f%ad%x1f%B%x1e", {
    cwd: __dirname,
    encoding: "utf8",
    env: { ...process.env, TZ: "Europe/Moscow" },
    maxBuffer: 64 * 1024 * 1024
  });
} catch (e) {
  console.log("build-changelog: нет истории git, пропускаю");
}

/* коммиты -> записи {date, title, items} (git log идёт от новых к старым) */
const groups = new Map();
for (const raw of log.split("\x1e")) {
  const [hash = "", date, rawBody = ""] = raw.replace(/^\s+/, "").split("\x1f");
  /* опечатки в уже запушенных коммитах (история не переписывается) */
  const body = TYPOS.reduce((s, [from, to]) => s.replace(from, to), rawBody);
  if (imported.has(hash) || SKIP.some(h => h && hash.startsWith(h))) continue;
  if (!/^\d{4}-\d\d-\d\d$/.test(date || "")) continue;
  const lines = body
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
  if (/\[skip news\]/i.test(body)) continue;
  const items = lines
    .map(l => TAG.exec(l))
    .filter(Boolean)
    .map(m => [KIND[m[1].toLowerCase()], quotes(capital(m[2])).replace(/(?<!\.)\.$/, "")]);
  if (!items.length) continue;
  const title = lines[0] && !TAG.test(lines[0]) ? quotes(capital(lines[0])) : "Обновление";
  const key = date + "\n" + title;
  if (!groups.has(key)) groups.set(key, { date, title, items: [], sources: [] });
  /* внутри записи - в порядке коммитов: старые пункты выше */
  groups.get(key).items.unshift(...items);
  groups.get(key).sources.push(hash);
}

let src = fs.readFileSync(FILE, "utf8");
const DATA_RE = /window\.CHANGELOG\s*=\s*\[[\s\S]*?\];(?=\s*\(function)/;
if (!DATA_RE.test(src)) throw new Error("build-changelog: нет массива CHANGELOG в changelog.js");

/* опубликованные гайды -> пункты «Добавлен гайд» */
const GuideMD = require("./guide-md.js");
const GUIDES_DIR = path.join(__dirname, "guides");
const guideDays = new Map();
const mentioned =
  JSON.stringify(news.entries) + [...groups.values()].map(g => g.items.map(i => i[1]).join("\n")).join("\n");
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
  /* гайд уже упомянут в коммите или в changelog.js руками - второй раз не пишем */
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
for (const [date, g] of guideDays) {
  const title = g.items.length > 1 ? "Новые гайды" : "Новый гайд";
  const key = date + "\n" + title;
  if (groups.has(key)) {
    groups.get(key).items.push(...g.items);
    groups.get(key).sources.push(...g.sources);
  } else groups.set(key, { date, title, items: g.items, sources: g.sources });
}

/* Первый импорт связывает прежние ручные записи с историей. После него идентификаторы коммитов,
   а не дата/заголовок, защищают ваши правки от повторного импорта. */
const manual = new Set(news.entries.map(e => e.date + "\n" + e.title));
const added = [];
for (const g of groups.values()) {
  g.sources.forEach(s => imported.add(s));
  if (!news.migrated && manual.has(g.date + "\n" + g.title)) continue;
  added.push({ date: g.date, title: g.title, items: g.items });
}
news.entries.unshift(...added.sort((a, b) => b.date.localeCompare(a.date)));
news.importedSources = [...imported].sort();
news.migrated = true;
validate(news);
/* Сортируется только выдача сайта. Ручной порядок/форматирование JSON не трогаем, если импорт ничего не добавил. */
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
