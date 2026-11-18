# Architecture

Maploom (working name) turns a real place into personalised illustrated artwork.
The core idea is a strict three-way split:

```
 GEOGRAPHY (what is there)        DESIGN (what the customer chose)      STYLE (how it looks)
 packages/geo → Geography    +    packages/core → Design           +    packages/render → MapStyle
 roads, areas, buildings,         title, names, home marker,            colours, widths, fonts,
 water, POIs in local metres      landmarks, hidden ids, product        icons, badges, borders
                         \_______________________|_______________________/
                                                 v
                              renderMap() → SVG  (pure, deterministic)
                                   |                         |
                         browser preview/editor      server export (PNG strips / SVG)
```

Given the same Geography snapshot, Design and style, the output is byte-identical.

## Packages

| Package | Responsibility | May import |
|---|---|---|
| `@maploom/core` | Types (geography model, `Design` zod schema), category metadata, product/pricing config, error catalogue, hashing | — |
| `@maploom/geo` | Projection & bounds, vector-tile ingestion, clipping/merging/simplifying, geocoding providers, landmark scoring | core |
| `@maploom/render` | Style configs, fonts→outlines, icon set, SVG renderer, design factory | core, geo |
| `@maploom/server` | Env validation, DB, crypto, job queue, caches, export pipeline, projects, commerce ports, admin read models | core, geo, render |
| `apps/web` | Next.js UI, API routes, admin | all |
| `apps/worker` | Standalone job worker | server |

ESLint enforces the direction (geo/core cannot import render or server; render cannot import server).

## Request flow

1. **Search** — browser → `/api/geocode/suggest` (Photon) or `POST /api/geocode/search` → normalised `GeocodeResult`. In-memory cache only.
2. **Area** — MapLibre picker (OpenFreeMap basemap). The dashed rectangle is the printable frame; pan/zoom define `Frame {center, widthM, heightM}`.
3. **Generate** — `POST /api/geography` enqueues a job → worker fetches z14 tiles (disk-cached), builds a `Geography`, stores it by content hash → client polls `/api/jobs/:id`, then downloads the snapshot.
4. **Design & edit** — all in the browser: the renderer runs client-side, so edits are instant. State is autosaved to localStorage.
5. **Save** — `POST /api/projects` (the only path that persists a design). Encrypted at rest, versioned.
6. **Export** — `POST /api/exports` enqueues a render at preview or print resolution → signed, expiring download URL.
7. **Order** — `POST /api/checkout` creates an order with a server-computed price through the `PaymentProvider` port (mock/test mode today).

## Data model (Postgres)

`users` (reserved for optional accounts) · `projects` → `design_versions` · `jobs` · `exports` · `orders` → `order_events` · `api_usage`.
Geometry is not in the database: Geography snapshots are content-addressed files, and tiles are a disk cache. See `packages/server/src/db.ts` for the schema.

More detail: [MAP_PIPELINE](architecture/MAP_PIPELINE.md) · [RENDERING](architecture/RENDERING.md) · [PRIVACY](architecture/PRIVACY.md) · [TECH_STACK](architecture/TECH_STACK.md) · [MAP_DATA](architecture/MAP_DATA.md) · [PRINTING](architecture/PRINTING.md) · [DECISIONS](DECISIONS.md).
