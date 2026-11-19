// Copies the OFL font files the renderer needs into the web app's public folder.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'packages/render/package.json'));
const src = readFileSync(join(root, 'packages/render/src/fonts.ts'), 'utf8');
const out = join(root, 'apps/web/public/fonts');
mkdirSync(out, { recursive: true });
let n = 0;
for (const m of src.matchAll(/'([a-z0-9-]+)': '([a-z0-9-]+)\/(files\/[a-z0-9-]+\.woff)'/g)) {
  const pkgRoot = dirname(require.resolve(`@fontsource/${m[2]}/package.json`));
  copyFileSync(join(pkgRoot, m[3]), join(out, `${m[1]}.woff`));
  n++;
}
if (n === 0) throw new Error('copy-assets: no fonts found — did fonts.ts change shape?');
// MapLibre's web worker must be served as a same-origin file (bundlers don't emit it).
const webRequire = createRequire(join(root, 'apps/web/package.json'));
const vendor = join(root, 'apps/web/public/vendor');
mkdirSync(vendor, { recursive: true });
copyFileSync(join(dirname(webRequire.resolve('maplibre-gl/package.json')), 'dist/maplibre-gl-worker.mjs'), join(vendor, 'maplibre-gl-worker.mjs'));
console.log(`copy-assets: ${n} fonts → apps/web/public/fonts`);
