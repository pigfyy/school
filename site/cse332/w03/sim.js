/* CSE 332 week 3 · pure models of the week's code. No DOM. checks/cse332/w03/verify.mjs checks these against its own
   independent implementations and against every answer key on the page.
   - Recurrences (Lecture 6, Section 3): exact evaluation with BigInt, and the tree method's levels.
   - BSTs (Lecture 7): insert, find, delete exactly as the slides' code (two children: replace with the max of the left).
   - AVL trees (Lecture 8): insert with the four cases, rotating at the deepest unbalanced node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Sim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------------------------------------------------------- recurrences
     spec = { a, kind: "div" | "sub", b, f, baseAt, baseVal, tex }
       div: T(n) = a·T(n/b) + f(n) for n > baseAt;  sub: T(n) = a·T(n−b) + f(n) for n > baseAt;  T(n) = baseVal otherwise.
     f is the name of the non-recursive work: "1", "n", "n2", "100n". */
  const F = {
    "1": { at: () => 1n, tex: "1" },
    n: { at: (n) => n, tex: "n" },
    n2: { at: (n) => n * n, tex: "n^2" },
    "100n": { at: (n) => 100n * n, tex: "100n" },
  };
  const REC = {
    bsearch: { a: 1, kind: "div", b: 2, f: "1", baseAt: 1, baseVal: 1, name: "Binary search (slide 6)" },
    lsearch: { a: 1, kind: "sub", b: 1, f: "1", baseAt: 1, baseVal: 1, name: "Linear search (slide 10)" },
    sum: { a: 2, kind: "div", b: 2, f: "1", baseAt: 1, baseVal: 1, name: "List sum (slide 12)" },
    nlogn: { a: 2, kind: "div", b: 2, f: "n", baseAt: 1, baseVal: 1, name: "2T(n/2) + n (slide 17)" },
    sq: { a: 2, kind: "div", b: 2, f: "n2", baseAt: 1, baseVal: 1, name: "2T(n/2) + n² (slide 18)" },
    eighth: { a: 2, kind: "div", b: 8, f: "1", baseAt: 1, baseVal: 1, name: "2T(n/8) + 1 (slide 20)" },
    s1b: { a: 2, kind: "div", b: 2, f: "n", baseAt: 4, baseVal: 4, name: "S3 1b: base case 4" },
    s1c: { a: 2, kind: "div", b: 2, f: "100n", baseAt: 1, baseVal: 100, name: "S3 1c: 100n" },
    s1d: { a: 3, kind: "div", b: 2, f: "n", baseAt: 1, baseVal: 1, name: "S3 1d: 3T(n/2) + n" },
    s1e: { a: 2, kind: "div", b: 3, f: "n", baseAt: 1, baseVal: 1, name: "S3 1e: 2T(n/3) + n" },
    s1f: { a: 2, kind: "sub", b: 2, f: "1", baseAt: 1, baseVal: 1, name: "S3 1f: 2T(n−2) + 1" },
    exp: { a: 2, kind: "sub", b: 1, f: "1", baseAt: 1, baseVal: 1, name: "2T(n−1) + 1" },
  };
  function recTex(s) {
    const call = s.kind === "div" ? `T(n/${s.b})` : `T(n-${s.b})`;
    return `T(n) = ${s.a === 1 ? "" : s.a}${call} + ${F[s.f].tex}`;
  }
  const next = (s, n) => (s.kind === "div" ? n / BigInt(s.b) : n - BigInt(s.b));
  // direct evaluation, exactly (n must be reachable: a power of b for "div")
  function evalRec(s, n) {
    n = BigInt(n);
    const memo = new Map();
    const T = (m) => {
      if (m <= BigInt(s.baseAt)) return BigInt(s.baseVal);
      if (memo.has(m)) return memo.get(m);
      const v = BigInt(s.a) * T(next(s, m)) + F[s.f].at(m);
      memo.set(m, v);
      return v;
    };
    return T(n);
  }
  // the tree method: one row per level. Level i has a^i nodes of the same size; leaves do the base case's work.
  function levels(s, n) {
    n = BigInt(n);
    const out = [];
    let size = n, nodes = 1n, i = 0;
    while (true) {
      const leaf = size <= BigInt(s.baseAt);
      const each = leaf ? BigInt(s.baseVal) : F[s.f].at(size);
      out.push({ i, nodes, size, each, total: nodes * each, leaf });
      if (leaf) break;
      size = next(s, size); nodes *= BigInt(s.a); i++;
    }
    return out;
  }
  const levelSum = (s, n) => levels(s, n).reduce((t, l) => t + l.total, 0n);

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

  /* L6 ---------------------------------------------------------- tree-method stepper: one table row per level */
  // Each step's narration states its arithmetic as "x × y = z", "x/y = z" and "a + b = s" so verify.mjs can recheck it.
  function treeSteps(s, n) {
    const L = levels(s, n);
    const work = (l) => (l.leaf ? `the base case, T(${l.size}) = ${l.each}` : s.f === "1" ? "1" : s.f === "n" ? `${l.size}` : `${l.size}² = ${l.each}`);
    const steps = L.map((l, i) => {
      if (i === 0) return `Level 0 is the first call: 1 call on n = ${l.size}. Work per call: ${work(l)}. Level work: 1 × ${l.each} = ${l.total}.`;
      const up = L[i - 1];
      const calls = `Each of the ${up.nodes} calls above makes ${s.a}: ${up.nodes} × ${s.a} = ${l.nodes} calls, each on ${up.size}/${s.b} = ${l.size}.`;
      return `Level ${i}. ${calls} Work per call: ${work(l)}. Level work: ${l.nodes} × ${l.each} = ${l.total}.`;
    });
    const sum = L.reduce((t, l) => t + l.total, 0n);
    steps.push(`Add the levels: ${L.map((l) => l.total).join(" + ")} = ${sum}. So T(${n}) = ${sum}.`);
    return { levels: L, steps, sum };
  }

  return {
    treeSteps,
    REC, F, recTex, evalRec, levels, levelSum,
    node, clone, bstInsert, build, bstFind, bstDelete, maxNode, minNode, height, size,
    preOrder, inOrder, postOrder, levelOrder, shape, parseShape, isBST,
    fix, fixHeights, rotateLeft, rotateRight, avlInsert, avlBstStep, findNode, isAVL, problemNodes, avlBuild, minAVL,
  };
});
