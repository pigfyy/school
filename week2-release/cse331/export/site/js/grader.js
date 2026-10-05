/* Answer checking for the CSE 331 week 2 site. Pure functions, used by app.js and tests/unit.mjs.

   grade(spec, raw) -> { status: "correct" | "incorrect" | "unreadable", normalized, feedbackKind, message }
   spec: { type, answer, misconceptions?, wrongMessage? }; answer may list alternatives as "a|b".
     type "int":      exact whole numbers with BigInt (exit statuses, sums, line numbers). No tolerance:
                      2147483648 and 2147483647 are different answers. Accepts 1,000 / 1_000 / unicode minus;
                      rejects 1e3, 2.0, 0x10.
     type "output":   exact program output, one line. Only the ends are trimmed (and one pair of surrounding
                      quotes or backticks dropped); case, inner spaces and punctuation must match, because a
                      script reading the output would see them. answer "" means no output: the learner types
                      "nothing", "(nothing)", "empty" or "none".
     type "text":     a word or phrase; trimmed, case-folded, spaces collapsed, final period dropped.
     type "yesno":    yes or no.
     type "stream":   stdout | stderr (standard output, System.out, 1 / standard error, System.err, 2).
     type "strength": stronger | weaker | incomparable | same.
     type "letters":  a set of letters from spec.allowed, any order or separators ("none" is the empty set).
     type "choice":   an option id (multiple choice and the sorter).
   misconceptions: [{ when, kind, message }]; `when` is a normalized value (or "a|b") that signals a known
   wrong idea. Messages name the idea without giving the answer. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Grader = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function normalizeInt(raw) {
    let s = String(raw ?? "").trim().replace(/[−–—]/g, "-").replace(/^\+/, "");
    if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
    if (/^-?\d+(_\d+)+$/.test(s)) s = s.replace(/_/g, "");
    s = s.replace(/^(-?)\s+/, "$1");
    if (!/^-?\d+$/.test(s)) return null;
    return BigInt(s).toString();
  }
  const sameInt = (a, b) => {
    const x = normalizeInt(a), y = normalizeInt(b);
    return x !== null && y !== null && BigInt(x) === BigInt(y);
  };

  const EMPTY_WORDS = /^\(?\s*(nothing|empty|none|no output|nothing at all|blank|\(empty\)|it is empty|it's empty)\s*\)?\.?$/i;
  // Exact output: trim the ends, unify line endings, drop one pair of wrapping quotes/backticks.
  function normalizeOutput(raw) {
    let s = String(raw ?? "").replace(/\r\n?/g, "\n").trim();
    if (!s) return null;
    const m = /^(["'`“”‘’])([\s\S]*)(["'`“”‘’])$/.exec(s);
    if (m && s.length >= 2) s = m[2];
    if (EMPTY_WORDS.test(s.trim())) return "";
    return s.replace(/^\$\s+/, ""); // a leading "$ " prompt isn't output
  }

  const normalizeText = (raw) => {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    return s.replace(/[−–—]/g, "-").replace(/[“”"'`]/g, "").replace(/\s+/g, " ").replace(/[.;!]$/, "").toLowerCase();
  };

  const normalizeYesNo = (raw) => {
    const w = String(raw ?? "").trim().toLowerCase().replace(/[.!]$/, "");
    if (/^(y|yes|yeah|yep|true|correct)$/.test(w)) return "yes";
    if (/^(n|no|nope|false|not correct|incorrect)$/.test(w)) return "no";
    return null;
  };

  function normalizeStream(raw) {
    const w = String(raw ?? "").trim().toLowerCase().replace(/[.!]$/, "").replace(/[\s_-]+/g, " ");
    if (/^(stdout|std out|standard output|standard out|output|out|system\.out|system out|fd 1|1|the standard output)$/.test(w)) return "stdout";
    if (/^(stderr|std err|standard error|standard err|error|err|system\.err|system err|fd 2|2|the standard error)$/.test(w)) return "stderr";
    return null;
  }

  function normalizeStrength(raw) {
    const w = String(raw ?? "").trim().toLowerCase().replace(/[.!]$/, "");
    if (!w) return null;
    if (/^(-{2,3}|—|incomparable|neither|not comparable|neither stronger nor weaker)$/.test(w) || /\bincomparable\b/.test(w)) return "incomparable";
    if (/^(s|stronger|is stronger|strictly stronger|m1|m1 is stronger)$/.test(w) || (/\bstronger\b/.test(w) && !/\bweaker\b/.test(w))) return "stronger";
    if (/^(w|weaker|is weaker|strictly weaker)$/.test(w) || (/\bweaker\b/.test(w) && !/\bstronger\b/.test(w))) return "weaker";
    if (/^(same|equal|equivalent|the same)$/.test(w)) return "same";
    return null;
  }

  function normalizeLetters(raw, allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    const s = String(raw ?? "").toUpperCase().trim();
    if (!s) return null;
    if (/^(NONE|NEITHER|NOTHING|-)$/.test(s)) return "";
    const cleaned = s.replace(/\b(AND|OR|ONLY)\b/g, " ");
    if (/[^A-Z,;\s/&+]/.test(cleaned)) return null;
    const letters = cleaned.replace(/[^A-Z]/g, "");
    if (!letters || [...letters].some((c) => !allowed.includes(c))) return null;
    return [...new Set(letters)].sort().join("");
  }

  function normalizeFor(spec, raw) {
    switch (spec.type) {
      case "int": return normalizeInt(raw);
      case "output": return normalizeOutput(raw);
      case "text": return normalizeText(raw);
      case "yesno": return normalizeYesNo(raw);
      case "stream": return normalizeStream(raw);
      case "strength": return normalizeStrength(raw);
      case "letters": return normalizeLetters(raw, spec.allowed);
      case "choice": return raw == null || raw === "" ? null : String(raw);
      default: throw new Error(`unknown answer type ${spec.type}`);
    }
  }

  const UNREADABLE = {
    int: "Type a whole number, like 12 or -5.",
    output: "Type the output exactly as the program prints it, or nothing if it prints nothing.",
    text: "Type an answer first.",
    yesno: "Answer yes or no. Put your reasons in the work box.",
    stream: "Answer standard output or standard error.",
    strength: "Answer stronger, weaker, incomparable or the same.",
    letters: "Type the letters only, like BG, or none.",
    choice: "Pick an option first.",
  };

  function equal(spec, norm, ans) {
    if (spec.type === "int") return sameInt(norm, ans);
    if (spec.type === "output") return norm === ans; // exact
    if (spec.type === "letters" && ans === "") return norm === "";
    return norm === normalizeFor(spec, ans);
  }

  function grade(spec, raw) {
    const normalized = normalizeFor(spec, raw);
    if (normalized === null) return { status: "unreadable", normalized: null, feedbackKind: "unreadable", message: UNREADABLE[spec.type] };
    const answers = String(spec.answer).split("|");
    if (answers.some((a) => equal(spec, normalized, a))) return { status: "correct", normalized, feedbackKind: "correct", message: "Correct." };
    for (const m of spec.misconceptions || []) {
      if (String(m.when).split("|").some((w) => equal(spec, normalized, w))) return { status: "incorrect", normalized, feedbackKind: m.kind, message: m.message };
    }
    if (spec.type === "output" && answers.some((a) => a.toLowerCase().replace(/\s+/g, " ") === normalized.toLowerCase().replace(/\s+/g, " "))) {
      return { status: "incorrect", normalized, feedbackKind: "output-near-miss", message: "Close, but program output must match exactly: check capital letters and spacing." };
    }
    return { status: "incorrect", normalized, feedbackKind: "incorrect", message: spec.wrongMessage || "Not quite. Try again, or ask for a hint." };
  }

  return { normalizeInt, sameInt, normalizeOutput, normalizeText, normalizeYesNo, normalizeStream, normalizeStrength, normalizeLetters, normalizeFor, grade };
});
