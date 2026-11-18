import { NextResponse } from 'next/server';
import { AppError, ERROR_MESSAGES } from '@maploom/core';
import { getQueue, type ExportJobResult } from '@maploom/server';
import { downloadUrl, requireGuest, route } from '@/lib/http';

export const GET = route('jobs.get', async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const owner = await requireGuest();
  const job = await (await getQueue()).get(id);
  if (!job || job.owner_hash !== owner) throw new AppError('NOT_FOUND');
  let result = job.status === 'succeeded' ? (job.result as Record<string, unknown>) : null;
  if (result && job.type === 'export') result = { ...result, downloadUrl: downloadUrl((result as unknown as ExportJobResult).exportId) };
  return NextResponse.json(
    {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      result,
      // Customers get the friendly message only — never internal detail.
      error: job.status === 'failed' && job.error_code ? { code: job.error_code, message: ERROR_MESSAGES[job.error_code] ?? ERROR_MESSAGES.INTERNAL } : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
});
