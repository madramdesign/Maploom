import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getGeocoder } from '@maploom/server';
import { limit, route } from '@/lib/http';

// POST so that a full address never appears in a URL, access log or browser history.
export const POST = route('geocode.search', async (req) => {
  await limit('search', req);
  const { q } = z.object({ q: z.string().min(2).max(200) }).parse(await req.json());
  const results = await getGeocoder().search(q, { limit: 5 });
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } });
});
