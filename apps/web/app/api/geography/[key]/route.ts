import { gunzipSync } from 'node:zlib';
import { AppError } from '@maploom/core';
import { geographyStore } from '@maploom/server';
import { route } from '@/lib/http';

/** Fetch a geography snapshot by its content hash (the key is an unguessable capability). */
export const GET = route('geography.get', async (_req, ctx: { params: Promise<{ key: string }> }) => {
  const { key } = await ctx.params;
  if (!/^[0-9a-f]{24}$/.test(key)) throw new AppError('NOT_FOUND');
  const gz = await geographyStore.getGzipped(key);
  if (!gz) throw new AppError('NOT_FOUND');
  // Sent as plain JSON; the HTTP layer applies transport compression itself.
  return new Response(new Uint8Array(gunzipSync(gz)), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=86400, immutable' } });
});
