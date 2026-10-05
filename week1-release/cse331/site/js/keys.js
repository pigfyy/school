/* Answer keys and misconception feedback, keyed by part ID (problems), quick-check ID or quiz ID.
   Kept out of index.html so the state inventory (export/state-inventory.json) never contains them.
   Every int answer that comes from running code was checked against real Java (tests/compare-java.mjs
   and tests/unit.mjs). Misconception messages name the likely wrong idea without giving the answer.
   For multiple-choice quiz items, `answer` is the correct option's data-option id. */
(function (root) {
  "use strict";
  const m = (when, kind, message) => ({ when, kind, message });
  const STRENGTH = { type: "strength" };
  const s = (answer, misconceptions = []) => ({ ...STRENGTH, answer, misconceptions });

  root.ANSWER_KEYS = {
    /* ================================================================ Lecture 1 quick checks */
    "cse331-w1-l1-qc-count-counterexamples": { type: "int", answer: "1", misconceptions: [
      m("0", "all-runs-look-fine", "One of these runs prints a sum the sentence doesn't promise. Run each one in the hunt panel above."),
      m("2|3|4", "empty-or-ordinary-counted", "A run where the sentence is true, or true once we grant that an empty list sums to 0, is not a counterexample."),
    ] },
    "cse331-w1-l1-qc-spec-predicts-sum": { type: "int", answer: "8", misconceptions: [
      m("2147483656|-2147483640|2147483655|-2147483641", "kept-reading-past-word", "The specification says reading stops at the first thing that is not such a number, and the rest is ignored."),
    ] },
    "cse331-w1-l1-qc-list-size-at-point1": { type: "int", answer: "2", misconceptions: [
      m("3|4", "skipped-word", "The input loop doesn't skip a word and keep going. What does hasNextInt() say when it reaches x?"),
      m("0", "size-vs-sum", "list.size() counts elements. It isn't their sum."),
    ] },
    "cse331-w1-l1-qc-list-survives-loop": { type: "yesno", answer: "yes", misconceptions: [
      m("no", "reading-is-writing", "Reading a list with list.get doesn't change it. Only a write, like add or set, could break the claim."),
    ] },
    "cse331-w1-l1-qc-hasnext-exception": { type: "text", answer: "InputMismatchException|java.util.InputMismatchException", misconceptions: [
      m("NumberFormatException|java.lang.NumberFormatException", "wrong-exception-parse", "Close, but Scanner throws its own exception type here. Run the hasNext version above and read the first line of the trace."),
      m("NoSuchElementException|java.util.NoSuchElementException", "wrong-exception-empty", "That one means no input is left. Here input is waiting; it just isn't an int."),
    ] },
    "cse331-w1-l1-qc-which-way-confirms": { type: "text", answer: "reason|reasoning|reason about it|reason about the program|proof|prove it", misconceptions: [
      m("test|testing|test it|tests", "testing-confirms", "Testing can refute a claim about every run, but passing tests cover only the runs you chose."),
      m("run|running|run it", "one-run-confirms", "A run tells you about that one run and nothing about any other."),
    ] },

    /* ================================================================ Lecture 1 quiz */
    "cse331-w1-l1-quiz-how-many-runs": { type: "choice", answer: "infinite" },
    "cse331-w1-l1-quiz-thousand-runs": { type: "choice", answer: "those-runs" },
    "cse331-w1-l1-quiz-sum-after-word": { type: "int", answer: "30", misconceptions: [
      m("60", "skipped-word", "The loop doesn't skip the word and carry on. Everything from x onward is ignored."),
      m("0", "word-voids-input", "Reading stops at the word, but the numbers before it were already read."),
    ] },
    "cse331-w1-l1-quiz-which-is-spec": { type: "choice", answer: "prompt-first" },
    "cse331-w1-l1-quiz-sum-wraps-down": { type: "int", answer: "2147483647", misconceptions: [
      m("-2147483649", "true-sum-fits", "That's the true sum, but an int can't hold it. What does the specification say happens then?"),
      m("-2147483648", "overflow-clamps", "Overflow doesn't stick at the edge of the range. It wraps around."),
    ] },
    "cse331-w1-l1-quiz-which-is-assertion": { type: "choice", answer: "size-bound" },
    "cse331-w1-l1-quiz-nonempty-holds": { type: "choice", answer: "empty-run" },
    "cse331-w1-l1-quiz-rule-needs": { type: "choice", answer: "p-and-code" },
    "cse331-w1-l1-quiz-edge-standard": { type: "choice", answer: "stack-trace" },
    "cse331-w1-l1-quiz-testing-can": { type: "choice", answer: "refute-only" },

    /* ================================================================ Lecture 1 exercises */
    "cse331-w1-l1-predict-two-runs.two-lines-got": { type: "text", answer: "Got [3, 4, 5]", misconceptions: [
      m("Got [3, 4]", "stops-at-line-end", "hasNextInt() doesn't stop at the end of a line. Only the end of the input or a non-int stops it."),
    ] },
    "cse331-w1-l1-predict-two-runs.two-lines-sum": { type: "int", answer: "12", misconceptions: [
      m("7", "stops-at-line-end", "hasNextInt() doesn't stop at the end of a line."),
    ] },
    "cse331-w1-l1-predict-two-runs.decimal-got": { type: "text", answer: "Got []", misconceptions: [
      m("Got [3]", "skips-non-int", "The loop doesn't skip a token it can't read. It stops there."),
      m("Got [2.5, 3]|Got [2, 3]|Got [2]", "decimal-is-int", "nextInt() reads whole numbers only. Is 2.5 one?"),
    ] },
    "cse331-w1-l1-predict-two-runs.decimal-sum": { type: "int", answer: "0", misconceptions: [
      m("3", "skips-non-int", "The loop doesn't skip a token it can't read. It stops there."),
      m("5|2", "decimal-is-int", "nextInt() reads whole numbers only. Is 2.5 one?"),
    ] },
    "cse331-w1-l1-which-are-specs.specs": { type: "letters", allowed: "ABCD", answer: "ABC", misconceptions: [
      m("ABCD", "how-is-a-spec", "One statement says how Sum works inside. A user who never sees the code can't check it."),
      m("B", "spec-means-met", "Being a specification and being met are separate questions. A false specification is still a specification."),
    ] },
    "cse331-w1-l1-which-are-specs.sum-meets": { type: "letters", allowed: "ABCD", answer: "B", misconceptions: [
      m("AB|ABC", "believed-easy-runs", "Try each statement on the lecture's harder runs: a word among the numbers, and two numbers near the top of the int range."),
      m("BD", "how-is-a-spec", "This part asks only about the statements that are specifications."),
    ] },
    "cse331-w1-l1-sum-starts-at-one.point1-list": { type: "yesno", answer: "yes", misconceptions: [
      m("no", "change-flows-backward", "Where is line 15 relative to point (1)? A change can't affect a point the run reaches before it."),
    ] },
    "cse331-w1-l1-sum-starts-at-one.point2-sum": { type: "yesno", answer: "no", misconceptions: [
      m("yes", "missed-off-by-one", "Step through the empty run in your head. What is sum at (2)?"),
    ] },
    "cse331-w1-l1-sum-starts-at-one.point2-list": { type: "yesno", answer: "yes", misconceptions: [
      m("no", "init-touches-list", "Does the summing loop, or line 15, ever write to list?"),
    ] },
    "cse331-w1-l1-sum-starts-at-one.meets-spec": { type: "yesno", answer: "no", misconceptions: [
      m("yes", "missed-off-by-one", "Find the run with the fewest numbers in it and compare what it prints with what the specification promises."),
    ] },
    "cse331-w1-l1-long-version.overflow-sum": { type: "int", answer: "2147483648", misconceptions: [
      m("-2147483648", "still-int", "That's what the int version prints. What range does a long hold?"),
    ] },
    "cse331-w1-l1-long-version.too-big-got": { type: "text", answer: "Got [2147483648]", misconceptions: [
      m("Got []", "still-int", "That's the int version. Does 2147483648 fit in a long?"),
    ] },
    "cse331-w1-l1-specs-worth-meeting.meets-e": { type: "yesno", answer: "yes", misconceptions: [
      m("no", "crash-breaks-e", "What does E promise on a run where the user breaks E's rule?"),
    ] },
    "cse331-w1-l1-specs-worth-meeting.meets-f": { type: "yesno", answer: "yes", misconceptions: [
      m("no", "crash-breaks-f", "Read F's last sentence. What does it promise when something else is typed?"),
    ] },
    "cse331-w1-l1-specs-worth-meeting.course-accepts": { type: "text", answer: "neither|none|neither of them|no", misconceptions: [
      m("e|f|both|e and f|e, f", "met-means-acceptable", "Meeting a specification is half the job. Hold each one to the standard from The edge of the program."),
    ] },

    /* ================================================================ Lecture 2 quick checks */
    "cse331-w1-l2-qc-who-makes-precondition": { type: "text", answer: "client|the client|caller|the caller|the code that calls it|the calling code", misconceptions: [
      m("implementer|the implementer|method|the method|callee", "implementer-owns-pre", "The implementer is allowed to assume the precondition. Someone else has to make it true. Who?"),
      m("user|the user", "user-is-client", "For a method, the other side of the promise is code, not the person at the keyboard."),
    ] },
    "cse331-w1-l2-qc-modifies-tag": { type: "text", answer: "@modifies|modifies", misconceptions: [
      m("@effects|effects", "effects-vs-modifies", "@effects says how parameters change. Another tag says which ones may change."),
      m("@param|param", "param-vs-modifies", "@param says what a parameter is for, not whether it may change."),
    ] },
    "cse331-w1-l2-qc-main-lines-to-change": { type: "int", answer: "0", misconceptions: [
      m("1|2|3|4|5|6", "client-depends-on-code", "main relies only on sumList's promises. Did the promises change?"),
    ] },
    "cse331-w1-l2-qc-impls-meeting-d": { type: "int", answer: "2", misconceptions: [
      m("1", "some-means-first", "D accepts any match in the range, not only one particular match."),
      m("3|4", "absent-case-ignored", "Check what each implementation does when x isn't in the range. D asks for -1 there."),
      m("0", "too-strict", "D is the loosest of B, C and D. Read its @return again."),
    ] },
    "cse331-w1-l2-qc-b-or-d-stronger": { type: "text", answer: "B|spec b|b is stronger|b is stronger than d", misconceptions: [
      m("D|spec d|d is stronger", "looser-is-stronger", "A stronger specification promises more and is met by fewer implementations."),
      m("neither|incomparable|same|equal|both", "same-pre-means-same", "B and D share a precondition, so compare only what each promises to return."),
    ] },
    "cse331-w1-l2-qc-count-impl4": { type: "int", answer: "1", misconceptions: [
      m("3", "count-counts-everything", "3 is how many 3s the array holds. count only counts the matches its searches return. Step it with implementation 4 above."),
      m("0", "first-call-misread", "The first search covers the whole array. Does implementation 4 find a 3?"),
    ] },

    /* ================================================================ Lecture 2 quiz */
    "cse331-w1-l2-quiz-who-keeps-precondition": { type: "choice", answer: "client" },
    "cse331-w1-l2-quiz-broken-precondition": { type: "choice", answer: "anything" },
    "cse331-w1-l2-quiz-no-modifies": { type: "choice", answer: "list-unchanged" },
    "cse331-w1-l2-quiz-which-tag-precondition": { type: "choice", answer: "requires" },
    "cse331-w1-l2-quiz-ignores-hi-returns": { type: "int", answer: "1", misconceptions: [
      m("-1", "reads-like-impl1", "That's what implementation 1 would return. Implementation 3 has no -1 anywhere, and never looks at hi."),
      m("0", "index-of-value", "Implementation 3 returns an index. Trace i: where is the first 7?"),
    ] },
    "cse331-w1-l2-quiz-meets-b-also": { type: "choice", answer: "d" },
    "cse331-w1-l2-quiz-stronger-means": { type: "choice", answer: "every-impl" },
    "cse331-w1-l2-quiz-strengthening-breaks": { type: "choice", answer: "implementation" },
    "cse331-w1-l2-quiz-count-last-match": { type: "int", answer: "1", misconceptions: [
      m("3", "count-counts-everything", "That's how many 2s there are. Implementation 4's first search returns the last match. Where does the next search start?"),
    ] },
    "cse331-w1-l2-quiz-client-correct": { type: "choice", answer: "every-impl" },
    "cse331-w1-l2-quiz-abs-min-value": { type: "int", answer: "-2147483648", misconceptions: [
      m("2147483648", "abs-fits", "That's the true absolute value, but it is one more than the largest int. What does an int addition that passes the top do?"),
      m("2147483647", "abs-clamps", "Java ints don't stick at the top of the range. They wrap around."),
    ] },

    /* ================================================================ Lecture 2 problems */
    "cse331-w1-l2-meets-matrix.first-or-minus-one": { type: "letters", allowed: "ABCDE", answer: "ABD", misconceptions: [
      m("B|BD", "forgot-weak-spec-a", "A asks for less than B. On calls where A's precondition holds, does implementation 1 give A what it promises?"),
      m("AB|B", "forgot-some-match", "D accepts any match. Is the first match in particular some match?"),
      m("ABCD|ABDE|ABCDE", "first-equals-last", "Try an array with x twice in the range, and an x that isn't in the range at all."),
    ] },
    "cse331-w1-l2-meets-matrix.first-or-throw": { type: "letters", allowed: "ABCDE", answer: "AE", misconceptions: [
      m("E", "forgot-weak-spec-a", "A promises nothing when x is absent. What does it ask for when x is present?"),
      m("ABE|ABDE|ABCDE", "throw-equals-minus-one", "When x is absent, B, C and D each ask for one particular return value. Does implementation 2 return it?"),
    ] },
    "cse331-w1-l2-meets-matrix.ignores-hi": { type: "letters", allowed: "ABCDE", answer: "A", misconceptions: [
      m("", "none-met", "Look at A's precondition. On a call where it holds, where does implementation 3's loop stop?"),
      m("AB|ABD|ABE|AD|ABCDE|ABDE", "hi-respected", "Implementation 3 never reads hi. Try a call where x is absent from the range."),
    ] },
    "cse331-w1-l2-meets-matrix.last-or-minus-one": { type: "letters", allowed: "ABCDE", answer: "ACD", misconceptions: [
      m("C|CD", "forgot-weak-spec-a", "Check A too: when x is present, does implementation 4 return a match?"),
      m("AC|C", "forgot-some-match", "D accepts any match. Is the last match in particular some match?"),
      m("ABCD|ABD", "first-equals-last", "B asks for the smallest match. Try an array with x twice in the range."),
    ] },
    "cse331-w1-l2-break-it.first-match-vs-c": { type: "witness", witness: "indexOf", impl: 1, spec: "C" },
    "cse331-w1-l2-break-it.last-match-vs-b": { type: "witness", witness: "indexOf", impl: 4, spec: "B" },
    "cse331-w1-l2-break-it.minus-one-vs-e": { type: "witness", witness: "indexOf", impl: 1, spec: "E" },
    "cse331-w1-l2-break-it.ignores-hi-vs-d": { type: "witness", witness: "indexOf", impl: 3, spec: "D" },
    "cse331-w1-l2-break-it.count-wrong-impl4": { type: "witness", witness: "count", impl: 4 },
    "cse331-w1-l2-compare-five.b-vs-c": s("incomparable", [
      m("stronger|weaker|s|w", "order-by-name", "On an array with x twice, the smallest and largest matches differ. Can one implementation meet both B and C there?"),
    ]),
    "cse331-w1-l2-compare-five.b-vs-d": s("stronger", [
      m("weaker|w", "looser-is-stronger", "Which promises more: the smallest match, or some match? The one that promises more is met by fewer implementations."),
      m("incomparable|neither|---", "same-pre-means-same", "Same precondition, so compare only the postconditions. Is every smallest match some match?"),
    ]),
    "cse331-w1-l2-compare-five.d-vs-a": s("stronger", [
      m("weaker|w", "pre-direction", "The rule has two halves. Which way does a precondition that asks more of the client push a specification?"),
      m("incomparable|neither|---", "pre-ignored", "Where x occurs, A and D promise the same thing. Where it doesn't, which one still promises something?"),
    ]),
    "cse331-w1-l2-compare-five.e-vs-b": s("incomparable", [
      m("stronger|weaker|s|w", "throw-equals-minus-one", "Where x is absent, one promises -1 and the other an exception. Can one implementation keep both?"),
    ]),
    "cse331-w1-l2-compare-five.a-vs-e": s("weaker", [
      m("stronger|s", "pre-direction", "A asks more of its client than E does. Does that make A promise more, or less?"),
      m("incomparable|neither|---", "pre-ignored", "Check the rule: compare the preconditions first, then the postconditions where A's precondition holds."),
    ]),
    "cse331-w1-l2-maxlist-spec.empty-list": { type: "text", answer: "IndexOutOfBoundsException|java.lang.IndexOutOfBoundsException|throws IndexOutOfBoundsException|throws an IndexOutOfBoundsException", misconceptions: [
      m("NoSuchElementException|java.util.NoSuchElementException", "spec-vs-code", "That's what a @throws specification might promise. The question asks what the code shown does now."),
      m("0|returns 0|null|returns null", "empty-returns-default", "The method's first line asks for element 0. Is there one?"),
      m("ArrayIndexOutOfBoundsException|java.lang.ArrayIndexOutOfBoundsException", "list-vs-array", "list is a List, not an array. List.get throws a different, more general exception."),
    ] },
    "cse331-w1-l2-maxlist-spec.throws-version": s("stronger", [
      m("weaker|w", "pre-direction", "The @throws version asks less of the client and promises the same on every nonempty list. Use the rule."),
      m("incomparable|neither|---|same", "pre-ignored", "Compare the preconditions first: which one asks less of the client?"),
    ]),
    "cse331-w1-l2-sign-meets.signum": { type: "set", tokens: ["S1", "S2", "S3"], answer: "S1,S2,S3", misconceptions: [
      m("S1", "strongest-only", "You stopped at the strongest specification. If an implementation meets a stronger one, what follows for the weaker ones?"),
    ] },
    "cse331-w1-l2-sign-meets.identity": { type: "set", tokens: ["S1", "S2", "S3"], answer: "S2", misconceptions: [
      m("S2,S3|S1,S2|S1,S2,S3", "sign-means-unit", "S1 and S3 ask for exactly 1 or -1. What does implementation 2 return for x = 5?"),
      m("", "none-met", "One of the specifications asks only for a number with the right sign, not exactly 1 or -1. Is x itself such a number?"),
    ] },
    "cse331-w1-l2-sign-meets.divide-by-abs": { type: "set", tokens: ["S1", "S2", "S3"], answer: "", misconceptions: [
      m("S3", "missed-min-value", "S3 doesn't care about 0, and most other ints give 1 or -1. Check the most negative int, with Java's int arithmetic."),
      m("S1,S3|S2,S3|S1,S2,S3|S1|S2|S1,S2", "missed-zero", "What does implementation 3 do when x is 0?"),
    ] },
    "cse331-w1-l2-sign-meets.min-value-witness": { type: "witness", witness: "sign", impl: 3, spec: "S3" },
    "cse331-w1-l2-sign-compare.s1-vs-s2": s("stronger", [
      m("weaker|w", "looser-is-stronger", "Which promises more about the value returned: exactly 1, or some positive number?"),
      m("incomparable|neither|---", "same-pre-means-same", "Same precondition. Are 1, -1 and 0 in particular positive, negative and zero?"),
    ]),
    "cse331-w1-l2-sign-compare.s1-vs-s3": s("stronger", [
      m("weaker|w", "pre-direction", "S3 has a precondition and S1 has none. Which asks less of the client?"),
      m("incomparable|neither|---", "pre-ignored", "Where S3's precondition holds, do S1 and S3 promise the same thing?"),
    ]),
    "cse331-w1-l2-sign-compare.s2-vs-s3": s("incomparable", [
      m("stronger|weaker|s|w", "one-axis-only", "Look for an implementation that meets one and not the other, in each direction. The exercise 2 implementations give you one."),
    ]),
    "cse331-w1-l2-sign-clients.same-sign": { type: "set", tokens: ["S1", "S2", "S3"], answer: "S1", misconceptions: [
      m("S1,S2|S1,S2,S3|S2", "values-equal-signs", "Against S2, sign(3) may be 3 and sign(5) may be 5. What does sameSign(3, 5) return then?"),
      m("S1,S3|S3", "client-breaks-pre", "sameSign has no precondition, so sameSign(0, 0) is a legal call. What call to sign does it make?"),
    ] },
    "cse331-w1-l2-sign-clients.is-positive": { type: "set", tokens: ["S1", "S2", "S3"], answer: "S1,S2", misconceptions: [
      m("S1", "values-equal-signs", "isPositive only compares with 0. Which specifications promise a positive number exactly when x is positive?"),
      m("S1,S2,S3|S1,S3", "client-breaks-pre", "isPositive must handle x = 0. Under S3, may it call sign(0)?"),
    ] },
    "cse331-w1-l2-change-spec.d-to-b-impls": { type: "set", tokens: ["1", "2", "3", "4"], answer: "4", misconceptions: [
      m("", "strengthen-safe-for-impl", "Strengthening can't break a client. Can it break an implementation that met D?"),
      m("1|1,4", "first-is-broken", "Implementation 1 returns the smallest match. Does it meet B?"),
      m("2,3,4|2,3|2|3", "never-met-d", "An implementation can only be broken by the change if it met D before it."),
    ] },
    "cse331-w1-l2-change-spec.d-to-b-clients": { type: "set", tokens: ["count", "occurs"], aliases: { occur: "occurs", contains: "occurs", "x-occurs": "occurs" }, answer: "", misconceptions: [
      m("count|occurs|count,occurs", "strengthen-breaks-client", "Strengthening keeps every promise D made. Which client could lose something it relied on?"),
    ] },
    "cse331-w1-l2-change-spec.b-to-d-impls": { type: "set", tokens: ["1", "2", "3", "4"], answer: "", misconceptions: [
      m("1|4|1,4", "weaken-breaks-impl", "Weakening makes no promise B didn't make. Does implementation 1 still keep D's promises?"),
    ] },
    "cse331-w1-l2-change-spec.b-to-d-clients": { type: "set", tokens: ["count", "occurs"], aliases: { occur: "occurs", contains: "occurs", "x-occurs": "occurs" }, answer: "count", misconceptions: [
      m("", "weaken-safe-for-client", "Weakening drops a promise. Which client relied on the word smallest?"),
      m("count,occurs|occurs", "occurs-needs-smallest", "D still promises -1 exactly when x is absent. Is that all the occurs client needs?"),
    ] },
  };
})(typeof self !== "undefined" ? self : this);
