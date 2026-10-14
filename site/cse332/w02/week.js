/* CSE 332 w02: misconception feedback (shown by core/grader.js for a tag in data-miscon) and this week's widgets. */
window.WEEK = window.WEEK || {};
window.WEEK.messages = {
  "linear-count": "That's how many items a linear scan would look at. Each binary-search iteration halves the gap.",
  "halved-once": "That's after one halving. Keep halving until the gap is 1.",
  "stopped-early": "Close. The loop still runs one more time when end − start is 1.",
  "rounded-up": "Check which power of 2 is just below n. The worst case is ⌊log₂ n⌋ + 1.",
  "strict-vs-equal": "Check that exact value of n directly. Is the inequality true there, and for every n after it?",
  "forgot-c": "Don't drop c. Solve 3n² + 17 ≤ 4n², which is n² ≥ 17.",
  "no-n0": "Try n = 1 in the inequality. Is it true there?",
  "not-smallest": "That n₀ works (it's the slides' choice), but it isn't the smallest. Try smaller values.",
  "c13-works": "Plug c = 13 in: the n² terms cancel. What's left, and is it ever true?",
  "base-not-log": "Change of base divides by log₂ of the base, not by the base itself.",
  "base-ignored": "That's log₂ n. The base 8 changes the value by a constant factor.",
  "base-multiplied": "Change of base divides by log₂ 8; it doesn't multiply.",
  "bigger-in-smaller": "Which grows faster, n or log n? O asks whether the left side is eventually at most a constant times the right.",
  "log-is-constant": "log n grows without bound, slowly. For any constant c, is log n eventually bigger than c?",
  "poly-vs-exp": "It looks false for small n, but any exponential bⁿ with b > 1 eventually beats any polynomial.",
  "exp-base-dropped": "The base of an exponential isn't a multiplicative constant. Look at 3ⁿ / 2ⁿ.",
  "first-hold-not-last-fail": "That's the first n where 1.1ⁿ is ahead. The question asks for the last n where n⁵⁰ is bigger.",
  "peak-not-crossing": "That's where n⁵⁰/1.1ⁿ is largest, not where it drops below 1.",
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

/* =========================================================== shared line chart (SVG, responsive, hover)
   One y axis only. Series are identified by legend + direct end labels (never color alone). */
// house palette series a1, a2, a3 (read from base.css tokens so the charts follow the stylesheet)
const COLORS = (() => {
  const css = getComputedStyle(document.documentElement);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return { f: v("--a1", "#0b7562"), g: v("--a2", "#b23a1c"), h: v("--a3", "#5a45c0") };
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
    svg.append(svgEl("text", { x: x(a) + 6, y: T + 14, class: "shade-label" }, opts.shade.label));
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
    // end label: at the last point inside the plot
    let k = pts.length - 1;
    while (k > 0 && y(pts[k][1]) < T - 1) k--;
    const last = pts[k];
    const exits = k < pts.length - 1;
    let ly = Math.max(T, y(last[1]));
    for (const o of labelYs) if (Math.abs(o - ly) < 15) ly = o + (ly >= o ? 15 : -15);
    labelYs.push(ly);
    if (!exits) svg.append(svgEl("circle", { cx: x(last[0]), cy: y(last[1]), r: 4, fill: s.color, class: "dot" }));
    svg.append(svgEl("text", { x: x(last[0]) + 8, y: ly + 4, class: "label" }, exits ? `${s.label} ↑` : s.label));
  }
  for (const d of opts.dots || []) if (d.x >= x0 && d.x <= x1) svg.append(svgEl("circle", { cx: x(d.x), cy: y(d.y), r: 5, class: `dot ${d.cls || ""}` }));
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
    tip.style.left = `${(x(v) / W) * r.width}px`;
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
  // slider is log-scaled over 1..20000 so both small and large n are reachable
  const fromSlider = (v) => Math.max(1, Math.round(Math.exp((v / 1000) * Math.log(20000))));
  const toSlider = (n) => Math.round((Math.log(n) / Math.log(20000)) * 1000);
  function update(n) {
    n = Math.max(1, Math.min(20000, Math.trunc(n) || 1));
    const c = R.cmp(n);
    const fD = Sim.digits(Sim.bigPow(n, 50)), gInt = Sim.bigPow(11, n) / Sim.bigPow(10, n);
    $("#hero-f").textContent = fD > 15 ? `${fD}-digit number` : Sim.bigPow(n, 50).toLocaleString("en-US");
    // 1.1^n = 11^n / 10^n exactly; show one decimal (rounded) while it's short
    const tenths = (Sim.bigPow(11, n) * 10n + Sim.bigPow(10, n) / 2n) / Sim.bigPow(10, n); // round(10 · 1.1^n)
    const gShort = `${(tenths / 10n).toLocaleString("en-US")}.${tenths % 10n}`;
    $("#hero-g").textContent = Sim.digits(gInt) > 15 ? `${Sim.digits(gInt)}-digit number` : n <= 1 ? "1.1" : `≈ ${gShort}`;
    $("#hero-f-sub").textContent = `n = ${fmtInt(n)}`;
    $("#hero-g-sub").textContent = `n = ${fmtInt(n)}`;
    const vs = $("#hero-vs");
    vs.textContent = c > 0 ? ">" : c < 0 ? "<" : "=";
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
  let heroN = 100;
  function drawHero() {
    const svg = $("#hero-svg");
    const xs = Array.from({ length: 241 }, (_, i) => Math.max(1, Math.round((i / 240) * N_MAX)));
    lineChart(svg, {
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

/* =========================================================== slide 8/9: the gap halves */
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
      const p = [];
      if (shown && i === cur.mid) p.push("mid");
      c.append(el("span", { class: "ptr", text: p.join(" ") }), el("b", { text: String(v) }), el("span", { class: "idx", text: String(i) }));
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

  // worst case for any n
  let timer;
  const worst = () => {
    const raw = $("#worst-n").value.trim();
    if (!/^\d{1,10}$/.test(raw) || Number(raw) < 1 || Number(raw) > 1e9) { $("#worst-out").textContent = "Enter a whole number n from 1 to 1,000,000,000."; $("#worst-chain").replaceChildren(); return; }
    const n = Number(raw), g = Sim.worstGaps(n);
    $("#worst-chain").replaceChildren(...g.flatMap((x, i) => [el("span", { class: "gchip", text: fmtInt(x) }), i < g.length - 1 ? el("span", { class: "garrow", text: "→" }) : null]).filter(Boolean));
    const fl = Math.floor(Math.log2(n)) + 1;
    let text = `n = ${fmtInt(n)}: ${g.length} gaps, so ${g.length} iterations in the worst case (⌊log₂ n⌋ + 1 = ${fl}). contains would need ${fmtInt(n)}.`;
    $("#worst-out").textContent = text;
    clearTimeout(timer);
    if (n <= 1000000) timer = setTimeout(() => {
      const w = Sim.binaryWorstExhaustive(n);
      $("#worst-out").textContent = `${text} Trying all ${fmtInt(2 * n + 1)} targets: the most iterations is ${w}${w === g.length ? ", which matches" : " (MISMATCH)"}.`;
    }, 150);
  };
  $("#worst-n").addEventListener("input", worst);
  worst();

  // log base table
  const table = () => {
    const c = Number($("#logb [aria-pressed=true]").dataset.base);
    const rows = [[2, 1], [2 ** 10, 10], [2 ** 20, 20], [2 ** 30, 30], [2 ** 40, 40]];
    const t = $("#logb-table");
    t.replaceChildren(el("tr", {}, el("th", { class: "r", text: "n" }), el("th", { class: "r", text: "log₂ n" }), el("th", { class: "r", text: `log${["", "", "₂", "", "", "₅", "", "", "₈", "", "₁₀"][c]} n` }), el("th", { class: "r", text: "log₂ n ÷ that" })));
    for (const [n, l2] of rows) {
      const lc = l2 / Math.log2(c);
      t.append(el("tr", {}, el("td", { class: "r", text: `2^${l2}`.replace(/\^(\d+)/, (_, d) => sup("^" + d)) }), el("td", { class: "r", text: String(l2) }), el("td", { class: "r", text: Number.isInteger(lc) ? String(lc) : lc.toFixed(3) }), el("td", { class: "r", text: c === 2 ? "1" : Math.log2(c) % 1 === 0 ? String(Math.log2(c)) : `${Math.log2(c).toFixed(3)}` })));
    }
  };
  $$("#logb [data-base]").forEach((b) => b.addEventListener("click", () => { $$("#logb [data-base]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); table(); }));
  table();
}

/* =========================================================== slide 15: clickable quantifiers */
const QUANT = {
  in: "f ∈ O(g(n)): O(g(n)) is a set of functions, and f is a member of it. That's why slide 17 says we'd never write O(n²) = 3n² + 17.",
  c: "∃c > 0: you get to pick one constant multiplier. It absorbs coefficients and units, so 3n² and 5n² land in the same set.",
  n0: "∃n₀ > 0: you get to pick a starting point. Every input smaller than n₀ is ignored, which is how \"for large enough n\" becomes precise.",
  all: "∀n ≥ n₀: after you've picked c and n₀, the inequality must hold for every larger n, forever. One fixed pair, no changing it per n.",
  le: "f(n) ≤ c·g(n): the comparison itself. Flip it to ≥ and you get Ω. Ask for both and you get Θ.",
};

function setupQuant() {
  $$(".q-part").forEach((b) => b.addEventListener("click", () => {
    $$(".q-part").forEach((x) => x.classList.toggle("on", x === b));
    $("#q-explain").textContent = QUANT[b.dataset.q];
  }));
}

/* =========================================================== c·g(n) sandwich (slides 14, 21–26) */
const SW_CLAIMS = {
  "sq17-theta": { f: ["17", "0", "3"], g: ["0", "0", "1"], fTex: "3n² + 17", gTex: "n²", theta: true, c1: "3", c2: "4", src: "Slide 17" },
};

Sim.CLAIMS.forEach((c) => { SW_CLAIMS[c.id] = { ...c, fTex: c.fTex.replace("^2", "²"), gTex: c.gTex.replace("^2", "²") }; });

const polyAt = (coeffs, n) => coeffs.reduce((s, a, k) => s + G.qToNumber(G.evalExact(a)) * n ** k, 0);

function setupSandwich(panel) {
  const id = panel.dataset.claim;
  const theta = SW_CLAIMS[id].theta;
  const claimBox = $(".sw-claim", panel), constBox = $(".sw-consts", panel), out = $(".sw-out", panel), svg = $(".sw-svg", panel), legend = $(".sw-legend", panel);
  let sel = null;
  if (!theta) {
    sel = el("select", { id: `${panel.id}-claim`, "aria-label": "Claim" });
    Sim.CLAIMS.forEach((c) => sel.append(el("option", { value: c.id, text: `${SW_CLAIMS[c.id].fTex} ∈ ${c.rel === "O" ? "O" : "Ω"}(${SW_CLAIMS[c.id].gTex}) · ${c.src}` })));
    sel.value = id;
    claimBox.append(el("label", {}, "Claim ", sel));
  } else {
    claimBox.append(el("span", { class: "claim-text", text: `${SW_CLAIMS[id].fTex} ∈ Θ(${SW_CLAIMS[id].gTex}) · ${SW_CLAIMS[id].src}` }));
  }
  const mkInput = (label, val, aria) => { const i = el("input", { type: "text", id: `${panel.id}-${aria}`, value: val, class: "short", "aria-label": aria, autocomplete: "off" }); constBox.append(el("label", {}, label, i)); return i; };
  const inC1 = theta ? mkInput("c₁ (below) =", SW_CLAIMS[id].c1, "c1") : null;
  const inC = mkInput(theta ? "c₂ (above) =" : "c =", theta ? SW_CLAIMS[id].c2 : SW_CLAIMS[id].c, theta ? "c2" : "c");
  const claim = () => SW_CLAIMS[sel ? sel.value : id];
  if (sel) sel.addEventListener("change", () => { inC.value = claim().c; draw(); });
  [inC, inC1].filter(Boolean).forEach((i) => i.addEventListener("input", draw));
  function analyze(spec, raw) {
    const r = G.smallestN0(spec, raw);
    if (r.unreadable) return { text: "Use a positive number like 4, 12 or 1/2.", n0: null, bad: true };
    if (r.tag === "c-not-positive") return { text: "c has to be greater than 0.", n0: null, bad: true };
    if (r.n0 === null) return { text: `No n₀ works with c = ${raw.trim()}: ${spec.rel === "O" ? "f(n) > c·g(n)" : "f(n) < c·g(n)"} for every large n.`, n0: null, bad: true };
    return { text: `Smallest n₀ = ${fmtInt(r.n0)}${r.lastFail ? ` (fails at n = ${fmtInt(r.lastFail)})` : " (holds from n = 1)"}.`, n0: Number(r.n0) };
  }
  function draw() {
    const cl = claim();
    const f = (n) => polyAt(cl.f, n), g = (n) => polyAt(cl.g, n);
    const series = [{ color: COLORS.f, label: "f(n)", pts: [] }];
    let results = [], n0s = [];
    const cs = [];
    if (theta) {
      const lo = analyze({ f: cl.f, g: cl.g, rel: "Omega" }, inC1.value), hi = analyze({ f: cl.f, g: cl.g, rel: "O" }, inC.value);
      results = [`Lower bound (Ω) with c₁ = ${inC1.value.trim()}: ${lo.text}`, `Upper bound (O) with c₂ = ${inC.value.trim()}: ${hi.text}`];
      if (lo.n0 && hi.n0) { results.push(`So c₁·g(n) ≤ f(n) ≤ c₂·g(n) for every n ≥ ${Math.max(lo.n0, hi.n0)}: f ∈ Θ(g).`); n0s.push(Math.max(lo.n0, hi.n0)); }
      const c1 = G.tryEval(inC1.value, {}), c2 = G.tryEval(inC.value, {});
      if (c2.ok) cs.push({ c: G.qToNumber(c2.value), color: COLORS.g, label: "c₂·g(n)" });
      if (c1.ok) cs.push({ c: G.qToNumber(c1.value), color: COLORS.h, label: "c₁·g(n)" });
      legend.replaceChildren(...[["f(n) = " + cl.fTex, COLORS.f], ["c₂·g(n)", COLORS.g], ["c₁·g(n)", COLORS.h]].map(([t, c]) => el("span", {}, el("span", { class: "key", style: `border-color:${c}` }), t)));
    } else {
      const spec = { f: cl.f, g: cl.g, rel: cl.rel };
      const r = analyze(spec, inC.value);
      results = [`${cl.fTex} ${cl.rel === "O" ? "≤" : "≥"} c·(${cl.gTex}) with c = ${inC.value.trim()}: ${r.text}`];
      if (r.n0) n0s.push(r.n0);
      const cv = G.tryEval(inC.value, {});
      if (cv.ok) cs.push({ c: G.qToNumber(cv.value), color: COLORS.g, label: "c·g(n)" });
      legend.replaceChildren(...[["f(n) = " + cl.fTex, COLORS.f], [`c·g(n), g(n) = ${cl.gTex}`, COLORS.g]].map(([t, c]) => el("span", {}, el("span", { class: "key", style: `border-color:${c}` }), t)));
    }
    out.replaceChildren(...results.map((t) => el("div", { text: t })));
    const n0 = n0s[0] || null;
    const N = Math.max(12, Math.ceil((n0 || 6) * 2.2));
    const xs = Array.from({ length: 121 }, (_, i) => (i / 120) * N);
    series[0].pts = xs.map((n) => [n, f(n)]);
    for (const c of cs) series.push({ color: c.color, label: c.label, pts: xs.map((n) => [n, c.c * g(n)]) });
    const ys = series.flatMap((s) => s.pts.map((p) => p[1]));
    const top = Math.max(...series[0].pts.map((p) => p[1])) * 1.8;
    const yMax = Math.min(Math.max(...ys), Math.max(top, 1));
    const step = 10 ** Math.floor(Math.log10(yMax / 4)) * ([1, 2, 2.5, 5, 10].find((m) => 10 ** Math.floor(Math.log10(yMax / 4)) * m * 4 >= yMax) || 10);
    lineChart(svg, {
      xDomain: [0, N], yDomain: [Math.min(0, ...ys), step * 4], xLabel: "n",
      series, markers: n0 ? [{ x: n0, label: `n₀ = ${fmtInt(n0)}` }] : [], shade: n0 ? { from: n0, label: "n ≥ n₀" } : null,
      snap: (v) => Math.round(v),
      hover: (n) => [`n = ${fmtInt(n)}`, `f(n) = ${fmtNum(f(n))}`, ...cs.map((c) => `${c.label} = ${fmtNum(c.c * g(n))}`)],
    });
  }
  REDRAW.add((pid) => { if (panel.closest(".page").id === pid) draw(); });
  draw();
}

/* =========================================================== slide 18: case × bound grid */
const GRID = {
  "O-worst": "Binary search's worst case is O(log n). (Slide 34 says Θ(log n), and Θ includes O.)",
  "O-best": "Binary search's best case is O(1): the item is in the middle (slide 34).",
  "Omega-worst": "Every sorting algorithm takes at least n log n time in the worst case: Ω in a worst-case context (slide 18's speaker note). Also: binary search is Ω(log log n) in the worst case (slide 34).",
  "Omega-best": "\"Every algorithm for this problem needs to look at all the elements, so will take at least n time, even in the best case.\" That's an Ω(n) best-case statement (slide 18's speaker note).",
  "Theta-worst": "Binary search is Θ(log n) in the worst case (slide 34). This is the most common kind of statement.",
  "Theta-best": "Binary search is Θ(1) in the best case (slide 34).",
};

function setupGrid() {
  const t = $("#grid-table");
  t.append(el("tr", {}, el("th", { text: "" }), el("th", { text: "worst case" }), el("th", { text: "best case" })));
  for (const [row, name] of [["O", "O (≤)"], ["Omega", "Ω (≥)"], ["Theta", "Θ (=)"]]) {
    const tr = el("tr", {}, el("th", { text: name }));
    for (const col of ["worst", "best"]) {
      const b = el("button", { class: "grid-cell", "data-cell": `${row}-${col}`, text: "✓ true statement" });
      b.addEventListener("click", () => { $$(".grid-cell").forEach((x) => x.classList.toggle("on", x === b)); $("#grid-out").textContent = GRID[`${row}-${col}`]; });
      tr.append(el("td", {}, b));
    }
    t.append(tr);
  }
}

/* =========================================================== slide 27–29: simplifier + category ladder */
const LADDER = [
  ["1", "constant"], ["log n", "logarithmic"], ["n", "linear"], ["n log n", "log-linear"], ["n^2", "quadratic"], ["n^3", "cubic"], ["n^4", "polynomial, nᵏ (k > 1)"], ["2^n", "exponential, kⁿ (k > 1)"],
];

function setupSimplify() {
  const ladder = $("#simp-ladder");
  const rungs = LADDER.map(([e, name]) => el("li", { "data-rung": e }, el("b", { text: `O(${sup(e)})` }), el("span", { text: name })));
  ladder.replaceChildren(...rungs);
  const run = () => {
    const raw = $("#simp-in").value;
    const r = G.parseAsym(G.stripWrapper(G.normalizeExpr(raw)));
    rungs.forEach((x) => x.classList.remove("on", "between"));
    if (!raw.trim()) { $("#simp-out").textContent = ""; return; }
    if (!r.ok) { $("#simp-out").textContent = `Can't classify that for certain (${r.error}).`; return; }
    const name = G.asymName(r.cls);
    const notes = [];
    if (r.terms > 1) notes.push("dropped the non-dominant terms");
    if (r.lead && !G.eq(r.lead, G.Q(1n))) notes.push(`dropped the constant factor ${G.qToString(r.lead)}`);
    if (r.base) notes.push("ignored the log base");
    $("#simp-out").textContent = `Θ(${sup(name)})${notes.length ? `: ${notes.join(", ")}.` : "."}`;
    // place it on the ladder (slide 29's categories)
    const cls = LADDER.map(([e]) => G.parseAsym(e).cls);
    let placed = false;
    cls.forEach((c, i) => { if (G.clsCmp(c, r.cls) === 0) { rungs[i].classList.add("on"); placed = true; } });
    if (!placed) {
      const poly = G.eq(r.cls.b, G.Q(1n)) && r.cls.l.n === 0n && r.cls.m.n === 0n && G.cmp(r.cls.d, G.Q(1n)) > 0 && r.cls.d.d === 1n;
      const exp = G.cmp(r.cls.b, G.Q(1n)) > 0 && r.cls.d.n === 0n && r.cls.l.n === 0n;
      if (poly) rungs[6].classList.add("on");
      else if (exp) rungs[7].classList.add("on");
      else {
        const i = cls.findIndex((c) => G.clsCmp(c, r.cls) > 0);
        if (i > 0) { rungs[i - 1].classList.add("between"); rungs[i].classList.add("between"); $("#simp-out").textContent += ` It sits between ${sup("O(" + LADDER[i - 1][0] + ")")} and ${sup("O(" + LADDER[i][0] + ")")}; slide 29 has no name for it.`; }
      }
    }
  };
  $("#simp-in").addEventListener("input", run);
  $$("[data-simp]").forEach((b) => b.addEventListener("click", () => { $("#simp-in").value = b.dataset.simp; run(); }));
  run();
}

/* =========================================================== slides 31–32: relation classifier */
function setupRelate() {
  const run = () => {
    const f = $("#rel-f").value, g = $("#rel-g").value;
    const r = G.relate(G.stripWrapper(G.normalizeExpr(f)), G.stripWrapper(G.normalizeExpr(g)));
    const out = $("#rel-out");
    if (r.error) { out.replaceChildren(el("p", { class: "note", text: `Can't classify that for certain (${r.error}).` })); return; }
    const card = (sym, ok, why) => el("div", { class: `verdict ${ok ? "yes" : "no"}` }, el("span", { class: "v-sym", text: `f ∈ ${sym}(g)` }), el("b", { text: ok ? "True" : "False" }), el("span", { class: "v-why", text: why }));
    const word = r.cmp < 0 ? "grows strictly slower than" : r.cmp > 0 ? "grows strictly faster than" : "grows at the same rate as";
    out.replaceChildren(
      el("p", { class: "v-head", text: `f is Θ(${sup(r.f)}) and g is Θ(${sup(r.g)}), so f ${word} g.` }),
      el("div", { class: "v-row" },
        card("O", r.o, r.o ? "f ≤ c·g eventually" : "no c works: f/g grows without bound"),
        card("Ω", r.omega, r.omega ? "f ≥ c·g eventually" : "no c > 0 works: f/g shrinks to 0"),
        card("Θ", r.theta, r.theta ? "both bounds hold" : "only one bound holds")),
    );
  };
  $("#rel-f").addEventListener("input", run); $("#rel-g").addEventListener("input", run);
  $$("[data-rel]").forEach((b) => b.addEventListener("click", () => { const [f, g] = JSON.parse(b.dataset.rel); $("#rel-f").value = f; $("#rel-g").value = g; run(); }));
  run();
}

/* =========================================================== exact races (slide 32) */
function setupRace() {
  let cur = "n50";
  const draw = () => {
    const R = Sim.RACES[cur];
    const runs = Sim.raceProfile(cur);
    const last = runs[runs.length - 1];
    const n0 = last.s === "le" ? last.from : null; // f <= g from here to the end of the range
    const flip = cur === "threeTwo" ? runs.find((r) => r.s === "gt").from : n0;
    const [a, b] = R.range;
    const xs = [...new Set(Array.from({ length: 201 }, (_, i) => Math.max(a, Math.round((i / 200) * b))))];
    $("#race-legend").replaceChildren(...[[R.fText, COLORS.f], [R.gText, COLORS.g]].map(([t, c]) => el("span", {}, el("span", { class: "key", style: `border-color:${c}` }), sup(t))));
    lineChart($("#race-svg"), {
      xDomain: [0, b], xLabel: "n", yLabel: "log₁₀ of the value",
      series: [{ color: COLORS.f, label: sup(R.fText), pts: xs.map((n) => [n, R.log10f(n)]) }, { color: COLORS.g, label: R.gText.replace("^n", "ⁿ"), pts: xs.map((n) => [n, R.log10g(n)]) }],
      markers: [{ x: flip, label: `n = ${fmtInt(flip)}` }],
      shade: { from: flip, label: cur === "n50" ? "1.1ⁿ ahead" : "3ⁿ ahead" },
      snap: (v) => Math.round(v),
      hover: (n) => [`n = ${fmtInt(n)}`, `${sup(R.fText)}: ${R.digitsF(n)} digits`, `${R.gText.replace("^n", "ⁿ")}: ${R.digitsG(n)} digits`, R.cmp(n) > 0 ? `${sup(R.fText)} is bigger` : `${sup(R.fText)} ≤ ${R.gText.replace("^n", "ⁿ")}`],
    });
    $("#race-out").textContent = cur === "n50"
      ? `Exact: n⁵⁰ ≤ 1.1ⁿ at n = 1, n⁵⁰ > 1.1ⁿ for every n from 2 to 4,401, and n⁵⁰ ≤ 1.1ⁿ for every n from 4,402 on (checked to ${fmtInt(b)}; after n = 525 the ratio n⁵⁰/1.1ⁿ only shrinks). So c = 1, n₀ = 4,402 proves n⁵⁰ ∈ O(1.1ⁿ).`
      : `Exact: 3ⁿ ≤ 1000·2ⁿ for n ≤ 17 and 3ⁿ > 1000·2ⁿ from n = 18 on (the ratio 1.5ⁿ only grows). The slide's bound: n > log₂1000 / (log₂3 − 1) ≈ 17.04. Every c fails this way, so 3ⁿ ∉ O(2ⁿ) and 3ⁿ ∉ Θ(2ⁿ).`;
    const ns = cur === "n50" ? [1, 2, 100, 525, 1000, 4401, 4402, 6000] : [1, 10, 17, 18, 20, 40];
    const t = el("table", { class: "plain num" }, el("tr", {}, el("th", { class: "r", text: "n" }), el("th", { class: "r", text: sup(R.fText) }), el("th", { class: "r", text: R.gText.replace("^n", "ⁿ") }), el("th", { text: "bigger" })));
    for (const n of ns) {
      const fv = cur === "n50" ? Sim.bigPow(n, 50) : Sim.bigPow(3, n);
      const gv = cur === "n50" ? null : 1000n * Sim.bigPow(2, n);
      const gText = cur === "n50" ? `${R.digitsG(n)}-digit integer part` : sciBig(gv);
      t.append(el("tr", { class: R.cmp(n) > 0 ? "" : "win" }, el("td", { class: "r", text: fmtInt(n) }), el("td", { class: "r", text: sciBig(fv) }), el("td", { class: "r", text: cur === "n50" && n <= 100 ? `≈ ${(1.1 ** n).toPrecision(5)}` : gText }), el("td", { text: R.cmp(n) > 0 ? sup(R.fText) : R.gText.replace("^n", "ⁿ") })));
    }
    $("#race-table").replaceChildren(t);
  };
  $$("#race [data-race]").forEach((b) => b.addEventListener("click", () => { cur = b.dataset.race; $$("#race [data-race]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); draw(); }));
  $("#race-table-toggle").addEventListener("click", (e) => { const t = $("#race-table"); t.hidden = !t.hidden; e.currentTarget.setAttribute("aria-pressed", String(!t.hidden)); });
  REDRAW.add((id) => { if (id === "examples") draw(); });
  draw();
}

/* =========================================================== slide 36: n^(1/10) vs log n */
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

/* =========================================================== brute-force buttons */
const BRUTE = {
  "worst-cases"() {
    const rows = [[4096, null], [1048576, 21], [1000000, 20]].map(([n]) => [n, Sim.binaryWorstExhaustive(n), Sim.worstGaps(n).length]);
    const ok = rows[1][1] === 21 && rows[2][1] === 20 && rows.every((r) => r[1] === r[2]);
    return { ok, text: `Ran binary_contains for every possible target (each item and each gap): n = 4,096 → ${rows[0][1]}; n = 2²⁰ → ${rows[1][1]}; n = 1,000,000 → ${rows[2][1]} iterations at most.` };
  },
  eventually() {
    const p = Sim.raceProfile("n50", 12000);
    const lastFail = p.filter((r) => r.s === "gt").pop().to;
    const tt = Sim.firstN((n) => Sim.threeTwoFails(1000, n));
    const lc = Sim.firstN((n) => Sim.logPlusTwoFails(12, n), 1, 5000);
    const nl = Sim.firstN((n) => Sim.nPlusLogFails(10, n), 2);
    let stays = true;
    for (let n = nl; n <= 1000; n++) if (!Sim.nPlusLogFails(10, n)) stays = false;
    const ok = lastFail === 4401 && tt === 18 && lc === 1025 && nl === 44 && stays && p[p.length - 1].s === "le";
    return { ok, text: `Exact big-integer scan: n⁵⁰ > 1.1ⁿ last at n = ${fmtInt(lastFail)} (checked to 12,000); 3ⁿ > 1000·2ⁿ first at n = ${tt}; log n + 2 > 12 first at n = ${fmtInt(lc)}; 2ⁿ > n⁸ first at n = ${nl}, and it stays true to n = 1,000.` };
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
setupHero();
setupGap();
setupQuant();
$$(".sandwich").forEach(setupSandwich);
setupGrid();
setupSimplify();
setupRelate();
setupRace();
setupTenth();
setupBrute();
};
