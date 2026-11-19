# Project status

_Last updated: 2026-11-18 (end of the initial build)._

## Works end to end today

Address/place search → interactive area selection → real OSM geography → landmark selection →
illustrated map in six styles → visual editor → product mockups → save → export.

| Area | State | Notes |
|---|---|---|
| Address search | ✅ | Type-ahead (Photon) + full search with fallback (Nominatim); 5 demo locations |
| Area selection | ✅ | MapLibre picker with printable boundary; 5 coverage presets, free pan/zoom, 5 shapes × portrait/landscape; graceful fallback without WebGL/network |
| Geographic extraction | ✅ | Roads (with street names), parks/land use, water, buildings, POIs from versioned vector tiles; disk cache; reproducible content hash |
| Landmark intelligence | ✅ | Transparent 5-factor score, diverse/spaced selection, category preferences, user overrides preserved |
| Illustrated rendering | ✅ | Deterministic SVG; styles: Playtime, Watercolor, Heirloom, Studio, Night Lights, Atelier |
| Personalisation | ✅ | Name → title, subtitle, dedication, date; home marker label/icon/colour/size/visibility; custom places; free text |
| Editor | ✅ | Select, drag, rename, re-icon, recolour, resize, hide/remove; erase roads/buildings/areas; layer toggles; undo/redo; reset; local autosave; dedicated mobile bottom-sheet UI |
| Save projects | ✅ | Guest (anonymous cookie), encrypted at rest, versioned (last 20), reopen, delete, delete-everything |
| Export | ✅ | Preview PNG, print-resolution PNG (per-product DPI + bleed), vector SVG; background job with progress; signed 24 h links. 14400×21600 px verified |
| Product mockups | ✅ | Poster, framed, canvas, floor mat, flat — live artwork |
| Admin | ✅ basic | Projects, jobs, failed jobs + retry, exports, orders + status changes, API usage, retention sweep |
| Tests | ✅ | 45 unit/integration (offline fixtures) + e2e journey on desktop and mobile |

## Static demo (GitHub Pages)

`npm run build:demo` produces a browser-only build in `apps/web/out`; pushing to `main`
publishes it via `.github/workflows/pages.yml` (Pages must be enabled with source
"GitHub Actions"). Verified locally from a `/Maploom` sub-path: search, area, generate,
edit, preview, save (localStorage), PNG and SVG download, reopen.

Differences from the server app: the browser talks to public OSM services directly
(the address a visitor types is sent to Photon/Nominatim — disclosed in the banner and on
`/privacy`); saves are local to the browser; PNG export is canvas-based (2400 px / 6000 px),
SVG is the print deliverable; no ordering, admin, encryption-at-rest or security headers.

## Deliberately stubbed (ports exist, vendors do not)

| Area | State |
|---|---|
| Checkout | Test mode only: orders are recorded with server-computed prices through `MockPaymentProvider`. **No Stripe integration, no money moves.** |
| Print fulfilment | `PrintProvider` + `MockPrintProvider` only. No vendor integrated; play mats are "coming soon". Prices are placeholders. |
| Accounts | Schema has `users`; no sign-in. Saved maps are tied to one browser. |
| AI features | None (by decision D-015). |

## Known limitations

- **Public OSM services are development-only.** Photon/Nominatim public instances and
  OpenFreeMap carry no SLA; production needs paid or self-hosted equivalents (roadmap P1).
- Landmark prominence uses the tile rank; vector tiles carry no Wikidata tag and no cuisine.
- Building coverage is whatever OSM has (sparse in some suburbs).
- Fonts are Latin-only; names in other scripts are skipped on the map.
- No map rotation; no PDF/CMYK output; coastline/sea polygons untested.
- Rate limiting and the dev job runner are single-process.
- Not verified against live Overpass (not used) or any real print vendor.
- Research docs rely partly on search-result extracts because vendor sites were not
  reachable from the build sandbox; each doc marks unverified figures. Re-check prices
  before making commercial decisions.
- Legal review outstanding: privacy policy, ODbL attribution on physical goods, CPSIA for
  children's products, trademark check for the working name.

## Verification snapshot

`npm test` 45 passed · `npm run e2e` 4 passed (desktop + mobile) · `npm run typecheck` clean ·
`npm run lint` clean · `npm run build` succeeds · live run against OpenFreeMap/Photon OK.
