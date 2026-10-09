/* Сезонное оформление «Хэллоуин в Зоне» (вороны, тыквы, бюрер в простыне, призраки мутантов, зомби-монолитовец).
   ВКЛ/ВЫКЛ для всего сайта - одна строка ниже:
     mode: "auto" - включается само с from по to (ММ-ДД, по часам посетителя);
     mode: "on"   - включено всегда (например, чтобы проверить);
     mode: "off"  - выключено полностью, кнопки 🎃 в шапке нет, файлы оформления не грузятся.
   Пока сезон идёт, в шапке есть кнопка 🎃 - посетитель выбирает сам: «Выкл», «Тихо» (только тыквы и
   вороны), «Сезон» (всё, по умолчанию) или «Выброс» (всё чаще + фонарик вместо курсора). Выбор запоминается в браузере.
   Само оформление - halloween.css + halloween.js, они подгружаются только когда оно включено.
   build.js подключает этот файл на все страницы и подставляет версию оформления вместо __HW_V__ */
(function () {
  "use strict";
  var SEASON = { mode: "auto", from: "10-20", to: "11-03" };

  var KEY = "hotzHalloween";
  var V = "__HW_V__";
  var d = document;
  window.HOTZ_HW_V = V.indexOf("__") === 0 ? "" : V;

  function inSeason() {
    if (SEASON.mode === "on") return true;
    if (SEASON.mode !== "auto") return false;
    var now = new Date();
    var md = ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);
    /* окно может переходить через Новый год (from > to) */
    return SEASON.from <= SEASON.to ? md >= SEASON.from && md <= SEASON.to : md >= SEASON.from || md <= SEASON.to;
  }
  if (!inSeason()) return;

  var LEVELS = [
    ["off", "Выкл", "обычный сайт"],
    ["quiet", "Тихо", "тыквы и вороны"],
    ["season", "Сезон", "вся нечисть Зоны"],
    ["surge", "Выброс", "чаще, темнее, с фонариком"]
  ];
  function pref() {
    var v = "season";
    try {
      v = localStorage.getItem(KEY) || "season";
    } catch (e) {}
    if (v === "on") v = "season";
    return LEVELS.some(function (l) {
      return l[0] === v;
    })
      ? v
      : "season";
  }
  function q(u) {
    return window.HOTZ_HW_V ? u + "?v=" + window.HOTZ_HW_V : u;
  }

  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    var l = d.createElement("link");
    l.rel = "stylesheet";
    l.href = q("/halloween.css");
    d.head.appendChild(l);
    var s = d.createElement("script");
    s.src = q("/halloween.js");
    s.defer = true;
    d.head.appendChild(s);
  }

  function apply(level) {
    var on = level !== "off";
    d.documentElement.classList.toggle("hw", on);
    if (on) d.documentElement.dataset.hw = level;
    else delete d.documentElement.dataset.hw;
    if (on) load();
    if (window.HOTZ_HW) window.HOTZ_HW[on ? "start" : "stop"]();
    var b = d.getElementById("hwToggle");
    if (b) {
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.title = "Хэллоуин в Зоне: " + label(level);
    }
    var opts = d.querySelectorAll("[data-hw-level]");
    for (var i = 0; i < opts.length; i++)
      opts[i].setAttribute("aria-checked", opts[i].dataset.hwLevel === level ? "true" : "false");
  }
  function label(level) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i][0] === level) return LEVELS[i][1].toLowerCase();
    return "";
  }

  function button() {
    var header = d.querySelector(".header-inner");
    if (!header || d.getElementById("hwToggle")) return;
    var box = d.createElement("div");
    box.className = "hw-switch";
    var b = d.createElement("button");
    b.type = "button";
    b.id = "hwToggle";
    b.className = "hw-toggle";
    b.setAttribute("aria-haspopup", "true");
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-label", "Оформление «Хэллоуин в Зоне»");
    b.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="hw-t-stem" d="M12 6.2c0-1.6.6-2.8 2-3.6"/>' +
      '<path class="hw-t-body" d="M12 6.4c-1.4-.9-3.6-1-5.3 0C4.3 7.8 3 10.4 3 13.4 3 17.6 5.8 21 9.4 21c1 0 1.9-.3 2.6-.7.7.4 1.6.7 2.6.7 3.6 0 6.4-3.4 6.4-7.6 0-3-1.3-5.6-3.7-7-1.7-1-3.9-.9-5.3 0Z"/>' +
      '<path class="hw-t-face" d="M7.6 11.6 9.6 13l-2 .6zM16.4 11.6 14.4 13l2 .6zM7.8 16.2l1.5.9 1.3-.9 1.4.9 1.4-.9 1.3.9 1.5-.9"/></svg>';
    var menu = d.createElement("div");
    menu.className = "hw-menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    menu.innerHTML =
      '<div class="hw-menu-head">Хэллоуин в Зоне</div>' +
      LEVELS.map(function (l) {
        return (
          '<button type="button" role="menuitemradio" data-hw-level="' +
          l[0] +
          '"><b>' +
          l[1] +
          "</b><small>" +
          l[2] +
          "</small></button>"
        );
      }).join("");
    function open(v) {
      menu.hidden = !v;
      b.setAttribute("aria-expanded", v ? "true" : "false");
    }
    b.addEventListener("click", function () {
      open(menu.hidden);
    });
    menu.addEventListener("click", function (e) {
      var o = e.target.closest("[data-hw-level]");
      if (!o) return;
      try {
        localStorage.setItem(KEY, o.dataset.hwLevel);
      } catch (e2) {}
      apply(o.dataset.hwLevel);
      open(false);
      b.focus();
    });
    d.addEventListener("click", function (e) {
      if (!box.contains(e.target)) open(false);
    });
    d.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) {
        open(false);
        b.focus();
      }
    });
    box.appendChild(b);
    box.appendChild(menu);
    var theme = d.getElementById("themeSwitch");
    if (theme && theme.parentNode === header) header.insertBefore(box, theme);
    else header.appendChild(box);
  }

  function init() {
    button();
    apply(pref());
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init);
  else init();
})();
