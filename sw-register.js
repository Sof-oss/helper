/* Регистрация service worker (sw.js): сайт работает без сети и ставится как приложение.
   build.js подключает этот файл и manifest.webmanifest на каждую страницу. На http (кроме localhost) и в
   пререндере сборки (заглушка DOM) ничего не делает */
(function () {
  "use strict";
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) return;
  const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
})();
