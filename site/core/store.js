/* Saved answers for one course week. One JSON document per (course, week):

     { items: { "<item id>": { kind, title, updatedAt, ...latest state, attempts: [...], events: [...] } } }

   Every change is written to localStorage right away, then sent whole to the site's API
   (PUT /api/state/<course>/<week>) after a short pause. On load the API copy is merged in:
   attempts and events are unioned by id, and the newer snapshot of each item wins.
   Opened from file:// (or if the API is missing) it simply stays in localStorage. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CourseStore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const now = () => new Date().toISOString();
  const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

  function unionById(a = [], b = [], timeKey) {
    const seen = new Map();
    for (const x of [...a, ...b]) if (x && x.id && !seen.has(x.id)) seen.set(x.id, x);
    return [...seen.values()].sort((x, y) => (x[timeKey] < y[timeKey] ? -1 : x[timeKey] > y[timeKey] ? 1 : 0));
  }
  function merge(local, remote) {
    const out = { items: {} };
    const ids = new Set([...Object.keys(local.items || {}), ...Object.keys(remote.items || {})]);
    for (const id of ids) {
      const l = local.items[id], r = remote.items[id];
      if (!l || !r) { out.items[id] = l || r; continue; }
      const newer = (l.updatedAt || "") >= (r.updatedAt || "") ? l : r;
      out.items[id] = { ...newer, attempts: unionById(l.attempts, r.attempts, "at"), events: unionById(l.events, r.events, "at") };
    }
    return out;
  }

  // opts: { course, week, api = true, onError(kind), onRemote() }
  function create({ course, week, api = true, onError = () => {}, onRemote = () => {} }) {
    const key = `study:${course}:${week}`;
    const url = `/api/state/${course}/${week}`;
    const useApi = api && typeof location !== "undefined" && /^https?:$/.test(location.protocol) && typeof fetch === "function";
    let state = { items: {} };
    try { state = JSON.parse(localStorage.getItem(key)) || state; } catch { /* no localStorage */ }
    if (!state.items) state = { items: {} };

    let timer = null, failing = false, loaded = !useApi;
    function writeLocal() { try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* private mode */ } }
    async function push() {
      timer = null;
      if (!useApi || !loaded) return;
      try {
        const res = await fetch(url, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: state }) });
        if (!res.ok) throw new Error(`save ${res.status}`);
        if (failing) { failing = false; onError("recovered"); }
      } catch {
        if (!failing) { failing = true; onError("save-failed"); }
        timer = setTimeout(push, 15000);
      }
    }
    function changed() {
      writeLocal();
      if (useApi && !timer) timer = setTimeout(push, 800);
    }

    async function load() {
      if (!useApi) return;
      try {
        const res = await fetch(url);
        if (res.status === 404) { loaded = true; return; } // no API on this host: localStorage only
        if (!res.ok) throw new Error(`load ${res.status}`);
        const body = await res.json();
        if (body && body.data && body.data.items) { state = merge(state, body.data); writeLocal(); onRemote(); }
        loaded = true;
        changed(); // send anything made offline or before the load finished
      } catch {
        onError("load-failed");
      }
    }

    const blank = (kind) => ({ kind, attempts: [], events: [] });
    const store = {
      get: (id) => state.items[id] || null,
      // Replace an item's latest state (attempts and events are kept).
      put(id, kind, fields) {
        const old = state.items[id] || blank(kind);
        state.items[id] = { ...old, ...fields, kind, attempts: old.attempts, events: old.events, updatedAt: now() };
        changed();
        return state.items[id];
      },
      attempt(id, kind, attempt) {
        const r = state.items[id] || store.put(id, kind, {});
        r.attempts.push({ id: uid(), at: now(), ...attempt });
        r.updatedAt = now();
        changed();
      },
      event(id, kind, type, data = {}) {
        const r = state.items[id] || store.put(id, kind, {});
        r.events.push({ id: uid(), at: now(), type, ...data });
        r.updatedAt = now();
        changed();
      },
      // Start an item over: its latest state goes, its history stays.
      clear(id) {
        const r = state.items[id];
        if (!r) return;
        state.items[id] = { kind: r.kind, title: r.title, attempts: r.attempts, events: [...r.events, { id: uid(), at: now(), type: "clear" }], updatedAt: now() };
        changed();
      },
      load,
      flush: () => { if (timer) { clearTimeout(timer); return push(); } },
      data: () => state,
    };
    return store;
  }

  return { create, merge };
});
