# CSE 331 (Autumn 2026) · Week 1 teaching site

Covers Wed Sept 30 to Fri Oct 2: Lecture 1 ("Welcome! Whole program assertions"), Lecture 2
("Procedural abstraction and specification") and Reading 1. No section met that week, and Section 1
(Tue Oct 6) isn't posted yet. Built with the `course-teaching-site` skill from the official materials,
fetched into `raw/` on 2026-10-02. See `COVERAGE.md`.

```
site/            the website (static). index.html + fonts.css, base.css (shared house style, unchanged) and course.css (this course's widgets) + fonts/ (vendored IBM Plex) + js/
  js/app.js        UI, routing, widgets; talks to the store
  js/store.js      saved state: adapter contract, outbox, retries, conflict merge, attempt history, migration
  js/grader.js     answer normalization and grading (exact integers, no tolerance)
  js/keys.js       answer keys + misconception tags
  js/sum-sim.js    Lecture 1 Sum (4 versions), verified against real Java
  js/spec-sim.js   Lecture 2 indexOf/count/sign/maxList/middle/sumList, verified against real Java
export/          integration bundle: a copy of site/ + state-inventory.json (generated; see INTEGRATION.md)
examples/        mock-adapter.js (latency/failure/conflict injection)
tests/           compare-java.mjs, unit.mjs, browser.mjs, java/ sources
tools/           build-export.mjs (inventory + export), port-l1.py / assemble.py (one-off build of index.html)
raw/             the official pages + sources.json
screenshots/     desktop (1280x800) and mobile (390x844)
INTEGRATION.md   backend contract    COVERAGE.md   coverage inventory and gaps
```

Preview: `cd site && python3 -m http.server 8331`, then open <http://localhost:8331/>.

Tests (Java 17+, Node 20+):

```bash
cd tests && npm install      # playwright-core; uses Playwright's Chromium in ~/.cache/ms-playwright
node compare-java.mjs        # compiles the lecture Java (javac, or `java -m jdk.compiler` if javac is missing) and compares
node unit.mjs                # grader, answer keys, store (attempts, retry, conflict, migration)
node ../tools/build-export.mjs   # regenerates export/ and the state inventory
node browser.mjs             # Playwright: every route at both sizes, answers, stepper, persistence, screenshots
                             # (includes grading-state.mjs: drafts, edit-invalidation, repaint race, Answered)
```
