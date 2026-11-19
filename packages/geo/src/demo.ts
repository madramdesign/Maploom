import type { LngLat } from '@maploom/core';

/** Public, well-known spots used for demos, seeding and tests. No private addresses. */
export interface DemoLocation {
  id: string;
  label: string;
  context: string;
  lngLat: LngLat;
  /** Tiles for this location are checked in under tests/fixtures. */
  fixture?: boolean;
}

export const DEMO_LOCATIONS: DemoLocation[] = [
  { id: 'clifton', label: 'Clifton', context: 'New Jersey', lngLat: { lat: 40.8651, lon: -74.1585 }, fixture: true },
  { id: 'brooklyn', label: 'Park Slope, Brooklyn', context: 'New York', lngLat: { lat: 40.6712, lon: -73.9776 } },
  { id: 'chicago', label: 'Lincoln Park', context: 'Chicago, Illinois', lngLat: { lat: 41.9214, lon: -87.6387 } },
  { id: 'seattle', label: 'Green Lake', context: 'Seattle, Washington', lngLat: { lat: 47.6797, lon: -122.3258 } },
  { id: 'sf', label: 'Noe Valley', context: 'San Francisco, California', lngLat: { lat: 37.7502, lon: -122.4337 } },
];
