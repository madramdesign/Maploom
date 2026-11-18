/**
 * Renders the checked-in fixture neighbourhood in every style to .data/demo/*.svg
 * (no network needed).  npm run demo:render
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STYLE_IDS } from '@maploom/core';
import { createDesign, renderMap, suggestLandmarks } from '@maploom/render';
import { loadFontsNode } from '../packages/render/src/fonts-node';
import { buildClifton, CLIFTON } from '../tests/fixture-tiles';

const out = join(import.meta.dirname, '../.data/demo');
mkdirSync(out, { recursive: true });
const geo = await buildClifton();
const fonts = loadFontsNode();
for (const styleId of STYLE_IDS) {
  const design = createDesign({ frame: geo.frame, home: CLIFTON, styleId, title: "Emma's Neighborhood" });
  design.title.subtitle = 'Clifton, New Jersey';
  design.title.dedication = 'With love from Grandma & Grandpa';
  design.title.date = '2026';
  if (styleId === 'minimal' || styleId === 'poster' || styleId === 'blueprint') design.title.position = 'bottom';
  design.landmarks = suggestLandmarks(geo, design.preferences, design.landmarkTarget);
  const t = Date.now();
  const { svg } = renderMap(geo, design, fonts, { pixelWidth: 1200 });
  writeFileSync(join(out, `${styleId}.svg`), svg);
  console.log(styleId, `${(svg.length / 1024).toFixed(0)} KB`, `${Date.now() - t} ms`);
}
