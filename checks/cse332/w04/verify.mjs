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
const caseFor = (ks, k) => { const log = []; let t = null; for (const x of ks) { const n = log.length; t = avl(t, x, log); if (x === k) return log.length > n ? log[n][0].toLowerCase() : "none"; } };
const M = (h) => (h === 0 ? 1 : h === 1 ? 2 : M(h - 1) + M(h - 2) + 1);
const maxH = (n) => { let h = 0; while (M(h + 1) <= n) h++; return h; };
const leaves = (t) => (!t ? 0 : !t[1] && !t[2] ? 1 : leaves(t[1]) + leaves(t[2]));
const minTree = (h) => (h < 0 ? null : [0, minTree(h - 1), minTree(h - 2)]);
const P12534 = avlKeys([1, 2, 5, 3, 4]), PLR = avlKeys([40, 20, 60, 10, 30, 25]), PS = avlKeys([5, 10, 15, 20, 25, 30, 35]);
const PS2 = [10, 4, 5, 8, 9, 6, 11, 3, 2, 1, 14], PS4 = [6, 5, 4, 3, 2, 1, 10, 9, 8, 7];
const S2 = avlKeys(PS2), S4 = avlKeys(PS4);
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
  "cse332-w4-l9-qc-rotations": String(P12534.log.reduce((n, [c]) => n + c.length - (c[0] === c[1] ? 1 : 0), 0)),
  "cse332-w4-l9-qc-m6": String(M(6)), "cse332-w4-l9-qc-maxh100": String(maxH(100)),
  "cse332-w4-l9-12534.case5": caseFor([1, 2, 5, 3, 4], 5), "cse332-w4-l9-12534.case4": caseFor([1, 2, 5, 3, 4], 4), "cse332-w4-l9-12534.pre": sp(pre(P12534.t)), "cse332-w4-l9-12534.height": String(hgt(P12534.t)),
  "cse332-w4-l9-lr.problem": String(PLR.log[0][1]), "cse332-w4-l9-lr.case": PLR.log[0][0].toLowerCase(), "cse332-w4-l9-lr.root": String(PLR.t[0]), "cse332-w4-l9-lr.pre": sp(pre(PLR.t)),
  "cse332-w4-l9-sorted.rotations": String(PS.log.length), "cse332-w4-l9-sorted.root": String(PS.t[0]), "cse332-w4-l9-sorted.height": String(hgt(PS.t)),
  "cse332-w4-l9-minimal.m5": String(M(5)), "cse332-w4-l9-minimal.leaves4": String(leaves(minTree(4))), "cse332-w4-l9-minimal.maxh1000": String(maxH(1000)),
  "cse332-w4-l9-cyu-root-12534": String(P12534.t[0]), "cse332-w4-l9-cyu-m3": String(M(3)), "cse332-w4-l9-cyu-insert-cost": "log n", "cse332-w4-l9-cyu-root-sorted": String(avlKeys([1, 2, 3, 4, 5, 6, 7]).t[0]),
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
  "cse332-w4-s4-qc-p2-root": String(S2.t[0]),
  "cse332-w4-s4-q0.keys": "comparable", "cse332-w4-s4-q0.values": "any",
  "cse332-w4-s4-q1.aleft": "c", "cse332-w4-s4-q1.pright": "cleft", "cse332-w4-s4-q1.cleft": "p",
  "cse332-w4-s4-q2.case5": caseFor(PS2, 5), "cse332-w4-s4-q2.case6": caseFor(PS2, 6), "cse332-w4-s4-q2.count": String(S2.log.length), "cse332-w4-s4-q2.pre": sp(pre(S2.t)),
  "cse332-w4-s4-q3.nodes": String(M(4)), "cse332-w4-s4-q3.leaves": String(leaves(minTree(4))),
  "cse332-w4-s4-q4.case9": caseFor(PS4, 9), "cse332-w4-s4-q4.case7": caseFor(PS4, 7), "cse332-w4-s4-q4.root": String(S4.t[0]), "cse332-w4-s4-q4.pre": sp(pre(S4.t)),
  "cse332-w4-s4-cyu-min4": String(M(4)), "cse332-w4-s4-cyu-desc-root": String(avlKeys([6, 5, 4, 3, 2, 1]).t[0]),
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
ok(str(S2.t) === "8(3(2(1,),5(4,6)),10(9,11(,14)))" && str(S4.t) === "6(3(2(1,),5(4,)),9(8(7,),10))", "Section 4: problems 2 and 4 match the official solutions' trees");
ok(S2.log.map((x) => x.join("@")).join(" ") === "LR@10 LR@10 RL@5 RR@9 LL@4 LL@5" && S4.log.map((x) => x[0]).join(" ") === "LL LL LL RL RL RR", "Section 4: the cases named on the page");
ok(str(P12534.t) === "2(1,4(3,5))" && P12534.log.map((x) => x.join("@")).join(" ") === "RR@1 LR@5", "slide 29: 1,2,5,3,4");
ok((() => { const t = parse("8(5(3(2(1,),4),7(6,)),11(10(9,),12))"); return isAvl(t) && isBst(t) && hgt(t) === 4 && pre(t).length === M(4) && leaves(t) === 5; })(), "the drawn minimal tree of height 4 is AVL, a BST, height 4, 12 nodes, 5 leaves");
for (let h = 0; h <= 3; h++) { const t = parse(["1", "2(1,)", "3(2(1,),4)", "5(3(2(1,),4),7(6,))"][h]); ok(isAvl(t) && isBst(t) && hgt(t) === h && pre(t).length === M(h), `minimal tree h=${h}`); }
ok([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(M).join() === "1,2,4,7,12,20,33,54,88,143,232" && [11, 12, 13, 14].map(M).join() === "376,609,986,1596", "M(h) table and the hint's continuation");
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
ok(maxH(100) === 8 && M(8) === 88 && M(9) === 143 && hgt(avlKeys(Array.from({ length: 100 }, (_, i) => i)).t) === 6, "100 nodes: max height 8, sorted-insert AVL height 6");
ok(hgt(avlKeys(Array.from({ length: 1000 }, (_, i) => i)).t) === 9, "1000 sorted inserts: full-ish tree height 9");
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


console.log(`verify-answers: ${pass} passed, ${fail} failed (${keys} auto-graded answer keys, ${mcs} multiple-choice items)`);
process.exit(fail ? 1 : 0);
