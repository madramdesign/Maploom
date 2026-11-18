import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AppError, type Frame, type Geography } from '@maploom/core';
import { buildGeographyFromTiles, cachedGeocoder, createOsmGeocoder, openTileSource, type GeocodeProvider, type TileSource } from '@maploom/geo';
import { getDb } from './db';
import { env } from './env';
import { log } from './log';
import { geographyStore, tileCache } from './store';

const g = globalThis as unknown as { __maploomGeocoder?: GeocodeProvider; __maploomTiles?: { at: number; source: Promise<TileSource> } };

async function countUsage(provider: string, ok: boolean) {
  try {
    const db = await getDb();
    await db.query(
      `INSERT INTO api_usage (day, provider, calls, errors) VALUES (CURRENT_DATE, $1, 1, $2)
       ON CONFLICT (day, provider) DO UPDATE SET calls = api_usage.calls + 1, errors = api_usage.errors + $2`,
      [provider, ok ? 0 : 1],
    );
  } catch {
    /* metrics must never break a request */
  }
}

const countingFetch = (provider: string): typeof fetch => async (input, init) => {
  try {
    const res = await fetch(input, init);
    void countUsage(provider, res.ok);
    return res;
  } catch (err) {
    void countUsage(provider, false);
    throw err;
  }
};

/** Geocoder with an in-memory (never persisted) cache. */
export function getGeocoder(): GeocodeProvider {
  if (!g.__maploomGeocoder) {
    const e = env();
    g.__maploomGeocoder = cachedGeocoder(
      createOsmGeocoder({ fetch: countingFetch('geocoder') as never, userAgent: e.MAPLOOM_USER_AGENT, photonUrl: e.MAPLOOM_PHOTON_URL, nominatimUrl: e.MAPLOOM_NOMINATIM_URL }),
    );
  }
  return g.__maploomGeocoder;
}

/** Tile source; TileJSON is re-read hourly so new planet builds are picked up. */
export function getTileSource(): Promise<TileSource> {
  const hit = g.__maploomTiles;
  if (hit && Date.now() - hit.at < 3600_000) return hit.source;
  const e = env();
  if (e.MAPLOOM_FIXTURE_TILES) {
    // Offline mode: real OpenStreetMap tiles previously saved to disk (see scripts/refresh-fixtures.ts).
    const dir = resolve(process.env.MAPLOOM_ROOT ?? process.cwd(), e.MAPLOOM_FIXTURE_TILES);
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { info: TileSource['info'] };
    const fixture: TileSource = {
      info: manifest.info,
      fetchTile: async (z, x, y) => {
        const file = join(dir, `${z}-${x}-${y}.pbf`);
        return existsSync(file) ? new Uint8Array(readFileSync(file)) : null;
      },
    };
    const p = Promise.resolve(fixture);
    g.__maploomTiles = { at: Date.now(), source: p };
    return p;
  }
  const source = openTileSource({ fetch: countingFetch('tiles') as never, tileJsonUrl: e.MAPLOOM_TILEJSON_URL, userAgent: e.MAPLOOM_USER_AGENT, cache: tileCache });
  g.__maploomTiles = { at: Date.now(), source };
  source.catch(() => {
    if (g.__maploomTiles?.source === source) g.__maploomTiles = undefined;
  });
  return source;
}

export function validateFrame(frame: Frame) {
  const { center, widthM, heightM } = frame;
  const ok = Number.isFinite(center.lat) && Number.isFinite(center.lon) && Math.abs(center.lat) <= 85 && Math.abs(center.lon) <= 180 && widthM >= 200 && heightM >= 200;
  if (!ok) throw new AppError('INVALID_INPUT', 'bad frame');
  if (widthM > 30_000 || heightM > 30_000) throw new AppError('AREA_TOO_LARGE');
}

/** Frame → Geography snapshot (stored by content hash). */
export async function buildGeography(frame: Frame, onProgress?: (f: number, stage: string) => void): Promise<Geography> {
  validateFrame(frame);
  const source = await getTileSource();
  const t0 = Date.now();
  const geo = await buildGeographyFromTiles(frame, source.fetchTile, source.info, { onProgress });
  await geographyStore.put(geo);
  log.info('geography.built', { key: geo.key, roads: geo.roads.length, areas: geo.areas.length, buildings: geo.buildings.length, pois: geo.pois.length, ms: Date.now() - t0 });
  return geo;
}
