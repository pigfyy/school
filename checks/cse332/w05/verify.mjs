// Ground truth for every computed answer on site/cse332/w05/.
// 1. Independent implementations written here (not shared with sim.js): insertion sort by shifting, selection sort,
//    in-place heap sort on a 1-indexed copy, top-down merge sort on slices, the slides' partition and quicksort,
//    bucket and radix sort, and week 4's hash tables. sim.js, which the widgets run, must agree on outputs and on
//    every count the page states, on the page's arrays and on random arrays.
// 2. Every auto-graded key in the page must have an expected value here and be graded correct; every misconception
//    value must be graded wrong; every multiple-choice item has exactly one right option.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const here = new URL(".", import.meta.url).pathname;
const G = require("../../../site/core/grader.js");
const Sim = require("../../../site/cse332/w05/sim.js");

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL", msg); } };
const sp = (a) => a.join(" ");
const yn = (b) => (b ? "yes" : "no");

/* ---------------------------------------------------------------- 1a. sorts, independently */
// insertion sort by shifting: comparisons = for each i, the number of left neighbours examined
function insertion(a0) {
  const a = a0.slice(); let cmp = 0, moves = 0; const states = [];
  for (let i = 1; i < a.length; i++) {
    const x = a[i]; let j = i - 1;
    while (j >= 0) { cmp++; if (a[j] > x) { a[j + 1] = a[j]; j--; moves++; } else break; }
    a[j + 1] = x; states.push(a.slice());
  }
  return { out: a, cmp, swaps: moves, states };
}
function selection(a0) { const a = a0.slice(); let cmp = 0; for (let i = 0; i < a.length - 1; i++) { let m = i; for (let j = i + 1; j < a.length; j++) { cmp++; if (a[j] < a[m]) m = j; } [a[i], a[m]] = [a[m], a[i]]; } return { out: a, cmp }; }
// heap sort on a 1-indexed array (children 2i, 2i+1), reported back 0-indexed
function heapsort(a0, prebuilt) {
  const h = [null, ...a0]; const n = a0.length; const states = [];
  const down = (i, size) => { for (;;) { let c = 2 * i; if (c > size) return; if (c + 1 <= size && h[c + 1] > h[c]) c++; if (h[c] > h[i]) { [h[c], h[i]] = [h[i], h[c]]; i = c; } else return; } };
  if (!prebuilt) for (let i = Math.floor(n / 2); i >= 1; i--) down(i, n);
  const built = h.slice(1);
  for (let size = n; size > 1; size--) { [h[1], h[size]] = [h[size], h[1]]; down(1, size - 1); states.push(h.slice(1)); }
  return { out: h.slice(1), built, states };
}
// merge sort on slices with the same split (left gets ceil), counting comparisons per merge
function msort(a, log) {
  if (a.length <= 1) return a.slice();
  const mid = Math.ceil(a.length / 2);
  const L = msort(a.slice(0, mid), log), R = msort(a.slice(mid), log);
  const out = []; let i = 0, j = 0, c = 0;
  while (i < L.length && j < R.length) { c++; out.push(L[i] <= R[j] ? L[i++] : R[j++]); }
  log.push({ L, R, c, out: out.concat(L.slice(i), R.slice(j)) });
  return out.concat(L.slice(i), R.slice(j));
}
// the slides' partition, written from slide 22's words
function part(a, lo, hi) {
  const p = a[lo]; let begin = lo + 1, end = hi, cmp = 0;
  while (begin < end) { cmp++; if (a[begin] < p) begin++; else { const t = a[begin]; a[begin] = a[end]; a[end] = t; end--; } }
  cmp++;
  const meet = a[begin];
  const dest = meet < p ? begin : begin - 1;
  const t = a[lo]; a[lo] = a[dest]; a[dest] = t;
  return { dest, meet, cmp };
}
function qsort(a0) { const a = a0.slice(); let cmp = 0; const rec = (lo, hi) => { if (lo >= hi) return; const r = part(a, lo, hi); cmp += r.cmp; rec(lo, r.dest - 1); rec(r.dest + 1, hi); }; rec(0, a.length - 1); return { out: a, cmp }; }
function radix(a0) { let a = a0.slice(); const passes = []; const max = Math.max(...a0); for (let p = 1; p === 1 || p <= max; p *= 10) { const b = Array.from({ length: 10 }, () => []); for (const x of a) b[Math.floor(x / p) % 10].push(x); a = b.flat(); passes.push(a.slice()); } return passes; }
const isSorted = (a) => a.every((x, i) => i === 0 || a[i - 1] <= x);
{
  let seed = 5332;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let t = 0; t < 400; t++) {
    const n = 1 + Math.floor(rnd() * 16), a = Array.from({ length: n }, () => Math.floor(rnd() * (t % 3 ? 50 : 4)));
    const want = a.slice().sort((x, y) => x - y);
    const I = insertion(a), S = Sim.insertionSort(a);
    ok(sp(I.out) === sp(want) && sp(S.out) === sp(want) && I.cmp === S.comparisons && I.swaps === S.swaps && I.swaps === Sim.inversions(a), `insertion ${a}`);
    const Se = selection(a), SS = Sim.selectionSort(a); ok(sp(SS.out) === sp(want) && Se.cmp === SS.comparisons, `selection ${a}`);
    const H = heapsort(a, false), SH = Sim.heapSort(a); ok(sp(H.out) === sp(want) && sp(SH.out) === sp(want) && sp(H.built) === sp(SH.frames[0].a), `heap ${a}`);
    for (let k = 0; k < H.states.length; k++) ok(sp(H.states[k]) === sp(SH.frames[k + 1].a), `heap state ${k} of ${a}`);
    const log = [], M = msort(a, log), SM = Sim.mergeSort(a); ok(sp(M) === sp(want) && sp(SM.out) === sp(want) && log.reduce((s, x) => s + x.c, 0) === SM.comparisons, `merge ${a}`);
    const Q = qsort(a), SQ = Sim.quickSort(a); ok(sp(Q.out) === sp(want) && sp(SQ.out) === sp(want) && Q.cmp === SQ.comparisons, `quick ${a}`);
    const R = radix(a.length ? a : [0]); ok(a.length === 0 || (sp(R.at(-1)) === sp(want) && sp(Sim.radixSort(a).out) === sp(want)), `radix ${a}`);
  }
}
/* ---------------------------------------------------------------- 1c. hashing, independently */
const code = (c) => c.charCodeAt(0);
const h1 = (s) => BigInt(code(s[0]));
const h2 = (s) => { let t = 0n; for (const c of s) t += BigInt(code(c)); return t; };
const h3 = (s) => { let t = 0n, p = 1n; for (const c of s) { t += BigInt(code(c)) * p; p *= 31n; } return t; };
const h4 = (s) => 2n * h3(s);
const md = (x, m) => Number(((BigInt(x) % BigInt(m)) + BigInt(m)) % BigInt(m));
for (const s of ["cat", "act", "dog", "god", "ab", "ba", "a", "hello world", "CSE332", "zzzzzzzzzzzzzzzzzzzz"]) {
  ok(Sim.H.h1(s) === h1(s) && Sim.H.h2(s) === h2(s) && Sim.H.h3(s) === h3(s) && Sim.H.h4(s) === h4(s), `string hashes of ${s}`);
  ok(Sim.horner(s).at(-1) === h3(s), `Horner gives h3 for ${s}`);
}
// open addressing: probe(i) for each strategy; insert reuses the first tombstone after confirming the key is absent
const T = "TOMB";
function oaTable(size, probe) { return { size, probe, a: new Array(size).fill(null) }; }
function oaFind(t, k) { const path = []; for (let i = 0; i < t.size; i++) { const j = t.probe(k, i); path.push(j); if (t.a[j] === k) return { at: j, path }; if (t.a[j] === null) return { at: -1, path }; } return { at: -1, path }; }
function oaInsert(t, k) {
  const path = []; let tomb = -1;
  for (let i = 0; i < t.size; i++) {
    const j = t.probe(k, i); path.push(j);
    if (t.a[j] === k) return { at: j, path };
    if (t.a[j] === T) { if (tomb < 0) tomb = j; continue; }
    if (t.a[j] === null) { const d = tomb >= 0 ? tomb : j; t.a[d] = k; return { at: d, path }; }
  }
  if (tomb >= 0) { t.a[tomb] = k; return { at: tomb, path }; }
  return { at: -1, path };
}
function oaDelete(t, k) { const f = oaFind(t, k); if (f.at >= 0) t.a[f.at] = T; return f; }
const LIN = (m) => (k, i) => (md(k, m) + i) % m, QUAD = (m) => (k, i) => (md(k, m) + i * i) % m, DBL = (m, g) => (k, i) => md(md(k, m) + i * g(k), m);
const g7 = (k) => 7 - md(k, 7);
const oa = (size, probe, keys) => { const t = oaTable(size, probe); const log = keys.map((k) => oaInsert(t, k)); return { t, log }; };
const chain = (size, keys) => { const b = Array.from({ length: size }, () => []); for (const k of keys) { const i = md(k, size); if (!b[i].includes(k)) b[i].push(k); } return b; };

/* ---------------------------------------------------------------- 2. expected values for every key */
const A6 = [8, 3, 5, 1, 9, 2], S14 = [10, 9, 6, 8, 7, 5, 2, 4, 1, 3], A8 = [5, 8, 2, 9, 4, 1, 3, 7], P12 = [8, 5, 7, 3, 12, 10, 1, 2, 4, 9, 6, 11];
const R16 = [103, 801, 401, 323, 255, 823, 999, 101, 113, 901, 555, 512, 245, 800, 18, 121], RS5 = [170, 45, 75, 90, 802, 24, 2, 66];
const H14 = heapsort(S14, true), mlog = [], m8 = msort(A8, mlog), lastMerge = mlog.at(-1);
const p12 = P12.slice(), pr = part(p12, 0, 11);
const r16 = radix(R16), r5 = radix(RS5);
const eq8 = qsort(Array(8).fill(17));
const med3 = (a) => [a[0], a[Math.floor((a.length - 1) / 2)], a[a.length - 1]].sort((x, y) => x - y)[1];
const s5lin = (() => { const t = oaTable(10, LIN(10)); const log = [7, 9, 48, 8, 37, 57].map((k) => oaInsert(t, k)); for (const k of [37, 7, 57]) oaDelete(t, k); return { log, del17: oaFind(t, 17) }; })();
const s5quad = oa(10, QUAD(10), [7, 9, 48, 8, 37, 57]);
const s5chain = chain(10, [7, 9, 48, 8, 37, 57]);
const frac = (n, d) => G.qToPlain(G.Q(BigInt(n), BigInt(d)));

const EXPECT = {
  // Lecture 12
  "cse332-w5-l12-qc-best": "n", "cse332-w5-l12-qc-swaps": String(insertion([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]).swaps),
  "cse332-w5-l12-qc-after-first": sp(H14.states[0]),
  "cse332-w5-l12-insertion.after3": sp(insertion(A6).states[2]), "cse332-w5-l12-insertion.swaps": String(insertion(A6).swaps), "cse332-w5-l12-insertion.sorted": String(insertion([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).cmp),
  "cse332-w5-l12-cases.rev10": String(insertion([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]).swaps), "cse332-w5-l12-cases.worst": "n^2", "cse332-w5-l12-cases.best": "n",
  "cse332-w5-l12-heap.second": sp(H14.states[1]), "cse332-w5-l12-heap.build": sp(heapsort([3, 1, 6, 5, 2, 4], false).built), "cse332-w5-l12-heap.cost": "n log n",
  "cse332-w5-l12-props.ins-inplace": "yes", "cse332-w5-l12-props.ins-online": "yes", "cse332-w5-l12-props.ins-stable": "yes", "cse332-w5-l12-props.heap-inplace": "yes", "cse332-w5-l12-props.heap-adaptive": "no", "cse332-w5-l12-props.heap-online": "no",
  "cse332-w5-l12-cyu-ins-worst": "n^2", "cse332-w5-l12-cyu-swaps6": String(insertion([2, 1, 4, 3, 6, 5]).swaps), "cse332-w5-l12-cyu-heap-cost": "n log n",
  // Lecture 13
  "cse332-w5-l13-qc-final-merge": String(lastMerge.c), "cse332-w5-l13-qc-pivot-index": String(pr.dest), "cse332-w5-l13-qc-median3": String(med3(P12)), "cse332-w5-l13-qc-radix-passes": String(r16.length),
  "cse332-w5-l13-merge.left": sp(lastMerge.L), "cse332-w5-l13-merge.right": sp(lastMerge.R), "cse332-w5-l13-merge.last": String(lastMerge.c), "cse332-w5-l13-merge.total": String(mlog.reduce((s, x) => s + x.c, 0)),
  "cse332-w5-l13-partition.result": sp(p12), "cse332-w5-l13-partition.meet": String(pr.meet), "cse332-w5-l13-partition.at": String(pr.dest),
  "cse332-w5-l13-pivot.worst": "n^2", "cse332-w5-l13-pivot.best": "n log n", "cse332-w5-l13-pivot.same8": String(eq8.cmp), "cse332-w5-l13-pivot.median3": String(med3([9, 2, 7, 4, 5, 1, 8, 3, 6])),
  "cse332-w5-l13-radix.first4": sp(r16[0].slice(0, 4)), "cse332-w5-l13-radix.after10": sp(r16[1].slice(0, 6)), "cse332-w5-l13-radix.passes": String(r16.length),
  "cse332-w5-l13-bucket.out": sp(Sim.bucketSort([3, 0, 2, 3, 1, 0], 4).out), "cse332-w5-l13-bucket.cost": "nk", "cse332-w5-l13-bucket.stable": "yes",
  "cse332-w5-l13-cyu-merge-cost": "n log n", "cse332-w5-l13-cyu-merge-two": String((() => { const l = []; msort([1, 2, 3, 4, 5, 6], l); return l.at(-1).c; })()), "cse332-w5-l13-cyu-partition-cost": "n", "cse332-w5-l13-cyu-radix-passes": String(radix([9999, 0]).length),
  // Section 5
  "cse332-w5-s5-qc-37-linear": String(s5lin.log[4].at), "cse332-w5-s5-qc-57-quad": String(s5quad.log[5].at), "cse332-w5-s5-qc-selection-same": "n^2", "cse332-w5-s5-qc-radix-10s": sp(r5[1]),
  "cse332-w5-s5-linear.i8": String(s5lin.log[3].at), "cse332-w5-s5-linear.i37": String(s5lin.log[4].at), "cse332-w5-s5-linear.i57": String(s5lin.log[5].at), "cse332-w5-s5-linear.del17": String(s5lin.del17.path.length),
  "cse332-w5-s5-quad.i8": String(s5quad.log[3].at), "cse332-w5-s5-quad.i37": String(s5quad.log[4].at), "cse332-w5-s5-quad.i57": String(s5quad.log[5].at),
  "cse332-w5-s5-chain.b7": sp(s5chain[7]), "cse332-w5-s5-chain.b8": sp(s5chain[8]), "cse332-w5-s5-chain.lambda": frac(6, 10),
  "cse332-w5-s5-double.fixes": "both", "cse332-w5-s5-double.avg": "1lambda",
  "cse332-w5-s5-same.ins": "n", "cse332-w5-s5-same.sel": "n^2", "cse332-w5-s5-same.merge": "n log n", "cse332-w5-s5-same.quick": "n^2",
  "cse332-w5-s5-mixed.ins": "n^2", "cse332-w5-s5-mixed.sel": "n^2", "cse332-w5-s5-mixed.merge": "n log n", "cse332-w5-s5-mixed.quick": "n^2",
  "cse332-w5-s5-radix.ones": sp(r5[0]), "cse332-w5-s5-radix.tens": sp(r5[1]), "cse332-w5-s5-radix.hundreds": sp(r5[2]),
  "cse332-w5-s5-warmup.unique": "n log n", "cse332-w5-s5-warmup.same": "n",
  "cse332-w5-s5-cyu-48-quad": String(s5quad.log[2].at), "cse332-w5-s5-cyu-selection-best": "n^2", "cse332-w5-s5-cyu-ins-equal": "n", "cse332-w5-s5-cyu-radix-first": sp(r5[0]),
};
// the counting behind the Θ answers: exact counts follow the claimed shapes
{
  for (const n of [10, 20, 40, 80]) {
    const eq = Array(n).fill(7), up = Array.from({ length: n }, (_, i) => i), down = up.slice().reverse();
    ok(insertion(eq).cmp === n - 1 && insertion(up).cmp === n - 1 && insertion(down).swaps === (n * (n - 1)) / 2, `insertion: n-1 on equal/sorted, n(n-1)/2 swaps reversed (n=${n})`);
    ok(selection(eq).cmp === (n * (n - 1)) / 2 && selection(up).cmp === (n * (n - 1)) / 2, `selection always n(n-1)/2 (n=${n})`);
    ok(qsort(eq).cmp === (n * (n - 1)) / 2, `quicksort on equal keys: n(n-1)/2 (n=${n})`);
    // Section 5 problem 1 shape: increasing run then decreasing run, first item above the second run's first
    const half = n / 2, shape = [...Array.from({ length: half }, (_, i) => 1000 + i * 3), ...Array.from({ length: half }, (_, i) => 999 - 2 * i)];
    ok(insertion(shape).swaps >= (half * half) / 2 && qsort(shape).cmp >= (half * (half - 1)) / 2, `S5 problem 1 shape is quadratic for insertion and quicksort (n=${n})`);
    const ml = []; msort(up, ml); const total = ml.reduce((s, x) => s + x.c, 0); ok(total <= n * Math.ceil(Math.log2(n)), `merge sort comparisons ≤ n ⌈log n⌉ (n=${n})`);
  }
}
// facts stated in prose
ok(sp(H14.states[0]) === "9 8 6 4 7 5 2 3 1 10" && sp(H14.states[1]) === "8 7 6 4 1 5 2 3 9 10", "slide 22: first extract; second extract");
ok(sp(p12) === "2 5 7 3 6 4 1 8 9 10 11 12" && pr.meet === 2 && pr.dest === 7, "slides 18-20 partition (with 9 before 10)");
ok(sp(m8) === "1 2 3 4 5 7 8 9" && sp(lastMerge.L) === "2 5 8 9" && sp(lastMerge.R) === "1 3 4 7" && mlog.map((x) => x.c).join() === "1,1,3,1,1,3,6", "slide 8 merge sort counts");
ok(sp(r16[0]) === "800 801 401 101 901 121 512 103 323 823 113 255 555 245 18 999" && sp(r16[1]).startsWith("800 801 401 101 901 103 512 113 18 121 323 823 245 255 555 999") && sp(r16[2]) === sp(R16.slice().sort((x, y) => x - y)), "slides 34-37 radix passes");
ok(sp(r5[0]) === "170 90 802 2 24 45 75 66" && sp(r5[1]) === "802 2 24 45 66 170 75 90" && sp(r5[2]) === "2 24 45 66 75 90 170 802", "Section 5 radix table");
ok(s5lin.log.map((x) => x.at).join() === "7,9,8,0,1,2" && s5lin.del17.path.join() === "7,8,9,0,1,2,3", "S5 1a table and delete 17");
ok(s5quad.log.map((x) => x.at).join() === "7,9,8,2,1,6" && s5quad.log[5].path.join() === "7,8,1,6", "S5 1b table");
ok(s5chain[7].join() === "7,37,57" && s5chain[8].join() === "48,8" && s5chain[9].join() === "9", "S5 1c table");
{
  const A = [11, 13, 55, 67, 79, 10, 8, 6, 4, 2];
  const counts = { insertion: insertion(A).cmp, selection: selection(A).cmp, merge: (() => { const l = []; msort(A, l); return l.reduce((s, x) => s + x.c, 0); })(), quick: qsort(A).cmp };
  ok(counts.merge === 17 && counts.selection === 45 && Object.values(counts).every((c) => c >= 17) && Sim.heapSort(A).comparisons > 17, `hero: merge 17 is the fewest, selection 45 (${JSON.stringify(counts)})`);
  ok(insertion([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).cmp === 9, "hero: insertion on sorted 10 makes 9");
}
ok(sp(insertion(A6).states[0]) === "3 8 5 1 9 2" && sp(insertion(A6).states[1]) === "3 5 8 1 9 2", "insertion trace steps");
ok(sp(heapsort([3, 1, 6, 5, 2, 4], false).built) === "6 5 4 1 2 3", "buildHeap 3 1 6 5 2 4");

/* ---------------------------------------------------------------- 3. the page's keys */
const html = readFileSync(`${here}../../../site/cse332/w05/index.html`, "utf8");
const attr = (tag, name) => { const m = new RegExp(`\\s${name}='([^']*)'|\\s${name}="([^"]*)"`).exec(tag); return m ? (m[1] ?? m[2]).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") : null; };
const items = [];
let curTask = null;
for (const m of html.matchAll(/<(article class="task"|div class="check|li class="cyu|div class="answer-spec)[^>]*>/g)) {
  const tag = m[0];
  if (tag.startsWith("<article")) { curTask = attr(tag, "data-id"); continue; }
  const isPart = tag.includes("answer-spec");
  const idv = isPart ? `${curTask}.${attr(tag, "data-part")}` : attr(tag, "data-id");
  const type = attr(tag, "data-grader") || attr(tag, "data-type") || ({ num: "exact", bigo: "bigo" })[attr(tag, "data-kind")] || null;
  const end = isPart ? m.index + tag.length : html.indexOf(tag.startsWith("<li") ? "</li>" : "</div>\n    <p class=\"feedback\"", m.index);
  items.push({ id: idv, tag, type, answer: attr(tag, "data-answer"), miscon: attr(tag, "data-miscon"), points: attr(tag, "data-points"), body: html.slice(m.index, end > 0 ? end : m.index + 4000) });
}
let keys = 0, mcs = 0;
const seen = new Set();
for (const it of items) {
  ok(!seen.has(it.id), `duplicate id ${it.id}`); seen.add(it.id);
  if (!it.type || it.type === "mc" || it.type === "self") { // multiple choice: exactly one right option
    if (/class="opts"/.test(it.body)) { mcs++; ok((it.body.match(/data-correct/g) || []).length === 1, `${it.id}: exactly one correct option`); }
    else if (it.type !== "self") ok(false, `${it.id}: no type and no options`);
    continue;
  }
  keys++;
  const spec = { type: it.type, answer: it.answer, miscon: it.miscon ? JSON.parse(it.miscon) : undefined, points: it.points ? JSON.parse(it.points) : undefined, messages: {} };
  if (it.type === "choice") spec.choices = undefined;
  const want = EXPECT[it.id];
  ok(want !== undefined, `${it.id}: no expected value in verify.mjs`);
  if (want === undefined) continue;
  const g = G.grade(spec, want);
  ok(g.status === "correct", `${it.id}: expected ${want} is graded ${g.status} against key ${it.answer}`);
  if (it.type === "bigo") ok(G.relate(want, it.answer).theta && !/[+]/.test(it.answer), `${it.id}: key ${it.answer} is the simplified class`);
  if (it.type === "choice") ok(new RegExp(`(^|\\|)${want}:`).test(attr(it.tag, "data-options")), `${it.id}: ${want} is one of the options`);
  for (const wrong of Object.keys(spec.miscon || {})) ok(G.grade(spec, wrong).status !== "correct", `${it.id}: misconception ${wrong} is graded wrong`);
}
for (const k of Object.keys(EXPECT)) ok(seen.has(k), `EXPECT has ${k}, which is not on the page`);

console.log(`verify-answers: ${pass} passed, ${fail} failed (${keys} auto-graded answer keys, ${mcs} multiple-choice items)`);
process.exit(fail ? 1 : 0);
