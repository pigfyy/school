// Ground truth for CSE 331 week 4 (site/cse331/w04/). Compiles the lectures' Java and runs it for real.
//   1. Lecture 9's Guestbook.java (the 115-line listing; port changed to 19331 so it cannot clash), sent curated
//      and random requests over HTTP: status, Content-length, body bytes, the terminal's log, and which requests
//      get no response must match site/cse331/w04/guestbook-sim.js. The notes' two fixes (exercises 1 and 2)
//      are built from the notes' code and checked the same way.
//   2. Lectures 10 and 11's HelpQueue classes and the notes' drafts (built by line edits), run through
//      QueueHarness on random operation sequences: every result, exception and field must match queue-sim.js.
//   3. Every computed answer key on the page (Section 3's triples by brute force; the lectures' runs).
// Usage: bun checks/cse331/w04/verify.mjs   (java 17+; uses javac, else `java -m jdk.compiler`)
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import http from "node:http";

const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const GB = req("../../../site/cse331/w04/guestbook-sim.js");
const QS = req("../../../site/cse331/w04/queue-sim.js");
const G = req("../../../site/core/grader.js");
const html = (() => { try { return readFileSync(join(here, "../../../site/cse331/w04/index.html"), "utf8"); } catch { return ""; } })();

let checks = 0, fails = 0;
const counts = {};
const ok = (group, cond, msg) => { checks++; counts[group] = (counts[group] || 0) + 1; if (!cond) { fails++; if (fails <= 40) console.log(`MISMATCH [${group}]:`, msg); } };

const work = mkdtempSync(join(tmpdir(), "cse331-w4-"));
const hasJavac = spawnSync("javac", ["-version"]).status === 0;
function javac(dir, files) {
  const [cmd, args] = hasJavac ? ["javac", ["-d", dir, ...files]] : ["java", ["-m", "jdk.compiler/com.sun.tools.javac.Main", "-d", dir, ...files]];
  return spawnSync(cmd, args, { encoding: "utf8", cwd: dir });
}
const src = (f) => readFileSync(join(here, "java", f), "utf8").split("\n");
const edit = (lines, blank = [], replace = {}) => lines.map((l, i) => (blank.includes(i + 1) ? "" : replace[i + 1] ?? l)).join("\n");

/* ---------------------------------------------------------------- 1. the guestbook over HTTP */
const gb = src("Guestbook.java");
ok("listing", gb.filter((l, i) => i < 115 || l !== "").length === 115 && gb[20] === "public class Guestbook {" && gb[96] === "/** The messages posted so far, oldest first. */", "Guestbook.java is the notes' 115-line listing");
const PORT = 19331;
const withPort = (lines) => lines.map((l) => l.replace("9331", String(PORT)));
// The notes' fixes: exercise 1 (lines 46 to 51 become the checked block) and exercise 2 (escape, and line 84's call)
function fixed({ check, escape }) {
  let lines = withPort(gb);
  if (escape) {
    lines[84] = lines[84].replace('"<li>" + message + "</li>\\n"', '"<li>" + escape(message) + "</li>\\n"');
    lines.splice(94, 0, "    /** @return text with <, >, and & written as HTML spells them */", "    private static String escape(String text) {", '        return text.replace("&", "&amp;")', '            .replace("<", "&lt;")', '            .replace(">", "&gt;");', "    }");
  }
  if (check) lines[49] = '            String name = fields.get("name"); String message = fields.get("message"); if (name != null && message != null) { book.add(name, message); }';
  return lines.join("\n");
}
function startServer(dir) {
  return new Promise((resolve, reject) => {
    const p = spawn("java", ["-cp", dir, "Guestbook"]);
    let out = "";
    p.stdout.on("data", (d) => { out += d; if (out.includes("Serving at")) resolve({ p, log: () => out }); });
    p.stderr.on("data", (d) => process.stderr.write(d));
    p.on("exit", (c) => reject(new Error(`Guestbook exited ${c}`)));
  });
}
function send({ method, path, body }) {
  return new Promise((resolve) => {
    const r = http.request({ host: "127.0.0.1", port: PORT, method, path, agent: false, headers: body ? { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) } : {} }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => { const b = Buffer.concat(chunks); resolve({ status: res.statusCode, length: res.headers["content-length"], ctype: res.headers["content-type"], body: b.toString("utf8"), bytes: b.length }); });
    });
    r.on("error", () => resolve({ closed: true }));
    if (body) r.write(body);
    r.end();
  });
}
let seed = 404;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const PIECES = ["name", "message", "=", "&", "Ada", "hello+world", "%20", "%3Cb%3E", "<b>hi</b>", "%", "%4", "%zz", "%C3%A9", "é", "+", "x", "", "%%", "%+4", "%-1"];
const randomBody = () => Array.from({ length: 1 + rnd(7) }, () => PIECES[rnd(PIECES.length)]).join("");
const CURATED = [
  { method: "GET", path: "/" }, { method: "GET", path: "/favicon.ico" }, { method: "POST", path: "/", body: "name=Ada&message=hello+world" },
  { method: "GET", path: "/" }, { method: "POST", path: "/", body: "" }, { method: "POST", path: "/", body: "name=%&message=x" },
  { method: "POST", path: "/", body: "name=Eve&message=%3Cb%3Ehello%3C%2Fb%3E" }, { method: "GET", path: "/?name=Ada&message=hello+world" },
  { method: "POST", path: "/", body: "message=only" }, { method: "POST", path: "/", body: "name=Bob&message=caf%C3%A9+%26+tea" }, { method: "PUT", path: "/x" },
  { method: "POST", path: "/", body: "name=A&message=1&message=2" }, { method: "POST", path: "/", body: "&&" }, { method: "POST", path: "/", body: "name" },
];
for (const [label, opts] of [["original", {}], ["exercise 1", { checkFields: true }], ["exercise 2", { escape: true }]]) {
  const dir = join(work, `gb-${label.replace(" ", "")}`);
  mkdirSync(dir);
  writeFileSync(join(dir, "Guestbook.java"), label === "original" ? withPort(gb).join("\n") : fixed({ check: opts.checkFields, escape: opts.escape }));
  const c = javac(dir, ["Guestbook.java"]);
  ok("compile", c.status === 0, `${label}: ${c.stderr}`);
  const server = await startServer(dir);
  const sim = GB.create(opts);
  const reqs = [...CURATED, ...Array.from({ length: label === "original" ? 300 : 80 }, () => (rnd(5) ? { method: "POST", path: "/", body: randomBody() } : { method: "GET", path: "/" }))];
  const logs = [];
  for (const r of reqs) {
    const got = await send(r);
    const want = sim.request(r);
    logs.push(want.log);
    if (want.closed) ok("guestbook", got.closed === true, `${label} ${JSON.stringify(r)}: java answered ${got.status}, sim closed the connection (${want.error})`);
    else ok("guestbook", !got.closed && got.status === 200 && got.body === want.body && Number(got.length) === want.bytes && got.ctype === "text/html; charset=utf-8",
      `${label} ${JSON.stringify(r)}:\n  java ${JSON.stringify(got).slice(0, 400)}\n  sim  ${JSON.stringify({ body: want.body, bytes: want.bytes }).slice(0, 400)}`);
  }
  await new Promise((r) => setTimeout(r, 150));
  const javaLog = server.log().trim().split("\n").slice(1);
  const at = javaLog.findIndex((l, i) => l !== logs[i]);
  ok("guestbook", at < 0 && javaLog.length === logs.length, `${label}: terminal log differs at ${at} of ${javaLog.length}/${logs.length}\n  java ${javaLog.slice(Math.max(0, at - 2), at + 3)}\n  sim  ${logs.slice(Math.max(0, at - 2), at + 3)}\n  requests ${JSON.stringify(reqs.slice(Math.max(0, at - 2), at + 3))}`);
  server.p.kill();
  console.log(`guestbook (${label}): ${reqs.length} requests`);
}
{ const g = GB.create(); const first = g.request({ method: "GET", path: "/" }); ok("notes", first.bytes === 178 && first.body.startsWith("<html><body>\n<h1>Guestbook</h1>\n<ul>\n</ul>"), "the first page is 178 bytes, as the notes print");
  g.request({ method: "POST", path: "/", body: "" }); ok("notes", g.book()[0] === "null: null", "an empty POST adds null: null");
  ok("notes", GB.encodeForm([["name", "Ada"], ["message", "hello world"]]) === "name=Ada&message=hello+world", "the form's body"); }

/* ---------------------------------------------------------------- 2. the help queues */
const COPIES = {
  list: ["ListQueue", { "ListQueue.java": src("ListQueue.java").join("\n") }],
  linked: ["LinkedQueue", { "LinkedQueue.java": src("LinkedQueue.java").join("\n") }],
  fast: ["FastQueue", { "FastQueue.java": src("FastQueue.java").join("\n") }],
  faster: ["FasterQueue", { "FasterQueue.java": src("FasterQueue.java").join("\n") }],
  listBack: ["ListQueue", { "ListQueue.java": edit(src("ListQueue.java"), [], { 24: "        return queue.remove(queue.size() - 1);" }) }],
  fastNo66: ["FastQueue", { "FastQueue.java": edit(src("FastQueue.java"), [66]) }],
  fastNo66NoCheck: ["FastQueue", { "FastQueue.java": edit(src("FastQueue.java"), [66, 24, 33, 46, 51, 57, 61, 67, 72]) }],
  fasterDraft: ["FasterQueue", { "FasterQueue.java": edit(src("FasterQueue.java"), [90, 91], { 89: "        list.addAll(outbox);" }) }],
};
ok("listing", src("ListQueue.java")[23] === "        return queue.remove(0);" && src("FastQueue.java")[65] === "        members.remove(front);" && src("FasterQueue.java")[88].includes("for (int i = outbox.size() - 1"), "the lines the drafts change are the notes' lines");
ok("listing", src("FastQueue.java").map((l, i) => (l.trim() === "checkRep();" ? i + 1 : 0)).filter(Boolean).join() === "24,33,46,51,57,61,67,72", "FastQueue's checkRep calls are on lines 24, 33, 46, 51, 57, 61, 67 and 72");
const NAMES = ["ada", "bob", "eve", "kim"];
function randomOps() {
  const ops = [];
  for (let k = 0, n = 2 + rnd(12); k < n; k++) { const r = rnd(10); ops.push(r < 5 ? `join ${NAMES[rnd(NAMES.length)]}` : r < 8 ? "next" : r < 9 ? "size" : "waiting"); }
  return ops;
}
const show = (r) => ("error" in r ? `!${r.error}` : Array.isArray(r.value) ? `[${r.value.join(", ")}]` : String(r.value));
for (const [kind, [cls, files]] of Object.entries(COPIES)) {
  const dir = join(work, `q-${kind}`);
  mkdirSync(dir);
  for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, f), text);
  writeFileSync(join(dir, "HelpQueue.java"), src("HelpQueue.java").join("\n"));
  const c = javac(dir, [...Object.keys(files), "HelpQueue.java", join(here, "java", "QueueHarness.java")]);
  ok("compile", c.status === 0, `${kind}: ${c.stderr}`);
  const seqs = [["join ada", "join bob", "waiting", "next", "waiting", "size"], ["join ada", "next", "join ada", "waiting"], ["join ada", "join bob", "join eve", "next", "waiting", "next", "next"], ["next"], ["join ada", "join ada", "waiting"], ...Array.from({ length: 400 }, randomOps)];
  const input = seqs.map((s) => ["new", ...s].join("\n")).join("\n") + "\n";
  const out = execFileSync("java", ["-cp", dir, "QueueHarness", cls], { input, encoding: "utf8" }).trim().split("\n");
  const want = [];
  for (const s of seqs) {
    const q = QS.make(kind);
    want.push("new");
    for (const op of s) { const [o, a] = op.split(" "); want.push(`${op} -> ${show(q[o](a))} | ${q.raw()}`); }
  }
  let bad = 0;
  out.forEach((line, i) => { if (line !== want[i]) { bad++; if (bad <= 3) ok("queues", false, `${kind} line ${i}:\n  java ${line}\n  sim  ${want[i]}`); } });
  ok("queues", out.length === want.length, `${kind}: ${out.length} lines vs ${want.length}`);
  ok("queues", bad === 0, `${kind}: ${bad} lines differ`);
  counts.queueOps = (counts.queueOps || 0) + out.length;
}
console.log(`queues: ${Object.keys(COPIES).length} classes, ${counts.queueOps} operations compared`);

/* ---------------------------------------------------------------- 3. answer keys */
const attr = (tag, name) => { const m = new RegExp(`${name}=(?:"([^"]*)"|'([^']*)')`).exec(tag); return m ? (m[1] ?? m[2]).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&") : undefined; };
const tagOf = (id) => { const at = html.indexOf(`data-id="${id}"`); if (at < 0) throw new Error(`no item ${id}`); return html.slice(html.lastIndexOf("<", at), html.indexOf(">", at) + 1); };
const keyOf = (tid, part) => { const at = html.indexOf(`data-id="${tid}"`); const end = html.indexOf("</article>", at); const m = new RegExp(`<div class="answer-spec" data-part="${part}"[^>]*>`).exec(html.slice(at, end)); if (!m) throw new Error(`no part ${tid}.${part}`); return attr(m[0], "data-answer"); };
const itemKey = (id) => attr(tagOf(id), "data-answer");
const eqKey = (label, key, truth) => ok("keys", String(key) === String(truth), `${label}: key ${key} vs ${truth}`);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/* Lecture 9: the guestbook simulator, checked against the real server above */
{ const g = GB.create(); const log = [];
  const browser = (r) => { const res = g.request(r); log.push(res.log); if (!res.closed) log.push(g.request({ method: "GET", path: "/favicon.ico" }).log); return res; };
  browser({ method: "GET", path: "/" }); const posted = browser({ method: "POST", path: "/", body: GB.encodeForm([["name", "Ada"], ["message", "hello world"]]) }); browser({ method: "GET", path: "/" });
  eqKey("l9 qc six request lines", itemKey("cse331-w4-l9-qc-six"), log.length);
  eqKey("l9 qc length after Ada", itemKey("cse331-w4-l9-qc-length"), posted.bytes); }
eqKey("l9 qc encode", itemKey("cse331-w4-l9-qc-encode"), GB.encodeForm([["name", "Bob"], ["message", "hi there"]]));
eqKey("l9 quiz status", itemKey("cse331-w4-l9-quiz-status"), GB.create().request({ method: "GET", path: "/" }).status);
{ const g = GB.create(); g.request({ method: "POST", path: "/", body: "" }); eqKey("l9 quiz null", itemKey("cse331-w4-l9-quiz-null"), g.book()[0]); }
{ const g = GB.create(); g.request({ method: "POST", path: "/", body: "message=hi" }); eqKey("l9 ex1 adds now", keyOf("cse331-w4-l9-ex1", "adds-now"), g.book()[0]);
  const f = GB.create({ checkFields: true }); eqKey("l9 ex1 bytes after fix", keyOf("cse331-w4-l9-ex1", "bytes-after"), f.request({ method: "POST", path: "/", body: "" }).bytes); }
{ const g = GB.create({ escape: true }); const r = g.request({ method: "POST", path: "/", body: GB.encodeForm([["name", "Eve"], ["message", "<b>hello</b>"]]) });
  const line = r.body.split("\n").find((l) => l.startsWith("<li>")); eqKey("l9 ex2 escaped line", keyOf("cse331-w4-l9-ex2", "line"), line); }
{ const q = GB.encodeForm([["name", "Ada"], ["message", "hello world"]]); eqKey("l9 ex3 request line", keyOf("cse331-w4-l9-ex3", "request"), `GET /?${q} HTTP/1.1`);
  const g = GB.create(); g.request({ method: "GET", path: `/?${q}` }); eqKey("l9 ex3 posted", keyOf("cse331-w4-l9-ex3", "posted"), g.book().length ? "yes" : "no"); }
{ const g = GB.create(); const body = GB.encodeForm([["name", "Ada"], ["message", "hello world"]]); g.request({ method: "POST", path: "/", body }); const again = g.request({ method: "POST", path: "/", body });
  eqKey("l9 ex4 log", keyOf("cse331-w4-l9-ex4", "log"), again.log); eqKey("l9 ex4 times", keyOf("cse331-w4-l9-ex4", "times"), g.book().filter((m) => m === "Ada: hello world").length); }
{ const body = GB.encodeForm([["name", "Bob"], ["message", "café & tea"]]); const g = GB.create(); const r = g.request({ method: "POST", path: "/", body });
  eqKey("l9 encodings body", keyOf("cse331-w4-l9-encodings", "body"), body); eqKey("l9 encodings stored", keyOf("cse331-w4-l9-encodings", "stored"), g.book()[0]); eqKey("l9 encodings bytes", keyOf("cse331-w4-l9-encodings", "bytes"), r.bytes); }

/* Java probes: the seven tests on the real classes and the notes' variants, URLDecoder, divideByTen */
const PROBE_COPIES = {
  ListQueue: { "ListQueue.java": src("ListQueue.java").join("\n") },
  LinkedQueue: { "LinkedQueue.java": src("LinkedQueue.java").join("\n") },
  noCheck: { "ListQueue.java": edit(src("ListQueue.java"), [14, 15, 16]) },
  listBack: { "ListQueue.java": edit(src("ListQueue.java"), [], { 24: "        return queue.remove(queue.size() - 1);" }) },
  view: { "ListQueue.java": edit(src("ListQueue.java"), [], { 29: "        return java.util.Collections.unmodifiableList(queue);" }) },
  shared: { "ListQueue.java": edit(src("ListQueue.java"), [], { 29: "        return queue;" }) },
  publicField: { "ListQueue.java": edit(src("ListQueue.java"), [], { 7: "    public List<String> queue = new ArrayList<String>();" }), "Shortcut.java": src("Shortcut.java").join("\n") },
  fastDraft3: { "FastQueue.java": edit(src("FastQueue.java"), [], { 65: "        members.remove(queue.get(0));", 66: "        String front = queue.remove(0);" }) },
  fast: { "FastQueue.java": src("FastQueue.java").join("\n") },
  linkedNoBack: { "LinkedQueue.java": edit(src("LinkedQueue.java"), [56, 57, 58]) },
};
ok("listing", src("ListQueue.java")[6].includes("private List<String> queue") && src("ListQueue.java")[13].includes("if (queue.contains(netid))") && src("ListQueue.java")[28].includes("return new ArrayList<String>(queue);") && src("LinkedQueue.java")[55].includes("if (front == null)"), "the ListQueue and LinkedQueue lines the variants change");
const probeRun = {};
for (const [name, files] of Object.entries(PROBE_COPIES)) {
  const dir = join(work, `p-${name}`); mkdirSync(dir);
  for (const [f, t] of Object.entries(files)) writeFileSync(join(dir, f), t);
  writeFileSync(join(dir, "HelpQueue.java"), src("HelpQueue.java").join("\n"));
  const c = javac(dir, [...Object.keys(files), "HelpQueue.java", join(here, "java", "Probe.java")]);
  ok("compile", c.status === 0, `probe ${name}: ${c.stderr}`);
  probeRun[name] = (...a) => execFileSync("java", ["-cp", dir, ...a], { encoding: "utf8" }).trim();
}
const T = (copy, cls) => probeRun[copy]("Probe", "tests", cls);
ok("keys", T("ListQueue", "ListQueue") === "none" && T("fast", "FastQueue") === "none", `ListQueue and FastQueue pass all seven: ${T("ListQueue", "ListQueue")} / ${T("fast", "FastQueue")}`);
eqKey("l10 quiz nocheck fails", itemKey("cse331-w4-l10-quiz-nocheck"), [...T("noCheck", "ListQueue")].filter((c) => "ABCDE".includes(c)).length);
eqKey("l10 ex2 fail", keyOf("cse331-w4-l10-ex2", "fail"), T("listBack", "ListQueue"));
eqKey("l10 ex3 fail", keyOf("cse331-w4-l10-ex3", "fail"), T("view", "ListQueue"));
ok("keys", T("LinkedQueue", "LinkedQueue") === "F", `LinkedQueue fails only joinTwiceSaysWho: ${T("LinkedQueue", "LinkedQueue")}`);
{ const q = QS.make("listBack"); q.join("ada"); q.join("bob"); eqKey("l10 ex2 got", keyOf("cse331-w4-l10-ex2", "got"), q.next().value); }
{ const out = probeRun.publicField("Shortcut").split("\n"); ok("keys", out[0] === "[eve, ada, bob, ada]", `Shortcut prints ${out[0]}`); eqKey("l10 qc shortcut", itemKey("cse331-w4-l10-qc-shortcut"), out[1]); }
{ const d = join(work, "p-shared"); writeFileSync(join(d, "Twice.java"), 'public class Twice { public static void main(String[] a) { ListQueue q = new ListQueue(); q.join("ada"); q.waiting().add("ada"); System.out.println(q.size()); } }');
  javac(d, ["Twice.java"]); eqKey("l10 half sheet size", keyOf("cse331-w4-l10-half-sheet", "size"), probeRun.shared("Twice")); }
{ const q = QS.make("linked"); q.join("ada"); eqKey("l10 quiz linked message", itemKey("cse331-w4-l10-quiz-linked"), q.join("ada").error.replace("IllegalArgumentException: ", "")); }
{ // the six tests of the notes' exercise 3: the five spec tests (A to E) and FastQueueTest's constructor test
  const specFails = [...T("fastDraft3", "FastQueue")].filter((c) => "ABCDE".includes(c)).length, ctorFails = probeRun.fastDraft3("Probe", "ctor", "FastQueue") === "pass" ? 0 : 1;
  eqKey("l11 ex3 tests that fail", keyOf("cse331-w4-l11-ex3", "fail"), specFails + ctorFails); }
ok("keys", T("fast", "FastQueue") === T("fastDraft3", "FastQueue"), "the draft next passes the same tests as FastQueue");
{ const d = join(work, "p-linkedNoBack"); writeFileSync(join(d, "Back.java"), 'public class Back { public static void main(String[] a) { LinkedQueue q = new LinkedQueue(); q.join("ada"); q.next(); q.join("ada"); System.out.println(q.waiting()); } }');
  javac(d, ["Back.java"]); const w = probeRun.linkedNoBack("Back"); ok("keys", w === "[]", `without lines 56 to 58, ada rejoins but waiting is ${w}`); eqKey("l11 ex4 back null", keyOf("cse331-w4-l11-ex4", "back-null"), w === "[]" ? "yes" : "no"); }
{ const misc = Object.fromEntries(probeRun.ListQueue("Probe", "misc").split("\n").map((l) => l.split("=")));
  eqKey("l9 quiz decode", itemKey("cse331-w4-l9-quiz-decode"), misc.decode); ok("keys", GB.decode("hello+world+%26+tea") === misc.decode, "sim decode = URLDecoder");
  const [y, x, passes] = misc.divideByTen47.split(",");
  eqKey("s3 task4 y", keyOf("cse331-w4-s3-task4", "y"), y); eqKey("s3 task4 x", keyOf("cse331-w4-s3-task4", "x"), x); eqKey("s3 task4 passes", keyOf("cse331-w4-s3-task4", "passes"), passes); }

/* Lecture 11: the queue simulator, checked against the real classes above */
{ const q = QS.make("faster"); q.join("ada"); q.join("bob"); q.next(); q.join("eve"); ok("keys", q.raw() === "inbox=[eve]; outbox=[bob]; members={bob, eve}", q.raw());
  const spec = { type: "text", answer: itemKey("cse331-w4-l11-qc-af") }; ok("keys", G.grade(spec, q.af().join(", ")).status === "correct", `AF ${q.af()}`);
  ok("keys", G.grade({ type: "text", answer: keyOf("cse331-w4-l11-ex5", "af81") }, (() => { const r = QS.make("faster"); ["ada", "bob", "eve"].forEach((n) => r.join(n)); r.next(); return r.af().join(", "); })()).status === "correct", "ex5 AF after line 81"); }
{ const q = QS.make("fastNo66NoCheck"); q.join("ada"); q.join("bob"); q.next(); eqKey("l11 quiz size no66", itemKey("cse331-w4-l11-quiz-size-no66"), q.size().value); }
{ const q = QS.make("fasterDraft"); ["ada", "bob", "eve"].forEach((n) => q.join(n)); q.next(); eqKey("l11 quiz draft", itemKey("cse331-w4-l11-quiz-draft"), `[${q.waiting().value.join(", ")}]`);
  const r = QS.make("faster"); ["ada", "bob", "eve"].forEach((n) => r.join(n)); r.next(); const outbox = /outbox=(\[[^\]]*\])/.exec(r.raw())[1];
  eqKey("l11 ex5 outbox after 81", keyOf("cse331-w4-l11-ex5", "outbox81"), outbox);
  eqKey("l11 ex5 outbox after 78", keyOf("cse331-w4-l11-ex5", "outbox78"), `[${["ada", "bob", "eve"].reverse().join(", ")}]`); }
{ let n = 0; const names = ["bob", "eve"]; // every split of the queue bob, eve into outbox (reversed front part) and inbox
  for (let k = 0; k <= 2; k++) { const outbox = names.slice(0, k).reverse(), inbox = names.slice(k); const af = [...outbox.slice().reverse(), ...inbox]; if (af.join() === "bob,eve") n++; }
  const perms = [[], ["bob"], ["eve"], ["bob", "eve"], ["eve", "bob"]]; let m = 0;
  for (const o of perms) for (const i of perms) { const all = [...o, ...i]; if (new Set(all).size !== all.length || all.length !== 2) continue; if ([...o].reverse().concat(i).join() === "bob,eve") m++; }
  ok("keys", n === m, `${n} vs ${m}`); eqKey("l11 quiz af many", itemKey("cse331-w4-l11-quiz-af-many"), m); }
{ const f = src("FastQueue.java"); ok("keys", f[54].trim() === "queue.add(netid);" && f[55].trim() === "members.add(netid);" && f[66].trim() === "checkRep();" && f[65].trim() === "members.remove(front);", "FastQueue lines 55, 56, 66, 67");
  eqKey("l11 ex2 false after", keyOf("cse331-w4-l11-ex2", "false-after"), 55); eqKey("l11 ex2 true after", keyOf("cse331-w4-l11-ex2", "true-after"), 56); eqKey("l11 qc line", itemKey("cse331-w4-l11-qc-line"), 67); }

/* Section 3: brute force over integers */
const X = range(-40, 40);
const triples = {
  A: () => X.every((x) => !(x > 0) || x - 1 > 0),
  B: () => X.every((x) => !(x >= 10) || (x < 5 ? -100 : x) >= 10),
  C: () => X.every((a) => X.every((b) => { let x = a, y = b; x = x + y; y = x - y; x = x - y; return x === b && y === a; })),
  D: () => X.every((a) => X.every((b) => { let x = a, y = b; x = y; y = x; return x === b && y === a; })),
  E: () => range(0, 60).every((n) => { let i = 1; while (i <= n) i = i + 1; return i === n + 1; }),
  F: () => X.every((x) => !(x + 1 > 0) || (x < 0 ? -x : x) > 0),
};
eqKey("s3 warm-up invalid", keyOf("cse331-w4-s3-warmup", "invalid"), Object.keys(triples).filter((k) => !triples[k]()).join(""));
{ const x = Number(keyOf("cse331-w4-s3-warmup", "f")); ok("keys", x + 1 > 0 && !((x < 0 ? -x : x) > 0), `F fails at x = ${x}`); }
eqKey("s3 qc B", itemKey("cse331-w4-s3-qc-b"), triples.B() ? "yes" : "no");
{ let v = true; for (const y0 of range(6, 60)) for (const z0 of range(3, 60)) { const x = 4 * y0 - 3, y = y0 - 5, z = z0 * y; if (!(x < 2 * z + 20)) v = false; }
  eqKey("s3 task1 valid", keyOf("cse331-w4-s3-task1", "valid"), v ? "yes" : "no");
  const tag = (() => { const at = html.indexOf('data-id="cse331-w4-s3-task1"'); return /<div class="answer-spec" data-part="y"[^>]*>/.exec(html.slice(at))[0]; })();
  const spec = { type: "formula", answer: attr(tag, "data-answer"), points: JSON.parse(attr(tag, "data-points")) };
  ok("keys", spec.points.x.every((p) => { const x = Number(p); let y = x * x; y = y + 2 * x; y = y + 1; return G.checkFormula(String(y), spec.answer, { x: [p] }).ok; }), "nextSquare's y at P"); }
{ let eq1 = true, imp = true; for (const x of X) for (const w of X) { if ((2 * x - 8 < 4 * w) !== (x < 2 * w + Number(keyOf("cse331-w4-s3-task2", "first")))) eq1 = false; if (x < w + 1 && w > 0 && !(2 * x - 8 < 4 * w)) imp = false; }
  ok("keys", eq1, "2x - 8 < 4w is x < 2w + 4"); eqKey("s3 task2 implies", keyOf("cse331-w4-s3-task2", "implies"), imp ? "yes" : "no");
  let eq2 = true; for (const c of X) if ((2 * c + 1 >= c - 1) !== (c >= Number(keyOf("cse331-w4-s3-task2", "second")))) eq2 = false; ok("keys", eq2, "2c + 1 >= c - 1 is c >= -2");
  eqKey("s3 qc c", itemKey("cse331-w4-s3-qc-c"), keyOf("cse331-w4-s3-task2", "second")); }
{ const run = (s, d, len) => (s + d <= len ? d : len - s); let isMin = true; for (const len of range(1, 12)) for (const s of range(0, len - 1)) for (const d of range(0, 15)) if (run(s, d, len) !== Math.min(d, len - s)) isMin = false;
  ok("keys", isMin && keyOf("cse331-w4-s3-task3", "expr") === "min", "task 3 returns min(d, len - s)"); eqKey("s3 task3 run", keyOf("cse331-w4-s3-task3", "run"), run(3, 5, 6)); }

/* every typed answer key is accepted by its own grader */
for (const m of html.matchAll(/<(?:div|li) class="(?:answer-spec|check|cyu)"[^>]*data-answer=[^>]*>/g)) {
  const tag = m[0], type = attr(tag, "data-type");
  if (!type || type === "choice") continue;
  const spec = { type, answer: attr(tag, "data-answer"), allowed: attr(tag, "data-allowed"), points: tag.includes("data-points") ? JSON.parse(attr(tag, "data-points")) : undefined };
  ok("graders", G.grade(spec, String(spec.answer).split("|")[0]).status === "correct", `own key not accepted: ${tag.slice(0, 140)}`);
}
console.log(`answer keys: ${counts.keys} checks`);

rmSync(work, { recursive: true, force: true });
console.log(`groups: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`${checks - fails}/${checks} checks match real Java and brute force`);
process.exit(fails ? 1 : 0);
