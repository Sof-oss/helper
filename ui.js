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
  /* Эмблемы группировок (полноцветные шевроны 64×64). § заменяется на уникальный суффикс,
     чтобы id градиентов не совпадали у значка на кнопке и в списке */
  var EMBLEMS = {
    merc: '<defs><linearGradient id="mr§" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8eef5"/><stop offset=".5" stop-color="#7d8a99"/><stop offset="1" stop-color="#2b333d"/></linearGradient><radialGradient id="mf§" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="#3f6fae"/><stop offset=".7" stop-color="#1b3557"/><stop offset="1" stop-color="#0c1a2c"/></radialGradient><linearGradient id="mb§" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#b9c4cf"/><stop offset="1" stop-color="#5d6873"/></linearGradient><linearGradient id="ms§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfaf4"/><stop offset="1" stop-color="#b9b5a6"/></linearGradient><linearGradient id="gl§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".45" stop-color="#fff" stop-opacity=".06"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path d="M32 2 58 17v30L32 62 6 47V17z" fill="#0a0d11"/><path d="M32 3.6 56.6 17.8v28.4L32 60.4 7.4 46.2V17.8z" fill="url(#mr§)"/><path d="M32 7.5 53.2 19.8v24.4L32 56.5 10.8 44.2V19.8z" fill="url(#mf§)"/><g stroke="#0a0d11" stroke-width="1.1" stroke-linejoin="round"><g id="mk§"><path d="M13 13c5.2 1.6 11 5.9 17.6 12.2l-4.4 4.4C19.9 23 15.4 17.6 13 13z" fill="url(#mb§)"/><path d="M15.6 15.6 27.8 27.8" stroke="#6c7884" stroke-width=".8" fill="none"/><path d="m23.6 30.4 6.8-6.8 2.6 2.6-6.8 6.8z" fill="#c9a24a"/><path d="m29.2 31.2 2.4-2.4 15.6 15.6a1.7 1.7 0 0 1-2.4 2.4z" fill="#3b2b1d"/><circle cx="47.6" cy="47.6" r="2.4" fill="#c9a24a"/></g><use href="#mk§" transform="matrix(-1 0 0 1 64 0)"/></g><path d="M32 23.5c-6.3 0-10.4 4.1-10.4 9.6 0 3.3 1.5 5.8 3.9 7.3v4.1h2.6v-2.6h2.3v2.6h3.2v-2.6h2.3v2.6h2.6v-4.1c2.4-1.5 3.9-4 3.9-7.3 0-5.5-4.1-9.6-10.4-9.6z" fill="url(#ms§)" stroke="#0a0d11" stroke-width="1.2" stroke-linejoin="round"/><path d="M24.6 33.2c0-1.9 1.5-3 3.4-3s3.2 1.4 2.8 3.2c-.4 1.7-1.9 2.5-3.5 2.4-1.5-.1-2.7-1-2.7-2.6zM39.4 33.2c0-1.9-1.5-3-3.4-3s-3.2 1.4-2.8 3.2c.4 1.7 1.9 2.5 3.5 2.4 1.5-.1 2.7-1 2.7-2.6z" fill="#101823"/><path d="m32 35.8 1.5 2.6h-3z" fill="#101823"/><path d="M32 7.5 53.2 19.8v24.4L32 56.5 10.8 44.2V19.8z" fill="url(#gl§)"/>',
    dolg: '<defs><linearGradient id="dr§" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".5" stop-color="#d9a63a"/><stop offset="1" stop-color="#6e4a12"/></linearGradient><linearGradient id="df§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2463c"/><stop offset=".6" stop-color="#9e1d1b"/><stop offset="1" stop-color="#520c0d"/></linearGradient><linearGradient id="dg§" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6cf"/><stop offset=".5" stop-color="#e7b648"/><stop offset="1" stop-color="#8a5a12"/></linearGradient><linearGradient id="gl§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".45" stop-color="#fff" stop-opacity=".06"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path d="M32 2.5 57 9v20.5C57 45 46.5 55.5 32 61.5 17.5 55.5 7 45 7 29.5V9z" fill="#0d0706"/><path d="M32 4.2 55.4 10.3v19.2C55.4 44 45.6 54 32 59.7 18.4 54 8.6 44 8.6 29.5V10.3z" fill="url(#dr§)"/><path d="M32 7.6 52.4 12.8v16.9c0 12.7-8.4 21.4-20.4 26.5-12-5.1-20.4-13.8-20.4-26.5V12.8z" fill="url(#df§)"/><path d="M11.6 12.8 52.4 12.8v6.5H11.6z" fill="#000" opacity=".22"/><g fill="url(#dg§)" stroke="#3a0a08" stroke-width="1.1" stroke-linejoin="round"><path d="m32 11.5 3 4v20.5h-6V15.5z"/><path d="M22.5 35.5h19v3.6h-19z"/><path d="M30 39.1h4v7.6h-4z"/><circle cx="32" cy="49" r="2.6"/><path d="m19.5 21 1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4zM44.5 21l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z"/></g><path d="M32 12.6v22.6" stroke="#fff8d8" stroke-width=".9" opacity=".7"/><path d="M32 7.6 52.4 12.8v16.9c0 12.7-8.4 21.4-20.4 26.5-12-5.1-20.4-13.8-20.4-26.5V12.8z" fill="url(#gl§)"/>',
    svoboda: '<defs><linearGradient id="sr§" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3f7d6"/><stop offset=".5" stop-color="#9aa86a"/><stop offset="1" stop-color="#3c4524"/></linearGradient><linearGradient id="sk§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5aa9e6"/><stop offset=".58" stop-color="#bfe0f2"/><stop offset=".58" stop-color="#5fbf4a"/><stop offset="1" stop-color="#1f6a22"/></linearGradient><radialGradient id="su§" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff7c2"/><stop offset=".6" stop-color="#ffd25a"/><stop offset="1" stop-color="#ffb52e" stop-opacity="0"/></radialGradient><linearGradient id="sb§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d7e4ea"/></linearGradient><clipPath id="sc§"><path d="M32 8a24 24 0 1 1 0 48 24 24 0 0 1 0-48z"/></clipPath><linearGradient id="gl§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".45" stop-color="#fff" stop-opacity=".06"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><circle cx="32" cy="32" r="30" fill="#0a0f08"/><circle cx="32" cy="32" r="28.4" fill="url(#sr§)"/><path d="M32 8a24 24 0 1 1 0 48 24 24 0 0 1 0-48z" fill="url(#sk§)"/><g clip-path="url(#sc§)"><circle cx="32" cy="34.5" r="12" fill="url(#su§)"/><path d="M6 41.5c7-2.6 13-3 19-1.4s12 2.4 18 .4 9-2 15 .6V58H6z" fill="#2f8f2c"/><path d="M6 46c8-2.2 15-1.6 22 .6s14 2.2 20-.2 8-1.6 10-1V58H6z" fill="#1c5e1d"/></g><path d="M12.5 27.5c5.6-4.3 11.6-5 16.4-1.6 1.5 1 2.4 2.3 3.1 3.6.7-1.3 1.6-2.6 3.1-3.6 4.8-3.4 10.8-2.7 16.4 1.6-5.3-1.2-9.6-.4-12.6 2.2-2.2 1.9-3.6 4.4-4.4 7.4l-2.5 2.2-2.5-2.2c-.8-3-2.2-5.5-4.4-7.4-3-2.6-7.3-3.4-12.6-2.2z" fill="url(#sb§)" stroke="#16340f" stroke-width="1.1" stroke-linejoin="round"/><path d="M32 8a24 24 0 1 1 0 48 24 24 0 0 1 0-48z" fill="url(#gl§)"/>',
    science: '<defs><linearGradient id="cr§" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#9fb4c2"/><stop offset="1" stop-color="#3a4a56"/></linearGradient><radialGradient id="cf§" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="#bff0ff"/><stop offset=".35" stop-color="#3fb6ea"/><stop offset=".8" stop-color="#0b5a8a"/><stop offset="1" stop-color="#05304d"/></radialGradient><radialGradient id="cn§" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#ffd2c9"/><stop offset=".45" stop-color="#ef4b3f"/><stop offset="1" stop-color="#7e1410"/></radialGradient><linearGradient id="gl§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".45" stop-color="#fff" stop-opacity=".06"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><circle cx="32" cy="32" r="30" fill="#05101a"/><circle cx="32" cy="32" r="28.4" fill="url(#cr§)"/><circle cx="32" cy="32" r="24" fill="url(#cf§)"/><circle cx="32" cy="32" r="24" fill="none" stroke="#04263d" stroke-width="1.2"/><g fill="none" stroke-linecap="round"><g stroke="#03243a" stroke-width="4.6" opacity=".55"><ellipse cx="32" cy="32" rx="18" ry="7"/><ellipse cx="32" cy="32" rx="18" ry="7" transform="rotate(60 32 32)"/><ellipse cx="32" cy="32" rx="18" ry="7" transform="rotate(-60 32 32)"/></g><g stroke="#f4fcff" stroke-width="2.4"><ellipse cx="32" cy="32" rx="18" ry="7"/><ellipse cx="32" cy="32" rx="18" ry="7" transform="rotate(60 32 32)"/><ellipse cx="32" cy="32" rx="18" ry="7" transform="rotate(-60 32 32)"/></g></g><circle cx="32" cy="32" r="5.4" fill="url(#cn§)" stroke="#3b0806" stroke-width="1"/><circle cx="50" cy="32" r="2.2" fill="#fff"/><circle cx="23" cy="16.4" r="2.2" fill="#fff"/><circle cx="23" cy="47.6" r="2.2" fill="#fff"/><path d="M32 8a24 24 0 1 1 0 48 24 24 0 0 1 0-48z" fill="url(#gl§)"/>',
    monolith: '<defs><linearGradient id="or§" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0bf"/><stop offset=".5" stop-color="#d6a137"/><stop offset="1" stop-color="#5b3a0b"/></linearGradient><radialGradient id="of§" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#c79bff"/><stop offset=".35" stop-color="#6a2fb0"/><stop offset=".8" stop-color="#1e0b36"/><stop offset="1" stop-color="#0c0516"/></radialGradient><linearGradient id="os§" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5d5868"/><stop offset=".45" stop-color="#2c2834"/><stop offset=".46" stop-color="#18151d"/><stop offset="1" stop-color="#0d0b10"/></linearGradient><linearGradient id="oc§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#ffab2e"/></linearGradient><linearGradient id="gl§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".45" stop-color="#fff" stop-opacity=".06"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path d="M32 1.5 62.5 32 32 62.5 1.5 32z" fill="#0b0705"/><path d="M32 3.6 60.4 32 32 60.4 3.6 32z" fill="url(#or§)"/><path d="M32 7.2 56.8 32 32 56.8 7.2 32z" fill="url(#of§)"/><g stroke="#e9c8ff" stroke-width="1" opacity=".55" stroke-linecap="round"><path d="M32 13v-3M22 18l-2-2M42 18l2-2M17 30h-3M47 30h3"/></g><path d="M26 47.5V20.5L32 13l6 7.5v27z" fill="url(#os§)" stroke="#050407" stroke-width="1.2" stroke-linejoin="round"/><path d="m31.6 17-1.8 6.4 2.6 3.2-2.4 6 2.2 3.4-1.4 5.6M32.4 26.6l3.2 2.4M30.1 33l-2.6 1.8" fill="none" stroke="url(#oc§)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.5 47.5h25" stroke="#0a0710" stroke-width="3.2" stroke-linecap="round"/><path d="M21 47h22" stroke="#7a6a90" stroke-width="1" stroke-linecap="round" opacity=".7"/><path d="M32 7.2 56.8 32 32 56.8 7.2 32z" fill="url(#gl§)"/>'
  };
  var embN = 0;
  function emblem(key) { embN++; return (EMBLEMS[key] || "").replace(/§/g, key + embN); }
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
    toggle.innerHTML = '<span class="tp-badge"><svg viewBox="0 0 64 64" aria-hidden="true"></svg></span>'
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
      b.innerHTML = '<span class="ti-thumb" aria-hidden="true"></span><span class="ti-badge"><svg viewBox="0 0 64 64" aria-hidden="true">' + emblem(t.key) + "</svg></span>"
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
