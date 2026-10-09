/* Главная: «живые» строки на плашках разделов.
   Цифры справочника, Топ-100 и гайдов подставляет build.js, здесь - то, что знает только браузер:
   «сегодня/вчера» для Топ-100 и сохранённый билд калькулятора (localStorage "gameHelperState", см. app.js) */
(function () {
  "use strict";
  const top = document.getElementById("hcTop");
  if (top && top.dataset.day) {
    const d = new Date(top.dataset.day + "T00:00:00"),
      now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.round((now - d) / 864e5);
    if (diff === 0) top.textContent = "Обновлён сегодня в " + top.dataset.time;
    else if (diff === 1) top.textContent = "Обновлён вчера в " + top.dataset.time;
  }
  const calc = document.getElementById("hcCalc");
  if (!calc) return;
  try {
    const s = JSON.parse(localStorage.getItem("gameHelperState") || "null");
    if (!s) return;
    const items = Array.isArray(s.items) ? s.items.length : 0;
    const sets = Array.isArray(s.sets) ? s.sets.length : 0;
    if (!items && !sets) return;
    const lvl = parseInt(s.level, 10);
    calc.textContent = "Ваш билд сохранён" + (lvl > 0 ? " · ур. " + lvl : "");
  } catch {}
})();
