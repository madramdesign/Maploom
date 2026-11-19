/**
 * Downloads the vector tiles covering the demo locations into tests/fixtures
 * so the test-suite runs offline and deterministically.
 *   NODE_USE_ENV_PROXY=1 npm run fixtures:refresh
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeFrame, openTileSource, pickZoom } from '@maploom/geo';
import { DEMO_LOCATIONS } from '../packages/geo/src/demo';

const out = join(import.meta.dirname, '../tests/fixtures/tiles');
mkdirSync(out, { recursive: true });
const source = await openTileSource({ fetch, userAgent: 'maploom-dev/0.1 (fixtures)' });
const manifest: Record<string, unknown> = { info: source.info, locations: {} };
for (const loc of DEMO_LOCATIONS.filter((l) => l.fixture)) {
  const frame = makeFrame(loc.lngLat, 1200, 3 / 4);
  const range = pickZoom(frame, 14, 64, 48);
  for (let y = range.minY; y <= range.maxY; y++)
    for (let x = range.minX; x <= range.maxX; x++) {
      const buf = await source.fetchTile(range.z, x, y);
      if (buf) writeFileSync(join(out, `${range.z}-${x}-${y}.pbf`), buf);
      console.log(loc.id, range.z, x, y, buf?.length);
    }
  (manifest.locations as Record<string, unknown>)[loc.id] = { frame, range };
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
