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
    { id: "lin10", f: ["10", "2"], g: ["0", "1"], rel: "O", fTex: "2n + 10", gTex: "n", cs: ["1", "2", "3", "4", "5"], c0: "3", n00: 1, N: 30 },
  ];
  function polyNum(coeffs, n) { return coeffs.reduce((s, a, k) => s + Number(eval_(a)) * n ** k, 0); }
  function eval_(s) { const m = /^(-?\d+)(?:\/(\d+))?$/.exec(s); return m ? Number(m[1]) / (m[2] ? Number(m[2]) : 1) : NaN; }

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
  // what the index widget says about index i of a heap given in level order
  function indexSay(i, levelOrder) {
    const n = levelOrder.length, at = (k) => fmt(levelOrder[k - 1]), p = Math.floor(i / 2);
    const lines = [i === 1 ? "Parent: none. Index 1 is the root." : `Parent: ${i}/2 = ${p}, which holds ${at(p)}.`];
    if (2 * i > n) lines.push(`Children: ${i}*2 = ${2 * i} is past n = ${n}, so none. Index ${i} is a leaf.`);
    else {
      lines.push(`Left child: ${i}*2 = ${2 * i}, which holds ${at(2 * i)}.`);
      lines.push(2 * i + 1 <= n ? `Right child: ${i}*2+1 = ${2 * i + 1}, which holds ${at(2 * i + 1)}.` : `Right child: ${i}*2+1 = ${2 * i + 1} is past n = ${n}, so none.`);
    }
    return lines;
  }
  function heightSay(n) {
    const h = heightOf(n);
    const cap = 2 ** (h + 1) - 1, below = 2 ** h - 1;
    return `n = ${n}: height ${h}. A tree of height ${h} holds at most 2^${h + 1} − 1 = ${cap} node${cap === 1 ? "" : "s"}${h > 0 ? `, and height ${h - 1} holds at most 2^${h} − 1 = ${below}, which is fewer than ${n}` : ""}.${n === cap ? " This tree is full: one more node starts a new level." : ""}`;
  }

  /* Step-by-step walks for the steppers. Each step is the state right after its line (or list of lines) runs, plus
     what it did and why. Comparisons are narrated as "a < b is true/false" and index arithmetic as "10/2 = 5", "4*2 = 8",
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

  // Lecture 4's insert, at the level of the tree
  function insertIdeaSteps(levelOrder, x) {
    const h = heapOf(levelOrder);
    const { steps, snap } = recorder(h);
    snap(null, `A min-heap of ${h.size} items. The smallest, ${fmt(h.arr[1])}, is at the root.`);
    h.size++; h.arr[h.size] = x;
    let i = h.size;
    const newLevel = (i & (i - 1)) === 0;
    snap(1, `Put ${fmt(x)} in the next open spot${newLevel ? " (the bottom level was full, so it starts a new one)" : ""}. The shape is still complete.${i > 1 ? ` Is ${fmt(x)} smaller than its parent, ${fmt(h.arr[Math.floor(i / 2)])}?` : ""}`, { mark: { cur: i } });
    let swaps = 0;
    while (true) {
      if (i === 1) { snap(2, `${fmt(x)} is at the root. Nothing above it: stop.`, { mark: { cur: i } }); break; }
      const p = Math.floor(i / 2), pv = h.arr[p];
      if (!(x < pv)) { snap(2, `${fmt(x)} < ${fmt(pv)} is false. The parent is smaller or equal: stop.`, { mark: { cur: i, cmp: [p] } }); break; }
      h.arr[i] = pv; h.arr[p] = x; swaps++;
      snap(3, `${fmt(x)} < ${fmt(pv)} is true, so swap: ${fmt(x)} moves up a level.`, { mark: { cur: p, swap: [i, p] } });
      i = p;
    }
    snap(5, `Done: ${swaps} swap${swaps === 1 ? "" : "s"}, at most one per level.`, { mark: { cur: i }, done: true, swaps });
    return steps;
  }

  // Lecture 4's extract, at the level of the tree
  function extractIdeaSteps(levelOrder) {
    const h = heapOf(levelOrder);
    const { steps, snap } = recorder(h);
    snap(null, `A min-heap of ${h.size} items. The answer is the smallest, ${fmt(h.arr[1])}, at the root.`);
    const min = h.arr[1];
    const last = h.size, cv = h.arr[last];
    h.arr[1] = cv; h.size--;
    let i = 1, swaps = 0;
    snap(3, `Save min = ${fmt(min)}. Move the bottom-right item, ${fmt(cv)}, into the root, so the shape stays complete. ${fmt(cv)} is probably too big up there.`, { mark: { cur: 1 }, vars: { min }, stale: last });
    while (true) {
      const l = 2 * i, r = 2 * i + 1;
      if (l > h.size) { snap(4, `${fmt(cv)} is a leaf now: stop.`, { mark: { cur: i }, vars: { min }, stale: last }); break; }
      const lv = h.arr[l], rv = r <= h.size ? h.arr[r] : null;
      const gl = cv > lv, gr = rv !== null && cv > rv;
      const cmpText = rv === null ? `${fmt(cv)} > ${fmt(lv)} is ${tf(gl)} (no right child)` : `${fmt(cv)} > ${fmt(lv)} is ${tf(gl)}, ${fmt(cv)} > ${fmt(rv)} is ${tf(gr)}`;
      if (!gl && !gr) { snap(4, `${cmpText}. ${fmt(cv)} is ≤ ${rv === null ? "its child" : "both children"}: stop.`, { mark: { cur: i, cmp: rv === null ? [l] : [l, r] }, vars: { min }, stale: last }); break; }
      const c = rv === null || lv < rv ? l : r, sv = h.arr[c];
      h.arr[i] = sv; h.arr[c] = cv; swaps++;
      snap(5, `${cmpText}. Swap ${fmt(cv)} with ${fmt(sv)}, ${rv === null ? "its only child" : "the smaller child"}.`, { mark: { cur: c, swap: [i, c] }, vars: { min }, stale: last });
      i = c;
    }
    snap(7, `Return ${fmt(min)}. ${swaps} swap${swaps === 1 ? "" : "s"}, at most one per level.`, { mark: { cur: i }, vars: { min }, done: true, swaps, returned: min, stale: last });
    return steps;
  }

  // Lecture 5's array code: insert + percolateUp, one step per decision
  function insertCodeSteps(levelOrder, x, capacity = 16) {
    const h = heapOf(levelOrder);
    const { steps, snap } = recorder(h);
    snap(null, `A min-heap of ${h.size} items in arr[1] to arr[${h.size}], level by level. The array has length ${capacity}, and arr[0] is never used. Now insert ${fmt(x)}.`);
    const full = h.size === capacity - 1;
    h.size++; h.arr[h.size] = x;
    let i = h.size, parent = Math.floor(i / 2);
    snap([1, 2, 3], `size == arr.length - 1 is ${h.size - 1} == ${capacity - 1}: ${tf(full)}, so ${full ? "the array grows first" : "no resize"}. size++ makes size = ${h.size}, and arr[${i}] = ${fmt(x)} puts the item in the next open spot.`, { mark: { cur: i } });
    const val = h.arr[i];
    snap([4, 8, 9], `percolateUp(${i}): parent = ${i}/2 = ${parent}, and val = arr[${i}] = ${fmt(val)} saves the moving item.`, { mark: { cur: i, cmp: [parent] }, vars: { i, parent, val } });
    let swaps = 0;
    while (true) {
      const vars = { i, parent, val };
      if (!(i > 1)) { snap(10, `${i} > 1 is false: ${fmt(val)} is at the root. The && stops before it reads arr[0], the unused slot.`, { mark: { cur: i }, vars }); break; }
      if (!(h.arr[i] < h.arr[parent])) { snap(10, `${i} > 1 is true, but ${fmt(h.arr[i])} < ${fmt(h.arr[parent])} is false: the parent is no bigger. The loop ends.`, { mark: { cur: i, cmp: [parent] }, vars }); break; }
      snap(10, `${i} > 1 is true and ${fmt(h.arr[i])} < ${fmt(h.arr[parent])} is true: the item is smaller than its parent, so the loop runs.`, { mark: { cur: i, cmp: [parent] }, vars });
      const pv = h.arr[parent], from = i;
      h.arr[i] = pv; h.arr[parent] = val; swaps++;
      i = parent; parent = Math.floor(i / 2);
      snap([11, 12, 13, 14], `Swap in two lines: arr[${from}] = arr[${i}] = ${fmt(pv)} moves the parent down, and arr[${i}] = val = ${fmt(val)} moves the item up. Then i = ${i} and parent = ${i}/2 = ${parent}.`, { mark: { cur: i, swap: [from, i] }, vars: { i, parent, val } });
    }
    snap(16, `percolateUp returns. ${fmt(x)} is at index ${i} after ${swaps} swap${swaps === 1 ? "" : "s"}.`, { mark: { cur: i }, vars: { i, parent, val }, done: true, swaps });
    return steps;
  }

  // Lecture 5's array code: extract + percolateDown, one step per decision
  function extractCodeSteps(levelOrder) {
    const h = heapOf(levelOrder);
    const { steps, snap } = recorder(h);
    const last = h.size;
    snap(null, `A min-heap of ${h.size} items. The smallest is at the root: arr[1] = ${fmt(h.arr[1])}.`);
    const theMin = h.arr[1];
    snap(1, `theMin = arr[1] = ${fmt(theMin)}. Save the answer first: the next line writes over arr[1].`, { mark: { cur: 1 }, vars: { theMin } });
    h.arr[1] = h.arr[last]; h.size--;
    snap([2, 3], `arr[1] = arr[${last}] = ${fmt(h.arr[1])}: the last item moves to the root. Then size = ${h.size}, so the old copy at index ${last} is no longer in the heap.`, { mark: { cur: 1 }, vars: { theMin }, stale: last });
    let i = 1, left = 2, right = 3;
    const val = h.arr[1];
    snap([4, 9, 10, 11], `percolateDown(1): left = 1*2 = 2, right = 1*2+1 = 3, and val = arr[1] = ${fmt(val)} saves the moving item.`, { mark: { cur: 1 }, vars: { theMin, i, left, right, val }, stale: last });
    let swaps = 0;
    while (true) {
      const vars = { theMin, i, left, right, val };
      if (!(left <= h.size)) { snap(12, `${left} <= ${h.size} is false: index ${i} has no children. The loop ends.`, { mark: { cur: i }, vars, stale: last }); break; }
      const noRight = right > h.size;
      const leftLess = !noRight && h.arr[left] < h.arr[right];
      const toSwap = noRight || leftLess ? left : right;
      const pick = noRight
        ? `${right} > ${h.size} is true: there's no right child, so the || stops without reading index ${right}. toSwap = left = ${left}.`
        : `${right} > ${h.size} is false, and ${fmt(h.arr[left])} < ${fmt(h.arr[right])} is ${tf(leftLess)}, so toSwap = ${leftLess ? `left = ${left}` : `right = ${right}`}.`;
      snap(toSwap === left ? [12, 13, 14, 15] : [12, 13, 14], `${left} <= ${h.size} is true: index ${i} has a child. Pick the smaller child. ${pick}`, { mark: { cur: i, cmp: [toSwap] }, vars: { ...vars, toSwap }, stale: last });
      const cv = h.arr[toSwap];
      if (!(cv < val)) { snap([17, 24], `${fmt(cv)} < ${fmt(val)} is false: no child is smaller than ${fmt(val)}. else: return. The heap is fixed.`, { mark: { cur: i, cmp: [toSwap] }, vars: { ...vars, toSwap }, stale: last }); break; }
      const from = i;
      h.arr[i] = cv; h.arr[toSwap] = val; swaps++;
      i = toSwap; left = i * 2; right = i * 2 + 1;
      snap([17, 18, 19, 20, 21, 22], `${fmt(cv)} < ${fmt(val)} is true, so swap: arr[${from}] = arr[${i}] = ${fmt(cv)} and arr[${i}] = val = ${fmt(val)}. Then i = ${i}, left = ${i}*2 = ${left}, right = ${i}*2+1 = ${right}.`, { mark: { cur: i, swap: [from, i] }, vars: { theMin, i, left, right, val, toSwap }, stale: last });
    }
    snap(5, `Back in extract: return theMin = ${fmt(theMin)}. ${swaps} swap${swaps === 1 ? "" : "s"}.`, { mark: { cur: i }, vars: { theMin, i, left, right, val }, done: true, swaps, returned: theMin, stale: last });
    return steps;
  }

  // Floyd's buildHeap: one step per percolateDown(i) call, drawn after the call with the path the item sank along
  function buildSteps(levelOrder) {
    const h = heapOf(levelOrder);
    const { steps, snap } = recorder(h);
    const n = h.size, half = Math.floor(n / 2);
    snap(null, `${n} items, in the order given. The shape is already a complete tree. The order isn't a heap yet.`, { done_from: n + 1 });
    snap(1, `i = ${n} down to ${half + 1} are leaves: ${half + 1}*2 = ${2 * (half + 1)} is past ${n}, so they have no children and percolateDown does nothing. The first real work is at i = ${n}/2 = ${half}.`, { done_from: half + 1, mark: { leaves: [half + 1, n] } });
    let total = 0;
    for (let i = half; i >= 1; i--) {
      const val = h.arr[i], path = [i], said = [];
      let at = i;
      while (2 * at <= n) {
        const l = 2 * at, r = l + 1;
        const c = r <= n && !(h.arr[l] < h.arr[r]) ? r : l, cv = h.arr[c];
        const kid = r <= n ? `Smaller child ${fmt(cv)}` : `Only child ${fmt(cv)}`;
        if (!(cv < val)) { said.push(`${kid}: ${fmt(cv)} < ${fmt(val)} is false, so stop.`); break; }
        h.arr[at] = cv; h.arr[c] = val; total++; path.push(c); at = c;
        said.push(`${kid}: ${fmt(cv)} < ${fmt(val)} is true, so swap.`);
      }
      if (2 * at > n) said.push("Now it's a leaf.");
      const k = path.length - 1;
      const why = i === Math.floor(half / 2) ? ` Both subtrees under index ${i} were fixed by earlier calls, so only ${fmt(val)} can be out of place.` : "";
      snap(2, `percolateDown(${i}) sinks ${fmt(val)}. ${said.join(" ")} ${k} swap${k === 1 ? "" : "s"}.${why}`, { done_from: i, mark: { cur: at, swap: path } });
    }
    snap(3, `The loop ends after i = 1: ${total} swap${total === 1 ? "" : "s"} in all. Every node is ≤ its children, so it's a min-heap.`, { done_from: 1, done: true, swaps: total });
    return steps;
  }

  // the steppers' scenarios; Heap.java runs the same ones by name
  const HEAP_SCENARIOS = {
    insert: [
      { name: "lecture-1.5", start: LECTURE_HEAP, x: 1.5 },
      { name: "array-insert", start: [2, 4, 3, 7, 5], x: 1 },
    ],
    extract: [
      { name: "lecture-after-1.5", start: [1, 1.5, 2, 4, 3, 5, 6, 5, 9, 7] },
      { name: "array-extract", start: [1, 4, 2, 5, 6, 9, 7] },
    ],
    build: [
      { name: "lecture-build", start: BUILD_INPUT },
    ],
  };

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
  // numUnique one outer iteration at a time: whether row i runs the inner loop, which j it scans, which copies it marks
  function numUniqueRows(values) {
    const n = values.length, visited = values.map(() => false), rows = [];
    let out = 0, inner = 0;
    for (let i = 0; i < n; i++) {
      if (visited[i]) { rows.push({ i, skipped: true, js: [], marked: [], out, inner, visited: visited.slice() }); continue; }
      out++;
      const js = [], marked = [];
      for (let j = i; j < n; j++) { inner++; js.push(j); if (values[i] === values[j]) { visited[j] = true; marked.push(j); } }
      rows.push({ i, skipped: false, js, marked, out, inner, visited: visited.slice() });
    }
    return rows;
  }

  return {
    SLIDE_SORTED, linearSearch, binarySearchTrace, binaryWorstExhaustive, worstGaps,
    bigPow, digits, RACES, raceProfile, firstN,
    nPlusLogFails, logPlusTwoFails, threeTwoFails,
    CLAIMS, polyNum,
    LECTURE_HEAP, BUILD_INPUT, CODE, HEAP_SCENARIOS,
    percolateUp, percolateDown, heapOf, live, heapInsert, heapExtract, buildHeap, isMinHeap, heightOf, indexInfo, indexSay, heightSay,
    insertIdeaSteps, extractIdeaSteps, insertCodeSteps, extractCodeSteps, buildSteps,
    NUMUNIQUE_CODE, numUniqueSteps, numUniqueRows,
  };
});
