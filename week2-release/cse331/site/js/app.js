/* CSE 331 week 2 site: routing, widgets, answer checking UI, and the bridge to js/store.js.
   State lives only in the store (window.CourseStore). This file reads it with store.get / attemptsOf and
   writes it with store.put (latest snapshot), store.attempt (one per Check press, sorter choice or self-mark)
   and store.event (hint reveals, solution views, reveals, clears). See ../INTEGRATION.md.
   The terminals, runner and shell run window.SumSim, a model of tests/java/Sum.java checked against real Java. */
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
const S = window.SumSim;
const KEYS = window.ANSWER_KEYS;
const SRC = $("#src-sum").textContent.replace(/^\n/, "").replace(/\n$/, "").split("\n");
const srcLine = (n) => (SRC[n - 1] || "").trim();

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
  document.title = `${PAGES.find((p) => p.id === id).title} · CSE 331 week 2`;
  closeMenu();
  // The page sections carry the route ids, so the browser also scrolls to the fragment; undo that after it.
  window.scrollTo(0, 0);
  requestAnimationFrame(() => window.scrollTo(0, 0));
}
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
function closeMenu() { const b = $("#menu-btn"); if (b) { b.setAttribute("aria-expanded", "false"); $(".rail").classList.remove("open"); } }
function setupMenu() {
  const b = $("#menu-btn");
  b.addEventListener("click", () => {
    const open = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(open));
    $(".rail").classList.toggle("open", open);
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
  if (e.target.closest?.("input, textarea, select, button, [role=button], .sh-term") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "ArrowRight") go(1);
  else if (e.key === "ArrowLeft") go(-1);
  else if (e.key === "n" || e.key === "N") nextStepOnPage();
  else if (e.key === "h" || e.key === "H") nextHintOnPage();
});

/* =========================================================== code listings */
const JAVA_KEYWORDS = new Set("import public class static void new while for int long return if else throw throws boolean double try catch private null true false".split(" "));
function highlightJava(line) {
  const frag = document.createDocumentFragment();
  if (/^\s*(\/\*\*|\*|\*\/)/.test(line)) { frag.append(el("span", { class: "tk-com", text: line })); return frag; }
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b[A-Za-z_]\w*\b)|(\b\d+\b)/g;
  let last = 0, m;
  while ((m = re.exec(line))) {
    if (m.index > last) frag.append(line.slice(last, m.index));
    if (m[1]) frag.append(el("span", { class: "tk-com", text: m[1] }));
    else if (m[2]) frag.append(el("span", { class: "tk-str", text: m[2] }));
    else if (m[3]) frag.append(JAVA_KEYWORDS.has(m[3]) ? el("span", { class: "tk-kw", text: m[3] }) : /^[A-Z]/.test(m[3]) ? el("span", { class: "tk-type", text: m[3] }) : m[3]);
    else frag.append(el("span", { class: "tk-num", text: m[4] }));
    last = re.lastIndex;
  }
  if (last < line.length) frag.append(line.slice(last));
  return frag;
}
// pre.code[data-src="sum"]: the lecture's listing, numbered; data-from / data-to keep a range.
function renderCode(pre) {
  const from = Number(pre.dataset.from || 1), to = Number(pre.dataset.to || SRC.length);
  const code = el("code");
  for (let n = from; n <= Math.min(to, SRC.length); n++) {
    const row = el("span", { class: "ln" });
    row.dataset.line = String(n);
    row.append(el("span", { class: "no", text: String(n) }));
    const src = el("span", { class: "src" });
    src.append(highlightJava(SRC[n - 1] || " "));
    row.append(src);
    code.append(row);
  }
  pre.replaceChildren(code);
  pre.tabIndex = 0;
}

/* =========================================================== terminals */
// Draws shell entries: the command, what was typed (then Control-D), standard output and standard error
// (colored by stream unless "as a real terminal" is on), notes from the simulator, and each command's exit
// status as an annotation outside the terminal text (a real terminal doesn't show it).
function drawEntries(pre, entries, { append = false } = {}) {
  if (!append) pre.replaceChildren();
  let cmdLine = null;
  for (const e of entries) {
    if (e.kind === "cmd") {
      cmdLine = el("span", { class: "tl cmd" }, el("span", { class: "ps1", "aria-hidden": "true", text: "$ " }), e.text);
      pre.append(cmdLine, "\n");
    } else if (e.kind === "typed") {
      const t = e.text.replace(/\n$/, "");
      if (t) for (const l of t.split("\n")) pre.append(el("span", { class: "tl typed", text: l || " " }), "\n");
      pre.append(el("span", { class: "tl eof", text: t ? "⌃D" : "⌃D  (nothing typed: input ended at once)" }), "\n");
    } else if (e.kind === "out" || e.kind === "err") {
      pre.append(el("span", { class: `tl ${e.kind === "err" ? "err" : "out"}`, text: e.text || " " }), "\n");
    } else if (e.kind === "note") {
      pre.append(el("span", { class: "tl note", text: `simulator: ${e.text}` }), "\n");
    } else if (e.kind === "status" && cmdLine) {
      const s = Number(e.text);
      cmdLine.append(el("span", { class: `st-badge ${s === 0 ? "zero" : "nonzero"}`, title: "Exit status. A real terminal doesn't show it; echo $? prints it.", text: `status ${e.text}` }));
    }
  }
  return pre;
}
function termFrame(box, title = "bash") {
  box.classList.add("term");
  const head = el("div", { class: "term-head" },
    el("span", { class: "dots", "aria-hidden": "true" }, el("i"), el("i"), el("i")),
    el("span", { class: "term-title", text: title }),
    el("button", { class: "plain-toggle", "aria-pressed": String(document.body.classList.contains("plain-streams")), title: "Show both streams as a real terminal does", text: "as a terminal shows it" }));
  const pre = el("pre", { class: "term-body", tabindex: "0" });
  box.replaceChildren(head, pre);
  return pre;
}
// .term[data-session='[["java Sum -a","3 4 5\n"], ...]']: a fresh shell; each line runs with its keyboard text.
function runSession(lines, { checks, files } = {}) {
  const sh = S.createShell({ checks, files });
  const entries = [];
  for (const [line, kb] of lines) entries.push(...sh.exec(line, kb ?? "").entries);
  return { entries, sh };
}
function renderSessionTerm(box) {
  const lines = JSON.parse(box.dataset.session);
  const pre = termFrame(box);
  drawEntries(pre, runSession(lines).entries);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest(".plain-toggle");
  if (!b) return;
  const on = !document.body.classList.contains("plain-streams");
  document.body.classList.toggle("plain-streams", on);
  $$(".plain-toggle").forEach((x) => x.setAttribute("aria-pressed", String(on)));
});

/* =========================================================== the Sum runner */
// Splits the argument text the way bash would (quotes, backslashes), refusing operators.
function splitArgs(text) {
  const lx = S.lex(text);
  if (lx.error) return { error: `bash would say: ${lx.error}` };
  if (lx.toks.some((t) => t.t !== "word")) return { error: "Redirections and pipes (>, <, |, ;) belong to the shell. Try them in the terminals on the Batch programs page." };
  return { args: lx.toks.map((t) => t.v) };
}
const ENDINGS = {
  ok: (r) => `main finished after line ${r.endLine} (${srcLine(r.endLine)}), so Java set exit status 0.`,
  fail: (r) => `Line ${r.endLine} called fail. Line 96 printed the message on standard error, and line 97 exited with status 1.`,
  exception: (r) => `Line ${r.endLine} threw ${r.exception.split(".").pop()}. Nothing caught it, so Java printed a stack trace on standard error and set exit status 1.`,
};
function createRunner(box, { getChecks = () => ({}) } = {}) {
  const compact = box.dataset.compact === "true";
  const files = S.DEFAULT_FILES();
  const argsIn = el("input", { type: "text", class: "args-input", value: box.dataset.args || "", spellcheck: "false", autocomplete: "off", "aria-label": "Arguments after java Sum" });
  const stdinIn = el("textarea", { class: "stdin-input", rows: "3", spellcheck: "false", "aria-label": "Standard input: what you type" });
  stdinIn.value = (box.dataset.stdin || "").replace(/\\n/g, "\n");
  const stdinNote = el("p", { class: "rn-note" });
  const presets = el("div", { class: "rn-presets", role: "group", "aria-label": "Example runs" });
  for (const [label, args, stdin] of JSON.parse(box.dataset.presets || "[]")) {
    const b = el("button", { class: "chip", type: "button", text: label });
    b.addEventListener("click", () => { argsIn.value = args; stdinIn.value = stdin.replace(/\n$/, ""); go(); });
    presets.append(b);
  }
  const fileList = el("div", { class: "rn-files-list" });
  const filesBox = el("details", { class: "rn-files" }, el("summary", {}, "Files Sum can read ", el("span", { class: "count" })), fileList);
  function drawFiles() {
    fileList.replaceChildren();
    for (const name of Object.keys(files).sort()) {
      const ta = el("textarea", { rows: "1", spellcheck: "false", "aria-label": `Contents of ${name}` });
      ta.value = files[name];
      ta.addEventListener("input", () => { files[name] = ta.value; go(); });
      const del = el("button", { class: "btn quiet small", type: "button", "aria-label": `Delete ${name}`, text: "Delete" });
      del.addEventListener("click", () => { delete files[name]; drawFiles(); go(); });
      fileList.append(el("div", { class: "rn-file" }, el("code", { text: name }), ta, del));
    }
    const nameIn = el("input", { type: "text", placeholder: "new file name", "aria-label": "New file name", spellcheck: "false" });
    const add = el("button", { class: "btn small", type: "button", text: "Add file" });
    const addFile = () => {
      const n = nameIn.value.trim();
      if (!n || n.includes("/") || n === "." || n === "..") { nameIn.setCustomValidity("A plain file name, like more.txt"); nameIn.reportValidity(); return; }
      if (!(n in files)) files[n] = "";
      drawFiles(); go();
    };
    add.addEventListener("click", addFile);
    nameIn.addEventListener("keydown", (e) => { nameIn.setCustomValidity(""); if (e.key === "Enter") addFile(); });
    fileList.append(el("div", { class: "rn-file add" }, nameIn, add));
    $(".count", filesBox).textContent = `(${Object.keys(files).length})`;
  }
  const outPre = el("pre", { class: "ch-body" }), errPre = el("pre", { class: "ch-body" });
  const stNum = el("b", { class: "st-num" }), stWord = el("span", { class: "st-word" });
  const termPre = el("pre", { class: "term-body" });
  const ending = el("p", { class: "rn-ending" });
  const notes = el("div", { class: "rn-notes" });

  const inPane = el("div", { class: "rn-in" },
    el("label", { class: "rn-label", text: "Command line" }),
    el("div", { class: "cmdline" }, el("span", { class: "ps1", "aria-hidden": "true", text: "$" }), el("span", { class: "fixed", text: "java Sum" }), argsIn),
    presets,
    el("label", { class: "rn-label", text: "Standard input: what you type, then ⌃D" }),
    stdinIn, stdinNote, filesBox);
  const outPane = el("div", { class: "rn-out", "aria-live": "polite" },
    el("div", { class: "ch ch-out" }, el("p", { class: "ch-name" }, el("span", { class: "dot" }), "standard output"), outPre),
    el("div", { class: "ch ch-err" }, el("p", { class: "ch-name" }, el("span", { class: "dot" }), "standard error"), errPre),
    el("div", { class: "ch ch-st" }, el("p", { class: "ch-name" }, el("span", { class: "dot" }), "exit status"), el("div", { class: "st-row" }, stNum, stWord)),
    ending, notes);
  const termWrap = el("details", { class: "rn-term" }, el("summary", { text: "What the terminal shows" }), el("div", { class: "term" }, termPre));
  if (!compact) outPane.append(termWrap);
  box.replaceChildren(inPane, outPane);
  box.classList.toggle("compact", compact);

  function go() {
    const sp = splitArgs(argsIn.value);
    notes.replaceChildren();
    if (sp.error) {
      outPre.textContent = ""; errPre.textContent = ""; stNum.textContent = "–"; stWord.textContent = "";
      box.dataset.status = "";
      ending.textContent = sp.error; ending.className = "rn-ending warn";
      return null;
    }
    const r = S.run(sp.args, { stdin: stdinIn.value, files: { ...files }, checks: getChecks() });
    outPre.textContent = r.stdout.replace(/\n$/, "");
    outPre.classList.toggle("empty", !r.stdout);
    if (!r.stdout) outPre.textContent = "(nothing)";
    errPre.textContent = r.stderr.replace(/\n$/, "") || "(nothing)";
    errPre.classList.toggle("empty", !r.stderr);
    stNum.textContent = String(r.status);
    stWord.textContent = r.status === 0 ? "success" : "failure";
    box.dataset.status = String(r.status);
    ending.className = "rn-ending";
    ending.textContent = ENDINGS[r.how](r);
    for (const n of r.notes) notes.append(el("p", { class: "rn-note", text: n }));
    // standard input: was it read?
    stdinIn.classList.toggle("unread", !r.readsStdin);
    stdinNote.textContent = r.readsStdin ? "Sum reads this (lines 89–90: no file was named)."
      : r.source && r.source.kind === "file" ? `Sum read ${r.source.name} instead (line 92), so what you type here is never read.`
      : `Sum stopped at line ${r.endLine} before reading any input, so what you type here is never read.`;
    // the terminal view
    const sh = S.createShell({ files: { ...files }, checks: getChecks() });
    drawEntries(termPre, sh.exec(`java Sum ${argsIn.value}`.trim(), stdinIn.value).entries);
    return r;
  }
  const goSoon = debounce(go, 120);
  argsIn.addEventListener("input", goSoon);
  stdinIn.addEventListener("input", goSoon);
  drawFiles();
  go();
  return { run: go, set(args, stdin) { argsIn.value = args; stdinIn.value = stdin; go(); } };
}

/* =========================================================== interactive shell */
function setupShell(box) {
  const script = JSON.parse(box.dataset.script || "[]");
  let sh, k = 0;
  const pre = el("pre", { class: "term-body", "aria-live": "polite" });
  const prompt = el("input", { type: "text", class: "sh-input", spellcheck: "false", autocomplete: "off", "aria-label": "Type a shell command, then Enter" });
  const kb = el("input", { type: "text", class: "sh-kb", spellcheck: "false", autocomplete: "off", placeholder: "nothing", "aria-label": "Keyboard input for commands that read the terminal" });
  const nextBtn = el("button", { class: "btn primary", type: "button" });
  const resetBtn = el("button", { class: "btn quiet", type: "button", text: "Reset" });
  const filesBox = el("div", { class: "sh-files" });
  const head = el("div", { class: "term-head" },
    el("span", { class: "dots", "aria-hidden": "true" }, el("i"), el("i"), el("i")),
    el("span", { class: "term-title", text: "bash · ~/sum" }),
    el("button", { class: "plain-toggle", "aria-pressed": String(document.body.classList.contains("plain-streams")), text: "as a terminal shows it" }));
  const termEl = el("div", { class: "term sh-term" }, head, pre, el("label", { class: "sh-prompt" }, el("span", { class: "ps1", "aria-hidden": "true", text: "$" }), prompt));
  const side = el("div", { class: "sh-side" },
    el("div", { class: "sh-next" }, nextBtn, resetBtn),
    el("label", { class: "rn-label", text: "If a command reads the keyboard, you type:" }), kb,
    el("p", { class: "rn-label", text: "Working directory" }), filesBox);
  box.replaceChildren(termEl, side);
  const history = [];
  let hi = 0;
  function drawFiles() {
    filesBox.replaceChildren();
    for (const name of Object.keys(sh.files).sort()) {
      const body = sh.files[name];
      filesBox.append(el("div", { class: `sh-file${box._changed && box._changed.has(name) ? " changed" : ""}` }, el("code", { class: "fname", text: name }), el("pre", { class: body ? "" : "empty", text: body ? body.replace(/\n$/, "") : "(empty)" })));
    }
  }
  function drawNext() {
    nextBtn.disabled = k >= script.length;
    nextBtn.replaceChildren(k < script.length ? "Run next line: " : "Script finished", k < script.length ? el("code", { text: script[k] }) : "");
  }
  function exec(line) {
    const before = JSON.stringify(sh.files);
    const prevFiles = { ...sh.files };
    const r = sh.exec(line, kb.value);
    if (r.cleared) pre.replaceChildren();
    drawEntries(pre, r.entries, { append: true });
    box._changed = new Set(Object.keys(sh.files).filter((f) => prevFiles[f] !== sh.files[f]));
    if (before !== JSON.stringify(sh.files)) drawFiles(); else { box._changed = new Set(); drawFiles(); }
    pre.scrollTop = pre.scrollHeight;
  }
  function reset() {
    sh = S.createShell();
    k = 0;
    box._changed = new Set();
    pre.replaceChildren(el("span", { class: "tl note", text: "nums.txt contains 3 4 5 and bad.txt contains 3 x. Run the script, or type any command: java Sum …, echo, cat, ls, rm, with > >> < 2> 2>&1 | ; && ||." }), "\n");
    drawFiles(); drawNext();
  }
  nextBtn.addEventListener("click", () => { if (k < script.length) { exec(script[k]); k++; drawNext(); } });
  resetBtn.addEventListener("click", reset);
  prompt.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const line = prompt.value;
      if (!line.trim()) return;
      history.push(line); hi = history.length;
      prompt.value = "";
      exec(line);
    } else if (e.key === "ArrowUp" && hi > 0) { hi--; prompt.value = history[hi]; e.preventDefault(); }
    else if (e.key === "ArrowDown" && hi < history.length) { hi++; prompt.value = history[hi] || ""; e.preventDefault(); }
  });
  reset();
}

/* =========================================================== command line, word by word */
function setupArgWalk() {
  const input = $("#argwalk-input"), arr = $("#argwalk-array"), steps = $("#argwalk-steps"), verdict = $("#argwalk-verdict");
  function go() {
    const sp = splitArgs(input.value);
    steps.replaceChildren();
    if (sp.error) { arr.textContent = ""; verdict.className = "verdict warn"; verdict.textContent = sp.error; return; }
    arr.replaceChildren("main gets ", el("code", { text: `args = { ${sp.args.map((a) => JSON.stringify(a)).join(", ")} }` }), el("span", { class: "muted", text: ` (${sp.args.length} element${sp.args.length === 1 ? "" : "s"})` }));
    const r = S.run(sp.args, { stdin: "1 2\n" });
    r.argSteps.forEach((s) => {
      const failed = /fail$/.test(s.effect);
      steps.append(el("li", { class: failed ? "bad" : "" },
        el("code", { class: "argword", text: JSON.stringify(s.arg) }),
        el("span", { class: "argline", text: `line ${s.line}` }),
        el("span", { text: s.effect })));
    });
    if (!sp.args.length) steps.append(el("li", {}, el("span", { text: "No arguments: the loop on line 28 runs zero times." })));
    const outcome = r.how === "fail" ? `Sum stops: ${r.stderr.trim()} (status 1).` : r.readsStdin ? "Every argument passed. No file was named, so Sum reads standard input." : `Every argument passed. Sum reads ${r.source && r.source.name ? r.source.name : "a file"}.`;
    if (r.how === "fail" && r.endLine === 54) steps.append(el("li", { class: "bad" }, el("code", { class: "argword", text: "after the loop" }), el("span", { class: "argline", text: "line 53" }), el("span", { text: "precisionGiven && !average, so fail" })));
    verdict.className = `verdict ${r.how === "fail" ? "bad" : "ok"}`;
    verdict.textContent = outcome;
  }
  input.addEventListener("input", go);
  $$("#argwalk [data-try]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.try; go(); }));
  go();
}

/* =========================================================== Lecture 1 vs Lecture 3 */
function setupCompare() {
  const input = $("#compare-input"), a = $("#compare-l1"), b = $("#compare-l3"), verdict = $("#compare-verdict");
  const preA = termFrame(a, "Lecture 1"), preB = termFrame(b, "Lecture 3");
  function go() {
    const typed = input.value;
    const r1 = S.runLecture1(typed);
    drawEntries(preA, [{ kind: "cmd", text: "java Sum" }, { kind: "out", text: "Enter some numbers." }, { kind: "typed", text: typed },
      ...r1.stdout.split("\n").slice(1, 3).map((t) => ({ kind: "out", text: t })), { kind: "status", text: "0" }]);
    const sh = S.createShell();
    const r3 = sh.exec("java Sum", typed);
    drawEntries(preB, r3.entries);
    const run3 = r3.runs[0];
    const notes = [];
    if (run3.badToken) notes.push(`Lecture 1's Sum stopped quietly at "${run3.badToken}" and added what came before. This Sum refuses the whole input and names the word.`);
    if (!run3.badToken && r1.sum !== run3.sum) notes.push(`The true sum is ${run3.sum}. Lecture 1's int wrapped around to ${r1.sum}; this Sum's long holds it.`);
    if (!notes.length) notes.push(run3.status === 0 && r1.list.length === run3.read.length ? "Both read the same numbers and print the same sum; only the prompt and the Got line differ." : "");
    verdict.className = "verdict";
    verdict.textContent = notes.join(" ");
  }
  $("#compare-run").addEventListener("click", go);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  $$("#compare [data-try]").forEach((x) => x.addEventListener("click", () => { input.value = x.dataset.try; go(); }));
  go();
}

/* =========================================================== program map */
const MAP_NOTES = {
  "5-19": "The user manual: a comment that speaks to whoever runs Sum. The lecture tests it against runs its author may not have pictured.",
  "28-51": "The argument loop: each word after java Sum, in order. -a / --average and --precision=N are options; any other word that starts with a dash is unknown; anything else names a file, and only one is allowed. Every mistake calls fail.",
  "53-55": "After the loop: a precision only makes sense with -a.",
  "57-70": "Reading: sum and count are longs. Each word must be an int (line 61), or fail is called (line 65). A file that can't be opened lands in the catch on line 68.",
  "72-84": "Output: the sum (line 83), or the average as a double (line 76), printed by println (line 80) or by printf with the precision (line 78). Lines 73–75 refuse to average nothing.",
  "87-93": "openInput: standard input when no file was named (lines 89–90), otherwise the file. try (…) on line 59 closes the Scanner afterwards.",
  "95-98": "fail: one line on standard error that starts with the program's name, then exit status 1. Every error goes through here.",
};
function setupProgramMap() {
  const code = $("#map-code"), note = $("#map-note");
  $$("#program-map [data-range]").forEach((b) => b.addEventListener("click", () => {
    const [lo, hi] = b.dataset.range.split("-").map(Number);
    const on = b.getAttribute("aria-pressed") !== "true";
    $$("#program-map [data-range]").forEach((x) => x.setAttribute("aria-pressed", String(x === b && on)));
    $$(".ln", code).forEach((row) => { const n = Number(row.dataset.line); row.classList.toggle("hl", on && n >= lo && n <= hi); row.classList.toggle("dim", on && (n < lo || n > hi)); });
    note.textContent = on ? MAP_NOTES[b.dataset.range] : "Click a part of the program to see what it does.";
    if (on) { const first = $(`.ln[data-line="${lo}"]`, code); code.scrollTo({ top: Math.max(0, first.offsetTop - 12), behavior: reduceMotion() ? "auto" : "smooth" }); }
  }));
  $$("#program-map [data-range]").forEach((b) => b.setAttribute("aria-pressed", "false"));
}

/* =========================================================== promises: stronger and weaker */
// Five responses to `java Sum -a` with nothing typed. P1 and P3 are real (Sum.java and the copy without
// lines 73-75); P4 is a version dividing longs (java.lang.ArithmeticException: / by zero, checked with java);
// P2 and P5 are hypothetical versions the notes mention (print 0; exit with status 2 and print nothing).
const PROGRAMS = [
  { id: "P1", name: "Lecture 3's Sum", out: "", err: "Sum: cannot average zero values", status: 1 },
  { id: "P2", name: "prints 0 instead", out: "0.0", err: "", status: 0 },
  { id: "P3", name: "Sum without lines 73–75", out: "NaN", err: "", status: 0 },
  { id: "P4", name: "divides longs instead", out: "", err: "Exception in thread \"main\" java.lang.ArithmeticException: / by zero\n\tat Sum.main(Sum.java:76)", status: 1 },
  { id: "P5", name: "exits with 2, prints nothing", out: "", err: "", status: 2 },
];
const MANUALS = [
  { id: "MA", text: "It prints Sum: cannot average zero values on standard error and exits with status 1.", ok: (p) => p.err === "Sum: cannot average zero values" && p.status === 1 },
  { id: "MB", text: "It exits with a nonzero status.", ok: (p) => p.status !== 0 },
  { id: "MC", text: "It prints one line on standard output, nothing on standard error, and exits with status 0.", ok: (p) => p.out !== "" && !p.out.includes("\n") && p.err === "" && p.status === 0 },
  { id: "MD", text: "It does not end in a stack trace.", ok: (p) => !p.err.startsWith("Exception in thread") },
  { id: "ME", text: "It prints something on standard error.", ok: (p) => p.err !== "" },
];
// The true relation over every possible program (not just these five), with the reason.
const RELATION = {
  "MA|MB": ["stronger", "Status 1 is in particular a nonzero status, so every program meeting MA meets MB. A program that exits with 2 meets MB and not MA."],
  "MA|MC": ["incomparable", "MA requires status 1 and MC requires status 0, so no program meets both, and each is met by some program."],
  "MA|MD": ["stronger", "MA fixes standard error to one message line, which is not a stack trace. A program printing 0.0 meets MD and not MA."],
  "MA|ME": ["stronger", "MA's message is something on standard error. A stack trace meets ME and not MA."],
  "MB|MC": ["incomparable", "MB needs a nonzero status and MC needs 0: no program meets both."],
  "MB|MD": ["incomparable", "A stack trace (status 1) meets MB and not MD; printing 0.0 (status 0) meets MD and not MB."],
  "MB|ME": ["incomparable", "Exiting with 2 and printing nothing meets MB and not ME. Here the five programs mislead: every one that meets ME also meets MB. But a program that prints a warning on standard error and exits with 0 meets ME and not MB. Stronger comes from the definition, not from a sample."],
  "MC|MD": ["stronger", "MC requires nothing on standard error, so no stack trace. A program that fails with a message meets MD and not MC."],
  "MC|ME": ["incomparable", "MC requires nothing on standard error and ME requires something: no program meets both."],
  "MD|ME": ["incomparable", "Printing 0.0 meets MD and not ME; a stack trace meets ME and not MD."],
};
function setupPromises() {
  const grid = $("#promise-grid"), out = $("#promise-out");
  const table = el("table", { class: "promise-table" });
  const head = el("tr", {}, el("th", { scope: "col", text: "Manual (click to test)" }));
  for (const p of PROGRAMS) {
    head.append(el("th", { scope: "col" }, el("span", { class: "pname", text: `${p.id}: ${p.name}` }),
      el("span", { class: "pout" }, el("span", { class: "s-out", text: p.out ? `out ${p.out}` : "out —" }), el("span", { class: "s-err", text: p.err ? `err ${p.err.split("\n")[0].replace("Exception in thread \"main\" ", "")}` : "err —" }), el("span", { class: "s-st", text: `status ${p.status}` }))));
  }
  table.append(head);
  let picked = [];
  const rows = MANUALS.map((mn) => {
    const btn = el("button", { class: "manual-btn", type: "button", "aria-pressed": "false" }, el("b", { text: mn.id }), " ", mn.text);
    const tr = el("tr", {}, el("th", { scope: "row" }, btn));
    const cells = PROGRAMS.map((p) => { const td = el("td", { class: "cell", text: "?" }); tr.append(td); return { td, p }; });
    btn.addEventListener("click", () => {
      picked = picked.filter((x) => x !== mn.id);
      if (btn.getAttribute("aria-pressed") === "true") { btn.setAttribute("aria-pressed", "false"); }
      else { picked.push(mn.id); if (picked.length > 2) { const drop = picked.shift(); rows.find((r) => r.mn.id === drop).btn.setAttribute("aria-pressed", "false"); } btn.setAttribute("aria-pressed", "true"); }
      cells.forEach(({ td, p }) => { const ok = mn.ok(p); td.textContent = ok ? "meets" : "no"; td.className = `cell ${ok ? "yes" : "no"}`; });
      explain();
    });
    table.append(tr);
    return { mn, btn, cells };
  });
  function explain() {
    out.replaceChildren();
    if (!picked.length) { out.textContent = "Pick a manual."; return; }
    const met = (id) => PROGRAMS.filter((p) => MANUALS.find((m) => m.id === id).ok(p)).map((p) => p.id);
    if (picked.length === 1) { out.append(el("p", { text: `${picked[0]} is met by ${met(picked[0]).join(", ") || "none"} of these five. Pick a second manual to compare.` })); return; }
    const [a, b] = [...picked].sort();
    const [rel, why] = RELATION[`${a}|${b}`];
    const sentence = rel === "stronger" ? `${a} is stronger than ${b}.` : `${a} and ${b} are incomparable.`;
    out.append(el("p", {}, el("strong", { text: sentence }), " ", why),
      el("p", { class: "where", text: `Among these five: ${a} is met by ${met(a).join(", ") || "none"}, ${b} by ${met(b).join(", ") || "none"}.` }));
  }
  grid.append(el("div", { class: "table-scroll" }, table));
  explain();
}

/* =========================================================== checks removed (edge lab) */
function setupEdgeLab() {
  const neg = $("#edge-neg"), cnt = $("#edge-count");
  const checks = () => ({ neg: neg.getAttribute("aria-pressed") === "true", count: cnt.getAttribute("aria-pressed") === "true" });
  const runner = createRunner($("#edge-lab .runner"), { getChecks: checks });
  function paint() {
    const c = checks();
    [["#edge-code-a", 40, 43, c.neg], ["#edge-code-b", 73, 75, c.count]].forEach(([sel, lo, hi, on]) => {
      $$(".ln", $(sel)).forEach((row) => {
        const n = Number(row.dataset.line);
        if (n < lo || n > hi) return;
        row.classList.toggle("removed", !on);
        $(".src", row).replaceChildren(on ? highlightJava(SRC[n - 1]) : " ");
      });
    });
    neg.textContent = c.neg ? "Lines 40–43: precision not negative (on)" : "Lines 40–43 removed";
    cnt.textContent = c.count ? "Lines 73–75: count not zero (on)" : "Lines 73–75 removed";
    runner.run();
  }
  [neg, cnt].forEach((b) => b.addEventListener("click", () => { b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")); paint(); }));
  paint();
}

/* =========================================================== discussion timer */
function setupTimer() {
  const phases = $$("#timer-phases li"), clock = $("#timer-clock"), start = $("#timer-start");
  let i = 0, left = 0, ticking = null, up = 0;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  function paint() {
    phases.forEach((li, k) => { li.classList.toggle("now", k === i); li.classList.toggle("done", k < i); });
    const min = Number(phases[i].dataset.min);
    clock.textContent = min ? fmt(Math.max(0, left)) : `${fmt(up)} elapsed`;
    clock.classList.toggle("over", Boolean(min) && left <= 0 && ticking !== null);
    start.textContent = ticking ? "Pause" : "Start";
  }
  function load(k) { i = k; left = Number(phases[i].dataset.min) * 60; up = 0; paint(); }
  start.addEventListener("click", () => {
    if (ticking) { clearInterval(ticking); ticking = null; paint(); return; }
    ticking = setInterval(() => { if (Number(phases[i].dataset.min)) left--; else up++; paint(); }, 1000);
    paint();
  });
  $("#timer-next").addEventListener("click", () => { if (i < phases.length - 1) load(i + 1); });
  $("#timer-reset").addEventListener("click", () => { if (ticking) { clearInterval(ticking); ticking = null; } load(0); });
  phases.forEach((li, k) => { li.tabIndex = 0; li.addEventListener("click", () => load(k)); li.addEventListener("keydown", (e) => { if (e.key === "Enter") load(k); }); });
  load(0);
}

/* =========================================================== step reveals and run buttons */
function setupSteps() {
  $$(".steps").forEach((steps) => {
    const items = $$(":scope > ol > li", steps);
    let shown = 0;
    const bar = el("div", { class: "step-bar" });
    const next = el("button", { class: "btn primary", type: "button", text: "Show next step" });
    const all = el("button", { class: "btn", type: "button", text: "Show all" });
    const reset = el("button", { class: "btn", type: "button", text: "Hide steps" });
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
const CHECK_SETS = { noneg: { neg: false }, nocount: { count: false } };
function setupRunButtons() {
  $$("[data-run-cmd], [data-run-session]").forEach((b) => b.addEventListener("click", () => {
    const outBox = $(".run-out", b.closest(".solution"));
    const box = el("div", { class: "term small" });
    const checks = CHECK_SETS[b.dataset.runChecks] || {};
    const label = b.dataset.runChecks ? "The copy without lines 40–43 (real Java prints the same):" : "Sum.java (the simulator matches real Java on this run):";
    outBox.replaceChildren(el("p", { class: "where", text: label }), box);
    const lines = b.dataset.runSession ? JSON.parse(b.dataset.runSession).map((l) => [l, ""]) : [[b.dataset.runCmd, b.dataset.runKb || ""]];
    drawEntries(termFrame(box), runSession(lines, { checks }).entries);
  }));
}

/* =========================================================== grading helpers */
const keyFor = (id) => { const k = KEYS[id]; if (!k) throw new Error(`no answer key for ${id}`); return k; };

/* =========================================================== drafts, invalidation, flushing
   Every graded input on the site (quiz numeric + MC, quick checks, sorter cards, problem parts of every grader
   kind, problem self-check parts) goes through these. Widgets (runner, terminals, shell, argument walker,
   program map, Lecture 1 comparison, promises grid, edge lab, timer) keep no saved state and aren't graded.
   - An edit keeps the draft and clears the current grade (CourseStore.invalidateCurrentGrade), in the
     snapshot and the DOM at once. The snapshot write is debounced; the local mirror gets it on flush.
   - Before ANY repaint from the store (Check, reveal, hint, solution, self-mark, clear, start over, a
     conflict merge, import) and on pagehide / visibilitychange / route change, flushPendingInput() writes
     every pending draft synchronously, so a repaint can never read a stale snapshot over typed text.
   - attempts[] and events[] are only appended (store.attempt / store.event), never edited here. */
const ITEMS = new Map();
function flushPendingInput(id) {
  if (id) { const it = ITEMS.get(id); if (it) it.flush(); return; }
  ITEMS.forEach((it) => it.flush());
}
function draftWriter(id, write) {
  const d = debounce(write, 300);
  ITEMS.set(id, { flush: () => d.flush() });
  return d;
}

/* =========================================================== quick checks (typed) */
function setupChecks() {
  $$(".check[data-id]").forEach((box) => {
    if (box.dataset.format === "sort") return;
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
    input.addEventListener("input", () => { dirty = true; fb.className = "feedback"; fb.textContent = ""; input.classList.remove("ok", "bad"); saveDraft(); });
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
      input.classList.toggle("ok", g.status === "correct");
      input.classList.toggle("bad", g.status === "incorrect");
    };
    button.addEventListener("click", check);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
    const restore = () => {
      const s = store.get(id);
      if (!s) { input.value = ""; fb.className = "feedback"; fb.textContent = ""; input.classList.remove("ok", "bad"); return; }
      if (document.activeElement !== input) input.value = s.raw || "";
      fb.className = `feedback ${s.correct === true ? "ok" : s.correct === false ? "bad" : ""}`;
      fb.textContent = s.correct === true ? "Correct." : s.correct === false ? "Last try: not quite." : "";
      input.classList.toggle("ok", s.correct === true);
      input.classList.toggle("bad", s.correct === false);
    };
    RESTORERS.set(id, () => { flushPendingInput(id); restore(); });
    restore();
  });
}

/* =========================================================== the sorter (graded choice cards) */
const SORT_LABEL = { described: "Described", silent: "Silent", contradicted: "Contradicted" };
const SORT_HINT = {
  "cse331-w2-l3-sort-file-sum": "Read lines 6–7 and 17–18 again.",
  "cse331-w2-l3-sort-average-two-decimals": "Read the Options on lines 12–15 again.",
  "cse331-w2-l3-sort-too-big-integer": "Is 2147483648 an integer? What does line 6 promise to read?",
  "cse331-w2-l3-sort-empty-sum": "What is the sum of no numbers? What does the manual say Sum prints by default?",
  "cse331-w2-l3-sort-empty-average": "Search lines 5–19 for anything about averaging no numbers.",
  "cse331-w2-l3-sort-word-in-input": "Does the manual say anything about input that isn't an integer?",
  "cse331-w2-l3-sort-exit-status": "Search lines 5–19 for anything about how Sum exits.",
  "cse331-w2-l3-sort-help": "Is --help in the Options list? Does the manual mention other options at all?",
};
const SORT_EXPLAIN = {
  "cse331-w2-l3-sort-file-sum": "Lines 17–18 say a file argument is read, and the default (lines 6–7) is the sum: 12.",
  "cse331-w2-l3-sort-average-two-decimals": "Lines 13–15: -a prints the average, and --precision=N gives N digits after the decimal point. 1.50 is that.",
  "cse331-w2-l3-sort-too-big-integer": "The manual promises to read integers, and 2147483648 is one. Sum calls it not an integer: the run goes against the manual.",
  "cse331-w2-l3-sort-empty-sum": "Sum prints 0, which the manual covers if the sum of no numbers is 0.",
  "cse331-w2-l3-sort-empty-average": "The manual never says what the average of nothing is, nor that Sum refuses with a message and status 1.",
  "cse331-w2-l3-sort-word-in-input": "The manual says nothing about a word that isn't an integer: not the message, not the stream, not the status.",
  "cse331-w2-l3-sort-exit-status": "No line of the manual mentions an exit status, for this run or any other.",
  "cse331-w2-l3-sort-help": "The manual lists -a and --precision=N. It says nothing about any other option, or what Sum does with one.",
};
function setupSorter() {
  const cards = $$('.check[data-format="sort"]');
  const score = $("#sorter-score");
  const update = () => {
    const done = cards.filter((c) => store.get(c.dataset.id)?.correct === true).length;
    const tried = cards.filter((c) => store.attemptsOf(c.dataset.id).length).length;
    score.textContent = `${done} of ${cards.length} sorted right · ${tried} tried${done === cards.length ? ". Count the silent ones: that's what exercise 1 asks you to fix." : ""}`;
  };
  cards.forEach((card) => {
    const id = card.dataset.id;
    const key = keyFor(id);
    const opts = card.dataset.options.split("|");
    const row = el("div", { class: "sort-opts", role: "group", "aria-label": "Described, silent or contradicted?" });
    const fb = el("p", { class: "feedback", role: "status" });
    const buttons = opts.map((o) => {
      const b = el("button", { class: `chip sort-${o}`, type: "button", "data-option": o, "aria-pressed": "false", text: SORT_LABEL[o] });
      b.addEventListener("click", () => choose(o));
      row.append(b);
      return b;
    });
    card.append(row, fb);
    const blank = () => ({ kind: "quickcheck", raw: "", normalized: null, correct: null, tries: 0, firstTryCorrect: null });
    function choose(o) {
      flushPendingInput(id);
      const g = window.Grader.grade(key, o);
      const s = { ...blank(), ...store.get(id) };
      s.raw = o; s.normalized = g.normalized; s.correct = g.status === "correct"; s.tries++;
      if (s.firstTryCorrect === null) s.firstTryCorrect = s.correct;
      store.attempt(id, { kind: "check", answer: { raw: o, normalized: o, choiceId: o }, result: { overall: g.status, correct: s.correct }, feedbackKind: g.status === "correct" ? "correct" : `chose-${o}`, hintsRevealedAtSubmit: 0, solutionViewedBeforeSubmit: false });
      store.put(id, s);
      paint();
      update();
    }
    function paint() {
      const s = store.get(id);
      buttons.forEach((b) => {
        const mine = s && s.raw === b.dataset.option;
        b.setAttribute("aria-pressed", String(Boolean(mine)));
        b.classList.toggle("right", Boolean(mine && s.correct === true));
        b.classList.toggle("wrong", Boolean(mine && s.correct === false));
      });
      card.classList.toggle("is-right", s?.correct === true);
      if (!s || s.correct === null) { fb.className = "feedback"; fb.textContent = ""; }
      else if (s.correct) { fb.className = "feedback ok"; fb.textContent = `Right. ${SORT_EXPLAIN[id]}`; }
      else { fb.className = "feedback bad"; fb.textContent = `Not quite. ${SORT_HINT[id]}`; }
    }
    RESTORERS.set(id, () => { paint(); update(); });
    paint();
  });
  update();
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
    let input;
    if (isSelf) input = el("textarea", { id: inputId, rows: "3", spellcheck: "true", placeholder: p.spec.dataset.placeholder || "your answer" });
    else if (p.type === "choice") {
      input = el("select", { id: inputId }, el("option", { value: "", text: "Choose…" }));
      for (const o of p.spec.dataset.options.split("|")) { const [v, t] = o.split(":"); input.append(el("option", { value: v, text: t })); }
    } else input = el("input", { type: "text", id: inputId, autocomplete: "off", spellcheck: "false", placeholder: p.spec.dataset.placeholder || "" });
    p.spec.classList.add("ans-row");
    if (isSelf) p.spec.classList.add("self");
    if (p.type === "output") p.spec.classList.add("mono-answer");
    p.spec.dataset.itemId = p.pid;
    const partFb = el("p", { class: "part-fb", role: "status" });
    p.spec.append(el("label", { for: inputId, text: label }), input);
    if (isSelf) p.spec.append(el("span", { class: "where", text: "check yourself against the solution" }));
    p.spec.append(partFb);
    p.fb = partFb;
    rows.append(p.spec);
    const onEdit = () => {
      state.parts = { ...state.parts, [p.pid]: { ...(state.parts[p.pid] || {}), raw: input.value } };
      window.CourseStore.invalidateCurrentGrade(state, { pid: p.pid, self: isSelf });
      input.classList.remove("ok", "bad");
      partFb.textContent = ""; partFb.className = "part-fb";
      if (!state.result) { fb.textContent = ""; fb.className = "feedback"; }
      render();
      updateProgress();
      saveSoon();
    };
    input.addEventListener(p.type === "choice" ? "change" : "input", onEdit);
    if (!isSelf && p.type !== "choice") input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
    return input;
  });

  const checkBar = el("div", { class: "row" });
  const checkBtn = el("button", { class: "btn primary check-btn", type: "button", text: auto.length > 1 ? "Check answers" : "Check" });
  const fb = el("p", { class: "feedback", role: "status" });
  if (hasAuto) checkBar.append(checkBtn);
  myWork.append(checkBar, fb);
  const workId = `${id}--work`;
  const work = el("textarea", { id: workId, rows: "4", placeholder: "Your reasoning: the lines you followed, the runs you predicted, what you'd change." });
  myWork.append(el("label", { class: "work-label", for: workId, text: "Your work" }), work);
  work.addEventListener("input", () => { state.work = work.value; saveSoon(); });

  const actions = el("div", { class: "task-actions" });
  const hintBtn = el("button", { class: "btn hint-btn", type: "button" });
  const solBtn = el("button", { class: "btn sol-btn", type: "button" });
  const clearBtn = el("button", { class: "btn quiet", type: "button", text: "Clear my work" });
  if (hintItems.length) actions.append(hintBtn);
  actions.append(solBtn, clearBtn);
  task.insertBefore(actions, hintList || solution);
  const selfMark = el("div", { class: "self-mark" });
  const gotBtn = el("button", { class: "chip", type: "button", text: "I got it" });
  const missBtn = el("button", { class: "chip", type: "button", text: "I missed something" });
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
    const empty = auto.filter((p) => !inputs[parts.indexOf(p)].value.trim());
    if (empty.length) {
      fb.className = "feedback";
      fb.textContent = auto.length > 1 ? "Fill in every answer box first. (Type nothing if a run prints nothing.)" : "Type an answer first.";
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
      p.fb.textContent = correct ? "" : g.status === "unreadable" ? `Couldn't read that. ${g.message}` : g.message;
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
    const clearAll = el("button", { class: "btn quiet", type: "button", text: "Clear all on this page" });
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
      const again = el("button", { class: "btn", type: "button", text: "Start over" });
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
      const check = el("button", { class: "btn primary check-btn", type: "button", text: "Check" });
      const showBtn = el("button", { class: "btn", type: "button", text: "Show answer" });
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
  $$("pre.code[data-src]").forEach(renderCode);
  buildPagers();
  setupMenu();
  $$(".term[data-session]").forEach(renderSessionTerm);
  createRunner($('.runner[data-runner="hero"]'));
  $$(".shell[data-shell]").forEach(setupShell);
  setupArgWalk(); setupCompare(); setupProgramMap(); setupPromises(); setupEdgeLab(); setupTimer();
  setupTasks(); setupSteps(); setupRunButtons(); setupChecks(); setupSorter(); setupQuizzes();
  addEventListener("pagehide", () => flushPendingInput());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushPendingInput(); });
  addEventListener("hashchange", () => { flushPendingInput(); show(location.hash.slice(1)); });
  show(location.hash.slice(1) || "home");
  document.documentElement.dataset.ready = "true";
}
boot();
