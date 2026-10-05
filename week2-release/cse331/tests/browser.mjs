// Browser tests (Playwright, headless Chromium) for the CSE 331 week 2 site.
// Covers: every route at 1280x800 and 390x844 (no console errors, no horizontal overflow, listings rendered,
// in-page links resolve, no persistent save status, no network requests); the runner, shell, argument walker,
// edge lab and comparison against the Java-verified simulator; right, wrong and unreadable answers for every
// answer type (feedback never leaks the answer); hints, the solution gate, self-marks; the sorter; the quiz;
// the inventory (coverage, unique, non-positional IDs); grading state (edit invalidates, reload restores the
// draft ungraded, attempts are append-only); persistence across reload; adapter failure + recovery and
// conflicts via examples/mock-adapter.js; file:// with no network; timing labels; screenshots.
// Usage: node tests/browser.mjs
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { start } from "./serve.mjs";

const req = createRequire(import.meta.url);
const base = new URL("../", import.meta.url).pathname;
const shots = join(base, "screenshots");
mkdirSync(shots, { recursive: true });
const S = req("../site/js/sum-sim.js");
globalThis.self = globalThis;
req("../site/js/keys.js");
const KEYS = globalThis.ANSWER_KEYS;
const inventory = JSON.parse(readFileSync(join(base, "export", "state-inventory.json"), "utf8"));

const srv = await start(0);
const URL0 = `http://localhost:${srv.address().port}/`;
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL:", msg); } };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function newPage(viewport, url = URL0, { blockNetwork = true } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.errors = [];
  page.external = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") page.errors.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  if (blockNetwork) await page.route(/^https?:\/\/(?!localhost)/, (r) => { page.external.push(r.request().url()); r.abort(); });
  await page.goto(url);
  await page.waitForSelector("html[data-ready]");
  return page;
}
const open = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForSelector(`#${hash}.is-active`); await page.waitForTimeout(40); };
const text = (page, sel) => page.locator(sel).first().innerText();
const SAVE_STATUS = /\b(saved at|saving…|saving\.\.\.|all changes saved|unsaved changes|last saved|autosaved)\b/i;

/* =============================================================== every route, both viewports */
const routes = await (async () => { const p = await newPage({ width: 1280, height: 800 }); const r = await p.$$eval(".page", (ps) => ps.map((x) => x.id)); await p.context().close(); return r; })();
ok(routes.length === 11, `11 routes (got ${routes.length}: ${routes.join(", ")})`);
for (const vp of [{ width: 1280, height: 800, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
  const page = await newPage(vp);
  for (const id of routes) {
    await open(page, id);
    const info = await page.evaluate((pid) => {
      const p = document.getElementById(pid);
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        scrollY: window.scrollY,
        emptyCode: [...p.querySelectorAll("pre.code")].filter((x) => !x.querySelector(".ln")).length,
        emptyTerms: [...p.querySelectorAll(".term[data-session]")].filter((x) => !x.querySelector(".tl.cmd")).length,
        brokenLinks: [...p.querySelectorAll('a[href^="#"]')].filter((a) => a.getAttribute("href").length > 1 && !document.getElementById(a.getAttribute("href").slice(1))).map((a) => a.getAttribute("href")),
        bodyText: document.body.innerText,
      };
    }, id);
    ok(info.overflow <= 0, `${vp.name} ${id}: no horizontal overflow (${info.overflow}px)`);
    ok(info.scrollY === 0, `${vp.name} ${id}: opens at the top (scrollY ${info.scrollY})`);
    ok(info.emptyCode === 0, `${vp.name} ${id}: every code listing rendered`);
    ok(info.emptyTerms === 0, `${vp.name} ${id}: every terminal rendered`);
    ok(info.brokenLinks.length === 0, `${vp.name} ${id}: in-page links resolve ${info.brokenLinks}`);
    ok(!SAVE_STATUS.test(info.bodyText), `${vp.name} ${id}: no persistent save-status text`);
  }
  ok(page.errors.length === 0, `${vp.name}: no console errors (${page.errors.join(" | ")})`);
  ok(page.external.length === 0, `${vp.name}: no network requests outside the site (${page.external.join(", ")})`);
  await page.context().close();
}

/* =============================================================== content, timing labels, no boilerplate */
const page = await newPage({ width: 1280, height: 800 });
{
  const all = await page.evaluate(() => document.body.textContent);
  ok(/Today · Mon Oct 5/.test(all), "Lecture 3 labelled 'Today · Mon Oct 5'");
  ok(!/\btaught\b/i.test(all), "nothing is labelled 'taught'");
  const later = await text(page, ".later-list");
  ok((later.match(/materials not posted yet/g) || []).length === 3 && /Section 1/.test(later) && /Testing 1/.test(later) && /Testing 2/.test(later), "Section 1 and Testing 1/2: upcoming, materials not posted yet");
  ok(/Homework 1 due/.test(later) && await page.locator('.later-list a[href$="homework/hw1.html"]').count() === 1, "Homework 1: due date and link");
  ok(!/academic (misconduct|integrity)|AI policy|ai-assistance|AI use/i.test(all), "no AI-policy or academic-integrity text anywhere on the site");
  ok(await page.locator("#l3-discuss, #l3-strength, #l3-sum, #l3-batch, #l3-manual, #l3-edge").count() === 6, "six Lecture 3 modules");
  ok(await page.locator('.page[id*="section"], .page[id*="testing"], .page[id*="s1-"]').count() === 0, "no invented Section 1 or Testing pages");
  ok((await text(page, "#l3-quiz .where")).includes("written for this site"), "quiz marked as written for the site");
  ok(await page.locator("details.notes").count() === await page.locator("details.notes[open]").count(), "every teaching-notes block is open by default");
  ok(await page.locator(".cyu[data-id]").count() >= 8 && await page.locator(".cyu[data-id]").count() <= 12, "8-12 quiz questions");
  ok(await page.locator("article.task[data-id]").evaluateAll((ts) => ts.every((t) => t.querySelector(".hints li") && t.querySelector(".solution .steps li.answer") && t.querySelector(".answer-spec"))), "every problem has hints, a stepped solution ending in an answer, and answer boxes");
  ok(!/from section\d+\.pdf|exercise \d+ from the notes, task/i.test(await page.locator("article.task").allInnerTexts().then((x) => x.join(" "))), "no per-problem source lines");
}
// the listing on the page is exactly tests/java/Sum.java
{
  const norm = (s) => s.split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").trim();
  await open(page, "l3-sum");
  const listing = await page.$$eval("#map-code .ln .src", (r) => r.map((x) => x.textContent).join("\n"));
  ok(norm(listing) === norm(readFileSync(join(base, "tests/java/Sum.java"), "utf8")), "page listing = tests/java/Sum.java (99 lines)");
  ok(await page.$$eval("#map-code .ln", (r) => r.length) === 99, "listing has 99 numbered lines");
}
// every terminal on the site agrees with the simulator
{
  const terms = await page.$$eval(".term[data-session]", (els) => els.map((e) => ({ s: e.dataset.session, text: e.querySelector(".term-body").innerText })));
  for (const t of terms) {
    const sh = S.createShell();
    const outs = JSON.parse(t.s).flatMap(([l, kb]) => sh.exec(l, kb).entries.filter((e) => e.kind === "out" || e.kind === "err").map((e) => e.text));
    ok(outs.every((o) => t.text.includes(o)), `terminal ${t.s} shows the simulator's output`);
  }
}

/* =============================================================== the hero runner */
await open(page, "home");
{
  const hero = page.locator('.runner[data-runner="hero"]');
  const set = async (args, stdin) => { await hero.locator(".args-input").fill(args); await hero.locator(".stdin-input").fill(stdin); await page.waitForTimeout(220); };
  const read = async () => ({ out: await hero.locator(".ch-out .ch-body").innerText(), err: await hero.locator(".ch-err .ch-body").innerText(), st: await hero.locator(".st-num").innerText() });
  const cases = [["", "3 4 5"], ["-a", "3 4 5"], ["nums.txt", ""], ["", "1 2 three 4"], ["", "2147483647 1"], ["-a", ""], ["--help", ""], ["precision=4", ""], ["-a --precision=2", "1 2"], ["'my file.txt'", ""], ["-a --precision=2147483647", "1"]];
  for (const [args, stdin] of cases) {
    await set(args, stdin);
    const r = await read();
    const argv = S.lex(args).toks.map((t) => t.v);
    const sim = S.run(argv, { stdin, files: S.DEFAULT_FILES() });
    ok(r.st === String(sim.status) && (sim.stdout ? r.out === sim.stdout.replace(/\n$/, "") : r.out === "(nothing)") && (sim.stderr ? r.err === sim.stderr.replace(/\n$/, "") : r.err === "(nothing)"), `runner: java Sum ${args} <<< ${JSON.stringify(stdin)} → status ${r.st}`);
  }
  await set("nums.txt", "1 2");
  ok((await text(page, '.runner[data-runner="hero"] .rn-note')).includes("never read"), "runner says typed input is not read when a file is named");
  // edit a file and re-run
  await hero.locator(".rn-files summary").click();
  await hero.locator('textarea[aria-label="Contents of nums.txt"]').fill("10 20 30");
  await page.waitForTimeout(150);
  ok((await read()).out === "60", "editing nums.txt changes the run");
  await page.click('.runner[data-runner="hero"] .rn-presets button:has-text("the lecture")');
  ok((await read()).out === "12", "preset: the lecture's first run");
}

/* =============================================================== the shell, argument walker, comparison, edge lab, promises */
await open(page, "l3-batch");
{
  const sh = page.locator('.shell[data-shell="redirect"]');
  for (let i = 0; i < 6; i++) await sh.locator(".sh-next .btn.primary").click();
  const t = await sh.locator(".term-body").innerText();
  ok(/echo \$\?[\s\S]*\n0\n[\s\S]*12[\s\S]*Sum: not an integer: x[\s\S]*echo \$\?[\s\S]*\n1\n/.test(t), "redirect script: 0, 12, message, 1");
  ok(await sh.locator('.sh-file:has(code:text-is("total.txt")) pre').innerText() === "(empty)", "total.txt is empty after the failed run");
  await sh.locator(".sh-input").fill("java Sum bad.txt 2> errors.txt; echo $?; cat errors.txt");
  await sh.locator(".sh-input").press("Enter");
  ok((await sh.locator(".term-body").innerText()).trim().endsWith("Sum: not an integer: x"), "typed command: 2> and cat");
  await page.fill("#argwalk-input", "precision=4 nums.txt");
  ok((await text(page, "#argwalk-verdict")).includes("too many file arguments: nums.txt"), "argument walker: dashes missing");
  await page.fill("#argwalk-input", "'my file.txt' -a");
  ok((await text(page, "#argwalk-array")).includes('"my file.txt"'), "argument walker: quotes keep one argument");
}
await open(page, "l3-sum");
{
  await page.fill("#compare-input", "2147483647 1"); await page.click("#compare-run");
  ok((await text(page, "#compare-l1")).includes("-2147483648") && (await text(page, "#compare-l3")).includes("2147483648"), "comparison: Lecture 1 wraps, Lecture 3 doesn't");
  await page.click('#program-map [data-range="95-98"]');
  ok(await page.locator("#map-code .ln.hl").count() === 4 && (await text(page, "#map-note")).includes("fail"), "program map highlights fail");
}
await open(page, "l3-edge");
{
  const lab = page.locator("#edge-lab .runner");
  ok((await lab.locator(".ch-err .ch-body").innerText()).startsWith("Sum: --precision must not be negative"), "edge lab: with the check");
  await page.click("#edge-neg");
  await page.waitForTimeout(60);
  ok((await lab.locator(".ch-err .ch-body").innerText()).startsWith('Exception in thread "main" java.util.UnknownFormatConversionException') && await lab.locator(".st-num").innerText() === "1", "edge lab: lines 40-43 removed → stack trace, status 1");
  ok(await page.locator("#edge-code-a .ln.removed").count() === 4, "edge lab: lines 40-43 shown removed");
  await lab.locator('.rn-presets button:has-text("nothing to average")').click();
  await page.click("#edge-count"); await page.waitForTimeout(60);
  ok(await lab.locator(".ch-out .ch-body").innerText() === "NaN" && await lab.locator(".st-num").innerText() === "0", "edge lab: lines 73-75 removed → NaN, status 0");
  await page.click("#edge-neg"); await page.click("#edge-count");
}
await open(page, "l3-strength");
{
  await page.locator(".manual-btn").nth(0).click(); await page.locator(".manual-btn").nth(1).click();
  ok((await text(page, "#promise-out")).startsWith("MA is stronger than MB"), "promises: MA stronger than MB");
  await page.locator(".manual-btn").nth(4).click();
  ok((await text(page, "#promise-out")).includes("incomparable"), "promises: MB vs ME incomparable");
}

/* =============================================================== quick checks: wrong (no leak), unreadable, right */
async function quick(id, value) {
  const box = page.locator(`.check[data-id="${id}"]`);
  await open(page, await box.evaluate((n) => n.closest(".page").id));
  await box.locator("input").fill(value);
  await box.locator("button.primary").click();
  return box.locator(".feedback").innerText();
}
let f = await quick("cse331-w2-l3-qc-average-of-four", "2.50");
ok(f.includes("println") && !f.includes("2.5\b"), "qc: 2.50 gets the println misconception, no leak");
f = await quick("cse331-w2-l3-qc-average-of-four", "2.5");
ok(f === "Correct.", "qc: 2.5 correct");
f = await quick("cse331-w2-l3-qc-status-after-bad", "1.0");
ok(f.startsWith("Couldn't read"), "qc: 1.0 unreadable (exact integers)");
f = await quick("cse331-w2-l3-qc-status-after-bad", "0");
ok(f.includes("succeed") && !/\b1\b/.test(f), "qc: 0 gets the misconception, no leak");
f = await quick("cse331-w2-l3-qc-status-after-bad", "1");
ok(f === "Correct.", "qc: status 1 correct");
f = await quick("cse331-w2-l3-qc-message-stream", "System.err");
ok(f === "Correct.", "qc: System.err accepted for standard error");
f = await quick("cse331-w2-l3-qc-hasnextint-line", "65");
ok(f.includes("reports") && !f.includes("61"), "qc line: 65 misconception, no leak");
f = await quick("cse331-w2-l3-qc-b-vs-d", "incomparable");
ok(f.includes("Incomparable needs") && !/\bstronger\b/i.test(f), "qc strength: misconception, no leak");
f = await quick("cse331-w2-l3-qc-junit-kind", "automated");
ok(f === "Correct.", "qc text: automated");

/* =============================================================== sorter */
await open(page, "l3-manual");
{
  const card = (id) => page.locator(`.check[data-id="${id}"]`);
  await card("cse331-w2-l3-sort-too-big-integer").locator('button[data-option="silent"]').click();
  let fb = await card("cse331-w2-l3-sort-too-big-integer").locator(".feedback").innerText();
  ok(fb.startsWith("Not quite") && !/contradict/i.test(fb), "sorter: wrong choice, hint without the answer");
  await card("cse331-w2-l3-sort-too-big-integer").locator('button[data-option="contradicted"]').click();
  ok((await card("cse331-w2-l3-sort-too-big-integer").locator(".feedback").innerText()).startsWith("Right."), "sorter: right choice");
  for (const [id, o] of [["file-sum", "described"], ["average-two-decimals", "described"], ["empty-sum", "described"], ["empty-average", "silent"], ["word-in-input", "silent"], ["exit-status", "silent"], ["help", "silent"]]) await card(`cse331-w2-l3-sort-${id}`).locator(`button[data-option="${o}"]`).click();
  ok((await text(page, "#sorter-score")).startsWith("8 of 8 sorted right"), "sorter: all eight");
  const atts = await page.evaluate(() => CourseSite.attemptsOf("cse331-w2-l3-sort-too-big-integer"));
  ok(atts.length === 2 && atts[0].result.correct === false && atts[1].result.correct === true && atts[0].answer.choiceId === "silent", "sorter: two attempts recorded in order");
}

/* =============================================================== problems */
await open(page, "l3-exercises");
{
  const task = (id) => page.locator(`article.task[data-id="${id}"]`);
  const fill = async (id, part, v) => { const inp = task(id).locator(`.answer-spec[data-part="${part}"] input, .answer-spec[data-part="${part}"] textarea`); await inp.fill(v); };
  const sel = async (id, part, v) => task(id).locator(`.answer-spec[data-part="${part}"] select`).selectOption(v);
  const check = async (id) => { await task(id).locator(".check-btn").click(); return task(id).locator(".my-work > .feedback").innerText(); };
  const partFb = (id, part) => task(id).locator(`.answer-spec[data-part="${part}"] .part-fb`).innerText();
  // P1: exact output, stream
  const P1 = "cse331-w2-l3-predict-lecture1-runs";
  await fill(P1, "word-output", "7"); await fill(P1, "word-stream", "stdout"); await fill(P1, "big-output", "-2147483648");
  f = await check(P1);
  ok(f.startsWith("0 of 3"), "P1 all wrong");
  const pf = await partFb(P1, "big-output");
  ok(pf.includes("line 57") && !pf.includes("2147483648"), "P1 big: int-wraps misconception, no leak");
  await fill(P1, "word-output", "sum: not an integer: three");
  await check(P1);
  ok((await partFb(P1, "word-output")).includes("exactly"), "P1 near miss: case must match");
  await fill(P1, "word-output", "Sum: not an integer: three"); await fill(P1, "word-stream", "standard error"); await fill(P1, "big-output", "2147483648");
  ok(await check(P1) === "Correct.", "P1 correct");
  ok(await task(P1).locator(".pill").innerText() === "Correct", "P1 pill: Correct");
  // edit after check clears the grade
  await fill(P1, "big-output", "2147483648 ");
  ok(await task(P1).locator(".pill").innerText() !== "Correct", "P1: editing after Check clears the grade at once");
  await fill(P1, "big-output", "2147483648");
  ok(await task(P1).locator(".pill").innerText() !== "Correct", "P1: re-entering the graded value stays ungraded until a new Check");
  await check(P1);
  // P2: "nothing" answers and ints
  const P2 = "cse331-w2-l3-predict-redirect";
  for (const [p, v] of [["good-terminal", "nothing"], ["good-file", "12"], ["good-status", "0"], ["bad-terminal", "Sum: not an integer: x"], ["bad-file", "Sum: not an integer: x"], ["bad-status", "1"]]) await fill(P2, p, v);
  f = await check(P2);
  ok(f.startsWith("5 of 6") && (await partFb(P2, "bad-file")).includes("only standard output"), "P2: message-in-file misconception");
  await fill(P2, "bad-file", "(nothing)");
  ok(await check(P2) === "Correct.", "P2 correct with (nothing)");
  // P3: text + output + ints, run button
  const P3 = "cse331-w2-l3-predict-no-negative-check";
  for (const [p, v] of [["format", "%.-1f%n"], ["exception", "IllegalFormatPrecisionException"], ["line", "78"], ["status", "0"]]) await fill(P3, p, v);
  f = await check(P3);
  ok(f.startsWith("2 of 4") && !(await partFb(P3, "exception")).includes("UnknownFormat"), "P3 partial, exception feedback doesn't leak");
  await fill(P3, "exception", "java.util.UnknownFormatConversionException"); await fill(P3, "status", "1");
  ok(await check(P3) === "Correct.", "P3 correct");
  await task(P3).locator(".sol-btn").click();
  await task(P3).locator("[data-run-cmd]").click();
  ok((await task(P3).locator(".run-out").innerText()).includes("UnknownFormatConversionException"), "P3 run button runs the copy without lines 40-43");
  // P7: letters + yes/no + self
  const P7 = "cse331-w2-l3-split-sum";
  await fill(P7, "relies-on", "A B C D E F G"); await fill(P7, "missing-check", "yes");
  f = await check(P7);
  ok(f.startsWith("1 of 2") && (await partFb(P7, "relies-on")).includes("never sees"), "P7 all-checks misconception");
  await fill(P7, "relies-on", "G, C");
  ok((await check(P7)).startsWith("Correct."), "P7 auto parts correct");
  ok(await task(P7).locator(".pill").innerText() === "Answers right · mark the rest", "P7 waits for the self-check part");
  await fill(P7, "spec", "static String answer(long sum, long count, ...) @requires count > 0");
  await task(P7).locator(".sol-btn").click();
  await task(P7).locator('.self-mark button:has-text("I got it")').click();
  ok(await task(P7).locator(".pill").innerText() === "Correct", "P7 correct after self-mark");
  // P8: strength + choice selects
  const P8 = "cse331-w2-l3-compare-manuals";
  await fill(P8, "m1-vs-m2", "weaker"); await sel(P8, "status-script", "m1"); await sel(P8, "message-script", "both");
  f = await check(P8);
  ok(f.startsWith("0 of 3"), "P8 all wrong");
  await fill(P8, "m1-vs-m2", "stronger"); await sel(P8, "status-script", "both"); await sel(P8, "message-script", "m1");
  ok((await check(P8)).startsWith("Correct."), "P8 auto parts correct");
  // hints and the solution gate
  const P9 = "cse331-w2-l3-add-help";
  await task(P9).locator(".hint-btn").click();
  ok(await task(P9).locator(".hints li:not([hidden])").count() === 1 && (await task(P9).locator(".hint-btn").innerText()).includes("1 of 2"), "P9: first hint");
  ok(!/\b0\b|\b2\b|stdout|standard output/.test(await task(P9).locator(".hints li").first().innerText()), "P9: the hint doesn't contain an answer");
  await task(P9).locator(".sol-btn").click();
  ok((await task(P9).locator(".my-work > .feedback").innerText()).startsWith("You haven't answered"), "P9: solution asks for confirmation before any attempt");
  await task(P9).locator(".sol-btn").click();
  ok(await task(P9).locator(".solution").isVisible(), "P9: solution opens on the second press");
  await task(P9).locator(".steps .btn.primary").click();
  ok(await task(P9).locator(".steps li:not([hidden])").count() === 1, "P9: solution reveals one step at a time");
  ok((await text(page, "#l3-exercises .task-progress")).match(/^(\d+) of 9 answered/)[1] === "5", "progress: 5 of 9 answered (problems 1, 2, 3, 7, 8 submitted)");
}

/* =============================================================== quiz */
await open(page, "l3-quiz");
{
  const q = (id) => page.locator(`.cyu[data-id="${id}"]`);
  await q("cse331-w2-l3-quiz-redirect-bad").locator('label[data-option="file-has-message"]').click();
  await q("cse331-w2-l3-quiz-redirect-bad").locator(".check-btn").click();
  ok((await q("cse331-w2-l3-quiz-redirect-bad").locator(".feedback").innerText()).startsWith("Not this one") && await q("cse331-w2-l3-quiz-redirect-bad").locator("label.wrong").count() === 1, "quiz MC wrong");
  await q("cse331-w2-l3-quiz-redirect-bad").locator('label[data-option="message-shows-file-empty"]').click();
  await q("cse331-w2-l3-quiz-redirect-bad").locator(".check-btn").click();
  ok(await q("cse331-w2-l3-quiz-redirect-bad").locator(".feedback").innerText() === "Correct.", "quiz MC right");
  await q("cse331-w2-l3-quiz-two-files-status").locator("input").fill("0");
  await q("cse331-w2-l3-quiz-two-files-status").locator(".check-btn").click();
  ok((await q("cse331-w2-l3-quiz-two-files-status").locator(".feedback").innerText()).includes("only one file"), "quiz num misconception");
  await q("cse331-w2-l3-quiz-two-files-status").locator("input").fill("1");
  await q("cse331-w2-l3-quiz-two-files-status").locator(".check-btn").click();
  ok(await q("cse331-w2-l3-quiz-two-files-status").locator(".feedback").innerText() === "Correct.", "quiz num right");
  // answer the rest right, check the summary
  for (const li of await page.$$(".cyu[data-id]")) {
    const id = await li.getAttribute("data-id");
    const key = KEYS[id];
    if (await li.evaluate((n) => n.classList.contains("is-right"))) continue;
    if (key.type === "choice") await (await li.$(`label[data-option="${key.answer}"]`)).click();
    else await (await li.$("input")).fill(String(key.answer).split("|")[0]);
    await (await li.$(".check-btn")).click();
  }
  const sum = await text(page, '#l3-quiz [data-role="summary"]');
  ok(sum.startsWith("You got 9 of 11 on the first try") && sum.includes("Worth another look"), `quiz summary (${sum.slice(0, 60)})`);
  ok((await text(page, '#l3-quiz [data-role="score"]')).startsWith("Answered 11 of 11"), "quiz score: 11 answered");
}

/* =============================================================== inventory vs DOM */
{
  const dom = await page.evaluate(() => [
    ...[...document.querySelectorAll(".check[data-id], .cyu[data-id], article.task[data-id]")].map((n) => n.dataset.id),
    ...[...document.querySelectorAll(".answer-spec[data-item-id]")].map((n) => n.dataset.itemId),
  ]);
  const inv = inventory.items.map((i) => i.id);
  ok(dom.length === new Set(dom).size, "DOM ids unique");
  ok(dom.every((id) => inv.includes(id)) && inv.every((id) => dom.includes(id)), `inventory covers the DOM exactly (${dom.length} vs ${inv.length})`);
  ok(inv.every((id) => /^cse331-w2-l3-[a-z0-9-]+(\.[a-z0-9-]+)?$/.test(id) && !/-(\d+)$|\.(\d+)$|-q\d+\b|-p\d+\b/.test(id)), "ids are semantic and non-positional");
  ok(Object.keys(KEYS).every((k) => inv.includes(k)), "every answer key belongs to an inventory item");
  ok(!JSON.stringify(inventory).includes('"answer"'), "inventory has no answer field");
}

/* =============================================================== persistence: reload */
{
  const P2 = "cse331-w2-l3-predict-redirect";
  await open(page, "l3-exercises");
  await page.locator(`article.task[data-id="${P2}"] .my-work > textarea`).fill("redirect only moves stdout");
  await page.locator('article.task[data-id="cse331-w2-l3-predict-lecture1-runs"] .answer-spec[data-part="big-output"] input').fill("2147483648 typed after check");
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => CourseSite.attemptsOf("cse331-w2-l3-predict-lecture1-runs"));
  await page.reload(); await page.waitForSelector("html[data-ready]");
  await open(page, "l3-exercises");
  ok(await page.locator(`article.task[data-id="${P2}"] .my-work > textarea`).inputValue() === "redirect only moves stdout", "reload: work box restored");
  ok(await page.locator(`article.task[data-id="${P2}"] .pill`).innerText() === "Correct", "reload: checked problem still Correct");
  ok(await page.locator('article.task[data-id="cse331-w2-l3-predict-lecture1-runs"] .answer-spec[data-part="big-output"] input').inputValue() === "2147483648 typed after check", "reload: draft restored");
  ok(await page.locator('article.task[data-id="cse331-w2-l3-predict-lecture1-runs"] .pill').innerText() !== "Correct", "reload: edited problem not shown as correct");
  const after = await page.evaluate(() => CourseSite.attemptsOf("cse331-w2-l3-predict-lecture1-runs"));
  ok(JSON.stringify(after) === JSON.stringify(before) && after.length === 4, `attempts are append-only and survive reload (${after.length})`);
  ok(after.every((a, i) => a.seq === i + 1 && a.attemptId && a.submittedAt && a.answer.parts), "attempt records have attemptId, seq, submittedAt, answer");
  await open(page, "l3-quiz");
  ok((await text(page, '#l3-quiz [data-role="score"]')).startsWith("Answered 11 of 11"), "reload: quiz state restored");
  await open(page, "l3-manual");
  ok((await text(page, "#sorter-score")).startsWith("8 of 8"), "reload: sorter restored");
  ok(!SAVE_STATUS.test(await page.evaluate(() => document.body.innerText)), "after saving: no save-status text");
}
await page.screenshot({ path: join(shots, "desktop-sorter.png") });
await page.context().close();

/* =============================================================== adapter: failure, recovery, conflict */
{
  const p = await newPage({ width: 1280, height: 800 }, `${URL0}?mock=1`);
  ok(await p.evaluate(() => CourseSite.storage()) === "mock", "mock adapter in use");
  await p.evaluate(() => COURSE_SITE_STORAGE.control.failAlways(true));
  await open(p, "l3-batch");
  await p.locator('.check[data-id="cse331-w2-l3-qc-status-after-bad"] input').fill("1");
  await p.locator('.check[data-id="cse331-w2-l3-qc-status-after-bad"] button.primary').click();
  await p.waitForSelector(".toast.error", { timeout: 4000 });
  ok((await p.locator(".toast.error").innerText()).includes("Couldn't save"), "save failure: transient error toast");
  await p.screenshot({ path: join(shots, "desktop-save-failure-toast.png") });
  ok(await p.locator('.check[data-id="cse331-w2-l3-qc-status-after-bad"] .feedback').innerText() === "Correct.", "save failure: the page keeps working");
  await p.evaluate(() => COURSE_SITE_STORAGE.control.failAlways(false));
  await p.waitForSelector(".toast.ok", { timeout: 8000 });
  ok((await p.locator(".toast.ok").innerText()).includes("Saving works again"), "recovery toast");
  ok((await p.evaluate(() => COURSE_SITE_STORAGE.control.server().attempts["cse331-w2-l3-qc-status-after-bad"].length)) === 1, "the attempt reached the server after recovery");
  await p.waitForTimeout(6500);
  ok(await p.locator(".toast").count() === 0, "toasts disappear on their own");
  ok(!SAVE_STATUS.test(await p.evaluate(() => document.body.innerText)), "after recovery: no save-status text");
  // conflict
  await p.evaluate(() => COURSE_SITE_STORAGE.control.conflictNext((srv) => { srv.attempts["cse331-w2-l3-qc-status-after-bad"].push({ attemptId: "other-device", seq: 2, itemId: "cse331-w2-l3-qc-status-after-bad", submittedAt: "2026-10-05T19:00:00.000Z", kind: "check" }); srv.updatedAt = "2099-01-01T00:00:00.000Z"; return srv; }));
  await p.locator('.check[data-id="cse331-w2-l3-qc-message-stream"] input').fill("stderr");
  await p.locator('.check[data-id="cse331-w2-l3-qc-message-stream"] button.primary').click();
  await p.waitForSelector(".toast.info", { timeout: 4000 });
  ok((await p.locator(".toast.info").innerText()).includes("Merged"), "conflict: merge toast");
  await p.evaluate(() => CourseSite.flush());
  await p.waitForTimeout(300);
  const srvAtt = await p.evaluate(() => COURSE_SITE_STORAGE.control.server().attempts);
  ok(srvAtt["cse331-w2-l3-qc-status-after-bad"].length === 2 && srvAtt["cse331-w2-l3-qc-message-stream"].length === 1, "conflict: attempts from both copies kept");
  ok(p.errors.length === 0, `mock run: no console errors (${p.errors.join(" | ")})`);
  await p.context().close();
}

/* =============================================================== file:// with no network */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, offline: true });
  const p = await ctx.newPage();
  const errs = [];
  const reqs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("request", (r) => { if (!r.url().startsWith("file:")) reqs.push(r.url()); });
  await p.goto(`file://${join(base, "site", "index.html")}#l3-batch`);
  await p.waitForSelector("html[data-ready]");
  const fontOk = await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check("16px 'IBM Plex Mono'") && [...document.fonts].some((f) => f.family.includes("Plex") && f.status === "loaded"); });
  ok(errs.length === 0 && reqs.length === 0, `file:// works offline with no requests (${errs.join(" | ")} ${reqs.join(", ")})`);
  ok(fontOk, "vendored fonts load from file://");
  await ctx.close();
}

/* =============================================================== screenshots */
async function shoot(vp, name, hash, prep) {
  const p = await newPage(vp);
  await open(p, hash);
  if (prep) await prep(p);
  await p.waitForTimeout(120);
  await p.screenshot({ path: join(shots, `${vp.name}-${name}.png`) });
  await p.context().close();
}
for (const vp of [{ width: 1280, height: 800, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
  await shoot(vp, "overview", "home");
  await shoot(vp, "runner-error", "home", async (p) => { await p.click('.runner[data-runner="hero"] .rn-presets button:has-text("a word")'); await p.locator('.runner[data-runner="hero"]').scrollIntoViewIfNeeded(); });
  await shoot(vp, "batch-shell", "l3-batch", async (p) => { const sh = p.locator('.shell[data-shell="redirect"]'); for (let i = 0; i < 6; i++) await sh.locator(".sh-next .btn.primary").click(); await sh.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -80)); });
  await shoot(vp, "manual-sorter", "l3-manual", async (p) => { await p.locator(".sorter").scrollIntoViewIfNeeded(); await p.locator('.check[data-id="cse331-w2-l3-sort-too-big-integer"] button[data-option="contradicted"]').click(); await p.locator('.check[data-id="cse331-w2-l3-sort-empty-average"] button[data-option="described"]').click(); await p.evaluate(() => window.scrollBy(0, -80)); });
  await shoot(vp, "edge-lab", "l3-edge", async (p) => { await p.click("#edge-neg"); await p.locator("#edge-lab .runner").scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -60)); });
  await shoot(vp, "strength", "l3-strength", async (p) => { await p.locator(".manual-btn").nth(0).click(); await p.locator(".manual-btn").nth(1).click(); await p.locator("#promises").scrollIntoViewIfNeeded(); });
  await shoot(vp, "quiz", "l3-quiz", async (p) => { const li = p.locator(".cyu").nth(5); await li.locator('label[data-option="file-has-message"]').click(); await li.locator(".check-btn").click(); await li.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -120)); });
  await shoot(vp, "problem-feedback", "l3-exercises", async (p) => {
    const t = p.locator('article.task[data-id="cse331-w2-l3-predict-redirect"]');
    for (const [part, v] of [["good-terminal", "nothing"], ["good-file", "12"], ["good-status", "0"], ["bad-terminal", "Sum: not an integer: x"], ["bad-file", "Sum: not an integer: x"], ["bad-status", "1"]]) await t.locator(`.answer-spec[data-part="${part}"] input`).fill(v);
    await t.locator(".check-btn").click(); await t.locator(".hint-btn").click();
    await t.locator('.answer-spec[data-part="bad-file"]').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, 120));
  });
  await shoot(vp, "readings", "readings");
  await shoot(vp, "cheatsheet", "cheatsheet");
}
await shoot({ width: 390, height: 844, name: "mobile" }, "menu-open", "l3-sum", async (p) => { await p.click("#menu-btn"); });

await browser.close();
srv.close();
console.log(`${pass}/${pass + fail} browser checks pass`);
process.exit(fail ? 1 : 0);
