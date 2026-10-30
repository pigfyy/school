/* CSE 332 w05: misconception feedback and this week's widgets.
   - .sortlab     step through insertion, selection, heap, merge, quick or radix sort on any array, and compare the
                  comparisons each sort makes on it
   - .hashlab     week 4's hash table (Section 5's hashing half): chaining or linear / quadratic probing */
"use strict";
window.WEEK = window.WEEK || {};
window.WEEK.messages = {
  "worst-for-best": "That's the worst case. On this input the algorithm can stop early.",
  "always-nlogn": "Not this one: its running time depends on the input's order.",
  "not-adaptive": "This algorithm does the same work whatever the input order, so it's not adaptive.",
  "counted-swaps": "That counts swaps. The question asks for comparisons between items.",
  "inversions": "Each swap fixes exactly one out-of-order pair. Count the pairs i < j with a[i] > a[j].",
  "max-not-min": "It's a max heap: the root is the largest, and every node is larger than its children.",
  "pivot-at-start": "The pivot ends where the pointers meet (or one to the left), not where it started.",
  "msd-first": "Radix sort goes from the least significant digit to the most: the 1's digit first.",
  "unstable-bucket": "Buckets keep their items in arrival order: that's what makes radix sort work.",
  "no-mod": "The index is the key % table size.",
  "first-free-not-probe": "Follow the probe sequence: h, h+1, h+2, … (wrapping around), not the first empty slot overall.",
  "linear-not-quadratic": "That's where linear probing would put it. Quadratic probing tries h+1², h+2², h+3², …",
  "tomb-is-empty": "A tombstone doesn't end a search. Keep probing until a truly empty slot.",
  "selection-adaptive": "Selection sort always scans the whole unsorted part to find the minimum, even if the input is sorted.",
  "quick-best": "With all keys equal, every key falls on one side of the pivot. That's quicksort's worst case.",
};

window.WEEK.widgets = function ({ $, $$, el }) {
  const Sim = window.Sim;
  const fmt = (x) => BigInt(x).toLocaleString("en-US");

  /* =========================================================== sort stepper */
  const NAMES = { insertion: "Insertion sort", selection: "Selection sort", heap: "Heap sort (in place)", merge: "Merge sort", quick: "Quicksort (first element as pivot)", radix: "Radix sort (base 10)" };
  $$(".sortlab").forEach((panel) => {
    const algSel = $(".sl-alg", panel), arrIn = $(".sl-arr", panel), cells = $(".sl-cells", panel), out = $(".sl-out", panel), count = $(".sl-count", panel), cmp = $(".sl-compare", panel);
    const presets = JSON.parse(panel.dataset.presets || "[]");
    const algs = (panel.dataset.algs || "insertion,selection,heap,merge,quick,radix").split(",");
    algSel.replaceChildren(...algs.map((k) => el("option", { value: k, text: NAMES[k] })));
    let frames = [], at = 0, res = null;
    const parse = () => { const xs = arrIn.value.split(/[\s,]+/).filter(Boolean).map(Number); return xs.length && xs.length <= 24 && xs.every((x) => Number.isInteger(x) && x >= 0 && x < 100000) ? xs : null; };
    function run() {
      const xs = parse();
      if (!xs) { out.textContent = "Type up to 24 whole numbers from 0 to 99999, separated by spaces or commas."; return; }
      res = Sim.SORTS[algSel.value](xs);
      frames = res.frames; at = 0; draw();
      if (cmp) {
        cmp.replaceChildren(el("tr", {}, el("th", { text: "Sort" }), el("th", { text: "comparisons on this input" })));
        for (const k of ["insertion", "selection", "heap", "merge", "quick"]) cmp.append(el("tr", { class: k === algSel.value ? "on" : null }, el("td", { text: NAMES[k] }), el("td", { text: fmt(Sim.SORTS[k](xs).comparisons) })));
      }
    }
    function draw() {
      const f = frames[at];
      cells.replaceChildren(...f.a.map((v, i) => el("div", { class: `sl-cell${f.hi.includes(i) ? " hi" : ""}${f.done.includes(i) ? " done" : ""}` }, el("b", { text: String(v) }), el("span", { text: String(i) }))));
      out.textContent = f.note;
      count.textContent = `Step ${at} of ${frames.length - 1}${res.comparisons !== undefined ? ` · ${fmt(res.comparisons)} comparisons in all` : ""}`;
      $(".sl-prev", panel).disabled = at === 0; $(".sl-next", panel).disabled = at === frames.length - 1;
    }
    $(".sl-next", panel).addEventListener("click", () => { if (at < frames.length - 1) { at++; draw(); } });
    $(".sl-prev", panel).addEventListener("click", () => { if (at > 0) { at--; draw(); } });
    $(".sl-end", panel).addEventListener("click", () => { at = frames.length - 1; draw(); });
    $(".sl-run", panel).addEventListener("click", run);
    algSel.addEventListener("change", run);
    arrIn.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    const chips = $(".sl-presets", panel);
    presets.forEach((p, i) => { const c = el("button", { class: "chip", type: "button", text: p.label }); c.addEventListener("click", () => { arrIn.value = p.arr.join(", "); if (p.alg) algSel.value = p.alg; run(); }); chips.append(c); if (i === 0) { arrIn.value = p.arr.join(", "); if (p.alg) algSel.value = p.alg; } });
    run();
  });

  /* =========================================================== hash table lab */
  $$(".hashlab").forEach((panel) => {
    const grid = $(".hl-grid", panel), out = $(".hl-out", panel), stat = $(".hl-stat", panel), keyIn = $(".hl-key", panel);
    const modeSel = $(".hl-mode", panel), sizeIn = $(".hl-size", panel);
    const presets = JSON.parse(panel.dataset.presets || "[]");
    const gOf = (size) => { const r = Number(panel.dataset.r || 0); return r ? (k) => r - Sim.mod(k, r) : undefined; };
    let t = null, queue = [];
    function fresh(size, mode) { t = Sim.table(size, mode, mode === "double" ? gOf(size) : undefined); }
    function draw(mark = {}, msg = "") {
      grid.replaceChildren();
      grid.style.setProperty("--cols", String(t.size));
      t.slots.forEach((v, i) => {
        const cell = el("div", { class: `hl-cell${mark.path && mark.path.includes(i) ? " path" : ""}${mark.at === i ? " at" : ""}` });
        if (t.mode === "chain") { const ch = el("div", { class: "hl-chain" }); v.forEach((k) => ch.append(el("b", { class: mark.key === k ? "hit" : null, text: String(k) }))); cell.append(ch); }
        else cell.append(el("b", { class: v === Sim.TOMB ? "tomb" : v === null ? "empty" : mark.key === v ? "hit" : null, text: v === null ? "" : v === Sim.TOMB ? "✝" : String(v) }));
        if (mark.path) { const n = mark.path.indexOf(i); if (n >= 0) cell.append(el("span", { class: "hl-step", text: String(n + 1) })); }
        cell.append(el("span", { class: "hl-idx", text: String(i) }));
        grid.append(cell);
      });
      const lam = `${t.n}/${t.size}`;
      stat.textContent = `${{ chain: "Separate chaining", linear: "Linear probing", quadratic: "Quadratic probing", double: `Double hashing, g(k) = ${panel.dataset.r} − (k mod ${panel.dataset.r})` }[t.mode]} · h(k) = k mod ${t.size} · n = ${t.n} · λ = ${lam} = ${(t.n / t.size).toFixed(2)}${queue.length ? ` · queue: ${queue.join(", ")}` : ""}`;
      out.textContent = msg;
    }
    const readKey = () => {
      const v = keyIn.value.trim();
      if (v === "" && queue.length) return queue.shift();
      if (!/^-?\d+$/.test(v)) { out.textContent = "Type a whole number as the key."; return null; }
      keyIn.value = ""; return Number(v);
    };
    const where = (p) => p.join(" → ");
    $(".hl-insert", panel).addEventListener("click", () => {
      const k = readKey(); if (k === null) return;
      const r = Sim.insert(t, k);
      if (t.mode === "chain") return draw({ path: r.probes, at: r.index, key: k }, r.dup ? `${k} is already in bucket ${r.index}; insert overwrites its value.` : `${k} % ${t.size} = ${r.index}: added to bucket ${r.index}${r.compares ? ` after checking ${r.compares} key${r.compares === 1 ? "" : "s"} for a duplicate` : ""}.`);
      if (!r.ok) return draw({ path: r.probes, key: k }, `${k} doesn't fit: probed ${r.probes.length} times (${where(r.probes)}) without finding an open slot. λ is ${t.n}/${t.size}; quadratic probing only guarantees a spot when λ < 1/2 and the size is prime.`);
      draw({ path: r.probes, at: r.index, key: k }, r.dup ? `${k} is already at index ${r.index}.` : `${k} % ${t.size} = ${r.probes[0]}. Probed ${where(r.probes)}; stored at index ${r.index}${r.probes.length > 1 ? ` (${r.probes.length - 1} collision${r.probes.length > 2 ? "s" : ""})` : ""}.`);
    });
    $(".hl-find", panel).addEventListener("click", () => {
      const k = readKey(); if (k === null) return;
      const r = Sim.find(t, k);
      if (t.mode === "chain") return draw({ path: r.probes, key: k }, `Bucket ${r.index}: ${r.found ? `found ${k} after ${r.compares} comparison${r.compares === 1 ? "" : "s"}` : `not found after ${r.compares} comparison${r.compares === 1 ? "" : "s"} (the whole bucket)`}.`);
      draw({ path: r.probes, at: r.found ? r.index : undefined, key: k }, r.found ? `Found ${k} at index ${r.index}, looking at ${where(r.probes)}.` : `Not found: looked at ${where(r.probes)} and stopped at an empty slot. Tombstones don't stop a find.`);
    });
    $(".hl-delete", panel).addEventListener("click", () => {
      const k = readKey(); if (k === null) return;
      const r = Sim.remove(t, k);
      if (!r.found) return draw({ path: r.probes }, `${k} isn't in the table.`);
      draw({ path: r.probes, at: r.index }, t.mode === "chain" ? `Removed ${k} from bucket ${r.index}.` : `Deleted ${k}: index ${r.index} now holds a tombstone (✝), so later finds keep probing past it.`);
    });
    $(".hl-rehash", panel).addEventListener("click", () => {
      const size = Sim.nextPrime(2 * t.size);
      const old = t.size;
      t = Sim.rehash(t, size, t.mode === "double" ? gOf(size) : undefined);
      sizeIn.value = String(size);
      draw({}, `Rehashed: a new table of size ${size} (the first prime ≥ 2·${old}), every key re-inserted with k mod ${size}. Tombstones are gone.`);
    });
    const reset = () => { fresh(Math.max(2, Math.min(31, parseInt(sizeIn.value, 10) || 10)), modeSel.value); queue = []; draw({}, "Empty table."); };
    $(".hl-reset", panel).addEventListener("click", reset);
    modeSel.addEventListener("change", reset); sizeIn.addEventListener("change", reset);
    keyIn.addEventListener("keydown", (e) => { if (e.key === "Enter") $(".hl-insert", panel).click(); });
    const chips = $(".hl-presets", panel);
    const load = (p) => { modeSel.value = p.mode; sizeIn.value = String(p.size); fresh(p.size, p.mode); for (const k of p.keys || []) Sim.insert(t, k); queue = [...(p.seq || [])]; draw({}, p.say || ""); };
    presets.forEach((p, i) => { const c = el("button", { class: "chip", type: "button", text: p.label }); c.addEventListener("click", () => load(p)); chips.append(c); if (i === 0) load(p); });
  });
};
