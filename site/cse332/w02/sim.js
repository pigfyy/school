/* CSE 332 week 2 · pure simulations of Lecture 3's code and exact growth comparisons.
   No DOM. checks/cse332/w02/verify.mjs checks every function here against checks/cse332/w02/java/lecture3/Lecture3.java (javac). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Sim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------------------------------------------------------- slides 6 and 8: searching a sorted list */
  const SLIDE_SORTED = [5, 8, 13, 42, 75, 79, 88, 90, 95, 99];

  // contains (slide 6): counts a.get(i) == k comparisons
  function linearSearch(a, k) {
    let comparisons = 0;
    for (let i = 0; i < a.length; i++) {
      comparisons++;
      if (a[i] === k) return { found: true, comparisons, index: i };
    }
    return { found: false, comparisons, index: -1 };
  }

  // binary_contains (slide 8): one step per loop iteration; gap = end - start at the top of the iteration
  function binarySearchTrace(a, k) {
    let start = 0, end = a.length;
    const steps = [];
    while (start < end) {
      const mid = start + Math.floor((end - start) / 2);
      const v = a[mid];
      const step = { start, end, gap: end - start, mid, value: v };
      steps.push(step);
      if (v === k) { step.outcome = "found"; return { found: true, iterations: steps.length, steps, gaps: steps.map((s) => s.gap) }; }
      else if (v < k) { step.outcome = "right"; start = mid + 1; }
      else { step.outcome = "left"; end = mid; }
    }
    return { found: false, iterations: steps.length, steps, gaps: steps.map((s) => s.gap), finalStart: start };
  }

  // Exhaustive worst case over every target for n sorted distinct values 0, 2, 4, ...:
  // each present value and each of the n+1 gaps between them. Every search path is one of these.
  function binaryWorstExhaustive(n) {
    let worst = 0;
    // a virtual array a[i] = 2i keeps this O(n log n) without allocating for n = 10^6
    const trace = (k) => {
      let start = 0, end = n, it = 0;
      while (start < end) {
        it++;
        const mid = start + Math.floor((end - start) / 2), v = 2 * mid;
        if (v === k) return it;
        if (v < k) start = mid + 1; else end = mid;
      }
      return it;
    };
    for (let k = -1; k <= 2 * n - 1; k++) worst = Math.max(worst, trace(k));
    return worst;
  }
  // The worst path keeps the larger half: gap g -> floor(g/2). Same number, computed from the gaps alone.
  function worstGaps(n) { const g = []; for (let x = n; x > 0; x = Math.floor(x / 2)) g.push(x); return g; }

  /* ---------------------------------------------------------------- exact growth races (slides 32 and 36) */
  const bigPow = (b, e) => { let r = 1n; let x = BigInt(b); let k = BigInt(e); while (k > 0n) { if (k & 1n) r *= x; x *= x; k >>= 1n; } return r; };
  const digits = (x) => (x <= 0n ? 1 : x.toString().length);

  /* Each race compares f and g at integer n (or at n = 2^k for the log race), exactly.
     cmp(n) returns -1, 0, 1 for f(n) < = > g(n). log10f / log10g are for drawing only (floating point). */
  const RACES = {
    n50: {
      id: "n50", f: "n^{50}", g: "1.1^n", fText: "n^50", gText: "1.1^n", x: "n", range: [1, 6000],
      source: "Slide 32: \\(n^{50} \\in O(1.1^n)\\)",
      cmp: (n) => { const a = bigPow(n, 50) * bigPow(10, n), b = bigPow(11, n); return a < b ? -1 : a > b ? 1 : 0; },
      log10f: (n) => 50 * Math.log10(n), log10g: (n) => n * Math.log10(1.1),
      digitsF: (n) => digits(bigPow(n, 50)), digitsG: (n) => digits(bigPow(11, n) / bigPow(10, n)),
    },
    threeTwo: {
      id: "threeTwo", f: "3^n", g: "1000\\cdot 2^n", fText: "3^n", gText: "1000·2^n", x: "n", range: [1, 40],
      source: "Slide 32: \\(3^n \\notin \\Theta(2^n)\\), with \\(c = 1000\\)",
      cmp: (n) => { const a = bigPow(3, n), b = 1000n * bigPow(2, n); return a < b ? -1 : a > b ? 1 : 0; },
      log10f: (n) => n * Math.log10(3), log10g: (n) => 3 + n * Math.log10(2),
      digitsF: (n) => digits(bigPow(3, n)), digitsG: (n) => digits(1000n * bigPow(2, n)),
    },
    tenth: {
      // n = 2^k: n^(1/10) = 2^(k/10) and log2 n = k. f >= g  <=>  2^k >= k^10.
      id: "tenth", f: "n^{1/10}", g: "\\log_2 n", fText: "n^(1/10)", gText: "log₂ n", x: "k", range: [1, 80],
      source: "Slide 36: \\(n^{1/10}\\) vs. \\(\\log n\\)",
      cmp: (k) => { const a = bigPow(2, k), b = bigPow(k, 10); return a < b ? -1 : a > b ? 1 : 0; }, // compares f^10 with g^10
      log10f: (k) => (k / 10) * Math.log10(2), log10g: (k) => Math.log10(k),
      digitsF: null, digitsG: null,
    },
  };
  /* Where f stays <= g for good: the smallest x0 in the race's range such that f(x) <= g(x) for every x from x0 to the
     end of the range scanned (the tests and the page explain why it then holds for all larger x). Also lists the
     sign changes, so the page can show "f <= g at 1, then f > g from 2 to 4401, then f <= g from 4402". */
  function raceProfile(id, upto) {
    const r = RACES[id];
    const end = upto || r.range[1];
    const runs = [];
    let prev = null;
    for (let x = r.range[0]; x <= end; x++) {
      const s = r.cmp(x) <= 0 ? "le" : "gt";
      if (s !== prev) { runs.push({ from: x, to: x, s }); prev = s; }
      else runs[runs.length - 1].to = x;
    }
    return runs;
  }

  /* first n >= from where pred(n) holds (BigInt-safe), scanning exactly */
  function firstN(pred, from = 1, limit = 100000) {
    for (let n = from; n <= limit; n++) if (pred(n)) return n;
    return null;
  }

  /* ---------------------------------------------------------------- slide 32's "eventually" justifications, exactly */
  // n + 2 log2 n <= c log2 n  <=>  n <= (c-2) log2 n  <=>  2^n <= n^(c-2)   (n >= 2)
  const nPlusLogFails = (c, n) => bigPow(2, n) > bigPow(n, c - 2);
  // log2 n + 2 <= c  <=>  n <= 2^(c-2)
  const logPlusTwoFails = (c, n) => BigInt(n) > bigPow(2, c - 2);
  // 3^n <= c 2^n
  const threeTwoFails = (c, n) => bigPow(3, n) > BigInt(c) * bigPow(2, n);

  /* ---------------------------------------------------------------- the c·g(n) sandwich (slide 14) */
  // polynomials as coefficient strings, lowest degree first (same format as Grader.checkBound)
  const CLAIMS = [
    { id: "ex1", f: ["100", "10"], g: ["0", "0", "1"], rel: "O", fTex: "10n + 100", gTex: "n^2", c: "10", n0: "10", src: "Example 1 (slides 21–23)" },
    { id: "ex2", f: ["0", "-50", "13"], g: ["0", "0", "1"], rel: "Omega", fTex: "13n^2 - 50n", gTex: "n^2", c: "13", n0: "1", src: "Example 2 (slides 24–26)" },
    { id: "lin", f: ["4", "3"], g: ["0", "1"], rel: "O", fTex: "4 + 3n", gTex: "n", c: "4", n0: "1", src: "Slide 32" },
    { id: "sq17-o", f: ["17", "0", "3"], g: ["0", "0", "1"], rel: "O", fTex: "3n^2 + 17", gTex: "n^2", c: "3", n0: "1", src: "Slide 17" },
    { id: "sq17-omega", f: ["17", "0", "3"], g: ["0", "0", "1"], rel: "Omega", fTex: "3n^2 + 17", gTex: "n^2", c: "3", n0: "1", src: "Slide 17" },
    { id: "n2-vs-n", f: ["0", "0", "1"], g: ["100", "10"], rel: "O", fTex: "n^2", gTex: "10n + 100", c: "1000", n0: "1", src: "Example 1 turned around" },
  ];
  function polyNum(coeffs, n) { return coeffs.reduce((s, a, k) => s + Number(eval_(a)) * n ** k, 0); }
  function eval_(s) { const m = /^(-?\d+)(?:\/(\d+))?$/.exec(s); return m ? Number(m[1]) / (m[2] ? Number(m[2]) : 1) : NaN; }

  return {
    SLIDE_SORTED, linearSearch, binarySearchTrace, binaryWorstExhaustive, worstGaps,
    bigPow, digits, RACES, raceProfile, firstN,
    nPlusLogFails, logPlusTwoFails, threeTwoFails,
    CLAIMS, polyNum,
  };
});
