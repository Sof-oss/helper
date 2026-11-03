/* Окно «Расчёт по жетонам» (#tokensModal): вкладки «По жетонам» и «Мой арсенал».
   Отдельный кусок сборки, как src/calc-talents.js: всё общее приходит из app.js через setup(c). */
export function setup(c) {
  const { $, results, fmt, fmtD, plural } = c;
  /* расчёт по жетонам */
  const TOKEN_PRICES = { grenade: 3, gl: 5, gauss: 15 },
    TOKEN_KEY = "gameHelperTokens",
    TOKEN_WEAPONS = [
      ["grenade", "Граната"],
      ["gl", "Гранатомёт"],
      ["gauss", "Гаусс"]
    ],
    TOKEN_CRIT = {
      grenade: ["critGrenade", "critDmgGrenade"],
      gl: ["critGl", "critDmgGl"],
      gauss: ["critGauss", "critDmgGauss"]
    };
  const tokenInt = id => Math.max(0, Math.floor(Number(String($(id).value).replace(/\D/g, "")) || 0));
  function saveTokens() {
    try {
      localStorage.setItem(TOKEN_KEY, JSON.stringify({ count: $("tokenCount").value, target: $("tokenTarget").value }));
    } catch {}
  }
  function loadTokens() {
    try {
      const d = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
      if (!d) return;
      if (d.count !== undefined) $("tokenCount").value = d.count;
      if (d.target !== undefined) $("tokenTarget").value = d.target;
      ["tokenCount", "tokenTarget"].forEach(id => window.__groupDigits && window.__groupDigits($(id)));
    } catch {}
  }
  /* урон за удар и средний урон с критом: урон + шанс * бонус */
  function tokenWeaponStats() {
    const r = results();
    return TOKEN_WEAPONS.map(([k, name]) => {
      const dmg = r[k],
        chance = Math.min(1, r[TOKEN_CRIT[k][0]]),
        bonus = r[TOKEN_CRIT[k][1]];
      return { key: k, name, price: TOKEN_PRICES[k], dmg, chance, bonus, avg: dmg + chance * bonus };
    });
  }
  /* карточки оружия: урон за жетон, полоска выгоды и три строки расчёта. */
  const TOKEN_ICON_CLASS = { grenade: "grenade", gl: "ubgl", gauss: "gauss" };
  function renderTokens() {
    const tokens = tokenInt("tokenCount"),
      target = tokenInt("tokenTarget"),
      st = tokenWeaponStats();
    const bestCrit = Math.max.apply(
      null,
      st.map(w => w.avg / w.price)
    );
    $("tokCards").innerHTML = st
      .map(w => {
        const perToken = w.avg / w.price,
          best = Math.abs(perToken - bestCrit) < 1e-9;
        const shots = Math.floor(tokens / w.price);
        const needed = target > 0 ? Math.ceil(target / w.avg) * w.price : 0;
        const width = Math.max(4, Math.round((perToken / bestCrit) * 100));
        return (
          '<article class="tok-card' +
          (best ? " best" : "") +
          '">' +
          (best ? '<span class="tok-best">выгоднее</span>' : "") +
          '<div class="tok-card-head"><span class="tok-wicon weapon-' +
          TOKEN_ICON_CLASS[w.key] +
          '"></span><div><b>' +
          w.name +
          "</b><small>" +
          w.price +
          " " +
          plural(w.price, "жетон", "жетона", "жетонов") +
          " за удар · крит " +
          (w.chance * 100).toFixed(0) +
          "% / +" +
          fmt(w.bonus) +
          "</small></div></div>" +
          '<div class="tok-card-big">' +
          fmtD(perToken) +
          '</div><div class="tok-card-unit">урона за жетон</div>' +
          '<div class="tok-card-bar"><i style="width:' +
          width +
          '%"></i></div>' +
          '<div class="tok-card-rows">' +
          "<div><span>" +
          fmt(tokens) +
          " " +
          plural(tokens, "жетон", "жетона", "жетонов") +
          "</span><b>" +
          fmt(shots) +
          " " +
          plural(shots, "удар", "удара", "ударов") +
          "</b></div>" +
          "<div><span>это урона</span><b>" +
          fmt(shots * w.avg) +
          "</b></div>" +
          '<div class="acc"><span>на ' +
          fmt(target) +
          " урона нужно</span><b>" +
          fmt(needed) +
          " " +
          plural(needed, "жетон", "жетона", "жетонов") +
          "</b></div>" +
          "</div></article>"
        );
      })
      .join("");
  }
  /* «Мой арсенал»: сколько у игрока гранат, гранатомётов и гауссов -> урон каждого и общий (средний с критом). */
  const ARSENAL_KEY = "gameHelperArsenal",
    ARSENAL_MAX = 999999,
    ARSENAL_COLOR = { grenade: "#54bfff", gl: "#f2b544", gauss: "#3fdc8a" };
  let arsenal = { grenade: 0, gl: 0, gauss: 0 },
    tokTab = "tokens";
  function saveArsenal() {
    try {
      localStorage.setItem(ARSENAL_KEY, JSON.stringify({ count: arsenal, tab: tokTab }));
    } catch {}
  }
  function loadArsenal() {
    try {
      const d = JSON.parse(localStorage.getItem(ARSENAL_KEY) || "null");
      if (!d) return;
      if (d.count)
        TOKEN_WEAPONS.forEach(([k]) => {
          const n = Math.floor(Number(d.count[k]) || 0);
          arsenal[k] = Math.max(0, Math.min(ARSENAL_MAX, n));
        });
      if (d.tab === "arsenal") tokTab = "arsenal";
    } catch {}
  }
  function setTokTab(tab) {
    tokTab = tab === "arsenal" ? "arsenal" : "tokens";
    document.querySelectorAll("[data-tok-tab]").forEach(b => {
      const on = b.dataset.tokTab === tokTab;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    $("tokPaneTokens").hidden = tokTab !== "tokens";
    $("tokPaneArsenal").hidden = tokTab !== "arsenal";
    if (tokTab === "arsenal") renderArsenal();
    else renderTokens();
  }

  function renderArsenal() {
    const st = tokenWeaponStats();
    if (!$("arsList").children.length)
      $("arsList").innerHTML = st
        .map(
          w =>
            '<div class="ars-item" style="--c:' +
            ARSENAL_COLOR[w.key] +
            '"><span class="tok-wicon weapon-' +
            TOKEN_ICON_CLASS[w.key] +
            '" aria-hidden="true"></span><div class="ars-name"><b>' +
            w.name +
            '</b><small id="arsPer-' +
            w.key +
            '"></small></div><div class="ars-step"><button type="button" data-ars-step="' +
            w.key +
            '" data-d="-1" aria-label="Меньше: ' +
            w.name +
            '">−</button><input id="ars-' +
            w.key +
            '" data-ars="' +
            w.key +
            '" type="text" inputmode="numeric" autocomplete="off" maxlength="7" data-group-digits aria-label="Сколько у вас: ' +
            w.name +
            '"><button type="button" data-ars-step="' +
            w.key +
            '" data-d="1" aria-label="Больше: ' +
            w.name +
            '">+</button></div><div class="ars-sub"><span id="arsShare-' +
            w.key +
            '"></span><em id="arsDmg-' +
            w.key +
            '"></em></div></div>'
        )
        .join("");
    const rows = st.map(w => ({ w, dmg: arsenal[w.key] * w.avg }));
    const total = rows.reduce((s, r) => s + r.dmg, 0);
    let deg = 0;
    const parts = [];
    rows.forEach(({ w, dmg }) => {
      const inp = $("ars-" + w.key),
        val = arsenal[w.key] ? fmt(arsenal[w.key]) : "";
      if (document.activeElement !== inp && inp.value !== val) inp.value = val;
      $("arsPer-" + w.key).textContent =
        fmt(w.avg) + " урона за удар" + (w.chance > 0 ? " · крит " + (w.chance * 100).toFixed(0) + "%" : "");
      $("arsShare-" + w.key).textContent = total > 0 ? Math.round((dmg / total) * 100) + "% от общего" : "-";
      $("arsDmg-" + w.key).textContent = fmt(dmg);
      if (dmg > 0) {
        const to = deg + (dmg / total) * 360;
        parts.push(ARSENAL_COLOR[w.key] + " " + deg.toFixed(2) + "deg " + to.toFixed(2) + "deg");
        deg = to;
      }
    });
    $("arsSum").innerHTML =
      '<div class="ars-donut' +
      (total > 0 ? "" : " empty") +
      '"' +
      (parts.length ? ' style="background:conic-gradient(' + parts.join(",") + ')"' : "") +
      "><div><small>Всего урона</small><strong>" +
      fmt(total) +
      "</strong></div></div>" +
      '<div class="ars-leg">' +
      st.map(w => '<span style="--c:' + ARSENAL_COLOR[w.key] + '"><i></i>' + w.name + "</span>").join("") +
      "</div>";
  }
  function setArsenal(key, n) {
    arsenal[key] = Math.max(0, Math.min(ARSENAL_MAX, Math.floor(n) || 0));
    saveArsenal();
    renderArsenal();
  }
  function openTokens() {
    $("tokensModal").classList.add("show");
    $("tokensModal").setAttribute("aria-hidden", "false");
    setTokTab(tokTab);
  }

  ["tokenCount", "tokenTarget"].forEach(id =>
    $(id).addEventListener("input", () => {
      saveTokens();
      renderTokens();
    })
  );
  document.addEventListener("click", e => {
    const arsStep = e.target.closest("[data-ars-step]");
    if (arsStep) {
      const k = arsStep.dataset.arsStep;
      setArsenal(k, arsenal[k] + Number(arsStep.dataset.d));
    }
  });
  /* поле количества в «Моём арсенале»: число без пробелов-разрядов */
  document.addEventListener("input", e => {
    const k = e.target.dataset && e.target.dataset.ars;
    if (k) setArsenal(k, Number(String(e.target.value).replace(/\D/g, "")));
  });
  /* стрелки влево/вправо по вкладкам - общий обработчик nav.js: он нажимает соседнюю вкладку (клик ловит app.js) */
  loadTokens();
  loadArsenal();

  return {
    open: openTokens,
    tab(name) {
      setTokTab(name);
      saveArsenal();
    }
  };
}
