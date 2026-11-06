/* CSE 332 week 4 · pure models of the week's code. No DOM. checks/cse332/w04/verify.mjs checks these against its own
   independent implementations and against every answer key on the page.
   - BSTs and AVL trees (Lecture 9, Section 4): week 3's code, unchanged: insert with the four cases at the deepest
     unbalanced node.
   - Hashing (Lectures 10-11): hashRun, one state per operation for the table steppers and pictures. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Sim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------------------------------------------------------- binary search trees (Lecture 7) */
  const node = (key) => ({ key, left: null, right: null, height: 0 });
  const clone = (t) => (t ? { key: t.key, left: clone(t.left), right: clone(t.right), height: t.height } : null);
  // insert (slide 21, iterative): walk down; an existing key keeps its place (the value would be overwritten)
  function bstInsert(t, key) {
    if (!t) return { root: node(key), path: [], dup: false };
    const path = [];
    let cur = t, parent = null;
    while (cur && cur.key !== key) { path.push(cur.key); parent = cur; cur = key < cur.key ? cur.left : cur.right; }
    if (cur) return { root: t, path: [...path, cur.key], dup: true };
    if (key < parent.key) parent.left = node(key); else parent.right = node(key);
    return { root: t, path, dup: false };
  }
  const build = (keys) => keys.reduce((t, k) => bstInsert(t, k).root, null);
  // find (slide 19): the keys compared, in order
  function bstFind(t, key) {
    const path = [];
    while (t && t.key !== key) { path.push(t.key); t = key < t.key ? t.left : t.right; }
    if (t) path.push(t.key);
    return { found: Boolean(t), path };
  }
  const maxNode = (t) => { while (t && t.right) t = t.right; return t; };
  const minNode = (t) => { while (t && t.left) t = t.left; return t; };
  // delete (slides 23 and 26): leaf -> null; one child -> that child; two children -> the max of the left subtree
  function bstDelete(t, key) {
    let kase = null, repl = null;
    const del = (r, k) => {
      if (!r) return null;
      if (r.key === k) {
        if (!r.left && !r.right) { kase = 0; return null; }
        if (!r.left || !r.right) { kase = 1; repl = (r.left || r.right).key; return r.left || r.right; }
        const mk = maxNode(r.left).key;
        r.left = del(r.left, mk); // the max has no right child, so this removes it as case 0 or 1
        kase = 2; repl = mk;
        r.key = mk;
        return r;
      }
      if (r.key < k) r.right = del(r.right, k); else r.left = del(r.left, k);
      return r;
    };
    const root = del(t, key);
    return { root, case: kase, replacement: repl };
  }
  const height = (t) => (t ? 1 + Math.max(height(t.left), height(t.right)) : -1);
  const size = (t) => (t ? 1 + size(t.left) + size(t.right) : 0);
  const preOrder = (t) => (t ? [t.key, ...preOrder(t.left), ...preOrder(t.right)] : []);
  const inOrder = (t) => (t ? [...inOrder(t.left), t.key, ...inOrder(t.right)] : []);
  const postOrder = (t) => (t ? [...postOrder(t.left), ...postOrder(t.right), t.key] : []);
  const levelOrder = (t) => { const q = t ? [t] : [], out = []; while (q.length) { const x = q.shift(); out.push(x.key); if (x.left) q.push(x.left); if (x.right) q.push(x.right); } return out; };
  // shape as text: key(left,right), with empty children left blank, leaves as just the key
  const shape = (t) => (!t ? "" : !t.left && !t.right ? String(t.key) : `${t.key}(${shape(t.left)},${shape(t.right)})`);
  function parseShape(s) {
    let i = 0;
    const tree = () => {
      if (i >= s.length || s[i] === "," || s[i] === ")") return null;
      let j = i; while (j < s.length && !"(),".includes(s[j])) j++;
      const n = node(Number(s.slice(i, j))); i = j;
      if (s[i] === "(") { i++; n.left = tree(); i++; n.right = tree(); i++; }
      return n;
    };
    const t = tree();
    fixHeights(t);
    return t;
  }
  function isBST(t, lo = -Infinity, hi = Infinity) { return !t || (t.key > lo && t.key < hi && isBST(t.left, lo, t.key) && isBST(t.right, t.key, hi)); }

  /* ---------------------------------------------------------------- AVL trees (Lecture 8) */
  const h = (t) => (t ? t.height : -1);
  const fix = (t) => { t.height = 1 + Math.max(h(t.left), h(t.right)); return t; };
  function fixHeights(t) { if (t) { fixHeights(t.left); fixHeights(t.right); fix(t); } return t; }
  const unbalanced = (t) => Math.abs(h(t.left) - h(t.right)) > 1;
  // slide 38 / 45
  function rotateRight(a) { const b = a.left; a.left = b.right; b.right = a; fix(a); fix(b); return b; }
  function rotateLeft(a) { const b = a.right; a.right = b.left; b.left = a; fix(a); fix(b); return b; }
  // the deepest unbalanced node on the way back up decides the case (slide 53)
  function avlInsert(t, key) {
    const log = { path: [], problem: null, case: null, dup: false };
    const ins = (r) => {
      if (!r) return node(key);
      if (r.key === key) { log.dup = true; return r; }
      log.path.push(r.key);
      if (r.key < key) r.right = ins(r.right); else r.left = ins(r.left);
      fix(r);
      if (unbalanced(r) && !log.problem) {
        log.problem = r.key;
        if (h(r.left) > h(r.right)) {
          if (key < r.left.key) { log.case = "LL"; return rotateRight(r); }
          log.case = "LR"; r.left = rotateLeft(r.left); return rotateRight(r);
        }
        if (key > r.right.key) { log.case = "RR"; return rotateLeft(r); }
        log.case = "RL"; r.right = rotateRight(r.right); return rotateLeft(r);
      }
      return r;
    };
    const root = ins(t);
    return { root, ...log };
  }
  // the plain BST insert step only, with heights updated, for showing the "before rotation" picture
  function avlBstStep(t, key) {
    const r = bstInsert(t, key);
    fixHeights(r.root);
    let problem = null;
    for (const k of [...r.path].reverse()) { const n = findNode(r.root, k); if (unbalanced(n)) { problem = k; break; } }
    return { root: r.root, path: r.path, dup: r.dup, problem };
  }
  function findNode(t, k) { while (t && t.key !== k) t = k < t.key ? t.left : t.right; return t; }
  const isAVL = (t) => !t || (!unbalanced(fixHeights(t)) && isAVL(t.left) && isAVL(t.right));
  // deepest node whose children's heights differ by more than 1 (null if balanced)
  function problemNodes(t) {
    fixHeights(t);
    const out = [];
    const walk = (r, d) => { if (!r) return; walk(r.left, d + 1); walk(r.right, d + 1); if (unbalanced(r)) out.push({ key: r.key, depth: d }); };
    walk(t, 0);
    return out.sort((x, y) => y.depth - x.depth).map((x) => x.key);
  }
  const avlBuild = (keys) => keys.reduce((t, k) => avlInsert(t, k).root, null);
  // M(h): fewest nodes in an AVL tree of height h (slide 55)
  function minAVL(hh) { const m = [1, 2]; for (let i = 2; i <= hh; i++) m.push(m[i - 1] + m[i - 2] + 1); return m[hh]; }


  /* HASH ---------------------------------------------------------------- hash tables (Lectures 10 and 11)
     Keys are whole numbers and h(k) = k, so a key's home slot is k % size. hashRun plays one scenario and returns one
     state per operation (state 0 is the empty table), each with its probes and a narration in a fixed form that
     verify.mjs rechecks: "k % m = j", "i = 2: (9 + 2) % 10 = 1 is empty", "slot 9 has 19".
     mode: "chain" (a list per slot, new keys on the end) | "linear" | "quadratic" | "double" (g(k) = R − k % R).
     ops: "38 19 f29 d13 x13 r": insert 38, insert 19, find 29, delete 13 with a tombstone, delete 13 by just emptying
     its slot (the broken way), rehash into the first prime at least twice the size (one step per re-insert). */
  const TOMB = "✝";
  const mod = (x, m) => ((x % m) + m) % m;
  const isPrime = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
  const nextPrime = (n) => { while (!isPrime(n)) n++; return n; };
  const OPS = { f: "find", d: "delete", x: "empty", r: "rehash" };
  const parseOps = (s) => (s.trim() ? s.trim().split(/\s+/) : []).map((w) => (/^\d+$/.test(w) ? { kind: "insert", key: Number(w) } : w === "r" ? { kind: "rehash" } : { kind: OPS[w[0]], key: Number(w.slice(1)) }));
  const PROBE = {
    linear: { at: (h, i, m) => (h + i) % m, expr: (h, i) => `(${h} + ${i})` },
    quadratic: { at: (h, i, m) => (h + i * i) % m, expr: (h, i) => `(${h} + ${i}²)` },
    double: { at: (h, i, m, s) => (h + i * s) % m, expr: (h, i, s) => `(${h} + ${i}·${s})` },
  };
  const holds = (v) => (v === null ? "is empty" : v === TOMB ? "has a tombstone" : `has ${v}`);
  const list = (xs) => xs.join(", ");

  function hashRun({ size, mode, R = 0, ops }) {
    let slots = Array.from({ length: size }, () => (mode === "chain" ? [] : null)), n = 0, opi = -1;
    const steps = [];
    const snap = (op, extra) => steps.push({ size, mode, n, op, opi, slots: slots.map((v) => (Array.isArray(v) ? [...v] : v)), probes: [], at: -1, ...extra });
    snap(null, { say: `An empty table of size ${size}.` });

    // the probe sequence for k, one entry per slot looked at, stopping where stop(v) says
    function walk(k, stop) {
      const h = mod(k, size), s = mode === "double" ? R - mod(k, R) : 0, P = PROBE[mode], probes = [];
      for (let i = 0; i < size; i++) {
        const at = P.at(h, i, size, s), v = slots[at];
        probes.push({ i, at, v });
        if (stop(v)) break;
      }
      const lines = probes.map(({ i, at, v }) => `i = ${i}: ${i ? `${P.expr(h, i, s)} % ${size} = ${at}` : `slot ${at}`} ${holds(v)}`);
      const head = `${k} % ${size} = ${h}.${mode === "double" ? ` g(${k}) = ${R} − ${k} % ${R} = ${s}.` : ""}`;
      return { h, s, probes, lines, head };
    }
    const sentences = (lines) => lines.map((l) => `${l}.`).join(" ");

    function insertOpen(k, verb) {
      const w = walk(k, (v) => v === null || v === k);
      const last = w.probes.at(-1), tomb = w.probes.find((p) => p.v === TOMB);
      const probes = w.probes.map(({ i, at }) => ({ i, at }));
      if (last.v === k) return { probes, at: last.at, result: "dup", say: `${verb} ${k}: ${w.head} ${sentences(w.lines.slice(0, -1))} ${w.lines.at(-1)}: ${k} is already there, so insert just updates its value.`.replace(/ {2}/g, " ") };
      if (last.v !== null && !tomb) {
        const seen = w.probes.map((p) => p.at), never = slots.map((v, j) => (v === null && !seen.includes(j) ? j : -1)).filter((j) => j >= 0);
        return { probes, at: -1, result: "full", say: `${verb} ${k}: ${w.head} Probes i = 0 to ${size - 1} visit ${list(seen)}, all taken.${never.length ? ` Slot${never.length > 1 ? "s" : ""} ${never.length > 1 ? `${never.slice(0, -1).join(", ")} and ${never.at(-1)}` : never[0]} ${never.length > 1 ? "are" : "is"} empty but never probed.` : ""} From i = ${size} on the indices repeat, so the insert fails.` };
      }
      const at = tomb ? tomb.at : last.at;
      slots[at] = k; n++;
      const before = w.probes.slice(0, -1);
      const body = w.probes.length > 5 ? `i = 0 to ${before.length - 1} visit ${list(before.map((p) => (p.v === TOMB ? `${p.at} (tombstone)` : p.at)))}. ` : `${sentences(w.lines.slice(0, -1))} `.replace(/^ $/, "");
      const end = tomb ? `${w.lines.at(-1)}, so ${k} isn't in the table. It goes in the first tombstone's slot, ${at}.` : `${w.lines.at(-1)}, so ${k} goes there.`;
      return { probes, at, result: "placed", say: `${verb} ${k}: ${w.head} ${body}${end}` };
    }
    function findOpen(k) {
      const w = walk(k, (v) => v === null || v === k);
      const last = w.probes.at(-1), probes = w.probes.map(({ i, at }) => ({ i, at }));
      const tail = last.v === k ? `: found after ${w.probes.length} probe${w.probes.length > 1 ? "s" : ""}.` : last.v === null ? `: ${k} is not in the table.` : `. From i = ${size} on the indices repeat: ${k} is not in the table.`;
      const lines = w.lines.map((l, j) => (j < w.lines.length - 1 && w.probes[j].v === TOMB ? `${l}: keep going` : l));
      return { probes, at: last.v === k ? last.at : -1, result: last.v === k ? "found" : "missing", say: `find ${k}: ${w.head} ${sentences(lines.slice(0, -1))} ${lines.at(-1)}${tail}`.replace(/ {2}/g, " ") };
    }
    function chainOp(kind, k, verb) {
      const h = mod(k, size), b = slots[h], has = b.indexOf(k);
      const holdsTxt = b.length ? `Chain ${h} holds ${list(b)}` : `Chain ${h} is empty`;
      const probes = [{ i: 0, at: h }];
      if (kind === "find") return { probes, at: has >= 0 ? h : -1, hit: k, result: has >= 0 ? "found" : "missing", say: `find ${k}: ${k} % ${size} = ${h}. ${holdsTxt}${has >= 0 ? `: found on comparison ${has + 1}.` : `${b.length ? `: ${b.length} comparison${b.length > 1 ? "s" : ""}, no match` : ""}, so ${k} is not in the table.`}` };
      if (kind === "delete") { if (has >= 0) { b.splice(has, 1); n--; } return { probes, at: has >= 0 ? h : -1, result: has >= 0 ? "deleted" : "missing", say: `delete ${k}: ${k} % ${size} = ${h}. ${holdsTxt}${has >= 0 ? `: remove ${k} from it.` : `, so there is nothing to delete.`}` }; }
      if (has >= 0) return { probes, at: h, hit: k, result: "dup", say: `${verb} ${k}: ${k} % ${size} = ${h}. ${holdsTxt}, so insert just updates ${k}'s value.` };
      b.push(k); n++;
      return { probes, at: h, hit: k, result: "placed", say: `${verb} ${k}: ${k} % ${size} = ${h}. ${b.length > 1 ? `Chain ${h} holds ${list(b.slice(0, -1))}. ${k} isn't there, so it goes on the end.` : `Chain ${h} is empty, so ${k} starts it.`}` };
    }

    for (const op of parseOps(ops)) {
      opi++;
      if (op.kind === "rehash") {
        const keys = mode === "chain" ? slots.flat() : slots.filter((v) => v !== null && v !== TOMB);
        const old = size;
        size = nextPrime(2 * old);
        slots = Array.from({ length: size }, () => (mode === "chain" ? [] : null)); n = 0;
        const limit = mode === "chain" ? 2 : 0.5;
        snap(op, { result: "rehash", say: `rehash: λ = ${keys.length}/${old}${keys.length / old > limit ? `, more than ${mode === "chain" ? "2" : "1/2"}` : ""}. Make a new array of size ${size}, the first prime ≥ 2 · ${old} = ${2 * old}. Then re-insert every key with % ${size}, in old-slot order: ${list(keys)}.` });
        for (const k of keys) { const r = mode === "chain" ? chainOp("insert", k, "re-insert") : insertOpen(k, "re-insert"); snap({ kind: "insert", key: k }, r); }
        continue;
      }
      const k = op.key;
      if (mode === "chain") { snap(op, chainOp(op.kind, k, "insert")); continue; }
      if (op.kind === "insert") { snap(op, insertOpen(k, "insert")); continue; }
      const f = findOpen(k);
      if (op.kind === "find" || f.result !== "found") { snap(op, f); continue; }
      slots[f.at] = op.kind === "delete" ? TOMB : null; n--;
      const head = f.say.replace(/^find /, "delete ").replace(/: found after .*$/, ": found.");
      snap(op, { probes: f.probes, at: f.at, result: "deleted", say: op.kind === "delete" ? `${head} Slot ${f.at} gets a tombstone (${TOMB}).` : `${head} Just empty slot ${f.at}.` });
    }
    return steps;
  }

  return {
    TOMB, isPrime, nextPrime, parseOps, hashRun,
    node, clone, bstInsert, build, bstFind, bstDelete, maxNode, minNode, height, size,
    preOrder, inOrder, postOrder, levelOrder, shape, parseShape, isBST,
    fix, fixHeights, rotateLeft, rotateRight, avlInsert, avlBstStep, findNode, isAVL, problemNodes, avlBuild, minAVL,
  };
});
