// Browser tests (Playwright + headless Chromium). Run: node browser.mjs
// Covers: every route renders (no console errors, no raw TeX, no overflow at 1280x800 and 390x844), file:// with no
// network, right/wrong answers, misconception feedback that never reveals the answer, hints, solution confirmation,
// every widget at its limits checked against exact values, persistence across reload, attempt history, stale-grade
// invalidation (table-driven from export/state-inventory.json), draft races, save failure + recovery (transient
// notices only, exactly-once delivery), conflict merge, and NO persistent save-status text anywhere.
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync } from "node:fs";
import { serve, CHROME } from "./lib/serve.mjs";
const here = new URL(".", import.meta.url).pathname;
const SHOTS = `${here}../screenshots`;
mkdirSync(SHOTS, { recursive: true });
const MOCK_SRC = readFileSync(`${here}../examples/mock-adapter.js`, "utf8");
const INV = JSON.parse(readFileSync(`${here}../export/state-inventory.json`, "utf8"));
const SITE = "cse332-26au-week2";

const { srv, url } = await serve(`${here}../site/`, 0);
const browser = await chromium.launch({ executablePath: CHROME });
let pass = 0, fail = 0;
const results = {};
let group = "setup";
const t = (cond, msg) => { results[group] = results[group] || { pass: 0, fail: 0 }; if (cond) { pass++; results[group].pass++; } else { fail++; results[group].fail++; console.log(`FAIL [${group}] ${msg}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DESKTOP = { width: 1280, height: 800 }, MOBILE = { width: 390, height: 844 };

async function open({ viewport = DESKTOP, mock = null, hash = "home", base = url } = {}) {
  const ctx = await browser.newContext({ viewport });
  if (mock) await ctx.addInitScript(`${MOCK_SRC}\n;window.__mock = MockAdapter.create(${JSON.stringify(mock)}); window.COURSE_SITE_STORAGE = window.__mock.adapter;`);
  const page = await ctx.newPage();
  page.errors = [];
  page.requests = [];
  page.on("console", (m) => { if (m.type() === "error") page.errors.push(m.text()); });
  page.on("pageerror", (e) => page.errors.push(`pageerror: ${e.message}`));
  page.on("request", (r) => page.requests.push(r.url()));
  page.on("dialog", (d) => d.accept());
  await page.goto(`${base}/#${hash}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
  return page;
}
async function go(page, hash) { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(150); }
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
    if (g === "self") return "my written answer";
    if (g === "bound") {
      const task = s.closest("article.task");
      const pair = s.dataset.pair || null;
      const cSpec = [...task.querySelectorAll(".answer-spec[data-role=c]")].find((x) => (x.dataset.pair || null) === pair);
      const b = JSON.parse(cSpec.dataset.bound);
      const key = JSON.stringify(b.f) + b.rel;
      const pairs = { '["100","10"]O': ["110", "1"], '["0","-50","13"]Omega': ["12", "50"], '["17","0","3"]O': ["20", "1"], '["17","0","3"]Omega': ["3", "1"] };
      return s.dataset.role === "c" ? pairs[key][0] : pairs[key][1];
    }
    return s.dataset.answer;
  }, pid);
}
async function fillProblemRight(page, id) {
  const parts = INV.items.filter((i) => i.parentId === id);
  for (const p of parts) await page.fill(sel.part(p.id), await rightAnswer(page, p.id));
  return parts;
}
const NO_SAVE_STATUS = () => page_noSaveStatus;
const page_noSaveStatus = async (page) => page.evaluate(() => {
  const txt = document.body.innerText;
  const bad = /\b(Saved at|Saved\b|Saving\b|All changes saved|Unsaved|Last saved|Sync(ed|ing))/i.test(txt.replace(/saved in this browser|kept in this browser|Saved again\. Everything you did meanwhile is stored\./gi, ""));
  const els = document.querySelectorAll("[class*=save-status], [class*=saved], [id*=save], [data-save-status], [class*=sync]").length;
  return { bad, els };
});

/* =========================================================== 1. every route: errors, TeX, overflow (desktop + mobile) */
for (const vp of [{ ...DESKTOP, name: "desktop" }, { ...MOBILE, name: "mobile" }]) {
  group = `routes-${vp.name}`;
  const page = await open({ viewport: vp });
  const routes = await page.$$eval(".page", (ps) => ps.map((p) => p.id));
  t(routes.length === 12, `12 routes (${routes.length})`);
  for (const r of routes) {
    await go(page, r);
    const info = await page.evaluate(() => {
      const active = document.querySelector(".page.is-active");
      const walker = document.createTreeWalker(active, NodeFilter.SHOW_TEXT);
      const raw = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.parentElement.closest(".katex, textarea, script, pre, code, [hidden]")) continue;
        if (/\\\(|\\\)|\\\[|\\\]|\\frac|\\le\b|\\cdot|\\in\b|\\Omega|\\Theta/.test(n.textContent)) raw.push(n.textContent.trim().slice(0, 60));
      }
      return {
        raw, katexErr: active.querySelectorAll(".katex-error").length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        wide: [...active.querySelectorAll("*")].filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > window.innerWidth + 1 && !e.closest(".table-wrap, pre, .katex-mathml, .katex-display, svg") && getComputedStyle(e).position !== "fixed"; }).map((e) => e.tagName + "." + e.className).slice(0, 3),
        active: active.id,
        emptyCharts: [...active.querySelectorAll("svg.chart")].filter((s) => !s.querySelector("path.series")).map((s) => s.id || s.className.baseVal),
      };
    });
    t(info.active === r, `${r} becomes active`);
    t(info.raw.length === 0, `${r}: no raw TeX (${info.raw.join(" | ")})`);
    t(info.katexErr === 0, `${r}: no KaTeX errors`);
    t(info.overflow <= 0, `${r}: no horizontal overflow (${info.overflow}px)`);
    t(info.wide.length === 0, `${r}: no element sticks out (${info.wide.join(", ")})`);
    t(info.emptyCharts.length === 0, `${r}: every chart drew (${info.emptyCharts.join(", ")})`);
  }
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  const external = page.requests.filter((u) => !u.startsWith(url));
  t(external.length === 0, `no network requests outside the site (${external.slice(0, 3).join(", ")})`);
  const fonts = await page.evaluate(async () => { await document.fonts.ready; return ['700 16px "IBM Plex Sans"', '400 16px "IBM Plex Sans"', '400 16px "IBM Plex Mono"'].map((f) => document.fonts.check(f)); });
  t(fonts.every(Boolean), `vendored fonts load (${fonts})`);
  // screenshots
  await go(page, "home");
  await page.screenshot({ path: `${SHOTS}/${vp.name}-overview.png`, fullPage: false });
  await page.screenshot({ path: `${SHOTS}/${vp.name}-overview-full.png`, fullPage: true });
  await go(page, "search");
  await page.fill("#gap-k", "88"); await page.click("#gap-run");
  await page.locator("#gap").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/${vp.name}-binary-search-gap.png` });
  await go(page, "notation");
  await page.click('.q-part[data-q="all"]');
  await page.locator("#sw1").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/${vp.name}-sandwich.png` });
  await go(page, "proofs");
  await page.locator("#sw2").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/${vp.name}-proofs-c-n0.png` });
  await go(page, "drop");
  await page.locator("#simp").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/${vp.name}-classifier.png` });
  await go(page, "examples");
  await page.locator("#race").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/${vp.name}-race.png` });
  await go(page, "upcoming");
  await page.screenshot({ path: `${SHOTS}/${vp.name}-upcoming.png` });
  await go(page, "cheatsheet");
  await page.screenshot({ path: `${SHOTS}/${vp.name}-cheatsheet.png`, fullPage: vp.name === "desktop" });
  if (vp.name === "mobile") {
    await go(page, "home");
    await page.click("#menu-btn");
    t(await page.isVisible('.rail-body a[href="#proofs"]'), "mobile menu opens");
    await page.screenshot({ path: `${SHOTS}/mobile-menu.png` });
    await page.click('.rail-body a[href="#proofs"]');
    await page.waitForTimeout(150);
    t((await page.evaluate(() => location.hash)) === "#proofs" && !(await page.isVisible('.rail-body a[href="#drop"]')), "menu navigates and closes");
  }
  await page.context().close();
}

/* =========================================================== 1b. file:// with no network */
group = "file-url";
{
  const ctx = await browser.newContext({ viewport: DESKTOP });
  await ctx.route(/^https?:/, (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`file://${here}../site/index.html#notation`);
  await page.waitForFunction(() => document.documentElement.dataset.booted === "true");
  const k = await page.evaluate(() => document.querySelectorAll(".page.is-active .katex").length);
  const fontsOk = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 16px "IBM Plex Sans"') && document.fonts.check('400 16px "IBM Plex Mono"'); });
  t(k > 10 && fontsOk && errs.length === 0, `file:// renders math (${k}) and vendored fonts, no errors (${errs})`);
  await ctx.close();
}

/* =========================================================== 2. right / wrong answers, misconceptions, hints, solutions */
group = "answers";
{
  const page = await open({ hash: "search" });
  const QC = "cse332-w2-l3-search-worst-million";
  await page.fill(sel.qcInput(QC), "1000000"); await page.click(sel.qcCheck(QC));
  let fb = await page.textContent(sel.qcFb(QC));
  t(/linear scan/.test(fb) && !/\b20\b/.test(fb), `misconception named, answer hidden: "${fb}"`);
  await page.fill(sel.qcInput(QC), "19"); await page.click(sel.qcCheck(QC));
  fb = await page.textContent(sel.qcFb(QC));
  t(/one more time/.test(fb) && !/\b20\b/.test(fb), `off-by-one misconception: "${fb}"`);
  await page.fill(sel.qcInput(QC), "17"); await page.click(sel.qcCheck(QC));
  fb = await page.textContent(sel.qcFb(QC));
  t(/Not quite/.test(fb) && !/\b20\b/.test(fb), `generic wrong feedback: "${fb}"`);
  await page.fill(sel.qcInput(QC), "lots"); await page.click(sel.qcCheck(QC));
  t(/Couldn't read/.test(await page.textContent(sel.qcFb(QC))), "unreadable input explained, not graded");
  t((await rec(page, QC)).attempts.length === 3, "unreadable input is not an attempt");
  await page.fill(sel.qcInput(QC), "2*10"); await page.click(sel.qcCheck(QC));
  t(/Correct/.test(await page.textContent(sel.qcFb(QC))), "right answer (as arithmetic) accepted");
  // MC quick check with per-option explanation
  const MC = "cse332-w2-l3-search-log8-same-bucket";
  await page.check(sel.qcRadio(MC, 0)); await page.click(sel.qcCheck(MC));
  t(await page.isVisible(`.check[data-id="${MC}"] label:nth-of-type(1) .why`), "wrong MC shows why that option is wrong");
  t(!(await page.isVisible(`.check[data-id="${MC}"] label[data-correct] .why`)), "wrong MC doesn't reveal the right option");
  await page.check(sel.qcRadio(MC, 1)); await page.click(sel.qcCheck(MC));
  t((await rec(page, MC)).correct === true, "right MC accepted");
  // yes/no quick check
  await go(page, "proofs");
  const YN = "cse332-w2-l3-proofs-example2-c13";
  await page.fill(sel.qcInput(YN), "yes"); await page.click(sel.qcCheck(YN));
  t(/cancel/.test(await page.textContent(sel.qcFb(YN))), "yes/no misconception");
  await page.fill(sel.qcInput(YN), "false"); await page.click(sel.qcCheck(YN));
  t((await rec(page, YN)).correct === true, "'false' accepted as no");
  // Big-O quick check: nudges
  await go(page, "drop");
  const BO = "cse332-w2-l3-drop-n3-2n-bucket";
  await page.fill(sel.qcInput(BO), "O(n^3)"); await page.click(sel.qcCheck(BO));
  t(/too slowly/.test(await page.textContent(sel.qcFb(BO))), "too-small bucket named");
  await page.fill(sel.qcInput(BO), "O(2^n + n^3)"); await page.click(sel.qcCheck(BO));
  t((await rec(page, BO)).correct === true && /simplified/.test(await page.textContent(sel.qcFb(BO))), "unsimplified bucket accepted with nudge");
  await page.fill(sel.qcInput(BO), "3^n"); await page.click(sel.qcCheck(BO));
  t((await rec(page, BO)).correct === false && /tightest/.test(await page.textContent(sel.qcFb(BO))), "3^n is not 2^n");
  // problems: multi-part exact
  await go(page, "l3-problems");
  const GH = "cse332-w2-l3-gap-halving";
  await page.fill(sel.part(`${GH}.solve-4096`), "12"); await page.fill(sel.part(`${GH}.worst-2-to-20`), "20"); await page.fill(sel.part(`${GH}.worst-million`), "21");
  await page.click(sel.taskCheck(GH));
  let r = await rec(page, GH);
  t(r.result === "wrong" && r.parts["solve-4096"].correct === true && r.parts["worst-2-to-20"].correct === false && r.parts["worst-million"].correct === false, "per-part grading");
  t(/one more time/.test(await page.textContent(sel.partFb(`${GH}.worst-2-to-20`))) && /power of 2/.test(await page.textContent(sel.partFb(`${GH}.worst-million`))), "per-part misconceptions");
  t(/1 of 3 right/.test(await page.textContent(sel.taskFb(GH))) && (await page.textContent(sel.pill(GH))) === "Not yet", "summary + pill");
  await page.fill(sel.part(`${GH}.worst-2-to-20`), "21"); await page.fill(sel.part(`${GH}.worst-million`), "20"); await page.click(sel.taskCheck(GH));
  r = await rec(page, GH);
  t(r.result === "right" && (await page.textContent(sel.pill(GH))) === "Correct" && r.attempts.map((a) => a.seq).join() === "1,2", "corrected; attempts 1,2");
  // c/n0 pair
  const E1 = "cse332-w2-l3-example1-bigo";
  await page.fill(sel.part(`${E1}.c`), "10"); await page.fill(sel.part(`${E1}.n0`), "3"); await page.fill(sel.part(`${E1}.smallest-n0-c10`), "10");
  await page.click(sel.taskCheck(E1));
  r = await rec(page, E1);
  t(r.parts.c.correct === true && r.parts.n0.correct === false && /Fails at n = 3/.test(await page.textContent(sel.partFb(`${E1}.n0`))), "c ok, n0 too small, counterexample at 3");
  t(/isn't the smallest/.test(await page.textContent(sel.partFb(`${E1}.smallest-n0-c10`))), "slides' n0 = 10 is valid but not smallest: named");
  await page.fill(sel.part(`${E1}.c`), "1/2"); await page.fill(sel.part(`${E1}.n0`), "1000000"); await page.click(sel.taskCheck(E1));
  r = await rec(page, E1);
  t(r.parts.c.correct === true, "c = 1/2 with huge n0 holds (any valid pair)");
  const E2 = "cse332-w2-l3-example2-omega";
  await page.fill(sel.part(`${E2}.c`), "13"); await page.fill(sel.part(`${E2}.n0`), "1000"); await page.fill(sel.part(`${E2}.smallest-n0-c12`), "50"); await page.fill(sel.part(`${E2}.c13-possible`), "no");
  await page.click(sel.taskCheck(E2));
  r = await rec(page, E2);
  t(r.parts.c.correct === false && r.parts.n0.correct === null && /keeps failing/.test(await page.textContent(sel.partFb(`${E2}.c`))), "c = 13 impossible: c wrong, n0 not judged");
  await page.fill(sel.part(`${E2}.c`), "12"); await page.fill(sel.part(`${E2}.n0`), "50"); await page.click(sel.taskCheck(E2));
  t((await rec(page, E2)).result === "right", "slide 26's pair accepted");
  // two pairs in one problem (Θ)
  const SQ = "cse332-w2-l3-sq17-theta";
  await page.fill(sel.part(`${SQ}.upper-c`), "4"); await page.fill(sel.part(`${SQ}.upper-n0`), "5"); await page.fill(sel.part(`${SQ}.lower-c`), "4"); await page.fill(sel.part(`${SQ}.lower-n0`), "1");
  await page.click(sel.taskCheck(SQ));
  r = await rec(page, SQ);
  t(r.parts["upper-c"].correct && r.parts["upper-n0"].correct && r.parts["lower-c"].correct === false, "Θ: upper pair right, lower pair c wrong (graded separately)");
  await page.fill(sel.part(`${SQ}.lower-c`), "3"); await page.click(sel.taskCheck(SQ));
  t((await rec(page, SQ)).result === "right", "both pairs right");
  // Big-O parts with log base / constants
  const IB = "cse332-w2-l3-intuition-buckets";
  await page.fill(sel.part(`${IB}.four-n-plus-five`), "n"); await page.fill(sel.part(`${IB}.half-nlogn`), "n log_10 n"); await page.fill(sel.part(`${IB}.cube-plus-exp`), "2^n"); await page.fill(sel.part(`${IB}.nlog-10n2`), "n^2");
  await page.click(sel.taskCheck(IB));
  r = await rec(page, IB);
  t(r.parts["half-nlogn"].correct === true && /log bases/.test(await page.textContent(sel.partFb(`${IB}.half-nlogn`))) && r.parts["nlog-10n2"].correct === false, "log base nudge; n^2 rejected for n log(10n^2)");
  // word choice
  const TV = "cse332-w2-l3-tenth-vs-log";
  await page.fill(sel.part(`${TV}.tenth-at-2-to-40`), "2^4"); await page.fill(sel.part(`${TV}.bigger-at-2-to-40`), "tenth"); await page.fill(sel.part(`${TV}.crossover-k`), "58");
  await page.click(sel.taskCheck(TV));
  t(/eventually/.test(await page.textContent(sel.partFb(`${TV}.bigger-at-2-to-40`))) && (await rec(page, TV)).parts["tenth-at-2-to-40"].correct === true, "choice misconception; 2^4 = 16 accepted");
  // hint ladder + solution confirmation + steps
  const EV = "cse332-w2-l3-eventually-exact";
  for (let k = 1; k <= 3; k++) await page.click(`${sel.task(EV)} .task-actions button:has-text("hint")`);
  r = await rec(page, EV);
  t(r.hintsRevealed === 3 && r.events.filter((e) => e.type === "hint").map((e) => e.data.level).join() === "1,2,3", "hint ladder logs 3 hint events");
  t(await page.isDisabled(`${sel.task(EV)} .task-actions button:has-text("hints shown")`), "hint button disabled after the last rung");
  const hintText = await page.textContent(`${sel.task(EV)} ol.hints`);
  t(!/4,?401|1,?025|\b44\b/.test(hintText), "hints don't contain the answers");
  t(await page.isHidden(`${sel.task(EV)} .solution`), "solution hidden at first");
  await page.click(sel.btn(EV, "Show solution"));
  t(/haven't answered/.test(await page.textContent(sel.taskFb(EV))) && await page.isHidden(`${sel.task(EV)} .solution`), "solution asks for confirmation when unattempted");
  await page.click(sel.btn(EV, "Show solution anyway"));
  t(await page.isVisible(`${sel.task(EV)} .solution`), "solution shown after confirmation");
  await page.click(`${sel.task(EV)} .solution .step-bar button:has-text("Show first step")`);
  t((await page.$$eval(`${sel.task(EV)} .solution .steps li:not([hidden])`, (x) => x.length)) === 1, "steps revealed one at a time");
  await page.click(`${sel.task(EV)} .solution .step-bar button:has-text("Show all")`);
  t(await page.isVisible(`${sel.task(EV)} .solution li.answer`), "highlighted final answer");
  await page.click(`${sel.task(EV)} [data-brute="eventually"]`);
  await page.waitForSelector(`${sel.task(EV)} .brute.ok`, { timeout: 8000 });
  t(/4,401.*18.*1,025.*44/.test(await page.textContent(`${sel.task(EV)} .brute.ok`)), "brute force confirms 4401, 18, 1025, 44");
  r = await rec(page, EV);
  t(r.solutionViewed && r.events.some((e) => e.type === "solution") && r.attempts.length === 0, "solution view is an event, not an attempt");
  await fillProblemRight(page, EV);
  await page.click(sel.taskCheck(EV));
  r = await rec(page, EV);
  t(r.result === "right" && r.attempts[0].hintsRevealedAtSubmit === 3 && r.attempts[0].solutionViewedBeforeSubmit === true, "attempt records hints and solution-before-submit");
  // teaching notes open by default
  t(await page.$$eval("details.notes", (d) => d.every((x) => x.open)), "every teaching-notes block is open by default");
  // self-check problem
  const WP = "cse332-w2-l3-write-proof";
  await page.fill(sel.part(`${WP}.proof`), "c = 4, n0 = 4");
  t(!(await page.isVisible(`${sel.task(WP)} .my-work .row button.primary`)), "self-check problem has no auto Check");
  await page.click(sel.btn(WP, "Show solution"));
  await page.click(`${sel.task(WP)} .self-mark button:has-text("I got it")`);
  r = await rec(page, WP);
  t(r.selfMark === "got" && r.attempts.length === 1 && r.attempts[0].feedbackKind === "self-got" && (await page.textContent(sel.pill(WP))) === "Correct", "self-mark is an attempt");
  await page.locator(sel.task(GH)).scrollIntoViewIfNeeded();
  await page.fill(sel.part(`${GH}.worst-million`), "1000000"); await page.click(sel.taskCheck(GH));
  await page.locator(sel.task(GH)).screenshot({ path: `${SHOTS}/desktop-problem-feedback.png` });
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}

/* =========================================================== 3. widgets: exact values, limits, no false conclusions */
group = "widgets";
{
  const page = await open({ hash: "home" });
  await page.fill("#hero-n-num", "4401");
  t(/n⁵⁰ is bigger/.test(await page.textContent("#hero-out")) && (await page.textContent("#hero-vs")) === ">", "hero: n = 4401 n^50 bigger");
  await page.click('[data-hero-jump="4402"]');
  t(/1\.1ⁿ is bigger.*forever/.test(await page.textContent("#hero-out")) && (await page.textContent("#hero-vs")) === "<", "hero: n = 4402 1.1^n bigger, stays");
  await page.fill("#hero-n-num", "1");
  t(/only for this one value/.test(await page.textContent("#hero-out")), "hero: n = 1 exception explained");
  await page.fill("#hero-n-num", "100");
  t(/101-digit/.test(await page.textContent("#hero-f")) && /13,780\.6/.test(await page.textContent("#hero-g")), "hero: n = 100 values (101 digits; 1.1^100 ≈ 13,780.6)");
  await page.hover("#hero-svg", { position: { x: 400, y: 120 } });
  t(/digits/.test(await page.textContent("#hero-box .tip")), "hero chart hover tooltip");

  await go(page, "search");
  await page.fill("#gap-k", "88"); await page.click("#gap-run");
  t(/Found 88 in 4 iterations \(gaps 10, 4, 2, 1\)/.test(await page.textContent("#gap-out")) && (await page.$$eval("#gap-bars .gap-bar", (x) => x.length)) === 4, "gap: 88 found in 4 with gaps 10,4,2,1 (matches Java)");
  await page.fill("#gap-k", "100"); await page.click("#gap-run");
  t(/returns false after 3 iterations/.test(await page.textContent("#gap-out")), "gap: missing target terminates");
  await page.fill("#gap-k", "5"); await page.click("#gap-step"); await page.click("#gap-step");
  t(/Iteration 2: gap 5/.test(await page.textContent("#gap-out")) && (await page.$$eval("#gap-cells .cell.mid", (x) => x.length)) === 1, "gap: stepping shows mid");
  await page.fill("#worst-n", "1000000");
  await page.waitForFunction(() => /Trying all/.test(document.querySelector("#worst-out").textContent), null, { timeout: 15000 });
  t(/20 iterations.*the most iterations is 20, which matches/.test(await page.textContent("#worst-out")), "worst: 10^6 → 20, exhaustive agrees");
  await page.fill("#worst-n", "1000000000");
  t(/30 iterations/.test(await page.textContent("#worst-out")) && !/Trying all/.test(await page.textContent("#worst-out")), "worst: 10^9 by formula only (no exhaustive claim)");
  await page.fill("#worst-n", "0");
  t(/Enter a whole number/.test(await page.textContent("#worst-out")), "worst: 0 rejected");
  await page.click('#logb [data-base="8"]');
  t((await page.$$eval("#logb-table tr td:last-child", (x) => x.map((c) => c.textContent))).every((v) => v === "3"), "log base 8 → constant 3 in every row");

  await go(page, "notation");
  await page.click('.q-part[data-q="n0"]');
  t(/starting point/.test(await page.textContent("#q-explain")), "quantifier explanation");
  t(/c₂ = 4: Smallest n₀ = 5/.test(await page.textContent("#sw1 .sw-out")) && /c₁ = 3: Smallest n₀ = 1/.test(await page.textContent("#sw1 .sw-out")) && /every n ≥ 5: f ∈ Θ\(g\)/.test(await page.textContent("#sw1 .sw-out")), "sandwich: Θ with n0 = 5");
  await page.fill("#sw1-c2", "3");
  t(/No n₀ works with c = 3/.test(await page.textContent("#sw1 .sw-out")) && !/Θ\(g\)/.test(await page.textContent("#sw1 .sw-out")), "sandwich: c2 = 3 impossible, no Θ conclusion");
  await page.fill("#sw1-c2", "abc");
  t(/Use a positive number/.test(await page.textContent("#sw1 .sw-out")), "sandwich: unreadable c");
  await page.click('.grid-cell[data-cell="Omega-best"]');
  t(/even in the best case/.test(await page.textContent("#grid-out")), "case × bound grid");

  await go(page, "proofs");
  t(/Smallest n₀ = 4 \(fails at n = 3\)/.test(await page.textContent("#sw2 .sw-out")), "proofs widget: Example 1, c = 10 → 4");
  await page.selectOption("#sw2-claim", "ex2");
  await page.fill("#sw2-c", "12");
  t(/Smallest n₀ = 50/.test(await page.textContent("#sw2 .sw-out")), "Example 2, c = 12 → 50");
  await page.fill("#sw2-c", "13");
  t(/No n₀ works/.test(await page.textContent("#sw2 .sw-out")), "Example 2, c = 13 → none");
  await page.selectOption("#sw2-claim", "n2-vs-n");
  await page.fill("#sw2-c", "1000000");
  t(/No n₀ works/.test(await page.textContent("#sw2 .sw-out")), "n^2 ∉ O(10n+100) for any c tried");
  t((await page.$$eval("#sw2 svg path.series", (p) => p.length)) === 2, "f and c·g drawn");

  await go(page, "drop");
  for (const [e, want] of [["4n + 5", "Θ(n)"], ["n^3 + 2^n + 3n", "Θ(2ⁿ)"], ["nlog(10n^2)", "Θ(n log n)"], ["log_5 n", "Θ(log n)"], ["n^2 - n^2", "Can't classify"], ["n^(1/10)", "between"]]) {
    await page.fill("#simp-in", e);
    t((await page.textContent("#simp-out")).includes(want), `simplify "${e}" → ${want} (${await page.textContent("#simp-out")})`);
  }
  await page.click('[data-simp="0.5nlogn + 2n + 7"]');
  t((await page.$$eval("#simp-ladder li.on", (x) => x.map((l) => l.dataset.rung))).join() === "n log n", "ladder highlights log-linear");

  await go(page, "examples");
  const verdicts = async () => page.$$eval("#rel-out .verdict b", (x) => x.map((b) => b.textContent).join(","));
  const expect = [["4+3n", "n", "True,False,False", "True,True,True"], ["n+2log n", "log n", null, "False,True,False"], ["log n+2", "1", null, "False,True,False"], ["n^50", "1.1^n", null, "True,False,False"], ["3^n", "2^n", null, "False,True,False"]];
  for (const [f, g, , want] of expect) {
    await page.click(`[data-rel='${JSON.stringify([f, g])}']`);
    t((await verdicts()) === want, `classifier ${f} vs ${g}: O,Ω,Θ = ${want} (got ${await verdicts()})`);
  }
  await page.fill("#rel-f", "n!"); t(/Can't classify/.test(await page.textContent("#rel-out")), "classifier refuses n!");
  t(/4,401.*4,402/.test(await page.textContent("#race-out")), "race n^50: exact profile");
  await page.click('#race [data-race="threeTwo"]');
  t(/from n = 18 on/.test(await page.textContent("#race-out")), "race 3^n: from 18");
  await page.click("#race-table-toggle");
  t((await page.$$eval("#race-table tr", (r) => r.length)) === 7, "race table view");
  await page.hover("#race-svg", { position: { x: 300, y: 100 } });
  t(/digits/.test(await page.textContent("#race-box .tip")), "race hover tooltip");

  await go(page, "usage");
  for (const [k, wantVs] of [[1, ">"], [40, "<"], [58, "<"], [59, ">"], [80, ">"]]) {
    await page.locator("#tenth-k").fill(String(k));
    t((await page.textContent("#tenth-vs")) === wantVs, `n^(1/10) vs log n at k = ${k}: ${wantVs}`);
  }
  t(/stays bigger/.test(await page.textContent("#tenth-out")), "k ≥ 59 says it stays");
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}

/* =========================================================== 4. persistence, attempts, counters, quiz */
group = "persistence";
{
  const page = await open({ hash: "l3-problems" });
  const P = "cse332-w2-l3-more-examples";
  await page.fill(sel.work(P), "compare growth: 4+3n vs n");
  await fillProblemRight(page, P);
  await page.dblclick(sel.taskCheck(P));
  let r = await rec(page, P);
  t(r.attempts.length === 2 && r.attempts[0].attemptId !== r.attempts[1].attemptId && r.attempts[0].seq === 1 && r.attempts[1].seq === 2, "double-click Check = 2 distinct attempts");
  await page.click(`${sel.task(P)} .task-actions button:has-text("hint")`);
  await reload(page, "l3-problems");
  r = await rec(page, P);
  t(r.attempts.length === 2 && r.events.some((e) => e.type === "hint"), "attempts and events survive reload");
  t((await page.inputValue(sel.work(P))) === "compare growth: 4+3n vs n", "work text restored");
  t((await page.inputValue(sel.part(`${P}.n50-vs-1-1n`))) === "yes" && (await page.textContent(sel.pill(P))) === "Correct", "answers and status restored");
  t(/1 of 11 submitted · 1 currently correct/.test(await page.textContent("#l3-problems .progress-text")), "progress counts");
  // quiz
  await go(page, "cyu-l3");
  const Q = "cse332-w2-l3-cyu-binary-4096";
  await page.fill(sel.quizInput(Q), "12"); await page.click(sel.quizCheck(Q));
  t(/one more time/.test(await page.textContent(sel.quizFb(Q))) && !/13/.test(await page.textContent(sel.quizFb(Q))), "quiz misconception, answer hidden");
  t(/Answered 1 of 10 · 0 correct/.test(await page.textContent('[data-quiz-score="l3"]')), "wrong submission counts as answered");
  await reload(page, "cyu-l3");
  t(/Answered 1 of 10 · 0 correct/.test(await page.textContent('[data-quiz-score="l3"]')) && (await page.inputValue(sel.quizInput(Q))) === "12", "quiz state restored");
  const R = "cse332-w2-l3-cyu-sq17-n0";
  await page.click(sel.quizShow(R));
  t(/Answered 1 of 10/.test(await page.textContent('[data-quiz-score="l3"]')) && await page.isVisible(`.cyu[data-id="${R}"] > .why`), "reveal shows the why, isn't 'answered'");
  const M = "cse332-w2-l3-cyu-definition-order";
  await page.check(sel.quizRadio(M, 1));
  await reload(page, "cyu-l3");
  t(await page.isChecked(sel.quizRadio(M, 1)) && (await rec(page, M)).correct === null, "MC draft restored, ungraded");
  const items = INV.items.filter((i) => i.kind === "quiz" && i.quiz === "l3");
  t(items.length === 10, "10 quiz questions");
  for (const it of items) {
    const right = await page.evaluate((id) => { const li = document.querySelector(`.cyu[data-id="${id}"]`); return li.dataset.kind === "mc" ? [...li.querySelectorAll(".opts label")].findIndex((l) => l.hasAttribute("data-correct")) : li.dataset.answer; }, it.id);
    if (typeof right === "number") await page.check(sel.quizRadio(it.id, right)); else await page.fill(sel.quizInput(it.id), right);
    await page.click(sel.quizCheck(it.id));
  }
  const score = await page.textContent('[data-quiz-score="l3"]');
  t(/Answered 10 of 10 · 8 correct on the first try/.test(score), `quiz score: ${score}`);
  t(/Worth another look/.test(await page.textContent('[data-quiz-summary="l3"]')) && (await page.$$eval('[data-quiz-summary="l3"] a', (a) => a.map((x) => x.getAttribute("href")))).includes("#search"), "review links");
  await page.locator(".cyu-list").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/desktop-quiz.png` });
  const before = (await rec(page, Q)).attempts.length;
  await page.click('[data-quiz-summary="l3"] button[data-start-over]');
  t(/Answered 0 of 10/.test(await page.textContent('[data-quiz-score="l3"]')) && (await rec(page, Q)).attempts.length === before, "Start over resets counts, keeps attempts");
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}

/* =========================================================== 5. stale grading: one table-driven test over every input type */
group = "invalidation";
{
  const combos = [...new Set(INV.items.filter((i) => i.kind !== "problem").map((i) => `${i.kind}:${i.grader}`))].sort();
  const covered = [];
  const page = await open({ hash: "home" });
  for (const combo of combos) {
    const [kind, grader] = combo.split(":");
    const item = INV.items.find((i) => i.kind === kind && i.grader === grader);
    const id = item.id;
    await go(page, pageOfItem(kind === "part" ? item.parentId : id));
    const tag = `${combo} (${id})`;
    let attemptsBefore; const storeId = kind === "part" ? item.parentId : id;
    if (kind === "part" && grader === "self") {
      await page.fill(sel.part(id), "my answer");
      await page.click(sel.btn(item.parentId, "Show solution"));
      await page.click(sel.btn(item.parentId, "Show solution anyway")).catch(() => {});
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
      t((await page.textContent(sel.taskFb(item.parentId))) === "" && !((await page.getAttribute(sel.part(id), "class")) || "").includes("ok"), `${tag}: DOM feedback cleared`);
      t((await page.textContent(sel.pill(item.parentId))) !== "Correct", `${tag}: pill not Correct`);
      await page.fill(sel.part(id), orig);
      t((await rec(page, storeId)).result === null, `${tag}: re-entering the old value doesn't resurrect the grade`);
    } else {
      const isMc = grader === "mc";
      const inp = kind === "quiz" ? sel.quizInput(id) : sel.qcInput(id);
      const btn = kind === "quiz" ? sel.quizCheck(id) : sel.qcCheck(id);
      const fbSel = kind === "quiz" ? sel.quizFb(id) : sel.qcFb(id);
      const root = kind === "quiz" ? `.cyu[data-id="${id}"]` : `.check[data-id="${id}"]`;
      const right = await page.evaluate((rt) => { const e = document.querySelector(rt); return e.dataset.grader === "mc" ? [...e.querySelectorAll(".opts label")].findIndex((l) => l.hasAttribute("data-correct")) : e.dataset.answer; }, root);
      if (isMc) await page.check(`${root} .opts label:nth-of-type(${right + 1}) input`); else await page.fill(inp, right);
      await page.click(btn);
      let r = await rec(page, storeId);
      t(r.correct === true && r.normalized !== null, `${tag}: checked right`);
      attemptsBefore = r.attempts.length;
      const other = isMc ? (right === 0 ? 1 : 0) : grader === "yesno" ? (right === "yes" ? "no" : "yes") : right + "9";
      if (isMc) await page.check(`${root} .opts label:nth-of-type(${other + 1}) input`); else await page.fill(inp, other);
      r = await rec(page, storeId);
      t(r.correct === null && r.normalized === null && r.feedbackKind === null && (isMc ? r.choice === other : r.raw === other), `${tag}: store grade cleared, draft kept`);
      t((await page.textContent(fbSel)) === "" && (await page.$$eval(`${root} label.right, ${root} label.wrong, ${root}.is-right`, (x) => x.length)) === 0, `${tag}: DOM feedback cleared`);
      if (isMc) await page.check(`${root} .opts label:nth-of-type(${right + 1}) input`); else await page.fill(inp, right);
      t((await rec(page, storeId)).correct === null, `${tag}: re-entering the old value doesn't resurrect the grade`);
      if (isMc) await page.check(`${root} .opts label:nth-of-type(${other + 1}) input`); else await page.fill(inp, other);
    }
    await reload(page, pageOfItem(storeId));
    const r = await rec(page, storeId);
    const graded = kind === "part" ? (r.result !== null || r.selfMark !== null || r.parts[item.partKey].correct !== null) : r.correct !== null;
    t(!graded && r.attempts.length === attemptsBefore, `${tag}: after reload not graded, ${attemptsBefore} attempt(s) intact`);
    if (kind === "part") t((await page.textContent(sel.pill(item.parentId))) !== "Correct", `${tag}: reload shows no Correct badge`);
    covered.push(combo);
  }
  const missing = combos.filter((c) => !covered.includes(c));
  t(missing.length === 0 && combos.length >= 10, `every input type covered (${combos.length}: ${combos.join(", ")})`);
  console.log(`invalidation types covered: ${covered.join(", ")}`);
  await go(page, "l3-problems");
  const W = "cse332-w2-l3-log-base";
  await fillProblemRight(page, W); await page.click(sel.taskCheck(W));
  await page.fill(sel.work(W), "log2 8 = 3");
  t((await rec(page, W)).result === "right", "editing the ungraded work box keeps the grade");
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}

/* =========================================================== 6. draft races: type then immediately repaint */
group = "races";
{
  const page = await open({ hash: "cyu-l3" });
  const Q = "cse332-w2-l3-cyu-example2-c11";
  await page.locator(sel.quizInput(Q)).pressSequentially("2", { delay: 0 });
  await page.locator(sel.quizInput(Q)).pressSequentially("4", { delay: 0 });
  await page.click(sel.quizShow(Q), { delay: 0 });
  let r = await rec(page, Q);
  t((await page.inputValue(sel.quizInput(Q))) === "24" && r.raw === "24", "type then Show answer: text kept and saved");
  t(r.revealed && r.attempts.length === 0 && r.events.filter((e) => e.type === "reveal").length === 1, "reveal is an event, not an attempt");
  await reload(page, "cyu-l3");
  t((await page.inputValue(sel.quizInput(Q))) === "24" && await page.isVisible(`.cyu[data-id="${Q}"] > .why`), "after reload: text and reveal restored");
  await page.fill(sel.quizInput(Q), "25"); await page.click(sel.quizCheck(Q));
  r = await rec(page, Q);
  t(r.attempts.length === 1 && r.attempts[0].solutionViewedBeforeSubmit === true && /Answered 1 of 10 · 0 correct/.test(await page.textContent('[data-quiz-score="l3"]')), "check after reveal: answered, not first-try correct");
  await go(page, "l3-problems");
  const P = "cse332-w2-l3-log-base";
  await page.locator(sel.part(`${P}.log8-divisor`)).pressSequentially("3", { delay: 0 });
  await page.click(`${sel.task(P)} .task-actions button:has-text("hint")`);
  r = await rec(page, P);
  t((await page.inputValue(sel.part(`${P}.log8-divisor`))) === "3" && r.parts["log8-divisor"].raw === "3" && r.hintsRevealed === 1, "type then hint: text kept");
  await page.locator(sel.work(P)).pressSequentially("change of base", { delay: 0 });
  await page.click(`${sel.task(P)} .task-actions button:has-text("Show solution")`);
  t((await rec(page, P)).work === "change of base", "type in work then Show solution: text kept");
  await reload(page, "l3-problems");
  t((await page.inputValue(sel.part(`${P}.log8-divisor`))) === "3" && (await page.inputValue(sel.work(P))) === "change of base", "both restored after reload");
  const QC = "cse332-w2-l3-notation-sq17-upper-n0";
  await go(page, "notation");
  await page.locator(sel.qcInput(QC)).pressSequentially("5", { delay: 0 });
  await reload(page, "notation");
  t((await page.inputValue(sel.qcInput(QC))) === "5" && (await rec(page, QC)).correct === null, "quick-check draft survives an immediate reload, ungraded");
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}

/* =========================================================== 7. save failure, retry, recovery; transient notices only */
group = "failure";
{
  const page = await open({ hash: "l3-problems", mock: { failAll: true, latencyMs: 50, persistKey: "mock-fail" } });
  const P = "cse332-w2-l3-example1-bigo";
  t((await page_noSaveStatus(page)).bad === false && (await page_noSaveStatus(page)).els === 0, "no save status before anything happens");
  await page.fill(sel.work(P), "pick c = 10, then n(n-1) >= 10");
  await page.waitForSelector('.toast[data-notice="save-failed"]', { timeout: 5000 });
  t(await page.isVisible('.toast[data-notice="save-failed"]'), "transient save-failed notice shown");
  await page.locator(sel.task(P)).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/desktop-save-failure-toast.png` });
  t((await page.inputValue(sel.work(P))) === "pick c = 10, then n(n-1) >= 10", "typed text still on the page");
  await fillProblemRight(page, P);
  await page.dblclick(sel.taskCheck(P));
  await page.fill(sel.part(`${P}.smallest-n0-c10`), "10"); await page.click(sel.taskCheck(P));
  const ids = (await rec(page, P)).attempts.map((a) => a.attemptId);
  t(ids.length === 3, "3 attempts recorded while failing");
  await reload(page, "l3-problems");
  t((await page.inputValue(sel.work(P))) === "pick c = 10, then n(n-1) >= 10" && (await rec(page, P)).attempts.length === 3, "reload during outage keeps text and attempts");
  t((await page.evaluate(() => window.__mock.changes.length)) === 0, "nothing reached the server yet");
  await page.evaluate(() => window.__mock.set({ failAll: false }));
  await page.evaluate(() => window.CourseSite.flush());
  await page.waitForSelector('.toast[data-notice="save-recovered"]', { timeout: 10000 });
  t(true, "transient recovery notice shown");
  const delivered = await page.evaluate(() => window.__mock.changes.filter((c) => c.kind === "attempt").map((c) => c.attempt.attemptId));
  t(delivered.length === 3 && ids.every((id) => delivered.filter((d) => d === id).length === 1), "every attempt delivered exactly once after recovery");
  t((await page.evaluate((id) => window.__mock.remote.items[id].work, P)) === "pick c = 10, then n(n-1) >= 10", "work text reached the server");
  t((await page.evaluate(() => window.CourseSite.pending())) === 0, "outbox drained");
  await sleep(7600);
  t((await page.$$eval(".toast", (x) => x.length)) === 0, "notices are gone after a few seconds");
  const st = await page_noSaveStatus(page);
  t(!st.bad && st.els === 0, `no persistent save status text or element in the page (${JSON.stringify(st)})`);
  // and none on any route, after lots of saving
  for (const r of ["home", "search", "l3-problems", "cyu-l3", "cheatsheet"]) { await go(page, r); const s2 = await page_noSaveStatus(page); t(!s2.bad && s2.els === 0, `${r}: no persistent save status`); }
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}
{
  const page = await open({ hash: "home", mock: { latencyMs: 1500 } }).catch(() => null);
  t(page !== null && page.errors.length === 0, "slow adapter (1.5 s) boots without errors");
  if (page) await page.context().close();
  const ctx = await browser.newContext();
  await ctx.addInitScript(`${MOCK_SRC}\n;window.__mock = MockAdapter.create({ failLoad: true }); window.COURSE_SITE_STORAGE = window.__mock.adapter;`);
  const p2 = await ctx.newPage();
  await p2.goto(`${url}/#home`);
  await p2.waitForFunction(() => document.documentElement.dataset.ready === "true");
  t(await p2.isVisible('.toast[data-notice="load-failed"]'), "load failure: transient notice, site still works");
  await ctx.close();
  // newer schema version on the server: never overwritten
  const ctx3 = await browser.newContext();
  await ctx3.addInitScript(`${MOCK_SRC}\n;window.__mock = MockAdapter.create({ initial: { siteId: "${SITE}", schemaVersion: 99, items: {} } }); window.COURSE_SITE_STORAGE = window.__mock.adapter;`);
  const p3 = await ctx3.newPage();
  await p3.goto(`${url}/#l3-problems`);
  await p3.waitForFunction(() => document.documentElement.dataset.ready === "true");
  await p3.fill(sel.work("cse332-w2-l3-log-base"), "typed with a newer server");
  await sleep(900);
  t(await p3.isVisible('.toast[data-notice="newer-version"]') && (await p3.evaluate(() => window.__mock.saveCalls)) === 0, "newer server schema: notice, no writes");
  await ctx3.close();
}

/* =========================================================== 8. conflict from the adapter */
group = "conflict";
{
  const page = await open({ hash: "l3-problems", mock: { persistKey: "mock-conflict" } });
  const P = "cse332-w2-l3-log-base";
  await page.fill(sel.work(P), "local reasoning");
  await fillProblemRight(page, P); await page.click(sel.taskCheck(P));
  await page.evaluate(() => window.CourseSite.flush());
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
  t(r.attempts.length === 2 && r.attempts.some((a) => a.attemptId === "remote-attempt-1") && new Set(r.attempts.map((a) => a.attemptId)).size === 2, "attempts unioned by attemptId");
  t(/remote device text/.test(await page.textContent(`${sel.task(P)} .conflict-copy`)), "the other device's text is kept and shown");
  const server = await page.evaluate((id) => window.__mock.remote.items[id], P);
  t(server.attempts.length === 2 && server.work === "local reasoning, more", "server ends with the merged record");
  t(page.errors.length === 0, `no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}

/* =========================================================== 9. change events + host API */
group = "events";
{
  const page = await open({ hash: "cyu-l3" });
  await page.evaluate(() => { window.__ev = []; document.addEventListener("course-site:change", (e) => window.__ev.push(e.detail)); });
  const Q = "cse332-w2-l3-cyu-sq17-n0";
  await page.fill(sel.quizInput(Q), "5"); await page.click(sel.quizCheck(Q)); await page.click(sel.quizShow(Q));
  const ev = await page.evaluate(() => window.__ev);
  t(ev.some((e) => e.kind === "snapshot" && e.itemId === Q && e.record.raw === "5"), "snapshot change event");
  const a = ev.find((e) => e.kind === "attempt");
  t(a && a.attempt.itemId === Q && a.attempt.answer.raw === "5" && a.attempt.answer.normalized === "5" && a.attempt.result.overall === true && a.siteId === SITE && a.schemaVersion === 2, "attempt change event shape");
  t(ev.some((e) => e.kind === "event" && e.event.type === "reveal"), "reveal event");
  t(ev.every((e) => e.changeId && e.at), "every change has changeId and timestamp");
  const api = await page.evaluate(() => ({ id: window.CourseSite.siteId, v: window.CourseSite.schemaVersion, s: window.CourseSite.storage(), keys: Object.keys(window.CourseSite.exportState()) }));
  t(api.id === SITE && api.v === 2 && api.s === "localStorage" && api.keys.join() === "siteId,schemaVersion,rev,updatedAt,items", "host API");
  const ls = await page.evaluate(() => Object.keys(localStorage));
  t(ls.every((k) => k.startsWith(`${"cse332-26au-week2"}:`)), `localStorage keys are namespaced to week 2 (${ls})`);
  await page.context().close();
}

/* =========================================================== 10. mobile screenshots of interactive pieces */
group = "mobile-shots";
{
  const page = await open({ viewport: MOBILE, hash: "l3-problems" });
  const GH = "cse332-w2-l3-gap-halving";
  await page.fill(sel.part(`${GH}.solve-4096`), "2048"); await page.click(sel.taskCheck(GH));
  await page.locator(sel.task(GH)).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/mobile-problem-feedback.png` });
  await go(page, "cyu-l3");
  await page.check(sel.quizRadio("cse332-w2-l3-cyu-definition-order", 1)); await page.click(sel.quizCheck("cse332-w2-l3-cyu-definition-order"));
  await page.screenshot({ path: `${SHOTS}/mobile-quiz.png` });
  t((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, "mobile quiz no overflow after feedback");
  await go(page, "examples");
  await page.locator("#rel").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/mobile-classifier-verdicts.png` });
  await page.context().close();
  const p2 = await open({ viewport: MOBILE, hash: "l3-problems", mock: { failAll: true } });
  await p2.fill(sel.work("cse332-w2-l3-log-base"), "typing during an outage");
  await p2.waitForSelector('.toast[data-notice="save-failed"]');
  await p2.locator(sel.task("cse332-w2-l3-log-base")).scrollIntoViewIfNeeded();
  await p2.screenshot({ path: `${SHOTS}/mobile-save-failure-toast.png` });
  t((await p2.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, "toast causes no overflow on mobile");
  await p2.context().close();
}

await browser.close();
srv.close();
console.log(Object.entries(results).map(([g, r]) => `  ${g}: ${r.pass} passed, ${r.fail} failed`).join("\n"));
console.log(`browser: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
