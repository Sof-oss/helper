/* Калькулятор урона: состояние билда, расчёт и окна. */
import { TALENTS } from "./talents.js";
import {
  SETS,
  ITEMS,
  ALL_ITEMS,
  ITEM_BY_CODE,
  clampLevel,
  clampArena,
  arenaBonus,
  MIN_LEVEL,
  MAX_LEVEL,
  baseDamageByLevel,
  BASE_CRIT_DAMAGE,
  buildHashOf as buildHashOfCore,
  parseBuild as parseBuildCore,
  sanitizeTalents,
  DAMAGE_KEYS,
  buildTotals,
  buildResults,
  firstFreeHitDamage
} from "./src/calc-core.js";
const state = { items: new Set(), talents: {}, arena: 0 };
const keys = DAMAGE_KEYS;
const ARENA_ICON = { knife: "knife", pistol: "pistol", auto: "rifle", grenade: "grenade", gl: "ubgl", gauss: "gauss" };
const ARENA_LABEL = {
  knife: "Нож",
  pistol: "Пистолет",
  auto: "Автомат",
  grenade: "Граната",
  gl: "Подствольник",
  gauss: "Гаусс"
};
const $ = id => document.getElementById(id),
  STORAGE_KEY = "gameHelperState",
  MAX_TALENT_POINTS = TALENTS.length * 5;
const cap = k => k[0].toUpperCase() + k.slice(1);

/* сохранённые билды (src/calc-slots.js) узнают о каждой правке через onBuildSaved */
const buildSavedListeners = [];
const onBuildSaved = fn => buildSavedListeners.push(fn);
function saveState() {
  buildSavedListeners.forEach(fn => fn());
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        gear: [...state.items],
        arena: state.arena,
        level: clampLevel($("level").value),
        talents: state.talents
      })
    );
  } catch {}
}
function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!data) return;
    state.items.clear();
    state.talents = {};
    /* новый формат: gear - коды вещей; старый: sets/items - индексы комплектов и одиночных вещей */
    const add = code => {
      if (ITEM_BY_CODE[code]) state.items.add(code);
    };
    (Array.isArray(data.gear) ? data.gear : []).forEach(add);
    if (!Array.isArray(data.gear)) {
      (Array.isArray(data.sets) ? data.sets : []).forEach(i => {
        if (Number.isInteger(i) && SETS[i]) SETS[i].items.forEach(x => add(x.code));
      });
      (Array.isArray(data.items) ? data.items : []).forEach(i => {
        if (Number.isInteger(i) && ITEMS[i]) add(ITEMS[i].code);
      });
    }
    state.arena = clampArena(data.arena);
    if (data.level !== undefined) $("level").value = clampLevel(data.level);
    if (data.talents && typeof data.talents === "object") state.talents = sanitizeTalents(data.talents);
  } catch {}
}
const fmt = n => Math.round(n).toLocaleString("ru-RU"),
  fmtD = n => n.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  talentRank = code => state.talents[code] || 0,
  talentDef = code => TALENTS.find(t => t[0] === code);
/* русские формы числительных: 1 удар, 2 удара, 5 ударов */
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100,
    b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
function spentTalentPoints() {
  return Object.values(state.talents).reduce((a, b) => a + b, 0);
}
/* суммарные бонусы, урон и крит текущего билда - формулы в src/calc-core.js */
const totals = () => buildTotals({ gear: state.items, arena: state.arena, talents: state.talents });
function results(lvl, pre) {
  return buildResults(lvl === undefined ? $("level").value : lvl, pre || totals());
}

const isZero = (v, pct) => (pct ? Math.round(v * 100) === 0 : v === 0);
function fmtDelta(v, pct) {
  return (v > 0 ? "+" : "−") + (pct ? Math.abs(Math.round(v * 100)) + "%" : fmt(Math.abs(v)));
}
function pulse(id, v, pct) {
  const el = $(id);
  if (!el || isZero(v, pct)) return;
  clearTimeout(el._t);
  el.textContent = fmtDelta(v, pct);
  el.title = "Изменение после последней правки";
  el.className = "delta show " + (v > 0 ? "up" : "down");
  el._t = setTimeout(() => {
    el.className = "delta";
  }, 3500);
}
let prevResults = null;
/* бонусы всех комплектов и вещей для справки */
const GEAR_BONUS_LABELS = {
  knife: "Нож",
  pistol: "Пистолет",
  auto: "Автомат",
  grenade: "Граната",
  gl: "Гранатомёт",
  gauss: "Гаусс",
  critChance: "Шанс крита (общий)",
  critDamage: "Урон крита (общий)",
  critGaussChance: "Шанс крита (гаусс)",
  critGrenadeChance: "Шанс крита (граната)",
  critGaussDamage: "Урон крита (гаусс)",
  critGrenadeDamage: "Урон крита (граната)",
  freeNoCooldown: "Шанс удара без отката",
  cooldown: "Сокращение отката"
};
const GEAR_BONUS_PCT = new Set(["critChance", "critGaussChance", "critGrenadeChance", "freeNoCooldown", "cooldown"]);
/* короткие подписи для карточек снаряжения: окно узкое, длинные названия не помещаются */
const EQ_BONUS_LABELS = {
  ...GEAR_BONUS_LABELS,
  critChance: "Крит",
  critDamage: "Крит. урон",
  critGaussChance: "Крит гаусса",
  critGrenadeChance: "Крит гранаты",
  critGaussDamage: "Крит. урон гаусса",
  critGrenadeDamage: "Крит. урон гранаты",
  freeNoCooldown: "Без отката",
  cooldown: "Откат"
};
const GEAR_EXTRA = [
  "critChance",
  "critDamage",
  "critGaussChance",
  "critGrenadeChance",
  "critGaussDamage",
  "critGrenadeDamage",
  "freeNoCooldown",
  "cooldown"
];
function openGearInfo() {
  $("gearInfoModal").classList.add("show");
  $("gearInfoModal").setAttribute("aria-hidden", "false");
  renderEquipment();
  const close = $("gearInfoModal").querySelector("button[data-close-gear-info]");
  if (close) requestAnimationFrame(() => close.focus({ preventScroll: true }));
}
function closeGearInfo() {
  $("gearInfoModal").classList.remove("show");
  $("gearInfoModal").setAttribute("aria-hidden", "true");
  if ($("openEquipment")) $("openEquipment").focus({ preventScroll: true });
}

/* карточки урона */
const CARDS = {
  paid: [
    ["grenade", "Граната", "grenade"],
    ["gl", "Гранатомёт", "ubgl"],
    ["gauss", "Гаусс", "gauss"]
  ],
  free: [
    ["knife", "Нож", "knife"],
    ["pistol", "Пистолет", "pistol"],
    ["auto", "Автомат", "rifle"]
  ]
};
/* составляющие урона: [класс ячейки, подпись, короткая подпись для телефона, начало id] - в том же порядке, что и полоса */
const BD_PARTS = [
  ["", "База", "", "base"],
  ["bd-level", "Уровень", "", "level"],
  ["bd-gear", "Снаряжение", "Вещи", "gear"],
  ["bd-arena", "Арена", "", "arena"],
  ["bd-talent", "Таланты", "", "talentOut"]
];
function cardMarkup([k, name, icon], withCrit) {
  const K = cap(k),
    cellHtml = ([cls, label, short, id]) =>
      '<div class="bd-cell ' +
      cls +
      '"><small>' +
      (short ? '<span class="bd-long">' + label + '</span><span class="bd-short">' + short + "</span>" : label) +
      '</small><em id="' +
      id +
      K +
      '">0</em></div>';
  return (
    '<article class="damage-card"><div class="weapon-icon weapon-' +
    icon +
    '" aria-hidden="true"></div><div class="dmg-main"><h3>' +
    name +
    '</h3><strong id="result' +
    K +
    '">0</strong>' +
    /* первый бесплатный удар: значок и число, пояснение - при наведении или нажатии (как у «?»), видно при вкачанной «Засаде» */
    (withCrit
      ? ""
      : '<button type="button" class="first-hit" hidden aria-expanded="false" aria-describedby="fhTip' +
        K +
        '"><svg class="ic" aria-hidden="true"><use href="#i-eye"/></svg><span class="sr-only">Первый удар: </span><b id="first' +
        K +
        '">0</b><span class="fh-tip" id="fhTip' +
        K +
        '" role="tooltip"></span></button>') +
    '</div><i class="delta" id="delta' +
    K +
    '"></i><div class="dmg-bar" id="bar' +
    K +
    '" aria-hidden="true"><i class="s0"></i><i class="s1"></i><i class="s2"></i><i class="s-arena"></i><i class="s3"></i></div><div class="breakdown">' +
    BD_PARTS.map(cellHtml).join("") +
    "</div>" +
    (withCrit
      ? '<span class="crit-chip"><span class="crit-chip-label">Крит</span><em id="crit' +
        K +
        '">0%</em><span class="crit-chip-sep">·</span><em id="critDmg' +
        K +
        '">+0</em><span class="crit-chip-unit">к удару</span></span>'
      : "") +
    "</article>"
  );
}
function renderCards() {
  $("paidCards").innerHTML = CARDS.paid.map(c => cardMarkup(c, true)).join("");
  $("freeCards").innerHTML = CARDS.free.map(c => cardMarkup(c, false)).join("");
}

/* снаряжение: карта комплектов в окне */
const escEq = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ITEM_SET = new Map();
SETS.forEach(s => s.items.forEach(i => ITEM_SET.set(i.code, s.code)));
ITEMS.forEach(i => ITEM_SET.set(i.code, "standalone"));
const gearSets = () => [SETS.find(s => s.isNew), ...SETS.filter(s => !s.isNew)].filter(Boolean);
const gearLabel = (k, v) => EQ_BONUS_LABELS[k] + " +" + (GEAR_BONUS_PCT.has(k) ? Math.round(v * 100) + "%" : fmt(v));
function equipmentChips(item) {
  const out = [];
  keys.forEach(k => {
    if (item.bonuses[k]) out.push(gearLabel(k, item.bonuses[k]));
  });
  GEAR_EXTRA.forEach(k => {
    if (item.extras[k]) out.push(gearLabel(k, item.extras[k]));
  });
  return out;
}
function gearExtras() {
  const ex = {
    critChance: 0,
    critDamage: 0,
    critGaussChance: 0,
    critGrenadeChance: 0,
    critGaussDamage: 0,
    critGrenadeDamage: 0,
    freeNoCooldown: 0,
    cooldown: 0
  };
  state.items.forEach(code => {
    const x = ITEM_BY_CODE[code];
    if (!x) return;
    Object.keys(ex).forEach(k => (ex[k] += x.extras[k] || 0));
  });
  return ex;
}
function chipsMarkup(list) {
  return list.map(t => '<span class="eq-chip">' + t + "</span>").join("");
}
function equipmentSummaryHTML() {
  const T = totals(),
    ex = gearExtras();
  const chip = k => '<span class="eq-chip">' + GEAR_BONUS_LABELS[k] + " <b>+" + fmt(T.gearTotal[k]) + "</b></span>";
  const extra = GEAR_EXTRA.filter(k => ex[k])
    .map(k => '<span class="eq-chip is-crit">' + gearLabel(k, ex[k]) + "</span>")
    .join("");
  return (
    '<div class="eq-total-title">Общие бонусы снаряжения</div>' +
    '<div class="eq-total-row"><small>Урон</small><div class="eq-chips">' +
    (keys.some(k => T.gearTotal[k])
      ? keys
          .filter(k => T.gearTotal[k])
          .map(chip)
          .join("")
      : '<span class="eq-chip eq-chip-muted">ничего не выбрано</span>') +
    "</div></div>" +
    (extra
      ? '<div class="eq-total-row"><small>Крит и откат</small><div class="eq-chips">' + extra + "</div></div>"
      : "")
  );
}
function equipmentSlot(item) {
  const on = state.items.has(item.code);
  return (
    '<button type="button" class="eq-slot' +
    (on ? " on" : "") +
    '" data-eq-item="' +
    escEq(item.code) +
    '" aria-pressed="' +
    on +
    '" title="' +
    escEq(item.name) +
    '">' +
    '<img src="' +
    item.icon +
    '" alt="" width="64" height="64" loading="lazy" decoding="async"><b>' +
    escEq(item.name) +
    '</b><span class="eq-chips">' +
    chipsMarkup(equipmentChips(item)) +
    "</span></button>"
  );
}
function equipmentCard(key, name, items, isNew) {
  const selected = items.filter(i => state.items.has(i.code)).length;
  const pct = Math.round((selected / items.length) * 100);
  const all = selected === items.length;
  const standalone = key === "standalone";
  return (
    '<article class="eq-card' +
    (isNew ? " is-new" : "") +
    '" data-eq-card="' +
    escEq(key) +
    '"><header><span class="eq-ring" data-eq-ring="' +
    escEq(key) +
    '" style="--p:' +
    pct +
    '"><b>' +
    selected +
    "/" +
    items.length +
    "</b></span><h3>" +
    escEq(name) +
    "</h3>" +
    (isNew ? '<span class="eq-new">новый</span>' : "") +
    '<button type="button" class="eq-set-toggle" data-eq-set="' +
    escEq(key) +
    '" aria-pressed="' +
    all +
    '">' +
    (standalone ? (all ? "снять всё" : "все вещи") : all ? "снять комплект" : "весь комплект") +
    '</button></header><div class="eq-slots">' +
    items.map(equipmentSlot).join("") +
    (items.length < 3 ? '<span class="eq-slot eq-empty" aria-hidden="true"></span>'.repeat(3 - items.length) : "") +
    "</div></article>"
  );
}
function renderEquipment() {
  const body = $("gearInfoBody");
  if (!body) return;
  body.innerHTML =
    '<div class="eq-toolbar"><span role="status" aria-live="polite">Выбрано <b id="eqCount">' +
    state.items.size +
    "</b> из " +
    ALL_ITEMS.length +
    '</span><span class="eq-toolbar-btns"><button type="button" id="eqSelectAll">Выбрать всё</button><button type="button" id="eqClear">Снять всё</button></span></div>' +
    '<div class="eq-scroll"><div class="eq-grid">' +
    gearSets()
      .map(s => equipmentCard(s.code, s.name, s.items, s.isNew))
      .join("") +
    equipmentCard("standalone", "Без комплекта", ITEMS, false) +
    '</div></div><div class="eq-totals" id="eqTotals">' +
    equipmentSummaryHTML() +
    "</div>";
}
function updateEquipmentSummary() {
  const count = $("equipmentCount");
  if (count) count.textContent = state.items.size + " / " + ALL_ITEMS.length;
  const arena = $("arenaPoints");
  if (arena && document.activeElement !== arena) arena.value = state.arena;
  const hint = $("arenaHint");
  if (hint) {
    const a = arenaBonus(state.arena);
    hint.innerHTML = keys
      .map(
        k =>
          '<span class="arena-stat' +
          (a[k] ? "" : " is-zero") +
          '"><i class="weapon-icon weapon-' +
          ARENA_ICON[k] +
          '" aria-hidden="true"></i><span><small>' +
          ARENA_LABEL[k] +
          "</small><b>" +
          (a[k] ? "+" + fmt(a[k]) : "0") +
          "</b></span></span>"
      )
      .join("");
  }
  const eqCount = $("eqCount");
  if (eqCount) eqCount.textContent = state.items.size;
  const totalsBox = $("eqTotals");
  if (totalsBox) totalsBox.innerHTML = equipmentSummaryHTML();
}
function updateEquipmentCard(key) {
  const card = document.querySelector('[data-eq-card="' + key + '"]');
  if (!card) return;
  const items = key === "standalone" ? ITEMS : (SETS.find(s => s.code === key) || { items: [] }).items;
  const selected = items.filter(i => state.items.has(i.code)).length;
  const ring = card.querySelector("[data-eq-ring]");
  if (ring) {
    ring.style.setProperty("--p", Math.round((selected / items.length) * 100));
    const b = ring.querySelector("b");
    if (b) b.textContent = selected + "/" + items.length;
  }
  const setBtn = card.querySelector("[data-eq-set]");
  if (setBtn) {
    setBtn.setAttribute("aria-pressed", selected === items.length);
    const standalone = key === "standalone";
    setBtn.textContent = standalone
      ? selected === items.length
        ? "снять всё"
        : "все вещи"
      : selected === items.length
        ? "снять комплект"
        : "весь комплект";
  }
  items.forEach(i => {
    const b = card.querySelector('[data-eq-item="' + i.code + '"]');
    if (!b) return;
    const on = state.items.has(i.code);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on);
  });
}
function toggleEquipmentItem(code) {
  if (!ITEM_BY_CODE[code]) return;
  if (state.items.has(code)) state.items.delete(code);
  else state.items.add(code);
  saveState();
  updateEquipmentCard(ITEM_SET.get(code) || "standalone");
  updateEquipmentSummary();
  calc();
}
function toggleEquipmentSet(key) {
  const items = key === "standalone" ? ITEMS : (SETS.find(s => s.code === key) || { items: [] }).items;
  const all = items.every(i => state.items.has(i.code));
  items.forEach(i => (all ? state.items.delete(i.code) : state.items.add(i.code)));
  saveState();
  updateEquipmentCard(key);
  updateEquipmentSummary();
  calc();
}
function selectAllEquipment(on) {
  ALL_ITEMS.forEach(i => (on ? state.items.add(i.code) : state.items.delete(i.code)));
  saveState();
  renderEquipment();
  updateEquipmentSummary();
  calc();
}
function setArena(raw) {
  const input = $("arenaPoints"),
    active = document.activeElement === input;
  state.arena = clampArena(raw);
  /* как у уровня: дробное и отрицательные значения исправляются сразу, пустое поле не трогаем, пока печатают */
  if (!active || (raw !== "" && String(state.arena) !== raw)) input.value = state.arena;
  saveState();
  updateEquipmentSummary();
  calc();
}
function set(id, v, roll) {
  const el = $(id);
  if (!el) return;
  /* итоговый урон «докручивается» до нового значения (ui.js), остальные подписи - сразу */
  if (roll && window.__roll) {
    window.__roll(el, v);
    return;
  }
  el.textContent = v;
}
function calc() {
  /* уровень - только целое 1–100; пустое поле не трогаем, пока человек печатает (поправится при уходе из поля) */
  const rawLevel = $("level").value,
    level = clampLevel(rawLevel);
  if (rawLevel !== "" && rawLevel !== String(level)) {
    $("level").value = level;
    levelHint(rawLevel);
  }
  const T = totals(),
    tal = T.talentTotal,
    base = baseDamageByLevel(level),
    baseZero = baseDamageByLevel(0),
    r = results(undefined, T);
  if ($("levelRange")) $("levelRange").value = level;
  keys.forEach(k => {
    const K = cap(k);
    /* составляющие урона (порядок BD_PARTS): ячейки под числом и полоса с теми же долями */
    const parts = [baseZero[k], base[k] - baseZero[k], T.gearTotal[k], T.arena[k], tal[k]],
      sum = parts.reduce((a, b) => a + b, 0) || 1,
      bar = $("bar" + K);
    parts.forEach((v, i) => {
      const id = BD_PARTS[i][3] + K,
        el = $(id),
        /* подсказка при наведении: «Снаряжение: 612 (40%)» - и на ячейке, и на её части полосы */
        tip = BD_PARTS[i][1] + ": " + fmt(v) + " (" + Math.round((v / sum) * 100) + "%)";
      set(id, fmt(v));
      if (el) {
        el.parentElement.classList.toggle("is-zero", !v);
        el.parentElement.title = tip;
      }
      if (bar) {
        bar.children[i].style.width = (v / sum) * 100 + "%";
        bar.children[i].title = tip;
      }
    });
    set("result" + K, fmt(r[k]), true);
    set("dock" + K, fmt(r[k]));
  });
  /* первый бесплатный удар: итоговый урон плюс процентный бонус таланта */
  /* видно только при вкачанной «Засаде»: без неё первый удар равен обычному */
  ["knife", "pistol", "auto"].forEach(k => {
    const el = $("first" + cap(k));
    set("first" + cap(k), fmt(firstFreeHitDamage(r[k], r.firstFreeHit)));
    if (!el) return;
    el.parentElement.hidden = !r.firstFreeHit;
    set(
      "fhTip" + cap(k),
      "Урон первого бесплатного удара с талантом «Засада» (+" + (r.firstFreeHit * 100).toFixed(0) + "%)"
    );
  });
  ["Grenade", "Gl", "Gauss"].forEach(K => {
    set("crit" + K, (r["crit" + K] * 100).toFixed(0) + "%");
    set("critDmg" + K, "+" + fmt(r["critDmg" + K]));
    /* пока шанса крита нет, а урон крита только базовый, плашка приглушённая, а не тревожно-красная */
    const chip = $("crit" + K) && $("crit" + K).closest(".crit-chip");
    if (chip) chip.classList.toggle("is-zero", !r["crit" + K] && r["critDmg" + K] <= BASE_CRIT_DAMAGE[K.toLowerCase()]);
  });
  set("noCooldown", (r.noCooldown * 100).toFixed(0) + "%");
  set("cooldown", (r.cooldown * 100).toFixed(0) + "%");
  set("firstFreeHit", "+" + (r.firstFreeHit * 100).toFixed(0) + "%");
  if (prevResults) {
    keys.forEach(k => pulse("delta" + cap(k), r[k] - prevResults[k]));
    pulse("deltaNoCooldown", r.noCooldown - prevResults.noCooldown, true);
    pulse("deltaCooldown", r.cooldown - prevResults.cooldown, true);
    pulse("deltaFirstFreeHit", r.firstFreeHit - prevResults.firstFreeHit, true);
  }
  announceResults(r);
  prevResults = r;
}
/* уровень вне 1–100 исправляется, но не молча: подсказка под полем и короткая подсветка */
function levelHint(raw) {
  const n = Number(String(raw).replace(",", "."));
  const hint = $("levelHint");
  if (!hint) return;
  hint.textContent =
    n > MAX_LEVEL
      ? "Максимальный уровень - " + MAX_LEVEL
      : n < MIN_LEVEL
        ? "Минимальный уровень - " + MIN_LEVEL
        : "Уровень - целое число от " + MIN_LEVEL + " до " + MAX_LEVEL;
  $("level").classList.add("is-fixed");
  clearTimeout(hint._t);
  hint._t = setTimeout(() => {
    hint.textContent = "";
    $("level").classList.remove("is-fixed");
  }, 3000);
}
function render() {
  updateEquipmentSummary();
  $("talentPointsBadge").textContent = spentTalentPoints() + " / " + MAX_TALENT_POINTS;
  /* дерево перерисовывается, только пока окно открыто; при открытии оно рисуется заново */
  const t = talentsUI.now();
  if (t && isShown("talentModal")) t.render();
  calc();
}
function showToast(text, kind) {
  const t = $("toast");
  t.textContent = text || "В разработке";
  t.classList.remove("ok", "err");
  if (kind) t.classList.add(kind);
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* билд в ссылке: уровень, вещи, характеристики арены и таланты после # */
const currentBuild = () => ({
  level: clampLevel($("level").value),
  gear: [...state.items],
  arena: state.arena,
  talents: { ...state.talents }
});
const buildHashOf = b => buildHashOfCore(b);
function buildHash() {
  return buildHashOf(currentBuild());
}
/* разбор билда - src/calc-core.js */
const parseBuild = raw => parseBuildCore(raw);
/* расчёт чужого билда */
const resultsFor = b => buildResults(b.level, buildTotals(b));

/* сравнение: второй билд хранится отдельно и не трогает основной (окно - src/calc-compare.js) */
const CMP_KEY = "gameHelperCompare";
function fallbackCopy(s) {
  const a = document.createElement("textarea");
  a.value = s;
  a.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(a);
  a.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {}
  a.remove();
  return ok;
}
function copyText(s) {
  return navigator.clipboard && window.isSecureContext
    ? navigator.clipboard.writeText(s).then(
        () => true,
        () => fallbackCopy(s)
      )
    : Promise.resolve(fallbackCopy(s));
}
function shareBuild() {
  /* ссылка ведёт на /build - копию калькулятора со своим превью для соцсетей (build.js) */
  copyText(location.origin + "/build#" + buildHash()).then(ok =>
    showToast(ok ? "Ссылка скопирована" : "Не удалось скопировать", ok ? "ok" : "err")
  );
}

/* Окна и озвучка */
const isShown = id => $(id).classList.contains("show");
function closeModal(id) {
  $(id).classList.remove("show");
  $(id).setAttribute("aria-hidden", "true");
}
const openedModals = new Map();
function setPageInert(on) {
  document.querySelectorAll(".site-header,.page,.site-footer,.calc-dock").forEach(el => {
    el.inert = on;
  });
}
function modalShown(m) {
  if (openedModals.has(m)) return;
  const a = document.activeElement;
  openedModals.set(m, a && a !== document.body ? a : null);
  setPageInert(true);
  m.querySelector(".talent-dialog").focus({ preventScroll: true });
}
function modalHidden(m) {
  if (!openedModals.has(m)) return;
  const opener = openedModals.get(m);
  openedModals.delete(m);
  if (!openedModals.size) setPageInert(false);
  if (m.id === "talentModal" && talentsUI.now()) talentsUI.now().onHidden();
  if (opener && opener.isConnected) opener.focus({ preventScroll: true });
}
["talentModal", "gearInfoModal", "tokensModal", "compareModal"].forEach(id => {
  const m = $(id);
  m.querySelector(".talent-dialog").tabIndex = -1;
  new MutationObserver(() => (m.classList.contains("show") ? modalShown(m) : modalHidden(m))).observe(m, {
    attributes: true,
    attributeFilter: ["class"]
  });
});

/* подтверждение в стиле сайта вместо confirm(): askConfirm({title,text,ok}) -> Promise<boolean>. */
let confirmResolve = null,
  confirmOpener = null,
  confirmInerted = [];
const confirmOpen = () => $("confirmModal").classList.contains("show");
function askConfirm({ title, text, ok }) {
  if (confirmResolve) closeConfirm(false);
  const m = $("confirmModal");
  $("confirmTitle").textContent = title;
  $("confirmText").textContent = text;
  $("confirmYes").textContent = ok || "Да";
  const a = document.activeElement;
  confirmOpener = a && a !== document.body ? a : null;
  confirmInerted = [
    ...document.querySelectorAll(".site-header,.tabbar,.tabbar-more,.page,.site-footer,.talent-modal.show")
  ].filter(el => el !== m && !el.inert);
  confirmInerted.forEach(el => {
    el.inert = true;
  });
  m.classList.add("show");
  m.setAttribute("aria-hidden", "false");
  $("confirmNo").focus({ preventScroll: true });
  return new Promise(res => {
    confirmResolve = res;
  });
}
function closeConfirm(answer) {
  const m = $("confirmModal");
  if (!confirmOpen()) return;
  m.classList.remove("show");
  m.setAttribute("aria-hidden", "true");
  confirmInerted.forEach(el => {
    el.inert = false;
  });
  confirmInerted = [];
  const res = confirmResolve,
    opener = confirmOpener;
  confirmResolve = null;
  confirmOpener = null;
  if (res) res(answer);
  /* фокус возвращаем после перерисовки: кнопка могла смениться, тогда фокус уходит в открытое окно */
  setTimeout(() => {
    if (opener && opener.isConnected) {
      opener.focus({ preventScroll: true });
      return;
    }
    const d = document.querySelector(".talent-modal.show .talent-dialog");
    if (d) d.focus({ preventScroll: true });
  }, 0);
}
document.addEventListener(
  "click",
  e => {
    const b = e.target.closest && e.target.closest("[data-confirm]");
    if (b) {
      e.stopPropagation();
      closeConfirm(b.dataset.confirm === "yes");
    }
  },
  true
);

/* итоги расчёта для скринридера: одной фразой и с паузой, чтобы набор уровня по цифре не читался на каждую */
let liveTimer = 0,
  liveText = "",
  liveReady = false;
function announceResults(r) {
  const text =
    "Урон за жетоны: граната " +
    fmt(r.grenade) +
    ", гранатомёт " +
    fmt(r.gl) +
    ", гаусс " +
    fmt(r.gauss) +
    ". Бесплатные удары: нож " +
    fmt(r.knife) +
    ", пистолет " +
    fmt(r.pistol) +
    ", автомат " +
    fmt(r.auto) +
    ".";
  clearTimeout(liveTimer);
  if (!liveReady) {
    liveReady = true;
    liveText = text;
    return;
  } /* первый расчёт при загрузке не озвучиваем */
  if (text === liveText) return;
  liveTimer = setTimeout(() => {
    liveText = text;
    $("resultsLive").textContent = text;
  }, 800);
}

document.addEventListener("click", e => {
  if (e.target.closest("#openEquipment")) {
    openGearInfo();
    return;
  }
  const eqItem = e.target.closest("[data-eq-item]");
  if (eqItem) {
    toggleEquipmentItem(eqItem.dataset.eqItem);
    return;
  }
  const eqSet = e.target.closest("[data-eq-set]");
  if (eqSet) {
    toggleEquipmentSet(eqSet.dataset.eqSet);
    return;
  }
  if (e.target.closest("#eqSelectAll")) {
    selectAllEquipment(true);
    return;
  }
  if (e.target.closest("#eqClear")) {
    selectAllEquipment(false);
    return;
  }
  /* кнопки внутри окна талантов обрабатывает src/calc-talents.js */
  if (e.target.closest("#openTalents")) {
    talentsUI.run(t => t.open());
    return;
  }
  if (e.target.closest("#openGearInfo")) {
    openGearInfo();
    return;
  }
  if (e.target.closest("[data-close-gear-info]")) {
    closeGearInfo();
    return;
  }
  if (e.target.closest("#openTokens")) {
    tokensUI.run(t => t.open());
    return;
  }
  if (e.target.closest("[data-close-tokens]")) {
    closeModal("tokensModal");
    return;
  }
  /* вкладку ловим здесь, а не в src/calc-tokens.js: тур нажимает её сразу после «Расчёт по жетонам»,
     и пока кусок окна грузится, нажатие встаёт в очередь за открытием */
  const tokTabBtn = e.target.closest("[data-tok-tab]");
  if (tokTabBtn) {
    tokensUI.run(t => t.tab(tokTabBtn.dataset.tokTab));
    return;
  }
  if (e.target.closest("#shareBuild")) {
    shareBuild();
    return;
  }
  if (e.target.closest("#openCompare")) {
    compareUI.run(t => t.open());
    return;
  }
  if (e.target.closest("[data-close-compare]")) closeModal("compareModal");
});
/* «?» у заголовков результатов и значок первого удара: пояснение вместо сноски. На компьютере видно при наведении и фокусе,
   на телефоне (там нет наведения, а кнопки в Safari не получают фокус) - по нажатию, закрывается нажатием мимо или Esc */
const openTips = () => document.querySelectorAll('.sec-help[aria-expanded="true"],.first-hit[aria-expanded="true"]');
document.addEventListener("click", e => {
  const b = e.target.closest(".sec-help,.first-hit");
  openTips().forEach(x => x !== b && x.setAttribute("aria-expanded", "false"));
  if (b) b.setAttribute("aria-expanded", String(b.getAttribute("aria-expanded") !== "true"));
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const t = talentsUI.now();
  if (openTips().length) openTips().forEach(x => x.setAttribute("aria-expanded", "false"));
  else if (confirmOpen()) closeConfirm(false);
  else if (t && t.detailOpen()) t.closeDetail();
  else if (isShown("compareModal")) closeModal("compareModal");
  else if (isShown("tokensModal")) closeModal("tokensModal");
  else if (isShown("gearInfoModal")) closeGearInfo();
  else if (t) t.close();
});
const arenaInput = $("arenaPoints");
if (arenaInput) {
  arenaInput.addEventListener("input", () => setArena(arenaInput.value));
  arenaInput.addEventListener("change", () => {
    arenaInput.value = clampArena(arenaInput.value);
    setArena(arenaInput.value);
  });
}
function stepInput(b, mult) {
  const input = $(b.dataset.step),
    dir = (Number(b.dataset.dir) || 0) * mult,
    min = Number(input.min) || 0,
    max = Number(input.max) || 999;
  input.value = Math.min(max, Math.max(min, (Number(input.value) || 0) + dir));
  if (input.id === "arenaPoints") {
    setArena(input.value);
    return;
  }
  saveState();
  calc();
}
/* −/+ можно зажать: после паузы шаг повторяется всё чаще, у арены (сотни очков) через пару секунд - по 5.
   Если повтор сработал, клик после отпускания уже не считается: иначе вышел бы лишний шаг */
let holdTimer = 0,
  holdUsed = false;
const stopHold = () => clearTimeout(holdTimer);
document.addEventListener("pointerdown", e => {
  const b = e.button === 0 && e.target.closest("[data-step]");
  if (!b) return;
  stopHold();
  holdUsed = false;
  let n = 0;
  const tick = () => {
    holdUsed = true;
    n++;
    stepInput(b, b.dataset.step === "arenaPoints" && n > 25 ? 5 : 1);
    holdTimer = setTimeout(tick, n < 4 ? 160 : n < 12 ? 90 : 50);
  };
  holdTimer = setTimeout(tick, 420);
});
["pointerup", "pointercancel"].forEach(t =>
  document.addEventListener(t, () => {
    stopHold();
    /* клик после отпускания приходит в той же задаче; если палец ушёл с кнопки, клика не будет - флаг не должен остаться */
    setTimeout(() => (holdUsed = false));
  })
);
/* долгое нажатие на телефоне не должно открывать меню */
document.addEventListener("contextmenu", e => {
  if (e.target.closest && e.target.closest("[data-step]")) e.preventDefault();
});
document.addEventListener("click", e => {
  const b = e.target.closest("[data-step]");
  if (!b) return;
  if (holdUsed) {
    holdUsed = false;
    return;
  }
  stepInput(b, 1);
});
/* ползунок уровня под полем: двигает то же значение */
$("levelRange").addEventListener("input", () => {
  $("level").value = $("levelRange").value;
  saveState();
  calc();
});
$("level").addEventListener("change", () => {
  const raw = $("level").value;
  if (raw !== String(clampLevel(raw))) {
    $("level").value = clampLevel(raw);
    levelHint(raw);
  }
});
$("level").addEventListener("input", () => {
  saveState();
  calc();
});
$("resetAll").onclick = () =>
  askConfirm({
    title: "Сбросить всё?",
    text: "Уровень, снаряжение, характеристики арены и все очки талантов вернутся к началу. Отменить это действие нельзя.",
    ok: "Сбросить всё"
  }).then(yes => {
    if (!yes) return;
    state.items.clear();
    state.arena = 0;
    state.talents = {};
    if (talentsUI.now()) talentsUI.now().forgetChange();
    $("level").value = 1;
    if ($("arenaPoints")) $("arenaPoints").value = 0;
    if ($("gearInfoModal") && $("gearInfoModal").classList.contains("show")) renderEquipment();
    saveState();
    render();
  });

renderCards();
loadState();
/* билд из ссылки идёт в сравнение (src/calc-compare.js), свой сохранённый не трогаем */
const linked = parseBuild(location.hash);
if (linked) history.replaceState(null, "", location.pathname.replace(/\/build$/, "/calculator") + location.search);

/* окна талантов, жетонов и сравнения - отдельные куски сборки (build.js, папка calc/): их код не нужен для первого
   расчёта, поэтому грузится при первом открытии окна или заранее, когда страница простаивает. Всё общее куски
   получают через ctx. Пока кусок грузится, действия с ним встают в очередь и выполняются по порядку */
const ctx = {
  state,
  $,
  TALENTS,
  ALL_ITEMS,
  ITEM_BY_CODE,
  MAX_TALENT_POINTS,
  CMP_KEY,
  linked,
  talentRank,
  talentDef,
  spentTalentPoints,
  fmt,
  fmtD,
  fmtDelta,
  isZero,
  plural,
  results,
  resultsFor,
  currentBuild,
  parseBuild,
  buildHashOf,
  saveState,
  render,
  askConfirm,
  showToast
};
function lazyPart(load) {
  let api = null,
    wait = null;
  const get = () => {
    if (!wait)
      wait = load().then(
        m => (api = m.setup(ctx)),
        err => {
          wait = null;
          throw err;
        }
      );
    return wait;
  };
  return {
    now: () => api,
    preload: () => get().catch(() => {}),
    run: fn =>
      api
        ? fn(api)
        : get().then(fn, () => showToast("Окно не загрузилось. Проверьте интернет и обновите страницу", "err"))
  };
}
const talentsUI = lazyPart(() => import("./src/calc-talents.js")),
  tokensUI = lazyPart(() => import("./src/calc-tokens.js")),
  compareUI = lazyPart(() => import("./src/calc-compare.js"));

render();
if (linked) compareUI.run(t => t.open());

/* сводка урона для телефона (#calcDock): на телефоне настройки идут перед результатами, и при правке уровня или арены
   итог не виден. Сводка показывается, пока конец настроек (.side-actions) ниже экрана, и прячется, как только он
   появился над нижним меню, - тогда и результаты рядом. Нажатие - прокрутка к результатам */
{
  const dock = $("calcDock"),
    mark = document.querySelector(".sidebar .side-actions"),
    phone = matchMedia("(max-width: 760px)");
  if (dock && mark && window.IntersectionObserver) {
    let below = false;
    const sync = () => (dock.hidden = !(phone.matches && below));
    new IntersectionObserver(
      ([en]) => {
        below = !en.isIntersecting && en.boundingClientRect.top > 0;
        sync();
      },
      { rootMargin: "0px 0px -70px 0px" }
    ).observe(mark);
    phone.addEventListener("change", sync);
    dock.addEventListener("click", () => {
      const to = document.querySelector(".content .result-panel");
      if (to)
        to.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  }
}
const preload = () => [talentsUI, tokensUI, compareUI].forEach(p => p.preload());
if (window.requestIdleCallback) requestIdleCallback(preload, { timeout: 4000 });
else setTimeout(preload, 2000);

/* загрузить билд (строка из ссылки на билд) как свой: для слотов сохранённых билдов (src/calc-slots.js) */
function applyBuild(raw) {
  const b = parseBuild(raw);
  if (!b) return false;
  state.items = new Set(b.gear);
  state.arena = b.arena;
  state.talents = b.talents;
  $("level").value = b.level;
  if ($("arenaPoints")) $("arenaPoints").value = b.arena;
  if (talentsUI.now()) talentsUI.now().forgetChange();
  if ($("gearInfoModal") && $("gearInfoModal").classList.contains("show")) renderEquipment();
  saveState();
  render();
  return true;
}

/* то, чем пользуется src/calc-slots.js */
export { buildHash, applyBuild, onBuildSaved, parseBuild, showToast, askConfirm, copyText };
