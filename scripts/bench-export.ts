/**
 * Times the print export for the largest product on the fixture neighbourhood.
 *   npx tsx scripts/bench-export.ts [dpi]
 */
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findVariant, printPixels } from '@maploom/core';
import { makeFrame, buildGeographyFromTiles } from '@maploom/geo';
import { createDesign, suggestLandmarks } from '@maploom/render';
import { exportPng } from '../packages/server/src/export';
import { CLIFTON, fixtureFetcher, fixtureInfo } from '../tests/fixture-tiles';

const dpi = Number(process.argv[2] ?? 300);
const { variant } = findVariant('play-mat', 'mat-4x6')!;
const geo = await buildGeographyFromTiles(makeFrame(CLIFTON, 1200, 2 / 3), fixtureFetcher, fixtureInfo);
const design = createDesign({ frame: geo.frame, home: CLIFTON, title: "Emma's Neighborhood" });
design.landmarks = suggestLandmarks(geo, design.preferences, 12, [], design.title);
const px = printPixels(variant, 'portrait', dpi);
const out = join(import.meta.dirname, '../.data/bench');
mkdirSync(out, { recursive: true });
const file = join(out, `mat-4x6-${dpi}dpi.png`);
const t0 = Date.now();
let peak = 0;
const timer = setInterval(() => (peak = Math.max(peak, process.memoryUsage().rss)), 100);
await exportPng(geo, design, { width: px.width, height: px.height, bleedArt: 0, dpi }, file);
clearInterval(timer);
console.log(`${px.width}×${px.height} px (${((px.width * px.height) / 1e6).toFixed(0)} MP) in ${((Date.now() - t0) / 1000).toFixed(1)} s, peak RSS ${(peak / 2 ** 30).toFixed(2)} GB, file ${(statSync(file).size / 2 ** 20).toFixed(1)} MB`);
