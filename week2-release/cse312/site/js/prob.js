"use strict";
/*
  Enumerators for the CSE 312 week 2 site: cards, rooks, dice grids, coin sequences, divisibility, subsets.
  Used by the widgets and the "Check by brute force" buttons. Every count is done by listing cases one at a time,
  never by formula, so the buttons are a real second check of the slides' arithmetic.
  Works in the browser (window.Prob) and in Node (require).
*/
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Prob = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  function choose(n, k) {
    if (k < 0 || k > n) return 0n;
    k = Math.min(k, n - k);
    let r = 1n;
    for (let i = 0; i < k; i++) r = (r * BigInt(n - i)) / BigInt(i + 1);
    return r;
  }
  function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; }
  function frac(n, d) { n = BigInt(n); d = BigInt(d); const g = gcd(n, d) || 1n; return `${n / g}/${d / g}`.replace(/\/1$/, ""); }

  /* ---------------------------------------------------------------- cards */
  // card c in 0..51: rank = c % 13 (0 = "2", …, 8 = "10", 9 = J, 10 = Q, 11 = K, 12 = A), suit = floor(c / 13)
  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const SUITS = ["♣", "♦", "♥", "♠"];
  const cardName = (c) => `${RANKS[c % 13]}${SUITS[Math.floor(c / 13)]}`;
  function isStraight(hand) {
    const r = [...new Set(hand.map((c) => c % 13))].sort((a, b) => a - b);
    if (r.length !== 5) return false;
    if (r[4] - r[0] === 4) return true;
    return r.join() === "0,1,2,3,12"; // A,2,3,4,5 counts as consecutive
  }
  const isFlush = (hand) => hand.every((c) => Math.floor(c / 13) === Math.floor(hand[0] / 13));
  const aces = (hand) => hand.filter((c) => c % 13 === 12).length;

  // Steppable iterator over all k-subsets of {0..n-1} in lexicographic order.
  function combos(n, k) {
    const idx = Array.from({ length: k }, (_, i) => i);
    let done = k > n;
    return {
      next() {
        if (done) return null;
        const out = idx.slice();
        let i = k - 1;
        while (i >= 0 && idx[i] === n - k + i) i--;
        if (i < 0) done = true;
        else { idx[i]++; for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1; }
        return out;
      },
    };
  }

  // A brute-force job: walks every case, counts those passing pred, can be advanced in chunks.
  function job(total, nextCase, pred) {
    let checked = 0, found = 0, done = false;
    return {
      total,
      step(budget) {
        for (let i = 0; i < budget; i++) {
          const x = nextCase();
          if (x === null) { done = true; break; }
          checked++;
          if (pred(x)) found++;
        }
        if (checked >= total) done = true;
        return { done, checked, found };
      },
      runAll() { while (!this.step(1e6).done); return found; },
    };
  }

  const handJob = (pred) => { const it = combos(52, 5); return job(2598960, () => it.next(), pred); };

  // rooks on an n×n board, cells 0..n²−1, identical rooks = unordered pairs of cells
  function rookPairs(n) {
    const it = combos(n * n, 2);
    return job((n * n * (n * n - 1)) / 2, () => it.next(), ([a, b]) => a % n !== b % n && Math.floor(a / n) !== Math.floor(b / n));
  }

  /* ---------------------------------------------------------------- dice and coins */
  function grid(sides1, sides2 = sides1) {
    const out = [];
    for (let a = 1; a <= sides1; a++) for (let b = 1; b <= sides2; b++) out.push([a, b]);
    return out;
  }
  function coinSeqs(n) {
    const out = [];
    for (let m = 0; m < 2 ** n; m++) {
      let s = "";
      for (let i = n - 1; i >= 0; i--) s += (m >> i) & 1 ? "T" : "H";
      out.push(s);
    }
    return out;
  }
  const heads = (s) => [...s].filter((ch) => ch === "H").length;

  /* ---------------------------------------------------------------- the BRUTE registry ("Check by brute force") */
  // expected: an expression the grader can evaluate; of: what is being checked (plural noun)
  const BRUTE = {
    hands: { of: "5-card hands", expected: "C(52,5)", make: () => handJob(() => true) },
    straights: { of: "5-card hands", expected: "10*4^5", make: () => handJob(isStraight) },
    flushes: { of: "5-card hands", expected: "4*C(13,5)", make: () => handJob(isFlush) },
    "flush-not-straight": { of: "5-card hands", expected: "4*C(13,5)-10*4", make: () => handJob((h) => isFlush(h) && !isStraight(h)) },
    "three-aces": { of: "5-card hands", expected: "C(4,3)*C(48,2)+C(4,4)*C(48,1)", make: () => handJob((h) => aces(h) >= 3) },
    rooks: { of: "placements of two identical rooks", expected: "(8*7)^2/2", make: () => rookPairs(8) },
    "three-sets": {
      of: "people",
      expected: "43+20+35-7-16-11+4",
      // a population realizing the slide's numbers: one person per (region, index)
      make: () => {
        const R = { A: 24, B: 6, C: 12, AB: 3, AC: 12, BC: 7, ABC: 4, none: 10 };
        const people = Object.entries(R).flatMap(([k, n]) => Array(n).fill(k));
        let i = 0;
        return job(people.length, () => (i < people.length ? people[i++] : null), (k) => k !== "none");
      },
    },
    "div-4-6-9": {
      of: "numbers in [360]",
      expected: "360/4+360/6+360/9-360/12-360/36-360/18+360/36",
      make: () => { let x = 0; return job(360, () => (x < 360 ? ++x : null), (v) => v % 4 === 0 || v % 6 === 0 || v % 9 === 0); },
    },
    "a-not-first-h-not-last": {
      of: "orderings of ABCDEFGH",
      expected: "8!-2*7!+6!",
      make: () => {
        // Heap's algorithm, steppable
        const a = [0, 1, 2, 3, 4, 5, 6, 7], c = new Array(8).fill(0);
        let first = true, i = 0;
        const next = () => {
          if (first) { first = false; return a; }
          while (i < 8) {
            if (c[i] < i) { const j = i % 2 ? c[i] : 0; [a[j], a[i]] = [a[i], a[j]]; c[i]++; i = 0; return a; }
            c[i] = 0; i++;
          }
          return null;
        };
        return job(40320, next, (p) => p[0] !== 0 && p[7] !== 7);
      },
    },
  };

  return { choose, frac, gcd, RANKS, SUITS, cardName, isStraight, isFlush, aces, combos, job, handJob, rookPairs, grid, coinSeqs, heads, BRUTE };
});
