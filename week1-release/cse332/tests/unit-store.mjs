// Unit tests for site/js/store.js with examples/mock-adapter.js:
// attempts (distinct, append-only), exactly-once delivery across failures, conflict merge (union by attemptId),
// edit invalidation, migration v1 -> v2, unknown/newer versions, mirror survives "reload".
import { createRequire } from "node:module";
const require = createRequire(import.meta.url); // the site modules are CommonJS/UMD
const CourseStore = require("../site/js/store.js");
const MockAdapter = require("../examples/mock-adapter.js");
let pass = 0, fail = 0;
const t = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL", msg); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function memLS() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; }
const SITE = "cse332-26au-week1";
const mk = (adapter, ls, extra = {}) => {
  const notices = [];
  const s = CourseStore.create({ siteId: SITE, adapter, localStorage: ls, onNotice: (c) => notices.push(c), snapshotDebounceMs: 5, backoffMs: [20, 40, 80], ...extra });
  s.notices = notices;
  return s;
};
const ID = "cse332-w1-l2-myfunction";

/* rapid double check -> 2 distinct attempts */
{
  const mock = MockAdapter.create();
  const s = mk(mock.adapter, memLS());
  await s.init();
  const a1 = s.appendAttempt(ID, "problem", { answer: { count: { raw: "4n+4", normalized: "4n+4" } }, result: { overall: true }, feedbackKind: "correct" });
  const a2 = s.appendAttempt(ID, "problem", { answer: { count: { raw: "4n+4", normalized: "4n+4" } }, result: { overall: true }, feedbackKind: "correct" });
  t(a1.attemptId !== a2.attemptId && a1.seq === 1 && a2.seq === 2, "identical rapid attempts get distinct ids and seq");
  await s.flush();
  const att = mock.changes.filter((c) => c.kind === "attempt");
  t(att.length === 2 && new Set(att.map((c) => c.attempt.attemptId)).size === 2, "both attempts delivered as separate change records");
  t(s.get(ID).attempts.length === 2, "both in history");
}

/* snapshots coalesce, attempts don't */
{
  const mock = MockAdapter.create({ latencyMs: 30 });
  const s = mk(mock.adapter, memLS());
  await s.init();
  for (let i = 0; i < 10; i++) s.update(ID, "problem", (r) => { r.work = "w".repeat(i + 1); });
  s.appendAttempt(ID, "problem", { answer: {}, result: { overall: false }, feedbackKind: "incorrect" });
  for (let i = 0; i < 5; i++) s.update(ID, "problem", (r) => { r.work = "x".repeat(i + 1); });
  s.appendAttempt(ID, "problem", { answer: {}, result: { overall: false }, feedbackKind: "incorrect" });
  await sleep(50);
  await s.flush();
  const snaps = mock.changes.filter((c) => c.kind === "snapshot");
  t(snaps.length <= 3, `snapshots coalesced (${snaps.length} sent for 15 edits)`);
  t(mock.changes.filter((c) => c.kind === "attempt").length === 2, "attempts never coalesced");
  t(mock.remote.items[ID].work === "xxxxx", "latest work text arrived");
}

/* failure -> retry -> recovery delivers every attempt exactly once, text never lost */
{
  const mock = MockAdapter.create({ failSaves: 3 });
  const ls = memLS();
  const s = mk(mock.adapter, ls);
  await s.init();
  s.update(ID, "problem", (r) => { r.work = "my precious reasoning"; });
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push(s.appendAttempt(ID, "problem", { answer: { count: { raw: String(i), normalized: String(i) } }, result: { overall: false }, feedbackKind: "incorrect" }).attemptId);
  await sleep(10);
  t(s.notices.includes("save-failed"), "failure notice raised");
  t(JSON.parse(ls.getItem(`${SITE}:mirror`)).items[ID].work === "my precious reasoning", "text kept in local mirror during failure");
  t(JSON.parse(ls.getItem(`${SITE}:outbox`)).filter((c) => c.kind === "attempt").length === 4, "undelivered attempts kept in local outbox");
  await sleep(400);
  t(s.notices.includes("save-recovered"), "recovery notice raised");
  const delivered = mock.changes.filter((c) => c.kind === "attempt").map((c) => c.attempt.attemptId);
  t(delivered.length === 4 && ids.every((id) => delivered.filter((d) => d === id).length === 1), "every attempt delivered exactly once after recovery");
  t(s.pending === 0, "outbox empty");
  t(s.notices.filter((n) => n === "save-failed").length === 1, "one failure notice per outage, not one per retry");
}

/* reload while failing: a new store instance on the same localStorage resumes the outbox (no loss, no dupes) */
{
  const mock = MockAdapter.create({ failAll: true });
  const ls = memLS();
  const s1 = mk(mock.adapter, ls);
  await s1.init();
  const a = s1.appendAttempt(ID, "problem", { answer: {}, result: { overall: true }, feedbackKind: "correct" });
  s1.update(ID, "problem", (r) => { r.work = "typed before reload"; });
  await sleep(30);
  s1.dispose(); // the old page is gone
  mock.set({ failAll: false });
  const s2 = mk(mock.adapter, ls); // "reload"
  t(s2.get(ID).work === "typed before reload" && s2.get(ID).attempts.length === 1, "mirror restores text and history synchronously");
  await s2.init();
  await sleep(50); await s2.flush();
  const delivered = mock.changes.filter((c) => c.kind === "attempt" && c.attempt.attemptId === a.attemptId);
  t(delivered.length === 1, "attempt from before reload delivered exactly once");
  t(mock.remote.items[ID].attempts.length === 1, "remote has one copy");
}

/* conflict: union attempts by attemptId; local text kept; transient notice */
{
  const mock = MockAdapter.create();
  const lsA = memLS(), lsB = memLS();
  const A = mk(mock.adapter, lsA); await A.init();
  const a1 = A.appendAttempt(ID, "problem", { answer: {}, result: { overall: false }, feedbackKind: "incorrect" });
  await A.flush();
  // device B starts from the same remote, adds its own attempt + text
  const B = mk(mock.adapter, lsB); await B.init();
  const b1 = B.appendAttempt(ID, "problem", { answer: {}, result: { overall: true }, feedbackKind: "correct" });
  B.update(ID, "problem", (r) => { r.work = "B's work"; });
  await B.flush();
  // A makes changes, the server says conflict with B's newer store
  A.update(ID, "problem", (r) => { r.work = "A's local text"; });
  const a2 = A.appendAttempt(ID, "problem", { answer: {}, result: { overall: true }, feedbackKind: "correct" });
  mock.set({ conflictNext: true });
  await sleep(10); await A.flush();
  const rec = A.get(ID);
  const ids = rec.attempts.map((x) => x.attemptId);
  t(ids.length === 3 && [a1, a2, b1].every((x) => ids.includes(x.attemptId)), "merge unions attempts by attemptId (3, no dupes)");
  t(new Set(ids).size === ids.length, "no duplicate attempts after merge");
  t(rec.work === "A's local text", "local edit wins the snapshot");
  t(rec.conflictCopies.some((c) => c.value === "B's work"), "losing text kept in conflictCopies");
  t(A.notices.includes("conflict-merged"), "conflict notice");
  t(mock.remote.items[ID].attempts.length === 3, "server ends with the union");
  // merging the same thing again is idempotent
  const again = CourseStore.mergeStores(A.state, mock.remote, new Set());
  t(again.items[ID].attempts.length === 3, "merge is idempotent");
  // the "return" style of conflict signal works too
  mock.set({ conflictNext: true, conflictMode: "return" });
  A.appendAttempt(ID, "problem", { answer: {}, result: { overall: true }, feedbackKind: "correct" });
  await sleep(10); await A.flush();
  t(mock.remote.items[ID].attempts.length === 4, "conflict returned as {conflict:true, remote} handled");
}

/* edit invalidation: clearGrade keeps raw, clears grade, never touches history */
{
  const r = CourseStore.BLANK.problem();
  r.parts = { a: { raw: "7", normalized: "7", correct: true, feedbackKind: "correct", detail: null } };
  r.result = "right"; r.selfMark = "got"; r.attempts = [{ attemptId: "x", seq: 1 }]; r.events = [{ eventId: "e", seq: 1, type: "hint" }];
  CourseStore.clearGrade(r);
  t(r.parts.a.raw === "7" && r.parts.a.correct === null && r.parts.a.normalized === null && r.parts.a.feedbackKind === null, "part grade cleared, raw kept");
  t(r.result === null && r.selfMark === null, "result and selfMark cleared");
  t(r.attempts.length === 1 && r.events.length === 1, "history untouched");
  const q = { ...CourseStore.BLANK.quiz(), raw: "5", normalized: "5", correct: true, feedbackKind: "correct", choice: 2 };
  CourseStore.clearGrade(q);
  t(q.raw === "5" && q.choice === 2 && q.correct === null && q.normalized === null && q.feedbackKind === null, "quiz grade cleared, draft kept");
}

/* liveAttempts / firstTryCorrect / clear events */
{
  const s = mk(MockAdapter.create().adapter, memLS()); await s.init();
  const Q = "cse332-w1-l1-cyu-back-wraps";
  s.appendAttempt(Q, "quiz", { answer: { raw: "12" }, result: { overall: false }, feedbackKind: "no-wrap" });
  s.appendAttempt(Q, "quiz", { answer: { raw: "2" }, result: { overall: true }, feedbackKind: "correct" });
  t(!CourseStore.firstTryCorrect(s.get(Q)), "wrong first try isn't first-try correct");
  await sleep(5);
  s.clearItem(Q, "quiz");
  t(s.get(Q).attempts.length === 2 && CourseStore.liveAttempts(s.get(Q)).length === 0, "Start over keeps history, counts restart");
  await sleep(5);
  s.appendAttempt(Q, "quiz", { answer: { raw: "2" }, result: { overall: true }, feedbackKind: "correct" });
  t(CourseStore.firstTryCorrect(s.get(Q)), "first try after Start over counts");
  const R = "cse332-w1-l1-cyu-back-after-enqueues";
  s.logEvent(R, "quiz", "reveal", null, (r) => { r.revealed = true; });
  const a = s.appendAttempt(R, "quiz", { answer: { raw: "7" }, result: { overall: true }, feedbackKind: "correct" });
  t(a.solutionViewedBeforeSubmit === true && !CourseStore.firstTryCorrect(s.get(R)), "reveal-then-submit flagged, not first-try correct");
  const P2 = "cse332-w1-l2-beannoying";
  s.logEvent(P2, "problem", "hint", { level: 1 }, (r) => { r.hintsRevealed = 1; });
  const pa = s.appendAttempt(P2, "problem", { answer: {}, result: { overall: true }, feedbackKind: "correct" });
  t(pa.hintsRevealedAtSubmit === 1 && pa.solutionViewedBeforeSubmit === false, "hints at submit recorded");
}

/* migration v1 -> v2, unknown and newer versions */
{
  const v1 = { siteId: SITE, schemaVersion: 1, items: {
    [ID]: { kind: "problem", parts: { count: { raw: "4n+4", normalized: "4n+4", correct: true } }, result: "right", attempts: 3, work: "old work" },
    "cse332-w1-l1-cyu-back-wraps": { kind: "quiz", value: "2", tries: 1, firstTryCorrect: true, correct: true },
    "weird": { kind: "hologram" },
  } };
  const m = CourseStore.migrate(v1, SITE);
  t(m.status === "migrated" && m.store.schemaVersion === 2, "v1 migrated");
  t(Array.isArray(m.store.items[ID].attempts) && m.store.items[ID].attempts.length === 0 && m.store.items[ID].legacyAttemptCount === 3, "no fabricated attempts; legacy count kept");
  t(m.store.items[ID].work === "old work" && m.store.items[ID].parts.count.raw === "4n+4", "latest snapshot kept");
  t(m.store.items["cse332-w1-l1-cyu-back-wraps"].raw === "2", "v1 quiz value -> raw");
  t(!m.store.items.weird, "unknown item kinds dropped, no crash");
  t(CourseStore.migrate({ siteId: SITE, schemaVersion: 99, items: {} }, SITE).status === "newer-version", "newer version detected");
  t(CourseStore.migrate({ siteId: SITE, schemaVersion: "x", items: {} }, SITE).status === "unknown-version", "unknown version ignored");
  t(CourseStore.migrate({ siteId: "other", schemaVersion: 2, items: {} }, SITE).status === "other-site", "other site ignored");
  t(CourseStore.migrate("garbage", SITE).status === "empty", "garbage ignored");
  // newer remote: never overwritten
  const mock = MockAdapter.create({ initial: { siteId: SITE, schemaVersion: 99, items: { x: 1 } } });
  const s = mk(mock.adapter, memLS()); await s.init();
  s.update(ID, "problem", (r) => { r.work = "hi"; });
  await sleep(20);
  t(s.blocked && mock.remote.schemaVersion === 99 && mock.saveCalls === 0, "newer remote store is never overwritten");
  t(s.get(ID).work === "hi", "local typing still kept");
}

/* slow adapter + failing load: works from the mirror */
{
  const mock = MockAdapter.create({ latencyMs: 200, failLoad: true });
  const ls = memLS();
  ls.setItem(`${SITE}:mirror`, JSON.stringify({ siteId: SITE, schemaVersion: 2, items: { [ID]: { ...CourseStore.BLANK.problem(), work: "from mirror" } } }));
  const s = mk(mock.adapter, ls);
  t(s.get(ID).work === "from mirror", "mirror available before load resolves");
  await s.init();
  t(s.notices.includes("load-failed") && s.get(ID).work === "from mirror", "load failure keeps local work");
}

/* no silent caps: 500 attempts all kept */
{
  const mock = MockAdapter.create();
  const s = mk(mock.adapter, memLS()); await s.init();
  for (let i = 0; i < 500; i++) s.appendAttempt(ID, "problem", { answer: {}, result: { overall: false }, feedbackKind: "incorrect" });
  await s.flush();
  t(s.get(ID).attempts.length === 500 && mock.changes.filter((c) => c.kind === "attempt").length === 500 && s.get(ID).attempts[499].seq === 500, "500 attempts kept and delivered, no cap");
}

console.log(`unit-store: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
