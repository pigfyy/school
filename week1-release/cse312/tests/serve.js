"use strict";
// Tiny static server for ../site (and ../examples under /examples/). Usage: node serve.js [port]
const http = require("http");
const fs = require("fs");
const path = require("path");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".json": "application/json", ".png": "image/png" };
const SITE = path.resolve(__dirname, "../site");
const EXAMPLES = path.resolve(__dirname, "../examples");
function start(port = 0) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const base = url.startsWith("/examples/") ? EXAMPLES : SITE;
    const rel = url.startsWith("/examples/") ? url.slice("/examples".length) : url;
    let file = path.join(base, rel === "/" ? "index.html" : rel);
    if (!file.startsWith(base)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}
module.exports = { start };
if (require.main === module) start(Number(process.argv[2]) || 8312).then(({ url }) => console.log(`serving ${url}`));
