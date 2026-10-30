/* CSE 331 week 4: a simulator of Lecture 9's Guestbook.java (115 lines). Pure functions: window.GuestbookSim in the
   browser, require() in Node. checks/cse331/w04/verify.mjs runs the real Guestbook and sends it the same requests.

   const g = create({ escape, checkFields });   // escape: exercise 2's escape(); checkFields: exercise 1's check
   g.request({ method, path, body }) -> { log, status, headers, body, bytes } or { log, closed: true, error }
     log is the line the terminal prints ("POST /"); closed means handle threw and no response came back.
   parseForm and decode follow java.net.URLDecoder for ASCII escapes; a % the decoder rejects throws, as in Java. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GuestbookSim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const enc = new TextEncoder();
  const utf8 = (bytes) => new TextDecoder("utf-8").decode(new Uint8Array(bytes));

  // java.net.URLDecoder.decode(s, UTF_8)
  function decode(s) {
    let out = "", i = 0;
    const n = s.length;
    while (i < n) {
      let c = s[i];
      if (c === "+") { out += " "; i++; continue; }
      if (c !== "%") { out += c; i++; continue; }
      const bytes = [];
      while (i + 2 < n && c === "%") {
        const h = s.slice(i + 1, i + 3);
        // Integer.parseInt(s, i + 1, i + 3, 16): two hex digits, or a sign and one
        let v = null;
        if (/^[0-9a-fA-F]{2}$/.test(h)) v = parseInt(h, 16);
        else if (/^\+[0-9a-fA-F]$/.test(h)) v = parseInt(h.slice(1), 16);
        else if (/^-[0-9a-fA-F]$/.test(h)) v = -parseInt(h.slice(1), 16);
        if (v === null) throw new Error(`java.lang.IllegalArgumentException: URLDecoder: Illegal hex characters in escape (%) pattern`);
        if (v < 0) throw new Error("java.lang.IllegalArgumentException: URLDecoder: Illegal hex characters in escape (%) pattern - negative value");
        bytes.push(v);
        i += 3;
        if (i < n) c = s[i];
      }
      if (i < n && c === "%") throw new Error("java.lang.IllegalArgumentException: URLDecoder: Incomplete trailing escape (%) pattern");
      out += utf8(bytes);
    }
    return out;
  }
  // Java's String.split(regex) drops trailing empty strings; split("=", 2) keeps them
  function splitDrop(s, sep) { const parts = s.split(sep); while (parts.length && parts[parts.length - 1] === "") parts.pop(); return s === "" ? [""] : parts; }
  function parseForm(body) {
    const fields = new Map();
    for (const pair of splitDrop(body, "&")) {
      const at = pair.indexOf("=");
      const parts = at < 0 ? [pair] : [pair.slice(0, at), pair.slice(at + 1)];
      const name = decode(parts[0]);
      const value = parts.length < 2 ? "" : decode(parts[1]);
      fields.set(name, value);
    }
    return fields;
  }
  const escapeHtml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function create(opts = {}) {
    const book = [];
    const page = () => {
      let html = "<html><body>\n<h1>Guestbook</h1>\n<ul>\n";
      for (const m of book) html += "<li>" + (opts.escape ? escapeHtml(m) : m) + "</li>\n";
      html += "</ul>\n<form method=\"POST\" action=\"/\">\nName: <input name=\"name\">\nMessage: <input name=\"message\">\n<button>Post</button>\n</form>\n</body></html>\n";
      return html;
    };
    function request({ method = "GET", path = "/", body = "" }) {
      const log = `${method} ${path}`;
      try {
        if (method === "POST") {
          const fields = parseForm(body);
          const name = fields.has("name") ? fields.get("name") : null;
          const message = fields.has("message") ? fields.get("message") : null;
          if (!opts.checkFields || (name !== null && message !== null)) book.push(`${name}: ${message}`);
        }
      } catch (e) {
        return { log, closed: true, error: e.message };
      }
      const text = page();
      const bytes = enc.encode(text).length;
      return { log, status: 200, headers: [["Content-type", "text/html; charset=utf-8"], ["Content-length", String(bytes)]], body: text, bytes };
    }
    return { request, book: () => book.slice(), page };
  }
  // what a browser sends for a form, as application/x-www-form-urlencoded
  function encodeForm(fields) {
    const e = (s) => [...enc.encode(s)].map((b) => { const ch = String.fromCharCode(b); return /[A-Za-z0-9*\-._]/.test(ch) ? ch : b === 32 ? "+" : "%" + b.toString(16).toUpperCase().padStart(2, "0"); }).join("");
    return fields.map(([k, v]) => `${e(k)}=${e(v)}`).join("&");
  }
  return { create, parseForm, decode, encodeForm, escapeHtml };
});
