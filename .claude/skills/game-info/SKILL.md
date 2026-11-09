---
name: game-info
description: Справочник «Информация» (/info, /info-tasks, /info-bosses) - таблицы уровней (таланты, опыт ПДА и персонажа, мастерство в картах «21»), задания по локациям с калькулятором энергии и карточки боссов, включая ивентового. Бери, когда пользователь пишет «добавь босса», «новый ивентовый босс», «поменялись награды за задания», «добавили уровни ПДА/персонажа», «расширь таблицу талантов», «добавь вкладку прогресса как «Карты «21»»», «вышло обновление игры» (часть про справочник) или присылает скриншоты/таблицы с цифрами из игры.
---

# Справочник «Информация»

## Когда использовать
- Цифры игры в справочнике: уровни, задания, боссы, ивентовый босс, новая вкладка «Прогресса по уровням».
- Не сюда: новость об обновлении на главной - `zone-news`; пункт в «Новостях сайта» - `site-news`; снаряжение/таланты
  в калькуляторе урона (`src/gear-data.js`, `talents.js`) - `calculator`; имена боссов в выгрузке Топ-100 - `top100`;
  праздничное оформление - `seasonal-events`; новая страница, CSP, сборка - `site-dev`; проверка и PR - `verify-and-ship`.

## Файлы
- `info.html` - одна страница на три раздела: кнопки `#infoSections [data-section=levels|tasks|bosses]`, панели
  `[data-section-panel]`, контейнеры `#infoTabs`, `#infoGroups`, `#infoProgress`, `#tasksRoot`, `#bossesRoot`.
  Порядок скриптов: `ui.js, info-data.js, info.js, tasks-data.js, info-tasks.js, info-bosses.js, nav.js`.
- `info-data.js` - `window.TALENT_LEVELS`, `PDA_LEVELS`, `PDA_LEVEL_NOTES`, `CHAR_LEVELS`, `T21_LEVELS`.
- `info.js` - «Прогресс по уровням»: `INFO_TABS`, `infoGroupsData()`, вид «График» (`chartMarkup`, `chartCardsMarkup`,
  `planMarkup`) и «Таблицы» (`renderInfo()` ветка `table`, `infoTableMarkup`), прогресс из калькулятора (`readCalcProgress`).
- `tasks-data.js` - `window.TASKS_DATA`; `info-tasks.js` - карточки локаций, этапы, калькулятор энергии И переключатель
  разделов (`SECTIONS`, `secFromPath`, `setSection`); `info-tasks.css` - стили заданий и боссов.
- `info-bosses.js` - `CARDS`, `BOSSES`, `EVENT` (+ `EVENT_FROM`, `EVENT_END`, `EVENT_SPAWNS_MSK`), `RES`, `EXTRA`.
- `assets/bosses/` - видео/постеры боссов, картинки комплектов, иконки наград. `assets/loc-<ключ>.webp` - картинки локаций.
  Иконки ресурсов (общие для заданий и боссов): `assets/xp.webp`, `common_currency-BGqetmZE.webp` (пули),
  `reputation-DqOMMtrl.webp`, `energy-5drpfC6V.webp`, `rare_currency-D0tYVDkc.webp` (жетоны), `energy-drink.webp`.
- `styles.css` - стили блоков уровней (`.info-group-<ключ>`, `.info-groups[data-active=…]`); `info-tasks.css` - остальное.
- `build.js`: пререндер `"info.html"` (кладёт разметку разделов с метками `<!--sec:…-->`), `INFO_SECTIONS` (пишет
  `dist/info-tasks.html` и `dist/info-bosses.html` со своими title/description/h1/canonical), `homeLive()` (счётчик
  боссов на главной), `SHELL_PAGES` и прекэш всех `assets/bosses/*.webp` в `sw.js`.
- Ещё ссылаются: `nav.js` (пункт меню ведёт в последний открытый раздел, `localStorage.gameHelperInfoSection`),
  `tour.js` (шаги `g: "info"`, функция `infoView`), `sitemap.xml`, `fetch-players.js` (`BOSSES` - имена боссов из API игры).
- Калькулятор, превью и Топ-100 данные справочника НЕ читают; связи только логические (см. «Подводные камни»).

## Адреса
- `/info` - уровни, `/info-tasks` - задания, `/info-bosses` - боссы. Это одна страница: клик по разделу делает
  `history.pushState` на адрес раздела; при сборке из `info.html` получаются три файла, в каждом HTML только свой раздел.
- Вкладки уровней по якорю: `/info#talents`, `#pda`, `#char`, `#t21` (якорь важнее `localStorage.gameHelperInfoTab`).
- h1/title раздела заданы дважды и должны совпадать: `SECTIONS` в `info-tasks.js` и `INFO_SECTIONS` в `build.js`
  (сборка падает, если h1 не нашёлся).

## Формат данных

### info-data.js (вне Prettier и ESLint: `.prettierignore`, `ignores` в `eslint.config.mjs`)
Каждая таблица - ОДНА строка без пробелов: `window.X=[[уровень,шаг,итого],...];`. Не переформатировать.
- Инварианты (код берёт строку как `rows[lvl-1]`, максимум - последняя строка):
  `row[0] === индекс+1` (уровни подряд с 1), `итого[i] = итого[i-1] + шаг[i]`, у первой строки `итого = шаг`.
- `TALENT_LEVELS` (135 строк, `[1,7000,7000]`): уровень = номер вложенного очка таланта, шаг = урон; шаг `7000 + 1500·(n-1)`.
  135 = 27 талантов × 5 рангов калькулятора - «получено» считается суммой рангов из `localStorage.gameHelperState.talents`.
- `PDA_LEVELS` (50, `[1,0,0]`): шаг с 2-го уровня `45 + 5·(n-2)`. `PDA_LEVEL_NOTES` - строки под блоком ПДА; цвет по
  тексту в `infoNoteColor` («ветерана» - оранжевый, «учёного» - бирюзовый, иначе зелёный).
- `CHAR_LEVELS` (50, `[1,0,0]`): шаг `25n² + 50n + 125` (325, 500, 725…). Уровень из калькулятора обрезается до длины таблицы.
- `T21_LEVELS` (50, `[1,0,0]`): шаг `30 + 3·(n-2)`, 50 - последний уровень (комментарий в файле).
- Формулы выведены по текущим данным; новые строки бери из игры, а не экстраполируй без согласия владельца.

### tasks-data.js (вне Prettier и ESLint, одна строка JSON после `window.TASKS_DATA=`)
```
{"locations":[5 строк],                      // кавычки "…" в названии сами станут «…»
 "stages":[{"n":1,"exp":[..5],"bullets":[..5],"rep":[..5],"energy":[..5],"reps":[..5]}, ... 7 этапов],
 "reward":{"exp":[..5],"bullets":[..5],"rep":[..5],"tokens":[..5]},   // награда за всю локацию
 "total":{"exp":[..5],"bullets":[..5],"rep":[..5],"energy":[..5]}}
```
- Каждый массив - по локациям в порядке `locations`. `stages[].exp/bullets/rep/energy` - за ОДНО задание, `reps` -
  сколько раз его выполнить (квадратики в игре).
- `total[k][i] = Σ stage[k][i]·reps[i] + reward[k][i]` (у `energy` награды нет). `total` хранится, а не считается -
  пересчитай вручную. Жетонов в `total` нет: «итого жетонов» = `reward.tokens`.
- Выгода, ранги, «лучшая», число заданий, калькулятор энергии (`energyYield`) считаются в `info-tasks.js`.
  Константы энергетика: `DRINK_ENERGY = 100`, `DRINK_PRICE = 15` (жетонов).
- Привязано к 5 локациям и 7 этапам: `LOC_IMG` в `info-tasks.js` (`["outskirts","swamps","dump","north","bar"]` ->
  `assets/loc-<ключ>.webp`, 480×420), `.ec-locs { repeat(5, …) }` и `.tl-stage-list { repeat(8, …) }` (7 этапов + «Награда»)
  в `info-tasks.css`. Новая локация/этап - правь и их.

### info-bosses.js (обычный код, Prettier форматирует)
Обычный босс в `BOSSES` (порядок = цепочка, номер на карточке = индекс + 1):
```js
{
  key: "alpha",            // имя файлов assets/bosses/<key>.webp|.mp4|.webm, data-boss
  name: "Альфа-пёс",
  hp: 10000,
  req: "green",            // цвет ключа из CARDS или null («Нет - бой доступен сразу»)
  reward: { card: "blue", exp: 30, bullets: 100, tokens: 3, rep: 15 },
  set: { name: "Марафонец", img: "marathon", items: ["Олимпийка", "Спортивные штаны"] }   // или null
},
```
- `reward.card` обязателен (ключ из `CARDS`: `green, blue, purple, orange, red, cyan`; новый цвет - добавь в `CARDS`
  `{ color, one: "Xый ключ", many: "xых ключа" }`). `exp/bullets/tokens/rep` - необязательны, нулевые/отсутствующие
  не выводятся (у «Болотной твари» и дальше нет `tokens`).
- `req` должен равняться `reward.card` ПРЕДЫДУЩЕГО босса: текст берёт `BOSSES[i - 1].name`, число «3» зашито в разметке.
- `set.items[j]` -> картинка `assets/bosses/<img>-<j+1>.webp` (236×236, порядок = порядок items). Сетка `.boss-items` -
  3 колонки. `set: null` выводит «Комплект с этого босса не выпадает» - не используй для «неизвестно».
- `homeLive()` в `build.js` считает боссов регуляркой `/^ {6}key: "/gm` - ключ обычного босса должен стоять на отдельной
  строке с отступом 6 пробелов (так его ставит Prettier). `EVENT` (отступ 4) не считается.

Ивентовый босс - ОДИН объект `EVENT` (не массив):
```js
const EVENT_FROM = Date.UTC(2026, 9, 23);              // месяцы с 0: 9 = октябрь; 00:00 UTC
const EVENT_END = Date.UTC(2026, 10, 5, 24 - MSK);     // 6 ноября 00:00 МСК (последний день - 5-е)
const EVENT_SPAWNS_MSK = [5, 18];                      // часы появления по МСК
const EVENT = { key: "experiment", name: "Эксперимент №31", hp: 500000,
  set: { name: "Пятничный вечер", img: "friday", items: [...] },
  rewards: [ { place: "1", exp: 750, tokens: 10, pda: 5, key: "orange", keyCount: 3, extra: "gauss", extraCount: 5, set: 100 }, ... ] };
```
- `rewards[]`: `place` (строка; "1"/"2"/"3" рисуются медалью), `exp`, `tokens`, `set` (шанс комплекта, %) - обязательны;
  `pda` (взломы ПДА), `key`+`keyCount`, `extra`+`extraCount` (ключ из `EXTRA`: `gauss`, `ubgl`, `grenade`) - необязательны,
  без них в ячейке прочерк. Новый тип «Доп.» - добавь в `EXTRA` и иконку `assets/bosses/<имя>.webp`.
- Расписание, подписи дат и обратный отсчёт считаются только из трёх констант. После `EVENT_END` карточка
  сворачивается в `<details>` «событие завершено», видео не грузится.
- Зашито в тексте под конкретное событие: значок «Хэллоуин · временный» с `assets/halloween/pumpkin-artifact.webp`
  (`eventCard`), «Хэллоуинского события» (подпись под сеткой), «Пятничный вечер» (`boss-reward-note` в `rewardTable`),
  правила боя (`eventBody`).

### Медиа боссов (`assets/bosses/`)
- Обычный босс: `<key>.webp` постер 512×320, `<key>.mp4` (H.264) и `<key>.webm` (VP9) 512×320, без звука, короткий цикл
  (сейчас 1-18 с). В разметке `muted loop playsinline preload="none"`, играет только видимое видео.
- Ивентовый: только `<key>.webm` 1856×800 + постер `<key>.webp` 928×400 (тот же 2,32:1).
- Картинки комплекта 236×236 (у `friday-*` 512×512 - тоже работает, пропорция 1:1). Иконки наград - webp.
- Все `assets/bosses/*.webp` попадают в офлайн-кэш автоматически (видео - нет).

## Откуда данные
- Источник цифр не автоматизирован: их даёт владелец (Sof) - скриншоты игры, его таблицы (в истории `tasks-data.js`
  упомянуты «задания.xlsx» и «Новая таблица.xlsx»), посты группы ВКонтакте (ивентовый босс пришёл из новости обновления).
  API игры используется только для Топ-100 (`fetch-players.js`), справочник из него не берётся.
- Данных нет или неполные: не придумывай и не экстраполируй. Добавь только подтверждённое (необязательные поля -
  просто опусти), про остальное спроси владельца; обязательное поле без значения - не публикуй запись, спроси.

## Сценарии

### Новые уровни / изменились цифры уровней
1. Допиши строки в нужную таблицу `info-data.js`, не ломая одну строку; соблюдай инварианты, проверь командой ниже.
2. Если поменялся максимум - поправь комментарий над таблицей (у `T21_LEVELS`) и тексты с числом уровней
   (`site-news`, `tour.js`, если там упомянуто). Таланты: длина `TALENT_LEVELS` = число талантов × 5 - если в калькуляторе
   добавили таланты, таблицу нужно расширить (данные - от владельца).

### Новая вкладка прогресса (образец - коммит `9f4c99d` «Добавить прогресс мастерства в картах «21»»)
1. `info-data.js`: `window.NEW_LEVELS=[...]` одной строкой; `eslint.config.mjs`: имя в `globals` блока `files: ["info.js"]`.
2. `info.js`: пункт в `INFO_TABS` (`key`, `label`, `accent`), объект в `infoGroupsData()` (`title`, `color`, `rows`,
   `reached`, `step`, `need`, `gen`), блок `infoGroupMarkup(...)` в ветке `table` `renderInfo()` (заголовки колонок).
   Если уровня нет в калькуляторе - ключ в `PLAN_FROM_KEYS` (`gameHelperInfo<Name>From`) и `reached: readPlanFrom(...)`.
3. `styles.css`: `.info-group-<key>` (рамка/фон рядом с `.info-group-t21` и `--grp` во втором месте),
   `.info-groups[data-active="<key>"] [data-info-group="<key>"]` в медиа-блоке телефона и
   `.info-groups[data-view="chart"][data-active="<key>"] …`; при 5+ вкладках проверь `#infoTabs[data-view]` (≤460px сетка 2×2).
4. Цвет повторяется в `INFO_TABS`, `infoGroupsData`, ветке `table` и `styles.css` - держи одинаковым.
5. Тексты: `.info-lead` в `info.html`, комментарий про якоря в `info.js`, шаги тура в `tour.js`, при желании
   `meta description`, `README.md` (раздел «Информация»).

### Новый обычный босс
1. Медиа в `assets/bosses/`: `<key>.webp`, `.mp4`, `.webm`, картинки комплекта `<img>-1..N.webp`.
2. Объект в `BOSSES` в нужное место цепочки (`req` = `reward.card` предыдущего), при новом цвете - `CARDS`.
3. Связанное: `BOSSES` в `fetch-players.js` (точные имена из API; скилл `top100`), комплект вещей в калькуляторе
   (`src/gear-data.js`; скилл `calculator`), при необходимости `README.md`. Счётчик на главной обновится сам.

### Новый ивентовый босс (история «Эксперимента №31»: `2ae7cf3` добавил, `78ad5bc` поменял HP/награды, `a16ae31` -
дата конца, `5321131` - вид «завершено»)
1. Спроси владельца, оставлять ли старую карточку. Сейчас поддерживается только один `EVENT`: замени его поля и
   `EVENT_FROM/EVENT_END/EVENT_SPAWNS_MSK`; два события сразу потребуют переделки кода (согласуй).
2. Обнови зашитые тексты (значок события, подпись под сеткой, `boss-reward-note`, правила), медиа `<key>.webm` + `.webp`.
3. `tour.js`: шаг «Боссы» (`sel: "#bossesRoot .boss-event"`, текст называет «Эксперимент №31» и «Пятничный вечер»).
4. Новость об ивенте на главной - `zone-news` (там тоже есть HP и награды - цифры должны совпадать); оформление праздника - `seasonal-events`.

### Изменились награды/затраты заданий
1. Поправь массивы в `tasks-data.js` (одна строка), пересчитай `total`, проверь командой ниже.
2. Новая локация: добавь значение во ВСЕ массивы, ключ в `LOC_IMG`, `assets/loc-<ключ>.webp` 480×420, сетку `.ec-locs`.

Обычно к изменению игры прилагается новость на главной (`zone-news`), а к изменению сайта - пункт в «Новостях сайта»
(`site-news`: запись в `site-news.json`).

## Подводные камни
- `info-data.js`/`tasks-data.js` не трогает Prettier: лишние пробелы/переносы останутся как есть - пиши в стиле файла.
- Скрипты страницы выполняются при сборке в заглушке DOM (`fakeDom` в `build.js`): не обращайся к `window.location`,
  `matchMedia`, `IntersectionObserver` и т. п. без проверки `typeof`; пустой рендер `#tasksRoot`/`#bossesRoot` валит сборку.
  `EVENT_ENDED` в готовом HTML - на момент сборки, в браузере пересчитывается.
- Время событий - МСК (UTC+3), даты через `Date.UTC` с месяцами от 0.
- Текст: русский, «ёлочки», только дефис «-». В данных боссов есть «4–10» (короткое тире) - сборка его НЕ заменяет
  (меняет только длинное), в новых строках пиши дефис. Числа выводятся через `toLocaleString("ru-RU")` - пиши в данных
  без разделителей.
- Не меняй ключи `localStorage` (`gameHelperInfoTab`, `gameHelperInfoView`, `gameHelperInfoPdaFrom`,
  `gameHelperInfoT21From`, `gameHelperInfoSection`, `gameHelperTasksLoc`, `gameHelperEnergyCalc`) - сохранённое у игроков пропадёт.
- Сетки рассчитаны на текущие количества: боссы - 3 колонки (7-й босс встанет один в ряду), предметы комплекта - 3,
  локации калькулятора - 5, этапы - 7+1.

## Проверка
Инварианты (только чтение, из корня репозитория):
```sh
node -e 'global.window={};require("./info-data.js");for(const n of ["TALENT_LEVELS","PDA_LEVELS","CHAR_LEVELS","T21_LEVELS"]){const a=window[n];const bad=a.filter((r,i)=>r[0]!==i+1||r[2]!==(i?a[i-1][2]:0)+r[1]);console.log(n,a.length,bad.length?"ОШИБКИ "+JSON.stringify(bad.slice(0,3)):"ok")}'
node -e 'global.window={};require("./tasks-data.js");const D=window.TASKS_DATA,N=D.locations.length;const len=[...D.stages.flatMap(s=>["exp","bullets","rep","energy","reps"].map(k=>s[k])),...Object.values(D.reward),...Object.values(D.total)].every(a=>a.length===N);console.log("длины",len?"ok":"ОШИБКА");for(const k of ["exp","bullets","rep","energy"]){const c=D.locations.map((_,i)=>D.stages.reduce((a,s)=>a+s[k][i]*s.reps[i],0)+(D.reward[k]?D.reward[k][i]:0));console.log(k,JSON.stringify(c)===JSON.stringify(D.total[k])?"ok":"ОШИБКА "+JSON.stringify(c))}'
grep -c '^ \{6\}key: "' info-bosses.js   # число обычных боссов = что покажет главная
```
Тестов на справочник нет; общие `npm test`, `npm run lint`, `npm run format:check`, сборка - по `verify-and-ship`.
Глазами (сборка + локальный сервер): `/info` в видах «График» и «Таблицы», `/info#<вкладка>`, телефон ≤460px;
`/info-tasks` - карточки, открытие этапов, калькулятор энергии; `/info-bosses` - видео играет, картинки комплекта,
ключи цепочки, карточка ивента (до и после `EVENT_END`); `dist/info-bosses.html` содержит только раздел боссов; плашка
«Информация» на главной (`#hcInfo`) показывает верное число боссов.

## Связанные скиллы
`zone-news`, `site-news`, `calculator`, `top100`, `seasonal-events`, `site-dev`, `verify-and-ship`.
