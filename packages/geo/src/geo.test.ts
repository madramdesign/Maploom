import { describe, expect, it } from 'vitest';
import type { Poi, Pt } from '@maploom/core';
import {
  LocalProjection,
  MemoryCache,
  categorize,
  clipLine,
  clipRing,
  frameBounds,
  haversineM,
  makeFrame,
  mergeLines,
  normalizeQuery,
  parseNominatim,
  parsePhoton,
  pickZoom,
  rankLandmarks,
  reframe,
  simplify,
  createOsmGeocoder,
  defaultLandmarkTarget,
} from './index';

const CLIFTON = { lat: 40.8651, lon: -74.1585 };

describe('coordinate transformations', () => {
  it('round-trips lat/lon through the local projection', () => {
    const proj = new LocalProjection(CLIFTON);
    const p = { lat: 40.8712, lon: -74.1499 };
    const back = proj.unproject(proj.project(p));
    expect(back.lat).toBeCloseTo(p.lat, 7);
    expect(back.lon).toBeCloseTo(p.lon, 7);
    expect(proj.project(CLIFTON)).toEqual([0, 0]);
  });

  it('measures true metres near the centre (within 0.2% of haversine)', () => {
    const proj = new LocalProjection(CLIFTON);
    for (const p of [{ lat: 40.8751, lon: -74.1585 }, { lat: 40.8651, lon: -74.1385 }, { lat: 40.859, lon: -74.17 }]) {
      const [x, y] = proj.project(p);
      expect(Math.hypot(x, y) / haversineM(CLIFTON, p)).toBeCloseTo(1, 2);
    }
  });

  it('puts north up and east right (y grows south)', () => {
    const proj = new LocalProjection(CLIFTON);
    expect(proj.project({ lat: CLIFTON.lat + 0.01, lon: CLIFTON.lon })[1]).toBeLessThan(0);
    expect(proj.project({ lat: CLIFTON.lat, lon: CLIFTON.lon + 0.01 })[0]).toBeGreaterThan(0);
  });
});

describe('map bounds', () => {
  it('builds frames from a short edge and aspect ratio', () => {
    expect(makeFrame(CLIFTON, 1200, 3 / 4)).toMatchObject({ widthM: 1200, heightM: 1600 });
    expect(makeFrame(CLIFTON, 1200, 3 / 2)).toMatchObject({ widthM: 1800, heightM: 1200 });
    expect(reframe(makeFrame(CLIFTON, 1200, 3 / 4), 1)).toMatchObject({ widthM: 1200, heightM: 1200 });
  });

  it('computes geographic bounds that contain the centre and match the size', () => {
    const frame = makeFrame(CLIFTON, 2000, 1);
    const [s, w, n, e] = frameBounds(frame);
    expect(s).toBeLessThan(CLIFTON.lat);
    expect(n).toBeGreaterThan(CLIFTON.lat);
    expect(haversineM({ lat: s, lon: CLIFTON.lon }, { lat: n, lon: CLIFTON.lon })).toBeCloseTo(2000, -1);
    expect(haversineM({ lat: CLIFTON.lat, lon: w }, { lat: CLIFTON.lat, lon: e })).toBeCloseTo(2000, -1);
  });

  it('drops zoom to respect the tile budget', () => {
    expect(pickZoom(makeFrame(CLIFTON, 1200, 1)).z).toBe(14);
    const big = pickZoom(makeFrame(CLIFTON, 30000, 1), 14, 64);
    expect(big.z).toBeLessThan(14);
    expect(big.count).toBeLessThanOrEqual(64);
  });
});

describe('geometry', () => {
  const rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
  it('clips lines into the pieces inside a rectangle', () => {
    const pieces = clipLine([[-5, 5], [5, 5], [5, 15], [8, 15], [8, 5]], rect);
    expect(pieces).toEqual([[[0, 5], [5, 5], [5, 10]], [[8, 10], [8, 5]]]);
    expect(clipLine([[-5, -5], [-1, -1]], rect)).toEqual([]);
  });
  it('clips polygons', () => {
    const ring = clipRing([[-5, -5], [5, -5], [5, 5], [-5, 5]], rect);
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([0, 5, 0, 5]);
  });
  it('simplifies but keeps endpoints and corners', () => {
    const line: Pt[] = [[0, 0], [1, 0.01], [2, 0], [3, 5], [4, 5.01], [5, 5]];
    expect(simplify(line, 0.1)).toEqual([[0, 0], [2, 0], [3, 5], [5, 5]]);
  });
  it('merges line fragments end-to-end but not through junctions', () => {
    const merged = mergeLines([[[0, 0], [1, 0]], [[2, 0], [1, 0]], [[2, 0], [3, 0]]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]]);
    const junction = mergeLines([[[0, 0], [1, 0]], [[1, 0], [2, 0]], [[1, 0], [1, 1]]]);
    expect(junction).toHaveLength(3);
  });
});

describe('geocoding', () => {
  const photon = {
    features: [
      { geometry: { coordinates: [-74.1638, 40.8584] }, properties: { osm_key: 'place', type: 'house', housenumber: '123', street: 'Main Street', city: 'Clifton', state: 'New Jersey', postcode: '07011', country: 'United States', countrycode: 'US' } },
      { geometry: { coordinates: [-74.16, 40.85] }, properties: { type: 'city', name: 'Clifton', state: 'New Jersey', countrycode: 'US', extent: [-74.2, 40.9, -74.1, 40.8] } },
      { geometry: {}, properties: { name: 'broken' } },
    ],
  };
  it('normalises Photon results', () => {
    const [addr, city] = parsePhoton(photon);
    expect(addr).toMatchObject({ label: '123 Main Street', context: 'Clifton, New Jersey', kind: 'address', lngLat: { lat: 40.8584, lon: -74.1638 } });
    expect(addr.address).toMatchObject({ houseNumber: '123', street: 'Main Street', city: 'Clifton', state: 'New Jersey', postcode: '07011', countryCode: 'us' });
    expect(city).toMatchObject({ label: 'Clifton', kind: 'city', bbox: [40.8, -74.2, 40.9, -74.1] });
    expect(parsePhoton(photon)).toHaveLength(2);
    expect(parsePhoton(null)).toEqual([]);
  });
  it('normalises Nominatim results', () => {
    const res = parseNominatim([{ lat: '40.8584328', lon: '-74.1637553', name: 'Clifton', addresstype: 'city', address: { city: 'Clifton', state: 'New Jersey', country: 'United States', country_code: 'us' }, boundingbox: ['40.81', '40.89', '-74.19', '-74.11'] }]);
    expect(res[0]).toMatchObject({ label: 'Clifton', context: 'New Jersey', kind: 'city', bbox: [40.81, -74.19, 40.89, -74.11] });
  });
  it('cleans queries', () => {
    expect(normalizeQuery('  123   Main\tSt\n ')).toBe('123 Main St');
    expect(normalizeQuery('x'.repeat(500))).toHaveLength(200);
  });
  it('falls back to Nominatim, and reports not-found / outages as friendly errors', async () => {
    const calls: string[] = [];
    const fetchOk = async (url: string) => {
      calls.push(new URL(url).host);
      const body = url.includes('photon') ? { features: [] } : [{ lat: '1', lon: '2', name: 'Somewhere', address: {} }];
      return { ok: true, status: 200, json: async () => body };
    };
    const geocoder = createOsmGeocoder({ fetch: fetchOk, userAgent: 'test' });
    expect((await geocoder.search('somewhere'))[0].label).toBe('Somewhere');
    expect(calls).toEqual(['photon.komoot.io', 'nominatim.openstreetmap.org']);

    const empty = createOsmGeocoder({ fetch: async (url) => ({ ok: true, status: 200, json: async () => (url.includes('photon') ? { features: [] } : []) }), userAgent: 't' });
    await expect(empty.search('zzzz')).rejects.toMatchObject({ code: 'ADDRESS_NOT_FOUND' });
    const down = createOsmGeocoder({ fetch: async () => { throw new Error('ECONNRESET https://example/?q=secret+address'); }, userAgent: 't' });
    const err = await down.search('123 main st').catch((e) => e);
    expect(err.code).toBe('GEOCODER_UNAVAILABLE');
    expect(JSON.stringify(err) + err.detail).not.toContain('secret');
    expect(await empty.suggest('ab')).toEqual([]);
  });
  it('memory cache expires and evicts', async () => {
    const c = new MemoryCache<number>(2, 20);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('c')).toBe(3);
    await new Promise((r) => setTimeout(r, 30));
    expect(c.get('c')).toBeUndefined();
  });
});

describe('POI categorisation', () => {
  it('maps source classes to our categories and drops noise', () => {
    expect(categorize('school', 'school', 'PS 13')).toBe('school');
    expect(categorize('bus', 'bus_stop', 'Main St')).toBeNull();
    expect(categorize('parking', 'parking', 'Lot A')).toBeNull();
    expect(categorize('restaurant', 'restaurant', "Mario's Pizzeria")).toBe('pizza');
    expect(categorize('fast_food', 'fast_food', 'Sweet Gelato Bar')).toBe('ice_cream');
    expect(categorize('unknown', 'thing', 'X')).toBeNull();
  });
});

describe('landmark ranking', () => {
  const frame = makeFrame(CLIFTON, 2000, 1);
  const poi = (id: string, category: Poi['category'], x: number, y: number, extra: Partial<Poi> = {}): Poi => ({ id, name: extra.name ?? id, category, sourceClass: '', sourceSubclass: '', pos: [x, y], lngLat: CLIFTON, rank: 1, ...extra });

  it('prefers closer, more prominent, bigger places', () => {
    const ranked = rankLandmarks({ frame, pois: [poi('far', 'park', 800, 800), poi('near', 'park', 150, 100), poi('big', 'park', 800, -800, { areaM2: 200000 }), poi('obscure', 'park', 160, 110, { rank: 30 })] });
    const score = (id: string) => ranked.find((r) => r.poi.id === id)!.score;
    expect(score('near')).toBeGreaterThan(score('far'));
    expect(score('big')).toBeGreaterThan(score('far'));
    expect(score('near')).toBeGreaterThan(score('obscure'));
    for (const r of ranked) expect(r.score).toBeGreaterThanOrEqual(0), expect(r.score).toBeLessThanOrEqual(1);
  });

  it('penalises chains and crowded categories (uniqueness)', () => {
    const pois = [poi('m1', 'museum', 300, 0), ...Array.from({ length: 9 }, (_, i) => poi(`r${i}`, 'restaurant', 300 + i, 10, { name: i < 3 ? 'Burger Chain' : `Bistro ${i}` }))];
    const ranked = rankLandmarks({ frame, pois });
    const b = (id: string) => ranked.find((r) => r.poi.id === id)!.breakdown;
    expect(b('m1').uniqueness).toBe(1);
    expect(b('r5').uniqueness).toBeLessThan(0.5);
  });

  it('respects user preferences', () => {
    const pois = [poi('s', 'school', 300, 0), poi('p', 'pizza', -300, 0)];
    const ranked = rankLandmarks({ frame, pois }, { preferences: { food: false } });
    expect(ranked.find((r) => r.poi.id === 'p')).toMatchObject({ score: 0, selected: false });
    expect(ranked.find((r) => r.poi.id === 's')!.selected).toBe(true);
  });

  it('selects a spaced, diverse set and never more than the target', () => {
    const pois = Array.from({ length: 60 }, (_, i) => poi(`park${i}`, 'park', -900 + (i % 10) * 190, -900 + Math.floor(i / 10) * 300));
    pois.push(poi('lib', 'library', 400, 400), poi('fire', 'fire_station', -400, 420));
    const ranked = rankLandmarks({ frame, pois }, { target: 10 });
    const chosen = ranked.filter((r) => r.selected);
    expect(chosen.length).toBeLessThanOrEqual(10);
    expect(chosen.filter((c) => c.poi.category === 'park').length).toBeLessThanOrEqual(3);
    expect(chosen.map((c) => c.poi.id)).toEqual(expect.arrayContaining(['lib', 'fire']));
    for (const a of chosen) for (const b of chosen) if (a !== b) expect(Math.hypot(a.poi.pos[0] - b.poi.pos[0], a.poi.pos[1] - b.poi.pos[1])).toBeGreaterThanOrEqual(170);
  });

  it('is deterministic and merges duplicate mappings of one place', () => {
    const pois = [poi('a1', 'park', 200, 200, { name: 'Central Park' }), poi('a2', 'park', 260, 200, { name: 'Central Park' }), poi('b', 'school', -300, 100)];
    const one = rankLandmarks({ frame, pois });
    const two = rankLandmarks({ frame, pois: [...pois].reverse() });
    expect(one.filter((r) => r.poi.name === 'Central Park')).toHaveLength(1);
    expect(one.map((r) => [r.poi.id, r.score])).toEqual(two.map((r) => [r.poi.id, r.score]));
    expect(defaultLandmarkTarget(frame)).toBe(11);
  });
});
