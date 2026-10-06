/* Cloudflare Worker: приём гайдов из формы «Отправить свой гайд» (guide-submit.js на сайте).
   Проверяет защиту от ботов (Cloudflare Turnstile) и данные, затем создаёт в репозитории ветку
   guide/<адрес> с файлами guides/<адрес>/index.md и картинками и открывает pull request.
   На сайт гайд попадает, только когда pull request принимают (Merge). Настройка — README.md рядом.

   Переменные (Settings → Variables and Secrets):
     GITHUB_TOKEN      секрет: fine-grained токен только на этот репозиторий, права Contents и Pull requests — Read and write
     TURNSTILE_SECRET  секрет: Secret key виджета Turnstile
     GITHUB_REPO       Sof-oss/helper
     GITHUB_BRANCH     main
     ALLOWED_ORIGINS   https://heart-of-the-zone.ru (через запятую, если адресов несколько) */

const LIM = { title: [5, 100], author: [2, 40], text: [200, 30000], images: 5, imgBytes: 2.5 * 1024 * 1024, total: 10 * 1024 * 1024 };
const IMG_NAME = /^img-[1-9]\.(webp|jpg|png)$/;

export default {
  async fetch(req, env) {
    const origins = String(env.ALLOWED_ORIGINS || "https://heart-of-the-zone.ru").split(",").map(s => s.trim());
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": origins.includes(origin) ? origin : origins[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
    const bad = (msg, status = 400) => reply(status, { ok: false, error: msg });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return bad("Нужен POST", 405);
    if (!origins.includes(origin)) return bad("Отправка возможна только с сайта", 403);
    if (+(req.headers.get("Content-Length") || 0) > 16 * 1024 * 1024) return bad("Слишком большой гайд", 413);

    let d;
    try { d = await req.json(); } catch (e) { return bad("Не получилось прочитать данные формы"); }
    if (d.website) return reply(200, { ok: true }); /* скрытое поле заполняют только боты */

    /* защита от ботов */
    const ts = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET || "", response: String(d.token || ""), remoteip: req.headers.get("CF-Connecting-IP") || "" })
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
      let bin;
      try { bin = atob(im.data); } catch (e) { return bad(im.name + ": повреждённый файл"); }
      if (bin.length > LIM.imgBytes) return bad(im.name + ": картинка больше 2 МБ");
      total += bin.length;
      /* тип по содержимому файла, а не по имени */
      const sig = bin.slice(0, 12);
      const kind = sig.startsWith("\x89PNG") ? "png" : sig.startsWith("\xff\xd8\xff") ? "jpg" : sig.startsWith("RIFF") && sig.slice(8, 12) === "WEBP" ? "webp" : "";
      if (kind !== im.name.split(".").pop()) return bad(im.name + ": это не картинка PNG, JPG или WebP");
    }
    if (total > LIM.total) return bad("Картинки вместе больше 10 МБ");

    /* адрес гайда: транслит заголовка + случайный хвост, чтобы не совпасть с уже существующим */
    const slug = translit(title).slice(0, 60).replace(/-+$/, "") + "-" + Math.random().toString(36).slice(2, 6);
    const date = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); /* по Москве */
    const yaml = s => /^[\s"'#|>&*!%@`{[-]|:\s|\s#/.test(s) ? '"' + s.replace(/"/g, "'") + '"' : s;
    const md = "---\ntitle: " + yaml(title) + "\nauthor: " + yaml(author) + "\ndate: " + date + "\n---\n\n" + text + "\n";

    try {
      const pr = await openPullRequest(env, slug, title, author, md, imgs);
      return reply(200, { ok: true, slug, pr: pr.number });
    } catch (e) {
      console.log("github error", e && e.message);
      return bad("Не получилось сохранить гайд, попробуйте позже", 502);
    }
  }
};

async function openPullRequest(env, slug, title, author, md, imgs) {
  const repo = env.GITHUB_REPO || "Sof-oss/helper", base = env.GITHUB_BRANCH || "main";
  const gh = async (method, url, body) => {
    const r = await fetch("https://api.github.com/repos/" + repo + url, {
      method,
      headers: { "Authorization": "Bearer " + env.GITHUB_TOKEN, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "heart-of-the-zone-guides", "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(method + " " + url + " -> " + r.status + " " + (j.message || ""));
    return j;
  };
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
