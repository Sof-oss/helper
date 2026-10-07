/* Тур для новичков на главной: кнопка #tourStart открывает окно с короткими шагами по разделам.
   Само окно не всплывает: пока тур ни разу не открывали, кнопка подсвечена (класс is-new, ключ zoneTourSeen в localStorage).
   Шаги правятся в STEPS ниже: заголовок, текст, список возможностей, ссылка на раздел и цвет (те же, что у карточек главной). */
(function () {
  "use strict";
  var KEY = "zoneTourSeen";
  var STEPS = [
    { icon: "☢\uFE0E", color: "#e0b83a", title: "Добро пожаловать в Зону",
      text: "Это неофициальный помощник для игры «Сердце Зоны». За минуту покажем, что тут есть и зачем.",
      list: ["Регистрация не нужна — всё работает сразу", "Сайт удобно открывать и с телефона", "Данные игроков регулярно обновляются из игры"] },
    { icon: "◎", color: "#54bfff", title: "Калькулятор урона", href: "/calculator", cta: "Открыть калькулятор",
      text: "Посчитайте, сколько урона даёт каждое оружие именно вашему персонажу.",
      list: ["Укажите уровень, отметьте комплекты и вещи, распределите таланты", "Кнопка «Бонусы» покажет, что даёт каждый предмет", "Поделитесь ссылкой на свой билд или сравните его с чужим"] },
    { icon: "★", color: "#9fdc9f", title: "Топ-100 и карточки игроков", href: "/top100", cta: "Открыть Топ-100",
      text: "Лучшие сталкеры по семи рейтингам: репутация, боссы, тайники, таланты, коллекции, экспедиции и защита лагеря.",
      list: ["Найдите себя или друга поиском по нику", "В личной карточке — все показатели игрока и оформление его группировки", "Выберите период — и увидите, кто вырос и на сколько мест"] },
    { icon: "▤", color: "#ffb74d", title: "Информация", href: "/info", cta: "Открыть «Информацию»",
      text: "Справочник, который в игре не показывают целиком.",
      list: ["Сколько стоит каждое улучшение таланта", "Опыт ПДА и персонажа по уровням и ваш прогресс", "Награды за задания по локациям"] },
    { icon: "✉", color: "#c9a6ff", title: "Гайды", href: "/guides", cta: "Открыть гайды",
      text: "Советы от опытных игроков: прохождение локаций, билды, боссы.",
      list: ["Новичкам — начните с гайдов для старта", "Знаете фишку? Напишите и отправьте свой гайд прямо на сайте"] },
    { icon: "⚑", color: "#5f8ac9", title: "Ваша группировка",
      text: "Оформление сайта можно перекрасить в цвета своей группировки — переключатель тем в шапке сайта.",
      list: ["Долг, Свобода, Монолит, Учёные, Наёмники, «Рассвет» и Вольные сталкеры", "Выбор запоминается на этом устройстве", "Что появилось на сайте — в блоке «Что нового» на главной"] }
  ];
  var btn = document.getElementById("tourStart");
  if (!btn) return;
  var seen = false;
  try { seen = localStorage.getItem(KEY) === "1"; } catch (e) {}
  if (!seen) btn.classList.add("is-new");

  var dlg, i = 0;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function build() {
    dlg = document.createElement("dialog");
    dlg.className = "tour";
    dlg.setAttribute("aria-labelledby", "tourTitle");
    dlg.innerHTML =
      '<div class="tour-box">' +
      '<button type="button" class="tour-close" data-tour="close" aria-label="Закрыть тур"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>' +
      '<div class="tour-step" aria-live="polite"></div>' +
      '<div class="tour-foot">' +
      '<div class="tour-dots" role="tablist" aria-label="Шаги тура">' + STEPS.map(function (s, n) { return '<button type="button" role="tab" data-tour-go="' + n + '" aria-label="Шаг ' + (n + 1) + ': ' + esc(s.title) + '"></button>'; }).join("") + '</div>' +
      '<div class="tour-nav"><button type="button" class="tour-btn ghost" data-tour="prev">Назад</button><button type="button" class="tour-btn" data-tour="next">Далее</button></div>' +
      '</div></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) return close();
      var a = e.target.closest("[data-tour]"), g = e.target.closest("[data-tour-go]");
      if (g) return show(+g.getAttribute("data-tour-go"));
      if (!a) return;
      var k = a.getAttribute("data-tour");
      if (k === "close") close();
      else if (k === "prev") show(i - 1);
      else if (k === "next") { if (i < STEPS.length - 1) show(i + 1); else close(); }
    });
    dlg.addEventListener("keydown", function (e) {
      if (e.target.closest && e.target.closest("a")) return;
      if (e.key === "ArrowRight" && i < STEPS.length - 1) { e.preventDefault(); show(i + 1); }
      if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); show(i - 1); }
    });
    dlg.addEventListener("close", function () { btn.focus(); });
  }
  function show(n) {
    i = Math.max(0, Math.min(STEPS.length - 1, n));
    var s = STEPS[i], last = i === STEPS.length - 1;
    dlg.style.setProperty("--tour-ac", s.color);
    dlg.querySelector(".tour-step").innerHTML =
      '<div class="tour-head"><span class="tour-ic" aria-hidden="true">' + s.icon + '</span><div><small>Шаг ' + (i + 1) + ' из ' + STEPS.length + '</small><h2 id="tourTitle">' + esc(s.title) + '</h2></div></div>' +
      '<p>' + esc(s.text) + '</p>' +
      (s.list ? '<ul>' + s.list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>' : "") +
      (s.href ? '<a class="tour-link" href="' + s.href + '">' + esc(s.cta) + ' →</a>' : "");
    Array.prototype.forEach.call(dlg.querySelectorAll("[data-tour-go]"), function (d, n) { d.setAttribute("aria-selected", n === i ? "true" : "false"); });
    dlg.querySelector('[data-tour="prev"]').disabled = i === 0;
    dlg.querySelector('[data-tour="next"]').textContent = last ? "Готово" : "Далее";
  }
  function open() {
    if (!dlg) build();
    show(0);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    dlg.querySelector('[data-tour="next"]').focus();
    btn.classList.remove("is-new");
    try { localStorage.setItem(KEY, "1"); } catch (e) {}
  }
  function close() { if (dlg.close) dlg.close(); else { dlg.removeAttribute("open"); btn.focus(); } }
  btn.addEventListener("click", open);
  if (location.hash === "#tour") open();
})();
