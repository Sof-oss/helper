/* build-factions.js: экранирование данных из API и проверка ссылок. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import factions from "../build-factions.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { esc, safeUrl, anchor } = factions;

test("esc: HTML из данных игры выводится текстом", () => {
  assert.equal(esc('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(esc("a & b"), "a &amp; b");
});

test("safeUrl: только https, javascript: и data: не проходят", () => {
  assert.equal(safeUrl("https://vk.com/club1"), "https://vk.com/club1");
  for (const bad of ["http://vk.com", "javascript:alert(1)", "data:text/html,x", "//vk.com", 'https://x/"', "", null])
    assert.equal(safeUrl(bad), "", String(bad));
});

test("anchor: стабильный якорь карточки", () => {
  assert.equal(anchor("Наёмники"), "f-naemniki");
  assert.equal(anchor("Winx Club"), "f-winx-club");
  assert.equal(anchor("  Долг  "), "f-dolg");
});

test("рендер: ники, девизы и ссылки из данных не ломают разметку", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hotz-factions-"));
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, file),
      typeof data === "string" || Buffer.isBuffer(data) ? data : JSON.stringify(data)
    );
  };
  try {
    write("ui.js", fs.readFileSync(path.join(ROOT, "ui.js")));
    write("top100/factions.json", { Evil: "#ff0000" });
    write("top100/clans.json", {
      clans: [{ name: "Evil", level: 1, members: 1, leader: { id: 1, name: "<script>leader</script>" } }]
    });
    write("top100-players.json", {
      metrics: ["reputation"],
      players: {
        1: { n: '<img src=x onerror="alert(1)">', g: "Evil", l: 1, v: [100] }
      }
    });
    write("top100-data.js", 'window.TOP100_HISTORY={"id":"2026-10-25"};');
    write("factions-info.json", {
      Evil: {
        motto: "<script>motto</script>",
        recruit: "<b>набор</b>",
        post: "javascript:alert(1)",
        vk: { url: "javascript:alert(1)", name: "<script>vk</script>" },
        contacts: [{ name: "<script>contact</script>", url: "javascript:alert(1)" }]
      }
    });

    const res = factions(tmp);
    assert.equal(res.count, 1);
    assert.equal(res.hiring, 1);
    assert.match(res.stats, /fx-stat/);
    assert.match(res.rank, /data-fx-rank/);
    assert.match(res.rank, /data-reputation="100"/);
    assert.ok(
      !/<script(?![^>]*type="application\/json")/i.test(res.rank),
      "в рейтинге не должно быть исполняемого script"
    );
    assert.match(res.list, /class="fx-card/);
    assert.ok(!/<script/i.test(res.list), "в разметке не должно быть исполняемого script");
    assert.ok(!/javascript:/i.test(res.list), "javascript:-ссылки не должны попадать в HTML");
    assert.ok(!/<img src=x onerror=/i.test(res.list), "атрибуты из ника не должны исполняться");
    assert.match(res.list, /&lt;script&gt;motto&lt;\/script&gt;/);
    assert.match(res.list, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
    assert.match(res.list, /data-pc-open="1"/);
    assert.match(res.stats, /ведёт набор/);
    assert.match(res.list, /class="fx-name" href="\/f\/[^"]+" data-fc-open=/);
    assert.match(res.list, /data-rank="1"/);
    assert.match(res.list, /data-free="\d+"/);
    assert.match(res.list, /fx-tag">Набор открыт/);
    assert.equal(res.history, "2026-10-25");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("история периодов: прирост засчитывается только за время в группировке", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hotz-factions-gh-"));
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, file),
      typeof data === "string" || Buffer.isBuffer(data) ? data : JSON.stringify(data)
    );
  };
  try {
    write("ui.js", fs.readFileSync(path.join(ROOT, "ui.js")));
    write("top100/factions.json", { Evil: "#ff0000" });
    write("top100/clans.json", { clans: [{ name: "Evil", level: 1, members: 2 }] });
    write("factions-info.json", {});
    write("top100-data.js", 'window.TOP100_HISTORY={"id":"2026-10-24"};');
    write("top100-players.json", {
      updated: "2026-10-24 12:00",
      dates: [0, 1, 2, 3].map(d => Date.UTC(2026, 9, 20 + d)),
      metrics: ["reputation"],
      players: {
        /* всё время в Evil: +50 на первой и +50 на последней дате */
        1: {
          n: "Постоянный",
          g: "Evil",
          l: 1,
          v: [200],
          s: [
            [0, 1, 100],
            [1, 1, 150],
            [2, 1, 150],
            [3, 1, 200]
          ]
        },
        /* пришёл в Evil на дату 2: прирост до вступления новой группировке не идёт */
        2: {
          n: "Новичок",
          g: "Evil",
          l: 1,
          v: [1300],
          gh: [
            [0, "Good"],
            [2, "Evil"]
          ],
          s: [
            [0, 1, 1000],
            [1, 1, 1100],
            [2, 1, 1200],
            [3, 1, 1300]
          ]
        },
        /* вышел из Evil на дату 2: прирост за время в группировке остаётся у неё */
        3: {
          n: "Ушедший",
          g: "Good",
          l: 1,
          v: [800],
          gh: [
            [0, "Evil"],
            [2, "Good"]
          ],
          s: [
            [0, 1, 500],
            [1, 1, 600],
            [2, 1, 700],
            [3, 1, 800]
          ]
        }
      }
    });

    const res = factions(tmp);
    const m = res.rank.match(/<script type="application\/json" id="fxRankHistory">([\s\S]*?)<\/script>/);
    assert.ok(m, "история должна попасть в разметку");
    const hist = JSON.parse(m[1]);

    assert.deepEqual(hist.factions["f-evil"].reputation, [0, 150, 150, 300]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("места: 20 сначала, 25 / 30 / 40 - необязательные расширения на 2 / 5 / 10 уровне", () => {
  const { slotCap, slugOf } = factions;
  assert.deepEqual(slotCap(1, 15), { cap: 20, sure: true });
  assert.deepEqual(slotCap(4, 25), { cap: 25, sure: true });
  /* 2 уровень и 18 бойцов: расширение могли взять, а могли и нет - лимит неизвестен */
  assert.equal(slotCap(2, 18).sure, false);
  assert.deepEqual(slotCap(5, 26), { cap: 30, sure: true });
  assert.deepEqual(slotCap(12, 31), { cap: 40, sure: true });
  assert.equal(slugOf("Наёмники"), "naemniki");
  assert.match(slugOf("★★★"), /^g[0-9a-z]+$/);
});

test("карточки группировок: вступления, уходы, уровень, места и лидер", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hotz-factions-cards-"));
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
    fs.writeFileSync(path.join(tmp, file), typeof data === "string" ? data : JSON.stringify(data));
  };
  try {
    write("ui.js", fs.readFileSync(path.join(ROOT, "ui.js"), "utf8"));
    write("top100/factions.json", { Evil: "#ff0000" });
    write("top100/clans.json", { clans: [{ name: "Evil", level: 2, members: 22, leader: { id: 2, name: "Второй" } }] });
    write("top100/clans-history.json", {
      clans: {
        Evil: [
          ["2026-10-20", 1, 19, 1],
          ["2026-10-21", 2, 20, 1],
          ["2026-10-22", 2, 22, 2]
        ]
      }
    });
    write("factions-info.json", { Evil: { motto: "Девиз", post: "https://vk.com/wall-1_1" } });
    write("top100-data.js", 'window.TOP100_HISTORY={"id":"2026-10-22"};');
    write("top100-players.json", {
      updated: "2026-10-22 12:00",
      dates: [0, 1, 2].map(d => Date.UTC(2026, 9, 20 + d, 9)),
      metrics: ["reputation", "bosses"],
      players: {
        1: {
          n: "Первый",
          g: "Good",
          l: 5,
          v: [10, 1],
          gh: [
            [0, "Evil"],
            [2, "Good"]
          ]
        },
        2: {
          n: "Второй",
          g: "Evil",
          l: 7,
          v: [50, 3],
          gh: [
            [0, ""],
            [1, "Evil"]
          ]
        }
      }
    });
    const res = factions(tmp);
    const evil = res.cards.factions.find(f => f.n === "Evil");
    assert.equal(evil.s, "evil");
    assert.equal(evil.cap, 25);
    assert.equal(evil.lead.id, "2");
    assert.equal(evil.post, "https://vk.com/wall-1_1");
    assert.deepEqual(
      evil.ev.map(e => e.d + " " + e.t + " " + (e.n || e.x)),
      [
        "2026-10-22 slots 20→25",
        "2026-10-22 leader Второй",
        "2026-10-22 left Первый",
        "2026-10-21 level 1→2",
        "2026-10-21 join Второй"
      ]
    );
    assert.deepEqual(evil.r[0].slice(0, 5), ["2", "Второй", 7, 50, 3]);
    assert.match(res.list, /data-fc-open="evil"/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("активность: карта players для «Личного дела» - все игроки выгрузки, приросты только при росте", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hotz-factions-act-"));
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
    fs.writeFileSync(path.join(tmp, file), typeof data === "string" ? data : JSON.stringify(data));
  };
  try {
    write("ui.js", fs.readFileSync(path.join(ROOT, "ui.js"), "utf8"));
    write("top100/factions.json", { Evil: "#ff0000" });
    write("top100-data.js", 'window.TOP100_HISTORY={"id":"2026-10-22"};');
    write("top100-players.json", {
      updated: "2026-10-22 12:00",
      dates: [0, 1, 2].map(d => Date.UTC(2026, 9, 20 + d, 9)),
      metrics: ["reputation", "bosses"],
      players: {
        1: {
          n: "Первый",
          g: "Evil",
          l: 5,
          v: [30, 2],
          s: [
            [0, 5, 10, 0],
            [2, 5, 30, 2]
          ]
        },
        2: { n: "Второй", g: "Evil", l: 7, v: [50, 3], s: [[0, 7, 50, 3]] },
        3: {
          n: "Одиночка",
          l: 4,
          v: [12, 0],
          s: [
            [0, 4, 2, 0],
            [2, 4, 12, 0]
          ]
        }
      }
    });
    const res = factions(tmp);
    const act = res.cards.players;
    /* за окно активности (все даты внутри недели) Первый набрал +20 репутации и +2 босса;
       пороги - медианы всех недельных приростов (15 и 2), очки 100 и 100, балл 100 */
    assert.deepEqual(act["1"], [100, 20, 2]);
    /* без роста - только балл, без разбивки */
    assert.deepEqual(act["2"], [0]);
    /* одиночка тоже в карте, хотя в составах группировок его нет: +10 репутации при пороге 15 = 67 очков */
    assert.deepEqual(act["3"], [33, 10, 0]);
    /* в составе штаба - как и раньше: балл и разбивка в строках бойцов, одиночки не попадают */
    const evil = res.cards.factions.find(f => f.n === "Evil");
    assert.deepEqual(evil.r.find(row => row[0] === "1").slice(6), [100, [20, 2]]);
    assert.ok(!evil.r.some(row => row[0] === "3"));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("МОНОЛИТ: наследует шеврон, фон и цвет старого Монолита без учёта регистра", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hotz-factions-monolith-"));
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
    fs.writeFileSync(path.join(tmp, file), typeof data === "string" ? data : JSON.stringify(data));
  };
  try {
    write("ui.js", fs.readFileSync(path.join(ROOT, "ui.js"), "utf8"));
    write("assets/bg-monolith-card.webp", "stub");
    write("top100/factions.json", { Монолит: "#d9a52c" });
    write("top100/clans.json", {
      clans: [{ name: "МОНОЛИТ", level: 1, members: 2, leader: { id: 4817, name: "ХАРОН" } }]
    });
    write("factions-info.json", {});
    write("top100-data.js", 'window.TOP100_HISTORY={"id":"2026-11-18"};');
    write("top100-players.json", {
      metrics: ["reputation"],
      players: {
        4817: { n: "ХАРОН", g: "МОНОЛИТ", l: 11, v: [11018] }
      }
    });

    const res = factions(tmp);
    const mono = res.cards.factions.find(f => f.n === "МОНОЛИТ");
    assert.ok(mono);
    assert.equal(mono.k, "monolith");
    assert.equal(mono.c, "#d9a52c");
    assert.doesNotMatch(mono.e, /<text\b/);
    assert.match(mono.e, /#2aa7a3/);
    assert.match(res.list, /bg-monolith-card\.webp/);
    assert.match(res.list, /--fx:#d9a52c/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("новичок в день появления: приход засчитывается, если игрок появился позже стартового среза", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hotz-factions-newcomer-"));
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
    fs.writeFileSync(path.join(tmp, file), typeof data === "string" ? data : JSON.stringify(data));
  };
  try {
    write("ui.js", fs.readFileSync(path.join(ROOT, "ui.js"), "utf8"));
    write("top100/factions.json", { Монолит: "#d9a52c" });
    write("top100/clans.json", {
      clans: [{ name: "МОНОЛИТ", level: 1, members: 2, leader: { id: 1, name: "Лидер" } }]
    });
    write("factions-info.json", {});
    write("top100-data.js", 'window.TOP100_HISTORY={"id":"2026-11-18"};');
    write("top100-players.json", {
      updated: "2026-11-18 03:01",
      dates: [0, 1, 2].map(d => Date.UTC(2026, 10, 16 + d, 9)),
      metrics: ["reputation"],
      players: {
        1: { n: "Старожил", g: "МОНОЛИТ", l: 11, v: [100], gh: [[0, "МОНОЛИТ"]] },
        2: { n: "Новичок", g: "МОНОЛИТ", l: 1, v: [10], gh: [[2, "МОНОЛИТ"]] }
      }
    });
    const res = factions(tmp);
    const mono = res.cards.factions.find(f => f.n === "МОНОЛИТ");
    assert.deepEqual(
      mono.ev.map(e => e.d + " " + e.t + " " + e.n),
      ["2026-11-18 join Новичок"]
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("военные: подхватывает тему military, шеврон, цвет и фон карточки", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hotz-factions-mil-"));
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
    fs.writeFileSync(path.join(tmp, file), typeof data === "string" ? data : JSON.stringify(data));
  };
  try {
    write("ui.js", fs.readFileSync(path.join(ROOT, "ui.js"), "utf8"));
    write("assets/bg-military-card.webp", fs.readFileSync(path.join(ROOT, "assets/bg-military-card.webp")));
    write("top100/factions.json", { Военные: "#8be4b0" });
    write("top100/clans.json", {
      clans: [{ name: "Военные", level: 2, members: 2, leader: { id: 1, name: "Командир" } }]
    });
    write("factions-info.json", {});
    write("top100-data.js", 'window.TOP100_HISTORY={"id":"2026-11-18"};');
    write("top100-players.json", {
      metrics: ["reputation"],
      players: { 1: { n: "Командир", g: "Военные", l: 22, v: [500] } }
    });

    const res = factions(tmp);
    const mil = res.cards.factions.find(f => f.n === "Военные");
    assert.ok(mil);
    assert.equal(mil.k, "military");
    assert.equal(mil.c, "#8be4b0");
    assert.doesNotMatch(mil.e, /<text\b/);
    assert.match(mil.e, /#8be4b0/);
    assert.match(mil.e, /#e0a24b/);
    assert.match(res.list, /bg-military-card\.webp/);
    assert.match(res.list, /--fx:#8be4b0/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
