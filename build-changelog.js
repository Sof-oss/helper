/* build-changelog.js — автоматическое пополнение «Что нового?» из сообщений коммитов.
   Запускается в GitHub Actions перед build.js (см. .github/workflows/pages.yml) и дописывает записи
   в changelog.js только в копии для сборки — в репозиторий ничего не коммитится.

   Как писать коммит, чтобы он попал на главную:
     1-я строка — заголовок записи (например «Темы группировок»);
     дальше строки-пункты с метками:
       new: текст  — Новое
       up: текст   — Улучшено
       fix: текст  — Исправлено
   Коммиты без таких строк («Fix», «Update visual.css») пропускаются.
   Если 1-я строка сама начинается с метки, заголовок будет «Обновление».
   Коммиты одного дня с одинаковым заголовком склеиваются в одну запись.
   Запись, которая уже есть в changelog.js руками (та же дата и заголовок), не дублируется.
   В тексте можно ставить ссылки: <a href="/top100">Топ-100</a>.

   Убрать запись уже запушенного коммита (история не переписывается): добавьте начало его хеша
   (7+ символов) в SKIP ниже — с комментарием, почему.

   Проверить локально: node build-changelog.js --dry */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const FILE = path.join(__dirname, "changelog.js");
const DRY = process.argv.includes("--dry");
/* коммиты, которые не попадают в «Что нового?» */
const SKIP = [
  "4f0c2d1" // «Задания» — тот же пункт вошёл в «Раздел «Информация»» (3033095)
];
const TAG = /^\s*(new|up|fix)\s*:\s*(.+?)\s*$/i;

let log = "";
try {
  log = execSync('git log --no-merges --date=format-local:%Y-%m-%d --format=%H%x1f%ad%x1f%B%x1e', {
    cwd: __dirname, encoding: "utf8", env: { ...process.env, TZ: "Europe/Moscow" }, maxBuffer: 64 * 1024 * 1024
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
  const lines = body.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (/\[skip news\]/i.test(body)) continue;
  const items = lines.map(l => TAG.exec(l)).filter(Boolean).map(m => [m[1].toLowerCase(), m[2]]);
  if (!items.length) continue;
  const title = lines[0] && !TAG.test(lines[0]) ? lines[0] : "Обновление";
  const key = date + "\n" + title;
  if (!groups.has(key)) groups.set(key, { date, title, items: [] });
  /* внутри записи — в порядке коммитов: старые пункты выше */
  groups.get(key).items.unshift(...items);
}

let src = fs.readFileSync(FILE, "utf8");
const START = "window.CHANGELOG=[\n";
if (!src.includes(START)) { console.error("build-changelog: не нашёл window.CHANGELOG=[ в changelog.js"); process.exit(1); }

const manual = new Set([...src.matchAll(/\{date:"(\d{4}-\d\d-\d\d)",title:("(?:[^"\\]|\\.)*")/g)].map(m => m[1] + "\n" + JSON.parse(m[2])));
const auto = [...groups.values()].filter(g => !manual.has(g.date + "\n" + g.title)).sort((a, b) => b.date.localeCompare(a.date));
if (!auto.length) { console.log("build-changelog: новых записей нет"); process.exit(0); }

const toJs = g => ' {date:"' + g.date + '",title:' + JSON.stringify(g.title) + ",items:[\n" +
  g.items.map(([t, text]) => "  [" + JSON.stringify(t) + "," + JSON.stringify(text) + "]").join(",\n") + "\n ]},\n";

/* каждую запись ставим перед первой ручной с той же или более ранней датой — список остаётся по убыванию */
for (const g of auto.slice().reverse()) {
  const body = src.slice(src.indexOf(START) + START.length);
  const m = [...body.matchAll(/^ \{date:"(\d{4}-\d\d-\d\d)"/gm)].find(x => x[1] <= g.date);
  const at = src.indexOf(START) + START.length + (m ? m.index : body.search(/^\];/m));
  src = src.slice(0, at) + toJs(g) + src.slice(at);
}

console.log("build-changelog: добавлено записей — " + auto.length + ": " + auto.map(g => g.date + " «" + g.title + "»").join(", "));
if (DRY) console.log(src.slice(0, src.indexOf("];") + 2));
else fs.writeFileSync(FILE, src);
