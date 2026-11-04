// Ground truth for CSE 331 week 5 (site/cse331/w05/).
//   1. Lecture 13's four programs (Trace, TraceCatch, TraceFinally, TraceSwallow, as the notes print them): compiled
//      and run; stdout, the exception and its frames, and the exit status must match site/cse331/w05/trace-sim.js.
//      Every step of the simulator must match the notes' own step tables (the stack column and the in-flight column).
//   2. Lecture 12's app.js, as the notes print it, run in Node against a fake page and a fetch whose answers are
//      released in every order eventloop-sim.js allows: the page must end as the model says.
//   3. Every computed answer key on the page: Section 4 by enumerating every small array each representation allows;
//      Lecture 12's JSON and Lecture 13's stacks by running the notes' Java.
// Usage: bun checks/cse331/w05/verify.mjs   (java 17+; uses javac, else `java -m jdk.compiler`)
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const TS = req("../../../site/cse331/w05/trace-sim.js");
const EL = req("../../../site/cse331/w05/eventloop-sim.js");
const G = req("../../../site/core/grader.js");
const html = readFileSync(join(here, "../../../site/cse331/w05/index.html"), "utf8");
const notes13 = readFileSync(join(here, "../../../materials/cse331/w05/lecture13/lecture13-notes.html"), "utf8");
const notes12 = readFileSync(join(here, "../../../materials/cse331/w05/lecture12/lecture12-notes.html"), "utf8");

let checks = 0, fails = 0;
const counts = {};
const ok = (group, cond, msg) => { checks++; counts[group] = (counts[group] || 0) + 1; if (!cond) { fails++; if (fails <= 40) console.log(`MISMATCH [${group}]:`, msg); } };

const work = mkdtempSync(join(tmpdir(), "cse331-w5-"));
const hasJavac = spawnSync("javac", ["-version"]).status === 0;
const javac = (dir, files) => spawnSync(...(hasJavac ? ["javac", ["-d", dir, ...files]] : ["java", ["-m", "jdk.compiler/com.sun.tools.javac.Main", "-d", dir, ...files]]), { encoding: "utf8", cwd: dir });
const J = (f) => join(here, "java", f);

/* ---------------------------------------------------------------- 1. the four Trace programs */
const traceKey = (s) => s.split("\n").filter((l) => l.startsWith("Exception in thread") || /at Trace\w*\./.test(l)).map((l) => l.trim()).join("\n");
const javaRuns = {};
{ const d = join(work, "trace"); mkdirSync(d);
  const c = javac(d, TS.NAMES.map((n) => J(`${n}.java`))); ok("compile", c.status === 0, c.stderr);
  for (const n of TS.NAMES) {
    const r = spawnSync("java", ["-cp", d, n], { encoding: "utf8" });
    javaRuns[n] = { stdout: r.stdout, stderr: r.stderr, status: r.status };
    const sim = TS.run(n);
    ok("trace", r.stdout === sim.stdout && r.status === sim.status && traceKey(r.stderr) === traceKey(sim.stderr), `${n}:\n  java ${JSON.stringify(javaRuns[n])}\n  sim  ${JSON.stringify({ stdout: sim.stdout, stderr: sim.stderr, status: sim.status })}`);
  } }
// the notes' step tables: the four <table>s after the four Trace listings, in order
{ const unhtml = (s) => s.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\u00a0/g, " ").trim();
  const tables = [...notes13.matchAll(/<table>\s*<thead>\s*<tr>\s*<th>step<\/th>[\s\S]*?<\/table>/g)].map((m) => [...m[0].matchAll(/<tr>\s*<td>(\d+)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/g)].map((r) => ({ stack: unhtml(r[2]), inflight: unhtml(r[3]) })));
  ok("steps", tables.length === 4, `found ${tables.length} step tables`);
  ["Trace", "TraceCatch", "TraceFinally", "TraceSwallow"].forEach((n, k) => {
    const sim = TS.run(n).steps.map((s) => ({ stack: s.stack.length ? s.stack.join("\n") : "empty", inflight: s.inflight }));
    const t = tables[k] || [];
    ok("steps", t.length === sim.length, `${n}: notes have ${t.length} steps, simulator ${sim.length}`);
    t.forEach((row, i) => ok("steps", sim[i] && row.stack.replace(/\s*\n\s*/g, "\n") === sim[i].stack && row.inflight === sim[i].inflight, `${n} step ${i + 1}: notes ${JSON.stringify(row)} sim ${JSON.stringify(sim[i])}`));
  }); }
console.log(`trace: ${TS.NAMES.length} programs run; ${counts.steps} step checks against the notes' tables`);

/* ---------------------------------------------------------------- 2. app.js in every order */
const appSrc = readFileSync(join(here, "js", "app.js"), "utf8");
ok("listing", /item\.textContent = message;/.test(appSrc.split("\n")[12]) && /async function load\(\)/.test(appSrc.split("\n")[18]) && /^load\(\);/.test(appSrc.split("\n")[39]), "app.js lines 13, 19 and 40 are the notes'");
function fakePage() {
  const node = (tag) => ({ tag, children: [], textContent: "", value: "", appendChild(c) { this.children.push(c); }, set innerHTML(v) { if (v !== "") throw new Error("only clearing"); this.children = []; } });
  const nodes = { messages: node("ul"), name: node("input"), message: node("input"), post: node("button") };
  nodes.name.value = "bob"; nodes.message.value = "hi";
  return { nodes, document: { getElementById: (id) => nodes[id], createElement: (t) => node(t) } };
}
const flush = () => new Promise((r) => setImmediate(r));
let ordersChecked = 0;
for (const order of EL.orders()) {
  const { nodes, document } = fakePage();
  const book = ["ada: hello"];
  const pending = {}; // "get" / "post" -> { resolve, answer }
  const fetch = (path, opts) => new Promise((resolve) => { const kind = opts && opts.method === "POST" ? "post" : "get"; pending[kind] = { resolve, body: opts && opts.body }; });
  const ctx = vm.createContext({ document, fetch, URLSearchParams, console });
  const model = EL.create();
  for (const a of order) {
    model.do(a);
    if (a === "load") vm.runInContext(appSrc, ctx);
    if (a === "click") nodes.post.onclick();
    if (a === "serveGet") pending.get.answer = book.slice();
    if (a === "servePost") { const f = pending.post.body; book.push(`${f.get("name")}: ${f.get("message")}`); pending.post.answer = book.slice(); }
    if (a === "arriveGet" || a === "arrivePost") { const p = pending[a === "arriveGet" ? "get" : "post"]; p.resolve({ status: 200, json: async () => p.answer }); }
    await flush(); await flush();
  }
  const page = nodes.messages.children.map((c) => c.textContent);
  ok("eventloop", JSON.stringify(page) === JSON.stringify(model.state().page) && JSON.stringify(book) === JSON.stringify(model.state().book), `order ${order}: app.js page ${JSON.stringify(page)}, model ${JSON.stringify(model.state().page)}`);
  ordersChecked++;
}
console.log(`event loop: app.js run in all ${ordersChecked} orders`);

/* ---------------------------------------------------------------- 3. answer keys */
const attr = (tag, name) => { const m = new RegExp(`${name}=(?:"([^"]*)"|'([^']*)')`).exec(tag); return m ? (m[1] ?? m[2]).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&") : undefined; };
const tagOf = (id) => { const at = html.indexOf(`data-id="${id}"`); if (at < 0) throw new Error(`no item ${id}`); return html.slice(html.lastIndexOf("<", at), html.indexOf(">", at) + 1); };
const keyOf = (tid, part) => { const at = html.indexOf(`data-id="${tid}"`); const end = html.indexOf("</article>", at); const m = new RegExp(`<div class="answer-spec" data-part="${part}"[^>]*>`).exec(html.slice(at, end)); if (!m) throw new Error(`no part ${tid}.${part}`); return attr(m[0], "data-answer"); };
const itemKey = (id) => attr(tagOf(id), "data-answer");
const eqKey = (label, key, truth) => ok("keys", String(key) === String(truth), `${label}: key ${key} vs ${truth}`);

/* Lecture 12 */
{ const term = [...notes12.matchAll(/<div class="terminal highlight"><pre><span><\/span><code>([\s\S]*?)<\/code>/g)].map((m) => m[1].replace(/<[^>]+>/g, "")).find((t) => t.includes("Serving at") && t.includes("GET /app.js"));
  eqKey("l12 qc four requests", itemKey("cse331-w5-l12-qc-four"), term.split("\n").filter((l) => /^(GET|POST) /.test(l.trim())).length); }
{ const d = join(work, "json"); mkdirSync(d); const c = javac(d, [J("JsonProbe.java")]); ok("compile", c.status === 0, c.stderr);
  const [two, eve] = execFileSync("java", ["-cp", d, "JsonProbe"], { encoding: "utf8" }).trim().split("\n");
  eqKey("l12 qc json", itemKey("cse331-w5-l12-qc-json"), two); eqKey("l12 json problem", keyOf("cse331-w5-l12-json", "out"), eve);
  ok("keys", JSON.parse(eve)[0] === 'Eve: say "hi"', "the escaped JSON parses back to the message"); }
{ const refresh = [...notes12.matchAll(/<div class="terminal highlight"><pre><span><\/span><code>([\s\S]*?)<\/code>/g)].map((m) => m[1].replace(/<[^>]+>/g, "")).find((t) => t.trim().split("\n").length === 3 && t.includes("GET /app.js"));
  eqKey("l12 qc refresh posts", itemKey("cse331-w5-l12-qc-refresh"), refresh.split("\n").filter((l) => l.startsWith("POST")).length); }
{ const postBody = appSrc.slice(appSrc.indexOf("async function post"), appSrc.indexOf("document.getElementById(\"post\")")); eqKey("l12 qc pieces of post", itemKey("cse331-w5-l12-qc-pieces"), (postBody.match(/\bawait\b/g) || []).length + 1); }
eqKey("l12 quiz object", itemKey("cse331-w5-l12-quiz-object"), String({ name: "ada", message: "hello" }));
{ const handle = /private static void handle[\s\S]*?\n    }\n/.exec(notes12.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">"))[0]; eqKey("l12 quiz 404", itemKey("cse331-w5-l12-quiz-404"), /send\(exchange, (\d+), "text\/plain"/.exec(handle)[1]); }
eqKey("l12 ex1 line", keyOf("cse331-w5-l12-ex1", "relies"), appSrc.split("\n").findIndex((l) => l.includes("item.textContent = message")) + 1);
{ const m = EL.create(); ["load", "click", "serveGet", "servePost", "arrivePost", "arriveGet"].forEach((a) => m.do(a)); const s = m.state();
  eqKey("l12 ex2 third box", keyOf("cse331-w5-l12-ex2", "third"), s.boxes[2] === "the rest of post" ? "post" : "load");
  eqKey("l12 ex2 page shows", keyOf("cse331-w5-l12-ex2", "shows"), s.page.includes("bob: hi") ? "yes" : "no");
  eqKey("l12 ex2 book has", keyOf("cse331-w5-l12-ex2", "book"), s.book.includes("bob: hi") ? "yes" : "no"); }
{ let threw = false; try { new vm.Script(appSrc.replace("async function load()", "function load()")); } catch (e) { threw = e instanceof SyntaxError || e.name === "SyntaxError"; }
  eqKey("l12 ex3 lines that run", keyOf("cse331-w5-l12-ex3", "runs"), threw ? 0 : "some"); }

/* Section 4: every small array each representation allows */
{ const arrays = [[]]; for (let len = 1; len <= 4; len++) { const rec = (p) => { if (p.length === len) { arrays.push(p); return; } for (const v of [0, 1, 2, 3]) rec([...p, v]); }; rec([]); }
  const RI = { 1: () => true, 2: (a) => new Set(a).size === a.length, 3: (a) => a.every((v, i) => i === 0 || a[i - 1] <= v) };
  const AF = (a) => new Set(a);
  const bsearch = (a, n) => { let lo = 0, hi = a.length - 1; while (lo <= hi) { const mid = (lo + hi) >>> 1; if (a[mid] < n) lo = mid + 1; else if (a[mid] > n) hi = mid - 1; else return mid; } return -(lo + 1); };
  const sameSet = (x, y) => x.size === y.size && [...x].every((v) => y.has(v));
  const METHODS = {
    bs: (a, n) => ({ ret: bsearch(a, n) >= 0, after: a, spec: (a0, r) => r === AF(a0).has(n) }),
    loop: (a, n) => ({ ret: a.includes(n), after: a, spec: (a0, r) => r === AF(a0).has(n) }),
    add: (a, n) => { const after = a.includes(n) ? a.slice() : [...a, n]; return { after, spec: (a0, r, b) => sameSet(AF(b), new Set([...AF(a0), n])) }; },
    remove: (a, n) => { const after = a.slice(); const i = after.indexOf(n); if (i >= 0) after.splice(i, 1); return { ret: i >= 0, after, spec: (a0, r, b) => { const want = new Set(AF(a0)); want.delete(n); return sameSet(AF(b), want) && r === AF(a0).has(n); } }; },
  };
  for (const [m, f] of Object.entries(METHODS)) {
    const good = [1, 2, 3].filter((rep) => arrays.filter(RI[rep]).every((a) => [0, 1, 2, 3, 4].every((n) => { const r = f(a, n); return r.spec(a, r.ret, r.after) && RI[rep](r.after); })));
    eqKey(`s4 ${m}`, keyOf("cse331-w5-s4-grid", m), good.join(","));
    if (m === "bs") eqKey("s4 qc bs", itemKey("cse331-w5-s4-qc-bs"), good.join(","));
  } }
{ const T = new Set([1, 2, 3]); [4, 2, 0].forEach((n) => T.add(n)); eqKey("s4 qc size", itemKey("cse331-w5-s4-qc-size"), T.size);
  const U = new Set([1, 2, 3]); const changed = !(U.has(3)); eqKey("s4 add3", keyOf("cse331-w5-s4-task1", "add3"), changed ? "yes" : "no");
  eqKey("s4 remove 7", keyOf("cse331-w5-s4-task1", "remove-ret"), U.has(7) ? "yes" : "no");
  U.add(4); U.delete(2); U.add(0); eqKey("s4 after", keyOf("cse331-w5-s4-task1", "after"), U.size); }
{ const removeUntil = (snacks) => { let size = snacks.length; while (size !== 0) { const top = snacks[size - 1]; if (top === "Almond Joy") return [true, size]; size--; } return [false, size]; };
  const A = "Almond Joy";
  eqKey("s4 qc run", itemKey("cse331-w5-s4-qc-run"), removeUntil(["Kit Kat", A, "Twix", "Mars"])[1]);
  const [ra, sa] = removeUntil([A, "Twix", A, "Mars"]); eqKey("s4 almond a ret", keyOf("cse331-w5-s4-almond", "a-ret"), ra ? "yes" : "no"); eqKey("s4 almond a size", keyOf("cse331-w5-s4-almond", "a-size"), sa);
  eqKey("s4 almond b", keyOf("cse331-w5-s4-almond", "b-size"), removeUntil(["Twix", "Mars"])[1]); eqKey("s4 almond c", keyOf("cse331-w5-s4-almond", "c-size"), removeUntil([A])[1]);
  // the spec and the invariant on every small stack
  const names = ["Twix", A, "Mars"]; let good = true;
  for (let len = 0; len <= 4; len++) { const rec = (p) => { if (p.length === len) { const [r, size] = removeUntil(p); const k = p.lastIndexOf(A); if (r !== (k >= 0) || size !== k + 1) good = false; return; } for (const v of names) rec([...p, v]); }; rec([]); }
  ok("keys", good, "removeUntil meets its spec on every stack of up to four snacks"); }

/* Lecture 13: the Java runs above, and the notes' stacks */
{ const out = (n) => javaRuns[n].stdout.replace(/\n$/, "").split("\n");
  eqKey("l13 qc lines", itemKey("cse331-w5-l13-qc-lines"), out("Trace").length);
  eqKey("l13 hs1 fifth", keyOf("cse331-w5-l13-hs1", "fifth"), out("Trace")[4].trim());
  eqKey("l13 hs1 last", keyOf("cse331-w5-l13-hs1", "last"), out("Trace").at(-1).trim());
  eqKey("l13 hs1 status", keyOf("cse331-w5-l13-hs1", "status"), javaRuns.Trace.status);
  eqKey("l13 quiz trace top", itemKey("cse331-w5-l13-quiz-trace-top"), /at Trace\.g\(Trace\.java:(\d+)\)/.exec(javaRuns.Trace.stderr)[1]);
  const fDone = out("TraceCatch").filter((l) => l.trim() === "f: done").length;
  eqKey("l13 qc f: done for f(0)", itemKey("cse331-w5-l13-qc-fdone"), fDone === 2 ? "yes" : "no");
  eqKey("l13 hs2 f2", keyOf("cse331-w5-l13-hs2", "f2"), fDone >= 1 ? "yes" : "no"); eqKey("l13 hs2 f0", keyOf("cse331-w5-l13-hs2", "f0"), fDone === 2 ? "yes" : "no");
  eqKey("l13 quiz main done", itemKey("cse331-w5-l13-quiz-main-done"), out("TraceCatch").includes("main: done") ? "yes" : "no");
  eqKey("l13 hs2 before", keyOf("cse331-w5-l13-hs2", "before"), out("TraceCatch").at(-2));
  eqKey("l13 qc finally count", itemKey("cse331-w5-l13-qc-finally"), out("TraceFinally").filter((l) => l.trim() === "f: finally").length);
  eqKey("l13 finally count", keyOf("cse331-w5-l13-finally", "count"), out("TraceFinally").length);
  eqKey("l13 finally after", keyOf("cse331-w5-l13-finally", "after"), out("TraceFinally")[out("TraceFinally").indexOf("  f: calling g(0)") + 1].trim());
  eqKey("l13 qc swallow status", itemKey("cse331-w5-l13-qc-status"), javaRuns.TraceSwallow.status); }
{ const d = join(work, "stacks"); mkdirSync(d); const c = javac(d, [J("Stacks.java")]); ok("compile", c.status === 0, c.stderr);
  const lines = execFileSync("java", ["-cp", d, "Stacks"], { encoding: "utf8" }).trim().split("\n");
  ok("keys", lines[0] === "error: cannot divide by zero" && lines[2] === "error: cannot divide by zero", `both say no: ${lines}`);
  eqKey("l13 hs3 should", keyOf("cse331-w5-l13-hs3", "should"), lines[1]); eqKey("l13 hs3 draft", keyOf("cse331-w5-l13-hs3", "draft"), lines[3]); eqKey("l13 qc draft", itemKey("cse331-w5-l13-qc-draft"), lines[3]);
  const bad = javac(d, [J("Stacks.java"), J("CatchOrder.java")]);
  const compiles = bad.status === 0;
  ok("keys", !compiles && /has already been caught/.test(bad.stderr), `catch order: ${bad.stderr.split("\n")[0]}`);
  eqKey("l13 quiz order", itemKey("cse331-w5-l13-quiz-order"), compiles ? "yes" : "no"); eqKey("l13 catch order", keyOf("cse331-w5-l13-catch-order", "compiles"), compiles ? "yes" : "no"); }

/* every typed answer key is accepted by its own grader */
const SETS = { set: { tokens: ["1", "2", "3"] } };
for (const m of html.matchAll(/<(?:div|li) class="(?:answer-spec|check|cyu)"[^>]*data-answer=[^>]*>/g)) {
  const tag = m[0], type = attr(tag, "data-type");
  if (!type || type === "choice") continue;
  const spec = { type, answer: attr(tag, "data-answer"), allowed: attr(tag, "data-allowed"), ...(SETS[type] || {}) };
  ok("graders", G.grade(spec, String(spec.answer).split("|")[0]).status === "correct", `own key not accepted: ${tag.slice(0, 140)}`);
}
console.log(`answer keys: ${counts.keys} checks`);

rmSync(work, { recursive: true, force: true });
console.log(`groups: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`${checks - fails}/${checks} checks match real Java, the notes and brute force`);
process.exit(fails ? 1 : 0);
