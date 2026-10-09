/* PWA: manifest.webmanifest, иконки и заготовка sw.js (метки, которые заполняет build.js) */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f));
/* ширина и высота PNG - из заголовка IHDR */
const pngSize = buf => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

test("manifest: обязательные поля и иконки нужных размеров", () => {
  const m = JSON.parse(read("manifest.webmanifest"));
  for (const k of ["name", "short_name", "start_url", "display", "theme_color", "background_color"]) assert.ok(m[k], k);
  for (const icon of m.icons) {
    const buf = read(icon.src.replace(/^\//, ""));
    assert.equal(buf.toString("ascii", 1, 4), "PNG", icon.src);
    const [w, h] = pngSize(buf);
    assert.equal(w + "x" + h, icon.sizes, icon.src);
  }
  assert.ok(m.icons.some(i => i.sizes === "192x192"));
  assert.ok(m.icons.some(i => i.sizes === "512x512"));
});

test("sw.js: метки версии и списка оболочки на месте, данные Топ-100 - сначала из сети", () => {
  const sw = read("sw.js").toString();
  assert.ok(sw.includes('"__SW_VERSION__"'));
  assert.ok(sw.includes('"__SW_PRECACHE__"'));
  assert.match(sw, /top100-\(\?:data\\\.js\|players\\\.json\)/);
});
