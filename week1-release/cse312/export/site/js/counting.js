"use strict";
/*
  Brute-force enumeration for the counting widgets. Pure functions, no DOM, so the Node tests run the
  exact code the page runs.

  A "space" is a finite list of outcomes addressed by index 0..total-1:
    { total, outcome(i), valid(o), key?(o), show(o), unit }
  A Runner walks a space in order, counting valid outcomes (and distinct keys when key() is given).
  It stops at a cap and then reports truncated: true. Callers must not present a truncated run's
  counts as the answer.
*/
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Counting = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function factorial(n) { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; }
  function choose(n, k) {
    if (k < 0 || k > n) return 0n;
    k = Math.min(k, n - k);
    let r = 1n;
    for (let i = 0; i < k; i++) r = (r * BigInt(n - i)) / BigInt(i + 1);
    return r;
  }
  function perm(n, k) { if (k > n) return 0n; let r = 1n; for (let i = 0; i < k; i++) r *= BigInt(n - i); return r; }

  // index → digits in base b (most significant first), length k
  function digits(i, b, k) {
    const d = new Array(k);
    for (let j = k - 1; j >= 0; j--) { d[j] = i % b; i = Math.floor(i / b); }
    return d;
  }
  // index → permutation of [0..n-1] (lexicographic, factorial number system)
  function nthPermutation(i, n) {
    const pool = Array.from({ length: n }, (_, j) => j);
    const out = [];
    const f = [1];
    for (let j = 1; j <= n; j++) f[j] = f[j - 1] * j;
    for (let j = n; j >= 1; j--) {
      const q = Math.floor(i / f[j - 1]);
      i %= f[j - 1];
      out.push(pool.splice(q, 1)[0]);
    }
    return out;
  }
  // index → k-permutation of [0..n-1] (lexicographic)
  function nthKPermutation(i, n, k) {
    const pool = Array.from({ length: n }, (_, j) => j);
    const out = [];
    for (let j = 0; j < k; j++) {
      const rest = Number(perm(n - j - 1, k - j - 1));
      const q = Math.floor(i / rest);
      i %= rest;
      out.push(pool.splice(q, 1)[0]);
    }
    return out;
  }

  const SPACES = {
    // strings of length k over the first a letters; cond: "distinct" | "repeat" | "any"
    strings({ a = 26, k = 5, cond = "distinct" } = {}) {
      return {
        total: a ** k,
        unit: "strings",
        outcome: (i) => digits(i, a, k),
        valid: (o) => (cond === "any" ? true : (new Set(o).size === o.length) === (cond === "distinct")),
        show: (o) => o.map((x) => (a <= 26 ? LETTERS[x] : String(x + 1))).join(""),
      };
    },
    // sequences in {1,2,3}^3 (Lecture 1, slides 24 and 26)
    seq123({ cond = "distinct" } = {}) {
      return {
        total: 27,
        unit: "sequences",
        outcome: (i) => digits(i, 3, 3).map((x) => x + 1),
        valid: (o) => (new Set(o).size === 3) === (cond === "distinct"),
        show: (o) => `(${o.join(",")})`,
      };
    },
    // 5 books, each to Alice, Bob or Charlie (Lecture 1, slide 33): every outcome is valid
    booksByBook() {
      const P = "ABC";
      return {
        total: 3 ** 5,
        unit: "assignments",
        outcome: (i) => digits(i, 3, 5),
        valid: () => true,
        show: (o) => o.map((p, b) => `${b + 1}→${P[p]}`).join(" "),
      };
    },
    // a subset of the 5 books for each person (Lecture 1, slide 31); valid only if every book goes to exactly one person
    booksBySubsets() {
      return {
        total: 32 ** 3,
        unit: "subset triples",
        outcome: (i) => digits(i, 32, 3),
        valid: (o) => {
          for (let b = 0; b < 5; b++) {
            const owners = o.filter((mask) => mask & (1 << (4 - b))).length;
            if (owners !== 1) return false;
          }
          return true;
        },
        show: (o) => ["A", "B", "C"].map((p, j) => {
          const s = [];
          for (let b = 0; b < 5; b++) if (o[j] & (1 << (4 - b))) s.push(b + 1);
          return `${p}={${s.join(",")}}`;
        }).join(" "),
      };
    },
    // arrow strings in {↑,→}^(r+u); valid if exactly u ups (Lecture 2, slide 16)
    paths({ r = 4, u = 3 } = {}) {
      const right = r, up = u;
      const n = right + up;
      return {
        total: 2 ** n,
        unit: "arrow strings",
        outcome: (i) => digits(i, 2, n),
        valid: (o) => o.filter((x) => x === 1).length === up,
        show: (o) => o.map((x) => (x ? "↑" : "→")).join(""),
      };
    },
    // tuples (x1..xk) with 0 ≤ xi ≤ n; valid if they sum to n (Lecture 2, slide 17)
    sums({ k = 3, n = 5 } = {}) {
      return {
        total: (n + 1) ** k,
        unit: "tuples",
        outcome: (i) => digits(i, n + 1, k),
        valid: (o) => o.reduce((s, x) => s + x, 0) === n,
        show: (o) => `(${o.join(",")})`,
      };
    },
    // all orderings of the letters of a word, treating repeated letters as different; key = the word produced
    anagrams({ word = "SEATTLE" } = {}) {
      const w = word.toUpperCase();
      const n = w.length;
      return {
        total: Number(factorial(n)),
        unit: "orderings",
        outcome: (i) => nthPermutation(i, n),
        valid: () => true,
        key: (o) => o.map((j) => w[j]).join(""),
        show: (o) => o.map((j) => w[j]).join(""),
      };
    },
    // k-sequences of distinct letters from the first n letters; key = the set they use (Lecture 2, slide 10)
    kseqToSets({ n = 5, k = 3 } = {}) {
      return {
        total: Number(perm(n, k)),
        unit: "sequences",
        outcome: (i) => nthKPermutation(i, n, k),
        valid: () => true,
        key: (o) => `{${[...o].sort((x, y) => x - y).map((x) => LETTERS[x]).join(",")}}`,
        show: (o) => o.map((x) => LETTERS[x]).join(""),
      };
    },
  };

  class Runner {
    constructor(space, { cap = 1_000_000 } = {}) {
      this.space = space;
      this.cap = cap;
      this.reset();
    }
    reset() {
      this.checked = 0;
      this.found = 0;
      this.keys = this.space.key ? new Map() : null;
      this.last = [];
    }
    get done() { return this.checked >= this.space.total; }
    get capped() { return !this.done && this.checked >= this.cap; }
    // check up to n more outcomes; returns the last (at most 12) outcomes checked in this call, for display
    step(n = 1) {
      const out = [];
      const stop = Math.min(this.space.total, this.cap, this.checked + n);
      for (; this.checked < stop; this.checked++) {
        const o = this.space.outcome(this.checked);
        const ok = this.space.valid(o);
        if (ok) {
          this.found++;
          if (this.keys) {
            const key = this.space.key(o);
            this.keys.set(key, (this.keys.get(key) || 0) + 1);
          }
        }
        if (stop - this.checked <= 12) out.push({ index: this.checked, outcome: o, ok, text: this.space.show(o) });
      }
      this.last = out;
      return out;
    }
    // A summary that only claims a total when every outcome has been checked.
    summary() {
      const s = {
        checked: this.checked,
        total: this.space.total,
        found: this.found,
        distinct: this.keys ? this.keys.size : null,
        complete: this.done,
        truncated: !this.done,
      };
      return s;
    }
  }

  function runAll(space) {
    const r = new Runner(space, { cap: Infinity });
    r.step(space.total);
    return r.summary();
  }

  // Lecture 2 slide 18: (x1,...,xk) ↔ binary string: xi ones, separated by k-1 zeros
  function tupleToBits(t) { return t.map((x) => "1".repeat(x)).join("0"); }
  function bitsToStars(bits) { return [...bits].map((c) => (c === "1" ? "*" : "|")).join(" "); }

  // All 2^n products from (x+y)^n, as strings like "xyyx"
  function expandProducts(n) {
    const out = [];
    for (let i = 0; i < 2 ** n; i++) out.push(digits(i, 2, n).map((b) => (b ? "y" : "x")).join(""));
    return out;
  }

  /* ------------------------------------------------------------ brute-force checks for section problems */
  // Next lexicographic permutation of an int array, in place. Returns false after the last one.
  function nextPermutation(a) {
    let i = a.length - 2;
    while (i >= 0 && a[i] >= a[i + 1]) i--;
    if (i < 0) return false;
    let j = a.length - 1;
    while (a[j] <= a[i]) j--;
    [a[i], a[j]] = [a[j], a[i]];
    for (let l = i + 1, r = a.length - 1; l < r; l++, r--) [a[l], a[r]] = [a[r], a[l]];
    return true;
  }
  // An incremental checker over all permutations of n items. step(k) checks up to k more.
  function permChecker(n, valid) {
    const a = Array.from({ length: n }, (_, i) => i);
    const total = Number(factorial(n));
    let checked = 0, found = 0, more = true;
    return {
      total,
      step(k) {
        for (let s = 0; s < k && more; s++) {
          if (valid(a)) found++;
          checked++;
          more = nextPermutation(a);
        }
        return { checked, found, done: !more };
      },
    };
  }
  function indexChecker(total, valid) {
    let checked = 0, found = 0;
    return {
      total,
      step(k) {
        const stop = Math.min(total, checked + k);
        for (; checked < stop; checked++) if (valid(checked)) found++;
        return { checked, found, done: checked >= total };
      },
    };
  }
  const adjacent = (p, x, y) => Math.abs(p.indexOf(x) - p.indexOf(y)) === 1;

  // expected = an exact expression, evaluated independently by the caller (never a hard-coded number)
  const BRUTE = {
    divisors: { of: "numbers from 1 to 1440", expected: "6*3*2", make: () => indexChecker(1440, (i) => 1440 % (i + 1) === 0) },
    seatingAdjacent: {
      of: "orders of 10 people (5 couples)", expected: "5!*2^5",
      make: () => permChecker(10, (p) => {
        const pos = new Array(10);
        p.forEach((person, seat) => { pos[person] = seat; });
        for (let c = 0; c < 5; c++) if (Math.abs(pos[2 * c] - pos[2 * c + 1]) !== 1) return false;
        return true;
      }),
    },
    seatingApart: {
      of: "orders of 10 people", expected: "10!-2*9!",
      make: () => permChecker(10, (p) => !adjacent(p, 0, 1)),
    },
    hbcdefga: {
      of: "orders of A–H", expected: "8!-(2*7!-6!)",
      make: () => permChecker(8, (p) => p[0] !== 0 && p[7] !== 7), // 0 = A, 7 = H
    },
    lizards: {
      of: "ways to put 3 lizards and 2 snakes in 4 terrariums", expected: "4*3^3+12*2^3",
      make: () => indexChecker(4 ** 5, (i) => {
        const t = digits(i, 4, 5); // t[0..2] lizards, t[3..4] snakes
        return !t.slice(0, 3).some((x) => x === t[3] || x === t[4]);
      }),
    },
    cake: {
      of: "menus of 5 desserts over 7 days", expected: "4^6",
      make: () => indexChecker(5 ** 7, (i) => {
        const d = digits(i, 5, 7); // Sun..Sat, 4 = cake
        if (d[4] !== 4) return false;
        for (let j = 1; j < 7; j++) if (d[j] === d[j - 1]) return false;
        return true;
      }),
    },
    photos: {
      of: "orders of 8 people", expected: "(2*7+2*6)*6!",
      make: () => permChecker(8, (p) => Math.abs(p.indexOf(0) - p.indexOf(1)) <= 2),
    },
    families: {
      of: "orders of 6 people (3 families of 2)", expected: "3!*(2!)^3",
      make: () => permChecker(6, (p) => {
        for (let f = 0; f < 3; f++) if (!adjacent(p, 2 * f, 2 * f + 1)) return false;
        return true;
      }),
    },
  };

  return { LETTERS, factorial, choose, perm, digits, nthPermutation, nthKPermutation, nextPermutation, SPACES, Runner, runAll, tupleToBits, bitsToStars, expandProducts, BRUTE };
});
