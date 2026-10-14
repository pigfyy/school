// Ground-truth check for every answer key on the site.
// 1. Compiles and runs the lecture code (tests/java/counts/Lecture.java) and the Section 1 classes with javac,
//    and compares every Java result with site/js/sim.js.
// 2. Reads every answer key from site/index.html and checks it against an independently computed value
//    (Java output, simulator, or brute force). Exact BigInt comparison everywhere; no tolerances.
// 3. Checks each misconception key is actually WRONG (so it can't mark a right answer as a misconception).
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url); // CommonJS site modules
const here = new URL(".", import.meta.url).pathname;
const G = require("../../../site/core/grader.js");
const Sim = require("../../../site/cse332/w01/sim.js");

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL", msg); } };

/* ---------------------------------------------------------------- 1. Java vs simulator */
const javac = (args, cwd) => execFileSync("java", ["-m", "jdk.compiler/com.sun.tools.javac.Main", ...args], { cwd, stdio: "pipe" });
mkdirSync(`${here}java/counts/out`, { recursive: true });
javac(["-d", "out", "Lecture.java"], `${here}java/counts`);
const lines = execFileSync("java", ["-cp", "out", "Lecture"], { cwd: `${here}java/counts` }).toString().trim().split("\n").map((l) => JSON.parse(l));
const J = (t) => lines.filter((l) => l.t === t);
for (const r of J("myFunction")) ok(Sim.myFunctionCount(r.n) === r.ops, `myFunction n=${r.n}: sim ${Sim.myFunctionCount(r.n)} java ${r.ops}`);
for (const r of J("myFunction")) {
  if (r.n === 0) ok(r.ops === 5, "n=0: 5 ops (the site says the slide's 4n+4 is for n >= 1)");
  else if (r.n % 2 === 1) ok(r.ops === 4 * r.n + 4, `odd n=${r.n} equals 4n+4`);
  else ok(r.ops === 2 * r.n + 5 && r.ops <= 4 * r.n + 4, `even n=${r.n}: 2n+5, at most 4n+4`);
}
for (const r of J("beAnnoying")) { const s = Sim.beAnnoyingCounts(r.n); ok(s.prints === r.prints && s.adds === r.adds, `beAnnoying n=${r.n}`); }
for (const r of J("arrayList")) { const s = Sim.arrayListAdds(r.c, r.adds); ok(s.total === r.total && s.length === r.length, `arrayList c=${r.c} adds=${r.adds}: sim ${s.total} java ${r.total}`); }
for (const r of J("search")) {
  ok(Sim.binarySearchTrace(Sim.SLIDE_SORTED, r.k).iterations === r.binary, `binary k=${r.k}`);
  ok(Sim.linearSearch(Sim.SLIDE_SORTED, r.k).comparisons === r.linear, `linear k=${r.k}`);
}
for (const r of J("binaryWorst")) {
  ok(Sim.binaryWorstExhaustive(r.n) === r.worst, `binaryWorst n=${r.n}`);
  ok(Math.floor(Math.log2(r.n)) + 1 === r.worst, `floor(log2 n)+1 n=${r.n}`);
}
const circ1 = J("circ1")[0], circ2 = J("circ2")[0], circ3 = J("circ3")[0], circ4 = J("circ4")[0], lk = J("linked1")[0], st = J("stack")[0], cross = J("cross")[0];
{
  let q = Sim.circularQueue(); q.dequeue(); q.dequeue(); q.enqueue(9);
  ok(q.front === circ1.front && q.back === circ1.back && q.size === circ1.size, "circ1 sim vs java");
  q = Sim.circularQueue(); for (let i = 0; i < 3; i++) q.dequeue(); for (let x = 1; x <= 6; x++) q.enqueue(x);
  ok(q.front === circ2.front && q.back === circ2.back && q.size === circ2.size && q.queue[0] === circ2.q0, "circ2 sim vs java");
  q = Sim.circularQueue(); for (let i = 0; i < 3; i++) q.dequeue(); for (let x = 1; x <= 7; x++) q.enqueue(x);
  ok(q.back === circ3.back, "circ3");
  q = Sim.circularQueue(); q.enqueue(1); q.enqueue(2); ok(q.back === circ4.back, "circ4");
  const l = Sim.linkedQueue(); l.dequeue(); const s2 = l.dequeue(); l.enqueue(9);
  ok(s2 === lk.second && l.frontValue === lk.front && l.backValue === lk.back, "linked1");
  const sr = Sim.runAdt("stack", [["add", 5], ["add", 8], ["add", 3], ["remove"], ["add", 4], ["remove"]]);
  ok(sr.removed[1] === st.secondPop, "stack second pop");
  const A = (n) => Sim.algValue("A", n), B = (n) => Sim.algValue("B", n), C = (n) => Sim.algValue("C", n);
  ok(Sim.firstN((n) => A(n) < B(n)) === cross.aBelowB && Sim.firstN((n) => C(n) > A(n)) === cross.cAboveA, "crossovers sim vs java");
}

/* Section 1 generics: the posted solutions compile and behave; the "does it compile" quick checks match javac. */
mkdirSync(`${here}java/generics/out`, { recursive: true });
javac(["-Xlint:unchecked", "-d", "out", "Section1.java"], `${here}java/generics`);
const genOut = execFileSync("java", ["-cp", "out", "Section1"], { cwd: `${here}java/generics` }).toString();
ok(/solution \(1,z\) vs \(2,a\): -1/.test(genOut), "posted ComparablePair orders (1,z) before (2,a)");
ok(/worksheet \(1,z\) vs \(2,a\): 1/.test(genOut), "worksheet's == line orders (1,z) after (2,a)  -> worksheet-line answer 'no'");
const compiles = (files) => { try { javac(["-d", "out", ...files], `${here}java/compile`); return true; } catch { return false; } };
const compileTruth = {
  "cse332-w1-s1-generics-new-t-array": compiles(["Bad1.java"]) ? "yes" : "no",
  "cse332-w1-s1-generics-animal-pair-mixed": compiles(["Animals.java", "Ok1.java"]) ? "yes" : "no",
  "cse332-w1-s1-generics-dog-pair-cat": compiles(["Animals.java", "Bad2.java"]) ? "yes" : "no",
};

/* ---------------------------------------------------------------- 2. answer keys in the HTML */
const html = readFileSync(`${here}../../../site/cse332/w01/index.html`, "utf8");
const attr = (tag, name) => { const m = new RegExp(`${name}='([^']*)'|${name}="([^"]*)"`).exec(tag); return m ? (m[1] ?? m[2]).replace(/&lt;/g, "<").replace(/&gt;/g, ">") : null; };
const taskOf = (idx) => { const before = html.slice(0, idx); const m = [...before.matchAll(/<article class="task" data-id="([^"]+)"/g)]; return m.length ? m[m.length - 1][1] : null; };

// independent ground truth keyed by id (quick checks / quiz) or task-id.part
const S = (n) => String(n);
const TRUTH = {
  "cse332-w1-l1-queues-back-after-two": S(circ1.back),
  "cse332-w1-l1-queues-back-wrap": S(circ3.back),
  "cse332-w1-l1-stacks-second-pop": S(st.secondPop),
  "cse332-w1-l1-circular-trace.front": S(circ2.front),
  "cse332-w1-l1-circular-trace.back": S(circ2.back),
  "cse332-w1-l1-circular-trace.size": S(circ2.size),
  "cse332-w1-l1-circular-trace.slot0": S(circ2.q0),
  "cse332-w1-l1-linked-trace.second-return": S(lk.second),
  "cse332-w1-l1-linked-trace.front-value": S(lk.front),
  "cse332-w1-l1-linked-trace.back-value": S(lk.back),
  "cse332-w1-l1-cyu-back-after-enqueues": S(circ4.back),
  "cse332-w1-l1-cyu-back-wraps": S(circ3.back),
  "cse332-w1-l1-cyu-peek-after-pop": S(st.peek),
  "cse332-w1-l2-counting-prints-n10": S(J("beAnnoying").find((r) => r.n === 10).prints),
  "cse332-w1-l2-amortized-total-c4": S(J("arrayList").find((r) => r.c === 4 && r.adds === 28).total),
  "cse332-w1-l2-search-iterations-13": S(J("search").find((r) => r.k === 13).binary),
  "cse332-w1-l2-beannoying.prints-million": J("bigPrints")[0].value,
  "cse332-w1-l2-arraylist-worst.full-8": (() => { const a = Sim.arrayListAdds(8, 9).perAdd; return S(a[8]); })(),
  "cse332-w1-l2-arraylist-amortized.ratio": S(J("arrayList").find((r) => r.c === 3 && r.adds === 21).total / 21),
  "cse332-w1-l2-binary-iterations.halvings-1024": S(Math.log2(1024)),
  "cse332-w1-l2-binary-iterations.worst-1000": S(J("binaryWorst").find((r) => r.n === 1000).worst),
  "cse332-w1-l2-binary-iterations.linear-1000": S(Sim.linearSearch(Array.from({ length: 1000 }, (_, i) => i), 5000).comparisons),
  "cse332-w1-l2-compare-abc.a-below-b": S(cross.aBelowB),
  "cse332-w1-l2-compare-abc.c-above-a": S(cross.cAboveA),
  "cse332-w1-l2-cyu-myfunction-n5": S(J("myFunction").find((r) => r.n === 5).ops),
  "cse332-w1-l2-cyu-beannoying-n7": S(J("beAnnoying").find((r) => r.n === 7).prints),
  "cse332-w1-l2-cyu-arraylist-c2": S(J("arrayList").find((r) => r.c === 2 && r.adds === 14).total),
  "cse332-w1-l2-cyu-binary-88": S(J("search").find((r) => r.k === 88).binary),
  "cse332-w1-l2-cyu-a-below-b": S(cross.aBelowB),
  ...compileTruth,
  "cse332-w1-s1-comparablepair.worksheet-line": "no",
  "cse332-w1-l2-parking.cheaper": 25 / 3 < 10 ? "yes" : "no",
};
// formulas: compare with Java at every n the Java run covered
const FORMULA_TRUTH = {
  "cse332-w1-l2-myfunction.count": (f) => J("myFunction").filter((r) => r.n % 2 === 1).every((r) => G.eq(G.evalExact(f, { n: G.Q(BigInt(r.n)) }), G.Q(BigInt(r.ops)))),
  "cse332-w1-l2-beannoying.prints": (f) => J("beAnnoying").every((r) => G.eq(G.evalExact(f, { n: G.Q(BigInt(r.n)) }), G.Q(BigInt(r.prints)))),
  "cse332-w1-l2-arraylist-amortized.total": (f) => J("arrayList").filter((r) => r.adds === 7 * r.c).every((r) => G.eq(G.evalExact(f, { c: G.Q(BigInt(r.c)) }), G.Q(BigInt(r.total)))),
};
const BIGO_TRUTH = { // the bucket of the verified count
  "cse332-w1-l2-myfunction.bucket": "n", "cse332-w1-l2-beannoying.bucket": "n^2", "cse332-w1-l2-arraylist-worst.bucket": "n",
  "cse332-w1-l2-counting-myfunction-bucket": "n", "cse332-w1-l2-asymptotic-c-bucket": "n^2", "cse332-w1-l2-cyu-bucket-triangle": "n^2",
};

let keys = 0;
for (const m of html.matchAll(/<(div|li)\s[^>]*(data-answer|data-grader|data-bound)[^>]*>/g)) {
  const tag = m[0];
  const grader = attr(tag, "data-grader") || (attr(tag, "data-kind") === "num" ? "exact" : attr(tag, "data-kind") === "bigo" ? "bigo" : null);
  const answer = attr(tag, "data-answer");
  const part = attr(tag, "data-part");
  const id = part ? `${taskOf(m.index)}.${part}` : attr(tag, "data-id");
  if (!grader || grader === "self" || grader === "mc" || grader === "java" || grader === "bound") continue;
  keys++;
  if (grader === "exact" || grader === "yesno" || grader === "choice") {
    const want = TRUTH[id];
    if (grader === "choice") { ok(answer === "c" && Sim.algValue("C", 10n ** 6n) > Sim.algValue("A", 10n ** 6n) && Sim.algValue("C", 10n ** 6n) > Sim.algValue("B", 10n ** 6n), `${id}: choice key`); continue; }
    ok(want !== undefined, `${id}: no independent truth registered`);
    if (want === undefined) continue;
    if (grader === "exact") ok(G.eq(G.evalExact(answer), G.evalExact(want)), `${id}: key ${answer} vs truth ${want}`);
    else ok(answer === want, `${id}: key ${answer} vs truth ${want}`);
  } else if (grader === "formula") {
    ok(FORMULA_TRUTH[id] && FORMULA_TRUTH[id](answer), `${id}: formula key ${answer} matches Java`);
  } else if (grader === "bigo") {
    ok(BIGO_TRUTH[id] !== undefined && G.checkBigO(answer, BIGO_TRUTH[id]).ok === true && !G.checkBigO(answer, BIGO_TRUTH[id]).tag, `${id}: bigo key`);
  } else if (grader === "decimal") {
    ok(G.eq(G.evalExact(answer), G.div(G.Q(25n), G.Q(3n))), `${id}: parking 25/3`);
  }
  // 3. every misconception key must be graded wrong
  const mis = attr(tag, "data-miscon");
  if (mis && grader !== "yesno") {
    for (const k of Object.keys(JSON.parse(mis))) {
      let r;
      if (grader === "exact") r = G.checkExact(k, answer);
      else if (grader === "decimal") r = G.checkDecimal(k, answer, attr(tag, "data-tol"));
      else if (grader === "formula") r = G.checkFormula(k, answer, JSON.parse(attr(tag, "data-points")));
      else if (grader === "choice") r = G.checkChoice(k, answer, JSON.parse(attr(tag, "data-choices")));
      ok(r && r.ok === false, `${id}: misconception key "${k}" must be wrong`);
    }
  }
}
ok(keys >= 40, `found ${keys} auto-graded keys`);

// c/n0 problems: the solution's pairs must hold; a near-miss must fail (checker's verdict vs brute force over a window)
const BOUND_SOLUTIONS = [
  ["cse332-w1-l2-bigo-prove-a-linear", [["910", "1"], ["11", "900"]], [["11", "899"], ["10", "1"]]],
  ["cse332-w1-l2-bigo-prove-summary-cubic", [["88", "1"]], [["1", "1"]]],
  ["cse332-w1-l2-bigo-prove-summary-quadratic", [["14", "1"], ["5", "1"], ["7", "1"]], [["2", "1"]]],
  ["cse332-w1-l2-omega-prove-summary-quadratic", [["1", "8"], ["1", "3"]], [["2", "1"]]],
];
for (const [tid, good, bad] of BOUND_SOLUTIONS) {
  const at = html.indexOf(`data-id="${tid}"`);
  const tag = /<div class="answer-spec"[^>]*data-bound='([^']+)'/.exec(html.slice(at))[1];
  const spec = JSON.parse(tag);
  const brute = (c, n0) => {
    const F = G.parsePoly(spec.f), Gp = G.parsePoly(spec.g), cc = G.evalExact(c);
    for (let n = BigInt(n0); n < BigInt(n0) + 20000n; n++) {
      const k = G.cmp(G.polyEval(F, n), G.mul(cc, G.polyEval(Gp, n)));
      if (spec.rel === "O" ? k > 0 : k < 0) return false;
    }
    return true;
  };
  for (const [c, n0] of good) ok(G.checkBound(spec, c, n0).holds && brute(c, n0), `${tid}: (${c}, ${n0}) holds`);
  for (const [c, n0] of bad) ok(!G.checkBound(spec, c, n0).holds && !brute(c, n0), `${tid}: (${c}, ${n0}) fails`);
}

// Java type answers: the accepted answers are exactly the posted solution's text
const sol = readFileSync(`${here}../../../materials/cse332/w01/text/solutions.ox.txt`, "utf8").replace(/\s+/g, " ");
for (const s of ["<A, B extends A>", "IntOtherPair<T>", "private int first", "private LikePair<B> second", "private B[] second",
  "ComparablePair<A extends Comparable<A>, B extends Comparable<B>> implements Comparable<ComparablePair<A,B>>",
  "compareTo(ComparablePair<A,B> other)", "compare1st!=0"]) ok(sol.includes(s), `posted solution contains "${s}"`);

console.log(`verify-answers: ${pass} passed, ${fail} failed (${keys} auto-graded answer keys, ${lines.length} Java result lines)`);
process.exit(fail ? 1 : 0);
