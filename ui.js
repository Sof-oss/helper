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
    { key: "merc", label: "Наёмник", color: "#ffb74d", tint: "#0a0d13" },
    { key: "dolg", label: "Д.О.Л.Г", color: "#ff6b6f", tint: "#0a0b0f" },
    { key: "svoboda", label: "Свобода", color: "#9fdc9f", tint: "#070f0c" },
    { key: "science", label: "Учёные", color: "#54bfff", tint: "#050f16" },
    { key: "winx", label: "WINX", color: "#c9a6ff", tint: "#0a0813" }
  ];
  var THEME_KEY = "zoneTheme";
  var saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  var current = THEMES.some(function (t) { return t.key === saved; }) ? saved : "science";

  function applyTheme(key) {
    var t = THEMES.filter(function (x) { return x.key === key; })[0] || THEMES[3];
    current = t.key;
    d.documentElement.dataset.theme = t.key;
    var meta = d.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = d.createElement("meta"); meta.setAttribute("name", "theme-color"); d.head.appendChild(meta); }
    meta.setAttribute("content", t.tint);
    try { localStorage.setItem(THEME_KEY, t.key); } catch (e) {}
    var box = d.getElementById("themeSwitch");
    if (box) {
      Array.prototype.forEach.call(box.querySelectorAll("button"), function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.themeBtn === t.key));
      });
    }
  }

  /* --- переключатель тем в шапке --- */
  var header = d.querySelector(".header-inner");
  if (header && !d.getElementById("themeSwitch")) {
    var box = d.createElement("div");
    box.className = "theme-switch";
    box.id = "themeSwitch";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Цветовая тема");
    THEMES.forEach(function (t) {
      var b = d.createElement("button");
      b.type = "button";
      b.dataset.themeBtn = t.key;
      b.style.setProperty("--t", t.color);
      b.title = t.label;
      b.setAttribute("aria-label", "Тема: " + t.label);
      b.setAttribute("aria-pressed", String(t.key === current));
      box.appendChild(b);
    });
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-theme-btn]");
      if (b) applyTheme(b.dataset.themeBtn);
    });
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
