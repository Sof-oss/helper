---
name: site-dev
description: Устройство и сборка сайта «Сердце Зоны» - карта страниц, конвейер build.js (SKIP, partials, склейка и очистка CSS, ?v=, CSP, service worker, sitemap, страницы /f /build /guide /info-*), dev.js, шапка и меню, тур, 404/offline, превью для мессенджеров и иконки (build-logo.js, build-previews.js), конвенции кода и документации. Бери для любой правки кода/вёрстки вне конкретного раздела и когда пользователь пишет «добавь новую страницу/раздел», «добавь пункт в меню», «класс пропал на сайте», «скрипт/картинка не грузится, ошибка CSP», «подключи внешний скрипт/API», «не работает офлайн», «поменяй превью ссылки/иконку», «новый служебный файл в корне», «обнови README/DEVELOPMENT».
---

# Устройство и сборка сайта

## Когда использовать
- Новая страница или раздел, меню, шапка/подвал, 404/офлайн, CSP, CSS-очистка, PWA/service worker, sitemap, превью и иконки, новые файлы в корне, конвенции кода, документация.
- Не сюда: темы оформления группировок - **factions**; Хэллоуин и праздники (`season.js`, `halloween.*`, тыква в шапке) - **seasonal-events**; содержимое разделов - **calculator**, **top100**, **game-info**, **guides**, **zone-news**, **site-news**; проверка, коммит и PR - **verify-and-ship**.
- Сборку (`npm run build`, `node build.js`, `dev.js`) не запускай, если рядом работают другие агенты: она пересоздаёт `dist/`. Безопасный вариант: `BUILD_OUT=/tmp/hotz node build.js` (build.js пишет только в OUT; так же делает `test/build.test.mjs`). `build-changelog.js` и `build-logo.js` пишут в отслеживаемые файлы.

## Карта страниц (корень репозитория; адрес на сайте - без `.html`)
Везде: `<!-- @include header active="/раздел" -->`, `<!-- @include footer -->`, `ui.js`, `nav.js`. В скобках - css, затем js.
- `index.html` -> `/` - главная (styles, zone3d, home, lightbox, tour, my-place; changelog, lightbox, news, zone-players, my-place, home-live, tour, модуль `home-3d.js`). Пререндер: `#homeNews`, `#zoneNews`, живые строки плашек `#hcInfo #hcTop #hcGuides #hcFactions` (`homeLive()`).
- `calculator.html` -> `/calculator` (styles, calculator, tour, sector; модуль `calculator.js`, tour). Копия `/build` - превью «Смотри мой билд», noindex.
- `info.html` -> `/info`, а сборка делает ещё `/info-tasks`, `/info-bosses` (`INFO_SECTIONS`, метки `<!--sec:ключ-->`) (styles, info-tasks, tour, sector; info-data, info, tasks-data, info-tasks, info-bosses, tour).
- `top100.html` -> `/top100` (styles, tour, player-card, faction-card, zone-players, my-place, top100-sort, sector; top100-data, top100-common, top100, awards, player-card, faction-card, zone-players, my-place, tour).
- `compare.html` -> `/compare` (styles, player-card, zone-players, my-place, compare, sector; zone-players, compare), в меню подсвечен `/top100`, тура нет.
- `factions.html` -> `/factions` (styles, player-card, faction-card, factions, tour, sector; factions, top100-common, awards, player-card, faction-card, tour). Сборка пишет `/f/<slug>` и `factions-cards.json`.
- `guides.html` -> `/guides` (styles, tour, guides, lightbox, sector; lightbox, guide-md, guides-config, guide-submit, tour). Из неё же - `/guide/<адрес>` (без скриптов формы).
- `404.html` (styles, notfound) - переадресации: `/p/<id>` -> `/top100#p=<id>`, `/f/<slug>` -> `/factions#f=<slug>`, адрес со слешем/`.html` -> без них, но только из списка в регулярке.
- `offline.html` -> `/offline` (styles, notfound) - отдаёт `sw.js` без сети.
- Генерируются: `/p/<id>` - `build-previews.js` (карточки игроков), `/f/<slug>` - `writeFactionCards()` в build.js.
Каждой странице build.js сам добавляет: manifest, `sw-register.js`, `season.js`, `intro.js` (кроме 404/offline), view transitions, preload фона темы, CSP.

## Конвейер build.js по шагам
1. **Копирование** всего корня в `dist/`, кроме `SKIP`. Новая служебная папка или файл в корне (скрипт сборки, данные-исходник, заметки, конфиг) **попадёт на сайт**, если не добавить имя в `SKIP`. Не в `SKIP` сейчас (и уезжают в dist): `build-depth.py`, `.gitattributes`, локальный `.cache/`. Исходники модулей вне `src/` (`app.js`, `talents.js`) исключаются автоматически по `MODULES`.
2. **Гайды** читаются из `guides/<адрес>/index.md` (скилл **guides**).
3. **Модули esbuild**: `src/home-3d.js` -> `home-3d.js` + `3d/*`, `src/calculator.js` -> `calculator.js` + `calc/*`. Это два явных вызова `esbuild.buildSync`; объект `MODULES` (файл в dist -> исходники) нужен для SKIP, пропуска повторного сжатия и даты в sitemap. Новый модуль = новый вызов esbuild + запись в `MODULES` + `<script type="module" src="имя.js">`.
4. **Partials**: в корневых `*.html` `<!-- @include имя active="/адрес" -->` заменяется на `partials/имя.html`. `active` должен совпадать с `<a href="...">` в partial, иначе сборка падает; подсвечиваются все ссылки с этим href (верхнее меню, нижнее, «Ещё»). Нет `<script src="tour.js">` на странице - кнопке «?» ставится `data-no-tour`. `__HW_SEASON__` - из `season.js`.
5. **Пререндер** `PRERENDER[страница]`: прогон скриптов в заглушке DOM (`fakeDom`), результат вшивается `fill(html, id, inner)`. Внутри элемента - только текст-заглушка без тегов (`<span id="x">Заглушка</span>`), иначе «В HTML нет элемента #x». Скрипты, которые выполняются в пререндере, не должны падать без настоящего DOM (проверка `typeof location`, `d.body`).
6. **CSS**: все `<link rel="stylesheet" href="x.css">` страницы (ровно в такой форме, без других атрибутов - иначе не склеится) -> один `bundle-<sha1>.css`, исходные css удаляются из dist. Перед склейкой postcss выкидывает правила, чьи классы/id не встречаются как слово ни в HTML страницы, ни в её скриптах (`<script src>`, `LAZY_JS`, `EVERY_PAGE_JS`), ни в корневых `*.json` (кроме package*, top100-players), ни в `build.js` (+ `build-factions.js` для factions). Селекторы внутри `:not()/:has()/:is()` не проверяются.
   - Динамический класс пиши целиком (`"is-open"`) или строкой-префиксом с дефисом: `"x-" + имя`, `` `x-${имя}` `` - тогда сохранится всё `x-*`; `"step" + n` сохраняет `step1`, `step2`.
   - Скрипт, который грузит другой скрипт сам, - добавь пару в `LAZY_JS`. CSS, который подключает JS (как `intro.css`, `halloween.css`), не ставь `<link>`-ом ни на одну страницу: он будет удалён из dist.
7. **Сжатие** esbuild всех корневых `.css/.js` в dist (кроме модулей).
8. **Версии `?v=<sha1 8>`**: иконки в `manifest.webmanifest`; `url()` в css; строки `"/assets/....webp|png|jpg|svg|gif"` в корневых js; в HTML - все `<link href>`, `<script src>`, `<img src="/assets|/guide-img...">`, `srcset`, `og:image`/`twitter:image`/`vk:image` (только абсолютный `https://heart-of-the-zone.ru/...`; ручной `?v=3` заменится). Нет файла - предупреждение «нет файла для ссылки». Пути пиши от корня (`/assets/...`).
9. **Встроенные скрипты** перед первым `<link rel="stylesheet">`: preload фона темы (список тем `THEMES` в build.js - см. **factions**) и `INTRO_FLAG` (интро-ПДА новичкам, `intro.js`/`intro.css`, метка `localStorage.zonePdaSeen`, `?intro` - показать снова).
10. **pwaTags**: manifest, `sw-register.js`, view transitions (нужен ровно `<meta charset="UTF-8">`), `season.js`, `intro.js`. Затем `lazyTour`: `<script src="tour.js">` заменяется загрузчиком `tourLoader`.
11. **Страницы-производные**: `/info-tasks`, `/info-bosses`; `/build` (`BUILD_OG`, `assets/preview-build.jpg`); `/guide/<адрес>`; `/f/<slug>` (noindex, превью `assets/preview.jpg`, `location.replace` на `/factions#f=`).
12. **sitemap.xml**: из корневого `sitemap.xml` (строки `<url><loc>https://heart-of-the-zone.ru/адрес</loc></url>`) + `<lastmod>` = дата последнего коммита страницы, её css/js (для модулей - исходники `MODULES`) и partials; Топ-100 и «Группировки» - дата `TOP100_UPDATED`; гайды дописываются сами. Поэтому в деплое `fetch-depth: 0`.
13. **Длинное тире** (U+2014, `&mdash;`, `&#8212;`) -> `-` во всех html/js/json/css/xml/txt/md в dist (до CSP, чтобы хэши совпали).
14. **CSP** `<meta http-equiv>` во все `.html` dist (`cspFor()`): `script-src 'self'` + sha256 каждого `<script>...</script>` **без атрибутов**; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob:`; `font-src 'self'`; `connect-src 'self'`; `frame-src 'none'`; `worker-src 'self' blob:`; `object-src 'none'`; капча и `functions.yandexcloud.net` - только на странице с `guide-submit.js`.
15. **sw.js**: `SHELL_PAGES` -> список оболочки (`__SW_PRECACHE__`) и версия (`__SW_VERSION__`): все `?v=`-файлы этих страниц (кроме `top100-data.js`/`top100-players.json`), `tour.js`, картинки и шрифты из их css (кроме `bg-*`, `depth-*`, ttf/woff), `<img>` из `/assets`, `calc/*.js`, `assets/bosses/*.webp`, `/offline`.

## dev.js
`node dev.js` или `dev.bat`: `build-changelog.js` (только если менялся `site-news.json`) + `build.js`, сервер `dist/` на http://localhost:3000 (занят - 3001...3020; `--port N`, `--no-open`), адреса без `.html`, 404 -> `404.html`, перезагрузка вкладок через `/__dev/reload.js` и плашка ошибки. Service worker выключен (отдаётся «самоудаляющийся»), `--sw` - настоящий. Не пересобирает: картинки гайдов (`build-guide-images.js`), `build-previews.js` (нет `/p/<id>`), `build-logo.js`. Не следит за `dist`, `node_modules`, `.git*` и файлами с точкой.

## Сценарий: новая страница/раздел `/new`
1. `new.html` в корне - скопируй `compare.html` как образец. Обязательно: `<meta charset="UTF-8">`, встроенные скрипты темы и «адрес без .html» в `<head>`, `title`, `description`, `canonical` (на него опирается `nav.js`), `og:*` с абсолютным `og:image`, JSON-LD хлебных крошек, иконки, preload Oswald, css через `<link rel="stylesheet" href="/x.css">` (`styles.css` первым, `sector.css` последним), `<!-- @include header active="/new" -->`, `<main class="content ..." id="main">` (на `#main` ведёт skip-link), заголовок `.result-title data-sector="0N" data-zone="..."` (цвет сектора - `sector.css`), `<!-- @include footer -->`, скрипты `defer` перед `</body>`. Без `onclick=` и встроенных `<script type=...>` - их заблокирует CSP. Стили страницы - отдельный `new.css`.
2. Меню в `partials/header.html`: `.main-nav` (иконка `svg.nav-icon` + текст), нижнее `.tabbar` (сейчас Главная, Топ-100, Группы, Урон + «Ещё») или `#tabbarMore` (Информация, Гайды, с `<small>`). Если в «Ещё» - добавь адрес в проверку `herePath` в `ui.js` (подсветка кнопки «Ещё»). Подстраница без своего пункта - `active` родителя (как `compare` -> `/top100`).
3. `SHELL_PAGES` в build.js (иначе офлайн без её css/js; страница должна существовать в dist).
4. `sitemap.xml` - строка `<url><loc>https://heart-of-the-zone.ru/new</loc></url>` (если индексировать; иначе `<meta name="robots" content="noindex, follow">`). `robots.txt` обычно не трогай (там Allow: / и ссылка на sitemap).
5. `404.html`: добавь `new` в регулярку адресов со слешем/`.html`; ссылку в `.nf-links` в `404.html` и `offline.html` - для основного раздела.
6. Превью для мессенджеров: своя обложка - ключ в `SECTION_PREVIEWS` в `build-logo.js` (+ при нужде пункт в `.nav` в `previews/site.html`, `on` - его номер) и `og:image` на `assets/preview-new.jpg`; иначе общий `assets/preview.jpg`.
7. Тур: `tour.css` + `<script src="tour.js" defer>` и шаги в `STEPS` в `tour.js` подряд, `{ g, page: "/new", sel, title, text, list?, prep? }`: `g` - ключ `G` (добавь группу `{ name, color }`), `sel` - селектор или массив, без `sel` окно по центру, `prep()` - открыть нужную вкладку. Обнови текст шага `.home-grid`.
8. Главная: карточка `a.home-card` в `.home-grid` `index.html` (`--accent*`, `.hc-live` с id); живую строку - через `fill()` в `homeLive()`.
9. Необязательно: `shortcuts` в `manifest.webmanifest`; данные, меняющиеся ежедневно, - по образцу `top100-data.js`: `networkFirst` в `sw.js` и исключение из оболочки в build.js.
10. `README.md` (раздел для игроков), `DEVELOPMENT.md` (файлы и устройство), запись в «Новости сайта» - **site-news**.

## Другие сценарии
- **Внешний ресурс**: скрипт/`fetch`/картинка/iframe с другого домена - допиши источник в нужную директиву `cspFor()`, по возможности только для страницы, где он нужен (как `form` для капчи). Лучше скачать картинку в `assets/`.
- **Класс пропал на сайте**: найди, как он собирается в JS, и сделай его целым словом или префиксом с дефисом (шаг 6); скрипт подключён динамически - `LAZY_JS`.
- **Новый служебный файл/папка/скрипт сборки в корне**: добавь в `SKIP`; Node-скрипт назови `build-*.js` (получит node-глобалы в eslint) или допиши в `eslint.config.mjs`; если он нужен в деплое - шаг Build в `pages.yml` и `npm run build` в `package.json`.
- **Иконки, логотип, превью разделов**: `node build-logo.js` - рисует в Chrome (переменная `CHROME` = путь к exe, иначе установленный Chrome; `CHROME_PATH` ему не нужен) `favicon.svg/.ico`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png`, `assets/heart-logo.webp`, `assets/heart-core.webp`, `assets/preview.jpg` (1200x628, `previews/site.html`), `assets/preview-{calculator,top100,info,guides}.jpg`, и **переписывает логотип в `partials/header.html`** (`src/zone-sign.js`). Всё это коммитится. `assets/preview-build.jpg` скрипты не рисуют.
- **Превью карточек игроков**: `build-previews.js` (после build.js, в `npm run build` и деплое) - `dist/og/p/<id>.jpg` (по `previews/dossier.html`) и `dist/p/<id>.html` со своим CSP; в репозиторий не попадают. Chrome ищет `build-chrome.js` (`CHROME_PATH`, стандартные пути); без него - общая `assets/preview-dossier.jpg`. `node build-previews.js --generic` перерисовывает её (коммитится).

## Конвенции кода
- Браузерные скрипты в корне - обычные `<script defer>`, без import/export, обычно в IIFE с `"use strict"`; общее - через `window.*` (`ui.js`: `__vt`, `__roll`, `__trapTab`, `__factionEmblem`, `__groupDigits`) или глобальные имена. Глобал из другого файла: в файле-источнике `/* exported имя1, имя2 */` (как `top100-common.js`), у потребителя - `globals` в `eslint.config.mjs`.
- ES-модули - `src/**`, `app.js`, `talents.js`, `*.mjs`; в браузер только через esbuild.
- Комментарии - только `/* ... */`, коротко, по-русски, зачем, а не что. Первая строка файла - `/* Назначение. */`.
- Prettier: `printWidth` 120, `arrowParens: "avoid"`, `trailingComma: "none"`. Не форматируются (`.prettierignore`): `*.html` кроме `partials/*.html`, `*.md`, `assets/`, `top100/`, данные (`top100-data.js`, `top100-players.json`, `tasks-data.js`, `info-data.js`, `talents.js`, `site-news.json`), `changelog.js`. В partials длинные строки помечены `<!-- prettier-ignore -->`. ESLint не смотрит `top100/**`, `top100-data.js`, `info-data.js`, `tasks-data.js`, `changelog.js`.
- Переносы строк LF (`.gitattributes`), `.bat` - CRLF.
- Тексты: русский, «ёлочки», только дефис «-» (длинное тире сборка заменит, но не пиши его).

## Документация
- `README.md` - для игроков, без техники: что умеет каждый раздел. Обновляй при новом разделе или заметной для игрока функции.
- `DEVELOPMENT.md` - для разработчика: команды, устройство, файлы. Обновляй при новых файлах, шагах сборки, правилах, переменных. Неточности там сейчас: `CHROME_PATH` не действует на `build-logo.js`; «10 тем», а в `ui.js` 11.

## Подводные камни
- `fill()` и `pwaTags` бросают ошибку при отсутствии элемента, `</body>` или `<meta charset="UTF-8">` - сборка и деплой падают.
- Встроенный `<script>` с атрибутами не получает хэш в CSP - не выполнится. Хэш считается после всех замен, поэтому после `addCsp` HTML менять нельзя.
- `?v=` ставится только у локальных путей; `og:image` с относительным адресом останется без версии.
- `404.html`: в регулярке переадресации со слешем нет `compare` и `factions` - `/compare/` и `/factions/` дают 404.
- Сайт деплоится сам при push в `main` (`.github/workflows/pages.yml`: `npm ci` -> `npm test && npm run lint && npm run format:check` -> `build-changelog.js`, `build-guide-images.js`, `build.js`, `build-previews.js` -> сохранение `site-news.json` -> Pages). Упавший тест/линт/формат = сайт не обновится.

## Проверка
- По шагам и командам - **verify-and-ship**. Специфично здесь: `npm test` (`test/build.test.mjs` собирает во временную папку и проверяет CSP, bundle, sitemap, оболочку SW; `test/pwa.test.mjs` - manifest и sw.js).
- В собранной странице: нет `@include`, есть `bundle-*.css?v=`, CSP-meta, страница в `PRECACHE` в `dist/sw.js` (ключевые файлы), адрес в `dist/sitemap.xml` с `lastmod`.
- Глазами: новая страница на компьютере и телефоне (≤760 px: нижнее меню, «Ещё»), подсветка пункта меню, консоль без ошибок CSP, «?» тура, офлайн - `node dev.js --sw`.

## Связанные скиллы
**factions** (темы оформления, `THEMES`/`GLYPHS`, фоны), **seasonal-events** (сезонное оформление), **site-news** (объявить изменение), **guides**, **calculator**, **top100**, **game-info**, **zone-news**, **verify-and-ship**.
