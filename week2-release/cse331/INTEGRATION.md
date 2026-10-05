# Integration contract: CSE 331 week 2 site (siteId `cse331-26au-week2`, schemaVersion 1)

For Dot (backend + deploy). Same design as the week 1 site (`week1-release/cse331/INTEGRATION.md`), so one
backend can serve both: same adapter interface, same store shape, same change records. Differences are listed in
§9. The site is static and needs no build, server, login or network of its own. It saves through one async
adapter, which defaults to this browser's `localStorage`. Nothing here deploys anything or touches authentication.

Where the requirements come from: the user asked for stable semantic ids on every stateful part, a versioned
schema, an async adapter hook (`window.COURSE_SITE_STORAGE`), append-only `attempts[]` per gradable item,
edit-after-check invalidation, exact grading, good save-failure handling, a generated inventory without answer
keys, a mock adapter and this document, and no persistent save-status display. The field-level details (attempt
fields, merge rules, events) follow the week 1 contract, which came from Dot and the integration reviewer.

## 0. What to integrate

`export/` is the bundle (rebuild with `node tools/build-export.mjs`):

- `export/site/`: a verbatim copy of `site/` (HTML, CSS, fonts, all JS).
- `export/state-inventory.json`: every stateful item, generated from the live DOM (§6).

| File | Owns |
|---|---|
| `site/js/store.js` | The store, adapter contract, schema checks, outbox (unsent changes), debounce/retry/backoff, conflict merge, attempt and event history, the local mirror. No DOM. Runs in Node. |
| `site/js/app.js` | All UI. Reads with `store.get` / `attemptsOf`; writes with `store.put` (snapshot), `store.attempt` (one per Check, sorter choice or self-mark), `store.event` (hint, solution view/hide, reveal, clear). Exposes `window.CourseSite`. |
| `site/js/grader.js` | Normalization and grading (pure). Produces `normalized` values and `feedbackKind` tags. |
| `site/js/keys.js` | Answer keys and misconception tags. Not in the HTML, not in the inventory. |
| `site/js/sum-sim.js` | Simulator of the lecture's `Sum.java` and a small bash. No persisted state. |
| `site/index.html` | Markup. Every stateful element carries its `data-id` (problems' parts: `data-part`, written to `data-item-id` at runtime). |

## 1. Storage adapter

Define `window.COURSE_SITE_STORAGE` before `js/app.js` loads (index.html marks the spot):

```html
<script>
  window.COURSE_SITE_STORAGE = {
    name: "dot-backend",                       // optional; shown by CourseSite.storage()
    async load() { /* return the saved Store, or null */ },
    async save(store, change) { /* persist; throw on failure */ },
    // optional: async saveBatch(store, changes) { ... }   all pending changes at once, in order
  };
</script>
<script src="js/app.js"></script>
```

- **load()** runs at boot and again with backoff if it fails. The page doesn't wait: it starts from this
  browser's mirror (§4) at once. When load resolves the remote store is merged in (§5). Nothing is sent before
  that, so a fresh device can't overwrite history it hasn't seen.
- **save(store, change)** gets the full store (upsert-style backends) and one change record (event-style
  backends). Calls are serialized, in order. Resolving means "durable". With `saveBatch`, every pending change
  goes in one call.
- **Failure:** throw or reject. The change stays queued and is retried.
- **Conflict:** throw/reject `{ code: "conflict", remote?: Store }`, or resolve `{ conflict: true, remote?: Store }`.
  Without `remote` the site calls `load()`. See §5.
- Identity, authentication and which learner owns a store are the host's job.

`examples/mock-adapter.js` is a working adapter with latency and failure injection (`failNext(n)`,
`failAlways(on)`, `failLoad(n)`, `conflictNext(remote | fn)`, `setLatency(ms)`, `server()`, `changes()`). Try it
with `node tests/serve.mjs` and <http://localhost:9331/?mock=1>, then `COURSE_SITE_STORAGE.control.failNext(3)`.

## 2. Store (schemaVersion 1)

```jsonc
{
  "siteId": "cse331-26au-week2",
  "schemaVersion": 1,
  "updatedAt": "2026-10-05T20:14:09.120Z",
  "items": {                                     // latest snapshot per item (autosave; not history)
    "cse331-w2-l3-predict-redirect": {
      "kind": "problem",
      "parts": {
        "cse331-w2-l3-predict-redirect.bad-file":   { "raw": "Sum: not an integer: x", "normalized": "Sum: not an integer: x", "correct": false },
        "cse331-w2-l3-predict-redirect.bad-status": { "raw": "1", "normalized": "1", "correct": true }
      },
      "work": "> only moves stdout",
      "result": "partial",                         // last Check: correct | partial | incorrect | null
      "selfMark": null,                            // got | missed | null (self-check parts)
      "checks": 1, "hintsRevealed": 1, "solutionViewed": false, "solutionOpen": false,
      "updatedAt": "…"
    },
    "cse331-w2-l3-qc-status-after-bad": { "kind": "quickcheck", "raw": "1", "normalized": "1", "correct": true, "tries": 2, "firstTryCorrect": false, "updatedAt": "…" },
    "cse331-w2-l3-sort-too-big-integer": { "kind": "quickcheck", "raw": "contradicted", "normalized": "contradicted", "correct": true, "tries": 2, "firstTryCorrect": false, "updatedAt": "…" },
    "cse331-w2-l3-quiz-redirect-bad": { "kind": "quiz", "choiceId": "message-shows-file-empty", "raw": "", "normalized": null, "correct": true, "tries": 2,
      "firstTryCorrect": false, "done": true, "revealed": false, "lastMessage": null, "updatedAt": "…" }
  },
  "attempts": {                                  // append-only; one per Check press / sorter choice / self-mark
    "cse331-w2-l3-predict-redirect": [{
      "attemptId": "9b0c…", "seq": 1, "itemId": "cse331-w2-l3-predict-redirect", "submittedAt": "…",
      "kind": "check",                             // check | self-mark
      "answer": { "parts": { "cse331-w2-l3-predict-redirect.bad-file": { "raw": "Sum: not an integer: x", "normalized": "Sum: not an integer: x" } } },
      "result": { "parts": { "cse331-w2-l3-predict-redirect.bad-file": false }, "overall": "partial" },
      "feedbackKind": { "cse331-w2-l3-predict-redirect.bad-file": "redirect-takes-both" },
      "hintsRevealedAtSubmit": 0, "solutionViewedBeforeSubmit": false
    }],
    "cse331-w2-l3-sort-too-big-integer": [{
      "attemptId": "…", "seq": 1, "itemId": "cse331-w2-l3-sort-too-big-integer", "submittedAt": "…", "kind": "check",
      "answer": { "raw": "silent", "normalized": "silent", "choiceId": "silent" },
      "result": { "overall": "incorrect", "correct": false }, "feedbackKind": "chose-silent",
      "hintsRevealedAtSubmit": 0, "solutionViewedBeforeSubmit": false
    }]
  },
  "events": {                                    // append-only; non-submission actions
    "cse331-w2-l3-predict-redirect": [{ "eventId": "…", "seq": 1, "itemId": "…", "type": "hint", "at": "…", "level": 1, "of": 2 }]
  }
}
```

Attempt rules:

- Every Check press appends one attempt, including an unreadable answer (`result.overall: "unreadable"`) and
  an identical repeat. Every sorter choice appends one. Every self-mark appends one with `kind: "self-mark"` and
  `overall: "self-correct" | "self-incorrect"`. Attempts are never coalesced, edited, capped or deleted.
- Problems store attempts under the **problem** id, with per-part `answer.parts[partId]` and `result.parts[partId]`
  (`true | false | null`; `null` = unreadable or self-check).
- `feedbackKind`: `"correct"`, `"incorrect"`, `"unreadable"`, `"output-near-miss"` (right text, wrong case or
  spacing), `"self-reported"`, `"chose-<option>"` (sorter), or a misconception tag (listed per item in the
  inventory as `feedbackKinds` for quiz items, and in `keys.js` for the rest). Problems: an object keyed by part ID.
- Events: `hint` (`level`, `of`), `solution-view` (`attemptedFirst`), `solution-hide`, `reveal` (quiz Show
  answer), `clear` (Clear my work / Clear all / Start over). Clearing resets `items[id]` only.

## 2a. Drafts and edit-after-check invalidation

| Kind / answerType (inventory) | Input | Covered |
|---|---|---|
| quiz / int, choice | typed number; radio (MC) | yes |
| quickcheck / int, text, output, stream, strength, yesno | typed text | yes |
| quickcheck / choice (`format: "sort"`) | one click = one graded attempt; no draft | n/a (no edit step) |
| part / int, output, text, stream, strength, yesno, letters | typed text | yes |
| part / choice | `<select>` | yes |
| part / self | written answer, self-marked | yes |
| problem work box | free text, never graded | snapshot only |

Not graded and not saved: the runner, terminals, interactive shell, argument walker, program map, Lecture 1
comparison, promises grid, edge lab, discussion timer and "Run it" buttons.

- **Drafts are saved** (debounced 300 ms) without grading, and restored on reload with no grade shown.
- **An edit clears the current grade** at once, in the snapshot and the DOM (`CourseStore.invalidateCurrentGrade`):
  quiz/quick check `correct`, `normalized`, `lastMessage` (quiz `done` drops back to `revealed`); a problem part's
  `normalized` and `correct`, plus the problem's `result` (auto part) or `selfMark` (self part).
- **History is not current state.** `tries`, `firstTryCorrect`, `checks`, attempts and events are never touched
  by an edit. Re-entering the graded value doesn't restore the grade; only a new Check does.
- **No repaint reads a stale snapshot.** `flushPendingInput()` writes pending drafts synchronously before every
  repaint from the store, on route change, `pagehide` and `visibilitychange`, and before a conflict merge.
- **Answered = submitted** (at least one attempt). Show answer / Show solution alone is an event, not an answer.

## 3. Change records

Every write produces one record, passed to `save(store, change)` and dispatched as the DOM event
`course-site:change` (`event.detail`):

```jsonc
{ "changeId": "…", "siteId": "cse331-26au-week2", "schemaVersion": 1, "at": "…", "kind": "snapshot", "itemId": "…", "state": { } }
{ …, "kind": "attempt", "itemId": "…", "attempt": { } }
{ …, "kind": "event",   "itemId": "…", "event": { } }
{ …, "kind": "reset",   "itemId": null, "ids": ["…"], "reason": "clear-item" | "clear-page" | "quiz-start-over" | "import" }
```

Attempt and event records are never merged or dropped; de-duplicate by `attemptId` / `eventId` (delivery is
at-least-once). Snapshot records coalesce: only the newest unsent snapshot of an item is sent. Order is preserved.

## 4. Failure semantics

- Every change is written synchronously to a local mirror (`localStorage["cse331-26au-week2:v1:mirror"]` =
  `{ store, outbox }`) before anything is sent. A reload, crash or closed tab loses nothing; the outbox is resent.
- Failed saves retry with exponential backoff (1 s, 2 s, 4 s … capped at 30 s, ±25% jitter), forever.
- The learner sees **one transient toast per outage** ("Couldn't save just now…") and one on recovery
  ("Saving works again…"), each gone after 6 s. Load failures and a blocked localStorage get one toast each.
  **There is no persistent saved/saving status anywhere**, and `tests/browser.mjs` asserts that no such text
  exists on any page, before and after saving and recovery.
- A remote store with another `siteId` (week 1's, for example) or an unknown `schemaVersion` is ignored: the page
  keeps working locally and **sends nothing**, so it never overwrites that data. One toast says so.

## 5. Conflict policy

- `attempts` and `events`: union by id, sorted by time then `seq`. Merging a store with itself is a no-op.
- `items`: an item with unsent local changes keeps the local copy. Otherwise the later `updatedAt` wins (ties
  keep local). Remote-only items are added. Redrawn items get one transient toast. More than 5 conflicts in a row
  counts as a failure (backoff, retry).

## 6. IDs and the state inventory

| Kind | Pattern | Example |
|---|---|---|
| problem | `cse331-w2-l3-<slug>` | `cse331-w2-l3-predict-redirect` |
| part | `<problemId>.<part-slug>` | `cse331-w2-l3-predict-redirect.bad-status` |
| quick check | `cse331-w2-l3-qc-<slug>` | `cse331-w2-l3-qc-status-after-bad` |
| sorter card (graded quick check, `format: "sort"`) | `cse331-w2-l3-sort-<slug>` | `cse331-w2-l3-sort-exit-status` |
| quiz question | `cse331-w2-l3-quiz-<slug>` | `cse331-w2-l3-quiz-redirect-bad` |
| quiz / choice option | `data-option` (descriptive, not positional, not "correct") | `message-shows-file-empty` |

IDs are semantic and carry no position or content version. If a question's meaning changes, mint a new ID.
The `w2` prefix keeps them distinct from week 1's (`cse331-w1-…`), so both sites can share one backend.

`export/state-inventory.json`: 71 entries (9 problems, 35 parts, 16 quick checks including 8 sorter cards,
11 quiz questions). Per item: `id`, `kind`, `parentId`, `route`, `page`, `source` (Lecture 3, 2026-10-05, notes
URL), `prompt` (text, HTML), `answerType`, `grader`, `format` (sorter cards), `options` (choice items: index, id,
text only), `feedbackKinds` (quiz), `partIds`, `recordShape`, `hintCount`, `hasSolution`, `solutionSteps`. No
answer keys: `keys.js` is stubbed while building, and the build fails if any key value appears in the output
(except three, listed in the build script, whose text the page itself shows in the prompt).
`tests/browser.mjs` checks that the inventory and the DOM match exactly and that IDs are unique and non-positional.

## 7. Host API

`window.CourseSite`: `siteId`, `schemaVersion`, `storage()`, `ready` (remote loaded and merged), `exportState()`,
`importState(store)` (refuses another site's or an unknown version's data, returning its status), `flush()`,
`pending()`, `stats()`, `attemptsOf(id)`, `eventsOf(id)`. `document.documentElement.dataset.ready === "true"`
once the UI is built.

## 8. Not included, on purpose

No backend, accounts, sync service, deployment config or authentication. Answer keys ship in `js/keys.js`,
readable in the source; serving keys only to a server-side grader would be the change if that matters.

## 9. Differences from week 1

- `siteId` `cse331-26au-week2`, `schemaVersion` 1 (a new site, so its own version line). No migration code: there
  is no earlier version of this site. Week 1's store is refused as `other-site`, never merged.
- New answer types: `output` (exact program output), `stream` (stdout/stderr), and `choice` for problem parts
  (a `<select>`) and sorter cards. No `witness` or `set` types this week.
- Sorter cards are quick checks whose attempt `answer` also has `choiceId`; each click is one attempt.
- Fonts are vendored (`site/fonts/`), so the site makes no network requests at all.
