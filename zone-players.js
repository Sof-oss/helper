/* Общие помощники для «Моего места» (my-place.js) и сравнения игроков (compare.js):
   - «я» - игрок, которого посетитель отметил как себя (localStorage zoneMyPlayer = {id, n});
   - загрузка карточек игроков top100-players.json (тот же файл, что у player-card.js);
   - поле поиска игрока по нику с подсказками.
   Обычный скрипт без общих имён: всё внутри функции, наружу - только window.ZonePlayers.
   Подключается и на страницах, которые build.js прогоняет в заглушке DOM (top100.html), там ничего не делает */
(function () {
  "use strict";
  if (typeof window.fetch !== "function" || !document.body || window.ZonePlayers) return;

  const ME_KEY = "zoneMyPlayer";
  /* семь рейтингов: те же ключи, подписи и цвета, что TOP100_TABS в top100.js (data - имя массива в top100-data.js) */
  const TABS = [
    { key: "reputation", label: "Репутация", accent: "#f48fb1", data: "TOP100_REPUTATION" },
    { key: "bosses", label: "Боссы", accent: "#ff8a65", data: "TOP100_BOSSES" },
    { key: "stashes", label: "Тайники", accent: "#26c6da", data: "TOP100_STASHES" },
    { key: "talents", label: "Таланты", accent: "#ffb74d", data: "TOP100_TALENTS" },
    { key: "collections", label: "Коллекции", accent: "#c9a6ff", data: "TOP100_COLLECTIONS" },
    { key: "expeditions", label: "Экспедиции", accent: "#9fdc9f", data: "TOP100_EXPEDITIONS" },
    { key: "defense", label: "Защита лагеря", accent: "#54bfff", data: "TOP100_DEFENSE" }
  ];
  const esc = s =>
    String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = n => Math.round(n).toLocaleString("ru-RU");
  const norm = s => String(s).toLowerCase().replace(/ё/g, "е");

  /* ---------- «я» ---------- */
  function getMe() {
    try {
      const m = JSON.parse(localStorage.getItem(ME_KEY) || "null");
      if (m && typeof m.n === "string" && m.n) return { id: m.id ? String(m.id) : null, n: m.n };
    } catch {}
    return null;
  }
  function setMe(me) {
    try {
      if (me) localStorage.setItem(ME_KEY, JSON.stringify({ id: me.id || null, n: me.n }));
      else localStorage.removeItem(ME_KEY);
    } catch {}
    document.dispatchEvent(new CustomEvent("zone:me", { detail: me }));
  }
  /* отметку поменяли в другой вкладке */
  window.addEventListener("storage", e => {
    if (e.key === ME_KEY) document.dispatchEvent(new CustomEvent("zone:me", { detail: getMe() }));
  });

  /* ---------- карточки игроков ----------
     Адрес - как у player-card.js (с версией выгрузки), чтобы файл скачивался один раз.
     Без top100-data.js на странице версии нет - тогда просим браузер свериться с сервером */
  let data = null,
    loading = null;
  function load() {
    if (data) return Promise.resolve(data);
    if (!loading) {
      const v = window.TOP100_HISTORY && window.TOP100_HISTORY.id;
      loading = fetch("/top100-players.json" + (v ? "?v=" + encodeURIComponent(v) : ""), v ? {} : { cache: "no-cache" })
        .then(r => {
          if (!r.ok) throw new Error(r.status);
          return r.json();
        })
        .then(d => {
          const repI = d.metrics.indexOf("reputation");
          d.idByNick = {};
          d.list = Object.keys(d.players).map(id => {
            const p = d.players[id];
            d.idByNick[p.n] = id;
            return { id, n: p.n, q: norm(p.n), rep: p.v[repI] || 0 };
          });
          d.list.sort((a, b) => b.rep - a.rep);
          data = d;
          return d;
        })
        .catch(e => {
          loading = null;
          throw e;
        });
    }
    return loading;
  }
  function factionColor(g) {
    if (!g) return "#8196a9";
    if (data && data.factions && data.factions[g]) return data.factions[g];
    let h = 0;
    for (const c of g) h = (h * 31 + c.charCodeAt(0)) % 360;
    return "hsl(" + h + " 55% 62%)";
  }
  /* ники из рейтингов top100-data.js - пока карточки не скачались (или на странице их нет) */
  function topNicks() {
    const seen = new Set();
    TABS.forEach(t => (window[t.data] || []).forEach(r => seen.add(r[0])));
    return [...seen].map(n => ({ id: null, n, q: norm(n), rep: 0 }));
  }
  /* порядок подсказок: ник или слово ника совпадает целиком («sof» -> «[Наёмник] Sof»), потом слово ника
     начинается с запроса, потом просто содержит; внутри группы - по репутации */
  function search(q, limit) {
    const nq = norm(q).trim();
    if (!nq) return [];
    const list = data ? data.list : topNicks();
    const groups = [[], [], []];
    for (const x of list) {
      if (!x.q.includes(nq)) continue;
      const words = x.q.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      const g = x.q === nq || words.includes(nq) ? 0 : words.some(w => w.startsWith(nq)) || x.q.startsWith(nq) ? 1 : 2;
      groups[g].push(x);
    }
    return groups.flat().slice(0, limit || 8);
  }

  /* ---------- поле выбора игрока ----------
     picker(input, onPick): под полем список подсказок (стрелки, Enter, Esc), onPick({id, n}) */
  let uid = 0;
  function picker(input, onPick) {
    const list = document.createElement("ul");
    list.className = "zp-suggest";
    list.id = "zpSuggest" + ++uid;
    list.setAttribute("role", "listbox");
    list.hidden = true;
    input.insertAdjacentElement("afterend", list);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", list.id);
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("autocomplete", "off");
    let items = [],
      sel = -1;
    const close = () => {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    };
    const mark = () =>
      [...list.children].forEach((li, i) => {
        li.classList.toggle("on", i === sel);
        li.setAttribute("aria-selected", i === sel ? "true" : "false");
        if (i === sel) {
          input.setAttribute("aria-activedescendant", li.id);
          li.scrollIntoView({ block: "nearest" });
        }
      });
    const draw = () => {
      items = search(input.value, 8);
      sel = items.length ? 0 : -1;
      if (!input.value.trim()) {
        close();
        return;
      }
      list.innerHTML = items.length
        ? items
            .map((x, i) => {
              const p = data && x.id ? data.players[x.id] : null;
              return (
                '<li role="option" id="' +
                list.id +
                "-" +
                i +
                '" data-zp-i="' +
                i +
                '"><i style="--f:' +
                esc(factionColor(p && p.g)) +
                '"></i><span>' +
                esc(x.n) +
                "</span>" +
                (p ? "<small>" + (p.g ? esc(p.g) + " · " : "") + "ур. " + p.l + "</small>" : "") +
                "</li>"
              );
            })
            .join("")
        : '<li class="zp-empty" aria-disabled="true">Никого не нашли</li>';
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      mark();
    };
    const choose = i => {
      const x = items[i];
      if (!x) return;
      close();
      onPick({ id: x.id || (data && data.idByNick[x.n]) || null, n: x.n });
    };
    input.addEventListener("input", draw);
    input.addEventListener("focus", () => {
      load().then(
        () => input.value.trim() && draw(),
        () => {}
      );
    });
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (list.hidden) draw();
        if (!items.length) return;
        e.preventDefault();
        sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        mark();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (sel >= 0) choose(sel);
      } else if (e.key === "Escape" && !list.hidden) {
        e.stopPropagation();
        close();
      }
    });
    /* mousedown, а не click: иначе поле теряет фокус и список закрывается раньше выбора */
    list.addEventListener("mousedown", e => {
      const li = e.target.closest("[data-zp-i]");
      if (!li) return;
      e.preventDefault();
      choose(+li.dataset.zpI);
    });
    input.addEventListener("blur", () => setTimeout(close, 120));
    return { close };
  }

  /* нашивка группировки - как в карточке игрока (player-card.js): эмблема из ui.js или щиток с буквой */
  function patchSvg(g, color, nick) {
    const e = g && window.__factionEmblem && window.__factionEmblem(g);
    if (e && e.svg) return '<svg viewBox="0 0 64 72" aria-hidden="true">' + e.svg + "</svg>";
    const c = esc(color),
      ch = esc(((g || nick || "").replace(/[^\p{L}\p{N}]/gu, "")[0] || "?").toUpperCase());
    return (
      '<svg viewBox="0 0 64 72" aria-hidden="true"><path d="M7 3h50a3 3 0 0 1 3 3v34c0 14-12 24-28 30C16 64 4 54 4 40V6a3 3 0 0 1 3-3z" fill="#0b0f14" stroke="' +
      c +
      '" stroke-width="3.5" stroke-linejoin="round"/><path d="M5.8 4.8h52.4V13H5.8z" fill="' +
      c +
      '"/><text x="32" y="48" text-anchor="middle" font-family="Oswald,Arial,sans-serif" font-size="26" font-weight="600" fill="' +
      c +
      '">' +
      ch +
      "</text></svg>"
    );
  }
  /* звание по уровню - как в player-card.js */
  const TITLES = [
    [30, "Легенда"],
    [25, "Мастер"],
    [20, "Ветеран"],
    [10, "Опытный"],
    [0, "Новичок"]
  ];
  const titleOf = l => TITLES.find(t => (l || 0) >= t[0])[1];

  window.ZonePlayers = {
    TABS,
    esc,
    fmt,
    norm,
    getMe,
    setMe,
    load,
    search,
    picker,
    factionColor,
    patchSvg,
    titleOf,
    data: () => data
  };
})();
