# Roadmap

Phases follow the brief; ✅ = done in the initial build.

| Phase | Scope | State |
|---|---|---|
| 1–5 | Address search · interactive map · extraction · landmarks · illustrated renderer | ✅ |
| 6 | Personalisation editor | ✅ |
| 7 | Save projects | ✅ (guest) |
| 8 | High-resolution export | ✅ PNG + SVG |
| 9 | Product mockups | ✅ |
| 10 | Checkout | ◻ test mode only |
| 11 | Print fulfilment | ◻ ports + mock |
| 12 | Advanced AI | ◻ researched |

## P1 — make it launchable
1. **Production data providers**: paid/self-hosted OSM geocoder; self-hosted PMTiles (or a
   paid OpenMapTiles host) behind `TileSource`; contact e-mail in the User-Agent.
2. **Stripe Checkout** behind `PaymentProvider` (Checkout Sessions, webhook signature
   verification, Stripe Tax); order state machine driven by webhooks.
3. **First print vendor** behind `PrintProvider` (research recommends Printful first, Prodigi
   second); order samples of every product before enabling it; replace placeholder prices.
4. **Legal**: privacy policy, terms, ODbL attribution wording for packaging, CPSIA decision
   for play mats, name/trademark check.
5. **Ops**: Postgres + object storage (S3/R2) adapters for `store.ts`, separate worker,
   Redis-backed rate limits, error tracking, uptime checks.
6. **Accounts (optional)**: magic-link sign-in to claim guest projects across devices.

## P2 — product depth
- Rotation; freeform custom width/height; square format.
- More personal-place tools (search inside the editor, photo-free "house style" variants).
- Smarter labels: curved text for parks/water names, label priority tuning, multi-script fonts.
- PDF export (vector) and CMYK/ICC handling per vendor.
- Version history UI (data already stored), duplicate project, share-by-link (opt-in only).
- Occasion templates (new baby, new home, wedding) and gift flow.

## P3 — data & intelligence
- Tag-rich source (self-hosted extract in PostGIS, or Overture for recall) to add
  `wikidata`/`wikipedia`/cuisine signals to landmark scoring.
- Coastline handling with OSM water polygons.
- Optional LLM re-ranking restricted to ids from the candidate list, with the scoring
  function as fallback.
- Landmark illustration assets: offline-generated, human-reviewed, normalised to each
  style's palette and outline weight, cached per OSM feature + style.

## P4 — platform
- More products (puzzles, mugs, stickers) as configuration + mockup scene.
- Multi-vendor routing by region; regional pricing/currencies.
- Programmatic landing pages per city/occasion.
