---
name: calculator
description: Калькулятор урона /calculator и страница /build («Смотри мой билд») - снаряжение и комплекты (src/gear-data.js), таланты (talents.js), арена и базовый урон (src/arena-data.js), формулы (src/calc-core.js + тесты), ссылка на билд и её обратная совместимость, окна талантов/жетонов/сравнения, «Мои билды». Бери, когда пользователь пишет «вышел новый комплект», «добавь вещь», «поменяли баланс/коэффициент арены/базовый урон», «новый талант», «новое оружие», «калькулятор неправильно считает», «старая ссылка на билд не открывается», «добавь окно в калькулятор».
---

# Калькулятор урона

## Когда использовать
- Всё, что меняет числа урона, данные вещей/талантов/арены, ссылку на билд, окна калькулятора, «Мои билды», сводку `#calcDock`, превью `/build`.
- Не сюда: стоимость прокачки талантов и опыт уровней (`info-data.js`, `info.js`) - **game-info**; общая сборка, CSP, CSS-очистка, PWA - **site-dev**; запись в «Новости сайта» о новом комплекте - **site-news**; новость игры об обновлении - **zone-news**; тесты/линт/скриншоты/PR - **verify-and-ship**.

## Файлы
- `src/arena-data.js` - константы баланса: `ARENA_COEF_PERCENT`, `BASE_DAMAGE_LEVEL0`, `BASE_CRIT_DAMAGE`.
- `src/gear-data.js` - `SETS` (комплекты с вещами) и `ITEMS` (вещи без комплекта). Иконки - `assets/equipment/<code>.webp`.
- `talents.js` - `TALENTS` (массив массивов). Картинки талантов - `assets/TALENT_XXXX-<хэш>.webp`, привязка в `TALENT_ASSETS` в `src/calc-talents.js`.
- `src/calc-core.js` - ядро без DOM: `ALL_ITEMS`, `ITEM_BY_CODE`, `clampLevel`, `clampArena`, `arenaBonus`, `freeBase`, `baseDamageByLevel`, `sanitizeTalents`, `gearToMask`/`gearFromMask`, `buildHashOf`, `parseBuild`, `DAMAGE_KEYS`, `talentTotals`, `buildTotals`, `buildResults`, `firstFreeHitDamage`. Тесты - `test/calc-core.test.mjs`.
- `app.js` - состояние (`state`), отрисовка карточек (`CARDS`, `BD_PARTS`), окно «Снаряжение и бонусы» (`renderEquipment`, `equipmentCard`, `gearSets`), `calc()`, ссылка (`shareBuild`), `ctx` и `lazyPart` для кусков, сводка `#calcDock`, `applyBuild`.
- `src/calc-talents.js`, `src/calc-tokens.js`, `src/calc-compare.js` - окна «Древо талантов», «Расчёт по жетонам»/«Мой арсенал», «Сравнение билдов»; ленивые куски (`export function setup(c)`).
- `src/calc-slots.js` - «Мои билды» (импортирует из `app.js`, входит в основной `calculator.js`).
- `src/calculator.js` - точка входа esbuild (`app.js` + `calc-slots.js`).
- `calculator.html` (разметка, окна, `#calcDock`), `calculator.css` (все стили калькулятора, иконки оружия `.weapon-<icon>`).
- `build.js`: `MODULES["calculator.js"]` (исходники бандла, по ним дата в sitemap), `LAZY_JS["calculator.js"]` (куски для CSS-очистки), сборка esbuild с `chunkNames: "calc/[name]-[hash]"`, блок `BUILD_OG` - `dist/build.html` = копия `calculator.html` со своими og/title/description и `noindex`. Картинка `assets/preview-build.jpg` готовая, `build-logo.js` её не рисует.
- Чужие читатели: `home-live.js` и `info.js` читают `localStorage.gameHelperState` (поля `gear`, `level`, `talents`, `arena`); `tour.js` опирается на `#openEquipment`, `#openTalents`, `#shareBuild`, `#openCompare`, `[data-tok-tab]`.

## Модель расчёта (src/calc-core.js)
Оружие (`DAMAGE_KEYS`): `knife`, `pistol`, `auto` - бесплатные удары; `grenade`, `gl` (подствольник), `gauss` - за жетоны. В данных игры автомат = `rifle`, подствольник = `ubgl` (маппинг в `talentTotals`, иконки `ARENA_ICON`/`CARDS`).
- Уровень: целое 1-100 (`clampLevel`). База: `freeBase(b0, L) = Math.round(b0 * 1.02 ** L)`, `b0` = `BASE_DAMAGE_LEVEL0[k]`.
- Арена: `arenaBonus(p) = floor(BASE_DAMAGE_LEVEL0[k] * p * ARENA_COEF_PERCENT / 100)` по каждому оружию (от урона 0 уровня, без верхнего предела очков). Ключи в `arenaBonus` перечислены вручную.
- Снаряжение: суммируются только `bonuses`/`extras` **вещей** (`buildTotals`). `bonuses`/`extras` у самого комплекта нигде в коде не читаются - это справочная сумма его вещей; бонуса «за полный комплект» сверх вещей нет.
- Таланты (`talentTotals`): плоские прибавки к урону, крит-урону, проценты шанса крита/отката/первого удара.
- Итог (`buildResults`): `урон[k] = база(L) + снаряжение + арена + таланты`. Под числом (`BD_PARTS`): база 0 ур., прибавка уровня, снаряжение, арена, таланты - в сумме ровно итог (это проверяет тест).
- Крит только у жетонного оружия: шанс `critGrenade = critChance + critGrenadeChance`, `critGl = critChance`, `critGauss = critChance + critGaussChance`; урон крита - плоская прибавка к удару: `BASE_CRIT_DAMAGE[k] + critDamage + крит-урон этого оружия (вещи + таланты)`.
- Жетоны (`src/calc-tokens.js`): цены `TOKEN_PRICES = { grenade: 3, gl: 5, gauss: 15 }`, средний удар `dmg + min(1, шанс) * прибавка`.
- Первый бесплатный удар: `firstFreeHitDamage = урон * (1 + firstFreeHit)` (талант «Засада»).

## Формат данных

### Комплект и вещь (src/gear-data.js)
```js
{ code: "SET_012", name: "Комплект «Пятничный вечер»", isNew: true,
  bonuses: { grenade: 18, gl: 33, gauss: 108 }, extras: {},
  items: [ { code: "HEAD_011", name: "Хоккейная маска", slot: "head", rarity: "rare",
             icon: "/assets/equipment/HEAD_011.webp", bonuses: { grenade: 6, gl: 11, gauss: 36 }, extras: {} } ] }
```
- Комплект: `code` (`SET_NNN`, уникален), `name` (с «Комплект «…»»), `isNew` (необязательно), `bonuses` = сумма `bonuses` вещей, `extras` = сумма `extras` вещей, `items` (1-3 вещи; карточка рисует пустые клетки до 3).
- Вещь (обязательны все поля, `extras: {}` даже пустой - код читает `item.extras[k]` без проверки):
  - `code` - код игры `HEAD_NNN` / `JACKET_NNN` / `PANTS_NNN` / `WEAPON_NNN`, уникален во всех `SETS` и `ITEMS`;
  - `slot`: `"head" | "jacket" | "pants" | "weapon"` (оружие - в конце `ITEMS`, в окне своей карточкой «Оружие» через `WEAPON_ITEMS` в `app.js`); `rarity`: `"common" | "uncommon" | "rare"` (на вид сейчас не влияет);
  - `icon`: `"/assets/equipment/<code>.webp"`, файл webp 128×128 (рисуется 58×58); у оружия - 256×128, обрезанный по рисунку (рисуется 116×58, правило `.eq-card[data-eq-card="weapons"]` в `calculator.css`);
  - `bonuses`: только ключи `knife, pistol, auto, grenade, gl, gauss` - целые плоские прибавки;
  - `extras`: только `critChance, critDamage, critGaussChance, critGrenadeChance, critGaussDamage, critGrenadeDamage, freeNoCooldown, cooldown`. Проценты - долей (`0.01` = 1%), урон крита - целым. Новый ключ сам не посчитается: нужно добавить его в `ex` в `buildTotals` и `buildResults`, в `GEAR_BONUS_LABELS`, `EQ_BONUS_LABELS`, `GEAR_EXTRA`, `gearExtras()` (+ `GEAR_BONUS_PCT` для процента) в `app.js`.
- Названия вещей пишутся как в игре (внутри - прямые кавычки `'Шлем "Рубеж-М"'`, так в данных).

### Таланты (talents.js)
`[code, branch, name, desc, row, col, values[5], stat, target, requires]`, пример:
`["TALENT_0015","paid_hits","Точный бросок","…",2,1,[2,4,6,8,10],"paid_hit_damage_flat",["grenade"],["TALENT_0012"]]`
- `branch`: `"free_hits"` («Боевая подготовка») или `"paid_hits"` («Арсенал») - других веток окно не покажет.
- `row` (t[4]) - ряд дерева сверху вниз; внутри ряда порядок = порядок в массиве; `col` (t[5]) кодом не читается.
- `values` - 5 значений по рангам (ранг 1-5).
- `stat` - только: `free_boss_damage_flat` (нож+пистолет+автомат), `free_hit_damage_flat`, `paid_hit_damage_flat`, `paid_hit_crit_damage_flat`, `paid_hit_crit_chance_pct`, `first_free_hit_damage_bonus_pct`, `free_hit_cooldown_reduction_pct`, `free_hit_cooldown_dodge_chance_pct`. `_pct` - в процентах (`6` = 6%). Новый stat требует кода в `talentTotals` и подписи в `TALENT_STAT_LABELS` (`src/calc-talents.js`).
- `target`: `null` или `["knife"|"pistol"|"rifle"|"grenade"|"ubgl"|"gauss"]` (берётся только первый); для крит-урона - `grenade|ubgl|gauss`.
- `requires` - коды талантов, которые должны быть 5/5.

### Ссылка на билд (критично)
`buildHashOf` -> `l=<1-100>&g=<маска base36>&a=<очки арены>&t=<цифра ранга на каждый талант>`; кнопка копирует `location.origin + "/build#" + hash`.
- `g`: бит `i` = `ALL_ITEMS[i]`, где `ALL_ITEMS = [...SETS.flatMap(s => s.items), ...ITEMS]`. Индекс = позиция в этом списке.
- `t`: позиционно по порядку `TALENTS`; недостающие цифры = 0.
- Старый формат (если нет `g`): `s` - десятичная маска индексов `SETS` (весь комплект), `i` - маска по `LEGACY_STANDALONE = ["JACKET_003","JACKET_008","JACKET_009","JACKET_011"]`. Не меняй `LEGACY_STANDALONE` и порядок первых 10 комплектов (тест: `s=1023` -> 26 вещей).
- Та же строка хранится в `localStorage.zoneBuildSlots` (слоты) и `gameHelperCompare` (сравнение) - сломанный порядок бьёт и по сохранённым билдам, не только по ссылкам.
- Ссылка `/build#…` или `/calculator#…` открывает билд **в окне сравнения** (`linked` -> `compareUI`), свой билд не трогает, адрес заменяется на `/calculator`.

Что ломает старые ссылки и слоты:
- **Добавление новой вещи или комплекта в `SETS`** сдвигает индексы всех `ITEMS` (сейчас биты 32-35) - старые `g` с одиночными вещами покажут другие вещи. Вставка/перестановка/удаление вещей в комплектах сдвигает всё после них.
- Вставка таланта не в конец `TALENTS` или перестановка - сдвиг рангов в `t`.
- Изменение `code` вещи - пропадёт из `gameHelperState` (там коды).
- Маска - обычное число через `2 ** i`: после 53 вещей потеряет точность.

## Сценарии

### Новый комплект/вещь из обновления игры
1. Возьми у пользователя (или из ответа API игры) коды, названия, слоты, редкость и бонусы каждой вещи. Не угадывай числа.
2. Сохрани обратную совместимость `g`: сейчас порядок битов = порядок `ALL_ITEMS`, поэтому новый комплект в конце `SETS` сдвинет `ITEMS`. Перед добавлением введи в `src/calc-core.js` явный неизменяемый порядок битов (например, массив кодов = текущий порядок 36 вещей, новые коды - только в конец) и используй его в `gearToMask`/`gearFromMask` вместо `ALL_ITEMS`; добавь тест: зафиксированная строка `g` со старыми одиночными вещами (например, `gearToMask(["JACKET_003","JACKET_011"])` до правки) читается в те же коды. Если порядок уже явный - просто допиши новые коды в конец.
3. Добавь комплект в конец `SETS` (или вещь в `ITEMS`) по схеме выше, `bonuses`/`extras` комплекта = сумма вещей. Обнови комментарий-шапку с датой выгрузки.
4. `isNew: true` - ровно у одного комплекта: сними его со старого. `gearSets()` показывает первым только первый `isNew`, а второй с `isNew` пропадёт из окна совсем.
5. Положи иконки `assets/equipment/<code>.webp` (128×128).
6. Тесты: `ALL_ITEMS.length` в тесте «новый ивентовый комплект…» и, если нужно, этот тест под новый `SET_NNN`; эталон «100 уровень, всё снаряжение…» в `GOLDEN` пересчитай и сверь с игрой - это законная правка данных, напиши об этом в PR.
7. Тексты: в `README.md` и `DEVELOPMENT.md` упомянуты «12 комплектов», `SET_012` и «Пятничный вечер» - обнови. Новость сайта - **site-news**.

### Изменение баланса (коэффициент арены, базовый урон, базовый крит)
1. Меняй только `src/arena-data.js`. Формулы трогай, лишь если игра сменила саму формулу.
2. Тесты закреплены на замерах игры: «базовый урон на 0 и 1 уровне», «…на 24 и 25 уровне», «арена: бонусы по формуле» (граница 124 очков), «базовый критический урон…», `GOLDEN`. Обнови ожидания на новые числа из игры (попроси у пользователя 1-2 замера) и укажи источник в комментарии теста.

### Новый талант
1. Добавь строку **в конец** `TALENTS` (иначе старые `t` сдвинутся). Требования должны стоять в массиве **раньше** таланта: `sanitizeTalents` проверяет предков по порядку массива, иначе ранг всегда отбросится.
2. Новый `stat` - код в `talentTotals` (+ поле в `buildTotals`/`buildResults`, если это новый вид бонуса) и подпись в `TALENT_STAT_LABELS`.
3. Картинку положи `assets/TALENT_XXXX-<хэш>.webp` (200×200) и впиши в `TALENT_ASSETS`; без неё узел покажет «✥».
4. Тест «сумма очков талантов не больше 135» упадёт (5 очков на талант) - уточни у Sof новый максимум. В `calculator.html` захардкожено «0 / 135» (`#talentPointsBadge`, `#modalMaxPoints`) - JS перепишет, но поправь и разметку. Стоимость прокачки - **game-info**.

### Новое оружие
Затрагивает много мест, ничего не пропусти: `BASE_DAMAGE_LEVEL0` (+ `BASE_CRIT_DAMAGE` для жетонного); `DAMAGE_KEYS`, ключи в `arenaBonus`, маппинг цели в `talentTotals`, крит-поля в `buildTotals`/`buildResults`; в `app.js` - `CARDS`, `ARENA_ICON`, `ARENA_LABEL`, `GEAR_BONUS_LABELS`, крит-цикл `["Grenade","Gl","Gauss"]` в `calc()`, `announceResults`; `#calcDock` в `calculator.html` (`dock<Key>`, id = `"dock" + cap(k)`); `.weapon-<icon>` в `calculator.css` + картинка; `CMP_GROUPS` в `src/calc-compare.js`; `TOKEN_PRICES`, `TOKEN_WEAPONS`, `TOKEN_CRIT`, `TOKEN_ICON_CLASS`, `ARSENAL_COLOR` в `src/calc-tokens.js`; `TALENT_TARGET_NAMES`; тесты базового урона, арены и `GOLDEN`. Формат ссылки не меняется.

### Исправление формулы
1. Сначала тест в `test/calc-core.test.mjs` с замером из игры (уровень, вещи, арена, таланты -> число), убедись, что он падает (`npm test`).
2. Правь только `src/calc-core.js` (DOM-код в `app.js` формул не содержит - он берёт `buildTotals`/`buildResults`).
3. Эталоны `GOLDEN` меняй, только если исправление действительно меняет верные числа, и объясни это в PR.

### Новое окно-модуль
1. `src/calc-<имя>.js`: `export function setup(c) { const { $, … } = c; …; return { open, … }; }` - **без своих import** (иначе esbuild выделит общий `calc/chunk-*.js`, сборка предупредит).
2. В `app.js`: нужное добавь в `ctx`; `const xUI = lazyPart(() => import("./src/calc-<имя>.js"))`; добавь в `preload`; кнопки - через общий `click`-обработчик (`xUI.run(t => t.open())`); id окна - в список для `MutationObserver` (`["talentModal", …]`, фокус и `inert`) и в цепочку `Escape`.
3. В `build.js` добавь файл в `MODULES["calculator.js"]` и `LAZY_JS["calculator.js"]` (иначе CSS-очистка выкинет его классы). Разметку окна - в `calculator.html` по образцу `#tokensModal`, стили - в `calculator.css`. Офлайн-кэш `calc/*.js` build.js подхватит сам.

## Подводные камни
- `npm test` запускает и `test/build.test.mjs` (сборка во временную папку, проверяет, что `calc/*.js` попали в оболочку SW).
- `localStorage`: `gameHelperState` (свой билд кодами: `gear`, `arena`, `level`, `talents`; старые `sets`/`items` - индексы, читаются `loadState`), `zoneBuildSlots` (`{active, list:[{id,name,hash}]}`, до 12 слотов, имя до 32 символов), `gameHelperCompare` (строка билда), `gameHelperTokens` (`{count,target}`), `gameHelperArsenal` (`{count:{grenade,gl,gauss}, tab}`). Не переименовывай ключи и поля - их читают `home-live.js`, `info.js`.
- Пояснения к блокам - «?» (`.sec-help`), не сноски. На сайте только дефис «-», кавычки «ёлочки».
- Комментарий в `calculator.html` ссылается на `calc-slots.css`, такого файла нет - стили слотов в `calculator.css`.

## Проверка
Общее - **verify-and-ship** (`npm test`, линт, формат, сборка, скриншоты). Своё:
- `/calculator`: пустой билд 1 ур. - нож 47, пистолет 49, автомат 55, граната 56, гранатомёт 115, гаусс 367; ещё 1-2 билда сверь с `GOLDEN` или замером игры. Открой «Снаряжение и бонусы»: новый комплект первым с меткой «новый», иконки на месте, «Выбрано N из M».
- Старые ссылки открываются в сравнении с прежними вещами: `/build#l=25&s=1&i=1&t=0` (4 вещи), `/build#l=25&s=1023&i=15&t=505505505000010000000000000`, и ссылка `g`, сохранённая до правки (с одиночными вещами).
- «Мои билды»: слот, созданный до правки, показывает те же вещи.
- Телефон (ширина ≤ 760px): при правке уровня внизу видна сводка `#calcDock` с 6 числами, равными карточкам; нажатие прокручивает к результатам; исчезает у кнопок «Ссылка на билд».
- Окна талантов, жетонов, сравнения открываются (куски грузятся), Esc закрывает.

## Связанные скиллы
**game-info**, **site-news**, **zone-news**, **site-dev**, **verify-and-ship**.
