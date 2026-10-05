# CSE 332 (26au) week 2: coverage inventory

Scope: Mon Oct 5 – Fri Oct 9, 2026 (Seattle). Sources were fetched on 2026-10-05 between 12:27 and 12:51 PDT. The not-posted materials were re-checked at 13:23 PDT. Raw files, their URLs, fetch times and sha256 hashes are in `raw/sources.json`. Extracted text is in `raw/text/`, and slide renders are in `raw/png/`.
Base URL: `https://courses.cs.washington.edu/courses/cse332/26au/` (written `…/26au/` below).

| Date | Item | Source URL | Included? | Where on the site |
|---|---|---|---|---|
| Mon Oct 5 | **Lecture 3: Algorithm Analysis pt. 2** (Ruth Anderson), 37 slides. The .pptx has speaker notes on slide 18, a fade animation on slide 11 (the chart appears on click) and no hidden slides | `…/26au/files/slides/cse332-26au-lec03-Analysis2.pdf` (+ `.pptx`) | Yes, all 37 slides, labeled "Today · Mon Oct 5" | `#home` (2–5: announcements, review), `#search` (6–11), `#notation` (12–18, incl. slide 18's speaker note), `#proofs` (19–26), `#drop` (27–29), `#examples` (30–32), `#usage` (33–37), `#l3-problems` (11 exercises from the slides' examples), `#cyu-l3` (10-question quiz), `#cheatsheet` |
| Mon Oct 5 | Reading: Weiss 2.1–2.4; math review Weiss 1.1–1.6 | listed on `…/26au/calendar.html` | Listed only (textbook not available, not summarized) | `#readings` |
| Mon Oct 5 | Math identities quick reference (linked from the calendar for Lecture 3) | `…/26au/files/math_identities_quick_reference.pdf` | Yes: all 8 log rules and the summations | `#cheatsheet` (Logs, Sums), `#readings`; the log rules are used in `#drop` (n log(10n²)) and `#search` (change of base) |
| Mon Oct 5 | Topic summary "Asymptotic Notation" (official course page) | `…/26au/summaries/asymptotics.html` | Used to check the definitions match slide 15; linked | `#readings` |
| Due Mon Oct 5 | Preliminary Survey (Canvas) | `…/26au/tasks.html`, slide 2 | Due date and link only | `#home` "Due soon" |
| Wed Oct 7 | Priority Queues 1 (ADT); Weiss 6.1–6.3 | `…/26au/calendar.html` (no slide link) | **Not posted, so not taught.** Shown as "Upcoming" | `#upcoming`, `#home` week strip, `#readings` |
| Thu Oct 8 | Section 2: Algorithm Analysis and Heaps | `…/26au/calendar.html` (no link); `…/26au/files/section/Section02.pdf` → 404 | **Not posted, so no section problems.** Shown as "Upcoming" | `#upcoming`, `#home` |
| Fri Oct 9 | Priority Queues 2 (Binary Heap); Weiss 6.4–6.5 | `…/26au/calendar.html` (no slide link) | **Not posted, so not taught.** Shown as "Upcoming" | `#upcoming`, `#home`, `#readings` |
| Due Fri Oct 9 | EX0 Generics (two Gradescope submissions) | `…/26au/tasks.html#exercise-0` | Due date and link only; not worked | `#home`, `#upcoming` |
| Due Mon Oct 12 | EX1 Running Time ("coming early next week", slide 2) | slide 2; calendar | Due date only | `#home` |
| First 4 weeks | "Meet the staff" office-hour check-off | slide 2 | Listed | `#home` |
| course-wide | Syllabus (meetings, grading, late days), staff, home page | `…/26au/syllabus.html`, `staff.html`, `index.html` | Summarized in "Course essentials" | `#home` |

## Where each slide's examples became exercises

| Exercise | Slides | Answer source |
|---|---|---|
| 1 Halving the gap | 8–9 | Computed: Java runs every target (`binaryWorst`) |
| 2 The base of the log | 10 | Slide 10's identity; exact check in Java (`logbase`) |
| 3 Example 1, \(10n+100 \in O(n^2)\) | 21–23 | Slides give \(c=10, n_0=10\). The smallest \(n_0 = 4\) was computed in Java |
| 4 Example 2, \(13n^2-50n \in \Omega(n^2)\) | 24–26 | Slides give \(c=12, n_0=50\) and say \(c=13\) fails. Both confirmed in Java |
| 5 \(3n^2+17 \in \Theta(n^2)\) | 17 | The slide states membership. The pairs were computed and checked exactly |
| 6 Slide 27's four examples | 27 | No posted answers. Derived by the slide's own rules and checked by the exact class engine |
| 7 Slide 31's five claims | 31–32 | Slide 32's answers (T, F, F, T, F) |
| 8 How long is "eventually"? | 32 | Computed with exact BigInteger in Java |
| 9 \(n^{1/10}\) vs \(\log n\) | 36 | The slide says "around \(5\cdot10^{17}\)". Exact \(k = 59\) computed in Java |
| 10 Which statements are true? | 18, 33, 34 | The slides' statements |
| 11 Write a full proof | 20, 23, 32 | Self-check against a slide-23-style proof |

## Gaps and notes

- **Priority Queues 1, Section 2, Priority Queues 2 are not taught.** On 2026-10-05 (12:27 and 13:23 PDT) the calendar had no slide or handout links for them, and `files/section/Section02.pdf`/`.pptx` plus four guessed lec04/lec05 slide names returned 404 (`raw/sources.json` → `notPosted`). No priority-queue or heap content and no section problems were invented. The `files/slides/` listing also has older files dated 2026-09-29 (`lecture4_analysis2_pqs.*`, `lecture5_pqs.*`). They aren't linked from the 26au calendar and don't use the 26au naming, so they weren't used. The Heaps topic summary was fetched for the record and is linked, not taught.
- **Slide 11 ("Running Time Graphed")** is a picture of two measured charts with no units, data or code. The site describes its shape (binary above linear on small inputs, linear passing it near 7,000) and doesn't reproduce numbers.
- **Slide 32 parenthetical slip:** for \(n + 2\log n \notin O(\log n)\) the slide writes "eventually \(n > c\log n\) (specifically, when \(\frac{2^n}{n} > c\))". As printed, that condition is too weak. The exact condition is \(2^n > n^c\): for \(c = 10\), \(\frac{2^n}{n} > 10\) holds from \(n = 6\), but \(n > 10\log_2 n\) first holds at \(n = 59\) (Java, exact). The verdict (False) is unaffected. This is noted in teaching notes only.
- **Slide 21 vs 23:** the technique line on slide 21 says "\(\forall n > n_0\)" and slides 23/26 say "\(\forall n \ge n_0\)". The site follows slide 15's definition (\(\ge\)).
- **Slide 27's examples** have no posted answers. The site's buckets follow the slide's own rules and are labeled as such in the teaching notes.
- **Speaker notes:** only slide 18 has substantive notes, and they're quoted in `#notation`. The others are just slide numbers.
- **Weiss textbook** isn't online. It's listed, not summarized.
- **Lecture recordings and the Preliminary Survey** are behind a UW login and weren't accessed.
- **Lecture 2's PDF was re-posted** on Oct 5 with two extra answer slides. The week-1 site already took those answers from the .pptx, so nothing changes.
