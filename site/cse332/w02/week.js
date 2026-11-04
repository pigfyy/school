/* CSE 332 w02: misconception feedback (shown by core/grader.js for a tag in data-miscon) and this week's widgets. */
window.WEEK = window.WEEK || {};
window.WEEK.messages = {
  "linear-count": "That's how many items a linear scan would look at. Each binary-search iteration halves the gap.",
  "halved-once": "That's after one halving. Keep halving until the gap is 1.",
  "stopped-early": "Close. The loop still runs one more time when end − start is 1.",
  "rounded-up": "Check which power of 2 is just below n. The worst case is ⌊log₂ n⌋ + 1.",
  "doubled-log": "Doubling n adds one more halving, not twice as many.",
  "strict-vs-equal": "Check that exact value of n directly. Is the inequality true there, and for every n after it?",
  "forgot-c": "Don't drop c. Solve 3n² + 17 ≤ 4n², which is n² ≥ 17.",
  "not-smallest": "That n₀ works, but it isn't the smallest. Try smaller values.",
  "c13-works": "Plug c = 13 in: the n² terms cancel. What's left, and is it ever true?",
  "base-not-log": "Change of base divides by log₂ of the base, not by the base itself.",
  "base-ignored": "That's log₂ n. The base 8 changes the value by a constant factor.",
  "base-multiplied": "Change of base divides by log₂ 8; it doesn't multiply.",
  "bigger-in-smaller": "Which grows faster, n or log n? O asks whether the left side is eventually at most a constant times the right.",
  "log-is-constant": "log n grows without bound, slowly. For any constant c, is log n eventually bigger than c?",
  "poly-vs-exp": "It looks false for small n, but any exponential bⁿ with b > 1 eventually beats any polynomial.",
  "exp-base-dropped": "The base of an exponential isn't a multiplicative constant. Look at 3ⁿ / 2ⁿ.",
  "forgot-power": "Divide both sides by 2ⁿ: you need 2ⁿ > 1000. Which n does that?",
  "pow2-too-early": "At n = 32, log n = 5, so 8 log n = 40, which is more than 32. Not yet.",
  "pow2-too-late": "Check n = 64: log n = 6, so 8 log n = 48, which is already less than 64.",
  "compare-60": "At n = 2⁶⁰, n^(1/10) = 2⁶ = 64 and log₂ n = 60. Which is bigger?",
  "used-2-to-c": "log n + 2 > 12 means log n > 10, not log n > 12.",
  "wrong-c": "That's the crossover for n > 10 log n. Here 2 log n is already on the left, so you need n > 8 log n.",
  "asymptotic-not-now": "n^(1/10) wins eventually, but compare the actual values at n = 2⁴⁰.",
  "omega-best": "Ω is a lower bound on whatever function you analyze. The case (best, worst…) is a separate choice.",
  "used-c12": "That's the answer for c = 12. Redo (13 − c)·n ≥ 50 with c = 11.",
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
  "power-of-power": "(3²)ⁿ: square the base. 3² is 9, not 6.",
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

/* =========================================================== binary search: the gap halves */
function setupGap() {
  const a = Sim.SLIDE_SORTED;
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
      el("span", { class: "gap-num", text: `end − start = ${s.gap}` }))));
    const lin = Sim.linearSearch(a, trace.k).comparisons;
    if (shown === 0) out.textContent = `start = 0, end = ${a.length}: the gap is ${a.length}. Press Step.`;
    else if (shown < trace.steps.length) out.textContent = `Iteration ${shown}: gap ${cur.gap}, mid = ${cur.mid}, a.get(mid) = ${cur.value} ${cur.outcome === "right" ? `< ${trace.k}, so start = mid+1` : `> ${trace.k}, so end = mid`}.`;
    else out.textContent = trace.found
      ? `Found ${trace.k} in ${trace.iterations} iteration${trace.iterations === 1 ? "" : "s"} (gaps ${trace.gaps.join(", ")}). contains would use ${lin} comparison${lin === 1 ? "" : "s"}.`
      : `The gap reached 0: the loop stops and returns false after ${trace.iterations} iterations (gaps ${trace.gaps.join(", ")}). contains would use ${lin}.`;
  }
  const step = () => { if (shown < trace.steps.length) { shown++; draw(); } };
  $("#gap-step").addEventListener("click", step);
  $("#gap-run").addEventListener("click", () => { while (shown < trace.steps.length) step(); });
  $("#gap-reset").addEventListener("click", reset);
  $("#gap-k").addEventListener("input", reset);
  reset();

  const worst = () => {
    const raw = $("#worst-n").value.trim();
    if (!/^\d{1,10}$/.test(raw) || Number(raw) < 1 || Number(raw) > 1e9) { $("#worst-out").textContent = "Enter a whole number n from 1 to 1,000,000,000."; $("#worst-chain").replaceChildren(); return; }
    const n = Number(raw), g = Sim.worstGaps(n);
    $("#worst-chain").replaceChildren(...g.flatMap((x, i) => [el("span", { class: "gchip", text: fmtInt(x) }), i < g.length - 1 ? el("span", { class: "garrow", text: "→" }) : null]).filter(Boolean));
    $("#worst-out").textContent = `n = ${fmtInt(n)}: ${g.length} gaps, so ${g.length} iterations in the worst case (⌊log₂ n⌋ + 1 = ${Math.floor(Math.log2(n)) + 1}). contains would need ${fmtInt(n)}.`;
  };
  $("#worst-n").addEventListener("input", worst);
  worst();

  const table = () => {
    const c = Number($("#logb [aria-pressed=true]").dataset.base);
    const rows = [[2, 1], [2 ** 10, 10], [2 ** 20, 20], [2 ** 30, 30], [2 ** 40, 40]];
    const t = $("#logb-table");
    const sub = { 2: "₂", 5: "₅", 8: "₈", 10: "₁₀" }[c];
    t.replaceChildren(el("tr", {}, el("th", { class: "r", text: "n" }), el("th", { class: "r", text: "log₂ n" }), el("th", { class: "r", text: `log${sub} n` }), el("th", { class: "r", text: "log₂ n ÷ that" })));
    for (const [, l2] of rows) {
      const lc = l2 / Math.log2(c);
      t.append(el("tr", {}, el("td", { class: "r", text: sup(`2^${l2}`) }), el("td", { class: "r", text: String(l2) }), el("td", { class: "r", text: Number.isInteger(lc) ? String(lc) : lc.toFixed(3) }), el("td", { class: "r", text: c === 2 ? "1" : Number.isInteger(Math.log2(c)) ? String(Math.log2(c)) : Math.log2(c).toFixed(3) })));
    }
  };
  $$("#logb [data-base]").forEach((b) => b.addEventListener("click", () => { $$("#logb [data-base]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); table(); }));
  table();
}

/* =========================================================== comparing A, B, C */
function setupABC() {
  const A = (n) => 10 * n + 900, B = (n) => 100 * n - 50, C = (n) => (n * n) / 100;
  const N = 1500;
  const draw = () => {
    const xs = Array.from({ length: 151 }, (_, i) => (i / 150) * N);
    lineChart($("#abc-svg"), {
      xDomain: [0, N], yDomain: [0, 30000], xLabel: "n", yLabel: "steps",
      series: [{ color: COLORS.f, label: "A", pts: xs.map((n) => [n, A(n)]) }, { color: COLORS.g, label: "B", pts: xs.map((n) => [n, B(n)]) }, { color: COLORS.h, label: "C", pts: xs.map((n) => [n, C(n)]) }],
      markers: [{ x: 1083, label: "n = 1,083" }],
      snap: (v) => Math.max(1, Math.round(v)),
      hover: (n) => [`n = ${fmtInt(n)}`, `A = ${fmtInt(A(n))}`, `B = ${fmtInt(B(n))}`, `C = ${fmtNum(C(n))}`],
    });
  };
  const run = () => {
    const n = Math.trunc(Number($("#abc-n").value));
    if (!(n >= 1 && n <= 1e7)) { $("#abc-out").textContent = "Enter a whole number n from 1 to 10,000,000."; return; }
    const v = [["A", A(n)], ["B", B(n)], ["C", C(n)]];
    const best = v.reduce((m, x) => (x[1] < m[1] ? x : m));
    $("#abc-out").textContent = `n = ${fmtInt(n)}: A = ${fmtInt(A(n))}, B = ${fmtInt(B(n))}, C = ${fmtNum(C(n))}. Cheapest: ${best[0]}.`;
  };
  $("#abc-n").addEventListener("input", run);
  REDRAW.add((id) => { if (id === "compare") draw(); });
  draw(); run();
}

/* =========================================================== the definition, one clickable part at a time */
const QUANT = {
  in: "f ∈ O(g(n)): O(g(n)) is a set of functions, and f is a member of it. That's why we'd never write O(n²) = 3n² + 17: the “=” people write means “is in”, and it only reads one way.",
  c: "∃c > 0: you get to pick one constant multiplier. It absorbs coefficients and units, so 3n² and 5n² land in the same set.",
  n0: "∃n₀ > 0: you get to pick a starting point. Every input smaller than n₀ is ignored, which is how “for large enough n” becomes precise.",
  all: "∀n ≥ n₀: after you've picked c and n₀, the inequality must hold for every larger n, forever. One fixed pair; you can't change it for each n.",
  le: "f(n) ≤ c·g(n): the comparison itself. Flip it to ≥ and you get Ω. Ask for both and you get Θ.",
};
function setupQuant() {
  $$(".q-part").forEach((b) => b.addEventListener("click", () => {
    $$(".q-part").forEach((x) => x.classList.toggle("on", x === b));
    $("#q-explain").textContent = QUANT[b.dataset.q];
  }));
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

/* =========================================================== case × bound grid */
const GRID = {
  "O-worst": "Binary search's worst case is O(log n): at most about log₂ n iterations. (It's Θ(log n), and Θ includes O.)",
  "O-best": "Linear search's best case is O(1): the item is first. A true upper bound on the best case.",
  "Omega-worst": "Binary search is Ω(log log n) in the worst case. True, but weak: it only says it isn't really, really fast.",
  "Omega-best": "“Every algorithm for this problem needs to look at all the elements, so it takes at least n time, even in the best case.” That's an Ω(n) statement about the best case.",
  "Theta-worst": "Binary search is Θ(log n) in the worst case. This is the most common kind of statement.",
  "Theta-best": "Binary search is Θ(1) in the best case: the item is in the middle, found on the first iteration.",
};
function setupGrid() {
  const t = $("#grid-table");
  t.append(el("tr", {}, el("th", { text: "" }), el("th", { text: "worst case" }), el("th", { text: "best case" })));
  for (const [row, name] of [["O", "O (≤)"], ["Omega", "Ω (≥)"], ["Theta", "Θ (=)"]]) {
    const tr = el("tr", {}, el("th", { text: name }));
    for (const col of ["worst", "best"]) {
      const b = el("button", { class: "grid-cell", type: "button", "data-cell": `${row}-${col}`, text: "✓ true statement" });
      b.addEventListener("click", () => { $$(".grid-cell").forEach((x) => x.classList.toggle("on", x === b)); $("#grid-out").textContent = GRID[`${row}-${col}`]; });
      tr.append(el("td", {}, b));
    }
    t.append(tr);
  }
}

/* =========================================================== simplifier + category ladder */
const LADDER_ROWS = [
  ["1", "constant"], ["log n", "logarithmic"], ["n", "linear"], ["n log n", "log-linear"], ["n^2", "quadratic"], ["n^3", "cubic"], ["n^4", "polynomial, nᵏ (k > 1)"], ["2^n", "exponential, kⁿ (k > 1)"],
];
function setupSimplify() {
  const ladder = $("#simp-ladder");
  const rungs = LADDER_ROWS.map(([e, name]) => el("li", { "data-rung": e }, el("b", { text: `O(${sup(e)})` }), el("span", { text: name })));
  ladder.replaceChildren(...rungs);
  const run = () => {
    const raw = $("#simp-in").value;
    const r = G.parseAsym(G.stripWrapper(G.normalizeExpr(raw)));
    rungs.forEach((x) => x.classList.remove("on", "between"));
    if (!raw.trim()) { $("#simp-out").textContent = ""; return; }
    if (!r.ok) { $("#simp-out").textContent = `Can't classify that for certain (${r.error}).`; return; }
    const notes = [];
    if (r.terms > 1) notes.push("dropped the non-dominant terms");
    if (r.lead && !G.eq(r.lead, G.Q(1n))) notes.push(`dropped the constant factor ${G.qToString(r.lead)}`);
    if (r.base) notes.push("ignored the log base");
    $("#simp-out").textContent = `Θ(${sup(G.asymName(r.cls))})${notes.length ? `: ${notes.join(", ")}.` : "."}`;
    const cls = LADDER_ROWS.map(([e]) => G.parseAsym(e).cls);
    let placed = false;
    cls.forEach((c, i) => { if (G.clsCmp(c, r.cls) === 0) { rungs[i].classList.add("on"); placed = true; } });
    if (!placed) {
      const poly = G.eq(r.cls.b, G.Q(1n)) && r.cls.l.n === 0n && r.cls.m.n === 0n && G.cmp(r.cls.d, G.Q(1n)) > 0 && r.cls.d.d === 1n;
      const exp = G.cmp(r.cls.b, G.Q(1n)) > 0 && r.cls.d.n === 0n && r.cls.l.n === 0n;
      if (poly) rungs[6].classList.add("on");
      else if (exp) rungs[7].classList.add("on");
      else {
        const i = cls.findIndex((c) => G.clsCmp(c, r.cls) > 0);
        if (i > 0) { rungs[i - 1].classList.add("between"); rungs[i].classList.add("between"); $("#simp-out").textContent += ` It sits between ${sup("O(" + LADDER_ROWS[i - 1][0] + ")")} and ${sup("O(" + LADDER_ROWS[i][0] + ")")}; the common categories have no name for it.`; }
      }
    }
  };
  $("#simp-in").addEventListener("input", run);
  $$("[data-simp]").forEach((b) => b.addEventListener("click", () => { $("#simp-in").value = b.dataset.simp; run(); }));
  run();
}

/* =========================================================== relation classifier */
function setupRelate() {
  const run = () => {
    const r = G.relate(G.stripWrapper(G.normalizeExpr($("#rel-f").value)), G.stripWrapper(G.normalizeExpr($("#rel-g").value)));
    const out = $("#rel-out");
    if (r.error) { out.replaceChildren(el("p", { class: "note", text: `Can't classify that for certain (${r.error}).` })); return; }
    const card = (sym, ok, why) => el("div", { class: `verdict ${ok ? "yes" : "no"}` }, el("span", { class: "v-sym", text: `f ∈ ${sym}(g)` }), el("b", { text: ok ? "True" : "False" }), el("span", { class: "v-why", text: why }));
    const word = r.cmp < 0 ? "grows strictly slower than" : r.cmp > 0 ? "grows strictly faster than" : "grows at the same rate as";
    out.replaceChildren(
      el("p", { class: "v-head", text: `f is Θ(${sup(r.f)}) and g is Θ(${sup(r.g)}), so f ${word} g.` }),
      el("div", { class: "v-row" },
        card("O", r.o, r.o ? "f ≤ c·g eventually" : "no c works: f/g grows without bound"),
        card("Ω", r.omega, r.omega ? "f ≥ c·g eventually" : "no c > 0 works: f/g shrinks to 0"),
        card("Θ", r.theta, r.theta ? "both bounds hold" : "only one bound holds")));
  };
  $("#rel-f").addEventListener("input", run); $("#rel-g").addEventListener("input", run);
  $$("[data-rel]").forEach((b) => b.addEventListener("click", () => { const [f, g] = JSON.parse(b.dataset.rel); $("#rel-f").value = f; $("#rel-g").value = g; run(); }));
  run();
}

/* =========================================================== exact races */
function setupRace() {
  let cur = "n50";
  const draw = () => {
    const R = Sim.RACES[cur];
    const runs = Sim.raceProfile(cur);
    const last = runs[runs.length - 1];
    const flip = cur === "threeTwo" ? runs.find((r) => r.s === "gt").from : last.from;
    const b = R.range[1];
    const xs = [...new Set(Array.from({ length: 201 }, (_, i) => Math.max(R.range[0], Math.round((i / 200) * b))))];
    const gLabel = R.gText.replace("^n", "ⁿ");
    $("#race-legend").replaceChildren(...[[sup(R.fText), COLORS.f], [gLabel, COLORS.g]].map(([t, c]) => el("span", {}, el("span", { class: "key", style: `border-color:${c}` }), t)));
    lineChart($("#race-svg"), {
      xDomain: [0, b], xLabel: "n", yLabel: "log₁₀ of the value",
      series: [{ color: COLORS.f, label: sup(R.fText), pts: xs.map((n) => [n, R.log10f(n)]) }, { color: COLORS.g, label: gLabel, pts: xs.map((n) => [n, R.log10g(n)]) }],
      markers: [{ x: flip, label: `n = ${fmtInt(flip)}` }],
      shade: { from: flip, label: cur === "n50" ? "1.1ⁿ ahead" : "3ⁿ ahead" },
      snap: (v) => Math.round(v),
      hover: (n) => [`n = ${fmtInt(n)}`, `${sup(R.fText)}: ${R.digitsF(n)} digits`, `${gLabel}: ${R.digitsG(n)} digits`, R.cmp(n) > 0 ? `${sup(R.fText)} is bigger` : `${sup(R.fText)} ≤ ${gLabel}`],
    });
    $("#race-out").textContent = cur === "n50"
      ? `Exact: n⁵⁰ ≤ 1.1ⁿ at n = 1, n⁵⁰ > 1.1ⁿ for every n from 2 to 4,401, and n⁵⁰ ≤ 1.1ⁿ for every n from 4,402 on (after n = 525 the ratio n⁵⁰/1.1ⁿ only shrinks). So c = 1, n₀ = 4,402 proves n⁵⁰ ∈ O(1.1ⁿ).`
      : `Exact: 3ⁿ ≤ 1000·2ⁿ for n ≤ 17 and 3ⁿ > 1000·2ⁿ from n = 18 on (the ratio 1.5ⁿ only grows). The lecture's bound: n > log₂1000 / (log₂3 − 1) ≈ 17.04. Every c fails this way, so 3ⁿ ∉ O(2ⁿ) and 3ⁿ ∉ Θ(2ⁿ).`;
    const ns = cur === "n50" ? [1, 2, 100, 525, 1000, 4401, 4402, 6000] : [1, 10, 17, 18, 20, 40];
    const t = el("table", { class: "plain num" }, el("tr", {}, el("th", { class: "r", text: "n" }), el("th", { class: "r", text: sup(R.fText) }), el("th", { class: "r", text: gLabel }), el("th", { text: "bigger" })));
    for (const n of ns) {
      const fv = cur === "n50" ? Sim.bigPow(n, 50) : Sim.bigPow(3, n);
      const gText = cur === "n50" ? (n <= 100 ? `≈ ${(1.1 ** n).toPrecision(5)}` : `${R.digitsG(n)}-digit integer part`) : sciBig(1000n * Sim.bigPow(2, n));
      t.append(el("tr", { class: R.cmp(n) > 0 ? "" : "win" }, el("td", { class: "r", text: fmtInt(n) }), el("td", { class: "r", text: sciBig(fv) }), el("td", { class: "r", text: gText }), el("td", { text: R.cmp(n) > 0 ? sup(R.fText) : gLabel })));
    }
    $("#race-table").replaceChildren(t);
  };
  $$("#race [data-race]").forEach((b) => b.addEventListener("click", () => { cur = b.dataset.race; $$("#race [data-race]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); draw(); }));
  $("#race-table-toggle").addEventListener("click", (e) => { const t = $("#race-table"); t.hidden = !t.hidden; e.currentTarget.setAttribute("aria-pressed", String(!t.hidden)); });
  REDRAW.add((id) => { if (id === "examples") draw(); });
  draw();
}

/* =========================================================== n^(1/10) vs log n */
function setupTenth() {
  const R = Sim.RACES.tenth;
  const draw = () => {
    const k = Number($("#tenth-k").value);
    $("#tenth-k-out").textContent = String(k);
    const fv = 2 ** (k / 10);
    $("#tenth-f").textContent = fv.toFixed(2);
    $("#tenth-g").textContent = String(k);
    const c = R.cmp(k);
    $("#tenth-vs").textContent = c > 0 ? ">" : c < 0 ? "<" : "=";
    $(".duel-side.s1", $("#tenth")).classList.toggle("lead", c > 0);
    $(".duel-side.s2", $("#tenth")).classList.toggle("lead", c < 0);
    const nTxt = k <= 50 ? Sim.bigPow(2, k).toLocaleString("en-US") : sciBig(Sim.bigPow(2, k));
    $("#tenth-out").textContent = `n = 2${sup("^" + k)} = ${nTxt}. ${c > 0 ? "n^(1/10) is bigger" : "log₂ n is bigger"}${k === 1 ? " (the tiny-n exception)" : k >= 59 ? ", and stays bigger for every larger k" : ", so the n^(1/10) algorithm is cheaper here"}.`;
    const xs = Array.from({ length: 160 }, (_, i) => 1 + (i / 159) * 79);
    lineChart($("#tenth-svg"), {
      xDomain: [0, 80], xLabel: "k  (n = 2ᵏ)", height: (W) => (W < 520 ? 210 : 240),
      series: [{ color: COLORS.f, label: "n^(1/10)", pts: xs.map((x) => [x, 2 ** (x / 10)]) }, { color: COLORS.g, label: "log₂ n", pts: xs.map((x) => [x, x]) }],
      markers: [{ x: 59, label: "k = 59 (n ≈ 5.8·10¹⁷)" }], shade: { from: 59, label: "n^(1/10) ahead" },
      dots: [{ x: k, y: Math.max(fv, k), cls: "now" }],
      snap: (v) => Math.round(v),
      hover: (x) => [`k = ${x}, n = 2${sup("^" + x)}`, `n^(1/10) = ${(2 ** (x / 10)).toFixed(2)}`, `log₂ n = ${x}`],
    });
  };
  $("#tenth-k").addEventListener("input", draw);
  REDRAW.add((id) => { if (id === "usage") draw(); });
  draw();
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
  $$("svg.htree[data-tree]").forEach((svg) => drawTree(svg, parseList(svg.dataset.tree), { idx: svg.hasAttribute("data-idx") }));
  $$("[data-cells]").forEach((box) => { const vals = parseList(box.dataset.cells); drawCells(box, [null, ...vals], vals.length); });
}

/* =========================================================== heap steppers (Lectures 4 and 5) */
const STEP_GEN = { insertIdea: Sim.insertIdeaSteps, extractIdea: Sim.extractIdeaSteps, insert: Sim.insertCodeSteps, extract: Sim.extractCodeSteps, build: Sim.buildSteps };
function setupHeapStepper(box) {
  const kind = box.dataset.kind;
  const scenarios = Sim.HEAP_SCENARIOS[kind.replace("Idea", "")];
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
  box.append(chips, el("div", { class: "split stepper" }, code, el("div", { class: "pic" }, svg, idea ? null : cells, vars, say, el("div", { class: "controls" }, back, next, count))));
  let steps = [], k = 0;
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
function setupPQRun() {
  const run = () => {
    const toks = $("#pq-script").value.trim().split(/\s+/).filter(Boolean);
    const q = [], pq = [], qOut = [], pqOut = [];
    for (const t of toks) {
      if (/^\+-?\d+(\.\d+)?$/.test(t)) { const v = Number(t.slice(1)); q.push(v); pq.push(v); }
      else if (t === "-") {
        qOut.push(q.length ? q.shift() : "empty");
        if (pq.length) { const m = Math.min(...pq); pq.splice(pq.indexOf(m), 1); pqOut.push(m); } else pqOut.push("empty");
      } else { $("#pq-q-out").textContent = `Can't read "${t}". Use +5 to insert 5 and - to remove.`; $("#pq-pq-out").textContent = ""; return; }
    }
    $("#pq-q-out").textContent = `prints ${qOut.join(", ") || "nothing"} · still waiting: ${q.join(", ") || "none"}`;
    $("#pq-pq-out").textContent = `prints ${pqOut.join(", ") || "nothing"} · still waiting: ${[...pq].sort((a, b) => a - b).join(", ") || "none"}`;
  };
  $("#pq-run").addEventListener("click", run);
  $("#pq-script").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  $$("[data-pq]").forEach((b) => b.addEventListener("click", () => { $("#pq-script").value = b.dataset.pq; run(); }));
  run();
}

/* =========================================================== complete tree: height grows only when a level fills */
function setupHeight() {
  const draw = () => {
    const n = Number($("#ht-n").value);
    $("#ht-n-out").textContent = String(n);
    drawTree($("#ht-svg"), Array.from({ length: n }, (_, i) => i + 1));
    $("#ht-out").textContent = Sim.heightSay(n);
  };
  $("#ht-n").addEventListener("input", draw);
  draw();
}

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

/* =========================================================== Section 2: what f ∈ O(n) leaves open */
const BAND_STMTS = [["O", 4, "O(n²)"], ["O", 2, "O(4n)"], ["O", 1, "O(log n)"], ["O", 3, "O(n log n)"], ["O", 0, "O(1)"], ["Omega", 2, "Ω(n)"], ["Omega", 1, "Ω(log n)"], ["Omega", 4, "Ω(n²)"]];
const LADDER_TXT = ["1", "log n", "n", "n log n", "n²", "2ⁿ"];
function setupBand() {
  const lad = $("#band-ladder"), out = $("#band-out");
  let cur = 0;
  const chips = BAND_STMTS.map(([, , label], i) => { const b = el("button", { class: "chip", type: "button", "aria-pressed": "false", text: `f ∈ ${label}` }); b.addEventListener("click", () => { cur = i; draw(); }); return b; });
  $("#band-stmts").replaceChildren(...chips);
  function draw() {
    const [rel, k, label] = BAND_STMTS[cur];
    chips.forEach((b, i) => b.setAttribute("aria-pressed", String(i === cur)));
    const v = Sim.boundVerdict("O", 2, rel, k);
    lad.replaceChildren(...LADDER_TXT.map((t, i) => {
      const inBand = i <= 2;
      const target = i === k;
      const ok = rel === "O" ? i <= k : i >= k;
      return el("li", { class: `${inBand ? "band" : ""}${target ? " target" : ""}${inBand ? (ok ? " ok" : " no") : ""}` }, el("b", { text: t }), el("span", { text: inBand ? (ok ? "f here: true" : "f here: false") : "f can't be here" }));
    }));
    const why = rel === "O"
      ? (v === "always" ? `Everywhere f can be (from 1 up to n) is at or below ${label.slice(2, -1)}, so it's always true.` : `If f is as big as n, it isn't in ${label}. If f is small, like 1, it is. So it depends on which f: sometimes true.`)
      : (v === "never" ? `${label} needs f at least as big as ${label.slice(2, -1)}, and f is at most about n. Never true.` : `If f is as big as n, it is in ${label}. If f is just 1, it isn't. Sometimes true.`);
    out.replaceChildren(el("strong", { text: `f ∈ ${label}: ${v === "always" ? "always true" : v === "never" ? "always false" : "sometimes true"}. ` }), why);
  }
  draw();
}

/* =========================================================== Section 2: numUnique, step by step */
const NU_PRESETS = { distinct: ["a", "b", "c", "d", "e"], same: ["a", "a", "a", "a", "a"], mixed: ["a", "b", "a", "c", "b"] };
function setupNumUnique() {
  const box = $("#nu");
  const code = $("#nu-code"), cells = $("#nu-cells"), vars = $("#nu-vars"), say = $("#nu-say");
  let steps = [], k = 0, values = [];
  function load(name) {
    values = NU_PRESETS[name];
    $$("[data-nu]", box).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.nu === name)));
    steps = Sim.numUniqueSteps(values); k = 0; paint();
  }
  function paint() {
    const st = steps[k];
    code.replaceChildren(...Sim.NUMUNIQUE_CODE.map((ln, i) => el("div", { class: `ln${i + 1 === st.line || (st.line === 3 && i >= 2 && i <= 4) ? " hl" : ""}` }, el("span", { class: "no", text: String(i + 1) }), el("span", { class: "src", text: ln }))));
    keepLineInView(code);
    cells.replaceChildren(...values.map((v, i) => el("div", { class: `cell${st.visited[i] ? " seen" : ""}${i === st.i ? " mid" : ""}${i === st.j && i !== st.i ? " cmp" : ""}` }, el("span", { class: "ptr", text: [i === st.i ? "i" : "", i === st.j ? "j" : ""].filter(Boolean).join(" ") }), el("b", { text: `"${v}"` }), el("span", { class: "idx", text: st.visited[i] ? `${i} ✓` : String(i) }))));
    vars.textContent = `out = ${st.out} · first loop: ${st.first} · inner-loop iterations: ${st.inner}`;
    say.textContent = st.say;
    $("#nu-back").disabled = k === 0;
    $("#nu-next").disabled = k === steps.length - 1;
  }
  $$("[data-nu]", box).forEach((b) => b.addEventListener("click", () => load(b.dataset.nu)));
  $("#nu-back").addEventListener("click", () => { if (k > 0) { k--; paint(); } });
  $("#nu-next").addEventListener("click", () => { if (k < steps.length - 1) { k++; paint(); } });
  load("distinct");
}

/* =========================================================== brute-force buttons */
const BRUTE = {
  "worst-cases"() {
    const rows = [4096, 1048576, 1000000].map((n) => [n, Sim.binaryWorstExhaustive(n), Sim.worstGaps(n).length]);
    const ok = rows[1][1] === 21 && rows[2][1] === 20 && rows.every((r) => r[1] === r[2]);
    return { ok, text: `Ran binary_contains for every possible target (each item and each gap): n = 4,096 → ${rows[0][1]}; n = 2²⁰ → ${rows[1][1]}; n = 1,000,000 → ${rows[2][1]} iterations at most.` };
  },
  eventually() {
    const p = Sim.raceProfile("n50", 12000);
    const lastFail = p.filter((r) => r.s === "gt").pop().to;
    let ff = 1; while (!(4n ** BigInt(ff) > 1000n * 2n ** BigInt(ff))) ff++;
    const lc = Sim.firstN((n) => Sim.logPlusTwoFails(12, n), 1, 5000);
    // n = 2^j has log n = j exactly, so n + 2 log n > 10 log n is 2^j + 2j > 10j
    const holds = (j) => 2 ** j + 2 * j > 10 * j;
    let k = 1; while (!holds(k)) k++;
    let stays = true;
    for (let j = k; j <= 30; j++) if (!holds(j)) stays = false;
    const ok = lastFail === 4401 && ff === 10 && lc === 1025 && 2 ** k === 64 && stays && p[p.length - 1].s === "le";
    return { ok, text: `Exact scan: 4ⁿ > 1000·2ⁿ first at n = ${ff}; log n + 2 > 12 first at n = ${fmtInt(lc)}; n + 2 log n > 10 log n first holds among powers of 2 at n = ${2 ** k}, and stays true up to 2³⁰. (n⁵⁰ > 1.1ⁿ last at n = ${fmtInt(lastFail)}.)` };
  },
  tenth() {
    const p = Sim.raceProfile("tenth", 400);
    const k = p[p.length - 1].from;
    return { ok: k === 59 && p[p.length - 1].s === "gt", text: `Compared 2ᵏ with k¹⁰ exactly for k = 1 … 400: n^(1/10) > log₂ n at k = 1, then log₂ n ≥ n^(1/10) for k = 2 … ${k - 1}, then n^(1/10) wins for every k from ${k} on.` };
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
setupStaticPictures();
setupHero();
setupGap();
setupABC();
setupQuant();
$$(".bound").forEach(setupBound);
setupGrid();
setupSimplify();
setupRelate();
setupRace();
setupTenth();
setupPQRun();
setupHeight();
$$(".heap-step").forEach(setupHeapStepper);
setupIndex();
setupPlayground();
setupBuildCost();
setupBand();
setupNumUnique();
setupBrute();
};
