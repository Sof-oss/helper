/* вкладка «Боссы» на странице «Информация»: здоровье, требования, награды и комплекты, которые могут выпасть. */
(function () {
  "use strict";
  /* ключи босса (в игре - карточки-ключи): босс отдаёт один ключ своего цвета, три таких ключа нужны для боя со следующим */
  const CARDS = {
    green: { color: "#3ecf5a", one: "Зелёный ключ", many: "зелёных ключа" },
    blue: { color: "#4f86f7", one: "Синий ключ", many: "синих ключа" },
    purple: { color: "#a565e8", one: "Фиолетовый ключ", many: "фиолетовых ключа" },
    orange: { color: "#ff9a2e", one: "Оранжевый ключ", many: "оранжевых ключа" },
    red: { color: "#ec4b4f", one: "Красный ключ", many: "красных ключа" },
    cyan: { color: "#35c9d6", one: "Бирюзовый ключ", many: "бирюзовых ключа" }
  };
  const BOSSES = [
    {
      key: "rat",
      name: "Крыса",
      hp: 1000,
      req: null,
      reward: { card: "green", exp: 25, bullets: 10, tokens: 1, rep: 10 },
      set: null
    },
    {
      key: "alpha",
      name: "Альфа-пёс",
      hp: 10000,
      req: "green",
      reward: { card: "blue", exp: 30, bullets: 100, tokens: 3, rep: 15 },
      set: { name: "Марафонец", img: "marathon", items: ["Олимпийка", "Спортивные штаны"] }
    },
    {
      key: "boar",
      name: "Боров",
      hp: 50000,
      req: "blue",
      reward: { card: "purple", exp: 50, bullets: 300, tokens: 5, rep: 30 },
      set: { name: "Полевой", img: "field", items: ["Армейская кепка", "Армейские штаны", "Армейская куртка"] }
    },
    {
      key: "swamp",
      name: "Болотная тварь",
      hp: 100000,
      req: "purple",
      reward: { card: "orange", exp: 100, bullets: 500, rep: 60 },
      set: { name: "КХК-01", img: "khk", items: ["Шлем", "Комбинезон"] }
    },
    {
      key: "ghoul",
      name: "Упырь",
      hp: 500000,
      req: "orange",
      reward: { card: "red", exp: 200, bullets: 5000, rep: 120 },
      set: { name: "Рубеж-М", img: "rubezh", items: ["Шлем", "Бронекуртка", "Тактические штаны"] }
    },
    {
      key: "izlom",
      name: "Излом",
      hp: 2000000,
      req: "red",
      reward: { card: "cyan", exp: 1000, bullets: 10000, rep: 600 },
      set: { name: "Жестянка", img: "tin", items: ["Консервная банка", "Бронекуртка", "Штаны"] }
    }
  ];
  /* ивентовый босс: не входит в цепочку ключей, был доступен только в дни Хэллоуина.
     Все даты события - из трёх констант ниже: подписи в карточке и обратный отсчёт считаются одними и теми же числами. */
  const MSK = 3; // игровое время - МСК = UTC+3
  const EVENT_FROM = Date.UTC(2026, 9, 23); // начало события
  const EVENT_END = Date.UTC(2026, 10, 5, 24 - MSK); // 6 ноября 00:00 МСК, последний день - 5 ноября
  const EVENT_SPAWNS_MSK = [5, 18]; // босс выходил дважды в день
  const MONTH_GEN = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря"
  ];
  const asMsk = ts => new Date(ts + MSK * 3600000);
  const pad2 = n => String(n).padStart(2, "0");
  const ruDay = ts => asMsk(ts).getUTCDate() + " " + MONTH_GEN[asMsk(ts).getUTCMonth()];
  const ruTime = ts => pad2(asMsk(ts).getUTCHours()) + ":" + pad2(asMsk(ts).getUTCMinutes());
  const EVENT_ENDED = Date.now() >= EVENT_END;
  /* расписание строим по тем же датам: выходы с EVENT_FROM до EVENT_END, отфильтрованные по времени появления */
  const EVENT_SPAWNS = [];
  for (let t = EVENT_FROM; t < EVENT_END; t += 3600000)
    if (EVENT_SPAWNS_MSK.includes(asMsk(t).getUTCHours()) && asMsk(t).getUTCMinutes() === 0) EVENT_SPAWNS.push(t);
  const EVENT_TIME = EVENT_SPAWNS_MSK.map(h => pad2(h) + ":00").join(" · ") + " МСК";
  const EVENT_RANGE = "с " + ruDay(EVENT_FROM) + " по " + ruDay(EVENT_END - 1);
  const EVENT = {
    key: "experiment",
    name: "Эксперимент №31",
    hp: 500000,
    set: {
      name: "Пятничный вечер",
      img: "friday",
      items: ["Хоккейная маска", "Потёртая куртка", "Старые джинсы"]
    },
    rewards: [
      { place: "1", exp: 750, tokens: 10, pda: 5, key: "orange", keyCount: 3, extra: "gauss", extraCount: 5, set: 100 },
      { place: "2", exp: 600, tokens: 8, pda: 4, key: "orange", keyCount: 1, extra: "gauss", extraCount: 4, set: 75 },
      { place: "3", exp: 450, tokens: 5, pda: 3, key: "purple", keyCount: 3, extra: "gauss", extraCount: 3, set: 50 },
      { place: "4–10", exp: 300, tokens: 4, key: "blue", keyCount: 3, extra: "ubgl", extraCount: 8, set: 30 },
      { place: "11+", exp: 150, tokens: 3, key: "green", keyCount: 3, extra: "grenade", extraCount: 15, set: 30 }
    ]
  };
  /* ресурсы награды: подписи и иконки те же, что во вкладке «Задания» */
  const RES = {
    exp: {
      label: "Опыт",
      cls: "exp",
      icon: '<img src="assets/xp.webp" alt="" width="256" height="296" loading="lazy" decoding="async">'
    },
    bullets: {
      label: "Пули",
      cls: "bul",
      icon: '<img src="assets/common_currency-BGqetmZE.webp" alt="" width="83" height="96" loading="lazy" decoding="async">'
    },
    tokens: {
      label: "Жетоны",
      cls: "tok",
      icon: '<img src="assets/rare_currency-D0tYVDkc.webp" alt="" width="81" height="96" loading="lazy" decoding="async">'
    },
    rep: {
      label: "Репутация",
      cls: "rep",
      icon: '<img src="assets/reputation-DqOMMtrl.webp" alt="" width="96" height="92" loading="lazy" decoding="async">'
    }
  };
  const n0 = v => v.toLocaleString("ru-RU");
  const PDA_ICO =
    '<img src="assets/bosses/pda-icon.webp" alt="" width="18" height="18" loading="lazy" decoding="async">';
  const EXTRA = {
    gauss: {
      name: "Выстрел Гаусса",
      icon: '<img src="assets/bosses/gauss.webp" alt="" width="18" height="18" loading="lazy" decoding="async">'
    },
    ubgl: {
      name: "Выстрел гранатомёта",
      icon: '<img src="assets/bosses/ubgl.webp" alt="" width="18" height="18" loading="lazy" decoding="async">'
    },
    grenade: {
      name: "Граната",
      icon: '<img src="assets/bosses/grenade.webp" alt="" width="18" height="18" loading="lazy" decoding="async">'
    }
  };
  const VEST_ICO =
    '<svg class="boss-rw-vest" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.6 3.4 6 5v4.4L4.5 11v9.6h15V11L18 9.4V5l-2.6-1.6C14.9 5.5 13.6 7 12 7s-2.9-1.5-3.4-3.6z"/><path d="M12 7v13.6M7 13.6h3M14 13.6h3M7 16.8h3M14 16.8h3"/></svg>';
  /* награда - плитка с иконкой и количеством, как в окне наград игры */
  const rewardValue = (icon, value, title, kind, color) =>
    '<span class="boss-rw' +
    (kind ? " boss-rw-" + kind : "") +
    '" title="' +
    title +
    '"' +
    (color ? ' style="--c:' + color + '"' : "") +
    '><i class="boss-rw-ico">' +
    icon +
    "</i><b>" +
    value +
    "</b></span>";
  const dash = '<span class="boss-rw-none" aria-hidden="true">—</span>';
  /* места 1–3 - медалью, как в рейтинге */
  const placeMark = p => (/^[123]$/.test(p) ? '<span class="boss-medal boss-medal-' + p + '">' + p + "</span>" : p);
  const rewardCell = (label, html, aria) =>
    '<td data-label="' + label + '" aria-label="' + aria + '">' + html + "</td>";
  /* значок ключа: белая карточка с цветной полосой, как в игре */
  const cardIcon = c =>
    '<svg class="boss-card-ico" viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(10 12 12)"><rect x="6.2" y="2.4" width="11.6" height="19.2" rx="1.6" fill="#eef2f5"/><rect x="13.9" y="3.6" width="2.3" height="16.8" fill="' +
    CARDS[c].color +
    '"/></g></svg>';

  function lootItem(icon, cls, value, label) {
    return (
      '<li class="res-' +
      cls +
      '"><i class="res-ico">' +
      icon +
      "</i><b>+" +
      n0(value) +
      "</b><span>" +
      label +
      "</span></li>"
    );
  }
  function setBlock(set, extra) {
    const cls = "boss-block boss-set" + (extra ? " " + extra : "");
    return set
      ? '<div class="' +
          cls +
          '"><h3>Комплект «' +
          set.name +
          "»<small>может выпасть: " +
          set.items.length +
          " " +
          (set.items.length < 5 ? "вещи" : "вещей") +
          '</small></h3><div class="boss-items">' +
          set.items
            .map(
              (it, j) =>
                '<figure title="' +
                it +
                '"><img src="assets/bosses/' +
                set.img +
                "-" +
                (j + 1) +
                '.webp" alt="' +
                it +
                " «" +
                set.name +
                '»" width="236" height="236" loading="lazy" decoding="async"><figcaption>' +
                it +
                "</figcaption></figure>"
            )
            .join("") +
          "</div></div>"
      : /* без комплекта карточка не короче остальных и не выглядит недоделанной */
        '<div class="' +
          cls +
          ' boss-set-none"><h3>Комплект</h3><div class="boss-req boss-req-none">Комплект с этого босса не выпадает</div></div>';
  }
  function bossCard(b, i) {
    const r = b.reward,
      card = CARDS[r.card];
    const loot =
      '<li class="boss-loot-card" style="--c:' +
      card.color +
      '"><i class="res-ico">' +
      cardIcon(r.card) +
      "</i><b>+1</b><span>" +
      card.one +
      "</span></li>" +
      ["exp", "bullets", "tokens", "rep"]
        .filter(k => r[k])
        .map(k => lootItem(RES[k].icon, RES[k].cls, r[k], RES[k].label))
        .join("");
    const req = b.req
      ? '<div class="boss-req" style="--c:' +
        CARDS[b.req].color +
        '"><b>3</b><i class="res-ico">' +
        cardIcon(b.req) +
        "</i><span>" +
        CARDS[b.req].many +
        " - с босса «" +
        BOSSES[i - 1].name +
        "»</span></div>"
      : '<div class="boss-req boss-req-none">Нет - бой доступен сразу</div>';
    const set = setBlock(b.set);
    return (
      '<article class="boss-card" data-boss="' +
      b.key +
      '"><div class="boss-art"><video class="boss-video" muted loop playsinline disablepictureinpicture preload="none" width="512" height="320" poster="assets/bosses/' +
      b.key +
      '.webp" aria-hidden="true"><source src="assets/bosses/' +
      b.key +
      '.mp4" type="video/mp4"><source src="assets/bosses/' +
      b.key +
      '.webm" type="video/webm"></video><span class="boss-num">' +
      (i + 1) +
      '</span><h2 class="boss-name">' +
      b.name +
      '</h2></div><div class="boss-hp"><span>Здоровье</span><b>' +
      n0(b.hp) +
      ' <small>HP</small></b></div><div class="boss-block"><h3>Требования</h3>' +
      req +
      '</div><div class="boss-block"><h3>Награда</h3><ul class="boss-loot">' +
      loot +
      "</ul></div>" +
      set +
      "</article>"
    );
  }

  function rewardTable(rows) {
    return (
      '<div class="boss-block boss-event-rewards"><h3>Награда по месту<small>после победы над боссом</small></h3>' +
      '<div class="boss-reward-scroll"><table class="boss-reward-table" role="table"><caption class="sr-only">Награды ивентового босса «' +
      EVENT.name +
      '» по занятому месту</caption><thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Место</th><th scope="col" role="columnheader">Опыт</th><th scope="col" role="columnheader">Жетоны</th><th scope="col" role="columnheader">ПДА</th><th scope="col" role="columnheader">Ключ</th><th scope="col" role="columnheader">Доп.</th><th scope="col" role="columnheader">Сет</th></tr></thead><tbody role="rowgroup">' +
      rows
        .map(
          r =>
            '<tr role="row"' +
            (/^[123]$/.test(r.place) ? ' class="boss-place-' + r.place + '"' : "") +
            '><th scope="row" role="rowheader">' +
            placeMark(r.place) +
            "</th>" +
            rewardCell(
              "Опыт",
              rewardValue(RES.exp.icon, n0(r.exp), "Опыт: " + n0(r.exp), "exp"),
              "Опыт: " + n0(r.exp)
            ) +
            rewardCell(
              "Жетоны",
              rewardValue(RES.tokens.icon, r.tokens, "Жетоны: " + r.tokens, "tok"),
              "Жетоны: " + r.tokens
            ) +
            rewardCell(
              "ПДА",
              r.pda ? rewardValue(PDA_ICO, r.pda, "Взломы ПДА: " + r.pda, "pda") : dash,
              "Взломы ПДА: " + (r.pda || "нет")
            ) +
            rewardCell(
              "Ключ",
              r.key
                ? rewardValue(
                    cardIcon(r.key),
                    "×" + r.keyCount,
                    CARDS[r.key].one + ": ×" + r.keyCount,
                    "key",
                    CARDS[r.key].color
                  )
                : dash,
              r.key ? CARDS[r.key].one + ": ×" + r.keyCount : "Ключ: нет"
            ) +
            rewardCell(
              "Доп.",
              r.extra
                ? rewardValue(
                    EXTRA[r.extra].icon,
                    "×" + r.extraCount,
                    EXTRA[r.extra].name + ": ×" + r.extraCount,
                    r.extra
                  )
                : dash,
              r.extra ? EXTRA[r.extra].name + ": ×" + r.extraCount : "Дополнительно: нет"
            ) +
            rewardCell(
              "Сет",
              rewardValue(VEST_ICO, r.set + "%", "Шанс комплекта: " + r.set + "%", "set"),
              "Шанс комплекта: " + r.set + "%"
            ) +
            "</tr>"
        )
        .join("") +
      '</tbody></table></div><p class="boss-reward-note">Ключ - карточка босса указанного цвета, Доп. - граната, выстрел Гаусса или гранатомёта. Сет - шанс получить вещь комплекта «Пятничный вечер».</p></div>'
    );
  }
  const sRow = (k, v, cls) =>
    '<div class="boss-event-schedule-row"><span>' +
    k +
    "</span><b" +
    (cls ? ' class="' + cls + '"' : "") +
    ">" +
    v +
    "</b></div>";
  function eventBody(ended) {
    const e = EVENT,
      last = EVENT_SPAWNS[EVENT_SPAWNS.length - 1];
    return (
      '<div class="boss-event-body"><div class="boss-event-main"><div class="boss-hp"><span>Здоровье</span><b>' +
      n0(e.hp) +
      ' <small>HP</small></b></div><div class="boss-block boss-event-when"><h3>' +
      (ended ? "Когда был" : "Когда появляется") +
      "</h3>" +
      (ended
        ? ""
        : '<div class="boss-event-count" data-event-countdown aria-hidden="true"><span class="boss-event-count-label">До появления</span><b data-event-countdown-val>--:--:--</b></div>') +
      '<div class="boss-event-schedule">' +
      sRow("Появление", "2 раза в день") +
      sRow("Время", EVENT_TIME, "boss-event-time") +
      sRow("Доступен", EVENT_RANGE, "boss-event-date") +
      (ended ? sRow("Завершилось", ruDay(last) + " в " + ruTime(last)) : "") +
      '</div></div><div class="boss-block"><h3>' +
      (ended ? "Как проходил бой" : "Как проходит бой") +
      '</h3><ul class="boss-event-rules"><li>Здоровье общее: урон всех игроков идёт в один счётчик</li><li>Место - по личному урону</li><li>Награда - после победы; побег лишает награды</li></ul></div><div class="boss-block"><h3>Требования</h3><div class="boss-req boss-req-none">' +
      (ended ? "Бой был доступен только в дни события" : "Бой доступен во время события") +
      "</div></div></div>" +
      rewardTable(e.rewards) +
      setBlock(e.set, "boss-event-set") +
      "</div>"
    );
  }
  function eventCard() {
    const e = EVENT;
    if (!EVENT_ENDED)
      return (
        '<article class="boss-card boss-event" data-boss="' +
        e.key +
        '"><div class="boss-art boss-event-art"><video class="boss-video" muted loop playsinline disablepictureinpicture preload="none" width="1856" height="800" poster="assets/bosses/' +
        e.key +
        '.webp" aria-hidden="true"><source src="assets/bosses/' +
        e.key +
        '.webm" type="video/webm"></video><span class="boss-event-badge"><img src="assets/halloween/pumpkin-artifact.webp" alt="" width="16" height="20" loading="lazy" decoding="async">Хэллоуин · временный</span>' +
        '<h2 class="boss-name">' +
        e.name +
        "</h2></div>" +
        eventBody(false) +
        "</article>"
      );
    /* событие закончилось: карточка - одна строка, подробности под спойлером, видео не грузим */
    const more =
      '<span class="boss-event-sum-more"><span class="boss-event-sum-more-text">Подробности</span>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span>';
    return (
      '<details class="boss-card boss-event is-ended" data-boss="' +
      e.key +
      '"><summary class="boss-event-sum"><img class="boss-event-sum-art" src="assets/bosses/' +
      e.key +
      '.webp" alt="" width="96" height="60" loading="lazy" decoding="async"><h2 class="boss-event-sum-name">' +
      e.name +
      '</h2><span class="boss-event-sum-state">событие завершено · босс недоступен</span>' +
      more +
      "</summary>" +
      eventBody(true) +
      "</details>"
    );
  }

  /* обратный отсчёт до ближайшего появления: расписание то же, что в подписях карточки (EVENT_SPAWNS) */
  function startEventCountdown() {
    const box = root.querySelector("[data-event-countdown]");
    if (!box) return;
    const label = box.querySelector(".boss-event-count-label"),
      val = box.querySelector("[data-event-countdown-val]");
    const spawns = EVENT_SPAWNS;
    const pad = n => String(n).padStart(2, "0");
    function tick() {
      const now = Date.now();
      if (now >= EVENT_END) {
        label.textContent = "Событие завершилось";
        val.textContent = "—";
        if (box.classList && box.classList.remove) box.classList.remove("is-now");
        return;
      }
      const recent = spawns.filter(t => t <= now).pop();
      if (recent && now - recent < 60000) {
        label.textContent = "Босс появился";
        val.textContent = "сейчас";
        if (box.classList && box.classList.add) box.classList.add("is-now");
        return;
      }
      const next = spawns.find(t => t > now);
      if (!next) {
        label.textContent = "Событие завершается";
        val.textContent = "—";
        if (box.classList && box.classList.remove) box.classList.remove("is-now");
        return;
      }
      const diff = next - now,
        h = Math.floor(diff / 3600000),
        m = Math.floor(diff / 60000) % 60,
        s = Math.floor(diff / 1000) % 60,
        days = Math.floor(h / 24);
      label.textContent = "До появления";
      val.textContent = days ? days + "д " + pad(h % 24) + ":" + pad(m) : pad(h) + ":" + pad(m) + ":" + pad(s);
      if (box.classList && box.classList.remove) box.classList.remove("is-now");
    }
    tick();
    if (typeof setInterval === "function") setInterval(tick, 1000);
  }

  const root = document.getElementById("bossesRoot");
  if (root)
    root.innerHTML =
      '<div class="bosses-grid">' +
      BOSSES.map(bossCard).join("") +
      eventCard() +
      '</div><p class="damage-footnote">Боссы идут по цепочке: с каждого падает ключ, а три таких ключа открывают бой со следующим. Ивентовый босс не входит в цепочку - он ' +
      (EVENT_ENDED ? "выходил" : "появляется") +
      " по расписанию Хэллоуинского события (" +
      EVENT_RANGE +
      "). Значок бронежилета в награде в игре - вещи комплекта, которые могут выпасть с босса.</p>";
  if (root) startEventCountdown();
  /* анимация из игры играет, только пока карточка на экране; при «уменьшить движение» остаётся кадр-заставка.
     Играет каждое видимое видео (четверть карточки и больше), скрытые - на паузе: preload="none" не даёт
     браузеру тянуть mp4/webm невидимых карточек, так что трафик - только за то, что реально на экране. */
  const still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (root && !still && typeof IntersectionObserver === "function") {
    const vids = [...root.querySelectorAll(".boss-video")],
      ratio = new Map();
    const sync = () => {
      vids.forEach(v => {
        if ((ratio.get(v) || 0) >= 0.25) {
          const p = v.play();
          if (p && p.catch) p.catch(() => {});
        } else v.pause();
      });
    };
    const io = new IntersectionObserver(
      es => {
        es.forEach(e => ratio.set(e.target, e.isIntersecting ? e.intersectionRatio : 0));
        sync();
      },
      { threshold: [0, 0.25, 0.5, 0.75] }
    );
    vids.forEach(v => io.observe(v));
  }
})();
