# school: one study site for every course week

Dot (the user's ChatGPT agent) sends course materials and asks for weeks to be added or changed. You build the
pages here, check them, commit, and hand deployment to a Codex subagent. Dot never touches this code or the deploy.
Saved answers go to the site's database on purpose: Dot reads them to make review material. Don't hide or encrypt them.

## Layout

```
site/                       the website, served as-is (no build step; also works from file://)
  index.html                landing page, built from courses.js
  courses.js                courses and weeks; the rail's course/week switcher and the landing page read it
  core/                     shared by every week; don't copy any of it into a week
    app.js                  engine: routing, rail, switcher, quick checks, quiz, problems, hints, solutions, saving
    grader.js               every answer type (exact math, Big-O, output, yes/no, …); see the header for types
    store.js                saved answers: localStorage + PUT/GET /api/state/<course>/<week>
    base.css fonts/ katex/  house style (CSE 332 week 2 purple), Fraunces/Public Sans/JetBrains Mono, KaTeX
  <course>/<week>/          one folder per week, e.g. cse332/w03/
    index.html              the content
    week.css                this week's widget styles (base.css tokens only)
    week.js                 this week's widgets: window.WEEK.widgets = function (api) { … }
    keys.js / sim.js / …    optional: answer keys kept out of the markup, simulators
materials/<course>/<week>/  raw course files + text/ (made by tools/ingest.sh)
checks/<course>/<week>/     verify.mjs: answers checked against real code (javac, brute force)
tools/serve.mjs             the site on this machine, saving included (`bun dev`)
tests/check.mjs             one browser check for the whole site
deploy/                     Worker + deploy steps. Codex runs these; read deploy/README.md
```

## Adding or updating a week

One Claude thread does the whole build (it may use one subagent per course). Don't put a coordinator agent in front of
it. Adding to a week that already exists is the same job: add the new sessions to its `index.html` in place.

1. `tools/ingest.sh <zip or folder> <course> <week>` puts the files in `materials/<course>/<week>/` and text copies in
   `text/`. If the materials are on the course website instead of in a zip, download them into a folder first and
   run the script on it; record each URL in `materials/<course>/<week>/sources.json`. Read `text/`. Open a PDF or
   slide image only when its text is garbled.
2. Use the `course-teaching-site` skill for what the pages contain and how they look. Start from the course's
   previous week: copy its `index.html` as the shape and replace the content.
3. Add the week to `site/courses.js` (`posted: true`).
   Every lecture and section gets the full set from the skill, not a summary: modules with quick checks, and one
   practice page of answerable problems with hints and solutions. A quicker or narrower pass may trim widgets, never
   the practice page.
4. Check:
   - Every computed answer against ground truth in `checks/<course>/<week>/verify.mjs` (run the lecture's code,
     brute-force counts). Run it: `bun checks/<course>/<week>/verify.mjs`.
   - `bun check <course>/<week>` (run `bun install` once). It loads every page at desktop and
     phone size, answers every item with its key and with a wrong answer, and checks saving.
   - Look at the new pages once at the end (desktop 1280×800, phone 390×844).
5. Commit, then deploy (below).

Keep it simple. New behavior that every week needs goes in `core/` once. A week only adds content and its own
widgets. Don't add per-week stores, graders, test harnesses, export bundles or integration docs.

## Running it locally

`bun dev` serves `site/` at http://localhost:8400/ straight from disk, so an edit shows on the next reload with no
deploy. Saving works the same as live: it runs `deploy/worker.mjs` with a local SQLite file
(`.scratch/local.sqlite`) as the database. Those answers stay on this machine; Dot only sees the live Site's.

## Deploying

Send a Codex subagent (gpt-6.1-sol, low) with this task:

> Deploy the latest `site/` of /home/pigfy/.t3/projects/school to its ChatGPT Site by following steps 1-7 of
> /home/pigfy/.t3/projects/school/deploy/README.md exactly. Reuse the existing project; never create a Site. Do no
> live checks. Report the deployment id and its final status.

A deploy should take about a minute (the build, push and deploy call take about 50 s). `bun check` before the deploy
is what checks the pages. Only after changing `deploy/worker.mjs` or `site/core/store.js`, add "Then run Live
verification from the README" to the task.

Live site (owner-only): https://cse-study.familyopenai10916.chatgpt.site
