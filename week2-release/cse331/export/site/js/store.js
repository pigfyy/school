/* Saved learner state for the CSE 331 week 2 site. Owns the store, the storage adapter contract, schema checks,
   the save queue (outbox), retries, conflict merging, and the append-only attempt history. Same design as the
   week 1 site's store (week1-release/cse331/site/js/store.js), without its trial-site migration.
   No DOM rendering here; app.js draws the UI. Works in Node too (tests/unit.mjs).

   Store (schemaVersion 1):
     { siteId, schemaVersion, updatedAt,
       items:    { [itemId]: snapshot },        latest state of a problem / quick check / quiz question
       attempts: { [itemId]: Attempt[] },       append-only; one per Check press or self-mark
       events:   { [itemId]: Event[] } }        append-only; hint reveals, solution views, clears, ...
   Change records go to adapter.save(store, change) one at a time, in order (or all at once to
   adapter.saveBatch(store, changes) if the adapter has it). See INTEGRATION.md. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CourseStore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SITE_ID = "cse331-26au-week2";
  const SCHEMA_VERSION = 1;
  const MIRROR_KEY = `${SITE_ID}:v${SCHEMA_VERSION}:mirror`; // this browser's copy: store + unsent changes
  const DEFAULT_KEY = `${SITE_ID}-v${SCHEMA_VERSION}`;       // the default adapter's key

  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  const emptyStore = () => ({ siteId: SITE_ID, schemaVersion: SCHEMA_VERSION, updatedAt: null, items: {}, attempts: {}, events: {} });
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

  // Returns { store, status }: status is "ok", "empty", "unknown-version", "other-site" or "malformed".
  // There is no earlier version of this site, so there is nothing to migrate yet. A future schemaVersion 2
  // would add its migration here, keyed on the version it reads.
  function normalize(data) {
    if (data == null) return { store: emptyStore(), status: "empty" };
    if (!isObj(data)) return { store: emptyStore(), status: "malformed" };
    const site = data.siteId ?? data.site;
    if (site !== undefined && site !== SITE_ID) return { store: emptyStore(), status: "other-site" };
    const version = data.schemaVersion ?? data.version;
    if (version !== SCHEMA_VERSION) return { store: emptyStore(), status: "unknown-version" };
    const s = emptyStore();
    s.updatedAt = data.updatedAt || null;
    for (const k of ["items", "attempts", "events"]) {
      if (!isObj(data[k])) continue;
      for (const [id, v] of Object.entries(data[k])) {
        if (k === "items" ? isObj(v) : Array.isArray(v)) s[k][id] = clone(v);
      }
    }
    return { store: s, status: "ok" };
  }

  /* ------------------------------------------------------------ merging two copies */
  const byTime = (key) => (a, b) => String(a[key]).localeCompare(String(b[key])) || (a.seq - b.seq) || String(a.attemptId || a.eventId).localeCompare(String(b.attemptId || b.eventId));
  function unionLog(a = [], b = [], idKey, timeKey) {
    const seen = new Map();
    for (const r of [...a, ...b]) if (r && r[idKey] && !seen.has(r[idKey])) seen.set(r[idKey], r);
    return [...seen.values()].sort(byTime(timeKey));
  }

  // Merge rules: attempts and events are unioned by attemptId / eventId (never lost, never duplicated).
  // Snapshots: an item with local changes not yet saved (dirty) keeps the local copy. Otherwise the copy
  // with the later updatedAt wins; ties keep the local copy. Returns the merged store and the item IDs
  // whose snapshot changed from the local copy.
  function merge(local, remote, dirtyIds = new Set()) {
    const out = emptyStore();
    const changed = [];
    const ids = new Set([...Object.keys(local.items), ...Object.keys(remote.items)]);
    for (const id of ids) {
      const l = local.items[id], r = remote.items[id];
      let pick = l;
      if (!dirtyIds.has(id)) {
        if (l === undefined) pick = r;
        else if (r !== undefined && String(r.updatedAt || "") > String(l.updatedAt || "")) pick = r;
      }
      if (pick !== undefined) out.items[id] = clone(pick);
      if (pick !== l) changed.push(id);
    }
    for (const [k, idKey, timeKey] of [["attempts", "attemptId", "submittedAt"], ["events", "eventId", "at"]]) {
      for (const id of new Set([...Object.keys(local[k]), ...Object.keys(remote[k])])) {
        const merged = unionLog(local[k][id], remote[k][id], idKey, timeKey);
        if (merged.length) out[k][id] = merged;
        if (k === "attempts" && merged.length !== (local[k][id] || []).length && !changed.includes(id)) changed.push(id);
      }
    }
    out.updatedAt = [local.updatedAt, remote.updatedAt].filter(Boolean).sort().pop() || null;
    return { store: out, changed };
  }

  /* ------------------------------------------------------------ edits invalidate the current grade */
  // The one rule for every graded input on the site. An edit (typed text, a new MC selection, a changed
  // self-check answer) keeps the draft (raw / choiceId) and clears the CURRENT grade for what it touched:
  //   quiz / quick check: correct, normalized, lastMessage; done falls back to "revealed".
  //   problem part:       that part's normalized and correct; an auto-graded part also clears the
  //                       problem's overall result, a self-check part clears selfMark.
  // History (tries, firstTryCorrect, checks) and attempts[] / events[] are never touched.
  // Mutates and returns snapshot `s`; `changed` says whether any grade was cleared.
  // part: { pid, self } for problems, omitted otherwise.
  function invalidateCurrentGrade(s, part) {
    let changed = false;
    const clear = (obj, key, value) => { if (obj[key] !== undefined && obj[key] !== null && obj[key] !== value) changed = true; obj[key] = value; };
    if (s.kind === "problem") {
      if (!part) throw new Error("invalidateCurrentGrade: problem edits need a part");
      const prev = (s.parts || {})[part.pid] || {};
      s.parts = { ...(s.parts || {}) };
      const next = { raw: prev.raw ?? "", normalized: prev.normalized ?? null, correct: prev.correct ?? null };
      clear(next, "normalized", null);
      clear(next, "correct", null);
      s.parts[part.pid] = next;
      if (part.self) clear(s, "selfMark", null);
      else clear(s, "result", null);
    } else {
      clear(s, "correct", null);
      clear(s, "normalized", null);
      clear(s, "lastMessage", null);
      if (s.kind === "quiz") clear(s, "done", Boolean(s.revealed));
    }
    return { state: s, changed };
  }

  /* ------------------------------------------------------------ adapters */
  function localStorageAdapter(storage, key = DEFAULT_KEY) {
    return {
      name: "localStorage",
      async load() { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : null; },
      async save(store) { storage.setItem(key, JSON.stringify(store)); },
    };
  }
  const isConflict = (x) => isObj(x) && (x.code === "conflict" || x.conflict === true);

  /* ------------------------------------------------------------ the store controller */
  // opts: adapter, storage (localStorage-like, for the mirror), notify(kind, info), onApplied(changedIds), beforeMerge(),
  //       emit(change), now(), uuid(), setTimeout, clearTimeout, debounceMs, retryBaseMs, retryMaxMs
  function create(opts = {}) {
    const storage = opts.storage || null;
    const adapter = opts.adapter || (storage ? localStorageAdapter(storage) : null);
    const notify = opts.notify || (() => {});
    const onApplied = opts.onApplied || (() => {});
    const emit = opts.emit || (() => {});
    const now = opts.now || (() => new Date().toISOString());
    // wrapped: calling the global timers as methods of another object throws "Illegal invocation" in browsers
    const T = { set: (fn, ms) => (opts.setTimeout || setTimeout)(fn, ms), clear: (t) => (opts.clearTimeout || clearTimeout)(t) };
    const debounceMs = opts.debounceMs ?? 400;
    const retryBaseMs = opts.retryBaseMs ?? 1000;
    const retryMaxMs = opts.retryMaxMs ?? 30000;
    let counter = 0;
    const uuid = opts.uuid || (() => {
      const c = typeof crypto !== "undefined" ? crypto : null;
      if (c && typeof c.randomUUID === "function") return c.randomUUID();
      counter++;
      return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    });

    let store = emptyStore();
    let outbox = [];          // change records not yet acknowledged by the adapter, oldest first
    let loaded = false;       // remote copy merged in; saving waits for this so a fresh device can't overwrite history
    let flushing = null;
    let timer = null;
    let failures = 0;
    let mirrorBroken = false;
    let loadAttempts = 0;
    let blocked = null;       // set when the remote copy is from an unknown (newer) schema: never overwrite it
    const stats = { saves: 0, failures: 0, conflicts: 0, delivered: 0 };

    /* ---- this browser's mirror: written synchronously on every change, so nothing typed is lost */
    function writeMirror() {
      if (!storage) return;
      try {
        storage.setItem(MIRROR_KEY, JSON.stringify({ store, outbox: outbox.map((c) => ({ ...c, inflight: undefined })) }));
        if (mirrorBroken) { mirrorBroken = false; }
      } catch (err) {
        if (!mirrorBroken) { mirrorBroken = true; notify("mirror-failed", { error: String(err) }); }
      }
    }
    function readMirror() {
      if (!storage) return null;
      try {
        const raw = storage.getItem(MIRROR_KEY);
        if (raw) {
          const m = JSON.parse(raw);
          const n = normalize(m.store);
          if (n.status === "ok") return { store: n.store, outbox: Array.isArray(m.outbox) ? m.outbox.filter((c) => isObj(c) && c.changeId) : [], status: "mirror" };
        }
      } catch { /* a corrupt mirror is treated as empty */ }
      return null;
    }

    const dirtyIds = () => new Set(outbox.filter((c) => c.kind === "snapshot" || c.kind === "reset").flatMap((c) => (c.kind === "reset" ? c.ids : [c.itemId])));

    function baseChange(kind, itemId) {
      return { changeId: uuid(), siteId: SITE_ID, schemaVersion: SCHEMA_VERSION, kind, itemId, at: now() };
    }
    function enqueue(change, { soon = false } = {}) {
      // a newer snapshot of the same item replaces an older one that hasn't been sent yet;
      // attempts, events and resets are never merged or dropped
      if (change.kind === "snapshot") {
        const i = outbox.findIndex((c) => c.kind === "snapshot" && c.itemId === change.itemId && !c.inflight);
        if (i !== -1) outbox.splice(i, 1);
      }
      outbox.push(change);
      store.updatedAt = change.at;
      writeMirror();
      emit(change);
      schedule(soon ? 30 : debounceMs);
    }

    function schedule(ms) {
      if (!loaded || failures) return; // before the remote copy is merged, or while backing off, the retry timer owns flushing
      if (timer) T.clear(timer);
      timer = T.set(() => { timer = null; flush(); }, ms);
    }

    async function applyRemote(remoteData, reason) {
      const n = normalize(remoteData);
      if (n.status === "unknown-version" || n.status === "other-site") {
        // Someone else's data, or a newer site's: keep working locally, and don't send anything that could overwrite it.
        blocked = n.status;
        notify("remote-ignored", { status: n.status, reason });
        return [];
      }
      if (n.status === "malformed") { notify("remote-ignored", { status: n.status, reason }); return []; }
      // let the UI write any half-typed drafts first, so they count as unsent local changes and win the merge
      if (opts.beforeMerge) opts.beforeMerge();
      const { store: merged, changed } = merge(store, n.store, dirtyIds());
      store = merged;
      writeMirror();
      if (changed.length) onApplied(changed);
      return changed;
    }

    async function sendOne(batch) {
      batch.forEach((c) => { c.inflight = true; });
      const snapshot = clone(store);
      const strip = (c) => { const { inflight, ...rest } = c; return rest; };
      try {
        stats.saves++;
        const res = adapter.saveBatch ? await adapter.saveBatch(snapshot, batch.map(strip)) : await adapter.save(snapshot, strip(batch[0]));
        if (isConflict(res)) throw res;
        const sent = new Set(batch.map((c) => c.changeId));
        outbox = outbox.filter((c) => !sent.has(c.changeId));
        stats.delivered += batch.length;
        writeMirror();
        return "ok";
      } catch (err) {
        batch.forEach((c) => { c.inflight = false; });
        if (isConflict(err)) {
          stats.conflicts++;
          let remote = err.remote;
          if (remote === undefined && adapter.load) remote = await adapter.load();
          await applyRemote(remote, "conflict");
          notify("conflict", {});
          return "conflict";
        }
        throw err;
      }
    }

    async function flush() {
      if (!adapter || !loaded || blocked) return false;
      if (flushing) return flushing;
      flushing = (async () => {
        let conflictsInARow = 0;
        try {
          while (outbox.length) {
            const batch = adapter.saveBatch ? outbox.slice() : [outbox[0]];
            const r = await sendOne(batch);
            if (r === "conflict") { if (++conflictsInARow > 5) throw Object.assign(new Error("too many conflicts"), { code: "conflict-loop" }); continue; }
            conflictsInARow = 0;
          }
          if (failures) { failures = 0; notify("recovered", {}); }
          return true;
        } catch (err) {
          failures++;
          stats.failures++;
          if (failures === 1) notify("save-failed", { error: String(err && err.message || err) });
          const delay = Math.min(retryMaxMs, retryBaseMs * 2 ** (failures - 1)) * (0.75 + Math.random() * 0.5);
          if (timer) T.clear(timer);
          timer = T.set(() => { timer = null; flushing = null; flush(); }, delay);
          return false;
        } finally {
          flushing = null;
        }
      })();
      return flushing;
    }

    async function loadRemote() {
      if (!adapter) { loaded = true; return; }
      try {
        loadAttempts++;
        const data = await adapter.load();
        await applyRemote(data, "load");
        loaded = true;
        if (loadAttempts > 1) notify("recovered", {});
        if (outbox.length) flush();
      } catch (err) {
        if (loadAttempts === 1) notify("load-failed", { error: String(err && err.message || err) });
        const delay = Math.min(retryMaxMs, retryBaseMs * 2 ** (loadAttempts - 1));
        timer = T.set(() => { timer = null; loadRemote(); }, delay);
      }
    }

    /* ---- public API */
    const api = {
      SITE_ID, SCHEMA_VERSION, MIRROR_KEY,
      adapterName: () => (adapter && adapter.name) || "none",
      // 1. read this browser's copy right away so the page works even if the adapter is slow or down
      start() {
        const m = readMirror();
        if (m) { store = m.store; outbox = m.outbox; }
        api.ready = loadRemote();
        return m ? m.status : "empty";
      },
      ready: Promise.resolve(),
      get: (id) => clone(store.items[id]) || null,
      attemptsOf: (id) => clone(store.attempts[id] || []),
      eventsOf: (id) => clone(store.events[id] || []),
      put(id, snapshot) {
        const state = { ...clone(snapshot), updatedAt: now() };
        store.items[id] = state;
        enqueue({ ...baseChange("snapshot", id), state: clone(state) });
        return clone(state);
      },
      // Appends one attempt. Never coalesced: every call is one record and one change.
      attempt(id, rec) {
        const log = store.attempts[id] || (store.attempts[id] = []);
        const seq = log.reduce((m, a) => Math.max(m, a.seq || 0), 0) + 1;
        const attempt = { attemptId: uuid(), seq, itemId: id, submittedAt: now(), ...clone(rec) };
        log.push(attempt);
        enqueue({ ...baseChange("attempt", id), attempt: clone(attempt) }, { soon: true });
        return clone(attempt);
      },
      event(id, type, detail = {}) {
        const log = store.events[id] || (store.events[id] = []);
        const seq = log.reduce((m, a) => Math.max(m, a.seq || 0), 0) + 1;
        const ev = { eventId: uuid(), seq, itemId: id, type, at: now(), ...clone(detail) };
        log.push(ev);
        enqueue({ ...baseChange("event", id), event: clone(ev) });
        return clone(ev);
      },
      // Clears the latest snapshots of these items (attempts and events stay).
      reset(ids, reason) {
        for (const id of ids) delete store.items[id];
        enqueue({ ...baseChange("reset", null), ids: [...ids], reason });
      },
      flush,
      exportState: () => clone(store),
      async importState(data) {
        // Only a store this site wrote (or null for an empty one) replaces the current store. Another site's
        // data, an unknown (newer) schemaVersion, or malformed data leaves everything as it was.
        const n = normalize(data);
        if (n.status !== "ok" && n.status !== "empty") return n.status;
        store = n.store;
        enqueue({ ...baseChange("reset", null), ids: Object.keys(store.items), reason: "import" }, { soon: true });
        return n.status;
      },
      pending: () => outbox.map((c) => ({ changeId: c.changeId, kind: c.kind, itemId: c.itemId })),
      stats: () => ({ ...stats, pending: outbox.length, failures, loaded, blocked }),
    };
    return api;
  }

  return { SITE_ID, SCHEMA_VERSION, MIRROR_KEY, DEFAULT_KEY, emptyStore, normalize, merge, invalidateCurrentGrade, localStorageAdapter, create };
});
