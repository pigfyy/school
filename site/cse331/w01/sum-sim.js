/* A model of the lecture's Sum program, one function per version of it.
   Used by the site (window.SumSim) and by checks/cse331/w01/verify.mjs, which checks it against real Java.
   It follows java.util.Scanner in the en_US locale: tokens split on Java whitespace, and an int token is
   an optional sign, then plain digits or digits grouped by commas (1,000). Limitation: Java also reads
   non-ASCII digits (like ٣); this model treats them as words. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SumSim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // \p{javaWhitespace}: Java whitespace, which leaves out the no-break spaces U+00A0, U+2007 and U+202F
  const WS = new RegExp("[\\t\\n\\u000B\\f\\r\\u001C-\\u001F \\u1680\\u2000-\\u2006\\u2008-\\u200A\\u2028\\u2029\\u205F\\u3000]+");
  const NUMERAL = /^([-+]?)(\d+|[1-9]\d?\d?(?:,\d\d\d)+)$/;

  const VARIANTS = {
    orig: { label: "Sum (from lecture)", bits: 32, guard: "hasNextInt", init: 0n, type: "int" },
    hasnext: { label: "Line 10 uses hasNext", bits: 32, guard: "hasNext", init: 0n, type: "int" },
    one: { label: "Line 15 is int sum = 1;", bits: 32, guard: "hasNextInt", init: 1n, type: "int" },
    long: { label: "Reads long values", bits: 64, guard: "hasNextLong", init: 0n, type: "long" },
  };

  const tokenize = (text) => String(text).split(WS).filter(Boolean);

  // BigInt value of a whole-number token, or null if it isn't one
  function parseWhole(tok) {
    const m = NUMERAL.exec(tok);
    if (!m) return null;
    return BigInt((m[1] === "-" ? "-" : "") + m[2].replace(/,/g, ""));
  }

  const wrap = (x, bits) => BigInt.asIntN(bits, x);

  function run(variantName, text) {
    const v = VARIANTS[variantName];
    if (!v) throw new Error(`unknown variant ${variantName}`);
    const min = -(1n << BigInt(v.bits - 1));
    const max = (1n << BigInt(v.bits - 1)) - 1n;
    const tokens = tokenize(text);
    const list = [];
    let i = 0;
    let stop = { reason: "end", token: null };
    let crash = null;
    while (i < tokens.length) {
      const x = parseWhole(tokens[i]);
      if (x !== null && x >= min && x <= max) { list.push(x); i++; continue; }
      if (v.guard === "hasNext") {
        // hasNext() is true, so nextInt() runs and throws on a token it can't read as an int
        crash = {
          exception: "java.util.InputMismatchException",
          // an out-of-range number is reported with its group commas removed
          message: x === null ? null : `For input string: "${tokens[i].replace(/,/g, "")}"`,
          token: tokens[i],
        };
      } else {
        stop = { reason: x === null ? "notint" : "range", token: tokens[i] };
      }
      break;
    }
    const trueSum = list.reduce((a, b) => a + b, 0n);
    const printedSum = wrap(v.init + trueSum, v.bits);
    const listText = `[${list.join(", ")}]`;
    const stdout = ["Enter some numbers."];
    const stderr = [];
    if (crash) {
      stderr.push(`Exception in thread "main" ${crash.exception}${crash.message ? `: ${crash.message}` : ""}`);
      // frames as printed by JDK 25, the course's version (from the lecture notes)
      stderr.push(
        "\tat java.base/java.util.Scanner.throwFor(Scanner.java:977)",
        "\tat java.base/java.util.Scanner.next(Scanner.java:1632)",
        "\tat java.base/java.util.Scanner.nextInt(Scanner.java:2297)",
        "\tat java.base/java.util.Scanner.nextInt(Scanner.java:2251)",
        "\tat Sum.main(Sum.java:11)",
      );
    } else {
      stdout.push(`Got ${listText}`, `The sum of your list was: ${printedSum}`);
    }
    return {
      variant: variantName,
      tokens,
      list,
      listText,
      readCount: list.length,
      ignored: crash ? [] : tokens.slice(list.length),
      stop,
      crash,
      trueSum,
      printedSum: crash ? null : printedSum,
      wrapped: !crash && printedSum !== v.init + trueSum,
      stdout,
      stderr,
    };
  }

  return { VARIANTS, tokenize, parseWhole, wrap, run };
});
