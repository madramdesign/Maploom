import { z } from 'zod';
import { ICON_IDS, CATEGORY_GROUPS, type CategoryGroupId } from './categories';
import { POI_CATEGORIES } from './geo-types';

/**
 * The DESIGN document: everything a customer decided. Together with a
 * Geography snapshot and a style it fully determines the rendered artwork.
 * It contains no geometry except the lat/lon anchors of placed markers.
 */

export const STYLE_IDS = ['playful', 'minimal', 'watercolor', 'vintage', 'poster', 'blueprint'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

const lngLat = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
const shortText = (max: number) => z.string().max(max);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const id = z.string().min(1).max(80).regex(/^[\w:.-]+$/);

export const frameSchema = z.object({
  center: lngLat,
  widthM: z.number().min(200).max(40_000),
  heightM: z.number().min(200).max(40_000),
});

export const landmarkSchema = z.object({
  id,
  source: z.enum(['auto', 'custom']),
  poiId: z.string().max(80).optional(),
  label: shortText(60),
  category: z.enum(POI_CATEGORIES),
  icon: z.enum(ICON_IDS),
  lngLat,
  visible: z.boolean(),
  /** Manual nudge in metres from the true position (x east, y south). */
  dx: z.number().min(-20_000).max(20_000),
  dy: z.number().min(-20_000).max(20_000),
  scale: z.number().min(0.4).max(3),
  color: color.optional(),
  score: z.number().optional(),
});
export type Landmark = z.infer<typeof landmarkSchema>;

export const textItemSchema = z.object({
  id,
  text: shortText(120),
  /** Position as a fraction of the artwork (0..1 from the top-left). */
  x: z.number().min(-0.2).max(1.2),
  y: z.number().min(-0.2).max(1.2),
  scale: z.number().min(0.3).max(5),
  color: color.optional(),
  font: z.enum(['display', 'label']),
});
export type TextItem = z.infer<typeof textItemSchema>;

export const layersSchema = z.object({
  buildings: z.boolean(),
  parks: z.boolean(),
  water: z.boolean(),
  minorRoads: z.boolean(),
  paths: z.boolean(),
  rail: z.boolean(),
  roadLabels: z.boolean(),
  landmarkLabels: z.boolean(),
  decorations: z.boolean(),
  border: z.boolean(),
  compass: z.boolean(),
});
export type LayerToggles = z.infer<typeof layersSchema>;

export const designSchema = z.object({
  schema: z.literal(1),
  frame: frameSchema,
  /** Key of the geography snapshot this design was generated from. */
  geographyKey: z.string().max(80).optional(),
  styleId: z.enum(STYLE_IDS),
  product: z.object({
    productId: z.string().max(40),
    variantId: z.string().max(40),
    orientation: z.enum(['portrait', 'landscape', 'square']),
  }),
  title: z.object({
    show: z.boolean(),
    title: shortText(60),
    subtitle: shortText(80),
    dedication: shortText(140),
    date: shortText(40),
    position: z.enum(['top', 'bottom']),
  }),
  home: z.object({
    visible: z.boolean(),
    label: shortText(40),
    icon: z.enum(ICON_IDS),
    lngLat,
    dx: z.number(),
    dy: z.number(),
    scale: z.number().min(0.4).max(3),
    color: color.optional(),
  }),
  landmarks: z.array(landmarkSchema).max(120),
  texts: z.array(textItemSchema).max(40),
  layers: layersSchema,
  /** Geography feature ids the customer removed (roads, buildings, areas). */
  hidden: z.array(z.string().max(80)).max(2000),
  preferences: z.record(z.string(), z.boolean()),
  landmarkTarget: z.number().int().min(0).max(60),
});
export type Design = z.infer<typeof designSchema>;

export const DEFAULT_LAYERS: LayerToggles = {
  buildings: true,
  parks: true,
  water: true,
  minorRoads: true,
  paths: true,
  rail: true,
  roadLabels: true,
  landmarkLabels: true,
  decorations: true,
  border: true,
  compass: true,
};

export function defaultPreferences(): Record<CategoryGroupId, boolean> {
  const out = {} as Record<CategoryGroupId, boolean>;
  for (const g of CATEGORY_GROUPS) out[g.id] = g.id !== 'shopping';
  return out;
}

export function clampText(s: string, max: number): string {
  return s.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
}
