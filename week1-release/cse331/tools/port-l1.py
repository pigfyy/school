# One-off port of the trial's Lecture 1 pages (cse331-skill-trial/site/index.html) to this site's markup:
# page routes get an l1- prefix, every stateful element gets a stable semantic ID, and answer keys move
# out of the HTML into site/js/keys.js. Output: /tmp/l1-pages.html (pasted into site/index.html).
import json, re
secs = json.load(open('/tmp/trial_secs.json'))
ROUTES = {"runs": "l1-runs", "spec": "l1-spec", "assert": "l1-assert", "reason": "l1-reason", "edge": "l1-edge",
          "know": "l1-know", "understand": "l1-quiz", "exercises": "l1-exercises"}
QC = ["cse331-w1-l1-qc-count-counterexamples", "cse331-w1-l1-qc-spec-predicts-sum", "cse331-w1-l1-qc-list-size-at-point1",
      "cse331-w1-l1-qc-list-survives-loop", "cse331-w1-l1-qc-hasnext-exception", "cse331-w1-l1-qc-which-way-confirms"]
QC_TYPE = ["int", "int", "int", "yesno", "text", "text"]
QUIZ = {"cyu-runs-count": "cse331-w1-l1-quiz-how-many-runs", "cyu-runs-1000": "cse331-w1-l1-quiz-thousand-runs",
        "cyu-spec-sum": "cse331-w1-l1-quiz-sum-after-word", "cyu-spec-which": "cse331-w1-l1-quiz-which-is-spec",
        "cyu-spec-wrap": "cse331-w1-l1-quiz-sum-wraps-down", "cyu-assert-which": "cse331-w1-l1-quiz-which-is-assertion",
        "cyu-assert-holds": "cse331-w1-l1-quiz-nonempty-holds", "cyu-reason-rule": "cse331-w1-l1-quiz-rule-needs",
        "cyu-edge": "cse331-w1-l1-quiz-edge-standard", "cyu-know": "cse331-w1-l1-quiz-testing-can"}
OPTS = {"cyu-runs-count": ["one", "tested", "infinite", "two"], "cyu-runs-1000": ["holds", "those-runs", "false", "nothing"],
        "cyu-spec-which": ["loop-count", "prompt-first", "sum-assertion", "arraylist"], "cyu-assert-which": ["size-bound", "user-sees", "java-assert", "println"],
        "cyu-assert-holds": ["loop-adds", "empty-run", "one-run", "cant-tell"], "cyu-reason-rule": ["everything-before", "p-and-code", "every-test", "last-time"],
        "cyu-edge": ["stop-print", "tell-user", "skip-word", "stack-trace"], "cyu-know": ["refute-only", "confirm-only", "both", "neither"]}
PROB = {"l1-e1-predict": ("cse331-w1-l1-predict-two-runs", ["two-lines-got", "two-lines-sum", "decimal-got", "decimal-sum"]),
        "l1-e1-repair": ("cse331-w1-l1-repair-sentence", ["sentence"]),
        "l1-e2": ("cse331-w1-l1-which-are-specs", ["specs", "sum-meets"]),
        "l1-e3": ("cse331-w1-l1-saying-more-less", ["spec-vs-b", "two-assertions"]),
        "l1-e4": ("cse331-w1-l1-sum-starts-at-one", ["point1-list", "point2-sum", "point2-list", "meets-spec"]),
        "l1-e5": ("cse331-w1-l1-rule-println-and-init", ["after-println", "after-sum-init"]),
        "l1-e6": ("cse331-w1-l1-long-version", ["overflow-sum", "too-big-got", "long-spec"]),
        "l1-e7": ("cse331-w1-l1-specs-worth-meeting", ["meets-e", "meets-f", "course-accepts"])}
# wrong-option feedback that gave the answer away in the trial, rewritten to name the misconception only
REWRITE = {
    "Backwards. A failing test refutes; passing tests can't cover every run.": "Think about what one failing test shows, and what any number of passing tests can't.",
    "Only reasoning can confirm a claim about every run.": "Can a test ever cover every run? And what does a single failing test show?",
    "A single failing test is enough to refute it.": "What does one failing test show about a claim that every run must satisfy?",
}
MISC = {  # data-misconception tags for the wrong options, in option order (None = the right option)
    "cyu-runs-count": ["program-is-run", "tested-is-all", None, "two-classes"],
    "cyu-runs-1000": ["many-runs-prove", None, "no-counterexample-seen", "runs-tell-nothing"],
    "cyu-spec-which": ["inside-is-spec", None, "assertion-is-spec", "how-is-spec"],
    "cyu-assert-which": [None, "spec-is-assertion", "java-assert-is-assertion", "print-is-assertion"],
    "cyu-assert-holds": ["loop-always-adds", None, "one-run-holds", "need-every-input"],
    "cyu-reason-rule": ["need-history", None, "test-everything", "last-run-enough"],
    "cyu-edge": ["spec-response-ok", "message-ok", "skip-ok", None],
    "cyu-know": [None, "testing-confirms", "testing-both", "testing-neither"],
}
out = []
for old in ["runs", "spec", "assert", "reason", "edge", "know", "understand", "exercises"]:
    s = secs[old]
    s = s.replace(f'<section class="page" id="{old}"', f'<section class="page" id="{ROUTES[old]}" data-unit="l1"')
    for o, n in ROUTES.items():
        s = s.replace(f'href="#{o}"', f'href="#{n}"').replace(f'data-topic="{o}"', f'data-topic="{n}"')
    out.append(s)
html = "\n\n".join(out)
for k, v in REWRITE.items():
    assert k in html, k
    html = html.replace(k, v)
# quick checks, in page order
qi = iter(range(len(QC)))
def qc(m):
    i = next(qi)
    return f'<div class="check" data-id="{QC[i]}" data-kind="quickcheck" data-type="{QC_TYPE[i]}"{m.group(2) or ""}>'
html = re.sub(r'<div class="check" data-answer(?:-text)?="[^"]*"( data-sum-input="([^"]*)")?>', lambda m: qc(type("M", (), {"group": lambda self, k: f' data-sum-input="{m.group(2)}"' if k == 2 and m.group(2) is not None else None})()), html)
assert next(qi, None) is None
# quiz items
def quiz(m):
    attrs = m.group(1)
    old = re.search(r'data-id="([^"]+)"', attrs).group(1)
    kind = re.search(r'data-kind="([^"]+)"', attrs).group(1)
    topic = re.search(r'data-topic="([^"]+)"', attrs).group(1)
    extra = ""
    si = re.search(r'data-sum-input="([^"]*)"', attrs)
    if si: extra = f' data-sum-input="{si.group(1)}"'
    t = ' data-type="choice"' if kind == "mc" else ' data-type="int"'
    return f'<li class="cyu" data-kind="quiz" data-id="{QUIZ[old]}" data-format="{kind}"{t}{extra} data-topic="{topic}" data-old-id="{old}">'
html = re.sub(r'<li class="cyu"([^>]*)>', quiz, html)
# options: data-option ids, misconception tags, drop data-correct
def fix_opts(block):
    old = re.search(r'data-old-id="([^"]+)"', block).group(1)
    if old not in OPTS: return block
    ids = iter(OPTS[old]); tags = iter(MISC[old])
    def lab(m):
        oid = next(ids); tag = next(tags)
        return f'<label data-option="{oid}"' + (f' data-misconception="{tag}"' if tag else "") + ">"
    return re.sub(r'<label(?: data-correct)?>', lab, block)
html = re.sub(r'<li class="cyu".*?</li>\n', lambda m: fix_opts(m.group(0)), html, flags=re.S)
html = re.sub(r' data-old-id="[^"]+"', "", html)
html = re.sub(r'(<li class="cyu"[^>]*?) data-answer="[^"]*"', r"\1", html)
# problems
for old, (new, parts) in PROB.items():
    a = html.index(f'<article class="task" data-id="{old}">')
    b = html.index("</article>", a)
    block = html[a:b]
    block = block.replace(f'data-id="{old}"', f'data-id="{new}"')
    it = iter(parts)
    def spec(m):
        attrs = m.group(1)
        p = next(it)
        typ = "self" if "data-self" in attrs else "yesno" if "data-yesno" in attrs else "letters" if "data-letters" in attrs else "text" if "data-text" in attrs else "int"
        attrs = re.sub(r' data-(answer|text|letters|yesno)="[^"]*"', "", attrs)
        attrs = attrs.replace(" data-self", "")
        return f'<div class="answer-spec" data-part="{p}" data-type="{typ}"{attrs}>'
    block = re.sub(r'<div class="answer-spec"([^>]*)>', spec, block)
    assert next(it, None) is None, old
    html = html[:a] + block + html[b:]
html = html.replace(' data-placeholder="letters, e.g. AD"', ' data-placeholder="letters, e.g. AD, or none"')
assert "data-correct" not in html and "data-answer" not in html and 'data-text="' not in html and "data-yesno" not in html, "key left in HTML"
open("/tmp/l1-pages.html", "w").write(html)
print(len(html), html.count('data-id="cse331-'))
