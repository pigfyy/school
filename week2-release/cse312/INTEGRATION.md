# CSE 312 week 2 site: backend integration contract

For Dot (host/backend). Week 2 uses the same contract as week 1 (same store schema, adapter API, change records and failure semantics), with its own site id, so one backend adapter serves both weeks. This covers the storage adapter, the stored data, change records, ids, attempt history, and how failures and conflicts are handled.

The site is static: `site/index.html` plus JS and CSS, no build step, no network requests of its own. KaTeX and the font are vendored. Nothing here deploys anything or adds auth.

## 1. What to integrate

`export/` is the integration bundle. `node scripts/build-inventory.js` regenerates it from `site/`, and the `--check` mode fails if it is stale.

| Path | Owns state? | Role |
|---|---|---|
| `export/site/js/store.js` | **yes, all of it** | Store, schema, migration, outbox, retry/backoff, conflict merge, change events. `window.CourseStore`. |
| `export/site/js/app.js` | writes through store only | UI. Builds answer boxes, quick checks, quizzes, widgets. Calls `store.update / addAttempt / addEvent / clear`. Shows transient notices. Exposes the live store as `window.COURSE_SITE`. |
| `export/site/js/grader.js` | no | Exact grader (BigInt rationals). Produces `normalized` values and misconception tags. |
| `export/site/js/prob.js` | no | Enumerators (cards, rooks, dice, coins) for the widgets and "Check by brute force" buttons. |
| `export/site/index.html` | declares items | Every stateful item, with its stable id (`data-id`, `data-part-id`). |
| `export/site/fonts.css`, `base.css`, `course.css`, `fonts/`, `vendor/` | no | Styles, fonts, KaTeX. |
| `export/state-inventory.json` | describes state | One entry per stateful item (generated, no answer keys). See §6. |
| `export/examples/mock-adapter.js` | test double | Configurable latency, failure and conflicts. Used by `tests/browser.test.js`. |

Script order in `index.html`: `grader.js`, `prob.js`, `store.js`, `app.js`. To plug in a backend, set `window.COURSE_SITE_STORAGE` before `app.js` runs, e.g. with an inline `<script>` placed before it.

## 2. Adapter API

```js
window.COURSE_SITE_STORAGE = {
  name: "my-backend",                 // shown nowhere; for logs/tests
  async load() {                      // → whole store object, or null if this learner has nothing yet
    return fetchJson("/state");       // may be slow; may throw
  },
  async save(store, change) {         // store: full store (see §3), change: one batch (see §4)
    // Option A (snapshot backend): replace the learner's document with `store`
    //   when change.baseRevision matches the server's revision.
    // Option B (event backend): append change.changes[*] (dedupe by changeId / attemptId).
    // Return { revision } on success.
    // On a stale write, return { conflict: true, remote: <server store> }
    //   or throw an error with err.code = "conflict" (and optionally err.remote).
    // Throw anything else on failure; the site retries.
  },
};
```

* If no adapter is installed, a **localStorage adapter** is used (key `cse312-26au-week2:store`). It applies the same revision check, so two open tabs merge instead of overwriting each other.
* Learner identity and auth are the host's job. The adapter decides whose store `load`/`save` touch. No learner id is stored in the payload.
* `load()` runs once at startup, after the page has already restored from the local mirror. A slow or failing `load()` never blocks typing. Remote data is merged in when it arrives (§7).
* `save()` calls are **serialized**: at most one is in flight. They're debounced (about 150 ms after an attempt or event, 600 ms after typing) and retried with exponential backoff (1 s, 2 s, 4 s … capped at 30 s) until they succeed.

## 3. Store schema (schemaVersion 2)

```jsonc
{
  "schemaVersion": 2,
  "siteId": "cse312-26au-week2",
  "revision": 1,                     // bumped by the site on every successful save; used for conflict detection
  "updatedAt": "2026-10-05T20:48:58.747Z",
  "items": { "<itemId>": { /* item record, below */ } },
  "legacy": { "log": [ /* only present if v1 data with a log was migrated; kept verbatim */ ] }
}
```

Every item record has `id`, `kind`, `updatedAt`, an append-only **`attempts[]`** and an append-only **`events[]`**. The rest is the latest snapshot of that item.

### problem (`kind: "problem"`)
This record was produced by the real store (`tests/` generate the same shape):

```json
{
  "id": "cse312-w2-l5-p-zika",
  "kind": "problem",
  "updatedAt": "2026-10-05T20:48:58.747Z",
  "attempts": [
    {
      "attemptId": "att-07c20cac-736f-4013-8793-c68ef0c35f84",
      "seq": 1,
      "itemId": "cse312-w2-l5-p-zika",
      "submittedAt": "2026-10-05T20:48:58.747Z",
      "type": "check",
      "answer": {
        "cse312-w2-l5-p-zika.pt": {
          "raw": "0.005*0.98+0.995*0.01",
          "normalized": "297/20000"
        },
        "cse312-w2-l5-p-zika.pzt": {
          "raw": "0.33",
          "normalized": "33/100"
        },
        "cse312-w2-l5-p-zika.neg": {
          "raw": "1-98%",
          "normalized": "1/50"
        }
      },
      "result": {
        "parts": {
          "cse312-w2-l5-p-zika.pt": true,
          "cse312-w2-l5-p-zika.pzt": false,
          "cse312-w2-l5-p-zika.neg": true
        },
        "overall": false
      },
      "feedbackKind": "rounded",
      "hintsRevealedAtSubmit": 1,
      "hintLevelsAtSubmit": [
        1
      ],
      "solutionViewedBeforeSubmit": false
    }
  ],
  "events": [
    {
      "eventId": "evt-de24aed4-bc5c-4293-aecd-753b2cfe0faa",
      "seq": 1,
      "itemId": "cse312-w2-l5-p-zika",
      "at": "2026-10-05T20:48:58.745Z",
      "type": "hint",
      "level": 1
    }
  ],
  "parts": {
    "cse312-w2-l5-p-zika.pt": {
      "raw": "0.005*0.98+0.995*0.01",
      "normalized": "297/20000",
      "correct": true,
      "checkedAt": "2026-10-05T20:48:58.747Z"
    },
    "cse312-w2-l5-p-zika.pzt": {
      "raw": "0.33",
      "normalized": "33/100",
      "correct": false,
      "checkedAt": "2026-10-05T20:48:58.747Z"
    },
    "cse312-w2-l5-p-zika.neg": {
      "raw": "1-98%",
      "normalized": "1/50",
      "correct": true,
      "checkedAt": "2026-10-05T20:48:58.747Z"
    }
  },
  "work": "LTP over Z and not Z, then Bayes.",
  "hintsRevealed": 1,
  "hintLevels": [
    1
  ],
  "solutionViewed": false,
  "solutionViewedAt": null,
  "selfMark": null,
  "overall": false,
  "firstTryCorrect": false
}
```

* `parts[partId].raw` is exactly what was typed. `normalized`/`correct`/`checkedAt` describe the last Check of that exact text and are reset to `null` when the text changes (see "Latest-grade invalidation" in §3). `normalized` is the canonical exact value (integers as decimal strings with any number of digits, e.g. `"-14306267627520000000"`; fractions and decimals as reduced `"p/q"`, so `0.33` → `"33/100"` and `98%` → `"49/50"`; formula answers as compacted lowercase text; yes/no as `"yes"`/`"no"`). It is `null` until checked.
* Self-check parts (sets typed as text) are stored with `normalized` = trimmed text and `correct: null`. The learner's "I got it" / "I missed something" press is recorded as an attempt with `type: "self-check"` and `selfMark`.
* `overall` is whether every auto-graded part was correct on the last check. For all-self-check problems it reflects the self-mark.

### quickcheck (`kind: "quickcheck"`)
`{ id, kind, raw, normalized, correct, tries, firstTryCorrect, revealed: false, updatedAt, attempts[], events[] }`. Attempt `answer` is `{ raw, normalized }` and `result` is `{ correct, overall }`.

### quiz question (`kind: "quiz"`)
`{ id, kind, choice, raw, normalized, correct, tries, firstTryCorrect, revealed, updatedAt, attempts[], events[] }`.
* Multiple choice: attempt `answer` is `{ choice: "<option value>", choiceIndex, raw, normalized }`. Option values are semantic (e.g. `"contain-n"`, `"not-uniform"`), and the inventory lists them.
* Numeric: attempt `answer` is `{ raw, normalized }`.
* `firstTryCorrect` is `false` if the learner pressed **Show answer** before a correct try. A reveal is an event (`type: "reveal"`), not an attempt.

### Attempts vs. snapshots vs. events

| Action | Recorded as |
|---|---|
| Press **Check** (problem, quick check, quiz) with a readable answer | **attempt** (+ updated snapshot) |
| Press **I got it** / **I missed something** | **attempt** (`type: "self-check"`) |
| Press Check with an empty or unreadable answer | nothing. The learner gets a syntax hint, and no attempt is recorded because no answer was submitted. |
| Typing in an answer box or the work box, picking a radio button | **snapshot** only (an ungraded draft, saved on every keystroke/selection and restored on reload with no grade shown) |
| Reveal a hint | **event** `{type:"hint", level}` (+ snapshot `hintsRevealed`, `hintLevels`) |
| Open a solution | **event** `{type:"solution", attemptedBefore}` (+ snapshot `solutionViewed`, `solutionViewedAt`) |
| Quiz **Show answer** | **event** `{type:"reveal"}` |
| **Clear my work** / quiz **Start over** | the snapshot is reset and an **event** `{type:"clear"}` is added. `attempts[]` and `events[]` are **kept**. |

Latest-grade invalidation (snapshot semantics; the stored shape is unchanged, so `schemaVersion` stays 2):
* The grading fields describe **the current input**, never an older one. As soon as an answer box is edited or an MC selection changes, the snapshot's latest grade is cleared and saved through the adapter like any snapshot:
  * quick check and quiz: `correct = null`, `normalized = ""`, with `raw` / `choice` kept;
  * problem: `parts[partId] = { raw, normalized: null, correct: null, checkedAt: null }`, `overall = null`, `selfMark = null`.
  The page clears the feedback text, the right/wrong marks, the "Correct" badge/pill and the explanation too. `work`, `hintsRevealed`, `solutionViewed`, `revealed` and the aggregate history fields (`tries`, `firstTryCorrect`) are kept.
* Re-entering the exact value that was graded before does **not** bring the grade back; only a new Check does.
* `attempts[]` and `events[]` are never modified by an edit. The original graded attempt stays in history exactly as recorded.

Input types and the shared invalidation path (`store.editDraft(id, kind, draft)` in `store.js`; every gradable input calls it on each keystroke or selection):

| Input type (inventory `kind/grader`) | Draft kept | Cleared on edit |
|---|---|---|
| `quickcheck/exact-expression` | `raw` | `correct`, `normalized` |
| `quiz/exact-expression` | `raw` | `correct`, `normalized` |
| `quiz/multiple-choice` | `choice` | `correct`, `normalized`, `raw` |
| `part/exact-expression`, `part/formula`, `part/yes-no` | `parts[partId].raw` | `parts[partId].{normalized, correct, checkedAt}`, `overall`, `selfMark` |
| `part/self-check` (got/missed) | `parts[partId].raw` | same as above, so a "got" self-mark is cleared by any edit |
| work box, hints, solution, reveal | not gradable; not invalidated | — |
| widgets (hero slots, enumerators, sliders, steppers) | not persisted | — |

`feedbackKind` exists only on attempts, so nothing in the snapshot holds it. The page clears feedback text, right/wrong marks, the "Correct" badge or pill, and the got/missed `aria-pressed` at the same moment. A table-driven browser test reads every `kind/grader` from `state-inventory.json` and fails if a new type has no case.

Rounded decimals (week 2). Probability answers are exact. A part with `data-near` (shown in the inventory only as the grader type, never the tolerance) grades a rounded decimal such as `0.33` for \(98/297\) as **wrong**, with feedback saying it looks rounded. The attempt's `feedbackKind` is `"rounded"`. Its `normalized` value is the exact value typed (`"33/100"`), never the key.

Counters on the page:
* **Answered** = *submitted*: the item has at least one attempt (Check or self-mark) after its last `clear` event. Wrong submissions count.
* Revealing an answer (quiz **Show answer**) or opening a solution is **not** a submission. The quiz score line shows those separately as "revealed without answering", and the quiz review summary appears once every question is answered or revealed.
* **Correct** counts are labelled by what they measure: "correct on the first try" (quiz: `firstTryCorrect === true`) and "correct on the latest check" (problems: `overall === true`, which an edit clears).
* A backend can compute "answered" the same way from `attempts[]` and `events[]`.

Attempt rules:
* `attemptId` is unique (`att-<crypto.randomUUID()>`, with a fallback when `randomUUID` is missing). `seq` is per item and strictly increasing (max existing seq + 1, also after a merge).
* Two presses milliseconds apart with identical answers make **two attempts** (tested with a real double-click).
* Attempts are never coalesced, capped, truncated or rewritten. Nothing is dropped silently.

## 4. Change records and events

Every mutation produces one change record. It is (a) dispatched on `window` as a DOM `CustomEvent("course-site:change", { detail: change })`, (b) passed to `store.on(fn)` listeners, and (c) queued in the outbox for `save()`.

```jsonc
// kind: "snapshot": latest state of one item (attempts/events omitted). Coalesced: only the newest per item is sent.
{ "changeId": "chg-…", "kind": "snapshot", "siteId": "cse312-26au-week2", "schemaVersion": 2, "itemId": "…", "at": "…", "record": { /* item minus attempts/events */ } }
// kind: "attempt": one submitted attempt. NEVER coalesced.
{ "changeId": "chg-…", "kind": "attempt", "siteId": "…", "schemaVersion": 2, "itemId": "…", "at": "…", "attempt": { /* attempt record */ } }
// kind: "event": one hint / solution / reveal / clear. NEVER coalesced.
{ "changeId": "chg-…", "kind": "event", "siteId": "…", "schemaVersion": 2, "itemId": "…", "at": "…", "event": { /* event record */ } }
```

`save(store, change)` receives one **batch** containing every outbox record not yet acknowledged, oldest first:

```json
{
  "kind": "batch",
  "batchId": "batch-92e45617-5093-4f04-bca0-271524d036af",
  "siteId": "cse312-26au-week2",
  "schemaVersion": 2,
  "baseRevision": 0,
  "changes": [
    {
      "changeId": "chg-68515ae8-15e7-438b-b6c2-f70b6723d4ad",
      "kind": "attempt",
      "siteId": "cse312-26au-week2",
      "schemaVersion": 2,
      "itemId": "cse312-w2-l5-p-zika",
      "at": "2026-10-05T20:48:58.747Z",
      "attempt": { "attemptId": "att-40adca1e-1a89-4ecf-81cd-bf3c6c076e1f", "seq": 1, "…": "as in §3" }
    }
  ]
}
```

An event-style backend can ignore `store` and append each `changes[i]`. If a batch is retried after a lost acknowledgement, records can be **resent**, so dedupe by `changeId` (or by `attemptId` / `eventId`). The site never resends a record after `save()` has resolved successfully for it.

## 5. Ids

* Format: `cse312-w2-<area>-<kind>-<slug>`, where area is `l3`, `l4`, `l5` or `rd` (readings) and kind is `p` (problem), `qc` (quick check) or `quiz`. Examples: `cse312-w2-l3-p-three-aces`, `cse312-w2-l4-qc-sum-six-prob`, `cse312-w2-l5-quiz-screening`, `cse312-w2-rd-2-2-llama-flu`.
* **Parts** extend their problem id with `.` and a semantic name: `cse312-w2-l3-p-five-card-hands.straights`, `cse312-w2-l5-p-zika.pzt`, `cse312-w2-rd-1-3-cards-guarantee.full-house`. A one-box problem uses `.ans`.
* Ids are semantic, never positional (the inventory check rejects `-1`, `.2`, `q3`, `cyu-04`-style ids). Reading numbers such as `1-3` and `2-2` are textbook section numbers, not positions on the page.
* Week 1 and week 2 ids never collide (`cse312-w1-…` vs `cse312-w2-…`), and the two weeks keep separate stores (`siteId`).
* **Section 2 has no items** because its handout wasn't posted when the site was built. When it is posted, new items should use area `s2` (e.g. `cse312-w2-s2-t1-…`); adding them won't change any existing id.
* **Rule: change the id whenever the question or its accepted answer changes.** Keep the id for wording, typo or layout fixes. MC option values follow the same rule.
* No content-version namespace is baked in. Dot assigns content-version namespaces and keeps old history.

## 6. State inventory

`export/state-inventory.json` is generated by `scripts/build-inventory.js` from the parsed DOM of `site/index.html` (site scripts blocked, so it sees the authored markup). It is not hand-maintained. It has 139 entries: 36 problems, 57 parts, 16 quick checks and 30 quiz questions. Each entry has `id`, `kind` (`problem|part|quickcheck|quiz`), `parentId`, `route`, `page`, `session` + `date` + `timing` (`"today"` for Lecture 3, `"upcoming"` for Lectures 4 and 5 as of Mon Oct 5; `null` for readings), `prompt.text` (plain) and `prompt.html` (original markup with TeX), `grader` (`exact-expression`, `formula`, `yes-no`, `self-check`, `multiple-choice` with `options[]`, or `multi-part`), `hintCount` (and hint text), `hasSolution`, misconception tags with their feedback text, and `record`, the stored shape including `attempts`/`events`.

It contains **no answer keys**: no correct values, no correct-option marker, no misconception trigger values, no `near` tolerances. `node scripts/build-inventory.js --check` checks for that, for unique and non-positional ids, that every `data-id`/`data-part-id` in the HTML is listed (counted independently by regex) and vice versa, and that `export/` is up to date.

## 7. Failure, recovery and conflict semantics

* **Local first.** Every mutation is written synchronously to a localStorage mirror (`cse312-26au-week2:mirror`: `{ store, outbox }`) before any network call. Typed text and attempts survive adapter failures, reloads and tab closes. If localStorage itself is blocked, state stays in memory and one transient notice says so.
* **Save failure.** The outbox is kept and retried with backoff. The **first** failure shows a transient toast ("Couldn't save to the server. Your work is kept in this browser and we'll keep retrying."), plus a short inline note next to the item the learner is working on. Later retries stay quiet. On the first success after a failure, a transient "Back online" toast appears. Toasts disappear after about 7 s and can be dismissed.
* **No persistent save status.** There is no saved/saving header, bar, timestamp or badge anywhere. A browser test checks this.
* **Reload while failing.** The outbox is reloaded from the mirror and delivered once the adapter works. Every attempt is delivered exactly once (tested).
* **Slow adapter.** Typing never waits on the adapter. Edits made while a save is in flight go out in the next batch.
* **Load failure.** The page keeps working from the mirror and shows one transient notice. The outbox stays queued.
* **Conflict.** `save()` returns `{ conflict: true, remote }`, or throws with `code: "conflict"`, or the mock/local adapter detects `baseRevision < server revision`. The site then:
  1. migrates `remote` (or calls `load()` if no `remote` was given),
  2. merges per item: **`attempts[]` and `events[]` are the union by `attemptId` / `eventId`**, sorted by time then `seq`, with no duplicates and nothing dropped. For the **snapshot fields**, the local copy wins if that item has unsent local snapshot changes (so local typing is never lost); otherwise the newer `updatedAt` wins. Items that exist on only one side are kept,
  3. sets `revision` to the max, re-renders, shows one transient notice ("This work was also saved from another tab or device. Both copies were merged and nothing you typed was lost."), and resends the outbox against the merged store.
  The merge is idempotent and order-independent for attempts (unit-tested).
* **Unknown schema.** A store with `schemaVersion > 2` or another `siteId` is never overwritten. From the server, the site stops sending remote saves for the session and shows a notice. From the local mirror, the raw value is copied aside to `cse312-26au-week2:mirror:unreadable:<ts>`. The page keeps working locally either way.
* **Clearing** never deletes history (see §3).

## 8. Versioning and migration

* Week 2 starts at `schemaVersion: 2`, the same shape as week 1, so a backend that stores week 1 stores week 2 unchanged; only `siteId` differs.
* Week 2 has no earlier version, so `LEGACY_ID_MAP` is empty and no legacy keys are read. The v1 migration code path is kept (and tested) so the store module is the same across weeks; v1-shaped input yields an empty v2 store with no fabricated items or attempts.
* A store for another site (e.g. week 1's `cse312-26au-week1`) is treated as unknown: never imported, never overwritten (tested).

## 9. JS API (for the host and tests)

`window.COURSE_SITE` (the live store): `snapshot()`, `pending()` (unsent change records), `flushNow()`, `on(fn)`, `onReload(fn)`, `get(id, kind)`, `adapterName`. The UI uses `update`, `addAttempt`, `addEvent` and `clear`; hosts shouldn't need them. `window.CourseStore` exports `createStore`, `migrate`, `mergeStores`, `SITE_ID`, `SCHEMA_VERSION` and the key names.

## 10. Testing with the mock adapter

`examples/mock-adapter.js` defines `MockAdapter.create({ latencyMs, failSaves, failLoads, persistKey })`. The instance has `.set({...})` to flip failure on and off, `.injectConflict(remoteStore)`, `.remote`, `.log` and `.delivered()` (every acknowledged change record, for exactly-once checks). It persists to sessionStorage so it survives reloads. You can load it with `?mock=1&latency=300&fail=1` if the script is included, but the tests inject it with Playwright's `addInitScript`, so `index.html` doesn't reference it.

```
cd tests && npm install          # playwright-core only; uses a cached Chromium or CHROMIUM_PATH
node tests/answers.test.js       # every key vs independent brute force / exact rationals and the slides; exact grader
node tests/store.test.js         # store contract: attempts, retries, conflicts, migration
node scripts/build-inventory.js --check
node tests/browser.test.js       # pages, interactions, persistence, failure/recovery, conflict, screenshots
```
