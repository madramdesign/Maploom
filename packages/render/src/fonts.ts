import opentype from 'opentype.js';

/**
 * Text is always converted to vector outlines. That makes artwork independent
 * of installed fonts: the browser preview, the server export and the printer's
 * RIP all see exactly the same shapes. All fonts are SIL OFL (print-safe).
 */
export const FONT_FILES = {
  'fredoka-600': 'fredoka/files/fredoka-latin-600-normal.woff',
  'nunito-800': 'nunito/files/nunito-latin-800-normal.woff',
  'josefin-400': 'josefin-sans/files/josefin-sans-latin-400-normal.woff',
  'josefin-600': 'josefin-sans/files/josefin-sans-latin-600-normal.woff',
  'inter-500': 'inter/files/inter-latin-500-normal.woff',
  'caveat-700': 'caveat/files/caveat-latin-700-normal.woff',
  'kalam-400': 'kalam/files/kalam-latin-400-normal.woff',
  'playfair-700': 'playfair-display/files/playfair-display-latin-700-normal.woff',
  'fell-400': 'im-fell-english/files/im-fell-english-latin-400-normal.woff',
  'bebas-400': 'bebas-neue/files/bebas-neue-latin-400-normal.woff',
  'barlow-600': 'barlow-condensed/files/barlow-condensed-latin-600-normal.woff',
  'cormorant-600': 'cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff',
} as const;
export type FontKey = keyof typeof FONT_FILES;

export interface GlyphRun {
  /** Glyph outline at 1000 units/em, y down, origin on the baseline. */
  d: string;
  advance: number;
}

/**
 * Serialise an opentype path ourselves: opentype.js 2.0's toPathData() can
 * emit "NaN" for some coordinates, which truncates the shape in renderers.
 */
function pathData(path: opentype.Path, decimals: number): string {
  const f = 10 ** decimals;
  const r = (v: number | undefined) => String(Math.round((v ?? 0) * f) / f);
  let d = '';
  for (const c of path.commands as { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }[]) {
    if (c.type === 'M' || c.type === 'L') d += `${c.type}${r(c.x)} ${r(c.y)}`;
    else if (c.type === 'Q') d += `Q${r(c.x1)} ${r(c.y1)} ${r(c.x)} ${r(c.y)}`;
    else if (c.type === 'C') d += `C${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)} ${r(c.x)} ${r(c.y)}`;
    else if (c.type === 'Z') d += 'Z';
  }
  return d;
}

export class Typeface {
  private cache = new Map<string, GlyphRun | null>();
  constructor(readonly key: FontKey, private font: opentype.Font) {}

  /**
   * Simple left-to-right layout: per-glyph advances plus pair kerning. We do
   * our own layout instead of opentype.js's shaper, which throws on GSUB
   * lookups it does not implement (seen with several Google fonts).
   */
  private layout(text: string, size: number, tracking: number): { glyphs: { g: opentype.Glyph; x: number }[]; width: number } {
    const scale = size / this.font.unitsPerEm;
    const glyphs: { g: opentype.Glyph; x: number }[] = [];
    let x = 0;
    let prev: opentype.Glyph | null = null;
    for (const ch of text) {
      const g = this.font.charToGlyph(ch);
      if (prev) {
        let kern = 0;
        try {
          kern = this.font.getKerningValue(prev, g);
          if (!Number.isFinite(kern)) kern = 0;
        } catch {
          kern = 0;
        }
        x += kern * scale + tracking * size;
      }
      glyphs.push({ g, x });
      x += (Number.isFinite(g.advanceWidth) ? (g.advanceWidth as number) : 0) * scale;
      prev = g;
    }
    return { glyphs, width: x };
  }

  /** Advance width of a string at the given size. */
  width(text: string, size: number, tracking = 0): number {
    return this.layout(text, size, tracking).width;
  }

  /** Outline of a whole string as SVG path data, baseline-left at (x, y). */
  path(text: string, x: number, y: number, size: number, tracking = 0): string {
    let d = '';
    for (const { g, x: gx } of this.layout(text, size, tracking).glyphs) d += pathData(g.getPath(x + gx, y, size), 2);
    return d;
  }

  /** Single glyph at 1000 units/em for path-following text. Null when the font lacks the character. */
  glyph(ch: string): GlyphRun | null {
    let g = this.cache.get(ch);
    if (g === undefined) {
      const glyph = this.font.charToGlyph(ch);
      if (!glyph || (glyph.index === 0 && ch !== ' ')) g = null;
      else g = { d: pathData(glyph.getPath(0, 0, 1000), 1), advance: ((glyph.advanceWidth ?? 0) / this.font.unitsPerEm) * 1000 };
      this.cache.set(ch, g);
    }
    return g;
  }

  /** Approximate cap height / ascent ratios, used for vertical centring. */
  get capHeight(): number {
    const os2 = (this.font.tables as { os2?: { sCapHeight?: number } }).os2;
    return (os2?.sCapHeight || this.font.ascender * 0.72) / this.font.unitsPerEm;
  }
}

export type FontBook = Record<FontKey, Typeface>;

export function parseFont(key: FontKey, data: ArrayBuffer): Typeface {
  return new Typeface(key, opentype.parse(data));
}

/** Browser loader: fonts are served as static files (copied by scripts/copy-fonts.mjs). */
export async function loadFontsFromUrl(baseUrl: string, keys: FontKey[] = Object.keys(FONT_FILES) as FontKey[]): Promise<Partial<FontBook>> {
  const book: Partial<FontBook> = {};
  await Promise.all(
    keys.map(async (key) => {
      const res = await fetch(`${baseUrl}/${key}.woff`);
      if (!res.ok) throw new Error(`Font ${key} failed to load`);
      book[key] = parseFont(key, await res.arrayBuffer());
    }),
  );
  return book;
}
