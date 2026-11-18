import { AppError } from '@maploom/core';
import type { TileFetcher, TileSourceInfo } from './tiles';

export interface TileSource {
  info: TileSourceInfo;
  fetchTile: TileFetcher;
}

export interface TileCache {
  get(key: string): Promise<Uint8Array | null>;
  set(key: string, value: Uint8Array): Promise<void>;
}

type BinFetch = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer>; json(): Promise<unknown> }>;

/**
 * An OpenMapTiles-schema vector tile source described by a TileJSON document.
 * Default: OpenFreeMap (free, no key, commercial use allowed, attribution
 * required). Any OpenMapTiles-compatible endpoint — including self-hosted
 * PMTiles behind a z/x/y shim — works by changing the URL.
 */
export async function openTileSource(opts: {
  fetch: BinFetch;
  tileJsonUrl?: string;
  userAgent: string;
  cache?: TileCache;
}): Promise<TileSource> {
  const tileJsonUrl = opts.tileJsonUrl ?? 'https://tiles.openfreemap.org/planet';
  const headers = { 'User-Agent': opts.userAgent };
  let tj: { tiles?: string[]; maxzoom?: number };
  try {
    const res = await opts.fetch(tileJsonUrl, { headers, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    tj = (await res.json()) as typeof tj;
  } catch (err) {
    throw new AppError('GEODATA_UNAVAILABLE', `tilejson: ${err instanceof Error ? err.message : err}`);
  }
  const template = tj.tiles?.[0];
  if (!template) throw new AppError('GEODATA_UNAVAILABLE', 'tilejson has no tiles');
  // The versioned path segment (e.g. /planet/20261115_080022_pt/) pins the dataset => reproducible maps.
  const dataVersion = /\/(\d{8}_[\w]+)\//.exec(template)?.[1] ?? 'unversioned';

  const fetchTile: TileFetcher = async (z, x, y) => {
    const cacheKey = `${dataVersion}/${z}/${x}/${y}`;
    const cached = await opts.cache?.get(cacheKey);
    if (cached) return cached;
    const url = template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await opts.fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
        if (res.status === 404 || res.status === 204) return null;
        if (!res.ok) throw new Error(`status ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        await opts.cache?.set(cacheKey, buf);
        return buf;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1) ** 2));
      }
    }
    throw new AppError('GEODATA_UNAVAILABLE', `tile ${z}/${x}/${y}: ${lastErr instanceof Error ? lastErr.message : lastErr}`);
  };

  return {
    info: { provider: 'openfreemap', dataVersion, attribution: '© OpenStreetMap contributors', maxZoom: Math.min(14, tj.maxzoom ?? 14) },
    fetchTile,
  };
}
