import { Readable } from 'node:stream';
import { AppError } from '@maploom/core';
import { exportStore, getDb } from '@maploom/server';
import { route, verifyDownload } from '@/lib/http';

/** Signed, expiring download link. */
export const GET = route('exports.download', async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  if (!/^exp_[\w-]+$/.test(id) || !verifyDownload(id, url.searchParams.get('exp'), url.searchParams.get('sig'))) throw new AppError('UNAUTHORIZED');
  const db = await getDb();
  const rows = await db.query<{ file_key: string; format: string; preset: string }>('SELECT file_key, format, preset FROM exports WHERE id=$1 AND expires_at > now()', [id]);
  const row = rows[0];
  if (!row || !exportStore.exists(row.file_key)) throw new AppError('NOT_FOUND');
  const body = Readable.toWeb(exportStore.stream(row.file_key)) as ReadableStream;
  return new Response(body, {
    headers: {
      'Content-Type': row.format === 'svg' ? 'image/svg+xml' : 'image/png',
      'Content-Length': String(exportStore.size(row.file_key)),
      'Content-Disposition': `attachment; filename="maploom-${row.preset}.${row.format}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
