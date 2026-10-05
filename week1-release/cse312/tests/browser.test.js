"use strict";
/*
  Browser tests (Playwright + headless Chromium). Run: node tests/browser.test.js
  Covers every page at desktop (1280×800) and mobile (390×844), right/wrong/misconception answers, hints, solution
  confirmation, quizzes, enumerators (incl. truncation), persistence across reload, attempt history, save failure
  and recovery, conflicts, slow adapters, and the absence of any persistent save-status UI. Saves screenshots.
*/
const fs = require("fs");
const path = require("path");
const { launch } = require("./browser.js");
const { start } = require("./serve.js");

const SHOTS = path.resolve(__dirname, "../screenshots");
const MOCK = path.resolve(__dirname, "../examples/mock-adapter.js");
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const failures = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; failures.push(msg); console.log(`  FAIL ${msg}`); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

async function newPage(browser, base, { viewport = DESKTOP, mock = null, hash = "home" } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: viewport === MOBILE ? 2 : 1 });
  const errors = [];
  if (mock) {
    await context.addInitScript({ path: MOCK });
    await context.addInitScript((cfg) => {
      if (!window.MockAdapter.instance) {
        window.MockAdapter.instance = window.MockAdapter.create(cfg);
        window.COURSE_SITE_STORAGE = window.MockAdapter.instance;
      }
    }, mock);
  }
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => errors.push(`requestfailed: ${r.url()}`));
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(`${base}#${hash}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { timeout: 15000 });
  return { context, page, errors };
}
async function go(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForFunction((h) => document.querySelector(`.page#${h}`)?.classList.contains("is-active"), hash);
}
const task = (id) => `.task[data-id="${id}"]`;
const part = (id) => `.answer-spec[data-part-id="${id}"] input`;
const qc = (id) => `.check[data-id="${id}"]`;
const quiz = (id) => `.cyu[data-id="${id}"]`;
async function text(page, sel) { return (await page.locator(sel).first().innerText()).trim(); }
async function snapshot(page) { return page.evaluate(() => window.COURSE_SITE.snapshot()); }

async function main() {
  const { server, url } = await start();
  const browser = await launch();
  const allErrors = [];
  try {
    /* =============================================== 1. every page, desktop + mobile */
    for (const [label, viewport] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
      const { context, page, errors } = await newPage(browser, url, { viewport });
      const routes = await page.$$eval(".page", (ps) => ps.map((p) => p.id));
      ok(routes.length === 19, `${label}: 19 pages (got ${routes.length})`);
      for (const r of routes) {
        await go(page, r);
        const info = await page.evaluate(() => {
          const pg = document.querySelector(".page.is-active");
          const visible = pg.innerText;
          return {
            rawTex: /\\\(|\\\)|\\\[|\\\]|\\frac|\\binom|\\cdot|\\times/.test(visible),
            katexErrors: pg.querySelectorAll(".katex-error").length,
            katex: pg.querySelectorAll(".katex").length,
            hasTexSource: /\\\(|\\\[/.test(pg.innerHTML) || pg.querySelectorAll(".katex").length > 0,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            title: document.title,
          };
        });
        ok(!info.rawTex, `${label} #${r}: no raw TeX visible`);
        ok(info.katexErrors === 0, `${label} #${r}: no KaTeX errors`);
        ok(!info.hasTexSource || info.katex > 0, `${label} #${r}: math rendered`);
        ok(info.overflow <= 0, `${label} #${r}: no horizontal overflow (${info.overflow}px)`);
      }
      // the rail itself renders math too
      ok(await page.locator(".rail .katex").count() > 0, `${label}: rail math rendered`);
      allErrors.push(...errors.map((e) => `${label} pages: ${e}`));
      await context.close();
    }

    /* =============================================== 2. answers, feedback, hints, solutions */
    {
      const { context, page, errors } = await newPage(browser, url);
      // quick check: misconception, unreadable, equivalent forms
      await go(page, "l2-combos");
      const sm = qc("cse312-w1-l2-qc-smear-colors");
      await page.fill(`${sm} input`, "210");
      await page.click(`${sm} button.primary`);
      let fb = await text(page, `${sm} .feedback`);
      ok(/ordered arrangements/i.test(fb) && /Does order matter/i.test(fb), `quick check misconception feedback: "${fb}"`);
      ok(!/\b35\b/.test(fb), "misconception feedback does not reveal the answer");
      await page.fill(`${sm} input`, "seven choose three");
      await page.click(`${sm} button.primary`);
      fb = await text(page, `${sm} .feedback`);
      ok(/Couldn.t read|Unknown name/i.test(fb), `unreadable input explained: "${fb}"`);
      await page.fill(`${sm} input`, "36");
      await page.click(`${sm} button.primary`);
      fb = await text(page, `${sm} .feedback`);
      ok(/Not quite\. Yours is 36/.test(fb) && !/\b35\b/.test(fb), `plain wrong answer: "${fb}"`);
      await page.fill(`${sm} input`, "7!/(3!4!)");
      await page.click(`${sm} button.primary`);
      fb = await text(page, `${sm} .feedback`);
      ok(/Correct: 35/.test(fb), `equivalent form accepted: "${fb}"`);
      const smState = (await snapshot(page)).items["cse312-w1-l2-qc-smear-colors"];
      ok(smState.attempts.length === 3 && smState.attempts.map((a) => a.feedbackKind).join() === "ordered-instead-of-unordered,incorrect,correct",
        `quick check attempts recorded with feedbackKind (unreadable input is not an attempt): ${smState.attempts.map((a) => a.feedbackKind)}`);
      ok(smState.firstTryCorrect === false && smState.correct === true && smState.tries === 3, "quick check snapshot: tries, firstTryCorrect, correct");

      // section problem: misconception, big exact numbers
      await go(page, "s1-basic");
      const t2d = task("cse312-w1-s1-t2d-anup-ends-middle");
      await page.fill(part("cse312-w1-s1-t2d-anup-ends-middle.ans"), "2*12!");
      await page.click(`${t2d} .my-work button.primary`);
      fb = await text(page, `${t2d} .my-work > .feedback`);
      ok(/two ends.*and.*the middle/i.test(fb), `problem misconception feedback: "${fb}"`);
      ok((await text(page, `${t2d} .pill`)) === "Not yet", "pill shows Not yet");
      await page.fill(part("cse312-w1-s1-t2d-anup-ends-middle.ans"), "1437004800");
      await page.click(`${t2d} .my-work button.primary`);
      fb = await text(page, `${t2d} .my-work > .feedback`);
      ok(/Correct: 1,437,004,800/.test(fb), `problem correct: "${fb}"`);
      ok((await text(page, `${t2d} .pill`)) === "Correct", "pill shows Correct");

      const t3 = task("cse312-w1-s1-t3-card-game");
      const exact = (6227020800n ** 4n).toString();
      await page.fill(part("cse312-w1-s1-t3-card-game.ans"), (6227020800n ** 4n + 1n).toString());
      await page.click(`${t3} .my-work button.primary`);
      fb = await text(page, `${t3} .my-work > .feedback`);
      ok(/Not quite/.test(fb), `40-digit near miss rejected: "${fb.slice(0, 80)}"`);
      await page.fill(part("cse312-w1-s1-t3-card-game.ans"), exact);
      await page.click(`${t3} .my-work button.primary`);
      ok(/Correct/.test(await text(page, `${t3} .my-work > .feedback`)), "40-digit exact answer accepted");
      await page.fill(part("cse312-w1-s1-t3-card-game.ans"), "52!");
      await page.click(`${t3} .my-work button.primary`);
      ok(/one card of each suit/i.test(await text(page, `${t3} .my-work > .feedback`)), "52! gets the ignored-constraint misconception");

      // multi-part with per-part misconception
      await go(page, "s1-more");
      const t4 = task("cse312-w1-s1-t4-seating");
      await page.fill(part("cse312-w1-s1-t4-seating.a"), "5!*2^5");
      await page.fill(part("cse312-w1-s1-t4-seating.b"), "10!-9!");
      await page.click(`${t4} .my-work button.primary`);
      fb = await text(page, `${t4} .my-work > .feedback`);
      ok(/1 of 2 right/.test(fb), `multi-part summary: "${fb}"`);
      const pfb = await text(page, `.answer-spec[data-part-id="cse312-w1-s1-t4-seating.b"] .part-fb`);
      ok(/two orders/.test(pfb), `per-part misconception: "${pfb}"`);
      const t4att = (await snapshot(page)).items["cse312-w1-s1-t4-seating"].attempts[0];
      ok(t4att.result.parts["cse312-w1-s1-t4-seating.a"] === true && t4att.result.parts["cse312-w1-s1-t4-seating.b"] === false && t4att.result.overall === false,
        "multi-part attempt records per-part correctness");
      ok(t4att.answer["cse312-w1-s1-t4-seating.b"].raw === "10!-9!" && t4att.answer["cse312-w1-s1-t4-seating.b"].normalized === "3265920", "attempt stores raw + normalized per part");
      ok(t4att.feedbackKind === "forgot-internal-order", `multi-part feedbackKind: ${t4att.feedbackKind}`);

      // formula answer
      const t9 = task("cse312-w1-s1-t9-family-portrait");
      await page.fill(part("cse312-w1-s1-t9-family-portrait.ans"), "n!m!");
      await page.click(`${t9} .my-work button.primary`);
      ok(/once per family/.test(await text(page, `${t9} .my-work > .feedback`)), "formula misconception");
      await page.fill(part("cse312-w1-s1-t9-family-portrait.ans"), "n! (m!)^n");
      await page.click(`${t9} .my-work button.primary`);
      ok(/Correct/.test(await text(page, `${t9} .my-work > .feedback`)), "formula accepted");

      // hint ladder
      const t7 = task("cse312-w1-s1-t7-birthday-cake");
      const hintBtn = page.locator(`${t7} .task-actions button`, { hasText: "hint" });
      ok(await page.locator(`${t7} ol.hints`).isHidden(), "hints hidden at first");
      await hintBtn.click();
      ok(await page.locator(`${t7} ol.hints li`).nth(0).isVisible() && await page.locator(`${t7} ol.hints li`).nth(1).isHidden(), "first hint only");
      await hintBtn.click();
      ok(await page.locator(`${t7} ol.hints li`).nth(1).isVisible(), "second hint");
      ok(await page.locator(`${t7} .task-actions button`, { hasText: "All 2 hints shown" }).isDisabled(), "hint button disabled at the end");
      // solution needs confirmation when unanswered
      const solBtn = page.locator(`${t7} .task-actions button`, { hasText: "solution" });
      await solBtn.click();
      ok(await page.locator(`${t7} .solution`).isHidden(), "solution not shown on first press when unanswered");
      ok(/haven.t answered/.test(await text(page, `${t7} .my-work > .feedback`)), "confirmation message");
      await solBtn.click();
      ok(await page.locator(`${t7} .solution`).isVisible(), "solution shown after confirmation");
      ok(await page.locator(`${t7} .steps li`).first().isHidden(), "steps start hidden");
      await page.locator(`${t7} .steps button`, { hasText: "Show first step" }).click();
      ok(await page.locator(`${t7} .steps li`).first().isVisible() && await page.locator(`${t7} .steps li.answer`).isHidden(), "one step at a time");
      await page.locator(`${t7} .steps button`, { hasText: "Show all" }).click();
      ok(await page.locator(`${t7} .steps li.answer`).isVisible(), "final answer highlighted after Show all");
      const t7s = (await snapshot(page)).items["cse312-w1-s1-t7-birthday-cake"];
      ok(t7s.hintsRevealed === 2 && t7s.solutionViewed && t7s.events.map((e) => e.type).join() === "hint,hint,solution", `hint and solution events logged: ${t7s.events.map((e) => e.type)}`);
      ok(t7s.attempts.length === 0, "hints and solution views are not attempts");
      // now an attempt records the hints/solution context
      await page.fill(part("cse312-w1-s1-t7-birthday-cake.ans"), "4^6");
      await page.click(`${t7} .my-work button.primary`);
      const t7a = (await snapshot(page)).items["cse312-w1-s1-t7-birthday-cake"].attempts[0];
      ok(t7a.hintsRevealedAtSubmit === 2 && t7a.solutionViewedBeforeSubmit === true, "attempt captures hints and solution state at submit");
      // brute-force button
      await page.locator(`${task("cse312-w1-s1-t6-lizards-snakes")} .task-actions button`, { hasText: "solution" }).click();
      await page.locator(`${task("cse312-w1-s1-t6-lizards-snakes")} .task-actions button`, { hasText: "solution" }).click();
      await page.locator(`${task("cse312-w1-s1-t6-lizards-snakes")} [data-brute]`).click();
      await page.waitForFunction(() => /Found/.test(document.querySelector('[data-brute="lizards"]').nextElementSibling.textContent));
      ok(/Found 204 after checking all 1,024 .*Matches the formula/.test(await text(page, `${task("cse312-w1-s1-t6-lizards-snakes")} [data-brute] + .brute`)), "brute-force button matches");

      // self-check problem
      await go(page, "s1-review");
      const t1b = task("cse312-w1-s1-t1b-set-operations");
      await page.fill(part("cse312-w1-s1-t1b-set-operations.union"), "{a,b,c,d}");
      await page.locator(`${t1b} .task-actions button`, { hasText: "solution" }).click();
      await page.locator(`${t1b} .self-mark button`, { hasText: "I got it" }).click();
      ok((await text(page, `${t1b} .pill`)) === "Correct", "self-check marks correct");
      const t1bs = (await snapshot(page)).items["cse312-w1-s1-t1b-set-operations"];
      ok(t1bs.attempts.length === 1 && t1bs.attempts[0].type === "self-check" && t1bs.attempts[0].selfMark === "got" && t1bs.attempts[0].solutionViewedBeforeSubmit === true, "self-check press is an attempt");
      // yes/no
      const r5 = task("cse312-w1-s1-review-set-difference");
      await page.fill(part("cse312-w1-s1-review-set-difference.ans"), "maybe");
      await page.click(`${r5} .my-work button.primary`);
      ok(/yes or no/i.test(await text(page, `${r5} .my-work > .feedback`)), "yes/no asks for yes or no");
      await page.fill(part("cse312-w1-s1-review-set-difference.ans"), "No");
      await page.click(`${r5} .my-work button.primary`);
      ok(/Correct/.test(await text(page, `${r5} .my-work > .feedback`)), "yes/no correct");

      // quiz: wrong MC shows why, score counts first tries, review links at the end
      await go(page, "l1-quiz");
      const q1 = quiz("cse312-w1-l1-quiz-set-equality");
      await page.click(`${q1} label[data-opt="tuple"]`);
      await page.click(`${q1} .row button.primary`);
      ok(await page.locator(`${q1} label[data-opt="tuple"] .why`).isVisible(), "wrong option explains why");
      ok(await page.locator(`${q1} label[data-correct] .why`).isHidden(), "correct option not revealed by a wrong pick");
      await page.click(`${q1} label[data-opt="with-repeats"]`);
      await page.click(`${q1} .row button.primary`);
      ok(/Correct/.test(await text(page, `${q1} .feedback`)), "mc correct on second try");
      const q6 = quiz("cse312-w1-l1-quiz-eight-runners");
      await page.fill(`${q6} input`, "56");
      await page.click(`${q6} .row button.primary`);
      fb = await text(page, `${q6} .feedback`);
      ok(/Does order matter/i.test(fb) && !/336/.test(fb), `quiz misconception: "${fb}"`);
      await page.click(`${q6} .row button.btn:not(.primary)`); // Show answer
      ok(/Answer: 336/.test(await text(page, `${q6} .feedback`)), "show answer");
      const qs = await snapshot(page);
      const q1s = qs.items["cse312-w1-l1-quiz-set-equality"];
      ok(q1s.attempts.length === 2 && q1s.attempts[0].answer.choice === "tuple" && q1s.attempts[0].answer.choiceIndex === 0 && q1s.attempts[0].feedbackKind === "set-vs-sequence" && q1s.firstTryCorrect === false && q1s.tries === 2,
        "quiz MC attempts: choice, index, misconception tag, tries, firstTryCorrect");
      ok(qs.items["cse312-w1-l1-quiz-eight-runners"].events.some((e) => e.type === "reveal") && qs.items["cse312-w1-l1-quiz-eight-runners"].revealed, "reveal logged as event");
      // answer the rest
      const rest = await page.$$eval("#l1-quiz .cyu", (ls) => ls.map((l) => ({ id: l.dataset.id, kind: l.dataset.kind })));
      const NUM = { "cse312-w1-l1-quiz-lunch-special": "12", "cse312-w1-l1-quiz-powerset-product": "12", "cse312-w1-l1-quiz-repeat-strings": "125-60", "cse312-w1-l1-quiz-six-books-two-people": "2^6" };
      for (const { id, kind } of rest) {
        if (id === "cse312-w1-l1-quiz-set-equality" || id === "cse312-w1-l1-quiz-eight-runners") continue;
        if (kind === "mc") await page.click(`${quiz(id)} label[data-correct]`);
        else await page.fill(`${quiz(id)} input`, NUM[id]);
        await page.click(`${quiz(id)} .row button.primary`);
      }
      const summary = await text(page, "#l1-quiz [data-summary]");
      ok(/You got 8 of 10 on the first try/.test(summary) && /Worth another look/.test(summary), `quiz summary: "${summary}"`);
      ok(/Answered 10 of 10 · 8 correct on the first try/.test(await text(page, "#l1-quiz [data-score]")), "quiz score");

      // enumerator: complete run says so; capped run says truncated and claims no total
      await go(page, "l1-kperms");
      const en = "#l1-kperms .panel.enum";
      await page.locator(`${en} button`, { hasText: "Check next" }).click();
      let st = await text(page, `${en} .enum-stats`);
      ok(/In progress: 1 of 125/.test(st) && /Partial tally/.test(st) && !/Checked all/.test(st), `partial enumerator run: "${st}"`);
      await page.locator(`${en} button`, { hasText: "Run all" }).click();
      await page.waitForFunction((s) => /Checked all|Truncated/.test(document.querySelector(`${s} .enum-stats`).textContent), en);
      st = await text(page, `${en} .enum-stats`);
      ok(/Checked all 125 strings: 60 strings with distinct letters\. Matches/.test(st), `complete enumerator run: "${st}"`);
      await page.fill(`${en} input[aria-label="letters"]`, "26");
      await page.fill(`${en} input[aria-label="length"]`, "5");
      await page.locator(`${en} button`, { hasText: "Run all" }).click();
      await page.waitForFunction((s) => /Checked all|Truncated/.test(document.querySelector(`${s} .enum-stats`).textContent), en, { timeout: 20000 });
      st = await text(page, `${en} .enum-stats`);
      ok(/^Truncated: stopped after 200,000 of 11,881,376/.test(st) && /not the answer/.test(st) && !/Checked all|Matches/.test(st), `truncated enumerator run: "${st}"`);
      ok(await page.locator(`${en} button`, { hasText: "Run all" }).isDisabled(), "run disabled once capped");
      // anagram enumerator groups words
      await go(page, "l2-anagrams");
      const an = "#l2-anagrams .panel.enum";
      await page.locator(`${an} button`, { hasText: "Run all" }).click();
      await page.waitForFunction((s) => /Checked all/.test(document.querySelector(`${s} .enum-stats`).textContent), an);
      ok(/Checked all 5,040 orderings: 1,260 different words\. Matches/.test(await text(page, `${an} .enum-stats`)), "SEATTLE enumerator");
      ok(/exactly 4 times/.test(await text(page, `${an} .enum-keys`)), "each SEATTLE word produced 4 times");
      // SEATTLE stepper never claims the total early
      await page.click("#seattle-next");
      let so = await text(page, "#seattle-out");
      ok(/not the answer yet/.test(so) && !/1,260/.test(so), `stepper partial: "${so}"`);
      for (let i = 0; i < 4; i++) await page.click("#seattle-next");
      so = await text(page, "#seattle-out");
      ok(/full count: 1,260/.test(so), `stepper complete: "${so}"`);

      // keyboard navigation
      await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => location.hash === "#l2-binomial");
      ok(true, "arrow key moves to the next page");

      allErrors.push(...errors.map((e) => `interactions: ${e}`));
      await context.close();
    }

    /* =============================================== 3. persistence, attempt history, rapid checks */
    {
      const { context, page, errors } = await newPage(browser, url, { hash: "s1-more" });
      const t8 = task("cse312-w1-s1-t8-photographs");
      await page.fill(`${t8} textarea`, "Case 1 adjacent, case 2 one between. \\(2\\cdot 7!\\)");
      await page.fill(part("cse312-w1-s1-t8-photographs.ans"), "2*7!");
      // rapid double click on Check: two distinct attempts
      await page.locator(`${t8} .my-work button.primary`).dblclick();
      let s = (await snapshot(page)).items["cse312-w1-s1-t8-photographs"];
      ok(s.attempts.length === 2 && s.attempts[0].attemptId !== s.attempts[1].attemptId && s.attempts[0].seq === 1 && s.attempts[1].seq === 2,
        `double-click → 2 distinct attempts (${s.attempts.map((a) => `${a.seq}:${a.attemptId.slice(0, 12)}`)})`);
      await page.fill(part("cse312-w1-s1-t8-photographs.ans"), "(2*7+2*6)*6!");
      await page.click(`${t8} .my-work button.primary`);
      await page.locator(`${t8} .task-actions button`, { hasText: "hint" }).click();
      await go(page, "l2-stars");
      const coins = qc("cse312-w1-l2-qc-coins");
      await page.fill(`${coins} input`, "5^32");
      await page.click(`${coins} button.primary`);
      await page.click(`${coins} button.primary`);
      await page.click(`${coins} button.primary`);
      await page.fill(`${coins} input`, "C(36,4)"); // left typed, not checked
      await sleep(900);
      await page.reload();
      await page.waitForFunction(() => document.documentElement.dataset.ready === "1");
      await go(page, "s1-more");
      ok((await page.inputValue(`${t8} textarea`)).startsWith("Case 1 adjacent"), "work text restored after reload");
      ok((await page.inputValue(part("cse312-w1-s1-t8-photographs.ans"))) === "(2*7+2*6)*6!", "answer restored after reload");
      ok((await text(page, `${t8} .pill`)) === "Correct", "status restored after reload");
      ok(await page.locator(`${t8} ol.hints li`).first().isVisible(), "hint state restored after reload");
      ok(await page.locator(`${t8} .work-preview .katex`).count() > 0, "work preview renders math after reload");
      s = (await snapshot(page)).items["cse312-w1-s1-t8-photographs"];
      ok(s.attempts.length === 3 && s.attempts.map((a) => a.seq).join() === "1,2,3", "attempt history survives reload");
      const c = (await snapshot(page)).items["cse312-w1-l2-qc-coins"];
      ok(c.attempts.length === 3 && new Set(c.attempts.map((a) => a.attemptId)).size === 3, "three identical rapid quick-check presses → 3 attempts");
      await go(page, "l2-stars");
      ok((await page.inputValue(`${coins} input`)) === "C(36,4)", "unchecked typed text restored (snapshot, not an attempt)");
      ok(c.attempts.length === 3 && c.raw === "C(36,4)", "typing is a snapshot only");
      // the store emits DOM change events
      const evs = await page.evaluate(async () => {
        const seen = [];
        window.addEventListener("course-site:change", (e) => seen.push(e.detail.kind));
        const box = document.querySelector('.check[data-id="cse312-w1-l2-qc-coins"]');
        box.querySelector("button.primary").click();
        return seen;
      });
      ok(evs.includes("attempt") && evs.includes("snapshot"), `course-site:change events: ${evs}`);
      allErrors.push(...errors.map((e) => `persistence: ${e}`));
      await context.close();
    }

    /* =============================================== 4. save failure → transient toast, nothing lost, recovery, exactly once */
    {
      const { context, page, errors } = await newPage(browser, url, { mock: { latencyMs: 80 }, hash: "s1-basic" });
      ok(await page.evaluate(() => window.COURSE_SITE.adapterName) === "mock", "mock adapter installed");
      await page.evaluate(() => window.MockAdapter.instance.set({ failSaves: true }));
      const t2b = task("cse312-w1-s1-t2b-divisors");
      await page.fill(`${t2b} textarea`, "Exponents 0..5, 0..2, 0..1 so 6*3*2");
      await page.fill(part("cse312-w1-s1-t2b-divisors.ans"), "10");
      await page.click(`${t2b} .my-work button.primary`);
      await page.fill(part("cse312-w1-s1-t2b-divisors.ans"), "36");
      await page.click(`${t2b} .my-work button.primary`);
      await page.click(`${t2b} .my-work button.primary`);
      await page.locator(".toast.error").first().waitFor({ timeout: 8000 });
      ok(/Couldn.t save/.test(await text(page, ".toast.error")), "transient error toast shown on save failure");
      await sleep(450); // let the toast finish fading in before the screenshot
      ok((await page.inputValue(`${t2b} textarea`)).startsWith("Exponents"), "typed text kept while failing");
      const mirror = await page.evaluate(() => JSON.parse(localStorage.getItem("cse312-26au-week1:mirror")));
      ok(mirror.store.items["cse312-w1-s1-t2b-divisors"].work.startsWith("Exponents") && mirror.outbox.filter((x) => x.kind === "attempt").length === 3, "work + 3 attempts held in the local mirror/outbox");
      await page.screenshot({ path: path.join(SHOTS, "save-failure-toast-desktop.png") });
      // keep typing while failing
      await page.fill(`${t2b} textarea`, "Exponents 0..5, 0..2, 0..1 so 6*3*2 = 36 (typed while offline)");
      await page.evaluate(() => window.MockAdapter.instance.set({ failSaves: false }));
      await page.locator(".toast.recovered").first().waitFor({ timeout: 20000 });
      ok(true, "recovery toast shown after the adapter heals");
      await page.waitForFunction(() => window.COURSE_SITE.pending().length === 0, null, { timeout: 10000 });
      const res = await page.evaluate(() => {
        const local = window.COURSE_SITE.snapshot().items["cse312-w1-s1-t2b-divisors"];
        const delivered = window.MockAdapter.instance.delivered().filter((d) => d.kind === "attempt");
        const remote = window.MockAdapter.instance.remote.items["cse312-w1-s1-t2b-divisors"];
        return { local: local.attempts.map((a) => a.attemptId), delivered: delivered.map((d) => d.attemptId), remoteWork: remote.work, remoteAttempts: remote.attempts.length };
      });
      ok(res.local.length === 3 && res.delivered.length === 3 && res.local.every((id) => res.delivered.filter((d) => d === id).length === 1), `every attempt delivered exactly once after recovery (${res.delivered.length})`);
      ok(res.remoteWork.endsWith("(typed while offline)") && res.remoteAttempts === 3, "remote has the latest text and all attempts");
      // toasts are transient
      await sleep(7600);
      ok(await page.locator(".toast").count() === 0, "toasts disappear on their own");
      // nothing persistent about saving anywhere
      const persistent = await page.evaluate(() => [...document.querySelectorAll("body *:not(script):not(style)")]
        .filter((n) => !n.closest(".toasts") && n.children.length === 0 && /\b(saved|saving|unsaved|sync(ed|ing)?|offline)\b/i.test(n.textContent) && n.offsetParent !== null)
        .map((n) => n.textContent.trim().slice(0, 60)));
      ok(persistent.length === 0, `no persistent save-status text: ${JSON.stringify(persistent)}`);
      ok(await page.locator("header, .save-status, .saved, [data-save-status]").count() === 0, "no save header/status element");
      // reload: mock state persists (sessionStorage), history intact
      await page.reload();
      await page.waitForFunction(() => document.documentElement.dataset.ready === "1");
      const after = await page.evaluate(() => window.COURSE_SITE.snapshot().items["cse312-w1-s1-t2b-divisors"].attempts.length);
      ok(after === 3, "history intact after reload with the remote adapter");
      allErrors.push(...errors.map((e) => `failure: ${e}`));
      await context.close();
    }

    /* =============================================== 5. conflict: merge by attemptId, keep local text, transient notice */
    {
      const { context, page, errors } = await newPage(browser, url, { mock: { latencyMs: 30, persistKey: "mock-conflict" }, hash: "l2-binomial" });
      const xy = qc("cse312-w1-l2-qc-coefficient-xy3");
      await page.fill(`${xy} input`, "3");
      await page.click(`${xy} button.primary`);
      await page.waitForFunction(() => window.COURSE_SITE.pending().length === 0, null, { timeout: 5000 });
      // another device saved: an extra attempt on the same item, a different typed value, and another item
      await page.evaluate(() => {
        const remote = JSON.parse(JSON.stringify(window.MockAdapter.instance.remote));
        const it = remote.items["cse312-w1-l2-qc-coefficient-xy3"];
        it.attempts.push({ attemptId: "att-other-device", seq: 2, itemId: it.id, submittedAt: new Date().toISOString(), answer: { raw: "4", normalized: "4" }, result: { correct: true, overall: true }, feedbackKind: "correct", hintsRevealedAtSubmit: 0, solutionViewedBeforeSubmit: false });
        it.raw = "4 (from phone)";
        remote.items["cse312-w1-l2-qc-sum-of-row"] = { id: "cse312-w1-l2-qc-sum-of-row", kind: "quickcheck", raw: "128", normalized: "128", correct: true, tries: 1, firstTryCorrect: true, revealed: false, updatedAt: new Date().toISOString(), attempts: [{ attemptId: "att-other-2", seq: 1, itemId: "cse312-w1-l2-qc-sum-of-row", submittedAt: new Date().toISOString(), answer: { raw: "128", normalized: "128" }, result: { correct: true, overall: true }, feedbackKind: "correct", hintsRevealedAtSubmit: 0, solutionViewedBeforeSubmit: false }], events: [] };
        remote.revision += 3;
        window.MockAdapter.instance.injectConflict(remote);
      });
      // this tab, unaware: types and checks again
      await page.fill(`${xy} input`, "4");
      await page.click(`${xy} button.primary`);
      await page.locator(".toast.conflict").first().waitFor({ timeout: 8000 });
      ok(/merged/.test(await text(page, ".toast.conflict")), "transient conflict notice");
      await page.waitForFunction(() => window.COURSE_SITE.pending().length === 0, null, { timeout: 8000 });
      const r = await page.evaluate(() => {
        const l = window.COURSE_SITE.snapshot().items;
        const rm = window.MockAdapter.instance.remote.items;
        const ids = (it) => it.attempts.map((a) => a.attemptId);
        return { local: ids(l["cse312-w1-l2-qc-coefficient-xy3"]), remote: ids(rm["cse312-w1-l2-qc-coefficient-xy3"]), raw: l["cse312-w1-l2-qc-coefficient-xy3"].raw, other: rm["cse312-w1-l2-qc-sum-of-row"] && rm["cse312-w1-l2-qc-sum-of-row"].attempts.length, seqs: l["cse312-w1-l2-qc-coefficient-xy3"].attempts.map((a) => a.seq) };
      });
      ok(r.local.length === 3 && r.remote.length === 3 && new Set(r.remote).size === 3 && r.remote.includes("att-other-device"), `conflict merge unions attempts by attemptId: ${r.remote}`);
      ok(r.raw === "4", "local typed text wins over the remote snapshot");
      ok((await page.inputValue(`${xy} input`)) === "4", "input still shows local text after the merge");
      ok(r.other === 1, "remote-only item survives the merge");
      await go(page, "l2-binomial");
      ok(/Correct: 128/.test(await text(page, `${qc("cse312-w1-l2-qc-sum-of-row")} .feedback`)), "merged remote item shows up on the page");
      allErrors.push(...errors.map((e) => `conflict: ${e}`));
      await context.close();
    }

    /* =============================================== 6. slow and failing loads don't block or clobber */
    {
      const context = await browser.newContext({ viewport: DESKTOP });
      await context.addInitScript({ path: MOCK });
      await context.addInitScript(() => {
        window.MockAdapter.instance = window.MockAdapter.create({ latencyMs: 2500, persistKey: "mock-slow" });
        window.COURSE_SITE_STORAGE = window.MockAdapter.instance;
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${url}#s1-basic`);
      await page.waitForSelector(`${task("cse312-w1-s1-t2c-staff-line")} textarea`);
      await page.fill(`${task("cse312-w1-s1-t2c-staff-line")} textarea`, "typed before the slow load finished");
      await page.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { timeout: 15000 });
      ok((await page.inputValue(`${task("cse312-w1-s1-t2c-staff-line")} textarea`)) === "typed before the slow load finished", "slow load doesn't block typing or overwrite it");
      await page.waitForFunction(() => window.COURSE_SITE.pending().length === 0, null, { timeout: 15000 });
      ok(await page.evaluate(() => window.MockAdapter.instance.remote.items["cse312-w1-s1-t2c-staff-line"].work) === "typed before the slow load finished", "early text reaches the slow adapter");
      allErrors.push(...errors.map((e) => `slow: ${e}`));
      await context.close();

      const c2 = await browser.newContext({ viewport: DESKTOP });
      await c2.addInitScript({ path: MOCK });
      await c2.addInitScript(() => {
        window.MockAdapter.instance = window.MockAdapter.create({ failLoads: true, persistKey: "mock-failload" });
        window.COURSE_SITE_STORAGE = window.MockAdapter.instance;
      });
      const p2 = await c2.newPage();
      const e2 = [];
      p2.on("pageerror", (e) => e2.push(e.message));
      await p2.goto(`${url}#home`);
      await p2.waitForFunction(() => document.documentElement.dataset.ready === "1");
      ok(/Couldn.t load/.test(await text(p2, ".toast.error")), "failed load → transient notice, page still works");
      allErrors.push(...e2.map((e) => `failload: ${e}`));
      await c2.close();
    }

    /* =============================================== 6b. edits invalidate the latest grade; "answered" = submitted */
    {
      const { context, page, errors } = await newPage(browser, url, { mock: { latencyMs: 20, persistKey: "mock-stale" }, hash: "l2-quiz" });
      const item = (id) => page.evaluate((i) => window.COURSE_SITE.snapshot().items[i], id);
      const remoteItem = (id) => page.evaluate((i) => window.MockAdapter.instance.remote.items[i], id);
      const flushed = () => page.waitForFunction(() => window.COURSE_SITE.pending().length === 0, null, { timeout: 8000 });
      const reload = async (hash) => { await page.reload(); await page.waitForFunction(() => document.documentElement.dataset.ready === "1"); await go(page, hash); };
      const score = () => text(page, "#l2-quiz [data-score]");

      // (a) quiz numeric: correct → edit to wrong → cleared in DOM, store and adapter → reload not correct, attempt intact
      const cm = quiz("cse312-w1-l2-quiz-committee");
      await page.fill(`${cm} input`, "C(10,3)");
      await page.click(`${cm} .row button.primary`);
      ok(/Correct/.test(await text(page, `${cm} .feedback`)), "quiz num: correct before edit");
      const att0 = (await item("cse312-w1-l2-quiz-committee")).attempts[0];
      await page.fill(`${cm} input`, "121");
      ok((await text(page, `${cm} .feedback`)) === "" && !(await page.locator(cm).evaluate((n) => n.classList.contains("is-right"))) && await page.locator(`${cm} > .why`).isHidden(), "quiz num: edit clears feedback, badge, explanation");
      let s = await item("cse312-w1-l2-quiz-committee");
      ok(s.correct === null && s.normalized === "" && s.raw === "121", `quiz num: edit clears saved grade (correct=${s.correct}, normalized="${s.normalized}")`);
      ok(s.attempts.length === 1 && JSON.stringify(s.attempts[0]) === JSON.stringify(att0), "quiz num: attempts[] untouched by the edit");
      await flushed();
      const rc = await remoteItem("cse312-w1-l2-quiz-committee");
      ok(rc.correct === null && rc.raw === "121" && rc.attempts.length === 1, "quiz num: cleared grade reached the adapter");
      // re-entering the previously graded value doesn't resurrect the grade
      await page.fill(`${cm} input`, "C(10,3)");
      ok((await item("cse312-w1-l2-quiz-committee")).correct === null && (await text(page, `${cm} .feedback`)) === "", "quiz num: re-entering the old value shows no grade without a new Check");
      await page.fill(`${cm} input`, "121");
      await flushed();

      // (b) quiz MC: correct → choose another option → cleared → reload
      const om = quiz("cse312-w1-l2-quiz-order-matters");
      await page.click(`${om} label[data-opt="study-group"]`);
      await page.click(`${om} .row button.primary`);
      ok(/Correct/.test(await text(page, `${om} .feedback`)), "quiz mc: correct before change");
      const mAtt0 = (await item("cse312-w1-l2-quiz-order-matters")).attempts[0];
      await page.click(`${om} label[data-opt="officers"]`);
      ok((await text(page, `${om} .feedback`)) === "" && await page.locator(`${om} label.right, ${om} label.wrong`).count() === 0 && await page.locator(`${om} .opts .why:visible`).count() === 0, "quiz mc: changing the choice clears feedback and marks");
      s = await item("cse312-w1-l2-quiz-order-matters");
      ok(s.correct === null && s.choice === "officers" && s.attempts.length === 1 && JSON.stringify(s.attempts[0]) === JSON.stringify(mAtt0) && mAtt0.answer.choice === "study-group", "quiz mc: saved grade cleared, attempt intact");

      // (c) MC select without Check → persisted as an ungraded draft
      const sy = quiz("cse312-w1-l2-quiz-symmetry");
      await page.click(`${sy} label[data-opt="c-7-5"]`);
      await flushed();
      ok((await remoteItem("cse312-w1-l2-quiz-symmetry")).choice === "c-7-5", "quiz mc: unchecked selection saved through the adapter as a draft");
      ok(/^Answered 2 of 10/.test(await score()), `answered counts submissions (2), not drafts: "${await score()}"`);

      // (d) wrong submission counts as answered; first-try-correct count unchanged
      const ck = quiz("cse312-w1-l2-quiz-cookies");
      await page.fill(`${ck} input`, "4^10");
      await page.click(`${ck} .row button.primary`);
      ok(/^Answered 3 of 10 · 2 correct on the first try/.test(await score()), `wrong submission increments Answered only: "${await score()}"`);
      // revealed without submitting is not "answered"
      await page.click(`${quiz("cse312-w1-l2-quiz-banana")} .row button.btn:not(.primary)`);
      ok(/^Answered 3 of 10 · 2 correct on the first try · 1 revealed without answering/.test(await score()), `reveal is not a submission: "${await score()}"`);

      await flushed();
      await reload("l2-quiz");
      ok((await page.inputValue(`${cm} input`)) === "121" && (await text(page, `${cm} .feedback`)) === "" && !(await page.locator(cm).evaluate((n) => n.classList.contains("is-right"))), "reload: edited quiz num not shown as correct");
      ok(await page.locator(`${om} label[data-opt="officers"] input`).isChecked() && await page.locator(`${om} label.right, ${om} label.wrong`).count() === 0 && (await text(page, `${om} .feedback`)) === "", "reload: changed MC choice restored, ungraded");
      ok(await page.locator(`${sy} label[data-opt="c-7-5"] input`).isChecked() && await page.locator(`${sy} label.wrong, ${sy} label.right`).count() === 0 && (await text(page, `${sy} .feedback`)) === "" && (await item("cse312-w1-l2-quiz-symmetry")).attempts.length === 0, "reload: unchecked MC selection restored, ungraded, no attempt");
      ok(/^Answered 3 of 10 · 2 correct on the first try · 1 revealed without answering/.test(await score()), `reload: counters persist: "${await score()}"`);
      ok((await item("cse312-w1-l2-quiz-committee")).attempts[0].result.correct === true, "reload: original correct attempt still in history");

      // (e) quick check: correct → edit → reload → not correct, attempt intact
      await go(page, "l2-anagrams");
      const gd = qc("cse312-w1-l2-qc-godoggy");
      await page.fill(`${gd} input`, "420");
      await page.click(`${gd} button.primary`);
      ok(/Correct: 420/.test(await text(page, `${gd} .feedback`)), "quick check: correct before edit");
      const qAtt0 = (await item("cse312-w1-l2-qc-godoggy")).attempts[0];
      await page.fill(`${gd} input`, "421");
      s = await item("cse312-w1-l2-qc-godoggy");
      ok((await text(page, `${gd} .feedback`)) === "" && s.correct === null && s.normalized === "" && s.raw === "421", "quick check: edit clears DOM and saved grade");
      await flushed();
      ok((await remoteItem("cse312-w1-l2-qc-godoggy")).correct === null, "quick check: cleared grade reached the adapter");
      await reload("l2-anagrams");
      s = await item("cse312-w1-l2-qc-godoggy");
      ok((await page.inputValue(`${gd} input`)) === "421" && !/Correct/.test(await text(page, `${gd} .feedback`)) && s.correct === null, "reload: edited quick check not shown as correct");
      ok(s.attempts.length === 1 && JSON.stringify(s.attempts[0]) === JSON.stringify(qAtt0) && qAtt0.result.correct === true, "reload: quick check attempt intact");

      // (f) problem part: correct → edit → reload; wrong submission counts as answered
      await go(page, "s1-basic");
      const prog = () => text(page, "#s1-basic .progress-text");
      const t2c = task("cse312-w1-s1-t2c-staff-line");
      await page.fill(part("cse312-w1-s1-t2c-staff-line.ans"), "13!");
      await page.click(`${t2c} .my-work button.primary`);
      ok((await text(page, `${t2c} .pill`)) === "Correct", "problem: correct before edit");
      const pAtt0 = (await item("cse312-w1-s1-t2c-staff-line")).attempts[0];
      await page.fill(part("cse312-w1-s1-t2c-staff-line.ans"), "12!");
      s = await item("cse312-w1-s1-t2c-staff-line");
      ok((await text(page, `${t2c} .pill`)) !== "Correct" && (await text(page, `${t2c} .my-work > .feedback`)) === "" && s.overall === null && s.parts["cse312-w1-s1-t2c-staff-line.ans"].correct === null && s.parts["cse312-w1-s1-t2c-staff-line.ans"].normalized === null, "problem: edit clears pill, feedback and saved part/overall grade");
      ok(/^1 of 5 answered · 0 correct on the latest check/.test(await prog()), `problem: edited-after-submit still answered, not correct: "${await prog()}"`);
      const t2a = task("cse312-w1-s1-t2a-credit-cards");
      await page.fill(part("cse312-w1-s1-t2a-credit-cards.ans"), "10^16");
      await page.click(`${t2a} .my-work button.primary`);
      ok(/^2 of 5 answered · 0 correct on the latest check/.test(await prog()), `problem: wrong submission counts as answered: "${await prog()}"`);
      await flushed();
      await reload("s1-basic");
      s = await item("cse312-w1-s1-t2c-staff-line");
      ok((await text(page, `${t2c} .pill`)) === "In progress" && (await page.inputValue(part("cse312-w1-s1-t2c-staff-line.ans"))) === "12!", "reload: edited problem not shown as correct");
      ok(s.attempts.length === 1 && JSON.stringify(s.attempts[0]) === JSON.stringify(pAtt0), "reload: problem attempt intact");
      ok(/^2 of 5 answered · 0 correct on the latest check/.test(await prog()), `reload: problem counters persist: "${await prog()}"`);
      allErrors.push(...errors.map((e) => `stale-grade: ${e}`));
      await context.close();
    }

    /* =============================================== 6d. table-driven edit invalidation over every input type in the inventory */
    {
      const inv = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../export/state-inventory.json"), "utf8"));
      const types = [...new Set(inv.items.filter((i) => i.kind !== "problem").map((i) => `${i.kind}/${i.grader}`))].sort();
      // one representative per type: [id, page, first value (graded), edited value]
      const CASES = {
        "quickcheck/exact-expression": { id: "cse312-w1-l1-qc-lunch", route: "l1-sum", good: "6+9", edit: "54" },
        "quiz/exact-expression": { id: "cse312-w1-l1-quiz-eight-runners", route: "l1-quiz", good: "P(8,3)", edit: "56" },
        "quiz/multiple-choice": { id: "cse312-w1-l1-quiz-prizes-to-students", route: "l1-quiz", good: "six-to-the-four", edit: "p-6-4" },
        "part/exact-expression": { id: "cse312-w1-s1-t2b-divisors.ans", route: "s1-basic", good: "6*3*2", edit: "10" },
        "part/formula": { id: "cse312-w1-s1-review-k-permutations.ans", route: "s1-review", good: "P(n,k)", edit: "n^k" },
        "part/yes-no": { id: "cse312-w1-s1-review-set-difference.ans", route: "s1-review", good: "no", edit: "yes" },
        "part/self-check": { id: "cse312-w1-s1-review-product-rule.ans", route: "s1-review", good: "n_1 n_2 ... n_m", edit: "n_1 + n_2" },
      };
      ok(types.every((t) => CASES[t]), `every inventory input type has an invalidation case: ${types.filter((t) => !CASES[t]).join(", ") || "all covered"}`);
      for (const t of types) {
        const c = CASES[t];
        if (!c) continue;
        const meta = inv.items.find((i) => i.id === c.id);
        ok(meta && `${meta.kind}/${meta.grader}` === t, `${t}: representative ${c.id} has that type`);
      }

      const { context, page, errors } = await newPage(browser, url, { mock: { latencyMs: 10, persistKey: "mock-table" } });
      const snap = (id) => page.evaluate((i) => window.COURSE_SITE.snapshot().items[i], id);
      const flushed = () => page.waitForFunction(() => window.COURSE_SITE.pending().length === 0, null, { timeout: 8000 });
      const covered = [];
      for (const t of types) {
        const c = CASES[t];
        if (!c) continue;
        const [kind] = t.split("/");
        const itemId = kind === "part" ? c.id.slice(0, c.id.lastIndexOf(".")) : c.id;
        const root = kind === "part" ? task(itemId) : kind === "quiz" ? quiz(itemId) : qc(itemId);
        const isMc = t === "quiz/multiple-choice", isSelf = t === "part/self-check";
        const setValue = async (v) => {
          if (isMc) await page.click(`${root} label[data-opt="${v}"]`);
          else await page.fill(kind === "part" ? part(c.id) : `${root} input`, v);
        };
        const submit = async () => {
          if (isSelf) {
            const sol = page.locator(`${root} .task-actions button`, { hasText: "solution" });
            if (await page.locator(`${root} .solution`).isHidden()) await sol.click();
            await page.locator(`${root} .self-mark button`, { hasText: "I got it" }).click();
          } else await page.click(kind === "part" ? `${root} .my-work button.primary` : kind === "quiz" ? `${root} .row button.primary` : `${root} button.primary`);
        };
        const graded = (s) => (kind === "part" ? (s.overall !== null || s.selfMark !== null || s.parts[c.id].correct !== null || s.parts[c.id].normalized !== null) : (s.correct !== null || s.normalized !== ""));
        const domClean = async () => page.evaluate(({ root, kind }) => {
          const r = document.querySelector(root);
          const fbs = [...r.querySelectorAll(".feedback, .part-fb")].map((f) => f.textContent.trim()).join("");
          const marks = r.querySelectorAll("label.right, label.wrong, input.ok, input.bad, .self-mark [aria-pressed='true']").length;
          const pill = r.querySelector(".pill");
          return !fbs && !marks && !r.classList.contains("is-right") && !(pill && /Correct|Not yet/.test(pill.textContent)) && (kind !== "quiz" || !r.querySelector(":scope > .why:not([hidden])"));
        }, { root, kind });
        // just the "Answered N" count (correct counts legitimately drop after an edit)
        const answeredText = async () => {
          if (kind === "quickcheck") return "";
          const t = await text(page, kind === "quiz" ? `#${c.route} [data-score]` : `#${c.route} .progress-text`);
          return (t.match(/Answered \d+ of \d+|\d+ of \d+ answered/) || [t])[0];
        };

        await go(page, c.route);
        const before = kind === "quickcheck" ? "" : await answeredText();
        await setValue(c.good);
        await submit();
        let s = await snap(itemId);
        ok(graded(s), `${t}: graded after submit`);
        const att = JSON.stringify(s.attempts);
        const evs = JSON.stringify(s.events);
        ok(s.attempts.length === 1, `${t}: one attempt recorded`);
        const afterSubmit = kind === "quickcheck" ? "" : await answeredText();

        await setValue(c.edit);
        s = await snap(itemId);
        ok(!graded(s), `${t}: edit clears the current grade${kind === "part" ? "/selfMark" : ""} in the snapshot`);
        ok(isMc ? s.choice === c.edit : kind === "part" ? s.parts[c.id].raw === c.edit : s.raw === c.edit, `${t}: edit keeps the raw draft`);
        ok(JSON.stringify(s.attempts) === att && JSON.stringify(s.events) === evs, `${t}: attempts[] and events[] untouched by the edit`);
        ok(await domClean(), `${t}: DOM feedback, marks, badge and aria-pressed cleared`);
        if (kind !== "quickcheck") ok((await answeredText()) === afterSubmit && afterSubmit !== before, `${t}: Answered still counts the submission ("${afterSubmit}")`);

        // re-entering the old value doesn't bring the grade back
        await setValue(c.good);
        s = await snap(itemId);
        ok(!graded(s) && await domClean(), `${t}: re-entering the graded value shows no grade without a new submit`);
        await setValue(c.edit);
        await flushed();
        await page.reload();
        await page.waitForFunction(() => document.documentElement.dataset.ready === "1");
        await go(page, c.route);
        s = await snap(itemId);
        ok(!graded(s) && await domClean(), `${t}: after reload, not shown as graded`);
        ok(isMc ? await page.locator(`${root} label[data-opt="${c.edit}"] input`).isChecked() : (await page.inputValue(kind === "part" ? part(c.id) : `${root} input`)) === c.edit, `${t}: after reload, draft restored`);
        ok(JSON.stringify(s.attempts) === att, `${t}: after reload, attempt unchanged`);
        if (kind !== "quickcheck") ok((await answeredText()) === afterSubmit, `${t}: after reload, Answered unchanged`);
        covered.push(t);
      }
      console.log(`  invalidation table covered: ${covered.join(", ")}`);
      allErrors.push(...errors.map((e) => `table: ${e}`));
      await context.close();
    }

    /* =============================================== 6c. race: type/select a draft and reveal immediately */
    {
      const { context, page, errors } = await newPage(browser, url, { mock: { latencyMs: 40, persistKey: "mock-race" }, hash: "l1-quiz" });
      const item = (id) => page.evaluate((i) => window.COURSE_SITE.snapshot().items[i], id);
      const reload = async (hash) => { await page.reload(); await page.waitForFunction(() => document.documentElement.dataset.ready === "1"); await go(page, hash); };

      // numeric quiz: keystrokes then Show answer with no wait in between
      const ls = quiz("cse312-w1-l1-quiz-lunch-special");
      await page.locator(`${ls} input`).pressSequentially("4+3", { delay: 0 });
      await page.click(`${ls} .row button.btn:not(.primary)`, { noWaitAfter: true });
      ok((await page.inputValue(`${ls} input`)) === "4+3", "race num: input keeps the draft after an immediate reveal");
      let s = await item("cse312-w1-l1-quiz-lunch-special");
      ok(s.raw === "4+3" && s.attempts.length === 0 && s.events.filter((e) => e.type === "reveal").length === 1 && s.revealed === true, "race num: snapshot has the draft; reveal is an event, not an attempt");

      // MC quiz: change selection then Show answer immediately
      const ov = quiz("cse312-w1-l1-quiz-sum-rule-overlap");
      await page.click(`${ov} label[data-opt="always"]`, { noWaitAfter: true });
      await page.click(`${ov} label[data-opt="equal-sizes"]`, { noWaitAfter: true });
      await page.click(`${ov} .row button.btn:not(.primary)`, { noWaitAfter: true });
      ok(await page.locator(`${ov} label[data-opt="equal-sizes"] input`).isChecked(), "race mc: selection kept after an immediate reveal");
      s = await item("cse312-w1-l1-quiz-sum-rule-overlap");
      ok(s.choice === "equal-sizes" && s.attempts.length === 0 && s.events.filter((e) => e.type === "reveal").length === 1, "race mc: snapshot has the selection; reveal is an event, not an attempt");

      // problem part: type then reveal a hint immediately
      await go(page, "s1-basic");
      const t2b = task("cse312-w1-s1-t2b-divisors");
      await page.locator(part("cse312-w1-s1-t2b-divisors.ans")).pressSequentially("6*3*", { delay: 0 });
      await page.locator(`${t2b} .task-actions button`, { hasText: "hint" }).click({ noWaitAfter: true });
      ok((await page.inputValue(part("cse312-w1-s1-t2b-divisors.ans"))) === "6*3*", "race part: input keeps the draft after an immediate hint");
      s = await item("cse312-w1-s1-t2b-divisors");
      ok(s.parts["cse312-w1-s1-t2b-divisors.ans"].raw === "6*3*" && s.attempts.length === 0 && s.events.filter((e) => e.type === "hint").length === 1 && s.hintsRevealed === 1, "race part: snapshot has the draft; hint is an event, not an attempt");

      await page.waitForFunction(() => window.COURSE_SITE.pending().length === 0, null, { timeout: 8000 });
      await reload("l1-quiz");
      ok((await page.inputValue(`${ls} input`)) === "4+3" && /Answer: 12/.test(await text(page, `${ls} .feedback`)), "race num: reload restores the draft and the revealed answer");
      ok(await page.locator(`${ov} label[data-opt="equal-sizes"] input`).isChecked() && await page.locator(`${ov} label[data-correct].right`).count() === 1 && await page.locator(`${ov} label.wrong`).count() === 0, "race mc: reload restores the selection, ungraded, with the reveal");
      await go(page, "s1-basic");
      ok((await page.inputValue(part("cse312-w1-s1-t2b-divisors.ans"))) === "6*3*" && await page.locator(`${t2b} ol.hints li`).first().isVisible(), "race part: reload restores the draft and the hint");
      const counts = await page.evaluate(() => ["cse312-w1-l1-quiz-lunch-special", "cse312-w1-l1-quiz-sum-rule-overlap", "cse312-w1-s1-t2b-divisors"].map((i) => window.COURSE_SITE.snapshot().items[i].attempts.length));
      ok(counts.every((c) => c === 0), `race: no attempts created by drafts or reveals (${counts})`);
      allErrors.push(...errors.map((e) => `race: ${e}`));
      await context.close();
    }

    /* =============================================== 7. screenshots (desktop + mobile) */
    for (const [label, viewport] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
      const { context, page, errors } = await newPage(browser, url, { viewport });
      const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}-${label}.png`) });
      await go(page, "home");
      await page.fill("#hero-slots input >> nth=0", "T");
      for (const [i, ch] of ["A", "N", "G", "O"].entries()) await page.fill(`#hero-slots input >> nth=${i + 1}`, ch);
      await shot("overview");
      await go(page, "l2-stars");
      await page.locator("#sb-bins button", { hasText: "+" }).nth(1).click();
      await page.locator("#l2-stars .panel.enum button", { hasText: "Run all" }).click();
      await page.waitForFunction(() => /Checked all/.test(document.querySelector("#l2-stars .enum-stats").textContent));
      await page.locator("#stars").scrollIntoViewIfNeeded();
      await shot("lecture-module-interactive");
      await go(page, "l2-anagrams");
      for (let i = 0; i < 3; i++) await page.click("#seattle-next");
      await page.locator("#seattle").scrollIntoViewIfNeeded();
      await shot("lecture-stepper");
      await go(page, "s1-more");
      const t5 = task("cse312-w1-s1-t5-hbcdefga");
      await page.fill(part("cse312-w1-s1-t5-hbcdefga.ans"), "8!-2*7!");
      await page.click(`${t5} .my-work button.primary`);
      await page.locator(`${t5} .task-actions button`, { hasText: "hint" }).click();
      await page.locator(`${t5} .my-work > .feedback`).scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -140));
      await shot("problem-feedback");
      await go(page, "l2-quiz");
      await page.click(`${quiz("cse312-w1-l2-quiz-committee")} input`).catch(() => {});
      await page.fill(`${quiz("cse312-w1-l2-quiz-committee")} input`, "720");
      await page.click(`${quiz("cse312-w1-l2-quiz-committee")} .row button.primary`);
      await page.click(`${quiz("cse312-w1-l2-quiz-order-matters")} label[data-opt="officers"]`);
      await page.click(`${quiz("cse312-w1-l2-quiz-order-matters")} .row button.primary`);
      await page.locator(quiz("cse312-w1-l2-quiz-committee")).scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -100));
      await shot("quiz");
      allErrors.push(...errors.map((e) => `screens ${label}: ${e}`));
      await context.close();
    }
    {
      const { context, page } = await newPage(browser, url, { viewport: MOBILE, mock: { latencyMs: 30, failSaves: true, persistKey: "mock-shot" }, hash: "s1-basic" });
      const t2a = task("cse312-w1-s1-t2a-credit-cards");
      await page.fill(`${t2a} textarea`, "15 free digits, the 16th is determined");
      await page.fill(part("cse312-w1-s1-t2a-credit-cards.ans"), "10^16");
      await page.click(`${t2a} .my-work button.primary`);
      await page.locator(".toast.error").first().waitFor({ timeout: 8000 });
      await sleep(450);
      await page.screenshot({ path: path.join(SHOTS, "save-failure-toast-mobile.png") });
      await context.close();
    }

    ok(allErrors.length === 0, `no console errors, page errors or failed requests:\n    ${allErrors.join("\n    ")}`);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`browser: ${pass} passed, ${fail} failed`);
  if (fail) { console.log(failures.map((f) => `  FAIL ${f}`).join("\n")); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
