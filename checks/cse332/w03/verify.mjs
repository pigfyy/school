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

console.log(`verify-answers: ${pass} passed, ${fail} failed (${keys} auto-graded answer keys, ${mcs} multiple-choice items)`);
process.exit(fail ? 1 : 0);
