/* Группировки: поиск, составы и рейтинг активности. */
"use strict";

(function () {
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
      rankPeriods = [].slice.call(rank.querySelectorAll("[data-rank-period]")),
      rankCustoms = [].slice.call(rank.querySelectorAll("[data-rank-custom]")),
      rankFroms = [].slice.call(rank.querySelectorAll("[data-rank-from]")),
      rankTos = [].slice.call(rank.querySelectorAll("[data-rank-to]")),
      rankApplies = [].slice.call(rank.querySelectorAll("[data-rank-apply]")),
      rankRows = [].slice.call(rankList.children),
      rankModal = document.getElementById("fxRankModal"),
      rankOpen = rank.querySelector("[data-open-rank]"),
      rankTrigger = null,
      histEl = document.getElementById("fxRankHistory"),
      hist = null;
    try {
      hist = histEl ? JSON.parse(histEl.textContent) : null;
    } catch (e) {
      hist = null;
    }
    var histDates = hist && Array.isArray(hist.dates) ? hist.dates : [],
      histMetrics = hist && Array.isArray(hist.metrics) ? hist.metrics : [],
      firstDate = histDates[0] || "",
      lastDate = histDates[histDates.length - 1] || "",
      state = {
        metric: "activity",
        period: "all",
        from: histDates.length ? histDates[Math.max(0, histDates.length - 8)] : "",
        to: lastDate
      };
    var fmtRank = function (n) {
        return Number(n || 0)
          .toLocaleString("ru-RU")
          .replace(/\u202f|\u00a0/g, " ");
      },
      escRank = function (s) {
        return String(s).replace(/[&<>"]/g, function (c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
      },
      isoAddDays = function (iso, days) {
        if (!iso) return "";
        var d = new Date(iso + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
      },
      lastIndexAt = function (date) {
        var idx = -1;
        for (var i = 0; i < histDates.length; i++) {
          if (histDates[i] <= date) idx = i;
          else break;
        }
        return idx;
      },
      fmtShort = function (iso) {
        var p = String(iso || "").split("-");
        return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : iso;
      },
      periodInfo = function () {
        if (state.period === "all") return null;
        if (!histDates.length) return { error: "История пока недоступна" };
        var toIdx = histDates.length - 1,
          fromIdx = 0,
          label = "";
        if (state.period === "custom") {
          if (!state.from || !state.to) return { error: "Выберите даты периода" };
          if (state.from > state.to) return { error: "Дата начала позже даты конца" };
          fromIdx = lastIndexAt(state.from);
          if (fromIdx < 0) fromIdx = 0;
          toIdx = lastIndexAt(state.to);
          if (toIdx < 0) toIdx = histDates.length - 1;
          if (fromIdx > toIdx) return { error: "В выбранном периоде нет данных" };
          label = "с " + fmtShort(histDates[fromIdx]) + " по " + fmtShort(histDates[toIdx]);
        } else {
          var days = state.period === "d1" ? 1 : state.period === "d7" ? 7 : 30,
            target = isoAddDays(lastDate, -days);
          fromIdx = lastIndexAt(target);
          if (fromIdx < 0) fromIdx = 0;
          label = "за " + (days === 1 ? "сутки" : days === 7 ? "неделю" : "месяц");
          if (fromIdx === 0 && target < firstDate) label += " (с " + fmtShort(firstDate) + ")";
        }
        return { fromIdx: fromIdx, toIdx: toIdx, label: label };
      },
      anchorOf = function (row) {
        var a = row.querySelector(".fx-rank-name");
        return a ? a.getAttribute("href").slice(1) : "";
      },
      gainFor = function (anchor, key, info) {
        if (!info || !hist || !hist.factions[anchor] || !hist.factions[anchor][key]) return 0;
        var arr = hist.factions[anchor][key],
          a = Number(arr[info.fromIdx] || 0),
          b = Number(arr[info.toIdx] || 0);
        return Math.max(0, b - a);
      },
      metricLabel = function (key) {
        var b = rankTabs.filter(function (x) {
          return x.dataset.rankMetric === key;
        })[0];
        return b ? b.textContent.trim() : key;
      },
      setHints = function (text) {
        rankHints.forEach(function (hint) {
          hint.textContent = text;
        });
      },
      updatePeriodButtons = function () {
        rankPeriods.forEach(function (b) {
          var on = b.dataset.rankPeriod === state.period;
          b.classList.toggle("on", on);
          b.setAttribute("aria-pressed", String(on));
        });
      },
      showCustom = function (on) {
        rankCustoms.forEach(function (p) {
          p.hidden = !on;
        });
      },
      syncCustom = function () {
        rankFroms.forEach(function (el) {
          el.min = firstDate;
          el.max = lastDate;
          if (state.from) el.value = state.from;
        });
        rankTos.forEach(function (el) {
          el.min = firstDate;
          el.max = lastDate;
          if (state.to) el.value = state.to;
        });
      },
      syncMetricTabs = function () {
        var current = rankTabs.filter(function (b) {
          return b.dataset.rankMetric === state.metric;
        })[0];
        rankTabs.forEach(function (b) {
          var on = b.dataset.rankMetric === state.metric;
          b.classList.toggle("on", on);
          b.setAttribute("aria-pressed", String(on));
        });
        rank.style.setProperty(
          "--m",
          current ? current.style.getPropertyValue("--m") || "var(--accent)" : "var(--accent)"
        );
      },
      updateRank = function () {
        var info = periodInfo();
        if (info && info.error) {
          setHints(info.error);
          return;
        }
        var metric = state.metric,
          values;
        if (metric === "activity") {
          if (!info) {
            values = rankRows.map(function (row) {
              return { row: row, v: Number(row.dataset.activity || 0) };
            });
          } else {
            var gains = rankRows.map(function (row) {
              var anchor = anchorOf(row),
                g = {};
              histMetrics.forEach(function (k) {
                g[k] = gainFor(anchor, k, info);
              });
              return { row: row, g: g };
            });
            var maxBy = {};
            histMetrics.forEach(function (k) {
              var m = 1;
              gains.forEach(function (x) {
                if (x.g[k] > m) m = x.g[k];
              });
              maxBy[k] = m;
            });
            values = gains.map(function (x) {
              var sum = 0;
              histMetrics.forEach(function (k) {
                sum += x.g[k] / maxBy[k];
              });
              return { row: x.row, v: histMetrics.length ? Math.round((sum / histMetrics.length) * 100) : 0 };
            });
          }
        } else {
          values = rankRows.map(function (row) {
            return { row: row, v: info ? gainFor(anchorOf(row), metric, info) : Number(row.dataset[metric] || 0) };
          });
        }
        var max = metric === "activity" ? 100 : 1;
        if (metric !== "activity")
          values.forEach(function (x) {
            if (x.v > max) max = x.v;
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
          if (val) val.textContent = metric === "activity" ? Math.round(x.v) : fmtRank(x.v);
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
                value = metric === "activity" ? Math.round(x.v) : fmtRank(x.v),
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
        var periodLabel = info ? info.label : "за всё время";
        if (metric === "activity")
          setHints(
            info
              ? "Индекс активности: среднее по приросту показателей " +
                  periodLabel +
                  ", лучший результат по каждому - 100"
              : "Индекс активности: среднее по всем показателям текущего состава, лучший результат по каждому - 100"
          );
        else
          setHints(
            info
              ? metricLabel(metric) + ": прирост " + periodLabel + " · по всем бойцам с прогрессом"
              : metricLabel(metric) + ": суммарно за всё время по текущему составу"
          );
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
      };
    rankTabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.metric = btn.dataset.rankMetric;
        syncMetricTabs();
        updateRank();
      });
    });
    rankPeriods.forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.period = btn.dataset.rankPeriod;
        updatePeriodButtons();
        showCustom(state.period === "custom");
        syncCustom();
        updateRank();
      });
    });
    rankApplies.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!firstDate || !lastDate) return setHints("История пока недоступна");
        var panel = btn.closest("[data-rank-custom]"),
          from = panel.querySelector("[data-rank-from]").value,
          to = panel.querySelector("[data-rank-to]").value;
        if (!from || !to) return setHints("Выберите обе даты");
        if (from < firstDate) from = firstDate;
        if (to > lastDate) to = lastDate;
        if (from > to) return setHints("Дата начала позже даты конца");
        state.from = from;
        state.to = to;
        state.period = "custom";
        updatePeriodButtons();
        showCustom(true);
        syncCustom();
        updateRank();
      });
    });
    syncMetricTabs();
    updatePeriodButtons();
    showCustom(false);
    syncCustom();
    updateRank();
    if (rankCards) rankCards.addEventListener("click", clearForCard);
    rankList.addEventListener("click", clearForCard);
    rankFroms.concat(rankTos).forEach(function (inp) {
      inp.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        var btn = inp.closest("[data-rank-custom]").querySelector("[data-rank-apply]");
        if (btn) btn.click();
      });
    });
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
