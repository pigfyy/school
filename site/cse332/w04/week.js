/* CSE 332 w04: misconception feedback and this week's widgets.
   - svg.htree    AVL tree pictures, and the Lecture 9 / Section 4 steppers .avl-seq, .min-step, .rewire-step
   - .hashcalc    the string hashes h1-h4 of slide 18 for any string, with Horner's rule
   - .hashlab     a hash table of integer keys: separate chaining or linear / quadratic / double-hashing probes */
"use strict";
window.WEEK = window.WEEK || {};
window.WEEK.messages = {
  "not-deepest": "That node is unbalanced too, but the rule rotates at the deepest unbalanced node.",
  "single-for-double": "A single rotation doesn't fix this one: the new key went to the inner side, so it takes two rotations.",
  "fib-not-m": "That's a Fibonacci number. M(h) adds 1 for the root each time: M(h) = M(h−1) + M(h−2) + 1.",
  "off-by-one-height": "Check the definition: height counts edges, and an empty tree has height −1, a single node height 0.",
  "bst-height": "That's a plain BST's height. The AVL rule keeps it much shorter.",
  "nodes-not-leaves": "That's the number of nodes. Count only the nodes with no children.",
  "no-mod": "That's the hash value itself. The index is the hash value % table size.",
  "first-free-not-probe": "Follow the probe sequence: h, h+1, h+2, … (wrapping around), not the first empty slot overall.",
  "linear-not-quadratic": "That's where linear probing would put it. Quadratic probing tries h+1², h+2², h+3², …",
  "lambda-not-half": "That's λ itself. A successful find expects to look at half the bucket, λ/2.",
  "half-not-lambda": "An unsuccessful find has to look at the whole bucket: λ on average, not λ/2.",
  "tomb-is-empty": "A tombstone doesn't end a find. Keep probing past it until a truly empty slot.",
  "counted-index": "Count the slots looked at, including the first one and the one where the search ends.",
  "ascii-sum-order": "Order matters in h3: each character is multiplied by its own power of 31.",
  "forgot-double": "h4 doubles h3. Recompute, or just multiply h3 by 2.",
};

/* AVL */
Object.assign(window.WEEK.messages, {
  "balanced-node": "Work out that node's two child heights again: they differ by at most 1, so it's fine. Look for children that differ by 2.",
  "before-rotation": "That's how the tree looks before the rotation. Which node moves up into that spot?",
  "no-rotation": "That would be the answer with no rotation. Walk back up from the new leaf: some node ends up with children that differ by 2.",
  "subtree-stays": "In the last rotation, the node that moves up hands its inner subtree across to the node that moves down.",
  "forgot-root": "Add 1 for the root: M(h) = M(h−1) + M(h−2) + 1.",
  "bst-not-avl": "That's the AVL tree's limit. A plain BST has no balance rule, so it can be a chain.",
  "full-not-tallest": "That's the shortest a tree with this many nodes can be. The question asks for the tallest an AVL tree can get.",
  "over-m": "An AVL tree that tall needs more nodes than that. Find the largest h with M(h) at most the number of nodes.",
  "height-counts-nodes": "Height counts edges on the longest root-to-leaf path, not nodes.",
  "count-all-bad": "Check every node on the path back up, not just the first: compare each one's two children's heights.",
  "first-two-steps": "The case uses only the key's first two steps down from the unbalanced node. Where did it go at that node, and then at its child?",
  "taller-subtree": "That's the taller subtree, of height h − 1. The shorter one has height h − 2.",
  "max-not-min": "That's the most nodes a tree of height 4 can have: a full tree. The question asks for the fewest.",
  "chain-not-avl": "A chain that tall isn't balanced: each node's two subtrees must differ in height by at most 1.",
});

window.WEEK.widgets = function ({ $, $$, el, REDRAW }) {
  const Sim = window.Sim;
  const NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs = {}, text) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  }
  const fmt = (x) => BigInt(x).toLocaleString("en-US");

  /* AVL =========================================================== Lecture 9 and Section 4: tree pictures and steppers
     svg.htree[data-shape] draws one tree, its nodes placed left to right in key order. Keys are numbers or letters;
     the capitals V-Z are whole subtrees, drawn as triangles. data-new / data-bad / data-cmp / data-cur mark keys (the
     new key, unbalanced nodes, the node a rotation lifted, nodes being updated), data-label="h" writes each height,
     and data-bad-edges / data-new-edges ("a>p,p>b") draw the references a rotation removes or adds, numbered in order.
     Steppers: .avl-seq[data-keys] inserts the keys one step at a time and fills in the insert recipe
     (Sim.avlSeqSteps); .min-step[data-h] builds the smallest AVL trees (Sim.minSteps); .rewire-step walks Section 4's
     right rotation as three reference changes (Sim.rewireSteps). */
  const kf = (k) => (typeof k === "number" && k < 0 ? `−${-k}` : String(k));
  const keyOf = (s) => (/^-?\d+$/.test(s) ? Number(s) : s);
  const isSub = (k) => typeof k === "string" && /^[V-Z]$/.test(k);
  const avlDims = () => (innerWidth < 600 ? { gap: 38, dy: 56, r: 15, pad: 26, top: 24 } : { gap: 48, dy: 62, r: 17, pad: 30, top: 26 });
  // pixel spots in a box wide enough for `cols` nodes and `depth` levels: x by in-order rank, y by depth
  function avlGeom(t, cols, depth) {
    const d = avlDims(), spots = new Map();
    let rank = 0;
    const off = ((cols - Sim.size(t)) * d.gap) / 2;
    const walk = (x, dep) => { if (!x) return; walk(x.left, dep + 1); spots.set(x.key, { x: d.pad + off + (rank++ + 0.5) * d.gap, y: d.top + dep * d.dy }); walk(x.right, dep + 1); };
    walk(t, 0);
    return { d, spots, W: Math.max(cols, 3) * d.gap + 2 * d.pad, H: d.top + Math.max(depth, 0) * d.dy + d.r * 1.5 + 12 };
  }
  function avlPaint(svg, t, spots, geom, { marks = {}, heights = null, edges = {} } = {}) {
    const { d } = geom;
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${geom.W} ${geom.H}`);
    svg.style.maxWidth = `${geom.W}px`;
    if (!t) { svg.append(svgEl("text", { x: geom.W / 2, y: geom.H / 2 + 5, "text-anchor": "middle", class: "av-empty" }, "(empty tree)")); return; }
    const lines = svgEl("g"), tags = svgEl("g"), nodes = svgEl("g");
    const walk = (x) => {
      if (!x) return;
      const p = spots.get(x.key);
      for (const c of [x.left, x.right]) {
        if (!c) continue;
        const q = spots.get(c.key), e = `${x.key}>${c.key}`, n = (edges.bad || {})[e] || (edges.add || {})[e];
        const kind = (edges.bad || {})[e] ? " bad" : (edges.add || {})[e] ? " add" : "";
        lines.append(svgEl("line", { x1: p.x, y1: p.y, x2: q.x, y2: isSub(c.key) ? q.y - d.r : q.y, class: `av-edge${kind}` }));
        if (n) {
          const g = svgEl("g", { class: `av-tag${kind}`, transform: `translate(${((p.x + q.x) / 2).toFixed(1)},${((p.y + q.y) / 2).toFixed(1)})` });
          g.append(svgEl("circle", { r: 9 }), svgEl("text", { y: 4, "text-anchor": "middle" }, String(n)));
          tags.append(g);
        }
      }
      const g = svgEl("g", { class: `av-node${isSub(x.key) ? " sub" : ""} ${marks[x.key] || ""}`.trim(), transform: `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})` });
      if (isSub(x.key)) {
        const r = d.r;
        g.append(svgEl("polygon", { points: `0,${-r} ${-r * 1.15},${r * 1.4} ${r * 1.15},${r * 1.4}` }), svgEl("text", { y: r * 0.85, "text-anchor": "middle" }, x.key));
      } else {
        g.append(svgEl("circle", { r: d.r }), svgEl("text", { y: 5, "text-anchor": "middle" }, kf(x.key)));
        if (heights && heights[x.key] != null) g.append(svgEl("text", { x: d.r + 1, y: -d.r + 4, class: "av-h" }, `h=${kf(heights[x.key])}`));
      }
      nodes.append(g);
      walk(x.left); walk(x.right);
    };
    walk(t);
    svg.append(lines, nodes, tags);
  }
  function avlSay(t) {
    if (!t) return "An empty tree.";
    const parts = [`Root ${kf(t.key)}.`];
    const w = (x) => { if (!x || (!x.left && !x.right)) return; parts.push(`${kf(x.key)}: left ${x.left ? kf(x.left.key) : "empty"}, right ${x.right ? kf(x.right.key) : "empty"}.`); w(x.left); w(x.right); };
    w(t);
    return parts.join(" ");
  }
  const heightsOf = (t) => { const m = {}; const w = (x) => { if (x) { m[x.key] = x.height; w(x.left); w(x.right); } }; w(t); return m; };
  const onNarrowChange = (fn) => { let was = innerWidth < 600; REDRAW.add(() => { if ((innerWidth < 600) !== was) { was = !was; fn(); } }); };
  // Back / Next buttons and a step counter; paint(k) draws step k
  function stepControls(n, paint) {
    const back = el("button", { class: "btn", type: "button", text: "← Back" });
    const next = el("button", { class: "btn primary", type: "button", text: "Next step →" });
    const count = el("span", { class: "note" });
    let k = 0;
    const go = (to) => {
      k = to;
      back.disabled = k === 0;
      next.disabled = k === n - 1;
      count.textContent = k === 0 ? "Press Next step." : k === n - 1 ? "Done." : `Step ${k} of ${n - 1}.`;
      paint(k);
    };
    back.addEventListener("click", () => { if (k > 0) go(k - 1); });
    next.addEventListener("click", () => { if (k < n - 1) go(k + 1); });
    return { box: el("div", { class: "controls" }, back, next, count), go, now: () => k };
  }
  // slide the nodes from where they were drawn last to their new spots
  function slider(svg) {
    let shown = null, raf = 0;
    return {
      reset() { shown = null; },
      draw(t, geom, opts) {
        cancelAnimationFrame(raf);
        const from = shown, to = geom.spots;
        if (!from || !t || matchMedia("(prefers-reduced-motion: reduce)").matches) { avlPaint(svg, t, to, geom, opts); shown = to; return; }
        const t0 = performance.now(), ms = 700;
        const frame = (now) => {
          const u = Math.min(1, (now - t0) / ms), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
          const at = new Map([...to].map(([key, p]) => { const f = from.get(key) || p; return [key, { x: f.x + (p.x - f.x) * e, y: f.y + (p.y - f.y) * e }]; }));
          avlPaint(svg, t, at, geom, opts);
          shown = at;
          if (u < 1) raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      },
    };
  }

  const AVL_PAGES = '.page[id^="l9-"], .page[id^="s4-"]';
  $$(AVL_PAGES).forEach((page) => $$("svg.htree[data-shape]", page).forEach((svg) => {
    const t = Sim.parseShape(svg.dataset.shape);
    const marks = {};
    for (const role of ["new", "bad", "cmp", "cur", "moved", "lsub", "rsub"]) (svg.dataset[role] || "").split(",").filter(Boolean).forEach((k) => { marks[keyOf(k)] = marks[keyOf(k)] ? `${marks[keyOf(k)]} ${role}` : role; });
    const nums = (s) => Object.fromEntries((s || "").split(",").filter(Boolean).map((e, i) => [e, i + 1]));
    const opts = { marks, heights: (svg.dataset.label || "").includes("h") ? heightsOf(t) : null, edges: { bad: nums(svg.dataset.badEdges), add: nums(svg.dataset.newEdges) } };
    if (!svg.hasAttribute("aria-label")) svg.setAttribute("aria-label", avlSay(t));
    const paint = () => { const g = avlGeom(t, Sim.size(t), Sim.height(t)); avlPaint(svg, t, g.spots, g, opts); };
    paint();
    onNarrowChange(paint);
  }));

  // L9: the insert recipe as a card of blanks, filled in by each step of the sequence stepper
  const CASES = [["LL", "left, then left", "rotate right at it"], ["RR", "right, then right", "rotate left at it"],
    ["LR", "left, then right", "rotate left at its left child, then right at it"], ["RL", "right, then left", "rotate right at its right child, then left at it"]];
  function recipeCard() {
    const blank = (f) => el("span", { class: "blank", "data-f": f });
    const rows = [
      el("li", {}, "BST insert: ", blank("key"), " becomes ", blank("where"), "."),
      el("li", {}, "Walk back up from the new leaf, updating heights. The first unbalanced node: ", blank("problem"), "."),
      el("li", {}, "From that node, the key went ", blank("path"), ". Case ", blank("kase"), "."),
      el("li", { "data-row": "fix" }, "Fix it: ", blank("fix"), ". Then stop."),
    ];
    const table = el("table", { class: "plain av-cases" }, el("tr", {}, ...["Case", "The key went", "Fix"].map((x) => el("th", { text: x }))),
      ...CASES.map(([c, path, fixText]) => el("tr", { "data-case": c }, el("td", { text: c }), el("td", { text: path }), el("td", { text: fixText }))));
    return el("div", { class: "proof av-recipe" }, el("p", { class: "proof-head", text: "The insert recipe" }), el("ol", {}, ...rows), el("div", { class: "table-wrap" }, table));
  }
  function fillCard(card, c) {
    $$(".blank", card).forEach((b) => { b.textContent = c[b.dataset.f] || ""; });
    $$("[data-row]", card).forEach((r) => r.classList.toggle("now", c.now === r.dataset.row));
    $$("tr[data-case]", card).forEach((r) => r.classList.toggle("now", r.dataset.case === c.kase));
  }
  function setupSeq(box) {
    const steps = Sim.avlSeqSteps(box.dataset.keys.split(",").map(Number));
    const trees = steps.map((s) => (s.shape ? Sim.parseShape(s.shape) : null));
    const cols = Math.max(...trees.map(Sim.size)), depth = Math.max(...trees.map(Sim.height));
    const svg = svgEl("svg", { class: "htree av-live", role: "img" });
    const say = el("p", { class: "step-say", role: "status" });
    const card = recipeCard(), slide = slider(svg);
    const ctl = stepControls(steps.length, (k) => {
      const st = steps[k], t = trees[k];
      say.textContent = st.say;
      svg.setAttribute("aria-label", avlSay(t));
      fillCard(card, st.card);
      slide.draw(t, avlGeom(t, cols, depth), { marks: st.marks, heights: st.heights });
    });
    box.append(el("div", { class: "av-stepper" }, el("div", { class: "pic" }, svg, ctl.box, say), card));
    onNarrowChange(() => { slide.reset(); ctl.go(ctl.now()); });
    ctl.go(0);
  }
  $$(".avl-seq[data-keys]").forEach(setupSeq);

  // L9: the smallest AVL tree of each height, a root over the two smaller ones, with M(h) filled in as it goes
  function setupMin(box) {
    const steps = Sim.minSteps(Number(box.dataset.h));
    const svg = svgEl("svg", { class: "htree", role: "img" });
    const say = el("p", { class: "step-say", role: "status" });
    const cells = steps.map(() => el("td", { class: "blank-cell" }));
    const table = el("table", { class: "vals" }, el("tr", {}, el("th", { text: "h" }), ...steps.map((s) => el("td", { text: String(s.h) }))), el("tr", {}, el("th", { text: "M(h)" }), ...cells));
    const ctl = stepControls(steps.length, (k) => {
      const st = steps[k], t = Sim.parseShape(st.shape);
      const marks = { ...Object.fromEntries(st.left.map((x) => [x, "lsub"])), ...Object.fromEntries(st.right.map((x) => [x, "rsub"])), [st.root]: "cmp" };
      const g = avlGeom(t, Sim.size(t), Sim.height(t));
      avlPaint(svg, t, g.spots, g, { marks });
      svg.setAttribute("aria-label", `The smallest AVL tree of height ${st.h}: ${st.M} node${st.M === 1 ? "" : "s"}. ${avlSay(t)}`);
      say.textContent = st.say;
      cells.forEach((c, i) => { c.textContent = i <= k ? String(steps[i].M) : "?"; c.classList.toggle("now", i === k); });
    });
    box.append(el("div", { class: "chart-box" }, svg), ctl.box, say, el("div", { class: "table-wrap" }, table));
    onNarrowChange(() => ctl.go(ctl.now()));
    ctl.go(0);
  }
  $$(".min-step[data-h]").forEach(setupMin);

  // S4: Section 4's right rotation at p, as the three references it changes
  function setupRewire(box) {
    const steps = Sim.rewireSteps(), lines = Sim.REFS.right;
    const trees = steps.map((s) => Sim.parseShape(s.shape));
    const cols = Sim.size(trees[0]), depth = Math.max(...trees.map(Sim.height));
    const code = el("pre", { class: "code" });
    const svg = svgEl("svg", { class: "htree av-live", role: "img" });
    const say = el("p", { class: "step-say", role: "status" });
    const slide = slider(svg);
    const ctl = stepControls(steps.length, (k) => {
      const st = steps[k], t = trees[k];
      code.replaceChildren(...lines.map((ln, i) => el("div", { class: `ln${st.line.includes(i) ? " hl" : ""}` }, el("span", { class: "no", text: "①②③"[i] }), el("span", { class: "src", text: ln }))));
      say.textContent = st.say;
      svg.setAttribute("aria-label", avlSay(t));
      slide.draw(t, avlGeom(t, cols, depth), { marks: st.marks, edges: st.edges });
    });
    box.append(el("div", { class: "av-stepper rw" }, el("div", { class: "pic" }, svg, ctl.box, say), code));
    onNarrowChange(() => { slide.reset(); ctl.go(ctl.now()); });
    ctl.go(0);
  }
  $$(".rewire-step").forEach(setupRewire);

  /* =========================================================== string hashes (slide 18) */
  $$(".hashcalc").forEach((panel) => {
    const sIn = $(".hc-s", panel), mIn = $(".hc-m", panel), out = $(".hc-out", panel), tbl = $(".hc-table", panel), hor = $(".hc-horner", panel);
    function draw() {
      const s = sIn.value, m = Math.max(1, Math.min(100000, parseInt(mIn.value, 10) || 10));
      const codes = [...s].map((c) => c.charCodeAt(0));
      out.textContent = s ? `a(sᵢ): ${[...s].map((c, i) => `${c}=${codes[i]}`).join(", ")}` : "Type a string.";
      tbl.replaceChildren(el("tr", {}, ...["", "value", `index (mod ${m})`].map((t) => el("th", { text: t }))));
      for (const [k, name] of [["h1", "h₁: first character"], ["h2", "h₂: sum of characters"], ["h3", "h₃: Σ a(sᵢ)·31ⁱ"], ["h4", "h₄: 2·Σ a(sᵢ)·31ⁱ"]]) {
        const v = Sim.H[k](s);
        tbl.append(el("tr", {}, el("td", { text: name }), el("td", { text: fmt(v) }), el("td", { text: String(Sim.mod(v, m)) })));
      }
      const steps = Sim.horner(s);
      hor.textContent = s ? `Horner (slide 20), from the last character: h = 31·h + a(sᵢ) gives ${steps.map(fmt).join(" → ")}` : "";
    }
    sIn.addEventListener("input", draw); mIn.addEventListener("input", draw);
    draw();
  });

  /* =========================================================== hash table lab */
  $$(".hashlab").forEach((panel) => {
    const grid = $(".hl-grid", panel), out = $(".hl-out", panel), stat = $(".hl-stat", panel), keyIn = $(".hl-key", panel);
    const modeSel = $(".hl-mode", panel), sizeIn = $(".hl-size", panel);
    const presets = JSON.parse(panel.dataset.presets || "[]");
    const gOf = (size) => { const r = Number(panel.dataset.r || 0); return r ? (k) => r - Sim.mod(k, r) : undefined; };
    let t = null, queue = [];
    function fresh(size, mode) { t = Sim.table(size, mode, mode === "double" ? gOf(size) : undefined); }
    function draw(mark = {}, msg = "") {
      grid.replaceChildren();
      grid.style.setProperty("--cols", String(t.size));
      t.slots.forEach((v, i) => {
        const cell = el("div", { class: `hl-cell${mark.path && mark.path.includes(i) ? " path" : ""}${mark.at === i ? " at" : ""}` });
        if (t.mode === "chain") { const ch = el("div", { class: "hl-chain" }); v.forEach((k) => ch.append(el("b", { class: mark.key === k ? "hit" : null, text: String(k) }))); cell.append(ch); }
        else cell.append(el("b", { class: v === Sim.TOMB ? "tomb" : v === null ? "empty" : mark.key === v ? "hit" : null, text: v === null ? "" : v === Sim.TOMB ? "✝" : String(v) }));
        if (mark.path) { const n = mark.path.indexOf(i); if (n >= 0) cell.append(el("span", { class: "hl-step", text: String(n + 1) })); }
        cell.append(el("span", { class: "hl-idx", text: String(i) }));
        grid.append(cell);
      });
      const lam = `${t.n}/${t.size}`;
      stat.textContent = `${{ chain: "Separate chaining", linear: "Linear probing", quadratic: "Quadratic probing", double: `Double hashing, g(k) = ${panel.dataset.r} − (k mod ${panel.dataset.r})` }[t.mode]} · h(k) = k mod ${t.size} · n = ${t.n} · λ = ${lam} = ${(t.n / t.size).toFixed(2)}${queue.length ? ` · queue: ${queue.join(", ")}` : ""}`;
      out.textContent = msg;
    }
    const readKey = () => {
      const v = keyIn.value.trim();
      if (v === "" && queue.length) return queue.shift();
      if (!/^-?\d+$/.test(v)) { out.textContent = "Type a whole number as the key."; return null; }
      keyIn.value = ""; return Number(v);
    };
    const where = (p) => p.join(" → ");
    $(".hl-insert", panel).addEventListener("click", () => {
      const k = readKey(); if (k === null) return;
      const r = Sim.insert(t, k);
      if (t.mode === "chain") return draw({ path: r.probes, at: r.index, key: k }, r.dup ? `${k} is already in bucket ${r.index}; insert overwrites its value.` : `${k} % ${t.size} = ${r.index}: added to bucket ${r.index}${r.compares ? ` after checking ${r.compares} key${r.compares === 1 ? "" : "s"} for a duplicate` : ""}.`);
      if (!r.ok) return draw({ path: r.probes, key: k }, `${k} doesn't fit: probed ${r.probes.length} times (${where(r.probes)}) without finding an open slot. λ is ${t.n}/${t.size}; quadratic probing only guarantees a spot when λ < 1/2 and the size is prime.`);
      draw({ path: r.probes, at: r.index, key: k }, r.dup ? `${k} is already at index ${r.index}.` : `${k} % ${t.size} = ${r.probes[0]}. Probed ${where(r.probes)}; stored at index ${r.index}${r.probes.length > 1 ? ` (${r.probes.length - 1} collision${r.probes.length > 2 ? "s" : ""})` : ""}.`);
    });
    $(".hl-find", panel).addEventListener("click", () => {
      const k = readKey(); if (k === null) return;
      const r = Sim.find(t, k);
      if (t.mode === "chain") return draw({ path: r.probes, key: k }, `Bucket ${r.index}: ${r.found ? `found ${k} after ${r.compares} comparison${r.compares === 1 ? "" : "s"}` : `not found after ${r.compares} comparison${r.compares === 1 ? "" : "s"} (the whole bucket)`}.`);
      draw({ path: r.probes, at: r.found ? r.index : undefined, key: k }, r.found ? `Found ${k} at index ${r.index}, looking at ${where(r.probes)}.` : `Not found: looked at ${where(r.probes)} and stopped at an empty slot. Tombstones don't stop a find.`);
    });
    $(".hl-delete", panel).addEventListener("click", () => {
      const k = readKey(); if (k === null) return;
      const r = Sim.remove(t, k);
      if (!r.found) return draw({ path: r.probes }, `${k} isn't in the table.`);
      draw({ path: r.probes, at: r.index }, t.mode === "chain" ? `Removed ${k} from bucket ${r.index}.` : `Deleted ${k}: index ${r.index} now holds a tombstone (✝), so later finds keep probing past it.`);
    });
    $(".hl-rehash", panel).addEventListener("click", () => {
      const size = Sim.nextPrime(2 * t.size);
      const old = t.size;
      t = Sim.rehash(t, size, t.mode === "double" ? gOf(size) : undefined);
      sizeIn.value = String(size);
      draw({}, `Rehashed: a new table of size ${size} (the first prime ≥ 2·${old}), every key re-inserted with k mod ${size}. Tombstones are gone.`);
    });
    const reset = () => { fresh(Math.max(2, Math.min(31, parseInt(sizeIn.value, 10) || 10)), modeSel.value); queue = []; draw({}, "Empty table."); };
    $(".hl-reset", panel).addEventListener("click", reset);
    modeSel.addEventListener("change", reset); sizeIn.addEventListener("change", reset);
    keyIn.addEventListener("keydown", (e) => { if (e.key === "Enter") $(".hl-insert", panel).click(); });
    const chips = $(".hl-presets", panel);
    const load = (p) => { modeSel.value = p.mode; sizeIn.value = String(p.size); fresh(p.size, p.mode); for (const k of p.keys || []) Sim.insert(t, k); queue = [...(p.seq || [])]; draw({}, p.say || ""); };
    presets.forEach((p, i) => { const c = el("button", { class: "chip", type: "button", text: p.label }); c.addEventListener("click", () => load(p)); chips.append(c); if (i === 0) load(p); });
  });
};
