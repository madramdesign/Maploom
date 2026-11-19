/**
 * Generates the style-card and hero artwork used by the marketing pages from
 * the checked-in fixture tiles (public data, our own renderer — no third-party art).
 *   npx tsx scripts/build-style-previews.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STYLE_IDS } from '@maploom/core';
import { buildGeographyFromTiles, makeFrame } from '@maploom/geo';
import { createDesign, renderMap, suggestLandmarks } from '@maploom/render';
import { loadFontsNode } from '../packages/render/src/fonts-node';
import { CLIFTON, fixtureFetcher, fixtureInfo } from '../tests/fixture-tiles';

const out = join(import.meta.dirname, '../apps/web/public/styles');
mkdirSync(out, { recursive: true });
const fonts = loadFontsNode();
const now = () => new Date('2026-01-01T00:00:00Z');
const centre = { lat: CLIFTON.lat + 0.0012, lon: CLIFTON.lon - 0.0012 };

const card = await buildGeographyFromTiles(makeFrame(centre, 760, 4 / 5), fixtureFetcher, fixtureInfo, { now });
const hero = await buildGeographyFromTiles(makeFrame(centre, 1000, 3 / 4), fixtureFetcher, fixtureInfo, { now });

for (const styleId of STYLE_IDS) {
  const design = createDesign({ frame: card.frame, home: centre, styleId, title: 'Our Neighborhood' });
  design.title.position = 'bottom';
  design.layers.compass = false;
  design.landmarks = suggestLandmarks(card, design.preferences, 5, [], design.title);
  const { svg } = renderMap(card, design, fonts);
  writeFileSync(join(out, `${styleId}.svg`), svg);
  console.log(styleId, `${Math.round(svg.length / 1024)} KB`);
}
for (const styleId of ['playful', 'watercolor'] as const) {
  const design = createDesign({ frame: hero.frame, home: centre, styleId, title: "Emma's Neighborhood" });
  design.title.subtitle = 'Clifton, New Jersey';
  design.landmarks = suggestLandmarks(hero, design.preferences, 9, [], design.title);
  const { svg } = renderMap(hero, design, fonts);
  writeFileSync(join(out, `hero-${styleId}.svg`), svg);
  console.log('hero', styleId, `${Math.round(svg.length / 1024)} KB`);
}
