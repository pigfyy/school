"use strict";
/*
  Exact answer grader for the CSE 312 week 1 site.

  Every number is an exact rational p/q with BigInt parts, so 13!^4, 5^32 or C(36,4) are compared
  digit for digit. There is no relative tolerance anywhere for exact answers; a tolerance applies only
  when an answer spec explicitly asks for one (type "decimal").

  Accepted syntax:  12  65,780  3.5  + - * / ^ (or **)  !  ( )  implicit multiplication (3(2), n!m!, 2n, nm)
  Implicit multiplication binds looser than ^ and !, like "*": nm^2 = n·m², nm! = n·m!, 2^3 4 = 2³·4.
                    C(n,k) = binom(n,k) = choose(n,k)   P(n,k)   × · ÷ − are read as * * / -
  Commas inside C(...)/P(...) separate arguments; elsewhere they must be thousands separators (65,780).

  Works in the browser (window.CSE312Grader) and in Node (require / import).
*/
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CSE312Grader = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  const MAX_FACTORIAL = 3000;
  const MAX_CHOOSE_N = 5000;
  const MAX_RESULT_BITS = 400000;

  class GradeError extends Error {}

  /* ---------------------------------------------------------------- rationals */
  const babs = (a) => (a < 0n ? -a : a);
  function gcd(a, b) {
    a = babs(a); b = babs(b);
    while (b) [a, b] = [b, a % b];
    return a;
  }
  function rat(n, d = 1n) {
    if (d === 0n) throw new GradeError("Division by zero.");
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d) || 1n;
    return { n: n / g, d: d / g };
  }
  const isInt = (r) => r.d === 1n;
  const add = (a, b) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
  const sub = (a, b) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
  const mul = (a, b) => rat(a.n * b.n, a.d * b.d);
  const div = (a, b) => {
    if (b.n === 0n) throw new GradeError("Division by zero.");
    return rat(a.n * b.d, a.d * b.n);
  };
  const eq = (a, b) => a.n === b.n && a.d === b.d;
  const bits = (x) => babs(x).toString(2).length;
  function checkSize(r) {
    if (bits(r.n) + bits(r.d) > MAX_RESULT_BITS) throw new GradeError("That number is too large to check exactly.");
    return r;
  }

  const factCache = [1n];
  function factBig(k) {
    for (let i = factCache.length; i <= k; i++) factCache[i] = factCache[i - 1] * BigInt(i);
    return factCache[k];
  }
  function smallInt(r, what, max) {
    if (!isInt(r)) throw new GradeError(`${what} needs a whole number.`);
    if (r.n < 0n) throw new GradeError(`${what} needs a number that is 0 or more.`);
    if (r.n > BigInt(max)) throw new GradeError(`${what} is too large to check exactly.`);
    return Number(r.n);
  }
  function factorial(r) {
    return rat(factBig(smallInt(r, "Factorial", MAX_FACTORIAL)));
  }
  function choose(nr, kr) {
    if (!isInt(kr)) throw new GradeError("C(n, k) needs whole numbers.");
    const n = smallInt(nr, "C(n, k)", MAX_CHOOSE_N);
    if (kr.n < 0n || kr.n > BigInt(n)) return rat(0n);
    let k = Number(kr.n);
    k = Math.min(k, n - k);
    let num = 1n;
    for (let i = 0; i < k; i++) num = (num * BigInt(n - i)) / BigInt(i + 1);
    return rat(num);
  }
  function perm(nr, kr) {
    if (!isInt(kr)) throw new GradeError("P(n, k) needs whole numbers.");
    const n = smallInt(nr, "P(n, k)", MAX_CHOOSE_N);
    if (kr.n < 0n || kr.n > BigInt(n)) return rat(0n);
    let out = 1n;
    for (let i = 0; i < Number(kr.n); i++) out *= BigInt(n - i);
    return rat(out);
  }
  function power(base, ex) {
    if (!isInt(ex)) throw new GradeError("Exponents must be whole numbers here.");
    const e = ex.n;
    if (babs(e) > 100000n) throw new GradeError("That exponent is too large to check exactly.");
    if (base.n === 0n && e < 0n) throw new GradeError("Division by zero.");
    const eAbs = Number(babs(e));
    if ((bits(base.n) + bits(base.d)) * eAbs > MAX_RESULT_BITS && babs(base.n) > 1n) {
      throw new GradeError("That number is too large to check exactly.");
    }
    const r = rat(base.n ** BigInt(eAbs), base.d ** BigInt(eAbs));
    return e < 0n ? div(rat(1n), r) : r;
  }

  /* ---------------------------------------------------------------- tokenizer */
  const FUNCS = { c: "C", binom: "C", choose: "C", p: "P" };

  function normalizeInput(raw) {
    return String(raw)
      .replace(/[×·⋅∙✕]/g, "*")
      .replace(/÷/g, "/")
      .replace(/[−–—]/g, "-")
      .replace(/\*\*/g, "^")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(src) {
    const toks = [];
    const parenStack = []; // true = this "(" opened a function call
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === " ") { i++; continue; } // a space separates tokens: "2^3 4" is 2^3·4, "n m" is n·m
      if (/[0-9.]/.test(ch)) {
        let j = i;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
        let text = src.slice(i, j);
        const inCall = parenStack.length && parenStack[parenStack.length - 1];
        if (!inCall && /^\d{1,3}$/.test(text)) {
          // thousands separators: 65,780 or 1,437,004,800
          while (src[j] === "," && /^\d{3}(?!\d)/.test(src.slice(j + 1, j + 5))) {
            text += src.slice(j + 1, j + 4);
            j += 4;
          }
        }
        if (src[j] === ".") {
          let k = j + 1;
          while (k < src.length && /[0-9]/.test(src[k])) k++;
          text += src.slice(j, k);
          j = k;
        }
        if (text === "." || /\..*\./.test(text)) throw new GradeError("Couldn't read a number.");
        toks.push({ t: "num", v: text });
        i = j;
        continue;
      }
      if (/[a-zA-Z]/.test(ch)) {
        let j = i;
        while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
        const word = src.slice(i, j);
        let k = j;
        while (src[k] === " ") k++;
        // A run of letters is a product of single-letter variables, one token per letter, so "nm^2" is n·m² and
        // "nm!" is n·m! (postfix and powers bind tighter than implicit multiplication). If the run ends in a
        // function name followed by "(", that part is a call: C(…), P(…), binom(…), choose(…); "mC(n,2)" is m·C(n,2).
        let vars = word, fname = null;
        if (src[k] === "(") {
          const hit = Object.keys(FUNCS).sort((x, y) => y.length - x.length).find((f) => word.toLowerCase().endsWith(f));
          if (hit) { fname = word.slice(word.length - hit.length); vars = word.slice(0, word.length - hit.length); }
        }
        for (const letter of vars) toks.push({ t: "id", v: letter, word });
        if (fname) toks.push({ t: "id", v: fname, fn: true });
        i = j;
        continue;
      }
      if ("+-*/^!(),".includes(ch)) {
        if (ch === "(") {
          const prev = toks[toks.length - 1];
          parenStack.push(Boolean(prev && prev.t === "id" && prev.fn));
        } else if (ch === ")") parenStack.pop();
        else if (ch === "," && !(parenStack.length && parenStack[parenStack.length - 1])) {
          throw new GradeError("Commas only go inside C(n,k) or P(n,k), or between groups of three digits like 65,780.");
        }
        toks.push({ t: ch });
        i++;
        continue;
      }
      throw new GradeError(`Couldn't read "${ch}".`);
    }
    return toks;
  }

  function numToRat(text) {
    if (!text.includes(".")) return rat(BigInt(text));
    const [w, f] = text.split(".");
    return rat(BigInt((w || "0") + f), 10n ** BigInt(f.length));
  }

  /* ---------------------------------------------------------------- parser + evaluator */
  function evaluate(raw, vars = {}) {
    const src = normalizeInput(raw);
    if (!src) throw new GradeError("Type an answer first.");
    const toks = tokenize(src);
    let p = 0;
    const peek = () => toks[p];
    const take = (t) => {
      if (!toks[p] || toks[p].t !== t) throw new GradeError(t === ")" ? "A parenthesis isn't closed." : "Couldn't read that expression.");
      return toks[p++];
    };
    const startsPrimary = (tok) => tok && (tok.t === "num" || tok.t === "id" || tok.t === "(");

    function expr() {
      let v = term();
      while (peek() && (peek().t === "+" || peek().t === "-")) {
        const op = toks[p++].t;
        const r = term();
        v = checkSize(op === "+" ? add(v, r) : sub(v, r));
      }
      return v;
    }
    function term() {
      let v = unary();
      for (;;) {
        const tok = peek();
        if (tok && (tok.t === "*" || tok.t === "/")) {
          p++;
          const r = unary();
          v = checkSize(tok.t === "*" ? mul(v, r) : div(v, r));
        } else if (startsPrimary(tok)) {
          v = checkSize(mul(v, unary())); // implicit multiplication
        } else return v;
      }
    }
    function unary() {
      if (peek() && peek().t === "-") { p++; const v = unary(); return rat(-v.n, v.d); }
      if (peek() && peek().t === "+") { p++; return unary(); }
      return pow();
    }
    function pow() {
      const base = postfix();
      if (peek() && peek().t === "^") {
        p++;
        return checkSize(power(base, unary())); // right-associative
      }
      return base;
    }
    function postfix() {
      let v = primary();
      while (peek() && peek().t === "!") { p++; v = factorial(v); }
      return v;
    }
    function primary() {
      const tok = peek();
      if (!tok) throw new GradeError("The expression ends too early.");
      if (tok.t === "num") { p++; return numToRat(tok.v); }
      if (tok.t === "(") { p++; const v = expr(); take(")"); return v; }
      if (tok.t === "id") {
        p++;
        const fn = tok.fn && FUNCS[tok.v.toLowerCase()];
        if (fn && peek() && peek().t === "(") {
          take("(");
          const a = expr();
          take(",");
          const b = expr();
          take(")");
          return fn === "C" ? choose(a, b) : perm(a, b);
        }
        // a single-letter variable (the tokenizer splits "nm" into n, m); "!" and "^" are applied by the callers
        if (!(tok.v in vars)) {
          const names = Object.keys(vars);
          throw new GradeError(names.length ? `Unknown name "${tok.v}". Use ${names.join(", ")}.` : `Unknown name "${tok.word || tok.v}". Use numbers only here.`);
        }
        return vars[tok.v];
      }
      throw new GradeError("Couldn't read that expression.");
    }

    const v = expr();
    if (p !== toks.length) throw new GradeError(toks[p].t === ")" ? "There's an extra closing parenthesis." : "Couldn't read that expression.");
    return v;
  }

  function toVars(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) out[k] = typeof v === "object" ? v : numToRat(String(v));
    return out;
  }

  function tryEval(raw, vars) {
    try { return { ok: true, value: evaluate(raw, toVars(vars)) }; }
    catch (e) {
      if (e instanceof GradeError) return { ok: false, error: e.message };
      if (e instanceof RangeError) return { ok: false, error: "That number is too large to check exactly." };
      throw e;
    }
  }

  /* ---------------------------------------------------------------- formatting */
  function groupDigits(s) {
    const neg = s.startsWith("-");
    const d = neg ? s.slice(1) : s;
    return (neg ? "-" : "") + d.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function toCanonical(r) { return isInt(r) ? r.n.toString() : `${r.n}/${r.d}`; }
  function format(r) {
    if (!isInt(r)) return `${groupDigits(r.n.toString())}/${groupDigits(r.d.toString())}`;
    const s = r.n.toString();
    const digits = s.replace("-", "").length;
    if (digits <= 40) return groupDigits(s);
    return `${s.slice(0, s.startsWith("-") ? 5 : 4)}… (a ${digits}-digit number)`;
  }

  function varCombos(vars) {
    return Object.entries(vars || {}).reduce(
      (acc, [name, values]) => acc.flatMap((c) => values.map((v) => ({ ...c, [name]: v }))),
      [{}],
    );
  }

  /*
    grade(spec, raw) → { ok: true | false | null, normalized, value?, error?, detail?, misconception? }
      ok === null means "couldn't read it / empty", not a wrong answer.
    spec = {
      type: "exact" (default) | "formula" | "yesno" | "decimal" | "self",
      answer: "C(26,5)",               exact/decimal/formula key (never shown to the student)
      vars: { n: [1,2,5], m: [1,3] },   formula only: values to test at
      tolerance: 0.001,                 decimal only: absolute tolerance
      integer: true,                    exact only: reject non-integers with a clear message
      miscon: [{ expr, tag, msg }],     exact values (or formulas) that signal a known mistake
    }
  */
  function grade(spec, raw) {
    const text = String(raw ?? "").trim();
    const type = spec.type || "exact";
    if (type === "self") return { ok: null, normalized: text, selfCheck: true };
    if (!text) return { ok: null, normalized: "", error: "Type an answer first.", feedbackKind: "empty" };

    if (type === "yesno") {
      const w = text.toLowerCase().replace(/[^a-z]/g, "");
      const norm = /^(y|yes|yeah|true)$/.test(w) ? "yes" : /^(n|no|false)$/.test(w) ? "no" : null;
      if (!norm) return { ok: null, normalized: "", error: "Answer yes or no, and put your reasoning in the work box.", feedbackKind: "unparseable" };
      return { ok: norm === String(spec.answer).toLowerCase(), normalized: norm };
    }

    if (type === "formula") {
      const combos = varCombos(spec.vars).filter((c) => tryEval(spec.answer, c).ok);
      if (!combos.length) throw new Error(`Formula key ${spec.answer} has no valid test points`);
      const probe = tryEval(text, combos[combos.length - 1]);
      if (!probe.ok) return { ok: null, normalized: "", error: probe.error, feedbackKind: "unparseable" };
      const normalized = normalizeInput(text).toLowerCase().replace(/ /g, "");
      for (const c of combos) {
        const want = tryEval(spec.answer, c).value;
        const got = tryEval(text, c);
        if (!got.ok || !eq(got.value, want)) {
          const mis = matchMisconception(spec, text, combos);
          const at = Object.entries(c).map(([k, x]) => `${k} = ${x}`).join(", ");
          return {
            ok: false,
            normalized,
            misconception: mis,
            detail: `It doesn't hold for ${at}: yours gives ${got.ok ? format(got.value) : "no number"}. Try that small case by hand.`,
          };
        }
      }
      return { ok: true, normalized };
    }

    const got = tryEval(text);
    if (!got.ok) return { ok: null, normalized: "", error: got.error, feedbackKind: "unparseable" };
    const normalized = toCanonical(got.value);
    if (type === "decimal") {
      const want = tryEval(spec.answer).value;
      const diff = sub(got.value, want);
      const tol = numToRat(String(spec.tolerance ?? 0));
      const ok = babs(diff.n) * tol.d <= tol.n * diff.d;
      return { ok, normalized, value: format(got.value), misconception: ok ? null : matchMisconception(spec, text) };
    }
    const want = tryEval(spec.answer);
    if (!want.ok) throw new Error(`Answer key ${spec.answer} does not evaluate: ${want.error}`);
    const ok = eq(got.value, want.value);
    return {
      ok,
      normalized,
      value: format(got.value),
      misconception: ok ? null : matchMisconception(spec, text),
      notInteger: !isInt(got.value),
    };
  }

  function matchMisconception(spec, text, combos) {
    for (const m of spec.miscon || []) {
      if (combos) {
        const all = combos.every((c) => {
          const a = tryEval(text, c), b = tryEval(m.expr, c);
          return a.ok && b.ok && eq(a.value, b.value);
        });
        if (all) return { tag: m.tag, msg: m.msg };
      } else {
        const a = tryEval(text), b = tryEval(m.expr);
        if (a.ok && b.ok && eq(a.value, b.value)) return { tag: m.tag, msg: m.msg };
      }
    }
    return null;
  }

  function evalToString(raw, vars) {
    const r = tryEval(raw, vars);
    return r.ok ? toCanonical(r.value) : null;
  }

  return { grade, evaluate: (raw, vars) => evaluate(raw, toVars(vars)), tryEval, format, toCanonical, evalToString, normalizeInput, GradeError };
});
