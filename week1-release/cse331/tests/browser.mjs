// Browser tests (Playwright, headless Chromium) for the CSE 331 week 1 site.
// Covers: every route at 1280x800 and 390x844 (no console errors, code renders, no horizontal overflow),
// simulators vs the Java-verified models, right and wrong answers with misconception feedback that doesn't
// leak the answer, hints, the solution gate, self-marks, the stepper's truncation boundary (no false claims),
// the Lecture 2 widgets, the state inventory (coverage, unique, non-positional IDs), and persistence:
// reload, rapid double checks, adapter failure + recovery, conflicts, no persistent save status.
// Saves screenshots to ../screenshots/. Usage: node tests/browser.mjs
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const base = new URL("../", import.meta.url).pathname;
const shots = join(base, "screenshots");
mkdirSync(shots, { recursive: true });
const SumSim = req("../site/js/sum-sim.js");
const inventory = JSON.parse(readFileSync(join(base, "export", "state-inventory.json"), "utf8"));

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const MOCK = `<script src="/examples/mock-adapter.js"></script>
<script>window.COURSE_SITE_STORAGE = MockAdapter.create({ persistKey: "mock-server", latencyMs: [20, 120] });</script>
<script src="js/app.js"></script>`;
const srv = createServer((q, r) => {
  const [path, query] = q.url.split("?");
  let p = path.startsWith("/examples/") ? join(base, decodeURIComponent(path)) : join(base, "site", decodeURIComponent(path));
  if (p.endsWith("/")) p += "index.html";
  if (!p.startsWith(base) || !existsSync(p)) { r.writeHead(404); return r.end(); }
  let body = readFileSync(p);
  if (p.endsWith("index.html") && /(^|&)mock=1/.test(query || "")) body = body.toString().replace('<script src="js/app.js"></script>', MOCK);
  r.writeHead(200, { "content-type": types[extname(p)] || "text/plain" });
  r.end(body);
}).listen(0);
const URL0 = `http://localhost:${srv.address().port}/`;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL:", msg); } };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function newPage(viewport, url = URL0) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") page.errors.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(url);
  await page.waitForSelector("html[data-ready]");
  return page;
}
const open = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForSelector(`#${hash}.is-active`); };
const text = (page, sel) => page.locator(sel).first().textContent();

/* =============================================================== every route, both viewports */
const routes = await (async () => { const p = await newPage({ width: 1280, height: 800 }); const r = await p.$$eval(".page", (ps) => ps.map((x) => x.id)); await p.context().close(); return r; })();
ok(routes.length === 19, `19 routes (got ${routes.length})`);
for (const vp of [{ width: 1280, height: 800, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
  const page = await newPage(vp);
  for (const id of routes) {
    await open(page, id);
    const info = await page.evaluate((pid) => {
      const p = document.getElementById(pid);
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        tex: /\\\(|\\\[/.test(p.innerText),
        emptyCode: [...p.querySelectorAll("pre.code")].filter((x) => !x.querySelector(".ln")).length,
        brokenLinks: [...p.querySelectorAll('a[href^="#"]')].filter((a) => a.getAttribute("href").length > 1 && !document.getElementById(a.getAttribute("href").slice(1))).map((a) => a.getAttribute("href")),
        saveStatus: [...document.querySelectorAll("body *")].filter((n) => !n.closest(".toasts") && n.children.length === 0 && /\b(saved at|saving…|all changes saved|unsaved)\b/i.test(n.textContent) && n.offsetParent).length,
      };
    }, id);
    ok(info.overflow <= 0, `${vp.name} ${id}: no horizontal overflow (${info.overflow}px)`);
    ok(!info.tex, `${vp.name} ${id}: no raw TeX`);
    ok(info.emptyCode === 0, `${vp.name} ${id}: every code listing rendered`);
    ok(info.brokenLinks.length === 0, `${vp.name} ${id}: in-page links resolve ${info.brokenLinks}`);
    ok(info.saveStatus === 0, `${vp.name} ${id}: no persistent save status`);
  }
  ok(page.errors.length === 0, `${vp.name}: no console errors (${page.errors.join(" | ")})`);
  await page.context().close();
}

/* =============================================================== content checks, desktop */
const page = await newPage({ width: 1280, height: 800 });
ok(await page.locator(".rail").getByText("Section 1 (Tue, Oct 6) isn't posted yet").count() === 1, "rail says Section 1 isn't posted");
ok((await text(page, "#home")).includes("This content is not yet available"), "home explains the section gap");
ok(await page.locator('.rail a[href="#l2-pieces"]').count() === 1, "Lecture 2 in the rail");

// listings match the Java that was compiled and run
const norm = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
const listing = await page.$$eval("#l1-runs pre.code .ln .src", (r) => r.map((x) => x.textContent).join("\n"));
ok(norm(listing) === norm(readFileSync(join(base, "tests/java/Sum.java"), "utf8")), "Lecture 1 listing = tests/java/Sum.java");
const pieces = await page.$$eval("#l2-pieces pre.code .ln .src", (r) => r.map((x) => x.textContent).join("\n"));
ok(norm(pieces) === norm(readFileSync(join(base, "tests/java/SumPieces.java"), "utf8").replace("public class SumPieces", "public class Sum").replace(/^\/\/.*\n/, "")), "Lecture 2 listing = tests/java/SumPieces.java");
ok(await page.$$eval("#l2-pieces pre.code .ln", (r) => r.length) === 29, "Lecture 2 listing has 29 numbered lines, as in the notes");

// transcripts agree with the simulator
const terms = await page.$$eval(".term[data-input]", (els) => els.map((e) => ({ input: e.dataset.input, text: e.innerText })));
for (const t of terms) ok(t.text.includes(SumSim.run("orig", t.input).stdout[2]), `transcript ${JSON.stringify(t.input)}`);

// hero and hunt
await open(page, "home");
await page.click('#hero [data-try="2147483647 1"]');
ok((await text(page, "#hero-term")).includes("-2147483648") && (await text(page, "#hero-verdict")).startsWith("Counterexample"), "hero overflow run");
await open(page, "l1-runs");
await page.click("#hunt-run");
ok((await text(page, "#hunt-found")).includes("1 of 5"), "hunt records a find");

// quick checks: wrong (misconception, no leak), unreadable, right
async function quick(id, value) {
  const box = page.locator(`.check[data-id="${id}"]`);
  await open(page, await box.evaluate((n) => n.closest(".page").id));
  await box.locator("input").fill(value);
  await box.locator("button").click();
  return box.locator(".feedback").textContent();
}
let f = await quick("cse331-w1-l1-qc-spec-predicts-sum", "2147483656");
ok(f.includes("stops at the first thing") && !f.includes("8"), "quick check misconception feedback, no leak");
f = await quick("cse331-w1-l1-qc-spec-predicts-sum", "8.0");
ok(f.startsWith("Couldn't read"), "quick check rejects 8.0 as unreadable (exact integers)");
f = await quick("cse331-w1-l1-qc-spec-predicts-sum", "8");
ok(f.startsWith("Correct"), "quick check right");
f = await quick("cse331-w1-l2-qc-impls-meeting-d", "1");
ok(f.includes("any match") && !/\b2\b/.test(f), "L2 quick check misconception");

// stepper: complete run, and the truncation boundary
await open(page, "l1-assert");
await page.click('#stepper [data-st="1 2 three 4"]');
await page.click("#st-p1");
ok((await text(page, "#st-vars")).includes("[1, 2]") && (await page.locator(".tok.stopped").textContent()) === "three", "stepper reaches (1)");
await page.click('#stepper [data-st="2147483647 1"]');
await page.click("#st-p2");
ok((await text(page, "#st-assert")).includes("wraps to -2147483648"), "stepper explains the wrap at (2)");
const longInput = Array.from({ length: 15 }, (_, i) => String(i + 1)).join(" ");
await page.fill("#st-input", longInput);
ok(await page.locator("#st-p1").isDisabled() && await page.locator("#st-p2").isDisabled(), "truncated: Run to (1)/(2) disabled");
ok((await text(page, "#st-count")).includes("Truncated"), "truncated: says so");
let guard = 0;
while (!(await page.locator("#st-step").isDisabled()) && guard++ < 200) await page.click("#st-step");
const finalAssert = await text(page, "#st-assert"), finalOut = await text(page, "#st-out"), finalVars = await text(page, "#st-vars");
ok(finalAssert.includes("Stepper stopped after 12 of the 15 numbers"), "truncated: last step says where it stopped");
ok(!/true on this run|point \(1\)|point \(2\)|holds/i.test(finalAssert), "truncated: no assertion verdict at the boundary");
ok(!/The sum of your list was|Got \[/.test(finalOut), "truncated: no Got/sum line printed");
ok(/sum—/.test(finalVars.replace(/\s/g, "")), "truncated: sum not shown");
await page.locator("#st-assert").scrollIntoViewIfNeeded();
await page.screenshot({ path: join(shots, "desktop-stepper-truncated.png"), fullPage: false });
await page.fill("#st-input", "3 4 5");
while (!(await page.locator("#st-step").isDisabled())) await page.click("#st-step");
ok((await text(page, "#st-out")).includes("The sum of your list was: 12"), "untruncated run steps to the end");

// edge toggle
await open(page, "l1-edge");
await page.click('[data-guard="hasnext"]');
ok((await text(page, "#edge-term")).includes("InputMismatchException"), "hasNext version crashes");

// Lecture 2 widgets
await open(page, "l2-pieces");
await page.click('#pieces-panel [data-try="2147483647 1"]');
ok((await text(page, "#pieces-old")) === (await text(page, "#pieces-new")) && (await text(page, "#pieces-verdict")).startsWith("Same"), "two Sum programs, same output");
await open(page, "l2-javadoc");
await page.click('#middle-panel [data-try="[1, 2, 3, 4]"]');
ok((await text(page, "#middle-out")).includes("breaks @requires"), "middle: broken precondition explained");
await open(page, "l2-across");
ok((await text(page, "#barrier-verdict")).includes("(wrapped)"), "barrier: forward total wraps on 2147483647 5 -10");
await page.click('#barrier [data-dir="backward"]');
ok((await text(page, "#barrier-code")).includes("list.size() - 1") && (await text(page, "#barrier-term")).includes(`The sum of your list was: ${SumSim.run("orig", "2147483647 5 -10").printedSum}`) && !(await text(page, "#barrier-verdict")).includes("(wrapped)"), "barrier: backward version, same sum");
await open(page, "l2-meets");
await page.click('#lab [data-call="{0, 1, 2}|0|1|2"]');
const labRows = await page.$$eval(".lab-table tr", (rs) => rs.slice(1).map((r) => [...r.children].map((c) => c.textContent)));
ok(labRows[2][1] === "returns 2" && labRows[2][2] === "no promise" && labRows[2].slice(3).every((c) => c === "breaks"), "lab: impl 3 runs past hi");
await page.screenshot({ path: join(shots, "desktop-call-lab.png"), fullPage: false });
await open(page, "l2-strength");
await page.click('.cell[aria-label="D compared with A"]');
ok((await page.locator('.cell[aria-label="D compared with A"]').textContent()) === "S" && (await text(page, "#strength-detail")).includes("D is stronger than A"), "strength grid cell");
await open(page, "l2-client");
await page.click('#count-panel [data-impl="4"]');
ok((await text(page, "#count-verdict")).includes("Press Next call"), "count: no verdict before the run is shown");
await page.click("#count-step");
ok(!(await text(page, "#count-verdict")).includes("returns"), "count: no verdict mid-run");
await page.click("#count-end");
ok((await text(page, "#count-verdict")).includes("count returns 1; x occurs 3 times"), "count with impl 4 returns 1");

// quiz: MC wrong shows misconception, then right; numeric with misconception
await open(page, "l2-quiz");
const q7 = page.locator('.cyu[data-id="cse331-w1-l2-quiz-stronger-means"]');
await q7.locator('label[data-option="asks-more"] input').check();
await q7.locator(".check-btn").click();
ok((await q7.locator(".feedback").textContent()).startsWith("Not this one") && (await q7.locator('label[data-option="asks-more"] .why').isVisible()), "quiz MC wrong: why shown");
ok(!(await q7.locator('label[data-option="every-impl"] .why').isVisible()), "quiz MC wrong: right option's explanation stays hidden");
await q7.locator('label[data-option="every-impl"] input').check();
await q7.locator(".check-btn").click();
ok((await q7.locator(".feedback").textContent()) === "Correct.", "quiz MC right");
const q11 = page.locator('.cyu[data-id="cse331-w1-l2-quiz-abs-min-value"]');
await q11.locator("input").fill("2147483648");
await q11.locator(".check-btn").click();
f = await q11.locator(".feedback").textContent();
ok(f.includes("one more than the largest int") && !f.includes("-2147483648"), "numeric quiz misconception without leak");
await q11.locator("input").fill("-2147483647");
await q11.locator(".check-btn").click();
ok((await q11.locator(".feedback").textContent()).startsWith("Not quite"), "near-miss -2147483647 rejected");
await q11.locator("input").fill("-2,147,483,648");
await q11.locator(".check-btn").click();
ok((await q11.locator(".feedback").textContent()) === "Correct.", "exact INT_MIN accepted");
ok((await text(page, '#l2-quiz [data-role="score"]')).includes("0 correct on the first try"), "quiz scores first tries only");
await page.screenshot({ path: join(shots, "desktop-quiz.png"), fullPage: false });

// problems: per-part misconception feedback, hints, solution gate, self-mark
await open(page, "l2-exercises");
const p1 = page.locator('article[data-id="cse331-w1-l2-meets-matrix"]');
await p1.locator(".sol-btn").click();
ok((await p1.locator(".feedback").textContent()).includes("haven't answered") && await p1.locator(".solution").isHidden(), "solution gate asks for confirmation");
const fills = { "first-or-minus-one": "B D", "first-or-throw": "A, E", "ignores-hi": "A", "last-or-minus-one": "ACD" };
for (const [k, v] of Object.entries(fills)) await p1.locator(`[data-part="${k}"] input`).fill(v);
await p1.locator(".check-btn").click();
const pf = await p1.locator('[data-part="first-or-minus-one"] .part-fb').textContent();
ok(pf.includes("A asks for less than B") && !/\bABD\b|A, B, D/.test(pf), "part misconception feedback (forgot weak spec A), no leak");
ok((await p1.locator(".feedback").textContent()).startsWith("3 of 4 right"), "3 of 4 parts right");
await p1.locator(".hint-btn").click();
ok(await p1.locator(".hints li").first().isVisible() && !(await p1.locator(".hints li").nth(1).isVisible()), "one hint at a time");
await page.screenshot({ path: join(shots, "desktop-problem-feedback.png"), fullPage: false });
await p1.locator('[data-part="first-or-minus-one"] input').fill("ABD");
await p1.locator(".check-btn").click();
ok((await p1.locator(".feedback").textContent()) === "Correct." && (await p1.locator(".pill").textContent()) === "Correct", "problem correct");
await p1.locator(".sol-btn").click();
ok(await p1.locator(".solution").isVisible(), "solution opens after an attempt");
await p1.locator("[data-brute]").click();
await page.waitForFunction(() => document.querySelector('[data-brute="meets"] + .brute').textContent.includes("Matches"), null, { timeout: 10000 });
ok(true, "brute force matches the lecture's table in the browser");
const p2 = page.locator('article[data-id="cse331-w1-l2-break-it"]');
const p2vals = { "first-match-vs-c": "{1, 2}, 0, 2, 1", "last-match-vs-b": "{3, 3}, 0, 2, 3", "minus-one-vs-e": "{0}, 0, 9, 7", "ignores-hi-vs-d": "{0, 1, 2}, 0, 1, 2", "count-wrong-impl4": "{5, 1, 5, 2, 5}, 5" };
for (const [k, v] of Object.entries(p2vals)) await p2.locator(`[data-part="${k}"] input`).fill(v);
await p2.locator(".check-btn").click();
ok((await p2.locator('[data-part="first-match-vs-c"] .part-fb').textContent()).includes("keeps C's promise"), "witness: kept promise explained");
ok((await p2.locator('[data-part="minus-one-vs-e"] .part-fb').textContent()).includes("breaks E's precondition"), "witness: broken precondition explained");
ok((await p2.locator('[data-part="last-match-vs-b"] .part-fb').textContent()).startsWith("Counterexample"), "witness accepted");
const p9 = page.locator('article[data-id="cse331-w1-l2-precondition-vs-user"]');
await p9.locator("textarea").first().fill("A client can be held to a promise; a user can't.");
await p9.locator(".sol-btn").click();
await p9.locator(".self-mark .chip", { hasText: "I got it" }).click();
ok((await p9.locator(".pill").textContent()) === "Correct", "self-check marks correct");
const hist = await page.evaluate(() => ({ p1: CourseSite.attemptsOf("cse331-w1-l2-meets-matrix"), p9: CourseSite.attemptsOf("cse331-w1-l2-precondition-vs-user"), ev: CourseSite.eventsOf("cse331-w1-l2-meets-matrix") }));
ok(hist.p1.length === 2 && hist.p1[0].result.overall === "partial" && hist.p1[1].result.overall === "correct", "problem attempts recorded per Check");
ok(hist.p1[0].answer.parts["cse331-w1-l2-meets-matrix.first-or-minus-one"].normalized === "BD" && hist.p1[0].result.parts["cse331-w1-l2-meets-matrix.first-or-minus-one"] === false, "attempt has raw+normalized and per-part result");
ok(hist.p1[0].feedbackKind["cse331-w1-l2-meets-matrix.first-or-minus-one"] === "forgot-weak-spec-a", "attempt records the misconception tag");
ok(hist.p1[1].hintsRevealedAtSubmit === 1 && hist.p1[1].solutionViewedBeforeSubmit === false, "attempt records hints and solution view at submit");
ok(hist.p9.length === 1 && hist.p9[0].kind === "self-mark", "self-mark is an attempt");
ok(hist.ev.map((e) => e.type).join(",") === "hint,solution-view", "hint and solution view logged as events");
ok(page.errors.length === 0, `content run: no console errors (${page.errors.join(" | ")})`);

// reload restores everything (default localStorage adapter)
await page.reload();
await page.waitForSelector("html[data-ready]");
await open(page, "l2-exercises");
ok((await p1.locator('[data-part="first-or-minus-one"] input').inputValue()) === "ABD" && (await p1.locator(".pill").textContent()) === "Correct", "reload: answers and status restored");
ok((await p9.locator("textarea").first().inputValue()).startsWith("A client"), "reload: self-check text restored");
ok(await page.evaluate(() => CourseSite.attemptsOf("cse331-w1-l2-meets-matrix").length) === 2, "reload: attempt history restored");
await open(page, "l2-quiz");
ok((await q7.locator(".feedback").textContent()) === "Correct.", "reload: quiz restored");
await page.context().close();

/* =============================================================== inventory vs DOM */
{
  const pg = await newPage({ width: 1280, height: 800 });
  const domIds = await pg.evaluate(() => [
    ...[...document.querySelectorAll("[data-id]")].map((n) => n.dataset.id),
    ...[...document.querySelectorAll(".answer-spec")].map((n) => n.dataset.itemId),
  ]);
  const invIds = new Set(inventory.items.map((e) => e.id));
  ok(domIds.every((id) => invIds.has(id)), `every stateful DOM element is in the inventory (${domIds.filter((id) => !invIds.has(id))})`);
  ok(inventory.items.every((e) => domIds.includes(e.id)), "every inventory entry exists in the DOM");
  ok(invIds.size === inventory.items.length, "inventory IDs unique");
  ok(new Set(domIds).size === domIds.length, "DOM IDs unique");
  const positional = [...invIds].filter((id) => !/^cse331-w1-(l1|l2)-[a-z][a-z0-9-]*[a-z0-9](\.[a-z][a-z0-9-]*[a-z0-9])?$/.test(id) || /(^|[-.])(check|part|q|e|ex|p|item|step|task|cyu|a)?\d+($|[-.])/.test(id.replace(/^cse331-w1-l[12]-/, "").replace(/impl4|\bs[123]\b/g, "")));
  ok(positional.length === 0, `no positional IDs (${positional})`);
  const keys = await pg.evaluate(() => Object.keys(window.ANSWER_KEYS));
  ok(inventory.items.filter((e) => e.kind !== "problem" && e.answerType !== "self").every((e) => keys.includes(e.id)), "every gradable item has a key");
  ok(!JSON.stringify(inventory).includes('"answer"'), "inventory has no answer field");
  await pg.context().close();
}

/* =============================================================== persistence with the mock adapter */
{
  const pg = await newPage({ width: 1280, height: 800 }, `${URL0}?mock=1#l1-spec`);
  await pg.evaluate(() => CourseSite.ready);
  ok(await pg.evaluate(() => CourseSite.storage()) === "mock", "mock adapter in use");
  // rapid double-click Check: two distinct attempts
  const box = pg.locator('.check[data-id="cse331-w1-l1-qc-spec-predicts-sum"]');
  await box.locator("input").fill("8");
  await box.locator("button").dblclick();
  await pg.evaluate(() => CourseSite.flush());
  await pg.waitForFunction(() => CourseSite.pending().length === 0);
  const at = await pg.evaluate(() => CourseSite.attemptsOf("cse331-w1-l1-qc-spec-predicts-sum"));
  ok(at.length === 2 && at[0].attemptId !== at[1].attemptId && at[0].seq === 1 && at[1].seq === 2, "double-click: 2 attempts, distinct ids, seq 1 and 2");
  const sent = await pg.evaluate(() => COURSE_SITE_STORAGE.control.changes().filter((c) => c.kind === "attempt").map((c) => c.attempt.attemptId));
  ok(sent.length === 2 && new Set(sent).size === 2, "double-click: 2 distinct attempt change records sent");
  const events = await pg.evaluate(() => new Promise((res) => { const got = []; document.addEventListener("course-site:change", (e) => got.push(e.detail.kind)); const b = document.querySelector('.check[data-id="cse331-w1-l1-qc-spec-predicts-sum"] button'); b.click(); setTimeout(() => res(got), 50); }));
  ok(events.includes("attempt") && events.includes("snapshot"), "course-site:change DOM events fired");

  // failure: transient error toast, text kept, every attempt delivered exactly once after recovery
  await open(pg, "l1-exercises");
  await pg.evaluate(() => COURSE_SITE_STORAGE.control.failNext(3));
  const task = pg.locator('article[data-id="cse331-w1-l1-long-version"]');
  await task.locator('[data-part="overflow-sum"] input').fill("-2147483648");
  await task.locator('[data-part="too-big-got"] input').fill("Got []");
  await task.locator(".check-btn").click();
  await task.locator(".check-btn").click();
  await task.locator('textarea[id$="--work"]').fill("typed while the server was down");
  await pg.waitForSelector(".toast.error", { timeout: 5000 });
  ok((await pg.locator(".toast.error").textContent()).includes("Couldn't save"), "failure toast shown");
  await pg.screenshot({ path: join(shots, "desktop-save-failure-toast.png"), fullPage: false });
  ok((await task.locator('textarea[id$="--work"]').inputValue()) === "typed while the server was down", "typed text kept on the page");
  const mirror = await pg.evaluate(() => JSON.parse(localStorage.getItem(CourseStore.MIRROR_KEY)).store.items["cse331-w1-l1-long-version"].work);
  ok(mirror === "typed while the server was down", "typed text kept in the browser mirror");
  await pg.waitForSelector(".toast.ok", { timeout: 20000 });
  ok((await pg.locator(".toast.ok").textContent()).includes("works again"), "recovery toast shown");
  await pg.waitForFunction(() => CourseSite.pending().length === 0, null, { timeout: 10000 });
  const srvState = await pg.evaluate(() => COURSE_SITE_STORAGE.control.server());
  const delivered = await pg.evaluate(() => COURSE_SITE_STORAGE.control.changes().filter((c) => c.kind === "attempt" && c.itemId === "cse331-w1-l1-long-version").map((c) => c.attempt.attemptId));
  ok(delivered.length === 2 && new Set(delivered).size === 2, `after recovery: each attempt delivered exactly once (${delivered.length})`);
  ok(srvState.items["cse331-w1-l1-long-version"].work === "typed while the server was down", "after recovery: text reached the server");
  ok(srvState.attempts["cse331-w1-l1-long-version"].length === 2, "after recovery: server history has both attempts");
  await pg.waitForFunction(() => document.querySelectorAll(".toast").length === 0, null, { timeout: 15000 });
  ok(true, "toasts are transient (all gone)");

  // conflict: merge unions attempts by attemptId, local text survives, notice shown
  await pg.evaluate(() => COURSE_SITE_STORAGE.control.conflictNext((server) => {
    server.attempts["cse331-w1-l1-long-version"].push({ attemptId: "other-device-attempt", seq: 3, itemId: "cse331-w1-l1-long-version", submittedAt: "2026-10-02T23:00:00.000Z", kind: "check", result: { overall: "correct" } });
    server.items["cse331-w1-l1-long-version"].work = "older text from another device";
    return server;
  }));
  await task.locator('textarea[id$="--work"]').fill("my newest text");
  await task.locator(".check-btn").click();
  await pg.waitForSelector(".toast.info", { timeout: 10000 });
  ok((await pg.locator(".toast.info").textContent()).includes("Merged"), "conflict toast shown");
  await pg.waitForFunction(() => CourseSite.pending().length === 0, null, { timeout: 10000 });
  const merged = await pg.evaluate(() => CourseSite.attemptsOf("cse331-w1-l1-long-version").map((a) => a.attemptId));
  ok(merged.length === 4 && new Set(merged).size === 4 && merged.includes("other-device-attempt"), `conflict: attempts unioned by attemptId (${merged.length})`);
  ok((await task.locator('textarea[id$="--work"]').inputValue()) === "my newest text", "conflict: local text kept on the page");
  const srv2 = await pg.evaluate(() => COURSE_SITE_STORAGE.control.server());
  ok(srv2.items["cse331-w1-l1-long-version"].work === "my newest text" && srv2.attempts["cse331-w1-l1-long-version"].length === 4, "conflict: server has the merged store");

  // reload with the adapter: history and text come back
  await pg.reload();
  await pg.waitForSelector("html[data-ready]");
  await pg.evaluate(() => CourseSite.ready);
  await open(pg, "l1-exercises");
  ok((await task.locator('textarea[id$="--work"]').inputValue()) === "my newest text", "mock reload: text restored");
  ok(await pg.evaluate(() => CourseSite.attemptsOf("cse331-w1-l1-long-version").length) === 4, "mock reload: 4 attempts restored, none duplicated");
  ok(pg.errors.filter((e) => !/mock: save failed/.test(e)).length === 0, `mock run: no console errors (${pg.errors.join(" | ")})`);

  // slow adapter: page is usable before load() resolves
  await pg.evaluate(() => { sessionStorage.removeItem("mock-server"); localStorage.clear(); });
  await pg.addInitScript(() => { window.__slow = true; });
  await pg.context().close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  await pg.route("**/examples/mock-adapter.js", async (route) => {
    const body = readFileSync(join(base, "examples/mock-adapter.js"), "utf8");
    await route.fulfill({ contentType: "text/javascript", body: body + "\nwindow.__slowLoad = true;" });
  });
  await pg.addInitScript(() => {
    Object.defineProperty(window, "COURSE_SITE_STORAGE", { configurable: true, set(v) { v.control.failLoad(1); v.control.setLatency(3000); Object.defineProperty(window, "COURSE_SITE_STORAGE", { value: v, writable: true }); }, get() { return undefined; } });
  });
  await pg.goto(`${URL0}?mock=1#l1-spec`);
  await pg.waitForSelector("html[data-ready]", { timeout: 2000 });
  const b = pg.locator('.check[data-id="cse331-w1-l1-qc-spec-predicts-sum"]');
  await b.locator("input").fill("8");
  await b.locator("button").click();
  ok((await b.locator(".feedback").textContent()).startsWith("Correct"), "slow/failing adapter: page usable before load finishes");
  ok(errs.length === 0, "slow adapter: no page errors");
  await ctx.close();
}

/* =============================================================== grading state, drafts, repaint race (table-driven over the inventory) */
{
  const { run } = await import("./grading-state.mjs");
  await run({ browser, URL0, ok });
}

/* =============================================================== screenshots */
for (const vp of [{ width: 1280, height: 800, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
  const pg = await newPage(vp);
  await pg.evaluate(() => localStorage.clear());
  await open(pg, "home");
  await pg.evaluate(() => window.scrollTo(0, 0));
  await pg.screenshot({ path: join(shots, `${vp.name}-overview.png`) });
  await open(pg, "l1-assert");
  await pg.click('#stepper [data-st="2147483647 1"]');
  await pg.click("#st-p2");
  await pg.locator("#stepper").scrollIntoViewIfNeeded();
  await pg.screenshot({ path: join(shots, `${vp.name}-stepper.png`) });
  await open(pg, "l2-meets");
  await pg.click('#lab [data-call="{0, 1, 2}|0|1|2"]');
  await pg.locator("#lab").scrollIntoViewIfNeeded();
  await pg.screenshot({ path: join(shots, `${vp.name}-call-lab.png`) });
  await open(pg, "l2-exercises");
  const t = pg.locator('article[data-id="cse331-w1-l2-meets-matrix"]');
  for (const [k, v] of Object.entries({ "first-or-minus-one": "B D", "first-or-throw": "A, E", "ignores-hi": "A", "last-or-minus-one": "ACD" })) await t.locator(`[data-part="${k}"] input`).fill(v);
  await t.locator(".check-btn").click();
  await t.locator(".hint-btn").click();
  await t.locator(".my-work").scrollIntoViewIfNeeded();
  await pg.screenshot({ path: join(shots, `${vp.name}-problem-feedback.png`) });
  await open(pg, "l2-quiz");
  const q = pg.locator('.cyu[data-id="cse331-w1-l2-quiz-broken-precondition"]');
  await q.locator('label[data-option="no-throw"] input').check();
  await q.locator(".check-btn").click();
  await q.scrollIntoViewIfNeeded();
  await pg.screenshot({ path: join(shots, `${vp.name}-quiz.png`) });
  await pg.context().close();
  const m = await newPage(vp, `${URL0}?mock=1#l1-exercises`);
  await m.evaluate(() => CourseSite.ready);
  await m.evaluate(() => COURSE_SITE_STORAGE.control.failAlways(true));
  await m.locator('article[data-id="cse331-w1-l1-long-version"] textarea[id$="--work"]').fill("Work typed while saving fails.");
  await m.locator('article[data-id="cse331-w1-l1-long-version"] textarea[id$="--work"]').scrollIntoViewIfNeeded();
  await m.waitForSelector(".toast.error", { timeout: 5000 });
  await m.screenshot({ path: join(shots, `${vp.name}-save-failure-toast.png`) });
  await m.evaluate(() => { COURSE_SITE_STORAGE.control.failAlways(false); sessionStorage.clear(); localStorage.clear(); });
  await m.context().close();
}

console.log(`browser: ${pass} passed, ${fail} failed`);
await browser.close();
srv.close();
process.exit(fail ? 1 : 0);
