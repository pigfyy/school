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
const half = (n) => n / 2n, eighth = (n) => n / 8n, quarter = (n) => n / 4n, dec = (n) => n - 1n;
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
has("\\(M(h)\\)</th><td>1</td><td>2</td><td>4</td><td>7</td><td>12</td><td>20</td><td>33</td><td>54</td><td>88</td><td>143</td><td>232</td>", "M(h) row");
ok([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(M).join() === "1,2,4,7,12,20,33,54,88,143,232" && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(Sim.minAVL).join() === "1,2,4,7,12,20,33,54,88,143,232", "M(h) values (both implementations)");
has("<td>1</td><td>3</td><td>7</td><td>15</td><td>31</td><td>63</td><td>127</td><td>255</td><td>511</td><td>1023</td><td>2047</td>", "2^(h+1)-1 row");
has("gives \\(T(1024) = 11\\)", "bsearch note"); ok(R.bsearch(1024n) === 11n, "T(1024) = 11");
has("\\(T(2) = 2 + 4 = 6\\), \\(T(4) = 12 + 16 = 28\\), \\(T(8) = 56 + 64 = 120\\)", "square steps"); ok(R.sq(2n) === 6n && R.sq(4n) === 28n, "sq T(2), T(4)");
has("Levels: 8, 8, 8, then 8 leaves", "T(8) why"); ok(Sim.levels(Sim.REC.nlogn, 8).map((l) => l.total).join() === "8,8,8,8", "nlogn levels at 8");
has("\\(T(2) = 4\\), \\(T(4) = 12\\), \\(T(8) = 32\\)", "nlogn build-up"); ok(R.nlogn(2n) === 4n && R.nlogn(4n) === 12n, "nlogn T(2), T(4)");
// the delete-3-first quick check really differs from the sequence answer
ok(del(parse(S22), 3)[2] === 1 && d3.out[2][1] === 0, "deleting 3 first pulls up 1; after deleting 1 it pulls up 0");

console.log(`verify-answers: ${pass} passed, ${fail} failed (${keys} auto-graded answer keys, ${mcs} multiple-choice items)`);
process.exit(fail ? 1 : 0);
