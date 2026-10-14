// Ground truth for both simulators. Compiles the lecture Java with javac and runs it for real.
//   1. Lecture 1 Sum (4 versions, via SumMany) vs site/js/sum-sim.js on curated + 400 random inputs.
//   2. Lecture 1 Sum.java and Lecture 2 SumPieces.java as separate processes on real stdin:
//      both must print the same thing (the lecture's claim) and match the simulator.
//   3. Lecture 2 indexOf impls, count, sign, maxList (SpecMany) vs site/js/spec-sim.js, call by call,
//      plus the lecture's "which implementations meet which specs" table.
// Usage: node tests/compare-java.mjs   (needs java 17+; uses javac from PATH, else `java -m jdk.compiler`)
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const SumSim = req("../../../site/cse331/w01/sum-sim.js");
const SpecSim = req("../../../site/cse331/w01/spec-sim.js");

let checks = 0, fails = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; if (fails <= 25) console.log("MISMATCH:", msg); } };

/* ---------- compile */
const classes = mkdtempSync(join(tmpdir(), "cse331-classes-"));
const sources = ["Sum.java", "SumHasNext.java", "SumMany.java", "SumPieces.java", "SpecMany.java"].map((f) => join(here, "java", f));
const hasJavac = spawnSync("javac", ["-version"]).status === 0;
const javac = hasJavac ? ["javac", ["-d", classes, ...sources]] : ["java", ["-m", "jdk.compiler/com.sun.tools.javac.Main", "-d", classes, ...sources]];
execFileSync(javac[0], javac[1], { stdio: "inherit" });
console.log(`compiled ${sources.length} files with ${hasJavac ? "javac" : "java -m jdk.compiler/com.sun.tools.javac.Main (no javac binary on PATH)"}; ${spawnSync("java", ["-version"], { encoding: "utf8" }).stderr.split("\n")[0]}`);
const java = (cls, opts = {}) => execFileSync("java", ["-XX:-OmitStackTraceInFastThrow", "-cp", classes, cls, ...(opts.args || [])], { encoding: "utf8", maxBuffer: 1 << 28, input: opts.input });

/* ---------- 1. Sum, four versions, in one JVM */
const curated = [
  "3 4 5", "1 2 three 4", "", "2147483647 1", "2147483648", "3 4\n5", "2.5 3", "1 2 3",
  "+5 -0 007", "1,000 2", "1,0000 2", "-2147483648 -1", "-2147483648", "-2147483649", "2147483647",
  "9223372036854775807 1", "9223372036854775808", "-9223372036854775808 -1", "3 4 hello",
  "   \n\t ", "12abc", "--5", "+-5", "5-", "0x10", "1e3", "1_000", " 5", "5 6 7",
  "1 2", "1　2", "1,000,000 1", ",5", "5,", "1,00", "12,345,678", "2147483647 2147483647",
  "-1 -1 -1", "000000000000000000000000000001 2", "1 2 3 4 5 6 7 8 9 10", "hello", "3 4 2147483648 5",
  "5 3 three 2147483647 1", "4 -4 x 9", "10 20 x 30", "2147483647 2147483647 2", "-2147483648 -2147483648",
  Array.from({ length: 60 }, (_, i) => String(i * 1000003)).join(" "),
  Array.from({ length: 25 }, () => "100000").join(" "),
];
function rand(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); }
const r = rand(331);
const pick = (a) => a[Math.floor(r() * a.length)];
const piece = () => pick([
  () => String(Math.floor(r() * 200) - 100),
  () => String(2147483647 - Math.floor(r() * 3)),
  () => String(-2147483648 + Math.floor(r() * 3)),
  () => (2n ** 31n + BigInt(Math.floor(r() * 3))).toString(),
  () => String(Math.floor(r() * 2 ** 31)),
  () => "9223372036854775807", () => "-9223372036854775808", () => "9223372036854775808",
  () => pick(["three", "x", "2.5", "1e2", "+7", "-0", "007", "1,234", "12,34", "--1", "", "4,294,967,296"]),
])();
const random = Array.from({ length: 400 }, () => Array.from({ length: Math.floor(r() * 7) }, piece).join(pick([" ", "  ", "\n", "\t", " \n "])));
const inputs = [...curated, ...random];

const dir = mkdtempSync(join(tmpdir(), "sum331-"));
const files = inputs.map((s, i) => { const f = join(dir, `in${i}.txt`); writeFileSync(f, s); return f; });
const blocks = java("SumMany", { args: files }).split("=== end\n").filter(Boolean);
ok(blocks.length === inputs.length, `SumMany produced ${blocks.length} blocks for ${inputs.length} inputs`);
blocks.forEach((block, k) => {
  const parts = Object.fromEntries(block.split(/^=== /m).filter(Boolean).map((p) => { const nl = p.indexOf("\n"); return [p.slice(0, nl), p.slice(nl + 1)]; }));
  for (const v of ["orig", "hasnext", "one", "long"]) {
    const sim = SumSim.run(v, inputs[k]);
    const got = sim.crash ? `Enter some numbers.\nEXCEPTION ${sim.crash.exception}${sim.crash.message ? `: ${sim.crash.message}` : ""}\n` : sim.stdout.join("\n") + "\n";
    ok(got === parts[v], `${v} on ${JSON.stringify(inputs[k])}\n  java: ${JSON.stringify(parts[v])}\n  sim:  ${JSON.stringify(got)}`);
  }
});
const sumChecks = checks;

/* ---------- 2. real processes on stdin: Lecture 1 Sum and Lecture 2 SumPieces */
const procInputs = ["3 4 5", "1 2 three 4", "", "2147483647 1", "3 4\n5", "2.5 3", "2147483648", "-2147483648 -1", "1 2 3", "5 3 three 2147483647 1", "4 -4 x 9", "10 20 x 30", "9223372036854775807"];
for (const input of procInputs) {
  const a = java("Sum", { input }), b = java("SumPieces", { input });
  const sim = SumSim.run("orig", input).stdout.join("\n") + "\n";
  ok(a === sim, `Sum.java process on ${JSON.stringify(input)}: ${JSON.stringify(a)} vs sim ${JSON.stringify(sim)}`);
  ok(b === a, `Lecture 2 SumPieces prints exactly what Lecture 1 Sum prints on ${JSON.stringify(input)}: ${JSON.stringify(b)} vs ${JSON.stringify(a)}`);
}
const hn = spawnSync("java", ["-cp", classes, "SumHasNext"], { input: "3 4 hello", encoding: "utf8" });
ok(hn.stderr.startsWith('Exception in thread "main" java.util.InputMismatchException\n') && hn.stderr.includes("at SumHasNext.main(SumHasNext.java:11)"), "hasNext version crashes at line 11 on a word");
const procChecks = checks - sumChecks;

/* ---------- 3. Lecture 2 */
const toOutcome = (s) => {
  if (s.startsWith("EX ")) { const [, ex, ...msg] = s.split(" "); const m = msg.join(" "); return { exception: ex, message: m === "null" ? null : m }; }
  return { value: Number(s) };
};
const same = (o, p) => ("value" in o ? "value" in p && o.value === p.value : o.exception === p.exception && (o.message ?? null) === (p.message ?? null));
const parseArr = (s) => (s === "[]" ? [] : s.slice(1, -1).split(",").map(Number));
const javaIdx = new Map();
let nI = 0, nC = 0, nS = 0, nM = 0, nB = 0;
for (const line of java("SpecMany").trim().split("\n")) {
  const [lhs, rhs] = line.split(" => ");
  const f = lhs.split(" ");
  const want = toOutcome(rhs);
  if (f[0] === "I") {
    const [impl, a, lo, hi, x] = [Number(f[1]), parseArr(f[2]), Number(f[3]), Number(f[4]), Number(f[5])];
    const got = SpecSim.indexOf(impl, a, lo, hi, x);
    javaIdx.set(`${impl} ${f[2]} ${lo} ${hi} ${x}`, want);
    nI++; ok(same(got, want), `indexOf impl ${impl} ${lhs}: java ${rhs}, sim ${SpecSim.showOutcome(got)}`);
  } else if (f[0] === "C") {
    const [impl, a, x] = [Number(f[1]), parseArr(f[2]), Number(f[3])];
    const got = SpecSim.count(impl, a, x).result;
    nC++; ok(same(got, want), `count impl ${impl} ${lhs}: java ${rhs}, sim ${SpecSim.showOutcome(got)}`);
  } else if (f[0] === "S") {
    const got = SpecSim.sign(Number(f[1]), Number(f[2]));
    nS++; ok(same(got, want), `sign impl ${f[1]}(${f[2]}): java ${rhs}, sim ${SpecSim.showOutcome(got)}`);
  } else if (f[0] === "B") {
    const list = parseArr(f[1]);
    const [fw, bw] = rhs.split(" ");
    nB++; ok(SpecSim.sumForward(list).toString() === fw && SpecSim.sumBackward(list).toString() === bw && fw === bw, `sumList forward/backward on ${f[1]}: java ${rhs}, sim ${SpecSim.sumForward(list)} ${SpecSim.sumBackward(list)}`);
  } else if (f[0] === "D") {
    const got = SpecSim.middle(parseArr(f[1]));
    nM++; ok(same(got, want), `middle(${f[1]}): java ${rhs}, sim ${SpecSim.showOutcome(got)}`);
  } else if (f[0] === "M") {
    const got = SpecSim.maxList(parseArr(f[1]));
    nM++; ok(same(got, want), `maxList(${f[1]}): java ${rhs}, sim ${SpecSim.showOutcome(got)}`);
  }
}

// The lecture's table, computed from the REAL Java outcomes (not the simulator).
const TABLE = { 1: "yes yes no yes no", 2: "yes no no no yes", 3: "yes no no no no", 4: "yes no yes yes no" };
const runJava = (impl, a, lo, hi, x) => javaIdx.get(`${impl} [${a.join(",")}] ${lo} ${hi} ${x}`);
for (const impl of [1, 2, 3, 4]) {
  const t = SpecSim.meetsTable(impl, runJava);
  const row = "ABCDE".split("").map((s) => (t[s].meets ? "yes" : "no")).join(" ");
  ok(row === TABLE[impl], `implementation ${impl} meets ${row} (lecture says ${TABLE[impl]})`);
  const ts = SpecSim.meetsTable(impl);
  ok("ABCDE".split("").every((s) => ts[s].meets === t[s].meets), `simulator's meets table for impl ${impl} matches Java's`);
}
// count on [5, 1, 5, 2, 5]: 3 with implementation 1, 1 with implementation 4 (lecture slide)
ok(SpecSim.count(1, [5, 1, 5, 2, 5], 5).result.value === 3 && SpecSim.count(4, [5, 1, 5, 2, 5], 5).result.value === 1, "count on [5,1,5,2,5]: 3 and 1");
// sign table from the exercises: impl 1 meets S1 S2 S3, impl 2 meets S2 only, impl 3 meets none (MIN_VALUE)
const signMeets = (impl) => ["S1", "S2", "S3"].filter((s) => SpecSim.SIGN_DOMAIN.every((x) => !SpecSim.SIGN_SPECS[s].pre(x) || SpecSim.SIGN_SPECS[s].ok(x, SpecSim.sign(impl, x)))).join(",");
ok(signMeets(1) === "S1,S2,S3" && signMeets(2) === "S2" && signMeets(3) === "", `sign meets: ${signMeets(1)} | ${signMeets(2)} | ${signMeets(3) || "none"}`);
ok(SpecSim.sign(3, -2147483648).value === 1, "sign impl 3 on Integer.MIN_VALUE returns 1 (Math.abs overflow)");

console.log(`Sum: ${inputs.length} inputs x 4 versions = ${sumChecks} comparisons; processes: ${procChecks}; Lecture 2: ${nI} indexOf calls, ${nC} count runs, ${nS} sign calls, ${nM} maxList/middle calls, ${nB} sumList front-vs-back lists + tables`);
console.log(`${checks - fails}/${checks} checks match real Java`);
process.exit(fails ? 1 : 0);
