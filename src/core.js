/* Pile Sprint core: the decisions, with no screen attached.
 *
 * A session walks a pile one item at a time. Each item gets keep, drop or later. Nothing is done to any item until
 * save runs, so a whole sprint can be undone press by press, or abandoned, without touching the pile.
 *
 * Loads as a browser global (window.PileSprintCore) or as a CommonJS module, so the same file is tested in Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PileSprintCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEFAULT_LABELS = { keep: "Keep", drop: "Drop", later: "Later" };
  // "now" is a keep that already ran from the card (a send with its few seconds to undo): Save skips it
  var DECISIONS = ["keep", "drop", "later", "now"];

  // An item's labels come from its kind, so one sprint can mix piles ("Answer" on a reply, "Book" on a lead)
  // A label may be a function of the item, so the right answer can say what it will do for this one ("Send" once
  // a draft is on the card, "Write the first message" before). false removes that answer for the kind.
  function labelsFor(opts, item) {
    var kinds = (opts && opts.kinds) || {};
    var k = (item && item.kind && kinds[item.kind]) || kinds["default"] || {};
    function pick(name) {
      var v = k[name];
      if (typeof v === "function") v = v(item || {});
      if (v === false) return false;
      return v || DEFAULT_LABELS[name];
    }
    return {
      title: k.title || (opts && opts.title) || "",
      keep: pick("keep"), drop: pick("drop"), later: pick("later"),
      icons: k.icons || {},
      now: !!(k.now && (typeof k.now !== "function" || k.now(item || {})))
    };
  }

  // Groups of the pile in the order given (opts.order lists kinds), keeping each group's own order inside
  function ordered(items, order) {
    if (!order || !order.length) return items;
    var rank = function (it) { var i = order.indexOf(it.kind); return i < 0 ? order.length : i; };
    return items.map(function (it, i) { return { it: it, i: i }; })
      .sort(function (a, b) { return rank(a.it) - rank(b.it) || a.i - b.i; })
      .map(function (x) { return x.it; });
  }

  // Items without an id get their position, so a pasted list works; duplicate ids would merge two answers into one
  function normalise(items) {
    if (!Array.isArray(items)) throw new TypeError("Pile Sprint needs an array of items");
    var seen = {};
    return items.map(function (it, i) {
      var item = it && typeof it === "object" ? it : { title: String(it) };
      var id = item.id === undefined || item.id === null || item.id === "" ? "item-" + i : String(item.id);
      if (seen[id]) throw new Error("Two items share the id " + JSON.stringify(id));
      seen[id] = true;
      var out = {};
      for (var key in item) if (Object.prototype.hasOwnProperty.call(item, key)) out[key] = item[key];
      out.id = id;
      return out;
    });
  }

  function createSession(items, opts) {
    opts = opts || {};
    var list = ordered(normalise(items), opts.order);
    var s = {
      items: list,
      k: 0,            // the card on screen; equal to items.length once every card was answered
      early: false,    // closed before the end: the review asks "Save what you decided?"
      hist: [],
      answers: {},     // id -> "keep" | "drop" | "now"; later is the absence of an answer
      locked: {}       // ids whose "now" already ran: no undo can bring them back
    };

    s.size = function () { return list.length; };
    s.current = function () { return s.k < list.length ? list[s.k] : null; };
    s.isDone = function () { return s.k >= list.length; };
    s.labels = function (item) { return labelsFor(opts, item || s.current()); };

    s.decide = function (what) {
      if (DECISIONS.indexOf(what) < 0) throw new Error("Unknown decision " + JSON.stringify(what));
      if (s.isDone()) return false;
      var item = list[s.k];
      if (what === "later") delete s.answers[item.id]; else s.answers[item.id] = what;
      s.hist.push(s.k);
      s.k += 1;
      return true;
    };

    s.undo = function () {
      if (!s.hist.length) return false;
      if (s.locked[list[s.hist[s.hist.length - 1]].id]) return false;
      var i = s.hist.pop();
      delete s.answers[list[i].id];
      s.k = i;
      s.early = false;
      return true;
    };

    s.lock = function (id) { s.locked[String(id)] = true; };

    // A "now" that was stopped before it ran: the item goes back undecided. If it is still the last press the card
    // comes back on screen; otherwise it stays in the pile as later.
    s.cancelNow = function (id) {
      id = String(id);
      if (s.answers[id] !== "now") return false;
      delete s.answers[id];
      var at = -1;
      for (var i = 0; i < list.length; i++) if (list[i].id === id) at = i;
      if (s.hist.length && s.hist[s.hist.length - 1] === at) { s.hist.pop(); s.k = at; s.early = false; }
      else s.hist = s.hist.filter(function (h) { return h !== at; });
      return true;
    };

    // Switching which part of the pile is walked (Mine / Everyone) is only allowed before the first answer
    s.replace = function (items2) {
      if (s.hist.length) return false;
      list = ordered(normalise(items2), opts.order);
      s.items = list; s.k = 0; s.early = false; s.answers = {}; s.locked = {};
      return true;
    };

    s.finishEarly = function () {
      if (s.isDone()) return false;
      s.k = list.length;
      s.early = true;
      return true;
    };

    s.counts = function () {
      var keep = 0, drop = 0, now = 0;
      for (var id in s.answers) { if (s.answers[id] === "keep") keep++; else if (s.answers[id] === "drop") drop++; else if (s.answers[id] === "now") now++; }
      return { keep: keep, drop: drop, now: now, left: list.length - keep - drop - now, total: list.length, seen: Math.min(s.k, list.length) };
    };

    s.hasAnswers = function () { var c = s.counts(); return c.keep + c.drop + c.now > 0; };
    s.hasPending = function () { var c = s.counts(); return c.keep + c.drop > 0; };

    // Every item with its outcome, in pile order. Unanswered items (passed with later, or never reached) are "later"
    s.decisions = function () {
      return list.map(function (item) { return { id: item.id, item: item, decision: s.answers[item.id] || "later" }; });
    };

    return s;
  }

  // Runs the answers through the handlers. handlers.batch gets every decision at once (a file, a webhook);
  // handlers.drop / handlers.keep get one item at a time (moving a file). Drops run first: clearing the pile is the
  // point, and the keeps often open something that would cover the progress. A handler that throws or returns false
  // is a failure for that item only; the rest carry on.
  async function runSave(session, handlers, onProgress) {
    handlers = handlers || {};
    var all = session.decisions();
    var answered = all.filter(function (d) { return d.decision === "keep" || d.decision === "drop"; });
    var saved = [], failed = [];
    var tell = typeof onProgress === "function" ? onProgress : function () {};

    if (typeof handlers.batch === "function") {
      tell({ step: "batch", i: 1, n: 1 });
      try {
        var ok = await handlers.batch(all);
        if (ok === false) throw new Error("The destination refused the decisions");
        saved = answered.slice();
      } catch (err) {
        failed = answered.map(function (d) { return { id: d.id, item: d.item, decision: d.decision, error: String((err && err.message) || err) }; });
      }
    }

    var order = ["drop", "keep"];
    for (var o = 0; o < order.length; o++) {
      var what = order[o], fn = handlers[what];
      if (typeof fn !== "function") continue;
      var these = answered.filter(function (d) { return d.decision === what; });
      for (var i = 0; i < these.length; i++) {
        var d = these[i];
        tell({ step: what, i: i + 1, n: these.length, item: d.item });
        if (failed.some(function (f) { return f.id === d.id; })) continue;   // the batch already failed it
        try {
          var r = await fn(d.item);
          if (r === false) throw new Error("Not done");
          if (!saved.some(function (x) { return x.id === d.id; })) saved.push(d);
        } catch (err) {
          saved = saved.filter(function (x) { return x.id !== d.id; });
          failed.push({ id: d.id, item: d.item, decision: d.decision, error: String((err && err.message) || err) });
        }
      }
    }

    // with no handler at all, the answers are the result: the caller reads them from the promise
    if (typeof handlers.batch !== "function" && typeof handlers.keep !== "function" && typeof handlers.drop !== "function") saved = answered.slice();

    return {
      saved: saved,
      failed: failed,
      now: all.filter(function (d) { return d.decision === "now"; }),
      later: all.filter(function (d) { return d.decision === "later"; }),
      decisions: all
    };
  }

  return { createSession: createSession, runSave: runSave, labelsFor: labelsFor, ordered: ordered, normalise: normalise, DEFAULT_LABELS: DEFAULT_LABELS, VERSION: "1.0.0" };
});
