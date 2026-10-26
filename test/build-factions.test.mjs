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
    /* дата 1: +50 у постоянного и +100 у будущего ушедшего; дата 2 - день переходов, не считается;
       дата 3: +50 у постоянного и +100 у новичка */
    assert.deepEqual(hist.factions["f-evil"].reputation, [0, 150, 150, 300]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
