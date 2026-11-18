import type { Pt } from '@maploom/core';
import type { Rect } from './projection';

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function lineLength(pts: Pt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
  return len;
}

/** Signed area (shoelace). Positive or negative depending on winding. */
export function ringArea(ring: Pt[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return a / 2;
}

export function polyArea(poly: Pt[][]): number {
  if (!poly.length) return 0;
  let a = Math.abs(ringArea(poly[0]));
  for (let i = 1; i < poly.length; i++) a -= Math.abs(ringArea(poly[i]));
  return Math.max(0, a);
}

export function ringCentroid(ring: Pt[]): Pt {
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    x += (ring[j][0] + ring[i][0]) * f;
    y += (ring[j][1] + ring[i][1]) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-9) {
    const sx = ring.reduce((s, p) => s + p[0], 0);
    const sy = ring.reduce((s, p) => s + p[1], 0);
    return [sx / Math.max(1, ring.length), sy / Math.max(1, ring.length)];
  }
  return [x / (3 * a), y / (3 * a)];
}

export function pointInRing(p: Pt, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPoly(p: Pt, poly: Pt[][]): boolean {
  if (!poly.length || !pointInRing(p, poly[0])) return false;
  for (let i = 1; i < poly.length; i++) if (pointInRing(p, poly[i])) return false;
  return true;
}

export function bboxOf(pts: Pt[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/** Clip a polyline to a rectangle (Liang–Barsky per segment). Returns 0..n pieces. */
export function clipLine(pts: Pt[], r: Rect): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    let t0 = 0;
    let t1 = 1;
    let ok = true;
    const edges: [number, number][] = [
      [-dx, a[0] - r.minX],
      [dx, r.maxX - a[0]],
      [-dy, a[1] - r.minY],
      [dy, r.maxY - a[1]],
    ];
    for (const [p, q] of edges) {
      if (p === 0) {
        if (q < 0) {
          ok = false;
          break;
        }
      } else {
        const t = q / p;
        if (p < 0) {
          if (t > t1) {
            ok = false;
            break;
          }
          if (t > t0) t0 = t;
        } else {
          if (t < t0) {
            ok = false;
            break;
          }
          if (t < t1) t1 = t;
        }
      }
    }
    if (!ok) {
      if (cur.length > 1) out.push(cur);
      cur = [];
      continue;
    }
    const p0: Pt = t0 === 0 ? a : [a[0] + dx * t0, a[1] + dy * t0];
    const p1: Pt = t1 === 1 ? b : [a[0] + dx * t1, a[1] + dy * t1];
    if (cur.length === 0) cur.push(p0);
    else if (t0 > 0) {
      if (cur.length > 1) out.push(cur);
      cur = [p0];
    }
    cur.push(p1);
    if (t1 < 1) {
      if (cur.length > 1) out.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

/** Clip a ring to a rectangle (Sutherland–Hodgman). Returns [] when nothing is left. */
export function clipRing(ring: Pt[], r: Rect): Pt[] {
  let pts = ring;
  const clipEdge = (inside: (p: Pt) => boolean, intersect: (a: Pt, b: Pt) => Pt) => {
    const res: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const prev = pts[(i + pts.length - 1) % pts.length];
      const cin = inside(cur);
      const pin = inside(prev);
      if (cin) {
        if (!pin) res.push(intersect(prev, cur));
        res.push(cur);
      } else if (pin) res.push(intersect(prev, cur));
    }
    pts = res;
  };
  const ix = (x: number) => (a: Pt, b: Pt): Pt => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
  const iy = (y: number) => (a: Pt, b: Pt): Pt => [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y];
  clipEdge((p) => p[0] >= r.minX, ix(r.minX));
  if (pts.length) clipEdge((p) => p[0] <= r.maxX, ix(r.maxX));
  if (pts.length) clipEdge((p) => p[1] >= r.minY, iy(r.minY));
  if (pts.length) clipEdge((p) => p[1] <= r.maxY, iy(r.maxY));
  return pts.length >= 3 ? pts : [];
}

export function clipPoly(poly: Pt[][], r: Rect): Pt[][] {
  const outer = clipRing(poly[0] ?? [], r);
  if (!outer.length) return [];
  const out = [outer];
  for (let i = 1; i < poly.length; i++) {
    const hole = clipRing(poly[i], r);
    if (hole.length) out.push(hole);
  }
  return out;
}

/** Douglas–Peucker simplification. Endpoints are always preserved. */
export function simplify(pts: Pt[], tolerance: number): Pt[] {
  if (pts.length <= 2 || tolerance <= 0) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  const tol2 = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    const [ax, ay] = pts[first];
    const [bx, by] = pts[last];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = pts[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol2 && idx > 0) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

export function simplifyRing(ring: Pt[], tolerance: number): Pt[] {
  if (ring.length <= 4) return ring;
  const closed = [...ring, ring[0]];
  const s = simplify(closed, tolerance);
  s.pop();
  return s.length >= 3 ? s : ring;
}

export function quantize(pts: Pt[], step = 0.1): Pt[] {
  const inv = 1 / step;
  const out: Pt[] = [];
  let lx = NaN;
  let ly = NaN;
  for (const [x, y] of pts) {
    const qx = Math.round(x * inv) / inv;
    const qy = Math.round(y * inv) / inv;
    if (qx !== lx || qy !== ly) out.push([qx, qy]);
    lx = qx;
    ly = qy;
  }
  return out;
}

/**
 * Join polylines that share endpoints (within `snap` metres) into longer
 * chains. Only nodes where exactly two line ends meet are joined, so real
 * junctions stay intact. Deterministic: input order decides chain order.
 */
export function mergeLines(lines: Pt[][], snap = 0.6): Pt[][] {
  const key = (p: Pt) => `${Math.round(p[0] / snap)},${Math.round(p[1] / snap)}`;
  const ends = new Map<string, { line: number; head: boolean }[]>();
  lines.forEach((l, i) => {
    if (l.length < 2) return;
    for (const head of [true, false]) {
      const k = key(head ? l[0] : l[l.length - 1]);
      const arr = ends.get(k);
      if (arr) arr.push({ line: i, head });
      else ends.set(k, [{ line: i, head }]);
    }
  });
  const used = new Uint8Array(lines.length);
  const out: Pt[][] = [];
  const next = (p: Pt, self: number) => {
    const arr = ends.get(key(p));
    if (!arr || arr.length !== 2) return null;
    const other = arr[0].line === self ? arr[1] : arr[0];
    if (other.line === self || used[other.line]) return null;
    return other;
  };
  for (let i = 0; i < lines.length; i++) {
    if (used[i] || lines[i].length < 2) continue;
    used[i] = 1;
    let chain = lines[i].slice();
    let tail = i;
    for (;;) {
      const n = next(chain[chain.length - 1], tail);
      if (!n) break;
      used[n.line] = 1;
      const seg = n.head ? lines[n.line] : lines[n.line].slice().reverse();
      chain = chain.concat(seg.slice(1));
      tail = n.line;
    }
    let headLine = i;
    for (;;) {
      const n = next(chain[0], headLine);
      if (!n) break;
      used[n.line] = 1;
      const seg = n.head ? lines[n.line].slice().reverse() : lines[n.line];
      chain = seg.slice(0, -1).concat(chain);
      headLine = n.line;
    }
    out.push(chain);
  }
  return out;
}

/** Point at a given distance along a polyline, with the local direction angle (radians). */
export function pointAlong(pts: Pt[], d: number): { p: Pt; angle: number } {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    if (acc + seg >= d && seg > 0) {
      const t = (d - acc) / seg;
      return {
        p: [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t],
        angle: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]),
      };
    }
    acc += seg;
  }
  const n = pts.length;
  return { p: pts[n - 1], angle: n > 1 ? Math.atan2(pts[n - 1][1] - pts[n - 2][1], pts[n - 1][0] - pts[n - 2][0]) : 0 };
}

/** Squared distance from a point to a segment. */
export function segDist2(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const ex = a[0] + t * dx - p[0];
  const ey = a[1] + t * dy - p[1];
  return ex * ex + ey * ey;
}
