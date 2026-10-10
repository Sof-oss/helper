/* «Хэллоуин в Зоне» - сезонная нечисть. Подгружается из season.js, только когда оформление включено.
   Уровни (html[data-hw]): quiet - тыквы и вороны; season - всё; surge - всё чаще + фонарик.
   Все создания не ловят клики (pointer-events: none) - кроме тыквы-пасхалки и бюрера, который прячется от курсора.
   Пасхалка не ставится на ссылки, кнопки и карточки-ссылки; декоративные тыквы клики пропускают и только не закрывают кнопки.
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
  /* всё, по чему можно кликнуть: на таких блоках тыкв нет, чтобы клик по тыкве не открывал ссылку */
  var CLICKABLE =
    "a, button, summary, label, select, input, textarea, [role=button], [role=link], [onclick], [tabindex]";
  function clickable(e) {
    return !!(e && e.closest(CLICKABLE));
  }

  function level() {
    return root.dataset.hw || "quiet";
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
  /* Безопасные места: свободный участок верхнего края, вдали от кнопок и других птиц.
     Если мест меньше, чем ворон, лишние ждут за экраном, а не садятся друг на друга. */
  var occupiedControls = [];
  var fixedChrome = [];
  function intersects(a, b, pad) {
    pad = pad || 0;
    return a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;
  }
  function refreshObstacles() {
    occupiedControls = [].slice
      .call(d.querySelectorAll("a, button, input, select, textarea, summary, [role=button], [tabindex]"))
      .filter(function (e) {
        if (e.closest(".hw-switch, .hw-egg, .site-header, .tabbar, [hidden]")) return false;
        var style = getComputedStyle(e);
        var hiddenMenu = e.closest(".theme-list");
        return (
          e.getClientRects().length &&
          style.visibility !== "hidden" &&
          style.pointerEvents !== "none" &&
          (!hiddenMenu ||
            (hiddenMenu.closest(".theme-pick") && hiddenMenu.closest(".theme-pick").classList.contains("open")))
        );
      })
      .map(function (e) {
        return { node: e, rect: e.getBoundingClientRect() };
      });
    fixedChrome = [].slice
      .call(d.querySelectorAll(".site-header, .tabbar"))
      .filter(function (e) {
        var style = getComputedStyle(e);
        return (
          (style.position === "fixed" || style.position === "sticky") &&
          style.display !== "none" &&
          e.getClientRects().length
        );
      })
      .map(function (e) {
        return e.getBoundingClientRect();
      })
      /* закреплённые кнопки (например, нижняя панель калькулятора на телефоне) тоже ездят вместе с экраном */
      .concat(
        occupiedControls
          .filter(function (o) {
            for (var e = o.node; e && e !== d.body; e = e.parentElement) {
              var p = getComputedStyle(e).position;
              if (p === "fixed" || p === "sticky") return (o.fixed = true);
            }
            return false;
          })
          .map(function (o) {
            return o.rect;
          })
      );
  }
  function crowRect(p, fx) {
    var r = p.getBoundingClientRect();
    var w = narrow.matches ? 48 : 64,
      h = narrow.matches ? 36 : 48;
    var x = r.left + r.width * fx;
    var y = r.top - h + 2;
    return { left: x - w / 2, right: x + w / 2, top: y, bottom: y + h };
  }
  function freeSeat(p, fx, crow) {
    var r = crowRect(p, fx);
    if (r.left < 6 || r.right > window.innerWidth - 6) return false;
    /* Не блокируем саму карточку-ссылку: лапы заходят на её рамку лишь на 2px. Остальные кнопки - с запасом. */
    if (
      occupiedControls.some(function (o) {
        return o.node !== p && intersects(r, o.rect, 10);
      })
    )
      return false;
    if (eggSpot && intersects(r, eggRect(eggSpot), 14)) return false;
    return !crows.some(function (c) {
      return c !== crow && c.perch && solid(c.perch) && intersects(r, crowRect(c.perch, c.fx), 18);
    });
  }
  function seat(crow, used) {
    var ps = perches();
    /* предпочитаем ещё не использованные карточки, но можно занять другой свободный участок той же */
    ps.sort(function (a, b) {
      return (used.indexOf(a) >= 0 ? 1 : 0) - (used.indexOf(b) >= 0 ? 1 : 0);
    });
    var slots = [];
    ps.forEach(function (p) {
      var r = p.getBoundingClientRect();
      for (var x = 46; x < r.width - 38; x += narrow.matches ? 68 : 86) {
        var fx = x / r.width;
        if (freeSeat(p, fx, crow)) slots.push({ p: p, fx: fx, preferred: used.indexOf(p) < 0 });
      }
    });
    if (!slots.length) {
      crow.perch = null;
      crow.node.classList.add("gone");
      return false;
    }
    var preferred = slots.filter(function (slot) {
      return slot.preferred;
    });
    var slot = pick(preferred.length ? preferred : slots);
    crow.perch = slot.p;
    crow.fx = slot.fx;
    crow.flip = Math.random() < 0.5;
    crow.node.classList.toggle("flip", crow.flip);
    moveCrow(crow);
    return true;
  }
  function moveCrow(crow) {
    if (!crow.perch) return;
    var at = pageXY(crow.perch, crow.fx);
    crow.node.style.transform = "translate(" + Math.round(at.x) + "px," + Math.round(at.y) + "px)";
    /* Прокрутка: под шапкой и нижней навигацией птицу не показываем. Жёрдочка остаётся на месте. */
    var r = crowRect(crow.perch, crow.fx);
    crow.node.style.visibility = fixedChrome.some(function (f) {
      return intersects(r, f, 6);
    })
      ? "hidden"
      : "";
  }
  function place(crow) {
    if (!crow.sitting) return;
    if (!solid(crow.perch) || !freeSeat(crow.perch, crow.fx, crow)) {
      if (!seat(crow, [])) return;
    }
    moveCrow(crow);
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
      seat(c, used);
      if (c.perch) used.push(c.perch);
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
    refreshObstacles();
    if (!seat(crow, [])) {
      later(function () {
        returnCrow(crow);
      }, 5000);
      return;
    }
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
      } else c.sitting = true;
    }
    later(hop, rnd(15000, 30000) * speed());
  }
  function nearCrows(px, py, dist) {
    if (rm.matches) return;
    crows.forEach(function (c) {
      if (!c.sitting) return;
      if (getComputedStyle(c.node).visibility === "hidden") return;
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
    /* Тыква не залезает на монолитовца-мишень, кнопки, ссылки, пасхалку и соседние тыквы:
       сначала свой угол, потом противоположный, а если тесно и там - прячем */
    var busy = mono && mono.classList.contains("hw-target") ? mono.getBoundingClientRect() : null;
    var placed = [];
    function box(k) {
      var r = k.node.getBoundingClientRect();
      var h = r.height || r.width;
      return { left: r.left, right: r.right, top: r.top, bottom: r.top + h };
    }
    function blocked(k) {
      var r = box(k);
      if (busy && intersects(r, busy, 12)) return true;
      if (eggSpot && intersects(r, eggRect(eggSpot), 12)) return true;
      if (
        occupiedControls.some(function (o) {
          /* декор не ловит клики, поэтому может сидеть на карточках-ссылках (своей и соседней);
             не закрываем только обычные кнопки и ссылки */
          return !o.node.matches(PERCH) && !o.node.contains(k.perch) && intersects(r, o.rect, 2);
        })
      )
        return true;
      return placed.some(function (b) {
        return intersects(r, b, 8);
      });
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
      if (blocked(k)) {
        k.fx = 1 - k.home;
        put(k);
      }
      var r = box(k);
      if (
        blocked(k) ||
        fixedChrome.some(function (f) {
          return intersects(r, f, 6);
        })
      )
        k.node.style.visibility = "hidden";
      else placed.push(r);
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
  /* Где прятать: любой видимый некликабельный блок страницы (панели, подвал, вложенные секции).
     Тыква встаёт в пустой угол блока или посередине нижнего края - не поверх текста, картинок,
     кнопок и ссылок. Место выбирается случайно при каждом заходе, поэтому её приходится искать. */
  var EGG_SPOTS = PERCH + ", .site-footer, main section, main aside, main article, .panel, .card";
  var EGG_W = 28,
    EGG_H = 34,
    EGG_IN = 10;
  var eggSpot = null;
  function contentRects(a) {
    var out = [];
    var w = d.createTreeWalker(a, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return /\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var range = d.createRange();
    for (var n = w.nextNode(); n; n = w.nextNode()) {
      range.selectNodeContents(n);
      [].push.apply(out, [].slice.call(range.getClientRects()));
    }
    a.querySelectorAll("img, svg, video, canvas, picture, iframe, input, select, textarea, button, a").forEach(
      function (e) {
        if (!e.closest(".hw-layer")) out.push(e.getBoundingClientRect());
      }
    );
    /* иконки и картинки, нарисованные фоном (div с background-image), - тоже содержимое */
    a.querySelectorAll("*").forEach(function (e) {
      if (e.closest(".hw-layer") || getComputedStyle(e).backgroundImage === "none") return;
      var r = e.getBoundingClientRect();
      if (r.width * r.height < ar(a) * 0.5) out.push(r);
    });
    return out;
  }
  function ar(e) {
    var r = e.getBoundingClientRect();
    return r.width * r.height;
  }
  function eggRect(spot) {
    var r = spot.a.getBoundingClientRect();
    var left = spot.x === 0.5 ? r.left + (r.width - EGG_W) / 2 : spot.x ? r.right - EGG_W - EGG_IN : r.left + EGG_IN;
    var top = spot.y ? r.bottom - EGG_H - EGG_IN : r.top + EGG_IN;
    return { left: left, top: top, right: left + EGG_W, bottom: top + EGG_H };
  }
  /* подписи вида «ПДА // ЭФИР» нарисованы через ::before/::after - их не видно в тексте блока,
     поэтому у блоков с такими подписями верхние углы не используем */
  function pseudoText(e) {
    return ["::before", "::after"].some(function (ps) {
      var c = getComputedStyle(e, ps).content;
      return c && c !== "none" && c !== "normal" && !/^["']\s*["']$/.test(c);
    });
  }
  function labeledTop(a) {
    return pseudoText(a) || [].slice.call(a.children).some(pseudoText);
  }
  function eggFits(spot, full) {
    var a = spot.a;
    if (!a.isConnected || clickable(a) || a.closest("[hidden], dialog, .modal, .hw-layer")) return false;
    var ar = a.getBoundingClientRect();
    if (ar.width < 140 || ar.height < 70) return false;
    var s = getComputedStyle(a);
    if (s.visibility === "hidden" || s.display === "none" || +s.opacity < 0.5) return false;
    /* только внутри видимой панели (рамка или фон) или в подвале - не на голых полях страницы */
    if (!a.classList.contains("site-footer") && !solid(a)) return false;
    var r = eggRect(spot);
    if (r.left < 4 || r.right > window.innerWidth - 4) return false;
    var hit = function (b, pad) {
      return b.width !== 0 && intersects(r, b, pad);
    };
    /* кнопки, текст и картинки проверяем при выборе места; при прокрутке они не сдвигаются относительно блока,
       а закреплённые на экране панели только прячут тыкву (см. placeEgg) */
    if (!full) return true;
    if (!spot.y && labeledTop(a)) return false;
    if (
      occupiedControls.some(function (o) {
        return !o.fixed && hit(o.rect, 12);
      })
    )
      return false;
    return !contentRects(a).some(function (b) {
      return hit(b, 6);
    });
  }
  function pickEggSpot() {
    var spots = [];
    [].slice.call(d.querySelectorAll(EGG_SPOTS)).forEach(function (a) {
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
        [0.5, 1]
      ].forEach(function (c) {
        var spot = { a: a, x: c[0], y: c[1] };
        if (eggFits(spot, true)) spots.push(spot);
      });
    });
    /* подвал широкий и в нём всегда есть пустые углы - если на странице есть другие места, он выпадает редко */
    var inside = spots.filter(function (sp) {
      return !sp.a.classList.contains("site-footer");
    });
    if (inside.length && Math.random() < 0.85) spots = inside;
    return spots.length ? pick(spots) : null;
  }
  function placeEgg() {
    if (!egg || !egg.classList.contains("free")) return;
    if (!eggSpot || !eggFits(eggSpot, false)) eggSpot = pickEggSpot();
    if (!eggSpot) {
      egg.style.visibility = "hidden";
      return;
    }
    var r = eggRect(eggSpot);
    egg.style.transform =
      "translate(" + Math.round(r.left + window.scrollX) + "px," + Math.round(r.top + window.scrollY) + "px)";
    egg.classList.toggle("bl", eggSpot.x !== 1);
    egg.classList.toggle("br", eggSpot.x === 1);
    egg.style.visibility = fixedChrome.some(function (f) {
      return intersects(r, f, 6);
    })
      ? "hidden"
      : "";
  }
  function spawnEgg() {
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
      if (list.length >= EGG_PAGES.length && page) {
        /* награда - звание «Тыквенный сталкер» в своей карточке игрока (рисует my-place.js) */
        var me = null;
        try {
          me = JSON.parse(localStorage.getItem("zoneMyPlayer") || "null");
        } catch (e) {}
        msg =
          me && me.n
            ? "Все тыквы Зоны собраны! В вашем личном деле - звание «Тыквенный сталкер» 🎃"
            : "Все тыквы Зоны собраны! Отметьте себя в Топ-100 («Это я») - и в карточке появится звание 🎃";
      }
      egg.querySelector(".hw-bubble").textContent = msg;
      egg.classList.remove("boo");
      void egg.offsetWidth;
      egg.classList.add("boo");
    });
    eggSpot = pickEggSpot();
    if (eggSpot) {
      egg.classList.add("free");
      layer.appendChild(egg);
      placeEgg();
      return;
    }
    /* свободного угла нигде нет - старое место: отдельная строка в подвале */
    var footer = d.querySelector(".site-footer");
    if (!footer || clickable(footer)) {
      egg = null;
      return;
    }
    var host = el("div", "hw-egg-slot");
    host.classList.add(Math.random() < 0.5 ? "left" : "right");
    footer.appendChild(host);
    host.appendChild(egg);
    egg.classList.add(host.classList.contains("left") ? "bl" : "br");
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
      refreshObstacles();
      placeEgg();
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
    refreshObstacles();
    spawnEgg();
    spawnCrows();
    spawnPumpkins();
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
    window.addEventListener("scroll", relayout, { passive: true });
    if (window.ResizeObserver) {
      ro = new ResizeObserver(relayout);
      ro.observe(d.body);
    }
    /* блоки страницы дорисовываются скриптами - сверяем положение ещё пару раз */
    later(relayout, 800);
    later(relayout, 2500);
    /* блоки могут сворачиваться и прятаться (вкладки, «Все новости») - регулярно сверяем жёрдочки */
    (function watch() {
      /* содержимое блока могло дорисоваться поверх тыквы-пасхалки - тогда она перепрятывается */
      if (eggSpot && egg && egg.classList.contains("free") && !eggFits(eggSpot, true)) eggSpot = null;
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
    d.querySelectorAll(".hw-egg-slot").forEach(function (n) {
      n.remove();
    });
    light = burer = mono = egg = eggSpot = null;
    crows = [];
    pumpkins = [];
    d.querySelectorAll(".hw-tk, .hw-flick").forEach(function (n) {
      n.classList.remove("hw-tk", "hw-flick");
    });
    d.removeEventListener("pointermove", onMove);
    d.removeEventListener("pointerdown", onDown);
    window.removeEventListener("resize", relayout);
    window.removeEventListener("scroll", relayout);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (ro) ro.disconnect();
  }
  function restart() {
    stop();
    if (root.classList.contains("hw")) start();
  }

  window.HOTZ_HW = { start: restart, stop: stop };
  if (root.classList.contains("hw")) start();
})();
