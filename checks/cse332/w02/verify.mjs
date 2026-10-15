// Ground-truth check for every answer key on the site.
// 1. Compiles tests/java/lecture3/Lecture3.java with javac (the slide-6 and slide-8 code, instrumented, plus exact
//    BigInteger answers for every crossover / n0 question) and compares every line with site/js/sim.js.
// 2. Reads every auto-graded answer key from site/index.html and checks it against an independently computed value
//    (Java output, or the exact grader engine cross-checked by brute force). Exact BigInt comparison; no tolerances.
// 3. Checks each misconception key is actually WRONG, and every "why" text's numbers match.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url); // CommonJS site modules
const here = new URL(".", import.meta.url).pathname;
const G = require("../../../site/core/grader.js");
const Sim = require("../../../site/cse332/w02/sim.js");

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL", msg); } };

/* ---------------------------------------------------------------- 1. Java vs simulator */
const JDIR = `${here}java/lecture3`;
mkdirSync(`${JDIR}/out`, { recursive: true });
// javac isn't on PATH on this machine (JRE-only install); the jdk.compiler module is present
execFileSync("java", ["-m", "jdk.compiler/com.sun.tools.javac.Main", "-d", "out", "Lecture3.java"], { cwd: JDIR, stdio: "pipe" });
const raw = execFileSync("java", ["-cp", "out", "Lecture3"], { cwd: JDIR }).toString();
writeFileSync(`${JDIR}/lecture3-output.jsonl`, raw);
const lines = raw.trim().split("\n").map((l) => JSON.parse(l));
const J = (t) => lines.filter((l) => l.t === t);
const J1 = (t, pred = () => true) => J(t).find(pred);

for (const r of J("search")) {
  const tr = Sim.binarySearchTrace(Sim.SLIDE_SORTED, r.k);
  ok(tr.iterations === r.binary && tr.found === r.found, `binary_contains k=${r.k}: sim ${tr.iterations}/${tr.found} java ${r.binary}/${r.found}`);
  ok(JSON.stringify(tr.gaps) === JSON.stringify(r.gaps), `gaps k=${r.k}: sim ${tr.gaps} java ${r.gaps}`);
  ok(Sim.linearSearch(Sim.SLIDE_SORTED, r.k).comparisons === r.linear, `contains k=${r.k}`);
}
for (const r of J("binaryWorst")) {
  ok(Sim.binaryWorstExhaustive(r.n) === r.worst, `worst n=${r.n}: sim ${Sim.binaryWorstExhaustive(r.n)} java ${r.worst}`);
  ok(Sim.worstGaps(r.n).length === r.worst, `worst-gap chain n=${r.n}`);
  ok(Math.floor(Math.log2(r.n)) + 1 === r.worst, `floor(log2 n)+1 n=${r.n}`);
}
// races: the sign-change profile from sim.js vs Java's exact BigInteger thresholds
{
  const p = Sim.raceProfile("n50", 12000);
  ok(p.length === 3 && p[0].to === 1 && p[1].to === J1("n50").lastFail && p[2].from === J1("n50").smallestN0 && p[2].to === 12000, `n^50 vs 1.1^n profile ${JSON.stringify(p)}`);
  const tt = Sim.raceProfile("threeTwo", 200);
  ok(tt[1].from === J1("threeTwo").firstFail && tt[1].s === "gt" && tt[1].to === 200, "3^n vs 1000*2^n");
  const te = Sim.raceProfile("tenth", 400);
  ok(te[te.length - 1].from === J1("tenth").firstK && te[te.length - 1].s === "gt" && te[te.length - 1].to === 400, "n^(1/10) vs log n");
  ok(Sim.firstN((n) => Sim.nPlusLogFails(10, n), 2) === J1("nlog").firstFail && J1("nlog").stays, "n + 2 log n > 10 log n");
  ok(Sim.firstN((n) => Sim.logPlusTwoFails(12, n), 1, 5000) === J1("logConst").firstFail, "log n + 2 > 12");
  // the ratio n^50/1.1^n is decreasing from n = 525 on, so the 12,000-wide scan covers all n
  ok(J1("n50peak").decreasingFrom === 525, "n^50/1.1^n decreasing from 525");
  // slide 32's parenthetical "2^n/n > c" vs the exact condition 2^n > n^c (c = 10): 6 vs 59
  ok(J1("paren").parenFirst === 6 && J1("paren").exactFirst === 59, "slide-32 parenthetical discrepancy (6 vs 59)");
  ok(J1("logbase").ok && J1("logbase").ratio === 3, "log_8 n = log_2 n / 3 at n = 8^j");
}
// smallest n0 from the exact grader vs Java's scans
{
  const ex1 = { f: ["100", "10"], g: ["0", "0", "1"], rel: "O" };
  const ex2 = { f: ["0", "-50", "13"], g: ["0", "0", "1"], rel: "Omega" };
  const sq17 = { f: ["17", "0", "3"], g: ["0", "0", "1"], rel: "O" };
  ok(Number(G.smallestN0(ex1, "10").n0) === J1("ex1").smallestN0 && J1("ex1").holdsAt10, "Example 1: smallest n0 (c=10) matches Java; slide's n0 = 10 holds");
  for (const r of J("ex2")) ok(Number(G.smallestN0(ex2, String(r.c)).n0) === r.smallestN0, `Example 2 c=${r.c}: n0 ${r.smallestN0}`);
  ok(G.smallestN0(ex2, "13").n0 === null && J1("ex2c13").anyN === false, "Example 2 c=13 never works (Java: no n up to 100,000)");
  ok(Number(G.smallestN0(sq17, "4").n0) === J1("sq17").upperSmallestN0 && J1("sq17").lowerC3AllN, "3n^2+17: c=4 -> 5; c=3 lower bound for all n");
  ok(Number(G.smallestN0({ f: ["4", "3"], g: ["0", "1"], rel: "O" }, "4").n0) === J1("lin").smallestN0, "4 + 3n <= 4n");
}

/* ---------------------------------------------------------------- 2. answer keys in the HTML */
const html = readFileSync(`${here}../../../site/cse332/w02/index.html`, "utf8");
const attr = (tag, name) => { const m = new RegExp(`${name}='([^']*)'|${name}="([^"]*)"`).exec(tag); return m ? (m[1] ?? m[2]).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"') : null; };
const taskOf = (idx) => { const before = html.slice(0, idx); const m = [...before.matchAll(/<article class="task" data-id="([^"]+)"/g)]; return m.length ? m[m.length - 1][1] : null; };
const S = (n) => String(n);
const worst = (n) => J1("binaryWorst", (r) => r.n === n).worst;

/* Wed-Fri additions (Priority Queues 1 and 2, Section 2): the lecture's pseudocode, run for real. */
const pq = (() => {
  // 1-indexed min-heap exactly as lecture 5's pseudocode (percolateUp / percolateDown); returns swap counts
  const up = (h, i) => { let swaps = 0; while (i > 1 && h[i] < h[i >> 1]) { [h[i], h[i >> 1]] = [h[i >> 1], h[i]]; i >>= 1; swaps++; } return swaps; };
  const down = (h, i, size) => {
    let swaps = 0;
    while (i * 2 <= size) {
      let c = i * 2; if (c + 1 <= size && h[c + 1] < h[c]) c++;
      if (h[c] < h[i]) { [h[c], h[i]] = [h[i], h[c]]; i = c; swaps++; } else break;
    }
    return swaps;
  };
  const h = [null]; for (const v of [16, 32, 4, 57, 80, 43, 2]) { h.push(v); up(h, h.length - 1); }
  const afterInserts = h.slice(1).join(",");
  const min = h[1]; h[1] = h.pop(); down(h, 1, h.length - 1);
  const afterExtract = h.slice(1).join(",");
  // slide example: insert 1.5, then extract
  const s = [null, 1, 3, 2, 4, 7, 5, 6, 5, 9]; s.push(1.5); up(s, 10);
  const slideInsert = s.slice(1).join(","); s[1] = s.pop(); down(s, 1, s.length - 1);
  const slideExtract = s.slice(1).join(",");
  // slide 9: the second PQ trace
  const q = [null], out = []; const ins = (v) => { q.push(v); up(q, q.length - 1); }; const ext = () => { const m = q[1]; q[1] = q.pop(); if (q.length > 1) down(q, 1, q.length - 1); out.push(m); };
  ins(5); ins(6); ins(3); ext(); ins(1); ext(); ext(); ins(8); ext(); ext();
  // worst-case percolate depth and buildHeap work, over many sizes (worst case: reverse-sorted input)
  let maxUp = 0; const depths = [];
  for (let n = 1; n <= 2048; n++) { const a = [null]; for (let v = n; v >= 1; v--) { a.push(v); } const hh = [null]; let m = 0; for (let v = 1; v <= n; v++) { hh.push(n - v + 1); m = Math.max(m, up(hh, hh.length - 1)); } depths.push([n, m]); maxUp = Math.max(maxUp, m); }
  const buildSwaps = (n) => { const a = [null]; for (let v = n; v >= 1; v--) a.push(v); let total = 0; for (let i = n; i > 0; i--) total += down(a, i, n); return total; };
  const buildOK = [1, 2, 3, 7, 15, 100, 1000, 4095, 4096].every((n) => buildSwaps(n) <= 2 * n);
  const ratioOK = buildSwaps(1 << 14) / (1 << 14) < 1 && buildSwaps(1 << 16) / (1 << 16) < 1;
  return { afterInserts, min, afterExtract, slideInsert, slideExtract, trace: out.join(","), depthOK: depths.every(([n, m]) => m === Math.floor(Math.log2(n))), buildOK, ratioOK };
})();
const numUnique = (vals) => { // section 2 question 3, counting the loop iterations
  const visited = vals.map(() => false); let steps = vals.length, out = 0;
  for (let i = 0; i < vals.length; i++) if (!visited[i]) { out++; for (let j = i; j < vals.length; j++) { steps++; if (vals[i] === vals[j]) visited[j] = true; } }
  return { out, steps };
};
const nuWorst = [1, 2, 5, 10, 50, 200].every((n) => numUnique(Array.from({ length: n }, (_, i) => `v${i}`)).steps === n + (n * (n + 1)) / 2);
const nuBest = [1, 2, 5, 10, 50, 200].every((n) => numUnique(Array(n).fill("a")).steps === 2 * n);
ok(pq.afterInserts === "2,32,4,57,80,43,16" && pq.min === 2 && pq.afterExtract === "4,32,16,57,80,43", `lecture 5 example 16,32,4,57,80,43,2 (${pq.afterInserts} / ${pq.afterExtract})`);
ok(pq.slideInsert === "1,1.5,2,4,3,5,6,5,9,7" && pq.slideExtract === "1.5,3,2,4,7,5,6,5,9", `slide insert 1.5 / extract (${pq.slideInsert} / ${pq.slideExtract})`);
ok(pq.trace === "3,1,5,6,8", `slide 9 PQ trace prints ${pq.trace}`);
ok(pq.depthOK, "worst-case percolate up is floor(log2 n) swaps for n up to 2048");
ok(pq.buildOK && pq.ratioOK, "Floyd buildHeap does at most 2n swaps");
ok(nuWorst && nuBest, "numUnique: n + n(n+1)/2 steps when all distinct, 2n when all equal");
// heap property is only between a node and its children: a heap with a level-1 value (5) above a level-2 value (3)
{ const h = [null, 1, 5, 2, 6, 7, 3, 4]; const valid = h.every((v, i) => i < 2 || h[i >> 1] <= v); ok(valid && h[2] > h[6], "valid min-heap with a larger value on a higher level"); }
ok(Math.floor(9 / 2) + 1 === 5 && 2 * 4 + 1 === 9, "n = 9 leaves start at 5; right child of 4 is 9");
ok(Math.ceil(Math.log2(1000 + 1)) - 1 === 9, "height of a complete tree on 1000 nodes is 9");
const smallestN0 = (() => { let n = 1; while (!(1000 <= 3 * n * n)) n++; return n; })();

const TRUTH = {
  // Wed-Fri additions
  "cse332-w2-l4-qc-example2-third": pq.trace.split(",")[2],
  "cse332-w2-l4-qc-heap-leaf-ancestor": "no",
  "cse332-w2-s2-qc-q1b-n0": S(smallestN0),
  "cse332-w2-l5-qc-extract-new-root": pq.afterExtract.split(",")[0],
  "cse332-w2-l5-qc-right-child-of-4": S(2 * 4 + 1),
  "cse332-w2-l5-qc-first-leaf": S(Math.floor(9 / 2) + 1),
  // binary search
  "cse332-w2-l3-search-worst-million": S(worst(1000000)),
  "cse332-w2-l3-gap-halving.solve-4096": S(Math.log2(4096)),
  "cse332-w2-l3-gap-halving.worst-2-to-20": S(worst(1048576)),
  "cse332-w2-l3-gap-halving.worst-million": S(worst(1000000)),
  "cse332-w2-l3-cyu-binary-4096": S(worst(4096)),
  // log base
  "cse332-w2-l3-log-base.log8-divisor": S(J1("logbase").ratio),
  "cse332-w2-l3-log-base.log8-at-2-to-30": S(30 / J1("logbase").ratio),
  "cse332-w2-l3-log-base.log5-in-o-log2": G.relate("log_5 n", "log n").o ? "yes" : "no",
  "cse332-w2-l3-log-base.log2-in-o-log5": G.relate("log n", "log_5 n").o ? "yes" : "no",
  // c / n0
  "cse332-w2-l3-notation-sq17-upper-n0": S(J1("sq17").upperSmallestN0),
  "cse332-w2-l3-cyu-sq17-n0": S(J1("sq17").upperSmallestN0),
  "cse332-w2-l3-proofs-example1-smallest-n0": S(J1("ex1").smallestN0),
  "cse332-w2-l3-example1-bigo.smallest-n0-c10": S(J1("ex1").smallestN0),
  "cse332-w2-l3-proofs-example2-c13": J1("ex2c13").anyN ? "yes" : "no",
  "cse332-w2-l3-example2-omega.smallest-n0-c12": S(J1("ex2", (r) => r.c === 12).smallestN0),
  "cse332-w2-l3-example2-omega.c13-possible": J1("ex2c13").anyN ? "yes" : "no",
  "cse332-w2-l3-cyu-example2-c11": S(J1("ex2", (r) => r.c === 11).smallestN0),
  // slide 31/32 verdicts (exact class engine, itself checked in unit-grader.mjs)
  "cse332-w2-l3-examples-log-plus-two": G.relate("log n + 2", "1").o ? "yes" : "no",
  "cse332-w2-l3-more-examples.four-plus-3n": G.relate("4+3n", "n").o ? "yes" : "no",
  "cse332-w2-l3-more-examples.n-plus-2logn": G.relate("n+2log n", "log n").o ? "yes" : "no",
  "cse332-w2-l3-more-examples.logn-plus-2": G.relate("log n + 2", "1").o ? "yes" : "no",
  "cse332-w2-l3-more-examples.n50-vs-1-1n": G.relate("n^50", "1.1^n").o ? "yes" : "no",
  "cse332-w2-l3-more-examples.3n-theta-2n": G.relate("3^n", "2^n").theta ? "yes" : "no",
  // exact thresholds
  "cse332-w2-l3-eventually-exact.n50-last-fail": S(J1("n50").lastFail),
  "cse332-w2-l3-eventually-exact.three-two-c1000": S(J1("threeTwo").firstFail),
  "cse332-w2-l3-eventually-exact.logn-plus-2-c12": S(J1("logConst").firstFail),
  "cse332-w2-l3-eventually-exact.n-plus-2logn-c10": S(J1("nlog").firstFail),
  "cse332-w2-l3-tenth-vs-log.tenth-at-2-to-40": S(J1("tenth").at40.tenth),
  "cse332-w2-l3-tenth-vs-log.bigger-at-2-to-40": BigInt(J1("tenth").at40.k10) > BigInt(J1("tenth").at40.twoK) ? "log" : "tenth",
  "cse332-w2-l3-tenth-vs-log.crossover-k": S(J1("tenth").firstK),
  // statements (slides 18, 33, 34): yes/no keys checked against the class engine where they are about functions
  "cse332-w2-l3-true-statements.omega-means-best": "no",
  "cse332-w2-l3-true-statements.binary-best-theta1": S(J("search").filter((r) => r.found).reduce((m, r) => Math.min(m, r.binary), 99)) === "1" ? "yes" : "no",
  "cse332-w2-l3-true-statements.binary-worst-omega-loglog": G.relate("log n", "log log n").omega ? "yes" : "no",
  "cse332-w2-l3-true-statements.n-in-o-n5": G.relate("n", "n^5").o ? "yes" : "no",
  "cse332-w2-l3-true-statements.n-theta-means-not-olog": !G.relate("n", "log n").o ? "yes" : "no",
};
const BIGO_TRUTH = { // buckets, checked against the class engine with a second spelling
  // Wed-Fri additions: verified above by running the code (counts / swap bounds), spelled a second way here
  "cse332-w2-l4-qc-sorted-array-insert": "3n + 2",
  "cse332-w2-s2-qc-numunique-worst": "n + n(n+1)/2",
  "cse332-w2-s2-qc-numunique-best": "2n",
  "cse332-w2-l5-qc-percolate-time": "2 log n + 1",
  "cse332-w2-l5-qc-buildheap-time": "2n",
  "cse332-w2-l3-drop-n3-2n-bucket": "n^3 + 2^n + 3n",
  "cse332-w2-l3-intuition-buckets.four-n-plus-five": "4n + 5",
  "cse332-w2-l3-intuition-buckets.half-nlogn": "0.5nlogn + 2n + 7",
  "cse332-w2-l3-intuition-buckets.cube-plus-exp": "n^3 + 2^n + 3n",
  "cse332-w2-l3-intuition-buckets.nlog-10n2": "n log(10n^2)",
  "cse332-w2-l3-cyu-bucket-cubic": "5n^3 + n^2 log n + 100",
};

let keys = 0;
const seen = new Set();
for (const m of html.matchAll(/<(div|li)\s[^>]*(data-answer|data-grader|data-bound)[^>]*>/g)) {
  const tag = m[0];
  const grader = attr(tag, "data-grader") || (attr(tag, "data-kind") === "num" ? "exact" : attr(tag, "data-kind") === "bigo" ? "bigo" : null);
  const answer = attr(tag, "data-answer");
  const part = attr(tag, "data-part");
  const id = part ? `${taskOf(m.index)}.${part}` : attr(tag, "data-id");
  if (!grader || grader === "self" || grader === "mc" || grader === "bound") continue;
  keys++; seen.add(id);
  if (grader === "exact" || grader === "yesno" || grader === "choice") {
    const want = TRUTH[id];
    ok(want !== undefined, `${id}: no independent truth registered`);
    if (want === undefined) continue;
    if (grader === "exact") ok(G.eq(G.evalExact(answer), G.evalExact(want)), `${id}: key ${answer} vs truth ${want}`);
    else ok(answer === want, `${id}: key ${answer} vs truth ${want}`);
  } else if (grader === "bigo") {
    const src = BIGO_TRUTH[id];
    ok(src !== undefined && G.checkBigO(answer, src.split("+")[0]).ok !== undefined && G.clsCmp(G.parseAsym(answer).cls, G.parseAsym(src).cls) === 0, `${id}: bigo key ${answer} is the class of ${src}`);
    ok(G.checkBigO(answer, answer).ok === true && !G.checkBigO(answer, answer).tag, `${id}: key is already simplified`);
  }
  // every misconception key must be graded wrong
  const mis = attr(tag, "data-miscon");
  if (mis) {
    for (const k of Object.keys(JSON.parse(mis))) {
      let r;
      if (grader === "exact") r = G.checkExact(k, answer);
      else if (grader === "yesno") r = G.checkYesNo(k, answer);
      else if (grader === "choice") r = G.checkChoice(k, answer, JSON.parse(attr(tag, "data-choices")));
      ok(r && r.ok === false, `${id}: misconception key "${k}" must be wrong`);
    }
  }
}
for (const id of Object.keys(TRUTH)) ok(seen.has(id), `truth registered for an id that isn't on the page: ${id}`);
ok(keys >= 40, `found ${keys} auto-graded keys`);

// c/n0 problems: the solution's pairs hold, near misses fail (decision procedure vs brute force over a window)
const BOUND_SOLUTIONS = [
  ["cse332-w2-l3-example1-bigo", "c", [["10", "10"], ["10", "4"], ["110", "1"]], [["10", "3"], ["1", "1"]]],
  ["cse332-w2-l3-example2-omega", "c", [["12", "50"], ["1", "5"], ["11", "25"]], [["12", "49"], ["13", "1000"]]],
  ["cse332-w2-l3-sq17-theta", "upper-c", [["20", "1"], ["4", "5"]], [["4", "4"], ["3", "1000"]]],
  ["cse332-w2-l3-sq17-theta", "lower-c", [["3", "1"], ["1", "1"]], [["4", "1000"]]],
];
for (const [tid, part, good, bad] of BOUND_SOLUTIONS) {
  const at = html.indexOf(`data-id="${tid}"`);
  const tag = new RegExp(`<div class="answer-spec" data-part="${part}"[^>]*data-bound='([^']+)'`).exec(html.slice(at))[1];
  const spec = JSON.parse(tag);
  const brute = (c, n0) => {
    const F = G.parsePoly(spec.f), Gp = G.parsePoly(spec.g), cc = G.evalExact(c);
    for (let n = BigInt(n0); n < BigInt(n0) + 20000n; n++) {
      const k = G.cmp(G.polyEval(F, n), G.mul(cc, G.polyEval(Gp, n)));
      if (spec.rel === "O" ? k > 0 : k < 0) return false;
    }
    return true;
  };
  for (const [c, n0] of good) ok(G.checkBound(spec, c, n0).holds && brute(c, n0), `${tid}.${part}: (${c}, ${n0}) holds`);
  for (const [c, n0] of bad) ok(!G.checkBound(spec, c, n0).holds && !brute(c, n0), `${tid}.${part}: (${c}, ${n0}) fails`);
}

/* ---------------------------------------------------------------- 3. numbers stated in prose */
const text = html.replace(/\s+/g, " ");
const has = (s, why) => ok(text.includes(s), `page states "${s}" (${why})`);
has("4{,}402", "n^50 crossover"); has("between 4,401 and 4,402", "hero note");
has("first at \\(n = 18\\)", "3^n vs 1000*2^n"); has("is 59 (checked with exact integers in Java)", "n > 10 log n");
has("peaks at \\(n = 525\\)", "ratio peak");
ok(J1("binaryWorst", (r) => r.n === 1024).worst === 11 && text.includes("For \\(n = 1024\\) it's 11"), "n = 1024 worst case is 11");
// A/B/C crossovers quoted on the notation page (from Lecture 2, recomputed exactly here)
{
  const A = (n) => 10n * n + 900n, B = (n) => 100n * n - 50n; // C = n^2/100 -> compare 100*A with n^2
  let bBelowA = 0n; for (let n = 1n; n < 100n; n++) if (B(n) < A(n)) bBelowA = n;
  let cBelowA = 0n; for (let n = 1n; n < 5000n; n++) if (n * n < 100n * A(n)) cBelowA = n;
  ok(bBelowA === 10n && cBelowA === 1083n && text.includes("up to \\(n = 1{,}083\\)") && text.includes("only up to \\(n = 10\\)"), `A/B/C crossovers (B<A up to ${bBelowA}, C<A up to ${cBelowA})`);
}
// slide 36 numbers in the teaching note
ok(Math.abs(2 ** 5.8 - 55.7) < 0.05 && Math.abs(2 ** 5.9 - 59.7) < 0.05, "2^5.8 ≈ 55.7 and 2^5.9 ≈ 59.7");
ok(Math.abs(Number(58n ** 10n) / 1e17 - 4.31) < 0.01 && Math.abs(2 ** 58 / 1e17 - 2.88) < 0.01 && Math.abs(Number(59n ** 10n) / 1e17 - 5.11) < 0.01 && Math.abs(2 ** 59 / 1e17 - 5.76) < 0.01, "k = 58, 59 values in problem 9");
ok(Math.abs(Number(43n ** 8n) / 1e13 - 1.17) < 0.01 && Math.abs(2 ** 43 / 1e12 - 8.80) < 0.01 && Math.abs(Number(44n ** 8n) / 1e13 - 1.40) < 0.01 && Math.abs(2 ** 44 / 1e13 - 1.76) < 0.01, "n = 43, 44 values in problem 8");
ok(Math.abs(Math.log2(1000) / (Math.log2(3) - 1) - 17.04) < 0.01, "slide-32 threshold 17.04 for c = 1000");
ok(Math.abs(10 * Math.log2(6) - 25.8) < 0.05 && Math.abs(8 * Math.log2(6) - 20.7) < 0.05, "6 > 10 log 6 ≈ 25.8 and 8 log 6 ≈ 20.7 (both false)");

console.log(`verify-answers: ${pass} passed, ${fail} failed (${keys} auto-graded answer keys, ${lines.length} Java result lines)`);
process.exit(fail ? 1 : 0);
