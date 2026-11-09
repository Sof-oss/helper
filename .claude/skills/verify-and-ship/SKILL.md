---
name: verify-and-ship
description: Проверка любой правки сайта «Сердце Зоны» перед публикацией и сама публикация - тесты, ESLint, Prettier, сборка в dist/, локальный сервер, скриншоты страниц на компьютере и телефоне с ошибками консоли и CSP (скрипт screenshots.mjs), коммит, pull request или push в main (= деплой на GitHub Pages), проверка деплоя и живого сайта. Бери в конце любой задачи по сайту и когда пользователь пишет «проверь», «сделай скриншоты», «посмотри, как выглядит на телефоне», «закоммить», «сделай PR», «опубликуй», «выложи на сайт», «задеплой», «почему не обновился сайт», «упал деплой».
---

# Проверка и публикация

## Когда использовать

- В конце любой правки: прогнать то же, что прогоняет деплой, собрать, посмотреть глазами, закоммитить, отдать.
- Деплой упал или сайт после push не обновился.
- Специфику областей (что именно смотреть в калькуляторе, гайдах и т. д.) дают их скиллы: calculator, guides,
  zone-news, site-news, game-info, factions, top100, seasonal-events; устройство сборки, CSP, PWA - site-dev.
  Сообщения коммитов для «Новостей сайта» (теги `new:`/`up:`/`fix:`) - подробно в **site-news**.

## Файлы

- `.github/workflows/pages.yml` - деплой на каждый push в `main` (и вручную). Шаги: `npm ci` -> `npm test && npm run lint
  && npm run format:check` -> `node build-changelog.js && node build-guide-images.js && node build.js && node
  build-previews.js` -> служебный коммит `site-news.json` -> выкладка `dist/`. Упал любой шаг - сайт не обновился.
  Других проверок нет: **pull request CI не запускает**, всё проверяется только локально.
- `package.json` - `test` (`node --test test/*.test.mjs`), `lint` (`eslint .`), `format` / `format:check` (Prettier),
  `build` (все четыре сборщика).
- `eslint.config.mjs` - только явные ошибки; `.prettierrc.json` (ширина 120, без висячих запятых), `.prettierignore`
  (данные, `*.html`, `*.md`, `changelog.js`, `site-news.json`…).
- `build.js` - быстрая сборка исходников в `dist/` (в `.gitignore`); `dev.js` / `dev.bat` - сборка + сервер + пересборка
  при сохранении; `build-chrome.js` - поиск Chrome для сборщиков картинок.
- `.claude/skills/verify-and-ship/screenshots.mjs` - скриншоты + ошибки (см. ниже).

## 1. Обязательный минимум (как в деплое)

```sh
npm ci                      # если нет node_modules или менялся package-lock.json
npm test && npm run lint && npm run format:check
node build.js               # ~2 с, пишет только в dist/
```

- `npm test` (~2 с, 45 тестов): формулы калькулятора, разметка гайдов, Топ-100, группировки, PWA и сама сборка
  (`test/build.test.mjs` собирает сайт во временную папку через `BUILD_OUT`, рабочий `dist/` не трогает).
- `npm run lint` - падают только ошибки; предупреждения (`no-unused-vars`) не роняют деплой, но новых не добавляй.
- Перед коммитом отформатируй: `npm run format` (пишет во все файлы проекта) или точечно
  `npx prettier --write --ignore-unknown <изменённые файлы>`. HTML и Markdown Prettier не трогает (`.prettierignore`).
- Если упало:
  - тест - читай сообщение `assert`, чини код (или тест, только если поведение поменялось намеренно - и скажи об этом);
    тесты не отключай и не ослабляй;
  - lint - `no-undef` обычно значит, что скрипту страницы нужен глобал из другого файла: добавь его в `globals` для этого
    файла в `eslint.config.mjs` (так сделано для `info.js`, `top100.js`, `player-card.js`), а не `/* eslint-disable */`;
  - format:check - `npx prettier --write <файл>` и проверить ещё раз;
  - `node build.js` - падает с понятным текстом (`throw new Error(...)`: нет `title` в гайде, нет `</body>`, нет меток в
    `sw.js` и т. п.). Строки «Предупреждение: …» (например, нет картинки в гайде) сборку не роняют, но их надо исправить.
- **Подвох в рабочих каталогах агентов**: `prettier --check .` проверяет и неотслеживаемые служебные папки (например
  `.hoplite/` - Prettier не читает `.git/info/exclude`) и падает на чужих файлах. Если ошибки только в таких путях,
  проверь ровно то, что попадёт в git (так же ведёт себя CI), служебные папки не трогай:
  ```sh
  git ls-files -z -co --exclude-standard | xargs -0 npx prettier --check --ignore-unknown
  ```

## 2. Быстрая сборка против полной

- `node build.js` - всё, что видно на сайте из исходников: страницы, css/js, CSP, `?v=`, гайды, `sw.js`. Хватает почти
  всегда. Пишет только в `dist/`.
- `npm run build` = `build-changelog.js` + `build-guide-images.js` + `build.js` + `build-previews.js`. Нужна редко и
  **меняет отслеживаемые файлы**:
  - `build-changelog.js` - импортирует коммиты с тегами в `site-news.json` и перезаписывает `changelog.js`. Локально
    не нужен (это сделает CI). Посмотреть, что он импортирует, без записи - `node build-changelog.js --dry`.
    Если запустил - `git checkout -- site-news.json changelog.js`, если только задача не про новости (скилл site-news);
  - `build-guide-images.js` - создаёт рядом с картинками гайдов `<файл>-800w.webp` и `og.jpg`. Нужен, когда добавил
    или заменил картинки гайда; новые файлы **коммитятся вместе с гайдом** (скилл guides). Без Chrome - только
    предупреждение;
  - `build-previews.js` - превью карточек игроков в `dist/og/p/` и страницы `dist/p/` (тысячи картинок, долго, нужен
    Chrome). Локально нужен только при правке `previews/` или `build-previews.js`. `--generic` перерисовывает
    отслеживаемый `assets/preview-dossier.jpg`.
- `build-logo.js` (иконки, превью разделов, знак в `partials/header.html`) в сборку не входит - только по задаче про логотип.
- После любой сборки: `git status` - в изменениях только твои правки (`dist/` игнорируется).
- В неглубоком клоне (`git clone --depth 1`) даты коммитов для `sitemap.xml` и новости будут неполными; CI берёт всю
  историю - на результат деплоя это не влияет.

## 3. Локальный сервер

На GitHub Pages адреса без `.html` (`/calculator`, `/guide/vylazki`), поэтому `python3 -m http.server -d dist`
не подходит (`/calculator` -> 404). Варианты:

- `node dev.js --no-open` (порт 3000, занят - следующий): сам запускает `build.js`, пересобирает при сохранении,
  **выключает service worker** (отдаёт вместо `sw.js` «самоудаляющийся»). `--sw` - с настоящим SW, `--port 3001`.
  Это долгий процесс - запускай в фоне и останавливай после проверки.
- `node .claude/skills/verify-and-ship/screenshots.mjs --serve --port 3000` - просто отдаёт готовый `dist/` по тем же
  правилам, без пересборки (SW при этом настоящий).
- `npx serve dist` из DEVELOPMENT.md - пакет `serve` в проект **не установлен**, npx скачает его из сети
  (`npx --yes serve dist`); без сети не работает.

## 4. Скриншоты и ошибки консоли/CSP

```sh
node build.js && node .claude/skills/verify-and-ship/screenshots.mjs
```

- Сам поднимает сервер `dist/` на свободном порту, открывает `/`, `/calculator`, `/top100`, `/factions`, `/info`,
  `/guides` на компьютере (1440×900) и телефоне (390×844, DPR 2, touch), снимает всю страницу и печатает по каждой
  странице ошибки: `console.error`, исключения, CSP (`securitypolicyviolation`), запросы с ошибкой и HTTP ≥ 400.
  Код выхода 1 - есть ошибки, 2 - нет `dist/` или браузера. Прогон 12 кадров ~35 с.
- Кадры - в `/tmp/hotz-shots/<страница>-<desktop|mobile>.png`, **вне репозитория**; не коммить их. Смотри PNG
  глазами (инструментом чтения картинок), а не только код выхода.
- Опции: `--pages /,/guide/vylazki,/info-bosses` · `--only desktop|mobile` · `--viewport` (только первый экран,
  полные кадры Топ-100 и «Группировок» на телефоне - 3-6 МБ) · `--out папка` · `--theme dolg` · `--ls ключ=значение`
  (любой ключ `localStorage`, можно несколько) · `--tour` (не прятать кнопку тура) · `--url https://heart-of-the-zone.ru`
  (снять уже работающий сайт: dev.js или живой).
- Темы (`THEMES` в `ui.js`, ключ `localStorage.zoneTheme`): `merc` (по умолчанию), `dolg`, `svoboda`, `science`,
  `monolith`, `rassvet`, `loners`, `traders`, `renegades`, `clearsky`, `bandits`.
- Что скрипт ставит в `localStorage` до загрузки, и почему:
  - `zonePdaSeen=1` - иначе новичку вместо страницы показывается интро ПДА (`INTRO_FLAG` в `build.js`, `intro.js`;
    старая метка `zoneIntroSeen` тоже работает; под Playwright интро и так пропускается из-за `navigator.webdriver`,
    принудительно показать - `?intro` в адресе);
  - `zoneTourSeen=1` - на главной прячет кнопку «Короткий тур по сайту» и показывает «?» в шапке. Сам тур сам не
    стартует: только по кнопке, `#tour` в адресе или незаконченный шаг `sessionStorage.zoneTourStep`;
  - `zoneThemeHintSeen=1` - убирает пульсацию переключателя темы (класс `hint`).
  - Хэллоуин: `--ls hotzHalloween=off` (значения и даты - скилл seasonal-events).
- Service worker в контексте заблокирован (`serviceWorkers: "block"`), чтобы не снять закэшированную сборку.
- Браузер: `findChrome()` из `build-chrome.js` (`CHROME_PATH`, затем `/usr/bin/google-chrome(-stable)`,
  `/usr/bin/chromium(-browser)`, `which chromium`, Chrome на macOS/Windows), иначе браузер Playwright из
  `~/.cache/ms-playwright` (`npx playwright install chromium` - нужна сеть). `playwright-core` - из devDependencies.
- Для своих сценариев (клик, открыть окно калькулятора) копируй подход из скрипта: тот же `addInitScript` с ключами,
  `serviceWorkers: "block"`, `page.on("console"|"pageerror")`.

## 5. Service worker и «старая версия»

- `sw.js` кэширует оболочку (css/js/шрифты/картинки с `?v=` - из кэша, страницы и данные Топ-100 - сначала из сети).
  На `localhost` SW регистрируется (это безопасный контекст), поэтому при ручной проверке через `--serve`, `npx serve`
  или `dev.js --sw` можно увидеть прошлую сборку. Лечится: `dev.js` без `--sw`; в Chrome - DevTools → Application →
  Service workers → Unregister + Clear storage; в Playwright - `serviceWorkers: "block"`.
- Офлайн-режим проверяй намеренно: `node dev.js --sw`, открыть страницы, затем отключить сеть.

## 6. Публикация

- **Push в `main` = деплой** на https://heart-of-the-zone.ru/ (~40-60 с). Владелец - Sof.
- **По умолчанию - pull request**, если владелец не сказал «пушь в main» / «опубликуй сразу»:
  ```sh
  git switch -c <ветка>             # или текущая рабочая ветка, если среда её уже дала
  git add <конкретные файлы> && git commit
  git push -u origin HEAD
  gh pr create --base main --title "..." --body "..."   # в описании: что сделано и какие проверки прогнаны
  ```
  Ветки в репо: `guide/<адрес>` (форма гайдов), `dependabot/...`; для своих бери короткое понятное имя.
  Сливает владелец. Для PR с тегами новостей лучше «Create a merge commit» или «Rebase and merge»: `build-changelog.js`
  читает `git log --no-merges`, исходные коммиты с тегами попадут в новости. При squash в репо стоит сообщение
  `COMMIT_MESSAGES` - проверь, что строки `new:`/`up:`/`fix:` в итоговом сообщении начинаются с начала строки
  (строка с `* ` в начале не распознаётся).
- Прямой push в main (только если разрешили):
  ```sh
  git pull --rebase origin main     # ВСЕГДА: CI после деплоя с тегами коммитит site-news.json, бот Топ-100 - данные
  git push origin HEAD:main
  ```
  Конфликт в `site-news.json` - оставь обе стороны, JSON должен остаться валидным (скилл site-news). Не делай
  `--force`.
- Коммить только нужные файлы (`git add <пути>`, не `git add -A`): не попадают `dist/`, скриншоты, случайно
  перегенерированные `changelog.js`/`site-news.json`, служебные папки среды.
- Сообщения коммитов: в истории смесь - недавно английские в повелительном наклонении («Add timed boss raid news
  banner», «Fix …») с пояснением в теле, раньше русские («Добавить карточки группировок»). Первая строка - кратко что
  сделано; тело - зачем/подробности. Видимое игрокам изменение объявляй строками-тегами в теле:
  ```
  Add arsenal tab to token calculator

  new: В <a href="/calculator">калькуляторе</a> в окне «Расчёт по жетонам» появилась вкладка «Мой арсенал»
  fix: На телефоне подсказка на графике уровней больше не уходит за край экрана
  ```
  Текст тегов - по-русски, для игроков; служебные правки - без тегов; `[skip news]` - не брать коммит в новости.
  Как формируется запись, заголовок и даты - **site-news**.

## 7. После деплоя

```sh
gh run list --workflow pages.yml --limit 5     # статус, коммит, длительность
gh run watch <id> --exit-status                 # дождаться конкретный запуск
gh run view <id> --log-failed                   # что упало
```

- Упал «Tests and lint» - то же, что локально в разделе 1; упал «Build» - смотри лог (`throw` в `build.js` или
  сборщике картинок). Сайт при этом остаётся прошлой версии. Повторный запуск - новый push с исправлением
  (`gh run rerun` / `gh workflow run pages.yml --ref main` требуют прав Actions на запись).
- Живой сайт: HTML отдаётся с `cache-control: max-age=600` - до 10 минут можно видеть старую страницу. Проверяй в
  обход кэша: `curl -s "https://heart-of-the-zone.ru/calculator?nocache=$(date +%s)" | grep -c '<новый текст>'`.
  Файлы css/js/картинки имеют `?v=<хэш содержимого>` - сменился файл, сменился и `?v=`, сравни с `dist/`:
  `grep -o 'bundle-[0-9a-f]*\.css?v=[0-9a-f]*' dist/calculator.html`. Версия оболочки - `VERSION="…"` в
  `/sw.js` (совпадёт с локальным `dist/sw.js` только при той же статике; `changelog.js` в оболочке, поэтому новые
  новости сайта её тоже меняют).
- Глазами: `node .claude/skills/verify-and-ship/screenshots.mjs --url https://heart-of-the-zone.ru --pages <адрес>
  --out /tmp/hotz-live`. Единичный `HTTP 503` на картинку с GitHub Pages при параллельной загрузке бывает - повтори.
- В браузере у пользователей старая версия держится до обновления SW: новый `sw.js` браузер подхватит сам, иногда
  нужна вторая перезагрузка страницы.

## Подводные камни

- Не коммить `dist/` и скриншоты; не запускай `npm run build` / `build-changelog.js` без `--dry` ради проверки -
  они меняют отслеживаемые файлы.
- PR не проверяется CI: прогони раздел 1 сам и перечисли результаты в описании PR.
- Перед push в main - `git pull --rebase`: в main постоянно пишут боты (Топ-100 ежедневно ~03:00 МСК, новости сайта
  после деплоя).
- `dev.js`, `--serve` - долгоживущие процессы: запускай в фоне и останавливай.
- На сайте только дефис «-» (сборка меняет «—» сама), кавычки «ёлочки» - и в тегах коммитов тоже.

## Связанные скиллы

- **site-news** - теги коммитов и записи «Новостей сайта»; **site-dev** - сборка, CSP, PWA, новая страница;
- **guides** (картинки гайдов, PR формы), **seasonal-events** (`hotzHalloween`), **calculator**, **top100**,
  **factions**, **game-info**, **zone-news** - что проверять в своей области.
