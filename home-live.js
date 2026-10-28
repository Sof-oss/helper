/* Главная: «живые» строки на плашках разделов. */
(function () {
  "use strict";
  const top = document.getElementById("hcTop");
  if (top && top.dataset.day) {
    const d = new Date(top.dataset.day + "T00:00:00"),
      now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.round((now - d) / 864e5);
    /* data-short - короткий вариант для телефона (home.css) */
    if (diff === 0) {
      top.textContent = "Обновлён сегодня в " + top.dataset.time;
      top.dataset.short = "Сегодня в " + top.dataset.time;
    } else if (diff === 1) {
      top.textContent = "Обновлён вчера в " + top.dataset.time;
      top.dataset.short = "Вчера в " + top.dataset.time;
    }
  }
  const calc = document.getElementById("hcCalc");
  if (!calc) return;
  try {
    const s = JSON.parse(localStorage.getItem("gameHelperState") || "null");
    if (!s) return;
    /* новый формат - gear; items/sets - старые сохранения */
    const gear = Array.isArray(s.gear) ? s.gear.length : 0;
    const items = Array.isArray(s.items) ? s.items.length : 0;
    const sets = Array.isArray(s.sets) ? s.sets.length : 0;
    const talents =
      s.talents && typeof s.talents === "object"
        ? Object.keys(s.talents).filter(k => Number(s.talents[k]) > 0).length
        : 0;
    const arena = Number(s.arena) > 0;
    if (!gear && !items && !sets && !talents && !arena) return;
    const lvl = parseInt(s.level, 10);
    calc.textContent = "Ваш билд сохранён" + (lvl > 0 ? " · ур. " + lvl : "");
    calc.dataset.short = lvl > 0 ? "Билд · ур. " + lvl : "Билд сохранён";
  } catch {}
})();
