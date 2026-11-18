import type { Frame, LngLat, Pt } from '@maploom/core';

export const EARTH_RADIUS_M = 6378137;
const CIRC = 2 * Math.PI * EARTH_RADIUS_M;
const D2R = Math.PI / 180;

/** Normalised Web-Mercator coordinates in [0,1], y growing south. */
export function mercX(lon: number): number {
  return (lon + 180) / 360;
}
export function mercY(lat: number): number {
  const s = Math.sin(lat * D2R);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}
export function unmercX(x: number): number {
  return x * 360 - 180;
}
export function unmercY(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

/**
 * Local projection around a centre: Web Mercator scaled so that 1 unit = 1 true
 * metre at the centre latitude. Conformal, so shapes match the interactive
 * basemap exactly; scale error is < 0.1% across a 20 km neighbourhood.
 */
export class LocalProjection {
  readonly center: LngLat;
  private readonly mx0: number;
  private readonly my0: number;
  private readonly k: number;

  constructor(center: LngLat) {
    this.center = center;
    this.mx0 = mercX(center.lon);
    this.my0 = mercY(center.lat);
    this.k = CIRC * Math.cos(center.lat * D2R);
  }

  /** Normalised mercator -> local metres. */
  fromMerc(mx: number, my: number): Pt {
    return [(mx - this.mx0) * this.k, (my - this.my0) * this.k];
  }

  project(p: LngLat): Pt {
    return this.fromMerc(mercX(p.lon), mercY(p.lat));
  }

  unproject(pt: Pt): LngLat {
    return { lon: unmercX(pt[0] / this.k + this.mx0), lat: unmercY(pt[1] / this.k + this.my0) };
  }
}

export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function frameRect(frame: Frame, marginM = 0): Rect {
  return {
    minX: -frame.widthM / 2 - marginM,
    minY: -frame.heightM / 2 - marginM,
    maxX: frame.widthM / 2 + marginM,
    maxY: frame.heightM / 2 + marginM,
  };
}

/** Geographic bounds of a frame: [south, west, north, east]. */
export function frameBounds(frame: Frame, marginM = 0): [number, number, number, number] {
  const proj = new LocalProjection(frame.center);
  const r = frameRect(frame, marginM);
  const nw = proj.unproject([r.minX, r.minY]);
  const se = proj.unproject([r.maxX, r.maxY]);
  return [se.lat, nw.lon, nw.lat, se.lon];
}

export interface TileRange {
  z: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  count: number;
}

export function tileRangeForFrame(frame: Frame, z: number, marginM = 0): TileRange {
  const [south, west, north, east] = frameBounds(frame, marginM);
  const n = 2 ** z;
  const clamp = (v: number) => Math.max(0, Math.min(n - 1, v));
  const minX = clamp(Math.floor(mercX(west) * n));
  const maxX = clamp(Math.floor(mercX(east) * n));
  const minY = clamp(Math.floor(mercY(north) * n));
  const maxY = clamp(Math.floor(mercY(south) * n));
  return { z, minX, maxX, minY, maxY, count: (maxX - minX + 1) * (maxY - minY + 1) };
}

/** Highest zoom (<= maxZoom) whose tile count stays within budget. */
export function pickZoom(frame: Frame, maxZoom = 14, maxTiles = 64, marginM = 0): TileRange {
  for (let z = maxZoom; z > 8; z--) {
    const range = tileRangeForFrame(frame, z, marginM);
    if (range.count <= maxTiles) return range;
  }
  return tileRangeForFrame(frame, 8, marginM);
}

export function haversineM(a: LngLat, b: LngLat): number {
  const dLat = (b.lat - a.lat) * D2R;
  const dLon = (b.lon - a.lon) * D2R;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * D2R) * Math.cos(b.lat * D2R) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export const METERS_PER_MILE = 1609.344;

export interface CoveragePreset {
  id: string;
  label: string;
  hint: string;
  /** Width of the SHORT edge of the map in metres. */
  shortEdgeM: number;
}

export const COVERAGE_PRESETS: CoveragePreset[] = [
  { id: 'block', label: 'Our streets', hint: 'A few blocks around home', shortEdgeM: 800 },
  { id: 'small', label: 'Small neighbourhood', hint: 'About ½ mile across', shortEdgeM: 1200 },
  { id: 'medium', label: 'Neighbourhood', hint: 'About 1 mile across', shortEdgeM: 1 * METERS_PER_MILE },
  { id: 'large', label: 'Big neighbourhood', hint: 'About 2 miles across', shortEdgeM: 2 * METERS_PER_MILE },
  { id: 'town', label: 'Whole town', hint: 'About 5 miles across', shortEdgeM: 5 * METERS_PER_MILE },
];

/** Build a frame whose short edge is `shortEdgeM` with the given aspect (width / height). */
export function makeFrame(center: LngLat, shortEdgeM: number, aspect: number): Frame {
  const widthM = aspect >= 1 ? shortEdgeM * aspect : shortEdgeM;
  const heightM = aspect >= 1 ? shortEdgeM : shortEdgeM / aspect;
  return { center, widthM: Math.round(widthM), heightM: Math.round(heightM) };
}

/** Change a frame's aspect ratio while keeping its short edge. */
export function reframe(frame: Frame, aspect: number): Frame {
  return makeFrame(frame.center, Math.min(frame.widthM, frame.heightM), aspect);
}

/** MapLibre-style zoom at which `widthM` spans `viewportPx` CSS pixels (512px tiles). */
export function zoomForWidth(widthM: number, lat: number, viewportPx: number): number {
  const metersPerPxAtZ0 = (CIRC * Math.cos(lat * D2R)) / 512;
  return Math.log2((metersPerPxAtZ0 * viewportPx) / widthM);
}
