import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { Geography } from '@maploom/core';
import type { TileCache } from '@maploom/geo';
import { env } from './env';

function dir(name: string): string {
  const d = join(env().dataDir, name);
  mkdirSync(d, { recursive: true });
  return d;
}

const safeKey = (k: string) => {
  if (!/^[\w.-]+$/.test(k)) throw new Error('unsafe storage key');
  return k;
};

async function atomicWrite(file: string, data: Uint8Array | string) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, file);
}

/**
 * Vector-tile cache on local disk. Tiles are public, versioned, immutable map
 * data (not personal data), so they can be kept and shared between customers.
 * Swap for S3/R2 by re-implementing these three small stores.
 */
export const tileCache: TileCache = {
  async get(key) {
    const file = join(dir('tiles'), `${safeKey(key.replaceAll('/', '_'))}.pbf`);
    try {
      return new Uint8Array(await readFile(file));
    } catch {
      return null;
    }
  },
  async set(key, value) {
    await atomicWrite(join(dir('tiles'), `${safeKey(key.replaceAll('/', '_'))}.pbf`), value);
  },
};

/** Geography snapshots, addressed by content hash => reproducible re-renders. */
export const geographyStore = {
  async put(geo: Geography): Promise<void> {
    await atomicWrite(join(dir('geo'), `${safeKey(geo.key)}.json.gz`), gzipSync(JSON.stringify(geo)));
  },
  async get(key: string): Promise<Geography | null> {
    try {
      return JSON.parse(gunzipSync(await readFile(join(dir('geo'), `${safeKey(key)}.json.gz`))).toString('utf8')) as Geography;
    } catch {
      return null;
    }
  },
  async getGzipped(key: string): Promise<Buffer | null> {
    try {
      return await readFile(join(dir('geo'), `${safeKey(key)}.json.gz`));
    } catch {
      return null;
    }
  },
};

export const exportStore = {
  path(fileKey: string): string {
    return join(dir('exports'), safeKey(fileKey));
  },
  exists(fileKey: string): boolean {
    return existsSync(this.path(fileKey));
  },
  size(fileKey: string): number {
    return statSync(this.path(fileKey)).size;
  },
  stream(fileKey: string) {
    return createReadStream(this.path(fileKey));
  },
  remove(fileKey: string) {
    try {
      unlinkSync(this.path(fileKey));
    } catch {
      /* already gone */
    }
  },
};

/** Delete cache files older than maxAgeMs. `keep` protects snapshots saved projects still need. */
export function purgeOldFiles(name: 'geo' | 'exports' | 'tiles', maxAgeMs: number, keep: Set<string> = new Set()): number {
  const d = dir(name);
  let removed = 0;
  for (const f of readdirSync(d)) {
    if (keep.has(f.replace(/\.json\.gz$/, ''))) continue;
    try {
      if (Date.now() - statSync(join(d, f)).mtimeMs > maxAgeMs) {
        unlinkSync(join(d, f));
        removed++;
      }
    } catch {
      /* raced with another process */
    }
  }
  return removed;
}
