# CSE 332 (Autumn 2026) · week 1 teaching site

Covers Wed Sept 30 – Fri Oct 2: Lecture 1 (ADTs, queues, stacks), Section 1 (Java generics) and Lecture 2 (algorithm analysis 1).

```
site/            the site (static; open site/index.html via any static server). This is the frontend export.
export/          state-inventory.json, generated from the live DOM (no answer keys)
examples/        mock-adapter.js, a reference storage adapter (latency / failure / conflict knobs)
raw/             official materials as fetched + sources.json + extracted text (raw/text/)
tests/           verification (see below)
screenshots/     desktop 1280×800 and mobile 390×844
INTEGRATION.md   storage adapter contract, schema, attempts/events, change records, failure/conflict rules, ID rules
COVERAGE.md      every week-1 item → source URL → where it is on the site, plus gaps
```

Preview: `python3 -m http.server -d site 8332`, then open http://localhost:8332/

Tests (from `tests/`, after `npm install`; Chromium comes from the local Playwright cache, or set `CHROME=`):

```
npm test   # unit-grader → unit-store → verify-answers (javac + brute force) → build-inventory → browser
```

`javac` isn't on PATH on this machine (JRE-only install), so the tests call `java -m jdk.compiler/com.sun.tools.javac.Main`.
