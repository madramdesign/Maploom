import { CATEGORY_META, hash32, prng, type Design, type Geography, type IconId, type Landmark, type Pt, type Road, type RoadClass } from '@maploom/core';
import { LocalProjection, lineLength, pointAlong, pointInPoly, bboxOf, ringArea, ringCentroid } from '@maploom/geo';
import type { FontBook, Typeface } from './fonts';
import { iconMarkup, type IconPaint } from './icons';
import { getStyle, type MapStyle } from './styles';
import { Collider, linePath, n, polyPath, shade, type Box } from './util';

/**
 * The renderer: (Geography, Design, MapStyle) -> SVG. Pure and deterministic —
 * no clocks, no Math.random, no DOM. The same inputs give byte-identical
 * output in the browser preview and in the server-side print export.
 */

export const ART_SHORT_EDGE = 1000;
export const ATTRIBUTION = '© OpenStreetMap contributors';

export interface RenderItem {
  id: string;
  kind: 'home' | 'landmark' | 'text' | 'title';
  /** Bounding box in art units. */
  box: Box;
  /** Anchor in art units (what dragging moves). */
  x: number;
  y: number;
}

export interface ArtSize {
  width: number;
  height: number;
  /** Art units per metre. */
  scale: number;
}

export function artSize(frame: Geography['frame']): ArtSize {
  const short = Math.min(frame.widthM, frame.heightM);
  const scale = ART_SHORT_EDGE / short;
  return { width: Math.round(frame.widthM * scale), height: Math.round(frame.heightM * scale), scale };
}

interface Ctx {
  geo: Geography;
  design: Design;
  style: MapStyle;
  display: Typeface;
  label: Typeface;
  W: number;
  H: number;
  /** art units per metre */
  s: number;
  /** detail factor: thinner strokes on maps that cover more ground */
  k: number;
  toArt: (p: Pt) => Pt;
  hidden: Set<string>;
}

function makeCtx(geo: Geography, design: Design, fonts: Partial<FontBook>): Ctx {
  const style = getStyle(design.styleId);
  const display = fonts[style.fonts.display];
  const label = fonts[style.fonts.label];
  if (!display || !label) throw new Error(`Fonts for style "${style.id}" are not loaded`);
  const { width: W, height: H, scale: s } = artSize(geo.frame);
  const short = Math.min(geo.frame.widthM, geo.frame.heightM);
  const k = Math.max(0.34, Math.min(1.45, (1500 / short) ** 0.55));
  const hw = geo.frame.widthM / 2;
  const hh = geo.frame.heightM / 2;
  return { geo, design, style, display, label, W, H, s, k, toArt: (p) => [(p[0] + hw) * s, (p[1] + hh) * s], hidden: new Set(design.hidden) };
}

const ROAD_RANK: Record<RoadClass, number> = { path: 0, service: 1, rail: 2, minor: 3, tertiary: 4, secondary: 5, primary: 6, trunk: 7, motorway: 8 };
const MAJOR = new Set<RoadClass>(['motorway', 'trunk', 'primary', 'secondary']);
/** Buildings smaller than this become storybook houses in styles that use them. */
const HOUSE_MAX_M2 = 700;
const AREA_ORDER = ['residential', 'commercial', 'industrial', 'farmland', 'school', 'hospital', 'cemetery', 'sand', 'grass', 'park', 'wood', 'wetland', 'pitch', 'playground', 'water'] as const;

/* ------------------------------------------------------------------ base */

export function renderBaseLayer(geo: Geography, design: Design, fonts: Partial<FontBook>): string {
  const c = makeCtx(geo, design, fonts);
  const { style, W, H, k } = c;
  const col = style.colors;
  const L = design.layers;
  const out: string[] = [];
  const defs: string[] = [];

  out.push(`<rect width="${W}" height="${H}" fill="${col.land}"/>`);
  // Storybook styles get chunkier trees.
  const treeSize = Math.max(5.5, 10.5 * Math.min(1.1, k)) * (style.effects.houses ? 1.55 : 1);
  let treeDefs = false;

  // Play-rug generalisation: keep main streets, longer side streets and the street nearest home.
  let keep: Set<string> | null = null;
  if (style.effects.fewerRoads) {
    keep = new Set<string>();
    const home = new LocalProjection(geo.frame.center).project(design.home.lngLat);
    const minLen = Math.max(170, Math.min(geo.frame.widthM, geo.frame.heightM) * 0.24);
    let nearest: { id: string; d: number } | null = null;
    for (const r of geo.roads) {
      if (r.cls === 'path' || r.cls === 'rail') {
        keep.add(r.id);
        continue;
      }
      if (r.cls === 'service') continue;
      if (r.cls !== 'minor' || lineLength(r.pts) >= minLen) keep.add(r.id);
      for (const p of r.pts) {
        const d = Math.hypot(p[0] - home[0], p[1] - home[1]);
        if (!nearest || d < nearest.d) nearest = { id: r.id, d };
      }
    }
    if (nearest) keep.add(nearest.id);
  }

  // --- flowers on open ground (pure decoration; everything drawn later covers them) ---
  if (L.decorations && style.effects.flowers) {
    const r = prng(hash32(`flowers${geo.key}`));
    const petals = ['#FFFFFF', '#FFE066', '#FF8FB1'];
    const groups: string[][] = [[], [], []];
    const tufts: string[] = [];
    const looseTrees: { x: number; y: number; v: number }[] = [];
    // Coarse map of where streets run, so decorative trees never sit half under a road.
    const cell = 17;
    const busy = new Set<string>();
    for (const rd of geo.roads) {
      if (rd.cls === 'path' || (keep && !keep.has(rd.id))) continue;
      const pts = rd.pts.map(c.toArt);
      for (let i = 1; i < pts.length; i++) {
        const steps = Math.max(1, Math.ceil(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) / (cell / 2)));
        for (let t = 0; t <= steps; t++) busy.add(`${Math.floor((pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * t) / steps) / cell)},${Math.floor((pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * t) / steps) / cell)}`);
      }
    }
    const nearRoad = (x: number, y: number) => {
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (busy.has(`${cx + dx},${cy + dy}`)) return true;
      return false;
    };
    const step = 62;
    for (let y = step / 2; y < H; y += step)
      for (let x = step / 2; x < W; x += step) {
        const px = x + (r() - 0.5) * step * 0.9;
        const py = y + (r() - 0.5) * step * 0.9;
        const kind = r();
        if (kind < 0.45) groups[Math.floor(r() * 3)].push(`M${n(px - 3)} ${n(py)}a3 3 0 1 0 6 0a3 3 0 1 0 -6 0`);
        else if (kind < 0.72) tufts.push(`M${n(px - 3)} ${n(py)}l1.5 -4 1.5 4 1.5 -5 1.5 5`);
        else if (style.effects.trees && L.parks && kind > 0.72 && !nearRoad(px, py)) looseTrees.push({ x: px, y: py, v: Math.floor(r() * col.tree.length) });
      }
    out.push(`<path d="${tufts.join('')}" fill="none" stroke="${shade(col.land, -0.28)}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`);
    groups.forEach((g, i) => g.length && out.push(`<path d="${g.join('')}" fill="${petals[i]}" stroke="${shade(col.land, -0.35)}" stroke-width=".7"/>`));
    if (looseTrees.length) {
      defs.push(treeSymbols(style, treeSize));
      treeDefs = true;
      out.push(`<g data-kind="trees">${looseTrees.map((t) => `<use href="#tree${t.v}" x="${n(t.x)}" y="${n(t.y)}"/>`).join('')}</g>`);
    }
  }

  // --- areas (land use, parks, water) ---
  const areasByKind = new Map<string, typeof geo.areas>();
  for (const a of geo.areas) {
    if (c.hidden.has(a.id)) continue;
    const list = areasByKind.get(a.kind);
    if (list) list.push(a);
    else areasByKind.set(a.kind, [a]);
  }
  const artPolys = new Map<string, Pt[][][]>();
  const toArtPolys = (id: string, polys: Pt[][][]) => {
    let v = artPolys.get(id);
    if (!v) {
      v = polys.map((poly) => poly.map((ring) => ring.map(c.toArt)));
      artPolys.set(id, v);
    }
    return v;
  };
  for (const kind of AREA_ORDER) {
    const isWater = kind === 'water';
    if (isWater ? !L.water : !L.parks && kind !== 'residential' && kind !== 'commercial' && kind !== 'industrial') continue;
    const fill = isWater ? col.water : col.areas[kind];
    if (!fill) continue;
    const stroke = isWater ? col.waterStroke : kind === 'residential' || kind === 'commercial' || kind === 'industrial' ? null : col.areaStroke;
    const sw = style.strokes.area * Math.max(0.6, k);
    for (const a of areasByKind.get(kind) ?? []) {
      const d = toArtPolys(a.id, a.polys).map(polyPath).join('');
      if (style.effects.wash) {
        // Watercolour: three translucent, slightly mis-registered washes + a soft darker rim.
        const r = prng(hash32(a.id));
        out.push(`<g data-id="${a.id}" data-kind="area" fill="${fill}" fill-rule="evenodd">`);
        out.push(`<path d="${d}" fill-opacity=".55"/>`);
        for (let i = 0; i < 2; i++) out.push(`<path d="${d}" fill-opacity=".4" transform="translate(${n((r() - 0.5) * 6)} ${n((r() - 0.5) * 6)})"/>`);
        out.push(`<path d="${d}" fill="none" stroke="${shade(fill, -0.22)}" stroke-width="1.4" stroke-opacity=".45" stroke-linejoin="round"/></g>`);
      } else {
        out.push(`<path data-id="${a.id}" data-kind="area" d="${d}" fill="${fill}" fill-rule="evenodd"${stroke && sw > 0 ? ` stroke="${stroke}" stroke-width="${n(sw)}" stroke-linejoin="round"` : ''}/>`);
      }
      if (kind === 'pitch' && style.effects.pitchLines) out.push(`<path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="${n(1.6 * k)}" stroke-opacity=".7" stroke-dasharray="${n(5 * k)} ${n(3 * k)}" stroke-linejoin="round"/>`);
    }
  }

  // --- waterways ---
  if (L.water) {
    for (const w of geo.waterways) {
      if (c.hidden.has(w.id)) continue;
      const width = (w.cls === 'river' ? 12 : w.cls === 'canal' ? 7 : 3.4) * k;
      const d = linePath(w.pts.map(c.toArt));
      if (col.waterStroke) out.push(`<path d="${d}" fill="none" stroke="${col.waterStroke}" stroke-width="${n(width + style.strokes.area * 2 * k)}" stroke-linecap="round" stroke-linejoin="round"/>`);
      out.push(`<path data-id="${w.id}" data-kind="waterway" d="${d}" fill="none" stroke="${col.water}" stroke-width="${n(width)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
  }

  // --- decorations: waves and trees, scattered deterministically ---
  if (L.decorations) {
    if (style.effects.waves && L.water) {
      const waves: string[] = [];
      for (const a of areasByKind.get('water') ?? []) scatter(a.id, toArtPolys(a.id, a.polys), 46, 260, (x, y) => waves.push(`M${n(x - 7)} ${n(y)}q3.5 -4 7 0t7 0`));
      if (waves.length) out.push(`<path d="${waves.join('')}" fill="none" stroke="${col.waterDetail}" stroke-width="1.6" stroke-linecap="round" stroke-opacity=".75"/>`);
    }
    if (style.effects.trees && L.parks) {
      const size = treeSize;
      if (!treeDefs) defs.push(treeSymbols(style, size));
      const trees: { x: number; y: number; v: number }[] = [];
      for (const kind of ['park', 'wood'] as const)
        for (const a of areasByKind.get(kind) ?? []) scatter(a.id, toArtPolys(a.id, a.polys), kind === 'wood' ? size * 2.4 : size * 4.6, kind === 'wood' ? 500 : 140, (x, y, r) => trees.push({ x, y, v: Math.floor(r * col.tree.length) }));
      trees.sort((a, b) => a.y - b.y || a.x - b.x);
      out.push(`<g data-kind="trees">${trees.slice(0, 2600).map((t) => `<use href="#tree${t.v}" x="${n(t.x)}" y="${n(t.y)}"/>`).join('')}</g>`);
    }
  }

  // --- buildings ---
  if (L.buildings && geo.buildings.length) {
    const sw = style.strokes.building * Math.max(0.55, k);
    const visible = geo.buildings.filter((b) => !c.hidden.has(b.id) && !(style.effects.houses && Math.abs(ringArea(b.ring)) < HOUSE_MAX_M2));
    const paths = visible.map((b) => ({ b, d: `${linePath(b.ring.map(c.toArt))}Z` }));
    if (col.buildingShadow) out.push(`<path d="${paths.map((p) => p.d).join('')}" fill="${col.buildingShadow}" transform="translate(${n(1.6 * k)} ${n(1.6 * k)})"/>`);
    const stroke = col.buildingStroke && sw > 0 ? ` stroke="${col.buildingStroke}" stroke-width="${n(sw)}" stroke-linejoin="${style.effects.buildingRadius ? 'round' : 'miter'}"` : '';
    out.push(`<g data-kind="buildings"${stroke}${style.effects.wash ? ' fill-opacity=".85"' : ''}>`);
    for (const { b, d } of paths) out.push(`<path data-id="${b.id}" data-kind="building" d="${d}" fill="${col.buildings[hash32(b.id) % col.buildings.length]}"/>`);
    out.push('</g>');
  }

  // --- roads ---
  const roadVisible = (r: Road) => {
    if (c.hidden.has(r.id) || (r.tunnel && r.cls !== 'rail')) return false;
    if (r.cls === 'rail') return L.rail && !r.tunnel;
    if (r.cls === 'path') return L.paths;
    if (r.cls === 'minor' || r.cls === 'service') return L.minorRoads;
    return true;
  };
  const roads = geo.roads
    .filter((r) => roadVisible(r) && (!keep || keep.has(r.id)))
    .sort((a, b) => ROAD_RANK[a.cls] - ROAD_RANK[b.cls] || (a.id < b.id ? -1 : 1));
  const artRoads = roads.map((r) => ({ r, pts: r.pts.map(c.toArt), w: Math.max(0.5, style.roads.width[r.cls] * k) }));
  const cap = 'stroke-linecap="round" stroke-linejoin="round" fill="none"';

  for (const { r, pts, w } of artRoads) {
    if (r.cls === 'path') out.push(`<path data-id="${r.id}" data-kind="road" d="${linePath(pts)}" ${cap} stroke="${col.path}" stroke-width="${n(w)}" stroke-dasharray="${n(w * 0.2)} ${n(w * 2.2)}"/>`);
  }
  for (const { r, pts, w } of artRoads) {
    if (r.cls !== 'rail') continue;
    const d = linePath(pts);
    out.push(`<path d="${d}" ${cap} stroke="${col.rail}" stroke-width="${n(w)}"/><path data-id="${r.id}" data-kind="road" d="${d}" fill="none" stroke="${col.rail}" stroke-width="${n(w * 3.2)}" stroke-dasharray="${n(w * 0.55)} ${n(w * 3)}"/>`);
  }
  const drivable = artRoads.filter(({ r }) => r.cls !== 'path' && r.cls !== 'rail');
  if (col.roadCasing && style.roads.casing > 0) {
    const cw = style.roads.casing * Math.max(0.6, k);
    // One path per width keeps the SVG small; casings never need to be clicked.
    const byW = new Map<string, string[]>();
    for (const { pts, w } of drivable) {
      const key = n(w + cw * 2);
      const arr = byW.get(key);
      if (arr) arr.push(linePath(pts));
      else byW.set(key, [linePath(pts)]);
    }
    for (const [w, ds] of byW) out.push(`<path d="${ds.join('')}" ${cap} stroke="${col.roadCasing}" stroke-width="${w}"/>`);
  }
  for (const { r, pts, w } of drivable) out.push(`<path data-id="${r.id}" data-kind="road" d="${linePath(pts)}" ${cap} stroke="${MAJOR.has(r.cls) ? col.roadMajor : col.roadMinor}" stroke-width="${n(w)}"/>`);
  if (col.centerLine) {
    const lines = drivable.filter(({ r, w }) => style.roads.centerLineClasses.includes(r.cls) && w >= 7.5);
    for (const { pts, w } of lines) out.push(`<path d="${linePath(pts)}" fill="none" stroke="${col.centerLine}" stroke-width="${n(Math.max(0.9, w * 0.085))}" stroke-dasharray="${n(w * 0.5)} ${n(w * 0.55)}" stroke-opacity=".9"/>`);
  }

  const occupied: Box[] = [];

  // --- toy cars (decoration, seeded per road) ---
  if (L.decorations && style.effects.cars) {
    const paints = ['#FF5A5F', '#FFD166', '#4DABF7', '#FFFFFF', '#51CF66', '#FF922B'];
    defs.push(paints.map((fill, i) => `<symbol id="car${i}" overflow="visible"><rect x="-7" y="-3.6" width="14" height="7.2" rx="2.8" fill="${fill}" stroke="${col.ink}" stroke-width="1.1"/><rect x="-2.6" y="-2.7" width="6" height="5.4" rx="1.4" fill="#D6F1FF" stroke="${col.ink}" stroke-width=".8"/><circle cx="6" cy="-2.1" r=".9" fill="#FFF3B0"/><circle cx="6" cy="2.1" r=".9" fill="#FFF3B0"/></symbol>`).join(''));
    const cars: string[] = [];
    for (const { r, pts, w } of drivable) {
      if (cars.length >= 36 || w < 12 || r.cls === 'service') continue;
      const len = lineLength(pts);
      if (len < 140) continue;
      const rnd = prng(hash32(`car${r.id}`));
      if (rnd() > (MAJOR.has(r.cls) ? 0.9 : 0.45)) continue;
      const at = pointAlong(pts, len * (0.25 + rnd() * 0.5));
      const forward = rnd() > 0.5;
      const side = (forward ? 1 : -1) * w * 0.23;
      const x = at.p[0] - Math.sin(at.angle) * side;
      const y = at.p[1] + Math.cos(at.angle) * side;
      if (x < 40 || y < 40 || x > W - 40 || y > H - 40) continue;
      const sc = Math.min(1.9, w / 10);
      cars.push(`<use href="#car${Math.floor(rnd() * paints.length)}" transform="translate(${n(x)} ${n(y)}) rotate(${n((at.angle * 180) / Math.PI + (forward ? 0 : 180))}) scale(${sc.toFixed(2)})"/>`);
      occupied.push([x - 9 * sc, y - 9 * sc, x + 9 * sc, y + 9 * sc]);
    }
    if (cars.length) out.push(`<g data-kind="cars" style="pointer-events:none">${cars.join('')}</g>`);
  }

  // --- storybook houses: small buildings drawn as little houses at their real positions ---
  if (L.buildings && style.effects.houses) {
    const roofs = ['#E5533D', '#8D5A3B', '#3F6FB5', '#D9822B', '#7A4FB3'];
    const sw = 1.3;
    defs.push(
      col.buildings
        .flatMap((body, i) => roofs.map((roof, j) => `<symbol id="house${i}_${j}" overflow="visible"><rect x="-8" y="-11" width="16" height="11" fill="${body}" stroke="${col.ink}" stroke-width="${sw}" stroke-linejoin="round"/><path d="M-10.500 -10.500 0 -19.500 10.500 -10.500Z" fill="${roof}" stroke="${col.ink}" stroke-width="${sw}" stroke-linejoin="round"/><rect x="-2" y="-6.500" width="4" height="6.500" fill="${shade(roof, -0.25)}" stroke="${col.ink}" stroke-width=".9"/><rect x="3.400" y="-8.300" width="3" height="3" fill="#D6F1FF" stroke="${col.ink}" stroke-width=".8"/><rect x="-6.400" y="-8.300" width="3" height="3" fill="#D6F1FF" stroke="${col.ink}" stroke-width=".8"/></symbol>`))
        .join(''),
    );
    const collider = new Collider();
    const houses = geo.buildings
      .filter((b) => !c.hidden.has(b.id) && Math.abs(ringArea(b.ring)) < HOUSE_MAX_M2)
      .map((b) => ({ b, p: c.toArt(ringCentroid(b.ring)), area: Math.abs(ringArea(b.ring)) }))
      .sort((a, b) => b.area - a.area || (a.b.id < b.b.id ? -1 : 1));
    const placed: { id: string; x: number; y: number; f: number; h: number }[] = [];
    for (const hs of houses) {
      const size = Math.max(15, Math.min(27, Math.sqrt(hs.area) * c.s * 1.9));
      const f = size / 20;
      const box: Box = [hs.p[0] - 10 * f, hs.p[1] - 10 * f, hs.p[0] + 10 * f, hs.p[1] + 10 * f];
      if (collider.hits(box, -1.5)) continue; // crowded block: keep the picture tidy
      collider.add(box);
      placed.push({ id: hs.b.id, x: hs.p[0], y: hs.p[1] + 9 * f, f, h: hash32(hs.b.id) });
    }
    placed.sort((a, b) => a.y - b.y || (a.id < b.id ? -1 : 1));
    out.push(`<g data-kind="houses">${placed.map((h) => `<use data-id="${h.id}" data-kind="building" href="#house${h.h % col.buildings.length}_${(h.h >>> 8) % roofs.length}" transform="translate(${n(h.x)} ${n(h.y)}) scale(${h.f.toFixed(2)})"/>`).join('')}</g>`);
  }

  // --- street names, set along the streets ---
  if (L.roadLabels) out.push(roadLabels(c, artRoads, defs, occupied));

  if (style.effects.grain) {
    const r = prng(hash32(`grain${geo.key}`));
    let d = '';
    for (let i = 0; i < 420; i++) {
      const x = r() * W;
      const y = r() * H;
      const rad = 0.5 + r() * 1.6;
      d += `M${n(x - rad)} ${n(y)}a${n(rad)} ${n(rad)} 0 1 0 ${n(rad * 2)} 0a${n(rad)} ${n(rad)} 0 1 0 ${n(-rad * 2)} 0`;
    }
    out.push(`<path d="${d}" fill="${col.ink}" fill-opacity=".07"/>`);
  }

  return `<defs>${defs.join('')}</defs>${out.join('')}`;
}

/** Jittered-grid scatter of points inside polygons. Deterministic per feature id. */
function scatter(id: string, polys: Pt[][][], step: number, max: number, emit: (x: number, y: number, r: number) => void) {
  const r = prng(hash32(`scatter${id}`));
  let count = 0;
  for (const poly of polys) {
    const b = bboxOf(poly[0]);
    for (let y = b.minY + step / 2; y < b.maxY; y += step)
      for (let x = b.minX + step / 2; x < b.maxX; x += step) {
        const px = x + (r() - 0.5) * step * 0.8;
        const py = y + (r() - 0.5) * step * 0.8;
        const v = r();
        if (count >= max) return;
        if (pointInPoly([px, py], poly)) {
          emit(px, py, v);
          count++;
        }
      }
  }
}

function treeSymbols(style: MapStyle, size: number): string {
  const col = style.colors;
  const stroke = col.treeStroke ? ` stroke="${col.treeStroke}" stroke-width="${n(Math.max(0.7, size * 0.11))}"` : '';
  return col.tree
    .map((fill, i) => {
      const r = size * (0.5 + (i % 3) * 0.06);
      return `<symbol id="tree${i}" overflow="visible"><rect x="${n(-size * 0.09)}" y="${n(-size * 0.1)}" width="${n(size * 0.18)}" height="${n(size * 0.55)}" fill="${shade(fill, -0.45)}"/><circle cy="${n(-size * 0.42)}" r="${n(r)}" fill="${fill}"${stroke}${style.effects.wash ? ' fill-opacity=".85"' : ''}/><circle cx="${n(-r * 0.3)}" cy="${n(-size * 0.42 - r * 0.3)}" r="${n(r * 0.28)}" fill="#FFFFFF" fill-opacity=".28"/></symbol>`;
    })
    .join('');
}

function roadLabels(c: Ctx, artRoads: { r: Road; pts: Pt[]; w: number }[], defs: string[], occupied: Box[] = []): string {
  const { style, W, H, label } = c;
  const size = style.fonts.labelSize * Math.max(0.8, Math.min(1.12, c.k));
  const tracking = style.fonts.labelTracking;
  const collider = new Collider();
  occupied.forEach((b) => collider.add(b));
  const placedByName = new Map<string, Pt[]>();
  const glyphIds = new Map<string, string>();
  const uses: string[] = [];
  const spaces: string[] = [];
  const inset = 34;

  const candidates = artRoads
    .filter(({ r }) => r.name && r.cls !== 'path' && r.cls !== 'rail' && r.cls !== 'service')
    .map((a) => ({ ...a, len: lineLength(a.pts) }))
    .sort((a, b) => ROAD_RANK[b.r.cls] - ROAD_RANK[a.r.cls] || b.len - a.len || (a.r.id < b.r.id ? -1 : 1));

  for (const cand of candidates) {
    const raw = cand.r.name!;
    const text = style.fonts.labelUpper ? raw.toUpperCase() : raw;
    const glyphs = [...text].map((ch) => label.glyph(ch));
    if (glyphs.some((g) => g === null)) continue; // font lacks a character: skip rather than draw tofu
    const advances = glyphs.map((g) => (g!.advance / 1000) * size + tracking * size);
    const textW = advances.reduce((a, b) => a + b, 0);
    if (cand.len < textW * 1.12) continue;
    const prior = placedByName.get(raw) ?? [];

    for (const t of [0.5, 0.3, 0.7, 0.18, 0.82]) {
      const centre = cand.len * t;
      if (centre - textW / 2 < 2 || centre + textW / 2 > cand.len - 2) continue;
      const mid = pointAlong(cand.pts, centre);
      if (prior.some((p) => Math.hypot(p[0] - mid.p[0], p[1] - mid.p[1]) < 420)) continue;
      const reversed = Math.cos(mid.angle) < 0;
      const pts = reversed ? cand.pts.slice().reverse() : cand.pts;
      let cursor = (reversed ? cand.len - centre : centre) - textW / 2;
      const placed: { x: number; y: number; a: number; i: number }[] = [];
      let ok = true;
      let prev: number | null = null;
      let first = 0;
      for (let i = 0; i < glyphs.length && ok; i++) {
        const at = pointAlong(pts, cursor + advances[i] / 2);
        cursor += advances[i];
        if (at.p[0] < inset || at.p[1] < inset || at.p[0] > W - inset || at.p[1] > H - inset) ok = false;
        if (prev !== null) {
          const turn = Math.abs(Math.atan2(Math.sin(at.angle - prev), Math.cos(at.angle - prev)));
          const total = Math.abs(Math.atan2(Math.sin(at.angle - first), Math.cos(at.angle - first)));
          if (turn > 0.42 || total > 1.25) ok = false;
        } else first = at.angle;
        prev = at.angle;
        placed.push({ x: at.p[0], y: at.p[1], a: at.angle, i });
      }
      if (!ok) continue;
      const half = size * 0.62;
      const boxes = placed.map((g): Box => [g.x - half, g.y - half, g.x + half, g.y + half]);
      if (boxes.some((b) => collider.hits(b, 2))) continue;
      boxes.forEach((b) => collider.add(b));
      placedByName.set(raw, [...prior, mid.p]);
      const sc = size / 1000;
      const up = label.capHeight * size * 0.5;
      for (const g of placed) {
        const ch = [...text][g.i];
        if (ch === ' ') {
          // Fill the word gap with halo colour so the road never shows through as a 'dot'.
          const sw = advances[g.i];
          spaces.push(`<rect x="${n(-sw / 2 - 1)}" y="${n(-up)}" width="${n(sw + 2)}" height="${n(up * 2)}" transform="translate(${n(g.x)} ${n(g.y)}) rotate(${n((g.a * 180) / Math.PI)})"/>`);
          continue;
        }
        let id = glyphIds.get(ch);
        if (!id) {
          id = `rg${ch.codePointAt(0)!.toString(36)}`;
          glyphIds.set(ch, id);
          defs.push(`<path id="${id}" d="${glyphs[g.i]!.d}"/>`);
        }
        const adv = (glyphs[g.i]!.advance / 1000) * size;
        uses.push(`<use href="#${id}" transform="translate(${n(g.x)} ${n(g.y)}) rotate(${n((g.a * 180) / Math.PI)}) translate(${n(-adv / 2)} ${n(up)}) scale(${sc.toFixed(4)})"/>`);
      }
      break;
    }
  }
  if (!uses.length) return '';
  const col = style.colors;
  const haloW = (size * 0.32 * 1000) / size;
  const gaps = spaces.length ? `<g fill="${col.roadLabelHalo}" style="pointer-events:none">${spaces.join('')}</g>` : '';
  return `${gaps}<g data-kind="road-labels" fill="${col.roadLabel}" stroke="${col.roadLabelHalo}" stroke-width="${n(haloW)}" stroke-linejoin="round" paint-order="stroke" style="pointer-events:none">${uses.join('')}</g>`;
}

/* --------------------------------------------------------------- overlay */

interface TextLine {
  d: string;
  w: number;
  size: number;
}

function setText(tf: Typeface, text: string, cx: number, baseline: number, size: number, tracking: number, maxW?: number): TextLine {
  let w = tf.width(text, size, tracking);
  if (maxW && w > maxW) {
    size *= maxW / w;
    w = maxW;
  }
  return { d: tf.path(text, cx - w / 2, baseline, size, tracking), w, size };
}

function wrap(tf: Typeface, text: string, size: number, tracking: number, maxW: number): string[] {
  if (tf.width(text, size, tracking) <= maxW) return [text];
  const words = text.split(/\s+/);
  if (words.length === 1) return [text];
  let best: string[] = [text];
  let bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const w = Math.max(tf.width(a, size, tracking), tf.width(b, size, tracking));
    if (w < bestW) {
      bestW = w;
      best = [a, b];
    }
  }
  return best;
}

function iconPaint(style: MapStyle, seed: string, icon: IconId, override?: string): { paint: IconPaint; main: string } {
  const col = style.colors;
  const pair = col.iconPalette[hash32(seed) % col.iconPalette.length];
  const main = override ?? (icon === 'tree' || icon === 'trail' ? col.tree[0] : icon === 'water' || icon === 'pool' ? shade(col.water, -0.12) : pair[0]);
  if (style.iconMode === 'mono') {
    const bg = style.badge === 'disc' ? main : col.badgeFill;
    const fg = style.badge === 'disc' ? col.iconLight : col.iconOutline;
    return { main, paint: { outline: fg, main: bg, accent: bg, light: bg, strokeWidth: style.strokes.icon * 1.15 } };
  }
  return { main, paint: { outline: col.iconOutline, main, accent: pair[1], light: col.iconLight, strokeWidth: style.strokes.icon } };
}

function badge(style: MapStyle, r: number, main: string, emphasis: boolean): string {
  const col = style.colors;
  const sw = style.strokes.icon * (emphasis ? 1.25 : 0.95);
  switch (style.badge) {
    case 'disc':
      return `<circle r="${n(r)}" fill="${main}" stroke="${col.badgeStroke}" stroke-width="${n(sw)}"/>`;
    case 'ring':
      return `<circle r="${n(r)}" fill="${col.badgeFill}" stroke="${col.badgeStroke}" stroke-width="${n(sw * 0.8)}"/><circle r="${n(r - 3.2)}" fill="none" stroke="${emphasis ? main : col.badgeStroke}" stroke-width="${n(emphasis ? 1.8 : 0.7)}"/>`;
    default:
      return `<circle cy="${n(r * 0.12)}" r="${n(r)}" fill="${col.iconOutline}" fill-opacity=".22"/><circle r="${n(r)}" fill="${col.badgeFill}" stroke="${emphasis ? main : col.badgeStroke}" stroke-width="${n(emphasis ? sw * 2 : sw)}"/>${emphasis ? `<circle r="${n(r + sw)}" fill="none" stroke="${col.badgeStroke}" stroke-width="${n(sw * 0.7)}"/>` : ''}`;
  }
}

function iconAt(icon: IconId, paint: IconPaint, r: number): string {
  const size = r * 1.42;
  const sc = size / 48;
  return `<g transform="translate(${n(-size / 2)} ${n(-size / 2)}) scale(${sc.toFixed(4)})">${iconMarkup(icon, paint)}</g>`;
}

type BuildingKind = 'storefront' | 'civic' | 'block' | 'nature';
const BUILDING_KIND: Partial<Record<Landmark['category'], BuildingKind>> = {
  restaurant: 'storefront', cafe: 'storefront', bakery: 'storefront', ice_cream: 'storefront', pizza: 'storefront', grocery: 'storefront',
  shop: 'storefront', mall: 'storefront', market: 'storefront', bar: 'storefront', cinema: 'storefront', theatre: 'storefront', hotel: 'storefront',
  museum: 'civic', library: 'civic', government: 'civic', post_office: 'civic', historic: 'civic', community: 'civic',
  school: 'block', daycare: 'block', hospital: 'block', police: 'block', fire_station: 'block', gym: 'block', train: 'block', bus: 'block', airport: 'block',
};

/**
 * A landmark drawn as a large storybook building with a signboard. Three
 * original templates (storefront, civic, block) are varied by colour and by
 * the category emblem; outdoor places are shown as a large emblem instead.
 * Drawn in a local box: x in [-halfW, halfW], ground at y = 0, up is negative.
 */
function landmarkBuilding(l: Landmark, style: MapStyle, sign: Typeface, showSign: boolean): { markup: string; halfW: number; top: number; bottom: number } {
  const col = style.colors;
  const { paint, main } = iconPaint(style, l.id, l.icon, l.color);
  const ink = col.iconOutline;
  const S = `stroke="${ink}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const glass = '#D6F1FF';
  const emblem = (x: number, y: number, r: number) => `<g transform="translate(${x} ${y})">${iconAt(l.icon, paint, r)}</g>`;
  const kind = BUILDING_KIND[l.category] ?? 'nature';
  const g: string[] = [];
  let halfW = 38;
  let top = -64;

  if (kind === 'storefront') {
    const wall = shade(main, 0.62);
    g.push(`<rect x="-34" y="-44" width="68" height="44" fill="${wall}" ${S}/>`);
    g.push(`<rect x="-24" y="-64" width="48" height="21" rx="4" fill="#FFFFFF" ${S}/>${emblem(0, -53.500, 11)}`);
    // striped, scalloped awning
    for (let i = 0; i < 6; i++) {
      const x = -36 + i * 12;
      g.push(`<path d="M${x} -44h12v9a6 6 0 0 1 -12 0z" fill="${i % 2 ? '#FFFFFF' : main}" ${S}/>`);
    }
    g.push(`<rect x="-29" y="-25" width="17" height="15" rx="1.500" fill="${glass}" ${S}/><rect x="12" y="-25" width="17" height="15" rx="1.500" fill="${glass}" ${S}/>`);
    g.push(`<rect x="-7" y="-23" width="14" height="23" rx="1.500" fill="${paint.accent}" ${S}/><circle cx="3.500" cy="-11" r="1.300" fill="${ink}"/>`);
  } else if (kind === 'civic') {
    const stone = '#F6ECD6';
    g.push(`<rect x="-34" y="-40" width="68" height="34" fill="${stone}" ${S}/>`);
    for (const x of [-27, -13, 7, 21]) g.push(`<rect x="${x}" y="-38" width="6" height="32" fill="#FFFFFF" ${S}/>`);
    g.push(`<rect x="-5" y="-24" width="10" height="18" rx="5" fill="${paint.accent}" ${S}/>`);
    g.push(`<path d="M-40 -40 0 -66 40 -40Z" fill="${main}" ${S}/>`);
    g.push(`<circle cx="0" cy="-49" r="9.500" fill="#FFFFFF" ${S}/>${emblem(0, -49, 8)}`);
    g.push(`<rect x="-40" y="-6" width="80" height="6" fill="${shade(stone, -0.12)}" ${S}/>`);
    halfW = 41;
    top = -67;
  } else if (kind === 'block') {
    const wall = shade(main, 0.55);
    g.push(`<rect x="-31" y="-56" width="62" height="56" fill="${wall}" ${S}/>`);
    g.push(`<rect x="-35" y="-62" width="70" height="9" rx="2" fill="${main}" ${S}/>`);
    for (const y of [-46, -30]) for (const x of [-25, -7, 11]) g.push(`<rect x="${x}" y="${y}" width="13" height="11" rx="1.500" fill="${glass}" ${S}/>`);
    g.push(`<rect x="-8" y="-15" width="16" height="15" fill="${paint.accent}" ${S}/><path d="M0 -15V0" fill="none" ${S}/>`);
    g.push(`<circle cx="0" cy="-62" r="12" fill="#FFFFFF" ${S}/>${emblem(0, -62, 10)}`);
    halfW = 36;
    top = -75;
  } else {
    g.push(emblem(0, -30, 40));
    halfW = 30;
    top = -59;
  }

  let bottom = 1;
  const text = l.label.trim().toUpperCase();
  if (showSign && text) {
    const size = 11.5;
    const tracking = 0.03;
    const lines = wrap(sign, text, size, tracking, 104);
    const widths = lines.map((t) => sign.width(t, size, tracking));
    const fit = Math.min(1, 118 / Math.max(...widths));
    const fs = size * fit;
    const lh = fs * 1.2;
    const bw = Math.max(...widths) * fit + 14;
    const bh = lh * lines.length + 7;
    const y0 = 4;
    g.push(`<rect x="${n(-bw / 2)}" y="${y0}" width="${n(bw)}" height="${n(bh)}" rx="5" fill="#FFFFFF" ${S}/>`);
    lines.forEach((t, i) => g.push(`<path d="${sign.path(t, (-widths[i] * fit) / 2, y0 + 3.5 + lh * i + fs * 0.82, fs, tracking)}" fill="${ink}"/>`));
    bottom = y0 + bh + 1;
    halfW = Math.max(halfW, bw / 2 + 1);
  }
  return { markup: g.join(''), halfW, top, bottom };
}

export function renderOverlayLayer(geo: Geography, design: Design, fonts: Partial<FontBook>): { markup: string; items: RenderItem[] } {
  const c = makeCtx(geo, design, fonts);
  const { style, W, H, label, display } = c;
  const col = style.colors;
  const proj = new LocalProjection(geo.frame.center);
  const items: RenderItem[] = [];
  const out: string[] = [];
  const collider = new Collider();
  const upper = (s: string) => (style.fonts.labelUpper ? s.toUpperCase() : s);
  const tracking = style.fonts.labelTracking;

  const anchor = (lngLat: { lat: number; lon: number }, dx: number, dy: number): Pt => {
    const m = proj.project(lngLat);
    return c.toArt([m[0] + dx, m[1] + dy]);
  };

  const asBuilding = (l: Landmark) => style.badge === 'building' && l.source !== 'custom' && l.category !== 'other';

  // Reserve the home badge and every icon first so no label lands on an icon.
  const homeR = 31 * design.home.scale;
  const homePos = anchor(design.home.lngLat, design.home.dx, design.home.dy);
  if (design.home.visible) collider.add([homePos[0] - homeR, homePos[1] - homeR, homePos[0] + homeR, homePos[1] + homeR]);

  const marks = design.landmarks
    .filter((l) => l.visible)
    .map((l) => ({ l, pos: anchor(l.lngLat, l.dx, l.dy), r: (asBuilding(l) ? 36 : 20) * l.scale }))
    .filter((m) => m.pos[0] > -20 && m.pos[1] > -20 && m.pos[0] < W + 20 && m.pos[1] < H + 20)
    .sort((a, b) => a.pos[1] - b.pos[1] || (a.l.id < b.l.id ? -1 : 1));
  for (const m of marks) collider.add([m.pos[0] - m.r, m.pos[1] - m.r, m.pos[0] + m.r, m.pos[1] + m.r]);

  const labelSize = (style.fonts.labelUpper ? 10.5 : 13.5);
  const halo = (d: string, fill: string, haloColor: string, size: number) =>
    `<path d="${d}" fill="${fill}" stroke="${haloColor}" stroke-width="${n(size * 0.3)}" stroke-linejoin="round" paint-order="stroke"/>`;

  const drawLandmark = (m: { l: Landmark; pos: Pt; r: number }) => {
    const { l, pos, r } = m;
    if (asBuilding(l)) {
      const built = landmarkBuilding(l, style, display, design.layers.landmarkLabels);
      const sc = l.scale;
      const oy = 22 * sc; // the building stands on its position rather than being centred on it
      out.push(`<g data-id="${l.id}" data-kind="landmark" transform="translate(${n(pos[0])} ${n(pos[1] + oy)}) scale(${sc.toFixed(3)})">${built.markup}</g>`);
      const b: Box = [pos[0] - built.halfW * sc, pos[1] + oy + built.top * sc, pos[0] + built.halfW * sc, pos[1] + oy + built.bottom * sc];
      collider.add(b);
      items.push({ id: l.id, kind: 'landmark', box: b, x: pos[0], y: pos[1] });
      return;
    }
    const { paint, main } = iconPaint(style, l.id, l.icon, l.color);
    const g: string[] = [badge(style, r, main, false), iconAt(l.icon, paint, r)];
    let box: Box = [pos[0] - r, pos[1] - r, pos[0] + r, pos[1] + r];
    if (design.layers.landmarkLabels && l.label.trim()) {
      const size = labelSize * Math.sqrt(l.scale);
      const lines = wrap(label, upper(l.label.trim()), size, tracking, 150);
      const lh = size * 1.18;
      const widths = lines.map((t) => label.width(t, size, tracking));
      const tw = Math.max(...widths);
      const th = lh * lines.length;
      const gap = 5;
      // Candidate positions: below, above, right, left — first one that is free wins.
      const options: { cx: number; top: number }[] = [
        { cx: 0, top: r + gap },
        { cx: 0, top: -r - gap - th },
        { cx: r + gap + tw / 2, top: -th / 2 },
        { cx: -r - gap - tw / 2, top: -th / 2 },
      ];
      let pick = options[0];
      for (const o of options) {
        const b: Box = [pos[0] + o.cx - tw / 2, pos[1] + o.top, pos[0] + o.cx + tw / 2, pos[1] + o.top + th];
        if (b[0] < 24 || b[2] > W - 24 || b[1] < 24 || b[3] > H - 24) continue;
        if (!collider.hits(b, 1)) {
          pick = o;
          break;
        }
      }
      const lb: Box = [pos[0] + pick.cx - tw / 2, pos[1] + pick.top, pos[0] + pick.cx + tw / 2, pos[1] + pick.top + th];
      collider.add(lb);
      lines.forEach((t, i) => g.push(halo(label.path(t, pick.cx - widths[i] / 2, pick.top + lh * i + size * 0.92, size, tracking), col.label, col.labelHalo, size)));
      box = [Math.min(box[0], lb[0]), Math.min(box[1], lb[1]), Math.max(box[2], lb[2]), Math.max(box[3], lb[3])];
    }
    out.push(`<g data-id="${l.id}" data-kind="landmark" transform="translate(${n(pos[0])} ${n(pos[1])})">${g.join('')}</g>`);
    items.push({ id: l.id, kind: 'landmark', box, x: pos[0], y: pos[1] });
  };
  marks.forEach(drawLandmark);

  // --- home: the centrepiece ---
  if (design.home.visible) {
    const home = design.home.color ?? col.home;
    const paint: IconPaint = style.iconMode === 'mono'
      ? { outline: style.badge === 'disc' ? col.iconLight : col.iconOutline, main: style.badge === 'disc' ? home : col.badgeFill, accent: style.badge === 'disc' ? home : col.badgeFill, light: style.badge === 'disc' ? home : col.badgeFill, strokeWidth: style.strokes.icon * 1.1 }
      : { outline: col.iconOutline, main: home, accent: shade(home, 0.45), light: col.iconLight, strokeWidth: style.strokes.icon };
    const g: string[] = [badge(style, homeR, home, true), iconAt(design.home.icon, paint, homeR)];
    let box: Box = [homePos[0] - homeR - 4, homePos[1] - homeR - 4, homePos[0] + homeR + 4, homePos[1] + homeR + 4];
    const text = design.home.label.trim();
    if (text) {
      const size = (style.fonts.labelUpper ? 12 : 15) * Math.sqrt(design.home.scale);
      const t = upper(text);
      const w = label.width(t, size, tracking);
      const ph = size * 1.75;
      const pw = w + size * 1.5;
      const top = homeR + 7;
      g.push(`<rect x="${n(-pw / 2)}" y="${n(top)}" width="${n(pw)}" height="${n(ph)}" rx="${n(style.badge === 'sticker' ? ph / 2 : 2)}" fill="${home}" stroke="${col.badgeStroke}" stroke-width="${n(style.strokes.icon * 0.7)}"/>`);
      g.push(`<path d="${label.path(t, -w / 2, top + ph / 2 + label.capHeight * size * 0.5, size, tracking)}" fill="#FFFFFF"/>`);
      box = [Math.min(box[0], homePos[0] - pw / 2), box[1], Math.max(box[2], homePos[0] + pw / 2), homePos[1] + top + ph];
    }
    out.push(`<g data-id="home" data-kind="home" transform="translate(${n(homePos[0])} ${n(homePos[1])})">${g.join('')}</g>`);
    items.push({ id: 'home', kind: 'home', box, x: homePos[0], y: homePos[1] });
  }

  // --- free text ---
  for (const t of design.texts) {
    const text = t.text.trim();
    if (!text) continue;
    const tf = t.font === 'display' ? display : label;
    const isUpper = t.font === 'display' ? style.fonts.displayUpper : style.fonts.labelUpper;
    const size = 26 * t.scale;
    const tr = t.font === 'display' ? style.fonts.displayTracking : tracking;
    const s = isUpper ? text.toUpperCase() : text;
    const w = tf.width(s, size, tr);
    const x = t.x * W;
    const y = t.y * H;
    out.push(`<g data-id="${t.id}" data-kind="text" transform="translate(${n(x)} ${n(y)})">${halo(tf.path(s, -w / 2, size * 0.35, size, tr), t.color ?? col.label, col.labelHalo, size * 0.7)}</g>`);
    items.push({ id: t.id, kind: 'text', box: [x - w / 2, y - size * 0.6, x + w / 2, y + size * 0.5], x, y });
  }

  out.push(chrome(c, items));
  return { markup: out.join(''), items };
}

/** Title block, border, compass and the (non-removable) data attribution. */
function chrome(c: Ctx, items: RenderItem[]): string {
  const { style, design, W, H, display, label } = c;
  const col = style.colors;
  const out: string[] = [];
  const T = design.title;
  const atBottom = T.position === 'bottom';
  const inset = style.border === 'none' ? 0 : style.border === 'rounded' ? 18 : 22;
  let bandAtBottom = false;

  const hasTitle = T.show && (T.title.trim() || T.subtitle.trim() || T.dedication.trim() || T.date.trim());
  if (hasTitle) {
    const maxW = W * (style.title === 'band' ? 0.84 : 0.7);
    const dU = (s: string) => (style.fonts.displayUpper ? s.toUpperCase() : s);
    const lU = (s: string) => (style.fonts.labelUpper ? s.toUpperCase() : s);
    type Line = { tf: Typeface; text: string; size: number; tracking: number; color: string; gap: number };
    const lines: Line[] = [];
    const titleSize = style.title === 'band' ? 62 : style.fonts.display === 'caveat-700' ? 68 : 54;
    if (T.title.trim()) lines.push({ tf: display, text: dU(T.title.trim()), size: titleSize, tracking: style.fonts.displayTracking, color: col.titleText, gap: 0 });
    if (T.subtitle.trim()) lines.push({ tf: label, text: lU(T.subtitle.trim()), size: style.fonts.labelUpper ? 15 : 20, tracking: style.fonts.labelTracking + (style.fonts.labelUpper ? 0.12 : 0), color: col.titleAccent, gap: 12 });
    const small = [T.dedication.trim(), T.date.trim()].filter(Boolean).join('  ·  ');
    if (small) lines.push({ tf: label, text: lU(small), size: style.fonts.labelUpper ? 11 : 14.5, tracking: style.fonts.labelTracking, color: col.titleText, gap: 10 });

    const set = lines.map((l) => ({ ...l, ...setText(l.tf, l.text, 0, 0, l.size, l.tracking, maxW) }));
    const heights = set.map((l) => l.size * (l.tf === display ? display.capHeight + 0.12 : 0.86));
    const contentH = heights.reduce((a, b) => a + b, 0) + set.reduce((a, l) => a + l.gap, 0);
    const contentW = Math.max(...set.map((l) => l.w));
    const g: string[] = [];
    let top: number;
    let panel: Box;

    if (style.title === 'band') {
      const padY = 34;
      const bandH = contentH + padY * 2 + (atBottom ? inset : inset);
      const y0 = atBottom ? H - bandH : 0;
      bandAtBottom = atBottom;
      g.push(`<rect x="0" y="${n(y0)}" width="${W}" height="${n(bandH)}" fill="${col.titleBg}"/>`);
      g.push(`<path d="M${n(W / 2 - 34)} ${n(atBottom ? y0 + 15 : y0 + bandH - 15)}h68" stroke="${col.titleAccent}" stroke-width="2.4" fill="none"/>`);
      top = atBottom ? y0 + padY : inset + padY;
      panel = [0, y0, W, y0 + bandH];
    } else {
      const padX = style.title === 'ribbon' ? 44 : 38;
      const padY = style.title === 'ribbon' ? 24 : 26;
      const pw = Math.min(W - inset * 2 - 30, contentW + padX * 2);
      const ph = contentH + padY * 2;
      const x0 = (W - pw) / 2;
      const y0 = atBottom ? H - inset - 26 - ph : inset + 26;
      if (style.title === 'ribbon') {
        g.push(`<rect x="${n(x0)}" y="${n(y0 + 5)}" width="${n(pw)}" height="${n(ph)}" rx="22" fill="${col.border}" fill-opacity=".9"/>`);
        g.push(`<rect x="${n(x0)}" y="${n(y0)}" width="${n(pw)}" height="${n(ph)}" rx="22" fill="${col.titleBg}" stroke="${col.border}" stroke-width="3.2"/>`);
      } else {
        g.push(`<rect x="${n(x0)}" y="${n(y0)}" width="${n(pw)}" height="${n(ph)}" fill="${col.titleBg}" stroke="${col.border}" stroke-width="2"/>`);
        g.push(`<rect x="${n(x0 + 6)}" y="${n(y0 + 6)}" width="${n(pw - 12)}" height="${n(ph - 12)}" fill="none" stroke="${col.border}" stroke-width=".8"/>`);
        for (const [dx, dy] of [[12, 12], [pw - 12, 12], [12, ph - 12], [pw - 12, ph - 12]]) g.push(`<circle cx="${n(x0 + dx)}" cy="${n(y0 + dy)}" r="2.4" fill="${col.titleAccent}"/>`);
      }
      top = y0 + padY;
      panel = [x0, y0, x0 + pw, y0 + ph];
    }
    let y = top;
    set.forEach((l, i) => {
      y += l.gap;
      const baseline = y + heights[i] - (l.tf === display ? l.size * 0.06 : l.size * 0.14);
      g.push(`<path d="${l.tf.path(l.text, W / 2 - l.w / 2, baseline, l.size, l.tracking)}" fill="${l.color}"/>`);
      y += heights[i];
    });
    out.push(`<g data-id="title" data-kind="title">${g.join('')}</g>`);
    items.push({ id: 'title', kind: 'title', box: panel, x: (panel[0] + panel[2]) / 2, y: (panel[1] + panel[3]) / 2 });
  }

  // --- border: paper margin + frame line(s) ---
  if (design.layers.border && style.border !== 'none') {
    const r = style.border === 'rounded' ? 26 : 0;
    const inner = (m: number, rad: number) =>
      rad > 0
        ? `M${m + rad} ${m}H${W - m - rad}a${rad} ${rad} 0 0 1 ${rad} ${rad}V${H - m - rad}a${rad} ${rad} 0 0 1 ${-rad} ${rad}H${m + rad}a${rad} ${rad} 0 0 1 ${-rad} ${-rad}V${m + rad}a${rad} ${rad} 0 0 1 ${rad} ${-rad}Z`
        : `M${m} ${m}H${W - m}V${H - m}H${m}Z`;
    out.push(`<path d="M0 0H${W}V${H}H0Z${inner(inset, r)}" fill="${col.paper}" fill-rule="evenodd" style="pointer-events:none"/>`);
    const sw = style.border === 'rounded' ? 4 : style.border === 'double' ? 2.2 : 1.3;
    out.push(`<path d="${inner(inset, r)}" fill="none" stroke="${col.border}" stroke-width="${sw}" style="pointer-events:none"/>`);
    if (style.border === 'double') out.push(`<path d="${inner(inset + 6.5, 0)}" fill="none" stroke="${col.border}" stroke-width=".8" style="pointer-events:none"/>`);
  }

  // --- compass ---
  if (design.layers.compass) {
    const cx = W - inset - 46;
    const cy = hasTitle && atBottom ? inset + 50 : H - inset - 50;
    const ink = luminanceIsDark(col.paper) ? col.ink : col.border;
    const nW = label.width('N', 13, 0);
    out.push(`<g style="pointer-events:none" transform="translate(${n(cx)} ${n(cy)})"><circle r="21" fill="${col.titleBg}" stroke="${ink}" stroke-width="1.4"/><path d="M0 -15 5 3 0 0 -5 3Z" fill="${col.titleAccent}" stroke="${ink}" stroke-width="1" stroke-linejoin="round"/><path d="M0 15 5 3 0 0 -5 3Z" fill="${col.titleBg}" stroke="${ink}" stroke-width="1" stroke-linejoin="round"/><path d="${label.path('N', -nW / 2, -25, 13, 0)}" fill="${ink}" stroke="${col.paper}" stroke-width="3" paint-order="stroke"/></g>`);
  }

  // --- attribution: required by the ODbL, always present ---
  const aSize = 7.5;
  const onBand = bandAtBottom;
  out.push(`<path data-kind="attribution" style="pointer-events:none" d="${label.path(ATTRIBUTION, inset + 9, H - inset - 8, aSize, 0.02)}" fill="${onBand ? col.titleText : col.label}" stroke="${onBand ? col.titleBg : col.labelHalo}" stroke-width="2" paint-order="stroke"/>`);
  return out.join('');
}

function luminanceIsDark(hex: string): boolean {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
}

/* --------------------------------------------------------------- compose */

export interface SvgOptions {
  /** Output width in px. Height follows the aspect ratio. Omit for a scalable (viewBox-only) SVG. */
  pixelWidth?: number;
  /** Exact output height in px (defaults to the aspect-correct height). */
  pixelHeight?: number;
  /** Extra paper-coloured margin on every side, in art units (print bleed). */
  bleed?: number;
  /** Render only a horizontal slice [y0, y1) of the full art, in art units (for strip export). */
  slice?: { y0: number; y1: number };
}

export function wrapSvg(inner: string, design: Design, size: { width: number; height: number }, opts: SvgOptions = {}): string {
  const style = getStyle(design.styleId);
  const bleed = opts.bleed ?? 0;
  const fullW = size.width + bleed * 2;
  const fullH = size.height + bleed * 2;
  const y0 = opts.slice ? opts.slice.y0 : 0;
  const y1 = opts.slice ? opts.slice.y1 : fullH;
  // Full precision here: strips must line up to the pixel.
  const vb = `${-bleed} ${-bleed + y0} ${fullW} ${y1 - y0}`;
  const dims = opts.pixelWidth ? ` width="${opts.pixelWidth}" height="${opts.pixelHeight ?? Math.round((opts.pixelWidth * (y1 - y0)) / fullW)}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${dims}${opts.pixelHeight ? ' preserveAspectRatio="none"' : ''}><rect x="${-bleed}" y="${-bleed}" width="${fullW}" height="${fullH}" fill="${style.colors.paper}"/><svg x="0" y="0" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" overflow="hidden">${inner}</svg></svg>`;
}

export interface RenderResult {
  svg: string;
  width: number;
  height: number;
  items: RenderItem[];
}

/** One-call render of the complete artwork. */
export function renderMap(geo: Geography, design: Design, fonts: Partial<FontBook>, opts: SvgOptions = {}): RenderResult {
  const size = artSize(geo.frame);
  const base = renderBaseLayer(geo, design, fonts);
  const overlay = renderOverlayLayer(geo, design, fonts);
  return { svg: wrapSvg(base + overlay.markup, design, size, opts), width: size.width, height: size.height, items: overlay.items };
}

export { CATEGORY_META };
