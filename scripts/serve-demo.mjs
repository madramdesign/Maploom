// Serves apps/web/out under a base path, like GitHub Pages does.  node scripts/serve-demo.mjs [port] [/BasePath]
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)), 'apps/web/out');
const port = Number(process.argv[2] ?? 4173);
const base = process.argv[3] ?? '/Maploom';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain', '.png': 'image/png' };
createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!url.startsWith(base)) return void res.writeHead(404).end('outside base path');
  let file = normalize(join(root, url.slice(base.length)));
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return void res.writeHead(404, { 'Content-Type': 'text/html' }).end(readFileSync(join(root, '404.html')));
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
}).listen(port, () => console.log(`demo at http://localhost:${port}${base}/`));
