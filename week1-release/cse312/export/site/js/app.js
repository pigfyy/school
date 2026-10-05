"use strict";
/*
  UI for the CSE 312 week 1 site. Builds problem, quick-check and quiz UI from the markup in index.html,
  runs the widgets, and records learner state through js/store.js (window.CourseStore).
  Grading goes through js/grader.js (exact BigInt rationals); enumeration through js/counting.js.
*/
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const G = window.CSE312Grader;
  const C = window.Counting;
  const fmtBig = (x) => (typeof x === "bigint" ? x.toLocaleString("en-US") : Number(x).toLocaleString("en-US"));
  const evalFmt = (expr, vars) => { const r = G.tryEval(expr, vars); return r.ok ? G.format(r.value) : "?"; };

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const c of children) if (c != null) node.append(c);
    return node;
  }
  function slot(value, label, extraClass = "") {
    const s = el("div", { class: `slot ${extraClass}`.trim() });
    s.append(el("b", { text: String(value) }));
    if (label) s.append(el("span", { text: label }));
    return s;
  }
  const op = (sym) => el("span", { class: "op", text: sym });
  const KATEX_OPTS = {
    delimiters: [
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false },
    ],
    throwOnError: false,
  };
  const renderMath = (node) => { if (window.renderMathInElement) window.renderMathInElement(node, KATEX_OPTS); };
  function debounce(fn, ms) {
    let t;
    const d = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    d.now = (...args) => { clearTimeout(t); fn(...args); };
    return d;
  }
  // set feedback with an optional misconception line, as safe text
  function setFeedback(fb, cls, main, extraHtml) {
    fb.className = `${fb.className.split(" ")[0]} ${cls}`.trim();
    fb.replaceChildren(document.createTextNode(main));
    if (extraHtml) {
      const span = el("span", { class: "tag" });
      span.innerHTML = extraHtml; // authored content from index.html, never user input
      fb.append(span);
      renderMath(span);
    }
  }

  /* =========================================================== store + transient notices */
  const store = window.CourseStore.createStore();
  window.COURSE_SITE = store; // for the host and tests

  function toast(kind, message, ms = 7000) {
    const box = $("#toasts");
    const t = el("div", { class: `toast ${kind}`, role: kind === "error" ? "alert" : "status" }, el("span", { text: message }));
    const close = el("button", { class: "toast-x", "aria-label": "Dismiss", text: "×" });
    close.addEventListener("click", () => t.remove());
    t.append(close);
    box.append(t);
    while (box.children.length > 3) box.firstElementChild.remove();
    setTimeout(() => t.remove(), ms);
  }
  store.onNotice((n) => {
    toast(n.kind, n.message);
    if (n.kind === "error") {
      // also show it near whatever the learner is working on
      const active = document.activeElement && document.activeElement.closest(".task, .check, .cyu");
      const slotEl = active && $(".inline-notice", active);
      if (slotEl) {
        slotEl.textContent = "Not saved to the server yet. Your work is kept in this browser.";
        setTimeout(() => { slotEl.textContent = ""; }, 7000);
      }
    }
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
    const page = PAGES.find((p) => p.id === id);
    document.title = `${page.title} · CSE 312 week 1`;
    window.scrollTo(0, 0);
  }
  function currentIndex() {
    const id = location.hash.slice(1) || "home";
    return Math.max(0, PAGES.findIndex((p) => p.id === id));
  }
  function go(delta) {
    const i = currentIndex() + delta;
    if (i >= 0 && i < PAGES.length) location.hash = PAGES[i].id;
  }
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
    const page = $(".page.is-active");
    for (const steps of $$(".steps", page)) {
      if (steps.closest(".solution[hidden]")) continue;
      const hidden = $("li[hidden]", steps);
      if (hidden) {
        steps._reveal();
        hidden.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        return;
      }
    }
  }
  function nextHintOnPage() {
    const mid = innerHeight / 2;
    const candidates = $$(".page.is-active .task[data-id]")
      .map((task) => ({ task, btn: task._hintBtn }))
      .filter(({ btn }) => btn && !btn.disabled);
    if (!candidates.length) return;
    const dist = (t) => { const r = t.getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - mid); };
    candidates.sort((a, b) => dist(a.task) - dist(b.task));
    candidates[0].btn.click();
  }
  document.addEventListener("keydown", (e) => {
    if (e.target.closest?.("input, textarea, select, button") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "n" || e.key === "N") nextStepOnPage();
    else if (e.key === "h" || e.key === "H") nextHintOnPage();
  });

  /* =========================================================== step reveals */
  function setupSteps() {
    $$(".steps").forEach((steps) => {
      const items = $$("li", steps);
      let shown = 0;
      const bar = el("div", { class: "step-bar" });
      const next = el("button", { class: "btn primary", text: "Show next step" });
      const all = el("button", { class: "btn", text: "Show all" });
      const reset = el("button", { class: "btn", text: "Hide steps" });
      const count = el("span", { class: "brute" });
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

  /* =========================================================== grading helpers */
  function specOf(node) {
    const d = node.dataset;
    const spec = { type: d.type || "exact", answer: d.answer };
    if (d.vars) spec.vars = JSON.parse(d.vars);
    if (d.tolerance) spec.tolerance = d.tolerance;
    const list = $(":scope > ul.miscon", node);
    spec.miscon = list ? $$("li", list).map((li) => ({ expr: li.dataset.expr, tag: li.dataset.tag, msg: li.innerHTML })) : [];
    return spec;
  }
  const PARSE_HELP = "Use numbers with + − * / ^ ! ( ), or C(n,k) and P(n,k).";
  function wrongMessage(res, spec, next = "Try again, or ask for a hint.") {
    if (res.misconception) return { main: "Not quite.", extra: res.misconception.msg, kind: res.misconception.tag };
    if (spec.type === "formula") return { main: res.detail || "Not quite. Try a small case by hand.", kind: "incorrect" };
    if (spec.type === "yesno") return { main: "Not quite. Try a small example, then reread the question.", kind: "incorrect" };
    return { main: `Not quite. Yours is ${res.value}. ${next}`, kind: "incorrect" };
  }

  // "Answered" = submitted: at least one Check / self-mark attempt since the item was last cleared.
  // Revealing an answer or viewing a solution is not a submission. attempts[] itself is never modified.
  function submittedSinceClear(item) {
    const clears = (item.events || []).filter((e) => e.type === "clear").map((e) => e.at).sort();
    const lastClear = clears.length ? clears[clears.length - 1] : "";
    return (item.attempts || []).some((a) => String(a.submittedAt) > lastClear);
  }

  /* =========================================================== quick checks */
  function setupChecks() {
    $$(".check[data-id]").forEach((box) => {
      const id = box.dataset.id;
      const spec = specOf(box);
      const row = el("div", { class: "row" });
      const input = el("input", { type: "text", "aria-label": "Your answer", autocomplete: "off", spellcheck: "false", placeholder: "e.g. 2^4 or C(7,3)" });
      const button = el("button", { class: "btn primary", text: "Check" });
      row.append(input, button);
      const fb = el("p", { class: "feedback", role: "status" });
      const notice = el("p", { class: "inline-notice", role: "status" });
      box.append(row, fb, notice);

      const restore = () => {
        const s = store.get(id, "quickcheck");
        if (input !== document.activeElement) input.value = s.raw || "";
        if (s.correct === true) setFeedback(fb, "ok", `Correct: ${evalFmt(spec.answer)}.`);
        else if (s.correct === false) setFeedback(fb, "bad", "Last check: not right yet.");
        else setFeedback(fb, "", "");
      };
      // every keystroke goes to the store's local mirror at once; the network write is batched by the store
      // Editing invalidates the last grade (snapshot only; attempts[] keep the history). A new Check is needed.
      input.addEventListener("input", () => {
        store.editDraft(id, "quickcheck", { raw: input.value });
        setFeedback(fb, "", "");
      });
      const check = () => {
        const res = G.grade(spec, input.value);
        if (res.ok === null) { setFeedback(fb, "bad", res.error === "Type an answer first." ? res.error : `${res.error} ${PARSE_HELP}`); return; }
        const msg = res.ok ? { main: `Correct: ${res.value}.`, kind: "correct" } : wrongMessage(res, spec, "Try again.");
        setFeedback(fb, res.ok ? "ok" : "bad", msg.main, msg.extra);
        store.addAttempt(id, "quickcheck", {
          answer: { raw: input.value, normalized: res.normalized },
          result: { correct: res.ok, overall: res.ok },
          feedbackKind: msg.kind,
          hintsRevealedAtSubmit: 0,
          solutionViewedBeforeSubmit: false,
        }, (it) => {
          it.raw = input.value; it.normalized = res.normalized; it.correct = res.ok; it.tries += 1;
          if (it.firstTryCorrect === null) it.firstTryCorrect = res.ok;
        });
      };
      button.addEventListener("click", check);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
      box._restore = restore;
      restore();
    });
  }

  /* =========================================================== problems */
  const TASKS = new Map();

  function statusOf(s, allSelf) {
    if (s.overall === true || (allSelf && s.selfMark === "got")) return ["Correct", "ok"];
    if (s.overall === false || (allSelf && s.selfMark === "missed")) return ["Not yet", "bad"];
    if (s.solutionViewed) return ["Solution viewed", "seen"];
    const anyAns = Object.values(s.parts || {}).some((p) => p && p.raw);
    if (anyAns || (s.work || "").trim() || s.hintsRevealed) return ["In progress", "prog"];
    return ["Not started", ""];
  }

  function buildTask(task) {
    const id = task.dataset.id;
    const title = $("h2", task).textContent;
    const specs = $$(".answer-spec", task);
    const allSelf = specs.every((s) => s.dataset.type === "self");
    const hintList = $(".hints", task);
    const hintItems = hintList ? $$("li", hintList) : [];
    const solution = $(".solution", task);
    let state = store.get(id, "problem");
    let armed = false;

    const pill = el("span", { class: "pill" });
    $("h2", task).append(" ", pill);

    const myWork = el("div", { class: "my-work" });
    task.insertBefore(myWork, specs[0]);
    const rows = el("div", { class: "ans-rows" });
    myWork.append(rows);
    const parts = specs.map((spec, i) => {
      const partId = spec.dataset.partId;
      const inputId = `${partId}-input`.replace(/[^a-zA-Z0-9_-]/g, "_");
      const label = spec.dataset.label || (specs.length === 1 ? "Your answer" : `Part ${i + 1}`);
      const isSelf = spec.dataset.type === "self";
      const input = el("input", {
        type: "text", id: inputId, autocomplete: "off", spellcheck: "false",
        placeholder: spec.dataset.placeholder || (isSelf ? "your answer" : "e.g. 3*12! or C(7,3)"),
      });
      const lab = el("label", { for: inputId });
      lab.innerHTML = label; // authored label, may contain TeX
      spec.classList.add("ans-row");
      const partFb = el("p", { class: "part-fb", role: "status" });
      spec.prepend(lab, input);
      if (isSelf) spec.append(el("span", { class: "where", text: "check against the solution" }));
      spec.append(partFb);
      rows.append(spec);
      const gspec = specOf(spec);
      input.addEventListener("input", () => {
        // Editing invalidates the last grade of this part and of the problem (incl. a self-mark).
        state = store.editDraft(id, "problem", { partId, raw: input.value });
        input.classList.remove("ok", "bad");
        partFb.textContent = "";
        fb.textContent = "";
        fb.className = "feedback";
        render();
      });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !allSelf) check(); });
      return { partId, spec: gspec, isSelf, input, partFb };
    });

    const checkBar = el("div", { class: "row" });
    const checkBtn = el("button", { class: "btn primary", text: specs.length > 1 ? "Check answers" : "Check" });
    const fb = el("p", { class: "feedback", role: "status" });
    if (!allSelf) checkBar.append(checkBtn);
    myWork.append(checkBar, fb);

    const workId = `${id}-work`;
    const work = el("textarea", { id: workId, rows: "4", placeholder: "Explain how you got your answer. Math works too, e.g. \\( 3 \\cdot 12! \\)" });
    const preview = el("div", { class: "work-preview", "aria-live": "polite" });
    preview.hidden = true;
    const notice = el("p", { class: "inline-notice", role: "status" });
    myWork.append(el("label", { class: "work-label", for: workId, text: "Your work" }), work, preview, notice);
    const renderPreview = debounce(() => {
      const has = /\\\(|\\\[/.test(work.value);
      preview.hidden = !has;
      if (has) { preview.textContent = work.value; renderMath(preview); }
    }, 300);
    const saveWork = () => { state = store.update(id, "problem", (it) => { it.work = work.value; }); render(); };
    work.addEventListener("input", () => { renderPreview(); saveWork(); });

    const actions = el("div", { class: "task-actions" });
    const hintBtn = el("button", { class: "btn" });
    const solBtn = el("button", { class: "btn" });
    const clearBtn = el("button", { class: "btn quiet", text: "Clear my work" });
    if (hintItems.length) actions.append(hintBtn);
    actions.append(solBtn, clearBtn);
    task.insertBefore(actions, hintList || solution);
    task._hintBtn = hintItems.length ? hintBtn : null;

    const selfMark = el("div", { class: "self-mark" });
    const gotBtn = el("button", { class: "chip", text: "I got it" });
    const missBtn = el("button", { class: "chip", text: "I missed something" });
    selfMark.append(el("span", { text: "How did you do? " }), gotBtn, missBtn);
    if (allSelf) solution.after(selfMark);

    let solutionOpen = false;
    function render() {
      const [label, cls] = statusOf(state, allSelf);
      pill.textContent = label;
      pill.className = `pill ${cls}`;
      hintItems.forEach((li, i) => { li.hidden = i >= state.hintsRevealed; });
      if (hintList) hintList.hidden = state.hintsRevealed === 0;
      const n = hintItems.length, k = state.hintsRevealed;
      hintBtn.textContent = k === 0 ? `Need a hint? (${n} available)` : k < n ? `Another hint (${k} of ${n} shown)` : `All ${n} hints shown`;
      hintBtn.disabled = k >= n;
      solution.hidden = !solutionOpen;
      solBtn.textContent = solutionOpen ? "Hide solution" : armed ? "Show solution anyway" : "Show solution";
      selfMark.hidden = !solutionOpen;
      gotBtn.setAttribute("aria-pressed", String(state.selfMark === "got"));
      missBtn.setAttribute("aria-pressed", String(state.selfMark === "missed"));
      updateProgress();
    }

    function check() {
      const auto = parts.filter((p) => !p.isSelf);
      if (auto.some((p) => !p.input.value.trim())) {
        setFeedback(fb, "", auto.length > 1 ? "Fill in every answer box first." : "Type an answer first.");
        return;
      }
      const results = auto.map((p) => ({ p, res: G.grade(p.spec, p.input.value) }));
      results.forEach(({ p, res }) => {
        p.input.classList.toggle("ok", res.ok === true);
        p.input.classList.toggle("bad", res.ok === false);
        p.partFb.className = "part-fb";
        p.partFb.textContent = "";
      });
      const unreadable = results.filter((r) => r.res.ok === null);
      if (unreadable.length) {
        const yesno = unreadable.some((r) => r.p.spec.type === "yesno");
        const vars = unreadable.some((r) => r.p.spec.type === "formula");
        setFeedback(fb, "bad", yesno ? unreadable[0].res.error
          : `${unreadable[0].res.error} Use numbers${vars ? ", the letters in the problem (like n and m)," : ""} with + − * / ^ ! ( ), or C(n,k) and P(n,k).`);
        return;
      }
      const right = results.filter((r) => r.res.ok).length;
      const all = right === results.length;
      let feedbackKind = "correct";
      if (all) {
        setFeedback(fb, "ok", results.length === 1 && results[0].res.value ? `Correct: ${results[0].res.value}.` : "Correct.");
      } else if (results.length > 1) {
        setFeedback(fb, "bad", `${right} of ${results.length} right. The boxes in red need another look.`);
        results.filter((r) => !r.res.ok).forEach(({ p, res }) => {
          const m = wrongMessage(res, p.spec);
          p.partFb.className = "part-fb bad";
          if (m.extra) { p.partFb.innerHTML = m.extra; renderMath(p.partFb); } else p.partFb.textContent = m.main;
        });
        const tags = results.filter((r) => r.res.misconception).map((r) => r.res.misconception.tag);
        feedbackKind = tags.length ? tags.join(",") : "incorrect";
      } else {
        const m = wrongMessage(results[0].res, results[0].p.spec);
        setFeedback(fb, "bad", m.main, m.extra);
        feedbackKind = m.kind;
      }
      const answer = {}, result = {};
      results.forEach(({ p, res }) => {
        answer[p.partId] = { raw: p.input.value, normalized: res.normalized };
        result[p.partId] = res.ok;
      });
      parts.filter((p) => p.isSelf).forEach((p) => { answer[p.partId] = { raw: p.input.value, normalized: p.input.value.trim() }; result[p.partId] = null; });
      const snapshotHints = state.hintsRevealed;
      store.addAttempt(id, "problem", {
        type: "check",
        answer,
        result: { parts: result, overall: all },
        feedbackKind,
        hintsRevealedAtSubmit: snapshotHints,
        hintLevelsAtSubmit: Array.from({ length: snapshotHints }, (_, i) => i + 1),
        solutionViewedBeforeSubmit: Boolean(state.solutionViewed),
      }, (it, rec) => {
        results.forEach(({ p, res }) => { it.parts[p.partId] = { raw: p.input.value, normalized: res.normalized, correct: res.ok, checkedAt: rec.submittedAt }; });
        it.overall = all;
        if (it.firstTryCorrect === null) it.firstTryCorrect = all;
      });
      state = store.get(id, "problem");
      render();
    }

    function selfCheck(mark) {
      const answer = {}, result = {};
      parts.forEach((p) => { answer[p.partId] = { raw: p.input.value, normalized: p.input.value.trim() }; result[p.partId] = null; });
      store.addAttempt(id, "problem", {
        type: "self-check",
        selfMark: mark,
        answer,
        result: { parts: result, overall: mark === "got" },
        feedbackKind: mark === "got" ? "self-correct" : "self-missed",
        hintsRevealedAtSubmit: state.hintsRevealed,
        hintLevelsAtSubmit: Array.from({ length: state.hintsRevealed }, (_, i) => i + 1),
        solutionViewedBeforeSubmit: Boolean(state.solutionViewed),
      }, (it) => {
        it.selfMark = mark;
        if (allSelf) it.overall = mark === "got";
      });
      state = store.get(id, "problem");
      render();
    }

    checkBtn.addEventListener("click", check);
    hintBtn.addEventListener("click", () => {
      const level = Math.min(hintItems.length, state.hintsRevealed + 1);
      store.addEvent(id, "problem", { type: "hint", level }, (it) => {
        it.hintsRevealed = level;
        it.hintLevels = Array.from({ length: level }, (_, i) => i + 1);
      });
      state = store.get(id, "problem");
      render();
      hintItems[level - 1].classList.add("just-shown");
    });
    solBtn.addEventListener("click", () => {
      if (solutionOpen) { solutionOpen = false; render(); return; }
      const answered = parts.some((p) => p.input.value.trim());
      if (!answered && !armed && !state.solutionViewed) {
        armed = true;
        setFeedback(fb, "", "You haven’t answered yet. Press the button again to see the solution anyway.");
        render();
        return;
      }
      armed = false;
      solutionOpen = true;
      if (fb.textContent.startsWith("You haven’t answered")) setFeedback(fb, "", "");
      store.addEvent(id, "problem", { type: "solution", attemptedBefore: answered }, (it, ev) => {
        if (!it.solutionViewed) it.solutionViewedAt = ev.at;
        it.solutionViewed = true;
      });
      state = store.get(id, "problem");
      render();
    });
    gotBtn.addEventListener("click", () => selfCheck("got"));
    missBtn.addEventListener("click", () => selfCheck("missed"));
    clearBtn.addEventListener("click", () => {
      if (!confirm(`Clear your answer, work and hints for "${title.replace(/\s+\S+$/, "")}"? Your earlier checked attempts stay in your history.`)) return;
      store.clear(id, "problem");
      solutionOpen = false;
      restore();
    });

    function restore() {
      state = store.get(id, "problem");
      parts.forEach((p) => {
        const s = state.parts[p.partId];
        if (p.input !== document.activeElement) p.input.value = (s && s.raw) || "";
        p.input.classList.toggle("ok", Boolean(s && s.correct === true));
        p.input.classList.toggle("bad", Boolean(s && s.correct === false));
        p.partFb.textContent = "";
      });
      if (document.activeElement !== work) work.value = state.work || "";
      armed = false;
      const cls = state.overall === true ? "ok" : state.overall === false ? "bad" : "";
      setFeedback(fb, cls, state.overall === true ? "Checked: correct." : state.overall === false ? "Last check: not right yet." : "");
      renderPreview.now();
      render();
    }

    TASKS.set(id, { task, restore, get state() { return state; } });
    restore();
  }

  function updateProgress() {
    $$(".task-progress").forEach((bar) => {
      const page = bar.closest(".page");
      const ids = $$(".task[data-id]", page).map((t) => t.dataset.id).filter((id) => TASKS.has(id));
      const states = ids.map((id) => TASKS.get(id).state);
      const answered = states.filter(submittedSinceClear).length;
      const correct = states.filter((s) => s.overall === true).length;
      const seen = states.filter((s) => s.solutionViewed).length;
      $(".progress-text", bar).textContent = `${answered} of ${ids.length} answered · ${correct} correct on the latest check · ${seen} solution${seen === 1 ? "" : "s"} viewed`;
    });
  }
  function setupTasks() {
    $$(".page").forEach((page) => {
      const first = $(".task[data-id]", page);
      if (!first) return;
      const bar = el("div", { class: "task-progress" }, el("p", { class: "progress-text", role: "status" }));
      first.parentNode.insertBefore(bar, first);
    });
    $$(".task[data-id]").forEach(buildTask);
    updateProgress();
  }

  /* =========================================================== quizzes */
  function setupQuizzes() {
    $$("#l1-quiz, #l2-quiz").forEach((page) => {
      const items = $$(".cyu[data-id]", page);
      const score = $("[data-score]", page), summary = $("[data-summary]", page);
      const ui = new Map();

      function update() {
        const states = items.map((li) => store.get(li.dataset.id, "quiz"));
        const answered = states.filter(submittedSinceClear).length;
        const revealedOnly = states.filter((s) => s.revealed && !submittedSinceClear(s)).length;
        const first = states.filter((s) => s.firstTryCorrect === true).length;
        score.textContent = `Answered ${answered} of ${items.length} · ${first} correct on the first try${revealedOnly ? ` · ${revealedOnly} revealed without answering` : ""}`;
        summary.replaceChildren();
        // the review summary appears once every question has been answered or revealed
        if (answered + revealedOnly < items.length) { summary.textContent = `Finish all ${items.length} to see what to review.`; return; }
        const missed = [...new Set(items.filter((_, i) => states[i].firstTryCorrect !== true).map((li) => li.dataset.topic))];
        summary.append(el("strong", { text: `You got ${first} of ${items.length} on the first try. ` }));
        if (!missed.length) summary.append("Nothing to review.");
        else {
          summary.append("Worth another look: ");
          missed.forEach((pid, k) => {
            const pg = PAGES.find((p) => p.id === pid);
            const a = el("a", { href: `#${pid}` });
            a.textContent = pg ? pg.title : pid;
            summary.append(a);
            if (k < missed.length - 1) summary.append(", ");
          });
          summary.append(".");
          renderMath(summary);
        }
        const again = el("button", { class: "btn", text: "Start over" });
        again.addEventListener("click", reset);
        summary.append(" ", again);
      }

      items.forEach((li, qi) => {
        const id = li.dataset.id;
        const kind = li.dataset.kind;
        const bar = el("div", { class: "row" });
        const checkBtn = el("button", { class: "btn primary", text: "Check" });
        const showBtn = el("button", { class: "btn", text: "Show answer" });
        const fb = el("p", { class: "feedback", role: "status" });
        const notice = el("p", { class: "inline-notice", role: "status" });
        const why = $(":scope > .why", li);
        let input = null;
        const labels = $$("label[data-opt]", li);
        labels.forEach((l) => { $("input", l).name = id; });
        if (kind === "num") {
          input = el("input", { type: "text", "aria-label": `Answer to question ${qi + 1}`, autocomplete: "off", spellcheck: "false" });
          bar.append(input);
          input.addEventListener("keydown", (e) => { if (e.key === "Enter") checkBtn.click(); });
          input.addEventListener("input", () => {
            store.editDraft(id, "quiz", { raw: input.value });
            clearGradeDom();
          });
        } else {
          labels.forEach((l) => $("input", l).addEventListener("change", () => {
            store.editDraft(id, "quiz", { choice: l.dataset.opt });
            clearGradeDom();
          }));
        }
        // Editing / re-choosing invalidates the last grade on the page; a new Check is needed. A revealed answer stays shown.
        function clearGradeDom() {
          li.classList.remove("is-right");
          if (kind === "mc") paintMc(null, false);
          else if (why) why.hidden = true;
          setFeedback(fb, "", "");
          const s = store.get(id, "quiz");
          if (s.revealed) paintReveal();
          update();
        }
        bar.append(checkBtn, showBtn);
        li.insertBefore(bar, why || null);
        li.insertBefore(fb, why || null);
        li.insertBefore(notice, why || null);
        const spec = kind === "num" ? specOf(li) : null;

        function paintMc(choice, showWhy) {
          labels.forEach((l) => { l.classList.remove("right", "wrong"); $(".why", l).hidden = true; });
          const chosen = labels.find((l) => l.dataset.opt === choice);
          if (chosen && showWhy) {
            const ok = chosen.hasAttribute("data-correct");
            chosen.classList.add(ok ? "right" : "wrong");
            $(".why", chosen).hidden = false;
          }
        }

        checkBtn.addEventListener("click", () => {
          const prior = store.get(id, "quiz");
          if (kind === "mc") {
            const chosen = labels.find((l) => $("input", l).checked);
            if (!chosen) { setFeedback(fb, "", "Pick an option first."); return; }
            const ok = chosen.hasAttribute("data-correct");
            paintMc(chosen.dataset.opt, true);
            setFeedback(fb, ok ? "ok" : "bad", ok ? "Correct." : "Not this one. Read why, then try another.");
            const optIndex = labels.indexOf(chosen);
            store.addAttempt(id, "quiz", {
              answer: { choice: chosen.dataset.opt, choiceIndex: optIndex, raw: chosen.dataset.opt, normalized: chosen.dataset.opt },
              result: { correct: ok, overall: ok },
              feedbackKind: ok ? "correct" : chosen.dataset.tag || "incorrect",
              hintsRevealedAtSubmit: 0,
              solutionViewedBeforeSubmit: Boolean(prior.revealed),
            }, (it) => {
              it.choice = chosen.dataset.opt; it.correct = ok; it.tries += 1;
              if (it.firstTryCorrect === null && !it.revealed) it.firstTryCorrect = ok;
            });
            if (ok) li.classList.add("is-right");
          } else {
            const res = G.grade(spec, input.value);
            if (res.ok === null) { setFeedback(fb, "bad", res.error === "Type an answer first." ? res.error : `${res.error} ${PARSE_HELP}`); return; }
            const msg = res.ok ? { main: `Correct: ${res.value}.`, kind: "correct" } : wrongMessage(res, spec, "Try again, or press Show answer.");
            setFeedback(fb, res.ok ? "ok" : "bad", msg.main, msg.extra);
            if (res.ok && why) why.hidden = false;
            store.addAttempt(id, "quiz", {
              answer: { raw: input.value, normalized: res.normalized },
              result: { correct: res.ok, overall: res.ok },
              feedbackKind: msg.kind,
              hintsRevealedAtSubmit: 0,
              solutionViewedBeforeSubmit: Boolean(prior.revealed),
            }, (it) => {
              it.raw = input.value; it.normalized = res.normalized; it.correct = res.ok; it.tries += 1;
              if (it.firstTryCorrect === null && !it.revealed) it.firstTryCorrect = res.ok;
            });
            if (res.ok) li.classList.add("is-right");
          }
          update();
        });

        showBtn.addEventListener("click", () => {
          store.addEvent(id, "quiz", { type: "reveal" }, (it) => {
            if (!it.revealed && it.firstTryCorrect === null) it.firstTryCorrect = false;
            it.revealed = true;
          });
          paintReveal();
          update();
        });

        function paintReveal() {
          if (kind === "mc") {
            const right = $("label[data-correct]", li);
            right.classList.add("right");
            $(".why", right).hidden = false;
            setFeedback(fb, "", "");
          } else {
            setFeedback(fb, "", `Answer: ${evalFmt(li.dataset.answer)}.`);
            if (why) why.hidden = false;
          }
        }

        function restore() {
          const s = store.get(id, "quiz");
          li.classList.toggle("is-right", s.correct === true);
          if (kind === "mc") {
            labels.forEach((l) => { $("input", l).checked = l.dataset.opt === s.choice; });
            paintMc(s.choice, s.tries > 0 && s.correct !== null);
            if (s.correct !== null && s.tries > 0) setFeedback(fb, s.correct ? "ok" : "bad", s.correct ? "Correct." : "Not this one. Read why, then try another.");
            else setFeedback(fb, "", "");
          } else {
            if (input !== document.activeElement) input.value = s.raw || "";
            if (why) why.hidden = s.correct !== true;
            setFeedback(fb, s.correct === true ? "ok" : s.correct === false ? "bad" : "", s.correct === true ? `Correct: ${evalFmt(li.dataset.answer)}.` : s.correct === false ? "Last check: not right yet." : "");
          }
          if (s.revealed) paintReveal();
        }
        ui.set(id, { restore });
      });

      function reset() {
        items.forEach((li) => {
          store.clear(li.dataset.id, "quiz");
          li.classList.remove("is-right");
          $$("label", li).forEach((l) => l.classList.remove("right", "wrong"));
          $$(".why", li).forEach((w) => { w.hidden = true; });
          ui.get(li.dataset.id).restore();
        });
        update();
        window.scrollTo(0, page.offsetTop);
      }
      page._restore = () => { ui.forEach((u) => u.restore()); update(); };
      page._restore();
    });
  }

  /* =========================================================== hero */
  function setupHero() {
    const wrap = $("#hero-slots"), alpha = $("#hero-alpha"), strip = $("#hero-strip"), msg = $("#hero-msg");
    const repeatBtn = $("#hero-repeat"), orderBtn = $("#hero-order");
    const LETTERS = C.LETTERS.split("");
    let repeats = false, unordered = false;
    const inputs = [];
    for (let i = 0; i < 5; i++) {
      const s = el("div", { class: "slot" });
      const inp = el("input", { type: "text", maxlength: "1", "aria-label": `Letter ${i + 1}`, autocomplete: "off", spellcheck: "false" });
      s.append(inp, el("span"));
      wrap.append(s);
      inputs.push(inp);
      inp.addEventListener("input", () => onInput(i));
      inp.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !inp.value && i > 0) inputs[i - 1].focus(); });
    }
    LETTERS.forEach((L) => alpha.append(el("span", { text: L })));
    function onInput(i) {
      const inp = inputs[i];
      const v = inp.value.toUpperCase().replace(/[^A-Z]/g, "");
      inp.value = v;
      inp.classList.remove("bad");
      msg.textContent = "";
      if (v && !repeats) {
        const j = inputs.findIndex((o, k) => k !== i && o.value.toUpperCase() === v);
        if (j !== -1) {
          inp.classList.add("bad");
          msg.textContent = `${v} is already in slot ${j + 1}. Letters must all be different.`;
          inp.value = "";
          render();
          return;
        }
      }
      if (v && i < 4) inputs[i + 1].focus();
      render();
    }
    function render() {
      const used = new Set(inputs.map((x) => x.value.toUpperCase()).filter(Boolean));
      inputs.forEach((inp, i) => { inp.nextElementSibling.textContent = repeats ? "26 options" : `${26 - i} options left`; });
      $$("span", alpha).forEach((s) => s.classList.toggle("used", !repeats && used.has(s.textContent)));
      alpha.style.visibility = repeats ? "hidden" : "visible";
      orderBtn.disabled = repeats;
      strip.replaceChildren();
      const nums = repeats ? [26, 26, 26, 26, 26] : [26, 25, 24, 23, 22];
      nums.forEach((n, i) => { strip.append(slot(n)); strip.append(op(i < 4 ? "×" : unordered ? "÷" : "=")); });
      const total = nums.reduce((a, b) => a * BigInt(b), 1n);
      if (unordered && !repeats) {
        strip.append(slot("5!", "orderings of each set"), op("="));
        strip.append(slot(fmtBig(total / 120n), "5-letter sets: C(26,5)", "total"));
      } else {
        strip.append(slot(fmtBig(total), repeats ? "strings, repeats allowed (26⁵)" : "strings with distinct letters", "total"));
      }
      const word = inputs.map((x) => x.value.toUpperCase()).join("");
      if (word.length === 5 && !msg.textContent) {
        if (unordered && !repeats) {
          const set = [...word].sort().join(",");
          msg.textContent = `${word} is one of 120 orderings of the set {${set}}. All of them count as one set.`;
        } else msg.textContent = `${word} is one of ${fmtBig(total)}.`;
      }
    }
    repeatBtn.addEventListener("click", () => {
      repeats = !repeats;
      repeatBtn.setAttribute("aria-pressed", String(repeats));
      if (repeats) { unordered = false; orderBtn.setAttribute("aria-pressed", "false"); }
      msg.textContent = repeats ? "Repeats allowed: every slot has 26 options, so STEVE and SARAH count now." : "";
      render();
    });
    orderBtn.addEventListener("click", () => {
      unordered = !unordered;
      orderBtn.setAttribute("aria-pressed", String(unordered));
      msg.textContent = unordered ? "Each set of 5 letters appears 5! = 120 times among the sequences, so divide by 5!." : "";
      render();
    });
    $("#hero-clear").addEventListener("click", () => {
      inputs.forEach((x) => { x.value = ""; x.classList.remove("bad"); });
      msg.textContent = "";
      render();
      inputs[0].focus();
    });
    render();
  }

  /* =========================================================== set operations */
  function setupSetOps() {
    const grid = $("#setops-grid"), table = $("#setops-table");
    const U = [1, 2, 3, 4, 5, 6, 7, 8];
    // state per element: 0 none, 1 A, 2 B, 3 both
    const st = [1, 1, 3, 0, 2, 2, 0, 0];
    const names = ["in neither", "in A", "in B", "in A and B"];
    U.forEach((x, i) => {
      const b = el("button", { "aria-label": `Element ${x}` }, el("b", { text: String(x) }), el("small"));
      b.addEventListener("click", () => { st[i] = (st[i] + 1) % 4; render(); });
      grid.append(b);
    });
    const fmtSet = (xs) => (xs.length ? `{${xs.join(", ")}}` : "∅");
    function render() {
      [...grid.children].forEach((b, i) => {
        b.classList.toggle("in-a", Boolean(st[i] & 1));
        b.classList.toggle("in-b", Boolean(st[i] & 2));
        $("small", b).textContent = names[st[i]];
      });
      const A = U.filter((_, i) => st[i] & 1), B = U.filter((_, i) => st[i] & 2);
      const rows = [
        ["A", A], ["B", B], ["A ∪ B", U.filter((_, i) => st[i])], ["A ∩ B", U.filter((_, i) => st[i] === 3)],
        ["A \\ B", U.filter((_, i) => st[i] === 1)], ["Aᶜ", U.filter((_, i) => !(st[i] & 1))],
      ];
      table.replaceChildren(...rows.map(([n, xs]) => el("tr", {}, el("td", { text: n }), el("td", { text: fmtSet(xs) }), el("td", { text: `size ${xs.length}` }))));
      const both = U.filter((_, i) => st[i] === 3).length;
      table.append(el("tr", {}, el("td", { text: "|A| + |B|" }), el("td", { text: `${A.length} + ${B.length} = ${A.length + B.length}` }),
        el("td", { text: both ? `≠ |A ∪ B|: ${both} element${both > 1 ? "s" : ""} counted twice` : "= |A ∪ B| (no overlap)" })));
    }
    render();
  }

  /* =========================================================== lunch (sum rule) */
  function setupLunch() {
    const grid = $("#lunch-grid"), out = $("#lunch-out"), btn = $("#lunch-overlap");
    let overlap = false;
    function render() {
      const soups = Array.from({ length: 6 }, (_, i) => `soup ${i + 1}`);
      const salads = Array.from({ length: 9 }, (_, i) => `salad ${i + 1}`);
      if (overlap) salads[8] = "soup 6";
      grid.replaceChildren(
        el("div", {}, el("h4", { text: `Soups (${soups.length})` }), el("ul", {}, ...soups.map((s) => el("li", { class: overlap && s === "soup 6" ? "dup" : "", text: s })))),
        el("div", {}, el("h4", { text: `Salads (${salads.length})` }), el("ul", {}, ...salads.map((s) => el("li", { class: overlap && s === "soup 6" ? "dup" : "", text: s })))),
      );
      const distinct = new Set([...soups, ...salads]).size;
      out.textContent = overlap
        ? `6 + 9 = 15, but there are only ${distinct} different orders: “soup 6” is on both lists and got counted twice. The sum rule needs no overlap.`
        : `No dish is on both lists, so the sum rule applies: 6 + 9 = 15 different lunch orders.`;
    }
    btn.addEventListener("click", () => { overlap = !overlap; btn.setAttribute("aria-pressed", String(overlap)); render(); });
    render();
  }

  /* =========================================================== subs */
  function setupSubs() {
    const groups = [["Cheese", ["Swiss", "Cheddar"]], ["Meat", ["Turkey", "Ham", "Salami"]], ["Veggie", ["Lettuce", "Tomato", "Onion"]]];
    const pick = [0, 0, 0];
    const box = $("#sub-choices"), grid = $("#sub-grid"), out = $("#sub-out");
    groups.forEach(([name, opts], g) => {
      const row = el("div", { class: "choice-col", role: "group", "aria-label": name }, el("span", { text: name }));
      opts.forEach((o, i) => {
        const b = el("button", { class: "chip", "aria-pressed": String(i === 0), text: o });
        b.addEventListener("click", () => { pick[g] = i; $$("button", row).forEach((x, k) => x.setAttribute("aria-pressed", String(k === i))); render(); });
        row.append(b);
      });
      box.append(row);
    });
    const all = [];
    groups[0][1].forEach((_, a) => groups[1][1].forEach((_, b) => groups[2][1].forEach((_, c) => all.push([a, b, c]))));
    all.forEach(([a, b, c]) => grid.append(el("div", { text: `${groups[0][1][a]}, ${groups[1][1][b]}, ${groups[2][1][c]}` })));
    function render() {
      let idx = -1;
      [...grid.children].forEach((d, i) => {
        const [a, b, c] = all[i];
        const on = a === pick[0] && b === pick[1] && c === pick[2];
        if (on) idx = i;
        d.classList.toggle("on", on);
        d.classList.toggle("near", !on && a === pick[0] && b === pick[1]);
      });
      out.textContent = `Your sub is #${idx + 1} of ${all.length}. The shaded ones share your cheese and meat: there are 3 of them, one per veggie.`;
    }
    render();
  }

  /* =========================================================== power set */
  function setupPower() {
    const nIn = $("#pow-n"), bitsBox = $("#pow-bits"), list = $("#pow-list"), out = $("#pow-out");
    let n = 3, mask = 0b101;
    const subsetText = (m) => {
      const els = [];
      for (let i = 0; i < n; i++) if (m & (1 << (n - 1 - i))) els.push(`e${i + 1}`);
      return els.length ? `{${els.join(", ")}}` : "∅";
    };
    const bitString = (m) => m.toString(2).padStart(n, "0");
    function build() {
      n = Math.min(5, Math.max(1, Number(nIn.value) || 1));
      mask &= (1 << n) - 1;
      bitsBox.replaceChildren();
      for (let i = 0; i < n; i++) {
        const bit = 1 << (n - 1 - i);
        const b = el("button", { "aria-pressed": String(Boolean(mask & bit)), "aria-label": `Element e${i + 1}` });
        b.append(el("b", { text: `e${i + 1}` }), el("small"));
        b.addEventListener("click", () => { mask ^= bit; render(); });
        bitsBox.append(b);
      }
      list.replaceChildren();
      for (let m = 0; m < 1 << n; m++) list.append(el("div", {}, el("code", { text: bitString(m) }), subsetText(m)));
      render();
    }
    function render() {
      [...bitsBox.children].forEach((b, i) => {
        const on = Boolean(mask & (1 << (n - 1 - i)));
        b.setAttribute("aria-pressed", String(on));
        b.querySelector("small").textContent = on ? "in · 1" : "out · 0";
      });
      [...list.children].forEach((d, m) => d.classList.toggle("on", m === mask));
      out.textContent = `Bit string ${bitString(mask)} ↔ ${subsetText(mask)}.  ${Array(n).fill("2").join(" × ")} = ${1 << n} subsets in total.`;
    }
    nIn.addEventListener("input", build);
    build();
  }

  /* =========================================================== permutation tree */
  function setupTree() {
    const svg = $("#tree"), legend = $("#tree-legend"), btn = $("#tree-mode");
    const NS = "http://www.w3.org/2000/svg";
    let allowRepeats = false;
    const svgEl = (tag, attrs, text) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      if (text != null) e.textContent = text;
      return e;
    };
    function render() {
      svg.replaceChildren();
      const W = 960, left = 150, levels = [30, 110, 190, 270], leafY = 310;
      const kids = (seq) => [1, 2, 3].filter((d) => allowRepeats || !seq.includes(d));
      const leaves = [];
      (function walk(seq) { if (seq.length === 3) { leaves.push(seq); return; } kids(seq).forEach((d) => walk([...seq, d])); })([]);
      const step = (W - left - 20) / leaves.length;
      const leafX = new Map(leaves.map((s, i) => [s.join(""), left + step * (i + 0.5)]));
      const place = (seq) => {
        if (seq.length === 3) return leafX.get(seq.join(""));
        const xs = kids(seq).map((d) => place([...seq, d]));
        return (xs[0] + xs[xs.length - 1]) / 2;
      };
      (function draw(seq) {
        const x = place(seq), y = levels[seq.length];
        if (seq.length < 3) kids(seq).forEach((d) => {
          const c = [...seq, d];
          svg.append(svgEl("line", { x1: x, y1: y + 8, x2: place(c), y2: levels[c.length] - 14, class: "edge" }));
          draw(c);
        });
        if (seq.length === 0) svg.append(svgEl("circle", { cx: x, cy: y, r: 6, class: "root" }));
        else svg.append(svgEl("text", { x, y: y + 4, "text-anchor": "middle", "font-weight": "700" }, String(seq[seq.length - 1])));
        if (seq.length === 3) {
          const cls = new Set(seq).size < 3 ? "leaf-rep" : "leaf-ok";
          if (allowRepeats) seq.forEach((d, k) => svg.append(svgEl("text", { x, y: leafY + 8 + k * 16, "text-anchor": "middle", class: cls }, String(d))));
          else svg.append(svgEl("text", { x, y: leafY + 8, "text-anchor": "middle", class: cls, "font-size": "16" }, seq.join("")));
        }
      })([]);
      const counts = allowRepeats ? ["3 options", "3 options", "3 options"] : ["3 options", "2 options", "1 option"];
      ["1st entry", "2nd entry", "3rd entry"].forEach((t, i) => svg.append(svgEl("text", { x: 0, y: levels[i + 1] + 4, class: "lvl" }, `${t}: ${counts[i]}`)));
      svg.setAttribute("viewBox", `0 0 ${W} ${leafY + (allowRepeats ? 52 : 20)}`);
      const rep = leaves.filter((s) => new Set(s).size < 3).length;
      legend.replaceChildren(el("span", {}, el("span", { class: "sw sw-ok" }), `No repeats: ${leaves.length - rep}`));
      if (allowRepeats) legend.append(el("span", {}, el("span", { class: "sw sw-rep" }), `Has a repeat: ${rep}`), el("span", { text: `Total 3³ = ${leaves.length}, so repeats = 27 − 6 = ${rep}` }));
      else legend.append(el("span", { text: "3 · 2 · 1 = 3! = 6" }));
    }
    btn.addEventListener("click", () => {
      allowRepeats = !allowRepeats;
      btn.setAttribute("aria-pressed", String(allowRepeats));
      btn.textContent = allowRepeats ? "Show only sequences without repeats" : "Show all 27 sequences, including repeats";
      render();
    });
    render();
  }

  /* =========================================================== k-permutations */
  function setupKPerm() {
    const nIn = $("#kp-n"), kIn = $("#kp-k"), strip = $("#kp-strip");
    function render() {
      const n = Math.max(1, Math.min(60, Math.floor(Number(nIn.value)) || 1));
      const k = Math.max(0, Math.min(60, Math.floor(Number(kIn.value)) || 0));
      strip.replaceChildren();
      if (k > n) { strip.append(el("p", { text: `k = ${k} is more than n = ${n}: you can’t pick ${k} distinct items, so P(n, k) = 0.` })); return; }
      if (k === 0) { strip.append(slot("1", "the empty sequence", "total")); return; }
      const factors = Array.from({ length: k }, (_, i) => n - i);
      const shown = k <= 8 ? factors : [...factors.slice(0, 3), "⋯", ...factors.slice(-2)];
      shown.forEach((f, i) => {
        strip.append(f === "⋯" ? op("⋯") : slot(f));
        strip.append(op(i < shown.length - 1 ? (f === "⋯" || shown[i + 1] === "⋯" ? "" : "×") : "="));
      });
      strip.append(slot(fmtBig(C.perm(n, k)), `P(${n}, ${k}) = ${n}!/${n - k}!`, "total"));
    }
    nIn.addEventListener("input", render);
    kIn.addEventListener("input", render);
    render();
  }

  /* =========================================================== books */
  function setupBooks() {
    const shelf = $("#book-shelf"), people = $("#book-people");
    const P = ["Alice", "Bob", "Charlie"];
    const owner = [0, 2, 1, 0, 2];
    owner.forEach((_, b) => {
      const btn = el("button", { "aria-label": `Book ${b + 1}` });
      btn.addEventListener("click", () => { owner[b] = (owner[b] + 1) % 3; render(); });
      shelf.append(btn);
    });
    function render() {
      [...shelf.children].forEach((btn, b) => { btn.dataset.owner = owner[b]; btn.textContent = `Book ${b + 1} → ${P[owner[b]]}`; });
      people.replaceChildren(...P.map((p, i) => {
        const mine = owner.map((o, b) => (o === i ? b + 1 : null)).filter(Boolean);
        return el("div", {}, el("strong", { text: `${p}: ` }), mine.length ? `{${mine.join(", ")}}` : "∅");
      }));
    }
    $("#books-random").addEventListener("click", () => { for (let b = 0; b < 5; b++) owner[b] = Math.floor(Math.random() * 3); render(); });
    $("#books-reset").addEventListener("click", () => { owner.fill(0); render(); });
    render();
  }

  /* =========================================================== enumerators */
  const ENUM_CAP = 200000;
  function setupEnumerators() {
    $$(".panel.enum").forEach((panel) => {
      const kind = panel.dataset.space;
      const params = JSON.parse(panel.dataset.params || "{}");
      const inputs = JSON.parse(panel.dataset.inputs || "{}");
      const label = panel.dataset.label;
      const controls = el("div", { class: "controls" });
      const fields = {};
      for (const [name, [min, max, text]] of Object.entries(inputs)) {
        const isText = min === "text";
        const f = isText
          ? el("input", { type: "text", maxlength: String(max), "aria-label": text, value: params[name] })
          : el("input", { type: "number", min: String(min), max: String(max), "aria-label": text, value: String(params[name]) });
        fields[name] = f;
        controls.append(el("label", {}, `${text} `, f));
        f.addEventListener("input", () => rebuild());
      }
      const stepBtn = el("button", { class: "btn", text: "Check next" });
      const runBtn = el("button", { class: "btn primary", text: "Run all" });
      const resetBtn = el("button", { class: "btn quiet", text: "Reset" });
      controls.append(stepBtn, runBtn, resetBtn);
      const list = el("div", { class: "enum-list", "aria-hidden": "true" });
      const stats = el("p", { class: "enum-stats", role: "status" });
      const keys = el("p", { class: "enum-keys" });
      panel.append(controls, list, stats, keys);
      if (panel.dataset.note) panel.append(el("p", { class: "where", text: panel.dataset.note }));

      let runner = null, cur = {}, running = false, token = 0;
      function readParams() {
        const p = { ...params };
        for (const [name, [min, max]] of Object.entries(inputs)) {
          if (min === "text") p[name] = (fields[name].value || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, max) || "A";
          else p[name] = Math.max(min, Math.min(max, Math.floor(Number(fields[name].value)) || min));
        }
        if (kind === "kseqToSets" && p.k > p.n) p.k = p.n;
        return p;
      }
      function formulaValue(p) {
        const f = panel.dataset.formula;
        if (f === "multinomial") {
          const counts = {};
          for (const ch of p.word) counts[ch] = (counts[ch] || 0) + 1;
          return { expr: `${p.word.length}!/(${Object.values(counts).map((c) => `${c}!`).join("*")})`, vars: {} };
        }
        // only numeric params that the formula actually uses (e.g. not cond: "repeat")
        const vars = {};
        for (const [k, v] of Object.entries(p)) if (typeof v === "number" && new RegExp(`\\b${k}\\b`).test(f)) vars[k] = v;
        return { expr: f, vars };
      }
      function rebuild() {
        token++;
        running = false;
        cur = readParams();
        runner = new C.Runner(C.SPACES[kind](cur), { cap: ENUM_CAP });
        list.replaceChildren();
        renderStats();
      }
      function renderStats() {
        const s = runner.summary();
        const fv = formulaValue(cur);
        const formulaText = `${fv.expr.replace(/\*/g, "·")}${Object.keys(fv.vars).length ? ` with ${Object.entries(fv.vars).map(([k, v]) => `${k} = ${v}`).join(", ")}` : ""} = ${evalFmt(fv.expr, fv.vars)}`;
        const count = panel.dataset.distinct ? s.distinct : s.found;
        const totalTxt = fmtBig(s.total);
        stats.className = "enum-stats";
        if (s.checked === 0) {
          stats.textContent = `${totalTxt} ${runner.space.unit} to check. Formula: ${formulaText}.`;
        } else if (s.complete) {
          stats.className = "enum-stats done";
          const match = String(count) === G.evalToString(fv.expr, fv.vars);
          stats.textContent = `Checked all ${totalTxt} ${runner.space.unit}: ${fmtBig(count)} ${label}. ${match ? "Matches" : "Does NOT match"} the formula ${formulaText}.`;
        } else if (runner.capped) {
          stats.className = "enum-stats partial";
          stats.textContent = `Truncated: stopped after ${fmtBig(s.checked)} of ${totalTxt} ${runner.space.unit} (the limit is ${fmtBig(ENUM_CAP)}). ${fmtBig(count)} ${label} so far. This is a partial tally, not the answer; the formula gives ${formulaText}.`;
        } else {
          stats.className = "enum-stats partial";
          stats.textContent = `In progress: ${fmtBig(s.checked)} of ${totalTxt} checked, ${fmtBig(count)} ${label} so far. Partial tally; keep going.`;
        }
        if (runner.keys && s.checked > 0 && s.complete) {
          const groups = [...runner.keys.entries()];
          const sizes = [...new Set(groups.map(([, c]) => c))];
          const sample = groups.slice(0, 6).map(([k, c]) => `${k} ×${c}`).join(", ");
          keys.textContent = `Each ${kind === "anagrams" ? "word" : "set"} was produced ${sizes.length === 1 ? `exactly ${sizes[0]} times` : `${sizes.join(" or ")} times`}. For example: ${sample}${groups.length > 6 ? ", …" : ""}`;
        } else keys.textContent = "";
        runBtn.disabled = s.complete || runner.capped;
        stepBtn.disabled = s.complete || runner.capped;
      }
      function paint(items) {
        list.replaceChildren(...items.map((it) => el("span", { class: it.ok ? "ok" : "no", text: it.text })));
      }
      stepBtn.addEventListener("click", () => { paint(runner.step(1)); renderStats(); });
      runBtn.addEventListener("click", () => {
        if (running) return;
        running = true;
        const my = token;
        const chunk = () => {
          if (my !== token) return;
          const items = runner.step(5000);
          paint(items);
          renderStats();
          if (!runner.done && !runner.capped) setTimeout(chunk, 0);
          else running = false;
        };
        chunk();
      });
      resetBtn.addEventListener("click", rebuild);
      rebuild();
    });
  }

  /* =========================================================== symmetry */
  function setupSymmetry() {
    const nIn = $("#sym-n"), kIn = $("#sym-k"), rows = $("#sym-rows"), out = $("#sym-out");
    function subsets(n, k) {
      const res = [];
      for (let m = 0; m < 1 << n; m++) {
        let c = 0;
        for (let i = 0; i < n; i++) if (m & (1 << i)) c++;
        if (c === k) res.push(m);
      }
      return res;
    }
    function render() {
      const n = Math.max(1, Math.min(6, Math.floor(Number(nIn.value)) || 1));
      const k = Math.max(0, Math.min(n, Math.floor(Number(kIn.value)) || 0));
      const S = subsets(n, k);
      rows.replaceChildren(...S.map((m) => {
        const inc = el("div", { class: "cells" });
        const exc = el("div", { class: "cells" });
        for (let i = 0; i < n; i++) {
          const on = Boolean(m & (1 << i));
          inc.append(el("span", { class: on ? "on" : "", text: String(i + 1) }));
          exc.append(el("span", { class: on ? "" : "off", text: String(i + 1) }));
        }
        return el("div", { class: "sym-row" }, inc, el("small", { text: "↔" }), exc);
      }));
      out.textContent = `Each row pairs a choice of ${k} included (purple) with the ${n - k} excluded (gold). ${S.length} rows, so C(${n}, ${k}) = C(${n}, ${n - k}) = ${S.length}.`;
    }
    nIn.addEventListener("input", render);
    kIn.addEventListener("input", render);
    render();
  }

  /* =========================================================== grid paths */
  function setupGrid() {
    const svg = $("#grid-svg"), out = $("#grid-out");
    const R = 4, U = 3, X0 = 30, Y0 = 220, D = 65;
    const NS = "http://www.w3.org/2000/svg";
    let path = [];
    const svgEl = (tag, attrs, text) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      if (text != null) e.textContent = text;
      return e;
    };
    function pos() {
      let x = 0, y = 0;
      for (const s of path) if (s === "↑") y++; else x++;
      return [x, y];
    }
    function render() {
      svg.replaceChildren();
      for (let i = 0; i <= R; i++) svg.append(svgEl("line", { x1: X0 + i * D, y1: Y0, x2: X0 + i * D, y2: Y0 - U * D, class: "street" }));
      for (let j = 0; j <= U; j++) svg.append(svgEl("line", { x1: X0, y1: Y0 - j * D, x2: X0 + R * D, y2: Y0 - j * D, class: "street" }));
      for (let i = 0; i <= R; i++) for (let j = 0; j <= U; j++) svg.append(svgEl("circle", { cx: X0 + i * D, cy: Y0 - j * D, r: 7, class: "node" }));
      let x = 0, y = 0;
      for (const s of path) {
        const nx = s === "↑" ? x : x + 1, ny = s === "↑" ? y + 1 : y;
        svg.append(svgEl("line", { x1: X0 + x * D, y1: Y0 - y * D, x2: X0 + nx * D, y2: Y0 - ny * D, class: "step" }));
        x = nx; y = ny;
      }
      svg.append(svgEl("circle", { cx: X0 + x * D, cy: Y0 - y * D, r: 9, class: "me" }));
      svg.append(svgEl("text", { x: X0 - 22, y: Y0 + 24 }, "Gates"));
      svg.append(svgEl("text", { x: X0 + R * D - 30, y: Y0 - U * D - 12 }, "Starbucks"));
      const [cx, cy] = pos();
      $("#grid-up").disabled = cy >= U;
      $("#grid-right").disabled = cx >= R;
      const str = path.length ? `(${path.join(", ")})` : "(empty)";
      if (path.length === R + U) {
        const ups = path.map((s, i) => (s === "↑" ? i + 1 : null)).filter(Boolean);
        out.textContent = `Path ${str}. The ↑’s are at positions {${ups.join(", ")}}: a 3-element subset of {1, …, 7}. Every path gives one such subset, and every subset gives one path, so there are C(7, 3) = 35 paths.`;
      } else {
        out.textContent = `So far ${str}: ${path.length} of 7 moves, ${path.filter((s) => s === "↑").length} of 3 ups. Keep going to Starbucks.`;
      }
    }
    $("#grid-up").addEventListener("click", () => { if (pos()[1] < U) { path.push("↑"); render(); } });
    $("#grid-right").addEventListener("click", () => { if (pos()[0] < R) { path.push("→"); render(); } });
    $("#grid-undo").addEventListener("click", () => { path.pop(); render(); });
    $("#grid-reset").addEventListener("click", () => { path = []; render(); });
    $("#grid-random").addEventListener("click", () => {
      const spots = new Set();
      while (spots.size < U) spots.add(Math.floor(Math.random() * (R + U)));
      path = Array.from({ length: R + U }, (_, i) => (spots.has(i) ? "↑" : "→"));
      render();
    });
    render();
  }

  /* =========================================================== stars and bars */
  function setupStars() {
    const kIn = $("#sb-k"), nIn = $("#sb-n"), bins = $("#sb-bins"), code = $("#sb-code"), out = $("#sb-out");
    let xs = [3, 1, 1];
    function clampAll() {
      const k = Math.max(1, Math.min(6, Math.floor(Number(kIn.value)) || 1));
      const n = Math.max(0, Math.min(12, Math.floor(Number(nIn.value)) || 0));
      while (xs.length < k) xs.push(0);
      xs = xs.slice(0, k);
      let sum = xs.reduce((a, b) => a + b, 0);
      // keep the sum equal to n: add to / take from the last bins
      for (let i = k - 1; sum > n && i >= 0; i--) { const d = Math.min(xs[i], sum - n); xs[i] -= d; sum -= d; }
      if (sum < n) xs[0] += n - sum;
      return { k, n };
    }
    function render() {
      const { k, n } = clampAll();
      bins.replaceChildren(...xs.map((x, i) => {
        const minus = el("button", { "aria-label": `Move one from x${i + 1} to the next bin`, text: "−" });
        const plus = el("button", { "aria-label": `Move one into x${i + 1} from another bin`, text: "+" });
        minus.disabled = x === 0 || k === 1;
        plus.disabled = k === 1 || xs.every((v, j) => j === i || v === 0);
        minus.addEventListener("click", () => { xs[i]--; xs[(i + 1) % k]++; render(); });
        plus.addEventListener("click", () => {
          const j = xs.findIndex((v, jj) => jj !== i && v > 0);
          if (j >= 0) { xs[j]--; xs[i]++; render(); }
        });
        return el("div", { class: "sb-bin" }, el("small", { text: `x${i + 1}` }), el("span", { class: "val", text: String(x) }), minus, " ", plus);
      }));
      const bits = C.tupleToBits(xs);
      code.replaceChildren(el("span", { class: "sb-line", text: `(${xs.join(", ")}) ↦ ${bits || "(empty)"}` }));
      const stars = el("span", { class: "sb-line" });
      [...bits].forEach((c) => stars.append(c === "1" ? el("span", { text: "* " }) : el("span", { class: "bar", text: "| " })));
      code.append(stars);
      out.textContent = `${n} stars and ${k - 1} bar${k - 1 === 1 ? "" : "s"}: ${n + k - 1} symbols. Choose where the ${k - 1} bar${k - 1 === 1 ? " goes" : "s go"}: C(${n + k - 1}, ${k - 1}) = ${fmtBig(C.choose(n + k - 1, k - 1))} solutions.`;
    }
    kIn.addEventListener("input", render);
    nIn.addEventListener("input", render);
    render();
  }

  /* =========================================================== SEATTLE stepper */
  function setupSeattle() {
    const slotsBox = $("#seattle-slots"), strip = $("#seattle-strip"), out = $("#seattle-out");
    // two example placements, both from the lecture's order of letters: T's, E's, S, L, A
    const EXAMPLES = [
      ["T", "E", "S", "T", "A", "L", "E"],
      ["S", "E", "A", "T", "T", "L", "E"],
    ];
    const ORDER = [
      { letter: "T", count: 2, what: "Locations of T’s" },
      { letter: "E", count: 2, what: "Locations of E’s" },
      { letter: "S", count: 1, what: "Location of S" },
      { letter: "L", count: 1, what: "Location of L" },
      { letter: "A", count: 1, what: "Location of A" },
    ];
    let ex = 0, step = 0;
    function render() {
      const word = EXAMPLES[ex];
      const placed = new Set(ORDER.slice(0, step).map((o) => o.letter));
      const newest = step > 0 ? ORDER[step - 1].letter : null;
      slotsBox.replaceChildren(...word.map((ch) => {
        const on = placed.has(ch);
        return el("span", { class: `${on ? "filled" : ""} ${ch === newest ? "new" : ""}`.trim(), text: on ? ch : "_" });
      }));
      strip.replaceChildren();
      let free = 7;
      let running = 1n;
      ORDER.slice(0, step).forEach((o, i) => {
        const ways = C.choose(free, o.count);
        running *= ways;
        strip.append(slot(o.count > 1 ? `C(${free},${o.count})` : String(free), `${o.what}: ${ways}`));
        free -= o.count;
        if (i < step - 1) strip.append(op("×"));
      });
      if (step === 0) {
        out.textContent = "7 empty spots. Press Next step to place the letters one type at a time, as on the slide.";
      } else if (step < ORDER.length) {
        out.textContent = `Running product so far: ${fmtBig(running)}. This counts the ways to place the first ${step} letter type${step > 1 ? "s" : ""} only, not the answer yet. ${free} spots are still empty.`;
      } else {
        strip.append(op("="), slot(fmtBig(running), "all 7 spots filled", "total"));
        out.textContent = `Every spot is filled, so the product is the full count: ${fmtBig(running)} = 7!/(2!·2!).`;
      }
      $("#seattle-back").disabled = step === 0;
      $("#seattle-next").disabled = step === ORDER.length;
    }
    $("#seattle-next").addEventListener("click", () => { if (step < ORDER.length) step++; render(); });
    $("#seattle-back").addEventListener("click", () => { if (step > 0) step--; render(); });
    $("#seattle-other").addEventListener("click", () => { ex = (ex + 1) % EXAMPLES.length; render(); });
    render();
  }

  /* =========================================================== binomial expansion */
  function setupExpand() {
    const nIn = $("#ex-n"), cols = $("#ex-cols"), out = $("#ex-out");
    let pick = 1;
    function render() {
      const n = Math.max(1, Math.min(6, Math.floor(Number(nIn.value)) || 1));
      if (pick > n) pick = n;
      const prods = C.expandProducts(n);
      cols.replaceChildren();
      for (let k = n; k >= 0; k--) {
        const mine = prods.filter((p) => [...p].filter((c) => c === "x").length === k);
        const term = `${k ? (k > 1 ? `x^${k}` : "x") : ""}${n - k ? (n - k > 1 ? `y^${n - k}` : "y") : ""}`;
        const btn = el("button", { class: "expand-col", "aria-pressed": String(k === pick) },
          el("h4", { text: `${mine.length} · ${term.replace(/\^(\d)/g, (_, d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d])}` }),
          el("div", { class: "prods", text: mine.join(" ") }));
        btn.addEventListener("click", () => { pick = k; render(); });
        cols.append(btn);
      }
      out.textContent = `(x+y)^${n} has ${prods.length} = 2^${n} products. Exactly ${fmtBig(C.choose(n, pick))} of them have ${pick} x’s: choose which ${pick} of the ${n} copies give x, C(${n}, ${pick}). The column sizes add up to 2^${n}.`;
    }
    nIn.addEventListener("input", render);
    render();
  }

  /* =========================================================== brute-force buttons in solutions */
  function setupBrute() {
    $$("[data-brute]").forEach((btn) => {
      const out = btn.nextElementSibling;
      const def = C.BRUTE[btn.dataset.brute];
      btn.addEventListener("click", () => {
        const checker = def.make();
        const expected = G.evalToString(def.expected);
        btn.disabled = true;
        out.className = "brute";
        const t0 = performance.now();
        const chunk = () => {
          const r = checker.step(200000);
          if (!r.done) {
            out.textContent = `Checking… ${fmtBig(r.checked)} of ${fmtBig(checker.total)} ${def.of} so far (${fmtBig(r.found)} valid so far, not final).`;
            setTimeout(chunk, 0);
            return;
          }
          const ms = Math.round(performance.now() - t0);
          const match = String(r.found) === expected;
          out.className = `brute ${match ? "ok" : ""}`;
          out.textContent = `Found ${fmtBig(r.found)} after checking all ${fmtBig(checker.total)} ${def.of} in ${ms} ms. ${match ? "Matches the formula." : `Formula gives ${evalFmt(def.expected)}.`}`;
          btn.disabled = false;
        };
        setTimeout(chunk, 20);
      });
    });
  }

  /* =========================================================== boot */
  function restoreAll() {
    TASKS.forEach((t) => t.restore());
    $$(".check[data-id]").forEach((b) => b._restore && b._restore());
    $$("#l1-quiz, #l2-quiz").forEach((p) => p._restore && p._restore());
  }

  async function boot() {
    buildPagers();
    setupTasks();
    setupSteps();
    setupChecks();
    setupQuizzes();
    setupHero();
    setupSetOps();
    setupLunch();
    setupSubs();
    setupPower();
    setupTree();
    setupKPerm();
    setupBooks();
    setupEnumerators();
    setupSymmetry();
    setupGrid();
    setupStars();
    setupSeattle();
    setupExpand();
    setupBrute();
    window.addEventListener("hashchange", () => show(location.hash.slice(1)));
    const rail = $(".rail"), menuBtn = $("#menu-btn");
    menuBtn.addEventListener("click", () => {
      const open = rail.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    $$(".rail a[href^='#']").forEach((a) => a.addEventListener("click", () => {
      rail.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    }));
    show(location.hash.slice(1) || "home");
    renderMath(document.body);
    store.onReload(restoreAll);
    // best effort: push anything pending when the tab is hidden or closed (the local mirror already has it)
    window.addEventListener("pagehide", () => { store.flushNow(); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") store.flushNow(); });
    await store.load();
    document.documentElement.dataset.ready = "1";
  }
  boot();
})();
