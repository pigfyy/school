# CSE 332 (Autumn 2026) · week 2 teaching site

Covers Mon Oct 5 – Fri Oct 9, 2026. Taught: **Lecture 3, Algorithm Analysis 2** (Mon Oct 5, labeled "Today · Mon Oct 5"). Listed as **Upcoming, not posted yet**: Priority Queues 1 (Wed Oct 7), Section 2 (Thu Oct 8), Priority Queues 2 (Fri Oct 9). EX0 (due Fri Oct 9): date and link only.

```
site/            the site (static, no build step; works from a static server or file://). This is the frontend export.
export/          state-inventory.json, generated from the live DOM (no answer keys)
examples/        mock-adapter.js, a reference storage adapter (latency / failure / conflict knobs)
raw/             official materials as fetched + sources.json (URL, fetch time, sha256) + raw/text/ + raw/png/ (slide renders)
tests/           verification (see below); tests/java/lecture3/Lecture3.java is the ground truth
screenshots/     desktop 1280×800 and mobile 390×844
INTEGRATION.md   storage adapter contract, schema, attempts/events, change records, failure/conflict rules, ID rules
COVERAGE.md      every week-2 item → source URL → where it is on the site, plus gaps
```

Preview (port 9332):

```
node tests/lib/serve.mjs        # → http://localhost:9332/
```

Or open `site/index.html` directly (file://). KaTeX and fonts are vendored, so no network is needed. The look is the shared course-teaching-site house style: `site/base.css` (copied unchanged) plus `site/course.css` for this week's widgets.

Tests (from `tests/`, after `npm install`; Chromium comes from the local Playwright cache, or set `CHROME=`):

```
npm test   # unit-grader → unit-store → verify-answers (javac + exact BigInteger ground truth) → build-inventory → browser
```

`javac` isn't on PATH on this machine (JRE-only install), so the tests call `java -m jdk.compiler/com.sun.tools.javac.Main`.

## What's on the site

| Route | Slides | Interactive piece |
|---|---|---|
| `#home` | 1–5 | Hero: n⁵⁰ vs 1.1ⁿ compared exactly with big integers (flip between 4,401 and 4,402), digits chart |
| `#search` | 6–11 | Gap-halving stepper on the slide-8 code (checked against Java on k = 0…100); worst case for any n (exhaustive up to 10⁶); log-base table |
| `#notation` | 12–18 | Clickable quantifiers of the definition; Θ sandwich c₁g ≤ f ≤ c₂g with exact smallest n₀; case × bound grid |
| `#proofs` | 19–26 | Examples 1 and 2 (scratchwork + proof); "try your own c" with exact smallest n₀ or proof that none works |
| `#drop` | 27–29 | Expression simplifier → Θ class, placed on slide 29's category ladder |
| `#examples` | 30–32 | O/Ω/Θ classifier (slide 31's five claims); exact "eventually" races (n⁵⁰ vs 1.1ⁿ, 3ⁿ vs 1000·2ⁿ) with table view |
| `#usage` | 33–37 | n^(1/10) vs log n slider (crossover at n = 2⁵⁹ ≈ 5.8·10¹⁷, matches slide 36) |
| `#l3-problems` | — | 11 problems (40 answer boxes): exact, Big-O, yes/no, word choice, c/n₀ pairs, self-check |
| `#cyu-l3` | — | 10-question wrap-up quiz (written for the site; marked once under the title) |
| `#upcoming` | — | PQ 1, Section 2, PQ 2, EX0: honest "not posted yet" cards |
| `#readings`, `#cheatsheet` | — | Readings with what to read for; printable cheat sheet incl. math-identities log and sum rules |

## Last test run (2026-10-05)

| Suite | Result |
|---|---|
| unit-grader | 129 passed, 0 failed |
| unit-store | 47 passed, 0 failed |
| verify-answers (javac + Java BigInteger ground truth) | 584 passed, 0 failed |
| build-inventory | pass, 71 items |
| browser (Playwright, desktop + mobile) | 385 passed, 0 failed |
