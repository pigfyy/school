# Builds site/index.html from: the shell below, the ported Lecture 1 pages (/tmp/l1-pages.html, from
# tools/port-l1.py) and the Lecture 2 pages (/tmp/l2-pages.html). Run once; index.html is the source after that.
import json, re
secs = json.load(open('/tmp/trial_secs.json'))
l1 = open('/tmp/l1-pages.html').read()
l2 = open('/tmp/l2-pages.html').read()
scripts = open('/tmp/trial_scripts.html').read()

home = secs['home']
home = home.replace('<section class="page" id="home" data-title="Week overview">', '<section class="page" id="home" data-title="Week overview" data-unit="week">')
home = home.replace('href="#runs"', 'href="#l1-runs"')
a = home.index('  <h2>This week</h2>'); b = home.index('  <h2>How to use this site</h2>')
home = home[:a] + '''  <h2>This week</h2>
  <div class="week">
    <a href="#l1-runs"><strong>Wed, Sept 30</strong><span>Lecture 1: Welcome! Whole program assertions</span><span>6 modules, a 10-question quiz, the 7 exercises from the notes</span></a>
    <div class="day later"><strong>Thu, Oct 1</strong><span>No lecture or section</span><span>Office hours only. CSE 331 sections meet on Tuesdays; the first is Tue, Oct 6.</span></div>
    <a href="#l2-pieces"><strong>Fri, Oct 2</strong><span>Lecture 2: Procedural abstraction and specification</span><span>6 modules, an 11-question quiz, 9 problems (the 6 exercises from the notes and 3 lecture activities). Homework 0 and Reading 1 due 11:59 pm.</span></a>
  </div>

  <div class="rule note">
    <p><strong>What this site covers.</strong> Both lectures in Sept 30 to Oct 2 (notes, slides and end-of-notes exercises) and Reading 1. There was no section this week. The Section 1 handout (Tue, Oct 6, "Assertions and Specifications") and its solution still read "This content is not yet available" on the course site (checked Fri, Oct 2), so this site has no section problems. Homework 0 and Homework 1 appear only as due dates: <strong>no AI is allowed on either</strong>, and nothing here works their problems.</p>
  </div>

''' + home[b:]
home = home.replace('<li>The modules follow the order of the lecture notes.', '<li>Two lectures, each in the order of its notes. Each module has a short explanation, something to try, and a quick check you can pose to the room.</li>\n      <li class="hidden-dup">')
home = re.sub(r'\s*<li class="hidden-dup">[^\n]*</li>', '', home)
home = home.replace('<li><strong>Lecture exercises</strong> are answerable on the page.', '<li><strong>Exercises and problems</strong> are answerable on the page.')
home = home.replace('Your work saves in this browser automatically.', 'Your work saves automatically.')
home = home.replace('<li><strong>Check your understanding</strong> is a 10-question wrap-up quiz for the end of lecture or the start of section.</li>', '<li>Each lecture ends with <strong>Check your understanding</strong>, a wrap-up quiz (10 questions for Lecture 1, 11 for Lecture 2).</li>')
home = home.replace('<tr><th>Sections</th><td>Tuesdays, TA-led, not recorded. The first one is Tuesday, Oct 6.</td></tr>', '<tr><th>Sections</th><td>Tuesdays, TA-led, not recorded; printed material is posted on the course site. The first one is Tuesday, Oct 6 ("Assertions and Specifications").</td></tr>')
home = home.replace('Homework 1: Friday, Oct 9.', 'Homework 1 (procedural abstraction; Tasks 1 and 2 use today\'s ideas): Friday, Oct 9, 11:59 pm.')
home = home.replace('<tr><th>Links</th>', '<tr><th>Exams</th><td>Midterm in lecture Friday, Nov 13. Final Tuesday, Dec 15, 12:30–2:20 (A in BAG 131, B in BAG 154). One handwritten letter-size sheet of notes.</td></tr>\n    <tr><th>Collaboration</th><td>Discuss problems with others, then leave with no written records, wait 20 minutes, and write your solution alone.</td></tr>\n    <tr><th>Links</th>')
home = home.replace('<a href="https://courses.cs.washington.edu/courses/cse331/26au/lectures/lecture01-assertions/slides.html" target="_blank" rel="noopener">slides</a>', '<a href="https://courses.cs.washington.edu/courses/cse331/26au/lectures/lecture01-assertions/slides.html" target="_blank" rel="noopener">slides</a> · <a href="https://courses.cs.washington.edu/courses/cse331/26au/lectures/lecture02-specifications/notes.html" target="_blank" rel="noopener">Lecture 2 notes</a> · <a href="https://courses.cs.washington.edu/courses/cse331/26au/lectures/lecture02-specifications/slides.html" target="_blank" rel="noopener">slides</a> · <a href="https://courses.cs.washington.edu/courses/cse331/26au/homework/hw0.html" target="_blank" rel="noopener">HW0</a> · <a href="https://courses.cs.washington.edu/courses/cse331/26au/homework/hw1.html" target="_blank" rel="noopener">HW1</a>')
for want in ['Thu, Oct 1', 'Lecture 2 notes', 'Collaboration', 'Exercises and problems']:
    assert want in home, want

reading = secs['reading'].replace('<section class="page" id="reading" data-title="Reading 1">', '<section class="page" id="reading" data-title="Reading 1" data-unit="reading">')
reading = reading.replace('<p class="where">Reading 1 · due Friday, Oct 2, 11:59 pm on Gradescope · discussed in lecture Monday, Oct 5</p>', '<p class="where">Reading 1 · assigned for this week · due Friday, Oct 2, 11:59 pm on Gradescope · discussed in lecture Monday, Oct 5</p>')
reading = reading.replace('<div class="rule note"><p><strong>AI on the reflection.</strong>', '''<h2>What the reflection asks</h2>
  <div class="prose"><p>From the readings page: (1) what the reading argues, reconstructed in your own words, about 5 sentences; (2) your reaction, connected to your own experience as a programmer, about 5 sentences; (3) one or more things you want to discuss in class. On Monday, small groups discuss for 15 to 20 minutes and hand in one sheet per group.</p></div>
  <div class="rule note"><p><strong>AI on the reflection.</strong>''')
reading = reading.replace('<li>Ask which of the lecture', '<li>Lecture 2 adds a fourth lens: Hoare\'s question is how big programs get reliable. Procedural abstraction (knowing a program one method at a time) is part of the answer the course gives.</li>\n      <li>Ask which of the lecture')

cheat = secs['cheatsheet'].replace('<section class="page" id="cheatsheet" data-title="Cheat sheet">', '<section class="page" id="cheatsheet" data-title="Cheat sheet" data-unit="reference">')
cheat = cheat.replace('''    <section>
      <h3>Lecture exercise answers</h3>''', '''    <section>
      <h3>Method specification</h3>
      <p><strong>Client</strong>: code that calls a method. <strong>Precondition</strong>: the client makes it true. <strong>Postcondition</strong>: the implementer makes it true, and may assume the precondition.</p>
      <p><strong>Meets</strong>: every call that begins with the precondition true ends with the postcondition true. A call that breaks the precondition gets no promise.</p>
    </section>
    <section>
      <h3>Javadoc tags</h3>
      <table class="plain">
        <tr><td><code>@param</code>, <code>@requires</code></td><td>precondition</td></tr>
        <tr><td><code>@return</code>, <code>@throws</code></td><td>postcondition (result, exception)</td></tr>
        <tr><td><code>@modifies</code>, <code>@effects</code></td><td>postcondition (which parameters change, how). No <code>@modifies</code> = changes nothing.</td></tr>
      </table>
    </section>
    <section>
      <h3>Procedural abstraction</h3>
      <p>Use a method through its specification alone. Clients rely on nothing it doesn't promise; the implementer may change anything it doesn't promise. The specification is the <strong>abstraction barrier</strong>.</p>
      <p>Across a call: <code>{{ pre }} call {{ post }}</code>, last lecture's P, code, Q rule.</p>
    </section>
    <section>
      <h3>Stronger and weaker</h3>
      <p>S1 stronger than S2: every implementation meeting S1 meets S2. Rule: S1's precondition weaker or same, and where S2's precondition holds, S1's postcondition stronger or same.</p>
      <p>Strengthening can break the implementation, never a client. Weakening can break a client, never the implementation.</p>
      <p><strong>Correct client</strong>: works with every implementation that meets the specifications it relies on.</p>
    </section>
    <section>
      <h3>Lecture exercise answers</h3>''')
cheat = cheat.replace('''        <tr><td>7</td><td>Meets E and F · course accepts neither</td></tr>
      </table>
    </section>''', '''        <tr><td>7</td><td>Meets E and F · course accepts neither</td></tr>
      </table>
    </section>
    <section>
      <h3>Lecture 2 answers</h3>
      <table class="plain">
        <tr><td>indexOf</td><td>1: A B D · 2: A E · 3: A · 4: A C D</td></tr>
        <tr><td>2 (sign)</td><td>1: S1 S2 S3 · 2: S2 · 3: none (MIN_VALUE)</td></tr>
        <tr><td>3</td><td>S1 &gt; S2 · S1 &gt; S3 · S2, S3 incomparable</td></tr>
        <tr><td>4</td><td>sameSign: S1 · isPositive: S1, S2</td></tr>
        <tr><td>5</td><td>D→B breaks impl. 4 · B→D breaks count</td></tr>
      </table>
    </section>''')
cheat = cheat.replace('<h3>Java facts used</h3>', '<h3>Java facts used</h3>\n      <p><code>Math.abs(Integer.MIN_VALUE)</code> is <code>Integer.MIN_VALUE</code> (−2147483648).</p>')
assert 'Lecture 2 answers' in cheat and 'Procedural abstraction' in cheat

src = '''<!-- Lecture 2 listings. Line numbers match the Lecture 2 notes. -->
<script type="text/plain" id="src-sum-pieces">import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

public class Sum {
    public static void main(String[] args) {
        System.out.println("Enter some numbers.");
        List<Integer> list = readList();
        System.out.println("Got " + list);
        System.out.println("The sum of your list was: " + sumList(list));
    }

    static List<Integer> readList() {
        Scanner in = new Scanner(System.in);
        List<Integer> list = new ArrayList<>();
        while (in.hasNextInt()) {
            list.add(in.nextInt());
        }
        return list;
    }

    static int sumList(List<Integer> list) {
        int sum = 0;
        for (int i = 0; i < list.size(); i++) {
            sum += list.get(i);
        }
        return sum;
    }
}</script>
<script type="text/plain" id="src-middle">/**
 * Returns the element in the middle of a list.
 *
 * @param list the list to look in; must be non-null
 * @requires list has an odd number of elements
 * @return the element with as many elements before it as after it
 */
static int middle(List<Integer> list) {
    return list.get(list.size() / 2);
}</script>
<script type="text/plain" id="src-javadoc-two">/**
 * Reads whole numbers typed by the user.
 *
 * @return a list holding, in order, every number the user typed
 *     before the input ended or something that was not an int appeared
 */
static List<Integer> readList()

/**
 * Adds up a list of numbers.
 *
 * @param list the numbers to add; must be non-null
 * @return the sum of the elements of list, wrapped into the int range
 *     if the true sum falls outside it
 */
static int sumList(List<Integer> list)</script>
<script type="text/plain" id="src-readinto">/**
 * Reads whole numbers typed by the user into a list.
 *
 * @param list the list to add to; must be non-null
 * @modifies list
 * @effects adds to the end of list, in order, every number the user
 *     typed before the input ended or something that was not an int
 *     appeared
 */
static void readInto(List<Integer> list)</script>
<script type="text/plain" id="src-across">System.out.println("Enter some numbers.");
List<Integer> list = readList();
§{{ list holds, in order, every number the user typed before
§   the input ended or something that was not an int appeared }}
System.out.println("Got " + list);
System.out.println("The sum of your list was: " + sumList(list));</script>
<script type="text/plain" id="src-sumlist-forward">static int sumList(List<Integer> list) {
    int sum = 0;
    for (int i = 0; i < list.size(); i++) {
        sum += list.get(i);
    }
    return sum;
}</script>
<script type="text/plain" id="src-sumlist-backward">static int sumList(List<Integer> list) {
    int sum = 0;
    for (int i = list.size() - 1; i >= 0; i--) {
        sum += list.get(i);
    }
    return sum;
}</script>
<script type="text/plain" id="src-indexof-head">/**
 * Searches for a value in part of an array.
 *
 * @param a the array to search; must be non-null
 * @param lo the index where the range to search begins
 * @param hi the index just past where the range to search ends
 * @param x the value to search for
 * ... and one of the specifications below ...
 */
static int indexOf(int[] a, int lo, int hi, int x)</script>
<script type="text/plain" id="src-indexof-specs">Spec A
  @requires 0 <= lo <= hi <= a.length, and a[i] == x for some i
            with lo <= i < hi
  @return   an index i with lo <= i < hi and a[i] == x

Spec B
  @requires 0 <= lo <= hi <= a.length
  @return   the smallest index i with lo <= i < hi and a[i] == x,
            or -1 if there is none

Spec C
  @requires 0 <= lo <= hi <= a.length
  @return   the largest index i with lo <= i < hi and a[i] == x,
            or -1 if there is none

Spec D
  @requires 0 <= lo <= hi <= a.length
  @return   some index i with lo <= i < hi and a[i] == x,
            or -1 if there is none

Spec E
  @requires 0 <= lo <= hi <= a.length
  @return   the smallest index i with lo <= i < hi and a[i] == x
  @throws   NoSuchElementException if there is none</script>
<script type="text/plain" id="src-indexof-impls">// Implementation 1
for (int i = lo; i < hi; i++) {
    if (a[i] == x) {
        return i;
    }
}
return -1;

// Implementation 2
for (int i = lo; i < hi; i++) {
    if (a[i] == x) {
        return i;
    }
}
throw new NoSuchElementException();

// Implementation 3
int i = lo;
while (a[i] != x) {
    i++;
}
return i;

// Implementation 4
for (int i = hi - 1; i >= lo; i--) {
    if (a[i] == x) {
        return i;
    }
}
return -1;</script>
<script type="text/plain" id="src-count">static int count(int[] a, int x) {
    int c = 0;
    int i = indexOf(a, 0, a.length, x);
    while (i != -1) {
        c++;
        i = indexOf(a, i + 1, a.length, x);
    }
    return c;
}</script>
<script type="text/plain" id="src-maxlist">static int maxList(List<Integer> list) {
    int max = list.get(0);
    for (int i = 1; i < list.size(); i++) {
        if (list.get(i) > max) {
            max = list.get(i);
        }
    }
    return max;
}</script>
<script type="text/plain" id="src-maxlist-spec">/**
 * Returns the largest element of a list.
 *
 * @param list the list to search; must be non-null
 * @requires list is not empty
 * @return the largest element of list
 */</script>
<script type="text/plain" id="src-sign-specs">Spec S1
  @return   1 if x > 0, -1 if x < 0, and 0 if x == 0

Spec S2
  @return   a positive number if x > 0, a negative number if x < 0,
            and 0 if x == 0

Spec S3
  @requires x != 0
  @return   1 if x > 0 and -1 if x < 0</script>
<script type="text/plain" id="src-sign-impls">// Implementation 1
return Integer.signum(x);

// Implementation 2
return x;

// Implementation 3
return x / Math.abs(x);</script>
<script type="text/plain" id="src-sign-clients">/**
 * Tells whether two numbers have the same sign.
 *
 * @return true if x and y are both positive, both negative, or
 *     both zero, and false otherwise
 */
static boolean sameSign(int x, int y) {
    return sign(x) == sign(y);
}

/**
 * Tells whether a number is positive.
 *
 * @return true if x > 0, and false otherwise
 */
static boolean isPositive(int x) {
    return sign(x) > 0;
}</script>
'''

head = '''<!doctype html>
<!--
  CSE 331 (Autumn 2026) · Week 1 teaching site (Wed Sept 30 to Fri Oct 2), built with the course-teaching-site skill.
  Sources (raw copies and URLs in ../raw/sources.json): Lecture 1 notes and slides ("Welcome! Whole program
  assertions", Sept 30), Lecture 2 notes and slides ("Procedural abstraction and specification", Oct 2), the
  calendar, syllabus, resources, Reading 1 and the readings page. No section met in this range; Section 1
  (Tue Oct 6) and its solution were still "not yet available" when this was built.

  Where each component lives:
    Sidebar rail .................... <nav class="rail">
    Week overview + hero widget ..... #home (hero: run Sum and judge the first "user manual" sentence)
    Lecture 1 modules ............... #l1-runs, #l1-spec, #l1-assert, #l1-reason, #l1-edge, #l1-know
    Lecture 2 modules ............... #l2-pieces, #l2-javadoc, #l2-across, #l2-meets, #l2-strength, #l2-client
    Interactive widgets ............. .term[data-input] transcripts, Sum stepper (#stepper), spec clause explorer,
                                      #l2 two-programs runner, middle() caller, abstraction barrier, indexOf call lab,
                                      strength grid, count stepper
    Check your understanding ........ #l1-quiz, #l2-quiz (li.cyu[data-id])
    Answerable problems ............. #l1-exercises, #l2-exercises (article.task[data-id] > .answer-spec[data-part])
    Reading / cheat sheet ........... #reading, #cheatsheet
  Every stateful element has a stable semantic data-id (see ../INTEGRATION.md). Answer keys live in js/keys.js.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CSE 331 week 1</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;600;700;800&family=Atkinson+Hyperlegible+Mono:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<div class="shell">

<nav class="rail" aria-label="Week 1 modules">
  <a class="brand" href="#home">CSE 331, week 1<small>Assertions and specifications</small></a>

  <div>
    <h2>Lecture 1 (Wed, Sept 30)</h2>
    <ol class="modules">
      <li><a href="#l1-runs">Every run</a></li>
      <li><a href="#l1-spec">The specification</a></li>
      <li><a href="#l1-assert">Assertions</a></li>
      <li><a href="#l1-reason">Reasoning between assertions</a></li>
      <li><a href="#l1-edge">The edge of the program</a></li>
      <li><a href="#l1-know">How do you come to know</a></li>
      <li><a href="#l1-quiz">Check your understanding</a></li>
      <li><a href="#l1-exercises">Lecture 1 exercises</a></li>
    </ol>
  </div>
  <div>
    <h2>Lecture 2 (Fri, Oct 2)</h2>
    <ol class="modules">
      <li><a href="#l2-pieces">Sum, in pieces</a></li>
      <li><a href="#l2-javadoc">Writing it in Java</a></li>
      <li><a href="#l2-across">Reasoning across a call</a></li>
      <li><a href="#l2-meets">Meeting a specification</a></li>
      <li><a href="#l2-strength">Stronger and weaker</a></li>
      <li><a href="#l2-client">Writing a client</a></li>
      <li><a href="#l2-quiz">Check your understanding</a></li>
      <li><a href="#l2-exercises">Lecture 2 problems</a></li>
    </ol>
  </div>
  <div>
    <h2>Section</h2>
    <p class="rail-note">No section met Sept 30 to Oct 2. Section 1 (Tue, Oct 6) isn't posted yet.</p>
  </div>
  <div>
    <h2>Reference</h2>
    <ul class="plain">
      <li><a href="#reading">Reading 1</a></li>
      <li><a href="#cheatsheet">Cheat sheet</a></li>
      <li><a href="#home">Week overview</a></li>
    </ul>
  </div>

  <p class="rail-foot"><kbd>←</kbd> <kbd>→</kbd> move between modules · <kbd>N</kbd> next step · <kbd>H</kbd> next hint</p>
</nav>

<main id="main">

'''
tail = '''
</main>
</div>

<div class="toasts" id="toasts" aria-live="polite" aria-atomic="false"></div>

''' + scripts.rstrip() + '\n' + src + '''
<script>window.COURSE_SITE_STORAGE = window.COURSE_SITE_STORAGE || undefined;</script>
<script src="js/sum-sim.js"></script>
<script src="js/spec-sim.js"></script>
<script src="js/grader.js"></script>
<script src="js/keys.js"></script>
<script src="js/store.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
<script defer src="js/app.js"></script>
</body>
</html>
'''
# Lecture 1 quiz page title + score containers (shared quiz code finds them by data-role)
l1 = l1.replace('data-title="Check your understanding" data-unit="l1"', 'data-title="Check your understanding: Lecture 1" data-unit="l1"')
l1 = l1.replace('<div class="cyu-score" id="cyu-score" role="status"></div>', '<div class="cyu-score" data-role="score" role="status"></div>')
l1 = l1.replace('<div class="cyu-score" id="cyu-summary" role="status"></div>', '<div class="cyu-score" data-role="summary" role="status"></div>')
l1 = l1.replace('data-title="Lecture exercises" data-unit="l1"', 'data-title="Lecture 1 exercises" data-unit="l1"')
l1 = l1.replace('<h1>Lecture exercises</h1>', '<h1>Lecture 1 exercises</h1>')
l1 = l1.replace('Everything saves in this browser as you type.', 'Everything saves as you type.')
l1 = l1.replace('<li>Coming up Friday: <code>Sum</code> split into methods, where its assertions become promises between them.</li>', '<li>Friday\'s lecture splits <code>Sum</code> into methods, where these assertions become promises between them: <a href="#l2-pieces">Lecture 2</a>.</li>')
l1 = l1.replace('<li>The next lecture names this comparison, and Homework 1 asks students to make such comparisons themselves. Don\'t preview Homework 1\'s specs here.</li>', '<li>Lecture 2 names this comparison: the specification is <a href="#l2-strength">stronger</a> than B. Homework 1 asks students to make such comparisons themselves; don\'t preview its specs here.</li>')
html = head + home + "\n\n" + l1 + "\n\n" + l2 + "\n\n" + reading + "\n\n" + cheat + "\n" + tail
html = html.replace('<li><strong>Every program transcript', '<li><strong>Every program transcript')
open('site/index.html', 'w').write(html)
print(len(html))
