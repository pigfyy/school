# Coverage: CSE 312 26au, Week 2 (Mon Oct 5 – Fri Oct 9, 2026, Seattle time)

Sources were fetched from the official course site on Mon Oct 5, 2026 at about 12:28 pm PDT. Files, extracted text, URLs, fetch times, HTTP status and sha256 hashes are in `raw/` and `raw/sources.json`. Each slide deck was also rendered to PNG and read page by page, because most of the math is in images.

Base URL: `https://courses.cs.washington.edu/courses/cse312/26au/`

**Timing as of today (Mon Oct 5).** Lecture 3 is labelled "Today · Mon Oct 5". Lectures 4 and 5 are labelled "Upcoming · Wed Oct 7" and "Upcoming · Fri Oct 9". Their slides were posted early, so their pages are previews and never say the lecture has happened. A browser test checks every module header and the overview for this.

| Date | Item (official title) | Source | Included? | Where on the site |
|---|---|---|---|---|
| Mon Oct 5 (today) | **Lecture 3**: Inclusion-Exclusion, Pigeonhole Principle and More (deck title "Even more counting", 90 PDF pages) | `slides/Lecture-03-counting-pigeons-and-more.pdf` | Yes, every content slide | `#l3-binomial`, `#l3-proofs`, `#l3-ie`, `#l3-php`, `#l3-cards`, `#l3-rooks`; problems `#l3-problems`; quiz `#l3-quiz` |
| Mon Oct 5 | Reading 1.3 | `files/Prob_Stat_for_CS_Book.pdf` (same bytes as week 1's copy) | Yes: examples and exercises become problems | `#readings` (1.3 section) |
| Wed Oct 7 (upcoming) | **Lecture 4**: Discrete Probability (30 pages) | `slides/Lecture-04-discrete-probability.pdf` | Yes, every content slide | `#l4-events`, `#l4-probability`, `#l4-uniform`, `#l4-axioms`, `#l4-dice`; `#l4-problems`; `#l4-quiz` |
| Wed Oct 7 | Reading 2.1 | textbook | Yes | `#readings` (2.1 section), `#l4-uniform` notes |
| Wed Oct 7 | PSet 1 due 11:59 pm | `homework/pset1.pdf` | Due date only; no problems reproduced | `#home` → Due dates |
| Wed Oct 7 | PSet 2 out | `homework/pset2.pdf` | **404, not posted** | `#home` shows "Not posted yet" |
| Thu Oct 8 | **Section 2**: Probability problems | `sections/section02.pdf`, `sections/section02_solutions.pdf` | **404, not posted.** No section problems were made up | `#home` week card and rail say "Not posted yet" |
| Fri Oct 9 (upcoming) | **Lecture 5**: Conditional Probability, Bayes Theorem (30 pages) | `slides/Lecture-05-conditional-probability.pdf` | Yes, every content slide | `#l5-conditional`, `#l5-reversing`, `#l5-bayes`, `#l5-ltp`, `#l5-zika`; `#l5-problems`; `#l5-quiz` |
| Fri Oct 9 | Reading 2.2 | textbook | Yes | `#readings` (2.2 section) |
| course-wide | Calendar, syllabus | `index.html`, `syllabus.php` | Due-date rules and grading weights | `#home` |

## Slide-by-slide

* **Lecture 3.** Recap of sum and product rules, \(k\)-sequences, permutations, combinations, and the list of \(\binom nk\) facts → `#l3-binomial`. Binomial theorem idea (the poll on the coefficient of \(xy^3\)), the theorem, and the \(x=y=1\) corollary → `#l3-binomial`, with an expansion widget and a substitution widget. Combinatorial vs algebraic argument, the proof format, and Pascal's identity built up over slides 15–35 (including the \(n=4,k=2\) example) → `#l3-proofs`, with a widget that splits \(S\) into \(A\) and \(B\) and a Pascal triangle. Disjoint sets, two- and three-set inclusion-exclusion (43/20/35/7/16/11/4) and the general form → `#l3-ie`, with a region-count stepper. PHP: 10 pigeons, 11 children and 3 cakes, the general and ceiling versions with proof, the 4-step strategy, 367 birthdays, and 100 integers mod 37 → `#l3-php`, with a pigeonhole widget and a mod-37 drawer. Cards: 52 cards, \(\binom{52}5\), straights \(10\cdot4^5\), flushes \(4\binom{13}5\), flush not straight → `#l3-cards`. Sleuth's criterion and the at-least-3-aces poll → `#l3-cards`, where the deck widget lists the 4 ways each 4-ace hand is built. Partly ordered lists \(P=M/N\) and the rooks → `#l3-rooks`. Binomial "less obvious consequence" (odd = even sums, \(x=-1\)) → `#l3-binomial` substitution widget. Tools list → `#l3-rooks` and `#home` notes. The brain-break and agenda slides have no content.
* **Lecture 4.** Announcements → `#home`, `#l4-dice` notes. What probability models → `#l4-events`. Sample space, events and mutual exclusion; the 4-sided dice A/B/C and the exclusivity questions → `#l4-events`. \(\mathbb P:\Omega\to[0,1]\), notation, fair and bent coins, probability space, and event probability → `#l4-probability`. Uniform space, \(P(B)=3/16\), equally likely outcomes, and the 100-coin poll → `#l4-uniform`. Axioms and corollaries; biased, glued and attached coins; the bag and spinner models → `#l4-axioms`, `#l4-probability` (bag preset). Two dice, at least one 3 (11/36) → `#l4-dice`.
* **Lecture 5.** Review → covered on the L4 pages. Ice cream given donuts (7/20) and the definition → `#l5-conditional`. Coin examples (1/3, 2/3) → `#l5-conditional`, `#l5-problems`. \(P(A\mid B)\ne P(B\mid A)\) (wet and swimming), the red/blue dice poll, and the gambler's fallacy → `#l5-reversing`. Bayes' theorem with proof, prior and posterior → `#l5-bayes`. Partitions, the LTP idea, the theorem, and Alice's pockets (5/12) → `#l5-ltp`. Zika example (Bayes + LTP, 100,000 people), updating beliefs, \(P(T^c\mid Z)=0.02\), and "conditional probability defines a probability space" → `#l5-zika`.

## Problems and quizzes

* **Problems from the slides** (`#l3-problems`, `#l4-problems`, `#l5-problems`): each is a slide question or example, with the slide's answer. One follow-up, \(P(\text{left}\mid\text{blue})=3/5\) in Alice's pockets, was added here; it's marked as added in that problem's teaching notes.
* **Readings page**: worked examples and exercises from 1.3, 2.1 and 2.2, with the textbook's answers. Exercise 1.3.5 #3 (d) straight and (f) straight flush are left out.
* **Check your understanding** quizzes (10 questions each): original questions written for this site, marked that way under each title. Each uses only its own lecture's ideas. They avoid PSet 1's setups.
* **Verification**: every exact answer key (86) is recomputed in `tests/answers.test.js` by brute-force enumeration or exact BigInt rationals. That includes all 2,598,960 hands, the rooks, and the dice and coin spaces, plus 100-coin counts done exactly by dynamic programming. Keys are also compared with the slides' and the textbook's stated values. Every misconception value is checked to be wrong. The in-page brute-force buttons run the same enumerations.

## Gaps and honest notes

* **Section 2** handout and solutions (`sections/section02.pdf`, `section02_solutions.pdf`): 404 when re-checked Mon Oct 5 at 12:28 pm. No section problems or solutions are on the site. The overview and rail show "Not posted yet", and the lecture problem pages say they stand in for section practice.
* **Problem Set 2** (`homework/pset2.pdf`, out Wed Oct 7): 404 when re-checked. Only the "out Wed Oct 7" date from the calendar and Lecture 4's announcement are shown.
* **Lecture 4 and 5 recordings** don't exist yet. Lecture 3 recording A is behind UW login and wasn't fetched. Anything said aloud but not on the slides isn't covered.
* **Concept checks** (Gradescope) are graded and not public; only their due rule is shown.
* Lecture 3's slide 1 says "Binomial Theorem, Inclusion-Exclusion, Pigeonhole Principle"; the calendar's title is used on the site.
* The Lecture 5 slide on the gambler's fallacy says the 51st coin is "independent"; independence itself is Lecture 6 (Mon Oct 12) and is only mentioned.
* Lecture 4's "More examples of non-equally likely outcomes" slide is pictures only (a bag of balls 3/10, 4/10, 2/10, 1/10, and a spinner). The bag is used as a preset; the spinner has no numbers and is left out.
