import type { PoiCategory } from '@maploom/core';

/**
 * OpenMapTiles `poi` layer (class / subclass) -> our category vocabulary.
 * Subclass is checked first because it is closer to the raw OSM tag.
 * Returning null means "never show this kind of place" (bus stops, parking…).
 */
const BY_SUBCLASS: Record<string, PoiCategory | null> = {
  school: 'school', university: 'school', college: 'school',
  kindergarten: 'daycare', childcare: 'daycare',
  playground: 'playground',
  park: 'park', garden: 'park', nature_reserve: 'park', dog_park: 'park',
  library: 'library',
  community_centre: 'community', social_centre: 'community', arts_centre: 'community',
  restaurant: 'restaurant', fast_food: 'restaurant', food_court: 'restaurant',
  cafe: 'cafe', coffee: 'cafe', tea: 'cafe',
  bakery: 'bakery', pastry: 'bakery', confectionery: 'bakery', chocolate: 'bakery',
  ice_cream: 'ice_cream',
  supermarket: 'grocery', greengrocer: 'grocery', deli: 'grocery', butcher: 'grocery', convenience: null,
  marketplace: 'market', farm: 'market',
  pitch: 'sports', stadium: 'sports', sports_centre: 'sports', track: 'sports', golf_course: 'sports',
  ice_rink: 'sports', miniature_golf: 'sports', bowling_alley: 'sports',
  baseball: 'sports', soccer: 'sports', basketball: 'sports', tennis: 'sports', american_football: 'sports',
  swimming_pool: 'pool', water_park: 'pool', swimming: 'pool',
  fitness_centre: 'gym',
  beach: 'beach', beach_resort: 'beach',
  museum: 'museum', gallery: 'museum', arts: 'museum',
  monument: 'monument', memorial: 'monument', artwork: 'monument',
  castle: 'historic', ruins: 'historic', archaeological_site: 'historic', fort: 'historic', lighthouse: 'historic', windmill: 'historic',
  attraction: 'attraction', viewpoint: 'attraction', theme_park: 'attraction', aquarium: 'zoo', zoo: 'zoo',
  townhall: 'government', courthouse: 'government', embassy: null,
  station: 'train', halt: 'train', tram_stop: null, subway: 'train',
  bus_station: 'bus', bus_stop: null,
  aerodrome: 'airport',
  mall: 'mall', department_store: 'mall',
  toys: 'shop', books: 'shop', bicycle: 'shop', gift: 'shop', pet: 'shop', florist: 'shop', garden_centre: 'shop', music: 'shop',
  hospital: 'hospital', clinic: null, doctors: null, dentist: null, pharmacy: null, veterinary: null,
  fire_station: 'fire_station',
  police: 'police',
  post_office: 'post_office',
  cinema: 'cinema',
  theatre: 'theatre',
  hotel: 'hotel', motel: null, hostel: null, guest_house: null,
  pub: 'bar', bar: 'bar', biergarten: 'bar', nightclub: null,
  cemetery: null, grave_yard: null,
  parking: null, bicycle_parking: null, fuel: null, charging_station: null, toll_booth: null, recycling: null,
  bank: null, atm: null, hairdresser: null, beauty: null, laundry: null, dry_cleaning: null,
};

const BY_CLASS: Record<string, PoiCategory | null> = {
  school: 'school', college: 'school', library: 'library', park: 'park', playground: 'playground',
  restaurant: 'restaurant', fast_food: 'restaurant', cafe: 'cafe', bakery: 'bakery', ice_cream: 'ice_cream',
  grocery: 'grocery', museum: 'museum', art_gallery: 'museum', castle: 'historic', town_hall: 'government',
  place_of_worship: 'worship', railway: 'train', aerialway: null, bus: null, harbor: 'attraction',
  hospital: 'hospital', fire_station: 'fire_station', police: 'police', post: 'post_office',
  cinema: 'cinema', theatre: 'theatre', zoo: 'zoo', attraction: 'attraction', lodging: null, bar: 'bar', beer: 'bar',
  swimming: 'pool', stadium: 'sports', pitch: 'sports', golf: 'sports', campsite: 'attraction',
  shop: null, clothing_store: null, office: null, parking: null, fuel: null, bank: null, cemetery: null,
  dentist: null, doctors: null, hairdresser: null, toll_booth: null, recycling: null, garden: 'park',
};

export function categorize(cls: string, subclass: string, name: string): PoiCategory | null {
  const lower = name.toLowerCase();
  let cat: PoiCategory | null | undefined = undefined;
  if (subclass in BY_SUBCLASS) cat = BY_SUBCLASS[subclass];
  else if (cls in BY_CLASS) cat = BY_CLASS[cls];
  if (cat === undefined || cat === null) return null;
  // Light, name-based refinement — only ever within the food family.
  if (cat === 'restaurant' || cat === 'cafe') {
    if (/\bpizz/.test(lower)) return 'pizza';
    if (/ice cream|gelat|frozen yog|creamery/.test(lower)) return 'ice_cream';
    if (/\bbaker|\bbagel|donut|doughnut/.test(lower)) return 'bakery';
  }
  return cat;
}
