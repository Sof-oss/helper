/* Карточки группировок: окно «Штаб» поверх «Группировок» и «Топ-100».
   Данные - factions-cards.json (собирает build-factions.js), адрес карточки - /f/<slug>. */
(function () {
  "use strict";
  if (typeof window.fetch !== "function" || !document.body) return;

  const main = document.getElementById("main");
  const ver =
    (window.TOP100_HISTORY && window.TOP100_HISTORY.id) || (main && main.dataset && main.dataset.history) || "";
  const URL_DATA = "/factions-cards.json" + (ver ? "?v=" + encodeURIComponent(ver) : "");
  const SHOW_ROSTER = 10,
    SHOW_EVENTS = 12;

  const esc = s =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const num = n =>
    Number(n || 0)
      .toLocaleString("ru-RU")
      .replace(/\u202f|\u00a0/g, " ");
  function plural(n, one, few, many) {
    const a = n % 10,
      b = n % 100;
    return num(n) + " " + (a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many);
  }
  const fmtD = d => {
    const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(d || "");
    return m ? m[3] + "." + m[2] : "";
  };
  const CROWN =
    '<svg class="fc-crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 11H5z" fill="currentColor"/></svg>';
  const ICON = {
    join: "+",
    left: "−",
    level: "★",
    slots:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/></svg>',
    leader: CROWN
  };

  let data = null,
    loading = null,
    root = null,
    cur = null,
    lastFocus = null,
    basePath = location.pathname,
    baseSearch = location.search;

  function load() {
    if (data) return Promise.resolve(data);
    if (!loading)
      loading = fetch(URL_DATA)
        .then(r => {
          if (!r.ok) throw new Error(r.status);
          return r.json();
        })
        .then(d => {
          data = d;
          data.bySlug = {};
          data.byName = {};
          for (const f of d.factions || []) {
            data.bySlug[f.s] = f;
            data.byName[f.n] = f;
          }
          return d;
        })
        .catch(e => {
          loading = null;
          throw e;
        });
    return loading;
  }

  function ensureRoot() {
    if (root) return root;
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div class="fc-overlay" id="fcOverlay" hidden><div class="fc-dialog" role="dialog" aria-modal="true" aria-labelledby="fcTitle" tabindex="-1"><div class="fc-body" id="fcBody"></div></div></div>'
    );
    root = document.getElementById("fcOverlay");
    root.addEventListener("click", e => {
      if (e.target === root || e.target.closest("[data-fc-close]")) return close();
      if (e.target.closest("[data-fc-share]")) return share(e.target.closest("[data-fc-share]"));
      const more = e.target.closest("[data-fc-more]");
      if (more) {
        const box = root.querySelector(more.dataset.fcMore);
        if (box) box.classList.add("fc-all");
        more.remove();
      }
    });
    return root;
  }
  function show() {
    ensureRoot();
    if (root.hidden) {
      lastFocus = document.activeElement;
      root.hidden = false;
      document.documentElement.classList.add("fc-lock");
    }
  }
  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    document.documentElement.classList.remove("fc-lock");
    cur = null;
    if (/^\/f\//.test(location.pathname) || /^#f=/.test(location.hash))
      history.replaceState(null, "", basePath + baseSearch);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function share(btn) {
    if (!cur) return;
    const url = location.origin + "/f/" + encodeURIComponent(cur.s);
    const done = () => {
      btn.classList.add("ok");
      btn.title = "Ссылка скопирована";
      setTimeout(() => {
        btn.classList.remove("ok");
        btn.title = "Скопировать ссылку на карточку";
      }, 1600);
    };
    if (navigator.share && matchMedia("(pointer:coarse)").matches)
      navigator.share({ title: cur.n + " - Сердце Зоны", url: url }).catch(() => {});
    else if (navigator.clipboard)
      navigator.clipboard.writeText(url).then(done, () => prompt("Ссылка на карточку:", url));
    else prompt("Ссылка на карточку:", url);
  }

  /* игрок: ссылка на его карточку (player-card.js), если он есть в выгрузке */
  const who = (id, n) =>
    id ? '<a href="/p/' + esc(id) + '" data-pc-open="' + esc(id) + '">' + esc(n) + "</a>" : esc(n);

  function eventRow(e) {
    let title, sub;
    const arrow = s => esc(String(s || "").replace("→", "\u00a0→\u00a0"));
    if (e.t === "join") {
      title = who(e.id, e.n);
      sub = e.x ? "из «" + esc(e.x) + "»" : "Принят";
    } else if (e.t === "left") {
      title = who(e.id, e.n);
      sub = e.x ? "ушёл в «" + esc(e.x) + "»" : "Покинул";
    } else if (e.t === "level") {
      title = "Уровень группировки " + arrow(e.x);
      sub = "Уровень";
    } else if (e.t === "slots") {
      title = "Места расширены: " + arrow(e.x);
      sub = "Места";
    } else {
      title = "Новый лидер: " + who(e.id, e.n || "?");
      sub = "Лидер";
    }
    return (
      '<li class="fc-ev"><span class="fc-ic fc-ic-' +
      e.t +
      '" aria-hidden="true">' +
      ICON[e.t] +
      "</span><div><b>" +
      title +
      "</b><small>" +
      sub +
      '</small></div><time datetime="' +
      esc(e.d) +
      '">' +
      fmtD(e.d) +
      "</time></li>"
    );
  }

  function render(f) {
    const theme = f.k
      ? ";--fc-bg:url(/assets/bg-" + f.k + "-1280.webp);--fc-bg-m:url(/assets/bg-" + f.k + "-m.webp)"
      : "";
    const leadId = f.lead && f.lead.id;
    const places = f.cap ? f.m + " из " + f.cap + " мест" : plural(f.m, "боец", "бойца", "бойцов");
    const stats = [
      ["Уровень", f.lv],
      ["Бойцов", f.cap ? f.m + " / " + f.cap : f.m],
      ["Репутация", num(f.t.reputation)],
      ["Боссы", num(f.t.bosses)],
      ["Экспедиции", num(f.t.expeditions)],
      ["Рейтинг активности", "#" + f.rank]
    ];
    const kv = [];
    if (f.lead) kv.push(["Лидер", '<b class="fc-leader">' + CROWN + " " + who(leadId, f.lead.n) + "</b>"]);
    if (f.recruit)
      kv.push([
        "Набор",
        '<span class="fc-tag">Открыт</span>' + (f.req ? ' <span class="fc-req">приём ' + esc(f.req) + "</span>" : "")
      ]);
    if (f.contacts.length)
      kv.push([
        "Связь",
        f.contacts
          .map(c =>
            c.url
              ? '<a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + esc(c.n) + "</a>"
              : "<b>" + esc(c.n) + "</b>"
          )
          .join(", ")
      ]);
    const vk = f.vk
      ? '<a class="fc-vk" href="' +
        esc(f.vk.url) +
        '" target="_blank" rel="noopener"><i aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12.8 17.5C6.6 17.5 3.1 13.3 3 6.3h3.1c.1 5.1 2.4 7.3 4.2 7.8V6.3h2.9v4.4c1.8-.2 3.7-2.2 4.3-4.4h2.9c-.5 2.7-2.5 4.7-3.9 5.5 1.4.7 3.7 2.4 4.5 5.7h-3.2c-.7-2.2-2.4-3.9-4.6-4.1v4.1z"/></svg></i><span><small>Группа ВКонтакте</small>' +
        esc(f.vk.n) +
        "</span></a>"
      : "";
    /* вступление показываем всегда, даже если мест сейчас нет */
    const joinUrl = f.post || (f.vk && f.vk.url);
    const join = joinUrl
      ? '<a class="fc-join" href="' +
        esc(joinUrl) +
        '" target="_blank" rel="noopener">Вступить · ' +
        (f.post ? "пост о наборе" : "группа ВК") +
        "</a>"
      : "";
    const rows = f.r
      .map(
        (p, i) =>
          '<tr class="' +
          (i >= SHOW_ROSTER ? "fc-extra" : "") +
          (p[5] ? " fc-off" : "") +
          '"><td class="fc-mono">' +
          (i + 1) +
          "</td><td>" +
          (p[0] === leadId ? '<span class="fc-leader">' + CROWN + "</span> " : "") +
          who(p[0], p[1]) +
          '</td><td><span class="fc-lvl">' +
          p[2] +
          '</span></td><td class="fc-mono">' +
          num(p[3]) +
          '</td><td class="fc-mono fc-col-b">' +
          num(p[4]) +
          "</td></tr>"
      )
      .join("");
    const roster = f.r.length
      ? '<div class="fc-table" id="fcRoster"><table><thead><tr><th>#</th><th>Боец</th><th>Ур.</th><th>Репутация</th><th class="fc-col-b">Боссы</th></tr></thead><tbody>' +
        rows +
        "</tbody></table></div>" +
        (f.r.length > SHOW_ROSTER
          ? '<button type="button" class="fc-more" data-fc-more="#fcRoster">Показать всех ' + f.r.length + "</button>"
          : "") +
        (f.r.length < f.m
          ? '<p class="fc-note">Ещё ' +
            plural(f.m - f.r.length, "боец", "бойца", "бойцов") +
            " пока без прогресса - их нет в ежедневной выгрузке</p>"
          : "")
      : '<p class="fc-note">Бойцов с прогрессом пока нет</p>';
    const events = f.ev.length
      ? '<ol class="fc-evs" id="fcEvents">' +
        f.ev.map(eventRow).join("") +
        "</ol>" +
        (f.ev.length > SHOW_EVENTS
          ? '<button type="button" class="fc-more" data-fc-more="#fcEvents">Вся история · ' +
            f.ev.length +
            " →</button>"
          : "")
      : '<p class="fc-note">Событий пока нет: история копится по ежедневным выгрузкам</p>';

    const dialog = root.querySelector(".fc-dialog");
    dialog.setAttribute("style", "--c:" + f.c + theme);
    dialog.classList.toggle("fc-nobg", !f.k);
    document.getElementById("fcBody").innerHTML =
      '<div class="fc-top"><span class="fc-glass fc-pill">Группировка // Штаб</span><span class="fc-tools">' +
      '<button type="button" class="fc-glass fc-ibtn" data-fc-share title="Скопировать ссылку на карточку" aria-label="Скопировать ссылку на карточку"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg></button>' +
      '<button type="button" class="fc-glass fc-ibtn" data-fc-close title="Закрыть" aria-label="Закрыть"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></span></div>' +
      '<div class="fc-grid"><aside class="fc-glass fc-side"><div class="fc-chev">' +
      f.e +
      '</div><h2 id="fcTitle">' +
      esc(f.n) +
      '</h2><div class="fc-ring"><span class="fc-lvl">УР ' +
      f.lv +
      "</span><span>" +
      places +
      "</span></div>" +
      (f.motto ? '<blockquote class="fc-motto">«' + esc(f.motto) + "»</blockquote>" : "") +
      (kv.length
        ? '<dl class="fc-kv">' + kv.map(x => "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>").join("") + "</dl>"
        : "") +
      (f.recruit ? '<p class="fc-rec">' + esc(f.recruit) + "</p>" : "") +
      vk +
      join +
      '</aside><div class="fc-main"><div class="fc-stats">' +
      stats.map(s => '<div class="fc-glass fc-st"><small>' + s[0] + "</small><b>" + s[1] + "</b></div>").join("") +
      '</div><section class="fc-glass fc-pad"><h3>Состав · ' +
      f.r.length +
      "</h3>" +
      roster +
      '</section></div><section class="fc-glass fc-pad fc-hist"><h3>История</h3>' +
      events +
      "</section></div>";
    dialog.scrollTop = 0;
  }

  function open(key, byName) {
    /* из карточки игрока: сначала закрываем её, она лежит выше */
    const pc = document.getElementById("pcOverlay");
    if (pc && !pc.hidden) {
      const x = document.getElementById("pcClose");
      if (x) x.click();
    }
    show();
    if (!data) document.getElementById("fcBody").innerHTML = '<div class="fc-loading"><i></i>Связь со штабом…</div>';
    load()
      .then(() => {
        const f = byName ? data.byName[key] : data.bySlug[key];
        if (!f) {
          close();
          if (!/^\/factions/.test(location.pathname)) location.href = "/factions";
          return;
        }
        cur = f;
        render(f);
        if (!/^\/f\//.test(location.pathname)) {
          basePath = location.pathname;
          baseSearch = location.search;
        }
        history.replaceState(null, "", "/f/" + encodeURIComponent(f.s));
        root.querySelector(".fc-dialog").focus({ preventScroll: true });
      })
      .catch(() => {
        document.getElementById("fcBody").innerHTML =
          '<div class="fc-loading fc-err"><b>Не удалось загрузить карточку</b>Проверьте соединение и попробуйте ещё раз.<button type="button" class="fc-more" data-fc-close>Закрыть</button></div>';
      });
  }

  document.addEventListener("click", e => {
    const a = e.target.closest("[data-fc-open], [data-fc-name]");
    if (!a || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (a.dataset.fcOpen) open(a.dataset.fcOpen);
    else open(a.dataset.fcName, true);
  });
  /* Esc: если сверху открыта карточка игрока - закрывается она, а не штаб */
  document.addEventListener(
    "keydown",
    e => {
      if (e.key !== "Escape" || !root || root.hidden) return;
      const pc = document.getElementById("pcOverlay");
      if (pc && !pc.hidden) return;
      close();
    },
    true
  );
  function fromHash() {
    const m = location.hash.match(/^#f=(.+)$/);
    if (!m) return;
    let slug;
    try {
      slug = decodeURIComponent(m[1]);
    } catch {
      return;
    }
    open(slug);
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
