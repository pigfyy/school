/* Answer keys and misconception feedback, keyed by part ID (problems), quick-check ID or quiz ID.
   Kept out of the page markup; core/app.js reads them through window.WEEK.keys.
   Every answer that is program output, an exit status or a line of Sum.java was checked against real runs of
   checks/cse331/w02/java/Sum.java (checks/cse331/w02/verify.mjs runs the simulator against Java; checks/cse331/w02/verify.mjs checks each key
   against the simulator). Misconception messages name the likely wrong idea without giving the answer.
   For multiple choice, `answer` is the correct option's data-option id. */
(function (root) {
  "use strict";
  const m = (when, kind, message) => ({ when, kind, message });
  const SORT_WHY = {
    described: "the manual (lines 5–19) says what this run does",
    silent: "the manual says nothing about this response",
    contradicted: "the run goes against something the manual says",
  };

  root.WEEK = root.WEEK || {};
  root.WEEK.keys = {
    /* ================================================================ quick checks */
    "cse331-w2-l3-qc-junit-kind": { type: "text", answer: "automated|automated testing|automatic|automated test", misconceptions: [
      m("manual|manual testing", "junit-is-manual", "In manual testing a person runs the program and watches. Who runs and checks a JUnit test?"),
      m("ai|ai testing", "automated-means-ai", "The slide says no AI is involved. What does run and check it, every time?"),
    ] },
    "cse331-w2-l3-qc-b-vs-d": { type: "strength", answer: "stronger", misconceptions: [
      m("weaker", "fewer-words-stronger", "Same precondition, so compare only what each promises. Is the smallest match in particular some match?"),
      m("incomparable", "different-is-incomparable", "Incomparable needs an implementation meeting each and not the other. Can one meet B and not D?"),
    ] },
    "cse331-w2-l3-qc-average-of-four": { type: "output", answer: "2.5", misconceptions: [
      m("2|3", "integer-average", "Line 76 divides as a double, so nothing is rounded to a whole number here."),
      m("2.50", "default-two-digits", "No --precision was given, so line 80 prints the double with println, not printf."),
      m("10", "sum-not-average", "That's the sum. -a asks for something else."),
    ] },
    "cse331-w2-l3-qc-status-after-bad": { type: "int", answer: "1", misconceptions: [
      m("0", "redirect-hides-failure", "> moves standard output, but the run still ends the way it would without it. Did this run succeed?"),
      m("2|127", "status-guess", "Every mistake in Sum goes through fail. Which status does line 97 use?"),
    ] },
    "cse331-w2-l3-qc-message-stream": { type: "stream", answer: "stderr", misconceptions: [
      m("stdout", "message-is-result", "It's a message, not a result. Read line 96, in fail."),
    ] },
    "cse331-w2-l3-qc-hasnextint-line": { type: "int", answer: "61", misconceptions: [
      m("60", "hasnext-decides", "Line 60's hasNext() is true for any word at all. Which call asks for an int?"),
      m("65", "fail-decides", "Line 65 reports the decision. Which line makes it?"),
      m("62", "nextint-decides", "nextInt() is never reached for this word. Which line keeps it from being called?"),
    ] },
    "cse331-w2-l3-qc-nan-status": { type: "int", answer: "0", misconceptions: [
      m("1", "nan-is-failure", "Nothing called fail and nothing threw. How did main end?"),
    ] },
    "cse331-w2-l3-qc-negative-before-input": { type: "yesno", answer: "no", misconceptions: [
      m("yes", "files-first", "The argument loop runs before openInput on line 59. Where does the negative precision stop the run?"),
    ] },

    /* ================================================================ sorter: manual vs observed */
    "cse331-w2-l3-sort-file-sum": { type: "choice", answer: "described", why: SORT_WHY },
    "cse331-w2-l3-sort-too-big-integer": { type: "choice", answer: "contradicted", why: SORT_WHY },
    "cse331-w2-l3-sort-empty-sum": { type: "choice", answer: "described", why: SORT_WHY },
    "cse331-w2-l3-sort-empty-average": { type: "choice", answer: "silent", why: SORT_WHY },
    "cse331-w2-l3-sort-word-in-input": { type: "choice", answer: "silent", why: SORT_WHY },
    "cse331-w2-l3-sort-exit-status": { type: "choice", answer: "silent", why: SORT_WHY },

    /* ================================================================ quiz */
    "cse331-w2-l3-quiz-not-input": { type: "choice", answer: "exit-status" },
    "cse331-w2-l3-quiz-not-batch": { type: "choice", answer: "web-browser" },
    "cse331-w2-l3-quiz-two-files-status": { type: "int", answer: "1", misconceptions: [
      m("0", "second-file-ignored", "Sum takes only one file. What does the argument loop do with a second one?"),
      m("12", "status-is-output", "echo $? prints the exit status, not the sum."),
    ] },
    "cse331-w2-l3-quiz-precision-without-a": { type: "choice", answer: "stderr-message-status-1" },
    "cse331-w2-l3-quiz-why-stderr": { type: "choice", answer: "keep-results-separate" },
    "cse331-w2-l3-quiz-redirect-bad": { type: "choice", answer: "message-shows-file-empty" },
    "cse331-w2-l3-quiz-stack-trace-status": { type: "int", answer: "1", misconceptions: [
      m("0", "no-exit-call-means-zero", "Java chooses a status even when the program doesn't. Does a stack trace count as finishing main?"),
    ] },
    "cse331-w2-l3-quiz-nan-worse": { type: "choice", answer: "status-zero-success" },
    "cse331-w2-l3-quiz-who-has-precondition": { type: "choice", answer: "client-is-main" },
    "cse331-w2-l3-quiz-unknown-program": { type: "choice", answer: "put-in-spec" },
    "cse331-w2-l3-quiz-promises-more": { type: "choice", answer: "fewer" },

    /* ================================================================ problems */
    "cse331-w2-l3-predict-lecture1-runs.word-output": { type: "output", answer: "Sum: not an integer: three", misconceptions: [
      m("3", "skips-word", "This Sum doesn't stop quietly and add what it read. What does line 65 do?"),
      m("7", "skips-word-continues", "This Sum doesn't skip the word and carry on."),
      m("Sum: not an integer: 1 2 three 4|not an integer: three", "message-form", "Read fail on line 96: how does every message start, and what does line 65 pass it?"),
    ] },
    "cse331-w2-l3-predict-lecture1-runs.word-stream": { type: "stream", answer: "stderr", misconceptions: [
      m("stdout", "message-is-result", "It's a message, not a result. Where does fail print?"),
    ] },
    "cse331-w2-l3-predict-lecture1-runs.big-output": { type: "output", answer: "2147483648", misconceptions: [
      m("-2147483648", "int-wraps", "That's Lecture 1's Sum. What type is sum on line 57?"),
      m("Sum: not an integer: 2147483647|Sum: not an integer: 1", "too-big-input", "Each number typed fits in an int. Only their sum doesn't."),
    ] },

    "cse331-w2-l3-predict-redirect.good-terminal": { type: "output", answer: "", misconceptions: [
      m("12", "redirect-copies", "> sends standard output to the file instead of the terminal, not as well as."),
    ] },
    "cse331-w2-l3-predict-redirect.good-file": { type: "output", answer: "12" },
    "cse331-w2-l3-predict-redirect.good-status": { type: "int", answer: "0", misconceptions: [
      m("12", "status-is-output", "echo $? prints the exit status, not the result."),
    ] },
    "cse331-w2-l3-predict-redirect.bad-terminal": { type: "output", answer: "Sum: not an integer: x", misconceptions: [
      m("", "redirect-takes-both", "> moves only standard output. Where does fail print?"),
    ] },
    "cse331-w2-l3-predict-redirect.bad-file": { type: "output", answer: "", misconceptions: [
      m("Sum: not an integer: x", "redirect-takes-both", "> moves only standard output. Where does fail print?"),
      m("12", "file-keeps-old", "The shell empties the file before Sum runs."),
      m("3", "partial-sum-written", "Sum prints its result only at the end. Does this run get there?"),
    ] },
    "cse331-w2-l3-predict-redirect.bad-status": { type: "int", answer: "1", misconceptions: [
      m("0", "redirect-hides-failure", "The redirection worked, but did Sum's run succeed?"),
    ] },

    "cse331-w2-l3-predict-no-negative-check.format": { type: "output", answer: "%.-1f%n|%.-1f", misconceptions: [
      m("%.1f%n|%.1f", "sign-dropped", "Concatenating an int keeps its minus sign."),
      m("%.2f%n|%.2f", "wrong-precision", "Which precision did the command give?"),
    ] },
    "cse331-w2-l3-predict-no-negative-check.exception": { type: "text", answer: "UnknownFormatConversionException|java.util.UnknownFormatConversionException", misconceptions: [
      m("IllegalFormatPrecisionException|java.util.IllegalFormatPrecisionException", "precision-exception", "A reasonable guess, but printf never gets as far as reading a precision. Run the copy to see which exception it is."),
      m("NumberFormatException|java.lang.NumberFormatException", "parse-exception", "parseInt accepted -1 without complaint. The trouble comes later, in printf."),
      m("ArithmeticException|java.lang.ArithmeticException", "division", "The division on line 76 is fine here. Look at line 78."),
    ] },
    "cse331-w2-l3-predict-no-negative-check.line": { type: "int", answer: "78", misconceptions: [
      m("40|41|42|43", "blank-line-throws", "Those lines are blank in this copy. Where is the precision used?"),
      m("76", "division", "Line 76 divides two numbers that are fine. Which line uses the precision?"),
    ] },
    "cse331-w2-l3-predict-no-negative-check.status": { type: "int", answer: "1", misconceptions: [
      m("0", "no-exit-call-means-zero", "Java sets a status even when the program doesn't choose one. Did main finish?"),
    ] },

    "cse331-w2-l3-repair-manual.error-status": { type: "int", answer: "1", misconceptions: [
      m("0", "error-status-zero", "0 means success. Read line 97."),
      m("2", "usage-status", "That's exercise 5's design for argument mistakes. Today's Sum uses one status for every mistake; read line 97."),
    ] },
    "cse331-w2-l3-repair-manual.message-stream": { type: "stream", answer: "stderr", misconceptions: [
      m("stdout", "message-is-result", "Read line 96, in fail."),
    ] },
    "cse331-w2-l3-repair-manual.smallest-int": { type: "int", answer: "-2147483648", misconceptions: [
      m("-2147483647", "off-by-one-range", "An int's range isn't symmetric. Check -2^31."),
      m("-9223372036854775808", "long-range", "sum is a long, but each number is read with hasNextInt and nextInt."),
      m("0|1", "non-negative", "Negative numbers are integers too, and hasNextInt accepts them."),
    ] },
    "cse331-w2-l3-repair-manual.empty-sum": { type: "output", answer: "0", misconceptions: [
      m("", "empty-prints-nothing", "Without -a, nothing stops Sum before line 83. What is sum there?"),
      m("Sum: cannot average zero values", "empty-is-error", "That message is for -a. This run has no -a."),
      m("0.0|NaN", "average-format", "Without -a, line 83 prints the long sum."),
    ] },

    "cse331-w2-l3-misleading-message.dashes-missing": { type: "output", answer: "Sum: too many file arguments: nums.txt", misconceptions: [
      m("Sum: unknown option: precision=4", "dash-not-needed", "Line 44 asks whether the argument starts with a dash. Does precision=4?"),
      m("Sum: could not read input: precision=4 (No such file or directory)", "file-opened-early", "That's what precision=4 alone prints. Here a second argument comes first: the loop finishes before any file is opened."),
      m("12", "option-ignored", "The loop doesn't skip arguments it doesn't understand."),
    ] },
    "cse331-w2-l3-misleading-message.precision-too-big": { type: "output", answer: "Sum: --precision must be an integer, got: 2147483648", misconceptions: [
      m("Sum: --precision must not be negative, got: -2147483648", "parse-wraps", "parseInt doesn't wrap around; it refuses. Which catch block runs?"),
      m("Sum: cannot average zero values", "skips-to-input", "The argument loop runs first. Does this argument get past line 35?"),
    ] },

    "cse331-w2-l3-split-sum.relies-on": { type: "letters", allowed: "ABCDEFG", answer: "CG", misconceptions: [
      m("G", "forgot-precision", "The method also formats with the precision. Which value of it would break line 78?"),
      m("C", "forgot-count", "The method also divides by the count. Which value would break that?"),
      m("ABCDEFG", "all-checks", "Some checks catch the user's mistakes before anything is computed. The method never sees what they reject."),
      m("CFG|FG", "word-check", "The method gets only the sum and count, never the words. Which values could it not handle?"),
    ] },
    "cse331-w2-l3-split-sum.missing-check": { type: "yesno", answer: "yes", misconceptions: [
      m("no", "non-negative-enough", "Is every non-negative precision one the method can handle? Look at the footnote on huge precisions."),
    ] },

    "cse331-w2-l3-compare-manuals.m1-vs-m2": { type: "strength", answer: "stronger", misconceptions: [
      m("weaker", "more-text-weaker", "Which manual's versions all meet the other? Is status 1 a nonzero status?"),
      m("incomparable", "different-is-incomparable", "Incomparable needs a version meeting M1 and not M2. Can there be one?"),
      m("same", "same-for-sum", "Today's Sum meets both, but the comparison is about every version. Is there one that meets M2 and not M1?"),
    ] },
    "cse331-w2-l3-compare-manuals.status-script": { type: "choice", answer: "both", misconceptions: [
      m("m1", "stronger-only", "What does this script rely on? Does M2 promise it?"),
      m("m2", "weaker-only", "Every version that satisfies M1 also satisfies M2. Does the script work with those?"),
      m("neither", "scripts-need-everything", "The script needs only a nonzero status on a bad word."),
    ] },
    "cse331-w2-l3-compare-manuals.message-script": { type: "choice", answer: "m1", misconceptions: [
      m("both", "weaker-is-enough", "Picture a version that meets M2 by exiting with status 2 and printing nothing. What does the script report?"),
      m("m2", "weaker-only", "M2 promises nothing about a message."),
      m("neither", "scripts-need-everything", "M1 promises the exact prefix the script reads."),
    ] },

    "cse331-w2-l3-add-help.help-stream": { type: "stream", answer: "stdout", misconceptions: [
      m("stderr", "help-is-message", "The user asked for the manual and got it: is it a result or a message about a failure?"),
    ] },
    "cse331-w2-l3-add-help.help-status": { type: "int", answer: "0", misconceptions: [
      m("1|2", "help-is-failure", "Did the run do what the user asked?"),
    ] },
    "cse331-w2-l3-add-help.usage-status": { type: "int", answer: "2", misconceptions: [
      m("1", "same-status", "That works, but then a script can't tell running Sum wrong from giving it bad data. The course's answer follows GNU ls here."),
      m("0", "usage-success", "A mistake in the arguments is a failure."),
    ] },
  };
})(typeof self !== "undefined" ? self : this);
