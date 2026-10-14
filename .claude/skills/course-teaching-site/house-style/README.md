# House style

Every week uses one look: CSE 332 week 2's original design. The stylesheet is `site/core/base.css` (with
`site/core/fonts.css`); weeks load it and never copy it. `reference/*.png` shows the target.

## Fixed parts

- **Page:** warm paper (`--paper`) with a faint 28px grid. Cards and boxes on `--surface`, ink `--ink`.
- **Rail:** deep indigo (`--night`) with the same grid. Brand: a small caps kicker (`CSE 332 · week 2`) over the week's
  title in Fraunces, then the course/week switcher, lecture groups with a mint date badge, numbered modules,
  "Later this week", Reference. The current page is a pale lavender pill. On a phone it's a top bar with **Menu**.
- **Type:** Fraunces for titles (h1, h2, problem titles, week cards); Public Sans for reading; JetBrains Mono for code.
  `h1 em` is purple italic.
- **Color:** purple `--accent` for links, buttons, rule edges and the current page. Amber for teaching notes, hints
  and quick checks. Mint `--today` for "today". `--right` / `--wrong` for grading. Chart series `--s1` blue,
  `--s2` orange, `--s3` aqua (also available as `--a1`/`--a2`/`--a3`). CSE 331's terminals keep their own
  `--out`/`--err`/`--st` (standard output, standard error, exit status), only inside those widgets.
- **Labels:** `.kicker` at the top of a page, `.where` above a module title, `.today-chip[data-date]` for dates.
  Week cards: `.week` with `.day.today` / `.day.later` and a `.when` line.
- **Components:** `.rule`, `.panel`, `.check`, `details.notes`, `article.task`, `.cyu`, `.cheat`, `.pager`, `.toast`.

## What stays free

Each lecture's widgets and the layout inside a module are designed for that content, in the week's `week.css`,
using these tokens, so they still read as one family.
