// Ground truth for CSE 331 week 3 (site/cse331/w03/). Compiles the lectures' Java and runs it for real.
//   1. Lecture 6's Calculator.java (the 238-line listing from the notes) and the notes' copies of main with one
//      check taken out, built here from Calculator.java by the line edits in calc-sim.js. The two copies that do
//      not compile must fail with the notes' error. Curated sessions run as separate processes; random sessions
//      run through CalcHarness (one JVM). stdout and status must match site/cse331/w03/calc-sim.js exactly;
//      stderr must match on the exception line and the Calculator frames (this JDK numbers java.base lines
//      differently from the notes' JDK 25).
//   2. The notes' printed runs, against the simulator.
//   3. Every answer key on the page that is computed (section 2, lectures 7 and 8) against W03.java, which holds
//      the lectures' methods as printed, and against brute-force enumeration of small state spaces.
// Usage: node checks/cse331/w03/verify.mjs   (java 17+; uses javac, else `java -m jdk.compiler`)
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const C = req("../../../site/cse331/w03/calc-sim.js");
const html = (() => { try { return readFileSync(join(here, "../../../site/cse331/w03/index.html"), "utf8"); } catch { return ""; } })();

let checks = 0, fails = 0;
const counts = {};
const ok = (group, cond, msg) => { checks++; counts[group] = (counts[group] || 0) + 1; if (!cond) { fails++; if (fails <= 40) console.log(`MISMATCH [${group}]:`, msg); } };

/* ---------------------------------------------------------------- compile */
const work = mkdtempSync(join(tmpdir(), "cse331-w3-"));
const hasJavac = spawnSync("javac", ["-version"]).status === 0;
function javac(dir, files) {
  const [cmd, args] = hasJavac ? ["javac", ["-d", dir, ...files]] : ["java", ["-m", "jdk.compiler/com.sun.tools.javac.Main", "-d", dir, ...files]];
  return spawnSync(cmd, args, { encoding: "utf8", cwd: dir });
}
const calcSrc = readFileSync(join(here, "java", "Calculator.java"), "utf8").split("\n");
ok("listing", calcSrc[36] === "public class Calculator {" && calcSrc[112] === "class CalcStack {" && calcSrc[181] === "        int b = pop(); int a = pop();" && calcSrc[221] === "class StackException extends Exception {", "Calculator.java is the notes' 238-line listing");
const CP = {};
for (const [name, V] of Object.entries(C.VARIANTS)) {
  const dir = join(work, name);
  mkdirSync(dir);
  const lines = calcSrc.map((l, i) => (V.blank.includes(i + 1) ? "" : V.replace[i + 1] ?? l));
  writeFileSync(join(dir, "Calculator.java"), lines.join("\n"));
  const r = javac(dir, ["Calculator.java", join(here, "java", "CalcHarness.java")]);
  if (V.compileError) {
    const want = V.compileError.split("\n")[0];
    ok("compile", r.status !== 0 && r.stderr.includes(want), `${name} should fail to compile with "${want}"; got status ${r.status}: ${r.stderr.split("\n")[0]}`);
  } else {
    ok("compile", r.status === 0, `${name} should compile: ${r.stderr}`);
    CP[name] = dir;
  }
}
const jver = spawnSync("java", ["-version"], { encoding: "utf8" }).stderr.split("\n")[0];
console.log(`compiled ${Object.keys(C.VARIANTS).length} copies of Calculator.java with ${hasJavac ? "javac" : "java -m jdk.compiler"}; ${jver}`);

const traceKey = (s) => s.split("\n").filter((l) => l.startsWith("Exception in thread") || /at (Calculator|CalcStack)\./.test(l)).join("\n");
function sameRun(group, label, java, sim) {
  ok(group, java.stdout === sim.stdout && java.status === sim.status && traceKey(java.stderr) === traceKey(sim.stderr) && (java.stderr === "") === (sim.stderr === ""),
    `${label}\n  java: ${JSON.stringify(java)}\n  sim:  ${JSON.stringify({ stdout: sim.stdout, stderr: sim.stderr, status: sim.status })}`);
}
function runProcess(cp, input) {
  return new Promise((resolve) => {
    const p = spawn("java", ["-cp", cp, "Calculator"]);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (status) => resolve({ stdout: out, stderr: err, status }));
    p.stdin.on("error", () => {});
    p.stdin.end(input);
  });
}

/* ---------------------------------------------------------------- 1. curated sessions, real processes */
const CURATED = [
  "1 2 + .\nq\n", "42\n1 3 10 17\np\n+ p\n- p\n.\nq\n", "1 +\np\nx\n2 + p\nq\n", ".\nt\n+\n-\n*\n/\n1 0 /\np\nq\n",
  "2147483647 1 + p\nq\n", "1 *\n", ".\n", "1 /\n", "t\n", "1 -\n", "5 0 /\n", "", "p", "   \n\n  7   8 *  p  \n",
  "-2147483648 -1 / p\n", "-2147483648 1 - p\n", "65536 65536 * p\n", "7 -2 / p 7 2 - p\n", "+5 -0 007 p\n", "2147483648\n1x\n--1\n+\n-\nq\n",
  "1 2 q 3\np\n", "3 4 5 . t . t . t .\n", "10 3 / 10 -3 / -10 3 / p\n", "1 2 3 p q", "t 5 t\n", "4 2 * * p\n",
];
const runnable = Object.keys(CP);
await Promise.all(runnable.flatMap((v) => CURATED.map(async (input) => {
  const java = await runProcess(CP[v], input);
  sameRun("processes", `${v} on ${JSON.stringify(input)}`, java, C.run(v, input));
})));
console.log(`curated: ${CURATED.length} sessions x ${runnable.length} copies as separate processes`);

/* ---------------------------------------------------------------- 1b. random sessions, one JVM per copy */
let seed = 331;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const TOKENS = ["+", "-", "*", "/", ".", "t", "p", "0", "1", "2", "-1", "7", "-7", "13", "100", "2147483647", "-2147483648", "2147483648", "46341", "65536", "x", "+3", "--2", "q", "", " "];
function randomSession() {
  const lines = [];
  for (let l = 0, n = 1 + rnd(6); l < n; l++) {
    const toks = [];
    for (let k = 0, m = rnd(7); k < m; k++) { let tk = TOKENS[rnd(TOKENS.length)]; if (tk === "q" && rnd(4)) tk = "p"; toks.push(tk); }
    lines.push(toks.join(rnd(5) ? " " : "  "));
  }
  return lines.join("\n") + (rnd(3) ? "\n" : "");
}
for (const v of runnable) {
  const sessions = Array.from({ length: 1500 }, randomSession);
  const res = spawnSync("java", ["-cp", CP[v], "CalcHarness"], { input: sessions.join("\u0000"), encoding: "utf8", maxBuffer: 1 << 28 });
  const rows = res.stdout.trim().split("\n");
  ok("harness", rows.length === sessions.length, `${v}: harness returned ${rows.length} rows for ${sessions.length} sessions ${res.stderr}`);
  rows.forEach((row, i) => {
    const [o, e, s] = row.split("\t");
    const java = { stdout: Buffer.from(o, "base64").toString("utf8"), stderr: Buffer.from(e, "base64").toString("utf8"), status: Number(s) };
    sameRun("random", `${v} on ${JSON.stringify(sessions[i])}`, java, C.run(v, sessions[i]));
  });
}
console.log(`random: 1500 sessions x ${runnable.length} copies`);

/* ---------------------------------------------------------------- 2. the notes' printed runs */
const lines = (sim) => sim.transcript.map((x) => (x.prompt ? "" : x.typed !== undefined ? `> ${x.typed}` : x.out ?? x.err)).filter((x) => x !== "").join("\n");
const NOTES = [
  ["original", "1 2 + .\nq\n", "> 1 2 + .\n3\n> q"],
  ["original", "42\n1 3 10 17\np\n+ p\n- p\n.\nq\n", "> 42\n> 1 3 10 17\n> p\n[42 1 3 10 17]\n> + p\n[42 1 3 27]\n> - p\n[42 1 -24]\n> .\n-24\n> q"],
  ["original", "1 +\np\nx\n2 + p\nq\n", "> 1 +\nerror: need two numbers to add\n> p\n[1]\n> x\nerror: don't understand 'x'\n> 2 + p\n[3]\n> q"],
  ["original", ".\nt\n+\n-\n*\n/\n1 0 /\np\nq\n", "> .\nerror: stack is empty\n> t\nerror: stack is empty\n> +\nerror: need two numbers to add\n> -\nerror: need two numbers to subtract\n> *\nerror: need two numbers to multiply\n> /\nerror: need two numbers to divide\n> 1 0 /\nerror: cannot divide by zero\n> p\n[1 0]\n> q"],
  ["flag", "1 +\np\nq\n", "> 1 +\n> p\n[1]\n> q"],
  ["original", "2147483647 1 + p\nq\n", "> 2147483647 1 + p\n[-2147483648]\n> q"],
];
for (const [v, input, want] of NOTES) ok("notes", lines(C.run(v, input)) === want, `notes run ${v} ${JSON.stringify(input)}:\n${lines(C.run(v, input))}`);
const crash = (v, input) => C.run(v, input).stderr.trim();
ok("notes", crash("precondition", "1 *\n") === 'Exception in thread "main" java.lang.NullPointerException: Cannot invoke "java.lang.Integer.intValue()" because the return value of "CalcStack.pop()" is null\n\tat CalcStack.multiply(Calculator.java:182)\n\tat Calculator.main(Calculator.java:87)', "precondition copy's trace");
ok("notes", crash("exception", "1 /\n").endsWith("TooFewOperandsException: need two numbers to divide\n\tat CalcStack.divide(Calculator.java:198)\n\tat Calculator.main(Calculator.java:91)"), "exception copy's trace");
ok("notes", crash("checked-declared", "1 -\n").endsWith("StackException: need two numbers to subtract\n\tat CalcStack.subtract(Calculator.java:170)\n\tat Calculator.main(Calculator.java:77)"), "checked-declared copy's trace");
ok("notes", C.run("special-integer", ".\n").stdout === "> null\n> ", "special value with Integer kept prints null");

/* ---------------------------------------------------------------- 3. answer keys */
const attr = (tag, name) => { const m = new RegExp(`${name}=(?:"([^"]*)"|'([^']*)')`).exec(tag); return m ? (m[1] ?? m[2]).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&apos;/g, "'") : undefined; };
const tagOf = (id) => { const at = html.indexOf(`data-id="${id}"`); if (at < 0) throw new Error(`no item ${id}`); return html.slice(html.lastIndexOf("<", at), html.indexOf(">", at) + 1); };
const keyOf = (tid, part) => { const at = html.indexOf(`data-id="${tid}"`); const end = html.indexOf("</article>", at); const m = new RegExp(`<div class="answer-spec" data-part="${part}"[^>]*>`).exec(html.slice(at, end)); if (!m) throw new Error(`no part ${tid}.${part}`); return attr(m[0], "data-answer"); };
const itemKey = (id) => attr(tagOf(id), "data-answer");
const first = (k) => String(k).split("|")[0];
const G = req("../../../site/core/grader.js");

/* Section 2 and Lectures 7 and 8: the lectures' Java */
const wdir = join(work, "w03");
mkdirSync(wdir);
{ const r = javac(wdir, [join(here, "java", "W03.java")]); ok("compile", r.status === 0, `W03.java: ${r.stderr}`); }
const J = Object.fromEntries(execFileSync("java", ["-cp", wdir, "W03"], { encoding: "utf8" }).trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const eqKey = (label, key, truth) => ok("keys", String(key) === String(truth), `${label}: key ${key} vs ${truth}`);

/* ---- Lecture 6: from the simulator (itself checked against Java above) */
const last = (v, input) => { const outs = C.run(v, input).transcript.filter((x) => x.out !== undefined); return outs.length ? outs[outs.length - 1].out : null; };
eqKey("l6 qc rpn", itemKey("cse331-w3-l6-qc-rpn"), last("original", "5 1 2 + * ."));
eqKey("l6 qc 4 0 / p", itemKey("cse331-w3-l6-qc-div-zero-stack"), last("original", "4 0 /\np"));
eqKey("l6 quiz flag copy", itemKey("cse331-w3-l6-quiz-flag-copy"), last("flag", "1 +\np"));
eqKey("l6 quiz overflow", itemKey("cse331-w3-l6-quiz-overflow"), last("original", "2147483647 1 + p"));
for (const [part, input] of [["minus", "3 4 - ."], ["div", "10 3 / ."], ["negdiv", "-7 2 / ."], ["stack", "1 2 3 + p"], ["word", "1x"]])
  eqKey(`l6 predict ${part}`, keyOf("cse331-w3-l6-predict", part), last("original", input));
const outcome = (v, input) => { const r = C.run(v, input); if (r.compileError) return "compile"; if (/NullPointerException/.test(r.stderr)) return "npe"; if (/NoSuchElementException/.test(r.stderr)) return "nse"; if (r.stderr) return "trace"; const o = r.transcript.filter((x) => x.out !== undefined); return o.length === 0 ? "silent" : o[o.length - 1].out === "null" ? "null" : "other"; };
for (const [part, v, input] of [["flag", "flag", "1 +"], ["pre", "precondition", "1 *"], ["special", "special-integer", "."], ["exception", "exception", "1 /"], ["wrapper", "wrapper", "t"], ["checked", "checked", "1 -"]])
  eqKey(`l6 forgotten ${part}`, keyOf("cse331-w3-l6-forgotten", part), outcome(v, input));
eqKey("l6 forgotten line", keyOf("cse331-w3-l6-forgotten", "line"), /CalcStack\.multiply\(Calculator\.java:(\d+)\)/.exec(C.run("precondition", "1 *").stderr)[1]);
{ // divide with its check blanked, and add with Math.addExact: real Java
  const d = join(work, "blank"); mkdirSync(d);
  writeFileSync(join(d, "Calculator.java"), calcSrc.map((l, i) => (i + 1 >= 197 && i + 1 <= 200 ? "" : i + 1 === 157 ? "        push(Math.addExact(a, b));" : l)).join("\n"));
  writeFileSync(join(d, "Probe.java"), `public class Probe { public static void main(String[] x) {
    CalcStack s = new CalcStack(); s.push(1);
    try { s.divide(); System.out.println("none"); } catch (Throwable e) { System.out.println(e.getClass().getSimpleName()); }
    CalcStack t = new CalcStack(); t.push(2147483647); t.push(1);
    try { t.add(); } catch (ArithmeticException e) { System.out.println(t); } } }`);
  const r = javac(d, ["Calculator.java", "Probe.java"]); ok("compile", r.status === 0, r.stderr);
  const [thrown, after] = execFileSync("java", ["-cp", d, "Probe"], { encoding: "utf8" }).trim().split("\n");
  eqKey("l6 qc blank check: divideOnOneNumberThrows passes?", itemKey("cse331-w3-l6-qc-blank-check"), thrown === "TooFewOperandsException" ? "yes" : "no");
  ok("keys", thrown === "NullPointerException", `blanked divide throws ${thrown}`);
  eqKey("l6 overflow: numbers kept?", keyOf("cse331-w3-l6-overflow", "kept"), after === "[2147483647 1]" ? "yes" : "no");
}

/* ---- Section 2 */
eqKey("s2 qc arraySum", itemKey("cse331-w3-s2-qc-arraysum"), J["arraySum.multi"]);
eqKey("s2 qc third call", itemKey("cse331-w3-s2-qc-third-call"), J["rv.r3"]);
{ const fails = [["A", "buggy.empty", "0"], ["B", "buggy.one", "5"], ["C", "buggy.multi", "5"]].filter(([, k, want]) => J[k] !== want).map(([l]) => l).join("");
  eqKey("s2 buggy arraySum fails", keyOf("cse331-w3-s2-buggy-arraysum", "fail"), fails);
  eqKey("s2 buggy {5}", keyOf("cse331-w3-s2-buggy-arraysum", "b-gets"), J["buggy.one"]); }
for (const p of ["r1", "r2", "r3", "a0"]) eqKey(`s2 trace ${p}`, keyOf("cse331-w3-s2-trace-test", p), J[`rv.${p}`]);
ok("keys", J["rv.arr"] === "[2, 2, 3]", `section test leaves ${J["rv.arr"]}`);
for (const p of ["r9", "first9", "r5", "a3"]) eqKey(`s2 quirks ${p}`, keyOf("cse331-w3-s2-quirks", p), J[`quirk.${p}`]);
ok("keys", J["quirk.arr2"] === "[1, 2, 3, 9, 3]", `quirk array ${J["quirk.arr2"]}`);
{ const n = 2, k = [1, 2].filter((v) => v === 1).length; eqKey("s2 first unspecified index", keyOf("cse331-w3-s2-spec-based", "first-unspec"), n - k); }

/* ---- Lecture 7: Java and brute force */
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const X = range(-2000, 2000);
const valid = (P, run, Q, xs = X) => xs.every((x) => !P(x) || Q(run(x)));
const wpSet = (run, Q, xs = X) => xs.filter((x) => Q(run(x)));
{ const pts = JSON.parse(attr(tagOf("cse331-w3-l7-qc-after-18"), "data-points"));
  const spec = { type: "formula", answer: itemKey("cse331-w3-l7-qc-after-18"), points: pts };
  ok("keys", G.grade(spec, "h * 60 + m").status === "correct", "after line 18 formula accepts h * 60 + m");
  let good = true; for (const h of range(0, 30)) for (const m of range(0, 70)) { let t = h; t = t * 60 + m; if (t !== 60 * h + m) good = false; } ok("keys", good, "t after line 18 is 60h + m"); }
eqKey("l7 qc triple x=3 x=x+1 x=4", itemKey("cse331-w3-l7-qc-triple"), valid((x) => x === 3, (x) => x + 1, (x) => x === 4) ? "yes" : "no");
eqKey("l7 quiz says less", itemKey("cse331-w3-l7-quiz-says-less"), valid((x) => x === 3, (x) => x + 1, (y) => 0 < y) ? "yes" : "no");
{ const ce = X.filter((x) => 0 < x && !(0 < x - 1)); eqKey("l7 quiz counterexample", itemKey("cse331-w3-l7-quiz-counterexample"), ce.join()); }
eqKey("l7 qc wp x+1 = 4", itemKey("cse331-w3-l7-qc-wp"), wpSet((x) => x + 1, (x) => x === 4).join());
eqKey("l7 quiz wp x*2 = 10", itemKey("cse331-w3-l7-quiz-wp-double"), wpSet((x) => x * 2, (x) => x === 10).join());
eqKey("l7 qc abs(MIN)", itemKey("cse331-w3-l7-qc-abs-min"), J["abs.min"]);
eqKey("l7 qc quadrant(1,-1)", itemKey("cse331-w3-l7-qc-quadrant"), J["quadrant.1m1"]);
{ const N = range(1, 100), after = N.map((n) => n + 3);
  eqKey("l7 ex1 low", keyOf("cse331-w3-l7-ex1", "low"), Math.min(...after)); eqKey("l7 ex1 high", keyOf("cse331-w3-l7-ex1", "high"), Math.max(...after));
  eqKey("l7 ex1 valid", keyOf("cse331-w3-l7-ex1", "valid"), valid((n) => 1 <= n && n <= 100, (n) => n + 3, (n) => 10 <= n * n) ? "yes" : "no");
  eqKey("l7 ex1 uses n<=100", keyOf("cse331-w3-l7-ex1", "uses-100"), valid((n) => 1 <= n, (n) => n + 3, (n) => 10 <= n * n, range(-5, 100000)) ? "no" : "yes"); }
{ let ok2 = true, most = -1; for (const h of range(0, 3)) for (const m of range(0, 120)) for (const s of range(0, 120)) { const t = 3600 * h + 60 * m + s; if (t < 3600) { if (h !== 0) ok2 = false; most = Math.max(most, 60 * m + s); } }
  ok("keys", ok2, "seconds < 3600 only when h = 0"); eqKey("l7 ex2 h", keyOf("cse331-w3-l7-ex2", "h"), 0); eqKey("l7 ex2 most", keyOf("cse331-w3-l7-ex2", "most-ms"), most);
  eqKey("l7 ex2 seconds(0,90,0)", keyOf("cse331-w3-l7-ex2", "ninety"), J["seconds.ninety"]); }
{ const spec = (a, b) => (a < b ? -1 : a === b ? 0 : 1); let wrong = 0; for (const a of [1, 2, 3]) for (const b of [1, 2, 3]) if (Number(J[`compareChanged.${a},${b}`]) !== spec(a, b)) wrong++;
  eqKey("l7 ex3 wrong pairs", keyOf("cse331-w3-l7-ex3", "wrong-pairs"), wrong); eqKey("l7 ex3 ok", keyOf("cse331-w3-l7-ex3", "ok"), wrong ? "no" : "yes");
  eqKey("l7 ex3 compare(3,3)", keyOf("cse331-w3-l7-ex3", "three"), J["compareChanged.33"]);
  ok("keys", !range(-50, 50).some((a) => range(-50, 50).some((b) => b < a && a === b)), "b < a and a = b is unsatisfiable"); }
eqKey("l7 ex4 min(2,1)", keyOf("cse331-w3-l7-ex4", "min21"), J["minRepaired.21"]);
{ let h = 0; while (3600 * h <= 2147483647) h++; eqKey("l7 ex5 first h", keyOf("cse331-w3-l7-ex5", "first-h"), h); }
{ eqKey("l7 backward", keyOf("cse331-w3-l7-backward", "x"), wpSet((x) => 2 * (x + 1), (y) => y === 10).join());
  eqKey("l7 backward valid", keyOf("cse331-w3-l7-backward", "valid"), valid((x) => x === 4, (x) => 2 * (x + 1), (y) => 8 < y) ? "yes" : "no"); }
{ const spec = (x, y) => (x > 0 && y > 0 ? 1 : x < 0 && y > 0 ? 2 : x < 0 && y < 0 ? 3 : 4); const bad = new Set(); let fixOk = true;
  for (const x of range(-3, 3)) for (const y of range(-3, 3)) { if (!x || !y) continue; if (Number(J[`quadrant.${x},${y}`]) !== spec(x, y)) bad.add(spec(x, y)); let q = 1; if (x < 0) q = 2; if (y < 0) q = 5 - q; if (q !== spec(x, y)) fixOk = false; }
  eqKey("l7 quadrant bad quadrant", keyOf("cse331-w3-l7-quadrant", "bad-quad"), [...bad].join()); eqKey("l7 quadrant(5,-2)", keyOf("cse331-w3-l7-quadrant", "call"), J["quadrant.5m2"]);
  ok("keys", fixOk, "the solution's fix q = 5 - q gives every quadrant"); }

/* ---- Lecture 8: Java, and the three checks by enumeration */
eqKey("l8 qc condition checks", itemKey("cse331-w3-l8-qc-checks"), J["sum.checks345"]);
eqKey("l8 qc variant", itemKey("cse331-w3-l8-qc-variant"), 3 - 0);
eqKey("l8 quiz exit", itemKey("cse331-w3-l8-quiz-exit"), J["exit.345"]);
eqKey("l8 quiz start", itemKey("cse331-w3-l8-quiz-start"), J["start.345"]);
eqKey("l8 quiz sumTo swapped", itemKey("cse331-w3-l8-quiz-sumto-swapped"), J["sumToSwapped.4"]);
{ // sum's invariant against each copy: which of checks (1), (2), (3) fail on small arrays and states
  const arrays = [[]]; for (let len = 1; len <= 3; len++) { const rec = (p) => { if (p.length === len) { arrays.push(p); return; } for (const v of [-2, -1, 0, 1, 2]) rec([...p, v]); }; rec([]); }
  const S = (a, i) => a.slice(0, i).reduce((x, y) => x + y, 0);
  const I = (a, i, s) => 0 <= i && i <= a.length && s === S(a, i);
  const COPIES = {
    sum: { i0: 0, b: (a, i) => i < a.length, body: (a, i, s) => [i + 1, s + a[i]] },
    start: { i0: 1, b: (a, i) => i < a.length, body: (a, i, s) => [i + 1, s + a[i]] },
    swapped: { i0: 0, b: (a, i) => i < a.length, body: (a, i, s) => (i + 1 >= a.length ? null : [i + 1, s + a[i + 1]]) },
    exit: { i0: 0, b: (a, i) => i < a.length - 1, body: (a, i, s) => [i + 1, s + a[i]] },
  };
  const failing = (c) => {
    const C2 = COPIES[c], out = new Set();
    for (const a of arrays) {
      if (!I(a, C2.i0, 0)) out.add(1);
      for (let i = -1; i <= a.length + 1; i++) for (let s = -8; s <= 8; s++) {
        if (!I(a, i, s)) continue;
        if (C2.b(a, i)) { const r = C2.body(a, i, s); if (r && !I(a, r[0], r[1])) out.add(2); }
        else if (s !== S(a, a.length)) out.add(3);
      }
    }
    return [...out].sort().join();
  };
  ok("keys", failing("sum") === "", `sum passes all checks (${failing("sum")})`);
  eqKey("l8 copies start", keyOf("cse331-w3-l8-copies", "start"), failing("start"));
  eqKey("l8 copies exit", keyOf("cse331-w3-l8-copies", "exit"), failing("exit"));
  eqKey("l8 qc swapped", itemKey("cse331-w3-l8-qc-swapped"), failing("swapped"));
  eqKey("l8 half sheet check", keyOf("cse331-w3-l8-half-sheet", "check"), failing("swapped"));
  const right = { empty: "0", seven: "7", 345: "12" };
  const catches = [["A", "empty"], ["B", "seven"], ["C", "345"]].filter(([, t]) => ["start", "swapped", "exit"].every((c) => J[`${c}.${t}`] !== right[t])).map(([l]) => l).join("");
  eqKey("l8 copies tests", keyOf("cse331-w3-l8-copies", "tests"), catches);
  ok("keys", J["sum.345"] === "12" && J["sum.seven"] === "7" && J["sum.empty"] === "0", "the lecture's sum passes its tests");
  const m = /^ArrayIndexOutOfBoundsException: Index (\d+) out of bounds/.exec(J["swapped.345"]);
  eqKey("l8 half sheet index", keyOf("cse331-w3-l8-half-sheet", "index"), m && m[1]);
  eqKey("l8 half sheet exception", keyOf("cse331-w3-l8-half-sheet", "exc"), J["swapped.345"].split(":")[0]);
}
{ // sumTo swapped: invariant check (2) fails, always by exactly 1
  const T = (i) => (i * (i + 1)) / 2; const shorts = new Set(); let c1 = true, c3 = true;
  for (let n = 0; n <= 12; n++) { if (!(0 <= 0 && 0 <= n && 0 === T(0))) c1 = false; for (let i = 0; i <= n; i++) { const s = T(i); if (i < n) { const s2 = s + i, i2 = i + 1; shorts.add(T(i2) - s2); } else if (s !== T(n)) c3 = false; } }
  eqKey("l8 sumTo swapped check", keyOf("cse331-w3-l8-sumto-swapped", "check"), c1 && c3 && shorts.size && !shorts.has(0) ? 2 : "?");
  eqKey("l8 sumTo swapped short", keyOf("cse331-w3-l8-sumto-swapped", "short"), [...shorts].join());
  eqKey("l8 sumTo swapped (4)", keyOf("cse331-w3-l8-sumto-swapped", "four"), J["sumToSwapped.4"]);
  ok("keys", J["sumTo.4"] === "10", "the right sumTo(4) is 10"); }
eqKey("l8 quotient", keyOf("cse331-w3-l8-quotient", "q"), J["quotient.17.5"]);
eqKey("l8 quotient r", keyOf("cse331-w3-l8-quotient", "r"), J["quotient.r"]);
{ let good = true; for (const x of range(0, 60)) for (const y of range(1, 9)) { let q = 0, r = x; while (y <= r) { const before = r; q++; r -= y; if (!(r < before && r >= 0)) good = false; } if (!(q * y <= x && x < (q + 1) * y)) good = false; }
  ok("keys", good && keyOf("cse331-w3-l8-quotient", "variant") === "r", "r is a variant of quotient and the postcondition holds"); }
eqKey("l8 factorial(5)", keyOf("cse331-w3-l8-factorial", "five"), J["factorial.5"]);
ok("keys", J["factorial.20"] === "2432902008176640000", `factorial(20) = ${J["factorial.20"]}`);
eqKey("l8 factorial(21) is 21!?", keyOf("cse331-w3-l8-factorial", "twenty-one"), J["factorial.21"] === J["factorial.21exact"] ? "yes" : "no");
ok("keys", J["factorial.21exact"] === "51090942171709440000", "21! as printed in the notes");
eqKey("l8 count", keyOf("cse331-w3-l8-count", "run"), J["count.55"]);
eqKey("l8 find 4", keyOf("cse331-w3-l8-find", "first"), J["find.4"]);
eqKey("l8 find 9", keyOf("cse331-w3-l8-find", "none"), J["find.9"]);

/* every answer key is accepted by its own grader (types and syntax) */
for (const m of html.matchAll(/<(?:div|li) class="(?:answer-spec|check|cyu)"[^>]*data-answer=[^>]*>/g)) {
  const tag = m[0], type = attr(tag, "data-type");
  if (!type || type === "choice") continue;
  const spec = { type, answer: attr(tag, "data-answer"), allowed: attr(tag, "data-allowed"), points: tag.includes("data-points") ? JSON.parse(attr(tag, "data-points")) : undefined };
  ok("graders", G.grade(spec, first(spec.answer)).status === "correct", `own key not accepted: ${tag.slice(0, 120)}`);
}
console.log(`answer keys: ${counts.keys} checks`);

rmSync(work, { recursive: true, force: true });
console.log(`groups: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`${checks - fails}/${checks} checks match real Java and brute force`);
process.exit(fails ? 1 : 0);
