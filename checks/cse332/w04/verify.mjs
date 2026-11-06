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
const frac = (n, d) => G.qToPlain(G.Q(BigInt(n), BigInt(d)));

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
  // Section 4
  "cse332-w4-s4-qc-sorted-bst": String(hgt(fromKeys(Array.from({ length: 100 }, (_, i) => i + 1)))),
  "cse332-w4-s4-q0.keys": "comparable", "cse332-w4-s4-q0.values": "any", "cse332-w4-s4-q0.job1": "avl", "cse332-w4-s4-q0.job2": "hash",
  "cse332-w4-s4-q1.aleft": "c", "cse332-w4-s4-q1.pright": "cleft", "cse332-w4-s4-q1.cleft": "p", "cse332-w4-s4-q1.moves": Q1MOVED.toLowerCase(),
  "cse332-w4-s4-q2.case5": caseFor(PS2, 5), "cse332-w4-s4-q2.case9": caseFor(PS2, 9), "cse332-w4-s4-q2.case6": caseFor(PS2, 6), "cse332-w4-s4-q2.case11": caseFor(PS2, 11),
  "cse332-w4-s4-q2.case2": caseFor(PS2, 2), "cse332-w4-s4-q2.case1": caseFor(PS2, 1), "cse332-w4-s4-q2.root": String(S2.t[0]), "cse332-w4-s4-q2.pre": sp(pre(S2.t)),
  "cse332-w4-s4-q3.nodes": String(M(4)), "cse332-w4-s4-q3.short": String(hgt(minTree(4)[2])), "cse332-w4-s4-q3.leaves": String(leaves(minTree(4))),
  "cse332-w4-s4-q4.first6": String(avlKeys(PS4.slice(0, 6)).log.length), "cse332-w4-s4-q4.case9": caseFor(PS4, 9), "cse332-w4-s4-q4.case8": caseFor(PS4, 8), "cse332-w4-s4-q4.case7": caseFor(PS4, 7),
  "cse332-w4-s4-q4.root": String(S4.t[0]), "cse332-w4-s4-q4.pre": sp(pre(S4.t)),
};
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
