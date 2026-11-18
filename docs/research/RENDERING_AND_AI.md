# Rendering and AI research

Research date: 2026-11-18. Scope: stress-test the preliminary decision (own deterministic TypeScript renderer, geography model + style config -> one SVG string, resvg/sharp for print rasterisation, AI for presentation only).

How to read this document:

- **[measured]** = measured in this research session on a 4 vCPU / 15 GB Linux container, Node 22.23, `@resvg/resvg-js` 2.6.2, `sharp` 0.35.5 (libvips 8.18.7, librsvg 2.63.2). The test input was a synthetic map-like SVG (790 KB; 3,000 building rects, 400 cased roads = 800 stroked paths, 40 polygons, a wave `<pattern>`, 200 labels, one `textPath`). Real maps will differ; treat the numbers as order-of-magnitude.
- **[source]** = taken from the linked page.
- **[search]** = taken from a search-result summary of the linked page; the page itself could not be opened from this sandbox (`sharp.pixelplumbing.com`, `www.libvips.org`, `docs.bfl.ai`, `www.recraft.ai` were not reachable). Verify before relying on it, especially prices.
- **[memory]** = from general knowledge, not re-verified today.
- **[estimate]** = extrapolation.

---

## 0. Verdict on the preliminary decision

The architecture holds: one SVG string from a normalized model, the same code in browser and Node, resvg or libvips for print. Four parts of the preliminary plan do not survive contact with the measurements and need to change.

| # | Preliminary assumption | What the evidence says | Change |
|---|---|---|---|
| 1 | Watercolor/paper via `feTurbulence` / `feDisplacementMap` filters, also at print size | Full-canvas filters are unusable at 14400x21600. resvg: 42 s at 4800x7200 with filters vs 0.8 s without; at 14400 wide a filtered render took 392 s and peaked at 13.5 GB RSS even when only a 2048 px crop was requested. librsvg (sharp) is slower still: 11 s at 1440x2160, not finished after 284 s at 4800x7200. [measured] | Do not put full-canvas SVG filters in the print path. Get the hand-drawn look from seeded geometry jitter, and paper/grain from tileable raster textures (SVG `<pattern>` with an embedded image, or a sharp `composite` after rasterisation). Filters are fine for browser preview and for small filter regions. |
| 2 | "Render in tiles/strips and stitch" as the escape hatch for large outputs | resvg-js `crop` does not reduce work or memory (the 392 s / 13.5 GB run was a crop). Rendering strips by rewriting the `viewBox` crashes resvg on `feDisplacementMap` with `assertion failed: src.height == map.height` — in 2.6.2 this aborts the whole Node process; in 2.7.0-alpha.2 it is a catchable error but still fails, after allocating ~9 GB. [measured] | Tiling is only needed, and only works, for filter-free SVG. Without filters the whole 14400x21600 image renders in one pass in seconds, so tiling is an optimisation for small-memory hosts, not a requirement. |
| 3 | Fonts from `@fontsource/*` used directly on the server | Fontsource v5 packages ship only `.woff` and `.woff2`. resvg-js loads neither, and fails silently: the text is simply missing from the output. [measured] | Keep fontsource for the browser. For the server, vendor `.ttf`/`.otf` files (or convert WOFF -> TTF at build time), or convert all text to paths in our own renderer. Add a test that fails when a label renders zero ink. |
| 4 | 14400x21600 PNG handed to a print provider | Printful caps print files at 20,000 px per side and 200 MB (one of its help articles says 100 MB for PNG/JPEG). 21,600 px exceeds the cap. A grain texture also triples PNG size: 35 MB without, 106–111 MB with. [search][measured] | Confirm the chosen provider's limits before fixing the size. Options: 4'x6' at ~277 DPI (13,333x20,000) or at 150–200 DPI, which is normal for mats and rugs; deliver high-quality JPEG when texture is on; or use a provider that accepts PDF. |

Everything else in the preliminary decision is supported: SVG is the right interchange format, resvg and libvips both handle the size without filters, and a vector PDF is feasible (48x72 in is far below the 200 in PDF page limit).

---

## A. Rendering approaches

### A.1 Comparison

| Approach | Interactive preview | Print export (14400x21600) | Notes |
|---|---|---|---|
| **SVG (own generator)** | Good for a static neighbourhood map with a few thousand elements. DOM cost grows with element count; pan/zoom by CSS transform on the root. Browser filters are GPU/Skia-accelerated, so `feTurbulence` is affordable at screen size. | It is the source of truth: rasterise with resvg/libvips, convert to PDF, or offer as download. | Fits the decision. Browser and resvg/librsvg differ in text shaping details and filter output, so "same SVG" does not mean pixel-identical preview and print. |
| **Canvas 2D** | Fast for many elements; no DOM. No declarative filters except `ctx.filter` (not in Safari historically [memory]). | Browser canvas is capped: Chrome about 32,767 px per side and 268,435,456 px total area (16,384x16,384) [search]. 14400x21600 = 311 Mpx exceeds the area cap, so a single browser canvas cannot hold the print image. | Would need a second rendering backend, losing "one code path". Not recommended as primary. |
| **WebGL / MapLibre GL JS** | Best pan/zoom performance; style spec is built for conventional maps. | Limited by `MAX_TEXTURE_SIZE` / canvas limits (commonly 4,096–16,384) [search]; MapLibre GL JS also has a `maxCanvasSize` option defaulting to 4096x4096 [memory]. Large exports mean stitching many tile renders. | Style spec cannot express seeded jitter, hand-drawn strokes, stippling or illustrated sprites with our collision rules without custom layers. Poor fit for the illustrated look. |
| **MapLibre Native (Node, `@maplibre/maplibre-gl-native`)** | n/a | Server-side GL rendering of a style JSON; no documented maximum size found, in practice tile-and-stitch [search]. Needs a GL context (EGL/xvfb) on servers [memory]. | Same expressiveness limit as GL JS. Useful only if we wanted a conventional basemap. |
| **Mapnik** | n/a | Mature print cartography (casing, shields, label placement, Cairo PDF/SVG output). C++ dependency; `node-mapnik` binaries are poorly maintained for current Node versions [memory]. | Strong labelling engine, but a separate styling language (XML/CartoCSS) and no browser parity. Reject for MVP. |
| **Headless Chromium screenshot (Puppeteer/Playwright)** | n/a | Screenshots are limited by the compositor's maximum texture size, 16,384 px in headless/software mode; beyond that content repeats or clips, and the documented workaround is capture-and-stitch [search]. A 14400x21600 image needs at least two captures at a device scale factor, each allocating GPU/CPU surfaces. | Highest SVG/CSS fidelity (matches preview exactly, filters included) but heavy: ~300 MB+ per browser, slow cold start, hard to run in serverless. Keep as a fallback for filter-dependent styles only. |
| **Chromium print-to-PDF** | n/a | Vector PDF of the SVG. PDF pages are limited to 14,400 units = 200 in per side by ISO 32000 and Acrobat [search]; 48x72 in is fine. Filtered elements are rasterised inside the PDF at a resolution we do not control [memory, unverified]. | Good vector PDF for filter-free styles; text stays text with embedded subset fonts. |
| **resvg / `@resvg/resvg-js`** | A WASM build exists for in-browser use [memory]; not needed for preview. | Works in one pass without filters: 4.2–4.8 s render, ~10 s including PNG encode, 2.5 GB peak RSS [measured]. See A.2. | Recommended primary rasteriser for correctness and determinism (identical output across platforms [source]). |
| **sharp / libvips (librsvg)** | n/a | Works without filters and streams: 11.9 s to PNG at 309 MB peak RSS [measured]. See A.3. | Recommended for low-memory hosts, and for all post-processing (ICC, DPI metadata, JPEG/TIFF, stitching). |
| **Satori** | n/a | Not a map renderer. It converts JSX + a CSS subset (flex/grid) to SVG; fonts must be supplied (TTF/OTF/WOFF/WOFF2); variable fonts render the default instance only; output may not match browsers [source]. | Only relevant for composing the title block/legend, and our own SVG generator can do that directly. Skip. |
| **node-canvas / skia-canvas / @napi-rs/canvas** | n/a | Canvas 2D API in Node (Cairo or Skia). No browser area cap, memory is w*h*4. skia-canvas can also write PDF and SVG [memory]. | Requires a second drawing backend (Canvas commands instead of SVG). A possible later optimisation, not for MVP. |

### A.2 resvg / resvg-js in detail

Versions: `@resvg/resvg-js` latest is **2.6.2**, with `2.7.0-alpha.2` on the `next` tag (npm registry, checked today). The underlying Rust crate `resvg` is at **0.50.0, released 2026-11-11** [source: [changelog](https://github.com/linebender/resvg/blob/main/CHANGELOG.md)]. The stable npm binding lags the crate considerably, so several 2025–2026 filter fixes (filter-region clipping panics, `feDisplacementMap` applying `scale` twice and reading the map premultiplied) are **not** in what `npm i @resvg/resvg-js` installs.

Feature support:

- Static SVG 1.1 subset; no scripts or animation [source: [README](https://github.com/linebender/resvg)]. The [unsupported list](https://github.com/linebender/resvg/blob/main/docs/unsupported.md) contains only SVG fonts, `color-profile`, external `use`, and a few text attributes (`kerning`, `font-stretch`, `direction`, `unicode-bidi`).
- Filters: `feTurbulence`, `feDisplacementMap`, `feConvolveMatrix`, `feMorphology` and the lighting primitives were added in 0.9.0 (2020) [source: changelog]; `feGaussianBlur`, `feColorMatrix`, `feComposite`, `feFlood` rendered correctly in our tests [measured].
- `<pattern>` fills, stroke casing, `textPath`, clip paths and masks work [measured for pattern/textPath; memory for the rest].
- Text: own shaping stack (no system text libraries). Fonts come from `font.fontFiles`, `font.fontDirs`, and optionally system fonts (`loadSystemFonts`, default true) [source: [index.d.ts](https://github.com/thx/resvg-js/blob/main/index.d.ts)]. Only TTF/OTF/TTC load; WOFF and WOFF2 are ignored silently [measured]. With no usable font, text is dropped without an error [measured]. If the requested family is missing but another font is loaded, it falls back to the loaded font [measured].

Performance and memory [measured unless marked]:

| Case | Size | Time | Peak RSS |
|---|---|---|---|
| No filters, render only | 4800x7200 | 0.83 s | ~200 MB |
| No filters, render only | 14400x21600 | 4.2–4.8 s | pixmap alone is 1.24 GB (w*h*4) |
| No filters, render + PNG encode (35 MB file) | 14400x21600 | 10.2 s | 2.5 GB |
| With `feTurbulence`+`feDisplacementMap` on the map group and a full-canvas paper filter | 1440x2160 | 5.8 s | 112 MB |
| Same | 4800x7200 | 42 s | 356 MB after render |
| Same, with `crop` to 14400x2048 | 14400 wide | 392 s | 13.5 GB |

Per-primitive cost on a full-canvas filter region at 2880x4320 (12.4 Mpx): `feTurbulence` 3 octaves 4.5 s, 1 octave 3.0 s, `feGaussianBlur` (sigma 2 user units) 3.1 s, `feDisplacementMap` 0.9 s, `feColorMatrix` 0.7 s [measured]. Cost scales linearly with pixels and filters run single-threaded, so one 3-octave turbulence over 311 Mpx is roughly 110 s [estimate], and each intermediate result is another 1.24 GB buffer.

Limits and gotchas:

- Memory is at least `width * height * 4` bytes for the pixmap; `asPng()` adds the encoded buffer and working memory (2x in practice). resvg-js returns the whole PNG as one Buffer — no streaming.
- tiny-skia stores dimensions as 32-bit integers and caps the byte length of a pixmap at about `i32::MAX` (2.1 GB), which would put the ceiling near 536 Mpx [memory, unverified]. 311 Mpx is under it; a 6'x9' mat at 300 DPI (21600x32400 = 700 Mpx) would not be.
- `crop` is applied after the full render and saves nothing [measured].
- Strip rendering by rewriting `viewBox` works for filter-free SVG: four strips at 2x summed to 1.25 s, with 0.02% of bytes differing from the single-pass render (max channel delta 39, scattered anti-aliasing differences, not confined to seams) [measured]. So strips are visually seamless but not bit-identical.
- A Rust panic in resvg-js 2.6.2 aborts the Node process, taking down every in-flight request [measured]. Run rasterisation in a child process or worker pool with a memory limit, never in the web server process.
- Rendering blocks the calling thread; use `worker_threads` or a job queue.

### A.3 sharp / libvips (librsvg) in detail

- sharp rejects inputs above `limitInputPixels`, default 268,402,689 (0x3FFF x 0x3FFF) [search: [sharp constructor docs](https://sharp.pixelplumbing.com/api-constructor)]. 14400x21600 fails with `Input image exceeds pixel limit` until `limitInputPixels: false` is set [measured]. The separate `unlimited: true` flag lifts libvips' safety limits, including the 10 MB SVG file-size cap [search: [libvips svgload](https://www.libvips.org/API/8.17/ctor.Image.svgload.html)]; it was not needed for the pixel limit [measured]. A real city SVG with thousands of buildings can exceed 10 MB, so set it when the input is our own trusted SVG.
- Output size is set by `density` (72 = 1 CSS px per user unit); for a 1440-unit-wide SVG, `density: 720` gives 14,400 px.
- libvips defines `RSVG_MAX_WIDTH 32767`: librsvg/cairo cannot render beyond 32,767 px per side [search: [svgload.c](https://sources.debian.org/src/vips/8.18.0-3/libvips/foreign/svgload.c), [sharp issue](https://github.com/lovell/sharp/issues/3167)]. 21,600 is within it. Newer libvips renders SVG on demand in 2,000 px tiles [search: svgload.c], which is why memory stays low.
- librsvg also limits a document to 1,000,000 XML elements and 500,000 references [search: [librsvg ImplementationLimit](https://docs.rs/librsvg/latest/rsvg/enum.ImplementationLimit.html)].
- Measured: filter-free 14400x21600 -> PNG in 11.9 s at 309 MB peak RSS. With filters: 11.3 s at 1440x2160 and still running after 284 s at 4800x7200 (stopped). Because libvips renders in tiles, a full-canvas filter is likely recomputed per tile [estimate], which matches the "overcomputation" comment in svgload.c.
- Adding a sharp `composite` (tiled grain texture, `multiply`) broke the streaming benefit: 21 s and 3.9 GB peak RSS for the full image [measured].
- Fonts go through fontconfig/Pango, i.e. installed system fonts, not explicit file paths. That makes the result depend on the container image; resvg's explicit `fontFiles` is more reproducible. If text is converted to paths, the difference disappears.
- Text rendering, pattern rendering and anti-aliasing differ slightly between librsvg and resvg; pick one rasteriser per product and golden-test against it.

### A.4 PDF generation

- **pdfkit + svg-to-pdfkit**: supports paths, text, `textPath`, clip paths, masks, patterns, gradients, images and fonts; **filters are unsupported**; the original repository is no longer updated and points to a fork (SVG-for-PDFKit) [source: [README](https://github.com/alafr/SVG-to-PDFKit)]. Fonts must be registered up front by exact name or through `fontCallback`. Workable for filter-free styles; text remains selectable.
- **pdf-lib**: low-level; it can draw SVG path data and embed fonts/images but has no SVG document importer [memory]. Useful for wrapping a raster in a PDF page with exact physical size, or for assembling pages. The original package has had no release for years; maintained forks exist [memory, unverified].
- **Chromium print-to-PDF**: highest fidelity for filter-free SVG, embeds subset fonts; see A.1 for the caveat about rasterised filters.
- **Raster-in-PDF**: place the 300 DPI JPEG/PNG on a 3456x5184 pt page. Largest file, but identical to the PNG and accepted by any printer.
- PDF page limit: 14,400 pt (200 in) per side [search]; a 4'x6' page is 3456x5184 pt.

Recommendation: offer the raw SVG with text converted to paths as the vector download, and generate a PDF from the same filter-free SVG via svg-to-pdfkit (or its fork). Add raster-in-PDF for styles that depend on textures.

### A.5 Tiling and stitching with libvips

When to tile: the host has less than ~3 GB for the job, or the output exceeds a single-pixmap ceiling (above ~500 Mpx).

- Preferred low-memory path: let libvips do it. `sharp(svg, { density, limitInputPixels: false, unlimited: true }).png().toFile()` renders on demand in tiles and wrote the full image at 309 MB peak [measured]. No manual stitching.
- Manual path with resvg: emit N horizontal strips by changing only the root `viewBox`/`height` (geometry is in absolute user units, so nothing else changes), render each to raw RGBA, and append to a streaming encoder. With sharp, use `sharp({ create })` + `composite` only for small counts (composite buffers the image); for true streaming use libvips `arrayjoin`/`join` or write strips into a TIFF/PNG row by row [memory].
- Rules that keep seams invisible: no filters; patterns anchored in user space (`patternUnits="userSpaceOnUse"`); every random decision derived from feature id + seed, never from draw order within a tile; strip height an integer number of device pixels.
- `sharp.cache(false)` and `sharp.concurrency(1..2)` cap memory in a worker [memory].

### A.6 Print provider limits

| Provider | Stated limits | Source |
|---|---|---|
| Printful | 200 MB and 20,000x20,000 px per file in the file library; another help article says 100 MB for JPEG/PNG and 20 MB for SVG | [search: [help article](https://help.printful.com/hc/en-us/articles/360014066319-What-is-the-maximum-file-size-of-a-print-file)] |
| Printify | 100 MB JPG/PNG, 20 MB SVG, 30,000x30,000 px | [search, third-party report] |
| Prodigi | 300 MB per file; no pixel maximum found | [search: [Prodigi help](https://help.prodigi.com/support/solutions/articles/35000225400-are-there-any-restrictions-on-file-size-or-how-many-images-i-can-store-)] |
| Gelato | no maximum found; 300 DPI asked for paper products, 150 DPI minimum for garments | [search, third-party] |

Play mats and rugs are large-format textile or vinyl prints viewed from a distance; 100–150 DPI is the usual requirement for that class of product [memory]. Treat "300 DPI at 4'x6'" as an upper tier rather than the default, and make DPI a per-product setting.

### A.7 Colour management

- Render and deliver in **sRGB with an embedded sRGB ICC profile**. Print-on-demand providers generally ask for sRGB and do their own conversion to the press profile [memory]. Converting to CMYK ourselves without knowing the press profile usually makes colour worse.
- sharp: `.withIccProfile('srgb')` embeds the profile and `.withMetadata({ density: 300 })` sets the pHYs resolution; read-back confirmed `density 300`, ICC present, space `srgb` [measured]. Without the density tag, some prepress tools read the file as 72 DPI and report it as 200x300 inches.
- If a provider demands CMYK: `sharp(...).toColourspace('cmyk').withIccProfile('/path/to/profile.icc')` to JPEG or TIFF (PNG cannot hold CMYK) [memory]. The style palettes should be checked against the gamut: saturated play-mat greens, oranges and cyans are the colours that shift most.
- resvg ignores `color-profile` [source: unsupported list]; all colours in the SVG are treated as sRGB.
- Avoid alpha in the final file (`flatten`) and keep text and thin lines out of the bleed/safe margin the provider specifies.

### A.8 Recommended pipeline for 14400x21600

1. **Model -> SVG** with the shared TypeScript renderer, parameterised by `target: 'preview' | 'print'`. In print mode the style may not emit full-canvas filters; the style config declares a filter-free equivalent for each effect:
   - wobbly outlines: seeded vertex jitter and stroke-width variation in geometry;
   - watercolor edges: 2–3 offset semi-transparent copies of a fill with jittered outlines;
   - paper/grain: a tileable raster texture, applied after rasterisation.
2. **Text**: convert to paths in the renderer with opentype.js (deterministic, removes all font-loading risk), or pass TTF files through `font.fontFiles` with `loadSystemFonts: false`.
3. **Rasterise** in a worker process:
   - default: resvg-js single pass -> raw RGBA (about 5 s, 1.3 GB);
   - low-memory hosts: sharp/libvips directly from the SVG (about 12 s, about 0.3 GB).
4. **Post-process with sharp**: optional texture composite (`tile: true`, `blend: 'multiply'`), `flatten`, embed sRGB ICC, set density, encode PNG (level 6) or JPEG q92 4:4:4.
5. **Vector outputs**: the same filter-free SVG (text as paths) and a PDF via svg-to-pdfkit.
6. **Cache** by hash of (model, style, seed, size).

Ballparks for the full job, extrapolated from the synthetic test — a dense real map could be 2–5x slower [estimate]:

| Variant | Wall time | Peak RSS | Output |
|---|---|---|---|
| resvg -> PNG, no texture | ~10 s [measured] | ~2.5 GB [measured] | 35 MB PNG |
| resvg -> sharp texture composite -> PNG with ICC + density | ~19 s [measured] | ~2.5 GB [measured] | 106 MB PNG |
| sharp only, no texture | ~12 s [measured] | ~0.3 GB [measured] | 39 MB PNG |
| sharp only + texture composite | ~21 s per encode [measured] | ~3.9 GB [measured] | 111 MB PNG / 63 MB JPEG q92 |
| Full-canvas SVG filters in resvg | 6+ minutes [measured at crop] | 13+ GB [measured] | not viable |

Sizing: give the export worker 4 GB RAM and a 60–120 s timeout, run it as a queued job (not inside a request handler on a serverless function with 1 GB), and allow one job per worker.

---

## B. Cartographic technique notes

### B.1 Draw order and road casing

- Fixed layer stack, bottom to top: paper/background, land, landuse (parks, sand, forest), water areas, waterways, building shadows, buildings, road casings, road fills, bridges (casing then fill per bridge layer), rail, tree and decoration sprites, landmark sprites, labels, frame/title block.
- Draw **all casings before all fills** within a level, so junctions merge cleanly; a casing is the same path stroked wider in the outline colour. Order by class within each pass: service < residential < tertiary < secondary < primary < trunk/motorway.
- Honour OSM `layer`, `bridge`, `tunnel`: tunnels dashed or omitted; bridges get their own casing+fill pass above everything at lower levels.
- Use `stroke-linecap="round"` and `stroke-linejoin="round"` to hide gaps where OSM ways are split. Merge ways with the same name and class end-to-end before styling; it gives longer label paths and fewer cap artefacts.

### B.2 Simplification and smoothing

- Work in local metric coordinates (already planned), so tolerances are in metres.
- **Douglas-Peucker** (or Visvalingam-Whyatt, which removes small wiggles more gracefully) with a tolerance tied to output scale: about 0.3–0.5 printed mm converted to metres. On a 4'x6' mat covering 600 m that is under 0.2 m, so little simplification is needed for print; preview can use a coarser tolerance.
- **Chaikin corner cutting** (2 iterations) gives the soft illustrated look for roads, rivers and park outlines. Pin endpoints and junction nodes so connected roads do not separate, and do not smooth buildings.
- Simplify before smoothing. Use topology-aware simplification for shared boundaries (park vs. water) or draw them in an order that hides slivers.
- Buildings: remove vertices under a minimum edge length, square near-90-degree corners, merge buildings that touch within a block, and drop or collapse to a symbol those under a minimum printed area.

### B.3 Clipping to the frame

- Clip in geometry, not only with `clipPath`: it reduces SVG size and makes label placement honest about what is visible. Sutherland-Hodgman is enough for a rectangular frame with simple polygons; use a robust library (for example `polygon-clipping` or `clipper2` ports) for multipolygons with holes.
- Clip lines with Cohen-Sutherland or Liang-Barsky and keep a margin of half the widest stroke outside the frame so stroke edges are not cut visibly.
- Keep an SVG `clipPath` on the map group as a backstop for strokes and sprites.

### B.4 Labels

- Priority order: title/dedication block (reserved area), the home marker, landmark names, water and park names, major street names, minor street names, minor POIs. Place greedily in that order; lower priorities are dropped when they do not fit.
- **Point labels**: try 8 candidate positions around the symbol (preference NE, SE, NW, SW, E, W, N, S), test against an R-tree of already-placed boxes (`rbush`), keep the first that fits.
- **Street labels along paths**: use the merged, smoothed centreline; require path length >= text length x 1.3; reject segments whose curvature would exceed a limit per glyph; flip the path when the text would read upside down; repeat on long streets at a fixed interval; collision-test with a chain of small boxes or circles along the path rather than one bounding box.
- **Area labels**: pole of inaccessibility (`polylabel`), not the centroid.
- Measure text with real font metrics (opentype.js `getAdvanceWidth`) so browser and server agree, and so `textPath` layout does not depend on each renderer's shaping. Emitting glyph outlines positioned by our own code removes the largest source of preview/print mismatch.
- Add a halo (stroke in the background colour, `paint-order="stroke"`) for legibility over roads; check that the chosen rasteriser supports `paint-order` or emit two text copies.
- Names come only from OSM `name` / `name:<lang>` tags, verbatim.

### B.5 Icons and landmark sprites

- Each sprite has an anchor (usually bottom centre for a building illustration), a footprint box used for collision, and a priority.
- Place landmarks before labels; allow a bounded displacement (for example up to 1.5x sprite width) with a leader or simply accept the offset in an illustrated map; never move a sprite across a major road.
- Scale by importance tier (3 sizes), not by real footprint.
- Sprites may overlap roads but not other sprites or high-priority labels. Reserve the label box for a landmark's name together with its sprite.
- Sort sprites by y so nearer ones overlap farther ones, which gives a simple pseudo-3D feel.

### B.6 Making OSM data look illustrated

- Exaggerate road widths by class well beyond true scale, and let buildings be pushed back or clipped by the widened roads (subtract road buffers from building polygons, or simply draw roads on top).
- Reduce classes: five or six road tiers, three or four land colours.
- Parks: tree stippling by Poisson-disc sampling inside the polygon (seeded), two or three tree sprite variants, density tied to the style.
- Water: wave pattern as a `userSpaceOnUse` `<pattern>`, plus an inner shoreline stroke or two offset lines.
- Buildings: flat roofs with a small offset shadow, or archetype sprites for notable ones; roof colour chosen from a palette by hash of the feature id.
- Hand-drawn strokes: resample the path, displace vertices along normals with low-frequency seeded noise, and optionally draw two passes with different seeds.
- Decorative extras that carry no geographic claim: compass rose, border, cars on roads, clouds. Keep them visually distinct from data.

### B.7 Deterministic seeded randomness

- Use a small explicit PRNG (mulberry32, sfc32 or xoshiro128**); never `Math.random()`.
- Derive a separate stream per feature: `seed = hash(globalSeed, styleId, osmType, osmId, purpose)`. Adding or removing one feature then leaves every other feature unchanged, and results do not depend on iteration order or tiling.
- Sort features by a stable key before every pass; round emitted coordinates to fixed precision (2 decimals) so browser and Node produce the same string.
- Avoid functions whose results differ across engines for the same input in geometry code where it matters (`Math.sin`/`cos`/`pow` are not guaranteed bit-identical across JS engines); the rounding step absorbs most of this.
- Store `globalSeed` with the order so a reprint is identical; snapshot-test the SVG string hash per style.

---

## C. AI architecture

### C.1 Where AI helps and where it must not be used

| Use | Input | Output contract | Guard |
|---|---|---|---|
| Landmark prioritisation | List of candidate OSM features with id, tags, distance from the address, area | Ranked list of **ids from the input** with a category and one-line reason | Validate that every id exists in the input; fall back to a deterministic heuristic (tag weights + distance + `wikidata` presence) |
| Title, subtitle, dedication suggestions | Place names from OSM, user's occasion | 3–5 short strings | User picks and edits; length limits; profanity filter |
| Building archetype classification | OSM tags (`building`, `amenity`, `shop`, `religion`, `building:levels`, `name`) | One value from a fixed enum (school, church, fire station, cafe, house, ...) | Rule table first; LLM only for the ambiguous rest; enum-constrained structured output |
| Label de-cluttering advice | Labels that lost the collision pass, with priorities | Which to keep, or an abbreviation chosen from a fixed table (Street -> St) | The model may drop or abbreviate, never rename or move |

Must not come from a model: geometry, coordinates, which features exist, feature names, distances, north orientation. The renderer only accepts model output that references existing feature ids or fixed enums, so a hallucination can change emphasis but cannot add or move geography. Cache every LLM result keyed by (feature set hash, prompt version) so repeat renders are deterministic and free. All four uses are small structured-output calls; a small, cheap model tier is sufficient.

### C.2 Image generation models (November 2026)

Prices are per image at roughly 1 megapixel unless noted and come from search summaries; providers changed prices several times in 2026, so confirm on the official pages before budgeting.

| Provider / model | Price | Output | Commercial terms (verify) | Fit |
|---|---|---|---|---|
| **Recraft V4 / V4.1 Vector** | $0.08 (80 API units); Pro Vector $0.30; vectorize $0.01; background removal $0.01; style creation $0.04 [search: [Recraft pricing](https://www.recraft.ai/docs/api-reference/pricing)] | Native SVG | Free-plan images are owned by Recraft and are not licensed commercially; paid-plan and paid-API output is described as owned by the user [search: [ownership FAQ](https://recraft.ai/blog/ownership-and-commercial-use-faq)]. One secondary source says products that generate for end users should contact sales | Best fit: vector output, custom styles from reference images, built-in vectorize and background removal |
| **OpenAI gpt-image-1.5** | $0.009 low / $0.034 medium / $0.133 high at 1024x1024; gpt-image-1-mini $0.005 / $0.011 / $0.036 [search: [model page](https://developers.openai.com/api/docs/models/gpt-image-1.5)] | Raster, transparent background supported [memory] | API terms assign output to the customer [memory] | Good prompt adherence and reference-image editing; needs vectorisation |
| **Google Gemini 2.5 Flash Image** | ~$0.039; batch about half [search] | Raster | Paid API output usable commercially; SynthID watermark [memory] | Cheap, strong at reference-guided edits. Reported to retire 2027-03-15 [search] |
| **Google Gemini 3 Pro Image** | $0.134 at 1K–2K, $0.24 at 4K [search] | Raster | as above | Higher quality; also Gemini 3.1 Flash Image at ~$0.067 for 1K [search] |
| **Google Imagen 4** | was $0.02–$0.06 | Raster | — | Reported discontinued on the Gemini API (2026-08-17) and Vertex AI (2026-06-30) [search, unverified]. Do not build on it |
| **Black Forest Labs FLUX.2** | pro ~$0.03 for the first megapixel; max from $0.07; flex $0.05–0.06; klein 4B $0.014 [search: [BFL pricing](https://docs.bfl.ai/quick_start/pricing)] — sources disagree | Raster | API output usable commercially [memory]. Open weights: klein 4B is Apache 2.0; klein 9B and dev are non-commercial without a paid licence [search] | Best option for self-hosting with LoRA and ControlNet-style conditioning |
| **Stability AI** | 1 credit = $0.01; SD 3.5 Large 6.5 credits ($0.065) [search] | Raster | Community License: free commercial use under $1M annual revenue, enterprise licence above [search: [stability.ai/license](https://stability.ai/license)] | Self-hostable; mature ControlNet/LoRA ecosystem on older SD models |
| **Ideogram 3.0 / 4.0** | 3.0: $0.03 turbo / $0.06 default / $0.09 quality; 4.0: $0.03 / $0.06 / $0.10 [search] | Raster | Paid API output usable commercially [memory, unverified] | Strongest at text in images, which we do not want inside sprites |

### C.3 Map-to-illustration (ControlNet / img2img over rendered line art)

Rendering the map as line art and asking a diffusion model to "paint" it is the obvious shortcut, and it conflicts with the product's core promise:

- Diffusion models do not preserve geometry exactly. Roads bend, small streets vanish, buildings are invented, and any text in the image is redrawn as plausible nonsense.
- Resolution: models produce 1–4 megapixels. A 311 Mpx print would need tiled diffusion plus upscaling, which creates seams and repeats hallucinated detail.
- Not deterministic across provider model updates, so reprints differ.
- Cost and latency per map are high compared with a deterministic render that takes seconds.

Conclusion: do not use whole-map img2img for the product output. It is acceptable for marketing mock-ups and for exploring style directions that are then implemented in the style config. Conditioned generation is reasonable per landmark: a rendered silhouette or footprint as the control image to keep a sprite's proportions.

### C.4 Style consistency techniques for generated sprites

- Fixed style reference images per map style (Recraft custom style id, or reference-image inputs on gpt-image / Gemini / FLUX.2).
- A LoRA trained on 20–50 hand-made sprites per style, for a self-hosted FLUX or SD pipeline, in later phases.
- A fixed prompt template per style and archetype; fixed seed where the API allows it.
- Palette quantisation to the style's palette (nearest colour in OKLab; `sharp` palette output or a small custom mapper), so sprites take the exact map colours.
- Background removal, then a check that the alpha mask has a single connected component of reasonable area.
- Outline normalisation: after vectorisation, re-stroke all paths with the style's outline colour and width rather than trusting the generated outline.
- Vectorisation: `vtracer` (colour, Rust/WASM, permissive licence) is the better default; `potrace` is black-and-white only and GPL-licensed, which matters if it is linked rather than invoked as a separate tool [memory].
- Cache by `(osm_type, osm_id | archetype, style_id, prompt_version)`; generated assets are immutable once approved.

### C.5 Asset normalisation pipeline (design)

1. **Request**: archetype or specific landmark + style id -> prompt from template + style reference.
2. **Generate** 2–4 candidates (vector model preferred).
3. **Raster branch only**: background removal -> trim -> palette quantise -> vectorise with vtracer.
4. **Sanitise SVG**: strip scripts, external references, embedded rasters, `<text>`; flatten transforms; cap path and node counts; run SVGO.
5. **Normalise**: fit to a standard viewBox (for example 256x256), set the anchor at bottom centre, remap fills to palette tokens (`var(--roof)` or symbol classes) so one sprite can be recoloured per style, normalise stroke width.
6. **Automatic QA**: detect text (OCR or leftover `<text>`), check colour count, aspect ratio, empty or over-complex output, and similarity to the style reference via an embedding distance.
7. **Human review queue** for anything shown to customers in early phases.
8. **Store** in object storage with metadata (model, version, prompt, seed, licence terms at generation time, reviewer).
9. **Serve** as `<symbol>` entries inlined into the map SVG, so the print pipeline stays vector and deterministic.

### C.6 Failure modes

- **Hallucinated geography**: a sprite shows a church with a spire when the real one has none, or a "school" that looks nothing like the customer's school. Mitigation: label sprites as illustrative archetypes; specific-landmark generation only with photo or Wikidata reference and human review.
- **Inconsistent style** between sprites generated on different days or model versions. Mitigation: pinned model versions, references, palette and outline normalisation, review.
- **Text artefacts**: signage and pseudo-letters inside sprites. Mitigation: prompt against text, OCR check, reject.
- **Cost and latency**: 10 landmarks x 3 candidates x $0.08 = $2.40 and 30–150 s per map if generated per order [estimate]. Mitigation: generate archetypes once and reuse; per-order generation only as a paid extra.
- **Licence and IP**: provider terms change; trademarked buildings and logos; model output resembling existing artwork. Record terms at generation time.
- **Supply risk**: models are retired on short notice (Imagen 4 in 2026). The pipeline stores finished assets, so a retired model only affects new generation.
- **Untrusted SVG**: generated or vectorised SVG must be sanitised before it enters our renderer or a browser.

### C.7 Recommendation by phase

- **MVP**: no image generation. A hand-drawn, parametric SVG icon set of about 30–40 archetypes (house, school, church, mosque, fire station, hospital, cafe, shop, playground, library, station, trees, cars), drawn once with palette tokens so each of the six styles recolours and re-strokes them. LLM use limited to landmark ranking and title suggestions, with deterministic fallbacks, so the product works with AI switched off.
- **Phase 2**: offline AI-assisted asset production. Use a vector model (Recraft V4.1 Vector is the first candidate) to draft additional archetypes and per-style variants, pass them through the normalisation pipeline with human review, and ship them as static assets. No generation at order time.
- **Phase 3**: optional per-order custom landmark illustrations ("our house", "our school") as a paid add-on, with reference photos, the full normalisation pipeline, a customer approval step before print, and caching per OSM feature and style. Consider a self-hosted FLUX/SD model with a per-style LoRA if volume justifies it.
- Never: whole-map generative rendering for the printed product.

---

## D. Fonts

All packages below exist on npm at version 5.3.0 with licence `OFL-1.1` (checked against the registry today).

| Style | Display / title | Labels | Packages |
|---|---|---|---|
| Playful (play mat) | Fredoka | Baloo 2 | `@fontsource/fredoka`, `@fontsource/baloo-2` |
| Minimalist | Inter | Inter (or DM Sans) | `@fontsource/inter`, `@fontsource/dm-sans` |
| Watercolor | Caveat | Patrick Hand | `@fontsource/caveat`, `@fontsource/patrick-hand` |
| Vintage | IM Fell English | Cormorant Garamond (or Playfair Display for titles) | `@fontsource/im-fell-english`, `@fontsource/cormorant-garamond`, `@fontsource/playfair-display` |
| Bold poster | Bebas Neue (or Anton) | Archivo Black for emphasis, Inter for small labels | `@fontsource/bebas-neue`, `@fontsource/anton`, `@fontsource/archivo-black` |
| Architectural | Architects Daughter | IBM Plex Mono (or Josefin Sans) | `@fontsource/architects-daughter`, `@fontsource/ibm-plex-mono`, `@fontsource/josefin-sans` |

A workable minimum of eight: Fredoka, Baloo 2, Inter, Caveat, Patrick Hand, IM Fell English, Bebas Neue, Architects Daughter.

Notes on the choices:

- Bebas Neue and Anton are caps-only or caps-oriented display faces; use them for titles, not for dense street labels.
- Check glyph coverage per font against the markets served. Street names need at least Latin Extended (ä, ø, ł, ș); several handwriting fonts have limited coverage, and none of these cover Cyrillic, Greek or CJK fully. Define a fallback (Noto Sans) per script.
- Fontsource splits each font into per-subset files (`latin`, `latin-ext`, ...). The browser picks subsets through `unicode-range`; a server renderer does not, so the server needs complete fonts.
- `@fontsource/special-elite` (a typewriter face that would suit vintage) is Apache-2.0, not OFL — usable, but outside the "OFL only" rule.
- OFL permits embedding in images and PDFs and commercial use; it forbids selling the fonts on their own and requires the licence text to accompany redistributed font files.

### Embedding fonts for server-side rasterisation

Findings [measured]:

- `@fontsource/*` packages contain only `.woff` and `.woff2` files.
- resvg-js with `fontFiles` pointing at either format renders **no text and reports no error**.
- resvg-js with a `.otf`/`.ttf` in `fontFiles` and `loadSystemFonts: false` renders correctly, and uses the loaded font as fallback for unknown families.
- opentype.js 2.0.0 parses `.woff` directly; `.woff2` requires an external Brotli-based decompressor.

Options, in order of preference:

1. **Convert text to paths in our renderer** with opentype.js: load the font once, lay out glyphs ourselves (advance widths, kerning, placement along a path), emit `<path>` elements. Benefits: identical output in the browser, resvg, librsvg, PDF converters and the downloadable SVG; no font files needed at rasterisation time; exact collision boxes. Costs: larger SVG, no selectable text in PDF, and complex shaping (Arabic, Indic scripts) needs a real shaper such as harfbuzzjs.
2. **Supply TTF/OTF to resvg**: vendor the original TTFs (from the font's upstream repository or the google/fonts repository) into the repo, or convert WOFF -> TTF at build time, and pass them with `font: { loadSystemFonts: false, fontFiles: [...], defaultFontFamily }`. `loadSystemFonts: false` also makes startup faster [source: index.d.ts] and output reproducible. The SVG `font-family` must match the font's internal family name.
3. **sharp/librsvg**: install the fonts into the container and configure fontconfig (`FONTCONFIG_PATH`); results depend on the image, so pin it.
4. Do not rely on `@font-face` with data URIs inside the SVG for server rendering; support differs between rasterisers [memory, unverified].

Whichever option is chosen, add an automated check that renders one label per style font and asserts non-zero ink, because the failure mode is silent.

---

## Sources

Rendering:

- resvg README, unsupported features, changelog: https://github.com/linebender/resvg , https://github.com/linebender/resvg/blob/main/docs/unsupported.md , https://github.com/linebender/resvg/blob/main/CHANGELOG.md
- resvg-js options: https://github.com/thx/resvg-js/blob/main/index.d.ts
- sharp constructor options (limitInputPixels, unlimited, density): https://sharp.pixelplumbing.com/api-constructor
- libvips svgload and source: https://www.libvips.org/API/8.17/ctor.Image.svgload.html , https://sources.debian.org/src/vips/8.18.0-3/libvips/foreign/svgload.c
- librsvg implementation limits: https://docs.rs/librsvg/latest/rsvg/enum.ImplementationLimit.html
- sharp issue on the 32,767 px librsvg limit: https://github.com/lovell/sharp/issues/3167
- Chromium canvas limits: https://github.com/jhildenbiddle/canvas-size , https://stackoverflow.com/questions/6081483/maximum-size-of-a-canvas-element
- Headless Chromium 16,384 px screenshot limit: https://groups.google.com/a/chromium.org/g/headless-dev/c/DqaAEXyzvR0
- PDF 200 inch page limit: https://github.com/go-rod/rod/issues/1027
- MapLibre Native Node package: https://npmjs.com/package/@maplibre/maplibre-gl-native ; large-export discussion: https://github.com/mapbox/mapbox-gl-js/issues/10045
- Satori: https://github.com/vercel/satori
- SVG-to-PDFKit: https://github.com/alafr/SVG-to-PDFKit
- Printful file limits: https://help.printful.com/hc/en-us/articles/360014066319-What-is-the-maximum-file-size-of-a-print-file
- Prodigi file limits: https://help.prodigi.com/support/solutions/articles/35000225400-are-there-any-restrictions-on-file-size-or-how-many-images-i-can-store-

AI models and terms:

- Recraft pricing and ownership: https://www.recraft.ai/docs/api-reference/pricing , https://recraft.ai/blog/ownership-and-commercial-use-faq , https://openrouter.ai/recraft/recraft-v4-vector
- OpenAI gpt-image-1.5: https://developers.openai.com/api/docs/models/gpt-image-1.5 , https://community.openai.com/t/gpt-image-1-5-rolling-out-in-the-api-and-chatgpt/1369443
- Google image models (third-party summaries): https://benchlm.ai/media-pricing/nano-banana , https://pricepertoken.com/imagen-pricing
- Black Forest Labs: https://docs.bfl.ai/quick_start/pricing , https://help.bfl.ai/articles/7986977817-what-are-the-costs-associated-with-using-your-models , https://openrouter.ai/models/black-forest-labs/flux.2-klein-4b
- Stability AI licence: https://stability.ai/license
- Ideogram pricing (third-party summaries): https://pricepertoken.com/ideogram-pricing , https://usagepricing.com/blueprint/ideogram

Fonts: npm registry entries for the `@fontsource/*` packages listed in section D; opentype.js WOFF2 note: https://github.com/opentypejs/opentype.js/issues/183

Not verified in this session and worth a follow-up: tiny-skia's exact maximum pixmap size; Chromium's handling of SVG filters in print-to-PDF; current official price pages for every image model; Gelato and Prodigi pixel limits; whether resvg-js 2.7 stable will ship the 0.50 filter fixes; performance of `<pattern>` with an embedded raster texture in resvg and librsvg at print size.
