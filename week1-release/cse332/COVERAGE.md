# CSE 332 (26au) week 1: coverage inventory

Scope: Wed Sept 30 – Fri Oct 2, 2026 (Seattle). Sources were fetched 2026-10-02 at about 20:50 PDT. Raw files, their URLs, fetch times and checksums are in `raw/sources.json`. Extracted text is in `raw/text/`.
Base URL: `https://courses.cs.washington.edu/courses/cse332/26au/` (written `…/26au/` below).

| Date | Item | Source URL | Included? | Where on the site |
|---|---|---|---|---|
| Wed Sept 30 | **Lecture 1: Intro; ADTs; Queues & Stacks** (Ruth Anderson), slides 1–21 with speaker notes | `…/26au/files/slides/cse332-26au-lec01-Intro.pptx` (+ `.pdf`) | Yes, all 21 slides | `#adt` (slides 2–11: course info, terminology), `#queues` (12–20: queue ADT, linked queue, circular array, resize question, LL vs array), `#stacks` (21), `#l1-problems` (slides 12–13 and 21 as exercises, plus 2 trace exercises on the slide's queue), `#cyu-l1` (10-question quiz), home hero |
| Wed Sept 30 | Reading: Weiss 3.1–3.7 (textbook, optional, not online) | listed on `…/26au/calendar.html` | Listed with what to read for | `#readings` |
| Wed Sept 30 | Topic summary "ADTs, Stacks, and Queues" (official course page) | `…/26au/summaries/adt_stacks_queues.html` | Used for wording (ADT = user's view; "implementation" definition) and linked | `#adt`, `#readings` |
| Thu Oct 1 | **Section 1: Intros, Java Generics**, slides 1–22 with TA notes | `…/26au/files/section/Section01.pptx` (+ `.pdf`) | Yes | `#generics` (slides 4–21: ADT vs data structure, Pair ADT, IntPair → LikePair\<T\>, UnlikePair, Tuple and `(T[]) new Object[]`, bounded `T extends Animal`), `#section` problems 1–5 (List/Stack/Queue/Set ADT slides 6–13 with their answer slides; UnlikePair "replace the Ts" from slide 18) |
| Thu Oct 1 | Section 1 worksheet ("Your turn!": TypeSubtypePair, IntOtherPair, ItemPairPair, ItemArrayPair, ComparablePair) | Google Doc `1HtlbsYXqDWFWuuBhYM9XXytHLz5K7t1i` (linked from calendar, publicly exportable) | Yes, all 5 | `#section` problems 6–10 |
| Thu Oct 1 | Section 1 worksheet **solutions** | Google Doc `1D1oLDdE35-Jd3uWbMeNRZdrNy45pcHOb` | Yes, as answer keys and step-by-step solutions | `#section` problems 6–10 |
| Fri Oct 2 | **Lecture 2: Algorithm Analysis pt. 1** (Ruth Anderson), slides 1–31, including the hidden answer slides 16 and 18 that appear only in the .pptx | `…/26au/files/slides/cse332-26au-lec02-Analysis1.pptx` (+ `.pdf`, 29 pages) | Yes, all 31 slides | `#analysis` (3–14), `#counting` (15–18, stepper), `#amortized` (19–22), `#search` (23–27), `#asymptotic` (28–31, growth chart, `c`/`n₀` checker), `#l2-problems` (11 exercises), `#cyu-l2` (10-question quiz) |
| Fri Oct 2 | Reading: Weiss 2.1–2.4; math review Weiss 1.1–1.6 | listed on calendar | Listed | `#readings` |
| Fri Oct 2 | Topic summaries "Running time" and "Asymptotics" | `…/26au/summaries/runningtime.html`, `…/26au/summaries/asymptotics.html` | Used: operation-choice criteria, the 3 worked `c`/`n₀` proofs (exercises 9–11), and the "O means worst case" misconception | `#analysis`, `#asymptotic`, `#l2-problems` 9–11, `#readings` |
| any | Math identities quick reference | `…/26au/files/math_identities_quick_reference.pdf` | Linked; sums used in the readings note | `#readings`, home |
| Due Mon Oct 5 | Preliminary survey (Canvas) | announced on Lecture 2 slide 2; `…/26au/tasks.html` | Due date only | home "Due soon" |
| Due Fri Oct 9 | Exercise 0 (generics, stacks/queues, benchmarking; 2 Gradescope submissions) | `…/26au/tasks.html` | Due date and link only. **Not taught or solved.** (The site stops the queue visualizer at "full" and points resize to the exercise.) | home "Due soon" |
| Due Mon Oct 12 | Exercise 1 "Running Time" (released next week) | Lecture 2 slide 2; calendar | Due date only | home "Due soon" |
| First 4 weeks | "Meet the staff" office-hour check-off | Lecture 2 slide 2 | Listed | home "Due soon" |
| course-wide | Syllabus (meetings, grading, late days, collaboration), staff page, calendar | `…/26au/syllabus.html`, `…/26au/staff.html`, `…/26au/calendar.html` | Summarized in "Course essentials" | home |

## Gaps

- **Lecture recordings** (Panopto in Canvas) require a UW login, so they weren't accessed. The site is built from the posted slides, speaker notes and topic summaries only.
- **Lecture 2 slide 4** ("Pick an algorithm with the best running time") and **Lecture 1 slide 20** ("Linked List vs. Circular Array: summarize benefits and drawbacks") are blank in the posted decks; they were in-class activities. The site says so and gives discussion prompts, not invented answers.
- **Lecture 2 slide 28** ("Which algorithm is best?") has no posted answer. The site's crossover numbers (11, 1084) were computed exactly and are labelled as computed.
- **Section 1 slide 18** (UnlikePair "replace the Ts") has no posted answer. The site's completion (A, B, A) was compiled with `javac` and is labelled that way.
- **Section 1 icebreaker / TA intro slides** (2–3) are placeholders in the template deck and not reproduced.
- **Section 1 "code" folder** mentioned in the TA notes isn't linked from the calendar. The posted Google Doc solutions were used instead.
- **Office hours schedule:** `oh.html` contains only an embedded calendar, so the times aren't listed on the site.
- **Weiss textbook sections** aren't online. They're listed, not summarized.
- **Discrepancy noted, not changed:** the worksheet's `compareTo` line uses `compare1st==0 ? …`. The posted solution uses `!=`. Running both in Java shows the worksheet version orders `(1,"z")` after `(2,"a")`. Section problem 10 asks students to spot this.
