/* Тур по сайту для новичков. Подключён на всех страницах.
   — Каждый шаг привязан к странице (page) и к элементам на ней (sel — селектор или список селекторов):
     тур сам переходит на нужную страницу, прокручивает к элементу и подсвечивает его, остальное затемняется.
     Если элемента нет (другая вёрстка, скрыт на телефоне), шаг просто показывается без подсветки.
   — Номер текущего шага живёт в sessionStorage (zoneTourStep), поэтому тур переживает переходы между страницами.
   — До первого прохождения тур запускается кнопкой на главной (#tourStart). После — окно сворачивается в значок «?»
     в шапке (флаг zoneTourSeen в localStorage), оттуда тур можно пройти снова. Ссылка /#tour сразу запускает тур.
   Тексты и подсвечиваемые элементы правятся в STEPS. Цвет раздела — как у его карточки на главной. */
(function () {
  "use strict";
  if (typeof location === "undefined" || typeof window === "undefined") return;  /* пререндер в build.js — тур там не нужен */
  var d = document, SEEN = "zoneTourSeen", STEP = "zoneTourStep";
  var G = {
    home: { name: "Знакомство", color: "#e0b83a" },
    calc: { name: "Калькулятор урона", color: "#54bfff" },
    top: { name: "Топ-100", color: "#9fdc9f" },
    info: { name: "Информация", color: "#ffb74d" },
    guides: { name: "Гайды", color: "#c9a6ff" },
    end: { name: "Напоследок", color: "#e0b83a" }
  };
  var STEPS = [
    { g: "home", page: "/", title: "Добро пожаловать в Зону",
      text: "Это неофициальный помощник для игры «Сердце Зоны». Пройдёмся по разделам.",
      list: ["Регистрация не нужна — всё работает сразу", "Данные игроков регулярно обновляются"] },
    { g: "home", page: "/", sel: ".home-grid", title: "Четыре раздела",
      text: "Всё главное — в этих карточках и в меню сайта. Начнём с калькулятора." },

    { g: "calc", page: "/calculator", sel: "#paidCards", title: "Урон каждого оружия",
      text: "Посчитайте, сколько урона даёт каждое оружие при любых параметрах. Цифры пересчитываются сразу, как только вы что-то меняете." },
    { g: "calc", page: "/calculator", sel: "#level", title: "Уровень персонажа",
      text: "Укажите уровень — от него зависит прибавка к урону." },
    { g: "calc", page: "/calculator", sel: ".equipment-section", title: "Комплекты и вещи",
      text: "Отметьте снаряжение, которое у вас есть. Кнопка «Бонусы» покажет, что даёт каждый предмет, а также суммарный бонус от всех вещей в игре." },
    { g: "calc", page: "/calculator", sel: "#openTalents", title: "Древо талантов",
      text: "Распределите очки талантов и посмотрите как меняется урон." },
    { g: "calc", page: "/calculator", sel: "#openTokens", title: "Расчёт по жетонам",
      text: "Считает урон на указанное количество жетонов по текущему уровню персонажа, снаряжению и талантам — и подскажет, каким оружием их выгоднее тратить." },
    { g: "calc", page: "/calculator", sel: ["#shareBuild", "#openCompare"], title: "Поделиться и сравнить",
      text: "Скопируйте ссылку на свой билд или сравните его с билдом друга." },

    { g: "top", page: "/top100", sel: "#top100Tabs", title: "Семь рейтингов",
      text: "Лучшие сталкеры по репутации, боссам, тайникам, талантам, коллекциям, экспедициям и защите лагеря." },
    { g: "top", page: "/top100", sel: [".t100-search", "#pcOpenSearch"], title: "Поиск по нику",
      text: "Найдите себя или друга в таблице. «Карточка игрока» найдёт любого сталкера, даже если его нет в сотне." },
    { g: "top", page: "/top100", sel: ".t100-player", title: "Личная карточка",
      text: "Нажмите на ник — откроется карточка игрока: все показатели, места в рейтингах и оформление его группировки. Ссылкой на неё можно поделиться." },
    { g: "top", page: "/top100", sel: "#top100Period", title: "Динамика за период",
      text: "Выберите период — и увидите, кто вырос и на сколько мест поднялся." },

    { g: "info", page: "/info", sel: ["#infoSections", "#infoTabs"], title: "Справочник сталкера",
      text: "Две вкладки: прогресс по уровням и задания." },
    { g: "info", page: "/info", sel: "#infoGroups", title: "Таблицы по уровням",
      text: "Сколько стоит каждое улучшение таланта, опыт ПДА и персонажа по уровням — и сколько вам осталось до следующего." },
    { g: "info", page: "/info", sel: ["#infoSections .top100-tab:nth-child(2)", "#infoTabs .top100-tab:nth-child(2)"], title: "Награды за задания",
      text: "Во вкладке «Задания» — награды за задания по всем локациям и калькулятор энергии." },

    { g: "guides", page: "/guides", sel: "#guidesList", title: "Гайды игроков",
      text: "Советы от опытных игроков." },
    { g: "guides", page: "/guides", sel: "#guideSendOpen", title: "Отправить свой гайд",
      text: "Знаете фишку? Напишите и отправьте свой гайд прямо на сайте." },

    { g: "end", page: "/", sel: "#themeToggle", title: "Ваша группировка",
      text: "Перекрасьте сайт в цвета своей группировки: Долг, Свобода, Монолит, Учёные, Наёмники, «Рассвет» или Вольные сталкеры. Выбор запоминается на этом устройстве." },
    { g: "end", page: "/", sel: "#homeNews", title: "Что нового",
      text: "Все обновления сайта — в блоке «Что нового» на главной. А тур можно пройти снова через значок «?» в шапке." }
  ];

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function here() { var p = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/").replace(/\/+$/, ""); return p || "/"; }
  function reduced() { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; }
  var mobile = function () { return innerWidth <= 760; };

  /* ---------- значок «?» в шапке (появляется после первого прохождения) ---------- */
  var help = null;
  function makeHelp() {
    if (help) return help;
    var inner = d.querySelector(".header-inner");
    if (!inner) return null;
    help = d.createElement("button");
    help.type = "button";
    help.className = "tour-help";
    help.setAttribute("aria-label", "Тур по сайту");
    help.title = "Тур по сайту";
    help.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.2 9.3a2.9 2.9 0 1 1 4.3 2.5c-.9.5-1.5 1.1-1.5 2.1v.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.2" fill="currentColor"/></svg>';
    var theme = d.getElementById("themeSwitch");
    if (theme && theme.parentNode === inner) inner.insertBefore(help, theme); else inner.appendChild(help);
    help.addEventListener("click", function () { start(); });
    return help;
  }
  var startBtn = d.getElementById("tourStart");
  function syncEntry() {
    var seen = ls(SEEN) === "1";
    if (startBtn) startBtn.hidden = seen;
    if (seen) makeHelp();
  }

  /* ---------- подсветка и окно шага ---------- */
  var spot, panel, i = -1, targets = [], raf = 0, closing = false;
  function build() {
    if (panel) return;
    spot = d.createElement("div");
    spot.className = "tour-spot";
    spot.setAttribute("aria-hidden", "true");
    panel = d.createElement("div");
    panel.className = "tour-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-live", "polite");
    panel.setAttribute("aria-labelledby", "tourTitle");
    d.body.appendChild(spot);
    d.body.appendChild(panel);
    panel.addEventListener("click", function (e) {
      var a = e.target.closest("[data-tour]");
      if (!a) return;
      var k = a.getAttribute("data-tour");
      if (k === "close") finish();
      else if (k === "prev") go(i - 1);
      else if (k === "next") { if (i < STEPS.length - 1) go(i + 1); else finish(); }
    });
    d.addEventListener("keydown", onKey, true);
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
  }
  function onKey(e) {
    if (!panel || closing) return;
    var t = e.target, typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(); }
    else if (!typing && e.key === "ArrowRight") { e.preventDefault(); if (i < STEPS.length - 1) go(i + 1); else finish(); }
    else if (!typing && e.key === "ArrowLeft" && i > 0) { e.preventDefault(); go(i - 1); }
  }
  function queue() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; place(); }); }
  function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function findTargets(s) {
    var list = [].concat(s.sel || []);
    return list.map(function (q) { return d.querySelector(q); }).filter(function (el) { return el && visible(el); });
  }
  function union() {
    var r = null;
    targets.forEach(function (el) {
      var b = el.getBoundingClientRect();
      if (!r) r = { top: b.top, left: b.left, right: b.right, bottom: b.bottom };
      else { r.top = Math.min(r.top, b.top); r.left = Math.min(r.left, b.left); r.right = Math.max(r.right, b.right); r.bottom = Math.max(r.bottom, b.bottom); }
    });
    return r;
  }
  function headerH() { var h = d.querySelector(".site-header"); if (!h) return 0; var b = h.getBoundingClientRect(); return b.bottom > 0 ? b.bottom : 0; }
  function bottomBar() { var t = d.querySelector(".tabbar"); return t && visible(t) ? t.getBoundingClientRect().height : 0; }

  function place() {
    if (!panel || closing) return;
    var r = union(), pad = 8, vw = innerWidth, vh = innerHeight;
    if (!r) {
      spot.classList.remove("on");
      panel.classList.add("center");
      panel.style.top = panel.style.left = "";
      return;
    }
    var s = { top: Math.max(r.top - pad, 4), left: Math.max(r.left - pad, 4), right: Math.min(r.right + pad, vw - 4), bottom: Math.min(r.bottom + pad, vh - 4) };
    if (s.bottom <= s.top) s.bottom = s.top + 1;
    spot.style.cssText = "top:" + s.top + "px;left:" + s.left + "px;width:" + (s.right - s.left) + "px;height:" + (s.bottom - s.top) + "px";
    spot.classList.add("on");
    panel.classList.remove("center");
    if (mobile()) { panel.style.top = panel.style.left = ""; return; }  /* на телефоне окно всегда снизу */
    var pw = panel.offsetWidth, ph = panel.offsetHeight, gap = 16, top;
    if (vh - s.bottom >= ph + gap + 12) top = s.bottom + gap;
    else if (s.top - headerH() >= ph + gap + 12) top = s.top - gap - ph;
    else top = vh - ph - 20;
    var left = Math.min(Math.max(s.left, 16), vw - pw - 16);
    if (top === vh - ph - 20) left = vw - pw - 20;   /* нет места ни сверху, ни снизу — в правый нижний угол */
    panel.style.top = top + "px";
    panel.style.left = left + "px";
  }
  function scrollToTarget() {
    var r = union();
    if (!r) return;
    var vh = innerHeight, hh = headerH(), y, h = r.bottom - r.top;
    var room = mobile() ? vh - (panel.offsetHeight + bottomBar() + 24) : vh;
    if (mobile()) y = scrollY + r.top - Math.max(hh, 12) - 12;
    else if (h > room * 0.5) y = scrollY + r.top - hh - 24;
    else y = scrollY + r.top - (room - h) / 2;
    if (mobile() && h < room - 40) y = scrollY + r.top - Math.max(12, (room - h) / 2);
    scrollTo({ top: Math.max(0, y), behavior: reduced() ? "auto" : "smooth" });
  }

  function render() {
    var s = STEPS[i], g = G[s.g], last = i === STEPS.length - 1;
    var inG = STEPS.filter(function (x) { return x.g === s.g; }), k = inG.indexOf(s) + 1;
    panel.style.setProperty("--tour-ac", g.color);
    spot.style.setProperty("--tour-ac", g.color);
    panel.innerHTML =
      '<div class="tp-top"><span class="tp-group"><i></i>' + esc(g.name) + (inG.length > 1 ? ' · ' + k + '/' + inG.length : '') + '</span>' +
      '<button type="button" class="tp-close" data-tour="close" aria-label="Закрыть тур"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button></div>' +
      '<h2 id="tourTitle">' + esc(s.title) + '</h2>' +
      '<p>' + esc(s.text) + '</p>' +
      (s.list ? '<ul>' + s.list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>' : "") +
      '<div class="tp-bar" aria-hidden="true"><i style="width:' + Math.round((i + 1) / STEPS.length * 100) + '%"></i></div>' +
      '<div class="tp-foot"><small>Шаг ' + (i + 1) + ' из ' + STEPS.length + '</small><div class="tp-nav">' +
      '<button type="button" class="tp-btn ghost" data-tour="prev"' + (i === 0 ? ' disabled' : '') + '>Назад</button>' +
      '<button type="button" class="tp-btn" data-tour="next">' + (last ? "Готово" : (STEPS[i + 1].page !== s.page ? "Далее: " + G[STEPS[i + 1].g].name : "Далее")) + '</button></div></div>';
    panel.classList.remove("swap"); void panel.offsetWidth; panel.classList.add("swap");
  }
  function waitTargets(s, cb) {
    var t0 = Date.now();
    (function tick() {
      var found = findTargets(s);
      if (found.length || !s.sel || Date.now() - t0 > 2500) return cb(found);
      setTimeout(tick, 120);
    })();
  }
  function show(n) {
    build();
    i = n;
    ss(STEP, String(i));
    var s = STEPS[i];
    d.documentElement.classList.add("tour-on");
    targets = [];
    render();
    place();
    waitTargets(s, function (found) {
      if (i !== n) return;
      targets = found;
      place();
      scrollToTarget();
      setTimeout(place, 450);
      var btn = panel.querySelector('[data-tour="next"]');
      if (btn) btn.focus({ preventScroll: true });
    });
  }
  function go(n) {
    if (n < 0 || n >= STEPS.length) return;
    if (STEPS[n].page !== here()) {        /* шаг на другой странице: запоминаем и переходим */
      ss(STEP, String(n));
      panel && panel.classList.add("leaving");
      location.href = STEPS[n].page;
      return;
    }
    show(n);
  }
  function start() {
    if (STEPS[0].page !== here()) { ss(STEP, "0"); location.href = STEPS[0].page; return; }
    show(0);
  }
  function teardown() {
    d.documentElement.classList.remove("tour-on");
    removeEventListener("scroll", queue);
    removeEventListener("resize", queue);
    d.removeEventListener("keydown", onKey, true);
    if (spot) spot.remove();
    if (panel) panel.remove();
    spot = panel = null; targets = []; i = -1; closing = false;
  }
  /* завершение («Готово», крестик, Esc): окно сворачивается в значок «?» в шапке */
  function finish() {
    if (!panel || closing) return;
    closing = true;
    ss(STEP, null);
    var first = ls(SEEN) !== "1";
    ls(SEEN, "1");
    spot.classList.remove("on");
    if (startBtn) startBtn.hidden = true;
    var h = makeHelp();
    if (!h) return teardown();
    if (first) h.classList.add("pending");
    var fly = function () {
      var a = panel.getBoundingClientRect(), b = h.getBoundingClientRect();
      if (reduced() || b.bottom <= 0) { teardown(); h.classList.remove("pending"); h.classList.add("pop"); return; }
      panel.style.transformOrigin = "0 0";
      panel.classList.add("fly");
      panel.style.transform = "translate(" + (b.left - a.left) + "px," + (b.top - a.top) + "px) scale(" + (b.width / a.width) + "," + (b.height / a.height) + ")";
      var done = false, end = function () {
        if (done) return; done = true;
        teardown();
        h.classList.remove("pending");
        h.classList.remove("pop"); void h.offsetWidth; h.classList.add("pop");
        h.focus({ preventScroll: true });
      };
      panel.addEventListener("transitionend", end);
      setTimeout(end, 900);
    };
    /* шапка уезжает при прокрутке — сперва поднимаемся к ней */
    if (h.getBoundingClientRect().top < 0) { scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }); setTimeout(fly, reduced() ? 0 : 550); }
    else fly();
  }

  /* ---------- запуск ---------- */
  syncEntry();
  if (startBtn) startBtn.addEventListener("click", start);
  var saved = ss(STEP);
  if (saved !== null && saved !== undefined) {
    var n = +saved;
    if (STEPS[n] && STEPS[n].page === here()) setTimeout(function () { show(n); }, 250);
    else ss(STEP, null);     /* игрок ушёл в другой раздел сам — тур прерывается без сообщений */
  } else if (location.hash === "#tour") {
    history.replaceState(null, "", location.pathname + location.search);
    start();
  }
})();
