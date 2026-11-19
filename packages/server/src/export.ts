import { writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import { AppError, findVariant, printPixels, type Design, type Geography } from '@maploom/core';
import { artSize, renderBaseLayer, renderOverlayLayer, wrapSvg } from '@maploom/render';
import { loadFontsNode } from '@maploom/render/fonts-node';
import { PngWriter } from './png';

export type ExportPreset = 'preview' | 'print';
export type ExportFormat = 'png' | 'svg';

export interface ExportPlan {
  width: number;
  height: number;
  /** Bleed in art units added on every side. */
  bleedArt: number;
  dpi?: number;
}

/** Decide output pixels for a design + preset. Pure, so it is unit-testable. */
export function planExport(design: Design, geo: Pick<Geography, 'frame'>, preset: ExportPreset, maxMegapixels: number): ExportPlan {
  const art = artSize(geo.frame);
  if (preset === 'preview') {
    const long = 2400;
    const scale = long / Math.max(art.width, art.height);
    return { width: Math.round(art.width * scale), height: Math.round(art.height * scale), bleedArt: 0 };
  }
  const found = findVariant(design.product.productId, design.product.variantId);
  if (!found) throw new AppError('INVALID_INPUT', 'unknown product variant');
  const { variant } = found;
  const trim = printPixels(variant, design.product.orientation);
  // The artwork keeps its own aspect; fit it to the trim width and add bleed around.
  const pxPerArt = trim.width / art.width;
  const bleedPx = Math.round(variant.bleedIn * variant.dpi);
  const width = trim.width + bleedPx * 2;
  // Snap to the exact trim height when the artwork matches the product's aspect (rounding only).
  const natural = Math.round(art.height * pxPerArt);
  const height = (Math.abs(natural - trim.height) / trim.height < 0.005 ? trim.height : natural) + bleedPx * 2;
  if ((width * height) / 1e6 > maxMegapixels) throw new AppError('EXPORT_FAILED', `export ${width}x${height} exceeds ${maxMegapixels} MP`);
  return { width, height, bleedArt: bleedPx / pxPerArt, dpi: variant.dpi };
}

export function renderSvg(geo: Geography, design: Design, opts: { bleedArt?: number; pixelWidth?: number } = {}): string {
  const fonts = loadFontsNode();
  const inner = renderBaseLayer(geo, design, fonts) + renderOverlayLayer(geo, design, fonts).markup;
  return wrapSvg(inner, design, artSize(geo.frame), { bleed: opts.bleedArt, pixelWidth: opts.pixelWidth });
}

/** Pixels per strip. 48 MP ≈ 190 MB of RGBA — comfortably inside a small worker. */
const STRIP_PIXELS = 48e6;

/**
 * Rasterise to PNG in horizontal strips: each strip is an SVG whose viewBox
 * covers just that slice, rendered by resvg and streamed into the PNG encoder.
 * The renderer uses no SVG filters, so strips join without seams.
 */
export async function exportPng(geo: Geography, design: Design, plan: ExportPlan, file: string, onProgress?: (f: number) => void, stripPixels = STRIP_PIXELS): Promise<void> {
  const fonts = loadFontsNode();
  const size = artSize(geo.frame);
  let inner: string;
  try {
    inner = renderBaseLayer(geo, design, fonts) + renderOverlayLayer(geo, design, fonts).markup;
  } catch (err) {
    throw new AppError('RENDER_FAILED', err instanceof Error ? err.message : 'render');
  }
  const fullArtH = size.height + plan.bleedArt * 2;
  const png = new PngWriter(file, plan.width, plan.height, plan.dpi);
  const stripRows = Math.max(16, Math.min(plan.height, Math.floor(stripPixels / plan.width)));
  try {
    for (let row = 0; row < plan.height; row += stripRows) {
      const rows = Math.min(stripRows, plan.height - row);
      const y0 = (row / plan.height) * fullArtH;
      const y1 = ((row + rows) / plan.height) * fullArtH;
      const svg = wrapSvg(inner, design, size, { bleed: plan.bleedArt, slice: { y0, y1 }, pixelWidth: plan.width, pixelHeight: rows });
      const rendered = new Resvg(svg, { fitTo: { mode: 'original' }, font: { loadSystemFonts: false } }).render();
      if (rendered.width !== plan.width || rendered.height !== rows) throw new Error(`strip size ${rendered.width}x${rendered.height}, wanted ${plan.width}x${rows}`);
      await png.writeRgba(rendered.pixels, rows);
      onProgress?.((row + rows) / plan.height);
      // Yield so the event loop (job heartbeats, HTTP) stays responsive between strips.
      await new Promise((r) => setImmediate(r));
    }
    await png.finish();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('EXPORT_FAILED', err instanceof Error ? err.message : 'export');
  }
}

export async function exportSvgFile(geo: Geography, design: Design, plan: ExportPlan, file: string): Promise<void> {
  await writeFile(file, renderSvg(geo, design, { bleedArt: plan.bleedArt, pixelWidth: plan.width }));
}
