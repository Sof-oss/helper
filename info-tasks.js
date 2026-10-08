/* вкладка «Задания» на странице «Информация».
   Калькулятор энергии и три таблицы: награда за прохождение локации, итог (все этапы + награда) и выгода.
   Строки - ресурсы с иконками, столбцы - локации: все локации видно сразу.
   Всё в функции, чтобы не пересекаться с $ и fmt из info.js */
(function () {
  "use strict";
  const D = window.TASKS_DATA,
    L = D.locations.map(l => l.replace(/"([^"]*)"/g, "«$1»"));
  const SEC_KEY = "gameHelperInfoSection";
  /* короткие подписи показываются на телефоне, длинные - на компьютере */
  const R = {
    exp: { full: "Опыт", short: "Опыт", cls: "exp" },
    bullets: { full: "Пули", short: "Пули", cls: "bul" },
    rep: { full: "Репутация", short: "Репутация", cls: "rep" },
    energy: { full: "Затраты энергии", short: "Энергия", cls: "en" },
    tokens: { full: "Жетоны", short: "Жетоны", cls: "tok" }
  };
  /* иконки: три игровые картинки, для опыта - нарисованный значок «XP» */
  const ICON = {
    exp: '<svg class="res-xp" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.2" y="5.2" width="19.6" height="13.6" rx="3.2"/><text x="12" y="16.1" text-anchor="middle">XP</text></svg>',
    bullets:
      '<img src="assets/common_currency-BGqetmZE.webp" alt="" width="83" height="96" loading="lazy" decoding="async">',
    rep: '<img src="assets/reputation-DqOMMtrl.webp" alt="" width="96" height="92" loading="lazy" decoding="async">',
    energy: '<img src="assets/energy-5drpfC6V.webp" alt="" width="52" height="96" loading="lazy" decoding="async">',
    tokens:
      '<img src="assets/rare_currency-D0tYVDkc.webp" alt="" width="81" height="96" loading="lazy" decoding="async">'
  };
  const n0 = v => v.toLocaleString("ru-RU"),
    n2 = v => v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const gain = k => L.map((_, i) => D.total[k][i] / D.total.energy[i]);
  const round2 = v => Math.round(v * 100) / 100;
  const card = (led, title, body) =>
    '<div class="info-group"><div class="info-group-title"><i class="info-led" style="--led:' +
    led +
    '"></i><b>' +
    title +
    "</b></div>" +
    body +
    "</div>";

  /* итог за все этапы плюс награда за полное прохождение: столько ресурсов даёт локация целиком */
  const combined = {};
  ["exp", "bullets", "rep"].forEach(k => {
    combined[k] = L.map((_, i) => D.total[k][i] + D.reward[k][i]);
  });
  combined.tokens = D.reward.tokens.slice();
  combined.energy = D.total.energy.slice();
  const gainRows = { exp: gain("exp"), bullets: gain("bullets"), rep: gain("rep") };

  const shortLoc = l => l.split(/[ «]/)[0];
  function locHead() {
    return L.map(
      l => '<th><span class="loc-full">' + l + '</span><span class="loc-short">' + shortLoc(l) + "</span></th>"
    ).join("");
  }
  function row(k, vals, fmt, highlight) {
    const r = highlight ? vals.map(round2) : vals,
      best = highlight ? Math.max.apply(null, r) : null;
    return (
      '<tr class="res-' +
      R[k].cls +
      '"><th scope="row"><i class="res-ico">' +
      ICON[k] +
      "</i>" +
      '<span class="lbl-full">' +
      R[k].full +
      '</span><span class="lbl-short">' +
      R[k].short +
      "</span></th>" +
      vals
        .map((v, j) => "<td" + (highlight && r[j] === best ? ' class="best"' : "") + ">" + fmt(v) + "</td>")
        .join("") +
      "</tr>"
    );
  }
  /* ПК: ресурсы строками, локации столбцами - все локации видно сразу */
  function locTable(keys, items, fmt, highlight) {
    return (
      '<div class="data-wrap"><table class="data-table tasks-v2"><thead><tr><th class="th-corner">Ресурс</th>' +
      locHead() +
      "</tr></thead><tbody>" +
      keys.map(k => row(k, items[k] || [], fmt, highlight)).join("") +
      "</tbody></table></div>"
    );
  }
  /* телефон: то же самое, но локации строками, а ресурсы - столбцами с иконками:
   пять колонок с числами в экран не влезают, а так всё видно без прокрутки вбок */
  function locTableNarrow(keys, items, fmt, highlight) {
    const head = keys
      .map(
        k =>
          '<th class="res-' +
          R[k].cls +
          '" title="' +
          R[k].full +
          '"><i class="res-ico">' +
          ICON[k] +
          '</i><span class="t-only">' +
          R[k].full +
          "</span></th>"
      )
      .join("");
    /* лучшее значение считаем по каждому ресурсу среди локаций - как и в широкой таблице */
    const bests = {};
    if (highlight)
      keys.forEach(k => {
        bests[k] = Math.max.apply(
          null,
          L.map((_, j) => round2((items[k] || [])[j]))
        );
      });
    const body = L.map((l, i) => {
      const cells = keys
        .map(k => {
          const v = (items[k] || [])[i];
          return "<td" + (highlight && round2(v) === bests[k] ? ' class="best"' : "") + ">" + fmt(v) + "</td>";
        })
        .join("");
      return '<tr><th scope="row">' + l + "</th>" + cells + "</tr>";
    }).join("");
    return (
      '<div class="data-wrap"><table class="data-table tasks-v2 tasks-v2-n"><thead><tr><th class="th-corner">Локация</th>' +
      head +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table></div>"
    );
  }

  function block(led, title, keys, items, fmt, highlight, note) {
    return card(
      led,
      title,
      '<div class="tasks-wide">' +
        locTable(keys, items, fmt, highlight) +
        "</div>" +
        '<div class="tasks-narrow">' +
        locTableNarrow(keys, items, fmt, highlight) +
        "</div>" +
        (note ? '<p class="tasks-note">' + note + "</p>" : "")
    );
  }

  /* ---------- калькулятор энергии ----------
   Сколько ресурсов даст N энергии на выбранной локации и сколько жетонов уйдёт на энергетики.
   Полное прохождение локации стоит total.energy и даёт итог всех этапов + награду (combined).
   Остаток энергии, которого не хватает на ещё одно прохождение, пересчитывается по выгоде этапов
   (без награды за прохождение) - поэтому такие цифры помечены «≈» */
  const DRINK_ENERGY = 100,
    DRINK_PRICE = 15;
  /* картинка энергетика «Сердце Зоны» (банка 100 энергии) */
  const DRINK_IMG =
    '<img src="assets/energy-drink.webp" alt="Энергетик" width="103" height="180" loading="lazy" decoding="async">';
  const CALC_KEY = "gameHelperEnergyCalc";
  const calcState = { loc: 0, energy: 1000, own: 0 };
  try {
    const c = JSON.parse(localStorage.getItem(CALC_KEY) || "null");
    if (c) {
      if (Number.isInteger(c.loc) && c.loc >= 0 && c.loc < L.length) calcState.loc = c.loc;
      ["energy", "own"].forEach(k => {
        if (Number.isFinite(c[k]) && c[k] >= 0) calcState[k] = Math.floor(c[k]);
      });
    }
  } catch {}
  const saveCalc = () => {
    try {
      localStorage.setItem(CALC_KEY, JSON.stringify(calcState));
    } catch {}
  };

  /* результат для локации i и энергии e */
  function energyYield(i, e) {
    const cost = combined.energy[i],
      runs = Math.floor(e / cost),
      rest = e - runs * cost,
      out = { runs: runs, rest: rest };
    ["exp", "bullets", "rep"].forEach(k => {
      out[k] = runs * combined[k][i] + (rest * D.total[k][i]) / cost;
    });
    out.tokens = runs * combined.tokens[i];
    return out;
  }
  const approx = (v, partial) => (partial && v % 1 ? "≈ " : "") + n0(Math.round(v));

  function calcResultMarkup() {
    const i = calcState.loc,
      e = calcState.energy,
      y = energyYield(i, e),
      partial = y.rest > 0;
    const buy = Math.max(0, e - calcState.own),
      drinks = Math.ceil(buy / DRINK_ENERGY),
      spent = drinks * DRINK_PRICE,
      net = y.tokens - spent;
    const res = (k, v) =>
      '<div class="ec-res res-' +
      R[k].cls +
      '"><i class="res-ico">' +
      ICON[k] +
      "</i><span><b>" +
      v +
      "</b><small>" +
      R[k].full +
      "</small></span></div>";
    const runsTxt = y.runs
      ? "Полных прохождений: <b>" +
        n0(y.runs) +
        "</b>" +
        (partial ? ", ещё " + n0(y.rest) + " энергии уйдёт на этапы следующего" : "")
      : e
        ? "На полное прохождение нужно " + n0(combined.energy[i]) + " энергии - посчитано по выгоде этапов, без награды"
        : "Укажите, сколько энергии потратить";
    return (
      '<div class="ec-results">' +
      res("exp", approx(y.exp, partial)) +
      res("bullets", approx(y.bullets, partial)) +
      res("rep", approx(y.rep, partial)) +
      res("tokens", n0(y.tokens)) +
      '</div><p class="ec-runs">' +
      runsTxt +
      "</p>" +
      '<div class="ec-buy"><i class="ec-drink">' +
      DRINK_IMG +
      (drinks ? '<b class="ec-drink-n">×' + n0(drinks) + "</b>" : "") +
      '</i><div class="ec-buy-text">' +
      (buy
        ? "<span>Купить энергии: <b>" +
          n0(buy) +
          "</b> → энергетиков: <b>" +
          n0(drinks) +
          "</b></span>" +
          '<span class="ec-cost">Стоимость: <b>' +
          n0(spent) +
          '</b> <i class="res-ico res-tok">' +
          ICON.tokens +
          "</i>жетонов</span>" +
          (y.tokens
            ? '<span class="ec-net">' +
              (net >= 0 ? "Итог: в плюсе на" : "Итог: потратите") +
              ' <b class="' +
              (net >= 0 ? "up" : "down") +
              '">' +
              n0(Math.abs(net)) +
              "</b> жетонов<small>стоимость энергетиков минус жетоны, полученные за прохождения</small></span>"
            : "") +
          (drinks * DRINK_ENERGY > buy
            ? '<span class="ec-left">Останется ' + n0(drinks * DRINK_ENERGY - buy) + " энергии</span>"
            : "")
        : "<span>Энергии хватает - покупать энергетики не нужно</span>") +
      "</div></div>"
    );
  }
  /* картинки вкладок локаций калькулятора: assets/loc-<ключ>.webp, по порядку TASKS_DATA.locations */
  const LOC_IMG = ["outskirts", "swamps", "dump", "north", "bar"];
  /* число с пробелами между разрядами - для полей ввода (ui.js форматирует их и при наборе) */
  const grp = n => String(Math.max(0, Math.floor(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  function calcMarkup() {
    const locs = L.map(
      (l, i) =>
        '<button type="button" class="top100-tab ec-loc' +
        (i === calcState.loc ? " active" : "") +
        '" data-ec-loc="' +
        i +
        '" aria-pressed="' +
        (i === calcState.loc) +
        '"' +
        (LOC_IMG[i] ? ' style="--loc-img:url(assets/loc-' + LOC_IMG[i] + '.webp)"' : "") +
        "><span>" +
        l +
        "</span></button>"
    ).join("");
    const presets = [100, 500, 1000, 5000]
      .map(v => '<button type="button" class="ec-preset" data-ec-preset="' + v + '">' + n0(v) + "</button>")
      .join("");
    return card(
      "#ff6b6f",
      "Калькулятор энергии",
      '<div class="ec-locs" role="group" aria-label="Локация">' +
        locs +
        "</div>" +
        '<div class="ec-inputs">' +
        '<label class="ec-field"><span><i class="res-ico res-en">' +
        ICON.energy +
        '</i>Сколько энергии потратить</span><input type="text" inputmode="numeric" autocomplete="off" maxlength="10" data-group-digits id="ecEnergy" value="' +
        grp(calcState.energy) +
        '"><span class="ec-presets">' +
        presets +
        "</span></label>" +
        '<label class="ec-field"><span><i class="res-ico res-en">' +
        ICON.energy +
        '</i>Запас энергии</span><input type="text" inputmode="numeric" autocomplete="off" maxlength="10" data-group-digits id="ecOwn" value="' +
        grp(calcState.own) +
        '"><small>Уже есть - покупать не нужно</small></label>' +
        '</div><div id="ecResult">' +
        calcResultMarkup() +
        "</div>" +
        '<p class="tasks-note">Энергетик даёт ' +
        DRINK_ENERGY +
        " энергии и стоит " +
        DRINK_PRICE +
        " жетонов. Ресурсы за неполное прохождение - оценка по средней выгоде этапов.</p>"
    );
  }
  function updateCalc() {
    const el = document.getElementById("ecResult");
    if (el) el.innerHTML = calcResultMarkup();
  }
  const num = v => {
    const n = Math.floor(Number(String(v).replace(/\D/g, "")));
    return Number.isFinite(n) && n >= 0 ? Math.min(n, 10000000) : 0;
  };
  document.addEventListener("input", e => {
    if (e.target.id === "ecEnergy") calcState.energy = num(e.target.value);
    else if (e.target.id === "ecOwn") calcState.own = num(e.target.value);
    else return;
    saveCalc();
    updateCalc();
  });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-ec-loc]");
    if (b) {
      calcState.loc = Number(b.dataset.ecLoc);
      saveCalc();
      document.querySelectorAll("[data-ec-loc]").forEach(x => {
        const on = x === b;
        x.classList.toggle("active", on);
        x.setAttribute("aria-pressed", on);
      });
      updateCalc();
      return;
    }
    const p = e.target.closest("[data-ec-preset]");
    if (p) {
      calcState.energy = Number(p.dataset.ecPreset);
      const inp = document.getElementById("ecEnergy");
      if (inp) inp.value = grp(calcState.energy);
      saveCalc();
      updateCalc();
    }
  });

  function tasksBody() {
    return (
      calcMarkup() +
      block("#ffb74d", "Награда за полное прохождение локации", ["exp", "bullets", "rep", "tokens"], D.reward, n0) +
      block(
        "#54bfff",
        "Итого за все этапы + награда за прохождение",
        ["exp", "bullets", "rep", "tokens", "energy"],
        combined,
        n0,
        null,
        "Затраты энергии - сколько уйдёт на все этапы локации; остальные строки - что получишь за них и за полное прохождение."
      ) +
      block(
        "#27db88",
        "Выгода: ресурс на единицу затраченной энергии",
        ["exp", "bullets", "rep"],
        gainRows,
        n2,
        true,
        "Зелёным отмечено самое выгодное значение в строке."
      )
    );
  }

  const root = document.getElementById("tasksRoot");
  function renderTasks() {
    root.innerHTML = tasksBody();
  }

  /* переключатель разделов «Прогресс по уровням» / «Задания» / «Боссы» */
  function setSection(k) {
    document.querySelectorAll("[data-section]").forEach(b => {
      const on = b.dataset.section === k;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
    document.querySelectorAll("[data-section-panel]").forEach(p => {
      p.hidden = p.dataset.sectionPanel !== k;
    });
  }
  document.addEventListener("click", e => {
    const s = e.target.closest("[data-section]");
    if (!s) return;
    /* смена раздела проходит через View Transition, если браузер умеет */
    const swap = () => {
      setSection(s.dataset.section);
      try {
        localStorage.setItem(SEC_KEY, s.dataset.section);
      } catch {}
    };
    window.__vt ? window.__vt(swap) : swap();
  });
  renderTasks();
  let sec = "levels";
  try {
    const s = localStorage.getItem(SEC_KEY);
    if (s === "levels" || s === "tasks" || s === "bosses") sec = s;
  } catch {}
  setSection(sec);
})();
