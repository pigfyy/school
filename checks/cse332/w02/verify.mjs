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
const lad = (s) => Sim.LADDER.indexOf(s);

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
    const rows = [["leaves", 0], ["one up", 1], ["two up", 2], ["root", 3]].map(([name, d]) => { const k = s15.filter((x) => x === d).length; return `<tr><th>${name}</th><td>${k}</td><td>${d}</td><td>${k * d}</td></tr>`; });
    ok(rows.every((r) => html.includes(r)) && html.includes(`<tr><th>total</th><td>15</td><td></td><td class="best">${total(15)}</td></tr>`), "the 15-node table");
    ok(text.includes(`At most ${total(15)} swaps for 15 nodes. "15 calls × 3 swaps" would say ${15 * 3}`), "15 nodes: 11 swaps vs 45");
    const big = [3, 9, 19].map((Hh) => { const n = 2 ** (Hh + 1) - 1; return { n, t: total(n), nh: n * Hh }; });
    const c = (x) => x.toLocaleString("en-US");
    ok(html.includes(big.map((b) => `<th>${c(b.n)}</th>`).join("")) && html.includes(big.map((b) => `<td class="best">${c(b.t)}</td>`).join("")) && html.includes(big.map((b) => `<td>${c(b.nh)}</td>`).join("")) && big.every((b) => b.t < b.n), `bigger full trees: ${big.map((b) => `${b.n}: ${b.t} < n, n·H = ${b.nh}`).join("; ")}`);
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
ok(keys >= 100, `found ${keys} auto-graded keys`);
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
ok(!/\bslides?\b/i.test(text.replace(/files\/slides\//g, "")), "no student-facing text mentions slides");
ok(!/details class="notes"/.test(html), "no instructor teaching notes");

console.log(`verify-answers: ${pass} passed, ${fail} failed (${keys} auto-graded answer keys, ${lines.length} Java result lines for Lecture 3, ${H.length} for heaps and numUnique)`);
process.exit(fail ? 1 : 0);
