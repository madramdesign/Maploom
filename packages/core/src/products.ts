/**
 * Product catalogue as CONFIGURATION. Nothing else in the codebase may assume
 * a particular product, size or price. Prices here are placeholders pending
 * supplier quotes (see docs/architecture/PRINTING.md).
 */

export type ProductKind = 'digital' | 'poster' | 'framed' | 'canvas' | 'play_mat';
export type MockupScene = 'flat' | 'wall-poster' | 'wall-frame' | 'wall-canvas' | 'floor-mat';

export interface ProductVariant {
  id: string;
  label: string;
  /** Physical size of the SHORT and LONG edge in inches; orientation is a design choice. */
  shortIn: number;
  longIn: number;
  material: string;
  priceCents: number;
  shippingCents: number;
  /** Print resolution the supplier wants. */
  dpi: number;
  /** Bleed on every side, inches. */
  bleedIn: number;
}

export interface Product {
  id: string;
  kind: ProductKind;
  name: string;
  tagline: string;
  mockup: MockupScene;
  currency: 'USD';
  /** False = shown in the catalogue but not yet purchasable. */
  orderable: boolean;
  variants: ProductVariant[];
}

export const PRODUCTS: Product[] = [
  {
    id: 'digital',
    kind: 'digital',
    name: 'Digital download',
    tagline: 'Print-ready file, yours to print anywhere',
    mockup: 'flat',
    currency: 'USD',
    orderable: true,
    variants: [
      { id: 'digital-18x24', label: 'Up to 18 × 24 in', shortIn: 18, longIn: 24, material: 'PNG + PDF', priceCents: 1900, shippingCents: 0, dpi: 300, bleedIn: 0 },
      { id: 'digital-24x36', label: 'Up to 24 × 36 in', shortIn: 24, longIn: 36, material: 'PNG + PDF', priceCents: 2900, shippingCents: 0, dpi: 300, bleedIn: 0 },
    ],
  },
  {
    id: 'poster',
    kind: 'poster',
    name: 'Art print',
    tagline: 'Museum-quality matte paper',
    mockup: 'wall-poster',
    currency: 'USD',
    orderable: true,
    variants: [
      { id: 'poster-12x16', label: '12 × 16 in', shortIn: 12, longIn: 16, material: 'Matte 200 gsm', priceCents: 3900, shippingCents: 600, dpi: 300, bleedIn: 0.125 },
      { id: 'poster-18x24', label: '18 × 24 in', shortIn: 18, longIn: 24, material: 'Matte 200 gsm', priceCents: 4900, shippingCents: 700, dpi: 300, bleedIn: 0.125 },
      { id: 'poster-24x36', label: '24 × 36 in', shortIn: 24, longIn: 36, material: 'Matte 200 gsm', priceCents: 6900, shippingCents: 900, dpi: 300, bleedIn: 0.125 },
    ],
  },
  {
    id: 'framed',
    kind: 'framed',
    name: 'Framed print',
    tagline: 'Ready to hang, solid wood frame',
    mockup: 'wall-frame',
    currency: 'USD',
    orderable: true,
    variants: [
      { id: 'framed-12x16', label: '12 × 16 in', shortIn: 12, longIn: 16, material: 'Oak frame', priceCents: 8900, shippingCents: 1200, dpi: 300, bleedIn: 0.125 },
      { id: 'framed-18x24', label: '18 × 24 in', shortIn: 18, longIn: 24, material: 'Oak frame', priceCents: 11900, shippingCents: 1500, dpi: 300, bleedIn: 0.125 },
    ],
  },
  {
    id: 'canvas',
    kind: 'canvas',
    name: 'Canvas',
    tagline: 'Gallery-wrapped stretched canvas',
    mockup: 'wall-canvas',
    currency: 'USD',
    orderable: true,
    variants: [
      { id: 'canvas-16x20', label: '16 × 20 in', shortIn: 16, longIn: 20, material: 'Poly-cotton canvas', priceCents: 9900, shippingCents: 1200, dpi: 200, bleedIn: 1.5 },
      { id: 'canvas-24x36', label: '24 × 36 in', shortIn: 24, longIn: 36, material: 'Poly-cotton canvas', priceCents: 14900, shippingCents: 1800, dpi: 200, bleedIn: 1.5 },
    ],
  },
  {
    id: 'play-mat',
    kind: 'play_mat',
    name: 'Play mat',
    tagline: 'A soft rug of your own streets, sized for toy cars',
    mockup: 'floor-mat',
    currency: 'USD',
    orderable: false,
    variants: [
      { id: 'mat-3x5', label: '3 × 5 ft', shortIn: 36, longIn: 60, material: 'Printed chenille', priceCents: 14900, shippingCents: 0, dpi: 150, bleedIn: 1 },
      { id: 'mat-4x6', label: '4 × 6 ft', shortIn: 48, longIn: 72, material: 'Printed chenille', priceCents: 18900, shippingCents: 0, dpi: 150, bleedIn: 1 },
      { id: 'mat-5x7', label: '5 × 7 ft', shortIn: 60, longIn: 84, material: 'Printed chenille', priceCents: 27900, shippingCents: 0, dpi: 150, bleedIn: 1 },
    ],
  },
];

export type Orientation = 'portrait' | 'landscape' | 'square';

export function findProduct(productId: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === productId);
}

export function findVariant(productId: string, variantId: string): { product: Product; variant: ProductVariant } | undefined {
  const product = findProduct(productId);
  const variant = product?.variants.find((v) => v.id === variantId);
  return product && variant ? { product, variant } : undefined;
}

/** Trim size in inches for a variant in a given orientation. */
export function trimSizeIn(variant: ProductVariant, orientation: Orientation): { widthIn: number; heightIn: number } {
  if (orientation === 'square') return { widthIn: variant.shortIn, heightIn: variant.shortIn };
  return orientation === 'portrait'
    ? { widthIn: variant.shortIn, heightIn: variant.longIn }
    : { widthIn: variant.longIn, heightIn: variant.shortIn };
}

/** Pixel size of the print file (trim only; bleed is added by the exporter). */
export function printPixels(variant: ProductVariant, orientation: Orientation, dpi = variant.dpi): { width: number; height: number } {
  const { widthIn, heightIn } = trimSizeIn(variant, orientation);
  return { width: Math.round(widthIn * dpi), height: Math.round(heightIn * dpi) };
}

export function aspectRatio(variant: ProductVariant, orientation: Orientation): number {
  const { widthIn, heightIn } = trimSizeIn(variant, orientation);
  return widthIn / heightIn;
}

export interface PriceQuote {
  currency: 'USD';
  itemCents: number;
  shippingCents: number;
  totalCents: number;
  lines: { label: string; cents: number }[];
}

export function quote(productId: string, variantId: string, quantity = 1): PriceQuote {
  const found = findVariant(productId, variantId);
  if (!found) throw new Error(`Unknown product variant ${productId}/${variantId}`);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Quantity must be between 1 and 20');
  const { product, variant } = found;
  const itemCents = variant.priceCents * quantity;
  const shippingCents = variant.shippingCents;
  return {
    currency: product.currency,
    itemCents,
    shippingCents,
    totalCents: itemCents + shippingCents,
    lines: [
      { label: `${product.name} — ${variant.label}${quantity > 1 ? ` × ${quantity}` : ''}`, cents: itemCents },
      { label: shippingCents === 0 ? 'Shipping (free)' : 'Shipping', cents: shippingCents },
    ],
  };
}

export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
