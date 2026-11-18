# Maploom — notes for coding agents

Working name for a product that turns a real place into personalised illustrated map art.
Read `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` before changing structure.

## Commands
- `npm run dev` (add `NODE_USE_ENV_PROXY=1` behind an HTTPS proxy) · `npm run build`
- `npm test` · `npm run e2e` · `npm run lint` · `npm run typecheck`
- Offline map data: `MAPLOOM_FIXTURE_TILES=tests/fixtures/tiles`
- After changing renderer output: `npx tsx scripts/build-style-previews.ts` (regenerates `apps/web/public/styles/*.svg`)

## Rules that must hold
1. **Geography ≠ presentation.** `packages/geo` and `packages/core` never import render/server
   (ESLint enforces). Styles must not change geometry (tested).
2. **Geography is never invented.** Positions, names and shapes come from OSM data only.
3. **The renderer is pure and deterministic.** No `Math.random`, `Date`, DOM or network in
   `packages/render`. Seed randomness from feature ids (`prng(hash32(id))`).
4. **SVG output constraints** (tests fail otherwise): text as outlines only, no `<image>`,
   no external refs, no SVG filters, **never element-level `opacity`** — use
   `fill-opacity`/`stroke-opacity` (resvg 2.6 aborts the process on strips otherwise).
5. **Attribution** (`© OpenStreetMap contributors`) is always rendered.
6. **Privacy.** Nothing about a design or address is persisted except via `saveProject`.
   Never log queries, addresses, coordinates or designs; never put addresses in URLs.
   New persisted fields that could identify a place must be encrypted (`crypto.ts`).
7. **SQL** is parameterised (`$1`), never interpolated. Schema changes = append to `MIGRATIONS` in `db.ts`.
8. **Products/prices are configuration** (`packages/core/src/products.ts`); prices are always
   computed server-side. Vendors go behind `PrintProvider` / `PaymentProvider`.
9. **Customer-facing errors** come from `ERROR_MESSAGES`; no stack traces or internals.

## Gotchas
- opentype.js: don't call `getPath(string)`/`toPathData()` — use `Typeface` in `fonts.ts`.
- Packages are consumed as TS source; server-only code must stay out of client bundles
  (`@maploom/server` and `@maploom/render/fonts-node` are server-only).
- The dev job queue lives on `globalThis`; restart `npm run dev` after editing job handlers.
- MapLibre needs its worker served from `/vendor` (copied by `scripts/copy-assets.mjs`) and
  forces `position: relative` on its container.
- Tailwind 4: `@apply` cannot reference our own component classes.

## Docs to keep in sync
`docs/PROJECT_STATUS.md` (what works), `docs/DECISIONS.md` (why), `docs/ROADMAP.md` (next).
