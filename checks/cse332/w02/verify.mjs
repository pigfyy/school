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
  const swapsSaid = (say) => Number((/(\d+) swaps?\b(?![\s\S]*\d+ swaps?\b)/.exec(say) || [])[1]);
  if (r.t === "insert") for (const gen of [Sim.insertIdeaSteps, Sim.insertCodeSteps]) {
    const end = gen(r.start, r.x).at(-1);
    ok(same(liveOf(end), r.after) && end.swaps === r.swaps && end.done && swapsSaid(end.say) === r.swaps, `${gen.name} ${r.name}: ${liveOf(end)} vs Java ${r.after}`);
  }
  if (r.t === "extract") for (const gen of [Sim.extractIdeaSteps, Sim.extractCodeSteps]) {
    const end = gen(r.start).at(-1);
    ok(same(liveOf(end), r.after) && end.swaps === r.swaps && end.returned === r.min && swapsSaid(end.say) === r.swaps, `${gen.name} ${r.name}: ${liveOf(end)} vs Java ${r.after}`);
  }
  if (r.t === "build") {
    const steps = Sim.buildSteps(r.start), end = steps.at(-1);
    ok(same(liveOf(end), r.after) && end.swaps === r.swaps && r.heap && swapsSaid(end.say) === r.swaps, `buildSteps ${r.name}`);
    // each "percolateDown(i)" step shows Java's array after percolateDown(i), and says how many swaps that call made
    const after = Object.fromEntries(r.trace.map(([i, a]) => [i, a]));
    let calls = 0, said = 0;
    steps.forEach((st) => {
      const m = /^percolateDown\((\d+)\)/.exec(st.say);
      if (!m) return;
      calls++;
      const k = (st.say.match(/is true, so swap\./g) || []).length;
      said += k;
      ok(same(liveOf(st), after[Number(m[1])]) && swapsSaid(st.say) === k && st.mark.swap.length === k + 1, `buildSteps ${r.name}: state and swaps after percolateDown(${m[1]})`);
    });
    ok(calls === Math.floor(r.start.length / 2) && said === r.swaps, `buildSteps ${r.name}: one step per non-leaf call, ${said} swaps narrated`);
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
    ok(steps.every((s) => s.line === null || [].concat(s.line).every((l) => code[l] !== undefined && code[l] !== "")), `${gen.name} ${sc.name}: every highlighted line exists`);
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
// index arithmetic and height narration, for every i <= n <= 31 (the index widget shows the lecture's 9-item heap)
for (let n = 1; n <= 31; n++) {
  const say = Sim.heightSay(n);
  const h = Math.ceil(Math.log2(n + 1)) - 1;
  ok(say.startsWith(`n = ${n}: height ${h}.`), `heightSay(${n})`);
  for (const m of say.matchAll(/2\^(\d+) − 1 = (\d+)/g)) ok(2 ** Number(m[1]) - 1 === Number(m[2]), `heightSay(${n}): ${m[0]}`);
  const vals = n === 9 ? Sim.LECTURE_HEAP : Array.from({ length: n }, (_, k) => 100 + k);
  for (let i = 1; i <= n; i++) {
    const info = Sim.indexInfo(i, n);
    ok(info.parent === (i === 1 ? null : Math.floor(i / 2)) && info.left === (2 * i <= n ? 2 * i : null) && info.right === (2 * i + 1 <= n ? 2 * i + 1 : null) && info.leaf === (2 * i > n) && info.firstLeaf === Math.floor(n / 2) + 1, `indexInfo(${i}, ${n})`);
    const said = Sim.indexSay(i, vals);
    ok(said.length === (2 * i > n ? 2 : 3) && /is a leaf/.test(said.join(" ")) === (2 * i > n), `indexSay(${i}, ${n}) names a leaf exactly when 2i > n`);
    for (const t of said) {
      for (const m of t.matchAll(/\b(\d+)\/2 = (\d+)/g)) ok(Math.floor(Number(m[1]) / 2) === Number(m[2]), `indexSay(${i}, ${n}): ${m[0]}`);
      for (const m of t.matchAll(/\b(\d+)\*2 = (\d+)/g)) ok(Number(m[1]) * 2 === Number(m[2]), `indexSay(${i}, ${n}): ${m[0]}`);
      for (const m of t.matchAll(/\b(\d+)\*2\+1 = (\d+)/g)) ok(Number(m[1]) * 2 + 1 === Number(m[2]), `indexSay(${i}, ${n}): ${m[0]}`);
      for (const m of t.matchAll(/(\d+), which holds (-?\d+(?:\.\d+)?)/g)) ok(Number(m[1]) <= n && String(vals[Number(m[1]) - 1]) === m[2], `indexSay(${i}, ${n}): ${m[0]}`);
      for (const m of t.matchAll(/(\d+) is past n = (\d+)/g)) ok(Number(m[1]) > n && Number(m[2]) === n, `indexSay(${i}, ${n}): ${m[0]}`);
    }
  }
}
// real buildHeap runs never swap more than the sum of the subtree heights, which is below n
for (const r of H.filter((x) => x.t === "build")) { const n = r.start.length, cap = Math.ceil(Math.log2(n + 1)) - 1; let bound = 0; for (let i = 1; i <= n; i++) { let d = 0, j = i; while (2 * j <= n) { j *= 2; d++; } bound += d; } ok(r.swaps <= bound && bound <= n, `buildHeap ${r.name}: ${r.swaps} swaps <= sum of subtree heights ${bound} <= n (height ${cap})`); }
{ let S = 0; for (let i = 0; i <= 80; i++) S += i / 2 ** (i + 1); ok(Math.abs(S - 1) < 1e-12, `sum i/2^(i+1) -> 1 (${S})`); for (let N = 1; N <= 40; N++) { let s = 0; for (let i = 0; i <= N; i++) s += i / 2 ** (i + 1); ok(Math.abs(s - (1 - (N + 2) / 2 ** (N + 1))) < 1e-12, `partial sum to ${N}`); } }
// Section 2, "what a bound leaves open": knowing only f ∈ sup(g), a claim rel(h) is "always" true if every test
// function the supposition allows satisfies it, "never" if none does. The test functions run past the page's
// ladder (n³, 3ⁿ) because Ω leaves f unbounded above.
const TEST_FS = ["1", "log n", "n", "n log n", "n^2", "n^3", "2^n", "3^n"];
const rel3 = (f, h, rel) => { const r = G.relate(f, h); return rel === "O" ? r.o : rel === "Omega" ? r.omega : r.theta; };
const verdict = (sup, g, rel, h) => {
  const holds = TEST_FS.filter((f) => rel3(f, g, sup)).map((f) => rel3(f, h, rel));
  return holds.every(Boolean) ? "always" : holds.some(Boolean) ? "sometimes" : "never";
};
{
  const official = [["O", "n^2", "always"], ["O", "4n", "always"], ["O", "log n", "sometimes"], ["O", "n log n", "always"], ["O", "1", "sometimes"], ["Omega", "n", "sometimes"], ["Omega", "log n", "sometimes"], ["Omega", "n^2", "never"]];
  for (const [rel, h, v] of official) ok(verdict("O", "n", rel, h) === v, `worksheet question 0: f ∈ O(n) ⇒ ${rel}(${h}) is ${v} (brute force: ${verdict("O", "n", rel, h)})`);
}
// the c / n0 explorer's claims
for (const cl of Sim.CLAIMS) ok(cl.cs.includes(cl.c0) && cl.n00 >= 1 && cl.n00 <= cl.N, `explorer claim ${cl.id} starts on a listed c`);
{
  const lin10 = { f: ["10", "2"], g: ["0", "1"], rel: "O" };
  ok(G.smallestN0(lin10, "2").n0 === null && Number(G.smallestN0(lin10, "3").n0) === 10 && G.checkBound(lin10, "3", "10").holds && !G.checkBound(lin10, "3", "9").holds, "2n + 10 <= c n: c = 2 never, c = 3 exactly from n = 10");
  ok(G.checkBound({ f: ["10", "2"], g: ["0", "1"], rel: "Omega" }, "2", "1").holds, "2n + 10 >= 2n from n = 1");
}
ok(G.smallestN0({ f: ["0", "-50", "13"], g: ["0", "0", "1"], rel: "Omega" }, "13").n0 === null && Number(G.smallestN0({ f: ["0", "-50", "13"], g: ["0", "0", "1"], rel: "Omega" }, "25/2").n0) === 100, "Example 2: c = 13 never; c = 12.5 from 100");

/* ---------------------------------------------------------------- 2. answer keys in the HTML */
const html = readFileSync(`${here}../../../site/cse332/w02/index.html`, "utf8");
const attr = (tag, name) => { const m = new RegExp(`${name}='([^']*)'|${name}="([^"]*)"`).exec(tag); return m ? (m[1] ?? m[2]).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"') : null; };
const taskOf = (idx) => { const before = html.slice(0, idx); const m = [...before.matchAll(/<article class="task" data-id="([^"]+)"/g)]; return m.length ? m[m.length - 1][1] : null; };
const S = (n) => String(n);
const worst = (n) => J1("binaryWorst", (r) => r.n === n).worst;
const yn = (b) => (b ? "yes" : "no");
// an independent percolate (not sim.js) on a 1-based array h (h[0] unused), recording the live array after every swap
const upT = (h, i) => { const states = []; while (i > 1 && h[i] < h[i >> 1]) { [h[i], h[i >> 1]] = [h[i >> 1], h[i]]; i >>= 1; states.push(h.slice(1).join(",")); } return { at: i, states }; };
const downT = (h, i, size = h.length - 1) => { const states = []; while (i * 2 <= size) { let c = i * 2; if (c + 1 <= size && !(h[c] < h[c + 1])) c++; if (!(h[c] < h[i])) break; [h[c], h[i]] = [h[i], h[c]]; i = c; states.push(h.slice(1, size + 1).join(",")); } return { at: i, states }; };
const heightI = (n) => { let h = 0; while (2 ** (h + 1) - 1 < n) h++; return h; };

const TRUTH = {};
const BIGO_TRUTH = {};
const FORMULA_TRUTH = {};
/* Lecture 3 */
Object.assign(TRUTH, {
  "cse332-w2-l3-search-double-n": (() => { const d = new Set(); for (let n = 1; n <= 5000; n++) d.add(Sim.worstGaps(2 * n).length - Sim.worstGaps(n).length); return d.size === 1 ? S([...d][0]) : "varies"; })(),
  "cse332-w2-l3-search-64": S(Sim.binaryWorstExhaustive(64)),
  "cse332-w2-l3-gap-halving.worst-32": S(Sim.binaryWorstExhaustive(32)),
  "cse332-w2-l3-gap-halving.worst-1000": S(Sim.binaryWorstExhaustive(1000)),
  "cse332-w2-l3-log-base-same": yn(G.relate("log_8 n", "log n").theta),
  "cse332-w2-l3-crossover.cheaper-at-10": 10 * 10 < 100 * 10 ? "b" : "a",
  "cse332-w2-l3-crossover.a-from": S((() => { let n = 1; while (!(100 * n <= n * n)) n++; for (let m = n; m < 100000; m++) if (100 * m > m * m) return "varies"; return n; })()),
  "cse332-w2-l3-more-examples.in-o-n2": yn(G.relate("3n+5", "n^2").o),
  "cse332-w2-l3-more-examples.in-o-logn": yn(G.relate("3n+5", "log n").o),
  "cse332-w2-l3-more-examples.in-omega-1": yn(G.relate("3n+5", "1").omega),
  "cse332-w2-l3-more-examples.in-theta-n2": yn(G.relate("3n+5", "n^2").theta),
  "cse332-w2-l3-prove-4n8.smallest-n0-c5": S(G.smallestN0({ f: ["8", "4"], g: ["0", "1"], rel: "O" }, "5").n0),
  "cse332-w2-l3-prove-omega.c3-possible": yn(G.smallestN0({ f: ["-6", "3"], g: ["0", "1"], rel: "Omega" }, "3").n0 !== null),
  "cse332-w2-l3-true-statements.omega-means-best": "no",
  "cse332-w2-l3-true-statements.binary-best-theta1": J("search").filter((r) => r.found).reduce((m, r) => Math.min(m, r.binary), 99) === 1 ? "yes" : "no",
  "cse332-w2-l3-true-statements.binary-worst-o-n": yn(G.relate("log n", "n").o),
  "cse332-w2-l3-true-statements.binary-worst-omega-n": yn(G.relate("log n", "n").omega),
});
Object.assign(BIGO_TRUTH, {
  "cse332-w2-l3-intuition-buckets.seven-n": "7n + 2",
  "cse332-w2-l3-intuition-buckets.four-n2": "4n^2 + 100n + 9",
  "cse332-w2-l3-intuition-buckets.nlogn-plus-n": "n log n + 5n",
  "cse332-w2-l3-intuition-buckets.three-to-n": "3^n + n^10",
});
/* Lecture 4 */
const l4Text = () => html.slice(html.indexOf('id="l4-goals"'), html.indexOf('id="l4-problems"'));
{
  const ins4 = HJ("qc-l4-insert-4"), at4 = (ins4.start.length + 1) >> ins4.swaps;
  const ext6 = HJ("qc-l4-extract"), at6 = ext6.after.indexOf(6) + 1;
  const pIns = HJ("p-l4-insert-4"), pExt = HJ("p-l4-extract"), at8 = pExt.after.indexOf(8) + 1;
  const wrong = [null, 1, 3, 5, 7, 8, 9]; wrong[1] = wrong.pop(); { const big = wrong[2] > wrong[3] ? 2 : 3; [wrong[1], wrong[big]] = [wrong[big], wrong[1]]; }
  const trace = HJ("p-l4-trace").out, ex2 = HJ("l4-trace-example2").out;
  const pqRun = (ops) => { const w = [], out = []; for (const op of ops) { if (op < 0) { w.sort((a, b) => a - b); out.push(w.shift()); } else w.push(op); } return out; };
  const minNodes5 = (() => { let n = 1; while (heightI(n) < 5) n++; return n; })();
  Object.assign(TRUTH, {
    "cse332-w2-l4-pq-new-trace": S(pqRun([4, 2, 7, -1, 1, -1, -1])[2]),
    "cse332-w2-l4-shape-min-nodes-h5": S(minNodes5),
    "cse332-w2-l4-insert-parent-of-4": S(ins4.after[(at4 >> 1) - 1]),
    "cse332-w2-l4-extract-parent-of-6": S(ext6.after[(at6 >> 1) - 1]),
    "cse332-w2-l4-pq-trace.first": S(trace[0]), "cse332-w2-l4-pq-trace.second": S(trace[1]), "cse332-w2-l4-pq-trace.third": S(trace[2]), "cse332-w2-l4-pq-trace.fourth": S(trace[3]), "cse332-w2-l4-pq-trace.fifth": S(trace[4]),
    "cse332-w2-l4-height.h-10": S(heightI(10)), "cse332-w2-l4-height.h-15": S(heightI(15)), "cse332-w2-l4-height.h-16": S(heightI(16)),
    "cse332-w2-l4-insert-tree.swaps": S(pIns.swaps), "cse332-w2-l4-insert-tree.root-left": S(pIns.after[1]), "cse332-w2-l4-insert-tree.bottom-left": S(pIns.after[7]),
    "cse332-w2-l4-extract-tree.returned": S(pExt.min), "cse332-w2-l4-extract-tree.swaps": S(pExt.swaps), "cse332-w2-l4-extract-tree.new-root": S(pExt.after[0]), "cse332-w2-l4-extract-tree.parent-of-8": S(pExt.after[(at8 >> 1) - 1]),
    "cse332-w2-l4-larger-child.valid-after-wrong": yn(Sim.isMinHeap(wrong.slice(1))),
    "cse332-w2-l4-larger-child.correct-root": S(HJ("p-l4-larger-child").after[0]), "cse332-w2-l4-larger-child.correct-swaps": S(HJ("p-l4-larger-child").swaps),
  });
  ok(same(ex2, [3, 1, 5, 6, 8]) && same(HJ("l4-trace-example1").out, [1, 3, 5, 6, 8]), "the lecture's two PQ examples print 3,1,5,6,8 and 1,3,5,6,8");
  ok(same(pIns.after, [2, 4, 3, 5, 6, 4, 8, 9]) && same(pExt.after, [3, 5, 4, 9, 6, 8]) && same(HJ("p-l4-larger-child").after, [3, 7, 5, 9, 8]), "L4 problem solutions' level orders");
  // every heap drawn on the page as a starting state is a valid min-heap, except the ones asked about
  const drawn = [...html.matchAll(/<svg[^>]*>/g)].map((m) => m[0]).filter((t) => !/\bdata-step\b/.test(t)).map((t) => /data-tree="([^"]+)"/.exec(t)?.[1]).filter(Boolean);
  // solution pictures (data-step) are the states the real percolate passes through, in order
  {
    const task = (tid) => html.slice(html.indexOf(`data-id="${tid}"`), html.indexOf("</article>", html.indexOf(`data-id="${tid}"`)));
    const steps = (tid) => [...task(tid).matchAll(/<svg[^>]*\bdata-step\b[^>]*data-tree="([^"]+)"/g)].map((m) => m[1]);
    const statesOf = (gen) => { const seen = []; for (const st of gen) { const t = st.arr.slice(1, st.size + 1).join(","); if (seen.at(-1) !== t) seen.push(t); } return seen; };
    const ins = statesOf(Sim.insertIdeaSteps([2, 5, 3, 9, 6, 4, 8], 4)).slice(1);
    ok(same(steps("cse332-w2-l4-insert-tree"), ins), `insert 4 pictures: ${steps("cse332-w2-l4-insert-tree").join(" | ")} vs ${ins.join(" | ")}`);
    const ext = statesOf(Sim.extractIdeaSteps([2, 5, 3, 9, 6, 4, 8])).slice(1);
    ok(same(steps("cse332-w2-l4-extract-tree"), ext), `extract pictures: ${steps("cse332-w2-l4-extract-tree").join(" | ")} vs ${ext.join(" | ")}`);
    const lc = statesOf(Sim.extractIdeaSteps([1, 3, 5, 7, 8, 9])).slice(1);
    const wrong = "5,3,9,7,8";
    ok(same(steps("cse332-w2-l4-larger-child"), [lc[0], wrong, ...lc.slice(1)]) && !Sim.isMinHeap(wrong.split(",").map(Number)), `larger-child pictures: ${steps("cse332-w2-l4-larger-child").join(" | ")}`);
  }
  // not heaps on purpose: Lecture 4's gap example, Lecture 5's trees B and D, buildHeap's input, and the Θ(n) page's
  // picture, which labels each node with the levels below it rather than a priority
  const notHeaps = new Set(["1,2,3,_,5,6", "5,4,6", "5,7,6,8,_,9", "7,6,5,4,3,2,1", "3,2,2,1,1,1,1,0,0,0,0,0,0,0,0"]);
  for (const t of new Set(drawn)) if (!notHeaps.has(t)) ok(!t.includes("_") && Sim.isMinHeap(t.split(",").map(Number)), `drawn tree ${t} is a valid min-heap`);
  for (const t of notHeaps) ok(drawn.includes(t) && (t.includes("_") || !Sim.isMinHeap(t.split(",").map(Number))), `drawn tree ${t} is not a heap, as the page says`);
  Object.assign(BIGO_TRUTH, {
    "cse332-w2-l4-pq-costs.unsorted-extract": "n", "cse332-w2-l4-pq-costs.sorted-insert": "n + 1", "cse332-w2-l4-pq-costs.sorted-extract": "1", "cse332-w2-l4-pq-costs.heap-insert": "log n + 1",
    "cse332-w2-l4-cyu-sort-with-pq": "2 n log n",
  });
  {
    const out = pqRun([5, 6, 3, -1, 1, -1, -1, 8, -1, -1]);
    const script = /id="pqvis" data-script="([^"]+)"/.exec(html)[1];
    const ops = script.trim().split(/\s+/).flatMap((t) => (t === "-" ? [-1] : t.slice(1).split(",").map(Number)));
    ok(same(out, [3, 1, 5, 6, 8]) && same(pqRun(ops), out), `PQ worked example (${script}) prints ${pqRun(ops)}`);
    ok(same(pqRun([4, 2, 7, -1, 1, -1, -1]), [2, 1, 4]), "new trace prints 2, 1, 4 (a queue would print 4, 2, 7)");
    const heights = [3, 4, 7, 8, 1000000].map(heightI);
    ok(same(heights, [1, 2, 2, 3, 19]) && l4Text().includes("<td>1</td><td>2</td><td>2</td><td>3</td><td class=\"best\">19</td>"), `height table ${heights}`);
    const h7 = Sim.heapOf([2, 3, 4, 5, 6, 7, 8]); ok(heightI(7) === 2 && Sim.heapInsert(h7, 1).swaps === 3 && heightI(8) === 3, "insert into 7 items: at most 3 swaps");
    ok(Math.ceil(Math.log2(1000000)) === 20 && heightI(1000000) === 19, "a million items: about 20 steps");
  }
  // heap insert really is floor(log2 n) swaps in the worst case (a new minimum each time)
  ok([8, 64, 512, 4096].every((n) => { const h = Sim.heapOf([]); let w = 0; for (let v = n; v >= 1; v--) w = Math.max(w, Sim.heapInsert(h, v).swaps); return w === Math.floor(Math.log2(n)); }), "worst-case insert swaps = floor(log2 n)");
}
/* Section 2 */
// numUnique written again here, apart from sim.js: per-i inner-loop runs and the (i, j) of every inner iteration
const numUniqueRef = (vals) => {
  const n = vals.length, seen = Array(n).fill(false), runs = Array(n).fill(0), pairs = [];
  let out = 0;
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    out++;
    for (let j = i; j < n; j++) { runs[i]++; pairs.push([i, j]); if (vals[i] === vals[j]) seen[j] = true; }
  }
  return { out, runs, pairs, inner: pairs.length };
};
// the first n from which pred holds at every n checked after it
const fromN = (pred, top = 20000) => { let start = null; for (let n = 1; n <= top; n++) { if (!pred(n)) start = null; else if (start === null) start = n; } return start; };
const sliceOf = (marker, end) => { const a = html.indexOf(marker); return html.slice(a, html.indexOf(end, a)); };
const pageOf = (id) => sliceOf(`<section class="page" id="${id}"`, "</section>");
const taskHtml = (id) => sliceOf(`data-id="${id}"`, "</article>");
const O_ = (f, g) => ({ f, g, rel: "O" }), W_ = (f, g) => ({ f, g, rel: "Omega" });
const holdsFrom = (spec, c) => { const r = G.smallestN0(spec, c); return r.n0 === null ? null : Number(r.n0); };
{
  for (const r of H.filter((x) => x.t === "numUnique")) {
    const ref = numUniqueRef(r.values);
    ok(ref.out === r.out && ref.inner === r.inner && r.first === r.values.length, `numUnique ${r.values.join("")}: reference ${ref.out}/${ref.inner} vs Java ${r.out}/${r.inner}`);
    const steps = Sim.numUniqueSteps(r.values);
    ok(same(Sim.numUniqueDots(steps), ref.pairs), `stepper dots for ${r.values.join("")} are the real inner-loop (i, j)s`);
    steps.forEach((st, k) => ok(Sim.numUniqueDots(steps.slice(0, k + 1)).length === st.inner, `${r.values.join("")} step ${k}: dots drawn = running inner count ${st.inner}`));
    for (const st of steps) for (const m of st.say.matchAll(/(\d+) \(first loop\) \+ (\d+) \(inner loop\) = (\d+)/g)) ok(Number(m[1]) === r.first && Number(m[2]) === r.inner && Number(m[1]) + Number(m[2]) === Number(m[3]), `${r.values.join("")}: "${m[0]}"`);
  }
  const abab = numUniqueRef(["a", "b", "a", "b"]), aabbc = ["a", "a", "b", "b", "c"];
  ok(abab.inner === H.find((r) => r.t === "numUnique" && same(r.values, ["a", "b", "a", "b"])).inner, "abab inner count matches Java");
  ok(Sim.numUniqueSteps(aabbc).some((st) => st.i === 1 && st.line === 8 && /skip/.test(st.say)), "the stepper skips i = 1 on aabbc too");
  const c2a = G.div(G.Q(7n), G.Q(1n, 10n)); // 7n = c·(n/10)
  const lin = O_(["0", "7"], ["0", "1/10"]), linW = W_(["0", "7"], ["0", "1/10"]);
  ok(G.checkBound(lin, "70", "1").holds && G.checkBound(linW, "70", "1").holds && holdsFrom(lin, "69") === null && holdsFrom(linW, "71") === null, "7n ∈ Θ(n/10): c = 70 works both ways, and only 70 does");
  const v = (rel, h) => verdict("Omega", "n log n", rel, h);
  Object.assign(TRUTH, {
    "cse332-w2-s2-parts-c": S(5 + 2),
    "cse332-w2-s2-parts-n0": S(Math.max(fromN((n) => 3 * n * n <= 3 * n * n), fromN((n) => 9 <= n * n))),
    "cse332-w2-s2-squeeze-n0": S(Math.max(2, 5)),
    "cse332-w2-s2-theta-c1-omega": yn(holdsFrom(W_(["5", "0", "2"], ["0", "0", "4"]), "1") !== null),
    "cse332-w2-s2-numunique-abab": S(abab.inner),
    "cse332-w2-s2-numunique-skip": yn(numUniqueRef(aabbc).runs[1] > 0),
    "cse332-w2-s2-theta-2a-c": G.qToPlain(c2a),
    "cse332-w2-s2-q0-omega.o-n2": v("O", "n^2"), "cse332-w2-s2-q0-omega.omega-n": v("Omega", "n"), "cse332-w2-s2-q0-omega.o-n": v("O", "n"), "cse332-w2-s2-q0-omega.theta-nlogn": v("Theta", "n log n"),
  });
  ok(fromN((n) => 5 * n ** 3 <= 5 * n ** 3 && 2 * n <= 2 * n ** 3) === 1 && G.checkBound(O_(["0", "2", "0", "5"], ["0", "0", "0", "1"]), "7", "1").holds && !G.checkBound(O_(["0", "2", "0", "5"], ["0", "0", "0", "1"]), "6", "1").holds, "by parts: 5n³ ≤ 5n³ and 2n ≤ 2n³ from n = 1, so c = 7; 6 isn't enough at n = 1");
  ok(G.checkBound(O_(["9", "0", "3"], ["0", "0", "1"]), "4", "3").holds && !G.checkBound(O_(["9", "0", "3"], ["0", "0", "1"]), "4", "2").holds, "3n² + 9 ≤ 4n² exactly from n = 3");
  // numUnique formulas: worst n + n(n+1)/2, best 2n, against Java for n = 1..30
  const counts = (n, kind) => H.find((r) => r.t === "numUnique" && r.values.length === n && r.values.every((x) => (kind === "d" ? x.startsWith("v") : x === "s")));
  const at = (expr, n) => G.qToNumber(G.evalExact(expr, { n: G.Q(BigInt(n)) }));
  for (let n = 1; n <= 30; n++) { const d = counts(n, "d"), s = counts(n, "s"); ok(at("n + n(n+1)/2", n) === d.first + d.inner && at("2n", n) === s.first + s.inner, `numUnique n=${n} formulas`); }
  Object.assign(FORMULA_TRUTH, { "cse332-w2-s2-numunique-model.worst": "n + n(n+1)/2", "cse332-w2-s2-numunique-model.best": "2n" });
  Object.assign(BIGO_TRUTH, { "cse332-w2-s2-numunique-model.worst-theta": "n + n(n+1)/2", "cse332-w2-s2-numunique-model.best-theta": "2n" });
}
/* Lecture 5 */
{
  const LEC = [1, 3, 2, 4, 7, 5, 6, 5, 9];
  const text = html.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ");
  const fresh = () => [null, ...LEC];
  const lv = (h) => h.slice(1).join(",");
  const blockOf = (open, close) => { const at = html.indexOf(open); return html.slice(at, html.indexOf(close, at)); };
  const picsIn = (block) => [...block.matchAll(/<svg[^>]*\bdata-step\b[^>]*data-tree="([^"]+)"/g)].map((m) => m[1]);
  const pics5 = (tid) => picsIn(blockOf(`data-id="${tid}"`, "</article>"));
  const sameList = (got, want, what) => ok(same(got, want), `${what}: ${got.join(" | ")} vs ${want.join(" | ")}`);
  const dirOf = (h, i) => (upT(h.slice(), i).states.length ? "up" : downT(h.slice(), i).states.length ? "down" : "none");
  ok(same(Sim.LECTURE_HEAP, LEC) && Sim.isMinHeap(LEC), "the lecture's heap is the min-heap 1, 3, 2, 4, 7, 5, 6, 5, 9");

  // quick checks on the lesson pages
  const firstLeaf = (n) => { let i = 1; while (2 * i <= n) i++; return i; };
  Object.assign(TRUTH, {
    "cse332-w2-l5-array-parent-of-11": S(Math.floor(11 / 2)),
    "cse332-w2-l5-array-children-of-5": S([2 * 5, 2 * 5 + 1].filter((c) => c <= 10).length),
    "cse332-w2-l5-insert-code-first-parent-12": S(Math.floor((12 + 1) / 2)),
    "cse332-w2-l5-build-first-i": S(firstLeaf(12) - 1),
  });

  // problem 1: the lecture's four trees. Shape: no empty spot before the last node. Then order.
  const classify = (t) => {
    const v = t.split(",").map((x) => (x === "_" ? null : Number(x)));
    if (v.slice(0, v.findLastIndex((x) => x !== null)).includes(null)) return "shape";
    return v.every((x, k) => k === 0 || v[((k + 1) >> 1) - 1] <= x) ? "heap" : "order";
  };
  const four = [...blockOf('data-id="cse332-w2-l5-four-trees"', "</article>").matchAll(/<figcaption>([A-D])<\/figcaption><svg[^>]*data-tree="([^"]+)"/g)];
  sameList(four.map((m) => m[2]), ["3,4,5", "5,4,6", "3,4,10,5,6", "5,7,6,8,_,9"], "problem 1 draws the lecture's four trees");
  for (const m of four) TRUTH[`cse332-w2-l5-four-trees.${m[1].toLowerCase()}`] = classify(m[2]);

  // problem 2: index math with n = 12
  Object.assign(TRUTH, {
    "cse332-w2-l5-index-12.parent-9": S(Math.floor(9 / 2)), "cse332-w2-l5-index-12.right-4": S(2 * 4 + 1),
    "cse332-w2-l5-index-12.first-leaf": S(firstLeaf(12)), "cse332-w2-l5-index-12.right-of-6": yn(2 * 6 + 1 <= 12),
  });

  // problem 3: the lecture's example, with a picture after every swap
  {
    const h = [null], want = [];
    const ins = (x) => { h.push(x); return upT(h, h.length - 1); };
    const quiet = (xs) => xs.every((x) => ins(x).states.length === 0);
    ok(quiet([16, 32]), "16 and 32 go in with no swaps"); want.push(lv(h));
    want.push(...ins(4).states);
    ok(quiet([57, 80, 43]), "57, 80, 43 go in with no swaps"); want.push(lv(h));
    const r2 = ins(2); want.push(...r2.states);
    const inserted = h.slice();
    const min = h[1]; h[1] = h.pop(); want.push(lv(h));
    want.push(...downT(h, 1).states);
    sameList(pics5("cse332-w2-l5-lecture-sequence"), want, "problem 3 pictures");
    const seq = HJ("p-l5-sequence");
    ok(same(seq.after, h.slice(1)) && same(seq.out, [min]), "Java agrees on the lecture's example");
    ok(lv(inserted) === "2,32,4,57,80,43,16" && lv(h) === "4,32,16,57,80,43", "the lecture's answers: 2,32,4,57,80,43,16, then 4,32,16,57,80,43 after the extract");
    Object.assign(TRUTH, {
      "cse332-w2-l5-lecture-sequence.swaps-2": S(r2.states.length), "cse332-w2-l5-lecture-sequence.arr3-inserts": S(inserted[3]), "cse332-w2-l5-lecture-sequence.arr7-inserts": S(inserted[7]),
      "cse332-w2-l5-lecture-sequence.root-extract": S(h[1]), "cse332-w2-l5-lecture-sequence.arr3-extract": S(h[3]),
    });
    for (const arr of [inserted.slice(1), h.slice(1)]) ok(text.includes(arr.join(", ")), `problem 3's answer states ${arr.join(", ")}`);
  }

  // problem 4 and the lesson's example: change a key, picture after the change and after each swap
  {
    const a = fresh(); a[5] = 0; const wantA = [lv(a)], dirA = dirOf(a, 5); const ra = upT(a, 5); wantA.push(...ra.states);
    const b = fresh(); b[3] = 8; const wantB = [lv(b)], dirB = dirOf(b, 3); const rb = downT(b, 3); wantB.push(...rb.states);
    sameList(pics5("cse332-w2-l5-change-key"), [...wantA, ...wantB], "problem 4 pictures");
    ok(Sim.isMinHeap(a.slice(1)) && Sim.isMinHeap(b.slice(1)), "both changed keys end in a min-heap");
    Object.assign(TRUTH, { "cse332-w2-l5-change-key.dir-a": dirA, "cse332-w2-l5-change-key.at-a": S(ra.at), "cse332-w2-l5-change-key.dir-b": dirB, "cse332-w2-l5-change-key.at-b": S(rb.at) });
    const u = fresh(); u[2] = 10; const wantU = [lv(u)], dirU = dirOf(u, 2); const ru = downT(u, 2); wantU.push(...ru.states);
    sameList(picsIn(blockOf('id="l5-update"', "</section>")), wantU, "changing-a-priority example pictures");
    ok(dirU === "down" && ru.at === 8 && 2 * ru.at > 9 && text.includes("Index 8 has no children: stop."), "the 10 sinks to index 8, a leaf");
  }

  // problem 5: buildHeap on 7..1, a picture after every swap
  {
    const h = [null, 7, 6, 5, 4, 3, 2, 1], want = [], per = {};
    for (let i = 7; i >= 1; i--) { const r = downT(h, i); per[i] = r.states.length; want.push(...r.states); }
    sameList(pics5("cse332-w2-l5-build7"), want, "problem 5 pictures");
    const java = HJ("p-l5-build7");
    ok(same(java.after, h.slice(1)) && java.swaps === want.length && java.heap, "Java agrees on buildHeap of 7..1");
    Object.assign(TRUTH, {
      "cse332-w2-l5-build7.first-i": S(Math.max(...Object.keys(per).map(Number).filter((i) => per[i] > 0))),
      "cse332-w2-l5-build7.swaps-1": S(per[1]), "cse332-w2-l5-build7.total": S(want.length), "cse332-w2-l5-build7.at-7": S(h.indexOf(7)),
    });
    const one = [null]; let byInsert = 0; for (const x of [7, 6, 5, 4, 3, 2, 1]) { one.push(x); byInsert += upT(one, one.length - 1).states.length; }
    ok(byInsert === HJ("p-l5-build7-insert").swaps && text.includes(`Inserting the same values one at a time makes ${byInsert} swaps.`), `inserting 7..1 one at a time: ${byInsert} swaps`);
  }

  // problem 6 and the Θ(n) page: the most swaps a node can make is the number of levels below it
  const below = (i, n) => { let d = 0; while (2 * i <= n) { i *= 2; d++; } return d; };
  const sinks = (n) => Array.from({ length: n }, (_, k) => below(k + 1, n));
  const total = (n) => sinks(n).reduce((s, d) => s + d, 0);
  {
    const s = sinks(31);
    Object.assign(TRUTH, { "cse332-w2-l5-sink-31.sink-1": S(s.filter((d) => d === 1).length), "cse332-w2-l5-sink-31.root": S(s[0]), "cse332-w2-l5-sink-31.total": S(total(31)) });
    ok(total(31) < 31 && text.includes(`31 calls × ${s[0]} swaps" would say ${31 * s[0]}`), "31 nodes: 26 at most, and 31 × 4 = 124");
    for (let d = 0; d <= 4; d++) { const k = s.filter((x) => x === d).length; ok(text.includes(`\\(${k} \\cdot ${d} = ${k * d}\\)`), `problem 6 board: ${k} nodes × ${d}`); }
    const s15 = sinks(15);
    ok(html.includes(`data-tree="${s15.join(",")}"`), "the 15-node picture shows the levels below each node");
    const rows = [["leaves", 0], ["nodes", 1], ["nodes", 2], ["root", 3]].map(([name, d]) => { const k = s15.filter((x) => x === d).length; return `<tr><th>${k} ${name} × ${d}</th><td>${k * d}</td></tr>`; });
    ok(rows.every((r) => html.includes(r)) && html.includes(`<tr><th>Total</th><td class="best">${total(15)}</td></tr>`), "the 15-node table");
    ok(text.includes(`At most ${total(15)} swaps for 15 nodes. "15 calls × 3 swaps" would say ${15 * 3}`), "15 nodes: 11 swaps vs 45");
    const sizes = Array.from({ length: 5000 }, (_, k) => k + 1);
    ok(sizes.every((n) => total(n) < n) && text.includes("All the items together can sink fewer than \\(n\\) levels."), "the rule: the total sinking distance is under n for every n up to 5,000");
  }
  ok(same(HJ("lecture-build").after, [1, 2, 7, 3, 6, 8, 10, 14, 5, 15]), "the lecture's buildHeap result 1,2,7,3,6,8,10,14,5,15");
  Object.assign(BIGO_TRUTH, { "cse332-w2-l5-trace-n-inserts": "n log n + n", "cse332-w2-l5-sink-31.bucket": "2n" });
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
      else if (grader === "bigo") r = G.checkBigO(k, answer);
      ok(r && r.ok === false, `${id}: misconception key "${k}" must be wrong`);
    }
  }
}
for (const id of [...Object.keys(TRUTH), ...Object.keys(BIGO_TRUTH), ...Object.keys(FORMULA_TRUTH)]) ok(seen.has(id), `truth registered for an id that isn't on the page: ${id}`);
ok(keys >= 90, `found ${keys} auto-graded keys`);
// every misconception tag has a message
{
  const W = {}; const ctx = { window: W }; (new Function("window", readFileSync(`${here}../../../site/cse332/w02/week.js`, "utf8").split('"use strict";')[0]))(W);
  const tags = new Set([...html.matchAll(/data-miscon='([^']+)'/g)].flatMap((m) => Object.values(JSON.parse(m[1]))));
  for (const t of tags) ok(W.WEEK.messages[t], `misconception tag "${t}" has a message`);
}

// c/n0 problems: the solution's pairs hold, near misses fail (decision procedure vs brute force over a window)
const BOUND_SOLUTIONS = [
  ["cse332-w2-l3-prove-4n8", "c", [["5", "8"], ["12", "1"], ["6", "4"]], [["5", "7"], ["4", "1000"]]],
  ["cse332-w2-l3-prove-omega", "c", [["2", "6"], ["1", "3"]], [["2", "5"], ["3", "1000"]]],
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
{
  const rows = [16, 1024, 1000000].map((n) => [n, Sim.binaryWorstExhaustive(n), Sim.worstGaps(n).length]);
  ok(rows.every((r) => r[1] === r[2]) && html.includes(rows.map((r) => `<td class="best">${r[1]}</td>`).join("")), `binary search worst cases ${rows.map((r) => r[1]).join(", ")}`);
  ok(Sim.worstGaps(16).join() === "16,8,4,2,1" && text.includes("\\(16 \\to 8 \\to 4 \\to 2 \\to 1\\)"), "16 halves to 1 in 4 steps, 5 loops");
}
ok(Math.abs(Math.log2(5) - 2.32) < 0.005, "log2 5 ≈ 2.32");
{
  const ns = [1, 5, 10, 20, 100];
  const cells = html.replace(/<td class="best">/g, "<td>");
  for (const [name, F] of [["10n", (n) => 10 * n], ["n^2", (n) => n * n]]) ok(cells.includes(ns.map((n) => `<td>${F(n).toLocaleString("en-US")}</td>`).join("")), `table row ${name} at n = ${ns}`);
  const bestA = ns.filter((n) => 10 * n < n * n).map((n) => `<td class="best">${(10 * n).toLocaleString("en-US")}</td>`).join("");
  const bestB = ns.filter((n) => n * n < 10 * n).map((n) => `<td class="best">${n * n}</td>`).join("");
  ok(html.includes(bestA) && html.includes(bestB), "cheaper cell highlighted, ties left plain");
  let cross = true; for (let n = 1; n < 10000; n++) if ((10 * n <= n * n) !== (n >= 10)) cross = false;
  ok(cross && text.includes("From \\(n = 10\\) on, A is never slower"), "10n <= n^2 exactly from n = 10");
}
for (const [f, g] of [["3n + 5", "n"], ["n^2 + 100n", "n^2"], ["4 log n + 7", "log n"], ["2^n + n^3", "2^n"]]) ok(G.relate(f, g).theta, `bucket of ${f} is ${g}`);
{
  const say = { "O(n^2)": "o", "O(n)": "o", "O(\\log n)": "o", "\\Omega(n)": "omega", "\\Omega(n^2)": "omega", "\\Theta(n)": "theta" };
  const board = html.slice(html.indexOf("Which claims about \\(f(n) = 2n + 10\\) are true?"));
  for (const [claim, key] of Object.entries(say)) {
    const g = claim.replace(/^\\?\w+\((.*)\)$/, "$1").replace(/\\/g, "");
    const truth = G.relate("2n + 10", g)[key];
    const m = new RegExp(`<span class="lab">\\\\\\(${claim.replace(/[\\()^]/g, "\\$&")}\\\\\\)</span><span class="mth">(.)</span>`).exec(board);
    ok(m && (m[1] === "✓") === truth, `2n + 10 ∈ ${claim}: page says ${m && m[1]}, truth ${truth}`);
  }
}
{
  let o6 = true; for (let n = 1n; n < 1000n; n++) { if (5n * n * n + 30n * n <= 5n * n * n) o6 = false; if ((5n * n * n + 30n * n <= 6n * n * n) !== (n >= 30n)) o6 = false; }
  ok(o6, "5n^2 + 30n: c = 5 always fails, c = 6 holds exactly from n = 30");
  ok([10n, 11n, 12n].every((n) => 2n * n + 10n <= 3n * n && text.includes(`\\(${2n * n + 10n} \\le ${3n * n}\\)`)), "plugged-in values in the proofs check");
}
ok(Math.abs(Number(58n ** 10n) / 1e17 - 4.31) < 0.01 && Math.abs(2 ** 58 / 1e17 - 2.88) < 0.01 && Math.abs(Number(59n ** 10n) / 1e17 - 5.11) < 0.01 && Math.abs(2 ** 59 / 1e17 - 5.76) < 0.01, "k = 58, 59 values in problem 9");
ok(Math.abs(Number(43n ** 8n) / 1e13 - 1.17) < 0.01 && Math.abs(2 ** 43 / 1e12 - 8.80) < 0.01 && Math.abs(Number(44n ** 8n) / 1e13 - 1.40) < 0.01 && Math.abs(2 ** 44 / 1e13 - 1.76) < 0.01, "n = 43, 44 values in problem 8");
ok(heightI(9) === 3, "the lecture's 9-node heap has height 3");
/* Section 2: tables, pictures, multiple-choice keys and the numbers its proofs state */
{
  const s2 = ["s2-goals", "s2-sometimes", "s2-parts", "s2-squeeze", "s2-theta", "s2-numunique", "s2-problems"].map(pageOf).join("");
  const s2text = s2.replace(/\s+/g, " ");
  const says = (s, why) => ok(s2text.includes(s), `Section 2 states "${s}" (${why})`);
  // always / sometimes / never tables: ✓ and ✗ from the class engine, the verdict from the brute force over test functions
  const tex2g = (t) => t.replace(/\\log\s*/g, " log ").replace(/\s+/g, " ").trim();
  const WORD = { always: "always", sometimes: "sometimes", never: "never" };
  const verdictTable = (where, src, sup, g, ends) => {
    const rows = [...src.matchAll(/<tr><th>\\\((?:f \\in )?(O|\\Omega|\\Theta)\(([^)]*)\)\\\)<\/th><td class="(yes|no)">[✓✗]<\/td><td class="(yes|no)">[✓✗]<\/td><td class="said">(always|sometimes|never)<span class="reason">([\s\S]*?)<\/span><\/td><\/tr>/g)];
    ok(rows.length === 4, `${where}: 4 verdict rows, each with a reason (found ${rows.length})`);
    for (const [, relTex, hTex, a, b, word, reason] of rows) {
      const rel = relTex.replace("\\", ""), h = tex2g(hTex);
      ok(rel3(ends[0], h, rel) === (a === "yes") && rel3(ends[1], h, rel) === (b === "yes"), `${where}: ${rel}(${h}) marks at f = ${ends.join(", ")}`);
      ok(WORD[word] === verdict(sup, g, rel, h), `${where}: ${rel}(${h}) is "${word}"; brute force says ${verdict(sup, g, rel, h)}`);
      // "sometimes" names one allowed f that passes and one that fails; "always" and "never" give a reason, not examples
      const pf = /^\\\(([^)]+?)\\\) passes, \\\(([^)]+?)\\\) fails$/.exec(reason);
      if (word === "sometimes") ok(pf && rel3(tex2g(pf[1]), g, sup) && rel3(tex2g(pf[2]), g, sup) && rel3(tex2g(pf[1]), h, rel) && !rel3(tex2g(pf[2]), h, rel), `${where}: ${rel}(${h}) "${reason}" names a passing and a failing allowed f`);
      else ok(!pf && /\\(le|ge)|outgrows/.test(reason), `${where}: ${rel}(${h}) "${word}" gives a reason: ${reason}`);
    }
  };
  verdictTable("s2-sometimes worked example", pageOf("s2-sometimes"), "O", "n", ["1", "n"]);
  verdictTable("practice 1 solution", taskHtml("cse332-w2-s2-q0-omega"), "Omega", "n log n", ["n log n", "2^n"]);
  ok(TEST_FS.filter((f) => rel3(f, "n", "O")).join() === "1,log n,n" && /<li class="band end"><b>1<\/b>[\s\S]*<li class="band"><b>log n<\/b>[\s\S]*<li class="band end"><b>n<\/b>[\s\S]*<li><b>n log n<\/b>/.test(pageOf("s2-sometimes")), "the ladder shades the listed buckets in O(n), slowest and fastest circled");
  ok(fromN((n) => Math.sqrt(n) <= n) === 1 && fromN((n) => Math.log2(n) <= Math.sqrt(n)) === 16, "√n sits between log n (from n = 16) and n, inside O(n)");
  says("Growth rates in between, like \\(\\sqrt n\\), are possible too.", "the shaded buckets are only examples");
  ok(!rel3("1", "log n", "Theta") && !rel3("n", "log n", "Theta") && rel3("log n", "log n", "Theta") && verdict("O", "n", "Theta", "log n") === "sometimes", "f ∈ O(n), f ∈ Θ(log n)?: 1 and n fail, log n passes, so sometimes");
  says("\\(f = 1\\) fails and \\(f = n\\) fails. But \\(f = \\log n\\) is allowed, and it passes.", "why examples can't prove never");
  ok(!/Both pass: always true|Why two tests are enough/.test(s2), "the old two-ends rule is gone");
  ok(fromN((n) => n * Math.log2(n) >= n) === 2, "n log n ≥ n exactly from n = 2 (practice 1's always reason)");
  says("once \\(n \\ge 2\\), \\(\\log n \\ge 1\\)", "practice 1's always reason");

  // multiple-choice quick checks: the marked option is the computed truth
  const mcRight = (id) => { const blk = sliceOf(`data-id="${id}"`, '<div class="row">'); const m = /<label data-correct>([\s\S]*?)<span class="why"/.exec(blk); return m ? m[1].replace(/<[^>]+>/g, "").trim() : null; };
  const ASN = { always: "Always true", sometimes: "Sometimes true", never: "Always false" };
  let twoLinear = true;
  for (let n = 2; n <= 40; n++) for (let s = 0; s < 20; s++) {
    const vals = Array.from({ length: n }, (_, i) => ((i * 7 + s * 13 + i * i * s) % 3 === 0 ? "x" : "y"));
    if (new Set(vals).size !== 2) continue;
    const t = n + numUniqueRef(vals).inner;
    if (t < n || t > 3 * n) twoLinear = false;
  }
  let negBigger = true; for (let n = 1; n <= 1000; n++) if (!(4 * n * n - 8 * n < 4 * n * n)) negBigger = false;
  const MC = {
    "cse332-w2-s2-sometimes-o4n": ASN[verdict("O", "n", "O", "4n")],
    "cse332-w2-s2-sometimes-theta-logn": ASN[verdict("Theta", "n", "O", "log n")],
    "cse332-w2-s2-theta-drop-negative": negBigger ? "No: dropping \\(-8n\\) makes \\(f\\) bigger" : "?",
    "cse332-w2-s2-numunique-two-values": twoLinear ? "\\(\\Theta(n)\\)" : "?",
  };
  const mcIds = [...s2.matchAll(/class="check" data-id="([^"]+)" data-grader="mc"/g)].map((m) => m[1]);
  ok(same(mcIds.sort(), Object.keys(MC).sort()), `every Section 2 multiple-choice check has a computed truth (${mcIds.join(", ")})`);
  for (const [id, want] of Object.entries(MC)) ok(mcRight(id)?.startsWith(want), `${id}: marked "${mcRight(id)}", truth "${want}"`);
  ok(holdsFrom(W_(["0", "-8", "4"], ["0", "0", "1"]), "3") === 8 && fromN((n) => 8 * n <= n * n) === 8, "drop-negative fix: 8n ≤ n² and 4n² − 8n ≥ 3n² exactly from n = 8");
  says("for n ≥ 8, 8n ≤ n², so 4n² − 8n ≥ 3n². That's c = 3, n₀ = 8.", "drop-negative fix");

  // Proof by parts: 4n² + 3n + 5 ≤ 12n² from n = 1, term by term
  ok(fromN((n) => 4 * n * n <= 4 * n * n && 3 * n <= 3 * n * n && 5 <= 5 * n * n) === 1 && 4 + 3 + 5 === 12 && G.checkBound(O_(["5", "3", "4"], ["0", "0", "1"]), "12", "1").holds, "by parts: each term from n = 1, c = 12");
  says("\\(c = 4 + 3 + 5 = 12\\); every step holds from \\(n = 1\\), so \\(n_0 = 1\\)", "by-parts sum");
  says("\\(9 \\le n^2\\) (true for \\(n \\ge 3\\))", "parts-n0 premise");
  ok(fromN((n) => 9 <= n * n) === 3, "9 ≤ n² exactly from n = 3");

  // The squeeze: n² + 4 ≤ 2n² from n = 2, 2n² ≤ 2n³ from n = 1, and the table of values
  ok(fromN((n) => n * n + 4 <= 2 * n * n) === 2 && fromN((n) => 2 * n * n <= 2 * n ** 3) === 1 && G.checkBound(O_(["4", "0", "1"], ["0", "0", "0", "1"]), "2", "2").holds && !G.checkBound(O_(["4", "0", "1"], ["0", "0", "0", "1"]), "2", "1").holds, "squeeze example: f ≤ f' from n = 2, f' ≤ 2n³ from n = 1, so (c, n₀) = (2, 2) and n₀ = 1 fails");
  {
    const tr = (label, F) => `<tr><th>${label}</th>${[1, 2, 3, 4].map((n) => `<td${n === 1 && label.startsWith("\\(f =") ? ' class="no"' : ""}>${F(n)}</td>`).join("")}</tr>`;
    const rows = [tr("\\(f = n^2 + 4\\)", (n) => n * n + 4), tr("\\(f' = 2n^2\\)", (n) => 2 * n * n), tr("\\(c\\cdot g = 2n^3\\)", (n) => 2 * n ** 3)];
    ok(rows.every((r) => pageOf("s2-squeeze").includes(r)), "squeeze table values");
    ok([2, 3, 4].every((n) => n * n + 4 <= 2 * n * n && 2 * n * n <= 2 * n ** 3) && 1 + 4 > 2 * 1, "squeeze table: rows ordered from n = 2, f on top at n = 1");
  }
  says("same as \\(4 \\le n^2\\): true from \\(n = 2\\)", "squeeze n₀");
  ok(fromN((n) => n <= n * Math.log2(n)) === 2 && 1 * Math.log2(1) === 0, "n ≤ n log n from n = 2; log 1 = 0 (practice problem 3)");
  says("your first comparison, \\(f \\le f'\\), holds for \\(n \\ge 2\\). Your second, \\(f' \\le c\\cdot g\\), holds for \\(n \\ge 5\\).", "squeeze quick check's two starts");
  ok(!/n \\le n\\log_2 n/.test(pageOf("s2-squeeze")), "the squeeze quick check doesn't ask practice problem 3's key step");

  // Θ proofs: 2n² + 5 ∈ Θ(4n²) with (1, 3) and (1/2, 1), and no single c works for both parts
  const t2 = O_(["5", "0", "2"], ["0", "0", "4"]), t2w = W_(["5", "0", "2"], ["0", "0", "4"]);
  ok(fromN((n) => 5 <= n * n) === 3 && 3 ** 2 === 9 && G.checkBound(t2, "1", "3").holds && G.checkBound(t2w, "1/2", "1").holds, "Θ example: 5 ≤ n² from n = 3; (1, 3) and (½, 1) hold");
  ok(Array.from({ length: 400 }, (_, k) => `${k + 1}/40`).every((c) => holdsFrom(t2, c) === null || holdsFrom(t2w, c) === null), "Θ example: no single c works for both parts (they have to differ)");
  says("true from \\(n = 3\\), since \\(3^2 = 9\\)", "Θ example n₀");

  // numUnique's worked example, from the reference implementation (and Java ran the same two arrays)
  {
    const row = (name, vals) => { const r = numUniqueRef(vals); return `<li><span class="lab">${name}</span><span class="mth">\\(${r.runs.join("+")} = ${r.inner}\\)</span><span class="note">${r.runs.filter(Boolean).length === 1 ? "only \\(i = 0\\) runs it" : `inner loop for \\(i = 0\\) to \\(${vals.length - 1}\\)`}; plus the first loop's ${vals.length} makes ${vals.length + r.inner}</span></li>`; };
    ok(pageOf("s2-numunique").includes(row("all different", ["a", "b", "c", "d", "e"])) && pageOf("s2-numunique").includes(row("all the same", ["a", "a", "a", "a", "a"])), "numUnique worked-example lines");
    ok(["abcde", "aaaaa"].every((v) => H.some((r) => r.t === "numUnique" && r.values.join("") === v)) && s2.includes('data-nu="distinct" aria-pressed="false">all different: a b c d e') && s2.includes('data-nu="same" aria-pressed="false">all the same: a a a a a'), "the stepper's two arrays are the table's, and Java ran both");
  }

  // practice solutions: the pairs each written proof states
  {
    const big = (n) => BigInt(n);
    let d1 = true, d13 = true;
    for (let n = 1n; n <= 3000n; n++) { if (!(7n * n * n <= 7n * n ** 4n && 3n * n <= 3n * n ** 4n && 7n * n * n + 3n * n <= 10n * n ** 4n)) d1 = false; if (n >= 3n && 7n * n * n + 3n * n > n ** 4n) d13 = false; }
    ok(d1 && d13 && 7n * big(2) ** 2n + 3n * big(2) > big(2) ** 4n, "1d: (10, 1) by parts and (1, 3) hold; (1, 2) fails at n = 2");
    let e = true; for (let n = 2; n <= 100000; n++) if (n + 2 * n * Math.log2(n) > 3 * n * Math.log2(n) + 1e-9) e = false;
    ok(e && 1 + 2 * Math.log2(1) > 3 * Math.log2(1), "1e: n + 2n log n ≤ 3n log n from n = 2; fails at n = 1 (1 vs 0)");
    ok(fromN((n) => 10 <= n * n) === 4 && G.checkBound(O_(["0", "10", "0", "1"], ["0", "0", "0", "3"]), "1", "4").holds && G.checkBound(W_(["0", "10", "0", "1"], ["0", "0", "0", "3"]), "1/3", "1").holds, "2b: 10 ≤ n² from n = 4; (1, 4) and (⅓, 1) hold");
    const t = (id) => taskHtml(id).replace(/\s+/g, " ");
    ok(t("cse332-w2-s2-parts-1d").includes("Let \\(c = 10\\) and \\(n_0 = 1\\)") && t("cse332-w2-s2-parts-1d").includes("\\(c = 1\\), \\(n_0 = 3\\)"), "1d solution states (10, 1) and (1, 3)");
    ok(t("cse332-w2-s2-squeeze-1e").includes("Let \\(c = 3\\) and \\(n_0 = 2\\)"), "1e solution states (3, 2)");
    ok(t("cse332-w2-s2-write-theta-2b").includes("Let \\(c = 1\\) and \\(n_0 = 4\\)") && t("cse332-w2-s2-write-theta-2b").includes("Let \\(c = \\tfrac13\\) and \\(n_0 = 1\\)"), "2b solution states (1, 4) and (⅓, 1)");
  }
  const templates = [...s2.matchAll(/data-template="([^"]+)"/g)].map((m) => m[1]);
  ok(templates.length === 3 && templates.every((t) => t.includes("Let c = __ and n₀ = __")), "the three proof boxes start with the c and n₀ blanks");
}
ok(!/\bslides?\b/i.test(text.replace(/files\/slides\//g, "")), "no student-facing text mentions slides");
ok(!/details class="notes"/.test(html), "no instructor teaching notes");

console.log(`verify-answers: ${pass} passed, ${fail} failed (${keys} auto-graded answer keys, ${lines.length} Java result lines for Lecture 3, ${H.length} for heaps and numUnique)`);
process.exit(fail ? 1 : 0);
