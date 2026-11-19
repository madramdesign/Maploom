import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { FONT_FILES, parseFont, type FontBook, type FontKey } from './fonts';

let cached: FontBook | undefined;

/**
 * Locate node_modules/@fontsource by walking up from the working directory.
 * (require.resolve is not usable here: bundlers rewrite it to virtual paths.)
 */
function fontsourceRoot(): string {
  const starts = [process.env.MAPLOOM_FONT_DIR, process.cwd(), process.env.MAPLOOM_ROOT].filter(Boolean) as string[];
  for (const start of starts) {
    let dir = resolve(start);
    for (let i = 0; i < 8; i++) {
      const candidate = join(dir, 'node_modules', '@fontsource');
      if (existsSync(/*turbopackIgnore: true*/ join(candidate, 'fredoka'))) return candidate;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error('Font files not found: install dependencies or set MAPLOOM_FONT_DIR');
}

/** Server/test loader: reads the OFL font files straight from the @fontsource packages. */
export function loadFontsNode(): FontBook {
  if (cached) return cached;
  const root = fontsourceRoot();
  const book = {} as FontBook;
  for (const key of Object.keys(FONT_FILES) as FontKey[]) {
    const buf = readFileSync(/*turbopackIgnore: true*/ join(root, FONT_FILES[key]));
    book[key] = parseFont(key, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  }
  cached = book;
  return book;
}
