/* Приём гайдов из формы «Отправить свой гайд» (guides.html).
   endpoint - адрес функции Yandex Cloud (yandex/index.js).
   Защита от ботов: smartcaptchaSiteKey - ключ клиента Yandex SmartCaptcha (основной вариант, работает в России
   без обрывов); если он пустой, используется Cloudflare Turnstile (turnstileSiteKey). Как получить ключи -
   yandex/README.md. Пока нет адреса и ни одного ключа, форма показывает предпросмотр, но отправка выключена */
window.GUIDES_CONFIG = {
  endpoint: "https://functions.yandexcloud.net/d4e3plqqirekgiv5cipk",
  smartcaptchaSiteKey: "",
  turnstileSiteKey: "0x4AAAAAAFPDCyvcRUwYmyEm"
};
