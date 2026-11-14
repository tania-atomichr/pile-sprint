/* Where the decisions go. Each destination returns the handlers runSave understands:
 *
 *   { batch(decisions) }          every decision at once: a file, a webhook
 *   { drop(item), keep(item) }    one item at a time: moving a file, calling your API per row
 *
 * Combine them with PileSprintDestinations.both(a, b), for example move the photos AND download the list.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PileSprintDestinations = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var FORMAT = "pile-sprint/1";

  // What leaves the browser: the id, the answer and the title. Pictures stay behind (they are often local blob
  // addresses that mean nothing elsewhere); a source that needs more sets item.payload and it is sent as given.
  function wire(d) {
    var out = { id: d.id, decision: d.decision, title: d.item && d.item.title ? String(d.item.title) : "" };
    if (d.item && d.item.kind) out.kind = d.item.kind;
    if (d.item && d.item.payload !== undefined) out.payload = d.item.payload;
    return out;
  }

  function envelope(decisions, pile) {
    return { format: FORMAT, pile: pile || "", decided_at: new Date().toISOString(), decisions: decisions.map(wire) };
  }

  function csvCell(v) {
    var s = v === null || v === undefined ? "" : String(v);
    // a leading = + - @ makes a spreadsheet run the cell as a formula
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCSV(decisions) {
    var lines = [["id", "decision", "title", "kind"].join(",")];
    decisions.forEach(function (d) { var w = wire(d); lines.push([w.id, w.decision, w.title, w.kind || ""].map(csvCell).join(",")); });
    return lines.join("\r\n") + "\r\n";
  }

  function save(name, type, text) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function download(opts) {
    opts = opts || {};
    var fmt = opts.format === "csv" ? "csv" : "json";
    return {
      batch: function (decisions) {
        var stamp = new Date().toISOString().slice(0, 10);
        var name = (opts.filename || "pile-sprint-" + stamp) + "." + fmt;
        if (fmt === "csv") save(name, "text/csv", toCSV(decisions));
        else save(name, "application/json", JSON.stringify(envelope(decisions, opts.pile), null, 2));
        return true;
      }
    };
  }

  // POST the decisions to your own system (or Zapier, Make, n8n, an Apps Script). Retries a network failure or a
  // 5xx twice; a 4xx is your server saying no, which a retry would not change.
  function webhook(opts) {
    opts = opts || {};
    if (!opts.url) throw new Error("webhook needs a url");
    var f = opts.fetch || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
    var wait = opts.wait || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    return {
      batch: async function (decisions) {
        var headers = { "Content-Type": "application/json" };
        if (opts.token) headers.Authorization = "Bearer " + opts.token;
        var body = JSON.stringify(envelope(decisions, opts.pile));
        var last = null;
        for (var attempt = 0; attempt < 3; attempt++) {
          if (attempt) await wait(1000 * Math.pow(2, attempt - 1));
          try {
            var r = await f(opts.url, { method: "POST", headers: headers, body: body, credentials: opts.credentials || "omit" });
            if (r.ok) return true;
            last = new Error("Your system answered " + r.status);
            if (r.status < 500) break;
          } catch (err) { last = err; }
        }
        throw last || new Error("Not sent");
      }
    };
  }

  async function subfolder(dir, name) { return dir.getDirectoryHandle(name, { create: true }); }

  // Moves files on disk (a folder opened with fromPhotoFolder). Drop goes to "Set aside", never the bin, so a wrong
  // answer is one drag back. Keep stays put unless keepTo is given.
  function folder(dir, opts) {
    opts = opts || {};
    var dropTo = opts.dropTo === undefined ? "Set aside" : opts.dropTo;
    var keepTo = opts.keepTo || null;
    async function moveInto(item, name) {
      var h = item.handle;
      if (!h) throw new Error("No file to move");
      var target = await subfolder(dir, name);
      if (typeof h.move === "function") { await h.move(target); return true; }
      // Older browsers: copy, check the copy is whole, then remove the original
      var file = await h.getFile();
      var copy = await target.getFileHandle(h.name, { create: true });
      var w = await copy.createWritable(); await w.write(file); await w.close();
      var back = await copy.getFile();
      if (back.size !== file.size) throw new Error("The copy came out short; the original was left where it was");
      await dir.removeEntry(h.name);
      return true;
    }
    var out = {};
    if (dropTo) out.drop = function (item) { return moveInto(item, dropTo); };
    if (keepTo) out.keep = function (item) { return moveInto(item, keepTo); };
    return out;
  }

  function both() {
    var list = Array.prototype.slice.call(arguments).filter(Boolean);
    function chain(key) {
      var fns = list.map(function (h) { return h[key]; }).filter(function (f) { return typeof f === "function"; });
      if (!fns.length) return undefined;
      return async function (arg) { for (var i = 0; i < fns.length; i++) { if ((await fns[i](arg)) === false) return false; } return true; };
    }
    var out = {};
    ["batch", "keep", "drop"].forEach(function (k) { var c = chain(k); if (c) out[k] = c; });
    return out;
  }

  return { FORMAT: FORMAT, envelope: envelope, toCSV: toCSV, download: download, webhook: webhook, folder: folder, both: both };
});
