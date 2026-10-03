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

  /* symbol — значок группировки, tone — как выглядит палитра темы */
  var THEMES = [
    { key: "merc", label: "Наёмники", tone: "сталь и графит", color: "#5f8ac9", color2: "#9fb3c8", tint: "#070d18", symbol: '<path d="m5 9.5 7-4.2 7 4.2M5 14.5l7-4.2 7 4.2"/>' },
    { key: "dolg", label: "Долг", tone: "красный с золотом", color: "#d9483f", color2: "#d9b558", tint: "#120607", symbol: '<path d="M12 3.2 5.5 5.9v5.3c0 3.6 2.7 6.5 6.5 7.6 3.8-1.1 6.5-4 6.5-7.6V5.9z"/><path d="M12 8.4v6.2M9.4 11.2h5.2"/>' },
    { key: "svoboda", label: "Свобода", tone: "зелень и небо", color: "#4fb058", color2: "#5b9bd5", tint: "#06120a", symbol: '<path d="M6.5 21V3.6"/><path d="M6.5 4.6h10.8l-2.3 3.7 2.3 3.7H6.5z"/>' },
    { key: "science", label: "Учёные", tone: "лазурь и спираль", color: "#57c4f0", color2: "#e0574f", tint: "#04121c", symbol: '<circle cx="12" cy="12" r="2.1"/><ellipse cx="12" cy="12" rx="8.8" ry="3.8"/><ellipse cx="12" cy="12" rx="8.8" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="8.8" ry="3.8" transform="rotate(-60 12 12)"/>' },
    { key: "monolith", label: "Монолит", tone: "янтарь и фиолет", color: "#d9a52c", color2: "#b98ae0", tint: "#120d05", symbol: '<path d="M12 3 18.8 9.4 12 21 5.2 9.4z"/><path d="M5.2 9.4h13.6M12 3v18"/>' }
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
    if (!box) return;
    var tgl = d.getElementById("themeToggle");
    if (tgl) {
      tgl.style.setProperty("--t", t.color);
      tgl.style.setProperty("--t2", t.color2 || t.color);
      var badge = tgl.querySelector(".tp-badge svg");
      if (badge) badge.innerHTML = t.symbol;
      var name = d.getElementById("themeCurrent");
      if (name) name.textContent = t.label;
      tgl.setAttribute("title", "Тема: " + t.label);
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
      + '<span class="tp-name" id="themeCurrent"></span>'
      + '<svg class="tp-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    box.appendChild(toggle);

    var list = d.createElement("div");
    list.className = "theme-list";
    list.id = "themeList";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Темы интерфейса");
    list.innerHTML = '<div class="tl-head"><i></i>Тема интерфейса</div>';
    THEMES.forEach(function (t) {
      var b = d.createElement("button");
      b.type = "button";
      b.className = "theme-item";
      b.dataset.themeBtn = t.key;
      b.setAttribute("role", "option");
      b.style.setProperty("--t", t.color);
      b.style.setProperty("--t2", t.color2 || t.color);
      b.innerHTML = '<span class="ti-badge"><svg viewBox="0 0 24 24" aria-hidden="true">' + t.symbol + "</svg></span>"
        + '<span class="ti-text"><b>' + t.label + "</b><small>" + t.tone + "</small></span>";
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
      if (b) { applyTheme(b.dataset.themeBtn); setOpen(false); }
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
