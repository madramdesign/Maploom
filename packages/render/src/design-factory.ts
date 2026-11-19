import {
  CATEGORY_META,
  DEFAULT_LAYERS,
  defaultPreferences,
  type CategoryGroupId,
  type Design,
  type Frame,
  type Geography,
  type Landmark,
  type LngLat,
  type StyleId,
} from '@maploom/core';
import { rankLandmarks, type RankedPoi } from '@maploom/geo';

/** Share of the artwork height the title block occupies (generous, covers every style). */
export const TITLE_KEEP_OUT = 0.19;

export function landmarkFromRanked(r: RankedPoi, visible = r.selected): Landmark {
  const meta = CATEGORY_META[r.poi.category];
  return {
    id: `lm-${r.poi.id}`,
    source: 'auto',
    poiId: r.poi.id,
    label: r.poi.name.slice(0, 60),
    category: r.poi.category,
    icon: meta.icon,
    lngLat: r.poi.lngLat,
    visible,
    dx: 0,
    dy: 0,
    scale: 1,
    score: r.score,
  };
}

/**
 * Landmarks for a design: every ranked candidate becomes an entry (so the
 * customer can switch any of them on), with the automatic selection visible.
 * Custom places and manual overrides from `previous` are preserved.
 */
export function suggestLandmarks(
  geo: Geography,
  preferences: Partial<Record<CategoryGroupId, boolean>>,
  target: number,
  previous: Landmark[] = [],
  title?: { show: boolean; position: 'top' | 'bottom' },
): Landmark[] {
  // Don't auto-place landmarks where the title block will sit.
  const keepOut = title?.show ? { [title.position]: TITLE_KEEP_OUT } : undefined;
  const ranked = rankLandmarks(geo, { preferences, target, keepOut });
  const prev = new Map(previous.map((l) => [l.id, l]));
  const auto = ranked.slice(0, 90).map((r) => {
    const fresh = landmarkFromRanked(r);
    const old = prev.get(fresh.id);
    // Keep label/icon/position edits; let visibility follow the new ranking.
    return old ? { ...old, visible: fresh.visible, score: fresh.score } : fresh;
  });
  return [...previous.filter((l) => l.source === 'custom'), ...auto];
}

export function createDesign(input: { frame: Frame; home: LngLat; styleId?: StyleId; title?: string; homeLabel?: string }): Design {
  return {
    schema: 1,
    frame: input.frame,
    styleId: input.styleId ?? 'playful',
    product: { productId: 'poster', variantId: 'poster-18x24', orientation: 'portrait' },
    title: { show: true, title: input.title ?? 'Our Neighborhood', subtitle: '', dedication: '', date: '', position: 'top' },
    home: { visible: true, label: input.homeLabel ?? 'Home', icon: 'house', lngLat: input.home, dx: 0, dy: 0, scale: 1 },
    landmarks: [],
    texts: [],
    layers: { ...DEFAULT_LAYERS },
    hidden: [],
    preferences: defaultPreferences(),
    landmarkTarget: 12,
  };
}
