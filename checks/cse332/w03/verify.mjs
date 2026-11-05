// Ground truth for every computed answer on site/cse332/w03/.
// 1. Independent implementations (written here, not shared with sim.js): recurrences evaluated directly with BigInt,
//    the slides' BST insert / find / delete, and AVL insert with heights recomputed from scratch and the case picked by
//    balance factors. sim.js (which the widgets run) must agree with them on the slides' trees and on random inputs.
// 2. Every recurrence's closed form is checked exactly against direct evaluation, and its Θ class is read off the
//    closed form with the exact asymptotic engine in core/grader.js.
// 3. Every auto-graded key in the page (quick checks, quiz, problem parts) must have an expected value here, be graded
//    correct, and every misconception value must be graded wrong. Multiple-choice items need exactly one right option.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const here = new URL(".", import.meta.url).pathname;
const G = require("../../../site/core/grader.js");
const Sim = require("../../../site/cse332/w03/sim.js");

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL", msg); } };

/* ---------------------------------------------------------------- 1a. recurrences, directly */
// ev: T(n) = a*T(shrink(n)) + f(n) for n > baseAt, else baseVal. BigInt throughout.
function ev(a, shrink, f, baseAt, baseVal) {
  const memo = new Map();
  const T = (n) => { if (n <= baseAt) return baseVal; if (!memo.has(n)) memo.set(n, a * T(shrink(n)) + f(n)); return memo.get(n); };
  return T;
}
const half = (n) => n / 2n, third = (n) => n / 3n, eighth = (n) => n / 8n, quarter = (n) => n / 4n, dec = (n) => n - 1n, dec2 = (n) => n - 2n;
const one = () => 1n, id = (n) => n, sq = (n) => n * n;
const lg = (n) => BigInt(n.toString(2).length - 1); // exact log2 for powers of 2
const R = {
  bsearch: ev(1n, half, one, 1n, 1n), lsearch: ev(1n, dec, one, 1n, 1n), sum: ev(2n, half, one, 1n, 1n),
  nlogn: ev(2n, half, id, 1n, 1n), sq: ev(2n, half, sq, 1n, 1n), eighth: ev(2n, eighth, one, 1n, 1n),
  s1b: ev(2n, half, id, 4n, 4n), s1c: ev(2n, half, (n) => 100n * n, 1n, 100n), s1d: ev(3n, half, id, 1n, 1n),
  s1e: ev(2n, third, id, 1n, 1n), s1f: ev(2n, dec2, one, 1n, 1n), exp: ev(2n, dec, one, 1n, 1n),
};
// closed forms, exact on the given domain; cls is the closed form in the grader's syntax (null = irrational, checked by hand)
const pow = (b, k) => b ** BigInt(k);
const CLOSED = [
  ["bsearch", (k) => [pow(2n, k), BigInt(k) + 1n], "log n + 1", "log n"],
  ["sum", (k) => [pow(2n, k), 2n * pow(2n, k) - 1n], "2n - 1", "n"],
  ["nlogn", (k) => [pow(2n, k), pow(2n, k) * BigInt(k) + pow(2n, k)], "n log n + n", "n log n"],
  ["sq", (k) => [pow(2n, k), 2n * pow(4n, k) - pow(2n, k)], "2n^2 - n", "n^2"],
  ["eighth", (k) => [pow(8n, k), 2n * pow(2n, k) - 1n], "2n^(1/3) - 1", "n^(1/3)"],
  ["s1b", (k) => [pow(2n, k), pow(2n, k) * BigInt(k) - pow(2n, k)], "n log n - n", "n log n"],
  ["s1c", (k) => [pow(2n, k), 100n * pow(2n, k) * BigInt(k) + 100n * pow(2n, k)], "100 n log n + 100 n", "n log n"],
  ["s1d", (k) => [pow(2n, k), 3n * pow(3n, k) - 2n * pow(2n, k)], null, "n^(log2 3)"], // 3^k = n^(log2 3)
  ["s1e", (k) => [pow(3n, k), 3n * pow(3n, k) - 2n * pow(2n, k)], null, "n"], // 2^k = n^(log3 2), and log3 2 < 1
  ["exp", (k) => [BigInt(k), pow(2n, k) - 1n], "2^n - 1", "2^n"],
];
for (const [key, at, clsExpr, cls] of CLOSED) {
  for (let k = key === "s1b" ? 2 : key === "exp" ? 1 : 0; k <= (key === "eighth" ? 8 : key === "s1e" ? 14 : 24); k++) {
    const [n, want] = at(k);
    ok(R[key](n) === want, `${key}: closed form at n=${n}: ${R[key](n)} vs ${want}`);
    ok(Sim.evalRec(Sim.REC[key], n) === want, `sim.evalRec ${key} n=${n}`);
    ok(Sim.levelSum(Sim.REC[key], n) === want, `sim levels sum ${key} n=${n}`);
  }
  if (clsExpr) ok(G.relate(clsExpr, cls).theta, `${key}: ${clsExpr} is Θ(${cls})`);
}
// 1f: T(n) = 2^(floor(n/2) + 1) - 1 for n >= 0 (the widget states this form)
for (let n = 0n; n <= 60n; n++) ok(R.s1f(n) === pow(2n, n / 2n + 1n) - 1n && Sim.evalRec(Sim.REC.s1f, n) === R.s1f(n), `s1f closed form n=${n}`);
// linear search: T(n) = n
for (let n = 1n; n <= 50n; n++) ok(R.lsearch(n) === n && Sim.evalRec(Sim.REC.lsearch, n) === n, `lsearch n=${n}`);
// slide 23 and "what matters": representative f, closed forms checked, classes compared
{
  const lin = ev(1n, dec, id, 1n, 1n);                 // T(n-1) + n
  const halfLin = ev(1n, half, id, 1n, 1n);            // T(n/2) + n
  const fourHalf = ev(4n, half, id, 1n, 1n);           // 4T(n/2) + n
  const twoQuarter = ev(2n, quarter, id, 1n, 1n);      // 2T(n/4) + n
  const base1000 = ev(2n, half, id, 1n, 1000n);        // 2T(n/2) + n, T(1) = 1000
  const f5n20 = ev(2n, half, (n) => 5n * n + 20n, 1n, 1n);
  for (let k = 0; k <= 20; k++) {
    const n = pow(2n, k), m = pow(4n, k);
    if (k <= 12) ok(lin(n) === n * (n + 1n) / 2n, `T(n-1)+n = n(n+1)/2 at ${n}`);
    ok(halfLin(n) === 2n * n - 1n, `T(n/2)+n = 2n-1 at ${n}`);
    ok(fourHalf(n) === 2n * n * n - n, `4T(n/2)+n = 2n^2-n at ${n}`);
    ok(twoQuarter(m) === 2n * m - pow(2n, k), `2T(n/4)+n = 2n - sqrt n at ${m}`);
    ok(base1000(n) === n * BigInt(k) + 1000n * n, `T(1)=1000: n log n + 1000n at ${n}`);
    ok(f5n20(n) === 5n * n * BigInt(k) + 21n * n - 20n, `f=5n+20: 5n log n + 21n - 20 at ${n}`);
  }
  const theta = (a, b) => G.relate(a, b).theta;
  ok(theta("n(n+1)/2", "n^2") && theta("2n-1", "n") && theta("2n^2-n", "n^2") && theta("2n - n^(1/2)", "n") && theta("n log n + 1000 n", "n log n") && theta("5 n log n + 21 n - 20", "n log n"), "slide-23 / what-matters classes");
  ok(!theta("2n^2-n", "n log n") && !theta("2n - n^(1/2)", "n log n"), "a and b changes really change the class");
}
// irrational classes, by hand: n^(log2 3) has exponent strictly between 1 and 2; sqrt(2)^n is strictly between n^k and 2^n
ok(Math.log2(3) > 1.58 && Math.log2(3) < 1.59 && Math.log(2) / Math.log(3) < 1, "log2 3 ≈ 1.585; log3 2 < 1");

/* ---------------------------------------------------------------- 1b. BST and AVL, independently */
// trees as nested arrays [key, left, right] (null = empty)
const ins = (t, k) => (!t ? [k, null, null] : k === t[0] ? t : k < t[0] ? [t[0], ins(t[1], k), t[2]] : [t[0], t[1], ins(t[2], k)]);
const hgt = (t) => (!t ? -1 : 1 + Math.max(hgt(t[1]), hgt(t[2])));
const str = (t) => (!t ? "" : !t[1] && !t[2] ? String(t[0]) : `${t[0]}(${str(t[1])},${str(t[2])})`);
const pre = (t) => (!t ? [] : [t[0], ...pre(t[1]), ...pre(t[2])]);
const ino = (t) => (!t ? [] : [...ino(t[1]), t[0], ...ino(t[2])]);
const post = (t) => (!t ? [] : [...post(t[1]), ...post(t[2]), t[0]]);
const fromKeys = (ks) => ks.reduce(ins, null);
const findPath = (t, k) => { const p = []; while (t) { p.push(t[0]); if (k === t[0]) return { p, found: true }; t = k < t[0] ? t[1] : t[2]; } return { p, found: false }; };
const parentOf = (t, k) => { let par = null; while (t && t[0] !== k) { par = t[0]; t = k < t[0] ? t[1] : t[2]; } return par; };
const maxKey = (t) => (t[2] ? maxKey(t[2]) : t[0]);
function del(t, k) { // returns [tree, children-count, replacement]
  if (!t) return [null, null, null];
  if (k < t[0]) { const [l, c, r] = del(t[1], k); return [[t[0], l, t[2]], c, r]; }
  if (k > t[0]) { const [rr, c, r] = del(t[2], k); return [[t[0], t[1], rr], c, r]; }
  const kids = (t[1] ? 1 : 0) + (t[2] ? 1 : 0);
  if (kids === 0) return [null, 0, null];
  if (kids === 1) { const c = t[1] || t[2]; return [c, 1, c[0]]; }
  const m = maxKey(t[1]);
  return [[m, del(t[1], m)[0], t[2]], 2, m];
}
const parse = (s) => { const t = Sim.parseShape(s); const conv = (n) => (n ? [n.key, conv(n.left), conv(n.right)] : null); return conv(t); };
const bal = (t) => hgt(t[1]) - hgt(t[2]);
const unb = (t) => Math.abs(bal(t)) > 1;
const rotR = (t) => [t[1][0], t[1][1], [t[0], t[1][2], t[2]]];
const rotL = (t) => [t[2][0], [t[0], t[1], t[2][1]], t[2][2]];
// AVL insert, textbook style: rebalance on the way up using balance factors (insert-only, so no ties at the child)
function avl(t, k, log) {
  if (!t) return [k, null, null];
  if (k === t[0]) return t;
  t = k < t[0] ? [t[0], avl(t[1], k, log), t[2]] : [t[0], t[1], avl(t[2], k, log)];
  const b = bal(t);
  if (b > 1) { if (bal(t[1]) > 0) { log.push(["LL", t[0]]); return rotR(t); } log.push(["LR", t[0]]); return rotR([t[0], rotL(t[1]), t[2]]); }
  if (b < -1) { if (bal(t[2]) < 0) { log.push(["RR", t[0]]); return rotL(t); } log.push(["RL", t[0]]); return rotL([t[0], t[1], rotR(t[2])]); }
  return t;
}
const avlKeys = (ks) => { const log = []; const t = ks.reduce((x, k) => avl(x, k, log), null); return { t, log }; };
const isAvl = (t) => !t || (!unb(t) && isAvl(t[1]) && isAvl(t[2]));
const isBst = (t, lo = -Infinity, hi = Infinity) => !t || (t[0] > lo && t[0] < hi && isBst(t[1], lo, t[0]) && isBst(t[2], t[0], hi));
// unbalanced nodes after a plain BST insert, deepest first
function problems(t) { const out = []; const w = (x, d) => { if (!x) return; w(x[1], d + 1); w(x[2], d + 1); if (unb(x)) out.push([x[0], d]); }; w(t, 0); return out.sort((a, b) => b[1] - a[1]).map((x) => x[0]); }
const nodeH = (t, k) => { while (t[0] !== k) t = k < t[0] ? t[1] : t[2]; return hgt(t); };

// sim.js vs these, on the slides' trees and on random sequences
{
  let seed = 332;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let trial = 0; trial < 400; trial++) {
    const ks = Array.from({ length: 1 + Math.floor(rnd() * 14) }, () => Math.floor(rnd() * 40) - 5);
    const mine = fromKeys(ks), sim = Sim.build(ks);
    ok(str(mine) === Sim.shape(sim) && hgt(mine) === Sim.height(sim), `bst build ${ks}`);
    const k = ks[Math.floor(rnd() * ks.length)];
    const [dt, dc, dr] = del(fromKeys(ks), k), sd = Sim.bstDelete(Sim.build(ks), k);
    ok(str(dt) === Sim.shape(sd.root) && dc === sd.case && (dr ?? null) === sd.replacement, `bst delete ${k} from ${ks}`);
    const { t, log } = avlKeys(ks);
    let st = null; const slog = [];
    for (const x of ks) { const r = Sim.avlInsert(st, x); st = r.root; if (r.case) slog.push([r.case, r.problem]); }
    ok(str(t) === Sim.shape(st) && isAvl(t) && isBst(t) && JSON.stringify(log) === JSON.stringify(slog), `avl ${ks}: ${str(t)} vs ${Sim.shape(st)}`);
    ok(Sim.isAVL(Sim.clone(st)) && Sim.isBST(st), `sim avl invariants ${ks}`);
  }
}

/* L6 ---------------------------------------------------------- Lecture 6: the lecture's code, run and instrumented */
// sum_helper (divide and conquer) and the course's chip-and-conquer sum, each frame recorded as { depth, size, calls, adds }.
function sumHelper(list, low, high, depth, frames) {
  const f = { depth, size: high - low, calls: 0, adds: 0 };
  frames.push(f);
  if (low === high) return 0;
  if (low === high - 1) return list[low];
  const middle = Math.floor((high + low) / 2);
  f.calls = 2; f.adds = 1;
  return sumHelper(list, low, middle, depth + 1, frames) + sumHelper(list, middle, high, depth + 1, frames);
}
function chipHelper(list, low, high, frames, depth = 0) {
  const f = { depth, size: high - low, calls: 0, adds: 0, child: null };
  frames.push(f);
  if (low === high) return 0;
  if (low === high - 1) return list[low];
  f.calls = 1; f.adds = 1; f.child = high - (low + 1);
  return list[low] + chipHelper(list, low + 1, high, frames, depth + 1);
}
const L6 = (() => {
  // tree levels by brute force: expand every call of T(n) = a·T(n/b) + f(n) (or n − b), grouped by depth
  function bruteLevels(a, shrink, f, n, baseAt = 1n, baseVal = 1n) {
    const out = [];
    let row = [n];
    while (row.length) {
      const size = row[0];
      ok(row.every((x) => x === size), "all calls on one level have the same size");
      const leaf = size <= baseAt, each = leaf ? baseVal : f(size);
      out.push({ calls: BigInt(row.length), size, each, total: BigInt(row.length) * each, leaf });
      row = leaf ? [] : row.flatMap((x) => Array.from({ length: Number(a) }, () => shrink(x)));
    }
    return out;
  }
  const levelCalls = (a, i) => bruteLevels(a, half, id, 16n)[i].calls;
  const chipLevels = (n) => bruteLevels(1n, dec, one, n).length;
  const linN = ev(1n, dec, id, 1n, 1n);
  const sq8 = bruteLevels(2n, half, sq, 8n);
  const shape = (a, b) => { const w = bruteLevels(a, (x) => x / b, id, 256n).filter((l) => !l.leaf).map((l) => l.total); return w.every((x, i) => !i || x > w[i - 1]) ? "grows" : w.every((x, i) => !i || x === w[i - 1]) ? "same" : w.every((x, i) => !i || x < w[i - 1]) ? "shrinks" : "?"; };
  const frames = []; const list = Array.from({ length: 8 }, (_, i) => i + 1);
  ok(chipHelper(list, 0, 8, frames) === 36, "chip sum_helper sums the list");
  const inner = frames.filter((f) => f.calls);
  const chipSum = { calls: inner[0].calls, shrink: inner[0].size - inner[0].child, adds: inner[0].adds };
  ok(inner.every((f) => f.calls === chipSum.calls && f.size - f.child === chipSum.shrink && f.adds === chipSum.adds) && frames.length === 8, "chip sum_helper: one call on n − 1, one addition, n frames");
  return { bruteLevels, levelCalls, chipLevels, linN, sq8, shape, chipSum };
})();
// the tree-method stepper (l6-tree): sum_helper on 16 items, run for real
{
  const frames = [], list = Array.from({ length: 16 }, (_, i) => 3 * i + 1);
  ok(sumHelper(list, 0, 16, 0, frames) === list.reduce((x, y) => x + y, 0), "sum_helper sums the list");
  const byDepth = [];
  for (const f of frames) (byDepth[f.depth] ||= []).push(f);
  // one unit of work per call, as on the lecture's tree (inner calls: the +; leaves: T(1) = 1)
  const real = byDepth.map((fs) => ({ calls: fs.length, size: fs[0].size, same: fs.every((f) => f.size === fs[0].size), total: fs.length }));
  ok(real.every((r) => r.same) && real.map((r) => r.calls).join() === "1,2,4,8,16" && real.map((r) => r.size).join() === "16,8,4,2,1", "sum_helper's real calls by level");
  const st = Sim.treeSteps(Sim.REC.sum, 16);
  ok(st.steps.length === real.length + 1 && st.sum === R.sum(16n) && Number(st.sum) === frames.length, `stepper: ${real.length} levels + the sum; T(16) = ${frames.length} calls`);
  st.steps.forEach((say, i) => {
    for (const m of say.matchAll(/(\d+) × (\d+) = (\d+)/g)) ok(+m[1] * +m[2] === +m[3], `step ${i}: ${m[0]}`);
    for (const m of say.matchAll(/(\d+)\/(\d+) = (\d+)/g)) ok(+m[1] / +m[2] === +m[3], `step ${i}: ${m[0]}`);
    for (const m of say.matchAll(/((?:\d+ \+ )+\d+) = (\d+)/g)) ok(m[1].split(" + ").reduce((x, y) => x + +y, 0) === +m[2], `step ${i}: ${m[0]}`);
    if (i < real.length) {
      const r = real[i];
      ok(new RegExp(`^Level ${i}\\b`).test(say), `step ${i} names level ${i}`);
      ok(say.includes(i === 0 ? `1 call on n = ${r.size}` : `= ${r.calls} calls, each on ${real[i - 1].size}/2 = ${r.size}.`), `step ${i}: ${r.calls} calls of size ${r.size}: ${say}`);
      ok(say.endsWith(`Level work: ${r.calls} × 1 = ${r.total}.`), `step ${i}: level work ${r.total}: ${say}`);
      ok(r.size === 1 ? say.includes("the base case, T(1) = 1") : say.includes("Work per call: 1."), `step ${i}: work per call`);
    } else ok(say === `Add the levels: ${real.map((r) => r.total).join(" + ")} = ${frames.length}. So T(16) = ${frames.length}.`, `last step: ${say}`);
  });
  // the stepper's table rows are Sim.levels; they must match the real calls
  ok(JSON.stringify(st.levels.map((l) => [l.nodes, l.size, l.total].map(Number))) === JSON.stringify(real.map((r) => [r.calls, r.size, r.total])), "stepper table rows = real calls");
  // level bars on l6-series: Sim.levels vs brute force, for the three shapes at n = 16
  for (const [k, f] of [["sum", one], ["nlogn", id], ["sq", sq]]) ok(Sim.levels(Sim.REC[k], 16).map((l) => l.total).join() === L6.bruteLevels(2n, half, f, 16n).map((l) => l.total).join(), `level bars ${k}`);
  ok(L6.bruteLevels(2n, half, sq, 16n).map((l) => l.total).join() === "256,128,64,32,16" && R.sq(16n) === 496n && R.nlogn(16n) === 80n && R.sum(16n) === 31n, "series page: 496, 80, 31");
  // 3T(n/3) + n = n log3 n + n; T(n/2) + n = 2n − 1; T(n−1) + n = n(n+1)/2
  const t33 = ev(3n, third, id, 1n, 1n);
  for (let k = 0; k <= 12; k++) ok(t33(3n ** BigInt(k)) === 3n ** BigInt(k) * BigInt(k + 1), `3T(n/3)+n at 3^${k}`);
  ok(G.relate("n log n + n", "n log n").theta, "3T(n/3)+n is Θ(n log n)");
  ok(L6.shape(2n, 2n) === "same" && L6.shape(4n, 2n) === "grows" && L6.shape(2n, 4n) === "shrinks", "level work: 2T(n/2)+n same, 4T(n/2)+n grows, 2T(n/4)+n shrinks");
  ok(L6.sq8.map((l) => `${l.calls}/${l.size}/${l.each}/${l.total}`).join(" ") === "1/8/64/64 2/4/16/32 4/2/4/16 8/1/1/8", "sq table at n = 8");
  ok(L6.bruteLevels(2n, eighth, one, 512n).map((l) => l.size).join() === "512,64,8,1" && L6.bruteLevels(2n, eighth, one, 512n).at(-1).calls === 8n, "2T(n/8)+1 at 512: sizes and 8 leaves");
}

/* ---------------------------------------------------------------- 2. expected values for every key */
const S22 = "9(3(1(0,),6(5,7)),10(,16))", S12 = "7(3(1(0,2),6),10(8,16))", S30 = "9(3(1(0,2),6(,7)),11(,16))", S39 = "9(3(1(0,2),6),11(10,16(,18)))";
const sp = (a) => a.join(" ");
ok(str(fromKeys([7, 3, 10, 1, 6, 8, 16, 0, 2])) === S12 && str(fromKeys([9, 3, 10, 1, 6, 16, 0, 5, 7])) === S22, "slide 12 and 22 trees from their keys");
const d3 = (() => { let t = parse(S22); const out = []; for (const k of [5, 1, 3]) { const [nt, c, r] = del(t, k); out.push([c, r]); t = nt; } return { t, out }; })();
const minus1 = (() => { const t = ins(parse(S30), -1); const log = []; const r = avl(parse(S30), -1, log); return { h9: hgt(t), probs: problems(t), log, r }; })();
const plus20 = (() => { const t = ins(parse(S39), 20); const log = []; const r = avl(parse(S39), 20, log); return { probs: problems(t), log, r }; })();
const plus10 = (() => { const log = []; avl(parse(S30), 10, log); return log; })();
const seqA = avlKeys([10, 20, 30, 25, 28, 27]), seq7 = avlKeys([1, 2, 3, 4, 5, 6, 7]);
const caseOf = (ks) => avlKeys(ks).log.map((x) => x[0]).join(",");
const M = (h) => (h === 0 ? 1 : h === 1 ? 2 : M(h - 1) + M(h - 2) + 1);
const maxH = (n) => { let h = 0; while (M(h + 1) <= n) h++; return h; };
const treeCheck = { P: parse("20(10(5,15(12,25)),30)"), Q: parse("20(10(5,15(12,18)),30(,40))"), R: parse("5(,8(,13(11,21)))"), X: parse("5(2(1,4(3,)),8(,9))"), Y: parse("5(2(1,4(3,)),8(,9(,10)))") };
const dusb = ["D", ["U", ["S", null, null], ["2", null, null]], ["B", null, null]];
const yn = (b) => (b ? "yes" : "no");
const lvl = (key, n, i) => Sim.levels(Sim.REC[key], n)[i].total; // used only to cross-check formula answers below

const EXPECT = {
  // Lecture 6
  "cse332-w3-l6-cyu-level3": String(L6.levelCalls(3n, 3)), "cse332-w3-l6-qc-chip-levels": String(L6.chipLevels(10n)),
  "cse332-w3-l6-qc-3n3": "n log n",
  "cse332-w3-l6-chip-sum.a": String(L6.chipSum.calls), "cse332-w3-l6-chip-sum.size": L6.chipSum.shrink === 1 ? "minus1" : "?", "cse332-w3-l6-chip-sum.f": String(L6.chipSum.adds), "cse332-w3-l6-chip-sum.class": "n",
  "cse332-w3-l6-sq-table.calls1": String(L6.sq8[1].calls), "cse332-w3-l6-sq-table.size1": String(L6.sq8[1].size), "cse332-w3-l6-sq-table.each1": String(L6.sq8[1].each),
  "cse332-w3-l6-sq-table.level1": String(L6.sq8[1].total), "cse332-w3-l6-sq-table.level": "n^2/2^i", "cse332-w3-l6-sq-table.t8": String(R.sq(8n)),
  "cse332-w3-l6-eighth.levels": String(Sim.levels(Sim.REC.eighth, 512).length), "cse332-w3-l6-eighth.t512": String(R.eighth(512n)), "cse332-w3-l6-eighth.class": "n^(1/3)",
  "cse332-w3-l6-chip-tree.level": "n-i", "cse332-w3-l6-chip-tree.levels5": String(L6.chipLevels(5n)), "cse332-w3-l6-chip-tree.t5": String(L6.linN(5n)), "cse332-w3-l6-chip-tree.class": "n^2",
  "cse332-w3-l6-change-one.base": "n log n", "cse332-w3-l6-change-one.f": "n log n", "cse332-w3-l6-change-one.a-shape": L6.shape(4n, 2n), "cse332-w3-l6-change-one.a": "n^2",
  "cse332-w3-l6-change-one.b-shape": L6.shape(2n, 4n), "cse332-w3-l6-change-one.b": "n",
  "cse332-w3-l6-recognize.log": "log n", "cse332-w3-l6-recognize.lin": "n", "cse332-w3-l6-recognize.exp": "2^n", "cse332-w3-l6-recognize.halfn": "n",
  // Lecture 7
  "cse332-w3-l7-qc-sorted-find": "log n",
  "cse332-w3-l7-qc-inorder-dusb": ino(dusb).join(" "),
  "cse332-w3-l7-qc-max-nodes-h3": String(2 ** 4 - 1),
  "cse332-w3-l7-qc-delete3": String(del(parse(S22), 3)[2]),
  "cse332-w3-l7-qc-sorted-height": String(hgt(fromKeys([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))),
  "cse332-w3-l7-traversals.pre": sp(pre(parse(S12))), "cse332-w3-l7-traversals.in": sp(ino(parse(S12))), "cse332-w3-l7-traversals.post": sp(post(parse(S12))),
  "cse332-w3-l7-build.height": String(hgt(parse(S22))), "cse332-w3-l7-build.parent5": String(parentOf(parse(S22), 5)),
  "cse332-w3-l7-build.path8": sp(findPath(parse(S22), 8).p), "cse332-w3-l7-build.found8": yn(findPath(parse(S22), 8).found),
  "cse332-w3-l7-delete.case5": String(d3.out[0][0]), "cse332-w3-l7-delete.case1": String(d3.out[1][0]), "cse332-w3-l7-delete.repl3": String(d3.out[2][1]), "cse332-w3-l7-delete.pre": sp(pre(d3.t)),
  "cse332-w3-l7-numbers.maxleaves": String(2 ** 5), "cse332-w3-l7-numbers.maxnodes": String(2 ** 6 - 1), "cse332-w3-l7-numbers.minleaves": "1", "cse332-w3-l7-numbers.minnodes": String(hgt(fromKeys([1, 2, 3, 4, 5, 6])) + 1),
  "cse332-w3-l7-naive.unsorted-insert": "n", "cse332-w3-l7-naive.sorted-find": "log n", "cse332-w3-l7-naive.sorted-insert": "n", "cse332-w3-l7-naive.bst-find": "n",
  "cse332-w3-l7-is-bst.p": yn(isBst(treeCheck.P)), "cse332-w3-l7-is-bst.q": yn(isBst(treeCheck.Q)), "cse332-w3-l7-is-bst.r": yn(isBst(treeCheck.R)),
  "cse332-w3-l7-cyu-bst-worst": "n", "cse332-w3-l7-cyu-preorder": pre(dusb).join(" "), "cse332-w3-l7-cyu-min-nodes": String(hgt(fromKeys([1, 2, 3, 4, 5, 6, 7])) + 1),
  "cse332-w3-l7-cyu-max-leaves": String(2 ** 4), "cse332-w3-l7-cyu-delete-root": String(del(parse(S22), 9)[0][0]),
  // Section 3
  "cse332-w3-s3-qc-0b-calls": "2", "cse332-w3-s3-qc-1e": "n",
  "cse332-w3-s3-q0a.a": "1", "cse332-w3-s3-q0a.b": "1", "cse332-w3-s3-q0a.class": "n",
  "cse332-w3-s3-q0b.a": "2", "cse332-w3-s3-q0b.b": "3", "cse332-w3-s3-q0b.nsq": "no", "cse332-w3-s3-q0b.class": "n",
  "cse332-w3-s3-q1abc.level1a": "n", "cse332-w3-s3-q1abc.t16b": String(R.s1b(16n)), "cse332-w3-s3-q1abc.t16c": String(R.s1c(16n)), "cse332-w3-s3-q1abc.class": "n log n",
  "cse332-w3-s3-q1d.nodes": "3^i", "cse332-w3-s3-q1d.level": "(3/2)^i*n", "cse332-w3-s3-q1d.t16": String(R.s1d(16n)), "cse332-w3-s3-q1d.class": "c",
  "cse332-w3-s3-q1e.level": "(2/3)^i*n", "cse332-w3-s3-q1e.t81": String(R.s1e(81n)), "cse332-w3-s3-q1e.class": "n",
  "cse332-w3-s3-q1f.nodes": "2^i", "cse332-w3-s3-q1f.t10": String(R.s1f(10n)), "cse332-w3-s3-q1f.class": "c", "cse332-w3-s3-q1f.t10minus1": String(R.exp(10n)),
  "cse332-w3-s3-q2.a": "2", "cse332-w3-s3-q2.b": "2", "cse332-w3-s3-q2.f": "n", "cse332-w3-s3-q2.class": "n log n",
  "cse332-w3-s3-cyu-1e": "n", "cse332-w3-s3-cyu-1b": "n log n", "cse332-w3-s3-cyu-1f-level": String(2 ** 4), "cse332-w3-s3-cyu-1c": "n log n",
  // Lecture 8
  "cse332-w3-l8-qc-tree-c": String(problems(parse("9(3(,6(5,)),10(,16))"))[0]),
  "cse332-w3-l8-qc-root-height-d": String(hgt(parse("9(3(1(0,),6(5,7)),10(,16))"))),
  "cse332-w3-l8-qc-root-after-minus1": String(minus1.r[0]),
  "cse332-w3-l8-qc-root-385": String(avlKeys([3, 8, 5]).t[0]),
  "cse332-w3-l8-qc-m4": String(M(4)), "cse332-w3-l8-qc-maxh-20": String(maxH(20)),
  "cse332-w3-l8-is-avl.x": yn(isAvl(treeCheck.X)), "cse332-w3-l8-is-avl.y": yn(isAvl(treeCheck.Y)), "cse332-w3-l8-is-avl.problem": String(problems(treeCheck.Y)[0]),
  "cse332-w3-l8-single.case123": caseOf([1, 2, 3]).toLowerCase(), "cse332-w3-l8-single.root123": String(avlKeys([1, 2, 3]).t[0]),
  "cse332-w3-l8-single.case321": caseOf([3, 2, 1]).toLowerCase(), "cse332-w3-l8-single.root321": String(avlKeys([3, 2, 1]).t[0]),
  "cse332-w3-l8-minus1.h9": String(minus1.h9), "cse332-w3-l8-minus1.problem": String(minus1.probs[0]), "cse332-w3-l8-minus1.case": minus1.log[0][0].toLowerCase(), "cse332-w3-l8-minus1.pre": sp(pre(minus1.r)),
  "cse332-w3-l8-insert20.deep": String(plus20.probs[0]), "cse332-w3-l8-insert20.case": plus20.log[0][0].toLowerCase(), "cse332-w3-l8-insert20.pre": sp(pre(plus20.r)),
  "cse332-w3-l8-double.case28": seqA.log[1][0].toLowerCase(), "cse332-w3-l8-double.case27": seqA.log[2][0].toLowerCase(), "cse332-w3-l8-double.root": String(seqA.t[0]), "cse332-w3-l8-double.pre": sp(pre(seqA.t)),
  "cse332-w3-l8-sorted.rotations": String(seq7.log.length), "cse332-w3-l8-sorted.pre": sp(pre(seq7.t)), "cse332-w3-l8-sorted.m6": String(M(6)), "cse332-w3-l8-sorted.maxh50": String(maxH(50)),
  "cse332-w3-l8-cyu-leaf-height": "0", "cse332-w3-l8-cyu-root-123": String(avlKeys([1, 2, 3]).t[0]), "cse332-w3-l8-cyu-m5": String(M(5)), "cse332-w3-l8-cyu-find": "log n",
};
// facts the expectations above rely on
ok(minus1.probs.length === 1 && plus20.probs.join() === "16,11" && plus10.length === 0, "slide 31/33/40: problem nodes (none for 10; 9 for -1; 16 and 11 for 20)");
ok(seqA.log.map((x) => x.join("@")).join(" ") === "RR@10 LR@30 RL@20" && seq7.log.every((x) => x[0] === "RR"), "sequence cases");
ok(caseOf([9, 5, 7]) === "LR" && str(avlKeys([9, 5, 7]).t) === "7(5,9)" && caseOf([3, 8, 5]) === "RL", "slide 48 LR; 3,8,5 RL");
ok(str(minus1.r) === "3(1(0(-1,),2),9(6(,7),11(,16)))" && str(plus20.r) === "9(3(1(0,2),6),11(10,18(16,20)))", "slide 35 and 42 results");
ok(["9(3(1(0,),6(5,)),10)", "9(3(1(0,),6(5,)),10(,16))", "9(3(,6(5,)),10(,16))", "9(3(1(0,),6(5,7)),10(,16))"].map((s) => isAvl(parse(s))).join() === "false,true,false,true", "slide 27: A-D");
ok(["7(3(1(0,),),10(,16))", "7(3(1(0,),7),10(,16))", "7(3(1(0,),8),10(,16))", "16(10(7(3(1(0,),),),),)"].map((s) => isBst(parse(s))).join() === "true,false,false,true", "slide 14: are these BSTs");
// formula answers agree with the actual level totals
for (const [k, ex, pts] of [["sq", "n^2/2^i", [[64, 0], [64, 3], [1024, 1]]], ["s1d", "(3/2)^i*n", [[16, 0], [16, 3], [64, 1]]], ["s1e", "(2/3)^i*n", [[27, 0], [81, 2]]], ["nlogn", "n", [[16, 2], [1024, 5]]]]) {
  for (const [n, i] of pts) ok(G.eq(G.evalExact(ex, { n: G.Q(BigInt(n)), i: G.Q(BigInt(i)) }), G.Q(lvl(k, n, i))), `${k}: level ${i} at n=${n} is ${ex}`);
}
for (const [k, a] of [["sum", 2], ["s1d", 3], ["s1f", 2]]) Sim.levels(Sim.REC[k], k === "s1f" ? 12 : 16).forEach((l) => ok(l.nodes === BigInt(a) ** BigInt(l.i), `${k}: ${a}^i boxes on level ${l.i}`));

/* ---------------------------------------------------------------- 3. the page's keys */
const html = readFileSync(`${here}../../../site/cse332/w03/index.html`, "utf8");
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
// the two choice keys whose class is irrational: the option text names the class the closed form has
ok(/2\^\{\\\\lfloor n\/2\\\\rfloor \+ 1\}/.test(readFileSync(`${here}../../../site/cse332/w03/week.js`, "utf8")) && /c:Θ\(n\^\(log₂3\)\)/.test(html) && /c:Θ\(√2\^n\)/.test(html), "1d and 1f menus name n^(log2 3) and √2^n as option c");

/* ---------------------------------------------------------------- 4. numbers stated in prose */
const text = html.replace(/\s+/g, " ");
const has = (s, why) => ok(text.includes(s), `page states "${s}" (${why})`);
has("\\(M(h)\\)</th><td>1</td><td>2</td><td>4</td><td>7</td><td>12</td><td>20</td><td>33</td><td>54</td><td>88</td><td>143</td><td>232</td>", "M(h) row");
ok([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(M).join() === "1,2,4,7,12,20,33,54,88,143,232" && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(Sim.minAVL).join() === "1,2,4,7,12,20,33,54,88,143,232", "M(h) values (both implementations)");
has("<td>1</td><td>3</td><td>7</td><td>15</td><td>31</td><td>63</td><td>127</td><td>255</td><td>511</td><td>1023</td><td>2047</td>", "2^(h+1)-1 row");
has("\\(T(2) = 5\\), \\(T(4) = 19\\), \\(T(8) = 65\\)", "1d steps"); ok(R.s1d(2n) === 5n && R.s1d(4n) === 19n && R.s1d(8n) === 65n, "1d T(2..8)");
has("\\(T(3) = 5\\), \\(T(9) = 19\\), \\(T(27) = 65\\)", "1e steps"); ok(R.s1e(3n) === 5n && R.s1e(9n) === 19n && R.s1e(27n) === 65n, "1e T(3..27)");
has("\\(T(2) = 400\\), \\(T(4) = 1200\\), \\(T(8) = 3200\\)", "1c steps"); ok(R.s1c(2n) === 400n && R.s1c(4n) === 1200n && R.s1c(8n) === 3200n, "1c T(2..8)");
has("\\(T(8) = 16\\), \\(T(16) = 32 + 16 = 48\\)", "1b steps"); ok(R.s1b(8n) === 16n, "1b T(8)");
/* L6 */
has("\\(1 + 2 + 4 + 8 + 16 = 31\\)", "series: grows"); has("\\(16 \\times 5 = 80\\)", "series: same"); has("\\(256 + 128 + 64 + 32 + 16 = 496\\)", "series: shrinks");
has("\\(T(8) = 64 + 32 + 16 + 8 = 120\\)", "sq table sum"); has("\\(1 + 2 + 4 + 8 = 15\\)", "eighth sum"); has("\\(5 + 4 + 3 + 2 + 1 = 15\\)", "chip tree sum");
has("at \\(n = 16\\): \\(31\\)", "tree page sum"); has("\\(8 = 512^{1/3}\\)", "eighth leaves");
ok(R.sum(16n) === 31n && R.eighth(512n) === 15n && L6.linN(5n) === 15n && R.sq(8n) === 120n, "L6 prose numbers");
// the delete-3-first quick check really differs from the sequence answer
ok(del(parse(S22), 3)[2] === 1 && d3.out[2][1] === 0, "deleting 3 first pulls up 1; after deleting 1 it pulls up 0");

console.log(`verify-answers: ${pass} passed, ${fail} failed (${keys} auto-graded answer keys, ${mcs} multiple-choice items)`);
process.exit(fail ? 1 : 0);
