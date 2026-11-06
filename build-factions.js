"use strict";
/* Страница «Группировки» (/factions): карточки рисуются при сборке (build.js) и уходят в HTML готовыми. */
const fs = require("fs");
const path = require("path");

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
const readJson = (file, def) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    if (def !== undefined && e.code === "ENOENT") return def;
    throw new Error(path.basename(file) + ": " + e.message);
  }
};
/* только http(s)-ссылки: адреса пишут люди руками, javascript: и прочее на страницу не пускаем */
const safeUrl = u => (/^https:\/\/[^\s"<>]+$/i.test(String(u || "")) ? String(u) : "");
/* якорь карточки: латиница/цифры как есть, остальное - по номеру символа (стабильно между сборками) */
const anchor = name =>
  "f-" +
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-|-$/g, "")
    .replace(/[а-яё]/g, ch => TRANSLIT[ch] || "")
    .replace(/-+/g, "-");
/* адрес карточки группировки: /f/<slug> (тот же якорь без «f-») */
const slugOf = name =>
  anchor(name).replace(/^f-/, "") ||
  "g" + [...String(name)].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) >>> 0, 7).toString(36);
/* места в группировке: 20 с самого начала, расширение до 25 / 30 / 40 можно взять на 2 / 5 / 10 уровне
   (а можно выбрать другое улучшение). Лимит берём наименьший из доступных по уровню, в который помещались все бойцы;
   если подходит больше одного варианта - лимит неизвестен (null) */
const SLOT_TIERS = [
  [1, 20],
  [2, 25],
  [5, 30],
  [10, 40]
];
function slotCap(level, maxMembers) {
  const fit = SLOT_TIERS.filter(t => (level || 1) >= t[0] && t[1] >= (maxMembers || 0)).map(t => t[1]);
  return { cap: fit.length ? fit[0] : null, sure: fit.length === 1 };
}
const TRANSLIT = Object.fromEntries(
  "а:a б:b в:v г:g д:d е:e ё:e ж:zh з:z и:i й:y к:k л:l м:m н:n о:o п:p р:r с:s т:t у:u ф:f х:h ц:ts ч:ch ш:sh щ:sch ъ: ы:y ь: э:e ю:yu я:ya"
    .split(" ")
    .map(p => p.split(":"))
);

/* щиток в цвете группировки с первой буквой - как нашивка в карточке игрока (player-card.js) */
function shield(name, color) {
  const c = esc(color),
    ch = esc((String(name).replace(/[^\p{L}\p{N}]/gu, "")[0] || "?").toUpperCase());
  return (
    '<path d="M7 3h50a3 3 0 0 1 3 3v34c0 14-12 24-28 30C16 64 4 54 4 40V6a3 3 0 0 1 3-3z" fill="#0b0f14" stroke="' +
    c +
    '" stroke-width="3.5" stroke-linejoin="round"/><path d="M5.8 4.8h52.4V13H5.8z" fill="' +
    c +
    '"/><text x="32" y="47" text-anchor="middle" font-family="Oswald,Arial,sans-serif" font-weight="700" font-size="28" fill="' +
    c +
    '">' +
    ch +
    "</text>"
  );
}

function factionsMarkup(ROOT) {
  /* фото базы для карточки - assets/bg-<тема>-card.webp (720×260, кадр из фона темы), с ?v=<хэш>, как у остальных картинок. */
  const cardBg = key => {
    const f = path.join(ROOT, "assets", "bg-" + key + "-card.webp");
    if (!fs.existsSync(f)) return "";
    const v = require("crypto").createHash("md5").update(fs.readFileSync(f)).digest("hex").slice(0, 8);
    return "/assets/bg-" + key + "-card.webp?v=" + v;
  };
  const clansFile = readJson(path.join(ROOT, "top100", "clans.json"), { clans: [] });
  const data = readJson(path.join(ROOT, "top100-players.json"));
  const colors = readJson(path.join(ROOT, "top100", "factions.json"), {});
  const info = readJson(path.join(ROOT, "factions-info.json"), {});
  const uiSrc = fs.readFileSync(path.join(ROOT, "ui.js"), "utf8");
  const GLYPHS = Object.fromEntries(
    [
      ...uiSrc.matchAll(
        /^\s*(merc|dolg|svoboda|science|monolith|rassvet|loners|traders|renegades|clearsky|bandits):\s*'(.*)',?\s*$/gm
      )
    ].map(m => [m[1], m[2]])
  );
  const KEY = Object.fromEntries(
    [...uiSrc.matchAll(/\{\s*key:\s*"(\w+)",\s*label:\s*"([^"]+)"/g)].map(m => [m[2], m[1]])
  );
  if (Object.keys(GLYPHS).length < 11 || Object.keys(KEY).length < 11)
    throw new Error("build-factions: не удалось прочитать эмблемы группировок из ui.js");

  const REP = data.metrics.indexOf("reputation");
  if (REP < 0) throw new Error("build-factions: в top100-players.json нет показателя reputation");

  /* состав: игроки с прогрессом из ежедневной выгрузки */
  const roster = new Map();
  for (const [id, p] of Object.entries(data.players)) {
    if (!p.g || p.g === "-") continue;
    if (!roster.has(p.g)) roster.set(p.g, []);
    roster
      .get(p.g)
      .push({ id, n: p.n, l: p.l || 1, rep: (p.v && p.v[REP]) || 0, v: p.v || [], s: p.s || [], off: !!p.off });
  }

  /* группировки из игры + те, что встречаются только у игроков (если список из игры устарел) */
  const clans = new Map();
  for (const c of clansFile.clans || []) if (c && c.name) clans.set(c.name, c);
  for (const g of roster.keys()) if (!clans.has(g)) clans.set(g, { name: g, members: roster.get(g).length });
  for (const [name, add] of Object.entries(info)) if (add && add.hidden) clans.delete(name);

  const list = [...clans.values()]
    .map(c => {
      const people = (roster.get(c.name) || []).sort((a, b) => b.rep - a.rep || b.l - a.l);
      const leaderId = c.leader && c.leader.id != null ? String(c.leader.id) : null;
      return {
        c,
        people,
        leaderId,
        members: Math.max(c.members ?? 0, people.length),
        rep: people.reduce((s, p) => s + p.rep, 0)
      };
    })
    .sort((a, b) => b.members - a.members || (b.c.level || 1) - (a.c.level || 1) || b.rep - a.rep);

  const total = list.reduce((s, f) => s + f.members, 0);
  const hiringCount = list.filter(f => (info[f.c.name] || {}).recruit).length;
  const stat = (n, label) => '<div class="fx-stat"><b>' + num(n) + "</b><span>" + label + "</span></div>";
  const stats =
    stat(list.length, plural(list.length, "группировка", "группировки", "группировок").replace(/^\S+ /, "")) +
    stat(total, plural(total, "боец", "бойца", "бойцов").replace(/^\S+ /, "")) +
    stat(hiringCount, hiringCount === 1 ? "ведёт набор" : "ведут набор");

  /* рейтинг активности: суммарные показатели всех бойцов группировки. */
  const METRICS = [
    { key: "reputation", label: "Репутация", color: "#f48fb1" },
    { key: "bosses", label: "Боссы", color: "#ff8a65" },
    { key: "stashes", label: "Тайники", color: "#26c6da" },
    { key: "talents", label: "Таланты", color: "#ffb74d" },
    { key: "collections", label: "Коллекции", color: "#c9a6ff" },
    { key: "expeditions", label: "Вылазки", color: "#9fdc9f" },
    { key: "defense", label: "Защита лагеря", color: "#54bfff" }
  ];
  const metricIdx = Object.fromEntries(METRICS.map(m => [m.key, data.metrics.indexOf(m.key)]));
  const activeMetrics = METRICS.filter(m => metricIdx[m.key] >= 0);
  list.forEach(f => {
    f.totals = {};
    activeMetrics.forEach(m => {
      f.totals[m.key] = f.people.reduce((s, p) => s + ((p.v || [])[metricIdx[m.key]] || 0), 0);
    });
  });
  const maxBy = {};
  activeMetrics.forEach(m => {
    maxBy[m.key] = Math.max(1, ...list.map(f => f.totals[m.key]));
  });
  list.forEach(f => {
    f.activity = activeMetrics.length
      ? Math.round((activeMetrics.reduce((s, m) => s + f.totals[m.key] / maxBy[m.key], 0) / activeMetrics.length) * 100)
      : 0;
  });
  const ranked = list
    .slice()
    .sort((a, b) => b.activity - a.activity || b.members - a.members || a.c.name.localeCompare(b.c.name, "ru"));
  const rankTabs = [
    {
      key: "activity",
      label: "Активность",
      color: "var(--accent)",
      hint: "Индекс активности: среднее по всем показателям, лучший результат по каждому - 100"
    },
    ...activeMetrics.map(m => ({
      key: m.key,
      label: m.label,
      color: m.color,
      hint: m.label + ": суммарно по всем бойцам группировки с прогрессом"
    }))
  ];
  const visuals = new Map(
    list.map(f => {
      const key = KEY[f.c.name],
        color = colors[f.c.name] || "#8fa3b4";
      return [
        f.c.name,
        {
          color,
          emblem:
            '<svg viewBox="0 0 64 72" aria-hidden="true">' +
            (key && GLYPHS[key] ? GLYPHS[key] : shield(f.c.name, color)) +
            "</svg>"
        }
      ];
    })
  );
  const rankRows = ranked
    .map((f, i) => {
      const attrs = activeMetrics.map(m => " data-" + m.key + '="' + Math.round(f.totals[m.key]) + '"').join("");
      const members = f.members || 0,
        v = visuals.get(f.c.name) || { color: "#8fa3b4", emblem: "" };
      return (
        '<li class="fx-rank-row" data-activity="' +
        f.activity +
        '"' +
        attrs +
        ' data-members="' +
        members +
        '"><span class="fx-rank-place" aria-hidden="true">' +
        (i + 1) +
        '</span><span class="fx-rank-emblem" aria-hidden="true">' +
        v.emblem +
        '</span><a class="fx-rank-name" href="/f/' +
        esc(slugOf(f.c.name)) +
        '" data-fc-open="' +
        esc(slugOf(f.c.name)) +
        '" data-anchor="' +
        anchor(f.c.name) +
        '">' +
        esc(f.c.name) +
        "<small>" +
        plural(members, "боец", "бойца", "бойцов") +
        '</small></a><b class="fx-rank-value" data-rank-value>' +
        num(f.activity) +
        '</b><span class="fx-rank-bar" aria-hidden="true"><i data-rank-bar style="width:' +
        Math.max(2, f.activity) +
        '%"></i></span></li>'
      );
    })
    .join("");
  const updated = String(data.updated || "").split(" ")[0];

  const histRaw = Array.isArray(data.dates) ? data.dates : [];
  const histDates = histRaw.map(ts => new Date(ts + 3 * 3600000).toISOString().slice(0, 10));
  const valueAt = (p, mi, di) => {
    let v = 0;
    for (const pt of p.s || []) {
      if (pt[0] > di) break;
      const x = pt[2 + mi];
      if (x !== null && x !== undefined) v = x;
    }
    return v;
  };
  const groupAt = (p, di) => {
    const gh = p.gh;
    if (!Array.isArray(gh) || !gh.length) return p.g || "";
    let g = "";
    for (const h of gh) {
      if (h[0] > di) break;
      g = h[1] || "";
    }
    return g;
  };
  const rankHistory = { dates: histDates, metrics: activeMetrics.map(m => m.key), factions: {} };
  list.forEach(f => {
    const series = {};
    activeMetrics.forEach(m => {
      series[m.key] = histRaw.map(() => 0);
    });
    rankHistory.factions[anchor(f.c.name)] = series;
  });
  if (histRaw.length > 1) {
    for (const p of Object.values(data.players)) {
      const s = p.s || [];
      if (!s.length) continue;
      /* первый снимок бойца - точка отсчёта, а не прирост */
      for (let di = Math.max(1, s[0][0] + 1); di < histRaw.length; di++) {
        const group = groupAt(p, di);
        if (!group || group !== groupAt(p, di - 1)) continue;
        const target = rankHistory.factions[anchor(group)];
        if (!target) continue;
        activeMetrics.forEach(m => {
          const mi = metricIdx[m.key],
            cur = valueAt(p, mi, di),
            prev = valueAt(p, mi, di - 1);
          if (cur > prev) target[m.key][di] += cur - prev;
        });
      }
    }
    /* массивы накопительные: клиент вычитает значение начала периода из значения конца */
    for (const series of Object.values(rankHistory.factions))
      for (const key of rankHistory.metrics) {
        const arr = series[key];
        for (let i = 1; i < arr.length; i++) arr[i] += arr[i - 1];
      }
  }
  const historyJson = JSON.stringify(rankHistory).replace(/</g, "\\u003c");
  const firstDate = histDates[0] || "",
    lastDate = histDates[histDates.length - 1] || "",
    defaultFrom = histDates.length ? histDates[Math.max(0, histDates.length - 8)] : "";
  const periods = [
    { key: "all", label: "Всё время" },
    { key: "d1", label: "Сутки" },
    { key: "d7", label: "Неделя" },
    { key: "d30", label: "Месяц" },
    { key: "custom", label: "Свой период" }
  ];
  const periodsHtml =
    '<div class="fx-rank-periods" role="group" aria-label="Период рейтинга"><span class="fx-rank-period-label">Период</span>' +
    periods
      .map(
        (p, i) =>
          '<button type="button" class="fx-rank-period' +
          (i === 0 ? " on" : "") +
          '" data-rank-period="' +
          p.key +
          '" aria-pressed="' +
          (i === 0) +
          '">' +
          p.label +
          "</button>"
      )
      .join("") +
    "</div>";
  const customHtml =
    '<div class="fx-rank-custom" data-rank-custom hidden><label>От <input type="date" data-rank-from min="' +
    esc(firstDate) +
    '" max="' +
    esc(lastDate) +
    '" value="' +
    esc(defaultFrom) +
    '" aria-label="Начало периода"></label><label>До <input type="date" data-rank-to min="' +
    esc(firstDate) +
    '" max="' +
    esc(lastDate) +
    '" value="' +
    esc(lastDate) +
    '" aria-label="Конец периода"></label><button type="button" class="fx-rank-apply" data-rank-apply>Показать</button></div>';
  const tabsHtml = rankTabs
    .map(
      (t, i) =>
        '<button type="button" class="fx-rank-tab' +
        (i === 0 ? " on" : "") +
        '" data-rank-metric="' +
        t.key +
        '" data-rank-hint="' +
        esc(t.hint) +
        '" style="--m:' +
        t.color +
        '" aria-pressed="' +
        (i === 0) +
        '">' +
        esc(t.label) +
        "</button>"
    )
    .join("");
  const compactCards = ranked
    .slice(0, 5)
    .map((f, i) => {
      const v = visuals.get(f.c.name) || { color: "#8fa3b4", emblem: "" };
      return (
        '<a class="fx-rank-card" href="/f/' +
        esc(slugOf(f.c.name)) +
        '" data-fc-open="' +
        esc(slugOf(f.c.name)) +
        '" style="--fx:' +
        esc(v.color) +
        '"><span class="fx-rank-card-medal" aria-hidden="true">' +
        (i + 1) +
        '</span><span class="fx-rank-card-emblem" aria-hidden="true">' +
        v.emblem +
        "</span><b>" +
        esc(f.c.name) +
        "</b><small>" +
        plural(f.members || 0, "боец", "бойца", "бойцов") +
        "</small><strong data-card-value>" +
        num(f.activity) +
        '</strong><span class="fx-rank-card-bar" aria-hidden="true"><i data-card-bar style="width:' +
        Math.max(2, f.activity) +
        '%"></i></span></a>'
      );
    })
    .join("");
  const updatedBadge = updated ? '<span class="fx-rank-updated">Обновлено ' + esc(updated) + "</span>" : "";
  const compact =
    '<section class="fx-rank fx-rank-compact" aria-labelledby="fxRankTitle">' +
    '<header class="fx-rank-head"><div><h2 id="fxRankTitle">Рейтинг активности</h2><p>Топ-5 за выбранный период · полный рейтинг - по кнопке</p></div>' +
    updatedBadge +
    "</header>" +
    periodsHtml +
    '<div class="fx-rank-tabs" role="group" aria-label="Показатель рейтинга">' +
    tabsHtml +
    "</div>" +
    customHtml +
    '<p class="fx-rank-hint" data-fx-rank-hint role="status" aria-live="polite">' +
    esc(rankTabs[0].hint) +
    '</p><div class="fx-rank-cards" data-fx-rank-cards>' +
    compactCards +
    '</div><button type="button" class="fx-rank-open" data-open-rank>Весь рейтинг · ' +
    list.length +
    ' группировок <span aria-hidden="true">→</span></button></section>';
  const modal =
    '<div class="fx-rank-modal" id="fxRankModal" aria-hidden="true"><div class="fx-rank-modal-backdrop" data-close-rank></div><section class="fx-rank fx-rank-dialog" role="dialog" aria-modal="true" aria-labelledby="fxRankModalTitle"><header class="fx-rank-head"><div><h2 id="fxRankModalTitle">Рейтинг активности</h2><p>Показатели группировок за выбранный период по ежедневной выгрузке игроков</p></div><div class="fx-rank-modal-tools">' +
    updatedBadge +
    '<button type="button" class="fx-rank-close" data-close-rank aria-label="Закрыть рейтинг">×</button></div></header>' +
    periodsHtml +
    '<div class="fx-rank-tabs" role="group" aria-label="Показатель рейтинга">' +
    tabsHtml +
    "</div>" +
    customHtml +
    '<p class="fx-rank-hint" data-fx-rank-hint role="status" aria-live="polite">' +
    esc(rankTabs[0].hint) +
    '</p><div class="fx-rank-dialog-body"><ol class="fx-rank-list" data-fx-rank-list>' +
    rankRows +
    '</ol><p class="fx-rank-note">Всё время - текущие суммы по составу, за период - прирост, который боец сделал, пока числился в группировке. Активность - среднее по семи показателям, лучший результат по каждому принят за 100.</p></div></section></div>';
  const rank =
    '<div class="fx-rank-wrap" data-fx-rank style="--m:var(--accent)"><script type="application/json" id="fxRankHistory">' +
    historyJson +
    "</script>" +
    compact +
    modal +
    "</div>";

  /* данные для карточек группировок (faction-card.js): состав, показатели и история.
     Вступления и уходы - из истории группировок игроков (gh в top100-players.json, по ежедневным выгрузкам),
     уровень, места и лидер - из top100/clans-history.json (копится с каждой выгрузкой, см. fetch-players.js) */
  const clansHistory = readJson(path.join(ROOT, "top100", "clans-history.json"), { clans: {} }).clans || {};
  const BOSSES = data.metrics.indexOf("bosses");
  const noGroup = g => (!g || g === "-" ? "" : g);
  const events = new Map(list.map(f => [f.c.name, []]));
  /* уход «без группировки», после которого в течение недели игрок вступил в другую группировку,
     связываем в один переход: «ушёл в X» / «из A» вместо «покинул» + «принят»
     (в gh у build-players.js между ними стоит пустая запись, которая разрывает соседние пары) */
  const dayGap = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
  for (const [id, p] of Object.entries(data.players)) {
    const gh = p.gh || [];
    for (let i = 1; i < gh.length; i++) {
      const prev = noGroup(gh[i - 1][1]),
        next = noGroup(gh[i][1]),
        d = histDates[gh[i][0]];
      if (!d || prev === next) continue;
      let linked = false;
      if (prev && !next) {
        for (let k = i + 1; k < gh.length; k++) {
          const cd = histDates[gh[k][0]];
          if (!cd) break;
          const cand = noGroup(gh[k][1]);
          if (!cand) continue;
          if (cand !== prev && dayGap(d, cd) <= 7 && events.has(cand) && events.has(prev)) {
            events.get(prev).push({ d, t: "left", id, n: p.n, x: cand });
            events.get(cand).push({ d: cd, t: "join", id, n: p.n, x: prev });
            i = k; /* пара «пусто → группировка» уже учтена в связке */
            linked = true;
          }
          break; /* смотрим только ближайшую смену группировки */
        }
      }
      if (linked) continue;
      if (events.has(next)) events.get(next).push({ d, t: "join", id, n: p.n, x: prev });
      if (events.has(prev)) events.get(prev).push({ d, t: "left", id, n: p.n, x: next });
    }
  }
  const nameOf = id => (id != null && data.players[String(id)] ? data.players[String(id)].n : "");
  const cardsData = list.map(f => {
    const c = f.c,
      name = c.name,
      add = info[name] || {},
      v = visuals.get(name) || { color: "#8fa3b4", emblem: "" },
      ev = events.get(name) || [];
    const rows = Array.isArray(clansHistory[name]) ? clansHistory[name] : [];
    let maxM = 0,
      prev = null;
    for (const r of rows) {
      const [d, lv, m, lead] = r;
      maxM = Math.max(maxM, m || 0);
      const cap = slotCap(lv, maxM).cap;
      if (prev) {
        if (lv > prev.lv) ev.push({ d, t: "level", x: prev.lv + "→" + lv });
        if (cap && prev.cap && cap > prev.cap) ev.push({ d, t: "slots", x: prev.cap + "→" + cap });
        if (lead != null && prev.lead != null && lead !== prev.lead)
          ev.push({
            d,
            t: "leader",
            id: data.players[String(lead)] ? String(lead) : null,
            n: nameOf(lead) || (c.leader && c.leader.id === lead ? c.leader.name : "")
          });
      }
      prev = { lv, cap, lead };
    }
    const slots = slotCap(c.level || 1, Math.max(maxM, f.members));
    const order = { level: 0, slots: 1, leader: 2, join: 3, left: 4 };
    ev.sort((a, b) =>
      a.d < b.d ? 1 : a.d > b.d ? -1 : order[a.t] - order[b.t] || String(a.n).localeCompare(String(b.n), "ru")
    );
    const leaderId = f.leaderId && data.players[f.leaderId] ? f.leaderId : null;
    const post = safeUrl(add.post),
      vkUrl = add.vk && safeUrl(add.vk.url);
    return {
      s: slugOf(name),
      n: name,
      c: v.color,
      k: KEY[name] && GLYPHS[KEY[name]] ? KEY[name] : null,
      e: v.emblem,
      lv: c.level || 1,
      m: f.members,
      cap: slots.sure ? slots.cap : null,
      lead: leaderId
        ? { id: leaderId, n: data.players[leaderId].n }
        : c.leader && c.leader.name
          ? { id: null, n: c.leader.name }
          : null,
      motto: add.motto || "",
      recruit: add.recruit || "",
      req: add.requirement || "",
      post,
      vk: vkUrl ? { url: vkUrl, n: add.vk.name || "Группа ВКонтакте" } : null,
      contacts: (add.contacts || [])
        .map(p => ({
          n: String(p.name || "")
            .replace(/^@+/, "")
            .trim(),
          url: safeUrl(p.url)
        }))
        .filter(p => p.n),
      t: { reputation: f.totals.reputation || 0, bosses: f.totals.bosses || 0, expeditions: f.totals.expeditions || 0 },
      rank: ranked.indexOf(f) + 1,
      r: f.people.map(p => [p.id, p.n, p.l, p.rep, BOSSES >= 0 ? (p.v || [])[BOSSES] || 0 : 0, p.off ? 1 : 0]),
      ev: ev.slice(0, 300)
    };
  });
  /* карточки на странице: фото базы, эмблема, уровень, место в рейтинге, девиз, заполненность и лидер.
     Вся карточка открывает штаб группировки (faction-card.js), подробности - там.
     Ники бойцов лежат в data-players, чтобы поиск «Группировка или игрок» находил группировку по бойцу */
  const CROWN =
    '<svg class="fx-crown" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 11H5z"/></svg>';
  const cards = ranked.map(f => {
    const d = cardsData[list.indexOf(f)],
      name = d.n,
      slug = esc(d.s),
      open = '" href="/f/' + slug + '" data-fc-open="' + slug + '"';
    const bg = d.k && cardBg(d.k);
    const free = d.cap ? Math.max(0, d.cap - d.m) : 0;
    const text = d.motto
      ? '<p class="fx-motto">«' + esc(d.motto) + "»</p>"
      : d.recruit
        ? '<p class="fx-motto fx-motto-rec">' + esc(d.recruit) + "</p>"
        : '<p class="fx-motto fx-muted">Девиз пока не указан</p>';
    const leader = d.lead
      ? d.lead.id
        ? '<a class="fx-leader" href="/p/' +
          esc(d.lead.id) +
          '" data-pc-open="' +
          esc(d.lead.id) +
          '" title="Лидер">' +
          CROWN +
          "<span>" +
          esc(d.lead.n) +
          "</span></a>"
        : '<span class="fx-leader" title="Лидер">' + CROWN + "<span>" + esc(d.lead.n) + "</span></span>"
      : '<span class="fx-leader fx-muted">лидер не назначен</span>';
    const fill = d.cap ? Math.min(100, Math.round((d.m / d.cap) * 100)) : 100;
    return (
      '<article class="fx-card' +
      (d.recruit ? " fx-hiring" : "") +
      '" id="' +
      anchor(name) +
      '" data-name="' +
      esc(name.toLowerCase()) +
      '" data-players="' +
      esc(JSON.stringify(f.people.map(p => p.n))) +
      '" data-rank="' +
      d.rank +
      '" data-level="' +
      d.lv +
      '" data-members="' +
      d.m +
      '" data-free="' +
      free +
      '" style="--fx:' +
      esc(d.c) +
      '"><span class="fx-photo' +
      (bg ? '" style="background-image:url(' + bg + ')"' : ' fx-photo-tint"') +
      ' aria-hidden="true"></span><a class="fx-emblem' +
      open +
      ' tabindex="-1" aria-hidden="true">' +
      d.e +
      "</a>" +
      (d.recruit ? '<span class="fx-tag">Набор открыт</span>' : "") +
      '<div class="fx-title"><h2><a class="fx-name' +
      open +
      ">" +
      esc(name) +
      '</a></h2><p class="fx-meta"><span class="fx-lvl">УР ' +
      d.lv +
      "</span><span>#" +
      d.rank +
      " в рейтинге</span></p></div>" +
      text +
      '<p class="fx-found" hidden></p><span class="fx-cap" aria-hidden="true"><i style="width:' +
      fill +
      '%"></i></span><footer class="fx-foot">' +
      leader +
      '<span class="fx-count">' +
      (d.cap ? d.m + "/" + d.cap : d.m) +
      " " +
      plural(d.cap || d.m, "боец", "бойца", "бойцов").replace(/^\S+ /, "") +
      '</span><a class="fx-open' +
      open +
      ' tabindex="-1">Штаб <span aria-hidden="true">→</span></a></footer></article>'
    );
  });
  const hist = /TOP100_HISTORY=(\{[^\n]*\})/.exec(fs.readFileSync(path.join(ROOT, "top100-data.js"), "utf8"));
  let history = "";
  try {
    history = (hist && JSON.parse(hist[1]).id) || "";
  } catch (e) {}
  return {
    stats,
    rank,
    list: cards.join("\n"),
    cards: { updated, total: list.length, factions: cardsData },
    history,
    count: list.length,
    hiring: hiringCount
  };
}

module.exports = factionsMarkup;
/* чистые помощники - для тестов: экранирование, проверка ссылок и якорь карточки */
module.exports.esc = esc;
module.exports.safeUrl = safeUrl;
module.exports.anchor = anchor;
module.exports.slugOf = slugOf;
module.exports.slotCap = slotCap;
