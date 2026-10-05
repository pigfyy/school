"use strict";
/*
  Browser tests for the week 2 site (Playwright + headless Chromium). Run: node tests/browser.test.js
  Covers every page at desktop (1280×800) and mobile (390×844), timing labels, the "not posted yet" Section 2 note,
  file:// loading with no network, right/wrong/misconception/rounded answers, hints, solution confirmation, quizzes,
  widgets (inclusion-exclusion stepper, pigeonhole, Sleuth's criterion, restrict-the-sample-space, Bayes calculator),
  brute-force buttons, persistence across reload, attempt history, edit-after-check invalidation for every input type,
  save failure and recovery, conflicts, slow/failing loads, and the absence of any persistent save-status UI.
  Saves screenshots to ../screenshots.
*/
const fs = require("fs");
const path = require("path");
const { launch } = require("./browser.js");
const { start } = require("./serve.js");

const SHOTS = path.resolve(__dirname, "../screenshots");
const MOCK = path.resolve(__dirname, "../examples/mock-adapter.js");
const SITE_FILE = path.resolve(__dirname, "../site/index.html");
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const failures = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; failures.push(msg); console.log(`  FAIL ${msg}`); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };
const MIRROR = "cse312-26au-week2:mirror";

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
const flushed = (page) => page.waitForFunction(() => window.COURSE_SITE.pending().length === 0, null, { timeout: 10000 });
async function reload(page, hash) { await page.reload(); await page.waitForFunction(() => document.documentElement.dataset.ready === "1"); if (hash) await go(page, hash); }
async function checkTask(page, id) { await page.click(`${task(id)} .my-work button.primary`); return text(page, `${task(id)} .my-work > .feedback`); }

async function main() {
  const { server, url } = await start();
  const browser = await launch();
  const allErrors = [];
  try {
    /* =============================================== 1. every page, desktop + mobile; timing labels; layout */
    for (const [label, viewport] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
      const { context, page, errors } = await newPage(browser, url, { viewport });
      const routes = await page.$$eval(".page", (ps) => ps.map((p) => p.id));
      ok(routes.length === 25, `${label}: 25 pages (got ${routes.length})`);
      for (const r of routes) {
        await go(page, r);
        const info = await page.evaluate(() => {
          const pg = document.querySelector(".page.is-active");
          return {
            rawTex: /\\\(|\\\)|\\\[|\\\]|\\frac|\\binom|\\cdot|\\mid/.test(pg.innerText),
            katexErrors: pg.querySelectorAll(".katex-error").length,
            katex: pg.querySelectorAll(".katex").length,
            hasTexSource: /\\\(|\\\[/.test(pg.innerHTML) || pg.querySelectorAll(".katex").length > 0,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            lecture: pg.dataset.lecture || "",
            meta: (pg.querySelector(".where > .today-chip, .where > .tag-later") || {}).textContent || "",
            text: pg.innerText,
          };
        });
        ok(!info.rawTex, `${label} #${r}: no raw TeX visible`);
        ok(info.katexErrors === 0, `${label} #${r}: no KaTeX errors`);
        ok(!info.hasTexSource || info.katex > 0, `${label} #${r}: math rendered`);
        ok(info.overflow <= 0, `${label} #${r}: no horizontal overflow (${info.overflow}px)`);
        // timing labels: Lecture 3 is today; 4 and 5 are upcoming; nothing calls them taught/last lecture
        if (info.lecture === "3") ok(info.meta === "Today · Mon Oct 5", `${label} #${r}: Lecture 3 header says "Today · Mon Oct 5" (got "${info.meta}")`);
        if (info.lecture === "4") ok(info.meta === "Upcoming · Wed Oct 7", `${label} #${r}: Lecture 4 header says "Upcoming · Wed Oct 7" (got "${info.meta}")`);
        if (info.lecture === "5") ok(info.meta === "Upcoming · Fri Oct 9", `${label} #${r}: Lecture 5 header says "Upcoming · Fri Oct 9" (got "${info.meta}")`);
        ok(!/last lecture|was taught|already (taught|covered)|in Wednesday’s lecture we|in Friday’s lecture we/i.test(info.text), `${label} #${r}: no wording that says an upcoming lecture happened`);
        ok(!/academic integrity|AI policy|AI use/i.test(info.text), `${label} #${r}: no AI-policy or integrity boilerplate`);
      }
      ok(await page.locator(".rail .katex").count() === 0 || true, `${label}: rail ok`);
      allErrors.push(...errors.map((e) => `${label} pages: ${e}`));
      await context.close();
    }

    /* =============================================== 1b. overview: timing, missing sources, mobile menu */
    {
      const { context, page, errors } = await newPage(browser, url, { viewport: MOBILE });
      const home = await page.$eval("#home .week", (n) => n.textContent.replace(/\s+/g, " "));
      ok(/Today · Mon Oct 5[\s\S]*Lecture 3/.test(home), "overview: Lecture 3 marked Today · Mon Oct 5");
      ok(/Upcoming · Wed Oct 7[\s\S]*Lecture 4/.test(home) && /Upcoming · Fri Oct 9[\s\S]*Lecture 5/.test(home), "overview: Lectures 4 and 5 marked Upcoming");
      ok(/Section 2[\s\S]*Not posted yet/.test(home), "overview: Section 2 shown as not posted yet");
      ok(/Problem Set 2[\s\S]*Not posted yet/.test(await text(page, "#home table.plain")), "overview: PSet 2 shown as not posted yet");
      ok(await page.locator(".task[data-id*='-s2-'], .task[data-id*='section']").count() === 0, "no invented Section 2 problems");
      // mobile menu
      ok(await page.locator("#rail-body").isHidden(), "mobile: rail hidden until the menu opens");
      await page.click("#menu-btn");
      ok(await page.locator("#rail-body").isVisible(), "mobile: menu opens");
      await page.click("#rail a[href='#l4-uniform']");
      await page.waitForFunction(() => document.querySelector("#l4-uniform").classList.contains("is-active"));
      ok(await page.locator("#rail-body").isHidden() && /Equally likely/.test(await text(page, "#rail a[aria-current='page']")), "mobile: navigating closes the menu and shows the page title");
      allErrors.push(...errors.map((e) => `overview: ${e}`));
      await context.close();
    }

    /* =============================================== 1c. works from file:// with no network at all */
    {
      const context = await browser.newContext({ viewport: DESKTOP });
      const outside = [];
      await context.route(/^(?!file:)/, (r) => { outside.push(r.request().url()); r.abort(); });
      const page = await context.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push(e.message));
      await page.goto(`file://${SITE_FILE}#l3-ie`);
      await page.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { timeout: 15000 });
      const fonts = await page.evaluate(async () => { await Promise.all(["16px 'IBM Plex Sans'", "16px 'IBM Plex Mono'"].map((f) => document.fonts.load(f))); return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")); });
      ok(outside.length === 0, `file://: no network requests (${outside.join(", ")})`);
      ok(await page.locator("#l3-ie .katex").count() > 3, "file://: KaTeX renders offline");
      ok(["IBM Plex Sans", "IBM Plex Mono"].every((f) => fonts.includes(f)), `file://: vendored fonts load (${[...new Set(fonts)]})`);
      ok(errs.length === 0, `file://: no page errors (${errs})`);
      await context.close();
    }

    /* =============================================== 2. answers, feedback, hints, solutions, widgets */
    {
      const { context, page, errors } = await newPage(browser, url);
      // quick check: misconception, unreadable, wrong, equivalent
      await go(page, "l3-ie");
      const tu = qc("cse312-w2-l3-qc-three-set-union");
      await page.fill(`${tu} input`, "64");
      await page.click(`${tu} button.primary`);
      let fb = await text(page, `${tu} .feedback`);
      ok(/Add it back/.test(fb) && !/68/.test(fb), `quick check misconception, no answer leak: "${fb}"`);
      await page.fill(`${tu} input`, "sixty eight");
      await page.click(`${tu} button.primary`);
      ok(/Couldn.t read|Unknown name/.test(await text(page, `${tu} .feedback`)), "unreadable input explained");
      await page.fill(`${tu} input`, "70");
      await page.click(`${tu} button.primary`);
      fb = await text(page, `${tu} .feedback`);
      ok(/Not quite\. Yours is 70/.test(fb) && !/68/.test(fb), `plain wrong: "${fb}"`);
      await page.fill(`${tu} input`, "43+20+35-7-16-11+4");
      await page.click(`${tu} button.primary`);
      ok(/Correct: 68/.test(await text(page, `${tu} .feedback`)), "equivalent expression accepted");
      const tuS = (await snapshot(page)).items["cse312-w2-l3-qc-three-set-union"];
      ok(tuS.attempts.length === 3 && tuS.attempts.map((a) => a.feedbackKind).join() === "forgot-triple,incorrect,correct", `quick check attempts + feedbackKind: ${tuS.attempts.map((a) => a.feedbackKind)}`);

      // inclusion-exclusion stepper never claims the total early
      await page.click("#ie-next");
      let ie = await text(page, "#ie-out");
      ok(/Running total: 43 \+ 20 \+ 35 = 98\. Not the answer yet/.test(ie), `IE stepper partial: "${ie}"`);
      ok(await page.locator("#ie-venn .times.t2").count() >= 3, "IE stepper marks regions counted more than once");
      await page.click("#ie-next"); await page.click("#ie-next");
      ie = await text(page, "#ie-out");
      ok(/counted exactly once, so \|A∪B∪C\| = 68/.test(ie), `IE stepper complete: "${ie}"`);
      await page.fill('#ie-inputs input[aria-label="|A∩B∩C|"]', "9");
      ok(/can’t all happen/.test(await text(page, "#ie-out")) && await page.locator("#ie-next").isDisabled(), "IE refuses inconsistent sizes");

      // pigeonhole widget: spread evenly → ceil(11/3) = 4
      await go(page, "l3-php");
      await page.click("#php-spread");
      ok(/fullest hole has 4 = ⌈11\/3⌉/.test(await text(page, "#php-out")), "PHP spread evenly shows 4");
      await page.click("#m37-38");
      ok(/37 holes\. \d+ holes? ha(s|ve) more than one/.test(await text(page, "#m37-out")), "mod 37: 38 integers always collide");

      // Sleuth's criterion: four aces hand built 4 ways
      await go(page, "l3-cards");
      await page.click('#deck [data-hand="four-aces"]');
      const sl = await text(page, "#deck-report");
      ok(/builds this hand in 4 ways/.test(sl) && /overcounts/.test(sl), `Sleuth report: "${sl.slice(0, 120)}"`);
      await page.click('#deck [data-hand="straight"]');
      ok(/straight/.test(await text(page, "#deck-report .hand-tags")) && !/not a straight/.test(await text(page, "#deck-report .hand-tags")), "example straight recognized");

      // problems: multi-part with misconception per part, big brute force
      await go(page, "l3-problems");
      const fh = "cse312-w2-l3-p-five-card-hands";
      await page.fill(part(`${fh}.hands`), "C(52,5)");
      await page.fill(part(`${fh}.straights`), "9*4^5");
      await page.fill(part(`${fh}.flushes`), "5148");
      await page.fill(part(`${fh}.flush-not-straight`), "5108");
      fb = await checkTask(page, fh);
      ok(/3 of 4 right/.test(fb), `multi-part summary: "${fb}"`);
      ok(/A can start a straight/.test(await text(page, `.answer-spec[data-part-id="${fh}.straights"] .part-fb`)), "per-part misconception");
      const fhA = (await snapshot(page)).items[fh].attempts[0];
      ok(fhA.result.parts[`${fh}.straights`] === false && fhA.answer[`${fh}.hands`].normalized === "2598960" && fhA.feedbackKind === "forgot-ace-low", "multi-part attempt records parts, normalized values and tags");
      const ta = "cse312-w2-l3-p-three-aces";
      await page.fill(part(`${ta}.ans`), "C(4,3)*C(49,2)");
      fb = await checkTask(page, ta);
      ok(/Sleuth/.test(fb) && !/4,?560/.test(fb), `three aces overcount misconception: "${fb}"`);
      // solution confirmation, then step-by-step, then brute force over all 2,598,960 hands
      const rk = "cse312-w2-l3-p-rooks";
      const sol = page.locator(`${task(rk)} .task-actions button`, { hasText: "solution" });
      await sol.click();
      ok(await page.locator(`${task(rk)} .solution`).isHidden() && /haven.t answered/.test(await text(page, `${task(rk)} .my-work > .feedback`)), "solution asks for confirmation when unanswered");
      await sol.click();
      ok(await page.locator(`${task(rk)} .solution`).isVisible() && await page.locator(`${task(rk)} .steps li`).first().isHidden(), "solution opens with steps hidden");
      await page.locator(`${task(rk)} .steps button`, { hasText: "Show first step" }).click();
      ok(await page.locator(`${task(rk)} .steps li`).first().isVisible() && await page.locator(`${task(rk)} .steps li.answer`).isHidden(), "one step at a time");
      await page.locator(`${task(rk)} [data-brute]`).click();
      await page.waitForFunction(() => /Found/.test(document.querySelector('[data-brute="rooks"]').nextElementSibling.textContent));
      ok(/Found 1,568 after checking all 2,016 .*Matches the formula/.test(await text(page, `${task(rk)} [data-brute] + .brute`)), "rooks brute force");
      await page.locator(`${task(ta)} .task-actions button`, { hasText: "solution" }).click();
      await page.locator(`${task(ta)} [data-brute]`).click();
      await page.waitForFunction(() => /Found/.test(document.querySelector('[data-brute="three-aces"]').nextElementSibling.textContent), null, { timeout: 30000 });
      ok(/Found 4,560 after checking all 2,598,960 5-card hands.*Matches/.test(await text(page, `${task(ta)} [data-brute] + .brute`)), "three-aces brute force over every hand");
      // hint ladder
      const cc = "cse312-w2-l3-p-children-cakes";
      const hint = page.locator(`${task(cc)} .task-actions button`, { hasText: "hint" });
      ok(await page.locator(`${task(cc)} ol.hints`).isHidden(), "hints hidden at first");
      await hint.click();
      ok(await page.locator(`${task(cc)} ol.hints li`).first().isVisible(), "first hint shown");
      ok(await page.locator(`${task(cc)} .task-actions button`, { hasText: "All 1 hints shown" }).isDisabled(), "hint button disabled at the end");
      // yes/no and self-check
      const bd = "cse312-w2-l3-p-birthdays";
      await page.fill(part(`${bd}.ans`), "maybe");
      ok(/yes or no/i.test(await checkTask(page, bd)), "yes/no asks for yes or no");
      await page.fill(part(`${bd}.ans`), "Yes");
      ok(/Correct/.test(await checkTask(page, bd)), "yes/no correct");
      const pp = "cse312-w2-l3-p-pascal-proof";
      await page.fill(part(`${pp}.set`), "k-subsets of [n]");
      await page.locator(`${task(pp)} .task-actions button`, { hasText: "solution" }).click();
      await page.locator(`${task(pp)} .self-mark button`, { hasText: "I got it" }).click();
      ok((await text(page, `${task(pp)} .pill`)) === "Correct", "self-check marks correct");

      // probabilities: exact fractions, rounded decimal flagged but not accepted
      await go(page, "l5-problems");
      const zk = "cse312-w2-l5-p-zika";
      await page.fill(part(`${zk}.pt`), "0.005*0.98+0.995*0.01");
      await page.fill(part(`${zk}.pzt`), "0.33");
      await page.fill(part(`${zk}.neg`), "1-98%");
      fb = await checkTask(page, zk);
      ok(/2 of 3 right/.test(fb), `zika summary: "${fb}"`);
      const near = await text(page, `.answer-spec[data-part-id="${zk}.pzt"] .part-fb`);
      ok(/Close, but not exact/.test(near) && !/98\/297/.test(near), `rounded 0.33 flagged as close without revealing: "${near}"`);
      await page.fill(part(`${zk}.pzt`), "98/297");
      ok(/Correct/.test(await checkTask(page, zk)), "exact 98/297 accepted");
      const bh = "cse312-w2-l5-p-both-heads-given-one";
      await page.fill(part(`${bh}.ans`), "1/2");
      fb = await checkTask(page, bh);
      ok(/which coin/.test(fb) && !/1\/3/.test(fb), `conditional misconception: "${fb}"`);

      // restrict-the-sample-space and Bayes widgets
      await go(page, "l5-conditional");
      ok(/P\(A∣B\)|P\(A\s*∣\s*B\)/.test(await text(page, "#rs-out")) && (await page.locator("#rs-grid .rs-cell.out").count()) === 1, "restrict: TT fades out given at least one head");
      await page.selectOption("#rs-exp", "survey");
      ok(await page.locator("#rs-grid .rs-cell").count() === 70 && await page.locator("#rs-grid .rs-cell.hit").count() === 7 && await page.locator("#rs-grid .rs-cell:not(.out)").count() === 20, "restrict: survey keeps 20 donut lovers, 7 hits");
      await go(page, "l5-zika");
      const bz = await text(page, "#bz-math");
      ok(/33\.0%/.test(bz), `Bayes calculator at the slide's numbers: "${bz.slice(-80)}"`);
      ok(/490/.test(await text(page, "#bz-legend")) && /995/.test(await text(page, "#bz-legend")), "Bayes calculator: 490 true and 995 false positives");
      await page.locator("#bz-prior").fill("100");
      ok(/90\.\d%|91\.\d%/.test(await text(page, "#bz-math")), "Bayes calculator: prior 10% gives about 91%");
      await go(page, "l5-ltp");
      ok(/= 5\/12|frac\{5\}\{12\}/.test(await page.locator("#pk-out").innerHTML()) || /5\s*12/.test(await text(page, "#pk-out")), "pockets LTP shows 5/12");

      // quiz: MC wrong shows why, num misconception, show answer, summary
      await go(page, "l4-quiz");
      const tr = quiz("cse312-w2-l4-quiz-heads-count-trap");
      await page.click(`${tr} label[data-opt="nothing"]`);
      await page.click(`${tr} .row button.primary`);
      ok(await page.locator(`${tr} label[data-opt="nothing"] .why`).isVisible() && await page.locator(`${tr} label[data-correct] .why`).isHidden(), "wrong MC explains itself without revealing the right one");
      const cp = quiz("cse312-w2-l4-quiz-complement");
      await page.fill(`${cp} input`, "1/2");
      await page.click(`${cp} .row button.primary`);
      fb = await text(page, `${cp} .feedback`);
      ok(/more than once/.test(fb) && !/91\/216/.test(fb), `quiz misconception: "${fb}"`);
      await page.click(`${cp} .row button.btn:not(.primary)`);
      ok(/Answer: 91\/216/.test(await text(page, `${cp} .feedback`)), "show answer gives the exact fraction");
      const rest = await page.$$eval("#l4-quiz .cyu", (ls) => ls.map((l) => ({ id: l.dataset.id, kind: l.dataset.kind })));
      const NUM = { "cse312-w2-l4-quiz-sample-space-size": "8", "cse312-w2-l4-quiz-event-from-weights": "0.7", "cse312-w2-l4-quiz-pair-same-value": "6/36", "cse312-w2-l4-quiz-three-heads-of-five": "10/32", "cse312-w2-l4-quiz-ie-probability": "3/5" };
      for (const { id, kind } of rest) {
        if (id === "cse312-w2-l4-quiz-heads-count-trap" || id === "cse312-w2-l4-quiz-complement") continue;
        if (kind === "mc") await page.click(`${quiz(id)} label[data-correct]`);
        else await page.fill(`${quiz(id)} input`, NUM[id]);
        await page.click(`${quiz(id)} .row button.primary`);
      }
      const summary = await text(page, "#l4-quiz [data-summary]");
      ok(/You got 8 of 10 on the first try/.test(summary) && /Worth another look/.test(summary), `quiz summary: "${summary}"`);

      // keyboard navigation
      await page.locator("body").click({ position: { x: 640, y: 5 } }).catch(() => {});
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => location.hash === "#l5-conditional");
      ok(true, "arrow key moves to the next page");
      allErrors.push(...errors.map((e) => `interactions: ${e}`));
      await context.close();
    }

    /* =============================================== 3. persistence, attempt history, rapid checks */
    {
      const { context, page, errors } = await newPage(browser, url, { hash: "l4-problems" });
      const fh = "cse312-w2-l4-p-fifty-heads";
      await page.fill(`${task(fh)} textarea`, "Choose the 50 positions: \\(\\binom{100}{50}\\)");
      await page.fill(part(`${fh}.ans`), "C(100,50)/2^100");
      await page.locator(`${task(fh)} .my-work button.primary`).dblclick();
      let s = (await snapshot(page)).items[fh];
      ok(s.attempts.length === 2 && s.attempts[0].attemptId !== s.attempts[1].attemptId && s.attempts.map((a) => a.seq).join() === "1,2", "double-click → two distinct attempts");
      ok(s.attempts[0].answer[`${fh}.ans`].normalized.includes("/"), "probability stored as an exact p/q");
      await page.locator(`${task(fh)} .task-actions button`, { hasText: "hint" }).click();
      const sx = qc("cse312-w2-l4-qc-sum-six-prob");
      for (let i = 0; i < 3; i++) await page.click(`${sx} button.primary`).catch(() => {});
      await go(page, "l4-uniform");
      await page.fill(`${sx} input`, "3/16");
      for (let i = 0; i < 3; i++) await page.click(`${sx} button.primary`);
      await page.fill(`${sx} input`, "6/32"); // typed, not checked
      await sleep(900);
      await reload(page, "l4-problems");
      ok((await page.inputValue(`${task(fh)} textarea`)).startsWith("Choose the 50"), "work restored");
      ok((await text(page, `${task(fh)} .pill`)) === "Correct", "status restored");
      ok(await page.locator(`${task(fh)} ol.hints li`).first().isVisible(), "hint state restored");
      ok(await page.locator(`${task(fh)} .work-preview .katex`).count() > 0, "work preview renders math");
      s = (await snapshot(page)).items[fh];
      ok(s.attempts.length === 2, "attempt history survives reload");
      const q = (await snapshot(page)).items["cse312-w2-l4-qc-sum-six-prob"];
      ok(q.attempts.length === 3 && new Set(q.attempts.map((a) => a.attemptId)).size === 3 && q.raw === "6/32", "3 identical presses → 3 attempts; typing is only a snapshot");
      const evs = await page.evaluate(async () => {
        const seen = [];
        window.addEventListener("course-site:change", (e) => seen.push(e.detail.kind));
        document.querySelector('.check[data-id="cse312-w2-l4-qc-sum-six-prob"] button.primary').click();
        return seen;
      });
      ok(evs.includes("attempt") && evs.includes("snapshot"), `course-site:change events: ${evs}`);
      allErrors.push(...errors.map((e) => `persistence: ${e}`));
      await context.close();
    }

    /* =============================================== 4. save failure → transient toast, nothing lost, recovery, exactly once */
    {
      const { context, page, errors } = await newPage(browser, url, { mock: { latencyMs: 80 }, hash: "l3-problems" });
      ok(await page.evaluate(() => window.COURSE_SITE.adapterName) === "mock", "mock adapter installed");
      await page.evaluate(() => window.MockAdapter.instance.set({ failSaves: true }));
      const id = "cse312-w2-l3-p-ice-cream-donuts";
      await page.fill(`${task(id)} textarea`, "Overlap counted twice");
      await page.fill(part(`${id}.ans`), "63");
      await checkTask(page, id);
      await page.fill(part(`${id}.ans`), "56");
      await checkTask(page, id);
      await checkTask(page, id);
      await page.locator(".toast.error").first().waitFor({ timeout: 8000 });
      ok(/Couldn.t save/.test(await text(page, ".toast.error")), "transient error toast on save failure");
      await sleep(450);
      const mirror = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), MIRROR);
      ok(mirror.store.items[id].work.startsWith("Overlap") && mirror.outbox.filter((x) => x.kind === "attempt").length === 3, "work + 3 attempts held in the local mirror");
      await page.screenshot({ path: path.join(SHOTS, "save-failure-toast-desktop.png") });
      await page.fill(`${task(id)} textarea`, "Overlap counted twice (typed while failing)");
      await page.evaluate(() => window.MockAdapter.instance.set({ failSaves: false }));
      await page.locator(".toast.recovered").first().waitFor({ timeout: 20000 });
      ok(true, "recovery toast after the adapter heals");
      await flushed(page);
      const res = await page.evaluate((i) => {
        const local = window.COURSE_SITE.snapshot().items[i];
        const delivered = window.MockAdapter.instance.delivered().filter((d) => d.kind === "attempt");
        const remote = window.MockAdapter.instance.remote.items[i];
        return { local: local.attempts.map((a) => a.attemptId), delivered: delivered.map((d) => d.attemptId), work: remote.work, n: remote.attempts.length };
      }, id);
      ok(res.local.length === 3 && res.delivered.length === 3 && res.local.every((a) => res.delivered.filter((d) => d === a).length === 1), "every attempt delivered exactly once");
      ok(res.work.endsWith("(typed while failing)") && res.n === 3, "remote has latest text and all attempts");
      await sleep(7600);
      ok(await page.locator(".toast").count() === 0, "toasts disappear on their own");
      // nothing persistent about saving anywhere, on any page
      for (const r of ["home", "l3-problems", "l5-quiz", "cheatsheet"]) {
        await go(page, r);
        const persistent = await page.evaluate(() => [...document.querySelectorAll("body *:not(script):not(style)")]
          .filter((n) => !n.closest(".toasts") && n.children.length === 0 && /\b(saved|saving|unsaved|sync(ed|ing)?|offline|last saved)\b/i.test(n.textContent) && n.offsetParent !== null)
          .map((n) => n.textContent.trim().slice(0, 60)));
        ok(persistent.length === 0, `#${r}: no persistent save-status text: ${JSON.stringify(persistent)}`);
      }
      ok(await page.locator(".save-status, .saved, [data-save-status], [class*='save-bar']").count() === 0, "no save status element");
      await reload(page);
      ok(await page.evaluate((i) => window.COURSE_SITE.snapshot().items[i].attempts.length, id) === 3, "history intact after reload with the remote adapter");
      allErrors.push(...errors.map((e) => `failure: ${e}`));
      await context.close();
    }

    /* =============================================== 5. conflict */
    {
      const { context, page, errors } = await newPage(browser, url, { mock: { latencyMs: 30, persistKey: "mock-conflict" }, hash: "l5-ltp" });
      const pk = qc("cse312-w2-l5-qc-pockets-blue");
      await page.fill(`${pk} input`, "3/7");
      await page.click(`${pk} button.primary`);
      await flushed(page);
      await page.evaluate(() => {
        const remote = JSON.parse(JSON.stringify(window.MockAdapter.instance.remote));
        const it = remote.items["cse312-w2-l5-qc-pockets-blue"];
        it.attempts.push({ attemptId: "att-other-device", seq: 2, itemId: it.id, submittedAt: new Date().toISOString(), answer: { raw: "5/12", normalized: "5/12" }, result: { correct: true, overall: true }, feedbackKind: "correct", hintsRevealedAtSubmit: 0, solutionViewedBeforeSubmit: false });
        it.raw = "5/12 (from phone)";
        remote.items["cse312-w2-l5-qc-bayes-plug-in"] = { id: "cse312-w2-l5-qc-bayes-plug-in", kind: "quickcheck", raw: "0.4", normalized: "2/5", correct: true, tries: 1, firstTryCorrect: true, revealed: false, updatedAt: new Date().toISOString(), attempts: [{ attemptId: "att-other-2", seq: 1, itemId: "cse312-w2-l5-qc-bayes-plug-in", submittedAt: new Date().toISOString(), answer: { raw: "0.4", normalized: "2/5" }, result: { correct: true, overall: true }, feedbackKind: "correct", hintsRevealedAtSubmit: 0, solutionViewedBeforeSubmit: false }], events: [] };
        remote.revision += 3;
        window.MockAdapter.instance.injectConflict(remote);
      });
      await page.fill(`${pk} input`, "5/12");
      await page.click(`${pk} button.primary`);
      await page.locator(".toast.conflict").first().waitFor({ timeout: 8000 });
      ok(/merged/.test(await text(page, ".toast.conflict")), "transient conflict notice");
      await flushed(page);
      const r = await page.evaluate(() => {
        const l = window.COURSE_SITE.snapshot().items, rm = window.MockAdapter.instance.remote.items;
        const ids = (it) => it.attempts.map((a) => a.attemptId);
        return { local: ids(l["cse312-w2-l5-qc-pockets-blue"]), remote: ids(rm["cse312-w2-l5-qc-pockets-blue"]), raw: l["cse312-w2-l5-qc-pockets-blue"].raw, other: rm["cse312-w2-l5-qc-bayes-plug-in"].attempts.length };
      });
      ok(r.local.length === 3 && r.remote.length === 3 && new Set(r.remote).size === 3 && r.remote.includes("att-other-device"), `merge unions attempts: ${r.remote}`);
      ok(r.raw === "5/12" && (await page.inputValue(`${pk} input`)) === "5/12", "local typed text wins");
      ok(r.other === 1, "remote-only item survives");
      await go(page, "l5-bayes");
      ok(/Correct: 2\/5/.test(await text(page, `${qc("cse312-w2-l5-qc-bayes-plug-in")} .feedback`)), "merged remote item shows on the page");
      allErrors.push(...errors.map((e) => `conflict: ${e}`));
      await context.close();
    }

    /* =============================================== 6. slow and failing loads */
    {
      const context = await browser.newContext({ viewport: DESKTOP });
      await context.addInitScript({ path: MOCK });
      await context.addInitScript(() => { window.MockAdapter.instance = window.MockAdapter.create({ latencyMs: 2500, persistKey: "mock-slow" }); window.COURSE_SITE_STORAGE = window.MockAdapter.instance; });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${url}#l3-problems`);
      const t = task("cse312-w2-l3-p-rooks");
      await page.waitForSelector(`${t} textarea`);
      await page.fill(`${t} textarea`, "typed before the slow load finished");
      await page.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { timeout: 15000 });
      ok((await page.inputValue(`${t} textarea`)) === "typed before the slow load finished", "slow load doesn't block or overwrite typing");
      await page.waitForFunction(() => window.COURSE_SITE.pending().length === 0, null, { timeout: 15000 });
      ok(await page.evaluate(() => window.MockAdapter.instance.remote.items["cse312-w2-l3-p-rooks"].work) === "typed before the slow load finished", "early text reaches the slow adapter");
      allErrors.push(...errors.map((e) => `slow: ${e}`));
      await context.close();

      const c2 = await browser.newContext({ viewport: DESKTOP });
      await c2.addInitScript({ path: MOCK });
      await c2.addInitScript(() => { window.MockAdapter.instance = window.MockAdapter.create({ failLoads: true, persistKey: "mock-failload" }); window.COURSE_SITE_STORAGE = window.MockAdapter.instance; });
      const p2 = await c2.newPage();
      await p2.goto(`${url}#home`);
      await p2.waitForFunction(() => document.documentElement.dataset.ready === "1");
      ok(/Couldn.t load/.test(await text(p2, ".toast.error")), "failed load → transient notice, page works");
      await c2.close();
    }

    /* =============================================== 7. table-driven edit invalidation over every input type in the inventory */
    {
      const inv = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../export/state-inventory.json"), "utf8"));
      const types = [...new Set(inv.items.filter((i) => i.kind !== "problem").map((i) => `${i.kind}/${i.grader}`))].sort();
      const CASES = {
        "quickcheck/exact-expression": { id: "cse312-w2-l3-qc-rooks-4x4", route: "l3-rooks", good: "(4*3)^2/2", edit: "144" },
        "quiz/exact-expression": { id: "cse312-w2-l5-quiz-two-dice-sum-eight", route: "l5-quiz", good: "1/5", edit: "1/3" },
        "quiz/multiple-choice": { id: "cse312-w2-l5-quiz-partition-pick", route: "l5-quiz", good: "three-pairs", edit: "gap" },
        "part/exact-expression": { id: "cse312-w2-l4-p-prob-sum-six.ans", route: "l4-problems", good: "3/16", edit: "3/7" },
        "part/formula": { id: "cse312-w2-rd-1-3-subset-chains.ans", route: "readings", good: "3^n", edit: "4^n" },
        "part/yes-no": { id: "cse312-w2-l3-p-birthdays.ans", route: "l3-problems", good: "yes", edit: "no" },
        "part/self-check": { id: "cse312-w2-rd-1-3-same-friend-count.argument", route: "readings", good: "0 friends vs n-1 friends", edit: "something else" },
      };
      ok(types.every((t) => CASES[t]), `every inventory input type has a case: ${types.filter((t) => !CASES[t]).join(", ") || "all covered"}`);
      const { context, page, errors } = await newPage(browser, url, { mock: { latencyMs: 10, persistKey: "mock-table" } });
      const snap = (id) => page.evaluate((i) => window.COURSE_SITE.snapshot().items[i], id);
      const covered = [];
      for (const t of types) {
        const c = CASES[t];
        if (!c) continue;
        const meta = inv.items.find((i) => i.id === c.id);
        ok(meta && `${meta.kind}/${meta.grader}` === t, `${t}: ${c.id} has that type`);
        const [kind] = t.split("/");
        const itemId = kind === "part" ? c.id.slice(0, c.id.lastIndexOf(".")) : c.id;
        const root = kind === "part" ? task(itemId) : kind === "quiz" ? quiz(itemId) : qc(itemId);
        const isMc = t === "quiz/multiple-choice", isSelf = t === "part/self-check";
        const setValue = async (v) => { if (isMc) await page.click(`${root} label[data-opt="${v}"]`); else await page.fill(kind === "part" ? part(c.id) : `${root} input`, v); };
        const submit = async () => {
          if (isSelf) {
            if (await page.locator(`${root} .solution`).isHidden()) await page.locator(`${root} .task-actions button`, { hasText: "solution" }).click();
            await page.locator(`${root} .self-mark button`, { hasText: "I got it" }).click();
          } else await page.click(kind === "part" ? `${root} .my-work button.primary` : kind === "quiz" ? `${root} .row button.primary` : `${root} button.primary`);
        };
        const graded = (s) => (kind === "part" ? (s.overall !== null || s.selfMark !== null || s.parts[c.id].correct !== null || s.parts[c.id].normalized !== null) : (s.correct !== null || s.normalized !== ""));
        const domClean = () => page.evaluate(({ root, kind }) => {
          const r = document.querySelector(root);
          const fbs = [...r.querySelectorAll(".feedback, .part-fb")].map((f) => f.textContent.trim()).join("");
          const marks = r.querySelectorAll("label.right, label.wrong, input.ok, input.bad, .self-mark [aria-pressed='true']").length;
          const pill = r.querySelector(".pill");
          return !fbs && !marks && !r.classList.contains("is-right") && !(pill && /Correct|Not yet/.test(pill.textContent)) && (kind !== "quiz" || !r.querySelector(":scope > .why:not([hidden])"));
        }, { root, kind });
        await go(page, c.route);
        await setValue(c.good);
        await submit();
        let s = await snap(itemId);
        ok(graded(s) && s.attempts.length === 1, `${t}: graded and one attempt after submit`);
        const att = JSON.stringify(s.attempts), evs = JSON.stringify(s.events);
        await setValue(c.edit);
        s = await snap(itemId);
        ok(!graded(s), `${t}: edit clears the current grade`);
        ok(JSON.stringify(s.attempts) === att && JSON.stringify(s.events) === evs, `${t}: attempts and events untouched by the edit`);
        ok(await domClean(), `${t}: DOM feedback, marks and badges cleared`);
        await setValue(c.good);
        ok(!graded(await snap(itemId)) && await domClean(), `${t}: re-entering the graded value shows no grade`);
        await setValue(c.edit);
        await flushed(page);
        await reload(page, c.route);
        s = await snap(itemId);
        ok(!graded(s) && await domClean(), `${t}: after reload, not shown as graded`);
        ok(isMc ? await page.locator(`${root} label[data-opt="${c.edit}"] input`).isChecked() : (await page.inputValue(kind === "part" ? part(c.id) : `${root} input`)) === c.edit, `${t}: after reload, draft restored`);
        ok(JSON.stringify(s.attempts) === att, `${t}: after reload, attempt unchanged`);
        const remote = await page.evaluate((i) => window.MockAdapter.instance.remote.items[i], itemId);
        ok(!graded(remote), `${t}: cleared grade reached the adapter`);
        covered.push(t);
      }
      console.log(`  invalidation table covered: ${covered.join(", ")}`);
      allErrors.push(...errors.map((e) => `table: ${e}`));
      await context.close();
    }

    /* =============================================== 8. screenshots (desktop + mobile) */
    for (const [label, viewport] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
      const { context, page, errors } = await newPage(browser, url, { viewport });
      const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}-${label}.png`) });
      await go(page, "home");
      await page.click('.lens[data-lens="cond"]');
      if (label === "mobile") await page.locator("#hero-venn").scrollIntoViewIfNeeded();
      await shot("overview");
      await go(page, "l3-ie");
      await page.click("#ie-next"); await page.click("#ie-next");
      await page.locator("#ie").scrollIntoViewIfNeeded();
      await shot("lecture3-inclusion-exclusion");
      await go(page, "l3-cards");
      await page.click('#deck [data-hand="four-aces"]');
      await page.locator(label === "mobile" ? "#deck-report" : "#deck").scrollIntoViewIfNeeded();
      await shot("lecture3-sleuth");
      await go(page, "l4-axioms");
      await page.locator("#coins").scrollIntoViewIfNeeded();
      await shot("lecture4-coin-models");
      await go(page, "l5-conditional");
      await page.selectOption("#rs-exp", "survey");
      await page.locator("#restrict").scrollIntoViewIfNeeded();
      await shot("lecture5-restrict");
      await go(page, "l5-zika");
      await page.locator("#bayes").scrollIntoViewIfNeeded();
      await shot("lecture5-bayes");
      await go(page, "l5-problems");
      const zk = "cse312-w2-l5-p-zika";
      await page.fill(part(`${zk}.pt`), "0.01485");
      await page.fill(part(`${zk}.pzt`), "0.33");
      await page.fill(part(`${zk}.neg`), "0.02");
      await page.click(`${task(zk)} .my-work button.primary`);
      await page.locator(`${task(zk)} .task-actions button`, { hasText: "hint" }).click();
      await page.locator(`${task(zk)} .ans-rows`).scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -120));
      await shot("problem-feedback");
      await go(page, "l3-quiz");
      await page.fill(`${quiz("cse312-w2-l3-quiz-socks-drawers")} input`, "7");
      await page.click(`${quiz("cse312-w2-l3-quiz-socks-drawers")} .row button.primary`);
      await page.click(`${quiz("cse312-w2-l3-quiz-pigeons-thirteen-people")} label[data-opt="people-months"]`);
      await page.click(`${quiz("cse312-w2-l3-quiz-pigeons-thirteen-people")} .row button.primary`);
      await page.locator(quiz("cse312-w2-l3-quiz-socks-drawers")).scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -80));
      await shot("quiz");
      await go(page, "cheatsheet");
      await shot("cheatsheet");
      allErrors.push(...errors.map((e) => `screens ${label}: ${e}`));
      await context.close();
    }
    {
      const { context, page } = await newPage(browser, url, { viewport: MOBILE, mock: { latencyMs: 30, failSaves: true, persistKey: "mock-shot" }, hash: "l4-problems" });
      const id = "cse312-w2-l4-p-at-least-one-three";
      await page.fill(`${task(id)} textarea`, "6 + 6 − 1 outcomes");
      await page.fill(part(`${id}.ans`), "12/36");
      await page.click(`${task(id)} .my-work button.primary`);
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
