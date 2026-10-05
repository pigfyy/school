# CSE 331 (Autumn 2026) · Week 2 teaching site

Covers the material posted for Mon Oct 5 to Fri Oct 9, 2026, as of Mon Oct 5 (~12:30 PDT): Lecture 3 (today,
"Reading 1 discussion; Batch processing": notes, slides, slides PDF) and Reading 1. Section 1 (Tue Oct 6) and the
Testing lectures (Wed Oct 7, Fri Oct 9) were not posted, so they appear only as upcoming with "materials not
posted yet". Homework 1 (due Fri Oct 9, 11:59 pm) gets its due date and link only. See `COVERAGE.md`.

Built with the `course-teaching-site` skill. The infrastructure (store, adapter contract, attempts, inventory,
tests) follows the week 1 site's pattern (`week1-release/cse331/`), adapted rather than modified.

```
site/              the website (static; works from file:// with no network)
  index.html         markup; every stateful element has a stable data-id
  base.css           shared house style (course-teaching-site), copied unchanged
  course.css         this site's widgets: three stream colors (stdout teal, stderr rust, exit status violet)
  fonts.css, fonts/  IBM Plex Sans + Mono, vendored (OFL)
  js/app.js          UI, routing, widgets, grading UI; talks to the store
  js/store.js        saved state: adapter contract, outbox, retries, conflict merge, attempts[], schema checks
  js/grader.js       normalization + exact grading (BigInt integers, exact program output, streams, ...)
  js/keys.js         answer keys + misconception tags (not in the HTML, not in the inventory)
  js/sum-sim.js      Lecture 3's Sum.java + a small bash, verified against real Java and real bash
export/            integration bundle: copy of site/ + state-inventory.json (generated)
examples/          mock-adapter.js (latency / failure / conflict injection)
tests/             compare-java.mjs, unit.mjs, browser.mjs, serve.mjs, java/ (Sum.java + the lecture's two changed copies)
tools/             build-export.mjs (inventory + export), sync-listing.mjs (puts tests/java/Sum.java into index.html)
raw/               the official pages, slides PDF, sources.json (URL, fetch time, sha256)
screenshots/       desktop 1280x800 and mobile 390x844
INTEGRATION.md     backend contract for Dot      COVERAGE.md   what's covered, gaps
```

## Preview

```bash
node tests/serve.mjs            # http://localhost:9331/   (?mock=1 loads the mock adapter)
```

Or open `site/index.html` directly (file://); nothing needs the network.

## Tests

```bash
cd tests && npm install         # playwright-core; uses Playwright's Chromium in ~/.cache/ms-playwright
node compare-java.mjs           # compiles tests/java with javac (or `java -m jdk.compiler`) and compares the simulator
                                # with real Java (and the shell with real bash). FULL=1 adds the out-of-memory boundary.
node unit.mjs                   # grader, keys vs simulator, store (attempts, retry, conflict, schema), shell
node ../tools/build-export.mjs  # regenerates export/ and the state inventory (fails if a key leaks)
node browser.mjs                # Playwright: every route at both sizes, answers, widgets, persistence,
                                # adapter failure/conflict, file:// offline, no save-status text, screenshots
```

If you change `tests/java/Sum.java`, run `node tools/sync-listing.mjs` so the page shows the same code.

## The site

- **Week overview** (`#home`): a runner for the lecture's `Sum`. Edit the arguments, standard input and files
  and see standard output, standard error and the exit status, plus which line ended the run.
- **Lecture 3 modules**, in the lecture's order: Reading 1 discussion (run sheet with timer), Stronger and
  weaker again (manual-vs-program grid), Sum from the command line (program map, Lecture 1 vs Lecture 3),
  Batch programs (argument walker, streams diagram, live bash for `>` / `$?` / pipes), The user manual on every
  run (graded sorter: described / silent / contradicted), Checks at the edge (remove lines 40–43 or 73–75 and
  run). Each ends with quick checks and open teaching notes.
- **Check your understanding**: 11 questions, marked as written for the site.
- **Problems**: 9, with hints, stepped solutions, teaching notes and exact checking. Problems 1–4 are the
  notes' and slides' in-lecture predictions; 5–9 are the notes' exercises 1–5.
- **Readings** and **Cheat sheet**.
