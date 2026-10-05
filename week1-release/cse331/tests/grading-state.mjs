// Table-driven regression test for grading state, drafts and the repaint race, over EVERY gradable
// kind/answerType in export/state-inventory.json. Fails if the inventory gains a kind with no case here.
// For each case: answer correctly -> Check (or self-mark) -> edit -> the saved snapshot has no current grade,
// the DOM shows no stale feedback/badge, Answered still counts the submission -> reload -> not correct, draft
// restored, original attempt byte-identical -> re-enter the graded value -> still ungraded until a new Check.
// Also: MC draft without Check survives reload; type-then-act within 300 ms (reveal, hint, solution, Check,
// navigation) keeps the draft; a wrong submission increments Answered and persists.
// Usage: node tests/grading-state.mjs   (exported as run() for browser.mjs too)
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const base = new URL("../", import.meta.url).pathname;
globalThis.self = globalThis;
req("../site/js/keys.js");
const KEYS = globalThis.ANSWER_KEYS;
const inventory = JSON.parse(readFileSync(join(base, "export", "state-inventory.json"), "utf8"));

// One representative item per kind/answerType, with a right value, a different value, and how to submit.
// "witness" keys accept many answers, so they carry a known counterexample.
const RIGHT = {
  "cse331-w1-l2-break-it.first-match-vs-c": "{1, 1}, 0, 2, 1",
  "cse331-w1-l2-sign-meets.min-value-witness": "-2147483648",
};
const CASES = {
  "quiz/int": { id: "cse331-w1-l2-quiz-abs-min-value", edit: "2147483648" },
  "quiz/choice": { id: "cse331-w1-l2-quiz-stronger-means", edit: "asks-more" },
  "quickcheck/int": { id: "cse331-w1-l1-qc-spec-predicts-sum", edit: "9" },
  "quickcheck/text": { id: "cse331-w1-l1-qc-hasnext-exception", edit: "NumberFormatException" },
  "quickcheck/yesno": { id: "cse331-w1-l1-qc-list-survives-loop", edit: "no" },
  "part/int": { id: "cse331-w1-l1-long-version.overflow-sum", edit: "-2147483648" },
  "part/text": { id: "cse331-w1-l1-predict-two-runs.two-lines-got", edit: "Got [3, 4]" },
  "part/yesno": { id: "cse331-w1-l1-sum-starts-at-one.point2-sum", edit: "yes" },
  "part/letters": { id: "cse331-w1-l2-meets-matrix.ignores-hi", edit: "AB" },
  "part/strength": { id: "cse331-w1-l2-sign-compare.s2-vs-s3", edit: "stronger" },
  "part/set": { id: "cse331-w1-l2-sign-meets.identity", edit: "S1, S2" },
  "part/witness": { id: "cse331-w1-l2-break-it.first-match-vs-c", edit: "{1, 2}, 0, 2, 1" },
  "part/self": { id: "cse331-w1-l2-precondition-vs-user.explanation", edit: "changed my written answer" },
};
const rightValue = (id) => RIGHT[id] ?? String(KEYS[id].answer).split("|")[0];

export async function run({ browser, URL0, ok }) {
  const kinds = [...new Set(inventory.items.filter((e) => e.gradable).map((e) => `${e.kind}/${e.answerType}`))].sort();
  const missing = kinds.filter((k) => !CASES[k]);
  ok(missing.length === 0, `every gradable kind in the inventory has a grading-state case (missing: ${missing})`);
  for (const [k, c] of Object.entries(CASES)) {
    const e = inventory.items.find((x) => x.id === c.id);
    ok(e && `${e.kind}/${e.answerType}` === k, `case ${k} uses an item of that kind (${c.id})`);
  }

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto(URL0);
  await page.waitForSelector("html[data-ready]");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("html[data-ready]");
  const open = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForSelector(`#${hash}.is-active`); };
  const reload = async () => { await page.reload(); await page.waitForSelector("html[data-ready]"); };
  const snap = (id) => page.evaluate((i) => CourseSite.exportState().items[i] || null, id);
  const attempts = (id) => page.evaluate((i) => CourseSite.attemptsOf(i), id);
  // the local mirror is what survives a crash; check it, not just memory
  const mirror = (id) => page.evaluate(([i, key]) => (JSON.parse(localStorage.getItem(key) || "{}").store || { items: {} }).items[i] || null, [id, "cse331-26au-week1:v2:mirror"]);

  // locate a case's widgets
  function where(k, c) {
    const [kind] = k.split("/");
    if (kind === "quickcheck") { const box = page.locator(`.check[data-id="${c.id}"]`); return { box, itemId: c.id, input: box.locator("input"), check: box.locator("button.primary"), fb: box.locator(".feedback") }; }
    if (kind === "quiz") { const box = page.locator(`.cyu[data-id="${c.id}"]`); return { box, itemId: c.id, input: box.locator(".row input[type=text]"), check: box.locator(".check-btn"), fb: box.locator(".feedback").first() }; }
    const [pid, part] = c.id.split(".");
    const task = page.locator(`article[data-id="${pid}"]`);
    const row = task.locator(`[data-part="${part}"]`);
    return { box: task, itemId: pid, part, row, input: row.locator("input, textarea"), check: task.locator(".check-btn"), fb: task.locator(".my-work > .feedback"), partFb: row.locator(".part-fb"), pill: task.locator(".pill") };
  }
  const routeOf = (id) => inventory.items.find((x) => x.id === id).route.slice(1);
  async function setValue(k, w, value) {
    if (k === "quiz/choice") await w.box.locator(`label[data-option="${value}"] input`).check();
    else await w.input.fill(value);
  }
  async function submitRight(k, c, w) {
    if (k === "part/self") {
      await w.input.fill("my written answer"); // self-check parts have no key; the learner marks them
      await w.box.locator(".sol-btn").click();
      if (await w.box.locator(".solution").isHidden()) await w.box.locator(".sol-btn").click();
      await w.box.locator(".self-mark .chip", { hasText: "I got it" }).click();
      return;
    }
    if (k.startsWith("part/")) {
      // fill every auto part of the problem with a right value, so the problem is fully correct first
      const parts = await w.box.locator(".answer-spec").evaluateAll((ns) => ns.map((n) => ({ pid: n.dataset.itemId, type: n.dataset.type })));
      for (const p of parts) if (p.type !== "self") await w.box.locator(`[data-item-id="${p.pid}"] input`).fill(p.pid === c.id ? rightValue(c.id) : partRight(p.pid));
    } else {
      await setValue(k, w, k === "quiz/choice" ? KEYS[c.id].answer : rightValue(c.id));
    }
    await w.check.click();
  }
  const partRight = (pid) => {
    const known = { "cse331-w1-l2-break-it.last-match-vs-b": "{1, 1}, 0, 2, 1", "cse331-w1-l2-break-it.minus-one-vs-e": "{0}, 0, 1, 7", "cse331-w1-l2-break-it.ignores-hi-vs-d": "{0, 1, 2}, 0, 1, 2", "cse331-w1-l2-break-it.count-wrong-impl4": "{5, 1, 5, 2, 5}, 5", "cse331-w1-l2-sign-meets.min-value-witness": "-2147483648" };
    if (known[pid]) return known[pid];
    const a = String(KEYS[pid].answer).split("|")[0];
    return a === "" ? "none" : a;
  };
  const isGraded = (k, s, w) => (k.startsWith("part/") ? (k === "part/self" ? s.selfMark !== null && s.selfMark !== undefined : s.result !== null && s.result !== undefined) || (s.parts[w.itemId + "." + w.part] || {}).correct != null || (s.parts[w.itemId + "." + w.part] || {}).normalized != null : s.correct !== null || s.normalized !== null || (k.startsWith("quiz") && s.done));

  for (const [k, c] of Object.entries(CASES)) {
    await open(routeOf(c.id));
    const w = where(k, c);
    await submitRight(k, c, w);
    let s = await snap(w.itemId);
    const graded = k === "part/self" ? s.selfMark === "got" : k.startsWith("part/") ? s.result === "correct" : s.correct === true;
    ok(graded, `${k}: graded correct after submit`);
    const before = await attempts(w.itemId);
    ok(before.length >= 1, `${k}: submission recorded as an attempt`);

    // edit
    await setValue(k, w, c.edit);
    if (k !== "quiz/choice") await w.input.press("End");
    // DOM shows no stale grade right away
    const domStale = await w.box.evaluate((n, kk) => {
      const fbs = [...n.querySelectorAll(".feedback, .part-fb")].filter((f) => f.offsetParent && /correct|right/i.test(f.textContent) && !/not right/i.test(f.textContent));
      const marks = n.querySelectorAll("label.right, label.wrong, input.ok, input.bad, .cyu.is-right").length + (n.classList.contains("is-right") ? 1 : 0);
      const pill = n.querySelector(".pill");
      const pressed = [...n.querySelectorAll(".self-mark .chip[aria-pressed=true]")].length;
      return { fbs: fbs.map((f) => f.textContent), marks, pill: pill ? pill.textContent : null, pressed, kk };
    }, k);
    ok(domStale.fbs.length === 0, `${k}: no stale correct feedback in the DOM after edit (${domStale.fbs})`);
    ok(k.startsWith("part/") || domStale.marks === 0, `${k}: no stale right/wrong marks after edit`);
    if (k.startsWith("part/")) {
      ok(domStale.pill !== "Correct", `${k}: status badge no longer "Correct" after edit (${domStale.pill})`);
      ok(await w.input.evaluate((n) => !n.classList.contains("ok") && !n.classList.contains("bad")), `${k}: edited input has no ok/bad class`);
      if (k === "part/self") ok(domStale.pressed === 0, "part/self: got/missed aria-pressed cleared after edit");
    }
    // saved snapshot (after the debounce) has no current grade, in memory and in the local mirror
    await page.waitForTimeout(450);
    s = await snap(w.itemId);
    const m = await mirror(w.itemId);
    ok(!isGraded(k, s, w), `${k}: saved snapshot has no current grade after edit`);
    ok(m && !isGraded(k, m, w), `${k}: local mirror has no current grade after edit`);
    const answeredText = async () => {
      const pg = page.locator(`#${routeOf(c.id)}`);
      return k.startsWith("quiz") ? pg.locator('[data-role="score"]').textContent() : k.startsWith("part") ? pg.locator(".progress-text").textContent() : null;
    };
    const ans1 = await answeredText();
    if (ans1) ok(/Answered [1-9]|[1-9] of \d+ answered/.test(ans1), `${k}: Answered still counts the submission after edit (${ans1})`);

    // reload
    await reload();
    await open(routeOf(c.id));
    const w2 = where(k, c);
    s = await snap(w2.itemId);
    ok(!isGraded(k, s, w2), `${k}: after reload, not graded`);
    const draft = k === "quiz/choice" ? await w2.box.locator("label[data-option] input:checked").evaluate((i) => i.closest("label").dataset.option) : await w2.input.inputValue();
    ok(draft === c.edit, `${k}: draft restored after reload (${draft})`);
    const fbAfter = await w2.box.evaluate((n) => [...n.querySelectorAll(".feedback, .part-fb")].filter((f) => f.offsetParent).map((f) => f.textContent).join(" | "));
    ok(!/^correct\.|checked: correct|Correct\./i.test(fbAfter), `${k}: after reload, no "Correct" shown (${fbAfter})`);
    if (k.startsWith("part/")) ok((await w2.pill.textContent()) !== "Correct", `${k}: after reload, badge not "Correct"`);
    const after = await attempts(w2.itemId);
    ok(JSON.stringify(after) === JSON.stringify(before), `${k}: attempts[] byte-identical after edit + reload`);

    // re-enter the previously graded value: no grade until a new Check
    if (k === "part/self") await w2.input.fill("my written answer");
    else await setValue(k, w2, k === "quiz/choice" ? KEYS[c.id].answer : rightValue(c.id));
    await page.waitForTimeout(450);
    s = await snap(w2.itemId);
    ok(!isGraded(k, s, w2), `${k}: re-entering the graded value doesn't resurrect the grade`);
    await reload();
    s = await snap(where(k, c).itemId);
    ok(!isGraded(k, s, w2), `${k}: ...not after reload either`);
    ok(JSON.stringify(await attempts(w2.itemId)) === JSON.stringify(before), `${k}: still no new attempt without a Check`);
  }

  /* ---------- MC draft with no Check survives reload, ungraded */
  await open("l2-quiz");
  const mcId = "cse331-w1-l2-quiz-which-tag-precondition";
  await page.locator(`.cyu[data-id="${mcId}"] label[data-option="param"] input`).check();
  await page.waitForTimeout(400);
  await reload();
  await open("l2-quiz");
  ok(await page.locator(`.cyu[data-id="${mcId}"] label[data-option="param"] input`).isChecked(), "MC draft (no Check) restored after reload");
  ok((await page.locator(`.cyu[data-id="${mcId}"] .feedback`).textContent()) === "" && (await snap(mcId)).correct === null && (await attempts(mcId)).length === 0, "MC draft is ungraded and created no attempt");

  /* ---------- the repaint race: act within 300 ms of typing */
  const race = async (label, route, setup, act, check) => {
    await open(route);
    await setup();
    await act(); // no wait: the debounce (300 ms) hasn't fired
    await check(label, false);
    await reload();
    await open(route);
    await check(label, true);
  };
  const numId = "cse331-w1-l1-quiz-sum-after-word";
  await race("numeric quiz type -> Show answer", "l1-quiz",
    () => page.locator(`.cyu[data-id="${numId}"] .row input`).fill("31"),
    () => page.locator(`.cyu[data-id="${numId}"] .btn:not(.check-btn)`).click(),
    async (label, reloaded) => {
      ok((await page.locator(`.cyu[data-id="${numId}"] .row input`).inputValue()) === "31", `${label}: input keeps the typed text${reloaded ? " after reload" : ""}`);
      ok((await snap(numId)).raw === "31", `${label}: snapshot has the typed text${reloaded ? " after reload" : ""}`);
      if (!reloaded) {
        ok((await attempts(numId)).length === 0, `${label}: the reveal created no attempt`);
        ok((await page.evaluate((i) => CourseSite.eventsOf(i).map((e) => e.type), numId)).includes("reveal"), `${label}: a reveal event is logged`);
      }
    });
  const mcRace = "cse331-w1-l1-quiz-testing-can";
  await race("MC change -> Show answer", "l1-quiz",
    () => page.locator(`.cyu[data-id="${mcRace}"] label[data-option="both"] input`).check(),
    () => page.locator(`.cyu[data-id="${mcRace}"] .btn:not(.check-btn)`).click(),
    async (label, reloaded) => {
      ok(await page.locator(`.cyu[data-id="${mcRace}"] label[data-option="both"] input`).isChecked(), `${label}: selection preserved${reloaded ? " after reload" : ""}`);
      ok((await snap(mcRace)).choiceId === "both", `${label}: selection saved${reloaded ? " after reload" : ""}`);
      if (!reloaded) ok((await attempts(mcRace)).length === 0, `${label}: no attempt from the reveal`);
    });
  const hintTask = "cse331-w1-l2-compare-five";
  await race("problem part type -> hint", "l2-exercises",
    () => page.locator(`[data-item-id="${hintTask}.b-vs-c"] input`).fill("incomparable"),
    () => page.locator(`article[data-id="${hintTask}"] .hint-btn`).click(),
    async (label, reloaded) => {
      ok((await page.locator(`[data-item-id="${hintTask}.b-vs-c"] input`).inputValue()) === "incomparable", `${label}: input keeps the typed text${reloaded ? " after reload" : ""}`);
      ok((await snap(hintTask)).parts[`${hintTask}.b-vs-c`].raw === "incomparable" && (await snap(hintTask)).hintsRevealed === 1, `${label}: snapshot has the text and the hint${reloaded ? " after reload" : ""}`);
      if (!reloaded) ok((await attempts(hintTask)).length === 0, `${label}: the hint created no attempt`);
    });
  const workTask = "cse331-w1-l2-maxlist-spec";
  await race("work box type -> Show solution", "l2-exercises",
    () => page.locator(`article[data-id="${workTask}"] textarea[id$="--work"]`).fill("my quick work"),
    () => page.locator(`article[data-id="${workTask}"] .sol-btn`).click(),
    async (label, reloaded) => {
      ok((await page.locator(`article[data-id="${workTask}"] textarea[id$="--work"]`).inputValue()) === "my quick work", `${label}: work text kept${reloaded ? " after reload" : ""}`);
      ok((await snap(workTask)).work === "my quick work", `${label}: work text saved${reloaded ? " after reload" : ""}`);
    });
  const qcRace = "cse331-w1-l1-qc-list-size-at-point1";
  await race("quick check type -> navigate away", "l1-assert",
    () => page.locator(`.check[data-id="${qcRace}"] input`).fill("3"),
    () => page.evaluate(() => { location.hash = "l1-reason"; }),
    async (label, reloaded) => {
      ok((await snap(qcRace)).raw === "3", `${label}: draft saved${reloaded ? " after reload" : ""}`);
      if (reloaded) ok((await page.locator(`.check[data-id="${qcRace}"] input`).inputValue()) === "3", `${label}: draft restored`);
    });

  /* ---------- wrong submission increments Answered and persists */
  await open("l2-quiz");
  const scoreText = () => page.locator('#l2-quiz [data-role="score"]').textContent();
  const answeredN = async () => Number((await scoreText()).match(/Answered (\d+)/)[1]);
  const n0 = await answeredN();
  const wq = page.locator('.cyu[data-id="cse331-w1-l2-quiz-no-modifies"]');
  await wq.locator('label[data-option="nothing"] input').check();
  await wq.locator(".check-btn").click();
  ok((await answeredN()) === n0 + 1, `wrong quiz submission increments Answered (${n0} -> ${await answeredN()})`);
  const rq = page.locator('.cyu[data-id="cse331-w1-l2-quiz-broken-precondition"]');
  await rq.locator(".btn:not(.check-btn)").click();
  ok((await answeredN()) === n0 + 1, "Show answer without a submission doesn't count as answered");
  await open("l2-exercises");
  const progN = async () => Number((await page.locator("#l2-exercises .progress-text").textContent()).match(/^(\d+) of/)[1]);
  const p0 = await progN();
  const wt = page.locator('article[data-id="cse331-w1-l2-change-spec"]');
  for (const part of ["d-to-b-impls", "d-to-b-clients", "b-to-d-impls", "b-to-d-clients"]) await wt.locator(`[data-part="${part}"] input`).fill("none");
  await wt.locator(".check-btn").click();
  ok((await progN()) === p0 + 1, `wrong problem submission increments answered (${p0} -> ${await progN()})`);
  ok((await page.locator("#l2-exercises .progress-text").textContent()).includes("correct now"), "correct-only count is labelled separately");
  await reload();
  await open("l2-quiz");
  ok((await answeredN()) === n0 + 1, "quiz Answered persists across reload");
  await open("l2-exercises");
  ok((await progN()) === p0 + 1, "problem answered count persists across reload");

  ok(errors.length === 0, `grading-state run: no page errors (${errors})`);
  await ctx.close();
}

// standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
  const srv = createServer((q, r) => {
    let p = join(process.env.SITE_DIR || join(base, "site"), decodeURIComponent(q.url.split("?")[0]));
    if (p.endsWith("/")) p += "index.html";
    if (!existsSync(p)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { "content-type": types[extname(p)] || "text/plain" });
    r.end(readFileSync(p));
  }).listen(0);
  let pass = 0, fail = 0;
  const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL:", msg); } };
  const browser = await chromium.launch();
  await run({ browser, URL0: `http://localhost:${srv.address().port}/`, ok });
  console.log(`grading-state: ${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
}
