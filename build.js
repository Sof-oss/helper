#!/usr/bin/env node
"use strict";
/* Сборка для деплоя: исходники из корня -> ./dist
 * 0. Общие куски (partials/header.html, partials/footer.html) подставляются вместо <!-- @include имя -->,
 *    в шапке помечается активный пункт меню: так меню правится в одном месте, а не в каждой странице.
 * 0б. Модули собираются esbuild (см. MODULES): 3D главной (src/home-3d.js + three.js) - маленький home-3d.js
 *     и догружаемые части в dist/3d/; калькулятор (src/calculator.js -> app.js, polish.js, talents.js) - один calculator.js.
 * 1. Таблицы «Информации» и «Топ-100» дописываются прямо в HTML: их видят поисковики и те, у кого выключен JS.
 *    Разметку рисуют те же info.js / info-tasks.js / top100.js, что работают в браузере, поэтому она совпадает.
 * 2. Общие стили (styles.css - бывшие styles.css, polish.css и visual.css) остаются отдельными файлами и кэшируются один раз на весь сайт,
 *    подряд идущие стили одной страницы склеиваются (bundle-*.css); css и js сжимаются esbuild.
 * 3. Ссылки на css, js и картинки получают ?v=<хэш содержимого>, после деплоя старый кэш не подтянется.
 * 3б. Гайды из guides/<адрес>/index.md (Markdown, см. guide-md.js) становятся страницами /guide/<адрес>,
 *     список гайдов дописывается в guides.html, картинки гайдов копируются в dist/guide-img/<адрес>/.
 * 4. В sitemap.xml дописывается lastmod: дата последнего коммита страницы и её css/js, у Топ-100 - время выгрузки рейтинга.
 * 5. После сборки build-previews.js делает ссылки на карточки игроков /p/<id> с картинкой «Личное дело» (npm run build - оба шага).
 * Запуск: npm install (один раз, ставит esbuild), затем node build.js. Без esbuild сборка не идёт: калькулятор собирается им */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

let esbuild = null;
try {
  esbuild = require("esbuild");
} catch (e) {
  console.error("Ошибка: esbuild не установлен. Выполните npm install и запустите сборку ещё раз");
  process.exit(1);
}

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");

/* модули: файл в dist -> точка входа и все исходники (по ним же считается дата страницы в sitemap).
   Исходники модулей в dist не копируются - на сайт попадает только собранный файл */
const MODULES = {
  "home-3d.js": [
    "src/home-3d.js",
    "src/zone-intro.js",
    "src/zone-heart.js",
    "src/zone-sign.js",
    "src/zone-bg.js",
    "src/zone-theme.js"
  ],
  "calculator.js": ["src/calculator.js", "src/calc-core.js", "src/calc-slots.js", "app.js", "polish.js", "talents.js"]
};

/* в dist не попадает служебное и исходники сборки (выгрузка игроков и CSV рейтинга нужны только для build-top100.js) */
const SKIP = new Set([
  ".git",
  ".github",
  ".gitignore",
  "dist",
  "node_modules",
  "top100",
  "partials",
  "src",
  "guides",
  "yandex",
  "README.md",
  "DEVELOPMENT.md",
  "build.js",
  "build-top100.js",
  "build-players.js",
  "build-top100.bat",
  "package.json",
  "package-lock.json",
  "fetch-players.js",
  "update-top100.bat",
  "build-previews.js",
  "build-logo.js",
  "build-changelog.js",
  "site-news.json",
  "build-guide-images.js",
  "build-chrome.js",
  "previews",
  "test",
  "eslint.config.mjs",
  ".prettierrc.json",
  ".prettierignore",
  ...Object.values(MODULES)
    .flat()
    .filter(f => !f.startsWith("src/"))
]);

/* ---------- копирование ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const name of fs.readdirSync(ROOT)) {
  if (SKIP.has(name)) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
}

/* ---------- гайды ----------
   guides/<адрес>/index.md + картинки рядом. Гайд попадает в репозиторий через pull request из формы
   «Отправить свой гайд» (функция Yandex Cloud, yandex/index.js) и публикуется, когда его принимают (Merge).
   Адрес папки = адрес страницы: guides/kak-nachat/index.md -> /guide/kak-nachat.
   Картинки лежат отдельно от страницы (dist/guide-img/<адрес>/), чтобы папка не мешала адресу /guide/<адрес> */
const GuideMD = require("./guide-md.js");
const SITE = "https://heart-of-the-zone.ru";
const GUIDES_DIR = path.join(ROOT, "guides");
const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря"
];
const ruDate = d => {
  const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(d || "");
  return m ? +m[3] + " " + MONTHS[+m[2] - 1] + " " + m[1] : "";
};
/* ник автора -> ID карточки в Топ-100 (если игрок есть в рейтинге, подпись ведёт на его карточку) */
const playerIds = (() => {
  const ids = {};
  try {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, "top100-players.json"), "utf8"));
    for (const id of Object.keys(d.players)) ids[String(d.players[id].n).toLowerCase()] = id;
  } catch (e) {}
  return ids;
})();
/* размеры картинки из заголовка файла (WebP, PNG, JPEG, GIF), без сторонних пакетов; не разобрали - null */
function imageSize(file) {
  const b = fs.readFileSync(file);
  const ascii = (a, n) => b.toString("latin1", a, a + n);
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const kind = ascii(12, 4);
    if (kind === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (kind === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") {
      const v = b.readUInt32LE(21);
      return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 };
    }
  }
  if (ascii(1, 3) === "PNG") return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (ascii(0, 3) === "GIF") return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1],
        len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
        return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}
/* ширина колонки гайда на компьютере (guides.css, .page-narrow) - для sizes у srcset */
const GUIDE_IMG_SIZES = "(max-width: 900px) 100vw, 860px";
const guides = [];
if (fs.existsSync(GUIDES_DIR)) {
  for (const slug of fs.readdirSync(GUIDES_DIR)) {
    const md = path.join(GUIDES_DIR, slug, "index.md");
    if (!fs.existsSync(md)) continue;
    if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug))
      throw new Error("guides/" + slug + ": в адресе гайда только латиница, цифры и дефис");
    const { meta, body } = GuideMD.parse(fs.readFileSync(md, "utf8"));
    if (!meta.title) throw new Error("guides/" + slug + "/index.md: нет title в шапке");
    if (/^(true|yes|да)$/i.test(meta.draft || "")) continue;
    /* картинки: только файлы из папки гайда, ссылки на них - /guide-img/<адрес>/<файл> */
    const imgs = fs.readdirSync(path.join(GUIDES_DIR, slug)).filter(f => /\.(webp|jpe?g|png|gif)$/i.test(f));
    if (imgs.length) {
      fs.mkdirSync(path.join(OUT, "guide-img", slug), { recursive: true });
      imgs.forEach(f => fs.copyFileSync(path.join(GUIDES_DIR, slug, f), path.join(OUT, "guide-img", slug, f)));
    }
    /* картинка -> адрес и размеры; уменьшенная копия <файл>-800w.webp (её делает build-guide-images.js) идёт в srcset */
    const image = src => {
      if (/^https?:\/\//i.test(src)) return src;
      const f = src.replace(/^\.\//, "");
      if (!imgs.includes(f)) {
        console.warn("Предупреждение: guides/" + slug + ": нет картинки " + src);
        return null;
      }
      const url = "/guide-img/" + slug + "/" + f;
      const size = imageSize(path.join(GUIDES_DIR, slug, f));
      if (!size) return url;
      const small = f.replace(/\.\w+$/, "") + "-800w.webp";
      const srcset =
        size.width > 800 && imgs.includes(small)
          ? "/guide-img/" + slug + "/" + small + " 800w, " + url + " " + size.width + "w"
          : null;
      return { src: url, width: size.width, height: size.height, srcset, sizes: GUIDE_IMG_SIZES };
    };
    const cover = GuideMD.firstImage(body);
    const coverImg = cover ? image(cover) : null;
    guides.push({
      slug,
      title: meta.title,
      author: meta.author || "",
      date: meta.date || "",
      description: meta.description || GuideMD.excerpt(body, 160),
      html: GuideMD.render(body, { image, siteHost: "heart-of-the-zone.ru" }),
      cover: coverImg && typeof coverImg === "object" ? coverImg.src : coverImg,
      coverSize: coverImg && typeof coverImg === "object" ? coverImg : null,
      /* обложка для соцсетей: og.jpg 1200×630 (build-guide-images.js), VK не показывает превью в WebP */
      ogImage: imgs.includes("og.jpg") ? "/guide-img/" + slug + "/og.jpg" : null,
      authorId: meta.author ? playerIds[meta.author.toLowerCase()] : null
    });
  }
  guides.sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.title.localeCompare(b.title, "ru"));
}
const esc = GuideMD.esc;
const authorMarkup = g =>
  !g.author
    ? ""
    : g.authorId
      ? '<a href="/p/' + g.authorId + '" title="Карточка игрока в Топ-100">' + esc(g.author) + "</a>"
      : "<b>" + esc(g.author) + "</b>";
function guidesListMarkup() {
  if (!guides.length) return '<p class="guides-empty">Пока здесь нет ни одного гайда, будьте первым!</p>';
  return (
    guides
      .map(
        g =>
          '<a class="guide-card" href="/guide/' +
          g.slug +
          '">' +
          (g.cover
            ? '<span class="guide-card-img"><img src="' +
              esc(g.cover) +
              '"' +
              (g.coverSize && g.coverSize.srcset
                ? ' srcset="' + esc(g.coverSize.srcset) + '" sizes="(max-width: 700px) 100vw, 420px"'
                : "") +
              (g.coverSize ? ' width="' + g.coverSize.width + '" height="' + g.coverSize.height + '"' : "") +
              ' alt="" loading="lazy" decoding="async"></span>'
            : '<span class="guide-card-img guide-card-noimg" aria-hidden="true"></span>') +
          '<span class="guide-card-body"><b>' +
          esc(g.title) +
          "</b>" +
          (g.description ? "<small>" + esc(g.description) + "</small>" : "") +
          '<span class="guide-card-meta">' +
          (g.author ? esc(g.author) : "") +
          (g.author && g.date ? " · " : "") +
          (g.date ? '<time datetime="' + esc(g.date) + '">' + ruDate(g.date) + "</time>" : "") +
          "</span></span></a>"
      )
      .join("") + GUIDE_INVITE
  );
}
/* последняя карточка списка - приглашение написать свой гайд (открывает форму, как кнопка «Отправить свой гайд») */
const GUIDE_INVITE =
  '<a class="guide-card guide-card-invite" href="#send">' +
  '<span class="guide-card-img guide-card-invite-img" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
  '<span class="guide-card-body"><b>Напишите свой гайд</b>' +
  "<small>Поделитесь опытом - после проверки гайд появится здесь с вашей подписью. Идеи: «Как пройти экспедицию», " +
  "«Билд для новичка», «Как лучше копить жетоны»</small>" +
  '<span class="guide-card-meta">Открыть форму →</span></span></a>';

/* ---------- 3D главной ----------
   src/home-3d.js - маленький загрузчик; заставка (zone-intro.js), живой фон (zone-bg.js) и общий кусок three.js
   собираются в отдельные файлы dist/3d/*-<хэш>.js и скачиваются только когда нужны. Хэш в имени - защита от старого кэша.
   Из three.js попадает только используемое */
{
  const r = esbuild.buildSync({
    entryPoints: [path.join(ROOT, "src", "home-3d.js")],
    outdir: OUT,
    entryNames: "[name]",
    chunkNames: "3d/[name]-[hash]",
    bundle: true,
    splitting: true,
    format: "esm",
    minify: true,
    target: "es2020",
    legalComments: "none",
    charset: "utf8",
    metafile: true
  });
  const parts = Object.entries(r.metafile.outputs).map(
    ([f, o]) =>
      path
        .basename(f)
        .replace(/-[A-Z0-9]{8}\.js$/, ".js")
        .replace(/^chunk\.js$/, "three.js (общий)") +
      " " +
      (o.bytes / 1024).toFixed(0) +
      " КБ"
  );
  console.log("3D главной: " + parts.join(", "));
}

/* ---------- калькулятор ----------
   app.js, polish.js и talents.js - ES-модули с явными import/export (без общих глобальных имён).
   Точка входа src/calculator.js задаёт порядок; на сайт уходит один файл calculator.js.
   format "iife": всё внутри одной функции, наружу ничего не торчит */
{
  const r = esbuild.buildSync({
    entryPoints: [path.join(ROOT, "src", "calculator.js")],
    outfile: path.join(OUT, "calculator.js"),
    bundle: true,
    format: "iife",
    minify: true,
    target: "es2020",
    legalComments: "none",
    charset: "utf8",
    metafile: true
  });
  console.log("Калькулятор: calculator.js " + (Object.values(r.metafile.outputs)[0].bytes / 1024).toFixed(0) + " КБ");
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
  const el = id =>
    (els[id] = els[id] || {
      innerHTML: "",
      textContent: "",
      dataset: {},
      hidden: false,
      classList: { toggle() {} },
      setAttribute() {},
      addEventListener() {},
      insertAdjacentHTML() {},
      focus() {},
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
  for (const m of htmlSrc.matchAll(/<script src="([^"]+)"(?: defer)?><\/script>/g)) {
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

/* «живые» строки на плашках разделов главной: считаются из данных сайта при каждой сборке.
   Калькулятор и «сегодня/вчера» у Топ-100 дописывает в браузере home-live.js */
function plural(n, one, few, many) {
  const m10 = n % 10,
    m100 = n % 100;
  return n + " " + (m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many);
}
function homeLive(html) {
  const bosses = (fs.readFileSync(path.join(ROOT, "info-bosses.js"), "utf8").match(/^ {6}key: "/gm) || []).length;
  if (bosses) html = fill(html, "hcInfo", plural(bosses, "босс", "босса", "боссов") + " · задания · уровни");
  const upd = /TOP100_UPDATED="(\d\d)\.(\d\d)\.(\d{4}) (\d\d):(\d\d)/.exec(
    fs.readFileSync(path.join(ROOT, "top100-data.js"), "utf8")
  );
  if (upd)
    html = fill(
      html,
      "hcTop",
      "Обновлён " + upd[1] + "." + upd[2] + " в " + upd[4] + ":" + upd[5],
      ' data-day="' + upd[3] + "-" + upd[2] + "-" + upd[1] + '" data-time="' + upd[4] + ":" + upd[5] + '"'
    );
  if (guides.length) {
    const g = guides.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const short = String(g.title).split(":")[0].trim();
    html = fill(html, "hcGuides", plural(guides.length, "гайд", "гайда", "гайдов") + " · новый: «" + esc(short) + "»");
  }
  return html;
}

const PRERENDER = {
  /* список гайдов; пока гайдов нет, страница закрыта от индексации */
  "guides.html": html => {
    html = fill(html, "guidesList", guidesListMarkup());
    return guides.length ? html.replace(/<meta name="robots" content="noindex, follow">\n?/, "") : html;
  },
  /* «Новости сайта» и «Новости Зоны» на главной уходят в HTML готовыми, чтобы были видны сразу и поисковикам;
     пустой список новостей Зоны допустим - тогда блок просто скрыт */
  "index.html": html => {
    const els = runScripts(["changelog.js", "news.js"]);
    html = fill(html, "homeNews", els.homeNews.innerHTML);
    html = homeLive(html);
    return els.zoneNews && els.zoneNews.innerHTML ? fill(html, "zoneNews", els.zoneNews.innerHTML) : html;
  },
  "info.html": (html, els) => {
    /* содержимое разделов в метках <!--sec:…-->: на странице каждого раздела в HTML остаётся только его раздел
       (см. INFO_SECTIONS ниже), остальные дорисовывает скрипт при переключении */
    const mark = (k, inner) => "<!--sec:" + k + "-->" + inner + "<!--/sec:" + k + "-->";
    html = fill(
      html,
      "infoTabs",
      mark("levels", els.infoTabs.innerHTML),
      ' data-view="' + els.infoTabs.dataset.view + '"'
    );
    html = fill(
      html,
      "infoGroups",
      mark("levels", els.infoGroups.innerHTML),
      ' data-active="' + els.infoGroups.dataset.active + '" data-view="' + els.infoGroups.dataset.view + '"'
    );
    /* подсказка «Укажите уровень… в калькуляторе» - сразу в HTML, иначе графики под ней сдвигаются (CLS) */
    if (els.infoProgress && els.infoProgress.innerHTML) html = fill(html, "infoProgress", els.infoProgress.innerHTML);
    html = fill(html, "tasksRoot", mark("tasks", els.tasksRoot.innerHTML));
    return fill(html, "bossesRoot", mark("bosses", els.bossesRoot.innerHTML));
  },
  /* у рейтинга в HTML уходит стартовая вкладка; остальные рисует JS по клику */
  "top100.html": (html, els) => {
    html = fill(html, "top100Tabs", els.top100Tabs.innerHTML);
    html = fill(html, "top100TableWrap", els.top100TableWrap.innerHTML);
    /* период и отряды тоже сразу в HTML: если их дорисовывать скриптом, таблица под ними сдвигается (CLS) */
    html = fill(html, "top100Factions", els.top100Factions.innerHTML);
    html = fill(html, "top100FactionSummary", els.top100FactionSummary.textContent);
    if (!els.top100Period.hidden) {
      html = fill(html, "top100PeriodBtns", els.top100PeriodBtns.innerHTML);
      html = fill(html, "top100PeriodRange", els.top100PeriodRange.innerHTML);
      html = html.replace(/(id="top100Period"[^>]*?) hidden>/, "$1>");
      if (els.top100PeriodBtns.hidden) html = html.replace('id="top100PeriodBtns"', 'id="top100PeriodBtns" hidden');
    }
    return fill(html, "top100Updated", els.top100Updated.textContent);
  }
};

/* ---------- стили ----------
   Порядок подключения не меняется: от него зависит, какое правило побеждает (visual.css, например, перекрашивает polish.css).
   - Общие файлы (подключены на двух и больше страницах, например styles.css) идут отдельными файлами:
     они одинаковые на всём сайте, браузер скачивает каждый один раз и на других страницах берёт из кэша.
   - Файлы только одной страницы, если стоят подряд, склеиваются в один bundle-<хэш>.css в корне dist
     (поэтому относительные url() внутри стилей остаются верными).
   Исходные css, вошедшие в склейку, в dist после этого не нужны и удаляются */
const LOCAL_CSS = /<link rel="stylesheet" href="(\/?)([^":]+\.css)">\n?/g;
const bundledCss = new Set();
const cssPages = fs
  .readdirSync(OUT)
  .filter(f => f.endsWith(".html"))
  .map(name => ({ name, list: [...fs.readFileSync(path.join(OUT, name), "utf8").matchAll(LOCAL_CSS)].map(m => m[2]) }))
  .filter(p => p.list.length);
const cssUse = {};
cssPages.forEach(p =>
  new Set(p.list).forEach(f => {
    cssUse[f] = (cssUse[f] || 0) + 1;
  })
);
const sharedCss = Object.keys(cssUse).filter(f => cssUse[f] > 1);
if (sharedCss.length) console.log("Общие стили (кэшируются на весь сайт): " + sharedCss.join(", "));
for (const { name, list } of cssPages) {
  /* группы по порядку: общий файл - сам по себе, подряд идущие файлы страницы - вместе */
  const groups = [];
  for (const f of list) {
    const last = groups[groups.length - 1];
    if (cssUse[f] > 1 || !last || last.shared) groups.push({ shared: cssUse[f] > 1, files: [f] });
    else last.files.push(f);
  }
  const hrefs = groups.map(g => {
    if (g.shared || g.files.length === 1) return g.files[0];
    const bundle = "bundle-" + crypto.createHash("sha1").update(g.files.join("|")).digest("hex").slice(0, 8) + ".css";
    fs.writeFileSync(
      path.join(OUT, bundle),
      g.files.map(f => "/* " + f + " */\n" + fs.readFileSync(path.join(OUT, f), "utf8")).join("\n")
    );
    g.files.forEach(f => bundledCss.add(f));
    return bundle;
  });
  let first = true;
  const file = path.join(OUT, name);
  const html = fs.readFileSync(file, "utf8").replace(LOCAL_CSS, (m, slash) => {
    if (!first) return "";
    first = false;
    return hrefs.map(h => '<link rel="stylesheet" href="' + slash + h + '">\n').join("");
  });
  fs.writeFileSync(file, html);
}
bundledCss.forEach(f => fs.rmSync(path.join(OUT, f)));

/* ---------- сжатие ----------
   js - обычные скрипты (не модули) с общими глобальными именами: esbuild без format не переименовывает
   имена верхнего уровня, поэтому app.js / polish.js / talents.js продолжают видеть друг друга */
if (esbuild) {
  let saved = 0;
  for (const name of fs.readdirSync(OUT).filter(f => /\.(css|js)$/.test(f) && !MODULES[f])) {
    const file = path.join(OUT, name);
    const src = fs.readFileSync(file, "utf8");
    const out = esbuild.transformSync(src, {
      loader: name.endsWith(".css") ? "css" : "js",
      minify: true,
      target: name.endsWith(".css") ? ["chrome100", "safari15", "firefox100"] : "es2020",
      legalComments: "none",
      charset: "utf8"
    }).code;
    saved += src.length - out.length;
    fs.writeFileSync(file, out);
  }
  console.log("Сжатие css и js: −" + (saved / 1024).toFixed(1) + " КБ");
}

/* ---------- версии файлов ---------- */
const hashCache = new Map();
function fileHash(rel) {
  if (!hashCache.has(rel)) {
    hashCache.set(
      rel,
      crypto
        .createHash("sha1")
        .update(fs.readFileSync(path.join(OUT, rel)))
        .digest("hex")
        .slice(0, 8)
    );
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
  const css = fs
    .readFileSync(file, "utf8")
    .replace(/url\((["']?)([^"')]+)\1\)/g, (m, q, u) => "url(" + q + version(u, name) + q + ")");
  fs.writeFileSync(file, css);
}

/* ---------- PWA: manifest и service worker ----------
   На каждую страницу - ссылка на manifest.webmanifest и sw-register.js (регистрирует sw.js). В исходных html их нет,
   чтобы не повторять в каждом файле; версии ?v= они получают ниже вместе со всеми. Сам sw.js собирается в конце */
function pwaTags(html, from) {
  if (!html.includes('rel="manifest"')) {
    const tag = '<link rel="manifest" href="/manifest.webmanifest">\n';
    const icon = /(<link rel="apple-touch-icon"[^>]*>\n?)/;
    html = icon.test(html) ? html.replace(icon, "$1" + tag) : html.replace("</head>", tag + "</head>");
  }
  if (!html.includes("sw-register.js")) {
    if (!html.includes("</body>")) throw new Error("PWA: в " + from + " нет </body>");
    html = html.replace("</body>", '<script src="/sw-register.js" defer></script></body>');
  }
  /* сезонное оформление (season.js сам решает, включать ли его) - тоже на каждую страницу */
  if (!html.includes("season.js") && fs.existsSync(path.join(OUT, "season.js")))
    html = html.replace("</body>", '<script src="/season.js" defer></script></body>');
  return html;
}

/* версия сезонного оформления: halloween.css/js и картинки assets/halloween подключает season.js сам,
   поэтому его метка __HW_V__ заменяется хэшем их содержимого (до того, как сам season.js получит ?v=) */
if (fs.existsSync(path.join(OUT, "season.js"))) {
  const hh = crypto.createHash("sha256");
  const hwDir = path.join(OUT, "assets", "halloween");
  const hwFiles = ["halloween.css", "halloween.js"]
    .map(f => path.join(OUT, f))
    .concat(
      fs.existsSync(hwDir)
        ? fs
            .readdirSync(hwDir)
            .sort()
            .map(f => path.join(hwDir, f))
        : []
    );
  hwFiles.filter(f => fs.existsSync(f)).forEach(f => hh.update(fs.readFileSync(f)));
  const seasonFile = path.join(OUT, "season.js");
  fs.writeFileSync(seasonFile, fs.readFileSync(seasonFile, "utf8").replace("__HW_V__", hh.digest("hex").slice(0, 10)));
}

/* ---------- html ---------- */
let pages = 0;
for (const name of fs.readdirSync(OUT).filter(f => f.endsWith(".html"))) {
  let html = fs.readFileSync(path.join(OUT, name), "utf8");
  const before = html.length;
  /* обработчику с одним аргументом скрипты страницы не нужны - он сам решает, что прогнать */
  if (PRERENDER[name])
    html = PRERENDER[name].length > 1 ? PRERENDER[name](html, runPageScripts(html)) : PRERENDER[name](html);
  html = pwaTags(html, name)
    .replace(/(<link\b[^>]*?\shref=")([^"]+)(")/g, (m, a, u, b) => a + version(u, name) + b)
    .replace(/(<script\b[^>]*?\ssrc=")([^"]+)(")/g, (m, a, u, b) => a + version(u, name) + b)
    .replace(/(<img\b[^>]*?\ssrc=")(\/(?:assets|guide-img)\/[^"]+)(")/g, (m, a, u, b) => a + version(u, name) + b)
    .replace(/(<img\b[^>]*?\ssrcset=")([^"]+)(")/g, (m, a, list, b) => {
      const out = list.split(/,\s*/).map(c => {
        const [u, w] = c.trim().split(/\s+/);
        return (u.startsWith("/") ? version(u, name) : u) + (w ? " " + w : "");
      });
      return a + out.join(", ") + b;
    });
  fs.writeFileSync(path.join(OUT, name), html);
  pages++;
  console.log(name.padEnd(16), (before / 1024).toFixed(1) + " КБ -> " + (html.length / 1024).toFixed(1) + " КБ");
}

/* ---------- разделы «Информации» на своих адресах ----------
   /info - «Прогресс по уровням», /info-tasks - «Задания», /info-bosses - «Боссы». Это одна и та же страница
   (переключение разделов - без перезагрузки, адрес меняет info-tasks.js), но у каждого раздела свой файл
   со своими заголовком, описанием и canonical, и в нём сразу открыт нужный раздел - для ссылок и поисковиков.
   Адреса через дефис, а не /info/tasks: файл info.html рядом с папкой info/ на GitHub Pages - лишний риск */
const INFO_SECTIONS = {
  tasks: {
    file: "info-tasks.html",
    name: "Задания",
    h1: "Задания: награды локаций",
    title: "Сердце Зоны - Задания: награды локаций и калькулятор энергии",
    desc: "Задания всех локаций игры «Сердце Зоны»: этапы и число повторов, награда за прохождение, итог и выгода на единицу энергии, калькулятор энергии и энергетиков."
  },
  bosses: {
    file: "info-bosses.html",
    name: "Боссы",
    h1: "Боссы: здоровье и награды",
    title: "Сердце Зоны - Боссы: здоровье, ключи и награды",
    desc: "Все боссы игры «Сердце Зоны»: здоровье, сколько ключей нужно для боя, награды за победу и комплекты вещей, которые могут выпасть."
  }
};
/* в HTML раздела остаётся только его содержимое: три страницы не дублируют друг друга для поисковиков */
const onlySection = (html, key) =>
  html.replace(/<!--sec:(\w+)-->([\s\S]*?)<!--\/sec:\1-->/g, (m, k, inner) => (k === key ? inner : ""));
{
  const base = fs.readFileSync(path.join(OUT, "info.html"), "utf8");
  fs.writeFileSync(path.join(OUT, "info.html"), onlySection(base, "levels"));
  for (const [key, sec] of Object.entries(INFO_SECTIONS)) {
    const url = SITE + "/" + sec.file.replace(/\.html$/, "");
    const attr = s => esc(s);
    let html = base
      .replace(/<title>[^<]*<\/title>/, "<title>" + attr(sec.title) + "</title>")
      .replace(/(<meta name="description" content=")[^"]*/, "$1" + attr(sec.desc))
      .replace(/(<meta property="og:title" content=")[^"]*/, "$1" + attr(sec.title))
      .replace(/(<meta property="og:description" content=")[^"]*/, "$1" + attr(sec.desc))
      .replace(/(<meta property="og:image:alt" content=")[^"]*/, "$1" + attr(sec.title))
      .replace(/(<meta property="og:url" content=")[^"]*/, "$1" + url)
      .replace(/(<link rel="canonical" href=")[^"]*/, "$1" + url)
      /* хлебные крошки: Главная → Информация → раздел */
      .replace(
        /("item": "https:\/\/heart-of-the-zone\.ru\/info"\})\]/,
        '$1, {"@type": "ListItem", "position": 3, "name": "' + sec.name + '", "item": "' + url + '"}]'
      )
      .replace(/(<h1 id="infoTitle">)[^<]*/, "$1" + attr(sec.h1))
      /* открытый раздел: кнопка и панель */
      .replace(
        /<button type="button" class="top100-tab(?: active)?" data-section="(\w+)" role="tab" aria-selected="(?:true|false)"/g,
        (m, k) =>
          '<button type="button" class="top100-tab' +
          (k === key ? " active" : "") +
          '" data-section="' +
          k +
          '" role="tab" aria-selected="' +
          (k === key) +
          '"'
      )
      .replace(/<div data-section-panel="(\w+)"([^>]*?)(?: hidden)?>/g, (m, k, rest) =>
        k === key
          ? '<div data-section-panel="' + k + '"' + rest + ">"
          : '<div data-section-panel="' + k + '"' + rest + " hidden>"
      );
    html = onlySection(html, key);
    if (!html.includes('data-section="' + key + '" role="tab" aria-selected="true"') || !html.includes(sec.h1))
      throw new Error(sec.file + ": не нашлась кнопка или заголовок раздела " + key);
    fs.writeFileSync(path.join(OUT, sec.file), html);
    pages++;
  }
}

/* ---------- /build: ссылка на билд ----------
   Билд передаётся после # (его соцсети не видят), поэтому у ссылок на билд свой адрес /build с ироничным превью
   «Смотри мой билд», а у самого калькулятора - обычное. Страница - копия калькулятора, закрыта от индексации
   (canonical - /calculator); app.js после загрузки билда меняет адрес на /calculator */
{
  const BUILD_OG = {
    title: "Смотри мой билд - Калькулятор урона «Сердце Зоны»",
    desc: "Урон оружия с учётом уровня, снаряжения и талантов. Открой билд, сравни со своим и попробуй переплюнуть.",
    image: SITE + "/assets/preview-build.jpg?v=" + fileHash("assets/preview-build.jpg"),
    alt: "Я тут самый мощный сталкер! Билд в калькуляторе урона «Сердце Зоны»"
  };
  const html = fs
    .readFileSync(path.join(OUT, "calculator.html"), "utf8")
    .replace(/(<meta (?:property="og|name="twitter):title" content=")[^"]*/g, "$1" + esc(BUILD_OG.title))
    .replace(/(<meta (?:property="og|name="twitter):description" content=")[^"]*/g, "$1" + esc(BUILD_OG.desc))
    .replace(/(<meta (?:property="og|name="twitter):image:alt" content=")[^"]*/g, "$1" + esc(BUILD_OG.alt))
    .replace(
      /(<meta (?:property="og:image(?::secure_url)?|name="twitter:image|name="vk:image)" content="|<link rel="image_src" href=")[^"]*/g,
      "$1" + BUILD_OG.image
    )
    .replace(/(<meta property="og:image:height" content=")[^"]*/, "$1630")
    .replace(/(<meta property="og:url" content=")[^"]*/, "$1" + SITE + "/build")
    .replace(/(<meta name="viewport"[^>]*>\n)/, '$1<meta name="robots" content="noindex, follow">\n');
  if (!html.includes(BUILD_OG.title) || !html.includes("noindex"))
    throw new Error("build.html: не удалось подставить превью");
  fs.writeFileSync(path.join(OUT, "build.html"), html);
  pages++;
}

/* ---------- страницы гайдов ----------
   Шаблон - уже собранная guides.html (шапка, подвал, стили, версии файлов): меняются заголовок, описание,
   адрес, картинка для соцсетей и содержимое <main>. Страница лежит глубже (/guide/…), поэтому
   относительные ссылки шаблона делаются от корня сайта */
if (guides.length) {
  const tpl = fs
    .readFileSync(path.join(OUT, "guides.html"), "utf8")
    .replace(/<meta name="robots"[^>]*>\n?/, "")
    .replace(/(\s(?:href|src)=")(?![a-z][a-z0-9+.-]*:|\/|#)/gi, "$1/")
    .replace(/<script src="\/(?:guide-md|guides-config|guide-submit)\.js[^"]*"(?: defer)?><\/script>/g, "");
  fs.mkdirSync(path.join(OUT, "guide"), { recursive: true });
  for (const g of guides) {
    const url = SITE + "/guide/" + g.slug;
    const title = g.title + " - гайд «Сердце Зоны»";
    const desc = g.description || "Гайд по игре «Сердце Зоны»" + (g.author ? " от " + g.author : "");
    const img = g.ogImage
      ? SITE + version(g.ogImage, "guide/" + g.slug)
      : g.cover
        ? /^https?:/.test(g.cover)
          ? g.cover
          : SITE + g.cover
        : null;
    const ld = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: g.title,
      description: desc,
      url,
      inLanguage: "ru",
      author: g.author ? { "@type": "Person", name: g.author } : undefined,
      datePublished: g.date || undefined,
      image: img || undefined,
      publisher: { "@type": "Organization", name: "Сердце Зоны", url: SITE + "/" }
    };
    let html = tpl
      .replace(/<title>[^<]*<\/title>/, "<title>" + esc(title) + "</title>")
      .replace(/(<meta name="description" content=")[^"]*/, "$1" + esc(desc))
      .replace(/(<link rel="canonical" href=")[^"]*/, "$1" + url)
      .replace(/(<meta property="og:type" content=")[^"]*/, "$1article")
      .replace(/(<meta property="og:title" content=")[^"]*/, "$1" + esc(g.title))
      .replace(/(<meta property="og:description" content=")[^"]*/, "$1" + esc(desc))
      .replace(/(<meta property="og:url" content=")[^"]*/, "$1" + url)
      .replace(/(<meta property="og:image:alt" content=")[^"]*/, "$1" + esc(g.title))
      .replace(
        "</head>",
        '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, "\\u003c") + "</script>\n</head>"
      );
    /* своя обложка: og.jpg 1200×630 - с размерами, у картинки из текста размеры неизвестны */
    if (img) {
      html = html
        .replace(/(<meta property="og:image" content=")[^"]*/, "$1" + esc(img))
        .replace(/<meta property="og:image:(?:width|height)"[^>]*>\n?/g, "");
      if (g.ogImage)
        html = html.replace(
          /(<meta property="og:image" content="[^"]*">\n?)/,
          '$1<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'
        );
    }
    const main =
      '<main class="content info-content guide-page" id="main">\n' +
      '<a class="guide-back" href="/guides"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 4l-8 8 8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Все гайды</a>\n' +
      '<article class="result-panel guide-article">\n<h1>' +
      esc(g.title) +
      "</h1>\n" +
      '<p class="guide-meta">' +
      (g.author ? "Автор: " + authorMarkup(g) : "") +
      (g.author && g.date ? '<span aria-hidden="true"> · </span>' : "") +
      (g.date ? '<time datetime="' + esc(g.date) + '">' + ruDate(g.date) + "</time>" : "") +
      "</p>\n" +
      '<div class="guide-body">\n' +
      g.html.replace(/\/guide-img\/[^"\s,?]+/g, u => version(u, "guide/" + g.slug)) +
      "\n</div>\n</article>\n" +
      '<p class="guide-write">Знаете, как пройти что-то лучше? <a href="/guides#send">Отправьте свой гайд</a></p>\n</main>';
    html = html.replace(/<main\b[\s\S]*?<\/main>/, () => main);
    fs.writeFileSync(path.join(OUT, "guide", g.slug + ".html"), html);
    pages++;
  }
  console.log("Гайды: " + guides.length + " стр. в dist/guide");
}

/* ---------- sitemap.xml: lastmod ----------
   Дата страницы - последний коммит её html и подключённых css/js (в GitHub Actions нужен checkout с fetch-depth: 0).
   У Топ-100 - время выгрузки рейтинга из top100-data.js (по Москве): страница меняется вместе с данными */
function gitDate(files) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", ...files], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    if (out) return out;
  } catch (e) {}
  return new Date(Math.max(...files.map(f => fs.statSync(path.join(ROOT, f)).mtimeMs))).toISOString();
}
function top100Date() {
  const m = fs
    .readFileSync(path.join(ROOT, "top100-data.js"), "utf8")
    .match(/TOP100_UPDATED="(\d\d)\.(\d\d)\.(\d{4}) (\d\d:\d\d:\d\d)"/);
  return m ? m[3] + "-" + m[2] + "-" + m[1] + "T" + m[4] + "+03:00" : null;
}
function pageDeps(page) {
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  /* собранный модуль (home-3d.js, calculator.js) в корне не лежит - вместо него берутся его исходники */
  const deps = [...html.matchAll(/(?:href|src)="\/?([^":?#]+\.(?:css|js))"/g)]
    .flatMap(m => MODULES[m[1]] || [m[1]])
    .filter(f => fs.existsSync(path.join(ROOT, f)));
  /* меню и подвал из partials тоже влияют на дату страницы */
  const parts = [...html.matchAll(/<!--\s*@include\s+([\w-]+)/g)]
    .map(m => "partials/" + m[1] + ".html")
    .filter(f => fs.existsSync(path.join(ROOT, f)));
  return [page, ...new Set([...deps, ...parts])];
}
const smSrc = path.join(ROOT, "sitemap.xml");
if (fs.existsSync(smSrc)) {
  const sm = fs
    .readFileSync(smSrc, "utf8")
    .replace(/<url><loc>([^<]+)<\/loc>(?:<lastmod>[^<]*<\/lastmod>)?<\/url>/g, (m, loc) => {
      /* адреса в sitemap без .html (/calculator), файл страницы - calculator.html */
      const slug = new URL(loc).pathname.replace(/^\//, "");
      let page = !slug ? "index.html" : slug.endsWith(".html") ? slug : slug + ".html";
      /* разделы «Информации» собираются из info.html (см. INFO_SECTIONS) */
      if (Object.values(INFO_SECTIONS).some(sec => sec.file === page)) page = "info.html";
      if (!fs.existsSync(path.join(ROOT, page))) return m;
      /* у списка гайдов дата - ещё и последний коммит папок гайдов */
      const deps =
        page === "guides.html" ? [...pageDeps(page), ...guides.map(g => "guides/" + g.slug)] : pageDeps(page);
      const date = (page === "top100.html" && top100Date()) || gitDate(deps);
      return "<url><loc>" + loc + "</loc><lastmod>" + date + "</lastmod></url>";
    });
  /* гайды: страница списка и каждый гайд, дата - последний коммит папки гайда */
  /* /guides может уже стоять в sitemap.xml - тогда второй раз не дописываем */
  const extra = !guides.length
    ? ""
    : [
        ...(sm.includes(SITE + "/guides<")
          ? []
          : [
              "<url><loc>" +
                SITE +
                "/guides</loc><lastmod>" +
                gitDate([...pageDeps("guides.html"), ...guides.map(g => "guides/" + g.slug)]) +
                "</lastmod></url>"
            ]),
        ...guides.map(
          g =>
            "<url><loc>" +
            SITE +
            "/guide/" +
            g.slug +
            "</loc><lastmod>" +
            gitDate(["guides/" + g.slug]) +
            "</lastmod></url>"
        )
      ]
        .map(l => "  " + l + "\n")
        .join("");
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), sm.replace("</urlset>", extra + "</urlset>"));
}
/* ---------- Content-Security-Policy ----------
   GitHub Pages не умеет свои заголовки, поэтому политика - <meta http-equiv> в каждой странице. Встроенные
   <script> разрешены по sha256 их текста (хэши считаются здесь, после всех правок HTML), чужие скрипты запрещены.
   style-src 'unsafe-inline' - из-за style="…" в разметке, которую рисуют скрипты. Капча и функция приёма гайдов
   разрешены только там, где есть форма отправки. frame-ancestors в <meta> не работает - его задаёт Cloudflare */
const CAPTCHA_ORIGINS = ["https://smartcaptcha.yandexcloud.net", "https://challenges.cloudflare.com"];
function cspFor(html) {
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    m => "'sha256-" + crypto.createHash("sha256").update(m[1], "utf8").digest("base64") + "'"
  );
  const form = /guide-submit\.js/.test(html);
  const cap = form ? CAPTCHA_ORIGINS : [];
  return [
    "default-src 'self'",
    ["script-src 'self'", ...hashes, ...cap].join(" "),
    ["style-src 'self' 'unsafe-inline'", ...cap].join(" "),
    "img-src 'self' data: blob:",
    "font-src 'self'",
    ["connect-src 'self'", ...(form ? ["https://functions.yandexcloud.net", ...cap] : [])].join(" "),
    form ? "frame-src " + cap.join(" ") : "frame-src 'none'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join("; ");
}
function addCsp(file) {
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, "");
  const meta = '<meta http-equiv="Content-Security-Policy" content="' + cspFor(html) + '">';
  if (!/<meta charset="utf-8">/i.test(html)) throw new Error("CSP: в " + file + " нет <meta charset>");
  fs.writeFileSync(file, html.replace(/(<meta charset="utf-8">)\n?/i, "$1\n" + meta + "\n"));
}
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith(".html")) addCsp(f);
  }
})(OUT);

/* ---------- service worker ----------
   dist/sw.js = sw.js из корня + версия сборки и список «оболочки»: основные страницы, страница offline и всё,
   что они подключают с ?v= (css, js, шрифты, картинки). Версия - хэш этих адресов и самих страниц, поэтому любая
   правка сайта даёт новый sw.js: браузер ставит его и удаляет старый кэш оболочки. Картинки боссов входят в оболочку;
   фоны тем, картинки гайдов и 3D главной - нет (тяжёлые), они кэшируются при первом показе.
   Видео боссов service worker не трогает: браузер грузит их кусками (Range), такие ответы в кэш не кладутся */
{
  const SHELL_PAGES = [
    "index.html",
    "info.html",
    "info-tasks.html",
    "info-bosses.html",
    "calculator.html",
    "build.html",
    "top100.html",
    "guides.html",
    "compare.html",
    "offline.html"
  ];
  const urls = new Set(),
    h = crypto.createHash("sha1");
  for (const name of SHELL_PAGES) {
    const file = path.join(OUT, name);
    if (!fs.existsSync(file)) throw new Error("service worker: нет страницы " + name);
    const html = fs.readFileSync(file, "utf8");
    h.update(html);
    urls.add(name === "index.html" ? "/" : "/" + name.replace(/\.html$/, ""));
    for (const m of html.matchAll(/<(?:link|script|img)\b[^>]*?\s(?:href|src)="([^"]+\?v=[^"]+)"/g))
      if (!/^([a-z]+:)?\/\//i.test(m[1])) urls.add(m[1].startsWith("/") ? m[1] : "/" + m[1]);
  }
  /* картинки и шрифты из стилей оболочки (иконки оружия, woff2), кроме фонов тем и запасных ttf/woff */
  for (const u of [...urls].filter(x => /\.css\?/.test(x))) {
    const css = fs.readFileSync(path.join(OUT, u.split("?")[0].slice(1)), "utf8");
    for (const m of css.matchAll(/url\((["']?)([^"')]+\?v=[^"')]+)\1\)/g))
      if (!/^([a-z]+:)?\/\//i.test(m[2]) && !/(^|\/)assets\/bg-|\.(ttf|woff)\?/.test(m[2]))
        urls.add(m[2].startsWith("/") ? m[2] : "/" + m[2]);
  }
  /* картинки, которые страницы оболочки подключают без ?v (иконки наград, постеры и вещи боссов, ~0,2 МБ),
     и все картинки раздела «Боссы»; видео боссов в оболочку не входят */
  for (const name of SHELL_PAGES)
    for (const m of fs
      .readFileSync(path.join(OUT, name), "utf8")
      .matchAll(/\s(?:src|poster)="\/?(assets\/[^"?#]+\.(?:webp|png|jpe?g|svg))"/g))
      if (fs.existsSync(path.join(OUT, m[1]))) urls.add("/" + m[1]);
  for (const f of fs
    .readdirSync(path.join(OUT, "assets", "bosses"))
    .filter(f => /\.webp$/.test(f))
    .sort())
    urls.add("/assets/bosses/" + f);
  const list = [...urls];
  h.update(list.join("\n"));
  /* содержимое картинок без ?v тоже входит в версию: заменили картинку - обновится и кэш */
  list
    .filter(u => !u.includes("?") && /\.\w+$/.test(u))
    .forEach(u => h.update(fs.readFileSync(path.join(OUT, u.slice(1)))));
  const src = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  if (!src.includes('"__SW_VERSION__"') || !src.includes('"__SW_PRECACHE__"'))
    throw new Error("service worker: в sw.js нет меток __SW_VERSION__ / __SW_PRECACHE__");
  const code = src
    .replace('"__SW_VERSION__"', JSON.stringify(h.digest("hex").slice(0, 10)))
    .replace('"__SW_PRECACHE__"', JSON.stringify(list));
  fs.writeFileSync(
    path.join(OUT, "sw.js"),
    esbuild.transformSync(code, {
      loader: "js",
      minify: true,
      target: "es2020",
      legalComments: "none",
      charset: "utf8"
    }).code
  );
  const kb = list.reduce((a, u) => {
    const f = path.join(OUT, u.split("?")[0] === "/" ? "index.html" : u.split("?")[0].slice(1));
    const real = fs.existsSync(f) ? f : f + ".html";
    return a + (fs.existsSync(real) ? fs.statSync(real).size : 0);
  }, 0);
  console.log("Service worker: оболочка " + list.length + " файлов, " + (kb / 1024).toFixed(0) + " КБ");
}

console.log("Готово: " + pages + " стр. в " + path.relative(process.cwd(), OUT));
