/* Разметка гайдов: простой Markdown -> безопасный HTML.
   Один и тот же код работает в сборке (build.js) и в браузере (предпросмотр формы «Отправить гайд»),
   поэтому автор видит гайд ровно таким, каким он будет на сайте.
   Поддерживается: ## заголовки (h2, ### - h3), абзацы, **жирный**, *курсив*, `код`, [ссылка](https://…), ![подпись](картинка),
   списки (- и 1.), > цитата, --- разделитель. Любой HTML в тексте выводится как текст.
   Файл гайда: guides/<адрес>/index.md, сверху блок
   ---
   title: Заголовок
   author: Ник автора
   date: 2026-10-06
   ---
   Картинки лежат рядом с index.md и вставляются по имени файла: ![Подпись](img-1.webp) */
(function (root) {
  "use strict";
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* ссылки: только http(s), почта и адреса внутри сайта; всё остальное (javascript: и т. п.) - обычный текст.
     Адрес внутри сайта - «/путь», но не «//сайт» и не «/\сайт»: браузер открывает оба как чужой сайт */
  function safeUrl(u) {
    u = String(u).trim();
    if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u) || /^\/(?![/\\])/.test(u) || /^#/.test(u)) return u;
    return null;
  }

  /* строчная разметка; текст сначала экранируется, поэтому вставить свой HTML нельзя */
  function inline(text, opt) {
    const codes = [];
    let s = String(text).replace(/`([^`\n]+)`/g, (m, c) => {
      codes.push(c);
      return "\u0000" + (codes.length - 1) + "\u0000";
    });
    s = esc(s);
    s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const u = safeUrl(url.replace(/&amp;/g, "&"));
      if (!u) return label;
      const ext = /^https?:/i.test(u) && !(opt && opt.siteHost && u.toLowerCase().includes(opt.siteHost));
      return (
        '<a href="' + esc(u) + '"' + (ext ? ' target="_blank" rel="noopener nofollow ugc"' : "") + ">" + label + "</a>"
      );
    });
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<i>$2</i>");
    s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => "<code>" + esc(codes[+i]) + "</code>");
    return s;
  }

  /* image(src) -> адрес картинки или null, если такой нет (опция сборки/формы) */
  function render(md, opt) {
    opt = opt || {};
    const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let para = [],
      list = null,
      quote = [];
    const flushPara = () => {
      if (para.length) {
        out.push("<p>" + para.map(l => inline(l, opt)).join("<br>") + "</p>");
        para = [];
      }
    };
    const flushList = () => {
      if (list) {
        out.push(
          "<" + list.tag + ">" + list.items.map(i => "<li>" + inline(i, opt) + "</li>").join("") + "</" + list.tag + ">"
        );
        list = null;
      }
    };
    const flushQuote = () => {
      if (quote.length) {
        out.push("<blockquote>" + quote.map(l => inline(l, opt)).join("<br>") + "</blockquote>");
        quote = [];
      }
    };
    const flush = () => {
      flushPara();
      flushList();
      flushQuote();
    };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "");
      let m;
      if (!line.trim()) {
        flush();
        continue;
      }
      if ((m = line.match(/^\s*!\[([^\]\n]*)\]\(([^)\s]+)\)\s*$/))) {
        flush();
        /* opt.image(src) -> адрес или { src, width, height, srcset, sizes }: с размерами браузер заранее
           оставляет место под картинку и текст не прыгает, srcset отдаёт телефону уменьшенную копию */
        let img = opt.image ? opt.image(m[2]) : safeUrl(m[2]);
        if (typeof img === "string") img = { src: img };
        if (img && img.src)
          out.push(
            '<figure><img src="' +
              esc(img.src) +
              '"' +
              (img.srcset ? ' srcset="' + esc(img.srcset) + '" sizes="' + esc(img.sizes || "100vw") + '"' : "") +
              (img.width && img.height ? ' width="' + +img.width + '" height="' + +img.height + '"' : "") +
              ' alt="' +
              esc(m[1]) +
              '" loading="lazy" decoding="async">' +
              (m[1] ? "<figcaption>" + inline(m[1], opt) + "</figcaption>" : "") +
              "</figure>"
          );
        continue;
      }
      if ((m = line.match(/^(#{1,3})\s+(.+)$/))) {
        flush();
        /* заголовок страницы гайда - h1, поэтому «#» и «##» дают h2, «###» - h3 (без пропуска уровня) */
        const lv = Math.max(2, m[1].length);
        out.push("<h" + lv + ">" + inline(m[2], opt) + "</h" + lv + ">");
        continue;
      }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
        flush();
        out.push("<hr>");
        continue;
      }
      if ((m = line.match(/^\s*>\s?(.*)$/))) {
        flushPara();
        flushList();
        quote.push(m[1]);
        continue;
      }
      if ((m = line.match(/^\s*([-*•])\s+(.+)$/)) || (m = line.match(/^\s*(\d+)[.)]\s+(.+)$/))) {
        flushPara();
        flushQuote();
        const tag = /\d/.test(m[1]) ? "ol" : "ul";
        if (!list || list.tag !== tag) {
          flushList();
          list = { tag, items: [] };
        }
        list.items.push(m[2]);
        continue;
      }
      if (list && /^\s{2,}\S/.test(raw)) {
        list.items[list.items.length - 1] += " " + line.trim();
        continue;
      }
      flushList();
      flushQuote();
      para.push(line.trim());
    }
    flush();
    return out.join("\n");
  }

  /* блок --- ключ: значение --- в начале файла */
  function parse(text) {
    const m = String(text)
      .replace(/^\uFEFF/, "")
      .match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    const meta = {};
    if (!m) return { meta, body: String(text) };
    for (const l of m[1].split(/\r?\n/)) {
      const kv = l.match(/^\s*([\w-]+)\s*:\s*(.*)$/);
      if (kv) meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^"(.*)"$/, "$1");
    }
    return { meta, body: m[2] };
  }

  /* первый абзац простым текстом - для описания в списке и в meta description */
  function excerpt(md, max) {
    const p =
      String(md)
        .split(/\n\s*\n/)
        .map(x => x.trim())
        .find(x => x && !/^(#|!\[|>|-{3}|[-*]\s|\d+[.)]\s)/.test(x)) || "";
    const t = p
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    max = max || 180;
    return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : t;
  }
  /* первая картинка гайда - обложка в списке */
  function firstImage(md) {
    const m = String(md).match(/^\s*!\[[^\]]*\]\(([^)\s]+)\)\s*$/m);
    return m ? m[1] : null;
  }

  const api = { render, parse, excerpt, firstImage, esc };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GuideMD = api;
})(typeof window !== "undefined" ? window : this);
