"use strict";
/*
  Verifies every answer on the site against ground truth that doesn't use the site's answer keys:
    1. brute-force enumeration (independent code in this file) for every numeric answer small enough to enumerate
    2. the official section 1 solutions (expressions copied from raw/section01_solutions.txt)
    3. textbook answers (raw/Prob_Stat_for_CS_Book.txt) for the reading problems
  Also checks: every exact key on the page has a ground-truth entry here, every misconception value is actually
  wrong, the page's enumerator spaces and brute-force buttons give the formula's value, and the grader is exact.
  Run: node tests/answers.test.js
*/
const G = require("../site/js/grader.js");
const C = require("../site/js/counting.js");
const { extract } = require("../scripts/extract.js");

let pass = 0, fail = 0;
const failures = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; failures.push(msg); } }
const val = (expr, vars) => { const r = G.tryEval(expr, vars); if (!r.ok) throw new Error(`can't eval ${expr}: ${r.error}`); return G.toCanonical(r.value); };

/* ------------------------------------------------------------ independent brute force */
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
  const a = arr.slice();
  const c = new Array(a.length).fill(0);
  yield a.slice();
  let i = 0;
  while (i < a.length) {
    if (c[i] < i) {
      const j = i % 2 ? c[i] : 0;
      [a[j], a[i]] = [a[i], a[j]];
      yield a.slice();
      c[i]++; i = 0;
    } else { c[i] = 0; i++; }
  }
}
const count = (gen, pred = () => true) => { let n = 0; for (const x of gen) if (pred(x)) n++; return n; };
const distinctCount = (gen, key) => { const s = new Set(); for (const x of gen) s.add(key(x)); return s.size; };
const subsetsOfSize = (n, k) => count(product(Array(n).fill(2)), (b) => b.reduce((s, x) => s + x, 0) === k);
const kseqDistinct = (n, k) => count(product(Array(k).fill(n)), (t) => new Set(t).size === k);
const anagrams = (w) => distinctCount(perms([...w]), (p) => p.join(""));
const adj = (p, x, y) => Math.abs(p.indexOf(x) - p.indexOf(y)) === 1;

// For each id: brute-force count (a BigInt-safe string) or an official expression, and where it came from.
const TRUTH = {
  // Lecture 1 quick checks
  "cse312-w1-l1-qc-set-size": { brute: () => new Set([3, 1, 2, 3, 1]).size },
  "cse312-w1-l1-qc-lunch": { brute: () => count(product([6 + 9])) },
  "cse312-w1-l1-qc-subsets-abcd": { brute: () => count(product([2, 2, 2, 2])) },
  "cse312-w1-l1-qc-repeats-four-symbols": { brute: () => count(product([4, 4, 4, 4]), (t) => new Set(t).size < 4) },
  "cse312-w1-l1-qc-medals": { brute: () => kseqDistinct(10, 3) },
  "cse312-w1-l1-qc-four-books": { brute: () => count(product([3, 3, 3, 3])) },
  // Lecture 1 quiz
  "cse312-w1-l1-quiz-lunch-special": { brute: () => 4 + 3 + 5 },
  "cse312-w1-l1-quiz-powerset-product": { brute: () => count(product([4, 3])) /* |2^{x,y}| = 4 subsets */ },
  "cse312-w1-l1-quiz-eight-runners": { brute: () => kseqDistinct(8, 3) },
  "cse312-w1-l1-quiz-repeat-strings": { brute: () => count(product([5, 5, 5]), (t) => new Set(t).size < 3) },
  "cse312-w1-l1-quiz-six-books-two-people": { brute: () => count(product(Array(6).fill(2))) },
  // Section 1 (official answers from section01_solutions.txt, plus brute force where feasible)
  "cse312-w1-s1-t1a-cardinality.a": { brute: () => new Set([]).size, official: "0" },
  "cse312-w1-s1-t1a-cardinality.b": { brute: () => new Set(["∅"]).size, official: "1" },
  "cse312-w1-s1-t1a-cardinality.c": { brute: () => new Set(["{∅}"]).size, official: "1" },
  "cse312-w1-s1-t1a-cardinality.d": { brute: () => new Set(["∅", "{∅}"]).size, official: "2" },
  "cse312-w1-s1-t2a-credit-cards.ans": { official: "10^15", note: "15 free digits; too large to enumerate" },
  "cse312-w1-s1-t2b-divisors.ans": { brute: () => count(product([1440]), ([d]) => 1440 % (d + 1) === 0), official: "6*3*2" },
  "cse312-w1-s1-t2c-staff-line.ans": { official: "13!", small: () => count(perms([0, 1, 2, 3, 4])) === 120 },
  "cse312-w1-s1-t2d-anup-ends-middle.ans": { official: "3*12!", small: () => count(perms([0, 1, 2, 3, 4, 5, 6]), (p) => [0, 3, 6].includes(p.indexOf(0))) === 3 * 720 },
  "cse312-w1-s1-t3-card-game.ans": { official: "(13!)^4", small: () => {
    // same argument at 3 players × 3 suits: deals of 9 cards, 3 each, one per suit → (3!)^3
    const cards = [...Array(9).keys()]; // suit = c % 3
    return count(perms(cards), (p) => [0, 1, 2].every((pl) => new Set(p.slice(pl * 3, pl * 3 + 3).map((c) => c % 3)).size === 3)) / (6 ** 3) === 6 ** 3;
  } },
  "cse312-w1-s1-t4-seating.a": { brute: () => count(perms([...Array(10).keys()]), (p) => [0, 1, 2, 3, 4].every((c) => adj(p, 2 * c, 2 * c + 1))), official: "5!*2^5" },
  "cse312-w1-s1-t4-seating.b": { brute: () => count(perms([...Array(10).keys()]), (p) => !adj(p, 0, 1)), official: "10!-9!*2" },
  "cse312-w1-s1-t5-hbcdefga.ans": { brute: () => count(perms([...Array(8).keys()]), (p) => p[0] !== 0 && p[7] !== 7), official: "8!-(2*7!-6!)" },
  "cse312-w1-s1-t6-lizards-snakes.ans": { brute: () => count(product([4, 4, 4, 4, 4]), (t) => !t.slice(0, 3).some((x) => x === t[3] || x === t[4])), official: "4*3^3+12*2^3" },
  "cse312-w1-s1-t7-birthday-cake.ans": { brute: () => count(product(Array(7).fill(5)), (d) => d[4] === 4 && d.every((x, i) => i === 0 || x !== d[i - 1])), official: "4^6" },
  "cse312-w1-s1-t8-photographs.ans": { brute: () => count(perms([...Array(8).keys()]), (p) => Math.abs(p.indexOf(0) - p.indexOf(1)) <= 2), official: "(2*7+2*6)*6!" },
  // Lecture 2 quick checks
  "cse312-w1-l2-qc-smear-colors": { brute: () => subsetsOfSize(7, 3) },
  "cse312-w1-l2-qc-gates-starbucks": { brute: () => count(product(Array(7).fill(2)), (b) => b.filter((x) => x === 1).length === 3) },
  "cse312-w1-l2-qc-coins": { brute: () => {
    // solutions of x1+..+x5 = 32, xi >= 0, counted directly
    let n = 0;
    for (let a = 0; a <= 32; a++) for (let b = 0; a + b <= 32; b++) for (let c = 0; a + b + c <= 32; c++) for (let d = 0; a + b + c + d <= 32; d++) n++;
    return n;
  }, official: "C(32+5-1,5-1)" },
  "cse312-w1-l2-qc-godoggy": { brute: () => anagrams("GODOGGY"), official: "7!/(3!*2!*1!*1!)" },
  "cse312-w1-l2-qc-coefficient-xy3": { brute: () => count(product([2, 2, 2, 2]), (b) => b.filter((x) => x === 0).length === 1) },
  "cse312-w1-l2-qc-sum-of-row": { brute: () => count(product(Array(7).fill(2))) },
  // Lecture 2 quiz
  "cse312-w1-l2-quiz-committee": { brute: () => subsetsOfSize(10, 3) },
  "cse312-w1-l2-quiz-robot-routes": { brute: () => count(product(Array(6).fill(2)), (b) => b.filter((x) => x === 1).length === 2) },
  "cse312-w1-l2-quiz-cookies": { brute: () => count(product([11, 11, 11, 11]), (t) => t.reduce((s, x) => s + x, 0) === 10) },
  "cse312-w1-l2-quiz-sum-to-four": { brute: () => count(product([5, 5, 5]), (t) => t.reduce((s, x) => s + x, 0) === 4) },
  "cse312-w1-l2-quiz-banana": { brute: () => anagrams("BANANA") },
  "cse312-w1-l2-quiz-coefficient-x2y3": { brute: () => count(product(Array(5).fill(2)), (b) => b.filter((x) => x === 0).length === 2) },
  "cse312-w1-l2-quiz-row-sum": { brute: () => { let s = 0; for (let k = 0; k <= 6; k++) s += subsetsOfSize(6, k); return s; } },
  // Readings (textbook answers)
  "cse312-w1-rd-1-1-flamingos.ans": { brute: () => count(product([7, 7, 7, 7, 7]), (z) => !z.slice(2).some((c) => c === z[0] || c === z[1])), official: "7*6^3+7*6*5^3" },
  "cse312-w1-rd-1-1-5-ex1-a-b-apart.ans": { brute: () => count(perms([...Array(6).keys()]), (p) => !adj(p, 0, 1)), official: "480" },
  "cse312-w1-rd-1-2-1-professors-between-tas.ans": { official: "9!*P(8,4)", small: () => {
    // same argument at 4 TAs + 2 professors (6 chairs): 4!·P(3,2)
    return count(perms([...Array(6).keys()]), (p) => [4, 5].every((prof) => { const i = p.indexOf(prof); return i > 0 && i < 5 && p[i - 1] < 4 && p[i + 1] < 4; })) === 24 * 6;
  } },
  "cse312-w1-rd-1-2-2-escape-room-pairs.ans": { official: "C(6,4)*C(7,4)*4!" },
  "cse312-w1-rd-1-2-3-babyyybay.ans": { brute: () => anagrams("BABYYYBAY"), official: "9!/(3!*2!*4!)" },
  "cse312-w1-rd-1-2-4-students-to-professors.ans": { brute: () => count(product([21, 21, 21, 21]), (t) => t.reduce((s, x) => s + x, 0) === 20), official: "C(23,3)" },
  "cse312-w1-rd-1-2-5-ex3-die-rolls.ans": { brute: () => count(product(Array(11).fill(3)), (r) => r.filter((x) => x === 0).length === 4 && r.filter((x) => x === 1).length === 5), official: "11!/(4!*5!*2!)" },
  "cse312-w1-rd-1-2-5-ex4-phone-numbers.strict": { brute: () => count(product(Array(7).fill(10)), (d) => d.every((x, i) => i === 0 || x > d[i - 1])), official: "C(10,7)" },
  "cse312-w1-rd-1-2-5-ex4-phone-numbers.monotone": { brute: () => count(product(Array(7).fill(10)), (d) => d.every((x, i) => i === 0 || x >= d[i - 1])), official: "C(16,7)" },
  "cse312-w1-rd-1-3-1-coefficient-a45-b14.ans": { official: "-C(22,15)*4^15*5^7", brute: () => {
    // expand (4a^3 - 5b^2)^22 coefficient of a^45 b^14 by exact polynomial multiplication
    let poly = new Map([["0,0", 1n]]);
    for (let i = 0; i < 22; i++) {
      const next = new Map();
      for (const [k, c] of poly) {
        const [ea, eb] = k.split(",").map(Number);
        const k1 = `${ea + 3},${eb}`, k2 = `${ea},${eb + 2}`;
        next.set(k1, (next.get(k1) || 0n) + 4n * c);
        next.set(k2, (next.get(k2) || 0n) - 5n * c);
      }
      poly = next;
    }
    return poly.get("45,14");
  } },
};
// Escape room: enumerate directly.
TRUTH["cse312-w1-rd-1-2-2-escape-room-pairs.ans"].brute = () => {
  // a pairing = a set of 4 (AI, theory) pairs with distinct AI and distinct theory professors.
  // Enumerate: choose a 4-subset of theory (by mask), then an injective map theory→AI (ordered 4 distinct AI).
  // A pairing is a set of 4 (AI, theory) pairs using distinct AI and distinct theory professors.
  // Enumerate every function theory → AI ∪ {unpaired}, keep injective ones that pair exactly 4.
  let n = 0;
  for (const f of product(Array(7).fill(7))) { // value 6 = unpaired
    const used = f.filter((x) => x < 6);
    if (used.length === 4 && new Set(used).size === 4) n++;
  }
  return n;
};
// C(100,98): 2^100 subsets is too many to enumerate, so use Pascal's rule with BigInt instead
TRUTH["cse312-w1-l2-qc-symmetry-shortcut"] = {
  brute: () => {
    // C(100,98) by Pascal's triangle with BigInt (independent of the grader's multiplicative formula)
    let row = [1n];
    for (let n = 1; n <= 100; n++) { const r = [1n]; for (let k = 1; k < n; k++) r.push(row[k - 1] + row[k]); r.push(1n); row = r; }
    return row[98];
  },
};

// Formula answers: verified at many points by brute force
const FORMULA_TRUTH = {
  "cse312-w1-s1-review-sum-rule.ans": ({ n, m }) => count(product([n + m])),
  "cse312-w1-s1-review-permutations.ans": ({ n }) => count(perms([...Array(n).keys()])),
  "cse312-w1-s1-review-k-permutations.ans": ({ n, k }) => (k === 0 ? 1 : kseqDistinct(n, k)),
  "cse312-w1-s1-t9-family-portrait.ans": ({ n, m }) => count(perms([...Array(n * m).keys()]), (p) => {
    for (let f = 0; f < n; f++) {
      const pos = p.map((x, i) => (Math.floor(x / m) === f ? i : -1)).filter((i) => i >= 0);
      if (pos[pos.length - 1] - pos[0] !== m - 1) return false;
    }
    return true;
  }),
};

(async () => {
  const items = await extract({ withKeys: true });
  const keyed = items.filter((i) => i.answer != null);

  /* --- every exact answer key matches independent ground truth */
  for (const it of keyed) {
    if (it.grader === "multiple-choice") {
      ok(it.correctCount === 1, `${it.id}: multiple choice must have exactly one correct option (has ${it.correctCount})`);
      continue;
    }
    if (it.grader === "yes-no") continue;
    if (it.grader === "formula") {
      const f = FORMULA_TRUTH[it.id];
      ok(Boolean(f), `${it.id}: formula answer has no brute-force check`);
      if (!f) continue;
      const pts = it.id.includes("family") ? [{ n: 1, m: 1 }, { n: 1, m: 3 }, { n: 2, m: 1 }, { n: 2, m: 2 }, { n: 3, m: 2 }, { n: 2, m: 3 }, { n: 4, m: 2 }]
        : it.id.includes("k-perm") ? [3, 5, 6].flatMap((n) => [0, 1, 2, 3].map((k) => ({ n, k })))
        : it.id.includes("sum-rule") ? [{ n: 1, m: 1 }, { n: 4, m: 7 }, { n: 9, m: 3 }]
        : [0, 1, 2, 3, 5, 7, 8].map((n) => ({ n }));
      for (const p of pts) ok(val(it.answer, p) === String(f(p)), `${it.id}: key ${it.answer} at ${JSON.stringify(p)} = ${val(it.answer, p)}, brute force ${f(p)}`);
      continue;
    }
    const t = TRUTH[it.id];
    ok(Boolean(t), `${it.id}: no ground truth entry`);
    if (!t) continue;
    const key = val(it.answer);
    if (t.brute) {
      const b = String(t.brute());
      ok(key === b, `${it.id}: key ${it.answer} = ${key} but brute force gives ${b}`);
    }
    if (t.official) ok(key === val(t.official), `${it.id}: key ${it.answer} = ${key} but official answer ${t.official} = ${val(t.official)}`);
    if (t.small) ok(t.small() === true, `${it.id}: small-case brute force of the same argument failed`);
    if (!t.brute && !t.small) ok(Boolean(t.official), `${it.id}: needs brute force or an official answer`);
  }

  /* --- misconception values are wrong (else they'd mislabel a right answer) */
  for (const it of items) {
    for (const m of it.misconceptions || []) {
      if (it.grader === "formula") {
        const vars = it.vars;
        const pts = Object.entries(vars).reduce((acc, [k, vs]) => acc.flatMap((c) => vs.map((v) => ({ ...c, [k]: v }))), [{}]);
        const differs = pts.some((p) => { const a = G.tryEval(m.expr, p), b = G.tryEval(it.answer, p); return !a.ok || !b.ok || G.toCanonical(a.value) !== G.toCanonical(b.value); });
        ok(differs, `${it.id}: misconception ${m.tag} (${m.expr}) equals the answer`);
      } else {
        ok(val(m.expr) !== val(it.answer), `${it.id}: misconception ${m.tag} (${m.expr}) equals the answer ${it.answer}`);
      }
      // feedback must not contain the correct value
      if (it.grader !== "formula") {
        const ans = val(it.answer);
        const digits = (m.feedback.match(/\d[\d,]*/g) || []).map((d) => d.replace(/,/g, ""));
        ok(!digits.includes(ans) || ans.length <= 1, `${it.id}: misconception feedback "${m.feedback}" reveals the answer ${ans}`);
      }
    }
  }

  /* --- grader: exact big integers, near misses, equivalent forms, no tolerance */
  const g = (answer, raw) => G.grade({ answer }, raw).ok;
  const big = (6227020800n ** 4n).toString();
  ok(g("(13!)^4", big) === true, "grader: exact (13!)^4 accepted");
  ok(g("(13!)^4", (6227020800n ** 4n + 1n).toString()) === false, "grader: (13!)^4 + 1 rejected");
  ok(g("(13!)^4", (6227020800n ** 4n - 1000n).toString()) === false, "grader: (13!)^4 - 1000 rejected");
  ok(g("3*12!", "1437004801") === false, "grader: 3·12! + 1 rejected");
  ok(g("3*12!", "1,437,004,800") === true, "grader: thousands separators");
  ok(g("3*12!", "3 × 12!") === true, "grader: × sign");
  ok(g("C(10,3)", "10!/(3!7!)") === true, "grader: factorial quotient form");
  ok(g("C(10,3)", "10!/(3!*7!)") === true, "grader: explicit *");
  ok(g("C(10,3)", "binom(10,3)") === true, "grader: binom()");
  ok(g("C(10,3)", "P(10,3)/3!") === true, "grader: P(n,k)/k!");
  ok(g("C(10,3)", "121") === false, "grader: off by one rejected");
  ok(g("C(10,3)", "120.0000001") === false, "grader: no tolerance for near-integers");
  ok(g("C(10,3)", "119.99999999999999999") === false, "grader: no tolerance below");
  ok(g("C(100,98)", "4950") === true, "grader: C(100,98)");
  ok(g("-C(22,15)*4^15*5^7", "-14306267627520000000") === true, "grader: 20-digit negative exact");
  ok(g("-C(22,15)*4^15*5^7", "-14306267627520000001") === false, "grader: 20-digit near miss");
  ok(g("-C(22,15)*4^15*5^7", "-14306267627520000000.5") === false, "grader: fractional near miss");
  ok(g("-C(22,15)*4^15*5^7", "-1.430626762752e19") === false || G.grade({ answer: "1" }, "1e19").ok === null, "grader: no scientific notation");
  const b2 = (2n ** 64n).toString();
  ok(g("2^64", b2) === true && g("2^64", (2n ** 64n + 1n).toString()) === false, "grader: 2^64 exact, 2^64+1 rejected (a float can't tell them apart)");
  ok(Number(b2) === Number((2n ** 64n + 1n).toString()), "sanity: floats can't distinguish 2^64 and 2^64+1");
  ok(g("52!", "52!") === true && g("52!", (C.factorial(52) + 1n).toString()) === false, "grader: 52! exact");
  ok(G.grade({ answer: "4" }, "").ok === null, "grader: empty is unreadable, not wrong");
  ok(G.grade({ answer: "4" }, "2+").ok === null, "grader: incomplete expression unreadable");
  ok(G.grade({ answer: "4" }, "(2+2").ok === null, "grader: unclosed paren unreadable");
  ok(G.grade({ answer: "4" }, "4x").ok === null, "grader: unknown variable unreadable");
  ok(G.grade({ answer: "4" }, "99999!").ok === null, "grader: refuses huge factorial instead of hanging");
  ok(G.grade({ answer: "4" }, "2^2^2^2^2^2").ok === null, "grader: refuses huge power tower");
  ok(G.grade({ answer: "2^65536" }, "2^2^2^2^2").ok === true, "grader: right-associative power, exact 2^65536");
  ok(G.grade({ answer: "32" }, "2^3 4").ok === true, "grader: a space separates tokens (2^3 4 = 32, not 2^34)");
  ok(G.grade({ answer: "1234" }, "12 34").ok === false, "grader: '12 34' is 12·34, never 1234");
  ok(G.grade({ answer: "1/3", type: "decimal", tolerance: "0.001" }, "0.333").ok === true, "grader: decimal type uses tolerance only when asked");
  ok(G.grade({ answer: "1/3" }, "0.333").ok === false, "grader: exact type has no tolerance");
  ok(G.grade({ type: "formula", answer: "n!*(m!)^n", vars: { n: [1, 2, 3], m: [1, 2, 3] } }, "n!(m!)^n").ok === true, "grader: formula implicit multiplication");
  ok(G.grade({ type: "formula", answer: "n!*(m!)^n", vars: { n: [1, 2, 3], m: [1, 2, 3] } }, "(m!)^n n!").ok === true, "grader: formula reordered");
  ok(G.grade({ type: "formula", answer: "n!*(m!)^n", vars: { n: [1, 2, 3], m: [1, 2, 3] } }, "n!m!").ok === false, "grader: formula wrong");
  ok(G.grade({ type: "formula", answer: "n!/(n-k)!", vars: { n: [3, 5], k: [0, 1, 2, 3] } }, "P(n,k)").ok === true, "grader: P(n,k) symbolic");
  ok(G.grade({ type: "yesno", answer: "no" }, "No, because").ok === null, "grader: yes/no requires a clear yes or no");
  ok(G.grade({ type: "yesno", answer: "no" }, "no").ok === true, "grader: yes/no");
  ok(G.grade({ answer: "C(7,3)", miscon: [{ expr: "210", tag: "ordered" }] }, "7*6*5").misconception.tag === "ordered", "grader: misconception matched by value, any form");

  /* --- precedence: implicit multiplication binds looser than ^ and ! (each adjacent letter is its own factor) */
  const PREC = [
    ["nm^2", "n*m^2"], ["mn^2", "m*n^2"], ["nm!", "n*m!"], ["n!m", "n!*m"], ["mn!", "m*n!"],
    ["(nm)^2", "(n*m)^2"], ["2nm^2", "2*n*m^2"], ["n^2m", "n^2*m"], ["-nm^2", "-(n*m^2)"], ["C(n,2)m", "C(n,2)*m"],
    ["nm^2k", "n*m^2*k"], ["n^2mk!", "n^2*m*k!"], ["n m!", "n*m!"], ["nm", "n*m"], ["n(m)^2", "n*m^2"], ["2^3 4", "32"], ["mC(n,2)", "m*C(n,2)"],
  ];
  for (const vars of [{ n: 2, m: 3, k: 4 }, { n: 5, m: 4, k: 3 }]) {
    for (const [a, b] of PREC) ok(val(a, vars) === val(b, vars), `precedence at ${JSON.stringify(vars)}: ${a} = ${val(a, vars)} but ${b} = ${val(b, vars)}`);
  }
  ok(val("nm^2", { n: 2, m: 3 }) === "18" && val("nm!", { n: 2, m: 3 }) === "12" && val("mn^2", { n: 2, m: 3 }) === "12", "precedence: reviewer's repro values (18, 12, 12)");
  // wrong formulas the old grouping accepted must now be rejected
  const fspec = (answer, vars) => ({ type: "formula", answer, vars });
  ok(G.grade(fspec("(n*m)^2", { n: [1, 2, 3], m: [1, 2, 3] }), "nm^2").ok === false, "nm^2 no longer accepted for (n·m)²");
  ok(G.grade(fspec("(n*m)!", { n: [1, 2, 3], m: [1, 2, 3] }), "nm!").ok === false, "nm! no longer accepted for (n·m)!");
  ok(G.grade(fspec("n!*(m!)^n", { n: [1, 2, 3, 4], m: [1, 2, 3] }), "n!(m!)^n").ok === true, "n!(m!)^n still accepted for task 9");
  ok(G.grade(fspec("n!*(m!)^n", { n: [1, 2, 3, 4], m: [1, 2, 3] }), "n!m!^n").ok === true, "n!m!^n reads as n!·(m!)^n (postfix ! before ^), task 9's answer");
  ok(G.grade(fspec("n!*(m!)^n", { n: [1, 2, 3, 4], m: [1, 2, 3] }), "(n!m!)^n").ok === false, "(n!m!)^n is not task 9's answer");
  ok(G.grade(fspec("n!*(m!)^n", { n: [1, 2, 3, 4], m: [1, 2, 3] }), "nm!^n").ok === false, "nm!^n (= n·(m!)^n) is not task 9's answer");
  // function names are still recognized; plain words are not variables
  ok(G.grade({ answer: "120" }, "binom(10,3)").ok === true && G.grade({ answer: "120" }, "choose (10,3)").ok === true && G.grade({ answer: "120" }, "C (10, 3)").ok === true, "C/binom/choose still recognized");
  ok(G.grade({ answer: "120" }, "seven").ok === null, "an unknown word is unreadable, not a product of letters");
  ok(G.grade(fspec("n+m", { n: [1, 2], m: [1, 2] }), "cn").ok === null, "a stray letter is reported as unknown");

  /* --- the page's enumerators and brute-force buttons agree with formulas */
  const spaces = [
    ["seq123", { cond: "repeat" }, "3^3-3!"],
    ["seq123", { cond: "distinct" }, "3!"],
    ["strings", { a: 5, k: 3, cond: "distinct" }, "P(5,3)"],
    ["strings", { a: 6, k: 4, cond: "distinct" }, "P(6,4)"],
    ["strings", { a: 3, k: 5, cond: "distinct" }, "0"],
    ["booksByBook", {}, "3^5"],
    ["booksBySubsets", {}, "3^5"],
    ["paths", { r: 4, u: 3 }, "C(7,3)"],
    ["paths", { r: 0, u: 5 }, "1"],
    ["sums", { k: 3, n: 5 }, "C(7,2)"],
    ["sums", { k: 4, n: 0 }, "1"],
    ["sums", { k: 1, n: 7 }, "1"],
  ];
  for (const [kind, p, f] of spaces) {
    const s = C.runAll(C.SPACES[kind](p));
    ok(s.complete && String(s.found) === val(f), `enumerator ${kind} ${JSON.stringify(p)}: found ${s.found}, formula ${f} = ${val(f)}`);
  }
  for (const [w, f] of [["SEATTLE", "7!/(2!*2!)"], ["GODOGGY", "7!/(3!*2!)"], ["AAA", "1"], ["ABCD", "4!"]]) {
    const s = C.runAll(C.SPACES.anagrams({ word: w }));
    ok(s.complete && String(s.distinct) === val(f), `enumerator anagrams ${w}: ${s.distinct} vs ${val(f)}`);
  }
  for (const [n, k] of [[5, 3], [6, 2], [4, 4], [9, 1]]) {
    const s = C.runAll(C.SPACES.kseqToSets({ n, k }));
    ok(s.complete && String(s.distinct) === val(`C(${n},${k})`) && String(s.found) === val(`P(${n},${k})`), `enumerator kseqToSets ${n},${k}`);
  }
  // truncation: a capped run must report itself as truncated and not complete
  const capped = new C.Runner(C.SPACES.strings({ a: 26, k: 5, cond: "distinct" }), { cap: 200000 });
  capped.step(10_000_000);
  const cs = capped.summary();
  ok(cs.truncated === true && cs.complete === false && cs.checked === 200000 && capped.capped === true, "enumerator: capped run reports truncated, not complete");
  const partial = new C.Runner(C.SPACES.paths({ r: 4, u: 3 }));
  partial.step(10);
  ok(partial.summary().complete === false && partial.summary().truncated === true, "enumerator: partial run is not complete");
  for (const [name, def] of Object.entries(C.BRUTE)) {
    const ch = def.make();
    let r;
    do r = ch.step(1_000_000); while (!r.done);
    ok(String(r.found) === val(def.expected) && r.checked === ch.total, `brute button ${name}: ${r.found} vs ${def.expected} = ${val(def.expected)} (checked ${r.checked}/${ch.total})`);
  }

  /* --- the hero and widgets' hard-coded numbers */
  ok(val("26^5") === "11881376", "page: 26^5 = 11,881,376");
  ok(val("26*25*24*23*22") === "7893600", "page: 26·25·24·23·22 = 7,893,600");
  ok(val("26!/(21!*5!)") === "65780" && String(subsetsOfSize(26, 5)) === "65780", "page: C(26,5) = 65,780 (brute force)");
  ok(val("7!/(2!*2!)") === "1260", "page: SEATTLE = 1260");
  ok(val("C(7,2)") === "21" && val("C(4,1)") === "4" && val("C(4,3)") === "4", "page: small binomials");
  ok(val("5!*2^5") === "3840" && val("8!-(2*7!-6!)") === "30960" && val("4*3^3+12*2^3") === "204" && val("4^6") === "4096" && val("(2*7+2*6)*6!") === "18720", "page: section answers in solution text");
  ok(val("7*6^3+7*6*5^3") === "6762" && val("9!*P(8,4)") === "609638400" && val("C(6,4)*C(7,4)*4!") === "12600" && val("9!/(3!*2!*4!)") === "1260" && val("C(23,3)") === "1771" && val("11!/(4!*5!*2!)") === "6930" && val("C(10,7)") === "120" && val("C(16,7)") === "11440", "page: reading answers in solution text");
  ok(val("-C(22,15)*4^15*5^7") === "-14306267627520000000", "page: big coefficient text");
  ok(val("3*12!") === "1437004800", "page: 3·12! text");

  console.log(`answers: ${pass} passed, ${fail} failed (${keyed.length} keyed items checked)`);
  if (fail) { console.log(failures.map((f) => `  FAIL ${f}`).join("\n")); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
