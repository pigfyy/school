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
const half = (n) => n / 2n, third = (n) => n / 3n, eighth = (n) => n / 8n, quarter = (n) => n / 4n, dec = (n) => n - 1n;
const one = () => 1n, id = (n) => n, sq = (n) => n * n;
const lg = (n) => BigInt(n.toString(2).length - 1); // exact log2 for powers of 2
const R = {
  bsearch: ev(1n, half, one, 1n, 1n), lsearch: ev(1n, dec, one, 1n, 1n), sum: ev(2n, half, one, 1n, 1n),
  nlogn: ev(2n, half, id, 1n, 1n), sq: ev(2n, half, sq, 1n, 1n), eighth: ev(2n, eighth, one, 1n, 1n),
  exp: ev(2n, dec, one, 1n, 1n),
};
// closed forms, exact on the given domain; cls is the closed form in the grader's syntax (null = irrational, checked by hand)
const pow = (b, k) => b ** BigInt(k);
const CLOSED = [
  ["bsearch", (k) => [pow(2n, k), BigInt(k) + 1n], "log n + 1", "log n"],
  ["sum", (k) => [pow(2n, k), 2n * pow(2n, k) - 1n], "2n - 1", "n"],
  ["nlogn", (k) => [pow(2n, k), pow(2n, k) * BigInt(k) + pow(2n, k)], "n log n + n", "n log n"],
  ["sq", (k) => [pow(2n, k), 2n * pow(4n, k) - pow(2n, k)], "2n^2 - n", "n^2"],
  ["eighth", (k) => [pow(8n, k), 2n * pow(2n, k) - 1n], "2n^(1/3) - 1", "n^(1/3)"],
  ["exp", (k) => [BigInt(k), pow(2n, k) - 1n], "2^n - 1", "2^n"],
];
for (const [key, at, clsExpr, cls] of CLOSED) {
  for (let k = key === "exp" ? 1 : 0; k <= (key === "eighth" ? 8 : 24); k++) {
    const [n, want] = at(k);
    ok(R[key](n) === want, `${key}: closed form at n=${n}: ${R[key](n)} vs ${want}`);
    ok(Sim.evalRec(Sim.REC[key], n) === want, `sim.evalRec ${key} n=${n}`);
    ok(Sim.levelSum(Sim.REC[key], n) === want, `sim levels sum ${key} n=${n}`);
  }
  if (clsExpr) ok(G.relate(clsExpr, cls).theta, `${key}: ${clsExpr} is Θ(${cls})`);
}
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
const S7 = "7(3(1(0,),6),10(,16))", K22 = [9, 3, 10, 1, 6, 16, 0, 5, 7], K17 = [1, 2, 3, 4, 5, 6, 7], K4261 = [4, 2, 6, 1, 3, 5, 7];
ok(str(fromKeys([7, 3, 10, 1, 16, 0, 6])) === S7 && str(fromKeys(K22)) === S22, "the find/insert tree and the delete tree from the lecture's keys");
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

/* L8 */
// One AVL insert as whole-tree states, worked out here on the array trees: the BST insert, then the tree after each
// rotation at the first unbalanced node on the path back up. cmp is the node each picture circles: the new key, then
// whichever node a rotation lifted.
const sub = (t, k) => (t[0] === k ? t : sub(k < t[0] ? t[1] : t[2], k));
const replaceAt = (t, k, f) => (t[0] === k ? f(t) : k < t[0] ? [t[0], replaceAt(t[1], k, f), t[2]] : [t[0], t[1], replaceAt(t[2], k, f)]);
function avlTrace(t, k) {
  const t0 = ins(t, k), states = [{ t: t0, cmp: k, bst: true }];
  const path = [];
  for (let x = t0; x[0] !== k; x = k < x[0] ? x[1] : x[2]) path.push(x[0]);
  const at = [...path].reverse().find((key) => unb(sub(t0, key)));
  if (at === undefined) return { states, kase: "none", path, at: null };
  const a = sub(t0, at), d1 = k < at ? "L" : "R", c1 = d1 === "L" ? a[1] : a[2], d2 = k < c1[0] ? "L" : "R", kase = d1 + d2;
  if (kase === "LL") states.push({ t: replaceAt(t0, at, rotR), cmp: c1[0] });
  else if (kase === "RR") states.push({ t: replaceAt(t0, at, rotL), cmp: c1[0] });
  else {
    const c = d2 === "L" ? c1[1][0] : c1[2][0];
    const s1 = replaceAt(t0, c1[0], kase === "LR" ? rotL : rotR);
    states.push({ t: s1, cmp: c }, { t: replaceAt(s1, at, kase === "LR" ? rotR : rotL), cmp: c });
  }
  return { states, kase, path, at };
}
const finalOf = (tr) => tr.states.at(-1).t;
const keysOf = (n) => Array.from({ length: n }, (_, i) => i + 1);
// brute force: every binary tree shape with up to 12 nodes, keep the AVL ones, record the fewest nodes per height
const minNodesBrute = (() => {
  const byN = [[null]];
  for (let n = 1; n <= 12; n++) {
    byN[n] = [];
    for (let l = 0; l < n; l++) for (const L of byN[l]) for (const Rt of byN[n - 1 - l]) byN[n].push([0, L, Rt]);
  }
  const best = {};
  for (let n = 1; n <= 12; n++) for (const t of byN[n]) if (isAvl(t)) { const hh = hgt(t); best[hh] = Math.min(best[hh] ?? Infinity, n); }
  return best;
})();
const T_S30 = "9(3(1(0,2),6(,7)),11(,16))", T_A = "9(3(1(0,),6(5,)),10)", T_P = "20(10(5,15),30)", T_Q = "10(5,20(15,30))";
const ins8 = avlTrace(parse(T_S30), 8), ins20 = avlTrace(parse(S39), 20), q12 = avlTrace(parse(T_Q), 12);
const seqCases = {};
{
  let t = null;
  for (const k of [10, 20, 30, 25, 28, 27]) { const tr = t ? avlTrace(t, k) : { states: [{ t: [k, null, null] }], kase: "none" }; seqCases[k] = tr; t = finalOf(tr); }
}
const dirOf = (kase) => ({ LL: "right", RR: "left" })[kase];

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
  "cse332-w3-l7-qc-height-7tree": String(hgt(parse(S7))),
  "cse332-w3-l7-qc-chain-bst": yn(isBst(parse("16(10(7(3(1(0,),),),),)"))),
  "cse332-w3-l7-qc-find16": sp(findPath(parse(S7), 16).p),
  "cse332-w3-l7-qc-insert8-parent": String(parentOf(ins(parse(S7), 8), 8)),
  "cse332-w3-l7-qc-delete6": String(del(parse(S22), 6)[2]),
  "cse332-w3-l7-qc-max-nodes-h3": String(2 ** 4 - 1),
  "cse332-w3-l7-qc-sorted-height": String(hgt(fromKeys([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))),
  "cse332-w3-l7-traversals.pre": sp(pre(parse(S12))), "cse332-w3-l7-traversals.in": sp(ino(parse(S12))), "cse332-w3-l7-traversals.post": sp(post(parse(S12))),
  "cse332-w3-l7-build.height": String(hgt(fromKeys(K22))), "cse332-w3-l7-build.parent5": String(parentOf(fromKeys(K22), 5)),
  "cse332-w3-l7-build.path8": sp(findPath(fromKeys(K22), 8).p), "cse332-w3-l7-build.found8": yn(findPath(fromKeys(K22), 8).found),
  "cse332-w3-l7-delete.case5": String(d3.out[0][0]), "cse332-w3-l7-delete.case1": String(d3.out[1][0]), "cse332-w3-l7-delete.repl3": String(d3.out[2][1]), "cse332-w3-l7-delete.pre": sp(pre(d3.t)),
  "cse332-w3-l7-numbers.maxleaves": String(2 ** 5), "cse332-w3-l7-numbers.maxnodes": String(2 ** 6 - 1), "cse332-w3-l7-numbers.minleaves": "1", "cse332-w3-l7-numbers.minnodes": String(hgt(fromKeys([1, 2, 3, 4, 5, 6])) + 1),
  "cse332-w3-l7-naive.unsorted-insert": "n", "cse332-w3-l7-naive.sorted-find": "log n", "cse332-w3-l7-naive.sorted-insert": "n", "cse332-w3-l7-naive.sortedlist-find": "n",
  "cse332-w3-l7-is-bst.p": yn(isBst(treeCheck.P)), "cse332-w3-l7-is-bst.q": yn(isBst(treeCheck.Q)), "cse332-w3-l7-is-bst.r": yn(isBst(treeCheck.R)),
  "cse332-w3-l7-order.h-sorted": String(hgt(fromKeys(K17))), "cse332-w3-l7-order.h-mixed": String(hgt(fromKeys(K4261))),
  "cse332-w3-l7-order.f-sorted": String(findPath(fromKeys(K17), 7).p.length), "cse332-w3-l7-order.f-mixed": String(findPath(fromKeys(K4261), 7).p.length),
  "cse332-w3-l7-cyu-bst-worst": "n", "cse332-w3-l7-cyu-delete-root": String(del(parse(S22), 9)[0][0]),
  // Lecture 8
  "cse332-w3-l8-qc-tree-a": String(problems(parse(T_A))[0]),
  "cse332-w3-l8-qc-insert8-problem": String(ins8.at), "cse332-w3-l8-qc-insert8-after": String(sub(finalOf(ins8), 3)[2][0]),
  "cse332-w3-l8-qc-root-385": String(avlKeys([3, 8, 5]).t[0]),
  "cse332-w3-l8-qc-maxh-20": String(maxH(20)), "cse332-w3-l8-qc-m7": String(M(7)),
  "cse332-w3-l8-is-avl.x": yn(isAvl(treeCheck.X)), "cse332-w3-l8-is-avl.y": yn(isAvl(treeCheck.Y)), "cse332-w3-l8-is-avl.problem": String(problems(treeCheck.Y)[0]),
  "cse332-w3-l8-ins20.deep": String(ins20.at), "cse332-w3-l8-ins20.dir": dirOf(ins20.kase),
  "cse332-w3-l8-ins20.parent16": String(parentOf(finalOf(ins20), 16)), "cse332-w3-l8-ins20.still11": yn(unb(sub(finalOf(ins20), 11))),
  "cse332-w3-l8-which-case.p3": avlTrace(parse(T_P), 3).kase.toLowerCase(), "cse332-w3-l8-which-case.p17": avlTrace(parse(T_P), 17).kase.toLowerCase(),
  "cse332-w3-l8-which-case.p25": avlTrace(parse(T_P), 25).kase.toLowerCase(), "cse332-w3-l8-which-case.q35": avlTrace(parse(T_Q), 35).kase.toLowerCase(),
  "cse332-w3-l8-double-steps.case": q12.kase.toLowerCase(), "cse332-w3-l8-double-steps.mid": String(sub(q12.states[1].t, 10)[2][0]),
  "cse332-w3-l8-double-steps.root": String(finalOf(q12)[0]), "cse332-w3-l8-double-steps.p12": String(parentOf(finalOf(q12), 12)),
  "cse332-w3-l8-double.case30": seqCases[30].kase.toLowerCase(), "cse332-w3-l8-double.case28": seqCases[28].kase.toLowerCase(),
  "cse332-w3-l8-double.case27": seqCases[27].kase.toLowerCase(), "cse332-w3-l8-double.root": String(finalOf(seqCases[27])[0]),
  "cse332-w3-l8-cyu-find": "log n",
  "cse332-w3-l8-how-tall.m8": String(M(8)), "cse332-w3-l8-how-tall.avl100": String(maxH(100)), "cse332-w3-l8-how-tall.bst100": String(hgt(fromKeys(keysOf(100)))),
};
// facts the expectations above rely on
ok(minus1.probs.length === 1 && plus20.probs.join() === "16,11" && plus10.length === 0, "slide 31/33/40: problem nodes (none for 10; 9 for -1; 16 and 11 for 20)");
ok(seqA.log.map((x) => x.join("@")).join(" ") === "RR@10 LR@30 RL@20" && seq7.log.every((x) => x[0] === "RR"), "sequence cases");
ok(caseOf([9, 5, 7]) === "LR" && str(avlKeys([9, 5, 7]).t) === "7(5,9)" && caseOf([3, 8, 5]) === "RL", "slide 48 LR; 3,8,5 RL");
ok(str(minus1.r) === "3(1(0(-1,),2),9(6(,7),11(,16)))" && str(plus20.r) === "9(3(1(0,2),6),11(10,18(16,20)))", "slide 35 and 42 results");
ok(["9(3(1(0,),6(5,)),10)", "9(3(1(0,),6(5,)),10(,16))", "9(3(,6(5,)),10(,16))", "9(3(1(0,),6(5,7)),10(,16))"].map((s) => isAvl(parse(s))).join() === "false,true,false,true", "slide 27: A-D");
ok(["7(3(1(0,),),10(,16))", "7(3(1(0,),7),10(,16))", "7(3(1(0,),8),10(,16))", "16(10(7(3(1(0,),),),),)"].map((s) => isBst(parse(s))).join() === "true,false,false,true", "slide 14: are these BSTs");
// formula answers agree with the actual level totals
for (const [k, ex, pts] of [["sq", "n^2/2^i", [[64, 0], [64, 3], [1024, 1]]], ["nlogn", "n", [[16, 2], [1024, 5]]]]) {
  for (const [n, i] of pts) ok(G.eq(G.evalExact(ex, { n: G.Q(BigInt(n)), i: G.Q(BigInt(i)) }), G.Q(lvl(k, n, i))), `${k}: level ${i} at n=${n} is ${ex}`);
}
Sim.levels(Sim.REC.sum, 16).forEach((l) => ok(l.nodes === 2n ** BigInt(l.i), `sum: 2^i boxes on level ${l.i}`));

/* S3 ---------------------------------------------------------------- Section 3: the worksheet's code run, its trees summed */
{
  const s3html = readFileSync(`${here}../../../site/cse332/w03/index.html`, "utf8");
  const s3text = s3html.replace(/\s+/g, " ");
  const s3has = (s, why) => ok(s3text.includes(s), `S3 page states "${s}" (${why})`);

  // The worksheet's bar (0b). Loops are counted, not run. baseReturn is line 3's value; stored = save line 5's result in r.
  function runBar(n, baseReturn, stored = false) {
    const loops = new Set(), perRun = new Set();
    const bar = (m) => {
      if (m <= 10000) return baseReturn;
      let calls = 0;
      const call = () => { calls++; return bar(Math.floor(m / 3)); };
      const r = call();
      let out;
      if (r > 5) { loops.add("n"); out = 5 * (stored ? r : call()); }
      else { loops.add("n*n"); out = 4 * (stored ? r : call()); }
      perRun.add(calls);
      return out;
    };
    return { value: bar(n), loops: [...loops].sort().join(), perRun: [...perRun].join() };
  }
  ok(runBar(9000, 1000).value === 1000 && runBar(27000, 1000).value === 5000 && runBar(81000, 1000).value === 25000, "bar returns 1000, 5000, 25000 at n = 9000, 27000, 81000");
  for (let n = 10001; n < 3e6; n = Math.floor(n * 1.37) + 1) {
    const orig = runBar(n, 1000), zero = runBar(n, 0), st = runBar(n, 1000, true);
    ok(orig.loops === "n" && orig.perRun === "2", `bar(${n}): only the n loop runs, 2 calls per run`);
    ok(zero.loops === "n*n" && zero.perRun === "2" && zero.value === 0, `bar with return 0 (${n}): only the n*n loop, 2 calls per run, returns 0`);
    ok(st.perRun === "1" && st.value === orig.value, `bar with r stored (${n}): 1 call per run`);
  }
  // 0a: f(stack) pops one item, then returns 2*f(stack)+1
  for (let n = 0; n <= 40; n++) {
    let calls = 0; const perRun = new Set();
    const f = (stack) => { calls++; if (stack.length === 0) return 0; stack.pop(); let c = 0; const r = (c++, f(stack)); perRun.add(c); return 2 * r + 1; };
    f(Array.from({ length: n }, (_, i) => i));
    ok(calls === n + 1 && (n === 0 || [...perRun].join() === "1"), `f(stack) with ${n} items: ${n + 1} calls, 1 per run`);
  }
  // quick check g: return g(n - 1) + g(n - 1) makes two calls per run
  { let perRun = new Set(); const g = (n) => { if (n <= 1) return 1; let c = 0; const v = (c++, g(n - 1)) + (c++, g(n - 1)); perRun.add(c); return v; }; g(8); ok([...perRun].join() === "2", "g makes 2 calls per run"); }
  // Problem 2: f(L, start, j) with start = 0; loop iterations by depth
  for (let k = 1; k <= 12; k++) {
    const n = 2 ** k, byDepth = [], perRun = new Set();
    const f = (start, j, d) => {
      if (j - start <= 1) return 0;
      let c = 0;
      let result = (c++, f(start, Math.floor(j / 2), d + 1));
      byDepth[d] = (byDepth[d] || 0) + (j - start);
      const out = result + (c++, f(start, Math.floor(j / 2), d + 1));
      perRun.add(c);
      return out;
    };
    f(0, n, 0);
    ok(byDepth.length === k && byDepth.every((x) => x === n) && [...perRun].join() === "2", `problem 2, n=${n}: ${k} levels of ${n} loop iterations, 2 calls per run`);
    let total = 0n; for (let i = 0; i < k; i++) total += 2n ** BigInt(i) * (5n * BigInt(n) / 2n ** BigInt(i) + 3n);
    ok(total === 5n * BigInt(n) * BigInt(k) + 3n * (BigInt(n) - 1n), `problem 2 sum = c2 n log n + c1(n - 1) at n=${n} (c1=3, c2=5)`);
  }

  // The tree method, independently: level i has a^i boxes of size n/b^i (or n - b·i), each doing f(size). Exact rationals.
  const Qn = (x) => G.Q(BigInt(x));
  const REC3 = {
    "1a": { a: 2, div: true, b: 2, f: (s) => s, base: 1, baseVal: 1 },
    "1b": { a: 2, div: true, b: 2, f: (s) => s, base: 4, baseVal: 4 },
    "1c": { a: 2, div: true, b: 2, f: (s) => G.mul(Qn(100), s), base: 1, baseVal: 100 },
    "1d": { a: 3, div: true, b: 2, f: (s) => s, base: 1, baseVal: 1 },
    "1e": { a: 2, div: true, b: 3, f: (s) => s, base: 1, baseVal: 1 },
    "1f": { a: 2, div: false, b: 2, f: () => Qn(1), base: 1, baseVal: 1 },
    bar0: { a: 2, div: true, b: 3, f: (s) => G.mul(s, s), base: 10000, baseVal: 0 },
    more: { a: 4, div: true, b: 2, f: (s) => s, base: 1, baseVal: 1 },
    smaller: { a: 2, div: true, b: 4, f: (s) => s, base: 1, baseVal: 1 },
    constant: { a: 2, div: true, b: 2, f: (s) => G.mul(Qn(5), s), base: 1, baseVal: 1 },
    base8: { a: 2, div: true, b: 2, f: (s) => s, base: 8, baseVal: 1 },
  };
  const sizeAt = (r, n, i) => (r.div ? G.div(Qn(n), Qn(r.b ** i)) : Qn(n - r.b * i));
  const boxesAt = (r, i) => Qn(r.a ** i);
  const levelAt = (r, n, i) => G.mul(boxesAt(r, i), r.f(sizeAt(r, n, i)));
  const nonBase = (r, n, i) => G.cmp(sizeAt(r, n, i), Qn(r.base)) > 0;
  const levelsAbove = (r, n) => { let i = 0; while (nonBase(r, n, i)) i++; return i; };
  const sumAbove = (r, n) => { let t = Qn(0); for (let i = 0; nonBase(r, n, i); i++) t = G.add(t, levelAt(r, n, i)); return t; };
  const sampleN = (r) => (r.div ? (r.base > 1000 ? r.b ** 12 : r.b ** (r.b === 2 ? 10 : 6)) : 30);

  // every tree picture: boxes drawn, sizes, work per box and level totals match the recurrence; the template is all blanks
  const tex2expr = (t) => t.replace(/\\cdot/g, "*").replace(/\\left|\\right/g, "").replace(/\{/g, "(").replace(/\}/g, ")");
  const val = (t, n, i) => G.evalExact(tex2expr(t), { n: Qn(n), i: Qn(i) });
  let trees = 0;
  for (const m of s3html.matchAll(/<div class="s3tree"( data-rec="([^"]+)")? data-rows='([^']+)'>/g)) {
    const rows = JSON.parse(m[3]), r = REC3[m[2]];
    if (!r) { ok(rows.every((x) => x === "dots" || ["s", "w", "L"].every((f) => x[f] === undefined || x[f] === "?")), "the template tree is all blanks"); continue; }
    trees++;
    const n = sampleN(r);
    for (const row of rows) {
      if (row === "dots") continue;
      if (row.i === "base") {
        ok(G.eq(val(row.w, n, 0), Qn(r.baseVal)), `${m[2]} tree: base cases do ${r.baseVal}`);
        if (!row.s.includes("\\le")) ok(G.eq(val(row.s, n, 0), sizeAt(r, n, levelsAbove(r, n))), `${m[2]} tree: base-case size ${row.s}`);
        continue;
      }
      const is = row.i === "i" ? [0, 1, 2, 3] : [Number(row.i)];
      if (row.i !== "i") ok(row.k === Math.min(r.a ** is[0], 4) && Boolean(row.more) === r.a ** is[0] > 4, `${m[2]} tree level ${row.i}: ${row.k} boxes drawn`);
      for (const i of is) {
        ok(nonBase(r, n, i), `${m[2]} tree: level ${i} is above the base case at n=${n}`);
        ok(G.eq(val(row.s, n, i), sizeAt(r, n, i)), `${m[2]} tree level ${row.i}: size ${row.s} at i=${i}`);
        ok(G.eq(val(row.w, n, i), r.f(sizeAt(r, n, i))), `${m[2]} tree level ${row.i}: work per box ${row.w} at i=${i}`);
        for (const side of row.L.split("=")) ok(G.eq(val(side, n, i), levelAt(r, n, i)), `${m[2]} tree level ${row.i}: level work ${side} at i=${i}`);
      }
    }
  }
  ok(trees === 7, `seven filled trees checked (${trees})`);

  // closed forms stated on the pages: the sum over the levels above the base case, at n = b^k
  const sumIs = (key, ks, want) => ks.forEach((k) => { const r = REC3[key], n = r.div ? r.b ** k : k; ok(G.eq(sumAbove(r, n), want(BigInt(n), BigInt(k))), `${key}: level sum at n=${n}`); });
  const K = [3, 4, 5, 8, 12, 16];
  sumIs("1a", K, (n, k) => Qn(n * k));
  sumIs("more", K, (n) => Qn(n * n - n));
  sumIs("smaller", [2, 3, 5, 8], (n, k) => Qn(2n * n - 2n * 2n ** k)); // 2n - 2√n: less than 2n
  sumIs("constant", K, (n, k) => Qn(5n * n * k));
  sumIs("base8", K, (n, k) => Qn(n * k - 3n * n));
  sumIs("1b", K, (n, k) => Qn(n * k - 2n * n));
  sumIs("1c", K, (n, k) => Qn(100n * n * k));
  sumIs("1d", K, (n, k) => Qn(2n * 3n ** k - 2n * n)); // 3^k = n^(log2 3)
  sumIs("1f", [2, 4, 10, 30, 60], (n) => Qn(2n ** (n / 2n) - 1n)); // even n: n/2 levels
  for (const k of [2, 4, 6, 9]) { const n = 3 ** k, s = sumAbove(REC3["1e"], n); ok(G.cmp(s, Qn(n)) >= 0 && G.cmp(s, Qn(3 * n)) <= 0, `1e: n <= level sum <= 3n at n=${n}`); }
  { const n = 3 ** 12, s = sumAbove(REC3.bar0, n), n2 = Qn(n * n); ok(G.cmp(s, n2) >= 0 && G.cmp(s, G.mul(n2, G.Q(9n, 7n))) <= 0, "bar0: n^2 <= level sum <= 9/7 n^2"); }
  for (let n = 1n; n <= 40n; n++) ok(R.exp(n) === 2n ** n - 1n, `2T(n-1)+1 = 2^n - 1 at ${n}`);
  ok(Math.log2(3) > 1.58 && Math.log2(3) < 1.59, "log2 3 ≈ 1.585");
  // the classes those closed forms name
  const theta = (a, b) => G.relate(a, b).theta;
  ok(theta("n log n - 2n", "n log n") && theta("100 n log n", "n log n") && theta("n^2 - n", "n^2") && theta("2n - 2n^(1/2)", "n") && theta("5 n log n", "n log n") && theta("n log n - 3n", "n log n") && theta("n log n + n - 1", "n log n"), "comparison-table and problem classes");
  // choice keys: number of levels, trend, and the irrational classes
  for (const k of [3, 6, 10]) {
    ok(levelsAbove(REC3["1b"], 2 ** k) === k - 2, `1b: log2 n - 2 levels at n=2^${k}`);
    ok(levelsAbove(REC3["1c"], 2 ** k) === k && levelsAbove(REC3["1d"], 2 ** k) === k && levelsAbove(REC3["1e"], 3 ** k) === k, `1c, 1d: log2 n levels; 1e: log3 n levels (k=${k})`);
    ok(levelsAbove(REC3.base8, 2 ** k) === k - 3 && levelsAbove(REC3.smaller, 4 ** k) === k, `base 8: log2 n - 3 levels; smaller calls: log4 n levels (k=${k})`);
  }
  for (const n of [10, 20, 40]) ok(levelsAbove(REC3["1f"], n) === n / 2, `1f: n/2 levels at n=${n}`);
  const trend = (r, n) => { const L = []; for (let i = 0; nonBase(r, n, i); i++) L.push(levelAt(r, n, i)); return L.every((x, j) => !j || G.cmp(x, L[j - 1]) > 0) ? "grows" : L.every((x, j) => !j || G.cmp(x, L[j - 1]) < 0) ? "shrinks" : "same"; };
  ok(trend(REC3["1d"], 1024) === "grows" && trend(REC3["1e"], 729) === "shrinks" && trend(REC3["1a"], 1024) === "same", "1d grows, 1e shrinks, 1a stays the same");
  for (const k of [4, 8, 16, 24]) {
    const n = 2 ** k, s = Number(2n * 3n ** BigInt(k) - 2n * BigInt(n)), c = n ** Math.log2(3);
    ok(s / c >= 1 && s / c <= 2, `1d: 2n^(log2 3) - 2n is between 1 and 2 times n^(log2 3) at n=${n}`);
  }
  for (const n of [10, 20, 40]) {
    ok(Math.abs(Math.SQRT2 ** n / 2 ** (n / 2) - 1) < 1e-9 && (2 ** (n / 2) - 1) / Math.SQRT2 ** n >= 0.75, `1f: 2^(n/2) - 1 is about √2^n at n=${n}`);
    ok(2n ** BigInt(n) / 2n ** BigInt(n / 2) === 2n ** BigInt(n / 2), `2^n / √2^n = √2^n at n=${n}, which grows: 2T(n-1)+1 is a bigger class`);
  }

  // formula keys against the model, at the points the page grades
  const formulaIs = (id, key, kind, ns, is) => ns.forEach((n) => is.forEach((i) => {
    const r = REC3[key], want = { boxes: boxesAt(r, i), size: sizeAt(r, n, i), box: r.f(sizeAt(r, n, i)), level: levelAt(r, n, i) }[kind];
    ok(G.eq(G.evalExact(EXPECT[id], { n: Qn(n), i: Qn(i) }), want), `${id} = ${kind} at n=${n}, i=${i}`);
  }));
  Object.assign(EXPECT, {
    "cse332-w3-s3-qc-stored-r": runBar(81000, 1000, true).perRun,
    "cse332-w3-s3-qc-more-calls-level2": G.qToPlain(levelAt(REC3.more, 8, 2)),
    "cse332-w3-s3-q0a.a": "1", "cse332-w3-s3-q0a.size": "minus1", "cse332-w3-s3-q0a.f": "const", "cse332-w3-s3-q0a.class": "n",
    "cse332-w3-s3-bar0.test": runBar(3e6, 0).loops.split(",").includes("n") ? "yes" : "no",
    "cse332-w3-s3-bar0.a": runBar(3e6, 0).perRun, "cse332-w3-s3-bar0.f": "n^2", "cse332-w3-s3-bar0.class": "n^2",
    "cse332-w3-s3-q1b.level": "n", "cse332-w3-s3-q1b.l64": String(levelsAbove(REC3["1b"], 64)), "cse332-w3-s3-q1b.levels": "lgm2", "cse332-w3-s3-q1b.class": "n log n",
    "cse332-w3-s3-q1c.box": "100n/2^i", "cse332-w3-s3-q1c.level": "100n", "cse332-w3-s3-q1c.levels": "lg", "cse332-w3-s3-q1c.class": "n log n",
    "cse332-w3-s3-q1d.nodes": "3^i", "cse332-w3-s3-q1d.level": "(3/2)^i*n", "cse332-w3-s3-q1d.levels": "lg2", "cse332-w3-s3-q1d.trend": trend(REC3["1d"], 1024), "cse332-w3-s3-q1d.class": "c",
    "cse332-w3-s3-q1e.size": "n/3^i", "cse332-w3-s3-q1e.level": "(2/3)^i*n", "cse332-w3-s3-q1e.levels": "lg3", "cse332-w3-s3-q1e.trend": trend(REC3["1e"], 729), "cse332-w3-s3-q1e.class": "n",
    "cse332-w3-s3-q1f.nodes": "2^i", "cse332-w3-s3-q1f.size": "n-2i", "cse332-w3-s3-q1f.work": "2^i", "cse332-w3-s3-q1f.levels": "half", "cse332-w3-s3-q1f.class": "c", "cse332-w3-s3-q1f.same": "no",
    "cse332-w3-s3-q2.a": "2", "cse332-w3-s3-q2.b": "2", "cse332-w3-s3-q2.f": "n", "cse332-w3-s3-q2.level": "n", "cse332-w3-s3-q2.class": "n log n",
  });
  ok(EXPECT["cse332-w3-s3-qc-more-calls-level2"] === "32" && EXPECT["cse332-w3-s3-bar0.test"] === "no" && EXPECT["cse332-w3-s3-bar0.a"] === "2", "S3 keys from running the code");
  formulaIs("cse332-w3-s3-q1b.level", "1b", "level", [16, 1024], [0, 1, 3]);
  formulaIs("cse332-w3-s3-q1c.box", "1c", "box", [16, 1024], [0, 1, 3]);
  formulaIs("cse332-w3-s3-q1c.level", "1c", "level", [16, 1024], [0, 1, 3]);
  formulaIs("cse332-w3-s3-q1d.nodes", "1d", "boxes", [16], [0, 1, 2, 4]);
  formulaIs("cse332-w3-s3-q1d.level", "1d", "level", [16, 64], [0, 1, 3]);
  formulaIs("cse332-w3-s3-q1e.size", "1e", "size", [27, 81], [0, 1, 2]);
  formulaIs("cse332-w3-s3-q1e.level", "1e", "level", [27, 81], [0, 1, 2]);
  formulaIs("cse332-w3-s3-q1f.nodes", "1f", "boxes", [10], [0, 1, 3, 6]);
  formulaIs("cse332-w3-s3-q1f.size", "1f", "size", [10, 40], [0, 1, 3]);
  formulaIs("cse332-w3-s3-q1f.work", "1f", "level", [40], [0, 1, 3, 6]);
  formulaIs("cse332-w3-s3-q2.level", "1a", "level", [16, 1024], [0, 1, 3]); // problem 2's loop count per level is 1a's level work

  // numbers and closed forms written in the pages' prose (each one checked above)
  s3has("<th>9,000</th><td>1000</td><td>base case</td></tr> <tr><th>27,000</th><td>5000</td><td>\\(5 \\cdot 1000\\)</td></tr> <tr><th>81,000</th><td>25000</td>", "bar's returns");
  s3has("\\(4^i \\cdot n/2^i = 2^i n\\)", "more calls: level work"); s3has("\\(n^2 - n\\), \\(\\Theta(n^2)\\)", "more calls: closed form");
  s3has("\\(2^i \\cdot n/4^i = n/2^i\\)", "smaller calls: level work"); s3has("\\(\\log_4 n\\)", "smaller calls: levels");
  s3has("\\(5n\\log_2 n\\), \\(\\Theta(n\\log n)\\)", "bigger constant"); s3has("\\(\\log_2 n - 3\\)", "bigger base case: levels"); s3has("\\(n\\log_2 n - 3n\\)", "bigger base case: closed form");
  s3has("\\(n(\\log_2 n - 2) = n\\log_2 n - 2n \\in \\Theta(n\\log n)\\)", "1b closed form"); s3has("\\(100n\\log_2 n \\in \\Theta(n\\log n)\\)", "1c closed form");
  s3has("= 2n^{\\log_2 3} - 2n,\\]", "1d sum"); s3has("\\le n \\cdot \\frac{1}{1 - 2/3} = 3n\\)", "1e bound");
  s3has("\\(\\sum_{i=0}^{n/2 - 1} 2^i = 2^{n/2} - 1 = \\sqrt2^{\\,n} - 1 \\in \\Theta(\\sqrt2^{\\,n})\\)", "1f sum"); s3has("\\le n^2 \\cdot \\frac{1}{1 - 2/9} = \\frac97 n^2\\)", "bar0 bound");
  s3has("= c_2 n\\log_2 n + c_1(n - 1).\\]", "problem 2 sum"); s3has("\\(\\sum_{i=0}^{\\log_2 n - 1} n = n\\log_2 n\\)", "1a sum");
}

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

/* ---------------------------------------------------------------- 4. numbers stated in prose */
const text = html.replace(/\s+/g, " ");
const has = (s, why) => ok(text.includes(s), `page states "${s}" (${why})`);
ok([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(M).join() === "1,2,4,7,12,20,33,54,88,143,232" && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(Sim.minAVL).join() === "1,2,4,7,12,20,33,54,88,143,232", "M(h) values (both implementations)");
/* L6 */
has("\\(1 + 2 + 4 + 8 + 16 = 31\\)", "series: grows"); has("\\(16 \\times 5 = 80\\)", "series: same"); has("\\(256 + 128 + 64 + 32 + 16 = 496\\)", "series: shrinks");
has("\\(T(8) = 64 + 32 + 16 + 8 = 120\\)", "sq table sum"); has("\\(1 + 2 + 4 + 8 = 15\\)", "eighth sum"); has("\\(5 + 4 + 3 + 2 + 1 = 15\\)", "chip tree sum");
has("at \\(n = 16\\): \\(31\\)", "tree page sum"); has("\\(8 = 512^{1/3}\\)", "eighth leaves");
ok(R.sum(16n) === 31n && R.eighth(512n) === 15n && L6.linN(5n) === 15n && R.sq(8n) === 120n, "L6 prose numbers");
// the delete-3-first quick check really differs from the sequence answer
ok(del(parse(S22), 3)[2] === 1 && d3.out[2][1] === 0, "deleting 3 first pulls up 1; after deleting 1 it pulls up 0");

/* ---------------------------------------------------------------- L7: stepper narration and tree pictures */
{
  const node = (t, k) => { while (t && t[0] !== k) t = k < t[0] ? t[1] : t[2]; return t; };
  const conv = (n) => (n ? [n.key, conv(n.left), conv(n.right)] : null);
  const anyNode = (t, k) => (!t ? null : String(t[0]) === String(k) ? t : anyNode(t[1], k) || anyNode(t[2], k));
  // every comparison stated in a narration is true: "5 < 7 is true", "5 > 3 is true", "5 ≠ 7", "3 == 3"
  // the highlighted code lines do what the narration says
  const linesMatch = (st, code, where) => {
    const hl = st.line.map((i) => code[i]).join("\n");
    const need = [[/go left/, "root = root.left"], [/go right/, "root = root.right"], [/parent\.left = new Node/, "parent.left = new Node"], [/parent\.right = new Node/, "parent.right = new Node"],
      [/maxNode starts/, "maxNode(root.left)"], [/: go right to/, "root = root.right"], [/moves up into/, "move m's key into root"], [/has no children/, "parent points to Null"], [/has one child, -?\d+:/, "parent points to that child"], [/has two children/, "two children"]];
    for (const [re, line] of need) if (re.test(st.say)) ok(hl.includes(line), `${where}: "${st.say.slice(0, 50)}" highlights ${line}`);
    ok(st.line.every((i) => i >= 0 && i < code.length), `${where}: line numbers in range`);
  };
  const claimsHold = (say, where) => {
    for (const [, a, op, b, v] of say.matchAll(/(-?\d+) ([<>]) (-?\d+) is (true|false)/g)) ok((op === "<" ? +a < +b : +a > +b) === (v === "true"), `${where}: "${a} ${op} ${b} is ${v}"`);
    for (const [, a, b] of say.matchAll(/(-?\d+) ≠ (-?\d+)/g)) ok(+a !== +b, `${where}: "${a} ≠ ${b}"`);
    for (const [, a, b] of say.matchAll(/(-?\d+) == (-?\d+)/g)) ok(+a === +b, `${where}: "${a} == ${b}"`);
  };

  // traversal: one visit per step; each order writes the visited node exactly at its own visit
  const tt = Sim.traverseSteps(Sim.labelTree("D(U(S,2),B)"));
  const S = (a) => a.map(String).join(" "), last = tt.at(-1);
  ok(S(last.pre) === S(pre(dusb)) && S(last.in) === S(ino(dusb)) && S(last.post) === S(post(dusb)), "traversal stepper ends with the three orders");
  ok(tt.length === 1 + 3 * 2 + 3, "traversal stepper: 3 visits per inner node, 1 per leaf, plus the start");
  const SLOT = { pre: 1, in: 4, post: 7 };
  tt.slice(1).forEach((st, i) => {
    const prev = tt[i];
    for (const o of ["pre", "in", "post"]) {
      const wrote = st.wrote.includes(o);
      ok(st[o].length === prev[o].length + (wrote ? 1 : 0) && (!wrote || String(st[o].at(-1)) === String(st.cur)), `traversal step ${i + 1}: ${o} list`);
      ok(st.line.includes(SLOT[o]) === wrote, `traversal step ${i + 1}: ${o} slot highlighted iff it writes`);
    }
    ok(st.line.every((i) => Sim.TRAVERSE_CODE[i].includes(`${({ 1: "pre", 4: "in", 7: "post" })[i]}-order`)), `traversal step ${i + 1}: highlights only order slots`);
    const n = anyNode(dusb, st.cur), leaf = !n[1] && !n[2];
    ok(/is a leaf/.test(st.say) === leaf && (leaf ? st.wrote.length === 3 : st.wrote.length === 1), `traversal step ${i + 1}: leaf claim for ${st.cur}`);
  });

  // insert: the loop walks find's path; every "go left/right to K" and "no child" claim matches the tree
  const checkInsert = (shape, k) => {
    const t0 = parse(shape), steps = Sim.insertSteps(Sim.parseShape(shape), k), want = findPath(t0, k);
    const curs = steps.map((s) => Object.keys(s.marks).find((x) => s.marks[x] === "cur")).filter(Boolean).map(Number);
    ok(sp(curs) === sp(want.p), `insert ${k} into ${shape}: the loop visits ${sp(want.p)}`);
    steps.forEach((s, i) => {
      claimsHold(s.say, `insert ${k} step ${i}`);
      linesMatch(s, Sim.INSERT_CODE, `insert ${k} step ${i}`);
      const m = /parent = (-?\d+)\. .*(left|right)(?: to (-?\d+)|\. -?\d+ has no)/.exec(s.say);
      if (m) { const c = node(t0, +m[1])[m[2] === "left" ? 1 : 2]; ok(m[3] ? c && c[0] === +m[3] : !c, `insert ${k} step ${i}: ${m[0]}`); }
    });
    if (!want.found) ok(steps.at(-1).shape === str(ins(t0, k)), `insert ${k} into ${shape}: final tree`);
  };
  {
    const src = Sim.INSERT_CODE.join("\n").replace(/^insert/, "function insert").replace(/\bNull\b/g, "null").replace(/new Node\(key, value\)/g, "{ key, value, left: null, right: null }");
    const insert = new Function("self", `let parent; ${src.replace(/this\.root/g, "self.root")}; return (key, value) => insert.call(self, key, value, self.root);`);
    const run = (ks) => { const self = { root: null }; const put = insert(self); for (const k of ks) put(k, `v${k}`); return self; };
    let threw = null;
    try { run([7]); } catch (e) { threw = e.message; }
    ok(threw === null, `the displayed insert code runs on an empty tree${threw ? ` (threw: ${threw})` : ""}`);
    const conv = (n) => (n ? [n.key, conv(n.left), conv(n.right)] : null);
    for (const ks of [[7], [7, 3], [9, 3, 10, 1, 6, 16, 0, 5, 7], [1, 2, 3, 4, 5], [5, 5, 3]]) {
      const t = run(ks);
      ok(str(conv(t.root)) === str(fromKeys(ks)), `the displayed insert code builds ${str(fromKeys(ks))} from an empty tree`);
    }
    const t = run([5, 3, 5]);
    ok(t.root.value === "v5" && t.root.left.key === 3, "the displayed insert code overwrites the value of a key already present");
    const hl = (s) => s.line.map((i) => Sim.INSERT_CODE[i]).join("\n");
    for (const k of [5, 8, 6, -1]) {
      const st = Sim.insertSteps(Sim.parseShape(S7), k);
      ok(hl(st[0]).trim() === "parent = Null;", `insert ${k} step 0 highlights parent = Null`);
      st.slice(1).forEach((s, i) => ok(/while \(root != Null/.test(hl(s)) || /root\.value = value/.test(hl(s)) || /new Node/.test(hl(s)), `insert ${k} step ${i + 1} highlights the loop, the overwrite or the new node`));
      const fin = st.at(-1);
      if (k === 6) ok(/if \(root != Null\)\n\s+root\.value = value;/.test(hl(fin)), "insert 6 (present) highlights the overwrite");
    }
  }
  {
    const WEEK = ((window) => (new Function("window", readFileSync(`${here}../../../site/cse332/w03/week.js`, "utf8"))(window), window.WEEK))({});
    const ORDERS = { pre, in: ino, post }, TAG = { pre: "pre", in: "inorder", post: "post" };
    const boxes = [["cse332-w3-l7-traversals", "pre", parse(S12)], ["cse332-w3-l7-traversals", "in", parse(S12)], ["cse332-w3-l7-traversals", "post", parse(S12)], ["cse332-w3-l7-delete", "pre", d3.t]];
    for (const [task, want, t] of boxes) {
      const a = html.indexOf(`data-id="${task}"`), tag = /<div class="answer-spec" data-part="[^"]*"[^>]*>/g;
      tag.lastIndex = a;
      let spec; while ((spec = tag.exec(html)) && attr(spec[0], "data-part") !== want);
      const miscon = JSON.parse(attr(spec[0], "data-miscon") || "{}");
      for (const o of Object.keys(ORDERS).filter((o) => o !== want)) for (const typed of [sp(ORDERS[o](t)), ORDERS[o](t).join(", ")]) {
        ok(miscon[typed] === `${TAG[o]}-not-${want}`, `${task}.${want}: typing the ${o}-order "${typed}" says it's the ${o}-order`);
        ok(/^That's (the )?(in|pre|post)-order/.test(WEEK.messages[miscon[typed]] || "") && WEEK.messages[miscon[typed]].includes(o === "in" ? "in-order" : `${o}-order`), `${task}.${want}: message for ${miscon[typed]} names the ${o}-order`);
      }
    }
  }
  checkInsert(S7, 5);
  for (const k of [-1, 2, 4, 5, 8, 11, 17, 7, 16]) checkInsert(S7, k);

  // delete: find phase, the maxNode walk down the right spine of the left subtree, and the final tree
  const checkDelete = (shape, k) => {
    const t0 = parse(shape), steps = Sim.deleteSteps(Sim.parseShape(shape), k), [after, kase, repl] = del(t0, k);
    steps.forEach((s, i) => {
      claimsHold(s.say, `delete ${k} from ${shape} step ${i}`);
      linesMatch(s, Sim.DELETE_CODE, `delete ${k} from ${shape} step ${i}`);
      for (const [, a, b] of s.say.matchAll(/(-?\d+)\.right is (-?\d+), not Null/g)) ok(node(t0, +a)[2]?.[0] === +b, `delete ${k}: ${a}.right is ${b}`);
      for (const [, a] of s.say.matchAll(/(-?\d+)\.right is Null/g)) ok(!node(t0, +a)[2], `delete ${k}: ${a}.right is Null`);
      const big = /The largest key on (-?\d+)'s left is (-?\d+)/.exec(s.say);
      if (big) ok(+big[2] === maxKey(node(t0, +big[1])[1]) && +big[2] === repl, `delete ${k}: largest on the left is ${big[2]}`);
      const two = /has two children, (-?\d+) and (-?\d+)/.exec(s.say);
      if (two) ok(kase === 2 && node(t0, k)[1][0] === +two[1] && node(t0, k)[2][0] === +two[2], `delete ${k}: two children ${two[1]}, ${two[2]}`);
      const sorted = /In-order is still sorted: ([-\d ]+)\./.exec(s.say);
      if (sorted) ok(sorted[1] === sp(ino(after)), `delete ${k}: in-order after`);
      for (const key of Object.keys(s.marks)) ok(Sim.parseShape(s.shape) && new RegExp(`(^|[(,])${key}([(),]|$)`).test(s.shape), `delete ${k} step ${i}: marked ${key} is in the tree`);
    });
    const found = findPath(t0, k).found;
    if (found) ok(steps.at(-1).shape === str(after) && (kase === 0 ? /no children/ : kase === 1 ? /has one child/ : /moves up into/).test(steps.at(-1).say), `delete ${k} from ${shape}: final tree and case`);
  };
  for (const k of [3, 5, 1, 9, 6, 10, 16, 0, 7, 8]) checkDelete(S22, k);
  {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let trial = 0; trial < 300; trial++) {
      const ks = Array.from({ length: 1 + Math.floor(rnd() * 12) }, () => Math.floor(rnd() * 30));
      const shape = str(fromKeys(ks)), k = ks[Math.floor(rnd() * ks.length)];
      checkDelete(shape, k); checkInsert(shape, Math.floor(rnd() * 32) - 1);
    }
  }

  // pictures: every data-bst parses, marked keys are in it, and the module and solution pictures are the real trees
  const pics = [...html.matchAll(/<svg class="htree"[^>]*data-bst="([^"]*)"[^>]*>/g)].map((m) => ({ tag: m[0], shape: m[1], at: m.index }));
  for (const p of pics) {
    const keys = new Set(ino(conv(Sim.labelTree(p.shape))).map(String));
    for (const a of ["data-cmp", "data-path", "data-new", "data-cur"]) for (const k of (attr(p.tag, a) || "").split(",").filter(Boolean)) ok(keys.has(k), `picture ${p.shape}: ${a} ${k} is a node`);
    if (/^[-\d(),]*$/.test(p.shape)) ok(str(parse(p.shape)) === p.shape, `picture ${p.shape} is in canonical form`);
  }
  const solutionPics = (task) => { const a = html.indexOf(`data-id="${task}"`), b = html.indexOf("</article>", a), sol = html.indexOf('class="solution"', a); return pics.filter((p) => p.at > sol && p.at < b); };
  const want = {
    "cse332-w3-l7-is-bst": [[str(treeCheck.P), null]],
    "cse332-w3-l7-build": [[str(fromKeys([9, 3, 10, 1, 6])), null], [str(fromKeys(K22)), null], [str(fromKeys(K22)), sp(findPath(fromKeys(K22), 8).p)]],
    "cse332-w3-l7-delete": (() => { let t = parse(S22); return [5, 1, 3].map((k) => { t = del(t, k)[0]; return [str(t), null]; }); })(),
    "cse332-w3-l7-order": [K17, K4261].map((ks) => [str(fromKeys(ks)), sp(findPath(fromKeys(ks), 7).p)]),
  };
  for (const [task, list] of Object.entries(want)) {
    const got = solutionPics(task);
    ok(got.length === list.length, `${task}: ${list.length} solution pictures`);
    list.forEach(([shape, path], i) => ok(got[i] && got[i].shape === shape && (path === null || (attr(got[i].tag, "data-path") || "").split(",").join(" ") === path), `${task}: solution picture ${i + 1} is ${shape}${path ? ` with path ${path}` : ""}`));
  }
  const shapes = new Set(pics.map((p) => p.shape));
  for (const [s, why] of [[str(del(parse(S22), 5)[0]), "delete 5"], [str(del(parse(S22), 1)[0]), "delete 1"], [str(fromKeys([1, 2, 3, 4, 5])), "sorted inserts 1..5"], [S12, "lecture BST"], [S7, "find/insert tree"], [S22, "delete tree"]]) ok(shapes.has(s), `page draws ${s} (${why})`);
  ok(!isBst(parse("7(3(1(0,),8),10(,16))")) && isBst(parse("16(10(7(3(1(0,),),),),)")) && hgt(parse("1(,2(,3(,4(,5))))")) === 4, "BST page pictures: trap is not a BST, chain is; sorted chain height n - 1");
  for (const [s, t] of [["0 1 2 3 6 7 8 10 16", S12], ["0 1 3 8 7 10 16", "7(3(1(0,),8),10(,16))"], ["5 10 12 15 25 20 30", treeCheck.P], ["5 10 12 15 18 20 30 40", treeCheck.Q], ["5 8 11 13 21", treeCheck.R]]) {
    ok(sp(ino(typeof t === "string" ? parse(t) : t)) === s, `in-order of ${typeof t === "string" ? t : str(t)} is ${s}`); has(s, "in-order stated");
  }
  has("<td>1</td><td>2</td><td>4</td><td>8</td><td>\\(2^h\\)</td>", "most leaves row"); has("<td>1</td><td>3</td><td>7</td><td>15</td><td>\\(2^{h+1} - 1\\)</td>", "most nodes row"); has("<td>1</td><td>2</td><td>3</td><td>4</td><td>\\(h + 1\\)</td>", "chain row");
  ok([0, 1, 2, 3].every((h) => 2 ** h === [1, 2, 4, 8][h] && 2 ** (h + 1) - 1 === [1, 3, 7, 15][h] && hgt(fromKeys(Array.from({ length: h + 1 }, (_, i) => i))) === h), "tree numbers rows");
  ok(hgt(dusb) === 2 && ["S", "2", "B"].every((k) => { const n = anyNode(dusb, k); return !n[1] && !n[2]; }), "D U S 2 B: height 2, leaves S, 2, B");
}

/* L8 */
/* ---------------------------------------------------------------- 5. Lecture 8 steppers and pictures */
{
  const l8 = html.slice(html.indexOf('id="l8-goals"'), html.indexOf('id="readings"'));
  const mf = (k) => (k < 0 ? `−${-k}` : String(k));
  const sameSet = (a, b) => [...a].map(String).sort().join() === [...b].map(String).sort().join();
  // the independent trace agrees with the independent insert on many random inserts
  {
    let seed = 8;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let trial = 0; trial < 300; trial++) {
      const ks = [...new Set(Array.from({ length: 2 + Math.floor(rnd() * 12) }, () => Math.floor(rnd() * 60)))];
      const k = ks.pop();
      const t = avlKeys(ks).t, log = [];
      const want = avl(t, k, log), tr = avlTrace(t, k);
      ok(str(finalOf(tr)) === str(want) && tr.kase === (log[0]?.[0] ?? "none") && (log[0]?.[1] ?? null) === tr.at, `trace ${ks} + ${k}`);
    }
  }
  // every stepper: each narrated claim against the independent trace
  const steppers = [...l8.matchAll(/class="panel avl-step" data-start="([^"]+)" data-key="(-?\d+)" data-recipe="(\w+)"/g)];
  ok(steppers.length === 2 && steppers.map((m) => m[3]).join() === "single,full", "Lecture 8 has the single and the double rotation steppers");
  for (const [, start, keyS, recipe] of steppers) {
    const key = Number(keyS), t = parse(start), tr = avlTrace(t, key), bstT = tr.states[0].t;
    const steps = Sim.avlInsertSteps(start, key, recipe), lines = Sim.AVL_RECIPE[recipe];
    const tag = `stepper ${start} + ${key}`;
    ok(isAvl(t) && isBst(t), `${tag}: starts from an AVL tree`);
    ok(recipe === "full" || tr.kase === "LL" || tr.kase === "RR", `${tag}: the single-rotation page shows an outside case`);
    const kinds = steps.map((s) => s.kind);
    const walked = tr.at === null ? tr.path.length : tr.path.length - tr.path.indexOf(tr.at);
    const rots = tr.kase === "none" ? 0 : tr.kase[0] === tr.kase[1] ? 1 : 2;
    const wantKinds = ["start", "bst", ...Array(walked - (tr.at === null ? 0 : 1)).fill("height"), ...(tr.at === null ? [] : ["unbalanced", "case", ...Array(rots).fill("rotate")]), "done"];
    ok(kinds.join() === wantKinds.join(), `${tag}: steps ${kinds.join()} vs ${wantKinds.join()}`);
    ok(steps[0].shape === str(t) && steps[1].shape === str(bstT), `${tag}: start and BST-insert pictures`);
    const cmpSay = tr.path.map((x) => `${mf(key)} ${key < x ? "<" : ">"} ${mf(x)}`).join(", ");
    ok(steps[1].say.includes(cmpSay) && steps[1].say.includes(`${mf(parentOf(bstT, key))}'s ${key < parentOf(bstT, key) ? "left" : "right"} child`), `${tag}: BST insert narration "${steps[1].say}"`);
    const beforeH = (k) => nodeH(t, k);
    const visited = new Set([key]);
    for (const st of steps.filter((s) => s.kind === "height" || s.kind === "unbalanced")) {
      const n = sub(bstT, st.node), lh = hgt(n[1]), rh = hgt(n[2]);
      visited.add(st.node);
      ok(st.shape === str(bstT) && st.lh === lh && st.rh === rh && st.height === 1 + Math.max(lh, rh) && st.diff === Math.abs(lh - rh), `${tag}: node ${st.node} heights`);
      ok(st.say.includes(`Height = 1 + max(${mf(lh)}, ${mf(rh)}) = ${1 + Math.max(lh, rh)}`) && st.say.includes(`differ by ${Math.abs(lh - rh)}`), `${tag}: node ${st.node} narration "${st.say}"`);
      ok((st.kind === "unbalanced") === (st.node === tr.at) && (st.kind === "unbalanced") === unb(n), `${tag}: node ${st.node} balanced or not`);
      for (const [k, hv] of Object.entries(st.heights)) ok(hv === (visited.has(Number(k)) ? nodeH(bstT, Number(k)) : beforeH(Number(k))), `${tag}: at node ${st.node}, stored height of ${k} is ${hv}`);
      ok(lines[[].concat(st.line)[1]].includes("height ="), `${tag}: height step highlights the height line`);
    }
    ok(steps.filter((s) => s.kind === "height" || s.kind === "unbalanced").map((s) => s.node).join() === [...tr.path].reverse().slice(0, walked).join(), `${tag}: walks up the path from the leaf`);
    const caseStep = steps.find((s) => s.kind === "case");
    if (caseStep) {
      ok(caseStep.case === tr.kase, `${tag}: case ${caseStep.case} vs ${tr.kase}`);
      ok(recipe === "single" ? caseStep.say.includes(`rotate ${dirOf(tr.kase)} at ${mf(tr.at)}`) : caseStep.say.includes(`case ${tr.kase}`), `${tag}: case narration "${caseStep.say}"`);
      ok([].concat(caseStep.line).some((i) => lines[i].includes(recipe === "single" ? `rotate ${dirOf(tr.kase)}` : `${tr.kase}:`)), `${tag}: case step highlights its fix line`);
    }
    const rotSteps = steps.filter((s) => s.kind === "rotate");
    rotSteps.forEach((st, i) => {
      const want = tr.states[i + 1];
      ok(st.shape === str(want.t) && st.up === want.cmp && st.marks[want.cmp] === "cmp", `${tag}: rotation ${i + 1} picture ${st.shape} vs ${str(want.t)}`);
      ok(st.say.includes(`New heights: ${mf(st.at)} is ${nodeH(want.t, st.at)}, ${mf(st.up)} is ${nodeH(want.t, st.up)}`), `${tag}: rotation ${i + 1} heights "${st.say}"`);
      for (const [k, hv] of Object.entries(st.heights)) ok(Number(k) === tr.at || hv === nodeH(want.t, Number(k)), `${tag}: after rotation ${i + 1}, height of ${k}`);
    });
    const done = steps.at(-1);
    if (tr.at !== null) {
      const top = finalOf(tr), topKey = rotSteps.at(-1).up;
      ok(done.top === topKey && done.height === nodeH(top, topKey) && done.height === beforeH(tr.at) && done.say.includes(`has height ${done.height}`), `${tag}: the fixed subtree is back to its old height (${done.say})`);
      ok(done.shape === str(top) && isAvl(top) && isBst(top) && sameSet(ino(top), ino(bstT)), `${tag}: ends balanced, same keys in order`);
    }
  }
  // solution pictures (data-step): exactly the states of the real insert, in order, circling the moving node
  const taskBlock = (tid) => { const at = html.indexOf(`data-id="${tid}"`); return html.slice(at, html.indexOf("</article>", at)); };
  const stepPics = (tid) => [...taskBlock(tid).matchAll(/<svg class="htree" data-step[^>]*>/g)].map((m) => ({ shape: attr(m[0], "data-shape"), cmp: attr(m[0], "data-cmp"), bad: attr(m[0], "data-bad") }));
  const plan = {
    "cse332-w3-l8-ins20": [[ins20]],
    "cse332-w3-l8-which-case": [[avlTrace(parse(T_P), 3)], [avlTrace(parse(T_P), 17)], [avlTrace(parse(T_P), 25)], [avlTrace(parse(T_Q), 35)]],
    "cse332-w3-l8-double-steps": [[q12]],
    "cse332-w3-l8-double": [[seqCases[30]], [seqCases[25]], [seqCases[28]], [seqCases[27]]],
  };
  for (const [tid, parts] of Object.entries(plan)) {
    const want = parts.flatMap(([tr, pick]) => (pick ? pick.map((i) => tr.states[i]) : tr.states));
    const got = stepPics(tid);
    ok(got.map((g) => g.shape).join(" | ") === want.map((w) => str(w.t)).join(" | "), `${tid}: pictures ${got.map((g) => g.shape).join(" | ")} vs ${want.map((w) => str(w.t)).join(" | ")}`);
    got.forEach((g, i) => {
      const w = want[i];
      if (!w) return;
      ok(g.cmp === String(w.cmp), `${tid}: picture ${i + 1} circles ${g.cmp}, the moving node is ${w.cmp}`);
      ok(w.bst ? sameSet((g.bad || "").split(",").filter(Boolean), problems(w.t)) : g.bad === null, `${tid}: picture ${i + 1} marks unbalanced ${g.bad} (really ${problems(w.t)})`);
    });
  }
  // every other tree drawn on the Lecture 8 pages is a BST; marked problem nodes are exactly its unbalanced nodes
  for (const m of l8.matchAll(/<svg class="htree"(?! data-step)[^>]*>/g)) {
    const s = attr(m[0], "data-shape"), bad = attr(m[0], "data-bad"), t = parse(s);
    ok(isBst(t), `drawn ${s} is a BST`);
    if (!bad && (s === T_A || s === str(treeCheck.Y))) ok(!isAvl(t), `drawn ${s} is unmarked and not AVL: the question asks for its problem node`);
    else if (s === "1(,2(,3(,4(,5(,6(,7))))))") ok(s === str(fromKeys(keysOf(7))) && hgt(t) === 6, "goals: the plain BST of 1..7 is a chain of height 6");
    else ok(bad ? sameSet(bad.split(","), problems(t)) : isAvl(t), `drawn ${s}: ${bad ? `problem nodes ${bad}` : "is AVL"} (really ${problems(t)})`);
  }
  has('data-shape="4(2(1,3),6(5,7))"', "goals AVL picture"); ok(str(avlKeys(keysOf(7)).t) === "4(2(1,3),6(5,7))" && avlKeys(keysOf(7)).log.length === 4 && hgt(avlKeys(keysOf(7)).t) === 2, "1..7 into an AVL tree: four rotations, height 2");
  has("Four rotations along the way keep it at height 2", "goals caption");
  // the four-case pictures: inserting the before tree's keys (pre-order) gives the before tree, then the after tree
  const caseFigs = [...l8.matchAll(/<figcaption>(LL|RR|LR|RL): [^<]*<\/figcaption><div class="av-pair"><svg class="htree" data-shape="([^"]+)"[^>]*><\/svg><span class="arrow">→<\/span><svg class="htree" data-shape="([^"]+)"/g)];
  ok(caseFigs.map((m) => m[1]).join() === "LL,RR,LR,RL", "four case pictures, in order");
  for (const [, kase, before, after] of caseFigs) {
    const ks = pre(parse(before));
    ok(str(fromKeys(ks)) === str(parse(before)), `${kase}: before picture is the BST of ${ks}`);
    ok(caseOf(ks) === kase && str(avlKeys(ks).t) === after, `${kase}: ${ks} gives case ${caseOf(ks)} and ${str(avlKeys(ks).t)}`);
  }
  // 9, 5, 7: one right rotation leaves 5 unbalanced
  ok(str(rotR(parse("9(5(,7),)"))) === "5(,9(7,))" && problems(parse("5(,9(7,))")).join() === "5", "9,5,7: a single right rotation fails");
  // the smallest AVL trees: brute force over every shape up to 12 nodes
  ok([0, 1, 2, 3, 4].map((hh) => minNodesBrute[hh]).join() === [0, 1, 2, 3, 4].map(M).join(), `brute force fewest nodes per height ${JSON.stringify(minNodesBrute)}`);
  for (let hh = 0; hh <= 3; hh++) {
    const s = Sim.minAVLShape(hh), t = parse(s);
    ok(isAvl(t) && isBst(t) && hgt(t) === hh && ino(t).length === M(hh), `minimal tree of height ${hh}: ${s}`);
    ok(l8.includes(`: ${M(hh)} node${hh ? "s" : ""}</figcaption><svg class="htree" data-shape="${s}" data-label="h">`), `the page draws the minimal tree of height ${hh}`);
  }
  has("\\(M(h)\\)</th><td>1</td><td>2</td><td>4</td><td>7</td><td>12</td><td>20</td><td>33</td></tr>", "M(h) row, h = 0..6");
  has("\\(= M(1) + M(0) + 1 = 2 + 1 + 1 = 4\\)", "M(2)"); has("\\(= M(2) + M(1) + 1 = 4 + 2 + 1 = 7\\)", "M(3)"); has("\\(= 7 + 4 + 1 = 12\\)", "M(4)");
  has("\\(= 54 + 33 + 1 = 88\\)", "M(8)"); has("\\(= 88 + 54 + 1 = 143\\)", "M(9)"); has("\\(M(5) = 20\\), \\(M(6) = 33\\) and \\(M(7) = 54\\)", "problem 6 givens");
  ok(M(9) === 143 && M(8) <= 100 && M(9) > 100, "M(8) <= 100 < M(9)");
  const phi = (1 + Math.sqrt(5)) / 2;
  const Ms = [1, 2];
  for (let hh = 2; hh <= 60; hh++) Ms.push(Ms[hh - 1] + Ms[hh - 2] + 1);
  let grow = Ms.slice(0, 12).join() === [...Array(12).keys()].map(M).join();
  for (let hh = 0; hh <= 60; hh++) { grow &&= Ms[hh] >= phi ** hh && Ms[hh] >= 1.6 ** hh; if (hh >= 1) grow &&= Ms[hh] / Ms[hh - 1] > 1.6; }
  ok(grow, "M(h) >= phi^h >= 1.6^h, and each M(h) is more than 1.6 times the one before");
  has("a plain BST can reach height 999,999. An AVL tree stays at height 27 or less. The shortest possible tree, a complete one, has height 19", "a million keys");
  ok(maxH(1e6) === 27 && Math.floor(Math.log2(1e6)) === 19 && hgt(fromKeys(keysOf(1000))) === 999, "a million keys: AVL at most 27, complete 19, chain n - 1");
  // balance page: the worked numbers for the non-AVL tree
  { const c = parse("9(3(,6(5,)),10(,16))"); ok(hgt(sub(c, 3)[1]) === -1 && nodeH(c, 6) === 1 && nodeH(c, 3) === 2 && nodeH(c, 10) === 1, "tree C: 3 has −1 and 1; the root has 2 and 1"); }
  has("3 has no left child (height \\(-1\\)) and its right child 6 has height 1: \\(-1 - 1 = -2\\). The root is fine (\\(2 - 1 = +1\\))", "tree C numbers");
  // quick checks and multiple choice whose answers come from a tree
  ok(problems(parse(T_A)).length === 1, "tree A has exactly one problem node");
  ok(sameSet(problems(ins8.states[0].t), [6, 9]) && ins8.kase === "RR", "insert 8: 6 and 9 unbalanced, fix at 6 (RR)");
  ok(problems(fromKeys([1, 2, 3])).join() === "1" && /data-correct><input type="radio" name="cse332-w3-l8-qc-chain3"> 1,/.test(l8), "chain 1, 2, 3: only 1 is a problem node, and it is the marked option");
  ok(sameSet(problems(ins20.states[0].t), [16, 11]), "insert 20: 16 and 11 unbalanced");
  ok(str(avlKeys([3, 8, 5]).t) === "5(3,8)" && caseOf([3, 8, 5]) === "RL", "3, 8, 5: RL, root 5");
  { const lr = avlKeys([9, 5, 7]).t; ok(lr[0] === 7 && lr[1][0] === 5 && lr[2][0] === 9, "case LR: the middle key c ends on top, b left, a right"); }
  ok(!/details class="notes"|slide \d|Check your understanding|id="l8-quiz"/.test(l8) && !html.includes('href="#l8-quiz"'), "Lecture 8: no teaching notes, slide numbers or quiz page");
}

console.log(`verify-answers: ${pass} passed, ${fail} failed (${keys} auto-graded answer keys, ${mcs} multiple-choice items)`);
process.exit(fail ? 1 : 0);
