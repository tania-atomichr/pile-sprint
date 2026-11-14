// Records the frames for docs/demo.gif: node scripts/demo-frames.mjs && python3 scripts/frames_to_gif.py
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "test/out/frames");
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } fs.createReadStream(p).pipe(r); }).listen(0);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 680 } });
await p.goto(`http://localhost:${server.address().port}/index.html`); await p.evaluate(() => document.fonts.ready);
let i = 0;
const snap = async (hold = 1) => { for (let k = 0; k < hold; k++) await p.screenshot({ path: path.join(OUT, String(i++).padStart(4, "0") + ".png") }); };
await snap(6);
await p.click('.cta [data-demo="photos"]'); await p.waitForTimeout(250); await snap(5);
const box = await p.locator("[data-ps-card]").boundingBox(), x = box.x + box.width / 2, y = box.y + 120;
async function drag(dx) {
  await p.mouse.move(x, y); await p.mouse.down();
  for (let s = 1; s <= 6; s++) { await p.mouse.move(x + dx * s / 6, y + s, { steps: 2 }); await snap(); }
  await p.mouse.up(); for (let s = 0; s < 3; s++) { await p.waitForTimeout(90); await snap(); } await snap(3);
}
await drag(190);
await drag(-190);
await drag(-190);
for (const k of ["ArrowDown", "ArrowRight", "ArrowLeft", "ArrowRight", "ArrowRight"]) {
  await p.keyboard.press(k); for (let s = 0; s < 3; s++) { await p.waitForTimeout(90); await snap(); } await snap(3);
}
await p.waitForTimeout(300); await snap(10);
await p.keyboard.press("Enter"); await p.waitForTimeout(300); await snap(12);
await b.close(); server.close();
console.log(i, "frames in", OUT);
