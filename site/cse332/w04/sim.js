/* CSE 332 week 4 · pure models of the week's code. No DOM. checks/cse332/w04/verify.mjs checks these against its own
   independent implementations and against every answer key on the page.
   - AVL trees (Lecture 9, Section 4): insert with the four cases at the deepest unbalanced node, narrated one insert
     or rotation per step; the smallest AVL trees; Section 4's rotation as three reference assignments.
   - Hashing (Lectures 10-11): the string hashes h1-h4, separate chaining, and open addressing with linear, quadratic
     and double-hashing probes, tombstone delete, load factor and rehashing. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Sim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* AVL ---------------------------------------------------------------- AVL trees (Lecture 9, Section 4)
     A tree is { key, left, right, height }. A key is a number, or a letter in Section 4's lettered picture, where the
     capitals V-Z stand for whole subtrees. Insert is the lecture's: a BST insert, then the first unbalanced node on the
     way back up (the deepest) gets one of the four fixes. The step lists below feed the steppers; verify.mjs rechecks
     every picture and every claim in their narration against its own code. */
  const node = (key) => ({ key, left: null, right: null, height: 0 });
  const h = (t) => (t ? t.height : -1);
  const fix = (t) => { t.height = 1 + Math.max(h(t.left), h(t.right)); return t; };
  function fixHeights(t) { if (t) { fixHeights(t.left); fixHeights(t.right); fix(t); } return t; }
  const height = (t) => (t ? 1 + Math.max(height(t.left), height(t.right)) : -1);
  const size = (t) => (t ? 1 + size(t.left) + size(t.right) : 0);
  const preOrder = (t) => (t ? [t.key, ...preOrder(t.left), ...preOrder(t.right)] : []);
  const inOrder = (t) => (t ? [...inOrder(t.left), t.key, ...inOrder(t.right)] : []);
  // shape as text: key(left,right), with empty children left blank, leaves as just the key
  const shape = (t) => (!t ? "" : !t.left && !t.right ? String(t.key) : `${t.key}(${shape(t.left)},${shape(t.right)})`);
  function parseShape(s) {
    let i = 0;
    const tree = () => {
      if (i >= s.length || s[i] === "," || s[i] === ")") return null;
      let j = i; while (j < s.length && !"(),".includes(s[j])) j++;
      const k = s.slice(i, j);
      const n = node(/^-?\d+$/.test(k) ? Number(k) : k); i = j;
      if (s[i] === "(") { i++; n.left = tree(); i++; n.right = tree(); i++; }
      return n;
    };
    return fixHeights(tree());
  }
  const isBST = (t, lo = -Infinity, hi = Infinity) => !t || (t.key > lo && t.key < hi && isBST(t.left, lo, t.key) && isBST(t.right, t.key, hi));
  const unbalanced = (t) => Math.abs(h(t.left) - h(t.right)) > 1;
  const isAVL = (t) => !t || (!unbalanced(t) && isAVL(t.left) && isAVL(t.right));
  function rotateRight(a) { const b = a.left; a.left = b.right; b.right = a; fix(a); fix(b); return b; }
  function rotateLeft(a) { const b = a.right; a.right = b.left; b.left = a; fix(a); fix(b); return b; }
  // every unbalanced node, deepest first (one insert's unbalanced nodes all lie on its path, so depths differ)
  function problemNodes(t) {
    const out = [];
    const walk = (r, d) => { if (!r) return; walk(r.left, d + 1); walk(r.right, d + 1); if (unbalanced(r)) out.push({ key: r.key, depth: d }); };
    walk(t, 0);
    return out.sort((x, y) => y.depth - x.depth).map((x) => x.key);
  }
  const heightsOf = (t) => { const m = {}; const w = (n) => { if (n) { m[n.key] = n.height; w(n.left); w(n.right); } }; w(t); return m; };
  const kf = (k) => (typeof k === "number" && k < 0 ? `−${-k}` : String(k));
  const SIDE = { L: "left", R: "right" };
  const listOf = (ks) => (ks.length < 3 ? ks.map(kf).join(" and ") : `${ks.slice(0, -1).map(kf).join(", ")} and ${kf(ks.at(-1))}`);

  // Lecture 9's stepper: insert keys one by one into an empty tree. One step per insert (the BST insert and the walk
  // back up, ending at the first unbalanced node) and one per rotation. card holds the recipe's filled-in blanks.
  function avlSeqSteps(keys) {
    let root = null;
    const steps = [];
    const snap = (kind, say, marks, card, extra) => steps.push({ kind, shape: shape(root), heights: heightsOf(root), marks, card: { ...card }, say, ...extra });
    snap("start", `An empty tree. Insert ${listOf(keys)}, in that order. Each step is one insert or one rotation.`, {}, {}, {});
    for (const key of keys) {
      if (!root) {
        root = node(key);
        snap("insert", `Insert ${kf(key)}. The tree is empty, so ${kf(key)} becomes the root. Nothing to walk back up through: no rotation.`,
          { [key]: "new" }, { key: kf(key), where: "the root", problem: "none", path: "none", kase: "none", fix: "none" }, { key, problems: [], at: null, kase: null });
        continue;
      }
      const before = heightsOf(root), path = [];
      let cur = root, parent = null;
      while (cur) {
        if (cur.key === key) throw new Error(`${key} is already in the tree`);
        path.push(cur); parent = cur; cur = key < cur.key ? cur.left : cur.right;
      }
      const side = key < parent.key ? "left" : "right";
      parent[side] = node(key);
      fixHeights(root);
      const walk = [];
      let at = null;
      for (let i = path.length - 1; i >= 0 && at === null; i--) {
        const n = path[i], lh = h(n.left), rh = h(n.right), diff = Math.abs(lh - rh);
        if (diff <= 1) walk.push(`${kf(n.key)} has children ${kf(lh)} and ${kf(rh)}, fine`);
        else { walk.push(`${kf(n.key)} has children ${kf(lh)} and ${kf(rh)}, which differ by ${diff}: ${kf(n.key)} is the first unbalanced node`); at = i; }
      }
      const probs = problemNodes(root);
      const marks = { ...Object.fromEntries(probs.map((k) => [k, "bad"])), [key]: "new" };
      const cmps = path.map((n) => `${kf(key)} ${key < n.key ? "<" : ">"} ${kf(n.key)}`).join(", ");
      const intro = `Insert ${kf(key)}: ${cmps}, so ${kf(key)} becomes ${kf(parent.key)}'s ${side} child. Walk back up: ${walk.join("; ")}.`;
      const card = { key: kf(key), where: `a leaf under ${kf(parent.key)}` };
      if (at === null) {
        snap("insert", `${intro} No rotation.`, marks, { ...card, problem: "none", path: "none", kase: "none", fix: "none" }, { key, problems: probs, at: null, kase: null });
        continue;
      }
      const a = path[at], par = at > 0 ? path[at - 1] : null;
      const d1 = key < a.key ? "L" : "R", c1 = d1 === "L" ? a.left : a.right;
      const d2 = key < c1.key ? "L" : "R", c2 = d2 === "L" ? c1.left : c1.right, kase = d1 + d2;
      const fixSay = { LL: `rotate right at ${kf(a.key)}`, RR: `rotate left at ${kf(a.key)}`,
        LR: `rotate left at ${kf(c1.key)}, then right at ${kf(a.key)}`, RL: `rotate right at ${kf(c1.key)}, then left at ${kf(a.key)}` }[kase];
      const higher = probs.filter((k) => k !== a.key);
      Object.assign(card, { problem: kf(a.key), path: `${SIDE[d1]}, then ${SIDE[d2]}`, kase, fix: fixSay });
      snap("insert", `${intro}${higher.length ? ` ${listOf(higher)} ${higher.length > 1 ? "are" : "is"} unbalanced too, higher up, but the fix happens at the first one.` : ""} From ${kf(a.key)}, ${kf(key)} went ${SIDE[d1]} (to ${kf(c1.key)}), then ${SIDE[d2]} (to ${kf(c2.key)}): case ${kase}. ${d1 === d2 ? "One rotation" : "Two rotations"}: ${fixSay}.`,
        marks, card, { key, problems: probs, at: a.key, kase });
      const setChild = (p, oldN, newN) => { if (!p) root = newN; else if (p.left === oldN) p.left = newN; else p.right = newN; };
      const rotations = d1 === d2 ? [[a, d1 === "L" ? "R" : "L", par]] : [[c1, d1, a], [a, d2, par]];
      rotations.forEach(([x, dir, p], i) => {
        const up = dir === "R" ? x.left : x.right, moved = dir === "R" ? up.right : up.left;
        const top = dir === "R" ? rotateRight(x) : rotateLeft(x);
        setChild(p, x, top);
        fixHeights(root);
        const upSide = SIDE[dir === "R" ? "L" : "R"], downSide = SIDE[dir];
        let say = `${rotations.length > 1 ? (i === 0 ? "First rotation. " : "Second rotation. ") : ""}Rotate ${downSide} at ${kf(x.key)}: its ${upSide} child ${kf(top.key)} moves up into its place, and ${kf(x.key)} becomes ${kf(top.key)}'s ${downSide} child.`;
        if (moved) say += ` ${kf(top.key)}'s old ${downSide} subtree, ${kf(moved.key)}, moves across to be ${kf(x.key)}'s ${upSide} child.`;
        const last = i === rotations.length - 1;
        if (last) say += ` Balanced again. The subtree rooted at ${kf(top.key)} has height ${top.height}, the same as ${kf(a.key)}'s before the insert (${before[a.key]}), so nothing above it changes${higher.length ? `: ${listOf(higher)} ${higher.length > 1 ? "are" : "is"} fixed too` : ""}. Stop.`;
        else say += ` Now the path from ${kf(a.key)} is straight (${SIDE[d1]}, ${SIDE[d1]}), so one more rotation fixes it.`;
        const now = problemNodes(root);
        const m = { [key]: "new", ...Object.fromEntries(now.map((k) => [k, "bad"])), ...(moved ? { [moved.key]: "moved" } : {}), [top.key]: now.includes(top.key) ? "bad cmp" : "cmp" };
        snap("rotate", say, m, { ...card, now: "fix" }, { key, at: x.key, dir, up: top.key, moved: moved ? moved.key : null, last, top: last ? top.key : null, was: before[a.key] });
      });
    }
    return steps;
  }

  // M(h): fewest nodes in an AVL tree of height h. The smallest tree of height h is a root over the smallest trees of
  // heights h-1 (left) and h-2 (right); minAVLShape numbers its keys 1..M(h) in order.
  function minAVL(hh) { const m = [1, 2]; for (let i = 2; i <= hh; i++) m.push(m[i - 1] + m[i - 2] + 1); return m[hh]; }
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
  function minSteps(top) {
    return Array.from({ length: top + 1 }, (_, hh) => {
      const t = parseShape(minAVLShape(hh)), M = minAVL(hh);
      const say = hh === 0 ? "Height 0: a single node. M(0) = 1."
        : hh === 1 ? "Height 1: a root needs one child. The other side can stay empty (height −1), because heights 0 and −1 differ by only 1. M(1) = 2."
        : `Height ${hh}: a root, the smallest tree of height ${hh - 1} on the left (${minAVL(hh - 1)} nodes) and the smallest of height ${hh - 2} on the right (${minAVL(hh - 2)} node${minAVL(hh - 2) === 1 ? "" : "s"}). Heights ${hh - 1} and ${hh - 2} differ by 1, so that's allowed. M(${hh}) = M(${hh - 1}) + M(${hh - 2}) + 1 = ${minAVL(hh - 1)} + ${minAVL(hh - 2)} + 1 = ${M}.`;
      return { h: hh, M, shape: shape(t), root: t.key, left: inOrder(t.left), right: inOrder(t.right), say };
    });
  }

  // Section 4's lettered picture: p is a's left child and the problem node; p's children are b (subtrees W, X) and
  // c (Y, Z); V is a's right subtree. runRefs runs reference assignments ("a.left = b", "p.left = b.right") in order.
  const LETTERS = "a(p(b(W,X),c(Y,Z)),V)";
  const REFS = { right: ["a.left = b", "p.left = b.right", "b.right = p"], left: ["a.left = c", "p.right = c.left", "c.left = p"] };
  function runRefs(start, lines) {
    const t = parseShape(start), byKey = new Map();
    const walk = (n) => { if (n) { byKey.set(n.key, n); walk(n.left); walk(n.right); } };
    walk(t);
    const changes = lines.map((ln) => {
      const [, owner, side, src, srcSide] = /^(\w+)\.(left|right) = (\w+)(?:\.(left|right))?$/.exec(ln);
      const target = srcSide ? byKey.get(src)[srcSide] : byKey.get(src);
      const was = byKey.get(owner)[side];
      byKey.get(owner)[side] = target;
      return { line: ln, from: owner, side, was: was.key, now: target.key };
    });
    return { shape: shape(fixHeights(t)), changes };
  }
  function rewireSteps() {
    const { shape: after, changes } = runRefs(LETTERS, REFS.right);
    const nums = (pick) => Object.fromEntries(changes.map((c, i) => [`${c.from}>${pick(c)}`, i + 1]));
    const circled = ["①", "②", "③"];
    return [
      { shape: LETTERS, marks: { p: "bad", W: "new" }, edges: {}, line: [], say: "The insert went into W, the left subtree of p's left child b. p is the lowest problem node: its left side is now 2 taller than its right." },
      { shape: LETTERS, marks: { p: "bad", W: "new" }, edges: { bad: nums((c) => c.was) }, line: [],
        say: `Left of left is case 1: a single right rotation at p. Three references change. The bad edges are ${changes.map((c, i) => `${circled[i]} ${c.from} → ${c.was}`).join(", ")}.` },
      { shape: after, marks: { b: "cmp", X: "moved" }, edges: { add: nums((c) => c.now) }, line: [0, 1, 2],
        say: `Replace them. ${changes.map((c, i) => `${circled[i]} ${c.line}: ${c.from}'s ${c.side} was ${c.was}, now ${c.now}.`).join(" ")} b is up where p was, and X moved across to p. The keys keep their left-to-right order.` },
      { shape: after, marks: { p: "cur", b: "cur" }, edges: {}, line: [], say: "Last, update the stored heights: p first, because it's now below b, then b. Nothing else moved." },
    ];
  }


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
    node, height, size, preOrder, inOrder, shape, parseShape, isBST, isAVL, fixHeights, rotateLeft, rotateRight, problemNodes,
    avlSeqSteps, minAVL, minAVLShape, minSteps, LETTERS, REFS, runRefs, rewireSteps,
  };
});
