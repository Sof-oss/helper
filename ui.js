/* ============================================================================
   Общий интерфейсный скрипт: темы, нижнее меню на телефоне, тень шапки,
   прокрутка цифр и помощник для View Transitions.

   ВАЖНО: этот файл запускается и сборкой (build.js прогоняет скрипты страницы
   в урезанной заглушке DOM). Поэтому всё, что требует настоящего документа,
   проверяется на наличие: без браузера скрипт просто ничего не делает.
   ============================================================================ */

/* Помощник переходов. Объявлен всегда: им пользуются info.js, top100.js, app.js */
window.__vt = function (fn) {
  var d = document;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!d.startViewTransition || reduce) return fn();
  var done = false;
  try {
    d.startViewTransition(function () { done = true; fn(); });
  } catch (e) { if (!done) fn(); }
};

/* Прокрутка числа: старое значение «докручивается» до нового */
window.__roll = function (el, text) {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var num = function (s) { return Number(String(s).replace(/[^\d-]/g, "")); };
  var to = num(text), from = num(el.textContent);
  if (reduce || typeof requestAnimationFrame !== "function" || !isFinite(to) || !isFinite(from) || to === from) {
    el.textContent = text;
    return;
  }
  if (el.__rollRaf) cancelAnimationFrame(el.__rollRaf);
  var t0 = null, dur = 320;
  var step = function (t) {
    if (t0 === null) t0 = t;
    var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * e).toLocaleString("ru-RU");
    el.__rollRaf = k < 1 ? requestAnimationFrame(step) : 0;
    if (k >= 1) el.textContent = text;
  };
  el.__rollRaf = requestAnimationFrame(step);
};

/* Дальше — только настоящий браузер */
(function () {
  var d = document;
  if (!d.documentElement || typeof d.createElement !== "function" || !d.body) return;

  var THEMES = [
    { key: "merc", label: "Наёмники", color: "#5f8ac9", color2: "#9fb3c8", tint: "#070d18" },
    { key: "dolg", label: "Долг", color: "#d9483f", color2: "#d9b558", tint: "#120607" },
    { key: "svoboda", label: "Свобода", color: "#4fb058", color2: "#5b9bd5", tint: "#06120a" },
    { key: "science", label: "Учёные", color: "#57c4f0", color2: "#e0574f", tint: "#04121c" },
    { key: "monolith", label: "Монолит", color: "#d9a52c", color2: "#b98ae0", tint: "#120d05" }
  ];
  /* Значки группировок: плоские силуэты 24×24, красятся цветом темы через fill.
     Наёмники — череп, Долг — щит с мечом, Свобода — клевер, Учёные — колба, Монолит — кристалл */
  var GLYPHS = {
    merc: '<path fill-rule="evenodd" d="M12 2.5c-4.7 0-8 3.2-8 7.6 0 2.6 1.1 4.6 3 5.8V19c0 .8.7 1.5 1.5 1.5h7c.8 0 1.5-.7 1.5-1.5v-3.1c1.9-1.2 3-3.2 3-5.8 0-4.4-3.3-7.6-8-7.6zM6.800000000000001 10.6a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0 -4.2 0zM13 10.6a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0 -4.2 0zM12 13.3l1.2 2.1h-2.4zM10.3 17.6h1.1v2.9h-1.1zM12.6 17.6h1.1v2.9h-1.1z"/>',
    dolg: '<path fill-rule="evenodd" d="M12 2 20 5v6.5c0 5-3.4 8.8-8 10.5-4.6-1.7-8-5.5-8-10.5V5zM11.1 5.6 12 4.6l.9 1v8.6h2.3v1.6h-2.3v2.6h-1.8v-2.6H8.8v-1.6h2.3z"/>',
    svoboda: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="7" r="4.2"/><circle cx="17" cy="12" r="4.2"/><circle cx="12" cy="17" r="4.2"/><circle cx="7" cy="12" r="4.2"/><path d="M14.6 14.4c1.8 2.4 3.6 4.4 6.4 6.6l-.9 1c-2.9-2.2-4.8-4.4-6.6-6.9z"/>',
    science: '<path fill-rule="evenodd" d="M8.6 2.4h6.8v1.9h-1.2v4.5l5.5 9.3c1 1.6-.2 3.5-2 3.5H6.3c-1.8 0-3-1.9-2-3.5l5.5-9.3V4.3H8.6zM11.6 4.3h.8v5.1l2.4 4H9.2l2.4-4z"/>',
    monolith: '<path fill-rule="evenodd" d="M12 1.6 17.2 7v10.2L12 22.4 6.8 17.2V7zM11.4 5.2h1.2v13.6h-1.2z"/>'
  };
  function emblem(key) { return GLYPHS[key] || ""; }
  var THEME_KEY = "zoneTheme";
  var saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  var current = THEMES.some(function (t) { return t.key === saved; }) ? saved : "merc";

  function applyTheme(key) {
    var t = THEMES.filter(function (x) { return x.key === key; })[0] || THEMES[0];
    current = t.key;
    d.documentElement.dataset.theme = t.key;
    var meta = d.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = d.createElement("meta"); meta.setAttribute("name", "theme-color"); d.head.appendChild(meta); }
    meta.setAttribute("content", t.tint);
    try { localStorage.setItem(THEME_KEY, t.key); } catch (e) {}
    var box = d.getElementById("themeSwitch");
    if (!box) return;
    var tgl = d.getElementById("themeToggle");
    if (tgl) {
      tgl.style.setProperty("--t", t.color);
      tgl.style.setProperty("--t2", t.color2 || t.color);
      var badge = tgl.querySelector(".tp-badge svg");
      if (badge) badge.innerHTML = emblem(t.key);
      var nm = tgl.querySelector(".tp-name");
      if (nm) nm.textContent = t.label;
      tgl.setAttribute("title", "Тема: " + t.label);
      tgl.setAttribute("aria-label", "Тема интерфейса: " + t.label + ". Нажмите, чтобы выбрать другую");
    }
    Array.prototype.forEach.call(box.querySelectorAll("[data-theme-btn]"), function (b) {
      var on = b.dataset.themeBtn === t.key;
      b.setAttribute("aria-selected", String(on));
      b.setAttribute("aria-pressed", String(on));
    });
  }

  /* --- переключатель тем в шапке: свёрнутый значок группировки, по клику — список тем --- */
  var header = d.querySelector(".header-inner");
  if (header && !d.getElementById("themeSwitch")) {
    var box = d.createElement("div");
    box.className = "theme-pick";
    box.id = "themeSwitch";

    var toggle = d.createElement("button");
    toggle.type = "button";
    toggle.className = "theme-pick-toggle";
    toggle.id = "themeToggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "themeList");
    toggle.setAttribute("aria-label", "Выбрать тему интерфейса");
    toggle.innerHTML = '<span class="tp-badge"><svg viewBox="0 0 24 24" aria-hidden="true"></svg></span>'
      + '<span class="tp-text"><small>Группировка</small><b class="tp-name"></b></span>'
      + '<svg class="tp-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    box.appendChild(toggle);

    var list = d.createElement("div");
    list.className = "theme-list";
    list.id = "themeList";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Темы интерфейса");
    list.innerHTML = '<div class="tl-head"><i></i>Выбор группировки<span>5</span></div>';
    THEMES.forEach(function (t) {
      var b = d.createElement("button");
      b.type = "button";
      b.className = "theme-item";
      b.dataset.themeBtn = t.key;
      b.setAttribute("role", "option");
      b.style.setProperty("--t", t.color);
      b.style.setProperty("--t2", t.color2 || t.color);
      b.innerHTML = '<span class="ti-thumb" aria-hidden="true"></span><span class="ti-badge"><svg viewBox="0 0 24 24" aria-hidden="true">' + emblem(t.key) + "</svg></span>"
        + '<span class="ti-text"><b>' + t.label + "</b></span>"
        + '<svg class="ti-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>';
      list.appendChild(b);
    });
    box.appendChild(list);

    var setOpen = function (open) {
      box.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", function () { setOpen(!box.classList.contains("open")); });
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-theme-btn]");
      if (b) {
        var key = b.dataset.themeBtn;
        setOpen(false);
        if (key !== current) window.__vt(function () { applyTheme(key); });
      }
    });
    d.addEventListener("click", function (e) { if (!box.contains(e.target)) setOpen(false); });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
    header.appendChild(box);
  }
  applyTheme(current);

  /* --- тень шапки при прокрутке --- */
  var siteHeader = d.querySelector(".site-header");
  if (siteHeader) {
    var onScroll = function () { siteHeader.classList.toggle("scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* --- нижнее меню на телефоне: повторяет верхнее --- */
  var SHORT = { "Калькулятор урона": "Калькулятор", "Информация": "Инфо" };
  var nav = d.querySelector(".main-nav");
  if (nav && !d.querySelector(".tabbar")) {
    var bar = d.createElement("nav");
    bar.className = "tabbar";
    bar.setAttribute("aria-label", "Разделы");
    Array.prototype.forEach.call(nav.querySelectorAll("a"), function (a) {
      var link = d.createElement("a");
      link.href = a.getAttribute("href");
      if (a.classList.contains("active")) { link.className = "active"; link.setAttribute("aria-current", "page"); }
      var icon = a.querySelector("svg");
      if (icon) link.appendChild(icon.cloneNode(true));
      var label = a.textContent.trim();
      var span = d.createElement("span");
      span.textContent = SHORT[label] || label;
      link.appendChild(span);
      bar.appendChild(link);
    });
    d.body.appendChild(bar);
  }
})();
