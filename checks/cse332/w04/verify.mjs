// Ground truth for every computed answer on site/cse332/w04/.
// 1. Independent implementations written here (not shared with sim.js): the slides' BST and AVL insert (heights
//    recomputed from scratch, cases picked by balance factors), the string hashes h1-h4 (direct sums, not Horner),
//    and hash tables with chaining, linear / quadratic / double-hashing probes and tombstones. sim.js, which the
//    widgets run, must agree with them on the slides' examples and on random inputs.
// 2. Every auto-graded key in the page must have an expected value here and be graded correct; every misconception
//    value must be graded wrong; every multiple-choice item has exactly one right option.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const here = new URL(".", import.meta.url).pathname;
const G = require("../../../site/core/grader.js");
const Sim = require("../../../site/cse332/w04/sim.js");

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL", msg); } };
/* AVL ---------------------------------------------------------------- 1b. AVL trees, independently */
// trees as nested arrays [key, left, right] (null = empty); keys are numbers, or letters in Section 4's picture
const parseT = (s) => {
  let i = 0;
  const tree = () => {
    if (i >= s.length || s[i] === "," || s[i] === ")") return null;
    let j = i; while (j < s.length && !"(),".includes(s[j])) j++;
    const k = s.slice(i, j); i = j;
    const t = [/^-?\d+$/.test(k) ? Number(k) : k, null, null];
    if (s[i] === "(") { i++; t[1] = tree(); i++; t[2] = tree(); i++; }
    return t;
  };
  return tree();
};
const ins = (t, k) => (!t ? [k, null, null] : k === t[0] ? t : k < t[0] ? [t[0], ins(t[1], k), t[2]] : [t[0], t[1], ins(t[2], k)]);
const hgt = (t) => (!t ? -1 : 1 + Math.max(hgt(t[1]), hgt(t[2])));
const str = (t) => (!t ? "" : !t[1] && !t[2] ? String(t[0]) : `${t[0]}(${str(t[1])},${str(t[2])})`);
const pre = (t) => (!t ? [] : [t[0], ...pre(t[1]), ...pre(t[2])]);
const ino = (t) => (!t ? [] : [...ino(t[1]), t[0], ...ino(t[2])]);
const count = (t) => ino(t).length;
const fromKeys = (ks) => ks.reduce(ins, null);
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
// unbalanced nodes, deepest first
function problems(t) { const out = []; const w = (x, d) => { if (!x) return; w(x[1], d + 1); w(x[2], d + 1); if (unb(x)) out.push([x[0], d]); }; w(t, 0); return out.sort((a, b) => b[1] - a[1]).map((x) => x[0]); }
const sub = (t, k) => (t[0] === k ? t : sub(k < t[0] ? t[1] : t[2], k));
const nodeH = (t, k) => hgt(sub(t, k));
const replaceAt = (t, k, f) => (t[0] === k ? f(t) : k < t[0] ? [t[0], replaceAt(t[1], k, f), t[2]] : [t[0], t[1], replaceAt(t[2], k, f)]);
// One insert as whole-tree states: the BST insert, then the tree after each rotation at the first unbalanced node on
// the path back up. cmp is the node each rotation lifts.
function avlTrace(t, k) {
  const t0 = ins(t, k), states = [{ t: t0, cmp: null, bst: true }];
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
  return { states, kase, path, at, c1: c1[0], d1, d2 };
}
// a whole sequence: each insert's trace, starting from the tree the one before left
const seqTrace = (ks) => { let t = null; return ks.map((k) => { const tr = avlTrace(t, k); t = tr.states.at(-1).t; return { k, ...tr }; }); };
const M = (h) => (h === 0 ? 1 : h === 1 ? 2 : M(h - 1) + M(h - 2) + 1);
const maxH = (n) => { let h = 0; while (M(h + 1) <= n) h++; return h; };
const leaves = (t) => (!t ? 0 : !t[1] && !t[2] ? 1 : leaves(t[1]) + leaves(t[2]));
const minTree = (h) => (h < 0 ? null : [0, minTree(h - 1), minTree(h - 2)]);
const shapeOnly = (t) => (!t ? "" : `(${shapeOnly(t[1])},${shapeOnly(t[2])})`);
const caseFor = (ks, k) => { const tr = seqTrace(ks).find((x) => x.k === k); return tr.kase.toLowerCase(); };
// brute force: every binary tree shape with up to 12 nodes, keep the AVL ones, record the fewest nodes per height
const minNodesBrute = (() => {
  const byN = [[null]];
  for (let n = 1; n <= 12; n++) {
    byN[n] = [];
    for (let l = 0; l < n; l++) for (const L of byN[l]) for (const R of byN[n - 1 - l]) byN[n].push([0, L, R]);
  }
  const best = {};
  for (let n = 1; n <= 12; n++) for (const t of byN[n]) if (isAvl(t)) { const hh = hgt(t); best[hh] = Math.min(best[hh] ?? Infinity, n); }
  return best;
})();
// references as "parent>child" edges, and a rotation at p of the lettered picture
const edgesOf = (t) => (!t ? [] : [...[t[1], t[2]].filter(Boolean).map((c) => `${t[0]}>${c[0]}`), ...edgesOf(t[1]), ...edgesOf(t[2])]);
const atP = (t, f) => [t[0], f(t[1]), t[2]];
const find = (t, k) => (!t ? null : t[0] === k ? t : find(t[1], k) || find(t[2], k));

// sim.js vs these, on random sequences: the stepper's trees and cases are the real insert's
{
  let seed = 332;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let trial = 0; trial < 300; trial++) {
    const ks = [...new Set(Array.from({ length: 1 + Math.floor(rnd() * 14) }, () => Math.floor(rnd() * 40) - 5))];
    const { t, log } = avlKeys(ks), tr = seqTrace(ks), steps = Sim.avlSeqSteps(ks);
    const want = tr.flatMap((x) => x.states.map((s) => str(s.t)));
    ok(steps.slice(1).map((s) => s.shape).join(" | ") === want.join(" | "), `avlSeqSteps ${ks}: pictures`);
    ok(steps.filter((s) => s.kind === "insert" && s.kase).map((s) => `${s.kase}@${s.at}`).join() === log.map((x) => x.join("@")).join(), `avlSeqSteps ${ks}: cases`);
    ok(steps.at(-1).shape === str(t) && isAvl(t) && isBst(t), `avlSeqSteps ${ks}: ends at the AVL tree ${str(t)}`);
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
// sim.js vs these: the page's examples and random tables in every mode
{
  let seed = 4332;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let trial = 0; trial < 300; trial++) {
    const size = [5, 7, 10, 11, 13][trial % 5];
    const keys = Array.from({ length: Math.floor(rnd() * size) + 1 }, () => Math.floor(rnd() * 120));
    for (const [mode, probe] of [["linear", LIN(size)], ["quadratic", QUAD(size)], ["double", DBL(size, g7)]]) {
      const mine = oaTable(size, probe), sim = Sim.table(size, mode, mode === "double" ? g7 : undefined);
      for (const k of keys) { const a = oaInsert(mine, k), b = Sim.insert(sim, k); ok(a.at === b.index && a.path.join() === b.probes.join(), `${mode} insert ${k} (size ${size})`); }
      const del = keys[Math.floor(rnd() * keys.length)];
      oaDelete(mine, del); Sim.remove(sim, del);
      for (const k of [...keys, 999]) { const a = oaFind(mine, k), b = Sim.find(sim, k); ok(a.at === (b.found ? b.index : -1) && a.path.join() === b.probes.join(), `${mode} find ${k} after deleting ${del}`); }
      const x = 1000 + trial; const a = oaInsert(mine, x), b = Sim.insert(sim, x); ok(a.at === b.index, `${mode} insert after delete reuses tombstone the same way`);
    }
    const c = chain(size, keys), s = Sim.buildTable(size, "chain", keys).t;
    ok(JSON.stringify(c) === JSON.stringify(s.slots), `chaining size ${size}`);
  }
}


/* ---------------------------------------------------------------- 2. expected values for every key */
const sp = (a) => a.join(" ");
const yn = (b) => (b ? "yes" : "no");
/* AVL */
const P12534 = [1, 2, 5, 3, 4], R3 = [10, 20, 15, 5, 1, 3];
const PS2 = [10, 4, 5, 8, 9, 6, 11, 3, 2, 1, 14], PS4 = [6, 5, 4, 3, 2, 1, 10, 9, 8, 7];
const S2 = avlKeys(PS2), S4 = avlKeys(PS4);
const Z25 = avlTrace(fromKeys([40, 20, 60, 10, 30]), 25), I95 = avlTrace(parseT("50(30(20,40),70(60,80(,90)))"), 95);
const parentKey = (t, k) => { let par = null; while (t[0] !== k) { par = t[0]; t = k < t[0] ? t[1] : t[2]; } return par; };
const Q1 = (() => { const before = parseT("a(p(b(W,X),c(Y,Z)),V)"), after = atP(before, rotL); return { before, after }; })();
const Q1MOVED = (() => { const par = (t, k, up = null) => (!t ? null : t[0] === k ? up : par(t[1], k, t[0]) ?? par(t[2], k, t[0])); return ["V", "W", "X", "Y", "Z"].find((k) => par(Q1.before, k) !== par(Q1.after, k)); })();
const lin10 = oa(10, LIN(10), [38, 19, 8, 109, 10]);
const tomb = (() => { const t = oaTable(10, LIN(10)); for (const k of [3, 13, 23, 33, 43]) oaInsert(t, k); oaDelete(t, 13); const f43 = oaFind(t, 43), f53 = oaFind(t, 53), i53 = oaInsert(t, 53); return { f43, f53, i53 }; })();
const quad = oa(7, QUAD(7), [76, 40, 48, 5, 55, 47]);
const dbl = oa(11, DBL(11, g7), [13, 24, 35, 2]);
const re = (() => { const t = oa(7, LIN(7), [76, 40, 48, 5]).t; let size = 14; while (!Sim.isPrime(size)) size++; const u = oaTable(size, LIN(size)); for (const k of t.a) if (k !== null) oaInsert(u, k); return { size, at76: u.a.indexOf(76) }; })();
const ch7 = chain(7, [10, 24, 3, 17, 31, 5, 12]);
const frac = (n, d) => G.qToPlain(G.Q(BigInt(n), BigInt(d)));
const firstPrimeAtLeast = (n) => { while (!Sim.isPrime(n)) n++; return n; };

const EXPECT = {
  // Lecture 9
  "cse332-w4-l9-qc-insert6": String(seqTrace([1, 2, 5, 3, 4, 6]).at(-1).at), "cse332-w4-l9-qc-maxh15": String(maxH(15)),
  "cse332-w4-l9-zigzag.problem": String(Z25.at), "cse332-w4-l9-zigzag.case": Z25.kase.toLowerCase(), "cse332-w4-l9-zigzag.mid": String(Z25.states[1].t[1][0]),
  "cse332-w4-l9-zigzag.root": String(Z25.states.at(-1).t[0]), "cse332-w4-l9-zigzag.p25": String(parentKey(Z25.states.at(-1).t, 25)),
  "cse332-w4-l9-three-bad.count": String(problems(I95.states[0].t).length), "cse332-w4-l9-three-bad.fix": String(I95.at), "cse332-w4-l9-three-bad.case": I95.kase.toLowerCase(),
  "cse332-w4-l9-three-bad.root50": yn(!unb(I95.states.at(-1).t)),
  "cse332-w4-l9-recipe.case15": caseFor(R3, 15), "cse332-w4-l9-recipe.case5": caseFor(R3, 5), "cse332-w4-l9-recipe.case1": caseFor(R3, 1), "cse332-w4-l9-recipe.case3": caseFor(R3, 3),
  "cse332-w4-l9-recipe.root": String(avlKeys(R3).t[0]),
  "cse332-w4-l9-cyu-insert-cost": "log n",
  "cse332-w4-l9-how-tall.m5": String(M(5)), "cse332-w4-l9-how-tall.short5": String(count(minTree(5)[2])), "cse332-w4-l9-how-tall.avl40": String(maxH(40)),
  "cse332-w4-l9-how-tall.bst40": String(hgt(fromKeys(Array.from({ length: 40 }, (_, i) => i)))),
  // Lecture 10
  "cse332-w4-l10-qc-callerid-7": String(md(2068675309n, 7)), "cse332-w4-l10-qc-h2-cat": String(h2("cat")),
  "cse332-w4-l10-qc-lambda": frac(6, 10), "cse332-w4-l10-qc-success": frac(15, 20),
  "cse332-w4-l10-caller.a10": String(md(2065551234n, 10)), "cse332-w4-l10-caller.a7": String(md(2065551234n, 7)), "cse332-w4-l10-caller.first": "2065551234"[0], "cse332-w4-l10-caller.collide": yn("2065551234"[0] === "2068675309"[0]),
  "cse332-w4-l10-strings.h1": String(h1("cat")), "cse332-w4-l10-strings.h2": String(h2("cat")), "cse332-w4-l10-strings.h3": String(h3("cat")), "cse332-w4-l10-strings.h4idx": String(md(h4("cat"), 10)),
  "cse332-w4-l10-props.consistent": "yes", "cse332-w4-l10-props.uniform": "no", "cse332-w4-l10-props.effective": yn(String(2068675309)[0] !== String(2068675305)[0]), "cse332-w4-l10-props.efficient": "yes",
  "cse332-w4-l10-chain.bucket3": String(ch7[3].length), "cse332-w4-l10-chain.lambda": frac(ch7.flat().length, 7), "cse332-w4-l10-chain.miss": String(ch7[md(38, 7)].length), "cse332-w4-l10-chain.hit": String(ch7[md(31, 7)].indexOf(31) + 1),
  "cse332-w4-l10-load.ex1": frac(3, 10), "cse332-w4-l10-load.ex3": frac(15, 10), "cse332-w4-l10-load.miss3": frac(15, 10), "cse332-w4-l10-load.hit3": frac(15, 20),
  "cse332-w4-l10-cyu-worst": "n", "cse332-w4-l10-cyu-h1-ab": String(h1("ab")), "cse332-w4-l10-cyu-h3-ab": String(h3("ab")), "cse332-w4-l10-cyu-lambda": frac(20, 8),
  // Section 4
  "cse332-w4-s4-qc-sorted-bst": String(hgt(fromKeys(Array.from({ length: 100 }, (_, i) => i + 1)))),
  "cse332-w4-s4-q0.keys": "comparable", "cse332-w4-s4-q0.values": "any", "cse332-w4-s4-q0.job1": "avl", "cse332-w4-s4-q0.job2": "hash",
  "cse332-w4-s4-q1.aleft": "c", "cse332-w4-s4-q1.pright": "cleft", "cse332-w4-s4-q1.cleft": "p", "cse332-w4-s4-q1.moves": Q1MOVED.toLowerCase(),
  "cse332-w4-s4-q2.case5": caseFor(PS2, 5), "cse332-w4-s4-q2.case9": caseFor(PS2, 9), "cse332-w4-s4-q2.case6": caseFor(PS2, 6), "cse332-w4-s4-q2.case11": caseFor(PS2, 11),
  "cse332-w4-s4-q2.case2": caseFor(PS2, 2), "cse332-w4-s4-q2.case1": caseFor(PS2, 1), "cse332-w4-s4-q2.root": String(S2.t[0]), "cse332-w4-s4-q2.pre": sp(pre(S2.t)),
  "cse332-w4-s4-q3.nodes": String(M(4)), "cse332-w4-s4-q3.short": String(hgt(minTree(4)[2])), "cse332-w4-s4-q3.leaves": String(leaves(minTree(4))),
  "cse332-w4-s4-q4.first6": String(avlKeys(PS4.slice(0, 6)).log.length), "cse332-w4-s4-q4.case9": caseFor(PS4, 9), "cse332-w4-s4-q4.case8": caseFor(PS4, 8), "cse332-w4-s4-q4.case7": caseFor(PS4, 7),
  "cse332-w4-s4-q4.root": String(S4.t[0]), "cse332-w4-s4-q4.pre": sp(pre(S4.t)),
  // Lecture 11
  "cse332-w4-l11-qc-109": String(lin10.log[3].at), "cse332-w4-l11-qc-55": String(quad.log[4].at), "cse332-w4-l11-qc-rehash-size": String(firstPrimeAtLeast(14)),
  "cse332-w4-l11-linear.i8": String(lin10.log[2].at), "cse332-w4-l11-linear.i10": String(lin10.log[4].at), "cse332-w4-l11-linear.find29": String(oaFind(lin10.t, 29).path.length),
  "cse332-w4-l11-tomb.find43": String(tomb.f43.path.length), "cse332-w4-l11-tomb.found43": yn(tomb.f43.at >= 0), "cse332-w4-l11-tomb.find53": String(tomb.f53.path.length), "cse332-w4-l11-tomb.ins53": String(tomb.i53.at),
  "cse332-w4-l11-quad.i48": String(quad.log[2].at), "cse332-w4-l11-quad.i5": String(quad.log[3].at), "cse332-w4-l11-quad.i55": String(quad.log[4].at), "cse332-w4-l11-quad.fits47": yn(quad.log[5].at >= 0), "cse332-w4-l11-quad.lambda": frac(5, 7),
  "cse332-w4-l11-double.g24": String(g7(24)), "cse332-w4-l11-double.i24": String(dbl.log[1].at), "cse332-w4-l11-double.i35": String(dbl.log[2].at), "cse332-w4-l11-double.i2": String(dbl.log[3].at),
  "cse332-w4-l11-rehash.lambda": frac(4, 7), "cse332-w4-l11-rehash.should": yn(4 / 7 > 0.5), "cse332-w4-l11-rehash.size": String(re.size), "cse332-w4-l11-rehash.i76": String(re.at76),
  "cse332-w4-l11-cluster.linear": "primary", "cse332-w4-l11-cluster.quadratic": "secondary", "cse332-w4-l11-cluster.double": "none",
  "cse332-w4-l11-cyu-linear-idx": String(oa(10, LIN(10), [3, 4, 23]).log[2].at), "cse332-w4-l11-cyu-lambda-max": "1",
  "cse332-w4-l11-cyu-quad-third": String(QUAD(7)(5, 2)), "cse332-w4-l11-cyu-double-step": String(DBL(11, () => 6)(3, 1)), "cse332-w4-l11-cyu-chain-threshold": "2",
};
// facts the expectations and prose rely on
ok(quad.log.map((x) => x.at).join() === "6,5,0,2,3,-1" && quad.log[5].path.slice(0, 7).join() === "5,6,2,0,0,2,6" && quad.t.a.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0).join() === "1,4", "slide 29 table, 47's probes, empty slots 1 and 4");
ok([...new Set([0, 1, 2, 3, 4, 5, 6].map((i) => (i * i) % 7))].sort().join() === "0,1,2,4", "squares mod 7");
ok(lin10.t.a.join() === "8,109,10,,,,,,38,19" && oaFind(lin10.t, 29).path.join() === "9,0,1,2,3", "linear probing table and find(29)");
ok(tomb.f43.path.join() === "3,4,5,6,7" && tomb.f53.path.join() === "3,4,5,6,7,8", "tombstone probe paths");
ok(dbl.log.map((x) => x.path.join("-")).join(" ") === "2 2-6 2-9 2-7", "double hashing paths");
ok(md(2068675309n, 10) === 9 && md(2068675309n, 7) === 1 && 2065551234 === 7 * 295078747 + 5, "caller-ID arithmetic");
ok(h3("cat") === 114582n && 97 * 31 === 3007 && 116 * 961 === 111476 && Sim.horner("cat").join() === "116,3693,114582" && h4("cat") === 229164n, "h3(cat) steps");
ok(h2("cat") === h2("act") && h3("cat") !== h3("act") && h2("dog") === h2("god") && h3("dog") !== h3("god"), "anagrams collide under h2 only");
ok([10, 24, 3, 17, 31].every((k) => k % 7 === 3) && [5, 12].every((k) => k % 7 === 5), "the size-7 chaining keys");
ok(ch7[3].join() === "10,24,3,17,31", "bucket 3 order");
ok(76 % 17 === 8 && 40 % 17 === 6 && 48 % 17 === 14 && 5 % 17 === 5 && !Sim.isPrime(14) && !Sim.isPrime(15) && !Sim.isPrime(16), "rehash to 17");
/* ---------------------------------------------------------------- 3. the page's keys */
const html = readFileSync(`${here}../../../site/cse332/w04/index.html`, "utf8");
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


/* AVL ---------------------------------------------------------------- 4. Lecture 9 and Section 4: steppers, pictures, text */
{
  const pageOf = (id) => { const at = html.indexOf(`<section class="page" id="${id}"`); return html.slice(at, html.indexOf("</section>", at)); };
  const mine = ["l9-goals", "l9-insert", "l9-minimal", "l9-practice", "s4-goals", "s4-abc", "s4-refs", "s4-practice"];
  const text = mine.map(pageOf).join("\n");
  const has = (s, why) => ok(text.includes(s), `page states "${s}" (${why})`);
  const mf = (k) => (typeof k === "number" && k < 0 ? `−${-k}` : String(k));
  const sameSet = (a, b) => [...a].map(String).sort().join() === [...b].map(String).sort().join();
  const marked = (st, role) => Object.entries(st.marks).filter(([, v]) => v.split(" ").includes(role)).map(([k]) => k);
  const listOf = (ks) => (ks.length < 3 ? ks.map(mf).join(" and ") : `${ks.slice(0, -1).map(mf).join(", ")} and ${mf(ks.at(-1))}`);

  // the rail and the pages: no quiz, no teaching notes, no slide numbers, every page linked from the rail
  ok(!/details class="notes"|slide \d|Slide \d|Check your understanding|cyu-list/.test(text), "Lecture 9 and Section 4: no teaching notes, slide numbers or quiz");
  ok(!/id="(l9|s4)-quiz"|href="#(l9|s4)-quiz"/.test(html), "no Lecture 9 or Section 4 quiz page or rail link");
  for (const id of mine) ok(html.includes(`<li><a href="#${id}">`), `rail links ${id}`);

  // Lecture 9's sequence stepper: every picture, mark, blank and narrated claim against the independent trace
  const seqs = [...text.matchAll(/class="panel avl-seq" data-keys="([^"]+)"/g)].map((m) => m[1].split(",").map(Number));
  ok(seqs.length === 1 && seqs[0].join() === P12534.join(), "Lecture 9 steps through 1, 2, 5, 3, 4");
  for (const ks of seqs) {
    const steps = Sim.avlSeqSteps(ks), tr = seqTrace(ks);
    const FIX = { LL: (x) => `rotate right at ${x.at}`, RR: (x) => `rotate left at ${x.at}`, LR: (x) => `rotate left at ${x.c1}, then right at ${x.at}`, RL: (x) => `rotate right at ${x.c1}, then left at ${x.at}` };
    ok(steps[0].kind === "start" && steps[0].shape === "" && Object.keys(steps[0].card).length === 0, "stepper starts empty, with the recipe's blanks empty");
    let k = 1, prev = null;
    for (const x of tr) {
      const st = steps[k++], t0 = x.states[0].t, tag = `stepper insert ${x.k}`;
      ok(st.kind === "insert" && st.shape === str(t0), `${tag}: picture ${st.shape}`);
      ok(sameSet(marked(st, "bad"), problems(t0)) && marked(st, "new").join() === String(x.k), `${tag}: marks the new key and exactly the unbalanced nodes ${problems(t0)}`);
      for (const [key, hv] of Object.entries(st.heights)) ok(hv === nodeH(t0, Number(key)), `${tag}: height of ${key}`);
      const c = st.card;
      if (!prev) ok(c.where === "the root" && st.say.includes("becomes the root"), `${tag}: first key is the root`);
      else {
        const par = parentKey(t0, x.k), side = x.k < par ? "left" : "right";
        ok(c.where === `a leaf under ${par}` && st.say.includes(`${x.path.map((p) => `${mf(x.k)} ${x.k < p ? "<" : ">"} ${mf(p)}`).join(", ")}, so ${mf(x.k)} becomes ${mf(par)}'s ${side} child`), `${tag}: BST insert narration "${st.say}"`);
        const walked = x.at === null ? [...x.path].reverse() : [...x.path].reverse().slice(0, [...x.path].reverse().indexOf(x.at) + 1);
        for (const n of walked) { const s = sub(t0, n); ok(st.say.includes(`${mf(n)} has children ${mf(hgt(s[1]))} and ${mf(hgt(s[2]))}`), `${tag}: walk-up claim for ${n}`); }
        const others = problems(t0).filter((n) => n !== x.at);
        ok(others.length ? st.say.includes(`${listOf(others)} ${others.length > 1 ? "are" : "is"} unbalanced too, higher up`) : !st.say.includes("unbalanced too"), `${tag}: names the other unbalanced nodes`);
      }
      ok(c.key === String(x.k) && c.problem === (x.at === null ? "none" : String(x.at)) && c.kase === (x.at === null ? "none" : x.kase), `${tag}: card ${JSON.stringify(c)}`);
      if (x.at !== null) {
        const path = `${x.d1 === "L" ? "left" : "right"}, then ${x.d2 === "L" ? "left" : "right"}`;
        ok(c.path === path && c.fix === FIX[x.kase](x) && st.say.includes(`case ${x.kase}`), `${tag}: case ${x.kase} and fix "${c.fix}"`);
      }
      x.states.slice(1).forEach((want, i) => {
        const rs = steps[k++], last = i === x.states.length - 2;
        ok(rs.kind === "rotate" && rs.shape === str(want.t) && rs.up === want.cmp && marked(rs, "cmp").join() === String(want.cmp), `${tag}: rotation ${i + 1} picture ${rs.shape} vs ${str(want.t)}`);
        ok(sameSet(marked(rs, "bad"), problems(want.t)), `${tag}: rotation ${i + 1} marks unbalanced ${problems(want.t)}`);
        ok(rs.card.now === "fix" && rs.card.kase === x.kase, `${tag}: rotation ${i + 1} keeps the card on the fix`);
        if (last) {
          const before = nodeH(prev, x.at), top = nodeH(want.t, want.cmp);
          ok(before === top && rs.say.includes(`has height ${top}, the same as ${mf(x.at)}'s before the insert (${before})`) && isAvl(want.t), `${tag}: fixed subtree back to height ${before}`);
        }
      });
      prev = x.states.at(-1).t;
    }
    ok(k === steps.length, "stepper has no extra steps");
  }
  has("That's why inserting 4 needed nothing at 2", "rule");
  { const x = seqTrace(P12534).at(-1); ok(x.at === 5 && sameSet(problems(x.states[0].t), [5, 2]) && !unb(x.states.at(-1).t), "inserting 4: 5 and 2 unbalanced, fix at 5 fixes 2"); }
  { const x = seqTrace([1, 2, 5, 3, 4, 6]).at(-1); ok(x.at === 2 && x.kase === "RR" && x.states.at(-1).t[0] === 4 && nodeH(x.states[0].t, 5) === 1 && hgt(sub(x.states[0].t, 5)[1]) === -1, "insert 6: fix at 2, RR, 4 moves up; 5 has children −1 and 0"); }

  // the smallest trees: the builder against brute force
  ok([0, 1, 2, 3, 4].map((hh) => minNodesBrute[hh]).join() === [0, 1, 2, 3, 4].map(M).join(), `brute force fewest nodes per height ${JSON.stringify(minNodesBrute)}`);
  ok(/class="panel min-step" data-h="4"/.test(text), "Lecture 9 builds heights 0 to 4");
  for (const st of Sim.minSteps(4)) {
    const t = parseT(st.shape), hh = st.h;
    ok(isAvl(t) && isBst(t) && hgt(t) === hh && count(t) === M(hh) && st.M === M(hh) && shapeOnly(t) === shapeOnly(minTree(hh)), `minimal tree of height ${hh}: ${st.shape}`);
    ok(st.root === t[0] && st.left.join() === ino(t[1]).join() && st.right.join() === ino(t[2]).join() && (hh === 0 || (hgt(t[1]) === hh - 1 && hgt(t[2]) === hh - 2)), `height ${hh}: root and sides`);
    if (hh >= 2) ok(st.say.includes(`M(${hh}) = M(${hh - 1}) + M(${hh - 2}) + 1 = ${M(hh - 1)} + ${M(hh - 2)} + 1 = ${M(hh)}`), `height ${hh} narration`);
  }
  ok(maxH(10) === 3 && M(3) === 7 && M(4) === 12 && hgt(fromKeys(Array.from({ length: 10 }, (_, i) => i))) === 9, "10 nodes: AVL at most 3, chain 9");
  has("\\(M(3) = 7 \\le 10 &lt; 12 = M(4)\\)", "10-node example"); has("A plain BST with 10 nodes can be a chain of height 9", "10-node example");
  { let g = true; for (let hh = 1; hh <= 40; hh++) g &&= M(hh) / M(hh - 1) > 1.6 && M(hh) >= 1.6 ** hh; ok(g, "each M(h) is more than 1.6 times the one before, and M(h) >= 1.6^h"); }
  ok(M(5) === 20 && maxH(15) === 4 && hgt(fromKeys(Array.from({ length: 15 }, (_, i) => i))) === 14 && Math.floor(Math.log2(15)) === 3, "15 nodes: AVL 4, chain 14, full tree 3");
  has("= M(4) + M(3) + 1 = 12 + 7 + 1 = 20", "M(5)"); has("\\(20 + 12 + 1 = 33\\), \\(33 + 20 + 1 = 54\\)", "M(6), M(7)"); has("\\(M(6) = 33 \\le 40 &lt; 54 = M(7)\\)", "40 nodes");
  ok(M(6) === 33 && M(7) === 54 && count(minTree(5)[1]) === 12 && Math.floor(Math.log2(40)) === 5, "40 nodes: numbers in the solution and the misconceptions");

  // Section 4's rewiring stepper and the left rotation: the reference assignments, run on independent trees
  {
    const before = parseT(Sim.LETTERS), right = atP(before, rotR), left = atP(before, rotL);
    ok(Sim.LETTERS === "a(p(b(W,X),c(Y,Z)),V)" && str(parseT(Sim.runRefs(Sim.LETTERS, Sim.REFS.right).shape)) === str(right) && Sim.runRefs(Sim.LETTERS, Sim.REFS.left).shape === str(left), "the three assignments are a right / left rotation at p");
    ok(ino(right).join() === ino(before).join() && ino(left).join() === ino(before).join(), "rotations keep the left-to-right order");
    const diff = (a, b) => ({ removed: edgesOf(a).filter((e) => !edgesOf(b).includes(e)), added: edgesOf(b).filter((e) => !edgesOf(a).includes(e)) });
    const steps = Sim.rewireSteps(), dR = diff(before, right);
    ok(steps.length === 4 && steps[0].shape === str(before) && steps[1].shape === str(before) && steps[2].shape === str(right) && steps[3].shape === str(right), "rewire stepper pictures");
    ok(sameSet(Object.keys(steps[1].edges.bad), dR.removed) && sameSet(Object.keys(steps[2].edges.add), dR.added), `rewire: bad edges ${dR.removed}, new edges ${dR.added}`);
    Sim.REFS.right.forEach((ln, i) => {
      const [, o, side, src, srcSide] = /^(\w+)\.(left|right) = (\w+)(?:\.(left|right))?$/.exec(ln);
      const was = find(before, o)[side === "left" ? 1 : 2][0], now = find(right, o)[side === "left" ? 1 : 2][0];
      const reads = srcSide ? find(before, src)[srcSide === "left" ? 1 : 2][0] : src;
      ok(reads === now && steps[1].edges.bad[`${o}>${was}`] === i + 1 && steps[2].edges.add[`${o}>${now}`] === i + 1 && steps[2].say.includes(`${ln}: ${o}'s ${side} was ${was}, now ${now}`), `rewire line ${i + 1} (${ln}): ${was} → ${now}`);
    });
    ok(steps[2].marks.b === "cmp" && steps[2].marks.X === "moved" && dR.added.filter((e) => e.endsWith(">X")).join() === "p>X", "b moves up, X moves across");
    // practice problem 1's solution pictures
    const q1 = pageOf("s4-practice").slice(pageOf("s4-practice").indexOf('data-id="cse332-w4-s4-q1"'));
    const pics = [...q1.slice(0, q1.indexOf("</article>")).matchAll(/<svg class="htree"[^>]*>/g)].map((m) => m[0]);
    const dL = diff(before, left);
    ok(pics.length === 3 && attr(pics[0], "data-shape") === str(before) && attr(pics[1], "data-shape") === str(before) && attr(pics[2], "data-shape") === str(left), "problem 1 pictures: before, bad edges, after");
    ok(attr(pics[1], "data-bad-edges") === Sim.REFS.left.map((ln) => { const o = ln.split(".")[0], side = ln.split(".")[1].split(" ")[0]; return `${o}>${find(before, o)[side === "left" ? 1 : 2][0]}`; }).join(",") && sameSet(attr(pics[1], "data-bad-edges").split(","), dL.removed), "problem 1: bad edges in code order");
    ok(attr(pics[2], "data-new-edges") === Sim.REFS.left.map((ln) => { const o = ln.split(".")[0], side = ln.split(".")[1].split(" ")[0]; return `${o}>${find(left, o)[side === "left" ? 1 : 2][0]}`; }).join(",") && sameSet(attr(pics[2], "data-new-edges").split(","), dL.added), "problem 1: new edges in code order");
    ok(attr(pics[2], "data-moved") === Q1MOVED && Q1MOVED === "Y" && attr(pics[2], "data-cmp") === "c", "problem 1: Y changes parent, c moves up");
  }

  // practice solutions: each data-step picture is the next state of the real inserts, with the right marks
  const taskBlock = (tid) => { const at = html.indexOf(`data-id="${tid}"`); return html.slice(at, html.indexOf("</article>", at)); };
  const stepPics = (tid) => [...taskBlock(tid).matchAll(/<svg class="htree" data-step[^>]*>/g)].map((m) => ({ shape: attr(m[0], "data-shape"), cmp: attr(m[0], "data-cmp"), bad: attr(m[0], "data-bad"), nw: attr(m[0], "data-new") }));
  const seqStates = (ks, skip = 0) => seqTrace(ks).flatMap((x, i) => x.states.map((s) => ({ ...s, k: x.k })).filter((s) => !(i < skip && s.bst)));
  const plan = {
    "cse332-w4-l9-zigzag": Z25.states.map((s) => ({ ...s, k: 25 })),
    "cse332-w4-l9-three-bad": I95.states.map((s) => ({ ...s, k: 95 })),
    "cse332-w4-l9-recipe": seqStates(R3, 2),
    "cse332-w4-s4-q2": seqStates(PS2, 1),
    "cse332-w4-s4-q4": seqStates(PS4, 1),
  };
  for (const [tid, want] of Object.entries(plan)) {
    const got = stepPics(tid);
    ok(got.map((g) => g.shape).join(" | ") === want.map((w) => str(w.t)).join(" | "), `${tid}: pictures ${got.map((g) => g.shape).join(" | ")} vs ${want.map((w) => str(w.t)).join(" | ")}`);
    got.forEach((g, i) => {
      const w = want[i];
      if (!w) return;
      ok(w.bst ? g.nw === String(w.k) && g.cmp === null : g.cmp === String(w.cmp) && g.nw === null, `${tid}: picture ${i + 1} marks new ${g.nw} / moved up ${g.cmp}`);
      ok(sameSet((g.bad || "").split(",").filter(Boolean), problems(w.t)), `${tid}: picture ${i + 1} marks unbalanced ${g.bad} (really ${problems(w.t)})`);
    });
  }
  ok(str(S2.t) === "8(3(2(1,),5(4,6)),10(9,11(,14)))" && str(S4.t) === "6(3(2(1,),5(4,)),9(8(7,),10))", "Section 4: problems 2 and 4 match the official solutions' trees");
  ok(S2.log.map((x) => x.join("@")).join(" ") === "LR@10 LR@10 RL@5 RR@9 LL@4 LL@5" && S4.log.map((x) => x[0]).join(" ") === "LL LL LL RL RL RR", "Section 4: six fixes in problem 2, the cases in problem 4");
  // the zig-zag and three-node problems' stated numbers
  ok(str(fromKeys([40, 20, 60, 10, 30])) === "40(20(10,30),60)" && avlKeys([40, 20, 60, 10, 30]).log.length === 0, "zig-zag: first five inserts, no rotation");
  { const t = parseT("50(30(20,40),70(60,80(,90)))"), t0 = I95.states[0].t; ok(isAvl(t) && isBst(t) && [90, 80, 70, 50].map((n) => nodeH(t0, n)).join() === "1,2,3,4" && [80, 70, 50].map((n) => `${hgt(sub(t0, n)[1])},${hgt(sub(t0, n)[2])}`).join(" ") === "-1,1 0,2 1,3" && nodeH(t, 80) === 1 && nodeH(I95.states[1].t, 90) === 1, "three unbalanced: heights in the solution"); }
  has("New heights: 90 is 1, 80 is 2, 70 is 3, 50 is 4. 80 has children −1 and 1, 70 has 0 and 2, 50 has 1 and 3", "95 heights");
  { const x = seqTrace(R3).find((y) => y.k === 3); ok(x.at === 15 && x.kase === "LL" && x.path.at(-1) === 1 && 3 > 1, "3 into 15(5(1,10),20): LL at 15 though its last step goes right"); }

  // every other tree on these pages: BSTs, with marked problem nodes exactly the unbalanced ones
  for (const m of text.matchAll(/<svg class="htree"(?! data-step)[^>]*>/g)) {
    const s = attr(m[0], "data-shape"), t = parseT(s), bad = attr(m[0], "data-bad");
    if (/[a-zV-Z]/.test(s)) { ok(s === Sim.LETTERS || s === str(atP(parseT(Sim.LETTERS), rotL)), `lettered picture ${s} is the section's`); continue; }
    ok(isBst(t), `drawn ${s} is a BST`);
    if (s === "1(,2(,5(3(,4),)))") ok(s === str(fromKeys(P12534)) && hgt(t) === 4, "goals: the plain BST of 1, 2, 5, 3, 4 is a chain of height 4");
    else ok(bad ? sameSet(bad.split(","), problems(t)) : isAvl(t), `drawn ${s}: ${bad ? `problem nodes ${bad}` : "is AVL"} (really ${problems(t)})`);
  }
  ok(str(avlKeys(P12534).t) === "2(1,4(3,5))" && hgt(avlKeys(P12534).t) === 2 && avlKeys(P12534).log.reduce((n, [c]) => n + (c[0] === c[1] ? 1 : 2), 0) === 3, "goals: 1, 2, 5, 3, 4 gives 2(1,4(3,5)), height 2, three rotations");
  has("A chain of height 4.", "goals caption"); has("Three rotations along the way keep it at height 2.", "goals caption");
  // problem 3: the drawn smallest trees and their counts
  {
    const q3 = taskBlock("cse332-w4-s4-q3"), pics = [...q3.matchAll(/<svg class="htree"[^>]*>/g)].map((m) => m[0]);
    ok(pics.map((p) => attr(p, "data-shape")).join(" ") === [2, 3, 4].map(Sim.minAVLShape).join(" "), "problem 3 draws the smallest trees of heights 2, 3, 4");
    const t = parseT(attr(pics[2], "data-shape"));
    ok(attr(pics[2], "data-lsub") === ino(t[1]).join() && attr(pics[2], "data-rsub") === ino(t[2]).join() && attr(pics[2], "data-cmp") === String(t[0]), "problem 3: sides marked");
    const lv = (x) => (!x ? [] : !x[1] && !x[2] ? [x[0]] : [...lv(x[1]), ...lv(x[2])]);
    ok(lv(t[1]).join() === "1,4,6" && lv(t[2]).join() === "9,12" && leaves(t) === 5 && hgt(t[2]) === 2 && 2 ** 5 - 1 === 31, "problem 3: leaves 1, 4, 6 and 9, 12; shorter side height 2; full tree 31");
  }
  ok(hgt(fromKeys(Array.from({ length: 100 }, (_, i) => i + 1))) === 99 && hgt(avlKeys(Array.from({ length: 100 }, (_, i) => i + 1)).t) === 6, "100 sorted keys: plain BST 99, AVL 6");
}

console.log(`verify-answers: ${pass} passed, ${fail} failed (${keys} auto-graded answer keys, ${mcs} multiple-choice items)`);
process.exit(fail ? 1 : 0);
