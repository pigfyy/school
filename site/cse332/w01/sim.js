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

  /* Line-by-line walks through the slide code, for the steppers on the linked and circular pages.
     Each step is the state right after one line runs, plus what that line did and why. */
  const LINKED_CODE = {
    enqueue: ["enqueue(x){", "    last = new ListNode(x);", "    back.next = last;", "    back = last;", "}"],
    dequeue: ["dequeue(){", "    first = front.value;", "    front = front.next;", "    if (front == null) {back = null;}", "    return first", "}"],
  };
  // nodes: [{v, gone, loose}]; front/back: index into nodes or null.
  function linkedSteps(op, initial, x) {
    const nodes = initial.map((v) => ({ v }));
    let front = nodes.length ? 0 : null, back = nodes.length ? nodes.length - 1 : null;
    const vars = {};
    const steps = [];
    const snap = (line, say, extra = {}) => steps.push({ line, say, nodes: nodes.map((n) => ({ ...n })), front, back, vars: { ...vars }, ...extra });
    snap(null, `Before: the queue holds ${initial.length ? initial.join(", ") : "nothing"}. front points at the oldest item, back at the newest.`);
    if (op === "enqueue") {
      nodes.push({ v: x, loose: true }); vars.last = x;
      snap(1, `Make a new node holding ${x}. Only the local variable last refers to it. No node in the chain points to it, so it isn't in the queue yet.`);
      if (back === null) {
        snap(2, "back is null because the queue is empty, so back.next throws a NullPointerException. The lecture's code assumes the queue isn't empty. Handling this case is part of Exercise 0.", { crash: true });
        return steps;
      }
      const old = nodes[back].v;
      nodes[nodes.length - 1].loose = false;
      snap(2, `The old back node (${old}) now points to the new node, so ${x} is in the chain. back still names ${old}. That's why this line comes first: back is the only way to reach the old last node.`);
      back = nodes.length - 1;
      snap(3, `Move back to the new node. ${x} is now the newest item. That was three steps, however long the queue is.`, { done: true });
    } else {
      if (front === null) { snap(1, "front is null because the queue is empty, so front.value throws. dequeue assumes the queue isn't empty.", { crash: true }); return steps; }
      vars.first = nodes[front].v;
      snap(1, `Save the oldest value, ${vars.first}, before front moves off it.`);
      const leaving = front;
      front = leaving + 1 < nodes.length ? leaving + 1 : null;
      nodes[leaving].gone = true;
      snap(2, front === null
        ? `front moves to the next node, but there isn't one: front is null. The node holding ${vars.first} is no longer reachable from the queue.`
        : `front moves to the next node (${nodes[front].v}). Nothing in the queue points to the ${vars.first} node anymore, so it's gone (Java's garbage collector reclaims it).`);
      if (front === null) { back = null; snap(3, `The queue is now empty. back was still pointing at the removed ${vars.first} node, so set it to null too. Now front and back agree: empty.`); }
      else snap(3, `front isn't null, so the queue still has items and back is still right (${nodes[back].v}). Skip.`);
      snap(4, `Return ${vars.first}, the oldest item. First in, first out.`, { done: true });
    }
    return steps;
  }

  const CIRCULAR_CODE = {
    enqueue: ["enqueue(x){", "    queue[back] = x;", "    back = (back + 1) % queue.length;", "    size++;", "}"],
    dequeue: ["dequeue(){", "    // Assumes queue is not empty", "    first = queue[front];", "    front = (front + 1) % queue.length;", "    size--;", "    return first;", "}"],
  };
  // Start from a real queue state (run ops from the slide), then step one operation.
  function circularSteps(op, start, x) {
    const q = start;
    const cells = q.queue, length = q.length;
    let front = q.front, back = q.back, size = q.size;
    const vars = {};
    const steps = [];
    const snap = (line, say, extra = {}) => steps.push({ line, say, cells: cells.slice(), front, back, size, length, vars: { ...vars }, ...extra });
    snap(null, `Before: front = ${front}, back = ${back}, size = ${size}. The queue is the ${size} slots starting at front.`);
    if (op === "enqueue") {
      const at = back;
      cells[at] = x;
      snap(1, `Write ${x} into slot ${at}. back is the first open slot, so this is where the new item goes.`, { flash: at });
      back = (back + 1) % length;
      snap(2, `Move back one slot: (${at} + 1) % ${length} = ${back}.${back === 0 ? " That's the wrap: past the last index, % sends it back to 0." : ""}`);
      size++;
      snap(3, `Count it: size = ${size}. Now ${x} is part of the queue.`, { done: true });
    } else {
      const at = front;
      vars.first = cells[at];
      snap(2, `Save the oldest value, queue[${at}] = ${vars.first}.`, { flash: at });
      front = (front + 1) % length;
      snap(3, `Move front one slot: (${at} + 1) % ${length} = ${front}.${front === 0 ? " It wraps back to 0." : ""} ${vars.first} is still sitting in slot ${at}, but it's no longer in the queue. Nothing erases it; the next enqueue that lands there overwrites it.`);
      size--;
      snap(4, `size = ${size}.`);
      snap(5, `Return ${vars.first}. Nothing moved in the array: only front changed.`, { done: true });
    }
    return steps;
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
    SLIDE_QUEUE, SLIDE_LENGTH, circularQueue, linkedQueue, runAdt, LINKED_CODE, linkedSteps, CIRCULAR_CODE, circularSteps,
    MYFUNCTION_LINES, myFunctionSteps, myFunctionCount, beAnnoyingCounts,
    arrayListAdds, SLIDE_SORTED, linearSearch, binarySearchTrace, binaryWorstExhaustive, binaryWorstRecurrence,
    ALGS, algValue, fmtHundredths, firstN,
  };
});
