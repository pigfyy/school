"use strict";
/*
  Mock storage adapter for tests and local experiments. It behaves like a small backend:
  it keeps one store per page load in memory (optionally mirrored to sessionStorage so it survives reloads),
  can be slow, can fail, and can report conflicts.

  Use it by loading this file BEFORE js/store.js:
    <script src="../examples/mock-adapter.js"></script>
    <script>window.COURSE_SITE_STORAGE = MockAdapter.create({ latencyMs: 300 });</script>

  Or from the URL (handy in tests): index.html?mock=1&latency=300
  Controls at runtime: MockAdapter.instance.set({ failSaves: true }) / .set({ failSaves: false }) / .injectConflict(remoteStore)
  Every save() call is recorded in .log with its change batch, so tests can check that each attempt arrives exactly once.
*/
(function (root) {
  function create(opts = {}) {
    const cfg = { latencyMs: 0, failSaves: false, failLoads: false, persistKey: "mock-adapter:remote", ...opts };
    const log = [];
    let pendingConflict = null;
    const read = () => {
      try { const raw = root.sessionStorage.getItem(cfg.persistKey); return raw ? JSON.parse(raw) : null; } catch { return null; }
    };
    const write = (s) => { try { root.sessionStorage.setItem(cfg.persistKey, JSON.stringify(s)); } catch { /* ignore */ } };
    const wait = () => new Promise((r) => setTimeout(r, cfg.latencyMs));
    const delivered = () => {
      try { return JSON.parse(root.sessionStorage.getItem(`${cfg.persistKey}:delivered`) || "[]"); } catch { return []; }
    };

    const adapter = {
      name: "mock",
      log,
      get remote() { return read(); },
      set(next) { Object.assign(cfg, next); },
      injectConflict(remoteStore) { pendingConflict = remoteStore; },
      // every change record ever acknowledged, across reloads (for exactly-once checks)
      delivered,
      async load() {
        await wait();
        if (cfg.failLoads) throw new Error("mock: load failed");
        return read();
      },
      async save(store, change) {
        await wait();
        const entry = { at: new Date().toISOString(), change, ok: false };
        log.push(entry);
        if (cfg.failSaves) throw new Error("mock: save failed");
        if (pendingConflict) {
          const remote = pendingConflict;
          pendingConflict = null;
          write(remote);
          entry.conflict = true;
          return { conflict: true, remote };
        }
        const current = read();
        if (current && typeof current.revision === "number" && typeof change.baseRevision === "number" && change.baseRevision < current.revision) {
          entry.conflict = true;
          return { conflict: true, remote: current };
        }
        write(store);
        try {
          const d = delivered();
          d.push(...change.changes.map((c) => ({ changeId: c.changeId, kind: c.kind, itemId: c.itemId, attemptId: c.attempt && c.attempt.attemptId, eventId: c.event && c.event.eventId })));
          root.sessionStorage.setItem(`${cfg.persistKey}:delivered`, JSON.stringify(d));
        } catch { /* ignore */ }
        entry.ok = true;
        return { revision: store.revision };
      },
    };
    return adapter;
  }

  const api = { create, instance: null };
  root.MockAdapter = api;
  // URL opt-in: ?mock=1&latency=300&fail=1
  try {
    const q = new URLSearchParams(root.location.search);
    if (q.get("mock") === "1") {
      api.instance = create({ latencyMs: Number(q.get("latency") || 0), failSaves: q.get("fail") === "1" });
      root.COURSE_SITE_STORAGE = api.instance;
    }
  } catch { /* not a browser */ }
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : globalThis);
