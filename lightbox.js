/* Окно просмотра картинки: скриншоты и баннеры в «Новостях Зоны» (news.js) и картинки в гайдах.
   ZoneLightbox.open([{ src, alt }], k) - открыть группу с k-й картинки: стрелки листают, Esc, крестик или
   нажатие мимо картинки закрывают. Стили - lightbox.css. */
(function () {
  if (!document.createElement || !document.addEventListener) return;
  let box = null,
    group = [],
    at = 0;
  const show = k => {
    at = (k + group.length) % group.length;
    const b = group[at],
      img = box.querySelector("img"),
      cap = box.querySelector(".zn-lb-cap");
    img.src = b.src;
    img.alt = b.alt || "";
    const num = group.length > 1 ? at + 1 + " / " + group.length : "";
    cap.textContent = b.alt && num ? b.alt + "  ·  " + num : b.alt || num;
    cap.hidden = !cap.textContent;
    box.classList.toggle("zn-lb-single", group.length < 2);
  };
  const make = () => {
    box = document.createElement("dialog");
    box.className = "zn-lightbox";
    box.setAttribute("aria-label", "Просмотр картинки");
    box.innerHTML =
      '<div class="zn-lb-shell"><figure><img alt=""><figcaption class="zn-lb-cap"></figcaption></figure>' +
      '<button type="button" class="zn-lb-btn zn-lb-close" aria-label="Закрыть"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
      '<button type="button" class="zn-lb-btn zn-lb-prev" aria-label="Предыдущая картинка"><svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg></button>' +
      '<button type="button" class="zn-lb-btn zn-lb-next" aria-label="Следующая картинка"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></button></div>';
    document.body.appendChild(box);
    box.addEventListener("click", e => {
      if (e.target.closest(".zn-lb-prev")) show(at - 1);
      else if (e.target.closest(".zn-lb-next")) show(at + 1);
      else if (e.target.closest(".zn-lb-close") || !e.target.closest("img")) box.close();
    });
    box.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft") show(at - 1);
      if (e.key === "ArrowRight") show(at + 1);
    });
  };
  const open = (items, k) => {
    group = items.filter(x => x && x.src);
    if (!group.length) return;
    if (!box) make();
    show(Math.max(0, k || 0));
    if (box.open) return;
    if (box.showModal) box.showModal();
    else box.setAttribute("open", "");
  };
  /* у картинки с srcset берём самый крупный вариант */
  const big = img => {
    let best = img.currentSrc || img.src,
      max = 0;
    for (const part of (img.getAttribute("srcset") || "").split(",")) {
      const [url, w] = part.trim().split(/\s+/);
      const n = parseInt(w, 10) || 0;
      if (url && n >= max) {
        best = url;
        max = n;
      }
    }
    return best;
  };
  window.ZoneLightbox = { open, big };

  /* картинки гайдов: на странице гайда и в предпросмотре формы «Отправить гайд» (оба - .guide-body) */
  const GUIDE_IMG = ".guide-body figure img";
  const guideImg = e => (e.target.closest ? e.target.closest(GUIDE_IMG) : null);
  const openGuide = img => {
    const all = [...img.closest(".guide-body").querySelectorAll(GUIDE_IMG)];
    open(
      all.map(i => ({ src: big(i), alt: i.alt })),
      all.indexOf(img)
    );
  };
  document.addEventListener("click", e => {
    const img = guideImg(e);
    if (img) openGuide(img);
  });
  /* с клавиатуры: картинка - кнопка (Tab, затем Enter или пробел) */
  document.addEventListener("keydown", e => {
    const img = (e.key === "Enter" || e.key === " ") && guideImg(e);
    if (!img) return;
    e.preventDefault();
    openGuide(img);
  });
  document.querySelectorAll(GUIDE_IMG).forEach(img => {
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    img.setAttribute("aria-label", "Открыть крупно" + (img.alt ? ": " + img.alt : ""));
  });
})();
