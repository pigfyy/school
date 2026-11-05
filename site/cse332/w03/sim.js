/* CSE 332 week 3 · pure models of the week's code. No DOM. checks/cse332/w03/verify.mjs checks these against its own
   independent implementations and against every answer key on the page.
   - Recurrences (Lecture 6, Section 3): exact evaluation with BigInt, and the tree method's levels.
   - BSTs (Lecture 7): insert, find, delete exactly as the slides' code (two children: replace with the max of the left).
   - AVL trees (Lecture 8): insert with the four cases, rotating at the deepest unbalanced node, and the same insert as
     narrated steps for the stepper. */
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
  const isAVL = (t) => !t || (!unbalanced(fixHeights(t)) && isAVL(t.left) && isAVL(t.right));
  // M(h): fewest nodes in an AVL tree of height h (slide 55)
  function minAVL(hh) { const m = [1, 2]; for (let i = 2; i <= hh; i++) m.push(m[i - 1] + m[i - 2] + 1); return m[hh]; }

  /* L8 */
  // One AVL insert as the steps the lecture walks through: the BST insert, one step per node on the way back up
  // (stored heights stay stale until that node is reached), the case, each rotation, and the stop.
  // recipe "single" knows only "rotate toward the shorter side" (the outside cases); "full" has all four cases.
  const AVL_RECIPE = {
    single: ["insert(key){", "  BST insert: key becomes a new leaf", "  walk back up the path; at each node:", "    height = 1 + max(left h, right h)",
      "    if left h and right h differ by 2:", "      left taller: rotate right", "      right taller: rotate left", "      stop", "}"],
    full: ["insert(key){", "  BST insert: key becomes a new leaf", "  walk back up the path; at each node:", "    height = 1 + max(left h, right h)",
      "    if left h and right h differ by 2:", "      case = key's first two steps down", "      LL: rotate right here", "      RR: rotate left here",
      "      LR: left at left child, right here", "      RL: right at right child, left here", "      stop", "}"],
  };
  const AVL_LINE = {
    single: { bst: 1, height: [2, 3, 4], fix: { LL: 5, RR: 6 }, stop: 7, end: 8 },
    full: { bst: 1, height: [2, 3, 4], fix: { LL: 6, RR: 7, LR: 8, RL: 9 }, case: 5, stop: 10, end: 11 },
  };
  const kf = (k) => (k < 0 ? `\u2212${-k}` : String(k));
  const SIDE = { L: "left", R: "right" };
  function avlInsertSteps(startShape, key, recipe = "full") {
    let root = parseShape(startShape);
    const L = AVL_LINE[recipe], steps = [];
    const heights = () => { const m = {}; const w = (n) => { if (n) { m[n.key] = n.height; w(n.left); w(n.right); } }; w(root); return m; };
    const before = heights();
    const marks = {};
    const snap = (line, say, extra = {}, mk = marks) => steps.push({ shape: shape(root), heights: heights(), marks: { ...mk }, line, say, ...extra });
    snap(null, `An AVL tree. The small number by each node is its height. Insert ${kf(key)}.`, { kind: "start" });
    const path = [], cmps = [];
    let cur = root, parent = null;
    while (cur) {
      if (cur.key === key) throw new Error(`${key} is already in the tree`);
      const goLeft = key < cur.key;
      path.push(cur); cmps.push(`${kf(key)} ${goLeft ? "<" : ">"} ${kf(cur.key)}`);
      parent = cur; cur = goLeft ? cur.left : cur.right;
    }
    const side = key < parent.key ? "left" : "right";
    parent[side] = node(key);
    marks[key] = "new";
    snap(L.bst, `BST insert: ${cmps.join(", ")}. So ${kf(key)} becomes ${kf(parent.key)}'s ${side} child, a new leaf with height 0. The heights above it are out of date until the walk back up reaches them.`, { kind: "bst", parent: parent.key, side });
    const rot = (x, dir) => { // dir "R": rotate right at x (slide 38); "L": rotate left (slide 45)
      const b = dir === "R" ? x.left : x.right, moved = dir === "R" ? b.right : b.left;
      if (dir === "R") { x.left = b.right; b.right = x; } else { x.right = b.left; b.left = x; }
      fix(x); fix(b);
      return { b, moved };
    };
    const moveMarks = ({ b, moved }) => ({ ...marks, ...(moved ? { [moved.key]: "moved" } : {}), [b.key]: "cmp" });
    const setChild = (par, oldN, newN) => { if (!par) root = newN; else if (par.left === oldN) par.left = newN; else par.right = newN; };
    const rotSay = (x, { b, moved }, dir) => {
      const up = SIDE[dir === "R" ? "L" : "R"], down = SIDE[dir];
      return `Rotate ${down} at ${kf(x.key)}: its ${up} child ${kf(b.key)} moves up into its place, and ${kf(x.key)} becomes ${kf(b.key)}'s ${down} child. `
        + (moved ? `${kf(b.key)}'s old ${down} subtree (rooted at ${kf(moved.key)}) moves across to be ${kf(x.key)}'s ${up} subtree. ` : `${kf(b.key)} had no ${down} subtree, so nothing moves across. `)
        + `New heights: ${kf(x.key)} is ${x.height}, ${kf(b.key)} is ${b.height}.`;
    };
    for (let i = path.length - 1; i >= 0; i--) {
      const a = path[i], lh = h(a.left), rh = h(a.right);
      a.height = 1 + Math.max(lh, rh);
      const diff = Math.abs(lh - rh);
      const facts = { node: a.key, lh, rh, height: a.height, diff };
      const calc = `Node ${kf(a.key)}: its children have heights ${kf(lh)} and ${kf(rh)}. Height = 1 + max(${kf(lh)}, ${kf(rh)}) = ${a.height}.`;
      if (diff <= 1) { snap(L.height, `${calc} They differ by ${diff}: balanced.`, { kind: "height", ...facts }, { ...marks, [a.key]: "cur" }); continue; }
      marks[a.key] = "bad";
      snap(L.height, `${calc} They differ by ${diff}: ${kf(a.key)} is unbalanced. It's the first unbalanced node on the way up, so the fix happens here.`, { kind: "unbalanced", ...facts });
      const d1 = key < a.key ? "L" : "R", c1 = d1 === "L" ? a.left : a.right;
      const d2 = key < c1.key ? "L" : "R", c2 = d2 === "L" ? c1.left : c1.right;
      const kase = d1 + d2;
      const par = i > 0 ? path[i - 1] : null;
      if (recipe === "single") {
        if (d1 !== d2) throw new Error(`the single-rotation recipe can't fix case ${kase}`);
        snap(L.fix[kase], `${kf(a.key)}'s ${SIDE[d1]} side is taller, so rotate ${SIDE[d1 === "L" ? "R" : "L"]} at ${kf(a.key)}.`, { kind: "case", case: kase });
      } else {
        const fixSay = { LL: `One rotation: rotate right at ${kf(a.key)}.`, RR: `One rotation: rotate left at ${kf(a.key)}.`,
          LR: `Two rotations: rotate left at ${kf(c1.key)}, then right at ${kf(a.key)}.`, RL: `Two rotations: rotate right at ${kf(c1.key)}, then left at ${kf(a.key)}.` }[kase];
        snap([L.case, L.fix[kase]], `From ${kf(a.key)}, ${kf(key)} went ${SIDE[d1]} (to ${kf(c1.key)}), then ${SIDE[d2]} (to ${kf(c2.key)}): case ${kase}. ${fixSay}`, { kind: "case", case: kase });
      }
      let top;
      if (d1 === d2) {
        const dir = d1 === "L" ? "R" : "L", r = rot(a, dir);
        setChild(par, a, r.b); delete marks[a.key]; top = r.b;
        snap(L.fix[kase], rotSay(a, r, dir), { kind: "rotate", at: a.key, dir, up: r.b.key, moved: r.moved && r.moved.key }, moveMarks(r));
      } else {
        const dir1 = d1 === "L" ? "L" : "R", r1 = rot(c1, dir1);
        setChild(a, c1, r1.b);
        snap(L.fix[kase], rotSay(c1, r1, dir1), { kind: "rotate", at: c1.key, dir: dir1, up: r1.b.key, moved: r1.moved && r1.moved.key }, moveMarks(r1));
        const dir2 = d1 === "L" ? "R" : "L", r2 = rot(a, dir2);
        setChild(par, a, r2.b); delete marks[a.key]; top = r2.b;
        snap(L.fix[kase], rotSay(a, r2, dir2), { kind: "rotate", at: a.key, dir: dir2, up: r2.b.key, moved: r2.moved && r2.moved.key }, moveMarks(r2));
      }
      snap(L.stop, `Balanced again. The subtree rooted at ${kf(top.key)} has height ${top.height}, the same as ${kf(a.key)}'s subtree before the insert (${before[a.key]}), so nothing above it changes. Stop.`, { kind: "done", top: top.key, height: top.height, was: before[a.key] });
      return steps;
    }
    snap(L.end, "Reached the root and every node on the path is balanced. No rotation. Done.", { kind: "done" });
    return steps;
  }
  // the smallest AVL tree of height hh (slide 55): a root over the smallest trees of heights hh-1 and hh-2, keys 1..M(hh) in order
  function minAVLShape(hh) {
    let next = 1;
    const make = (k) => {
      if (k < 0) return null;
      const left = make(k - 1), n = node(next++);
      n.left = left; n.right = make(k - 2);
      return n;
    };
    return shape(fixHeights(make(hh)));
  }

  return {
    REC, F, recTex, evalRec, levels, levelSum,
    node, clone, bstInsert, build, bstFind, bstDelete, maxNode, minNode, height, size,
    preOrder, inOrder, postOrder, levelOrder, shape, parseShape, isBST,
    fix, fixHeights, rotateLeft, rotateRight, avlInsert, isAVL, minAVL,
    /* L8 */ AVL_RECIPE, avlInsertSteps, minAVLShape,
  };
});
