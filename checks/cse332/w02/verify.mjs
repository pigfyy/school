// Ground-truth check for every answer key and every stepper on the week 2 page.
// 1. Compiles java/lecture3/Lecture3.java (the lecture's search code, instrumented, plus exact BigInteger answers for
//    every crossover / n0 question) and java/heap/Heap.java (the lecture's heap pseudocode and the section's numUnique)
//    with javac, runs them, and compares every line with site/cse332/w02/sim.js: the steppers' end states, their
//    buildHeap intermediate states, and the arithmetic and comparisons their narration states.
// 2. Reads every auto-graded answer key from site/cse332/w02/index.html and checks it against an independently computed
//    value (Java output, an independent percolate, or the exact grader engine cross-checked by brute force).
// 3. Checks each misconception key is actually WRONG and has a message, and that numbers stated in prose match.
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

/* ---------------------------------------------------------------- 1b. heaps and numUnique: Java (the lecture's pseudocode) vs sim.js */
const HDIR = `${here}java/heap`;
mkdirSync(`${HDIR}/out`, { recursive: true });
execFileSync("java", ["-m", "jdk.compiler/com.sun.tools.javac.Main", "-d", "out", "Heap.java"], { cwd: HDIR, stdio: "pipe" });
const hraw = execFileSync("java", ["-cp", "out", "Heap"], { cwd: HDIR }).toString();
writeFileSync(`${HDIR}/heap-output.jsonl`, hraw);
const H = hraw.trim().split("\n").map((l) => JSON.parse(l));
const HJ = (name) => H.find((r) => r.name === name);
const liveOf = (st) => st.arr.slice(1, st.size + 1);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// every stepper, on every Java case: same end state, same swaps, same returned value
for (const r of H) {
  if (r.t === "insert") for (const gen of [Sim.insertIdeaSteps, Sim.insertCodeSteps]) {
    const end = gen(r.start, r.x).at(-1);
    ok(same(liveOf(end), r.after) && end.swaps === r.swaps && end.done, `${gen.name} ${r.name}: ${liveOf(end)} vs Java ${r.after}`);
  }
  if (r.t === "extract") for (const gen of [Sim.extractIdeaSteps, Sim.extractCodeSteps]) {
    const end = gen(r.start).at(-1);
    ok(same(liveOf(end), r.after) && end.swaps === r.swaps && end.returned === r.min, `${gen.name} ${r.name}: ${liveOf(end)} vs Java ${r.after}`);
  }
  if (r.t === "build") {
    const steps = Sim.buildSteps(r.start), end = steps.at(-1);
    ok(same(liveOf(end), r.after) && end.swaps === r.swaps && r.heap, `buildSteps ${r.name}`);
    // the array right before "percolateDown(i)" starts must equal Java's array after percolateDown(i+1)
    const after = Object.fromEntries(r.trace.map(([i, a]) => [i, a]));
    steps.forEach((st, k) => { const m = /^percolateDown\((\d+)\)/.exec(st.say); if (m && k > 0) ok(same(liveOf(steps[k - 1]), after[Number(m[1]) + 1]), `buildSteps ${r.name}: state before percolateDown(${m[1]})`); });
    const h = Sim.heapOf(r.start); const tr = Sim.buildHeap(h);
    ok(tr.every((t) => same(t.arr, after[t.i])), `Sim.buildHeap trace ${r.name}`);
  }
  if (r.t === "seq") {
    const h = Sim.heapOf([]), out = [];
    for (const op of r.ops) { if (op < 0) out.push(Sim.heapExtract(h).min); else Sim.heapInsert(h, op); }
    ok(same(out, r.out) && same(Sim.live(h), r.after) && Sim.isMinHeap(Sim.live(h)), `sequence ${r.name}`);
  }
  if (r.t === "numUnique") {
    const end = Sim.numUniqueSteps(r.values).at(-1);
    ok(end.out === r.out && end.inner === r.inner && end.first === r.first, `numUnique ${r.values.join("")}: out ${end.out} inner ${end.inner}`);
  }
}
// every scenario the page offers is one Java ran, with the same start
for (const [kind, list] of Object.entries(Sim.HEAP_SCENARIOS)) for (const sc of list) {
  const r = HJ(sc.name);
  ok(r && r.t === kind && same(r.start, sc.start) && (sc.x === undefined || r.x === sc.x), `scenario ${kind}/${sc.name} is checked by Heap.java`);
  const gens = { insert: [Sim.insertIdeaSteps, Sim.insertCodeSteps], extract: [Sim.extractIdeaSteps, Sim.extractCodeSteps], build: [Sim.buildSteps] }[kind];
  for (const gen of gens) {
    const steps = kind === "insert" ? gen(sc.start, sc.x) : gen(sc.start);
    const code = Sim.CODE[{ insertIdeaSteps: "insertIdea", insertCodeSteps: "insert", extractIdeaSteps: "extractIdea", extractCodeSteps: "extract", buildSteps: "build" }[gen.name]];
    ok(steps.every((s) => s.line === null || (code[s.line] !== undefined && code[s.line] !== "")), `${gen.name} ${sc.name}: every highlighted line exists`);
    ok(steps.every((s) => s.say && !/slide/i.test(s.say)), `${gen.name} ${sc.name}: narration has no slide references`);
    // the narrated arithmetic and comparisons are right
    for (const s of steps) {
      for (const m of s.say.matchAll(/\b(\d+)\/2 = (\d+)/g)) ok(Math.floor(Number(m[1]) / 2) === Number(m[2]), `${sc.name}: ${m[0]}`);
      for (const m of s.say.matchAll(/\b(\d+)\*2 = (\d+)/g)) ok(Number(m[1]) * 2 === Number(m[2]), `${sc.name}: ${m[0]}`);
      for (const m of s.say.matchAll(/\b(\d+)\*2\+1 = (\d+)/g)) ok(Number(m[1]) * 2 + 1 === Number(m[2]), `${sc.name}: ${m[0]}`);
      for (const m of s.say.matchAll(/(-?\d+(?:\.\d+)?) == (-?\d+(?:\.\d+)?): (true|false)/g)) ok(String(Number(m[1]) === Number(m[2])) === m[3], `${sc.name}: "${m[0]}"`);
      for (const m of s.say.matchAll(/(-?\d+(?:\.\d+)?) (<=|<|>|==) (-?\d+(?:\.\d+)?) is (true|false)/g)) {
        const a = Number(m[1]), b = Number(m[3]);
        const v = { "<": a < b, ">": a > b, "<=": a <= b, "==": a === b }[m[2]];
        ok(String(v) === m[4], `${sc.name}: "${m[0]}"`);
      }
      // values quoted as arr[k] = v match the state shown with that step
      for (const m of s.say.matchAll(/arr\[(\d+)\] = (?:arr\[\d+\] = |val = )?(-?\d+(?:\.\d+)?)/g)) ok(String(s.arr[Number(m[1])]) === m[2], `${sc.name}: "${m[0]}" vs state ${s.arr[Number(m[1])]}`);
    }
  }
}
// index arithmetic and height narration, for every i <= n <= 31
for (let n = 1; n <= 31; n++) {
  const say = Sim.heightSay(n);
  const h = Math.ceil(Math.log2(n + 1)) - 1;
  ok(say.startsWith(`n = ${n}: height ${h}.`), `heightSay(${n})`);
  for (const m of say.matchAll(/2\^(\d+) − 1 = (\d+)/g)) ok(2 ** Number(m[1]) - 1 === Number(m[2]), `heightSay(${n}): ${m[0]}`);
  for (let i = 1; i <= n; i++) {
    const info = Sim.indexInfo(i, n);
    ok(info.parent === (i === 1 ? null : Math.floor(i / 2)) && info.left === (2 * i <= n ? 2 * i : null) && info.right === (2 * i + 1 <= n ? 2 * i + 1 : null) && info.leaf === (2 * i > n) && info.firstLeaf === Math.floor(n / 2) + 1, `indexInfo(${i}, ${n})`);
    for (const t of Sim.indexSay(i, n)) {
      for (const m of t.matchAll(/\b(\d+)\/2 = (\d+)/g)) ok(Math.floor(Number(m[1]) / 2) === Number(m[2]), `indexSay(${i}, ${n}): ${m[0]}`);
      for (const m of t.matchAll(/\b(\d+)\*2 = (\d+)/g)) ok(Number(m[1]) * 2 === Number(m[2]), `indexSay(${i}, ${n}): ${m[0]}`);
      for (const m of t.matchAll(/\b(\d+)\*2\+1 = (\d+)/g)) ok(Number(m[1]) * 2 + 1 === Number(m[2]), `indexSay(${i}, ${n}): ${m[0]}`);
      for (const m of t.matchAll(/(\d+) <= (\d+) is (true|false)/g)) ok(String(Number(m[1]) <= Number(m[2])) === m[3], `indexSay(${i}, ${n}): ${m[0]}`);
    }
  }
}
// buildHeap's cost table: moves on a full tree of height H total n − H − 1 < n, and real runs never exceed it
for (let Hh = 0; Hh <= 25; Hh++) { const r = Sim.buildCost(Hh); ok(r.total === r.n - Hh - 1 && r.total < r.n, `buildCost(${Hh}) = n − H − 1`); }
for (const r of H.filter((x) => x.t === "build")) { const n = r.start.length, cap = Math.ceil(Math.log2(n + 1)) - 1; let bound = 0; for (let i = 1; i <= n; i++) { let d = 0, j = i; while (2 * j <= n) { j *= 2; d++; } bound += d; } ok(r.swaps <= bound && bound <= n, `buildHeap ${r.name}: ${r.swaps} swaps <= sum of subtree heights ${bound} <= n (height ${cap})`); }
{ let S = 0; for (let i = 0; i <= 80; i++) S += i / 2 ** (i + 1); ok(Math.abs(S - 1) < 1e-12, `sum i/2^(i+1) -> 1 (${S})`); for (let N = 1; N <= 40; N++) { let s = 0; for (let i = 0; i <= N; i++) s += i / 2 ** (i + 1); ok(Math.abs(s - (1 - (N + 2) / 2 ** (N + 1))) < 1e-12, `partial sum to ${N}`); } }
// Section 2, question 0: the verdict rule reproduces the official answers
{
  const L = Sim.LADDER, k = (s) => L.indexOf(s);
  const official = [["O", "n^2", "always"], ["O", "n", "always"], ["O", "log n", "sometimes"], ["O", "n log n", "always"], ["O", "1", "sometimes"], ["Omega", "n", "sometimes"], ["Omega", "log n", "sometimes"], ["Omega", "n^2", "never"]]; // O(4n) is the class of n
  ok(official.every(([rel, g, v]) => Sim.boundVerdict("O", k("n"), rel, k(g)) === v), "boundVerdict matches the worksheet's question 0 solutions");
  // and agrees with testing every class in the band with the exact class engine
  for (const sup of ["O", "Omega", "Theta"]) for (let s = 0; s < L.length; s++) for (const rel of ["O", "Omega", "Theta"]) for (let t = 0; t < L.length; t++) {
    const band = sup === "O" ? L.slice(0, s + 1) : sup === "Omega" ? L.slice(s) : [L[s]];
    const holds = band.map((f) => { const r = G.relate(f, L[t]); return rel === "O" ? r.o : rel === "Omega" ? r.omega : r.theta; });
    const brute = holds.every(Boolean) ? "always" : holds.some(Boolean) ? "sometimes" : "never";
    // Ω leaves f unbounded above (it could be 3ⁿ, past the ladder), so an O or Θ statement is never "always" there
    const want = sup === "Omega" && rel !== "Omega" && brute === "always" ? "sometimes" : brute;
    ok(Sim.boundVerdict(sup, s, rel, t) === want, `boundVerdict ${sup}(${L[s]}) ⇒ ${rel}(${L[t]}): ${Sim.boundVerdict(sup, s, rel, t)} vs ${want}`);
  }
}
// the c / n0 explorer's claims
for (const cl of Sim.CLAIMS) ok(cl.cs.includes(cl.c0) && cl.n00 >= 1 && cl.n00 <= cl.N, `explorer claim ${cl.id} starts on a listed c`);
ok(Sim.CLAIMS.find((c) => c.id === "sq-vs-n").cs.every((c) => G.smallestN0({ f: ["0", "0", "1"], g: ["0", "1"], rel: "O" }, c).n0 === null), "n^2 ∈ O(n): no c on the slider works");
ok(G.smallestN0({ f: ["0", "-50", "13"], g: ["0", "0", "1"], rel: "Omega" }, "13").n0 === null && Number(G.smallestN0({ f: ["0", "-50", "13"], g: ["0", "0", "1"], rel: "Omega" }, "25/2").n0) === 100, "Example 2: c = 13 never; c = 12.5 from 100");
ok(G.checkBound({ f: ["100", "10"], g: ["0", "0", "1"], rel: "O" }, "10", "10").holds, "the explorer's starting pair for Example 1 (the lecture's) holds");

/* ---------------------------------------------------------------- 2. answer keys in the HTML */
const html = readFileSync(`${here}../../../site/cse332/w02/index.html`, "utf8");
const attr = (tag, name) => { const m = new RegExp(`${name}='([^']*)'|${name}="([^"]*)"`).exec(tag); return m ? (m[1] ?? m[2]).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"') : null; };
const taskOf = (idx) => { const before = html.slice(0, idx); const m = [...before.matchAll(/<article class="task" data-id="([^"]+)"/g)]; return m.length ? m[m.length - 1][1] : null; };
const S = (n) => String(n);
const worst = (n) => J1("binaryWorst", (r) => r.n === n).worst;
const yn = (b) => (b ? "yes" : "no");
// an independent percolate (not sim.js) for the key questions that change a key in place
const upI = (h, i) => { let n = 0; while (i > 1 && h[i] < h[i >> 1]) { [h[i], h[i >> 1]] = [h[i >> 1], h[i]]; i >>= 1; n++; } return { n, at: i }; };
const downI = (h, i, size) => { let n = 0; while (i * 2 <= size) { let c = i * 2; if (c + 1 <= size && !(h[c] < h[c + 1])) c++; if (h[c] < h[i]) { [h[c], h[i]] = [h[i], h[c]]; i = c; n++; } else break; } return { n, at: i }; };
const heightI = (n) => { let h = 0; while (2 ** (h + 1) - 1 < n) h++; return h; };
const lad = (s) => Sim.LADDER.indexOf(s);

const TRUTH = {};
const BIGO_TRUTH = {};
const FORMULA_TRUTH = {};
/* Lecture 3 */
Object.assign(TRUTH, {
  "cse332-w2-l3-search-double-n": (() => { const d = new Set(); for (let n = 1; n <= 5000; n++) d.add(Sim.worstGaps(2 * n).length - Sim.worstGaps(n).length); return d.size === 1 ? S([...d][0]) : "varies"; })(),
  "cse332-w2-l3-notation-same-pair-n3": yn(G.checkBound({ f: ["17", "0", "3"], g: ["0", "0", "0", "1"], rel: "O" }, "4", "5").holds),
  "cse332-w2-l3-examples-log-cube": yn(G.relate("log(n^3)", "log n").theta),
  "cse332-w2-l3-cases-best-is-o-n": yn(J("search").filter((r) => r.found).some((r) => r.linear === 1) && G.relate("1", "n").o),
  "cse332-w2-l3-gap-halving.solve-4096": S(Math.log2(4096)),
  "cse332-w2-l3-gap-halving.worst-2-to-20": S(worst(1048576)),
  "cse332-w2-l3-gap-halving.worst-million": S(worst(1000000)),
  "cse332-w2-l3-log-base.log8-divisor": S(J1("logbase").ratio),
  "cse332-w2-l3-log-base.log8-at-2-to-30": S(30 / J1("logbase").ratio),
  "cse332-w2-l3-log-base.log5-in-o-log2": yn(G.relate("log_5 n", "log n").o),
  "cse332-w2-l3-log-base.log2-in-o-log5": yn(G.relate("log n", "log_5 n").o),
  "cse332-w2-l3-example1-bigo.smallest-n0-c10": S(J1("ex1").smallestN0),
  "cse332-w2-l3-example2-omega.smallest-n0-c12": S(J1("ex2", (r) => r.c === 12).smallestN0),
  "cse332-w2-l3-example2-omega.c13-possible": yn(J1("ex2c13").anyN),
  "cse332-w2-l3-more-examples.four-plus-3n": yn(G.relate("4+3n", "n").o),
  "cse332-w2-l3-more-examples.n-plus-2logn": yn(G.relate("n+2log n", "log n").o),
  "cse332-w2-l3-more-examples.logn-plus-2": yn(G.relate("log n + 2", "1").o),
  "cse332-w2-l3-more-examples.n50-vs-1-1n": yn(G.relate("n^50", "1.1^n").o),
  "cse332-w2-l3-more-examples.3n-theta-2n": yn(G.relate("3^n", "2^n").theta),
  "cse332-w2-l3-eventually-exact.four-two-c1000": S((() => { let n = 1n; while (!(4n ** n > 1000n * 2n ** n)) n++; return Number(n); })()),
  "cse332-w2-l3-eventually-exact.logn-plus-2-c12": S(J1("logConst").firstFail),
  "cse332-w2-l3-eventually-exact.n-plus-2logn-pow2": S((() => { let k = 1; while (!(2 ** k + 2 * k > 10 * k)) k++; return 2 ** k; })()),
  "cse332-w2-l3-tenth-vs-log.tenth-at-2-to-40": S(J1("tenth").at40.tenth),
  "cse332-w2-l3-tenth-vs-log.bigger-at-2-to-40": BigInt(J1("tenth").at40.k10) > BigInt(J1("tenth").at40.twoK) ? "log" : "tenth",
  "cse332-w2-l3-tenth-vs-log.bigger-at-2-to-60": 2n ** 6n > 60n ? "tenth" : "log",
  "cse332-w2-l3-true-statements.omega-means-best": "no",
  "cse332-w2-l3-true-statements.binary-best-theta1": J("search").filter((r) => r.found).reduce((m, r) => Math.min(m, r.binary), 99) === 1 ? "yes" : "no",
  "cse332-w2-l3-true-statements.binary-worst-omega-loglog": yn(G.relate("log n", "log log n").omega),
  "cse332-w2-l3-true-statements.n-in-o-n5": yn(G.relate("n", "n^5").o),
  "cse332-w2-l3-true-statements.n-theta-means-not-olog": yn(!G.relate("n", "log n").o),
});
Object.assign(BIGO_TRUTH, {
  "cse332-w2-l3-search-log-n-squared": "2 log n",
  "cse332-w2-l3-drop-cube-vs-n2log": "n^2 log n + n^3/1000",
  "cse332-w2-l3-intuition-buckets.four-n-plus-five": "4n + 5",
  "cse332-w2-l3-intuition-buckets.half-nlogn": "0.5nlogn + 2n + 7",
  "cse332-w2-l3-intuition-buckets.cube-plus-exp": "n^3 + 2^n + 3n",
  "cse332-w2-l3-intuition-buckets.nlog-10n2": "n log(10n^2)",
});
/* Lecture 4 */
{
  const ins4 = HJ("qc-l4-insert-4"), at4 = (ins4.start.length + 1) >> ins4.swaps;
  const ext6 = HJ("qc-l4-extract"), at6 = ext6.after.indexOf(6) + 1;
  const pIns = HJ("p-l4-insert-4"), pExt = HJ("p-l4-extract"), at8 = pExt.after.indexOf(8) + 1;
  const wrong = [null, 1, 3, 5, 7, 8, 9]; wrong[1] = wrong.pop(); { const big = wrong[2] > wrong[3] ? 2 : 3; [wrong[1], wrong[big]] = [wrong[big], wrong[1]]; }
  const trace = HJ("p-l4-trace").out, ex2 = HJ("l4-trace-example2").out;
  const minNodes5 = (() => { let n = 1; while (heightI(n) < 5) n++; return n; })();
  Object.assign(TRUTH, {
    "cse332-w2-l4-qc-example2-third": S(ex2[2]),
    "cse332-w2-l4-shape-min-nodes-h5": S(minNodes5),
    "cse332-w2-l4-qc-heap-leaf-ancestor": (() => { const h = [1, 5, 2, 6, 7, 3, 4]; return Sim.isMinHeap(h) && h[1] > h[5] ? "no" : "yes"; })(),
    "cse332-w2-l4-insert-parent-of-4": S(ins4.after[(at4 >> 1) - 1]),
    "cse332-w2-l4-extract-parent-of-6": S(ext6.after[(at6 >> 1) - 1]),
    "cse332-w2-l4-pq-trace.first": S(trace[0]), "cse332-w2-l4-pq-trace.second": S(trace[1]), "cse332-w2-l4-pq-trace.third": S(trace[2]), "cse332-w2-l4-pq-trace.fifth": S(trace[4]),
    "cse332-w2-l4-height.max-h5": S(2 ** 6 - 1), "cse332-w2-l4-height.h-1000": S(heightI(1000)), "cse332-w2-l4-height.h-1024": S(heightI(1024)), "cse332-w2-l4-height.h-1023": S(heightI(1023)),
    "cse332-w2-l4-insert-tree.swaps": S(pIns.swaps), "cse332-w2-l4-insert-tree.root-left": S(pIns.after[1]), "cse332-w2-l4-insert-tree.bottom-left": S(pIns.after[7]),
    "cse332-w2-l4-extract-tree.returned": S(pExt.min), "cse332-w2-l4-extract-tree.swaps": S(pExt.swaps), "cse332-w2-l4-extract-tree.new-root": S(pExt.after[0]), "cse332-w2-l4-extract-tree.parent-of-8": S(pExt.after[(at8 >> 1) - 1]),
    "cse332-w2-l4-larger-child.valid-after-wrong": yn(Sim.isMinHeap(wrong.slice(1))),
    "cse332-w2-l4-larger-child.correct-root": S(HJ("p-l4-larger-child").after[0]), "cse332-w2-l4-larger-child.correct-swaps": S(HJ("p-l4-larger-child").swaps),
    "cse332-w2-l4-cyu-insert-6": S(HJ("cyu-l4-insert-6").swaps),
    "cse332-w2-l4-cyu-height-100": S(heightI(100)),
  });
  ok(same(ex2, [3, 1, 5, 6, 8]) && same(HJ("l4-trace-example1").out, [1, 3, 5, 6, 8]), "the lecture's two PQ examples print 3,1,5,6,8 and 1,3,5,6,8");
  ok(same(pIns.after, [2, 4, 3, 5, 6, 4, 8, 9]) && same(pExt.after, [3, 5, 4, 9, 6, 8]) && same(HJ("p-l4-larger-child").after, [3, 7, 5, 9, 8]), "L4 problem solutions' level orders");
  // every heap drawn on the page as a starting state is a valid min-heap, except the ones asked about
  const drawn = [...html.matchAll(/data-tree="([^"]+)"/g)].map((m) => m[1]);
  const notHeaps = new Set(["5,4,6", "5,7,6,8,_,9", "2,4,3,_,_,6,5", "1,4,2,3,5,6,7", "4,6,5,7,3,8,9", "9,8,7,6,5,4,3,2,1"]);
  for (const t of new Set(drawn)) if (!notHeaps.has(t)) ok(!t.includes("_") && Sim.isMinHeap(t.split(",").map(Number)), `drawn tree ${t} is a valid min-heap`);
  for (const t of notHeaps) ok(drawn.includes(t) && (t.includes("_") || !Sim.isMinHeap(t.split(",").map(Number))), `drawn tree ${t} is not a heap, as the page says`);
  Object.assign(BIGO_TRUTH, {
    "cse332-w2-l4-pq-costs.unsorted-extract": "n", "cse332-w2-l4-pq-costs.sorted-insert": "n + 1", "cse332-w2-l4-pq-costs.sorted-extract": "1", "cse332-w2-l4-pq-costs.heap-insert": "log n + 1",
    "cse332-w2-l4-cyu-sort-with-pq": "2 n log n",
  });
  // heap insert really is floor(log2 n) swaps in the worst case (a new minimum each time)
  ok([8, 64, 512, 4096].every((n) => { const h = Sim.heapOf([]); let w = 0; for (let v = n; v >= 1; v--) w = Math.max(w, Sim.heapInsert(h, v).swaps); return w === Math.floor(Math.log2(n)); }), "worst-case insert swaps = floor(log2 n)");
}
/* Section 2 */
{
  const nu = (vals) => H.find((r) => r.t === "numUnique" && same(r.values, vals));
  const d6 = nu(["a", "b", "c", "d", "e", "f"]), s6 = nu(["a", "a", "a", "a", "a", "a"]), abab = nu(["a", "b", "a", "b"]);
  const first = (f, gg, c) => { for (let n = 1; n < 10000; n++) { let good = true; for (let m = n; m < n + 2000; m++) if (f(m) > c * gg(m)) { good = false; break; } if (good) return n; } };
  const v = (rel, k) => Sim.boundVerdict("Omega", lad("n log n"), rel, lad(k));
  Object.assign(TRUTH, {
    "cse332-w2-s2-proofs-by-parts-c": S(5 + 2),
    "cse332-w2-s2-theta-same-c": "no",
    "cse332-w2-s2-theta-c1-omega": yn(G.smallestN0({ f: ["5", "0", "2"], g: ["0", "0", "4"], rel: "Omega" }, "1").n0 !== null),
    "cse332-w2-s2-numunique-abab": S(abab.inner),
    "cse332-w2-s2-q0-omega.o-n2": v("O", "n^2"), "cse332-w2-s2-q0-omega.omega-n": v("Omega", "n"), "cse332-w2-s2-q0-omega.o-n": v("O", "n"), "cse332-w2-s2-q0-omega.theta-nlogn": v("Theta", "n log n"), "cse332-w2-s2-q0-omega.omega-n2": v("Omega", "n^2"),
    "cse332-w2-s2-q1c.k": S(3 ** 2),
    "cse332-w2-s2-q1c.c1-works": yn(Array.from({ length: 300 }, (_, i) => i + 1).every((n) => 2n ** BigInt(n) <= 3n ** BigInt(2 * n))),
    "cse332-w2-s2-smallest-n0.q1b": S(first(() => 1000, (n) => 3 * n * n, 1)), "cse332-w2-s2-smallest-n0.q1d": S(first((n) => 7 * n * n + 3 * n, (n) => n ** 4, 10)), "cse332-w2-s2-smallest-n0.q2b": S(first((n) => n ** 3 + 10 * n, (n) => 3 * n ** 3, 1)), "cse332-w2-s2-smallest-n0.q1e": S(first((n) => n + 2 * n * Math.log2(n), (n) => n * Math.log2(n), 3)),
    "cse332-w2-s2-numunique-trace.distinct-out": S(d6.out), "cse332-w2-s2-numunique-trace.distinct-inner": S(d6.inner), "cse332-w2-s2-numunique-trace.same-out": S(s6.out), "cse332-w2-s2-numunique-trace.same-inner": S(s6.inner),
    "cse332-w2-s2-cyu-squeeze-n0": S(first((n) => n, (n) => n * Math.log2(n), 1)),
  });
  ok(G.checkBound({ f: ["0", "2", "0", "5"], g: ["0", "0", "0", "1"], rel: "O" }, "7", "1").holds && !G.checkBound({ f: ["0", "2", "0", "5"], g: ["0", "0", "0", "1"], rel: "O" }, "6", "1").holds, "by parts: 5n^3 + 2n <= 7n^3 from n = 1, and 6 isn't enough there");
  ok(G.checkBound({ f: ["5", "0", "2"], g: ["0", "0", "4"], rel: "O" }, "1", "3").holds && G.checkBound({ f: ["5", "0", "2"], g: ["0", "0", "4"], rel: "Omega" }, "1/2", "1").holds, "the section's 2n^2+5 ∈ Θ(4n^2) pairs hold");
  ok(G.checkBound({ f: ["100", "10"], g: ["0", "0", "1"], rel: "O" }, "10", "6").holds, "the section's 10n+100 pair (10, 6) holds");
  // numUnique: worst n + n(n+1)/2, best 2n, and two distinct strings stay linear
  const counts = (n, kind) => H.find((r) => r.t === "numUnique" && r.values.length === n && r.values.every((x) => (kind === "d" ? x.startsWith("v") : x === "s")));
  const at = (expr, n) => G.qToNumber(G.evalExact(expr, { n: G.Q(BigInt(n)) }));
  for (let n = 1; n <= 30; n++) { const d = counts(n, "d"), s = counts(n, "s"); ok(at("n + n(n+1)/2", n) === d.first + d.inner && at("2n", n) === s.first + s.inner && at("n(n+1)/2", n) === d.inner, `numUnique n=${n} formulas`); }
  ok([[4, 2], [10, 3], [37, 5]].every(([n, split]) => { const vals = Array.from({ length: n }, (_, i) => (i % split === 0 ? "x" : "y")); return Sim.numUniqueSteps(vals).at(-1).inner <= 2 * n; }), "two different strings: at most 2n inner iterations");
  Object.assign(FORMULA_TRUTH, { "cse332-w2-s2-numunique-model.worst": "n + n(n+1)/2", "cse332-w2-s2-numunique-model.best": "2n", "cse332-w2-s2-cyu-sum": "n(n+1)/2" });
  Object.assign(BIGO_TRUTH, { "cse332-w2-q2-numunique-same-bucket": "2n" });
}
/* Lecture 5 */
{
  const lec = [null, ...Sim.LECTURE_HEAP];
  const dec9 = [...lec]; dec9[9] = 0; const r9 = upI(dec9, 9);
  const decA = [...lec]; decA[5] = 0; const rA = upI(decA, 5);
  const incB = [...lec]; incB[2] = 10; const rB = downI(incB, 2, 9);
  const ins0 = HJ("p-l5-insert-0"), ext = HJ("p-l5-extract"), seq = HJ("p-l5-sequence"), rev = HJ("p-l5-reverse"), revIns = HJ("p-l5-reverse-insert");
  const seqH = Sim.heapOf([]); const seqSwaps = [16, 32, 4, 57, 80, 43, 2].map((v) => Sim.heapInsert(seqH, v).swaps); const rootAfterInserts = seqH.arr[1];
  const isHeapLevel = (a) => a.every((x, i) => i === 0 || a[Math.floor((i + 1) / 2) - 1] <= x);
  Object.assign(TRUTH, {
    "cse332-w2-l5-array-first-leaf-6": S((() => { let i = 1; while (2 * i <= 6) i++; return i; })()),
    "cse332-w2-l5-array-children-of-5": S([10, 11].filter((c) => c <= 10).length),
    "cse332-w2-l5-update-swaps-9": S(r9.n),
    "cse332-w2-l5-trace-root": S(HJ("qc-l5-sequence").after[0]),
    "cse332-w2-l5-build-first-i": S((() => { let i = 12; while (2 * i > 12) i--; return i; })()),
    "cse332-w2-l5-buildtime-sum": "1",
    "cse332-w2-l5-heap-check.a": yn(isHeapLevel([2, 4, 3, 8, 5, 9, 7])), "cse332-w2-l5-heap-check.b": yn(isHeapLevel([1, 4, 2, 3, 5, 6, 7])), "cse332-w2-l5-heap-check.c": yn(isHeapLevel([3, 5, 4, 9, 6, 7, 8, 10])), "cse332-w2-l5-heap-check.d": yn(isHeapLevel([4, 6, 5, 7, 3, 8, 9])),
    "cse332-w2-l5-insert-extract.insert-swaps": S(ins0.swaps), "cse332-w2-l5-insert-extract.insert-root": S(ins0.after[0]), "cse332-w2-l5-insert-extract.extract-returned": S(ext.min), "cse332-w2-l5-insert-extract.extract-root": S(ext.after[0]),
    "cse332-w2-l5-build-sequence.swaps-2": S(seqSwaps[6]), "cse332-w2-l5-build-sequence.root-after-inserts": S(rootAfterInserts), "cse332-w2-l5-build-sequence.extracted": S(seq.out[0]), "cse332-w2-l5-build-sequence.root-after-extract": S(seq.after[0]),
    "cse332-w2-l5-buildheap.first-leaf": S(Math.floor(9 / 2) + 1), "cse332-w2-l5-buildheap.total-swaps": S(rev.swaps), "cse332-w2-l5-buildheap.final-root": S(rev.after[0]), "cse332-w2-l5-buildheap.insert-swaps": S(revIns.swaps),
    "cse332-w2-l5-index.parent-13": S(Math.floor(13 / 2)), "cse332-w2-l5-index.left-7": S(2 * 7), "cse332-w2-l5-index.first-leaf": S(Math.floor(20 / 2) + 1), "cse332-w2-l5-index.leaf-10": yn(2 * 10 > 20),
    "cse332-w2-l5-update-key.dir-a": "up", "cse332-w2-l5-update-key.swaps-a": S(rA.n), "cse332-w2-l5-update-key.dir-b": "down", "cse332-w2-l5-update-key.index-b": S(rB.at),
    "cse332-w2-q2-parent-1based": S(Math.floor(11 / 2)), "cse332-w2-l5-cyu-left-child-6": S(2 * 6), "cse332-w2-l5-cyu-leaves-n12": S(Math.floor(12 / 2) + 1),
  });
  ok(rA.at === 1 && decA[1] === 0 && Sim.isMinHeap(decA.slice(1)) && Sim.isMinHeap(incB.slice(1)) && same(incB.slice(1), [1, 4, 2, 5, 7, 5, 6, 10, 9]), "change-key answers leave a valid heap (1,4,2,5,7,5,6,10,9 after the increase)");
  ok(same(seq.after, [4, 32, 16, 57, 80, 43]) && same(Sim.live(seqH), [2, 32, 4, 57, 80, 43, 16]), "the lecture's 16..2 example: 2,32,4,57,80,43,16 then 4,32,16,57,80,43");
  ok(same(rev.after, [1, 2, 3, 6, 5, 4, 7, 8, 9]) && same(ins0.after, [0, 1, 2, 4, 3, 5, 6, 5, 9, 7]) && same(ext.after, [2, 3, 5, 4, 7, 9, 6, 5]), "L5 problem solutions' arrays");
  ok(same(HJ("lecture-build").after, [1, 2, 7, 3, 6, 8, 10, 14, 5, 15]), "the lecture's buildHeap result 1,2,7,3,6,8,10,14,5,15");
  Object.assign(BIGO_TRUTH, { "cse332-w2-l5-trace-n-inserts": "n log n + n" });
  // repeated insert really is n log n-ish in the worst case, and buildHeap stays under n swaps
  ok([1 << 10, 1 << 12].every((n) => { const h = Sim.heapOf([]); let s = 0; for (let v = n; v >= 1; v--) s += Sim.heapInsert(h, v).swaps; const b = Sim.heapOf(Array.from({ length: n }, (_, i) => n - i)); const bs = Sim.buildHeap(b).reduce((x, t) => x + t.swaps, 0); return s > n * (Math.log2(n) - 3) && bs < n; }), "reverse-sorted input: ~n log n swaps by repeated insert, < n by buildHeap");
}

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
  const choices = attr(tag, "data-choices") ? JSON.parse(attr(tag, "data-choices")) : attr(tag, "data-options") ? attr(tag, "data-options").split("|").map((o) => o.split(":")[0]) : null;
  const points = attr(tag, "data-points") ? JSON.parse(attr(tag, "data-points")) : null;
  if (grader === "exact" || grader === "yesno" || grader === "choice") {
    const want = TRUTH[id];
    ok(want !== undefined, `${id}: no independent truth registered`);
    if (want === undefined) continue;
    if (grader === "exact") ok(G.eq(G.evalExact(answer), G.evalExact(want)), `${id}: key ${answer} vs truth ${want}`);
    else ok(answer === want, `${id}: key ${answer} vs truth ${want}`);
    if (grader === "choice") ok(choices && choices.includes(answer), `${id}: the key is one of the options`);
  } else if (grader === "bigo") {
    const src = BIGO_TRUTH[id];
    ok(src !== undefined && G.clsCmp(G.parseAsym(answer).cls, G.parseAsym(src).cls) === 0, `${id}: bigo key ${answer} is the class of ${src}`);
    ok(G.checkBigO(answer, answer).ok === true && !G.checkBigO(answer, answer).tag, `${id}: key is already simplified`);
  } else if (grader === "formula") {
    const src = FORMULA_TRUTH[id];
    ok(src !== undefined && G.checkFormula(src, answer, points).ok === true, `${id}: formula key ${answer} equals ${src}`);
  } else ok(false, `${id}: grader ${grader} isn't checked here`);
  // every misconception key must be graded wrong
  const mis = attr(tag, "data-miscon");
  if (mis) {
    for (const k of Object.keys(JSON.parse(mis))) {
      let r;
      if (grader === "exact") r = G.checkExact(k, answer);
      else if (grader === "yesno") r = G.checkYesNo(k, answer);
      else if (grader === "choice") r = G.checkChoice(k, answer, choices);
      else if (grader === "formula") r = G.checkFormula(k, answer, points);
      ok(r && r.ok === false, `${id}: misconception key "${k}" must be wrong`);
    }
  }
}
for (const id of [...Object.keys(TRUTH), ...Object.keys(BIGO_TRUTH), ...Object.keys(FORMULA_TRUTH)]) ok(seen.has(id), `truth registered for an id that isn't on the page: ${id}`);
ok(keys >= 100, `found ${keys} auto-graded keys`);
// every misconception tag has a message
{
  const W = {}; const ctx = { window: W }; (new Function("window", readFileSync(`${here}../../../site/cse332/w02/week.js`, "utf8").split('"use strict";')[0]))(W);
  const tags = new Set([...html.matchAll(/data-miscon='([^']+)'/g)].flatMap((m) => Object.values(JSON.parse(m[1]))));
  for (const t of tags) ok(W.WEEK.messages[t], `misconception tag "${t}" has a message`);
}

// c/n0 problems: the solution's pairs hold, near misses fail (decision procedure vs brute force over a window)
const BOUND_SOLUTIONS = [
  ["cse332-w2-l3-example1-bigo", "c", [["10", "10"], ["10", "4"], ["110", "1"]], [["10", "3"], ["1", "1"]]],
  ["cse332-w2-l3-example2-omega", "c", [["12", "50"], ["1", "5"], ["11", "25"]], [["12", "49"], ["13", "1000"]]],
  ["cse332-w2-l3-sq17-theta", "upper-c", [["20", "1"], ["4", "5"]], [["4", "4"], ["3", "1000"]]],
  ["cse332-w2-l3-sq17-theta", "lower-c", [["3", "1"], ["1", "1"]], [["4", "1000"]]],
  ["cse332-w2-s2-worksheet-pairs", "q1a-c", [["70", "1"], ["100", "1"]], [["69", "1"], ["1", "1000"]]],
  ["cse332-w2-s2-worksheet-pairs", "q1b-c", [["1", "20"], ["1", "19"]], [["1", "18"], ["1/1000", "500"]]],
  ["cse332-w2-s2-worksheet-pairs", "q2b-o-c", [["1", "4"], ["1", "3"]], [["1", "2"], ["1/3", "1000"]]],
  ["cse332-w2-s2-worksheet-pairs", "q2b-omega-c", [["1/3", "1"], ["1/3", "5"]], [["1", "1000"], ["1/2", "10"]]],
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

/* ---------------------------------------------------------------- 3. numbers stated in prose, and no slide references */
const text = html.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ");
const has = (s, why) => ok(text.includes(s), `page states "${s}" (${why})`);
has("4{,}402", "n^50 crossover"); has("between 4,401 and 4,402", "home prose");
has("first fails at \\(n = 18\\)", "3^n vs 1000*2^n");
ok(J1("binaryWorst", (r) => r.n === 1024).worst === 11 && text.includes("For \\(n = 1024\\) that's 11"), "n = 1024 worst case is 11");
{
  const A = (n) => 10n * n + 900n, B = (n) => 100n * n - 50n; // C = n^2/100 -> compare 100*A with n^2
  let bBelowA = 0n; for (let n = 1n; n < 100n; n++) if (B(n) < A(n)) bBelowA = n;
  let cBelowA = 0n; for (let n = 1n; n < 5000n; n++) if (n * n < 100n * A(n)) cBelowA = n;
  let cBelowB = 0n; for (let n = 1n; n < 5000n; n++) if (n * n < 100n * B(n)) cBelowB = n;
  ok(bBelowA === 10n && cBelowA === 1083n && cBelowB > cBelowA && text.includes("up to \\(n = 1{,}083\\)") && text.includes("only up to \\(n = 10\\)"), `A/B/C crossovers (B<A up to ${bBelowA}, C<A up to ${cBelowA}, C<B up to ${cBelowB})`);
}
ok(Math.abs(Math.log2(5) - 2.32) < 0.005, "log2 5 ≈ 2.32");
ok(Math.abs(Number(58n ** 10n) / 1e17 - 4.31) < 0.01 && Math.abs(2 ** 58 / 1e17 - 2.88) < 0.01 && Math.abs(Number(59n ** 10n) / 1e17 - 5.11) < 0.01 && Math.abs(2 ** 59 / 1e17 - 5.76) < 0.01, "k = 58, 59 values in problem 9");
ok(Math.abs(Number(43n ** 8n) / 1e13 - 1.17) < 0.01 && Math.abs(2 ** 43 / 1e12 - 8.80) < 0.01 && Math.abs(Number(44n ** 8n) / 1e13 - 1.40) < 0.01 && Math.abs(2 ** 44 / 1e13 - 1.76) < 0.01, "n = 43, 44 values in problem 8");
ok(Math.abs(Math.log2(1000) / (Math.log2(3) - 1) - 17.04) < 0.01, "threshold 17.04 for c = 1000");
ok(heightI(9) === 3, "the lecture's 9-node heap has height 3");
ok(!/\bslides?\b/i.test(text.replace(/files\/slides\//g, "")), "no student-facing text mentions slides");
ok(!/details class="notes"/.test(html), "no instructor teaching notes");

console.log(`verify-answers: ${pass} passed, ${fail} failed (${keys} auto-graded answer keys, ${lines.length} Java result lines for Lecture 3, ${H.length} for heaps and numUnique)`);
process.exit(fail ? 1 : 0);
