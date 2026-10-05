# CSE 312 (26au) · Week 2 teaching site

Covers Mon Oct 5 – Fri Oct 9, 2026. Lecture 3 (today, Mon Oct 5) is inclusion-exclusion, the pigeonhole principle and more. Lecture 4 (upcoming, Wed Oct 7) is discrete probability. Lecture 5 (upcoming, Fri Oct 9) is conditional probability and Bayes' theorem. The site also covers readings 1.3, 2.1 and 2.2. Lectures 4 and 5 are previews built from slides that were posted early. Section 2's handout isn't posted yet, and the site says so.

* **Open it:** `site/index.html` works from `file://` with no network, or run `node tests/serve.js` → http://127.0.0.1:9312/
* **Integration bundle for the backend:** `export/` (generated from `site/`) · contract in `INTEGRATION.md`
* **Coverage and gaps:** `COVERAGE.md`; sources, fetch times and hashes are in `raw/sources.json`
* **Screenshots:** `screenshots/` (desktop 1280×800 and mobile 390×844)

## Layout

| Path | What |
|---|---|
| `site/index.html` | All 25 pages (hash routes) and every stateful item with its `data-id` |
| `site/fonts.css`, `site/base.css`, `site/fonts/` | Shared course-teaching-site house style (dark rail, IBM Plex Sans + Mono), copied unchanged |
| `site/course.css` | This week's widget styles on the house tokens: set A = teal (a1), B = rust (a2), C = violet (a3) |
| `site/js/grader.js` | Exact BigInt-rational grader (week 1's, plus `%` and a "near" flag for rounded decimals) |
| `site/js/prob.js` | Enumerators (cards, rooks, dice, coins) and the in-page brute-force registry |
| `site/js/store.js` | Versioned learner store, adapter hook, outbox, retry, conflict merge (week 1's contract, site id `cse312-26au-week2`) |
| `site/js/app.js` | UI: problems, quick checks, quizzes, widgets |
| `site/vendor/` | KaTeX 0.16.11, vendored |
| `scripts/extract.js`, `scripts/build-inventory.js` | Read the DOM and write `export/state-inventory.json` and `export/site/` |
| `examples/mock-adapter.js` | Mock backend (latency, failures, conflicts) |
| `tests/` | `answers`, `store`, inventory check and `browser` (Playwright) suites, plus `serve.js` |

## Tests

```
cd tests && npm install && cd ..
node tests/run-all.js
```

This regenerates `export/`, then runs `answers.test.js`, `store.test.js`, `scripts/build-inventory.js --check` and `browser.test.js` (headless Chromium from `~/.cache/ms-playwright`, or `CHROMIUM_PATH`).

Nothing here is deployed, committed or authenticated.
