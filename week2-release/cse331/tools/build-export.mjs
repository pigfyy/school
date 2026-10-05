// Builds week2-release/cse331/export/: a copy of the site (HTML, CSS, every state-owning JS file) and
// export/state-inventory.json, generated from the live DOM of site/index.html in headless Chromium.
// The inventory has one entry per stateful item (problem, part, quick check or sorter card, quiz question) with its prompt,
// grader type, stored record shape, hint count and whether a solution exists. It never includes answer keys:
// js/keys.js is not loaded while building it, and the result is scanned for every key before it is written.
// Usage: node tools/build-export.mjs   (playwright-core from tests/node_modules)
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const base = join(here, "..");
const req = createRequire(join(base, "tests", "package.json"));
const { chromium } = req("playwright-core");
const siteDir = join(base, "site");
const outDir = join(base, "export");

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
const srv = createServer((q, r) => {
  const path = decodeURIComponent(q.url.split("?")[0]);
  if (path === "/js/keys.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end("window.ANSWER_KEYS = new Proxy({}, { get: () => ({ type: 'text', answer: '' }) });"); }
  let p = join(siteDir, path);
  if (p.endsWith("/")) p += "index.html";
  if (!p.startsWith(siteDir) || !existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": types[extname(p)] || "text/plain" });
  r.end(readFileSync(p));
}).listen(0);

const DATES = { l3: { unit: "Lecture 3", title: "Reading 1 discussion; Batch processing", date: "2026-10-05", url: "https://courses.cs.washington.edu/courses/cse331/26au/lectures/lecture03-batch/notes.html" } };
const GRADER = {
  int: "exact-integer (BigInt; no tolerance)",
  output: "exact program output (ends trimmed; case, spacing and punctuation must match; 'nothing' = no output)",
  text: "exact-text (normalized: trim, case, spaces)",
  yesno: "yes/no",
  stream: "stdout | stderr (accepts standard output / System.out / 1, standard error / System.err / 2)",
  strength: "exact-text (stronger | weaker | incomparable | same)",
  letters: "letter-set (exact set of the listed letters; 'none' = empty)",
  choice: "multiple-choice (option id)",
  self: "self-check (learner marks 'I got it' / 'I missed something' against the solution)",
};
const SHAPES = {
  problem: {
    snapshot: { kind: "'problem'", parts: "{ [partId]: { raw: string, normalized: string|null, correct: true|false|null } }", work: "string", result: "'correct'|'partial'|'incorrect'|null", selfMark: "'got'|'missed'|null", checks: "int", hintsRevealed: "int", solutionViewed: "bool", solutionOpen: "bool", updatedAt: "ISO string" },
    attempts: "Attempt[] with kind 'check' (answer.parts per part, result.parts per part + overall, feedbackKind per part) or 'self-mark' (result.overall 'self-correct'|'self-incorrect')",
    events: "Event[] with type 'hint' (level, of) | 'solution-view' (attemptedFirst) | 'solution-hide' | 'clear'",
  },
  part: { storedIn: "the parent problem's snapshot.parts[partId] and in each attempt's answer.parts[partId] / result.parts[partId]", record: "{ raw: string, normalized: string|null, correct: true|false|null }" },
  quickcheck: {
    snapshot: { kind: "'quickcheck'", raw: "string", normalized: "string|null", correct: "true|false|null", tries: "int (readable checks)", firstTryCorrect: "true|false|null", updatedAt: "ISO string" },
    attempts: "Attempt[] with kind 'check', answer { raw, normalized } (sorter cards add choiceId), result { overall, correct }, feedbackKind (misconception tag | 'correct' | 'incorrect' | 'unreadable' | 'chose-<option>' for sorter cards)",
    events: "none",
  },
  quiz: {
    snapshot: { kind: "'quiz'", choiceId: "option id|null (multiple choice)", raw: "string", normalized: "string|null", correct: "true|false|null", tries: "int", firstTryCorrect: "bool", done: "bool", revealed: "bool", lastMessage: "string|null", updatedAt: "ISO string" },
    attempts: "Attempt[] with kind 'check', answer { choiceId, choiceIndex, raw, normalized } (MC) or { raw, normalized }, result { overall, correct }, feedbackKind (option's misconception tag | 'correct' | ...), solutionViewedBeforeSubmit = answer was revealed first",
    events: "Event[] with type 'reveal' (Show answer) | 'clear' (Start over)",
  },
};

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${srv.address().port}/`);
await page.waitForSelector("html[data-ready]");

const raw = await page.evaluate(() => {
  const text = (node) => {
    if (!node) return "";
    const c = node.cloneNode(true);
    c.querySelectorAll(".why, .feedback, .row, button, .part-fb, .where").forEach((x) => x.remove());
    c.querySelectorAll("pre.code").forEach((p) => { p.textContent = "\n" + [...p.querySelectorAll(".ln")].map((l) => l.querySelector(".src").textContent).join("\n") + "\n"; });
    return c.textContent.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  };
  const codeOf = (nodes) => [...nodes].map((p) => [...p.querySelectorAll(".ln")].map((l) => l.querySelector(".src").textContent).join("\n"));
  const items = [];
  const pageOf = (n) => n.closest(".page");
  for (const box of document.querySelectorAll(".check[data-id]")) {
    const pg = pageOf(box);
    items.push({ id: box.dataset.id, kind: "quickcheck", parentId: null, route: `#${pg.id}`, pageTitle: pg.dataset.title, unit: pg.dataset.unit,
      answerType: box.dataset.type, format: box.dataset.format || "typed",
      prompt: box.dataset.format === "sort" ? `Sort this run against Sum's user manual (lines 5-19): described, silent or contradicted? ${[...box.querySelectorAll(".tl.cmd")].map((c) => "$ " + c.firstChild.nextSibling.textContent).join(" ; ")}${box.querySelector(".card-note") ? " (" + box.querySelector(".card-note").textContent + ")" : ""}` : text(box.querySelector("p")),
      html: box.dataset.format === "sort" ? box.querySelector(".term").outerHTML : box.querySelector("p").innerHTML, code: [], hintCount: 0, hasSolution: false,
      options: box.dataset.format === "sort" ? box.dataset.options.split("|").map((o, i) => ({ index: i, id: o, text: o })) : null });
  }
  for (const li of document.querySelectorAll(".cyu[data-id]")) {
    const pg = pageOf(li);
    const q = li.querySelector(".q");
    items.push({ id: li.dataset.id, kind: "quiz", parentId: null, route: `#${pg.id}`, pageTitle: pg.dataset.title, unit: pg.dataset.unit,
      answerType: li.dataset.type, prompt: text(q), html: q.innerHTML, code: [], hintCount: 0, hasSolution: true, reviewTopic: li.dataset.topic,
      options: li.dataset.type === "choice" ? [...li.querySelectorAll("label[data-option]")].map((l, i) => ({ index: i, id: l.dataset.option, text: text(l) })) : null,
      // sorted, not per option: per-option tags would reveal the one option without a tag (the right one)
      misconceptionTags: [...new Set([...li.querySelectorAll("label[data-misconception]")].map((l) => l.dataset.misconception))].sort() });
  }
  for (const task of document.querySelectorAll("article.task[data-id]")) {
    const pg = pageOf(task);
    const h = task.querySelector("h2").cloneNode(true); h.querySelector(".pill")?.remove();
    const promptNodes = [...task.querySelectorAll(":scope > .prompt, :scope > ol.abcd, :scope > .prompt-cmds, :scope > ul.manuals")];
    const specs = [...task.querySelectorAll(".answer-spec")];
    items.push({ id: task.dataset.id, kind: "problem", parentId: null, route: `#${pg.id}`, pageTitle: pg.dataset.title, unit: pg.dataset.unit,
      title: h.textContent.trim(), answerType: "multi-part", prompt: promptNodes.map(text).join("\n"), html: promptNodes.map((n) => n.outerHTML).join("\n"),
      code: codeOf(task.querySelectorAll(":scope > pre.code")), hintCount: task.querySelectorAll(".hints li").length,
      hasSolution: Boolean(task.querySelector(".solution .steps li")), solutionSteps: task.querySelectorAll(".solution .steps > ol > li").length,
      partIds: specs.map((s) => `${task.dataset.id}.${s.dataset.part}`), options: null });
    for (const s of specs) {
      items.push({ id: `${task.dataset.id}.${s.dataset.part}`, kind: "part", parentId: task.dataset.id, route: `#${pg.id}`, pageTitle: pg.dataset.title, unit: pg.dataset.unit,
        answerType: s.dataset.type, prompt: s.querySelector("label").textContent.trim(), placeholder: (s.querySelector("input,textarea") || { getAttribute: () => "" }).getAttribute("placeholder") || "",
        code: [], hintCount: 0, hasSolution: Boolean(task.querySelector(".solution .steps li")),
        options: s.dataset.type === "choice" ? s.dataset.options.split("|").map((o, i) => { const [id, t] = o.split(":"); return { index: i, id, text: t }; }) : null });
    }
  }
  // every element that the app writes state for, for the coverage test
  const stateful = [
    ...[...document.querySelectorAll(".check[data-id], .cyu[data-id], article.task[data-id]")].map((n) => n.dataset.id),
    ...[...document.querySelectorAll(".answer-spec[data-item-id]")].map((n) => n.dataset.itemId),
  ];
  return { items, stateful };
});
if (errors.length) throw new Error(`page errors: ${errors.join("; ")}`);

const entries = raw.items.map((it) => {
  const d = DATES[it.unit] || null;
  return {
    id: it.id,
    kind: it.kind,
    parentId: it.parentId,
    route: it.route,
    page: it.pageTitle,
    source: d ? { unit: d.unit, title: d.title, date: d.date, url: d.url } : null,
    ...(it.title ? { title: it.title } : {}),
    prompt: { text: it.prompt, ...(it.html ? { html: it.html } : {}), ...(it.code.length ? { code: it.code } : {}), ...(it.placeholder ? { placeholder: it.placeholder } : {}) },
    answerType: it.answerType,
    grader: it.kind === "problem" ? "per part (see partIds)" : GRADER[it.answerType],
    ...(it.format && it.format !== "typed" ? { format: it.format } : {}),
    ...(it.options ? { options: it.options } : {}),
    ...(it.misconceptionTags && it.misconceptionTags.length ? { feedbackKinds: it.misconceptionTags } : {}),
    ...(it.partIds ? { partIds: it.partIds } : {}),
    ...(it.reviewTopic ? { reviewRoute: `#${it.reviewTopic}` } : {}),
    recordShape: SHAPES[it.kind],
    hintCount: it.hintCount,
    hasSolution: it.hasSolution,
    ...(it.solutionSteps ? { solutionSteps: it.solutionSteps } : {}),
    gradable: it.kind !== "problem",
  };
});

// Never ship keys: scan for every non-trivial key value from js/keys.js.
// Allowed, with the reason: text the page itself shows as part of the item or of the lecture.
const KEY_TEXT_SHOWN = {
  "cse331-w2-l3-qc-junit-kind": "the prompt offers the two words: 'manual or automated'",
  "cse331-w2-l3-predict-lecture1-runs.word-output": "the lecture shows this run (slide 14); the sorter card on #l3-manual runs it",
  "cse331-w2-l3-predict-lecture1-runs.big-output": "2147483648 is in many prompts (the integer too big for an int)",
};
globalThis.self = globalThis;
req(join(siteDir, "js", "keys.js"));
const json = JSON.stringify(entries);
for (const [id, k] of Object.entries(globalThis.ANSWER_KEYS)) {
  if (json.includes(`"answer":`)) throw new Error("inventory contains an answer field");
  if (k.type === "choice") {
    const e = entries.find((x) => x.id === id);
    if (!e) throw new Error(`key ${id} has no inventory entry`);
    if (e.options && e.options.some((o) => Object.keys(o).some((key) => !["index", "id", "text"].includes(key)))) throw new Error(`option metadata could leak the answer for ${id}`);
  }
  // no key value appears in the inventory's text, except these, which the page shows on purpose
  for (const a of String(k.answer).split("|")) {
    if (k.type === "choice" || a.length < 6 || /^(stronger|weaker|stdout|stderr)$/.test(a)) continue;
    if (json.includes(a) && !KEY_TEXT_SHOWN[id]) throw new Error(`inventory contains key text for ${id}: ${JSON.stringify(a)}`);
  }
}

const inventory = {
  siteId: "cse331-26au-week2",
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  generatedBy: "tools/build-export.mjs from site/index.html (live DOM, headless Chromium)",
  notes: [
    "IDs are stable and semantic. Problems: cse331-w2-l3-<slug>; parts: <problemId>.<part-slug>; quick checks: cse331-w2-l3-qc-<slug>; sorter cards (graded quick checks, format 'sort'): cse331-w2-l3-sort-<slug>; quiz: cse331-w2-l3-quiz-<slug>.",
    "Only Lecture 3 (Mon Oct 5) has items. Section 1 (Tue Oct 6) and Testing 1/2 (Wed Oct 7, Fri Oct 9) were not posted when this was built, so they have no items.",
    "No content-version namespace is baked into IDs; the host assigns one.",
    "Answer keys are deliberately absent. They live in site/js/keys.js.",
    "Attempts: every Check press and every self-mark appends one Attempt { attemptId, seq, itemId, submittedAt, kind, answer, result, feedbackKind, hintsRevealedAtSubmit, solutionViewedBeforeSubmit } under store.attempts[itemId] (problem id for problems; parts are inside answer.parts / result.parts).",
  ],
  counts: Object.fromEntries(["problem", "part", "quickcheck", "quiz"].map((k) => [k, entries.filter((e) => e.kind === k).length])),
  items: entries,
  statefulDomIds: raw.stateful,
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(siteDir, join(outDir, "site"), { recursive: true });
writeFileSync(join(outDir, "state-inventory.json"), JSON.stringify(inventory, null, 2) + "\n");
writeFileSync(join(outDir, "README.md"), `# Export for integration (CSE 331 week 2)

Generated by \`node tools/build-export.mjs\` on ${inventory.generatedAt}. Do not edit by hand; edit \`../site/\` and regenerate.

- \`site/\` is a verbatim copy of \`../site/\` (static: open \`site/index.html\` through any static server).
- \`state-inventory.json\` lists every stateful item (${entries.length} entries: ${Object.entries(inventory.counts).map(([k, v]) => `${v} ${k}`).join(", ")}), generated from the live DOM. No answer keys.

State-owning files: \`site/js/store.js\` (store, adapter contract, outbox, retries, conflict merge, attempt history, migration),
\`site/js/app.js\` (reads and writes item state through the store; all DOM), \`site/js/grader.js\` (normalization and grading),
\`site/js/keys.js\` (answer keys), \`site/js/sum-sim.js\` (the Sum + shell simulator; no persisted state). Fonts are in \`site/fonts/\`.
See \`../INTEGRATION.md\`.
`);
console.log(`export: ${entries.length} inventory entries (${Object.entries(inventory.counts).map(([k, v]) => `${v} ${k}`).join(", ")}) -> export/state-inventory.json; site copied to export/site/`);
await browser.close();
srv.close();
