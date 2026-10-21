/* «Новости Зоны» на главной: короткие новости игры со ссылкой на пост в группе ВК.
   Как добавить новость: вставьте строку В НАЧАЛО списка (самая свежая - первая) и сохраните файл.
   date  - дата в формате ГГГГ-ММ-ДД
   title - короткий заголовок (до ~60 символов)
   text  - пара слов о сути (до ~120 символов)
   url   - ссылка на пост ВК (кнопка «Читать в ВК»); можно не указывать - тогда кнопки нет
   promo, promoUrl - промокод из текста и ссылка на него: код в тексте станет кликабельным; можно не указывать
   points - список подробностей под текстом (строки); можно не указывать
   shots - скриншоты под новостью, по клику открываются крупно: [{ src: "/assets/news/…webp", thumb: "/assets/news/…-480.webp",
           alt: "подпись" }]; thumb можно не указывать
   event - баннер над новостью: "halloween" (ивент), "update" (слухи об обновлении), "release" (обновление вышло),
           "update-halloween" (слухи об обновлении к Хэллоуину)
           или "giveaway" (розыгрыш); можно не указывать
   На главной видно 3 последние новости: первая целиком, следующие две - строкой (дата и заголовок),
   остальные - по кнопке «Все новости». */
window.ZONE_NEWS = [
  {
    date: "2026-10-20",
    title: "Слухи: обновление к Хэллоуину",
    text: "Наш шпион под кодовым именем «Птичка-1» раскопал для вас порцию информации о грядущем обновлении: ивентовый босс, хэллоуинский сет вещей и пачка исправлений. Выход - к выходным, если разработчики успеют",
    points: [
      "Хэллоуинский босс - раз в сутки на протяжении 14 дней, с повышенным шансом выпадения хэллоуинского сета",
      "Арена: чем больше прокачано характеристик, тем больше награда за победу (по слухам, разница с теми, кто характеристики не качает вовсе, будет ещё ощутимее); абуз со 100% победами без характеристик исправят",
      "Характеристики будут давать прибавку к урону по боссам (зависит от суммы всех характеристик)",
      "Оборону лагеря переработают - по словам разработчиков, ей не хватает динамики"
    ],
    shots: [
      {
        src: "/assets/news/2026-10-20-stats.webp",
        thumb: "/assets/news/2026-10-20-stats-480.webp",
        alt: "Характеристики сталкера и прибавка к урону по боссам"
      },
      {
        src: "/assets/news/2026-10-20-map.webp",
        thumb: "/assets/news/2026-10-20-map-480.webp",
        alt: "Кадр от разработчиков: карта локации"
      }
    ],
    event: "update-halloween"
  },
  {
    date: "2026-10-14",
    title: "Нас уже 3 000! Розыгрыш жетонов",
    text: "7 случайных сталкеров получат по 400 жетонов: лайк и репост поста. Итоги - 14 ноября",
    url: "https://vk.ru/wall-239092289_278",
    event: "giveaway"
  },
  {
    date: "2026-10-11",
    title: "Вышло обновление: Арена и характеристики сталкера",
    text: "Бои на Арене раз в час, прокачка характеристик за консервы, широкоформатный режим и промокод ARENA2026",
    url: "https://vk.ru/wall-239092289_274",
    promo: "ARENA2026",
    promoUrl: "https://vk.ru/app54612839#promo=ARENA2026",
    event: "release"
  },
  {
    date: "2026-10-09",
    title: "Скоро Хэллоуин в Зоне",
    text: "Готовится осенний ивент ко Дню всех святых - следите за анонсами",
    event: "halloween"
  },
  {
    date: "2026-09-28",
    title: "Крупное обновление: карта Зоны и влияние группировок",
    text: "Уровни и улучшения группировок, новая страница «Лагерь», мастерская и промокод в честь обновления",
    url: "https://vk.ru/wall-239092289_261"
  },
  {
    date: "2026-09-28",
    title: "Охота на мутантов: итоги рейда Наёмников и Долга",
    text: "Более 4 млн урона, свыше 1500 уничтоженных мутантов и Топ-30 сталкеров по урону",
    url: "https://vk.ru/wall-239092289_262"
  }
];

(function () {
  const root = document.getElementById("zoneNews");
  const list = Array.isArray(window.ZONE_NEWS) ? window.ZONE_NEWS.filter(n => n && n.title) : [];
  if (!root || !list.length) return;
  const FULL = 1,
    SHOW = 3,
    FRESH_DAYS = 3;
  const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmt = d => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || "");
    return m ? +m[3] + " " + MONTHS[m[2] - 1] : esc(d || "");
  };
  const now = Date.now();
  const fresh = d => {
    const t = Date.parse(d);
    return t && now - t < FRESH_DAYS * 864e5 && t <= now + 864e5;
  };
  const EVENTS = {
    halloween:
      '<div class="zn-event" aria-hidden="true"><img src="assets/event-halloween-600.webp" srcset="assets/event-halloween-600.webp 600w, assets/event-halloween-1200.webp 1200w" sizes="(max-width: 760px) 92vw, 460px" width="1200" height="375" alt="" loading="lazy" decoding="async"><span class="zn-ev-eye zn-ev-l"></span><span class="zn-ev-eye zn-ev-r"></span><span class="zn-ev-izlom"><img src="assets/event-izlom-shadow.webp" width="366" height="320" alt="" loading="lazy" decoding="async"><i class="zn-ev-ie zn-ev-ie1"></i><i class="zn-ev-ie zn-ev-ie2"></i></span><span class="zn-ev-soon">Скоро</span></div>',
    /* слухи об обновлении: картинка-баннер и метка «Слухи», мигающая точка как у рации */
    update:
      '<div class="zn-event zn-ev-update" aria-hidden="true"><img src="/assets/event-update-600.webp" srcset="/assets/event-update-600.webp 600w, /assets/event-update-1200.webp 1200w" sizes="(max-width: 760px) 92vw, 460px" width="1200" height="375" alt="" loading="lazy" decoding="async"><span class="zn-ev-soon"><i class="zn-ev-dot"></i>Слухи</span></div>',
    /* обновление вышло: та же картинка, метка «Вышло» зелёного цвета */
    release:
      '<div class="zn-event zn-ev-update zn-ev-release" aria-hidden="true"><img src="/assets/event-update-600.webp" srcset="/assets/event-update-600.webp 600w, /assets/event-update-1200.webp 1200w" sizes="(max-width: 760px) 92vw, 460px" width="1200" height="375" alt="" loading="lazy" decoding="async"><span class="zn-ev-soon"><i class="zn-ev-dot"></i>Вышло</span></div>',
    /* слухи об обновлении к Хэллоуину: ивентовый босс в болотной деревне, метка «Слухи» */
    "update-halloween":
      '<div class="zn-event zn-ev-update" aria-hidden="true"><img src="/assets/event-update-halloween-600.webp" srcset="/assets/event-update-halloween-600.webp 600w, /assets/event-update-halloween-1200.webp 1200w" sizes="(max-width: 760px) 92vw, 460px" width="1200" height="375" alt="" loading="lazy" decoding="async"><span class="zn-ev-soon"><i class="zn-ev-dot"></i>Слухи</span></div>',
    /* розыгрыш: сталкеры у костра и кейс с жетонами, золотая метка «Розыгрыш» */
    giveaway:
      '<div class="zn-event zn-ev-giveaway" aria-hidden="true"><img src="/assets/event-giveaway-600.webp" srcset="/assets/event-giveaway-600.webp 600w, /assets/event-giveaway-1200.webp 1200w" sizes="(max-width: 760px) 92vw, 460px" width="1200" height="375" alt="" loading="lazy" decoding="async"><span class="zn-ev-soon"><i class="zn-ev-dot"></i>Розыгрыш</span></div>'
  };
  /* промокод в тексте - ссылка, по которой он активируется в игре */
  const promo = n => {
    const t = esc(n.text);
    if (!n.promo || !n.promoUrl) return t;
    const code = esc(n.promo);
    return t
      .split(code)
      .join(
        '<a class="zn-promo" href="' +
          esc(n.promoUrl) +
          '" target="_blank" rel="noopener noreferrer" title="Активировать промокод в игре">' +
          code +
          "</a>"
      );
  };
  /* скриншоты: превью в ряд, по клику - крупно в окне просмотра (ниже) */
  const shotList = n => (Array.isArray(n.shots) ? n.shots.filter(s => s && s.src) : []);
  const shots = n => {
    const list = shotList(n);
    if (!list.length) return "";
    return (
      '<div class="zn-shots">' +
      list
        .map(
          (s, k) =>
            '<button type="button" class="zn-shot" data-src="' +
            esc(s.src) +
            '" data-alt="' +
            esc(s.alt || "") +
            '" data-k="' +
            k +
            '" aria-label="Открыть скриншот' +
            (s.alt ? ": " + esc(s.alt) : "") +
            '"><img src="' +
            esc(s.thumb || s.src) +
            '" alt="' +
            esc(s.alt || "") +
            '" loading="lazy" decoding="async"><span class="zn-shot-zoom" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.3-4.3M11 8v6M8 11h6"/></svg></span></button>'
        )
        .join("") +
      "</div>"
    );
  };
  const item = (n, i) =>
    '<li class="zn-item' +
    (i >= SHOW ? " zn-more" : i >= FULL ? " zn-compact" : "") +
    '">' +
    (EVENTS[n.event] || "") +
    '<div class="zn-meta"><time datetime="' +
    esc(n.date) +
    '">' +
    fmt(n.date) +
    "</time>" +
    (fresh(n.date) ? '<span class="zn-new">NEW</span>' : "") +
    "</div>" +
    '<b class="zn-title">' +
    esc(n.title) +
    "</b>" +
    (n.text ? '<p class="zn-text">' + promo(n) + "</p>" : "") +
    (Array.isArray(n.points) && n.points.length
      ? '<ul class="zn-points">' + n.points.map(p => "<li>" + esc(p) + "</li>").join("") + "</ul>"
      : "") +
    shots(n) +
    (n.url
      ? '<a class="zn-link" href="' +
        esc(n.url) +
        '" target="_blank" rel="noopener noreferrer">Читать в ВК<span class="sr-only">: ' +
        esc(n.title) +
        "</span>" +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a>'
      : "") +
    "</li>";
  root.innerHTML =
    '<div class="news-title"><span class="news-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 13v8M9 21h6"/><circle cx="12" cy="11" r="2"/><path d="M8.5 7.5a5 5 0 0 0 0 7M15.5 7.5a5 5 0 0 1 0 7M5.6 4.6a9 9 0 0 0 0 12.8M18.4 4.6a9 9 0 0 1 0 12.8"/></svg></span><h2>Новости Зоны</h2></div>' +
    '<ol class="zn-list" id="zoneNewsList">' +
    list.map(item).join("") +
    "</ol>" +
    (list.length > SHOW
      ? '<button type="button" class="news-toggle zn-toggle" aria-expanded="false" aria-controls="zoneNewsList"><span>Все новости</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>'
      : "");
  const btn = root.querySelector ? root.querySelector(".zn-toggle") : null;
  if (btn && btn.addEventListener)
    btn.addEventListener("click", () => {
      const open = root.classList.toggle("open");
      btn.setAttribute("aria-expanded", open);
      btn.querySelector("span").textContent = open ? "Свернуть" : "Все новости";
    });

  /* окно просмотра скриншота: Esc или клик мимо картинки - закрыть, стрелки - соседний скриншот этой новости */
  if (!root.addEventListener || !document.createElement) return;
  let box = null,
    group = [],
    at = 0;
  const show = k => {
    at = (k + group.length) % group.length;
    const b = group[at];
    const img = box.querySelector("img");
    img.src = b.dataset.src;
    img.alt = b.dataset.alt;
    box.querySelector(".zn-lb-cap").textContent =
      b.dataset.alt + (group.length > 1 ? "  ·  " + (at + 1) + " / " + group.length : "");
    box.classList.toggle("zn-lb-single", group.length < 2);
  };
  const make = () => {
    box = document.createElement("dialog");
    box.className = "zn-lightbox";
    box.setAttribute("aria-label", "Скриншот");
    box.innerHTML =
      '<figure><img alt=""><figcaption class="zn-lb-cap"></figcaption></figure>' +
      '<button type="button" class="zn-lb-btn zn-lb-close" aria-label="Закрыть"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
      '<button type="button" class="zn-lb-btn zn-lb-prev" aria-label="Предыдущий скриншот"><svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg></button>' +
      '<button type="button" class="zn-lb-btn zn-lb-next" aria-label="Следующий скриншот"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></button>';
    document.body.appendChild(box);
    box.addEventListener("click", e => {
      if (e.target.closest(".zn-lb-prev")) show(at - 1);
      else if (e.target.closest(".zn-lb-next")) show(at + 1);
      else if (e.target.closest(".zn-lb-close") || !e.target.closest("img")) box.close();
    });
    box.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft") show(at - 1);
      if (e.key === "ArrowRight") show(at + 1);
    });
  };
  root.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest(".zn-shot");
    if (!b) return;
    if (!box) make();
    group = [...b.parentNode.querySelectorAll(".zn-shot")];
    show(+b.dataset.k);
    if (box.showModal) box.showModal();
    else box.setAttribute("open", "");
  });
})();
