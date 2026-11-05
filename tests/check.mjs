// One check for the whole site. bun check [course/wNN ...]   (default: every posted week in site/courses.js)
// For each week page, at desktop and phone size: loads with no errors and no sideways scrolling; every quick check,
// quiz question and problem accepts its own answer key; a wrong answer is not accepted; typed work survives a reload.
// Answer keys themselves are checked against real code by checks/<course>/<week>/verify.mjs.
import { chromium } from "playwright-core";
import fs from "node:fs";
import vm from "node:vm";
import { serve } from "../tools/serve.mjs";

const cat = (() => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(new URL("../site/courses.js", import.meta.url), "utf8"), ctx); return ctx.window.COURSES; })();
const weeks = process.argv.slice(2).length ? process.argv.slice(2) : cat.courses.flatMap((c) => c.weeks.filter((w) => w.posted).map((w) => `${c.id}/${w.id}`));
const exe = [`${process.env.HOME}/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome`, process.env.CHROMIUM_PATH].find((p) => p && fs.existsSync(p));
// No save API here: the check clears localStorage between passes, and a server copy would merge back in.
const server = serve({ port: 8410 });
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
let failures = 0;
const fail = (msg) => { failures++; console.log("  FAIL", msg); };

// In-page: answer every item with its key (or a wrong answer) and report which ones were judged right.
const answerAll = (wrong) => {
  const S = window.Study, res = [];
  const fire = (n, ev) => n.dispatchEvent(new Event(ev, { bubbles: true }));
  const first = (spec) => String(spec.answer).split("|")[0] || "nothing";
  const bad = (spec) => (spec.type === "yesno" ? (first(spec) === "yes" ? "no" : "yes") : spec.type === "stream" ? (first(spec) === "stdout" ? "stderr" : "stdout") : spec.type === "bigo" && first(spec) === "1" ? "n" : "999999937");
  const pick = (node, spec) => {
    const labels = [...node.querySelectorAll(".opts label")];
    const right = labels.find((l) => l.hasAttribute("data-correct") || (l.dataset.option && String(spec.answer ?? "").split("|").includes(l.dataset.option)));
    const choice = wrong ? labels.find((l) => l !== right) : right;
    if (choice) { choice.querySelector("input").checked = true; fire(choice.querySelector("input"), "change"); }
    return Boolean(choice);
  };
  for (const box of document.querySelectorAll(".check[data-id]:not([data-custom])")) {
    const spec = S.specFor(box.dataset.id, box), input = box.querySelector("input[type=text]"), btns = box.querySelector(".choice-btns");
    if (btns) { const v = wrong ? bad(spec) : first(spec); const b = btns.querySelector(`[data-value="${v}"]`); if (!b) { res.push([box.dataset.id, `no ${v} button`]); continue; } b.click(); }
    else if (input) { input.value = wrong ? bad(spec) : first(spec); fire(input, "input"); box.querySelector("button.primary").click(); }
    else if (!pick(box, spec)) { res.push([box.dataset.id, "no option"]); continue; }
    else box.querySelector("button.primary").click();
    res.push([box.dataset.id, box.querySelector(".feedback").classList.contains("ok")]);
  }
  for (const li of document.querySelectorAll(".cyu[data-id]")) {
    const spec = S.specFor(li.dataset.id, li), input = li.querySelector(".row input[type=text]");
    if (input) { input.value = wrong ? bad(spec) : first(spec); fire(input, "input"); } else if (!pick(li, spec)) { res.push([li.dataset.id, "no option"]); continue; }
    li.querySelector(".check-btn").click();
    res.push([li.dataset.id, li.classList.contains("is-right")]);
  }
  for (const task of document.querySelectorAll(".task[data-id]")) {
    const parts = [...task.querySelectorAll(".answer-spec")].map((sp) => ({ sp, spec: S.specFor(`${task.dataset.id}.${sp.dataset.part}`, sp) }));
    const auto = parts.filter((p) => p.spec.type !== "self");
    // c/n0 pairs, Java types and counterexamples have many right answers; verify.mjs checks those graders.
    if (!auto.length || auto.some((p) => ["bound", "java", "witness"].includes(p.spec.type))) continue;
    auto.forEach((p, i) => {
      const btns = [...p.sp.querySelectorAll(".choice-btns button")];
      if (btns.length) { const b = wrong && i === 0 ? btns.find((x) => x.dataset.value !== first(p.spec)) : btns.find((x) => x.dataset.value === first(p.spec)); if (b) b.click(); return; }
      const input = p.sp.querySelector("input, select");
      input.value = wrong && i === 0 ? bad(p.spec) : first(p.spec);
      fire(input, "input");
    });
    task.querySelector(".check-btn").click();
    res.push([task.dataset.id, task.querySelector(".my-work > .feedback").classList.contains("ok")]);
  }
  return res;
};

for (const wk of weeks) {
  console.log(wk);
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.goto(`http://localhost:8410/${wk}/`);
    await page.waitForSelector("html[data-ready]", { timeout: 10000 }).catch(() => errors.push("page never finished loading"));
    const ids = await page.$$eval(".page", (ps) => ps.map((p) => p.id));
    for (const id of ids) {
      await page.evaluate((x) => { location.hash = x; }, id);
      await page.waitForTimeout(60);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) fail(`${wk}#${id} scrolls sideways at ${w}px`);
    }
    if (w === 1280) {
      const right = await page.evaluate(answerAll, false);
      right.filter(([, ok]) => ok !== true).forEach(([id, ok]) => fail(`${id}: its own answer key was not accepted (${ok})`));
      await page.evaluate(() => localStorage.clear());
      await page.reload(); await page.waitForSelector("html[data-ready]");
      const wrong = await page.evaluate(answerAll, true);
      wrong.filter(([, ok]) => ok === true).forEach(([id]) => fail(`${id}: a wrong answer was accepted`));
      // typed work survives a reload
      const id = await page.$eval(".task[data-id]", (t) => t.dataset.id).catch(() => null);
      if (id) {
        await page.evaluate((tid) => { const t = document.querySelector(`[data-id="${tid}"] .my-work > textarea`); t.value = "kept after reload"; t.dispatchEvent(new Event("input")); }, id);
        await page.reload(); await page.waitForSelector("html[data-ready]");
        const kept = await page.$eval(`[data-id="${id}"] .my-work > textarea`, (t) => t.value);
        if (kept !== "kept after reload") fail(`${wk}: work box not restored after reload`);
      }
      console.log(`  ${right.length} items answered right and wrong; ${ids.length} pages`);
    }
    errors.forEach((e) => fail(`${wk} at ${w}px: ${e}`));
    await page.close();
  }
}
await browser.close();
server.stop();
console.log(failures ? `${failures} failure(s)` : "all good");
process.exit(failures ? 1 : 0);
