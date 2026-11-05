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
  "cse332-w3-l6-qc-sum-calls": "2",
  "cse332-w3-l6-qc-leaves-16": String(Sim.levels(Sim.REC.sum, 16).at(-1).nodes),
  "cse332-w3-l6-qc-sum-16": String(R.sum(16n)),
  "cse332-w3-l6-qc-eighth-class": "n^(1/3)",
  "cse332-w3-l6-bsearch.a": "1", "cse332-w3-l6-bsearch.t1024": String(R.bsearch(1024n)), "cse332-w3-l6-bsearch.class": "log n",
  "cse332-w3-l6-sum.nodes": "2^i", "cse332-w3-l6-sum.t16": String(R.sum(16n)), "cse332-w3-l6-sum.class": "n",
  "cse332-w3-l6-square.level": "n^2/2^i", "cse332-w3-l6-square.t8": String(R.sq(8n)), "cse332-w3-l6-square.class": "n^2",
  "cse332-w3-l6-eighth.levels": String(Sim.levels(Sim.REC.eighth, 512).length), "cse332-w3-l6-eighth.t512": String(R.eighth(512n)), "cse332-w3-l6-eighth.class": "n^(1/3)",
  "cse332-w3-l6-common.exp": "2^n", "cse332-w3-l6-common.quad": "n^2", "cse332-w3-l6-common.halfn": "n", "cse332-w3-l6-common.loglin": "n log n",
  "cse332-w3-l6-what-matters.base": "no", "cse332-w3-l6-what-matters.f": "no", "cse332-w3-l6-what-matters.a": "yes", "cse332-w3-l6-what-matters.b": "yes",
  "cse332-w3-l6-cyu-halving": "log n", "cse332-w3-l6-cyu-nlogn": "n log n", "cse332-w3-l6-cyu-t8": String(R.nlogn(8n)),
  "cse332-w3-l6-cyu-quadratic": "n^2", "cse332-w3-l6-cyu-square": "n^2", "cse332-w3-l6-cyu-level3": String(3 ** 3), "cse332-w3-l6-cyu-exponential": "2^n",
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
ok([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(M).join() === "1,2,4,7,12,20,33,54,88,143,232" && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(Sim.minAVL).join() === "1,2,4,7,12,20,33,54,88,143,232", "M(h) values (both implementations)");
has("gives \\(T(1024) = 11\\)", "bsearch note"); ok(R.bsearch(1024n) === 11n, "T(1024) = 11");
has("\\(T(2) = 2 + 4 = 6\\), \\(T(4) = 12 + 16 = 28\\), \\(T(8) = 56 + 64 = 120\\)", "square steps"); ok(R.sq(2n) === 6n && R.sq(4n) === 28n, "sq T(2), T(4)");
has("\\(T(2) = 5\\), \\(T(4) = 19\\), \\(T(8) = 65\\)", "1d steps"); ok(R.s1d(2n) === 5n && R.s1d(4n) === 19n && R.s1d(8n) === 65n, "1d T(2..8)");
has("\\(T(3) = 5\\), \\(T(9) = 19\\), \\(T(27) = 65\\)", "1e steps"); ok(R.s1e(3n) === 5n && R.s1e(9n) === 19n && R.s1e(27n) === 65n, "1e T(3..27)");
has("\\(T(2) = 400\\), \\(T(4) = 1200\\), \\(T(8) = 3200\\)", "1c steps"); ok(R.s1c(2n) === 400n && R.s1c(4n) === 1200n && R.s1c(8n) === 3200n, "1c T(2..8)");
has("\\(T(8) = 16\\), \\(T(16) = 32 + 16 = 48\\)", "1b steps"); ok(R.s1b(8n) === 16n, "1b T(8)");
has("Levels: 8, 8, 8, then 8 leaves", "T(8) why"); ok(Sim.levels(Sim.REC.nlogn, 8).map((l) => l.total).join() === "8,8,8,8", "nlogn levels at 8");
has("\\(T(2) = 4\\), \\(T(4) = 12\\), \\(T(8) = 32\\)", "nlogn build-up"); ok(R.nlogn(2n) === 4n && R.nlogn(4n) === 12n, "nlogn T(2), T(4)");
// the delete-3-first quick check really differs from the sequence answer
ok(del(parse(S22), 3)[2] === 1 && d3.out[2][1] === 0, "deleting 3 first pulls up 1; after deleting 1 it pulls up 0");

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
    "cse332-w3-l8-double": [[seqCases[30]], [seqCases[25]], [seqCases[28], [0, 2]], [seqCases[27]]],
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
