import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createDesign, suggestLandmarks } from '@maploom/render';
import { exportPng, planExport, renderSvg } from '@maploom/server/export';
import { buildClifton, CLIFTON } from './fixture-tiles';

function readPng(file: string) {
  const buf = readFileSync(file);
  expect(buf.subarray(1, 4).toString()).toBe('PNG');
  let off = 8;
  const idat: Buffer[] = [];
  let width = 0;
  let height = 0;
  let dpi = 0;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('latin1');
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    }
    if (type === 'pHYs') dpi = Math.round(data.readUInt32BE(0) * 0.0254);
    if (type === 'IDAT') idat.push(Buffer.from(data));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  return { width, height, dpi, raw };
}

describe('export pipeline (map → render → export)', () => {
  it('plans print pixels from the product configuration, including bleed', async () => {
    const geo = await buildClifton();
    const design = createDesign({ frame: geo.frame, home: CLIFTON });
    design.product = { productId: 'poster', variantId: 'poster-18x24', orientation: 'portrait' };
    const plan = planExport(design, geo, 'print', 320);
    expect(plan.dpi).toBe(300);
    expect(plan.width).toBe(18 * 300 + 2 * Math.round(0.125 * 300));
    expect(plan.height).toBe(24 * 300 + 2 * Math.round(0.125 * 300));
    expect(() => planExport(design, geo, 'print', 10)).toThrow();
    const mat = { ...design, product: { productId: 'play-mat', variantId: 'mat-4x6', orientation: 'portrait' as const } };
    expect(planExport(mat, geo, 'print', 320).width).toBe(48 * 150 + 2 * 150);
  });

  it('writes a valid PNG whose strips join seamlessly', async () => {
    const geo = await buildClifton();
    const design = createDesign({ frame: geo.frame, home: CLIFTON });
    design.landmarks = suggestLandmarks(geo, design.preferences, 10);
    const dir = mkdtempSync(join(tmpdir(), 'maploom-'));
    const whole = join(dir, 'whole.png');
    await exportPng(geo, design, { width: 600, height: 800, bleedArt: 0, dpi: 300 }, whole);
    const a = readPng(whole);
    expect([a.width, a.height, a.dpi]).toEqual([600, 800, 300]);
    expect(a.raw.length).toBe(800 * (600 * 3 + 1));
    expect(statSync(whole).size).toBeGreaterThan(20_000);
    // Deterministic: a second export is byte-identical.
    const again = join(dir, 'again.png');
    await exportPng(geo, design, { width: 600, height: 800, bleedArt: 0, dpi: 300 }, again);
    expect(readFileSync(again).equals(readFileSync(whole))).toBe(true);
    // Strip rendering (how huge print files are made) must match a single-pass render.
    const strips = join(dir, 'strips.png');
    await exportPng(geo, design, { width: 600, height: 800, bleedArt: 0, dpi: 300 }, strips, undefined, 600 * 100);
    const b = readPng(strips);
    let maxDiff = 0;
    let differing = 0;
    for (let i = 0; i < a.raw.length; i++) {
      const d = Math.abs(a.raw[i] - b.raw[i]);
      if (d) differing++;
      if (d > maxDiff) maxDiff = d;
    }
    expect(differing / a.raw.length).toBeLessThan(0.002);
  });

  it('renders an SVG with attribution and no text elements (all outlines)', async () => {
    const geo = await buildClifton();
    const design = createDesign({ frame: geo.frame, home: CLIFTON });
    const svg = renderSvg(geo, design);
    expect(svg).toContain('data-kind="attribution"');
    expect(svg).not.toContain('<text');
    expect(svg).not.toContain('NaN');
  });
});
