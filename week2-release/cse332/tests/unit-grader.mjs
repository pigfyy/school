// Unit tests for site/js/grader.js: exact integers, near misses, formulas, the exact asymptotic-class engine
// (Big-O buckets, O/Ω/Θ relations), c/n0 pairs and the smallest-n0 search. Every relation verdict is cross-checked.
import { createRequire } from "node:module";
const G = createRequire(import.meta.url)("../site/js/grader.js");
let pass = 0, fail = 0;
const t = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL", msg); } };

/* exact integers: no tolerance anywhere */
t(G.checkExact("1000000000000", "1000000000000").ok === true, "10^12 exact");
t(G.checkExact("1,000,000,000,000", "1000000000000").ok === true, "commas");
t(G.checkExact("10^12", "1000000000000").ok === true, "power");
t(G.checkExact("1000000000001", "1000000000000").ok === false, "10^12 + 1 rejected (would pass a 1e-9 relative tolerance)");
t(G.checkExact("999999999999", "1000000000000").ok === false, "10^12 - 1 rejected");
t(G.checkExact("2^64+1", "18446744073709551617").ok === true, "beyond 2^53 exact");
t(G.checkExact("18446744073709551616", "18446744073709551617").ok === false, "2^64 vs 2^64+1 differ");
t(G.checkExact("9007199254740993", "9007199254740992").ok === false, "2^53+1 vs 2^53 (equal as doubles) rejected");
t(G.checkExact("56.0", "56").ok === true, "56.0 = 56");
t(G.checkExact("56.0000001", "56").ok === false, "56.0000001 rejected");
t(G.checkExact("4*7+4", "32").ok === true, "arithmetic");
t(G.checkExact("4(7)+4", "32").ok === true, "implicit multiplication");
t(G.checkExact("abc", "3").ok === null, "unreadable is null, not wrong");
t(G.checkExact("", "3").ok === null, "blank is null");
t(G.checkExact("7", "6", { "7": "back-points-last" }).tag === "back-points-last", "misconception tag by value");
t(G.checkExact("3+4", "6", { "7": "back-points-last" }).tag === "back-points-last", "misconception tag matches equal values");
t(G.checkExact("2,000,000", "1000000000000", { "2000000": "added-loops" }).tag === "added-loops", "misconception with separators");
t(G.checkExact("1000000", "1000000000000").normalized === "1000000", "normalized is plain digits");
t(G.checkExact("-3", "3").ok === false, "negative");
t(G.checkExact("6/2", "3").ok === true, "6/2 = 3");
t(G.checkExact("7/2", "3").ok === false, "7/2 is not 3 (no integer truncation)");

/* decimals: only for genuinely non-integer answers */
t(G.checkDecimal("8.33", "25/3", "0.005").ok === true, "8.33 ok");
t(G.checkDecimal("8.333333", "25/3", "0.005").ok === true, "8.3333 ok");
t(G.checkDecimal("25/3", "25/3", "0.005").ok === true, "fraction ok");
t(G.checkDecimal("8.3", "25/3", "0.005").ok === false, "8.3 rejected");
t(G.checkDecimal("8.34", "25/3", "0.005").ok === false, "8.34 rejected");
t(G.checkDecimal("8.338", "25/3", "0.005").ok === true, "8.338 within half a cent");
t(G.checkDecimal("8.339", "25/3", "0.005").ok === false, "8.339 outside half a cent");

/* formulas: exact at several integer points */
const P = { n: ["0", "1", "2", "3", "5", "10", "100"] };
t(G.checkFormula("4n+4", "4n+4", P).ok === true, "same");
t(G.checkFormula("4(n+1)", "4n+4", P).ok === true, "factored");
t(G.checkFormula("4*n + 4", "4n+4", P).ok === true, "spaces/star");
t(G.checkFormula("2n+2n+4", "4n+4", P).ok === true, "unsimplified");
t(G.checkFormula("3+2n+1+2n", "4n+4", P).ok === true, "slide's own form");
t(G.checkFormula("4n+5", "4n+4", P).ok === false, "off by one rejected");
t(G.checkFormula("4n+4+n^2/1000000000", "4n+4", P).ok === false, "tiny extra term rejected exactly");
t(G.checkFormula("2n+5", "4n+4", P, { "2n+5": "if-branch" }).tag === "if-branch", "formula misconception");
t(G.checkFormula("n*n", "n^2", P).ok === true, "n*n");
t(G.checkFormula("n n", "n^2", P).ok === true, "implicit n n");
t(G.checkFormula("nn", "n^2", P).ok === true, "nn");
t(G.checkFormula("n^2+n", "n^2", P).ok === false, "n^2+n rejected");
t(G.checkFormula("14c", "14c", { c: ["1", "2", "8"] }).ok === true, "14c");
t(G.checkFormula("2c+4c+8c", "14c", { c: ["1", "2", "8"] }).ok === true, "2c+4c+8c");
t(G.checkFormula("14n", "14c", { c: ["1", "2", "8"] }).ok === null, "wrong variable is unreadable, not wrong");
t(G.checkFormula("x+1", "4n+4", P).ok === null, "unknown variable unreadable");
// a function that agrees at 0..3 but not later is caught by the larger test points
t(G.checkFormula("4n+4+n(n-1)(n-2)(n-3)", "4n+4", P).ok === false, "agrees on 0..3 only -> rejected");

/* implicit products of adjacent letters bind looser than ^ (regression: "nm^2" was (n*m)^2) */
for (const [n, m, c] of [[2n, 3n, 7n], [5n, 4n, 9n]]) {
  const v = { n: G.Q(n), m: G.Q(m), c: G.Q(c) };
  const ev = (e) => G.evalExact(e, v);
  const same = (a, b, msg) => t(G.eq(ev(a), ev(b)), `${msg} at n=${n}, m=${m}, c=${c}: ${G.qToString(ev(a))} vs ${G.qToString(ev(b))}`);
  same("nm^2", "n*m^2", "nm^2 = n*m^2");
  same("mn^2", "m*n^2", "mn^2 = m*n^2");
  same("2nm^2", "2*n*m^2", "2nm^2 = 2*n*m^2");
  same("-nm^2", "-(n*m^2)", "-nm^2 = -(n*m^2)");
  same("(nm)^2", "(n*m)^2", "(nm)^2 = (n*m)^2");
  same("n^2m", "n^2*m", "n^2m = n^2*m");
  same("nc", "n*c", "nc = n*c");
  same("cn", "c*n", "cn = c*n");
  same("cn^2", "c*n^2", "cn^2 = c*n^2");
  same("4n^2", "4*n^2", "4n^2 unchanged");
  same("n(n+1)/2", "n*(n+1)/2", "n(n+1)/2 unchanged");
  same("2^3 4", "32", "2^3 4 = 32 unchanged");
}
t(G.tryEval("xyz", { n: G.Q(1n) }).ok === false && /unknown name "xyz"/.test(G.tryEval("xyz", { n: G.Q(1n) }).error), "unknown word still an error");
t(G.tryEval("nq", { n: G.Q(1n) }).ok === false, "word with an unknown letter still an error");
t(G.checkFormula("nm^2", "n*m^2", { n: ["2", "5"], m: ["3", "4"] }).ok === true && G.checkFormula("nm^2", "(n*m)^2", { n: ["2", "5"], m: ["3", "4"] }).ok === false, "checkFormula uses the fixed precedence");


/* ---------------------------------------------------------------- asymptotic classes (week 2 engine) */
const b = (raw, want) => G.checkBigO(raw, want);
t(b("O(n)", "n").ok === true && !b("O(n)", "n").tag, "O(n)");
t(b("n", "n").ok === true && b("theta(n)", "n").ok === true && b("Θ(n)", "n").ok === true, "bare / theta forms");
t(b("O(n^2)", "n^2").ok === true && b("O(n*n)", "n^2").ok === true && b("O(n²)", "n^2").ok === true, "n^2 spellings");
t(b("O(4n^2+8n-10)", "n^2").tag === "simplify-terms" && b("O(4n^2+8n-10)", "n^2").ok === true, "unsimplified terms: accepted with nudge");
t(b("O(2n)", "n").tag === "simplify-constant" && b("O(n^2/100)", "n^2").tag === "simplify-constant", "constant factor nudge");
t(b("log_5 n", "log n").ok === true && b("log_5 n", "log n").tag === "simplify-base", "log base nudge");
t(b("log2(n)", "log n").ok === true && !b("log2(n)", "log n").tag && b("lg n", "log n").ok === true, "log2 / lg are plain log n");
t(b("O(n^3)", "n^2").tag === "not-tight" && b("O(n)", "n^2").tag === "too-small", "too big / too small");
t(b("n log n", "n log n").ok && b("nlogn", "n log n").ok && b("n*log(n)", "n log n").ok && b("n lg n", "n log n").ok, "n log n spellings");
t(b("O(n log n)", "n").ok === false, "n log n is not n");
t(b("O(2^n)", "2^n").ok && b("2^n + n^3", "2^n").ok && b("n^3 + 2^n + 3n", "2^n").tag === "simplify-terms", "exponential dominates (slide 27)");
t(b("3^n", "2^n").ok === false && b("3^n", "2^n").tag === "not-tight", "3^n is not 2^n (slide 28)");
t(b("2^(n+1)", "2^n").ok === true && b("2^(2n)", "2^n").ok === false && b("4^n", "2^(2n)").ok === true, "2^(n+1) vs 2^(2n)");
t(b("n log(10n^2)", "n log n").ok === true, "n log(10n^2) is n log n (slide 27)");
t(b("0.5nlogn + 2n + 7", "n log n").ok === true, "0.5 n log n + 2n + 7 (slide 27)");
t(b("1", "1").ok === true && b("O(1)", "1").ok === true && b("log n + 2", "1").ok === false, "constant; log n + 2 not O(1)");
t(b("n^2 - n^2", "n^2").ok === null && b("O(banana)", "n").ok === null && b("n!", "n").ok === null, "refuses cancellation, junk, factorial");
t(b("5n^3 + n^2 log n + 100", "n^3").ok === true, "n^3 dominates n^2 log n");
t(b("sqrt(n)", "n^(1/2)").ok === true && b("n^0.5", "sqrt(n)").ok === true, "square roots");
t(b("-n^2 + n", "n^2").ok === null, "eventually negative refused");
// relations: every pair from a ladder of known order
const LADDER = ["1", "log log n", "log n", "log^2 n", "n^(1/10)", "sqrt(n)", "n", "n log n", "n^2", "n^2 log n", "n^3", "n^50", "1.1^n", "2^n", "n 2^n", "3^n", "4^n"];
let relBad = 0;
for (let i = 0; i < LADDER.length; i++) for (let j = 0; j < LADDER.length; j++) {
  const r = G.relate(LADDER[i], LADDER[j]);
  const want = Math.sign(i - j);
  if (r.error || r.cmp !== want || r.o !== (i <= j) || r.omega !== (i >= j) || r.theta !== (i === j)) { relBad++; console.log("rel", LADDER[i], LADDER[j], r); }
}
t(relBad === 0, `relate() orders a ${LADDER.length}-function ladder correctly (${LADDER.length ** 2} pairs)`);
// slide 31/32's five verdicts
const R = (f, g) => G.relate(f, g);
t(R("4+3n", "n").o === true, "4 + 3n ∈ O(n): True");
t(R("n + 2 log n", "log n").o === false, "n + 2 log n ∈ O(log n): False");
t(R("log n + 2", "1").o === false, "log n + 2 ∈ O(1): False");
t(R("n^50", "1.1^n").o === true, "n^50 ∈ O(1.1^n): True");
t(R("3^n", "2^n").theta === false && R("3^n", "2^n").omega === true, "3^n ∈ Θ(2^n): False (but Ω)");
t(R("3n^2+17", "n^2").theta === true && R("13n^2 - 50n", "n^2").theta === true && R("10n+100", "n^2").o === true && R("10n+100", "n^2").omega === false, "lecture examples");
t(R("log_5 n", "log_2 n").theta === true && R("log_8 n", "log n").theta === true, "log bases are Θ-equal (slide 10)");
t(R("n^(1/10)", "log n").cmp === 1, "n^(1/10) grows faster than log n (slide 36)");

/* ---------------------------------------------------------------- smallest n0 (exact) */
const ex1 = { f: ["100", "10"], g: ["0", "0", "1"], rel: "O" };
const ex2 = { f: ["0", "-50", "13"], g: ["0", "0", "1"], rel: "Omega" };
t(G.smallestN0(ex1, "10").n0 === 4n, "Example 1, c = 10: smallest n0 = 4");
t(G.smallestN0(ex1, "110").n0 === 1n, "Example 1, c = 110: n0 = 1");
t(G.smallestN0(ex2, "12").n0 === 50n && G.smallestN0(ex2, "11").n0 === 25n && G.smallestN0(ex2, "1").n0 === 5n, "Example 2: c = 12 -> 50, 11 -> 25, 1 -> 5");
t(G.smallestN0(ex2, "13").n0 === null && G.smallestN0(ex2, "25/2").n0 === 100n, "Example 2: c = 13 impossible; c = 12.5 -> 100");
t(G.smallestN0({ f: ["17", "0", "3"], g: ["0", "0", "1"], rel: "O" }, "4").n0 === 5n && G.smallestN0({ f: ["17", "0", "3"], g: ["0", "0", "1"], rel: "O" }, "3").n0 === null, "3n^2+17 <= 4n^2 from 5; c = 3 never");
t(G.smallestN0({ f: ["4", "3"], g: ["0", "1"], rel: "O" }, "4").n0 === 4n, "4 + 3n <= 4n from 4");
t(G.smallestN0(ex1, "x").unreadable === true && G.smallestN0(ex1, "0").tag === "c-not-positive", "unreadable / non-positive c");
// cross-check smallestN0 against brute force
let s0bad = 0;
for (const s of [ex1, ex2, { f: ["17", "0", "3"], g: ["0", "0", "1"], rel: "O" }, { f: ["4", "3"], g: ["0", "1"], rel: "O" }]) for (const c of ["1/2", "1", "3", "4", "7", "10", "11", "12", "13", "50"]) {
  const r = G.smallestN0(s, c);
  const F = G.parsePoly(s.f), Gp = G.parsePoly(s.g), cc = G.evalExact(c);
  const ok = (n) => { const k = G.cmp(G.polyEval(F, BigInt(n)), G.mul(cc, G.polyEval(Gp, BigInt(n)))); return s.rel === "O" ? k <= 0 : k >= 0; };
  let last = 0; for (let n = 1; n <= 3000; n++) if (!ok(n)) last = n;
  const brute = last === 3000 ? null : BigInt(last + 1);
  if (r.n0 !== brute) { s0bad++; console.log("smallestN0", s, c, r, brute); }
}
t(s0bad === 0, "smallestN0 agrees with brute force on 40 cases");

/* yes/no and choice */
t(G.checkYesNo("No", "no").ok === true && G.checkYesNo("y", "no").ok === false && G.checkYesNo("maybe", "no").ok === null, "yes/no");
t(G.checkYesNo("true", "yes").ok === true && G.checkYesNo("False", "no").ok === true, "true/false map to yes/no");
t(G.checkChoice("log", "log", ["tenth", "log"]).ok === true && G.checkChoice("tenth", "log", ["tenth", "log"]).ok === false, "word choice");
t(G.checkChoice("C", "c", ["a", "b", "c"]).ok === true && G.checkChoice("algorithm b", "c", ["a", "b", "c"]).ok === false && G.checkChoice("d", "c", ["a", "b", "c"]).ok === null, "choice");

/* c and n0: exact, any valid pair */
const A = { f: ["900", "10"], g: ["0", "1"], rel: "O" };
t(G.checkBound(A, "11", "900").holds, "c=11 n0=900 holds");
t(!G.checkBound(A, "11", "899").holds && G.checkBound(A, "11", "899").tag === "n0-too-small", "n0=899 fails, says n0");
t(G.checkBound(A, "11", "899").counterexample.n === "899", "counterexample at 899");
t(!G.checkBound(A, "10", "1000000000").holds && G.checkBound(A, "10", "1000000000").tag === "c-too-small-forever", "c=10 never works, even with huge n0");
t(G.checkBound(A, "10.001", "900000").holds, "c=10.001 n0=900000 holds (exact rational)");
t(!G.checkBound(A, "10.001", "899999").holds, "n0=899999 fails");
t(G.checkBound(A, "0", "1").tag === "c-not-positive" && G.checkBound(A, "5", "0").tag === "n0-not-positive", "positivity");
t(G.checkBound(A, "x", "1").unreadable, "unreadable");
const C = { f: ["0", "0", "1/100"], g: ["0", "1"], rel: "O" };
t(!G.checkBound(C, "1000000", "1").holds && G.checkBound(C, "1000000", "1").tag === "c-too-small-forever", "n^2/100 not O(n) for any c tried");
const Om = { f: ["10", "-8", "4"], g: ["0", "0", "2"], rel: "Omega" };
t(G.checkBound(Om, "1", "1").holds, "Omega c=1 n0=1 (4n^2-8n+10 >= 2n^2 for all n>=1)");
t(!G.checkBound(Om, "2", "1").holds && G.checkBound(Om, "2", "1").tag === "c-too-big-forever", "Omega c=2 never");
// a polynomial with a dip in the middle: p(n) = n^2 - 10n + 26 >= 0? min at n=5 is 1 -> holds;  n^2-10n+24 has p(5)=-1
const dip = { f: ["0", "10"], g: ["26", "0", "1"], rel: "O" }; // 10n <= c(n^2+26) with c=1: n^2-10n+26 >= 0 always
t(G.checkBound(dip, "1", "1").holds, "dip polynomial holds (min 1 at n=5)");
const dip2 = { f: ["0", "10"], g: ["24", "0", "1"], rel: "O" };
t(!G.checkBound(dip2, "1", "1").holds && G.checkBound(dip2, "1", "1").counterexample.n === "5", "dip finds the interior counterexample n=5");
t(G.checkBound(dip2, "1", "7").holds, "dip2 from n0=7 holds (n^2-10n+24 = (n-4)(n-6))");
t(G.checkBound(dip2, "1", "6").holds, "dip2 from n0=6: p(6)=0 holds");
// brute-force cross-check of the decision procedure on many pairs
let mism = 0;
const specs = [A, Om, { f: ["10", "8", "4"], g: ["0", "0", "0", "1/4"], rel: "O" }, { f: ["-50", "100"], g: ["0", "1"], rel: "Omega" }, dip, dip2, { f: ["3", "-7", "0", "1"], g: ["0", "0", "1"], rel: "Omega" }];
for (const s of specs) for (const c of ["1/3", "1/2", "1", "2", "5", "11", "88"]) for (let n0 = 1; n0 <= 60; n0++) {
  const r = G.checkBound(s, c, String(n0));
  const F = G.parsePoly(s.f), Gp = G.parsePoly(s.g), cc = G.evalExact(c);
  let brute = true;
  for (let n = BigInt(n0); n < BigInt(n0) + 5000n; n++) { const k = G.cmp(G.polyEval(F, n), G.mul(cc, G.polyEval(Gp, n))); if (s.rel === "O" ? k > 0 : k < 0) { brute = false; break; } }
  if (r.holds !== brute) mism++;
}
t(mism === 0, `checkBound agrees with brute force on ${specs.length * 7 * 60} cases (mismatches: ${mism})`);

console.log(`unit-grader: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
