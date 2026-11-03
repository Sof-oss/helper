/* Окно «Древо талантов» (#talentModal): дерево, окно таланта, подсказки у узлов и прокачка.
   Отдельный кусок сборки (build.js): app.js загружает его при первом открытии окна или заранее, когда страница простаивает.
   Общее состояние и функции приходят из app.js через setup(c), своих import нет: иначе esbuild вынес бы общий код в ещё один файл. */
export function setup(c) {
  const {
    state,
    $,
    TALENTS,
    MAX_TALENT_POINTS,
    talentRank,
    talentDef,
    spentTalentPoints,
    plural,
    results,
    saveState,
    render,
    askConfirm,
    fmtDelta,
    isZero
  } = c;
  const TALENT_ASSETS = {
    TALENT_0001: "TALENT_0001-sfcxbYqa.webp",
    TALENT_0002: "TALENT_0002-DJDfGX4a.webp",
    TALENT_0003: "TALENT_0003-DmaMfCbv.webp",
    TALENT_0004: "TALENT_0004-CA2yMivx.webp",
    TALENT_0005: "TALENT_0005-CgjISMXn.webp",
    TALENT_0006: "TALENT_0006-ClsyoGm3.webp",
    TALENT_0007: "TALENT_0007-DAY6ZOOP.webp",
    TALENT_0008: "TALENT_0008-y6cx_aDt.webp",
    TALENT_0009: "TALENT_0009-Bp-oNrB8.webp",
    TALENT_0010: "TALENT_0010-BlkwiBNG.webp",
    TALENT_0011: "TALENT_0011-waaRueAG.webp",
    TALENT_0012: "TALENT_0012-DJYHMNfz.webp",
    TALENT_0013: "TALENT_0013-CW8z33mi.webp",
    TALENT_0014: "TALENT_0014-D0Z0I1wp.webp",
    TALENT_0015: "TALENT_0015-NxBLj8iX.webp",
    TALENT_0016: "TALENT_0016-C10xeuwP.webp",
    TALENT_0017: "TALENT_0017-B6yciWom.webp",
    TALENT_0018: "TALENT_0018-Bl6lQcmT.webp",
    TALENT_0019: "TALENT_0019-CK1oIt-A.webp",
    TALENT_0020: "TALENT_0020-fFMuuMjC.webp",
    TALENT_0021: "TALENT_0021-BoNRfcSz.webp",
    TALENT_0022: "TALENT_0022-BPLJgAH0.webp",
    TALENT_0023: "TALENT_0023-BiqFfm_b.webp",
    TALENT_0024: "TALENT_0024-BfcgPQN4.webp",
    TALENT_0025: "TALENT_0025-CadiUFM_.webp",
    TALENT_0026: "TALENT_0026-BYzW7dE1.webp",
    TALENT_0027: "TALENT_0027-CioKjBsV.webp"
  };
  function canUpgrade(t) {
    return talentRank(t[0]) < 5 && t[9].every(req => talentRank(req) >= 5);
  }
  function canDowngrade(t) {
    return talentRank(t[0]) > 0 && !TALENTS.some(x => talentRank(x[0]) > 0 && x[9].includes(t[0]));
  }
  function talentNodeStatus(t) {
    const rank = talentRank(t[0]),
      ready = canUpgrade(t),
      locked = t[9].some(req => talentRank(req) < 5);
    return rank >= 5 ? "maxed" : ready ? "ready" : locked ? "locked" : "open";
  }
  function talentNodeIcon(t) {
    const file = TALENT_ASSETS[t[0]],
      alt = t[2].replace(/"/g, "&quot;");
    return file
      ? '<img src="assets/' + file + '" alt="' + alt + '" width="200" height="200" loading="lazy" decoding="async">'
      : "✥";
  }
  const ROMAN = ["", "I", "II", "III", "IV", "V"];
  const TALENT_STAT_LABELS = {
    free_boss_damage_flat: "Урон от бесплатных ударов",
    free_hit_damage_flat: "Урон",
    first_free_hit_damage_bonus_pct: "Урон от первого бесплатного удара",
    paid_hit_damage_flat: "Урон",
    paid_hit_crit_damage_flat: "Бонус к критическому урону",
    paid_hit_crit_chance_pct: "Шанс критического удара",
    free_hit_cooldown_reduction_pct: "Уменьшение времени перезарядки",
    free_hit_cooldown_dodge_chance_pct: "Шанс удара без отката"
  };
  const TALENT_TARGET_NAMES = {
    knife: "Нож",
    pistol: "Пистолет",
    rifle: "Автомат",
    grenade: "Граната",
    ubgl: "Гранатомёт",
    gauss: "Гаусс"
  };
  const TD_CHECK =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="m7.8 12.4 3 3 5.6-6.2"/></svg>';
  /* окно таланта: ромбы рангов, значения по рангам с подсветкой текущего, требования со статусом */
  function renderTalentDetails(t) {
    const rank = talentRank(t[0]),
      up = canUpgrade(t),
      down = canDowngrade(t),
      stat = t[7],
      unit = stat && stat.endsWith("_pct") ? "%" : "",
      target = Array.isArray(t[8]) ? t[8][0] : t[8],
      next = rank < 5 ? t[6][rank] : t[6][4];
    const pips = [1, 2, 3, 4, 5].map(i => '<i class="td-pip' + (i <= rank ? " on" : "") + '"></i>').join("");
    const values = t[6]
      .map((v, i) => "<span" + (i === rank - 1 ? ' class="td-cur"' : "") + ">+" + v + unit + "</span>")
      .join("<em>/</em>");
    const reqs = t[9].length
      ? t[9]
          .map(code => {
            const d = talentDef(code),
              ok = talentRank(code) >= 5;
            return (
              '<div class="td-req' +
              (ok ? " ok" : "") +
              '">' +
              TD_CHECK +
              "<b>" +
              (d ? d[2] : code) +
              " " +
              ROMAN[5] +
              "</b><span>" +
              (ok ? "Выполнено" : "Не выполнено") +
              "</span></div>"
            );
          })
          .join("")
      : '<div class="td-req none">Нет требований</div>';
    return (
      '<div class="talent-detail"><div class="td-head"><span class="td-art" aria-hidden="true">' +
      (TALENT_ASSETS[t[0]] ? '<img src="assets/' + TALENT_ASSETS[t[0]] + '" alt="" width="200" height="200">' : "") +
      "</span><h3>" +
      t[2] +
      '</h3><button type="button" class="td-close" data-close-talent-detail aria-label="Закрыть">×</button></div><div class="td-rank"><div class="td-pips">' +
      pips +
      "</div><b>" +
      rank +
      '/5</b><span>Текущий уровень</span></div><p class="td-desc">' +
      t[3] +
      '</p><div class="td-sec">Эффекты</div><div class="td-effect"><small>' +
      TALENT_STAT_LABELS[stat] +
      (target ? " · " + TALENT_TARGET_NAMES[target] : "") +
      '</small><div class="td-vals">' +
      values +
      '</div></div><div class="td-sec">Требования</div>' +
      reqs +
      '<div class="td-actions">' +
      (down
        ? '<button type="button" class="td-minus" data-talent-down="' + t[0] + '" aria-label="Понизить ранг">−</button>'
        : "") +
      '<button type="button" class="td-up" data-talent-up="' +
      t[0] +
      '" ' +
      (up ? "" : "disabled") +
      ">" +
      (rank >= 5 ? "Максимум" : (rank ? "Прокачать" : "Изучить") + " · +" + next + unit) +
      "</button></div></div>"
    );
  }

  /* путь от таланта до его требований, для подсветки */
  function talentAncestors(code) {
    const seen = new Set();
    const walk = c => {
      if (seen.has(c)) return;
      seen.add(c);
      const t = talentDef(c);
      if (!t) return;
      t[9].forEach(walk);
    };
    walk(code);
    return seen;
  }

  /* Дерево статичное: пользователь его не двигает и не масштабирует. */
  const treeT = { s: 1, x: 0, y: 0 };
  function clampTreeScale(s) {
    return Math.min(2.5, Math.max(0.2, s));
  }
  function applyTreeTransform() {
    const c = document.querySelector(".talent-flow-canvas");
    if (c) c.style.transform = "translate(" + treeT.x + "px," + treeT.y + "px) scale(" + treeT.s + ")";
  }
  /* вписать дерево в окно и отцентровать (offsetLeft/Top не учитывают transform). */
  function talentNodeBox() {
    const nodes = [...document.querySelectorAll(".talent-flow-canvas .talent-node-game")];
    if (!nodes.length) return null;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    nodes.forEach(n => {
      const l = parseFloat(n.style.left) || 0,
        t = parseFloat(n.style.top) || 0,
        w = n.offsetWidth || 100,
        h = n.offsetHeight || 100;
      x0 = Math.min(x0, l);
      y0 = Math.min(y0, t);
      x1 = Math.max(x1, l + w);
      y1 = Math.max(y1, t + h);
    });
    return { x0, y0, w: x1 - x0, h: y1 - y0 };
  }
  function resetTreeTransform() {
    const wrap = document.querySelector(".talent-flow-wrap"),
      canvas = document.querySelector(".talent-flow-canvas");
    if (wrap && canvas && wrap.clientWidth && canvas.offsetWidth) {
      const ww = wrap.clientWidth,
        wh = wrap.clientHeight || ww,
        pad = 20,
        box = talentNodeBox();
      const bw = box ? box.w : canvas.offsetWidth,
        bh = box ? box.h : canvas.offsetHeight;
      const s = clampTreeScale(Math.min(1.4, (ww - pad * 2) / bw, (wh - pad * 2) / bh));
      const bx = box ? box.x0 + box.w / 2 : canvas.offsetWidth / 2,
        by = box ? box.y0 + box.h / 2 : canvas.offsetHeight / 2;
      treeT.s = s;
      treeT.x = ww / 2 - bx * s - canvas.offsetLeft;
      treeT.y = wh / 2 - by * s - canvas.offsetTop;
    } else {
      treeT.s = 1;
      treeT.x = 0;
      treeT.y = 0;
    }
    applyTreeTransform();
  }
  /* при повороте телефона или изменении размера окна дерево снова вписывается */
  let treeFitFrame = 0;
  window.addEventListener("resize", () => {
    const modal = document.getElementById("talentModal");
    if (!modal || !modal.classList.contains("show")) return;
    cancelAnimationFrame(treeFitFrame);
    treeFitFrame = requestAnimationFrame(resetTreeTransform);
  });

  /* подсказка при наведении на узел: без клика видно, что даёт талант */
  function showTalentTip(code, node) {
    const tip = $("talentTip") || document.getElementById("talentTip");
    if (!tip || !node) return;
    const t = talentDef(code);
    if (!t) return;
    const rank = talentRank(code),
      stat = t[7],
      unit = stat && stat.endsWith("_pct") ? "%" : "",
      target = Array.isArray(t[8]) ? t[8][0] : t[8];
    const label = (TALENT_STAT_LABELS[stat] || "Эффект") + (target ? " · " + TALENT_TARGET_NAMES[target] : "");
    const left =
      rank >= 5
        ? "изучено до максимума"
        : rank
          ? "сейчас " + rank + " " + plural(rank, "ранг", "ранга", "рангов") + " · до максимума " + (5 - rank)
          : "не изучен · до максимума 5";
    tip.innerHTML =
      "<b>" +
      t[2] +
      "</b><p>" +
      t[3] +
      '</p><div class="talent-tip-eff">' +
      label +
      " <b>" +
      t[6].map(v => "+" + v + unit).join(" / ") +
      '</b></div><div class="talent-tip-rank">' +
      left +
      "</div>";
    const wrap = document.querySelector(".talent-flow-wrap");
    if (!wrap) return;
    const w = wrap.getBoundingClientRect(),
      r = node.getBoundingClientRect();
    tip.hidden = false;
    const tw = tip.offsetWidth || 260,
      th = tip.offsetHeight || 110;
    tip.style.left = Math.max(8, Math.min(w.width - tw - 8, r.left - w.left + r.width + 14)) + "px";
    tip.style.top = Math.max(8, Math.min(w.height - th - 8, r.top - w.top - 10)) + "px";
  }
  function hideTalentTip() {
    const tip = document.getElementById("talentTip");
    if (tip && !tip.hidden) {
      tip.hidden = true;
      tip.innerHTML = "";
    }
  }

  /* подписи для сводки изменений: [ключ, подпись, в процентах?] */
  const RES_META = [
    ["knife", "Нож"],
    ["pistol", "Пистолет"],
    ["auto", "Автомат"],
    ["grenade", "Граната"],
    ["gl", "Гранатомёт"],
    ["gauss", "Гаусс"],
    ["critDmgGrenade", "Крит гранаты"],
    ["critDmgGl", "Крит гранатомёта"],
    ["critDmgGauss", "Крит гаусса"],
    ["critGl", "Шанс крита", 1],
    ["noCooldown", "Удар без отката", 1],
    ["cooldown", "Сокращение отката", 1],
    ["firstFreeHit", "Первый удар", 1]
  ];
  function diffSummary(a, b) {
    return RES_META.map(([k, l, p]) => ({ l, v: b[k] - a[k], p })).filter(c => !isZero(c.v, c.p));
  }
  let lastTalentChange = null;
  function changeTalent(code, dir) {
    const t = talentDef(code),
      r = talentRank(code);
    if (!t || (dir > 0 ? !canUpgrade(t) : !(r > 0 && canDowngrade(t)))) return;
    const before = results();
    state.talents[code] = r + dir;
    lastTalentChange = diffSummary(before, results());
    saveState();
    render();
  }

  let currentTalentBranch = "free_hits",
    selectedTalentCode = null,
    talentDetailOpen = false,
    detailWasOpen = false;
  /* renderTalents пересоздаёт кнопки, поэтому запоминаем, где стоял фокус, и возвращаем его на такую же кнопку */
  const FOCUS_ATTRS = [
    "data-talent-up",
    "data-talent-down",
    "data-select-talent",
    "data-talent-branch",
    "data-reset-talents"
  ];
  function focusKey() {
    const a = document.activeElement;
    if (!a || !a.closest || !a.closest("#talentModal")) return null;
    for (const at of FOCUS_ATTRS)
      if (a.hasAttribute(at)) {
        const v = a.getAttribute(at);
        return "[" + at + (v ? '="' + v + '"' : "") + "]";
      }
    return null;
  }
  function setDetailInert(on) {
    ["#talentSidebar", ".talent-flow-wrap", ".talent-game-header"].forEach(s => {
      const el = document.querySelector("#talentModal " + s);
      if (el) el.inert = on;
    });
  }
  function renderTalents() {
    const keep = focusKey();
    const branches = [
        { code: "free_hits", name: "Боевая подготовка", desc: "Ветка бесплатных ударов по боссам" },
        { code: "paid_hits", name: "Арсенал", desc: "Ветка платных ударов по боссам" }
      ],
      branch = branches.find(b => b.code === currentTalentBranch) || branches[0],
      talents = TALENTS.filter(t => t[1] === branch.code);
    if (selectedTalentCode && !talents.some(t => t[0] === selectedTalentCode)) {
      selectedTalentCode = null;
      talentDetailOpen = false;
    }
    const pathSet = selectedTalentCode ? talentAncestors(selectedTalentCode) : new Set();
    const maxX = Math.max(
        0,
        ...talents.map(t => {
          const a = talents.filter(x => x[4] === t[4]);
          return Math.abs((a.indexOf(t) - (a.length - 1) / 2) * 164);
        })
      ),
      graphWidth = Math.max(760, Math.ceil(maxX * 2 + 100 + 40)),
      nodePos = new Map();
    talents.forEach(t => {
      const a = talents.filter(x => x[4] === t[4]),
        i = a.indexOf(t);
      nodePos.set(t[0], { x: graphWidth / 2 + (i - (a.length - 1) / 2) * 164 - 50, y: 28 + (t[4] - 1) * 148 });
    });
    const edges = talents
      .flatMap(t =>
        t[9].map(req => {
          const a = nodePos.get(req),
            b = nodePos.get(t[0]);
          if (!a || !b) return "";
          const x1 = a.x + 50,
            y1 = a.y + 100,
            x2 = b.x + 50,
            y2 = b.y,
            mid = (y1 + y2) / 2,
            met = talentRank(req) >= 5,
            onPath = pathSet.has(t[0]),
            cls = onPath ? "te-path" : met ? "te-met" : "te-off";
          return (
            '<path d="M' +
            x1 +
            " " +
            y1 +
            " L " +
            x1 +
            " " +
            mid +
            " L " +
            x2 +
            " " +
            mid +
            " L " +
            x2 +
            " " +
            y2 +
            '" class="' +
            cls +
            '" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>'
          );
        })
      )
      .join("");
    const nodes = talents
      .map(t => {
        const p = nodePos.get(t[0]),
          rank = talentRank(t[0]),
          status = talentNodeStatus(t);
        return (
          '<button type="button" class="talent-node-game ' +
          status +
          (t[0] === selectedTalentCode ? " selected" : "") +
          (pathSet.has(t[0]) ? " on-path" : "") +
          '" data-select-talent="' +
          t[0] +
          '" style="left:' +
          p.x +
          "px;top:" +
          p.y +
          'px"><span class="talent-node-art">' +
          talentNodeIcon(t) +
          '</span><span class="talent-node-rank">' +
          rank +
          '/5</span><span class="talent-node-bar"><i style="width:' +
          rank * 20 +
          '%"></i></span></button>'
        );
      })
      .join("");
    $("talentFlow").innerHTML =
      '<div class="talent-flow-canvas" style="width:' +
      graphWidth +
      'px;height:760px"><svg class="talent-edge-layer" width="' +
      graphWidth +
      '" height="760" viewBox="0 0 ' +
      graphWidth +
      ' 760">' +
      edges +
      "</svg>" +
      nodes +
      "</div>";
    const spent = spentTalentPoints(),
      pct = Math.min(100, Math.round((spent / MAX_TALENT_POINTS) * 100));
    /* прогресс по ветвям: сколько очков вложено из возможных */
    const branchSpent = {},
      branchMax = {};
    TALENTS.forEach(t => {
      branchSpent[t[1]] = (branchSpent[t[1]] || 0) + (talentRank(t[0]) || 0);
      branchMax[t[1]] = (branchMax[t[1]] || 0) + 5;
    });
    const maxedCount = TALENTS.filter(t => talentRank(t[0]) >= 5).length;
    const last =
      lastTalentChange && lastTalentChange.length
        ? '<div class="talent-last"><small>Последнее изменение</small><div class="talent-last-list">' +
          lastTalentChange
            .map(
              c =>
                '<span class="' + (c.v > 0 ? "up" : "down") + '">' + c.l + " <b>" + fmtDelta(c.v, c.p) + "</b></span>"
            )
            .join("") +
          "</div></div>"
        : "";
    /* кнопки в .talent-side-footer, на телефоне он липнет ко дну панели (styles.css) */
    /* легенда состояний живёт в панели, а не поверх дерева: иначе она перекрывает крайние узлы */
    const legend =
      '<div class="talent-legend" aria-hidden="true"><span><i class="lg-maxed"></i>Изучен полностью</span><span><i class="lg-ready"></i>Можно прокачать</span><span><i class="lg-open"></i>Открыт, очков нет</span><span><i class="lg-locked"></i>Закрыт требованием</span></div>';
    $("talentSidebar").innerHTML =
      /* «Таланты N / 135» уже есть в шапке окна - здесь не повторяем */
      '<div class="talent-gauge" style="--pct:' +
      pct +
      '"><div class="talent-gauge-ticks"></div><div class="talent-gauge-value"><b>' +
      Math.max(0, MAX_TALENT_POINTS - spent) +
      "</b><small>свободно</small></div></div>" +
      '<div class="talent-side-stats"><div><b>' +
      spent +
      "</b><small>распределено</small></div><div><b>" +
      maxedCount +
      "<em>/" +
      TALENTS.length +
      "</em></b><small>изучено полностью</small></div></div>" +
      last +
      /* ветки: кнопка выбора сразу показывает, сколько очков в ней вложено */
      '<div class="talent-branch-tabs">' +
      branches
        .map(b => {
          const got = branchSpent[b.code] || 0,
            all = branchMax[b.code] || 1;
          return (
            '<button type="button" class="' +
            (b.code === currentTalentBranch ? "active" : "") +
            '" aria-pressed="' +
            (b.code === currentTalentBranch) +
            '" data-talent-branch="' +
            b.code +
            '"><span class="tb-name">' +
            b.name +
            '</span><b class="tb-count">' +
            got +
            " / " +
            all +
            '</b><small class="tb-desc">' +
            b.desc +
            '</small><span class="talent-branch-bar"><i style="width:' +
            Math.round((got / all) * 100) +
            '%"></i></span></button>'
          );
        })
        .join("") +
      "</div>" +
      legend +
      '<div class="talent-side-hint">Нажмите на талант в дереве, чтобы открыть описание и прокачку</div><div class="talent-side-footer"><button type="button" class="talent-hide talent-hide-reset" data-reset-talents ' +
      (spent ? "" : "disabled") +
      '><svg class="ic" aria-hidden="true"><use href="#i-reset"/></svg>Сбросить таланты</button></div>';
    const detailOverlay = $("talentDetailOverlay"),
      detailOn = talentDetailOpen && !!selectedTalentCode;
    if (detailOn) {
      const dt = talentDef(selectedTalentCode);
      detailOverlay.innerHTML =
        '<div class="talent-detail-backdrop" data-close-talent-detail></div><div class="talent-detail-modal" role="dialog" aria-modal="true" aria-label="' +
        dt[2].replace(/"/g, "&quot;") +
        '" tabindex="-1">' +
        renderTalentDetails(dt) +
        "</div>";
      /* окно уже было открыто (сменился ранг) - перерисовка без анимации появления */
      detailOverlay.classList.toggle("rerender", detailOverlay.classList.contains("show"));
      detailOverlay.classList.add("show");
    } else {
      detailOverlay.classList.remove("show", "rerender");
      detailOverlay.innerHTML = "";
    }
    $("modalSpentPoints").textContent = spent;
    $("modalMaxPoints").textContent = MAX_TALENT_POINTS;
    applyTreeTransform();

    if ($("talentModal").classList.contains("show")) {
      const box = detailOverlay.querySelector(".talent-detail-modal");
      setDetailInert(detailOn);
      if (detailOn && !detailWasOpen) box.focus({ preventScroll: true });
      else if (!detailOn && detailWasOpen) {
        const n = document.querySelector('#talentFlow [data-select-talent="' + selectedTalentCode + '"]');
        if (n) n.focus({ preventScroll: true });
      } else if (keep) {
        const el = document.querySelector("#talentModal " + keep);
        if (el && !el.disabled) el.focus({ preventScroll: true });
        else if (box) box.focus({ preventScroll: true });
      }
    }
    detailWasOpen = detailOn;
  }
  function openTalents() {
    lastTalentChange = null;
    $("talentModal").classList.add("show");
    $("talentModal").setAttribute("aria-hidden", "false");
    renderTalents();
    resetTreeTransform();
  }
  function closeTalents() {
    $("talentModal").classList.remove("show");
    $("talentModal").setAttribute("aria-hidden", "true");
    talentDetailOpen = false;
  }
  function resetTalents() {
    if (!spentTalentPoints()) return;
    askConfirm({
      title: "Сбросить таланты?",
      text: "Все очки талантов вернутся в запас. Уровень и снаряжение останутся без изменений.",
      ok: "Сбросить таланты"
    }).then(yes => {
      if (yes) doResetTalents();
    });
  }
  function doResetTalents() {
    state.talents = {};
    selectedTalentCode = null;
    talentDetailOpen = false;
    lastTalentChange = null;
    saveState();
    render();
  }

  document.addEventListener("click", e => {
    const closeDetail = e.target.closest("[data-close-talent-detail]");
    if (closeDetail) {
      talentDetailOpen = false;
      renderTalents();
      return;
    }
    const up = e.target.closest("[data-talent-up]");
    if (up) {
      changeTalent(up.dataset.talentUp, 1);
      return;
    }
    const branch = e.target.closest("[data-talent-branch]");
    if (branch) {
      currentTalentBranch = branch.dataset.talentBranch;
      selectedTalentCode = null;
      talentDetailOpen = false;
      renderTalents();
      resetTreeTransform();
      return;
    }
    const select = e.target.closest("[data-select-talent]");
    if (select) {
      hideTalentTip();
      selectedTalentCode = select.dataset.selectTalent;
      talentDetailOpen = true;
      renderTalents();
      return;
    }
    const down = e.target.closest("[data-talent-down]");
    if (down) {
      changeTalent(down.dataset.talentDown, -1);
      return;
    }
    if (e.target.closest("[data-reset-talents]")) {
      resetTalents();
      return;
    }
    if (e.target.closest("[data-close-talents]")) closeTalents();
  });
  /* подсказка к узлу дерева: появляется при наведении, исчезает при уходе курсора */
  document.addEventListener("mouseover", e => {
    const n = e.target.closest && e.target.closest(".talent-node-game");
    if (!n || !$("talentModal").classList.contains("show")) return;
    showTalentTip(n.dataset.selectTalent, n);
  });
  document.addEventListener("mouseout", e => {
    if (e.target.closest && e.target.closest(".talent-node-game")) hideTalentTip();
  });

  return {
    render: renderTalents,
    open: openTalents,
    close: closeTalents,
    detailOpen: () => talentDetailOpen,
    closeDetail() {
      talentDetailOpen = false;
      renderTalents();
    },
    /* окно закрылось (MutationObserver в app.js): дерево снова доступно, фокус больше не держим */
    onHidden() {
      setDetailInert(false);
      detailWasOpen = false;
    },
    /* билд сменился целиком (сброс, слот) - «последнее изменение» больше не про него */
    forgetChange() {
      lastTalentChange = null;
    }
  };
}
