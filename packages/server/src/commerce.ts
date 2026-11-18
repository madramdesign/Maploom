import { AppError, findVariant, quote, type PriceQuote } from '@maploom/core';
import { newToken } from './crypto';
import { getDb } from './db';

/* ------------------------------------------------------------------ ports */

export interface PrintArtwork {
  url: string;
  width: number;
  height: number;
  dpi: number;
}

export interface PrintOrderRequest {
  orderId: string;
  productId: string;
  variantId: string;
  quantity: number;
  artwork: PrintArtwork;
  shipTo: { name: string; line1: string; line2?: string; city: string; region: string; postcode: string; country: string };
}

/** Every print-on-demand vendor is integrated behind this one interface. */
export interface PrintProvider {
  readonly name: string;
  /** Which of our variant ids this provider can make. */
  supports(productId: string, variantId: string): boolean;
  validateArtwork(productId: string, variantId: string, artwork: PrintArtwork): { ok: boolean; problems: string[] };
  submitOrder(req: PrintOrderRequest): Promise<{ providerRef: string }>;
  getStatus(providerRef: string): Promise<{ status: 'received' | 'in_production' | 'shipped' | 'cancelled' | 'failed'; trackingUrl?: string }>;
  cancel(providerRef: string): Promise<boolean>;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: { orderId: string; quote: PriceQuote; successUrl: string; cancelUrl: string }): Promise<{ paymentRef: string; redirectUrl: string }>;
  /** Verify a webhook signature and return the event, or null if it is not authentic. */
  parseWebhook(rawBody: string, signatureHeader: string | null): { type: 'paid' | 'failed'; paymentRef: string } | null;
}

/* --------------------------------------------------------- mock providers */

/** In-memory print provider for development and tests. Makes nothing, records everything. */
export class MockPrintProvider implements PrintProvider {
  readonly name = 'mock';
  readonly orders = new Map<string, PrintOrderRequest>();
  supports(productId: string) {
    return productId !== 'digital';
  }
  validateArtwork(productId: string, variantId: string, artwork: PrintArtwork) {
    const found = findVariant(productId, variantId);
    const problems: string[] = [];
    if (!found) problems.push('Unknown product variant');
    else {
      const needShort = found.variant.shortIn * found.variant.dpi;
      if (Math.min(artwork.width, artwork.height) < needShort * 0.98) problems.push(`Artwork is too small: short edge must be at least ${needShort}px`);
      if (artwork.dpi < found.variant.dpi) problems.push(`Artwork must be ${found.variant.dpi} DPI`);
    }
    return { ok: problems.length === 0, problems };
  }
  async submitOrder(req: PrintOrderRequest) {
    const providerRef = `mock_${newToken(8)}`;
    this.orders.set(providerRef, req);
    return { providerRef };
  }
  async getStatus(providerRef: string) {
    if (!this.orders.has(providerRef)) throw new AppError('NOT_FOUND');
    return { status: 'received' as const };
  }
  async cancel(providerRef: string) {
    return this.orders.delete(providerRef);
  }
}

/** Test-mode payments: "checkout" succeeds immediately at a local confirmation URL. No money moves. */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  async createCheckout(input: { orderId: string; successUrl: string }) {
    return { paymentRef: `mockpay_${newToken(8)}`, redirectUrl: input.successUrl };
  }
  parseWebhook() {
    return null;
  }
}

const providers = { print: new MockPrintProvider() as PrintProvider, payment: new MockPaymentProvider() as PaymentProvider };
export const getPrintProvider = () => providers.print;
export const getPaymentProvider = () => providers.payment;
export function setProviders(p: Partial<typeof providers>) {
  Object.assign(providers, p);
}

/* ------------------------------------------------------------------ orders */

export interface OrderRow {
  id: string;
  status: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  currency: string;
  total_cents: number;
  payment_provider: string | null;
  print_provider: string | null;
  created_at: string;
}

/**
 * Create an order in `pending_payment`. Prices are always computed on the
 * server from the product configuration — never trusted from the client.
 */
export async function createOrder(ownerHash: string, input: { projectId?: string; designVersion?: number; productId: string; variantId: string; quantity: number; successUrl: string; cancelUrl: string }): Promise<{ orderId: string; quote: PriceQuote; redirectUrl: string; testMode: boolean }> {
  const found = findVariant(input.productId, input.variantId);
  if (!found) throw new AppError('INVALID_INPUT', 'unknown variant');
  if (!found.product.orderable) throw new AppError('INVALID_INPUT', 'product not orderable yet');
  let q: PriceQuote;
  try {
    q = quote(input.productId, input.variantId, input.quantity);
  } catch {
    throw new AppError('INVALID_INPUT', 'bad quantity');
  }
  const db = await getDb();
  const orderId = `ord_${newToken(12)}`;
  const payment = getPaymentProvider();
  let checkout;
  try {
    checkout = await payment.createCheckout({ orderId, quote: q, successUrl: input.successUrl, cancelUrl: input.cancelUrl });
  } catch (err) {
    throw new AppError('PAYMENT_FAILED', err instanceof Error ? err.message : 'checkout');
  }
  await db.query(
    `INSERT INTO orders (id, project_id, design_version, owner_hash, product_id, variant_id, quantity, currency, total_cents, payment_provider, payment_ref)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [orderId, input.projectId ?? null, input.designVersion ?? null, ownerHash, input.productId, input.variantId, input.quantity, q.currency, q.totalCents, payment.name, checkout.paymentRef],
  );
  await addOrderEvent(orderId, 'created', { totalCents: q.totalCents, testMode: payment.name === 'mock' });
  return { orderId, quote: q, redirectUrl: checkout.redirectUrl, testMode: payment.name === 'mock' };
}

export async function addOrderEvent(orderId: string, type: string, data?: unknown) {
  const db = await getDb();
  await db.query('INSERT INTO order_events (id, order_id, type, data) VALUES ($1,$2,$3,$4::jsonb)', [`oe_${newToken(10)}`, orderId, type, JSON.stringify(data ?? null)]);
}

const ORDER_STATUSES = ['pending_payment', 'paid', 'approved', 'in_production', 'shipped', 'cancelled', 'refunded', 'rejected'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export async function setOrderStatus(orderId: string, status: string, actor: string): Promise<void> {
  if (!ORDER_STATUSES.includes(status as OrderStatus)) throw new AppError('INVALID_INPUT', 'bad status');
  const db = await getDb();
  const rows = await db.query('UPDATE orders SET status=$2, updated_at=now() WHERE id=$1 RETURNING id', [orderId, status]);
  if (!rows.length) throw new AppError('NOT_FOUND');
  await addOrderEvent(orderId, 'status', { status, actor });
}
