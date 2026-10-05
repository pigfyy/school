// Unit tests: the grader (exact integers, no tolerance, misconception feedback that never leaks the answer),
// every answer key that comes from running code (against the Java-verified simulators), and the store
// (attempt history, migration, retry/backoff, conflict merge) with the mock adapter.
// Usage: node tests/unit.mjs
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const G = req("../site/js/grader.js");
const SumSim = req("../site/js/sum-sim.js");
const Sim = req("../site/js/spec-sim.js");
const CS = req("../site/js/store.js");
const Mock = req("../examples/mock-adapter.js");
G.useSpecSim(Sim);
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
ok(st(I("2147483647"), "2147483648") === "incorrect", "INT_MAX vs INT_MAX+1 rejected");
ok(st(I("2147483648"), "2147483647") === "incorrect", "true sum vs INT_MAX rejected");
ok(st(I("9223372036854775807"), "9223372036854775806") === "incorrect", "long near-miss rejected (beyond 2^53)");
ok(st(I("9223372036854775807"), "9223372036854775807") === "correct", "LONG_MAX exact");
ok(st(I("-9223372036854775808"), "-9223372036854775808") === "correct", "LONG_MIN exact");
ok(st(I("12345678901234567890123"), "12345678901234567890124") === "incorrect", "huge near-miss rejected");
ok(st(I("9007199254740993"), "9007199254740992") === "incorrect", "2^53+1 vs 2^53 rejected (float would merge them)");
ok(st(I("-2147483648"), "−2,147,483,648") === "correct", "unicode minus and commas");
ok(st(I("2147483648"), "2_147_483_648") === "correct", "underscores");
ok(st(I("0"), "-0") === "correct" && st(I("12"), "+12") === "correct" && st(I("12"), "0012") === "correct", "-0, +12, leading zeros");
for (const bad of ["2147483648.0", "2.147483648e9", "1e3", "0x10", "12abc", "1,00", "", "  ", "twelve", "Infinity", "NaN", "--5"]) ok(st(I("1000"), bad) === "unreadable", `unreadable: ${JSON.stringify(bad)}`);
ok(st(I("1000"), "1,000") === "correct", "1,000 grouped");
ok(G.normalizeInt("-2147483649") === "-2147483649" && G.normalizeInt("007") === "7", "normalized forms are canonical strings");
ok(!/tolerance|1e-9|Math\.abs\(got - want\)/.test(req("node:fs").readFileSync(new URL("../site/js/grader.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")), "grader has no tolerance comparison");

/* ---------------------------------------------------------------- other types */
ok(st({ type: "text", answer: "Got [3, 4, 5]" }, "got [3,4,5]") === "correct", "program output spacing/case");
ok(st({ type: "text", answer: "Got [3, 4, 5]" }, "Got [3, 4]") === "incorrect", "program output near-miss");
ok(st({ type: "yesno", answer: "no" }, "No") === "correct" && st({ type: "yesno", answer: "no" }, "maybe") === "unreadable", "yes/no");
ok(st({ type: "letters", allowed: "ABCD", answer: "ABC" }, "C, A and B") === "correct" && st({ type: "letters", allowed: "ABCD", answer: "ABC" }, "ABCD") === "incorrect", "letters");
ok(st({ type: "letters", allowed: "ABCDE", answer: "" }, "none") === "correct", "letters: none");
ok(st({ type: "strength", answer: "incomparable" }, "neither") === "correct" && st({ type: "strength", answer: "stronger" }, "weaker") === "incorrect", "strength");
ok(st({ type: "set", tokens: ["S1", "S2", "S3"], answer: "" }, "none") === "correct" && st({ type: "set", tokens: ["S1", "S2", "S3"], answer: "S1,S2" }, "S2, s1") === "correct", "set");
ok(st({ type: "set", tokens: ["S1", "S2", "S3"], answer: "S1" }, "S4") === "unreadable", "set: unknown token unreadable");

/* ---------------------------------------------------------------- misconception feedback, no leaks */
for (const [id, key] of Object.entries(KEYS)) {
  for (const m of key.misconceptions || []) {
    const raw0 = String(m.when).split("|")[0];
    const sample = raw0 === "" ? "none" : raw0; // "" means the empty set, typed as "none"
    const g = G.grade(key, sample);
    ok(g.status === "incorrect" && g.feedbackKind === m.kind, `${id}: misconception "${m.kind}" fires on ${JSON.stringify(sample)}`);
    for (const ans of String(key.answer).split("|").filter((a) => a.length >= 2)) {
      ok(!g.message.toLowerCase().includes(ans.toLowerCase()) || /^(B|D|S|W)$/i.test(ans), `${id}: feedback for "${m.kind}" doesn't contain the answer "${ans}"`);
    }
    ok(G.grade(key, sample).status !== "correct", `${id}: misconception value isn't also an answer`);
  }
  if (key.type !== "choice" && key.type !== "witness" && key.answer !== undefined) {
    const first = String(key.answer).split("|")[0];
    ok(G.grade(key, first === "" ? "none" : first).status === "correct", `${id}: its own key grades correct`);
  }
}

/* ---------------------------------------------------------------- answer keys that come from running code */
const sumKey = (id, variant, input, pick) => ok(KEYS[id].answer === String(pick(SumSim.run(variant, input))), `${id} = ${pick(SumSim.run(variant, input))}`);
sumKey("cse331-w1-l1-qc-spec-predicts-sum", "orig", "5 3 three 2147483647 1", (r) => r.printedSum);
sumKey("cse331-w1-l1-qc-list-size-at-point1", "orig", "4 -4 x 9", (r) => r.readCount);
sumKey("cse331-w1-l1-quiz-sum-after-word", "orig", "10 20 x 30", (r) => r.printedSum);
sumKey("cse331-w1-l1-quiz-sum-wraps-down", "orig", "-2147483648 -1", (r) => r.printedSum);
sumKey("cse331-w1-l1-predict-two-runs.two-lines-sum", "orig", "3 4\n5", (r) => r.printedSum);
sumKey("cse331-w1-l1-predict-two-runs.decimal-sum", "orig", "2.5 3", (r) => r.printedSum);
sumKey("cse331-w1-l1-predict-two-runs.two-lines-got", "orig", "3 4\n5", (r) => r.stdout[1]);
sumKey("cse331-w1-l1-predict-two-runs.decimal-got", "orig", "2.5 3", (r) => r.stdout[1]);
sumKey("cse331-w1-l1-long-version.overflow-sum", "long", "2147483647 1", (r) => r.printedSum);
sumKey("cse331-w1-l1-long-version.too-big-got", "long", "2147483648", (r) => r.stdout[1]);
ok(KEYS["cse331-w1-l1-qc-hasnext-exception"].answer.startsWith(SumSim.run("hasnext", "3 4 hello").crash.exception.split(".").pop()), "hasNext exception key");
const cnt = ["3 4 5", "", "2147483647 1", "1 2 3"].filter((i) => SumSim.run("orig", i).wrapped).length;
ok(KEYS["cse331-w1-l1-qc-count-counterexamples"].answer === String(cnt), `counterexamples among the four runs = ${cnt}`);
ok(KEYS["cse331-w1-l1-sum-starts-at-one.meets-spec"].answer === "no" && SumSim.run("one", "").printedSum === 1n, "sum=1 empty run prints 1");
ok(KEYS["cse331-w1-l2-qc-count-impl4"].answer === String(Sim.count(4, [3, 0, 3, 3], 3).result.value), "count impl4 quick check");
ok(KEYS["cse331-w1-l2-quiz-count-last-match"].answer === String(Sim.count(4, [2, 2, 2], 2).result.value), "count impl4 quiz");
ok(KEYS["cse331-w1-l2-quiz-ignores-hi-returns"].answer === String(Sim.indexOf(3, [4, 7, 7], 0, 1, 7).value), "impl 3 ignores hi");
ok(KEYS["cse331-w1-l2-quiz-abs-min-value"].answer === "-2147483648", "Math.abs(MIN_VALUE) (checked against Java via sign impl 3 in compare-java)");
const meetsLetters = (i) => { const t = Sim.meetsTable(i); return "ABCDE".split("").filter((s) => t[s].meets).join(""); };
ok(KEYS["cse331-w1-l2-qc-impls-meeting-d"].answer === String([1, 2, 3, 4].filter((i) => Sim.meetsTable(i).D.meets).length), "impls meeting D");
[["first-or-minus-one", 1], ["first-or-throw", 2], ["ignores-hi", 3], ["last-or-minus-one", 4]].forEach(([p, i]) => ok(KEYS[`cse331-w1-l2-meets-matrix.${p}`].answer === meetsLetters(i), `meets matrix impl ${i} = ${meetsLetters(i)}`));
const signMeets = (impl) => ["S1", "S2", "S3"].filter((s) => Sim.SIGN_DOMAIN.every((x) => !Sim.SIGN_SPECS[s].pre(x) || Sim.SIGN_SPECS[s].ok(x, Sim.sign(impl, x)))).join(",");
[["signum", 1], ["identity", 2], ["divide-by-abs", 3]].forEach(([p, i]) => ok(KEYS[`cse331-w1-l2-sign-meets.${p}`].answer === signMeets(i), `sign impl ${i} meets ${signMeets(i) || "none"}`));
ok(G.grade(KEYS["cse331-w1-l2-maxlist-spec.empty-list"], `throws ${Sim.maxList([]).exception}`).status === "correct", "maxList([]) exception key");
// witnesses: graded by running code, so check a right and a wrong call for each
const W = (id, right, wrongKept, wrongPre) => {
  ok(G.grade(KEYS[id], right).status === "correct", `${id}: ${right} accepted`);
  ok(G.grade(KEYS[id], wrongKept).feedbackKind === "promise-kept", `${id}: ${wrongKept} rejected (promise kept)`);
  if (wrongPre) ok(G.grade(KEYS[id], wrongPre).feedbackKind === "breaks-precondition", `${id}: ${wrongPre} rejected (breaks precondition)`);
};
W("cse331-w1-l2-break-it.first-match-vs-c", "{1, 1}, 0, 2, 1", "{1, 2}, 0, 2, 1", "{1, 1}, 0, 3, 1");
W("cse331-w1-l2-break-it.last-match-vs-b", "{1, 1}, 0, 2, 1", "{1, 2}, 0, 2, 1", "{1, 1}, 2, 1, 1");
W("cse331-w1-l2-break-it.minus-one-vs-e", "{0}, 0, 1, 7", "{7}, 0, 1, 7", "{0}, -1, 1, 7");
W("cse331-w1-l2-break-it.ignores-hi-vs-d", "{0, 1, 2}, 0, 1, 2", "{2, 1}, 0, 2, 2");
W("cse331-w1-l2-sign-meets.min-value-witness", "-2147483648", "-2147483647", "0");
ok(G.grade(KEYS["cse331-w1-l2-break-it.count-wrong-impl4"], "{5, 1, 5, 2, 5}, 5").status === "correct" && G.grade(KEYS["cse331-w1-l2-break-it.count-wrong-impl4"], "{5}, 5").status === "incorrect", "count witness");
ok(G.grade(KEYS["cse331-w1-l2-sign-meets.min-value-witness"], "2147483648").status === "unreadable", "sign witness out of int range unreadable");

/* ---------------------------------------------------------------- store */
function memStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; }
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function settle(s, ms = 400) { const end = Date.now() + ms; while (Date.now() < end) { await tick(5); if (!s.pending().length && s.stats().loaded) return; } }
const mkStore = (adapter, storage = memStorage(), extra = {}) => CS.create({ adapter, storage, debounceMs: 5, retryBaseMs: 10, retryMaxMs: 40, ...extra });

{ // rapid repeated checks: two distinct attempts, never coalesced
  const mock = Mock.create();
  const s = mkStore(mock); s.start(); await s.ready;
  const a1 = s.attempt("q", { answer: { raw: "1", normalized: "1" }, result: { overall: "correct" } });
  const a2 = s.attempt("q", { answer: { raw: "1", normalized: "1" }, result: { overall: "correct" } });
  ok(a1.attemptId !== a2.attemptId && a1.seq === 1 && a2.seq === 2, "rapid double attempt: distinct ids, seq 1 and 2");
  await settle(s);
  const sent = mock.control.changes().filter((c) => c.kind === "attempt");
  ok(sent.length === 2 && sent[0].attempt.attemptId === a1.attemptId && sent[1].attempt.attemptId === a2.attemptId, "two attempt change records, in order");
  ok(mock.control.server().attempts.q.length === 2, "server holds both attempts");
}
{ // snapshots are coalesced, attempts are not
  const mock = Mock.create();
  const s = mkStore(mock); s.start(); await s.ready;
  for (let i = 0; i < 20; i++) s.put("p", { kind: "problem", work: "x".repeat(i) });
  await settle(s);
  ok(mock.control.changes().filter((c) => c.kind === "snapshot").length < 20, "typing snapshots are coalesced");
  ok(mock.control.server().items.p.work === "x".repeat(19), "latest snapshot wins");
}
{ // failed save then recovery: every attempt delivered exactly once, notices fired, nothing lost
  const mock = Mock.create();
  const notes = [];
  const storage = memStorage();
  const s = mkStore(mock, storage, { notify: (k) => notes.push(k) }); s.start(); await s.ready;
  mock.control.failNext(3);
  const ids = [];
  for (let i = 0; i < 5; i++) ids.push(s.attempt("q", { answer: { raw: String(i), normalized: String(i) }, result: { overall: "incorrect" } }).attemptId);
  s.put("p", { kind: "problem", work: "typed during outage" });
  await tick(15);
  ok(notes.includes("save-failed"), "save-failed notice");
  ok(JSON.parse(storage.getItem(CS.MIRROR_KEY)).store.items.p.work === "typed during outage", "typed text kept in the local mirror during the outage");
  await settle(s, 2000);
  ok(notes.includes("recovered"), "recovered notice");
  const delivered = mock.control.changes().filter((c) => c.kind === "attempt").map((c) => c.attempt.attemptId);
  ok(delivered.length === 5 && new Set(delivered).size === 5 && ids.every((id) => delivered.includes(id)), `every attempt delivered exactly once (${delivered.length})`);
  ok(mock.control.server().items.p.work === "typed during outage", "snapshot delivered after recovery");
  ok(notes.filter((n) => n === "save-failed").length === 1, "one failure notice per outage, not one per retry");
}
{ // reload: history survives, from the mirror even if the adapter is down
  const storage = memStorage();
  const mock = Mock.create();
  const s1 = mkStore(mock, storage); s1.start(); await s1.ready;
  s1.attempt("q", { result: { overall: "correct" } }); s1.attempt("q", { result: { overall: "correct" } });
  await settle(s1);
  const s2 = mkStore(mock, storage); s2.start(); await s2.ready;
  ok(s2.attemptsOf("q").length === 2, "attempt history survives reload");
  mock.control.failLoad(5);
  const notes = [];
  const s3 = mkStore(mock, storage, { notify: (k) => notes.push(k) }); s3.start();
  ok(s3.attemptsOf("q").length === 2, "history available from the mirror while the adapter is down");
  await tick(30);
  ok(notes.includes("load-failed"), "load-failed notice");
  mock.control.failLoad(0);
  const s4 = mkStore(mock, memStorage()); s4.start(); await s4.ready;
  ok(s4.attemptsOf("q").length === 2, "a fresh device gets the history from the adapter");
}
{ // conflict: union attempts by attemptId, keep dirty local text, no duplicates
  const mock = Mock.create();
  const notes = [];
  const s = mkStore(mock, memStorage(), { notify: (k) => notes.push(k) }); s.start(); await s.ready;
  const mine = s.attempt("q", { result: { overall: "incorrect" } });
  await settle(s);
  // another device: same first attempt, plus one of its own, plus a newer snapshot of an item we're editing
  const remote = mock.control.server();
  remote.attempts.q.push({ attemptId: "other-device-1", seq: 2, itemId: "q", submittedAt: "2030-01-01T00:00:00.000Z", result: { overall: "correct" } });
  remote.items.p = { kind: "problem", work: "remote text", updatedAt: "2030-01-01T00:00:00.000Z" };
  remote.items.r = { kind: "problem", work: "only remote", updatedAt: "2030-01-01T00:00:00.000Z" };
  mock.control.conflictNext(remote);
  s.put("p", { kind: "problem", work: "my local text" });
  const mine2 = s.attempt("q", { result: { overall: "correct" } });
  await settle(s, 1000);
  ok(notes.includes("conflict"), "conflict notice");
  const ids = s.attemptsOf("q").map((a) => a.attemptId);
  ok(ids.length === 3 && new Set(ids).size === 3 && ids.includes(mine.attemptId) && ids.includes(mine2.attemptId) && ids.includes("other-device-1"), `conflict merge unions attempts by attemptId (${ids.length})`);
  ok(s.get("p").work === "my local text", "dirty local text wins over the remote copy");
  ok(s.get("r").work === "only remote", "remote-only item merged in");
  const server = mock.control.server();
  ok(server.attempts.q.length === 3 && server.items.p.work === "my local text", "server ends with the merged store");
  const m = CS.merge(s.exportState(), s.exportState());
  ok(m.store.attempts.q.length === 3, "merging a store with itself duplicates nothing");
}
{ // conflict signalled by resolving with { conflict: true } and no remote attached: adapter.load() is used
  let server = null, conflictOnce = true;
  const adapter = { name: "resolve-style", async load() { return server; }, async save(store) { if (conflictOnce) { conflictOnce = false; server = { siteId: CS.SITE_ID, schemaVersion: 2, items: {}, attempts: { q: [{ attemptId: "srv", seq: 1, itemId: "q", submittedAt: "2001-01-01T00:00:00Z" }] }, events: {} }; return { conflict: true }; } server = store; } };
  const s = mkStore(adapter); s.start(); await s.ready;
  s.attempt("q", {}); await settle(s, 500);
  ok(server.attempts.q.length === 2, "resolve-style conflict also merges");
}
{ // migration from the trial's v1 store: latest-only, no fabricated attempts
  const v1 = { site: "cse331-26au-week1", version: 1, updatedAt: "2026-10-02T20:00:00.000Z",
    problems: { "l1-e4": { answers: ["yes", "no", "yes", "no"], partResults: [true, true, true, true], result: "right", selfMark: null, attempts: 2, work: "w", hintsShown: 1, solutionSeen: true, solutionOpen: false, updatedAt: "2026-10-02T20:00:00.000Z" } },
    quiz: { "cyu-spec-wrap": { tries: 1, firstCorrect: true, done: true, revealed: false, choice: null, value: "2147483647", correct: true }, "cyu-know": { tries: 2, firstCorrect: false, done: true, choice: 0, correct: true } },
    checks: { "runs-check0": { value: "1", correct: true, attempts: 2 } } };
  const n = CS.normalize(v1);
  ok(n.status === "migrated-v1", "v1 detected");
  const p = n.store.items["cse331-w1-l1-sum-starts-at-one"];
  ok(p && p.parts["cse331-w1-l1-sum-starts-at-one.point2-sum"].raw === "no" && p.result === "right" && p.checks === 2 && p.work === "w", "v1 problem migrated to part IDs");
  ok(n.store.items["cse331-w1-l1-quiz-testing-can"].choiceId === "refute-only", "v1 MC position mapped to option id");
  ok(n.store.items["cse331-w1-l1-qc-count-counterexamples"].raw === "1", "v1 quick check migrated");
  ok(Object.keys(n.store.attempts).length === 0 && Object.keys(n.store.events).length === 0, "no attempts fabricated during migration");
  const storage = memStorage(); storage.setItem(CS.TRIAL_V1_KEY, JSON.stringify(v1));
  const s = mkStore(null, storage); ok(s.start() === "migrated-v1" && s.get("cse331-w1-l1-quiz-sum-wraps-down").raw === "2147483647", "store reads the trial's localStorage key");
}
{ // unknown and foreign versions: ignored without crashing, and never overwritten
  ok(CS.normalize({ siteId: CS.SITE_ID, schemaVersion: 99, items: {} }).status === "unknown-version", "unknown version ignored");
  ok(CS.normalize({ siteId: "other", schemaVersion: 2 }).status === "other-site", "other site ignored");
  ok(CS.normalize("garbage").status === "malformed" && CS.normalize(null).status === "empty", "malformed/empty");
  const mock = Mock.create({ initial: { siteId: CS.SITE_ID, schemaVersion: 99, items: { x: {} } } });
  const notes = [];
  const s = mkStore(mock, memStorage(), { notify: (k, i) => notes.push(i && i.status || k) }); s.start(); await s.ready;
  s.attempt("q", {}); await tick(50);
  ok(notes.includes("unknown-version") && mock.control.server().schemaVersion === 99, "newer remote schema is never overwritten");
  ok(s.attemptsOf("q").length === 1, "local work still kept");
}
{ // no silent caps: 500 attempts on one item all kept
  const s = mkStore(null, memStorage()); s.start(); await s.ready;
  for (let i = 0; i < 500; i++) s.attempt("q", {});
  ok(s.attemptsOf("q").length === 500 && s.attemptsOf("q")[499].seq === 500, "500 attempts kept, seq 1..500");
}

/* ---------------------------------------------------------------- edits invalidate the current grade (one rule, every kind) */
{
  const inv = JSON.parse(req("node:fs").readFileSync(new URL("../export/state-inventory.json", import.meta.url), "utf8"));
  const kinds = [...new Set(inv.items.filter((e) => e.gradable).map((e) => `${e.kind}/${e.answerType}`))].sort();
  const graded = {
    quiz: () => ({ kind: "quiz", raw: "8", choiceId: "x", normalized: "8", correct: true, done: true, revealed: false, tries: 1, firstTryCorrect: true, lastMessage: null }),
    quickcheck: () => ({ kind: "quickcheck", raw: "8", normalized: "8", correct: true, tries: 2, firstTryCorrect: false }),
    part: (self) => ({ kind: "problem", parts: { "p.a": { raw: "x", normalized: self ? null : "X", correct: true }, "p.b": { raw: "y", normalized: "Y", correct: true } }, work: "w", result: "correct", selfMark: "got", checks: 3, hintsRevealed: 1, solutionViewed: true }),
  };
  for (const k of kinds) {
    const [kind, type] = k.split("/");
    const self = type === "self";
    const s = graded[kind](self);
    const before = JSON.parse(JSON.stringify(s));
    const { state: out, changed } = CS.invalidateCurrentGrade(s, kind === "part" ? { pid: "p.a", self } : undefined);
    ok(changed, `${k}: a graded item reports a cleared grade`);
    if (kind === "part") {
      ok(out.parts["p.a"].raw === "x" && out.parts["p.a"].correct === null && out.parts["p.a"].normalized === null, `${k}: edited part keeps raw, loses correct + normalized`);
      ok(out.parts["p.b"].correct === true && out.parts["p.b"].normalized === "Y", `${k}: other parts keep their grade`);
      ok(self ? out.selfMark === null && out.result === "correct" : out.result === null && out.selfMark === "got", `${k}: ${self ? "selfMark" : "overall result"} cleared, the other kept`);
      ok(out.checks === 3 && out.work === "w" && out.solutionViewed === true && out.hintsRevealed === 1, `${k}: history fields and work untouched`);
    } else {
      ok(out.raw === before.raw && out.correct === null && out.normalized === null, `${k}: keeps raw, loses correct + normalized`);
      ok(out.tries === before.tries && out.firstTryCorrect === before.firstTryCorrect, `${k}: tries / firstTryCorrect (history) untouched`);
      if (kind === "quiz") ok(out.done === false && out.choiceId === "x", `${k}: done cleared (not revealed), choice draft kept`);
    }
    ok(!CS.invalidateCurrentGrade(out, kind === "part" ? { pid: "p.a", self } : undefined).changed, `${k}: invalidating twice is a no-op`);
  }
  const rev = CS.invalidateCurrentGrade({ kind: "quiz", raw: "1", correct: false, done: true, revealed: true }).state;
  ok(rev.done === true, "quiz: a revealed item stays done after an edit (revealed is not a grade)");
  ok(kinds.length === 13, `inventory has 13 gradable kind/type combinations (${kinds.join(" ")})`);
  // the store never edits history when a snapshot is invalidated
  const s = mkStore(null, memStorage()); s.start(); await s.ready;
  const a = s.attempt("q", { answer: { raw: "8", normalized: "8" }, result: { overall: "correct", correct: true } });
  s.event("q", "reveal");
  s.put("q", { kind: "quickcheck", raw: "8", normalized: "8", correct: true, tries: 1 });
  s.put("q", CS.invalidateCurrentGrade({ ...s.get("q"), raw: "9" }).state);
  ok(JSON.stringify(s.attemptsOf("q")) === JSON.stringify([a]) && s.eventsOf("q").length === 1, "invalidation leaves attempts[] and events[] byte-identical");
  ok(s.get("q").raw === "9" && s.get("q").correct === null, "invalidated snapshot stored");
}

console.log(`unit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
