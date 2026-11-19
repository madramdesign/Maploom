'use client';

import { useEffect, useState } from 'react';
import type { StyleId } from '@maploom/core';
import { asset } from './api';
import { STYLES, loadFontsFromUrl, type FontBook, type FontKey } from '@maploom/render';

const book: Partial<FontBook> = {};
const pending = new Map<FontKey, Promise<void>>();

function ensure(key: FontKey): Promise<void> {
  if (book[key]) return Promise.resolve();
  let p = pending.get(key);
  if (!p) {
    p = loadFontsFromUrl(asset('/fonts'), [key]).then((loaded) => {
      Object.assign(book, loaded);
    });
    pending.set(key, p);
    p.catch(() => pending.delete(key));
  }
  return p;
}

/** Loads (once) the two typefaces a style needs and returns the shared font book when ready. */
export function useFonts(styleId: StyleId): Partial<FontBook> | null {
  const [, bump] = useState(0);
  const { display, label } = STYLES[styleId].fonts;
  const ready = Boolean(book[display] && book[label]);
  useEffect(() => {
    if (ready) return;
    let alive = true;
    Promise.all([ensure(display), ensure(label)]).then(() => alive && bump((n) => n + 1)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [display, label, ready]);
  return ready ? book : null;
}
