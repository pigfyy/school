/* CSE 331 week 5: the few answer keys the markup cannot carry. Section 4's representation answers are sets drawn
   from the representations 1, 2 and 3; the set grader needs its tokens. Everything else is in index.html. */
(function (root) {
  "use strict";
  const REPS = { tokens: ["1", "2", "3"] };
  root.WEEK = root.WEEK || {};
  root.WEEK.keys = {
    "cse331-w5-s4-qc-bs": REPS,
    "cse331-w5-s4-grid.bs": REPS,
    "cse331-w5-s4-grid.loop": REPS,
    "cse331-w5-s4-grid.add": REPS,
    "cse331-w5-s4-grid.remove": REPS,
  };
})(typeof self !== "undefined" ? self : this);
