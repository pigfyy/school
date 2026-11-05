/* Shared page engine for every course week (site/<course>/wNN/index.html).

   A week page provides:
     <body data-course="cse332" data-week="w02">, the rail (nav.rail) with its module list, and <section class="page">s.
     week.js (optional, loaded before this file) sets window.WEEK = { keys, messages, widgets(api) }:
       keys      answer specs by item id (problem parts use "<problem id>.<part>"); see core/grader.js for types.
                 Anything not in keys is read from the markup: data-type / data-answer / data-miscon / data-points …
       messages  misconception tag -> feedback text, shared by every item on the page
       widgets   function(api) that wires this week's interactive pieces; called once at boot

   Markup the engine understands (same as the house style):
     .check[data-id]               quick check: one text input, or .opts labels (data-option or data-correct).
                                   Add data-custom when the week's own widget grades it instead
     li.cyu[data-id]               quiz question: .opts for multiple choice, otherwise a text input. In ol.cyu-list,
                                   with .cyu-score[data-role=score|summary] around it
     article.task[data-id]         problem: .answer-spec[data-part] boxes, ol.hints, .solution with .steps
     [data-progress-bar]           optional empty div: where the page's problem progress bar goes
     .steps                        step-by-step reveal. li[data-ask="plain text"] puts that question on the button
                                   that reveals the step, then heads the step with it
     .steps.board                  whiteboard lines, one per click: li > .lab + .mth + .note; li.wide spans the row
     .example                      a worked example: .example-head, .example-q, then its .steps, table.vals or .tryit
     .tryit                        tap a choice, see one dot per n: buttons with data-dots="0011…" (1 = holds) and
                                   data-say, plus empty .tryit-dots and .tryit-out; data-from sets the first n (default 1)
     details.more                  optional depth, closed until opened
     nav.pager                     filled with previous / next
   Saved state goes through core/store.js; it never holds answer keys. */
"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const isBlank = (s) => !String(s ?? "").trim();

const COURSE = document.body.dataset.course;
const WEEK_ID = document.body.dataset.week;
const WEEK = window.WEEK || {};
const G = window.Grader;
const ROOT = document.currentScript.src.replace(/core\/app\.js(\?.*)?$/, ""); // the site root, e.g. ../../

/* =========================================================== math */
const KATEX_OPTS = { delimiters: [{ left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }], throwOnError: false };
// Keep punctuation that touches short inline math on the same line as the math, e.g. "(\(A\))" or "\(c = 10\),".
function glueMath(root) {
  root.querySelectorAll(".katex").forEach((k) => {
    if (k.closest(".katex-display, .math-glue")) return;
    const tex = k.querySelector("annotation");
    if (!tex || tex.textContent.length > 16) return;
    if (k.parentElement.tagName === "SPAN" && !k.parentElement.className && k.parentElement.childNodes.length === 1) k = k.parentElement;
    const nx = k.nextSibling, pv = k.previousSibling;
    const tail = nx && nx.nodeType === 3 && /^[,.;:!?)\]’”]+/.exec(nx.data);
    const head = pv && pv.nodeType === 3 && /[(\[‘“]+$/.exec(pv.data);
    if (!tail && !head) return;
    const span = el("span", { class: "math-glue" });
    k.before(span);
    if (head) span.append(pv.splitText(pv.data.length - head[0].length));
    span.append(k);
    if (tail) { nx.splitText(tail[0].length); span.append(nx); }
  });
}
const renderMath = (node) => { if (window.renderMathInElement) { window.renderMathInElement(node, KATEX_OPTS); glueMath(node); } };

/* =========================================================== toasts (transient; only for save trouble) */
function toast(message, kind = "info", ms = 6000) {
  const t = el("div", { class: `toast ${kind}`, role: kind === "error" ? "alert" : "status" }, el("span", { text: message }));
  const close = el("button", { class: "toast-x", "aria-label": "Dismiss", text: "×" });
  close.addEventListener("click", () => t.remove());
  t.append(close);
  $("#toasts").append(t);
  setTimeout(() => t.remove(), ms);
}
const NOTICES = {
  "save-failed": ["Couldn't save to the server. Your work is kept in this browser; retrying.", "error"],
  recovered: ["Saving works again. Nothing was lost.", "ok"],
  "load-failed": ["Couldn't load your saved work from the server. Showing this browser's copy.", "error"],
};

/* =========================================================== store */
const ITEMS = new Map(); // id -> { restore() }
const store = window.CourseStore.create({
  course: COURSE, week: WEEK_ID,
  onError: (kind) => { const n = NOTICES[kind]; if (n) toast(n[0], n[1]); },
  onRemote: () => { ITEMS.forEach((it) => it.restore()); refreshCounts(); },
});
addEventListener("pagehide", () => store.flush());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") store.flush(); });

/* =========================================================== answer specs: keys from week.js, else the markup */
function specFor(id, node) {
  const key = (WEEK.keys || {})[id];
  const d = node ? node.dataset : {};
  const spec = key ? { ...key } : {};
  // 332-style quiz items say data-kind="num" | "bigo"; "num" is an exact number
  spec.type = spec.type || d.type || d.grader || ({ num: "exact", bigo: "bigo" })[d.kind];
  if (spec.answer === undefined && d.answer !== undefined) spec.answer = d.answer;
  if (!spec.miscon && d.miscon) spec.miscon = JSON.parse(d.miscon);
  if (!spec.points && d.points) spec.points = JSON.parse(d.points);
  if (!spec.choices && d.choices) spec.choices = JSON.parse(d.choices);
  if (spec.tol === undefined && d.tol) spec.tol = d.tol;
  if (spec.allowed === undefined && d.allowed) spec.allowed = d.allowed;
  spec.messages = { ...(WEEK.messages || {}), ...(spec.messages || {}) };
  return spec;
}
const titleOf = (node) => (($(".q, h2, p", node) || node).textContent || "").replace(/\s+/g, " ").trim().slice(0, 160);

/* =========================================================== routing */
const PAGES = $$(".page").map((p) => ({ id: p.id, title: p.dataset.title || $("h1", p)?.textContent || p.id }));
const WEEK_TITLE = `${COURSE.toUpperCase().replace(/(\D)(\d)/, "$1 $2")} ${WEEK_ID.replace(/^w0?/, "week ")}`;
const REDRAW = new Set(); // widgets that need a visible page to measure themselves
function show(id) {
  if (!PAGES.some((p) => p.id === id)) id = PAGES[0].id;
  $$(".page").forEach((p) => p.classList.toggle("is-active", p.id === id));
  $$(".rail a[href^='#']").forEach((a) => {
    if (a.classList.contains("brand")) return;
    if (a.getAttribute("href") === `#${id}`) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = `${PAGES.find((p) => p.id === id).title} · ${WEEK_TITLE}`;
  closeMenu();
  window.scrollTo(0, 0);
  requestAnimationFrame(() => window.scrollTo(0, 0));
  REDRAW.forEach((fn) => fn(id));
}
const currentId = () => location.hash.slice(1) || PAGES[0].id;
const currentIndex = () => Math.max(0, PAGES.findIndex((p) => p.id === currentId()));
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
  if (!b) return;
  b.addEventListener("click", () => {
    const open = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(open));
    $(".rail").classList.toggle("open", open);
  });
}

/* =========================================================== course + week switcher (built from site/courses.js)
   The first block of the rail body: the courses, then this course's weeks. */
function buildSwitcher() {
  const cat = window.COURSES;
  const body = $(".rail-body");
  if (!cat || !body) return;
  const course = cat.courses.find((c) => c.id === COURSE);
  const courses = el("ul", { class: "switch-courses", "aria-label": "Course" });
  for (const c of cat.courses) {
    // Same week in the other course if it's posted, else that course's latest week.
    const posted = c.weeks.filter((w) => w.posted);
    const target = posted.find((w) => w.id === WEEK_ID) || posted[posted.length - 1];
    const a = el("a", { href: target ? `${ROOT}${c.id}/${target.id}/` : ROOT, text: c.id });
    if (c.id === COURSE) a.setAttribute("aria-current", "page");
    courses.append(el("li", {}, a));
  }
  const weeks = el("ul", { class: "switch-weeks", "aria-label": "Weeks" });
  for (const w of course ? course.weeks : []) {
    const n = w.id.replace(/^w0?/, "");
    const node = w.posted
      ? el("a", { href: `${ROOT}${COURSE}/${w.id}/`, title: `Week ${n}${w.title ? `: ${w.title}` : ""}`, text: n })
      : el("span", { title: `Week ${n}: not posted yet`, text: n });
    if (w.id === WEEK_ID) node.setAttribute("aria-current", "page");
    weeks.append(el("li", {}, node));
  }
  body.prepend(el("div", { class: "switcher" }, el("h2", {}, el("a", { href: ROOT, text: "Courses" })), courses, el("h2", { text: "Week" }), weeks));
}

/* =========================================================== date labels
   Write <span class="today-chip" data-date="2026-10-05">Mon Oct 5</span> (or class "today" in the rail): it reads
   "Today · Mon Oct 5" on that day and just the date otherwise, so an old week never claims to be today.
   .tag-today shows Today / Past / Upcoming. */
function setupDates() {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  $$("[data-date]").forEach((n) => {
    const when = n.dataset.date === today ? "today" : n.dataset.date < today ? "past" : "later";
    n.dataset.when = when;
    if (n.classList.contains("tag-today")) n.textContent = when === "today" ? "Today" : when === "past" ? "Past" : "Upcoming";
    else if (when === "today") n.textContent = n.hasAttribute("data-plain") ? `Today, ${n.textContent}` : `Today · ${n.textContent}`;

  });
}

/* =========================================================== keys */
function nextStepOnPage() {
  for (const steps of $$(".page.is-active .steps")) {
    if (steps.closest(".solution[hidden], details:not([open])")) continue;
    const hidden = $(":scope > ol > li[hidden]", steps);
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
  if (e.target.closest?.("input, textarea, select, button, [role=button], [contenteditable], .no-keys") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "ArrowRight") go(1);
  else if (e.key === "ArrowLeft") go(-1);
  else if (e.key === "n" || e.key === "N") nextStepOnPage();
  else if (e.key === "h" || e.key === "H") nextHintOnPage();
});

/* =========================================================== step reveals */
function setupSteps() {
  $$(".steps").forEach((steps) => {
    const items = $$(":scope > ol > li", steps);
    items.forEach((li) => { if (li.dataset.ask) li.prepend(el("p", { class: "step-q", text: li.dataset.ask })); });
    let shown = 0;
    const board = steps.classList.contains("board");
    const next = el("button", { class: "btn primary", type: "button" });
    const all = el("button", { class: "btn", type: "button", text: "Show all" });
    const reset = el("button", { class: "btn", type: "button", text: board ? "Start over" : "Hide steps" });
    const count = el("span", { class: "count", hidden: board });
    steps.append(el("div", { class: "step-bar" }, next, all, reset, count));
    function render(just) {
      items.forEach((li, i) => { li.hidden = i >= shown; li.classList.toggle("just-shown", i === just); });
      next.disabled = shown >= items.length;
      all.hidden = shown >= items.length;
      reset.hidden = shown === 0;
      const ask = items[shown]?.dataset.ask;
      next.textContent = shown >= items.length ? (board ? "Done" : "All steps shown") : ask ? `${ask} →` : board ? "Next line" : shown === 0 ? "Show first step" : "Show next step";
      count.textContent = `${shown} of ${items.length} steps shown`;
    }
    steps._reveal = () => { if (shown < items.length) { shown++; render(shown - 1); } };
    steps._shown = () => shown;
    next.addEventListener("click", steps._reveal);
    all.addEventListener("click", () => { shown = items.length; render(-1); });
    reset.addEventListener("click", () => { shown = 0; render(-1); });
    render(-1);
  });
}
function setupTryIts() {
  $$(".tryit").forEach((box) => {
    const dots = $(".tryit-dots", box), out = $(".tryit-out", box), from = Number(box.dataset.from || 1);
    const chips = $$("[data-dots]", box);
    chips.forEach((chip) => chip.addEventListener("click", () => {
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      dots.replaceChildren(...[...chip.dataset.dots].map((d, i) => el("span", { class: `try-dot ${d === "1" ? "yes" : "no"}`, text: String(from + i), title: d === "1" ? "holds" : "fails" })));
      out.textContent = chip.dataset.say || "";
    }));
  });
}

/* =========================================================== multiple-choice helpers (quick checks and quiz) */
// Options are labels with data-option="<id>" (correct one named in keys) or a bare data-correct marker.
function mcOptions(node) {
  return $$(".opts label", node).map((l, i) => ({
    label: l, input: $("input", l), id: l.dataset.option || String(i), correct: l.hasAttribute("data-correct"),
    misconception: l.dataset.misconception || null, text: l.textContent.replace($(".why", l)?.textContent || "", "").trim(),
  }));
}
function gradeChoice(id, opt) {
  const spec = (WEEK.keys || {})[id];
  const ok = spec && spec.answer !== undefined ? String(spec.answer).split("|").includes(opt.id) : opt.correct;
  return { status: ok ? "correct" : "incorrect", normalized: opt.id, feedbackKind: ok ? "correct" : opt.misconception || `chose-${opt.id}`, message: ok ? "Correct." : "Not this one. Read why, then try another." };
}
const isRightOption = (id, opt) => { const s = (WEEK.keys || {})[id]; return s && s.answer !== undefined ? String(s.answer).split("|").includes(opt.id) : opt.correct; };

/* =========================================================== quick checks */
function setupChecks() {
  $$(".check[data-id]:not([data-custom])").forEach((box) => {
    const id = box.dataset.id;
    const opts = mcOptions(box);
    const isMc = opts.length > 0;
    const input = isMc ? null : $("input[type=text], input:not([type])", box);
    const fb = $(".feedback", box) || box.appendChild(el("p", { class: "feedback", role: "status" }));
    const btn = $("button.primary", box) || $(".row", box)?.appendChild(el("button", { class: "btn primary", type: "button", text: "Check" }));
    const title = titleOf(box);
    let yn = null;
    if (input && specFor(id, box).type === "yesno") {
      yn = choiceButtons(YES_NO, (v) => { input.value = v; check(); });
      input.hidden = true;
      if (btn) btn.hidden = true;
      input.parentNode.insertBefore(yn.group, input);
    }

    function paint(s) {
      fb.className = "feedback"; fb.textContent = "";
      if (yn) yn.paint(s?.raw || "", s?.correct ?? null);
      if (input) input.classList.remove("ok", "bad");
      opts.forEach((o) => { o.label.classList.remove("right", "wrong"); const w = $(".why", o.label); if (w) w.hidden = true; });
      if (!s || s.correct == null) return;
      fb.className = `feedback ${s.correct ? "ok" : "bad"}`;
      fb.textContent = s.message || (s.correct ? "Correct." : "Not quite.");
      if (input) input.classList.add(s.correct ? "ok" : "bad");
      const o = opts.find((x) => x.id === s.choice);
      if (o) { o.label.classList.add(s.correct ? "right" : "wrong"); const w = $(".why", o.label); if (w) w.hidden = false; }
    }
    function restore() {
      const s = store.get(id);
      if (input && document.activeElement !== input) input.value = s?.raw || "";
      opts.forEach((o) => { o.input.checked = s?.choice === o.id; });
      paint(s);
    }
    const edit = () => { // an edit keeps the draft and clears the grade
      const choice = opts.find((o) => o.input.checked)?.id ?? null;
      store.put(id, "quickcheck", { title, raw: input ? input.value : "", choice, normalized: null, correct: null, message: null });
      paint(null);
    };
    if (input) input.addEventListener("input", edit); else opts.forEach((o) => o.input.addEventListener("change", edit));

    function check() {
      let g, answer;
      if (isMc) {
        const o = opts.find((x) => x.input.checked);
        if (!o) { fb.className = "feedback"; fb.textContent = "Pick an option first."; return; }
        g = gradeChoice(id, o);
        answer = { choice: o.id, text: o.text };
      } else {
        if (isBlank(input.value)) { fb.className = "feedback"; fb.textContent = "Type an answer first."; return; }
        g = G.grade(specFor(id, box), input.value);
        answer = { raw: input.value };
        if (g.status === "unreadable") { fb.className = "feedback bad"; fb.textContent = `Couldn't read that. ${g.message}`; return; }
      }
      const correct = g.status === "correct";
      store.attempt(id, "quickcheck", { answer: { ...answer, normalized: g.normalized }, correct, feedback: g.feedbackKind });
      store.put(id, "quickcheck", { title, raw: answer.raw ?? "", choice: answer.choice ?? null, normalized: g.normalized, correct, message: g.message });
      restore();
    }
    if (btn) btn.addEventListener("click", check);
    if (input) input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
    ITEMS.set(id, { restore });
    restore();
  });
}

/* =========================================================== check your understanding */
const firstTryCorrect = (s) => {
  if (!s) return false;
  const since = (s.events || []).filter((e) => e.type === "clear").map((e) => e.at).sort().pop() || "";
  const live = (s.attempts || []).filter((a) => a.at >= since);
  const revealedFirst = (s.events || []).some((e) => e.type === "reveal" && e.at >= since && (!live[0] || e.at < live[0].at));
  return Boolean(live[0] && live[0].correct && !revealedFirst);
};
const liveAttempts = (s) => {
  if (!s) return [];
  const since = (s.events || []).filter((e) => e.type === "clear").map((e) => e.at).sort().pop() || "";
  return (s.attempts || []).filter((a) => a.at >= since);
};
function setupQuizzes() {
  $$(".cyu-list").forEach((list) => {
    const page = list.closest(".page");
    const items = $$(".cyu[data-id]", list);
    const score = $('[data-role="score"]', page) || $("[data-quiz-score]", page);
    const summary = $('[data-role="summary"]', page) || $("[data-quiz-summary]", page);
    const update = () => {
      const recs = items.map((li) => store.get(li.dataset.id));
      const answered = recs.filter((r) => liveAttempts(r).length).length;
      const first = recs.filter(firstTryCorrect).length;
      if (score) score.textContent = `Answered ${answered} of ${items.length} · ${first} correct on the first try`;
      if (!summary) return;
      summary.replaceChildren();
      const done = recs.filter((r) => r && (liveAttempts(r).length || r.revealed)).length;
      if (done < items.length) { summary.textContent = `Answer or reveal all ${items.length} to see what to review.`; return; }
      const missed = [...new Set(items.filter((_, k) => !firstTryCorrect(recs[k])).map((li) => li.dataset.topic).filter(Boolean))];
      summary.append(el("strong", { text: `You got ${first} of ${items.length} on the first try. ` }));
      if (!missed.length) summary.append("Nothing to review.");
      else {
        summary.append("Worth another look: ");
        missed.forEach((tid, k) => { const p = PAGES.find((x) => x.id === tid); summary.append(el("a", { href: `#${tid}`, text: p ? p.title : tid })); if (k < missed.length - 1) summary.append(", "); });
        summary.append(".");
      }
      const again = el("button", { class: "btn", type: "button", text: "Start over" });
      again.addEventListener("click", () => {
        items.forEach((li) => { store.clear(li.dataset.id); ITEMS.get(li.dataset.id).restore(); });
        update();
        window.scrollTo(0, page.offsetTop);
      });
      summary.append(" ", again);
    };
    list._update = update;

    items.forEach((li, idx) => {
      const id = li.dataset.id;
      const opts = mcOptions(li);
      const isMc = opts.length > 0;
      const why = $(":scope > .why", li);
      const title = titleOf(li);
      const bar = el("div", { class: "row" });
      const checkBtn = el("button", { class: "btn primary check-btn", type: "button", text: "Check" });
      const showBtn = el("button", { class: "btn", type: "button", text: "Show answer" });
      const fb = el("p", { class: "feedback", role: "status" });
      let input = null;
      if (!isMc) {
        input = el("input", { type: "text", "aria-label": `Answer to question ${idx + 1}`, autocomplete: "off" });
        bar.append(input);
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") checkBtn.click(); });
      }
      bar.append(checkBtn, showBtn);
      li.insertBefore(bar, why || null);
      li.insertBefore(fb, why || null);

      function paint() {
        const s = store.get(id);
        if (input && document.activeElement !== input) input.value = s?.raw || "";
        li.classList.toggle("is-right", s?.correct === true);
        opts.forEach((o) => {
          o.input.checked = s?.choice === o.id;
          const mine = s?.choice === o.id && s.correct != null;
          const shownRight = s?.revealed && isRightOption(id, o);
          o.label.classList.toggle("right", (mine && s.correct) || Boolean(shownRight));
          o.label.classList.toggle("wrong", Boolean(mine && !s.correct));
          const w = $(".why", o.label); if (w) w.hidden = !(mine || shownRight);
        });
        if (why) why.hidden = !(s?.revealed || s?.correct);
        fb.className = "feedback"; fb.textContent = "";
        if (s?.correct === true) { fb.className = "feedback ok"; fb.textContent = s.message && s.message !== "Correct." ? s.message : "Correct."; }
        else if (s?.correct === false) { fb.className = "feedback bad"; fb.textContent = isMc ? "Not this one. Read why, then try another." : s.message || "Not quite. Try again, or press Show answer."; }
        else if (s?.revealed) { fb.textContent = !isMc && !why ? `Answer: ${specFor(id, li).answer}.` : "Answer shown. A Check after this won't count as a first try."; }
      }
      const edit = () => {
        const s = store.get(id);
        store.put(id, "quiz", { title, raw: input ? input.value : "", choice: opts.find((o) => o.input.checked)?.id ?? null, normalized: null, correct: null, message: null, revealed: s?.revealed || false });
        paint();
      };
      if (input) input.addEventListener("input", edit); else opts.forEach((o) => o.input.addEventListener("change", edit));

      checkBtn.addEventListener("click", () => {
        let g, answer;
        if (isMc) {
          const o = opts.find((x) => x.input.checked);
          if (!o) { fb.className = "feedback"; fb.textContent = "Pick an option first."; return; }
          g = gradeChoice(id, o); answer = { choice: o.id, text: o.text };
        } else {
          if (isBlank(input.value)) { fb.className = "feedback"; fb.textContent = "Type an answer first."; return; }
          g = G.grade(specFor(id, li), input.value); answer = { raw: input.value };
          if (g.status === "unreadable") { fb.className = "feedback bad"; fb.textContent = `Couldn't read that. ${g.message}`; return; }
        }
        const correct = g.status === "correct";
        const s = store.get(id);
        store.attempt(id, "quiz", { answer: { ...answer, normalized: g.normalized }, correct, feedback: g.feedbackKind });
        store.put(id, "quiz", { title, raw: answer.raw ?? "", choice: answer.choice ?? null, normalized: g.normalized, correct, message: g.message, revealed: s?.revealed || false });
        paint(); update();
      });
      showBtn.addEventListener("click", () => {
        store.event(id, "quiz", "reveal");
        store.put(id, "quiz", { ...(store.get(id) || {}), title, revealed: true });
        paint(); update();
      });
      ITEMS.set(id, { restore: () => { paint(); update(); } });
      paint();
    });
    update();
  });
}

/* =========================================================== problems */
const PLACEHOLDER = { exact: "a number", decimal: "e.g. 12.34", formula: "a formula, e.g. 3n+2", bigo: "e.g. n log n", yesno: "yes or no", int: "a whole number", output: "exactly as printed", stream: "standard output or standard error", strength: "stronger, weaker or incomparable", java: "a Java type", bound: "a positive number", self: "your answer" };
function statusOf(s, hasAuto, hasSelf) {
  if (!s) return ["Not started", ""];
  if (s.result === "wrong" || s.selfMark === "missed") return ["Not yet", "bad"];
  if ((!hasAuto || s.result === "right") && (!hasSelf || s.selfMark === "got")) return ["Correct", "ok"];
  if (s.solutionViewed) return ["Solution viewed", "seen"];
  if (s.result === "right") return ["Answers right · mark the rest", "prog"];
  if (Object.values(s.parts || {}).some((p) => !isBlank(p.raw)) || !isBlank(s.work) || s.hintsRevealed) return ["In progress", "prog"];
  return ["Not started", ""];
}
const TASKS = new Map();
// Yes/no and data-options answers are buttons over a hidden input that holds the chosen value.
function choiceButtons(choices, onPick) {
  const group = el("div", { class: "choice-btns", role: "group" });
  const btns = choices.map(([v, t]) => {
    const b = el("button", { class: "chip", type: "button", "aria-pressed": "false", "data-value": v, text: t });
    b.addEventListener("click", () => onPick(v));
    group.append(b);
    return b;
  });
  const paint = (value, correct) => btns.forEach((b) => {
    const on = b.dataset.value === value;
    b.setAttribute("aria-pressed", String(on));
    b.classList.toggle("ok", on && correct === true);
    b.classList.toggle("bad", on && correct === false);
  });
  return { group, paint };
}
const YES_NO = [["yes", "Yes"], ["no", "No"]];
function buildTask(task) {
  const id = task.dataset.id;
  const title = $("h2", task).textContent.trim();
  const specs = $$(".answer-spec", task);
  const parts = specs.map((spec) => ({ spec, part: spec.dataset.part, pid: `${id}.${spec.dataset.part}` }));
  parts.forEach((p) => { p.type = specFor(p.pid, p.spec).type; });
  const auto = parts.filter((p) => p.type !== "self"), self = parts.filter((p) => p.type === "self");
  const hasAuto = auto.length > 0, hasSelf = self.length > 0;
  const hintList = $(".hints", task);
  const hintItems = hintList ? $$("li", hintList) : [];
  const solution = $(".solution", task);
  const get = () => store.get(id) || { parts: {}, work: "", hintsRevealed: 0 };

  const pill = el("span", { class: "pill" });
  $("h2", task).append(" ", pill);
  const myWork = el("div", { class: "my-work" });
  task.insertBefore(myWork, specs[0] || hintList || solution);
  const rows = el("div", { class: "ans-rows" });
  myWork.append(rows);
  const fb = el("p", { class: "feedback", role: "status" });

  const inputs = parts.map((p, i) => {
    const domId = `${p.pid}-input`.replace(/\./g, "--");
    const d = p.spec.dataset;
    let input;
    const choices = p.type === "yesno" ? YES_NO : d.options ? d.options.split("|").map((o) => { const [v, t] = o.split(":"); return [v, t || v]; }) : null;
    // Short self-check answers are one line, like the other rows; data-long gives a written one a textarea.
    if (p.type === "self" && p.spec.hasAttribute("data-long")) input = el("textarea", { id: domId, rows: "3", spellcheck: "true", placeholder: d.placeholder || "your answer" });
    else if (choices) {
      input = el("input", { type: "hidden", id: domId });
      p.choice = choiceButtons(choices, (v) => { input.value = v; input.dispatchEvent(new Event("input")); check(); });
    } else input = el("input", { type: "text", id: domId, autocomplete: "off", spellcheck: "false", placeholder: d.placeholder || PLACEHOLDER[p.type] || (d.choices ? JSON.parse(d.choices).join(" or ") : ""), class: p.type === "java" ? "mono" : null });
    p.spec.classList.add("ans-row");
    if (p.type === "self" && input.tagName === "TEXTAREA") p.spec.classList.add("self");
    if (p.type === "output") p.spec.classList.add("mono-answer");
    p.spec.dataset.itemId = p.pid;
    p.fb = el("p", { class: "part-fb", role: "status" });
    p.spec.append(el("label", { for: domId, text: d.label || (parts.length === 1 ? "Your answer" : `Part ${i + 1}`) }), input);
    if (p.choice) p.spec.append(p.choice.group);
    if (p.type === "self") p.spec.append(el("span", { class: "where", text: "check against the solution" }));
    p.spec.append(p.fb);
    rows.append(p.spec);
    input.addEventListener(input.tagName === "SELECT" ? "change" : "input", () => {
      const s = get();
      s.parts = { ...s.parts, [p.part]: { raw: input.value, normalized: null, correct: null } };
      store.put(id, "problem", { ...s, title, result: null, selfMark: p.type === "self" ? null : s.selfMark });
      input.classList.remove("ok", "bad");
      if (p.choice) p.choice.paint(input.value, null);
      p.fb.textContent = ""; p.fb.className = "part-fb";
      fb.textContent = ""; fb.className = "feedback";
      render();
    });
    if (p.type !== "self" && input.tagName === "INPUT") input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
    return input;
  });

  const checkBtn = el("button", { class: "btn primary check-btn", type: "button", text: auto.length > 1 ? "Check answers" : "Check" });
  if (hasAuto) myWork.append(el("div", { class: "row" }, checkBtn));
  myWork.append(fb);
  const workId = `${id}--work`;
  const work = el("textarea", { id: workId, rows: "4", placeholder: task.dataset.workPlaceholder || (window.katex ? "Explain how you got your answer. Math works too, e.g. \\( 10n+100 \\le 10n^2 \\)" : "Your reasoning: the lines you followed, the runs you predicted, what you'd change.") });
  const preview = el("div", { class: "work-preview", "aria-live": "polite", hidden: true });
  myWork.append(el("label", { class: "work-label", for: workId, text: "Your work" }), work, preview);
  let previewTimer;
  const renderPreview = () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const has = window.renderMathInElement && /\\\(|\\\[/.test(work.value);
      preview.hidden = !has;
      if (has) { preview.textContent = work.value; renderMath(preview); }
    }, 300);
  };
  work.addEventListener("input", () => { store.put(id, "problem", { ...get(), title, work: work.value }); renderPreview(); render(); });

  const actions = el("div", { class: "task-actions" });
  const hintBtn = el("button", { class: "btn hint-btn", type: "button" });
  const solBtn = el("button", { class: "btn sol-btn", type: "button" });
  const clearBtn = el("button", { class: "btn quiet", type: "button", text: "Clear my work" });
  if (hintItems.length) actions.append(hintBtn);
  if (solution) actions.append(solBtn);
  actions.append(clearBtn);
  task.insertBefore(actions, hintList || solution || null);
  const selfMark = el("div", { class: "self-mark" });
  const gotBtn = el("button", { class: "chip", type: "button", text: "I got it" });
  const missBtn = el("button", { class: "chip", type: "button", text: "I missed something" });
  selfMark.append(el("span", { text: hasAuto ? "How did your written answers go? " : "How did you do? " }), gotBtn, missBtn);
  if (hasSelf && solution) solution.after(selfMark);
  let armed = false, solutionOpen = false;

  function render() {
    const s = store.get(id);
    const [label, cls] = statusOf(s, hasAuto, hasSelf);
    pill.textContent = label; pill.className = `pill ${cls}`;
    const k = s?.hintsRevealed || 0, n = hintItems.length;
    hintItems.forEach((li, i) => { li.hidden = i >= k; });
    if (hintList) hintList.hidden = k === 0;
    hintBtn.textContent = k === 0 ? `Need a hint? (${n} available)` : k < n ? `Another hint (${k} of ${n} shown)` : `All ${n} hints shown`;
    hintBtn.disabled = k >= n;
    if (solution) solution.hidden = !solutionOpen;
    solBtn.textContent = solutionOpen ? "Hide solution" : armed ? "Show solution anyway" : "Show solution";
    selfMark.hidden = !solutionOpen;
    gotBtn.setAttribute("aria-pressed", String(s?.selfMark === "got"));
    missBtn.setAttribute("aria-pressed", String(s?.selfMark === "missed"));
    refreshCounts();
  }

  // Grade every auto part. c/n0 pairs (type "bound") and Java types (type "java") are graded together.
  function gradeParts() {
    const results = new Map();
    const val = (p) => inputs[parts.indexOf(p)].value;
    const java = auto.filter((p) => p.type === "java");
    if (java.some((p) => isBlank(val(p)))) java.forEach((p) => results.set(p.part, { ok: null, blank: true }));
    else if (java.length) {
      const out = G.checkJavaParts(java.map((p) => {
        const sp = specFor(p.pid, p.spec);
        return { id: p.part, raw: val(p), header: p.spec.hasAttribute("data-header"), accept: sp.accept || JSON.parse(p.spec.dataset.accept), miscon: sp.miscon || {} };
      }), JSON.parse(task.dataset.javaParams || "[]"));
      out.forEach((r) => results.set(r.id, r));
    }
    const groups = new Map();
    for (const p of auto.filter((x) => x.type === "bound")) { const k = p.spec.dataset.pair || "_"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
    for (const group of groups.values()) {
      const cP = group.find((p) => p.spec.dataset.role === "c"), nP = group.find((p) => p.spec.dataset.role === "n0");
      if (isBlank(val(cP)) || isBlank(val(nP))) { results.set(cP.part, { ok: null, blank: true }); results.set(nP.part, { ok: null, blank: true }); continue; }
      const bound = specFor(cP.pid, cP.spec).bound || JSON.parse(cP.spec.dataset.bound);
      const b = G.checkBound(bound, val(cP), val(nP));
      if (b.unreadable) { results.set(cP.part, { ok: null }); results.set(nP.part, { ok: null }); continue; }
      const detail = boundDetail(b, bound);
      const verdict = b.holds ? [true, true] : b.tag === "n0-too-small" || b.tag === "n0-not-positive" ? [true, false] : [false, "skip"];
      const mk = (v, norm) => (v === "skip" ? { ok: null, skip: true, normalized: norm, note: detail } : { ok: v, normalized: norm, tag: b.tag || null, note: detail });
      results.set(cP.part, mk(verdict[0], b.normalized.c));
      results.set(nP.part, mk(verdict[1], b.normalized.n0));
    }
    for (const p of auto) {
      if (results.has(p.part)) continue;
      const v = val(p);
      if (isBlank(v)) { results.set(p.part, { ok: null, blank: true }); continue; }
      const g = G.grade(specFor(p.pid, p.spec), v);
      results.set(p.part, { ok: g.status === "unreadable" ? null : g.status === "correct", normalized: g.normalized, tag: g.feedbackKind, note: g.message });
    }
    return results;
  }
  function check() {
    if (auto.every((p) => isBlank(inputs[parts.indexOf(p)].value))) {
      fb.className = "feedback"; fb.textContent = auto.length > 1 ? "Answer at least one part first." : "Type an answer first.";
      return;
    }
    const results = gradeParts();
    const unread = auto.filter((p) => { const r = results.get(p.part); return r.ok === null && !r.skip && !r.blank; });
    if (unread.length) {
      unread.forEach((p) => { p.fb.className = "part-fb bad"; p.fb.textContent = results.get(p.part).note || G.UNREADABLE[p.type] || "Couldn't read that."; inputs[parts.indexOf(p)].classList.add("bad"); });
      fb.className = "feedback bad"; fb.textContent = "Some boxes couldn't be read. See the notes under them.";
      return;
    }
    const right = auto.filter((p) => results.get(p.part).ok === true).length;
    const all = right === auto.length, anyWrong = auto.some((p) => results.get(p.part).ok === false);
    const s = get();
    const answer = {}, partsOut = { ...s.parts };
    for (const p of parts) {
      const r = results.get(p.part);
      answer[p.part] = { raw: inputs[parts.indexOf(p)].value, normalized: r ? r.normalized ?? null : null, correct: r ? r.ok : null, feedback: r && r.ok !== true ? r.tag || null : null };
      partsOut[p.part] = { raw: answer[p.part].raw, normalized: answer[p.part].normalized, correct: answer[p.part].correct, note: r ? r.note || null : null, tag: r ? r.tag || null : null };
    }
    store.attempt(id, "problem", { type: "check", answer, correct: all, hintsShown: s.hintsRevealed || 0, solutionSeen: Boolean(s.solutionViewed) });
    store.put(id, "problem", { ...s, title, parts: partsOut, result: all ? "right" : anyWrong ? "wrong" : null });
    restore();
  }
  function markSelf(mark) {
    const s = get();
    const answer = {};
    self.forEach((p) => { answer[p.part] = { raw: inputs[parts.indexOf(p)].value }; });
    store.attempt(id, "problem", { type: "self-mark", answer, correct: mark === "got", hintsShown: s.hintsRevealed || 0, solutionSeen: true });
    store.put(id, "problem", { ...s, title, selfMark: mark });
    render();
  }
  checkBtn.addEventListener("click", check);
  hintBtn.addEventListener("click", () => {
    const s = get();
    const k = Math.min(hintItems.length, (s.hintsRevealed || 0) + 1);
    store.event(id, "problem", "hint", { level: k });
    store.put(id, "problem", { ...s, title, hintsRevealed: k });
    render();
    hintItems[k - 1].classList.add("just-shown");
  });
  solBtn.addEventListener("click", () => {
    if (solutionOpen) { solutionOpen = false; render(); return; }
    const s = get();
    const tried = inputs.some((x) => !isBlank(x.value)) || !isBlank(work.value) || liveAttempts(s).length > 0;
    if (!tried && !armed && !s.solutionViewed) {
      armed = true;
      fb.className = "feedback"; fb.textContent = "You haven't answered yet. Press the button again to see the solution anyway.";
      render();
      return;
    }
    armed = false; solutionOpen = true;
    if (solution) $$(".steps", solution).forEach((st) => { if (st._shown && st._shown() === 0) st._reveal(); });
    if (fb.textContent.startsWith("You haven't answered")) { fb.textContent = ""; fb.className = "feedback"; }
    store.event(id, "problem", "solution", { answeredFirst: Boolean(tried) });
    store.put(id, "problem", { ...s, title, solutionViewed: true });
    render();
  });
  gotBtn.addEventListener("click", () => markSelf("got"));
  missBtn.addEventListener("click", () => markSelf("missed"));
  clearBtn.addEventListener("click", () => {
    if (!confirm(`Clear your answers, work and hints for "${title}"? Your past checks stay in your history.`)) return;
    store.clear(id);
    solutionOpen = false;
    restore();
  });

  function restore() {
    const s = store.get(id);
    armed = false;
    parts.forEach((p, i) => {
      const r = s?.parts?.[p.part] || {};
      if (document.activeElement !== inputs[i]) inputs[i].value = r.raw || "";
      inputs[i].classList.toggle("ok", r.correct === true);
      inputs[i].classList.toggle("bad", r.correct === false);
      if (p.choice) p.choice.paint(inputs[i].value, r.correct);
      p.fb.className = "part-fb"; p.fb.textContent = "";
      if (r.correct === false || (r.correct === true && r.tag && r.tag !== "correct")) {
        p.fb.className = `part-fb ${r.correct ? "ok" : "bad"}`;
        p.fb.textContent = r.note || (r.correct ? "" : "Not right yet.");
      } else if (r.correct == null && r.note && s?.result) { p.fb.textContent = r.note; }
    });
    if (document.activeElement !== work) work.value = s?.work || "";
    fb.className = "feedback"; fb.textContent = "";
    const n = auto.filter((p) => s?.parts?.[p.part]?.correct === true).length;
    if (s?.result) {
      fb.className = `feedback ${s.result === "right" ? "ok" : "bad"}`;
      fb.textContent = s.result === "right"
        ? (hasSelf ? "Correct. Compare your written parts with the solution." : auto.length > 1 ? "All correct." : "Correct.")
        : auto.length > 1 ? `${n} of ${auto.length} right. The red ones need another look.` : "Not quite. Try again, or ask for a hint.";
    } else if (n) { fb.className = "feedback ok"; fb.textContent = `${n} of ${auto.length} right so far.`; }
    renderPreview();
    render();
  }
  TASKS.set(id, { hasAuto, hasSelf });
  ITEMS.set(id, { restore });
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
function setupTasks() {
  $$(".task[data-id]").forEach(buildTask);
  $$(".page").forEach((page) => {
    const first = $(".task[data-id]", page);
    if (!first) return;
    const clearAll = el("button", { class: "btn quiet", type: "button", text: "Clear all on this page" });
    clearAll.addEventListener("click", () => {
      if (!confirm("Clear every answer and all work on this page? Your past checks stay in your history.")) return;
      $$(".task[data-id]", page).forEach((t) => { store.clear(t.dataset.id); ITEMS.get(t.dataset.id).restore(); });
    });
    // A page can say where its progress bar goes with an empty <div data-progress-bar>; otherwise it sits above the first problem.
    const bar = el("div", { class: "task-progress" }, el("p", { class: "progress-text", role: "status" }), el("div", { class: "row" }, clearAll));
    ($("[data-progress-bar]", page) || first).before(bar);
  });
}
function refreshCounts() {
  $$(".task-progress").forEach((bar) => {
    const ids = $$(".task[data-id]", bar.closest(".page")).map((t) => t.dataset.id);
    const recs = ids.map((tid) => store.get(tid));
    const submitted = recs.filter((r) => liveAttempts(r).length).length;
    const correct = ids.filter((tid, k) => TASKS.has(tid) && statusOf(recs[k], TASKS.get(tid).hasAuto, TASKS.get(tid).hasSelf)[0] === "Correct").length;
    const seen = recs.filter((r) => r && r.solutionViewed).length;
    $(".progress-text", bar).textContent = `${submitted} of ${ids.length} answered · ${correct} correct now · ${seen} solution${seen === 1 ? "" : "s"} viewed`;
  });
}

/* =========================================================== what widgets get */
const api = { $, $$, el, store, G, show, go, renderMath, toast, REDRAW, currentId, reduceMotion, specFor, ITEMS, refreshCounts };
window.Study = api;

/* =========================================================== boot */
function boot() {
  if (!$("#toasts")) document.body.append(el("div", { class: "toasts", id: "toasts", "aria-live": "polite" }));
  buildSwitcher();
  setupDates();
  setupMenu();
  buildPagers();
  setupTasks();
  setupSteps();
  setupTryIts();
  setupChecks();
  setupQuizzes();
  renderMath(document.body); // before widgets measure text
  if (WEEK.widgets) WEEK.widgets(api);
  addEventListener("hashchange", () => show(location.hash.slice(1)));
  addEventListener("resize", () => REDRAW.forEach((fn) => fn(currentId())));
  show(currentId());
  refreshCounts();
  store.load();
  document.documentElement.dataset.ready = "true";
}
boot();
