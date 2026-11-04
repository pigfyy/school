/* CSE 332 w01: misconception feedback (shown by core/grader.js for a tag in data-miscon) and this week's widgets. */
window.WEEK = window.WEEK || {};
window.WEEK.messages = {
  "back-points-last": "Check what back points to: the first open slot, not the last item.",
  "no-wrap": "That index is past the end of the array. back wraps with % queue.length.",
  "stale-slot": "That value was dequeued earlier, but the slot gets reused. Which enqueue landed at index 0?",
  "lifo-q": "That's the order a stack would give. A queue removes the oldest item first.",
  "fifo": "That's what a queue would return. A stack's pop takes the most recent push.",
  "first-pop": "That's what the first pop returns. Keep going: what's on top after the next push?",
  "peek-removes": "peek looks at the top without removing it, so a second peek sees the same item.",
  "new-t-array": "Java has a rule about creating arrays of a type parameter. Look at how the Tuple constructor makes its array.",
  "bound-is-upper": "T extends Animal means T can be Animal itself. What does that allow for first and second?",
  "t-is-fixed": "Once T is chosen, both fields have that exact type. Is a Cat a Dog?",
  "added-loops": "You added the two loops' counts. The inner loop runs completely for each outer iteration.",
  "inner-only": "That's one outer iteration's worth. How many outer iterations are there?",
  "counted-adds": "This asks for prints only. m.add isn't a print.",
  "if-branch": "That's the cheap branch. The worst case takes the slower branch of the conditional.",
  "extra-op": "Close. Recount the conditional: b % 2 is one op, and == isn't arithmetic.",
  "forgot-constant": "Close, but you've dropped the operations outside the loops. Count every line.",
  "no-divide": "That's the cost of one 3-day cycle. The question asks per day.",
  "rounding": "Round to the cent (two decimal places).",
  "two-days": "The fine comes on the 3rd unpaid day. How many days does one cycle cover?",
  "forgot-copies": "That counts only the writes. Each element resize() copies costs 1 too.",
  "doubles-iterations": "Doubling n doesn't double the iterations. One more halving takes 2,000 down to 1,000.",
  "used-bound": "That's the worst-case bound 4n + 4. Trace b for n = 4: is it even or odd, and which branch runs?",
  "prints-only": "That counts the prints only. Add one m.add per outer iteration.",
  "copies-every-add": "Copies happen only when the array is full, not on every add.",
  "amortized-vs-worst": "That's the cost of a typical add. This one triggers resize(), so count its copies too.",
  "forgot-write": "resize() copies the old elements, then add still writes the new value.",
  "copied-new-length": "resize() copies the old array's elements. How long was the old array?",
  "only-last-block": "That's one block's cost. Add the cost of every block.",
  "halved-once": "That's after one halving. Keep halving until the gap is 1.",
  "linear-count": "That's how many items a linear scan would look at. Each binary-search iteration halves the range.",
  "missed-last": "Close. When k isn't in the list, contains compares every item, including the last one.",
  "binary-for-linear": "That's binary search's count. contains checks items one at a time from the start, so it can't skip any.",
  "stopped-early": "Close. The loop still runs one more time when end − start is 1.",
  "strict-vs-equal": "At that n the two sides aren't in the right order yet. Check that value directly.",
  "dropped-constant": "Your crossover ignores the +900. Solve the full inequality.",
  "biggest-coefficient": "B has the biggest coefficient, but for large n the highest power of n wins.",
  "not-tight": "That's a valid upper bound, but not the tightest bucket. Drop constants and lower-order terms of the actual count.",
  "too-small": "That bucket grows too slowly. Find the dominant term of the count.",
  "simplify-terms": "Correct bucket. Write it simplified, though: drop the non-dominant terms.",
  "simplify-constant": "Correct bucket. Write it simplified, though: drop the constant factor.",
  "leftover-t": "There's no T in UnlikePair<A,B>. Every T must become A or B.",
  "swapped": "Look at which field this spot reads or writes, and that field's declared type.",
  "missing-bound": "These parameters don't express the relationship yet. How do you require one type to be a subtype of another?",
  "bound-reversed": "That's the relationship backwards. Which item is the subtype?",
  "int-as-param": "Only the second item's type varies. The first is always an integer, so it doesn't need a type parameter.",
  "int-is-fixed": "The first item is always an integer, so it doesn't need a type parameter.",
  "one-param-pair": "You need two type parameters: one for the first item, and one for the things inside the pair.",
  "not-pair": "The second item isn't a single B. What kind of object holds two of them?",
  "raw-likepair": "LikePair needs its type argument. A pair of what?",
  "pair-of-supertype": "That pair could hold any A. The prompt asks for things whose type is a subclass of the first item's type.",
  "not-array": "The second item is several objects, not one.",
  "same-type-array": "The array holds objects of another type than the first item.",
  "object-array": "Use a type parameter so the caller chooses the element type.",
  "raw-comparable": "Comparable needs a type argument: what does an A compare itself to?",
  "raw-pair": "ComparablePair is generic. Write it with its type arguments.",
  "compare-element": "That compares the elements. The class itself must be comparable to another pair.",
  "object-param": "Comparable<…> fixes the parameter type of compareTo. What did the implements clause say?",
};

"use strict";
window.WEEK = window.WEEK || {};
window.WEEK.widgets = function ({ $, $$, el, store, G, renderMath, toast, REDRAW, currentId, reduceMotion, specFor, ITEMS, refreshCounts }) {
const Grader = G;
const Sim = window.Sim;
function svgEl(tag, attrs = {}, text) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}

const fmtInt = (x) => (typeof x === "bigint" ? x.toLocaleString("en-US") : Number(x).toLocaleString("en-US"));

/* =========================================================== Lecture 1: queue visualizers */
function drawCells(box, q, { flash = -1 } = {}) {
  box.replaceChildren();
  for (let i = 0; i < q.length; i++) {
    const live = q.live(i);
    const c = el("div", { class: `cell${live ? "" : " empty"}${i === flash ? " just" : ""}` });
    const ptr = [];
    if (i === q.front) ptr.push("front");
    if (i === q.back) ptr.push("back");
    c.append(el("span", { class: `ptr${ptr.length === 1 && ptr[0] === "back" ? " back" : ""}`, text: ptr.join(" · ") }));
    c.append(el("b", { text: live ? String(q.queue[i]) : "·", title: live ? "" : `old value ${q.queue[i] ?? "none"} (not in the queue)` }));
    c.append(el("span", { class: "idx", text: String(i) }));
    box.append(c);
  }
}

function drawNodes(box, lq) {
  box.replaceChildren();
  const vals = lq.values();
  if (!vals.length) { box.append(el("span", { class: "null", text: "front = null, back = null (empty)" })); return; }
  vals.forEach((v, i) => {
    const n = el("div", { class: "node" });
    const ptr = i === 0 && i === vals.length - 1 ? "front · back" : i === 0 ? "front" : i === vals.length - 1 ? "back" : "";
    n.append(el("span", { class: `ptr${ptr === "back" ? " back" : ""}`, text: ptr }), el("b", { text: String(v) }));
    box.append(n);
    box.append(el("span", { class: "arrow", text: "→" }));
  });
  box.append(el("span", { class: "null", text: "null" }));
}

function logLine(box, text) {
  box.prepend(el("div", { text }));
  while (box.children.length > 40) box.lastChild.remove();
}

const valFrom = (inp) => { const v = Math.trunc(Number(inp.value)); return Number.isFinite(v) ? v : 0; };

function setupQueues() {
  // hero: both structures driven together
  let hl = Sim.linkedQueue(), hc = Sim.circularQueue();
  const heroMsg = $("#hero-msg");
  const heroDraw = (flash) => {
    drawNodes($("#hero-linked"), hl);
    drawCells($("#hero-circ"), hc, { flash });
    $("#hero-circ-note").textContent = `front = ${hc.front}, back = ${hc.back}, size = ${hc.size}`;
  };
  $("#hero-enq").addEventListener("click", () => {
    const x = valFrom($("#hero-val"));
    if (!hc.canEnqueue()) { heroMsg.textContent = "The array is full. The fixed version would resize() here; that's Exercise 0."; return; }
    if (!hl.canEnqueue()) { heroMsg.textContent = "The linked queue is empty, so back is null and the lecture's enqueue would crash on back.next. Handling that is part of Exercise 0. Press Reset."; return; }
    const at = hc.back; hl.enqueue(x); hc.enqueue(x);
    heroMsg.textContent = `enqueue(${x})`;
    $("#hero-val").value = (x + 1) % 100;
    heroDraw(at);
  });
  $("#hero-deq").addEventListener("click", () => {
    if (hc.isEmpty()) { heroMsg.textContent = "Both are empty. dequeue assumes a non-empty queue."; return; }
    const a = hl.dequeue(), b = hc.dequeue();
    heroMsg.textContent = `dequeue() returned ${a} from both${a === b ? "" : ` (mismatch: ${b})`}.`;
    heroDraw();
  });
  $("#hero-reset").addEventListener("click", () => { hl = Sim.linkedQueue(); hc = Sim.circularQueue(); heroMsg.textContent = ""; heroDraw(); });
  heroDraw();

  // linked queue page
  let lq = Sim.linkedQueue();
  const lqLog = $("#lq-log");
  $("#lq-enq").addEventListener("click", () => {
    const x = valFrom($("#lq-val"));
    if (!lq.canEnqueue()) { logLine(lqLog, `enqueue(${x}): back is null, so back.next = last would throw a NullPointerException. The lecture's code assumes a non-empty queue.`); return; }
    lq.enqueue(x);
    logLine(lqLog, `enqueue(${x}): last = new ListNode(${x}); back.next = last; back = last`);
    $("#lq-val").value = (x + 1) % 100;
    drawNodes($("#lq-nodes"), lq);
  });
  $("#lq-deq").addEventListener("click", () => {
    if (lq.isEmpty()) { logLine(lqLog, "dequeue(): front is null, so front.value would throw. The lecture's code assumes a non-empty queue."); return; }
    const v = lq.dequeue();
    logLine(lqLog, `dequeue() → ${v}${lq.isEmpty() ? "; front became null, so back = null" : ""}`);
    drawNodes($("#lq-nodes"), lq);
  });
  $("#lq-reset").addEventListener("click", () => { lq = Sim.linkedQueue(); lqLog.replaceChildren(); drawNodes($("#lq-nodes"), lq); });
  drawNodes($("#lq-nodes"), lq);

  // circular array page
  let cq = Sim.circularQueue();
  const cqLog = $("#cq-log"), ringBtn = $("#cq-ring"), svg = $("#cq-svg");
  // SVG elements have no .hidden property, so the circle view is shown and hidden with style.display.
  const ringOn = () => svg.style.display !== "none";
  svg.style.display = ringBtn.getAttribute("aria-pressed") === "true" ? "" : "none";
  const drawRing = () => {
    svg.replaceChildren();
    const R = 120, cx = 160, cy = 160;
    for (let i = 0; i < cq.length; i++) {
      const a = (i / cq.length) * 2 * Math.PI - Math.PI / 2;
      const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      const live = cq.live(i);
      svg.append(svgEl("circle", { cx: x, cy: y, r: 22, fill: live ? "var(--a1-tint)" : "var(--surface)", stroke: live ? "var(--a1)" : "var(--line-strong)", "stroke-width": 2, "stroke-dasharray": live ? "" : "4 3" }));
      svg.append(svgEl("text", { x, y: y + 5, "text-anchor": "middle", style: "font-weight:600;fill:var(--ink);font-size:15px" }, live ? String(cq.queue[i]) : ""));
      const lx = cx + (R + 36) * Math.cos(a), ly = cy + (R + 36) * Math.sin(a);
      svg.append(svgEl("text", { x: lx, y: ly + 4, "text-anchor": "middle" }, String(i)));
    }
    const mark = (i, label, color, off) => {
      const a = (i / cq.length) * 2 * Math.PI - Math.PI / 2;
      svg.append(svgEl("text", { x: cx + (R - 46 - off) * Math.cos(a), y: cy + (R - 46 - off) * Math.sin(a) + 4, "text-anchor": "middle", style: `font-weight:700;fill:${color}` }, label));
    };
    mark(cq.front, "front", "var(--a1)", 0);
    mark(cq.back, "back", "var(--a2)", cq.back === cq.front ? 20 : 0);
  };
  const cqDraw = (flash) => {
    drawCells($("#cq-cells"), cq, { flash });
    $("#cq-state").textContent = `front = ${cq.front}, back = ${cq.back}, size = ${cq.size}, queue.length = ${cq.length}${cq.size === cq.length ? " (full: front == back, just like when empty)" : cq.size === 0 ? " (empty: front == back)" : ""}`;
    if (ringOn()) drawRing();
  };
  $("#cq-enq").addEventListener("click", () => {
    const x = valFrom($("#cq-val"));
    if (!cq.canEnqueue()) { logLine(cqLog, `enqueue(${x}): the array is full. This code would overwrite queue[${cq.back}], the oldest item. The fixed version calls resize() first; that's Exercise 0, so this visualizer stops here.`); return; }
    const at = cq.back;
    cq.enqueue(x);
    logLine(cqLog, `enqueue(${x}): queue[${at}] = ${x}; back = (${at} + 1) % ${cq.length} = ${cq.back}; size = ${cq.size}`);
    $("#cq-val").value = (x + 1) % 100;
    cqDraw(at);
  });
  $("#cq-deq").addEventListener("click", () => {
    if (cq.isEmpty()) { logLine(cqLog, "dequeue(): size is 0. The lecture's code assumes the queue is not empty."); return; }
    const f = cq.front, v = cq.dequeue();
    logLine(cqLog, `dequeue() → ${v}: first = queue[${f}]; front = (${f} + 1) % ${cq.length} = ${cq.front}; size = ${cq.size}`);
    cqDraw();
  });
  $("#cq-reset").addEventListener("click", () => { cq = Sim.circularQueue(); cqLog.replaceChildren(); cqDraw(); });
  ringBtn.addEventListener("click", () => {
    svg.style.display = ringOn() ? "none" : "";
    ringBtn.setAttribute("aria-pressed", String(ringOn()));
    cqDraw();
  });
  cqDraw();
}

/* =========================================================== Lecture 1: line-by-line steppers */
const STEP_SCENARIOS = {
  linked: [
    { label: "enqueue(9)", op: "enqueue", init: [5, 8, 3, 4, 7], x: 9 },
    { label: "dequeue()", op: "dequeue", init: [5, 8, 3, 4, 7] },
    { label: "dequeue() the last item", op: "dequeue", init: [7] },
    { label: "enqueue(9) on an empty queue", op: "enqueue", init: [], x: 9 },
  ],
  circular: [
    { label: "enqueue(9)", op: "enqueue", start: () => Sim.circularQueue(), x: 9 },
    { label: "dequeue()", op: "dequeue", start: () => Sim.circularQueue() },
    { label: "enqueue(5) into the last slot", op: "enqueue", x: 5,
      start: () => { const q = Sim.circularQueue(); for (let i = 0; i < 3; i++) q.dequeue(); [1, 2, 3, 4].forEach((v) => q.enqueue(v)); return q; } },
  ],
};

function drawLinkedStep(box, st) {
  box.replaceChildren();
  const chained = st.nodes.filter((n) => !n.loose);
  if (st.front === null && st.back === null) box.append(el("span", { class: "null", text: "front = null, back = null (empty)" }));
  st.nodes.forEach((n, i) => {
    const ptr = [];
    if (i === st.front) ptr.push("front");
    if (i === st.back) ptr.push("back");
    if (n.loose) ptr.push("last");
    const node = el("div", { class: `node${n.gone ? " gone" : ""}${n.loose ? " loose" : ""}` });
    node.append(el("span", { class: `ptr${ptr.length === 1 && ptr[0] === "back" ? " back" : ""}`, text: ptr.join(" · ") }), el("b", { text: String(n.v) }));
    box.append(node);
    const nextChained = !n.loose && chained.indexOf(n) < chained.length - 1;
    if (nextChained) box.append(el("span", { class: `arrow${n.gone ? " gone" : ""}`, text: "→" }));
    else if (!n.loose && n === chained[chained.length - 1]) box.append(el("span", { class: "null", text: "→ null" }));
  });
}

function drawCircularStep(box, st) {
  box.replaceChildren();
  for (let i = 0; i < st.length; i++) {
    const live = ((i - st.front + st.length) % st.length) < st.size;
    const v = st.cells[i];
    const c = el("div", { class: `cell${live ? "" : " empty stale"}${i === st.flash ? " just" : ""}` });
    const ptr = [];
    if (i === st.front) ptr.push("front");
    if (i === st.back) ptr.push("back");
    c.append(el("span", { class: `ptr${ptr.length === 1 && ptr[0] === "back" ? " back" : ""}`, text: ptr.join(" · ") }));
    c.append(el("b", { text: v == null ? "·" : String(v), title: live ? "in the queue" : v == null ? "never used" : "old value, not in the queue" }));
    c.append(el("span", { class: "idx", text: String(i) }));
    box.append(c);
  }
}

function setupStepper(box, kind) {
  const scenarios = STEP_SCENARIOS[kind];
  const chips = el("div", { class: "controls", role: "group", "aria-label": "Pick an operation" });
  const code = el("pre", { class: "code" });
  const pic = el("div", { class: kind === "linked" ? "nodes" : "cells" });
  const vars = el("p", { class: "step-vars" });
  const say = el("p", { class: "step-say", role: "status" });
  const back = el("button", { class: "btn", type: "button", text: "← Back" });
  const next = el("button", { class: "btn primary", type: "button", text: "Next line →" });
  const count = el("span", { class: "note" });
  box.append(chips, el("div", { class: "split" }, code, el("div", {}, pic, vars, say, el("div", { class: "controls" }, back, next, count))));
  let steps = [], k = 0, lines = [];
  const chipBtns = scenarios.map((sc, i) => {
    const b = el("button", { class: "chip", type: "button", "aria-pressed": "false", text: sc.label });
    b.addEventListener("click", () => load(i));
    chips.append(b);
    return b;
  });
  function load(i) {
    const sc = scenarios[i];
    chipBtns.forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    if (kind === "linked") { steps = Sim.linkedSteps(sc.op, sc.init, sc.x); lines = Sim.LINKED_CODE[sc.op]; }
    else { steps = Sim.circularSteps(sc.op, sc.start(), sc.x); lines = Sim.CIRCULAR_CODE[sc.op]; }
    k = 0;
    paint();
  }
  function paint() {
    const st = steps[k];
    code.replaceChildren(...lines.map((ln, i) => el("div", { class: `ln${i === st.line ? " hl" : ""}` }, el("span", { class: "no", text: String(i + 1) }), el("span", { class: "src", text: ln }))));
    (kind === "linked" ? drawLinkedStep : drawCircularStep)(pic, st);
    const v = Object.entries(st.vars).map(([n, x]) => (n === "last" ? `last → the new ${x} node` : `${n} = ${x}`));
    vars.textContent = kind === "circular" ? `front = ${st.front}, back = ${st.back}, size = ${st.size}${v.length ? " · " + v.join(", ") : ""}` : v.join(", ");
    say.textContent = st.say;
    say.classList.toggle("crash", Boolean(st.crash));
    back.disabled = k === 0;
    next.disabled = k === steps.length - 1;
    count.textContent = k === 0 ? "Press Next line to run the first line." : st.crash ? "Crashed." : st.done ? "Done." : `Ran line ${st.line + 1}.`;
  }
  back.addEventListener("click", () => { if (k > 0) { k--; paint(); } });
  next.addEventListener("click", () => { if (k < steps.length - 1) { k++; paint(); } });
  load(0);
}

function setupStackVsQueue() {
  const run = () => {
    const toks = $("#sq-script").value.trim().split(/\s+/).filter(Boolean);
    const ops = [];
    for (const t of toks) {
      if (t === "-") ops.push(["remove"]);
      else if (/^\+-?\d+$/.test(t)) ops.push(["add", Number(t.slice(1))]);
      else { $("#sq-stack-out").textContent = `Couldn't read "${t}". Use +number or -.`; $("#sq-queue-out").textContent = ""; return; }
    }
    const s = Sim.runAdt("stack", ops), q = Sim.runAdt("queue", ops);
    const col = $("#sq-stack");
    col.replaceChildren(...s.remaining.map((v, i) => el("b", { class: i === s.remaining.length - 1 ? "top" : "", text: String(v) })));
    $("#sq-queue").replaceChildren(...q.remaining.map((v) => el("div", { class: "cell" }, el("b", { text: String(v) }))));
    const fmtR = (r) => r.removed.map((x) => (x === null ? "(empty!)" : x)).join(", ") || "nothing";
    $("#sq-stack-out").textContent = `pops returned: ${fmtR(s)}`;
    $("#sq-queue-out").textContent = `dequeues returned: ${fmtR(q)}`;
  };
  $("#sq-run").addEventListener("click", run);
  $("#sq-script").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  run();
}

/* =========================================================== ADT terminology sorter */
function setupTermSort() {
  const CATS = ["?", "ADT", "Data structure", "Implementation", "Algorithm"];
  const TERMS = [
    ["Queue", "ADT"], ["Stack", "ADT"], ["Circular array queue", "Data structure"], ["Linked queue", "Data structure"],
    ["The steps of dequeue on a circular array", "Algorithm"], ["Your LinkedQueue.java for Exercise 0", "Implementation"],
  ];
  const list = $("#term-list"), out = $("#term-out");
  const state = TERMS.map(() => 0);
  const btns = TERMS.map(([t], i) => {
    const b = el("button", { class: "chip", style: "text-align:left;display:flex;justify-content:space-between;gap:1rem" });
    b.addEventListener("click", () => { state[i] = (state[i] + 1) % CATS.length; render(); out.textContent = ""; });
    list.append(b);
    return b;
  });
  function render() { btns.forEach((b, i) => { b.replaceChildren(el("span", { text: TERMS[i][0] }), el("strong", { text: CATS[state[i]] })); b.style.borderColor = ""; }); }
  $("#term-check").addEventListener("click", () => {
    let right = 0;
    btns.forEach((b, i) => { const ok = CATS[state[i]] === TERMS[i][1]; if (ok) right++; b.style.borderColor = ok ? "var(--right)" : "var(--wrong)"; });
    out.textContent = right === TERMS.length ? "All six sorted correctly." : `${right} of ${TERMS.length} right. The red ones need another look. Ask: is it a behavior, a strategy, or code?`;
  });
  $("#term-reset").addEventListener("click", () => { state.fill(0); render(); out.textContent = ""; });
  render();
}

/* =========================================================== Lecture 2: scenarios table */
function setupScenarios() {
  const a = Sim.SLIDE_SORTED;
  const cells = $("#scen-cells"), out = $("#scen-out"), missBtn = $("#scen-missing");
  a.forEach((v, i) => {
    const c = el("button", { class: "cell", style: "border:0;background:none;padding:0;cursor:pointer;font:inherit", "aria-label": `search for ${v}` }, el("b", { text: String(v) }), el("span", { class: "idx", text: String(i) }));
    c.addEventListener("click", () => {
      missBtn.setAttribute("aria-pressed", "false");
      const r = Sim.linearSearch(a, v);
      out.textContent = `contains(a, ${v}): ${r.comparisons} comparison${r.comparisons === 1 ? "" : "s"}.`;
    });
    cells.append(c);
  });
  missBtn.addEventListener("click", () => {
    missBtn.setAttribute("aria-pressed", "true");
    const r = Sim.linearSearch(a, 100);
    out.textContent = `contains(a, 100): ${r.comparisons} comparisons, then return false.`;
  });
  const counts = a.map((v) => Sim.linearSearch(a, v).comparisons);
  const worst = Math.max(...counts, Sim.linearSearch(a, 100).comparisons), best = Math.min(...counts);
  const total = counts.reduce((s, x) => s + x, 0);
  $("#scen-table").append(
    el("tr", {}, el("th", { text: "Scenario" }), el("th", { class: "r", text: "Comparisons (n = 10)" }), el("th", { text: "Which input" })),
    el("tr", {}, el("td", { text: "Worst case" }), el("td", { class: "r", text: String(worst) }), el("td", { text: "target last, or not in the list" })),
    el("tr", {}, el("td", { text: "Best case" }), el("td", { class: "r", text: String(best) }), el("td", { text: "target first (5)" })),
    el("tr", {}, el("td", { text: "Average over the 10 present targets" }), el("td", { class: "r", text: `${total}/10 = ${total / 10}` }), el("td", { text: "each item equally likely" })),
  );
}

/* =========================================================== Lecture 2: myFunction stepper */
const STEP_CAP = 4000;

function setupMyFunction() {
  const code = $("#mf-code");
  const tallies = Sim.MYFUNCTION_LINES.map((line) => {
    const t = el("span", { class: "tally" });
    code.append(el("li", {}, el("span", { text: line }), t));
    return t;
  });
  const lines = $$("li", code);
  let gen, steps, count, perLine, finished, truncated, n;
  function reset() {
    n = Math.max(0, Math.min(1000, Math.trunc(Number($("#mf-n").value) || 0)));
    gen = Sim.myFunctionSteps(n);
    steps = 0; count = 0; perLine = new Array(lines.length).fill(0); finished = false; truncated = false;
    lines.forEach((l) => l.classList.remove("on"));
    tallies.forEach((t) => { t.textContent = ""; });
    $("#mf-count").textContent = "0";
    $("#mf-vars").textContent = "";
    $("#mf-note").textContent = `n = ${n}. Press Step.`;
    $("#mf-result").replaceChildren();
  }
  function step() {
    if (finished) return false;
    const s = gen.next();
    if (s.done) { finished = true; return false; }
    const v = s.value;
    steps++;
    count += v.ops;
    perLine[v.line] += v.ops;
    lines.forEach((l, i) => l.classList.toggle("on", i === v.line));
    tallies.forEach((t, i) => { t.textContent = perLine[i] ? `+${perLine[i]}` : ""; });
    $("#mf-count").textContent = fmtInt(count);
    $("#mf-vars").textContent = Object.entries(v.vars).map(([k, x]) => `${k} = ${x}`).join(", ");
    $("#mf-note").textContent = v.note + (v.ops ? ` (+${v.ops})` : "");
    if (v.done) { finished = true; showResult(); }
    return true;
  }
  function showResult() {
    const box = $("#mf-result");
    box.replaceChildren();
    if (truncated) {
      $("#mf-count").textContent = `${fmtInt(count)} (partial)`;
      box.append(el("p", { class: "trunc", text: `Stopped after ${fmtInt(STEP_CAP)} steps, so the run is cut off. The count above is partial and isn't the total for n = ${n}. Use a smaller n to see a complete run.` }));
      return;
    }
    const formula = 4 * n + 4;
    const even = (120 + n) % 2 === 0;
    box.append(el("p", { class: "counter" }, "complete run, total ", el("b", { text: fmtInt(count) })));
    box.append(el("p", { class: "note", text: n === 0
      ? "For n = 0 the else loop would do nothing, so here the if branch is the slower one: 5 ops. The 4n + 4 count is for n ≥ 1."
      : even
      ? `The worst-case formula 4n + 4 gives ${formula}. This run is below it: b ended even, so the cheap if branch ran. The formula charges the slower branch.`
      : `The worst-case formula 4n + 4 gives ${formula}, which matches: b ended odd, so the else loop ran.` }));
  }
  $("#mf-step").addEventListener("click", step);
  $("#mf-run").addEventListener("click", () => {
    while (!finished) {
      if (steps >= STEP_CAP) { truncated = true; finished = true; lines.forEach((l) => l.classList.remove("on")); showResult(); break; }
      step();
    }
  });
  $("#mf-reset").addEventListener("click", reset);
  $("#mf-n").addEventListener("input", reset);
  reset();
}

function setupBeAnnoying() {
  const grid = $("#ba-grid"), out = $("#ba-out");
  const run = () => {
    const n = Math.max(0, Math.min(3000, Math.trunc(Number($("#ba-n").value) || 0)));
    const { prints, adds } = Sim.beAnnoyingCounts(n);
    grid.replaceChildren();
    const SHOW = 12;
    if (n <= SHOW) {
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = `repeat(${Math.max(n, 1)}, 1.4rem)`;
      grid.style.gap = "3px";
      for (let i = 0; i < n * n; i++) grid.append(el("span", { style: "width:1.4rem;height:1.4rem;background:var(--a1);border-radius:3px", title: `i = ${Math.floor(i / n)}, j = ${i % n}` }));
    } else grid.style.display = "none";
    out.textContent = `n = ${fmtInt(n)}: the loops ran to completion and printed ${fmtInt(prints)} times (= ${fmtInt(n)} × ${fmtInt(n)}), with ${fmtInt(adds)} m.add calls.${n > SHOW ? " (Grid drawn only for n ≤ 12; the count is still exact.)" : " Each square is one print: a row per outer iteration."}`;
  };
  $("#ba-run").addEventListener("click", run);
  run();
}

/* =========================================================== Lecture 2: ArrayList amortized */
function setupArrayList() {
  let c, length, size, writes, copies, costs;
  const cells = $("#al-cells"), out = $("#al-out"), svg = $("#al-bars");
  const MAX_ADDS = 120;
  function reset() {
    c = Math.max(1, Math.min(8, Math.trunc(Number($("#al-c").value) || 1)));
    length = c; size = 0; writes = 0; copies = 0; costs = [];
    draw();
  }
  function add() {
    if (costs.length >= MAX_ADDS) return false;
    let cost = 1;
    if (length === size) { copies += length; cost += length; length *= 2; }
    writes++; size++;
    costs.push(cost);
    return true;
  }
  function draw() {
    cells.replaceChildren();
    const shown = Math.min(length, 64);
    for (let i = 0; i < shown; i++) cells.append(el("div", { class: `cell${i < size ? "" : " empty"}` }, el("b", { text: i < size ? "●" : "·" }), el("span", { class: "idx", text: String(i) })));
    if (length > shown) cells.append(el("span", { class: "note", text: `… ${length - shown} more slots` }));
    const total = writes + copies;
    const ratio = size ? total / size : 0;
    const exact = size ? (total % size === 0 ? String(total / size) : `${total}/${size} ≈ ${ratio.toFixed(3)}`) : "–";
    out.textContent = size
      ? `${size} adds: ${writes} writes + ${copies} copies = ${total}. Total ÷ adds for this sequence = ${exact}. data.length = ${length}.${costs.length >= MAX_ADDS ? ` (The widget stops at ${MAX_ADDS} adds.)` : ""}`
      : `data.length = ${length}, size = 0. Press add.`;
    svg.replaceChildren();
    const W = 640, H = 140, base = 120, max = Math.max(2, ...costs, 2 * c);
    const bw = Math.min(16, (W - 40) / Math.max(costs.length, 1) - 2);
    svg.append(svgEl("line", { x1: 30, y1: base, x2: W, y2: base, class: "axis" }));
    svg.append(svgEl("text", { x: 0, y: 14 }, "cost"));
    costs.forEach((k, i) => {
      const h = Math.max(2, (k / max) * (base - 20));
      const x = 34 + i * (bw + 2);
      svg.append(svgEl("rect", { x, y: base - h, width: bw, height: h, rx: Math.min(4, bw / 2), fill: k > 1 ? "var(--a2)" : "var(--a1)" }, null));
      if (k > 1 && bw >= 6) svg.append(svgEl("text", { x: x + bw / 2, y: base - h - 4, "text-anchor": "middle", class: "label" }, String(k)));
    });
  }
  $("#al-add").addEventListener("click", () => { add(); draw(); });
  $("#al-add10").addEventListener("click", () => { for (let i = 0; i < 10; i++) add(); draw(); });
  $("#al-reset").addEventListener("click", reset);
  $("#al-c").addEventListener("input", reset);
  reset();
}

/* =========================================================== Lecture 2: binary search */
function setupBinarySearch() {
  const a = Sim.SLIDE_SORTED;
  let trace, shown;
  const cells = $("#bs-cells"), out = $("#bs-out"), log = $("#bs-log");
  function reset() {
    const k = Math.trunc(Number($("#bs-k").value) || 0);
    trace = Sim.binarySearchTrace(a, k); trace.k = k; shown = 0;
    log.replaceChildren();
    draw();
  }
  function draw() {
    const cur = trace.steps[shown - 1];
    const start = shown === 0 ? 0 : cur.start, end = shown === 0 ? a.length : cur.end;
    cells.replaceChildren(...a.map((v, i) => {
      const inRange = i >= start && i < end;
      const c = el("div", { class: `cell${inRange ? "" : " empty"}` });
      const p = [];
      if (shown && i === cur.mid) p.push("mid");
      if (i === start && shown) p.push("start");
      c.append(el("span", { class: "ptr", text: p.join(" · ") }), el("b", { text: String(v), style: inRange ? "" : "color:var(--ink-faint)" }), el("span", { class: "idx", text: String(i) }));
      return c;
    }));
    const lin = Sim.linearSearch(a, trace.k).comparisons;
    if (shown === 0) out.textContent = `start = 0, end = ${a.length}. Press Step.`;
    else if (shown < trace.steps.length) out.textContent = `Iteration ${shown}: mid = ${cur.mid}, a.get(mid) = ${cur.value} ${cur.outcome === "right" ? `< ${trace.k}, so start = mid+1` : `> ${trace.k}, so end = mid`}.`;
    else {
      out.textContent = trace.found
        ? `Found ${trace.k} in ${trace.iterations} iteration${trace.iterations === 1 ? "" : "s"}. Linear search would use ${lin} comparison${lin === 1 ? "" : "s"}.`
        : `start = end = ${trace.finalStart}: the loop stops and returns false after ${trace.iterations} iterations. Linear search would use ${lin}.`;
    }
  }
  function step() {
    if (shown >= trace.steps.length) return;
    shown++;
    const s = trace.steps[shown - 1];
    logLine(log, `#${shown}: start=${s.start} end=${s.end} mid=${s.mid} a.get(mid)=${s.value} → ${s.outcome === "found" ? "found" : s.outcome === "right" ? "go right" : "go left"}`);
    draw();
  }
  $("#bs-step").addEventListener("click", step);
  $("#bs-run").addEventListener("click", () => { while (shown < trace.steps.length) step(); });
  $("#bs-reset").addEventListener("click", reset);
  $("#bs-k").addEventListener("input", reset);
  reset();

  const t = $("#bsw-table");
  t.append(el("tr", {}, el("th", { class: "r", text: "n" }), el("th", { class: "r", text: "worst iterations (all targets tried)" }), el("th", { class: "r", text: "⌊log₂ n⌋ + 1" }), el("th", { class: "r", text: "linear search worst" })));
  for (const n of [1, 2, 3, 4, 7, 8, 10, 15, 16, 100, 1000, 1024]) {
    const w = Sim.binaryWorstExhaustive(n);
    t.append(el("tr", {}, el("td", { class: "r", text: fmtInt(n) }), el("td", { class: "r", text: String(w) }), el("td", { class: "r", text: String(Math.floor(Math.log2(n)) + 1) }), el("td", { class: "r", text: fmtInt(n) })));
  }
}

/* =========================================================== Lecture 2: growth comparison (A, B, C) */
const SERIES = [
  { key: "A", color: "var(--a1)", tex: "10n + 900" },
  { key: "B", color: "var(--a2)", tex: "100n − 50" },
  { key: "C", color: "var(--a3)", tex: "n²/100" },
];

let growthRange = 50;

function drawGrowth() {
  const svg = $("#gr-svg");
  if (!svg || !svg.getBoundingClientRect().width) return;
  // viewBox follows the rendered width so text stays at its real size on phones
  const W = Math.round(Math.max(320, Math.min(680, svg.getBoundingClientRect().width))), H = W < 500 ? 260 : 320, L = 56, R = 30, T = 14, B = 34;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const N = growthRange, pts = 120;
  const ns = Array.from({ length: pts + 1 }, (_, i) => Math.round((i / pts) * N)).filter((v, i, arr) => arr.indexOf(v) === i);
  const vals = SERIES.map((s) => ns.map((n) => Number(Sim.algValue(s.key, n)) / 100));
  const maxY = Math.max(...vals.flat());
  const niceMax = (() => { const p = 10 ** Math.floor(Math.log10(maxY)); return Math.ceil(maxY / p) * p; })();
  const x = (n) => L + (n / N) * (W - L - R), y = (v) => T + (1 - v / niceMax) * (H - T - B);
  svg.replaceChildren();
  for (let k = 0; k <= 4; k++) {
    const v = (niceMax / 4) * k;
    svg.append(svgEl("line", { x1: L, y1: y(v), x2: W - R, y2: y(v), class: "grid" }));
    svg.append(svgEl("text", { x: L - 6, y: y(v) + 4, "text-anchor": "end" }, fmtInt(Math.round(v))));
  }
  const xt = W < 500 ? 2 : 5;
  for (let k = 0; k <= xt; k++) {
    const n = Math.round((N / xt) * k);
    svg.append(svgEl("text", { x: x(n), y: H - 12, "text-anchor": k === xt ? "end" : k === 0 ? "start" : "middle" }, k === xt ? `n = ${fmtInt(n)}` : fmtInt(n)));
  }
  svg.append(svgEl("line", { x1: L, y1: H - B, x2: W - R, y2: H - B, class: "axis" }));
  const labelYs = [];
  SERIES.forEach((s, si) => {
    const d = ns.map((n, i) => `${i ? "L" : "M"}${x(n).toFixed(1)},${y(vals[si][i]).toFixed(1)}`).join("");
    svg.append(svgEl("path", { d, class: "series", stroke: s.color }));
    const end = vals[si][vals[si].length - 1];
    let ly = y(end);
    for (const o of labelYs) if (Math.abs(o - ly) < 16) ly = o + 16;
    labelYs.push(ly);
    svg.append(svgEl("circle", { cx: x(N), cy: y(end), r: 4, fill: s.color, class: "dot" }));
    svg.append(svgEl("text", { x: x(N) + 8, y: ly + 4, class: "label" }, s.key));

  });
  // hover: crosshair + exact values
  const hover = svgEl("g", { visibility: "hidden" });
  const hl = svgEl("line", { y1: T, y2: H - B, class: "hover-line" });
  hover.append(hl);
  svg.append(hover);
  const hit = svgEl("rect", { x: L, y: T, width: W - L - R, height: H - T - B, fill: "transparent" });
  svg.append(hit);
  const box = $("#gr-box");
  let tip = $(".tip", box);
  if (!tip) { tip = el("div", { class: "tip", hidden: true }); box.append(tip); }
  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const n = Math.max(0, Math.min(N, Math.round(((px - L) / (W - L - R)) * N)));
    hl.setAttribute("x1", x(n)); hl.setAttribute("x2", x(n));
    hover.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.replaceChildren(el("strong", { text: `n = ${fmtInt(n)}` }), ...SERIES.map((s) => el("div", { text: `${s.key}: ${Sim.fmtHundredths(Sim.algValue(s.key, n))}` })));
    tip.style.left = `${(x(n) / W) * r.width}px`;
    tip.style.top = `${(T / H) * r.height + 40}px`;
  };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerleave", () => { hover.setAttribute("visibility", "hidden"); tip.hidden = true; });
}

function setupGrowth() {
  $("#gr-legend").append(...SERIES.map((s) => el("span", {}, el("span", { class: "key", style: `border-color:${s.color}` }), `${s.key}: ${s.tex}`)));
  $$("#gr [data-range]").forEach((b) => b.addEventListener("click", () => {
    growthRange = Number(b.dataset.range);
    $$("#gr [data-range]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    drawGrowth();
    buildGrowthTable();
  }));
  const exact = () => {
    const raw = $("#gr-n").value.trim();
    if (!/^\d{1,10}$/.test(raw)) { $("#gr-exact").textContent = "Enter a whole number n ≥ 0."; return; }
    const n = BigInt(raw);
    const v = SERIES.map((s) => [s.key, Sim.algValue(s.key, n)]);
    const min = v.reduce((m, p) => (p[1] < m[1] ? p : m));
    const ties = v.filter((p) => p[1] === min[1]).map((p) => p[0]);
    $("#gr-exact").textContent = `At n = ${fmtInt(n)}: ${v.map(([k, h]) => `${k} = ${Sim.fmtHundredths(h)}`).join(", ")}. Smallest here: ${ties.join(" and ")}.`;
  };
  $("#gr-n").addEventListener("input", exact);
  exact();
  $("#gr-table-toggle").addEventListener("click", (e) => {
    const t = $("#gr-table");
    t.hidden = !t.hidden;
    e.currentTarget.setAttribute("aria-pressed", String(!t.hidden));
  });
  buildGrowthTable();
  window.addEventListener("resize", drawGrowth);
}

function buildGrowthTable() {
  const N = growthRange;
  const ns = [...new Set([0, 1, 10, 11, Math.round(N / 4), Math.round(N / 2), N, ...(N >= 2000 ? [1083, 1084] : []), ...(N >= 20000 ? [10000] : [])])].filter((n) => n <= N).sort((a, b) => a - b);
  const tbl = el("table", { class: "plain num" }, el("tr", {}, el("th", { class: "r", text: "n" }), ...SERIES.map((s) => el("th", { class: "r", text: `${s.key} = ${s.tex}` }))));
  for (const n of ns) tbl.append(el("tr", {}, el("td", { class: "r", text: fmtInt(n) }), ...SERIES.map((s) => el("td", { class: "r", text: Sim.fmtHundredths(Sim.algValue(s.key, n)) }))));
  $("#gr-table").replaceChildren(tbl);
}

/* =========================================================== Lecture 2: find c and n0 */
const CLAIMS = [
  { id: "a-linear", text: "10n + 900 ∈ O(n)  (algorithm A)", f: ["900", "10"], g: ["0", "1"], rel: "O", c: "11", n0: "1" },
  { id: "b-linear-omega", text: "100n − 50 ∈ Ω(n)  (algorithm B)", f: ["-50", "100"], g: ["0", "1"], rel: "Omega", c: "100", n0: "1" },
  { id: "c-not-linear", text: "n²/100 ∈ O(n)?  (algorithm C — try to make it work)", f: ["0", "0", "1/100"], g: ["0", "1"], rel: "O", c: "1000", n0: "1" },
  { id: "summary-cubic", text: "4n² + 8n + 10 ∈ O(¼n³)  (topic summary)", f: ["10", "8", "4"], g: ["0", "0", "0", "1/4"], rel: "O", c: "1", n0: "1" },
  { id: "summary-quad-o", text: "4n² − 8n + 10 ∈ O(2n²)  (topic summary)", f: ["10", "-8", "4"], g: ["0", "0", "2"], rel: "O", c: "2", n0: "1" },
  { id: "summary-quad-omega", text: "4n² − 8n + 10 ∈ Ω(2n²)  (topic summary)", f: ["10", "-8", "4"], g: ["0", "0", "2"], rel: "Omega", c: "2", n0: "1" },
];

function polyString(coeffs) {
  const terms = [];
  coeffs.forEach((c, k) => {
    if (c === "0") return;
    const v = k === 0 ? "" : k === 1 ? "n" : `n${["", "", "²", "³"][k]}`;
    terms.push({ c, v });
  });
  return terms.reverse().map(({ c, v }, i) => {
    const neg = c.startsWith("-"); const a = neg ? c.slice(1) : c;
    const coef = v && a === "1" ? "" : a;
    return `${i ? (neg ? " − " : " + ") : neg ? "−" : ""}${coef}${coef && v && a.includes("/") ? "·" : ""}${v}`;
  }).join("") || "0";
}

function setupBoundChecker() {
  const sel = $("#cn-claim");
  CLAIMS.forEach((c) => sel.append(el("option", { value: c.id, text: c.text })));
  const cur = () => CLAIMS.find((c) => c.id === sel.value);
  sel.addEventListener("change", () => { $("#cn-c").value = cur().c; $("#cn-n0").value = cur().n0; $("#cn-out").textContent = ""; plot(); });
  function plot(result) {
    const cl = cur();
    const svg = $("#cn-svg");
    svg.replaceChildren();
    const cE = G.tryEval($("#cn-c").value, {}), nE = G.tryEval($("#cn-n0").value, {});
    const c = cE.ok ? G.qToNumber(cE.value) : 1;
    const n0 = nE.ok ? Math.max(0, G.qToNumber(nE.value)) : 1;
    const fNum = (n) => cl.f.reduce((s, a, k) => s + G.qToNumber(G.evalExact(a)) * n ** k, 0);
    const gNum = (n) => c * cl.g.reduce((s, a, k) => s + G.qToNumber(G.evalExact(a)) * n ** k, 0);
    const ce = result && result.counterexample ? Number(result.counterexample.n) : null;
    const N = Math.max(20, Math.ceil(Math.max(n0, ce || 0) * 2.2));
    const W = Math.round(Math.max(320, Math.min(680, svg.getBoundingClientRect().width || 680))), H = 240, L = 62, R = 64, T = 12, B = 28;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const ns = Array.from({ length: 101 }, (_, i) => (i / 100) * N);
    const ys = [...ns.map(fNum), ...ns.map(gNum)];
    const lo = Math.min(0, ...ys), hi = Math.max(...ys) || 1;
    const x = (n) => L + (n / N) * (W - L - R), y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    svg.append(svgEl("line", { x1: L, y1: y(0), x2: W - R, y2: y(0), class: "axis" }));
    [0, 0.5, 1].forEach((t) => svg.append(svgEl("text", { x: L - 6, y: y(lo + t * (hi - lo)) + 4, "text-anchor": "end" }, fmtInt(Math.round(lo + t * (hi - lo))))));
    [0, 0.5, 1].forEach((t) => svg.append(svgEl("text", { x: x(t * N), y: H - 8, "text-anchor": "middle" }, fmtInt(Math.round(t * N)))));
    if (n0 <= N) {
      svg.append(svgEl("rect", { x: x(n0), y: T, width: Math.max(0, x(N) - x(n0)), height: H - T - B, fill: "var(--a3-tint)", opacity: 0.6 }));
      svg.append(svgEl("text", { x: x(n0) + 4, y: T + 14 }, "n ≥ n₀"));
    }
    [[fNum, "var(--a1)", "f(n)"], [gNum, "var(--a2)", "c·g(n)"]].forEach(([fn, color, lab], k) => {
      svg.append(svgEl("path", { d: ns.map((n, i) => `${i ? "L" : "M"}${x(n).toFixed(1)},${y(fn(n)).toFixed(1)}`).join(""), class: "series", stroke: color }));
      svg.append(svgEl("text", { x: x(N) + 8, y: y(fn(N)) + 4 + (k && Math.abs(y(fNum(N)) - y(gNum(N))) < 16 ? 16 : 0), class: "label" }, lab));
    });
    if (ce !== null && ce <= N) svg.append(svgEl("circle", { cx: x(ce), cy: y(fNum(ce)), r: 5, fill: "var(--wrong)", class: "dot" }));
  }
  $("#cn-check").addEventListener("click", () => {
    const cl = cur();
    const r = G.checkBound(cl, $("#cn-c").value, $("#cn-n0").value);
    const out = $("#cn-out");
    const fS = polyString(cl.f), gS = polyString(cl.g);
    if (r.unreadable) { out.textContent = "Use numbers like 11, 1/2 or 900."; plot(); return; }
    out.textContent = r.holds
      ? `Holds: ${fS} ${cl.rel === "O" ? "≤" : "≥"} ${r.normalized.c}·(${gS}) for every integer n ≥ ${r.normalized.n0}. That pair proves the claim.`
      : boundDetail(r, cl).replace("f(n)", `f(n) = ${fS}`);
    plot(r);
  });
  sel.addEventListener("redraw", () => plot());
  window.addEventListener("resize", () => plot());
  $("#cn-c").addEventListener("input", () => plot());
  $("#cn-n0").addEventListener("input", () => plot());
  plot();
}

/* =========================================================== brute-force buttons */
const BRUTE = {
  "circular-trace"() {
    const q = Sim.circularQueue();
    for (let i = 0; i < 3; i++) q.dequeue();
    for (let x = 1; x <= 6; x++) q.enqueue(x);
    return { ok: q.front === 3 && q.back === 1 && q.size === 8 && q.queue[0] === 6, text: `Ran the circular array code: front = ${q.front}, back = ${q.back}, size = ${q.size}, queue[0] = ${q.queue[0]}.` };
  },
  "arraylist-14c"() {
    const rows = [];
    let ok = true;
    for (let c = 1; c <= 8; c++) { const r = Sim.arrayListAdds(c, 7 * c); rows.push(`c=${c}: ${r.total}`); if (r.total !== 14 * c) ok = false; }
    return { ok, text: `Ran add() 7c times from length c: ${rows.join(", ")}. ${ok ? "Every total is exactly 14c." : "Mismatch."}` };
  },
  "binary-1000"() {
    const w = Sim.binaryWorstExhaustive(1000);
    return { ok: w === 10, text: `Searched a sorted list of 1,000 for all 2,001 possible targets (each item and each gap): the most iterations was ${w}.` };
  },
  crossovers() {
    const A = (n) => Sim.algValue("A", n), B = (n) => Sim.algValue("B", n), C = (n) => Sim.algValue("C", n);
    const ab = Sim.firstN((n) => A(n) < B(n)), ca = Sim.firstN((n) => C(n) > A(n));
    let stays = true;
    for (let n = BigInt(ca); n < 100000n; n++) if (!(C(n) > A(n))) { stays = false; break; }
    return { ok: ab === 11 && ca === 1084 && stays, text: `Exact integer arithmetic over n = 1 … 100,000: A < B first at n = ${ab}; C > A first at n = ${ca}, and C stays above A for every n in the range checked. (That's a check, not a proof: the algebra in step 2 covers all n.)` };
  },
};

function setupBrute() {
  $$("[data-brute]").forEach((btn) => {
    const out = btn.nextElementSibling;
    btn.addEventListener("click", () => {
      out.className = "brute"; out.textContent = "Running…"; btn.disabled = true;
      setTimeout(() => {
        const r = BRUTE[btn.dataset.brute]();
        btn.disabled = false;
        out.className = `brute ${r.ok ? "ok" : ""}`;
        out.textContent = r.text;
      }, 20);
    });
  });
}

/* ---- wire it up */
setupQueues();
setupStackVsQueue();
setupStepper($("#lq-step"), "linked");
setupStepper($("#cq-step"), "circular");
setupTermSort();
setupScenarios();
setupMyFunction();
setupBeAnnoying();
setupArrayList();
setupBinarySearch();
setupGrowth();
setupBoundChecker();
setupBrute();
};
