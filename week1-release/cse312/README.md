# CSE 312 (26au) · Week 1 teaching site

Covers Wed Sept 30 – Fri Oct 2, 2026: Lecture 1 (counting rules), Quiz Section 1 (counting practice) and Lecture 2 (combinations and binomial coefficients), with their readings.

* **Open it:** `site/index.html` (static; it also works from `file://`), or `node tests/serve.js` → http://127.0.0.1:8312/
* **Integration bundle for the backend:** `export/` (generated from `site/`) · contract in `INTEGRATION.md`
* **What's covered and where it came from:** `COVERAGE.md`, `raw/sources.json`, `raw/*.pdf|*.txt`
* **Screenshots:** `screenshots/` (desktop 1280×800 and mobile 390×844)

## Tests

```
cd tests && npm install && cd ..
node tests/run-all.js
```
runs `answers.test.js` (every answer vs brute force and the official solutions, plus the exact grader), `store.test.js` (persistence contract), `scripts/build-inventory.js --check` (state inventory) and `browser.test.js` (Playwright, headless Chromium).

Nothing here is deployed, committed or authenticated.
