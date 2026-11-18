import { CATEGORY_META, type CategoryGroupId, type Frame, type Geography, type Poi, type PoiCategory } from '@maploom/core';

/**
 * Landmark intelligence: rank every candidate place, then pick a balanced,
 * well-spaced set. All inputs are real geographic data; nothing is invented.
 *
 *   score = preference × (wC·category + wP·proximity + wR·prominence + wU·uniqueness + wS·size)
 *
 * Every component is in 0..1 and is returned so the UI (and admins) can see
 * exactly why a place was chosen.
 */

export const SCORE_WEIGHTS = { category: 0.3, proximity: 0.22, prominence: 0.18, uniqueness: 0.15, size: 0.15 } as const;

export interface ScoreBreakdown {
  category: number;
  proximity: number;
  prominence: number;
  uniqueness: number;
  size: number;
  preference: number;
}

export interface RankedPoi {
  poi: Poi;
  score: number;
  breakdown: ScoreBreakdown;
  /** True when the automatic selection picked this place. */
  selected: boolean;
}

export interface RankOptions {
  /** Category groups the customer cares about. Missing = enabled. */
  preferences?: Partial<Record<CategoryGroupId, boolean>>;
  /** How many landmarks to select. Defaults to a density-based count. */
  target?: number;
}

/** A sensible number of landmarks for a frame: enough to feel rich, never cluttered. */
export function defaultLandmarkTarget(frame: Frame): number {
  const aspect = Math.max(frame.widthM, frame.heightM) / Math.min(frame.widthM, frame.heightM);
  return Math.round(Math.min(18, 9 * Math.sqrt(aspect) + 2));
}

export function scorePoi(poi: Poi, ctx: { frame: Frame; categoryCounts: Map<PoiCategory, number>; nameCounts: Map<string, number>; preferences: RankOptions['preferences'] }): { score: number; breakdown: ScoreBreakdown } {
  const meta = CATEGORY_META[poi.category];
  const half = Math.hypot(ctx.frame.widthM, ctx.frame.heightM) / 2;
  const d = Math.hypot(poi.pos[0], poi.pos[1]);

  const category = meta.weight;
  // Gentle decay: places near home matter most but the far corner still counts.
  const proximity = Math.exp(-d / (0.55 * half));
  // OpenMapTiles rank: 1 = most prominent of its kind nearby. Wikidata/Wikipedia tags (when a richer source provides them) are a strong signal.
  let prominence = poi.rank ? 1 / (1 + (poi.rank - 1) * 0.12) : 0.5;
  if (poi.tags?.wikidata || poi.tags?.wikipedia) prominence = Math.min(1, prominence + 0.4);
  // Rare categories are more memorable; names repeated nearby (chains) less so.
  const sameCategory = ctx.categoryCounts.get(poi.category) ?? 1;
  const sameName = ctx.nameCounts.get(poi.name.toLowerCase()) ?? 1;
  const uniqueness = (1 / Math.sqrt(sameCategory)) * (sameName > 1 ? 0.5 : 1);
  // Big things are recognisable: 1 ha ≈ 0.57, 10 ha ≈ 0.86, saturating at ~30 ha.
  const size = poi.areaM2 ? Math.min(1, Math.log10(1 + poi.areaM2 / 1000) / 2.5) + 0.0 : 0.25;
  const preference = ctx.preferences?.[meta.group] === false ? 0 : 1;

  const w = SCORE_WEIGHTS;
  const raw = w.category * category + w.proximity * proximity + w.prominence * prominence + w.uniqueness * uniqueness + w.size * size;
  return { score: round3(raw * preference), breakdown: { category: round3(category), proximity: round3(proximity), prominence: round3(prominence), uniqueness: round3(uniqueness), size: round3(size), preference } };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function rankLandmarks(geo: Pick<Geography, 'frame' | 'pois'>, opts: RankOptions = {}): RankedPoi[] {
  const { frame } = geo;
  const target = opts.target ?? defaultLandmarkTarget(frame);

  // Collapse duplicates: the same named thing mapped as several points (e.g. a park with 3 entrances).
  const byIdentity = new Map<string, Poi>();
  for (const poi of geo.pois) {
    const k = `${poi.category}|${poi.name.toLowerCase()}`;
    const cur = byIdentity.get(k);
    const closer = !cur || Math.hypot(poi.pos[0], poi.pos[1]) < Math.hypot(cur.pos[0], cur.pos[1]);
    const near = cur && Math.hypot(poi.pos[0] - cur.pos[0], poi.pos[1] - cur.pos[1]) < Math.min(frame.widthM, frame.heightM) * 0.25;
    if (!cur) byIdentity.set(k, poi);
    else if (near) {
      if (closer) byIdentity.set(k, { ...poi, areaM2: Math.max(poi.areaM2 ?? 0, cur.areaM2 ?? 0) || undefined });
    } else byIdentity.set(`${k}|${poi.id}`, poi);
  }
  const candidates = [...byIdentity.values()];

  const categoryCounts = new Map<PoiCategory, number>();
  const nameCounts = new Map<string, number>();
  for (const p of candidates) {
    categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
    nameCounts.set(p.name.toLowerCase(), (nameCounts.get(p.name.toLowerCase()) ?? 0) + 1);
  }

  const ranked: RankedPoi[] = candidates
    .map((poi) => ({ poi, ...scorePoi(poi, { frame, categoryCounts, nameCounts, preferences: opts.preferences }), selected: false }))
    .sort((a, b) => b.score - a.score || (a.poi.id < b.poi.id ? -1 : 1));

  // Greedy selection with diversity (per-category cap) and spacing (no icon pile-ups).
  const perCategoryCap = Math.max(2, Math.ceil(target * 0.22));
  const minSpacing = Math.min(frame.widthM, frame.heightM) * 0.085;
  const insetX = frame.widthM * 0.06;
  const insetY = frame.heightM * 0.06;
  const homeClear = Math.min(frame.widthM, frame.heightM) * 0.07;
  const chosen: RankedPoi[] = [];
  const perCategory = new Map<PoiCategory, number>();
  for (const r of ranked) {
    if (chosen.length >= target) break;
    if (r.score <= 0) continue;
    const [x, y] = r.poi.pos;
    if (Math.abs(x) > frame.widthM / 2 - insetX || Math.abs(y) > frame.heightM / 2 - insetY) continue;
    if (Math.hypot(x, y) < homeClear) continue; // keep the home marker clear
    if ((perCategory.get(r.poi.category) ?? 0) >= perCategoryCap) continue;
    if (chosen.some((c) => Math.hypot(c.poi.pos[0] - x, c.poi.pos[1] - y) < minSpacing)) continue;
    r.selected = true;
    chosen.push(r);
    perCategory.set(r.poi.category, (perCategory.get(r.poi.category) ?? 0) + 1);
  }
  return ranked;
}
