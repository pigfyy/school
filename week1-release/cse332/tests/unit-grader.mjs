// Unit tests for site/js/grader.js: exact integers, near misses, formula equivalence, Big-O classes, Java types, c/n0.
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

/* Big-O classes */
const b = (raw, want) => G.checkBigO(raw, want);
t(b("O(n)", "n").ok === true && !b("O(n)", "n").tag, "O(n)");
t(b("n", "n").ok === true, "bare n");
t(b("theta(n)", "n").ok === true, "theta(n)");
t(b("O(n^2)", "n^2").ok === true, "n^2");
t(b("O(n*n)", "n^2").ok === true, "n*n");
t(b("O(n²)", "n^2").ok === true, "unicode square");
t(b("O(4n^2+8n-10)", "n^2").ok === true && b("O(4n^2+8n-10)", "n^2").tag === "simplify-terms", "unsimplified bucket ok with nudge");
t(b("O(2n)", "n").ok === true && b("O(2n)", "n").tag === "simplify-constant", "constant nudge");
t(b("O(n^2/100)", "n^2").ok === true, "n^2/100");
t(b("O(n^3)", "n^2").ok === false && b("O(n^3)", "n^2").tag === "not-tight", "too big -> not-tight");
t(b("O(n)", "n^2").ok === false && b("O(n)", "n^2").tag === "too-small", "too small");
t(b("O(n log n)", "n").ok === false, "n log n is not n");
t(b("n log n", "n log n").ok === true, "n log n");
t(b("nlogn", "n log n").ok === true, "nlogn");
t(b("O(log n)", "log n").ok === true, "log n");
t(b("log2(n)", "log n").ok === true, "log2(n)");
t(b("lg n", "log n").ok === true, "lg n");
t(b("O(1)", "1").ok === true, "constant");
t(b("O(2^n)", "n^2").ok === false && b("O(2^n)", "n^2").tag === "not-tight", "2^n > n^2");
t(b("O(banana)", "n").ok === null, "unreadable");

/* yes/no and choice */
t(G.checkYesNo("No", "no").ok === true && G.checkYesNo("y", "no").ok === false && G.checkYesNo("maybe", "no").ok === null, "yes/no");
t(G.checkChoice("C", "c", ["a", "b", "c"]).ok === true && G.checkChoice("algorithm b", "c", ["a", "b", "c"]).ok === false && G.checkChoice("d", "c", ["a", "b", "c"]).ok === null, "choice");

/* Java types, with consistent renaming of type parameters */
const jp = (parts, params) => G.checkJavaParts(parts, params).map((r) => r.ok);
const TSP = (h, f, s) => [
  { id: "header", raw: h, header: true, accept: ["A, B extends A"] },
  { id: "first", raw: f, accept: ["A"] }, { id: "second", raw: s, accept: ["B"] }];
t(jp(TSP("A, B extends A", "A", "B"), ["A", "B"]).every(Boolean), "canonical");
t(jp(TSP("<A,B extends A>", "A", "B"), ["A", "B"]).every(Boolean), "angles, spacing");
t(jp(TSP("T, U extends T", "T", "U"), ["A", "B"]).every(Boolean), "renamed consistently");
t(jp(TSP("T, U extends T", "U", "T"), ["A", "B"]).toString() === "true,false,false", "renamed but swapped fields wrong");
t(jp(TSP("A, B", "A", "B"), ["A", "B"])[0] === false, "missing bound wrong");
t(G.checkJavaParts([{ id: "h", raw: "A, B", header: true, accept: ["A, B extends A"], miscon: { "A, B": "missing-bound" } }], ["A", "B"])[0].tag === "missing-bound", "java misconception");
t(jp([{ id: "s", raw: "LikePair< B >", accept: ["LikePair<B>"] }], ["A", "B"])[0] === true, "generic spacing");
t(jp([{ id: "s", raw: "B []", accept: ["B[]"] }], ["A", "B"])[0] === true, "array spacing");
t(jp([{ id: "h", raw: "T extends Comparable<T>, U extends Comparable<U>", header: true, accept: ["A extends Comparable<A>, B extends Comparable<B>"] },
  { id: "i", raw: "ComparablePair<T, U>", accept: ["ComparablePair<A,B>"] }], ["A", "B"]).every(Boolean), "ComparablePair renamed");

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
