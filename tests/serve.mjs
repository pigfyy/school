// Static server for site/ (no API: the store falls back to localStorage). node tests/serve.mjs [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../site");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
export function serve(port = 8400) {
  const server = http.createServer((req, res) => {
    let p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      if (!req.url.split("?")[0].endsWith("/")) { res.writeHead(301, { location: req.url.replace(/(\?|$)/, "/$1") }); return res.end(); }
      p = path.join(p, "index.html");
    }
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}
if (process.argv[1] === new URL(import.meta.url).pathname) serve(Number(process.argv[2]) || 8400).then(() => console.log("http://localhost:" + (Number(process.argv[2]) || 8400) + "/"));
