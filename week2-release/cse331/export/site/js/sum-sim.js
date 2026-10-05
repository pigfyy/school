/* A model of Lecture 3's 99-line Sum (tests/java/Sum.java), plus the small shell the lecture runs it from.
   Used by the site (window.SumSim) and by tests/compare-java.mjs, which checks it against real Java and bash.

   Sum.run(args, { stdin, files, checks }) follows the Java program line by line:
     - the argument loop (lines 28-55), Integer.parseInt for --precision=N (Unicode digits allowed, as in Java),
     - openInput (lines 87-93) on a small in-memory working directory (java.io.File path normalization),
     - java.util.Scanner in the en_US locale (Java whitespace, optional sign, digits or comma groups, int range),
     - the long sum, the average as a double, println (Double.toString) or printf("%.Nf%n") with HALF_UP,
     - fail (lines 95-98): "Sum: <message>" on standard error, exit status 1.
   checks: { neg: false } blanks lines 40-43, { count: false } blanks lines 73-75 (the lecture's two changed copies).
   Limits (stated where they show): only files in the working directory exist; a precision big enough to need
   gigabytes is summarized, and the out-of-memory boundary is the one measured on the test machine. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SumSim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ------------------------------------------------------------ Java text helpers */
  // \p{javaWhitespace}: Character.isWhitespace, which leaves out the no-break spaces U+00A0, U+2007, U+202F
  const WS_CODES = [0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x205f, 0x3000];
  const WS = new RegExp(`[${WS_CODES.map((c) => `\\u{${c.toString(16)}}`).join("")}]+`, "u");
  const ND = /^\p{Nd}$/u;
  const tokenize = (text) => String(text).split(WS).filter(Boolean);

  // Value of a decimal digit (Unicode Nd), or -1. Java's Character.digit(char, 10) sees UTF-16 units, so a digit
  // outside the BMP (a surrogate pair) is not a digit to Integer.parseInt.
  function digitValue(ch) {
    const cp = ch.codePointAt(0);
    if (cp > 0xffff || !ND.test(ch)) return -1;
    let start = cp;
    while (start > 0 && ND.test(String.fromCodePoint(start - 1))) start--;
    return (cp - start) % 10; // Nd digits come in runs of ten, 0 to 9
  }

  // Integer.parseInt(s): optional + or -, then digits; null when Java throws NumberFormatException.
  function javaParseInt(s) {
    const cps = [...String(s)];
    if (!cps.length) return null;
    let i = 0, neg = false;
    if (cps[0] === "-" || cps[0] === "+") { neg = cps[0] === "-"; i = 1; if (cps.length === 1) return null; }
    let v = 0n;
    for (; i < cps.length; i++) {
      const d = digitValue(cps[i]);
      if (d < 0) return null;
      v = v * 10n + BigInt(d);
      if (v > 2147483648n) return null;
    }
    if (neg) v = -v;
    if (v > 2147483647n || v < -2147483648n) return null;
    return Number(v);
  }

  // Scanner.hasNextInt() / nextInt() on one token, en_US: [-+]? then digits, or 1-3 digits and comma groups of 3
  // (the first digit anything but ASCII '0'). Returns the int as a BigInt, or null.
  const D = "\\p{Nd}";
  const INT_TOKEN = new RegExp(`^[-+]?(?:${D}+|(?!0)${D}${D}?${D}?(?:,${D}${D}${D})+)$`, "u");
  function scannerInt(tok) {
    if (!INT_TOKEN.test(tok)) return null;
    const v = javaParseInt(tok.replace(/,/g, ""));
    return v === null ? null : BigInt(v);
  }

  /* ------------------------------------------------------------ Java double formatting */
  // Shortest digits that round-trip (as Double.toString since JDK 19): value = 0.DIGITS x 10^point
  function decimalParts(x) {
    const [m, e] = Math.abs(x).toExponential().split("e");
    return { neg: x < 0 || Object.is(x, -0), digits: m.replace(".", ""), point: Number(e) + 1 };
  }
  // Double.toString / System.out.println(double)
  function javaToString(x) {
    if (Number.isNaN(x)) return "NaN";
    if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
    if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
    const { neg, digits, point } = decimalParts(x);
    const a = Math.abs(x);
    let out;
    if (a >= 1e-3 && a < 1e7) {
      if (point <= 0) out = `0.${"0".repeat(-point)}${digits}`;
      else if (point >= digits.length) out = `${digits}${"0".repeat(point - digits.length)}.0`;
      else out = `${digits.slice(0, point)}.${digits.slice(point)}`;
    } else {
      out = `${digits[0]}.${digits.length > 1 ? digits.slice(1) : "0"}E${point - 1}`;
    }
    return (neg ? "-" : "") + out;
  }
  // String.format("%.Pf", x) in en_US: Java rounds the shortest decimal digits HALF_UP, then pads with zeros.
  function javaFixed(x, p) {
    if (Number.isNaN(x)) return "NaN";
    if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
    if (x === 0) return `${Object.is(x, -0) ? "-" : ""}0${p > 0 ? `.${"0".repeat(p)}` : ""}`;
    const { neg, digits, point } = decimalParts(x);
    let all = digits, pt = point;
    if (pt <= 0) { all = "0".repeat(-pt + 1) + all; pt = 1; }
    if (pt > all.length) all += "0".repeat(pt - all.length);
    let intPart = all.slice(0, pt), frac = all.slice(pt);
    if (frac.length > p) {
      const up = frac[p] >= "5";
      frac = frac.slice(0, p);
      if (up) {
        const s = (intPart + frac).split("").map(Number);
        let i = s.length - 1;
        while (i >= 0) { if (s[i] === 9) { s[i] = 0; i--; } else { s[i]++; break; } }
        let str = s.join("");
        if (i < 0) str = `1${str}`;
        intPart = str.slice(0, str.length - p);
        frac = str.slice(str.length - p);
      }
    } else frac += "0".repeat(p - frac.length);
    intPart = intPart.replace(/^0+(?=\d)/, "");
    return (neg ? "-" : "") + intPart + (p > 0 ? `.${frac}` : "");
  }

  /* ------------------------------------------------------------ the working directory */
  const DEFAULT_FILES = () => ({ "nums.txt": "3 4 5\n", "bad.txt": "3 x\n" });
  // java.io.File normalizes a path: repeated slashes collapse and a trailing slash goes.
  const javaNormalize = (p) => { let s = String(p).replace(/\/{2,}/g, "/"); if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1); return s; };
  // Resolves a path in a working directory that holds only `files`. Directories: ".", "..", "/".
  // Returns { file } | { dir } | { error, outside }. strictSlash: a trailing "/" on a file is an error (shell
  // commands); Java has already normalized it away.
  function resolve(path, files, { strictSlash = false } = {}) {
    if (path === "") return { error: "No such file or directory" };
    const abs = path.startsWith("/");
    const parts = path.split("/");
    const trailing = parts.length > 1 && parts[parts.length - 1] === "";
    const comps = parts.filter((c) => c !== "");
    let where = abs ? "outside" : "cwd", file = null;
    for (const c of comps) {
      if (file !== null) return { error: "Not a directory" };
      if (c === ".") continue;
      if (c === "..") { where = "outside"; continue; }
      if (where === "cwd" && Object.prototype.hasOwnProperty.call(files, c)) { file = c; continue; }
      return { error: "No such file or directory", outside: where !== "cwd" };
    }
    if (file !== null) return strictSlash && trailing ? { error: "Not a directory" } : { file };
    return { dir: where };
  }

  /* ------------------------------------------------------------ Sum */
  const BIG_PRECISION = 2000;           // longer outputs are summarized on screen
  // Length L of the printed number (without the newline) at which Java gives up, measured on the test
  // machine (OpenJDK 21, 64-bit, 6 GB maximum heap): L <= 2147483639 prints; 2147483640..2147483645 ends in
  // "Java heap space"; L >= 2147483646 ends in "Requested array size exceeds VM limit" on any computer.
  const OOM_HEAP = 2147483640;
  const OOM_VM_LIMIT = 2147483646;
  const TRACE_FORMAT = [                // as printed by JDK 25 in the lecture notes
    "\tat java.base/java.util.Formatter.parse(Formatter.java:2818)",
    "\tat java.base/java.util.Formatter.format(Formatter.java:2744)",
    "\tat java.base/java.io.PrintStream.format(PrintStream.java:1183)",
    "\tat java.base/java.io.PrintStream.printf(PrintStream.java:1081)",
    "\tat Sum.main(Sum.java:78)",
  ];
  const TRACE_TAIL = [
    "\tat java.base/java.util.Formatter$FormatSpecifier.print(Formatter.java:3511)",
    "\tat java.base/java.util.Formatter$FormatSpecifier.printFloat(Formatter.java:3075)",
    "\tat java.base/java.util.Formatter$FormatSpecifier.print(Formatter.java:3027)",
    "\tat java.base/java.util.Formatter.format(Formatter.java:2791)",
    "\tat java.base/java.io.PrintStream.implFormat(PrintStream.java:1367)",
    "\tat java.base/java.io.PrintStream.format(PrintStream.java:1346)",
    "\tat java.base/java.io.PrintStream.printf(PrintStream.java:1245)",
    "\tat Sum.main(Sum.java:78)",
  ];
  const TRACE_HEAD = [                  // as printed by JDK 21 on the test machine (the notes print no trace)
    "\tat java.base/java.util.Arrays.copyOf(Arrays.java:3541)",
    "\tat java.base/java.lang.AbstractStringBuilder.ensureCapacityInternal(AbstractStringBuilder.java:242)",
    "\tat java.base/java.lang.AbstractStringBuilder.append(AbstractStringBuilder.java:811)",
    "\tat java.base/java.lang.StringBuilder.append(StringBuilder.java:246)",
  ];
  const TRACE_OOM_VM = [...TRACE_HEAD,
    "\tat java.base/java.util.Formatter$FormatSpecifier.trailingZeros(Formatter.java:4071)",
    "\tat java.base/java.util.Formatter$FormatSpecifier.addZeros(Formatter.java:3705)",
    "\tat java.base/java.util.Formatter$FormatSpecifier.print(Formatter.java:3571)",
    ...TRACE_TAIL];
  const TRACE_OOM_HEAP = [...TRACE_HEAD,
    "\tat java.base/java.util.Formatter$FormatSpecifier.localizedMagnitude(Formatter.java:4597)",
    "\tat java.base/java.util.Formatter$FormatSpecifier.print(Formatter.java:3581)",
    ...TRACE_TAIL];

  function run(args, opts = {}) {
    const checks = { neg: true, count: true, ...(opts.checks || {}) };
    const files = opts.files || DEFAULT_FILES();
    const res = {
      args: [...args], stdout: "", stderr: "", status: 0, endLine: null, how: "ok",
      argSteps: [], readsStdin: false, source: null, read: [], badToken: null,
      sum: 0n, count: 0n, average: false, precisionGiven: false, precision: 0, exception: null, notes: [], abbreviated: null,
    };
    const fail = (message, line) => {
      res.stderr += `Sum: ${message}\n`;
      res.status = 1; res.endLine = line; res.how = "fail"; res.failMessage = message;
      return res;
    };
    const crash = (exception, message, frames, line) => {
      res.stderr += `Exception in thread "main" ${exception}${message ? `: ${message}` : ""}\n${frames.join("\n")}\n`;
      res.status = 1; res.endLine = line; res.how = "exception"; res.exception = exception;
      return res;
    };
    let average = false, precisionGiven = false, precision = 0, filename = null;
    for (let i = 0; i < args.length; i++) {
      const arg = String(args[i]);
      const step = { index: i, arg, line: null, kind: null, effect: "" };
      res.argSteps.push(step);
      if (arg === "-a" || arg === "--average") {
        Object.assign(step, { line: 29, kind: "average", effect: "average = true" });
        average = true;
      } else if (arg.startsWith("--precision=")) {
        precisionGiven = true;
        const value = arg.slice("--precision=".length);
        const p = javaParseInt(value);
        if (p === null) {
          Object.assign(step, { line: 35, kind: "precision-bad", effect: "Integer.parseInt throws, so fail" });
          return fail(`--precision must be an integer, got: ${value}`, 37);
        }
        precision = p;
        if (checks.neg && precision < 0) {
          Object.assign(step, { line: 40, kind: "precision-negative", effect: "precision < 0, so fail" });
          return fail(`--precision must not be negative, got: ${precision}`, 41);
        }
        Object.assign(step, { line: 31, kind: "precision", effect: `precisionGiven = true, precision = ${precision}` });
      } else if (arg.startsWith("-")) {
        Object.assign(step, { line: 44, kind: "unknown-option", effect: "starts with a dash, but no option matches, so fail" });
        return fail(`unknown option: ${arg}`, 45);
      } else if (filename === null) {
        Object.assign(step, { line: 46, kind: "file", effect: `filename = "${arg}"` });
        filename = arg;
      } else {
        Object.assign(step, { line: 48, kind: "extra-file", effect: "a file is already named, so fail" });
        return fail(`too many file arguments: ${arg}`, 49);
      }
    }
    res.average = average; res.precisionGiven = precisionGiven; res.precision = precision;
    if (precisionGiven && !average) return fail("--precision is only allowed with -a/--average", 54);

    let text;
    if (filename === null) {
      res.readsStdin = true;
      res.source = { kind: "stdin" };
      text = opts.stdin == null ? "" : String(opts.stdin);
    } else {
      const r = resolve(javaNormalize(filename), files);
      const shown = javaNormalize(filename);
      if (!r.file) {
        if (r.outside) res.notes.push("This simulator's working directory holds only the files listed; it has no others.");
        return fail(`could not read input: ${shown} (${r.dir ? "Is a directory" : r.error})`, 69);
      }
      res.source = { kind: "file", name: r.file };
      text = files[r.file];
    }

    let sum = 0n, count = 0n;
    for (const tok of tokenize(text)) {
      const v = scannerInt(tok);
      if (v === null) { res.badToken = tok; res.sum = sum; res.count = count; return fail(`not an integer: ${tok}`, 65); }
      res.read.push(v);
      sum = BigInt.asIntN(64, sum + v);
      count++;
    }
    res.sum = sum; res.count = count;

    if (!average) { res.stdout = `${sum}\n`; res.endLine = 83; return res; }
    if (checks.count && count === 0n) return fail("cannot average zero values", 74);
    const avg = Number(sum) / Number(count);
    res.avg = avg;
    if (!precisionGiven) { res.stdout = `${javaToString(avg)}\n`; res.endLine = 80; return res; }
    if (precision < 0) return crash("java.util.UnknownFormatConversionException", "Conversion = '.'", TRACE_FORMAT, 78);
    res.endLine = 78;
    if (!Number.isFinite(avg)) { res.stdout = `${javaFixed(avg, precision)}\n`; return res; }
    const intLen = javaFixed(avg, 0).length;
    const len = intLen + (precision > 0 ? 1 + precision : 0);
    res.printedLength = len;
    if (len >= OOM_VM_LIMIT) {
      res.notes.push("The stack trace's frames are the ones OpenJDK 21 printed on the test machine; the notes show none.");
      return crash("java.lang.OutOfMemoryError", "Requested array size exceeds VM limit", TRACE_OOM_VM, 78);
    }
    if (len >= OOM_HEAP) {
      res.notes.push("Measured on the test machine (OpenJDK 21, 6 GB heap). Where this boundary falls depends on the computer's memory.");
      return crash("java.lang.OutOfMemoryError", "Java heap space", TRACE_OOM_HEAP, 78);
    }
    if (precision > BIG_PRECISION) {
      const shownDigits = 60;
      res.stdout = `${javaFixed(avg, shownDigits)}…\n`;
      res.abbreviated = { length: len + 1, zerosHidden: precision - shownDigits };
      res.notes.push(`Real Java prints ${(len + 1).toLocaleString("en-US")} characters here: the digits shown, then ${(precision - shownDigits).toLocaleString("en-US")} more zeros. The simulator shows the start.${len > 100000000 ? " A string this long needs gigabytes of memory. The test machine (6 GB heap) printed it, but on a computer with less memory this run ends in an OutOfMemoryError." : ""}`);
      return res;
    }
    res.stdout = `${javaFixed(avg, precision)}\n`;
    return res;
  }

  /* ------------------------------------------------------------ Lecture 1's Sum, for comparison */
  // tests/java/Lecture1Sum.java: prompt, read ints while hasNextInt(), print the list, then an int sum (wraps).
  function runLecture1(stdin) {
    const list = [];
    for (const tok of tokenize(stdin == null ? "" : stdin)) {
      const v = scannerInt(tok);
      if (v === null) break;
      list.push(v);
    }
    const sum = BigInt.asIntN(32, list.reduce((a, b) => a + b, 0n));
    return { stdout: `Enter some numbers.\nGot [${list.join(", ")}]\nThe sum of your list was: ${sum}\n`, stderr: "", status: 0, list, sum };
  }

  /* ------------------------------------------------------------ the shell */
  // A small bash: java Sum, echo, cat, ls, rm, javac Sum.java; redirections < > >> 2> 2>> 2>&1 >&2;
  // pipes |, and ; && ||. $? expands to the last exit status, and other $NAMEs are unset (empty).
  // Unquoted * and ? match file names in the working directory.
  function lex(line) {
    const toks = [];
    let i = 0;
    const n = line.length;
    const isOpChar = (c) => c === "|" || c === ";" || c === "&" || c === "<" || c === ">";
    while (i < n) {
      const c = line[i];
      if (c === " " || c === "\t") { i++; continue; }
      if (c === "#") break;
      // operators, including fd redirections like 2> 2>> 2>&1 1> >&2
      const rest = line.slice(i);
      const m = /^(?:(\d)?(>>|>&|>|<)|(\|\||&&|\||;|&))/.exec(rest);
      if (m && (m[2] || m[3])) {
        if (m[3]) { toks.push({ t: "op", v: m[3] }); i += m[3].length; continue; }
        const fd = m[1] !== undefined ? Number(m[1]) : m[2] === "<" ? 0 : 1;
        i += m[0].length;
        if (m[2] === ">&") {
          const d = /^(\d)/.exec(line.slice(i));
          if (!d) return { error: "syntax error near unexpected token `&'" };
          toks.push({ t: "redir", fd, op: "dup", to: Number(d[1]) });
          i += 1;
          continue;
        }
        toks.push({ t: "redir", fd, op: m[2] });
        continue;
      }
      // a word
      let word = "", quoted = false, globbable = false;
      while (i < n) {
        const ch = line[i];
        if (ch === " " || ch === "\t" || isOpChar(ch)) break;
        if (ch === "\\") { if (i + 1 < n) word += line[i + 1]; i += 2; quoted = true; continue; }
        if (ch === "'") {
          const j = line.indexOf("'", i + 1);
          if (j === -1) return { error: "unexpected EOF while looking for matching `''" };
          word += line.slice(i + 1, j); i = j + 1; quoted = true; continue;
        }
        if (ch === '"') {
          let j = i + 1;
          quoted = true;
          for (;;) {
            if (j >= n) return { error: "unexpected EOF while looking for matching `\"'" };
            const d = line[j];
            if (d === '"') { j++; break; }
            if (d === "\\" && j + 1 < n && '"\\$`'.includes(line[j + 1])) { word += line[j + 1]; j += 2; continue; }
            if (d === "$") { const e = expand(line, j); word += e.text; j = e.end; continue; }
            word += d; j++;
          }
          i = j; continue;
        }
        if (ch === "$") { const e = expand(line, i); word += e.text; i = e.end; continue; }
        if (ch === "*" || ch === "?") globbable = true;
        word += ch; i++;
      }
      if (word !== "" || quoted) toks.push({ t: "word", v: word, glob: globbable && !quoted ? word : null });
    }
    return { toks };
  }
  const STATUS_MARK = "\u0000?"; // $? is expanded when its command list element starts, not when the line is read
  function expand(line, i) {
    if (line[i + 1] === "?") return { text: STATUS_MARK, end: i + 2 };
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(i + 1));
    if (m) return { text: "", end: i + 1 + m[0].length };
    return { text: "$", end: i + 1 };
  }
  function globMatch(pat, files) {
    const re = new RegExp(`^${pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
    return Object.keys(files).filter((f) => re.test(f) && !f.startsWith(".")).sort();
  }

  // Parses tokens into [{ pipeline: [cmd], next: ";"|"&&"|"||"|null }], cmd = { argv, redirs }.
  function parse(toks, files) {
    const lists = [];
    let pipeline = [], cmd = { argv: [], redirs: [] };
    const endCmd = () => {
      if (!cmd.argv.length && !cmd.redirs.length) return false;
      pipeline.push(cmd); cmd = { argv: [], redirs: [] }; return true;
    };
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k];
      if (t.t === "word") {
        if (t.glob) { const g = globMatch(t.glob, files); if (g.length) { cmd.argv.push(...g); continue; } }
        cmd.argv.push(t.v);
      } else if (t.t === "redir") {
        if (t.op === "dup") { cmd.redirs.push({ fd: t.fd, op: "dup", to: t.to }); continue; }
        const target = toks[k + 1];
        if (!target || target.t !== "word") return { error: `syntax error near unexpected token \`${target ? target.v || "newline" : "newline"}'` };
        cmd.redirs.push({ fd: t.fd, op: t.op, path: target.v });
        k++;
      } else if (t.v === "|") {
        if (!endCmd()) return { error: "syntax error near unexpected token `|'" };
      } else if (t.v === "&") {
        return { error: "this simulator doesn't run commands in the background (&)", sim: true };
      } else {
        if (!endCmd() && !pipeline.length) return { error: `syntax error near unexpected token \`${t.v}'` };
        if (!pipeline.length) return { error: `syntax error near unexpected token \`${t.v}'` };
        lists.push({ pipeline, next: t.v });
        pipeline = [];
      }
    }
    if (endCmd() || pipeline.length) lists.push({ pipeline, next: null });
    else if (lists.length && lists[lists.length - 1].next !== ";") return { error: "syntax error: unexpected end of line" };
    return { lists };
  }

  // A shell session: holds the files and the last exit status. exec(line, keyboard) returns
  // { entries, status, cleared }: entries are { kind: "cmd"|"typed"|"out"|"err"|"note"|"status", text, fd? }
  // in the order a terminal would show them. keyboard is what the user types while the line runs
  // (it goes to the first command that reads the terminal).
  function createShell(opts = {}) {
    const sh = {
      files: opts.files || DEFAULT_FILES(),
      status: 0,
      checks: { neg: true, count: true, ...(opts.checks || {}) },
      exec(line, keyboard = "") { return execLine(sh, String(line), keyboard); },
    };
    return sh;
  }

  function execLine(sh, line, keyboard) {
    const entries = [{ kind: "cmd", text: line }];
    let kb = keyboard == null ? "" : String(keyboard);
    let kbUsed = false;
    const lx = lex(line);
    const result = { entries, status: sh.status, cleared: false, runs: [] };
    if (lx.error) { entries.push({ kind: "err", fd: 2, text: `bash: ${lx.error}` }); sh.status = 2; result.status = 2; return result; }
    if (!lx.toks.length) return result;
    const ps = parse(lx.toks, sh.files);
    if (ps.error) {
      if (ps.sim) { entries.push({ kind: "note", text: ps.error }); return result; }
      entries.push({ kind: "err", fd: 2, text: `bash: ${ps.error}` }); sh.status = 2; result.status = 2; return result;
    }
    const readTerminal = () => {
      if (kbUsed) return "";
      kbUsed = true;
      entries.push({ kind: "typed", text: kb });
      const t = kb; kb = "";
      return t;
    };
    const writeTo = (target, text, fd) => {
      if (!text) return;
      if (target.kind === "tty") {
        // the terminal shows both streams alike; the entry records which one it came in on
        const lines = text.replace(/\n$/, "").split("\n");
        for (const l of lines) entries.push({ kind: target.fd === 2 ? "err" : "out", fd: target.fd, from: fd, text: l });
      } else if (target.kind === "file") {
        sh.files[target.name] = (sh.files[target.name] || "") + text;
      } else if (target.kind === "pipe") {
        target.buf.push(text);
      }
    };

    for (let li = 0; li < ps.lists.length; li++) {
      const { pipeline } = ps.lists[li];
      const prev = li > 0 ? ps.lists[li - 1].next : null;
      if (prev === "&&" && sh.status !== 0) continue;
      if (prev === "||" && sh.status === 0) continue;
      let input = null; // null: the terminal
      let status = 0;
      const st = String(sh.status);
      const sub = (w) => w.split(STATUS_MARK).join(st);
      for (let k = 0; k < pipeline.length; k++) {
        const cmd = { argv: pipeline[k].argv.map(sub), redirs: pipeline[k].redirs.map((r) => (r.path == null ? r : { ...r, path: sub(r.path) })) };
        const last = k === pipeline.length - 1;
        const pipeOut = { kind: "pipe", buf: [] };
        const fds = { 0: k === 0 ? { kind: "tty" } : { kind: "text", text: input }, 1: last ? { kind: "tty", fd: 1 } : pipeOut, 2: { kind: "tty", fd: 2 } };
        let redirErr = null;
        for (const r of cmd.redirs) {
          if (r.op === "dup") { fds[r.fd] = fds[r.to]; continue; }
          if (r.op === "<") {
            const t = resolve(r.path, sh.files, { strictSlash: true });
            if (t.file) fds[r.fd] = { kind: "text", text: sh.files[t.file] };
            else { redirErr = `${r.path}: ${t.dir ? "Is a directory" : t.error}`; if (t.dir) redirErr = null, fds[r.fd] = { kind: "text", text: "" }; }
            if (redirErr) break;
            continue;
          }
          // > >>: an existing file, or a new one in the working directory
          const t = resolve(r.path, sh.files, { strictSlash: true });
          const bare = r.path.replace(/^(\.\/+)+/, "");
          let name = null;
          if (t.file) name = t.file;
          else if (t.dir) redirErr = `${r.path}: Is a directory`;
          else if (bare && !bare.includes("/") && bare !== "." && bare !== "..") name = bare;
          else redirErr = `${r.path}: ${t.error || "No such file or directory"}`;
          if (redirErr) break;
          if (r.op === ">" || !(name in sh.files)) sh.files[name] = "";
          fds[r.fd] = { kind: "file", name };
        }
        if (redirErr) {
          writeTo({ kind: "tty", fd: 2 }, `bash: ${redirErr}\n`, 2);
          status = 1;
          input = "";
          continue;
        }
        const stdinText = () => {
          const f = fds[0];
          if (f.kind === "tty") return readTerminal();
          return f.text == null ? "" : f.text;
        };
        const out = (t) => writeTo(fds[1], t, 1);
        const err = (t) => writeTo(fds[2], t, 2);
        status = runCommand(sh, cmd.argv, { stdinText, out, err, note: (t) => entries.push({ kind: "note", text: t }), result });
        if (status === "clear") { entries.length = 0; result.cleared = true; status = 0; }
        input = pipeOut.buf.join("");
      }
      sh.status = status;
    }
    result.status = sh.status;
    entries.push({ kind: "status", text: String(sh.status) });
    return result;
  }

  function runCommand(sh, argv, io) {
    const [name, ...rest] = argv;
    if (name === undefined) return 0;
    switch (name) {
      case "java": {
        if (rest[0] !== "Sum") {
          io.note(rest[0] === undefined ? "This simulator runs one Java program: java Sum, followed by its arguments." : `This simulator runs only java Sum (not ${rest.join(" ")}).`);
          return sh.status;
        }
        const r = run(rest.slice(1), { stdin: null, files: sh.files, checks: sh.checks, lazyStdin: true, ...stdinFor(io, rest.slice(1), sh) });
        io.result.runs.push(r);
        io.out(r.stdout); io.err(r.stderr);
        for (const n of r.notes) io.note(n);
        return r.status;
      }
      case "javac":
        if (rest.length === 1 && rest[0] === "Sum.java") return 0;
        io.note("This simulator compiles only Sum.java.");
        return sh.status;
      case "echo": {
        let args = rest, nl = true;
        while (args[0] === "-n") { nl = false; args = args.slice(1); }
        io.out(args.join(" ") + (nl ? "\n" : ""));
        return 0;
      }
      case "cat": {
        let st = 0;
        const list = rest.length ? rest : ["-"];
        for (const f of list) {
          if (f === "-") { io.out(io.stdinText()); continue; }
          const t = resolve(f, sh.files, { strictSlash: true });
          if (t.file) io.out(sh.files[t.file]);
          else { io.err(`cat: ${f}: ${t.dir ? "Is a directory" : t.error}\n`); st = 1; }
        }
        return st;
      }
      case "ls": {
        if (!rest.length) { io.out(Object.keys(sh.files).filter((f) => !f.startsWith(".")).sort().map((f) => `${f}\n`).join("")); return 0; }
        let st = 0;
        for (const f of rest) {
          const t = resolve(f, sh.files, { strictSlash: true });
          if (t.file) io.out(`${f}\n`);
          else if (t.dir) { io.note("This simulator lists only the working directory."); }
          else { io.err(`ls: cannot access '${f}': ${t.error}\n`); st = 2; }
        }
        return st;
      }
      case "rm": {
        let st = 0;
        for (const f of rest) {
          const t = resolve(f, sh.files, { strictSlash: true });
          if (t.file) delete sh.files[t.file];
          else { io.err(`rm: cannot remove '${f}': ${t.dir ? "Is a directory" : t.error}\n`); st = 1; }
        }
        return st;
      }
      case "clear":
        return "clear";
      default:
        io.err(`bash: ${name}: command not found\n`);
        return 127;
    }
  }
  // Sum reads standard input only if no file is named and the arguments pass; only then may it touch the terminal.
  function stdinFor(io, args, sh) {
    const dry = run(args, { stdin: "", files: sh.files, checks: sh.checks });
    return dry.readsStdin ? { stdin: io.stdinText() } : { stdin: "" };
  }

  return {
    tokenize, digitValue, javaParseInt, scannerInt, javaToString, javaFixed, javaNormalize, resolve,
    DEFAULT_FILES, BIG_PRECISION, OOM_HEAP, OOM_VM_LIMIT, run, runLecture1, lex, parse, createShell,
  };
});
