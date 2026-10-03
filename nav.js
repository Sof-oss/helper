/* Активный пункт меню может оказаться за краем на узком экране: центрируем его,
   не трогая прокрутку страницы (scrollIntoView крутил бы и документ) */
(() => {
  const nav = document.querySelector('.main-nav');
  const a = nav && nav.querySelector('a.active');
  if (a) nav.scrollLeft = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
})();
