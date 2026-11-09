---
name: top100
description: Топ-100 сайта «Сердце Зоны» - ежедневная выгрузка игроков из API игры (GitHub Actions, секрет ZONE_TOKEN), семь рейтингов, «Моё место», карточка игрока «Личное дело» (/p/<id>), сравнение игроков (/compare) и особые нашивки (awards.js). Бери, когда просят «рейтинг не обновился», «почему упала выгрузка», «запусти обновление топа», «выдай нашивку/награду игроку», «сделай новую награду», «добавь рейтинг», «неправильно считаются стрелки/места», «игрок просит убрать или поправить данные», а также при любых правках top100*.js, player-card, my-place, compare, fetch-players.js, build-top100.js.
---

# Топ-100, карточки игроков, сравнение, нашивки

## 1. Когда брать
- Выгрузка и её сбои, рейтинги, стрелки изменений мест, «Моё место», «Личное дело», /compare, нашивки игроков.
- Не сюда: карточки и рейтинг группировок, `factions-info.json`, `build-factions.js` - скилл **factions** (он читает `top100/clans*.json` и `top100-players.json`); пункт в «Новостях сайта» - **site-news**; тыквы и «Тыквенный сталкер» - **seasonal-events**; CSS/CSP/сборка вообще - **site-dev**; проверка и PR - **verify-and-ship**.

## 2. Файлы
Конвейер (Node, в `dist/` не попадают):
- `.github/workflows/top100.yml` - «Обновление Топ-100»: `fetch-players.js` -> `build-top100.js` -> коммит -> `gh workflow run pages.yml`.
- `fetch-players.js` - API `https://korzhik-studio.ru/api`: `/users/search` (все игроки), `/users/<id>/profile` (только с репутацией > 0 или уровнем > 1), `/clans/search`. Пишет `top100/heart-of-the-zone-top100-all.csv` (в `.gitignore`, в репозитории его нет), `top100/clans.json`, `top100/clans-history.json`.
- `build-top100.js` - CSV -> `top100-data.js`, снимок `top100/history/<снимок>.json`, дописывает новые группировки в `top100/factions.json`, в конце вызывает `build-players.js` (`buildPlayers`) -> `top100/players/<снимок>.json` и `top100-players.json`.
- `update-top100.bat` (выгрузка + сборка, спросит токен), `build-top100.bat` (только сборка) - ручной запуск владельцем на Windows.
- `test/build-top100.test.mjs` - тесты расчёта изменений.

Сайт:
- `top100.html` + `top100.js` (вкладки, периоды, фильтр отрядов, сортировка, `TAB_ICONS`), `top100-sort.css`.
- `top100-common.js` - `TOP100_TABS` и помощники `fmt`, `esc`, `escAttr`, `norm` (глобальные, см. `eslint.config.mjs`).
- `player-card.js/.css` - «Личное дело» (окно на /top100 и /factions), нашивки из `window.ZONE_AWARDS`.
- `zone-players.js/.css` - `window.ZonePlayers`: загрузка `top100-players.json`, поиск, подсказки, «я» (`getMe/setMe`), своя копия `TABS`.
- `my-place.js/.css` - «Моё место» на главной и на /top100, кнопки «Это я» / «Сравнить» в карточке.
- `compare.html/.js/.css` - сравнение двух игроков.
- `awards.js` + `assets/awards/*.svg` - нашивки; `404.html` - редирект `/p/<id>`.
- `build-previews.js` (при деплое) - страницы `dist/p/<id>.html` с OG-превью «Личное дело» для каждого игрока из `top100-players.json`.

## 3. Форматы данных (проверено по коду)
**Секрет и запуск.** `ZONE_TOKEN` - токен API игры (значение заголовка authorization без `Bearer`), живёт около суток, обновляет только владелец (Sof): HotZ Helper -> Настройки -> Данные -> Токен игры -> «Копировать» -> Settings -> Secrets and variables -> Actions -> `ZONE_TOKEN` -> Update. Запуск - cron-job.org в 02:55 МСК: POST `.../actions/workflows/top100.yml/dispatches` с `{"ref":"main"}` (fine-grained токен GitHub владельца). `schedule` в workflow нет. Значение токена агент не видит и не просит.

**CSV** (`;`, BOM, CRLF, по убыванию репутации): `№;ID;Ник;В Зоне;Группировка;Уровень;Репутация;Таланты;Убито боссов;Боссы: Альфа-пёс;…;Боссы: Упырь;Собрано коллекций;Завершено вылазок;Защищено лагерей;Собрано тайников;Нет сигнала`. «Нет сигнала» = «да», если не заходил больше `OFFLINE_DAYS` (5) дней. Группировка «-» = без группировки.

**Семь рейтингов** (`SOURCES` в `build-top100.js` + `TOP100_TABS`; порядок вкладок - как в `TOP100_TABS`, первая - вкладка по умолчанию):

| key | Вкладка | Колонка CSV | Поле профиля API | Массив | accent |
|---|---|---|---|---|---|
| reputation | Репутация (`sortLevel: true`) | Репутация | reputation | TOP100_REPUTATION | #f48fb1 |
| bosses | Боссы | Убито боссов | bosses | TOP100_BOSSES | #ff8a65 |
| stashes | Тайники | Собрано тайников | stashes | TOP100_STASHES | #26c6da |
| talents | Таланты | Таланты | talents | TOP100_TALENTS | #ffb74d |
| collections | Коллекции | Собрано коллекций | collections | TOP100_COLLECTIONS | #c9a6ff |
| expeditions | Вылазки | Завершено вылазок (`alt`: Завершено экспедиций) | explorations | TOP100_EXPEDITIONS | #9fdc9f |
| defense | Защита лагеря | Защищено лагерей | camp_defenses | TOP100_DEFENSE | #54bfff |

В раздел попадают значения > 0, по убыванию, при равенстве - порядок CSV; первые `TOP_N` (100, переменная окружения `TOP_N`).

**`top100-data.js`**: `TOP100_UPDATED="ДД.ММ.ГГГГ ЧЧ:ММ:СС"` (МСК); `TOP100_PERIODS=[{key, label, from, partial}]`, key из `last|d1|d7|d30` (`PERIODS`; период с той же базой, что у другого, выкидывается - обычно остаются d1, d7, d30); `TOP100_CHANGES={<период>:{delta:{<key>:{ник: прирост}}, rank:{<key>:{ник: число|null}}}}` (rank: + поднялся, - опустился, `null` - новичок; нули не пишутся); `TOP100_FACTIONS=[{name,color}]`; `TOP100_GROUPS={ник: группировка}`; `TOP100_HISTORY={id, from}` (id - версия для `?v=` у `top100-players.json`); `TOP100_<X>=[[ник, уровень, значение, давно_не_заходил 0|1], …]`, место = индекс + 1.

**`top100/history/ГГГГ-ММ-ДД_ЧЧ-ММ-СС.json`** (время МСК): `{"<key>": {"<ник>": [место, значение]}}` по 7 ключам; старые снимки - просто место числом, ещё старше - `ГГГГ-Wнн.json`. Если данные совпали с последним снимком - новый не пишется. Чистка: удаляются только снимки вне последних 50 (`KEEP_SNAPSHOTS`) и старше 40 дней (`KEEP_DAYS`); в git они остаются.

**`top100/players/<снимок>.json`**: `{"cols":["level", 7 ключей в порядке SOURCES, "b:<босс>"…], "p":{"<id>":[ник, группировка, off 0|1, уровень, …значения по cols]}}`, строка на игрока. Не чистится (~190 КБ в день). Нужен для карточек и чтобы узнать игрока после смены ника.

**`top100-players.json`**: `{updated, dates:[мс…], metrics:[ключи в порядке SOURCES], bosses:[имена], factions:{группировка: цвет}, players:{<id>:{n, g, z ("В Зоне"), off, l, v:[значения по metrics], b:[по bosses], r:[место среди ВСЕХ игроков или null], s:[[индекс_даты, уровень, …значения|null]], gh?:[[индекс_даты, группировка]], nh?:[[индекс_даты, старый_ник, новый_ник]]}}}`. Фронт ищет метрику через `metrics.indexOf(key)`.

**`top100/factions.json`**: `{"Группировка": "#rrggbb"}` - цвета, можно править руками; новым группировкам `pickColor` дописывает цвет сам.

**`awards.js`**:
```js
window.ZONE_AWARDS = {
  types: {
    "first-tester": { name: "Первый тестер", desc: "Одним из первых проверял сайт и помогал ловить баги",
      icon: "/assets/awards/first-tester.svg", color: "#e3b53c" }
  },
  players: { 3085: ["first-tester"], 746: ["first-tester"] }
};
```
`players`: ID игрока в игре -> массив id из `types` (порядок = порядок показа). Показываются только типы с `name` и `icon`; `desc` - необязательно (подсказка и вторая строка), `color` - необязательно (по умолчанию `#e3b53c`, это `--c` рамки и заголовка). Иконка - `<img>` 40×45; образец - `assets/awards/first-tester.svg` (щиток `viewBox="0 0 64 72"`, id внутри с префиксом). Нашивки видны только в «Личном деле» на /top100 и /factions (там подключён `awards.js`); на /compare, в «Моём месте» и в OG-превью их нет.

**Адреса и localStorage.**
- `/p/<id>` - ссылка «Поделиться» карточки; на сайте это `dist/p/<id>.html` (превью + `location.replace("/top100#p=<id>")`), для неизвестного id - `404.html` -> `/top100#p=<id>`. Открытая карточка переписывает адрес на `/p/<id>`. ID виден в шапке карточки как `№000746`.
- `/top100?metric=<key>&period=<last|d1|d7|d30>&faction=<группировка или ->&sort=<level|delta>`, `/top100#me` - к своей строке.
- `/compare?a=<id>&b=<id>`.
- `zoneMyPlayer` = `{"id":"746"|null,"n":"ник"}` (событие `zone:me`, синхронизация между вкладками); `gameHelperTop100Tab` - ключ вкладки; `gameHelperTop100Period` - ключ периода; `hotzHwFound` - тыквы (seasonal-events).

**Коммиты данных** - `Топ-100: обновление ДД.ММ.ГГГГ ЧЧ:ММ` (МСК). `build-changelog.js` берёт в «Новости сайта» только строки `new:/up:/upd:/update:/fix:`; в этих коммитах их нет, поэтому они пропускаются сами (`if (!items.length) continue`), `[skip news]` не нужен.

## 4. Сценарии
**«Рейтинг не обновился» / «упала выгрузка».**
1. `gh run list --workflow top100.yml -L 10`. Норма - `workflow_dispatch` около 23:55 UTC, 4-5 минут. Старые провалы с event `schedule` (до 25.10.2026) - история, не смотреть.
2. Запуска за ночь нет - не сработал cron-job.org (истёк его токен GitHub или задача выключена): попросить владельца проверить историю задачи (ожидается ответ 204).
3. Запуск упал: `gh run view <id>` (аннотации) и `gh run view <id> --log-failed | grep -E 'Ошибка|##\[error\]'`. Причины по тексту:
   - «Токен не указан» - секрет пуст/удалён; «Токен истёк <дата>» или «Сервер не принял токен (401/403)» - нужен свежий токен; «Это не похоже на токен» - в секрет вставили не то.
   - «Нет связи с сервером игры», «Ошибка 5xx/429 на …» - сбой API, повторить позже.
   - Упал шаг «Коммит данных» - конфликт `git pull --rebase` (кто-то правил файлы данных); «Деплой» - запустить `pages.yml` вручную.
4. Запуск зелёный, а сайт старый - смотреть `gh run list --workflow pages.yml -L 5`: деплой падает, если на main не проходят `npm test`, lint или `format:check`. Если в логе «Данные не изменились» - коммита и деплоя не было, это нормально.
5. Ответ владельцу: что упало и почему, что делать ему (обновить `ZONE_TOKEN`, токен должен жить хотя бы до 04:00 МСК), и как перезапустить: Actions -> «Обновление Топ-100» -> Run workflow, или `gh run rerun <id>` (секрет читается заново). Сам запускай `gh workflow run top100.yml --ref main` только по просьбе владельца и если есть право Actions: write.
   Предупреждение «Токен истекает … скоро нужен новый» есть в каждом запуске (порог 3 дня, токен живёт сутки); по нему видно, доживёт ли токен до следующих 02:55.

**Выдать нашивку.** Найди ID: `node -e 'const d=require("./top100-players.json");for(const[id,p]of Object.entries(d.players))if(p.n.toLowerCase().includes(process.argv[1].toLowerCase()))console.log(id,p.n,p.g)' "ник"`. Ник неоднозначен или игрока нет - спроси владельца (без карточки нашивку не увидят). Добавь в `players` `ID: ["тип"]` или допиши тип в массив. Проверь на `/top100#p=<id>`.

**Новая нашивка.** id типа - латиница через дефис; SVG в `assets/awards/<id>.svg` по образцу `first-tester.svg` (щиток 64×72, читается в 40×45, уникальный префикс id в `<defs>`); запись в `types`: `name` (коротко, с заглавной), `desc` (одно предложение без точки в конце), `icon: "/assets/awards/<id>.svg"`, `color`. Кому выдать - решает владелец.

**Добавить рейтинг.** Сначала подтверди поле в профиле API (`/users/<id>/profile`; сам API без токена не вызвать - спроси владельца). Затем:
1. `fetch-players.js`: колонка в `head` и значение в `cells` на ту же позицию.
2. `build-top100.js`: элемент в конец `SOURCES` (`column`, `varName`, `key`).
3. `top100-common.js` `TOP100_TABS`, `zone-players.js` `TABS`, `top100.js` `TAB_ICONS`; при желании `build-factions.js` `METRICS` (factions).
4. Тесты: колонку в `HEAD` и `row()`, ключ в `KEYS` в `test/build-top100.test.mjs`.
5. Тексты «семь рейтингов»: `rg -n -i 'семи|семь'` (top100.html, compare.html, index.html, my-place.js, tour.js, build-logo.js, README.md).
Старые снимки без нового ключа читаются (изменений просто не будет до второй выгрузки). Переименовать вкладку - только `label` (и копии); `key` не менять: на нём держатся снимки, ссылки и localStorage. Игра переименовала колонку - добавь старое имя в `alt`.

**Исправить расчёт изменений мест.** Логика - `build-top100.js`: `periodBase` (выбор снимка-базы, `SLACK`), `compareWith` (rank/delta), `prevEntry` (смена ника по ID и `normNick`), `sameData`. Сначала напиши падающий тест в `test/build-top100.test.mjs` через `setup(csvRows, snaps)` + `run(dir)`, снимки - `snapName(ms)`/`snapAll(...)`; потом чини. Отображение: `top100.js` (стрелки, `new`), `my-place.js` `lastPeriod`, `player-card.js` и `compare.js` считают изменения сами по `s` из `top100-players.json`. Готовые данные сайта поменяются только после следующей выгрузки.

**Игрок просит убрать или поправить данные.** Данные - из открытого API игры и перезаписываются каждую ночь; ручная правка `top100-data.js`/`top100-players.json` пропадёт и может сломать коммит в 03:00. Механизма скрыть игрока нет: это новая фича (фильтр по ID в `build-top100.js`/`build-players.js`), а прошлые снимки останутся в git. Не делай без решения владельца. Нашивки и цвета группировок (`factions.json`) правятся руками.

## 5. Подводные камни
- Не запускай `fetch-players.js`, `build-top100.js`, `*.bat`: нужен токен, они пишут отслеживаемые файлы. CSV локально нет, поэтому на реальных данных build-top100 не прогнать - только тестами.
- Сгенерированные файлы (`top100-data.js`, `top100-players.json`, `top100/history`, `top100/players`, `top100/clans*.json`) руками не правь.
- Пропущенный профиль (`пропущен <id>` в логе) выпадает из выгрузки этого дня и назавтра будет «новичком».
- Снимки рейтинга хранят игроков по нику; смену ника ловит `prevEntry` через ID из `top100/players`.
- `build-previews.js` разбирает `TOP100_TABS` регуляркой: в элементе `key` сразу перед `label`, `accent` внутри того же `{…}`, иначе сборка падает.
- `build.js` пререндерит /top100, прогоняя скрипты страницы в заглушке DOM (`runPageScripts`): код верхнего уровня `top100.js`/`top100-common.js` не должен трогать браузерные API без проверок; `player-card.js`, `zone-players.js` выходят сами при отсутствии `fetch`.
- `TABS` в `zone-players.js` и `METRICS` в `build-factions.js` - копии `TOP100_TABS`: меняй вместе.
- `awards.js` проверяют ESLint и Prettier; данные Топ-100 - нет (`.prettierignore`, `eslint.config.mjs`).
- Текст: русский, «ёлочки», только дефис «-».

## 6. Проверка
- `node --test test/build-top100.test.mjs` - безопасно (временные папки). Остальное (`npm test`, lint, format:check, сборка, скриншоты) - по **verify-and-ship**.
- Глазами (`node dev.js` или `npx serve dist`): `/top100` - вкладки, стрелки и `new`, кнопки периодов; `/p/746` (в dev через `404.html` -> `/top100#p=746`) - нашивка «Первый тестер»; `/compare?a=746&b=3085`; главная - «Моё место» после «Это я».
- Выгрузка: `gh run list --workflow top100.yml`, после - `gh run list --workflow pages.yml`.

## 7. Связанные скиллы
factions, site-news, seasonal-events, site-dev, verify-and-ship.
