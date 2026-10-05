// Unit tests: the grader (exact integers and exact program output, no tolerance; misconception feedback that
// never leaks the answer), every answer key that comes from running code (against the Java-verified simulator),
// the sorter's keys against the manual, the store (attempt history, retry/backoff, conflict merge, schema
// checks, edit invalidation) with the mock adapter, and the simulator's shell.
// Usage: node tests/unit.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const req = createRequire(import.meta.url);
const G = req("../site/js/grader.js");
const S = req("../site/js/sum-sim.js");
const CS = req("../site/js/store.js");
const Mock = req("../examples/mock-adapter.js");
globalThis.self = globalThis;
req("../site/js/keys.js");
const KEYS = globalThis.ANSWER_KEYS;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("FAIL:", msg); } };
const st = (spec, raw) => G.grade(spec, raw).status;

/* ---------------------------------------------------------------- exact integers */
const I = (a) => ({ type: "int", answer: a });
ok(st(I("-2147483648"), "-2147483648") === "correct", "INT_MIN exact");
ok(st(I("-2147483648"), "-2147483647") === "incorrect", "INT_MIN vs INT_MIN+1 rejected");
ok(st(I("2147483648"), "2147483647") === "incorrect", "2^31 vs INT_MAX rejected");
ok(st(I("9007199254740993"), "9007199254740992") === "incorrect", "2^53+1 vs 2^53 rejected (a float would merge them)");
ok(st(I("1"), "1.0") === "unreadable" && st(I("1"), "1e0") === "unreadable" && st(I("1"), "one") === "unreadable", "1.0, 1e0, one unreadable");
ok(st(I("0"), "-0") === "correct" && st(I("78"), "+78") === "correct" && st(I("1"), "01") === "correct", "-0, +78, 01");
ok(st(I("-2147483648"), "−2,147,483,648") === "correct", "unicode minus and commas");
ok(!/tolerance|1e-9|Math\.abs\(/.test(readFileSync(new URL("../site/js/grader.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")), "grader has no tolerance comparison");

/* ---------------------------------------------------------------- exact output */
const O = (a) => ({ type: "output", answer: a });
ok(st(O("Sum: not an integer: three"), "Sum: not an integer: three") === "correct", "output exact");
ok(st(O("Sum: not an integer: three"), "  Sum: not an integer: three  ") === "correct", "output: ends trimmed");
ok(st(O("Sum: not an integer: three"), '"Sum: not an integer: three"') === "correct", "output: one pair of quotes dropped");
ok(st(O("Sum: not an integer: three"), "sum: not an integer: three") === "incorrect", "output: case matters");
ok(G.grade(O("Sum: not an integer: three"), "sum: not an integer: three").feedbackKind === "output-near-miss", "output: case near-miss is named");
ok(st(O("Sum: not an integer: three"), "Sum:  not an integer: three") === "incorrect", "output: inner spacing matters");
ok(st(O("2.5"), "2.50") === "incorrect" && st(O("4.0"), "4") === "incorrect", "output: 2.50 ≠ 2.5, 4 ≠ 4.0");
ok(st(O(""), "nothing") === "correct" && st(O(""), "(nothing)") === "correct" && st(O(""), "empty") === "correct", "output: nothing / (nothing) / empty");
ok(st(O(""), "") === "unreadable", "output: blank box is unreadable, not 'nothing'");
ok(st(O("12"), "$ 12") === "correct", "output: a leading prompt is not output");
ok(st({ type: "stream", answer: "stderr" }, "System.err") === "correct" && st({ type: "stream", answer: "stderr" }, "standard output") === "incorrect" && st({ type: "stream", answer: "stderr" }, "the file") === "unreadable", "stream");
ok(st({ type: "letters", allowed: "ABCDEFG", answer: "CG" }, "G and C") === "correct" && st({ type: "letters", allowed: "ABCDEFG", answer: "CG" }, "H") === "unreadable", "letters");
ok(st({ type: "strength", answer: "stronger" }, "M1 is stronger") === "correct", "strength");

/* ---------------------------------------------------------------- misconception feedback: fires, never leaks */
for (const [id, key] of Object.entries(KEYS)) {
  if (key.type !== "choice") {
    const first = String(key.answer).split("|")[0];
    const sample = key.type === "output" && first === "" ? "nothing" : key.type === "stream" ? (first === "stderr" ? "standard error" : "standard output") : first;
    ok(G.grade(key, sample).status === "correct", `${id}: its own key grades correct (${JSON.stringify(sample)})`);
  }
  for (const m of key.misconceptions || []) {
    const w = String(m.when).split("|")[0];
    const sample = key.type === "output" && w === "" ? "nothing" : key.type === "stream" ? (w === "stderr" ? "standard error" : "standard output") : w;
    const g = G.grade(key, sample);
    ok(g.status === "incorrect" && g.feedbackKind === m.kind, `${id}: misconception "${m.kind}" fires on ${JSON.stringify(sample)} (${g.status}/${g.feedbackKind})`);
    for (const ans of String(key.answer).split("|").filter((a) => a.length >= 3)) {
      ok(!g.message.toLowerCase().includes(ans.toLowerCase()), `${id}: feedback for "${m.kind}" doesn't contain the answer "${ans}"`);
    }
  }
}
// numeric answers: the feedback for a misconception never contains the right number
for (const [id, key] of Object.entries(KEYS)) {
  if (key.type !== "int") continue;
  for (const m of key.misconceptions || []) ok(!new RegExp(`(^|[^\\d])${key.answer}([^\\d]|$)`).test(m.message), `${id}: misconception message doesn't contain ${key.answer}`);
}

/* ---------------------------------------------------------------- keys that come from running code */
const run = (args, stdin = "", checks) => S.run(args, { stdin, checks });
const line1 = (t) => t.replace(/\n$/, "").split("\n")[0];
const K = (id) => String(KEYS[id].answer).split("|")[0];
ok(K("cse331-w2-l3-qc-average-of-four") === line1(run(["-a"], "1 2 3 4").stdout), "qc average of 1 2 3 4");
{
  const sh = S.createShell(); sh.exec("java Sum bad.txt > total.txt");
  ok(K("cse331-w2-l3-qc-status-after-bad") === sh.exec("echo $?").entries.find((e) => e.kind === "out").text, "qc status after bad.txt");
}
ok(run(["-a"], "").stderr.startsWith("Sum: cannot average") && K("cse331-w2-l3-qc-message-stream") === "stderr", "qc message stream");
ok(SRC_LINE(61).includes("hasNextInt") && K("cse331-w2-l3-qc-hasnextint-line") === "61", "qc line 61 is hasNextInt");
ok(K("cse331-w2-l3-qc-nan-status") === String(run(["-a"], "", { count: false }).status) && run(["-a"], "", { count: false }).stdout === "NaN\n", "qc NaN status (copy without 73-75)");
{
  const files = { "nums.txt": "3 4 5\n", "bad.txt": "3 x\n" };
  const r = S.run(["-a", "--precision=-1", "bad.txt"], { files });
  ok(K("cse331-w2-l3-qc-negative-before-input") === (r.source ? "yes" : "no") && r.endLine === 41, "qc negative precision stops before bad.txt is read");
}
ok(K("cse331-w2-l3-quiz-two-files-status") === String(run(["nums.txt", "bad.txt"]).status) && run(["nums.txt", "bad.txt"]).stderr === "Sum: too many file arguments: bad.txt\n", "quiz two files status");
ok(run(["--precision=2", "nums.txt"]).stderr === "Sum: --precision is only allowed with -a/--average\n" && run(["--precision=2", "nums.txt"]).status === 1 && KEYS["cse331-w2-l3-quiz-precision-without-a"].answer === "stderr-message-status-1", "quiz precision without -a");
ok(run(["-a", "--precision=-1"], "1 2", { neg: false }).status === Number(K("cse331-w2-l3-quiz-stack-trace-status")), "quiz stack trace status = 1 (from a real stack trace run)");
{
  const sh = S.createShell(); const r = sh.exec("java Sum bad.txt > total.txt");
  ok(KEYS["cse331-w2-l3-quiz-redirect-bad"].answer === "message-shows-file-empty" && r.entries.some((e) => e.kind === "err" && e.text === "Sum: not an integer: x") && sh.files["total.txt"] === "", "quiz redirect bad.txt: message on terminal, file empty");
}
{
  const sh = S.createShell({ checks: { count: false } }); const r = sh.exec("java Sum -a", "");
  ok(KEYS["cse331-w2-l3-quiz-nan-worse"].answer === "status-zero-success" && r.status === 0, "quiz NaN reports success");
}
// problems
const w1 = run([], "1 2 three 4"), w2 = run([], "2147483647 1");
ok(K("cse331-w2-l3-predict-lecture1-runs.word-output") === line1(w1.stderr) && w1.stdout === "", "p1 word output (stderr)");
ok(K("cse331-w2-l3-predict-lecture1-runs.big-output") === line1(w2.stdout) && w2.stderr === "", "p1 big output (stdout)");
{
  const sh = S.createShell();
  const a = sh.exec("java Sum nums.txt > total.txt"); const f1 = sh.files["total.txt"]; const s1 = sh.exec("echo $?").entries.find((e) => e.kind === "out").text;
  const b = sh.exec("java Sum bad.txt > total.txt"); const f2 = sh.files["total.txt"]; const s2 = sh.exec("echo $?").entries.find((e) => e.kind === "out").text;
  const term = (r) => r.entries.filter((e) => e.kind === "out" || e.kind === "err").map((e) => e.text).join("\n");
  ok(K("cse331-w2-l3-predict-redirect.good-terminal") === term(a) && K("cse331-w2-l3-predict-redirect.good-file") === f1.trim() && K("cse331-w2-l3-predict-redirect.good-status") === s1, "p2 run 1");
  ok(K("cse331-w2-l3-predict-redirect.bad-terminal") === term(b) && K("cse331-w2-l3-predict-redirect.bad-file") === f2 && K("cse331-w2-l3-predict-redirect.bad-status") === s2, "p2 run 2");
}
{
  const r = run(["-a", "--precision=-1"], "1 2", { neg: false });
  ok(r.stderr.includes(K("cse331-w2-l3-predict-no-negative-check.exception")) && r.stderr.includes(`Sum.java:${K("cse331-w2-l3-predict-no-negative-check.line")})`) && String(r.status) === K("cse331-w2-l3-predict-no-negative-check.status"), "p3 exception, line, status");
  ok(`%.${-1}f%n` === K("cse331-w2-l3-predict-no-negative-check.format"), "p3 format string");
}
ok(K("cse331-w2-l3-repair-manual.error-status") === "1" && ["--bogus", "--precision=x", "two", "--precision=2"].every((a, i) => run(i === 2 ? ["nums.txt", "bad.txt"] : i === 3 ? ["--precision=2"] : ["-a", a]).status === 1), "p5 every mistake exits 1");
ok(K("cse331-w2-l3-repair-manual.smallest-int") === line1(run([], "-2147483648").stdout) && run([], "-2147483649").status === 1, "p5 smallest int accepted, one less refused");
ok(K("cse331-w2-l3-repair-manual.empty-sum") === line1(run([], "").stdout), "p5 empty sum");
ok(K("cse331-w2-l3-misleading-message.dashes-missing") === line1(S.run(["precision=4", "nums.txt"], { files: S.DEFAULT_FILES() }).stderr), "p6 dashes missing");
ok(K("cse331-w2-l3-misleading-message.precision-too-big") === line1(run(["-a", "--precision=2147483648"]).stderr), "p6 precision too big");
ok(run(["--help"]).stderr === "Sum: unknown option: --help\n" && run(["--help"]).status === 1, "p9 --help today is an unknown option");
ok(run(["-a", "--precision=2147483647"], "1").how === "exception" && run(["-a", "--precision=2147483647"], "").stderr === "Sum: cannot average zero values\n", "huge precision: stack trace with numbers, message without");

/* ---------------------------------------------------------------- sorter keys against the manual */
{
  const r = (args, stdin) => S.run(args, { stdin, files: S.DEFAULT_FILES() });
  ok(r(["nums.txt"], "").stdout === "12\n" && KEYS["cse331-w2-l3-sort-file-sum"].answer === "described", "sort file sum");
  ok(r(["-a", "--precision=2"], "1 2\n").stdout === "1.50\n" && KEYS["cse331-w2-l3-sort-average-two-decimals"].answer === "described", "sort precision");
  ok(r([], "2147483648\n").stderr === "Sum: not an integer: 2147483648\n" && KEYS["cse331-w2-l3-sort-too-big-integer"].answer === "contradicted", "sort too big");
  ok(r([], "").stdout === "0\n" && KEYS["cse331-w2-l3-sort-empty-sum"].answer === "described", "sort empty sum");
  ok(r(["-a"], "").status === 1 && KEYS["cse331-w2-l3-sort-empty-average"].answer === "silent", "sort empty average");
  const manual = readFileSync(new URL("./java/Sum.java", import.meta.url), "utf8").split("\n").slice(4, 19).join("\n");
  ok(!/status|exit|error|message|help|zero|empty/i.test(manual), "the manual (lines 5-19) mentions no status, error, message, help or empty input: the silent cards are silent");
}

/* ---------------------------------------------------------------- simulator details */
ok(S.javaParseInt("٣") === 3 && S.javaParseInt("+5") === 5 && S.javaParseInt("") === null && S.javaParseInt("2147483648") === null && S.javaParseInt("-2147483648") === -2147483648, "parseInt");
ok(S.scannerInt("1,000") === 1000n && S.scannerInt("1,0000") === null && S.scannerInt("0,123") === null && S.scannerInt("١٢") === 12n, "scanner ints");
ok(S.javaToString(4) === "4.0" && S.javaToString(1e7) === "1.0E7" && S.javaToString(5e-4) === "5.0E-4" && S.javaToString(0.001) === "0.001" && S.javaToString(NaN) === "NaN", "Double.toString");
ok(S.javaFixed(2.5, 0) === "3" && S.javaFixed(-0.5, 0) === "-1" && S.javaFixed(-0.4, 0) === "-0" && S.javaFixed(1 / 3, 30) === "0.333333333333333300000000000000", "printf %.Nf HALF_UP on shortest digits");
{
  const sh = S.createShell();
  const r = sh.exec("java Sum bad.txt 2>&1 | cat");
  ok(r.entries.some((e) => e.kind === "out" && e.text === "Sum: not an integer: x"), "2>&1 into a pipe arrives as standard output of cat");
  ok(sh.exec("echo $?; false_cmd; echo $?").entries.filter((e) => e.kind === "out").map((e) => e.text).join(",") === "0,127", "$? is expanded per command");
  ok(sh.exec("echo 'unterminated").entries.some((e) => e.kind === "err" && /unexpected EOF/.test(e.text)), "unterminated quote is a bash error");
}

/* ---------------------------------------------------------------- store */
function memStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; }
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function settle(s, ms = 400) { const end = Date.now() + ms; while (Date.now() < end) { await tick(5); if (!s.pending().length && s.stats().loaded) return; } }
const mkStore = (adapter, storage = memStorage(), extra = {}) => CS.create({ adapter, storage, debounceMs: 5, retryBaseMs: 10, retryMaxMs: 40, ...extra });
ok(CS.SITE_ID === "cse331-26au-week2" && CS.SCHEMA_VERSION === 1 && CS.MIRROR_KEY === "cse331-26au-week2:v1:mirror", "site id, schema version, mirror key");
{ // rapid repeated checks: distinct, ordered, never coalesced
  const mock = Mock.create(); const s = mkStore(mock); s.start(); await s.ready;
  const a1 = s.attempt("q", { answer: { raw: "1" }, result: { overall: "correct" } });
  const a2 = s.attempt("q", { answer: { raw: "1" }, result: { overall: "correct" } });
  ok(a1.attemptId !== a2.attemptId && a1.seq === 1 && a2.seq === 2, "rapid double attempt: distinct ids, seq 1 and 2");
  await settle(s);
  ok(mock.control.server().attempts.q.length === 2 && mock.control.changes().filter((c) => c.kind === "attempt").length === 2, "server has both attempts, two change records");
}
{ // snapshots coalesce
  const mock = Mock.create(); const s = mkStore(mock); s.start(); await s.ready;
  for (let i = 0; i < 20; i++) s.put("p", { kind: "problem", work: "x".repeat(i) });
  await settle(s);
  ok(mock.control.changes().filter((c) => c.kind === "snapshot").length < 20 && mock.control.server().items.p.work === "x".repeat(19), "typing snapshots coalesce; latest wins");
}
{ // failure then recovery
  const mock = Mock.create(); const notes = []; const storage = memStorage();
  const s = mkStore(mock, storage, { notify: (k) => notes.push(k) }); s.start(); await s.ready;
  mock.control.failNext(3);
  const ids = [];
  for (let i = 0; i < 5; i++) ids.push(s.attempt("q", { answer: { raw: String(i) }, result: { overall: "incorrect" } }).attemptId);
  s.put("p", { kind: "problem", work: "typed during outage" });
  await tick(15);
  ok(notes.includes("save-failed") && JSON.parse(storage.getItem(CS.MIRROR_KEY)).store.items.p.work === "typed during outage", "save-failed notice; text kept in the mirror");
  await settle(s, 2000);
  const delivered = mock.control.changes().filter((c) => c.kind === "attempt").map((c) => c.attempt.attemptId);
  ok(notes.includes("recovered") && delivered.length === 5 && ids.every((id) => delivered.includes(id)), "recovered; every attempt delivered exactly once");
  ok(notes.filter((n) => n === "save-failed").length === 1, "one failure notice per outage");
}
{ // reload resends the outbox
  const storage = memStorage();
  const down = Mock.create(); down.control.failAlways(true);
  const s1 = mkStore(down, storage); s1.start(); await s1.ready;
  s1.attempt("q", { answer: { raw: "7" }, result: { overall: "correct" } });
  await tick(30);
  const up = Mock.create(); const s2 = mkStore(up, storage); s2.start(); await s2.ready; await settle(s2, 1000);
  ok(up.control.server().attempts.q.length === 1, "an attempt made offline is sent after a reload");
}
{ // conflict: union of attempts, dirty local snapshot kept
  const mock = Mock.create(); const notes = [];
  const s = mkStore(mock, memStorage(), { notify: (k) => notes.push(k) }); s.start(); await s.ready;
  const remote = { siteId: CS.SITE_ID, schemaVersion: 1, updatedAt: "2099-01-01T00:00:00.000Z", items: { p: { kind: "problem", work: "remote", updatedAt: "2099-01-01T00:00:00.000Z" }, r: { kind: "quiz", updatedAt: "2099-01-01T00:00:00.000Z" } }, attempts: { q: [{ attemptId: "remote-1", seq: 1, itemId: "q", submittedAt: "2026-10-05T00:00:00.000Z" }] }, events: {} };
  mock.control.conflictNext(remote);
  s.put("p", { kind: "problem", work: "local typing" });
  s.attempt("q", { answer: { raw: "1" }, result: { overall: "correct" } });
  await settle(s, 1500);
  const srv = mock.control.server();
  ok(notes.includes("conflict") && srv.items.p.work === "local typing" && srv.items.r && srv.attempts.q.length === 2, "conflict: local unsent snapshot wins, remote-only item kept, attempts unioned");
  const m2 = CS.merge(s.exportState(), s.exportState());
  ok(JSON.stringify(m2.store.attempts) === JSON.stringify(s.exportState().attempts), "merging a store with itself is a no-op");
}
{ // schema checks
  ok(CS.normalize({ siteId: "cse331-26au-week1", schemaVersion: 2, items: {} }).status === "other-site", "week 1's store is another site's");
  ok(CS.normalize({ siteId: CS.SITE_ID, schemaVersion: 2, items: {} }).status === "unknown-version", "a newer schema is not read");
  ok(CS.normalize([1, 2]).status === "malformed" && CS.normalize(null).status === "empty", "malformed and empty");
  const mock = Mock.create({ initial: { siteId: CS.SITE_ID, schemaVersion: 9, items: { x: { a: 1 } } } }); const notes = [];
  const s = mkStore(mock, memStorage(), { notify: (k, i) => notes.push(`${k}:${i.status || ""}`) }); s.start(); await s.ready;
  s.put("p", { kind: "problem", work: "w" }); await tick(40);
  ok(notes.includes("remote-ignored:unknown-version") && mock.control.server().schemaVersion === 9 && mock.control.changes().length === 0, "newer remote schema: ignored and never overwritten");
  const s2 = mkStore(Mock.create(), memStorage()); s2.start(); await s2.ready;
  s2.put("keep", { kind: "quiz" });
  ok(await s2.importState({ siteId: "other", schemaVersion: 1 }) === "other-site" && s2.get("keep"), "importState refuses another site's data and keeps the store");
}
{ // edit-after-check invalidation
  const q = { kind: "quiz", choiceId: "a", correct: true, normalized: "a", lastMessage: null, done: true, revealed: false, tries: 1, firstTryCorrect: true };
  const r = CS.invalidateCurrentGrade(q);
  ok(r.changed && q.correct === null && q.normalized === null && q.done === false && q.tries === 1 && q.firstTryCorrect === true, "quiz edit clears the grade, keeps history");
  const p = { kind: "problem", parts: { "x.a": { raw: "1", normalized: "1", correct: true } }, result: "correct", selfMark: "got", checks: 2 };
  CS.invalidateCurrentGrade(p, { pid: "x.a", self: false });
  ok(p.parts["x.a"].correct === null && p.result === null && p.selfMark === "got" && p.checks === 2, "auto part edit clears that part and result only");
  CS.invalidateCurrentGrade(p, { pid: "x.b", self: true });
  ok(p.selfMark === null, "self part edit clears selfMark");
}

function SRC_LINE(n) { return readFileSync(new URL("./java/Sum.java", import.meta.url), "utf8").split("\n")[n - 1]; }

console.log(`${pass}/${pass + fail} unit checks pass`);
process.exit(fail ? 1 : 0);
