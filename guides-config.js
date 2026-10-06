/* Приём гайдов из формы «Отправить свой гайд» (guides.html).
   endpoint — адрес Cloudflare Worker из worker/guide-submit.js, turnstileSiteKey — ключ сайта Cloudflare Turnstile
   (защита от ботов). Как получить оба значения — worker/README.md. Пока поля пустые, форма показывает
   предпросмотр, но отправка выключена */
window.GUIDES_CONFIG = {
  endpoint: "https://functions.yandexcloud.net/d4e3plqqirekgiv5cipk",
  turnstileSiteKey: "0x4AAAAAAFPDCyvcRUwYmyEm"
};
