/* Активный пункт меню может оказаться за краем на узком экране: центрируем его,
   не трогая прокрутку страницы (scrollIntoView крутил бы и документ) */
(() => {
  const nav = document.querySelector('.main-nav');
  const a = nav && nav.querySelector('a.active');
  if (a) nav.scrollLeft = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
})();

/* У страницы два адреса: /calculator и /calculator.html (так отдаёт GitHub Pages). Если открыли старый адрес
   с .html, без перезагрузки меняем его в строке браузера на канонический — тогда и «Ссылка на билд»,
   и закладки получаются с коротким адресом. Хвост ?… и #… (билд) сохраняется. На 404 canonical нет — не трогаем */
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
