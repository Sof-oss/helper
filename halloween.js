/* «Хэллоуин в Зоне» - сезонная нечисть. Подгружается из season.js, только когда оформление включено.
   Уровни (html[data-hw]): quiet - тыквы и вороны; season - всё; surge - всё чаще + фонарик.
   Все создания не ловят клики (pointer-events: none) - кроме тыквы-пасхалки и бюрера, который прячется от курсора.
   При prefers-reduced-motion ничего не движется: только сидящие вороны и тыквы. На телефоне существ меньше и ничего
   не закрывает нижнее меню. */
(function () {
  "use strict";
  var d = document;
  var root = d.documentElement;
  var V = window.HOTZ_HW_V ? "?v=" + window.HOTZ_HW_V : "";
  function img(name) {
    return "/assets/halloween/" + name + ".webp" + V;
  }
  var rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  var narrow = window.matchMedia("(max-width: 720px)");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  var PERCH = ".home-card, .home-news, .hc-live, .result-panel, .info-lead, .guide-card, .t100-tools";

  function level() {
    return root.dataset.hw || "season";
  }
  function full() {
    return level() !== "quiet" && !rm.matches;
  }
  function rnd(a, b) {
    return a + Math.random() * (b - a);
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function el(tag, cls, html) {
    var e = d.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }
  function speed() {
    return level() === "surge" ? 0.55 : 1;
  }

  var timers = [];
  function later(fn, ms) {
    var id = setTimeout(function () {
      timers.splice(timers.indexOf(id), 1);
      if (running) fn();
    }, ms);
    timers.push(id);
    return id;
  }

  var running = false;
  var layer, sky, fog, light;
  var crows = [];

  /* блок с настоящим верхним краем: есть рамка или фон, он виден и не спрятан под шапкой */
  function solid(e) {
    if (!e || !e.isConnected || e.closest("[hidden], dialog, .modal")) return false;
    var r = e.getBoundingClientRect();
    if (r.width < 200 || r.height < 40) return false;
    var s = getComputedStyle(e);
    if (s.visibility === "hidden" || +s.opacity < 0.5 || s.display === "none") return false;
    var bg = s.backgroundColor;
    var hasBg = bg && bg !== "transparent" && !/rgba\([^)]*,\s*0(\.0+)?\)$/.test(bg);
    return parseFloat(s.borderTopWidth) > 0 || hasBg || s.backgroundImage !== "none";
  }
  /* видимые блоки страницы, на которые можно сесть и поставить тыкву (вложенные друг в друга - только внешний) */
  function perches() {
    return [].slice.call(d.querySelectorAll(PERCH)).filter(function (e) {
      return solid(e) && !(e.parentElement && e.parentElement.closest(PERCH));
    });
  }
  function pageXY(e, fx) {
    var r = e.getBoundingClientRect();
    return { x: r.left + window.scrollX + r.width * fx, y: r.top + window.scrollY, r: r };
  }

  /* ---------- вороны ---------- */
  function crowNode(cls) {
    var c = el(
      "div",
      "hw-crow " + cls,
      '<i class="hw-cw"><img class="s" alt="" src="' +
        img("crow-sit") +
        '"><img class="u" alt="" src="' +
        img("crow-fly-up") +
        '"><img class="dn" alt="" src="' +
        img("crow-fly-down") +
        '"></i>'
    );
    c.setAttribute("aria-hidden", "true");
    return c;
  }
  function seat(crow, used) {
    var ps = perches().filter(function (p) {
      return used.indexOf(p) < 0;
    });
    if (!ps.length) ps = perches();
    if (!ps.length) return false;
    var p = pick(ps);
    var at = pageXY(p, rnd(0.12, 0.88));
    crow.perch = p;
    crow.fx = (at.x - at.r.left - window.scrollX) / at.r.width;
    crow.flip = Math.random() < 0.5;
    crow.node.classList.toggle("flip", crow.flip);
    crow.node.style.transform = "translate(" + Math.round(at.x) + "px," + Math.round(at.y) + "px)";
    return true;
  }
  function place(crow) {
    if (!crow.sitting) return;
    /* блок исчез, свернулся или стал прозрачным - ворона не остаётся висеть в воздухе */
    if (!solid(crow.perch)) {
      if (!seat(crow, [])) crow.node.classList.add("gone");
      return;
    }
    var at = pageXY(crow.perch, crow.fx);
    crow.node.style.transform = "translate(" + Math.round(at.x) + "px," + Math.round(at.y) + "px)";
    crow.node.classList.remove("gone");
  }
  function crowCount() {
    if (narrow.matches) return 3;
    return level() === "surge" ? 7 : 5;
  }
  function spawnCrows() {
    var used = [];
    for (var i = 0; i < crowCount(); i++) {
      var c = { node: crowNode("sit"), sitting: true };
      if (!seat(c, used)) break;
      used.push(c.perch);
      layer.appendChild(c.node);
      crows.push(c);
    }
  }
  /* полёт по экрану: из точки (x0,y0) в (x1,y1), крылья машут (два кадра чередуются в css) */
  function flight(x0, y0, x1, y1, ms, done) {
    var f = crowNode("fly");
    f.classList.toggle("flip", x1 > x0);
    sky.appendChild(f);
    var mx = (x0 + x1) / 2,
      my = Math.min(y0, y1) - rnd(40, 140);
    var a = f.animate(
      [
        { transform: "translate(" + x0 + "px," + y0 + "px) rotate(0deg)" },
        { transform: "translate(" + mx + "px," + my + "px) rotate(" + (x1 > x0 ? 6 : -6) + "deg)", offset: 0.45 },
        { transform: "translate(" + x1 + "px," + y1 + "px) rotate(0deg)" }
      ],
      { duration: ms, easing: "cubic-bezier(.3,.1,.4,1)" }
    );
    a.onfinish = function () {
      f.remove();
      if (done) done();
    };
  }
  function scare(crow, px, py) {
    if (!crow.sitting) return;
    crow.sitting = false;
    var r = crow.node.getBoundingClientRect();
    crow.node.classList.add("gone");
    var away = r.left + r.width / 2 >= px ? 1 : -1;
    var x1 = away > 0 ? window.innerWidth + 120 : -160;
    flight(r.left, r.top, x1, rnd(-180, window.innerHeight * 0.25), rnd(1500, 2300));
    later(
      function () {
        returnCrow(crow);
      },
      rnd(20000, 30000) * speed()
    );
  }
  function returnCrow(crow) {
    if (!seat(crow, [])) return;
    var r = crow.perch.getBoundingClientRect();
    var tx = r.left + r.width * crow.fx,
      ty = r.top;
    var seen = ty > -40 && ty < window.innerHeight;
    var land = function () {
      crow.node.classList.remove("gone");
      crow.sitting = true;
    };
    if (!seen) return land();
    var fromLeft = Math.random() < 0.5;
    flight(fromLeft ? -160 : window.innerWidth + 120, rnd(-120, 40), tx - 30, ty - 40, rnd(1600, 2200), land);
  }
  function hop() {
    var sit = crows.filter(function (c) {
      return c.sitting && c.node.getBoundingClientRect().top > 0;
    });
    if (sit.length) {
      var c = pick(sit);
      var r0 = c.node.getBoundingClientRect();
      c.sitting = false;
      c.node.classList.add("gone");
      if (seat(c, [c.perch])) {
        var r1 = c.perch.getBoundingClientRect();
        flight(r0.left, r0.top, r1.left + r1.width * c.fx - 30, r1.top - 40, 1400, function () {
          c.node.classList.remove("gone");
          c.sitting = true;
        });
      }
    }
    later(hop, rnd(15000, 30000) * speed());
  }
  function nearCrows(px, py, dist) {
    if (rm.matches) return;
    crows.forEach(function (c) {
      if (!c.sitting) return;
      var r = c.node.getBoundingClientRect();
      var dx = r.left + r.width / 2 - px,
        dy = r.top + r.height / 2 - py;
      if (dx * dx + dy * dy < dist * dist) scare(c, px, py);
    });
  }
  function onMove(e) {
    if (e.pointerType === "mouse") nearCrows(e.clientX, e.clientY, 90);
    if (light) {
      light.style.setProperty("--lx", e.clientX + "px");
      light.style.setProperty("--ly", e.clientY + "px");
    }
  }
  function onDown(e) {
    nearCrows(e.clientX, e.clientY, 130);
  }

  /* ---------- тыквы ---------- */
  var PUMPKINS = ["pumpkin-gasmask", "pumpkin-dosimeter", "pumpkin-helmet", "pumpkin-artifact"];
  var pumpkins = [];
  function spawnPumpkins() {
    var ps = perches().filter(function (p) {
      return !p.classList.contains("site-header");
    });
    var n = Math.min(ps.length, narrow.matches ? 2 : 4);
    var kinds = PUMPKINS.slice().sort(function () {
      return Math.random() - 0.5;
    });
    var step = ps.length / Math.max(n, 1);
    for (var i = 0; i < n; i++) {
      var p = ps[Math.floor(i * step)];
      var k = el("div", "hw-pumpkin" + (i % 2 ? " l" : ""), '<img alt="" src="' + img(kinds[i % 4]) + '">');
      k.setAttribute("aria-hidden", "true");
      k.style.animationDelay = (-Math.random() * 6).toFixed(2) + "s";
      layer.appendChild(k);
      pumpkins.push({ node: k, perch: p, fx: i % 2 ? 0 : 1, bottom: true });
    }
    placePumpkins();
  }
  function placePumpkins() {
    /* тыква не должна залезать на монолитовца-мишень в калькуляторе: ставим её в другой угол, а если и там тесно - прячем */
    var busy = mono && mono.classList.contains("hw-target") ? mono.getBoundingClientRect() : null;
    function hits(n) {
      if (!busy) return false;
      var r = n.getBoundingClientRect();
      var pad = 12;
      return (
        r.right > busy.left - pad && r.left < busy.right + pad && r.bottom > busy.top - pad && r.top < busy.bottom + pad
      );
    }
    function put(k) {
      var r = k.perch.getBoundingClientRect();
      var x = r.left + window.scrollX + r.width * k.fx,
        y = r.top + window.scrollY + r.height;
      k.node.classList.toggle("l", k.fx === 0);
      k.node.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
    }
    pumpkins.forEach(function (k) {
      if (!k.perch.isConnected) return;
      if (k.home === undefined) k.home = k.fx;
      k.fx = k.home;
      k.node.style.visibility = "";
      put(k);
      if (!hits(k.node)) return;
      k.fx = 1 - k.home;
      put(k);
      if (hits(k.node)) k.node.style.visibility = "hidden";
    });
  }

  /* пасхалка: на каждой странице прячется маленькая тыква, по клику она ухает и засчитывается */
  var EGG_PAGES = ["/", "/info", "/top100", "/compare", "/calculator", "/guides"];
  var EGG_KEY = "hotzHwFound";
  var egg;
  function eggPage() {
    var p = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/");
    if (p.length > 1) p = p.replace(/\/$/, "");
    if (/^\/guide\//.test(p)) p = "/guides";
    return EGG_PAGES.indexOf(p) >= 0 ? p : null;
  }
  function found() {
    try {
      return JSON.parse(localStorage.getItem(EGG_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }
  function spawnEgg() {
    var spots = [].slice.call(d.querySelectorAll(".site-footer, .result-panel, .home-card, .info-lead, .guide-card"));
    if (!spots.length) return;
    var host = spots.length > 2 ? spots[1 + Math.floor(Math.random() * (spots.length - 1))] : spots[0];
    egg = el("button", "hw-egg", '<img alt="" src="' + img(pick(PUMPKINS)) + '"><span class="hw-bubble"></span>');
    egg.type = "button";
    egg.setAttribute("aria-label", "Тыква");
    egg.addEventListener("click", function () {
      var page = eggPage();
      var list = found();
      if (page && list.indexOf(page) < 0) {
        list.push(page);
        try {
          localStorage.setItem(EGG_KEY, JSON.stringify(list));
        } catch (e) {}
      }
      var says = ["Ух-ух!", "Бу!", "Сталкер, артефакт не трожь!", "У-у-ух!", "Фонишь, братишка…"];
      var msg = pick(says);
      if (page) msg += " Тыкв найдено: " + list.length + " из " + EGG_PAGES.length;
      if (list.length >= EGG_PAGES.length && page) msg = "Все тыквы Зоны собраны! Настоящий сталкер 🎃";
      egg.querySelector(".hw-bubble").textContent = msg;
      egg.classList.remove("boo");
      void egg.offsetWidth;
      egg.classList.add("boo");
    });
    host.appendChild(egg);
    if (getComputedStyle(host).position === "static") host.classList.add("hw-egg-host");
    egg.classList.add(Math.random() < 0.5 ? "bl" : "br");
  }

  /* ---------- бюрер в простыне ---------- */
  var burer;
  function spawnBurer() {
    if (narrow.matches) return;
    burer = el("div", "hw-burer", '<img alt="" src="' + img("burer-peek") + '">');
    burer.setAttribute("aria-hidden", "true");
    burer.addEventListener("pointerenter", function () {
      burer.classList.remove("up");
    });
    d.body.appendChild(burer);
    later(peek, rnd(6000, 12000) * speed());
  }
  function peek() {
    burer.classList.add("up");
    later(telekinesis, 1600);
    later(function () {
      burer.classList.remove("up");
    }, 7000);
    later(peek, rnd(25000, 40000) * speed());
  }
  /* телекинез: ближайшая видимая карточка приподнимается, дрожит и возвращается на место */
  function telekinesis() {
    if (!burer.classList.contains("up")) return;
    var vis = perches().filter(function (p) {
      var r = p.getBoundingClientRect();
      return !p.classList.contains("site-header") && r.top > 80 && r.bottom < window.innerHeight - 20 && r.height < 420;
    });
    if (!vis.length) return;
    var t = vis.sort(function (a, b) {
      return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
    })[0];
    burer.classList.add("tk");
    t.classList.add("hw-tk");
    later(function () {
      t.classList.remove("hw-tk");
      burer.classList.remove("tk");
    }, 2400);
  }

  /* ---------- призраки мутантов и бюрер в тумане ---------- */
  var GHOSTS = ["alpha", "boar", "ghoul", "izlom", "rat", "swamp"];
  function ghost() {
    var sheet = Math.random() < 0.2;
    var g = el(
      "div",
      "hw-ghost" + (sheet ? " sheet" : ""),
      '<img alt="" src="' + img(sheet ? "burer-sheet" : "ghost-" + pick(GHOSTS)) + '">'
    );
    g.setAttribute("aria-hidden", "true");
    sky.appendChild(g);
    var w = window.innerWidth,
      h = window.innerHeight;
    var ltr = Math.random() < 0.5;
    var y = rnd(h * 0.25, h * 0.7);
    var size = narrow.matches ? 0.6 : 1;
    g.style.setProperty("--s", size);
    var x0 = ltr ? -380 : w + 40,
      x1 = ltr ? w + 40 : -380;
    var a = g.animate(
      [
        { transform: "translate(" + x0 + "px," + y + "px) scaleX(" + (ltr ? -1 : 1) + ")", opacity: 0 },
        { opacity: 1, offset: 0.2 },
        {
          transform: "translate(" + (x0 + x1) / 2 + "px," + (y - 40) + "px) scaleX(" + (ltr ? -1 : 1) + ")",
          offset: 0.5
        },
        { opacity: 1, offset: 0.8 },
        { transform: "translate(" + x1 + "px," + (y + 10) + "px) scaleX(" + (ltr ? -1 : 1) + ")", opacity: 0 }
      ],
      { duration: rnd(16000, 22000), easing: "linear" }
    );
    a.onfinish = function () {
      g.remove();
    };
    later(ghost, rnd(30000, 55000) * speed());
  }

  /* ---------- зомби-монолитовец ---------- */
  var mono;
  function spawnMonolith() {
    var p = location.pathname;
    if (/^\/calculator/.test(p)) {
      /* в калькуляторе он стоит мишенью в панели результата */
      var host = d.querySelector(".result-panel");
      if (!host || narrow.matches) return;
      mono = el(
        "div",
        "hw-target",
        '<img alt="" src="' + img("monolith-stand") + '"><span>Мишень: зомби-монолитовец</span>'
      );
      mono.setAttribute("aria-hidden", "true");
      if (getComputedStyle(host).position === "static") host.classList.add("hw-egg-host");
      host.appendChild(mono);
      return;
    }
    if (!/^\/(top100|compare)/.test(p) || narrow.matches) return;
    mono = el("div", "hw-walker", '<img alt="" src="' + img("monolith-stand") + '">');
    mono.setAttribute("aria-hidden", "true");
    d.body.appendChild(mono);
    later(shamble, rnd(8000, 15000) * speed());
  }
  function shamble() {
    mono.classList.remove("walk");
    void mono.offsetWidth;
    mono.classList.add("walk");
    later(shamble, rnd(35000, 55000) * speed());
  }

  /* ---------- «Выброс»: заголовок на миг сбоит ---------- */
  function flicker() {
    var hs = [].slice.call(d.querySelectorAll("h1, h2, .section-heading b")).filter(function (h) {
      var r = h.getBoundingClientRect();
      return r.top > 0 && r.bottom < window.innerHeight && r.width > 0;
    });
    if (hs.length) {
      var h = pick(hs);
      h.classList.add("hw-flick");
      later(function () {
        h.classList.remove("hw-flick");
      }, 1300);
    }
    later(flicker, rnd(20000, 40000) * speed());
  }

  /* ---------- запуск / остановка ---------- */
  var raf = 0;
  function relayout() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      crows.forEach(place);
      placePumpkins();
    });
  }
  var ro;
  function start() {
    if (running) return;
    running = true;
    layer = el("div", "hw-layer");
    sky = el("div", "hw-sky");
    fog = el("div", "hw-fog");
    [layer, sky, fog].forEach(function (n) {
      n.setAttribute("aria-hidden", "true");
      d.body.appendChild(n);
    });
    if (level() === "surge" && finePointer.matches && !rm.matches) {
      light = el("div", "hw-light");
      light.setAttribute("aria-hidden", "true");
      d.body.appendChild(light);
    }
    spawnCrows();
    spawnPumpkins();
    spawnEgg();
    if (full()) {
      spawnBurer();
      spawnMonolith();
      later(ghost, rnd(5000, 12000) * speed());
      later(flicker, rnd(8000, 16000) * speed());
      later(hop, rnd(12000, 20000) * speed());
    }
    d.addEventListener("pointermove", onMove, { passive: true });
    d.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("resize", relayout);
    if (window.ResizeObserver) {
      ro = new ResizeObserver(relayout);
      ro.observe(d.body);
    }
    /* блоки страницы дорисовываются скриптами - сверяем положение ещё пару раз */
    later(relayout, 800);
    later(relayout, 2500);
    /* блоки могут сворачиваться и прятаться (вкладки, «Все новости») - регулярно сверяем жёрдочки */
    (function watch() {
      relayout();
      later(watch, 1500);
    })();
  }
  function stop() {
    if (!running) return;
    running = false;
    timers.splice(0).forEach(clearTimeout);
    [layer, sky, fog, light, burer, mono, egg].forEach(function (n) {
      if (n) n.remove();
    });
    light = burer = mono = egg = null;
    crows = [];
    pumpkins = [];
    d.querySelectorAll(".hw-tk, .hw-flick").forEach(function (n) {
      n.classList.remove("hw-tk", "hw-flick");
    });
    d.removeEventListener("pointermove", onMove);
    d.removeEventListener("pointerdown", onDown);
    window.removeEventListener("resize", relayout);
    if (ro) ro.disconnect();
  }
  function restart() {
    stop();
    if (root.classList.contains("hw")) start();
  }

  window.HOTZ_HW = { start: restart, stop: stop };
  if (root.classList.contains("hw")) start();
})();
