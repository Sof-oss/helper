/* Общее для рейтинга (top100.js) и карточек игроков (player-card.js): разделы рейтинга и мелкие помощники.
   Отдельным файлом, чтобы карточку игрока можно было открыть и на других страницах (например, «Группировки»)
   без всего рейтинга. Подключается перед top100.js / player-card.js */
/* exported fmt, esc, escAttr, norm, TOP100_TABS */
const fmt = n => Math.round(n).toLocaleString("ru-RU");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = s => esc(s).replace(/"/g, "&quot;");
const norm = s => String(s).toLowerCase().replace(/ё/g, "е");

/* разделы рейтинга: ключ, вкладка, подпись колонки, данные, цвет.
   Порядок = порядок вкладок. sortLevel: клик по «Ур.» сортирует по уровню (повторный клик сбрасывает) */
const TOP100_TABS = [
  {
    key: "reputation",
    label: "Репутация",
    metric: "Репутация",
    data: () => window.TOP100_REPUTATION,
    accent: "#f48fb1",
    sortLevel: true
  },
  { key: "bosses", label: "Боссы", metric: "Боссы", data: () => window.TOP100_BOSSES, accent: "#ff8a65" },
  { key: "stashes", label: "Тайники", metric: "Тайники", data: () => window.TOP100_STASHES, accent: "#26c6da" },
  { key: "talents", label: "Таланты", metric: "Таланты", data: () => window.TOP100_TALENTS, accent: "#ffb74d" },
  {
    key: "collections",
    label: "Коллекции",
    metric: "Коллекции",
    data: () => window.TOP100_COLLECTIONS,
    accent: "#c9a6ff"
  },
  {
    key: "expeditions",
    label: "Экспедиции",
    metric: "Экспедиции",
    data: () => window.TOP100_EXPEDITIONS,
    accent: "#9fdc9f"
  },
  {
    key: "defense",
    label: "Защита лагеря",
    metric: "Защита лагеря",
    data: () => window.TOP100_DEFENSE,
    accent: "#54bfff"
  }
];
