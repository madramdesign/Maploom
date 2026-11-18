import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Frame } from '@maploom/core';
import { buildGeographyFromTiles, makeFrame, type TileFetcher, type TileSourceInfo } from '@maploom/geo';

const dir = join(import.meta.dirname, 'fixtures/tiles');
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { info: TileSourceInfo };

export const fixtureInfo: TileSourceInfo = manifest.info;
export const fixtureFetcher: TileFetcher = async (z, x, y) => {
  const file = join(dir, `${z}-${x}-${y}.pbf`);
  return existsSync(file) ? new Uint8Array(readFileSync(file)) : null;
};

/** Clifton, NJ — public town centre, 1.2 km short edge, 3:4 portrait. */
export const CLIFTON = { lat: 40.8651, lon: -74.1585 };
export const cliftonFrame: Frame = makeFrame(CLIFTON, 1200, 3 / 4);

export function buildClifton(frame: Frame = cliftonFrame) {
  return buildGeographyFromTiles(frame, fixtureFetcher, fixtureInfo, { now: () => new Date('2026-01-01T00:00:00Z') });
}
