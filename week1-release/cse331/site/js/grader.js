/* Answer checking for the CSE 331 week 1 site. Pure functions, used by app.js and tests/unit.mjs.

   Every numeric answer on this site is a Java int or long (or a count), so numbers are compared
   EXACTLY as integers with BigInt. There is no tolerance: -2147483648 and -2147483647 are different
   answers, and so are 9223372036854775807 and 9223372036854775806. Nothing on this site has a
   non-integer numeric answer, so no tolerance-based grader exists.

   grade(spec, raw) -> { status: "correct" | "incorrect" | "unreadable", normalized, feedbackKind, message }
   spec: { type, answer, accept?, misconceptions? }
     type "int":     answer is an integer string. Accepts 1,000 / 1_000 / unicode minus. Rejects 1e3, 2.0, 0x10.
     type "text":    answer is "a|b" alternatives; compared after trimming, case folding and collapsing spaces.
                     For program output (Got [3, 4, 5]) spacing inside brackets is normalized too.
     type "yesno":   answer "yes" or "no".
     type "letters": answer is a set of letters, e.g. "ABC"; order and separators don't matter.
     type "choice":  answer is an option id (multiple choice).
     type "strength": stronger / weaker / incomparable (also S, W, ---, neither); answer is the canonical word.
     type "set":     a set drawn from spec.tokens (e.g. S1 S2 S3, or 1 2 3 4); "none" is the empty set.
                     answer is the canonical comma list in token order ("" for none).
     type "witness": a counterexample call, graded by running the lecture's code (needs window.SpecSim):
                     right when the call keeps the spec's precondition and the implementation breaks
                     its promise. Many answers are right; the grader never compares against one key.
   misconceptions: [{ when, kind, message }] where `when` is a normalized value (or "a|b") that signals a
   known wrong idea. Messages name the idea without giving the answer. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Grader = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Returns the canonical decimal string of a whole number, or null.
  function normalizeInt(raw) {
    let s = String(raw ?? "").trim().replace(/[−–—]/g, "-").replace(/^\+/, "");
    if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
    if (/^-?\d+(_\d+)+$/.test(s)) s = s.replace(/_/g, "");
    s = s.replace(/^(-?)\s+/, "$1");
    if (!/^-?\d+$/.test(s)) return null;
    return BigInt(s).toString(); // strips leading zeros and turns -0 into 0
  }
  const sameInt = (a, b) => {
    const x = normalizeInt(a), y = normalizeInt(b);
    return x !== null && y !== null && BigInt(x) === BigInt(y);
  };

  const normalizeText = (raw) => String(raw ?? "")
    .trim()
    .replace(/[−–—]/g, "-")
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\[\s*/g, "[").replace(/\s*\]/g, "]").replace(/\s*,\s*/g, ", ")
    .replace(/[.;]$/, "")
    .toLowerCase();

  const normalizeYesNo = (raw) => {
    const w = String(raw ?? "").trim().toLowerCase();
    if (/^(y|yes|yeah|true|holds|it holds)$/.test(w)) return "yes";
    if (/^(n|no|nope|false|does not|doesn't|it does not hold)$/.test(w)) return "no";
    return null;
  };

  const normalizeLetters = (raw, allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ") => {
    const s = String(raw ?? "").toUpperCase();
    if (/\b(NONE|NEITHER)\b/.test(s) && !/[A-Z]{2,}/.test(s.replace(/\b(NONE|NEITHER|AND|OR)\b/g, ""))) return "";
    const cleaned = s.replace(/\b(AND|OR|ONLY|SPEC|SPECS|IMPLEMENTATION|IMPL)\b/g, " ");
    if (/[^A-Z0-9,;\s/&+]/.test(cleaned)) return null;
    const letters = cleaned.replace(/[^A-Z]/g, "");
    if ([...letters].some((c) => !allowed.includes(c))) return null;
    return [...new Set(letters)].sort().join("");
  };

  function normalizeStrength(raw) {
    const w = String(raw ?? "").trim().toLowerCase().replace(/[.!]$/, "");
    if (!w) return null;
    if (/^(-{2,3}|—|incomparable|neither|not comparable|neither stronger nor weaker)$/.test(w) || /\bincomparable\b/.test(w)) return "incomparable";
    if (/^(s|stronger|is stronger|strictly stronger)$/.test(w) || (/\bstronger\b/.test(w) && !/\bweaker\b/.test(w))) return "stronger";
    if (/^(w|weaker|is weaker|strictly weaker)$/.test(w) || (/\bweaker\b/.test(w) && !/\bstronger\b/.test(w))) return "weaker";
    if (/^(same|equal|equivalent|the same)$/.test(w)) return "same";
    return null;
  }

  function normalizeSet(raw, tokens, aliases = {}) {
    let s = String(raw ?? "").trim().toLowerCase();
    if (!s) return null;
    if (/^(none|neither|nothing|no ?one|-|—|0 of them|{}|\[\])$/.test(s)) return "";
    const parts = s.split(/[\s,;/&+]+|\band\b|\bimplementations?\b|\bimpl\b|\bspecs?\b/).map((t) => t.replace(/^#/, "")).filter(Boolean)
      .map((t) => aliases[t] || t); // whole-token aliases only, so "occurs" never becomes "occurss"
    const lower = tokens.map((t) => t.toLowerCase());
    const out = new Set();
    for (const p of parts) {
      const i = lower.indexOf(p);
      if (i === -1) return null;
      out.add(tokens[i]);
    }
    return tokens.filter((t) => out.has(t)).join(",");
  }

  function normalizeFor(spec, raw) {
    switch (spec.type) {
      case "int": return normalizeInt(raw);
      case "text": return String(raw ?? "").trim() ? normalizeText(raw) : null;
      case "yesno": return normalizeYesNo(raw);
      case "letters": return normalizeLetters(raw, spec.allowed);
      case "choice": return raw == null || raw === "" ? null : String(raw);
      case "strength": return normalizeStrength(raw);
      case "set": return normalizeSet(raw, spec.tokens, spec.aliases);
      case "witness": return normalizeWitness(spec, raw);
      default: throw new Error(`unknown answer type ${spec.type}`);
    }
  }

  const sim = () => (typeof SpecSimRef !== "undefined" && SpecSimRef) || (typeof self !== "undefined" && self.SpecSim) || null;
  let SpecSimRef = null;
  function normalizeWitness(spec, raw) {
    const S = sim();
    if (spec.witness === "sign") {
      const n = normalizeInt(raw);
      if (n === null || BigInt(n) < -2147483648n || BigInt(n) > 2147483647n) return null;
      return n;
    }
    const call = spec.witness === "count" ? S.parseArrayX(raw) : S.parseCall(raw);
    return call && !call.error ? call.normalized : null;
  }
  // Runs the lecture's code. Returns { ok, kind, message } without revealing a counterexample.
  function judgeWitness(spec, normalized) {
    const S = sim();
    if (spec.witness === "sign") {
      const x = Number(normalized);
      const SP = S.SIGN_SPECS[spec.spec];
      const o = S.sign(spec.impl, x);
      if (!SP.pre(x)) return { ok: false, kind: "breaks-precondition", message: `That call breaks ${spec.spec}'s precondition, so ${spec.spec} promises nothing about it. Pick an x it allows.` };
      if (SP.ok(x, o)) return { ok: false, kind: "promise-kept", message: `Implementation ${spec.impl} returns ${S.showOutcome(o)} for that x, which ${spec.spec} allows. Look for an x where Java's int arithmetic surprises you.` };
      return { ok: true, kind: "correct", message: `Yes: implementation ${spec.impl} ${"value" in o ? `returns ${o.value}` : S.showOutcome(o)} there, which ${spec.spec} doesn't allow.` };
    }
    if (spec.witness === "count") {
      const c = S.parseArrayX(normalized.replace(/^\[([^\]]*)\],/, "{$1} "));
      const r = S.count(spec.impl, c.a, c.x);
      const truth = S.trueCount(c.a, c.x);
      if ("exception" in r.result) return { ok: false, kind: "impl-throws", message: `count stopped with ${S.showOutcome(r.result)}. Implementation ${spec.impl} shouldn't throw here; check your array.` };
      if (r.result.value === truth) return { ok: false, kind: "promise-kept", message: `With implementation ${spec.impl}, count returns ${truth}, which is right for that array. Where does each later search start?` };
      return { ok: true, kind: "correct", message: `Yes: count returns ${r.result.value}, but x occurs ${truth} times. Implementation ${spec.impl} meets D, so count is wrong against D.` };
    }
    const c = S.parseCall(normalized.replace(/^\[([^\]]*)\],/, "{$1} "));
    const o = S.indexOf(spec.impl, c.a, c.lo, c.hi, c.x);
    const j = S.judgeCall(spec.spec, c.a, c.lo, c.hi, c.x, o);
    if (j.verdict === "vacuous") return { ok: false, kind: "breaks-precondition", message: `That call breaks ${spec.spec}'s precondition (0 <= lo <= hi <= a.length${spec.spec === "A" ? ", and x in the range" : ""}), so ${spec.spec} promises nothing about it. A counterexample has to be a call the specification covers.` };
    if (j.verdict === "kept") return { ok: false, kind: "promise-kept", message: `Implementation ${spec.impl} ${"value" in o ? `returns ${o.value}` : S.showOutcome(o)} on that call, which keeps ${spec.spec}'s promise. Try a different array or x.` };
    const did = "value" in o ? `returns ${o.value}` : S.showOutcome(o);
    return { ok: true, kind: "correct", message: `Counterexample: implementation ${spec.impl} ${did}, but ${spec.spec} promises ${j.want}.` };
  }

  const UNREADABLE = {
    int: "Type a whole number, like 12 or -5. (Commas like 1,000 are fine.)",
    text: "Type an answer first.",
    yesno: "Answer yes or no. Put your reasons in the work box.",
    letters: "Type the letters only, like AC, or none.",
    choice: "Pick an option first.",
    strength: "Answer stronger, weaker or incomparable.",
    set: "List the ones that apply, separated by commas, or type none.",
    witness: "Type a call like {5, 1, 5}, 0, 3, 5 (the array, then lo, hi and x).",
  };

  function equal(spec, norm, ans) {
    if (spec.type === "int") return sameInt(norm, ans);
    if (ans === "" && (spec.type === "set" || spec.type === "letters")) return norm === ""; // "" is the empty set
    return norm === normalizeFor(spec, ans);
  }

  function grade(spec, raw) {
    const normalized = normalizeFor(spec, raw);
    if (normalized === null) {
      const msg = spec.witness === "sign" ? "Type one int value of x, like -7." : spec.witness === "count" ? "Type an array and then x, like {5, 1, 5}, 5." : UNREADABLE[spec.type];
      return { status: "unreadable", normalized: null, feedbackKind: "unreadable", message: msg };
    }
    if (spec.type === "witness") {
      const j = judgeWitness(spec, normalized);
      return { status: j.ok ? "correct" : "incorrect", normalized, feedbackKind: j.kind, message: j.message };
    }
    const answers = String(spec.answer).split("|");
    if (answers.some((a) => equal(spec, normalized, a))) return { status: "correct", normalized, feedbackKind: "correct", message: "Correct." };
    for (const m of spec.misconceptions || []) {
      const whens = String(m.when).split("|");
      if (whens.some((w) => equal(spec, normalized, w))) return { status: "incorrect", normalized, feedbackKind: m.kind, message: m.message };
    }
    return { status: "incorrect", normalized, feedbackKind: "incorrect", message: spec.wrongMessage || "Not quite. Try again, or ask for a hint." };
  }

  return { normalizeInt, sameInt, normalizeText, normalizeYesNo, normalizeLetters, normalizeStrength, normalizeSet, normalizeFor, grade, useSpecSim(s) { SpecSimRef = s; } };
});
