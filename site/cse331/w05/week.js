/* CSE 331 week 5: this week's widgets. The shared engine (core/app.js) runs the checks, quizzes, problems, saving
   and navigation; this file only wires the interactive pieces:
     .eloop     Lecture 12's two requests (eventloop-sim.js): choose when the server handles each and when each
                response arrives, and watch the event loop's boxes, the book and the page
     .stepper   Lecture 13's Trace programs (trace-sim.js): one line per step, the call stack with its handler
                tabs, the exception in flight, and the output so far */
"use strict";
window.WEEK = window.WEEK || {};
window.WEEK.widgets = function ({ $, $$, el }) {
  const btn = (t, f) => { const b = el("button", { class: "btn", type: "button", text: t }); b.addEventListener("click", f); return b; };

  /* =========================================================== Lecture 12: the event loop */
  const E = window.EventLoopSim;
  const LABEL = { load: "page loads: load runs to its await", click: "Post is clicked: post runs to its await", serveGet: "server handles the GET", servePost: "server handles the POST", arriveGet: "load's response arrives", arrivePost: "post's response arrives" };
  $$(".eloop").forEach((box) => {
    let m, seq;
    const buttons = Object.fromEntries(E.ACTIONS.map((a) => [a, btn(LABEL[a], () => { m.do(a); seq.push(a); draw(); })]));
    const boxes = el("ol", { class: "el-boxes" }), book = el("p", { class: "el-book" }), page = el("ul", { class: "el-page" }), log = el("ol", { class: "el-log" }), verdict = el("p", { class: "verdict", role: "status" });
    const presets = [
      ["the notes' figure", ["load", "click", "serveGet", "servePost", "arriveGet", "arrivePost"]],
      ["exercise 2: load's response is slow", ["load", "click", "serveGet", "servePost", "arrivePost", "arriveGet"]],
      ["a fast server", ["load", "serveGet", "arriveGet", "click", "servePost", "arrivePost"]],
    ];
    function reset() { m = E.create(); seq = []; draw(); }
    function draw() {
      const s = m.state();
      Object.entries(buttons).forEach(([a, b]) => { b.disabled = !m.can(a); });
      boxes.replaceChildren(...s.boxes.map((b) => el("li", { text: b })));
      book.textContent = `the server's book: ${JSON.stringify(s.book)}`;
      page.replaceChildren(...(s.page.length ? s.page.map((x) => el("li", { text: x })) : [el("li", { class: "muted", text: "(the list is empty)" })]));
      log.replaceChildren(...s.log.map((x) => el("li", { text: x })));
      verdict.className = "verdict";
      verdict.replaceChildren();
      if (s.done) {
        const has = s.page.includes("bob: hi");
        verdict.className = `verdict ${has ? "yes" : "no"}`;
        verdict.append(el("b", { text: has ? "The page shows the new message. " : "The page has lost the new message, " }), has ? "One order of these events; others may end differently." : "though the server's book has it, until something calls load again. Nothing in load or post is wrong on its own: this is one order of the same events.");
      }
    }
    box.append(
      el("div", { class: "controls el-actions" }, ...E.ACTIONS.map((a) => buttons[a])),
      el("div", { class: "controls presets" }, el("span", { class: "muted", text: "Orders:" }), ...presets.map(([t, s]) => btn(t, () => { reset(); s.forEach((a) => { m.do(a); seq.push(a); }); draw(); })), btn("start over", reset)),
      el("div", { class: "el-grid" },
        el("div", {}, el("p", { class: "col-label", text: "the event loop's boxes, in order (one runs at a time)" }), boxes),
        el("div", {}, el("p", { class: "col-label", text: "the page's list" }), page, book),
        el("div", {}, el("p", { class: "col-label", text: "what happened" }), log)),
      verdict);
    reset();
  });

  /* =========================================================== Lecture 13: the call-stack stepper */
  const T = window.TraceSim;
  $$(".stepper").forEach((box) => {
    const name = box.dataset.program;
    const src = $(`#src-${name}`).textContent.replace(/^\n/, "").replace(/\s+$/, "").split("\n");
    const run = T.run(name);
    let k = -1;
    const code = el("pre", { class: "code st-code", tabindex: "0" });
    const rows = src.map((line, i) => { const r = el("span", { class: "ln" }, el("span", { class: "no", text: String(i + 1) }), el("span", { class: "src", text: line || " " })); r.dataset.line = String(i + 1); return r; });
    const first = T.PROGRAMS[name].start;
    code.append(el("code", {}, ...rows.slice(first - 1)));
    const stack = el("div", { class: "st-stack", "aria-live": "polite" }), flight = el("p", { class: "st-flight" }), out = el("pre", { class: "st-out" }), count = el("span", { class: "count" });
    const back = btn("Back", () => { if (k > -1) { k--; draw(); } }), step = btn("Step", () => { if (k < run.steps.length - 1) { k++; draw(); } }), end = btn("Run to the end", () => { k = run.steps.length - 1; draw(); }), reset = btn("Reset", () => { k = -1; draw(); });
    step.classList.add("primary");
    function draw() {
      const s = run.steps[k];
      rows.forEach((r) => r.classList.toggle("hl", !!s && Number(r.dataset.line) === s.line));
      stack.replaceChildren(...(!s ? [el("p", { class: "muted", text: "Press Step to start." })] : s.stack.length ? s.stack.map((f, i) => { const [label, tab] = f.split(/ (?=catch |finally)/); return el("div", { class: `st-frame${i === 0 ? " top" : ""}` }, el("span", { text: label }), tab ? el("span", { class: "st-tab", text: tab }) : ""); }) : [el("p", { class: "muted", text: "empty: no frame left" })]));
      flight.textContent = s && s.inflight ? `in flight: ${s.inflight}` : "";
      flight.hidden = !(s && s.inflight);
      let text = s ? s.out : "";
      if (s && k === run.steps.length - 1 && run.stderr) text += run.stderr.replace(/\t/g, "    ");
      if (s && k === run.steps.length - 1) text += `\n(exit status ${run.status})`;
      out.textContent = `$ java ${name}\n${text}`;
      count.textContent = `step ${k + 1} of ${run.steps.length}`;
      back.disabled = k < 0; step.disabled = k >= run.steps.length - 1;
      const hl = rows.find((r) => r.classList.contains("hl"));
      if (hl) code.scrollTop = hl.offsetTop - code.clientHeight / 3;
    }
    box.append(el("div", { class: "controls" }, back, step, end, reset, count),
      el("div", { class: "st-grid" }, code, el("div", {}, el("p", { class: "col-label", text: "the call stack (newest on top)" }), stack, flight), el("div", {}, el("p", { class: "col-label", text: "the terminal" }), out)));
    draw();
  });
};
