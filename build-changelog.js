/* build-changelog.js - автоматическое пополнение «Что нового?» из сообщений коммитов.
   Запускается в GitHub Actions перед build.js (см. .github/workflows/pages.yml) и дописывает записи
   в changelog.js только в копии для сборки - в репозиторий ничего не коммитится.

   Как писать коммит, чтобы он попал на главную:
     1-я строка - заголовок записи (например «Темы группировок»);
     первая буква заголовка и пунктов сама становится заглавной, точка в конце пункта убирается (многоточие остаётся);
     дальше строки-пункты с метками:
       new: текст  - Новое
       up: текст   - Улучшено (upd: и update: тоже понимаются)
       fix: текст  - Исправлено
   Коммиты без таких строк («Fix», «Update visual.css») пропускаются.
   Если 1-я строка сама начинается с метки, заголовок будет «Обновление».
   Коммиты одного дня с одинаковым заголовком склеиваются в одну запись.
   Запись, которая уже есть в changelog.js руками (та же дата и заголовок), не дублируется.
   В тексте можно ставить ссылки: <a href="/top100">Топ-100</a>.

   Убрать запись уже запушенного коммита (история не переписывается): добавьте начало его хеша
   (7+ символов) в SKIP ниже - с комментарием, почему.

   Гайды: каждый опубликованный гайд (guides/<адрес>/index.md без draft: true) сам даёт пункт
   «new: Добавлен гайд «Название». Автор - ник» в запись «Новый гайд» в день, когда index.md попал в main
   (для гайдов из формы - день слияния pull request). Если гайд уже упомянут (ссылкой /guide/<адрес> или «Названием») в коммите
   или в changelog.js, второй пункт не появится. Убрать пункт - добавьте адрес папки в SKIP_GUIDES.

   Проверить локально: node build-changelog.js --dry */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const FILE = path.join(__dirname, "changelog.js");
const DRY = process.argv.includes("--dry");
/* коммиты, которые не попадают в «Что нового?» */
const SKIP = [
  "4f0c2d1" // «Задания» - тот же пункт вошёл в «Раздел «Информация»» (3033095)
];
/* гайды (адрес папки), которые не попадают в «Что нового?» */
const SKIP_GUIDES = [];
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
  process.exit(0);
}

/* коммиты -> записи {date, title, items} (git log идёт от новых к старым) */
const groups = new Map();
for (const raw of log.split("\x1e")) {
  const [hash = "", date, body = ""] = raw.replace(/^\s+/, "").split("\x1f");
  if (SKIP.some(h => h && hash.startsWith(h))) continue;
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
  if (!groups.has(key)) groups.set(key, { date, title, items: [] });
  /* внутри записи - в порядке коммитов: старые пункты выше */
  groups.get(key).items.unshift(...items);
}

let src = fs.readFileSync(FILE, "utf8");
const START = "window.CHANGELOG=[\n";
if (!src.includes(START)) {
  console.error("build-changelog: не нашёл window.CHANGELOG=[ в changelog.js");
  process.exit(1);
}

/* опубликованные гайды -> пункты «Добавлен гайд» */
const GuideMD = require("./guide-md.js");
const GUIDES_DIR = path.join(__dirname, "guides");
const guideDays = new Map();
const mentioned = src + [...groups.values()].map(g => g.items.map(i => i[1]).join("\n")).join("\n");
for (const slug of fs.existsSync(GUIDES_DIR) ? fs.readdirSync(GUIDES_DIR).sort() : []) {
  const md = path.join(GUIDES_DIR, slug, "index.md");
  if (SKIP_GUIDES.includes(slug) || !fs.existsSync(md)) continue;
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
  if (mentioned.includes("/guide/" + slug + '"') || mentioned.includes("«" + quotes(name) + "»")) continue;
  const esc = s => GuideMD.esc(String(s).trim());
  const text =
    'Добавлен гайд <a href="/guide/' +
    slug +
    '">«' +
    esc(quotes(name)) +
    "»</a>" +
    (meta.author ? ". Автор - " + esc(meta.author) : "");
  if (!guideDays.has(date)) guideDays.set(date, []);
  guideDays.get(date).push(["new", text]);
}
for (const [date, items] of guideDays) {
  const title = items.length > 1 ? "Новые гайды" : "Новый гайд";
  groups.set(date + "\n" + title, { date, title, items });
}

const manual = new Set(
  [...src.matchAll(/\{date:"(\d{4}-\d\d-\d\d)",title:("(?:[^"\\]|\\.)*")/g)].map(m => m[1] + "\n" + JSON.parse(m[2]))
);
const auto = [...groups.values()]
  .filter(g => !manual.has(g.date + "\n" + g.title))
  .sort((a, b) => b.date.localeCompare(a.date));
if (!auto.length) {
  console.log("build-changelog: новых записей нет");
  process.exit(0);
}

const toJs = g =>
  ' {date:"' +
  g.date +
  '",title:' +
  JSON.stringify(g.title) +
  ",items:[\n" +
  g.items.map(([t, text]) => "  [" + JSON.stringify(t) + "," + JSON.stringify(text) + "]").join(",\n") +
  "\n ]},\n";

/* каждую запись ставим перед первой ручной с той же или более ранней датой - список остаётся по убыванию */
for (const g of auto.slice().reverse()) {
  const body = src.slice(src.indexOf(START) + START.length);
  const m = [...body.matchAll(/^ \{date:"(\d{4}-\d\d-\d\d)"/gm)].find(x => x[1] <= g.date);
  const at = src.indexOf(START) + START.length + (m ? m.index : body.search(/^\];/m));
  src = src.slice(0, at) + toJs(g) + src.slice(at);
}

console.log(
  "build-changelog: добавлено записей - " + auto.length + ": " + auto.map(g => g.date + " «" + g.title + "»").join(", ")
);
if (DRY) console.log(src.slice(0, src.indexOf("];") + 2));
else fs.writeFileSync(FILE, src);
