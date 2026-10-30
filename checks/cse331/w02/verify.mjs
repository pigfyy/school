// Ground truth for site/js/sum-sim.js. Compiles the lecture's Java and runs it for real, as separate processes.
//   1. Lecture 3's Sum.java (the 99-line listing from the notes) on curated + random command lines, stdin and
//      files: stdout, stderr and exit status must match the simulator exactly.
//   2. The lecture's two changed copies (lines 40-43 blank; lines 73-75 blank).
//   3. FormatMany.java: Double.toString and String.format("%.Nf") on 60,000+ averages vs the simulator's.
//   4. Real bash: the shell lines the site's terminal offers (redirection, $?, pipes) vs the simulator's shell.
//   5. Lecture 1's Sum (for the "same runs, different Sum" comparison).
//   6. The out-of-memory boundary: precision 2147483647 (always fails). FULL=1 also runs the heap-space
//      boundary (needs ~10 GB of memory and a minute).
// Stack traces: the site shows the frames the lecture notes print (JDK 25). This machine's JDK prints other
// line numbers inside java.base, so for exceptions the test compares the exception line and the Sum.main frame.
// Usage: node tests/compare-java.mjs   (java 17+; uses javac, else `java -m jdk.compiler`)
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir, cpus } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const S = req("../../../site/cse331/w02/sum-sim.js");

let checks = 0, fails = 0;
const counts = {};
const ok = (group, cond, msg) => { checks++; counts[group] = (counts[group] || 0) + 1; if (!cond) { fails++; if (fails <= 30) console.log(`MISMATCH [${group}]:`, msg); } };

/* ---------------------------------------------------------------- compile */
const work = mkdtempSync(join(tmpdir(), "cse331-w2-"));
const hasJavac = spawnSync("javac", ["-version"]).status === 0;
function compile(src, outDir) {
  mkdirSync(outDir, { recursive: true });
  const [cmd, args] = hasJavac ? ["javac", ["-d", outDir, src]] : ["java", ["-m", "jdk.compiler/com.sun.tools.javac.Main", "-d", outDir, src]];
  execFileSync(cmd, args, { stdio: ["ignore", "ignore", "inherit"] });
}
const CP = { orig: join(work, "orig"), noneg: join(work, "noneg"), nocount: join(work, "nocount"), l1: join(work, "l1"), fmt: join(work, "fmt") };
compile(join(here, "java", "Sum.java"), CP.orig);
compile(join(here, "java", "variants", "noneg", "Sum.java"), CP.noneg);
compile(join(here, "java", "variants", "nocount", "Sum.java"), CP.nocount);
compile(join(here, "java", "Lecture1Sum.java"), CP.l1);
compile(join(here, "java", "FormatMany.java"), CP.fmt);
const jver = spawnSync("java", ["-version"], { encoding: "utf8" }).stderr.split("\n")[0];
console.log(`compiled 5 programs with ${hasJavac ? "javac" : "java -m jdk.compiler/com.sun.tools.javac.Main (no javac on PATH)"}; ${jver}`);
const JOPTS = ["-Duser.language=en", "-Duser.country=US", "-XX:-OmitStackTraceInFastThrow"];

// the lecture's listing and the variants differ only where they should
const src = readFileSync(join(here, "java", "Sum.java"), "utf8").split("\n");
const v1 = readFileSync(join(here, "java", "variants", "noneg", "Sum.java"), "utf8").split("\n");
const v2 = readFileSync(join(here, "java", "variants", "nocount", "Sum.java"), "utf8").split("\n");
ok("listing", src.filter((l, i) => l !== "" || true).length >= 99 && src[19] === "public class Sum {" && src[94] === "    private static void fail(String message) {", "Sum.java is the 99-line listing (line 20 = class, line 95 = fail)");
ok("listing", v1.every((l, i) => (i >= 39 && i <= 42 ? l === "" : l === src[i])), "noneg copy = Sum.java with lines 40-43 blank");
ok("listing", v2.every((l, i) => (i >= 72 && i <= 74 ? l === "" : l === src[i])), "nocount copy = Sum.java with lines 73-75 blank");

/* ---------------------------------------------------------------- a sandbox working directory per case */
const FILES = {
  "nums.txt": "3 4 5\n", "bad.txt": "3 x\n", "empty.txt": "", "big.txt": "2147483647 1\n", "neg.txt": "-7 -8\n",
  "lines.txt": "1\n2\n\n3\n", "dec.txt": "2.5 3\n", "my file.txt": "10 20\n", "huge.txt": "2147483648\n", "mixed.txt": "1 2 three 4\n",
};
let caseNo = 0;
function sandbox(files) {
  const d = join(work, `cwd${caseNo++}`);
  mkdirSync(d);
  for (const [n, t] of Object.entries(files)) writeFileSync(join(d, n), t);
  return d;
}
// countOnly: keep the first 200 characters of standard output and count the rest (outputs of ~2 GB)
function runJava(cp, cls, args, stdin, cwd, { countOnly = false } = {}) {
  return new Promise((resolve) => {
    const p = spawn("java", [...JOPTS, "-cp", cp, cls, ...args], { cwd });
    let out = "", err = "", outLength = 0, tailOk = true;
    p.stdout.on("data", (d) => {
      if (!countOnly) { out += d; return; }
      const t = d.toString("latin1");
      if (out.length < 200) out += t.slice(0, 200 - out.length);
      outLength += d.length;
      if (tailOk && outLength > 200 && !/^[0\n]*$/.test(t.slice(Math.max(0, 200 - (outLength - d.length))))) tailOk = false;
    });
    p.stderr.on("data", (d) => { err += d; });
    p.on("close", (status) => resolve({ stdout: out, stderr: err, status, length: countOnly ? outLength : out.length, zerosAfter: tailOk }));
    p.stdin.on("error", () => {});
    p.stdin.end(stdin ?? "");
  });
}
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { for (;;) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i], i); } }));
  return out;
}
const firstLineAndMain = (e) => { const ls = e.split("\n"); return `${ls[0]}\n${ls.find((l) => l.includes("at Sum.main")) || ""}`; };
function compareRun(group, label, real, sim) {
  if (sim.how === "exception") {
    ok(group, real.stdout === sim.stdout && real.status === sim.status && firstLineAndMain(real.stderr) === firstLineAndMain(sim.stderr),
      `${label}\n  java: ${JSON.stringify(real)}\n  sim:  ${JSON.stringify({ stdout: sim.stdout, stderr: sim.stderr, status: sim.status })}`);
  } else {
    ok(group, real.stdout === sim.stdout && real.stderr === sim.stderr && real.status === sim.status,
      `${label}\n  java: ${JSON.stringify(real)}\n  sim:  ${JSON.stringify({ stdout: sim.stdout, stderr: sim.stderr, status: sim.status })}`);
  }
}

/* ---------------------------------------------------------------- 1. curated + random runs of Sum.java */
const curated = [
  // the lecture's runs, in order
  [[], "3 4 5\n"], [["-a"], "3 4 5\n"], [["nums.txt"], ""], [[], "1 2 three 4\n"], [[], "2147483647 1\n"],
  [["nums.txt"], ""], [["bad.txt"], ""], [[], "2147483648\n"], [[], ""], [["-a"], ""], [["--help"], ""],
  [["-a", "--precision=-1"], "1 2\n"], [["precision=4"], ""], [["precision=4", "nums.txt"], ""], [["-a", "--precision=2147483648"], ""],
  [["--bogus"], ""], [["-a", "--precision=2"], "1 2\n"], [["-a", "--precision=2", "nums.txt"], ""],
  // edges
  [[], "  \n\t "], [[], "-2147483648 -2147483648"], [[], "9223372036854775807"], [[], "1,000 2"], [[], "1,0000 2"], [[], "+5 -0 007"],
  [[], "0x10"], [[], "1e3"], [[], "2.5 3"], [[], "١ ٢"], [[], "１２ 3"], [[], "5 6"], [[], "5 6"], [[], "--5"], [[], "-"],
  [["-a"], "1 2"], [["-a"], "-1 -2"], [["-a"], "1 2 2"], [["-a"], "2147483647 2147483647"], [["-a"], "-2147483648"], [["-a"], "10000000"], [["-a"], "1 2000"],
  [["-a", "--precision=0"], "1 2"], [["-a", "--precision=0"], "-1 -2"], [["-a", "--precision=0"], "5 6"], [["-a", "--precision=30"], "1 2 3 4 5 6 7"],
  [["-a", "--precision=-0"], "1 2"], [["-a", "--precision=+3"], "1 2"], [["-a", "--precision=٣"], "1 2"], [["-a", "--precision="], "1"], [["-a", "--precision=x"], "1"],
  [["-a", "--precision=2", "--precision=5"], "1 3"], [["-a", "--precision=x", "--precision=-3"], "1 2"], [["--precision=2"], "1"], [["--precision=-1"], "1"],
  [["--average", "--average"], "4"], [["-a", "-a"], "4 5"], [["-A"], ""], [["-"], ""], [["--"], ""], [["-average"], ""], [["--average=yes"], ""],
  [[""], ""], [["."], ""], [[".."], ""], [["/"], ""], [["nums.txt/"], ""], [["nums.txt//"], ""], [[".//nums.txt"], ""], [["nums.txt/."], ""], [["nums.txt/x"], ""],
  [["NUMS.TXT"], ""], [["missing.txt"], ""], [["empty.txt"], ""], [["-a", "empty.txt"], ""], [["big.txt"], ""], [["-a", "big.txt"], ""], [["neg.txt", "-a"], ""],
  [["lines.txt"], ""], [["dec.txt"], ""], [["my file.txt"], ""], [["huge.txt"], ""], [["mixed.txt"], ""], [["nums.txt", "bad.txt"], ""], [["bad.txt", "nums.txt"], ""],
  [["nums.txt", "-x"], ""], [["-x", "nums.txt"], ""], [["nums.txt", "bad.txt", "-x"], ""], [["bad.txt", "--precision=2"], ""], [["-a", "--precision=2", "missing.txt"], ""],
  [["-a", "--precision=3000"], "1 3"], [["-a", "--precision=1999"], "2 3"], [["-a", "--precision=2000"], "1 7"], [["-a", "--precision=17"], "1 3"],
];
const r = ((seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32))(331);
const pick = (a) => a[Math.floor(r() * a.length)];
const ARGS = ["-a", "--average", "--precision=2", "--precision=0", "--precision=5", "--precision=-1", "--precision=x", "--precision=", "--precision=+1",
  "-x", "--help", "-", "nums.txt", "bad.txt", "missing.txt", "empty.txt", "big.txt", "neg.txt", "mixed.txt", ".", "nums.txt/", "", "--precision=2147483648"];
const TOK = () => pick([
  () => String(Math.floor(r() * 200) - 100), () => String(2147483647 - Math.floor(r() * 3)), () => String(-2147483648 + Math.floor(r() * 3)),
  () => String(Math.floor(r() * 2 ** 31)), () => "2147483648", () => pick(["three", "x", "2.5", "1e2", "+7", "-0", "007", "1,234", "12,34", "--1", "4,294,967,296", "١٢"]),
])();
const random = Array.from({ length: 260 }, () => {
  const args = r() < 0.25 ? [] : Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(ARGS));
  const stdin = Array.from({ length: Math.floor(r() * 7) }, TOK).join(pick([" ", "  ", "\n", "\t", " \n "])) + (r() < 0.5 ? "\n" : "");
  return [args, stdin];
});
const cases = [...curated, ...random];
const results = await pool(cases, Math.max(2, Math.min(8, cpus().length)), async ([args, stdin]) => runJava(CP.orig, "Sum", args, stdin, sandbox(FILES)));
cases.forEach(([args, stdin], k) => {
  const sim = S.run(args, { stdin, files: { ...FILES } });
  const real = results[k];
  if (sim.abbreviated) {
    // the simulator shows the start of a very long number; compare that start and the length
    const shown = sim.stdout.replace(/…\n$/, "");
    ok("sum", real.status === 0 && real.stderr === "" && real.stdout.startsWith(shown) && real.stdout.length === sim.abbreviated.length && /^0*\n$/.test(real.stdout.slice(shown.length)),
      `long output for ${JSON.stringify(args)}: java ${real.stdout.length} chars, sim says ${sim.abbreviated.length}`);
  } else compareRun("sum", `Sum ${JSON.stringify(args)} stdin=${JSON.stringify(stdin)}`, real, sim);
});

/* ---------------------------------------------------------------- 2. the two changed copies */
const variantCases = [
  ["noneg", { neg: false }, ["-a", "--precision=-1"], "1 2\n"], ["noneg", { neg: false }, ["-a", "--precision=-12"], "1 2\n"],
  ["noneg", { neg: false }, ["-a", "--precision=-2147483648"], "5\n"], ["noneg", { neg: false }, ["-a", "--precision=-1"], ""],
  ["noneg", { neg: false }, ["--precision=-1"], "1\n"], ["noneg", { neg: false }, ["-a", "--precision=2"], "1 2\n"], ["noneg", { neg: false }, [], "3 4 5\n"],
  ["noneg", { neg: false }, ["-a", "--precision=-1", "bad.txt"], ""],
  ["nocount", { count: false }, ["-a"], ""], ["nocount", { count: false }, ["-a", "--precision=2"], ""], ["nocount", { count: false }, ["-a", "--precision=0"], ""],
  ["nocount", { count: false }, [], ""], ["nocount", { count: false }, ["-a", "empty.txt"], ""], ["nocount", { count: false }, ["-a"], "3 4 5\n"],
  ["nocount", { count: false }, ["-a", "--precision=2147483647"], ""],
];
const vres = await pool(variantCases, 6, async ([v, , args, stdin]) => runJava(CP[v], "Sum", args, stdin, sandbox(FILES)));
variantCases.forEach(([v, chk, args, stdin], k) => compareRun("variants", `${v} ${JSON.stringify(args)} stdin=${JSON.stringify(stdin)}`, vres[k], S.run(args, { stdin, files: { ...FILES }, checks: chk })));

/* ---------------------------------------------------------------- 3. double formatting */
{
  const lines = [];
  const g = ((seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32))(7);
  for (let i = 0; i < 60000; i++) {
    const kind = g();
    const count = kind < 0.5 ? 1 + Math.floor(g() * 12) : kind < 0.8 ? 1 + Math.floor(g() * 1000) : 1 + Math.floor(g() * 5000000);
    const sum = kind < 0.3 ? Math.floor(g() * 200) - 100 : Math.floor((g() * 2 - 1) * 2147483648) * (g() < 0.3 ? Math.floor(g() * count) + 1 : 1);
    lines.push(`${sum} ${count} ${[0, 1, 2, 3, 5, 10, 15, 16, 17, 18, 20, 25, 40][Math.floor(g() * 13)]}`);
  }
  for (const t of ["1 8 2", "-2 5 0", "-1 2 0", "5 2 0", "1 3 30", "1 2000 3", "1 1999 5", "2147483647 1 2", "-2147483648 1 0", "0 5 2", "1 10 1", "3 2 0",
    "-3 2 0", "-5 2 0", "1 1000 3", "1 999 3", "10000000 1 1", "9999999 1 1", "1 3 16", "2 3 16", "2 3 17", "1 7 20", "9223372036854775807 1 3", "-9223372036854775808 3 2",
    "4294967294 2 0", "-4294967296 3 5", "7 2 1", "15 4 1", "25 4 1", "35 4 1", "45 8 2", "1 1 0", "0 1 0", "-1 3 0"]) lines.push(t);
  const out = execFileSync("java", [...JOPTS, "-cp", CP.fmt, "FormatMany"], { input: lines.join("\n") + "\n", encoding: "utf8", maxBuffer: 1 << 28 }).trim().split("\n");
  ok("format", out.length === lines.length, `FormatMany printed ${out.length} lines for ${lines.length}`);
  for (const line of out) {
    const [lhs, ts, fx] = line.split(" | ");
    const [s, c, p] = lhs.split(" ");
    const avg = Number(BigInt(s)) / Number(BigInt(c));
    ok("format", S.javaToString(avg) === ts && S.javaFixed(avg, Number(p)) === fx, `${lhs}: java ${ts} | ${fx}, sim ${S.javaToString(avg)} | ${S.javaFixed(avg, Number(p))}`);
  }
}

/* ---------------------------------------------------------------- 4. real bash vs the simulator's shell */
{
  const binDir = join(work, "bin");
  mkdirSync(binDir);
  // `java` on the shell's PATH runs the real JVM with Sum on the classpath; javac is a no-op that succeeds
  writeFileSync(join(binDir, "javac"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const realJava = execFileSync("sh", ["-c", "command -v java"], { encoding: "utf8" }).trim();
  writeFileSync(join(binDir, "java"), `#!/bin/sh\nexec "${realJava}" ${JOPTS.join(" ")} -cp "${CP.orig}" "$@"\n`, { mode: 0o755 });
  const SESSIONS = [
    ["java Sum nums.txt > total.txt", "echo $?", "cat total.txt"],
    ["java Sum bad.txt > total.txt", "echo $?", "cat total.txt"],
    ["java Sum nums.txt > total.txt; echo $?", "java Sum bad.txt > total.txt; echo $?", "cat total.txt"],
    ["java Sum -a", "echo $?", "echo $?"],
    ["java Sum --help", "echo $?"],
    ["java Sum bad.txt 2> errors.txt", "echo $?", "cat errors.txt"],
    ["java Sum bad.txt > out.txt 2>&1", "cat out.txt", "echo $?"],
    ["java Sum bad.txt 2>&1 > out.txt", "cat out.txt"],
    ["java Sum nums.txt >> log.txt", "java Sum nums.txt >> log.txt", "cat log.txt"],
    ["java Sum < nums.txt", "java Sum -a < nums.txt", "java Sum < bad.txt", "echo $?"],
    ["java Sum nums.txt && echo ok", "java Sum bad.txt && echo ok", "java Sum bad.txt || echo failed"],
    ["cat nums.txt | java Sum", "cat bad.txt | java Sum -a", "echo $?"],
    ["java Sum nums.txt | java Sum -a", "java Sum bad.txt | java Sum", "echo $?"],
    ["echo 1 2 3 | java Sum -a --precision=2", "echo $?"],
    ["java Sum missing.txt", "echo $?", "ls"],
    ["java Sum nums.txt > nums.txt", "cat nums.txt", "java Sum nums.txt", "echo $?"],
    ["java Sum . ", "java Sum nums.txt/x", "java Sum nums.txt/", "echo $?"],
    ["java Sum 'my file.txt'", "java Sum my file.txt", "echo $?"],
    ["java Sum -a --precision=-1 < nums.txt", "echo $?", "java Sum -a --precision=2 < nums.txt"],
    ["rm total.txt", "echo $?", "java Sum nums.txt > total.txt", "rm total.txt", "ls", "cat total.txt", "echo $?"],
    ["frobnicate", "echo $?", "echo $?"],
    ["java Sum -a 2> /dev/null", "echo $?"],
    ["echo \"a $? b\"", "echo 'a $? b'", "echo $HOME$?"],
    ["java Sum *.txt", "echo $?"],
    ["echo -n 5 6 | java Sum", "echo 7 > n.txt", "java Sum n.txt"],
    ["javac Sum.java", "echo $?", "java Sum nums.txt; java Sum bad.txt; echo $?"],
  ];
  // /dev/null is a real device; the simulator has no devices, so that session is compared only on what it prints to the terminal before it
  const files = { "nums.txt": "3 4 5\n", "bad.txt": "3 x\n", "my file.txt": "10 20\n" };
  let compared = 0;
  for (const session of SESSIONS) {
    if (session.some((l) => l.includes("/dev/null"))) continue;
    const cwd = sandbox(files);
    const sh = S.createShell({ files: { ...files } });
    let last = 0; // each bash -c starts fresh, so seed $? with the previous line's status
    for (const line of session) {
      const sim = sh.exec(line, "");
      const real = spawnSync("bash", ["--noprofile", "--norc", "-c", `cd "${cwd}"; (exit ${last}); ${line}`], { encoding: "utf8", env: { PATH: `${binDir}:/usr/bin:/bin`, LANG: "C.UTF-8" }, input: "" });
      const simOut = sim.entries.filter((e) => e.kind === "out").map((e) => `${e.text}\n`).join("");
      const simErr = sim.entries.filter((e) => e.kind === "err").map((e) => `${e.text}\n`).join("");
      const realErr = real.stderr.replace(/^bash: line \d+: /gm, "bash: ");
      ok("shell", real.stdout === simOut && realErr === simErr && real.status === sim.status,
        `bash: ${line}\n  bash: ${JSON.stringify({ out: real.stdout, err: realErr, status: real.status })}\n  sim:  ${JSON.stringify({ out: simOut, err: simErr, status: sim.status })}`);
      last = real.status;
      compared++;
    }
    // the working directory ends up the same
    const realFiles = Object.fromEntries(readdirSync(cwd).map((f) => [f, readFileSync(join(cwd, f), "utf8")]));
    ok("shell", JSON.stringify(Object.keys(realFiles).sort()) === JSON.stringify(Object.keys(sh.files).sort()) && Object.keys(realFiles).every((f) => realFiles[f] === sh.files[f]),
      `files after ${JSON.stringify(session)}: bash ${JSON.stringify(realFiles)} vs sim ${JSON.stringify(sh.files)}`);
  }
  console.log(`shell: ${compared} lines compared with real bash`);
}

/* ---------------------------------------------------------------- 5. Lecture 1's Sum */
for (const stdin of ["3 4 5", "1 2 three 4", "2147483647 1", "", "2147483648", "-2147483648 -1", "1,000 2", "5 6\n7"]) {
  const real = await runJava(CP.l1, "Lecture1Sum", [], stdin, sandbox({}));
  const sim = S.runLecture1(stdin);
  ok("lecture1", real.stdout === sim.stdout && real.status === 0, `Lecture 1 Sum on ${JSON.stringify(stdin)}: ${JSON.stringify(real.stdout)} vs ${JSON.stringify(sim.stdout)}`);
}

/* ---------------------------------------------------------------- 6. out of memory */
{
  const args = ["-a", "--precision=2147483647"];
  const real = await runJava(CP.orig, "Sum", args, "1\n", sandbox(FILES));
  compareRun("oom", "Sum -a --precision=2147483647 on 1 (the notes' footnote)", real, S.run(args, { stdin: "1\n" }));
  ok("oom", real.stderr.split("\n").slice(1).join("\n").trim() === S.run(args, { stdin: "1\n" }).stderr.split("\n").slice(1).join("\n").trim(), "OOM trace frames match this JDK exactly");
  if (process.env.FULL) {
    for (const [p, stdin] of [[2147483637, "1"], [2147483638, "1"], [2147483635, "-12"], [2147483632, "123456"], [2147483633, "123456"]]) {
      const a = ["-a", `--precision=${p}`];
      const rr = await runJava(CP.orig, "Sum", a, stdin, sandbox(FILES), { countOnly: true });
      const sim = S.run(a, { stdin });
      if (sim.abbreviated) ok("oom", rr.status === 0 && rr.length === sim.abbreviated.length && rr.zerosAfter && rr.stdout.startsWith(sim.stdout.replace(/…\n$/, "").slice(0, 60)), `p=${p} prints ${rr.length} chars (sim ${sim.abbreviated.length})`);
      else compareRun("oom", `p=${p} on ${stdin}`, rr, sim);
    }
  }
}


/* ---------------------------------------------------------------- 7. Wed-Fri practice keys (Section 1, Lectures 4 and 5)
   Every answer key added for Section 1, Testing and Coverage is recomputed here by running ports of the course's own
   code and specs (exhaustive over small arrays), then compared with the key in site/cse331/w02/index.html. */
{
  const html = readFileSync(join(here, "../../../site/cse331/w02/index.html"), "utf8");
  const attr = (tag, name) => { const m = new RegExp(`${name}="([^"]*)"`).exec(tag); return m ? m[1] : undefined; };
  const keyOf = (tid, part) => { const at = html.indexOf(`data-id="${tid}"`); const m = new RegExp(`<div class="answer-spec" data-part="${part}"[^>]*>`).exec(html.slice(at)); return m ? attr(m[0], "data-answer") : undefined; };
  const quizKey = (qid) => { const at = html.indexOf(`data-id="${qid}"`); const tag = html.slice(at, html.indexOf(">", at)); return attr(tag, "data-answer"); };
  const arrays = (len, vals) => { const out = []; const rec = (p) => { if (p.length === len) { out.push(p); return; } for (const v of vals) rec([...p, v]); }; rec([]); return out; };
  const smallArrays = []; for (let len = 0; len <= 4; len++) smallArrays.push(...arrays(len, [0, 1, 2]));
  const sorted = (v) => [...v].sort().join();

  // removeValue: four implementations, four specs (Section 1, Task 2)
  const IMPL = {
    1: (a, n, x) => { let w = 0; for (let r = 0; r < n; r++) if (a[r] !== x) { a[w] = a[r]; w++; } return w; },
    2: (a, n, x) => { for (let i = 0; i < n; i++) if (a[i] === x) { for (let k = i; k < n - 1; k++) a[k] = a[k + 1]; return n - 1; } return n; },
    3: (a, n, x) => { for (let i = n - 1; i >= 0; i--) if (a[i] === x) { for (let k = i; k < n - 1; k++) a[k] = a[k + 1]; return n - 1; } return n; },
    4: (a, n, x) => { for (let i = 0; i < n; i++) if (a[i] === x) { a[i] = a[n - 1]; return n - 1; } return n; },
  };
  const A = (old, n, x, nw, ret) => { const i = old.slice(0, n).indexOf(x); if (i < 0) return ret === n && nw.join() === old.join(); const e = [...old.slice(0, i), ...old.slice(i + 1, n)]; return ret === n - 1 && nw.slice(0, n - 1).join() === e.join() && nw.slice(n).join() === old.slice(n).join(); };
  const RS = {
    A: { pre: () => true, ok: A },
    B: { pre: () => true, ok: (old, n, x, nw, ret) => { const i = old.slice(0, n).indexOf(x); if (i < 0) return ret === n && nw.join() === old.join(); const rest = [...old.slice(0, i), ...old.slice(i + 1, n)]; return ret === n - 1 && sorted(nw.slice(0, n - 1)) === sorted(rest) && nw.slice(n).join() === old.slice(n).join(); } },
    C: { pre: () => true, ok: (old, n, x, nw, ret) => { const rest = old.slice(0, n).filter((v) => v !== x); return ret === rest.length && nw.slice(0, rest.length).join() === rest.join() && nw.slice(n).join() === old.slice(n).join(); } },
    D: { pre: (old, n) => new Set(old.slice(0, n)).size === n, ok: A },
  };
  const meets = (impl, spec) => { for (const a of smallArrays) for (let n = 0; n <= a.length; n++) for (let x = 0; x <= 3; x++) { if (!RS[spec].pre(a, n, x)) continue; const nw = [...a]; const ret = IMPL[impl](nw, n, x); if (!RS[spec].ok(a, n, x, nw, ret)) return false; } return true; };
  const setOf = (impl) => "ABCD".split("").filter((s) => meets(impl, s)).join("");
  for (const i of [1, 2, 3, 4]) ok("practice", keyOf("cse331-w2-s1-which-specs", `impl${i}`) === setOf(i), `Section 1 which-specs impl ${i}: key ${keyOf("cse331-w2-s1-which-specs", `impl${i}`)} vs run ${setOf(i)}`);
  { const tr = (i) => { const a = [4, 8, 4, 6]; const r = IMPL[i](a, 4, 4); return { r, a }; };
    ok("practice", String(tr(1).r) === keyOf("cse331-w2-s1-run-impls", "impl1-return") && String(tr(1).a[0]) === keyOf("cse331-w2-s1-run-impls", "impl1-first") && String(tr(3).a[0]) === keyOf("cse331-w2-s1-run-impls", "impl3-first") && String(tr(4).a[0]) === keyOf("cse331-w2-s1-run-impls", "impl4-first"), "Section 1 run-impls traces"); }

  // spec strength, by enumeration of every possible implementation behavior on small inputs
  const outs = (len) => arrays(len, [0, 1, 2, 3]);
  const allowedOf = (spec, inp) => { const r = []; for (let ret = 0; ret <= inp.n; ret++) for (const nw of outs(inp.a.length)) if (RS[spec].ok(inp.a, inp.n, inp.x, nw, ret)) r.push(nw.join() + "|" + ret); return new Set(r); };
  const inputs = []; for (const a of arrays(3, [0, 1, 2]).concat(arrays(2, [0, 1, 2]), arrays(4, [0, 1])))
    for (let n = 0; n <= a.length; n++) for (let x = 0; x <= 2; x++) inputs.push({ a, n, x });
  const stronger = (s1, s2) => inputs.every((i) => !RS[s2].pre(i.a, i.n) || (RS[s1].pre(i.a, i.n) && [...allowedOf(s1, i)].every((o) => allowedOf(s2, i).has(o))));
  const rel = (x, y) => (stronger(x, y) && stronger(y, x) ? "same" : stronger(x, y) ? "stronger" : stronger(y, x) ? "weaker" : "incomparable");
  for (const [part, x, y] of [["a-b", "A", "B"], ["a-c", "A", "C"], ["c-d", "C", "D"], ["b-d", "B", "D"]])
    ok("practice", keyOf("cse331-w2-s1-removevalue-strength", part) === rel(x, y), `removeValue ${x} vs ${y}: key ${keyOf("cse331-w2-s1-removevalue-strength", part)} vs enumerated ${rel(x, y)}`);

  // indexOf: the lecture's tests and the `i <= hi` mistake
  const matches = (a, lo, hi, x) => { const r = []; for (let i = lo; i < hi; i++) if (a[i] === x) r.push(i); return r; };
  const buggy = (a, lo, hi, x) => { for (let i = lo; i <= hi; i++) { if (i >= a.length) return "throw"; if (a[i] === x) return i; } return -1; };
  const rows = { A: [[3, 0, 7], 0, 3, 7], B: [[3, 0, 7], 0, 3, 42], C: [[5, 1, 5, 2, 5], 0, 5, 5], D: [[3, 0, 7], 1, 1, 0], E: [[], 0, 0, 3], F: [[7, 0, 3], 0, 3, 7], G: [[7, 0, 3], 1, 3, 7], H: [[3, 0, 7], 0, 2, 7] };
  const failing = Object.entries(rows).filter(([, [a, lo, hi, x]]) => { const m = matches(a, lo, hi, x); const want = (r) => (m.length ? m.includes(r) : r === -1); return !want(buggy(a, lo, hi, x)); }).map(([k]) => k).join("");
  ok("practice", keyOf("cse331-w2-l4-boundary-hunt", "failing-rows") === failing, `boundary hunt: key ${keyOf("cse331-w2-l4-boundary-hunt", "failing-rows")} vs run ${failing}`);
  { // which of the four tests are specification-based under B, C, D: passes every outcome the spec allows
    const specOk = { B: (m, r) => (m.length ? r === m[0] : r === -1), C: (m, r) => (m.length ? r === m[m.length - 1] : r === -1), D: (m, r) => (m.length ? m.includes(r) : r === -1) };
    const tests = { A: [[3, 0, 7], 0, 3, 7, (r) => r === 2], B: [[3, 0, 7], 0, 3, 42, (r) => r === -1], C: [[5, 1, 5, 2, 5], 0, 5, 5, (r) => r === 0], D: [[5, 1, 5, 2, 5], 0, 5, 5, (r, a) => r >= 0 && r < 5 && a[r] === 5] };
    for (const [sp, part] of [["B", "under-b"], ["C", "under-c"], ["D", "under-d"]]) {
      const got = Object.entries(tests).filter(([, [a, lo, hi, x, t]]) => { const m = matches(a, lo, hi, x); const al = [-1, ...Array.from({ length: hi - lo }, (_, i) => lo + i)].filter((r) => specOk[sp](m, r)); return al.every((r) => t(r, a)); }).map(([k]) => k).join("");
      ok("practice", keyOf("cse331-w2-l4-spec-based-which", part) === got, `spec-based under ${sp}: key ${keyOf("cse331-w2-l4-spec-based-which", part)} vs run ${got}`);
    }
    ok("practice", keyOf("cse331-w2-l4-spec-based-which", "c-expects") === String(matches([5, 1, 5, 2, 5], 0, 5, 5).pop()), "C's largest index is 4");
  }
  { const aa = [3, 0, 7]; const impl1 = (a, lo, hi, x) => { for (let i = lo; i < hi; i++) if (a[i] === x) return i; return -1; }; const impl4 = (a, lo, hi, x) => { for (let i = hi - 1; i >= lo; i--) { if (i >= a.length) return "throw"; if (a[i] === x) return i; } return -1; };
    ok("practice", keyOf("cse331-w2-l4-break-precondition", "impl1") === String(impl1(aa, 0, 4, 7)) && impl4(aa, 0, 4, 7) === "throw" && keyOf("cse331-w2-l4-break-precondition", "impl4") === "yes" && keyOf("cse331-w2-l4-break-precondition", "promises") === "no", "precondition-breaking call: impl 1 returns 2, impl 4 throws, D promises nothing"); }

  // Lecture 5: faulty methods, isPrime loop counts, count with two indexOf implementations
  const minF = (a, b) => { let r = a; if (a <= b) r = a; return r; };
  const quad = (x, y) => { let q = 1; if (x < 0) q = 2; if (y < 0) q = q + 1; return q; };
  const powF = (b, n) => { let r = 1; for (let i = 0; i < n; i++) r = b; return r; };
  const powRec = (b, n) => { if (n === 0) return 1; powRec(b, n - 1); return b; };
  ok("practice", [minF(2, 1), quad(1, -1), powF(3, 2), powRec(2, 3)].map(String).join() === ["min", "quadrant", "pow", "powrec"].map((p) => keyOf("cse331-w2-l5-find-the-mistake", p)).join(), "Lecture 5 faulty methods");
  const smallP = (n) => { if (n < 2) return false; for (let k = 2; k * k <= n; k++) if (n % k === 0) return false; return true; };
  const badP = (n) => { let runs = 0; if (n < 100) return [smallP(n), 0]; for (let k = 2; k * k < n; k++) { runs++; if (n % k === 0) return [false, runs]; } return [true, runs]; };
  const wrong = Object.entries({ A: 100, B: 121, C: 143, D: 169, E: 289 }).filter(([, n]) => badP(n)[0] !== smallP(n)).map(([k]) => k).join("");
  ok("practice", keyOf("cse331-w2-l5-isprime", "wrong") === wrong && keyOf("cse331-w2-l5-isprime", "runs-10007") === String(badP(10007)[1]) && keyOf("cse331-w2-l5-isprime", "runs-100") === String(badP(100)[1]), `isPrime: wrong ${wrong}, runs ${badP(10007)[1]} / ${badP(100)[1]}`);
  { let first = null; for (let n = 1; n < 1000 && first === null; n++) if (badP(n)[0] !== smallP(n)) first = n; ok("practice", quizKey("cse331-w2-q2-first-bad-prime") === String(first), `first wrong isPrime input ${first}`); }
  { const front = (a, lo, hi, x) => { for (let i = lo; i < hi; i++) if (a[i] === x) return i; return -1; };
    const back = (a, lo, hi, x) => { for (let i = hi - 1; i >= lo; i--) if (a[i] === x) return i; return -1; };
    const count = (f, a, x) => { let body = 0, i = f(a, 0, a.length, x); while (i !== -1) { body++; i = f(a, i + 1, a.length, x); } return body; };
    ok("practice", keyOf("cse331-w2-l5-count-impls", "front") === String(count(front, [5, 1, 5, 2, 5], 5)) && keyOf("cse331-w2-l5-count-impls", "front-body") === String(count(front, [5, 1, 5, 2, 5], 5)) && keyOf("cse331-w2-l5-count-impls", "back") === String(count(back, [5, 1, 5, 2, 5], 5)), `count: front ${count(front, [5, 1, 5, 2, 5], 5)}, back ${count(back, [5, 1, 5, 2, 5], 5)}`); }
  { // sumUpTo: each test fixes n and so runs the body exactly n times; loop coverage needs counts 0, 1 and more than 1
    const body = (n) => { let c = 0; for (let i = 1; i <= n; i++) c++; return c; };
    ok("practice", keyOf("cse331-w2-l5-plan-tests", "fewest") === "3" && body(0) === 0 && body(1) === 1 && body(3) > 1, "sumUpTo needs three tests (0, 1, many body runs)"); }
  ok("practice", quizKey("cse331-w2-q2-fewest-tests") === "2", "two tests are the least");
  { // Section 1 slides: square-root specs S1-S3, compared by enumerating every outcome on small inputs
    const OUT = [...Array.from({ length: 11 }, (_, i) => i - 5), "throw"];
    const SQ = {
      S1: { pre: (x) => x >= 0, ok: (x, y) => y !== "throw" && y * y === x },
      S2: { pre: (x) => x >= 0, ok: (x, y) => y !== "throw" && y * y === x && y >= 0 },
      S3: { pre: () => true, ok: (x, y) => (x < 0 ? y === "throw" : y !== "throw" && y * y === x && y >= 0) },
    };
    const xs = Array.from({ length: 30 }, (_, i) => i - 5);
    const st = (a, b) => xs.every((x) => !SQ[b].pre(x) || (SQ[a].pre(x) && OUT.every((y) => !SQ[a].ok(x, y) || SQ[b].ok(x, y))));
    const rel = (a, b) => (st(a, b) && st(b, a) ? "same" : st(a, b) ? "stronger" : st(b, a) ? "weaker" : "incomparable");
    const meets = ["S1", "S2", "S3"].filter((s) => SQ[s].ok(4, -2));
    ok("practice", keyOf("cse331-w2-s1-sqrt-specs", "s2-s1") === rel("S2", "S1") && keyOf("cse331-w2-s1-sqrt-specs", "s3-s2") === rel("S3", "S2") && keyOf("cse331-w2-s1-sqrt-specs", "minus-two") === (meets.join() === "S1" ? "s1" : meets.join()), `sqrt specs: S2/S1 ${rel("S2", "S1")}, S3/S2 ${rel("S3", "S2")}, -2 meets ${meets}`);
    const qcAt = html.indexOf('data-id="cse331-w2-s1-qc-sqrt"'); ok("practice", attr(html.slice(qcAt, html.indexOf(">", qcAt)), "data-answer") === rel("S2", "S1"), "sqrt quick check");
  }
  console.log(`practice keys: ${counts.practice} checks`);
}

rmSync(work, { recursive: true, force: true });
console.log(`groups: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`${checks - fails}/${checks} checks match real Java and bash`);
process.exit(fails ? 1 : 0);
