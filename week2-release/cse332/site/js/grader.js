/* CSE 332 week 2 · grader (extends the week 1 grader with an exact asymptotic-class engine).
   Pure functions, no DOM. Loaded in the browser as window.Grader and in Node via require().
   Integers and formulas are compared EXACTLY with BigInt rationals. There is no relative tolerance anywhere;
   the only tolerance is checkDecimal(), used for answers that are genuinely non-integer decimals (dollars per day). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Grader = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ------------------------------------------------------------ exact rationals */
  const babs = (a) => (a < 0n ? -a : a);
  function gcd(a, b) { a = babs(a); b = babs(b); while (b) [a, b] = [b, a % b]; return a; }
  function Q(n, d = 1n) {
    n = BigInt(n); d = BigInt(d);
    if (d === 0n) throw new Error("division by zero");
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d) || 1n;
    return { n: n / g, d: d / g };
  }
  const add = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
  const sub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
  const mul = (a, b) => Q(a.n * b.n, a.d * b.d);
  const div = (a, b) => Q(a.n * b.d, a.d * b.n);
  const eq = (a, b) => a.n === b.n && a.d === b.d;
  const cmp = (a, b) => { const x = a.n * b.d - b.n * a.d; return x < 0n ? -1 : x > 0n ? 1 : 0; };
  function pow(a, e) {
    if (e.d !== 1n || e.n < 0n || e.n > 4096n) throw new Error("exponent must be a whole number from 0 to 4096");
    let r = Q(1n);
    for (let i = 0n; i < e.n; i++) r = mul(r, a);
    return r;
  }
  function qToString(q) {
    if (q.d === 1n) return q.n.toLocaleString("en-US");
    return `${q.n}/${q.d}`;
  }
  function qToNumber(q) { return Number(q.n) / Number(q.d); }
  // machine-readable form stored as "normalized": plain digits, no separators ("1000000", "25/3")
  function qToPlain(q) { return q.d === 1n ? q.n.toString() : `${q.n}/${q.d}`; }
  // misconception keys are compared by exact value, so "2000000", "2,000,000" and "2*10^6" all match
  function misconByValue(value, miscon) {
    for (const [k, tag] of Object.entries(miscon || {})) {
      const m = tryEval(k, {});
      if (m.ok && eq(m.value, value)) return tag;
    }
    return null;
  }

  /* Parse one literal: 1,234 · 12_000 · 8.33 · -4 · 25/3 is handled by the expression parser. */
  function decimalToQ(s) {
    const m = /^(\d*)(?:\.(\d*))?$/.exec(s);
    if (!m || (m[1] === "" && (m[2] === undefined || m[2] === ""))) return null;
    const whole = m[1] || "0", frac = m[2] || "";
    return Q(BigInt(whole + frac), 10n ** BigInt(frac.length));
  }

  /* ------------------------------------------------------------ expression parser (exact) */
  // Grammar: expr = term (('+'|'-') term)* ; term = unary (('*'|'/'|implicit) unary)* ;
  // unary = '-' unary | power ; power = atom ('^' unary)? ; atom = number | var | '(' expr ')'
  function normalizeExpr(raw) {
    return String(raw)
      .trim()
      .replace(/(\d),(?=\d{3}\b)/g, "$1")      // thousands separators: 1,234,567
      .replace(/_/g, "")
      .replace(/[×·⋅∙]/g, "*")
      .replace(/[−–—]/g, "-")
      .replace(/÷/g, "/")
      .replace(/²/g, "^2").replace(/³/g, "^3")
      .replace(/\*\*/g, "^")
      .replace(/\s+/g, " ");
  }

  // vars: names known as variables. A multi-letter id that isn't itself a known name but whose letters all are
  // ("nm", "cn") is split into single-letter ids here, so term() treats it as an implicit product and "^" binds
  // to the last letter only: nm^2 = n*m^2, like "n m^2" or "n*m^2".
  function tokenize(s, vars = {}) {
    const has = (k) => Object.prototype.hasOwnProperty.call(vars, k);
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === " ") { i++; continue; }
      if (/[0-9.]/.test(c)) {
        let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
        const q = decimalToQ(s.slice(i, j));
        if (!q) throw new Error(`bad number "${s.slice(i, j)}"`);
        out.push({ t: "num", v: q }); i = j; continue;
      }
      if (/[a-zA-Z]/.test(c)) {
        let j = i; while (j < s.length && /[a-zA-Z0-9]/.test(s[j])) j++;
        const word = s.slice(i, j);
        if (word.length > 1 && !has(word) && [...word].every(has)) for (const ch of word) out.push({ t: "id", v: ch });
        else out.push({ t: "id", v: word });
        i = j; continue;
      }
      if ("+-*/^()".includes(c)) { out.push({ t: c }); i++; continue; }
      throw new Error(`unexpected "${c}"`);
    }
    return out;
  }

  function evalExact(raw, vars = {}) {
    const toks = tokenize(normalizeExpr(raw), vars);
    if (!toks.length) throw new Error("empty");
    let p = 0;
    const peek = () => toks[p];
    const take = (t) => { if (!toks[p] || toks[p].t !== t) throw new Error(`expected ${t}`); return toks[p++]; };
    function expr() {
      let v = term();
      while (peek() && (peek().t === "+" || peek().t === "-")) {
        const op = toks[p++].t; const r = term();
        v = op === "+" ? add(v, r) : sub(v, r);
      }
      return v;
    }
    function startsAtom(t) { return t && (t.t === "num" || t.t === "id" || t.t === "("); }
    function term() {
      let v = unary();
      for (;;) {
        const t = peek();
        if (t && (t.t === "*" || t.t === "/")) { p++; const r = unary(); v = t.t === "*" ? mul(v, r) : div(v, r); }
        else if (startsAtom(t)) { v = mul(v, power()); }   // implicit: 4n, n(n+1), 2(3)
        else break;
      }
      return v;
    }
    function unary() {
      if (peek() && peek().t === "-") { p++; return mul(Q(-1n), unary()); }
      if (peek() && peek().t === "+") { p++; return unary(); }
      return power();
    }
    function power() {
      const base = atom();
      if (peek() && peek().t === "^") { p++; return pow(base, unary()); }
      return base;
    }
    function atom() {
      const t = peek();
      if (!t) throw new Error("unexpected end");
      if (t.t === "num") { p++; return t.v; }
      if (t.t === "(") { p++; const v = expr(); take(")"); return v; }
      if (t.t === "id") {
        p++;
        if (Object.prototype.hasOwnProperty.call(vars, t.v)) return vars[t.v];
        throw new Error(`unknown name "${t.v}"`);
      }
      throw new Error(`unexpected "${t.t}"`);
    }
    const v = expr();
    if (p !== toks.length) throw new Error("trailing input");
    return v;
  }

  function tryEval(raw, vars) {
    try { return { ok: true, value: evalExact(raw, vars) }; } catch (e) { return { ok: false, error: e.message }; }
  }

  /* ------------------------------------------------------------ answer checkers
     Every checker returns { ok: true|false|null, normalized, tag?, note? }.
     ok === null means "couldn't read it" (not graded). tag names a misconception, never the answer. */

  // Exact integer / rational. Accepts arithmetic (e.g. "4*7+4"), commas, and huge values.
  function checkExact(raw, want, miscon = {}) {
    const got = tryEval(raw, {});
    if (!got.ok) return { ok: null, normalized: null };
    const w = evalExact(want, {});
    const normalized = qToPlain(got.value);
    if (eq(got.value, w)) return { ok: true, normalized };
    return { ok: false, normalized, tag: misconByValue(got.value, miscon) };
  }

  // Genuinely non-integer decimals only (e.g. $8.33/day). |got - want| <= tol, compared exactly.
  function checkDecimal(raw, want, tol, miscon = {}) {
    const got = tryEval(raw, {});
    if (!got.ok) return { ok: null, normalized: null };
    const w = evalExact(want, {});
    const t = evalExact(String(tol), {});
    const diff = sub(got.value, w);
    const normalized = qToPlain(got.value);
    const ok = cmp(diff.n < 0n ? Q(-diff.n, diff.d) : diff, t) <= 0;
    return ok ? { ok: true, normalized } : { ok: false, normalized, tag: misconByValue(got.value, miscon) };
  }

  // Formula: equal as functions if equal (exactly) at every listed point.
  // points: { n: ["0","1","2","7","10"] , c: [...] } -> cartesian product.
  function combos(points) {
    return Object.entries(points).reduce(
      (acc, [k, vals]) => acc.flatMap((c) => vals.map((v) => ({ ...c, [k]: evalExact(String(v)) }))),
      [{}],
    );
  }
  function checkFormula(raw, want, points, miscon = {}) {
    const names = Object.keys(points);
    const zero = Object.fromEntries(names.map((k) => [k, Q(3n)]));
    if (!tryEval(raw, zero).ok) return { ok: null, normalized: null };
    const normalized = normalizeExpr(raw).replace(/\s+/g, "");
    for (const pt of combos(points)) {
      const w = evalExact(want, pt);
      const g = tryEval(raw, pt);
      if (!g.ok || !eq(g.value, w)) {
        // misconception keys are formulas too: match them by value at the same points
        for (const [key, tagName] of Object.entries(miscon)) {
          if (combos(points).every((q) => { const m = tryEval(key, q); const h = tryEval(raw, q); return m.ok && h.ok && eq(m.value, h.value); })) {
            return { ok: false, normalized, tag: tagName };
          }
        }
        const at = Object.entries(pt).map(([k, v]) => `${k} = ${qToString(v)}`).join(", ");
        return { ok: false, normalized, tag: null, note: `Doesn't match at ${at}: yours gives ${g.ok ? qToString(g.value) : "no value"}.` };
      }
    }
    return { ok: true, normalized };
  }

  /* ------------------------------------------------------------ asymptotic classes (exact)
     Every function the lecture writes is, for large n, a positive constant times
         b^n · n^d · (log n)^l · (log log n)^m          (b, d, l, m rational)
     so its Θ-class is the tuple [b, d, l, m], and f ∈ O(g) ⟺ class(f) ≤ class(g) lexicographically
     (exponential base first, then polynomial degree, then log power, then log-log power).
     parseAsym() builds that tuple from an expression, exactly, with BigInt rationals. It refuses (returns null)
     anything it can't classify for sure: cancellation (n^2 - n^2), negative leading terms, log of a decaying
     function, irrational exponential bases like 2^(n/2), factorials. */
  const ONE = Q(1n), ZERO = Q(0n);
  const CONST_CLS = () => ({ b: ONE, d: ZERO, l: ZERO, m: ZERO });
  function clsCmp(a, b) {
    for (const k of ["b", "d", "l", "m"]) { const c = cmp(a[k], b[k]); if (c) return c; }
    return 0;
  }
  const isConstCls = (c) => clsCmp(c, CONST_CLS()) === 0;
  function asymTokens(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i], rest = s.slice(i);
      if (c === " ") { i++; continue; }
      if (/[0-9.]/.test(c)) {
        let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
        const q = decimalToQ(s.slice(i, j));
        if (!q) throw new Error("bad number");
        out.push({ t: "num", v: q }); i = j; continue;
      }
      let m;
      if ((m = /^log_?\{?(\d+(?:\.\d+)?)\}?/.exec(rest))) { out.push({ t: "fn", v: "log", base: m[1] }); i += m[0].length; continue; }
      if ((m = /^(log|lg|ln)/.exec(rest))) { out.push({ t: "fn", v: "log", base: m[1] === "ln" ? "e" : null }); i += m[0].length; continue; }
      if ((m = /^(sqrt|√)/.exec(rest))) { out.push({ t: "fn", v: "sqrt" }); i += m[0].length; continue; }
      if (c === "n") { out.push({ t: "n" }); i++; continue; }
      if ("+-*/^()".includes(c)) { out.push({ t: c }); i++; continue; }
      throw new Error(`can't read "${c}"`);
    }
    return out;
  }
  // node: { cls, sign, val (exact constant or null), lin ({k,m} if exactly k·n + m, else null), lead (Q|null), terms, base }
  const mkConst = (v) => ({ cls: CONST_CLS(), sign: v.n > 0n ? 1 : v.n < 0n ? -1 : 0, val: v, lin: { k: ZERO, m: v }, lead: v, terms: 1, base: false });
  function negNode(a) {
    return { ...a, sign: -a.sign, val: a.val ? mul(Q(-1n), a.val) : null, lin: a.lin ? { k: mul(Q(-1n), a.lin.k), m: mul(Q(-1n), a.lin.m) } : null, lead: a.lead ? mul(Q(-1n), a.lead) : null };
  }
  function sumNode(a, b) {
    const lin = a.lin && b.lin ? { k: add(a.lin.k, b.lin.k), m: add(a.lin.m, b.lin.m) } : null;
    if (a.val && b.val) { const v = add(a.val, b.val); return { ...mkConst(v), terms: a.terms + b.terms }; }
    const c = clsCmp(a.cls, b.cls);
    const terms = a.terms + b.terms, base = a.base || b.base;
    if (c > 0) return { ...a, lin, terms, base };
    if (c < 0) return { ...b, lin, terms, base };
    if (a.lead && b.lead) {
      const lead = add(a.lead, b.lead);
      if (lead.n === 0n) throw new Error("the leading terms cancel; simplify first");
      return { cls: a.cls, sign: lead.n > 0n ? 1 : -1, val: null, lin, lead, terms, base };
    }
    if (a.sign === b.sign) return { cls: a.cls, sign: a.sign, val: null, lin, lead: null, terms, base };
    throw new Error("can't tell whether the leading terms cancel");
  }
  function mulNode(a, b, divide = false) {
    const op = divide ? div : mul;
    if (divide && b.val && b.val.n === 0n) throw new Error("division by zero");
    const cls = divide
      ? { b: div(a.cls.b, b.cls.b), d: sub(a.cls.d, b.cls.d), l: sub(a.cls.l, b.cls.l), m: sub(a.cls.m, b.cls.m) }
      : { b: mul(a.cls.b, b.cls.b), d: add(a.cls.d, b.cls.d), l: add(a.cls.l, b.cls.l), m: add(a.cls.m, b.cls.m) };
    let lin = null;
    if (a.lin && b.val) lin = { k: op(a.lin.k, b.val), m: op(a.lin.m, b.val) };
    else if (!divide && b.lin && a.val) lin = { k: mul(b.lin.k, a.val), m: mul(b.lin.m, a.val) };
    return {
      cls, sign: a.sign * b.sign, val: a.val && b.val ? op(a.val, b.val) : null, lin,
      lead: a.lead && b.lead ? op(a.lead, b.lead) : null, terms: Math.max(a.terms, b.terms) > 1 ? 2 : 1, base: a.base || b.base,
    };
  }
  function powNode(a, e) {
    if (e.val) { // constant exponent
      const ev = e.val;
      if (a.val) {
        if (ev.d === 1n && ev.n >= 0n && ev.n <= 4096n) return mkConst(pow(a.val, ev));
        if (a.sign <= 0) throw new Error("negative base");
        return { ...mkConst(ONE), val: null, lin: null, lead: null };
      }
      if (a.sign <= 0) throw new Error("negative base");
      const intE = ev.d === 1n;
      if (!intE && cmp(a.cls.b, ONE) !== 0) throw new Error("irrational exponential base");
      const bPow = intE ? (ev.n >= 0n ? pow(a.cls.b, ev) : div(ONE, pow(a.cls.b, Q(-ev.n)))) : ONE;
      return {
        cls: { b: bPow, d: mul(a.cls.d, ev), l: mul(a.cls.l, ev), m: mul(a.cls.m, ev) }, sign: 1, val: null, lin: null,
        lead: a.lead && intE && ev.n >= 0n ? pow(a.lead, ev) : null, terms: 1, base: a.base,
      };
    }
    // exponent grows: base must be a positive constant and the exponent exactly k·n + m
    if (!a.val || a.sign <= 0) throw new Error("only constant^n exponentials are supported");
    if (!e.lin) throw new Error("exponent must be linear in n");
    const k = e.lin.k;
    if (k.d !== 1n || k.n < 0n || k.n > 64n) throw new Error("exponent must be a whole multiple of n");
    return { cls: { b: pow(a.val, k), d: ZERO, l: ZERO, m: ZERO }, sign: 1, val: null, lin: null, lead: null, terms: 1, base: false };
  }
  function logNode(x, base) {
    if (x.sign <= 0) throw new Error("log of a non-positive function");
    const flagged = base !== null && base !== "2";
    if (x.val) {
      if (cmp(x.val, ONE) <= 0) throw new Error("log of a constant ≤ 1");
      return { ...mkConst(ONE), val: null, lin: null, lead: null, base: flagged };
    }
    const c = x.cls;
    const out = (cls, lead) => ({ cls, sign: 1, val: null, lin: null, lead, terms: 1, base: flagged || x.base });
    if (cmp(c.b, ONE) > 0) return out({ b: ONE, d: ONE, l: ZERO, m: ZERO }, null);
    if (cmp(c.b, ONE) < 0) throw new Error("log of a decaying function");
    if (cmp(c.d, ZERO) > 0) return out({ b: ONE, d: ZERO, l: ONE, m: ZERO }, base === null || base === "2" ? c.d : null);
    if (cmp(c.d, ZERO) < 0) throw new Error("log of a decaying function");
    if (cmp(c.l, ZERO) > 0) return out({ b: ONE, d: ZERO, l: ZERO, m: ONE }, null);
    throw new Error("too many nested logs");
  }
  function parseAsymExpr(raw) {
    const toks = asymTokens(normalizeExpr(raw).replace(/π/g, ""));
    if (!toks.length) throw new Error("empty");
    let p = 0;
    const peek = () => toks[p];
    function expr() {
      let v = term();
      while (peek() && (peek().t === "+" || peek().t === "-")) {
        const op = toks[p++].t; const r = term();
        v = sumNode(v, op === "-" ? negNode(r) : r);
      }
      return v;
    }
    const startsAtom = (t) => t && (t.t === "num" || t.t === "n" || t.t === "(" || t.t === "fn");
    function term() {
      let v = unary();
      for (;;) {
        const t = peek();
        if (t && (t.t === "*" || t.t === "/")) { p++; v = mulNode(v, unary(), t.t === "/"); }
        else if (startsAtom(t)) v = mulNode(v, power());
        else break;
      }
      return v;
    }
    function unary() {
      if (peek() && peek().t === "-") { p++; return negNode(unary()); }
      if (peek() && peek().t === "+") { p++; return unary(); }
      return power();
    }
    function power() {
      const b = atom();
      if (peek() && peek().t === "^") { p++; return powNode(b, unary()); }
      return b;
    }
    function atom() {
      const t = peek();
      if (!t) throw new Error("unexpected end");
      if (t.t === "num") { p++; return mkConst(t.v); }
      if (t.t === "n") { p++; return { cls: { b: ONE, d: ONE, l: ZERO, m: ZERO }, sign: 1, val: null, lin: { k: ONE, m: ZERO }, lead: ONE, terms: 1, base: false }; }
      if (t.t === "(") { p++; const v = expr(); if (!peek() || peek().t !== ")") throw new Error("missing )"); p++; return { ...v, terms: 1 }; }
      if (t.t === "fn") {
        p++;
        // log^2 n = (log n)^2
        let outer = null;
        if (peek() && peek().t === "^" && toks[p + 1] && toks[p + 1].t === "num") { outer = toks[p + 1].v; p += 2; }
        const arg = peek() && peek().t === "(" ? atom() : power();
        let v = t.v === "sqrt" ? powNode(arg, mkConst(Q(1n, 2n))) : logNode(arg, t.base);
        if (outer) v = powNode(v, mkConst(outer));
        return v;
      }
      throw new Error(`unexpected "${t.t}"`);
    }
    const v = expr();
    if (p !== toks.length) throw new Error("trailing input");
    if (v.sign <= 0) throw new Error("not eventually positive");
    return v;
  }
  function parseAsym(raw) {
    try { const v = parseAsymExpr(raw); return { ok: true, cls: v.cls, terms: v.terms, lead: v.lead, base: v.base, node: v }; }
    catch (e) { return { ok: false, error: e.message }; }
  }
  function qTex(q) { return q.d === 1n ? q.n.toString() : `${q.n}/${q.d}`; }
  function qDec(q) { // 11/10 -> "1.1" when it terminates
    if (q.d === 1n) return q.n.toString();
    let d = q.d, twos = 0, fives = 0;
    while (d % 2n === 0n) { d /= 2n; twos++; }
    while (d % 5n === 0n) { d /= 5n; fives++; }
    if (d !== 1n) return `(${q.n}/${q.d})`;
    const k = Math.max(twos, fives), scaled = (q.n * 10n ** BigInt(k)) / q.d;
    const s = scaled.toString().padStart(k + 1, "0");
    return `${s.slice(0, -k)}.${s.slice(-k)}`;
  }
  function asymName(c) {
    const parts = [];
    if (cmp(c.b, ONE) !== 0) parts.push(`${qDec(c.b)}^n`);
    if (c.d.n !== 0n) parts.push(eq(c.d, ONE) ? "n" : c.d.d === 1n ? `n^${c.d.n}` : `n^(${qTex(c.d)})`);
    if (c.l.n !== 0n) parts.push(eq(c.l, ONE) ? "log n" : c.l.d === 1n ? `log^${c.l.n} n` : `(log n)^(${qTex(c.l)})`);
    if (c.m.n !== 0n) parts.push(eq(c.m, ONE) ? "log log n" : `(log log n)^${qTex(c.m)}`);
    return parts.join(" ") || "1";
  }
  // relation between two expressions: { o, omega, theta, cmp } or { error }
  function relate(fRaw, gRaw) {
    const f = parseAsym(fRaw), g = parseAsym(gRaw);
    if (!f.ok) return { error: `f: ${f.error}` };
    if (!g.ok) return { error: `g: ${g.error}` };
    const c = clsCmp(f.cls, g.cls);
    return { cmp: c, o: c <= 0, omega: c >= 0, theta: c === 0, f: asymName(f.cls), g: asymName(g.cls), fCls: f.cls, gCls: g.cls };
  }

  function stripWrapper(s) {
    let t = s.trim().toLowerCase().replace(/\s+/g, "");
    t = t.replace(/^(big-?o|bigoh|big-?theta|theta|big-?omega|omega)/, (m) => (m.includes("o") && !m.includes("omega") && !m.includes("theta") ? "o" : m.includes("theta") ? "θ" : "ω"));
    const m = /^([oθωΘΩ]|theta|omega)\((.*)\)$/i.exec(t);
    return m ? m[2] : t;
  }
  // Big-O bucket answers. want is any expression ("n^2", "n log n", "2^n", "log n"). Exact class match;
  // a correct but unsimplified bucket is accepted with a nudge (extra terms, a constant factor, a log base).
  function checkBigO(raw, want) {
    const s = stripWrapper(normalizeExpr(raw));
    if (!s) return { ok: null, normalized: null };
    const got = parseAsym(s);
    if (!got.ok) return { ok: null, normalized: null, note: got.error };
    const w = parseAsym(want);
    const normalized = `O(${asymName(got.cls)})`;
    const c = clsCmp(got.cls, w.cls);
    if (c === 0) {
      if (got.terms > 1) return { ok: true, normalized, tag: "simplify-terms" };
      if (got.lead && !eq(got.lead, ONE)) return { ok: true, normalized, tag: "simplify-constant" };
      if (got.base) return { ok: true, normalized, tag: "simplify-base" };
      return { ok: true, normalized };
    }
    return { ok: false, normalized, tag: c > 0 ? "not-tight" : "too-small" };
  }
  function parseBigO(raw) { const g = parseAsym(stripWrapper(normalizeExpr(raw))); return g.ok ? { cls: g.cls } : null; }
  const className = asymName;

  /* ------------------------------------------------------------ yes/no and letter choices */
  function checkYesNo(raw, want) {
    const w = String(raw).trim().toLowerCase();
    if (!/^(y|yes|n|no|true|false)$/.test(w)) return { ok: null, normalized: null };
    const v = /^(y|true)/.test(w) ? "yes" : "no";
    return { ok: v === want, normalized: v };
  }
  function checkChoice(raw, want, allowed, miscon = {}) {
    const v = String(raw).trim().toLowerCase().replace(/^(algorithm|alg\.?)\s*/, "");
    if (!allowed.includes(v)) return { ok: null, normalized: null };
    return { ok: v === want, normalized: v, tag: v === want ? null : miscon[v] || null };
  }

  /* ------------------------------------------------------------ Java type answers */
  function javaTokens(s) {
    return String(s).replace(/\s+/g, " ").trim().match(/[A-Za-z_$][\w$]*|\[\]|\?|[<>,&]|\S/g) || [];
  }
  // Names declared in a type-parameter list, in order: "A, B extends A" -> ["A","B"].
  function declaredParams(header) {
    let t = String(header).trim();
    if (t.startsWith("<") && t.endsWith(">")) t = t.slice(1, -1);
    const toks = javaTokens(t);
    const names = [];
    let depth = 0, expectName = true;
    for (const tok of toks) {
      if (tok === "<") depth++;
      else if (tok === ">") depth--;
      else if (tok === "," && depth === 0) expectName = true;
      else if (expectName && /^[A-Za-z_$]/.test(tok)) { names.push(tok); expectName = false; }
    }
    return names;
  }
  function stripAngles(s) {
    const t = String(s).trim();
    return t.startsWith("<") && t.endsWith(">") ? t.slice(1, -1) : t;
  }
  // rename: student's type-parameter names -> canonical names, by position.
  function canonJava(s, rename) {
    return javaTokens(s).map((tok) => (rename && rename[tok]) || tok).join(" ")
      .replace(/ \[\]/g, "[]").replace(/Integer\b/g, "Integer");
  }
  /* parts: [{ id, raw, accept: [canonical strings], header: bool, miscon: {canonical: tag} }]
     canonicalParams: names used in the accepted answers (e.g. ["A","B"]). */
  function checkJavaParts(parts, canonicalParams) {
    const headerPart = parts.find((p) => p.header);
    let rename = null;
    if (headerPart && headerPart.raw.trim()) {
      const names = declaredParams(headerPart.raw);
      if (names.length === canonicalParams.length && new Set(names).size === names.length) {
        rename = Object.fromEntries(names.map((n, i) => [n, canonicalParams[i]]));
      }
    }
    const canonKeys = (m) => Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [canonJava(k, null), v]));
    return parts.map((p) => {
      const raw = p.header ? stripAngles(p.raw) : p.raw;
      if (!raw.trim()) return { id: p.id, ok: null, normalized: null };
      const norm = canonJava(raw, rename);
      const accepted = p.accept.map((a) => canonJava(a, null));
      if (accepted.includes(norm)) return { id: p.id, ok: true, normalized: norm, tag: canonKeys(p.notes)[norm] || null };
      return { id: p.id, ok: false, normalized: norm, tag: canonKeys(p.miscon)[norm] || null };
    });
  }

  /* ------------------------------------------------------------ "find c and n0" checker
     Decides EXACTLY whether f(n) <= c*g(n) (rel "O") or f(n) >= c*g(n) (rel "Omega") holds for EVERY integer n >= n0,
     for polynomials f, g of degree <= 3 with rational coefficients (lowest degree first, as strings like "1/100").
     Let p(n) = c*g(n) - f(n) (or f - c*g); we need p(n) >= 0 for all integers n >= n0.
     1. Every real root of p has |x| < R = 1 + max|a_i/a_d| (Cauchy's bound), so for n >= R, sign p(n) = sign of the
        leading coefficient. If that is negative, p(max(n0, ceil R)) < 0 is a counterexample and no n0 can work with this c.
     2. Otherwise only integers in [n0, E], E = max(n0, ceil R), matter. p is monotonic between its critical points, so
        its minimum over those integers is at n0, at E, or at an integer next to a critical point (a root of p'). Those
        few candidates are evaluated exactly. No sampling, no scan limit. */
  function polyEval(coeffs, n) { // coeffs: Q[], n: BigInt
    let r = Q(0n), x = Q(1n);
    for (const a of coeffs) { r = add(r, mul(a, x)); x = mul(x, Q(n)); }
    return r;
  }
  function parsePoly(arr) { return arr.map((s) => evalExact(String(s))); }
  function ceilQ(q) { return q.n >= 0n ? (q.n + q.d - 1n) / q.d : -((-q.n) / q.d); }
  function criticalPoints(p) { // real roots of p' (numeric; only used to choose integer candidates)
    const d = p.slice(1).map((a, i) => qToNumber(a) * (i + 1));
    while (d.length && d[d.length - 1] === 0) d.pop();
    if (d.length <= 1) return [];
    if (d.length === 2) return [-d[0] / d[1]];
    if (d.length === 3) {
      const [c0, b, a] = d, disc = b * b - 4 * a * c0;
      if (disc < 0) return [];
      const s = Math.sqrt(disc);
      return [(-b - s) / (2 * a), (-b + s) / (2 * a)];
    }
    throw new Error("degree > 3 not supported");
  }

  function checkBound(spec, cRaw, n0Raw) {
    const f = parsePoly(spec.f), g = parsePoly(spec.g);
    const cE = tryEval(cRaw, {}), nE = tryEval(n0Raw, {});
    const res = { holds: false, parts: { c: null, n0: null }, normalized: { c: null, n0: null } };
    if (!cE.ok || !nE.ok) { res.unreadable = true; return res; }
    const c = cE.value, n0q = nE.value;
    res.normalized = { c: qToPlain(c), n0: qToPlain(n0q) };
    if (cmp(c, Q(0n)) <= 0) { res.parts.c = false; res.tag = "c-not-positive"; return res; }
    if (cmp(n0q, Q(0n)) <= 0) { res.parts.n0 = false; res.parts.c = null; res.tag = "n0-not-positive"; return res; }
    const n0 = ceilQ(n0q);
    const len = Math.max(f.length, g.length);
    const p = [];
    for (let i = 0; i < len; i++) {
      const fi = f[i] || Q(0n), gi = mul(c, g[i] || Q(0n));
      p.push(spec.rel === "O" ? sub(gi, fi) : sub(fi, gi));
    }
    while (p.length && p[p.length - 1].n === 0n) p.pop();
    const fAt = (n) => polyEval(f, n), cgAt = (n) => mul(c, polyEval(g, n));
    if (!p.length) { res.holds = true; res.parts = { c: true, n0: true }; return res; }
    const lead = p[p.length - 1];
    let R = Q(1n);
    for (let i = 0; i < p.length - 1; i++) {
      const r = add(Q(1n), div(Q(babs(p[i].n), p[i].d), Q(babs(lead.n), lead.d)));
      if (cmp(r, R) > 0) R = r;
    }
    const Rb = ceilQ(R);
    const end = Rb > n0 ? Rb : n0;
    const fail = (n) => { res.counterexample = { n: n.toString(), f: qToString(fAt(n)), cg: qToString(cgAt(n)) }; };
    if (lead.n < 0n) {
      fail(end);
      res.parts.c = false;
      res.tag = spec.rel === "O" ? "c-too-small-forever" : "c-too-big-forever";
      return res;
    }
    const cands = new Set([n0, end]);
    for (const x of criticalPoints(p)) {
      if (!Number.isFinite(x)) continue;
      const k = BigInt(Math.floor(x));
      for (let j = k - 2n; j <= k + 3n; j++) if (j >= n0 && j <= end) cands.add(j);
    }
    let worst = null, worstVal = null;
    for (const n of [...cands].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      const v = polyEval(p, n);
      if (worstVal === null || cmp(v, worstVal) < 0) { worst = n; worstVal = v; }
    }
    if (cmp(worstVal, Q(0n)) < 0) {
      fail(worst);
      res.parts.c = true; res.parts.n0 = false; res.tag = "n0-too-small";
      return res;
    }
    res.holds = true; res.parts = { c: true, n0: true };
    return res;
  }

  /* smallest integer n0 >= 1 for which checkBound holds with this c, or null if no n0 works.
     "holds" is monotone in n0 (holding for all n >= n0 implies holding for all n >= n0+1), so binary search is exact. */
  function smallestN0(spec, cRaw) {
    const first = checkBound(spec, cRaw, "1");
    if (first.unreadable) return { unreadable: true };
    if (first.holds) return { n0: 1n };
    if (first.tag === "c-not-positive" || first.tag === "c-too-small-forever" || first.tag === "c-too-big-forever") return { n0: null, tag: first.tag, counterexample: first.counterexample };
    let lo = 1n, hi = 2n;
    while (!checkBound(spec, cRaw, hi.toString()).holds) { lo = hi; hi *= 2n; if (hi > 1n << 400n) return { n0: null, tag: "too-far" }; }
    while (hi - lo > 1n) { const mid = (lo + hi) / 2n; if (checkBound(spec, cRaw, mid.toString()).holds) hi = mid; else lo = mid; }
    return { n0: hi, lastFail: lo };
  }

  return {
    smallestN0, parseAsym, relate, asymName, clsCmp, stripWrapper,
    Q, add, sub, mul, div, eq, cmp, qToString, qToNumber, qToPlain,
    evalExact, tryEval, normalizeExpr,
    checkExact, checkDecimal, checkFormula, checkBigO, parseBigO, className,
    checkYesNo, checkChoice, checkJavaParts, declaredParams, canonJava,
    checkBound, polyEval, parsePoly,
  };
});
