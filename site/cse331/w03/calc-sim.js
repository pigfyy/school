/* CSE 331 week 3: a simulator of Lecture 6's Calculator.java (main + CalcStack, 238 lines), and of the notes'
   copies of main with one check taken out ("When the client forgets"). Pure functions: window.CalcSim in the
   browser, require() in Node. checks/cse331/w03/verify.mjs compiles the real Calculator.java and each copy and
   compares this simulator with them on curated and random sessions.

   run(variant, input) -> { stdout, stderr, status, transcript, compileError }
     input is what the user types, lines separated by "\n" (ending the input = end of the string).
     stdout is exactly what Java writes (the "> " prompts included, no echo of what was typed).
     transcript is [{ typed } | { out } | { err } | { prompt }] in order, for drawing a terminal.
   Stack traces show the frames the lecture notes print (JDK 25). Integer.parseInt is modelled for ASCII digits. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CalcSim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MIN = -2147483648, MAX = 2147483647;
  const NPE = 'java.lang.NullPointerException: Cannot invoke "java.lang.Integer.intValue()" because the return value of "CalcStack.pop()" is null';

  /* The copies. Each names the lines of main it changes, as the notes do; verify.mjs builds the Java from these. */
  const VARIANTS = {
    original: { label: "Calculator.java, as in the notes", blank: [], replace: {} },
    flag: { label: "the flag: no check of add's answer (lines 71 to 74 blank)", blank: [71, 72, 73, 74], replace: {} },
    precondition: { label: "the precondition: no size check before multiply (lines 83 to 86 and 88 blank)", blank: [83, 84, 85, 86, 88], replace: {} },
    "special-integer": { label: "the special value: no null check, Integer kept (lines 57 to 59 and 61 blank)", blank: [57, 58, 59, 61], replace: {} },
    "special-int": { label: "the special value: no null check, stored in an int (line 56 changed)", blank: [57, 58, 59, 61], replace: { 56: "                    int top = stack.pop();" } },
    exception: { label: "the exception: no try around divide (lines 90 and 92 to 98 blank)", blank: [90, 92, 93, 94, 95, 96, 97, 98], replace: {} },
    wrapper: { label: "the wrapper: getAsInt without isEmpty (lines 64 to 66 and 68 blank)", blank: [64, 65, 66, 68], replace: {} },
    "wrapper-int": { label: "the wrapper, stored in an int (line 63 changed): does not compile", blank: [64, 65, 66, 68], replace: { 63: "                    int top = stack.top();", 67: "                        System.out.println(top);" },
      compileError: "Calculator.java:63: error: incompatible types: OptionalInt cannot be converted to int\n                    int top = stack.top();\n                                       ^\n1 error" },
    checked: { label: "the checked exception: no try around subtract (lines 76 and 78 to 81 blank): does not compile", blank: [76, 78, 79, 80, 81], replace: {},
      compileError: "Calculator.java:77: error: unreported exception StackException; must be caught or declared to be thrown\n                        stack.subtract();\n                                      ^\n1 error" },
    "checked-declared": { label: "the checked exception, with main declaring throws StackException (line 38 changed)", blank: [76, 78, 79, 80, 81],
      replace: { 38: "    public static void main(String[] args) throws StackException {" } },
  };

  const wrapInt = (x) => x | 0;
  function parseIntJava(s) {
    if (!/^[+-]?[0-9]+$/.test(s)) return null;
    const v = Number(s); // up to 2^53 exactly; longer strings are out of range anyway
    if (s.replace(/^[+-]?0*/, "").length > 10 || v < MIN || v > MAX) return null;
    return v === 0 ? 0 : v; // -0 -> 0
  }
  const divJava = (a, b) => (a === MIN && b === -1 ? MIN : Math.trunc(a / b));
  function splitLines(input) {
    if (input === "") return [];
    const parts = input.split(/\r\n|[\n\r\u2028\u2029\u0085]/);
    if (/(\r\n|[\n\r\u2028\u2029\u0085])$/.test(input)) parts.pop();
    return parts;
  }

  class Crash extends Error {
    constructor(trace) { super(trace); this.trace = trace; }
  }

  function run(variant, input) {
    const V = VARIANTS[variant];
    if (!V) throw new Error(`unknown variant ${variant}`);
    if (V.compileError) return { stdout: "", stderr: "", status: null, transcript: [], compileError: V.compileError };
    const items = [];
    const t = [];
    let stdout = "", stderr = "";
    const out = (s) => { stdout += s + "\n"; t.push({ out: s }); };
    const show = () => `[${items.join(" ")}]`;
    const pop = () => (items.length === 0 ? null : items.pop());
    const intOf = (v, frames) => { if (v === null) throw new Crash(`Exception in thread "main" ${NPE}\n${frames}`); return v; };
    let status = 0;
    try {
      for (const line of [...splitLines(input), undefined]) {
        stdout += "> "; t.push({ prompt: "> " });
        if (line === undefined) break;
        t.push({ typed: line });
        let quit = false;
        for (const token of line.split(/[ \t\n\x0B\f\r]+/)) {
          if (token === "") continue;
          if (token === "q") { quit = true; break; }
          if (token === "p") out(show());
          else if (token === ".") {
            if (variant === "special-int") { const v = intOf(pop(), "\tat Calculator.main(Calculator.java:56)"); out(String(v)); }
            else if (variant === "special-integer") { const v = pop(); out(v === null ? "null" : String(v)); }
            else { const v = pop(); out(v === null ? "error: stack is empty" : String(v)); }
          } else if (token === "t") {
            if (items.length === 0) {
              if (variant === "wrapper") throw new Crash('Exception in thread "main" java.util.NoSuchElementException: No value present\n\tat java.base/java.util.OptionalInt.getAsInt(OptionalInt.java:130)\n\tat Calculator.main(Calculator.java:67)');
              out("error: stack is empty");
            } else out(String(items[items.length - 1]));
          } else if (token === "+") {
            if (items.length < 2) { if (variant !== "flag") out("error: need two numbers to add"); }
            else { const b = pop(), a = pop(); items.push(wrapInt(a + b)); }
          } else if (token === "-") {
            if (items.length < 2) {
              if (variant === "checked-declared") throw new Crash('Exception in thread "main" StackException: need two numbers to subtract\n\tat CalcStack.subtract(Calculator.java:170)\n\tat Calculator.main(Calculator.java:77)');
              out("error: need two numbers to subtract");
            } else { const b = pop(), a = pop(); items.push(wrapInt(a - b)); }
          } else if (token === "*") {
            if (items.length < 2 && variant !== "precondition") out("error: need two numbers to multiply");
            else {
              const fr = "\tat CalcStack.multiply(Calculator.java:182)\n\tat Calculator.main(Calculator.java:87)";
              const b = intOf(pop(), fr), a = intOf(pop(), fr);
              items.push(Math.imul(a, b));
            }
          } else if (token === "/") {
            const tooFew = items.length < 2;
            if (tooFew) {
              if (variant === "exception") throw new Crash('Exception in thread "main" TooFewOperandsException: need two numbers to divide\n\tat CalcStack.divide(Calculator.java:198)\n\tat Calculator.main(Calculator.java:91)');
              out("error: need two numbers to divide");
            } else {
              const b = pop(), a = pop();
              if (b === 0) {
                items.push(a, b);
                if (variant === "exception") throw new Crash('Exception in thread "main" DivideByZeroException: cannot divide by zero\n\tat CalcStack.divide(Calculator.java:204)\n\tat Calculator.main(Calculator.java:91)');
                out("error: cannot divide by zero");
              } else items.push(divJava(a, b));
            }
          } else {
            const v = parseIntJava(token);
            if (v === null) out(`error: don't understand '${token}'`);
            else items.push(v);
          }
        }
        if (quit) break;
      }
    } catch (e) {
      if (!(e instanceof Crash)) throw e;
      stderr = e.trace + "\n";
      t.push({ err: e.trace });
      status = 1;
    }
    return { stdout, stderr, status, transcript: t, stack: show() };
  }

  return { VARIANTS, run, parseIntJava, splitLines };
});
