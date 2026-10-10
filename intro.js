/* Интро для новичков: при первом заходе вместо сайта - ПДА сталкера. По кнопке «Открыть» на экране бегут
   системные строки (подключение к сети, обновление данных, авторизация), после «Добро пожаловать» - кнопка «Войти».
   Показывать ли интро, решает встроенный скрипт в <head> (build.js): он ставит <html class="intro"> только
   живым посетителям при первом визите (не ботам, не превью, не во фрейме), а intro.css сразу прячет сайт.
   Повторно посмотреть - добавить к адресу ?intro. Сайт открывают только кнопки «Войти» и «Пропустить» */
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
    ["ПДА-ОС v4.17: загрузка ядра", 580, "ok"],
    ["Проверка аккумулятора", 430, "87%"],
    ["Калибровка счётчика Гейгера", 540, "ok"],
    ["Поиск сети сталкеров", 940, "ok"],
    ["Сигнал: ретранслятор «Кордон-3»", 400, "ok"],
    ["Подключение к сети сталкеров", 790, "ok"],
    ["Синхронизация карты Зоны", 1080, "progress"],
    ["Обновление данных: рейтинг, гайды, боссы", 1010, "progress"],
    ["Загрузка прогноза выбросов", 500, "ok"],
    ["Ожидание ответа сервера", 1080, "ok"],
    ["Попытка авторизации", 790, "err"],
    ["Повторная попытка авторизации", 940, "ok"]
  ];
  /* скорость «печати» строки, мс на символ */
  var TYPE = 18;

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

  /* корпус: антенна, резиновые углы, шильдик с индикаторами, экран в рамке и панель кнопок */
  var pda = el("div", "pda");
  pda.appendChild(el("i", "pda-ant"));
  ["tl", "tr", "bl", "br"].forEach(function (c) {
    pda.appendChild(el("i", "pda-bump pda-bump--" + c));
    pda.appendChild(el("i", "pda-screw pda-screw--" + c));
  });
  var head = el("div", "pda-head");
  var led1 = el("span", "pda-ledbox");
  led1.appendChild(el("i", "pda-led pda-led--pwr"));
  led1.appendChild(el("span", "", "PWR"));
  var led2 = el("span", "pda-ledbox");
  led2.appendChild(el("i", "pda-led pda-led--net"));
  led2.appendChild(el("span", "", "NET"));
  head.appendChild(led1);
  head.appendChild(el("span", "pda-brand", "ПДА-7 · Сердце Зоны"));
  head.appendChild(led2);
  pda.appendChild(head);

  var body = el("div", "pda-body");
  var bezel = el("div", "pda-bezel");
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

  /* заставка: сердце на знаке радиации - копия логотипа из шапки (тот же живой SVG) */
  var idle = el("div", "pda-idle");
  var mark = el("div", "pda-mark");
  var src = d.querySelector(".site-header .rad-logo") || d.querySelector(".rad-logo");
  if (src) mark.appendChild(src.cloneNode(true));
  else {
    var img = el("img");
    img.src = "/assets/heart-core.webp";
    img.alt = "";
    mark.appendChild(img);
  }
  idle.appendChild(mark);
  idle.appendChild(el("div", "pda-title", "ПДА сталкера"));
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
  screen.appendChild(el("div", "pda-glass"));
  bezel.appendChild(screen);
  body.appendChild(bezel);

  var side = el("div", "pda-side");
  side.setAttribute("aria-hidden", "true");
  var spk = el("span", "pda-spk");
  side.appendChild(spk);
  var dpad = el("span", "pda-dpad");
  ["u", "r", "dn", "l", "c"].forEach(function (k) {
    dpad.appendChild(el("i", "pda-dp pda-dp--" + k));
  });
  side.appendChild(dpad);
  var keys = el("span", "pda-keys");
  ["Меню", "Карта", "Связь"].forEach(function (k) {
    var kk = el("span", "pda-k");
    kk.appendChild(el("i"));
    kk.appendChild(el("b", "", k));
    keys.appendChild(kk);
  });
  side.appendChild(keys);
  side.appendChild(el("span", "pda-sticker", "☢ Собственность сети сталкеров"));
  body.appendChild(side);
  pda.appendChild(body);
  wrap.appendChild(pda);

  var skip = el("button", "pda-skip", "Пропустить");
  skip.type = "button";
  wrap.appendChild(skip);
  var enter = null;

  /* ---------- поведение ---------- */
  /* строка «печатается» по буквам, потом справа - статус */
  function line(text, cb) {
    var row = el("div", "pda-line");
    row.appendChild(el("span", "pda-prompt", ">"));
    var tx = el("span", "pda-text");
    row.appendChild(tx);
    var st = el("span", "pda-st");
    row.appendChild(st);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    if (reduce) {
      tx.textContent = text;
      return cb(st);
    }
    row.classList.add("typing");
    var n = 0;
    (function tick() {
      if (done) return;
      n++;
      tx.textContent = text.slice(0, n);
      if (n < text.length) timers.push(setTimeout(tick, TYPE));
      else {
        row.classList.remove("typing");
        cb(st);
      }
    })();
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
    line(s[0], function (st) {
      var stop = s[2] === "progress" ? progress(st, s[1]) : spin(st);
      if (idx === 4) net.textContent = "Кордон-3";
      later(function () {
        stop();
        if (s[2] === "err") {
          st.textContent = "[ОТКАЗ]";
          st.className = "pda-st pda-st--err";
        } else {
          st.textContent = s[2] === "ok" || s[2] === "progress" ? "[OK]" : "[" + s[2] + "]";
          st.className = "pda-st pda-st--ok";
          if (idx === 5) {
            sig.classList.add("on");
            pda.classList.add("pda-net-on");
          }
        }
        later(function () {
          run(idx + 1);
        }, 160);
      }, s[1]);
    });
  }

  /* финал: две зелёные строки и кнопка «Войти» - сайт открывается только по ней (или по «Пропустить») */
  function finish() {
    later(function () {
      /* лог гаснет, итог - две строки и «Войти» разом, отдельным блоком по центру экрана */
      log.classList.add("pda-log--done");
      var fin = el("div", "pda-final");
      fin.appendChild(el("div", "pda-win", "Авторизация прошла успешно!"));
      fin.appendChild(el("div", "pda-win pda-win--big", "Добро пожаловать, Сталкер!"));
      enter = el("button", "pda-open pda-enter", "Войти");
      enter.type = "button";
      enter.addEventListener("click", close);
      fin.appendChild(enter);
      screen.insertBefore(fin, log.nextSibling);
      enter.focus({ preventScroll: true });
    }, 600);
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
    pda.classList.add("pda-booting");
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
    var list = [open, enter, skip].filter(function (b) {
      return b && !b.disabled && b.offsetParent !== null;
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
