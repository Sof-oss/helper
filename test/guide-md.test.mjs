/* Тесты разметки гайдов (guide-md.js): npm test. Санитайзер - граница безопасности: текст гайда пишет любой игрок */
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
