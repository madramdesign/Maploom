# Rendering

Code: `packages/render/src`. Research behind these choices: `docs/research/RENDERING_AND_AI.md`.

## Model

`renderMap(geography, design, fonts)` → SVG string. Pure: no DOM, clock or `Math.random`
(scatter uses a PRNG seeded from feature ids). Art units: the short edge is always 1000,
so styles are independent of physical size and of the area covered. A detail factor
`k = clamp((1500 m / shortEdge)^0.55)` thins strokes on maps that cover more ground.

Two layers, so the editor only redraws what changed:

- **Base** (`renderBaseLayer`) — land, areas, waterways, waves/trees, buildings, roads
  (path → rail → casings → fills → centre lines), street names set along the streets.
- **Overlay** (`renderOverlayLayer`) — landmark badges and labels (4 candidate positions,
  collision-checked), the home marker, free text, title block, border, compass, attribution.

Every editable element carries `data-id`/`data-kind`; the overlay also returns hit boxes.

## Styles

A `MapStyle` (`styles.ts`) is configuration only: palette, road widths per class, casing,
fonts, badge type, title layout, border, effects. Six ship: Playtime, Watercolor, Heirloom,
Studio, Night Lights, Atelier. A test asserts that switching style leaves road geometry
byte-identical — geography and presentation cannot leak into each other.

## Text and icons

- Text → outlines via opentype.js with our own glyph layout (advances + pair kerning).
  Street names place one `<use>` per glyph along the road, flipped to read left-to-right,
  rejected on sharp bends, de-duplicated by distance, and collision-checked.
- Fonts cover Latin only; a label with unsupported characters is skipped rather than
  rendered as boxes (limitation — see roadmap).
- 42 original icons (`icons.ts`) drawn with four paint roles so one drawing adapts to
  every style (colour or mono, sticker/disc/ring badges).

## Print export (`packages/server/src/export.ts`, `png.ts`)

`planExport` derives pixels from the product variant (size × DPI + bleed). The SVG is
rasterised by resvg in horizontal strips (≤ 48 MP each) that stream into a PNG encoder
(RGB, sRGB chunk, pHYs DPI). Measured on the fixture neighbourhood:
**14400 × 21600 px (4 × 6 ft at 300 DPI) in ~36 s, < 1 GB RSS, 19 MB file**
(`npx tsx scripts/bench-export.ts`).

Hard rules, each enforced by a test:
- no `<text>`, `<image>`, external references or `NaN`;
- no element-level `opacity` (use `fill-opacity`/`stroke-opacity`);
- attribution is always present;
- strip output matches single-pass output.

Vector SVG is the scalable deliverable. PDF and CMYK are roadmap items; deliver sRGB.

## Product mockups

`apps/web/components/studio/Mockup.tsx` — CSS/SVG scenes (wall poster, frame, canvas, floor
mat, flat) with the live artwork embedded, so previews update as the design changes.
