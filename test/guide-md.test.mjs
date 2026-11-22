/* Тесты разметки гайдов (guide-md.js): npm test. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const GuideMD = createRequire(import.meta.url)("../guide-md.js");
const { render, parse, excerpt, firstImage } = GuideMD;

test("HTML в тексте выводится как текст", () => {
  const html = render('<script>alert(1)</script> <img src=x onerror="alert(1)">');
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("ссылки: javascript:, data: и чужие сайты под видом внутренних не проходят", () => {
  for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "//evil.com", "/\\evil.com"]) {
    const html = render("[жми](" + bad + ")");
    assert.ok(!html.includes("<a"), bad + " -> " + html);
  }
});

test("ссылки: http(s), почта и адреса сайта работают; внешние - с noopener nofollow", () => {
  assert.match(render("[сайт](/top100)"), /<a href="\/top100">сайт<\/a>/);
  assert.match(render("[якорь](#x)"), /<a href="#x">/);
  assert.match(render("[почта](mailto:a@b.ru)"), /<a href="mailto:a@b.ru">/);
  assert.match(render("[vk](https://vk.ru/x)"), /target="_blank" rel="noopener nofollow ugc"/);
  assert.doesNotMatch(
    render("[свой](https://heart-of-the-zone.ru/top100)", { siteHost: "heart-of-the-zone.ru" }),
    /_blank/
  );
});

test("атрибуты нельзя разорвать кавычкой", () => {
  const html = render('[x](https://a.ru/"onmouseover="alert(1))');
  assert.ok(!/"onmouseover=/.test(html), html);
});

test("код в обратных кавычках экранируется и не размечается", () => {
  assert.equal(render("`<b>**x**</b>`"), "<p><code>&lt;b&gt;**x**&lt;/b&gt;</code></p>");
});

test("заголовки без пропуска уровня: # и ## - h2, ### - h3", () => {
  assert.equal(render("# А"), "<h2>А</h2>");
  assert.equal(render("## Б"), "<h2>Б</h2>");
  assert.equal(render("### В"), "<h3>В</h3>");
});

test("картинка: размеры и srcset от сборки, без них - просто src", () => {
  const big = render("![Подпись](a.webp)", {
    image: () => ({
      src: "/g/a.webp",
      width: 1600,
      height: 900,
      srcset: "/g/a-800w.webp 800w, /g/a.webp 1600w",
      sizes: "100vw"
    })
  });
  assert.match(big, /width="1600" height="900"/);
  assert.match(big, /srcset="\/g\/a-800w.webp 800w, \/g\/a.webp 1600w" sizes="100vw"/);
  assert.match(big, /<figcaption>Подпись<\/figcaption>/);
  assert.equal(
    render("![](a.webp)", { image: () => "blob:x" }),
    '<figure><img src="blob:x" alt="" loading="lazy" decoding="async"></figure>'
  );
  assert.ok(!render("![](javascript:x)").includes("<img"));
});

test("картинка внутри строки: эмодзи в заголовке и тексте", () => {
  const opt = { image: n => (n === "e.webp" ? { src: "/guide-img/x/e.webp", width: 160, height: 206 } : null) };
  assert.equal(
    render("## Видео ![](e.webp)", opt),
    '<h2>Видео <img class="guide-inline-img" src="/guide-img/x/e.webp" width="160" height="206" alt="" loading="lazy" decoding="async"></h2>'
  );
  assert.match(
    render("Текст ![лицо](e.webp) конец", opt),
    /Текст <img class="guide-inline-img"[^>]* alt="лицо"[^>]*> конец/
  );
  /* неизвестная картинка - на её месте остаётся подпись, ссылкой [alt](src) она не становится */
  assert.equal(render("## Видео ![лицо](нет.webp)", opt), "<h2>Видео лицо</h2>");
  assert.ok(!render("![](javascript:alert(1))").includes("<img"));
  /* ссылка рядом с картинкой по-прежнему работает */
  assert.match(render("![](e.webp) [сайт](/top100)", opt), /<\/a>/);
});

test("списки, цитата, жирный и курсив", () => {
  assert.equal(render("- раз\n- два"), "<ul><li>раз</li><li>два</li></ul>");
  assert.equal(render("1. раз\n2. два"), "<ol><li>раз</li><li>два</li></ol>");
  assert.equal(render("> цитата"), "<blockquote>цитата</blockquote>");
  assert.equal(render("**ж** и *к*"), "<p><b>ж</b> и <i>к</i></p>");
});

test("шапка гайда, описание и обложка", () => {
  const { meta, body } = parse("---\ntitle: Гайд\nauthor: Sof\n---\nПервый **абзац**.\n\n![](img-1.webp)");
  assert.equal(meta.title, "Гайд");
  assert.equal(meta.author, "Sof");
  assert.equal(excerpt(body), "Первый абзац.");
  assert.equal(firstImage(body), "img-1.webp");
});

test("ссылка с именем сайта в параметрах остаётся внешней", () => {
  const html = render("[x](https://evil.example/?heart-of-the-zone.ru)", { siteHost: "heart-of-the-zone.ru" });
  assert.match(html, /rel="noopener nofollow ugc"/);
  const own = render("[x](https://www.heart-of-the-zone.ru/top100)", { siteHost: "heart-of-the-zone.ru" });
  assert.doesNotMatch(own, /nofollow/);
});

test("видео: рендерится в <video> с постером и не становится обложкой гайда", () => {
  const html = render("![Мульт-разбор](clip.mp4)", {
    image: () => ({ src: "/guide-img/x/clip.mp4", video: true, poster: "/guide-img/x/clip.webp" })
  });
  assert.match(html, /<figure class="guide-video"><video src="\/guide-img\/x\/clip\.mp4"/);
  assert.match(html, /poster="\/guide-img\/x\/clip\.webp"/);
  assert.match(html, /controls playsinline preload="metadata"/);
  assert.match(html, /<figcaption>Мульт-разбор<\/figcaption>/);
  assert.equal(firstImage("![Видео](clip.mp4)\n\n![Картинка](cover.webp)"), "cover.webp");
  assert.equal(firstImage("![Только видео](clip.mp4)"), null);
});
