/* CSE 332 w04: misconception feedback and this week's widgets.
   - .treelab     AVL insert stepper (week 3's: shows the deepest unbalanced node, then the rotation)
   - .treeview    a static drawing of one tree from data-shape, e.g. "9(3(1(0,),6),10(,16))"
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

  /* =========================================================== drawing a tree */
  // marks: { key: "path" | "new" | "problem" | "found" | "repl" }; opts.heights shows each node's height
  function drawTree(svg, t, marks = {}, opts = {}) {
    svg.replaceChildren();
    if (!t) {
      svg.setAttribute("viewBox", "0 0 760 70");
      svg.append(svgEl("text", { x: 380, y: 40, "text-anchor": "middle", class: "tl-empty" }, "(empty tree)"));
      return;
    }
    const keys = Sim.inOrder(t), depth = Sim.height(t);
    const narrow = innerWidth < 600;
    const W = narrow ? Math.max(300, Math.min(420, keys.length * 36 + 30)) : Math.max(360, Math.min(760, keys.length * 64 + 40)), gap = (W - 40) / Math.max(1, keys.length);
    const r = Math.min(17, Math.max(11, gap * 0.36)), dy = narrow ? 50 : 58, H = (depth + 1) * dy + 18;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const pos = new Map();
    const place = (n, d) => { if (!n) return; place(n.left, d + 1); pos.set(n.key, { x: 20 + gap * (pos.size + 0.5), y: 26 + d * dy }); place(n.right, d + 1); };
    place(t, 0);
    const edges = svgEl("g"), nodes = svgEl("g");
    const walk = (n) => {
      if (!n) return;
      const p = pos.get(n.key);
      for (const c of [n.left, n.right]) if (c) { const q = pos.get(c.key); edges.append(svgEl("line", { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: `tl-edge${marks[c.key] === "path" || marks[c.key] === "new" || marks[c.key] === "found" ? " on" : ""}` })); }
      const g = svgEl("g", { class: `tl-node ${marks[n.key] || ""}`.trim() });
      g.append(svgEl("circle", { cx: p.x, cy: p.y, r }));
      g.append(svgEl("text", { x: p.x, y: p.y + 4.5, "text-anchor": "middle" }, String(n.key)));
      if (opts.heights) g.append(svgEl("text", { x: p.x + r + 2, y: p.y - r + 4, class: "tl-h" }, `h=${n.height}`));
      nodes.append(g);
      walk(n.left); walk(n.right);
    };
    walk(t);
    svg.append(edges, nodes);
    svg.setAttribute("aria-label", `Tree: ${Sim.shape(t)}`);
  }

  /* =========================================================== static tree views */
  $$(".treeview[data-shape]").forEach((box) => {
    const t = Sim.parseShape(box.dataset.shape);
    const svg = svgEl("svg", { class: "chart tl-svg", role: "img" });
    box.prepend(svg);
    const marks = {};
    (box.dataset.mark || "").split(",").filter(Boolean).forEach((k) => { marks[Number(k)] = box.dataset.markAs || "problem"; });
    const paint = () => drawTree(svg, t, marks, { heights: box.hasAttribute("data-heights") });
    paint();
    let wasNarrow = innerWidth < 600;
    REDRAW.add(() => { if ((innerWidth < 600) !== wasNarrow) { wasNarrow = !wasNarrow; paint(); } });
  });

  /* =========================================================== BST / AVL playground */
  function setupLab(panel) {
    const avl = panel.dataset.mode === "avl";
    const svg = $(".tl-svg", panel), out = $(".tl-out", panel), orders = $(".tl-orders", panel), keyIn = $(".tl-key", panel);
    const nextBtn = $(".tl-next", panel), queueOut = $(".tl-queue", panel);
    const presets = JSON.parse(panel.dataset.presets || "[]");
    let tree = null, pending = null, queue = [];
    const load = (p) => { tree = p.shape ? Sim.parseShape(p.shape) : null; queue = [...(p.seq || [])]; pending = null; render({}, p.say || "Loaded. Type a key, or press Insert to add the next key in the queue."); };
    let lastMarks = {};
    let wasNarrow = innerWidth < 600;
    REDRAW.add(() => { if ((innerWidth < 600) !== wasNarrow) { wasNarrow = !wasNarrow; drawTree(svg, tree, lastMarks, { heights: avl }); } });
    function render(marks, msg) {
      lastMarks = marks;
      drawTree(svg, tree, marks, { heights: avl });
      out.textContent = msg;
      if (orders) orders.textContent = tree ? `In-order: ${Sim.inOrder(tree).join(" ")} · Pre-order: ${Sim.preOrder(tree).join(" ")} · Post-order: ${Sim.postOrder(tree).join(" ")} · Height: ${Sim.height(tree)}` : "";
      if (nextBtn) nextBtn.disabled = !pending;
      if (queueOut) queueOut.textContent = queue.length ? `Queue: ${queue.join(", ")}` : "";
    }
    const readKey = () => {
      const v = keyIn.value.trim();
      if (v === "" && queue.length) return queue.shift();
      if (!/^-?\d+$/.test(v)) { out.textContent = "Type a whole number as the key."; return null; }
      keyIn.value = "";
      return Number(v);
    };
    const marksFor = (path, k, kind) => Object.fromEntries([...path.map((x) => [x, "path"]), [k, kind]]);
    $(".tl-insert", panel).addEventListener("click", () => {
      if (pending) finish();
      const k = readKey(); if (k === null) return;
      if (!avl) {
        const r = Sim.bstInsert(tree, k); tree = r.root;
        return render(marksFor(r.path, k, r.dup ? "found" : "new"), r.dup ? `${k} is already a key, so insert just overwrites its value. The tree doesn't change.` : `Inserted ${k} as a leaf after comparing with ${r.path.length ? r.path.join(", ") : "nothing (empty tree)"}.`);
      }
      const before = Sim.clone(tree);
      const step = Sim.avlBstStep(Sim.clone(tree), k);
      if (step.dup) return render(marksFor(step.path, k, "found"), `${k} is already a key. Nothing changes.`);
      const after = Sim.avlInsert(Sim.clone(before), k);
      if (!step.problem) { tree = after.root; return render(marksFor(step.path, k, "new"), `BST insert put ${k} at a leaf. Every node on the path back to the root is still balanced, so no rotation.`); }
      tree = step.root;
      const all = Sim.problemNodes(Sim.clone(step.root));
      pending = { after, k };
      const how = { LL: "the left subtree of its left child: rotate right at it", RR: "the right subtree of its right child: rotate left at it", LR: "the right subtree of its left child: rotate left at the left child, then right at it", RL: "the left subtree of its right child: rotate right at the right child, then left at it" }[after.case];
      const m = marksFor(step.path, k, "new"); m[step.problem] = "problem";
      render(m, `BST insert put ${k} at a leaf. Heights updated: node ${step.problem} is the deepest unbalanced node${all.length > 1 ? ` (${all.join(" and ")} are both unbalanced)` : ""}. Case ${after.case}: ${k} went into ${how}. Press Rotate.`);
    });
    function finish() {
      const { after, k } = pending; pending = null; tree = after.root;
      render({ [k]: "new" }, `Case ${after.case} at ${after.problem}: ${after.case.length === 2 && after.case[0] === after.case[1] ? "one rotation" : "two rotations"}. The tree is balanced again; root is ${tree.key}.`);
    }
    if (nextBtn) nextBtn.addEventListener("click", () => pending && finish());
    const find = $(".tl-find", panel);
    if (find) find.addEventListener("click", () => {
      const k = readKey(); if (k === null) return;
      const r = Sim.bstFind(tree, k);
      render(Object.fromEntries(r.path.map((x) => [x, x === k ? "found" : "path"])), r.found ? `Found ${k} after comparing with ${r.path.join(", ")}.` : `${k} isn't in the tree. Compared with ${r.path.join(", ") || "nothing"} and fell off at an empty child.`);
    });
    const del = $(".tl-delete", panel);
    if (del) del.addEventListener("click", () => {
      const k = readKey(); if (k === null) return;
      if (!Sim.bstFind(tree, k).found) return render({}, `${k} isn't in the tree, so delete does nothing.`);
      const r = Sim.bstDelete(tree, k); tree = r.root;
      const say = [`${k} was a leaf: its parent now points to null.`, `${k} had one child: ${r.replacement} takes its place.`, `${k} had two children: the largest key to its left, ${r.replacement}, moves up into its place and is removed from below.`][r.case];
      render(r.case === 2 ? { [r.replacement]: "repl" } : r.case === 1 ? { [r.replacement]: "repl" } : {}, say);
    });
    const chips = $(".tl-presets", panel);
    presets.forEach((p, i) => {
      const c = el("button", { class: "chip", type: "button", text: p.label });
      c.addEventListener("click", () => load(p));
      chips.append(c);
      if (i === 0) load(p);
    });
    $(".tl-reset", panel).addEventListener("click", () => load(presets[0]));
    keyIn.addEventListener("keydown", (e) => { if (e.key === "Enter") $(".tl-insert", panel).click(); });
  }
  $$(".treelab").forEach(setupLab);

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
