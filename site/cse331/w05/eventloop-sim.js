/* CSE 331 week 5: a model of Lecture 12's guestbook in the browser: load and post, each cut in two at its await,
   two requests out at once, and whatever order the server and the network give them. Pure functions:
   window.EventLoopSim in the browser, require() in Node. checks/cse331/w05/verify.mjs runs the notes' real app.js
   (show, load, post) against a fake page and a fetch whose answers it releases in every possible order, and
   checks that the page ends as this model says.

   create({ book: ["ada: hello"], message: "bob: hi" }) -> machine
     machine.can(action) / machine.do(action) for the actions
       "load"         the page loads: load runs to its first await and sends GET /api/messages
       "click"        Post is clicked: post runs to its first await and sends POST /api/messages
       "serveGet"     the server handles the GET (answers with the book as it is now)
       "servePost"    the server handles the POST (adds the message, answers with the book)
       "arriveGet"    load's response reaches the browser: the rest of load runs and draws the list
       "arrivePost"   post's response reaches the browser: the rest of post runs and draws the list
     machine.state() -> { boxes, book, page, out, log } */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EventLoopSim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const ACTIONS = ["load", "click", "serveGet", "servePost", "arriveGet", "arrivePost"];
  function create({ book = ["ada: hello"], message = "bob: hi" } = {}) {
    const st = { book: book.slice(), page: [], boxes: [], log: [], sent: {}, served: {}, arrived: {}, answer: {} };
    const can = (a) => ({
      load: !st.sent.get,
      click: st.sent.get && !st.sent.post, // line 40 runs load before any click is possible
      serveGet: st.sent.get && !st.served.get,
      servePost: st.sent.post && !st.served.post,
      arriveGet: st.served.get && !st.arrived.get,
      arrivePost: st.served.post && !st.arrived.post,
    })[a];
    function act(a) {
      if (!can(a)) throw new Error(`cannot ${a} now`);
      if (a === "load") { st.sent.get = true; st.boxes.push("load, to its await"); st.log.push("browser sends GET /api/messages"); }
      if (a === "click") { st.sent.post = true; st.boxes.push("post, to its await"); st.log.push("browser sends POST /api/messages"); }
      if (a === "serveGet") { st.served.get = true; st.answer.get = st.book.slice(); st.log.push(`server answers the GET with ${JSON.stringify(st.answer.get)}`); }
      if (a === "servePost") { st.served.post = true; st.book.push(message); st.answer.post = st.book.slice(); st.log.push(`server adds the message, answers the POST with ${JSON.stringify(st.answer.post)}`); }
      if (a === "arriveGet") { st.arrived.get = true; st.page = st.answer.get.slice(); st.boxes.push("the rest of load"); st.log.push("load's response arrives; the rest of load draws the list"); }
      if (a === "arrivePost") { st.arrived.post = true; st.page = st.answer.post.slice(); st.boxes.push("the rest of post"); st.log.push("post's response arrives; the rest of post draws the list"); }
    }
    return { can, do: act, state: () => ({ boxes: st.boxes.slice(), book: st.book.slice(), page: st.page.slice(), log: st.log.slice(), done: ACTIONS.every((a) => !can(a)) }) };
  }
  // every complete order of the six actions that the rules allow
  function orders() {
    const out = [];
    const rec = (seq) => {
      const m = create();
      for (const a of seq) m.do(a);
      const next = ACTIONS.filter((a) => m.can(a));
      if (!next.length) { out.push(seq); return; }
      for (const a of next) rec([...seq, a]);
    };
    rec([]);
    return out;
  }
  return { ACTIONS, create, orders };
});
