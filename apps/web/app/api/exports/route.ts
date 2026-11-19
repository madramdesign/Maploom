import { NextResponse } from 'next/server';
import { exportInputSchema, getQueue } from '@maploom/server';
import { guest, limit, route } from '@/lib/http';

/** Queue a render (preview or print resolution). The design is not persisted beyond the job. */
export const POST = route('exports.create', async (req) => {
  await limit('export', req);
  const input = exportInputSchema.parse(await req.json());
  const owner = await guest(true);
  const jobId = await (await getQueue()).enqueue('export', input, owner, 1);
  return NextResponse.json({ jobId }, { status: 202 });
});
