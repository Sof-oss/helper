/* Сталкерский видеоплеер для гайдов (figure.guide-video): без JS остаётся нативный <video controls>.
   Оформление - guides.css (.gv-*), цвета подстраиваются под активную тему группировки (--accent, --panel-line). */
(function (root) {
  "use strict";

  const GEIGER_BARS = 10;

  function formatTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return "0:00";
    const total = Math.floor(sec);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = n => (n < 10 ? "0" + n : String(n));
    return h > 0 ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
  }

  function clampProgress(time, duration) {
    if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return 0;
    return Math.max(0, Math.min(100, (time / duration) * 100));
  }

  function geigerLevel(volume, muted, total) {
    const count = Number.isFinite(total) && total > 0 ? Math.floor(total) : GEIGER_BARS;
    if (muted || !Number.isFinite(volume) || volume <= 0) return 0;
    const clamped = Math.max(0, Math.min(1, volume));
    return Math.max(1, Math.min(count, Math.round(clamped * count)));
  }

  function downloadFileName(src) {
    const clean = String(src || "")
      .split(/[?#]/)[0]
      .split("/")
      .pop();
    const safe = (clean || "video.mp4").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "video.mp4";
    return /^heart-of-the-zone-/i.test(safe) ? safe : "heart-of-the-zone-" + safe;
  }

  const api = { formatTime, clampProgress, geigerLevel, downloadFileName, GEIGER_BARS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZoneGuideVideo = api;

  if (typeof document === "undefined" || !document.createElement) return;

  /* Трилистник радиационной опасности (ISO 361) + кнопка запуска/повтора в центре */
  const RAD_BLADES =
    '<g class="gv-rad-blades" fill="currentColor">' +
    '<path d="M7 50A43 43 0 0 1 28.5 12.76L40 32.68A20 20 0 0 0 30 50Z"/>' +
    '<path d="M71.5 12.76A43 43 0 0 1 93 50H70A20 20 0 0 0 60 32.68Z"/>' +
    '<path d="M71.5 87.24A43 43 0 0 1 28.5 87.24L40 67.32A20 20 0 0 0 60 67.32Z"/>' +
    "</g>";

  const ICONS = {
    radPlay:
      '<svg class="gv-rad-svg" viewBox="0 0 100 100" aria-hidden="true">' +
      RAD_BLADES +
      '<circle class="gv-rad-hub" cx="50" cy="50" r="15"/>' +
      '<path class="gv-rad-tri" d="M45.5 41.2 60.5 50l-15 8.8V41.2Z"/>' +
      "</svg>",
    radReplay:
      '<svg class="gv-rad-svg" viewBox="0 0 100 100" aria-hidden="true">' +
      RAD_BLADES +
      '<circle class="gv-rad-hub" cx="50" cy="50" r="15"/>' +
      '<path class="gv-rad-replay" d="M43 47a8 8 0 1 1 2.2 7.4M43 41.5V47h5.5" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>",
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.2 19 12 7.5 18.8V5.2Z" fill="currentColor"/></svg>',
    pause:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
    replay:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5.5 10.5A7 7 0 1 1 7 16.4M5.5 5.5v5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    volHigh:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 9.5H8l4.5-3.8v12.6L8 14.5H4.5v-5Z" fill="currentColor"/><path d="M15.5 8.8a4.6 4.6 0 0 1 0 6.4M18 6.4a8 8 0 0 1 0 11.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    volLow:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 9.5H8l4.5-3.8v12.6L8 14.5H4.5v-5Z" fill="currentColor"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    volMute:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 9.5H8l4.5-3.8v12.6L8 14.5H4.5v-5Z" fill="currentColor"/><path d="m16 9.5 4.5 5M20.5 9.5 16 14.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4.5v10m0 0-3.8-3.8M12 14.5l3.8-3.8M5 18.5h14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fsEnter:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 9.2V4.5h4.7M14.8 4.5h4.7v4.7M19.5 14.8v4.7h-4.7M9.2 19.5H4.5v-4.7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fsExit:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.2 4.5v4.7H4.5M19.5 9.2h-4.7V4.5M14.8 19.5v-4.7h4.7M4.5 14.8h4.7v4.7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function geigerBarsMarkup() {
    let html = "";
    for (let i = 1; i <= GEIGER_BARS; i++) {
      const zone = i >= 9 ? " gv-g-red" : i >= 7 ? " gv-g-warn" : "";
      html += '<i class="gv-g-bar' + zone + '" style="--h:' + (34 + i * 6.6).toFixed(1) + '%"></i>';
    }
    return html;
  }

  function enhanceFigure(fig) {
    if (!fig || fig.dataset.gvReady === "1") return;
    const video = fig.querySelector("video");
    if (!video) return;
    fig.dataset.gvReady = "1";

    const src = video.getAttribute("src") || video.currentSrc || "";
    const dlName = video.getAttribute("data-download-name") || downloadFileName(src);

    const shell = document.createElement("div");
    shell.className = "gv-shell";
    shell.tabIndex = 0;
    shell.setAttribute("role", "region");
    shell.setAttribute("aria-label", video.getAttribute("aria-label") || "Видеоплеер гайда");

    const frame = document.createElement("div");
    frame.className = "gv-frame";

    const stage = document.createElement("div");
    stage.className = "gv-stage";

    const bigPlay = document.createElement("button");
    bigPlay.type = "button";
    bigPlay.className = "gv-bigplay";
    bigPlay.setAttribute("aria-label", "Воспроизвести видео");
    bigPlay.innerHTML = '<span class="gv-bigplay-core">' + ICONS.radPlay + "</span>";

    const bar = document.createElement("div");
    bar.className = "gv-bar";
    bar.innerHTML =
      '<div class="gv-seek-wrap">' +
      '<div class="gv-seek-track" aria-hidden="true"><div class="gv-seek-buf"></div><div class="gv-seek-fill"></div></div>' +
      '<input type="range" class="gv-seek" min="0" max="1000" step="1" value="0" aria-label="Перемотка видео">' +
      '<span class="gv-seek-tip" aria-hidden="true">0:00</span>' +
      "</div>" +
      '<div class="gv-controls">' +
      '<div class="gv-group gv-left">' +
      '<button type="button" class="gv-btn gv-play" aria-label="Воспроизвести" title="Воспроизвести (Пробел)">' +
      ICONS.play +
      "</button>" +
      '<div class="gv-geiger" data-zone="high">' +
      '<button type="button" class="gv-btn gv-mute" aria-label="Выключить звук" title="Звук (M)">' +
      ICONS.volHigh +
      "</button>" +
      '<div class="gv-geiger-meter">' +
      '<span class="gv-geiger-bars" aria-hidden="true">' +
      geigerBarsMarkup() +
      "</span>" +
      '<input type="range" class="gv-vol-range" min="0" max="1" step="0.1" value="1" aria-label="Громкость">' +
      "</div>" +
      "</div>" +
      '<span class="gv-time" aria-live="off"><b class="gv-cur">0:00</b><span class="gv-sep">/</span><span class="gv-dur">0:00</span></span>' +
      "</div>" +
      '<div class="gv-group gv-right">' +
      '<a class="gv-btn gv-dl" href="' +
      src.replace(/"/g, "&quot;") +
      '" download="' +
      dlName.replace(/"/g, "&quot;") +
      '" aria-label="Скачать видео" title="Скачать видео">' +
      ICONS.dl +
      '<span class="gv-dl-label">Скачать</span></a>' +
      '<button type="button" class="gv-btn gv-fs" aria-label="На весь экран" title="На весь экран (F)">' +
      ICONS.fsEnter +
      "</button>" +
      "</div>" +
      "</div>";

    const cap = fig.querySelector("figcaption");
    fig.insertBefore(shell, cap || null);
    stage.appendChild(video);
    stage.appendChild(bigPlay);
    frame.appendChild(stage);
    frame.appendChild(bar);
    shell.appendChild(frame);

    video.controls = false;
    video.removeAttribute("controls");
    video.setAttribute("controlsList", "nodownload");

    const playBtn = bar.querySelector(".gv-play");
    const muteBtn = bar.querySelector(".gv-mute");
    const geigerWrap = bar.querySelector(".gv-geiger");
    const geigerBars = Array.from(bar.querySelectorAll(".gv-g-bar"));
    const volRange = bar.querySelector(".gv-vol-range");
    const fsBtn = bar.querySelector(".gv-fs");
    const seekInput = bar.querySelector(".gv-seek");
    const seekFill = bar.querySelector(".gv-seek-fill");
    const seekBuf = bar.querySelector(".gv-seek-buf");
    const seekTip = bar.querySelector(".gv-seek-tip");
    const seekWrap = bar.querySelector(".gv-seek-wrap");
    const curEl = bar.querySelector(".gv-cur");
    const durEl = bar.querySelector(".gv-dur");

    let seeking = false;
    let idleTimer = 0;

    function syncPlayState() {
      const ended = Boolean(video.ended);
      const playing = !video.paused && !ended;
      shell.classList.toggle("is-playing", playing);
      shell.classList.toggle("is-ended", ended);
      playBtn.innerHTML = playing ? ICONS.pause : ended ? ICONS.replay : ICONS.play;
      playBtn.setAttribute("aria-label", playing ? "Пауза" : ended ? "Смотреть снова" : "Воспроизвести");
      playBtn.title = playing ? "Пауза (Пробел)" : ended ? "Смотреть снова" : "Воспроизвести (Пробел)";
      bigPlay.innerHTML = '<span class="gv-bigplay-core">' + (ended ? ICONS.radReplay : ICONS.radPlay) + "</span>";
      bigPlay.setAttribute("aria-label", ended ? "Смотреть видео снова" : "Воспроизвести видео");
      if (!playing) {
        clearTimeout(idleTimer);
        shell.classList.remove("is-idle");
      } else {
        bumpIdle();
      }
    }

    function syncTime() {
      const dur = video.duration;
      const cur = video.currentTime;
      curEl.textContent = formatTime(cur);
      if (Number.isFinite(dur) && dur > 0) {
        durEl.textContent = formatTime(dur);
        const pct = clampProgress(cur, dur);
        if (!seeking) {
          seekInput.value = String(Math.round(pct * 10));
        }
        seekFill.style.width = pct + "%";
        seekInput.setAttribute("aria-valuetext", formatTime(cur) + " из " + formatTime(dur));
      }
    }

    function syncBuffer() {
      const dur = video.duration;
      if (!Number.isFinite(dur) || dur <= 0 || !video.buffered.length) return;
      const end = video.buffered.end(video.buffered.length - 1);
      seekBuf.style.width = clampProgress(end, dur) + "%";
    }

    function syncVolume() {
      const muted = video.muted || video.volume === 0;
      const val = muted ? 0 : video.volume;
      const lit = geigerLevel(val, muted, geigerBars.length);
      volRange.value = String(val);
      volRange.setAttribute("aria-valuetext", Math.round(val * 100) + "%");
      geigerBars.forEach((b, idx) => b.classList.toggle("is-on", idx < lit));
      geigerWrap.dataset.zone = lit >= 9 ? "high" : lit >= 7 ? "warn" : lit > 0 ? "ok" : "off";
      muteBtn.innerHTML = muted ? ICONS.volMute : val < 0.5 ? ICONS.volLow : ICONS.volHigh;
      muteBtn.setAttribute("aria-label", muted ? "Включить звук" : "Выключить звук");
    }

    function syncFullscreen() {
      const active = getFullscreenElement() === shell;
      shell.classList.toggle("is-fs", active);
      fsBtn.innerHTML = active ? ICONS.fsExit : ICONS.fsEnter;
      fsBtn.setAttribute("aria-label", active ? "Выйти из полноэкранного режима" : "На весь экран");
      fsBtn.title = active ? "Выйти из полноэкранного режима (F)" : "На весь экран (F)";
      if (!active) shell.classList.remove("is-idle");
    }

    function togglePlay() {
      if (video.paused || video.ended) {
        if (video.ended) video.currentTime = 0;
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
      } else {
        video.pause();
      }
    }

    function toggleFullscreen() {
      if (getFullscreenElement() === shell) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
        return;
      }
      const enter = shell.requestFullscreen || shell.webkitRequestFullscreen;
      if (enter) {
        const p = enter.call(shell);
        if (p && p.catch) p.catch(() => {});
      } else if (typeof video.webkitEnterFullscreen === "function") {
        video.webkitEnterFullscreen();
      }
    }

    function bumpIdle() {
      clearTimeout(idleTimer);
      shell.classList.remove("is-idle");
      if (getFullscreenElement() === shell && !video.paused && !video.ended) {
        idleTimer = window.setTimeout(() => shell.classList.add("is-idle"), 2400);
      }
    }

    playBtn.addEventListener("click", togglePlay);
    bigPlay.addEventListener("click", togglePlay);
    video.addEventListener("click", togglePlay);
    video.addEventListener("dblclick", toggleFullscreen);

    muteBtn.addEventListener("click", () => {
      if (video.muted || video.volume === 0) {
        video.muted = false;
        if (video.volume === 0) video.volume = 0.8;
      } else {
        video.muted = true;
      }
    });

    volRange.addEventListener("input", () => {
      const v = Number(volRange.value);
      video.volume = v;
      video.muted = v === 0;
    });

    fsBtn.addEventListener("click", toggleFullscreen);

    seekInput.addEventListener("pointerdown", () => {
      seeking = true;
    });
    seekInput.addEventListener("input", () => {
      const dur = video.duration;
      const pct = Number(seekInput.value) / 10;
      seekFill.style.width = pct + "%";
      if (Number.isFinite(dur) && dur > 0) {
        const nextTime = (pct / 100) * dur;
        curEl.textContent = formatTime(nextTime);
        video.currentTime = nextTime;
      }
    });
    const endSeek = () => {
      seeking = false;
      syncTime();
    };
    seekInput.addEventListener("pointerup", endSeek);
    seekInput.addEventListener("change", endSeek);

    seekWrap.addEventListener("pointermove", e => {
      const dur = video.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const rect = seekWrap.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTip.textContent = formatTime(ratio * dur);
      seekTip.style.left = Math.max(8, Math.min(92, ratio * 100)) + "%";
      seekWrap.classList.add("has-tip");
    });
    seekWrap.addEventListener("pointerleave", () => {
      seekWrap.classList.remove("has-tip");
    });

    shell.addEventListener("pointermove", bumpIdle);
    shell.addEventListener("keydown", e => {
      if (e.target && e.target.tagName === "INPUT" && e.key !== " ") return;
      const key = e.key.toLowerCase();
      if (e.key === " " || key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
      } else if (key === "m") {
        e.preventDefault();
        muteBtn.click();
      } else if (key === "f") {
        e.preventDefault();
        toggleFullscreen();
      }
    });

    video.addEventListener("play", syncPlayState);
    video.addEventListener("pause", syncPlayState);
    video.addEventListener("ended", syncPlayState);
    video.addEventListener("loadedmetadata", () => {
      syncTime();
      syncBuffer();
    });
    video.addEventListener("durationchange", syncTime);
    video.addEventListener("timeupdate", syncTime);
    video.addEventListener("progress", syncBuffer);
    video.addEventListener("volumechange", syncVolume);
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);

    syncPlayState();
    syncVolume();
    syncTime();
    syncBuffer();
    syncFullscreen();
  }

  function enhanceAll(scope) {
    (scope || document).querySelectorAll(".guide-body figure.guide-video").forEach(enhanceFigure);
  }

  enhanceAll(document);
  if (typeof MutationObserver === "function" && document.body) {
    new MutationObserver(mrs => {
      mrs.forEach(m => {
        const body = m.target && m.target.closest && m.target.closest(".guide-body");
        if (body) enhanceAll(body);
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
})(typeof window !== "undefined" ? window : this);
