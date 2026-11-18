# Map data architecture (decision document)

> **Implementation status (authoritative, updated with the code).**
> The shipped `FeatureSource` is **OpenMapTiles-schema vector tiles from OpenFreeMap**
> (`packages/geo/src/tiles.ts`, `tile-source.ts`), not Overpass. Reason: the public Overpass
> instances reset or time out connections from cloud IP ranges (observed during development
> and consistent with the research below), while versioned vector tiles are fast, cacheable
> and reproducible. Wherever this document says "Overpass" for feature extraction, read it
> as an evaluated option that is **not implemented**; see `docs/DECISIONS.md` D-003 and
> `docs/architecture/MAP_PIPELINE.md`. Geocoding is implemented as described (Photon for
> suggestions, Nominatim fallback), with public instances for development only.

Status: proposed, 2026-11-18. Evidence, prices, URLs: `docs/research/MAP_DATA.md`. Not legal advice.
Several limits were confirmed only from search extracts (research doc, sections 0 and 11).

## 1. Decision

- **OpenStreetMap is the only source of geographic truth for artwork.** Mapbox and Google
  terms forbid storing results, deriving content and (for Google) use on non-Google maps.
- **Our own SVG renderer** produces the artwork from OSM features. The output is an ODbL
  Produced Work: attribution required, no share-alike on the image.
- **MapLibre GL JS + OpenFreeMap** serve the interactive area picker only. Picker tiles never
  feed the artwork.
- **Every external service sits behind a provider interface** with a declared usage policy.
- Change from the preliminary plan: public Photon/Nominatim/Overpass are **dev-only**; paid or
  self-hosted replacements go live before paying customers.

## 2. Provider interfaces

```ts
interface ProviderPolicy {       // declared by every provider, enforced by the backend
  maxRps: number; allowsAutocomplete: boolean; commercialUse: boolean;
  resultStorage: 'permanent' | 'while-subscribed' | 'temporary' | 'none';
  cacheTtlSeconds: number; attribution: string[];
}
interface Geocoder {
  policy: ProviderPolicy;
  autocomplete?(q: string, opts: { bias?: LngLat; lang?: string }): Promise<Place[]>;
  geocode(q: string): Promise<Place[]>;
  reverse(p: LngLat): Promise<Place | null>;
}
interface FeatureSource {        // roads, buildings, water, landuse, POIs for a bbox
  policy: ProviderPolicy;
  fetch(bbox: BBox, layers: LayerSpec[], schemaVersion: string): Promise<FeatureCollectionSet>;
}
interface PoiRanker { rank(pois: Poi[], ctx: { home: LngLat }): RankedPoi[]; }
interface TileSource { styleUrl: string; attribution: string; }   // picker only
```

Rules: the browser never calls a third-party geocoder or Overpass directly; all calls go
through our backend proxy (rate limit, cache, key hiding, identifying User-Agent). `Place`
carries `source`, `sourceId` and `licence` so every order records provenance. A provider whose
`resultStorage` is not `permanent` cannot be selected for the order pipeline.

| Interface | Dev | Launch | Scale |
|---|---|---|---|
| Geocoder (autocomplete) | Photon public | Hosted OSM-based (Geoapify / LocationIQ / Stadia) or self-hosted Photon country extracts | Self-hosted Photon planet |
| Geocoder (geocode, reverse) | Nominatim public (no autocomplete, ever) | Same as autocomplete provider | Self-hosted Nominatim/Photon |
| FeatureSource | Overpass public + mirrors | PostGIS from Geofabrik extracts for launch countries; Overpass as fallback for other regions | PostGIS (osm2pgsql flex, daily diffs), planet coverage |
| PoiRanker | OSM tags: `wikidata`/`wikipedia`, class, area, distance | + Wikipedia-derived importance file | + Overture Places / FSQ OS Places for recall (separate tables) |
| TileSource | OpenFreeMap | OpenFreeMap, PMTiles fallback on our bucket | Self-hosted PMTiles behind CDN |

## 3. Caching policy

| Data | May we cache? | TTL / rule |
|---|---|---|
| Nominatim public responses | Yes, caching is requested by the policy | 30 days; key = normalised query |
| Photon public responses | Yes (open data; reduces load) | 7 days for autocomplete prefixes, 30 days for resolved places |
| Overpass / OSM feature extracts | Yes, ODbL data may be stored indefinitely | Key = (z14 tile cover of bbox, layer spec, schema version); refresh after 30-90 days or on user "refresh" |
| Order snapshot (features used for a purchased map) | Yes | Permanent, immutable, with OSM data timestamp; needed for reprints |
| Chosen address/coordinates per order | Yes for OSM-based providers (insubstantial extract per OSMF Geocoding Guideline) | Permanent |
| Hosted OSM geocoders | Per plan: LocationIQ free 48 h request cache but stored results allowed; Stadia Free/Starter temporary only, Standard+ while subscribed | Driven by `ProviderPolicy`; re-check contract at signup |
| Mapbox / Google results | Mapbox temporary geocodes: no storing; Google lat/lng: max 30 days | Not used |
| Picker tiles | Browser/CDN HTTP cache only; no bulk download of third-party tiles | Follow response headers |
| Overture / FSQ / WOF | Yes (permissive or ODbL) | Pin a release; refresh quarterly |

Never mutate cached OSM rows. Corrections, user labels, styling and third-party data live in
separate tables keyed by OSM id (avoids a Derivative Database whose alterations ODbL 4.6 could oblige us to offer).

## 4. Rate-limit handling

- Token-bucket limiter per provider from `policy.maxRps` (Nominatim public: 1 req/s for the
  whole application; Photon public: 1 req/s self-imposed).
- Autocomplete: debounce 300 ms, min 3 characters, cancel in-flight requests, prefix cache.
- Overpass: at most 2 concurrent queries per instance, `[timeout:25]`, small bboxes (the map
  area is at most a few km2), identifying User-Agent. On 429/504: stop, wait >= 30 s with
  jittered exponential backoff, then fail over to the next instance; open a circuit breaker
  after 3 failures. Never retry in a tight loop.
- Feature fetches are queued background jobs; if no source responds, notify the customer when the preview is ready.
- Daily budget counters per provider (Overpass main: ~10,000 requests / ~1 GB per day ceiling; stay near 1% of it).

## 5. Attribution policy

- Picker: MapLibre attribution control always visible (OpenFreeMap, OpenMapTiles, OSM).
- Every rendered preview and the product page / checkout (point of sale):
  "Map data (c) OpenStreetMap contributors" linked to `https://www.openstreetmap.org/copyright`.
- Artwork template reserves a non-removable bottom-margin line (URL printed out):
  `Map data (c) OpenStreetMap contributors - openstreetmap.org/copyright`. If the print process
  cannot render small text (tufted rugs): on the sewn label or hang tag; always on the packing insert.
- Other sources (Overture, FSQ, WOF, geocoder vendor): credited on a "Data sources" page and
  beside the OSM line when their licence requires it.
- No OSM logo on products (trademark policy); no brand logos in artwork, POI names as text only.
- Fonts: SIL OFL only unless a licence covers products for resale. Icons: in-house (Maki/Temaki CC0 fallback).

## 6. Scale-up path

1. **Prototype (now)**: public Photon + Nominatim + Overpass behind our proxy and cache;
   OpenFreeMap. $0. Not acceptable for paid launch.
2. **Launch** (trigger: first paying customer): hosted OSM-based geocoder with storage rights
   ($0-50/month) or Photon country extracts on a VPS; PostGIS from Geofabrik extracts for launch
   countries, Overpass fallback elsewhere; PMTiles fallback uploaded.
3. **Growth (~1,000+ maps/month)**: self-hosted Photon; osm2pgsql flex with daily diffs for all
   sold regions; importance file; optional Overture Places.
4. **Scale (~10,000+ maps/month)**: planet PostGIS, self-hosted Nominatim, PMTiles on our CDN.
   Expected geodata spend $100-300/month.

Each step is a new implementation of an existing interface plus a config switch.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Public OSM services throttle, block cloud IP ranges or change policy without notice | Dev-only use; proxy + cache; mirrors; self-hosted path ready before launch |
| ODbL share-alike triggered by altering or conflating OSM data | Immutable OSM tables; separate tables for everything else; legal review |
| Attribution missing or illegible on a physical product | Non-removable template line; label/insert fallback; print proof checklist |
| OSM data quality varies (missing buildings, vandalism, stale POIs) | User preview and edit/hide controls stored as overlays; Overture as recall supplement; snapshot per order |
| Overture schema churn and no popularity data | Pin releases; adapter layer; do not depend on it for ranking |
| Hosted geocoder or OpenFreeMap changes terms or disappears | `ProviderPolicy` gate; second provider tested; Photon self-host and PMTiles as exits |
| Print providers hold us liable for user-entered text and AI-drawn content | Moderation of custom labels; no logos; keep provenance per order |
| Unverified facts in the research (network-blocked session) | Re-check the 12 items in research section 11 before budgeting or signing terms |
