/* Навигация: активный пункт меню и нижние вкладки на телефоне. */
/* У страницы два адреса: /calculator и /calculator.html (так отдаёт GitHub Pages). */
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

(() => {
  let s = null;
  try {
    s = localStorage.getItem("gameHelperInfoSection");
  } catch (e) {}
  const url = { tasks: "/info-tasks", bosses: "/info-bosses" }[s];
  if (!url) return;
  document
    .querySelectorAll('.main-nav a[href="/info"], .tabbar-more a[href="/info"]')
    .forEach(a => a.setAttribute("href", url));
})();

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
