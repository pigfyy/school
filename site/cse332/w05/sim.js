/* CSE 332 week 5 · pure models of the week's code. No DOM. checks/cse332/w05/verify.mjs checks these against its own
   independent implementations and against every answer key on the page.
   - Sorting (Lectures 12-13, Section 5): insertion, selection, in-place heap, merge, quicksort with the lecture's
     partition, bucket and radix sort, each with step-by-step frames and comparison counts.
   - Hashing (Section 5): week 4's tables (chaining, linear / quadratic / double probing, tombstones). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Sim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------------------------------------------------------- sorting (Lectures 12 and 13, Section 5)
     Each sort returns { out, frames, comparisons, swaps }. A frame is { a: array snapshot, hi: [indices], note, done: [indices] }.
     "comparisons" counts comparisons between two items of the array (or with the pivot). */
  const snap = (a, hi, note, done = []) => ({ a: a.slice(), hi, note, done });
  // insertion sort (slide 7's idea): swap a[j] left while the left neighbour is larger. Ties don't swap (stable).
  function insertionSort(input) {
    const a = input.slice(), frames = [snap(a, [], "Start. The sorted prefix is just a[0].", [0])];
    let comparisons = 0, swaps = 0;
    for (let i = 1; i < a.length; i++) {
      let j = i;
      while (j > 0) {
        comparisons++;
        if (a[j - 1] > a[j]) { [a[j - 1], a[j]] = [a[j], a[j - 1]]; swaps++; j--; } else break;
      }
      frames.push(snap(a, [j], `Inserted ${a[j]}: the prefix a[0..${i}] is sorted.`, [...Array(i + 1).keys()]));
    }
    return { out: a, frames, comparisons, swaps };
  }
  // selection sort (Section 5, slide 5): find the smallest in the unsorted part, swap it to the front of that part
  function selectionSort(input) {
    const a = input.slice(), frames = [snap(a, [], "Start.")];
    let comparisons = 0, swaps = 0;
    for (let i = 0; i < a.length - 1; i++) {
      let m = i;
      for (let j = i + 1; j < a.length; j++) { comparisons++; if (a[j] < a[m]) m = j; }
      if (m !== i) { [a[i], a[m]] = [a[m], a[i]]; swaps++; }
      frames.push(snap(a, [i, m], `Smallest of a[${i}..] is ${a[i]}; swapped into index ${i}.`, [...Array(i + 1).keys()]));
    }
    return { out: a, frames, comparisons, swaps };
  }
  // in-place heap sort (slides 22-29), 0-indexed max heap: children 2i+1, 2i+2
  function percolateDownMax(a, i, size, cnt) {
    while (2 * i + 1 < size) {
      let c = 2 * i + 1;
      if (c + 1 < size) { cnt.c++; if (a[c + 1] > a[c]) c++; }
      cnt.c++;
      if (a[c] > a[i]) { [a[c], a[i]] = [a[i], a[c]]; cnt.s++; i = c; } else break;
    }
  }
  function buildMaxHeap(input) { const a = input.slice(), cnt = { c: 0, s: 0 }; for (let i = Math.floor(a.length / 2) - 1; i >= 0; i--) percolateDownMax(a, i, a.length, cnt); return { a, comparisons: cnt.c, swaps: cnt.s }; }
  function heapSort(input, { prebuilt = false } = {}) {
    const cnt = { c: 0, s: 0 };
    const a = input.slice();
    if (!prebuilt) for (let i = Math.floor(a.length / 2) - 1; i >= 0; i--) percolateDownMax(a, i, a.length, cnt);
    const frames = [snap(a, [], prebuilt ? "A max heap (slide 14)." : "Floyd's buildHeap made a max heap in place.")];
    for (let end = a.length - 1; end > 0; end--) {
      [a[0], a[end]] = [a[end], a[0]]; cnt.s++;
      percolateDownMax(a, 0, end, cnt);
      frames.push(snap(a, [end], `Swapped the max ${a[end]} to index ${end}, then percolated down; the heap is a[0..${end - 1}].`, Array.from({ length: a.length - end }, (_, k) => end + k)));
    }
    return { out: a, frames, comparisons: cnt.c, swaps: cnt.s };
  }
  // merge sort (slides 10-11): inclusive low/high, mid = floor((low+high)/2); ties take the left (stable)
  function mergeSort(input) {
    const a = input.slice(), frames = [snap(a, [], "Start.")], merges = [];
    let comparisons = 0;
    const ms = (low, high) => {
      if (low >= high) return;
      const mid = Math.floor((low + high) / 2);
      ms(low, mid); ms(mid + 1, high);
      const merged = []; let l = low, r = mid + 1, c = 0;
      while (l <= mid && r <= high) { c++; merged.push(a[l] <= a[r] ? a[l++] : a[r++]); }
      while (l <= mid) merged.push(a[l++]);
      while (r <= high) merged.push(a[r++]);
      for (let i = 0; i < merged.length; i++) a[low + i] = merged[i];
      comparisons += c;
      merges.push({ low, mid, high, comparisons: c, result: merged.slice() });
      frames.push(snap(a, Array.from({ length: high - low + 1 }, (_, k) => low + k), `Merged a[${low}..${mid}] and a[${mid + 1}..${high}] with ${c} comparison${c === 1 ? "" : "s"}.`));
    };
    ms(0, a.length - 1);
    return { out: a, frames, comparisons, merges };
  }
  // partition (slides 18-22): pivot at a[lo]; Begin = lo+1, End = hi. While Begin < End: if a[Begin] < p move Begin right,
  // else swap a[Begin] with a[End] and move End left. Then swap p with a[Begin] if a[Begin] < p, else with a[Begin-1].
  function partition(a, lo, hi, cnt) {
    const p = a[lo];
    let b = lo + 1, e = hi;
    while (b < e) {
      cnt.c++;
      if (a[b] < p) b++;
      else { [a[b], a[e]] = [a[e], a[b]]; cnt.s++; e--; }
    }
    cnt.c++;
    const at = a[b] < p ? b : b - 1;
    if (at !== lo) { [a[lo], a[at]] = [a[at], a[lo]]; cnt.s++; }
    return at;
  }
  // quicksort with the leftmost element as the pivot (Section 5's assumption); pivot: "first" | "median3"
  function quickSort(input, pivot = "first") {
    const a = input.slice(), frames = [snap(a, [], "Start.")], parts = [];
    const cnt = { c: 0, s: 0 };
    let depth = 0;
    const qs = (lo, hi, d) => {
      if (lo >= hi) return;
      depth = Math.max(depth, d);
      if (pivot === "median3") {
        const mid = Math.floor((lo + hi) / 2);
        const trio = [lo, mid, hi].sort((x, y) => a[x] - a[y]);
        const m = trio[1];
        [a[lo], a[m]] = [a[m], a[lo]];
      }
      const p = a[lo];
      const at = partition(a, lo, hi, cnt);
      parts.push({ lo, hi, pivot: p, at, result: a.slice(lo, hi + 1) });
      frames.push(snap(a, [at], `Partitioned a[${lo}..${hi}] around ${p}; it lands at index ${at}.`));
      qs(lo, at - 1, d + 1); qs(at + 1, hi, d + 1);
    };
    qs(0, a.length - 1, 1);
    return { out: a, frames, comparisons: cnt.c, swaps: cnt.s, parts, depth };
  }
  // bucket sort for integers 0..k-1 (slide 31) and LSD radix sort (slides 34-37); both stable
  function bucketSort(input, k, key = (x) => x) {
    const buckets = Array.from({ length: k }, () => []);
    for (const x of input) buckets[key(x)].push(x);
    return { out: buckets.flat(), buckets };
  }
  function radixSort(input, base = 10) {
    const max = Math.max(...input, 0);
    let a = input.slice(), place = 1;
    const passes = [], frames = [snap(a, [], "Start.")];
    do {
      const pl = place;
      const r = bucketSort(a, base, (x) => Math.floor(x / pl) % base);
      a = r.out;
      passes.push({ place: pl, buckets: r.buckets, out: a.slice() });
      frames.push(snap(a, [], `Bucketed by the ${pl}'s digit: ${r.buckets.map((b, i) => (b.length ? `${i}: [${b.join(", ")}]` : null)).filter(Boolean).join("  ")}.`));
      place *= base;
    } while (place <= max);
    return { out: a, passes, frames };
  }
  const inversions = (a) => { let n = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) n++; return n; };
  const medianOf3 = (a) => { const lo = 0, hi = a.length - 1, mid = Math.floor(hi / 2); return [a[lo], a[mid], a[hi]].sort((x, y) => x - y)[1]; };
  const SORTS = { insertion: insertionSort, selection: selectionSort, heap: heapSort, merge: mergeSort, quick: quickSort, radix: radixSort };

  /* ---------------------------------------------------------------- hashing (Lectures 10 and 11) */
  // the string hashes of slide 18, exactly (BigInt; Java's int arithmetic would wrap, the math here doesn't)
  const ascii = (s) => [...s].map((c) => BigInt(c.charCodeAt(0)));
  const H = {
    h1: (s) => (s.length ? ascii(s)[0] : 0n),
    h2: (s) => ascii(s).reduce((t, a) => t + a, 0n),
    h3: (s) => ascii(s).reduce((t, a, i) => t + a * 31n ** BigInt(i), 0n),
    h4: (s) => 2n * ascii(s).reduce((t, a, i) => t + a * 31n ** BigInt(i), 0n),
  };
  // slide 20: Horner's rule, from the last character down; returns the running values of h
  function horner(s) { const a = ascii(s), steps = []; let h = 0n; for (let i = a.length - 1; i >= 0; i--) { h = 31n * h + a[i]; steps.push(h); } return steps; }
  const mod = (x, m) => Number(((BigInt(x) % BigInt(m)) + BigInt(m)) % BigInt(m));
  const isPrime = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
  const nextPrime = (n) => { while (!isPrime(n)) n++; return n; };
  const TOMB = "†"; // a tombstone

  // a hash table of integer keys with h(k) = k. mode: "chain" | "linear" | "quadratic" | "double". g is for double hashing.
  function table(size, mode = "chain", g = (k) => 1 + mod(k, Math.max(1, size - 2))) {
    return { size, mode, g, slots: Array.from({ length: size }, () => (mode === "chain" ? [] : null)), n: 0 };
  }
  // the i-th index on k's probe path
  function probeAt(t, k, i) {
    const h = mod(k, t.size);
    if (t.mode === "linear") return (h + i) % t.size;
    if (t.mode === "quadratic") return (h + i * i) % t.size;
    return mod(h + i * t.g(k), t.size);
  }
  // insert: returns { index, probes (indices looked at), ok, replaced }
  function insert(t, k) {
    if (t.mode === "chain") {
      const i = mod(k, t.size), b = t.slots[i];
      if (b.includes(k)) return { index: i, probes: [i], ok: true, dup: true, compares: b.indexOf(k) + 1 };
      b.push(k); t.n++;
      return { index: i, probes: [i], ok: true, dup: false, compares: b.length - 1 };
    }
    const probes = []; let dest = -1;
    for (let i = 0; i < t.size; i++) {
      const j = probeAt(t, k, i); probes.push(j);
      const v = t.slots[j];
      if (v === k) return { index: j, probes, ok: true, dup: true };
      if (v === TOMB) { if (dest < 0) dest = j; continue; }
      if (v === null) { const at = dest >= 0 ? dest : j; t.slots[at] = k; t.n++; return { index: at, probes, ok: true, dup: false }; }
    }
    if (dest >= 0) { t.slots[dest] = k; t.n++; return { index: dest, probes, ok: true, dup: false }; }
    return { index: -1, probes, ok: false }; // probed table.length times without finding a spot
  }
  function find(t, k) {
    if (t.mode === "chain") { const i = mod(k, t.size), b = t.slots[i], at = b.indexOf(k); return { found: at >= 0, index: i, probes: [i], compares: at >= 0 ? at + 1 : b.length }; }
    const probes = [];
    for (let i = 0; i < t.size; i++) {
      const j = probeAt(t, k, i); probes.push(j);
      if (t.slots[j] === k) return { found: true, index: j, probes };
      if (t.slots[j] === null) return { found: false, index: -1, probes };
    }
    return { found: false, index: -1, probes };
  }
  // delete: chaining removes from the bucket; open addressing leaves a tombstone (slide 24, option 2)
  function remove(t, k) {
    const f = find(t, k);
    if (!f.found) return f;
    if (t.mode === "chain") t.slots[f.index].splice(t.slots[f.index].indexOf(k), 1); else t.slots[f.index] = TOMB;
    t.n--;
    return f;
  }
  const load = (t) => t.n / t.size;
  // rehash (slide 34): a new table of size newSize, re-inserting every key in index order
  function rehash(t, newSize, g) {
    const u = table(newSize, t.mode, g);
    const keys = t.mode === "chain" ? t.slots.flat() : t.slots.filter((v) => v !== null && v !== TOMB);
    for (const k of keys) insert(u, k);
    return u;
  }
  const buildTable = (size, mode, keys, g) => { const t = table(size, mode, g); const log = keys.map((k) => ({ k, ...insert(t, k) })); return { t, log }; };

  return {
    insertionSort, selectionSort, buildMaxHeap, heapSort, mergeSort, partition, quickSort, bucketSort, radixSort, inversions, medianOf3, SORTS,
    H, horner, mod, isPrime, nextPrime, TOMB, table, probeAt, insert, find, remove, load, rehash, buildTable,
  };
});
