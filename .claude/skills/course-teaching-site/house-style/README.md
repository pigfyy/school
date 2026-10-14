# House style

The look every week shares. The stylesheet itself is `site/core/base.css` (with `site/core/fonts.css` and the
IBM Plex fonts); weeks load it from there and never copy it. The screenshots in `reference/` show the target.

## Fixed parts

- **Palette:** paper `--paper`, cards `--surface`, ink `--ink`, dark rail `--night`. The only accent hues are `--a1` (teal), `--a2` (rust) and `--a3` (violet), each with a `-tint` and an `-on-dark` variant, plus the semantic colors `--right`, `--wrong` and `--note`. Charts and widgets use the accents for series in order a1, a2, a3, with `--ink-soft` for a fourth.
- **Type:** IBM Plex Sans for prose and IBM Plex Mono for anything machine-like, eyebrow labels (`.where`, `.eyebrow`, `.panel-label`), counters and tags. No other font families. KaTeX keeps its own math font.
- **Rail:** dark, with a mono brand line (`$ cse332 week 2`) and a subtitle, then the course/week switcher (built by `core/app.js` from `site/courses.js`), the lecture group with its numbered `ol.modules`, the dashed "Later this week" list, Reference links and key hints. On a phone it becomes a sticky top bar with a **Contents** button.
- **Labels:** `.where` / `.eyebrow` with a `.today-chip[data-date]`. Upcoming content uses dashed `.tag-later` / `.day.later`. Week cards use `.week` with `.day.now` / `.day.later`.
- **Components:** `.rule`, `.panel`, `.check`, `details.notes`, `article.task`, `.cyu`, `.cheat`, `.pager`, `.toast`.

## What stays free

Each lecture's widgets and the layout inside a module are designed for that content, in the week's `week.css`, from the base tokens, so they still read as one family.
