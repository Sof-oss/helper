/* Yandex Cloud Functions: приём гайдов из формы «Отправить свой гайд» (guide-submit.js на сайте).
   Сервер в России: у части российских провайдеров соединения с Cloudflare обрываются, поэтому не Cloudflare Worker.
   Проверяет защиту от ботов (Cloudflare Turnstile) и данные, затем создаёт в репозитории ветку
   guide/<адрес> с файлами guides/<адрес>/index.md и картинками и открывает pull request.
   На сайт гайд попадает, только когда pull request принимают (Merge). Настройка — README.md рядом.

   Среда выполнения Node.js 22, точка входа index.handler, таймаут 30 с, функция публичная.
   Переменные окружения:
     GITHUB_TOKEN      fine-grained токен только на этот репозиторий, права Contents и Pull requests — Read and write
     TURNSTILE_SECRET  Secret key виджета Turnstile
     GITHUB_REPO       Sof-oss/helper
     GITHUB_BRANCH     main
     ALLOWED_ORIGINS   https://heart-of-the-zone.ru (через запятую, если адресов несколько) */
"use strict";

/* у Яндекса запрос целиком — до 3,5 МБ, картинки приходят в base64 (+33 %), поэтому такие лимиты */
const LIM = { title: [5, 100], author: [2, 40], text: [200, 30000], images: 5, imgBytes: 1024 * 1024, total: 2.4 * 1024 * 1024 };
const IMG_NAME = /^img-[1-9]\.(webp|jpg|png)$/;

/* Защита проверки «дошёл ли гайд» (GET ?check=…). Она без капчи, а каждый вызов — запрос к GitHub API;
   если долбить её без остановки, кончится лимит токена (5000 запросов в час) и перестанет работать вся форма.
   Поэтому:
   — список веток guide/… кэшируется на CHECK_CACHE_MS: сколько бы ни спрашивали, GitHub видит не больше запроса в эти секунды;
   — с одного адреса — не больше CHECK_PER_IP проверок за CHECK_WINDOW_MS, дальше ответ 429.
   Форма спрашивает 4 раза с паузой 2,5 с и только если потерялся ответ на отправку, так что обычный посетитель в лимит не упрётся.
   Счётчики живут в памяти экземпляра функции (Яндекс держит его несколько минут, при нагрузке поднимает ещё) —
   это не точный лимит, но от простого перебора защищает. Строгий лимит можно включить в API Gateway (см. README). */
const CHECK_CACHE_MS = 5000, CHECK_PER_IP = 20, CHECK_WINDOW_MS = 10 * 60 * 1000;
let refsCache = null;                 /* { at, refs: Promise<[...]> } */
const checkHits = new Map();          /* ip -> { from, n } */
function checkAllowed(ip) {
  const now = Date.now();
  if (checkHits.size > 5000) for (const [k, v] of checkHits) if (now - v.from > CHECK_WINDOW_MS) checkHits.delete(k);
  const h = checkHits.get(ip);
  if (!h || now - h.from > CHECK_WINDOW_MS) { checkHits.set(ip, { from: now, n: 1 }); return true; }
  return ++h.n <= CHECK_PER_IP;
}

module.exports.handler = async function (event) {
  const env = process.env;
  const hdr = {};
  for (const k of Object.keys(event.headers || {})) hdr[k.toLowerCase()] = event.headers[k];
  const method = String(event.httpMethod || "GET").toUpperCase();
  const query = event.queryStringParameters || {};
  const ip = (event.requestContext && event.requestContext.identity && event.requestContext.identity.sourceIp) || "";
  const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : String(event.body || "");

  const origins = String(env.ALLOWED_ORIGINS || "https://heart-of-the-zone.ru").split(",").map(s => s.trim());
  const origin = hdr.origin || "";
  const cors = {
    "Access-Control-Allow-Origin": origins.includes(origin) ? origin : origins[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
  const reply = (status, body) => ({ statusCode: status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
  const bad = (msg, status = 400) => reply(status, { ok: false, error: msg });

  if (method === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  /* GET ?check=<номер черновика>: дошёл ли гайд. Форма спрашивает, если ответ на отправку потерялся в сети */
  const check = query.check;
  if (method === "GET" && check) {
    if (!/^[a-z0-9]{8,20}$/.test(check)) return bad("Неправильный номер");
    if (!checkAllowed(ip || "?")) return bad("Слишком много проверок, попробуйте через несколько минут", 429);
    try { return reply(200, { ok: true, slug: await findGuideBranch(env, check.slice(0, 6), true) }); }
    catch (e) { return bad("GitHub не ответил", 502); }
  }
  if (method !== "POST") return bad("Нужен POST", 405);
  if (!origins.includes(origin)) return bad("Отправка возможна только с сайта", 403);

  let d;
  try { d = JSON.parse(raw); } catch (e) { return bad("Не получилось прочитать данные формы"); }
  if (d.website) return reply(200, { ok: true }); /* скрытое поле заполняют только боты */

  /* защита от ботов */
  const ts = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET || "", response: String(d.token || ""), remoteip: ip })
  }).then(r => r.json()).catch(() => ({}));
  if (!ts.success) return bad("Проверка «я не робот» не прошла, попробуйте ещё раз", 403);

  /* данные */
  const line = s => String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const title = line(d.title), author = line(d.author);
  const text = String(d.text || "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  const len = (s, [a, b], what) => s.length < a ? what + ": слишком коротко (нужно от " + a + " символов)" : s.length > b ? what + ": слишком длинно (до " + b + " символов)" : "";
  const err = len(title, LIM.title, "Заголовок") || len(author, LIM.author, "Ник") || len(text, LIM.text, "Текст");
  if (err) return bad(err);

  const imgs = Array.isArray(d.images) ? d.images : [];
  if (imgs.length > LIM.images) return bad("Не больше " + LIM.images + " картинок");
  let total = 0;
  const names = new Set();
  for (const im of imgs) {
    if (!im || !IMG_NAME.test(im.name) || names.has(im.name) || typeof im.data !== "string") return bad("Неправильная картинка");
    names.add(im.name);
    /* целиком картинку не раскодируем: размер считается по длине base64, тип — по первым байтам файла (а не по имени) */
    const size = Math.floor(im.data.length * 3 / 4);
    if (size > LIM.imgBytes) return bad(im.name + ": картинка больше 1 МБ");
    total += size;
    let sig;
    try { sig = atob(im.data.slice(0, 16)); } catch (e) { return bad(im.name + ": повреждённый файл"); }
    const kind = sig.startsWith("\x89PNG") ? "png" : sig.startsWith("\xff\xd8\xff") ? "jpg" : sig.startsWith("RIFF") && sig.slice(8, 12) === "WEBP" ? "webp" : "";
    if (kind !== im.name.split(".").pop()) return bad(im.name + ": это не картинка PNG, JPG или WebP");
  }
  if (total > LIM.total) return bad("Картинки вместе больше 2,4 МБ");

  /* адрес гайда: транслит заголовка + хвост из номера черновика (форма присылает его в id).
     По хвосту узнаётся повторная отправка того же гайда: второй pull request не создаётся */
  const sid = /^[a-z0-9]{8,20}$/.test(d.id || "") ? d.id : Math.random().toString(36).slice(2, 12).padEnd(8, "0");
  const slug = translit(title).slice(0, 60).replace(/-+$/, "") + "-" + sid.slice(0, 6);
  const date = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); /* по Москве */
  const yaml = s => /^[\s"'#|>&*!%@`{[-]|:\s|\s#/.test(s) ? '"' + s.replace(/"/g, "'") + '"' : s;
  const md = "---\ntitle: " + yaml(title) + "\nauthor: " + yaml(author) + "\ndate: " + date + "\n---\n\n" + text + "\n";

  try {
    const dup = await findGuideBranch(env, sid.slice(0, 6));
    if (dup) return reply(200, { ok: true, slug: dup, duplicate: true });
    const pr = await openPullRequest(env, slug, title, author, md, imgs);
    refsCache = null;   /* новая ветка: следующая проверка спросит GitHub заново */
    return reply(200, { ok: true, slug, pr: pr.number });
  } catch (e) {
    console.log("github error", e && e.message);
    return bad("Не получилось сохранить гайд, попробуйте позже", 502);
  }
};

function github(env) {
  const repo = env.GITHUB_REPO || "Sof-oss/helper";
  return async (method, url, body) => {
    const r = await fetch("https://api.github.com/repos/" + repo + url, {
      method,
      headers: { "Authorization": "Bearer " + env.GITHUB_TOKEN, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "heart-of-the-zone-guides", "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(method + " " + url + " -> " + r.status + " " + (j.message || ""));
    return j;
  };
}

/* ветка guide/…-<хвост> уже есть — этот гайд уже прислали.
   cached: для проверки из формы список веток берётся из кэша (см. CHECK_CACHE_MS); при отправке — всегда свежий */
async function findGuideBranch(env, tail, cached) {
  const now = Date.now();
  if (!cached || !refsCache || now - refsCache.at > CHECK_CACHE_MS) {
    const refs = github(env)("GET", "/git/matching-refs/heads/guide/");
    refsCache = { at: now, refs };
    refs.catch(() => { if (refsCache && refsCache.refs === refs) refsCache = null; });   /* ошибку не кэшируем */
  }
  const refs = await refsCache.refs;
  const hit = (Array.isArray(refs) ? refs : []).find(r => r.ref.endsWith("-" + tail));
  return hit ? hit.ref.replace("refs/heads/guide/", "") : null;
}

async function openPullRequest(env, slug, title, author, md, imgs) {
  const base = env.GITHUB_BRANCH || "main";
  const gh = github(env);
  const dir = "guides/" + slug + "/";
  const ref = await gh("GET", "/git/ref/heads/" + base);
  const head = await gh("GET", "/git/commits/" + ref.object.sha);
  const tree = [{ path: dir + "index.md", mode: "100644", type: "blob", content: md }];
  for (const im of imgs) {
    const blob = await gh("POST", "/git/blobs", { content: im.data, encoding: "base64" });
    tree.push({ path: dir + im.name, mode: "100644", type: "blob", sha: blob.sha });
  }
  const t = await gh("POST", "/git/trees", { base_tree: head.tree.sha, tree });
  const commit = await gh("POST", "/git/commits", { message: "Гайд: " + title + " — " + author, tree: t.sha, parents: [ref.object.sha] });
  const branch = "guide/" + slug;
  await gh("POST", "/git/refs", { ref: "refs/heads/" + branch, sha: commit.sha });
  const pr = await gh("POST", "/pulls", {
    title: "Гайд: " + title + " — " + author,
    head: branch, base,
    body: [
      "Новый гайд из формы на сайте.",
      "",
      "**Автор:** " + author + "  ",
      "**Адрес после публикации:** https://heart-of-the-zone.ru/guide/" + slug,
      "",
      "### Как проверить и опубликовать",
      "1. **Files changed** → файл `" + dir + "index.md` → «⋯» → **View file** — текст гайда с картинками.",
      "2. Поправить текст или подпись: в том же меню **Edit file** (карандаш). Подпись автора — строка `author:` в шапке файла, заголовок — `title:`. Сохранить — **Commit changes** (в эту же ветку).",
      "3. Опубликовать: **Merge pull request**. Через пару минут после сборки гайд появится на сайте.",
      "4. Отклонить: **Close pull request**, ветку можно удалить.",
      "",
      "Картинки: " + (imgs.length ? imgs.map(i => "`" + i.name + "`").join(", ") : "нет") + "."
    ].join("\n")
  });
  /* метка — для удобства, без неё тоже работает */
  try { await gh("POST", "/issues/" + pr.number + "/labels", { labels: ["гайд"] }); } catch (e) {}
  return pr;
}

function translit(s) {
  const map = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
  const out = String(s).toLowerCase().split("").map(c => map[c] !== undefined ? map[c] : c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return out || "guide";
}
