---
name: course-teaching-site
description: Add or update a course week on the shared study site (site/<course>/<week>/) from that week's raw course materials (lecture notes, slides, section handouts, readings). Use when given a course-materials zip or folder, or asked to add, change or fix a week's pages.
---

# Course week pages

The repo's `CLAUDE.md` has the layout, the commands and the deploy step. This skill covers what a week's pages
contain and how they look. All the machinery (routing, rail, course/week switcher, quick checks, quiz, problems,
hints, solutions, grading, saving) is already in `site/core/`. A week is content plus its own widgets.

## 1. Read first, scope exactly

- Run `tools/ingest.sh` and read everything in `materials/<course>/<week>/text/`: lecture notes, slides, section
  handouts, readings, calendar. Note each lecture's big ideas, the course's notation, and every exercise with its
  official answer.
- **Scope is exactly what was provided.** Don't invent coverage. A session with no posted materials is listed as
  upcoming with "materials not posted yet". Say what was missing in your final report.
- Graded work (problem sets, concept checks) is never reproduced. Practice only.

## 2. What a week has

Start from the same course's latest week (`site/<course>/<previous week>/index.html`): copy it, keep the shell
(rail, `.page` sections, pager, toasts, script tags), replace the content. Typical pages:

- **Week overview** (`#home`): what's covered, a hero widget, the week cards, due dates.
- **Lecture modules**, one page per big idea in the lecture's order, each ending with a quick check.
- **Check your understanding**: 8–12 questions per lecture, marked once as written for the site.
- **Problems**: the section handout's or lecture's exercises, answerable on the page.
- **Readings** (when assigned) and a **cheat sheet**.

The problems and quiz are required for every lecture and section, including sessions added later to a week that
already exists. A page with modules and quick checks only is not finished.

The markup the engine understands is listed at the top of `site/core/app.js`; answer types are listed at the top
of `site/core/grader.js`. Answer keys go either in the markup (`data-type`, `data-answer`, `data-miscon`) or in a
`keys.js` that sets `window.WEEK.keys`. Self-check parts are one-line boxes; add `data-long` for a written answer. Feedback text for misconception tags goes in `window.WEEK.messages`.

## 3. Look

- Use `core/base.css` as-is: CSE 332 week 2's original purple design (see `house-style/README.md` and
  `house-style/reference/*.png`). A week's own widget styles go in `week.css`, using only base tokens: `--accent`,
  `--s1`/`--s2`/`--s3` for chart series, `--amber`, `--today`, `--right`/`--wrong`, ink, paper, surface, line, night,
  and the fonts `--display` (Fraunces), `--font` (Public Sans), `--mono` (JetBrains Mono).
- **Dates are honest.** Write `<span class="today-chip" data-date="YYYY-MM-DD">Mon Oct 5</span>`; the engine adds
  "Today" on that day only. Upcoming sessions are dashed `.later` items.
- **Widgets are not templated.** Shape each module around its idea: a terminal for a command-line program, a tree
  for a counting argument, a chart for growth rates. Build them around the course's own examples, and only when they
  teach something.
- Save feedback is transient toasts only, for failures. No "Saved" status.

## 4. Content

- Stay faithful to the course: its notation, wording and examples. Use its official answers, lightly condensed.
- Plain voice: short sentences, no filler.
- **Teaching notes** go under each module and problem in `<details class="notes" open>`.
- Problems: prompt, answer boxes, work box (automatic), 1–3 hints (the first names the approach, none gives the
  answer), a step-by-step `.solution` ending in `li.answer`. Pick the answer type that fits: exact numbers by value,
  formulas at several points, exact text for program output, yes/no, self-check for proofs and explanations.
  Wrong-answer feedback never reveals the answer.
- No per-problem source lines; say where problems come from once, in the page intro.

## 5. Verify, once, at the end

- Every computed answer against ground truth in `checks/<course>/<week>/verify.mjs`: run the lecture's code,
  brute-force small counting spaces. Don't trust mental arithmetic. Time-box this: check the answer keys, not
  the edge cases of the runtime.
- `node tests/check.mjs <course>/<week>`, then look at the new pages once at desktop and phone size.
- Then commit and hand the deploy to Codex as `CLAUDE.md` says.

## Working efficiently

- One agent per course is enough; don't add a coordinator or review rounds for a routine week.
- Settle requirements before you start. If someone sends findings mid-build, batch them.
- Don't rebuild shared machinery. If every week needs something new, add it to `core/` once.
