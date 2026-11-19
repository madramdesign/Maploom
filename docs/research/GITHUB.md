# Open-source landscape for Maploom

Research date: 2026-11-18. Scope: open-source projects relevant to turning an address into a
print-quality illustrated neighbourhood map from OpenStreetMap data.

Evaluated against the decided architecture: TypeScript monorepo, Next.js, geocoding behind a
provider interface (Nominatim/Photon), Overpass for vector data (later self-hosted extracts /
PostGIS), MapLibre GL JS only for the area picker, **our own deterministic SVG renderer**, and
server-side rasterisation (resvg / sharp, tiled) for print export.

## How to read this document

**Verification method.** Every repository below was looked up on 2026-11-18 through the GitHub
search API (license SPDX id, `pushed_at`, archived flag). Where GitHub reported `NOASSERTION` or
no license, the `LICENSE` file was fetched from `raw.githubusercontent.com` and read. npm package
versions, release dates and `license` fields come from `registry.npmjs.org`.

**Caveats that apply to every entry.**

- "Last push" is GitHub's `pushed_at`: the most recent push to *any* branch, which can be a bot
  or dependency bump. It is an upper bound on activity, not proof of meaningful development.
  Where the npm release date tells a different story it is given too.
- "Production-usable?" and "Limitations" are my assessment from prior knowledge of the projects,
  not something tested in this session. Nothing here was installed or run.
- No star counts are given (not collected).
- Items marked **[unverified]** could not be confirmed in this session.

**"Incorporate" vocabulary.**

- **Dependency** - permissive license, fits the stack, safe to `npm install` / link.
- **Service / tool** - run as a separate process or network service; its license does not reach
  our code as long as we do not modify and redistribute it (see section 16).
- **Inspiration only** - read for ideas; do not copy code (license or stack mismatch).
- **No** - do not use.

---

## 1. Address lookup / geocoding

### Nominatim
- Repo: `osm-search/Nominatim` - https://github.com/osm-search/Nominatim
- License: GPL-3.0 (GitHub SPDX). Data returned is OSM, ODbL.
- Last push: 2026-11. Tech: Python, PostgreSQL/PostGIS.
- What: the reference OSM geocoder (search, reverse, lookup); can return the matched object's
  polygon (`polygon_geojson=1`), which doubles as a boundary source.
- Production-usable: yes (runs nominatim.openstreetmap.org).
- Incorporate: **Service**. Call over HTTP; GPL does not reach our code. Do not vendor its source.
- Limitations: the public instance has a strict usage policy (roughly 1 request/second, no
  autocomplete, identifying User-Agent, attribution) - not a production backend for a consumer
  app. Self-hosting a planet needs a large machine and long import. Weak at typo tolerance.
- Alternatives: Photon, Pelias, a commercial host of Nominatim.

### Photon
- Repo: `komoot/photon` - https://github.com/komoot/photon
- License: Apache-2.0. Last push: 2026-11. Tech: Java, OpenSearch/Elasticsearch-based index,
  built from a Nominatim database.
- What: search-as-you-type geocoder over OSM data, returns GeoJSON.
- Production-usable: yes. Public demo at photon.komoot.io is fair-use only, no SLA.
- Incorporate: **Service** (HTTP). Best fit for the autocomplete half of the provider interface.
- Limitations: no polygon output; building its index requires a Nominatim import (prebuilt
  dumps exist); house-number coverage follows OSM.
- Alternatives: Pelias autocomplete, Nominatim (no autocomplete).

### Pelias
- Repo: `pelias/pelias` - https://github.com/pelias/pelias (deployment: `pelias/docker`, MIT,
  last push 2026-03)
- License: MIT. Last push: 2026-07. Tech: Node.js services + Elasticsearch.
- What: modular geocoder combining OSM, OpenAddresses, Who's On First, Geonames.
- Production-usable: yes, but operationally heavy (several services plus Elasticsearch).
- Incorporate: **Service**, later, if address coverage from OSM alone proves insufficient.
- Limitations: ops cost; each imported dataset brings its own license/attribution.
- Alternatives: Photon + Nominatim.

### addok
- Repo: `addok/addok` - https://github.com/addok/addok
- License: MIT. Last push: 2025-12. Tech: Python, Redis.
- What: fast address search engine, built for the French national address base (BAN).
- Production-usable: yes for France. Incorporate: **Service**, only as a country-specific
  provider. Limitations: no global dataset out of the box. Alternatives: Photon.

### libpostal
- Repo: `openvenues/libpostal` - https://github.com/openvenues/libpostal
- License: MIT. Last push: 2026-05. Tech: C, with bindings.
- What: statistical address parser/normaliser. Useful in front of a geocoder to clean user input.
- Incorporate: **Optional service** later. Limitations: multi-GB model, native build.

### OpenAddresses
- Repo: `openaddresses/openaddresses` - https://github.com/openaddresses/openaddresses
- License: BSD-3-Clause for the repository; **each data source has its own license**.
- Last push: 2026-11. What: global collection of authoritative address points.
- Incorporate: data source for a self-hosted geocoder only; per-source license review needed.

---

## 2. Data access: Overpass and OSM-to-GeoJSON

These cover boundaries, roads, POIs, buildings, water, parks and trails at MVP stage; sections
3-4 note what is specific to each feature class.

### Overpass API
- Repo: `drolbr/Overpass-API` - https://github.com/drolbr/Overpass-API
- License: **AGPL-3.0**. Last push: 2026-02. Tech: C++.
- What: read-only query engine over OSM data (Overpass QL), bbox/polygon/`around` filters.
- Production-usable: yes. Public instances are shared, rate-limited and without SLA.
- Incorporate: **Service**. Querying it creates no obligation. Self-hosting unmodified is fine;
  if we modify it and expose it to users, AGPL requires publishing the modifications.
- Limitations: public instances time out on large or dense areas; quotas; results are raw OSM
  elements, not polygons; **coastlines are open ways, not sea polygons** (see section 4).
- Alternatives: `wiktorn/Overpass-API` (MIT Docker packaging, last push 2026-11) for
  self-hosting; `mmd-osm/Overpass-API` (AGPL-3.0 performance fork, last push 2024-09); later a
  PostGIS import (section 3).

### overpass-turbo
- Repo: `tyrasd/overpass-turbo` - https://github.com/tyrasd/overpass-turbo
- License: MIT (LICENSE file read; bundles third-party code under other licenses).
- Last push: 2026-11. Tech: TypeScript web app.
- What: interactive Overpass query IDE. Incorporate: **development tool** for designing queries.

### osmtogeojson
- Repo: `tyrasd/osmtogeojson` - https://github.com/tyrasd/osmtogeojson
- License: MIT. Last push: 2026-04. npm latest: `3.0.0-beta.5`, published 2022-10.
- What: converts Overpass JSON/XML to GeoJSON, including multipolygon relation assembly and the
  polygon-vs-line heuristics for closed ways.
- Production-usable: yes, widely used; the latest npm release is an old beta.
- Incorporate: **Dependency**.
- Limitations: slow and memory-hungry on large responses; untyped; npm release stale.
- Alternatives: `tibetty/osm2geojson-lite` (MIT, TypeScript, last push 2026-11, npm 3.0.0
  published 2026-11-18) - faster and typed, worth benchmarking against osmtogeojson on a dense
  city-centre extract before committing.

### query-overpass
- Repo: `perliedman/query-overpass` - https://github.com/perliedman/query-overpass
- License: ISC. Last push: 2023-03; npm 1.5.5 from 2019. Tech: JavaScript.
- What: thin wrapper: POST query, convert with osmtogeojson.
- Incorporate: **Inspiration only**. It is a few dozen lines around an HTTP call; our own client
  needs retry, endpoint rotation, caching and timeouts anyway.
- Alternatives: `1papaya/overpass-ts` (**no license on GitHub**, last push 2022-08; npm metadata
  says MIT - conflicting, so do not copy from the repo).

---

## 3. Extracts, imports and analysis (the "later: self-hosted" path)

### osmium-tool / libosmium
- Repos: `osmcode/osmium-tool` - https://github.com/osmcode/osmium-tool (GPL-3.0);
  `osmcode/libosmium` - https://github.com/osmcode/libosmium (BSL-1.0).
- Last push: 2026-11 (both). Tech: C++.
- What: cut regional extracts from planet/Geofabrik PBFs, filter by tag, convert formats.
- Production-usable: yes. Incorporate: **Tool** (CLI in a data pipeline).

### osm2pgsql
- Repo: `osm2pgsql-dev/osm2pgsql` - https://github.com/osm2pgsql-dev/osm2pgsql
- License: GPL-2.0. Last push: 2026-11. Tech: C++, Lua "flex" output.
- What: imports OSM into PostGIS with a schema we define; supports minutely updates.
- Production-usable: yes (powers the main OSM tile layer).
- Incorporate: **Tool**. Recommended import path for the PostGIS phase because flex configs let
  the tables mirror our geography model.
- Alternatives: imposm3.

### imposm3
- Repo: `omniscale/imposm3` - https://github.com/omniscale/imposm3
- License: Apache-2.0. Last push: 2026-08. Tech: Go.
- What: OSM to PostGIS importer with YAML mapping and built-in generalised tables.
- Incorporate: **Tool**, fallback to osm2pgsql. Limitations: smaller maintainer base.

### OSMnx
- Repo: `gboeing/osmnx` - https://github.com/gboeing/osmnx
- License: MIT. Last push: 2026-11. Tech: Python (NetworkX, GeoPandas, Shapely).
- What: downloads and models street networks and other features from Overpass; graph
  simplification and intersection consolidation.
- Production-usable: yes, in Python.
- Incorporate: **Inspiration only** (wrong language). Its network-type Overpass filters and its
  approach to merging dual carriageways/complex junctions are worth reading; MIT permits
  porting ideas with attribution.

### Also noted
- `bdon/OSMExpress` (BSD-2-Clause, last push 2025-12): fast extract database format.
- `postgis/postgis` (GPL-2.0, tool/service), `libgeos/geos` (LGPL-2.1), `shapely/shapely`
  (BSD-3-Clause): relevant only to an eventual Python or PostGIS geometry stage.
- `openstreetmap/osmosis`: **no license detected on GitHub**, last push 2024-12. Use osmium.

---

## 4. Feature classes: what to query and what goes wrong

No extra library is needed per class; this records the data-source decisions.

| Need | MVP source | Notes and traps |
|---|---|---|
| Boundaries | Nominatim `polygon_geojson`, or Overpass `relation[boundary=administrative]` / `place=neighbourhood/suburb` | Neighbourhoods are often mapped as points only, so a boundary will frequently be missing. Fallback: user-drawn rectangle/radius from the picker. |
| Roads | Overpass `way[highway]` | Dual carriageways and junction detail need consolidation for an illustrated look (see OSMnx). Use `layer`, `bridge`, `tunnel` for draw order. |
| POIs | Overpass `nwr[amenity|shop|tourism|leisure|historic]` | Use `out center` so ways/relations yield a point. Density needs ranking; OSM has no popularity signal. |
| Buildings | Overpass `way/relation[building]` | Coverage varies by region. Multipolygon buildings with courtyards need relation assembly. |
| Water | Overpass `natural=water`, `waterway=*` | **Sea is not a polygon in OSM.** Coastline is `natural=coastline` ways; a coastal bbox needs pre-built water polygons from osmdata.openstreetmap.de (ODbL) clipped to the bbox. |
| Parks | Overpass `leisure=park|garden|nature_reserve`, `landuse=grass|forest|...`, `natural=wood` | Overlapping landuse polygons need a consistent draw order. |
| Trails | Overpass `highway=path|footway|cycleway|track|bridleway`, plus `route=hiking|bicycle` relations | Route relations give named trails; member ways give geometry. |

Supplementary building data:

- **Microsoft Global ML Building Footprints** - `microsoft/GlobalMLBuildingFootprints` -
  https://github.com/microsoft/GlobalMLBuildingFootprints. The `LICENSE` file read on
  2026-11-18 says the data is under "CLDA Permissive 2.0" (sic; presumably CDLA-Permissive-2.0).
  I recall this dataset being ODbL in the past, so **confirm against the README before use**.
  ML-derived shapes are blobby and unsuitable as the primary illustrated footprint; fallback
  for regions where OSM has none.
- **Overture Maps** - `OvertureMaps/data` (MIT repo, last push 2026-10), `OvertureMaps/overturemaps-py`
  (MIT, last push 2026-11). GeoParquet themes for buildings, places, transportation. Per-theme
  data licenses differ and OSM-derived themes carry ODbL **[unverified in this session]**.
  Candidate for POI enrichment later.

---

## 5. Rendering engines and tile infrastructure

Maploom's renderer is its own; these matter for the picker, for an optional basemap, and as
references. None of them should sit in the print path.

### MapLibre GL JS
- Repo: `maplibre/maplibre-gl-js` - https://github.com/maplibre/maplibre-gl-js
- License: BSD-3-Clause (LICENSE.txt read; npm `maplibre-gl` 6.19.0, 2026-11-17).
- Last push: 2026-11. Tech: TypeScript, WebGL.
- Production-usable: yes. Incorporate: **Dependency**, for the area picker only (as decided).
- Limitations: needs a tile source and a style; canvas size is capped by the GPU, which is why
  it cannot be the print renderer.

### MapLibre Native (and its Node bindings)
- Repo: `maplibre/maplibre-native` - https://github.com/maplibre/maplibre-native
- License: BSD-2-Clause. Last push: 2026-11. npm `@maplibre/maplibre-gl-native` 6.4.1, 2026-03.
- What: C++ renderer; the Node binding renders a GL style to a raster buffer headlessly.
- Incorporate: **No** for the print path (raster only, texture-size limits, needs tiles and
  GL styles, platform-specific binaries). Possible later use: cheap thumbnail previews.
- Note: `mapbox/mapbox-gl-native` is archived (last push 2023-07).

### tileserver-gl
- Repo: `maptiler/tileserver-gl` - https://github.com/maptiler/tileserver-gl
- License: BSD-2-Clause (LICENSE.md read). Last push: 2026-11. Tech: Node + MapLibre Native.
- What: serves vector tiles and server-rendered raster tiles / static images.
- Incorporate: **Service**, optional, only if we self-host picker tiles.

### Mapnik / node-mapnik
- Repos: `mapnik/mapnik` - https://github.com/mapnik/mapnik (LGPL-2.1, last push 2026-11);
  `mapnik/node-mapnik` (BSD-3-Clause, last push 2026-09).
- What: the classic C++ map renderer; can emit SVG and PDF through Cairo; mature label
  placement.
- Incorporate: **No** for the core (conflicts with the own-SVG-renderer decision; heavy native
  dependency; XML styles). Keep as the reference for how a mature renderer orders layers and
  places labels. LGPL allows dynamic linking if ever needed.
- Related: `openstreetmap-carto/openstreetmap-carto` (CC0 per its LICENSE.txt **[first lines
  only read; treat as unverified]**, last push 2026-11) is the best public catalogue of which
  OSM tags matter at which scale.

### Planetiler
- Repo: `onthegomap/planetiler` - https://github.com/onthegomap/planetiler
- License: Apache-2.0. Last push: 2026-11. Tech: Java.
- What: builds planet-scale vector tilesets (MBTiles/PMTiles) from OSM on one machine in hours.
- Incorporate: **Tool**, later, for self-hosted picker tiles.

### tilemaker
- Repo: `systemed/tilemaker` - https://github.com/systemed/tilemaker
- License: "FTWPL" (`LICENCE.txt` read) - a permissive joke license with a warranty disclaimer;
  not an OSI/SPDX license, so legal may object. Last push: 2026-11. Tech: C++, Lua.
- Incorporate: **Tool**, fallback to Planetiler.

### PMTiles / Protomaps basemaps
- Repos: `protomaps/PMTiles` - https://github.com/protomaps/PMTiles (BSD-3-Clause for code, spec
  public domain/CC0; last push 2026-09); `protomaps/basemaps` (BSD-3-Clause code, plus separate
  "Visual Design" and "Tile Schema" sections in LICENSE.md - read those before reusing styles;
  last push 2026-09); `protomaps/go-pmtiles` (BSD-3-Clause, last push 2026-07).
- What: single-file tile archives served by HTTP range requests from object storage; a matching
  OSM basemap.
- Incorporate: **Dependency / service**. Cheapest way to self-host picker tiles: one file on a
  CDN, no tile server.

### OpenMapTiles
- Repo: `openmaptiles/openmaptiles` - https://github.com/openmaptiles/openmaptiles
- License: code BSD-3-Clause, **design/schema CC-BY 4.0** (LICENSE.md read). Using the schema
  requires visible "(c) OpenMapTiles" attribution, including on printed maps.
- Last push: 2026-07. Incorporate: **avoid as schema**; prefer Protomaps or Shortbread
  (`shortbread-tiles/shortbread-docs`, CC0-1.0, last push 2026-11) to avoid an extra credit line.

### VersaTiles, OpenFreeMap, Martin
- `versatiles-org/versatiles-rs` (MIT, Rust, last push 2026-11) and
  `versatiles-org/versatiles-style` (MIT, TypeScript, last push 2026-11): tile toolkit and
  programmatic MapLibre style generator on the Shortbread schema.
- `hyperknot/openfreemap` - https://github.com/hyperknot/openfreemap (MIT project; its styles
  inherit OpenMapTiles BSD-3 code / CC-BY design terms per LICENSE.md; last push 2026-11): free
  public vector tile hosting, no API key. **Good zero-cost tile source for the picker at MVP**,
  with a self-hosted PMTiles fallback because there is no SLA.
- `maplibre/martin` (Apache-2.0 per GitHub, Rust, last push 2026-11): PostGIS/MBTiles/PMTiles
  tile server for the PostGIS phase.

---

## 6. SVG map generation (closest prior art)

### prettymaps
- Repo: `marceloprates/prettymaps` - https://github.com/marceloprates/prettymaps
- License: **AGPL-3.0** (verified). Last push: 2026-07. Tech: Python (OSMnx, matplotlib, Shapely,
  vsketch).
- What: the project that popularised stylised OSM posters: layer dictionary -> styled
  matplotlib/plotter output, circular and shaped crops, hand-drawn hatching presets.
- Incorporate: **Inspiration only, and look-don't-copy.** AGPL would oblige us to release
  Maploom's source to network users if we incorporated or ported its code.
- Limitations: Python, slow, matplotlib raster/vector output not designed for a server product.

### prettymapp
- Repo: `chrieke/prettymapp` - https://github.com/chrieke/prettymapp
- License: MIT. Last push: 2026-07. Tech: Python, Streamlit.
- What: a clean-room-style reimplementation of the prettymaps idea as a web app and package.
- Incorporate: **Inspiration** (MIT, so its layer/tag groupings and palettes can be adapted
  with attribution). Closest existing product shape to Maploom.

### city-roads
- Repo: `anvaka/city-roads` - https://github.com/anvaka/city-roads
- License: MIT. Last push: 2026-11. Tech: JavaScript (Vue, custom WebGL), Overpass.
- What: renders every road in a city in the browser, exports PNG and SVG.
- Incorporate: **Inspiration** for the Overpass area-query flow and compact binary caching of
  road geometry. Roads only, single style, client-side.

### maptoposter
- Repo: `originalankur/maptoposter` - https://github.com/originalankur/maptoposter
- License: MIT. Last push: 2026-08. Tech: Python (OSMnx, matplotlib).
- What: city name -> minimalist poster, JSON themes. Spawned many ports (Swift, Dart, web).
- Incorporate: **Inspiration** for theme JSON shape and poster typography layout.

### print-maps
- Repo: `mpetroff/print-maps` - https://github.com/mpetroff/print-maps
- License: MIT. Last push: 2023-08. Tech: browser JavaScript + GL JS.
- What: renders a GL map at chosen physical size and DPI in the browser by overriding
  `devicePixelRatio`.
- Incorporate: **Inspiration only**. Confirms the ceiling of the browser-GL approach (canvas
  and texture limits) and so supports the own-renderer decision. Maintained successor in the
  same spirit: `watergis/maplibre-gl-export` (MIT, TypeScript, last push 2026-11).

### d3-geo
- Repo: `d3/d3-geo` - https://github.com/d3/d3-geo
- License: ISC (LICENSE read; npm 3.1.2, 2026-11). Tech: JavaScript, no DOM required.
- What: projections and `geoPath`, which turns GeoJSON into SVG path strings; `fitExtent`
  for fitting a bbox to a page.
- Production-usable: yes. Incorporate: **Dependency candidate** for projection and path
  generation.
- Limitations: it is spherical by default - polygons with the "wrong" winding order are
  interpreted as covering the rest of the globe, and adaptive resampling adds points. For a
  neighbourhood-scale map, project to Web Mercator (or a local equirectangular) ourselves and
  use `geoIdentity`/`geoTransform`, or write the ~30 lines of projection math and path
  serialisation directly. The second option gives tighter control of coordinate rounding,
  which matters for deterministic output.

### Discovered in search (beyond the brief)
| Repo | License | Last push | Why it matters |
|---|---|---|---|
| `nandenjin/map-factory` - https://github.com/nandenjin/map-factory | MIT | 2026-11 | TypeScript; "Render OSM data to editable SVG or large, stitched image". Closest stack match found. **Read first.** Not evaluated beyond its description. |
| `doersino/osm2svg4art` - https://github.com/doersino/osm2svg4art | MIT | 2025-03 | Browser tool: Overpass -> layered SVG for plotting. Small, readable. |
| `piebro/plotting-maps` - https://github.com/piebro/plotting-maps | MIT | 2026-08 | OSM -> SVG for pen plotters; line-ordering ideas. |
| `dabutvin/parkslopemap` - https://github.com/dabutvin/parkslopemap | **none** | 2026-07 | Describes exactly our pipeline (OSM GeoJSON -> d3-geo -> rough.js illustrated map). No license: look only. |
| `piLeoni/drawland` | **AGPL-3.0** | 2026-11 | Rust engine for layered plotter SVGs from OSM. Look only. |
| `streletskiy/osm2vector` | **AGPL-3.0** | 2026-02 | Offline large-area SVG+PDF renderer. Look only. |
| `utrost/CityPlot` | **AGPL-3.0** | 2026-07 | Plotter-art city maps. Look only. |
| `arnehilmann/huebsche-karten` | **AGPL-3.0** | 2023-04 | prettymaps-inspired SVG renderer. Look only. |
| `koenderks/rcityviews` | **GPL-3.0** | 2026-04 | R; good gallery of poster themes. Look only. |
| `NxT-Solutions/City-Map-Poster-Generator` | **none** | 2026-03 | TypeScript poster generator with PNG/SVG export. No license: look only. |
| `baditaflorin/osm-poster` | unclear (NOASSERTION) | 2026-11 | Browser-only poster generator. License not read. |
| `wumingaizhou/map-to-poster-with-ai` | MIT | 2026-06 | TypeScript; LLM-driven style refinement of map posters. |
| `kkalata/map-generator` | ISC | 2024-07 | Python OSM -> SVG script. |

---

## 7. High-resolution export

Target: 4 ft x 6 ft at 300 DPI = 14400 x 21600 px = 311 megapixels, about 1.24 GB as raw RGBA.

### resvg
- Repo: `linebender/resvg` - https://github.com/linebender/resvg
- License: Apache-2.0 per GitHub (historically dual Apache-2.0/MIT **[MIT half unverified]**).
- Last push: 2026-11. Tech: Rust (tiny-skia).
- What: static SVG renderer, no system dependencies, reproducible output across platforms -
  the property that matters for a deterministic pipeline.
- Production-usable: yes.
- Limitations: static SVG subset (no scripting/animation, limited CSS); fonts must be supplied
  explicitly; one full-size pixmap at 311 MP is impractical, so render in tiles.

### resvg-js
- Repo: `thx/resvg-js` (npm metadata points at `yisibl/resvg-js`) - https://github.com/thx/resvg-js
- License: **MPL-2.0**. Last push: 2026-06. **npm latest `@resvg/resvg-js` 2.6.2, published
  2024-03** - the published binding lags the Rust crate considerably.
- What: napi-rs and WASM bindings to resvg for Node.
- Incorporate: **Dependency**. MPL is file-level copyleft: using it unmodified from npm imposes
  nothing on our code; changes to its own files would have to be published.
- Limitations: release staleness (above); bundles an older resvg; to render tiles, use its
  crop/fit options or re-emit the SVG with a shifted `viewBox` per tile **[option names not
  re-checked this session - confirm against the current README]**. If the binding stays stale,
  the fallback is a small in-house napi-rs wrapper around the `resvg` crate, or shelling out to
  the `resvg` CLI.

### sharp / libvips
- Repos: `lovell/sharp` - https://github.com/lovell/sharp (Apache-2.0; npm 0.35.5, 2026-09);
  `libvips/libvips` (LGPL-2.1; shipped as a prebuilt shared library by sharp).
- Last push: 2026-11 (both).
- What: streaming image pipeline: join tiles, set DPI metadata, convert colour space with ICC
  profiles, encode PNG/TIFF/JPEG with low memory.
- Incorporate: **Dependency**, for tile assembly and encoding.
- Limitations: sharp's default input pixel limit is about 268 MP, **below our 311 MP target**,
  so `limitInputPixels` must be raised or disabled on trusted internal input. Its own SVG
  input path goes through librsvg, whose text and filter rendering differs from resvg - do not
  mix the two renderers for the same artwork. PNG maximum dimensions are not an issue at this
  size; JPEG caps at 65535 px per side.

### Puppeteer / Playwright
- Repos: `puppeteer/puppeteer` (Apache-2.0), `microsoft/playwright` (Apache-2.0); both last
  push 2026-11.
- What: headless Chromium; can screenshot or print SVG to PDF.
- Incorporate: **Fallback only**. Chromium's SVG support is the most complete, and print-to-PDF
  yields vector PDF, but output varies with browser version (not deterministic), screenshots hit
  size limits well below 311 MP, and it is heavy to run serverless.

### Satori
- Repo: `vercel/satori` - https://github.com/vercel/satori
- License: MPL-2.0. Last push: 2026-11. Tech: TypeScript.
- What: converts a flexbox subset of HTML/CSS to SVG, with text converted to paths.
- Incorporate: **Optional dependency** for non-map furniture only (title block, legend,
  dedication text), where flexbox layout is convenient. Not a map renderer.

### Canvas-based alternatives (noted)
- `samizdatco/skia-canvas` (MIT, last push 2026-11) and `Brooooooklyn/canvas` (`@napi-rs/canvas`,
  npm says MIT, last push 2026-11): Skia canvases for Node, can emit PDF/SVG. Relevant only if
  we ever want a second, canvas-style backend. `Automattic/node-canvas`: GitHub detected no
  license (npm says MIT); needs Cairo system libraries.

---

## 8. Map styling

### Maputnik
- Repo: `maplibre/maputnik` - https://github.com/maplibre/maputnik
- License: MIT. Last push: 2026-11. Tech: TypeScript/React.
- What: visual editor for MapLibre style JSON.
- Incorporate: **Tool** for the picker basemap style. Inspiration for a future Maploom style
  editor UI. It edits GL styles, not our style config.

### OSM Liberty
- Repo: `maputnik/osm-liberty` - https://github.com/maputnik/osm-liberty
- License: BSD-3-Clause for the style JSON, with separately licensed design/icons (LICENSE.md;
  derived from Mapbox OSM Bright). Tied to the OpenMapTiles schema and its CC-BY attribution.
- Last push: 2026-10. Incorporate: **Reference style** for the picker; palette and zoom-level
  decisions are a sound baseline.

### OpenFreeMap styles
- Repo: `hyperknot/openfreemap-styles` - https://github.com/hyperknot/openfreemap-styles
- License: MIT project, styles carry upstream BSD/CC-BY terms (LICENSE.md read).
- Last push: 2026-10. Incorporate: **Dependency by URL** (Liberty/Bright/Positron for the
  picker).

### MapLibre Style Spec
- Repo: `maplibre/maplibre-style-spec` (license NOASSERTION on GitHub, not read; last push
  2026-11).
- Incorporate: **Inspiration** for our own style config: its layer/filter/paint model and
  expression language are the industry vocabulary. Borrow the concepts (ordered layers, filters
  on tags, zoom-independent paint) rather than the full expression engine.

### Historic illustrated styles (inspiration)
- `stamen/watercolor` (ISC, last push 2024-06), `stamen/toner-carto` (ISC, archived),
  `stamen/terrain-classic` (ISC, last push 2024-06). Watercolor is the canonical example of a
  texture-and-mask pipeline producing a painted look from OSM; the technique (blur, threshold,
  texture fill per land class) transfers directly to SVG filters or a raster post-pass.

---

## 9. Label placement

No maintained, renderer-independent JavaScript library solves cartographic labelling end to end.
Plan to own this module and assemble it from small parts.

### polylabel
- Repo: `mapbox/polylabel` - https://github.com/mapbox/polylabel
- License: ISC (LICENSE read). Last push: 2026-06; npm `polylabel` 2.1.0, 2026-06.
- What: pole of inaccessibility - the best interior point for a polygon label (parks, lakes).
- Incorporate: **Dependency**.

### RBush / Flatbush
- Repos: `mourner/rbush` - https://github.com/mourner/rbush (MIT; npm 4.0.1, 2024-08; last push
  2026-10); `mourner/flatbush` - https://github.com/mourner/flatbush (ISC; npm 4.7.0, 2026-10).
- What: R-tree spatial indexes. RBush supports insert/remove (greedy placement by priority);
  Flatbush is static and faster (indexing fixed obstacles such as icons and road casings).
- Incorporate: **Dependency** (both). Collision detection core.

### label-placer
- Repo: `AtelierCartographie/label-placer` - https://github.com/AtelierCartographie/label-placer
- License: ISC. Last push: 2026-11. Tech: TypeScript.
- What: "Automatic label placement for maps and charts, independent of the renderer."
- Incorporate: **Evaluate** - found by search, description matches our need exactly, but not
  examined beyond metadata. Maturity unknown.

### D3-Labeler
- Repo: `tinker10/D3-Labeler` - https://github.com/tinker10/D3-Labeler
- License: MIT. Last push: 2017-11 (unmaintained).
- What: simulated-annealing point-label placement.
- Incorporate: **Inspiration only**. Uses random moves; any port must use a seeded PRNG to stay
  deterministic.

### labelgun
- Repo: `Geovation/labelgun` - https://github.com/Geovation/labelgun
- License: GitHub detects none; `package.json` says MIT. **Archived**, npm 6.1.0 from 2017.
- Incorporate: **No**. It is a thin priority-collision wrapper over rbush; write our own.

### Text measurement
- `opentypejs/opentype.js` (MIT, last push 2026-08): read font metrics and convert text to
  outlines in Node. Needed to compute label boxes without a browser, and optionally to emit
  text as paths so print output never depends on font availability.
- `harfbuzz/harfbuzzjs` (MIT, last push 2026-10): full shaping for complex scripts if we go
  beyond Latin.
- Also seen: `peermaps/label-placement-engine` (BSD-2-Clause, last push 2022-05).

Note on curved street labels: SVG `<textPath>` is the natural output, but renderer support and
glyph spacing differ; confirm resvg's behaviour early or place glyphs individually along the
path ourselves **[resvg textPath support not verified this session]**.

---

## 10. Geometry simplification and operations

### Turf
- Repo: `Turfjs/turf` - https://github.com/Turfjs/turf
- License: MIT. Last push: 2026-11; npm `@turf/turf` 7.4.0, 2026-08. Tech: TypeScript.
- What: modular GeoJSON toolkit (bbox, area, length, buffer, clip, simplify, line ops).
- Incorporate: **Dependency**, importing individual `@turf/*` modules.
- Limitations: works in lon/lat with geodesic approximations; buffer quality is mediocre; some
  modules are slow on large inputs. For rendering maths, operate in projected page coordinates.

### simplify-js
- Repo: `mourner/simplify-js` - https://github.com/mourner/simplify-js
- License: BSD-2-Clause. Last push: 2022-11; npm 1.2.4, 2020 (finished rather than abandoned).
- What: Douglas-Peucker with radial-distance pre-pass for polylines.
- Incorporate: **Dependency** (or re-implement; it is tiny). Simplify in page units with a
  tolerance tied to output DPI.
- Limitation: per-line, not topology-aware - shared borders between adjacent polygons can
  separate.

### mapshaper
- Repo: `mbloch/mapshaper` - https://github.com/mbloch/mapshaper
- License: MPL-2.0 (LICENSE read). Last push: 2026-11. Tech: JavaScript, CLI and API.
- What: topology-preserving simplification (Visvalingam, DP), dissolve, clip, mosaic.
- Incorporate: **Dependency or tool** when topology-aware simplification is needed (adjacent
  landuse). MPL is fine for unmodified use.
- Limitations: API is command-string oriented; large package.

### Polygon boolean operations
- `mfogel/polygon-clipping` - https://github.com/mfogel/polygon-clipping (MIT; last push
  2024-04; npm 0.15.7, 2023-12): union/intersection/difference/xor. Effectively dormant.
- `luizbarboza/polyclip-ts` - https://github.com/luizbarboza/polyclip-ts (MIT; npm 0.16.8,
  2024-12; last push 2025-11): TypeScript fork with arbitrary-precision arithmetic; the engine
  Turf 7 uses **[Turf dependency recalled, not re-checked]**. **Preferred of the two.**
- `w8r/martinez` (MIT; npm `martinez-polygon-clipping` 0.9.1, 2026-11): alternative algorithm.
- Incorporate: **Dependency** (polyclip-ts) for clipping features to the page/boundary shape
  and unioning road casings or building blocks.

### Clipper family (offsetting)
- `junmer/clipper-lib` - https://github.com/junmer/clipper-lib: GitHub detects no license; npm
  says "BSL"; last npm release 2019. Port of Clipper 1. **Avoid.**
- `countertype/clipper2-ts` - https://github.com/countertype/clipper2-ts (BSL-1.0; last push
  2026-11; npm version string is a pre-release `2.0.1-19`): TypeScript port of Clipper2.
- `ErikSom/Clipper2-WASM` (BSL-1.0; npm 0.4.0, 2026-05): WASM build.
- Upstream `AngusJohnson/Clipper2` (BSL-1.0): **GitHub reported it as archived** on 2026-11-18,
  last push 2026-10. Unexpected - check before depending on a port.
- Why it matters: polygon/polyline **offsetting** (turning road centre-lines into filled road
  shapes with proper joins, insetting building outlines, hand-drawn double strokes). Boolean
  libraries above do not offset. BSL-1.0 is permissive.
- Incorporate: **Dependency candidate** (clipper2-ts), pending a maturity check. Clipper works
  on integer coordinates - scale page units before use.

### Also noted
- `mapbox/earcut` (ISC), `mapbox/delaunator` (ISC), `mapbox/concaveman` (ISC), `mourner/kdbush`
  (ISC), `mapbox/supercluster` (ISC; POI clustering), `bjornharrtell/jsts` (npm: EDL-1.0 OR
  EPL-1.0; JTS port, robust but large), `proj4js/proj4js` (license not read; only needed for
  non-Mercator projections), `svg/svgo` (MIT; shrink exported SVG - disable any lossy numeric
  rounding that would alter geometry), `fontello/svgpath` (MIT; path transforms).

---

## 11. Hand-drawn and illustrative rendering

### Rough.js
- Repo: `rough-stuff/rough` - https://github.com/rough-stuff/rough
- License: MIT. Last push: 2024-07; npm `roughjs` 4.6.6, 2023-11. Stable, slow-moving.
- What: sketchy strokes and hachure/cross-hatch/dot fills for paths; has a generator API that
  returns path data without a DOM, usable server-side.
- Incorporate: **Dependency** for the first "sketch" style.
- Limitations: randomised by default - **pass an explicit `seed` per feature** (e.g. derived
  from the OSM id) or output will not be deterministic; hachure fills on thousands of buildings
  inflate SVG size and raster time sharply; one recognisable look.

### perfect-freehand
- Repo: `steveruizok/perfect-freehand` - https://github.com/steveruizok/perfect-freehand
- License: MIT. Last push: 2026-04. Tech: TypeScript, pure functions.
- What: turns a point sequence into a variable-width stroke outline polygon (ink/brush look).
- Incorporate: **Dependency** for brush-style roads, rivers and coastlines. Deterministic
  (no randomness); "pressure" can be synthesised from road class or position along the line.

### Plotter tooling
- `abey79/vpype` (MIT, Python, last push 2026-11): line merge/sort/simplify for plotter SVGs.
  Inspiration for stroke-ordering and for a future "plotter-ready SVG" export.

Techniques we will have to build ourselves (no suitable library found): seeded jitter of
polygon vertices, building "pop-up" pseudo-3D extrusion, tree/pattern scattering inside parks
(Poisson-disc sampling with a seeded PRNG), paper-texture and watercolour-edge SVG filters,
and hand-lettered label styling.

---

## 12. Procedural / illustrated map generation (technique references)

These generate imaginary maps; value is in drawing technique, not data.

| Repo | License | Last push | Use |
|---|---|---|---|
| `Azgaar/Fantasy-Map-Generator` - https://github.com/Azgaar/Fantasy-Map-Generator | MIT (LICENSE read) | 2026-11 | SVG-based; relief icons, coastline styling, label-along-path, texture overlays. Best MIT-licensed source of illustrated-map SVG techniques. |
| `mewo2/terrain` - https://github.com/mewo2/terrain | MIT (LICENSE.md read) | 2016-08 | Classic hand-drawn terrain shading and label placement write-up. |
| `ProbableTrain/MapGenerator` - https://github.com/ProbableTrain/MapGenerator | **LGPL-3.0** | 2024-05 | Procedural city maps with pseudo-3D buildings. Look only. |
| `watabou/TownGeneratorOS` - https://github.com/watabou/TownGeneratorOS | **GPL-3.0** | 2021-01 | Medieval city generator; charming building/ward rendering. Look only. |

Other search hits (`nickontiveros/illustrated-maps`, `EchoOfHONK/worldsmith`) carry no license
and were not examined.

---

## 13. AI map-to-illustration pipelines

No mature open-source project was found that converts real OSM geometry into a faithful
illustrated map with a generative model; searches for OSM + ControlNet/diffusion pipelines
returned nothing usable. The building blocks exist:

| Repo | License | Last push | Role |
|---|---|---|---|
| `huggingface/diffusers` - https://github.com/huggingface/diffusers | Apache-2.0 | 2026-11 | Python library to run diffusion pipelines incl. ControlNet and tiled img2img. |
| `lllyasviel/ControlNet` - https://github.com/lllyasviel/ControlNet | Apache-2.0 (code) | 2024-02 | Conditions generation on line art / segmentation - i.e. on our rendered map. |
| `tencent-ailab/IP-Adapter` - https://github.com/tencent-ailab/IP-Adapter | Apache-2.0 (code) | 2024-06 | Style transfer from a reference illustration. |
| `Comfy-Org/ComfyUI` - https://github.com/Comfy-Org/ComfyUI | **GPL-3.0** | 2026-11 | Node-graph runner; usable only as a separate service. |
| `wumingaizhou/map-to-poster-with-ai` | MIT | 2026-06 | LLM edits the *style config*, not pixels - the safer pattern. |

Assessment:

- Diffusion output is not deterministic across hardware/versions, hallucinates or drops streets,
  and cannot natively produce 311 MP; tiled upscaling introduces seams and drift. It conflicts
  with "deterministic renderer" if placed in the main path.
- Model **weights** carry their own licenses (OpenRAIL variants, non-commercial research
  licenses for some models) separate from the code licenses above **[per-model terms not
  checked]**. Commercial print sales need a model whose license allows it.
- Recommended position: keep the deterministic SVG renderer as the product. Use LLMs to generate
  or tweak **style configs** (palette, stroke, pattern choices). Treat pixel-level AI stylisation
  as an optional, clearly-labelled experimental post-process on the rasterised output, conditioned
  on our own line-art render.

---

## 14. Print production

| Repo | License | Last push / release | Role |
|---|---|---|---|
| `lovell/sharp` | Apache-2.0 | 2026-11 | Final encode: PNG/TIFF, DPI metadata, ICC profile embedding, RGB->CMYK conversion via profile. |
| `foliojs/pdfkit` - https://github.com/foliojs/pdfkit | MIT | 2026-11; npm 0.20.2 (2026-08) | Generate vector PDF (paths, fonts, images) in Node; trim/bleed boxes by page size. |
| `Hopding/pdf-lib` - https://github.com/Hopding/pdf-lib | MIT | last push 2024-07; npm 1.17.1 (2021) | Create/modify PDFs. Dormant; prefer pdfkit for new work. |
| `svg/svgo` | MIT | 2026-11 | Reduce SVG size before rasterising or shipping. |
| `watergis/maplibre-gl-export` | MIT | 2026-11 | Reference for page-size/DPI UI. |

Points for the print stage:

- Deliver raster as PNG or TIFF with 300 DPI metadata and an embedded sRGB profile; most
  print-on-demand services accept sRGB and convert themselves. Offer CMYK only if a specific
  printer asks for it.
- A vector PDF is the better large-format deliverable when the style has no raster textures:
  resolution-independent and far smaller. Converting our SVG to PDF needs either our renderer
  to target pdfkit's path API as a second backend, or an SVG-to-PDF converter (`svg-to-pdfkit`
  exists on npm - **license and maintenance not verified**). Avoid Ghostscript in the service
  (AGPL) and treat Inkscape (GPL) as an offline tool only.
- Bleed (typically 3 mm / 0.125 in) and a safe margin must be part of the page model in the
  renderer, not added afterwards.
- **OSM attribution must be printed on the poster** (see section 16).
- Hachure/texture-heavy styles at 14400 x 21600 can produce SVGs of hundreds of MB; budget
  geometry simplification by output DPI and test raster time per tile early.

---

## 15. Recommended for Maploom

| # | Pipeline need | Chosen | Fallback | Notes |
|---|---|---|---|---|
| 1 | Address lookup | **Photon** (autocomplete) + **Nominatim** (final resolve, polygon) behind the provider interface | Pelias self-hosted; commercial Nominatim host | Public instances are for prototyping only. |
| 2 | Boundaries | **Nominatim `polygon_geojson`** | Overpass admin/place relations; user-drawn area | Expect missing neighbourhood polygons. |
| 3 | Road extraction | **Overpass** `way[highway]` + **osmtogeojson** | osm2geojson-lite; later osm2pgsql flex -> PostGIS | Port OSMnx consolidation ideas (MIT). |
| 4 | POI discovery | **Overpass** `nwr[...]` with `out center` | Overture places (license check) | Ranking is ours to build. |
| 5 | Building footprints | **Overpass** `building=*` | Microsoft footprints / Overture where OSM is empty (license check) | |
| 6 | Water | **Overpass** inland water + **osmdata.openstreetmap.de water polygons** for sea | Coastline assembly in-house | Coastal bboxes break without this. |
| 7 | Parks | **Overpass** leisure/landuse/natural | PostGIS import | |
| 8 | Trails | **Overpass** highway path classes + route relations | PostGIS import | |
| 9 | Rendering (interactive) | **MapLibre GL JS** + OpenFreeMap tiles/style | Self-hosted PMTiles (Planetiler build, Protomaps or Shortbread schema) | Picker only. |
| 10 | SVG generation | **Own renderer**; own Mercator projection + path serialiser (or `d3-geo` with `geoIdentity`) | d3-geo `geoPath` | Study `nandenjin/map-factory` (MIT), prettymapp (MIT), Azgaar FMG (MIT). |
| 11 | High-res export | **resvg-js** tiled render -> **sharp** join/encode | `resvg` CLI or own napi wrapper; Playwright as last resort | Raise sharp's `limitInputPixels`; pin versions for determinism. |
| 12 | Map styling | **Own style config**, vocabulary borrowed from the MapLibre style spec; **Rough.js** (seeded) and **perfect-freehand** for illustrated strokes | Plain SVG strokes/fills | Maputnik/OSM Liberty only for the picker basemap. |
| 13 | Label placement | **Own module**: polylabel + rbush/flatbush + opentype.js metrics, greedy by priority | Evaluate `AtelierCartographie/label-placer` (ISC); annealing (D3-Labeler idea, seeded) | Largest unsolved build item. |
| 14 | Simplification / geometry | **simplify-js** (page units), **polyclip-ts** (boolean/clip), selected **@turf/** modules | mapshaper (topology-aware); clipper2-ts (offsetting) | |
| 15 | Print production | **sharp** (PNG/TIFF, DPI, ICC) | **pdfkit** vector PDF backend | Bleed and attribution in the page model. |

---

## 16. Licensing cautions

This is an engineering summary, not legal advice; have counsel confirm before launch.

### Do not copy code from these (copyleft)
| Project | License | Consequence of incorporating or porting code |
|---|---|---|
| `marceloprates/prettymaps` | AGPL-3.0 (verified) | Would require offering Maploom's complete source to all network users. |
| `piLeoni/drawland`, `streletskiy/osm2vector`, `utrost/CityPlot`, `arnehilmann/huebsche-karten` | AGPL-3.0 | Same. |
| `drolbr/Overpass-API`, `mmd-osm/Overpass-API` | AGPL-3.0 | Use as a service only; publish any modifications to a self-hosted instance. |
| `osm-search/Nominatim`, `osmcode/osmium-tool`, `koenderks/rcityviews`, `watabou/TownGeneratorOS`, `Comfy-Org/ComfyUI` | GPL-3.0 | Run as separate tools/services; never link or vendor. |
| `osm2pgsql-dev/osm2pgsql`, `postgis/postgis`, `openstreetmap/mod_tile` | GPL-2.0 | Same. |
| `ProbableTrain/MapGenerator` | LGPL-3.0 | Code copying brings LGPL terms; look only. |

A line-by-line port into TypeScript is a derivative work. Reading these projects for ideas is
fine; implement from the idea, not from the source.

### Do not copy from repositories with no license
No license means all rights reserved. Observed without a license: `dabutvin/parkslopemap`,
`NxT-Solutions/City-Map-Poster-Generator`, `Geovation/labelgun` (repo; `package.json` says MIT),
`junmer/clipper-lib` (repo; npm says BSL), `1papaya/overpass-ts` (repo; npm says MIT),
`openstreetmap/osmosis`, `Automattic/node-canvas` (repo detection; npm says MIT),
`openmaptiles/fonts`. Where repo and npm metadata disagree, treat as unlicensed until read.

### Weak / file-level copyleft that is safe as an unmodified dependency
- MPL-2.0: `@resvg/resvg-js`, `satori`, `mapshaper`. Obligations arise only if we modify their
  files and distribute the result.
- LGPL-2.1: `libvips` (inside sharp's prebuilt binaries, dynamically linked), `mapnik`, `geos`.
  Do not statically link modified copies.

### Data licenses (these affect every map we sell)
- **OpenStreetMap data is ODbL 1.0.** A rendered map is a "Produced Work": it may be sold under
  our own terms, but must carry attribution - "(c) OpenStreetMap contributors" - **legibly on
  the printed poster and on screen**. If we publicly distribute a *derived database* (e.g.
  cleaned extracts), share-alike applies to that database.
- Mixing OSM with other datasets (Microsoft footprints, Overture, OpenAddresses) can trigger
  ODbL questions and extra attribution lines. Keep a per-layer source registry in the geography
  model so the attribution string is generated, not hand-written.
- **OpenMapTiles schema/design is CC-BY 4.0**: any picker basemap using it needs
  "(c) OpenMapTiles" as well. Protomaps or Shortbread (CC0) schemas avoid this.
- Fonts and icon sets bundled into exports need their own licenses checked (OFL fonts are fine
  for print; verify any icon set individually). Not researched here.
- AI model weights are licensed separately from their code (section 13).

### Service usage policies (not licenses, but binding)
- nominatim.openstreetmap.org and public Overpass instances prohibit heavy or commercial bulk
  use. Budget for self-hosting or a paid provider before public launch, and cache aggressively
  (a geocode and an Overpass extract per order, stored with the order for reproducibility).

---

## 17. Not verified in this session

- Runtime behaviour of any project (nothing was installed or executed).
- resvg-js option names for cropped/tiled rendering, and resvg `<textPath>` support.
- That Turf 7 depends on polyclip-ts.
- Dual-license status of resvg and martin (GitHub reports Apache-2.0 only).
- Current README terms of Microsoft GlobalMLBuildingFootprints and per-theme Overture licenses.
- Full text of the openstreetmap-carto license, MapLibre style spec license, proj4js license,
  `baditaflorin/osm-poster` license, and the "Visual Design" terms in `protomaps/basemaps`.
- Why `AngusJohnson/Clipper2` is flagged archived.
- Maturity of `nandenjin/map-factory`, `AtelierCartographie/label-placer`, `countertype/clipper2-ts`
  (metadata only).
- `svg-to-pdfkit` license and maintenance.
- A final discovery query ("street map print high resolution") was cut off by GitHub's
  secondary rate limit.
