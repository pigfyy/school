/* CSE 331 week 3: this week's widgets. The shared engine (core/app.js) runs the checks, quizzes, problems,
   saving and navigation; this file only wires the interactive pieces:
     .calc            a terminal running Lecture 6's Calculator (calc-sim.js), optionally one of the notes' copies
     pre.code[data-src] + .map-bar   a numbered listing with buttons that highlight lines
     #triples         Lecture 7's one-line triples, checked on every state in a small range
     #quad            Lecture 7's quadrant on every point of a small grid
     .tracer          Lecture 8's loops, one row per condition check, with the invariant checked at each */
"use strict";
window.WEEK = window.WEEK || {};
window.WEEK.widgets = function ({ $, $$, el }) {
  const C = window.CalcSim;

  /* =========================================================== code listings */
  const KW = new Set("import public class static void new while for int long return if else throw throws boolean try catch private null true false extends super continue break".split(" "));
  function highlight(line) {
    const frag = document.createDocumentFragment();
    if (/^\s*(\/\*\*|\*|\*\/)/.test(line)) { frag.append(el("span", { class: "tk-com", text: line })); return frag; }
    const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'[^']*')|(\b[A-Za-z_]\w*\b)|(\b\d+\b)/g;
    let last = 0, m;
    while ((m = re.exec(line))) {
      if (m.index > last) frag.append(line.slice(last, m.index));
      if (m[1]) frag.append(el("span", { class: "tk-com", text: m[1] }));
      else if (m[2]) frag.append(el("span", { class: "tk-str", text: m[2] }));
      else if (m[3]) frag.append(KW.has(m[3]) ? el("span", { class: "tk-kw", text: m[3] }) : /^[A-Z]/.test(m[3]) ? el("span", { class: "tk-type", text: m[3] }) : m[3]);
      else frag.append(el("span", { class: "tk-num", text: m[4] }));
      last = re.lastIndex;
    }
    if (last < line.length) frag.append(line.slice(last));
    return frag;
  }
  const SOURCES = {};
  $$("script[type='text/plain'][id^='src-']").forEach((s) => { SOURCES[s.id.slice(4)] = s.textContent.replace(/^\n/, "").replace(/\n$/, "").split("\n"); });
  $$("pre.code[data-src]").forEach((pre) => {
    const src = SOURCES[pre.dataset.src];
    const from = Number(pre.dataset.from || 1), to = Number(pre.dataset.to || src.length);
    const code = el("code");
    for (let n = from; n <= Math.min(to, src.length); n++) {
      const row = el("span", { class: "ln" });
      row.dataset.line = String(n);
      row.append(el("span", { class: "no", text: String(n) }), el("span", { class: "src" }, highlight(src[n - 1] || " ")));
      code.append(row);
    }
    pre.replaceChildren(code);
    pre.tabIndex = 0;
  });
  // .map-bar button[data-range="a-b,c-d"][data-target="pre id"][data-note]: highlight those lines, scroll them in
  $$(".map-bar").forEach((bar) => {
    const note = bar.parentElement.querySelector(".map-note");
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-range]");
      if (!b) return;
      $$("button[data-range]", bar).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const targets = (b.dataset.target || "").split(" ").filter(Boolean);
      const ranges = b.dataset.range.split(",").map((r) => r.split("-").map(Number));
      const on = (n) => ranges.some(([a, z]) => n >= a && n <= (z || a));
      targets.forEach((tid) => {
        const pre = document.getElementById(tid);
        if (!pre) return;
        let first = null;
        $$(".ln", pre).forEach((ln) => { const hit = on(Number(ln.dataset.line)); ln.classList.toggle("hl", hit); if (hit && !first) first = ln; });
        if (first) pre.scrollTop = first.offsetTop - pre.clientHeight / 3;
      });
      if (note) note.innerHTML = b.dataset.note || "";
    });
  });

  /* =========================================================== the calculator terminal */
  $$(".calc").forEach((box) => {
    let variant = box.dataset.variant || "original";
    let typed = [];
    let ended = false;
    const title = el("span", { class: "term-title" });
    const body = el("pre", { class: "term-body", "aria-live": "polite" });
    const stackBar = el("div", { class: "calc-stack" });
    const input = el("input", { type: "text", "aria-label": "Type a line for the calculator", autocomplete: "off", spellcheck: "false", class: "no-keys" });
    const enterBtn = el("button", { type: "button", text: "Enter" });
    const eofBtn = el("button", { type: "button", text: "end input (Ctrl-D)" });
    const resetBtn = el("button", { type: "button", text: "restart" });
    const term = el("div", { class: "term" },
      el("div", { class: "term-head" }, el("span", { class: "dots" }, el("i"), el("i"), el("i")), title),
      body, stackBar,
      el("div", { class: "term-input" }, el("span", { class: "pr", text: ">" }), input, enterBtn, eofBtn, resetBtn));
    const controls = el("div", { class: "calc-controls" });
    const note = box.hasAttribute("data-select") ? el("p", { class: "calc-note", role: "status" }) : null;
    if (box.hasAttribute("data-select")) {
      const sel = el("select", { "aria-label": "Which copy of the calculator" });
      for (const [k, v] of Object.entries(C.VARIANTS)) sel.append(el("option", { value: k, text: v.label }));
      sel.value = variant;
      sel.addEventListener("change", () => { variant = sel.value; reset(); });
      controls.append(el("label", { class: "grow" }, "Copy: ", sel));
    }
    const presets = JSON.parse(box.dataset.presets || "[]");
    presets.forEach(([label, text]) => {
      const b = el("button", { class: "chip", type: "button", text: label });
      b.addEventListener("click", () => { typed = []; ended = false; for (const line of text.split("\n")) { if (ended) break; typed.push(line); draw(); } input.focus(); });
      controls.append(b);
    });
    box.replaceChildren(...(controls.childNodes.length ? [controls] : []), ...(note ? [note] : []), term);

    const NOTES = {
      flag: "main ignores add's answer. Try 1 + then p.",
      precondition: "main calls multiply without checking size(). Try 1 *.",
      "special-integer": "main prints pop's answer without checking for null. Try . on an empty stack.",
      "special-int": "main stores pop's answer in an int. Try . on an empty stack.",
      exception: "Nothing catches divide's exceptions. Try 1 / or 5 0 /.",
      wrapper: "main asks getAsInt without asking isEmpty. Try t on an empty stack.",
      "wrapper-int": "Stored in an int, top's OptionalInt does not compile: the compiler catches this one before any run.",
      checked: "subtract's checked exception is neither caught nor declared: the compiler refuses the program.",
      "checked-declared": "main passes StackException on, as its throws clause says, and nothing catches it. Try 1 -.",
      original: "All six checks in place. Every mistake gets a message and the run goes on.",
    };
    function draw() {
      const r = C.run(variant, typed.join("\n") + (ended ? "" : "\n"));
      body.replaceChildren();
      const line = (cls, ...kids) => body.append(el("span", { class: `tl ${cls}` }, ...kids));
      title.textContent = r.compileError ? "javac Calculator.java" : "java Calculator";
      if (note) note.textContent = NOTES[variant] || "";
      if (r.compileError) {
        line("cmd", el("span", { class: "ps1", text: "$ " }), "javac Calculator.java");
        r.compileError.split("\n").forEach((l) => line("err", l));
        line("cmd", el("span", { class: "ps1", text: "$ " }));
        stackBar.hidden = true;
        input.disabled = enterBtn.disabled = eofBtn.disabled = true;
        return;
      }
      stackBar.hidden = false;
      line("cmd", el("span", { class: "ps1", text: "$ " }), "java Calculator");
      const items = r.transcript;
      let waiting = false;
      items.forEach((it, k) => {
        if (it.prompt !== undefined) {
          const next = items[k + 1];
          if (next && next.typed !== undefined) line("", el("span", { class: "pr", text: "> " }), el("span", { class: "typed", text: next.typed }));
          else if (k === items.length - 1 && !ended) waiting = true;
          else line("", el("span", { class: "pr", text: "> " }));
        } else if (it.out !== undefined) line("out", it.out);
        else if (it.err !== undefined) it.err.split("\n").forEach((l) => line("err", l.replace(/^\t/, "    ")));
      });
      if (!waiting) {
        ended = true;
        line("note", `the program has ended · exit status ${r.status}`);
        line("cmd", el("span", { class: "ps1", text: "$ " }));
      }
      input.disabled = enterBtn.disabled = eofBtn.disabled = !waiting;
      const nums = r.stack.slice(1, -1).split(" ").filter(Boolean);
      stackBar.replaceChildren(el("span", { text: "the stack, bottom to top (the user sees it only with p):" }),
        nums.length ? el("span", { class: "cells-row" }, ...nums.map((n) => el("span", { class: "cell-n", text: n }))) : el("span", { text: "empty" }));
      body.scrollTop = body.scrollHeight;
    }
    function reset() { typed = []; ended = false; input.value = ""; draw(); }
    function enter() { if (input.disabled) return; typed.push(input.value); input.value = ""; draw(); input.focus(); }
    enterBtn.addEventListener("click", enter);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") enter(); if (e.key === "d" && e.ctrlKey) { e.preventDefault(); eofBtn.click(); } });
    eofBtn.addEventListener("click", () => { ended = true; draw(); });
    resetBtn.addEventListener("click", reset);
    const first = presets.find((p) => p[2] === "start");
    if (first) { for (const l of first[1].split("\n")) typed.push(l); }
    draw();
  });

  /* =========================================================== Lecture 7: one-line triples on small states */
  const TRIPLES = [
    { p: "true", code: "x = 5;", q: "x = 5", P: () => true, run: (x) => 5, Q: (x2) => x2 === 5, show: "x" },
    { p: "x = 3", code: "y = x + 1;", q: "y = 4", P: (x) => x === 3, run: (x) => x + 1, Q: (y) => y === 4, show: "y" },
    { p: "x = 3", code: "y = x + 1;", q: "0 < y", P: (x) => x === 3, run: (x) => x + 1, Q: (y) => 0 < y, show: "y" },
    { p: "true", code: "y = x + 1;", q: "y = 4", P: () => true, run: (x) => x + 1, Q: (y) => y === 4, show: "y" },
    { p: "0 < x", code: "x = x - 1;", q: "0 < x", P: (x) => 0 < x, run: (x) => x - 1, Q: (x2) => 0 < x2, show: "x" },
    { p: "false", code: "x = 0;", q: "x = 1", P: () => false, run: () => 0, Q: (x2) => x2 === 1, show: "x" },
    { p: "1 <= n and n <= 100", code: "n = n + 3;", q: "10 <= n * n", P: (x) => 1 <= x && x <= 100, run: (x) => x + 3, Q: (n) => 10 <= n * n, show: "n", v: "n" },
    { p: "true", code: "x = x + 1;", q: "x = 4", P: () => true, run: (x) => x + 1, Q: (x2) => x2 === 4, show: "x" },
    { p: "x = 3", code: "x = x + 1;", q: "x = 4", P: (x) => x === 3, run: (x) => x + 1, Q: (x2) => x2 === 4, show: "x" },
  ];
  const tx = $("#triples");
  if (tx) {
    const pick = el("div", { class: "tx-pick", role: "group", "aria-label": "Pick a triple" });
    const shown = el("p", { class: "tx-triple" });
    const rows = el("div", { class: "tx-rows" });
    const verdict = el("p", { class: "verdict", role: "status" });
    TRIPLES.forEach((t, i) => {
      const b = el("button", { class: "chip", type: "button", text: `{{ ${t.p} }} ${t.code} {{ ${t.q} }}` });
      b.addEventListener("click", () => draw(i));
      pick.append(b);
    });
    tx.append(pick, shown, rows, verdict);
    function draw(i) {
      $$("button", pick).forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));
      const t = TRIPLES[i], v = t.v || "x";
      shown.replaceChildren(el("span", { class: "p", text: `{{ ${t.p} }}` }), ` ${t.code} `, el("span", { class: "q", text: `{{ ${t.q} }}` }));
      const xs = Array.from({ length: 12 }, (_, k) => k - 3);
      const before = el("div", { class: "tx-states" }), after = el("div", { class: "tx-states" });
      let bad = null, inP = 0;
      for (const x of xs) {
        const p = t.P(x), y = t.run(x), q = t.Q(y);
        if (p) inP++;
        const cls = !p ? "skip" : q ? "good" : "bad";
        if (p && !q && bad === null) bad = [x, y];
        before.append(el("span", { class: `tx-s ${p ? "inP" : "skip"}`, text: String(x), title: p ? "P is true here" : "P is false here: the triple asks nothing" }));
        after.append(el("span", { class: `tx-s ${cls}`, text: String(y), title: !p ? "not a run the triple is about" : q ? "Q is true after the line" : "Q is false after the line: a counterexample" }));
      }
      rows.replaceChildren(el("b", { text: `${v} before` }), before, el("b", { text: `${t.show} after` }), after);
      const valid = TRIPLES[i].valid !== undefined ? TRIPLES[i].valid : bad === null;
      verdict.className = `verdict ${bad ? "no" : "yes"}`;
      verdict.replaceChildren();
      if (bad) verdict.append(el("b", { text: "Not valid. " }), `From ${v} = ${bad[0]}, P is true, and after the line ${t.show} = ${bad[1]}, where Q is false. That run is a counterexample.`);
      else if (!inP) verdict.append(el("b", { text: "Valid. " }), "No state makes P true, so the triple asks nothing of Q.");
      else verdict.append(el("b", { text: "Valid " }), `on every state shown: each run that starts with P true ends with Q true.${valid && t.v ? " (Shown for n from −3 to 8; the argument covers 1 to 100.)" : ""}`);
    }
    draw(0);
  }

  /* =========================================================== Lecture 7: quadrant on a grid */
  const quad = $("#quad");
  if (quad) {
    const code = (x, y) => { let q = 1; if (x < 0) q = 2; if (y < 0) q = q + 1; return q; };
    const spec = (x, y) => (x > 0 && y > 0 ? 1 : x < 0 && y > 0 ? 2 : x < 0 && y < 0 ? 3 : 4);
    const grid = el("div", { class: "quad", role: "img", "aria-label": "quadrant(x, y) for x and y from -4 to 4" });
    for (let y = 4; y >= -4; y--) for (let x = -4; x <= 4; x++) {
      if (x === 0 || y === 0) { grid.append(el("span", { class: "axis", text: x === 0 && y === 0 ? "0" : x === 0 ? String(y) : String(x) })); continue; }
      const got = code(x, y), want = spec(x, y);
      const tested = (x === 1 && y === 1) || (x === -1 && y === -1);
      grid.append(el("span", { class: `${got === want ? "ok" : "no"}${tested ? " tested" : ""}`, title: `quadrant(${x}, ${y}) returns ${got}; the spec promises ${want}`, text: String(got) }));
    }
    quad.append(el("div", { class: "quad-wrap" }, grid, el("div", {},
      el("p", {}, "Each square is a call ", el("code", { text: "quadrant(x, y)" }), ", showing what the lecture's code returns. Green: what the specification promises. Red: not. The two outlined squares are the two passing tests."),
      el("p", {}, "The tests ran two of the four paths. The forward argument checked all four, each on every input that takes it, and its fourth case is exactly the red quadrant."))));
  }

  /* =========================================================== Lecture 8: loop tracer */
  const sumTerms = (a, i) => a.slice(0, i).reduce((s, v) => s + v, 0);
  const tri = (i) => (i * (i + 1)) / 2;
  const LOOPS = {
    sum: { label: "sum (the lecture's)", kind: "array", lines: ["long s = 0;", "int i = 0;", "while (i < a.length) {", "    s = s + a[i];", "    i = i + 1;", "}", "return s;"],
      init: () => ({ s: 0, i: 0 }), cond: (st, a) => st.i < a.length, body: (st, a) => { st.s += a[st.i]; st.i += 1; } },
    start: { label: "wrong start: int i = 1;", kind: "array", lines: ["long s = 0;", "int i = 1;", "while (i < a.length) {", "    s = s + a[i];", "    i = i + 1;", "}", "return s;"],
      init: () => ({ s: 0, i: 1 }), cond: (st, a) => st.i < a.length, body: (st, a) => { st.s += a[st.i]; st.i += 1; } },
    swapped: { label: "swapped body", kind: "array", lines: ["long s = 0;", "int i = 0;", "while (i < a.length) {", "    i = i + 1;", "    s = s + a[i];", "}", "return s;"],
      init: () => ({ s: 0, i: 0 }), cond: (st, a) => st.i < a.length, body: (st, a) => { st.i += 1; if (st.i >= a.length) throw new Error(`ArrayIndexOutOfBoundsException: Index ${st.i} out of bounds for length ${a.length}`); st.s += a[st.i]; } },
    exit: { label: "wrong exit: i < a.length - 1", kind: "array", lines: ["long s = 0;", "int i = 0;", "while (i < a.length - 1) {", "    s = s + a[i];", "    i = i + 1;", "}", "return s;"],
      init: () => ({ s: 0, i: 0 }), cond: (st, a) => st.i < a.length - 1, body: (st, a) => { st.s += a[st.i]; st.i += 1; } },
    sumTo: { label: "sumTo(n) (the lecture's)", kind: "n", lines: ["long s = 0;", "int i = 0;", "while (i < n) {", "    i = i + 1;", "    s = s + i;", "}", "return s;"],
      init: () => ({ s: 0, i: 0 }), cond: (st, n) => st.i < n, body: (st) => { st.i += 1; st.s += st.i; } },
    sumToSwapped: { label: "sumTo(n), body lines swapped (exercise 5)", kind: "n", lines: ["long s = 0;", "int i = 0;", "while (i < n) {", "    s = s + i;", "    i = i + 1;", "}", "return s;"],
      init: () => ({ s: 0, i: 0 }), cond: (st, n) => st.i < n, body: (st) => { st.s += st.i; st.i += 1; } },
  };
  const INV = {
    array: { text: "0 <= i and i <= a.length and s = a[0] + ... + a[i - 1]", bounds: (st, a) => 0 <= st.i && st.i <= a.length, main: (st, a) => st.s === sumTerms(a, st.i), post: (r, a) => r === sumTerms(a, a.length), postText: "a[0] + ... + a[a.length - 1]", want: (a) => sumTerms(a, a.length) },
    n: { text: "0 <= i and i <= n and s = 1 + ... + i", bounds: (st, n) => 0 <= st.i && st.i <= n, main: (st) => st.s === tri(st.i), post: (r, n) => r === tri(n), postText: "1 + ... + n", want: (n) => tri(n) },
  };
  $$(".tracer").forEach((box) => {
    const keys = (box.dataset.loops || "sum").split(" ");
    const sel = el("select", { "aria-label": "Which loop" });
    keys.forEach((k) => sel.append(el("option", { value: k, text: LOOPS[k].label })));
    const arr = el("input", { type: "text", value: box.dataset.array || "3, 4, 5", "aria-label": "The array a", spellcheck: "false", class: "no-keys" });
    const nIn = el("input", { type: "text", value: box.dataset.n || "4", "aria-label": "n", class: "no-keys short" });
    const arrLabel = el("label", {}, "a = { ", arr, " }"), nLabel = el("label", {}, "n = ", nIn);
    const codeBox = el("pre", { class: "code tr-code" });
    const table = el("table", { class: "tr-table" });
    const verdict = el("p", { class: "verdict tr-verdict", role: "status" });
    box.append(el("div", { class: "tr-controls" }, sel, arrLabel, nLabel), codeBox, el("div", { class: "table-scroll" }, table), verdict);
    function draw() {
      const L = LOOPS[sel.value], I = INV[L.kind];
      arrLabel.hidden = L.kind !== "array"; nLabel.hidden = L.kind !== "n";
      codeBox.replaceChildren(el("code", {}, ...L.lines.flatMap((l, k) => [k === 2 ? el("span", { class: "tk-com", text: `{{ Inv: ${I.text} }}\n` }) : "", highlight(l), "\n"])));
      let input;
      if (L.kind === "array") {
        const parts = arr.value.split(",").map((x) => x.trim()).filter((x) => x !== "");
        if (parts.length > 10 || parts.some((x) => !/^-?\d{1,6}$/.test(x))) { verdict.className = "verdict warn"; verdict.textContent = "Use up to 10 whole numbers between −999999 and 999999, separated by commas (or nothing, for the empty array)."; table.replaceChildren(); return; }
        input = parts.map(Number);
      } else {
        if (!/^\d{1,2}$/.test(nIn.value.trim()) || Number(nIn.value) > 30) { verdict.className = "verdict warn"; verdict.textContent = "Use a whole number n from 0 to 30."; table.replaceChildren(); return; }
        input = Number(nIn.value);
      }
      const st = L.init();
      const head = el("tr", {}, ...["check", "i", "s", "condition", "bounds", "main fact", "invariant"].map((h) => el("th", { text: h })));
      table.replaceChildren(head);
      const yes = (b) => el("td", { class: b ? "yes" : "no", text: b ? "true" : "false" });
      let firstFalse = null, k = 0, thrown = null, wasTrue = false;
      for (;;) {
        k++;
        const c = L.cond(st, input), b = I.bounds(st, input), m = I.main(st, input), inv = b && m;
        if (!inv && firstFalse === null) firstFalse = { k, after: wasTrue };
        if (inv) wasTrue = true; else wasTrue = false;
        table.append(el("tr", {}, el("td", { text: String(k) }), el("td", { class: "mono", text: String(st.i) }), el("td", { class: "mono", text: String(st.s) }), el("td", { class: "mono", text: c ? "true" : "false" }), yes(b), yes(m), yes(inv)));
        if (!c || k > 40) break;
        try { L.body(st, input); } catch (e) { thrown = e.message; break; }
      }
      const r = st.s;
      if (thrown) table.append(el("tr", { class: "exit" }, el("td", { colspan: "7", text: `the pass throws ${thrown}` })));
      else table.append(el("tr", { class: "exit" }, el("td", { colspan: "7" }, `exit: returns ${r}; the postcondition promises ${I.postText} = ${I.want(input)}: `, el("b", { text: I.post(r, input) ? "met" : "not met" }))));
      verdict.className = "verdict";
      verdict.replaceChildren();
      const lastInv = table.lastElementChild.previousElementSibling;
      const invAtExit = !thrown && lastInv && lastInv.lastElementChild.textContent === "true";
      if (firstFalse && firstFalse.k === 1) verdict.append(el("b", { text: "Check (1) fails on this input: " }), "the claim before the loop is true and the invariant is false at the first condition check.");
      else if (firstFalse) verdict.append(el("b", { text: "Check (2) fails on this run: " }), `the invariant was true at check ${firstFalse.k - 1}, a pass ran, and it is false at check ${firstFalse.k}.`);
      else if (thrown) verdict.append(el("b", { text: "The run throws. " }), "No invariant row is false before it, but the pass that throws never reaches its end.");
      else if (invAtExit && !I.post(r, input)) verdict.append(el("b", { text: "Check (3) fails on this run: " }), "the invariant and the negated condition are true at the exit, and the postcondition is false.");
      else verdict.append(el("b", { text: "Every check holds on this run. " }), "One run is not a proof: the three checks are about every state.");
    }
    sel.addEventListener("change", draw);
    arr.addEventListener("input", draw);
    nIn.addEventListener("input", draw);
    if (box.dataset.start) sel.value = box.dataset.start;
    draw();
  });
};
