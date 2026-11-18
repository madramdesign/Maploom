# Costs and payments

Status: research draft, 2026-11-18. Companion to `docs/architecture/PRINTING.md`.

## 0. How to read this document

**Evidence levels.** Vendor pricing pages could not be opened directly from the research session; figures come from web-search extracts of vendor pages or third-party trackers. Tags:

- **[V]** — vendor's own page or documentation (via search extract).
- **[3P]** — third-party tracker or blog; several were dated mid to late 2026.
- **[U]** — unverified: prior knowledge or estimate. Check before relying on it.

2026 has seen real price movement (Hetzner cloud increases in June, Fly.io RAM repricing in October, image-model retirements), so treat every infrastructure number as perishable.

**Headline.** At every volume, the money goes to (1) print cost and shipping, (2) payment and tax fees at about 3.8% of revenue, and (3) AI illustration if it is generated for every map. Hosting, database, storage and email together stay under roughly 1% of revenue at 10,000 maps per month. The useful engineering work is therefore in limiting image generation and reprints, not in shaving hosting.

---

## Part A — Payments

### A1. Stripe

| Item | Figure | Evidence |
|---|---|---|
| US online card payments | 2.9% + $0.30 | [3P, consistent across sources, one checked against stripe.com in Sept 2026] |
| International cards | +1.5% (some sources list 3.9% + $0.30 total; they conflict) | [3P] |
| Currency conversion | +1% | [3P] |
| Stripe Tax | 0.5% per transaction where tax is calculated | [3P] |
| Dispute fee | $15 per chargeback | [3P] |
| Managed Payments (Stripe as merchant of record) | +3.5% on top of payment fees, i.e. about 6.4% + $0.30 | [3P quoting Stripe]. Eligibility for physical goods not confirmed [U]; assume not available for our products until checked. |

**Checkout vs Payment Element**

| | Stripe Checkout (hosted or embedded) | Payment Element (custom form) |
|---|---|---|
| What it is | Stripe-rendered payment page or embedded form driven by a Checkout Session | Embeddable UI component inside our own checkout page |
| Build effort | Low: create a session server-side, redirect or mount | Higher: we own layout, address collection, error and retry states, testing |
| Built in | Address collection, shipping options, promo codes, Stripe Tax, Apple Pay / Google Pay / Link, receipts, localisation | Payment methods and wallets; the rest is ours unless paired with Checkout Sessions |
| Control over UX | Limited branding | Full |
| PCI scope | Lowest | Low (card fields are Stripe-hosted iframes) |

Stripe's current documentation recommends pairing the Payment Element with the **Checkout Sessions API** rather than raw Payment Intents for most integrations [V]. That gives a clean upgrade path: start with Checkout, later embed the Payment Element on our own page while keeping the same server-side session model, line items and tax handling.

**Fit with this product.** Each order has a personalised line item with a preview image, a shipping address that determines print-provider shipping cost, and tax. With Checkout we pass a dynamic line item (`price_data` with our configured price), a shipping rate computed from the print provider's `quote`, and metadata linking the session to our map and order ids.

**Stripe Tax.** It calculates and collects US sales tax and VAT at checkout. It does not by itself register us in states or file returns; registration is our job and filing is done manually or via a filing partner [U]. Physical goods create sales-tax obligations once economic-nexus thresholds are passed in a state; get accounting advice before volume grows.

**Webhook verification (must-do list)**

- Verify every event with the `Stripe-Signature` header and the endpoint's signing secret using the SDK's `constructEvent` on the **raw request body** (not parsed JSON). SDKs reject timestamps outside a default tolerance of 300 seconds [V: SDK references].
- Make handlers idempotent: store processed `event.id`s; Stripe retries and may deliver out of order.
- Return 2xx quickly and do the work in a queue job.
- Trigger fulfilment from `checkout.session.completed` (and `checkout.session.async_payment_succeeded` for delayed methods), never from the browser redirect.
- Also handle `charge.refunded`, `charge.dispute.created` and `payment_intent.payment_failed`.
- Use separate endpoint secrets per environment; rotate on leak.
- Only call `PrintProvider.submitOrder` after payment success and artwork validation; keep a short cancellation hold first (see the printing document).

### A2. Alternatives

| Option | Fees | Physical goods | Assessment |
|---|---|---|---|
| **Paddle** | 5% + $0.50, merchant of record [3P] | Not suitable: SaaS and digital goods only [3P] | Rejected. |
| **Lemon Squeezy** | 5% + $0.50, merchant of record [3P] | Minimal or no support for physical products [3P] | Rejected. |
| **Shopify** (headless via Storefront API, or hosted store) | Basic about $39/month ($29 billed annually); 2.9% + $0.30 with Shopify Payments; +2% if a third-party gateway is used [3P]. Headless availability on Basic is unclear in sources [3P, conflicting] | Yes, built for it | Brings tax, fraud tools, order admin and ready-made Printful/Printify/Gelato apps. But the product is a custom map editor with per-order artwork, and the plan is our own `PrintProvider` abstraction; Shopify would duplicate order state and constrain checkout. Reasonable only if the team wants Shopify's back office more than control. |
| **PayPal** | PayPal Checkout 3.49% + $0.49; advanced card processing 2.89% + $0.29; standard cards 2.99% + fixed fee; dispute fee $15 [3P; PayPal publishes a dated US fee PDF] | Yes | Higher cost than Stripe on a $60–180 basket. Worth adding later as a second button if customers ask; some buyers convert better with it [U]. Whether PayPal can be offered through Stripe for a US business is not confirmed [U]. |

### A3. Recommendation

1. **Stripe Checkout (Checkout Sessions API) + Stripe Tax**, behind the planned `PaymentProvider` interface. Wallets (Apple Pay, Google Pay, Link) come enabled.
2. Move to the embedded Payment Element on Checkout Sessions when the checkout page needs custom layout (for example proof approval and upsells on one page).
3. Do not use a merchant-of-record provider: the digital-only ones cannot sell rugs, and Stripe's Managed Payments would nearly double the fee rate even if eligible.
4. Add PayPal only on evidence of demand.
5. `PaymentProvider` surface to keep small: `createCheckout`, `getPayment`, `refund`, `parseWebhook`. Keep tax calculation inside the provider.

Fee at the assumed prices (Stripe US card + Stripe Tax):

| Basket | Card fee (2.9% + $0.30) | Stripe Tax (0.5%) | Total | Share of basket |
|---|---|---|---|---|
| $60 poster | $2.04 | $0.30 | $2.34 | 3.9% |
| $180 play mat | $5.52 | $0.90 | $6.42 | 3.6% |
| $84 blended (see B1) | $2.74 | $0.42 | $3.16 | 3.8% |

(Fees are charged on the total including shipping and tax collected; the table uses the product price only, so real fees are slightly higher.)

---

## Part B — Operating-cost model

### B1. Assumptions (all of them)

Funnel and pricing

- A **map** is one generated neighbourhood map: one geocode, one data fetch, one LLM landmark ranking, low-resolution previews. The volume tiers count maps generated.
- **10% of maps become a paid order** [U — pure assumption; the single most important number to replace with real data]. Orders per month: 1 / 10 / 100 / 1,000.
- Order mix 80% posters at **$60**, 20% play mats at **$180**; blended **AOV $84** [assumption].
- Print cost and shipping (COGS) are excluded from the opex tables and discussed in B5.

Rendering and storage

- High-resolution print render happens **only for paid orders**; about 4 vCPU-minutes each on a worker with 4–8 GB RAM [U — must be benchmarked; 14400 x 21600 px is 311 megapixels, about 1.2 GB uncompressed RGBA].
- Preview renders: about 0.5 vCPU-minute per map in total [U].
- Print file about **100 MB** (range 50–150 MB), kept **90 days** then deleted and regenerated on demand. Previews about 10 MB per map, kept 30 days.
- Each print file is downloaded about twice (provider fetch plus one retry or re-fetch): 0.2 GB egress per order.

Services

- Email: 5 transactional emails per order plus 0.5 per map [assumption].
- Geodata: public OSM-based services (Nominatim/Photon/Overpass public instances within their usage policies) at low volume; self-hosted at high volume.
- LLM ranking call: about 6,000 input tokens (candidate landmarks with tags) and 1,000 output tokens per map [assumption].
- Optional illustrations: **8 generated images per map** [assumption], no caching, in the base case.

Unit prices used

| Item | Price used | Evidence |
|---|---|---|
| Vercel Pro | $20 per seat per month, includes $20 usage credit | [3P, consistent] |
| Fly.io | RAM $6.00 per GB-month after the 1 Oct 2026 update; smallest always-on machine $2.19/month | [V/3P] |
| Render | Cheapest web service or worker instance $7/month; Standard $25/month; no free workers | [V/3P] |
| Railway | Usage-based; about $5/month minimum on the entry plan | [3P, weak] |
| Hetzner Cloud | Prices rose sharply in June 2026; US CCX13 (2 dedicated vCPU, 8 GB) reported at $50.99/month, up from $19.99 | [3P] |
| Neon Postgres | Launch plan compute $0.106 per CU-hour, no monthly minimum | [V]. PostGIS support assumed [U] |
| Supabase | Pro $25/month, 8 GB database included | [3P]. PostGIS support assumed [U] |
| Upstash Redis | $0.20 per 100K commands, storage $0.25/GB after 1 GB free, free tier about 500K commands/month | [V] |
| Cloudflare R2 | $0.015 per GB-month, **no egress fee**; 10 GB free tier assumed [U] | [V via 3P, dated Nov 2026] |
| AWS S3 Standard | $0.023 per GB-month, egress about $0.09/GB | [3P] |
| Backblaze B2 | $0.006 per GB-month, free egress up to 3x stored data then $0.01/GB | [3P] |
| Resend | Free tier (about 3,000 emails/month [U]); paid tier for 50,000 emails reported as $20 or $35 — sources conflict | [3P] |
| Postmark | $15/month for 10,000 emails | [3P, consistent] |
| Amazon SES | $0.10 per 1,000 emails | [3P] |
| Sentry | Free developer plan; Team plan about $26/month | [U — not confirmed in this session] |
| Claude Haiku 5.5 | $0.10 / $0.50 per million input / output tokens | [V: Anthropic model table, cached 2026-11-03] |
| Claude Sonnet 5.5 | $2.00 / $10.00 per million tokens | [V] |
| Claude Opus 5.5 | $4.00 / $20.00 per million tokens | [V] |
| Batch API | 50% discount, asynchronous | [V] |
| Google Gemini 2.5 Flash Image | $0.039 per image ($0.0195 batch); model reported retiring 2027-03-15 | [3P] |
| Google "Nano Banana 2" / "Nano Banana Pro" | about $0.067 per 1K image / $0.134 per 1K–2K image, $0.24 at 4K | [3P, sources differ] |
| OpenAI GPT Image 1.5 | 1024 x 1024: $0.009 low, $0.034 medium, $0.133 high; reported retiring 2026-12-01 | [3P] |
| OpenAI GPT Image 2 | Token-billed, $30 per million image output tokens; roughly $0.006 to $0.21 per 1024 x 1024 image by quality | [3P] |
| Black Forest Labs FLUX | about $0.01–$0.08 per image depending on model; FLUX 1.1 pro about $0.04 per megapixel | [3P] |
| Imagen 4 | Reported shut down on the Gemini API on 2026-08-17 — do not plan on it | [3P] |

Image-model prices are the least reliable numbers in this document: models are being retired on a months-long cycle and every figure above is from third-party trackers. Re-price at build time.

### B2. Per-unit costs

| Cost | Per map generated | Per paid order |
|---|---|---|
| LLM landmark ranking, Haiku 5.5 | $0.0011 | — |
| LLM landmark ranking, Sonnet 5.5 | $0.022 | — |
| LLM landmark ranking, Opus 5.5 | $0.044 | — |
| Illustrations, 8 images at $0.034 (GPT Image 1.5 medium) | $0.27 | — |
| Illustrations, 8 images at $0.039 (Gemini 2.5 Flash Image) | $0.31 | — |
| Illustrations, 8 images at $0.134 (premium tier) | $1.07 | — |
| Preview render CPU | well under $0.01 | — |
| Print render CPU | — | about $0.01–0.05 [U] |
| Storage on R2 (100 MB for 3 months) | — | $0.0045 |
| Egress on R2 / on S3 (0.2 GB) | — | $0 / $0.018 |
| Email | under $0.001 | under $0.005 |
| Payment + tax fees at $84 | — | $3.16 |

LLM arithmetic: 6,000 input tokens x price + 1,000 output tokens x price. For Haiku 5.5: $0.0006 + $0.0005 = $0.0011. Haiku pricing applies to prompts up to 100K tokens.

### B3. Monthly cost by volume tier

Ranges reflect provider choice. "AI images" is optional and shown separately because it changes the picture.

#### 10 maps per month (about 1 order, about $84 revenue)

| Line | Choice | Monthly cost |
|---|---|---|
| Web hosting | Vercel Pro, 1 seat (the free tier is not for commercial use [U]) | $20 |
| Render worker | On-demand / scale-to-zero machine (Fly.io or similar), 4 GB | $0–5 |
| Postgres + PostGIS | Neon Launch, scale to zero | $0–5 |
| Redis / queue | Upstash free tier | $0 |
| Object storage + egress | R2 within free tier | $0 |
| Email | Resend free tier | $0 |
| Error tracking | Sentry free plan | $0 |
| Geodata | Public OSM services | $0 |
| LLM ranking | Haiku 5.5 to Sonnet 5.5 | $0.01–0.22 |
| **Infrastructure subtotal** | | **about $20–30** |
| Payment + tax fees | 1 order | $3 |
| Optional AI images | 80 images | $3–11 |

At this scale the cost is the fixed platform fee. A single $5–10 VPS running everything would work too.

#### 100 maps per month (about 10 orders, about $840 revenue)

| Line | Choice | Monthly cost |
|---|---|---|
| Web hosting | Vercel Pro | $20 |
| Render worker | On-demand machine | $5–10 |
| Postgres + PostGIS | Neon Launch | $5–20 |
| Redis / queue | Upstash free tier | $0 |
| Object storage + egress | R2 (about 4 GB) | $0 |
| Email | Free tier (about 100 emails) | $0 |
| Error tracking | Free plan | $0 |
| Geodata | Public OSM services | $0 |
| LLM ranking | Haiku 5.5 to Sonnet 5.5 | $0.11–2.20 |
| **Infrastructure subtotal** | | **about $30–55** |
| Payment + tax fees | 10 orders | $32 |
| Optional AI images | 800 images | $27–107 |

#### 1,000 maps per month (about 100 orders, about $8,400 revenue)

| Line | Choice | Monthly cost |
|---|---|---|
| Web hosting | Vercel Pro (1–2 seats) | $20–40 |
| Render worker | One small always-on dedicated worker (2 vCPU / 8 GB class) or on-demand | $25–51 |
| Postgres + PostGIS | Neon at about 0.25 CU continuous (730 h x 0.25 x $0.106 = $19) or Supabase Pro | $19–25 |
| Redis / queue | Upstash pay-as-you-go | $0–10 |
| Object storage + egress | R2: about 30 GB print files + 10 GB previews | about $0.50 |
| Email | About 1,000 emails: free tier, or Postmark $15 | $0–15 |
| Error tracking | Free or Team plan | $0–26 |
| Geodata | Public OSM services, with caching | $0 |
| LLM ranking | Haiku 5.5 to Sonnet 5.5 | $1.10–22 |
| **Infrastructure subtotal** | | **about $70–190** |
| Payment + tax fees | 100 orders | $316 |
| Optional AI images | 8,000 images | $272–1,072 |

#### 10,000 maps per month (about 1,000 orders, about $84,000 revenue)

| Line | Choice | Monthly cost |
|---|---|---|
| Web hosting | Vercel Pro with some usage overage and 2–3 seats | $40–100 |
| Render workers | Demand is about 150 vCPU-hours/month (10,000 x 0.5 min + 1,000 x 4 min); 1–2 dedicated 2–4 vCPU / 8 GB workers for headroom and peaks | $51–150 |
| Postgres + PostGIS | Neon at 0.5–1 CU continuous ($39–77) or Supabase Pro plus compute add-on | $40–80 |
| Redis / queue | Upstash pay-as-you-go or $10 fixed plan | $10–20 |
| Object storage + egress | R2: 300 GB print files ($4.35) + 100 GB previews ($1.50) | about $6 |
| Email | About 10,000 emails: Postmark $15, Resend paid tier, or SES about $1 | $1–35 |
| Error tracking | Team plan, possibly more events | $26–80 |
| Geodata | Self-hosted Photon (planet index about 95 GB on SSD, 8 GB Java heap [V]) and an Overpass extract or regional instance on a 16–32 GB VPS | $50–120 [U] |
| LLM ranking | Haiku 5.5 $11; Sonnet 5.5 $220 | $11–220 |
| **Infrastructure subtotal** | | **about $235–810** |
| Payment + tax fees | 1,000 orders | $3,156 |
| Optional AI images | 80,000 images | $2,720–10,720 |

#### Summary

| | 10 maps | 100 maps | 1,000 maps | 10,000 maps |
|---|---|---|---|---|
| Paid orders (10%) | 1 | 10 | 100 | 1,000 |
| Revenue at $84 AOV | $84 | $840 | $8,400 | $84,000 |
| Infrastructure | $20–30 | $30–55 | $70–190 | $235–810 |
| Payment + tax fees | $3 | $32 | $316 | $3,156 |
| Optional AI images (8 per map, uncached) | $3–11 | $27–107 | $272–1,072 | $2,720–10,720 |
| Infrastructure as share of revenue | 24–36% | 4–7% | 0.8–2.3% | 0.3–1.0% |

**Sensitivity to the conversion assumption.** If the tiers are read as paid orders rather than maps generated (100% conversion), only the order-linked lines scale by 10. At 10,000 orders per month: payment and tax fees about $31,560; print-file storage about 3,000 GB = $45 on R2 (versus $69 storage plus about $180 egress on S3, or $18 on B2 with egress inside its free allowance); render demand about 750 vCPU-hours, i.e. 2–4 dedicated workers ($100–300); email about 55,000 messages ($6 on SES, $20–35 on Resend). Infrastructure would still be roughly $500–1,200 per month against $840,000 revenue.

### B4. Top cost drivers, in order

1. **Print cost and shipping** (not in the tables). Indicative base costs: 18x24 poster about $13, 24x36 poster about $18, 4'x6' rug about $75 before shipping (see the printing document for evidence levels). At 1,000 orders per month this is tens of thousands of dollars and dwarfs everything else.
2. **Payment and tax fees**: about 3.8% of revenue, $3.16 per average order. Fixed by the processor; only AOV and method mix move it.
3. **AI image generation, if run per map**: at 8 images per map it costs $0.27–$1.07 per map, which at a 10% conversion rate is $2.70–$10.70 per paid order — comparable to or larger than payment fees, and 10 to 40 times the whole infrastructure bill at the top tier.
4. **Reprints and refunds**: one rug reprint ($75 plus shipping) equals a month of infrastructure at the 1,000-map tier. A 2% rug reprint rate at 200 rugs per month is about $300+ per month [U].
5. **LLM model choice**: 20x spread between Haiku 5.5 and Sonnet 5.5 for the same call ($11 versus $220 at 10,000 maps).
6. **Compute for rasterisation**: small in dollars, but it sets the minimum machine size (RAM) and is the part most likely to be mis-estimated; benchmark early.
7. **Fixed platform fees** dominate only below about 100 maps per month.

Storage and egress are not a driver as long as files live on a zero-egress store and are deleted after the reprint window.

### B5. Cost-control levers

AI

- Generate illustrations **only after purchase**, or only for the top 2–3 landmarks in the preview and the rest after payment. Cuts image spend by up to 90% at a 10% conversion rate.
- **Cache illustrations by landmark** (OSM id + style version). Neighbours share schools, parks and churches; popular areas quickly approach zero marginal cost. A pre-drawn library of generic icons by category (playground, library, fire station) removes generation entirely for most landmarks.
- Use the cheapest image tier that passes a style review; use batch pricing for post-purchase generation where the model offers it (Gemini batch is reported at half price).
- Rank landmarks with Haiku 5.5 by default; escalate to a larger model only when a quality check fails. Use the Batch API (50% off) for anything not interactive, such as pre-computing popular neighbourhoods. Keep the candidate list compact to hold input tokens down, and cache the ranking per location cell.
- Put a hard per-user and per-day cap on generations and require an account or light friction before a generation, to stop abuse.

Rendering and storage

- Render previews at low resolution; render the print master only after payment succeeds.
- Tile-based rendering with streaming encode so workers need 4–8 GB RAM, not 16+.
- Scale workers to zero when idle at low volume; move to always-on dedicated machines only when the queue justifies it.
- Store print files on R2 (no egress) or B2; never serve 100 MB files from a metered-egress store.
- Lifecycle rules: delete print masters after the reprint window, previews after 30 days; keep the render recipe for regeneration.
- JPEG fallback or vector PDF where a provider accepts it, to cut file size.

Platform

- One region, one Postgres with PostGIS, one queue. Avoid adding managed services with monthly minimums before 1,000 maps per month.
- Re-check hosting prices at each tier: 2026 increases at Hetzner and Fly.io changed which option is cheapest.
- Email: SES is 10–100x cheaper per message than the developer-friendly services; the latter are fine until volume makes the difference noticeable (it does not at these tiers).
- Self-host Photon/Overpass only when public-service usage policies are at risk; cache geocodes and area extracts aggressively first. Respect Nominatim and Overpass usage policies from day one (identifying user agent, rate limits).

Payments and fulfilment

- Raise AOV (bundles, frame upsell): the $0.30 fixed fee and shipping amortise better.
- Quote shipping live from the print provider so it is passed through, not absorbed.
- Proof-approval step and artwork validation before submission to hold down reprints.
- Fraud: enable Stripe's default risk rules; personalised goods cannot be recovered after a chargeback and each dispute costs $15 on top.

### B6. Things to measure before trusting this model

1. Real conversion from generated map to paid order.
2. Render time and peak memory for a 14400 x 21600 px map, and actual PNG sizes for the chosen art style.
3. Token counts of the landmark-ranking prompt on dense urban areas.
4. Current list prices for the image model actually chosen, on the vendor's own pricing page.
5. Print provider quotes including shipping for each configured variant and destination.
6. Stripe's current fee schedule and Stripe Tax pricing on stripe.com/pricing, and whether Managed Payments covers physical goods.

---

## Sources

Payments
- Stripe fee summaries (third-party, 2026): https://checkoutpage.com/blog/stripe-processing-fees , https://flexprice.io/blog/stripe-pricing-breakdown-2026 , https://www.withorb.com/pricing-atlas/stripe
- Stripe docs on integration choice: https://docs.stripe.com/payments/advanced , https://docs.stripe.com/elements/express-checkout-element/comparison
- Stripe webhook verification in SDK references: https://stripe.dev/stripe-java/com/stripe/net/Webhook.html , https://pkg.go.dev/github.com/stripe/stripe-go/v76/webhook (canonical page to confirm: https://docs.stripe.com/webhooks/signatures)
- Paddle and Lemon Squeezy: https://dev.to/jettfu/stripe-vs-paddle-vs-lemon-squeezy-fee-comparison-2026-2c77 , https://fungies.io/merchant-of-record-pricing-guide-2026 , https://www.swell.is/content/lemon-squeezy-pricing
- Shopify pricing summaries: https://www.nerdwallet.com/article/small-business/shopify-pricing , https://www.websitebuilderexpert.com/shopify-pricing
- PayPal merchant fees: https://www.paypal.com/webapps/mpp/merchant-fees , https://www.paypalobjects.com/marketing/ua/pdf/US/us-merchant-fees-04-november-2026.pdf , https://checkoutpage.com/blog/paypal-fees

Hosting and data
- Vercel: https://vercel.com/docs/plans/pro , https://schematichq.com/blog/vercel-pricing
- Fly.io: https://fly.io/pricing , https://fly.io/pricing-update/ , https://fly.io/docs/about/pricing/
- Render: https://render.com/pricing
- Railway: https://www.withorb.com/pricing-atlas/railway
- Hetzner 2026 increases: https://wz-it.com/en/blog/hetzner-price-increase-june-2026-cpx-ccx-alternatives/ , https://northflank.com/blog/hetzner-cloud-server-price-increases , https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/
- Neon: https://neon.com/pricing
- Supabase: https://schematichq.com/blog/supabase-pricing , https://www.bytebase.com/blog/supabase-vs-aws-pricing.md
- Upstash: https://upstash.com/pricing/redis , https://upstash.com/docs/redis/overall/pricing
- Object storage comparisons: https://mecanik.dev/en/posts/cloudflare-r2-pricing-explained-real-costs-vs-s3-and-backblaze/ , https://blog.mixpeek.com/object-storage-comparison-2026/ , https://infratally.com/articles/cloudflare-r2-vs-aws-s3-vs-backblaze-b2-2026/
- Email: https://costbench.com/stats/email-api-pricing-2026/ , https://makerkit.dev/blog/saas/best-transactional-email-provider-saas , https://www.costbench.com/compare/amazon-ses-vs-postmark/
- Geodata self-hosting: https://github.com/komoot/photon , https://wiki.openstreetmap.org/wiki/Overpass_API/install

AI
- Claude model pricing: Anthropic model table (cached 2026-11-03); confirm on Anthropic's pricing page before budgeting
- OpenAI image pricing (third-party): https://aireiter.com/blog/gpt-image-1-5-api-pricing , https://aireiter.com/blog/gpt-image-2-api-pricing , https://pricepertoken.com/gpt-image-pricing
- Google image pricing (third-party): https://invideo.io/blog/ai-image-model-pricing/ , https://www.developersdigest.tech/models/image-generation/google-gemini-api , https://benchlm.ai/media-pricing/nano-banana
- FLUX pricing (third-party): https://developer.puter.com/tutorials/flux-api-pricing/ , https://www.costbench.com/software/ai-media-apis/black-forest-labs/
