/* Сохранённые билды калькулятора: несколько слотов со своими названиями, быстрое переключение.
   Слот хранит билд той же строкой, что и «Ссылка на билд» (l=..&s=..&i=..&t=.., src/calc-core.js), поэтому
   любую ссылку на билд можно сохранить в слот, а из слота - получить ссылку.
   Текущий билд по-прежнему живёт в gameHelperState (app.js); активный слот повторяет его при каждой правке,
   так что сохранять вручную не нужно. Блок рисуется первым в боковой панели, над уровнем персонажа: сначала выбираем билд, потом правим его.
   localStorage: zoneBuildSlots = { active: id, list: [{ id, name, hash }] } */
import { buildHash, applyBuild, onBuildSaved, parseBuild, showToast, askConfirm, copyText } from "../app.js";
import { TALENTS } from "../talents.js";

const KEY = "zoneBuildSlots";
const MAX = 12;
const NAME_MAX = 32;
const $ = id => document.getElementById(id);
const esc = s =>
  String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

let slots = null;
let editing = null; // id слота, который сейчас переименовывают
let importing = false;

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null");
    if (d && Array.isArray(d.list)) {
      const list = d.list
        .filter(x => x && typeof x.id === "string" && typeof x.hash === "string" && parseBuild(x.hash))
        .slice(0, MAX)
        .map(x => ({ id: x.id, name: String(x.name || "Билд").slice(0, NAME_MAX), hash: x.hash }));
      if (list.length) return { active: list.some(x => x.id === d.active) ? d.active : list[0].id, list };
    }
  } catch {}
  /* первый заход: текущий билд калькулятора становится первым слотом */
  const id = newId();
  return { active: id, list: [{ id, name: "Билд 1", hash: buildHash() }] };
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(slots));
  } catch {}
}
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
const active = () => slots.list.find(x => x.id === slots.active) || slots.list[0];
function freeName() {
  for (let n = slots.list.length + 1; ; n++) {
    const name = "Билд " + n;
    if (!slots.list.some(x => x.name === name)) return name;
  }
}

/* «ур. 25 · таланты 12 · вещи 3» - чтобы слоты отличались не только названием */
function summary(hash) {
  const b = parseBuild(hash);
  if (!b) return "";
  const pts = TALENTS.reduce((a, t) => a + (b.talents[t[0]] || 0), 0);
  const gear = b.sets.length + b.items.length;
  return "ур. " + b.level + " · таланты " + pts + " · вещи " + gear;
}

const ICON = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  import:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/></svg>',
  ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
};

function render() {
  const box = $("calcSlots");
  if (!box) return;
  const cur = active();
  const rows = slots.list
    .map(s => {
      const on = s.id === cur.id;
      if (s.id === editing)
        return (
          '<li class="slot on editing"><form class="slot-rename" data-slot-rename="' +
          esc(s.id) +
          '"><input id="slotNameInput" maxlength="' +
          NAME_MAX +
          '" value="' +
          esc(s.name) +
          '" aria-label="Название билда" autocomplete="off"><button type="submit" class="slot-ic" title="Сохранить название" aria-label="Сохранить название">' +
          ICON.ok +
          "</button></form></li>"
        );
      return (
        '<li class="slot' +
        (on ? " on" : "") +
        '"><button type="button" class="slot-pick" data-slot-pick="' +
        esc(s.id) +
        '" aria-pressed="' +
        on +
        '"><i aria-hidden="true"></i><span><b>' +
        esc(s.name) +
        "</b><small>" +
        esc(summary(s.hash)) +
        "</small></span></button>" +
        (on
          ? '<span class="slot-acts"><button type="button" class="slot-ic" data-slot-rename-start title="Переименовать" aria-label="Переименовать «' +
            esc(s.name) +
            '»">' +
            ICON.edit +
            '</button><button type="button" class="slot-ic" data-slot-link title="Скопировать ссылку на этот билд" aria-label="Скопировать ссылку на «' +
            esc(s.name) +
            '»">' +
            ICON.link +
            "</button>" +
            (slots.list.length > 1
              ? '<button type="button" class="slot-ic danger" data-slot-del title="Удалить слот" aria-label="Удалить «' +
                esc(s.name) +
                '»">' +
                ICON.del +
                "</button>"
              : "") +
            "</span>"
          : "") +
        "</li>"
      );
    })
    .join("");
  const full = slots.list.length >= MAX;
  box.innerHTML =
    '<div class="side-title"><span><svg class="ic slot-title-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 3.5v6l2.5-1.6L13 9.5v-6"/></svg></span><b>Мои билды</b><small class="slot-count">' +
    slots.list.length +
    " / " +
    MAX +
    "</small></div>" +
    '<ul class="slot-list" aria-label="Сохранённые билды">' +
    rows +
    "</ul>" +
    (importing
      ? '<form class="slot-import" id="slotImport"><input id="slotImportInput" placeholder="Вставьте ссылку на билд" aria-label="Ссылка на билд" autocomplete="off"><button type="submit" class="slot-ic" title="Сохранить в новый слот" aria-label="Сохранить в новый слот">' +
        ICON.ok +
        "</button></form>"
      : "") +
    '<div class="slot-btns"><button type="button" class="side-btn ghost" data-slot-new' +
    (full ? " disabled" : "") +
    ' title="Новый слот - копия текущего билда">' +
    ICON.plus +
    'Новый</button><button type="button" class="side-btn ghost" data-slot-import' +
    (full ? " disabled" : "") +
    ' title="Сохранить в слот билд по ссылке">' +
    ICON.import +
    "Из ссылки</button></div>" +
    '<p class="slot-note">Правки сохраняются в выбранный билд сами</p>';
}

/* переключение: сначала запоминаем текущий билд в его слот, потом загружаем выбранный */
function pick(id) {
  if (id === slots.active) return;
  const from = active(),
    to = slots.list.find(x => x.id === id);
  if (!to) return;
  from.hash = buildHash();
  slots.active = to.id;
  editing = null;
  save();
  applyBuild(to.hash);
  render();
  const btn = document.querySelector('[data-slot-pick="' + CSS.escape(to.id) + '"]');
  if (btn) btn.focus({ preventScroll: true });
  showToast("Билд «" + to.name + "»", "ok");
}
function addSlot(hash, name) {
  if (slots.list.length >= MAX) {
    showToast("Не больше " + MAX + " билдов", "err");
    return null;
  }
  active().hash = buildHash();
  const s = { id: newId(), name: (name || freeName()).slice(0, NAME_MAX), hash };
  slots.list.push(s);
  slots.active = s.id;
  save();
  applyBuild(hash);
  return s;
}

function init() {
  const anchor = document.querySelector(".sidebar .level-section");
  if (!anchor || $("calcSlots")) return;
  anchor.insertAdjacentHTML("beforebegin", '<section class="side-section slots-section" id="calcSlots"></section>');
  slots = load();
  /* слот и текущий билд могли разойтись (например, правили в другой вкладке без слотов): главный - текущий */
  active().hash = buildHash();
  save();
  render();

  onBuildSaved(() => {
    if (!slots) return;
    const s = active(),
      h = buildHash();
    if (s.hash === h) return;
    s.hash = h;
    save();
    const small = document.querySelector(".slot.on .slot-pick small");
    if (small) small.textContent = summary(h);
  });

  const box = $("calcSlots");
  box.addEventListener("click", e => {
    const p = e.target.closest("[data-slot-pick]");
    if (p) {
      pick(p.dataset.slotPick);
      return;
    }
    if (e.target.closest("[data-slot-rename-start]")) {
      editing = slots.active;
      importing = false;
      render();
      const inp = $("slotNameInput");
      inp.focus();
      inp.select();
      return;
    }
    if (e.target.closest("[data-slot-link]")) {
      active().hash = buildHash();
      copyText(location.origin + "/build#" + active().hash).then(ok =>
        showToast(ok ? "Ссылка на «" + active().name + "» скопирована" : "Не удалось скопировать", ok ? "ok" : "err")
      );
      return;
    }
    if (e.target.closest("[data-slot-del]")) {
      const s = active();
      askConfirm({
        title: "Удалить билд «" + s.name + "»?",
        text: "Слот исчезнет из списка, калькулятор переключится на соседний билд. Отменить это нельзя.",
        ok: "Удалить"
      }).then(yes => {
        if (!yes) return;
        const i = slots.list.indexOf(s);
        slots.list.splice(i, 1);
        const next = slots.list[Math.max(0, i - 1)];
        slots.active = next.id;
        save();
        applyBuild(next.hash);
        render();
        showToast("Билд «" + s.name + "» удалён", "ok");
      });
      return;
    }
    if (e.target.closest("[data-slot-new]")) {
      const s = addSlot(buildHash());
      if (!s) return;
      editing = s.id;
      importing = false;
      render();
      const inp = $("slotNameInput");
      inp.focus();
      inp.select();
      return;
    }
    if (e.target.closest("[data-slot-import]")) {
      importing = !importing;
      editing = null;
      render();
      if (importing) $("slotImportInput").focus();
    }
  });
  box.addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target;
    if (f.matches("[data-slot-rename]")) {
      const s = slots.list.find(x => x.id === f.dataset.slotRename),
        v = $("slotNameInput").value.trim();
      if (s && v) s.name = v.slice(0, NAME_MAX);
      editing = null;
      save();
      render();
      const btn = s && document.querySelector('[data-slot-pick="' + CSS.escape(s.id) + '"]');
      if (btn) btn.focus({ preventScroll: true });
      return;
    }
    if (f.id === "slotImport") {
      const v = $("slotImportInput").value.trim(),
        b = v && parseBuild(v);
      if (!b) {
        showToast("Не похоже на ссылку на билд", "err");
        return;
      }
      importing = false;
      const s = addSlot(v.replace(/^[^#]*#/, ""), "Из ссылки");
      if (!s) return;
      editing = s.id;
      render();
      const inp = $("slotNameInput");
      inp.focus();
      inp.select();
    }
  });
  /* Esc в поле названия или ссылки - отмена */
  box.addEventListener("keydown", e => {
    if (e.key !== "Escape" || !(editing || importing)) return;
    e.stopPropagation();
    editing = null;
    importing = false;
    render();
  });
  /* название не сохранили и ушли из поля - оставляем как было */
  box.addEventListener("focusout", e => {
    if (!editing || !e.target.matches("#slotNameInput")) return;
    setTimeout(() => {
      if (editing && !box.contains(document.activeElement)) {
        const s = slots.list.find(x => x.id === editing),
          v = $("slotNameInput") && $("slotNameInput").value.trim();
        if (s && v) s.name = v.slice(0, NAME_MAX);
        editing = null;
        save();
        render();
      }
    }, 0);
  });
  /* слоты поменяли в другой вкладке */
  window.addEventListener("storage", e => {
    if (e.key !== KEY) return;
    const mine = slots.active;
    slots = load();
    slots.active = slots.list.some(x => x.id === mine) ? mine : slots.active;
    render();
  });
}

init();
