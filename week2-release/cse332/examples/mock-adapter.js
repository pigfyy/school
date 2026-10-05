/* Mock storage adapter for the CSE 332 course sites (week 2 copy), used by the tests. Shows the adapter contract in INTEGRATION.md.
   Works in the browser (window.MockAdapter) and in Node (module.exports).

   const m = MockAdapter.create({ latencyMs: 300, failSaves: 2, failLoad: false });
   window.COURSE_SITE_STORAGE = m.adapter;   // before app.js loads

   Knobs (all can be changed at runtime through m.set({...})):
     latencyMs     delay before load()/save() settle
     failSaves     reject the next N save() calls with { code: "unavailable" }
     failAll       reject every save() until turned off
     failLoad      reject load()
     conflictNext  reject the next save() with { code: "conflict", remote } (remote = m.remote, or a store you set)
     conflictMode  "reject" (throw { code:"conflict", remote }) or "return" (resolve { conflict:true, remote })
   It records every change it accepted (m.changes) so tests can check exactly-once delivery. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MockAdapter = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function create(opts = {}) {
    const cfg = { latencyMs: 0, failSaves: 0, failAll: false, failLoad: false, conflictNext: false, conflictMode: "reject", conflictRemote: null, persistKey: null, ...opts };
    const m = {
      remote: cfg.initial ? clone(cfg.initial) : null, // what the "server" holds
      rev: 0,
      changes: [],          // every change accepted, in order
      saveCalls: 0,
      rejected: 0,
      set(o) { Object.assign(cfg, o); },
      get config() { return { ...cfg }; },
    };
    // optional: keep the fake server in sessionStorage so it survives page reloads in browser tests
    const persist = () => { if (cfg.persistKey && typeof sessionStorage !== "undefined") sessionStorage.setItem(cfg.persistKey, JSON.stringify({ remote: m.remote, rev: m.rev, changes: m.changes })); };
    if (cfg.persistKey && typeof sessionStorage !== "undefined") {
      try { const s = JSON.parse(sessionStorage.getItem(cfg.persistKey)); if (s) { m.remote = s.remote; m.rev = s.rev; m.changes = s.changes; } } catch { /* fresh */ }
    }
    m.adapter = {
      name: "mock",
      async load() {
        await sleep(cfg.latencyMs);
        if (cfg.failLoad) throw Object.assign(new Error("mock load failure"), { code: "unavailable" });
        return m.remote ? clone(m.remote) : null;
      },
      async save(store, change) {
        m.saveCalls++;
        await sleep(cfg.latencyMs);
        if (cfg.conflictNext) {
          cfg.conflictNext = false;
          m.rejected++;
          const remote = clone(cfg.conflictRemote || m.remote);
          if (cfg.conflictMode === "return") return { conflict: true, remote };
          throw Object.assign(new Error("mock conflict"), { code: "conflict", remote });
        }
        if (cfg.failAll || cfg.failSaves > 0) {
          if (cfg.failSaves > 0) cfg.failSaves--;
          m.rejected++;
          throw Object.assign(new Error("mock save failure"), { code: "unavailable" });
        }
        m.rev++;
        m.remote = clone({ ...store, rev: m.rev });
        m.changes.push(clone(change));
        persist();
        return { rev: m.rev };
      },
    };
    return m;
  }
  return { create };
});
