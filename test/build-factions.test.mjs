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
