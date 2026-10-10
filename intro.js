/* Интро для новичков: при первом заходе вместо сайта - ПДА сталкера. По кнопке «Открыть» на экране бегут
   системные строки (подключение к сети, обновление данных, авторизация), после «Добро пожаловать» открывается сайт.
   Показывать ли интро, решает встроенный скрипт в <head> (build.js): он ставит <html class="intro"> только
   живым посетителям при первом визите (не ботам, не превью, не во фрейме), а intro.css сразу прячет сайт.
   Повторно посмотреть - добавить к адресу ?intro. Пропустить можно только кнопкой «Пропустить» */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined") return;
  var d = document;
  var root = d.documentElement;
  if (!root.classList.contains("intro")) return;

  var KEY = "zoneIntroSeen";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var timers = [];
  var done = false;

  /* строки загрузки: текст, длительность (мс), итог: ok / err / progress / свой текст в скобках */
  var STEPS = [
    ["ПДА-ОС v4.17: загрузка ядра", 520, "ok"],
    ["Проверка аккумулятора", 380, "87%"],
    ["Калибровка счётчика Гейгера", 460, "ok"],
    ["Поиск сети сталкеров", 820, "ok"],
    ["Сигнал: ретранслятор «Кордон-3»", 360, "ok"],
    ["Подключение к сети сталкеров", 700, "ok"],
    ["Синхронизация карты Зоны", 950, "progress"],
    ["Обновление данных: рейтинг, гайды, боссы", 900, "progress"],
    ["Загрузка прогноза выбросов", 420, "ok"],
    ["Ожидание ответа сервера", 980, "ok"],
    ["Попытка авторизации", 760, "err"],
    ["Повторная попытка авторизации", 900, "ok"]
  ];

  function el(tag, cls, text) {
    var e = d.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function later(fn, ms) {
    timers.push(setTimeout(fn, reduce ? Math.min(ms, 200) : ms));
  }
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  /* ---------- разметка ---------- */
  var wrap = el("div", "pda-intro");
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-label", "ПДА сталкера: вход на сайт");

  var pda = el("div", "pda");
  var top = el("div", "pda-top");
  top.appendChild(el("span", "pda-led"));
  top.appendChild(el("span", "pda-brand", "ПДА · Сердце Зоны"));
  top.appendChild(el("span", "pda-led pda-led--2"));
  pda.appendChild(top);
  ["tl", "tr", "bl", "br"].forEach(function (c) {
    pda.appendChild(el("i", "pda-screw pda-screw--" + c));
  });

  var screen = el("div", "pda-screen");
  var bar = el("div", "pda-bar");
  var now = new Date();
  var clock = el("span", "pda-clock", pad(now.getHours()) + ":" + pad(now.getMinutes()));
  var net = el("span", "pda-net", "нет сети");
  var sig = el("span", "pda-sig");
  sig.setAttribute("aria-hidden", "true");
  for (var i = 0; i < 4; i++) sig.appendChild(el("i"));
  var bat = el("span", "pda-bat");
  bat.setAttribute("aria-hidden", "true");
  bat.appendChild(el("i"));
  bar.appendChild(clock);
  bar.appendChild(net);
  bar.appendChild(sig);
  bar.appendChild(bat);
  screen.appendChild(bar);

  /* заставка с кнопкой «Открыть» */
  var idle = el("div", "pda-idle");
  var logo = el("img", "pda-logo");
  logo.src = "/assets/heart-core.webp";
  logo.alt = "";
  logo.width = 104;
  logo.height = 104;
  idle.appendChild(logo);
  idle.appendChild(el("div", "pda-title", "ПДА сталкера"));
  idle.appendChild(el("div", "pda-sub", "Входящее сообщение · 1 непрочитанное"));
  var open = el("button", "pda-open", "Открыть");
  open.type = "button";
  idle.appendChild(open);
  screen.appendChild(idle);

  /* лог загрузки */
  var log = el("div", "pda-log");
  log.setAttribute("role", "log");
  log.hidden = true;
  screen.appendChild(log);
  screen.appendChild(el("div", "pda-scan"));
  pda.appendChild(screen);

  var foot = el("div", "pda-foot");
  foot.appendChild(el("span", "pda-key"));
  var grill = el("span", "pda-grill");
  for (var g = 0; g < 5; g++) grill.appendChild(el("i"));
  foot.appendChild(grill);
  foot.appendChild(el("span", "pda-key"));
  pda.appendChild(foot);
  wrap.appendChild(pda);

  var skip = el("button", "pda-skip", "Пропустить");
  skip.type = "button";
  wrap.appendChild(skip);

  /* ---------- поведение ---------- */
  function line(text) {
    var row = el("div", "pda-line");
    row.appendChild(el("span", "pda-prompt", ">"));
    row.appendChild(el("span", "pda-text", text));
    var st = el("span", "pda-st");
    row.appendChild(st);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return st;
  }

  function spin(st) {
    var f = ["|", "/", "-", "\\"],
      k = 0;
    st.textContent = "[" + f[0] + "]";
    var id = setInterval(function () {
      k = (k + 1) % 4;
      st.textContent = "[" + f[k] + "]";
    }, 90);
    return function () {
      clearInterval(id);
    };
  }

  function progress(st, ms) {
    var n = 0,
      cells = 10;
    var id = setInterval(
      function () {
        n = Math.min(cells, n + 1);
        st.textContent = "[" + "█".repeat(n) + "░".repeat(cells - n) + "] " + n * 10 + "%";
      },
      Math.max(30, (reduce ? 200 : ms) / (cells + 1))
    );
    return function () {
      clearInterval(id);
    };
  }

  function run(idx) {
    if (done) return;
    if (idx >= STEPS.length) return finish();
    var s = STEPS[idx];
    var st = line(s[0]);
    var stop = s[2] === "progress" ? progress(st, s[1]) : spin(st);
    if (idx === 4) net.textContent = "Кордон-3";
    later(function () {
      stop();
      if (s[2] === "err") {
        st.textContent = "[ОТКАЗ]";
        st.className = "pda-st pda-st--err";
      } else if (s[2] === "ok" || s[2] === "progress") {
        st.textContent = "[OK]";
        st.className = "pda-st pda-st--ok";
        if (idx === 5) sig.classList.add("on");
      } else {
        st.textContent = "[" + s[2] + "]";
        st.className = "pda-st pda-st--ok";
      }
      later(function () {
        run(idx + 1);
      }, 90);
    }, s[1]);
  }

  function finish() {
    later(function () {
      var a = el("div", "pda-win", "Авторизация прошла успешно!");
      log.appendChild(a);
      log.scrollTop = log.scrollHeight;
      later(function () {
        var b = el("div", "pda-win pda-win--big", "Добро пожаловать, Сталкер!");
        log.appendChild(b);
        log.scrollTop = log.scrollHeight;
        later(close, 1900);
      }, 700);
    }, 250);
  }

  function close() {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    try {
      localStorage.setItem(KEY, "1");
    } catch (e) {}
    /* ?intro (принудительный показ) убираем из адреса, чтобы обновление страницы не повторяло интро */
    try {
      if (/[?&]intro(=|&|$)/.test(location.search) && history.replaceState) {
        var q = location.search
          .slice(1)
          .split("&")
          .filter(function (p) {
            return p && p.split("=")[0] !== "intro";
          })
          .join("&");
        history.replaceState(history.state, "", location.pathname + (q ? "?" + q : "") + location.hash);
      }
    } catch (e) {}
    root.classList.remove("intro");
    wrap.classList.add("pda-out");
    setTimeout(
      function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      },
      reduce ? 50 : 650
    );
  }

  open.addEventListener("click", function () {
    if (open.disabled) return;
    open.disabled = true;
    wrap.classList.add("pda-on");
    idle.hidden = true;
    log.hidden = false;
    skip.focus();
    later(function () {
      run(0);
    }, 250);
  });
  skip.addEventListener("click", close);

  /* фокус не уходит со вкладки на спрятанный сайт; Esc и клики мимо кнопок интро не закрывают */
  wrap.addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;
    var list = [open, skip].filter(function (b) {
      return !b.disabled && b.offsetParent !== null;
    });
    if (!list.length) return;
    var at = list.indexOf(d.activeElement);
    e.preventDefault();
    var next = e.shiftKey ? (at <= 0 ? list.length - 1 : at - 1) : at < 0 || at >= list.length - 1 ? 0 : at + 1;
    list[next].focus();
  });

  function mount() {
    d.body.appendChild(wrap);
    open.focus({ preventScroll: true });
  }
  if (d.body) mount();
  else d.addEventListener("DOMContentLoaded", mount);
})();
