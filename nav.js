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

/* вкладки (role="tablist": разделы «Информации», рейтинги Топ-100): стрелки влево/вправо, Home и End
   переводят фокус на соседнюю вкладку и открывают её, как принято для вкладок */
document.addEventListener("keydown", e => {
  const tab = e.target.closest && e.target.closest('[role="tab"]');
  if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  const tabs = [...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
  const i = tabs.indexOf(tab);
  const next =
    e.key === "Home"
      ? tabs[0]
      : e.key === "End"
        ? tabs[tabs.length - 1]
        : tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
  e.preventDefault();
  next.click();
  /* вкладки Топ-100 перерисовываются при смене - фокус ставим на новую кнопку с тем же ключом */
  setTimeout(() => {
    const key = next.dataset.top100Tab || next.dataset.section;
    const fresh = document.querySelector(
      '[role="tab"][data-top100-tab="' + key + '"], [role="tab"][data-section="' + key + '"]'
    );
    (fresh || next).focus();
  }, 60);
});
