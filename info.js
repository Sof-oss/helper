const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString("ru-RU");

/* режет массив строк на n колонок рядом (последняя может быть короче), чтобы 135 талантов не тянулись одним столбцом */
function chunkRows(rows, n) {
  if (n <= 1) return [rows];
  const size = Math.ceil(rows.length / n),
    chunks = [];
  for (let i = 0; i < n; i++) chunks.push(rows.slice(i * size, (i + 1) * size));
  return chunks;
}
const INFO_MILESTONE_STEP = 10;
/* цвет заметки под ПДА по её тексту: новичок зелёный, ветеран оранжевый, учёный бирюзовый */
function infoNoteColor(note) {
  if (note.includes("ветерана")) return "#ffb74d";
  if (note.includes("ученого") || note.includes("учёного")) return "#26c6da";
  return "#6fcf97";
}
/* reached - уровень игрока из калькулятора: строки до него включительно уже получены, сама строка reached - текущая */
function infoTableMarkup(rows, headers, reached) {
  const r = reached || 0;
  return (
    '<table class="data-table info-table' +
    (r ? " info-has-progress" : "") +
    '"><thead><tr>' +
    headers.map(h => "<th>" + h + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows
      .map(([lvl, step, totalSum]) => {
        const cls = [];
        if (lvl % INFO_MILESTONE_STEP === 0) cls.push("info-milestone");
        if (lvl <= r) cls.push("info-done");
        if (lvl === r) cls.push("info-current");
        return (
          "<tr" +
          (cls.length ? ' class="' + cls.join(" ") + '"' : "") +
          (lvl === r ? ' title="Ваш уровень из калькулятора"' : "") +
          '><td><span class="info-lv">' +
          lvl +
          "</span></td><td>" +
          fmt(step) +
          "</td><td>" +
          fmt(totalSum) +
          "</td></tr>"
        );
      })
      .join("") +
    "</tbody></table>"
  );
}

/* прогресс игрока из калькулятора (app.js хранит его в localStorage gameHelperState):
   level - уровень персонажа, talents - сколько очков талантов вложено (= сколько уровней талантов получено) */
const CALC_STATE_KEY = "gameHelperState";
function readCalcProgress() {
  try {
    const d = JSON.parse(localStorage.getItem(CALC_STATE_KEY) || "null");
    if (!d) return null;
    const level = Math.max(0, Math.min(CHAR_LEVELS.length, Math.floor(Number(d.level) || 0)));
    const talents =
      d.talents && typeof d.talents === "object"
        ? Object.values(d.talents).reduce((a, v) => a + Math.max(0, Math.min(5, Number(v) || 0)), 0)
        : 0;
    return { level: level, talents: Math.min(TALENT_LEVELS.length, talents) };
  } catch {
    return null;
  }
}
/* строка «получено / осталось» над таблицей */
function infoProgressMarkup(rows, reached, unit, doneLabel) {
  if (!reached) return "";
  const last = rows[rows.length - 1],
    cur = rows[reached - 1],
    left = last[2] - cur[2],
    pct = Math.min(100, (cur[2] / last[2]) * 100);
  const pctTxt = pct > 0 && pct < 1 ? "<1" : String(Math.floor(pct));
  return (
    '<div class="info-progress-line">' +
    '<div class="ipl-row"><span class="info-progress-done">' +
    doneLabel +
    "</span>" +
    (left > 0
      ? '<button type="button" class="info-jump" data-info-jump>К текущему уровню</button>'
      : '<span class="info-progress-max">максимум</span>') +
    "</div>" +
    '<div class="info-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
    Math.floor(pct) +
    '"><i style="width:' +
    pct.toFixed(2) +
    '%"></i></div>' +
    '<div class="ipl-row ipl-sub"><span>Пройдено <b>' +
    pctTxt +
    "%</b> " +
    unit +
    "</span>" +
    (left > 0 ? "<span>до " + last[0] + " ур.: <b>" + fmt(left) + "</b></span>" : "") +
    "</div>" +
    "</div>"
  );
}
function infoProgressNoteMarkup(p) {
  if (!p || (!p.level && !p.talents))
    return '<span class="info-progress-hint"><i aria-hidden="true"></i><span>Укажите уровень персонажа и вложите таланты в <a href="/calculator">калькуляторе</a> - полученные уровни отметятся в таблицах</span></span>';
  return '<span class="info-progress-hint is-set"><i aria-hidden="true"></i><span>Полученные уровни отмечены по данным <a href="/calculator">калькулятора</a></span></span>';
}

function infoGroupMarkup(title, ledColor, body, notes, modClass) {
  return (
    '<div class="info-group' +
    (modClass ? " info-group-" + modClass : "") +
    '"' +
    (modClass ? ' data-info-group="' + modClass + '"' : "") +
    '><div class="info-group-title"><i class="info-led" style="--led:' +
    ledColor +
    '"></i><b>' +
    title +
    "</b></div>" +
    body +
    (notes && notes.length
      ? '<ul class="info-notes">' +
        notes.map(n => '<li style="color:' + infoNoteColor(n) + '">' + n + "</li>").join("") +
        "</ul>"
      : "") +
    "</div>"
  );
}

/* вкладки для мобильной версии (#infoTabs, styles.css), на десктопе скрыты. Классы те же, что у вкладок «Топ-100» */
const INFO_TAB_KEY = "gameHelperInfoTab";
const INFO_TABS = [
  { key: "talents", label: "Таланты", accent: "#ffb74d" },
  { key: "pda", label: "ПДА", accent: "#9fdc9f" },
  { key: "char", label: "Персонаж", accent: "#54bfff" }
];
let currentInfoTab = "talents";
try {
  const saved = localStorage.getItem(INFO_TAB_KEY);
  if (INFO_TABS.some(t => t.key === saved)) currentInfoTab = saved;
} catch {}

function renderInfoTabs() {
  $("infoTabs").innerHTML = INFO_TABS.map(
    t =>
      '<button type="button" class="top100-tab' +
      (t.key === currentInfoTab ? " active" : "") +
      '" data-info-tab="' +
      t.key +
      '" style="--accent:' +
      t.accent +
      '">' +
      t.label +
      "</button>"
  ).join("");
}
function applyInfoActiveTab() {
  $("infoGroups").dataset.active = currentInfoTab;
}

/* вид блока: «chart» - график + расчёт «с уровня - до уровня» (по умолчанию), «table» - прежние полные таблицы */
const INFO_VIEW_KEY = "gameHelperInfoView";
let currentInfoView = "chart";
try {
  if (localStorage.getItem(INFO_VIEW_KEY) === "table") currentInfoView = "table";
} catch {}

/* описание трёх блоков: данные, подписи и сколько уровней уже получено по калькулятору */
function infoGroupsData(p) {
  return [
    {
      key: "talents",
      title: "Таланты",
      color: "#ffb74d",
      rows: TALENT_LEVELS,
      reached: p.talents,
      step: "Урон",
      need: "Нужно нанести урона",
      gen: "урона"
    },
    {
      key: "pda",
      title: "Опыт ПДА",
      color: "#9fdc9f",
      rows: PDA_LEVELS,
      /* уровня ПДА нет в калькуляторе - берём тот, что посетитель ввёл в «С уровня» на этой вкладке */
      reached: readPdaFrom(PDA_LEVELS.length),
      step: "Опыт",
      need: "Нужно опыта",
      gen: "опыта",
      notes: PDA_LEVEL_NOTES
    },
    {
      key: "char",
      title: "Опыт персонажа",
      color: "#54bfff",
      rows: CHAR_LEVELS,
      reached: p.level,
      step: "Опыт",
      need: "Нужно опыта",
      gen: "опыта"
    }
  ];
}

/* короткая запись для осей: 1,5М, 250к */
function fmtShort(v) {
  if (v >= 1e6) return (Math.round(v / 1e5) / 10).toLocaleString("ru-RU") + "М";
  if (v >= 1e3) return Math.round(v / 1e3).toLocaleString("ru-RU") + "к";
  return String(v);
}
/* «красивый» шаг сетки: 1, 2, 2,5 или 5 × 10^n, примерно 4-5 линий */
function niceStep(max) {
  const raw = max / 4.5,
    p = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw);
}
/* уровень, который показывает подсказка графика сразу: следующий после полученного, иначе 10-й */
function chartDefaultLevel(g) {
  const n = g.rows.length;
  return g.reached ? Math.min(n, g.reached + 1) : Math.min(n, 10);
}
/* координаты точки уровня в процентах от области графика */
function chartPos(g, lvl) {
  const n = g.rows.length,
    max = g.rows[n - 1][2];
  return { x: ((lvl - 1) / (n - 1)) * 100, y: 100 - (g.rows[lvl - 1][2] / max) * 100 };
}
function chartTipMarkup(g, lvl) {
  const r = g.rows[lvl - 1],
    from = g.reached ? g.rows[g.reached - 1][2] : 0;
  return (
    "<b>" +
    lvl +
    " уровень</b><span>" +
    g.step +
    ": <em>" +
    fmt(r[1]) +
    "</em></span><span>Всего: <em>" +
    fmt(r[2]) +
    "</em></span>" +
    (g.reached && lvl > g.reached ? '<span>От вас: <em class="ich-plus">+' + fmt(r[2] - from) + "</em></span>" : "")
  );
}
/* график «всего с начала»: линии в SVG растягиваются по ширине, подписи и точки - HTML поверх, поэтому текст не искажается */
function chartMarkup(g) {
  const rows = g.rows,
    n = rows.length,
    max = rows[n - 1][2],
    st = niceStep(max);
  const pt = r => ((r[0] - 1) / (n - 1)) * 1000 + "," + (1000 - (r[2] / max) * 1000);
  let grid = "",
    ylab = "",
    xlab = "";
  for (let v = 0; v <= max; v += st) {
    const y = 100 - (v / max) * 100;
    grid += '<line x1="0" x2="1000" y1="' + y * 10 + '" y2="' + y * 10 + '"/>';
    ylab += '<span style="top:' + y + '%">' + fmtShort(v) + "</span>";
  }
  const xs = n > 60 ? 20 : 10;
  for (let l = xs; l <= n; l += xs) xlab += '<span style="left:' + ((l - 1) / (n - 1)) * 100 + '%">' + l + "</span>";
  const done = g.reached ? rows.slice(0, g.reached) : [];
  const me = g.reached ? chartPos(g, g.reached) : null;
  const sel = chartDefaultLevel(g),
    sp = chartPos(g, sel);
  return (
    '<div class="ich" data-ich="' +
    g.key +
    '"><div class="ich-plot"><div class="ich-y">' +
    ylab +
    '</div><div class="ich-area"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><g class="ich-grid">' +
    grid +
    "</g>" +
    (done.length > 1
      ? '<polygon class="ich-fill" points="0,1000 ' +
        done.map(pt).join(" ") +
        " " +
        pt(done[done.length - 1]).split(",")[0] +
        ',1000"/>'
      : "") +
    '<polyline class="ich-line" points="' +
    rows.map(pt).join(" ") +
    '"/>' +
    (done.length > 1 ? '<polyline class="ich-done" points="' + done.map(pt).join(" ") + '"/>' : "") +
    "</svg>" +
    (me
      ? '<i class="ich-me" style="left:' +
        me.x +
        "%;top:" +
        me.y +
        /* точка у нижнего края (начало кривой) - подпись наверху графика, иначе внизу; пунктир от точки к подписи */
        (me.y > 75
          ? '%"></i><i class="ich-me-line" style="left:' + me.x + "%;top:0;bottom:" + (100 - me.y) + "%"
          : '%"></i><i class="ich-me-line" style="left:' + me.x + "%;top:" + me.y + "%") +
        '"></i><span class="ich-me-lbl' +
        (me.y > 75 ? " ich-me-lbl-top" : "") +
        (me.x > 92 ? " ich-me-lbl-left" : me.x < 6 ? " ich-me-lbl-right" : "") +
        '" style="left:' +
        me.x +
        '%">вы: ' +
        g.reached +
        " ур.</span>"
      : "") +
    '<i class="ich-cursor" style="left:' +
    sp.x +
    '%"></i><i class="ich-dot" style="left:' +
    sp.x +
    "%;top:" +
    sp.y +
    '%"></i><div class="ich-tip' +
    (sp.x > 60 ? " ich-tip-left" : "") +
    (sp.y < 35 ? " ich-tip-low" : "") +
    '" style="left:' +
    sp.x +
    "%;top:" +
    sp.y +
    '%">' +
    chartTipMarkup(g, sel) +
    '</div></div><div class="ich-x">' +
    xlab +
    '</div></div><input type="range" class="ich-range" min="1" max="' +
    n +
    '" value="' +
    sel +
    '" aria-label="Уровень на графике"></div>'
  );
}
/* карточки с ключевыми цифрами под графиком */
function chartCardsMarkup(g) {
  const rows = g.rows,
    n = rows.length,
    last = rows[n - 1][2],
    r = g.reached;
  const card = (label, val) => '<div class="ich-card"><span>' + label + "</span><b>" + val + "</b></div>";
  if (!r)
    return (
      '<div class="ich-cards">' +
      card("Уровней", n) +
      card("Всего " + g.gen + " до " + n + " ур.", fmt(last)) +
      "</div>"
    );
  const cur = rows[r - 1][2],
    goal = Math.min(n, (Math.floor(r / 10) + 1) * 10);
  return (
    '<div class="ich-cards">' +
    card(g.key === "talents" ? "Получено" : "Ваш уровень", g.key === "talents" ? r + " / " + n : r) +
    card("Следующий уровень", r < n ? fmt(rows[r][1]) : "максимум") +
    (goal < n && goal > r ? card("До " + goal + " ур.", fmt(rows[goal - 1][2] - cur)) : "") +
    card("До максимума", r < n ? fmt(last - cur) : "-") +
    "</div>"
  );
}
/* расчёт «с уровня - до уровня»: сколько нужно, чтобы с уровня a (уже есть) подняться до уровня b.
   Строка уровня хранит, сколько нужно, чтобы его получить, поэтому сам уровень a в сумму не входит */
function planSum(g, a, b) {
  return g.rows[b - 1][2] - g.rows[a - 1][2];
}
/* уровня ПДА нет в калькуляторе, поэтому «С уровня» на вкладке ПДА запоминается на этом устройстве */
const PDA_FROM_KEY = "gameHelperInfoPdaFrom";
function readPdaFrom(n) {
  try {
    const v = Math.round(Number(localStorage.getItem(PDA_FROM_KEY)));
    return v >= 1 && v <= n ? v : 0;
  } catch {
    return 0;
  }
}
function planMarkup(g) {
  const n = g.rows.length,
    a = g.reached || 1,
    b = n;
  return (
    '<div class="ich-plan" data-plan="' +
    g.key +
    '"><label>С уровня<input type="number" inputmode="numeric" min="1" max="' +
    n +
    '" value="' +
    a +
    '" data-plan-from></label><label>До уровня<input type="number" inputmode="numeric" min="1" max="' +
    n +
    '" value="' +
    b +
    '" data-plan-to></label><div class="ich-plan-res"><span>' +
    g.need +
    "</span><b data-plan-res>" +
    fmt(planSum(g, Math.min(a, b), Math.max(a, b))) +
    "</b></div></div>"
  );
}
function renderInfo() {
  const p = readCalcProgress() || { level: 0, talents: 0 };
  const groups = infoGroupsData(p);
  if (currentInfoView === "table") {
    const talentChunks = chunkRows(TALENT_LEVELS, 3)
      .map(rows => infoTableMarkup(rows, ["Уровень", "Урон", "Всего"], p.talents))
      .join("");
    $("infoGroups").innerHTML =
      infoGroupMarkup(
        "Таланты",
        "#ffb74d",
        infoProgressMarkup(
          TALENT_LEVELS,
          p.talents,
          "урона",
          "Получено: <b>" + p.talents + "</b> из " + TALENT_LEVELS.length
        ) +
          '<div class="info-subcols">' +
          talentChunks +
          "</div>",
        null,
        "talents"
      ) +
      infoGroupMarkup(
        "Опыт ПДА",
        "#9fdc9f",
        infoTableMarkup(PDA_LEVELS, ["Уровень", "Опыт", "Всего"]),
        PDA_LEVEL_NOTES,
        "pda"
      ) +
      infoGroupMarkup(
        "Опыт персонажа",
        "#54bfff",
        infoProgressMarkup(CHAR_LEVELS, p.level, "опыта", "Ваш уровень: <b>" + p.level + "</b>") +
          infoTableMarkup(CHAR_LEVELS, ["Уровень", "Опыт", "Всего"], p.level),
        null,
        "char"
      );
  } else {
    $("infoGroups").innerHTML = groups
      .map(g => infoGroupMarkup(g.title, g.color, chartMarkup(g) + chartCardsMarkup(g) + planMarkup(g), g.notes, g.key))
      .join("");
  }
  $("infoGroups").dataset.view = currentInfoView;
  $("infoTabs").dataset.view = currentInfoView;
  const note = $("infoProgress");
  if (note) note.innerHTML = infoProgressNoteMarkup(p);
  renderInfoTabs();
  applyInfoActiveTab();
  applyInfoViewButtons();
}
/* переключатель вида «График / Таблицы» (кнопки в info.html) */
function applyInfoViewButtons() {
  document.querySelectorAll("[data-info-view]").forEach(b => {
    const on = b.dataset.infoView === currentInfoView;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on);
  });
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-info-view]");
  if (!b || b.dataset.infoView === currentInfoView) return;
  const swap = () => {
    currentInfoView = b.dataset.infoView;
    try {
      localStorage.setItem(INFO_VIEW_KEY, currentInfoView);
    } catch {}
    renderInfo();
  };
  window.__vt ? window.__vt(swap) : swap();
});

/* график: наведение, касание и ползунок двигают подсказку по уровням */
function infoGroupByKey(key) {
  return infoGroupsData(readCalcProgress() || { level: 0, talents: 0 }).find(g => g.key === key);
}
function chartSelect(box, lvl) {
  const g = infoGroupByKey(box.dataset.ich);
  if (!g) return;
  lvl = Math.max(1, Math.min(g.rows.length, lvl));
  const p = chartPos(g, lvl),
    tip = box.querySelector(".ich-tip");
  box.querySelector(".ich-cursor").style.left = p.x + "%";
  const dot = box.querySelector(".ich-dot");
  dot.style.left = p.x + "%";
  dot.style.top = p.y + "%";
  tip.style.left = p.x + "%";
  tip.style.top = p.y + "%";
  tip.classList.toggle("ich-tip-left", p.x > 60);
  tip.classList.toggle("ich-tip-low", p.y < 35);
  tip.innerHTML = chartTipMarkup(g, lvl);
  const range = box.querySelector(".ich-range");
  if (+range.value !== lvl) range.value = lvl;
}
/* линия на графике не ездит за курсором: её ставят нажатием и перетаскивают с зажатой кнопкой (или пальцем) */
let chartDrag = null;
function chartLevelAt(area, x) {
  const rect = area.getBoundingClientRect(),
    n = +area.closest(".ich").querySelector(".ich-range").max;
  return Math.round(1 + ((x - rect.left) / rect.width) * (n - 1));
}
document.addEventListener("pointerdown", e => {
  const area = e.target.closest && e.target.closest(".ich-area");
  if (!area || e.button > 0) return;
  chartDrag = area;
  if (area.setPointerCapture) area.setPointerCapture(e.pointerId);
  chartSelect(area.closest(".ich"), chartLevelAt(area, e.clientX));
});
document.addEventListener("pointermove", e => {
  if (chartDrag) chartSelect(chartDrag.closest(".ich"), chartLevelAt(chartDrag, e.clientX));
});
["pointerup", "pointercancel"].forEach(t =>
  document.addEventListener(t, () => {
    chartDrag = null;
  })
);
document.addEventListener("input", e => {
  if (e.target.classList.contains("ich-range")) {
    chartSelect(e.target.closest(".ich"), +e.target.value);
    return;
  }
  const plan = e.target.closest && e.target.closest("[data-plan]");
  if (!plan) return;
  const g = infoGroupByKey(plan.dataset.plan),
    n = g.rows.length;
  const val = s => Math.max(1, Math.min(n, Math.round(Number(plan.querySelector(s).value) || 1)));
  const a = val("[data-plan-from]"),
    b = val("[data-plan-to]");
  if (g.key === "pda" && e.target.matches("[data-plan-from]") && e.target.value !== "") {
    try {
      localStorage.setItem(PDA_FROM_KEY, a);
    } catch {}
    /* график и карточки ПДА сразу перерисовываются под введённый уровень; поля ввода не трогаем, чтобы не сбить набор */
    const box = plan.closest(".info-group"),
      pg = infoGroupByKey("pda");
    box.querySelector(".ich").outerHTML = chartMarkup(pg);
    box.querySelector(".ich-cards").outerHTML = chartCardsMarkup(pg);
  }
  plan.querySelector("[data-plan-res]").textContent = fmt(planSum(g, Math.min(a, b), Math.max(a, b)));
});

/* калькулятор открыт в соседней вкладке - таблицы обновляются сразу; при возврате на вкладку тоже */
window.addEventListener &&
  window.addEventListener("storage", e => {
    if (e.key === CALC_STATE_KEY) renderInfo();
  });
window.addEventListener &&
  window.addEventListener("pageshow", e => {
    if (e.persisted) renderInfo();
  });

/* «К текущему уровню»: прокрутка таблицы группы к строке игрока */
document.addEventListener("click", e => {
  const j = e.target.closest("[data-info-jump]");
  if (!j) return;
  const row = j.closest(".info-group") && j.closest(".info-group").querySelector("tr.info-current");
  if (row)
    row.scrollIntoView({
      block: "center",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
});
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-info-tab]");
  if (!btn) return;
  /* смена вкладки проходит через View Transition, если браузер умеет */
  const swap = () => {
    currentInfoTab = btn.dataset.infoTab;
    try {
      localStorage.setItem(INFO_TAB_KEY, currentInfoTab);
    } catch {}
    renderInfoTabs();
    applyInfoActiveTab();
  };
  window.__vt ? window.__vt(swap) : swap();
});

renderInfo();
