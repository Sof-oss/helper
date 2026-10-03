/* ============================================================================
   Аномалия «Электра» — ходит по странице поверх фона, обходя панели, таблицы и
   модальные окна (разряды не рисуются внутри их прямоугольников).
   Плюс периодический треск: синтез на WebAudio, по умолчанию выключен,
   включается кнопкой в шапке (браузеры всё равно не дают звук без действия).

   Скрипт запускается и сборкой (build.js гоняет скрипты страницы в заглушке
   DOM), поэтому всё проверяется на наличие: без браузера он просто выходит.
   ============================================================================ */
(function () {
  var d = document;
  if (!d.documentElement || typeof d.createElement !== "function" || !d.body || !d.body.appendChild) return;
  if (typeof requestAnimationFrame !== "function") return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* ---------- что считаем «глухими» панелями: внутри них разряды не рисуем ---------- */
  var SOLID = [
    ".site-header", ".tabbar", ".result-panel", ".result-title", ".section-heading", ".sidebar",
    ".home-card", ".home-hero", ".top100-panel", ".top100-meta", ".t100-tools", ".info-group",
    ".info-lead", ".damage-footnote", ".talent-dialog", ".talent-detail-modal", ".gear-info-window",
    ".tokens-window", ".data-table", ".theme-switch", ".sound-toggle", "h1", "h2", "h3"
  ].join(",");

  var cv = d.createElement("canvas");
  cv.className = "anomaly";
  cv.setAttribute("aria-hidden", "true");
  d.body.appendChild(cv);
  var ctx = cv.getContext("2d");
  var dpr = 1, W = 0, H = 0;
  var rects = [];

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function collectRects() {
    var list = [];
    var nodes = d.querySelectorAll(SOLID);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var st = window.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) < 0.05) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) continue;
      /* запас 4 px, чтобы свечение разряда не залезало на кромку панели */
      list.push({ x: r.left - 4, y: r.top - 4, w: r.width + 8, h: r.height + 8 });
    }
    rects = list;
  }
  var blocked = function (x, y) {
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
    }
    return false;
  };

  /* ---------- цвета темы ---------- */
  var css = function (name, fallback) {
    var v = window.getComputedStyle(d.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };

  /* ---------- путь ядра: блуждание по экрану ---------- */
  var core = { x: 0, y: 0, tx: 0, ty: 0, speed: 240 };
  /* цель выбираем только в свободном месте, чтобы аномалия не «пряталась» надолго */
  function pickTarget() {
    for (var i = 0; i < 24; i++) {
      var tx = 70 + Math.random() * Math.max(140, W - 140);
      var ty = 90 + Math.random() * Math.max(140, H - 180);
      if (!blocked(tx, ty)) { core.tx = tx; core.ty = ty; break; }
      if (i === 23) { core.tx = tx; core.ty = ty; }
    }
    core.speed = 210 + Math.random() * 180;   /* достаточно быстро, но без рывков */
  }
  resize(); collectRects();
  core.x = W * 0.3; core.y = H * 0.35; pickTarget();

  /* кластер: главный плазмоид и два спутника, как у «Электры» */
  var orbs = [
    { dx: 0, dy: 0, r: 17, ph: 0 },
    { dx: -34, dy: 20, r: 10, ph: 1.7 },
    { dx: 30, dy: -22, r: 8, ph: 3.1 }
  ];

  /* ---------- треск ---------- */
  var SOUND_KEY = "zoneAnomalySound";
  var ac = null, master = null, soundOn = false, nextZap = 0;
  try { soundOn = localStorage.getItem(SOUND_KEY) === "1"; } catch (e) {}
  function audio() {
    if (ac) return ac;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.16;
    master.connect(ac.destination);
    return ac;
  }
  function zap() {
    if (!audio() || ac.state === "suspended") return;
    var dur = 0.10 + Math.random() * 0.22;
    var buf = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      var t = i / data.length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6);
    }
    var src = ac.createBufferSource(); src.buffer = buf;
    var bp = ac.createBiquadFilter(); bp.type = "bandpass";
    bp.frequency.value = 1500 + Math.random() * 2600; bp.Q.value = 0.9;
    var g = ac.createGain(); var now = ac.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.9, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(now); src.stop(now + dur + 0.02);
  }

  /* ---------- кнопка звука в шапке ---------- */
  var header = d.querySelector(".header-inner");
  if (header && !d.querySelector(".sound-toggle")) {
    var b = d.createElement("button");
    b.type = "button";
    b.className = "sound-toggle";
    b.id = "soundToggle";
    b.setAttribute("aria-label", "Звук аномалии");
    b.setAttribute("aria-pressed", String(soundOn));
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3l4-3.2v11.4l-4-3.2H4z"/><path class="waves" d="M14.6 8.6a4.6 4.6 0 0 1 0 6.8M17.2 6.4a8 8 0 0 1 0 11.2"/></svg>';
    b.addEventListener("click", function () {
      soundOn = !soundOn;
      b.setAttribute("aria-pressed", String(soundOn));
      try { localStorage.setItem(SOUND_KEY, soundOn ? "1" : "0"); } catch (e) {}
      if (soundOn) { var a = audio(); if (a && a.state === "suspended") a.resume(); nextZap = 0; }
      else if (ac) { try { ac.suspend(); } catch (e) {} }
    });
    header.appendChild(b);
  }

  /* ---------- отрисовка ---------- */
  var last = 0, acc = 0, t = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (d.hidden) return;
    if (last && now - last < 22) return;         /* ~45 кадров в секунду */
    last = now;
    var dt = Math.min(0.05, (now - (acc || now)) / 1000); acc = now;
    t += dt;

    /* движение ядра к цели + лёгкое покачивание */
    var dx = core.tx - core.x, dy = core.ty - core.y;
    var dist = Math.hypot(dx, dy);
    if (dist < 18) pickTarget();
    else { core.x += (dx / dist) * core.speed * dt; core.y += (dy / dist) * core.speed * dt; }
    var cx = core.x + Math.sin(t * 2.1) * 7;
    var cy = core.y + Math.cos(t * 1.6) * 6;

    var accent = css("--accent", "#57c4f0");
    var accent3 = css("--accent-3", "#e0574f");

    ctx.clearRect(0, 0, W, H);

    /* центры плазмоидов: небольшое дрожание вокруг ядра */
    var pts = orbs.map(function (o, i) {
      return {
        x: cx + o.dx + Math.sin(t * (3.1 + i) + o.ph) * 9,
        y: cy + o.dy + Math.cos(t * (2.4 + i) + o.ph) * 7,
        r: o.r * (1 + Math.sin(t * 11 + o.ph) * 0.16)
      };
    });

    /* свечение плазмоидов */
    ctx.globalCompositeOperation = "lighter";
    for (var o = 0; o < pts.length; o++) {
      var p = pts[o];
      if (blocked(p.x, p.y)) continue;
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.4);
      g.addColorStop(0, "rgba(255,255,255,.98)");
      g.addColorStop(0.25, accent);
      g.addColorStop(0.6, "rgba(150,205,255,.45)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.4, 0, Math.PI * 2); ctx.fill();
    }

    /* разряды: между плазмоидами и наружу, пересобираются каждые ~50 мс */
    function bolt(x1, y1, x2, y2, seg, jitter, width) {
      var px = x1, py = y1, started = false;
      ctx.beginPath(); ctx.moveTo(x1, y1);
      for (var s = 1; s <= seg; s++) {
        var k = s / seg;
        var nx = x1 + (x2 - x1) * k + (Math.random() - 0.5) * jitter * Math.sin(Math.PI * k);
        var ny = y1 + (y2 - y1) * k + (Math.random() - 0.5) * jitter * Math.sin(Math.PI * k);
        if (blocked(nx, ny) || blocked((px + nx) / 2, (py + ny) / 2)) { started = false; px = nx; py = ny; continue; }
        if (!started) { ctx.moveTo(px, py); started = true; }
        ctx.lineTo(nx, ny);
        px = nx; py = ny;
      }
      /* широкий тусклый штрих + узкий яркий: даёт объём свечения */
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = width * 2.6;
      ctx.strokeStyle = accent;
      ctx.shadowColor = accent; ctx.shadowBlur = 22;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = width;
      ctx.strokeStyle = "#eaf6ff";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    /* внутренние связи между плазмоидами */
    for (var i = 1; i < pts.length; i++) {
      bolt(pts[0].x, pts[0].y, pts[i].x, pts[i].y, 5, 16, 1.6);
    }
    /* внешние разряды */
    var N = 8;
    for (var k2 = 0; k2 < N; k2++) {
      var ang = (k2 / N) * Math.PI * 2 + Math.sin(t * (2.1 + k2)) * 1.1;
      var len = 90 + Math.random() * 190;
      var from = pts[k2 % pts.length];
      bolt(from.x, from.y, from.x + Math.cos(ang) * len, from.y + Math.sin(ang) * len, 8, 30, 1 + Math.random() * 1.6);
    }
    /* редкая яркая вспышка всего кластера */
    if (Math.random() < 0.06) {
      ctx.globalAlpha = 0.25 + Math.random() * 0.3;
      ctx.fillStyle = accent3;
      ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 60 + Math.random() * 40, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";

    /* звук: редкий треск, интервал случайный */
    if (soundOn) {
      if (!nextZap) nextZap = now + 600 + Math.random() * 1200;
      else if (now > nextZap) { zap(); nextZap = now + 1600 + Math.random() * 3200; }
    }
  }
  requestAnimationFrame(frame);

  /* пересчёт препятствий и размеров */
  var rt = null;
  function refresh() { if (rt) return; rt = setTimeout(function () { rt = null; resize(); collectRects(); }, 200); }
  window.addEventListener("resize", refresh);
  window.addEventListener("scroll", function () { if (rt) return; rt = setTimeout(function () { rt = null; collectRects(); }, 120); }, { passive: true });
  d.addEventListener("click", function () { collectRects(); }, true);
  if (window.MutationObserver) {
    new MutationObserver(function () { if (rt) return; rt = setTimeout(function () { rt = null; resize(); collectRects(); }, 250); })
      .observe(d.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "style"] });
  }
  collectRects();
})();
