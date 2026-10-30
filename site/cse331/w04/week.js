/* CSE 331 week 4: this week's widgets. The shared engine (core/app.js) runs the checks, quizzes, problems, saving
   and navigation; this file only wires the interactive pieces:
     .gb   Lecture 9's guestbook (guestbook-sim.js): two browser windows, a curl line, the terminal, and every
           request and response as text. The page a browser draws is rebuilt from a whitelist (h1, li, b, i,
           strong, em); nothing a visitor types is ever inserted into this site as HTML.
     .qx   Lectures 10 and 11's help queues (queue-sim.js): call join, next, size, waiting, and watch the fields,
           the representation invariant and the abstraction function. */
"use strict";
window.WEEK = window.WEEK || {};
window.WEEK.widgets = function ({ $, $$, el }) {
  const GB = window.GuestbookSim, QS = window.QueueSim;

  /* =========================================================== the guestbook */
  const SAFE = new Set(["B", "STRONG", "I", "EM"]);
  function safeNodes(node) { // inert DOM (from DOMParser) -> nodes built here, whitelisted
    const out = [];
    for (const c of node.childNodes) {
      if (c.nodeType === 3) out.push(document.createTextNode(c.data));
      else if (c.nodeType === 1 && SAFE.has(c.tagName)) out.push(el(c.tagName.toLowerCase(), {}, ...safeNodes(c)));
      else if (c.nodeType === 1 && c.tagName === "SCRIPT") out.push(el("span", { class: "gb-warn", text: "[a <script> here would run code in this visitor's browser]" }));
      else if (c.nodeType === 1) out.push(...safeNodes(c));
    }
    return out;
  }
  function drawPage(target, body) {
    target.replaceChildren();
    if (body == null) { target.append(el("p", { class: "gb-blank", text: "(no page yet)" })); return; }
    const doc = new DOMParser().parseFromString(body, "text/html");
    const h = doc.querySelector("h1");
    if (h) target.append(el("p", { class: "gb-h1", text: h.textContent }));
    const items = [...doc.querySelectorAll("li")];
    if (items.length) target.append(el("ul", {}, ...items.map((li) => el("li", {}, ...safeNodes(li)))));
    target.append(el("p", { class: "gb-formmock", text: "Name: [        ]  Message: [        ]  [Post]" }));
  }
  $$(".gb").forEach((box) => {
    const fixes = box.hasAttribute("data-fixes");
    let sim, pages, lastReq, lastRes, log;
    const term = el("pre", { class: "gb-term", "aria-live": "polite" });
    const reqText = el("pre", { class: "gb-text" }), resText = el("pre", { class: "gb-text" });
    const winA = el("div", { class: "gb-view" }), winB = el("div", { class: "gb-view" });
    const name = el("input", { type: "text", value: "Ada", "aria-label": "Name", class: "no-keys" });
    const msg = el("input", { type: "text", value: "hello world", "aria-label": "Message", class: "no-keys" });
    const ck = el("input", { type: "checkbox" }), es = el("input", { type: "checkbox" });
    const method = el("select", { "aria-label": "curl method" }, el("option", { value: "POST", text: "POST" }), el("option", { value: "GET", text: "GET" }));
    const path = el("input", { type: "text", value: "/", "aria-label": "Path", class: "no-keys gb-path" });
    const cbody = el("input", { type: "text", value: "name=%&message=x", "aria-label": "Body", class: "no-keys" });
    const btn = (t, f) => { const b = el("button", { class: "btn", type: "button", text: t }); b.addEventListener("click", f); return b; };
    function reset() { sim = GB.create({ checkFields: ck.checked, escape: es.checked }); pages = { A: null, B: null }; lastReq = lastRes = null; log = ["$ java Guestbook", "Serving at http://localhost:9331/"]; draw(); }
    function requestText(r) {
      const lines = [`${r.method} ${r.path} HTTP/1.1`, "Host: localhost:9331"];
      if (r.body !== undefined && r.method === "POST") lines.push(`Content-Length: ${new TextEncoder().encode(r.body).length}`, "Content-Type: application/x-www-form-urlencoded");
      lines.push("", r.method === "POST" ? r.body : "");
      return lines.join("\n");
    }
    function send(r, win) {
      const res = sim.request(r);
      log.push(res.log);
      lastReq = r; lastRes = res;
      if (win && !res.closed) pages[win] = res.body;
      if (win && !res.closed) { const icon = sim.request({ method: "GET", path: "/favicon.ico" }); log.push(icon.log); }
      draw();
    }
    function draw() {
      term.textContent = log.join("\n");
      term.scrollTop = term.scrollHeight;
      reqText.textContent = lastReq ? requestText(lastReq) : "(nothing sent yet)";
      resText.textContent = !lastRes ? "(nothing yet)" : lastRes.closed ? `(no response: the connection closed)\n\nhandle threw ${lastRes.error}` : `HTTP/1.1 200 OK\n${lastRes.headers.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${lastRes.body}`;
      drawPage(winA, pages.A); drawPage(winB, pages.B);
    }
    const formRow = el("div", { class: "controls" }, el("label", {}, "Name ", name), el("label", {}, "Message ", msg),
      btn("Post from A", () => send({ method: "POST", path: "/", body: GB.encodeForm([["name", name.value], ["message", msg.value]]) }, "A")));
    const openRow = el("div", { class: "controls" }, btn("Open / in browser A", () => send({ method: "GET", path: "/" }, "A")), btn("Open / in browser B", () => send({ method: "GET", path: "/" }, "B")), btn("Restart the program", reset));
    const curlRow = el("div", { class: "controls gb-curl" }, el("span", { class: "mono", text: "curl -X" }), method, path, el("span", { class: "mono", text: "-d" }), cbody,
      btn("Send", () => send({ method: method.value, path: path.value || "/", body: method.value === "POST" ? cbody.value : undefined }, null)));
    const fixRow = fixes ? el("div", { class: "controls" }, el("label", {}, ck, " exercise 1: add only with both fields"), el("label", {}, es, " exercise 2: escape the message")) : null;
    [ck, es].forEach((c) => c.addEventListener("change", reset));
    box.append(openRow, formRow, curlRow, ...(fixRow ? [fixRow] : []),
      el("div", { class: "gb-grid" },
        el("div", {}, el("p", { class: "col-label", text: "browser A draws" }), winA),
        el("div", {}, el("p", { class: "col-label", text: "browser B draws" }), winB),
        el("div", {}, el("p", { class: "col-label", text: "the terminal" }), term)),
      el("div", { class: "gb-grid two" },
        el("div", {}, el("p", { class: "col-label", text: "the last request, as text" }), reqText),
        el("div", {}, el("p", { class: "col-label", text: "the response, as text" }), resText)));
    reset();
    for (const step of (box.dataset.start || "").split(";").filter(Boolean)) {
      if (step === "A") send({ method: "GET", path: "/" }, "A");
      else if (step === "B") send({ method: "GET", path: "/" }, "B");
      else if (step === "post") send({ method: "POST", path: "/", body: GB.encodeForm([["name", "Ada"], ["message", "hello world"]]) }, "A");
    }
  });

  /* =========================================================== the help queues */
  $$(".qx").forEach((box) => {
    const kinds = (box.dataset.kinds || "list").split(" ");
    let q, calls;
    const sel = el("select", { "aria-label": "Which class" }, ...kinds.map((k) => el("option", { value: k, text: QS.KINDS[k].label })));
    const id = el("input", { type: "text", value: "ada", "aria-label": "NetID", class: "no-keys short" });
    const fieldsBox = el("table", { class: "plain small qx-fields" });
    const riBox = el("p", { class: "qx-ri" }), afBox = el("p", { class: "qx-af" });
    const callLog = el("ol", { class: "qx-log" });
    const btn = (t, f) => { const b = el("button", { class: "btn", type: "button", text: t }); b.addEventListener("click", f); return b; };
    const call = (op, arg) => {
      const r = q[op](arg);
      const shown = "error" in r ? `throws ${r.error}` : r.value === null ? "returns" : `returns ${Array.isArray(r.value) ? `[${r.value.join(", ")}]` : r.value}`;
      calls.push([`${op}(${arg !== undefined ? `"${arg}"` : ""})`, shown, "error" in r]);
      draw();
    };
    function reset() { q = QS.make(sel.value); calls = []; draw(); }
    function draw() {
      fieldsBox.replaceChildren(el("tr", {}, el("th", { text: "field" }), el("th", { text: "value (the concrete state)" })), ...q.fields().map(([k, v]) => el("tr", {}, el("td", {}, el("code", { text: k })), el("td", {}, el("code", { text: v })))));
      const ri = q.ri(), af = q.af();
      riBox.className = `qx-ri ${ri ? "ok" : "bad"}`;
      riBox.textContent = ri ? "RI: true" : "RI: false. The fields no longer agree.";
      afBox.replaceChildren(el("b", { text: "AF(this), the queue a client should picture: " }), af === null ? "no value (the AF is defined only where the RI holds)" : af.length ? af.join(", ") + "  (front first)" : "nobody waiting");
      callLog.replaceChildren(...calls.map(([c, r, bad]) => el("li", { class: bad ? "bad" : "" }, el("code", { text: c }), " ", r)));
    }
    sel.addEventListener("change", reset);
    const presets = JSON.parse(box.dataset.presets || "[]").map(([label, ops]) => btn(label, () => { reset(); for (const o of ops.split(" ")) { const [op, arg] = o.split(":"); call(op, arg); } }));
    box.append(el("div", { class: "controls" }, sel, btn("restart", reset)),
      el("div", { class: "controls" }, el("label", {}, "NetID ", id), btn("join", () => call("join", id.value.trim() || "ada")), btn("next", () => call("next")), btn("size", () => call("size")), btn("waiting", () => call("waiting"))),
      ...(presets.length ? [el("div", { class: "controls presets" }, el("span", { class: "muted", text: "Try:" }), ...presets)] : []),
      el("div", { class: "qx-grid" }, el("div", {}, fieldsBox, riBox, afBox), el("div", {}, el("p", { class: "col-label", text: "calls, in order" }), callLog)));
    if (box.dataset.start) sel.value = box.dataset.start;
    reset();
  });
};
