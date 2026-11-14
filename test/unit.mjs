// Core, sources and destinations, in plain Node: node test/unit.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Core = require("../src/core.js");
const Src = require("../src/sources.js");
const Dest = require("../src/destinations.js");

let n = 0;
async function t(name, fn) { await fn(); n++; console.log("ok", n, name); }

const pile = () => [{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }, { id: "d", title: "D" }];

await t("decide, later and counts", () => {
  const s = Core.createSession(pile());
  s.decide("keep"); s.decide("drop"); s.decide("later");
  assert.deepEqual(s.counts(), { keep: 1, drop: 1, now: 0, left: 2, total: 4, seen: 3 });
  assert.equal(s.current().id, "d");
});

await t("undo walks back one press and clears its answer", () => {
  const s = Core.createSession(pile());
  s.decide("keep"); s.decide("drop");
  assert.equal(s.undo(), true);
  assert.equal(s.current().id, "b");
  assert.equal(s.answers.b, undefined);
  assert.equal(s.undo(), true); assert.equal(s.undo(), false);   // nothing left to undo
});

await t("illegal moves are refused", () => {
  const s = Core.createSession([{ id: "x" }]);
  assert.throws(() => s.decide("maybe"));
  assert.equal(s.decide("keep"), true);
  assert.equal(s.decide("drop"), false);                          // the pile is done
  assert.equal(s.finishEarly(), false);
  assert.throws(() => Core.createSession([{ id: 1 }, { id: "1" }]), /share the id/);
  assert.throws(() => Core.createSession("nope"));
});

await t("closing early keeps the answers and undo reopens", () => {
  const s = Core.createSession(pile());
  s.decide("drop"); s.finishEarly();
  assert.equal(s.isDone(), true); assert.equal(s.early, true);
  assert.deepEqual(s.decisions().map(d => d.decision), ["drop", "later", "later", "later"]);
  s.undo(); assert.equal(s.early, false); assert.equal(s.current().id, "a");
});

await t("labels come from the item's kind", () => {
  const opts = { title: "Inbox", kinds: { reply: { title: "Replies", keep: "Answer" } } };
  const l = Core.labelsFor(opts, { kind: "reply" });
  assert.deepEqual([l.title, l.keep, l.drop, l.later, l.now], ["Replies", "Answer", "Drop", "Later", false]);
  const f = { kinds: { default: { keep: it => it.draft ? "Send" : "Write it", drop: false, now: it => !!it.draft } } };
  assert.equal(Core.labelsFor(f, { draft: "hi" }).keep, "Send");
  assert.equal(Core.labelsFor(f, {}).keep, "Write it");
  assert.equal(Core.labelsFor(f, {}).drop, false);
  assert.equal(Core.labelsFor(f, { draft: "hi" }).now, true);
  assert.equal(Core.labelsFor(opts, { kind: "other" }).keep, "Keep");
});

await t("save runs drops first, carries on past a failure, and names it", async () => {
  const s = Core.createSession(pile());
  s.decide("keep"); s.decide("drop"); s.decide("drop"); s.decide("later");
  const order = [], steps = [];
  const r = await Core.runSave(s, {
    drop: async it => { order.push("drop " + it.id); if (it.id === "b") throw new Error("locked"); },
    keep: async it => { order.push("keep " + it.id); }
  }, p => steps.push(p.step + p.i));
  assert.deepEqual(order, ["drop b", "drop c", "keep a"]);
  assert.deepEqual(r.saved.map(d => d.id).sort(), ["a", "c"]);
  assert.deepEqual(r.failed.map(f => [f.id, f.error]), [["b", "locked"]]);
  assert.deepEqual(r.later.map(d => d.id), ["d"]);
  assert.deepEqual(steps, ["drop1", "drop2", "keep1"]);
});

await t("a batch gets every decision once; refusing it fails them all", async () => {
  const s = Core.createSession(pile()); s.decide("keep"); s.decide("drop");
  let got = null;
  const ok = await Core.runSave(s, { batch: d => { got = d; return true; } });
  assert.equal(got.length, 4); assert.equal(ok.saved.length, 2);
  const no = await Core.runSave(s, { batch: () => false });
  assert.equal(no.saved.length, 0); assert.equal(no.failed.length, 2);
});

await t("no handler: the answers are the result", async () => {
  const s = Core.createSession(pile()); s.decide("drop");
  const r = await Core.runSave(s);
  assert.deepEqual(r.saved.map(d => d.id), ["a"]);
});

await t("CSV: quotes, commas, line breaks, known columns", () => {
  const rows = Src.parseCSV('name,notes,City\r\n"Lee, Jo","said ""hi""\nthen left",Porto\n\nSam,,\n');
  assert.deepEqual(rows, [["name", "notes", "City"], ["Lee, Jo", 'said "hi"\nthen left', "Porto"], ["Sam", "", ""]]);
  const items = Src.fromCSV('id,name,notes,City\n7,Lee,hello,Porto\n,Sam,,');
  assert.deepEqual(items[0], { id: "7", title: "Lee", body: "hello", fields: [["City", "Porto"]], row: 2 });
  assert.equal(items[1].id, "row-3");
});

await t("JSON: an array or an object with items", () => {
  assert.equal(Src.fromJSON('[{"id":1}]').length, 1);
  assert.equal(Src.fromJSON({ items: [{ id: 1 }, { id: 2 }] }).length, 2);
  assert.throws(() => Src.fromJSON("{}"), /no list/);
});

await t("endpoint: token in the header, not the URL", async () => {
  let seen;
  const fake = async (url, init) => { seen = { url, init }; return { ok: true, json: async () => [{ id: "z" }] }; };
  const items = await Src.fromEndpoint("https://example.test/pile", { token: "s3cret", fetch: fake });
  assert.equal(items[0].id, "z");
  assert.equal(seen.url, "https://example.test/pile");
  assert.equal(seen.init.headers.Authorization, "Bearer s3cret");
});

await t("CSV export guards against spreadsheet formulas", () => {
  const csv = Dest.toCSV([{ id: "1", decision: "keep", item: { title: "=HYPERLINK(\"x\")" } }]);
  assert.match(csv, /'=HYPERLINK/);
});

await t("webhook: envelope, retries a 5xx, stops on a 4xx", async () => {
  const calls = [];
  const flaky = async (url, init) => { calls.push(JSON.parse(init.body)); return { ok: calls.length > 1, status: calls.length > 1 ? 200 : 503 }; };
  const h = Dest.webhook({ url: "https://example.test/hook", pile: "Inbox", fetch: flaky, wait: async () => {} });
  const ds = [{ id: "a", decision: "keep", item: { title: "A", image: "blob:x" } }];
  assert.equal(await h.batch(ds), true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].format, "pile-sprint/1");
  assert.deepEqual(calls[0].decisions, [{ id: "a", decision: "keep", title: "A" }]);   // no picture address leaves
  let tries = 0;
  const refuse = Dest.webhook({ url: "https://example.test/hook", fetch: async () => { tries++; return { ok: false, status: 403 }; }, wait: async () => {} });
  await assert.rejects(refuse.batch(ds), /403/);
  assert.equal(tries, 1);
});

await t("folder: a drop moves into Set aside, the copy fallback checks size first", async () => {
  const made = {};
  const dir = {
    removed: [],
    async getDirectoryHandle(name) { made[name] = made[name] || { files: {}, async getFileHandle(n) { const f = { name: n, data: null,
      async createWritable() { return { write: async b => { f.data = b; }, close: async () => {} }; }, async getFile() { return f.data; } }; this.files[n] = f; return f; } }; return made[name]; },
    async removeEntry(n) { this.removed.push(n); }
  };
  const moved = [];
  const withMove = { name: "a.jpg", move: async target => { moved.push(target === made["Set aside"]); } };
  const noMove = { name: "b.jpg", getFile: async () => ({ size: 5 }) };
  const h = Dest.folder(dir);
  assert.equal(typeof h.keep, "undefined");          // keep leaves the file where it is
  await h.drop({ handle: withMove });
  await h.drop({ handle: noMove });
  assert.deepEqual(moved, [true]);
  assert.equal(made["Set aside"].files["b.jpg"].data.size, 5);
  assert.deepEqual(dir.removed, ["b.jpg"]);
});

await t("both() runs two destinations in turn", async () => {
  const log = [];
  const h = Dest.both({ drop: async i => log.push("move " + i.id) }, { batch: async () => log.push("file") });
  await h.drop({ id: "a" }); await h.batch([]);
  assert.deepEqual(log, ["move a", "file"]);
});

await t("order groups kinds, keeping each group's own order", () => {
  const s = Core.createSession([{ id: 1, kind: "b" }, { id: 2, kind: "a" }, { id: 3, kind: "b" }, { id: 4, kind: "a" }], { order: ["a", "b"] });
  assert.deepEqual(s.items.map(i => i.id), ["2", "4", "1", "3"]);
});

await t("now: counted apart, skipped by Save, locked once it ran", async () => {
  const s = Core.createSession(pile());
  s.decide("now"); s.decide("keep");
  assert.equal(s.counts().now, 1);
  const r = await Core.runSave(s, { keep: async () => true });
  assert.deepEqual(r.saved.map(d => d.id), ["b"]);
  assert.deepEqual(r.now.map(d => d.id), ["a"]);
  s.lock("a"); assert.equal(s.undo(), true); assert.equal(s.undo(), false);   // b comes back, a cannot
});

await t("a stopped now goes back: on screen if last, else later", () => {
  const s = Core.createSession(pile());
  s.decide("now"); assert.equal(s.cancelNow("a"), true); assert.equal(s.current().id, "a");
  s.decide("now"); s.decide("keep"); s.cancelNow("a");
  assert.equal(s.current().id, "c"); assert.equal(s.answers.a, undefined); assert.equal(s.hist.length, 1);
});

await t("switching the view only before the first answer", () => {
  const s = Core.createSession(pile());
  assert.equal(s.replace([{ id: "z" }]), true); assert.equal(s.size(), 1);
  s.decide("keep"); assert.equal(s.replace(pile()), false);
});

console.log(`\n${n} unit checks passed`);
