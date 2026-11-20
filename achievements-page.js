/* Страница отдельного рейтинга по очкам достижений (/achievements) и каталога всех наград. */
(function () {
  "use strict";
  const main = document.getElementById("main");
  const tbody = document.getElementById("achpTbody");
  if (!main || !tbody) return;

  const ver = (main.dataset && main.dataset.history) || "";
  const DATA_URL = "/achievements-data.json" + (ver ? "?v=" + encodeURIComponent(ver) : "");
  const ZA = window.ZoneAchievements;

  const searchInput = document.getElementById("achpSearch");
  const factionsBox = document.getElementById("achpFactions");
  const emptyEl = document.getElementById("achpEmpty");
  const resultsEl = document.getElementById("achpResults");
  const panelRank = document.getElementById("achpPanelRank");
  const panelCatalog = document.getElementById("achpPanelCatalog");
  const tabRank = document.getElementById("achpTabRank");
  const tabCatalog = document.getElementById("achpTabCatalog");
  const totalCntEl = document.getElementById("achpTotalCnt");
  const catBtnsEl = document.getElementById("achpCatBtns");
  const catSortEl = document.getElementById("achpCatSort");
  const catGridEl = document.getElementById("achpCatGrid");

  const SLEEP_SVG =
    '<span class="t100-off" title="Не заходил в игру больше 5 дней" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg></span>';

  let board = null;
  let view = "rank";
  let query = "";
  let faction = "";
  let sortKey = "pts";
  let sortDir = "desc";
  let catFilter = "all";
  let catSort = "rare";
  let highlightAchId = null;

  function setView(next) {
    view = next === "catalog" ? "catalog" : "rank";
    const isRank = view === "rank";
    panelRank.hidden = !isRank;
    panelCatalog.hidden = isRank;
    tabRank.classList.toggle("active", isRank);
    tabRank.setAttribute("aria-selected", String(isRank));
    tabCatalog.classList.toggle("active", !isRank);
    tabCatalog.setAttribute("aria-selected", String(!isRank));
    if (!isRank) renderCatalog();
  }

  let factionIndex = new Map();
  let factionColors = new Map();

  function ensureEmblems() {
    if (!board) return;
    const names = [];
    const seen = new Set();
    for (const row of board.top || []) {
      if (row.g && !seen.has(row.g)) {
        seen.add(row.g);
        names.push(row.g);
        factionColors.set(row.g, row.col || "#8196a9");
      }
    }
    factionIndex = new Map(names.map((n, i) => [n, i]));
    let svg = document.getElementById("achpEmblems");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = "achpEmblems";
      svg.setAttribute("hidden", "");
      svg.setAttribute("aria-hidden", "true");
      document.body.appendChild(svg);
    }
    svg.innerHTML =
      "<defs>" +
      names
        .map((n, i) => {
          const e = window.__factionEmblem && window.__factionEmblem(n);
          let inner = e && e.svg;
          if (!inner) {
            const c = escAttr(factionColors.get(n) || "#8196a9");
            const ch = esc((n.replace(/[^\p{L}\p{N}]/gu, "")[0] || "?").toUpperCase());
            inner =
              '<path d="M7 3h50a3 3 0 0 1 3 3v34c0 14-12 24-28 30C16 64 4 54 4 40V6a3 3 0 0 1 3-3z" fill="#0b0f14" stroke="' +
              c +
              '" stroke-width="3.5" stroke-linejoin="round"/><path d="M5.8 4.8h52.4V13H5.8z" fill="' +
              c +
              '"/><text x="32" y="50" text-anchor="middle" font-family="Oswald,Arial,sans-serif" font-size="30" font-weight="600" fill="' +
              c +
              '">' +
              ch +
              "</text>";
          }
          return '<symbol id="achpe-' + i + '" viewBox="0 0 64 72">' + inner + "</symbol>";
        })
        .join("") +
      "</defs>";
  }

  function patchMarkup(name, col) {
    const idx = factionIndex.get(name);
    if (idx !== undefined) {
      return '<svg class="achp-emb" viewBox="0 0 64 72" aria-hidden="true"><use href="#achpe-' + idx + '"/></svg>';
    }
    return window.__factionPatch ? window.__factionPatch(name, col, "achp-emb") : "";
  }

  function renderFactions() {
    if (!board || !factionsBox) return;
    ensureEmblems();
    const entries = Object.entries(board.factions || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"));
    if (!entries.length) {
      factionsBox.innerHTML = "";
      return;
    }
    const chips = [
      '<button type="button" class="achp-fchip' +
        (!faction ? " active" : "") +
        '" data-achp-fac="" aria-pressed="' +
        !faction +
        '">Все <b>' +
        board.top.length +
        "</b></button>"
    ];
    for (const [name, cnt] of entries) {
      const active = faction === name;
      const sample = board.top.find(r => r.g === name);
      const col = (sample && sample.col) || "#8196a9";
      const style = ' style="--fc:' + escAttr(col) + '"';
      chips.push(
        '<button type="button" class="achp-fchip' +
          (active ? " active" : "") +
          '" data-achp-fac="' +
          escAttr(name) +
          '" aria-pressed="' +
          active +
          '"' +
          style +
          ">" +
          patchMarkup(name, col) +
          esc(name) +
          " <b>" +
          cnt +
          "</b></button>"
      );
    }
    factionsBox.innerHTML = chips.join("");
  }

  function renderTable() {
    if (!board) return;
    ensureEmblems();
    const nq = norm(query).trim();
    const list = board.top.filter(row => {
      if (faction && row.g !== faction) return false;
      if (nq && !norm(row.n).includes(nq) && !norm(row.g).includes(nq)) return false;
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const diff = (a[sortKey] - b[sortKey]) * dir;
      return diff || a.r - b.r;
    });

    const totalAch = board.totalAchievements || (ZA ? ZA.DEFINITIONS.length : 65);
    tbody.innerHTML = list
      .map(row => {
        const medal =
          row.r <= 3
            ? '<span class="achp-medal m' + row.r + '" aria-label="' + row.r + ' место">' + row.r + "</span>"
            : '<span class="achp-pos">' + row.r + "</span>";
        const pct = totalAch ? Math.round((row.u / totalAch) * 100) : 0;
        const facCell = row.g
          ? '<span class="achp-fac">' + patchMarkup(row.g, row.col) + esc(row.g) + "</span>"
          : '<span class="achp-fac none">-</span>';
        return (
          '<tr class="' +
          (row.r <= 3 ? "is-top" + row.r : "") +
          (row.off ? " is-off" : "") +
          '" data-achp-id="' +
          escAttr(row.id) +
          '">' +
          '<td class="c-rank">' +
          medal +
          "</td>" +
          '<td class="c-name"><button type="button" class="achp-player" data-pc-open="' +
          escAttr(row.id) +
          '" data-pc-open-tab="achievements">' +
          esc(row.n) +
          "</button>" +
          (row.off ? SLEEP_SVG : "") +
          "</td>" +
          '<td class="c-fac">' +
          facCell +
          "</td>" +
          '<td class="c-lvl">' +
          row.lv +
          "</td>" +
          '<td class="c-cnt"><span class="achp-cnt-val">' +
          row.u +
          "/" +
          totalAch +
          '</span><span class="achp-cnt-bar" aria-hidden="true"><i style="width:' +
          pct +
          '%"></i></span></td>' +
          '<td class="c-rk">' +
          esc(row.rk) +
          "</td>" +
          '<td class="c-pts"><b>' +
          fmt(row.pts) +
          "</b></td>" +
          "</tr>"
        );
      })
      .join("");

    emptyEl.hidden = list.length > 0;
    if (resultsEl) resultsEl.textContent = "Показано сталкеров: " + list.length;

    document.querySelectorAll("[data-achp-sort]").forEach(btn => {
      const active = btn.dataset.achpSort === sortKey;
      btn.classList.toggle("active", active);
      btn.classList.toggle("asc", active && sortDir === "asc");
      btn.classList.toggle("desc", active && sortDir === "desc");
      const th = btn.closest("th");
      if (th) th.setAttribute("aria-sort", active ? (sortDir === "asc" ? "ascending" : "descending") : "none");
    });
  }

  function renderCatButtons() {
    if (!ZA || !catBtnsEl) return;
    const counts = {};
    for (const c of ZA.CATEGORIES) counts[c.key] = 0;
    for (const d of ZA.DEFINITIONS) if (counts[d.category] !== undefined) counts[d.category]++;
    const html = [
      '<button type="button" class="pc-ach-cbtn' +
        (catFilter === "all" ? " active" : "") +
        '" data-achp-cat="all" aria-pressed="' +
        (catFilter === "all") +
        '">Все категории <span>' +
        ZA.DEFINITIONS.length +
        "</span></button>"
    ];
    for (const c of ZA.CATEGORIES) {
      const act = catFilter === c.key;
      html.push(
        '<button type="button" class="pc-ach-cbtn' +
          (act ? " active" : "") +
          '" data-achp-cat="' +
          escAttr(c.key) +
          '" aria-pressed="' +
          act +
          '">' +
          esc(c.label) +
          " <span>" +
          counts[c.key] +
          "</span></button>"
      );
    }
    catBtnsEl.innerHTML = html.join("");
  }

  function renderCatalog() {
    if (!ZA || !catGridEl) return;
    renderCatButtons();
    const catLabels = Object.fromEntries(ZA.CATEGORIES.map(c => [c.key, c.label]));
    const stats = (board && board.stats) || {};
    const totalPlayers = (board && board.totalPlayers) || 0;

    const items = ZA.DEFINITIONS.filter(d => catFilter === "all" || d.category === catFilter).map((d, idx) => {
      const r = (ZA.RARITIES && (ZA.RARITIES[d.rarity] || ZA.RARITIES.common)) || {
        color: "#8ea8be",
        bg: "#13202c",
        label: ""
      };
      const cnt = Number(stats[d.id]) || 0;
      const own = ZA.formatOwnership(cnt, totalPlayers);
      return {
        ...d,
        idx,
        status: "unlocked",
        color: r.color,
        bg: r.bg,
        rarityLabel: r.label,
        ownCount: cnt,
        own
      };
    });

    if (catSort === "rare") {
      items.sort((a, b) => a.ownCount - b.ownCount || b.points - a.points || a.idx - b.idx);
    } else if (catSort === "common") {
      items.sort((a, b) => b.ownCount - a.ownCount || b.points - a.points || a.idx - b.idx);
    } else if (catSort === "points") {
      items.sort((a, b) => b.points - a.points || a.ownCount - b.ownCount || a.idx - b.idx);
    }

    catGridEl.innerHTML = items
      .map(it => {
        const isHi = highlightAchId === it.id;
        const w = it.ownCount > 0 ? Math.max(1.5, Math.min(100, it.own.pct)) : 0;
        const ownBlock =
          totalPlayers > 0
            ? '<div class="pc-ach-own has-bar">' +
              '<div class="pc-ach-own-row"><span>Есть у <b>' +
              esc(it.own.label) +
              "</b></span></div>" +
              '<div class="pc-ach-own-bar" aria-hidden="true"><i style="width:' +
              w.toFixed(1) +
              '%"></i></div>' +
              "</div>"
            : '<div class="pc-ach-own"><span class="pc-ach-own-muted">Загружаем статистику…</span></div>';
        return (
          '<li class="pc-ach-card st-unlocked r-' +
          escAttr(it.rarity) +
          (isHi ? " is-highlight" : "") +
          '" style="--ac:' +
          escAttr(it.color) +
          ";--abg:" +
          escAttr(it.bg) +
          '" data-achp-card="' +
          escAttr(it.id) +
          '">' +
          '<div class="pc-ach-main">' +
          ZA.badgeHtml(it) +
          '<div class="pc-ach-info">' +
          '<div class="pc-ach-top">' +
          '<h3 class="pc-ach-name">' +
          esc(it.name) +
          "</h3>" +
          '<span class="pc-ach-pts" title="Очки за достижение">+' +
          fmt(it.points) +
          "</span>" +
          "</div>" +
          '<p class="pc-ach-desc">' +
          esc(it.desc) +
          "</p>" +
          '<div class="pc-ach-meta">' +
          '<span class="pc-ach-rar">' +
          esc(it.rarityLabel) +
          "</span>" +
          '<span aria-hidden="true">·</span>' +
          "<span>" +
          esc(catLabels[it.category] || it.category) +
          "</span>" +
          "</div>" +
          "</div>" +
          "</div>" +
          ownBlock +
          "</li>"
        );
      })
      .join("");
  }

  /* события */
  document.addEventListener("click", e => {
    const vBtn = e.target.closest("[data-achp-view]");
    if (vBtn) {
      setView(vBtn.dataset.achpView);
      return;
    }
    const jumpBtn = e.target.closest("[data-achp-jump]");
    if (jumpBtn) {
      const id = jumpBtn.dataset.achpJump;
      catFilter = "all";
      highlightAchId = id;
      setView("catalog");
      const card = catGridEl && catGridEl.querySelector('[data-achp-card="' + id.replace(/"/g, '\\"') + '"]');
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const fBtn = e.target.closest("[data-achp-fac]");
    if (fBtn) {
      faction = fBtn.dataset.achpFac || "";
      renderFactions();
      renderTable();
      return;
    }
    const sBtn = e.target.closest("[data-achp-sort]");
    if (sBtn) {
      const nextKey = sBtn.dataset.achpSort;
      if (sortKey === nextKey) sortDir = sortDir === "desc" ? "asc" : "desc";
      else {
        sortKey = nextKey;
        sortDir = "desc";
      }
      renderTable();
      return;
    }
    const cBtn = e.target.closest("[data-achp-cat]");
    if (cBtn) {
      catFilter = cBtn.dataset.achpCat || "all";
      highlightAchId = null;
      renderCatalog();
      return;
    }
    /* клик по любой ячейке строки открывает карточку на вкладке «Достижения» */
    const tr = e.target.closest("#achpTbody tr");
    if (tr && !e.target.closest("a, button, input")) {
      const sel = window.getSelection && window.getSelection();
      if (sel && String(sel).trim()) return;
      const btn = tr.querySelector("[data-pc-open]");
      if (btn) btn.click();
    }
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      query = searchInput.value;
      renderTable();
    });
  }
  if (catSortEl) {
    catSortEl.addEventListener("change", () => {
      catSort = catSortEl.value || "rare";
      renderCatalog();
    });
  }

  /* загрузка полных данных рейтинга и статистики редкости */
  fetch(DATA_URL)
    .then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(d => {
      board = d;
      if (totalCntEl && d.totalAchievements) totalCntEl.textContent = String(d.totalAchievements);
      renderFactions();
      renderTable();
      if (view === "catalog") renderCatalog();
    })
    .catch(() => {});
})();
