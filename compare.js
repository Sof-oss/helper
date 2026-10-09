/* Сравнение двух игроков (compare.html): два «Личных дела» рядом по всем семи рейтингам и уровню.
   Адрес /compare?a=<ID>&b=<ID> - ID как в ссылке на карточку /p/<ID>; адрес обновляется при каждом выборе,
   поэтому им можно сразу поделиться. Входы: кнопка «Сравнить» в карточке игрока и в панели «Моё место» (Топ-100),
   на главной в блоке «Моё место».
   Данные - top100-players.json (как у карточки игрока), помощники и поле поиска - zone-players.js */
(function () {
  "use strict";
  const ZP = window.ZonePlayers;
  const root = document.getElementById("vsRoot");
  if (!ZP || !root) return;
  const { TABS, esc, fmt } = ZP;
  const SIDES = ["a", "b"];
  const params = new URLSearchParams(location.search);
  const ids = { a: params.get("a") || null, b: params.get("b") || null };
  let data = null;

  const ICON = {
    swap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h14M14.5 4.5 18 8l-3.5 3.5"/><path d="M20 16H6M9.5 12.5 6 16l3.5 3.5"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
    me: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };

  /* ---------- оболочка: два поля выбора и кнопки ---------- */
  root.innerHTML =
    '<div class="vs-pickers">' +
    SIDES.map(
      (s, i) =>
        '<div class="vs-pick vs-pick-' +
        s +
        '"><label for="vsInput' +
        s +
        '">Игрок ' +
        (i + 1) +
        '</label><div class="vs-pick-in"><input id="vsInput' +
        s +
        '" type="search" placeholder="Ник игрока" spellcheck="false"></div></div>' +
        (i === 0
          ? '<button type="button" class="mp-ic vs-swap" id="vsSwap" title="Поменять местами" aria-label="Поменять игроков местами">' +
            ICON.swap +
            "</button>"
          : "")
    ).join("") +
    "</div>" +
    '<div class="vs-tools" id="vsTools"></div>' +
    '<div class="vs-body" id="vsBody"><div class="vs-empty"><i class="vs-spin"></i>Устанавливаем связь с сетью сталкеров…</div></div>';
  SIDES.forEach(s => {
    const inp = document.getElementById("vsInput" + s);
    ZP.picker(inp, m => {
      if (!m.id) return;
      ids[s] = m.id;
      inp.value = "";
      update();
    });
  });
  document.getElementById("vsSwap").addEventListener("click", () => {
    [ids.a, ids.b] = [ids.b, ids.a];
    update();
  });

  function syncUrl() {
    const q = new URLSearchParams();
    SIDES.forEach(s => ids[s] && q.set(s, ids[s]));
    const qs = q.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }
  function update() {
    syncUrl();
    draw();
  }

  /* ---------- расчёты как в карточке игрока (player-card.js) ---------- */
  function valueAt(p, mi, di) {
    let v = null;
    for (const pt of p.s) {
      if (pt[0] > di) break;
      const x = pt[2 + mi];
      if (x !== null && x !== undefined) v = x;
    }
    return v;
  }
  /* показатели: семь рейтингов в порядке вкладок Топ-100 и уровень (mi = -1) */
  function rowsMeta() {
    return TABS.filter(t => data.metrics.includes(t.key))
      .map(t => ({ key: t.key, label: t.label, accent: t.accent, mi: data.metrics.indexOf(t.key) }))
      .concat({ key: "level", label: "Уровень", accent: "#e7f0f8", mi: -1 });
  }
  const valOf = (p, mi) => (mi < 0 ? p.l : p.v[mi] || 0);
  /* прирост с прошлого обновления рейтинга */
  function deltaOf(p, mi) {
    const bi = data.dates.length - 2;
    if (bi < 0) return null;
    const was = valueAt(p, mi, bi);
    return was === null ? null : valOf(p, mi) - was;
  }

  /* ---------- шапка «Личного дела» (разметка и стили - как в карточке игрока) ---------- */
  function headMarkup(id, p, mine) {
    const color = ZP.factionColor(p.g),
      emb = p.g && window.__factionEmblem ? window.__factionEmblem(p.g) : null;
    const style = emb
      ? ' style="--f:' + esc(color) + ";--bg:url(/assets/bg-" + emb.key + '-1280.webp)"'
      : ' style="--f:' + esc(color) + '"';
    const row = (k, v) => "<div><dt>" + k + "</dt><dd>" + v + "</dd></div>";
    return (
      '<header class="pc-head vs-head' +
      (emb ? " has-bg" : "") +
      '"' +
      style +
      '><div class="pc-head-strip"><span>Личное дело <b><span class="pc-no">№</span>' +
      esc(String(id).padStart(6, "0")) +
      '</b></span><span class="pc-signal' +
      (p.off ? " off" : "") +
      '"><i></i><span>' +
      (p.off ? "Сигнал потерян" : "Сигнал активен") +
      "</span></span></div>" +
      '<div class="pc-head-main"><div class="pc-patch">' +
      ZP.patchSvg(p.g, color, p.n) +
      '</div><div class="pc-head-text"><span class="pc-callsign">Позывной' +
      (mine ? ' <em class="vs-you">вы</em>' : "") +
      '</span><h2><a href="/p/' +
      encodeURIComponent(id) +
      '" title="Открыть карточку игрока">' +
      esc(p.n) +
      '</a></h2><dl class="pc-dossier">' +
      row("Группировка", '<span class="pc-faction"><i></i>' + (p.g ? esc(p.g) : "Одиночка") + "</span>") +
      row("Звание", esc(ZP.titleOf(p.l))) +
      (p.z ? row("В Зоне", esc(p.z)) : "") +
      "</dl></div></div></header>"
    );
  }
  function emptyCard(side) {
    const me = ZP.getMe(),
      other = ids[side === "a" ? "b" : "a"];
    return (
      '<article class="vs-card vs-card-' +
      side +
      ' vs-card-empty"><div class="vs-placeholder"><b>Игрок ' +
      (side === "a" ? 1 : 2) +
      "</b><p>Найдите игрока по нику в поле выше</p>" +
      (me && me.id && me.id !== other
        ? '<button type="button" class="mp-btn ghost" data-vs-me="' + side + '">' + ICON.me + "Подставить меня</button>"
        : "") +
      "</div></article>"
    );
  }

  function draw() {
    const body = document.getElementById("vsBody"),
      tools = document.getElementById("vsTools");
    if (!data) return;
    SIDES.forEach(s => {
      if (ids[s] && !data.players[ids[s]]) ids[s] = null;
    });
    const me = ZP.getMe();
    const P = { a: ids.a && data.players[ids.a], b: ids.b && data.players[ids.b] };
    document.title = P.a && P.b ? P.a.n + " vs " + P.b.n + " - Сердце Зоны" : "Сравнение игроков - Сердце Зоны";
    const meta = rowsMeta();
    const score = { a: 0, b: 0 };
    const rows = { a: [], b: [] };
    meta.forEach(m => {
      const v = { a: P.a ? valOf(P.a, m.mi) : null, b: P.b ? valOf(P.b, m.mi) : null };
      const both = P.a && P.b;
      const win = both && v.a !== v.b ? (v.a > v.b ? "a" : "b") : null;
      if (win && m.mi >= 0) score[win]++;
      const max = Math.max(v.a || 0, v.b || 0) || 1;
      SIDES.forEach(s => {
        if (!P[s]) return;
        const o = s === "a" ? "b" : "a",
          rank = m.mi >= 0 ? P[s].r[m.mi] : null,
          d = deltaOf(P[s], m.mi),
          diff = both ? v[s] - v[o] : 0;
        rows[s].push(
          '<li class="vs-row' +
            (win === s ? " win" : win ? " lose" : both ? " tie" : "") +
            '" style="--c:' +
            m.accent +
            ";--w:" +
            ((v[s] / max) * 100).toFixed(1) +
            '%"><span class="vs-lbl">' +
            esc(m.label) +
            "</span>" +
            (rank
              ? '<span class="vs-rank' +
                (rank <= 3 ? " m" + rank : rank <= 100 ? " top" : "") +
                '" title="Место в рейтинге">#' +
                fmt(rank) +
                "</span>"
              : m.mi >= 0
                ? '<span class="vs-rank none" title="Нет в рейтинге">-</span>'
                : "") +
            '<b class="vs-val">' +
            fmt(v[s]) +
            "</b>" +
            '<span class="vs-sub">' +
            (win === s ? '<span class="vs-diff">+' + fmt(diff) + "</span>" : "") +
            (d
              ? '<span class="vs-delta ' +
                (d > 0 ? "up" : "down") +
                '" title="С прошлого обновления">' +
                (d > 0 ? "▲ " : "▼ ") +
                fmt(Math.abs(d)) +
                "</span>"
              : "") +
            '</span><i class="vs-bar" aria-hidden="true"></i></li>'
        );
      });
    });
    const card = s =>
      P[s]
        ? '<article class="vs-card vs-card-' +
          s +
          '" aria-label="' +
          esc(P[s].n) +
          '">' +
          headMarkup(ids[s], P[s], !!me && me.id === ids[s]) +
          '<ul class="vs-rows">' +
          rows[s].join("") +
          "</ul></article>"
        : emptyCard(s);
    const both = P.a && P.b;
    const total = meta.filter(m => m.mi >= 0).length;
    body.innerHTML =
      (both
        ? '<div class="vs-score" role="status"><span class="vs-score-n vs-a' +
          (score.a > score.b ? " lead" : "") +
          '">' +
          esc(P.a.n) +
          '</span><b><span class="' +
          (score.a > score.b ? "lead" : "") +
          '">' +
          score.a +
          '</span><i>:</i><span class="' +
          (score.b > score.a ? "lead" : "") +
          '">' +
          score.b +
          '</span></b><span class="vs-score-n vs-b' +
          (score.b > score.a ? " lead" : "") +
          '">' +
          esc(P.b.n) +
          "</span><small>Перевес в рейтингах из " +
          total +
          (total - score.a - score.b ? ", поровну - " + (total - score.a - score.b) : "") +
          "</small></div>"
        : "") +
      '<div class="vs-cards">' +
      card("a") +
      card("b") +
      "</div>" +
      '<p class="vs-note">Место - среди всех игроков, ▲▼ - изменение с прошлого обновления рейтинга (' +
      esc(data.updated || "") +
      " МСК), +N у лучшего - насколько больше, чем у соперника.</p>";
    tools.innerHTML =
      (both
        ? '<button type="button" class="mp-btn" id="vsShare">' + ICON.link + "Скопировать ссылку на сравнение</button>"
        : "") +
      (ids.a || ids.b ? '<button type="button" class="mp-btn ghost" id="vsClear">' + ICON.x + "Очистить</button>" : "");
  }

  /* ---------- кнопки ---------- */
  root.addEventListener("click", e => {
    const m = e.target.closest("[data-vs-me]");
    if (m) {
      const me = ZP.getMe();
      if (me && me.id) ids[m.dataset.vsMe] = me.id;
      update();
      return;
    }
    if (e.target.closest("#vsClear")) {
      ids.a = ids.b = null;
      update();
      document.getElementById("vsInputa").focus();
      return;
    }
    const sh = e.target.closest("#vsShare");
    if (sh) {
      const url = location.href,
        done = ok => {
          sh.classList.toggle("ok", ok);
          sh.lastChild.textContent = ok ? "Ссылка скопирована" : "Скопируйте адрес из строки браузера";
          setTimeout(() => {
            sh.classList.remove("ok");
            sh.lastChild.textContent = "Скопировать ссылку на сравнение";
          }, 1800);
        };
      if (navigator.share && window.matchMedia && matchMedia("(pointer:coarse)").matches)
        navigator.share({ title: document.title, url }).catch(() => {});
      else if (navigator.clipboard && window.isSecureContext)
        navigator.clipboard.writeText(url).then(
          () => done(true),
          () => done(false)
        );
      else done(false);
    }
  });

  ZP.load()
    .then(d => {
      data = d;
      /* пустое сравнение - сразу подставляем себя первым */
      const me = ZP.getMe();
      if (!ids.a && !ids.b && me && me.id && d.players[me.id]) ids.a = me.id;
      syncUrl();
      draw();
    })
    .catch(() => {
      document.getElementById("vsBody").innerHTML =
        '<div class="vs-empty">Не удалось загрузить карточки игроков. Проверьте соединение и обновите страницу.</div>';
    });
})();
