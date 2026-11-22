#!/usr/bin/env node
"use strict";
/* Подготовка видео для гайда: сжимает до 720p H.264 (+faststart),
   вшивает аккуратный водяной знак heart-of-the-zone.ru и снимает постер .webp.
   Запуск: node build-guide-video.js <входной.mp4> <guides/<slug>/clip.mp4> */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const WATERMARK = "heart-of-the-zone.ru";
const FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-SemiBold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
  "C:/Windows/Fonts/consolab.ttf",
  "C:/Windows/Fonts/arialbd.ttf"
];

function findFont() {
  return FONT_CANDIDATES.find(f => fs.existsSync(f)) || null;
}

function buildFilter(font) {
  const fontPart = font ? "fontfile='" + font.replace(/\\/g, "/").replace(/:/g, "\\:") + "':" : "";
  return (
    "scale='min(1280,iw)':-2:flags=lanczos," +
    "drawtext=" +
    fontPart +
    "text='" +
    WATERMARK +
    "':fontsize=20:fontcolor=0xf3f7fb@0.36:" +
    "shadowcolor=0x000000@0.38:shadowx=1:shadowy=1:" +
    "x=w-tw-22:y=h-th-18"
  );
}

if (require.main === module) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error("Использование: node build-guide-video.js <входной.mp4> <guides/<slug>/имя.mp4>");
    process.exit(1);
  }
  const outAbs = path.resolve(output);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  const font = findFont();
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      path.resolve(input),
      "-vf",
      buildFilter(font),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "24",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-ac",
      "2",
      outAbs
    ],
    { stdio: "inherit" }
  );
  const poster = outAbs.replace(/\.\w+$/, ".webp");
  execFileSync(
    "ffmpeg",
    ["-y", "-ss", "1.5", "-i", outAbs, "-vframes", "1", "-c:v", "libwebp", "-quality", "82", poster],
    { stdio: "inherit" }
  );
  console.log("Готово: " + output + " и постер " + path.basename(poster));
}

module.exports = { buildFilter, WATERMARK };
