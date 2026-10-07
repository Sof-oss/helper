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
/* reached — уровень игрока из калькулятора: строки до него включительно уже получены, сама строка reached — текущая */
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
   level — уровень персонажа, talents — сколько очков талантов вложено (= сколько уровней талантов получено) */
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
    return '<span class="info-progress-hint"><i aria-hidden="true"></i><span>Укажите уровень персонажа и вложите таланты в <a href="/calculator">калькуляторе</a> — полученные уровни отметятся в таблицах</span></span>';
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

function renderInfo() {
  const p = readCalcProgress() || { level: 0, talents: 0 };
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
  const note = $("infoProgress");
  if (note) note.innerHTML = infoProgressNoteMarkup(p);
  renderInfoTabs();
  applyInfoActiveTab();
}
/* калькулятор открыт в соседней вкладке — таблицы обновляются сразу; при возврате на вкладку тоже */
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
