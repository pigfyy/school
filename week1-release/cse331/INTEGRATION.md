# Integration contract: CSE 331 week 1 site (siteId `cse331-26au-week1`, schemaVersion 2)

For Dot (backend + deploy). The site is static and needs no build, server, login or network access of its
own. It saves through one async adapter, which defaults to this browser's `localStorage`. Nothing here
deploys anything or touches authentication.

## 0. What to integrate

`export/` is the integration bundle (rebuild with `node tools/build-export.mjs`):

- `export/site/`: a verbatim copy of `site/` (HTML, CSS, all JS).
- `export/state-inventory.json`: every stateful item, generated from the live DOM. See §6.

Files that own state:

| File | Owns |
|---|---|
| `site/js/store.js` | The store, the adapter contract, migration (trial v1 → v2), the outbox (unsent changes), debounce/retry/backoff, conflict merge, attempt and event history, the local mirror. No DOM. Runs in Node too. |
| `site/js/app.js` | All UI. Reads item state with `store.get` / `attemptsOf`, writes with `store.put` (snapshot), `store.attempt` (one per Check/self-mark), `store.event` (hint, solution view, reveal, clear). Exposes `window.CourseSite`. |
| `site/js/grader.js` | Normalization and grading (pure). Produces `normalized` values and `feedbackKind` tags. |
| `site/js/keys.js` | Answer keys and misconception tags (kept out of the HTML and out of the inventory). |
| `site/js/sum-sim.js`, `site/js/spec-sim.js` | Simulators of the lecture Java, verified against real Java. They hold no persisted state. |
| `site/index.html` | Markup. Every stateful element carries its stable `data-id` (or `data-part`). |

## 1. Storage adapter

Define `window.COURSE_SITE_STORAGE` before `js/app.js` loads (index.html has a comment marking the spot):

```html
<script>
  window.COURSE_SITE_STORAGE = {
    name: "dot-backend",                       // optional; shown by CourseSite.storage()
    async load() { /* return the saved Store (any version), or null */ },
    async save(store, change) { /* persist; throw on failure */ },
    // optional: async saveBatch(store, changes) { ... }  one call for everything pending, in order
  };
</script>
<script src="js/app.js"></script>
```

- **load()** is called once at boot, and again with backoff if it fails. The page doesn't wait for it:
  it starts from this browser's mirror (§4) right away, so a slow or failing adapter never blocks typing.
  When load resolves, the remote store is merged in (§5). Until then nothing is sent, so a fresh device
  can't overwrite history it hasn't seen yet.
- **save(store, change)** gets the full current store (for upsert-style backends) and one change record
  (for event-style backends). Calls are serialized: never two at once, always in order. A resolved promise
  means "this change is durable". If `saveBatch` exists it is used instead with every pending change at once.
- **Failure:** throw or reject with anything. The change stays queued and is retried.
- **Conflict:** throw/reject `{ code: "conflict", remote?: Store }`, or resolve `{ conflict: true, remote?: Store }`.
  If `remote` is missing the site calls `load()` to get it. See §5.
- Authentication, user identity and which learner a store belongs to are the host's job.

`examples/mock-adapter.js` is a working adapter with configurable latency and failures
(`failNext(n)`, `failAlways()`, `failLoad(n)`, `conflictNext(remote | fn)`, `setLatency(ms)`), used by the tests.

## 2. Store (schemaVersion 2)

```jsonc
{
  "siteId": "cse331-26au-week1",
  "schemaVersion": 2,
  "updatedAt": "2026-10-02T21:14:09.120Z",
  "items": {                                   // latest snapshot per item (autosave; NOT history)
    "cse331-w1-l2-meets-matrix": {
      "kind": "problem",
      "parts": {
        "cse331-w1-l2-meets-matrix.first-or-minus-one": { "raw": "B D", "normalized": "BD", "correct": false },
        "cse331-w1-l2-meets-matrix.first-or-throw":     { "raw": "A, E", "normalized": "AE", "correct": true }
      },
      "work": "1 returns the first match…",       // free-form work box
      "result": "partial",                       // last Check: correct | partial | incorrect | null
      "selfMark": null,                          // got | missed | null (self-check parts)
      "checks": 1, "hintsRevealed": 1, "solutionViewed": false, "solutionOpen": false,
      "updatedAt": "2026-10-02T21:14:09.120Z"
    },
    "cse331-w1-l1-qc-spec-predicts-sum": {
      "kind": "quickcheck", "raw": "8", "normalized": "8", "correct": true, "tries": 2, "firstTryCorrect": false,
      "updatedAt": "…"
    },
    "cse331-w1-l2-quiz-stronger-means": {
      "kind": "quiz", "choiceId": "every-impl", "raw": "", "normalized": null, "correct": true, "tries": 2,
      "firstTryCorrect": false, "done": true, "revealed": false, "lastMessage": null, "updatedAt": "…"
    }
  },
  "attempts": {                                // append-only; one per Check press / self-mark
    "cse331-w1-l2-meets-matrix": [
      {
        "attemptId": "9b0c…",                    // crypto.randomUUID()
        "seq": 1,                                // per item, 1, 2, 3, … (max existing + 1)
        "itemId": "cse331-w1-l2-meets-matrix",
        "submittedAt": "2026-10-02T21:14:09.118Z",
        "kind": "check",                         // check | self-mark
        "answer": { "parts": { "cse331-w1-l2-meets-matrix.first-or-minus-one": { "raw": "B D", "normalized": "BD" } } },
        "result": { "parts": { "cse331-w1-l2-meets-matrix.first-or-minus-one": false }, "overall": "partial" },
        "feedbackKind": { "cse331-w1-l2-meets-matrix.first-or-minus-one": "forgot-weak-spec-a" },
        "hintsRevealedAtSubmit": 0,
        "solutionViewedBeforeSubmit": false
      }
    ],
    "cse331-w1-l2-quiz-stronger-means": [
      { "attemptId": "…", "seq": 1, "itemId": "cse331-w1-l2-quiz-stronger-means", "submittedAt": "…", "kind": "check",
        "answer": { "choiceId": "asks-more", "choiceIndex": 3, "raw": "asks-more", "normalized": "asks-more" },
        "result": { "overall": "incorrect", "correct": false }, "feedbackKind": "pre-direction",
        "hintsRevealedAtSubmit": 0, "solutionViewedBeforeSubmit": false }
    ]
  },
  "events": {                                  // append-only; non-submission actions
    "cse331-w1-l2-meets-matrix": [
      { "eventId": "…", "seq": 1, "itemId": "cse331-w1-l2-meets-matrix", "type": "hint", "at": "…", "level": 1, "of": 3 },
      { "eventId": "…", "seq": 2, "itemId": "cse331-w1-l2-meets-matrix", "type": "solution-view", "at": "…", "attemptedFirst": true }
    ]
  }
}
```

Attempt rules:

- Every Check press appends one attempt, including an unreadable answer (`result.overall: "unreadable"`)
  and a repeat of the same answer milliseconds later. Every self-mark ("I got it" / "I missed something")
  appends one attempt with `kind: "self-mark"` and `overall: "self-correct" | "self-incorrect"`.
- For problems, attempts are stored under the **problem** id, with per-part `answer.parts[partId]` and
  `result.parts[partId]` (`true | false | null`; `null` = unreadable or self-check). Quick checks and quiz
  questions store `answer: { raw, normalized }` (plus `choiceId`/`choiceIndex` for multiple choice).
- `feedbackKind` is `"correct"`, `"incorrect"`, `"unreadable"`, `"promise-kept"` / `"breaks-precondition"`
  (counterexample answers), `"self-reported"`, or a misconception tag (listed per item in the inventory as
  `feedbackKinds`). For problems it is an object keyed by part ID.
- `solutionViewedBeforeSubmit` for quiz items means the learner pressed "Show answer" first.
- Typing, the work box, and in-progress input are snapshots in `items`, never attempts.
- Events: `hint` (`level`, `of`), `solution-view` (`attemptedFirst`), `solution-hide`, `reveal` (quiz
  Show answer), `clear` (Clear my work / Clear all / Start over).
- Clearing resets `items[id]` only. Attempts and events are never deleted, capped or truncated.

## 2a. Drafts and grade invalidation

Every graded input is one of these, and all of them go through the same two helpers in `js/app.js`
(`draftWriter` → `CourseStore.invalidateCurrentGrade`, and `flushPendingInput`):

| Kind / answerType (as in the inventory) | Input | Covered |
|---|---|---|
| quiz / int | typed number | yes |
| quiz / choice | radio selection (MC) | yes |
| quickcheck / int, text, yesno | typed text | yes |
| part / int, text, yesno, letters, strength, set | typed text in a problem part | yes |
| part / witness | a typed call or value, graded by running the lecture code | yes |
| part / self | written answer, marked "I got it" / "I missed something" | yes |
| problem work box | free text, never graded | snapshot only |

Not graded and not saved: the hero runner, counterexample hunt, Sum stepper, spec clause explorer,
outside/inside map, edge toggle, ways-of-knowing sorter, motto, two-programs runner, `middle` caller,
abstraction barrier, `indexOf` call lab, strength grid, `count` stepper, brute-force and "Run it" buttons.

Rules (design decisions from the integration review):

- **Drafts are saved.** Typed text and MC selections are written as snapshot drafts (debounced 300 ms),
  without grading, and restored on reload with no grade shown.
- **An edit clears the current grade.** Changing an input or selection after it was graded keeps the draft
  (`raw` / `choiceId`) and clears, in the snapshot and the DOM at once:
  - quiz and quick check: `correct`, `normalized`, `lastMessage`; quiz `done` drops back to `revealed`;
  - problem part: that part's `normalized` and `correct`, plus the problem's `result` (auto-graded part)
    or `selfMark` (self-check part), the status badge, feedback text and classes, and got/missed `aria-pressed`.
  The cleared snapshot goes through the adapter as a normal `snapshot` change.
- **History is not current state.** `tries`, `firstTryCorrect`, `checks`, `attempts[]` and `events[]` are
  never edited by an edit. Re-entering the previously graded value doesn't bring the grade back; only a new
  Check (or self-mark) grades again, as a new attempt.
- **No repaint reads a stale snapshot.** `flushPendingInput(id?)` writes pending drafts synchronously before
  every repaint from the store (Check, Show answer, hint, solution, self-mark, clear, start over, conflict
  merge via the store's `beforeMerge` hook, import) and on route change, `pagehide` and `visibilitychange`.
  The debounce itself is unchanged. A reveal or hint logs an event; it never creates an attempt.
- **Answered = submitted.** "Answered" counts items with at least one attempt (any Check or self-mark,
  right or wrong). Show answer / Show solution alone doesn't count as answered (it's an event). The
  correct-only counts are labelled separately: "correct on the first try" (quiz) and "correct now" (problems).

No stored field was added or renamed, so `schemaVersion` stays 2.

## 3. Change records and events

Every write produces one change record, passed to `save(store, change)` and also dispatched as a DOM event
`course-site:change` (`event.detail` = the record):

```jsonc
{ "changeId": "…", "siteId": "cse331-26au-week1", "schemaVersion": 2, "at": "…",
  "kind": "snapshot", "itemId": "cse331-w1-l2-meets-matrix", "state": { /* items[itemId] */ } }
{ …, "kind": "attempt", "itemId": "…", "attempt": { /* one Attempt */ } }
{ …, "kind": "event",   "itemId": "…", "event":   { /* one Event */ } }
{ …, "kind": "reset",   "itemId": null, "ids": ["…"], "reason": "clear-item" | "clear-page" | "quiz-start-over" | "import" }
```

- **attempt** and **event** records are never merged or dropped. An event-style backend can append each one,
  and should de-duplicate by `attemptId` / `eventId` (a retry after a timeout may resend a record the
  server already stored, so delivery is at-least-once; ids make it exactly-once).
- **snapshot** records are coalesced: if a newer snapshot of the same item is queued before the older one
  was sent, only the newer one is sent. Upsert by `itemId`.
- Records are sent in the order they were made.

## 4. Failure semantics

- Every change is written synchronously to a local mirror
  (`localStorage["cse331-26au-week1:v2:mirror"]` = `{ store, outbox }`) before anything is sent, so a
  reload, a crash or a closed tab never loses typed text or unsent attempts. On the next load the outbox is
  resent.
- Typing is debounced (300 ms) into snapshots; Check presses flush pending typing first. `pagehide` and
  `visibilitychange` flush too.
- On failure: retry with exponential backoff (1 s, 2 s, 4 s … capped at 30 s, ±25% jitter), forever.
  The learner sees one transient toast per outage ("Couldn't save just now…") and one on recovery
  ("Saving works again…"). Toasts disappear after 6 s. There is **no** persistent saved/saving status.
- If `load()` fails, the page keeps working from the mirror, shows one transient toast, and retries.
- If localStorage itself is blocked, one transient toast asks the learner to keep the tab open.
- If the remote store has an unknown `schemaVersion` (a newer site) or another `siteId`, it is ignored, the
  page keeps working locally, and **nothing is sent** (so newer data is never overwritten). One toast says so.

## 5. Conflict policy

On a conflict the site merges the remote store into its own and then resends what's still pending:

- `attempts` and `events`: union by `attemptId` / `eventId`, sorted by time then `seq`. Nothing is lost or
  duplicated; merging a store with itself is a no-op.
- `items` (snapshots): an item with unsent local changes keeps the local copy (so text the learner just typed
  always survives). Otherwise the copy with the later `updatedAt` wins; ties keep the local copy.
  Items only the remote has are added.
- The page redraws any item whose snapshot changed and shows one transient toast ("…Merged both copies…").
- More than 5 conflicts in a row is treated as a failure (backoff, then retry).

After a merge `seq` values from two devices may repeat for one item; `attemptId` is the identity, and
`(submittedAt, seq)` is the order.

## 6. IDs and the state inventory

IDs are stable and semantic, with no content-version namespace (the host adds one):

| Kind | Pattern | Example |
|---|---|---|
| problem | `cse331-w1-<l1\|l2>-<slug>` | `cse331-w1-l2-meets-matrix` |
| part (answer box) | `<problemId>.<part-slug>` | `cse331-w1-l2-meets-matrix.first-or-throw` |
| quick check | `cse331-w1-<l>-qc-<slug>` | `cse331-w1-l1-qc-spec-predicts-sum` |
| quiz question | `cse331-w1-<l>-quiz-<slug>` | `cse331-w1-l2-quiz-abs-min-value` |
| quiz option | `data-option` inside the question | `every-impl` |

No ID encodes a position. If a question or its answer changes meaning, mint a new ID. `tests/browser.mjs`
checks that every stateful DOM element is in the inventory, every inventory entry is in the DOM, IDs are
unique, and none are positional.

`export/state-inventory.json` (103 entries: 17 problems, 53 parts, 12 quick checks, 21 quiz questions) has,
per item: `id`, `kind`, `parentId`, `route`, `page`, `source` (lecture and date), `prompt` (plain text, plus
the original HTML and any code), `answerType`, `grader`, `options` (multiple choice), `feedbackKinds`,
`partIds`, `recordShape` (snapshot, attempts, events), `hintCount`, `hasSolution`. It contains no answer keys,
and option entries carry no per-option metadata that would identify the right one.

## 7. Migration and the old trial IDs

The trial (`cse331-skill-trial/`) stored `{ site, version: 1, problems, quiz, checks }` under
`localStorage["cse331-26au-week1-v1"]`. This site reads that key once if it has no mirror, and a v1 store
returned by `load()` is migrated the same way. Migrated items keep their latest state (`migratedFrom`
records the old id); v1 had no history, so **no attempts or events are created**. v1 multiple-choice answers
were option positions; they are mapped to option IDs. v1 problems stored one result for the whole item;
per-part `correct` comes from v1's `partResults`.

| Trial ID | New ID | Semantics |
|---|---|---|
| `l1-e1-predict` | `cse331-w1-l1-predict-two-runs` (parts `two-lines-got`, `two-lines-sum`, `decimal-got`, `decimal-sum`) | same |
| `l1-e1-repair` | `cse331-w1-l1-repair-sentence` (`sentence`) | same |
| `l1-e2` | `cse331-w1-l1-which-are-specs` (`specs`, `sum-meets`) | same |
| `l1-e3` | `cse331-w1-l1-saying-more-less` (`spec-vs-b`, `two-assertions`) | same |
| `l1-e4` | `cse331-w1-l1-sum-starts-at-one` (`point1-list`, `point2-sum`, `point2-list`, `meets-spec`) | same |
| `l1-e5` | `cse331-w1-l1-rule-println-and-init` (`after-println`, `after-sum-init`) | same |
| `l1-e6` | `cse331-w1-l1-long-version` (`overflow-sum`, `too-big-got`, `long-spec`) | same |
| `l1-e7` | `cse331-w1-l1-specs-worth-meeting` (`meets-e`, `meets-f`, `course-accepts`) | same |
| `cyu-runs-count` | `cse331-w1-l1-quiz-how-many-runs` | same |
| `cyu-runs-1000` | `cse331-w1-l1-quiz-thousand-runs` | same |
| `cyu-spec-sum` | `cse331-w1-l1-quiz-sum-after-word` | same |
| `cyu-spec-which` | `cse331-w1-l1-quiz-which-is-spec` | same |
| `cyu-spec-wrap` | `cse331-w1-l1-quiz-sum-wraps-down` | same |
| `cyu-assert-which` | `cse331-w1-l1-quiz-which-is-assertion` | same |
| `cyu-assert-holds` | `cse331-w1-l1-quiz-nonempty-holds` | same |
| `cyu-reason-rule` | `cse331-w1-l1-quiz-rule-needs` | same |
| `cyu-edge` | `cse331-w1-l1-quiz-edge-standard` | same |
| `cyu-know` | `cse331-w1-l1-quiz-testing-can` | same (wrong-option explanations reworded so they no longer state the answer) |
| `runs-check0` (positional) | `cse331-w1-l1-qc-count-counterexamples` | same |
| `spec-check1` (positional) | `cse331-w1-l1-qc-spec-predicts-sum` | same |
| `assert-check2` (positional) | `cse331-w1-l1-qc-list-size-at-point1` | same |
| `reason-check3` (positional) | `cse331-w1-l1-qc-list-survives-loop` | same |
| `edge-check4` (positional) | `cse331-w1-l1-qc-hasnext-exception` | same |
| `know-check5` (positional) | `cse331-w1-l1-qc-which-way-confirms` | same |
| (none) | every `cse331-w1-l2-*` id | new (Lecture 2 wasn't in the trial) |

The trial's IDs were short and unprefixed (and the quick-check ones positional), so none were reused verbatim, even where the meaning matches. The store maps all of them on migration.

## 8. Host API

`window.CourseSite` (after `js/app.js` runs):

| Member | Use |
|---|---|
| `siteId`, `schemaVersion` | identifiers |
| `storage()` | adapter name (`"localStorage"` by default) |
| `ready` | promise: the remote store has been loaded and merged |
| `exportState()` | deep copy of the store |
| `importState(store)` | replaces the store (any version; v1 is migrated), redraws, sends a `reset`/`import` change |
| `flush()` | flush debounced typing and try to send everything now; resolves `true` when nothing is pending |
| `pending()` | `[{ changeId, kind, itemId }]` not yet acknowledged by the adapter |
| `stats()` | `{ saves, failures, conflicts, delivered, pending, loaded, blocked }` |
| `attemptsOf(id)`, `eventsOf(id)` | history for one item |

`document.documentElement.dataset.ready === "true"` once the UI is built.

## 9. Not included, on purpose

- No backend, accounts, sync service, deployment config or authentication.
- Answer keys ship in `js/keys.js`, readable by anyone who opens the source. Fine for practice; don't use
  this site for anything graded. Moving grading server-side would mean serving keys only to the grader.
