/* A mock storage adapter for the CSE 331 week 2 site, for tests and for trying failure handling by hand.
   It keeps a "server" copy in memory and records every change record it accepts, in order.

   Browser:  <script src="../examples/mock-adapter.js"></script>
             <script>window.COURSE_SITE_STORAGE = MockAdapter.create({ latencyMs: 800 });</script>
             (before js/app.js). Then, from the console: COURSE_SITE_STORAGE.control.failNext(3) etc.
   Node:     const MockAdapter = require("./examples/mock-adapter.js");

   Options: latencyMs (or [min, max]), failRate (0..1, random failures), initial (server store),
            persistKey (sessionStorage key so the server copy survives a page reload in tests).
   control:  failNext(n), failAlways(on), conflictNext(remoteStore | fn(serverStore) -> remoteStore),
            failLoad(n), setLatency(ms), server(), changes(), reset(). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MockAdapter = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function create(opts = {}) {
    const ss = opts.persistKey && typeof sessionStorage !== "undefined" ? sessionStorage : null;
    const loadPersisted = () => { try { return ss ? JSON.parse(ss.getItem(opts.persistKey)) : null; } catch { return null; } };
    const persisted = loadPersisted();
    let server = persisted ? persisted.server : clone(opts.initial ?? null);
    let changes = persisted ? persisted.changes : [];
    let latency = opts.latencyMs ?? 0;
    let failCount = 0, failLoadCount = 0, failForever = false, conflict = null;
    const log = []; // every call, including failed ones: { op, ok, at, changeIds }
    const persist = () => { if (ss) ss.setItem(opts.persistKey, JSON.stringify({ server, changes })); };
    const wait = () => sleep(Array.isArray(latency) ? latency[0] + Math.random() * (latency[1] - latency[0]) : latency);

    const adapter = {
      name: "mock",
      async load() {
        await wait();
        if (failLoadCount > 0) { failLoadCount--; log.push({ op: "load", ok: false }); throw new Error("mock: load failed"); }
        log.push({ op: "load", ok: true });
        return clone(server);
      },
      async save(store, change) {
        await wait();
        if (failForever || failCount > 0 || (opts.failRate && Math.random() < opts.failRate)) {
          if (failCount > 0) failCount--;
          log.push({ op: "save", ok: false, changeIds: [change.changeId] });
          throw Object.assign(new Error("mock: save failed"), { code: "unavailable" });
        }
        if (conflict) {
          const remote = typeof conflict === "function" ? conflict(clone(server)) : clone(conflict);
          conflict = null;
          server = remote;
          persist();
          log.push({ op: "save", ok: false, conflict: true, changeIds: [change.changeId] });
          // Either style works with the site; this mock rejects with the remote copy attached.
          throw { code: "conflict", remote: clone(remote) };
        }
        server = clone(store);
        changes.push(clone(change));
        persist();
        log.push({ op: "save", ok: true, changeIds: [change.changeId] });
      },
      control: {
        failNext(n = 1) { failCount = n; },
        failAlways(on = true) { failForever = on; },
        failLoad(n = 1) { failLoadCount = n; },
        conflictNext(remote) { conflict = remote; },
        setLatency(ms) { latency = ms; },
        server: () => clone(server),
        changes: () => clone(changes),
        log: () => clone(log),
        reset() { server = null; changes = []; log.length = 0; failCount = failLoadCount = 0; failForever = false; conflict = null; persist(); },
      },
    };
    return adapter;
  }
  return { create };
});
