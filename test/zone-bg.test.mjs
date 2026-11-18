/* Живой 3D-фон главной: карты глубины для всех тем и корректность сцен-анимаций (src/zone-scenes.js). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCENES, getScene, packSceneUniforms } from "../src/zone-scenes.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(ROOT, "zone3d.css"), "utf8");

test("zone3d.css: карты глубины всех тем существуют", () => {
  const urls = [...css.matchAll(/--depth-img:\s*url\(["']?([^"')]+)["']?\)/g)].map(m => m[1]);
  assert.ok(urls.length >= 24, "карт глубины в zone3d.css: " + urls.length);
  for (const u of urls) assert.ok(fs.existsSync(path.join(ROOT, u)), "нет файла " + u);
});

test("zone3d.css: у каждой темы с фото есть карта глубины и сцена анимаций", () => {
  const styles = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
  const photos = new Set([...styles.matchAll(/assets\/bg-([a-z]+)\.webp/g)].map(m => m[1]));
  const depth = new Set([...css.matchAll(/assets\/depth-([a-z]+)\.webp/g)].map(m => m[1]));
  assert.ok(photos.size >= 12);
  for (const t of photos) {
    assert.ok(depth.has(t), "нет карты глубины для темы " + t);
    assert.ok(SCENES[t], "нет сцены анимаций в src/zone-scenes.js для темы " + t);
  }
});

test("zone-scenes.js: все координаты и параметры 12 тем в допустимых пределах", () => {
  for (const [key, s] of Object.entries(SCENES)) {
    assert.ok(s.mobileCropX >= 0 && s.mobileCropX <= 0.6, key + ": mobileCropX");
    assert.ok(s.fires.length <= 3, key + ": fires <= 3");
    assert.ok(s.flags.length <= 2, key + ": flags <= 2");
    assert.ok(s.beams.length <= 3, key + ": beams <= 3");
    assert.ok(s.lights.length <= 4, key + ": lights <= 4");
    for (const f of s.fires) {
      assert.ok(f.x >= 0 && f.x <= 1 && f.y >= 0 && f.y <= 1, key + ": fire coords");
    }
    for (const fl of s.flags) {
      assert.ok(fl.x >= 0 && fl.x <= 1 && fl.y >= 0 && fl.y <= 1, key + ": flag coords");
    }
    const desk = packSceneUniforms(key, false);
    const mob = packSceneUniforms(key, true);
    assert.deepEqual([...desk.crop], [0, 1]);
    assert.equal(mob.crop[0], Math.fround(s.mobileCropX));
    assert.ok(mob.crop[1] > 0.4 && mob.crop[1] < 0.5);
    assert.equal(desk.fires.length, 12);
    assert.equal(desk.flags.length, 8);
    assert.equal(desk.beams.length, 12);
    assert.equal(desk.lights.length, 16);
  }
  assert.equal(getScene("unknown_theme"), SCENES.merc);
});
