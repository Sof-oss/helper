# Приём гайдов: Cloudflare Worker

Форма «Отправить свой гайд» (страница /guides) отправляет гайд сюда. Worker проверяет «я не робот»
(Cloudflare Turnstile) и создаёт в репозитории pull request с файлами `guides/<адрес>/index.md` и картинками.
На сайт гайд попадает только после **Merge**. Всё бесплатно: у Workers и Turnstile хватает бесплатного тарифа.

Настройка — один раз, около 15 минут, всё в браузере.

## 1. Защита от ботов (Turnstile)

1. https://dash.cloudflare.com → **Turnstile** → **Add widget**.
2. Название — любое, **Hostname** — `heart-of-the-zone.ru`, режим **Managed**.
3. Сохраните **Site Key** (открытый, пойдёт в `guides-config.js`) и **Secret Key** (секретный, пойдёт в Worker).

## 2. Токен GitHub

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Repository access** → *Only select repositories* → `Sof-oss/helper`.
3. **Permissions** → *Repository permissions*: **Contents** — Read and write, **Pull requests** — Read and write.
4. Срок действия — на ваше усмотрение (когда истечёт, выпустите новый и замените секрет в Worker).
5. Скопируйте токен (`github_pat_…`).

Токен может только создавать ветки и pull request'ы в этом репозитории; в `main` без вашего Merge ничего не попадает.

## 3. Worker

1. Cloudflare → **Workers & Pages** → **Create** → **Create Worker** (шаблон Hello World), имя, например, `hotz-guides` → **Deploy**.
2. **Edit code** → удалите пример, вставьте целиком `worker/guide-submit.js` → **Deploy**.
3. **Settings** → **Variables and Secrets** → **Add**:
   - `GITHUB_TOKEN` — тип **Secret**, токен из шага 2;
   - `TURNSTILE_SECRET` — тип **Secret**, Secret Key из шага 1;
   - `GITHUB_REPO` — Text, `Sof-oss/helper`;
   - `GITHUB_BRANCH` — Text, `main`;
   - `ALLOWED_ORIGINS` — Text, `https://heart-of-the-zone.ru`.
4. **Settings** → **Domains & Routes** → **Add** → **Custom domain** → `api.heart-of-the-zone.ru`
   (DNS домена уже в Cloudflare, запись создастся сама). Адрес `*.workers.dev` тоже работает,
   но в России он бывает недоступен, свой поддомен надёжнее.

## 4. Включить форму на сайте

В `guides-config.js` впишите адрес Worker и Site Key, закоммитьте:

```js
window.GUIDES_CONFIG = {
  endpoint: "https://api.heart-of-the-zone.ru",
  turnstileSiteKey: "0x4AAAA…"
};
```

## Как проверять и публиковать гайды

Новый гайд — это pull request «Гайд: <заголовок> — <ник>» (вкладка **Pull requests**, метка «гайд»,
если создать такую метку в Issues → Labels). Уведомление приходит на почту владельца репозитория.

- **Посмотреть**: Files changed → `index.md` → «⋯» → View file.
- **Поправить текст или подпись**: там же **Edit file**. Шапка файла:
  ```
  ---
  title: Заголовок гайда
  author: Ник автора
  date: 2026-10-07
  ---
  ```
  `author` — подпись под гайдом (если такой ник есть в Топ-100, подпись станет ссылкой на карточку игрока),
  `description` — можно добавить своё описание для поисковиков и списка гайдов. **Commit changes** — в ту же ветку.
- **Опубликовать**: **Merge pull request** — после сборки (1–2 минуты) гайд появится на /guides и по адресу /guide/<адрес>.
- **Отклонить**: **Close pull request** и Delete branch.
- **Снять с сайта уже опубликованный**: удалить папку `guides/<адрес>` или дописать в шапку `draft: true`.

Гайд можно добавить и вручную: создать папку `guides/<адрес>` (латиница, цифры, дефис) с `index.md` и картинками.
Разметка текста: `## Подзаголовок`, `**жирный**`, `*курсив*`, `- список`, `1. список`, `> совет`, `[текст](ссылка)`,
картинка — отдельной строкой `![Подпись](img-1.webp)`.
