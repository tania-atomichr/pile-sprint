/* Pile Sprint: the screen. One card at a time over the page; right keeps, left drops, down is later.
 *
 *   PileSprint.open({ title, items, save, kinds, render, onEvent, ... }) -> Promise<result>
 *   PileSprint.startButton({ title, description, count, onStart })      -> a wide button to open a sprint from a page
 *
 * Needs core.js loaded first (window.PileSprintCore). The drag never decides anything itself: it presses the button
 * that is already on the card, so a swipe can never do what the button would not, and a screen without that button
 * (the review) cannot be swiped at all.
 */
(function (root) {
  "use strict";
  var Core = root.PileSprintCore;
  if (!Core) throw new Error("Load core.js before pile-sprint.js");

  var PAST = 110;   // px of drag before letting go counts as an answer
  var BOLT = '<svg class="ps-bolt" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12L13 2z"/></svg>';
  var ICONS = ["check", "x", "clock", "send", "pen", "archive", "star", "trash"];

  function esc(v) {
    return String(v === null || v === undefined ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // only http(s), blob and data:image addresses reach an src or href; anything else (javascript:) is dropped
  function safeUrl(u, forImage) {
    var s = String(u || "").trim();
    if (/^(https?:|blob:)/i.test(s)) return s;
    if (forImage && /^data:image\//i.test(s)) return s;
    if (/^(\.{0,2}\/|[\w.-]+\/)/.test(s) && !/^[a-z][\w+.-]*:/i.test(s)) return s;    // relative paths
    return "";
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function calm() { try { return root.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; } }
  function rowsOf(f) {
    if (!f) return [];
    var list = Array.isArray(f) ? f : Object.keys(f).map(function (k) { return [k, f[k]]; });
    return list.filter(function (r) { return r && r.length >= 2 && r[1] !== "" && r[1] !== null && r[1] !== undefined; });
  }
  function draftOf(item) {
    if (item.draft === undefined || item.draft === null || item.draft === false) return null;
    return typeof item.draft === "string" ? { value: item.draft } : item.draft;
  }

  function sectionHtml(sec) {
    if (!sec) return "";
    var body = "";
    if (sec.text) body += '<p class="ps-words">' + esc(sec.text) + "</p>";
    if (sec.rows) { var r = rowsOf(sec.rows); if (r.length) body += '<div class="ps-rows">' + r.map(function (x) { return '<div class="ps-row"><b>' + esc(x[0]) + "</b><span>" + esc(x[1]) + "</span></div>"; }).join("") + "</div>"; }
    if (sec.checks) body += '<ul class="ps-checks">' + sec.checks.map(function (c) {
      var tone = c.tone === "ok" || c.tone === "mid" || c.tone === "no" ? c.tone : "";
      return '<li class="' + tone + '"><span class="ps-tick" aria-hidden="true"></span><div><b>' + esc(c.label) + "</b>" + (c.note ? "<span>" + esc(c.note) + "</span>" : "") + "</div></li>";
    }).join("") + "</ul>";
    if (sec.messages) body += '<ol class="ps-thread">' + sec.messages.map(function (m) {
      return '<li class="' + (m.mine ? "mine" : "") + '"><div class="ps-who">' + esc(m.from || "") + (m.when ? " · " + esc(m.when) : "") + '</div><p class="ps-words">' + esc(m.text || "") + "</p></li>";
    }).join("") + "</ol>";
    if (!body) return "";
    if (sec.folded) return '<details class="ps-sec ps-fold"><summary>' + esc(sec.title || "More") + "</summary>" + body + "</details>";
    return '<div class="ps-sec">' + (sec.title ? '<div class="ps-h">' + esc(sec.title) + "</div>" : "") + body + "</div>";
  }

  function defaultCard(item, labels, extra) {
    extra = extra || {};
    var img = safeUrl(item.image, true), link = safeUrl(item.link, false);
    var badge = item.badge && item.badge.value !== undefined && item.badge.value !== null ? item.badge : null;
    var tone = badge && /^(ok|mid|no)$/.test(badge.tone || "") ? " " + badge.tone : "";
    var name = esc(item.title || "Untitled");
    var draft = draftOf(item);
    return (img ? '<div class="ps-photo"><img src="' + esc(img) + '" alt="' + esc(item.alt || item.title || "") + '" draggable="false"></div>' : "") +
      '<div class="ps-card-body"><div class="ps-head"><div class="ps-head-words">' +
      (labels.title && item.kind ? '<div class="ps-kind">' + esc(labels.title) + "</div>" : "") +
      '<div class="ps-name">' + (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + name + "</a>" : name) + "</div>" +
      (item.subtitle ? '<div class="ps-sub">' + esc(item.subtitle) + "</div>" : "") +
      (item.meta ? '<div class="ps-meta">' + esc(item.meta) + "</div>" : "") + "</div>" +
      (badge ? '<div class="ps-badge-num' + tone + '"><b>' + esc(badge.value) + "</b><span>" + esc(badge.label || "") + "</span></div>" : "") + "</div>" +
      (item.body ? sectionHtml({ title: item.bodyLabel, text: item.body }) : "") +
      (item.sections || []).filter(function (s) { return !s.folded; }).map(sectionHtml).join("") +
      (extra.preparing ? '<div class="ps-sec ps-preparing" role="status"><span class="ps-spin" aria-hidden="true"></span>' + esc(extra.preparing) + "</div>" : "") +
      (draft ? '<div class="ps-sec ps-draft"><label class="ps-h" for="psDraft">' + esc(draft.label || "Your words") + "</label>" +
        '<textarea id="psDraft" class="ps-text" rows="3" placeholder="' + esc(draft.placeholder || "") + '">' + esc(extra.text !== undefined ? extra.text : draft.value || "") + "</textarea>" +
        (draft.note ? '<div class="ps-note">' + esc(draft.note) + "</div>" : "") + "</div>" : "") +
      (rowsOf(item.fields).length ? sectionHtml({ rows: item.fields }) : "") +
      (item.sections || []).filter(function (s) { return s.folded; }).map(sectionHtml).join("") +
      (link ? '<div class="ps-linkrow"><a class="ps-link" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + esc(item.linkLabel || "Open the original") + ' ↗</a><span class="ps-key">or press <kbd>O</kbd></span></div>' : "") +
      "</div>";
  }

  // Confetti over the all-clear card: a short burst on a canvas, once per key per day on this browser
  function confetti(host, key) {
    if (calm() || !host) return;
    var k = "pile-sprint-clear:" + key + ":" + new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem(k)) return; localStorage.setItem(k, "1"); } catch (_) {}
    var c = document.createElement("canvas");
    c.className = "ps-confetti"; c.setAttribute("aria-hidden", "true");
    host.appendChild(c);
    var r = host.getBoundingClientRect(), dpr = root.devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr;
    var ctx = c.getContext("2d"); if (!ctx) return;
    ctx.scale(dpr, dpr);
    var cs = getComputedStyle(host);
    var colours = [cs.getPropertyValue("--ps-accent") || "#9140B0", cs.getPropertyValue("--ps-later") || "#F2C050", "#111111", "#a92e64"];
    var bits = [];
    for (var i = 0; i < 80; i++) bits.push({ x: r.width / 2, y: r.height * 0.35, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 9 - 3,
      w: 5 + Math.random() * 5, h: 8 + Math.random() * 6, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, col: colours[i % colours.length].trim() });
    var t0 = performance.now();
    (function tick(now) {
      var dt = now - t0;
      ctx.clearRect(0, 0, r.width, r.height);
      bits.forEach(function (b) {
        b.vy += 0.25; b.x += b.vx; b.y += b.vy; b.a += b.va;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.col; ctx.globalAlpha = Math.max(0, 1 - dt / 2600);
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
      });
      if (dt < 2600) requestAnimationFrame(tick); else c.remove();
    })(t0);
  }

  function open(opts) {
    opts = opts || {};
    var views = Array.isArray(opts.views) && opts.views.length ? opts.views : null;
    var view = 0;
    var session = Core.createSession(views ? views[0].items : opts.items || [], opts);
    var words = Object.assign({ keep: "to keep", drop: "to drop", now: "done" }, opts.counterWords || {});
    var handlers = opts.save || {};
    var nowSeconds = opts.nowSeconds === undefined ? 3 : opts.nowSeconds;
    var tell = function (name, data) { try { if (typeof opts.onEvent === "function") opts.onEvent(name, data || {}); } catch (_) {} };
    var host = opts.container || document.body;
    var prevFocus = document.activeElement;
    var state = { saving: "", result: null, prev: null, texts: {}, ready: {}, pending: {}, failed: {}, timers: {} };
    var resolve;
    var done = new Promise(function (r) { resolve = r; });

    if (!session.size() && !(views && views.some(function (v) { return v.items && v.items.length; }))) {
      resolve({ saved: [], failed: [], now: [], later: [], decisions: [], closed: "empty" }); return done;
    }

    var el = document.createElement("div");
    el.className = "ps-overlay" + (opts.className ? " " + opts.className : "");
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", opts.title || "Sprint");
    el.tabIndex = -1;
    host.appendChild(el);
    document.documentElement.classList.add("ps-locked");

    function toast(msg) {
      var t = el.querySelector(".ps-toast");
      if (!t) { t = document.createElement("div"); t.className = "ps-toast"; t.setAttribute("role", "status"); el.appendChild(t); }
      t.textContent = msg; t.classList.add("on");
      clearTimeout(state.toastT); state.toastT = setTimeout(function () { t.classList.remove("on"); }, 3200);
    }

    // PREPARE: anything slow a card needs (a draft written, a conversation read) is asked for this card and the ones
    // behind it while this one is read, so the next card is ready when it comes up
    function itemFor(i) {
      var base = session.items[i]; if (!base) return null;
      var got = state.ready[base.id];
      if (!got) return base;
      var out = {}; for (var a in base) out[a] = base[a]; for (var b in got) out[b] = got[b];
      out.id = base.id;
      return out;
    }
    function prepareAhead() {
      if (typeof opts.prepare !== "function") return;
      var n = opts.readAhead === undefined ? 3 : opts.readAhead;
      for (var i = session.k; i <= session.k + n && i < session.size(); i++) (function (it) {
        if (state.ready[it.id] || state.pending[it.id] || state.failed[it.id]) return;
        state.pending[it.id] = true;
        Promise.resolve().then(function () { return opts.prepare(it); }).then(function (extra) {
          state.ready[it.id] = extra && typeof extra === "object" ? extra : {};
        }, function (err) {
          state.failed[it.id] = String((err && err.message) || err || "Could not get it ready");
          state.ready[it.id] = {};
        }).then(function () {
          delete state.pending[it.id];
          var cur = session.current();
          if (cur && cur.id === it.id && !state.result && !state.saving) draw();
        });
      })(session.items[i]);
    }
    function readAhead() {
      var n = opts.readAhead === undefined ? 3 : opts.readAhead;
      for (var i = session.k + 1; i <= session.k + n && i < session.size(); i++) {
        var u = safeUrl(itemFor(i).image, true);
        if (u) { var im = new Image(); im.src = u; }
      }
    }

    function counterLine() {
      var c = session.counts();
      var where = state.result ? "Done" : session.isDone() ? "Review" : (session.k + 1) + " of " + c.total + " · " + (c.total - session.k) + " left";
      return where + (c.now ? " · " + c.now + " " + words.now : "") + " · " + c.keep + " " + words.keep + " · " + c.drop + " " + words.drop;
    }
    function top() {
      var c = session.counts(), cur = session.current();
      var title = cur ? session.labels(cur).title || opts.title || "" : opts.title || "";
      var chips = views && !state.result ? '<div class="ps-views" role="group" aria-label="Which part of the pile">' + views.map(function (v, i) {
        return '<button type="button" class="ps-chip' + (i === view ? " on" : "") + '" data-ps-view="' + i + '"' +
          (session.hist.length || state.saving ? ' disabled title="Save or undo what you decided first"' : "") + ">" + esc(v.label) + " (" + (v.items || []).length + ")</button>";
      }).join("") + "</div>" : "";
      return '<div class="ps-top"><div class="ps-titles"><div class="ps-title"><span class="ps-badge">' + BOLT + esc(opts.badge || "Sprint") + "</span> " + esc(title) + "</div>" +
        (opts.context ? '<div class="ps-counter ps-context">' + esc(opts.context) + "</div>" : "") +
        '<div class="ps-counter" aria-live="polite">' + esc(counterLine()) + "</div></div>" +
        '<button type="button" class="ps-close" data-ps="close">Close</button></div>' + chips +
        '<div class="ps-track"><div class="ps-fill" style="width:' + (c.total ? Math.round(100 * c.seen / c.total) : 0) + '%"></div></div>';
    }

    // the toast and the undo bar live across repaints: a send in progress must stay in sight on the next card
    function paint(html) {
      var keep = Array.prototype.slice.call(el.querySelectorAll(".ps-toast, .ps-undo-bar"));
      el.innerHTML = html;
      keep.forEach(function (n) { el.appendChild(n); });
    }
    function iconClass(lab, side, fallback) {
      var i = lab.icons && lab.icons[side];
      return " ps-i-" + (ICONS.indexOf(i) >= 0 ? i : fallback);
    }

    function draw() {
      var c = session.counts();
      var html = top();
      if (state.result) {
        var r = state.result;
        if (!r.failed.length) {
          html += '<div class="ps-card ps-cleared" role="status" data-ps-clear><div class="ps-check" aria-hidden="true"></div><div class="ps-name">' +
            esc(r.later.length ? "Saved." : "All clear. Good job.") + "</div>" +
            '<p class="ps-why">' + esc(opts.clearedText ? opts.clearedText(r) : summary(r)) + "</p></div>" +
            '<div class="ps-actions ps-plain"><button type="button" class="ps-btn ps-primary" data-ps="finish">' + esc(opts.doneLabel || "Done") + "</button></div>";
        } else {
          var names = r.failed.slice(0, 4).map(function (f) { return f.item.title || f.id; });
          html += '<div class="ps-card ps-cleared" role="alert"><div class="ps-name">' + r.saved.length + " saved, " + r.failed.length + " not saved</div>" +
            '<p class="ps-why">These did not save: ' + esc(names.join(", ")) + (r.failed.length > 4 ? " and " + (r.failed.length - 4) + " more" : "") + ". " +
            esc(r.failed[0].error || "") + "</p></div>" +
            '<div class="ps-actions ps-plain"><button type="button" class="ps-btn ps-quiet" data-ps="finish">Done</button>' +
            '<button type="button" class="ps-btn ps-primary" data-ps="retry">Try those again</button></div>';
        }
        paint(html);
        // the clean pile gets its moment: everything decided, saved, nothing left for later
        if (!r.failed.length && !r.later.length && opts.celebrate !== false) confetti(el.querySelector("[data-ps-clear]"), opts.celebrateKey || opts.title || "pile");
        return;
      }
      if (session.isDone()) {
        var pend = c.keep + c.drop > 0, any = pend || c.now > 0;
        var parts = [];
        if (c.now) parts.push(c.now + " " + words.now + " from the card");
        parts.push(c.keep + " " + words.keep, c.drop + " " + words.drop);
        if (c.left) parts.push(c.left + " left for later");
        html += '<div class="ps-card ps-review"><div class="ps-name">' + (session.early ? "Save what you decided?" : esc(opts.endTitle || "That was everything.")) + "</div>" +
          '<p class="ps-why">' + esc(parts.join(", ")) + "." + (pend ? " Nothing changes until you press Save." : "") + (opts.saveNote ? " " + esc(opts.saveNote) : "") + "</p></div>" +
          '<div class="ps-actions ps-plain">' +
          (pend || !any ? '<button type="button" class="ps-btn ps-quiet" data-ps="hide"' + (state.saving ? " disabled" : "") + ">" + (pend ? "Close without saving" : "Close") + "</button>" : "") +
          (pend ? '<button type="button" class="ps-btn ps-primary" data-ps="save"' + (state.saving ? " disabled" : "") + ">" +
            esc(state.saving || "Save: " + [c.keep ? words.keep.replace(/^to /, "") + " " + c.keep : "", c.drop ? words.drop.replace(/^to /, "") + " " + c.drop : ""].filter(Boolean).join(", ")) + "</button>"
            : any ? '<button type="button" class="ps-btn ps-primary" data-ps="finish">Done</button>' : "") + "</div>" +
          (session.hist.length && !state.saving ? '<div class="ps-hint">U undo the last one' + (pend ? " · Enter save" : " · Esc close") + "</div>" : "");
        paint(html);
        return;
      }
      var item = itemFor(session.k), lab = session.labels(item);
      var waiting = typeof opts.prepare === "function" && !state.ready[item.id];
      var prepMsg = waiting ? (opts.preparingText || "Getting this ready…") : "";
      var inner = typeof opts.render === "function"
        ? opts.render(item, { esc: esc, labels: lab, defaultCard: defaultCard, preparing: waiting, failed: state.failed[item.id] || "" })
        : defaultCard(item, lab, { preparing: prepMsg, text: state.texts[item.id] });
      var keepWord = lab.keep, ready = lab.now && !waiting && currentText(item);
      html += '<div class="ps-card ps-deck' + (item.image ? " has-photo" : "") + '" data-ps-card>' + (typeof inner === "string" ? inner : "") + "</div>" +
        '<div class="ps-actions ps-round">' +
        (lab.drop ? '<button type="button" class="ps-btn ps-drop" data-ps="drop"><span class="ps-dot' + iconClass(lab, "drop", "x") + '" aria-hidden="true"></span><span>← ' + esc(lab.drop) + "</span></button>" : '<span class="ps-btn ps-gap"></span>') +
        (lab.later ? '<button type="button" class="ps-btn ps-later" data-ps="later"><span class="ps-dot ps-i-clock" aria-hidden="true"></span><span>↓ ' + esc(lab.later) + "</span></button>" : "") +
        (keepWord ? '<button type="button" class="ps-btn ps-keep" data-ps="keep"><span class="ps-dot' + iconClass(lab, "keep", ready ? "send" : "check") + '" aria-hidden="true"></span><span>' + esc(keepWord) + " →</span></button>" : '<span class="ps-btn ps-gap"></span>') +
        "</div>" +
        '<div class="ps-hint">' + [keepWord ? "→ " + keepWord.toLowerCase() + (ready ? ", " + nowSeconds + " seconds to undo" : "") : "", lab.drop ? "← " + lab.drop.toLowerCase() : "", lab.later ? "↓ " + lab.later.toLowerCase() : "", "U undo", item.link ? "O open" : "", "Esc close"].filter(Boolean).join(" · ") + "</div>";
      paint(html);
      if (inner && typeof inner !== "string" && inner.nodeType) el.querySelector("[data-ps-card]").appendChild(inner);
      var ta = el.querySelector("#psDraft");
      if (ta) { fitText(ta); ta.addEventListener("input", function () { state.texts[item.id] = ta.value; fitText(ta); }); }
      var cardEl = el.querySelector("[data-ps-card]"); if (cardEl) cardEl.scrollTop = 0;
      prepareAhead();
      readAhead();
    }
    // the box grows to show every word, until the card would have to scroll
    function fitText(ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight + 2, Math.max(120, root.innerHeight * 0.4)) + "px"; }
    function currentText(item) {
      var d = draftOf(item); if (!d) return "";
      var t = state.texts[item.id] !== undefined ? state.texts[item.id] : d.value || "";
      return String(t).trim();
    }

    function summary(r) {
      var k = r.saved.filter(function (d) { return d.decision === "keep"; }).length, d = r.saved.length - k;
      var bits = [];
      if (r.now && r.now.length) bits.push(r.now.length + " " + words.now + " from the card");
      bits.push(k + " kept", d + " dropped");
      if (r.later.length) bits.push(r.later.length + " left for later");
      return bits.join(", ") + ".";
    }

    function fly(dir, from) {
      var card = el.querySelector("[data-ps-card]");
      if (calm() || !card) return;
      var b = card.getBoundingClientRect(); if (!b.width) return;
      var g = card.cloneNode(true);
      g.removeAttribute("data-ps-card");
      Array.prototype.forEach.call(g.querySelectorAll("[id]"), function (x) { x.removeAttribute("id"); });
      g.className += " ps-ghost"; g.setAttribute("aria-hidden", "true");
      g.style.cssText = "position:fixed;margin:0;left:" + b.left + "px;top:" + b.top + "px;width:" + b.width + "px;height:" + b.height + "px;transform:translateX(" + (from || 0) + "px)";
      el.appendChild(g);
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        g.style.transform = dir === "down" ? "translateY(70vh) scale(.92)" : "translateX(" + (dir === "right" ? "" : "-") + "110vw) rotate(" + (dir === "right" ? "" : "-") + "16deg)";
        g.style.opacity = "0";
      }); });
      setTimeout(function () { g.remove(); }, 420);
    }

    // NEVER ACT OVER WORDS OUT OF SIGHT: before a right that sends, every line of the box must be on screen
    function wordsInView() {
      var ta = el.querySelector("#psDraft"), card = el.querySelector("[data-ps-card]");
      if (!ta || !card) return true;
      var a = ta.getBoundingClientRect(), b = card.getBoundingClientRect();
      return !(ta.scrollHeight > ta.clientHeight + 4 || a.top < b.top - 1 || a.bottom > b.bottom + 1);
    }

    function go(what, from) {
      if (state.saving || state.result || session.isDone()) return;
      var item = itemFor(session.k), lab = session.labels(item);
      if (what === "keep" && !lab.keep || what === "drop" && !lab.drop || what === "later" && !lab.later) return;
      if (typeof opts.prepare === "function" && !state.ready[item.id] && what === "keep") { toast("Still getting this one ready. One moment."); return; }
      var text = currentText(item);
      if (draftOf(item)) item.text = state.texts[item.id] !== undefined ? state.texts[item.id] : draftOf(item).value || "";
      var now = what === "keep" && lab.now && text && typeof handlers.now === "function";
      if (now && !wordsInView()) {
        var ta = el.querySelector("#psDraft"); try { ta.scrollIntoView({ block: "nearest" }); } catch (_) {}
        if (!wordsInView()) { toast("Here are all the words. Press right again to go ahead."); return; }
      }
      session.items[session.k].text = item.text;
      if (state.ready[item.id]) for (var key in state.ready[item.id]) session.items[session.k][key] = state.ready[item.id][key];
      fly(what === "keep" ? "right" : what === "drop" ? "left" : "down", from);
      session.decide(now ? "now" : what);
      tell("decide", { id: item.id, decision: now ? "now" : what });
      if (now) runNow(session.items[session.k - 1], text);
      draw();
    }

    // A RIGHT THAT RUNS AT ONCE (a send): held a few seconds with Undo, the next card already on screen
    function runNow(item, text) {
      var bar = el.querySelector(".ps-undo-bar");
      var left = nowSeconds;
      var label = (opts.nowText || "Sending") + " " + JSON.stringify(item.title || "this one").replace(/^"|"$/g, "“").replace(/“$/, "”");
      function show() {
        bar = el.querySelector(".ps-undo-bar");
        if (!bar) { bar = document.createElement("div"); bar.className = "ps-undo-bar"; bar.setAttribute("role", "status"); el.appendChild(bar); }
        bar.innerHTML = "<span>" + esc(label) + " in " + left + "…</span><button type=\"button\" data-ps-stop=\"" + esc(item.id) + "\">Undo</button>";
      }
      show();
      var iv = setInterval(async function () {
        left -= 1;
        if (left > 0) { show(); return; }
        clearInterval(iv);
        if (!state.timers[item.id]) return;
        delete state.timers[item.id];
        session.lock(item.id);
        var b = el.querySelector(".ps-undo-bar"); if (b) b.remove();
        try {
          var ok = await handlers.now(item, text);
          if (ok === false) throw new Error("Not done");
          tell("now", { id: item.id });
          toast((opts.nowDoneText || "Sent") + ": " + (item.title || item.id));
        } catch (err) {
          delete session.locked[item.id];
          session.cancelNow(item.id);
          toast("Not sent: " + (item.title || item.id) + ". " + ((err && err.message) || "") + " It is back in the pile.");
        }
        draw();
      }, 1000);
      state.timers[item.id] = { stop: function () { clearInterval(iv); delete state.timers[item.id]; var bb = el.querySelector(".ps-undo-bar"); if (bb) bb.remove(); } };
    }
    function stopNow(id) {
      var t = state.timers[id]; if (!t) return false;
      t.stop(); session.cancelNow(id); tell("undo", { id: id }); draw(); return true;
    }

    function undo() {
      if (state.saving || state.result) return;
      var ids = Object.keys(state.timers);
      if (ids.length) { stopNow(ids[ids.length - 1]); return; }
      if (session.undo()) { tell("undo", {}); draw(); }
      else if (session.hist.length) toast("That one already went. It cannot be undone.");
    }
    function close() {
      if (state.saving) return;
      if (state.result) return finish();
      if (session.hasAnswers()) { if (!session.isDone()) { session.finishEarly(); draw(); } return; }
      hide("closed");
    }
    function hide(how) {
      Object.keys(state.timers).forEach(function (id) { stopNow(id); });
      document.removeEventListener("keydown", onKey, true);
      el.remove();
      document.documentElement.classList.remove("ps-locked");
      try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (_) {}
      tell("close", { how: how });
      var all = session.decisions();
      var r = state.result || { saved: [], failed: [], now: all.filter(function (d) { return d.decision === "now"; }), later: [], decisions: all };
      r.closed = how;
      resolve(r);
    }
    function finish() { hide(state.result ? "saved" : "done"); }

    async function save(only) {
      if (state.saving || Object.keys(state.timers).length) { if (!state.saving) toast("One moment: something is still being sent."); return; }
      var c = session.counts();
      tell("save", { keep: c.keep, drop: c.drop });
      var target = session;
      if (only) {
        // a retry runs the failed ones only, through the same handlers
        var again = Core.createSession(only.map(function (f) { return f.item; }), {});
        only.forEach(function (f) { again.decide(f.decision); });
        target = again;
      }
      state.saving = "Saving…"; state.result = null; draw();
      var r = await Core.runSave(target, handlers, function (p) {
        state.saving = p.step === "batch" ? "Saving…" : (p.step === "drop" ? "Dropping " : "Keeping ") + p.i + " of " + p.n + "…";
        var b = el.querySelector('[data-ps="save"]'); if (b) b.textContent = state.saving;
      });
      if (only && state.prev) {
        r.saved = state.prev.saved.concat(r.saved);
        r.now = state.prev.now; r.later = state.prev.later; r.decisions = state.prev.decisions;
      }
      state.saving = ""; state.result = r; state.prev = r;
      tell("saved", { saved: r.saved.length, failed: r.failed.length });
      draw();
    }

    function openLink() {
      var it = session.current(); if (!it) return;
      var u = safeUrl(itemFor(session.k).link, false);
      if (u) root.open(u, "_blank", "noopener");
    }

    function onKey(ev) {
      var typing = ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName);
      // in the words box, Ctrl or Cmd + Enter is the right answer; every other key types
      if (typing) {
        if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey) && ev.target.id === "psDraft") { ev.preventDefault(); ev.stopPropagation(); run("keep"); }
        else if (ev.key === "Escape") { ev.target.blur(); ev.preventDefault(); ev.stopPropagation(); }
        return;
      }
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key, act = null;
      if (state.result) { if (k === "Escape" || k === "Enter") act = state.result.failed.length && k === "Enter" ? "retry" : "finish"; }
      else if (k === "Escape") act = "close";
      else if (k === "ArrowRight" || k === "y") act = "keep";
      else if (k === "ArrowLeft" || k === "n") act = "drop";
      else if (k === "ArrowDown" || k === "s") act = "later";
      else if (k === "u") act = "undo";
      else if (k === "o") act = "open";
      else if (k === "Enter" && session.isDone()) act = session.hasPending() ? "save" : session.hasAnswers() ? "finish" : null;
      if (!act) return;
      ev.preventDefault(); ev.stopPropagation();
      run(act);
    }
    function run(act, from) {
      if (act === "close") close();
      else if (act === "hide") hide("closed");
      else if (act === "finish") finish();
      else if (act === "save") save();
      else if (act === "retry") save(state.result.failed);
      else if (act === "undo") undo();
      else if (act === "open") openLink();
      else go(act, from);
    }

    el.addEventListener("click", function (ev) {
      // the click that ends a drag (letting go over a link on the card) is the drag's, not a press
      if (Date.now() - drag.ended < 350 && ev.target.closest("[data-ps-card]")) { ev.preventDefault(); return; }
      var stop = ev.target.closest("[data-ps-stop]");
      if (stop) { stopNow(stop.getAttribute("data-ps-stop")); return; }
      var v = ev.target.closest("[data-ps-view]");
      if (v && !v.disabled) {
        var i = +v.getAttribute("data-ps-view");
        if (i !== view && session.replace(views[i].items || [])) { view = i; state.ready = {}; state.pending = {}; state.failed = {}; tell("view", { label: views[i].label }); draw(); }
        return;
      }
      var b = ev.target.closest("[data-ps]");
      if (b && !b.disabled) run(b.getAttribute("data-ps"));
    });

    // the drag: the card follows the hand; past the mark, letting go presses that side's button
    var drag = { d: null, ended: 0 };
    el.addEventListener("pointerdown", function (e) {
      if (e.button || drag.d || state.saving) return;
      var card = e.target.closest("[data-ps-card]");
      if (!card || e.target.closest("a, button, input, textarea, select, summary")) return;
      drag.d = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false, dx: 0, card: card };
    });
    el.addEventListener("pointermove", function (e) {
      var d = drag.d; if (!d || e.pointerId !== d.id) return;
      var dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.on) {
        if (Math.abs(dx) < 10) return;
        if (Math.abs(dy) > Math.abs(dx)) { drag.d = null; return; }   // a scroll, not a swipe
        d.on = true; d.card.classList.add("ps-dragging");
        try { d.card.setPointerCapture(e.pointerId); } catch (_) {}
      }
      e.preventDefault();
      var lab = session.labels(itemFor(session.k));
      var word = dx > 0 ? lab.keep : lab.drop;
      if (!word) dx = dx / 6;                                    // nothing on that side: the card barely moves
      d.dx = dx;
      d.card.style.transform = "translateX(" + dx + "px) rotate(" + (dx / 40) + "deg)";
      d.card.classList.toggle("ps-to-keep", dx > 0 && !!word); d.card.classList.toggle("ps-to-drop", dx < 0 && !!word);
      var stamp = d.card.querySelector(".ps-stamp");
      if (!word) { if (stamp) stamp.remove(); return; }
      if (!stamp) { stamp = document.createElement("div"); stamp.setAttribute("aria-hidden", "true"); d.card.appendChild(stamp); }
      stamp.textContent = word;
      stamp.className = "ps-stamp " + (dx > 0 ? "keep" : "drop") + (Math.abs(dx) >= PAST ? " go" : "");
      stamp.style.opacity = String(Math.min(1, Math.abs(dx) / PAST));
    });
    function end(e, cancelled) {
      var d = drag.d; if (!d || e.pointerId !== d.id) return;
      drag.d = null;
      if (!d.on) return;
      drag.ended = Date.now();
      d.card.classList.remove("ps-dragging", "ps-to-keep", "ps-to-drop");
      d.card.style.transform = "";
      var s = d.card.querySelector(".ps-stamp"); if (s) s.remove();
      if (!cancelled && Math.abs(d.dx) >= PAST) {
        var btn = el.querySelector(d.dx > 0 ? '[data-ps="keep"]' : '[data-ps="drop"]');
        if (btn && !btn.disabled) { drag.ended = 0; run(d.dx > 0 ? "keep" : "drop", d.dx); drag.ended = Date.now(); }
      }
    }
    el.addEventListener("pointerup", function (e) { end(e, false); });
    el.addEventListener("pointercancel", function (e) { end(e, true); });

    document.addEventListener("keydown", onKey, true);
    tell("open", { n: session.size() });
    draw();
    el.focus();
    return done;
  }

  // THE DOOR: one wide button for a page, saying how many and what the keys do; the whole bar is the button
  function startButton(o) {
    o = o || {};
    var b = document.createElement("button");
    b.type = "button"; b.className = "ps-start";
    b.innerHTML = '<span class="ps-start-ico" aria-hidden="true">' + BOLT.replace('width="13" height="13"', 'width="22" height="22"') + "</span>" +
      '<span class="ps-start-words"><b>' + esc((o.badge || "Sprint") + ": " + (o.title || "")) + "</b>" +
      (o.description ? "<span>" + esc(o.description) + "</span>" : "") + "</span>" +
      '<span class="ps-start-go">' + esc(o.label || "Start") + "</span>";
    if (typeof o.onStart === "function") b.addEventListener("click", o.onStart);
    return b;
  }

  root.PileSprint = { open: open, startButton: startButton, escape: esc, defaultCard: defaultCard, version: Core.VERSION };
})(typeof self !== "undefined" ? self : this);
