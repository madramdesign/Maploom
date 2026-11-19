import { NextResponse } from 'next/server';
import { z } from 'zod';
import { frameSchema } from '@maploom/core';
import { getQueue, validateFrame } from '@maploom/server';
import { guest, limit, route } from '@/lib/http';

/** Start building the geography for a frame. Returns a job to poll. */
export const POST = route('geography.create', async (req) => {
  await limit('geography', req);
  const { frame } = z.object({ frame: frameSchema }).parse(await req.json());
  validateFrame(frame);
  const owner = await guest(true);
  const jobId = await (await getQueue()).enqueue('geography', { frame }, owner);
  return NextResponse.json({ jobId }, { status: 202 });
});
