/* «Моё место»: посетитель отмечает себя (ник из Топ-100 или любой игрок из карточек), дальше
   - Топ-100 (top100.html): его строка подсвечена во всех рейтингах, панель «Моё место» над таблицей,
     кнопка «К моему месту» прокручивает к строке (сбрасывает поиск и фильтр, предлагает рейтинги, где он есть);
     в карточке игрока - кнопки «Это я» и «Сравнить»;
   - главная (index.html): блок с местами во всех семи рейтингах и изменением с прошлого обновления.
   Места и изменения - из top100-data.js (TOP100_* и TOP100_CHANGES, те же стрелки, что в таблице), места вне сотни -
   из карточек игроков top100-players.json. На главной top100-data.js догружается, только если посетитель себя отметил.
   Нужен zone-players.js (window.ZonePlayers). top100.js, player-card.js и разметку страниц не трогает:
   панель и кнопки вставляются сами, за перерисовкой таблицы и карточки следит MutationObserver */
(function () {
  "use strict";
  const ZP = window.ZonePlayers;
  if (!ZP || !document.body) return;
  const { TABS, esc, fmt } = ZP;
  const TAB_KEY = "gameHelperTop100Tab"; // выбранная вкладка рейтинга (top100.js)
  const $ = id => document.getElementById(id);
  const reduce = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- данные рейтинга ---------- */
  /* период «с прошлого обновления»: в top100-data.js он совпадает с периодом, который начинается с прошлой выгрузки
     (TOP100_HISTORY.from), обычно это «За сутки». Нет такого - берём первый период, как таблица по умолчанию */
  function lastPeriod() {
    const list = Array.isArray(window.TOP100_PERIODS) ? window.TOP100_PERIODS : [],
      h = window.TOP100_HISTORY;
    let p = list.find(x => x.key === "last") || null;
    if (!p && h && h.from) {
      const m = String(h.from).match(/^(\d{4})-(\d\d)-(\d\d)_(\d\d)-(\d\d)/);
      if (m) p = list.find(x => x.from === m[3] + "." + m[2] + "." + m[1] + " " + m[4] + ":" + m[5]) || null;
    }
    const exact = !!p;
    p = p || list[0] || null;
    const ch = p && window.TOP100_CHANGES && window.TOP100_CHANGES[p.key];
    return {
      period: p,
      exact,
      changes: ch || { rank: window.TOP100_RANK, delta: window.TOP100_DELTA }
    };
  }
  /* место игрока по нику в каждом рейтинге top100-data.js: {rank, value, move, delta} или null */
  function topPlaces(nick) {
    const { changes } = lastPeriod();
    const out = {};
    TABS.forEach(t => {
      const rows = window[t.data] || [];
      const i = rows.findIndex(r => r[0] === nick);
      if (i < 0) {
        out[t.key] = null;
        return;
      }
      const rk = changes.rank && changes.rank[t.key],
        dl = changes.delta && changes.delta[t.key];
      out[t.key] = {
        rank: rows[i][4] || i + 1,
        value: rows[i][2],
        move: rk && nick in rk ? rk[nick] : undefined,
        delta: dl && nick in dl ? dl[nick] : undefined
      };
    });
    return out;
  }
  const short = s => {
    const m = String(s || "").match(/^(\d\d\.\d\d)\.\d{4}\s+(\d\d:\d\d)/);
    return m ? m[1] + " " + m[2] : String(s || "");
  };
  const moveMarkup = (v, cls) =>
    v === null
      ? '<i class="' + cls + ' new" title="Не было в сотне">new</i>'
      : v
        ? '<i class="' +
          cls +
          " " +
          (v > 0 ? "up" : "down") +
          '" title="' +
          (v > 0 ? "Поднялся на " : "Опустился на ") +
          Math.abs(v) +
          '">' +
          (v > 0 ? "▲" : "▼") +
          Math.abs(v) +
          "</i>"
        : v === 0
          ? '<i class="' + cls + ' same" title="Место не изменилось">=</i>'
          : "";

  const ICON = {
    me: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4"/></svg>',
    go: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v13M6.5 11.5 12 17l5.5-5.5"/><path d="M5 20.5h14"/></svg>',
    vs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h11M11.5 3.5 15 7l-3.5 3.5"/><path d="M20 17H9M12.5 13.5 9 17l3.5 3.5"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.6-3.6 3.4-5.6 7-5.6s6.4 2 7 5.6"/></svg>'
  };
  const compareHref = (a, b) =>
    "/compare?a=" + encodeURIComponent(a) + (b && b !== a ? "&b=" + encodeURIComponent(b) : "");

  /* ======================= Топ-100 ======================= */
  function initTop100() {
    const wrap = $("top100TableWrap"),
      tools = document.querySelector(".top100-panel .t100-tools");
    if (!wrap || !tools) return;
    tools.insertAdjacentHTML(
      "afterend",
      '<div class="mp-bar" id="mpBar" role="region" aria-label="Моё место"></div><p class="mp-status" id="mpStatus" aria-live="polite" hidden></p>'
    );
    const bar = $("mpBar"),
      status = $("mpStatus");
    let picking = false;

    const currentTab = () => {
      const a = document.querySelector("#top100Tabs .top100-tab.active");
      return (a && a.dataset.top100Tab) || TABS[0].key;
    };
    const tabMeta = k => TABS.find(t => t.key === k) || TABS[0];

    function renderBar() {
      const me = ZP.getMe();
      if (picking || !me) {
        bar.className = "mp-bar" + (picking ? " picking" : " empty");
        bar.innerHTML =
          '<span class="mp-bar-ic" aria-hidden="true">' +
          ICON.me +
          "</span>" +
          (picking
            ? '<label class="mp-pick"><span class="sr-only">Ваш ник</span><input id="mpPickInput" type="search" placeholder="Ваш ник в игре" spellcheck="false"></label>' +
              '<button type="button" class="mp-btn ghost" data-mp="cancel">Отмена</button>'
            : '<span class="mp-bar-text"><b>Моё место</b><small>Укажите свой ник - ваша строка будет подсвечена, а на главной появится динамика места</small></span>' +
              '<button type="button" class="mp-btn" data-mp="pick">Указать себя</button>');
        if (picking) {
          const inp = $("mpPickInput");
          ZP.picker(inp, m => {
            picking = false;
            ZP.setMe(m);
            setTimeout(() => goToMe(), 50);
          });
          inp.focus();
        }
        return;
      }
      const places = topPlaces(me.n),
        tab = currentTab(),
        here = places[tab];
      bar.className = "mp-bar set";
      bar.innerHTML =
        '<span class="mp-bar-ic" aria-hidden="true">' +
        ICON.me +
        "</span>" +
        '<span class="mp-bar-text"><small>Моё место</small><b title="' +
        esc(me.n) +
        '">' +
        esc(me.n) +
        "</b></span>" +
        '<span class="mp-bar-place" style="--c:' +
        tabMeta(tab).accent +
        '">' +
        (here
          ? "<b>#" +
            here.rank +
            "</b>" +
            moveMarkup(here.move, "mp-move") +
            "<small>" +
            esc(tabMeta(tab).label) +
            "</small>"
          : "<small>в «" + esc(tabMeta(tab).label) + "» нет в сотне</small>") +
        "</span>" +
        '<span class="mp-bar-btns"><button type="button" class="mp-btn" data-mp="go">' +
        ICON.go +
        "К моему месту</button>" +
        (me.id ? '<a class="mp-btn ghost" href="' + compareHref(me.id) + '">' + ICON.vs + "Сравнить</a>" : "") +
        '<button type="button" class="mp-ic" data-mp="pick" title="Выбрать другого игрока" aria-label="Выбрать другого игрока">' +
        ICON.edit +
        '</button><button type="button" class="mp-ic" data-mp="forget" title="Снять отметку" aria-label="Снять отметку «это я»">' +
        ICON.x +
        "</button></span>";
    }

    /* подсветка своей строки; таблицу top100.js перерисовывает целиком - следим за этим */
    function markRows() {
      const me = ZP.getMe();
      wrap.querySelectorAll("tr.mp-me").forEach(tr => tr.classList.remove("mp-me"));
      if (!me) return null;
      let row = null;
      wrap.querySelectorAll("[data-t100-player]").forEach(b => {
        if (b.dataset.t100Player === me.n) {
          const tr = b.closest("tr");
          tr.classList.add("mp-me");
          if (!row) row = tr;
        }
      });
      return row;
    }
    new MutationObserver(() => {
      markRows();
      if (!picking) renderBar();
    }).observe(wrap, { childList: true });

    function say(html) {
      status.innerHTML = html;
      status.hidden = !html;
    }
    let viaKeyboard = false; // фокус на строку переводим, только если «К моему месту» нажали с клавиатуры
    function scrollToRow(row) {
      row.scrollIntoView({ block: "center", behavior: reduce() ? "auto" : "smooth" });
      row.classList.remove("mp-flash");
      void row.offsetWidth;
      row.classList.add("mp-flash");
      const b = viaKeyboard && row.querySelector("[data-t100-player]");
      if (b) b.focus({ preventScroll: true });
    }
    function goToMe() {
      const me = ZP.getMe();
      if (!me) {
        picking = true;
        renderBar();
        return;
      }
      say("");
      let row = markRows();
      if (!row) {
        /* строку мог спрятать поиск или фильтр по отряду - сбрасываем их */
        const s = $("top100Search");
        if (s && s.value) {
          s.value = "";
          s.dispatchEvent(new Event("input", { bubbles: true }));
        }
        const all = document.querySelector('[data-t100-faction=""]');
        if (all && all.getAttribute("aria-pressed") !== "true") all.click();
        row = markRows();
      }
      if (row) {
        scrollToRow(row);
        return;
      }
      const places = topPlaces(me.n),
        other = TABS.filter(t => places[t.key]);
      if (other.length)
        say(
          "В рейтинге «" +
            esc(tabMeta(currentTab()).label) +
            "» вас нет в сотне. Вы есть в: " +
            other
              .map(
                t =>
                  '<button type="button" class="mp-chip" data-mp-tab="' +
                  t.key +
                  '" style="--c:' +
                  t.accent +
                  '">' +
                  esc(t.label) +
                  " <b>#" +
                  places[t.key].rank +
                  "</b></button>"
              )
              .join("")
        );
      else
        say(
          "Вас нет в сотне ни одного рейтинга. Места среди всех игроков - в карточке" +
            (me.id ? ': <button type="button" class="mp-chip" data-mp="card">Личное дело</button>' : ".")
        );
    }

    bar.addEventListener("click", e => {
      const b = e.target.closest("[data-mp]");
      if (!b) return;
      const act = b.dataset.mp;
      if (act === "pick") {
        picking = true;
        say("");
        renderBar();
      } else if (act === "cancel") {
        picking = false;
        renderBar();
      } else if (act === "forget") {
        ZP.setMe(null);
        say("");
      } else if (act === "go") {
        viaKeyboard = e.detail === 0;
        goToMe();
      }
    });
    bar.addEventListener("keydown", e => {
      if (e.key === "Escape" && picking) {
        picking = false;
        renderBar();
      }
    });
    status.addEventListener("click", e => {
      const t = e.target.closest("[data-mp-tab]");
      if (t) {
        const btn = document.querySelector('[data-top100-tab="' + t.dataset.mpTab + '"]');
        if (btn) btn.click();
        /* смена вкладки может идти через View Transition - ждём, пока таблица перерисуется */
        setTimeout(goToMe, 80);
        return;
      }
      const me = ZP.getMe();
      if (e.target.closest('[data-mp="card"]') && me && me.id) location.hash = "#p=" + encodeURIComponent(me.id);
    });
    document.addEventListener("zone:me", () => {
      picking = false;
      markRows();
      renderBar();
    });

    /* имя поменялось в игре: по id из карточек обновляем сохранённый ник (тихо, если карточки уже скачаны) */
    const me0 = ZP.getMe();
    if (me0 && me0.id)
      ZP.load()
        .then(d => {
          const p = d.players[me0.id];
          if (p && p.n !== me0.n) ZP.setMe({ id: me0.id, n: p.n });
        })
        .catch(() => {});
    else if (me0 && !me0.id)
      ZP.load()
        .then(d => d.idByNick[me0.n] && ZP.setMe({ id: d.idByNick[me0.n], n: me0.n }))
        .catch(() => {});

    renderBar();
    markRows();
    /* /top100#me - пришли с главной: к своей строке (или выбрать себя) */
    if (location.hash === "#me") {
      history.replaceState(null, "", location.pathname + location.search);
      setTimeout(goToMe, 150);
    }
    initCard();
  }

  /* ---------- карточка игрока (player-card.js): «Это я» и «Сравнить» под шапкой «Личного дела» ---------- */
  function initCard() {
    const curId = () => {
      const m = location.pathname.match(/^\/p\/([^/]+)/) || location.hash.match(/^#p=(.+)$/);
      return m ? decodeURIComponent(m[1]) : null;
    };
    function decorate(body) {
      const head = body.querySelector(".pc-head");
      if (!head || body.querySelector(".mp-card-acts")) return;
      const id = curId(),
        h2 = body.querySelector("#pcTitle");
      if (!id || !h2) return;
      const me = ZP.getMe(),
        mine = !!me && (me.id === id || (!me.id && me.n === h2.textContent));
      head.insertAdjacentHTML(
        "afterend",
        '<div class="mp-card-acts"><button type="button" class="mp-btn' +
          (mine ? " on" : " ghost") +
          '" data-mp-card="me" aria-pressed="' +
          mine +
          '">' +
          ICON.me +
          (mine ? "Это вы" : "Это я") +
          '</button><a class="mp-btn ghost" href="' +
          compareHref(id, me && me.id) +
          '">' +
          ICON.vs +
          (me && me.id && me.id !== id ? "Сравнить со мной" : "Сравнить") +
          "</a></div>"
      );
    }
    let bodyObs = null;
    const hook = () => {
      const body = $("pcBody");
      if (!body || bodyObs) return !!body;
      bodyObs = new MutationObserver(() => decorate(body));
      bodyObs.observe(body, { childList: true });
      decorate(body);
      body.addEventListener("click", e => {
        const b = e.target.closest('[data-mp-card="me"]');
        if (!b) return;
        const id = curId(),
          h2 = $("pcTitle");
        if (!id || !h2) return;
        const me = ZP.getMe();
        if (b.getAttribute("aria-pressed") === "true") ZP.setMe(null);
        else ZP.setMe({ id, n: (me && me.id === id && me.n) || h2.textContent });
        const acts = body.querySelector(".mp-card-acts");
        if (acts) acts.remove();
        decorate(body);
        const again = body.querySelector('[data-mp-card="me"]');
        if (again) again.focus();
      });
      return true;
    };
    /* окно карточки player-card.js создаёт при первом открытии */
    if (!hook()) {
      const o = new MutationObserver(() => {
        if (hook()) o.disconnect();
      });
      o.observe(document.body, { childList: true });
    }
  }

  /* ======================= Главная ======================= */
  function initHome() {
    const box = $("homeMe");
    if (!box) return;
    const title = sub =>
      '<div class="news-title mp-home-title"><span class="news-icon" aria-hidden="true">' +
      ICON.me +
      "</span><h2>Моё место</h2>" +
      (sub || "") +
      "</div>";

    function renderInvite() {
      box.innerHTML =
        title() +
        '<div class="mp-invite"><p>Отметьте себя в Топ-100 - здесь появятся ваши места во всех семи рейтингах и как они изменились с прошлого обновления.</p>' +
        '<a class="mp-btn" href="/top100#me">' +
        ICON.me +
        "Найти себя в Топ-100</a></div>";
      box.hidden = false;
    }

    function render(me, players) {
      const places = topPlaces(me.n);
      const { period, exact } = lastPeriod();
      const pl = players && me.id ? players.players[me.id] : null;
      const M = players ? players.metrics : [];
      let up = 0,
        down = 0,
        best = null;
      const tiles = TABS.map(t => {
        const x = places[t.key];
        let rank, move, value, delta, out;
        if (x) {
          rank = x.rank;
          move = x.move;
          value = x.value;
          delta = x.delta;
        } else if (pl && M.includes(t.key)) {
          const mi = M.indexOf(t.key);
          rank = pl.r[mi];
          value = pl.v[mi];
          out = true;
        }
        if (move > 0) up++;
        if (move < 0) down++;
        if (rank && (!best || rank < best.rank)) best = { rank, t };
        return (
          '<a class="mp-tile' +
          (x ? "" : " out") +
          (rank && rank <= 3 ? " m" + rank : "") +
          '" href="/top100#me" data-mp-tab="' +
          t.key +
          '" style="--c:' +
          t.accent +
          '"><span class="mp-tile-lbl">' +
          esc(t.label) +
          '</span><span class="mp-tile-rank"><b>' +
          (rank ? "#" + fmt(rank) : "-") +
          "</b>" +
          (x ? moveMarkup(move, "mp-move") : "") +
          "</span><small>" +
          (x
            ? fmt(value) +
              (delta
                ? ' <span class="' +
                  (delta > 0 ? "up" : "down") +
                  '">' +
                  (delta > 0 ? "+" : "−") +
                  fmt(Math.abs(delta)) +
                  "</span>"
                : "")
            : out && rank
              ? "вне сотни · " + fmt(value)
              : players
                ? "нет в рейтинге"
                : "вне сотни") +
          "</small></a>"
        );
      }).join("");
      const g = pl ? pl.g : "";
      const color = ZP.factionColor(g);
      const updated = window.TOP100_UPDATED ? short(window.TOP100_UPDATED) : "";
      const sub =
        '<span class="mp-home-who" style="--f:' +
        esc(color) +
        '"><i></i><b>' +
        esc(me.n) +
        "</b>" +
        (pl ? "<small>" + (g ? esc(g) + " · " : "") + "ур. " + pl.l + "</small>" : "") +
        "</span>";
      const when = period
        ? (exact ? "С прошлого обновления" : period.label) +
          (period.from ? ": " + esc(short(period.from)) + " → " + esc(updated) : "")
        : updated
          ? "Обновлено " + esc(updated)
          : "";
      const sum = [];
      if (best) sum.push("Лучшее место: <b>#" + best.rank + "</b> " + esc(best.t.label));
      if (up) sum.push('<span class="up">▲ выросли в ' + up + " " + (up === 1 ? "рейтинге" : "рейтингах") + "</span>");
      if (down)
        sum.push(
          '<span class="down">▼ опустились в ' + down + " " + (down === 1 ? "рейтинге" : "рейтингах") + "</span>"
        );
      if (!up && !down && Object.values(places).some(Boolean)) sum.push("Места не изменились");
      box.innerHTML =
        title(sub) +
        '<p class="mp-home-meta">' +
        when +
        (sum.length ? '<span class="mp-home-sum">' + sum.join("<i>·</i>") + "</span>" : "") +
        "</p>" +
        '<div class="mp-tiles">' +
        tiles +
        "</div>" +
        '<div class="mp-home-acts">' +
        (me.id
          ? '<a class="mp-btn ghost" href="/p/' +
            encodeURIComponent(me.id) +
            '">' +
            ICON.card +
            'Личное дело</a><a class="mp-btn ghost" href="' +
            compareHref(me.id) +
            '">' +
            ICON.vs +
            "Сравнить с игроком</a>"
          : "") +
        '<a class="mp-btn ghost" href="/top100#me">' +
        ICON.go +
        "К моему месту в Топ-100</a></div>";
      box.hidden = false;
    }

    /* клик по рейтингу: Топ-100 откроется сразу на этой вкладке и прокрутит к строке */
    box.addEventListener("click", e => {
      const a = e.target.closest("[data-mp-tab]");
      if (!a) return;
      try {
        localStorage.setItem(TAB_KEY, a.dataset.mpTab);
      } catch {}
    });

    function loadTopData() {
      if (window.TOP100_UPDATED) return Promise.resolve();
      return new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "/top100-data.js";
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    function show() {
      const me = ZP.getMe();
      if (!me) {
        renderInvite();
        return;
      }
      box.innerHTML = title() + '<p class="mp-home-meta mp-loading"><i></i>Связываемся с сетью сталкеров…</p>';
      box.hidden = false;
      loadTopData()
        .then(() => {
          render(me);
          return ZP.load();
        })
        .then(d => {
          /* ник сменился в игре - находим себя по id */
          const p = me.id && d.players[me.id];
          if (p && p.n !== me.n) {
            ZP.setMe({ id: me.id, n: p.n });
            return;
          }
          if (!me.id && d.idByNick[me.n]) {
            ZP.setMe({ id: d.idByNick[me.n], n: me.n });
            return;
          }
          render(me, d);
        })
        .catch(() => {
          if (!window.TOP100_UPDATED)
            box.innerHTML = title() + '<p class="mp-home-meta">Не удалось загрузить рейтинг. Проверьте соединение.</p>';
        });
    }
    document.addEventListener("zone:me", show);
    show();
  }

  initTop100();
  initHome();
})();
