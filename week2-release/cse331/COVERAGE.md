# Coverage: CSE 331 Autumn 2026, week 2 (Mon Oct 5 to Fri Oct 9, Seattle time)

Fetched from <https://courses.cs.washington.edu/courses/cse331/26au/> on Mon 2026-10-05 around 12:30 PDT. The
"not available" pages were re-checked once at 12:36 PDT. Raw copies, fetch times and SHA-256 hashes are in
`raw/sources.json`. Routes refer to `site/index.html`.

| Item (date) | Source | Included? | Where on the site |
|---|---|---|---|
| Lecture 3, **Mon Oct 5 (today)**: "Reading 1 discussion; Batch processing" | [index](https://courses.cs.washington.edu/courses/cse331/26au/lectures/lecture03-batch/), [notes](https://courses.cs.washington.edu/courses/cse331/26au/lectures/lecture03-batch/notes.html), [slides](https://courses.cs.washington.edu/courses/cse331/26au/lectures/lecture03-batch/slides.html), [slides PDF](https://courses.cs.washington.edu/courses/cse331/26au/lectures/lecture03-batch/slides.pdf) | **Yes.** All four notes sections in order, the slides' Reading 1 discussion and "Stronger vs. weaker" return, every run in the notes and slides, the two changed copies of `Sum`, the history and maxim, all 5 end-of-notes exercises, footnotes (OOM, Yorktown, Kernighan/Plauger) and further reading. Labelled "Today · Mon Oct 5". | `#l3-discuss`, `#l3-strength`, `#l3-sum`, `#l3-batch`, `#l3-manual`, `#l3-edge`; quiz `#l3-quiz` (11 questions, written for the site); problems `#l3-exercises` (1–4: in-lecture predictions from notes/slides; 5–9: exercises 1–5) |
| Lecture 2's "Stronger and weaker" through "Knowing a program in pieces" (the notes say to read them there; the slides return to them) | [Lecture 2 notes](https://courses.cs.washington.edu/courses/cse331/26au/lectures/lecture02-specifications/notes.html) (saved as `raw/lecture02/notes.html`, for reference) | A short recap only: definition, rule, which-is-better, one quick check. Week 1's site covers it in full. | `#l3-strength` |
| Reading 1 (due Fri Oct 2, discussed today) | [reading1](https://courses.cs.washington.edu/courses/cse331/26au/readings/reading1.html), [readings page](https://courses.cs.washington.edu/courses/cse331/26au/readings/) | The question, the three article choices and optional extras (summaries from the course page), what the reflection's three parts ask, how it's graded, and today's discussion format. No reflection is written. | `#readings`, `#l3-discuss` |
| Section 1, Tue Oct 6: "Assertions and Specifications" | [section01](https://courses.cs.washington.edu/courses/cse331/26au/section/section01.html), [solution](https://courses.cs.washington.edu/courses/cse331/26au/section/section01-solution.html) | **No.** Both say "CSE 331: Not Yet Available" (checked twice). Nothing was invented. | Rail ("materials not posted yet") and week overview card |
| Lecture "Testing 1", Wed Oct 7 | [calendar](https://courses.cs.washington.edu/courses/cse331/26au/calendar/calendar.html); `lectures/testing/notes.html` | **No.** The notes page says "Not Yet Available"; `lectures/testing/` holds only that page, there are no slides, and `lectures/lecture04/` is 404. | Rail and week overview, as upcoming |
| Lecture "Testing 2", Fri Oct 9 | calendar | **No.** Nothing posted. | Rail and week overview, as upcoming |
| Homework 1, due Fri Oct 9, 11:59 pm | [hw1](https://courses.cs.washington.edu/courses/cse331/26au/homework/hw1.html) | Due date and link only, plus the slide's one-line mentions of Tasks 3 and 4 (a user manual for Histogram; checks at the edge in Gradebook) in teaching notes. No problem is worked or previewed. | Rail, week overview, course essentials |
| Calendar, syllabus (lecture times, sections, late days) | [calendar](https://courses.cs.washington.edu/courses/cse331/26au/calendar/calendar.html), [info](https://courses.cs.washington.edu/courses/cse331/26au/info/) | Logistics only | `#home` course essentials |
| Reading 2 (due Fri Oct 16) | [reading2](https://courses.cs.washington.edu/courses/cse331/26au/readings/reading2.html) | Due date and link only (next week's material) | `#home`, `#readings` |

## Gaps

- **Section 1 handout and solution: not posted** as of Oct 5, 12:36 PDT. No section problems were invented.
- **Testing 1 and Testing 2 (Oct 7, Oct 9): not posted.** No testing lessons were invented.
- **The half sheet** questions are on the slides and appear in the run sheet; students' answers are on paper and not collected here.
- **The program sheet** (the 99-line `Sum` handed out in lecture) is the same listing as the notes; the site shows the notes' copy.
- **Stack trace frames.** The site prints the frames the notes show (JDK 25). The test machine has OpenJDK 21,
  whose frames inside `java.base` have other line numbers. `compare-java.mjs` compares the exception line and the
  `at Sum.main(Sum.java:78)` frame for those runs, and everything else byte for byte.
- **Out-of-memory boundary.** For a huge `--precision`, the site's switch from "prints" to `OutOfMemoryError: Java
  heap space` was measured on the test machine (6 GB heap) and depends on memory; the notes give no number. The
  "Requested array size exceeds VM limit" case (precision 2147483647 with numbers, the notes' footnote) holds on
  any computer and is compared in every test run. `FULL=1 node tests/compare-java.mjs` re-measures the boundary.
- The Reading 1 articles themselves weren't fetched; the site uses the course page's summaries.
