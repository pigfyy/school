// Generates export/state-inventory.json from the LIVE DOM (after app.js has built every item), not by hand.
// Answer keys are never exported: data-answer, data-accept, data-miscon, data-correct, .why explanations,
// hints' text and solution text are all left out. Only counts/flags about them are exported.
// Also checks: every stateful element appears exactly once, ids are unique, ids are semantic (not positional).
import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { serve, CHROME } from "./lib/serve.mjs";
const require = createRequire(import.meta.url); // the store module is UMD/CommonJS
const CourseStore = require("../site/js/store.js");
const here = new URL(".", import.meta.url).pathname;

const { srv, url } = await serve(`${here}../site/`);
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.goto(`${url}/#home`);
await page.waitForFunction(() => document.documentElement.dataset.ready === "true");

const raw = await page.evaluate(() => {
  const SESSIONS = {
    adt: ["lecture-1", "2026-09-30"], queues: ["lecture-1", "2026-09-30"], stacks: ["lecture-1", "2026-09-30"],
    "l1-problems": ["lecture-1", "2026-09-30"], "cyu-l1": ["lecture-1", "2026-09-30"],
    generics: ["section-1", "2026-10-01"], section: ["section-1", "2026-10-01"],
    analysis: ["lecture-2", "2026-10-02"], counting: ["lecture-2", "2026-10-02"], amortized: ["lecture-2", "2026-10-02"],
    search: ["lecture-2", "2026-10-02"], asymptotic: ["lecture-2", "2026-10-02"], "l2-problems": ["lecture-2", "2026-10-02"], "cyu-l2": ["lecture-2", "2026-10-02"],
  };
  // plain text of a node with KaTeX rendered output replaced by its TeX source and answers stripped
  function promptOf(node) {
    const c = node.cloneNode(true);
    c.querySelectorAll(".why, .hints, .solution, .my-work, .task-actions, .self-mark, .row, .feedback, details.notes, .pill, .answer-spec, input, button").forEach((x) => x.remove());
    const tex = [];
    c.querySelectorAll(".katex").forEach((k) => {
      const a = k.querySelector("annotation[encoding='application/x-tex']");
      const src = a ? a.textContent : k.textContent;
      tex.push(src);
      k.replaceWith(document.createTextNode(`\\(${src}\\)`));
    });
    const code = [...c.querySelectorAll("pre, code")].map((x) => x.textContent);
    return { text: c.textContent.replace(/\s+/g, " ").trim(), tex, code };
  }
  const pageOf = (n) => n.closest(".page").id;
  const sess = (n) => SESSIONS[pageOf(n)] || ["overview", null];
  const out = [];
  for (const task of document.querySelectorAll("article.task[data-id]")) {
    const p = promptOf(task);
    const specs = [...task.querySelectorAll(".answer-spec")];
    out.push({
      id: task.dataset.id, kind: "problem", parentId: null, route: `#${pageOf(task)}`,
      session: sess(task)[0], date: sess(task)[1], title: task.querySelector("h2").childNodes[0].textContent.trim(),
      prompt: { text: p.text, tex: p.tex, code: p.code },
      grader: specs.every((s) => s.dataset.grader === "self") ? "self-check" : "multi-part",
      parts: specs.map((s) => s.dataset.id),
      hintCount: task.querySelectorAll(".hints li").length,
      hasSolution: Boolean(task.querySelector(".solution .steps")),
      solutionStepCount: task.querySelectorAll(".solution .steps > ol > li").length,
      dom: `article.task[data-id="${task.dataset.id}"]`,
    });
    for (const s of specs) {
      const label = s.querySelector("label");
      const lab = label.cloneNode(true);
      lab.querySelectorAll(".katex").forEach((k) => { const a = k.querySelector("annotation"); k.replaceWith(document.createTextNode(`\\(${a ? a.textContent : k.textContent}\\)`)); });
      out.push({
        id: s.dataset.id, kind: "part", parentId: task.dataset.id, route: `#${pageOf(s)}`,
        session: sess(s)[0], date: sess(s)[1],
        prompt: { text: lab.textContent.trim(), html: label.innerHTML.includes("katex") ? null : label.innerHTML },
        graderRaw: s.dataset.grader, isHeader: s.hasAttribute("data-header"),
        points: s.dataset.points ? Object.fromEntries(Object.entries(JSON.parse(s.dataset.points)).map(([k, v]) => [k, v.length])) : null,
        boundRole: s.dataset.role || null,
        dom: `.answer-spec[data-id="${s.dataset.id}"] input`,
      });
    }
  }
  for (const box of document.querySelectorAll(".check[data-id]")) {
    const p = promptOf(box);
    const opts = [...box.querySelectorAll(".opts label")].map((l) => { const c = l.cloneNode(true); c.querySelectorAll(".why, input").forEach((x) => x.remove()); c.querySelectorAll(".katex").forEach((k) => { const a = k.querySelector("annotation"); k.replaceWith(document.createTextNode(`\\(${a ? a.textContent : ""}\\)`)); }); return c.textContent.trim(); });
    out.push({
      id: box.dataset.id, kind: "quickcheck", parentId: null, route: `#${pageOf(box)}`, session: sess(box)[0], date: sess(box)[1],
      prompt: { text: p.text, tex: p.tex, code: p.code }, graderRaw: box.dataset.grader, options: opts.length ? opts : null,
      hintCount: 0, hasSolution: false, hasOptionExplanations: opts.length > 0,
      dom: `.check[data-id="${box.dataset.id}"]`,
    });
  }
  for (const li of document.querySelectorAll(".cyu[data-id]")) {
    const q = li.querySelector(".q");
    const p = promptOf(q);
    const opts = [...li.querySelectorAll(".opts label")].map((l) => { const c = l.cloneNode(true); c.querySelectorAll(".why, input").forEach((x) => x.remove()); c.querySelectorAll(".katex").forEach((k) => { const a = k.querySelector("annotation"); k.replaceWith(document.createTextNode(`\\(${a ? a.textContent : ""}\\)`)); }); return c.textContent.trim(); });
    out.push({
      id: li.dataset.id, kind: "quiz", parentId: null, route: `#${pageOf(li)}`, session: sess(li)[0], date: sess(li)[1],
      quiz: li.closest("[data-quiz]").dataset.quiz, reviewTopic: `#${li.dataset.topic}`,
      prompt: { text: p.text, tex: p.tex, code: p.code }, graderRaw: li.dataset.grader, options: opts.length ? opts : null,
      hintCount: 0, hasSolution: true, solutionIs: "Show answer (logs a 'reveal' event)",
      dom: `.cyu[data-id="${li.dataset.id}"]`,
    });
  }
  // every element that can own learner state, found independently of the lists above
  const stateful = [
    ...[...document.querySelectorAll("article.task")].map((n) => n.dataset.id || "(missing)"),
    ...[...document.querySelectorAll(".answer-spec")].map((n) => n.dataset.id || "(missing)"),
    ...[...document.querySelectorAll(".check")].map((n) => n.dataset.id || "(missing)"),
    ...[...document.querySelectorAll(".cyu")].map((n) => n.dataset.id || "(missing)"),
  ];
  // inputs that are NOT persisted (visualizer controls) must not be inside a stateful item
  const unpersistedInputs = [...document.querySelectorAll("main input, main textarea, main select")]
    .filter((i) => !i.closest("article.task, .check, .cyu")).map((i) => i.id || i.getAttribute("aria-label"));
  return { items: out, stateful, unpersistedInputs };
});
await browser.close();
srv.close();

const GRADERS = {
  exact: "exact-integer (BigInt rational; arithmetic allowed; no tolerance)",
  decimal: "decimal-with-tolerance (only for non-integer money values; |x - key| <= tol, exact rationals)",
  formula: "formula-at-points (exact equality at every listed integer point)",
  bigo: "big-o-class (canonical class match; constants/extra terms accepted with a 'simplify' nudge)",
  yesno: "yes/no",
  choice: "letter-choice",
  java: "java-type (token-normalized; type parameters may be renamed consistently within the problem)",
  bound: "c-n0-pair (decides f(n) <=/>= c*g(n) for every integer n >= n0, exactly)",
  self: "self-check (learner marks 'I got it' / 'I missed something' after viewing the solution)",
  mc: "multiple-choice",
};
const PART_SHAPE = Object.fromEntries(CourseStore.RECORD_SHAPES.part.map((k) => [k, k === "correct" ? "true|false|null" : k === "raw" ? "string" : "string|null"]));
const shapeFor = (kind) => ({
  storeKey: kind === "part" ? "items[parentId].parts[partKey]" : "items[id]",
  fields: kind === "part" ? PART_SHAPE : CourseStore.RECORD_SHAPES[kind],
  history: kind === "part" ? "parent's attempts[].answer[partKey] and attempts[].result.parts[partKey]" : "attempts[] (RECORD_SHAPES.attempt), events[] (RECORD_SHAPES.event)",
});

const items = raw.items.map((it) => {
  const g = it.graderRaw ? GRADERS[it.graderRaw] : it.grader === "self-check" ? GRADERS.self : "multi-part (see parts)";
  const o = { ...it, grader: it.graderRaw || it.grader, graderDescription: g, record: shapeFor(it.kind) };
  if (it.kind === "part") o.partKey = it.id.slice(it.parentId.length + 1);
  delete o.graderRaw;
  return o;
});

/* ----------------------------------------------------------- checks */
const errors = [];
const ids = items.map((i) => i.id);
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
if (dup.length) errors.push(`duplicate ids: ${dup}`);
for (const s of raw.stateful) if (!ids.includes(s)) errors.push(`stateful element not in inventory: ${s}`);
if (raw.stateful.length !== ids.length) errors.push(`stateful count ${raw.stateful.length} != inventory ${ids.length}`);
// Positional = an index standing in for meaning: "p3", "q4", "part2", "check1", or a slug that is only a number.
// A number that is content of the question ("worst-1000" = n is 1000, "iterations-13" = target 13) is allowed,
// because it follows a descriptive word and changes only when the question changes.
const POSITIONAL_SEG = /^(p|q|a|b|part|item|cyu|check|problem|task|ex|question|s|l)\d+$/;
for (const id of ids) {
  if (!/^cse332-w1-(l1|l2|s1)-[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)?$/.test(id)) errors.push(`id not in the semantic format: ${id}`);
  const [main, part] = id.split(".");
  const slugSegs = main.split("-").slice(3);
  const partSegs = part ? part.split("-") : [];
  for (const segs of [slugSegs, partSegs]) {
    if (!segs.length) continue;
    if (segs.some((x) => POSITIONAL_SEG.test(x))) errors.push(`positional segment in ${id}`);
    if (/^\d+$/.test(segs[0])) errors.push(`slug starts with a bare number in ${id}`);
    if (segs.every((x) => /^\d+$/.test(x))) errors.push(`slug is only numbers in ${id}`);
  }
}
const json = JSON.stringify(items);
for (const leak of ["data-answer", "data-accept", "data-miscon", "data-correct"]) if (json.includes(leak)) errors.push(`answer-key attribute leaked: ${leak}`);

const inventory = {
  siteId: "cse332-26au-week1",
  schemaVersion: CourseStore.SCHEMA_VERSION,
  generatedAt: new Date().toISOString(),
  generatedBy: "tests/build-inventory.mjs (reads the live DOM of site/index.html after app.js runs)",
  note: "No answer keys, accepted answers, misconception keys, option explanations, hint text or solution text are included.",
  idRules: "Semantic, stable, never positional. Format cse332-w1-<l1|l2|s1>-<slug>; parts are <problemId>.<partKey>. Change the id when the question changes. Content-version namespaces are the host's job.",
  recordShapes: CourseStore.RECORD_SHAPES,
  counts: Object.fromEntries(["problem", "part", "quickcheck", "quiz"].map((k) => [k, items.filter((i) => i.kind === k).length])),
  graderKinds: Object.fromEntries(Object.entries(GRADERS).map(([k, v]) => [k, { description: v, count: items.filter((i) => i.grader === k).length }])),
  notPersisted: { why: "visualizer/stepper controls are exploration tools; they hold no learner answers", inputs: raw.unpersistedInputs },
  items,
};
mkdirSync(`${here}../export`, { recursive: true });
writeFileSync(`${here}../export/state-inventory.json`, JSON.stringify(inventory, null, 2) + "\n");
console.log(`inventory: ${items.length} items ${JSON.stringify(inventory.counts)}; checks: ${errors.length ? "FAIL" : "pass"} (${raw.stateful.length} stateful DOM elements, ids unique, semantic, no keys)`);
if (errors.length) { console.log(errors.join("\n")); process.exit(1); }
