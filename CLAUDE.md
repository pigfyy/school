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
tests/check.mjs             one browser check for the whole site
deploy/                     Worker + deploy steps. Codex runs these; read deploy/README.md
```

## Adding or updating a week

1. `tools/ingest.sh <zip> <course> <week>` puts the files in `materials/<course>/<week>/` and text copies in `text/`.
   Read `text/`. Open a PDF or slide image only when its text is garbled.
2. Use the `course-teaching-site` skill for what the pages contain and how they look. Start from the course's
   previous week: copy its `index.html` as the shape and replace the content.
3. Add the week to `site/courses.js` (`posted: true`).
4. Check:
   - Every computed answer against ground truth in `checks/<course>/<week>/verify.mjs` (run the lecture's code,
     brute-force counts). Run it: `node checks/<course>/<week>/verify.mjs`.
   - `node tests/check.mjs <course>/<week>` (run `npm install` in `tests/` once). It loads every page at desktop and
     phone size, answers every item with its key and with a wrong answer, and checks saving.
   - Look at the new pages once at the end (desktop 1280×800, phone 390×844).
5. Commit, then deploy (below).

Keep it simple. New behavior that every week needs goes in `core/` once. A week only adds content and its own
widgets. Don't add per-week stores, graders, test harnesses, export bundles or integration docs.

## Deploying

Send a Codex subagent (gpt-6.1-sol, medium) with this task:

> Deploy the latest `site/` of /home/pigfy/.t3/projects/school to its ChatGPT Site by following
> /home/pigfy/.t3/projects/school/deploy/README.md exactly. Reuse the existing project; never create a Site.
> Then open the live URL and confirm the landing page and /<course>/<week>/ for the changed week load. Report the
> deployment id and anything that failed.

Live site (owner-only): https://cse-study.familyopenai10916.chatgpt.site
