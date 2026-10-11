"use strict";
/* Страница «Группировки»: карточки уже в HTML (build-factions.js), здесь поиск и фильтр «Только с набором»;
   карточки игроков из составов открывает player-card.js (ссылки с data-pc-open).
   Поиск ищет и по названию группировки, и по нику бойца: у найденного бойца раскрывается состав и он подсвечивается */
(function () {
  /* версия выгрузки игроков (build.js кладёт её в <main data-history>): карточка игрока (player-card.js) берёт
     top100-players.json по тому же адресу, что и Топ-100, - файл из кэша, а не второй раз */
  var main = document.getElementById("main");
  if (main && main.dataset.history && !window.TOP100_HISTORY) window.TOP100_HISTORY = { id: main.dataset.history };
  var input = document.getElementById("fxSearch"),
    hiring = document.getElementById("fxHiring"),
    empty = document.getElementById("fxEmpty");
  if (!input) return;
  var cards = [].slice.call(document.querySelectorAll(".fx-card"));
  var norm = function (s) {
    return String(s || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .trim();
  };
  function apply() {
    var q = norm(input.value),
      onlyHiring = hiring && hiring.checked,
      shown = 0;
    cards.forEach(function (card) {
      var byName = !q || norm(card.dataset.name).indexOf(q) >= 0,
        hit = false;
      [].forEach.call(card.querySelectorAll(".fx-roster li"), function (li) {
        var a = li.querySelector("a"),
          m = !!q && !byName && norm(a && a.textContent).indexOf(q) >= 0;
        li.classList.toggle("fx-hit", m);
        if (m) hit = true;
      });
      var ok = (byName || hit) && (!onlyHiring || card.classList.contains("fx-hiring"));
      card.hidden = !ok;
      var det = card.querySelector(".fx-roster");
      if (det && hit) det.open = true;
      if (ok) shown++;
    });
    if (empty) empty.hidden = shown > 0;
  }
  input.addEventListener("input", apply);
  if (hiring) hiring.addEventListener("change", apply);
  /* переход по ссылке /factions#f-dolg - сразу к карточке и с открытым составом */
  var target = location.hash && document.getElementById(location.hash.slice(1));
  if (target && target.classList.contains("fx-card")) {
    var d = target.querySelector(".fx-roster");
    if (d) d.open = true;
  }
  if (input.value || (hiring && hiring.checked)) apply();
})();
