/* вкладка «Задания» на странице «Информация».
   Калькулятор энергии и карточки локаций (награда за прохождение, итог, выгода);
   по нажатию на карточку раскрывается досье: место среди локаций и этапы с числом повторов.
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

  /* сколько даёт полное прохождение локации: в данных total уже посчитан за все задания всех этапов
     вместе с наградой за прохождение (как в таблице: этап × число повторов + награда) */
  const combined = {
    exp: D.total.exp,
    bullets: D.total.bullets,
    rep: D.total.rep,
    tokens: D.reward.tokens,
    energy: D.total.energy
  };
  const gainRows = { exp: gain("exp"), bullets: gain("bullets"), rep: gain("rep") };
  /* сколько заданий в локации: сумма повторов всех этапов */
  const tasksCount = L.map((_, i) => D.stages.reduce((a, s) => a + s.reps[i], 0));
  const max = a => Math.max.apply(null, a);
  /* место локации среди пяти по ресурсу (больше - лучше); одинаковые значения делят место */
  const rank = (arr, i) => 1 + arr.filter(v => round2(v) > round2(arr[i])).length;
  const isBest = (arr, i) => round2(arr[i]) === round2(max(arr));
  const ico = k => '<i class="res-ico res-' + R[k].cls + '">' + ICON[k] + "</i>";
  const bar = (v, m) => '<span class="tl-bar"><i style="width:' + Math.round((v / m) * 100) + '%"></i></span>';
  const plural = (n, a, b, c) => {
    const m10 = n % 10,
      m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c;
  };

  /* ---------- карточки локаций ----------
   Все пять локаций рядом (на телефоне - лента с прокруткой вбок): награда за прохождение, итог и выгода.
   Нажатие на карточку раскрывает под лентой «досье»: место среди локаций по каждому ресурсу
   и этапы - сколько раз выполнить задание и что оно даёт за раз и за весь этап */
  const OPEN_KEY = "gameHelperTasksLoc";
  let openLoc = null;
  try {
    const v = Number(localStorage.getItem(OPEN_KEY));
    if (localStorage.getItem(OPEN_KEY) !== null && Number.isInteger(v) && v >= 0 && v < L.length) openLoc = v;
  } catch {}

  function locCard(i) {
    const on = openLoc === i;
    const pair = (k, arr) => '<span class="tl-v">' + ico(k) + "<b>" + n0(arr[i]) + "</b></span>";
    const gainRow = k => {
      const best = isBest(gainRows[k], i);
      return (
        '<span class="tl-gr res-' +
        R[k].cls +
        (best ? " best" : "") +
        '">' +
        ico(k) +
        bar(gainRows[k][i], max(gainRows[k])) +
        "<b>" +
        n2(gainRows[k][i]) +
        "</b></span>"
      );
    };
    return (
      '<button type="button" class="tl-card' +
      (on ? " active" : "") +
      '" data-tl-loc="' +
      i +
      '" aria-expanded="' +
      on +
      '" aria-controls="tlDetail">' +
      '<span class="tl-img"' +
      (LOC_IMG[i] ? ' style="--loc-img:url(assets/loc-' + LOC_IMG[i] + '.webp)"' : "") +
      '><span class="tl-en" title="Энергия на все задания локации">' +
      ico("energy") +
      n0(combined.energy[i]) +
      '</span><span class="tl-name"><b>' +
      L[i] +
      "</b><small>" +
      D.stages.length +
      " этапов · " +
      tasksCount[i] +
      " " +
      plural(tasksCount[i], "задание", "задания", "заданий") +
      "</small></span></span>" +
      '<span class="tl-sec"><span class="tl-h">Награда за прохождение</span><span class="tl-grid">' +
      ["exp", "bullets", "rep", "tokens"].map(k => pair(k, D.reward[k])).join("") +
      "</span></span>" +
      '<span class="tl-sec"><span class="tl-h">Итого: задания + награда</span><span class="tl-grid">' +
      ["exp", "bullets", "rep", "tokens"].map(k => pair(k, combined[k])).join("") +
      "</span></span>" +
      '<span class="tl-sec"><span class="tl-h">Выгода на 1 энергии</span><span class="tl-gain">' +
      ["exp", "bullets", "rep"].map(gainRow).join("") +
      "</span></span>" +
      '<span class="tl-more"><span class="tl-more-t">' +
      (on ? "Скрыть этапы" : "Этапы и сравнение") +
      '</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></span>' +
      "</button>"
    );
  }

  function locDetail(i) {
    const row = (k, arr, fmt) => {
      const best = isBest(arr, i);
      return (
        '<div class="tl-r res-' +
        R[k].cls +
        (best ? " best" : "") +
        '">' +
        ico(k) +
        '<span class="tl-lbl">' +
        R[k].full +
        "</span><b>" +
        fmt(arr[i]) +
        "</b><small>" +
        bar(arr[i], max(arr)) +
        (best ? "лучшая" : rank(arr, i) + "-е из " + L.length) +
        "</small></div>"
      );
    };
    const col = (led, title, keys, items, fmt) =>
      '<div class="tl-col"><div class="tl-ch"><i style="--led:' +
      led +
      '"></i>' +
      title +
      "</div>" +
      keys.map(k => row(k, items[k], fmt)).join("") +
      "</div>";
    const stage = s => {
      const r = s.reps[i],
        val = k =>
          '<span class="tl-sv">' + ico(k) + "<b>" + n0(s[k][i]) + "</b><small>→ " + n0(s[k][i] * r) + "</small></span>";
      return (
        '<li class="tl-stage"><span class="tl-sh">Этап ' +
        s.n +
        "<b>×" +
        r +
        '</b></span><span class="tl-boxes" aria-label="' +
        r +
        " " +
        plural(r, "раз", "раза", "раз") +
        '">' +
        "<i></i>".repeat(r) +
        '</span><span class="tl-per">за раз: ' +
        ico("energy") +
        n0(s.energy[i]) +
        "</span>" +
        val("exp") +
        val("bullets") +
        val("rep") +
        '<span class="tl-se">' +
        ico("energy") +
        n0(s.energy[i] * r) +
        " на этап</span></li>"
      );
    };
    const fin =
      '<li class="tl-stage tl-fin"><span class="tl-sh">Награда</span><span class="tl-per">за всю локацию</span>' +
      ["exp", "bullets", "rep", "tokens"]
        .map(k => '<span class="tl-sv">' + ico(k) + "<b>" + n0(D.reward[k][i]) + "</b></span>")
        .join("") +
      "</li>";
    return (
      '<div class="tl-ban"' +
      (LOC_IMG[i] ? ' style="--loc-img:url(assets/loc-' + LOC_IMG[i] + '.webp)"' : "") +
      '><div><h3 class="tl-title">' +
      L[i] +
      '</h3><div class="tl-pills"><span class="tl-pill tl-pill-en">' +
      ico("energy") +
      n0(combined.energy[i]) +
      " энергии на все задания</span>" +
      '<span class="tl-pill">' +
      D.stages.length +
      " этапов · " +
      tasksCount[i] +
      " " +
      plural(tasksCount[i], "задание", "задания", "заданий") +
      "</span>" +
      '<span class="tl-pill">' +
      ico("tokens") +
      D.reward.tokens[i] +
      " " +
      plural(D.reward.tokens[i], "жетон", "жетона", "жетонов") +
      " за прохождение</span></div></div>" +
      '<button type="button" class="tl-close" data-tl-close aria-label="Скрыть этапы"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="tl-cols">' +
      col("#ffb74d", "Награда за прохождение", ["exp", "bullets", "rep", "tokens"], D.reward, n0) +
      col("#54bfff", "Итого: задания + награда", ["exp", "bullets", "rep", "tokens"], combined, n0) +
      col("#27db88", "Выгода на 1 энергии", ["exp", "bullets", "rep"], gainRows, n2) +
      "</div>" +
      '<div class="tl-stages"><div class="tl-ch"><i style="--led:#ffd65a"></i>Этапы: награда за одно задание → за весь этап</div>' +
      '<ol class="tl-stage-list">' +
      D.stages.map(stage).join("") +
      fin +
      "</ol></div>"
    );
  }

  function locsMarkup() {
    return card(
      "#ffb74d",
      "Локации: награды и выгода",
      '<div class="tl-cards">' +
        L.map((_, i) => locCard(i)).join("") +
        "</div>" +
        '<div class="tl-detail" id="tlDetail" role="region" aria-live="polite"' +
        (openLoc === null ? " hidden" : ' aria-label="' + L[openLoc] + '"') +
        ">" +
        (openLoc === null ? "" : locDetail(openLoc)) +
        "</div>" +
        '<p class="tasks-note">Итого - за все задания всех этапов вместе с наградой за прохождение, ' +
        ico("energy") +
        " - энергия на все задания. Выгода - итого на единицу энергии, зелёным отмечена лучшая локация. " +
        "Нажмите на карточку - откроются этапы: сколько раз выполнить задание и что оно даёт.</p>"
    );
  }
  function setOpen(i, scroll) {
    openLoc = openLoc === i ? null : i;
    try {
      if (openLoc === null) localStorage.removeItem(OPEN_KEY);
      else localStorage.setItem(OPEN_KEY, String(openLoc));
    } catch {}
    /* карточки не перерисовываются, чтобы фокус оставался на нажатой */
    root.querySelectorAll("[data-tl-loc]").forEach(c => {
      const on = Number(c.dataset.tlLoc) === openLoc;
      c.classList.toggle("active", on);
      c.setAttribute("aria-expanded", on);
      const m = c.querySelector(".tl-more-t");
      if (m) m.textContent = on ? "Скрыть этапы" : "Этапы и сравнение";
    });
    const det = document.getElementById("tlDetail");
    if (!det) return;
    det.hidden = openLoc === null;
    det.innerHTML = openLoc === null ? "" : locDetail(openLoc);
    if (openLoc === null) det.removeAttribute("aria-label");
    else det.setAttribute("aria-label", L[openLoc]);
    if (scroll && openLoc !== null) det.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  /* ---------- калькулятор энергии ----------
   Сколько ресурсов даст N энергии на выбранной локации и сколько жетонов уйдёт на энергетики.
   Полное прохождение локации стоит combined.energy и даёт итог всех заданий + награду (жетоны - только она).
   Остаток энергии проходит задания по порядку: этап за этапом, каждое задание этапа - reps раз,
   поэтому результат точный, а не оценка */
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

  /* результат для локации i и энергии e: полные прохождения, потом задания следующего по порядку.
     stage/done - где остановитесь (этап по счёту с 1 и сколько его заданий выполнено), left - энергия,
     которой не хватило на следующее задание */
  function energyYield(i, e) {
    const cost = combined.energy[i],
      runs = Math.floor(e / cost),
      out = { runs: runs, left: e - runs * cost, stage: 0, done: 0, tasks: 0 };
    ["exp", "bullets", "rep"].forEach(k => (out[k] = runs * combined[k][i]));
    out.tokens = runs * combined.tokens[i];
    for (let j = 0; j < D.stages.length; j++) {
      const s = D.stages[j],
        k = Math.min(s.reps[i], Math.floor(out.left / s.energy[i]));
      ["exp", "bullets", "rep"].forEach(r => (out[r] += k * s[r][i]));
      out.left -= k * s.energy[i];
      out.tasks += k;
      if (k < s.reps[i]) {
        out.stage = j + 1;
        out.done = k;
        break;
      }
    }
    return out;
  }

  function calcResultMarkup() {
    const i = calcState.loc,
      e = calcState.energy,
      y = energyYield(i, e);
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
    /* где остановитесь после полных прохождений: этап и сколько его заданий выполнено */
    const st = y.stage ? D.stages[y.stage - 1] : null;
    const where = st
      ? "остановитесь на этапе " +
        y.stage +
        " (выполнено " +
        y.done +
        " из " +
        st.reps[i] +
        ")" +
        (y.left ? ", останется " + n0(y.left) + " энергии" : "")
      : "";
    const runsTxt = !e
      ? "Укажите, сколько энергии потратить"
      : y.runs
        ? "Полных прохождений: <b>" + n0(y.runs) + "</b>" + (st && (y.tasks || y.left) ? ", затем " + where : "")
        : "На полное прохождение нужно " +
          n0(combined.energy[i]) +
          " энергии. Заданий выполнено: <b>" +
          n0(y.tasks) +
          "</b>, " +
          where;
    return (
      '<div class="ec-results">' +
      res("exp", n0(y.exp)) +
      res("bullets", n0(y.bullets)) +
      res("rep", n0(y.rep)) +
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
        " жетонов. Жетоны дают только за полное прохождение локации, остаток энергии считается по заданиям этапов по порядку.</p>"
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
    const t = e.target.closest("[data-tl-loc], [data-tl-close]");
    if (t) {
      const was = openLoc;
      setOpen(t.dataset.tlClose !== undefined ? openLoc : Number(t.dataset.tlLoc), t.dataset.tlClose === undefined);
      /* после закрытия крестиком фокус возвращается на карточку */
      if (t.dataset.tlClose !== undefined) {
        const c = root.querySelector('[data-tl-loc="' + was + '"]');
        if (c) c.focus({ preventScroll: true });
      }
      return;
    }
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
    return calcMarkup() + locsMarkup();
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
