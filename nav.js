/* Активный пункт меню может оказаться за краем на узком экране: центрируем его,
   не трогая прокрутку страницы (scrollIntoView крутил бы и документ) */
(() => {
  const nav = document.querySelector(".main-nav");
  const a = nav && nav.querySelector("a.active");
  if (a) nav.scrollLeft = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
})();

/* У страницы два адреса: /calculator и /calculator.html (так отдаёт GitHub Pages). Если открыли старый адрес
   с .html, без перезагрузки меняем его в строке браузера на канонический - тогда и «Ссылка на билд»,
   и закладки получаются с коротким адресом. Хвост ?… и #… (билд) сохраняется. На 404 canonical нет - не трогаем */
(() => {
  const c = document.querySelector('link[rel="canonical"]');
  if (!c || !history.replaceState) return;
  try {
    const url = new URL(c.href);
    if (url.origin === location.origin && url.pathname !== location.pathname) {
      history.replaceState(history.state, "", url.pathname + location.search + location.hash);
    }
  } catch (e) {}
})();

/* Пункт меню «Информация» ведёт в раздел, который открывали последним: /info-tasks или /info-bosses
   (info-tasks.js запоминает его в gameHelperInfoSection). Прямые ссылки на /info это не меняет */
(() => {
  let s = null;
  try {
    s = localStorage.getItem("gameHelperInfoSection");
  } catch (e) {}
  const url = { tasks: "/info-tasks", bosses: "/info-bosses" }[s];
  if (!url) return;
  document
    .querySelectorAll('.main-nav a[href="/info"], .tabbar a[href="/info"]')
    .forEach(a => a.setAttribute("href", url));
})();
