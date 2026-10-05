# Coverage: CSE 312 26au, Week 1 (Wed Sept 30 – Fri Oct 2, 2026, Seattle time)

Sources were fetched from the official course site on Fri Oct 2, 2026 around 8:50 pm PDT. Raw files, extracted text, URLs, fetch times and hashes are in `raw/` and `raw/sources.json`. Site routes are hashes in `site/index.html`.

Base URL: `https://courses.cs.washington.edu/courses/cse312/26au/`

| Date | Item (official title) | Source | Included? | Where on the site |
|---|---|---|---|---|
| Wed Sept 30 | **Lecture 1**: Introduction · So you think you can count? (slides, 35 numbered slides / 80 PDF pages) | `slides/Lecture-01-counting-rules.pdf` | Yes, all content slides | `#l1-sets`, `#l1-sum`, `#l1-product`, `#l1-perms`, `#l1-kperms`, `#l1-books`; quiz `#l1-quiz`; logistics on `#home` |
| Wed Sept 30 | Optional set theory review | `files/optional-set-review.pdf` | Yes (sets, operations, De Morgan, sequences, Cartesian product) | `#l1-sets`, cheat sheet |
| Wed Sept 30 | Reading 1.1–1.2.1 (Tsun textbook) | `…/22au/files/Prob_Stat_for_CS_Book.pdf` (as linked by the schedule; byte-identical to the 26au copy) | Yes: rules on the lecture pages; worked examples as problems | `#readings` (flamingos, 1.1.5 ex 1, professors between TAs), `#l1-sum` notes |
| Wed Sept 30 | PSet 1 out | `homework/pset1.pdf` | **Due date and link only** (graded; no problems or answers reproduced) | `#home` → Due dates |
| Wed Sept 30 | Lecture recordings A/B | Panopto (UW login) | Linked only | `#home` → Slides |
| Wed Sept 30 | Concept check for Lecture 1 (graded, Gradescope) | syllabus + Lecture 1 slide 35 | **Due time only** (1:00 pm Fri Oct 2) | `#home` → Due dates |
| Thu Oct 1 | **Quiz Section 1**: Counting practice (handout) | `sections/section01.pdf` | Yes, every item: Review 1–5, Tasks 1a, 1b, 2a–d, 3, 4a–b, 5, 6, 7, 8, 9 | `#s1-review`, `#s1-basic`, `#s1-more` |
| Thu Oct 1 | Section 1 solutions | `sections/section01_solutions.pdf` | Yes, used for every answer and solution (lightly condensed) | step-by-step solutions on the three Section 1 pages |
| Fri Oct 2 | **Lecture 2**: Combinations and Binomial Coefficients (slides, 33 numbered slides / 94 PDF pages) | `slides/Lecture-02-combinations-and-binomial-coefficients.pdf` | Yes, all content slides | `#l2-combos`, `#l2-paths`, `#l2-stars`, `#l2-anagrams`, `#l2-binomial`; quiz `#l2-quiz`; logistics notes on `#home` |
| Fri Oct 2 | Reading 1.2.2–1.3.1 (textbook) | `files/Prob_Stat_for_CS_Book.pdf` | Yes: rules on the lecture pages; worked examples as problems | `#readings` (escape room, BABYYYBAY, students to professors, 1.2.5 ex 3 and ex 4, the 1.3.1 coefficient) |
| Fri Oct 2 | Lecture recordings A/B | Panopto (UW login) | Linked only | `#home` → Slides |
| Fri Oct 2 | Concept check for Lecture 2 (graded) | syllabus | **Due rule only** (1:00 pm on the day of the next lecture, Mon Oct 5) | `#home` → Due dates |
| Wed Oct 7 | PSet 1 due 11:59 pm | `homework/pset1.pdf` header, Lecture 2 slide 2 | Due date only | `#home` → Due dates |
| course-wide | Syllabus, AI policy, staff page, theorems & definitions sheet | `syllabus.php`, `aipolicy.php`, `staff.php`, `files/defs_thms.pdf` | Used for logistics, policy note and notation | `#home` → Course essentials, policy box; `#cheatsheet` |

## Slide-by-slide notes

* **Lecture 1**: staff, logistics and grading → `#home`. "Why probability" and the course outline → `#home` notes. Motivating questions (7 TAs, \(x^3+y^3=z^3\)) and "probability = counting" → `#home` notes. Sum rule and lunches → `#l1-sum`. Product rule and subs → `#l1-product`. Strings and binary strings → `#l1-product`. Cartesian product and power set → `#l1-product`. Sequences in \(\{1,2,3\}^3\) tree, factorial and \(0!\) → `#l1-perms`. Complements (21 repeats) → `#l1-perms` + enumerator. Distinct letters and \(P(n,k)\) → `#l1-kperms`. Books, overcounting, the clever approach and "representation matters" → `#l1-books` + enumerator. Concept check reminder → `#l1-books` notes.
* **Lecture 2**: announcements (PSet 1 due, AI policy, Ed etiquette, write-ups) → `#home` notes. Factorial recap → `#l1-perms`; Stirling's approximation → cheat sheet (stated only, no exercise, as in the lecture). Subsets vs. sequences, the two-step process, \(26!/(21!\,5!)=65{,}780\), binomial coefficient and \(\binom{S}{k}\) notation → `#l2-combos`. Symmetry (algebraic and include/exclude proofs, \(\binom41=\binom43\)) → `#l2-combos` widget. Gates → Starbucks paths and the poll → `#l2-paths`. Sum of integers, binary encoding, stars and bars, coins → `#l2-stars`. SEATTLE, Godoggy and multinomials → `#l2-anagrams`. Properties of \(\binom nk\), binomial theorem idea, poll, theorem and \(\sum\binom nk = 2^n\) → `#l2-binomial`. Quick summary → `#l2-binomial` notes and cheat sheet.

## Gaps and honest notes

* **Nothing expected is missing.** Both lectures' slides, the section handout **and** its solutions are posted and included.
* **Pascal's identity** appears on Lecture 2 slide 29, marked "(Next lecture)". It's mentioned but not taught.
* **Lecture recordings** are behind UW login and weren't fetched. Only the slides were used, so anything said aloud but not on the slides isn't covered.
* **Graded work isn't reproduced**: concept checks (Gradescope; content not public) and Problem Set 1 (fetched only to read the due date and to avoid overlap). Course AI policy: no AI on graded work. The site's own quiz questions were written to avoid PSet 1's setups (word counts, TA assignments, MISSISSAUGA/statistics, (25,75) grid paths, positive-integer stars and bars).
* **Section 1 Task 6** says "7 pets" but names 3 lizards and 2 snakes. The official solution uses 3 lizards and 2 snakes (answer \(4\cdot3^3+12\cdot2^3=204\)). The site follows the official solution and points out the discrepancy.
* **Section 1 Review 1–5**: the posted solutions leave these blanks unfilled. The site's answers are the rules exactly as stated in Lecture 1, and Review 5's counterexample is written for this site.
* **Section 1 Task 5** uses two-set inclusion–exclusion, which Lecture 3 (Mon Oct 5) formally covers. The site notes this.
* The **wrap-up quizzes** (`#l1-quiz`, `#l2-quiz`) are original questions written for this site and are labelled that way on the page. Every numeric answer is brute-forced in `tests/answers.test.js`.

## Compared with the earlier trial (`cse312-skill-trial/`)

* Its raw files (Lecture 1, set review, section01 + solutions, textbook) are byte-identical to today's official copies (md5 checked), so they're still correct. They were re-fetched rather than copied, and only the vendored KaTeX and font were copied from the trial.
* **Added**: the Fri Oct 2 Lecture 2 (slides, reading 1.2.2–1.3.1, five modules, quiz, reading problems).
* **Corrected**: scope and dates (the trial covered Lecture 1 and Section 1 only, and showed Lecture 2 as "not covered yet").
* Trial ids were reused only where the question and answer are unchanged (`data-legacy-ids`, `LEGACY_ID_MAP`). All other ids are new.
