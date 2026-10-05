/* CSE 331 week 1 site: routing, widgets, answer checking UI, and the bridge to js/store.js.
   State lives only in the store (window.CourseStore). This file reads it with store.get / attemptsOf and
   writes it with store.put (latest snapshot), store.attempt (one per Check press or self-mark) and
   store.event (hint reveals, solution views, clears). See ../INTEGRATION.md. */
"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const debounce = (fn, ms) => { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...a); }, ms); }; d.flush = (...a) => { if (t) { clearTimeout(t); t = null; fn(...a); } }; d.pending = () => Boolean(t); return d; };
const runSum = (variant, input) => window.SumSim.run(variant, input);
const Sim = window.SpecSim;
const KEYS = window.ANSWER_KEYS;
window.Grader.useSpecSim(Sim);

/* =========================================================== toasts (transient; no persistent save status) */
function toast(message, kind = "info", ms = 6000) {
  const box = $("#toasts");
  const t = el("div", { class: `toast ${kind}`, role: kind === "error" ? "alert" : "status" }, el("span", { text: message }));
  const close = el("button", { class: "toast-x", "aria-label": "Dismiss", text: "×" });
  close.addEventListener("click", () => t.remove());
  t.append(close);
  box.append(t);
  setTimeout(() => t.remove(), ms);
  return t;
}
const NOTICES = {
  "save-failed": ["Couldn't save just now. Your work is still on this page and in this browser. Retrying.", "error"],
  recovered: ["Saving works again. Nothing was lost.", "ok"],
  conflict: ["Your saved work also changed somewhere else. Merged both copies; nothing you typed was lost.", "info"],
  "load-failed": ["Couldn't load your saved work. Using this browser's copy for now. Retrying.", "error"],
  "mirror-failed": ["This browser is blocking local storage. Keep this tab open until saving recovers.", "error"],
  migrated: ["Brought over your answers from the earlier version of this site.", "info"],
};
function onNotice(kind, info) {
  if (kind === "remote-ignored") {
    if (info.status === "unknown-version") toast("Your saved work is from a newer version of this site, so this page won't overwrite it. Changes here stay in this browser.", "error", 10000);
    return;
  }
  const n = NOTICES[kind];
  if (n) toast(n[0], n[1]);
}

/* =========================================================== store */
const RESTORERS = new Map(); // item id -> () => void, redraws an item from the store
const store = window.CourseStore.create({
  adapter: window.COURSE_SITE_STORAGE || null,
  storage: (() => { try { const s = window.localStorage; s.getItem("x"); return s; } catch { return null; } })(),
  notify: onNotice,
  emit: (change) => document.dispatchEvent(new CustomEvent("course-site:change", { detail: change })),
  onApplied: (ids) => ids.forEach((id) => { const r = RESTORERS.get(id); if (r) r(); }),
  beforeMerge: () => flushPendingInput(),
});

/* =========================================================== routing */
const PAGES = $$(".page").map((p) => ({ id: p.id, title: p.dataset.title }));
function show(id) {
  if (!PAGES.some((p) => p.id === id)) id = "home";
  $$(".page").forEach((p) => p.classList.toggle("is-active", p.id === id));
  $$(".rail a[href^='#']").forEach((a) => {
    if (a.classList.contains("brand")) return;
    if (a.getAttribute("href") === `#${id}`) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = `${PAGES.find((p) => p.id === id).title} · CSE 331 week 1`;
  window.scrollTo(0, 0);
}
/* mobile Contents menu: the rail collapses to a top bar; #menu-btn toggles .rail.open */
(function setupMenu() {
  const btn = $("#menu-btn"), rail = $(".rail");
  const setOpen = (open) => { rail.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); };
  btn.addEventListener("click", () => setOpen(!rail.classList.contains("open")));
  $("#rail-body").addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
})();
const currentIndex = () => Math.max(0, PAGES.findIndex((p) => p.id === (location.hash.slice(1) || "home")));
function go(delta) { const i = currentIndex() + delta; if (i >= 0 && i < PAGES.length) location.hash = PAGES[i].id; }
function buildPagers() {
  $$(".page").forEach((page) => {
    const nav = $(".pager", page);
    if (!nav) return;
    const i = PAGES.findIndex((p) => p.id === page.id);
    if (i > 0) nav.append(el("a", { href: `#${PAGES[i - 1].id}` }, el("span", { text: "Previous" }), PAGES[i - 1].title));
    if (i < PAGES.length - 1) nav.append(el("a", { href: `#${PAGES[i + 1].id}`, class: "next" }, el("span", { text: "Next" }), PAGES[i + 1].title));
  });
}

/* =========================================================== keys */
function nextStepOnPage() {
  for (const steps of $$(".page.is-active .steps")) {
    if (steps.closest(".solution[hidden], details:not([open])")) continue;
    const hidden = $("li[hidden]", steps);
    if (hidden) { steps._reveal(); hidden.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" }); return; }
  }
}
function nextHintOnPage() {
  const mid = innerHeight / 2;
  const cands = $$(".page.is-active .task[data-id]").map((task) => ({ task, btn: $(".task-actions .hint-btn:not([disabled])", task) })).filter((c) => c.btn);
  if (!cands.length) return;
  const dist = (t) => { const r = t.getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - mid); };
  cands.sort((a, b) => dist(a.task) - dist(b.task));
  cands[0].btn.click();
}
document.addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea, select, button, [role=button]") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "ArrowRight") go(1);
  else if (e.key === "ArrowLeft") go(-1);
  else if (e.key === "n" || e.key === "N") nextStepOnPage();
  else if (e.key === "h" || e.key === "H") nextHintOnPage();
});

/* =========================================================== code listings */
const JAVA_KEYWORDS = new Set("import public class static void new while for int long return if else throw boolean".split(" "));
function highlightJava(line) {
  const frag = document.createDocumentFragment();
  const re = /(\/\/.*$|^\s*\/?\*.*$)|("(?:[^"\\]|\\.)*")|(@[a-z]+)|(\b[A-Za-z_]\w*\b)|(\b\d+\b)/g;
  let last = 0, m;
  while ((m = re.exec(line))) {
    if (m.index > last) frag.append(line.slice(last, m.index));
    if (m[1]) { frag.append(highlightDoc(m[1])); }
    else if (m[2]) frag.append(el("span", { class: "tk-str", text: m[2] }));
    else if (m[3]) frag.append(el("span", { class: "tk-tag", text: m[3] }));
    else if (m[4]) frag.append(JAVA_KEYWORDS.has(m[4]) ? el("span", { class: "tk-kw", text: m[4] }) : /^[A-Z]/.test(m[4]) && !/^(Spec|S[123])$/.test(m[4]) ? el("span", { class: "tk-type", text: m[4] }) : m[4]);
    else frag.append(el("span", { class: "tk-num", text: m[5] }));
    last = re.lastIndex;
  }
  if (last < line.length) frag.append(line.slice(last));
  return frag;
}
function highlightDoc(text) { // a comment line; @tags inside it stand out
  const span = el("span", { class: "tk-com" });
  text.split(/(@[a-z]+)/).forEach((p) => span.append(/^@[a-z]+$/.test(p) ? el("span", { class: "tk-tag", text: p }) : p));
  return span;
}
// data-src="x" uses <script id="src-x">; lines numbered from data-start (default 1) unless the listing has none.
// Lines starting with § are assertions, shown unnumbered. data-from/data-to keep a range; data-hl highlights.
const NUMBERED = new Set(["sum", "sum-long", "sum-asserted", "sum-pieces", "across"]);
function renderCode(pre) {
  const name = pre.dataset.src;
  const raw = name ? $(`#src-${name}`).textContent : pre.dataset.inline;
  const numbered = NUMBERED.has(name);
  const from = Number(pre.dataset.from || 1), to = Number(pre.dataset.to || Infinity);
  const hl = new Set((pre.dataset.hl || "").split(",").filter(Boolean).map(Number));
  const code = el("code");
  let n = Number(pre.dataset.start || 1);
  let open = false;
  for (const text of raw.split("\n")) {
    const marked = text.startsWith("§");
    const body = marked ? text.slice(1) : text;
    const isAssert = marked || open || body.trimStart().startsWith("{{");
    if (body.includes("{{")) open = true;
    if (body.includes("}}")) open = false;
    const ln = numbered && !marked ? n++ : null;
    if (ln !== null && (ln < from || ln > to)) continue;
    const row = el("span", { class: `ln${isAssert ? " assertion" : ""}${hl.has(ln) ? " hl" : ""}` });
    if (numbered) row.append(el("span", { class: "no", text: ln === null ? "" : String(ln) }));
    const src = el("span", { class: "src" });
    if (isAssert) src.textContent = body || " ";
    else src.append(highlightJava(body || " "));
    row.append(src);
    if (ln !== null) row.dataset.line = String(ln);
    code.append(row);
  }
  pre.replaceChildren(code);
  pre.tabIndex = 0;
}

/* =========================================================== terminal transcripts (Lecture 1 Sum) */
function renderTerm(box, input, variant = "orig", { clickable = false } = {}) {
  const r = runSum(variant, input);
  const pre = el("pre");
  const line = (text, cls) => { const s = el("span", { class: `tl ${cls || ""}`.trim(), text }); pre.append(s, "\n"); return s; };
  line("$ java Sum", "cmd");
  line(r.stdout[0], "stdout");
  if (input.length) for (const t of input.replace(/\n$/, "").split("\n")) line(t || " ", "typed");
  else line("(nothing typed: input ended at once)", "typed none");
  if (r.crash) r.stderr.forEach((t) => line(t, "err"));
  else {
    const got = line(r.stdout[1], "stdout"), sum = line(r.stdout[2], "stdout");
    if (clickable) {
      got.dataset.part = "got"; sum.dataset.part = "sum";
      [got, sum].forEach((s) => { s.tabIndex = 0; s.setAttribute("role", "button"); });
    }
  }
  box.replaceChildren(pre);
  return r;
}
function judge(r) {
  if (r.crash) return { cls: "bad", kind: "crash", text: `Counterexample. The run ends with ${r.crash.exception} and never prints a sum.` };
  const notes = [];
  let cls = "ok", kind = "true";
  if (r.ignored.length) {
    const t = r.stop.token;
    const dec = /^[-+]?\d*\.\d+$/.test(t);
    const why = r.stop.reason === "range" ? `${t} is too big for an int` : dec ? `${t} is not a whole number` : `"${t}" is not an int`;
    notes.push(`The user typed ${r.tokens.length} thing${r.tokens.length === 1 ? "" : "s"} and Sum read ${r.readCount}: it stopped because ${why}. The sentence never mentions this.`);
    cls = "warn"; kind = r.stop.reason === "range" ? "range" : dec ? "decimal" : "word";
  }
  if (r.wrapped) { notes.push(`The true sum is ${r.trueSum}, but Sum printed ${r.printedSum}: the int wrapped around.`); cls = "bad"; kind = r.trueSum > 0n ? "wrap-up" : "wrap-down"; }
  if (!notes.length) {
    if (!r.tokens.length) return { cls: "ok", kind: "empty", text: "True of this run, if we grant that an empty list has a sum of 0." };
    return { cls: "ok", kind: "true", text: "True of this run. That's one run out of infinitely many." };
  }
  return { cls, kind, text: (cls === "bad" ? "Counterexample. " : "Silent or wrong about this run. ") + notes.join(" ") };
}
function setupHero() {
  const input = $("#hero-input"), term = $("#hero-term"), verdict = $("#hero-verdict"), tally = $("#hero-tally");
  const seen = { ok: 0, warn: 0, bad: 0, n: 0 };
  function go(count = true) {
    const j = judge(renderTerm(term, input.value));
    verdict.className = `verdict ${j.cls}`; verdict.textContent = j.text;
    if (count) { seen.n++; seen[j.cls]++; tally.textContent = `Runs tried: ${seen.n} · true: ${seen.ok} · silent or wrong: ${seen.warn} · counterexamples: ${seen.bad}`; }
  }
  $("#hero-run").addEventListener("click", () => go());
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } });
  $$("#hero [data-try]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.try; go(); }));
  go(false);
}
function setupHunt() {
  const input = $("#hunt-input"), term = $("#hunt-term"), verdict = $("#hunt-verdict"), found = $("#hunt-found");
  const KINDS = { "wrap-down": "Overflow below the bottom of the range", decimal: "A decimal number", range: "A number too big for an int", "wrap-up": "Overflow past the top (the lecture's run)", word: "A word (the lecture's run)" };
  const got = new Set();
  const draw = () => {
    found.replaceChildren(el("span", { class: "where", text: `Kinds of trouble found: ${got.size} of ${Object.keys(KINDS).length}` }));
    for (const [k, label] of Object.entries(KINDS)) found.append(el("span", { class: `badge ${got.has(k) ? "on" : ""}`, text: label }));
  };
  function go() {
    const r = renderTerm(term, input.value);
    const j = judge(r);
    verdict.className = `verdict ${j.cls}`; verdict.textContent = j.text;
    if (KINDS[j.kind]) got.add(j.kind);
    if (r.wrapped && r.ignored.length) got.add(judge({ ...r, wrapped: false }).kind);
    draw();
  }
  $("#hunt-run").addEventListener("click", go);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } });
  draw();
  renderTerm(term, input.value);
}
const CLAUSES = {
  asks: ["The prompt comes first on every run, even when the user types nothing.", ""],
  whole: ["Only whole numbers are read. 2.5 is not one, so the loop stops before it and never reaches the 3.", "2.5 3"],
  range: ["2147483648 alone is too big for an int, so nothing at all is read. This is why the range clause is needed even for the input.", "2147483648"],
  order: ["The numbers are kept in the order typed, and reading continues across lines.", "5 1\n3"],
  stop: ["Reading stops at the first thing that is not such a number. Everything after it, even the 4, is ignored.", "1 2 three 4"],
  prints: ["Two lines after the prompt: the numbers read, then their sum.", "3 4 5"],
  wrap: ["The true sum 2147483648 is past the top of the range, so it wraps around to the bottom.", "2147483647 1"],
};
function setupSpecClauses() {
  const detail = $("#clause-detail");
  $$("#spec-text .clause").forEach((b) => {
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      $$("#spec-text .clause").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const [text, input] = CLAUSES[b.dataset.clause];
      const term = el("div", { class: "term small" });
      detail.replaceChildren(el("p", { text }), term);
      renderTerm(term, input);
    });
  });
}

/* =========================================================== Sum stepper */
// Steps one run of Lecture 1's Sum line by line. Inputs with more than STEP_LIMIT numbers are stepped
// only up to the limit, and then the stepper STOPS: it never shows points (1) or (2), a sum, or any
// "true on this run" verdict for a run it didn't finish.
const STEP_LIMIT = 12;
function traceSum(input) {
  const r = runSum("orig", input);
  const steps = [];
  const st = { list: null, sum: null, i: null, read: 0, out: [] };
  let stopped = false;
  const snap = (line, note, extra = {}) => steps.push({ line, note, stopped, list: st.list && [...st.list], sum: st.sum, i: st.i, read: st.read, out: [...st.out], ...extra });
  snap(7, "Create a Scanner on what the user types.");
  st.out.push(r.stdout[0]); snap(8, "Print the prompt.");
  st.list = []; snap(9, "list starts empty.");
  const truncated = r.list.length > STEP_LIMIT;
  for (let k = 0; ; k++) {
    if (k < r.list.length && k < STEP_LIMIT) {
      snap(10, `hasNextInt() is true: the next thing typed, ${r.tokens[k]}, is an int.`);
      st.list.push(r.list[k]); st.read++;
      snap(11, `nextInt() reads ${r.list[k]} and adds it to list.`);
    } else if (truncated) {
      snap(10, `Stepper stopped after ${STEP_LIMIT} of the ${r.list.length} numbers this run reads. The run itself goes on, but this stepper doesn't show the rest, so it says nothing about points (1) and (2) or the sum on this input. Use a shorter input to step all the way, or run the program on the home page or in "Every run" to see this run's output.`, { truncated: true });
      return { r, steps, truncated };
    } else {
      const why = !r.ignored.length ? "the input has ended" : r.stop.reason === "range" ? `${r.stop.token} is too big for an int` : `"${r.stop.token}" is not an int`;
      stopped = true;
      snap(10, `hasNextInt() is false: ${why}. The loop ends.`);
      break;
    }
  }
  snap(13, "Point (1).", { point: 1 });
  st.out.push(r.stdout[1]); snap(14, "Print list.");
  st.sum = 0n; snap(15, "sum starts at 0.");
  st.i = 0;
  for (;;) {
    if (st.i < st.list.length) {
      snap(16, `i < list.size() is true (${st.i} < ${st.list.length}).`);
      const before = st.sum;
      st.sum = BigInt.asIntN(32, st.sum + st.list[st.i]);
      const wrapped = st.sum !== before + st.list[st.i];
      snap(17, `sum += list.get(${st.i}): ${before} + ${st.list[st.i]} = ${st.sum}${wrapped ? " (wrapped around: the true value doesn't fit in an int)" : ""}.`);
      st.i++;
    } else { snap(16, `i < list.size() is false (${st.i} < ${st.list.length} fails). The loop ends.`); break; }
  }
  st.i = null;
  snap(19, "Point (2).", { point: 2 });
  st.out.push(`The sum of your list was: ${st.sum}`); snap(20, "Print sum. The run ends.", { end: true });
  return { r, steps, truncated: false };
}
function setupStepper() {
  const input = $("#st-input"), code = $("#st-code"), tokens = $("#st-tokens"), vars = $("#st-vars"), out = $("#st-out");
  const assertBox = $("#st-assert"), count = $("#st-count");
  const p1 = $("#st-p1"), p2 = $("#st-p2");
  let t, k;
  function load() { t = traceSum(input.value); k = 0; draw(); }
  function draw() {
    const s = t.steps[k];
    $$(".ln", code).forEach((row) => row.classList.toggle("cur", row.dataset.line === String(s.line)));
    const cur = $(".ln.cur", code);
    if (cur) code.scrollTo({ top: Math.max(0, cur.offsetTop - code.clientHeight / 2 + cur.clientHeight), behavior: reduceMotion() ? "auto" : "smooth" });
    tokens.replaceChildren();
    const toks = t.r.tokens;
    if (!toks.length) tokens.append(el("span", { class: "where", text: "(nothing was typed)" }));
    toks.slice(0, 40).forEach((tok, i) => tokens.append(el("span", { class: `tok ${i < s.read ? "used" : s.stopped && i === s.read ? "stopped" : ""}`, text: tok })));
    if (toks.length > 40) tokens.append(el("span", { class: "where", text: `… and ${toks.length - 40} more` }));
    vars.replaceChildren(
      el("tr", {}, el("th", { text: "list" }), el("td", { text: s.list ? `[${s.list.join(", ")}]` : "—" })),
      el("tr", {}, el("th", { text: "sum" }), el("td", { text: s.sum === null ? "—" : String(s.sum) })),
      el("tr", {}, el("th", { text: "i" }), el("td", { text: s.i === null ? "—" : String(s.i) })),
    );
    out.replaceChildren(el("pre", { text: s.out.join("\n") || " " }));
    assertBox.replaceChildren(el("p", { class: s.truncated ? "note trunc" : "note", text: `Line ${s.line}: ${s.note}` }));
    if (s.point === 1) {
      const before = t.r.ignored.length ? `before "${t.r.stop.token}"` : "before the input ended";
      assertBox.append(
        el("p", { class: "claim", text: "{{ list holds, in order, every number the user typed before the input ended or something that was not an int appeared }}" }),
        el("p", { class: "ok", text: `On this run: the numbers typed ${before} are [${t.r.list.join(", ")}], and list is [${s.list.join(", ")}]. True on this run.` }),
      );
    } else if (s.point === 2) {
      assertBox.append(
        el("p", { class: "claim", text: "{{ sum is the sum of the elements of list, wrapped into the int range if the true sum falls outside it }}" }),
        el("p", { class: "ok", text: `On this run: the true sum is ${t.r.trueSum}${t.r.wrapped ? `, which wraps to ${t.r.printedSum}` : ""}, and sum is ${s.sum}. True on this run.` }),
        el("p", { class: "claim", text: "{{ list still holds, in order, every number the user typed before … }}" }),
        el("p", { class: "ok", text: `list is still [${s.list.join(", ")}]: the summing loop only read it. True on this run.` }),
      );
    }
    if (s.point) assertBox.append(el("p", { class: "where", text: "True on this run is not the same as holds. Holding means true on every run, which takes an argument about the code." }));
    count.replaceChildren(`Step ${k + 1} of ${t.steps.length}`);
    if (t.truncated) count.append(" ", el("span", { class: "tag warn", text: `Truncated: first ${STEP_LIMIT} numbers only` }));
    $("#st-back").disabled = k === 0;
    $("#st-step").disabled = k === t.steps.length - 1;
    p1.disabled = p2.disabled = t.truncated;
    p1.title = p2.title = t.truncated ? `This input reads more than ${STEP_LIMIT} numbers, so the stepper stops before (1)` : "";
  }
  const toPoint = (p) => { const i = t.steps.findIndex((s) => s.point === p); if (i >= 0) { k = i; draw(); } };
  $("#st-step").addEventListener("click", () => { if (k < t.steps.length - 1) { k++; draw(); } });
  $("#st-back").addEventListener("click", () => { if (k > 0) { k--; draw(); } });
  p1.addEventListener("click", () => toPoint(1));
  p2.addEventListener("click", () => toPoint(2));
  $("#st-reset").addEventListener("click", load);
  input.addEventListener("input", load);
  $$("#stepper [data-st]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.st; load(); }));
  load();
}

function setupInOut() {
  const term = $("#inout-term"), detail = $("#inout-detail");
  renderTerm(term, "3 4 5", "orig", { clickable: true });
  const INFO = {
    got: ["Specification's first promise: it prints the numbers it read.", "Line 14 prints list.", "Why it keeps the promise: the assertion at (1) says list holds exactly the numbers read."],
    sum: ["Specification's second promise: then their sum, wrapped if need be.", "Line 20 prints sum.", "Why it keeps the promise: both assertions at (2). sum is the wrapped sum of list, and list still holds the numbers read."],
  };
  $$("[data-part]", term).forEach((s) => {
    const pick = () => {
      $$("[data-part]", term).forEach((x) => x.classList.toggle("picked", x === s));
      const [spec, line, why] = INFO[s.dataset.part];
      detail.replaceChildren(
        el("p", {}, el("span", { class: "tag ok", text: "Outside" }), " ", spec),
        el("p", {}, el("span", { class: "tag", text: "Code" }), " ", line),
        el("p", {}, el("span", { class: "tag gold", text: "Inside" }), " ", why),
      );
    };
    s.addEventListener("click", pick);
    s.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
  });
}
function setupEdge() {
  const code = $("#edge-code"), input = $("#edge-input"), term = $("#edge-term"), verdict = $("#edge-verdict");
  let variant = "orig";
  function go() {
    const r = renderTerm(term, input.value, variant);
    if (r.crash) { verdict.className = "verdict bad"; verdict.textContent = `The user sees a stack trace: a message meant for the programmer. "${r.crash.token}" reached nextInt() with no answer decided for it.`; }
    else if (r.ignored.length) { verdict.className = "verdict ok"; verdict.textContent = `Sum stops at "${r.stop.token}" and prints what it read, as its specification says.`; }
    else { verdict.className = "verdict"; verdict.textContent = "Every thing typed was an int, so both versions behave the same on this run."; }
  }
  $$("#edge-panel [data-guard]").forEach((b) => b.addEventListener("click", () => {
    variant = b.dataset.guard;
    $$("#edge-panel [data-guard]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $('.ln[data-line="10"] .src', code).replaceChildren(highlightJava(`        while (in.${variant === "orig" ? "hasNextInt" : "hasNext"}()) {`));
    $('.ln[data-line="10"]', code).classList.toggle("hl", variant !== "orig");
    go();
  }));
  $("#edge-run").addEventListener("click", go);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  go();
}
function setupSorter() {
  const out = $("#sort-out"), items = $$("#sort-list li");
  const LABEL = { run: "Run it", test: "Test it", reason: "Reason about it" };
  const answered = new Map();
  items.forEach((li, i) => {
    const row = el("div", { class: "row", role: "group", "aria-label": `Activity ${i + 1}` });
    const fb = el("span", { class: "fb" });
    for (const way of ["run", "test", "reason"]) {
      const b = el("button", { class: "chip", "aria-pressed": "false", text: LABEL[way] });
      b.addEventListener("click", () => {
        $$("button", row).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        const ok = way === li.dataset.way;
        answered.set(i, ok);
        fb.className = `fb ${ok ? "ok" : "bad"}`;
        fb.textContent = ok ? "Right." : way === "run" ? "Not quite: were these runs picked on purpose, or argued about?" : way === "test" ? "Not quite: is this checking chosen runs, or something else?" : "Not quite: is this an argument from the code, or watching runs?";
        const right = [...answered.values()].filter(Boolean).length;
        out.textContent = `${right} of ${items.length} right${answered.size === items.length && right === items.length ? ". Only the reasoning ones say anything about every run." : "."}`;
      });
      row.append(b);
    }
    li.append(row, fb);
  });
}
const MOTTO = {
  job: "Not the compiler's, a teammate's, or a tool's that wrote some of the code. The claim is yours, and so is coming to know it holds.",
  deliver: "The code goes to people who will type things you did not imagine. They are owed what the specification promises, not what you hoped the code would do.",
  know: "Having reasons, from tests and from arguments, that the code works.",
  works: "The code meets its specification, on every run and not only on the runs you tried.",
};
function setupMotto() {
  const detail = $("#word-detail");
  $$("#motto .word").forEach((b) => {
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      $$("#motto .word").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      detail.replaceChildren(el("p", {}, el("strong", { text: `${b.textContent}: ` }), MOTTO[b.dataset.word]));
    });
  });
}

/* =========================================================== Lecture 2 widgets */
function setupPieces() {
  const input = $("#pieces-input"), oldT = $("#pieces-old"), newT = $("#pieces-new"), verdict = $("#pieces-verdict");
  function go() {
    const a = renderTerm(oldT, input.value);
    const b = renderTerm(newT, input.value);
    const same = a.stdout.join("\n") === b.stdout.join("\n");
    verdict.className = `verdict ${same ? "ok" : "bad"}`;
    verdict.textContent = same ? "Same three lines on both. The prompt now comes before the Scanner is built, but a Scanner reads nothing until it's asked for a number." : "Different output.";
  }
  $("#pieces-run").addEventListener("click", go);
  $$("#pieces-panel [data-try]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.try; go(); }));
  go();
}
function parseIntList(text) {
  const s = String(text).trim().replace(/^[[{(]|[\]})]$/g, "").trim();
  if (!s) return [];
  const parts = s.split(/\s*,\s*|\s+/);
  const out = parts.map((p) => window.Grader.normalizeInt(p));
  if (out.some((v) => v === null || BigInt(v) > 2147483647n || BigInt(v) < -2147483648n)) return null;
  return out.map(Number);
}
const TAG_NOTES = {
  "@param": "Precondition, on one parameter: the client must pass a list that isn't null.",
  "@requires": "Precondition: the client must pass a list with an odd number of elements. On any other call, middle may do anything.",
  "@return": "Postcondition: what the method promises to return, on every call that keeps the precondition.",
  "Returns": "The opening sentence: what the method does, in one line.",
};
function setupMiddle() {
  const code = $("#middle-code"), detail = $("#middle-detail"), input = $("#middle-input"), out = $("#middle-out");
  $$(".ln", code).forEach((row) => {
    const text = row.textContent;
    const tag = Object.keys(TAG_NOTES).find((t) => text.includes(t));
    if (!tag) return;
    row.classList.add("clickable"); row.tabIndex = 0; row.setAttribute("role", "button");
    const pick = () => {
      $$(".ln.picked", code).forEach((r) => r.classList.remove("picked"));
      row.classList.add("picked");
      detail.replaceChildren(el("p", {}, el("strong", { text: tag.startsWith("@") ? `${tag}: ` : "" }), TAG_NOTES[tag]));
    };
    row.addEventListener("click", pick);
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
  });
  function go() {
    const list = parseIntList(input.value);
    if (!list) { out.className = "verdict-box bad"; out.textContent = "Type a list of ints, like [4, 8, 15]."; return; }
    const o = Sim.middle(list);
    const pre = Sim.middleSpec.pre(list);
    const res = "value" in o ? `returns ${o.value}` : `throws ${o.exception}`;
    out.className = `verdict-box ${pre ? "ok" : "warn"}`;
    out.textContent = pre
      ? `middle([${list.join(", ")}]) ${res}: ${(list.length - 1) / 2} elements before it and ${(list.length - 1) / 2} after. The call kept the precondition, and the method kept its promise.`
      : `middle([${list.join(", ")}]) ${res}. This call breaks @requires (${list.length} elements is not odd), so the specification promises nothing: middle still meets its specification, whatever it does here.`;
  }
  $("#middle-run").addEventListener("click", go);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  $$("#middle-panel [data-try]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.try; go(); }));
  go();
}
function setupBarrier() {
  const code = $("#barrier-code"), input = $("#barrier-input"), term = $("#barrier-term"), verdict = $("#barrier-verdict");
  let dir = "forward";
  const totals = (list, backward) => {
    const idx = list.map((_, i) => i); if (backward) idx.reverse();
    let s = 0n; const steps = [];
    for (const i of idx) { const before = s; s = BigInt.asIntN(32, s + list[i]); steps.push({ v: list[i], s, wrapped: s !== before + list[i] }); }
    return steps;
  };
  function go() {
    const r = runSum("orig", input.value);
    const sum = dir === "forward" ? Sim.sumForward(r.list.map(Number)) : Sim.sumBackward(r.list.map(Number));
    const pre = el("pre");
    const line = (t, c) => { pre.append(el("span", { class: `tl ${c}`, text: t }), "\n"); };
    line("$ java Sum", "cmd"); line("Enter some numbers.", "stdout");
    if (input.value.length) line(input.value, "typed"); else line("(nothing typed: input ended at once)", "typed none");
    line(`Got [${r.list.join(", ")}]`, "stdout"); line(`The sum of your list was: ${sum}`, "stdout");
    term.replaceChildren(pre);
    const steps = totals(r.list, dir === "backward");
    const other = dir === "forward" ? Sim.sumBackward(r.list.map(Number)) : Sim.sumForward(r.list.map(Number));
    verdict.className = "verdict ok";
    verdict.replaceChildren(
      `Running total, ${dir === "forward" ? "from the start" : "from the end"}: ${steps.length ? steps.map((s) => `${s.s}${s.wrapped ? " (wrapped)" : ""}`).join(" → ") : "0 (empty list)"}. `,
      `The other order also returns ${other}. main didn't change, and it didn't need a new argument: it relied only on sumList's promise.`,
    );
  }
  $$("#barrier [data-dir]").forEach((b) => b.addEventListener("click", () => {
    dir = b.dataset.dir;
    $$("#barrier [data-dir]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    code.dataset.src = dir === "forward" ? "sumlist-forward" : "sumlist-backward";
    renderCode(code);
    go();
  }));
  $("#barrier-run").addEventListener("click", go);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  go();
}
const SPEC_NAMES = ["A", "B", "C", "D", "E"];
const VERDICT_LABEL = { kept: "keeps", broken: "breaks", vacuous: "no promise" };
function setupLab() {
  const [aIn, loIn, hiIn, xIn] = ["#lab-a", "#lab-lo", "#lab-hi", "#lab-x"].map((s) => $(s));
  const out = $("#lab-out");
  function go() {
    const a = parseIntList(aIn.value);
    const [lo, hi, x] = [loIn, hiIn, xIn].map((i) => Number(i.value));
    if (!a || a.length > 12 || ![lo, hi, x].every(Number.isInteger) || Math.abs(lo) > 50 || Math.abs(hi) > 50) {
      out.replaceChildren(el("p", { class: "verdict bad", text: "Type an array of up to 12 ints like {5, 1, 5}, and whole numbers for lo, hi and x." }));
      return;
    }
    const table = el("table", { class: "lab-table" });
    table.append(el("tr", {}, el("th", { text: "" }), el("th", { text: "Outcome" }), ...SPEC_NAMES.map((s) => el("th", { text: s }))));
    for (const impl of [1, 2, 3, 4]) {
      const o = Sim.indexOf(impl, a, lo, hi, x);
      const row = el("tr", {}, el("th", { text: `Impl. ${impl}` }), el("td", { class: "outcome", text: "value" in o ? `returns ${o.value}` : `throws ${o.exception}` }));
      for (const s of SPEC_NAMES) {
        const j = Sim.judgeCall(s, a, lo, hi, x, o);
        row.append(el("td", { class: `v-${j.verdict}`, title: j.verdict === "broken" ? `${s} promises ${j.want}` : "", text: VERDICT_LABEL[j.verdict] }));
      }
      table.append(row);
    }
    const m = Sim.matches(a, lo, hi, x);
    const range = Sim.rangeOk(a, lo, hi);
    const note = !range
      ? `This call breaks 0 <= lo <= hi <= a.length, the precondition all five share, so no specification promises anything about it.`
      : m.length ? `Matches in the range: ${m.join(", ")}.` : `x doesn't occur in the range, so A's precondition fails and A promises nothing about this call.`;
    out.replaceChildren(el("div", { class: "table-scroll" }, table), el("p", { class: "where", text: `${note} One call can show that an implementation fails a specification; it can't show that it meets one.` }));
  }
  $("#lab-run").addEventListener("click", go);
  [aIn, loIn, hiIn, xIn].forEach((i) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); }));
  $$("#lab [data-call]").forEach((b) => b.addEventListener("click", () => {
    const [a, lo, hi, x] = b.dataset.call.split("|");
    aIn.value = a; loIn.value = lo; hiIn.value = hi; xIn.value = x; go();
  }));
  go();
}
// The slide "All five compared": row against column.
const STRENGTH = {
  A: { A: "X", B: "W", C: "W", D: "W", E: "W" },
  B: { A: "S", B: "X", C: "-", D: "S", E: "-" },
  C: { A: "S", B: "-", C: "X", D: "S", E: "-" },
  D: { A: "S", B: "W", C: "W", D: "X", E: "-" },
  E: { A: "S", B: "-", C: "-", D: "-", E: "X" },
};
const PAIR_WHY = {
  AB: "A asks more of its client (a match must exist) and, where a match exists, promises only some match. B asks less and promises the smallest. By the rule, B is stronger.",
  AC: "C asks less than A and, where a match exists, promises the largest, which is in particular a match. C is stronger.",
  AD: "Where x occurs, A and D promise the same: a match. Where it doesn't, a call breaks A's precondition and A promises nothing, while D promises -1. D is stronger.",
  AE: "E asks less than A and, where a match exists, promises the smallest match. E is stronger.",
  BC: "Same precondition. On an array with x twice, the smallest and largest matches differ: implementation 1 meets B and not C, implementation 4 meets C and not B. Incomparable.",
  BD: "Same precondition, and the smallest match is in particular some match. B is stronger.",
  BE: "Same precondition. Where x is absent, B promises -1 and E an exception; no implementation does both. Incomparable.",
  CD: "Same precondition, and the largest match is in particular some match. C is stronger.",
  CE: "Where x is absent, C promises -1 and E an exception; and where x occurs twice they want different matches. Incomparable.",
  DE: "Where x is absent, D promises -1 and E an exception; no implementation does both. Incomparable.",
};
const SYM = { S: "S", W: "W", "-": "—", X: "" };
const SYM_WORD = { S: "stronger than", W: "weaker than", "-": "incomparable with" };
function setupStrengthGrid() {
  const grid = $("#strength-grid"), detail = $("#strength-detail");
  const meets = Object.fromEntries([1, 2, 3, 4].map((i) => [i, Sim.meetsTable(i)]));
  const metBy = (s) => [1, 2, 3, 4].filter((i) => meets[i][s].meets);
  const cells = [];
  grid.append(el("tr", {}, el("th", { text: "" }), ...SPEC_NAMES.map((s) => el("th", { scope: "col", text: s }))));
  for (const r of SPEC_NAMES) {
    const tr = el("tr", {}, el("th", { scope: "row", text: r }));
    for (const c of SPEC_NAMES) {
      const v = STRENGTH[r][c];
      if (v === "X") { tr.append(el("td", { class: "diag", text: "" })); continue; }
      const b = el("button", { class: "cell", "aria-label": `${r} compared with ${c}`, text: "?" });
      b.addEventListener("click", () => { reveal(b, r, c, v); explain(r, c, v); });
      cells.push({ b, r, c, v });
      tr.append(el("td", {}, b));
    }
    grid.append(tr);
  }
  function reveal(b, r, c, v) { b.textContent = SYM[v]; b.classList.add("shown", `s-${v === "-" ? "inc" : v}`); }
  function explain(r, c, v) {
    const why = PAIR_WHY[[r, c].sort().join("")];
    detail.replaceChildren(
      el("p", {}, el("strong", { text: `${r} is ${SYM_WORD[v]} ${c}. ` }), why),
      el("p", { class: "where", text: `Of the four lecture implementations, ${r} is met by ${metBy(r).join(", ") || "none"} and ${c} by ${metBy(c).join(", ") || "none"} (computed in your browser on the lecture's test calls). Four implementations can show two specifications are incomparable, but "stronger" comes from the rule, not from them.` }),
    );
  }
  $("#strength-all").addEventListener("click", () => cells.forEach(({ b, r, c, v }) => reveal(b, r, c, v)));
  $("#strength-hide").addEventListener("click", () => { cells.forEach(({ b }) => { b.textContent = "?"; b.className = "cell"; }); detail.replaceChildren(el("p", { class: "where", text: "Click a cell." })); });
}
// count stepper: one call per step. count always finishes (each search starts past the last match),
// and the verdict appears only once the whole run has been shown.
function setupCount() {
  const aIn = $("#count-a"), xIn = $("#count-x"), list = $("#count-calls"), verdict = $("#count-verdict"), pos = $("#count-pos");
  let impl = 1, run = null, k = 0, a = [], x = 0;
  function load() {
    a = parseIntList(aIn.value); x = Number(xIn.value);
    if (!a || a.length > 12 || !Number.isInteger(x)) { run = null; list.replaceChildren(); verdict.className = "verdict-box bad"; verdict.textContent = "Type an array of up to 12 ints like {5, 1, 5, 2, 5} and a whole number x."; pos.textContent = ""; return; }
    run = Sim.count(impl, a, x); k = 0; draw();
  }
  function draw() {
    if (!run) return;
    list.replaceChildren();
    run.calls.slice(0, k).forEach((c, i) => {
      const o = c.outcome;
      const res = "value" in o ? String(o.value) : `throws ${o.exception}`;
      const after = "value" in o && o.value !== -1 ? `c becomes ${c.cBefore + 1}; next search starts at ${o.value + 1}` : "value" in o ? "the loop ends" : "count stops with the exception";
      list.append(el("li", {}, el("code", { text: `indexOf(a, ${c.lo}, ${c.hi}, ${x})` }), ` → ${res}`, el("span", { class: "where", text: ` · ${after}` })));
    });
    pos.textContent = `${k} of ${run.calls.length} calls shown`;
    $("#count-back").disabled = k === 0;
    $("#count-step").disabled = $("#count-end").disabled = k >= run.calls.length;
    if (k < run.calls.length) { verdict.className = "verdict-box"; verdict.textContent = k === 0 ? "Press Next call." : "The run isn't over yet."; return; }
    const truth = Sim.trueCount(a, x);
    if ("exception" in run.result) {
      verdict.className = "verdict-box warn";
      verdict.textContent = `count ends with ${run.result.exception}. Implementation ${impl} doesn't meet D (or B), so count was never promised anything about it.`;
    } else {
      const okRun = run.result.value === truth;
      verdict.className = `verdict-box ${okRun ? "ok" : "bad"}`;
      verdict.textContent = `count returns ${run.result.value}; x occurs ${truth} time${truth === 1 ? "" : "s"}. ${okRun ? "Right on this run." : `Wrong. Implementation ${impl} meets D, so count is wrong against D.`}`;
    }
  }
  $$("#count-panel [data-impl]").forEach((b) => b.addEventListener("click", () => {
    impl = Number(b.dataset.impl);
    $$("#count-panel [data-impl]").forEach((x2) => x2.setAttribute("aria-pressed", String(x2 === b)));
    load();
  }));
  $("#count-step").addEventListener("click", () => { if (run && k < run.calls.length) { k++; draw(); } });
  $("#count-back").addEventListener("click", () => { if (run && k > 0) { k--; draw(); } });
  $("#count-end").addEventListener("click", () => { if (run) { k = run.calls.length; draw(); } });
  [aIn, xIn].forEach((i) => i.addEventListener("input", load));
  load();
}

/* =========================================================== step reveals and run buttons */
function setupSteps() {
  $$(".steps").forEach((steps) => {
    const items = $$(":scope > ol > li", steps);
    let shown = 0;
    const bar = el("div", { class: "step-bar" });
    const next = el("button", { class: "btn primary", text: "Show next step" });
    const all = el("button", { class: "btn", text: "Show all" });
    const reset = el("button", { class: "btn", text: "Hide steps" });
    const count = el("span", { class: "count" });
    bar.append(next, all, reset, count);
    steps.append(bar);
    function render(justShown) {
      items.forEach((li, i) => { li.hidden = i >= shown; li.classList.toggle("just-shown", i === justShown); });
      next.disabled = shown >= items.length;
      next.textContent = shown === 0 ? "Show first step" : shown >= items.length ? "All steps shown" : "Show next step";
      count.textContent = `${shown} of ${items.length} steps shown`;
    }
    steps._reveal = () => { if (shown < items.length) { shown++; render(shown - 1); } };
    next.addEventListener("click", steps._reveal);
    all.addEventListener("click", () => { shown = items.length; render(-1); });
    reset.addEventListener("click", () => { shown = 0; render(-1); });
    render(-1);
  });
}
function setupRunButtons() {
  $$("[data-run]").forEach((b) => b.addEventListener("click", () => {
    const outBox = $(".run-out", b.closest(".solution"));
    const term = el("div", { class: "term small" });
    outBox.replaceChildren(el("p", { class: "where", text: b.dataset.run === "orig" ? "Sum, as in the lecture:" : `${window.SumSim.VARIANTS[b.dataset.run].label}:` }), term);
    renderTerm(term, b.dataset.input, b.dataset.run);
  }));
  $$("[data-run-max]").forEach((b) => b.addEventListener("click", () => {
    const list = JSON.parse(b.dataset.runMax);
    const o = Sim.maxList(list);
    $(".run-out", b.closest(".solution")).replaceChildren(el("div", { class: "term small" }, el("pre", { text: `maxList([${list.join(", ")}])\n${"value" in o ? `returns ${o.value}` : `Exception: java.lang.${o.exception}: ${o.message}`}` })));
  }));
  $$("[data-run-sign]").forEach((b) => b.addEventListener("click", () => {
    const x = Number(b.dataset.runSign);
    const o = Sim.sign(3, x);
    $(".run-out", b.closest(".solution")).replaceChildren(el("div", { class: "term small" }, el("pre", { text: `x / Math.abs(x) with x = ${x}\n${"value" in o ? `returns ${o.value}` : `Exception: java.lang.${o.exception}: ${o.message}`}` })));
  }));
  $$("[data-brute]").forEach((btn) => {
    const out = btn.nextElementSibling;
    btn.addEventListener("click", () => {
      out.className = "brute"; out.textContent = "Running every call…"; btn.disabled = true;
      setTimeout(() => {
        const t0 = performance.now();
        const want = { 1: "ABD", 2: "AE", 3: "A", 4: "ACD" };
        let calls = 0; for (const _ of Sim.lectureDomain()) calls++;
        const rows = [1, 2, 3, 4].map((i) => { const t = Sim.meetsTable(i); return [i, SPEC_NAMES.filter((s) => t[s].meets).join("")]; });
        const ok = rows.every(([i, got]) => got === want[i]);
        btn.disabled = false;
        out.className = `brute ${ok ? "ok" : ""}`;
        out.textContent = `Ran ${calls.toLocaleString("en-US")} calls per implementation in ${Math.round(performance.now() - t0)} ms. Meets: ${rows.map(([i, g]) => `${i}: ${g.split("").join(" ")}`).join(" · ")}. ${ok ? "Matches the lecture's table." : "Doesn't match the lecture's table."}`;
      }, 30);
    });
  });
}

/* =========================================================== grading helpers */
const keyFor = (id) => { const k = KEYS[id]; if (!k) throw new Error(`no answer key for ${id}`); return k; };
const nowISO = () => new Date().toISOString();

/* =========================================================== drafts, invalidation, flushing
   Every graded input on the site (quiz numeric + MC, quick checks, problem parts of every grader kind,
   problem self-check parts) goes through these. Widgets (hero, hunt, stepper, call lab, strength grid,
   count stepper, sorter, motto, clause explorer, ...) keep no saved state and aren't graded.
   - An edit keeps the draft and clears the current grade (CourseStore.invalidateCurrentGrade), in the
     snapshot and the DOM at once. The snapshot write is debounced; the local mirror gets it on flush.
   - Before ANY repaint from the store (Check, reveal, hint, solution, self-mark, clear, start over, a
     conflict merge, import) and on pagehide / visibilitychange / route change, flushPendingInput() writes
     every pending draft synchronously, so a repaint can never read a stale snapshot over typed text.
   - attempts[] and events[] are only appended (store.attempt / store.event), never edited here. */
const ITEMS = new Map(); // item id -> { flush(): void } for items with pending drafts
function flushPendingInput(id) {
  if (id) { const it = ITEMS.get(id); if (it) it.flush(); return; }
  ITEMS.forEach((it) => it.flush());
}
// A debounced draft writer for one item. write() is the synchronous snapshot write.
function draftWriter(id, write) {
  const d = debounce(write, 300);
  ITEMS.set(id, { flush: () => d.flush() });
  return d;
}

/* =========================================================== quick checks */
function setupChecks() {
  $$(".check[data-id]").forEach((box) => {
    const id = box.dataset.id;
    const key = keyFor(id);
    const input = $("input", box), fb = $(".feedback", box), button = $("button.primary", box);
    const blank = () => ({ kind: "quickcheck", raw: "", normalized: null, correct: null, tries: 0, firstTryCorrect: null });
    const state = () => ({ ...blank(), ...store.get(id) });
    let dirty = false;
    const saveDraft = draftWriter(id, () => {
      if (!dirty) return;
      dirty = false;
      const s = state();
      s.raw = input.value;
      window.CourseStore.invalidateCurrentGrade(s);
      store.put(id, s);
    });
    input.addEventListener("input", () => {
      dirty = true;
      fb.className = "feedback"; fb.textContent = "";
      saveDraft();
    });
    const check = () => {
      flushPendingInput(id);
      if (!input.value.trim()) { fb.className = "feedback"; fb.textContent = "Type an answer first."; return; }
      const g = window.Grader.grade(key, input.value);
      const s = state();
      s.raw = input.value;
      if (g.status !== "unreadable") {
        s.tries++;
        s.normalized = g.normalized;
        s.correct = g.status === "correct";
        if (s.firstTryCorrect === null) s.firstTryCorrect = s.correct;
      }
      store.attempt(id, {
        kind: "check",
        answer: { raw: input.value, normalized: g.normalized },
        result: { overall: g.status, correct: g.status === "unreadable" ? null : g.status === "correct" },
        feedbackKind: g.feedbackKind,
        hintsRevealedAtSubmit: 0,
        solutionViewedBeforeSubmit: false,
      });
      store.put(id, s);
      fb.className = `feedback ${g.status === "correct" ? "ok" : "bad"}`;
      fb.textContent = g.status === "unreadable" ? `Couldn't read that. ${g.message}` : g.message;
    };
    button.addEventListener("click", check);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
    const restore = () => {
      const s = store.get(id);
      if (!s) { input.value = ""; fb.className = "feedback"; fb.textContent = ""; return; }
      if (document.activeElement !== input) input.value = s.raw || "";
      fb.className = `feedback ${s.correct === true ? "ok" : s.correct === false ? "bad" : ""}`;
      fb.textContent = s.correct === true ? "Correct." : s.correct === false ? "Last try: not quite." : "";
    };
    RESTORERS.set(id, () => { flushPendingInput(id); restore(); });
    restore();
  });
}

/* =========================================================== problems */
function statusOf(s, hasAuto, hasSelf) {
  if (s.result === "incorrect" || s.result === "partial" || s.selfMark === "missed") return ["Not yet", "bad"];
  const autoOk = !hasAuto || s.result === "correct";
  const selfOk = !hasSelf || s.selfMark === "got";
  if (autoOk && selfOk) return ["Correct", "ok"];
  if (s.solutionViewed) return ["Solution viewed", "seen"];
  if (s.result === "correct") return ["Answers right · mark the rest", "prog"];
  if (Object.values(s.parts || {}).some((p) => p.raw) || (s.work || "").trim() || s.hintsRevealed) return ["In progress", "prog"];
  return ["Not started", ""];
}
const TASKS = new Map();
function buildTask(task) {
  const id = task.dataset.id;
  const title = $("h2", task).textContent;
  const specs = $$(".answer-spec", task);
  const parts = specs.map((spec) => ({ spec, part: spec.dataset.part, pid: `${id}.${spec.dataset.part}`, type: spec.dataset.type }));
  const auto = parts.filter((p) => p.type !== "self");
  const self = parts.filter((p) => p.type === "self");
  const hasAuto = auto.length > 0, hasSelf = self.length > 0;
  auto.forEach((p) => keyFor(p.pid));
  const hintList = $(".hints", task);
  const hintItems = hintList ? $$("li", hintList) : [];
  const solution = $(".solution", task);
  const blank = () => ({ kind: "problem", parts: {}, work: "", result: null, selfMark: null, checks: 0, hintsRevealed: 0, solutionViewed: false, solutionOpen: false });
  let state = { ...blank(), ...store.get(id) };

  const pill = el("span", { class: "pill" });
  $("h2", task).append(" ", pill);
  const myWork = el("div", { class: "my-work" });
  task.insertBefore(myWork, specs[0]);
  const rows = el("div", { class: "ans-rows" });
  myWork.append(rows);
  const inputs = parts.map((p, i) => {
    const inputId = `${p.pid}-input`.replace(/\./g, "--");
    const isSelf = p.type === "self";
    const label = p.spec.dataset.label || (parts.length === 1 ? "Your answer" : `Part ${i + 1}`);
    const input = isSelf
      ? el("textarea", { id: inputId, rows: "3", spellcheck: "true", placeholder: p.spec.dataset.placeholder || "your answer" })
      : el("input", { type: "text", id: inputId, autocomplete: "off", spellcheck: "false", placeholder: p.spec.dataset.placeholder || "" });
    p.spec.classList.add("ans-row");
    if (isSelf) p.spec.classList.add("self");
    p.spec.dataset.itemId = p.pid;
    const partFb = el("p", { class: "part-fb", role: "status" });
    p.spec.append(el("label", { for: inputId, text: label }), input);
    if (isSelf) p.spec.append(el("span", { class: "where", text: "check yourself against the solution" }));
    p.spec.append(partFb);
    p.fb = partFb;
    rows.append(p.spec);
    input.addEventListener("input", () => {
      state.parts = { ...state.parts, [p.pid]: { ...(state.parts[p.pid] || {}), raw: input.value } };
      window.CourseStore.invalidateCurrentGrade(state, { pid: p.pid, self: isSelf });
      input.classList.remove("ok", "bad");
      partFb.textContent = ""; partFb.className = "part-fb";
      if (!state.result) { fb.textContent = ""; fb.className = "feedback"; }
      render();
      updateProgress();
      saveSoon();
    });
    if (!isSelf) input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
    return input;
  });

  const checkBar = el("div", { class: "row" });
  const checkBtn = el("button", { class: "btn primary check-btn", text: auto.length > 1 ? "Check answers" : "Check" });
  const fb = el("p", { class: "feedback", role: "status" });
  if (hasAuto) checkBar.append(checkBtn);
  myWork.append(checkBar, fb);
  const workId = `${id}--work`;
  const work = el("textarea", { id: workId, rows: "4", placeholder: "Explain how you got your answer: runs, calls, reasons, counterexamples." });
  myWork.append(el("label", { class: "work-label", for: workId, text: "Your work" }), work);
  work.addEventListener("input", () => { state.work = work.value; saveSoon(); });

  const actions = el("div", { class: "task-actions" });
  const hintBtn = el("button", { class: "btn hint-btn" });
  const solBtn = el("button", { class: "btn sol-btn" });
  const clearBtn = el("button", { class: "btn quiet", text: "Clear my work" });
  if (hintItems.length) actions.append(hintBtn);
  actions.append(solBtn, clearBtn);
  task.insertBefore(actions, hintList || solution);
  const selfMark = el("div", { class: "self-mark" });
  const gotBtn = el("button", { class: "chip", text: "I got it" });
  const missBtn = el("button", { class: "chip", text: "I missed something" });
  selfMark.append(el("span", { text: hasAuto ? "How did your written answers go? " : "How did you do? " }), gotBtn, missBtn);
  if (hasSelf) solution.after(selfMark);
  let armed = false;

  function render() {
    const [label, cls] = statusOf(state, hasAuto, hasSelf);
    pill.textContent = label; pill.className = `pill ${cls}`;
    hintItems.forEach((li, i) => { li.hidden = i >= state.hintsRevealed; });
    if (hintList) hintList.hidden = state.hintsRevealed === 0;
    const n = hintItems.length, k = state.hintsRevealed;
    hintBtn.textContent = k === 0 ? `Need a hint? (${n} available)` : k < n ? `Another hint (${k} of ${n} shown)` : `All ${n} hints shown`;
    hintBtn.disabled = k >= n;
    solution.hidden = !state.solutionOpen;
    solBtn.textContent = state.solutionOpen ? "Hide solution" : armed ? "Show solution anyway" : "Show solution";
    selfMark.hidden = !state.solutionOpen;
    gotBtn.setAttribute("aria-pressed", String(state.selfMark === "got"));
    missBtn.setAttribute("aria-pressed", String(state.selfMark === "missed"));
  }
  const save = () => { store.put(id, state); render(); updateProgress(); };
  const saveSoon = draftWriter(id, save);

  function submitContext() { return { hintsRevealedAtSubmit: state.hintsRevealed, solutionViewedBeforeSubmit: state.solutionViewed }; }
  function check() {
    flushPendingInput(id);
    const empty = auto.filter((p, i) => !inputs[parts.indexOf(p)].value.trim());
    if (empty.length) {
      fb.className = "feedback";
      fb.textContent = auto.length > 1 ? "Fill in every answer box first." : "Type an answer first.";
      return;
    }
    const answer = { parts: {} }, result = { parts: {} }, kinds = {};
    let right = 0, unread = 0;
    for (const p of auto) {
      const input = inputs[parts.indexOf(p)];
      const g = window.Grader.grade(keyFor(p.pid), input.value);
      answer.parts[p.pid] = { raw: input.value, normalized: g.normalized };
      const correct = g.status === "unreadable" ? null : g.status === "correct";
      result.parts[p.pid] = correct;
      kinds[p.pid] = g.feedbackKind;
      state.parts[p.pid] = { raw: input.value, normalized: g.normalized, correct };
      input.classList.toggle("ok", correct === true);
      input.classList.toggle("bad", correct !== true);
      p.fb.className = `part-fb ${correct ? "ok" : "bad"}`;
      p.fb.textContent = correct ? (p.type === "witness" ? g.message : "") : g.status === "unreadable" ? `Couldn't read that. ${g.message}` : g.message;
      if (correct) right++;
      if (correct === null) unread++;
    }
    for (const p of self) answer.parts[p.pid] = { raw: inputs[parts.indexOf(p)].value, normalized: null };
    const overall = unread ? "unreadable" : right === auto.length ? "correct" : right === 0 ? "incorrect" : "partial";
    result.overall = overall;
    store.attempt(id, { kind: "check", answer, result, feedbackKind: kinds, ...submitContext() });
    state.checks++;
    if (overall !== "unreadable") state.result = overall;
    fb.className = `feedback ${overall === "correct" ? "ok" : "bad"}`;
    fb.textContent = overall === "correct"
      ? (hasSelf ? "Correct. Compare your written parts with the solution." : "Correct.")
      : overall === "unreadable" ? "Some answers couldn't be read. See the notes under them."
      : auto.length > 1 ? `${right} of ${auto.length} right. The boxes in red need another look; the notes under them say why.` : "Not quite. The note above says what to look at, or ask for a hint.";
    save();
  }
  function selfMarkPress(mark) {
    flushPendingInput(id);
    state.selfMark = mark;
    const answer = { parts: {} }, result = { parts: {}, overall: mark === "got" ? "self-correct" : "self-incorrect" };
    for (const p of self) { answer.parts[p.pid] = { raw: inputs[parts.indexOf(p)].value, normalized: null }; result.parts[p.pid] = mark === "got"; }
    store.attempt(id, { kind: "self-mark", answer, result, feedbackKind: "self-reported", ...submitContext() });
    save();
  }
  checkBtn.addEventListener("click", check);
  hintBtn.addEventListener("click", () => {
    flushPendingInput(id);
    state.hintsRevealed = Math.min(hintItems.length, state.hintsRevealed + 1);
    hintItems[state.hintsRevealed - 1].classList.add("just-shown");
    store.event(id, "hint", { level: state.hintsRevealed, of: hintItems.length });
    save();
  });
  solBtn.addEventListener("click", () => {
    flushPendingInput(id);
    if (state.solutionOpen) { state.solutionOpen = false; store.event(id, "solution-hide"); save(); return; }
    const tried = inputs.some((x) => x.value.trim()) || work.value.trim();
    if (!tried && !armed && !state.solutionViewed) {
      armed = true;
      fb.className = "feedback";
      fb.textContent = "You haven't answered yet. Press the button again to see the solution anyway.";
      render();
      return;
    }
    armed = false;
    state.solutionOpen = true; state.solutionViewed = true;
    if (fb.textContent.startsWith("You haven't answered")) fb.textContent = "";
    store.event(id, "solution-view", { attemptedFirst: Boolean(tried) });
    save();
  });
  gotBtn.addEventListener("click", () => selfMarkPress("got"));
  missBtn.addEventListener("click", () => selfMarkPress("missed"));
  clearBtn.addEventListener("click", () => {
    if (!confirm(`Clear your answers, work, hints and solution view for "${title}"? (Your past checks stay in your history.)`)) return;
    flushPendingInput(id);
    store.event(id, "clear");
    store.reset([id], "clear-item");
    restore();
    updateProgress();
  });
  function restore() {
    state = { ...blank(), ...store.get(id) };
    parts.forEach((p, i) => {
      const s = state.parts[p.pid] || {};
      if (document.activeElement !== inputs[i]) inputs[i].value = s.raw || "";
      inputs[i].classList.toggle("ok", s.correct === true);
      inputs[i].classList.toggle("bad", s.correct === false);
      p.fb.textContent = ""; p.fb.className = "part-fb";
    });
    if (document.activeElement !== work) work.value = state.work || "";
    armed = false;
    fb.className = `feedback ${state.result === "correct" ? "ok" : state.result ? "bad" : ""}`;
    fb.textContent = state.result === "correct" ? "Checked: correct." : state.result ? "Last check: not right yet." : "";
    render();
  }
  const submitted = () => store.attemptsOf(id).length > 0;
  TASKS.set(id, { restore, get state() { return state; }, hasAuto, hasSelf, submitted });
  RESTORERS.set(id, () => { flushPendingInput(id); restore(); updateProgress(); });
  restore();
}
function updateProgress() {
  $$(".task-progress").forEach((bar) => {
    const ts = $$(".task[data-id]", bar.closest(".page")).map((t) => TASKS.get(t.dataset.id));
    // answered = submitted at least once (a Check press or a self-mark), right or wrong;
    // correct = the current answers are graded correct; solution views don't count as answered
    const answered = ts.filter((t) => t.submitted()).length;
    const correct = ts.filter((t) => statusOf(t.state, t.hasAuto, t.hasSelf)[0] === "Correct").length;
    const seen = ts.filter((t) => t.state.solutionViewed).length;
    $(".progress-text", bar).textContent = `${answered} of ${ts.length} answered · ${correct} correct now · ${seen} solution${seen === 1 ? "" : "s"} viewed`;
  });
}
function setupTasks() {
  $$(".task[data-id]").forEach(buildTask);
  $$(".page").forEach((page) => {
    if (!$(".task[data-id]", page)) return;
    const bar = el("div", { class: "task-progress" });
    const clearAll = el("button", { class: "btn quiet", text: "Clear all on this page" });
    bar.append(el("p", { class: "progress-text", role: "status" }), el("div", { class: "row" }, clearAll));
    page.insertBefore(bar, $(".task[data-id]", page));
    clearAll.addEventListener("click", () => {
      if (!confirm("Clear every answer and all work on this page? Your past checks stay in your history.")) return;
      flushPendingInput();
      const ids = $$(".task[data-id]", page).map((t) => t.dataset.id);
      ids.forEach((tid) => store.event(tid, "clear"));
      store.reset(ids, "clear-page");
      ids.forEach((tid) => TASKS.get(tid).restore());
      updateProgress();
    });
  });
  updateProgress();
}

/* =========================================================== check your understanding */
function setupQuizzes() {
  $$(".page").forEach((page) => {
    const items = $$(".cyu[data-id]", page);
    if (!items.length) return;
    const score = $('[data-role="score"]', page), summary = $('[data-role="summary"]', page);
    const blank = () => ({ kind: "quiz", choiceId: null, raw: "", normalized: null, correct: null, tries: 0, firstTryCorrect: false, done: false, revealed: false });
    const stateOf = (li) => ({ ...blank(), ...store.get(li.dataset.id) });
    function update() {
      const all = items.map(stateOf);
      // answered = submitted at least once (any Check, right or wrong); Show answer alone doesn't count.
      // done = correct now or revealed: it gates the end-of-quiz review summary.
      const answered = items.filter((li) => store.attemptsOf(li.dataset.id).length > 0).length;
      const done = all.filter((s) => s.done).length, first = all.filter((s) => s.firstTryCorrect).length;
      score.textContent = `Answered ${answered} of ${items.length} · ${first} correct on the first try`;
      summary.replaceChildren();
      if (done < items.length) { summary.textContent = `Finish all ${items.length} to see what to review.`; return; }
      const missed = [...new Set(items.filter((li, i) => !all[i].firstTryCorrect).map((li) => li.dataset.topic))];
      summary.append(el("strong", { text: `You got ${first} of ${items.length} on the first try. ` }));
      if (!missed.length) summary.append("Nothing to review.");
      else {
        summary.append("Worth another look: ");
        missed.forEach((tid, k) => { const pg = PAGES.find((p) => p.id === tid); summary.append(el("a", { href: `#${tid}`, text: pg ? pg.title : tid })); if (k < missed.length - 1) summary.append(", "); });
        summary.append(".");
      }
      const again = el("button", { class: "btn", text: "Start over" });
      again.addEventListener("click", () => {
        flushPendingInput();
        items.forEach((li) => store.event(li.dataset.id, "clear"));
        store.reset(items.map((li) => li.dataset.id), "quiz-start-over");
        items.forEach((li) => li._paint());
        update();
        window.scrollTo(0, page.offsetTop);
      });
      summary.append(" ", again);
    }
    function paint(li, fb, input) {
      const s = stateOf(li);
      const key = KEYS[li.dataset.id];
      $$("label[data-option]", li).forEach((l) => {
        const oid = l.dataset.option;
        const isRight = oid === key.answer;
        $("input", l).checked = s.choiceId === oid;
        l.classList.toggle("right", (s.choiceId === oid && s.correct === true) || (s.revealed && isRight));
        l.classList.toggle("wrong", s.choiceId === oid && s.correct === false);
        const why = $(".why", l);
        if (why) why.hidden = !(s.choiceId === oid && s.correct !== null) && !(s.revealed && isRight);
      });
      if (input && document.activeElement !== input) input.value = s.raw;
      const why = $(":scope > .why", li);
      if (why) why.hidden = !(s.revealed || s.correct);
      li.classList.toggle("is-right", s.correct === true);
      if (s.correct === true) { fb.className = "feedback ok"; fb.textContent = "Correct."; }
      else if (s.revealed) { fb.className = "feedback"; fb.textContent = li.dataset.format === "num" ? `Answer: ${key.answer}.` : ""; }
      else if (s.correct === false) { fb.className = "feedback bad"; fb.textContent = li.dataset.format === "mc" ? "Not this one. Read why, then try another." : (s.lastMessage || "Not quite. Try again, or press Show answer."); }
      else { fb.className = "feedback"; fb.textContent = ""; }
    }
    items.forEach((li, idx) => {
      const id = li.dataset.id;
      const key = keyFor(id);
      const bar = el("div", { class: "row" });
      const check = el("button", { class: "btn primary check-btn", text: "Check" });
      const showBtn = el("button", { class: "btn", text: "Show answer" });
      const fb = el("p", { class: "feedback", role: "status" });
      let input = null;
      const radios = $$("label[data-option] input", li);
      const selected = () => { const l = $$("label[data-option]", li).find((x) => $("input", x).checked); return l ? l.dataset.option : null; };
      let dirty = false;
      const saveDraft = draftWriter(id, () => {
        if (!dirty) return;
        dirty = false;
        const s = stateOf(li);
        if (input) s.raw = input.value; else s.choiceId = selected();
        window.CourseStore.invalidateCurrentGrade(s);
        store.put(id, s);
      });
      const onEdit = () => {
        dirty = true;
        // clear the current grade in the DOM now: feedback, option marks, explanations, the "right" stripe
        fb.className = "feedback"; fb.textContent = "";
        li.classList.remove("is-right");
        $$("label[data-option]", li).forEach((l) => { l.classList.remove("right", "wrong"); const w = $(".why", l); if (w) w.hidden = true; });
        const w = $(":scope > .why", li); if (w) w.hidden = true;
        saveDraft();
      };
      if (li.dataset.format === "num") {
        input = el("input", { type: "text", "aria-label": `Answer to question ${idx + 1}`, autocomplete: "off" });
        bar.append(input);
        input.addEventListener("input", onEdit);
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") check.click(); });
      } else {
        radios.forEach((r) => r.addEventListener("change", onEdit));
      }
      bar.append(check, showBtn);
      const why = $(":scope > .why", li);
      li.insertBefore(bar, why || null);
      li.insertBefore(fb, why || null);
      li._paint = () => paint(li, fb, input);
      check.addEventListener("click", () => {
        flushPendingInput(id);
        const s = stateOf(li);
        let g, answer;
        if (li.dataset.format === "mc") {
          const chosen = $$("label[data-option]", li).find((l) => $("input", l).checked);
          if (!chosen) { fb.className = "feedback"; fb.textContent = "Pick an option first."; return; }
          g = window.Grader.grade(key, chosen.dataset.option);
          if (g.status === "incorrect") g.feedbackKind = chosen.dataset.misconception || "incorrect";
          s.choiceId = chosen.dataset.option;
          answer = { choiceId: chosen.dataset.option, choiceIndex: $$("label[data-option]", li).indexOf(chosen), raw: chosen.dataset.option, normalized: chosen.dataset.option };
        } else {
          if (!input.value.trim()) { fb.className = "feedback"; fb.textContent = "Type an answer first."; return; }
          g = window.Grader.grade(key, input.value);
          s.raw = input.value;
          answer = { raw: input.value, normalized: g.normalized };
        }
        store.attempt(id, {
          kind: "check", answer,
          result: { overall: g.status, correct: g.status === "unreadable" ? null : g.status === "correct" },
          feedbackKind: g.feedbackKind,
          hintsRevealedAtSubmit: 0,
          solutionViewedBeforeSubmit: s.revealed,
        });
        if (g.status === "unreadable") { fb.className = "feedback bad"; fb.textContent = `Couldn't read that. ${g.message}`; return; }
        s.normalized = g.normalized;
        s.correct = g.status === "correct";
        s.lastMessage = s.correct ? null : g.message;
        if (!s.done) { s.tries++; if (s.correct) { s.done = true; if (s.tries === 1) s.firstTryCorrect = true; } }
        store.put(id, s);
        li._paint();
        update();
      });
      showBtn.addEventListener("click", () => {
        flushPendingInput(id);
        const s = stateOf(li);
        if (!s.done) { s.done = true; s.tries++; }
        s.revealed = true;
        store.event(id, "reveal");
        store.put(id, s);
        li._paint();
        update();
      });
      RESTORERS.set(id, () => { flushPendingInput(id); li._paint(); update(); });
      li._paint();
    });
    update();
  });
}

/* =========================================================== host API (no UI) */
window.CourseSite = {
  siteId: window.CourseStore.SITE_ID,
  schemaVersion: window.CourseStore.SCHEMA_VERSION,
  storage: () => store.adapterName(),
  exportState: () => store.exportState(),
  async importState(data) { flushPendingInput(); const status = await store.importState(data); RESTORERS.forEach((r) => r()); return status; },
  flush: () => { flushPendingInput(); return store.flush(); },
  pending: () => store.pending(),
  stats: () => store.stats(),
  attemptsOf: (id) => store.attemptsOf(id),
  eventsOf: (id) => store.eventsOf(id),
  ready: null,
};

/* =========================================================== boot */
function boot() {
  store.start();
  window.CourseSite.ready = store.ready;
  $$("pre.code").forEach(renderCode);
  buildPagers();
  $$(".term[data-input]").forEach((box) => renderTerm(box, box.dataset.input));
  setupHero(); setupHunt(); setupSpecClauses(); setupStepper(); setupInOut(); setupEdge(); setupSorter(); setupMotto();
  setupPieces(); setupMiddle(); setupBarrier(); setupLab(); setupStrengthGrid(); setupCount();
  setupTasks(); setupSteps(); setupRunButtons(); setupChecks(); setupQuizzes();
  addEventListener("pagehide", () => flushPendingInput());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushPendingInput(); });
  addEventListener("hashchange", () => { flushPendingInput(); show(location.hash.slice(1)); });
  show(location.hash.slice(1) || "home");
  document.documentElement.dataset.ready = "true";
}
boot();
