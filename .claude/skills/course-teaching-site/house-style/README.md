# House style (required)

Every course teaching site uses this look. It's taken from CSE 331 week 2 (Autumn 2026); see `reference/*.png`.

## Files

| File | Use |
|---|---|
| `base.css` | Copy into `site/` **unchanged**. Tokens, rail, type, rule boxes, buttons/inputs, panels, code listings, week cards, teaching notes, quick checks, problems, quiz, readings, cheat sheet, pager, toasts, responsive layout, print. |
| `fonts.css` + `fonts/` | Copy into `site/` unchanged (IBM Plex Sans + Mono, vendored, works from `file://`). |
| `course.css` (you write it) | Only the course's own widget styles. Load after `base.css`. Use base tokens only. |
| `reference/shell-markup.html` | The exact rail markup (brand, menu button, Today badge, "Later this week" list, Reference links, key hints). |
| `reference/course-cse331-w2.css` | A worked example of a `course.css` (terminals, runner, sorter…). |

```html
<link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="base.css">
<link rel="stylesheet" href="course.css">
<!-- KaTeX css (vendored) if the course uses math -->
```

## Fixed parts

- **Palette:** paper `--paper`, cards `--surface`, ink `--ink`, dark rail `--night`. The only accent hues are `--a1` (teal), `--a2` (rust) and `--a3` (violet), each with a `-tint` and an `-on-dark` variant, plus the semantic colors `--right`, `--wrong` and `--note`. Don't add a new hue for page chrome. Charts and widgets use the accents for series in order a1, a2, a3, with `--ink-soft` for a fourth.
- **Type:** IBM Plex Sans for prose and IBM Plex Mono for anything machine-like, eyebrow labels (`.where`, `.eyebrow`, `.panel-label`), counters and tags. Don't use serif display fonts or other font families. KaTeX keeps its own math font.
- **Rail:** dark, with a mono brand line (`$ cse312 week 2`, where the `$ ` comes from CSS) and a small subtitle. Section headings are mono caps. The lecture group carries a `.today` badge. Numbered modules mark the current page with `>` and a teal inset bar. The "Later this week" dashed list holds upcoming sessions, plus a "materials not posted yet" note where that's true. Last come the Reference links and the key-hint footer. On mobile it becomes a sticky top bar with a **Contents** button (`#menu-btn`, toggling `.rail.open`).
- **Labels:** `.where` / `.eyebrow` eyebrow with `.today-chip` ("Today · Mon Oct 5"). Upcoming content uses the dashed `.tag-later` / `.day.later` style. Week cards use `.week` with `.day.now` / `.day.later`.
- **Components:** use base.css classes as-is: `.rule`, `.panel`, `.check`, `details.notes`, `article.task`, `.cyu`, `.cheat`, `.pager`, `.toast`.

## What stays free

Each lecture's interactive widgets, and the layout inside a module, should be designed for that content. A probability tree, a growth chart and a terminal shouldn't look stamped from one mold. Build them in `course.css` from the base tokens so they still read as the same family.
