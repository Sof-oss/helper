import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { formatTime, clampProgress, geigerLevel, downloadFileName } = require("../guide-video.js");

test("formatTime: форматирует секунды, минуты, часы и защищается от нечисел", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(5.9), "0:05");
  assert.equal(formatTime(90.2), "1:30");
  assert.equal(formatTime(3661), "1:01:01");
  assert.equal(formatTime(-10), "0:00");
  assert.equal(formatTime(Number.NaN), "0:00");
  assert.equal(formatTime(Number.POSITIVE_INFINITY), "0:00");
});

test("geigerLevel: переводит громкость в число делений шкалы счётчика Гейгера", () => {
  assert.equal(geigerLevel(1, false, 10), 10);
  assert.equal(geigerLevel(0.5, false, 10), 5);
  assert.equal(geigerLevel(0.05, false, 10), 1);
  assert.equal(geigerLevel(0, false, 10), 0);
  assert.equal(geigerLevel(0.8, true, 10), 0);
  assert.equal(geigerLevel(Number.NaN, false, 10), 0);
});

test("clampProgress: считает процент прогресса в границах 0..100", () => {
  assert.equal(clampProgress(45, 90), 50);
  assert.equal(clampProgress(-5, 90), 0);
  assert.equal(clampProgress(120, 90), 100);
  assert.equal(clampProgress(10, 0), 0);
  assert.equal(clampProgress(Number.NaN, 90), 0);
});

test("downloadFileName: добавляет префикс heart-of-the-zone и убирает ?v=", () => {
  assert.equal(downloadFileName("/guide-img/vzlom-pda/pda-kids.mp4?v=6fbf4b5e"), "heart-of-the-zone-pda-kids.mp4");
  assert.equal(downloadFileName("/guide-img/x/heart-of-the-zone-demo.webm"), "heart-of-the-zone-demo.webm");
  assert.equal(downloadFileName(""), "heart-of-the-zone-video.mp4");
});
