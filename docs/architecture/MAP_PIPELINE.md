# Map pipeline: address → Geography → landmarks

Code: `packages/geo/src`. Everything here is real OpenStreetMap data; nothing is invented.

## 1. Geocoding (`geocode.ts`)

`GeocodeProvider { suggest, search }`. The shipped provider combines Photon (type-ahead;
also first try for full search) and Nominatim (fallback, serialised to 1 request/second as
its policy requires). Results are normalised to `GeocodeResult` (label, context, lat/lon,
kind, address parts, bbox). Errors never include the query text.

## 2. Frame

`Frame { center, widthM, heightM }` — the piece of the world the artwork covers, in metres.
`LocalProjection` is Web Mercator scaled to true metres at the centre latitude (conformal,
so shapes match the picker basemap; error < 0.2 % across a neighbourhood — tested).
Coordinates are frame-local: x east, y south.

## 3. Tiles → Geography (`tiles.ts`)

1. `pickZoom` chooses the highest zoom ≤ 14 within a 64-tile budget.
2. Tiles are fetched (6 at a time, 3 retries) through a disk cache keyed by the tile set's
   **dataset version**, which makes maps reproducible.
3. Per feature: clip to the tile's own extent (removes buffer duplicates) → project →
   clip to the frame plus a 4 % margin.
4. **Roads** (`transportation`): classified into 9 classes; driveways/parking aisles,
   sidings and most tunnels dropped. Street names live in a separate layer
   (`transportation_name`), so each road samples three points and takes the majority name
   within 8 m. Fragments with the same class/name are **merged end-to-end** (never through
   junctions), simplified (Douglas–Peucker) and quantised to 0.1 m.
5. **Areas** (landcover, landuse, park, water): mapped to 15 kinds and **unioned per kind**
   so tile seams and overlapping patches disappear.
6. **Buildings**: only footprints touching a tile edge are unioned; tiny ones dropped.
   Omitted entirely for town-scale maps (> 5 km short edge), along with service roads and paths.
7. **POIs**: named points from `poi`, `water_name`, `aerodrome_label`, mapped to our
   category vocabulary (`poi-mapping.ts`); bus stops, parking, banks etc. are never shown.
   Each POI gets the area of the park/school/water polygon containing it.
8. The result is hashed: `Geography.key` is a content hash, so identical data ⇒ identical key.

Failure modes map to friendly errors: `GEODATA_UNAVAILABLE` (retryable), `NO_GEODATA`,
`AREA_TOO_LARGE`.

Typical numbers (1.2 × 1.6 km suburban frame): 4 tiles, ~215 roads, ~60 areas, ~180
buildings, ~30 POIs, ~80 KB JSON, ~100 ms warm.

## 4. Landmark intelligence (`landmarks.ts`)

```
score = preference × (0.30·category + 0.22·proximity + 0.18·prominence + 0.15·uniqueness + 0.15·size)
```

| Component | Meaning | Source |
|---|---|---|
| category | How much this kind of place belongs on a keepsake map (school 0.95 … bar 0.15) | `CATEGORY_META` |
| proximity | `exp(−d / 0.55·halfDiagonal)` from the home point | geometry |
| prominence | Source rank (1 = most prominent nearby); +0.4 if `wikidata`/`wikipedia` tags exist | tiles (tags when a richer source is added) |
| uniqueness | `1/√(same-category count)`, halved for names repeated nearby (chains) | the candidate set |
| size | log-scaled area of the containing polygon | areas |
| preference | 0 when the customer switched the category group off | design |

Selection is greedy over the ranked list with a per-category cap, minimum spacing, an edge
inset, a clear zone around home and a keep-out band for the title. Duplicate mappings of one
place are merged. Every component is returned for transparency, the customer can override
any choice, and overrides survive re-ranking (`suggestLandmarks`).

Known limits: prominence relies on OpenMapTiles rank because vector tiles carry no
`wikidata` tag; cuisine is inferred only from names ("pizza", "gelato"). Both improve with
a tag-rich source (roadmap P3).

## 5. Caching

| Cache | Where | Lifetime | Personal data? |
|---|---|---|---|
| Geocode results | memory (LRU, 10 min) | process | never persisted |
| Tiles | disk, by dataset version | indefinite | no (public data) |
| Geography snapshots | disk, by content hash | 30 days unless a saved project references it | contains the frame centre |
| Exports | disk | 24 h | yes — deleted by the retention sweep |
