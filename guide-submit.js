/* Форма «Отправить свой гайд» на странице гайдов.
   Открывается кнопкой или по адресу /guides#send. Текст пишется в простом Markdown (guide-md.js),
   предпросмотр рисуется тем же кодом, что и страница гайда на сайте. Картинки сжимаются прямо в браузере.
   Отправка - в функцию Yandex Cloud (yandex/index.js), она создаёт pull request в репозитории сайта;
   гайд публикуется, когда его принимают. Адрес и ключ защиты от ботов - в guides-config.js:
   Yandex SmartCaptcha (smartcaptchaSiteKey) или, если его нет, Cloudflare Turnstile (turnstileSiteKey).
   Черновик (заголовок, ник, текст) хранится в localStorage, картинки - только до перезагрузки страницы */
(function () {
  "use strict";
  const root = document.getElementById("guideForm");
  const openBtn = document.getElementById("guideSendOpen");
  if (!root || !window.GuideMD) return;
  const cfg = window.GUIDES_CONFIG || {};
  /* капча: SmartCaptcha от Яндекса работает в России без обрывов, Turnstile - запасной вариант */
  const CAPTCHA = cfg.smartcaptchaSiteKey ? "yandex" : cfg.turnstileSiteKey ? "turnstile" : "";
  const ready = !!(cfg.endpoint && CAPTCHA);
  const LIM = { title: 100, author: 40, text: 30000, minText: 200, images: 5, imgBytes: 2 * 1024 * 1024, side: 1600 };
  const DRAFT = "guideDraft";
  const esc = window.GuideMD.esc;
  const images = []; /* {name, blob, url} */
  let refreshTodo = () => {};
  let built = false,
    widget = null,
    sending = false;
  /* номер черновика: повторная отправка того же гайда (двойной клик, повтор после ошибки сети)
     не создаст второй pull request - Worker узнает его по этому номеру */
  const newSid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  let sid = newSid();

  const ico = d =>
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="' +
    d +
    '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const TOOLS = [
    ["h", "Подзаголовок", "## ", "", ico("M4 5v14M12 5v14M4 12h8M15.5 11.2a2.2 2.2 0 1 1 3.9 1.4L15.5 18h5")],
    ["b", "Жирный", "**", "**", ico("M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z")],
    ["i", "Курсив", "*", "*", ico("M10 5h8M6 19h8M14 5l-4 14")],
    ["ul", "Список", "- ", "", ico("M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01")],
    ["ol", "Нумерованный список", "1. ", "", ico("M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M4 14h3l-3 4h3")],
    ["q", "Цитата / совет", "> ", "", ico("M5 7h5v5H7l-2 4M14 7h5v5h-3l-2 4")],
    [
      "a",
      "Ссылка",
      "[",
      "](https://)",
      ico("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1")
    ],
    ["img", "Картинка", "", "", ico("M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15.5 9h.01")]
  ];

  function build() {
    if (built) return;
    built = true;
    root.innerHTML =
      '<div class="gf-head"><h2>Новый гайд</h2><button type="button" class="gf-close" id="gfClose" aria-label="Закрыть форму">' +
      ico("M6 6l12 12M18 6L6 18") +
      "</button></div>" +
      (ready
        ? ""
        : '<p class="gf-note gf-warn">Приём гайдов скоро заработает. Пока можно написать гайд и посмотреть, как он будет выглядеть, - черновик сохранится в этом браузере.</p>') +
      '<form id="gfForm" novalidate>' +
      '<div class="gf-row"><label class="gf-field"><span>Заголовок</span><input id="gfTitle" maxlength="' +
      LIM.title +
      '" placeholder="Например: Как обогнать Ымгыра за 24 часа" autocomplete="off" required></label>' +
      '<label class="gf-field gf-author"><span>Ваш ник в игре</span><input id="gfAuthor" maxlength="' +
      LIM.author +
      '" placeholder="Подпись автора" autocomplete="nickname" required></label></div>' +
      '<div class="gf-editor">' +
      '<div class="gf-bar"><div class="gf-tools" role="toolbar" aria-label="Оформление">' +
      TOOLS.map(
        t =>
          '<button type="button" data-tool="' +
          t[0] +
          '" title="' +
          t[1] +
          '" aria-label="' +
          t[1] +
          '">' +
          t[4] +
          "</button>"
      ).join("") +
      '</div><div class="gf-tabs" role="tablist"><button type="button" role="tab" class="active" aria-selected="true" data-tab="edit">Текст</button><button type="button" role="tab" aria-selected="false" data-tab="preview">Предпросмотр</button></div></div>' +
      '<textarea id="gfText" maxlength="' +
      LIM.text +
      '" rows="16" placeholder="Текст гайда. Пустая строка - новый абзац. ## в начале строки - подзаголовок, - - пункт списка, **жирный**, *курсив*. Картинки - кнопкой на панели." required></textarea>' +
      '<div class="gf-preview guide-body" id="gfPreview" hidden></div>' +
      '<div class="gf-foot"><span id="gfCount"></span><span>Оформление: <b>## Подзаголовок</b>, <b>**жирный**</b>, <b>- список</b>, <b>[текст](ссылка)</b></span></div></div>' +
      '<div class="gf-images"><div class="gf-images-list" id="gfImages"></div>' +
      '<label class="gf-add-img"><input type="file" id="gfFile" accept="image/png,image/jpeg,image/webp" multiple hidden>' +
      ico("M12 5v14M5 12h14") +
      "<span>Добавить картинку</span></label>" +
      "<small>До " +
      LIM.images +
      " картинок, скриншоты из игры подойдут. Картинка вставляется в текст там, где стоит курсор; подпись можно поменять в квадратных скобках.</small></div>" +
      '<label class="gf-hp" aria-hidden="true">Сайт<input id="gfWebsite" tabindex="-1" autocomplete="off"></label>' +
      '<label class="gf-check"><input type="checkbox" id="gfAgree"><span>Я автор этого гайда и согласен, что его опубликуют на сайте после проверки. Модератор может поправить оформление и опечатки.</span></label>' +
      '<div class="gf-captcha" id="gfCaptcha"></div>' +
      '<div class="gf-actions"><button type="submit" class="guide-send-btn" id="gfSubmit"' +
      (ready ? "" : " disabled") +
      ' aria-describedby="gfTodo">Отправить на проверку</button>' +
      '<span class="gf-status" id="gfStatus" role="status" aria-live="polite"></span></div>' +
      '<ul class="gf-todo" id="gfTodo" aria-label="Что нужно для отправки"></ul>' +
      "</form>";
    const $ = id => document.getElementById(id);
    const title = $("gfTitle"),
      author = $("gfAuthor"),
      text = $("gfText"),
      preview = $("gfPreview");

    /* что ещё нужно для отправки: список под кнопкой обновляется на ходу, после неудачной попытки
       незаполненные поля подсвечиваются (aria-invalid) */
    let tried = false;
    const checks = () => {
      const n = text.value.trim().length;
      return [
        { el: title, ok: title.value.trim().length >= 5, label: "заголовок от 5 символов" },
        { el: author, ok: author.value.trim().length >= 2, label: "ник в игре" },
        {
          el: text,
          ok: n >= LIM.minText,
          label:
            n >= LIM.minText ? "текст от " + LIM.minText + " символов" : "текст: ещё " + (LIM.minText - n) + " симв."
        },
        { el: $("gfAgree"), ok: $("gfAgree").checked, label: "галочка согласия" },
        ...(ready ? [{ el: $("gfCaptcha"), ok: !!captchaToken(), label: "проверка «я не робот»" }] : [])
      ];
    };
    const drawTodo = () => {
      const list = checks();
      $("gfTodo").innerHTML = list
        .map(c => '<li class="' + (c.ok ? "ok" : tried ? "bad" : "") + '">' + esc(c.label) + "</li>")
        .join("");
      list.forEach(c => {
        if (c.el.tagName === "DIV") c.el.classList.toggle("gf-missing", tried && !c.ok);
        else if (tried && !c.ok) c.el.setAttribute("aria-invalid", "true");
        else c.el.removeAttribute("aria-invalid");
      });
      return list;
    };
    refreshTodo = drawTodo;
    $("gfAgree").addEventListener("change", drawTodo);

    /* черновик */
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || "null");
      if (d) {
        title.value = d.title || "";
        author.value = d.author || "";
        text.value = d.text || "";
        if (/^[a-z0-9]{8,20}$/.test(d.sid || "")) sid = d.sid;
      }
    } catch (e) {}
    let saveT = 0;
    const save = () => {
      clearTimeout(saveT);
      saveT = setTimeout(() => {
        try {
          localStorage.setItem(
            DRAFT,
            JSON.stringify({ title: title.value, author: author.value, text: text.value, sid })
          );
        } catch (e) {}
      }, 400);
    };
    const count = () => {
      $("gfCount").textContent = text.value.length.toLocaleString("ru-RU") + " / " + LIM.text.toLocaleString("ru-RU");
      drawTodo();
    };
    [title, author, text].forEach(el =>
      el.addEventListener("input", () => {
        save();
        count();
        setStatus("");
      })
    );
    count();

    /* панель оформления: оборачивает выделенное или ставит маркер в начало строки */
    function wrap(before, after, line) {
      text.focus();
      const s = text.selectionStart,
        e = text.selectionEnd,
        v = text.value;
      if (line) {
        const ls = v.lastIndexOf("\n", s - 1) + 1;
        const block = v.slice(ls, e) || "";
        const out = block
          .split("\n")
          .map((l, i) => (before === "1. " ? i + 1 + ". " + l : before + l))
          .join("\n");
        text.setRangeText(out, ls, e, "end");
      } else {
        const sel = v.slice(s, e) || (before === "[" ? "текст ссылки" : "текст");
        text.setRangeText(before + sel + after, s, e, "select");
        text.setSelectionRange(s + before.length, s + before.length + sel.length);
      }
      text.dispatchEvent(new Event("input"));
    }
    root.querySelector(".gf-tools").addEventListener("click", ev => {
      const b = ev.target.closest("[data-tool]");
      if (!b) return;
      const t = TOOLS.find(x => x[0] === b.dataset.tool);
      if (t[0] === "img") {
        $("gfFile").click();
        return;
      }
      if (!preview.hidden) tab("edit");
      wrap(t[2], t[3], ["h", "ul", "ol", "q"].includes(t[0]));
    });

    /* вкладки «Текст» / «Предпросмотр» */
    function tab(name) {
      root.querySelectorAll("[data-tab]").forEach(b => {
        const on = b.dataset.tab === name;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on);
      });
      const pv = name === "preview";
      text.hidden = pv;
      preview.hidden = !pv;
      if (pv) {
        const body = window.GuideMD.render(text.value, {
          image: n => {
            const im = images.find(x => x.name === n);
            return im ? im.url : null;
          },
          siteHost: "heart-of-the-zone.ru"
        });
        preview.innerHTML =
          "<h1>" +
          esc(title.value.trim() || "Без заголовка") +
          '</h1><p class="guide-meta">Автор: <b>' +
          esc(author.value.trim() || "ваш ник") +
          "</b></p>" +
          (body || '<p class="gf-muted">Здесь появится текст гайда.</p>');
      }
    }
    root.querySelector(".gf-tabs").addEventListener("click", ev => {
      const b = ev.target.closest("[data-tab]");
      if (b) tab(b.dataset.tab);
    });

    /* картинки */
    function drawImages() {
      $("gfImages").innerHTML = images
        .map(
          im =>
            '<figure class="gf-img"><img src="' +
            im.url +
            '" alt=""><figcaption>' +
            esc(im.name) +
            " · " +
            Math.round(im.blob.size / 1024) +
            ' КБ</figcaption><div><button type="button" data-img-put="' +
            im.name +
            '">Вставить</button><button type="button" data-img-del="' +
            im.name +
            '" aria-label="Убрать картинку">' +
            ico("M6 6l12 12M18 6L6 18") +
            "</button></div></figure>"
        )
        .join("");
      root.querySelector(".gf-add-img").hidden = images.length >= LIM.images;
    }
    function putImage(name) {
      if (!preview.hidden) tab("edit");
      text.focus();
      const s = text.selectionStart,
        v = text.value;
      const pre = s > 0 && v[s - 1] !== "\n" ? "\n\n" : s > 1 && v[s - 2] !== "\n" ? "\n" : "";
      text.setRangeText(pre + "![Подпись к картинке](" + name + ")\n\n", s, text.selectionEnd, "end");
      text.dispatchEvent(new Event("input"));
    }
    $("gfImages").addEventListener("click", ev => {
      const put = ev.target.closest("[data-img-put]"),
        del = ev.target.closest("[data-img-del]");
      if (put) putImage(put.dataset.imgPut);
      if (del) {
        const i = images.findIndex(x => x.name === del.dataset.imgDel);
        if (i < 0) return;
        URL.revokeObjectURL(images[i].url);
        const name = images[i].name;
        images.splice(i, 1);
        /* строку с картинкой из текста тоже убираем */
        text.value = text.value.replace(
          new RegExp("^[ \\t]*!\\[[^\\]\\n]*\\]\\(" + name.replace(/[.]/g, "\\.") + "\\)[ \\t]*\\n?", "gm"),
          ""
        );
        text.dispatchEvent(new Event("input"));
        drawImages();
      }
    });
    $("gfFile").addEventListener("change", async ev => {
      const files = [...ev.target.files];
      ev.target.value = "";
      for (const f of files) {
        if (images.length >= LIM.images) {
          setStatus("Можно добавить не больше " + LIM.images + " картинок", true);
          break;
        }
        if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {
          setStatus(f.name + ": нужна картинка PNG, JPG или WebP", true);
          continue;
        }
        try {
          setStatus("Сжимаю " + f.name + "…");
          const blob = await shrink(f);
          if (blob.size > LIM.imgBytes) {
            setStatus(f.name + ": даже после сжатия больше 2 МБ", true);
            continue;
          }
          let n = 1;
          while (images.some(x => x.name.startsWith("img-" + n + "."))) n++;
          const name =
            "img-" + n + "." + (blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg");
          images.push({ name, blob, url: URL.createObjectURL(blob) });
          drawImages();
          putImage(name);
          setStatus("");
        } catch (e) {
          setStatus(f.name + ": не получилось открыть картинку", true);
        }
      }
    });

    /* отправка */
    $("gfForm").addEventListener("submit", async ev => {
      ev.preventDefault();
      if (sending || !ready) return;
      tried = true;
      drawTodo();
      const t = title.value.trim(),
        a = author.value.trim(),
        body = text.value.trim();
      if (t.length < 5) return fail(title, "Напишите заголовок - хотя бы 5 символов");
      if (a.length < 2) return fail(author, "Укажите ник - он будет подписью автора");
      if (body.length < LIM.minText)
        return fail(
          text,
          "Гайд получился коротким: нужно хотя бы " + LIM.minText + " символов (сейчас " + body.length + ")"
        );
      if (!$("gfAgree").checked) return fail($("gfAgree"), "Отметьте согласие на публикацию");
      const token = captchaToken();
      if (!token) return setStatus("Подтвердите, что вы не робот (окошко над кнопкой)", true);
      /* отправляются только картинки, которые стоят в тексте */
      const used = images.filter(im => body.includes("(" + im.name + ")"));
      sending = true;
      $("gfSubmit").disabled = true;
      setStatus("Отправляю…");
      try {
        const payload = {
          id: sid,
          title: t,
          author: a,
          text: body,
          website: $("gfWebsite").value,
          token,
          captcha: CAPTCHA,
          images: []
        };
        for (const im of used) payload.images.push({ name: im.name, data: await toBase64(im.blob) });
        let r = null,
          res = {};
        try {
          r = await fetch(cfg.endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload)
          });
          res = await r.json().catch(() => ({}));
        } catch (e) {
          /* ответ потерялся (обрыв связи и т. п.), но гайд мог дойти - спрашиваем по номеру черновика */
          setStatus("Проверяю, дошёл ли гайд…");
          if (!(await arrived())) throw new Error("Связь оборвалась, гайд не дошёл. Попробуйте отправить ещё раз");
          r = { ok: true };
          res = { ok: true };
        }
        if (!r.ok || !res.ok) throw new Error(res.error || "Сервер не принял гайд (" + r.status + ")");
        try {
          localStorage.removeItem(DRAFT);
        } catch (e) {}
        clearTimeout(saveT);
        sid = newSid();
        images.splice(0).forEach(im => URL.revokeObjectURL(im.url));
        root.innerHTML =
          '<div class="gf-done">' +
          ico("M5 12.5l4.5 4.5L19 7.5") +
          "<h2>Гайд отправлен!</h2><p>Спасибо, " +
          esc(a) +
          "! Гайд «" +
          esc(t) +
          "» появится в этом разделе с вашей подписью, когда его проверят.</p>" +
          '<button type="button" class="guide-send-btn" id="gfAgain">Написать ещё один</button></div>';
        built = false;
        widget = null;
        document.getElementById("gfAgain").addEventListener("click", () => {
          build();
          open(true);
        });
      } catch (e) {
        setStatus(e.message || "Не получилось отправить. Проверьте интернет и попробуйте ещё раз", true);
        captchaReset();
      } finally {
        sending = false;
        const b = document.getElementById("gfSubmit");
        if (b) b.disabled = false;
      }
    });
    $("gfClose").addEventListener("click", () => close());
    drawImages();
    drawTodo();
  }

  /* дошёл ли гайд с текущим номером черновика: несколько попыток с паузой */
  async function arrived() {
    for (let i = 0; i < 4; i++) {
      await new Promise(ok => setTimeout(ok, 2500));
      try {
        const r = await fetch(cfg.endpoint + (cfg.endpoint.includes("?") ? "&" : "?") + "check=" + sid, {
          cache: "no-store"
        });
        const j = await r.json();
        if (j.ok) return !!j.slug;
      } catch (e) {}
    }
    return false;
  }

  function setStatus(msg, bad) {
    const s = document.getElementById("gfStatus");
    if (!s) return;
    s.textContent = msg;
    s.classList.toggle("bad", !!bad);
  }
  function fail(el, msg) {
    setStatus(msg, true);
    el.focus();
  }

  /* сжатие: длинная сторона до 1600 px, WebP (если браузер не умеет - JPEG); PNG/JPG меньше лимита и размера не трогаем */
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = no;
        i.src = url;
      });
      const k = Math.min(1, LIM.side / Math.max(img.naturalWidth, img.naturalHeight));
      if (k === 1 && file.size <= 400 * 1024 && file.type !== "image/png") return file;
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const blobOf = (type, q) => new Promise(ok => c.toBlob(ok, type, q));
      let best = null;
      for (const q of [0.86, 0.75, 0.6]) {
        let b = await blobOf("image/webp", q);
        if (!b || b.type !== "image/webp") b = await blobOf("image/jpeg", q);
        best = b;
        if (b.size <= LIM.imgBytes * 0.6) break;
      }
      return best.size < file.size || file.size > LIM.imgBytes ? best : file;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const toBase64 = blob =>
    new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(",")[1]);
      r.onerror = no;
      r.readAsDataURL(blob);
    });

  /* капча подгружается, только когда форму открыли. Yandex SmartCaptcha или Cloudflare Turnstile */
  const captchaApi = () => (CAPTCHA === "yandex" ? window.smartCaptcha : window.turnstile);
  function captchaToken() {
    const api = captchaApi();
    if (!api || widget === null) return "";
    try {
      return api.getResponse(widget) || "";
    } catch (e) {
      return "";
    }
  }
  function captchaReset() {
    const api = captchaApi();
    if (api && widget !== null) api.reset(widget);
    refreshTodo();
  }
  function captcha() {
    if (!ready || widget !== null) return;
    const draw = () => {
      const box = document.getElementById("gfCaptcha");
      if (!box || widget !== null) return;
      const changed = () => refreshTodo();
      widget =
        CAPTCHA === "yandex"
          ? window.smartCaptcha.render(box, { sitekey: cfg.smartcaptchaSiteKey, hl: "ru", callback: changed })
          : window.turnstile.render(box, {
              sitekey: cfg.turnstileSiteKey,
              theme: "dark",
              language: "ru",
              callback: changed,
              "expired-callback": changed
            });
      if (CAPTCHA === "yandex" && window.smartCaptcha.subscribe)
        window.smartCaptcha.subscribe(widget, "token-expired", changed);
    };
    if (captchaApi()) return draw();
    window.onGuideCaptcha = draw;
    if (!document.getElementById("gfCaptchaJs")) {
      const s = document.createElement("script");
      s.id = "gfCaptchaJs";
      s.async = true;
      s.src =
        CAPTCHA === "yandex"
          ? "https://smartcaptcha.yandexcloud.net/captcha.js?render=onload&onload=onGuideCaptcha"
          : "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onGuideCaptcha";
      document.head.appendChild(s);
    }
  }

  function open(scroll) {
    build();
    root.hidden = false;
    if (openBtn) openBtn.setAttribute("aria-expanded", "true");
    captcha();
    if (scroll) root.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function close() {
    root.hidden = true;
    if (openBtn) openBtn.setAttribute("aria-expanded", "false");
    if (location.hash === "#send") history.replaceState(null, "", location.pathname + location.search);
  }
  if (openBtn)
    openBtn.addEventListener("click", ev => {
      ev.preventDefault();
      if (root.hidden) {
        history.replaceState(null, "", "#send");
        open(true);
      } else close();
    });
  window.addEventListener("hashchange", () => {
    if (location.hash === "#send") open(true);
  });
  if (location.hash === "#send") open(true);
})();
