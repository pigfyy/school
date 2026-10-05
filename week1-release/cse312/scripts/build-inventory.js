"use strict";
/*
  Generates export/state-inventory.json from site/index.html (via scripts/extract.js) and copies the
  frontend into export/site/. No answer keys are written.

    node scripts/build-inventory.js          regenerate export/
    node scripts/build-inventory.js --check  also verify: ids unique, none positional, every stateful DOM node
                                             listed, file on disk up to date, no answer keys leaked
*/
const fs = require("fs");
const path = require("path");
const { extract } = require("./extract.js");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "export");
const SITE = path.join(ROOT, "site");
const { SITE_ID, SCHEMA_VERSION } = require(path.join(SITE, "js/store.js"));

const ATTEMPT_SHAPE = {
  attemptId: "string (unique, att-<uuid>)",
  seq: "integer, per-item, starts at 1, strictly increasing",
  itemId: "string (the item id)",
  submittedAt: "ISO 8601 timestamp",
  answer: "see answerShape",
  result: "see resultShape",
  feedbackKind: "\"correct\" | misconception tag(s) (comma-joined for multi-part) | \"incorrect\" | \"self-correct\" | \"self-missed\"",
  hintsRevealedAtSubmit: "integer",
  solutionViewedBeforeSubmit: "boolean",
};
const EVENT_SHAPE = { eventId: "string (evt-<uuid>)", seq: "integer, per-item", itemId: "string", at: "ISO 8601", type: "string" };

function recordShape(kind, item) {
  if (kind === "problem") {
    return {
      storedAt: "store.items[id]",
      snapshot: {
        id: "string", kind: "\"problem\"", updatedAt: "ISO 8601 | null",
        parts: `{ [partId]: { raw: string, normalized: string | null, correct: boolean | null, checkedAt: ISO 8601 | null } } for partIds ${JSON.stringify(item.parts)}`,
        work: "string (free-form work text)",
        hintsRevealed: "integer", hintLevels: "integer[] (1-based levels shown)",
        solutionViewed: "boolean", solutionViewedAt: "ISO 8601 | null",
        selfMark: "\"got\" | \"missed\" | null",
        overall: "boolean | null (last check: every auto-graded part correct)",
        firstTryCorrect: "boolean | null",
      },
      attempts: {
        ...ATTEMPT_SHAPE,
        type: "\"check\" | \"self-check\"",
        selfMark: "\"got\" | \"missed\" (self-check only)",
        hintLevelsAtSubmit: "integer[]",
        answerShape: "{ [partId]: { raw: string, normalized: string } }",
        resultShape: "{ parts: { [partId]: true | false | null (self-check part) }, overall: boolean }",
      },
      events: { ...EVENT_SHAPE, type: "\"hint\" (+ level) | \"solution\" (+ attemptedBefore) | \"clear\"" },
    };
  }
  if (kind === "part") {
    return {
      storedAt: `store.items["${item.parentId}"].parts["${item.id}"] (latest); attempts live on the parent: store.items["${item.parentId}"].attempts[].answer["${item.id}"] and .result.parts["${item.id}"]`,
      snapshot: { raw: "string", normalized: "string | null (canonical exact value, e.g. \"1437004800\", or normalized formula/yes-no text)", correct: "boolean | null", checkedAt: "ISO 8601 | null" },
    };
  }
  if (kind === "quickcheck") {
    return {
      storedAt: "store.items[id]",
      snapshot: { id: "string", kind: "\"quickcheck\"", raw: "string", normalized: "string", correct: "boolean | null", tries: "integer", firstTryCorrect: "boolean | null", revealed: "boolean (always false: quick checks have no reveal)", updatedAt: "ISO 8601 | null" },
      attempts: { ...ATTEMPT_SHAPE, answerShape: "{ raw: string, normalized: string }", resultShape: "{ correct: boolean, overall: boolean }" },
      events: { ...EVENT_SHAPE, type: "\"clear\"" },
    };
  }
  const mc = item.grader === "multiple-choice";
  return {
    storedAt: "store.items[id]",
    snapshot: { id: "string", kind: "\"quiz\"", choice: mc ? "option value | null" : "null", raw: mc ? "\"\"" : "string", normalized: "string", correct: "boolean | null", tries: "integer", firstTryCorrect: "boolean | null (false once the answer was revealed before a correct try)", revealed: "boolean", updatedAt: "ISO 8601 | null" },
    attempts: {
      ...ATTEMPT_SHAPE,
      answerShape: mc ? "{ choice: option value, choiceIndex: integer, raw: option value, normalized: option value }" : "{ raw: string, normalized: string }",
      resultShape: "{ correct: boolean, overall: boolean }",
    },
    events: { ...EVENT_SHAPE, type: "\"reveal\" | \"clear\"" },
  };
}

async function build() {
  const items = await extract({ withKeys: false });
  const inventory = {
    siteId: SITE_ID,
    schemaVersion: SCHEMA_VERSION,
    generatedFrom: "site/index.html (scripts/build-inventory.js)",
    note: "No answer keys. Ids are stable and semantic; change an id when its question or answer changes. Content-version namespacing is left to the host.",
    counts: items.reduce((acc, it) => ({ ...acc, [it.kind]: (acc[it.kind] || 0) + 1 }), {}),
    items: items.map((it) => ({ ...it, record: recordShape(it.kind, it) })),
  };
  return inventory;
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

const POSITIONAL = [/-\d+$/, /\.\d+$/, /(^|[-.])(q|p|item|part|cyu|task)\d+([-.]|$)/i, /-a\d+$/];

async function main() {
  const check = process.argv.includes("--check");
  const inv = await build();
  const json = `${JSON.stringify(inv, null, 2)}\n`;
  const file = path.join(OUT, "state-inventory.json");
  const failures = [];

  if (check) {
    const ids = inv.items.map((i) => i.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dup.length) failures.push(`duplicate ids: ${dup.join(", ")}`);
    for (const id of ids) {
      if (!id.startsWith("cse312-w1-")) failures.push(`id without site prefix: ${id}`);
      if (POSITIONAL.some((re) => re.test(id))) failures.push(`positional-looking id: ${id}`);
      if (!/^[a-z0-9][a-z0-9.-]*$/.test(id)) failures.push(`id has unexpected characters: ${id}`);
    }
    for (const it of inv.items.filter((i) => i.kind === "part")) {
      if (!it.id.startsWith(`${it.parentId}.`)) failures.push(`part ${it.id} does not extend parent ${it.parentId}`);
    }
    // every stateful node in the DOM is in the inventory (count independently with a regex over the source)
    const html = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
    const domIds = [...html.matchAll(/<(?:article|div|li)\b[^>]*\bdata-(?:id|part-id)="([^"]+)"/g)].map((m) => m[1]);
    const missing = domIds.filter((id) => !ids.includes(id));
    const extra = ids.filter((id) => !domIds.includes(id));
    if (missing.length) failures.push(`in DOM but not in inventory: ${missing.join(", ")}`);
    if (extra.length) failures.push(`in inventory but not in DOM: ${extra.join(", ")}`);
    // no answer keys
    // no answer keys: no item carries an answer, a correct-option marker, or a misconception's trigger value
    for (const it of inv.items) {
      if ("answer" in it || "vars" in it || "correctCount" in it) failures.push(`answer key in inventory item ${it.id}`);
      for (const m of it.misconceptions || []) if ("expr" in m) failures.push(`misconception value in inventory item ${it.id}`);
      for (const o of it.options || []) if ("correct" in o) failures.push(`correct option marked in inventory item ${it.id}`);
    }
    if (/data-correct/.test(json)) failures.push("inventory html contains data-correct");
    // up to date
    const onDisk = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (onDisk !== json) failures.push("export/state-inventory.json is out of date (run node scripts/build-inventory.js)");
    // export/site matches site/
    const expSite = path.join(OUT, "site");
    for (const rel of ["index.html", "base.css", "course.css", "fonts.css", "js/app.js", "js/store.js", "js/grader.js", "js/counting.js"]) {
      const a = fs.readFileSync(path.join(SITE, rel), "utf8");
      const b = fs.existsSync(path.join(expSite, rel)) ? fs.readFileSync(path.join(expSite, rel), "utf8") : null;
      if (a !== b) failures.push(`export/site/${rel} differs from site/${rel}`);
    }
    const counts = inv.counts;
    console.log(`inventory: ${inv.items.length} items ${JSON.stringify(counts)}; DOM stateful nodes: ${domIds.length}`);
    if (failures.length) {
      console.log(`FAIL\n  ${failures.join("\n  ")}`);
      process.exit(1);
    }
    console.log("PASS inventory: ids unique, semantic, non-positional; every stateful DOM node listed; no answer keys; export up to date");
    return;
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(file, json);
  fs.rmSync(path.join(OUT, "site"), { recursive: true, force: true });
  copyDir(SITE, path.join(OUT, "site"));
  fs.mkdirSync(path.join(OUT, "examples"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "examples/mock-adapter.js"), path.join(OUT, "examples/mock-adapter.js"));
  console.log(`wrote ${path.relative(ROOT, file)} (${inv.items.length} items) and export/site/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
