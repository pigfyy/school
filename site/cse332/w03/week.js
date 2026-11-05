/* CSE 332 w03: misconception feedback and this week's widgets.
   - .rt          recursion-tree explorer (the tree method, levels summed exactly)
   - .treelab     BST / AVL playground (insert, find, delete; AVL shows the unbalanced node, then the rotation)
   - .treeview    a static drawing of one tree from data-shape, e.g. "9(3(1(0,),6),10(,16))" */
"use strict";
window.WEEK = window.WEEK || {};
window.WEEK.messages = {
  "forgot-base-level": "Close. Count the base case too: the levels go n, n/2, …, 2, 1, and T(1) = 1 adds one more.",
  "linear-count": "That's a linear count. Each call halves the range.",
  "leaves-only": "That's only the bottom level. Add the work on every level above it too.",
  "missed-a-level": "Count the levels again: the root is level 0 and the leaves are a level too.",
  "log2-not-log8": "Each call divides by 8, not by 2. How many times can you divide 512 by 8?",
  "per-node-not-level": "That's the work in one box on level i. Multiply by the number of boxes on that level.",
  "used-n-not-size": "Each box on level i works on a smaller input. Apply f to that box's size, not to n.",
  "inorder-not-pre": "That's the in-order (sorted) listing. Pre-order processes the root first.",
  "inorder-not-post": "That's the in-order (sorted) listing. Post-order processes the root last.",
  "pre-not-post": "That's pre-order. Post-order visits both subtrees before the root.",
  "min-of-right": "The lecture's delete uses the largest key to the left (removeMax(root.left)). Both work, but use the lecture's choice here.",
  "height-counts-nodes": "Height counts edges on the longest root-to-leaf path, not nodes.",
  "nodes-not-leaves": "That's the number of nodes. How many of them can be leaves?",
  "leaves-not-nodes": "That's the number of leaves. Count the nodes on every level.",
  "not-deepest": "That node is unbalanced too, but the rule rotates at the deepest unbalanced node.",
  "single-for-double": "A single rotation doesn't fix this one: the new key went to the inner side, so it takes two rotations.",
  "fib-not-m": "That's a Fibonacci number. M(h) adds 1 for the root each time: M(h) = M(h−1) + M(h−2) + 1.",
  "off-by-one-height": "Check the definition: height counts edges, and an empty tree has height −1, a single node height 0.",
  "bst-height": "That's the plain BST's height for sorted inserts. The AVL rotations keep it short.",
};

window.WEEK.widgets = function ({ $, $$, el, renderMath, REDRAW }) {
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

  /* =========================================================== recursion-tree explorer */
  const CLOSED = {
    bsearch: "\\(\\log_2 n + 1 \\in \\Theta(\\log n)\\)", lsearch: "\\(n \\in \\Theta(n)\\)", sum: "\\(2n - 1 \\in \\Theta(n)\\)",
    nlogn: "\\(n\\log_2 n + n \\in \\Theta(n \\log n)\\)", sq: "\\(2n^2 - n \\in \\Theta(n^2)\\)", eighth: "\\(2n^{1/3} - 1 \\in \\Theta(n^{1/3})\\)",
    exp: "\\(2^n - 1 \\in \\Theta(2^n)\\)",
  };
  function recTexHTML(s) {
    const call = s.kind === "div" ? `T\\left(\\frac{n}{${s.b}}\\right)` : `T(n-${s.b})`;
    const f = { "1": "1", n: "n", n2: "n^2", "100n": "100n" }[s.f];
    return `\\(T(n) = ${s.a === 1 ? "" : s.a}${call} + ${f}\\), \\(T(n) = ${s.baseVal}\\) for \\(n \\le ${s.baseAt}\\)`;
  }
  function setupRT(panel) {
    const presets = panel.dataset.presets.split(",");
    const chipBox = $(".rt-presets", panel), nSel = $(".rt-n", panel), svg = $(".rt-svg", panel), table = $(".rt-table", panel), out = $(".rt-out", panel), head = $(".rt-head", panel);
    let key = presets[0];
    const chips = presets.map((k) => {
      const c = el("button", { class: "chip", type: "button", "aria-pressed": "false", text: Sim.REC[k].name });
      c.addEventListener("click", () => { key = k; fillN(); draw(); });
      chipBox.append(c);
      return [k, c];
    });
    function fillN() {
      const s = Sim.REC[key];
      const want = Number(nSel.value) || Number(panel.dataset.n) || 16;
      nSel.replaceChildren();
      const ns = s.kind === "div" ? Array.from({ length: s.b === 2 ? 11 : s.b === 3 ? 7 : 4 }, (_, i) => s.b ** (i + (s.baseAt >= s.b ? 1 : 0))).filter((n) => n >= 1)
        : Array.from({ length: 16 }, (_, i) => i + 1);
      for (const n of ns) nSel.append(el("option", { value: String(n), text: String(n) }));
      nSel.value = String(ns.reduce((b, n) => (Math.abs(n - want) < Math.abs(b - want) ? n : b), ns[0]));
    }
    nSel.addEventListener("change", draw);
    function draw() {
      chips.forEach(([k, c]) => c.setAttribute("aria-pressed", String(k === key)));
      const s = Sim.REC[key], n = Number(nSel.value), L = Sim.levels(s, n);
      head.innerHTML = recTexHTML(s);
      renderMath(head);
      // the picture: up to 4 rows; long trees show the first 3 levels, a gap, and the leaves
      const rows = L.length <= 4 ? L : [L[0], L[1], L[2], null, L[L.length - 1]];
      svg.replaceChildren();
      // on a phone the picture is just the boxes; the table carries the per-level work
      const narrow = innerWidth < 600, W = narrow ? 380 : 760, dy = 52, H = rows.length * dy + 10;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const area = narrow ? 380 : 520, centers = [];
      rows.forEach((lv, ri) => {
        const y = 14 + ri * dy;
        if (!lv) { svg.append(svgEl("text", { x: area / 2, y: y + 20, "text-anchor": "middle", class: "rt-dots" }, "⋮")); centers.push(null); return; }
        const count = Number(lv.nodes), shown = Math.min(count, narrow ? 6 : 8), bw = Math.min(64, area / shown - 6), cs = [];
        for (let j = 0; j < shown; j++) {
          const x = (area / shown) * (j + 0.5);
          cs.push(x);
          const g = svgEl("g", { class: `rt-box${lv.leaf ? " leaf" : ""}` });
          g.append(svgEl("rect", { x: x - bw / 2, y, width: bw, height: 26, rx: 3 }));
          g.append(svgEl("text", { x, y: y + 17.5, "text-anchor": "middle" }, shown < count && j === shown - 1 ? "…" : fmt(lv.size)));
          svg.append(g);
        }
        const prev = centers[ri - 1];
        if (prev && count === Number(rows[ri - 1].nodes) * s.a && shown === count) cs.forEach((x, j) => svg.append(svgEl("line", { x1: prev[Math.floor(j / s.a)], y1: y - dy + 26, x2: x, y2: y, class: "rt-edge" })));
        centers.push(cs);
        if (!narrow) svg.append(svgEl("text", { x: area + 16, y: y + 17.5, class: "rt-work" }, `level ${lv.i}: ${fmt(lv.nodes)} × ${fmt(lv.each)} = ${fmt(lv.total)}`));
      });
      // the table, with a bar for each level's work
      const max = L.reduce((m, l) => (l.total > m ? l.total : m), 0n);
      table.replaceChildren(el("tr", {}, ...["level i", "boxes", "size of each", "work in each", "work on the level", ""].map((t) => el("th", { text: t }))));
      for (const l of L) {
        const pct = max ? Number((l.total * 1000n) / max) / 10 : 0;
        table.append(el("tr", { class: l.leaf ? "leaf" : null },
          el("td", { text: `${l.i}${l.leaf ? " (base)" : ""}` }), el("td", { text: fmt(l.nodes) }), el("td", { text: fmt(l.size) }), el("td", { text: fmt(l.each) }), el("td", { text: fmt(l.total) }),
          el("td", { class: "rt-barcell" }, el("span", { class: "rt-bar", style: `width:${Math.max(pct, 0.6)}%` }))));
      }
      const sum = Sim.levelSum(s, n), direct = Sim.evalRec(s, n);
      out.innerHTML = `${L.length} levels. Sum of the levels: <b>${fmt(sum)}</b>. Evaluating the recurrence directly: <b>${fmt(direct)}</b>${sum === direct ? " (they agree)" : ""}. Closed form: ${CLOSED[key] || ""}.`;
      renderMath(out);
    }
    fillN(); draw();
    let wasNarrow = innerWidth < 600;
    REDRAW.add(() => { if ((innerWidth < 600) !== wasNarrow) { wasNarrow = !wasNarrow; draw(); } });
  }
  $$(".rt").forEach(setupRT);

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

  /* S3 =========================================================== the worksheet's tree-method picture
     .s3tree[data-rows]: one row per level, top down: { i, k, more, s, w, L }. k boxes are drawn ("…" after them if
     more), each with one call's input size s (red box) and its work w (blue box); L is the work on the whole level.
     "dots" is the ⋮ row. "?" draws an empty blank, for the template. s, w and L are TeX. */
  $$(".s3tree[data-rows]").forEach((box) => {
    const math = (t) => (t === "?" ? el("span", { class: "s3-blank", "aria-label": "blank" }) : el("span", { text: `\\(${t}\\)` }));
    for (const r of JSON.parse(box.dataset.rows)) {
      if (r === "dots") { box.append(el("div", { class: "s3-row" }, el("div", { class: "s3-boxes s3-dots", text: "⋮" }), el("div"))); continue; }
      const boxes = el("div", { class: "s3-boxes" });
      for (let j = 0; j < r.k; j++) boxes.append(el("span", { class: "s3-node" }, el("span", { class: "s3-size" }, math(r.s)), el("span", { class: "s3-work" }, math(r.w))));
      if (r.more) boxes.append(el("span", { class: "s3-more", text: "…" }));
      const level = el("div", { class: "s3-level" }, el("span", { class: "s3-i", text: r.i === "base" ? "base cases" : `level ${r.i}` }));
      if (r.L) level.append(el("span", { text: "⟹ " }), math(r.L));
      box.append(el("div", { class: "s3-row" }, boxes, level));
    }
    renderMath(box);
  });
};

/* S3: wrong-answer feedback for Section 3 */
Object.assign(window.WEEK.messages, {
  "s3-mult-not-call": "2 * f(…) multiplies the result of one call. Count the calls to f, not the numbers in front of them.",
  "s3-if-call": "The call inside the if test runs too. Count every call that runs, wherever it sits.",
  "s3-one-branch": "Two of those calls sit in different branches of the if, and only one branch runs.",
  "s3-stored": "The result is stored in r, and the later lines reuse r. Count only the calls that actually run.",
  "s3-branching": "Each box has one child per recursive call: the number in front of T.",
  "s3-base-level": "Count only the levels that do the non-recursive work. Boxes of size 4 or less are base cases.",
  "s3-to-one": "That counts down to size 1. Here the base case starts at size 4.",
  "s3-chip-2": "Each call subtracts 2, so a box on level i is 2i smaller than n.",
});
