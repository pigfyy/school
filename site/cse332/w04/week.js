/* CSE 332 w04: misconception feedback and this week's widgets.
   - .treelab     AVL insert stepper (week 3's: shows the deepest unbalanced node, then the rotation)
   - .treeview    a static drawing of one tree from data-shape, e.g. "9(3(1(0,),6),10(,16))"
   - HASH: .hx-step / .hx-table hash tables one operation at a time, .code-step code stepper (Lectures 10-11) */
"use strict";
window.WEEK = window.WEEK || {};
window.WEEK.messages = {
  "not-deepest": "That node is unbalanced too, but the rule rotates at the deepest unbalanced node.",
  "single-for-double": "A single rotation doesn't fix this one: the new key went to the inner side, so it takes two rotations.",
  "fib-not-m": "That's a Fibonacci number. M(h) adds 1 for the root each time: M(h) = M(h−1) + M(h−2) + 1.",
  "off-by-one-height": "Check the definition: height counts edges, and an empty tree has height −1, a single node height 0.",
  "bst-height": "That's a plain BST's height. The AVL rule keeps it much shorter.",
  "nodes-not-leaves": "That's the number of nodes. Count only the nodes with no children.",
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

  /* HASH ======================================================== hash tables (Lectures 10 and 11)
     <div class="panel hx-step" data-size="10" data-mode="linear" data-ops="38 19 8 f29"> a stepper, one operation per
     step: the list of operations, the table, n and λ, and Sim.hashRun's narration.
     <div class="hx-table" data-size data-mode data-ops [data-r] [data-at] [data-say]> the table after those operations
     (or after state data-at of them), with that step's probes marked and, with data-say, its narration under it.
     .code-step: a pre.code of .ln lines, then an ol whose li[data-line="2-3"] are the steps (week 3's code stepper). */
  {
    const scenario = (box) => ({ size: Number(box.dataset.size), mode: box.dataset.mode, R: Number(box.dataset.r || 0), ops: box.dataset.ops || "" });
    const opName = (op) => (op.kind === "rehash" ? "rehash" : `${op.kind === "empty" ? "empty-delete" : op.kind} ${op.key}`);
    function drawTable(grid, st, fresh = false) {
      const badges = new Map();
      for (const p of st.probes) badges.set(p.at, [...(badges.get(p.at) || []), p.i]);
      grid.style.setProperty("--cols", String(st.size));
      grid.classList.toggle("chain", st.mode === "chain");
      grid.setAttribute("aria-label", `Table of size ${st.size}: ${st.slots.map((v, j) => `${j}: ${Array.isArray(v) ? (v.length ? v.join(" then ") : "empty") : v === null ? "empty" : v === Sim.TOMB ? "tombstone" : v}`).join("; ")}`);
      grid.replaceChildren(...st.slots.map((v, j) => {
        const hit = j === st.at, looked = badges.has(j);
        const col = el("div", { class: "hx-col" }, el("span", { class: "hx-idx", text: String(j) }));
        if (st.mode === "chain") {
          col.append(el("b", { class: `hx-cell head${v.length ? "" : " empty"}${looked ? " look" : ""}`, text: v.length ? "↓" : "/" }));
          col.append(...v.map((k) => el("b", { class: `hx-cell node${k === st.hit && st.result !== "missing" ? ` hit${fresh && st.result === "placed" ? " arrive" : ""}` : looked && st.op?.kind === "find" ? " look" : ""}`, text: String(k) })));
          return col;
        }
        const kind = v === null ? " empty" : v === Sim.TOMB ? " tomb" : "";
        const cls = hit ? ` hit${fresh && st.result === "placed" ? " arrive" : ""}` : looked ? " look" : "";
        col.append(el("b", { class: `hx-cell${kind}${cls}`, text: v === null ? "" : String(v) }));
        col.append(el("span", { class: "hx-badge", text: looked ? badges.get(j).join(",") : "" }));
        return col;
      }));
    }
    const statText = (st) => `n = ${st.n} · λ = ${st.n}/${st.size}`;
    // one sentence per line: the hash, then one line per probe
    const sayLines = (say) => say.split(/(?<=\.) (?=i = |[A-Z])/).map((t) => el("span", { class: "hx-line", text: t }));

    $$(".hx-table[data-ops]").forEach((box) => {
      const steps = Sim.hashRun(scenario(box)), st = steps[box.dataset.at ? Number(box.dataset.at) : steps.length - 1];
      const grid = el("div", { class: "hx-grid", role: "img" });
      box.replaceChildren(grid);
      drawTable(grid, st);
      if (box.hasAttribute("data-say")) box.append(el("p", { class: "hx-say" }, ...sayLines(st.say)));
    });

    function setupHashStepper(box) {
      const sc = scenario(box), steps = Sim.hashRun(sc), ops = Sim.parseOps(sc.ops);
      const script = el("ol", { class: "hx-script" }, ...ops.map((op) => el("li", { text: opName(op) })));
      const grid = el("div", { class: "hx-grid", role: "img" });
      const stat = el("p", { class: "hx-stat" });
      const say = el("p", { class: "step-say", role: "status" });
      const back = el("button", { class: "btn", type: "button", text: "← Back" });
      const next = el("button", { class: "btn primary", type: "button", text: "Next step →" });
      const count = el("span", { class: "note" });
      box.append(script, grid, stat, el("div", { class: "controls" }, back, next, count), say);
      let k = 0;
      function paint(fresh) {
        const st = steps[k];
        [...script.children].forEach((li, i) => { li.classList.toggle("now", i === st.opi); li.classList.toggle("done", i < st.opi); });
        drawTable(grid, st, fresh && !matchMedia("(prefers-reduced-motion: reduce)").matches);
        stat.textContent = statText(st);
        say.replaceChildren(...sayLines(k === 0 ? `${st.say} Press Next step.` : st.say));
        back.disabled = k === 0;
        next.disabled = k === steps.length - 1;
        count.textContent = k === 0 ? "" : k === steps.length - 1 ? "Done." : `Step ${k} of ${steps.length - 1}.`;
      }
      back.addEventListener("click", () => { if (k > 0) { k--; paint(false); } });
      next.addEventListener("click", () => { if (k < steps.length - 1) { k++; paint(true); } });
      paint(false);
    }
    $$(".hx-step").forEach(setupHashStepper);

    // On phones a code panel is a short window; grow it to fit the highlighted lines and scroll them into view.
    function fitHighlight(pre) {
      const hls = pre.querySelectorAll(".hl");
      pre.style.maxHeight = "";
      if (!hls.length || getComputedStyle(pre).maxHeight === "none") return;
      const cs = getComputedStyle(pre), pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const base = pre.firstElementChild.offsetTop, first = hls[0], last = hls[hls.length - 1];
      const top = (first.previousElementSibling || first).offsetTop - base;
      const bottom = last.offsetTop + last.offsetHeight - base;
      if (bottom - top + pad > pre.clientHeight) pre.style.maxHeight = `${bottom - top + pad}px`;
      pre.scrollTop = top;
    }
    function setupCodeStepper(box) {
      const code = $("pre.code", box), lines = $$(".ln", code), items = $$(":scope > ol > li", box);
      const board = $(":scope > ol", box);
      board.className = "cs-board";
      code.classList.toggle("long", lines.length > 8);
      const lit = items.map((li) => new Set(li.dataset.line.split(",").flatMap((r) => { const [a, b = a] = r.split("-").map(Number); return Array.from({ length: b - a + 1 }, (_, j) => a + j - 1); })));
      const back = el("button", { class: "btn", type: "button", text: "← Back" });
      const next = el("button", { class: "btn primary", type: "button", text: "Next step →" });
      const count = el("span", { class: "note" });
      box.append(el("div", { class: "split stepper cs" }, code, el("div", { class: "pic" }, el("div", { class: "controls" }, back, next, count), board)));
      let k = 0;
      function show() {
        if (k) fitHighlight(code); else { code.style.maxHeight = ""; code.scrollTop = 0; }
      }
      function paint() {
        lines.forEach((ln, i) => ln.classList.toggle("hl", k > 0 && lit[k - 1].has(i)));
        items.forEach((li, i) => { li.hidden = i >= k; li.classList.toggle("now", i === k - 1); });
        show();
        back.disabled = k === 0;
        next.disabled = k === items.length;
        count.textContent = k === 0 ? "Press Next step." : k === items.length ? "Done." : `Step ${k} of ${items.length}.`;
      }
      back.addEventListener("click", () => { if (k > 0) { k--; paint(); } });
      next.addEventListener("click", () => { if (k < items.length) { k++; paint(); } });
      REDRAW.add((pid) => { if (box.closest(".page").id === pid) show(); });
      paint();
    }
    $$(".code-step").forEach(setupCodeStepper);
  }
};

/* HASH: wrong-answer feedback for Lectures 10 and 11 */
Object.assign(window.WEEK.messages, {
  "no-mod": "That's the key itself. The index is the key % table size.",
  "insert-no-check": "Insert first walks the chain to make sure the key isn't already there. Count those comparisons.",
  "lambda-flipped": "λ is n / length: the number of keys divided by the number of slots.",
  "lambda-not-half": "That's λ itself. A successful find stops partway along the chain: about λ/2.",
  "half-not-lambda": "An unsuccessful find has to look at the whole chain: about λ, not λ/2.",
  "plus-one": "That also counts the key it stops on, which is the exact count. The course's estimate is λ/2.",
  "tomb-skip": "Slot 8 is the first empty slot, but insert doesn't need an empty one. It reuses the first tombstone it passed, once it knows the key isn't in the table.",
  "home-taken": "That's the key's home slot, and it is already taken. Follow the probes i = 1, 2, … to the first empty slot.",
  "tomb-reused": "53 already went into the tombstone's slot. Use the table as it is after the last step.",
  "tomb-is-empty": "A tombstone doesn't end a find. Keep probing past it until a truly empty slot.",
  "counted-index": "Count every slot looked at, the first one and the one where the search stops included.",
  "linear-not-quadratic": "That's where linear probing would put it. Quadratic probing tries h + 1², h + 2², h + 3², …",
  "quad-not-double": "That's quadratic probing's answer. Double hashing steps by g(k) each time.",
  "not-prime": "That's double the size, but it isn't prime. Take the first prime at least that big.",
  "below-double": "That's prime but less than double the old size. The new array should be at least twice as long.",
  "start-first-char": "The loop starts at the last character, i = m − 1, and works toward the first.",
  "ascii-sum-order": "Order matters in h₃: each character is multiplied by its own power of 31.",
  "new-at-front": "Here new keys go on the end of the chain, after insert has walked it.",
  "open-limit": "That's the limit for open addressing. With chaining a slot can hold several keys, so λ can go higher.",
});
