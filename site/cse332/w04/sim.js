/* CSE 332 week 4 · pure models of the week's code. No DOM. checks/cse332/w04/verify.mjs checks these against its own
   independent implementations and against every answer key on the page.
   - BSTs and AVL trees (Lecture 9, Section 4): week 3's code, unchanged: insert with the four cases at the deepest
     unbalanced node.
   - Hashing (Lectures 10-11): the string hashes h1-h4, separate chaining, and open addressing with linear, quadratic
     and double-hashing probes, tombstone delete, load factor and rehashing. */
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


  /* ---------------------------------------------------------------- hashing (Lectures 10 and 11) */
  // the string hashes of slide 18, exactly (BigInt; Java's int arithmetic would wrap, the math here doesn't)
  const ascii = (s) => [...s].map((c) => BigInt(c.charCodeAt(0)));
  const H = {
    h1: (s) => (s.length ? ascii(s)[0] : 0n),
    h2: (s) => ascii(s).reduce((t, a) => t + a, 0n),
    h3: (s) => ascii(s).reduce((t, a, i) => t + a * 31n ** BigInt(i), 0n),
    h4: (s) => 2n * ascii(s).reduce((t, a, i) => t + a * 31n ** BigInt(i), 0n),
  };
  // slide 20: Horner's rule, from the last character down; returns the running values of h
  function horner(s) { const a = ascii(s), steps = []; let h = 0n; for (let i = a.length - 1; i >= 0; i--) { h = 31n * h + a[i]; steps.push(h); } return steps; }
  const mod = (x, m) => Number(((BigInt(x) % BigInt(m)) + BigInt(m)) % BigInt(m));
  const isPrime = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
  const nextPrime = (n) => { while (!isPrime(n)) n++; return n; };
  const TOMB = "†"; // a tombstone

  // a hash table of integer keys with h(k) = k. mode: "chain" | "linear" | "quadratic" | "double". g is for double hashing.
  function table(size, mode = "chain", g = (k) => 1 + mod(k, Math.max(1, size - 2))) {
    return { size, mode, g, slots: Array.from({ length: size }, () => (mode === "chain" ? [] : null)), n: 0 };
  }
  // the i-th index on k's probe path
  function probeAt(t, k, i) {
    const h = mod(k, t.size);
    if (t.mode === "linear") return (h + i) % t.size;
    if (t.mode === "quadratic") return (h + i * i) % t.size;
    return mod(h + i * t.g(k), t.size);
  }
  // insert: returns { index, probes (indices looked at), ok, replaced }
  function insert(t, k) {
    if (t.mode === "chain") {
      const i = mod(k, t.size), b = t.slots[i];
      if (b.includes(k)) return { index: i, probes: [i], ok: true, dup: true, compares: b.indexOf(k) + 1 };
      b.push(k); t.n++;
      return { index: i, probes: [i], ok: true, dup: false, compares: b.length - 1 };
    }
    const probes = []; let dest = -1;
    for (let i = 0; i < t.size; i++) {
      const j = probeAt(t, k, i); probes.push(j);
      const v = t.slots[j];
      if (v === k) return { index: j, probes, ok: true, dup: true };
      if (v === TOMB) { if (dest < 0) dest = j; continue; }
      if (v === null) { const at = dest >= 0 ? dest : j; t.slots[at] = k; t.n++; return { index: at, probes, ok: true, dup: false }; }
    }
    if (dest >= 0) { t.slots[dest] = k; t.n++; return { index: dest, probes, ok: true, dup: false }; }
    return { index: -1, probes, ok: false }; // probed table.length times without finding a spot
  }
  function find(t, k) {
    if (t.mode === "chain") { const i = mod(k, t.size), b = t.slots[i], at = b.indexOf(k); return { found: at >= 0, index: i, probes: [i], compares: at >= 0 ? at + 1 : b.length }; }
    const probes = [];
    for (let i = 0; i < t.size; i++) {
      const j = probeAt(t, k, i); probes.push(j);
      if (t.slots[j] === k) return { found: true, index: j, probes };
      if (t.slots[j] === null) return { found: false, index: -1, probes };
    }
    return { found: false, index: -1, probes };
  }
  // delete: chaining removes from the bucket; open addressing leaves a tombstone (slide 24, option 2)
  function remove(t, k) {
    const f = find(t, k);
    if (!f.found) return f;
    if (t.mode === "chain") t.slots[f.index].splice(t.slots[f.index].indexOf(k), 1); else t.slots[f.index] = TOMB;
    t.n--;
    return f;
  }
  const load = (t) => t.n / t.size;
  // rehash (slide 34): a new table of size newSize, re-inserting every key in index order
  function rehash(t, newSize, g) {
    const u = table(newSize, t.mode, g);
    const keys = t.mode === "chain" ? t.slots.flat() : t.slots.filter((v) => v !== null && v !== TOMB);
    for (const k of keys) insert(u, k);
    return u;
  }
  const buildTable = (size, mode, keys, g) => { const t = table(size, mode, g); const log = keys.map((k) => ({ k, ...insert(t, k) })); return { t, log }; };

  return {
    H, horner, mod, isPrime, nextPrime, TOMB, table, probeAt, insert, find, remove, load, rehash, buildTable,
    node, clone, bstInsert, build, bstFind, bstDelete, maxNode, minNode, height, size,
    preOrder, inOrder, postOrder, levelOrder, shape, parseShape, isBST,
    fix, fixHeights, rotateLeft, rotateRight, avlInsert, avlBstStep, findNode, isAVL, problemNodes, avlBuild, minAVL,
  };
});
