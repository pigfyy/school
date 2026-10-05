"use strict";
/* CSE 332 week 1 · page behavior.
   State: everything persisted goes through window.CourseStore (js/store.js). This file owns the in-page UI state only.
   Grading: window.Grader (js/grader.js). Simulations: window.Sim (js/sim.js). */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const SITE_ID = "cse332-26au-week1";
const G = window.Grader, Sim = window.Sim;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) if (c !== null && c !== undefined) node.append(c);
  return node;
}
function svgEl(tag, attrs = {}, text) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}
const fmtInt = (x) => (typeof x === "bigint" ? x.toLocaleString("en-US") : Number(x).toLocaleString("en-US"));
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const KATEX_OPTS = {
  delimiters: [{ left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }],
  throwOnError: false,
};
const renderMath = (node) => window.renderMathInElement && window.renderMathInElement(node, KATEX_OPTS);

/* =========================================================== transient notices (never a persistent status bar) */
const NOTICE_TEXT = {
  "save-failed": ["bad", "Couldn't save your work to the server. It's kept in this browser and will retry."],
  "save-recovered": ["ok", "Saved again. Everything you did meanwhile is stored."],
  "conflict-merged": ["info", "Your work changed somewhere else too. Both versions were combined; nothing you typed was lost."],
  "load-failed": ["bad", "Couldn't load saved work from the server. Showing what's in this browser."],
  "mirror-failed": ["bad", "This browser is blocking local storage, so work may not survive a reload."],
  "newer-version": ["bad", "Your saved work is from a newer version of this site. It won't be overwritten here."],
};
const shownNotice = new Map();
function notice(code) {
  const [cls, text] = NOTICE_TEXT[code] || ["info", code];
  const last = shownNotice.get(code) || 0;
  if (Date.now() - last < 4000) return; // don't stack identical notices
  shownNotice.set(code, Date.now());
  const box = $("#toasts");
  const close = el("button", { "aria-label": "Dismiss", text: "✕" });
  const t = el("div", { class: `toast ${cls}`, role: cls === "bad" ? "alert" : "status", "data-notice": code }, el("span", { text }), close);
  box.append(t);
  const kill = () => t.remove();
  close.addEventListener("click", kill);
  setTimeout(kill, cls === "bad" ? 7000 : 4500);
}

/* =========================================================== store */
const store = window.CourseStore.create({
  siteId: SITE_ID,
  adapter: window.COURSE_SITE_STORAGE || undefined,
  onNotice: notice,
  onChange: (change) => document.dispatchEvent(new CustomEvent("course-site:change", { detail: change })),
  // Typed input is written to the store synchronously, so the DOM never holds unsaved text when the store
  // changes underneath (conflict merge / late load). Repaint from the merged store.
  onExternalUpdate: () => { if (booted) ITEMS.forEach((it) => it.restore()); refreshProgress(); },
});
const ITEMS = new Map();   // id -> { kind, restore(), flushDraft() }
let booted = false;

// Every input handler writes to the store synchronously (only the network write is debounced), so this is a
// safety net: before any store-driven repaint (Check, hint, solution, reveal, clear) and on pagehide /
// visibilitychange, push any DOM value that somehow differs from the store.
function flushAllDrafts() { ITEMS.forEach((it) => it.flushDraft && it.flushDraft()); }
window.addEventListener("pagehide", () => { flushAllDrafts(); store.flush(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { flushAllDrafts(); store.flush(); } });

/* The one shared edit path. Every input type (quiz numeric, quiz MC, quick checks of every grader kind,
   problem auto parts of every grader kind, self-check parts and the self-mark, the work box) calls this on edit:
   write the raw draft into the store synchronously, clear the current grade (CourseStore.clearGrade), and clear
   the DOM feedback via the item's own clearFeedback(). attempts[] and events[] are never touched. */
function editDraft(id, kind, applyDraft, clearFeedback, { invalidate = true } = {}) {
  store.update(id, kind, (r) => {
    applyDraft(r);
    if (invalidate) window.CourseStore.clearGrade(r);
  });
  if (invalidate && clearFeedback) clearFeedback();
  refreshProgress();
}

/* =========================================================== routing */
const PAGES = $$(".page").map((p) => ({ id: p.id, title: p.dataset.title }));
function show(id) {
  if (!PAGES.some((p) => p.id === id)) id = "home";
  $(".rail").classList.remove("open");
  $("#menu-btn").setAttribute("aria-expanded", "false");
  $$(".page").forEach((p) => p.classList.toggle("is-active", p.id === id));
  $$(".rail a[href^='#']").forEach((a) => {
    if (a.classList.contains("brand")) return;
    if (a.getAttribute("href") === `#${id}`) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = `${PAGES.find((p) => p.id === id).title} · CSE 332 week 1`;
  window.scrollTo(0, 0);
  if (id === "asymptotic") { drawGrowth(); $("#cn-claim").dispatchEvent(new Event("redraw")); } // chart sizes need a visible page
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
document.addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "ArrowRight") go(1);
  else if (e.key === "ArrowLeft") go(-1);
  else if (e.key === "n" || e.key === "N") nextStepOnPage();
  else if (e.key === "h" || e.key === "H") nextHintOnPage();
});

/* =========================================================== step reveals */
function setupSteps() {
  $$(".steps").forEach((steps) => {
    const items = $$(":scope > ol > li", steps);
    let shown = 0;
    const bar = el("div", { class: "step-bar" });
    const next = el("button", { class: "btn primary", text: "Show first step" });
    const all = el("button", { class: "btn", text: "Show all" });
    const reset = el("button", { class: "btn", text: "Hide steps" });
    const count = el("span", { class: "brute" });
    bar.append(next, all, reset, count);
    steps.append(bar);
    function render(just) {
      items.forEach((li, i) => { li.hidden = i >= shown; li.classList.toggle("just-shown", i === just); });
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
function nextStepOnPage() {
  for (const steps of $$(".page.is-active .steps")) {
    if (steps.closest(".solution[hidden]")) continue;
    const hidden = $(":scope > ol > li[hidden]", steps);
    if (hidden) { steps._reveal(); hidden.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" }); return; }
  }
}

/* =========================================================== misconception feedback (never reveals the answer) */
const MISCON = {
  "back-points-last": "Check what back points to: the first open slot, not the last item.",
  "no-wrap": "That index is past the end of the array. back wraps with % queue.length.",
  "stale-slot": "That value was dequeued earlier, but the slot gets reused. Which enqueue landed at index 0?",
  "lifo-q": "That's the order a stack would give. A queue removes the oldest item first.",
  "fifo": "That's what a queue would return. A stack's pop takes the most recent push.",
  "first-pop": "That's what the first pop returns. Keep going: what's on top after the next push?",
  "new-t-array": "Java has a rule about creating arrays of a type parameter. Look at how the Tuple constructor makes its array.",
  "bound-is-upper": "T extends Animal means T can be Animal itself. What does that allow for first and second?",
  "t-is-fixed": "Once T is chosen, both fields have that exact type. Is a Cat a Dog?",
  "added-loops": "You added the two loops' counts. The inner loop runs completely for each outer iteration.",
  "inner-only": "That's one outer iteration's worth. How many outer iterations are there?",
  "counted-adds": "This asks for prints only. m.add isn't a print.",
  "if-branch": "That's the cheap branch. The worst case takes the slower branch of the conditional.",
  "extra-op": "Close. Recount the conditional: b % 2 is one op, and == isn't arithmetic.",
  "forgot-constant": "Close, but you've dropped the operations outside the loops. Count every line.",
  "no-divide": "That's the cost of one 3-day cycle. The question asks per day.",
  "rounding": "Round to the cent (two decimal places).",
  "two-days": "The fine comes on the 3rd unpaid day. How many days does one cycle cover?",
  "forgot-copies": "That counts only the writes. Slide 21 also charges 1 for each element resize() copies.",
  "copies-every-add": "Copies happen only when the array is full, not on every add.",
  "amortized-vs-worst": "That's the cost of a typical add. This one triggers resize(), so count its copies too.",
  "forgot-write": "resize() copies the old elements, then add still writes the new value.",
  "copied-new-length": "resize() copies the old array's elements. How long was the old array?",
  "only-last-block": "That's one block's cost. Add the cost of every block.",
  "halved-once": "That's after one halving. Keep halving until the gap is 1.",
  "linear-count": "That's how many items a linear scan would look at. Each binary-search iteration halves the range.",
  "stopped-early": "Close. The loop still runs one more time when end − start is 1.",
  "strict-vs-equal": "At that n the two sides aren't in the right order yet. Check that value directly.",
  "dropped-constant": "Your crossover ignores the +900. Solve the full inequality.",
  "biggest-coefficient": "B has the biggest coefficient, but for large n the highest power of n wins.",
  "not-tight": "That's a valid upper bound, but not the tightest bucket. Drop constants and lower-order terms of the actual count.",
  "too-small": "That bucket grows too slowly. Find the dominant term of the count.",
  "simplify-terms": "Correct bucket. Write it simplified, though: drop the non-dominant terms.",
  "simplify-constant": "Correct bucket. Write it simplified, though: drop the constant factor.",
  "leftover-t": "There's no T in UnlikePair<A,B>. Every T must become A or B.",
  "swapped": "Look at which field this spot reads or writes, and that field's declared type.",
  "missing-bound": "These parameters don't express the relationship yet. How do you require one type to be a subtype of another?",
  "bound-reversed": "That's the relationship backwards. Which item is the subtype?",
  "int-as-param": "Only the second item's type varies. The first is always an integer, so it doesn't need a type parameter.",
  "int-is-fixed": "The first item is always an integer, so it doesn't need a type parameter.",
  "one-param-pair": "You need two type parameters: one for the first item, and one for the things inside the pair.",
  "not-pair": "The second item isn't a single B. What kind of object holds two of them?",
  "raw-likepair": "LikePair needs its type argument. A pair of what?",
  "pair-of-supertype": "That pair could hold any A. The prompt asks for things whose type is a subclass of the first item's type.",
  "not-array": "The second item is several objects, not one.",
  "same-type-array": "The array holds objects of another type than the first item.",
  "object-array": "Use a type parameter so the caller chooses the element type.",
  "raw-comparable": "Comparable needs a type argument: what does an A compare itself to?",
  "raw-pair": "ComparablePair is generic. Write it with its type arguments.",
  "compare-element": "That compares the elements. The class itself must be comparable to another pair.",
  "object-param": "Comparable<…> fixes the parameter type of compareTo. What did the implements clause say?",
};
const miscText = (tag) => MISCON[tag] || null;

/* =========================================================== graders by kind (shared by quick checks, quiz, problem parts) */
const isBlank = (s) => !String(s ?? "").trim();
function gradeValue(spec, raw) {
  const d = spec.dataset;
  const miscon = d.miscon ? JSON.parse(d.miscon) : {};
  switch (d.grader) {
    case "exact": return G.checkExact(raw, d.answer, miscon);
    case "decimal": return G.checkDecimal(raw, d.answer, d.tol, miscon);
    case "formula": return G.checkFormula(raw, d.answer, JSON.parse(d.points), miscon);
    case "bigo": return G.checkBigO(raw, d.answer);
    case "yesno": {
      const r = G.checkYesNo(raw, d.answer);
      if (r.ok === false) r.tag = miscon[r.normalized] || null;
      return r;
    }
    case "choice": return G.checkChoice(raw, d.answer, JSON.parse(d.choices), miscon);
    default: throw new Error(`no grader ${d.grader}`);
  }
}
const UNREADABLE = {
  exact: "Couldn't read that. Use a whole number or arithmetic like 4*7+4.",
  decimal: "Couldn't read that. Use a number like 12.34.",
  formula: "Couldn't read that. Use numbers, the variable (n or c) and + − * / ^ with parentheses.",
  bigo: "Couldn't read that as a Big-O class. Try O(n), n^2, log n or n log n.",
  yesno: "Answer yes or no.",
  choice: "Answer with one of the letters given.",
  java: "Type a Java type, e.g. A or LikePair<B>.",
  bound: "Use a positive number, e.g. 3 or 1/2.",
};
function feedbackFor(kind, res) {
  if (res.ok === null) return ["bad", UNREADABLE[kind]];
  if (res.ok) return ["ok", res.tag && miscText(res.tag) ? miscText(res.tag) : "Correct."];
  const m = res.tag && miscText(res.tag);
  return ["bad", m || res.note || "Not quite. Try again, or ask for a hint."];
}

/* =========================================================== quick checks */
function setupChecks() {
  $$(".check[data-id]").forEach((box) => {
    const id = box.dataset.id;
    const kind = box.dataset.grader;
    const isMc = kind === "mc";
    const input = $("input[type=text]", box);
    const radios = $$("input[type=radio]", box);
    const labels = $$(".opts label", box);
    const fb = $(".feedback", box);
    const btn = $("button.primary", box);

    function clearFeedback() {
      fb.className = "feedback"; fb.textContent = "";
      labels.forEach((l) => { l.classList.remove("right", "wrong"); $(".why", l).hidden = true; });
    }
    const draft = isMc
      ? () => editDraft(id, "quickcheck", (r) => { r.choice = radios.findIndex((x) => x.checked); }, clearFeedback)
      : () => editDraft(id, "quickcheck", (r) => { r.raw = input.value; }, clearFeedback);
    if (isMc) radios.forEach((r) => r.addEventListener("change", draft));
    else input.addEventListener("input", draft);

    function flushDraft() {
      const r = store.get(id);
      if (isMc) { const c = radios.findIndex((x) => x.checked); if (c !== -1 && (!r || r.choice !== c)) draft(); }
      else if ((r ? r.raw : "") !== input.value) draft();
    }

    function check() {
      flushAllDrafts();
      if (isMc) {
        const choice = radios.findIndex((x) => x.checked);
        if (choice === -1) { fb.className = "feedback"; fb.textContent = "Pick an option first."; return; }
        const ok = labels[choice].hasAttribute("data-correct");
        store.appendAttempt(id, "quickcheck", {
          answer: { choice, value: labels[choice].textContent.replace($(".why", labels[choice]).textContent, "").trim() },
          result: { overall: ok }, feedbackKind: ok ? "correct" : `option-${choice}`,
        }, (r) => { r.choice = choice; r.normalized = String(choice); r.correct = ok; r.feedbackKind = ok ? "correct" : `option-${choice}`; });
      } else {
        if (isBlank(input.value)) { fb.className = "feedback"; fb.textContent = "Type an answer first."; return; }
        const res = gradeValue(box, input.value);
        if (res.ok === null) { fb.className = "feedback bad"; fb.textContent = UNREADABLE[kind]; return; }
        const fk = res.ok ? (res.tag || "correct") : (res.tag || "incorrect");
        store.appendAttempt(id, "quickcheck", {
          answer: { raw: input.value, normalized: res.normalized },
          result: { overall: res.ok }, feedbackKind: fk,
        }, (r) => { r.raw = input.value; r.normalized = res.normalized; r.correct = res.ok; r.feedbackKind = fk; });
      }
      restore();
    }
    btn.addEventListener("click", check);
    if (input) input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });

    function restore() {
      const r = store.get(id);
      clearFeedback();
      if (isMc) {
        radios.forEach((x, i) => { x.checked = Boolean(r && r.choice === i); });
        if (r && r.correct !== null && r.choice !== null && r.choice >= 0) {
          const l = labels[r.choice];
          l.classList.add(r.correct ? "right" : "wrong");
          $(".why", l).hidden = false;
          fb.className = `feedback ${r.correct ? "ok" : "bad"}`;
          fb.textContent = r.correct ? "Correct." : "Not this one. Read why, then try another.";
        }
      } else {
        input.value = r ? r.raw : "";
        input.classList.remove("ok", "bad");
        if (r && r.correct !== null) {
          const [cls, text] = feedbackFor(kind, { ok: r.correct, tag: r.feedbackKind === "correct" || r.feedbackKind === "incorrect" ? null : r.feedbackKind });
          fb.className = `feedback ${cls}`; fb.textContent = text;
        }
      }
    }
    ITEMS.set(id, { kind: "quickcheck", restore, flushDraft });
    restore();
  });
}

/* =========================================================== problems (article.task) */
function setupTasks() {
  $$(".task[data-id]").forEach(buildTask);
  $$(".page").forEach((page) => {
    if (!$(".task[data-id]", page)) return;
    const bar = el("div", { class: "task-progress" }, el("p", { class: "progress-text", role: "status" }));
    page.insertBefore(bar, $(".task[data-id]", page));
  });
}

function buildTask(task) {
  const id = task.dataset.id;
  const title = $("h2", task).textContent;
  const specs = $$(".answer-spec", task);
  const javaParams = task.dataset.javaParams ? JSON.parse(task.dataset.javaParams) : null;
  const allSelf = specs.every((s) => s.dataset.grader === "self");
  const hintList = $(".hints", task);
  const hintItems = hintList ? $$("li", hintList) : [];
  const solution = $(".solution", task);
  const partId = (spec) => `${id}.${spec.dataset.part}`;

  const pill = el("span", { class: "pill" });
  $("h2", task).append(" ", pill);

  const myWork = el("div", { class: "my-work" });
  task.insertBefore(myWork, specs[0]);
  const rows = el("div", { class: "ans-rows" });
  myWork.append(rows);
  const fb = el("p", { class: "feedback", role: "status" });

  const inputs = specs.map((spec) => {
    const pid = partId(spec);
    spec.dataset.id = pid;
    const domId = pid.replace(/\./g, "-");
    const ph = { exact: "a number, e.g. 4*7+4", decimal: "e.g. 12.34", formula: "a formula, e.g. 3n+2", bigo: "e.g. O(n)", yesno: "yes or no", choice: "a, b or c", java: "a Java type", bound: "a number", self: "your answer" }[spec.dataset.grader];
    const input = el("input", { type: "text", id: domId, autocomplete: "off", spellcheck: "false", placeholder: ph, class: spec.dataset.grader === "java" ? "mono" : null });
    spec.classList.add("ans-row");
    const label = el("label", { for: domId });
    label.textContent = spec.dataset.label || "Your answer"; // KaTeX auto-render handles \( \) in text
    spec.append(label, input, el("p", { class: "part-fb" }));
    if (spec.dataset.grader === "self") spec.append(el("span", { class: "where", text: "check against the solution" }));
    rows.append(spec);
    input.addEventListener("input", () => editDraft(id, "problem", (r) => {
      r.parts[spec.dataset.part] = { ...window.CourseStore.BLANK.part(), ...(r.parts[spec.dataset.part] || {}), raw: input.value };
    }, clearFeedback));
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !allSelf) check(); });
    return input;
  });

  const checkBar = el("div", { class: "row" });
  const checkBtn = el("button", { class: "btn primary", text: specs.length > 1 ? "Check answers" : "Check" });
  if (!allSelf) checkBar.append(checkBtn);
  myWork.append(checkBar, fb);

  const workId = `${id}-work`;
  const work = el("textarea", { id: workId, rows: "4", placeholder: "Explain how you got your answer. Math works too, e.g. \\( 4n+4 \\)" });
  const preview = el("div", { class: "work-preview", "aria-live": "polite" });
  preview.hidden = true;
  const copies = el("div");
  myWork.append(el("label", { class: "work-label", for: workId, text: "Your work" }), work, preview, copies);
  let previewTimer;
  const renderPreview = () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const has = /\\\(|\\\[/.test(work.value);
      preview.hidden = !has;
      if (has) { preview.textContent = work.value; renderMath(preview); }
    }, 300);
  };
  // The work box is a snapshot; it is never graded, so editing it doesn't clear a grade.
  work.addEventListener("input", () => { editDraft(id, "problem", (r) => { r.work = work.value; }, null, { invalidate: false }); renderPreview(); });

  const actions = el("div", { class: "task-actions" });
  const hintBtn = el("button", { class: "btn" });
  const solBtn = el("button", { class: "btn" });
  const clearBtn = el("button", { class: "btn quiet", text: "Clear my work" });
  if (hintItems.length) actions.append(hintBtn);
  actions.append(solBtn, clearBtn);
  task.insertBefore(actions, hintList || solution);

  const selfMark = el("div", { class: "self-mark" });
  const gotBtn = el("button", { class: "chip", text: "I got it" });
  const missBtn = el("button", { class: "chip", text: "I missed something" });
  selfMark.append(el("span", { text: "How did you do? " }), gotBtn, missBtn);
  if (allSelf) solution.after(selfMark);

  let armed = false;

  function clearFeedback() {
    fb.className = "feedback"; fb.textContent = "";
    inputs.forEach((x) => x.classList.remove("ok", "bad"));
    specs.forEach((s) => { $(".part-fb", s).textContent = ""; });
    renderStatus();
  }

  function flushDraft() {
    const r = store.get(id);
    specs.forEach((spec, i) => {
      const saved = r && r.parts[spec.dataset.part] ? r.parts[spec.dataset.part].raw : "";
      if (saved !== inputs[i].value) inputs[i].dispatchEvent(new Event("input"));
    });
    if ((r ? r.work : "") !== work.value) work.dispatchEvent(new Event("input"));
  }

  function statusOf(r) {
    if (!r) return ["Not started", ""];
    if (r.result === "right" || r.selfMark === "got") return ["Correct", "ok"];
    if (r.result === "wrong" || r.selfMark === "missed") return ["Not yet", "bad"];
    if (window.CourseStore.liveAttempts(r).length) return ["Submitted, edited since", "prog"];
    if (r.solutionViewed) return ["Solution viewed", "seen"];
    const any = Object.values(r.parts || {}).some((p) => !isBlank(p.raw)) || !isBlank(r.work) || r.hintsRevealed;
    return any ? ["In progress", "prog"] : ["Not started", ""];
  }
  function renderStatus() {
    const r = store.get(id);
    const [label, cls] = statusOf(r);
    pill.textContent = label;
    pill.className = `pill ${cls}`;
  }

  function render() {
    const r = store.get(id) || window.CourseStore.BLANK.problem();
    renderStatus();
    hintItems.forEach((li, i) => { li.hidden = i >= r.hintsRevealed; });
    if (hintList) hintList.hidden = r.hintsRevealed === 0;
    const n = hintItems.length, k = r.hintsRevealed;
    hintBtn.textContent = k === 0 ? `Need a hint? (${n} available)` : k < n ? `Another hint (${k} of ${n} shown)` : `All ${n} hints shown`;
    hintBtn.disabled = k >= n;
    solution.hidden = !r.solutionOpen;
    solBtn.textContent = r.solutionOpen ? "Hide solution" : armed ? "Show solution anyway" : "Show solution";
    selfMark.hidden = !r.solutionOpen;
    gotBtn.setAttribute("aria-pressed", String(r.selfMark === "got"));
    missBtn.setAttribute("aria-pressed", String(r.selfMark === "missed"));
    copies.replaceChildren(...(r.conflictCopies || []).map((c) => el("div", { class: "conflict-copy" }, el("strong", { text: "Also kept from another session: " }), c.value)));
    refreshProgress();
  }

  function gradeParts() {
    const auto = specs.filter((s) => s.dataset.grader !== "self");
    const results = new Map();
    const java = auto.filter((s) => s.dataset.grader === "java");
    if (java.length) {
      const out = G.checkJavaParts(java.map((s) => ({
        id: s.dataset.part, raw: inputs[specs.indexOf(s)].value, header: s.hasAttribute("data-header"),
        accept: JSON.parse(s.dataset.accept), miscon: s.dataset.miscon ? JSON.parse(s.dataset.miscon) : {},
      })), javaParams);
      out.forEach((r) => results.set(r.id, r));
    }
    const bound = auto.filter((s) => s.dataset.grader === "bound");
    if (bound.length) {
      const cSpec = bound.find((s) => s.dataset.role === "c"), nSpec = bound.find((s) => s.dataset.role === "n0");
      const b = G.checkBound(JSON.parse(cSpec.dataset.bound), inputs[specs.indexOf(cSpec)].value, inputs[specs.indexOf(nSpec)].value);
      if (b.unreadable) { results.set(cSpec.dataset.part, { ok: null }); results.set(nSpec.dataset.part, { ok: null }); }
      else {
        // graded as a pair: a part that can't be judged on its own is "skip" (correct: null), never "unreadable"
        const detail = boundDetail(b, JSON.parse(cSpec.dataset.bound));
        const verdict = b.holds ? [true, true]
          : b.tag === "n0-too-small" || b.tag === "n0-not-positive" ? [true, false]
          : [false, "skip"];
        const mk = (v, norm) => (v === "skip" ? { ok: null, skip: true, normalized: norm, tag: b.tag, detail } : { ok: v, normalized: norm, tag: b.tag || null, detail });
        results.set(cSpec.dataset.part, mk(verdict[0], b.normalized.c));
        results.set(nSpec.dataset.part, mk(verdict[1], b.normalized.n0));
      }
    }
    for (const s of auto) {
      if (results.has(s.dataset.part)) continue;
      const v = inputs[specs.indexOf(s)].value;
      results.set(s.dataset.part, isBlank(v) ? { ok: null, blank: true } : gradeValue(s, v));
    }
    return { auto, results };
  }

  function check() {
    flushAllDrafts();
    const { auto, results } = gradeParts();
    if (auto.some((s) => isBlank(inputs[specs.indexOf(s)].value))) {
      fb.className = "feedback"; fb.textContent = auto.length > 1 ? "Fill in every answer box first." : "Type an answer first.";
      return;
    }
    const unreadable = auto.filter((s) => results.get(s.dataset.part).ok === null && !results.get(s.dataset.part).skip);
    if (unreadable.length) {
      unreadable.forEach((s) => { $(".part-fb", s).textContent = UNREADABLE[s.dataset.grader]; inputs[specs.indexOf(s)].classList.add("bad"); });
      fb.className = "feedback bad"; fb.textContent = "Some boxes couldn't be read. See the notes under them.";
      return;
    }
    const all = auto.every((s) => results.get(s.dataset.part).ok === true);
    const answer = {}, result = { parts: {}, overall: all };
    for (const s of specs) {
      const p = s.dataset.part, raw = inputs[specs.indexOf(s)].value;
      const r = results.get(p);
      answer[p] = { raw, normalized: r ? r.normalized ?? null : null };
      result.parts[p] = r ? r.ok : null;
    }
    const tags = [...new Set(auto.map((s) => results.get(s.dataset.part).tag).filter(Boolean))];
    const fk = all ? (tags.length ? tags.join(",") : "correct") : (tags.length ? tags.join(",") : "incorrect");
    store.appendAttempt(id, "problem", { answer, result, feedbackKind: fk }, (rec) => {
      for (const s of specs) {
        const p = s.dataset.part, r = results.get(p);
        rec.parts[p] = { ...window.CourseStore.BLANK.part(), raw: inputs[specs.indexOf(s)].value,
          normalized: r ? r.normalized ?? null : null, correct: r ? r.ok : null, feedbackKind: r ? (r.ok ? (r.tag || "correct") : (r.tag || "incorrect")) : null,
          detail: r && r.detail ? r.detail : (r && r.note) || null };
      }
      rec.result = all ? "right" : "wrong";
    });
    restore();
  }

  checkBtn.addEventListener("click", check);
  hintBtn.addEventListener("click", () => {
    flushAllDrafts();
    const r = store.get(id);
    const k = Math.min(hintItems.length, (r ? r.hintsRevealed : 0) + 1);
    store.logEvent(id, "problem", "hint", { level: k }, (rec) => { rec.hintsRevealed = k; });
    render();
    hintItems[k - 1].classList.add("just-shown");
  });
  solBtn.addEventListener("click", () => {
    flushAllDrafts();
    const r = store.get(id);
    if (r && r.solutionOpen) {
      store.update(id, "problem", (rec) => { rec.solutionOpen = false; });
      render();
      return;
    }
    const attempted = inputs.some((x) => !isBlank(x.value)) || (r && window.CourseStore.liveAttempts(r).length);
    if (!attempted && !armed && !(r && r.solutionViewed)) {
      armed = true;
      fb.className = "feedback";
      fb.textContent = "You haven't answered yet. Press the button again to see the solution anyway.";
      render();
      return;
    }
    armed = false;
    store.logEvent(id, "problem", "solution", { answered: Boolean(attempted) }, (rec) => { rec.solutionOpen = true; rec.solutionViewed = true; });
    if (fb.textContent.startsWith("You haven't answered")) { fb.textContent = ""; fb.className = "feedback"; }
    render();
  });
  const mark = (value) => {
    flushAllDrafts();
    const answer = {};
    specs.forEach((s, i) => { answer[s.dataset.part] = { raw: inputs[i].value, normalized: null }; });
    store.appendAttempt(id, "problem", {
      answer, result: { parts: Object.fromEntries(specs.map((s) => [s.dataset.part, null])), overall: value === "got", selfMark: value },
      feedbackKind: `self-${value}`,
    }, (rec) => { rec.selfMark = value; });
    render();
  };
  gotBtn.addEventListener("click", () => mark("got"));
  missBtn.addEventListener("click", () => mark("missed"));
  clearBtn.addEventListener("click", () => {
    if (!confirm(`Clear your answers, work, hints and solution view for "${title}"? Your submitted attempts stay in the history.`)) return;
    store.clearItem(id, "problem");
    restore();
  });

  function restore() {
    const r = store.get(id);
    armed = false;
    specs.forEach((s, i) => {
      const p = r && r.parts[s.dataset.part];
      inputs[i].value = p ? p.raw : "";
      inputs[i].classList.remove("ok", "bad");
      $(".part-fb", s).textContent = "";
      if (p && p.correct !== null && s.dataset.grader !== "self") {
        inputs[i].classList.add(p.correct ? "ok" : "bad");
        if (!p.correct || (p.feedbackKind && p.feedbackKind !== "correct")) {
          const msg = (p.feedbackKind && miscText(p.feedbackKind)) || p.detail || (p.correct ? "" : "Not right yet.");
          $(".part-fb", s).textContent = msg;
          $(".part-fb", s).style.color = p.correct ? "var(--right)" : "";
        }
      }
    });
    work.value = r ? r.work : "";
    fb.className = "feedback";
    fb.textContent = "";
    if (r && r.result) {
      const n = Object.values(r.parts).filter((p) => p.correct === true).length;
      const total = specs.filter((s) => s.dataset.grader !== "self").length;
      fb.className = `feedback ${r.result === "right" ? "ok" : "bad"}`;
      fb.textContent = r.result === "right" ? (total > 1 ? "All correct." : "Correct.") : total > 1 ? `${n} of ${total} right. The boxes in red need another look.` : "Not quite. Try again, or ask for a hint.";
    }
    renderPreview();
    render();
  }

  ITEMS.set(id, { kind: "problem", restore, flushDraft, task });
  restore();
}

function boundDetail(b, spec) {
  const rel = spec.rel === "O" ? "≤" : "≥";
  if (b.holds) return `Works: f(n) ${rel} c·g(n) for every integer n ≥ ${b.normalized.n0}.`;
  if (b.tag === "c-not-positive") return "c has to be greater than 0.";
  if (b.tag === "n0-not-positive") return "n₀ has to be greater than 0.";
  const ce = b.counterexample;
  if (b.tag === "n0-too-small") return `Fails at n = ${ce.n}: f(n) = ${ce.f} but c·g(n) = ${ce.cg}. This c can work; try a larger n₀.`;
  return `Fails at n = ${ce.n} (f(n) = ${ce.f}, c·g(n) = ${ce.cg}), and with this c it keeps failing for every larger n. Change c.`;
}

function refreshProgress() {
  $$(".task-progress").forEach((bar) => {
    const page = bar.closest(".page");
    const recs = $$(".task[data-id]", page).map((t) => store.get(t.dataset.id));
    const submitted = recs.filter((r) => r && window.CourseStore.liveAttempts(r).length).length;
    const correct = recs.filter((r) => r && (r.result === "right" || r.selfMark === "got")).length;
    const seen = recs.filter((r) => r && r.solutionViewed).length;
    $(".progress-text", bar).textContent =
      `${submitted} of ${recs.length} submitted · ${correct} currently correct · ${seen} solution${seen === 1 ? "" : "s"} viewed`;
  });
  $$("[data-quiz-score]").forEach(updateQuizScore);
}

function nextHintOnPage() {
  const mid = innerHeight / 2;
  const c = $$(".page.is-active .task[data-id]")
    .map((task) => ({ task, btn: $$(".task-actions .btn:not([disabled])", task).find((b) => b.textContent.includes("hint")) }))
    .filter(({ btn }) => btn);
  if (!c.length) return;
  const dist = (t) => { const r = t.getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - mid); };
  c.sort((a, b) => dist(a.task) - dist(b.task));
  c[0].btn.click();
}

/* =========================================================== check your understanding */
function setupQuizzes() {
  $$(".cyu[data-id]").forEach((li, i) => {
    const id = li.dataset.id;
    const kind = li.dataset.kind; // mc | num | bigo
    const bar = el("div", { class: "row" });
    const check = el("button", { class: "btn primary", text: "Check" });
    const showBtn = el("button", { class: "btn", text: "Show answer" });
    const fb = el("p", { class: "feedback", role: "status" });
    const labels = $$(".opts label", li);
    const radios = labels.map((l) => $("input", l));
    const why = $(":scope > .why", li);
    let input = null;
    if (kind !== "mc") {
      input = el("input", { type: "text", "aria-label": `Answer to question ${i + 1}`, autocomplete: "off" });
      bar.append(input);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") check.click(); });
    }
    bar.append(check, showBtn);
    li.insertBefore(bar, why || null);
    li.insertBefore(fb, why || null);
    // the quiz uses the same graders as everything else
    li.dataset.grader = kind === "num" ? "exact" : kind === "bigo" ? "bigo" : "mc";

    function clearFeedback() {
      fb.className = "feedback"; fb.textContent = "";
      li.classList.remove("is-right");
      labels.forEach((l) => { l.classList.remove("right", "wrong"); $(".why", l).hidden = true; });
      if (why) why.hidden = true;
      showReveal(store.get(id)); // a revealed answer stays visible; only the grade is cleared
    }
    function showReveal(r) {
      if (!r || !r.revealed) return;
      if (kind === "mc") { const right = $("label[data-correct]", li); right.classList.add("right"); $(".why", right).hidden = false; }
      else if (why) why.hidden = false;
    }
    const draft = kind === "mc"
      ? () => editDraft(id, "quiz", (r) => { r.choice = radios.findIndex((x) => x.checked); }, clearFeedback)
      : () => editDraft(id, "quiz", (r) => { r.raw = input.value; }, clearFeedback);
    if (kind === "mc") radios.forEach((x) => x.addEventListener("change", draft));
    else input.addEventListener("input", draft);
    function flushDraft() {
      const r = store.get(id);
      if (kind === "mc") { const c = radios.findIndex((x) => x.checked); if (c !== -1 && (!r || r.choice !== c)) draft(); }
      else if ((r ? r.raw : "") !== input.value) draft();
    }

    check.addEventListener("click", () => {
      flushAllDrafts();
      if (kind === "mc") {
        const choice = radios.findIndex((x) => x.checked);
        if (choice === -1) { fb.className = "feedback"; fb.textContent = "Pick an option first."; return; }
        const ok = labels[choice].hasAttribute("data-correct");
        const fk = ok ? "correct" : `option-${choice}`;
        store.appendAttempt(id, "quiz", {
          answer: { choice, value: labels[choice].textContent.replace($(".why", labels[choice]).textContent, "").trim() },
          result: { overall: ok }, feedbackKind: fk,
        }, (r) => { r.choice = choice; r.normalized = String(choice); r.correct = ok; r.feedbackKind = fk; });
      } else {
        if (isBlank(input.value)) { fb.className = "feedback"; fb.textContent = "Type an answer first."; return; }
        const res = gradeValue(li, input.value);
        if (res.ok === null) { fb.className = "feedback bad"; fb.textContent = UNREADABLE[li.dataset.grader]; return; }
        const fk = res.ok ? (res.tag || "correct") : (res.tag || "incorrect");
        store.appendAttempt(id, "quiz", { answer: { raw: input.value, normalized: res.normalized }, result: { overall: res.ok }, feedbackKind: fk },
          (r) => { r.raw = input.value; r.normalized = res.normalized; r.correct = res.ok; r.feedbackKind = fk; });
      }
      restore();
    });
    showBtn.addEventListener("click", () => {
      flushAllDrafts(); // keep anything typed in the last few ms
      store.logEvent(id, "quiz", "reveal", null, (r) => { r.revealed = true; });
      restore();
    });

    function restore() {
      const r = store.get(id);
      clearFeedback();
      if (kind === "mc") radios.forEach((x, k) => { x.checked = Boolean(r && r.choice === k); });
      else input.value = r ? r.raw : "";
      if (!r) return;
      if (r.correct !== null) {
        if (kind === "mc" && r.choice >= 0) {
          const l = labels[r.choice];
          l.classList.add(r.correct ? "right" : "wrong");
          $(".why", l).hidden = false;
          fb.className = `feedback ${r.correct ? "ok" : "bad"}`;
          fb.textContent = r.correct ? "Correct." : "Not this one. Read why, then try another.";
        } else if (kind !== "mc") {
          const [cls, text] = feedbackFor(li.dataset.grader, { ok: r.correct, tag: ["correct", "incorrect"].includes(r.feedbackKind) ? null : r.feedbackKind });
          fb.className = `feedback ${cls}`;
          fb.textContent = r.correct ? text : `${text === "Not quite. Try again, or ask for a hint." ? "Not quite. Try again, or press Show answer." : text}`;
          if (r.correct && why) why.hidden = false;
        }
        if (r.correct) li.classList.add("is-right");
      }
      if (r.revealed) {
        showReveal(r);
        if (!fb.textContent) { fb.className = "feedback"; fb.textContent = "Answer shown. A Check after this won't count as a first try."; }
      }
      refreshProgress();
    }
    ITEMS.set(id, { kind: "quiz", restore, flushDraft });
    restore();
  });

  $$("[data-quiz-summary]").forEach((sum) => {
    sum.addEventListener("click", (e) => {
      if (!e.target.matches("button[data-start-over]")) return;
      const list = $(`[data-quiz="${sum.dataset.quizSummary}"]`);
      $$(".cyu[data-id]", list).forEach((li) => { if (store.get(li.dataset.id)) store.clearItem(li.dataset.id, "quiz"); ITEMS.get(li.dataset.id).restore(); });
      refreshProgress();
      window.scrollTo(0, list.closest(".page").offsetTop);
    });
  });
}

/* Quiz counters. "Answered" = submitted at least once (any correctness) since the last Start over.
   "Correct on the first try" = the first submission was right and the answer wasn't revealed before it.
   An item revealed with Show answer and never submitted is NOT answered; it's listed under "to review". */
function updateQuizScore(scoreBox) {
  const q = scoreBox.dataset.quizScore;
  const items = $$(`[data-quiz="${q}"] .cyu[data-id]`);
  const recs = items.map((li) => store.get(li.dataset.id));
  const answered = recs.filter((r) => r && window.CourseStore.liveAttempts(r).length).length;
  const first = recs.filter((r) => r && window.CourseStore.firstTryCorrect(r)).length;
  scoreBox.textContent = `Answered ${answered} of ${items.length} · ${first} correct on the first try`;
  const sum = $(`[data-quiz-summary="${q}"]`);
  sum.replaceChildren();
  const done = recs.filter((r) => r && (window.CourseStore.liveAttempts(r).length || r.revealed)).length;
  if (done < items.length) { sum.textContent = `Answer or reveal all ${items.length} to see what to review.`; return; }
  const missed = [...new Set(items.filter((li, k) => !window.CourseStore.firstTryCorrect(recs[k])).map((li) => li.dataset.topic))];
  sum.append(el("strong", { text: `You got ${first} of ${items.length} on the first try. ` }));
  if (!missed.length) sum.append("Nothing to review.");
  else {
    sum.append("Worth another look: ");
    missed.forEach((id, k) => {
      const page = PAGES.find((p) => p.id === id);
      sum.append(el("a", { href: `#${id}`, text: page ? page.title : id }));
      if (k < missed.length - 1) sum.append(", ");
    });
    sum.append(".");
  }
  sum.append(" ", el("button", { class: "btn", "data-start-over": "", text: "Start over" }));
}

/* =========================================================== Lecture 1: queue visualizers */
function drawCells(box, q, { flash = -1 } = {}) {
  box.replaceChildren();
  for (let i = 0; i < q.length; i++) {
    const live = q.live(i);
    const c = el("div", { class: `cell${live ? "" : " empty"}${i === flash ? " just" : ""}` });
    const ptr = [];
    if (i === q.front) ptr.push("front");
    if (i === q.back) ptr.push("back");
    c.append(el("span", { class: `ptr${ptr.length === 1 && ptr[0] === "back" ? " back" : ""}`, text: ptr.join(" · ") }));
    c.append(el("b", { text: live ? String(q.queue[i]) : "·", title: live ? "" : `old value ${q.queue[i] ?? "none"} (not in the queue)` }));
    c.append(el("span", { class: "idx", text: String(i) }));
    box.append(c);
  }
}
function drawNodes(box, lq) {
  box.replaceChildren();
  const vals = lq.values();
  if (!vals.length) { box.append(el("span", { class: "null", text: "front = null, back = null (empty)" })); return; }
  vals.forEach((v, i) => {
    const n = el("div", { class: "node" });
    const ptr = i === 0 && i === vals.length - 1 ? "front · back" : i === 0 ? "front" : i === vals.length - 1 ? "back" : "";
    n.append(el("span", { class: `ptr${ptr === "back" ? " back" : ""}`, text: ptr }), el("b", { text: String(v) }));
    box.append(n);
    box.append(el("span", { class: "arrow", text: "→" }));
  });
  box.append(el("span", { class: "null", text: "null" }));
}
function logLine(box, text) {
  box.prepend(el("div", { text }));
  while (box.children.length > 40) box.lastChild.remove();
}
const valFrom = (inp) => { const v = Math.trunc(Number(inp.value)); return Number.isFinite(v) ? v : 0; };

function setupQueues() {
  // hero: both structures driven together
  let hl = Sim.linkedQueue(), hc = Sim.circularQueue();
  const heroMsg = $("#hero-msg");
  const heroDraw = (flash) => {
    drawNodes($("#hero-linked"), hl);
    drawCells($("#hero-circ"), hc, { flash });
    $("#hero-circ-note").textContent = `front = ${hc.front}, back = ${hc.back}, size = ${hc.size}`;
  };
  $("#hero-enq").addEventListener("click", () => {
    const x = valFrom($("#hero-val"));
    if (!hc.canEnqueue()) { heroMsg.textContent = "The array is full. Slide 19 would resize() here; that's Exercise 0."; return; }
    if (!hl.canEnqueue()) { heroMsg.textContent = "The linked queue is empty, so back is null and slide 15's enqueue would crash on back.next. Handling that is part of Exercise 0. Press Reset."; return; }
    const at = hc.back; hl.enqueue(x); hc.enqueue(x);
    heroMsg.textContent = `enqueue(${x})`;
    $("#hero-val").value = (x + 1) % 100;
    heroDraw(at);
  });
  $("#hero-deq").addEventListener("click", () => {
    if (hc.isEmpty()) { heroMsg.textContent = "Both are empty. dequeue assumes a non-empty queue."; return; }
    const a = hl.dequeue(), b = hc.dequeue();
    heroMsg.textContent = `dequeue() returned ${a} from both${a === b ? "" : ` (mismatch: ${b})`}.`;
    heroDraw();
  });
  $("#hero-reset").addEventListener("click", () => { hl = Sim.linkedQueue(); hc = Sim.circularQueue(); heroMsg.textContent = ""; heroDraw(); });
  heroDraw();

  // linked queue page
  let lq = Sim.linkedQueue();
  const lqLog = $("#lq-log");
  $("#lq-enq").addEventListener("click", () => {
    const x = valFrom($("#lq-val"));
    if (!lq.canEnqueue()) { logLine(lqLog, `enqueue(${x}): back is null, so back.next = last would throw a NullPointerException. The slide's code assumes a non-empty queue.`); return; }
    lq.enqueue(x);
    logLine(lqLog, `enqueue(${x}): last = new ListNode(${x}); back.next = last; back = last`);
    $("#lq-val").value = (x + 1) % 100;
    drawNodes($("#lq-nodes"), lq);
  });
  $("#lq-deq").addEventListener("click", () => {
    if (lq.isEmpty()) { logLine(lqLog, "dequeue(): front is null, so front.value would throw. The slide's code assumes a non-empty queue."); return; }
    const v = lq.dequeue();
    logLine(lqLog, `dequeue() → ${v}${lq.isEmpty() ? "; front became null, so back = null" : ""}`);
    drawNodes($("#lq-nodes"), lq);
  });
  $("#lq-reset").addEventListener("click", () => { lq = Sim.linkedQueue(); lqLog.replaceChildren(); drawNodes($("#lq-nodes"), lq); });
  drawNodes($("#lq-nodes"), lq);

  // circular array page
  let cq = Sim.circularQueue();
  const cqLog = $("#cq-log"), ringBtn = $("#cq-ring"), svg = $("#cq-svg");
  const drawRing = () => {
    svg.replaceChildren();
    const R = 120, cx = 160, cy = 160;
    for (let i = 0; i < cq.length; i++) {
      const a = (i / cq.length) * 2 * Math.PI - Math.PI / 2;
      const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      const live = cq.live(i);
      svg.append(svgEl("circle", { cx: x, cy: y, r: 22, fill: live ? "var(--a1-tint)" : "var(--surface)", stroke: live ? "var(--a1)" : "var(--line-strong)", "stroke-width": 2, "stroke-dasharray": live ? "" : "4 3" }));
      svg.append(svgEl("text", { x, y: y + 5, "text-anchor": "middle", style: "font-weight:600;fill:var(--ink);font-size:15px" }, live ? String(cq.queue[i]) : ""));
      const lx = cx + (R + 36) * Math.cos(a), ly = cy + (R + 36) * Math.sin(a);
      svg.append(svgEl("text", { x: lx, y: ly + 4, "text-anchor": "middle" }, String(i)));
    }
    const mark = (i, label, color, off) => {
      const a = (i / cq.length) * 2 * Math.PI - Math.PI / 2;
      svg.append(svgEl("text", { x: cx + (R - 46 - off) * Math.cos(a), y: cy + (R - 46 - off) * Math.sin(a) + 4, "text-anchor": "middle", style: `font-weight:700;fill:${color}` }, label));
    };
    mark(cq.front, "front", "var(--a1)", 0);
    mark(cq.back, "back", "var(--a2)", cq.back === cq.front ? 20 : 0);
  };
  const cqDraw = (flash) => {
    drawCells($("#cq-cells"), cq, { flash });
    $("#cq-state").textContent = `front = ${cq.front}, back = ${cq.back}, size = ${cq.size}, queue.length = ${cq.length}${cq.size === cq.length ? " (full: front == back, just like when empty)" : cq.size === 0 ? " (empty: front == back)" : ""}`;
    if (!svg.hidden) drawRing();
  };
  $("#cq-enq").addEventListener("click", () => {
    const x = valFrom($("#cq-val"));
    if (!cq.canEnqueue()) { logLine(cqLog, `enqueue(${x}): the array is full. Slide 18's code would overwrite queue[${cq.back}], the oldest item. Slide 19 calls resize() first; that's Exercise 0, so this visualizer stops here.`); return; }
    const at = cq.back;
    cq.enqueue(x);
    logLine(cqLog, `enqueue(${x}): queue[${at}] = ${x}; back = (${at} + 1) % ${cq.length} = ${cq.back}; size = ${cq.size}`);
    $("#cq-val").value = (x + 1) % 100;
    cqDraw(at);
  });
  $("#cq-deq").addEventListener("click", () => {
    if (cq.isEmpty()) { logLine(cqLog, "dequeue(): size is 0. The slide's code assumes the queue is not empty."); return; }
    const f = cq.front, v = cq.dequeue();
    logLine(cqLog, `dequeue() → ${v}: first = queue[${f}]; front = (${f} + 1) % ${cq.length} = ${cq.front}; size = ${cq.size}`);
    cqDraw();
  });
  $("#cq-reset").addEventListener("click", () => { cq = Sim.circularQueue(); cqLog.replaceChildren(); cqDraw(); });
  ringBtn.addEventListener("click", () => {
    svg.hidden = !svg.hidden;
    ringBtn.setAttribute("aria-pressed", String(!svg.hidden));
    cqDraw();
  });
  cqDraw();
}

function setupStackVsQueue() {
  const run = () => {
    const toks = $("#sq-script").value.trim().split(/\s+/).filter(Boolean);
    const ops = [];
    for (const t of toks) {
      if (t === "-") ops.push(["remove"]);
      else if (/^\+-?\d+$/.test(t)) ops.push(["add", Number(t.slice(1))]);
      else { $("#sq-stack-out").textContent = `Couldn't read "${t}". Use +number or -.`; $("#sq-queue-out").textContent = ""; return; }
    }
    const s = Sim.runAdt("stack", ops), q = Sim.runAdt("queue", ops);
    const col = $("#sq-stack");
    col.replaceChildren(...s.remaining.map((v, i) => el("b", { class: i === s.remaining.length - 1 ? "top" : "", text: String(v) })));
    $("#sq-queue").replaceChildren(...q.remaining.map((v) => el("div", { class: "cell" }, el("b", { text: String(v) }))));
    const fmtR = (r) => r.removed.map((x) => (x === null ? "(empty!)" : x)).join(", ") || "nothing";
    $("#sq-stack-out").textContent = `pops returned: ${fmtR(s)}`;
    $("#sq-queue-out").textContent = `dequeues returned: ${fmtR(q)}`;
  };
  $("#sq-run").addEventListener("click", run);
  $("#sq-script").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  run();
}

/* =========================================================== ADT terminology sorter */
function setupTermSort() {
  const CATS = ["?", "ADT", "Data structure", "Implementation", "Algorithm"];
  const TERMS = [
    ["Queue", "ADT"], ["Stack", "ADT"], ["Circular array queue", "Data structure"], ["Linked queue", "Data structure"],
    ["The steps of dequeue on a circular array", "Algorithm"], ["Your LinkedQueue.java for Exercise 0", "Implementation"],
  ];
  const list = $("#term-list"), out = $("#term-out");
  const state = TERMS.map(() => 0);
  const btns = TERMS.map(([t], i) => {
    const b = el("button", { class: "chip", style: "text-align:left;display:flex;justify-content:space-between;gap:1rem" });
    b.addEventListener("click", () => { state[i] = (state[i] + 1) % CATS.length; render(); out.textContent = ""; });
    list.append(b);
    return b;
  });
  function render() { btns.forEach((b, i) => { b.replaceChildren(el("span", { text: TERMS[i][0] }), el("strong", { text: CATS[state[i]] })); b.style.borderColor = ""; }); }
  $("#term-check").addEventListener("click", () => {
    let right = 0;
    btns.forEach((b, i) => { const ok = CATS[state[i]] === TERMS[i][1]; if (ok) right++; b.style.borderColor = ok ? "var(--right)" : "var(--wrong)"; });
    out.textContent = right === TERMS.length ? "All six sorted correctly." : `${right} of ${TERMS.length} right. The red ones need another look. Ask: is it a behavior, a strategy, or code?`;
  });
  $("#term-reset").addEventListener("click", () => { state.fill(0); render(); out.textContent = ""; });
  render();
}

/* =========================================================== Lecture 2: scenarios table */
function setupScenarios() {
  const a = Sim.SLIDE_SORTED;
  const cells = $("#scen-cells"), out = $("#scen-out"), missBtn = $("#scen-missing");
  a.forEach((v, i) => {
    const c = el("button", { class: "cell", style: "border:0;background:none;padding:0;cursor:pointer;font:inherit", "aria-label": `search for ${v}` }, el("b", { text: String(v) }), el("span", { class: "idx", text: String(i) }));
    c.addEventListener("click", () => {
      missBtn.setAttribute("aria-pressed", "false");
      const r = Sim.linearSearch(a, v);
      out.textContent = `contains(a, ${v}): ${r.comparisons} comparison${r.comparisons === 1 ? "" : "s"}.`;
    });
    cells.append(c);
  });
  missBtn.addEventListener("click", () => {
    missBtn.setAttribute("aria-pressed", "true");
    const r = Sim.linearSearch(a, 100);
    out.textContent = `contains(a, 100): ${r.comparisons} comparisons, then return false.`;
  });
  const counts = a.map((v) => Sim.linearSearch(a, v).comparisons);
  const worst = Math.max(...counts, Sim.linearSearch(a, 100).comparisons), best = Math.min(...counts);
  const total = counts.reduce((s, x) => s + x, 0);
  $("#scen-table").append(
    el("tr", {}, el("th", { text: "Scenario" }), el("th", { class: "r", text: "Comparisons (n = 10)" }), el("th", { text: "Which input" })),
    el("tr", {}, el("td", { text: "Worst case" }), el("td", { class: "r", text: String(worst) }), el("td", { text: "target last, or not in the list" })),
    el("tr", {}, el("td", { text: "Best case" }), el("td", { class: "r", text: String(best) }), el("td", { text: "target first (5)" })),
    el("tr", {}, el("td", { text: "Average over the 10 present targets" }), el("td", { class: "r", text: `${total}/10 = ${total / 10}` }), el("td", { text: "each item equally likely" })),
  );
}

/* =========================================================== Lecture 2: myFunction stepper */
const STEP_CAP = 4000;
function setupMyFunction() {
  const code = $("#mf-code");
  const tallies = Sim.MYFUNCTION_LINES.map((line) => {
    const t = el("span", { class: "tally" });
    code.append(el("li", {}, el("span", { text: line }), t));
    return t;
  });
  const lines = $$("li", code);
  let gen, steps, count, perLine, finished, truncated, n;
  function reset() {
    n = Math.max(0, Math.min(1000, Math.trunc(Number($("#mf-n").value) || 0)));
    gen = Sim.myFunctionSteps(n);
    steps = 0; count = 0; perLine = new Array(lines.length).fill(0); finished = false; truncated = false;
    lines.forEach((l) => l.classList.remove("on"));
    tallies.forEach((t) => { t.textContent = ""; });
    $("#mf-count").textContent = "0";
    $("#mf-vars").textContent = "";
    $("#mf-note").textContent = `n = ${n}. Press Step.`;
    $("#mf-result").replaceChildren();
  }
  function step() {
    if (finished) return false;
    const s = gen.next();
    if (s.done) { finished = true; return false; }
    const v = s.value;
    steps++;
    count += v.ops;
    perLine[v.line] += v.ops;
    lines.forEach((l, i) => l.classList.toggle("on", i === v.line));
    tallies.forEach((t, i) => { t.textContent = perLine[i] ? `+${perLine[i]}` : ""; });
    $("#mf-count").textContent = fmtInt(count);
    $("#mf-vars").textContent = Object.entries(v.vars).map(([k, x]) => `${k} = ${x}`).join(", ");
    $("#mf-note").textContent = v.note + (v.ops ? ` (+${v.ops})` : "");
    if (v.done) { finished = true; showResult(); }
    return true;
  }
  function showResult() {
    const box = $("#mf-result");
    box.replaceChildren();
    if (truncated) {
      $("#mf-count").textContent = `${fmtInt(count)} (partial)`;
      box.append(el("p", { class: "trunc", text: `Stopped after ${fmtInt(STEP_CAP)} steps, so the run is cut off. The count above is partial and isn't the total for n = ${n}. Use a smaller n to see a complete run.` }));
      return;
    }
    const formula = 4 * n + 4;
    const even = (120 + n) % 2 === 0;
    box.append(el("p", { class: "counter" }, "complete run, total ", el("b", { text: fmtInt(count) })));
    box.append(el("p", { class: "note", text: n === 0
      ? "For n = 0 the else loop would do nothing, so here the if branch is the slower one: 5 ops. Slide 16's 4n + 4 is for n ≥ 1."
      : even
      ? `The worst-case formula 4n + 4 gives ${formula}. This run is below it: b ended even, so the cheap if branch ran. The formula charges the slower branch.`
      : `The worst-case formula 4n + 4 gives ${formula}, which matches: b ended odd, so the else loop ran.` }));
  }
  $("#mf-step").addEventListener("click", step);
  $("#mf-run").addEventListener("click", () => {
    while (!finished) {
      if (steps >= STEP_CAP) { truncated = true; finished = true; lines.forEach((l) => l.classList.remove("on")); showResult(); break; }
      step();
    }
  });
  $("#mf-reset").addEventListener("click", reset);
  $("#mf-n").addEventListener("input", reset);
  reset();
}

function setupBeAnnoying() {
  const grid = $("#ba-grid"), out = $("#ba-out");
  const run = () => {
    const n = Math.max(0, Math.min(3000, Math.trunc(Number($("#ba-n").value) || 0)));
    const { prints, adds } = Sim.beAnnoyingCounts(n);
    grid.replaceChildren();
    const SHOW = 12;
    if (n <= SHOW) {
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = `repeat(${Math.max(n, 1)}, 1.4rem)`;
      grid.style.gap = "3px";
      for (let i = 0; i < n * n; i++) grid.append(el("span", { style: "width:1.4rem;height:1.4rem;background:var(--a1);border-radius:3px", title: `i = ${Math.floor(i / n)}, j = ${i % n}` }));
    } else grid.style.display = "none";
    out.textContent = `n = ${fmtInt(n)}: the loops ran to completion and printed ${fmtInt(prints)} times (= ${fmtInt(n)} × ${fmtInt(n)}), with ${fmtInt(adds)} m.add calls.${n > SHOW ? " (Grid drawn only for n ≤ 12; the count is still exact.)" : " Each square is one print: a row per outer iteration."}`;
  };
  $("#ba-run").addEventListener("click", run);
  run();
}

/* =========================================================== Lecture 2: ArrayList amortized */
function setupArrayList() {
  let c, length, size, writes, copies, costs;
  const cells = $("#al-cells"), out = $("#al-out"), svg = $("#al-bars");
  const MAX_ADDS = 120;
  function reset() {
    c = Math.max(1, Math.min(8, Math.trunc(Number($("#al-c").value) || 1)));
    length = c; size = 0; writes = 0; copies = 0; costs = [];
    draw();
  }
  function add() {
    if (costs.length >= MAX_ADDS) return false;
    let cost = 1;
    if (length === size) { copies += length; cost += length; length *= 2; }
    writes++; size++;
    costs.push(cost);
    return true;
  }
  function draw() {
    cells.replaceChildren();
    const shown = Math.min(length, 64);
    for (let i = 0; i < shown; i++) cells.append(el("div", { class: `cell${i < size ? "" : " empty"}` }, el("b", { text: i < size ? "●" : "·" }), el("span", { class: "idx", text: String(i) })));
    if (length > shown) cells.append(el("span", { class: "note", text: `… ${length - shown} more slots` }));
    const total = writes + copies;
    const ratio = size ? total / size : 0;
    const exact = size ? (total % size === 0 ? String(total / size) : `${total}/${size} ≈ ${ratio.toFixed(3)}`) : "–";
    out.textContent = size
      ? `${size} adds: ${writes} writes + ${copies} copies = ${total}. Total ÷ adds for this sequence = ${exact}. data.length = ${length}.${costs.length >= MAX_ADDS ? ` (The widget stops at ${MAX_ADDS} adds.)` : ""}`
      : `data.length = ${length}, size = 0. Press add.`;
    svg.replaceChildren();
    const W = 640, H = 140, base = 120, max = Math.max(2, ...costs, 2 * c);
    const bw = Math.min(16, (W - 40) / Math.max(costs.length, 1) - 2);
    svg.append(svgEl("line", { x1: 30, y1: base, x2: W, y2: base, class: "axis" }));
    svg.append(svgEl("text", { x: 0, y: 14 }, "cost"));
    costs.forEach((k, i) => {
      const h = Math.max(2, (k / max) * (base - 20));
      const x = 34 + i * (bw + 2);
      svg.append(svgEl("rect", { x, y: base - h, width: bw, height: h, rx: Math.min(4, bw / 2), fill: k > 1 ? "var(--a2)" : "var(--a1)" }, null));
      if (k > 1 && bw >= 6) svg.append(svgEl("text", { x: x + bw / 2, y: base - h - 4, "text-anchor": "middle", class: "label" }, String(k)));
    });
  }
  $("#al-add").addEventListener("click", () => { add(); draw(); });
  $("#al-add10").addEventListener("click", () => { for (let i = 0; i < 10; i++) add(); draw(); });
  $("#al-reset").addEventListener("click", reset);
  $("#al-c").addEventListener("input", reset);
  reset();
}

/* =========================================================== Lecture 2: binary search */
function setupBinarySearch() {
  const a = Sim.SLIDE_SORTED;
  let trace, shown;
  const cells = $("#bs-cells"), out = $("#bs-out"), log = $("#bs-log");
  function reset() {
    const k = Math.trunc(Number($("#bs-k").value) || 0);
    trace = Sim.binarySearchTrace(a, k); trace.k = k; shown = 0;
    log.replaceChildren();
    draw();
  }
  function draw() {
    const cur = trace.steps[shown - 1];
    const start = shown === 0 ? 0 : cur.start, end = shown === 0 ? a.length : cur.end;
    cells.replaceChildren(...a.map((v, i) => {
      const inRange = i >= start && i < end;
      const c = el("div", { class: `cell${inRange ? "" : " empty"}` });
      const p = [];
      if (shown && i === cur.mid) p.push("mid");
      if (i === start && shown) p.push("start");
      c.append(el("span", { class: "ptr", text: p.join(" · ") }), el("b", { text: String(v), style: inRange ? "" : "color:var(--ink-faint)" }), el("span", { class: "idx", text: String(i) }));
      return c;
    }));
    const lin = Sim.linearSearch(a, trace.k).comparisons;
    if (shown === 0) out.textContent = `start = 0, end = ${a.length}. Press Step.`;
    else if (shown < trace.steps.length) out.textContent = `Iteration ${shown}: mid = ${cur.mid}, a.get(mid) = ${cur.value} ${cur.outcome === "right" ? `< ${trace.k}, so start = mid+1` : `> ${trace.k}, so end = mid`}.`;
    else {
      out.textContent = trace.found
        ? `Found ${trace.k} in ${trace.iterations} iteration${trace.iterations === 1 ? "" : "s"}. Linear search would use ${lin} comparison${lin === 1 ? "" : "s"}.`
        : `start = end = ${trace.finalStart}: the loop stops and returns false after ${trace.iterations} iterations. Linear search would use ${lin}.`;
    }
  }
  function step() {
    if (shown >= trace.steps.length) return;
    shown++;
    const s = trace.steps[shown - 1];
    logLine(log, `#${shown}: start=${s.start} end=${s.end} mid=${s.mid} a.get(mid)=${s.value} → ${s.outcome === "found" ? "found" : s.outcome === "right" ? "go right" : "go left"}`);
    draw();
  }
  $("#bs-step").addEventListener("click", step);
  $("#bs-run").addEventListener("click", () => { while (shown < trace.steps.length) step(); });
  $("#bs-reset").addEventListener("click", reset);
  $("#bs-k").addEventListener("input", reset);
  reset();

  const t = $("#bsw-table");
  t.append(el("tr", {}, el("th", { class: "r", text: "n" }), el("th", { class: "r", text: "worst iterations (all targets tried)" }), el("th", { class: "r", text: "⌊log₂ n⌋ + 1" }), el("th", { class: "r", text: "linear search worst" })));
  for (const n of [1, 2, 3, 4, 7, 8, 10, 15, 16, 100, 1000, 1024]) {
    const w = Sim.binaryWorstExhaustive(n);
    t.append(el("tr", {}, el("td", { class: "r", text: fmtInt(n) }), el("td", { class: "r", text: String(w) }), el("td", { class: "r", text: String(Math.floor(Math.log2(n)) + 1) }), el("td", { class: "r", text: fmtInt(n) })));
  }
}

/* =========================================================== Lecture 2: growth comparison (A, B, C) */
const SERIES = [
  { key: "A", color: "var(--a1)", tex: "10n + 900" },
  { key: "B", color: "var(--a2)", tex: "100n − 50" },
  { key: "C", color: "var(--a3)", tex: "n²/100" },
];
let growthRange = 50;
function drawGrowth() {
  const svg = $("#gr-svg");
  if (!svg || !svg.getBoundingClientRect().width) return;
  // viewBox follows the rendered width so text stays at its real size on phones
  const W = Math.round(Math.max(320, Math.min(680, svg.getBoundingClientRect().width))), H = W < 500 ? 260 : 320, L = 56, R = 30, T = 14, B = 34;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const N = growthRange, pts = 120;
  const ns = Array.from({ length: pts + 1 }, (_, i) => Math.round((i / pts) * N)).filter((v, i, arr) => arr.indexOf(v) === i);
  const vals = SERIES.map((s) => ns.map((n) => Number(Sim.algValue(s.key, n)) / 100));
  const maxY = Math.max(...vals.flat());
  const niceMax = (() => { const p = 10 ** Math.floor(Math.log10(maxY)); return Math.ceil(maxY / p) * p; })();
  const x = (n) => L + (n / N) * (W - L - R), y = (v) => T + (1 - v / niceMax) * (H - T - B);
  svg.replaceChildren();
  for (let k = 0; k <= 4; k++) {
    const v = (niceMax / 4) * k;
    svg.append(svgEl("line", { x1: L, y1: y(v), x2: W - R, y2: y(v), class: "grid" }));
    svg.append(svgEl("text", { x: L - 6, y: y(v) + 4, "text-anchor": "end" }, fmtInt(Math.round(v))));
  }
  const xt = W < 500 ? 2 : 5;
  for (let k = 0; k <= xt; k++) {
    const n = Math.round((N / xt) * k);
    svg.append(svgEl("text", { x: x(n), y: H - 12, "text-anchor": k === xt ? "end" : k === 0 ? "start" : "middle" }, k === xt ? `n = ${fmtInt(n)}` : fmtInt(n)));
  }
  svg.append(svgEl("line", { x1: L, y1: H - B, x2: W - R, y2: H - B, class: "axis" }));
  const labelYs = [];
  SERIES.forEach((s, si) => {
    const d = ns.map((n, i) => `${i ? "L" : "M"}${x(n).toFixed(1)},${y(vals[si][i]).toFixed(1)}`).join("");
    svg.append(svgEl("path", { d, class: "series", stroke: s.color }));
    const end = vals[si][vals[si].length - 1];
    let ly = y(end);
    for (const o of labelYs) if (Math.abs(o - ly) < 16) ly = o + 16;
    labelYs.push(ly);
    svg.append(svgEl("circle", { cx: x(N), cy: y(end), r: 4, fill: s.color, class: "dot" }));
    svg.append(svgEl("text", { x: x(N) + 8, y: ly + 4, class: "label" }, s.key));

  });
  // hover: crosshair + exact values
  const hover = svgEl("g", { visibility: "hidden" });
  const hl = svgEl("line", { y1: T, y2: H - B, class: "hover-line" });
  hover.append(hl);
  svg.append(hover);
  const hit = svgEl("rect", { x: L, y: T, width: W - L - R, height: H - T - B, fill: "transparent" });
  svg.append(hit);
  const box = $("#gr-box");
  let tip = $(".tip", box);
  if (!tip) { tip = el("div", { class: "tip", hidden: true }); box.append(tip); }
  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const n = Math.max(0, Math.min(N, Math.round(((px - L) / (W - L - R)) * N)));
    hl.setAttribute("x1", x(n)); hl.setAttribute("x2", x(n));
    hover.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.replaceChildren(el("strong", { text: `n = ${fmtInt(n)}` }), ...SERIES.map((s) => el("div", { text: `${s.key}: ${Sim.fmtHundredths(Sim.algValue(s.key, n))}` })));
    tip.style.left = `${(x(n) / W) * r.width}px`;
    tip.style.top = `${(T / H) * r.height + 40}px`;
  };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerleave", () => { hover.setAttribute("visibility", "hidden"); tip.hidden = true; });
}
function setupGrowth() {
  $("#gr-legend").append(...SERIES.map((s) => el("span", {}, el("span", { class: "key", style: `border-color:${s.color}` }), `${s.key}: ${s.tex}`)));
  $$("#gr [data-range]").forEach((b) => b.addEventListener("click", () => {
    growthRange = Number(b.dataset.range);
    $$("#gr [data-range]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    drawGrowth();
    buildGrowthTable();
  }));
  const exact = () => {
    const raw = $("#gr-n").value.trim();
    if (!/^\d{1,10}$/.test(raw)) { $("#gr-exact").textContent = "Enter a whole number n ≥ 0."; return; }
    const n = BigInt(raw);
    const v = SERIES.map((s) => [s.key, Sim.algValue(s.key, n)]);
    const min = v.reduce((m, p) => (p[1] < m[1] ? p : m));
    const ties = v.filter((p) => p[1] === min[1]).map((p) => p[0]);
    $("#gr-exact").textContent = `At n = ${fmtInt(n)}: ${v.map(([k, h]) => `${k} = ${Sim.fmtHundredths(h)}`).join(", ")}. Smallest here: ${ties.join(" and ")}.`;
  };
  $("#gr-n").addEventListener("input", exact);
  exact();
  $("#gr-table-toggle").addEventListener("click", (e) => {
    const t = $("#gr-table");
    t.hidden = !t.hidden;
    e.currentTarget.setAttribute("aria-pressed", String(!t.hidden));
  });
  buildGrowthTable();
  window.addEventListener("resize", drawGrowth);
}
function buildGrowthTable() {
  const N = growthRange;
  const ns = [...new Set([0, 1, 10, 11, Math.round(N / 4), Math.round(N / 2), N, ...(N >= 2000 ? [1083, 1084] : []), ...(N >= 20000 ? [10000] : [])])].filter((n) => n <= N).sort((a, b) => a - b);
  const tbl = el("table", { class: "plain num" }, el("tr", {}, el("th", { class: "r", text: "n" }), ...SERIES.map((s) => el("th", { class: "r", text: `${s.key} = ${s.tex}` }))));
  for (const n of ns) tbl.append(el("tr", {}, el("td", { class: "r", text: fmtInt(n) }), ...SERIES.map((s) => el("td", { class: "r", text: Sim.fmtHundredths(Sim.algValue(s.key, n)) }))));
  $("#gr-table").replaceChildren(tbl);
}

/* =========================================================== Lecture 2: find c and n0 */
const CLAIMS = [
  { id: "a-linear", text: "10n + 900 ∈ O(n)  (algorithm A)", f: ["900", "10"], g: ["0", "1"], rel: "O", c: "11", n0: "1" },
  { id: "b-linear-omega", text: "100n − 50 ∈ Ω(n)  (algorithm B)", f: ["-50", "100"], g: ["0", "1"], rel: "Omega", c: "100", n0: "1" },
  { id: "c-not-linear", text: "n²/100 ∈ O(n)?  (algorithm C — try to make it work)", f: ["0", "0", "1/100"], g: ["0", "1"], rel: "O", c: "1000", n0: "1" },
  { id: "summary-cubic", text: "4n² + 8n + 10 ∈ O(¼n³)  (topic summary)", f: ["10", "8", "4"], g: ["0", "0", "0", "1/4"], rel: "O", c: "1", n0: "1" },
  { id: "summary-quad-o", text: "4n² − 8n + 10 ∈ O(2n²)  (topic summary)", f: ["10", "-8", "4"], g: ["0", "0", "2"], rel: "O", c: "2", n0: "1" },
  { id: "summary-quad-omega", text: "4n² − 8n + 10 ∈ Ω(2n²)  (topic summary)", f: ["10", "-8", "4"], g: ["0", "0", "2"], rel: "Omega", c: "2", n0: "1" },
];
function polyString(coeffs) {
  const terms = [];
  coeffs.forEach((c, k) => {
    if (c === "0") return;
    const v = k === 0 ? "" : k === 1 ? "n" : `n${["", "", "²", "³"][k]}`;
    terms.push({ c, v });
  });
  return terms.reverse().map(({ c, v }, i) => {
    const neg = c.startsWith("-"); const a = neg ? c.slice(1) : c;
    const coef = v && a === "1" ? "" : a;
    return `${i ? (neg ? " − " : " + ") : neg ? "−" : ""}${coef}${coef && v && a.includes("/") ? "·" : ""}${v}`;
  }).join("") || "0";
}
function setupBoundChecker() {
  const sel = $("#cn-claim");
  CLAIMS.forEach((c) => sel.append(el("option", { value: c.id, text: c.text })));
  const cur = () => CLAIMS.find((c) => c.id === sel.value);
  sel.addEventListener("change", () => { $("#cn-c").value = cur().c; $("#cn-n0").value = cur().n0; $("#cn-out").textContent = ""; plot(); });
  function plot(result) {
    const cl = cur();
    const svg = $("#cn-svg");
    svg.replaceChildren();
    const cE = G.tryEval($("#cn-c").value, {}), nE = G.tryEval($("#cn-n0").value, {});
    const c = cE.ok ? G.qToNumber(cE.value) : 1;
    const n0 = nE.ok ? Math.max(0, G.qToNumber(nE.value)) : 1;
    const fNum = (n) => cl.f.reduce((s, a, k) => s + G.qToNumber(G.evalExact(a)) * n ** k, 0);
    const gNum = (n) => c * cl.g.reduce((s, a, k) => s + G.qToNumber(G.evalExact(a)) * n ** k, 0);
    const ce = result && result.counterexample ? Number(result.counterexample.n) : null;
    const N = Math.max(20, Math.ceil(Math.max(n0, ce || 0) * 2.2));
    const W = Math.round(Math.max(320, Math.min(680, svg.getBoundingClientRect().width || 680))), H = 240, L = 62, R = 64, T = 12, B = 28;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const ns = Array.from({ length: 101 }, (_, i) => (i / 100) * N);
    const ys = [...ns.map(fNum), ...ns.map(gNum)];
    const lo = Math.min(0, ...ys), hi = Math.max(...ys) || 1;
    const x = (n) => L + (n / N) * (W - L - R), y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    svg.append(svgEl("line", { x1: L, y1: y(0), x2: W - R, y2: y(0), class: "axis" }));
    [0, 0.5, 1].forEach((t) => svg.append(svgEl("text", { x: L - 6, y: y(lo + t * (hi - lo)) + 4, "text-anchor": "end" }, fmtInt(Math.round(lo + t * (hi - lo))))));
    [0, 0.5, 1].forEach((t) => svg.append(svgEl("text", { x: x(t * N), y: H - 8, "text-anchor": "middle" }, fmtInt(Math.round(t * N)))));
    if (n0 <= N) {
      svg.append(svgEl("rect", { x: x(n0), y: T, width: Math.max(0, x(N) - x(n0)), height: H - T - B, fill: "var(--a3-tint)", opacity: 0.6 }));
      svg.append(svgEl("text", { x: x(n0) + 4, y: T + 14 }, "n ≥ n₀"));
    }
    [[fNum, "var(--a1)", "f(n)"], [gNum, "var(--a2)", "c·g(n)"]].forEach(([fn, color, lab], k) => {
      svg.append(svgEl("path", { d: ns.map((n, i) => `${i ? "L" : "M"}${x(n).toFixed(1)},${y(fn(n)).toFixed(1)}`).join(""), class: "series", stroke: color }));
      svg.append(svgEl("text", { x: x(N) + 8, y: y(fn(N)) + 4 + (k && Math.abs(y(fNum(N)) - y(gNum(N))) < 16 ? 16 : 0), class: "label" }, lab));
    });
    if (ce !== null && ce <= N) svg.append(svgEl("circle", { cx: x(ce), cy: y(fNum(ce)), r: 5, fill: "var(--wrong)", class: "dot" }));
  }
  $("#cn-check").addEventListener("click", () => {
    const cl = cur();
    const r = G.checkBound(cl, $("#cn-c").value, $("#cn-n0").value);
    const out = $("#cn-out");
    const fS = polyString(cl.f), gS = polyString(cl.g);
    if (r.unreadable) { out.textContent = "Use numbers like 11, 1/2 or 900."; plot(); return; }
    out.textContent = r.holds
      ? `Holds: ${fS} ${cl.rel === "O" ? "≤" : "≥"} ${r.normalized.c}·(${gS}) for every integer n ≥ ${r.normalized.n0}. That pair proves the claim.`
      : boundDetail(r, cl).replace("f(n)", `f(n) = ${fS}`);
    plot(r);
  });
  sel.addEventListener("redraw", () => plot());
  window.addEventListener("resize", () => plot());
  $("#cn-c").addEventListener("input", () => plot());
  $("#cn-n0").addEventListener("input", () => plot());
  plot();
}

/* =========================================================== brute-force buttons */
const BRUTE = {
  "circular-trace"() {
    const q = Sim.circularQueue();
    for (let i = 0; i < 3; i++) q.dequeue();
    for (let x = 1; x <= 6; x++) q.enqueue(x);
    return { ok: q.front === 3 && q.back === 1 && q.size === 8 && q.queue[0] === 6, text: `Ran the slide-18 code: front = ${q.front}, back = ${q.back}, size = ${q.size}, queue[0] = ${q.queue[0]}.` };
  },
  "arraylist-14c"() {
    const rows = [];
    let ok = true;
    for (let c = 1; c <= 8; c++) { const r = Sim.arrayListAdds(c, 7 * c); rows.push(`c=${c}: ${r.total}`); if (r.total !== 14 * c) ok = false; }
    return { ok, text: `Ran add() 7c times from length c: ${rows.join(", ")}. ${ok ? "Every total is exactly 14c." : "Mismatch."}` };
  },
  "binary-1000"() {
    const w = Sim.binaryWorstExhaustive(1000);
    return { ok: w === 10, text: `Searched a sorted list of 1,000 for all 2,001 possible targets (each item and each gap): the most iterations was ${w}.` };
  },
  crossovers() {
    const A = (n) => Sim.algValue("A", n), B = (n) => Sim.algValue("B", n), C = (n) => Sim.algValue("C", n);
    const ab = Sim.firstN((n) => A(n) < B(n)), ca = Sim.firstN((n) => C(n) > A(n));
    let stays = true;
    for (let n = BigInt(ca); n < 100000n; n++) if (!(C(n) > A(n))) { stays = false; break; }
    return { ok: ab === 11 && ca === 1084 && stays, text: `Exact integer arithmetic over n = 1 … 100,000: A < B first at n = ${ab}; C > A first at n = ${ca}, and C stays above A for every n in the range checked. (That's a check, not a proof: the algebra in step 2 covers all n.)` };
  },
};
function setupBrute() {
  $$("[data-brute]").forEach((btn) => {
    const out = btn.nextElementSibling;
    btn.addEventListener("click", () => {
      out.className = "brute"; out.textContent = "Running…"; btn.disabled = true;
      setTimeout(() => {
        const r = BRUTE[btn.dataset.brute]();
        btn.disabled = false;
        out.className = `brute ${r.ok ? "ok" : ""}`;
        out.textContent = r.text;
      }, 20);
    });
  });
}

/* =========================================================== host API */
window.CourseSite = {
  siteId: SITE_ID,
  get schemaVersion() { return store.SCHEMA_VERSION; },
  storage: () => store.adapterName,
  exportState: () => JSON.parse(JSON.stringify(store.state)),
  importState: (s) => { store.replace(s); ITEMS.forEach((it) => it.restore()); refreshProgress(); },
  flush: () => { flushAllDrafts(); return store.flush(); },
  pending: () => store.pending,
  onChange: (fn) => store.subscribe(fn),
};

/* =========================================================== boot */
function boot() {
  $("#menu-btn").addEventListener("click", () => {
    const open = $(".rail").classList.toggle("open");
    $("#menu-btn").setAttribute("aria-expanded", String(open));
  });
  buildPagers();
  setupTasks();
  setupSteps();
  setupChecks();
  setupQuizzes();
  setupQueues();
  setupStackVsQueue();
  setupTermSort();
  setupScenarios();
  setupMyFunction();
  setupBeAnnoying();
  setupArrayList();
  setupBinarySearch();
  setupGrowth();
  setupBoundChecker();
  setupBrute();
  window.addEventListener("hashchange", () => show(location.hash.slice(1)));
  show(location.hash.slice(1) || "home");
  renderMath(document.body);
  booted = true;
  refreshProgress();
  // The mirror already restored typed work synchronously. Now ask the adapter (may be slow or fail).
  store.init().then(() => {
    ITEMS.forEach((it) => it.restore());
    refreshProgress();
    document.documentElement.dataset.ready = "true";
  });
  document.documentElement.dataset.booted = "true";
}
boot();
