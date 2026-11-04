// The site on this machine, like the live one: site/ straight from disk, and saved answers through the real
// deploy/worker.mjs with a local SQLite file standing in for the Site's database.
// bun dev [port]   → http://localhost:8400/, answers kept in .scratch/local.sqlite
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import worker from "../deploy/worker.mjs";

const repo = resolve(import.meta.dir, "..");
const site = join(repo, "site");

// The two calls worker.mjs makes on the Site's database: prepare(sql).bind(...).first() / .run().
function localDb(file) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file, { create: true });
  if (!db.query("SELECT name FROM sqlite_master WHERE name = 'state'").get()) db.exec(readFileSync(join(repo, "deploy/drizzle/0000_state.sql"), "utf8"));
  return {
    prepare: (sql) => ({ bind: (...args) => ({ first: async () => db.query(sql).get(...args), run: async () => db.query(sql).run(...args) }) }),
  };
}

function staticFile(url) {
  let path;
  try { path = join(site, decodeURIComponent(url.pathname)); } catch { return new Response("bad path", { status: 400 }); }
  if (path !== site && !path.startsWith(site + "/")) return new Response("forbidden", { status: 403 });
  if (existsSync(path) && statSync(path).isDirectory()) {
    if (!url.pathname.endsWith("/")) return Response.redirect(url.pathname + "/" + url.search, 301);
    path = join(path, "index.html");
  }
  if (!existsSync(path)) return new Response("not found", { status: 404 });
  return new Response(Bun.file(path), { headers: { "cache-control": "no-store" } });
}

// db: a SQLite file path or ":memory:" to serve the save API; null for no API (the store then keeps answers in localStorage only).
export function serve({ port = 8400, db = null } = {}) {
  const env = db && { DB: localDb(db) };
  return Bun.serve({
    port,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url);
      if (!url.pathname.startsWith("/api/")) return staticFile(url);
      if (!env) return new Response("not found", { status: 404 });
      // The live Site adds the signed-in user's identity; locally there is one user.
      const headers = new Headers(req.headers);
      headers.set("oai-authenticated-user-id", "local");
      headers.set("oai-authenticated-user-email", "local@localhost");
      return worker.fetch(new Request(req, { headers }), env);
    },
  });
}

if (import.meta.main) {
  const db = join(repo, ".scratch/local.sqlite");
  const server = serve({ port: Number(process.argv[2]) || 8400, db });
  console.log(`http://localhost:${server.port}/   (answers saved in ${db})`);
}
