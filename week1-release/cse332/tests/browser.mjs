// Browser tests (Playwright + headless Chromium). Run: node browser.mjs
// Covers: every route renders (no console errors, no raw TeX, no overflow at 1280x800 and 390x844), right/wrong answers,
// misconception feedback, hints, solution confirmation, visualizers at their limits, persistence across reload,
// attempt history, stale-grade invalidation (table-driven from export/state-inventory.json), draft races,
// save failure + recovery (transient notices, exactly-once delivery), conflict merge, no persistent save header.
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync } from "node:fs";
import { serve, CHROME } from "./lib/serve.mjs";
const here = new URL(".", import.meta.url).pathname;
const SHOTS = `${here}../screenshots`;
mkdirSync(SHOTS, { recursive: true });
const MOCK_SRC = readFileSync(`${here}../examples/mock-adapter.js`, "utf8");
const INV = JSON.parse(readFileSync(`${here}../export/state-inventory.json`, "utf8"));

const { srv, url } = await serve(`${here}../site/`);
const browser = await chromium.launch({ executablePath: CHROME });
let pass = 0, fail = 0;
const results = {};
let group = "setup";
const t = (cond, msg) => { results[group] = results[group] || { pass: 0, fail: 0 }; if (cond) { pass++; results[group].pass++; } else { fail++; results[group].fail++; console.log(`FAIL [${group}] ${msg}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open({ viewport = { width: 1280, height: 800 }, mock = null, hash = "home" } = {}) {
  const ctx = await browser.newContext({ viewport });
  if (mock) await ctx.addInitScript(`${MOCK_SRC}\n;window.__mock = MockAdapter.create(${JSON.stringify(mock)}); window.COURSE_SITE_STORAGE = window.__mock.adapter;`);
  const page = await ctx.newPage();
  page.errors = [];
  page.on("console", (m) => { if (m.type() === "error") page.errors.push(m.text()); });
  page.on("pageerror", (e) => page.errors.push(`pageerror: ${e.message}`));
  page.on("dialog", (d) => d.accept());
  await page.goto(`${url}/#${hash}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
  return page;
}
async function go(page, hash) { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(120); }
async function reload(page, hash) {
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
  if (hash) await go(page, hash);
}
const rec = (page, id) => page.evaluate((i) => window.CourseSite.exportState().items[i] || null, id);
const sel = {
  quizInput: (id) => `.cyu[data-id="${id}"] .row input[type=text]`,
  quizCheck: (id) => `.cyu[data-id="${id}"] .row button.btn.primary`,
  quizShow: (id) => `.cyu[data-id="${id}"] .row button.btn:not(.primary)`,
  quizRadio: (id, k) => `.cyu[data-id="${id}"] .opts label:nth-of-type(${k + 1}) input`,
  quizFb: (id) => `.cyu[data-id="${id}"] .feedback`,
  qcInput: (id) => `.check[data-id="${id}"] input[type=text]`,
  qcRadio: (id, k) => `.check[data-id="${id}"] .opts label:nth-of-type(${k + 1}) input`,
  qcCheck: (id) => `.check[data-id="${id}"] button.primary`,
  qcFb: (id) => `.check[data-id="${id}"] .feedback`,
  part: (pid) => `.answer-spec[data-id="${pid}"] input`,
  partFb: (pid) => `.answer-spec[data-id="${pid}"] .part-fb`,
  task: (id) => `article.task[data-id="${id}"]`,
  taskCheck: (id) => `article.task[data-id="${id}"] .my-work .row button.primary`,
  taskFb: (id) => `article.task[data-id="${id}"] .my-work > .feedback`,
  pill: (id) => `article.task[data-id="${id}"] h2 .pill`,
  work: (id) => `article.task[data-id="${id}"] textarea`,
  btn: (id, text) => `article.task[data-id="${id}"] .task-actions button:has-text("${text}")`,
};
const pageOfItem = (id) => INV.items.find((i) => i.id === id).route.slice(1);

/* right answer for a part, read from the page source (tests may see keys; the inventory never has them) */
async function rightAnswer(page, pid) {
  return page.evaluate((p) => {
    const s = document.querySelector(`.answer-spec[data-id="${p}"]`);
    const g = s.dataset.grader;
    if (g === "java") return JSON.parse(s.dataset.accept)[0];
    if (g === "self") return "my written answer";
    if (g === "bound") { const b = JSON.parse(s.dataset.bound || document.querySelector(`.answer-spec[data-id="${p.split(".")[0]}.c"]`).dataset.bound); return b.rel === "O" ? "1000" : (s.dataset.role === "c" ? "1" : "8"); }
    return s.dataset.answer;
  }, pid);
}
async function fillProblemRight(page, id) {
  const parts = INV.items.filter((i) => i.parentId === id);
  for (const p of parts) await page.fill(sel.part(p.id), await rightAnswer(page, p.id));
  return parts;
}

/* =========================================================== 1. every route: errors, TeX, overflow (desktop + mobile) */
for (const vp of [{ width: 1280, height: 800, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
  group = `routes-${vp.name}`;
  const page = await open({ viewport: vp });
  const routes = await page.$$eval(".page", (ps) => ps.map((p) => p.id));
  t(routes.length === 17, `17 routes (${routes.length})`);
  for (const r of routes) {
    await go(page, r);
    const info = await page.evaluate(() => {
      const active = document.querySelector(".page.is-active");
      const walker = document.createTreeWalker(active, NodeFilter.SHOW_TEXT);
      const raw = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.parentElement.closest(".katex, textarea, script, pre, code, .code-lines, [hidden]")) continue;
        if (/\\\(|\\\)|\\\[|\\\]|\\frac|\\le\b|\\cdot|\\in\b|\\Omega|\\Theta/.test(n.textContent)) raw.push(n.textContent.trim().slice(0, 60));
      }
      return {
        raw, katexErr: active.querySelectorAll(".katex-error").length, katex: active.querySelectorAll(".katex").length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        wide: [...active.querySelectorAll("*")].filter((e) => { const b = e.getBoundingClientRect(); return b.right > window.innerWidth + 1 && !e.closest(".table-wrap, pre, .code-wrap, .tree-wrap, .katex-mathml, .katex-display") && getComputedStyle(e).position !== "fixed"; }).map((e) => e.tagName + "." + e.className).slice(0, 3),
        active: active.id,
      };
    });
    t(info.active === r, `${r} becomes active`);
    t(info.raw.length === 0, `${r}: no raw TeX (${info.raw.join(" | ")})`);
    t(info.katexErr === 0, `${r}: no KaTeX errors`);
    t(info.overflow <= 0, `${r}: no horizontal overflow (${info.overflow}px)`);
    t(info.wide.length === 0, `${r}: no element sticks out (${info.wide.join(", ")})`);
  }
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await go(page, "home");
  await page.screenshot({ path: `${SHOTS}/${vp.name}-overview.png`, fullPage: vp.name === "desktop" });
  await go(page, "queues");
  await page.click("#cq-deq"); await page.click("#cq-deq"); await page.click("#cq-enq"); await page.click("#cq-ring");
  await page.screenshot({ path: `${SHOTS}/${vp.name}-lecture-queues.png`, fullPage: false });
  await go(page, "counting");
  await page.fill("#mf-n", "3"); await page.click("#mf-run");
  await page.locator("#mf").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/${vp.name}-lecture-stepper.png`, fullPage: false });
  await go(page, "asymptotic");
  await page.locator("#gr").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/${vp.name}-growth-chart.png`, fullPage: false });
  await page.context().close();
}

/* =========================================================== 2. right / wrong answers, misconceptions, hints, solutions */
group = "answers";
{
  const page = await open({ hash: "queues" });
  // misconception feedback never contains the answer
  const QC = "cse332-w1-l1-queues-back-after-two";
  await page.fill(sel.qcInput(QC), "7"); await page.click(sel.qcCheck(QC));
  let fb = await page.textContent(sel.qcFb(QC));
  t(/first open slot/.test(fb) && !/\b6\b/.test(fb), `misconception named, answer hidden: "${fb}"`);
  await page.fill(sel.qcInput(QC), "3"); await page.click(sel.qcCheck(QC));
  fb = await page.textContent(sel.qcFb(QC));
  t(/Not quite/.test(fb) && !/\b6\b/.test(fb), `generic wrong feedback: "${fb}"`);
  await page.fill(sel.qcInput(QC), "abc"); await page.click(sel.qcCheck(QC));
  t(/Couldn't read/.test(await page.textContent(sel.qcFb(QC))), "unreadable input explained, not graded");
  t((await rec(page, QC)).attempts.length === 2, "unreadable input is not an attempt");
  await page.fill(sel.qcInput(QC), "6"); await page.click(sel.qcCheck(QC));
  t(/Correct/.test(await page.textContent(sel.qcFb(QC))), "right answer accepted");
  // MC quick check with explanation
  await go(page, "adt");
  const MC = "cse332-w1-l1-adt-circular-is";
  await page.check(sel.qcRadio(MC, 0)); await page.click(sel.qcCheck(MC));
  t(await page.isVisible(`.check[data-id="${MC}"] label:nth-of-type(1) .why`), "wrong MC shows why that option is wrong");
  t(!(await page.isVisible(`.check[data-id="${MC}"] label[data-correct] .why`)), "wrong MC doesn't reveal the right option");
  // exact big numbers in a problem part
  await go(page, "l2-problems");
  const BA = "cse332-w1-l2-beannoying";
  await page.fill(sel.part(`${BA}.prints`), "n^2"); await page.fill(sel.part(`${BA}.bucket`), "O(n^2)");
  await page.fill(sel.part(`${BA}.prints-million`), "1000000000001");
  await page.click(sel.taskCheck(BA));
  let r = await rec(page, BA);
  t(r.parts["prints-million"].correct === false && r.result === "wrong", "10^12 + 1 rejected exactly in the browser");
  t(r.parts["prints-million"].normalized === "1000000000001", "normalized value stored");
  await page.fill(sel.part(`${BA}.prints-million`), "2,000,000"); await page.click(sel.taskCheck(BA));
  t(/added the two loops/.test(await page.textContent(sel.partFb(`${BA}.prints-million`))), "big-number misconception named");
  await page.fill(sel.part(`${BA}.prints-million`), "10^12"); await page.click(sel.taskCheck(BA));
  r = await rec(page, BA);
  t(r.result === "right" && (await page.textContent(sel.pill(BA))) === "Correct", "10^12 accepted; pill Correct");
  t(r.attempts.length === 3 && r.attempts.map((a) => a.seq).join() === "1,2,3", "3 attempts with seq 1,2,3");
  // formula misconception
  const MF = "cse332-w1-l2-myfunction";
  await page.fill(sel.part(`${MF}.count`), "2n+5"); await page.fill(sel.part(`${MF}.bucket`), "O(n^2)"); await page.click(sel.taskCheck(MF));
  t(/cheap branch/.test(await page.textContent(sel.partFb(`${MF}.count`))), "formula misconception (if-branch)");
  t(/not the tightest|grows too slowly|tightest/.test(await page.textContent(sel.partFb(`${MF}.bucket`))), "Big-O not tight named");
  await page.fill(sel.part(`${MF}.count`), "3+2n+1+2n"); await page.fill(sel.part(`${MF}.bucket`), "O(4n+4)"); await page.click(sel.taskCheck(MF));
  r = await rec(page, MF);
  t(r.result === "right" && /simplified/.test(await page.textContent(sel.partFb(`${MF}.bucket`))), "equivalent formula accepted; unsimplified bucket accepted with a nudge");
  // c/n0 pair
  const BP = "cse332-w1-l2-bigo-prove-a-linear";
  await page.fill(sel.part(`${BP}.c`), "11"); await page.fill(sel.part(`${BP}.n0`), "899"); await page.click(sel.taskCheck(BP));
  r = await rec(page, BP);
  t(r.parts.c.correct === true && r.parts.n0.correct === false && /Fails at n = 899/.test(await page.textContent(sel.partFb(`${BP}.n0`))), "c ok, n0 too small, counterexample shown");
  await page.fill(sel.part(`${BP}.c`), "10"); await page.fill(sel.part(`${BP}.n0`), "1000000"); await page.click(sel.taskCheck(BP));
  r = await rec(page, BP);
  t(r.parts.c.correct === false && r.parts.n0.correct === null && /keeps failing/.test(await page.textContent(sel.partFb(`${BP}.c`))), "c impossible: c wrong, n0 not judged");
  await page.fill(sel.part(`${BP}.c`), "11"); await page.fill(sel.part(`${BP}.n0`), "900"); await page.click(sel.taskCheck(BP));
  t((await rec(page, BP)).result === "right", "c=11, n0=900 accepted");
  // Java types with renamed parameters
  await go(page, "section");
  const TS = "cse332-w1-s1-typesubtypepair";
  await page.fill(sel.part(`${TS}.header`), "<T, U extends T>"); await page.fill(sel.part(`${TS}.first`), "T"); await page.fill(sel.part(`${TS}.second`), "U");
  await page.click(sel.taskCheck(TS));
  t((await rec(page, TS)).result === "right", "renamed type parameters accepted");
  await page.fill(sel.part(`${TS}.header`), "A, B"); await page.fill(sel.part(`${TS}.first`), "A"); await page.fill(sel.part(`${TS}.second`), "B");
  await page.click(sel.taskCheck(TS));
  t(/subtype/.test(await page.textContent(sel.partFb(`${TS}.header`))), "missing bound misconception");
  // hint ladder + solution confirmation + steps
  const UP = "cse332-w1-s1-unlikepair";
  t(await page.isHidden(`${sel.task(UP)} .solution`), "solution hidden at first");
  await page.click(sel.btn(UP, "Show solution"));
  t(/haven't answered/.test(await page.textContent(sel.taskFb(UP))) && await page.isHidden(`${sel.task(UP)} .solution`), "solution asks for confirmation when unattempted");
  await page.click(sel.btn(UP, "Show solution anyway"));
  t(await page.isVisible(`${sel.task(UP)} .solution`), "solution shown after confirmation");
  await page.click(`${sel.task(UP)} .solution .step-bar button:has-text("Show first step")`);
  t((await page.$$eval(`${sel.task(UP)} .solution li:not([hidden])`, (x) => x.length)) === 1, "steps revealed one at a time");
  await page.click(`${sel.task(UP)} .solution .step-bar button:has-text("Show all")`);
  t(await page.isVisible(`${sel.task(UP)} .solution li.answer`), "highlighted final answer");
  r = await rec(page, UP);
  t(r.solutionViewed && r.events.some((e) => e.type === "solution") && r.attempts.length === 0, "solution view is an event, not an attempt");
  const S10 = "cse332-w1-s1-comparablepair";
  for (let k = 1; k <= 3; k++) await page.click(`${sel.task(S10)} .task-actions button:has-text("hint")`);
  r = await rec(page, S10);
  t(r.hintsRevealed === 3 && r.events.filter((e) => e.type === "hint").map((e) => e.data.level).join() === "1,2,3", "hint ladder logs 3 hint events");
  t(await page.isDisabled(`${sel.task(S10)} .task-actions button:has-text("hints shown")`), "hint button disabled after the last rung");
  await page.fill(sel.part(`${S10}.worksheet-line`), "no");
  await fillProblemRight(page, S10);
  await page.click(sel.taskCheck(S10));
  r = await rec(page, S10);
  t(r.attempts[0].hintsRevealedAtSubmit === 3 && r.attempts[0].solutionViewedBeforeSubmit === false, "attempt records hints at submit");
  await go(page, "l2-problems");
  await page.locator(sel.task(BA)).scrollIntoViewIfNeeded();
  await page.fill(sel.part(`${BA}.prints-million`), "2000000"); await page.click(sel.taskCheck(BA));
  await page.locator(sel.task(BA)).screenshot({ path: `${SHOTS}/desktop-problem-feedback.png` });
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}

/* =========================================================== 3. visualizers at their limits; no false conclusions */
group = "visualizers";
{
  const page = await open({ hash: "queues" });
  for (let i = 0; i < 5; i++) await page.click("#cq-enq");
  t(/full/.test(await page.textContent("#cq-state")), "circular queue reaches full");
  await page.click("#cq-enq");
  t(/resize\(\)|Exercise 0/.test(await page.textContent("#cq-log")), "enqueue on full refuses and explains (no resize solution)");
  for (let i = 0; i < 10; i++) await page.click("#cq-deq");
  await page.click("#cq-deq");
  t(/size is 0/.test(await page.textContent("#cq-log")), "dequeue on empty refuses");
  for (let i = 0; i < 5; i++) await page.click("#lq-deq");
  t(/empty/.test(await page.textContent("#lq-nodes")), "linked queue empties; back = null");
  await page.click("#lq-enq");
  t(/back is null/.test(await page.textContent("#lq-log")), "slide code's empty-enqueue crash explained");
  for (let i = 0; i < 6; i++) await page.click("#hero-enq").catch(() => {});
  await go(page, "home");
  for (let i = 0; i < 6; i++) await page.click("#hero-enq");
  t(/full/.test(await page.textContent("#hero-msg")), "hero stops at full");
  await go(page, "stacks");
  t(/3, 4/.test(await page.textContent("#sq-stack-out")) && /5, 8/.test(await page.textContent("#sq-queue-out")), "stack vs queue on the quick-check script");
  await page.fill("#sq-script", "- +1"); await page.click("#sq-run");
  t(/empty/.test(await page.textContent("#sq-stack-out")), "pop on empty reported");
  // stepper: complete runs show totals; truncated runs never do
  await go(page, "counting");
  for (const [n, total] of [[3, 16], [4, 13], [0, 5], [11, 48]]) {
    await page.fill("#mf-n", String(n)); await page.click("#mf-run");
    const res = await page.textContent("#mf-result");
    t(res.includes(`complete run, total ${total}`) && (await page.textContent("#mf-count")) === String(total), `stepper n=${n} total ${total}`);
  }
  await page.fill("#mf-n", "1000"); await page.click("#mf-run");
  t(/complete run, total 2,005/.test(await page.textContent("#mf-result")), "n=1000 (even) finishes under the cap: exact total 2,005");
  await page.fill("#mf-n", "999"); await page.click("#mf-run"); // odd: both loops run, ~6,000 steps > cap
  const trunc = await page.textContent("#mf-result");
  const partialCount = await page.textContent("#mf-count");
  t(/Stopped after 4,000 steps/.test(trunc) && /isn.t the total/.test(trunc) && !/complete run, total/.test(trunc) && !/4n \+ 4 gives/.test(trunc) && /partial/.test(partialCount), "truncated stepper: says so, count labelled partial, no total or formula conclusion");
  await page.fill("#mf-n", "5"); for (let i = 0; i < 3; i++) await page.click("#mf-step");
  t((await page.textContent("#mf-count")) === "3" && (await page.$$eval("#mf-code li.on", (x) => x.length)) === 1, "single-stepping highlights one line, counts 3");
  await page.fill("#ba-n", "3000"); await page.click("#ba-run");
  t(/9,000,000 times/.test(await page.textContent("#ba-out")), "beAnnoying n=3000 exact");
  await go(page, "amortized");
  for (let i = 0; i < 13; i++) await page.click("#al-add10");
  t(/stops at 120 adds/.test(await page.textContent("#al-out")), "ArrayList widget cap stated");
  await page.fill("#al-c", "4"); await page.click("#al-reset");
  for (let i = 0; i < 28; i++) await page.click("#al-add");
  t(/= 56\. Total ÷ adds for this sequence = 2\b/.test(await page.textContent("#al-out")), "28 adds from c=4: 56, ratio exactly 2 for this sequence");
  await go(page, "search");
  await page.fill("#bs-k", "13"); await page.click("#bs-run");
  t(/Found 13 in 2 iterations/.test(await page.textContent("#bs-out")), "binary search finds 13 in 2");
  await page.fill("#bs-k", "100"); await page.click("#bs-run");
  t(/returns false after 3 iterations/.test(await page.textContent("#bs-out")), "missing target terminates");
  t((await page.$$eval("#bsw-table tr", (r) => r.map((x) => [...x.cells].map((c) => c.textContent)))).slice(1).every((c) => c[1] === c[2]), "exhaustive worst case = floor(log2 n)+1 in every row");
  await go(page, "asymptotic");
  await page.fill("#gr-n", "1084");
  t(/C = 11,750\.56/.test(await page.textContent("#gr-exact")), "exact values with hundredths");
  await page.fill("#gr-n", "12345678901");
  t(/whole number/.test(await page.textContent("#gr-exact")), "out-of-range n rejected");
  for (const r of ["2000", "20000", "50"]) { await page.click(`#gr [data-range="${r}"]`); t((await page.$$eval("#gr-svg path.series", (p) => p.length)) === 3, `chart redraws for range ${r}`); }
  await page.hover("#gr-svg", { position: { x: 300, y: 150 } });
  t(/n = /.test(await page.textContent("#gr-box .tip")), "hover tooltip with exact values");
  t(/evidence, not proof/.test(await page.textContent("#gr")), "finite plot not presented as proof");
  await page.selectOption("#cn-claim", "a-linear");
  await page.fill("#cn-c", "11"); await page.fill("#cn-n0", "899"); await page.click("#cn-check");
  t(/Fails at n = 899/.test(await page.textContent("#cn-out")), "checker: n0 = 899 fails with counterexample");
  await page.fill("#cn-n0", "900"); await page.click("#cn-check");
  t(/Holds/.test(await page.textContent("#cn-out")), "checker: n0 = 900 holds");
  await page.selectOption("#cn-claim", "c-not-linear");
  await page.fill("#cn-c", "1000000"); await page.fill("#cn-n0", "1"); await page.click("#cn-check");
  t(/keeps failing/.test(await page.textContent("#cn-out")) && !/Holds/.test(await page.textContent("#cn-out")), "n²/100 vs O(n): no c works, says so");
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}

/* =========================================================== 4. persistence, attempts, counters */
group = "persistence";
{
  const page = await open({ hash: "l2-problems" });
  const P = "cse332-w1-l2-compare-abc";
  await page.fill(sel.part(`${P}.a-below-b`), "11");
  await page.fill(sel.work(P), "solve 10n+900 < 100n-50");
  // rapid double-click: two distinct attempts
  await fillProblemRight(page, P);
  await page.dblclick(sel.taskCheck(P));
  let r = await rec(page, P);
  t(r.attempts.length === 2 && r.attempts[0].attemptId !== r.attempts[1].attemptId && r.attempts[0].seq === 1 && r.attempts[1].seq === 2, "double-click Check = 2 distinct attempts (ids, seq)");
  await page.click(`${sel.task(P)} .task-actions button:has-text("hint")`);
  await reload(page, "l2-problems");
  r = await rec(page, P);
  t(r.attempts.length === 2 && r.events.some((e) => e.type === "hint"), "attempts and events survive reload");
  t((await page.inputValue(sel.work(P))) === "solve 10n+900 < 100n-50", "work text restored");
  t((await page.inputValue(sel.part(`${P}.c-above-a`))) === "1084" && (await page.textContent(sel.pill(P))) === "Correct", "answers and status restored");
  t(/1 of 11 submitted · 1 currently correct/.test(await page.textContent("#l2-problems .progress-text")), "progress counts submitted");
  // quiz Answered counter counts wrong submissions; persists
  await go(page, "cyu-l1");
  const Q = "cse332-w1-l1-cyu-back-wraps";
  await page.fill(sel.quizInput(Q), "12"); await page.click(sel.quizCheck(Q));
  t(/no-wrap|past the end/.test(await page.textContent(sel.quizFb(Q))), "quiz misconception feedback");
  t(/Answered 1 of 10 · 0 correct/.test(await page.textContent('[data-quiz-score="l1"]')), "wrong submission counts as answered");
  await reload(page, "cyu-l1");
  t(/Answered 1 of 10 · 0 correct/.test(await page.textContent('[data-quiz-score="l1"]')), "answered count persists across reload");
  t((await page.inputValue(sel.quizInput(Q))) === "12" && /past the end/.test(await page.textContent(sel.quizFb(Q))), "quiz answer + feedback restored");
  // reveal without submit: not answered, revealed shown
  const R = "cse332-w1-l1-cyu-peek-after-pop";
  await page.click(sel.quizShow(R));
  t(/Answered 1 of 10/.test(await page.textContent('[data-quiz-score="l1"]')), "revealed-without-submit isn't counted as answered");
  // MC draft without check -> reload -> restored ungraded
  const M = "cse332-w1-l1-cyu-isempty-size";
  await page.check(sel.quizRadio(M, 1));
  await reload(page, "cyu-l1");
  t(await page.isChecked(sel.quizRadio(M, 1)), "MC selection restored after reload without Check");
  t((await page.$$eval(`.cyu[data-id="${M}"] label.right, .cyu[data-id="${M}"] label.wrong`, (x) => x.length)) === 0 && (await rec(page, M)).correct === null, "MC draft is ungraded");
  // full quiz -> summary + start over keeps history
  const items = INV.items.filter((i) => i.kind === "quiz" && i.quiz === "l1");
  for (const it of items) {
    const right = await page.evaluate((id) => { const li = document.querySelector(`.cyu[data-id="${id}"]`); return li.dataset.kind === "mc" ? [...li.querySelectorAll(".opts label")].findIndex((l) => l.hasAttribute("data-correct")) : li.dataset.answer; }, it.id);
    if (typeof right === "number") await page.check(sel.quizRadio(it.id, right)); else await page.fill(sel.quizInput(it.id), right);
    await page.click(sel.quizCheck(it.id));
  }
  const score = await page.textContent('[data-quiz-score="l1"]');
  t(/Answered 10 of 10 · 8 correct on the first try/.test(score), `quiz score: ${score}`);
  t(/Worth another look/.test(await page.textContent('[data-quiz-summary="l1"]')), "review links shown");
  await page.locator(".cyu-list").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/desktop-quiz.png` });
  const before = (await rec(page, Q)).attempts.length;
  await page.click('[data-quiz-summary="l1"] button[data-start-over]');
  t(/Answered 0 of 10/.test(await page.textContent('[data-quiz-score="l1"]')) && (await rec(page, Q)).attempts.length === before, "Start over resets counts, keeps attempts");
  await reload(page, "cyu-l1");
  t(/Answered 0 of 10/.test(await page.textContent('[data-quiz-score="l1"]')), "Start over persists");
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}

/* =========================================================== 5. stale grading: one table-driven test over every input type */
group = "invalidation";
{
  // every (kind, grader) combination present in the inventory must have a case
  const combos = [...new Set(INV.items.filter((i) => i.kind !== "problem").map((i) => `${i.kind}:${i.grader}`))].sort();
  const covered = [];
  const page = await open({ hash: "home" });
  for (const combo of combos) {
    const [kind, grader] = combo.split(":");
    const item = INV.items.find((i) => i.kind === kind && i.grader === grader);
    const id = item.id;
    await go(page, pageOfItem(kind === "part" ? item.parentId : id));
    const tag = `${combo} (${id})`;
    let attemptsBefore, storeId = kind === "part" ? item.parentId : id;
    if (kind === "part" && grader === "self") {
      await page.fill(sel.part(id), "my answer");
      await page.click(sel.btn(item.parentId, "Show solution"));
      await page.click(sel.btn(item.parentId, "Show solution").replace("Show solution", "Show solution anyway")).catch(() => {});
      await page.click(`${sel.task(item.parentId)} .self-mark button:has-text("I got it")`);
      let r = await rec(page, storeId);
      t(r.selfMark === "got" && (await page.textContent(sel.pill(item.parentId))) === "Correct", `${tag}: self-marked`);
      attemptsBefore = r.attempts.length;
      await page.fill(sel.part(id), "my answer, edited");
      r = await rec(page, storeId);
      t(r.selfMark === null && r.parts[item.partKey].raw === "my answer, edited", `${tag}: edit clears selfMark, keeps draft`);
      t((await page.textContent(sel.pill(item.parentId))) !== "Correct", `${tag}: pill no longer Correct`);
    } else if (kind === "part") {
      await fillProblemRight(page, item.parentId);
      await page.click(sel.taskCheck(item.parentId));
      let r = await rec(page, storeId);
      t(r.result === "right" && r.parts[item.partKey].correct === true && r.parts[item.partKey].normalized !== null, `${tag}: checked right`);
      attemptsBefore = r.attempts.length;
      const orig = await page.inputValue(sel.part(id));
      await page.fill(sel.part(id), orig + "9");
      r = await rec(page, storeId);
      const p = r.parts[item.partKey];
      t(r.result === null && p.correct === null && p.normalized === null && p.feedbackKind === null && p.raw === orig + "9", `${tag}: store grade cleared, raw kept`);
      t(Object.values(r.parts).every((x) => x.correct === null), `${tag}: whole-problem grade cleared`);
      t((await page.textContent(sel.taskFb(item.parentId))) === "" && !(await page.getAttribute(sel.part(id), "class") || "").includes("ok"), `${tag}: DOM feedback cleared`);
      t((await page.textContent(sel.pill(item.parentId))) !== "Correct", `${tag}: pill not Correct`);
      await page.fill(sel.part(id), orig);
      t((await rec(page, storeId)).result === null, `${tag}: re-entering the old value doesn't resurrect the grade`);
    } else {
      const isMc = grader === "mc";
      const inp = kind === "quiz" ? sel.quizInput(id) : sel.qcInput(id);
      const btn = kind === "quiz" ? sel.quizCheck(id) : sel.qcCheck(id);
      const fbSel = kind === "quiz" ? sel.quizFb(id) : sel.qcFb(id);
      const root = kind === "quiz" ? `.cyu[data-id="${id}"]` : `.check[data-id="${id}"]`;
      let right = await page.evaluate((r) => { const el = document.querySelector(r); return el.dataset.grader === "mc" ? [...el.querySelectorAll(".opts label")].findIndex((l) => l.hasAttribute("data-correct")) : el.dataset.answer; }, root);
      if (isMc) await page.check(`${root} .opts label:nth-of-type(${right + 1}) input`); else await page.fill(inp, right);
      await page.click(btn);
      let r = await rec(page, storeId);
      t(r.correct === true && r.normalized !== null, `${tag}: checked right`);
      attemptsBefore = r.attempts.length;
      if (isMc) await page.check(`${root} .opts label:nth-of-type(${right === 0 ? 2 : 1}) input`); else await page.fill(inp, right + "9");
      r = await rec(page, storeId);
      t(r.correct === null && r.normalized === null && r.feedbackKind === null && (isMc ? r.choice === (right === 0 ? 1 : 0) : r.raw === right + "9"), `${tag}: store grade cleared, draft kept`);
      t((await page.textContent(fbSel)) === "" && (await page.$$eval(`${root} label.right, ${root} label.wrong, ${root}.is-right`, (x) => x.length)) === 0, `${tag}: DOM feedback cleared`);
      if (isMc) await page.check(`${root} .opts label:nth-of-type(${right + 1}) input`); else await page.fill(inp, right);
      t((await rec(page, storeId)).correct === null, `${tag}: re-entering the old value doesn't resurrect the grade`);
      if (isMc) await page.check(`${root} .opts label:nth-of-type(${right === 0 ? 2 : 1}) input`); else await page.fill(inp, right + "9");
    }
    await reload(page, pageOfItem(storeId));
    const r = await rec(page, storeId);
    const graded = kind === "part" ? (r.result !== null || r.selfMark !== null || r.parts[item.partKey].correct !== null) : r.correct !== null;
    t(!graded && r.attempts.length === attemptsBefore, `${tag}: after reload not graded, ${attemptsBefore} attempt(s) intact`);
    if (kind === "part") t((await page.textContent(sel.pill(item.parentId))) !== "Correct", `${tag}: reload shows no Correct badge`);
    covered.push(combo);
  }
  const missing = combos.filter((c) => !covered.includes(c));
  t(missing.length === 0 && combos.length >= 15, `every input type covered (${combos.length}: ${combos.join(", ")})`);
  console.log(`invalidation types covered: ${covered.join(", ")}`);
  // the work box is a snapshot and doesn't clear a grade (documented)
  await go(page, "l2-problems");
  const W = "cse332-w1-l2-parking";
  await fillProblemRight(page, W); await page.click(sel.taskCheck(W));
  await page.fill(sel.work(W), "25 every 3 days");
  t((await rec(page, W)).result === "right", "editing the ungraded work box keeps the grade");
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}

/* =========================================================== 6. draft races: type then immediately repaint */
group = "races";
{
  const page = await open({ hash: "cyu-l2" });
  const Q = "cse332-w1-l2-cyu-beannoying-n7";
  await page.locator(sel.quizInput(Q)).pressSequentially("4", { delay: 0 });
  await page.locator(sel.quizInput(Q)).pressSequentially("8", { delay: 0 });
  await page.click(sel.quizShow(Q), { delay: 0 });
  let r = await rec(page, Q);
  t((await page.inputValue(sel.quizInput(Q))) === "48" && r.raw === "48", "type then Show answer: text kept and saved");
  t(r.revealed && r.attempts.length === 0 && r.events.filter((e) => e.type === "reveal").length === 1, "reveal is an event, not an attempt");
  await reload(page, "cyu-l2");
  t((await page.inputValue(sel.quizInput(Q))) === "48" && await page.isVisible(`.cyu[data-id="${Q}"] > .why`), "after reload: text and reveal restored");
  const M = "cse332-w1-l2-cyu-theta-meaning";
  await page.check(sel.quizRadio(M, 0)); await page.check(sel.quizRadio(M, 2)); await page.click(sel.quizShow(M));
  t(await page.isChecked(sel.quizRadio(M, 2)) && (await rec(page, M)).choice === 2, "rapid MC change then reveal: selection kept");
  await reload(page, "cyu-l2");
  t(await page.isChecked(sel.quizRadio(M, 2)), "MC selection kept after reload");
  // a later Check after reveal is an attempt flagged as seen-before
  await page.fill(sel.quizInput(Q), "49"); await page.click(sel.quizCheck(Q));
  r = await rec(page, Q);
  t(r.attempts.length === 1 && r.attempts[0].solutionViewedBeforeSubmit === true && /Answered 1 of 10 · 0 correct/.test(await page.textContent('[data-quiz-score="l2"]')), "check after reveal: answered, not first-try correct");
  await go(page, "l2-problems");
  const P = "cse332-w1-l2-binary-iterations";
  await page.locator(sel.part(`${P}.halvings-1024`)).pressSequentially("10", { delay: 0 });
  await page.click(`${sel.task(P)} .task-actions button:has-text("hint")`);
  r = await rec(page, P);
  t((await page.inputValue(sel.part(`${P}.halvings-1024`))) === "10" && r.parts["halvings-1024"].raw === "10" && r.hintsRevealed === 1, "type then hint: text kept");
  await page.locator(sel.work(P)).pressSequentially("halve", { delay: 0 });
  await page.click(`${sel.task(P)} .task-actions button:has-text("Show solution")`);
  t((await rec(page, P)).work === "halve" && (await page.inputValue(sel.work(P))) === "halve", "type in work then Show solution: text kept");
  await reload(page, "l2-problems");
  t((await page.inputValue(sel.part(`${P}.halvings-1024`))) === "10" && (await page.inputValue(sel.work(P))) === "halve", "both restored after reload");
  // a quick check typed then left via pagehide (navigation away and back)
  const QC = "cse332-w1-l2-counting-prints-n10";
  await go(page, "counting");
  await page.locator(sel.qcInput(QC)).pressSequentially("100", { delay: 0 });
  await reload(page, "counting");
  t((await page.inputValue(sel.qcInput(QC))) === "100" && (await rec(page, QC)).correct === null, "quick-check draft survives an immediate reload, ungraded");
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}

/* =========================================================== 7. save failure, retry, recovery; transient notices only */
group = "failure";
{
  const page = await open({ hash: "l2-problems", mock: { failAll: true, latencyMs: 50, persistKey: "mock-fail" } });
  const P = "cse332-w1-l2-arraylist-worst";
  await page.fill(sel.work(P), "resize copies 8 then writes 1");
  await page.waitForSelector('.toast[data-notice="save-failed"]', { timeout: 5000 });
  t(await page.isVisible('.toast[data-notice="save-failed"]'), "transient save-failed notice shown");
  await page.locator(sel.task(P)).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/desktop-save-failure-toast.png` });
  t((await page.inputValue(sel.work(P))) === "resize copies 8 then writes 1", "typed text still on the page");
  await page.fill(sel.part(`${P}.full-8`), "9"); await page.fill(sel.part(`${P}.bucket`), "O(n)");
  await page.dblclick(sel.taskCheck(P));
  await page.fill(sel.part(`${P}.full-8`), "8"); await page.click(sel.taskCheck(P));
  const ids = (await rec(page, P)).attempts.map((a) => a.attemptId);
  t(ids.length === 3, "3 attempts recorded while failing");
  // reload during the outage: still there (local mirror + outbox)
  await reload(page, "l2-problems");
  t((await page.inputValue(sel.work(P))) === "resize copies 8 then writes 1" && (await rec(page, P)).attempts.length === 3, "reload during outage keeps text and attempts");
  t((await page.evaluate(() => window.__mock.changes.length)) === 0, "nothing reached the server yet");
  await page.evaluate(() => window.__mock.set({ failAll: false }));
  await page.evaluate(() => window.CourseSite.flush());
  await page.waitForSelector('.toast[data-notice="save-recovered"]', { timeout: 10000 });
  t(true, "transient recovery notice shown");
  const delivered = await page.evaluate(() => window.__mock.changes.filter((c) => c.kind === "attempt").map((c) => c.attempt.attemptId));
  t(delivered.length === 3 && ids.every((id) => delivered.filter((d) => d === id).length === 1), "every attempt delivered exactly once after recovery");
  t((await page.evaluate(() => window.__mock.remote.items["cse332-w1-l2-arraylist-worst"].work)) === "resize copies 8 then writes 1", "work text reached the server");
  t((await page.evaluate(() => window.CourseSite.pending())) === 0, "outbox drained");
  // transient: notices disappear; there is no persistent save status anywhere
  await sleep(7600);
  t((await page.$$eval(".toast", (x) => x.length)) === 0, "notices are gone after a few seconds");
  const status = await page.evaluate(() => /\b(Saved at|Saving|All changes saved|Unsaved)\b/i.test(document.body.innerText) || document.querySelectorAll("[class*=save-status], [class*=saved], [id*=save]").length);
  t(!status, "no persistent save header/status in the page");
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}
{
  // slow adapter: the page is usable before load() resolves
  const page = await open({ hash: "home", mock: { latencyMs: 1500 } }).catch(() => null);
  t(page !== null, "slow adapter (1.5 s) boots");
  if (page) {
    t(page.errors.length === 0, "slow adapter: no errors");
    await page.context().close();
  }
  const ctx = await browser.newContext();
  await ctx.addInitScript(`${MOCK_SRC}\n;window.__mock = MockAdapter.create({ failLoad: true }); window.COURSE_SITE_STORAGE = window.__mock.adapter;`);
  const p2 = await ctx.newPage();
  await p2.goto(`${url}/#home`);
  await p2.waitForFunction(() => document.documentElement.dataset.ready === "true");
  t(await p2.isVisible('.toast[data-notice="load-failed"]'), "load failure: transient notice, site still works");
  await ctx.close();
}

/* =========================================================== 8. conflict from the adapter */
group = "conflict";
{
  const page = await open({ hash: "l2-problems", mock: { persistKey: "mock-conflict" } });
  const P = "cse332-w1-l2-parking";
  await page.fill(sel.work(P), "local reasoning");
  await fillProblemRight(page, P); await page.click(sel.taskCheck(P));
  await page.evaluate(() => window.CourseSite.flush());
  // another device wrote a different work text and its own attempt
  await page.evaluate((id) => {
    const st = window.CourseSite.exportState();
    st.items[id].work = "remote device text";
    st.items[id].attempts.push({ attemptId: "remote-attempt-1", seq: 1, itemId: id, itemKind: "problem", submittedAt: new Date(Date.now() - 1000).toISOString(),
      answer: {}, result: { overall: false }, feedbackKind: "incorrect", hintsRevealedAtSubmit: 0, solutionViewedBeforeSubmit: false });
    window.__mock.set({ conflictNext: true, conflictRemote: st });
  }, P);
  await page.fill(sel.work(P), "local reasoning, more");
  await page.waitForSelector('.toast[data-notice="conflict-merged"]', { timeout: 5000 });
  t(true, "transient conflict notice");
  await page.evaluate(() => window.CourseSite.flush());
  const r = await rec(page, P);
  t((await page.inputValue(sel.work(P))) === "local reasoning, more" && r.work === "local reasoning, more", "local text kept after conflict");
  t(r.attempts.length === 2 && r.attempts.some((a) => a.attemptId === "remote-attempt-1") && new Set(r.attempts.map((a) => a.attemptId)).size === 2, "attempts unioned by attemptId, no duplicates");
  t(/remote device text/.test(await page.textContent(`${sel.task(P)} .conflict-copy`)), "the other device's text is kept and shown");
  const server = await page.evaluate((id) => window.__mock.remote.items[id], P);
  t(server.attempts.length === 2 && server.work === "local reasoning, more", "server ends with the merged record");
  await reload(page, "l2-problems");
  t((await rec(page, P)).attempts.length === 2, "merge survives reload");
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}

/* =========================================================== 9. change events */
group = "events";
{
  const page = await open({ hash: "cyu-l1" });
  await page.evaluate(() => { window.__ev = []; document.addEventListener("course-site:change", (e) => window.__ev.push(e.detail)); });
  const Q = "cse332-w1-l1-cyu-back-after-enqueues";
  await page.fill(sel.quizInput(Q), "7"); await page.click(sel.quizCheck(Q)); await page.click(sel.quizShow(Q));
  const ev = await page.evaluate(() => window.__ev);
  t(ev.some((e) => e.kind === "snapshot" && e.itemId === Q && e.record.raw === "7"), "snapshot change event");
  const a = ev.find((e) => e.kind === "attempt");
  t(a && a.attempt.itemId === Q && a.attempt.answer.raw === "7" && a.attempt.answer.normalized === "7" && a.attempt.result.overall === true && a.attempt.feedbackKind === "correct" && a.siteId === "cse332-26au-week1" && a.schemaVersion === 2, "attempt change event shape");
  t(ev.some((e) => e.kind === "event" && e.event.type === "reveal"), "reveal event");
  t(ev.every((e) => e.changeId && e.at), "every change has changeId and timestamp");
  await page.context().close();
}

/* =========================================================== 10. mobile screenshots of the interactive pieces */
group = "mobile-shots";
{
  const page = await open({ viewport: { width: 390, height: 844 }, hash: "l2-problems" });
  const BA = "cse332-w1-l2-beannoying";
  await page.fill(sel.part(`${BA}.prints`), "2n"); await page.click(sel.taskCheck(BA));
  await page.locator(sel.task(BA)).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/mobile-problem-feedback.png` });
  await go(page, "cyu-l1");
  await page.check(sel.quizRadio("cse332-w1-l1-cyu-implementation", 1)); await page.click(sel.quizCheck("cse332-w1-l1-cyu-implementation"));
  await page.screenshot({ path: `${SHOTS}/mobile-quiz.png` });
  t((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, "mobile quiz no overflow after feedback");
  await page.context().close();
  const p2 = await open({ viewport: { width: 390, height: 844 }, hash: "l2-problems", mock: { failAll: true } });
  await p2.fill(sel.work("cse332-w1-l2-parking"), "typing during an outage");
  await p2.waitForSelector('.toast[data-notice="save-failed"]');
  await p2.locator(sel.task("cse332-w1-l2-parking")).scrollIntoViewIfNeeded();
  await p2.screenshot({ path: `${SHOTS}/mobile-save-failure-toast.png` });
  t((await p2.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, "toast causes no overflow on mobile");
  await p2.context().close();
}

await browser.close();
srv.close();
console.log(Object.entries(results).map(([g, r]) => `  ${g}: ${r.pass} passed, ${r.fail} failed`).join("\n"));
console.log(`browser: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
