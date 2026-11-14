// Drives the demo page in real Chromium: node test/e2e.mjs
// Serves the folder itself (no server to install). Screenshots land in test/out/; with DOCS=1 the README pictures
// in docs/ are redrawn too.
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "test/out");
const DOCS = process.env.DOCS === "1";
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".md": "text/plain", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const BASE = `http://localhost:${server.address().port}/index.html`;

let n = 0;
async function t(name, fn) { await fn(); n++; console.log("ok", n, name); }
const browser = await chromium.launch();
const errors = [];
async function page(width, height) {
  const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: DOCS ? 2 : 1 });
  p.on("pageerror", e => errors.push(e.message));
  await p.goto(BASE); await p.evaluate(() => document.fonts.ready);
  return p;
}
const counter = p => p.locator(".ps-counter[aria-live]").textContent();
const shot = async (p, name) => { await p.waitForTimeout(350); return p.screenshot({ path: path.join(DOCS ? path.join(ROOT, "docs") : OUT, name + ".png") }); };

try {
  const p = await page(1280, 800);

  await t("the page fits at 1280 with nothing sideways", async () => {
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 1280);
    if (DOCS) await p.screenshot({ path: path.join(ROOT, "docs/home.png") });
  });

  await t("keys answer, the counter follows, labels come from the kind", async () => {
    await p.click('.cta [data-demo="photos"]');
    assert.match(await counter(p), /^1 of 8 · 8 left · 0 to keep · 0 to set aside/);
    assert.equal(await p.locator('[data-ps="drop"]').innerText(), "← Set aside");
    await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowDown");
    assert.match(await counter(p), /^4 of 8 · 5 left · 1 to keep · 1 to set aside/);
  });

  await t("U undoes the last press", async () => {
    await p.keyboard.press("u"); await p.keyboard.press("u");
    assert.match(await counter(p), /^2 of 8 · 7 left · 1 to keep · 0 to set aside/);
  });

  await t("Esc with answers goes to the review, and nothing is saved yet", async () => {
    await p.keyboard.press("Escape");
    assert.equal(await p.locator(".ps-review .ps-name").textContent(), "Save what you decided?");
    assert.equal(await p.locator('[data-ps="save"]').textContent(), "Save: keep 1");
    assert.equal(await p.locator("#result").isVisible(), false);
    if (DOCS) await shot(p, "review");
  });

  await t("Enter saves, the result shows, the page gets the list", async () => {
    await p.keyboard.press("Enter");
    await p.locator(".ps-cleared").waitFor();
    assert.match(await p.locator(".ps-cleared .ps-why").textContent(), /1 kept, 0 dropped, 7 left for later/);
    await p.keyboard.press("Enter");
    assert.equal(await p.locator(".ps-overlay").count(), 0);
    assert.match(await p.locator("#resultTags").textContent(), /1 kept0 dropped7 for later/);
  });

  await t("the download is the pile-sprint/1 format", async () => {
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#dlJSON")]);
    const body = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
    assert.equal(body.format, "pile-sprint/1");
    assert.deepEqual(body.decisions[0], { id: "IMG_2041.jpg", decision: "keep", title: "IMG_2041.jpg" });
  });

  await t("a draft is written while the card waits, and the right answer says Send", async () => {
    await p.click('.cta [data-demo="inbox"]');
    assert.match(await p.locator(".ps-overlay .ps-title").textContent(), /Waiting on your answer/);
    assert.equal(await p.locator(".ps-context").textContent(), "A made-up inbox · replies first");
    await p.locator("#psDraft").waitFor();
    assert.match(await p.locator("#psDraft").inputValue(), /Friday at the same time/);
    assert.equal(await p.locator('[data-ps="keep"]').innerText(), "Send →");
    if (DOCS) await shot(p, "card-message");
  });

  await t("Send waits 3 seconds and Undo stops it", async () => {
    await p.keyboard.press("ArrowRight");
    await p.locator(".ps-undo-bar").waitFor();
    assert.match(await p.locator(".ps-undo-bar").textContent(), /Sending “Can we move Thursday to Friday\?” in [123]…/);
    if (DOCS) await shot(p, "send-undo");
    await p.keyboard.press("u");
    assert.equal(await p.locator(".ps-undo-bar").count(), 0);
    assert.match(await counter(p), /^1 of 7 · 7 left · 0 to keep/);
  });

  await t("edited words are what is sent, Ctrl+Enter sends, and a send cannot be undone after", async () => {
    await p.locator("#psDraft").fill("Friday works. Thanks!");
    await p.locator("#psDraft").press("Control+Enter");
    await p.waitForTimeout(3600);
    assert.match(await p.locator(".ps-toast").textContent(), /Sent: Can we move/);
    assert.match(await counter(p), / · 1 sent · /);
    await p.keyboard.press("u");
    assert.match(await p.locator(".ps-toast").textContent(), /cannot be undone/);
  });

  await t("Y, N and S answer too, and Enter on a review with only sends is Done", async () => {
    await p.locator("#psDraft").waitFor();
    await p.keyboard.press("n"); await p.keyboard.press("s");
    assert.match(await counter(p), /^4 of 7 .* 1 sent · 0 to keep · 1 to clear/);
    await p.keyboard.press("u");
    await p.keyboard.press("Escape");
    assert.equal(await p.locator('[data-ps="save"]').textContent(), "Save: clear 1");
    await p.keyboard.press("u");
    assert.equal(await p.locator(".ps-review").count(), 0);   // undo brings the card back from the review
    await p.keyboard.press("Escape");
    assert.equal(await p.locator('[data-ps="finish"]').textContent(), "Done");
    await p.keyboard.press("Enter");
    assert.equal(await p.locator(".ps-overlay").count(), 0);
    assert.match(await p.locator("#resultTags").textContent(), /1 sent/);
  });

  await t("a fit number, the job's asks, a folded section, and a Mine/Everyone switch", async () => {
    await p.click('[data-demo="sheet"]');
    assert.equal(await p.locator(".ps-chip.on").textContent(), "Applied this week (4)");
    assert.equal(await p.locator(".ps-badge-num b").textContent(), "86%");
    assert.equal(await p.locator(".ps-checks li").count(), 3);
    assert.equal(await p.locator(".ps-fold[open]").count(), 0);
    if (DOCS) await shot(p, "card-sheet");
    await p.click('.ps-chip >> text=Everyone');
    assert.match(await counter(p), /^1 of 5/);
    await p.keyboard.press("ArrowRight");
    assert.equal(await p.locator(".ps-chip").first().isDisabled(), true);   // no switching after an answer
    await p.keyboard.press("u");
    await p.click('[data-ps="close"]');
  });

  await t("the start bar opens one sprint over several piles, in their order", async () => {
    await p.click("#allBar .ps-start");
    assert.match(await p.locator(".ps-overlay .ps-title").textContent(), /Waiting on your answer/);
    for (let i = 0; i < 4; i++) { await p.keyboard.press("ArrowDown"); }
    assert.match(await p.locator(".ps-overlay .ps-title").textContent(), /Applicants to screen/);
    await p.click('[data-ps="close"]');
    await p.click('[data-ps="hide"]').catch(() => {});
  });

  await t("dragging past the mark keeps, a short drag springs back", async () => {
    await p.click('.cta [data-demo="photos"]');
    const card = p.locator("[data-ps-card]"), b = await card.boundingBox();
    const y = b.y + 120, x = b.x + b.width / 2;
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 60, y, { steps: 5 }); await p.mouse.up();
    assert.match(await counter(p), /^1 of 8/);
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 90, y, { steps: 4 }); await p.mouse.move(x + 170, y + 4, { steps: 4 });
    if (DOCS) await shot(p, "card-photo-drag");
    await p.mouse.up();
    assert.match(await counter(p), /^2 of 8 · 7 left · 1 to keep/);
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x - 180, y, { steps: 8 }); await p.mouse.up();
    assert.match(await counter(p), /1 to keep · 1 to set aside/);
  });

  await t("Close with no answers leaves at once", async () => {
    await p.keyboard.press("u"); await p.keyboard.press("u");
    await p.click('[data-ps="close"]');
    assert.equal(await p.locator(".ps-overlay").count(), 0);
  });

  await t("a failed save names the item and can be tried again", async () => {
    const out = await p.evaluate(async () => {
      let tries = 0;
      const done = PileSprint.open({ title: "Test", items: [{ id: "a", title: "Alpha" }, { id: "b", title: "Beta" }],
        save: { drop: async it => { if (it.id === "b" && tries++ === 0) throw new Error("Locked"); } } });
      const key = k => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
      key("ArrowLeft"); key("ArrowLeft"); key("Enter");
      await new Promise(r => setTimeout(r, 50));
      const first = document.querySelector(".ps-cleared").innerText;
      document.querySelector('[data-ps="retry"]').click();
      await new Promise(r => setTimeout(r, 50));
      const second = document.querySelector(".ps-cleared .ps-name").innerText;
      document.querySelector('[data-ps="finish"]').click();
      const r = await done;
      return { first, second, saved: r.saved.map(d => d.id).sort() };
    });
    assert.match(out.first, /1 saved, 1 not saved/); assert.match(out.first, /Beta/); assert.match(out.first, /Locked/);
    assert.equal(out.second, "All clear. Good job.");
    assert.deepEqual(out.saved, ["a", "b"]);
  });

  await t("O opens the item's link, a missing answer has no button, a clean pile gets confetti", async () => {
    const [pop] = await Promise.all([p.waitForEvent("popup"), p.evaluate(() => {
      PileSprint.open({ items: [{ id: 1, title: "One", link: "examples/embed.html" }, { id: 2, title: "Two" }], kinds: { default: { drop: false } } });
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "o", bubbles: true }));
    })]);
    assert.match(pop.url(), /examples\/embed\.html/); await pop.close();
    assert.equal(await p.locator('.ps-overlay [data-ps="drop"]').count(), 0);
    await p.keyboard.press("ArrowLeft");                      // nothing on the left: nothing happens
    assert.match(await counter(p), /^1 of 2/);
    await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("Enter");
    await p.locator(".ps-cleared").waitFor();
    assert.equal(await p.locator(".ps-cleared .ps-name").textContent(), "All clear. Good job.");
    assert.equal(await p.locator(".ps-confetti").count(), 1);
    await p.waitForTimeout(500);
    if (DOCS) await shot(p, "cleared");
    await p.keyboard.press("Enter");
  });

  await t("the words sent are the words on the card after editing", async () => {
    const got = await p.evaluate(async () => {
      let sent = null;
      const done = PileSprint.open({ items: [{ id: "r", title: "Reply", draft: "Original words" }], kinds: { default: { keep: "Send", now: true } },
        nowSeconds: 1, save: { now: async (it, text) => { sent = text; return true; } } });
      const ta = document.getElementById("psDraft"); ta.value = "Edited words"; ta.dispatchEvent(new Event("input"));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      await new Promise(r => setTimeout(r, 1300));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      const r = await done;
      return { sent, now: r.now.map(d => d.id) };
    });
    assert.deepEqual(got, { sent: "Edited words", now: ["r"] });
  });

  await t("text from the pile is shown as text, unsafe links are dropped", async () => {
    const html = await p.evaluate(() => {
      PileSprint.open({ items: [{ id: "x", title: "<img src=x onerror=alert(1)>", link: "javascript:alert(1)", image: "javascript:1" }] });
      const h = document.querySelector("[data-ps-card]").innerHTML;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return h;
    });
    assert.ok(!/<img/.test(html)); assert.ok(!/javascript:/.test(html)); assert.match(html, /&lt;img/);
  });

  await t("any CSV file becomes cards: a name column for the title, the rest as lines", async () => {
    await p.setInputFiles("#pickCSV", { name: "orders.csv", mimeType: "text/csv",
      buffer: Buffer.from('Order,name,notes,Total\n1042,"Lee, Jo","Asked for gift wrap",€42\n1043,Sam Rivera,,€18\n') });
    await p.locator(".ps-overlay").waitFor();
    assert.equal(await p.locator(".ps-overlay .ps-name").textContent(), "Lee, Jo");
    assert.match(await p.locator(".ps-overlay .ps-rows").innerText(), /Order\s+1042[\s\S]*Total\s+€42/);
    assert.match(await p.locator(".ps-overlay .ps-title").textContent(), /orders/);
    await p.click('[data-ps="close"]');
  });
  await p.close();

  const m = await page(390, 844);
  await t("at 390 wide the page and the card fit", async () => {
    assert.equal(await m.evaluate(() => document.documentElement.scrollWidth), 390);
    if (DOCS) await m.screenshot({ path: path.join(ROOT, "docs/home-phone.png") });
    await m.click('.cta [data-demo="photos"]');
    const b = await m.locator("[data-ps-card]").boundingBox();
    assert.ok(b.x >= 0 && b.x + b.width <= 390, "card inside the screen");
    const keep = await m.locator('[data-ps="keep"]').boundingBox();
    assert.ok(keep.y + keep.height <= 844, "the answers are on screen without scrolling");
    if (DOCS) await shot(m, "phone-photo");
    await m.click('[data-ps="close"]');
    await m.click('.cta [data-demo="inbox"]');
    await m.locator("#psDraft").waitFor();
    const send = await m.locator('[data-ps="keep"]').boundingBox();
    assert.ok(send.y + send.height <= 844, "Send is on screen with a draft on the card");
    if (DOCS) await shot(m, "phone-message");
  });
  await m.close();

  assert.deepEqual(errors, [], "no errors on the page");
  console.log(`\n${n} browser checks passed`);
} finally {
  await browser.close();
  server.close();
}
