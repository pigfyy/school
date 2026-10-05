# CSE 332 week 2: integration contract

This is for Dot, who will add the backend and deploy. The site is static with no build step: open `site/index.html` from any static server (`node tests/lib/serve.mjs` serves it on port 9332) or from `file://`. It needs no login and makes no network requests of its own. KaTeX is vendored under `site/vendor/`; the fonts (IBM Plex Sans and IBM Plex Mono) are vendored under `site/fonts/` via `site/fonts.css`.

The pattern is the same as week 1's. `store.js` is unchanged except for its header comment, so one backend adapter serves both weeks, and `siteId` keeps their data apart. By default it saves learner work to the browser's `localStorage`. A backend takes over by defining one adapter object.

The standing requirements are stable semantic ids, a versioned schema, the async adapter hook, append-only `attempts[]`, edit-after-check invalidation, exact grading, good save-failure handling, a generated inventory with no answer keys, and no persistent save status. The field-level details below (change records, merge rules) are design decisions of this build, carried over unchanged from week 1.

## 0. What to take (the export)

**`site/` is the frontend export.** `export/` holds the generated state inventory. Nothing else is needed at runtime.

| File | Owns state? | Role |
|---|---|---|
| `site/js/store.js` | **yes: all persisted state** | Store, schema, migration, outbox, retry/backoff, conflict merge, the edit-invalidation rule (`clearGrade`), change records. The only module that touches storage. |
| `site/app.js` | in-page UI state only | Builds every answerable item from the markup and routes **every** read and write through `store.js`. Holds the visualizers' state (not persisted, on purpose) and the transient notices. Exposes `window.CourseSite`. |
| `site/js/grader.js` | no (pure) | All graders: exact integers/rationals (BigInt), Big-O classes (exact engine for \(b^n n^d \log^l n\) with rational exponents), O/Ω/Θ relations, yes/no (true/false accepted), word choice, the exact `c`/`n₀` decider and the exact smallest-`n₀` search. |
| `site/js/sim.js` | no (pure) | Simulations of Lecture 3's code (`contains`, `binary_contains` with gap trace, exhaustive worst case) and exact big-integer growth races. Checked against `tests/java/lecture3/Lecture3.java` output. |
| `site/index.html` | no | Content. Every stateful element carries its stable `data-id`. |
| `site/fonts.css`, `site/fonts/`, `site/base.css`, `site/course.css`, `site/vendor/` | no | Look (shared house style in `base.css`, this course's widgets in `course.css`), fonts, KaTeX. |
| `export/state-inventory.json` | no (generated) | One entry per stateful item. See §6. |
| `examples/mock-adapter.js` | no | Reference adapter with configurable latency, failure and conflict. Used by the tests. |

## 1. The adapter (the one hook)

Define it **before** the site scripts load:

```html
<script>
  window.COURSE_SITE_STORAGE = {
    name: "dot-backend",
    async load() { /* return the stored Store object, or null */ },
    async save(store, change) {
      /* persist; resolve normally on success (optionally { rev })            */
      /* on failure: throw / reject (any error)                                */
      /* on conflict: throw { code: "conflict", remote?: Store }               */
      /*          or: return { conflict: true, remote?: Store }                */
    },
  };
</script>
<script src="vendor/katex/katex.min.js"></script> … <script src="js/store.js"></script><script src="app.js"></script>
```

- `load()` is called once, after the page has already painted from the local mirror, so a slow `load()` never blocks typing. A missing, malformed, other-site or unknown-version result is treated as "nothing remote". A **newer** `schemaVersion` blocks all remote writes: that data is never overwritten, the learner sees a transient notice, and local typing still works and is mirrored locally.
- `save(store, change)` is called **once per change record**, in order, one at a time (never concurrently). `store` is the full current state (an upsert backend can ignore `change`). `change` is the delta (an event-style backend can append it and ignore `store`). Snapshot changes for the same item may be coalesced before sending. Attempt and event changes are **never** coalesced or dropped.
- With no adapter, the default is `localStorage["cse332-26au-week2:store"]` (plus `…:mirror` and `…:outbox`).
- Auth, user identity and which learner a store belongs to are the host's job. The site never asks.

## 2. Store schema (`schemaVersion: 2`)

```jsonc
{
  "siteId": "cse332-26au-week2",
  "schemaVersion": 2,
  "rev": 7,                         // whatever save() last returned as { rev }; opaque to the site
  "updatedAt": "2026-10-05T21:04:11.120Z",
  "items": {
    "cse332-w2-l3-example1-bigo": {  // kind "problem": keyed by article.task[data-id]
      "kind": "problem",
      "parts": {                     // keyed by part key; the part's full id is "<problemId>.<partKey>"
        "c":                { "raw": "10", "normalized": "10", "correct": true,  "feedbackKind": "n0-too-small", "detail": "Fails at n = 3: f(n) = 130 but c·g(n) = 90. This c can work; try a larger n₀." },
        "n0":               { "raw": "3",  "normalized": "3",  "correct": false, "feedbackKind": "n0-too-small", "detail": "…same…" },
        "smallest-n0-c10":  { "raw": "10", "normalized": "10", "correct": false, "feedbackKind": "not-smallest", "detail": null }
      },
      "result": "wrong",            // latest Check over the auto-graded parts: "right" | "wrong" | null (null after any edit)
      "selfMark": null,             // "got" | "missed" | null, self-check problems only (null after any edit)
      "work": "pick c = 10, then n(n-1) >= 10 …",   // free-form work box: a snapshot, never graded
      "hintsRevealed": 1,
      "solutionViewed": false,      // ever opened
      "solutionOpen": false,        // open right now
      "conflictCopies": [],         // text kept from the losing side of a merge (see §5)
      "attempts": [ /* §3 */ ],
      "events":   [ /* §3 */ ],
      "createdAt": "…", "updatedAt": "…"
    },
    "cse332-w2-l3-search-worst-million": {  // kind "quickcheck": keyed by .check[data-id]
      "kind": "quickcheck", "raw": "2*10", "choice": null, "normalized": "20", "correct": true, "feedbackKind": "correct",
      "attempts": [ … ], "events": [ … ], "createdAt": "…", "updatedAt": "…"
    },
    "cse332-w2-l3-cyu-definition-order": {  // kind "quiz": keyed by li.cyu[data-id]
      "kind": "quiz", "raw": "", "choice": 0, "normalized": "0", "correct": true, "feedbackKind": "correct", "revealed": false,
      "attempts": [ … ], "events": [ … ], "createdAt": "…", "updatedAt": "…"
    }
  }
}
```

`choice` is the 0-based index of the selected option (multiple choice). The option texts are listed, in order, in the state inventory. `normalized` is the machine-readable form the grader used: plain integers (`"1000000"`, not `"1,000,000"`), exact fractions (`"1/2"`), a canonical Big-O class (`"O(n log n)"`, `"O(2^n)"`, `"O(n^(1/10))"`), `"yes"`/`"no"` (true/false map to these), the chosen word, or the option index. A c/n₀ part's `detail` holds the exact verdict, e.g. the counterexample n. A record holds only a snapshot of the *current* state. Everything that happened lives in `attempts[]` and `events[]`.

### Migration and versions

- **v1 → v2** (latest-only records, where `attempts` was a number): the snapshot is kept, `attempts: []` and `events: []` are added, and the old count goes to `legacyAttemptCount`. **No attempts are fabricated.** v1 quiz `value` becomes `raw`. Unknown item kinds are dropped without crashing.
- `schemaVersion` newer than 2: read-only (remote never overwritten). Unknown or garbage: ignored as empty. Different `siteId`: ignored.
- If you change the store shape, bump `SCHEMA_VERSION` in `store.js` and add a branch to `migrate()`.

## 3. Attempt history (append-only)

Every **Check** press, every **MC Check**, and every self-check mark ("I got it" / "I missed something") appends exactly one attempt. Rapid repeated presses with identical answers stay distinct attempts.

```jsonc
{
  "attemptId": "6c1f…-uuid",         // crypto.randomUUID()
  "seq": 3,                          // per item, monotonic from 1
  "itemId": "cse332-w2-l3-example1-bigo",
  "itemKind": "problem",             // "problem" | "quickcheck" | "quiz"
  "submittedAt": "2026-10-05T21:04:11.120Z",
  "answer": {                        // problems: per part key. quick checks/quiz: { raw, normalized } or { choice, value }
    "c": { "raw": "10", "normalized": "10" },
    "n0": { "raw": "3", "normalized": "3" },
    "smallest-n0-c10": { "raw": "10", "normalized": "10" }
  },
  "result": {                        // per part: true | false | null (null = self-check, or not judged on its own)
    "parts": { "c": true, "n0": false, "smallest-n0-c10": false },
    "overall": false                 // self-check marks also carry "selfMark": "got" | "missed"
  },
  "feedbackKind": "n0-too-small,not-smallest", // "correct" | "incorrect" | misconception tag(s), comma-joined | "option-<k>" | "self-got" | "self-missed"
  "hintsRevealedAtSubmit": 1,
  "solutionViewedBeforeSubmit": false // problems: solution opened before; quiz: Show answer pressed before
}
```

**Events** go in a separate `events[]` per item: `{ eventId, seq, itemId, type, at, data }`, with `type` one of:
- `hint`: hint revealed, `data.level` = 1, 2, 3…
- `solution`: problem solution opened, `data.answered` says whether anything was typed
- `reveal`: quiz "Show answer"
- `clear`: "Clear my work" or quiz "Start over". The snapshot is reset; **history is kept**.

Hint reveals, solution views and reveals are **events, never attempts**. Autosaving typed input or work text is a **snapshot**, never an attempt.

Counting rules the site uses:
- "Submitted" / "Answered" = the item has at least one attempt after its last `clear` event, whatever the correctness. Wrong submissions count.
- "Currently correct" = the latest snapshot is graded correct (cleared by any edit).
- "Correct on the first try" (quiz) = the first attempt after the last `clear` was correct **and** the answer wasn't revealed before it.
- **Revealed without submitting** is *not* answered and not first-try correct. It's listed under "worth another look", and the quiz summary counts it toward "everything done" only so the summary can appear.

Attempts are never capped or truncated (tested with 500 on one item).

## 4. Change records and events

Every change is passed to `save(store, change)` and also dispatched as a DOM event, `document` → `course-site:change` with the same object as `detail`.

```jsonc
{ "changeId": "uuid", "siteId": "cse332-26au-week2", "schemaVersion": 2,
  "kind": "snapshot" | "attempt" | "event" | "reset" | "migrate",
  "itemId": "cse332-w2-l3-example1-bigo", "itemKind": "problem",
  "at": "2026-10-05T21:04:11.120Z",
  "record":  { … },      // the item's snapshot after the change (attempts/events omitted; they travel as their own records)
  "attempt": { … },      // kind "attempt" only: exactly one attempt (§3)
  "event":   { … } }     // kind "event" only: exactly one event
```

An event-style backend appends `attempt` and `event` records by id, and upserts `record`. A store-style backend just writes `store`.

Host API (`window.CourseSite`): `siteId`, `schemaVersion`, `storage()`, `exportState()`, `importState(store)`, `flush()` (pushes drafts and resolves when the outbox drains or fails), `pending()`, `onChange(fn)`. `document.documentElement.dataset.ready === "true"` once the adapter's `load()` has settled.

## 5. Failure, retry and conflict semantics

- **Typed text is never lost.** Every input handler writes to the store **synchronously**, and the store writes a local mirror (`<siteId>:mirror`) and the undelivered outbox (`<siteId>:outbox`) to `localStorage` on every change. Only the network write is debounced (600 ms for snapshots, immediate for attempts and events). Before any store-driven repaint (Check, hint, solution, reveal, clear) and on `pagehide` / `visibilitychange`, the page also flushes any DOM value that differs from the store.
- **Serialized saves:** one `save()` in flight. Snapshot changes for the same item coalesce in the outbox. Attempts and events never do.
- **Failure:** the change stays at the head of the outbox. Retries back off at 1, 2, 4, 8, 16, then every 30 s. The learner sees one **transient** toast ("Couldn't save … kept in this browser and will retry"), and another when saving works again. A reload during an outage restores everything from the mirror and resumes the outbox, so every attempt is delivered **exactly once**.
- **Conflict:** `save()` rejects with `{ code: "conflict", remote? }` or resolves `{ conflict: true, remote? }`. If `remote` is missing, the site calls `load()`. Merge policy:
  - `attempts[]` and `events[]`: **union by `attemptId` / `eventId`**, sorted by time then `seq`. Never dropped, never duplicated, so the merge is idempotent.
  - Snapshot fields: an item edited locally since the last successful save keeps the **local** version. Otherwise the newer `updatedAt` wins. `hintsRevealed` = max, `solutionViewed` / `revealed` = OR.
  - Losing non-empty `work` text that differs is kept in `conflictCopies` (`{ field, value, keptAt, from }`) and shown under the work box. It's never silently discarded.
  - The merged store is re-saved (up to 5 conflict rounds per flush). The learner sees a **transient** "combined" toast.
- **No persistent save status.** There is no "Saved"/"Saving" header or bar. Feedback is transient and appears only on failure, recovery, conflict, load failure or a newer-version block.

## 6. IDs and the state inventory

- IDs are **semantic and stable**: `cse332-w2-<l3|l4|s2|l5>-<slug>`. Only `l3` (Lecture 3, Mon Oct 5) has items this week. `l4` (Priority Queues 1), `s2` (Section 2) and `l5` (Priority Queues 2) are reserved for when those materials are posted. Parts are `<problemId>.<partKey>`, e.g. `cse332-w2-l3-example1-bigo.smallest-n0-c10`. Nothing is positional or auto-generated. A number in a slug is part of the question (`…-worst-million` means "for n = 1,000,000", `…-c10` means "with c = 10"), never an index.
- Week-1 and week-2 ids never collide (`w1` vs `w2`), and neither do their stores (`siteId`).
- c/n₀ parts carry `boundRole` (`c` | `n0`) and `boundPair` in the inventory. A problem may hold several pairs (`cse332-w2-l3-sq17-theta` has an `upper` and a `lower` pair), and each pair is graded on its own.
- **Change the ID when the question changes.** Fixing a typo keeps it. No content-version namespace is baked in; that's the host's job.
- `export/state-inventory.json` is **generated** from the live DOM by `tests/build-inventory.mjs`. Never edit it by hand; re-run the script. For each item it lists the id, kind (`problem | part | quickcheck | quiz`), parent id, route, session and date, the full prompt (plain text with TeX kept as `\( … \)`, the TeX sources, and the code), the grader kind and description, the multiple-choice option list, hint count, whether a solution exists and how many steps it has, the DOM selector, and the record shape (`storeKey`, fields, history). It contains **no answer keys**: no accepted answers, misconception keys, option explanations, hint text or solution text. The script fails if any stateful DOM element is missing, if IDs aren't unique, or if any look positional.

## 7. Edit invalidation (one rule for every input type)

Every editable input goes through one helper, `editDraft()` in `app.js`, which calls `CourseStore.clearGrade()`:

- **Keep** the raw draft (`raw` / `choice` / `parts[k].raw`) and write it to the store synchronously.
- **Clear** the current grade: `correct`, `normalized`, `feedbackKind`, `detail`, the problem's `result` and `selfMark`. Clear the DOM feedback, the red/green marks and the status pill.
- **Never** touch `attempts[]` or `events[]`.
- Re-entering the previously graded value does **not** bring back the grade. Only a new Check does.
- A quiz answer revealed with Show answer stays revealed while you edit.

| Input type | Covered by |
|---|---|
| quiz: exact integer, Big-O class, multiple choice | `editDraft(…, "quiz")` |
| quick check: exact integer, Big-O class, yes/no, multiple choice | `editDraft(…, "quickcheck")` |
| problem part: exact integer, Big-O class, yes/no, word choice, c/n₀ pair | `editDraft(…, "problem")` (clears the whole problem's grade) |
| problem part: self-check (+ the "I got it"/"I missed something" mark) | `editDraft(…, "problem")` (clears `selfMark`) |
| problem work box | snapshot only (`invalidate: false`): it's never graded, so editing it keeps the grade |
| visualizer controls (`hero-n`, `gap-k`, `worst-n`, `sw1-c1`, `sw2-c`, `simp-in`, `rel-f`, `tenth-k`, …) | not persisted; listed under `notPersisted` in the inventory |

The browser test `invalidation` group is **table-driven from `state-inventory.json`**. It finds every `(kind, grader)` pair in the inventory (13 this week) and fails if any pair lacks a case, so a new input type can't go uncovered.

## 8. Not included

No backend, accounts, sync service, deployment config or authentication. Answer keys live in the page source (fine for practice). The inventory export leaves them out.

## 9. Verification (tests/)

| Script | What it checks | Result (last run) |
|---|---|---|
| `unit-grader.mjs` | exact integers, the asymptotic-class engine (17-function ladder, all 289 pairs), slide 31/32 verdicts, `checkBound` and `smallestN0` vs brute force | 129 passed, 0 failed |
| `unit-store.mjs` | attempts, exactly-once delivery across failures and reloads, conflict merge, edit invalidation, migration, 500 attempts uncapped | 47 passed, 0 failed |
| `verify-answers.mjs` | compiles and runs `tests/java/lecture3/Lecture3.java`; every simulator value and every answer key against Java's exact BigInteger results; every misconception key is wrong; numbers quoted in prose | 584 passed, 0 failed (41 keys, 141 Java lines) |
| `build-inventory.mjs` | regenerates `export/state-inventory.json`; fails on missing/duplicate/positional ids or answer-key leaks | pass (71 items) |
| `browser.mjs` | Playwright: every route on desktop and mobile, file:// with no network, right/wrong answers, widgets, persistence, invalidation for every input type, races, failure/recovery, conflict, **no persistent save-status text or element** | 385 passed, 0 failed |
