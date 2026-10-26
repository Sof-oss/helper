"use strict";
/* Страница «Группировки»: карточки уже в HTML (build-factions.js), здесь поиск и фильтр «Только с набором»;
   карточки игроков из составов открывает player-card.js (ссылки с data-pc-open).
   Поиск ищет и по названию группировки, и по нику бойца: у найденного бойца раскрывается состав и он подсвечивается */
(function () {
  /* версия выгрузки игроков (build.js кладёт её в <main data-history>): карточка игрока (player-card.js) берёт
     top100-players.json по тому же адресу, что и Топ-100, - файл из кэша, а не второй раз */
  var main = document.getElementById("main");
  if (main && main.dataset.history && !window.TOP100_HISTORY) window.TOP100_HISTORY = { id: main.dataset.history };
  var input = document.getElementById("fxSearch"),
    hiring = document.getElementById("fxHiring"),
    empty = document.getElementById("fxEmpty");
  if (!input) return;
  var cards = [].slice.call(document.querySelectorAll(".fx-card"));
  var norm = function (s) {
    return String(s || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .trim();
  };
  function apply() {
    var q = norm(input.value),
      onlyHiring = hiring && hiring.checked,
      shown = 0;
    cards.forEach(function (card) {
      var byName = !q || norm(card.dataset.name).indexOf(q) >= 0,
        hit = false;
      [].forEach.call(card.querySelectorAll(".fx-roster li"), function (li) {
        var a = li.querySelector("a"),
          m = !!q && !byName && norm(a && a.textContent).indexOf(q) >= 0;
        li.classList.toggle("fx-hit", m);
        if (m) hit = true;
      });
      var ok = (byName || hit) && (!onlyHiring || card.classList.contains("fx-hiring"));
      card.hidden = !ok;
      var det = card.querySelector(".fx-roster");
      if (det && hit) det.open = true;
      if (ok) shown++;
    });
    if (empty) empty.hidden = shown > 0;
  }
  input.addEventListener("input", apply);
  if (hiring) hiring.addEventListener("change", apply);
  /* рейтинг активности: компактный топ-5 на странице и полный рейтинг в окне */
  var rank = document.querySelector("[data-fx-rank]");
  if (rank) {
    var rankList = rank.querySelector("[data-fx-rank-list]"),
      rankCards = rank.querySelector("[data-fx-rank-cards]"),
      rankHints = [].slice.call(rank.querySelectorAll("[data-fx-rank-hint]")),
      rankTabs = [].slice.call(rank.querySelectorAll("[data-rank-metric]")),
      rankRows = [].slice.call(rankList.children),
      rankModal = document.getElementById("fxRankModal"),
      rankOpen = rank.querySelector("[data-open-rank]"),
      rankTrigger = null,
      fmtRank = function (n) {
        return Number(n || 0)
          .toLocaleString("ru-RU")
          .replace(/\u202f|\u00a0/g, " ");
      },
      escRank = function (s) {
        return String(s).replace(/[&<>"]/g, function (c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
      },
      clearForCard = function (e) {
        var a = e.target.closest && e.target.closest('a[href^="#f-"]');
        if (!a) return;
        if (input.value) input.value = "";
        if (hiring && hiring.checked) hiring.checked = false;
        apply();
        if (rankModal && rankModal.classList.contains("show")) {
          e.preventDefault();
          closeRank();
          location.hash = a.getAttribute("href");
        }
      },
      closeRank = function () {
        if (!rankModal || !rankModal.classList.contains("show")) return;
        rankModal.classList.remove("show");
        rankModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("fx-rank-lock");
        if (rankTrigger && rankTrigger.focus) rankTrigger.focus({ preventScroll: true });
      },
      openRank = function () {
        if (!rankModal) return;
        rankTrigger = document.activeElement;
        rankModal.classList.add("show");
        rankModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("fx-rank-lock");
        var close = rankModal.querySelector(".fx-rank-close");
        if (close)
          setTimeout(function () {
            close.focus({ preventScroll: true });
          }, 0);
      },
      selectRank = function (btn) {
        var key = btn.dataset.rankMetric;
        rank.style.setProperty("--m", btn.style.getPropertyValue("--m") || "var(--accent)");
        rankTabs.forEach(function (b) {
          var on = b.dataset.rankMetric === key;
          b.classList.toggle("on", on);
          b.setAttribute("aria-pressed", String(on));
        });
        rankHints.forEach(function (hint) {
          hint.textContent = btn.dataset.rankHint || "";
        });
        var max = 1,
          values = rankRows.map(function (row) {
            var v = Number(row.dataset[key] || 0);
            if (v > max) max = v;
            return { row: row, v: v };
          });
        values.sort(function (a, b) {
          return (
            b.v - a.v ||
            Number(b.row.dataset.members || 0) - Number(a.row.dataset.members || 0) ||
            a.row.textContent.localeCompare(b.row.textContent, "ru")
          );
        });
        values.forEach(function (x, i) {
          var row = x.row,
            bar = row.querySelector("[data-rank-bar]"),
            val = row.querySelector("[data-rank-value]"),
            place = row.querySelector(".fx-rank-place");
          if (place) place.textContent = i + 1;
          if (val) val.textContent = key === "activity" ? Math.round(x.v) : fmtRank(x.v);
          if (bar) bar.style.width = (x.v > 0 ? Math.max(2, Math.round((x.v / max) * 100)) : 0) + "%";
          rankList.appendChild(row);
        });
        if (rankCards)
          rankCards.innerHTML = values
            .slice(0, 5)
            .map(function (x, i) {
              var a = x.row.querySelector(".fx-rank-name"),
                name = a.firstChild.textContent.trim(),
                link = a.getAttribute("href"),
                card = document.getElementById(link.slice(1)),
                emblem = card && card.querySelector(".fx-emblem svg"),
                color = card ? getComputedStyle(card).getPropertyValue("--fx").trim() : "#8fa3b4",
                value = key === "activity" ? Math.round(x.v) : fmtRank(x.v),
                width = x.v > 0 ? Math.max(2, Math.round((x.v / max) * 100)) : 0;
              return (
                '<a class="fx-rank-card" href="' +
                link +
                '" style="--fx:' +
                color +
                '"><span class="fx-rank-card-medal" aria-hidden="true">' +
                (i + 1) +
                '</span><span class="fx-rank-card-emblem" aria-hidden="true">' +
                (emblem ? emblem.outerHTML : "") +
                "</span><b>" +
                escRank(name) +
                "</b><small>" +
                escRank(a.querySelector("small").textContent) +
                "</small><strong data-card-value>" +
                value +
                '</strong><span class="fx-rank-card-bar" aria-hidden="true"><i data-card-bar style="width:' +
                width +
                '%"></i></span></a>'
              );
            })
            .join("");
      };
    rankTabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectRank(btn);
      });
    });
    selectRank(rankTabs[0]);
    if (rankCards) rankCards.addEventListener("click", clearForCard);
    rankList.addEventListener("click", clearForCard);
    if (rankOpen) rankOpen.addEventListener("click", openRank);
    [].forEach.call(document.querySelectorAll("[data-close-rank]"), function (btn) {
      btn.addEventListener("click", closeRank);
    });
    document.addEventListener("keydown", function (e) {
      if (!rankModal || !rankModal.classList.contains("show")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeRank();
        return;
      }
      if (e.key !== "Tab") return;
      var list = [].filter.call(
        rankModal.querySelectorAll("button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"),
        function (el) {
          return el.getClientRects().length > 0;
        }
      );
      if (!list.length) return;
      var first = list[0],
        last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }
  /* переход по ссылке /factions#f-dolg - сразу к карточке и с открытым составом */
  var target = location.hash && document.getElementById(location.hash.slice(1));
  if (target && target.classList.contains("fx-card")) {
    var d = target.querySelector(".fx-roster");
    if (d) d.open = true;
  }
  if (input.value || (hiring && hiring.checked)) apply();
})();
