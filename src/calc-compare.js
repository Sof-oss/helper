/* Окно «Сравнение билдов» (#compareModal): свой билд против билда из ссылки.
   Отдельный кусок сборки, как src/calc-talents.js: всё общее приходит из app.js через setup(c). */
export function setup(c) {
  const {
    $,
    fmt,
    plural,
    TALENTS,
    ALL_ITEMS,
    ITEM_BY_CODE,
    currentBuild,
    results,
    resultsFor,
    parseBuild,
    buildHashOf,
    showToast,
    CMP_KEY
  } = c;
  let cmpBuild = null;
  function saveCompare() {
    try {
      if (cmpBuild) localStorage.setItem(CMP_KEY, buildHashOf(cmpBuild));
      else localStorage.removeItem(CMP_KEY);
    } catch {}
  }
  function loadCompare() {
    try {
      const h = localStorage.getItem(CMP_KEY);
      if (h) cmpBuild = parseBuild(h);
    } catch {}
  }
  const CMP_GROUPS = [
    [
      "⚔ Урон за удар",
      [
        ["knife", "Нож"],
        ["pistol", "Пистолет"],
        ["auto", "Автомат"],
        ["grenade", "Граната"],
        ["gl", "Гранатомёт"],
        ["gauss", "Гаусс"]
      ]
    ],
    [
      "✦ Крит",
      [
        ["critDmgGrenade", "Урон крита, граната"],
        ["critDmgGl", "Урон крита, гранатомёт"],
        ["critDmgGauss", "Урон крита, гаусс"],
        ["critGrenade", "Шанс крита, граната", 1],
        ["critGl", "Шанс крита, гранатомёт", 1],
        ["critGauss", "Шанс крита, гаусс", 1]
      ]
    ],
    [
      "◷ Дополнительно",
      [
        ["noCooldown", "Удар без отката", 1],
        ["cooldown", "Сокращение отката", 1],
        ["firstFreeHit", "Первый бесплатный удар", 1]
      ]
    ]
  ];
  const sumRanks = t => Object.values(t).reduce((a, b) => a + b, 0);
  /* у большего значения зелёная стрелка вверх, у меньшего красная вниз, рядом на сколько; поровну - без отметок. */
  function cmpRow(label, x, y, pct) {
    const d = Math.abs(y - x),
      eq = d < (pct ? 0.005 : 0.5),
      show = v => (pct ? Math.round(v * 100) + "%" : fmt(v)),
      gap = pct ? Math.round(d * 100) + "%" : fmt(d);
    const total = x + y || 1,
      wa = Math.max(4, Math.round((x / total) * 100)),
      wb = Math.max(4, 100 - wa);
    const cell = (v, hi, w) =>
      eq
        ? '<td class="cmp-cell"><span class="cmp-v">' + show(v) + "</span></td>"
        : '<td class="cmp-cell ' +
          (hi ? "cmp-up" : "cmp-down") +
          '"><span class="cmp-v">' +
          show(v) +
          "</span>" +
          '<i class="cmp-arr">' +
          (hi ? "▲" : "▼") +
          " " +
          gap +
          '</i><span class="cmp-bar"><i style="width:' +
          w +
          '%"></i></span></td>';
    return (
      '<tr class="' +
      (eq ? "cmp-eq" : "") +
      '"><th scope="row">' +
      label +
      "</th>" +
      cell(x, x > y, wa) +
      cell(y, y > x, wb) +
      "</tr>"
    );
  }
  const cmpTags = (arr, cls) =>
    arr.map(t => '<span class="gear-info-tag cmp-tag ' + cls + '">' + t + "</span>").join("");
  /* сводка сверху: уровень, очки талантов и сколько собрано снаряжения */
  function cmpHead(a, b) {
    const gear = x => x.gear.length,
      total = ALL_ITEMS.length;
    const card = (cls, title, x) =>
      '<div class="cmp-card ' +
      cls +
      '"><small>' +
      title +
      "</small><b>" +
      x.level +
      " уровень</b>" +
      "<span>" +
      sumRanks(x.talents) +
      " " +
      plural(sumRanks(x.talents), "очко", "очка", "очков") +
      " талантов</span>" +
      "<span>снаряжение " +
      gear(x) +
      " из " +
      total +
      "</span><span>арена " +
      x.arena +
      " очков</span></div>";
    return (
      '<div class="cmp-head">' +
      card("a", "Ваш билд", a) +
      '<div class="cmp-vs">против</div>' +
      card("b", "Другой билд", b) +
      "</div>"
    );
  }
  function renderCompare() {
    const body = $("compareBody");
    $("cmpClear").disabled = !cmpBuild;
    if (!cmpBuild) {
      body.innerHTML = '<p class="cmp-note">Пока не с чем сравнивать. Вставьте ссылку на билд в поле выше.</p>';
      return;
    }
    const a = currentBuild(),
      b = cmpBuild,
      ra = results(),
      rb = resultsFor(b);
    let rows =
      '<tr class="cmp-group"><td colspan="3">★ Общее</td></tr>' +
      cmpRow("Уровень", a.level, b.level) +
      cmpRow("Очки талантов", sumRanks(a.talents), sumRanks(b.talents)) +
      cmpRow("Снаряжение", a.gear.length, b.gear.length) +
      cmpRow("Арена", a.arena, b.arena);
    CMP_GROUPS.forEach(([title, list]) => {
      rows +=
        '<tr class="cmp-group"><td colspan="3">' +
        title +
        "</td></tr>" +
        list.map(([k, l, p]) => cmpRow(l, ra[k], rb[k], p)).join("");
    });
    const only = (x, y) =>
      x
        .filter(code => !y.includes(code))
        .map(code => ITEM_BY_CODE[code] && ITEM_BY_CODE[code].name)
        .filter(Boolean);
    const mine = only(a.gear, b.gear),
      theirs = only(b.gear, a.gear);
    const tal = TALENTS.filter(t => (a.talents[t[0]] || 0) !== (b.talents[t[0]] || 0)).map(t => {
      const x = a.talents[t[0]] || 0,
        y = b.talents[t[0]] || 0;
      return { t: t[2] + " " + x + " → " + y, cls: y > x ? "b" : "a" };
    });
    const block = (title, html) =>
      html
        ? '<div class="cmp-diff-row"><small>' + title + '</small><div class="gear-info-tags">' + html + "</div></div>"
        : "";
    const diff =
      block("Снаряжение только у вас", cmpTags(mine, "a")) +
      block("Снаряжение только у другого билда", cmpTags(theirs, "b")) +
      block("Таланты (ваш → другого билда)", tal.map(x => cmpTags([x.t], x.cls)).join(""));
    body.innerHTML =
      cmpHead(a, b) +
      '<table class="data-table cmp-table"><colgroup><col class="cmp-c0"><col><col></colgroup><thead><tr><th>Параметр</th>' +
      '<th class="cmp-h-a"><i class="cmp-dot"></i>Ваш билд</th><th class="cmp-h-b"><i class="cmp-dot"></i>Другой билд</th></tr></thead><tbody>' +
      rows +
      "</tbody></table>" +
      '<p class="cmp-note">▲ больше, ▼ меньше; рядом показано, на сколько, а полоска - насколько значение больше второго билда.</p>' +
      '<details class="cmp-diff"' +
      (diff ? " open" : "") +
      "><summary>Что отличается</summary>" +
      (diff || "<p>Снаряжение и таланты совпадают.</p>") +
      "</details>";
  }
  function openCompare() {
    $("compareModal").classList.add("show");
    $("compareModal").setAttribute("aria-hidden", "false");
    renderCompare();
  }
  function loadCmpFromInput() {
    const v = $("cmpInput").value.trim(),
      b = v && parseBuild(v);
    if (!b) {
      showToast("Не похоже на ссылку на билд");
      return;
    }
    cmpBuild = b;
    saveCompare();
    $("cmpInput").value = "";
    renderCompare();
  }

  document.addEventListener("click", e => {
    if (e.target.closest("#cmpLoad")) {
      loadCmpFromInput();
      return;
    }
    if (e.target.closest("#cmpClear")) {
      cmpBuild = null;
      saveCompare();
      renderCompare();
    }
  });
  $("cmpInput").addEventListener("keydown", e => {
    if (e.key === "Enter") loadCmpFromInput();
  });
  /* билд из ссылки (app.js разобрал его при загрузке) идёт в сравнение, свой сохранённый не трогаем */
  if (c.linked) {
    cmpBuild = c.linked;
    saveCompare();
  } else loadCompare();

  return { open: openCompare };
}
