"use strict";
/* Поиск установленного Chrome/Edge и запуск через playwright-core - для сборочных скриптов, которые рисуют картинки
 * (build-previews.js - превью «Личное дело», build-guide-images.js - уменьшенные копии и обложки гайдов).
 * Путь можно указать явно в переменной CHROME_PATH. В GitHub Actions Chrome уже установлен */
const fs = require("fs");
const { execFileSync } = require("child_process");

function findChrome() {
  const list = [process.env.CHROME_PATH];
  if (process.platform === "win32") {
    for (const base of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(
      Boolean
    ))
      list.push(
        base + "\\Google\\Chrome\\Application\\chrome.exe",
        base + "\\Microsoft\\Edge\\Application\\msedge.exe"
      );
  } else {
    list.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    );
    try {
      list.push(execFileSync("which", ["chromium"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
    } catch (e) {}
  }
  return list.find(f => f && fs.existsSync(f)) || null;
}

async function openBrowser() {
  let pw;
  try {
    pw = require("playwright-core");
  } catch (e) {
    return { why: "нет playwright-core (npm install)" };
  }
  const exe = findChrome();
  if (!exe) return { why: "не найден Chrome или Edge (можно указать путь в CHROME_PATH)" };
  const browser = await pw.chromium.launch({
    executablePath: exe,
    args: ["--no-sandbox", "--force-color-profile=srgb"]
  });
  return { browser };
}

module.exports = { findChrome, openBrowser };
