"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const fmt = (x) => {
  if (typeof x === "bigint") return x.toLocaleString("en-US");
  // past 2^53 a float's trailing digits are noise, so show 4 significant figures
  if (Math.abs(x) > 1e15) {
    const [m, e] = x.toExponential(3).split("e");
    return `≈ ${m} × 10${[...String(Number(e))].map((c) => SUP[c]).join("")}`;
  }
  return Math.round(x).toLocaleString("en-US");
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

function slot(value, label, extraClass = "") {
  const s = el("div", { class: `slot ${extraClass}`.trim() });
  s.append(el("b", { text: String(value) }));
  if (label) s.append(el("span", { text: label }));
  return s;
}
const op = (sym) => el("span", { class: "op", text: sym });

/* =========================================================== transient notices (never a persistent "saved" line) */
function toast(msg, kind = "error") {
  let box = $(".toasts");
  if (!box) { box = el("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.append(box); }
  const t = el("div", { class: `toast ${kind}` }, el("span", { text: msg }), el("button", { class: "toast-x", "aria-label": "Dismiss", text: "×" }));
  t.lastChild.addEventListener("click", () => t.remove());
  box.append(t);
  setTimeout(() => t.remove(), 8000);
}

/* =========================================================== mobile menu: #menu-btn toggles .rail.open */
function setupMenu() {
  const b = $("#menu-btn");
  if (!b) return;
  b.addEventListener("click", () => {
    const open = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(open));
    $(".rail").classList.toggle("open", open);
  });
  $$(".rail-body a").forEach((a) => a.addEventListener("click", () => { b.setAttribute("aria-expanded", "false"); $(".rail").classList.remove("open"); }));
}

/* =========================================================== routing */
const PAGES = $$(".page").map((p) => ({ id: p.id, title: p.dataset.title }));

function show(id) {
  if (!PAGES.some((p) => p.id === id)) id = "home";
  $$(".page").forEach((p) => p.classList.toggle("is-active", p.id === id));
  $$(".rail a[href^='#']").forEach((a) => {
    if (a.classList.contains("brand")) return;
    a.toggleAttribute("aria-current", a.getAttribute("href") === `#${id}`);
    if (a.hasAttribute("aria-current")) a.setAttribute("aria-current", "page");
  });
  const page = PAGES.find((p) => p.id === id);
  document.title = `${page.title} · CSE 312 week 1`;
  window.scrollTo(0, 0);
}

function currentIndex() {
  const id = location.hash.slice(1) || "home";
  return Math.max(0, PAGES.findIndex((p) => p.id === id));
}
function go(delta) {
  const i = currentIndex() + delta;
  if (i >= 0 && i < PAGES.length) location.hash = PAGES[i].id;
}

function buildPagers() {
  $$(".page").forEach((page) => {
    const nav = $(".pager", page);
    if (!nav) return;
    const i = PAGES.findIndex((p) => p.id === page.id);
    if (i > 0) {
      const a = el("a", { href: `#${PAGES[i - 1].id}` }, el("span", { text: "Previous" }), PAGES[i - 1].title);
      nav.append(a);
    }
    if (i < PAGES.length - 1) {
      const a = el("a", { href: `#${PAGES[i + 1].id}`, class: "next" }, el("span", { text: "Next" }), PAGES[i + 1].title);
      nav.append(a);
    }
  });
}

/* =========================================================== keys */

function nextStepOnPage() {
  const page = $(".page.is-active");
  for (const steps of $$(".steps", page)) {
    if (steps.closest(".solution[hidden]")) continue;
    const hidden = $("li[hidden]", steps);
    if (hidden) {
      steps._reveal();
      hidden.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      return;
    }
  }
}

document.addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "ArrowRight") go(1);
  else if (e.key === "ArrowLeft") go(-1);
  else if (e.key === "n" || e.key === "N") nextStepOnPage();
  else if (e.key === "h" || e.key === "H") nextHintOnPage();
});

/* =========================================================== step reveals */
function setupSteps() {
  $$(".steps").forEach((steps) => {
    const items = $$("li", steps);
    let shown = 0;
    const bar = el("div", { class: "step-bar" });
    const next = el("button", { class: "btn primary", text: "Show next step" });
    const all = el("button", { class: "btn", text: "Show all" });
    const reset = el("button", { class: "btn", text: "Hide steps" });
    const count = el("span", { class: "brute" });
    bar.append(next, all, reset, count);
    steps.append(bar);

    function render(justShown) {
      items.forEach((li, i) => {
        li.hidden = i >= shown;
        li.classList.toggle("just-shown", i === justShown);
      });
      next.disabled = shown >= items.length;
      next.textContent = shown === 0 ? "Show first step" : shown >= items.length ? "All steps shown" : "Show next step";
      count.textContent = `${shown} of ${items.length} steps shown`;
    }
    steps._reveal = () => {
      if (shown < items.length) { shown++; render(shown - 1); }
    };
    next.addEventListener("click", steps._reveal);
    all.addEventListener("click", () => { shown = items.length; render(-1); });
    reset.addEventListener("click", () => { shown = 0; render(-1); });
    render(-1);
  });
}

/* =========================================================== quick checks */
function fact(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

const factOrNaN = (x) => (Number.isInteger(x) && x >= 0 ? fact(x) : NaN);

// Evaluates answers like "13!", "5!*2^5", "n!(m!)^n" or "n!/(n-k)!".
// vars maps single-letter variable names to numbers; "nm" means n*m.
function evalFormula(raw, vars = {}) {
  let s = String(raw).toLowerCase().replace(/[\s,]/g, "").replace(/[×·⋅]/g, "*").replace(/[−–]/g, "-");
  if (!s || /[^0-9a-z+\-*/().!^]/.test(s)) return NaN;
  let bad = false;
  s = s.replace(/[a-z]+/g, (tok) => {
    if (tok in vars) return `(${vars[tok]})`;
    if ([...tok].every((c) => c in vars)) return [...tok].map((c) => `(${vars[c]})`).join("*");
    bad = true;
    return "";
  });
  if (bad) return NaN;
  // implicit multiplication: 2(3), (2)(3), (2)3, 3!(2), 3!2
  s = s.replace(/(\d|\)|!)(?=\()/g, "$1*").replace(/(\)|!)(?=\d)/g, "$1*");
  // postfix factorial: turn "X!" into "F(X)" where X is a number or a (...) group
  for (let i = s.indexOf("!"); i !== -1; i = s.indexOf("!")) {
    let j = i - 1;
    if (s[j] === ")") {
      let depth = 0;
      for (; j >= 0; j--) {
        if (s[j] === ")") depth++;
        if (s[j] === "(" && --depth === 0) break;
      }
      if (j < 0) return NaN;
    } else {
      while (j >= 0 && /[\d.]/.test(s[j])) j--;
      j++;
      if (j === i) return NaN;
    }
    s = `${s.slice(0, j)}F(${s.slice(j, i)})${s.slice(i + 1)}`;
  }
  s = s.replace(/\^/g, "**");
  try {
    const v = Function("F", `"use strict"; return (${s});`)(factOrNaN);
    return typeof v === "number" && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

const evalExpr = (raw) => evalFormula(raw, {});
const sameNumber = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

const normText = (s) =>
  s.toLowerCase().replace(/\s/g, "").replace(/[×·⋅]/g, "*").replace(/[…⋯]/g, "...").replace(/[−–]/g, "-")
    .replace(/[₁]/g, "1").replace(/[₂]/g, "2").replace(/ₘ/g, "m");

function setupChecks() {
  $$(".check").forEach((box) => {
    const input = $("input", box);
    const fb = $(".feedback", box);
    const button = $("button.primary", box);
    const check = () => {
      const val = input.value.trim();
      if (!val) { fb.className = "feedback"; fb.textContent = "Type an answer first."; return; }
      let ok;
      if (box.dataset.answer) {
        const want = evalExpr(box.dataset.answer);
        const got = evalExpr(val);
        if (Number.isNaN(got)) {
          fb.className = "feedback bad";
          fb.textContent = "Couldn't read that. Use numbers with + − * / ^ ! and parentheses.";
          return;
        }
        ok = Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
        fb.className = `feedback ${ok ? "ok" : "bad"}`;
        fb.textContent = ok ? `Correct: ${fmt(want)}.` : `Not quite. You have ${fmt(got)}. Try again.`;
      } else {
        const options = box.dataset.answerText.split("|").map(normText);
        ok = options.includes(normText(val));
        fb.className = `feedback ${ok ? "ok" : "bad"}`;
        fb.textContent = ok ? "Correct." : "Not quite. Compare with the rule above, or press Show.";
      }
    };
    button.addEventListener("click", check);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
    const reveal = $("button.reveal", box);
    if (reveal) reveal.addEventListener("click", () => {
      fb.className = "feedback ok";
      fb.textContent = reveal.dataset.reveal;
    });
  });
}

/* =========================================================== hero: letter slots */
function setupHero() {
  const wrap = $("#hero-slots");
  const alpha = $("#hero-alpha");
  const strip = $("#hero-strip");
  const msg = $("#hero-msg");
  const repeatBtn = $("#hero-repeat");
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  let repeats = false;

  const inputs = [];
  for (let i = 0; i < 5; i++) {
    const s = el("div", { class: "slot" });
    const inp = el("input", { type: "text", maxlength: "1", "aria-label": `Letter ${i + 1}`, autocomplete: "off", spellcheck: "false" });
    const lab = el("span");
    s.append(inp, lab);
    wrap.append(s);
    inputs.push(inp);
    inp.addEventListener("input", () => onInput(i));
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !inp.value && i > 0) inputs[i - 1].focus();
    });
  }
  LETTERS.forEach((L) => alpha.append(el("span", { text: L })));

  function onInput(i) {
    const inp = inputs[i];
    const v = inp.value.toUpperCase().replace(/[^A-Z]/g, "");
    inp.value = v;
    inp.classList.remove("bad");
    msg.textContent = "";
    if (v && !repeats) {
      const j = inputs.findIndex((o, k) => k !== i && o.value.toUpperCase() === v);
      if (j !== -1) {
        inp.classList.add("bad");
        msg.textContent = `${v} is already in slot ${j + 1}. Letters must all be different.`;
        inp.value = "";
        render();
        return;
      }
    }
    if (v && i < 4) inputs[i + 1].focus();
    render();
  }

  function render() {
    const used = new Set(inputs.map((x) => x.value.toUpperCase()).filter(Boolean));
    inputs.forEach((inp, i) => {
      inp.nextElementSibling.textContent = repeats ? "26 options" : `${26 - i} options left`;
    });
    $$("span", alpha).forEach((s) => s.classList.toggle("used", !repeats && used.has(s.textContent)));
    alpha.style.visibility = repeats ? "hidden" : "visible";

    strip.replaceChildren();
    const nums = repeats ? [26, 26, 26, 26, 26] : [26, 25, 24, 23, 22];
    nums.forEach((n, i) => {
      strip.append(slot(n));
      strip.append(op(i < 4 ? "×" : "="));
    });
    const total = nums.reduce((a, b) => a * b, 1);
    strip.append(slot(fmt(total), repeats ? "strings, repeats allowed (26⁵)" : "strings with distinct letters", "total"));

    const word = inputs.map((x) => x.value.toUpperCase()).join("");
    if (word.length === 5 && !msg.textContent) {
      msg.textContent = `${word} is one of ${fmt(total)}.`;
    }
  }

  repeatBtn.addEventListener("click", () => {
    repeats = !repeats;
    repeatBtn.setAttribute("aria-pressed", String(repeats));
    msg.textContent = repeats ? "Repeats allowed: every slot has 26 options, so STEVE and SARAH count now." : "";
    render();
  });
  $("#hero-clear").addEventListener("click", () => {
    inputs.forEach((x) => { x.value = ""; x.classList.remove("bad"); });
    msg.textContent = "";
    render();
    inputs[0].focus();
  });
  render();
}

/* =========================================================== subs */
function setupSubs() {
  const groups = [
    ["Cheese", ["Swiss", "Cheddar"]],
    ["Meat", ["Turkey", "Ham", "Salami"]],
    ["Veggie", ["Lettuce", "Tomato", "Onion"]],
  ];
  const pick = [0, 0, 0];
  const box = $("#sub-choices"), grid = $("#sub-grid"), out = $("#sub-out");

  groups.forEach(([name, opts], g) => {
    const row = el("div", { class: "choice-col", role: "group", "aria-label": name }, el("span", { text: name }));
    opts.forEach((o, i) => {
      const b = el("button", { class: "chip", "aria-pressed": String(i === 0), text: o });
      b.addEventListener("click", () => {
        pick[g] = i;
        $$("button", row).forEach((x, k) => x.setAttribute("aria-pressed", String(k === i)));
        render();
      });
      row.append(b);
    });
    box.append(row);
  });

  const all = [];
  groups[0][1].forEach((_, a) => groups[1][1].forEach((_, b) => groups[2][1].forEach((_, c) => all.push([a, b, c]))));
  all.forEach(([a, b, c]) => grid.append(el("div", { text: `${groups[0][1][a]}, ${groups[1][1][b]}, ${groups[2][1][c]}` })));

  function render() {
    let idx = -1;
    [...grid.children].forEach((d, i) => {
      const [a, b, c] = all[i];
      const on = a === pick[0] && b === pick[1] && c === pick[2];
      if (on) idx = i;
      d.classList.toggle("on", on);
      d.classList.toggle("near", !on && a === pick[0] && b === pick[1]);
    });
    out.textContent = `Your sub is #${idx + 1} of 18. The shaded ones share your cheese and meat: there are 3 of them, one per veggie.`;
  }
  render();
}

/* =========================================================== power set */
function setupPower() {
  const nIn = $("#pow-n"), bitsBox = $("#pow-bits"), list = $("#pow-list"), out = $("#pow-out");
  let n = 3, mask = 0b101;

  const subsetText = (m) => {
    const els = [];
    for (let i = 0; i < n; i++) if (m & (1 << (n - 1 - i))) els.push(i + 1);
    return els.length ? `{${els.join(", ")}}` : "∅";
  };
  const bitString = (m) => m.toString(2).padStart(n, "0");

  function build() {
    n = Math.min(5, Math.max(1, Number(nIn.value) || 1));
    mask &= (1 << n) - 1;
    bitsBox.replaceChildren();
    for (let i = 0; i < n; i++) {
      const bit = 1 << (n - 1 - i);
      const b = el("button", { "aria-pressed": String(Boolean(mask & bit)), "aria-label": `Element ${i + 1}` });
      b.append(el("b", { text: String(i + 1) }), el("small"));
      b.addEventListener("click", () => { mask ^= bit; render(); });
      bitsBox.append(b);
    }
    list.replaceChildren();
    for (let m = 0; m < 1 << n; m++) {
      list.append(el("div", {}, el("code", { text: bitString(m) }), subsetText(m)));
    }
    render();
  }

  function render() {
    [...bitsBox.children].forEach((b, i) => {
      const on = Boolean(mask & (1 << (n - 1 - i)));
      b.setAttribute("aria-pressed", String(on));
      b.querySelector("small").textContent = on ? "in · 1" : "out · 0";
    });
    [...list.children].forEach((d, m) => d.classList.toggle("on", m === mask));
    out.textContent = `Bit string ${bitString(mask)} ↔ ${subsetText(mask)}.  ${Array(n).fill("2").join(" × ")} = ${1 << n} subsets in total.`;
  }

  nIn.addEventListener("input", build);
  build();
}

/* =========================================================== permutation tree */
function setupTree() {
  const svg = $("#tree"), legend = $("#tree-legend"), btn = $("#tree-mode");
  const NS = "http://www.w3.org/2000/svg";
  let allowRepeats = false;

  function svgEl(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  }

  function render() {
    svg.replaceChildren();
    const W = 960, left = 150, levels = [30, 110, 190, 270], leafY = 310;
    const kids = (seq) => [1, 2, 3].filter((d) => allowRepeats || !seq.includes(d));

    // collect leaves for x positions
    const leaves = [];
    (function walk(seq) {
      if (seq.length === 3) { leaves.push(seq); return; }
      kids(seq).forEach((d) => walk([...seq, d]));
    })([]);
    const step = (W - left - 20) / leaves.length;
    const leafX = new Map(leaves.map((s, i) => [s.join(""), left + step * (i + 0.5)]));

    function place(seq) {
      if (seq.length === 3) return leafX.get(seq.join(""));
      const xs = kids(seq).map((d) => place([...seq, d]));
      return (xs[0] + xs[xs.length - 1]) / 2;
    }

    (function draw(seq) {
      const x = place(seq), y = levels[seq.length];
      if (seq.length < 3) {
        kids(seq).forEach((d) => {
          const c = [...seq, d];
          svg.append(svgEl("line", { x1: x, y1: y + 8, x2: place(c), y2: levels[c.length] - 14, class: "edge" }));
          draw(c);
        });
      }
      if (seq.length === 0) {
        svg.append(svgEl("circle", { cx: x, cy: y, r: 6, fill: "var(--a1)" }));
      } else {
        svg.append(svgEl("text", { x, y: y + 4, "text-anchor": "middle", "font-weight": "700" }, String(seq[seq.length - 1])));
      }
      if (seq.length === 3) {
        const rep = new Set(seq).size < 3;
        const cls = rep ? "leaf-rep" : "leaf-ok";
        if (allowRepeats) {
          // 27 leaves are too tight for "123" side by side, so stack the digits
          seq.forEach((d, k) => svg.append(svgEl("text", { x, y: leafY + 8 + k * 16, "text-anchor": "middle", class: cls }, String(d))));
        } else {
          svg.append(svgEl("text", { x, y: leafY + 8, "text-anchor": "middle", class: cls, "font-size": "16" }, seq.join("")));
        }
      }
    })([]);

    const counts = allowRepeats ? ["3 options", "3 options", "3 options"] : ["3 options", "2 options", "1 option"];
    ["1st entry", "2nd entry", "3rd entry"].forEach((t, i) => {
      svg.append(svgEl("text", { x: 0, y: levels[i + 1] + 4, fill: "var(--ink-soft)" }, `${t}: ${counts[i]}`));
    });
    svg.setAttribute("viewBox", `0 0 ${W} ${leafY + (allowRepeats ? 52 : 20)}`);

    const rep = leaves.filter((s) => new Set(s).size < 3).length;
    legend.replaceChildren(
      el("span", {}, el("span", { class: "sw", style: "background:var(--a1)" }), `No repeats: ${leaves.length - rep}`),
    );
    if (allowRepeats) {
      legend.append(
        el("span", {}, el("span", { class: "sw", style: "background:var(--a2)" }), `Has a repeat: ${rep}`),
        el("span", { text: `Total 3³ = ${leaves.length}, so repeats = 27 − 6 = ${rep}` }),
      );
    } else {
      legend.append(el("span", { text: "3 · 2 · 1 = 3! = 6" }));
    }
  }

  btn.addEventListener("click", () => {
    allowRepeats = !allowRepeats;
    btn.setAttribute("aria-pressed", String(allowRepeats));
    btn.textContent = allowRepeats ? "Show only sequences without repeats" : "Show all 27 sequences, including repeats";
    render();
  });
  render();
}

/* =========================================================== k-permutations */
function setupKPerm() {
  const nIn = $("#kp-n"), kIn = $("#kp-k"), strip = $("#kp-strip");
  function render() {
    const n = Math.max(1, Math.min(60, Number(nIn.value) || 1));
    const k = Math.max(0, Math.min(60, Number(kIn.value) || 0));
    strip.replaceChildren();
    if (k > n) {
      strip.append(el("p", { text: `k = ${k} is more than n = ${n}: you can't pick ${k} distinct items, so P(n, k) = 0.` }));
      return;
    }
    if (k === 0) {
      strip.append(slot("1", "the empty sequence", "total"));
      return;
    }
    const factors = Array.from({ length: k }, (_, i) => n - i);
    const shown = k <= 8 ? factors : [...factors.slice(0, 3), "⋯", ...factors.slice(-2)];
    shown.forEach((f, i) => {
      strip.append(f === "⋯" ? op("⋯") : slot(f));
      strip.append(op(i < shown.length - 1 ? (f === "⋯" || shown[i + 1] === "⋯" ? "" : "×") : "="));
    });
    const total = factors.reduce((a, b) => a * BigInt(b), 1n);
    strip.append(slot(fmt(total), `P(${n}, ${k}) = ${n}!/${n - k}!`, "total"));
  }
  nIn.addEventListener("input", render);
  kIn.addEventListener("input", render);
  render();
}

/* =========================================================== brute force */
const BRUTE = {
  divisors() {
    let count = 0;
    for (let d = 1; d <= 1440; d++) if (1440 % d === 0) count++;
    return { count, total: 1440, of: "numbers from 1 to 1440", expected: 36 };
  },
};

function setupBrute() {
  $$("[data-brute]").forEach((btn) => {
    const out = btn.nextElementSibling;
    btn.addEventListener("click", () => {
      out.className = "brute";
      out.textContent = "Counting…";
      btn.disabled = true;
      setTimeout(() => {
        const t0 = performance.now();
        const r = BRUTE[btn.dataset.brute]();
        const ms = Math.round(performance.now() - t0);
        btn.disabled = false;
        if (r.error) { out.textContent = r.error; return; }
        const match = r.count === r.expected;
        out.className = `brute ${match ? "ok" : ""}`;
        out.textContent = `Found ${fmt(r.count)} after checking all ${fmt(r.total)} ${r.of} in ${ms} ms. ${match ? "Matches the formula." : `Formula gives ${fmt(r.expected)}.`}`;
      }, 30);
    });
  });
}

/* =========================================================== section tasks: answer, work, hints, solution, saved */
// Storage. Everything that reads or writes saved work goes through loadStore() and persist(),
// so a backend can replace these two functions. Shape: { version: 1, problems: { [data-id]: state } },
// where state is blankState() below. For now it lives in this browser's localStorage.
const STORE_KEY = "cse312-answers-v1";
const KATEX_OPTS = {
  delimiters: [
    { left: "\\[", right: "\\]", display: true },
    { left: "\\(", right: "\\)", display: false },
  ],
  throwOnError: false,
};
// Keep punctuation that touches short inline math on the same line as the math, e.g. "(\\(A\\))" or "\\(c = 10\\),".
// Long formulas are left alone so KaTeX can still break them on narrow screens. Styled by .math-glue in base.css.
function glueMath(root) {
  root.querySelectorAll(".katex").forEach((k) => {
    if (k.closest(".katex-display, .math-glue")) return;
    const tex = k.querySelector("annotation");
    if (!tex || tex.textContent.length > 16) return;
    if (k.parentElement.tagName === "SPAN" && !k.parentElement.className && k.parentElement.childNodes.length === 1) k = k.parentElement;
    const nx = k.nextSibling, pv = k.previousSibling;
    const tail = nx && nx.nodeType === 3 && /^[,.;:!?)\]’”]+/.exec(nx.data);
    const head = pv && pv.nodeType === 3 && /[(\[‘“]+$/.exec(pv.data);
    if (!tail && !head) return;
    const span = el("span", { class: "math-glue" });
    k.before(span);
    if (head) span.append(pv.splitText(pv.data.length - head[0].length));
    span.append(k);
    if (tail) { nx.splitText(tail[0].length); span.append(nx); }
  });
}
const renderMath = (node) => { if (window.renderMathInElement) { renderMathInElement(node, KATEX_OPTS); glueMath(node); } };

function loadStore() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY));
    if (data && typeof data.problems === "object") return data;
  } catch { /* fall through to an empty store */ }
  return { version: 1, problems: {} };
}
let store = loadStore();
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); return true; } catch { return false; }
}

const blankState = () => ({ answers: [], work: "", hintsShown: 0, solutionSeen: false, solutionOpen: false, result: null, selfMark: null, updatedAt: null });
const TASKS = new Map();

function statusOf(s) {
  if (s.result === "right" || s.selfMark === "got") return ["Correct", "ok"];
  if (s.result === "wrong" || s.selfMark === "missed") return ["Not yet", "bad"];
  if (s.solutionSeen) return ["Solution viewed", "seen"];
  if (s.answers.some(Boolean) || s.work.trim() || s.hintsShown) return ["In progress", "prog"];
  return ["Not started", ""];
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function varCombos(vars) {
  return Object.entries(vars).reduce(
    (acc, [name, values]) => acc.flatMap((c) => values.map((v) => ({ ...c, [name]: v }))),
    [{}],
  );
}

// true = right, false = wrong, null = couldn't read it; detail explains a wrong formula
function checkSpec(spec, value) {
  const v = value.trim();
  if (spec.dataset.yesno) {
    const word = v.toLowerCase();
    if (!/^(y|n)/.test(word)) return { ok: null };
    return { ok: word[0] === spec.dataset.yesno[0] };
  }
  if (spec.dataset.vars) {
    const combos = varCombos(JSON.parse(spec.dataset.vars)).filter((c) => !Number.isNaN(evalFormula(spec.dataset.answer, c)));
    if (Number.isNaN(evalFormula(v, combos[combos.length - 1]))) return { ok: null };
    for (const c of combos) {
      const want = evalFormula(spec.dataset.answer, c);
      const got = evalFormula(v, c);
      if (Number.isNaN(got) || !sameNumber(got, want)) {
        const at = Object.entries(c).map(([k, x]) => `${k} = ${x}`).join(", ");
        return { ok: false, detail: `It doesn't hold for ${at}: yours gives ${Number.isNaN(got) ? "no number" : fmt(got)}. Try that small case by hand.` };
      }
    }
    return { ok: true };
  }
  const got = evalExpr(v);
  if (Number.isNaN(got)) return { ok: null };
  return { ok: sameNumber(got, evalExpr(spec.dataset.answer)), got };
}

function buildTask(task) {
  const id = task.dataset.id;
  const title = $("h2", task).textContent;
  const specs = $$(".answer-spec", task);
  const allSelf = specs.every((s) => s.hasAttribute("data-self"));
  const hintList = $(".hints", task);
  const hintItems = hintList ? $$("li", hintList) : [];
  const solution = $(".solution", task);
  let state = { ...blankState(), ...store.problems[id] };

  // status pill in the heading
  const pill = el("span", { class: "pill" });
  $("h2", task).append(" ", pill);

  // answer rows
  const myWork = el("div", { class: "my-work" });
  task.insertBefore(myWork, specs[0]);
  const rows = el("div", { class: "ans-rows" });
  myWork.append(rows);
  const inputs = specs.map((spec, i) => {
    const inputId = `${id}-a${i}`;
    const label = spec.dataset.label || (specs.length === 1 ? "Your answer" : `Part ${i + 1}`);
    const input = el("input", {
      type: "text", id: inputId, autocomplete: "off", spellcheck: "false",
      placeholder: spec.dataset.placeholder || (spec.hasAttribute("data-self") ? "your answer" : "e.g. 3*12! or 2^5"),
    });
    spec.classList.add("ans-row");
    spec.append(el("label", { for: inputId, text: label }), input);
    if (spec.hasAttribute("data-self")) spec.append(el("span", { class: "where", text: "check against the solution" }));
    rows.append(spec);
    input.addEventListener("input", () => {
      state.answers[i] = input.value;
      state.result = null;
      inputs.forEach((x) => x.classList.remove("ok", "bad"));
      fb.textContent = "";
      fb.className = "feedback";
      saveSoon();
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !allSelf) check(); });
    return input;
  });

  const checkBar = el("div", { class: "row" });
  const checkBtn = el("button", { class: "btn primary", text: specs.length > 1 ? "Check answers" : "Check" });
  const fb = el("p", { class: "feedback", role: "status" });
  if (!allSelf) checkBar.append(checkBtn);
  myWork.append(checkBar, fb);

  // work box
  const workId = `${id}-work`;
  const work = el("textarea", { id: workId, rows: "4", placeholder: "Explain how you got your answer. Math works too, e.g. \\( 3 \\cdot 12! \\)" });
  const preview = el("div", { class: "work-preview", "aria-live": "polite" });
  preview.hidden = true;
  myWork.append(el("label", { class: "work-label", for: workId, text: "Your work" }), work, preview);

  const renderPreview = debounce(() => {
    const has = /\\\(|\\\[/.test(work.value);
    preview.hidden = !has;
    if (has) { preview.textContent = work.value; renderMath(preview); }
  }, 300);
  work.addEventListener("input", () => { state.work = work.value; renderPreview(); saveSoon(); });

  // actions: hints, solution, clear
  const actions = el("div", { class: "task-actions" });
  const hintBtn = el("button", { class: "btn" });
  const solBtn = el("button", { class: "btn" });
  const clearBtn = el("button", { class: "btn quiet", text: "Clear my work" });
  if (hintItems.length) actions.append(hintBtn);
  actions.append(solBtn, clearBtn);
  task.insertBefore(actions, hintList || solution);

  const selfMark = el("div", { class: "self-mark" });
  const gotBtn = el("button", { class: "chip", text: "I got it" });
  const missBtn = el("button", { class: "chip", text: "I missed something" });
  selfMark.append(el("span", { text: "How did you do? " }), gotBtn, missBtn);
  if (allSelf) solution.after(selfMark);

  let armed = false;

  function render() {
    const [label, cls] = statusOf(state);
    pill.textContent = label;
    pill.className = `pill ${cls}`;
    hintItems.forEach((li, i) => { li.hidden = i >= state.hintsShown; });
    if (hintList) hintList.hidden = state.hintsShown === 0;
    const n = hintItems.length, k = state.hintsShown;
    hintBtn.textContent = k === 0 ? `Need a hint? (${n} available)` : k < n ? `Another hint (${k} of ${n} shown)` : `All ${n} hints shown`;
    hintBtn.disabled = k >= n;
    solution.hidden = !state.solutionOpen;
    solBtn.textContent = state.solutionOpen ? "Hide solution" : armed ? "Show solution anyway" : "Show solution";
    selfMark.hidden = !state.solutionOpen;
    gotBtn.setAttribute("aria-pressed", String(state.selfMark === "got"));
    missBtn.setAttribute("aria-pressed", String(state.selfMark === "missed"));
  }

  function save() {
    state.updatedAt = new Date().toISOString();
    store.problems[id] = state;
    const ok = persist();
    render();
    if (!ok) toast("Couldn't save your work: this browser is blocking local storage. It stays on this page until you reload.");
    updateProgress();
  }
  const saveSoon = debounce(save, 400);

  function check() {
    const auto = specs.map((spec, i) => ({ spec, i })).filter(({ spec }) => !spec.hasAttribute("data-self"));
    if (auto.some(({ i }) => !inputs[i].value.trim())) {
      fb.className = "feedback";
      fb.textContent = auto.length > 1 ? "Fill in every answer box first." : "Type an answer first.";
      return;
    }
    const results = auto.map(({ spec, i }) => ({ i, ...checkSpec(spec, inputs[i].value) }));
    results.forEach(({ i, ok }) => {
      inputs[i].classList.toggle("ok", ok === true);
      inputs[i].classList.toggle("bad", ok === false);
    });
    if (results.some((r) => r.ok === null)) {
      const vars = auto.some(({ spec }) => spec.dataset.vars);
      const yesno = auto.some(({ spec }) => spec.dataset.yesno);
      fb.className = "feedback bad";
      fb.textContent = yesno
        ? "Answer yes or no, and put your reasoning in the work box."
        : `Couldn't read that. Use numbers${vars ? ", the letters in the problem (like n and m)," : ""} and + − * / ^ ! with parentheses.`;
      return;
    }
    const right = results.filter((r) => r.ok).length;
    const all = right === results.length;
    state.result = all ? "right" : "wrong";
    fb.className = `feedback ${all ? "ok" : "bad"}`;
    if (all) {
      const only = results.length === 1 && results[0].got !== undefined;
      fb.textContent = only ? `Correct: ${fmt(results[0].got)}.` : "Correct.";
    } else if (results.length > 1) {
      fb.textContent = `${right} of ${results.length} right. The boxes in red need another look.`;
    } else {
      const r = results[0];
      fb.textContent = r.detail || (r.got !== undefined ? `Not quite. You have ${fmt(r.got)}. Try again, or ask for a hint.` : "Not quite. Try again, or ask for a hint.");
    }
    save();
  }

  checkBtn.addEventListener("click", check);
  hintBtn.addEventListener("click", () => {
    state.hintsShown = Math.min(hintItems.length, state.hintsShown + 1);
    const li = hintItems[state.hintsShown - 1];
    save();
    li.classList.add("just-shown");
  });
  solBtn.addEventListener("click", () => {
    if (state.solutionOpen) { state.solutionOpen = false; save(); return; }
    const answered = inputs.some((x) => x.value.trim());
    if (!answered && !armed && !state.solutionSeen) {
      armed = true;
      fb.className = "feedback";
      fb.textContent = "You haven't answered yet. Press the button again to see the solution anyway.";
      render();
      return;
    }
    armed = false;
    state.solutionOpen = true;
    state.solutionSeen = true;
    if (fb.textContent.startsWith("You haven't answered")) fb.textContent = "";
    save();
  });
  gotBtn.addEventListener("click", () => { state.selfMark = "got"; save(); });
  missBtn.addEventListener("click", () => { state.selfMark = "missed"; save(); });
  clearBtn.addEventListener("click", () => {
    if (!confirm(`Clear your answer, work, hints and solution view for "${title}"?`)) return;
    delete store.problems[id];
    persist();
    restore();
    updateProgress();
  });

  function restore() {
    state = { ...blankState(), ...store.problems[id] };
    inputs.forEach((x, i) => { x.value = state.answers[i] || ""; x.classList.remove("ok", "bad"); });
    work.value = state.work;
    armed = false;
    fb.className = `feedback ${state.result === "right" ? "ok" : state.result === "wrong" ? "bad" : ""}`;
    fb.textContent = state.result === "right" ? "Checked: correct." : state.result === "wrong" ? "Last check: not right yet." : "";
    renderPreview();
    render();
  }

  TASKS.set(id, { task, restore, get state() { return state; } });
  restore();
}

function updateProgress() {
  $$(".task-progress").forEach((bar) => {
    const page = bar.closest(".page");
    const states = $$(".task[data-id]", page).map((t) => TASKS.get(t.dataset.id).state);
    const answered = states.filter((s) => s.answers.some(Boolean) || s.selfMark).length;
    const correct = states.filter((s) => s.result === "right" || s.selfMark === "got").length;
    const seen = states.filter((s) => s.solutionSeen).length;
    $(".progress-text", bar).textContent =
      `${answered} of ${states.length} answered · ${correct} correct · ${seen} solution${seen === 1 ? "" : "s"} viewed`;
  });
}

function buildProgressBar(page) {
  const bar = el("div", { class: "task-progress" });
  const text = el("p", { class: "progress-text", role: "status" });
  const clearAll = el("button", { class: "btn quiet", text: "Clear all" });
  const msg = el("span", { class: "where", role: "status" });
  bar.append(text, el("div", { class: "row" }, clearAll, msg));
  page.insertBefore(bar, $(".task[data-id]", page));

  clearAll.addEventListener("click", () => {
    if (!confirm("Clear every saved answer and all work on this site? This can't be undone.")) return;
    store = { version: 1, problems: {} };
    persist();
    TASKS.forEach((t) => t.restore());
    updateProgress();
    msg.textContent = "Cleared.";
  });
}

function setupTasks() {
  $$(".task[data-id]").forEach(buildTask);
  $$(".page").forEach((page) => { if ($(".task[data-id]", page)) buildProgressBar(page); });
  updateProgress();
}

function nextHintOnPage() {
  const mid = innerHeight / 2;
  const candidates = $$(".page.is-active .task[data-id]")
    .map((task) => ({ task, btn: $(".task-actions .btn:not([disabled])", task) }))
    .filter(({ btn }) => btn && btn.textContent.includes("hint"));
  if (!candidates.length) return;
  const dist = (t) => { const r = t.getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - mid); };
  candidates.sort((a, b) => dist(a.task) - dist(b.task));
  candidates[0].btn.click();
}

/* =========================================================== check your understanding */
function setupUnderstand() {
  const items = $$(".cyu");
  const score = $("#cyu-score"), summary = $("#cyu-summary");
  const state = items.map(() => ({ tries: 0, firstCorrect: false, done: false }));

  function update() {
    const done = state.filter((s) => s.done).length;
    const first = state.filter((s) => s.firstCorrect).length;
    score.textContent = `Answered ${done} of ${items.length} · ${first} correct on the first try`;
    summary.replaceChildren();
    if (done < items.length) {
      summary.textContent = `Finish all ${items.length} to see what to review.`;
      return;
    }
    const missed = [...new Set(items.filter((_, i) => !state[i].firstCorrect).map((li) => li.dataset.topic))];
    summary.append(el("strong", { text: `You got ${first} of ${items.length} on the first try. ` }));
    if (!missed.length) {
      summary.append("Nothing to review. You're ready for Section 1.");
    } else {
      summary.append("Worth another look: ");
      missed.forEach((id, k) => {
        const page = PAGES.find((p) => p.id === id);
        summary.append(el("a", { href: `#${id}`, text: page ? page.title : id }));
        if (k < missed.length - 1) summary.append(", ");
      });
      summary.append(".");
    }
    const again = el("button", { class: "btn", text: "Start over" });
    again.addEventListener("click", reset);
    summary.append(" ", again);
  }

  function finish(i, li, correct) {
    const s = state[i];
    if (s.done) return;
    s.tries++;
    if (correct) {
      s.done = true;
      if (s.tries === 1) s.firstCorrect = true;
      li.classList.add("is-right");
    }
    update();
  }

  function reveal(i, li) {
    const s = state[i];
    if (!s.done) { s.done = true; s.tries++; }
    if (li.dataset.kind === "mc") {
      const right = $("label[data-correct]", li);
      right.classList.add("right");
      $(".why", right).hidden = false;
    } else {
      $(":scope > .why", li).hidden = false;
    }
    update();
  }

  items.forEach((li, i) => {
    const bar = el("div", { class: "row" });
    const check = el("button", { class: "btn primary", text: "Check" });
    const show = el("button", { class: "btn", text: "Show answer" });
    const fb = el("p", { class: "feedback", role: "status" });
    let input;

    if (li.dataset.kind === "num") {
      input = el("input", { type: "text", "aria-label": `Answer to question ${i + 1}` });
      bar.append(input);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") check.click(); });
    }
    bar.append(check, show);
    const why = $(":scope > .why", li);
    li.insertBefore(bar, why || null);
    li.insertBefore(fb, why || null);

    check.addEventListener("click", () => {
      if (li.dataset.kind === "mc") {
        const labels = $$("label", li);
        const chosen = labels.find((l) => $("input", l).checked);
        if (!chosen) { fb.className = "feedback"; fb.textContent = "Pick an option first."; return; }
        labels.forEach((l) => { l.classList.remove("right", "wrong"); $(".why", l).hidden = true; });
        const ok = chosen.hasAttribute("data-correct");
        chosen.classList.add(ok ? "right" : "wrong");
        $(".why", chosen).hidden = false;
        fb.className = `feedback ${ok ? "ok" : "bad"}`;
        fb.textContent = ok ? "Correct." : "Not this one. Read why, then try another.";
        finish(i, li, ok);
      } else {
        const got = evalExpr(input.value);
        if (!input.value.trim()) { fb.className = "feedback"; fb.textContent = "Type an answer first."; return; }
        if (Number.isNaN(got)) {
          fb.className = "feedback bad";
          fb.textContent = "Couldn't read that. Use numbers with + − * / ^ ! and parentheses.";
          return;
        }
        const want = evalExpr(li.dataset.answer);
        const ok = Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
        fb.className = `feedback ${ok ? "ok" : "bad"}`;
        fb.textContent = ok ? `Correct: ${fmt(want)}.` : `Not quite. You have ${fmt(got)}. Try again, or press Show answer.`;
        if (ok) why.hidden = false;
        finish(i, li, ok);
      }
    });
    show.addEventListener("click", () => {
      fb.className = "feedback";
      fb.textContent = li.dataset.kind === "num" ? `Answer: ${fmt(evalExpr(li.dataset.answer))}.` : "";
      reveal(i, li);
    });
  });

  function reset() {
    items.forEach((li, i) => {
      state[i] = { tries: 0, firstCorrect: false, done: false };
      li.classList.remove("is-right");
      $$("label", li).forEach((l) => l.classList.remove("right", "wrong"));
      $$(".why", li).forEach((w) => { w.hidden = true; });
      $$("input", li).forEach((x) => { x.checked = false; if (x.type === "text") x.value = ""; });
      const fb = $(".feedback", li);
      fb.className = "feedback";
      fb.textContent = "";
    });
    update();
    window.scrollTo(0, $("#understand").offsetTop);
  }

  update();
}

/* =========================================================== boot */
function boot() {
  buildPagers();
  setupTasks();
  setupSteps();
  setupChecks();
  setupHero();
  setupSubs();
  setupPower();
  setupTree();
  setupKPerm();
  setupBrute();
  setupUnderstand();

  window.addEventListener("hashchange", () => show(location.hash.slice(1)));
  show(location.hash.slice(1) || "home");

  setupMenu();
  renderMath(document.body);
}

boot();
