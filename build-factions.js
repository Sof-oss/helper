"use strict";
/* Страница «Группировки» (/factions): карточки рисуются при сборке (build.js) и уходят в HTML готовыми.
 * Откуда данные:
 *  - top100/clans.json - список группировок из игры: уровень, число бойцов, лидер (обновляет fetch-players.js);
 *  - top100-players.json - игроки с прогрессом и их группировки: из них собирается состав;
 *  - top100/factions.json - цвета группировок, ui.js - эмблемы основных группировок (как в карточках игроков);
 *  - factions-info.json - то, чего нет в API: девиз, объявление о наборе, группа ВК, контакты (правится вручную);
 *    "hidden": true убирает группировку со страницы (служебные, например админская «О-Сознание»).
 * Возвращает { stats, rank, list, history, count, hiring } - разметку для #factionsStats, #factionsRank и #factionsList в factions.html и версию выгрузки
 * игроков (для карточек игроков: тот же адрес top100-players.json, что на странице Топ-100, - файл качается один раз),
 * а также число группировок и сколько из них ведут набор (живая строка плашки на главной) */
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
  /* фото базы для карточки - assets/bg-<тема>-card.webp (720×260, кадр из фона темы), с ?v=<хэш>, как у остальных картинок.
     У группировок без темы фото нет - вместо него подсветка цветом группировки (.fx-bg-tint) */
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
  const stats =
    '<div class="fx-stat"><b>' +
    num(list.length) +
    "</b><span>" +
    plural(list.length, "группировка", "группировки", "группировок").replace(/^\S+ /, "") +
    '</span></div><div class="fx-stat"><b>' +
    num(total) +
    "</b><span>" +
    plural(total, "боец", "бойца", "бойцов").replace(/^\S+ /, "") +
    " в группировках</span></div>";

  /* рейтинг активности: суммарные показатели всех бойцов группировки.
     Метрики - те же семь разделов, что во вкладках Топ-100; активность - среднее по ним, где лучший результат каждого принят за 100 */
  const METRICS = [
    { key: "reputation", label: "Репутация", color: "#f48fb1" },
    { key: "bosses", label: "Боссы", color: "#ff8a65" },
    { key: "stashes", label: "Тайники", color: "#26c6da" },
    { key: "talents", label: "Таланты", color: "#ffb74d" },
    { key: "collections", label: "Коллекции", color: "#c9a6ff" },
    { key: "expeditions", label: "Экспедиции", color: "#9fdc9f" },
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
      hint: m.label + ": суммарно по бойцам группировки из Топ-100"
    }))
  ];
  const rankRows = ranked
    .map((f, i) => {
      const attrs = activeMetrics.map(m => " data-" + m.key + '="' + Math.round(f.totals[m.key]) + '"').join("");
      const members = f.members || 0;
      return (
        '<li class="fx-rank-row" data-activity="' +
        f.activity +
        '"' +
        attrs +
        ' data-members="' +
        members +
        '"><span class="fx-rank-place" aria-hidden="true">' +
        (i + 1) +
        '</span><a class="fx-rank-name" href="#' +
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
  /* история по датам: суммы показателей каждой группировки - для периодов и своего диапазона */
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
  const rankHistory = { dates: histDates, metrics: activeMetrics.map(m => m.key), factions: {} };
  list.forEach(f => {
    const series = {};
    activeMetrics.forEach(m => {
      const mi = metricIdx[m.key];
      series[m.key] = histRaw.map((_, di) => f.people.reduce((s, p) => s + valueAt(p, mi, di), 0));
    });
    rankHistory.factions[anchor(f.c.name)] = series;
  });
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
  const compactCards = ranked
    .slice(0, 5)
    .map((f, i) => {
      const v = visuals.get(f.c.name) || { color: "#8fa3b4", emblem: "" };
      return (
        '<a class="fx-rank-card" href="#' +
        anchor(f.c.name) +
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
    '<div class="fx-rank-modal" id="fxRankModal" aria-hidden="true"><div class="fx-rank-modal-backdrop" data-close-rank></div><section class="fx-rank fx-rank-dialog" role="dialog" aria-modal="true" aria-labelledby="fxRankModalTitle"><header class="fx-rank-head"><div><h2 id="fxRankModalTitle">Рейтинг активности</h2><p>Показатели группировок за выбранный период по данным Топ-100</p></div><div class="fx-rank-modal-tools">' +
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
    '</ol><p class="fx-rank-note">Суммы считаются по бойцам с прогрессом, которые попали в ежедневную выгрузку Топ-100. Активность - среднее по семи показателям, лучший результат по каждому принят за 100.</p></div></section></div>';
  const rank =
    '<div class="fx-rank-wrap" data-fx-rank style="--m:var(--accent)"><script type="application/json" id="fxRankHistory">' +
    historyJson +
    "</script>" +
    compact +
    modal +
    "</div>";

  const cards = list.map(({ c, people, leaderId, members }) => {
    const name = c.name,
      color = colors[name] || "#8fa3b4",
      key = KEY[name],
      add = info[name] || {};
    const emblem =
      '<svg viewBox="0 0 64 72" aria-hidden="true">' +
      (key && GLYPHS[key] ? GLYPHS[key] : shield(name, color)) +
      "</svg>";
    const meta = ["Уровень " + (c.level || 1), plural(members, "боец", "бойца", "бойцов")];
    const leaderInData = leaderId && data.players[leaderId];
    const leaderName = leaderInData ? data.players[leaderId].n : c.leader && c.leader.name;
    const leader = leaderName
      ? '<p class="fx-leader"><span class="fx-label">Лидер</span>' +
        (leaderInData
          ? '<a href="/p/' + esc(leaderId) + '" data-pc-open="' + esc(leaderId) + '">' + esc(leaderName) + "</a>"
          : "<b>" + esc(leaderName) + "</b>") +
        "</p>"
      : '<p class="fx-leader fx-muted"><span class="fx-label">Лидер</span>не назначен</p>';
    const motto = add.motto ? '<blockquote class="fx-motto">«' + esc(add.motto) + "»</blockquote>" : "";
    const post = safeUrl(add.post);
    const postHtml = post
      ? '<a class="fx-src" href="' + esc(post) + '" target="_blank" rel="noopener">Пост о наборе ВК</a>'
      : "";
    /* пост о наборе - в шапке объявления справа, у всех карточек на одном месте */
    const recruit = add.recruit
      ? '<div class="fx-recruit"><div class="fx-recruit-head"><span class="fx-tag">Набор открыт</span>' +
        (add.requirement ? '<span class="fx-req">Приём ' + esc(add.requirement) + "</span>" : "") +
        postHtml +
        "</div><p>" +
        esc(add.recruit) +
        "</p></div>"
      : "";
    /* группа ВК - отдельной заметной кнопкой, контакты - своей строкой ниже */
    const vk = add.vk && safeUrl(add.vk.url);
    const vkHtml = vk
      ? '<a class="fx-vk" href="' +
        esc(vk) +
        '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.8 17.5C6.6 17.5 3.1 13.3 3 6.3h3.1c.1 5.1 2.4 7.3 4.2 7.8V6.3h2.9v4.4c1.8-.2 3.7-2.2 4.3-4.4h2.9c-.5 2.7-2.5 4.7-3.9 5.5 1.4.7 3.7 2.4 4.5 5.7h-3.2c-.7-2.2-2.4-3.9-4.6-4.1v4.1z"/></svg><span><small>Группа ВКонтакте</small>' +
        esc(add.vk.name || "Перейти") +
        "</span></a>"
      : "";
    const contacts = (add.contacts || [])
      .map(p => [
        safeUrl(p.url),
        String(p.name || "")
          .replace(/^@+/, "")
          .trim()
      ])
      .filter(([, n]) => n)
      /* контакт без ссылки (url не указан) - просто имя, без перехода */
      .map(([u, n]) =>
        u
          ? '<a class="fx-btn" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(n) + "</a>"
          : '<span class="fx-btn fx-btn-plain">' + esc(n) + "</span>"
      );
    const linksHtml =
      contacts.length || (post && !add.recruit)
        ? '<div class="fx-links">' +
          (contacts.length ? '<span class="fx-label">Связь</span>' + contacts.join("") : "") +
          (add.recruit ? "" : postHtml) +
          "</div>"
        : "";
    const known = people.length;
    const rows = people
      .map(
        (p, i) =>
          "<li" +
          (p.id === leaderId ? ' class="fx-lead"' : p.off ? ' class="fx-off"' : "") +
          '><span class="fx-n">' +
          (i + 1) +
          '</span><a href="/p/' +
          esc(p.id) +
          '" data-pc-open="' +
          esc(p.id) +
          '">' +
          esc(p.n) +
          "</a>" +
          (p.id === leaderId ? '<span class="fx-crown" title="Лидер">★</span>' : "") +
          '<span class="fx-lvl">ур. ' +
          p.l +
          '</span><span class="fx-rep" title="Репутация">' +
          num(p.rep) +
          "</span></li>"
      )
      .join("");
    const rosterHtml = known
      ? '<details class="fx-roster"><summary>Состав <span>' +
        num(known) +
        (known < members ? " из " + num(members) : "") +
        "</span></summary><ol>" +
        rows +
        "</ol>" +
        (known < members
          ? '<p class="fx-note">Остальные пока без прогресса и в выгрузку Топ-100 не попадают</p>'
          : "") +
        "</details>"
      : '<p class="fx-note">' + (members ? "Бойцов с прогрессом пока нет" : "В группировке пока никого нет") + "</p>";
    return (
      '<article class="fx-card' +
      (add.recruit ? " fx-hiring" : "") +
      '" id="' +
      anchor(name) +
      '" data-name="' +
      esc(name.toLowerCase()) +
      '" style="--fx:' +
      esc(color) +
      '">' +
      (key && cardBg(key)
        ? '<span class="fx-bg" style="background-image:url(' + cardBg(key) + ')" aria-hidden="true"></span>'
        : '<span class="fx-bg fx-bg-tint" aria-hidden="true"></span>') +
      '<header class="fx-head"><span class="fx-emblem">' +
      emblem +
      '</span><div><h2><a href="#' +
      anchor(name) +
      '">' +
      esc(name) +
      '</a></h2><p class="fx-meta">' +
      meta.map(esc).join(" · ") +
      "</p></div></header>" +
      motto +
      leader +
      vkHtml +
      recruit +
      linksHtml +
      rosterHtml +
      "</article>"
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
    history,
    count: list.length,
    hiring: list.filter(f => (info[f.c.name] || {}).recruit).length
  };
}

module.exports = factionsMarkup;
/* чистые помощники - для тестов: экранирование, проверка ссылок и якорь карточки */
module.exports.esc = esc;
module.exports.safeUrl = safeUrl;
module.exports.anchor = anchor;
