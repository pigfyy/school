/* CSE 331 week 4: simulators of Lectures 10 and 11's HelpQueue classes, line for line, with their fields visible.
   Pure functions: window.QueueSim in the browser, require() in Node. checks/cse331/w04/verify.mjs runs the real
   classes (and the notes' drafts, built by line edits) on the same operations and compares results and fields.

   make(kind) -> { join(id), next(), size(), waiting(), fields(), ri(), af() }
     Each operation returns { value } or { error: "ExceptionClass: message" }, as the Java does.
     fields() -> [[name, text]]: the concrete state. ri() -> true/false. af() -> the queue front first, or null
     where the representation invariant is false (the AF is not defined there).
   Kinds: list, linked, fast, faster (the lectures' classes); listBack (Lecture 10, exercise 2: next serves the
   back); fastNo66 (FastQueue without line 66); fastNo66NoCheck (also without every checkRep call);
   fasterDraft (FasterQueue's waiting with list.addAll(outbox) for lines 89 to 91). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.QueueSim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  class JavaError extends Error { constructor(cls, msg) { super(`${cls}: ${msg}`); this.cls = cls; } }
  const IAE = (m) => new JavaError("IllegalArgumentException", m);
  const NSE = (m) => new JavaError("NoSuchElementException", m);
  const ISE = (m) => new JavaError("IllegalStateException", m);
  const list = (xs) => `[${xs.join(", ")}]`;
  const set = (s) => `{${[...s].sort().join(", ")}}`;
  const dupFree = (xs) => new Set(xs).size === xs.length;
  const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

  function listQueue(back = false) {
    const queue = [];
    return {
      size: () => queue.length,
      join(id) { if (queue.includes(id)) throw IAE(`${id} is in the queue`); queue.push(id); },
      next() { if (!queue.length) throw NSE("the queue is empty"); return back ? queue.pop() : queue.shift(); },
      waiting: () => queue.slice(),
      fields: () => [["queue", list(queue)]],
      raw: () => `queue=${list(queue)}`,
      ri: () => dupFree(queue),
      af: () => queue.slice(),
    };
  }
  function linkedQueue() {
    let front = null, back = null;
    const chain = () => { const out = []; for (let n = front; n; n = n.next) out.push(n.netid); return out; };
    return {
      size: () => chain().length,
      join(id) {
        for (let n = front; n; n = n.next) if (n.netid === id) throw IAE(`${id} is already waiting`);
        const node = { netid: id, next: null };
        if (back === null) front = node; else back.next = node;
        back = node;
      },
      next() {
        if (front === null) throw NSE("nobody is waiting");
        const id = front.netid;
        front = front.next;
        if (front === null) back = null;
        return id;
      },
      waiting: chain,
      raw: () => `front=${front ? chain().join(" > ") : "null"}; back=${back ? back.netid : "null"}`,
      fields: () => [["front → … → back", chain().length ? chain().join(" → ") : "null"], ["back", back ? back.netid : "null"]],
      ri: () => { const c = chain(); if ((front === null) !== (back === null)) return false; if (front && (back.next !== null || c[c.length - 1] !== back.netid)) return false; return dupFree(c); },
      af: chain,
    };
  }
  function fastQueue({ forget66 = false, noCheck = false } = {}) {
    const queue = [], members = new Set();
    const ri = () => sameSet(members, new Set(queue)) && members.size === queue.length;
    const checkRep = () => {
      if (noCheck) return;
      if (!sameSet(members, new Set(queue))) throw ISE("members is not the queue");
      if (members.size !== queue.length) throw ISE("someone is in queue twice");
    };
    checkRep();
    return {
      size() { checkRep(); return members.size; },
      join(id) { checkRep(); if (members.has(id)) throw IAE(`${id} is in the queue`); queue.push(id); members.add(id); checkRep(); },
      next() { checkRep(); if (!queue.length) throw NSE("nobody is waiting"); const f = queue.shift(); if (!forget66) members.delete(f); checkRep(); return f; },
      waiting() { checkRep(); return queue.slice(); },
      fields: () => [["queue", list(queue)], ["members", set(members)]],
      raw: () => `queue=${list(queue)}; members=${set(members)}`,
      ri,
      af: () => (ri() ? queue.slice() : null),
    };
  }
  function fasterQueue({ draft = false } = {}) {
    const inbox = [], outbox = [], members = new Set();
    const ri = () => { const all = [...inbox, ...outbox]; return dupFree(all) && sameSet(members, new Set(all)); };
    const checkRep = () => {
      const w = new Set([...inbox, ...outbox]);
      if (!sameSet(members, w)) throw ISE("members is not the queue");
      if (members.size !== inbox.length + outbox.length) throw ISE("someone is in the queue twice");
    };
    const af = () => [...outbox.slice().reverse(), ...inbox];
    checkRep();
    return {
      size() { checkRep(); return members.size; },
      join(id) { checkRep(); if (members.has(id)) throw IAE(`${id} is in the queue`); inbox.push(id); members.add(id); checkRep(); },
      next() {
        checkRep();
        if (!members.size) throw NSE("nobody is waiting");
        if (!outbox.length) { for (let i = inbox.length - 1; i >= 0; i--) outbox.push(inbox[i]); inbox.length = 0; }
        const f = outbox.pop(); members.delete(f); checkRep(); return f;
      },
      waiting() { checkRep(); return draft ? [...outbox, ...inbox] : af(); },
      fields: () => [["inbox", list(inbox)], ["outbox", list(outbox)], ["members", set(members)]],
      raw: () => `inbox=${list(inbox)}; outbox=${list(outbox)}; members=${set(members)}`,
      ri,
      af: () => (ri() ? af() : null),
    };
  }
  const KINDS = {
    list: { label: "ListQueue (Lecture 10)", make: () => listQueue() },
    linked: { label: "LinkedQueue (Lecture 10)", make: () => linkedQueue() },
    fast: { label: "FastQueue (Lecture 11)", make: () => fastQueue() },
    faster: { label: "FasterQueue (Lecture 11)", make: () => fasterQueue() },
    listBack: { label: "ListQueue whose next serves the back (Lecture 10, exercise 2)", make: () => listQueue(true) },
    fastNo66NoCheck: { label: "FastQueue without line 66 and without checkRep", make: () => fastQueue({ forget66: true, noCheck: true }) },
    fastNo66: { label: "FastQueue without line 66, checkRep on", make: () => fastQueue({ forget66: true }) },
    fasterDraft: { label: "FasterQueue, draft waiting (outbox as stored)", make: () => fasterQueue({ draft: true }) },
  };
  function make(kind) {
    const q = KINDS[kind].make();
    const wrap = (fn) => (...a) => { try { const v = fn(...a); return { value: v === undefined ? null : v }; } catch (e) { if (e instanceof JavaError) return { error: e.message }; throw e; } };
    return { join: wrap(q.join), next: wrap(q.next), size: wrap(q.size), waiting: wrap(q.waiting), fields: q.fields, raw: q.raw, ri: q.ri, af: q.af };
  }
  return { KINDS, make };
});
