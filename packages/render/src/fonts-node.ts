import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { FONT_FILES, parseFont, type FontBook, type FontKey } from './fonts';

let cached: FontBook | undefined;

/** Server/test loader: reads the OFL font files straight from the @fontsource packages. */
export function loadFontsNode(): FontBook {
  if (cached) return cached;
  const require = createRequire(import.meta.url);
  const book = {} as FontBook;
  for (const key of Object.keys(FONT_FILES) as FontKey[]) {
    const [pkg, ...rest] = FONT_FILES[key].split('/');
    const root = dirname(require.resolve(`@fontsource/${pkg}/package.json`));
    const buf = readFileSync(join(root, ...rest));
    book[key] = parseFont(key, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  }
  cached = book;
  return book;
}
