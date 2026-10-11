/* «Новости Зоны» на главной: короткие новости игры со ссылкой на пост в группе ВК.
   Как добавить новость: вставьте строку В НАЧАЛО списка (самая свежая - первая) и сохраните файл.
   date  - дата в формате ГГГГ-ММ-ДД
   title - короткий заголовок (до ~60 символов)
   text  - пара слов о сути (до ~120 символов)
   url   - ссылка на пост ВК (кнопка «Читать в ВК»); можно не указывать - тогда кнопки нет
   promo, promoUrl - промокод из текста и ссылка на него: код в тексте станет кликабельным; можно не указывать
   event - баннер над новостью: "halloween" (ивент), "update" (слухи об обновлении) или "release" (обновление вышло); можно не указывать
   На главной видно 3 последние новости, остальные - по кнопке «Все новости». */
window.ZONE_NEWS = [
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
  const SHOW = 1,
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
      '<div class="zn-event zn-ev-update zn-ev-release" aria-hidden="true"><img src="/assets/event-update-600.webp" srcset="/assets/event-update-600.webp 600w, /assets/event-update-1200.webp 1200w" sizes="(max-width: 760px) 92vw, 460px" width="1200" height="375" alt="" loading="lazy" decoding="async"><span class="zn-ev-soon"><i class="zn-ev-dot"></i>Вышло</span></div>'
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
  const item = (n, i) =>
    '<li class="zn-item' +
    (i >= SHOW ? " zn-more" : "") +
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
})();
