/* CSE 332 w02: misconception feedback (shown by core/grader.js for a tag in data-miscon) and this week's widgets. */
window.WEEK = window.WEEK || {};
window.WEEK.messages = {
  "linear-count": "That's how many items a linear scan would look at. Each binary-search iteration halves the gap.",
  "halved-once": "That's after one halving. Keep halving until the gap is 1.",
  "stopped-early": "Close. The loop still runs one more time when end − start is 1.",
  "rounded-up": "Check which power of 2 is just below n. The worst case is ⌊log₂ n⌋ + 1.",
  "doubled-log": "Doubling n adds one more halving, not twice as many.",
  "strict-vs-equal": "Check that exact value of n directly. Is the inequality true there, and for every n after it?",
  "bigger-in-smaller": "Which grows faster, n or log n? O asks whether the left side is eventually at most a constant times the right.",
  "c3-works": "Plug c = 3 in: the 3n terms cancel. What's left, and is it ever true?",
  "omega-best": "Ω is a lower bound on whatever function you analyze. The case (best, worst…) is a separate choice.",
  "not-tight": "That's a valid upper bound, but not the tightest bucket. Drop constants and lower-order terms of the actual function.",
  "too-small": "That bucket grows too slowly. Find the dominant term.",
  "simplify-terms": "Correct bucket. Write it simplified, though: drop the non-dominant terms.",
  "simplify-constant": "Correct bucket. Write it simplified, though: drop the constant factor.",
  "simplify-base": "Correct bucket. Write it simplified, though: log bases don't matter, so just write log n.",
  "oldest-not-smallest": "That's the order a plain queue gives. A priority queue returns the smallest priority currently in it.",
  "smallest-ever": "That item was already extracted. Look at what is still in the queue at that moment.",
  "start-spot": "That's where it starts. Keep comparing with the parent until the parent is smaller or equal.",
  "one-swap-short": "Check the next parent up too. Does the comparison still say “smaller”?",
  "larger-child": "That's what happens if it swaps with the larger child. Percolate down always picks the smaller child.",
  "moved-item": "That's the item that moved to the root. It doesn't stay there if a child is smaller.",
  "zero-based": "That's the 0-based formula. The lecture's array starts at index 1: children 2i and 2i+1, parent i/2.",
  "no-floor": "Index arithmetic is integer division: drop the remainder.",
  "leaf-by-index": "A node is a leaf when it has no left child, which is when 2i > n. Check 2i against n.",
  "height-not-count": "That's a count of levels or nodes. Height counts edges on the longest path from the root down.",
  "full-tree-off-by-one": "A tree of height h holds up to 2^(h+1) − 1 nodes. Which h is the first one big enough?",
  "same-direction": "Changing a key moves the item the way that fixes its order: smaller values move toward the root of a min-heap.",
  "counted-outer": "Count only the iterations of the inner loop (lines 10–14).",
  "all-distinct-count": "Not every i starts the inner loop: some are already visited.",
  "sum-off": "Count the inner loop for each i separately: it starts at j = i and runs to the end.",
  "min-vs-max": "That's the most nodes a tree of height 5 can hold. The fewest is one more than a full tree of height 4.",
  "forgot-first-loop": "Don't forget the first loop (lines 3–5): it runs n times on every input.",
  "parts-forgot-term": "Every term adds its own multiple of g. Did you add the one from 2n too?",
  "parts-n0-max": "Every step has to hold at the same time. Which step needs the biggest n?",
  "chain-both": "Both comparisons have to hold at the same n. At n = 2, 3 or 4, the second one isn't true yet.",
  "times-g": "c multiplies n/10. What times n/10 gives exactly 7n?",
  "build-first-leaf": "That index is a leaf: percolateDown does nothing there. The first index that can move is the last one with a child.",
};

"use strict";
window.WEEK = window.WEEK || {};
window.WEEK.widgets = function ({ $, $$, el, store, G, renderMath, toast, REDRAW, currentId, reduceMotion, specFor, ITEMS, refreshCounts }) {
const Sim = window.Sim;
function svgEl(tag, attrs = {}, text) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}

const fmtInt = (x) => (typeof x === "bigint" ? x.toLocaleString("en-US") : Number(x).toLocaleString("en-US"));

/* =========================================================== shared line chart (SVG, responsive, hover)
   One y axis only. Series are identified by legend + direct end labels (never color alone). */
const COLORS = (() => {
  const css = getComputedStyle(document.documentElement);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return { f: v("--s1", "#2a78d6"), g: v("--s2", "#eb6834"), h: v("--s3", "#1baf7a") };
})();

function lineChart(svg, opts) {
  const box = svg.parentElement;
  const width = svg.getBoundingClientRect().width;
  if (!width) return;
  const W = Math.round(Math.max(300, Math.min(760, width)));
  const H = opts.height ? opts.height(W) : (W < 520 ? 230 : 280);
  const L = opts.left || 56, R = opts.right || 64, T = 16, B = 38;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.replaceChildren();
  const [x0, x1] = opts.xDomain;
  const allY = opts.series.flatMap((s) => s.pts.map((p) => p[1])).filter(Number.isFinite);
  let [y0, y1] = opts.yDomain || [Math.min(0, ...allY), Math.max(...allY)];
  if (y1 <= y0) y1 = y0 + 1;
  const nice = (v) => { const p = 10 ** Math.floor(Math.log10(Math.abs(v) || 1)); return Math.ceil(v / p) * p; };
  if (!opts.yDomain) y1 = nice(y1);
  const x = (v) => L + ((v - x0) / (x1 - x0)) * (W - L - R);
  const y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  if (opts.shade && opts.shade.from <= x1) {
    const a = Math.max(x0, opts.shade.from);
    svg.append(svgEl("rect", { x: x(a), y: T, width: Math.max(0, x(x1) - x(a)), height: H - T - B, class: "shade" }));
    svg.append(svgEl("text", { x: Math.min(x(a) + 6, W - R - 120), y: T + 14, class: "shade-label" }, opts.shade.label));
  }
  const yt = opts.yTicks || 4;
  for (let k = 0; k <= yt; k++) {
    const v = y0 + ((y1 - y0) / yt) * k;
    svg.append(svgEl("line", { x1: L, y1: y(v), x2: W - R, y2: y(v), class: "grid" }));
    svg.append(svgEl("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end" }, opts.yFmt ? opts.yFmt(v) : fmtNum(v)));
  }
  const xt = W < 520 ? 3 : 5;
  for (let k = 0; k <= xt; k++) {
    const v = x0 + ((x1 - x0) / xt) * k;
    svg.append(svgEl("text", { x: x(v), y: H - 16, "text-anchor": k === 0 ? "start" : k === xt ? "end" : "middle" }, opts.xFmt ? opts.xFmt(v) : fmtNum(v)));
  }
  svg.append(svgEl("text", { x: W - R, y: H - 2, "text-anchor": "end", class: "axis-title" }, opts.xLabel));
  if (opts.yLabel) svg.append(svgEl("text", { x: L + 6, y: T + 12, class: "axis-title" }, opts.yLabel));
  svg.append(svgEl("line", { x1: L, y1: H - B, x2: W - R, y2: H - B, class: "axis" }));
  for (const m of opts.markers || []) {
    if (m.x < x0 || m.x > x1) continue;
    svg.append(svgEl("line", { x1: x(m.x), y1: T, x2: x(m.x), y2: H - B, class: "marker" }));
    svg.append(svgEl("text", { x: x(m.x) + (x(m.x) > W - R - 90 ? -6 : 6), y: H - B - 8, class: "marker-label", "text-anchor": x(m.x) > W - R - 90 ? "end" : "start" }, m.label));
  }
  // lines that leave the plot are clipped at its edge (never flattened), and labelled where they leave
  const clipId = `clip-${svg.id || svg.closest(".panel, .race-card")?.id || "c"}-${(lineChart.n = (lineChart.n || 0) + 1)}`;
  const defs = svgEl("defs");
  const cp = svgEl("clipPath", { id: clipId });
  cp.append(svgEl("rect", { x: L - 3, y: T - 3, width: W - L - R + 6, height: H - T - B + 6 }));
  defs.append(cp); svg.append(defs);
  const labelYs = [];
  for (const s of opts.series) {
    const pts = s.pts.filter((p) => Number.isFinite(p[1]));
    svg.append(svgEl("path", { d: pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(""), class: "series", stroke: s.color, "stroke-dasharray": s.dash || "", "clip-path": `url(#${clipId})` }));
    let k = pts.length - 1;
    while (k > 0 && y(pts[k][1]) < T - 1) k--;
    const last = pts[k];
    const exits = k < pts.length - 1;
    let ly = Math.max(T, y(last[1]));
    for (const o of labelYs) if (Math.abs(o - ly) < 15) ly = o + (ly >= o ? 15 : -15);
    labelYs.push(ly);
    if (!exits && !opts.noEndDots) svg.append(svgEl("circle", { cx: x(last[0]), cy: y(last[1]), r: 4, fill: s.color, class: "dot" }));
    svg.append(svgEl("text", { x: x(last[0]) + 8, y: ly + 4, class: "label" }, exits ? `${s.label} ↑` : s.label));
  }
  for (const d of opts.dots || []) if (d.x >= x0 && d.x <= x1 && d.y >= y0 && d.y <= y1) svg.append(svgEl("circle", { cx: x(d.x), cy: y(d.y), r: d.r || 5, class: `dot ${d.cls || ""}` }));
  if (!opts.hover) return;
  const hov = svgEl("line", { y1: T, y2: H - B, class: "hover-line", visibility: "hidden" });
  svg.append(hov);
  const hit = svgEl("rect", { x: L, y: T, width: W - L - R, height: H - T - B, fill: "transparent" });
  svg.append(hit);
  let tip = $(".tip", box);
  if (!tip) { tip = el("div", { class: "tip", hidden: true }); box.append(tip); }
  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    let v = x0 + ((px - L) / (W - L - R)) * (x1 - x0);
    v = Math.max(x0, Math.min(x1, opts.snap ? opts.snap(v) : v));
    hov.setAttribute("x1", x(v)); hov.setAttribute("x2", x(v)); hov.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.replaceChildren(...opts.hover(v).map((line, i) => (i === 0 ? el("strong", { text: line }) : el("div", { text: line }))));
    tip.style.left = `${Math.min(Math.max((x(v) / W) * r.width, 70), r.width - 70)}px`;
    tip.style.top = `${(T / H) * r.height + 36}px`;
  };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerleave", () => { hov.setAttribute("visibility", "hidden"); tip.hidden = true; });
}

function fmtNum(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return v.toExponential(1).replace("e+", "e");
  if (a >= 100 || Number.isInteger(v)) return Math.round(v).toLocaleString("en-US");
  return (Math.round(v * 10) / 10).toLocaleString("en-US");
}
const sciBig = (x) => { const s = x.toString(); return s.length <= 15 ? BigInt(s).toLocaleString("en-US") : `${s[0]}.${s.slice(1, 4)}×10^${s.length - 1}`; };
const sup = (s) => s.replace(/\^(\d+|n)\b/g, (_, d) => (d === "n" ? "ⁿ" : [...d].map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[c]).join("")));

/* =========================================================== home hero: n^50 vs 1.1^n, exactly */
function setupHero() {
  const R = Sim.RACES.n50;
  const slider = $("#hero-n"), num = $("#hero-n-num");
  const N_MAX = 6000;
  const fromSlider = (v) => Math.max(1, Math.round(Math.exp((v / 1000) * Math.log(20000))));
  const toSlider = (n) => Math.round((Math.log(n) / Math.log(20000)) * 1000);
  let heroN = 100;
  function update(n) {
    n = Math.max(1, Math.min(20000, Math.trunc(n) || 1));
    const c = R.cmp(n);
    const fD = Sim.digits(Sim.bigPow(n, 50)), gInt = Sim.bigPow(11, n) / Sim.bigPow(10, n);
    $("#hero-f").textContent = fD > 15 ? `${fD}-digit number` : Sim.bigPow(n, 50).toLocaleString("en-US");
    const tenths = (Sim.bigPow(11, n) * 10n + Sim.bigPow(10, n) / 2n) / Sim.bigPow(10, n); // round(10 · 1.1^n)
    const gShort = `${(tenths / 10n).toLocaleString("en-US")}.${tenths % 10n}`;
    $("#hero-g").textContent = Sim.digits(gInt) > 15 ? `${Sim.digits(gInt)}-digit number` : n <= 1 ? "1.1" : `≈ ${gShort}`;
    $("#hero-f-sub").textContent = `n = ${fmtInt(n)}`;
    $("#hero-g-sub").textContent = `n = ${fmtInt(n)}`;
    $("#hero-vs").textContent = c > 0 ? ">" : c < 0 ? "<" : "=";
    $(".duel-side.s1", $("#hero")).classList.toggle("lead", c > 0);
    $(".duel-side.s2", $("#hero")).classList.toggle("lead", c < 0);
    $("#hero-out").textContent = c > 0
      ? `At n = ${fmtInt(n)}, n⁵⁰ is bigger.${n < 4402 ? " Keep going." : ""}`
      : n === 1 ? "At n = 1, 1.1ⁿ is ahead (1 < 1.1), but only for this one value."
        : `At n = ${fmtInt(n)}, 1.1ⁿ is bigger. From n = 4,402 on, it stays bigger forever.`;
    if (document.activeElement !== num) num.value = n;
    if (document.activeElement !== slider) slider.value = toSlider(n);
    heroN = n;
    drawHero();
  }
  function drawHero() {
    const xs = Array.from({ length: 241 }, (_, i) => Math.max(1, Math.round((i / 240) * N_MAX)));
    lineChart($("#hero-svg"), {
      xDomain: [0, N_MAX], xLabel: "n", yLabel: "number of digits",
      series: [
        { color: COLORS.f, label: "n⁵⁰", pts: xs.map((n) => [n, R.log10f(n) + 1]) },
        { color: COLORS.g, label: "1.1ⁿ", pts: xs.map((n) => [n, R.log10g(n) + 1]) },
      ],
      markers: [{ x: 4402, label: "n₀ = 4,402" }],
      shade: { from: 4402, label: "1.1ⁿ ahead forever" },
      dots: heroN <= N_MAX ? [{ x: heroN, y: Math.max(R.log10f(heroN), R.log10g(heroN)) + 1, cls: "now" }] : [],
      snap: (v) => Math.max(1, Math.round(v)),
      hover: (n) => [`n = ${fmtInt(n)}`, `n⁵⁰: ${Sim.digits(Sim.bigPow(n, 50))} digits`, `1.1ⁿ: ${Math.floor(R.log10g(n)) + 1} digits`, R.cmp(n) > 0 ? "n⁵⁰ is bigger" : "1.1ⁿ is at least as big"],
    });
  }
  slider.addEventListener("input", () => update(fromSlider(Number(slider.value))));
  num.addEventListener("input", () => { if (num.value.trim()) update(Number(num.value)); });
  $$("[data-hero-jump]").forEach((b) => b.addEventListener("click", () => update(Number(b.dataset.heroJump))));
  REDRAW.add((id) => { if (id === "home") drawHero(); });
  update(100);
}

/* =========================================================== binary search on 16 items */
const LIST16 = [4, 9, 15, 21, 26, 33, 38, 42, 47, 53, 58, 64, 70, 77, 83, 91];
function setupGap() {
  const a = LIST16;
  let trace, shown;
  const cells = $("#gap-cells"), out = $("#gap-out"), bars = $("#gap-bars");
  function reset() {
    const k = Math.trunc(Number($("#gap-k").value) || 0);
    trace = Sim.binarySearchTrace(a, k); trace.k = k; shown = 0;
    draw();
  }
  function draw() {
    const cur = trace.steps[shown - 1];
    let start = 0, end = a.length;
    if (shown) { start = cur.start; end = cur.end; }
    cells.replaceChildren(...a.map((v, i) => {
      const inRange = i >= start && i < end;
      const c = el("div", { class: `cell${inRange ? "" : " out"}${shown && i === cur.mid ? " mid" : ""}` });
      c.append(el("span", { class: "ptr", text: shown && i === cur.mid ? "mid" : "" }), el("b", { text: String(v) }), el("span", { class: "idx", text: String(i) }));
      return c;
    }));
    bars.replaceChildren(...trace.steps.slice(0, shown).map((s, i) => el("div", { class: "gap-bar" },
      el("span", { class: "gap-it", text: `#${i + 1}` }),
      el("span", { class: "gap-fill", style: `width:${(s.gap / a.length) * 100}%` }),
      el("span", { class: "gap-num", text: `${s.gap} left` }))));
    const k = trace.k, lin = Sim.linearSearch(a, k).comparisons, path = trace.gaps.join(" → ");
    if (shown === 0) out.textContent = `${a.length} items could hold ${k}. Press Step.`;
    else if (shown < trace.steps.length) out.textContent = `Loop ${shown}: ${cur.gap} left. The middle is ${cur.value}. ${k} is ${cur.outcome === "right" ? "bigger, so drop the left half" : "smaller, so drop the right half"}.`;
    else out.textContent = trace.found
      ? `Found ${k} on loop ${trace.iterations}. Items left: ${path}. Checking every item would take ${lin}.`
      : `${k} isn't there. Stopped after ${trace.iterations} loops. Items left: ${path}. Checking every item would take ${lin}.`;
  }
  const step = () => { if (shown < trace.steps.length) { shown++; draw(); } };
  $("#gap-step").addEventListener("click", step);
  $("#gap-run").addEventListener("click", () => { while (shown < trace.steps.length) step(); });
  $("#gap-reset").addEventListener("click", reset);
  $("#gap-k").addEventListener("input", reset);
  reset();
}

/* =========================================================== 10n vs n^2 */
function setupBuckets() {
  const A = (n) => 10 * n, B = (n) => n * n, N = 30;
  const draw = () => {
    const xs = Array.from({ length: 121 }, (_, i) => (i / 120) * N);
    lineChart($("#ab-svg"), {
      xDomain: [0, N], yDomain: [0, 900], xLabel: "n", yLabel: "steps",
      series: [{ color: COLORS.f, label: "10n", pts: xs.map((n) => [n, A(n)]) }, { color: COLORS.g, label: "n²", pts: xs.map((n) => [n, B(n)]) }],
      markers: [{ x: 10, label: "n = 10" }],
      shade: { from: 10, label: "10n wins" },
      snap: (v) => Math.max(1, Math.round(v)),
      hover: (n) => [`n = ${n}`, `10n = ${fmtInt(A(n))}`, `n² = ${fmtInt(B(n))}`],
    });
  };
  REDRAW.add((id) => { if (id === "compare") draw(); });
  draw();
}

/* =========================================================== priority queue, animated */
// data-script: "+5,6,3" inserts 5, 6 and 3; "-" extracts the smallest waiting.
function pqSteps(script) {
  const steps = script.trim().split(/\s+/).map((t) => (t === "-" ? { op: "extract" } : { op: "insert", xs: t.slice(1).split(",").map(Number) }));
  let waiting = [];
  const printed = [];
  for (const st of steps) {
    if (st.op === "insert") {
      waiting = [...waiting, ...st.xs];
      st.say = st.xs.length > 1 ? `${st.xs.slice(0, -1).join(", ")} and ${st.xs.at(-1)} arrive, in that order.` : printed.length ? `${st.xs[0]} arrives last.` : `${st.xs[0]} arrives.`;
    } else {
      const min = Math.min(...waiting), oldest = waiting[0], alone = waiting.length === 1;
      st.out = min;
      waiting = waiting.filter((x, i) => i !== waiting.indexOf(min));
      printed.push(min);
      st.say = alone ? `${min} is the only one left, so it comes out.` : `The smallest waiting is ${min}, so ${min} comes out${min !== oldest ? `, even though ${oldest} has waited longest` : ""}.`;
    }
    st.waiting = waiting;
    st.printed = [...printed];
  }
  return steps;
}
function setupPQVis(box) {
  const steps = pqSteps(box.dataset.script);
  const script = el("ol", { class: "pq-script" }, ...steps.map((st) => el("li", { text: st.op === "insert" ? `insert ${st.xs.join(", ")}` : "extract" })));
  const waitRow = el("div", { class: "pq-row" }), outRow = el("div", { class: "pq-row" });
  const say = el("p", { class: "pq-say", role: "status" });
  const next = el("button", { class: "btn primary", type: "button", text: "Next step" });
  const back = el("button", { class: "btn", type: "button", text: "Back" });
  const again = el("button", { class: "btn", type: "button", text: "Start over" });
  box.append(el("div", { class: "pq-grid" }, script, el("div", { class: "pq-lanes" },
    el("div", { class: "pq-lane" }, el("span", { class: "pq-label", text: "Waiting, in arrival order" }), waitRow),
    el("div", { class: "pq-lane" }, el("span", { class: "pq-label", text: "Printed" }), outRow))),
  say, el("div", { class: "controls" }, next, back, again));
  const chip = (x, cls = "") => el("span", { class: `pq-chip ${cls}`.trim(), text: String(x) });
  let k = 0, busy = false;
  function paint(fresh = 0) {
    const st = steps[k - 1];
    waitRow.replaceChildren(...(st ? st.waiting : []).map((x, i, all) => chip(x, i >= all.length - fresh ? "arrive" : "")));
    outRow.replaceChildren(...(st ? st.printed : []).map((x) => chip(x)));
    [...script.children].forEach((li, i) => { li.classList.toggle("now", i === k - 1); li.classList.toggle("done", i < k - 1); });
    say.textContent = !st ? "Start empty. Press Next step." : k === steps.length ? `${st.say} Done: it printed ${st.printed.join(", ")}.` : st.say;
    next.disabled = k === steps.length; back.disabled = k === 0;
  }
  next.addEventListener("click", () => {
    if (busy || k === steps.length) return;
    const st = steps[k];
    if (st.op === "insert" || reduceMotion()) { k++; paint(st.op === "insert" ? st.xs.length : 0); return; }
    const prev = k ? steps[k - 1].waiting : [];
    const leaving = waitRow.children[prev.indexOf(st.out)];
    busy = true;
    leaving.classList.add("leaving");
    [...script.children].forEach((li, i) => { li.classList.toggle("now", i === k); li.classList.toggle("done", i < k); });
    say.textContent = prev.length === 1 ? `${st.out} is the only one left…` : `The smallest waiting is ${st.out}…`;
    setTimeout(() => {
      k++; paint();
      outRow.lastChild.classList.add("arrive");
      busy = false;
    }, 650);
  });
  back.addEventListener("click", () => { if (!busy && k > 0) { k--; paint(); } });
  again.addEventListener("click", () => { if (!busy) { k = 0; paint(); } });
  paint();
}

/* =========================================================== 2n + 10 between a 2n floor and a 3n ceiling */
function setupSandwich() {
  const f = (n) => 2 * n + 10, N = 30;
  const draw = () => {
    const xs = Array.from({ length: 121 }, (_, i) => (i / 120) * N);
    lineChart($("#sandwich-svg"), {
      xDomain: [0, N], yDomain: [0, 95], xLabel: "n", yLabel: "steps",
      series: [{ color: COLORS.g, label: "3n", pts: xs.map((n) => [n, 3 * n]) }, { color: COLORS.f, label: "f", pts: xs.map((n) => [n, f(n)]) }, { color: COLORS.h, label: "2n", pts: xs.map((n) => [n, 2 * n]) }],
      markers: [{ x: 10, label: "n₀ = 10" }],
      shade: { from: 10, label: "f squeezed" },
      snap: (v) => Math.max(0, Math.round(v)),
      hover: (n) => [`n = ${n}`, `3n = ${3 * n}`, `f = ${f(n)}`, `2n = ${2 * n}`],
    });
  };
  REDRAW.add((id) => { if (id === "notation") draw(); });
  draw();
}

/* =========================================================== the c / n0 explorer: move c and n0, see where the bound holds */
const CLAIM = Object.fromEntries(Sim.CLAIMS.map((c) => [c.id, c]));
const qNum = (s) => G.qToNumber(G.evalExact(s));
const polyAt = (coeffs, n) => coeffs.reduce((s, a, k) => s + qNum(a) * n ** k, 0);
function setupBound(panel) {
  const ids = panel.dataset.claims.split(",");
  const chips = el("div", { class: "controls", role: "group", "aria-label": "Claim" });
  const cIn = el("input", { type: "range", min: "0", step: "1", "aria-label": "c" });
  const nIn = el("input", { type: "range", min: "1", step: "1", "aria-label": "n0" });
  const cOut = el("output"), nOut = el("output");
  const legend = el("div", { class: "legend" });
  const svg = svgEl("svg", { class: "chart", viewBox: "0 0 760 280", role: "img", "aria-label": "f(n), c times g(n), and which n satisfy the bound" });
  const box = el("div", { class: "chart-box" }, svg);
  const out = el("p", { class: "out bx-verdict", role: "status" });
  panel.append(chips, el("div", { class: "controls bx-sliders" }, el("label", {}, "c = ", cIn, cOut), el("label", {}, "n₀ = ", nIn, nOut)), legend, box, out);
  let cur = ids[0];
  if (ids.length < 2) chips.style.display = "none";
  const btns = ids.map((id) => {
    const cl = CLAIM[id];
    const b = el("button", { class: "chip", type: "button", "aria-pressed": "false", text: `${cl.fTex} ∈ ${cl.rel === "O" ? "O" : "Ω"}(${cl.gTex})` });
    b.addEventListener("click", () => load(id));
    chips.append(b);
    return [id, b];
  });
  function load(id) {
    cur = id;
    const cl = CLAIM[id];
    btns.forEach(([k, b]) => b.setAttribute("aria-pressed", String(k === id)));
    cIn.max = String(cl.cs.length - 1); cIn.value = String(cl.cs.indexOf(cl.c0));
    nIn.max = String(cl.N); nIn.value = String(cl.n00);
    draw();
  }
  function draw() {
    const cl = CLAIM[cur];
    const cRaw = cl.cs[Number(cIn.value)], n0 = Number(nIn.value);
    const c = qNum(cRaw);
    cOut.textContent = fmtNum(c); nOut.textContent = String(n0);
    const f = (n) => polyAt(cl.f, n), cg = (n) => c * polyAt(cl.g, n);
    const holdsAt = (n) => (cl.rel === "O" ? f(n) <= cg(n) + 1e-9 : f(n) >= cg(n) - 1e-9);
    const N = cl.N;
    const xs = Array.from({ length: 161 }, (_, i) => 1 + (i / 160) * (N - 1));
    const fs = xs.map(f), maxF = Math.max(...fs), minF = Math.min(...fs);
    const cgs = xs.map(cg), maxCG = Math.max(...cgs);
    const top = Math.max(maxF, Math.min(maxCG, 2 * Math.max(maxF, 1))) * 1.08;
    const dots = [];
    let firstBad = null;
    for (let n = 1; n <= N; n++) {
      const ok = holdsAt(n);
      if (n >= n0 && !ok && firstBad === null) firstBad = n;
      dots.push({ x: n, y: f(n), r: N > 40 ? 3 : 5, cls: n < n0 ? "ign" : ok ? "ok" : "bad" });
    }
    legend.replaceChildren(
      el("span", {}, el("span", { class: "key", style: `border-color:${COLORS.f}` }), `f(n) = ${cl.fTex}`),
      el("span", {}, el("span", { class: "key", style: `border-color:${COLORS.g}` }), `c·g(n) = ${fmtNum(c)}·${cl.gTex}`),
      el("span", {}, el("span", { class: "dotkey ok" }), "holds"), el("span", {}, el("span", { class: "dotkey bad" }), "fails"), el("span", {}, el("span", { class: "dotkey ign" }), "ignored (n < n₀)"));
    lineChart(svg, {
      xDomain: [0, N], yDomain: [Math.min(0, minF) * 1.08, top], xLabel: "n", noEndDots: true,
      series: [{ color: COLORS.f, label: "f", pts: xs.map((n, i) => [n, fs[i]]) }, { color: COLORS.g, label: "c·g", pts: xs.map((n, i) => [n, cgs[i]]) }],
      shade: { from: n0, label: "n ≥ n₀: must hold" }, markers: [{ x: n0, label: `n₀ = ${n0}` }], dots,
      snap: (v) => Math.max(1, Math.round(v)),
      hover: (n) => [`n = ${n}`, `f(n) = ${fmtNum(f(n))}`, `c·g(n) = ${fmtNum(cg(n))}`, n < n0 ? "ignored: n < n₀" : holdsAt(n) ? "holds" : "fails"],
    });
    const sign = cl.rel === "O" ? "≤" : "≥";
    const r = G.checkBound({ f: cl.f, g: cl.g, rel: cl.rel }, cRaw, String(n0));
    out.className = `out bx-verdict ${r.holds ? "good" : "fail"}`;
    if (r.holds) out.textContent = `This pair proves it: f(n) ${sign} ${fmtNum(c)}·g(n) for every n ≥ ${n0}. (Checked exactly for all n, not just the ones drawn.)`;
    else if (r.tag === "c-too-small-forever" || r.tag === "c-too-big-forever") out.textContent = `No n₀ can work with c = ${fmtNum(c)}: f(n) ${sign} c·g(n) fails for every large n${firstBad ? `, starting by n = ${firstBad}` : ` (for example n = ${fmtInt(r.counterexample.n)})`}. Change c.`;
    else out.textContent = `Not yet: it fails at n = ${firstBad ?? fmtInt(r.counterexample.n)}${firstBad ? "" : ", past the right edge"}, which is ≥ n₀. Move n₀ past the last failure, or change c.`;
  }
  cIn.addEventListener("input", draw); nIn.addEventListener("input", draw);
  REDRAW.add((pid) => { if (panel.closest(".page").id === pid) draw(); });
  load(cur);
}

/* =========================================================== heaps: drawing a tree and its array */
const fmtV = (v) => String(v);
function parseList(s) { return s.split(",").map((x) => x.trim()).map((x) => (x === "_" || x === "" ? null : Number(x))); }
/* vals: level order (vals[0] is the root, null = no node at that position). opts.mark: { cur, cmp: [], swap: [] } in
   1-based positions; opts.doneFrom: positions >= it are finished heaps; opts.idx: show index labels; opts.onPick(i). */
function drawTree(svg, vals, opts = {}) {
  svg.replaceChildren();
  const n = vals.length;
  if (!n) { svg.setAttribute("viewBox", "0 0 300 60"); svg.append(svgEl("text", { x: 150, y: 34, "text-anchor": "middle", class: "ht-empty" }, "(empty)")); return; }
  const D = Math.floor(Math.log2(n));
  const W = D >= 4 ? 640 : D === 3 ? 480 : 400, r = D >= 4 ? 13 : 18, LH = D >= 4 ? 54 : 64, top = 26;
  const H = top + D * LH + (opts.idx ? 34 : 26);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.maxWidth = `${D >= 4 ? 40 : D === 3 ? 34 : 28}rem`;
  const pos = (p) => { const d = Math.floor(Math.log2(p)), slot = p - 2 ** d; return [((slot + 0.5) / 2 ** d) * W, top + d * LH]; };
  const m = opts.mark || {};
  const g = svgEl("g", { class: "ht" });
  for (let p = 2; p <= n; p++) if (vals[p - 1] != null && vals[Math.floor(p / 2) - 1] != null) {
    const [x1, y1] = pos(Math.floor(p / 2)), [x2, y2] = pos(p);
    g.append(svgEl("line", { x1, y1, x2, y2, class: `ht-edge${m.swap && m.swap.includes(p) && m.swap.includes(Math.floor(p / 2)) ? " swap" : ""}` }));
  }
  for (let p = 1; p <= n; p++) {
    const v = vals[p - 1];
    if (v == null) continue;
    const [x, y] = pos(p);
    const cls = ["ht-node"];
    if (m.cur === p) cls.push("cur");
    if (m.cmp && m.cmp.includes(p)) cls.push("cmp");
    if (m.swap && m.swap.includes(p) && m.cur !== p) cls.push("swap");
    if (opts.doneFrom && p >= opts.doneFrom) cls.push("done");
    if (m.leaves && p >= m.leaves[0] && p <= m.leaves[1]) cls.push("leaf");
    if (opts.pick && opts.pick === p) cls.push("cur");
    if (opts.rel && opts.rel[p]) cls.push(opts.rel[p]);
    const node = svgEl("g", { class: cls.join(" "), transform: `translate(${x},${y})` });
    node.append(svgEl("circle", { r }), svgEl("text", { y: 5, "text-anchor": "middle" }, fmtV(v)));
    if (opts.idx) node.append(svgEl("text", { y: r + 14, "text-anchor": "middle", class: "ht-idx" }, String(p)));
    if (opts.onPick) {
      node.setAttribute("tabindex", "0"); node.setAttribute("role", "button"); node.setAttribute("aria-label", `index ${p}, value ${fmtV(v)}`);
      node.addEventListener("click", () => opts.onPick(p));
      node.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onPick(p); } });
    }
    g.append(node);
  }
  svg.append(g);
}
/* keep the highlighted line visible when the listing scrolls (phones) */
function keepLineInView(pre) {
  const hl = pre.querySelector(".hl");
  if (hl && pre.scrollHeight > pre.clientHeight) pre.scrollTop = Math.max(0, hl.offsetTop - pre.clientHeight / 2);
}
/* the array under the tree: index 0 unused, live items 1..size, a stale copy past size shown faded */
function drawCells(box, arr, size, opts = {}) {
  const m = opts.mark || {};
  const end = Math.max(size, opts.stale && opts.stale > size ? opts.stale : 0);
  const ptrs = {};
  for (const [name, i] of Object.entries(opts.ptrs || {})) if (Number.isInteger(i) && i >= 1 && i <= Math.max(end, size + 2)) (ptrs[i] = ptrs[i] || []).push(name);
  const cells = [el("div", { class: "cell out unused", title: "index 0 is never used" }, el("span", { class: "ptr", text: "" }), el("b", { text: "–" }), el("span", { class: "idx", text: "0" }))];
  for (let i = 1; i <= end; i++) {
    const cls = ["cell"];
    if (i > size) cls.push("out", "stale");
    if (m.cur === i) cls.push("mid");
    if (m.cmp && m.cmp.includes(i)) cls.push("cmp");
    if (m.swap && m.swap.includes(i) && m.cur !== i) cls.push("swapped");
    if (opts.doneFrom && i >= opts.doneFrom && i <= size) cls.push("done");
    cells.push(el("div", { class: cls.join(" "), title: i > size ? "old value, past size: not in the heap" : "" }, el("span", { class: "ptr", text: (ptrs[i] || []).join(" ") }), el("b", { text: arr[i] == null ? "·" : fmtV(arr[i]) }), el("span", { class: "idx", text: String(i) })));
  }
  box.replaceChildren(...cells);
}

/* static pictures for questions: <svg class="htree" data-tree="1,3,2,_,4"> and <div class="cells heap-cells" data-cells="…"> */
function setupStaticPictures() {
  $$("svg.htree[data-tree]").forEach((svg) => drawTree(svg, parseList(svg.dataset.tree), { idx: svg.hasAttribute("data-idx"), mark: svg.dataset.cmp ? { cmp: svg.dataset.cmp.split(",").map(Number) } : undefined }));
  $$("[data-cells]").forEach((box) => { const vals = parseList(box.dataset.cells); drawCells(box, [null, ...vals], vals.length); });
}

/* =========================================================== heap steppers (Lectures 4 and 5) */
const STEP_GEN = { insertIdea: Sim.insertIdeaSteps, extractIdea: Sim.extractIdeaSteps, insert: Sim.insertCodeSteps, extract: Sim.extractCodeSteps, build: Sim.buildSteps };
function setupHeapStepper(box) {
  const kind = box.dataset.kind;
  const scenarios = Sim.HEAP_SCENARIOS[kind.replace("Idea", "")].filter((sc) => !box.dataset.scenario || sc.name === box.dataset.scenario);
  const lines = Sim.CODE[kind];
  const idea = kind.endsWith("Idea"); // Lecture 4 works on the tree only; the array comes in Lecture 5
  const chips = el("div", { class: "controls", role: "group", "aria-label": "Pick a starting heap" });
  const code = el("pre", { class: "code" });
  const svg = svgEl("svg", { class: "htree live", role: "img", "aria-label": "The heap as a tree" });
  const cells = el("div", { class: "cells heap-cells" });
  const vars = el("p", { class: "step-vars" });
  const say = el("p", { class: "step-say", role: "status" });
  const back = el("button", { class: "btn", type: "button", text: "← Back" });
  const next = el("button", { class: "btn primary", type: "button", text: kind === "build" || kind.endsWith("Idea") ? "Next step →" : "Next line →" });
  const count = el("span", { class: "note" });
  box.append(chips, el("div", { class: `split stepper${idea ? " idea" : ""}` }, code, el("div", { class: "pic" }, svg, idea ? null : cells, vars, say, el("div", { class: "controls" }, back, next, count))));
  let steps = [], k = 0;
  if (scenarios.length < 2) chips.style.display = "none";
  const btns = scenarios.map((sc, i) => {
    const b = el("button", { class: "chip", type: "button", "aria-pressed": "false", text: sc.label });
    b.addEventListener("click", () => load(i));
    chips.append(b);
    return b;
  });
  function load(i) {
    const sc = scenarios[i];
    btns.forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    steps = kind.startsWith("insert") ? STEP_GEN[kind](sc.start, sc.x) : STEP_GEN[kind](sc.start);
    k = 0;
    paint();
  }
  function paint() {
    const st = steps[k];
    code.replaceChildren(...lines.map((ln, i) => el("div", { class: `ln${i === st.line ? " hl" : ""}` }, el("span", { class: "no", text: String(i + 1) }), el("span", { class: "src", text: ln }))));
    keepLineInView(code);
    drawTree(svg, st.arr.slice(1, st.size + 1), { mark: st.mark, doneFrom: st.done_from, idx: !idea });
    const v = st.vars || {};
    const ptrs = {};
    for (const name of ["i", "parent", "left", "right", "toSwap"]) if (v[name] !== undefined) ptrs[name] = v[name];
    if (!idea) drawCells(cells, st.arr, st.size, { mark: st.mark, stale: st.stale, doneFrom: st.done_from, ptrs: kind === "build" ? {} : ptrs });
    const shown = Object.entries(v).map(([n, x]) => `${n} = ${fmtV(x)}`);
    vars.textContent = `size = ${st.size}${shown.length ? " · " + shown.join(" · ") : ""}`;
    say.textContent = st.say;
    back.disabled = k === 0;
    next.disabled = k === steps.length - 1;
    count.textContent = k === 0 ? `Press ${next.textContent.replace(" →", "")}.` : st.done ? "Done." : `Step ${k} of ${steps.length - 1}.`;
  }
  back.addEventListener("click", () => { if (k > 0) { k--; paint(); } });
  next.addEventListener("click", () => { if (k < steps.length - 1) { k++; paint(); } });
  load(0);
}

/* =========================================================== queue vs priority queue on the same script */

/* =========================================================== complete tree: height grows only when a level fills */

/* =========================================================== index arithmetic, 1-based */
function setupIndex() {
  const BASE = [1, 3, 2, 4, 7, 5, 6, 5, 9, 8, 11, 10, 12, 13, 14];
  let pick = 5;
  const draw = () => {
    const n = Number($("#ix-n").value);
    $("#ix-n-out").textContent = String(n);
    if (pick > n) pick = n;
    const info = Sim.indexInfo(pick, n);
    const rel = {};
    if (info.parent) rel[info.parent] = "cmp";
    if (info.left) rel[info.left] = "swap";
    if (info.right) rel[info.right] = "swap";
    for (let p = info.firstLeaf; p <= n; p++) if (!rel[p] && p !== pick) rel[p] = "leaf";
    drawTree($("#ix-svg"), BASE.slice(0, n), { idx: true, pick, rel, onPick: (p) => { pick = p; draw(); } });
    drawCells($("#ix-cells"), [null, ...BASE], n, { mark: { cur: pick, cmp: info.parent ? [info.parent] : [], swap: [info.left, info.right].filter(Boolean) } });
    $$("#ix-cells .cell").forEach((c, i) => { if (i >= 1) { c.classList.add("pickable"); c.setAttribute("role", "button"); c.setAttribute("tabindex", "0"); c.setAttribute("aria-label", `index ${i}`); c.onclick = () => { pick = i; draw(); }; c.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick = i; draw(); } }; } });
    $("#ix-pick").textContent = `i = ${pick}`;
    $("#ix-out").replaceChildren(...Sim.indexSay(pick, n).map((t) => el("li", { text: t })));
  };
  $("#ix-n").addEventListener("input", draw);
  draw();
}

/* =========================================================== try your own sequence */
function setupPlayground() {
  let h = Sim.heapOf([]);
  const log = $("#play-log");
  const draw = (mark) => { drawTree($("#play-svg"), Sim.live(h), { idx: true, mark }); drawCells($("#play-cells"), h.arr, h.size, { mark }); };
  const line = (t) => { log.prepend(el("div", { text: t })); };
  $("#play-ins").addEventListener("click", () => {
    const raw = $("#play-val").value.trim();
    const v = Number(raw);
    if (!raw || !Number.isFinite(v)) { line("Type a number to insert."); return; }
    if (h.size >= 31) { line("This picture stops at 31 items."); return; }
    const r = Sim.heapInsert(h, v);
    const at = h.arr.indexOf(v, 1);
    line(`insert(${fmtV(v)}): ${r.swaps} swap${r.swaps === 1 ? "" : "s"} percolating up.`);
    draw({ cur: at });
  });
  $("#play-ext").addEventListener("click", () => {
    if (!h.size) { line("extract(): the heap is empty."); return; }
    const r = Sim.heapExtract(h);
    line(`extract() returned ${fmtV(r.min)}: ${r.swaps} swap${r.swaps === 1 ? "" : "s"} percolating down.`);
    draw({});
  });
  $("#play-reset").addEventListener("click", () => { h = Sim.heapOf([]); log.replaceChildren(); draw({}); });
  $("#play-val").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#play-ins").click(); });
  draw({});
}

/* =========================================================== buildHeap: the cost, level by level */
function setupBuildCost() {
  const draw = () => {
    const H = Number($("#bc-h").value);
    $("#bc-h-out").textContent = String(H);
    const r = Sim.buildCost(H);
    const t = el("table", { class: "plain num" }, el("tr", {}, el("th", { text: "height of the node" }), el("th", { class: "r", text: "nodes" }), el("th", { class: "r", text: "max moves each" }), el("th", { class: "r", text: "max moves" }), el("th", { text: "" })));
    const maxP = Math.max(...r.rows.map((x) => x.product), 1);
    for (const row of r.rows) t.append(el("tr", {}, el("td", { text: row.height === 0 ? "0 (leaves)" : row.height === H ? `${H} (root)` : String(row.height) }), el("td", { class: "r", text: fmtInt(row.nodes) }), el("td", { class: "r", text: String(row.moves) }), el("td", { class: "r", text: fmtInt(row.product) }), el("td", { class: "bc-bar-cell" }, el("span", { class: "bc-bar", style: `width:${(row.product / maxP) * 100}%` }))));
    $("#bc-table").replaceChildren(t);
    $("#bc-out").textContent = `n = ${fmtInt(r.n)} nodes. Total moves at most ${fmtInt(r.total)}, which is less than n. Compare n·log₂ n ≈ ${fmtInt(Math.round(r.nlogn))}, the bound you get from “n calls, each up to log n”.`;
  };
  $("#bc-h").addEventListener("input", draw);
  draw();
}

/* =========================================================== Section 2: numUnique, step by step
   Each inner-loop iteration adds a dot at row i, column j, so the dots show the running count and its shape. */
const NU_PRESETS = { distinct: ["a", "b", "c", "d", "e"], same: ["a", "a", "a", "a", "a"] };
function setupNumUnique() {
  const box = $("#nu");
  const code = $("#nu-code"), cells = $("#nu-cells"), dots = $("#nu-dots"), count = $("#nu-count"), say = $("#nu-say");
  const next = $("#nu-next"), back = $("#nu-back"), play = $("#nu-play");
  let steps = [], k = 0, values = [], timer = null;
  const stop = () => { clearInterval(timer); timer = null; play.textContent = "Play"; };
  function load(name) {
    stop();
    values = NU_PRESETS[name];
    $$("[data-nu]", box).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.nu === name)));
    steps = Sim.numUniqueSteps(values); k = 0; paint();
  }
  function paint() {
    const st = steps[k], n = values.length;
    code.replaceChildren(...Sim.NUMUNIQUE_CODE.map((ln, i) => el("div", { class: `ln${i + 1 === st.line || (st.line === 3 && i >= 2 && i <= 4) ? " hl" : ""}` }, el("span", { class: "no", text: String(i + 1) }), el("span", { class: "src", text: ln }))));
    keepLineInView(code);
    cells.replaceChildren(...values.map((v, i) => el("div", { class: `cell${st.visited[i] ? " seen" : ""}${i === st.i ? " mid" : ""}${i === st.j && i !== st.i ? " cmp" : ""}` }, el("span", { class: "ptr", text: [i === st.i ? "i" : "", i === st.j ? "j" : ""].filter(Boolean).join(" ") }), el("b", { text: `"${v}"` }), el("span", { class: "idx", text: st.visited[i] ? `${i} ✓` : String(i) }))));
    const done = new Set(Sim.numUniqueDots(steps.slice(0, k + 1)).map(([i, j]) => `${i},${j}`));
    const dot = (i, j) => el("span", { class: `d${j < i ? " x" : ""}${done.has(`${i},${j}`) ? " on" : ""}${st.i === i && st.j === j ? " now" : ""}` });
    dots.style.setProperty("--n", n);
    dots.replaceChildren(el("span"), ...values.map((_, j) => el("span", { class: "cl", text: `j=${j}` })),
      ...values.flatMap((_, i) => [el("span", { class: "rl", text: `i=${i}` }), ...values.map((__, j) => dot(i, j))]));
    count.textContent = `first loop ${st.first} + inner loop ${st.inner} = ${st.first + st.inner}`;
    say.textContent = st.say;
    back.disabled = k === 0;
    next.disabled = k === steps.length - 1;
  }
  const step = (d) => { const to = k + d; if (to >= 0 && to < steps.length) { k = to; paint(); } };
  $$("[data-nu]", box).forEach((b) => b.addEventListener("click", () => load(b.dataset.nu)));
  next.addEventListener("click", () => { stop(); step(1); });
  back.addEventListener("click", () => { stop(); step(-1); });
  play.addEventListener("click", () => {
    if (timer) { stop(); return; }
    if (k === steps.length - 1) k = 0;
    if (reduceMotion()) { k = steps.length - 1; paint(); return; }
    play.textContent = "Pause";
    paint();
    timer = setInterval(() => { step(1); if (k === steps.length - 1) stop(); }, 550);
  });
  load("distinct");
}

/* ---- wire it up */
setupStaticPictures();
setupHero();
setupGap();
setupBuckets();
$$(".pqvis").forEach(setupPQVis);
setupSandwich();
$$(".bound").forEach(setupBound);
$$(".heap-step").forEach(setupHeapStepper);
setupIndex();
setupPlayground();
setupBuildCost();
setupNumUnique();
};
