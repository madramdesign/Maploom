import { AppError, hashHex, type GeocodeResult, type LngLat } from '@maploom/core';

/**
 * Geocoding behind a provider interface so the vendor can be swapped without
 * touching callers. Two OSM-based providers ship today:
 *   - Photon      → type-ahead suggestions (Nominatim's policy forbids autocomplete)
 *   - Nominatim   → full-text search fallback and reverse geocoding
 * Public instances are for development only; see docs/architecture/MAP_DATA.md.
 */
export interface GeocodeProvider {
  readonly name: string;
  suggest(query: string, opts?: { near?: LngLat; limit?: number; signal?: AbortSignal }): Promise<GeocodeResult[]>;
  search(query: string, opts?: { limit?: number; signal?: AbortSignal }): Promise<GeocodeResult[]>;
}

export type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface GeocodeConfig {
  fetch: FetchLike;
  userAgent: string;
  photonUrl?: string;
  nominatimUrl?: string;
  timeoutMs?: number;
}

async function getJson(cfg: GeocodeConfig, url: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(cfg.timeoutMs ?? 8000);
  let res;
  try {
    res = await cfg.fetch(url, {
      headers: { 'User-Agent': cfg.userAgent, Accept: 'application/json', 'Accept-Language': 'en' },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (err) {
    // Never include the URL: it contains what the customer typed.
    throw new AppError('GEOCODER_UNAVAILABLE', err instanceof Error ? err.name : 'fetch failed');
  }
  if (res.status === 429) throw new AppError('RATE_LIMITED', 'geocoder 429');
  if (!res.ok) throw new AppError('GEOCODER_UNAVAILABLE', `geocoder status ${res.status}`);
  return res.json();
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const joinParts = (parts: (string | undefined)[]) => parts.filter(Boolean).join(', ');

function kindOf(type: string | undefined, hasHouseNumber: boolean): GeocodeResult['kind'] {
  if (hasHouseNumber || type === 'house' || type === 'building') return 'address';
  switch (type) {
    case 'street':
    case 'road':
    case 'residential':
      return 'street';
    case 'district':
    case 'locality':
    case 'suburb':
    case 'neighbourhood':
    case 'quarter':
      return 'neighbourhood';
    case 'city':
    case 'town':
    case 'village':
    case 'hamlet':
    case 'municipality':
    case 'administrative':
      return 'city';
    case 'county':
    case 'state':
    case 'country':
    case 'region':
      return 'region';
    default:
      return type ? 'poi' : 'other';
  }
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
}

export function parsePhoton(json: unknown): GeocodeResult[] {
  const features = (json as { features?: PhotonFeature[] })?.features;
  if (!Array.isArray(features)) return [];
  const out: GeocodeResult[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    const c = f.geometry?.coordinates;
    const p = (f.properties ?? {}) as Record<string, string | number[] | undefined>;
    if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const s = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
    const houseNumber = s('housenumber');
    const street = s('street') ?? (s('osm_key') === 'highway' ? s('name') : undefined);
    const city = s('city') ?? s('town') ?? s('village') ?? (s('type') === 'city' ? s('name') : undefined);
    const line1 = houseNumber && street ? `${houseNumber} ${street}` : (s('name') ?? street ?? city ?? '');
    if (!line1) continue;
    const context = joinParts([line1 === street || s('name') === street ? undefined : street && !houseNumber ? street : undefined, s('district'), city !== line1 ? city : undefined, s('state'), s('countrycode') !== 'US' ? s('country') : undefined]);
    const key = `${line1}|${context}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const extent = Array.isArray(p.extent) && p.extent.length === 4 ? (p.extent as number[]) : undefined;
    out.push({
      id: hashHex(`${key}|${c[0]}|${c[1]}`).slice(0, 12),
      label: line1,
      context,
      lngLat: { lat: round6(c[1]), lon: round6(c[0]) },
      kind: kindOf(s('type'), Boolean(houseNumber)),
      address: {
        houseNumber,
        street,
        neighbourhood: s('district') ?? s('locality'),
        city,
        state: s('state'),
        postcode: s('postcode'),
        country: s('country'),
        countryCode: s('countrycode')?.toLowerCase(),
      },
      // Photon extent is [west, north, east, south].
      bbox: extent ? [extent[3], extent[0], extent[1], extent[2]] : undefined,
    });
  }
  return out;
}

interface NominatimItem {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  addresstype?: string;
  type?: string;
  address?: Record<string, string>;
  boundingbox?: string[];
}

export function parseNominatim(json: unknown): GeocodeResult[] {
  if (!Array.isArray(json)) return [];
  const out: GeocodeResult[] = [];
  for (const item of json as NominatimItem[]) {
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const a = item.address ?? {};
    const street = a.road ?? a.pedestrian ?? a.footway;
    const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality;
    const neighbourhood = a.neighbourhood ?? a.suburb ?? a.quarter ?? a.city_district;
    const line1 = a.house_number && street ? `${a.house_number} ${street}` : item.name || street || city || (item.display_name ?? '').split(',')[0];
    if (!line1) continue;
    const context = joinParts([line1 !== street && !a.house_number && item.name && street ? street : undefined, city !== line1 ? city : undefined, a.state, a.country_code !== 'us' ? a.country : undefined]);
    const bb = item.boundingbox?.map(Number);
    out.push({
      id: hashHex(`${line1}|${context}|${lat}|${lon}`).slice(0, 12),
      label: line1,
      context,
      lngLat: { lat: round6(lat), lon: round6(lon) },
      kind: kindOf(item.addresstype ?? item.type, Boolean(a.house_number)),
      address: { houseNumber: a.house_number, street, neighbourhood, city, state: a.state, postcode: a.postcode, country: a.country, countryCode: a.country_code },
      bbox: bb && bb.length === 4 && bb.every(Number.isFinite) ? [bb[0], bb[2], bb[1], bb[3]] : undefined,
    });
  }
  return out;
}

export function normalizeQuery(q: string): string {
  return q.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}

export function createOsmGeocoder(cfg: GeocodeConfig): GeocodeProvider {
  const photon = (cfg.photonUrl ?? 'https://photon.komoot.io').replace(/\/$/, '');
  const nominatim = (cfg.nominatimUrl ?? 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
  // Public Nominatim allows at most 1 request/second per application: serialise + space calls.
  let nominatimChain: Promise<unknown> = Promise.resolve();
  let lastNominatim = 0;
  const nominatimSearch = (query: string, limit: number, signal?: AbortSignal) => {
    const run = async () => {
      const wait = lastNominatim + 1100 - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastNominatim = Date.now();
      const url = `${nominatim}/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(query)}`;
      return parseNominatim(await getJson(cfg, url, signal));
    };
    const p = nominatimChain.then(run, run);
    nominatimChain = p.catch(() => undefined);
    return p;
  };

  return {
    name: 'osm(photon+nominatim)',
    async suggest(query, opts = {}) {
      const q = normalizeQuery(query);
      if (q.length < 3) return [];
      let url = `${photon}/api/?limit=${opts.limit ?? 6}&lang=en&q=${encodeURIComponent(q)}`;
      if (opts.near) url += `&lat=${opts.near.lat.toFixed(3)}&lon=${opts.near.lon.toFixed(3)}`;
      return parsePhoton(await getJson(cfg, url, opts.signal));
    },
    async search(query, opts = {}) {
      const q = normalizeQuery(query);
      if (q.length < 2) return [];
      const limit = opts.limit ?? 5;
      let results: GeocodeResult[] = [];
      let firstError: unknown;
      try {
        results = parsePhoton(await getJson(cfg, `${photon}/api/?limit=${limit}&lang=en&q=${encodeURIComponent(q)}`, opts.signal));
      } catch (err) {
        firstError = err;
      }
      if (results.length === 0) {
        try {
          results = await nominatimSearch(q, limit, opts.signal);
        } catch (err) {
          throw firstError ?? err;
        }
      }
      if (results.length === 0) throw new AppError('ADDRESS_NOT_FOUND');
      return results;
    },
  };
}

/** Tiny TTL + LRU cache. Lives in memory only, so typed addresses never touch disk. */
export class MemoryCache<V> {
  private map = new Map<string, { v: V; exp: number }>();
  constructor(private max = 500, private ttlMs = 10 * 60_000) {}
  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.exp < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.v;
  }
  set(key: string, v: V) {
    this.map.delete(key);
    this.map.set(key, { v, exp: Date.now() + this.ttlMs });
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }
  get size() {
    return this.map.size;
  }
}

export function cachedGeocoder(inner: GeocodeProvider, cache = new MemoryCache<GeocodeResult[]>()): GeocodeProvider {
  return {
    name: inner.name,
    async suggest(query, opts) {
      const k = `s|${normalizeQuery(query).toLowerCase()}|${opts?.near ? `${opts.near.lat.toFixed(1)},${opts.near.lon.toFixed(1)}` : ''}`;
      const hit = cache.get(k);
      if (hit) return hit;
      const res = await inner.suggest(query, opts);
      cache.set(k, res);
      return res;
    },
    async search(query, opts) {
      const k = `q|${normalizeQuery(query).toLowerCase()}`;
      const hit = cache.get(k);
      if (hit) return hit;
      const res = await inner.search(query, opts);
      cache.set(k, res);
      return res;
    },
  };
}
