// The save API merges each PUT into the stored week, so two clients can't erase each other's answers.
// bun test tests/save.test.mjs
import { expect, test } from "bun:test";
import worker from "../deploy/worker.mjs";
import { localDb } from "../tools/serve.mjs";
import CourseStore from "../site/core/store.js";

const url = "http://local/api/state/cse332/w02";
const headers = { "oai-authenticated-user-id": "u1", "oai-authenticated-user-email": "u1@example.com" };

async function put(env, data, path = url) {
  const res = await worker.fetch(new Request(path, { method: "PUT", headers, body: JSON.stringify({ data }) }), env);
  expect(res.status).toBe(200);
  return res.json();
}
async function get(env, path = url) {
  const res = await worker.fetch(new Request(path, { headers }), env);
  return (await res.json()).data;
}
const item = (updatedAt, work, attempts = [], events = []) => ({ kind: "problem", updatedAt, work, attempts, events });
const attempt = (id, at) => ({ id, at, answer: id });

// After race(n), the next n reads are held until all n have happened, so n PUTs read the same old state.
function racingDb() {
  const db = localDb(":memory:");
  let held = [], n = 0;
  return {
    race: (k) => { held = []; n = k; },
    prepare: (sql) => ({
      bind: (...args) => {
        const st = db.prepare(sql).bind(...args);
        return {
          run: st.run,
          first: async () => {
            const row = await st.first();
            if (held.length < n) await new Promise((go) => { held.push(go); if (held.length === n) held.forEach((f) => f()); });
            return row;
          },
        };
      },
    }),
  };
}

const base = { items: { a: item("2026-11-01T00:00:00.000Z", "a0"), b: item("2026-11-01T00:00:00.000Z", "b0") } };

test("two clients that changed different items both survive", async () => {
  const env = { DB: localDb(":memory:") };
  await put(env, base);
  const tab1 = structuredClone(base), tab2 = structuredClone(base);
  tab1.items.a = item("2026-11-02T00:00:00.000Z", "a1");
  tab2.items.b = item("2026-11-02T00:00:01.000Z", "b2");
  tab2.items.c = item("2026-11-02T00:00:01.000Z", "c2");
  await put(env, tab1);
  await put(env, tab2);
  const saved = await get(env);
  expect(saved.items.a.work).toBe("a1");
  expect(saved.items.b.work).toBe("b2");
  expect(saved.items.c.work).toBe("c2");
  expect(saved).toEqual(CourseStore.merge(tab2, tab1));
});

test("the same item edited by both keeps the newer snapshot and every attempt", async () => {
  const env = { DB: localDb(":memory:") };
  await put(env, { items: { a: item("2026-11-02T00:00:05.000Z", "newer", [attempt("x", "2026-11-02T00:00:05.000Z")], [{ id: "e1", at: "2026-11-02T00:00:05.000Z", type: "hint" }]) } });
  await put(env, { items: { a: item("2026-11-02T00:00:03.000Z", "older", [attempt("y", "2026-11-02T00:00:03.000Z")]) } });
  const a = (await get(env)).items.a;
  expect(a.work).toBe("newer");
  expect(a.updatedAt).toBe("2026-11-02T00:00:05.000Z");
  expect(a.attempts.map((t) => t.id)).toEqual(["y", "x"]);
  expect(a.events.map((e) => e.id)).toEqual(["e1"]);
});

test("a stale client can't revert a newer item", async () => {
  const env = { DB: localDb(":memory:") };
  await put(env, base);
  const fresh = structuredClone(base);
  fresh.items.a = item("2026-11-03T00:00:00.000Z", "fresh");
  await put(env, fresh);
  await put(env, base);
  expect((await get(env)).items.a.work).toBe("fresh");
});

test("a cleared work field stays cleared when a stale client saves", async () => {
  const env = { DB: localDb(":memory:") };
  await put(env, base);
  const cleared = structuredClone(base);
  cleared.items.a = { ...cleared.items.a, work: "", updatedAt: "2026-11-03T00:00:00.000Z" };
  await put(env, cleared);
  await put(env, base);
  const a = (await get(env)).items.a;
  expect(a.work).toBe("");
  expect(a.updatedAt).toBe("2026-11-03T00:00:00.000Z");
});

test("data not shaped like {items} is replaced, as the test/w00 check expects", async () => {
  const env = { DB: localDb(":memory:") };
  const path = "http://local/api/state/test/w00";
  await put(env, { check: "one" }, path);
  const { updatedAt } = await put(env, { check: "two" }, path);
  expect(await get(env, path)).toEqual({ check: "two" });
  const res = await worker.fetch(new Request(path, { headers }), env);
  expect((await res.json()).updatedAt).toBe(updatedAt);
});

for (const seeded of [true, false]) {
  test(`concurrent PUTs don't lose a write (${seeded ? "row exists" : "first save"})`, async () => {
    const env = { DB: racingDb() };
    if (seeded) await put(env, base);
    env.DB.race(2);
    const tab1 = { items: { a: item("2026-11-04T00:00:00.000Z", "from tab 1") } };
    const tab2 = { items: { b: item("2026-11-04T00:00:00.000Z", "from tab 2") } };
    await Promise.all([put(env, tab1), put(env, tab2)]);
    const saved = await get(env);
    expect(saved.items.a.work).toBe("from tab 1");
    expect(saved.items.b.work).toBe("from tab 2");
  });
}
