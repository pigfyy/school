"use strict";
/*
  Verifies every answer key on the week 2 site against ground truth computed here, independently of the keys:
    - brute-force enumeration (cards, rooks, dice, coins, subsets, permutations, divisibility, PHP worst cases)
    - exact BigInt rational arithmetic for probabilities (no floating point anywhere)
    - the slides' and the textbook's stated answers, as a second source
  Also checks: every exact key on the page has a ground-truth entry here (and vice versa), every misconception value
  is actually wrong, "near" flags reject the exact key's rounded neighbours but never accept them, MC questions have
  exactly one correct option, the BRUTE registry (the in-page "Check by brute force" buttons) matches, and the grader
  is exact for huge and fractional values.
  Run: node tests/answers.test.js
*/
const G = require("../site/js/grader.js");
const Pr = require("../site/js/prob.js");
const { extract } = require("../scripts/extract.js");

let pass = 0, fail = 0;
const failures = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; failures.push(msg); } }
const val = (expr, vars) => { const r = G.tryEval(expr, vars); if (!r.ok) throw new Error(`can't eval ${expr}: ${r.error}`); return G.toCanonical(r.value); };

/* ------------------------------------------------------------ exact rationals (independent of the grader) */
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
function Q(n, d = 1n) { n = BigInt(n); d = BigInt(d); if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return { n: n / g, d: d / g }; }
const qadd = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
const qsub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
const qmul = (a, b) => Q(a.n * b.n, a.d * b.d);
const qdiv = (a, b) => Q(a.n * b.d, a.d * b.n);
const dec = (s) => { const [w, f = ""] = String(s).split("."); return Q(BigInt(w + f), 10n ** BigInt(f.length)); }; // "0.005" → 1/200
const str = (q) => (q.d === 1n ? q.n.toString() : `${q.n}/${q.d}`);
const prob = (hits, total) => str(Q(hits, total));

/* ------------------------------------------------------------ enumeration helpers */
function* product(sizes) {
  const idx = sizes.map(() => 0);
  if (sizes.some((s) => s === 0)) return;
  for (;;) {
    yield idx.slice();
    let i = sizes.length - 1;
    while (i >= 0 && ++idx[i] === sizes[i]) idx[i--] = 0;
    if (i < 0) return;
  }
}
function* perms(arr) {
  const a = arr.slice(), c = new Array(a.length).fill(0);
  yield a.slice();
  let i = 0;
  while (i < a.length) {
    if (c[i] < i) { const j = i % 2 ? c[i] : 0; [a[j], a[i]] = [a[i], a[j]]; yield a.slice(); c[i]++; i = 0; } else { c[i] = 0; i++; }
  }
}
function* kSubsets(n, k, start = 0, cur = []) {
  if (cur.length === k) { yield cur.slice(); return; }
  for (let i = start; i <= n - (k - cur.length); i++) { cur.push(i); yield* kSubsets(n, k, i + 1, cur); cur.pop(); }
}
const count = (gen, pred = () => true) => { let n = 0; for (const x of gen) if (pred(x)) n++; return n; };
const dice = (s1, s2 = s1) => [...product([s1, s2])].map(([a, b]) => [a + 1, b + 1]);
const coins = (n) => [...product(Array(n).fill(2))].map((t) => t.map((x) => (x ? "T" : "H")).join(""));

// One pass over all 2,598,960 hands, independent of prob.js (rank = c % 13 with 12 = ace; suit = c / 13 floored)
const HAND = (() => {
  let total = 0, straights = 0, flushes = 0, sf = 0, threeAces = 0, twoKings = 0, oneHeartPlus = 0;
  for (const h of kSubsets(52, 5)) {
    total++;
    const ranks = h.map((c) => c % 13), suits = h.map((c) => Math.floor(c / 13));
    const rs = [...new Set(ranks)].sort((a, b) => a - b);
    const straight = rs.length === 5 && (rs[4] - rs[0] === 4 || rs.join() === "0,1,2,3,12");
    const flush = new Set(suits).size === 1;
    if (straight) straights++;
    if (flush) flushes++;
    if (straight && flush) sf++;
    if (ranks.filter((r) => r === 12).length >= 3) threeAces++;
    if (ranks.filter((r) => r === 11).length === 2) twoKings++;
    if (suits.includes(2)) oneHeartPlus++;
  }
  return { total, straights, flushes, sf, threeAces, twoKings, oneHeartPlus };
})();

const rooks = (n) => count(kSubsets(n * n, 2), ([a, b]) => a % n !== b % n && Math.floor(a / n) !== Math.floor(b / n));
// Venn population for the three-set slide numbers
const threeSetPeople = (() => { const R = { A: 24, B: 6, C: 12, AB: 3, AC: 12, BC: 7, ABC: 4, none: 10 }; return Object.entries(R).flatMap(([k, n]) => Array(n).fill(k)); })();
const inSet = (k, s) => k !== "none" && k.includes(s);

/* ------------------------------------------------------------ ground truth for every key */
const TRUTH = {
  // ---------- Lecture 3 problems
  "cse312-w2-l3-p-coefficient-xy3.ans": { brute: () => count(coins(4), (w) => [...w].filter((c) => c === "H").length === 1), slides: "4" },
  "cse312-w2-l3-p-ice-cream-donuts.ans": { brute: () => 36 + 7 + 13, check: () => 43 + 20 - 7 === 56, slides: "56" },
  "cse312-w2-l3-p-three-set-union.ans": {
    brute: () => threeSetPeople.filter((k) => k !== "none").length,
    check: () => {
      const sz = (...ss) => threeSetPeople.filter((k) => ss.every((s) => inSet(k, s))).length;
      return sz("A") === 43 && sz("B") === 20 && sz("C") === 35 && sz("A", "B") === 7 && sz("A", "C") === 16 && sz("B", "C") === 11 && sz("A", "B", "C") === 4;
    },
  },
  "cse312-w2-l3-p-children-cakes.ans": {
    // smallest possible maximum over all ways to give 11 children to 3 cakes
    brute: () => { let best = 99; for (const t of product(Array(11).fill(3))) { const c = [0, 0, 0]; t.forEach((x) => c[x]++); best = Math.min(best, Math.max(...c)); } return best; },
  },
  "cse312-w2-l3-p-birthdays.ans": { yesno: () => (367 > 366 ? "yes" : "no") },
  "cse312-w2-l3-p-five-card-hands.hands": { brute: () => HAND.total, slides: "2598960" },
  "cse312-w2-l3-p-five-card-hands.straights": { brute: () => HAND.straights, slides: "10240" },
  "cse312-w2-l3-p-five-card-hands.flushes": { brute: () => HAND.flushes, slides: "5148" },
  "cse312-w2-l3-p-five-card-hands.flush-not-straight": { brute: () => HAND.flushes - HAND.sf, slides: "5108" },
  "cse312-w2-l3-p-three-aces.ans": { brute: () => HAND.threeAces, slides: "4560" },
  "cse312-w2-l3-p-rooks.ans": { brute: () => rooks(8), slides: "1568" },
  // ---------- Lecture 4 problems
  "cse312-w2-l4-p-dice-events.a": { brute: () => count(dice(4), ([a]) => a === 1) },
  "cse312-w2-l4-p-dice-events.b": { brute: () => count(dice(4), ([a, b]) => a + b === 6) },
  "cse312-w2-l4-p-dice-events.c": { brute: () => count(dice(4), ([a, b]) => a === 2 * b) },
  "cse312-w2-l4-p-mutually-exclusive.a-b": { yesno: () => (dice(4).some(([a, b]) => a === 1 && a + b === 6) ? "no" : "yes") },
  "cse312-w2-l4-p-mutually-exclusive.b-c": { yesno: () => (dice(4).some(([a, b]) => a + b === 6 && a === 2 * b) ? "no" : "yes") },
  "cse312-w2-l4-p-prob-sum-six.ans": { brute: () => prob(count(dice(4), ([a, b]) => a + b === 6), 16), slides: "3/16" },
  "cse312-w2-l4-p-fifty-heads.ans": {
    // count sequences with exactly 50 heads via exact dynamic programming over all 2^100 sequences
    brute: () => { let row = [1n]; for (let i = 0; i < 100; i++) { const nx = Array(row.length + 1).fill(0n); row.forEach((c, j) => { nx[j] += c; nx[j + 1] += c; }); row = nx; } return str(Q(row[50], 2n ** 100n)); },
  },
  "cse312-w2-l4-p-at-least-one-three.ans": { brute: () => prob(count(dice(6), ([a, b]) => a === 3 || b === 3), 36), slides: "11/36" },
  "cse312-w2-l4-p-glued-coins.valid": { yesno: () => { const p = [dec("0"), dec("0.5"), dec("0.5"), dec("0")]; return p.every((x) => x.n >= 0n) && str(p.reduce(qadd)) === "1" ? "yes" : "no"; } },
  "cse312-w2-l4-p-glued-coins.prob": { brute: () => str([dec("0"), dec("0.5"), dec("0.5")].reduce(qadd)) },
  // ---------- Lecture 5 problems
  "cse312-w2-l5-p-both-heads-given-one.ans": { brute: () => { const B = coins(2).filter((s) => s.includes("H")); return prob(B.filter((s) => s === "HH").length, B.length); }, slides: "1/3" },
  "cse312-w2-l5-p-head-given-tail.ans": { brute: () => { const B = coins(2).filter((s) => s.includes("T")); return prob(B.filter((s) => s.includes("H")).length, B.length); }, slides: "2/3" },
  "cse312-w2-l5-p-red-blue-poll.pb": { brute: () => prob(count(dice(6), ([r]) => r === 1), 36) },
  "cse312-w2-l5-p-red-blue-poll.pba": { brute: () => { const A = dice(6).filter(([r, b]) => r + b === 4); return prob(A.filter(([r]) => r === 1).length, A.length); } },
  "cse312-w2-l5-p-gamblers-fallacy.ans": {
    // the same structure at 11 coins (10 tails then the 11th), which is enumerable; the argument doesn't depend on 50
    brute: () => { const all = coins(11); const A = all.filter((s) => s.slice(0, 10) === "T".repeat(10)); return prob(A.filter((s) => s[10] === "H").length, A.length); },
  },
  "cse312-w2-l5-p-pockets.blue": { brute: () => str(pocketsP().blue), slides: "5/12" },
  "cse312-w2-l5-p-pockets.left-given-blue": { brute: () => str(qdiv(pocketsP().leftBlue, pocketsP().blue)) },
  "cse312-w2-l5-p-zika.pt": { brute: () => str(zika().pt), slides: "0.01485" },
  "cse312-w2-l5-p-zika.pzt": { brute: () => str(zika().post) },
  "cse312-w2-l5-p-zika.neg": { brute: () => str(qsub(Q(1), dec("0.98"))) },
  // ---------- Readings
  "cse312-w2-rd-1-3-coefficient-a45-b14.ans": {
    // expand (4a^3 - 5b^2)^22 term by term and read off a^45 b^14
    brute: () => { let coef = 0n; for (let k = 0; k <= 22; k++) if (3 * k === 45 && 2 * (22 - k) === 14) coef += BigInt(Pr.choose(22, k)) * 4n ** BigInt(k) * (-5n) ** BigInt(22 - k); return coef.toString(); },
  },
  "cse312-w2-rd-1-3-divisible-four-six-nine.all": { brute: () => count(range(1, 360), (x) => x % 4 === 0 && x % 6 === 0 && x % 9 === 0), book: "10" },
  "cse312-w2-rd-1-3-divisible-four-six-nine.any": { brute: () => count(range(1, 360), (x) => x % 4 === 0 || x % 6 === 0 || x % 9 === 0) },
  "cse312-w2-rd-1-3-divisible-four-six-nine.none": { brute: () => count(range(1, 360), (x) => x % 4 && x % 6 && x % 9) },
  "cse312-w2-rd-1-3-subset-chains.ans": { formula: (n) => count(subsetPairs(n)) },
  "cse312-w2-rd-1-3-a-not-first-h-not-last.ans": { brute: () => count(perms([0, 1, 2, 3, 4, 5, 6, 7]), (p) => p[0] !== 0 && p[7] !== 7), book: "30960" },
  "cse312-w2-rd-1-3-cards-guarantee.pair": { brute: () => guarantee((r) => r.some((x) => x >= 2), "ranks") },
  "cse312-w2-rd-1-3-cards-guarantee.two-pairs": { brute: () => guarantee((r) => r.filter((x) => x >= 2).length >= 2, "ranks") },
  "cse312-w2-rd-1-3-cards-guarantee.full-house": { brute: () => guarantee((r) => r.some((x, i) => x >= 3 && r.some((y, j) => j !== i && y >= 2)), "ranks") },
  "cse312-w2-rd-1-3-cards-guarantee.flush": { brute: () => guarantee((s) => s.some((x) => x >= 5), "suits") },
  "cse312-w2-rd-2-1-washington-wins.ans": {
    brute: () => { let row = [1n]; for (let i = 0; i < 100; i++) { const nx = Array(row.length + 1).fill(0n); row.forEach((c, j) => { nx[j] += c; nx[j + 1] += c; }); row = nx; } return str(Q(row[74], 2n ** 100n)); },
  },
  "cse312-w2-rd-2-1-a-b-adjacent.ans": { brute: () => prob(count(perms([0, 1, 2, 3, 4]), (p) => Math.abs(p.indexOf(0) - p.indexOf(1)) === 1), 120), book: "48/120" },
  "cse312-w2-rd-2-1-four-aces.ans": { brute: () => prob(count(kSubsets(52, 4), (h) => h.every((c) => c % 13 === 12)), count(kSubsets(52, 4))) },
  "cse312-w2-rd-2-1-alternating-suits.ans": { brute: () => prob(count(perms([0, 1, 2, 3, 4, 5]), (p) => p.every((c, i) => i === 0 || (c < 3) !== (p[i - 1] < 3))), 720) },
  "cse312-w2-rd-2-2-siblings.older": { brute: () => { const B = coins(2).filter((s) => s[1] === "H"); return prob(B.filter((s) => s === "HH").length, B.length); } },
  "cse312-w2-rd-2-2-siblings.other": { brute: () => { const B = coins(2).filter((s) => s.includes("H")); return prob(B.filter((s) => s === "HH").length, B.length); } },
  "cse312-w2-rd-2-2-hard-teacher.fail": { brute: () => str(teachers().fail), book: "13/16" },
  "cse312-w2-rd-2-2-hard-teacher.hard": { brute: () => str(qdiv(teachers().hardFail, teachers().fail)), book: "1/13" },
  "cse312-w2-rd-2-2-llama-flu.ans": { brute: () => str(bayes2(dec("0.001"), dec("0.98"), dec("0.02"))) },
  "cse312-w2-rd-2-2-which-die.ans": {
    // weight each die by 1/4 and enumerate its i^3 equally likely roll triples
    brute: () => {
      let num = Q(0), den = Q(0);
      for (const i of [3, 4, 5, 6]) {
        const hit = count(product([i, i, i]), (t) => t.every((x) => x + 1 === 4));
        const p = qmul(Q(1, 4), Q(hit, i ** 3));
        den = qadd(den, p);
        if (i === 5) num = p;
      }
      return str(qdiv(num, den));
    },
    book: "1728/6103",
  },
  // ---------- quick checks
  "cse312-w2-l3-qc-coefficient-x2y3": { brute: () => count(coins(5), (w) => [...w].filter((c) => c === "H").length === 2) },
  "cse312-w2-l3-qc-subsets-containing-n": { brute: () => count(kSubsets(6, 3), (s) => s.includes(5)) },
  "cse312-w2-l3-qc-three-set-union": { brute: () => threeSetPeople.filter((k) => k !== "none").length },
  "cse312-w2-l3-qc-twenty-students": { brute: () => minMax(20, 3) },
  "cse312-w2-l3-qc-straight-flushes": { brute: () => HAND.sf },
  "cse312-w2-l3-qc-rooks-4x4": { brute: () => rooks(4) },
  "cse312-w2-l4-qc-two-dice-sum-five": { brute: () => count(dice(4), ([a, b]) => a + b === 5) },
  "cse312-w2-l4-qc-bent-coin-tails": { brute: () => str(qsub(Q(1), dec("0.85"))) },
  "cse312-w2-l4-qc-sum-six-prob": { brute: () => prob(count(dice(4), ([a, b]) => a + b === 6), 16) },
  "cse312-w2-l4-qc-attached-coins-differ": { brute: () => str(qadd(dec("0.1"), dec("0.1"))) },
  "cse312-w2-l4-qc-at-least-one-six": { brute: () => prob(count(dice(6), ([a, b]) => a === 6 || b === 6), 36) },
  "cse312-w2-l5-qc-ice-cream-given-donuts": { brute: () => { const S = survey(); const B = S.filter((p) => p.B); return prob(B.filter((p) => p.A).length, B.length); }, slides: "7/20" },
  "cse312-w2-l5-qc-poll-dice": { brute: () => { const A = dice(6).filter(([r, b]) => r + b === 4); return prob(A.filter(([r]) => r === 1).length, A.length); } },
  "cse312-w2-l5-qc-bayes-plug-in": { brute: () => str(qdiv(qmul(dec("0.5"), dec("0.2")), dec("0.25"))) },
  "cse312-w2-l5-qc-pockets-blue": { brute: () => str(pocketsP().blue) },
  "cse312-w2-l5-qc-zika-positives": { brute: () => str(qmul(Q(100000), zika().pt)), slides: "1485" },
  // ---------- quizzes (numeric)
  "cse312-w2-l3-quiz-coefficient-x3y4": { brute: () => count(coins(7), (w) => [...w].filter((c) => c === "H").length === 3) },
  "cse312-w2-l3-quiz-row-sum-six": { brute: () => count(product(Array(6).fill(2))) },
  "cse312-w2-l3-quiz-french-spanish": { brute: () => 20 + 10 + 15 /* only French 20, both 10, only Spanish 15 */ },
  "cse312-w2-l3-quiz-divisible-by-two-three-five": { brute: () => count(range(1, 60), (x) => x % 2 === 0 || x % 3 === 0 || x % 5 === 0) },
  "cse312-w2-l3-quiz-socks-drawers": { brute: () => minMax(50, 7) },
  "cse312-w2-l3-quiz-exactly-two-kings": { brute: () => HAND.twoKings },
  "cse312-w2-l3-quiz-rooks-five-board": { brute: () => rooks(5) },
  "cse312-w2-l4-quiz-sample-space-size": { brute: () => coins(3).length },
  "cse312-w2-l4-quiz-event-from-weights": { brute: () => { const bag = [..."RRRGGGGYYB"]; return prob(bag.filter((c) => c === "R" || c === "G").length, bag.length); } },
  "cse312-w2-l4-quiz-pair-same-value": { brute: () => prob(count(dice(6), ([a, b]) => a === b), 36) },
  "cse312-w2-l4-quiz-three-heads-of-five": { brute: () => prob(count(coins(5), (s) => [...s].filter((c) => c === "H").length === 3), 32) },
  "cse312-w2-l4-quiz-complement": { brute: () => prob(count(product([6, 6, 6]), (t) => t.includes(5)), 216) },
  "cse312-w2-l4-quiz-ie-probability": { brute: () => str(qsub(qadd(dec("0.4"), dec("0.5")), dec("0.3"))) },
  "cse312-w2-l5-quiz-die-even-given-big": { brute: () => { const B = [4, 5, 6]; return prob(B.filter((x) => x % 2 === 0).length, B.length); } },
  "cse312-w2-l5-quiz-two-dice-sum-eight": { brute: () => { const B = dice(6).filter(([a, b]) => a + b === 8); return prob(B.filter(([a, b]) => a === 4 && b === 4).length, B.length); } },
  "cse312-w2-l5-quiz-streak": { brute: () => { const A = coins(9).filter((s) => s.startsWith("HHHHHHHH")); return prob(A.filter((s) => s[8] === "H").length, A.length); } },
  "cse312-w2-l5-quiz-bayes-numbers": { brute: () => str(qdiv(qmul(dec("0.6"), dec("0.3")), dec("0.45"))) },
  "cse312-w2-l5-quiz-chemistry-fail": { brute: () => str(teachers().fail) },
  "cse312-w2-l5-quiz-screening": { brute: () => str(bayes2(dec("0.01"), dec("0.9"), dec("0.05"))) },
};

function* range(a, b) { for (let x = a; x <= b; x++) yield x; }
function* subsetPairs(n) { for (const t of product(Array(n).fill(4))) if (!t.includes(1)) yield t; } // 4 places per element; 1 = "in A, not B" is illegal
function minMax(n, k) { // smallest possible fullest hole, by trying every count vector (n pigeons, k holes)
  let best = Infinity;
  const rec = (i, left, mx) => { if (mx >= best) return; if (i === k - 1) { best = Math.min(best, Math.max(mx, left)); return; } for (let c = 0; c <= left; c++) rec(i + 1, left - c, Math.max(mx, c)); };
  rec(0, n, 0);
  return best;
}
// smallest m such that every draw of m cards has the property: 1 + the largest draw without it.
// Draws are profiles: per-rank counts (13 ranks, 0..4 each) or per-suit counts (4 suits, 0..13 each).
function guarantee(has, kind) {
  const [parts, cap] = kind === "ranks" ? [13, 4] : [4, 13];
  let maxFail = 0;
  const cur = [];
  const rec = (i) => {
    if (i === parts) { if (!has(cur)) maxFail = Math.max(maxFail, cur.reduce((a, b) => a + b, 0)); return; }
    for (let c = 0; c <= cap; c++) { cur[i] = c; rec(i + 1); }
  };
  if (kind === "ranks") {
    // 5^13 ≈ 1.2e9 is too many; the properties only depend on the sorted profile, so enumerate non-increasing profiles
    const recSorted = (i, max) => {
      if (i === parts) { if (!has(cur)) maxFail = Math.max(maxFail, cur.reduce((a, b) => a + b, 0)); return; }
      for (let c = 0; c <= max; c++) { cur[i] = c; recSorted(i + 1, c); }
    };
    recSorted(0, cap);
  } else rec(0);
  return maxFail + 1;
}
function survey() {
  const R = [[36, 1, 0], [7, 1, 1], [13, 0, 1], [14, 0, 0]];
  return R.flatMap(([n, A, B]) => Array.from({ length: n }, () => ({ A, B })));
}
function pocketsP() {
  // enumerate (pocket, ball) with exact weights
  const pockets = { L: ["B", "B", "G", "G"], R: ["B", "G", "G"] };
  let blue = Q(0), leftBlue = Q(0);
  for (const [p, balls] of Object.entries(pockets)) for (const b of balls) {
    const w = qmul(Q(1, 2), Q(1, balls.length));
    if (b === "B") { blue = qadd(blue, w); if (p === "L") leftBlue = qadd(leftBlue, w); }
  }
  return { blue, leftBlue };
}
function zika() {
  const pz = dec("0.005"), tp = dec("0.98"), fp = dec("0.01");
  const pt = qadd(qmul(pz, tp), qmul(qsub(Q(1), pz), fp));
  return { pt, post: qdiv(qmul(pz, tp), pt) };
}
function bayes2(prior, tp, fp) { return qdiv(qmul(prior, tp), qadd(qmul(prior, tp), qmul(qsub(Q(1), prior), fp))); }
function teachers() {
  const T = [[Q(6, 8), Q(1)], [Q(1, 8), Q(0)], [Q(1, 8), Q(1, 2)]];
  const fail = T.reduce((acc, [p, f]) => qadd(acc, qmul(p, f)), Q(0));
  return { fail, hardFail: qmul(T[2][0], T[2][1]) };
}

/* ------------------------------------------------------------ run */
(async () => {
  const items = await extract({ withKeys: true });
  const keyed = items.filter((i) => i.kind !== "problem" && i.grader !== "self-check" && i.grader !== "multiple-choice");

  // every key has a truth entry, and every truth entry is on the page
  for (const it of keyed) ok(TRUTH[it.id], `no ground truth for ${it.id}`);
  for (const id of Object.keys(TRUTH)) ok(keyed.some((i) => i.id === id), `ground truth for an id not on the page: ${id}`);

  for (const it of keyed) {
    const t = TRUTH[it.id];
    if (!t) continue;
    if (it.grader === "yes-no") {
      ok(t.yesno() === it.answer, `${it.id}: key ${it.answer} but brute force says ${t.yesno()}`);
      continue;
    }
    if (it.grader === "formula") {
      for (const n of it.vars.n) {
        const want = String(t.formula(n));
        ok(val(it.answer, { n }) === want, `${it.id}: formula at n=${n} gives ${val(it.answer, { n })}, enumeration ${want}`);
      }
      for (const m of it.misconceptions || []) ok(it.vars.n.some((n) => val(m.expr, { n }) !== val(it.answer, { n })), `${it.id}: misconception ${m.expr} equals the key`);
      continue;
    }
    const key = val(it.answer);
    const truth = String(t.brute());
    ok(key === truth, `${it.id}: key ${it.answer} = ${key}, brute force ${truth}`);
    const second = t.slides || t.book;
    if (second) ok(val(second) === key, `${it.id}: key ${key} vs ${t.slides ? "slides" : "textbook"} ${second}`);
    if (t.check) ok(t.check(), `${it.id}: consistency check failed`);
    // misconceptions must be wrong answers
    for (const m of it.misconceptions || []) ok(val(m.expr) !== key, `${it.id}: misconception ${m.expr} is actually correct`);
    // the grader accepts the key and rejects a neighbour
    const g = G.grade({ answer: it.answer, near: it.near || undefined }, it.answer);
    ok(g.ok === true, `${it.id}: grader rejects its own key`);
    ok(G.grade({ answer: it.answer }, `(${it.answer})+1/1000000`).ok === false, `${it.id}: grader accepts a near miss`);
    if (it.near) {
      // a 4-decimal rounding of the key is graded wrong but flagged as near
      const r = G.tryEval(it.answer).value;
      const approx = (Number(r.n * 10000n / r.d) / 10000).toFixed(4);
      if (val(approx) !== key) {
        const gr = G.grade({ answer: it.answer, near: it.near }, approx);
        ok(gr.ok === false && gr.near === true, `${it.id}: rounded ${approx} should be wrong but flagged near`);
      }
    }
  }

  // multiple choice: exactly one correct option, and option values unique
  for (const it of items.filter((i) => i.grader === "multiple-choice")) {
    ok(it.correctCount === 1, `${it.id}: ${it.correctCount} correct options`);
    ok(new Set(it.options.map((o) => o.value)).size === it.options.length, `${it.id}: duplicate option values`);
  }
  // every problem has hints (1–3) and a solution ending in a highlighted answer
  for (const it of items.filter((i) => i.kind === "problem")) {
    ok(it.hintCount >= 1 && it.hintCount <= 3, `${it.id}: ${it.hintCount} hints`);
    ok(it.hasSolution && it.solutionStepCount >= 2, `${it.id}: solution steps`);
  }

  // in-page brute-force buttons: the steppable jobs give the formula's value
  for (const [name, def] of Object.entries(Pr.BRUTE)) {
    const found = def.make().runAll();
    ok(String(found) === val(def.expected), `BRUTE ${name}: found ${found}, formula ${val(def.expected)}`);
  }
  ok(Pr.BRUTE.straights.make().runAll() === HAND.straights, "prob.js straight test agrees with the independent one");

  // grader exactness
  ok(G.grade({ answer: "C(100,50)/2^100" }, "100891344545564193334812497256/1267650600228229401496703205376").ok === true, "huge exact fraction accepted");
  ok(G.grade({ answer: "98/297" }, "0.33").ok === false, "0.33 is not 98/297");
  ok(G.grade({ answer: "98/297", near: "0.005" }, "0.33").near === true, "0.33 flagged as near 98/297");
  ok(G.grade({ answer: "0.98" }, "98%").ok === true, "percent accepted");
  ok(G.grade({ answer: "-C(22,15)*4^15*5^7" }, "-14306267627520000000").ok === true, "negative 20-digit coefficient exact");
  ok(G.grade({ answer: "7/20" }, "0.35").ok === true, "terminating decimal equals the fraction");

  console.log(`answers: ${keyed.length} keyed answers checked; ${pass} passed, ${fail} failed`);
  if (fail) { console.log(failures.map((f) => `  FAIL ${f}`).join("\n")); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
