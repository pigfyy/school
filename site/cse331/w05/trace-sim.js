/* CSE 331 week 5: a step-by-step model of Lecture 13's four programs, Trace, TraceCatch, TraceFinally and
   TraceSwallow, one step per line run, with the call stack, the handler tabs and the exception in flight.
   Pure functions: window.TraceSim in the browser, require() in Node. checks/cse331/w05/verify.mjs compares every
   step with the notes' own step tables, and the output, trace and exit status with real Java runs.

   run(name) -> { steps: [{ stack: ["g(0) at 27", "f(0) at 21", "main at 15"], inflight, out, line, note }],
                  stdout, stderr, status, source } */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TraceSim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const EXC = "ArithmeticException: cannot divide by zero";
  // Statement models. print/call/if/throw/try/nop, each with its line in the listing.
  const P = (line, text) => ({ k: "print", line, text });
  const call = (line, m, arg) => ({ k: "call", line, m, arg });
  const gBody = (ifLine) => [
    { k: "if", line: ifLine, then: [{ k: "throw", line: ifLine + 1 }] },
    P(ifLine + 3, (n) => `    g: 12 / ${n} = ${Math.trunc(12 / n)}`),
  ];
  const fBody = (l) => [P(l, (n) => `  f: calling g(${n})`), call(l + 1, "g", (n) => n), P(l + 2, () => "  f: done")];
  const mainCalls = (l) => [P(l, () => "main: calling f(2)"), call(l + 1, "f", () => 2), P(l + 2, () => "main: calling f(0)"), call(l + 3, "f", () => 0)];
  const PROGRAMS = {
    Trace: { start: 10, main: [...mainCalls(12), P(16, () => "main: done")], f: fBody(20), g: gBody(26) },
    TraceCatch: {
      start: 5,
      main: [{ k: "try", line: 7, body: mainCalls(8), catch: { cls: "ArithmeticException", handler: [P(13, (n, e) => `main: caught: ${e.msg}`)] } }, P(15, () => "main: done")],
      f: fBody(19), g: gBody(25),
    },
    TraceFinally: {
      start: 5,
      main: [{ k: "try", line: 7, body: mainCalls(8), catch: { cls: "ArithmeticException", handler: [P(13, (n, e) => `main: caught: ${e.msg}`)] } }, P(15, () => "main: done")],
      f: [P(19, (n) => `  f: calling g(${n})`), { k: "try", line: 20, body: [call(21, "g", (n) => n)], finally: [P(23, () => "  f: finally")] }, P(25, () => "  f: done")],
      g: gBody(29),
    },
    TraceSwallow: {
      start: 5,
      main: [{ k: "try", line: 7, body: mainCalls(8), catch: { cls: "Exception", handler: [{ k: "nop", line: 13 }] } }, P(14, () => "main: done")],
      f: fBody(18), g: gBody(24),
    },
  };
  const isA = (cls, want) => want === "Exception" || want === "RuntimeException" || cls === want;

  class Thrown { constructor(cls, msg) { this.cls = cls; this.msg = msg; } }

  function run(name) {
    const prog = PROGRAMS[name];
    const frames = []; // bottom first
    const steps = [];
    let out = "", inflight = "";
    const label = (f) => `${f.name}${f.name === "main" ? "" : `(${f.n})`} at ${f.line}${f.tabs.length ? " " + f.tabs.join(" ") : ""}`;
    const snap = (note) => steps.push({ stack: frames.slice().reverse().map(label), inflight, out, line: frames.length ? frames[frames.length - 1].line : null, top: frames.length ? frames[frames.length - 1].name : null, note });
    function exec(stmts, f) {
      for (const s of stmts) {
        f.line = s.line;
        if (s.k === "print") { out += s.text(f.n, f.caught) + "\n"; snap("print"); }
        else if (s.k === "nop") snap("empty block");
        else if (s.k === "if") { snap("if"); if (f.n === 0) exec(s.then, f); }
        else if (s.k === "throw") { inflight = EXC; snap("throw"); throw new Thrown("ArithmeticException", "cannot divide by zero"); }
        else if (s.k === "call") {
          snap("call");
          try { invoke(s.m, s.arg(f.n)); }
          catch (e) { if (!(e instanceof Thrown)) throw e; f.line = s.line; snap("arrives"); throw e; }
        } else if (s.k === "try") {
          snap("try");
          const tab = s.catch ? `catch ${s.catch.cls}` : "finally";
          f.tabs.push(tab);
          let thrown = null;
          try { exec(s.body, f); }
          catch (e) { if (!(e instanceof Thrown)) throw e; thrown = e; }
          f.tabs.pop();
          if (thrown && s.catch && isA(thrown.cls, s.catch.cls)) { inflight = ""; f.caught = thrown; exec(s.catch.handler, f); thrown = null; }
          if (s.finally) exec(s.finally, f);
          if (thrown) throw thrown;
        }
      }
    }
    function invoke(m, n) {
      const f = { name: m, n, line: null, tabs: [] };
      frames.push(f);
      try { exec(prog[m], f); }
      finally { frames.pop(); }
    }
    let stderr = "", status = 0;
    try { invoke("main", null); snap("end"); }
    catch (e) {
      if (!(e instanceof Thrown)) throw e;
      snap("uncaught");
      const at = steps.filter((st) => st.note === "throw" || st.note === "arrives").map((st) => `\tat ${name}.${st.top}(${name}.java:${st.line})`);
      stderr = `Exception in thread "main" java.lang.${EXC}\n${at.join("\n")}\n`;
      status = 1;
    }
    return { steps, stdout: out, stderr, status };
  }
  return { PROGRAMS, run, NAMES: Object.keys(PROGRAMS) };
});
