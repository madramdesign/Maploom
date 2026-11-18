import { VectorTile, type VectorTileFeature } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import polygonClipping from 'polygon-clipping';
import {
  AppError,
  hashHex,
  type Area,
  type AreaKind,
  type Building,
  type Frame,
  type Geography,
  type PlaceName,
  type Poi,
  type Pt,
  type Road,
  type RoadClass,
  type Waterway,
} from '@maploom/core';
import {
  bboxOf,
  clipLine,
  clipPoly,
  lineLength,
  mergeLines,
  pointInPoly,
  polyArea,
  quantize,
  rectsOverlap,
  ringArea,
  ringCentroid,
  segDist2,
  simplify,
  simplifyRing,
} from './geometry';
import { LocalProjection, frameRect, pickZoom, type Rect } from './projection';
import { categorize } from './poi-mapping';

/** Fetches one raw (decompressed) MVT tile, or null when the tile does not exist. */
export type TileFetcher = (z: number, x: number, y: number) => Promise<Uint8Array | null>;

export interface TileSourceInfo {
  provider: string;
  dataVersion: string;
  attribution: string;
  maxZoom: number;
}

export interface BuildOptions {
  maxTiles?: number;
  onProgress?: (fraction: number, stage: string) => void;
  /** Injected for deterministic tests. */
  now?: () => Date;
}

const ROAD_CLASS: Record<string, RoadClass | undefined> = {
  motorway: 'motorway',
  trunk: 'trunk',
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'tertiary',
  minor: 'minor',
  service: 'service',
  busway: 'service',
  raceway: 'service',
  track: 'path',
  path: 'path',
  rail: 'rail',
  transit: 'rail',
};

const LANDUSE_KIND: Record<string, AreaKind | undefined> = {
  residential: 'residential',
  suburb: 'residential',
  neighbourhood: 'residential',
  commercial: 'commercial',
  retail: 'commercial',
  industrial: 'industrial',
  school: 'school',
  university: 'school',
  college: 'school',
  kindergarten: 'school',
  hospital: 'hospital',
  cemetery: 'cemetery',
  pitch: 'pitch',
  stadium: 'pitch',
  track: 'pitch',
  playground: 'playground',
  theme_park: 'park',
  zoo: 'park',
};

const LANDCOVER_KIND: Record<string, AreaKind | undefined> = {
  grass: 'grass',
  wood: 'wood',
  sand: 'sand',
  farmland: 'farmland',
  wetland: 'wetland',
};
const PARKISH = new Set(['park', 'garden', 'recreation_ground', 'golf_course', 'village_green', 'dog_park']);

interface RawRoad {
  cls: RoadClass;
  bridge: boolean;
  tunnel: boolean;
  pts: Pt[];
}
interface RawPoly {
  poly: Pt[][];
  edge: boolean;
  id?: number;
  height?: number;
}

/**
 * Turn vector tiles into a normalised Geography for a frame.
 * Pure with respect to its inputs: the same tiles + frame give the same output
 * (apart from `source.fetchedAt`, which is excluded from `key`).
 */
export async function buildGeographyFromTiles(
  frame: Frame,
  fetchTile: TileFetcher,
  info: TileSourceInfo,
  opts: BuildOptions = {},
): Promise<Geography> {
  const progress = opts.onProgress ?? (() => {});
  const shortEdge = Math.min(frame.widthM, frame.heightM);
  const margin = shortEdge * 0.04;
  const range = pickZoom(frame, info.maxZoom, opts.maxTiles ?? 64, margin);
  if (range.count > 100) throw new AppError('AREA_TOO_LARGE', `tiles=${range.count}`);

  const proj = new LocalProjection(frame.center);
  const clipRect = frameRect(frame, margin);
  const innerRect = frameRect(frame);
  const tolerance = Math.max(0.4, shortEdge / 3500);
  const wide = shortEdge > 5000; // town-scale maps: skip street-furniture detail

  const coords: [number, number][] = [];
  for (let y = range.minY; y <= range.maxY; y++) for (let x = range.minX; x <= range.maxX; x++) coords.push([x, y]);

  const tiles: (Uint8Array | null)[] = new Array(coords.length).fill(null);
  let done = 0;
  let failures = 0;
  let next = 0;
  const workers = Array.from({ length: Math.min(6, coords.length) }, async () => {
    while (next < coords.length) {
      const i = next++;
      try {
        tiles[i] = await fetchTile(range.z, coords[i][0], coords[i][1]);
      } catch {
        failures++;
      }
      done++;
      progress((done / coords.length) * 0.6, 'Collecting streets and places');
    }
  });
  await Promise.all(workers);
  if (failures > 0) throw new AppError('GEODATA_UNAVAILABLE', `tile failures=${failures}/${coords.length}`);

  const rawRoads: RawRoad[] = [];
  const nameLines: { name: string; pts: Pt[] }[] = [];
  const rawAreas = new Map<AreaKind, RawPoly[]>();
  const rawBuildings: RawPoly[] = [];
  const rawWaterways: { cls: Waterway['cls']; name?: string; pts: Pt[] }[] = [];
  const pois = new Map<string, Poi>();
  const places = new Map<string, PlaceName>();
  const n = 2 ** range.z;

  const pushArea = (kind: AreaKind, p: RawPoly) => {
    const arr = rawAreas.get(kind);
    if (arr) arr.push(p);
    else rawAreas.set(kind, [p]);
  };

  tiles.forEach((buf, ti) => {
    if (!buf) return;
    const [tx, ty] = coords[ti];
    let vt: VectorTile;
    try {
      vt = new VectorTile(new PbfReader(buf));
    } catch {
      throw new AppError('GEODATA_UNAVAILABLE', 'tile decode failed');
    }

    const eachFeature = (layerName: string, fn: (f: VectorTileFeature, extent: number) => void) => {
      const layer = vt.layers[layerName];
      if (!layer) return;
      for (let i = 0; i < layer.length; i++) fn(layer.feature(i), layer.extent);
    };
    const toLocal = (x: number, y: number, extent: number): Pt => proj.fromMerc((tx + x / extent) / n, (ty + y / extent) / n);
    const tileRect = (extent: number): Rect => ({ minX: 0, minY: 0, maxX: extent, maxY: extent });

    /** Lines clipped to the tile, projected, then clipped to the frame. */
    const lines = (f: VectorTileFeature, extent: number): Pt[][] => {
      const out: Pt[][] = [];
      for (const part of f.loadGeometry()) {
        const raw: Pt[] = part.map((p) => [p.x, p.y]);
        for (const piece of clipLine(raw, tileRect(extent))) {
          const local = piece.map(([x, y]) => toLocal(x, y, extent));
          if (!rectsOverlap(bboxOf(local), clipRect)) continue;
          for (const c of clipLine(local, clipRect)) out.push(c);
        }
      }
      return out;
    };

    /** Polygons clipped to the tile, projected, clipped to the frame. */
    const polys = (f: VectorTileFeature, extent: number): { poly: Pt[][]; edge: boolean }[] => {
      const rings = f.loadGeometry().map((r) => r.map((p): Pt => [p.x, p.y]));
      const grouped: Pt[][][] = [];
      let outerSign = 0;
      for (const ring of rings) {
        if (ring.length < 3) continue;
        const a = ringArea(ring);
        if (a === 0) continue;
        if (outerSign === 0) outerSign = Math.sign(a);
        if (Math.sign(a) === outerSign || grouped.length === 0) grouped.push([ring]);
        else grouped[grouped.length - 1].push(ring);
      }
      const out: { poly: Pt[][]; edge: boolean }[] = [];
      const tr = tileRect(extent);
      for (const g of grouped) {
        const clipped = clipPoly(g, tr);
        if (!clipped.length) continue;
        const edge = clipped[0].some(([x, y]) => x <= 0 || y <= 0 || x >= extent || y >= extent);
        const local = clipped.map((ring) => ring.map(([x, y]) => toLocal(x, y, extent)));
        if (!rectsOverlap(bboxOf(local[0]), clipRect)) continue;
        const c = clipPoly(local, clipRect);
        if (c.length) out.push({ poly: c, edge });
      }
      return out;
    };

    const insideTile = (f: VectorTileFeature, extent: number): Pt | null => {
      const g = f.loadGeometry()[0]?.[0];
      if (!g || g.x < 0 || g.y < 0 || g.x >= extent || g.y >= extent) return null;
      return toLocal(g.x, g.y, extent);
    };

    eachFeature('transportation', (f, extent) => {
      if (f.type !== 2) return;
      const p = f.properties as Record<string, string | number>;
      const cls = ROAD_CLASS[String(p.class)];
      if (!cls) return;
      if (wide && (cls === 'service' || cls === 'path')) return;
      if (cls === 'service' && (p.service === 'parking_aisle' || p.service === 'driveway')) return;
      if (cls === 'rail' && p.service) return; // sidings & yards
      const tunnel = p.brunnel === 'tunnel';
      if (tunnel && cls !== 'rail' && cls !== 'motorway' && cls !== 'trunk' && cls !== 'primary') return;
      for (const pts of lines(f, extent)) rawRoads.push({ cls, bridge: p.brunnel === 'bridge', tunnel, pts });
    });

    eachFeature('transportation_name', (f, extent) => {
      const name = f.properties.name;
      if (f.type !== 2 || typeof name !== 'string' || !name) return;
      for (const pts of lines(f, extent)) nameLines.push({ name, pts });
    });

    eachFeature('waterway', (f, extent) => {
      if (f.type !== 2) return;
      const c = String(f.properties.class);
      const cls = c === 'river' ? 'river' : c === 'canal' ? 'canal' : c === 'stream' ? 'stream' : null;
      if (!cls || f.properties.brunnel === 'tunnel') return;
      if (wide && cls === 'stream') return;
      const name = typeof f.properties.name === 'string' ? f.properties.name : undefined;
      for (const pts of lines(f, extent)) rawWaterways.push({ cls, name, pts });
    });

    eachFeature('water', (f, extent) => {
      if (f.type !== 3 || f.properties.brunnel === 'tunnel') return;
      for (const p of polys(f, extent)) pushArea('water', p);
    });

    eachFeature('landcover', (f, extent) => {
      if (f.type !== 3) return;
      const sub = String(f.properties.subclass ?? '');
      let kind = LANDCOVER_KIND[String(f.properties.class)];
      if (kind === 'grass' && PARKISH.has(sub)) kind = 'park';
      if (!kind) return;
      for (const p of polys(f, extent)) pushArea(kind, p);
    });

    eachFeature('landuse', (f, extent) => {
      if (f.type !== 3) return;
      const kind = LANDUSE_KIND[String(f.properties.class)];
      if (!kind) return;
      for (const p of polys(f, extent)) pushArea(kind, p);
    });

    eachFeature('park', (f, extent) => {
      if (f.type !== 3) return;
      for (const p of polys(f, extent)) pushArea('park', p);
    });

    if (!wide) {
      eachFeature('building', (f, extent) => {
        if (f.type !== 3) return;
        const h = Number(f.properties.render_height);
        for (const p of polys(f, extent)) rawBuildings.push({ ...p, id: f.id, height: Number.isFinite(h) ? h : undefined });
      });
    }

    const addPoi = (f: VectorTileFeature, extent: number, cls: string, subclass: string) => {
      const name = f.properties.name;
      if (f.type !== 1 || typeof name !== 'string' || !name.trim()) return;
      const pos = insideTile(f, extent);
      if (!pos) return;
      if (pos[0] < innerRect.minX || pos[0] > innerRect.maxX || pos[1] < innerRect.minY || pos[1] > innerRect.maxY) return;
      const category = cls === '__water' ? 'water_feature' : cls === '__aerodrome' ? 'airport' : categorize(cls, subclass, name);
      if (!category) return;
      const id = `p${f.id ?? hashHex(`${name}|${Math.round(pos[0])}|${Math.round(pos[1])}`).slice(0, 12)}`;
      const rank = Number(f.properties.rank);
      pois.set(id, {
        id,
        name: name.trim(),
        category,
        sourceClass: cls.replace(/^__/, ''),
        sourceSubclass: subclass,
        rank: Number.isFinite(rank) ? rank : undefined,
        pos: [Math.round(pos[0] * 10) / 10, Math.round(pos[1] * 10) / 10],
        lngLat: roundLngLat(proj.unproject(pos)),
      });
    };
    eachFeature('poi', (f, e) => addPoi(f, e, String(f.properties.class ?? ''), String(f.properties.subclass ?? '')));
    eachFeature('water_name', (f, e) => addPoi(f, e, '__water', String(f.properties.class ?? 'lake')));
    eachFeature('aerodrome_label', (f, e) => addPoi(f, e, '__aerodrome', 'aerodrome'));

    eachFeature('place', (f, extent) => {
      const name = f.properties.name;
      if (f.type !== 1 || typeof name !== 'string') return;
      const pos = insideTile(f, extent);
      if (!pos) return;
      places.set(`${name}|${f.properties.class}`, { name, cls: String(f.properties.class ?? ''), pos: [Math.round(pos[0]), Math.round(pos[1])] });
    });
  });

  progress(0.7, 'Tracing roads');
  const roads = finishRoads(rawRoads, nameLines, tolerance);
  progress(0.8, 'Shaping parks and water');
  const areas = finishAreas(rawAreas, tolerance, shortEdge);
  const buildings = finishBuildings(rawBuildings, tolerance);
  const waterways = finishWaterways(rawWaterways, tolerance);
  progress(0.92, 'Finding landmarks');

  const poiList = [...pois.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  const sized = areas.filter((a) => ['park', 'pitch', 'school', 'water', 'playground', 'cemetery', 'hospital'].includes(a.kind));
  for (const poi of poiList) {
    for (const a of sized) {
      const hit = a.polys.find((poly) => pointInPoly(poi.pos, poly));
      if (hit) {
        poi.areaM2 = Math.max(poi.areaM2 ?? 0, Math.round(polyArea(hit)));
      }
    }
  }

  if (roads.length === 0 && areas.length === 0 && buildings.length === 0) throw new AppError('NO_GEODATA', 'empty geography');

  const body = {
    frame,
    roads,
    areas,
    buildings,
    waterways,
    pois: poiList,
    places: [...places.values()].sort((a, b) => (a.name < b.name ? -1 : 1)),
  };
  const key = hashHex(JSON.stringify(body) + info.dataVersion);
  progress(1, 'Done');
  return {
    schema: 1,
    key,
    source: {
      provider: info.provider,
      dataVersion: info.dataVersion,
      attribution: info.attribution,
      fetchedAt: (opts.now ? opts.now() : new Date()).toISOString(),
    },
    ...body,
  };
}

function roundLngLat(p: { lat: number; lon: number }) {
  return { lat: Math.round(p.lat * 1e6) / 1e6, lon: Math.round(p.lon * 1e6) / 1e6 };
}

/** Attach street names by proximity, merge fragments into long lines, simplify. */
function finishRoads(raw: RawRoad[], nameLines: { name: string; pts: Pt[] }[], tolerance: number): Road[] {
  // Spatial hash of name-line segments.
  const cell = 40;
  const grid = new Map<string, { name: string; a: Pt; b: Pt }[]>();
  for (const nl of nameLines) {
    for (let i = 1; i < nl.pts.length; i++) {
      const a = nl.pts[i - 1];
      const b = nl.pts[i];
      const x0 = Math.floor(Math.min(a[0], b[0]) / cell);
      const x1 = Math.floor(Math.max(a[0], b[0]) / cell);
      const y0 = Math.floor(Math.min(a[1], b[1]) / cell);
      const y1 = Math.floor(Math.max(a[1], b[1]) / cell);
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++) {
          const k = `${x},${y}`;
          const arr = grid.get(k);
          const seg = { name: nl.name, a, b };
          if (arr) arr.push(seg);
          else grid.set(k, [seg]);
        }
    }
  }
  const nameAt = (p: Pt): string | undefined => {
    const cx = Math.floor(p[0] / cell);
    const cy = Math.floor(p[1] / cell);
    let best: string | undefined;
    let bestD = 8 * 8;
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++)
        for (const s of grid.get(`${x},${y}`) ?? []) {
          const d = segDist2(p, s.a, s.b);
          if (d < bestD) {
            bestD = d;
            best = s.name;
          }
        }
    return best;
  };

  const groups = new Map<string, { cls: RoadClass; name?: string; bridge: boolean; tunnel: boolean; lines: Pt[][] }>();
  for (const r of raw) {
    let name: string | undefined;
    if (r.cls !== 'rail' && r.cls !== 'path') {
      const votes = new Map<string, number>();
      const len = lineLength(r.pts);
      for (const t of [0.25, 0.5, 0.75]) {
        const target = len * t;
        let acc = 0;
        let p = r.pts[0];
        for (let i = 1; i < r.pts.length; i++) {
          const d = Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
          if (acc + d >= target && d > 0) {
            const f = (target - acc) / d;
            p = [r.pts[i - 1][0] + (r.pts[i][0] - r.pts[i - 1][0]) * f, r.pts[i - 1][1] + (r.pts[i][1] - r.pts[i - 1][1]) * f];
            break;
          }
          acc += d;
        }
        const nm = nameAt(p);
        if (nm) votes.set(nm, (votes.get(nm) ?? 0) + 1);
      }
      let top = 0;
      for (const [nm, v] of votes)
        if (v > top) {
          top = v;
          name = nm;
        }
      if (top < 2) name = undefined;
    }
    const k = `${r.cls}|${name ?? ''}|${r.bridge ? 1 : 0}|${r.tunnel ? 1 : 0}`;
    const g = groups.get(k);
    if (g) g.lines.push(r.pts);
    else groups.set(k, { cls: r.cls, name, bridge: r.bridge, tunnel: r.tunnel, lines: [r.pts] });
  }

  const out: Road[] = [];
  const seenIds = new Set<string>();
  for (const [k, g] of groups) {
    for (const line of mergeLines(g.lines)) {
      const pts = quantize(simplify(line, tolerance));
      const len = lineLength(pts);
      // Short unnamed service stubs (driveways, loading bays) are noise on an illustrated map.
      if (pts.length < 2 || len < 4 || (g.cls === 'service' && !g.name && len < 70)) continue;
      const a = pts[0];
      const b = pts[pts.length - 1];
      // Orientation-independent id so a road keeps its identity however tiles are ordered.
      const ends = [`${a[0]},${a[1]}`, `${b[0]},${b[1]}`].sort().join('|');
      let id = `r${hashHex(`${k}|${ends}|${pts.length}`).slice(0, 12)}`;
      // Two parallel carriageways can share endpoints; keep ids unique and stable.
      for (let dup = 2; seenIds.has(id); dup++) id = `r${hashHex(`${k}|${ends}|${pts.length}|${dup}`).slice(0, 12)}`;
      seenIds.add(id);
      const road: Road = { id, cls: g.cls, pts };
      if (g.name) road.name = g.name;
      if (g.bridge) road.bridge = true;
      if (g.tunnel) road.tunnel = true;
      out.push(road);
    }
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

type PCRing = [number, number][];
function unionPolys(polys: Pt[][][]): Pt[][][] {
  if (polys.length <= 1) return polys;
  try {
    const closed = polys.map((poly) => poly.map((ring) => [...ring, ring[0]] as PCRing));
    const res = polygonClipping.union(closed[0], ...closed.slice(1));
    return res.map((poly) => poly.map((ring) => ring.slice(0, -1) as Pt[]));
  } catch {
    return polys; // degenerate input: draw un-merged rather than fail the map
  }
}

function finishAreas(raw: Map<AreaKind, RawPoly[]>, tolerance: number, shortEdge: number): Area[] {
  const out: Area[] = [];
  const minArea = Math.max(30, (shortEdge / 400) ** 2);
  for (const kind of [...raw.keys()].sort()) {
    const merged = unionPolys(raw.get(kind)!.map((p) => p.poly));
    for (const poly of merged) {
      const simple = poly
        .map((ring, i) => quantize(simplifyRing(ring, i === 0 ? tolerance : tolerance * 1.5)))
        .filter((ring, i) => ring.length >= 3 && (i === 0 || Math.abs(ringArea(ring)) > minArea));
      if (!simple.length || simple[0].length < 3) continue;
      if (polyArea(simple) < minArea) continue;
      const c = ringCentroid(simple[0]);
      out.push({ id: `a${hashHex(`${kind}|${Math.round(c[0])}|${Math.round(c[1])}|${Math.round(polyArea(simple))}`).slice(0, 12)}`, kind, polys: [simple] });
    }
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

function finishBuildings(raw: RawPoly[], tolerance: number): Building[] {
  const inner = raw.filter((b) => !b.edge);
  const edge = raw.filter((b) => b.edge);
  const mergedEdge = unionPolys(edge.map((b) => b.poly)).map((poly): RawPoly => ({ poly, edge: true }));
  const seen = new Set<string>();
  const out: Building[] = [];
  for (const b of [...inner, ...mergedEdge]) {
    const ring = quantize(simplifyRing(b.poly[0], Math.min(tolerance, 0.8)));
    if (ring.length < 3) continue;
    const area = Math.abs(ringArea(ring));
    if (area < 14) continue;
    const c = ringCentroid(ring);
    const id = `b${hashHex(`${Math.round(c[0] * 2)}|${Math.round(c[1] * 2)}|${Math.round(area)}`).slice(0, 12)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const building: Building = { id, ring };
    if (b.height) building.height = b.height;
    out.push(building);
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

function finishWaterways(raw: { cls: Waterway['cls']; name?: string; pts: Pt[] }[], tolerance: number): Waterway[] {
  const groups = new Map<string, { cls: Waterway['cls']; name?: string; lines: Pt[][] }>();
  for (const w of raw) {
    const k = `${w.cls}|${w.name ?? ''}`;
    const g = groups.get(k);
    if (g) g.lines.push(w.pts);
    else groups.set(k, { cls: w.cls, name: w.name, lines: [w.pts] });
  }
  const out: Waterway[] = [];
  for (const [k, g] of groups) {
    for (const line of mergeLines(g.lines)) {
      const pts = quantize(simplify(line, tolerance));
      if (pts.length < 2 || lineLength(pts) < 15) continue;
      const w: Waterway = { id: `w${hashHex(`${k}|${pts[0]}|${pts[pts.length - 1]}`).slice(0, 12)}`, cls: g.cls, pts };
      if (g.name) w.name = g.name;
      out.push(w);
    }
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}
