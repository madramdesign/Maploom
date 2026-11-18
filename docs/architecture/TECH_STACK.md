# Tech stack

Chosen for this product, not out of habit. Each row lists what was evaluated.

| Concern | Choice | Rationale | Evaluated and not chosen |
|---|---|---|---|
| Language | TypeScript everywhere | The renderer must run identically in browser and server | Python (OSMnx, GeoPandas, Shapely) for geo: excellent, but splits the renderer across runtimes |
| Web framework | Next.js 16 (App Router), React 19 | UI + API routes + admin in one deployable; streaming route handlers for downloads | Separate SPA + API (more moving parts for an MVP) |
| Styling | Tailwind CSS 4 + a small component layer | Fast iteration, consistent tokens | CSS-in-JS |
| Client state | Zustand with `persist` | Small, supports undo/redo history and local autosave | Redux (heavier), React context (no persistence) |
| Interactive map | MapLibre GL JS 6 + OpenFreeMap style | Open source, no key, commercial use allowed; used only for picking the area | Mapbox GL (licence), Leaflet raster (no vector styling) |
| Geo data | OpenMapTiles-schema vector tiles (`@mapbox/vector-tile`, `pbf`) | See D-003 | Overpass, PostGIS extracts |
| Geometry | Own clip/merge/simplify (≈300 lines) + `polygon-clipping` for unions | Small, deterministic, no heavy dependency | Turf (large), JSTS |
| Rendering | Own SVG renderer | See D-005 | MapLibre Native, Mapnik, headless Chromium |
| Text | opentype.js → outlines; fonts from `@fontsource/*` (SIL OFL) | See D-006 | Server-side font loading |
| Rasteriser | `@resvg/resvg-js` + own streaming PNG writer | See D-008 | sharp/libvips, Puppeteer, Satori (no path-heavy SVG support) |
| Database | Postgres (`pg`) / PGlite embedded for dev+tests | See D-009 | SQLite, ORM |
| PostGIS | Deferred | See D-010 | — |
| Queue | Postgres table + worker loop | See D-011 | Redis/BullMQ |
| Object storage | Local disk behind three small stores (`store.ts`) | Swappable for S3/R2 without touching callers | S3 from day one |
| Validation | zod | One schema for API input and saved designs | — |
| Tests | Vitest (unit/integration), Playwright (e2e, desktop + mobile) | — | — |

## Not used yet (and why)

- **Redis** — nothing needs it until we run more than one web node (rate limits, queue).
- **PostGIS** — no geographic query hits the DB today.
- **Python** — no processing step requires it.
- **AI services** — see D-015.

## Version notes

Dependencies were installed at their then-latest majors (Next 16, React 19, Tailwind 4,
MapLibre 6, zod 4, opentype.js 2). Two library defects are worked around in code and
documented there: opentype.js `toPathData()` emitting `NaN` (we serialise paths ourselves)
and resvg 2.6 aborting on `opacity` during strip rendering.
