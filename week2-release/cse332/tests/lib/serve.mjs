// Tiny static server for the site (no dependencies).
//   Preview:  node tests/lib/serve.mjs            -> http://localhost:9332/
//   Tests:    import { serve } from "./lib/serve.mjs"; await serve(root, 0)   (0 = any free port)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8" };
const HERE = fileURLToPath(new URL(".", import.meta.url));
export const SITE_ROOT = resolve(HERE, "../../site");
export const PORT = 9332;

export function serve(root = SITE_ROOT, port = PORT, host = "127.0.0.1") {
  return new Promise((done, fail) => {
    const srv = createServer(async (req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const file = normalize(join(root, p));
      if (!file.startsWith(normalize(root))) { res.writeHead(403); res.end(); return; }
      try { const b = await readFile(file); res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "cache-control": "no-store" }); res.end(b); }
      catch { res.writeHead(404); res.end("not found"); }
    });
    srv.on("error", fail);
    srv.listen(port, host, () => done({ srv, url: `http://${host === "0.0.0.0" ? "localhost" : host}:${srv.address().port}` }));
  });
}
export const CHROME = process.env.CHROME || `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell`;

// run directly: serve the site on port 9332
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || PORT;
  const { url } = await serve(SITE_ROOT, port, "127.0.0.1");
  console.log(`CSE 332 week 2 site: ${url.replace("127.0.0.1", "localhost")}/  (Ctrl+C to stop)`);
}
