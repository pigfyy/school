/* CSE 332 week 1 · learner-state store.
   Owns ALL persisted state. The rest of the site reads and writes only through this module.

   - Async storage adapter: window.COURSE_SITE_STORAGE = { name, async load(), async save(store, change) }.
     Default: localStorage.
   - A synchronous localStorage MIRROR of the store and of the undelivered OUTBOX is written on every change,
     so typed text survives a slow, failing or absent adapter and a reload.
   - Saves are serialized: one adapter.save() in flight at a time. Snapshot changes for the same item coalesce;
     "attempt" and "event" changes NEVER coalesce. Each is delivered exactly once by its own save() call.
   - Failures retry with exponential backoff. Conflicts ({code:"conflict"}) are merged (attempts/events are unioned by
     id, locally-edited fields win) and retried.
   See INTEGRATION.md for the contract. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CourseStore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SCHEMA_VERSION = 2;

  const nowIso = () => new Date().toISOString();
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
  }

  /* ------------------------------------------------------------------ record shapes */
  const BLANK = {
    problem: () => ({
      kind: "problem",
      parts: {},               // partId -> PART (below)
      result: null,            // "right" | "wrong" | null   (latest Check over the auto-graded parts; null after any edit)
      selfMark: null,          // "got" | "missed" | null    (self-check problems; null after any edit)
      work: "",                // free-form work box (snapshot only, never graded)
      hintsRevealed: 0,
      solutionViewed: false,   // ever opened
      solutionOpen: false,     // open right now
      conflictCopies: [],      // text kept from the losing side of a merge
      attempts: [],            // append-only, see RECORD_SHAPES.attempt
      events: [],              // append-only: hint / solution / clear
      createdAt: null,
      updatedAt: null,
    }),
    part: () => ({ raw: "", normalized: null, correct: null, feedbackKind: null, detail: null }),
    quickcheck: () => ({
      kind: "quickcheck", raw: "", choice: null, normalized: null, correct: null, feedbackKind: null,
      attempts: [], events: [], createdAt: null, updatedAt: null,
    }),
    quiz: () => ({
      kind: "quiz", raw: "", choice: null, normalized: null, correct: null, feedbackKind: null, revealed: false,
      attempts: [], events: [], createdAt: null, updatedAt: null,
    }),
  };

  /* The ONE edit-invalidation rule. Called by every draft edit of every input type:
     keep the raw draft, clear the current grade. Never touches attempts[] or events[]. */
  function clearGrade(r) {
    if (r.kind === "problem") {
      r.result = null;
      r.selfMark = null;
      for (const p of Object.values(r.parts || {})) { p.normalized = null; p.correct = null; p.feedbackKind = null; p.detail = null; }
    } else {
      r.normalized = null; r.correct = null; r.feedbackKind = null;
    }
    return r;
  }

  // History helpers. "Clear my work" / "Start over" log a clear event; counts look at attempts after the last one.
  function lastClearAt(r) {
    let t = "";
    for (const e of r.events || []) if (e.type === "clear" && e.at > t) t = e.at;
    return t;
  }
  function liveAttempts(r) {
    if (!r) return [];
    const t = lastClearAt(r);
    return (r.attempts || []).filter((a) => a.submittedAt >= t).sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : a.submittedAt > b.submittedAt ? 1 : a.seq - b.seq));
  }
  function firstTryCorrect(r) {
    const a = liveAttempts(r)[0];
    return Boolean(a && a.result && a.result.overall === true && !a.solutionViewedBeforeSubmit);
  }

  const RECORD_SHAPES = {
    problem: Object.keys(BLANK.problem()),
    part: Object.keys(BLANK.part()),
    quickcheck: Object.keys(BLANK.quickcheck()),
    quiz: Object.keys(BLANK.quiz()),
    attempt: ["attemptId", "seq", "itemId", "itemKind", "submittedAt", "answer", "result", "feedbackKind",
      "hintsRevealedAtSubmit", "solutionViewedBeforeSubmit"],
    event: ["eventId", "seq", "itemId", "type", "at", "data"],
  };

  function emptyStore(siteId) {
    return { siteId, schemaVersion: SCHEMA_VERSION, rev: null, updatedAt: null, items: {} };
  }

  /* ------------------------------------------------------------------ migration
     v1 (latest-only records; attempts was a number) -> v2 (append-only attempts[] and events[]).
     Old records keep their latest snapshot; no attempts are fabricated. Their old count is kept as legacyAttemptCount. */
  function migrate(raw, siteId) {
    if (!raw || typeof raw !== "object") return { store: null, status: "empty" };
    if (raw.siteId && raw.siteId !== siteId) return { store: null, status: "other-site" };
    const v = raw.schemaVersion;
    if (v === SCHEMA_VERSION) return { store: normalizeStore(raw, siteId), status: "ok" };
    if (v === 1) {
      const out = emptyStore(siteId);
      out.rev = raw.rev ?? null;
      out.updatedAt = raw.updatedAt ?? null;
      for (const [id, rec] of Object.entries(raw.items || {})) {
        if (!rec || !BLANK[rec.kind]) continue;
        const r = { ...BLANK[rec.kind](), ...rec };
        if (typeof rec.attempts === "number") r.legacyAttemptCount = rec.attempts;
        if (typeof rec.tries === "number") r.legacyAttemptCount = rec.tries;
        if (rec.kind === "quiz" && rec.value !== undefined && r.raw === "") r.raw = String(rec.value ?? "");
        delete r.tries; delete r.firstTryCorrect; delete r.value; delete r.done;
        r.attempts = [];
        r.events = [];
        out.items[id] = r;
      }
      return { store: out, status: "migrated" };
    }
    if (typeof v === "number" && v > SCHEMA_VERSION) return { store: null, status: "newer-version" };
    return { store: null, status: "unknown-version" };
  }
  function normalizeStore(raw, siteId) {
    const out = emptyStore(siteId);
    out.rev = raw.rev ?? null;
    out.updatedAt = raw.updatedAt ?? null;
    for (const [id, rec] of Object.entries(raw.items || {})) {
      if (!rec || !BLANK[rec.kind]) continue; // unknown item kinds are ignored, not fatal
      const r = { ...BLANK[rec.kind](), ...rec };
      if (!Array.isArray(r.attempts)) r.attempts = [];
      if (!Array.isArray(r.events)) r.events = [];
      out.items[id] = r;
    }
    return out;
  }

  /* ------------------------------------------------------------------ merge (conflict resolution)
     attempts and events: union by attemptId / eventId, ordered by time then seq. Never dropped or duplicated.
     Snapshot fields: if the item was edited locally since the last successful save, local wins; otherwise the
     newer updatedAt wins. Losing non-empty work text that differs is kept in conflictCopies. */
  function unionBy(a = [], b = [], key, timeKey) {
    const seen = new Map();
    for (const x of [...a, ...b]) if (x && x[key] && !seen.has(x[key])) seen.set(x[key], x);
    return [...seen.values()].sort((x, y) => (x[timeKey] < y[timeKey] ? -1 : x[timeKey] > y[timeKey] ? 1 : (x.seq || 0) - (y.seq || 0)));
  }
  function mergeRecord(local, remote, localWins) {
    if (!local) return clone(remote);
    if (!remote) return clone(local);
    const winner = localWins || (local.updatedAt || "") >= (remote.updatedAt || "") ? local : remote;
    const loser = winner === local ? remote : local;
    const out = clone(winner);
    out.attempts = unionBy(local.attempts, remote.attempts, "attemptId", "submittedAt");
    out.events = unionBy(local.events, remote.events, "eventId", "at");
    if (out.kind === "problem") {
      out.hintsRevealed = Math.max(local.hintsRevealed || 0, remote.hintsRevealed || 0);
      out.solutionViewed = Boolean(local.solutionViewed || remote.solutionViewed);
      const copies = [...(local.conflictCopies || []), ...(remote.conflictCopies || [])];
      const lw = loser.work || "";
      if (lw.trim() && lw !== out.work && !(out.work || "").includes(lw) && !copies.some((c) => c.value === lw)) {
        copies.push({ field: "work", value: lw, keptAt: nowIso(), from: loser === remote ? "remote" : "local" });
      }
      out.conflictCopies = copies;
    }
    if (out.kind === "quiz") out.revealed = Boolean(local.revealed || remote.revealed);
    out.createdAt = [local.createdAt, remote.createdAt].filter(Boolean).sort()[0] || null;
    return out;
  }
  function mergeStores(local, remote, dirtyIds = new Set()) {
    const out = emptyStore(local.siteId);
    out.rev = remote.rev ?? local.rev ?? null;
    out.updatedAt = nowIso();
    const ids = new Set([...Object.keys(local.items || {}), ...Object.keys(remote.items || {})]);
    for (const id of ids) out.items[id] = mergeRecord(local.items[id], remote.items[id], dirtyIds.has(id));
    return out;
  }

  /* ------------------------------------------------------------------ default adapter */
  function localStorageAdapter(key) {
    return {
      name: "localStorage",
      async load() {
        try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
      },
      async save(store) {
        localStorage.setItem(key, JSON.stringify(store)); // throws QuotaExceeded / SecurityError -> handled as a failure
      },
    };
  }
  function memoryStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }

  /* ------------------------------------------------------------------ the store */
  function create(opts) {
    const siteId = opts.siteId;
    const ls = opts.localStorage || (typeof localStorage !== "undefined" ? localStorage : memoryStorage());
    const MIRROR = `${siteId}:mirror`, OUTBOX = `${siteId}:outbox`;
    const adapter = opts.adapter || localStorageAdapter(`${siteId}:store`);
    const notify = opts.onNotice || (() => {});
    const onExternal = opts.onExternalUpdate || (() => {});
    const emit = opts.onChange || (() => {});
    const timers = opts.timers || { set: (f, ms) => setTimeout(f, ms), clear: (t) => clearTimeout(t) };
    const SNAPSHOT_DEBOUNCE = opts.snapshotDebounceMs ?? 600;
    const BACKOFF = opts.backoffMs || [1000, 2000, 4000, 8000, 16000, 30000];

    let store = emptyStore(siteId);
    let outbox = [];               // pending change records, oldest first
    let dirty = new Set();         // items changed locally since the last successful save
    let inFlight = null, retryTimer = null, debounceTimer = null;
    let failStreak = 0, remoteBlocked = false;
    const listeners = new Set();

    function readMirror() {
      try {
        const m = migrate(JSON.parse(ls.getItem(MIRROR)), siteId);
        if (m.store) store = m.store;
        const ob = JSON.parse(ls.getItem(OUTBOX));
        if (Array.isArray(ob)) outbox = ob;
        for (const c of outbox) if (c.itemId) dirty.add(c.itemId);
      } catch { /* empty mirror */ }
    }
    function writeMirror() {
      try {
        ls.setItem(MIRROR, JSON.stringify(store));
        ls.setItem(OUTBOX, JSON.stringify(outbox));
        return true;
      } catch { return false; }
    }

    function record(id, kind) {
      if (!store.items[id]) {
        const r = BLANK[kind]();
        r.createdAt = nowIso();
        store.items[id] = r;
      }
      return store.items[id];
    }

    function enqueue(change, coalesce) {
      if (coalesce) {
        const i = outbox.findIndex((c) => c.kind === "snapshot" && c.itemId === change.itemId);
        if (i !== -1) outbox.splice(i, 1);
      }
      outbox.push(change);
      if (change.itemId) dirty.add(change.itemId);
      store.updatedAt = change.at;
      const okMirror = writeMirror();
      if (!okMirror && !opts.quietMirror) notify("mirror-failed");
      emit(change);
      listeners.forEach((fn) => fn(change));
    }
    function baseChange(kind, id, itemKind) {
      return { changeId: uuid(), siteId, schemaVersion: SCHEMA_VERSION, kind, itemId: id, itemKind, at: nowIso() };
    }

    /* Snapshot: in-progress input, work text, selections. Not an attempt. Coalesced and debounced. */
    function update(id, kind, mutate) {
      const r = record(id, kind);
      mutate(r);
      r.updatedAt = nowIso();
      const ch = baseChange("snapshot", id, kind);
      ch.record = clone(r);
      delete ch.record.attempts; delete ch.record.events; // history travels as its own records
      enqueue(ch, true);
      scheduleFlush(SNAPSHOT_DEBOUNCE);
      return r;
    }

    /* Attempt: one per Check/Submit press or self-mark. Never merged, never dropped. */
    function appendAttempt(id, kind, payload, mutate) {
      const r = record(id, kind);
      const seq = r.attempts.reduce((m, a) => Math.max(m, a.seq || 0), 0) + 1;
      const since = lastClearAt(r);
      const seen = r.events.some((e) => (e.type === "solution" || e.type === "reveal") && e.at >= since) || Boolean(r.solutionViewed || r.revealed);
      const attempt = {
        attemptId: uuid(),
        seq,
        itemId: id,
        itemKind: kind,
        submittedAt: nowIso(),
        answer: payload.answer,
        result: payload.result,
        feedbackKind: payload.feedbackKind ?? null,
        hintsRevealedAtSubmit: kind === "problem" ? r.hintsRevealed || 0 : 0,
        solutionViewedBeforeSubmit: seen,
      };
      r.attempts.push(attempt);
      if (mutate) mutate(r);
      r.updatedAt = attempt.submittedAt;
      const ch = baseChange("attempt", id, kind);
      ch.attempt = clone(attempt);
      ch.record = clone(r);
      delete ch.record.attempts; delete ch.record.events;
      enqueue(ch, false);
      scheduleFlush(0);
      return attempt;
    }

    /* Event: hint reveal, solution view, answer reveal, reset. Timestamped, append-only. */
    function logEvent(id, kind, type, data, mutate) {
      const r = record(id, kind);
      const seq = r.events.reduce((m, e) => Math.max(m, e.seq || 0), 0) + 1;
      const ev = { eventId: uuid(), seq, itemId: id, type, at: nowIso(), data: data || null };
      r.events.push(ev);
      if (mutate) mutate(r);
      r.updatedAt = ev.at;
      const ch = baseChange("event", id, kind);
      ch.event = clone(ev);
      ch.record = clone(r);
      delete ch.record.attempts; delete ch.record.events;
      enqueue(ch, false);
      scheduleFlush(0);
      return ev;
    }

    /* Clear the learner-editable snapshot of an item. History (attempts/events) is kept: it is append-only. */
    function clearItem(id, kind) {
      const r = store.items[id];
      if (!r) return;
      const keep = { attempts: r.attempts, events: r.events, createdAt: r.createdAt };
      store.items[id] = { ...BLANK[kind](), ...keep };
      logEvent(id, kind, "clear", null);
    }

    function scheduleFlush(ms) {
      if (remoteBlocked) return;
      if (retryTimer) return; // a backoff retry is pending; it will flush everything
      if (debounceTimer) timers.clear(debounceTimer);
      debounceTimer = timers.set(() => { debounceTimer = null; flush(); }, ms);
    }

    async function flush() {
      if (remoteBlocked) return false;
      if (inFlight) return inFlight;
      inFlight = (async () => {
        let conflicts = 0;
        while (outbox.length) {
          const change = outbox[0];
          let result;
          try {
            result = await adapter.save(clone(store), clone(change));
          } catch (err) {
            if (err && err.code === "conflict" && conflicts < 5) {
              conflicts++;
              await resolveConflict(err.remote);
              continue;
            }
            failStreak++;
            if (failStreak === 1) notify("save-failed", err);
            const delay = BACKOFF[Math.min(failStreak - 1, BACKOFF.length - 1)];
            retryTimer = timers.set(() => { retryTimer = null; flush(); }, delay);
            return false;
          }
          if (result && result.conflict && conflicts < 5) {
            conflicts++;
            await resolveConflict(result.remote);
            continue;
          }
          if (result && result.rev !== undefined) store.rev = result.rev;
          outbox.shift();
          if (!outbox.some((c) => c.itemId === change.itemId)) dirty.delete(change.itemId);
          writeMirror();
        }
        if (failStreak > 0) { failStreak = 0; notify("save-recovered"); }
        return true;
      })();
      try { return await inFlight; } finally { inFlight = null; }
    }

    async function resolveConflict(remoteRaw) {
      let remote = remoteRaw;
      if (!remote) { try { remote = await adapter.load(); } catch { remote = null; } }
      const m = migrate(remote, siteId);
      if (!m.store) return;
      store = mergeStores(store, m.store, dirty);
      // every change still in the outbox now refers to the merged record
      writeMirror();
      notify("conflict-merged");
      onExternal(store);
    }

    // The local mirror is read synchronously at construction, so the page can restore typed work
    // before (or without) the adapter answering.
    readMirror();

    async function init() {
      let raw = null, failed = false;
      try { raw = await adapter.load(); } catch (err) { failed = true; notify("load-failed", err); }
      if (!failed) {
        const m = migrate(raw, siteId);
        if (m.status === "newer-version") {
          remoteBlocked = true; // never overwrite data written by a newer site version
          notify("newer-version");
        } else if (m.store) {
          store = mergeStores(store, m.store, dirty);
          if (m.status === "migrated") outbox.push({ ...baseChange("migrate", null, null), from: 1 });
        }
        writeMirror();
        onExternal(store);
      }
      if (outbox.length) scheduleFlush(0);
      return store;
    }

    return {
      SCHEMA_VERSION,
      siteId,
      get adapterName() { return adapter.name || "custom"; },
      get state() { return store; },
      get pending() { return outbox.length; },
      get blocked() { return remoteBlocked; },
      get(id) { return store.items[id]; },
      init, update, appendAttempt, logEvent, clearItem, flush,
      // stop timers (tests; a host tearing the page down). Pending changes stay in the local outbox.
      dispose() { if (retryTimer) timers.clear(retryTimer); if (debounceTimer) timers.clear(debounceTimer); retryTimer = debounceTimer = null; remoteBlocked = true; },
      replace(next) {
        const m = migrate(next, siteId);
        if (!m.store) throw new Error(`can't import: ${m.status}`);
        store = m.store;
        dirty = new Set(Object.keys(store.items));
        enqueue(baseChange("reset", null, null), false);
        scheduleFlush(0);
      },
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    };
  }

  return { create, migrate, mergeStores, emptyStore, clearGrade, liveAttempts, firstTryCorrect, SCHEMA_VERSION, RECORD_SHAPES, BLANK, uuid };
});
