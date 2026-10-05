"use strict";
/*
  Learner-state store for the CSE 312 week 2 site (same contract and schema as week 1). Contract: ../../INTEGRATION.md

  - The whole store is one JSON object: { schemaVersion, siteId, revision, updatedAt, items, legacy? }.
  - items[id] holds the latest snapshot of one gradable item plus its append-only attempts[] and events[].
  - Persistence goes through an async adapter: window.COURSE_SITE_STORAGE = { name, load(), save(store, change) }.
    If the host doesn't install one, a localStorage adapter is used.
  - Every mutation is written to a localStorage mirror at once (store + outbox), then flushed to the adapter
    in serialized, debounced batches with retry and backoff. Attempts and events are never coalesced.
  - Failures and conflicts surface only as transient notices (see onNotice); there is no save-status UI.
*/
(function (root) {
  const SITE_ID = "cse312-26au-week2";
  const SCHEMA_VERSION = 2;
  const MIRROR_KEY = `${SITE_ID}:mirror`;
  const LOCAL_ADAPTER_KEY = `${SITE_ID}:store`;
  const LEGACY_KEYS = []; // week 2 is new: no earlier stores to migrate from
  const SNAPSHOT_DELAY = 600;
  const ATTEMPT_DELAY = 150;
  const MAX_BACKOFF = 30000;

  // Week 2 has no schema v1 history. The map stays so the migration path (and its tests) keep one shape across weeks.
  const LEGACY_ID_MAP = {};
  const LEGACY_PARTS = {};

  const nowIso = () => new Date().toISOString();
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  let idCounter = 0;
  function uid(prefix) {
    const c = root.crypto;
    if (c && typeof c.randomUUID === "function") return `${prefix}-${c.randomUUID()}`;
    idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  const emptyStore = () => ({ schemaVersion: SCHEMA_VERSION, siteId: SITE_ID, revision: 0, updatedAt: null, items: {} });

  function blankItem(id, kind) {
    const base = { id, kind, updatedAt: null, attempts: [], events: [] };
    if (kind === "problem") {
      return { ...base, parts: {}, work: "", hintsRevealed: 0, hintLevels: [], solutionViewed: false, solutionViewedAt: null, selfMark: null, overall: null, firstTryCorrect: null };
    }
    if (kind === "quiz") {
      return { ...base, choice: null, raw: "", normalized: "", correct: null, tries: 0, firstTryCorrect: null, revealed: false };
    }
    return { ...base, raw: "", normalized: "", correct: null, tries: 0, firstTryCorrect: null, revealed: false };
  }

  /* ------------------------------------------------------------ migration */
  // Returns { store } for a usable store, or { unknown: true } for a version we can't read.
  function migrate(data) {
    if (!data || typeof data !== "object") return { store: emptyStore() };
    if (data.schemaVersion === SCHEMA_VERSION && data.siteId === SITE_ID && data.items && typeof data.items === "object") {
      const s = { ...emptyStore(), ...data };
      for (const [id, it] of Object.entries(s.items)) {
        if (!it || typeof it !== "object") { delete s.items[id]; continue; }
        it.attempts = Array.isArray(it.attempts) ? it.attempts : [];
        it.events = Array.isArray(it.events) ? it.events : [];
      }
      return { store: s };
    }
    if (typeof data.schemaVersion === "number" && data.schemaVersion > SCHEMA_VERSION) return { unknown: true };
    if (data.siteId && data.siteId !== SITE_ID) return { unknown: true };
    // v1 shapes: the template ({ version: 1, problems }) and the earlier trial ({ schema: ".../v1", items, log })
    const v1Items = data.version === 1 && data.problems ? data.problems : data.schema === `${SITE_ID}/v1` && data.items ? data.items : null;
    if (!v1Items) return { unknown: true };
    const out = emptyStore();
    out.migratedFrom = data.schema || "template/v1";
    for (const [oldId, old] of Object.entries(v1Items)) {
      const id = LEGACY_ID_MAP[oldId];
      if (!id || !old || typeof old !== "object") continue;
      const kind = id.includes("-qc-") ? "quickcheck" : id.includes("-quiz-") ? "quiz" : "problem";
      const it = blankItem(id, kind);
      it.updatedAt = old.updatedAt || null;
      if (kind === "problem") {
        const names = LEGACY_PARTS[id] || ["ans"];
        (old.answers || []).forEach((raw, i) => {
          if (raw && names[i]) it.parts[`${id}.${names[i]}`] = { raw: String(raw), normalized: null, correct: null, checkedAt: null };
        });
        it.work = typeof old.work === "string" ? old.work : "";
        it.hintsRevealed = Number(old.hintsShown) || 0;
        it.hintLevels = Array.from({ length: it.hintsRevealed }, (_, i) => i + 1);
        it.solutionViewed = Boolean(old.solutionSeen);
        it.selfMark = old.selfMark === "got" || old.selfMark === "missed" ? old.selfMark : null;
        it.overall = old.result === "right" ? true : old.result === "wrong" ? false : null;
      } else {
        const raw = old.response ?? old.value ?? (Array.isArray(old.answers) ? old.answers[0] : "") ?? "";
        it.raw = typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
      }
      // v1 kept no per-press history, so the migrated item has none. Nothing is fabricated.
      out.items[id] = it;
    }
    if (Array.isArray(data.log) && data.log.length) out.legacy = { log: data.log };
    return { store: out };
  }

  /* ------------------------------------------------------------ merge */
  function unionBy(a, b, key) {
    const map = new Map();
    for (const x of [...(a || []), ...(b || [])]) if (x && x[key] && !map.has(x[key])) map.set(x[key], x);
    return [...map.values()].sort((x, y) =>
      String(x.submittedAt || x.at).localeCompare(String(y.submittedAt || y.at)) || (x.seq || 0) - (y.seq || 0) || String(x[key]).localeCompare(String(y[key])));
  }
  // dirty = Set of item ids with unsent local snapshot changes: those keep their local snapshot fields.
  function mergeStores(local, remote, dirty) {
    const out = { ...emptyStore(), ...remote, items: {} };
    out.revision = Math.max(local.revision || 0, remote.revision || 0);
    const ids = new Set([...Object.keys(local.items), ...Object.keys(remote.items)]);
    for (const id of ids) {
      const l = local.items[id], r = remote.items[id];
      if (!l || !r) { out.items[id] = clone(l || r); continue; }
      const localWins = dirty.has(id) || String(l.updatedAt || "") > String(r.updatedAt || "");
      const base = clone(localWins ? l : r);
      base.attempts = unionBy(l.attempts, r.attempts, "attemptId");
      base.events = unionBy(l.events, r.events, "eventId");
      out.items[id] = base;
    }
    if (local.legacy && !out.legacy) out.legacy = local.legacy;
    out.updatedAt = [local.updatedAt, remote.updatedAt].filter(Boolean).sort().pop() || null;
    return out;
  }

  /* ------------------------------------------------------------ default adapter */
  const localStorageAdapter = {
    name: "localStorage",
    async load() {
      const raw = root.localStorage.getItem(LOCAL_ADAPTER_KEY);
      return raw ? JSON.parse(raw) : null;
    },
    // Same optimistic-concurrency rule a backend should use: reject a save based on an older revision.
    // That makes two open tabs merge instead of overwriting each other.
    async save(store, change) {
      const raw = root.localStorage.getItem(LOCAL_ADAPTER_KEY);
      const current = raw ? JSON.parse(raw) : null;
      if (current && typeof current.revision === "number" && change && typeof change.baseRevision === "number" && change.baseRevision < current.revision) {
        return { conflict: true, remote: current };
      }
      root.localStorage.setItem(LOCAL_ADAPTER_KEY, JSON.stringify(store));
      return { revision: store.revision };
    },
  };

  /* ------------------------------------------------------------ store */
  function createStore({ adapter } = {}) {
    let store = emptyStore();
    let outbox = []; // change records not yet acknowledged by the adapter, oldest first
    let remoteBlocked = false; // remote holds a store we can't read: never overwrite it
    let mirrorOk = true;
    let timer = null;
    let inFlight = false;
    let again = false;
    let failures = 0;
    let failingNoticeShown = false;
    let ready = false;
    const listeners = new Set();
    const notice = { fn: () => {} };
    const activeAdapter = adapter || root.COURSE_SITE_STORAGE || localStorageAdapter;

    /* --- mirror: synchronous local copy of store + outbox so nothing typed is lost */
    function writeMirror() {
      try {
        root.localStorage.setItem(MIRROR_KEY, JSON.stringify({ store, outbox }));
        if (!mirrorOk) mirrorOk = true;
      } catch {
        if (mirrorOk) notice.fn({ kind: "error", code: "local-storage", message: "This browser isn't letting the page keep a local copy. Your work stays on this page until you close it." });
        mirrorOk = false;
      }
    }
    function readMirror() {
      let raw = null;
      try { raw = root.localStorage.getItem(MIRROR_KEY); } catch { return null; }
      if (!raw) return null;
      try {
        const data = JSON.parse(raw);
        const m = migrate(data && data.store);
        if (m.unknown) {
          try { root.localStorage.setItem(`${MIRROR_KEY}:unreadable:${Date.now()}`, raw); } catch { /* best effort */ }
          return { unknown: true };
        }
        return { store: m.store, outbox: Array.isArray(data.outbox) ? data.outbox : [] };
      } catch {
        return null;
      }
    }
    function readLegacy() {
      for (const key of LEGACY_KEYS) {
        try {
          const raw = root.localStorage.getItem(key);
          if (!raw) continue;
          const m = migrate(JSON.parse(raw));
          if (m.store && Object.keys(m.store.items).length) return m.store;
        } catch { /* ignore unreadable legacy data */ }
      }
      return null;
    }

    function emit(change) {
      for (const fn of listeners) { try { fn(change); } catch (e) { console.error(e); } }
      try { root.dispatchEvent(new CustomEvent("course-site:change", { detail: clone(change) })); } catch { /* non-DOM */ }
    }

    function touch(item) {
      const t = nowIso();
      item.updatedAt = t;
      store.updatedAt = t;
    }

    function enqueue(change, delay) {
      if (change.kind === "snapshot") {
        // coalesce: only the latest snapshot per item needs sending
        outbox = outbox.filter((c) => !(c.kind === "snapshot" && c.itemId === change.itemId));
      }
      outbox.push(change);
      writeMirror();
      emit(change);
      schedule(delay);
    }

    function snapshotOf(item) {
      const { attempts, events, ...rest } = item;
      return clone(rest);
    }

    function baseChange(kind, itemId) {
      return { changeId: uid("chg"), kind, siteId: SITE_ID, schemaVersion: SCHEMA_VERSION, itemId, at: nowIso() };
    }

    /* --- flushing */
    function schedule(delay) {
      if (!ready) return; // flushed once load() finishes
      if (inFlight) { again = true; return; }
      if (failures > 0 && timer) return; // keep the backoff; the retry sends everything in the outbox
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    }

    async function flush() {
      clearTimeout(timer);
      timer = null;
      if (!ready || !outbox.length || remoteBlocked) return;
      if (inFlight) { again = true; return; }
      inFlight = true;
      const batch = outbox.slice();
      const change = { kind: "batch", batchId: uid("batch"), siteId: SITE_ID, schemaVersion: SCHEMA_VERSION, baseRevision: store.revision, changes: clone(batch) };
      const sent = new Set(batch.map((c) => c.changeId));
      try {
        const sendStore = clone(store);
        sendStore.revision = (store.revision || 0) + 1;
        const result = await activeAdapter.save(sendStore, change);
        if (result && (result.conflict || result.code === "conflict")) throw Object.assign(new Error("conflict"), { code: "conflict", remote: result.remote || result.store });
        outbox = outbox.filter((c) => !sent.has(c.changeId));
        store.revision = result && typeof result.revision === "number" ? result.revision : sendStore.revision;
        if (result && result.store && typeof result.store === "object") applyRemote(result.store, false);
        writeMirror();
        if (failures > 0 && failingNoticeShown) notice.fn({ kind: "recovered", message: "Back online. Everything you did has been saved." });
        failures = 0;
        failingNoticeShown = false;
      } catch (err) {
        if (err && err.code === "conflict") {
          // merge, then resend the whole outbox against the merged store
          await handleConflict(err.remote);
          failures += 1;
          if (failures > 3) scheduleRetry();
          else { clearTimeout(timer); timer = setTimeout(flush, 50); }
        } else {
          failures += 1;
          if (!failingNoticeShown) {
            failingNoticeShown = true;
            notice.fn({ kind: "error", code: "save-failed", message: "Couldn't save to the server. Your work is kept in this browser and we'll keep retrying.", error: String(err && err.message || err) });
          }
          scheduleRetry();
        }
      } finally {
        inFlight = false;
        // changes made while a save was in flight go out next (a pending retry timer already covers them)
        if (again && !timer) schedule(SNAPSHOT_DELAY);
        again = false;
      }
    }

    function scheduleRetry() {
      clearTimeout(timer);
      const wait = Math.min(MAX_BACKOFF, 1000 * 2 ** Math.min(failures - 1, 5));
      timer = setTimeout(flush, wait);
    }

    async function handleConflict(remote) {
      let incoming = remote;
      if (!incoming) {
        try { incoming = await activeAdapter.load(); } catch { incoming = null; }
      }
      if (incoming) applyRemote(incoming, true);
    }

    // Merge a remote store into the local one. Local unsent snapshot changes win; attempts/events are unioned.
    function applyRemote(remoteData, isConflict) {
      const m = migrate(remoteData);
      if (m.unknown) {
        remoteBlocked = true;
        notice.fn({ kind: "error", code: "unknown-version", message: "The server has saved work from a newer version of this site. It was left untouched; this page is only saving in this browser." });
        return;
      }
      const dirty = new Set(outbox.filter((c) => c.kind === "snapshot").map((c) => c.itemId));
      const before = JSON.stringify(store.items);
      store = mergeStores(store, m.store, dirty);
      // attempts/events present locally but missing remotely are still in the outbox, so they get sent again
      writeMirror();
      const changed = JSON.stringify(store.items) !== before;
      if (isConflict) {
        notice.fn({ kind: "conflict", message: "This work was also saved from another tab or device. Both copies were merged and nothing you typed was lost." });
      }
      if (changed) for (const fn of reloadListeners) { try { fn(); } catch (e) { console.error(e); } }
    }
    const reloadListeners = new Set();

    /* --- public API */
    const api = {
      siteId: SITE_ID,
      schemaVersion: SCHEMA_VERSION,
      adapterName: activeAdapter.name || "custom",

      /** Load the local mirror (sync), then the adapter (async). Resolves when both are merged. */
      async load() {
        const mirror = readMirror();
        if (mirror && mirror.store) {
          store = mirror.store;
          outbox = mirror.outbox;
        } else {
          const legacy = readLegacy();
          if (legacy) store = legacy;
        }
        if (mirror && mirror.unknown) {
          notice.fn({ kind: "error", code: "unknown-version", message: "Saved work from a newer version of this site was found in this browser. It was kept aside, untouched." });
        }
        for (const fn of reloadListeners) fn();
        try {
          const remote = await activeAdapter.load();
          if (remote) applyRemote(remote, false);
        } catch (err) {
          failures = 1;
          failingNoticeShown = true;
          notice.fn({ kind: "error", code: "load-failed", message: "Couldn't load your saved work from the server. Showing this browser's copy; we'll keep trying to save.", error: String(err && err.message || err) });
        }
        ready = true;
        if (outbox.length) schedule(0);
      },

      /** Latest snapshot for an item (a copy). Creates a blank record if none exists. */
      get(id, kind) {
        const it = store.items[id] || blankItem(id, kind || "problem");
        return clone(it);
      },
      has(id) { return Boolean(store.items[id]); },

      /** Update an item's latest-snapshot fields. mutate(item) edits a draft in place. Not an attempt. */
      update(id, kind, mutate) {
        const item = store.items[id] || (store.items[id] = blankItem(id, kind));
        mutate(item);
        touch(item);
        enqueue({ ...baseChange("snapshot", id), record: snapshotOf(item) }, SNAPSHOT_DELAY);
        return clone(item);
      },

      /**
       * The one invalidation path for every gradable input. Records an edited, ungraded draft and clears the
       * item's current grade: quickcheck/quiz → correct=null, normalized="" (keeps raw, or choice for MC);
       * problem part → { raw, normalized:null, correct:null, checkedAt:null }, overall=null, selfMark=null.
       * Saved synchronously to the local mirror like any snapshot. attempts[] and events[] are never touched.
       * draft = { raw } | { choice } | { partId, raw }
       */
      editDraft(id, kind, draft) {
        return api.update(id, kind, (it) => {
          if (kind === "problem") {
            it.parts[draft.partId] = { raw: draft.raw, normalized: null, correct: null, checkedAt: null };
            it.overall = null;
            it.selfMark = null;
          } else {
            if ("choice" in draft) { it.choice = draft.choice; it.raw = ""; } else it.raw = draft.raw;
            it.normalized = "";
            it.correct = null;
          }
        });
      },

      /** Append one submitted attempt. Never merged with other attempts. Returns the stored attempt. */
      addAttempt(id, kind, attempt, mutate) {
        const item = store.items[id] || (store.items[id] = blankItem(id, kind));
        const seq = item.attempts.reduce((m, a) => Math.max(m, a.seq || 0), 0) + 1;
        const rec = { attemptId: uid("att"), seq, itemId: id, submittedAt: nowIso(), ...clone(attempt) };
        item.attempts.push(rec);
        if (mutate) mutate(item, rec);
        touch(item);
        enqueue({ ...baseChange("attempt", id), attempt: clone(rec) }, ATTEMPT_DELAY);
        enqueue({ ...baseChange("snapshot", id), record: snapshotOf(item) }, ATTEMPT_DELAY);
        return clone(rec);
      },

      /** Append a timestamped event: type "hint" | "solution" | "reveal" | "clear". Not an attempt. */
      addEvent(id, kind, event, mutate) {
        const item = store.items[id] || (store.items[id] = blankItem(id, kind));
        const seq = item.events.reduce((m, e) => Math.max(m, e.seq || 0), 0) + 1;
        const rec = { eventId: uid("evt"), seq, itemId: id, at: nowIso(), ...clone(event) };
        item.events.push(rec);
        if (mutate) mutate(item, rec);
        touch(item);
        enqueue({ ...baseChange("event", id), event: clone(rec) }, ATTEMPT_DELAY);
        enqueue({ ...baseChange("snapshot", id), record: snapshotOf(item) }, ATTEMPT_DELAY);
        return clone(rec);
      },

      /** Reset an item's snapshot (answers, work, hints shown). attempts[] and events[] are kept. */
      clear(id, kind) {
        const old = store.items[id];
        if (!old) return;
        const fresh = blankItem(id, kind || old.kind);
        fresh.attempts = old.attempts;
        fresh.events = old.events;
        store.items[id] = fresh;
        api.addEvent(id, fresh.kind, { type: "clear" });
      },

      snapshot() { return clone(store); },
      pending() { return clone(outbox); },
      flushNow() { return flush(); },
      on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      onReload(fn) { reloadListeners.add(fn); return () => reloadListeners.delete(fn); },
      onNotice(fn) { notice.fn = fn; },
    };
    root.addEventListener && root.addEventListener("online", () => { if (outbox.length) schedule(0); });
    return api;
  }

  const exported = { createStore, migrate, mergeStores, blankItem, SITE_ID, SCHEMA_VERSION, MIRROR_KEY, LOCAL_ADAPTER_KEY, LEGACY_ID_MAP, localStorageAdapter };
  if (typeof module === "object" && module.exports) module.exports = exported;
  else root.CourseStore = exported;
})(typeof self !== "undefined" ? self : globalThis);
