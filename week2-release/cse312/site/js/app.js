"use strict";
/*
  UI for the CSE 312 week 2 site. Builds problem, quick-check and quiz UI from the markup in index.html,
  runs the widgets, and records learner state through js/store.js (window.CourseStore).
  Grading goes through js/grader.js (exact BigInt rationals); enumeration through js/prob.js.
  The problem / quick-check / quiz machinery is week 1's, unchanged in behavior; the widgets are new.
*/
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const G = window.CSE312Grader;
  const Pr = window.Prob;
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

  // Keep punctuation that touches short inline math on the same line as the math, e.g. "(\(A\))" or "\(c = 10\),".
  // Long formulas are left alone so KaTeX can still break them on narrow screens.
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
      const span = document.createElement("span");
      span.className = "math-glue";
      k.before(span);
      if (head) span.append(pv.splitText(pv.data.length - head[0].length));
      span.append(k);
      if (tail) { nx.splitText(tail[0].length); span.append(nx); }
    });
  }
  const renderMath = (node) => { if (window.renderMathInElement) { window.renderMathInElement(node, KATEX_OPTS); glueMath(node); } };
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
    const close = el("button", { "aria-label": "Dismiss", text: "×" });
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
    document.title = `${page.title} · CSE 312 week 2`;
    closeMenu();
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
    if (d.near) spec.near = d.near;
    const list = $(":scope > ul.miscon", node);
    spec.miscon = list ? $$("li", list).map((li) => ({ expr: li.dataset.expr, tag: li.dataset.tag, msg: li.innerHTML })) : [];
    return spec;
  }
  const PARSE_HELP = "Use numbers and fractions with + − * / ^ ! % ( ), or C(n,k) and P(n,k).";
  function wrongMessage(res, spec, next = "Try again, or ask for a hint.") {
    if (res.misconception) return { main: "Not quite.", extra: res.misconception.msg, kind: res.misconception.tag };
    if (spec.type === "formula") return { main: res.detail || "Not quite. Try a small case by hand.", kind: "incorrect" };
    if (spec.type === "yesno") return { main: "Not quite. Try a small example, then reread the question.", kind: "incorrect" };
    if (res.near) return { main: `Close, but not exact. Yours is ${res.value}, which looks rounded. Give the exact value as a fraction or an expression.`, kind: "rounded" };
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
      const input = el("input", { type: "text", "aria-label": "Your answer", autocomplete: "off", spellcheck: "false", placeholder: "e.g. 43+20-7 or 7/20" });
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
        placeholder: spec.dataset.placeholder || (isSelf ? "your answer" : "e.g. C(13,5) or 3/16"),
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
    const work = el("textarea", { id: workId, rows: "4", placeholder: "Explain how you got your answer. Wrap math in \\( … \\) to preview it." });
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
          : `${unreadable[0].res.error} Use numbers${vars ? ", the letters in the problem (like n and m)," : ""} with + − * / ^ ! % ( ), fractions like 7/20, or C(n,k) and P(n,k).`);
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
        const tags = results.filter((r) => r.res.ok === false).map((r) => wrongMessage(r.res, r.p.spec).kind).filter((k) => k !== "incorrect");
        feedbackKind = tags.length ? [...new Set(tags)].join(",") : "incorrect";
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
    $$("#l3-quiz, #l4-quiz, #l5-quiz").forEach((page) => {
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


  /* =========================================================== shared widget helpers */
  const SVGNS = "http://www.w3.org/2000/svg";
  const fracStr = (n, d) => Pr.frac(BigInt(n), BigInt(d)); // "7/20", or "3" when whole
  const texFrac = (n, d) => { const s = fracStr(n, d); const [a, b] = s.split("/"); return b ? `\\tfrac{${a}}{${b}}` : a; };
  const exact = (expr) => { const r = G.tryEval(expr); return r.ok ? r.value : null; };
  const exactStr = (expr) => { const r = G.tryEval(expr); return r.ok ? G.format(r.value) : "?"; };
  function bigDecimal(num, den, digits = 4) {
    num = BigInt(num); den = BigInt(den);
    if (den === 0n) return "–";
    const scale = 10n ** BigInt(digits + 2);
    const v = Number((num * scale) / den) / Number(scale);
    return v.toFixed(digits);
  }
  const ratDecimal = (r, digits = 4) => bigDecimal(r.n, r.d, digits);
  function setMath(node, html) { node.innerHTML = html; renderMath(node); }
  function pressGroup(buttons, active) { buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === active))); }
  const clampInt = (v, lo, hi, dflt) => { const x = Math.floor(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : dflt; };

  /* =========================================================== mobile menu */
  function closeMenu() {
    const btn = $("#menu-btn");
    if (!btn) return;
    btn.setAttribute("aria-expanded", "false");
    $(".rail").classList.remove("open");
  }
  function setupMenu() {
    const btn = $("#menu-btn");
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      $(".rail").classList.toggle("open", open);
    });
    $$("[data-jump]").forEach((a) => a.addEventListener("click", () => {
      setTimeout(() => { const t = document.getElementById(a.dataset.jump); if (t) t.scrollIntoView({ block: "center" }); }, 30);
    }));
  }

  /* =========================================================== Venn helper (2 or 3 circles, any region highlight) */
  // circles: [{ id, cx, cy, r }]; regions: membership strings like "10" (in first, not second) for every pattern
  function vennSvg(svg, circles, uid) {
    const defs = [];
    circles.forEach((c) => {
      defs.push(`<clipPath id="${uid}-in-${c.id}"><circle cx="${c.cx}" cy="${c.cy}" r="${c.r}"/></clipPath>`);
      defs.push(`<mask id="${uid}-out-${c.id}"><rect x="-10" y="-10" width="1000" height="1000" fill="#fff"/><circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="#000"/></mask>`);
    });
    const vb = svg.viewBox.baseVal;
    const patterns = [];
    for (let m = 0; m < 2 ** circles.length; m++) patterns.push(circles.map((_, i) => ((m >> (circles.length - 1 - i)) & 1 ? "1" : "0")).join(""));
    const regions = patterns.map((p) => {
      // nested groups: clip to each "in" circle, then mask out each "out" circle
      let inner = `<rect class="region-fill" x="${vb.x}" y="${vb.y}" width="${vb.width}" height="${vb.height}"/>`;
      circles.forEach((c, i) => { if (p[i] === "0") inner = `<g mask="url(#${uid}-out-${c.id})">${inner}</g>`; });
      circles.forEach((c, i) => { if (p[i] === "1") inner = `<g clip-path="url(#${uid}-in-${c.id})">${inner}</g>`; });
      return `<g class="region" data-region="${p}">${inner}</g>`;
    });
    const outlines = circles.map((c) => `<circle class="outline" cx="${c.cx}" cy="${c.cy}" r="${c.r}"/>`).join("");
    svg.innerHTML = `<defs>${defs.join("")}</defs><rect class="omega" x="${vb.x + 1}" y="${vb.y + 1}" width="${vb.width - 2}" height="${vb.height - 2}" rx="10"/>${regions.join("")}${outlines}<g class="labels"></g>`;
    return { region: (p) => svg.querySelector(`.region[data-region="${p}"]`), labels: svg.querySelector(".labels") };
  }
  function svgText(parent, x, y, text, cls) {
    const t = document.createElementNS(SVGNS, "text");
    t.setAttribute("x", x); t.setAttribute("y", y);
    if (cls) t.setAttribute("class", cls);
    t.textContent = text;
    parent.append(t);
    return t;
  }

  /* =========================================================== home hero: one survey, three lectures */
  function setupHero() {
    const svg = $("#hero-venn"), out = $("#hero-out");
    const V = vennSvg(svg, [{ id: "a", cx: 165, cy: 132, r: 92 }, { id: "b", cx: 262, cy: 132, r: 72 }], "hv");
    const N = { "10": 36, "11": 7, "01": 13, "00": 14 };
    const POS = { "10": [118, 140], "11": [218, 140], "01": [292, 140], "00": [385, 250] };
    Object.entries(POS).forEach(([p, [x, y]]) => svgText(V.labels, x, y, String(N[p]), "num"));
    svgText(V.labels, 70, 30, "A: ice cream", "set-name");
    svgText(V.labels, 250, 46, "B: donuts", "set-name");
    svgText(V.labels, 16, 256, "Ω: 70 students", "omega-name");
    const LENS = {
      union: { on: ["10", "11", "01"], off: [], html: `<p class="lens-q">How many students like ice cream or donuts?</p><p>\\(|A\\cup B| = |A| + |B| - |A\\cap B| = 43 + 20 - 7 = 56\\)</p><p class="lens-why">Adding 43 and 20 counts the 7 in the middle twice, so subtract them once. Same as \\(36 + 7 + 13\\). <a href="#l3-ie">Inclusion-exclusion →</a></p>` },
      pa: { on: ["10", "11"], off: [], html: `<p class="lens-q">Pick one of the 70 students uniformly at random. \\(P(A)\\)?</p><p>\\(P(A) = \\dfrac{|A|}{|\\Omega|} = \\dfrac{43}{70}\\approx 0.614\\)</p><p class="lens-why">Every student is equally likely, so a probability is a count divided by a count. <a href="#l4-uniform">Equally likely outcomes →</a></p>` },
      cond: { on: ["11"], off: ["10", "00"], html: `<p class="lens-q">You learn the student likes donuts. Now what is \\(P(A\\mid B)\\)?</p><p>\\(P(A\\mid B) = \\dfrac{|A\\cap B|}{|B|} = \\dfrac{7}{7+13} = \\dfrac{7}{20}\\)</p><p class="lens-why">Knowing \\(B\\) shrinks the sample space to the 20 donut lovers. <a href="#l5-conditional">Conditional probability →</a></p>` },
      rev: { on: ["11"], off: ["01", "00"], html: `<p class="lens-q">Reverse it: given ice cream, \\(P(B\\mid A)\\)?</p><p>\\(P(B\\mid A) = \\dfrac{7}{43}\\ne\\dfrac{7}{20} = P(A\\mid B)\\)</p><p class="lens-why">Same overlap, different denominator. Reversing a condition changes the answer. <a href="#l5-reversing">Reversing the condition →</a></p>` },
    };
    const btns = $$(".lens", $("#home"));
    function render(key) {
      const L = LENS[key];
      ["10", "11", "01", "00"].forEach((p) => {
        const r = V.region(p);
        r.classList.toggle("on", L.on.includes(p));
        r.classList.toggle("off", L.off.includes(p));
      });
      svg.classList.toggle("restricted", L.off.length > 0);
      setMath(out, L.html);
      pressGroup(btns, btns.find((b) => b.dataset.lens === key));
    }
    btns.forEach((b) => b.addEventListener("click", () => render(b.dataset.lens)));
    render("union");
  }

  /* =========================================================== L3: binomial expansion columns */
  function expandProducts(n) {
    const out = [];
    for (let m = 0; m < 2 ** n; m++) {
      let s = "";
      for (let i = n - 1; i >= 0; i--) s += (m >> i) & 1 ? "y" : "x";
      out.push(s);
    }
    return out;
  }
  const sup = (k) => String(k).split("").map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]).join("");
  const monomial = (k, n) => `${k ? (k > 1 ? `x${sup(k)}` : "x") : ""}${n - k ? (n - k > 1 ? `y${sup(n - k)}` : "y") : ""}` || "1";
  function setupExpand() {
    const nIn = $("#ex-n"), cols = $("#ex-cols"), out = $("#ex-out");
    let pick = 1;
    function render() {
      const n = clampInt(nIn.value, 1, 6, 4);
      if (pick > n) pick = n;
      const prods = expandProducts(n);
      cols.replaceChildren();
      for (let k = n; k >= 0; k--) {
        const mine = prods.filter((p) => [...p].filter((c) => c === "x").length === k);
        const btn = el("button", { class: "expand-col", "aria-pressed": String(k === pick), "aria-label": `${mine.length} products simplify to ${monomial(k, n)}` },
          el("span", { class: "coef", text: String(mine.length) }), el("span", { class: "mono", text: monomial(k, n) }),
          el("div", { class: "prods", text: mine.join(" ") }));
        btn.addEventListener("click", () => { pick = k; render(); });
        cols.append(btn);
      }
      out.textContent = `(x+y)^${n} multiplies out to ${prods.length} = 2^${n} products. Exactly ${Pr.choose(n, pick)} of them have ${pick} x’s: choose which ${pick} of the ${n} copies give x, which is C(${n},${pick}). The column sizes add up to 2^${n}.`;
    }
    nIn.addEventListener("input", render);
    render();
  }

  /* =========================================================== L3: plug numbers into the binomial theorem */
  function setupPlugin() {
    const chips = $$("#plugin [data-xy]"), nIn = $("#pl-n"), row = $("#pl-row"), out = $("#pl-out");
    let xy = [1, 1];
    function render() {
      const n = clampInt(nIn.value, 1, 12, 4);
      const [x, y] = xy;
      row.replaceChildren();
      let odd = 0n, even = 0n, total = 0n;
      for (let k = 0; k <= n; k++) {
        const c = Pr.choose(n, k);
        const term = c * BigInt(x) ** BigInt(k) * BigInt(y) ** BigInt(n - k);
        total += term;
        if (k % 2) odd += c; else even += c;
        const cell = el("div", { class: `pr-cell ${k % 2 ? "odd" : "even"} ${term < 0n ? "neg" : ""}` },
          el("span", { class: "k", text: `k=${k}` }), el("b", { text: String(term) }));
        row.append(cell);
      }
      if (x === 1 && y === 1) setMath(out, `Each term is just \\(\\binom{${n}}{k}\\). They add to \\((1+1)^{${n}} = 2^{${n}} = ${total}\\): every subset of an ${n}-element set, grouped by size.`);
      else if (x === -1) setMath(out, `Odd \\(k\\) terms flip sign. The sum is \\((-1+1)^{${n}} = 0\\), so the odd-\\(k\\) coefficients (${odd}) equal the even-\\(k\\) ones (${even}).`);
      else setMath(out, `Each term is \\(\\binom{${n}}{k}2^k\\). They add to \\((2+1)^{${n}} = 3^{${n}} = ${total}\\). (Reading 1.3.5 uses this to count pairs \\(A\\subseteq B\\subseteq[n]\\).)`);
    }
    chips.forEach((c) => c.addEventListener("click", () => { xy = c.dataset.xy.split(",").map(Number); pressGroup(chips, c); render(); }));
    nIn.addEventListener("input", render);
    render();
  }

  /* =========================================================== L3: Pascal split A / B */
  function kSubsets(n, k) {
    const it = Pr.combos(n, k), out = [];
    for (let s = it.next(); s; s = it.next()) out.push(s.map((i) => i + 1));
    return out;
  }
  function setupPascalSplit() {
    const nIn = $("#ps-n"), kIn = $("#ps-k");
    function render() {
      const n = clampInt(nIn.value, 2, 7, 4);
      const k = clampInt(kIn.value, 1, n - 1, Math.min(2, n - 1));
      const subs = kSubsets(n, k);
      const A = subs.filter((s) => s.includes(n)), B = subs.filter((s) => !s.includes(n));
      const chip = (s) => { const d = el("span", { class: "sub-chip" }); s.forEach((v) => d.append(el("i", { class: v === n ? "is-n" : "", text: String(v) }))); return d; };
      $("#ps-a").replaceChildren(...A.map(chip));
      $("#ps-b").replaceChildren(...B.map(chip));
      setMath($("#ps-a-title"), `\\(A\\): contain ${n} · \\(\\binom{${n - 1}}{${k - 1}} = ${A.length}\\)`);
      setMath($("#ps-b-title"), `\\(B\\): don’t contain ${n} · \\(\\binom{${n - 1}}{${k}} = ${B.length}\\)`);
      setMath($("#ps-out"), `Every one of the \\(\\binom{${n}}{${k}} = ${subs.length}\\) subsets lands in exactly one column, so \\(${subs.length} = ${A.length} + ${B.length}\\).`);
    }
    nIn.addEventListener("input", render); kIn.addEventListener("input", render);
    render();
  }

  /* =========================================================== L3: Pascal's triangle */
  function setupTriangle() {
    const tri = $("#tri"), out = $("#tri-out");
    const ROWS = 9;
    let sel = [4, 2];
    function render() {
      tri.replaceChildren();
      for (let n = 0; n < ROWS; n++) {
        const r = el("div", { class: "tri-row" });
        for (let k = 0; k <= n; k++) {
          const isSel = sel[0] === n && sel[1] === k;
          const isParent = sel[1] > 0 && sel[1] < sel[0] && n === sel[0] - 1 && (k === sel[1] - 1 || k === sel[1]);
          const b = el("button", { class: `tri-cell${isSel ? " sel" : ""}${isParent ? " parent" : ""}`, "aria-label": `C(${n},${k}) = ${Pr.choose(n, k)}`, text: String(Pr.choose(n, k)) });
          b.addEventListener("click", () => { sel = [n, k]; render(); });
          r.append(b);
        }
        tri.append(r);
      }
      const [n, k] = sel;
      if (k === 0 || k === n) setMath(out, `\\(\\binom{${n}}{${k}} = 1\\): an edge of the triangle. There’s one way to choose nothing, and one way to choose everything.`);
      else setMath(out, `\\(\\binom{${n}}{${k}} = \\binom{${n - 1}}{${k - 1}} + \\binom{${n - 1}}{${k}} = ${Pr.choose(n - 1, k - 1)} + ${Pr.choose(n - 1, k)} = ${Pr.choose(n, k)}\\)`);
    }
    render();
  }

  /* =========================================================== L3: inclusion-exclusion counter */
  function setupIE() {
    const svg = $("#ie-venn"), inputs = $("#ie-inputs"), stepsBox = $("#ie-steps"), out = $("#ie-out");
    const chips = $$("#ie [data-sets]");
    const DEFAULTS = {
      2: { A: 43, B: 20, AB: 7 },
      3: { A: 43, B: 20, C: 35, AB: 7, AC: 16, BC: 11, ABC: 4 },
    };
    const LABEL = { A: "|A|", B: "|B|", C: "|C|", AB: "|A∩B|", AC: "|A∩C|", BC: "|B∩C|", ABC: "|A∩B∩C|" };
    let sets = 3, vals = { ...DEFAULTS[3] }, done = 0;
    const GEOM = {
      2: { circles: [{ id: "A", cx: 140, cy: 150, r: 95 }, { id: "B", cx: 228, cy: 150, r: 80 }], pos: { "10": [92, 155], "11": [186, 155], "01": [272, 155], "00": [325, 284] }, names: [["A", 70, 52], ["B", 290, 60]] },
      3: { circles: [{ id: "A", cx: 130, cy: 118, r: 85 }, { id: "B", cx: 230, cy: 118, r: 85 }, { id: "C", cx: 180, cy: 203, r: 85 }], pos: { "100": [86, 98], "010": [274, 98], "001": [180, 268], "110": [180, 84], "101": [124, 186], "011": [236, 186], "111": [180, 146], "000": [330, 290] }, names: [["A", 40, 40], ["B", 312, 40], ["C", 282, 288]] },
    };
    // formula steps: each is a list of [sign, key]
    const STEPS = {
      2: [{ label: "+ singles", terms: [[1, "A"], [1, "B"]] }, { label: "− double", terms: [[-1, "AB"]] }],
      3: [{ label: "+ singles", terms: [[1, "A"], [1, "B"], [1, "C"]] }, { label: "− doubles", terms: [[-1, "AB"], [-1, "AC"], [-1, "BC"]] }, { label: "+ triple", terms: [[1, "ABC"]] }],
    };
    let V = null;
    const keyCovers = (key, pattern, names) => [...key].every((ch) => pattern[names.indexOf(ch)] === "1");
    function regions() {
      const v = vals;
      if (sets === 2) return { "10": v.A - v.AB, "11": v.AB, "01": v.B - v.AB };
      return {
        "111": v.ABC, "110": v.AB - v.ABC, "101": v.AC - v.ABC, "011": v.BC - v.ABC,
        "100": v.A - v.AB - v.AC + v.ABC, "010": v.B - v.AB - v.BC + v.ABC, "001": v.C - v.AC - v.BC + v.ABC,
      };
    }
    function buildInputs() {
      inputs.replaceChildren();
      Object.keys(DEFAULTS[sets]).forEach((key) => {
        const inp = el("input", { type: "number", min: "0", max: "999", value: String(vals[key]), "aria-label": LABEL[key] });
        inp.addEventListener("input", () => { vals[key] = clampInt(inp.value, 0, 999, 0); render(); });
        inputs.append(el("label", { class: "ie-in" }, el("span", { text: LABEL[key] }), inp));
      });
    }
    function buildStepButtons() {
      stepsBox.replaceChildren();
      const bar = el("div", { class: "row" });
      const next = el("button", { class: "btn primary", id: "ie-next" });
      const back = el("button", { class: "btn", text: "Back" });
      const reset = el("button", { class: "btn quiet", text: "Reset" });
      next.addEventListener("click", () => { if (done < STEPS[sets].length) { done++; render(); } });
      back.addEventListener("click", () => { if (done > 0) { done--; render(); } });
      reset.addEventListener("click", () => { done = 0; vals = { ...DEFAULTS[sets] }; buildInputs(); render(); });
      const chain = el("div", { class: "ie-chain" });
      STEPS[sets].forEach((s) => chain.append(el("span", { class: "ie-term", text: s.label })));
      bar.append(next, back, reset);
      stepsBox.append(chain, bar);
    }
    function setup() {
      const g = GEOM[sets];
      V = vennSvg(svg, g.circles, `ie${sets}`);
      g.names.forEach(([t, x, y]) => svgText(V.labels, x, y, t, "set-name"));
      done = 0;
      buildInputs();
      buildStepButtons();
      render();
    }
    function render() {
      const g = GEOM[sets], names = g.circles.map((c) => c.id);
      const reg = regions();
      const bad = Object.entries(reg).filter(([, n]) => n < 0);
      // times each region has been counted after `done` steps
      const times = {};
      Object.keys(reg).forEach((p) => {
        let t = 0;
        STEPS[sets].slice(0, done).forEach((s) => s.terms.forEach(([sign, key]) => { if (keyCovers(key, p, names)) t += sign; }));
        times[p] = t;
      });
      V.labels.querySelectorAll(".num, .times").forEach((n) => n.remove());
      Object.entries(g.pos).forEach(([p, [x, y]]) => {
        const r = V.region(p);
        if (p in reg) {
          svgText(V.labels, x, y, String(reg[p]), "num");
          if (done > 0) svgText(V.labels, x, y + 17, `×${times[p]}`, `times t${Math.max(-1, Math.min(2, times[p]))}`);
          r.dataset.times = done ? String(Math.max(0, Math.min(2, times[p]))) : "";
        } else r.dataset.times = "";
      });
      const steps = STEPS[sets];
      $$(".ie-term", stepsBox).forEach((t, i) => t.classList.toggle("done", i < done));
      const next = $("#ie-next");
      next.textContent = done === 0 ? `Apply “${steps[0].label}”` : done < steps.length ? `Apply “${steps[done].label}”` : "All terms applied";
      next.disabled = done >= steps.length || bad.length > 0;
      if (bad.length) {
        out.className = "out bad";
        out.textContent = "These sizes can’t all happen at once: some region would have a negative number of elements. (For example, an intersection can’t be bigger than either set, and a pair intersection can’t be smaller than the triple.)";
        return;
      }
      const running = steps.slice(0, done).flatMap((s) => s.terms).reduce((acc, [sign, key]) => acc + sign * vals[key], 0);
      const union = Object.values(reg).reduce((a, b) => a + b, 0);
      const expr = steps.slice(0, done).flatMap((s) => s.terms).map(([sign, key], i) => `${sign < 0 ? "−" : i ? "+" : ""} ${vals[key]}`).join(" ");
      out.className = `out ${done === steps.length ? "ok" : ""}`;
      if (done === 0) out.textContent = "Each number is the size of one region. Apply the formula one group of terms at a time and watch how many times each region has been counted.";
      else if (done < steps.length) {
        const wrong = Object.entries(times).filter(([p, t]) => t !== 1 && reg[p] > 0).length;
        out.textContent = `Running total: ${expr} = ${running}. Not the answer yet: ${wrong} region${wrong === 1 ? " is" : "s are"} counted the wrong number of times (see the ×).`;
      } else out.textContent = `${expr} = ${running}. Every region is now counted exactly once, so |${names.join("∪")}| = ${union}.`;
    }
    chips.forEach((c) => c.addEventListener("click", () => { sets = Number(c.dataset.sets); vals = { ...DEFAULTS[sets] }; pressGroup(chips, c); setup(); }));
    setup();
  }

  /* =========================================================== L3: pigeonhole */
  function setupPHP() {
    const nIn = $("#php-n"), kIn = $("#php-k"), holesBox = $("#php-holes"), out = $("#php-out"), left = $("#php-left");
    let counts = [];
    function sizes() { return { n: clampInt(nIn.value, 1, 40, 11), k: clampInt(kIn.value, 1, 12, 3) }; }
    function reset() { const { k } = sizes(); counts = Array(k).fill(0); render(); }
    function render() {
      const { n, k } = sizes();
      if (counts.length !== k) counts = Array(k).fill(0);
      const placed = counts.reduce((a, b) => a + b, 0);
      const max = Math.max(...counts);
      const bound = Math.ceil(n / k);
      holesBox.replaceChildren();
      counts.forEach((c, i) => {
        const hole = el("div", { class: `hole${c === max && c > 0 ? " fullest" : ""}${c >= bound && placed === n ? " meets" : ""}` });
        const add = el("button", { class: "hole-add", "aria-label": `Put a pigeon in hole ${i + 1}`, text: `Hole ${i + 1}` });
        add.disabled = placed >= n;
        add.addEventListener("click", () => { if (counts.reduce((a, b) => a + b, 0) < n) { counts[i]++; render(); } });
        const dots = el("div", { class: "dots" });
        for (let j = 0; j < c; j++) dots.append(el("span", { class: "pigeon" }));
        const rm = el("button", { class: "hole-rm", "aria-label": `Take a pigeon out of hole ${i + 1}`, text: "−" });
        rm.disabled = c === 0;
        rm.addEventListener("click", () => { if (counts[i] > 0) { counts[i]--; render(); } });
        hole.append(add, dots, el("div", { class: "hole-foot" }, el("b", { text: String(c) }), rm));
        holesBox.append(hole);
      });
      left.textContent = `${n - placed} of ${n} pigeons left to place. Click a hole to drop one in.`;
      if (k >= n) {
        out.className = "out";
        out.textContent = `With ${k} holes and only ${n} pigeons, every pigeon can have its own hole. The PHP needs more pigeons than holes.`;
      } else if (placed < n) {
        out.className = "out";
        out.textContent = `Fullest hole so far: ${max}. Once all ${n} are placed, some hole must hold at least ⌈${n}/${k}⌉ = ${bound}, whatever you do.`;
      } else {
        out.className = "out ok";
        out.textContent = max === bound
          ? `All ${n} placed. The fullest hole has ${max} = ⌈${n}/${k}⌉. You spread them as evenly as possible, and you still couldn’t get below ${bound}.`
          : `All ${n} placed. The fullest hole has ${max}, at least ⌈${n}/${k}⌉ = ${bound} as promised. Try to get it down to ${bound}.`;
      }
    }
    $("#php-spread").addEventListener("click", () => { const { n, k } = sizes(); counts = Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0)); render(); });
    $("#php-reset").addEventListener("click", reset);
    nIn.addEventListener("input", () => { const { n } = sizes(); let placed = counts.reduce((a, b) => a + b, 0); while (placed > n) { const i = counts.indexOf(Math.max(...counts)); counts[i]--; placed--; } render(); });
    kIn.addEventListener("input", reset);
    reset();
  }

  /* =========================================================== L3: mod 37 */
  function setupMod37() {
    const holes = $("#m37-holes"), out = $("#m37-out");
    function draw(count) {
      const xs = [];
      const seen = new Set();
      while (xs.length < count) {
        const x = Math.floor(Math.random() * 2000001) - 1000000;
        if (!seen.has(x)) { seen.add(x); xs.push(x); }
      }
      const by = Array.from({ length: 37 }, () => []);
      const mod = (x) => ((x % 37) + 37) % 37;
      xs.forEach((x) => by[mod(x)].push(x));
      holes.replaceChildren();
      let pair = null;
      by.forEach((list, r) => {
        const h = el("div", { class: `mh${list.length > 1 ? " hit" : ""}${list.length === 0 ? " empty" : ""}`, title: `remainder ${r}: ${list.length}` },
          el("span", { class: "mh-r", text: String(r) }), el("b", { text: String(list.length) }));
        holes.append(h);
        if (!pair && list.length > 1) pair = [list[0], list[1], r];
      });
      const full = by.filter((l) => l.length > 1).length;
      if (pair) {
        const [x, y, r] = pair;
        const d = x - y;
        out.className = "out ok";
        out.textContent = `${count} integers, 37 holes. ${full} hole${full === 1 ? " has" : "s have"} more than one. For example x = ${x.toLocaleString("en-US")} and y = ${y.toLocaleString("en-US")} both leave remainder ${r}, so x − y = ${d.toLocaleString("en-US")} = 37 · ${(d / 37).toLocaleString("en-US")}.`;
      } else {
        out.className = "out";
        out.textContent = `${count} integers landed in ${count} different holes. Possible only because ${count} ≤ 37.`;
      }
    }
    $("#m37-random").addEventListener("click", () => draw(100));
    $("#m37-38").addEventListener("click", () => draw(38));
    holes.replaceChildren(...Array.from({ length: 37 }, (_, r) => el("div", { class: "mh empty" }, el("span", { class: "mh-r", text: String(r) }), el("b", { text: "0" }))));
    out.textContent = "Press a button to draw integers between −1,000,000 and 1,000,000.";
  }

  /* =========================================================== L3: deck of cards + Sleuth's criterion */
  function setupDeck() {
    const grid = $("#deck-grid"), report = $("#deck-report");
    let hand = [];
    const RED = new Set([1, 2]);
    const cards = [];
    for (let s = 0; s < 4; s++) {
      const row = el("div", { class: "deck-row" });
      for (let r = 0; r < 13; r++) {
        const c = s * 13 + r;
        const b = el("button", { class: `card${RED.has(s) ? " red" : ""}`, "aria-pressed": "false", "aria-label": Pr.cardName(c) },
          el("span", { text: Pr.RANKS[r] }), el("small", { text: Pr.SUITS[s] }));
        b.addEventListener("click", () => toggle(c));
        cards[c] = b;
        row.append(b);
      }
      grid.append(row);
    }
    function toggle(c) {
      if (hand.includes(c)) hand = hand.filter((x) => x !== c);
      else if (hand.length < 5) hand.push(c);
      render();
    }
    const PRESETS = {
      straight: [1 * 13 + 3, 2 * 13 + 4, 0 * 13 + 5, 3 * 13 + 6, 2 * 13 + 7], // 5♦ 6♥ 7♣ 8♠ 9♥ (as on the slide)
      flush: [2 * 13 + 0, 2 * 13 + 4, 2 * 13 + 7, 2 * 13 + 9, 2 * 13 + 11], // 2♥ 6♥ 9♥ J♥ K♥
      "four-aces": [12, 25, 38, 51, 26], // A♣ A♦ A♥ A♠ 2♥
    };
    $$("#deck [data-hand]").forEach((b) => b.addEventListener("click", () => { hand = PRESETS[b.dataset.hand].slice(); render(); }));
    $("#deck-clear").addEventListener("click", () => { hand = []; render(); });
    function render() {
      cards.forEach((b, c) => b.setAttribute("aria-pressed", String(hand.includes(c))));
      cards.forEach((b, c) => { b.disabled = hand.length >= 5 && !hand.includes(c); });
      report.replaceChildren();
      const names = hand.slice().sort((a, b) => (a % 13) - (b % 13) || a - b).map(Pr.cardName);
      report.append(el("p", { class: "hand-line" }, el("b", { text: hand.length ? names.join("  ") : "No cards yet." }), el("span", { text: ` (${hand.length} of 5)` })));
      if (hand.length < 5) return;
      const st = Pr.isStraight(hand), fl = Pr.isFlush(hand), aces = Pr.aces(hand);
      const tags = el("div", { class: "hand-tags" });
      tags.append(el("span", { class: `tag-pill ${st ? "yes" : ""}`, text: st ? "straight" : "not a straight" }));
      tags.append(el("span", { class: `tag-pill ${fl ? "yes" : ""}`, text: fl ? "flush" : "not a flush" }));
      tags.append(el("span", { class: `tag-pill ${aces >= 3 ? "yes" : ""}`, text: `${aces} ace${aces === 1 ? "" : "s"}` }));
      report.append(tags);
      if (aces >= 3) {
        const aceCards = hand.filter((c) => c % 13 === 12);
        const others = hand.filter((c) => c % 13 !== 12);
        const ways = Pr.combos(aceCards.length, 3);
        const lines = [];
        for (let w = ways.next(); w; w = ways.next()) {
          const three = w.map((i) => aceCards[i]);
          const rest = [...aceCards.filter((c) => !three.includes(c)), ...others];
          lines.push(`{${three.map(Pr.cardName).join(", ")}} then {${rest.map(Pr.cardName).join(", ")}}`);
        }
        const box = el("div", { class: `sleuth ${lines.length > 1 ? "bad" : "ok"}` });
        box.append(el("p", { text: `“Choose 3 aces, then 2 more cards” builds this hand in ${lines.length} way${lines.length > 1 ? "s" : ""}:` }));
        const ul = el("ul");
        lines.forEach((t) => ul.append(el("li", { text: t })));
        box.append(ul, el("p", { text: lines.length > 1 ? "More than one sequence of choices leads to the same hand, so C(4,3)·C(49,2) overcounts it. Sleuth’s criterion fails." : "Exactly one sequence of choices leads to this hand. Hands with exactly 3 aces are counted once." }));
        report.append(box);
      }
    }
    render();
  }

  /* =========================================================== L3: rooks */
  function setupRooks() {
    const nIn = $("#rk-n"), board = $("#rk-board"), status = $("#rk-status"), strip = $("#rk-strip");
    let rooks = [];
    const sq = (i, n) => `${"abcdefgh"[i % n]}${n - Math.floor(i / n)}`;
    function render() {
      const n = clampInt(nIn.value, 2, 8, 8);
      rooks = rooks.filter((i) => i < n * n);
      board.style.setProperty("--n", n);
      board.replaceChildren();
      const attacked = new Set();
      rooks.forEach((r) => { for (let j = 0; j < n * n; j++) if (j % n === r % n || Math.floor(j / n) === Math.floor(r / n)) attacked.add(j); });
      for (let i = 0; i < n * n; i++) {
        const dark = (Math.floor(i / n) + (i % n)) % 2 === 1;
        const has = rooks.includes(i);
        const b = el("button", { class: `sq${dark ? " dark" : ""}${has ? " rook" : ""}${!has && attacked.has(i) ? " hit" : ""}`, role: "gridcell", "aria-label": `${sq(i, n)}${has ? ", rook" : ""}`, text: has ? "♜" : "" });
        b.addEventListener("click", () => {
          if (rooks.includes(i)) rooks = rooks.filter((x) => x !== i);
          else if (rooks.length < 2) rooks.push(i);
          else rooks = [rooks[1], i];
          render();
        });
        board.append(b);
      }
      strip.replaceChildren(
        slot(n, "column, rook 1"), op("×"), slot(n, "row, rook 1"), op("×"), slot(n - 1, "column, rook 2"), op("×"), slot(n - 1, "row, rook 2"),
        op("÷"), slot(2, "labelings"), op("="), slot(((n * (n - 1)) ** 2 / 2).toLocaleString("en-US"), "placements", "total"));
      status.replaceChildren();
      if (rooks.length < 2) { status.append(el("p", { text: rooks.length ? "Place the second rook. Shaded squares share a row or column with the first." : "No rooks yet." })); return; }
      const [a, b] = rooks;
      const ok = a % n !== b % n && Math.floor(a / n) !== Math.floor(b / n);
      if (!ok) { status.append(el("p", { class: "bad", text: `Invalid: ${sq(a, n)} and ${sq(b, n)} share a ${a % n === b % n ? "column" : "row"}.` })); return; }
      status.append(el("p", { class: "ok", text: `Valid. With labeled rooks, this one placement is counted twice:` }));
      const ul = el("ul");
      ul.append(el("li", { text: `rook 1 on ${sq(a, n)}, rook 2 on ${sq(b, n)}` }), el("li", { text: `rook 1 on ${sq(b, n)}, rook 2 on ${sq(a, n)}` }));
      status.append(ul, el("p", { text: "Identical rooks can’t tell these apart, so N = 2." }));
    }
    nIn.addEventListener("input", render);
    $("#rk-clear").addEventListener("click", () => { rooks = []; render(); });
    render();
  }

  /* =========================================================== dice grid helper */
  function diceGrid(container, s1, s2, { rowLabel = "D1", colLabel = "D2", onClick } = {}) {
    container.replaceChildren();
    container.style.setProperty("--cols", s2 + 1);
    const cells = new Map();
    container.append(el("span", { class: "dg-corner", text: `${rowLabel} \\ ${colLabel}` }));
    for (let b = 1; b <= s2; b++) container.append(el("span", { class: "dg-head col", text: String(b) }));
    for (let a = 1; a <= s1; a++) {
      container.append(el("span", { class: "dg-head row", text: String(a) }));
      for (let b = 1; b <= s2; b++) {
        const c = el(onClick ? "button" : "span", { class: "dg-cell", text: `${a},${b}` });
        if (onClick) c.addEventListener("click", () => onClick(a, b));
        cells.set(`${a},${b}`, c);
        container.append(c);
      }
    }
    return cells;
  }

  /* =========================================================== L4: two 4-sided dice events */
  function setupDice4() {
    const chips = $$("#dice4 [data-event]"), sets = $("#d4-sets"), out = $("#d4-out");
    const EV = { A: ([a]) => a === 1, B: ([a, b]) => a + b === 6, C: ([a, b]) => a === 2 * b };
    const NAME = { A: "D_1 = 1", B: "D_1 + D_2 = 6", C: "D_1 = 2D_2" };
    const active = new Set(["A"]);
    const cells = diceGrid($("#d4-grid"), 4, 4);
    const omega = Pr.grid(4);
    const list = (k) => omega.filter(EV[k]);
    const fmtSet = (xs) => `\\{${xs.map(([a, b]) => `(${a},${b})`).join(", ")}\\}`;
    function render() {
      chips.forEach((c) => c.setAttribute("aria-pressed", String(active.has(c.dataset.event))));
      omega.forEach(([a, b]) => {
        const cell = cells.get(`${a},${b}`);
        ["A", "B", "C"].forEach((k) => cell.classList.toggle(`in-${k.toLowerCase()}`, active.has(k) && EV[k]([a, b])));
      });
      const keys = ["A", "B", "C"].filter((k) => active.has(k));
      setMath(sets, keys.map((k) => `<span class="ev-${k.toLowerCase()}-text">\\(${k} = ${fmtSet(list(k))}\\)</span>`).join("<br>") || "Select an event.");
      const pairs = [];
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
        const [x, y] = [keys[i], keys[j]];
        const both = omega.filter((o) => EV[x](o) && EV[y](o));
        pairs.push(both.length ? `\\(${x}\\cap ${y} = ${fmtSet(both)}\\): not mutually exclusive.` : `\\(${x}\\cap ${y} = \\varnothing\\): mutually exclusive.`);
      }
      setMath(out, pairs.length ? pairs.join("<br>") : `\\(|\\Omega| = 16\\). Select two events to compare them.`);
    }
    chips.forEach((c) => c.addEventListener("click", () => { const k = c.dataset.event; if (active.has(k)) active.delete(k); else active.add(k); render(); }));
    render();
  }

  /* =========================================================== L4: build a probability space */
  function setupPSpace() {
    const box = $("#ps-weights"), check = $("#ps-check"), chips = $$("#pspace [data-preset]");
    const PRESETS = {
      fair: [["H", "1/2"], ["T", "1/2"]],
      bent: [["H", "0.85"], ["T", "0.15"]],
      die: [1, 2, 3, 4, 5, 6].map((v) => [String(v), "1/6"]),
      bag: [["red", "3/10"], ["green", "4/10"], ["yellow", "2/10"], ["blue", "1/10"]],
    };
    let rows = [];
    function load(key) {
      box.replaceChildren();
      rows = PRESETS[key].map(([name, w], i) => {
        const inp = el("input", { type: "text", value: w, "aria-label": `P(${name})`, autocomplete: "off", spellcheck: "false" });
        const inE = el("input", { type: "checkbox", "aria-label": `${name} is in E` });
        if (i === 0) inE.checked = true;
        inp.addEventListener("input", render); inE.addEventListener("change", render);
        box.append(el("div", { class: "w-row" }, el("span", { class: "w-name", text: name }), el("label", {}, "P = ", inp), el("label", { class: "w-in" }, inE, " in \u2009E")));
        return { name, inp, inE };
      });
      render();
    }
    function render() {
      const vals = rows.map((r) => G.tryEval(r.inp.value));
      rows.forEach((r, i) => r.inp.classList.toggle("bad", !vals[i].ok || vals[i].value.n < 0n));
      if (vals.some((v) => !v.ok)) { check.className = "out bad"; check.textContent = "Each weight must be a number such as 0.25 or 1/6."; return; }
      const neg = rows.filter((_, i) => vals[i].value.n < 0n).map((r) => r.name);
      const sum = vals.reduce((acc, v) => `${acc}+(${G.toCanonical(v.value)})`, "0");
      const total = exact(sum);
      const totalOk = total.n === total.d;
      const E = rows.filter((r) => r.inE.checked);
      const pE = exact(rows.reduce((acc, r, i) => (r.inE.checked ? `${acc}+(${G.toCanonical(vals[i].value)})` : acc), "0"));
      const parts = [];
      parts.push(neg.length ? `✗ Non-negativity fails: P(${neg.join("), P(")}) < 0.` : "✓ Every P(x) ≥ 0.");
      parts.push(totalOk ? "✓ The weights add up to 1." : `✗ The weights add up to ${G.format(total)}, not 1.`);
      const valid = !neg.length && totalOk;
      check.className = `out ${valid ? "ok" : "bad"}`;
      check.replaceChildren(el("span", { text: parts.join("  ") }));
      if (valid) check.append(el("span", { class: "pe", text: `  E = {${E.map((r) => r.name).join(", ")}}, so P(E) = ${G.format(pE)}${pE.d !== 1n ? ` ≈ ${ratDecimal(pE, 3)}` : ""}.` }));
      else check.append(el("span", { class: "pe", text: "  Not a probability space, so P(E) isn’t defined." }));
    }
    chips.forEach((c) => c.addEventListener("click", () => { pressGroup(chips, c); load(c.dataset.preset); }));
    load("fair");
  }

  /* =========================================================== L4: uniform event enumerator */
  function setupEnum() {
    const exp = $("#en-exp"), ev = $("#en-ev"), list = $("#en-list"), out = $("#en-out");
    const dice = (s) => Pr.grid(s).map(([a, b]) => ({ label: `(${a},${b})`, a, b }));
    const coins = (n) => Pr.coinSeqs(n).map((s) => ({ label: s, s }));
    const EXPS = {
      d4: { omega: () => dice(4), events: { "D1 = 1": (o) => o.a === 1, "D1 + D2 = 6": (o) => o.a + o.b === 6, "D1 = 2·D2": (o) => o.a === 2 * o.b, "D1 + D2 = 5": (o) => o.a + o.b === 5, "D1 > D2": (o) => o.a > o.b } },
      d6: { omega: () => dice(6), events: { "at least one 3": (o) => o.a === 3 || o.b === 3, "sum is 7": (o) => o.a + o.b === 7, "doubles": (o) => o.a === o.b, "sum is 4": (o) => o.a + o.b === 4, "no 3 at all": (o) => o.a !== 3 && o.b !== 3 } },
      coins3: { omega: () => coins(3), events: { "at least one H": (o) => o.s.includes("H"), "exactly 2 H": (o) => Pr.heads(o.s) === 2, "first flip H": (o) => o.s[0] === "H", "HH somewhere": (o) => o.s.includes("HH") } },
      coins4: { omega: () => coins(4), events: { "exactly 2 H": (o) => Pr.heads(o.s) === 2, "at least one H": (o) => o.s.includes("H"), "alternating": (o) => o.s === "HTHT" || o.s === "THTH", "more H than T": (o) => Pr.heads(o.s) > 2 } },
    };
    function loadEvents() {
      ev.replaceChildren(...Object.keys(EXPS[exp.value].events).map((k) => el("option", { value: k, text: k })));
      if (exp.value === "d4") ev.value = "D1 + D2 = 6";
      render();
    }
    function render() {
      const E = EXPS[exp.value];
      const omega = E.omega(), pred = E.events[ev.value];
      const hits = omega.filter(pred);
      list.replaceChildren(...omega.map((o) => el("span", { class: pred(o) ? "ok" : "no", text: o.label })));
      setMath(out, `\\(|E| = ${hits.length}\\) of \\(|\\Omega| = ${omega.length}\\) equally likely outcomes, so \\(P(E) = \\dfrac{${hits.length}}{${omega.length}}${fracStr(hits.length, omega.length) !== `${hits.length}/${omega.length}` ? ` = ${texFrac(hits.length, omega.length)}` : ""}\\).`);
    }
    exp.addEventListener("change", loadEvents);
    ev.addEventListener("change", render);
    loadEvents();
  }

  /* =========================================================== L4: n coin flips, exactly k heads */
  function setupFlips() {
    const nIn = $("#fl-n"), kIn = $("#fl-k"), bars = $("#fl-bars"), out = $("#fl-out");
    function render() {
      const n = clampInt(nIn.value, 2, 100, 100);
      kIn.max = String(n);
      const k = clampInt(kIn.value, 0, n, Math.floor(n / 2));
      $("#fl-n-out").textContent = String(n);
      $("#fl-k-out").textContent = String(k);
      const counts = Array.from({ length: n + 1 }, (_, j) => Pr.choose(n, j));
      const max = counts.reduce((a, b) => (b > a ? b : a), 0n);
      const W = 600, H = 160, bw = W / (n + 1);
      let html = "";
      counts.forEach((c, j) => {
        const h = Math.max(c > 0n ? 1 : 0, Number((c * 1000n) / max) / 1000 * (H - 22));
        html += `<rect class="${j === k ? "sel" : ""}" x="${(j * bw).toFixed(2)}" y="${(H - 16 - h).toFixed(2)}" width="${Math.max(0.6, bw - (n > 50 ? 0.3 : 1)).toFixed(2)}" height="${h.toFixed(2)}"/>`;
      });
      html += `<text x="0" y="${H - 2}">0 heads</text><text x="${W}" y="${H - 2}" text-anchor="end">${n} heads</text>`;
      bars.innerHTML = html;
      const total = 2n ** BigInt(n);
      const ck = counts[k];
      setMath(out, `\\(P(\\text{exactly } ${k} \\text{ heads}) = \\dfrac{\\binom{${n}}{${k}}}{2^{${n}}} = \\dfrac{${ck.toLocaleString("en-US")}}{${n <= 40 ? total.toLocaleString("en-US") : `2^{${n}}`}}\\approx ${bigDecimal(ck, total, 4)}\\)`);
    }
    nIn.addEventListener("input", () => { if (Number(kIn.value) > Number(nIn.value)) kIn.value = String(Math.floor(Number(nIn.value) / 2)); render(); });
    kIn.addEventListener("input", render);
    render();
  }

  /* =========================================================== L4: coin models */
  function setupCoins() {
    const box = $("#cm-models"), out = $("#cm-out"), chips = $$("#coins [data-cev]");
    const OM = ["HH", "HT", "TH", "TT"];
    const MODELS = [
      { name: "Fair coins", note: "uniform", p: { HH: "1/4", HT: "1/4", TH: "1/4", TT: "1/4" } },
      { name: "Glued coins", note: "always different", p: { HH: "0", HT: "0.5", TH: "0.5", TT: "0" } },
      { name: "Attached coins", note: "usually the same", p: { HH: "0.4", HT: "0.1", TH: "0.1", TT: "0.4" } },
    ];
    const EVENTS = { same: ["HH", "TT"], "atleast-h": ["HH", "HT", "TH"], hh: ["HH"] };
    const NAMES = { same: "both coins match", "atleast-h": "at least one H", hh: "HH" };
    let ev = "same";
    const cards = MODELS.map((m) => {
      const card = el("div", { class: "cm-card" }, el("h4", { text: m.name }), el("small", { text: m.note }));
      const rows = el("div", { class: "cm-rows" });
      OM.forEach((o) => {
        const v = exact(m.p[o]);
        const w = Number(v.n) / Number(v.d);
        rows.append(el("div", { class: "cm-row", "data-o": o }, el("span", { class: "o", text: o }), el("span", { class: "bar" }, el("i", { style: `width:${w * 100}%` })), el("span", { class: "v", text: m.p[o] })));
      });
      card.append(rows, el("p", { class: "cm-p" }));
      box.append(card);
      return card;
    });
    // single biased coin
    const bias = el("div", { class: "cm-card biased" }, el("h4", { text: "Biased coin" }), el("small", { text: "one coin, P(H) = p" }));
    const pIn = el("input", { type: "range", min: "0", max: "100", value: "45", "aria-label": "p in percent" });
    const pOut = el("p", { class: "cm-p" });
    bias.append(el("label", { class: "cm-slider" }, "p ", pIn), pOut);
    box.append(bias);
    const renderBias = () => { const p = Number(pIn.value); pOut.textContent = `P(H) = ${p / 100}, P(T) = ${(100 - p) / 100}. Sum: 1.`; };
    pIn.addEventListener("input", renderBias);
    function render() {
      const E = EVENTS[ev];
      const lines = [];
      MODELS.forEach((m, i) => {
        $$(".cm-row", cards[i]).forEach((r) => r.classList.toggle("in", E.includes(r.dataset.o)));
        const pr = exact(E.map((o) => `(${m.p[o]})`).join("+"));
        $(".cm-p", cards[i]).textContent = `P(${NAMES[ev]}) = ${G.format(pr)}`;
        lines.push(`${m.name}: ${G.format(pr)}`);
      });
      out.textContent = `Same sample space, same event “${NAMES[ev]}” = {${E.join(", ")}}, three different answers. P(E) adds the probabilities of the outcomes in E; counting them only works for the fair coins.`;
    }
    chips.forEach((c) => c.addEventListener("click", () => { ev = c.dataset.cev; pressGroup(chips, c); render(); }));
    renderBias();
    render();
  }

  /* =========================================================== L4: two 6-sided dice, at least one 3 */
  function setupDice6() {
    const chips = $$("#dice6 [data-d6]"), out = $("#d6-out"), sim = $("#d6-sim");
    const cells = diceGrid($("#d6-grid"), 6, 6, { rowLabel: "1st", colLabel: "2nd" });
    let mode = "both";
    function render() {
      let n = 0;
      Pr.grid(6).forEach(([a, b]) => {
        const c = cells.get(`${a},${b}`);
        const row = a === 3, col = b === 3;
        const inE = mode === "row" ? row : mode === "col" ? col : mode === "both" ? row || col : !(row || col);
        c.classList.toggle("in-e", inE);
        c.classList.toggle("double", mode === "both" && row && col);
        if (inE) n++;
      });
      const MSG = {
        row: `First die is 3: a whole row, 6 outcomes.`,
        col: `Second die is 3: a whole column, 6 outcomes.`,
        both: `Row ∪ column: 6 + 6 − 1 = 11 outcomes. The marked cell (3,3) is in both, so adding 6 + 6 counts it twice. P = 11/36 ≈ 0.306.`,
        none: `No 3 on either die: 5 · 5 = 25 outcomes, so P(at least one 3) = 1 − 25/36 = 11/36.`,
      };
      out.textContent = `${n} of 36 cells. ${MSG[mode]}`;
    }
    chips.forEach((c) => c.addEventListener("click", () => { mode = c.dataset.d6; pressGroup(chips, c); render(); }));
    $("#d6-roll").addEventListener("click", () => {
      let hits = 0;
      for (let i = 0; i < 1000; i++) { const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6); if (a === 3 || b === 3) hits++; }
      sim.textContent = `Simulated 1,000 rolls: at least one 3 came up ${hits} times (${(hits / 1000).toFixed(3)}). The exact model value is 11/36 ≈ 0.306; a simulation only gets close.`;
    });
    render();
  }

  /* =========================================================== L5: restrict the sample space */
  function setupRestrict() {
    const exp = $("#rs-exp"), given = $("#rs-given"), ask = $("#rs-ask"), grid = $("#rs-grid"), out = $("#rs-out");
    const survey = () => {
      const R = [["A only", 36, { A: 1, B: 0 }], ["both", 7, { A: 1, B: 1 }], ["B only", 13, { A: 0, B: 1 }], ["neither", 14, { A: 0, B: 0 }]];
      return R.flatMap(([, n, m]) => Array.from({ length: n }, () => ({ label: "", ...m })));
    };
    const EXPS = {
      coins2: {
        omega: () => Pr.coinSeqs(2).map((s) => ({ label: s, s })), cls: "rs-big",
        events: { "no information (all of Ω)": () => true, "at least one head": (o) => o.s.includes("H"), "at least one tail": (o) => o.s.includes("T"), "both heads": (o) => o.s === "HH", "first flip heads": (o) => o.s[0] === "H" },
        dflt: ["at least one head", "both heads"],
      },
      d6: {
        omega: () => Pr.grid(6).map(([a, b]) => ({ label: `${a},${b}`, a, b })), cls: "rs-six",
        events: { "no information (all of Ω)": () => true, "sum is 4": (o) => o.a + o.b === 4, "red (first) die is 1": (o) => o.a === 1, "sum is 8": (o) => o.a + o.b === 8, "doubles": (o) => o.a === o.b, "both dice show 4": (o) => o.a === 4 && o.b === 4, "first die at least 4": (o) => o.a >= 4 },
        dflt: ["sum is 4", "red (first) die is 1"],
      },
      survey: {
        omega: survey, cls: "rs-dots",
        events: { "no information (all of Ω)": () => true, "likes donuts": (o) => o.B === 1, "likes ice cream": (o) => o.A === 1, "likes both": (o) => o.A && o.B, "likes neither": (o) => !o.A && !o.B },
        dflt: ["likes donuts", "likes ice cream"],
      },
    };
    function load() {
      const E = EXPS[exp.value];
      const opts = () => Object.keys(E.events).map((k) => el("option", { value: k, text: k }));
      given.replaceChildren(...opts());
      ask.replaceChildren(...opts().filter((o) => !o.value.startsWith("no information")));
      [given.value, ask.value] = E.dflt;
      render();
    }
    function render() {
      const E = EXPS[exp.value];
      const omega = E.omega(), gB = E.events[given.value], aA = E.events[ask.value];
      grid.className = `restrict-grid ${E.cls}`;
      grid.replaceChildren(...omega.map((o) => {
        const inB = gB(o), inA = aA(o);
        const c = el("span", { class: `rs-cell${inB ? "" : " out"}${inB && inA ? " hit" : ""}${!inB && inA ? " a-out" : ""}${o.A ? " is-a" : ""}${o.B ? " is-b" : ""}`, text: o.label });
        return c;
      }));
      const nB = omega.filter(gB).length, nAB = omega.filter((o) => gB(o) && aA(o)).length, N = omega.length;
      if (!nB) { out.textContent = "That condition has probability 0, so the conditional probability isn’t defined."; return; }
      const noInfo = given.value.startsWith("no information");
      const html = noInfo
        ? `<p>No information: the sample space is all of \\(\\Omega\\).</p><p>\\(P(A) = \\dfrac{${nAB}}{${N}}${fracStr(nAB, N) !== `${nAB}/${N}` ? ` = ${texFrac(nAB, N)}` : ""}\\)</p>`
        : `<p>Given \\(B\\) = “${given.value}”, only the ${nB} highlighted outcome${nB === 1 ? "" : "s"} remain. ${nAB} of them are in \\(A\\) = “${ask.value}”.</p>
           <p>\\(P(A\\mid B) = \\dfrac{|A\\cap B|}{|B|} = \\dfrac{${nAB}}{${nB}}${fracStr(nAB, nB) !== `${nAB}/${nB}` ? ` = ${texFrac(nAB, nB)}` : ""}\\)</p>
           <p class="small">Same thing from the definition: \\(\\dfrac{P(A\\cap B)}{P(B)} = \\dfrac{${nAB}/${N}}{${nB}/${N}}\\). Without the information, \\(P(A) = ${texFrac(omega.filter(aA).length, N)}\\).</p>`;
      setMath(out, html);
    }
    exp.addEventListener("change", load);
    given.addEventListener("change", render);
    ask.addEventListener("change", render);
    load();
  }

  /* =========================================================== L5: the poll dice */
  function setupPollDice() {
    const chips = $$("#poll-dice [data-pd]"), out = $("#pd-out");
    const cells = diceGrid($("#pd-grid"), 6, 6, { rowLabel: "red", colLabel: "blue" });
    let mode = "omega";
    function render() {
      Pr.grid(6).forEach(([r, b]) => {
        const c = cells.get(`${r},${b}`);
        const inA = r + b === 4, inB = r === 1;
        c.classList.toggle("in-a", inA);
        c.classList.toggle("in-b", inB);
        c.classList.toggle("faded", (mode === "given-a" && !inA) || (mode === "given-b" && !inB));
      });
      const MSG = {
        omega: `\\(A\\) (sum 4) has 3 outcomes, \\(B\\) (red is 1) has 6, and they share \\((1,3)\\). \\(P(B) = \\tfrac{6}{36} = \\tfrac16\\).`,
        "given-a": `Given \\(A\\): only \\((1,3), (2,2), (3,1)\\) remain, and one has red = 1. \\(P(B\\mid A) = \\tfrac{1}{3}\\). Poll answer (b).`,
        "given-b": `Given \\(B\\): the 6 outcomes with red = 1 remain, and one has sum 4. \\(P(A\\mid B) = \\tfrac16\\), which is not \\(P(B\\mid A)\\).`,
      };
      setMath(out, MSG[mode]);
    }
    chips.forEach((c) => c.addEventListener("click", () => { mode = c.dataset.pd; pressGroup(chips, c); render(); }));
    render();
  }

  /* =========================================================== L5: gambler's fallacy simulation */
  function setupGambler() {
    const runIn = $("#gb-run"), out = $("#gb-out");
    out.textContent = "Press the button to simulate.";
    $("#gb-go").addEventListener("click", () => {
      const r = clampInt(runIn.value, 1, 12, 5);
      let streaks = 0, heads = 0, seqs = 0;
      const TARGET = 20000, CAP = 3000000;
      while (streaks < TARGET && seqs < CAP) {
        seqs++;
        let ok = true;
        for (let i = 0; i < r; i++) if (Math.random() < 0.5) { ok = false; break; } // a head breaks the streak of tails
        if (!ok) continue;
        streaks++;
        if (Math.random() < 0.5) heads++;
      }
      out.textContent = `Simulated ${seqs.toLocaleString("en-US")} sequences. ${streaks.toLocaleString("en-US")} started with ${r} tails in a row; the next flip was heads in ${heads.toLocaleString("en-US")} of them (${(heads / streaks).toFixed(3)}). The streak doesn’t make heads more likely.`;
    });
  }

  /* =========================================================== L5: Alice's pockets (LTP) */
  function setupPockets() {
    const svg = $("#pk-tree"), edit = $("#pk-edit"), out = $("#pk-out"), chips = $$("#pockets [data-pk]");
    const SLIDE = { LB: 2, LG: 2, RB: 1, RG: 2 };
    let v = { ...SLIDE }, ev = "B";
    const inputs = {};
    [["L", "Left pocket"], ["R", "Right pocket"]].forEach(([p, name]) => {
      const row = el("div", { class: "pk-row" }, el("b", { text: name }));
      [["B", "blue"], ["G", "green"]].forEach(([c, cname]) => {
        const inp = el("input", { type: "number", min: "0", max: "9", value: String(v[p + c]), "aria-label": `${name}, ${cname} balls` });
        inp.addEventListener("input", () => { v[p + c] = clampInt(inp.value, 0, 9, 0); render(); });
        inputs[p + c] = inp;
        row.append(el("label", { class: `pk-in ${c}` }, inp, ` ${cname}`));
      });
      edit.append(row);
    });
    function render() {
      const L = v.LB + v.LG, R = v.RB + v.RG;
      const pEL = L ? fracStr(v[`L${ev}`], L) : "–", pER = R ? fracStr(v[`R${ev}`], R) : "–";
      const color = ev === "B" ? "blue" : "green";
      svg.innerHTML = `
        <g class="t-edges">
          <line x1="40" y1="115" x2="160" y2="60"/><line x1="40" y1="115" x2="160" y2="170"/>
          <line x1="190" y1="60" x2="320" y2="30"/><line x1="190" y1="60" x2="320" y2="90"/>
          <line x1="190" y1="170" x2="320" y2="140"/><line x1="190" y1="170" x2="320" y2="200"/>
        </g>
        <g class="t-labels">
          <text x="85" y="76">1/2</text><text x="85" y="165">1/2</text>
          <text x="250" y="36" class="${ev === "B" ? "hl" : ""}">${L ? fracStr(v.LB, L) : "–"}</text><text x="250" y="96" class="${ev === "G" ? "hl" : ""}">${L ? fracStr(v.LG, L) : "–"}</text>
          <text x="250" y="146" class="${ev === "B" ? "hl" : ""}">${R ? fracStr(v.RB, R) : "–"}</text><text x="250" y="206" class="${ev === "G" ? "hl" : ""}">${R ? fracStr(v.RG, R) : "–"}</text>
        </g>
        <g class="t-nodes">
          <circle cx="32" cy="115" r="7"/>
          <text x="164" y="65" class="node">Left</text><text x="164" y="175" class="node">Right</text>
          <text x="326" y="35" class="leaf blue ${ev === "B" ? "hl" : ""}">L B</text><text x="326" y="95" class="leaf green ${ev === "G" ? "hl" : ""}">L G</text>
          <text x="326" y="145" class="leaf blue ${ev === "B" ? "hl" : ""}">R B</text><text x="326" y="205" class="leaf green ${ev === "G" ? "hl" : ""}">R G</text>
        </g>`;
      if (!L || !R) { out.className = "out bad"; out.textContent = "Each pocket needs at least one ball, or Alice could pick an empty pocket."; return; }
      const total = exact(`1/2*${v[`L${ev}`]}/${L} + 1/2*${v[`R${ev}`]}/${R}`);
      const left = exact(`(1/2*${v[`L${ev}`]}/${L}) / (1/2*${v[`L${ev}`]}/${L} + 1/2*${v[`R${ev}`]}/${R})`);
      const pooled = fracStr(v[`L${ev}`] + v[`R${ev}`], L + R);
      const word = ev === "B" ? "\\text{blue}" : "\\text{green}";
      const tf = (s) => { const [a, b] = s.split("/"); return b ? `\\tfrac{${a}}{${b}}` : a; };
      out.className = "out";
      setMath(out, `<p>\\(P(${word}) = P(\\text{L})P(${word}\\mid\\text{L}) + P(\\text{R})P(${word}\\mid\\text{R}) = \\tfrac12\\cdot ${tf(pEL)} + \\tfrac12\\cdot ${tf(pER)} = ${tf(G.format(total).replace(/,/g, ""))}\\)</p>
        <p class="small">Bayes: \\(P(\\text{L}\\mid ${word}) = ${left ? tf(G.format(left).replace(/,/g, "")) : "–"}\\). Pooling all ${L + R} balls would give ${pooled}${pooled === G.format(total) ? ", which only matches because both pockets hold the same number of balls" : `, which is wrong: a ball in the smaller pocket is more likely to be drawn`}.</p>`);
      void color;
    }
    chips.forEach((c) => c.addEventListener("click", () => { ev = c.dataset.pk; pressGroup(chips, c); render(); }));
    $("#pk-reset").addEventListener("click", () => { v = { ...SLIDE }; Object.entries(inputs).forEach(([k, inp]) => { inp.value = String(v[k]); }); render(); });
    render();
  }

  /* =========================================================== L5: Bayes calculator (Zika) */
  function setupBayes() {
    const prior = $("#bz-prior"), tp = $("#bz-tp"), fp = $("#bz-fp"), pop = $("#bz-pop"), legend = $("#bz-legend"), math = $("#bz-math");
    const SLIDE = { prior: 5, tp: 98, fp: 10 }; // prior and fp in tenths of a percent, tp in percent
    const CELLS = 1000; // each square stands for 100 of the 100,000 people
    for (let i = 0; i < CELLS; i++) pop.append(el("span"));
    const squares = [...pop.children];
    const pct = (tenths) => `${tenths / 10}%`;
    const fmtCount = (r) => { const s = G.format(r); return r.d === 1n ? s : `${ratDecimal(r, 1)}`; };
    function render() {
      const p = Number(prior.value), t = Number(tp.value), f = Number(fp.value);
      $("#bz-prior-out").textContent = pct(p);
      $("#bz-tp-out").textContent = `${t}%`;
      $("#bz-fp-out").textContent = pct(f);
      // expected counts per 100,000 people, as exact rationals
      const Z = exact(`100000*${p}/1000`), TP = exact(`100000*${p}/1000*${t}/100`), FN = exact(`100000*${p}/1000*(100-${t})/100`);
      const FP = exact(`100000*(1000-${p})/1000*${f}/1000`), TN = exact(`100000*(1000-${p})/1000*(1000-${f})/1000`);
      // largest-remainder rounding to 1000 squares
      const parts = [["tp", TP], ["fn", FN], ["fp", FP], ["tn", TN]].map(([k, r]) => ({ k, x: (Number(r.n) / Number(r.d)) / 100 }));
      parts.forEach((q) => { q.c = Math.floor(q.x); q.rem = q.x - q.c; });
      let left = CELLS - parts.reduce((a, q) => a + q.c, 0);
      parts.slice().sort((a, b) => b.rem - a.rem).forEach((q) => { if (left > 0) { q.c++; left--; } });
      let i = 0;
      parts.forEach((q) => { for (let j = 0; j < q.c; j++) squares[i++].className = q.k; });
      legend.replaceChildren(
        el("li", { class: "tp" }, el("b", { text: fmtCount(TP) }), " have Zika and test positive"),
        el("li", { class: "fn" }, el("b", { text: fmtCount(FN) }), " have Zika and test negative"),
        el("li", { class: "fp" }, el("b", { text: fmtCount(FP) }), " don’t have Zika and test positive"),
        el("li", { class: "tn" }, el("b", { text: fmtCount(TN) }), " don’t have Zika and test negative"),
      );
      const PT = exact(`${p}/1000*${t}/100 + (1000-${p})/1000*${f}/1000`);
      const post = PT.n === 0n ? null : exact(`(${p}/1000*${t}/100) / (${p}/1000*${t}/100 + (1000-${p})/1000*${f}/1000)`);
      const ratio = post ? Number(post.n) / Number(post.d) / (p / 1000) : 0;
      const pz = p / 1000, ptz = t / 100, ptzc = f / 1000;
      setMath(math, `<p>LTP: \\(P(T) = ${pz}\\cdot ${ptz} + ${+(1 - pz).toFixed(3)}\\cdot ${ptzc} = ${ratDecimal(PT, 5)}\\)</p>
        <p>Bayes: \\(P(Z\\mid T) = \\dfrac{${pz}\\cdot ${ptz}}{${ratDecimal(PT, 5)}} ${post ? `= ${G.format(post).includes("/") ? `\\tfrac{${G.format(post).replace(/,/g, "").split("/")[0]}}{${G.format(post).replace(/,/g, "").split("/")[1]}}` : G.format(post)} \\approx ${ratDecimal(post, 3)}` : ""}\\)</p>
        <p class="bayes-big">${post ? `${(Number(post.n) / Number(post.d) * 100).toFixed(1)}%` : "–"}<span>of people who test positive have Zika (prior ${pct(p)}${post ? `, ×${ratio.toFixed(1)}` : ""})</span></p>`);
    }
    [prior, tp, fp].forEach((x) => x.addEventListener("input", render));
    $("#bz-reset").addEventListener("click", () => { prior.value = SLIDE.prior; tp.value = SLIDE.tp; fp.value = SLIDE.fp; render(); });
    render();
  }

  /* =========================================================== brute-force buttons in solutions */
  function setupBrute() {
    $$("[data-brute]").forEach((btn) => {
      const out = btn.nextElementSibling;
      const def = Pr.BRUTE[btn.dataset.brute];
      btn.addEventListener("click", () => {
        const checker = def.make();
        const expected = G.evalToString(def.expected);
        btn.disabled = true;
        out.className = "brute";
        const t0 = performance.now();
        const chunk = () => {
          const r = checker.step(250000);
          if (!r.done) {
            out.textContent = `Checking… ${fmtBig(r.checked)} of ${fmtBig(checker.total)} ${def.of} so far (${fmtBig(r.found)} found so far, not final).`;
            setTimeout(chunk, 0);
            return;
          }
          const ms = Math.round(performance.now() - t0);
          const match = String(r.found) === expected;
          out.className = `brute ${match ? "ok" : ""}`;
          out.textContent = `Found ${fmtBig(r.found)} after checking all ${fmtBig(checker.total)} ${def.of} in ${ms} ms. ${match ? "Matches the formula." : `The formula gives ${evalFmt(def.expected)}.`}`;
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
    $$("#l3-quiz, #l4-quiz, #l5-quiz").forEach((p) => p._restore && p._restore());
  }

  async function boot() {
    buildPagers();
    setupTasks();
    setupSteps();
    setupChecks();
    setupQuizzes();
    setupMenu();
    renderMath(document.body); // static math first, so widgets that re-render their own math don't double-process
    const widgets = [setupHero, setupExpand, setupPlugin, setupPascalSplit, setupTriangle, setupIE, setupPHP, setupMod37, setupDeck, setupRooks,
      setupDice4, setupPSpace, setupEnum, setupFlips, setupCoins, setupDice6, setupRestrict, setupPollDice, setupGambler, setupPockets, setupBayes, setupBrute];
    for (const w of widgets) {
      try { w(); } catch (e) { console.error(`${w.name} failed`, e); }
    }
    window.addEventListener("hashchange", () => show(location.hash.slice(1)));
    show(location.hash.slice(1) || "home");
    store.onReload(restoreAll);
    // best effort: push anything pending when the tab is hidden or closed (the local mirror already has it)
    window.addEventListener("pagehide", () => { store.flushNow(); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") store.flushNow(); });
    await store.load();
    document.documentElement.dataset.ready = "1";
  }
  boot();
})();
