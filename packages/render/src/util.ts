import type { Pt } from '@maploom/core';

/** Compact, deterministic number formatting for SVG output. */
export function n(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
}

export function linePath(pts: Pt[]): string {
  let d = '';
  for (let i = 0; i < pts.length; i++) d += `${i ? 'L' : 'M'}${n(pts[i][0])} ${n(pts[i][1])}`;
  return d;
}

export function polyPath(poly: Pt[][]): string {
  return poly.map((ring) => `${linePath(ring)}Z`).join('');
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Mix a hex colour toward black (amount < 0) or white (amount > 0). */
export function shade(hex: string, amount: number): string {
  const target = amount < 0 ? 0 : 255;
  const t = Math.min(1, Math.abs(amount));
  return `#${parseHex(hex)
    .map((c) => Math.round(c + (target - c) * t).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export type Box = [number, number, number, number];

export class Collider {
  private boxes: Box[] = [];
  hits(b: Box, pad = 0): boolean {
    for (const o of this.boxes) if (b[0] - pad < o[2] && b[2] + pad > o[0] && b[1] - pad < o[3] && b[3] + pad > o[1]) return true;
    return false;
  }
  add(b: Box) {
    this.boxes.push(b);
  }
}
