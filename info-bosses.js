/* вкладка «Боссы» на странице «Информация»: здоровье, требования, награды и комплекты, которые могут выпасть.
   Всё в функции, чтобы не пересекаться с $ и fmt из info.js */
(function () {
  "use strict";
  /* карты: босс отдаёт одну карту своего цвета, три такие карты нужны для боя со следующим */
  const CARDS = {
    green: { color: "#3ecf5a", one: "Зелёная карта", many: "зелёные карты" },
    blue: { color: "#4f86f7", one: "Синяя карта", many: "синие карты" },
    purple: { color: "#a565e8", one: "Фиолетовая карта", many: "фиолетовые карты" },
    orange: { color: "#ff9a2e", one: "Оранжевая карта", many: "оранжевые карты" },
    red: { color: "#ec4b4f", one: "Красная карта", many: "красные карты" },
    cyan: { color: "#35c9d6", one: "Бирюзовая карта", many: "бирюзовые карты" }
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
  /* ресурсы награды: подписи и иконки те же, что во вкладке «Задания» */
  const RES = {
    exp: {
      label: "Опыт",
      cls: "exp",
      icon: '<svg class="res-xp" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.2" y="5.2" width="19.6" height="13.6" rx="3.2"/><text x="12" y="16.1" text-anchor="middle">XP</text></svg>'
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
  /* значок карты: белая карточка с цветной полосой, как в игре */
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
    const set = b.set
      ? '<div class="boss-block boss-set"><h3>Комплект «' +
        b.set.name +
        "»<small>может выпасть: " +
        b.set.items.length +
        " " +
        (b.set.items.length < 5 ? "вещи" : "вещей") +
        '</small></h3><div class="boss-items">' +
        b.set.items
          .map(
            (it, j) =>
              '<figure title="' +
              it +
              '"><img src="assets/bosses/' +
              b.set.img +
              "-" +
              (j + 1) +
              '.webp" alt="' +
              it +
              " «" +
              b.set.name +
              '»" width="236" height="236" loading="lazy" decoding="async"><figcaption>' +
              it +
              "</figcaption></figure>"
          )
          .join("") +
        "</div></div>"
      : "";
    return (
      '<article class="boss-card" data-boss="' +
      b.key +
      '"><div class="boss-art"><img src="assets/bosses/' +
      b.key +
      '.webp" alt="' +
      b.name +
      '" width="606" height="438" loading="lazy" decoding="async"><span class="boss-num">' +
      (i + 1) +
      '</span><h3 class="boss-name">' +
      b.name +
      '</h3></div><div class="boss-hp"><span>Здоровье</span><b>' +
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

  const root = document.getElementById("bossesRoot");
  if (root)
    root.innerHTML =
      '<div class="bosses-grid">' +
      BOSSES.map(bossCard).join("") +
      '</div><p class="damage-footnote">Боссы идут по цепочке: с каждого падает карта, а три такие карты открывают бой со следующим. Значок бронежилета в награде в игре - вещи комплекта, которые могут выпасть с босса.</p>';
})();
