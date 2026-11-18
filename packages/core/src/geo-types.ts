/**
 * The GEOGRAPHIC model. Nothing in this file knows about colours, fonts or
 * products — it describes real places only. Rendering lives in @maploom/render.
 */

export interface LngLat {
  lat: number;
  lon: number;
}

/** A point in frame-local metres: x grows east, y grows SOUTH (screen-like). */
export type Pt = [number, number];

/** The piece of the world a map covers. Centre plus physical extent in metres. */
export interface Frame {
  center: LngLat;
  widthM: number;
  heightM: number;
}

export const ROAD_CLASSES = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'minor',
  'service',
  'path',
  'rail',
] as const;
export type RoadClass = (typeof ROAD_CLASSES)[number];

export interface Road {
  id: string;
  cls: RoadClass;
  name?: string;
  bridge?: boolean;
  tunnel?: boolean;
  pts: Pt[];
}

export const AREA_KINDS = [
  'park',
  'grass',
  'wood',
  'sand',
  'farmland',
  'wetland',
  'pitch',
  'playground',
  'school',
  'hospital',
  'cemetery',
  'residential',
  'commercial',
  'industrial',
  'water',
] as const;
export type AreaKind = (typeof AREA_KINDS)[number];

/** Polygon with holes: polys[i][0] is an outer ring, the rest are holes. */
export interface Area {
  id: string;
  kind: AreaKind;
  name?: string;
  polys: Pt[][][];
}

export interface Building {
  id: string;
  ring: Pt[];
  height?: number;
}

export interface Waterway {
  id: string;
  cls: 'river' | 'stream' | 'canal';
  name?: string;
  pts: Pt[];
}

export const POI_CATEGORIES = [
  'school',
  'daycare',
  'playground',
  'park',
  'library',
  'community',
  'restaurant',
  'cafe',
  'bakery',
  'ice_cream',
  'pizza',
  'grocery',
  'sports',
  'pool',
  'gym',
  'beach',
  'trail',
  'historic',
  'monument',
  'museum',
  'worship',
  'government',
  'water_feature',
  'train',
  'bus',
  'airport',
  'shop',
  'mall',
  'market',
  'hospital',
  'fire_station',
  'police',
  'post_office',
  'cinema',
  'theatre',
  'zoo',
  'attraction',
  'hotel',
  'bar',
  'other',
] as const;
export type PoiCategory = (typeof POI_CATEGORIES)[number];

export interface Poi {
  id: string;
  name: string;
  category: PoiCategory;
  /** Raw source class/subclass, kept for transparency & debugging. */
  sourceClass: string;
  sourceSubclass: string;
  /** Source prominence rank (1 = most prominent within its tile), if any. */
  rank?: number;
  pos: Pt;
  lngLat: LngLat;
  /** Area of the matching polygon in m², when the POI represents an area. */
  areaM2?: number;
  /** Extra tags when the source provides them (e.g. wikidata via Overpass). */
  tags?: Record<string, string>;
}

export interface PlaceName {
  name: string;
  cls: string;
  pos: Pt;
}

export interface GeographySource {
  provider: string;
  dataVersion: string;
  attribution: string;
  fetchedAt: string;
}

export interface Geography {
  schema: 1;
  /** Content hash of the snapshot — identical data yields an identical key. */
  key: string;
  frame: Frame;
  source: GeographySource;
  roads: Road[];
  areas: Area[];
  buildings: Building[];
  waterways: Waterway[];
  pois: Poi[];
  places: PlaceName[];
}

export interface GeocodeResult {
  id: string;
  /** Short human label, e.g. "123 Main St". */
  label: string;
  /** Secondary line, e.g. "Clifton, New Jersey". */
  context: string;
  lngLat: LngLat;
  kind: 'address' | 'street' | 'poi' | 'neighbourhood' | 'city' | 'region' | 'other';
  address: {
    houseNumber?: string;
    street?: string;
    neighbourhood?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countryCode?: string;
  };
  /** Suggested bounds from the geocoder (south, west, north, east). */
  bbox?: [number, number, number, number];
}
