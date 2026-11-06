// Ground truth for every computed answer on site/cse332/w04/.
// 1. Independent implementations written here (not shared with sim.js): the slides' BST and AVL insert (heights
//    recomputed from scratch, cases picked by balance factors). sim.js, which the widgets run, must agree with them
//    on the slides' examples and on random inputs. The HASH block does the same for the hash tables (Lectures 10-11).
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
const frac = (n, d) => G.qToPlain(G.Q(BigInt(n), BigInt(d)));

const EXPECT = {
  // Lecture 9
  "cse332-w4-l9-qc-rotations": String(P12534.log.reduce((n, [c]) => n + c.length - (c[0] === c[1] ? 1 : 0), 0)),
  "cse332-w4-l9-qc-m6": String(M(6)), "cse332-w4-l9-qc-maxh100": String(maxH(100)),
  "cse332-w4-l9-12534.case5": caseFor([1, 2, 5, 3, 4], 5), "cse332-w4-l9-12534.case4": caseFor([1, 2, 5, 3, 4], 4), "cse332-w4-l9-12534.pre": sp(pre(P12534.t)), "cse332-w4-l9-12534.height": String(hgt(P12534.t)),
  "cse332-w4-l9-lr.problem": String(PLR.log[0][1]), "cse332-w4-l9-lr.case": PLR.log[0][0].toLowerCase(), "cse332-w4-l9-lr.root": String(PLR.t[0]), "cse332-w4-l9-lr.pre": sp(pre(PLR.t)),
  "cse332-w4-l9-sorted.rotations": String(PS.log.length), "cse332-w4-l9-sorted.root": String(PS.t[0]), "cse332-w4-l9-sorted.height": String(hgt(PS.t)),
  "cse332-w4-l9-minimal.m5": String(M(5)), "cse332-w4-l9-minimal.leaves4": String(leaves(minTree(4))), "cse332-w4-l9-minimal.maxh1000": String(maxH(1000)),
  "cse332-w4-l9-cyu-root-12534": String(P12534.t[0]), "cse332-w4-l9-cyu-m3": String(M(3)), "cse332-w4-l9-cyu-insert-cost": "log n", "cse332-w4-l9-cyu-root-sorted": String(avlKeys([1, 2, 3, 4, 5, 6, 7]).t[0]),
  // Section 4
  "cse332-w4-s4-qc-p2-root": String(S2.t[0]),
  "cse332-w4-s4-q0.keys": "comparable", "cse332-w4-s4-q0.values": "any",
  "cse332-w4-s4-q1.aleft": "c", "cse332-w4-s4-q1.pright": "cleft", "cse332-w4-s4-q1.cleft": "p",
  "cse332-w4-s4-q2.case5": caseFor(PS2, 5), "cse332-w4-s4-q2.case6": caseFor(PS2, 6), "cse332-w4-s4-q2.count": String(S2.log.length), "cse332-w4-s4-q2.pre": sp(pre(S2.t)),
  "cse332-w4-s4-q3.nodes": String(M(4)), "cse332-w4-s4-q3.leaves": String(leaves(minTree(4))),
  "cse332-w4-s4-q4.case9": caseFor(PS4, 9), "cse332-w4-s4-q4.case7": caseFor(PS4, 7), "cse332-w4-s4-q4.root": String(S4.t[0]), "cse332-w4-s4-q4.pre": sp(pre(S4.t)),
  "cse332-w4-s4-cyu-min4": String(M(4)), "cse332-w4-s4-cyu-desc-root": String(avlKeys([6, 5, 4, 3, 2, 1]).t[0]),
};
// facts the expectations and prose rely on
ok(str(S2.t) === "8(3(2(1,),5(4,6)),10(9,11(,14)))" && str(S4.t) === "6(3(2(1,),5(4,)),9(8(7,),10))", "Section 4: problems 2 and 4 match the official solutions' trees");
ok(S2.log.map((x) => x.join("@")).join(" ") === "LR@10 LR@10 RL@5 RR@9 LL@4 LL@5" && S4.log.map((x) => x[0]).join(" ") === "LL LL LL RL RL RR", "Section 4: the cases named on the page");
ok(str(P12534.t) === "2(1,4(3,5))" && P12534.log.map((x) => x.join("@")).join(" ") === "RR@1 LR@5", "slide 29: 1,2,5,3,4");
ok((() => { const t = parse("8(5(3(2(1,),4),7(6,)),11(10(9,),12))"); return isAvl(t) && isBst(t) && hgt(t) === 4 && pre(t).length === M(4) && leaves(t) === 5; })(), "the drawn minimal tree of height 4 is AVL, a BST, height 4, 12 nodes, 5 leaves");
for (let h = 0; h <= 3; h++) { const t = parse(["1", "2(1,)", "3(2(1,),4)", "5(3(2(1,),4),7(6,))"][h]); ok(isAvl(t) && isBst(t) && hgt(t) === h && pre(t).length === M(h), `minimal tree h=${h}`); }
ok([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(M).join() === "1,2,4,7,12,20,33,54,88,143,232" && [11, 12, 13, 14].map(M).join() === "376,609,986,1596", "M(h) table and the hint's continuation");
ok(maxH(100) === 8 && M(8) === 88 && M(9) === 143 && hgt(avlKeys(Array.from({ length: 100 }, (_, i) => i)).t) === 6, "100 nodes: max height 8, sorted-insert AVL height 6");
ok(hgt(avlKeys(Array.from({ length: 1000 }, (_, i) => i)).t) === 9, "1000 sorted inserts: full-ish tree height 9");
/* ---------------------------------------------------------------- 3. the page's keys */
const html = readFileSync(`${here}../../../site/cse332/w04/index.html`, "utf8");
const attr = (tag, name) => { const m = new RegExp(`\\s${name}='([^']*)'|\\s${name}="([^"]*)"`).exec(tag); return m ? (m[1] ?? m[2]).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") : null; };
/* HASH ---------------------------------------------------------------- Lectures 10 and 11
   An independent hash table (the lecture's procedures, written again here), run on every table scenario the page
   draws (.hx-step steppers and .hx-table pictures) and on random ones; Sim.hashRun must match it state by state, and
   every claim in its narration is rechecked against the table before that step. Then the answer keys and the
   numbers written in the prose. */
{
  const TB = "✝";
  const md = (x, m) => ((x % m) + m) % m;
  const prime = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
  const firstPrime = (n) => { while (!prime(n)) n++; return n; };
  const copy = (a) => a.map((v) => (Array.isArray(v) ? [...v] : v));
  function tableRun({ size, mode, R = 0, ops }) {
    let m = size, a = Array.from({ length: m }, () => (mode === "chain" ? [] : null));
    const out = [{ m, a: copy(a), probes: [], at: -1, result: null }];
    const path = (k) => Array.from({ length: m }, (_, i) => (mode === "linear" ? (md(k, m) + i) % m : mode === "quadratic" ? (md(k, m) + i * i) % m : (md(k, m) + i * (R - md(k, R))) % m));
    const push = (r) => out.push({ m, a: copy(a), ...r });
    function ins(k) {
      if (mode === "chain") { const b = a[md(k, m)]; if (b.includes(k)) return { probes: [md(k, m)], at: md(k, m), result: "dup" }; b.push(k); return { probes: [md(k, m)], at: md(k, m), result: "placed" }; }
      const probes = []; let tomb = -1;
      for (const j of path(k)) {
        probes.push(j);
        if (a[j] === k) return { probes, at: j, result: "dup" };
        if (a[j] === TB) { if (tomb < 0) tomb = j; continue; }
        if (a[j] === null) { const d = tomb >= 0 ? tomb : j; a[d] = k; return { probes, at: d, result: "placed" }; }
      }
      if (tomb >= 0) { a[tomb] = k; return { probes, at: tomb, result: "placed" }; }
      return { probes, at: -1, result: "full" };
    }
    function find(k) {
      if (mode === "chain") { const i = md(k, m); return { probes: [i], at: a[i].includes(k) ? i : -1, result: a[i].includes(k) ? "found" : "missing" }; }
      const probes = [];
      for (const j of path(k)) { probes.push(j); if (a[j] === k) return { probes, at: j, result: "found" }; if (a[j] === null) break; }
      return { probes, at: -1, result: "missing" };
    }
    for (const w of ops.trim() ? ops.trim().split(/\s+/) : []) {
      if (w === "r") {
        const keys = mode === "chain" ? a.flat() : a.filter((v) => v !== null && v !== TB);
        m = firstPrime(2 * m); a = Array.from({ length: m }, () => (mode === "chain" ? [] : null));
        push({ probes: [], at: -1, result: "rehash", keys });
        for (const k of keys) push(ins(k));
      } else if (/^\d+$/.test(w)) push(ins(Number(w)));
      else {
        const k = Number(w.slice(1)), f = find(k);
        if (w[0] !== "f" && f.result === "found") {
          if (mode === "chain") a[f.at].splice(a[f.at].indexOf(k), 1); else a[f.at] = w[0] === "d" ? TB : null;
          f.result = "deleted";
        }
        push(f);
      }
    }
    return out;
  }
  const last = (sc) => tableRun(sc).at(-1);
  const has = (s, what) => ok(html.includes(s), `${what}: the page says ${s}`);

  // narration: every number and every claim about a slot, against the table before the step
  function checkSay(tag, sc, prev, st, mine) {
    let say = st.say;
    const seen = st.probes.map((p) => p.at);
    for (const g of say.matchAll(/g\((\d+)\) = (\d+) − (\d+) % (\d+) = (\d+)/g)) ok(g[1] === g[3] && +g[2] === sc.R && +g[4] === sc.R && +g[5] === sc.R - md(+g[1], sc.R), `${tag}: ${g[0]}`);
    say = say.replace(/g\(\d+\) = [^.]*\./g, "");
    for (const x of say.matchAll(/(\d+) % (\d+) = (\d+)/g)) ok(md(+x[1], +x[2]) === +x[3] && +x[2] === mine.m, `${tag}: ${x[0]}`);
    for (const x of say.matchAll(/\((\d+) \+ (\d+)(²|·(\d+))?\) % (\d+) = (\d+)/g)) {
      const [, h, i, suf, s, m, c] = x, f = sc.mode === "linear" ? +i : sc.mode === "quadratic" ? (+i) ** 2 : +i * +s;
      const form = sc.mode === "linear" ? suf === undefined : sc.mode === "quadratic" ? suf === "²" : suf?.startsWith("·");
      ok(form && (+h + f) % +m === +c, `${tag}: ${x[0]} (${sc.mode})`);
    }
    if (sc.mode !== "chain") {
      for (const x of say.matchAll(/(?:slot (\d+)|= (\d+)) (is empty|has a tombstone|has (\d+))/g)) {
        const j = +(x[1] ?? x[2]), v = prev[j];
        ok(x[3] === "is empty" ? v === null : x[3] === "has a tombstone" ? v === TB : v === +x[4], `${tag}: "${x[0]}" (slot ${j} held ${v})`);
        ok(seen.includes(j), `${tag}: slot ${j} is on the probe path ${seen}`);
      }
      const lines = [...say.matchAll(/i = (\d+): /g)].map((x) => +x[1]);
      ok(lines.every((i, j) => j === 0 || i === lines[j - 1] + 1), `${tag}: probe numbers in order`);
      const claims = [...say.matchAll(/i = \d+: (?:slot \d+|\(\d+ \+ \d+(?:²|·\d+)?\) % \d+ = \d+) (?:is empty|has a tombstone|has \d+)/g)].length;
      ok(claims === lines.length, `${tag}: every probe sentence is a slot claim that was checked`);
      const vis = /visit ([\d, ()a-z]+?)(?:, all taken)?\./.exec(say);
      if (vis) ok(vis[1].replace(/ \(tombstone\)/g, "") === (st.result === "full" ? seen : seen.slice(0, -1)).join(", ") && [...vis[1].matchAll(/(\d+) \(tombstone\)/g)].every((t) => prev[+t[1]] === TB), `${tag}: ${vis[0]}`);
      const never = /Slots? ([\d, ]+?(?: and \d+)?) (?:are|is) empty but never probed/.exec(say);
      const unreached = prev.map((v, j) => (v === null && !seen.includes(j) ? j : -1)).filter((j) => j >= 0).join();
      if (st.result === "full") ok((never ? never[1].split(/, | and /).map(Number).join() : "") === unreached && say.includes(`From i = ${mine.m} on the indices repeat`), `${tag}: unreachable empty slots named (${unreached})`);
      if (/goes there/.test(say)) ok(prev[st.at] === null && seen.at(-1) === st.at, `${tag}: goes there = slot ${st.at}`);
      const tomb = /tombstone's slot, (\d+)\./.exec(say);
      if (tomb) ok(+tomb[1] === st.at && prev[st.at] === TB && seen.find((j) => prev[j] === TB) === st.at, `${tag}: first tombstone ${tomb[1]}`);
      const after = /found after (\d+) probes?/.exec(say);
      if (after) ok(+after[1] === seen.length, `${tag}: ${after[0]}`);
    } else {
      const ch = /Chain (\d+) (?:holds ([\d, ]+)|is empty)/.exec(say);
      if (ch) ok(+ch[1] === st.probes[0].at && (ch[2] ?? "").replace(/[, ]+$/, "") === prev[+ch[1]].join(", "), `${tag}: ${ch[0]}`);
      const cmp = /found on comparison (\d+)|(\d+) comparisons?/.exec(say);
      if (cmp) ok(cmp[1] ? +cmp[1] === prev[st.at].indexOf(st.hit) + 1 : +cmp[2] === prev[st.probes[0].at].length, `${tag}: ${cmp[0]}`);
    }
    const k = st.op?.key;
    const ends = sc.mode === "chain"
      ? { placed: [`so ${k} starts it.`, `${k} isn't there, so it goes on the end.`], dup: [`so insert just updates ${k}'s value.`], found: [`: found on comparison ${prev[st.at]?.indexOf(k) + 1}.`], missing: [`so ${k} is not in the table.`, "so there is nothing to delete."], deleted: [`: remove ${k} from it.`] }
      : { placed: [`so ${k} goes there.`, `It goes in the first tombstone's slot, ${st.at}.`], dup: [`${k} is already there, so insert just updates its value.`], found: [`: found after ${st.probes.length} probe${st.probes.length > 1 ? "s" : ""}.`], missing: [`${k} is not in the table.`], full: ["so the insert fails."], deleted: [`Slot ${st.at} gets a tombstone (${TB}).`, `Just empty slot ${st.at}.`] };
    if (st.result !== "rehash") ok((ends[st.result] || []).some((e) => say.endsWith(e)), `${tag}: a ${st.result} step ends with its checked sentence (${say})`);
    const re = /size (\d+), the first prime ≥ 2 · (\d+) = (\d+)\./.exec(say);
    if (st.result === "rehash") {
      const lam = /λ = (\d+)\/(\d+)(, more than (2|1\/2))?\./.exec(say), lim = sc.mode === "chain" ? 2 : 0.5;
      ok(re && +re[1] === mine.m && +re[3] === 2 * +re[2] && +re[1] === firstPrime(2 * +re[2]), `${tag}: ${re && re[0]}`);
      ok(lam && +lam[1] === mine.keys.length && +lam[2] === prev.length && Boolean(lam[3]) === +lam[1] / +lam[2] > lim, `${tag}: ${lam && lam[0]}`);
      ok(say.includes(`old-slot order: ${mine.keys.join(", ")}.`), `${tag}: re-insert order ${mine.keys}`);
    }
  }
  function checkScenario(tag, sc) {
    const sim = Sim.hashRun(sc), mine = tableRun(sc);
    ok(sim.length === mine.length, `${tag}: ${sim.length} states vs ${mine.length}`);
    mine.forEach((w, j) => {
      const s = sim[j];
      if (!s) return;
      const same = s.size === w.m && JSON.stringify(s.slots) === JSON.stringify(w.a) && s.probes.map((p) => p.at).join() === w.probes.join() && s.at === w.at && (s.result ?? null) === w.result;
      ok(same, `${tag}, state ${j}: sim ${JSON.stringify(s.slots)} ${s.probes.map((p) => p.at)} -> ${s.at} ${s.result} vs ${JSON.stringify(w.a)} ${w.probes} -> ${w.at} ${w.result}`);
      ok(s.probes.every((p, i) => p.i === i), `${tag}, state ${j}: probe numbers 0, 1, 2, …`);
      if (j) checkSay(`${tag}, state ${j}`, sc, mine[j - 1].a, s, w);
    });
    return mine;
  }
  {
    let seed = 1033;
    const rnd = (n) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
    for (let t = 0; t < 400; t++) {
      const mode = ["chain", "linear", "quadratic", "double"][t % 4], size = [5, 7, 10, 11][rnd(4)], R = 5;
      const ops = Array.from({ length: 1 + rnd(size + 2) }, () => { const k = rnd(60), r = rnd(10); return r < 6 ? String(k) : r < 8 ? `f${k}` : r < 9 ? `d${k}` : "r"; }).join(" ");
      checkScenario(`random ${mode} ${size}: ${ops}`, { size, mode, R, ops });
    }
  }
  // every table on the Lecture 10 and 11 pages
  const sec = (id) => { const a = html.indexOf(`<section class="page" id="${id}"`); return html.slice(a, html.indexOf("</section>", a)); };
  const pages = ["l10-goals", "l10-idea", "l10-hashfn", "l10-strings", "l10-chain", "l10-load", "l10-practice", "l11-goals", "l11-linear", "l11-delete", "l11-quad", "l11-double", "l11-rehash", "l11-practice"];
  const hashHtml = pages.map(sec).join("\n");
  ok(pages.every((p) => html.includes(`<section class="page" id="${p}"`) && html.includes(`<li><a href="#${p}">`)), "every Lecture 10-11 page exists and is in the rail");
  const scOf = (tag) => ({ size: +attr(tag, "data-size"), mode: attr(tag, "data-mode"), R: +(attr(tag, "data-r") || 0), ops: attr(tag, "data-ops") });
  const tables = [...hashHtml.matchAll(/<div class="(?:panel hx-step|hx-table)"[^>]*>/g)].map((m) => m[0]);
  ok(tables.length >= 30, `${tables.length} hash tables drawn`);
  for (const tag of tables) {
    const sc = scOf(tag), at = attr(tag, "data-at");
    ok(["chain", "linear", "quadratic", "double"].includes(sc.mode) && sc.size > 1 && (sc.mode !== "double" || sc.R > 0), `${tag}: a valid scenario`);
    const states = checkScenario(tag, sc);
    if (at !== null) ok(+at >= 1 && +at < states.length, `${tag}: state ${at} exists`);
    ok(Math.max(...states.map((s) => s.m)) <= 11, `${tag}: at most 11 slots, so it fits a phone`);
  }
  // solution pictures: one per step of the problem's scenario, in order, none skipped
  for (const m of hashHtml.matchAll(/<article class="task" data-id="([^"]+)"[\s\S]*?<\/article>/g)) {
    const sol = m[0].slice(m[0].indexOf('<div class="solution">'));
    const pics = [...sol.matchAll(/<div class="hx-table"[^>]*>/g)].map((x) => x[0]);
    if (!pics.length) continue;
    const sc = scOf(pics[0]), n = tableRun(sc).length - 1;
    ok(pics.every((p) => JSON.stringify(scOf(p)) === JSON.stringify(sc) && p.includes("data-say")), `${m[1]}: every solution picture is the same scenario, with narration`);
    ok(pics.map((p) => attr(p, "data-at")).join() === Array.from({ length: n }, (_, i) => i + 1).join(), `${m[1]}: pictures show states 1 to ${n} in order`);
    const prompt = /<p class="prompt">[\s\S]*?<div class="hx-table"([^>]*)>/.exec(m[0]);
    ok(prompt && attr(prompt[0], "data-ops") === "" && +attr(prompt[0], "data-size") === sc.size && attr(prompt[0], "data-mode") === sc.mode, `${m[1]}: the prompt draws the empty starting table`);
  }

  const L = (ops) => last({ size: 10, mode: "linear", ops });
  const Q7 = (ops) => last({ size: 7, mode: "quadratic", ops });
  const D7 = (ops) => last({ size: 7, mode: "double", R: 5, ops });
  const C = (size, ops) => last({ size, mode: "chain", ops });
  const asc = (s) => [...s].map((c) => c.charCodeAt(0));
  const h2 = (s) => asc(s).reduce((t, x) => t + x, 0), h3 = (s) => asc(s).reduce((t, x, i) => t + x * 31 ** i, 0), h4 = (s) => 2 * h3(s);
  const loop = (s) => { const a = asc(s), seen = []; let h = 0; for (let i = a.length - 1; i >= 0; i--) { h = 31 * h + a[i]; seen.push(h); } return seen; };
  const yes = (b) => (b ? "yes" : "no");
  const at = (st) => String(st.at);
  const chain7 = C(7, "15 8 22 4 11"), ex6 = C(10, "12 22 7 42 5 17");
  const rh = tableRun({ size: 5, mode: "linear", ops: "6 11 16 r" }).at(-1);
  Object.assign(EXPECT, {
    "cse332-w4-l10-qc-callerid-100": String(2068675309 % 100), "cse332-w4-l10-qc-insert52": String(ex6.a[52 % 10].length), "cse332-w4-l10-qc-worst": "n",
    "cse332-w4-l10-qc-lambda-20": frac(20, 8), "cse332-w4-l10-qc-success": frac(15, 20),
    "cse332-w4-l10-slots.s10": String(47 % 10), "cse332-w4-l10-slots.s7": String(47 % 7), "cse332-w4-l10-slots.collide": yes(47 % 10 === 17 % 10), "cse332-w4-l10-slots.collide7": yes(47 % 7 === 17 % 7),
    "cse332-w4-l10-lastdigit.consistent": "yes", "cse332-w4-l10-lastdigit.uniform": "yes", "cse332-w4-l10-lastdigit.effective": yes("2068675309".at(-1) !== "2065550009".at(-1)), "cse332-w4-l10-lastdigit.efficient": "yes",
    "cse332-w4-l10-no-on.h2same": yes(h2("no") === h2("on")), "cse332-w4-l10-no-on.loop1": String(loop("no")[0]), "cse332-w4-l10-no-on.h3no": String(h3("no")), "cse332-w4-l10-no-on.h3on": String(h3("on")),
    "cse332-w4-l10-no-on.h4slot": String(h4("no") % 10), "cse332-w4-l10-no-on.h4odd": yes(Array.from({ length: 5000 }, (_, x) => (2 * x) % 10).includes(3)),
    "cse332-w4-l10-chain7.chain1": chain7.a[1].join(" "), "cse332-w4-l10-chain7.miss29": String(chain7.a[29 % 7].length), "cse332-w4-l10-chain7.hit11": String(chain7.a[11 % 7].indexOf(11) + 1), "cse332-w4-l10-chain7.lambda": frac(5, 7),
    "cse332-w4-l10-load.ex1": frac(3, 10), "cse332-w4-l10-load.ex3": frac(15, 10), "cse332-w4-l10-load.miss3": frac(15, 10), "cse332-w4-l10-load.hit3": frac(15, 20),
    "cse332-w4-l11-qc-ins20": at(L("38 19 8 109 10 f29 20")), "cse332-w4-l11-qc-lambda-max": "1", "cse332-w4-l11-qc-ins63": at(L("3 13 23 33 43 d13 f43 53 63")),
    "cse332-w4-l11-qc-q62": at(Q7("76 40 48 5 55 62")), "cse332-w4-l11-qc-d62": at(D7("76 40 48 5 55 62")), "cse332-w4-l11-qc-rehash-size": String(firstPrime(14)), "cse332-w4-l11-qc-chain-threshold": "2",
    "cse332-w4-l11-linear2.i35": at(L("15 25 35")), "cse332-w4-l11-linear2.i26": at(L("15 25 35 18 26")), "cse332-w4-l11-linear2.find45": String(L("15 25 35 18 26 f45").probes.length),
    "cse332-w4-l11-tomb2.found34": yes(L("4 14 24 34 d14 f34").result === "found"), "cse332-w4-l11-tomb2.find34": String(L("4 14 24 34 d14 f34").probes.length), "cse332-w4-l11-tomb2.find44": String(L("4 14 24 34 d14 f44").probes.length),
    "cse332-w4-l11-tomb2.ins44": at(L("4 14 24 34 d14 f34 f44 44")), "cse332-w4-l11-tomb2.hole": yes(L("4 14 24 34 x14 f34").result === "found"),
    "cse332-w4-l11-quad2.i21": at(Q7("14 21")), "cse332-w4-l11-quad2.i28": at(Q7("14 21 28")), "cse332-w4-l11-quad2.i7": at(Q7("14 21 28 7")), "cse332-w4-l11-quad2.lambda": frac(4, 7), "cse332-w4-l11-quad2.guarantee": yes(4 / 7 < 1 / 2),
    "cse332-w4-l11-double2.g21": String(5 - (21 % 5)), "cse332-w4-l11-double2.i21": at(D7("14 21")), "cse332-w4-l11-double2.i28": at(D7("14 21 28")), "cse332-w4-l11-double2.i7": at(D7("14 21 28 7")),
    "cse332-w4-l11-cluster.linear": "primary", "cse332-w4-l11-cluster.quadratic": "secondary", "cse332-w4-l11-cluster.double": "none",
    "cse332-w4-l11-rehash2.lambda": frac(3, 5), "cse332-w4-l11-rehash2.should": yes(3 / 5 > 1 / 2), "cse332-w4-l11-rehash2.size": String(rh.m), "cse332-w4-l11-rehash2.i16": String(rh.a.indexOf(16)), "cse332-w4-l11-rehash2.i11": String(rh.a.indexOf(11)),
  });
  // misconception values: each is what the named mistake really produces
  ok(L("38 19 8 109 10").a[20 % 10] !== null && D7("76 40 48 5 55 62").at !== Q7("76 40 48 5 55 62").at && Q7("76 40 48 5 55 62").at === 1, "ins20's 0 is the taken home; d62's quadratic answer is 1");
  const L7 = (ops) => last({ size: 7, mode: "linear", ops });
  ok(Q7("14 21 28").at !== L7("14 21 28").at && L7("14 21 28").at === 2 && L7("14 21 28 7").at === 3, "linear-not-quadratic values: 28 -> 2, 7 -> 3 under linear probing");
  ok(D7("14 21").at !== Q7("14 21").at && Q7("14 21 28").at === 4 && Q7("14 21 28 7").at === 2, "quad-not-double values: 1, 4, 2");
  ok(!prime(14) && prime(13) && 13 < 14 && !prime(10), "not-prime and below-double values");
  ok(loop("no")[0] !== asc("no")[0] && asc("no")[0] === 110 && h3("on") === 3521 && h2("no") === 221, "start-first-char and ascii-sum-order values");

  // numbers written in the prose and solutions
  has("\\(2068675309 \\bmod 10 = 9\\)", "caller ID"); ok(2068675309 % 10 === 9, "caller ID mod 10");
  ok([12, 7, 5].every((k) => L("12 7 5").a[k % 10] === k) && 22 % 10 === 12 % 10, "12, 7, 5 and the 22 collision");
  has("<tr><th>22</th><td>2</td><td>2, but 12 is there</td></tr>", "22 collides with 12");
  has("\\(97 + 98 = 195\\)", "h2(ab)"); has("\\(98 + 97 = 195\\)", "h2(ba)"); has("\\(97 + 98 \\cdot 31 = 3135\\)", "h3(ab)"); has("\\(98 + 97 \\cdot 31 = 3105\\)", "h3(ba)");
  ok(h2("ab") === 195 && h2("ba") === 195 && h3("ab") === 3135 && h3("ba") === 3105, "ab and ba");
  const abc = loop("abc");
  ok(abc.join() === "99,3167,98274" && h3("abc") === 98274 && 98 * 31 === 3038 && 99 * 961 === 95139, `the loop on abc: ${abc}`);
  has("\\(h = 31 \\cdot 0 + 99 = 99\\)", "loop step 1"); has("\\(h = 31 \\cdot 99 + 98 = 3167\\)", "loop step 2"); has("\\(h = 31 \\cdot 3167 + 97 = 98274\\)", "loop step 3"); has("\\(h_3(\\text{\"abc\"}) = 97 + 98 \\cdot 31 + 99 \\cdot 31^2 = 97 + 3038 + 95139 = 98274\\)", "loop = sum");
  ok(ex6.a.map((b) => b.length).join(", ") === "0, 0, 3, 0, 0, 1, 0, 2, 0, 0", "chain lengths of the 6-key table"); has("\\(0, 0, 3, 0, 0, 1, 0, 2, 0, 0\\)", "chain lengths"); has("\\(\\frac{3 + 1 + 2}{10} = 0.6\\)", "average chain length");
  has("\\(47 \\bmod 10 = 7\\), and \\(47 = 6 \\cdot 7 + 5\\)", "47 mod 7"); has("\\(17 \\bmod 7 = 3\\)", "17 mod 7"); ok(47 === 6 * 7 + 5 && 17 % 7 === 3, "47 and 17");
  has('such as "2068675309" and "2065550009"', "last-digit collision"); ok("2068675309".at(-1) === "2065550009".at(-1) && "2068675309" !== "2065550009", "the two numbers collide under the last digit");
  ok([...Array(10000).keys()].reduce((c, x) => (c[x % 10]++, c), Array(10).fill(0)).every((c) => c === 1000), "last digits are uniform");
  has("\\(110 + 111 = 221\\)", "h2(no)"); has("\\(h = 31 \\cdot 111 + 110 = 3551\\)", "loop on no"); has("\\(h_3(\\text{\"no\"}) = 110 + 111 \\cdot 31 = 110 + 3441 = 3551\\)", "h3(no)"); has("\\(h_3(\\text{\"on\"}) = 111 + 110 \\cdot 31 = 111 + 3410 = 3521\\)", "h3(on)");
  has("\\(h_4(\\text{\"no\"}) = 7102\\), and \\(7102 \\bmod 10 = 2\\)", "h4(no)"); ok(loop("no").join() === "111,3551" && h4("no") === 7102 && 111 * 31 === 3441 && 110 * 31 === 3410, "no and on");
  ok(chain7.a.map((b) => b.length).join() === "0,3,0,0,2,0,0", "chain7: three keys share chain 1");
  ok(L("38 19 8 109 10").a.map((v, j) => (v === null ? -1 : j)).filter((j) => j >= 0).join() === "0,1,2,8,9", "linear: slots 8, 9, 0, 1, 2 form the block"); has("Slots 8, 9, 0, 1, 2 are now one solid block", "linear block");
  ok(L("3 13 23 33 43").a.slice(3, 8).join() === "3,13,23,33,43" && L("3 13 23 33 43 x13 f43").result === "missing" && L("3 13 23 33 43").a.indexOf(43) === 7, "delete page: 3..7, a plain hole hides 43 in slot 7");
  has("so they fill slots 3 to 7", "delete page"); has("Wrong: 43 is in slot 7.", "delete page");
  const q = tableRun({ size: 7, mode: "quadratic", ops: "76 40 48 5 55 47" });
  ok([1, 3, 5].map((j) => q[j].probes.join()).join(" ") === "6 6,0 6,0,3" && q[6].result === "full" && q[5].a.filter((v) => v === null).length === 2, "quadratic: 76, 48, 55 walk 6, 0, 3; 47 fails with 2 slots free");
  has("76, 48 and 55 all start at 6 and walk 6, 0, 3", "secondary clustering example"); has("47 failed with 2 of 7 slots free", "quadratic failure"); has("Here \\(\\lambda\\) was \\(\\frac{5}{7}\\)", "quadratic lambda");
  ok([...new Set([...Array(7).keys()].map((i) => (5 + i * i) % 7))].sort().join() === "0,2,5,6" && [...new Set([...Array(7).keys()].map((i) => (i * i) % 7))].sort().join() === "0,1,2,4", "squares mod 7, and the probes from 5");
  for (let p = 3; p <= 31; p++) if (prime(p)) {
    const half = [...Array((p + 1) / 2).keys()].map((i) => (i * i) % p);
    ok(new Set(half).size === half.length, `prime ${p}: the first (p+1)/2 quadratic probes are distinct, so λ < 1/2 always finds a slot within (length + 1)/2 probes`);
    ok([...Array(p - 1).keys()].every((g) => new Set([...Array(p).keys()].map((i) => (i * (g + 1)) % p)).size === p), `prime ${p}: every step 1..${p - 1} visits all slots`);
  }
  ok([...Array(100).keys()].every((k) => { const g = 5 - (k % 5); return g >= 1 && g <= 5 && g % 7 !== 0; }), "g(k) = 5 − k % 5 is 1 to 5");
  const d = tableRun({ size: 7, mode: "double", R: 5, ops: "76 40 48 5 55 47" });
  ok(5 - (48 % 5) === 2 && 5 - (55 % 5) === 5 && 48 % 7 === 6 && 55 % 7 === 6 && d.at(-1).result === "placed", "double hashing: 48 and 55 step 2 and 5; 47 fits");
  has("48 and 55 share home 6 but step by 2 and 5", "double hashing steps");
  ok(L("15 25 35 18 26").a.slice(5, 10).join() === "15,25,35,18,26" && 26 % 10 === 6, "linear2: slots 5 to 9, 26's home is 6"); has("Slots 5 to 9 are one block, and 26 joined it though its home was 6", "linear2 note");
  ok(L("4 14 24 34").a.slice(4, 8).join() === "4,14,24,34" && L("4 14 24 34 d14").a[5] === TB && L("4 14 24 34 x14 f34").probes.join() === "4,5", "tomb2: slots 4 to 7, tombstone at 5, a hole stops find at 5");
  has("The four keys fill slots 4 to 7. Deleting 14 puts a tombstone in slot 5.", "tomb2 hint"); has("would look at 4, then stop at the empty slot 5", "tomb2 hole");
  ok(tableRun({ size: 7, mode: "quadratic", ops: "14 21 28 7" }).slice(1).map((s) => s.probes.join()).join(" ") === "0 0,1 0,1,4 0,1,4,2", "quad2: the same path 0, 1, 4, 2"); has("the same path 0, 1, 4, 2", "quad2 note");
  ok([21, 28, 7].map((k) => 5 - (k % 5)).join() === "4,2,3" && tableRun({ size: 7, mode: "double", R: 5, ops: "14 21 28 7" }).slice(2).every((s) => s.probes.length === 2), "double2: steps 4, 2, 3, each placed on its first extra probe");
  has("(4, 2 and 3)", "double2 steps");
  ok([6, 11, 16].every((k) => k % 5 === 1), "rehash2: all three have home 1"); has("All three keys have home 1 in the old table", "rehash2 hint");
  ok(!/details class="notes"|[Ss]lides? \d|Check your understanding|cyu-list/.test(hashHtml) && !/href="#l1[01]-quiz"|id="l1[01]-quiz"/.test(html), "Lectures 10-11: no teaching notes, slide numbers or quiz page");
}
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
