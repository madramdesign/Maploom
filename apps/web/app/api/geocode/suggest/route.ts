import { NextResponse } from 'next/server';
import { getGeocoder } from '@maploom/server';
import { limit, route } from '@/lib/http';

// The query is read from the URL but never logged or stored (see PRIVACY.md).
export const GET = route('geocode.suggest', async (req) => {
  await limit('suggest', req);
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const results = await getGeocoder().suggest(q, { limit: 6 });
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } });
});
