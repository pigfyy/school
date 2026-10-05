/* Models of Lecture 2's code (Procedural abstraction and specification), with Java semantics.
   Used by the site (window.SpecSim) and by tests/compare-java.mjs, which checks every function here
   against the real Java in tests/java/SpecMany.java.

   indexOf: the four implementations from "Meeting a specification", the five specifications A-E,
            and checkers that say whether one call's outcome keeps a specification's promise.
   count:   the client from "Writing a client", run against any implementation.
   sign:    the three implementations and three specifications from exercises 2-4, with Java int math
            (Math.abs(Integer.MIN_VALUE) is Integer.MIN_VALUE; x / 0 throws ArithmeticException).
   Outcomes are { value } or { exception, message }. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SpecSim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  class JavaThrow extends Error {
    constructor(exception, message) { super(message); this.exception = exception; this.javaMessage = message; }
  }
  const aioobe = (i, len) => new JavaThrow("ArrayIndexOutOfBoundsException", `Index ${i} out of bounds for length ${len}`);
  const get = (a, i) => { if (i < 0 || i >= a.length) throw aioobe(i, a.length); return a[i]; };

  function outcome(fn) {
    try { return { value: fn() }; } catch (e) {
      if (e instanceof JavaThrow) return { exception: e.exception, message: e.javaMessage };
      throw e;
    }
  }

  /* ------------------------------------------------------------ indexOf implementations */
  const IMPLS = {
    1(a, lo, hi, x) { for (let i = lo; i < hi; i++) if (get(a, i) === x) return i; return -1; },
    2(a, lo, hi, x) {
      for (let i = lo; i < hi; i++) if (get(a, i) === x) return i;
      throw new JavaThrow("NoSuchElementException", null);
    },
    3(a, lo, hi, x) { let i = lo; while (get(a, i) !== x) i++; return i; },
    4(a, lo, hi, x) { for (let i = hi - 1; i >= lo; i--) if (get(a, i) === x) return i; return -1; },
  };
  const indexOf = (impl, a, lo, hi, x) => outcome(() => IMPLS[impl](a, lo, hi, x));

  /* ------------------------------------------------------------ specifications A-E */
  const rangeOk = (a, lo, hi) => 0 <= lo && lo <= hi && hi <= a.length;
  const matches = (a, lo, hi, x) => { const m = []; for (let i = lo; i < hi; i++) if (a[i] === x) m.push(i); return m; };

  // pre(call) -> bool; ok(call, outcome) -> bool (only asked when pre is true)
  const SPECS = {
    A: {
      requires: "0 <= lo <= hi <= a.length, and a[i] == x for some i with lo <= i < hi",
      returns: "an index i with lo <= i < hi and a[i] == x",
      pre: (a, lo, hi, x) => rangeOk(a, lo, hi) && matches(a, lo, hi, x).length > 0,
      ok: (a, lo, hi, x, o) => "value" in o && matches(a, lo, hi, x).includes(o.value),
      want: () => "some match",
    },
    B: {
      requires: "0 <= lo <= hi <= a.length",
      returns: "the smallest index i with lo <= i < hi and a[i] == x, or -1 if there is none",
      pre: (a, lo, hi) => rangeOk(a, lo, hi),
      ok: (a, lo, hi, x, o) => { const m = matches(a, lo, hi, x); return "value" in o && o.value === (m.length ? m[0] : -1); },
      want: (a, lo, hi, x) => { const m = matches(a, lo, hi, x); return m.length ? `${m[0]} (the smallest match)` : "-1"; },
    },
    C: {
      requires: "0 <= lo <= hi <= a.length",
      returns: "the largest index i with lo <= i < hi and a[i] == x, or -1 if there is none",
      pre: (a, lo, hi) => rangeOk(a, lo, hi),
      ok: (a, lo, hi, x, o) => { const m = matches(a, lo, hi, x); return "value" in o && o.value === (m.length ? m[m.length - 1] : -1); },
      want: (a, lo, hi, x) => { const m = matches(a, lo, hi, x); return m.length ? `${m[m.length - 1]} (the largest match)` : "-1"; },
    },
    D: {
      requires: "0 <= lo <= hi <= a.length",
      returns: "some index i with lo <= i < hi and a[i] == x, or -1 if there is none",
      pre: (a, lo, hi) => rangeOk(a, lo, hi),
      ok: (a, lo, hi, x, o) => { const m = matches(a, lo, hi, x); return "value" in o && (m.length ? m.includes(o.value) : o.value === -1); },
      want: (a, lo, hi, x) => { const m = matches(a, lo, hi, x); return m.length ? `any of ${m.join(", ")}` : "-1"; },
    },
    E: {
      requires: "0 <= lo <= hi <= a.length",
      returns: "the smallest index i with lo <= i < hi and a[i] == x; throws NoSuchElementException if there is none",
      pre: (a, lo, hi) => rangeOk(a, lo, hi),
      ok: (a, lo, hi, x, o) => {
        const m = matches(a, lo, hi, x);
        return m.length ? "value" in o && o.value === m[0] : o.exception === "NoSuchElementException";
      },
      want: (a, lo, hi, x) => { const m = matches(a, lo, hi, x); return m.length ? `${m[0]} (the smallest match)` : "a NoSuchElementException"; },
    },
  };

  // Does this outcome of this call keep spec S's promise? "vacuous" when the call breaks S's precondition.
  function judgeCall(spec, a, lo, hi, x, o) {
    const S = SPECS[spec];
    if (!S.pre(a, lo, hi, x)) return { verdict: "vacuous", want: "nothing (the call breaks the precondition)" };
    return { verdict: S.ok(a, lo, hi, x, o) ? "kept" : "broken", want: S.want(a, lo, hi, x) };
  }

  // The lecture's test domain: every array of up to four elements drawn from 0, 1, 2,
  // every range 0 <= lo <= hi <= a.length, and every x from 0 to 3.
  function* lectureDomain(maxLen = 4) {
    const arrays = [[]];
    for (let len = 1; len <= maxLen; len++) {
      const n = 3 ** len;
      for (let k = 0; k < n; k++) { const a = []; let r = k; for (let j = 0; j < len; j++) { a.push(r % 3); r = Math.floor(r / 3); } arrays.push(a); }
    }
    for (const a of arrays) for (let lo = 0; lo <= a.length; lo++) for (let hi = lo; hi <= a.length; hi++) for (let x = 0; x <= 3; x++) yield [a, lo, hi, x];
  }

  // Which specs does an implementation meet on the domain? Returns { A: {meets, counterexample}, ... }
  function meetsTable(impl, run = indexOf) {
    const res = {};
    for (const s of Object.keys(SPECS)) res[s] = { meets: true, counterexample: null };
    for (const [a, lo, hi, x] of lectureDomain()) {
      const o = run(impl, a, lo, hi, x);
      for (const s of Object.keys(SPECS)) {
        if (!res[s].meets) continue;
        if (judgeCall(s, a, lo, hi, x, o).verdict === "broken") res[s] = { meets: false, counterexample: { a, lo, hi, x, outcome: o } };
      }
    }
    return res;
  }

  /* ------------------------------------------------------------ the client count */
  // Steps of count(a, x) against one implementation. Every search starts strictly after the last
  // match, so there are at most a.length + 1 calls; nothing is cut short.
  function count(impl, a, x) {
    const calls = [];
    let c = 0;
    let lo = 0;
    for (;;) {
      const o = indexOf(impl, a, lo, a.length, x);
      calls.push({ lo, hi: a.length, outcome: o, cBefore: c });
      if ("exception" in o) return { calls, result: o, c };
      if (o.value === -1) return { calls, result: { value: c }, c };
      c++;
      lo = o.value + 1;
      if (calls.length > a.length + 2) throw new Error("count did not terminate as expected"); // cannot happen
    }
  }
  const trueCount = (a, x) => a.filter((v) => v === x).length;

  /* ------------------------------------------------------------ sign */
  const INT_MIN = -2147483648;
  const toInt = (n) => Number(BigInt.asIntN(32, BigInt(n)));
  const SIGN_IMPLS = {
    1: (x) => (x > 0 ? 1 : x < 0 ? -1 : 0), // Integer.signum
    2: (x) => x,
    3: (x) => {
      const abs = x === INT_MIN ? INT_MIN : Math.abs(x); // Math.abs(Integer.MIN_VALUE) overflows to itself
      if (abs === 0) throw new JavaThrow("ArithmeticException", "/ by zero");
      return toInt(Math.trunc(x / abs));
    },
  };
  const sign = (impl, x) => outcome(() => SIGN_IMPLS[impl](x));
  const SIGN_SPECS = {
    S1: { pre: () => true, ok: (x, o) => "value" in o && o.value === (x > 0 ? 1 : x < 0 ? -1 : 0) },
    S2: { pre: () => true, ok: (x, o) => "value" in o && (x > 0 ? o.value > 0 : x < 0 ? o.value < 0 : o.value === 0) },
    S3: { pre: (x) => x !== 0, ok: (x, o) => "value" in o && o.value === (x > 0 ? 1 : -1) },
  };
  const SIGN_DOMAIN = [INT_MIN, INT_MIN + 1, -1000000, -5, -2, -1, 0, 1, 2, 3, 5, 1000000, 2147483646, 2147483647];

  /* ------------------------------------------------------------ maxList (exercise 1) */
  function maxList(list) {
    return outcome(() => {
      if (list.length === 0) throw new JavaThrow("IndexOutOfBoundsException", "Index 0 out of bounds for length 0");
      let max = list[0];
      for (let i = 1; i < list.length; i++) if (list[i] > max) max = list[i];
      return max;
    });
  }

  /* ------------------------------------------------------------ sumList, front to back and back to front */
  // "the implementer of sumList is free to add up the list from the end instead of the start"
  const sumForward = (list) => { let s = 0n; for (let i = 0; i < list.length; i++) s = BigInt.asIntN(32, s + BigInt(list[i])); return s; };
  const sumBackward = (list) => { let s = 0n; for (let i = list.length - 1; i >= 0; i--) s = BigInt.asIntN(32, s + BigInt(list[i])); return s; };

  /* ------------------------------------------------------------ middle (slide "A specification in Java") */
  // @requires list has an odd number of elements; @return the element with as many elements before it as after it
  function middle(list) {
    return outcome(() => {
      const i = Math.floor(list.length / 2);
      if (i >= list.length) throw new JavaThrow("IndexOutOfBoundsException", `Index ${i} out of bounds for length ${list.length}`);
      return list[i];
    });
  }
  const middleSpec = {
    pre: (list) => list.length % 2 === 1,
    ok: (list, o) => "value" in o && o.value === list[(list.length - 1) / 2],
  };

  /* ------------------------------------------------------------ parsing a call typed by a student */
  // Accepts "indexOf(new int[]{5, 1, 5}, 0, 3, 5)", "{5,1,5}, 0, 3, 5" or "[5, 1, 5] 0 3 5".
  function parseCall(text) {
    const s = String(text).trim().replace(/[−–]/g, "-").replace(/^indexOf\s*\(/, "").replace(/\)\s*;?\s*$/, "").replace(/new\s+int\s*\[\s*\]\s*/, "");
    const m = /^[[{]\s*([^\]}]*)[\]}]\s*,?\s*(-?\d+)\s*,?\s*(-?\d+)\s*,?\s*(-?\d+)\s*$/.exec(s);
    if (!m) return null;
    const a = m[1].trim() ? m[1].split(/\s*,\s*|\s+/).map((t) => (/^-?\d+$/.test(t) ? Number(t) : NaN)) : [];
    if (a.some((v) => !Number.isSafeInteger(v) || Math.abs(v) > 2147483647)) return null;
    const [lo, hi, x] = [m[2], m[3], m[4]].map(Number);
    if (a.length > 12) return { error: "Keep the array to 12 elements or fewer." };
    return { a, lo, hi, x, normalized: `[${a.join(",")}],${lo},${hi},${x}` };
  }
  // Accepts "[5, 1, 5, 2, 5], 5" or "{5,1,5,2,5} 5" (an array and x, for count)
  function parseArrayX(text) {
    const s = String(text).trim().replace(/[−–]/g, "-").replace(/new\s+int\s*\[\s*\]\s*/, "");
    const m = /^[[{]\s*([^\]}]*)[\]}]\s*,?\s*(-?\d+)\s*$/.exec(s);
    if (!m) return null;
    const a = m[1].trim() ? m[1].split(/\s*,\s*|\s+/).map((t) => (/^-?\d+$/.test(t) ? Number(t) : NaN)) : [];
    if (a.some((v) => !Number.isSafeInteger(v) || Math.abs(v) > 2147483647)) return null;
    if (a.length > 12) return { error: "Keep the array to 12 elements or fewer." };
    return { a, x: Number(m[2]), normalized: `[${a.join(",")}],${m[2]}` };
  }

  const showOutcome = (o) => ("value" in o ? String(o.value) : `throws ${o.exception}${o.message ? `: ${o.message}` : ""}`);

  return {
    IMPLS, SPECS, indexOf, judgeCall, lectureDomain, meetsTable, matches, rangeOk,
    count, trueCount, sumForward, sumBackward, middle, middleSpec, SIGN_IMPLS, SIGN_SPECS, SIGN_DOMAIN, sign, maxList, parseCall, parseArrayX, showOutcome, INT_MIN,
  };
});
