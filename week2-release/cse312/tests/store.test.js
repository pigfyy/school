"use strict";
/*
  Store contract tests for the week 2 site in Node (no browser): attempts are append-only and distinct, saves are serialized and
  retried, failures keep everything, conflicts merge by attemptId, unknown versions are left alone, v1 data migrates.
  Run: node tests/store.test.js
*/
const assert = require("assert");

// minimal browser globals
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
};
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } };
const dispatched = [];
globalThis.dispatchEvent = (e) => { dispatched.push(e); return true; };
globalThis.addEventListener = () => {};

const S = require("../site/js/store.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function memAdapter({ latency = 5 } = {}) {
  let remote = null;
  const delivered = [];
  const calls = [];
  const a = {
    name: "mem",
    fail: false,
    conflictOnce: null,
    get remote() { return remote; },
    set remote(v) { remote = v; },
    delivered, calls,
    async load() { await sleep(latency); if (a.failLoad) throw new Error("load down"); return remote && JSON.parse(JSON.stringify(remote)); },
    async save(store, change) {
      calls.push(change);
      await sleep(latency);
      if (a.fail) throw new Error("server down");
      if (a.conflictOnce) { const r = a.conflictOnce; a.conflictOnce = null; remote = r; return { conflict: true, remote: JSON.parse(JSON.stringify(r)) }; }
      if (remote && change.baseRevision < remote.revision) return { conflict: true, remote: JSON.parse(JSON.stringify(remote)) };
      remote = JSON.parse(JSON.stringify(store));
      delivered.push(...change.changes);
      return { revision: store.revision };
    },
  };
  return a;
}
async function settle(store, ms = 2500) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (!store.pending().length) return true; await sleep(20); }
  return false;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("two rapid checks with identical answers make two distinct attempts", async () => {
  mem.clear();
  const ad = memAdapter();
  const st = S.createStore({ adapter: ad });
  await st.load();
  const a1 = st.addAttempt("x", "quickcheck", { answer: { raw: "5", normalized: "5" }, result: { correct: false, overall: false } });
  const a2 = st.addAttempt("x", "quickcheck", { answer: { raw: "5", normalized: "5" }, result: { correct: false, overall: false } });
  assert.notStrictEqual(a1.attemptId, a2.attemptId);
  assert.deepStrictEqual([a1.seq, a2.seq], [1, 2]);
  assert.ok(await settle(st));
  const sent = ad.delivered.filter((c) => c.kind === "attempt");
  assert.strictEqual(sent.length, 2, "both attempts delivered as separate change records");
  assert.deepStrictEqual(sent.map((c) => c.attempt.attemptId), [a1.attemptId, a2.attemptId]);
  assert.strictEqual(ad.remote.items.x.attempts.length, 2);
});

test("snapshots coalesce but attempts never do", async () => {
  mem.clear();
  const ad = memAdapter();
  const st = S.createStore({ adapter: ad });
  await st.load();
  for (let i = 0; i < 20; i++) st.update("p", "problem", (it) => { it.work = `w${i}`; });
  st.addAttempt("p", "problem", { answer: {}, result: { overall: true } });
  for (let i = 0; i < 5; i++) st.update("p", "problem", (it) => { it.work = `z${i}`; });
  const snaps = st.pending().filter((c) => c.kind === "snapshot");
  assert.strictEqual(snaps.length, 1, "only the latest snapshot for an item is queued");
  assert.strictEqual(snaps[0].record.work, "z4");
  assert.strictEqual(st.pending().filter((c) => c.kind === "attempt").length, 1);
  assert.ok(await settle(st));
  assert.strictEqual(ad.remote.items.p.work, "z4");
});

test("save failure keeps everything; recovery delivers each attempt exactly once", async () => {
  mem.clear();
  const ad = memAdapter();
  const st = S.createStore({ adapter: ad });
  const notices = [];
  st.onNotice((n) => notices.push(n));
  await st.load();
  ad.fail = true;
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push(st.addAttempt("q", "quiz", { answer: { raw: "1", normalized: "1" }, result: { correct: false, overall: false } }).attemptId);
  st.update("q", "quiz", (it) => { it.raw = "typed but unsent"; });
  await sleep(1300);
  assert.ok(notices.some((n) => n.kind === "error"), "error notice shown");
  assert.strictEqual(notices.filter((n) => n.kind === "error").length, 1, "error notice shown once, not per retry");
  // nothing lost locally (mirror) while failing
  const mirror = JSON.parse(mem.get(S.MIRROR_KEY));
  assert.strictEqual(mirror.store.items.q.raw, "typed but unsent");
  assert.strictEqual(mirror.outbox.filter((c) => c.kind === "attempt").length, 3);
  ids.push(st.addAttempt("q", "quiz", { answer: { raw: "2", normalized: "2" }, result: { correct: true, overall: true } }).attemptId);
  ad.fail = false;
  await st.flushNow();
  assert.ok(await settle(st, 4000));
  const got = ad.delivered.filter((c) => c.kind === "attempt").map((c) => c.attempt.attemptId);
  assert.deepStrictEqual(got.sort(), ids.slice().sort(), "every attempt delivered exactly once");
  assert.ok(notices.some((n) => n.kind === "recovered"), "recovery notice shown");
  assert.strictEqual(ad.remote.items.q.attempts.length, 4);
  assert.strictEqual(ad.remote.items.q.raw, "typed but unsent");
});

test("a reload while failing keeps the outbox and delivers it later, once", async () => {
  mem.clear();
  const ad = memAdapter();
  let st = S.createStore({ adapter: ad });
  await st.load();
  ad.fail = true;
  const a = st.addAttempt("r", "quickcheck", { answer: { raw: "9", normalized: "9" }, result: { correct: true, overall: true } });
  await sleep(300);
  // "reload": a new store instance reading the same localStorage
  ad.fail = false;
  st = S.createStore({ adapter: ad });
  await st.load();
  assert.ok(await settle(st, 3000));
  const got = ad.delivered.filter((c) => c.kind === "attempt" && c.attempt.attemptId === a.attemptId);
  assert.strictEqual(got.length, 1);
  assert.strictEqual(st.snapshot().items.r.attempts.length, 1);
});

test("conflict: merge unions attempts by attemptId, local unsent text wins, nothing duplicated", async () => {
  mem.clear();
  const ad = memAdapter();
  const st = S.createStore({ adapter: ad });
  const notices = [];
  st.onNotice((n) => notices.push(n));
  await st.load();
  const shared = st.addAttempt("c", "problem", { answer: {}, result: { overall: false } });
  assert.ok(await settle(st));
  // another device adds an attempt and newer work, and bumps the revision
  const other = JSON.parse(JSON.stringify(ad.remote));
  const remoteAttempt = { attemptId: "att-remote-1", seq: 2, itemId: "c", submittedAt: new Date(Date.now() + 5).toISOString(), answer: {}, result: { overall: true }, feedbackKind: "correct", hintsRevealedAtSubmit: 0, solutionViewedBeforeSubmit: false };
  other.items.c.attempts.push(remoteAttempt);
  other.items.c.work = "remote work";
  other.items.other = { ...S.blankItem("other", "quiz"), raw: "from phone" };
  other.revision += 5;
  ad.remote = other;
  // meanwhile this tab adds an attempt and types work
  const local = st.addAttempt("c", "problem", { answer: {}, result: { overall: true } });
  st.update("c", "problem", (it) => { it.work = "local unsent work"; });
  assert.ok(await settle(st, 3000));
  const items = ad.remote.items;
  const ids = items.c.attempts.map((x) => x.attemptId);
  assert.deepStrictEqual(ids.slice().sort(), [shared.attemptId, local.attemptId, "att-remote-1"].sort());
  assert.strictEqual(new Set(ids).size, ids.length, "no duplicates");
  assert.strictEqual(items.c.work, "local unsent work", "local unsent text kept");
  assert.strictEqual(items.other.raw, "from phone", "remote-only items kept");
  assert.ok(notices.some((n) => n.kind === "conflict"), "conflict notice shown");
  assert.strictEqual(st.snapshot().items.c.attempts.length, 3);
  // seq stays monotonic after the merge
  const next = st.addAttempt("c", "problem", { answer: {}, result: { overall: true } });
  assert.strictEqual(next.seq, 3, "next seq continues after the highest merged seq");
});

test("conflict signalled by save() rejecting with {code:'conflict'} is handled too", async () => {
  mem.clear();
  const ad = memAdapter();
  const orig = ad.save;
  let once = true;
  ad.save = async (store, change) => {
    if (once) { once = false; const e = new Error("conflict"); e.code = "conflict"; e.remote = { ...S.blankItem, schemaVersion: S.SCHEMA_VERSION, siteId: S.SITE_ID, revision: 7, updatedAt: null, items: { z: { ...S.blankItem("z", "quiz"), attempts: [{ attemptId: "att-z", seq: 1, itemId: "z", submittedAt: "2026-10-01T00:00:00.000Z" }] } } }; throw e; }
    return orig(store, change);
  };
  const st = S.createStore({ adapter: ad });
  await st.load();
  st.addAttempt("y", "quiz", { answer: {}, result: { correct: true, overall: true } });
  assert.ok(await settle(st, 3000));
  assert.ok(ad.remote.items.z.attempts.length === 1 && ad.remote.items.y.attempts.length === 1);
});

test("unknown newer schema on the server is never overwritten", async () => {
  mem.clear();
  const ad = memAdapter();
  ad.remote = { schemaVersion: 99, siteId: S.SITE_ID, revision: 3, items: { future: { whatever: true } } };
  const st = S.createStore({ adapter: ad });
  const notices = [];
  st.onNotice((n) => notices.push(n));
  await st.load();
  st.addAttempt("a", "quiz", { answer: {}, result: {} });
  await sleep(400);
  assert.strictEqual(ad.remote.schemaVersion, 99, "remote untouched");
  assert.ok(notices.some((n) => n.code === "unknown-version"));
  assert.strictEqual(st.snapshot().items.a.attempts.length, 1, "local still works");
});

test("week 1's store and other sites' data are never read or overwritten", async () => {
  mem.clear();
  const week1 = JSON.stringify({ store: { schemaVersion: 2, siteId: "cse312-26au-week1", revision: 4, items: { "cse312-w1-l1-qc-lunch": { id: "x", attempts: [{ attemptId: "a" }], events: [] } } }, outbox: [] });
  mem.set("cse312-26au-week1:mirror", week1);
  const ad = memAdapter();
  ad.remote = { schemaVersion: 2, siteId: "cse312-26au-week1", revision: 4, items: {} };
  const notices = [];
  const st = S.createStore({ adapter: ad });
  st.onNotice((n) => notices.push(n));
  await st.load();
  assert.strictEqual(S.SITE_ID, "cse312-26au-week2");
  assert.deepStrictEqual(Object.keys(st.snapshot().items), [], "nothing imported from week 1");
  assert.strictEqual(mem.get("cse312-26au-week1:mirror"), week1, "week 1's local mirror untouched");
  st.addAttempt("cse312-w2-l3-qc-three-set-union", "quickcheck", { answer: { raw: "68", normalized: "68" }, result: { correct: true, overall: true } });
  await sleep(400);
  assert.strictEqual(ad.remote.siteId, "cse312-26au-week1", "a server store for another site is never overwritten");
  assert.ok(notices.some((n) => n.code === "unknown-version"), "transient notice explains it");
});

test("v1-shaped data with no known ids migrates to an empty v2 store (no fabricated items or attempts)", async () => {
  mem.clear();
  const m = S.migrate({ version: 1, problems: { "s1-t4": { answers: ["5!*2^5"] } } });
  assert.ok(m.store && m.store.schemaVersion === 2 && Object.keys(m.store.items).length === 0);
  assert.deepStrictEqual(S.LEGACY_ID_MAP, {});
});

test("change events are emitted for snapshot, attempt and event", async () => {
  mem.clear();
  dispatched.length = 0;
  const st = S.createStore({ adapter: memAdapter() });
  await st.load();
  const seen = [];
  st.on((c) => seen.push(c.kind));
  st.update("e", "problem", (it) => { it.work = "x"; });
  st.addEvent("e", "problem", { type: "hint", level: 1 });
  st.addAttempt("e", "problem", { answer: {}, result: { overall: false } });
  assert.deepStrictEqual(seen, ["snapshot", "event", "snapshot", "attempt", "snapshot"]);
  assert.ok(dispatched.every((e) => e.type === "course-site:change"));
  assert.strictEqual(dispatched.length, 5);
});

test("slow adapter: edits during an in-flight save are not lost", async () => {
  mem.clear();
  const ad = memAdapter({ latency: 250 });
  const st = S.createStore({ adapter: ad });
  await st.load();
  st.update("s", "problem", (it) => { it.work = "first"; });
  await st.flushNow();
  const p = st.flushNow();
  st.update("s", "problem", (it) => { it.work = "second"; });
  const a = st.addAttempt("s", "problem", { answer: {}, result: { overall: true } });
  await p;
  assert.ok(await settle(st, 4000));
  assert.strictEqual(ad.remote.items.s.work, "second");
  assert.ok(ad.remote.items.s.attempts.some((x) => x.attemptId === a.attemptId));
});

test("clear keeps attempt history and logs a clear event", async () => {
  mem.clear();
  const st = S.createStore({ adapter: memAdapter() });
  await st.load();
  st.addAttempt("k", "problem", { answer: {}, result: { overall: false } });
  st.update("k", "problem", (it) => { it.work = "abc"; });
  st.clear("k", "problem");
  const it = st.snapshot().items.k;
  assert.strictEqual(it.work, "");
  assert.strictEqual(it.attempts.length, 1);
  assert.strictEqual(it.events[it.events.length - 1].type, "clear");
});

test("editDraft is the single invalidation path: keeps the draft, clears the grade, never touches history", async () => {
  mem.clear();
  const ad = memAdapter();
  const st = S.createStore({ adapter: ad });
  await st.load();
  // quick check / quiz numeric
  st.addAttempt("q", "quickcheck", { answer: { raw: "15", normalized: "15" }, result: { correct: true, overall: true } }, (it) => { it.raw = "15"; it.normalized = "15"; it.correct = true; it.tries = 1; it.firstTryCorrect = true; });
  const hist = JSON.stringify(st.snapshot().items.q.attempts);
  st.editDraft("q", "quickcheck", { raw: "54" });
  let it = st.snapshot().items.q;
  assert.deepStrictEqual([it.raw, it.normalized, it.correct, it.tries, it.firstTryCorrect], ["54", "", null, 1, true]);
  assert.strictEqual(JSON.stringify(it.attempts), hist);
  // quiz MC
  st.addAttempt("m", "quiz", { answer: { choice: "a" }, result: { correct: true, overall: true } }, (x) => { x.choice = "a"; x.correct = true; });
  st.editDraft("m", "quiz", { choice: "b" });
  it = st.snapshot().items.m;
  assert.deepStrictEqual([it.choice, it.correct, it.normalized], ["b", null, ""]);
  assert.strictEqual(it.attempts.length, 1);
  // problem part with a self-mark
  st.addAttempt("p", "problem", { type: "self-check", selfMark: "got", answer: {}, result: { overall: true } }, (x) => { x.selfMark = "got"; x.overall = true; x.parts["p.ans"] = { raw: "x", normalized: "x", correct: true, checkedAt: "t" }; });
  st.addEvent("p", "problem", { type: "hint", level: 1 });
  const ev = JSON.stringify(st.snapshot().items.p.events);
  st.editDraft("p", "problem", { partId: "p.ans", raw: "y" });
  it = st.snapshot().items.p;
  assert.deepStrictEqual(it.parts["p.ans"], { raw: "y", normalized: null, correct: null, checkedAt: null });
  assert.deepStrictEqual([it.overall, it.selfMark, it.attempts.length], [null, null, 1]);
  assert.strictEqual(JSON.stringify(it.events), ev);
  // saved synchronously to the mirror and queued as a snapshot for the adapter
  const mirror = JSON.parse(mem.get(S.MIRROR_KEY));
  assert.strictEqual(mirror.store.items.p.parts["p.ans"].raw, "y");
  assert.ok(st.pending().some((c) => c.kind === "snapshot" && c.itemId === "p" && c.record.selfMark === null));
  assert.ok(await settle(st));
  assert.strictEqual(ad.remote.items.q.correct, null);
});

test("mergeStores is idempotent and order-independent for attempts", () => {
  const mk = (atts) => ({ schemaVersion: 2, siteId: S.SITE_ID, revision: 1, items: { i: { ...S.blankItem("i", "quiz"), attempts: atts } } });
  const a = { attemptId: "a", seq: 1, submittedAt: "2026-10-01T00:00:01Z" };
  const b = { attemptId: "b", seq: 2, submittedAt: "2026-10-01T00:00:02Z" };
  const c = { attemptId: "c", seq: 2, submittedAt: "2026-10-01T00:00:03Z" };
  const m1 = S.mergeStores(mk([a, b]), mk([a, c]), new Set());
  const m2 = S.mergeStores(mk([a, c]), mk([a, b]), new Set());
  const m3 = S.mergeStores(m1, m1, new Set());
  const ids = (m) => m.items.i.attempts.map((x) => x.attemptId);
  assert.deepStrictEqual(ids(m1), ["a", "b", "c"]);
  assert.deepStrictEqual(ids(m2), ["a", "b", "c"]);
  assert.deepStrictEqual(ids(m3), ["a", "b", "c"]);
});

(async () => {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); pass++; console.log(`  ok   ${t.name}`); }
    catch (e) { fail++; console.log(`  FAIL ${t.name}\n       ${e && e.stack ? e.stack.split("\n").slice(0, 3).join("\n       ") : e}`); }
  }
  console.log(`store: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
