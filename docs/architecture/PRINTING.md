# Print-on-demand: research and decision

Status: research draft, 2026-11-18. Owner: architecture. Review before any provider contract or public price list.

## 0. How to read this document

**Evidence levels.** This research was done from a network-restricted session: vendor sites (printful.com, printify.com, gooten.com, prodigi.com, contrado.com and their developer docs) could not be opened directly. Every fact below comes from web-search result extracts of those pages or of third-party pages. Each number is tagged:

- **[V]** — taken from the vendor's own page (via a search extract). Reasonably reliable, still re-check before use.
- **[3P]** — third-party blog, comparison site or reseller. Indicative only.
- **[U]** — unverified: from prior knowledge or inference, not confirmed in this session. Treat as a question to answer, not a fact.

Nothing here should be copied into product configuration without a live check through the provider's catalog/quote API. That is consistent with the architecture rule that prices, sizes and shipping live in configuration, sourced from `listCatalog` / `quote`.

**The one-paragraph answer.** Posters, framed prints, canvas and puzzles are a commodity: several providers with decent REST APIs can make them. Large rugs are the constraint. Through mainstream APIs the practical ceiling is **4'x6' (48"x72")** at Printful and Printify (both made by the same kind of supplier; on Printify the supplier is MWW On Demand) and at Prodigi, and **5'x7'** at Gooten. Sizes above that (8'x10', 9'x12') exist only by going to MWW On Demand directly. Launch rugs at 4'x6' through Printful, add 5'x7' through Gooten or MWW once samples pass, and put wall art on Prodigi or Printful.

## 1. Rugs and play mats: who can actually make them

| Source | Sizes found | Material | Integration | Notes |
|---|---|---|---|---|
| **Printful** area rug | 24x36, 36x60, 48x72 in; tolerance ±2 / ±3 / ±3.5 in [V] | 100% polyester chenille, hemmed edges, grey underside [V] | Full REST API | From $24.06 (24x36) to $75.25 (48x72), ex VAT [V]. Ships rugs **within the US only** [V]. No bulk discounts on rugs [V]. Also lists an outdoor rug. |
| **Printify** "Area Rugs" (supplier: MWW On Demand) | Same three sizes, both orientations = 6 variants [V] | 100% polyester chenille, hemmed, grey underside, dye sublimation [V] | Full REST API | From EUR 20.93, EUR 15.16 with Printify Premium [V]; another Printify page says "starting at $16.72" [V]. Economy shipping only for the 24x36 size [V]. Also round and outdoor rugs. |
| **Prodigi** area rugs | 2'x3' and 4'x6' [V, single search extract] | not confirmed | Full REST API with sandbox | Also lists outdoor area rugs. Price and ship-from not found. |
| **Gooten** area rugs | 18x30 in, 3x2, 5x3, 6x4, **7x5 ft**, 8x2.5 ft runner, 5 ft round [V] | Chenille face, woven polyester backing, 0.25 in thick, dye sublimation [V] | REST API | Largest mainstream-API rug found. Price not public; PSD/JPG templates give print area and bleed [V]. Gooten says its network is US-based manufacturers [V]. |
| **MWW On Demand** (direct) | Nine sizes including **5'x7', 8'x10', 9'x12'** [V] | Chenille top, dye sublimation, woven polyester backing [V] | "Connects via API" per its supplier profile [3P]; no public developer docs found | Made and printed in the USA, Spindale NC [3P]. Production 3–5 business days [V]. Dry-clean only per one review [3P]. Requires a sales conversation. |
| **Contrado** | Neoprene play mats 60x60, 130x130, 130x210 cm, 3 mm, bias-bound [V, AU site]; custom-size washable rugs [V] | Neoprene / rug fabrics | Has a print-on-demand API and a Shopify app; API page does not list play mats explicitly [V] | Handmade to order; AUD $109 starting price on the AU play mat page [V]. Premium priced. Closest thing to a purpose-built "play mat". |
| **PrintKK** | 36x24, 72x48 in flannel non-slip rug; a 108x72 in listing; "size can be customised, contact us" [V] | Flannel, non-slip backing | API not confirmed | Shipping to US from $12.34, 4–15 business days [V]; origin not stated (likely China [U]). Low base prices. |
| **Threadless** "Premium Rug" | not stated | Chenille | Marketplace, no fulfilment API | Product cost $33.61–$169.74 [V] — useful only as a hint at what a large chenille rug costs wholesale. |
| YouCustomizeIt, Zazzle, Society6 | up to 5'x7' and larger | Chenille | Retail storefronts, no order API [U] | Not usable as a `PrintProvider`. |
| Spoonflower, WeaveUp | — | Fabric by the yard | No rug product found [U] | Not relevant unless we sew our own mats. |
| OEM (Alibaba / Made-in-China) | Any | Printed nylon or polyester, latex anti-slip backing | Email and spreadsheets | Listings show e.g. $23–37 per piece at MOQ 20, $4.9–6.9 per m² at MOQ 50 m², lead times 25–35 days [3P]. Not one-off personalised production. |

Findings that matter:

1. **4'x6' is available everywhere; 5'x7' is not.** Printful and Printify stop at 48x72 in. Only Gooten (7x5 ft) and MWW direct (5x7 and up) reach the second target size.
2. **Printful, Printify and MWW are probably the same product.** The Printful and Printify listings have identical sizes, tolerances, material and "grey underside" wording, and Printify names MWW On Demand as the supplier. That Printful's rug is also MWW-made is an inference [U]. Consequence: switching between these three is a commercial fallback, not a quality or capacity fallback.
3. **These are chenille area rugs, not play mats.** They are thin (about 0.25 in), short-pile, dye-sublimated polyester. Nobody in the API-accessible set sells a foam-backed, wipe-clean or certified children's play mat. See the CPSIA section before calling the product a "play mat".
4. **Size tolerance is large**: ±3.5 in on a 72 in rug [V]. Artwork must be designed so that nothing important sits near the edge.
5. Rugs print at low effective resolution. Community reports put rug printing around 50–100 dpi effective [3P]. Fine street labels will soften; this must be tested on a physical sample.

## 2. Provider comparison

Indicative base prices exclude shipping and tax. "n/f" = not found in this session.

| | Printful | Printify | Prodigi | Gooten | Gelato | Others (CustomCat, Cloudprinter, Peecho, Lulu, Printique) |
|---|---|---|---|---|---|---|
| **API** | REST v1 stable, v2 in beta with OpenAPI spec [V] | REST v1, OpenAPI spec [V] | REST v4.0, JSON [V] | REST; RecipeID in URL, PartnerBillingKey for orders [V] | REST, API key [V] | Cloudprinter and Peecho have print APIs [V]; CustomCat has an API [3P]; Lulu's API is books only [V]; Printique API not found |
| **Rate limits** | ~120 calls/min per store, lower on heavy endpoints; v2 uses leaky bucket [V] | Catalog 100 req/min; publish 200 per 30 min [V] | n/f | n/f | n/f | n/f |
| **Webhooks** | Yes: order created / updated / shipped / returned etc.; v2 adds catalog price change [V]. Signing scheme not confirmed [U] | Yes, per shop [V]. Signing secret not confirmed [U] | Per-order `callbackUrl` receives status and shipment updates [V]. Signature not found — assume unsigned and re-fetch the order [U] | Yes, order-status webhooks configured in admin [V] | Yes: order status and tracking [V/3P] | Varies |
| **Sandbox** | No separate sandbox found; orders can be left as unconfirmed drafts [U] | None found [V: nothing in docs extracts] | **Yes**: `api.sandbox.prodigi.com/v4.0`, separate keys, no charge, created with every account [V] | Test-mode flag on orders [U] | Draft order type [U] | n/f |
| **Quote endpoint** | Shipping rates and order cost estimate [U] | Shipping cost calculation [U] | Quote endpoint returns price breakdown by SKU, country, shipping method [V] | Price and shipping estimate calls [U] | Quote [U] | — |
| **Rugs (max)** | 48x72 in [V] | 48x72 in [V] | 4'x6' [V] | **7x5 ft** [V] | none found | none found |
| **Posters** | Yes, 33 standard sizes of enhanced matte, from $6.75 [V] | Yes, several suppliers; from USD 4.71 with Premium [V] | Yes; fine art is its strongest category [3P] | Yes (standard, economy, professional prints) [V] | Yes; premium matte is the bestseller [V] | Cloudprinter: posters, wall decoration [V] |
| **Framed** | Yes, from $20.25 [V] | Yes | Yes (strong) [3P] | Yes | Yes [V] | — |
| **Canvas** | Yes, from $13.72; framed canvas too [V] | Yes | Yes | Yes (wraps, hanging canvas) [V] | Yes [V] | — |
| **Puzzles** | Yes: 30–2000 pieces, chipboard, tin box [V] | Yes: 96/252/500/1000 pieces, tin option; from USD 18.00 / EUR 29.25 [V] | Yes per third-party guides [3P] | Yes [V]; "around $20 for 1,000 pieces" per a forum post [3P] | n/f | — |
| **18x24 poster** | $13.15 [3P] | ~$4–12 range across sizes [3P] | n/f | n/f | n/f | — |
| **24x36 poster** | $18.25 [3P] | n/f | n/f | n/f | n/f | — |
| **16x20 canvas** | $28.56 [3P] | n/f | ~$32.00 [3P, source page garbled] | n/f | n/f | — |
| **Largest rug** | $75.25 for 48x72 in [V] | n/f for 48x72 (from EUR 20.93 for smallest) [V] | n/f | n/f for 7x5 ft | — | — |
| **File formats** | JPEG, PNG, SVG [V] | JPG, PNG, SVG; upload by URL or base64 [V] | Assets fetched by URL; formats not confirmed [U] | Image by URL; auto-resized to print area [V] | JPEG, PNG, SVG, PDF [V]; PDF/X-1a or PDF/X-4 [3P] | PDF-centric (Cloudprinter, Peecho, Lulu) [U] |
| **File limits** | 200 MB upload limit in Design Maker [V]; API limit not confirmed | 100 MB JPG/PNG, 20 MB SVG, 30,000 x 30,000 px max — stated for platform uploads, not confirmed for API [3P] | n/f | n/f | n/f | n/f |
| **Resolution / colour** | 150–300 DPI depending on product; **sRGB IEC61966-2.1**; they convert to CMYK [V] | 300 DPI typical; requirements shown per print area [V] | n/f | Templates per product [V] | 300 DPI, 3 mm bleed [3P] | — |
| **Production footprint** | In-house facilities (US, EU, others) [V/U] | Marketplace of third-party suppliers; quality varies by supplier | UK-based with a global lab network [U] | Network of US-based manufacturers [V] | Partners in 32 countries (page copy says 130+ or 250+ partners) [V] | Cloudprinter: 381 print locations in 104 countries [V]; CustomCat: Detroit [U] |
| **US manufacturing** | Yes | Depends on supplier; MWW is US | Has US labs [U] | Yes [V] | Yes, local routing | — |
| **Reputation** | Consistent, higher base prices | Cheapest; quality depends on supplier choice | Best regarded for fine art and framing [3P] | Mixed historically [U] | Good for global wall art | — |

Corporate note: Printful and Printify announced a merger in late 2024 and still run separate platforms and APIs [U — from prior knowledge]. Using one as the fallback for the other reduces integration risk but not company or supplier concentration risk.

Not recommended, with reasons:

- **Lulu xPress / Lulu Direct**: books only [V].
- **Peecho**: photo books and prints; no rugs; no advantage over Prodigi or Gelato for our product set.
- **Cloudprinter**: widest geographic footprint, PDF-centric; worth a second look only when non-US/EU wall-art volume appears.
- **CustomCat**: apparel and housewares focus; rugs, posters and canvas not confirmed.
- **Printique**: professional photo lab quality, but no public order API was found.
- **Spoonflower / WeaveUp**: fabric, not rugs.

## 3. Recommendation

| Product | Primary | Fallback | Why |
|---|---|---|---|
| **Rug 4'x6'** (and 2'x3', 3'x5') | **Printful** | Printify (MWW On Demand) | Published price ($75.25 at 48x72 in), one mature API, in-house support. Printify is cheaper and near-identical, but adds supplier selection and has no sandbox. |
| **Rug 5'x7'** | **Gooten** (7x5 ft) | MWW On Demand direct | Only API-accessible source at this size. Launch only after a sample and a price quote; hide the variant in config until then. |
| **Rug 8'x10' and larger** | MWW On Demand direct (manual or bespoke integration) | OEM batch | Phase 2+. No self-serve API. |
| **Purpose-built play mat** (foam/neoprene) | Contrado, pending API confirmation | OEM | Only if the product needs to be a true play mat; high unit cost. |
| **Poster, framed print** | **Prodigi** | Printful, then Gelato for non-US | Best print and framing reputation, real sandbox, quote endpoint. If minimising integrations matters more than print quality at launch, use Printful for everything and add Prodigi second. |
| **Canvas** | Prodigi | Printful | Same reasoning. |
| **Puzzle** | Printful (30–2000 pieces) | Printify, Prodigi | Widest piece-count range found. |
| **Mugs, shirts, stickers** (later) | Printful | Printify | Standard catalogue items. |

Suggested build order:

1. `MockPrintProvider` (already planned).
2. `PrintfulProvider` — covers 4'x6' rugs, posters, canvas, puzzles with one integration. This is enough to launch in the US.
3. `ProdigiProvider` — wall-art quality and non-US coverage; its sandbox also makes it the best integration to run in CI.
4. `GootenProvider` — only when 5'x7' is confirmed commercially.

Before committing, order physical samples of the same test map from each rug source (Printful 48x72, Printify/MWW 48x72, Gooten 7x5, Prodigi 4x6) and compare colour, label legibility, edge finish and size error. Budget roughly $300–500 for samples [U].

Open questions for provider sales/support:

- Printful and Gooten: exact print-file pixel dimensions and bleed for each rug size; maximum file size over the API; whether rugs can ship outside the US.
- Gooten: 7x5 ft price, ship-from location, shipping cost for an oversize parcel.
- MWW On Demand: API documentation, price list for 5x7 / 8x10, onboarding minimums.
- All rug suppliers: flammability test reports (16 CFR 1630/1631), fibre content label, country of origin, and whether they will support a Children's Product Certificate (see section 7).
- Prodigi and Printful: webhook signing or a recommended way to authenticate callbacks.

## 4. Proposed `PrintProvider` interface

TypeScript-flavoured pseudocode. Provider-specific SKUs never leak into domain code: the product configuration maps our `variantId` to a `ProviderSku` per provider.

```ts
type ProviderId = 'mock' | 'printful' | 'prodigi' | 'printify' | 'gooten';
type Money = { amount: number; currency: string };   // minor units (cents)

interface PrintAreaSpec {
  widthPx: number;            // exact pixels the provider expects, bleed included
  heightPx: number;
  dpi: number;                // nominal; widthPx / dpi = printed inches incl. bleed
  bleedPx: number;            // per edge, already inside widthPx/heightPx
  safeInsetPx: number;        // keep text and landmarks inside this inset
  acceptedFormats: Array<'png' | 'jpeg' | 'pdf'>;
  colorSpace: 'sRGB' | 'CMYK';
  maxFileBytes?: number;
  maxPixelsPerSide?: number;
}

interface CatalogItem {
  providerSku: string;                 // opaque to callers
  productType: 'rug' | 'poster' | 'framed_print' | 'canvas' | 'puzzle' | string;
  sizeLabel: string;                   // e.g. '48x72in'
  trimSizeIn: { width: number; height: number };
  sizeToleranceIn?: number;            // rugs: up to 3.5
  printArea: PrintAreaSpec;
  shipsTo: string[];                   // ISO country codes
  baseCost?: Money;                    // may be absent; use quote()
  attributes: Record<string, string>;  // paper, frame colour, piece count ...
}

interface Address {
  name: string; line1: string; line2?: string; city: string;
  region?: string; postalCode: string; countryCode: string;
  phone?: string; email?: string;
}

interface OrderLine {
  providerSku: string;
  quantity: number;
  artwork: ArtworkRef;
  attributes?: Record<string, string>;
}

interface ArtworkRef {
  url: string;                 // signed HTTPS GET URL, no auth headers needed
  urlExpiresAt: Date;
  format: 'png' | 'jpeg' | 'pdf';
  widthPx: number; heightPx: number;
  bytes: number;
  sha256: string;
  iccProfile: 'sRGB' | string;
}

interface Quote {
  items: Array<{ providerSku: string; unitCost: Money; quantity: number }>;
  shippingOptions: Array<{
    id: string; label: string; cost: Money;
    minDays?: number; maxDays?: number;
  }>;
  tax?: Money;                 // provider-charged tax on our cost, if any
  total: Money;                // for the cheapest shipping option
  expiresAt?: Date;
}

interface ArtworkValidation {
  ok: boolean;
  errors: Array<{ code: ArtworkErrorCode; message: string }>;
  warnings: Array<{ code: string; message: string }>;
}
type ArtworkErrorCode =
  | 'WRONG_DIMENSIONS' | 'WRONG_ASPECT' | 'LOW_RESOLUTION' | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT' | 'WRONG_COLOR_SPACE' | 'HAS_TRANSPARENCY'
  | 'URL_UNREACHABLE' | 'URL_EXPIRES_TOO_SOON';

type OrderStatus =
  | 'draft' | 'submitted' | 'on_hold' | 'in_production'
  | 'shipped' | 'delivered' | 'cancelled' | 'failed' | 'returned';

interface OrderState {
  providerOrderId: string;
  status: OrderStatus;
  rawStatus: string;                       // provider's own value, for support
  shipments: Array<{
    carrier?: string; trackingNumber?: string; trackingUrl?: string;
    shippedAt?: Date; lineRefs?: string[];
  }>;
  cost?: { items: Money; shipping: Money; tax?: Money; total: Money };
  issues: Array<{ code: string; message: string }>;   // e.g. artwork rejected
  updatedAt: Date;
}

interface SubmitOrderInput {
  idempotencyKey: string;        // our order id; becomes the provider's external id
  recipient: Address;
  lines: OrderLine[];
  shippingOptionId?: string;
  packingSlip?: { brandName?: string; message?: string };
  testMode?: boolean;            // sandbox / draft; never fulfilled
}

type ProviderEvent =
  | { type: 'order.status_changed'; providerOrderId: string; state: OrderState }
  | { type: 'order.shipped'; providerOrderId: string; state: OrderState }
  | { type: 'order.failed'; providerOrderId: string; reason: string }
  | { type: 'catalog.changed'; providerSkus?: string[] }
  | { type: 'ignored'; reason: string };

interface PrintProvider {
  readonly id: ProviderId;
  readonly capabilities: {
    sandbox: boolean;
    signedWebhooks: boolean;      // false => always confirm via getOrderStatus
    cancelWindow: 'until_production' | 'short_grace' | 'none';
    acceptsPdf: boolean;
  };

  listCatalog(filter?: { productType?: string; countryCode?: string }): Promise<CatalogItem[]>;
  quote(input: { recipient: Pick<Address, 'countryCode' | 'region' | 'postalCode'>;
                 lines: Array<Pick<OrderLine, 'providerSku' | 'quantity'>> }): Promise<Quote>;
  validateArtwork(providerSku: string, artwork: ArtworkRef): Promise<ArtworkValidation>;
  submitOrder(input: SubmitOrderInput): Promise<OrderState>;
  getOrderStatus(providerOrderId: string): Promise<OrderState>;
  cancelOrder(providerOrderId: string): Promise<{ cancelled: boolean; reason?: string }>;
  parseWebhook(req: { headers: Record<string, string>; rawBody: Buffer }): Promise<ProviderEvent[]>;
}
```

Design rules that follow from the research:

- **`validateArtwork` runs locally first.** Check dimensions, aspect, byte size and colour profile against `PrintAreaSpec` before calling any provider. Provider-side validation is asynchronous and often only surfaces as an order going "on hold".
- **`submitOrder` must be idempotent.** Pass our order id as the provider's external/merchant reference and look up by it before creating, because several of these APIs have no idempotency header [U].
- **Never trust a webhook body on its own** where `signedWebhooks` is false (assume this for Prodigi and Gooten until proven otherwise). Treat the callback as a hint, call `getOrderStatus`, and act on that. Also run a polling reconciler for orders with no update in N hours.
- **`quote` is the source of truth for cost and shipping** at checkout; cache briefly. Do not ship static base prices in config except as display fallbacks.
- **Catalog changes are events.** Printful v2 emits a catalog price-change webhook [V]; for others, re-sync nightly and alert on a price or availability change for any configured variant.
- **Routing lives above the interface**: a small `FulfilmentRouter` picks the provider per line from config (product type, destination country, provider health), which is what makes "primary + fallback per product type" a config change.
- **Cancellation is best-effort.** Personalised rugs are non-returnable in practice; keep a short internal hold (for example 30–60 minutes after payment) before calling `submitOrder` so customers can fix an address or cancel for free.

## 5. Artwork specification guidance

### 5.1 Target pixel sizes

One master render per aspect ratio, then derive per-product files by downsampling. Never upscale.

| Product | Trim size | Suggested render DPI | Pixels (trim, before bleed) |
|---|---|---|---|
| Poster 18x24 | 18x24 in (3:4) | 300 | 5400 x 7200 |
| Poster 24x36 | 24x36 in (2:3) | 300 | 7200 x 10800 |
| Canvas 16x20 | 16x20 in (4:5) | 300 (150 acceptable) | 4800 x 6000 plus wrap |
| Rug 4'x6' | 48x72 in (2:3) | 150 (300 = 14400 x 21600) | 7200 x 10800 |
| Rug 5'x7' | 60x84 in (5:7) | 150 | 9000 x 12600 |
| Puzzle 1000 pc | provider template | 300 | provider template |

Points to note:

- **14400 x 21600 px is exactly 48x72 in at 300 DPI.** That is the 4'x6' rug at a resolution the rug process cannot reproduce. Printful's own guidance is 150–300 DPI depending on product and that going beyond 300 adds nothing [V]. Keep 14400 x 21600 as the internal 2:3 master (it also yields the 24x36 poster by an exact 2x downsample), but send the rug supplier whatever its template asks for, most likely well below that. Confirm each provider's exact rug pixel dimensions; they were not found in this session.
- **Aspect ratios differ**: 4'x6' and 24x36 are 2:3, 18x24 is 3:4, 16x20 is 4:5, 5'x7' is 5:7. The map must be re-composed (re-cropped from geodata), not stretched, per aspect. The renderer should take the aspect ratio as an input.
- Provider pixel specs in `PrintAreaSpec` override this table.

### 5.2 Bleed and safe area

| Product | Bleed | Safe inset for text and landmarks |
|---|---|---|
| Posters, framed prints | 0.125 in (3 mm) per edge unless the template says otherwise [3P for Gelato's 3 mm] | 0.25–0.5 in; framed prints lose a further ~0.25 in under the frame lip [U] |
| Canvas | Wrap of 1.5–2 in per edge depending on stretcher depth (Gelato: +2 cm per edge [3P]) — extend the map or use a mirrored/solid edge | 0.5 in inside the front face |
| Rugs | Follow the provider template; plan for at least 1 in | **4 in** from every edge, because the cut size varies by up to ±3.5 in on the long side [V] and the hem takes more |
| Puzzles | Provider template | 0.5 in; avoid tiny text across cut lines |

Design implication for rugs: use a full-bleed background (roads and land colour running off every edge) and a decorative border or title block well inside the safe inset. A thin frame line near the edge will look visibly off-centre on some rugs.

### 5.3 Colour: sRGB, not CMYK

- **Deliver 8-bit sRGB (IEC61966-2.1) with the profile embedded.** Printful states this explicitly and converts to its press profile itself [V]. Dye sublimation and inkjet RIPs across these providers expect RGB input [U]. Sending our own CMYK conversion would bake in the wrong press profile.
- Only produce CMYK PDF/X for a provider that asks for it (Cloudprinter-style offset/digital workflows).
- No transparency in final print files: flatten onto an opaque background, or the provider may print transparent pixels as white or black.
- Build the palette for the worst device. Polyester chenille sublimation has a smaller gamut and lower contrast than poster paper: saturated teals, bright oranges and deep blacks shift, and light pastels wash out. Options: a slightly boosted "rug" palette variant chosen after samples, and a minimum contrast rule between adjacent map features.
- Minimum feature sizes for rugs (starting point to validate on samples [U]): line weights of at least 3 mm, text cap height of at least 12 mm, no hairlines, no small reversed-out text.

### 5.4 PNG, JPEG or PDF

| Format | Use when | Caveats |
|---|---|---|
| **PNG** (8-bit RGB, no alpha) | Default. Flat-colour illustrated maps compress well and stay lossless. | Size is unpredictable if the style has gradients, textures or noise; can exceed provider caps. |
| **JPEG** (quality 92–95, 4:4:4 chroma) | Fallback when the PNG exceeds a size cap. | Hard maximum of 65,535 px per side (fine here). Slight ringing on sharp vector edges; disable chroma subsampling. |
| **PDF** (vector, PDF/X-4) | Providers that accept PDF (Gelato [V], Prodigi and Cloudprinter [U]) and when the map is rendered from vector data. | Much smaller files and resolution independence, but font embedding and renderer differences add risk. Printful and Printify list JPEG/PNG/SVG, not PDF [V]. |

Recommendation: PNG as the canonical deliverable; automatic JPEG fallback when `bytes > maxFileBytes`; vector PDF as a later optimisation for PDF-capable providers.

### 5.5 Producing and delivering a 14400 x 21600 px file

- **Memory**: 14400 x 21600 = 311 megapixels; uncompressed that is about 0.93 GB as RGB and 1.24 GB as RGBA. Render in tiles or strips (for example 2048 px tiles) and stream-encode with libvips or equivalent rather than holding the full bitmap in a canvas. Size the render worker at 4–8 GB RAM.
- **File size**: expect roughly 30–150 MB as PNG depending on style [U — measure on real maps]. Known caps: Printful 200 MB in its Design Maker [V]; Printify 100 MB and 30,000 px per side for platform uploads [3P]. Design to stay **under 100 MB**, with the JPEG fallback as the guard.
- **Delivery by signed URL**:
  - Plain HTTPS GET with no custom headers and no cookies; serve `Content-Type` and `Content-Length`; support `HEAD` and range requests; avoid redirects.
  - Expiry long enough for asynchronous pickup and re-fetch at production time: at least 72 hours, ideally 7 days. Keep the ability to re-issue a URL and update the order.
  - File name without personal data (use an opaque id, not the customer's address).
  - Where a provider supports it, upload once to the provider's file library and reference the returned id (Printful file library, Printify uploads by URL or base64 [V]); base64 is impractical at this size, use the URL form.
- **Integrity**: store `sha256`, pixel dimensions and byte size with the order; re-check them in `validateArtwork` so a truncated upload is caught before submission.
- **Retention**: keep the print master for a reprint window (for example 90 days), then delete it and keep the render recipe (geodata snapshot reference, style version, parameters) so it can be regenerated. This matters for storage cost (see `docs/research/COSTS_AND_PAYMENTS.md`).
- **Proofing**: generate the customer preview from the same master by downsampling, with the bleed and safe-area overlay available, so what is approved is what is sent.

## 6. Risks

| Risk | Detail | Mitigation |
|---|---|---|
| **Rug colour accuracy** | Sublimated chenille has a narrower gamut, visible pile texture and batch variation; on-screen sRGB preview will look more vivid than the product. | Physical samples before launch; rug-specific palette; "colours may vary" copy; preview with a fabric-texture simulation; reprint budget. |
| **Rug detail loss** | Effective resolution is far below 300 DPI [3P]; small labels blur. | Rug style with larger type and thicker lines; per-product label density; minimum-size lint in the renderer. |
| **Size tolerance** | ±3.5 in on 72 in [V]. | 4 in safe inset, full-bleed background, no edge frames. |
| **File-size and pixel caps** | Caps are poorly documented for APIs (200 MB and 100 MB figures come from UI docs). An oversize file may fail only after order submission. | Stay under 100 MB; JPEG fallback; `validateArtwork` against configured caps; confirm caps with each provider. |
| **Signed-URL expiry** | Provider fetches or re-fetches after the URL has expired, order goes on hold. | Long expiry, monitoring for artwork-fetch failures, endpoint to refresh artwork. |
| **No sandbox (Printful, Printify)** | Integration bugs can create real, billable orders. | Draft/unconfirmed orders in non-production; contract tests against Prodigi sandbox and the mock; a hard `testMode` guard keyed to environment. |
| **Unsigned webhooks** | Spoofed status updates. | Unguessable callback path, re-fetch order state, IP allow-list if published. |
| **Supplier concentration** | Printful, Printify and MWW may be the same rug line; Printful and Printify are merging. | Qualify Gooten or Prodigi as a genuinely independent second source. |
| **5'x7' availability** | Only Gooten and MWW direct; neither price is public. | Keep the variant behind a config flag; do not promise it in marketing until quoted and sampled. |
| **Shipping cost and geography** | Oversize parcels; Printful ships rugs within the US only [V]; Printify offers economy shipping only for the smallest rug [V]. | Quote shipping live at checkout; restrict rug destinations per provider in config. |
| **Returns and misprints** | Personalised goods are not resaleable; a rug reprint costs $75+ plus shipping. | Clear proof-approval step; provider reprint policy for defects; margin reserve of a few percent of rug revenue. |
| **Price drift** | Base costs change without notice. | Nightly catalogue sync, price-change webhook where available, margin alert. |
| **Map data licensing on physical goods** | OpenStreetMap-derived artwork needs visible attribution; other data sources may forbid print resale. | Print a small "© OpenStreetMap contributors" credit inside the safe area; legal check on every data layer. Flag for legal review. |

## 7. Children's product safety (US) — flag for legal review

This is not legal advice. It is a list of issues counsel must resolve before anything is sold as a kids' play mat or rug in the US.

- **A rug designed or marketed primarily for children 12 and under is a "children's product" under the CPSIA.** Marketing decides this as much as construction: the words "kids' play mat", nursery imagery and toy cars in product photos all point that way.
- Children's products require **third-party testing at a CPSC-accepted laboratory**, a **Children's Product Certificate (CPC)** issued by the US manufacturer or importer, and **permanent tracking information** on the product and packaging (manufacturer, date and place of manufacture, batch) (CPSC carpets and rugs guidance).
- **Flammability**: carpets and rugs fall under 16 CFR part 1630, and small carpets and rugs under 16 CFR part 1631. CPSC states that a baby play mat may meet the definition of a carpet or small carpet and then be in scope. Which part applies depends on size: the small-carpet definition is, as we understand it, no dimension over 6 ft and area up to 24 sq ft [U], which puts a 4'x6' rug at the boundary and a 5'x7' rug in part 1630. For a children's rug the flammability test itself must be done by a CPSC-accepted lab.
- **Lead and phthalates**: lead content limits apply to children's products; some dyed textiles have testing determinations that reduce the burden [U]. If the mat counts as a **toy** (intended for play) rather than a floor covering, **ASTM F963** and phthalate limits may also apply [U]. Backing materials and any anti-slip coating are the likely problem components.
- **Who is the manufacturer?** In print-on-demand the supplier makes the rug and we brand and sell it. Whether the supplier or our company must issue the CPC, and whether a supplier's general test report covers each personalised unit, is unclear and is the central question for counsel. Ask every rug supplier now for test reports and whether they support CPCs. Generic print-on-demand rugs are, as far as we could find, sold as general-use home decor, not certified children's products.
- **Small-batch relief** exists for registered small manufacturers for some third-party testing requirements, but we found no clear statement that it covers carpet flammability; do not rely on it without confirmation.
- Other items for the same review: California Proposition 65 warnings, textile fibre content and country-of-origin labelling, slip hazard on hard floors (the chenille rugs found here have a woven or plain backing, not a guaranteed non-slip one), care labelling (one source reports dry-clean only [3P]), and the equivalent regimes for the EU/UK (General Product Safety Regulation, toy safety rules) before selling there.

Practical options to put to counsel:

1. Sell the rug as a **general-use decorative area rug** ("neighbourhood map rug") with no child-directed marketing, and decide separately whether a certified kids' line is worth it.
2. Sell a **certified children's product**: choose one supplier and one fixed construction, commission third-party tests, set up CPC and tracking-label processes. Likely needs MWW direct or an OEM, not a marketplace supplier.
3. Start with wall art and puzzles (puzzles for children raise the same CPSIA questions; adult-marketed 500–1000 piece puzzles less so) and add rugs once option 1 or 2 is cleared.

## 8. Sources

Rugs and play mats
- Printful custom rugs and area rug product pages: https://www.printful.com/custom-rugs , https://www.printful.com/custom/home-living/all/area-rug
- Printify area rugs (MWW On Demand), rugs category and custom rugs: https://printify.com/app/products/438/generic-brand/area-rugs , https://printify.com/app/products/home-and-living/rugs-and-mats , https://printify.com/custom-rugs
- Prodigi area rugs and outdoor area rugs: https://www.prodigi.com/products/home-and-living/rugs-and-blankets/area-rugs/ , https://www.prodigi.com/products/home-and-living/rugs-and-blankets/outdoor-area-rugs/
- Gooten area rugs: https://gooten.com/print-on-demand/area-rugs/
- MWW On Demand area rugs and supplier profile: https://mwwondemand.com/home-decor/area-rugs/ , https://app.makersrow.com/mww
- Third-party rug supplier round-ups: https://passivemarketeer.com/print-on-demand-rugs/ , https://www.commercecaffeine.com/blog/print-on-demand-rugs
- Contrado play mats, rugs, API: https://au.contrado.com/custom-playmats , https://www.contrado.com/custom-rugs , https://au.contrado.com/print-on-demand-api
- PrintKK rugs: https://www.printkk.com/custom-rugs , https://www.printkk.com/product/info/anti-slip-carpets
- Threadless premium rug cost range: https://willfullyzen.threadless.com/artist-shops/signup/schools/premium-rug
- Rug print resolution discussion: https://community.zazzle.com/t5/general-zazzle-discussion/feedback-for-new-product-area-rugs/m-p/98984
- OEM listings: https://m.made-in-china.com/catlist/Carpet-Rug-Mat-2103000000-38.html

APIs
- Printful API v1 and v2: https://developers.printful.com/docs/ , https://developers.printful.com/docs/v2-beta/ ; rate limits: https://support.printful.com/hc/en-us/articles/41396598920721-Why-am-I-getting-a-Too-many-requests-per-minute-error
- Printify API: https://developers.printify.com/ ; uploads: https://apis.io/apis/printify/printify-uploads-api/
- Prodigi API: https://www.prodigi.com/print-api/docs/reference , https://prodigi.com/print-api , https://apis.io/apis/prodigi/prodigi-orders-api/
- Gooten API and webhooks: https://gooten.com/api-documentation/getting-started/ , https://gooten.com/api-documentation/order-status-webhooks/
- Gelato API: https://developers.gelato.com/docs/get-started
- Lulu, Peecho, Cloudprinter: https://www.lulu.com/sell/sell-on-your-site/print-api , https://www.peecho.com/print-api , https://www.cloudprinter.com/print-api

File specifications
- Printful print file guidance: https://www.printful.com/blog/everything-you-need-to-know-to-prepare-the-perfect-printfile , https://support.printful.com/hc/en-us/articles/41396495537553 , https://help.printful.com/hc/en-us/articles/28491464259740-How-should-I-prepare-my-print-file-for-the-best-results
- Printify file guidance: https://help.printify.com/hc/en-us/articles/4483617936657 , https://printify.com/guide/design-guide/file-size/ ; third-party upload limits: https://ecommerce-platforms.com/?p=102358
- Gelato print file and poster pages: https://www.gelato.com/glossary/print-file , https://www.gelato.com/products/posters-frames ; third-party: https://polotno.com/sdk/product/integrations/gelato

Prices and catalogue
- Printful posters, canvas, framed, puzzles: https://www.printful.com/custom-posters , https://www.printful.com/custom/wall-art/canvas-prints/canvas-in , https://www.printful.com/custom/toys-and-games/personalized/jigsaw-puzzle-with-tin
- Third-party 2026 price comparisons (source of the $13.15 / $18.25 / $28.56 Printful figures): https://apparelhub.ai/blog/best-print-on-demand-supplier-for-posters-wall-art , https://apparelhub.ai/blog/best-print-on-demand-supplier-for-canvas-prints
- Printify posters and puzzles: https://printify.com/app/products/home-and-living/posters , https://printify.com/app/products/596/generic-brand/puzzle-96-252-500-1000-piece , https://printify.com/app/products/532/generic-brand/jigsaw-puzzle-252-500-1000-piece
- Prodigi review with indicative prices: https://ecommerce-platforms.com/articles/prodigi-review
- Gooten puzzles and prints: https://gooten.com/print-on-demand/puzzles/ , https://gooten.com/print-on-demand/standard-prints/

Safety
- CPSC carpets and rugs FAQ: https://www.cpsc.gov/FAQ/Carpets-and-Rugs
- Third-party overview: https://www.compliancegate.com/carpets-rugs-regulations-united-states/
- Federal Register notice on accreditation for carpet flammability testing: https://www.govinfo.gov/content/pkg/FR-2010-07-21/pdf/2010-17724.pdf
