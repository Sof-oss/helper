/* Живой фон главной: у каждой темы есть фото и карта глубины для компьютера и телефона. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(ROOT, "zone3d.css"), "utf8");

test("zone3d.css: карты глубины всех тем существуют", () => {
  const urls = [...css.matchAll(/--depth-img:\s*url\(["']?([^"')]+)["']?\)/g)].map(m => m[1]);
  assert.ok(urls.length >= 20, "карт глубины в zone3d.css: " + urls.length);
  for (const u of urls) assert.ok(fs.existsSync(path.join(ROOT, u)), "нет файла " + u);
});

test("zone3d.css: у каждой темы с фото есть карта глубины", () => {
  const photos = new Set([...css.matchAll(/assets\/bg-([a-z]+)\.webp/g)].map(m => m[1]));
  const depth = new Set([...css.matchAll(/assets\/depth-([a-z]+)\.webp/g)].map(m => m[1]));
  for (const t of photos) assert.ok(depth.has(t), "нет карты глубины для темы " + t);
});
