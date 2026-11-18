import type { PoiCategory } from './geo-types';

/** Icon identifiers. The artwork for each lives in @maploom/render. */
export const ICON_IDS = [
  'house', 'heart', 'star', 'pin', 'flag',
  'school', 'daycare', 'playground', 'tree', 'library', 'community',
  'restaurant', 'cafe', 'bakery', 'ice_cream', 'pizza', 'grocery',
  'sports', 'pool', 'gym', 'beach', 'trail',
  'historic', 'monument', 'museum', 'worship', 'government', 'water',
  'train', 'bus', 'airport', 'shop', 'hospital', 'fire_station', 'police',
  'post_office', 'cinema', 'zoo', 'hotel', 'bar', 'castle', 'camera',
] as const;
export type IconId = (typeof ICON_IDS)[number];

export const CATEGORY_GROUPS = [
  { id: 'family', label: 'Family & school', blurb: 'Schools, playgrounds, libraries' },
  { id: 'food', label: 'Food & treats', blurb: 'Pizza, ice cream, cafés, bakeries' },
  { id: 'recreation', label: 'Play & outdoors', blurb: 'Parks, fields, pools, trails' },
  { id: 'landmarks', label: 'Landmarks', blurb: 'Museums, monuments, town hall' },
  { id: 'transport', label: 'Getting around', blurb: 'Train & bus stations, airports' },
  { id: 'shopping', label: 'Shops', blurb: 'Stores, markets, malls' },
  { id: 'services', label: 'Helpers', blurb: 'Fire station, police, hospital' },
] as const;
export type CategoryGroupId = (typeof CATEGORY_GROUPS)[number]['id'];

export interface CategoryMeta {
  label: string;
  group: CategoryGroupId;
  icon: IconId;
  /** Base desirability on a keepsake map, 0..1. Tuned by hand; see MAP_PIPELINE.md. */
  weight: number;
}

export const CATEGORY_META: Record<PoiCategory, CategoryMeta> = {
  school: { label: 'School', group: 'family', icon: 'school', weight: 0.95 },
  daycare: { label: 'Daycare', group: 'family', icon: 'daycare', weight: 0.7 },
  playground: { label: 'Playground', group: 'family', icon: 'playground', weight: 0.85 },
  library: { label: 'Library', group: 'family', icon: 'library', weight: 0.9 },
  community: { label: 'Community centre', group: 'family', icon: 'community', weight: 0.65 },
  restaurant: { label: 'Restaurant', group: 'food', icon: 'restaurant', weight: 0.45 },
  cafe: { label: 'Café', group: 'food', icon: 'cafe', weight: 0.5 },
  bakery: { label: 'Bakery', group: 'food', icon: 'bakery', weight: 0.6 },
  ice_cream: { label: 'Ice cream', group: 'food', icon: 'ice_cream', weight: 0.75 },
  pizza: { label: 'Pizza', group: 'food', icon: 'pizza', weight: 0.6 },
  grocery: { label: 'Grocery store', group: 'food', icon: 'grocery', weight: 0.5 },
  park: { label: 'Park', group: 'recreation', icon: 'tree', weight: 0.9 },
  sports: { label: 'Sports field', group: 'recreation', icon: 'sports', weight: 0.55 },
  pool: { label: 'Pool', group: 'recreation', icon: 'pool', weight: 0.7 },
  gym: { label: 'Gym', group: 'recreation', icon: 'gym', weight: 0.3 },
  beach: { label: 'Beach', group: 'recreation', icon: 'beach', weight: 0.9 },
  trail: { label: 'Trail', group: 'recreation', icon: 'trail', weight: 0.5 },
  zoo: { label: 'Zoo', group: 'recreation', icon: 'zoo', weight: 0.95 },
  historic: { label: 'Historic site', group: 'landmarks', icon: 'historic', weight: 0.8 },
  monument: { label: 'Monument', group: 'landmarks', icon: 'monument', weight: 0.8 },
  museum: { label: 'Museum', group: 'landmarks', icon: 'museum', weight: 0.9 },
  worship: { label: 'Place of worship', group: 'landmarks', icon: 'worship', weight: 0.5 },
  government: { label: 'Town hall', group: 'landmarks', icon: 'government', weight: 0.7 },
  water_feature: { label: 'Lake or river', group: 'landmarks', icon: 'water', weight: 0.75 },
  attraction: { label: 'Attraction', group: 'landmarks', icon: 'camera', weight: 0.85 },
  cinema: { label: 'Cinema', group: 'landmarks', icon: 'cinema', weight: 0.6 },
  theatre: { label: 'Theatre', group: 'landmarks', icon: 'cinema', weight: 0.65 },
  train: { label: 'Train station', group: 'transport', icon: 'train', weight: 0.8 },
  bus: { label: 'Bus station', group: 'transport', icon: 'bus', weight: 0.25 },
  airport: { label: 'Airport', group: 'transport', icon: 'airport', weight: 0.85 },
  shop: { label: 'Shop', group: 'shopping', icon: 'shop', weight: 0.3 },
  mall: { label: 'Shopping centre', group: 'shopping', icon: 'shop', weight: 0.55 },
  market: { label: 'Market', group: 'shopping', icon: 'grocery', weight: 0.6 },
  hospital: { label: 'Hospital', group: 'services', icon: 'hospital', weight: 0.6 },
  fire_station: { label: 'Fire station', group: 'services', icon: 'fire_station', weight: 0.85 },
  police: { label: 'Police station', group: 'services', icon: 'police', weight: 0.6 },
  post_office: { label: 'Post office', group: 'services', icon: 'post_office', weight: 0.55 },
  hotel: { label: 'Hotel', group: 'shopping', icon: 'hotel', weight: 0.25 },
  bar: { label: 'Bar', group: 'food', icon: 'bar', weight: 0.15 },
  other: { label: 'Place', group: 'landmarks', icon: 'pin', weight: 0.2 },
};

/** Suggested personal places a user can add by hand. */
export const PERSONAL_PLACE_PRESETS: { label: string; icon: IconId }[] = [
  { label: "Grandma's house", icon: 'heart' },
  { label: "Grandpa's house", icon: 'heart' },
  { label: "Best friend's house", icon: 'star' },
  { label: 'Our school', icon: 'school' },
  { label: 'Favourite park', icon: 'tree' },
  { label: 'Favourite restaurant', icon: 'restaurant' },
  { label: 'Where we met', icon: 'heart' },
  { label: 'Special place', icon: 'flag' },
];
