import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = dirname(fileURLToPath(import.meta.url));
const input = resolve(process.argv[2] ?? join(root, '../site'));
if (!existsSync(join(input, 'index.html'))) throw new Error('Static directory needs index.html');
const checkout = join(root, '.sites-checkout');
mkdirSync(checkout, { recursive: true });
for (const name of ['.openai', 'drizzle', 'worker.mjs']) cpSync(join(root, name), join(checkout, name), { recursive: true });
writeFileSync(join(checkout, '.gitignore'), 'dist/\n');
rmSync(join(checkout, 'static'), { recursive: true, force: true });
cpSync(input, join(checkout, 'static'), { recursive: true });
const dist = join(checkout, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'server'), { recursive: true });
cpSync(input, join(dist, 'client'), { recursive: true });
cpSync(join(root, '.openai'), join(dist, '.openai'), { recursive: true });
cpSync(join(root, 'drizzle'), join(dist, '.openai/drizzle'), { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.mp4': 'video/mp4', '.wasm': 'application/wasm' };
const files = {};
function walk(dir, prefix = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Static files must not be symlinks');
    const name = join(dir, entry.name), path = prefix + '/' + entry.name;
    if (entry.isDirectory()) walk(name, path);
    else if (entry.isFile()) files[path] = [mime[extname(entry.name)] ?? 'application/octet-stream', readFileSync(name).toString('base64')];
  }
}
walk(input);
writeFileSync(join(dist, 'server/index.js'), 'const FILES = ' + JSON.stringify(files) + ';\n' + readFileSync(join(root, 'worker.mjs'), 'utf8'));
const archive = join(root, '../.scratch/cse-study.tar.gz');
mkdirSync(dirname(archive), { recursive: true });
const result = spawnSync('tar', ['-czf', archive, '-C', checkout, 'dist'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(JSON.stringify({ checkout_path: checkout, archive, static_directory: input }));
