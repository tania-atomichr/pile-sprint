/* Where a pile comes from. Every source returns plain items:
 *
 *   { id, kind?, title, subtitle?, image?, body?, bodyLabel?, fields?: [[label, value]], link? }
 *
 * Anything else on the item is carried through untouched, so a destination gets back exactly what the source gave.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PileSprintSources = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|heic)$/i;
  // Column names a spreadsheet can use to fill the card; every other column becomes a field row
  var KNOWN = { id: "id", title: "title", name: "title", subject: "title", subtitle: "subtitle", from: "subtitle",
    body: "body", text: "body", description: "body", notes: "body", image: "image", photo: "image", picture: "image",
    url: "link", link: "link", kind: "kind", type: "kind" };

  // RFC 4180 quoting: commas, quotes and line breaks inside "..." cells
  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false, i = 0, t = String(text || "").replace(/^﻿/, "");
    for (; i < t.length; i++) {
      var c = t[i];
      if (q) {
        if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && t[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else cell += c;
    }
    row.push(cell);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    return rows;
  }

  function fromRows(rows, map) {
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return String(h).trim(); });
    map = map || {};
    return rows.slice(1).map(function (r, n) {
      var item = { fields: [] };
      head.forEach(function (h, i) {
        var v = r[i] === undefined ? "" : r[i];
        var role = map[h] || KNOWN[h.toLowerCase()];
        if (role && item[role] === undefined) item[role] = v;
        else if (v !== "") item.fields.push([h, v]);
      });
      if (item.id === undefined || item.id === "") item.id = "row-" + (n + 2);   // the spreadsheet's own row number
      if (!item.title) item.title = item.fields.length ? String(item.fields[0][1]) : "Row " + (n + 2);
      item.row = n + 2;
      return item;
    });
  }

  function fromCSV(text, map) { return fromRows(parseCSV(text), map); }

  function fromArray(list, mapFn) {
    if (!Array.isArray(list)) throw new TypeError("Expected an array");
    return typeof mapFn === "function" ? list.map(mapFn) : list.slice();
  }

  // A JSON array, or an object with an "items" array (what the webhook format sends back)
  function fromJSON(textOrValue, mapFn) {
    var v = typeof textOrValue === "string" ? JSON.parse(textOrValue) : textOrValue;
    var list = Array.isArray(v) ? v : v && Array.isArray(v.items) ? v.items : null;
    if (!list) throw new Error("The JSON has no list of items");
    return fromArray(list, mapFn);
  }

  // Your own system: GET a URL that answers with the items. The token goes in the Authorization header, never the URL
  async function fromEndpoint(url, opts) {
    opts = opts || {};
    var headers = { Accept: "application/json" };
    if (opts.token) headers.Authorization = "Bearer " + opts.token;
    var f = opts.fetch || fetch;
    var r = await f(url, { headers: headers, credentials: opts.credentials || "omit" });
    if (!r.ok) throw new Error("The pile did not load (" + r.status + ")");
    return fromJSON(await r.json(), opts.map);
  }

  function sizeLabel(n) {
    if (!(n >= 0)) return "";
    if (n < 1024) return n + " B";
    if (n < 1048576) return Math.round(n / 1024) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }
  function dayLabel(ms) {
    if (!ms) return "";
    try { return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch (_) { return new Date(ms).toISOString(); }
  }

  function photoItem(file, extra) {
    var item = {
      id: (extra && extra.path) || file.name,
      title: file.name,
      image: typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(file) : "",
      fields: [["Size", sizeLabel(file.size)], ["Changed", dayLabel(file.lastModified)]],
      size: file.size,
      lastModified: file.lastModified
    };
    if (extra) for (var k in extra) item[k] = extra[k];
    return item;
  }

  // Photos picked with a file input. Works in every browser; the browser cannot move these files, so the result is a list
  function fromPhotoFiles(files) {
    return Array.prototype.filter.call(files || [], function (f) { return IMAGE_EXT.test(f.name) || /^image\//.test(f.type || ""); })
      .sort(function (a, b) { return (a.lastModified || 0) - (b.lastModified || 0) || a.name.localeCompare(b.name); })
      .map(function (f) { return photoItem(f); });
  }

  // A folder the browser may change (Chrome and Edge on a computer). Top level only: a sprint over a whole photo
  // library would be thousands of cards, and the set-aside folder must not be read back in as part of the pile.
  async function fromPhotoFolder(dir, opts) {
    opts = opts || {};
    if (!dir) {
      if (typeof showDirectoryPicker !== "function") throw new Error("This browser cannot open a folder. Pick the photos instead.");
      dir = await showDirectoryPicker({ mode: "readwrite", id: "pile-sprint-photos" });
    }
    var skip = opts.skip || ["Set aside", "Kept"];
    var out = [];
    for await (var entry of dir.values()) {
      if (entry.kind !== "file" || !IMAGE_EXT.test(entry.name) || skip.indexOf(entry.name) >= 0) continue;
      var file = await entry.getFile();
      out.push(photoItem(file, { path: entry.name, handle: entry }));
    }
    out.sort(function (a, b) { return (a.lastModified || 0) - (b.lastModified || 0) || a.title.localeCompare(b.title); });
    return { items: out, dir: dir };
  }

  return { parseCSV: parseCSV, fromCSV: fromCSV, fromRows: fromRows, fromArray: fromArray, fromJSON: fromJSON,
    fromEndpoint: fromEndpoint, fromPhotoFiles: fromPhotoFiles, fromPhotoFolder: fromPhotoFolder, sizeLabel: sizeLabel };
});
