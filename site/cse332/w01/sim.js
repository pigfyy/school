/* CSE 332 week 1 · pure simulations of the lecture's own code.
   No DOM. The widgets draw these; checks/cse332/w01/verify.mjs checks them against the same code compiled with javac. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Sim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------------------------------------------------------- Lecture 1: queues */
  // The state on slides 16-19: array of length 10 holding 5 8 3 4 7, front=0, back=5.
  const SLIDE_QUEUE = [5, 8, 3, 4, 7];
  const SLIDE_LENGTH = 10;

  // Circular array queue, slide 18 code (no resize: that's Exercise 0).
  function circularQueue(length = SLIDE_LENGTH, initial = SLIDE_QUEUE) {
    const queue = new Array(length).fill(null);
    let front = 0, back = 0, size = 0;
    const q = {
      get queue() { return queue.slice(); },
      // index i holds a live item iff it is within size steps of front (old values stay in the array, as in the slide code)
      live(i) { return ((i - front + length) % length) < size; }, get front() { return front; }, get back() { return back; }, get size() { return size; },
      length,
      canEnqueue() { return size < length; },
      enqueue(x) {
        if (size >= length) throw new Error("full");
        queue[back] = x;
        back = (back + 1) % length;
        size++;
      },
      dequeue() {
        if (size === 0) throw new Error("empty");
        const first = queue[front];
        front = (front + 1) % length;
        size--;
        return first;
      },
      isEmpty() { return size === 0; },
    };
    initial.forEach((x) => q.enqueue(x));
    return q;
  }

  // Linked queue, slide 15 code. enqueue needs back != null and dequeue needs front != null
  // (the slide's code assumes a non-empty queue; the empty case is Exercise 0).
  function linkedQueue(initial = SLIDE_QUEUE) {
    let front = null, back = null;
    for (const x of initial) {
      const node = { value: x, next: null };
      if (back) back.next = node; else front = node;
      back = node;
    }
    return {
      values() { const out = []; for (let n = front; n; n = n.next) out.push(n.value); return out; },
      get frontValue() { return front ? front.value : null; },
      get backValue() { return back ? back.value : null; },
      canEnqueue() { return back !== null; },
      enqueue(x) {
        if (back === null) throw new Error("back is null");
        const last = { value: x, next: null };
        back.next = last;
        back = last;
      },
      dequeue() {
        if (front === null) throw new Error("empty");
        const first = front.value;
        front = front.next;
        if (front === null) back = null;
        return first;
      },
      isEmpty() { return front === null; },
    };
  }

  // Run "dequeue" / "enqueue x" / "push x" / "pop" scripts on the ADT's behavior.
  function runAdt(kind, ops) {
    const items = [], out = [];
    for (const op of ops) {
      if (op[0] === "add") items.push(op[1]);
      else if (op[0] === "remove") {
        if (!items.length) { out.push(null); continue; }
        out.push(kind === "stack" ? items.pop() : items.shift());
      }
    }
    return { removed: out, remaining: items };
  }

  /* ---------------------------------------------------------------- Lecture 2: Example 1, myFunction
     Counts arithmetic ops (+ - * / %, ++) exactly as the slide-16 annotations do:
     3 assignments with arithmetic, i++ and b++ each iteration, b % 2 once, then c++ or (i++, c++) n times.
     Loop comparisons (i < n.size()) are not arithmetic and are not counted. */
  const MYFUNCTION_LINES = [
    "myFunction(List n){",            // 0
    "    b = 55 + 5;",                 // 1
    "    c = b / 3;",                  // 2
    "    b = c + 100;",                // 3
    "    for (i = 0; i < n.size(); i++) {", // 4
    "        b++;",                    // 5
    "    }",                           // 6
    "    if (b % 2 == 0) {",           // 7
    "        c++;",                    // 8
    "    }",                           // 9
    "    else {",                      // 10
    "        for (i = 0; i < n.size(); i++) {", // 11
    "            c++;",                // 12
    "        }",                       // 13
    "    }",                           // 14
    "    return c;",                   // 15
    "}",                               // 16
  ];
  // Yields steps {line, ops, note, vars}. ops = arithmetic ops performed by this step.
  function* myFunctionSteps(n) {
    let b, c, i;
    b = 55 + 5; yield { line: 1, ops: 1, note: "55 + 5", vars: { b } };
    c = Math.trunc(b / 3); yield { line: 2, ops: 1, note: "b / 3", vars: { b, c } };
    b = c + 100; yield { line: 3, ops: 1, note: "c + 100", vars: { b, c } };
    for (i = 0; ; ) {
      if (!(i < n)) { yield { line: 4, ops: 0, note: `i < n.size() is false (i = ${i}): loop ends`, vars: { b, c, i } }; break; }
      yield { line: 4, ops: 0, note: `i < n.size() is true (i = ${i})`, vars: { b, c, i } };
      b++; yield { line: 5, ops: 1, note: "b++", vars: { b, c, i } };
      i++; yield { line: 4, ops: 1, note: "i++", vars: { b, c, i } };
    }
    const even = b % 2 === 0;
    yield { line: 7, ops: 1, note: `b % 2 = ${b % 2}, so ${even ? "take the if branch" : "take the else branch"}`, vars: { b, c } };
    if (even) {
      c++; yield { line: 8, ops: 1, note: "c++", vars: { b, c } };
    } else {
      for (i = 0; ; ) {
        if (!(i < n)) { yield { line: 11, ops: 0, note: `i < n.size() is false (i = ${i}): loop ends`, vars: { b, c, i } }; break; }
        yield { line: 11, ops: 0, note: `i < n.size() is true (i = ${i})`, vars: { b, c, i } };
        c++; yield { line: 12, ops: 1, note: "c++", vars: { b, c, i } };
        i++; yield { line: 11, ops: 1, note: "i++", vars: { b, c, i } };
      }
    }
    yield { line: 15, ops: 0, note: `return c (= ${c})`, vars: { b, c }, done: true };
  }
  function myFunctionCount(n) {
    let total = 0;
    for (const s of myFunctionSteps(n)) total += s.ops;
    return total;
  }

  /* Example 2, beAnnoying: prints = n*n, adds = n */
  function beAnnoyingCounts(n) {
    let prints = 0, adds = 0;
    for (let i = 0; i < n; i++) { adds++; for (let j = 0; j < n; j++) prints++; }
    return { prints, adds };
  }

  /* ---------------------------------------------------------------- ArrayList add (slides 20-21)
     Counted the way slide 21 counts: 1 for writing the new value, 1 for each element copied by resize. */
  function arrayListAdds(initialCapacity, adds) {
    let length = initialCapacity, size = 0, writes = 0, copies = 0;
    const perAdd = [];
    for (let k = 0; k < adds; k++) {
      let cost = 0;
      if (length === size) { copies += length; cost += length; length *= 2; }
      writes++; cost++;
      size++;
      perAdd.push(cost);
    }
    return { length, size, writes, copies, total: writes + copies, perAdd };
  }

  /* ---------------------------------------------------------------- searching (slides 23-26) */
  const SLIDE_SORTED = [5, 8, 13, 42, 75, 79, 88, 90, 95, 99];

  // contains: counts a.get(i) == k comparisons
  function linearSearch(a, k) {
    let comparisons = 0;
    for (let i = 0; i < a.length; i++) {
      comparisons++;
      if (a[i] === k) return { found: true, comparisons, index: i };
    }
    return { found: false, comparisons, index: -1 };
  }

  // binary_contains: one step per loop iteration
  function binarySearchTrace(a, k) {
    let start = 0, end = a.length;
    const steps = [];
    while (start < end) {
      const mid = start + Math.floor((end - start) / 2);
      const v = a[mid];
      const step = { start, end, mid, value: v };
      steps.push(step);
      if (v === k) { step.outcome = "found"; return { found: true, iterations: steps.length, steps }; }
      else if (v < k) { step.outcome = "right"; start = mid + 1; }
      else { step.outcome = "left"; end = mid; }
    }
    return { found: false, iterations: steps.length, steps, finalStart: start, finalEnd: end };
  }

  // Exhaustive worst case over every target for a sorted list of n distinct values (0, 2, 4, ...):
  // each present value plus each of the n+1 gaps. Every possible search path is one of these.
  function binaryWorstExhaustive(n) {
    const a = Array.from({ length: n }, (_, i) => 2 * i);
    let worst = 0;
    for (let k = -1; k <= 2 * n - 1; k++) worst = Math.max(worst, binarySearchTrace(a, k).iterations);
    return worst;
  }
  // Same quantity from the recurrence W(0)=0, W(g)=1+W(floor(g/2)) (the larger half has floor(g/2) items).
  function binaryWorstRecurrence(n) { let w = 0; for (let g = n; g > 0; g = Math.floor(g / 2)) w++; return w; }

  /* ---------------------------------------------------------------- Comparing running times (slide 28)
     Exact values as BigInt numerators over 100 (C = n^2/100 isn't always an integer). */
  const ALGS = {
    A: { label: "A", tex: "10n + 900", hundredths: (n) => (10n * n + 900n) * 100n },
    B: { label: "B", tex: "100n - 50", hundredths: (n) => (100n * n - 50n) * 100n },
    C: { label: "C", tex: "n^2/100", hundredths: (n) => n * n },
  };
  function algValue(name, n) { return ALGS[name].hundredths(BigInt(n)); }
  function fmtHundredths(h) {
    const neg = h < 0n; if (neg) h = -h;
    const whole = h / 100n, frac = h % 100n;
    const w = whole.toLocaleString("en-US");
    return (neg ? "−" : "") + (frac === 0n ? w : `${w}.${String(frac).padStart(2, "0").replace(/0$/, "")}`);
  }
  // smallest integer n >= 1 with pred(n) true, scanning exactly (the crossovers here are below 20,000)
  function firstN(pred, limit = 100000) {
    for (let n = 1n; n <= BigInt(limit); n++) if (pred(n)) return Number(n);
    return null;
  }

  return {
    SLIDE_QUEUE, SLIDE_LENGTH, circularQueue, linkedQueue, runAdt,
    MYFUNCTION_LINES, myFunctionSteps, myFunctionCount, beAnnoyingCounts,
    arrayListAdds, SLIDE_SORTED, linearSearch, binarySearchTrace, binaryWorstExhaustive, binaryWorstRecurrence,
    ALGS, algValue, fmtHundredths, firstN,
  };
});
