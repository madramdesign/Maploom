import { describe, expect, it } from 'vitest';
import { STYLE_IDS, designSchema, type Geography } from '@maploom/core';
import { buildGeographyFromTiles, makeFrame, rankLandmarks } from '@maploom/geo';
import { STYLES, artSize, createDesign, renderBaseLayer, renderMap, renderOverlayLayer, suggestLandmarks } from '@maploom/render';
import { loadFontsNode } from '@maploom/render/fonts-node';
import { buildClifton, CLIFTON, cliftonFrame, fixtureFetcher, fixtureInfo } from './fixture-tiles';

const fonts = loadFontsNode();
let geoPromise: Promise<Geography> | undefined;
const clifton = () => (geoPromise ??= buildClifton());

describe('address → geographic data (real OpenStreetMap tiles, offline fixtures)', () => {
  it('extracts roads, areas, buildings, water and places for the frame', async () => {
    const geo = await clifton();
    expect(geo.roads.length).toBeGreaterThan(100);
    expect(geo.areas.some((a) => a.kind === 'park')).toBe(true);
    expect(geo.areas.some((a) => a.kind === 'water')).toBe(true);
    expect(geo.buildings.length).toBeGreaterThan(50);
    expect(geo.pois.length).toBeGreaterThan(10);
    expect(geo.source).toMatchObject({ provider: 'openfreemap', attribution: '© OpenStreetMap contributors' });
  });

  it('names real streets and keeps every coordinate inside the (margined) frame', async () => {
    const geo = await clifton();
    const names = new Set(geo.roads.map((r) => r.name));
    for (const expected of ['Van Houten Avenue', 'Clifton Avenue', 'Colfax Avenue']) expect(names.has(expected)).toBe(true);
    const mx = cliftonFrame.widthM / 2 + 60;
    const my = cliftonFrame.heightM / 2 + 60;
    for (const r of geo.roads) for (const [x, y] of r.pts) expect(Math.abs(x) <= mx && Math.abs(y) <= my).toBe(true);
    for (const p of geo.pois) expect(Math.abs(p.pos[0]) <= cliftonFrame.widthM / 2 && Math.abs(p.pos[1]) <= cliftonFrame.heightM / 2).toBe(true);
  });

  it('merges tile fragments: long streets come out as few, long lines', async () => {
    const geo = await clifton();
    const vh = geo.roads.filter((r) => r.name === 'Van Houten Avenue');
    const longest = Math.max(...vh.map((r) => r.pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - r.pts[i - 1][0], p[1] - r.pts[i - 1][1]) : 0), 0)));
    expect(longest).toBeGreaterThan(500);
    expect(new Set(geo.roads.map((r) => r.id)).size).toBe(geo.roads.length);
  });

  it('is reproducible: same tiles + frame ⇒ same content key', async () => {
    const a = await clifton();
    const b = await buildGeographyFromTiles(cliftonFrame, fixtureFetcher, fixtureInfo);
    expect(b.key).toBe(a.key);
    const moved = await buildGeographyFromTiles(makeFrame({ lat: CLIFTON.lat + 0.001, lon: CLIFTON.lon }, 1200, 3 / 4), fixtureFetcher, fixtureInfo);
    expect(moved.key).not.toBe(a.key);
  });

  it('fails with friendly errors when data is missing or unreachable', async () => {
    await expect(buildGeographyFromTiles(cliftonFrame, async () => null, fixtureInfo)).rejects.toMatchObject({ code: 'NO_GEODATA' });
    await expect(buildGeographyFromTiles(cliftonFrame, async () => { throw new Error('boom'); }, fixtureInfo)).rejects.toMatchObject({ code: 'GEODATA_UNAVAILABLE' });
    await expect(buildGeographyFromTiles(cliftonFrame, async () => new Uint8Array([1, 2, 3, 250, 9]), fixtureInfo)).rejects.toMatchObject({ code: expect.stringMatching(/GEODATA_UNAVAILABLE|NO_GEODATA/) });
  });

  it('picks recognisable landmarks from the real data', async () => {
    const geo = await clifton();
    const chosen = rankLandmarks(geo).filter((r) => r.selected).map((r) => r.poi.name);
    expect(chosen).toEqual(expect.arrayContaining(['Clifton High School', 'Clifton City Hall']));
    expect(chosen.length).toBeGreaterThan(5);
  });
});

describe('geographic data → illustrated map', () => {
  const design = async (styleId: (typeof STYLE_IDS)[number] = 'playful') => {
    const geo = await clifton();
    const d = createDesign({ frame: geo.frame, home: CLIFTON, styleId, title: "Emma's Neighborhood" });
    d.landmarks = suggestLandmarks(geo, d.preferences, d.landmarkTarget);
    return { geo, d };
  };

  it('renders every style to valid, self-contained SVG', async () => {
    for (const styleId of STYLE_IDS) {
      const { geo, d } = await design(styleId);
      const { svg, width, height } = renderMap(geo, d, fonts);
      expect([width, height]).toEqual([1000, 1333]);
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined|<text|<image|href="http/);
      // Element-level opacity forces offscreen layers and crashes resvg 2.6 on strips; only fill-/stroke-opacity are allowed.
      expect(svg).not.toMatch(/[\s"]opacity=/);
      expect(svg).toContain(STYLES[styleId].colors.land);
      // Only print strips may stretch; a normal SVG must keep its aspect ratio wherever it is shown.
      expect(svg).not.toContain('preserveAspectRatio="none"');
      expect(designSchema.safeParse(d).success).toBe(true);
    }
  });

  it('is deterministic: identical inputs give byte-identical output', async () => {
    const { geo, d } = await design();
    expect(renderMap(geo, d, fonts).svg).toBe(renderMap(geo, structuredClone(d), fonts).svg);
  });

  it('separates geography from presentation: styles change looks, not geometry', async () => {
    const { geo, d } = await design('playful');
    const geom = (svg: string) => [...svg.matchAll(/data-kind="road" d="([^"]+)"/g)].map((m) => m[1]).sort();
    const a = geom(renderBaseLayer(geo, d, fonts));
    const b = geom(renderBaseLayer(geo, { ...d, styleId: 'vintage' }, fonts));
    expect(a.length).toBeGreaterThan(100);
    expect(b).toEqual(a);
  });

  it('honours edits: hidden features, layer toggles, labels, custom places', async () => {
    const { geo, d } = await design();
    const road = geo.roads.find((r) => r.name === 'Van Houten Avenue')!;
    const base = renderBaseLayer(geo, d, fonts);
    expect(base).toContain(`data-id="${road.id}"`);
    expect(renderBaseLayer(geo, { ...d, hidden: [road.id] }, fonts)).not.toContain(`data-id="${road.id}"`);
    expect(renderBaseLayer(geo, { ...d, layers: { ...d.layers, buildings: false } }, fonts)).not.toContain('data-kind="building"');
    expect(renderBaseLayer(geo, { ...d, layers: { ...d.layers, roadLabels: false } }, fonts)).not.toContain('data-kind="road-labels"');

    d.landmarks.push({ id: 'custom-1', source: 'custom', label: "Grandma's house", category: 'other', icon: 'heart', lngLat: { lat: CLIFTON.lat + 0.002, lon: CLIFTON.lon + 0.002 }, visible: true, dx: 0, dy: 0, scale: 1 });
    const overlay = renderOverlayLayer(geo, d, fonts);
    const ids = overlay.items.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['home', 'title', 'custom-1']));
    const custom = overlay.items.find((i) => i.id === 'custom-1')!;
    const home = overlay.items.find((i) => i.id === 'home')!;
    expect(custom.x).toBeGreaterThan(home.x); // east of home
    expect(custom.y).toBeLessThan(home.y); // north of home
    // The home marker sits at the centre of the art.
    const size = artSize(geo.frame);
    expect(home.x).toBeCloseTo(size.width / 2, 0);
    expect(home.y).toBeCloseTo(size.height / 2, 0);
    // Attribution can't be switched off.
    expect(renderOverlayLayer(geo, { ...d, layers: { ...d.layers, border: false, compass: false } }, fonts).markup).toContain('data-kind="attribution"');
  });

  it('keeps manual overrides when suggestions are refreshed', async () => {
    const { geo, d } = await design();
    const first = d.landmarks.find((l) => l.visible)!;
    first.label = 'Our school';
    first.dx = 40;
    d.landmarks.unshift({ id: 'custom-9', source: 'custom', label: 'Tree house', category: 'other', icon: 'star', lngLat: CLIFTON, visible: true, dx: 0, dy: 0, scale: 1 });
    const next = suggestLandmarks(geo, { ...d.preferences, food: false }, 6, d.landmarks);
    expect(next.find((l) => l.id === first.id)).toMatchObject({ label: 'Our school', dx: 40 });
    expect(next[0].id).toBe('custom-9');
    expect(next.filter((l) => l.visible && l.source === 'auto').length).toBeLessThanOrEqual(6);
  });
});
