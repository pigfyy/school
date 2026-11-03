/* CSE 332 week 2 · pure simulations of the lectures' code and exact growth comparisons. No DOM.
   checks/cse332/w02/verify.mjs checks Lecture 3's parts against java/lecture3/Lecture3.java and the heap and numUnique
   parts against java/heap/Heap.java (both compiled with javac). */
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
      cmp: (n) => { const a = bigPow(n, 50) * bigPow(10, n), b = bigPow(11, n); return a < b ? -1 : a > b ? 1 : 0; },
      log10f: (n) => 50 * Math.log10(n), log10g: (n) => n * Math.log10(1.1),
      digitsF: (n) => digits(bigPow(n, 50)), digitsG: (n) => digits(bigPow(11, n) / bigPow(10, n)),
    },
    threeTwo: {
      id: "threeTwo", f: "3^n", g: "1000\\cdot 2^n", fText: "3^n", gText: "1000·2^n", x: "n", range: [1, 40],
      cmp: (n) => { const a = bigPow(3, n), b = 1000n * bigPow(2, n); return a < b ? -1 : a > b ? 1 : 0; },
      log10f: (n) => n * Math.log10(3), log10g: (n) => 3 + n * Math.log10(2),
      digitsF: (n) => digits(bigPow(3, n)), digitsG: (n) => digits(1000n * bigPow(2, n)),
    },
    tenth: {
      // n = 2^k: n^(1/10) = 2^(k/10) and log2 n = k. f >= g  <=>  2^k >= k^10.
      id: "tenth", f: "n^{1/10}", g: "\\log_2 n", fText: "n^(1/10)", gText: "log₂ n", x: "k", range: [1, 80],
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

  /* ---------------------------------------------------------------- the c / n0 explorer
     Polynomials as coefficient strings, lowest degree first (the format Grader.checkBound takes).
     cs: the values the c slider steps through; c0 / n00: where the sliders start; N: the last n drawn. */
  const CLAIMS = [
    { id: "sq17-o", f: ["17", "0", "3"], g: ["0", "0", "1"], rel: "O", fTex: "3n² + 17", gTex: "n²", cs: ["1", "2", "3", "7/2", "4", "5", "10", "20"], c0: "4", n00: 1, N: 15 },
    { id: "sq17-omega", f: ["17", "0", "3"], g: ["0", "0", "1"], rel: "Omega", fTex: "3n² + 17", gTex: "n²", cs: ["1", "2", "3", "4", "5"], c0: "3", n00: 1, N: 15 },
    { id: "ex1", f: ["100", "10"], g: ["0", "0", "1"], rel: "O", fTex: "10n + 100", gTex: "n²", cs: ["1", "2", "5", "10", "20", "50", "110"], c0: "10", n00: 10, N: 30 },
    { id: "ex2", f: ["0", "-50", "13"], g: ["0", "0", "1"], rel: "Omega", fTex: "13n² − 50n", gTex: "n²", cs: ["1", "6", "11", "12", "25/2", "13", "14"], c0: "13", n00: 1, N: 120 },
    { id: "lin", f: ["4", "3"], g: ["0", "1"], rel: "O", fTex: "4 + 3n", gTex: "n", cs: ["3", "4", "5", "7"], c0: "4", n00: 1, N: 15 },
    { id: "sq-vs-n", f: ["0", "0", "1"], g: ["0", "1"], rel: "O", fTex: "n²", gTex: "n", cs: ["1", "5", "10", "20", "40"], c0: "10", n00: 1, N: 60 },
  ];
  function polyNum(coeffs, n) { return coeffs.reduce((s, a, k) => s + Number(eval_(a)) * n ** k, 0); }
  function eval_(s) { const m = /^(-?\d+)(?:\/(\d+))?$/.exec(s); return m ? Number(m[1]) / (m[2] ? Number(m[2]) : 1) : NaN; }

  /* ---------------------------------------------------------------- Section 2, question 0: what a bound leaves open
     Running times are taken to be at least a constant. A supposition "f ∈ O(g)" puts f anywhere from the bottom of
     the ladder up to g; "f ∈ Ω(g)" from g up without limit; "f ∈ Θ(g)" exactly at g. */
  const LADDER = ["1", "log n", "n", "n log n", "n^2", "2^n"];
  function bandOf(rel, k) { return rel === "O" ? [0, k] : rel === "Omega" ? [k, Infinity] : [k, k]; }
  function boundVerdict(supRel, supK, rel, k) {
    const [lo, hi] = bandOf(supRel, supK);
    if (rel === "O") return hi <= k ? "always" : lo > k ? "never" : "sometimes";
    if (rel === "Omega") return lo >= k ? "always" : hi < k ? "never" : "sometimes";
    return lo === k && hi === k ? "always" : k < lo || k > hi ? "never" : "sometimes"; // Theta
  }

  /* ---------------------------------------------------------------- Lectures 4–5: the binary min-heap
     The lecture's pseudocode, 1-based: arr[0] is unused, the root is arr[1], size counts the items.
     checks/cse332/w02/java/heap/Heap.java runs the same pseudocode in Java and verify.mjs compares the two. */
  const LECTURE_HEAP = [1, 3, 2, 4, 7, 5, 6, 5, 9];          // level order, root first
  const BUILD_INPUT = [5, 6, 10, 3, 15, 8, 7, 14, 2, 1];
  const toArr = (levelOrder) => [null, ...levelOrder];
  const fmt = (v) => String(v);

  function percolateUp(arr, i) {
    let swaps = 0, parent = Math.floor(i / 2);
    const val = arr[i];
    while (i > 1 && arr[i] < arr[parent]) { arr[i] = arr[parent]; arr[parent] = val; i = parent; parent = Math.floor(i / 2); swaps++; }
    return swaps;
  }
  function percolateDown(arr, size, i) {
    let swaps = 0, left = i * 2, right = i * 2 + 1;
    const val = arr[i];
    while (left <= size) {
      let toSwap = right;
      if (right > size || arr[left] < arr[right]) toSwap = left;
      if (arr[toSwap] < val) { arr[i] = arr[toSwap]; arr[toSwap] = val; i = toSwap; left = i * 2; right = i * 2 + 1; swaps++; }
      else return swaps;
    }
    return swaps;
  }
  // a heap is { arr, size }; these change it in place and report what happened
  const heapOf = (levelOrder) => ({ arr: toArr(levelOrder), size: levelOrder.length });
  const live = (h) => h.arr.slice(1, h.size + 1);
  function heapInsert(h, x) { h.size++; h.arr[h.size] = x; return { swaps: percolateUp(h.arr, h.size) }; }
  function heapExtract(h) { const min = h.arr[1]; h.arr[1] = h.arr[h.size]; h.size--; return { min, swaps: percolateDown(h.arr, h.size, 1) }; }
  function buildHeap(h) { const trace = []; for (let i = h.size; i > 0; i--) { const swaps = percolateDown(h.arr, h.size, i); trace.push({ i, swaps, arr: live(h) }); } return trace; }
  function isMinHeap(levelOrder) { return levelOrder.every((v, k) => k === 0 || levelOrder[Math.floor((k + 1) / 2) - 1] <= v); }
  const heightOf = (n) => { let h = 0; while (2 ** (h + 1) - 1 < n) h++; return h; };

  // index arithmetic, the lecture's 1-based convention
  function indexInfo(i, n) {
    const left = 2 * i, right = 2 * i + 1;
    return { i, n, parent: i > 1 ? Math.floor(i / 2) : null, left: left <= n ? left : null, right: right <= n ? right : null, leaf: left > n, firstLeaf: Math.floor(n / 2) + 1 };
  }
  function indexSay(i, n) {
    const r = indexInfo(i, n);
    return [
      i === 1 ? "Parent: none. Index 1 is the root (and index 0 is never used)." : `Parent: ${i}/2 = ${r.parent}. Integer division throws away the remainder, so both children of ${r.parent} lead back to it.`,
      2 * i <= n ? `Left child: ${i}*2 = ${2 * i}, and ${2 * i} <= ${n} is true, so it exists.` : `Left child: ${i}*2 = ${2 * i}, but ${2 * i} <= ${n} is false: there is no left child, so index ${i} is a leaf.`,
      2 * i + 1 <= n ? `Right child: ${i}*2+1 = ${2 * i + 1}, and ${2 * i + 1} <= ${n} is true, so it exists.` : `Right child: ${i}*2+1 = ${2 * i + 1}, but ${2 * i + 1} <= ${n} is false: no right child.`,
      `Leaves: ${n}/2 = ${Math.floor(n / 2)}, so the leaves are index ${r.firstLeaf} to ${n}. Index ${i} is ${r.leaf ? "" : "not "}one of them.`,
    ];
  }
  function heightSay(n) {
    const h = heightOf(n);
    const cap = 2 ** (h + 1) - 1, below = 2 ** h - 1;
    return `n = ${n}: height ${h}. A tree of height ${h} holds at most 2^${h + 1} − 1 = ${cap} node${cap === 1 ? "" : "s"}${h > 0 ? `, and height ${h - 1} holds at most 2^${h} − 1 = ${below}, which is fewer than ${n}` : ""}.${n === cap ? " This tree is full: one more node starts a new level." : ""}`;
  }

  /* Step-by-step walks for the steppers. Each step is the state right after one line runs, plus what that line did
     and why. Comparisons are narrated as "a < b is true/false" and index arithmetic as "10/2 = 5", "4*2 = 8",
     "4*2+1 = 9", so verify.mjs can recheck every one. */
  const CODE = {
    insertIdea: ["insert(item, priority){", "    put item in the “next open” spot (keep tree complete)", "    while (priority < parent’s priority){", "        swap item with parent", "    }", "}"],
    extractIdea: ["extract(){", "    min = root", "    curr = bottom-right item", "    move curr to the root", "    while(curr > curr.left || curr > curr.right){", "        swap curr with its smallest child", "    }", "    return min", "}"],
    insert: ["insert(item){", "    if(size == arr.length - 1){resize();}", "    size++;", "    arr[size] = item;", "    percolateUp(size);", "}", "", "percolateUp(int i){", "    int parent = i/2;", "    Item val = arr[i];", "    while(i > 1 && arr[i] < arr[parent]){", "        arr[i] = arr[parent];", "        arr[parent] = val;", "        i = parent;", "        parent = i/2;", "    }", "}"],
    extract: ["extract(){", "    theMin = arr[1];", "    arr[1] = arr[size];", "    size--;", "    percolateDown(1);", "    return theMin;", "}", "", "percolateDown(int i){", "    int left = i*2;", "    int right = i*2+1;", "    Item val = arr[i];", "    while(left <= size){", "        int toSwap = right;", "        if(right > size || arr[left] < arr[right]){", "            toSwap = left;", "        }", "        if(arr[toSwap] < val){", "            arr[i] = arr[toSwap];", "            arr[toSwap] = val;", "            i = toSwap;", "            left = i*2;", "            right = i*2+1;", "        }", "        else{ return;}", "    }", "}"],
    build: ["buildHeap(){", "    for(int i = size; i>0; i--){", "        percolateDown(i);", "    }", "}"],
  };
  const tf = (b) => (b ? "true" : "false");
  function recorder(h) {
    const steps = [];
    const snap = (line, say, extra = {}) => steps.push({ line, say, arr: h.arr.slice(), size: h.size, mark: {}, vars: {}, ...extra });
    return { steps, snap };
  }
  const levelName = (i) => (i === 1 ? "the root" : `index ${i}`);

  // Lecture 4's insert, at the level of the tree
  function insertIdeaSteps(levelOrder, x) {
    const h = heapOf(levelOrder);
    const { steps, snap } = recorder(h);
    snap(null, `Before: a min-heap of ${h.size} items. Every node is ≤ its children, and the smallest item, ${fmt(h.arr[1])}, is at the root.`);
    h.size++; h.arr[h.size] = x;
    let i = h.size;
    const newLevel = (i & (i - 1)) === 0;
    snap(1, `Put ${fmt(x)} in the next open spot: ${newLevel ? "the bottom level is full, so it starts a new level at the far left" : "the leftmost empty place on the bottom level"}. The tree is still complete. Only one thing can be wrong now: ${fmt(x)} might be smaller than its parent${i > 1 ? `, ${fmt(h.arr[Math.floor(i / 2)])}` : ""}.`, { mark: { cur: i } });
    let swaps = 0;
    while (true) {
      if (i === 1) { snap(2, `${fmt(x)} is at the root, so it has no parent. The loop stops.`, { mark: { cur: i } }); break; }
      const p = Math.floor(i / 2), pv = h.arr[p];
      const less = x < pv;
      if (!less) { snap(2, `${fmt(x)} < ${fmt(pv)} is false: ${fmt(x)} is not smaller than its parent, so every parent is ≤ its children again. The loop stops.`, { mark: { cur: i, cmp: [p] } }); break; }
      snap(2, `${fmt(x)} < ${fmt(pv)} is true: ${fmt(x)} is smaller than its parent. That breaks the heap property, so keep going.`, { mark: { cur: i, cmp: [p] } });
      const sib = (i ^ 1) <= h.size ? h.arr[i ^ 1] : null;
      h.arr[i] = pv; h.arr[p] = x; swaps++;
      snap(3, `Swap: ${fmt(x)} moves up, ${fmt(pv)} moves down. ${fmt(pv)} was already ≤ everything below it, so it is fine in its new spot.${sib !== null ? ` And ${fmt(x)} < ${fmt(pv)} ≤ ${fmt(sib)}, so ${fmt(x)} is a fine parent for ${fmt(sib)} too.` : ""} The only link left to check is ${fmt(x)} and its new parent.`, { mark: { cur: p, swap: [i, p] } });
      i = p;
    }
    snap(5, `Done: ${swaps} swap${swaps === 1 ? "" : "s"}. ${fmt(x)} only ever moved up one path from the bottom toward the root, so the work is at most the height of the tree.`, { mark: { cur: i }, done: true, swaps });
    return steps;
  }

  // Lecture 4's extract, at the level of the tree
  function extractIdeaSteps(levelOrder) {
    const h = heapOf(levelOrder);
    const { steps, snap } = recorder(h);
    snap(null, `Before: a min-heap of ${h.size} items. The item to return is the smallest, and it's at the root.`);
    const min = h.arr[1];
    snap(1, `min = ${fmt(min)}. Save the root now, because the next lines write over it.`, { mark: { cur: 1 }, vars: { min } });
    const last = h.size, cv = h.arr[last];
    snap(2, `curr = ${fmt(cv)}, the bottom-right item. A tree with one fewer item has to lose exactly this spot to stay complete.`, { mark: { cur: last }, vars: { min } });
    h.arr[1] = cv; h.size--;
    let i = 1, swaps = 0;
    snap(3, `Move ${fmt(cv)} into the root, over ${fmt(min)}. The tree has ${h.size} item${h.size === 1 ? "" : "s"} and is complete again. But ${fmt(cv)} came from the bottom, so it is probably too big to sit at the top.`, { mark: { cur: 1 }, vars: { min }, stale: last });
    while (true) {
      const l = 2 * i, r = 2 * i + 1;
      if (l > h.size) { snap(4, `${fmt(cv)} has no children here: it's a leaf, so it can't be bigger than a child. The loop stops.`, { mark: { cur: i }, vars: { min }, stale: last }); break; }
      const lv = h.arr[l], rv = r <= h.size ? h.arr[r] : null;
      const gl = cv > lv, gr = rv !== null && cv > rv;
      const cmpText = rv === null ? `${fmt(cv)} > ${fmt(lv)} is ${tf(gl)}, and there is no right child` : `${fmt(cv)} > ${fmt(lv)} is ${tf(gl)} and ${fmt(cv)} > ${fmt(rv)} is ${tf(gr)}`;
      if (!gl && !gr) { snap(4, `${cmpText}. ${fmt(cv)} is ≤ ${rv === null ? "its child" : "both children"}, so the heap property holds everywhere. The loop stops.`, { mark: { cur: i, cmp: rv === null ? [l] : [l, r] }, vars: { min }, stale: last }); break; }
      snap(4, `${cmpText}. ${fmt(cv)} is bigger than a child, so it has to go down.`, { mark: { cur: i, cmp: rv === null ? [l] : [l, r] }, vars: { min }, stale: last });
      const c = rv === null || lv < rv ? l : r, sv = h.arr[c], ov = c === l ? rv : lv;
      h.arr[i] = sv; h.arr[c] = cv; swaps++;
      snap(5, rv === null
        ? `Only one child, ${fmt(sv)}: swap with it. ${fmt(sv)} moves up, ${fmt(cv)} moves down.`
        : `Swap with the smaller child, ${fmt(sv)}. It becomes the parent of ${fmt(ov)}, which is fine because ${fmt(sv)} ≤ ${fmt(ov)}. Had we swapped with ${fmt(Math.max(sv, ov))} instead, it would sit above ${fmt(Math.min(sv, ov))}, a smaller value: a new violation.`,
      { mark: { cur: c, swap: [i, c] }, vars: { min }, stale: last });
      i = c;
    }
    snap(7, `Return ${fmt(min)}. ${swaps} swap${swaps === 1 ? "" : "s"}: ${fmt(cv)} only moved down one path, so the work is at most the height of the tree.`, { mark: { cur: i }, vars: { min }, done: true, swaps, returned: min, stale: last });
    return steps;
  }

  // Lecture 5's array code, line by line: insert + percolateUp
  function insertCodeSteps(levelOrder, x, capacity = 16) {
    const h = heapOf(levelOrder);
    const { steps, snap } = recorder(h);
    snap(null, `Before: size = ${h.size}. The items sit in arr[1] to arr[${h.size}] in level order; arr[0] is never used. The array has length ${capacity}.`);
    snap(1, `size == arr.length - 1 is ${h.size} == ${capacity - 1}: ${tf(h.size === capacity - 1)}. ${h.size === capacity - 1 ? "The array is full, so it grows first." : "There's room, so no resize."} (It's length − 1 because index 0 is never used.)`);
    h.size++;
    snap(2, `size = ${h.size}. Index ${h.size} is the next open spot: the next place on the bottom level, left to right.`, { mark: { cur: h.size } });
    h.arr[h.size] = x;
    snap(3, `arr[${h.size}] = ${fmt(x)}. The tree is complete again; now fix the order.`, { mark: { cur: h.size } });
    let i = h.size;
    snap(4, `Call percolateUp(${i}).`, { mark: { cur: i }, vars: { i } });
    let parent = Math.floor(i / 2);
    snap(8, `parent = ${i}/2 = ${parent}. Integer division drops any .5, which is exactly the parent's index.`, { mark: { cur: i, cmp: [parent] }, vars: { i, parent } });
    const val = h.arr[i];
    snap(9, `val = arr[${i}] = ${fmt(val)}. Save the moving item: the loop body writes over arr[i], and val is how we still have it.`, { mark: { cur: i }, vars: { i, parent, val } });
    let swaps = 0;
    while (true) {
      const a = i > 1;
      const b = a && h.arr[i] < h.arr[parent];
      if (!a) { snap(10, `${i} > 1 is false: i is the root, which has no parent. The loop stops before it reads arr[${parent}] (that's index 0, the unused slot).`, { mark: { cur: i }, vars: { i, parent, val } }); break; }
      if (!b) { snap(10, `${i} > 1 is true, but ${fmt(h.arr[i])} < ${fmt(h.arr[parent])} is false: the item is not smaller than its parent. The loop stops.`, { mark: { cur: i, cmp: [parent] }, vars: { i, parent, val } }); break; }
      snap(10, `${i} > 1 is true and ${fmt(h.arr[i])} < ${fmt(h.arr[parent])} is true: the item is smaller than its parent. Run the loop body.`, { mark: { cur: i, cmp: [parent] }, vars: { i, parent, val } });
      h.arr[i] = h.arr[parent];
      snap(11, `arr[${i}] = arr[${parent}] = ${fmt(h.arr[i])}. The parent's value moves down. For a moment it's in both slots.`, { mark: { cur: parent, swap: [i, parent] }, vars: { i, parent, val } });
      h.arr[parent] = val;
      snap(12, `arr[${parent}] = val = ${fmt(val)}. These two assignments together are one swap.`, { mark: { cur: parent, swap: [i, parent] }, vars: { i, parent, val } });
      swaps++;
      i = parent;
      snap(13, `i = ${i}. Follow the item to its new spot.`, { mark: { cur: i }, vars: { i, parent, val } });
      parent = Math.floor(i / 2);
      snap(14, `parent = ${i}/2 = ${parent}.${parent === 0 ? " That's index 0, the unused slot, but the loop test checks i > 1 first, so it is never read." : ""}`, { mark: { cur: i, cmp: parent ? [parent] : [] }, vars: { i, parent, val } });
    }
    snap(16, `percolateUp returns. ${fmt(x)} ended at index ${i} after ${swaps} swap${swaps === 1 ? "" : "s"}.`, { mark: { cur: i }, vars: { i, parent, val }, done: true, swaps });
    return steps;
  }

  // Lecture 5's array code, line by line: extract + percolateDown
  function extractCodeSteps(levelOrder) {
    const h = heapOf(levelOrder);
    const { steps, snap } = recorder(h);
    snap(null, `Before: size = ${h.size}. The smallest item is arr[1] = ${fmt(h.arr[1])}.`);
    const theMin = h.arr[1];
    snap(1, `theMin = arr[1] = ${fmt(theMin)}. Save it before the next line writes over arr[1].`, { mark: { cur: 1 }, vars: { theMin } });
    const last = h.size;
    h.arr[1] = h.arr[last];
    snap(2, `arr[1] = arr[${last}] = ${fmt(h.arr[1])}. The last item is copied into the root.`, { mark: { cur: 1, cmp: [last] }, vars: { theMin } });
    h.size--;
    snap(3, `size = ${h.size}. The copy left in arr[${last}] is now outside the heap. Nothing erases it; size is what says it's gone.`, { mark: { cur: 1 }, vars: { theMin }, stale: last });
    let i = 1;
    snap(4, `Call percolateDown(1).`, { mark: { cur: 1 }, vars: { theMin, i }, stale: last });
    let left = i * 2;
    snap(9, `left = ${i}*2 = ${left}.`, { mark: { cur: i }, vars: { theMin, i, left }, stale: last });
    let right = i * 2 + 1;
    snap(10, `right = ${i}*2+1 = ${right}.`, { mark: { cur: i }, vars: { theMin, i, left, right }, stale: last });
    const val = h.arr[i];
    snap(11, `val = arr[${i}] = ${fmt(val)}. Save the moving item, as in percolateUp.`, { mark: { cur: i }, vars: { theMin, i, left, right, val }, stale: last });
    let swaps = 0, ended = "leaf";
    const V = () => ({ theMin, i, left, right, val });
    while (true) {
      if (!(left <= h.size)) { snap(12, `${left} <= ${h.size} is false: index ${i} has no left child, so it is a leaf. The loop ends.`, { mark: { cur: i }, vars: V(), stale: last }); break; }
      snap(12, `${left} <= ${h.size} is true: index ${i} has at least a left child. Run the loop body.`, { mark: { cur: i, cmp: [left] }, vars: V(), stale: last });
      let toSwap = right;
      snap(13, `toSwap = right = ${right}. Start by assuming the right child is the smaller one.`, { mark: { cur: i, cmp: [left] }, vars: { ...V(), toSwap }, stale: last });
      const noRight = right > h.size;
      const leftLess = !noRight && h.arr[left] < h.arr[right];
      snap(14, noRight
        ? `${right} > ${h.size} is true: there is no right child. The || stops here without reading arr[${right}].`
        : `${right} > ${h.size} is false, so compare the children: ${fmt(h.arr[left])} < ${fmt(h.arr[right])} is ${tf(leftLess)}.`,
      { mark: { cur: i, cmp: noRight ? [left] : [left, right] }, vars: { ...V(), toSwap }, stale: last });
      if (noRight || leftLess) { toSwap = left; snap(15, `toSwap = left = ${left}. ${noRight ? "The only child" : "The left child is smaller"}.`, { mark: { cur: i, cmp: [left] }, vars: { ...V(), toSwap }, stale: last }); }
      const go = h.arr[toSwap] < val;
      if (!go) {
        snap(17, `${fmt(h.arr[toSwap])} < ${fmt(val)} is false: even the smaller child is not smaller than the moving item. So it is ≤ both children.`, { mark: { cur: i, cmp: [toSwap] }, vars: { ...V(), toSwap }, stale: last });
        snap(24, `else: return. The heap property holds; percolateDown is done.`, { mark: { cur: i }, vars: { ...V(), toSwap }, stale: last });
        ended = "stop"; break;
      }
      snap(17, `${fmt(h.arr[toSwap])} < ${fmt(val)} is true: the smaller child is smaller than the moving item, so they swap.`, { mark: { cur: i, cmp: [toSwap] }, vars: { ...V(), toSwap }, stale: last });
      h.arr[i] = h.arr[toSwap];
      snap(18, `arr[${i}] = arr[${toSwap}] = ${fmt(h.arr[i])}. The smaller child moves up.`, { mark: { cur: toSwap, swap: [i, toSwap] }, vars: { ...V(), toSwap }, stale: last });
      h.arr[toSwap] = val;
      snap(19, `arr[${toSwap}] = val = ${fmt(val)}. The moving item goes down. Swap done.`, { mark: { cur: toSwap, swap: [i, toSwap] }, vars: { ...V(), toSwap }, stale: last });
      swaps++;
      i = toSwap;
      snap(20, `i = ${i}. Follow the item down.`, { mark: { cur: i }, vars: { ...V(), toSwap }, stale: last });
      left = i * 2;
      snap(21, `left = ${i}*2 = ${left}.`, { mark: { cur: i }, vars: { ...V(), toSwap }, stale: last });
      right = i * 2 + 1;
      snap(22, `right = ${i}*2+1 = ${right}.`, { mark: { cur: i }, vars: { ...V(), toSwap }, stale: last });
    }
    snap(5, `Back in extract: return theMin = ${fmt(theMin)}. ${swaps} swap${swaps === 1 ? "" : "s"}; the moved item ${ended === "leaf" ? "reached a leaf" : "stopped above larger children"} at index ${i}.`, { mark: { cur: i }, vars: V(), done: true, swaps, returned: theMin, stale: last });
    return steps;
  }

  // Floyd's buildHeap: one step per decision, grouping the leaves
  function buildSteps(levelOrder) {
    const h = heapOf(levelOrder);
    const { steps, snap } = recorder(h);
    const n = h.size, firstLeaf = Math.floor(n / 2) + 1;
    snap(null, `Before: ${n} items in the order given. The shape is already a complete tree. The order is not a heap yet.`, { done_from: n + 1 });
    if (firstLeaf <= n) snap(1, `i = ${n} down to ${firstLeaf}: each is a leaf, because left = i*2 is at least ${firstLeaf}*2 = ${2 * firstLeaf} > ${n} = size. percolateDown returns at once. Half the nodes cost nothing.`, { done_from: firstLeaf, mark: { leaves: [firstLeaf, n] } });
    let total = 0;
    for (let i = firstLeaf - 1; i >= 1; i--) {
      let at = i;
      const val = h.arr[i];
      snap(2, `percolateDown(${i}): the item ${fmt(val)}. Everything below index ${i} was fixed earlier, so both of its subtrees are already heaps. Only ${fmt(val)} itself can be out of place.`, { done_from: i + 1, mark: { cur: i } });
      while (true) {
        const l = 2 * at, r = 2 * at + 1;
        if (l > n) { snap(2, `${fmt(val)} is at a leaf now (index ${at}): it stops.`, { done_from: i, mark: { cur: at } }); break; }
        const lv = h.arr[l], rv = r <= n ? h.arr[r] : null;
        const c = rv === null || lv < rv ? l : r, sv = h.arr[c];
        if (!(sv < val)) { snap(2, `${rv === null ? `Its only child is ${fmt(lv)}` : `Its children are ${fmt(lv)} and ${fmt(rv)}; the smaller is ${fmt(sv)}`}. ${fmt(sv)} < ${fmt(val)} is false, so ${fmt(val)} stays. The subtree at index ${i} is a heap.`, { done_from: i, mark: { cur: at, cmp: rv === null ? [l] : [l, r] } }); break; }
        h.arr[at] = sv; h.arr[c] = val; total++;
        snap(2, `${rv === null ? `Its only child is ${fmt(lv)}` : `Its children are ${fmt(lv)} and ${fmt(rv)}; the smaller is ${fmt(sv)}`}. ${fmt(sv)} < ${fmt(val)} is true: swap. ${fmt(val)} moves down to index ${c}.`, { done_from: i + 1, mark: { cur: c, swap: [at, c] } });
        at = c;
      }
    }
    snap(3, `The loop ends after i = 1. ${total} swap${total === 1 ? "" : "s"} in all, and every node is ≤ its children: it's a min-heap with ${fmt(h.arr[1])} at the root.`, { done_from: 1, done: true, swaps: total });
    return steps;
  }

  // the steppers' scenarios; Heap.java runs the same ones by name
  const HEAP_SCENARIOS = {
    insert: [
      { name: "lecture-1.5", label: "insert(1.5): the lecture's example", start: LECTURE_HEAP, x: 1.5 },
      { name: "lecture-8", label: "insert(8): no swaps", start: LECTURE_HEAP, x: 8 },
      { name: "small-1", label: "insert(1): all the way to the root", start: [3, 5, 4, 9, 6, 7], x: 1 },
    ],
    extract: [
      { name: "lecture-after-1.5", label: "extract(): the lecture's example", start: [1, 1.5, 2, 4, 3, 5, 6, 5, 9, 7] },
      { name: "stops-early", label: "extract(): stops above two larger children", start: [1, 3, 2, 4, 5, 10, 11, 6] },
      { name: "left-only", label: "extract(): a node with only a left child", start: [1, 2, 3, 4, 5] },
    ],
    build: [
      { name: "lecture-build", label: "buildHeap: the lecture's 10 items", start: BUILD_INPUT },
      { name: "already-heap", label: "buildHeap: input that is already a heap", start: [1, 2, 3, 4, 5, 6, 7] },
    ],
  };

  // buildHeap's worst-case moves on a perfect tree of height H: level by level from the bottom
  function buildCost(H) {
    const rows = [];
    for (let d = 0; d <= H; d++) rows.push({ height: d, nodes: 2 ** (H - d), moves: d, product: d * 2 ** (H - d) });
    const n = 2 ** (H + 1) - 1;
    return { H, n, rows, total: rows.reduce((s, r) => s + r.product, 0), nlogn: n * Math.log2(n) };
  }

  /* ---------------------------------------------------------------- Section 2: numUnique, one step per loop decision */
  const NUMUNIQUE_CODE = ["int numUnique(String[] values) {", "    boolean[] visited = new boolean[values.length];", "    for (int i = 0; i < values.length; i++) {", "        visited[i] = false;", "    }", "    int out = 0;", "    for (int i = 0; i < values.length; i++) {", "        if (!visited[i]) {", "            out += 1;", "            for (int j = i; j < values.length; j++) {", "                if (values[i].equals(values[j])) {", "                    visited[j] = true;", "                }", "            }", "        }", "    }", "    return out;", "}"];
  // line numbers below are the worksheet's (1-based), and index into NUMUNIQUE_CODE as line - 1
  function numUniqueSteps(values) {
    const n = values.length, visited = values.map(() => false);
    let out = 0, inner = 0;
    const steps = [];
    const snap = (line, say, extra = {}) => steps.push({ line, say, visited: visited.slice(), out, first: n, inner, ...extra });
    snap(3, `Lines 3–5: the first loop sets all ${n} entries of visited to false. That's ${n} iterations, whatever the values are.`);
    for (let i = 0; i < n; i++) {
      if (visited[i]) { snap(8, `i = ${i}: visited[${i}] is true ("${values[i]}" was already counted), so skip it. The inner loop doesn't run.`, { i }); continue; }
      out++;
      snap(9, `i = ${i}: visited[${i}] is false, so "${values[i]}" is new. out = ${out}. Now mark every later copy of it.`, { i });
      for (let j = i; j < n; j++) {
        inner++;
        const same = values[i] === values[j];
        if (same) visited[j] = true;
        snap(same ? 12 : 11, `j = ${j}: "${values[i]}" ${same ? "equals" : "doesn't equal"} "${values[j]}"${same ? `, so visited[${j}] = true` : ""}. Inner-loop iterations so far: ${inner}.`, { i, j });
      }
    }
    snap(17, `Return ${out}. Count: ${n} (first loop) + ${inner} (inner loop) = ${n + inner}.`, { done: true });
    return steps;
  }

  return {
    SLIDE_SORTED, linearSearch, binarySearchTrace, binaryWorstExhaustive, worstGaps,
    bigPow, digits, RACES, raceProfile, firstN,
    nPlusLogFails, logPlusTwoFails, threeTwoFails,
    CLAIMS, polyNum,
    LADDER, boundVerdict,
    LECTURE_HEAP, BUILD_INPUT, CODE, HEAP_SCENARIOS,
    percolateUp, percolateDown, heapOf, live, heapInsert, heapExtract, buildHeap, isMinHeap, heightOf, indexInfo, indexSay, heightSay,
    insertIdeaSteps, extractIdeaSteps, insertCodeSteps, extractCodeSteps, buildSteps, buildCost,
    NUMUNIQUE_CODE, numUniqueSteps,
  };
});
