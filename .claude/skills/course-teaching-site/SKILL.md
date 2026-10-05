---
name: course-teaching-site
description: Design a teaching website from one week of raw course materials (lecture notes, slides, section handouts, syllabus, readings). Use when given a course-materials folder or zip and asked to make a site for teaching or studying that week.
---

# Course teaching site

Turn one week of a course's raw materials into a website that someone can teach from and students can practice on. Every site wears the same house style, so a student moving between courses and weeks sees one familiar interface. What makes each site its own is its content and its interactive pieces.

This skill covers what the site should contain and how it should look and behave.

## 1. Gather and read everything first

- Unpack the materials. If they're in a temp folder or a zip, copy the raw files somewhere permanent.
- Read every file before designing anything: lecture notes, slides, section handouts, readings, the syllabus and the course calendar. Note each lecture's big ideas, the course's notation and terminology, and every exercise or problem along with its official answer if one is given.
- **Scope is exactly what was provided.** Don't invent coverage for lectures or sections that aren't in the materials. If something expected is missing (e.g. Friday's lecture), leave it out and say so in the final report.

## 2. What the site has

`template/` (next to this file) is the quality bar: a trimmed copy of a real Week 1 site with one example of every component. It includes the sidebar, week overview with a hero widget, lecture modules with rule boxes, interactive panels and quick checks, the quiz, every kind of answerable problem, and the cheat sheet. The comment at the top of `template/index.html` maps each component to where it appears. Open it in a browser, then match its structure and behavior with the new course's own content.

Typical pages, adjusted to what the week contains:

- **Week overview:** what's covered, logistics and due dates.
- **Lecture modules:** one page per big idea, in the lecture's order. Each ends with a short quick check.
- **Check your understanding:** an 8–12 question wrap-up quiz per lecture, using only that lecture's ideas. Mark it once, under the page title, as written for the site.
- **Problems:** the section handout's problems or the lecture's exercises, each answerable on the page.
- **Readings** (when assigned) and a **cheat sheet** of definitions, formulas and rules.

## 3. The house style (required)

Every site **must** use the shared look in `house-style/` (read its `README.md` and the screenshots in `house-style/reference/`). The template already uses it.

- Copy `house-style/base.css`, `fonts.css` and `fonts/` into the site **unchanged**. Put only the course's own widget styles in a `course.css` loaded after them.
- `course.css` may use only base.css tokens: the three accents `--a1`/`--a2`/`--a3` with their `-tint` and `-on-dark` variants, ink, paper, surface, line, night, `--right`/`--wrong`/`--note`, and the Plex sans and mono fonts. Don't add new hues, other font families, or decorative backgrounds. Charts color their series a1, a2, a3, then `--ink-soft`.
- The chrome follows the house markup exactly:
  - the dark rail: mono brand, a `.today` badge on today's lecture group, numbered `ol.modules`, a dashed "Later this week" list, Reference links, key hints, and a **Contents** menu on mobile;
  - `.where`/`.eyebrow` labels with a `.today-chip`;
  - `.week` cards using `.day.now` / `.day.later`;
  - the rule, panel, check, notes, task, quiz, cheat-sheet, pager and toast components.
- **Date labels are honest.** Mark today's lecture "Today · Mon Oct 5" and later ones "Upcoming". Past sessions carry their date. Never call something taught before it has been. Upcoming sessions with no posted materials say "not posted yet" and get no invented content.
- **What is not templated:** the inside of each lecture module. Don't stamp every module out of one formula, such as the same rule box, then the same widget shape, then the same quick check. Shape each page around its idea: a terminal for a command-line program, a tree for a counting argument, a chart for growth rates. Each widget's layout should fit its idea while staying in the house style.
- Save feedback is transient toasts only, and only for failures, conflicts or recovery. Never show a persistent "Saved" line or status bar.

## 4. Content principles

- **Stay faithful to the course.** Use its notation, wording and examples. When the course provides answers, use them, lightly condensed, and keep precise claims precise.
- **Interactive pieces should do teaching work.** Build them around the course's own examples, such as a runnable simulator of the lecture's program, a line-by-line stepper, a brute-force enumerator for a counting problem, or clickable parts of a definition. Skip decoration.
- **Plain voice:** short sentences, no filler.
- **Teaching notes** go under each module and problem in a collapsible block that is **open by default**.

## 5. Problems

Each problem has: a prompt, one or more answer boxes, a free-form "your work" box, a hint ladder, a step-by-step solution, and optional teaching notes.

- **Hints:** 1–3 rungs. The first names the approach, the next gives the first concrete move, and none contains the answer.
- **Solutions:** shown in steps, ending with a highlighted final answer. Never lock the solution, but ask for confirmation if the student hasn't attempted the problem yet.
- **Answer checking:** pick the right type for each answer:
  - numeric expressions, compared by value
  - formulas, tested at several variable values
  - exact text for program output and very large numbers
  - yes/no
  - self-check ("I got it" / "I missed something") for proofs, specs and explanations

  Wrong-answer feedback must not reveal the answer.

- **No per-problem source lines** like "From section01.pdf, Task 3". State where problems come from once, in the page intro.
- **No projector mode and no download/load-answers buttons.**

## 6. Verify against ground truth

Don't trust mental arithmetic or mental execution.

- **Run real code** for any program-output answer or simulator (e.g. compile the lecture's Java and compare it with the simulator on many inputs, including edge cases like overflow and empty input).
- **Brute-force** counting and probability answers wherever the space is small enough.
- **Look at it in a browser:** open every page at desktop (1280×800) and mobile (390×844), try right and wrong answers, check that math and code render properly with no horizontal overflow, and compare against `house-style/reference/*.png`. It should read as the same family.
