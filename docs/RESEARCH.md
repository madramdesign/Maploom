# Research index

Research was done by five parallel agents before and during implementation; decisions were
consolidated in [`DECISIONS.md`](DECISIONS.md) so the agents could not diverge.

| Document | Covers |
|---|---|
| [research/COMPETITORS.md](research/COMPETITORS.md) | 15+ products (custom rugs, map posters, illustrators, UX references), pricing, gaps, recommendations |
| [research/GITHUB.md](research/GITHUB.md) | ~60 open-source projects by pipeline need, licences, what can and cannot be incorporated |
| [research/MAP_DATA.md](research/MAP_DATA.md) | OSM, Mapbox, MapLibre, Google and other APIs; licensing; geodata cost model |
| [research/RENDERING_AND_AI.md](research/RENDERING_AND_AI.md) | Rendering approaches with measured benchmarks, cartographic techniques, AI architecture, fonts |
| [research/COSTS_AND_PAYMENTS.md](research/COSTS_AND_PAYMENTS.md) | Payment options and operating-cost model for 10 / 100 / 1,000 / 10,000 maps per month |
| [architecture/PRINTING.md](architecture/PRINTING.md) | Print-on-demand providers, rug availability, artwork specs, provider interface |

## Headline findings

1. **The gap is automation of illustrated maps.** Line-map posters are commoditised; kid-style
   illustrated maps with named places are otherwise hand-made, slow and $150–$600.
2. **OSM is the only viable data source for sold artwork**; rendering it ourselves makes the
   image an ODbL "Produced Work" (attribution, no share-alike). Mapbox and Google terms
   restrict print and derivative use.
3. **Public OSM services are for development only**; Overpass blocks cloud IP ranges —
   which is why the pipeline uses vector tiles (D-003).
4. **Print path must be filter-free** with text as outlines; a 311 MP file is feasible in
   seconds-to-tens-of-seconds on a small worker (confirmed by our own benchmark).
5. **Rugs top out at 4×6 ft via mainstream APIs** and are decorative chenille rugs, not
   purpose-built play mats; selling to children triggers CPSIA obligations.
6. **Costs are dominated by print, shipping and payment fees**, not infrastructure; AI
   illustration is the only tech cost that could matter and should be cached or post-purchase.

## Caveat on sources

Many vendor and policy sites were not reachable from the build sandbox, so several figures
come from search-result extracts. Each document tags what is first-hand, secondary or
unverified and ends with a re-check list. Treat prices as indicative.
