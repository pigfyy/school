// Static server for the week 2 site. Serves site/ at / and examples/ at /examples/.
//   node tests/serve.mjs            -> http://localhost:9331/
//   PORT=8000 node tests/serve.mjs
// Add ?mock=1 to load examples/mock-adapter.js as window.COURSE_SITE_STORAGE (latency 20-120 ms), so the
// adapter path can be tried by hand; from the console: COURSE_SITE_STORAGE.control.failNext(3).
// Also exported as start(port) for the tests.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const base = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const MOCK = `<script src="/examples/mock-adapter.js"></script>
<script>window.COURSE_SITE_STORAGE = MockAdapter.create({ persistKey: "mock-server", latencyMs: [20, 120] });</script>
<script src="js/app.js"></script>`;

export function start(port = 9331, { root = join(base, "site") } = {}) {
  const srv = createServer((q, r) => {
    const [rawPath, query = ""] = q.url.split("?");
    const path = normalize(decodeURIComponent(rawPath)).replace(/^(\.\.[/\\])+/, "");
    const dir = path.startsWith("/examples/") ? base : root;
    let p = join(dir, path);
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
    if (!p.startsWith(dir) || !existsSync(p)) { r.writeHead(404, { "content-type": "text/plain" }); return r.end("not found"); }
    let body = readFileSync(p);
    if (p.endsWith("index.html") && /(^|&)mock=1/.test(query)) body = body.toString().replace('<script src="js/app.js"></script>', MOCK);
    r.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
    r.end(body);
  });
  return new Promise((resolve) => srv.listen(port, () => resolve(srv)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 9331);
  await start(port);
  console.log(`CSE 331 week 2 site: http://localhost:${port}/   (mock adapter: http://localhost:${port}/?mock=1)`);
}
