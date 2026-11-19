import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listProjects, saveProject } from '@maploom/server';
import { guest, limit, route } from '@/lib/http';

export const GET = route('projects.list', async () => {
  const owner = await guest(false);
  return NextResponse.json({ projects: owner ? await listProjects(owner) : [] }, { headers: { 'Cache-Control': 'no-store' } });
});

const saveSchema = z.object({
  id: z.string().regex(/^prj_[\w-]+$/).optional(),
  name: z.string().max(80),
  design: z.unknown(),
  location: z.object({ label: z.string().max(120), context: z.string().max(160) }),
  note: z.string().max(120).optional(),
});

/** Explicit save: the only code path that persists a design or location. */
export const POST = route('projects.save', async (req) => {
  await limit('save', req);
  const input = saveSchema.parse(await req.json());
  const owner = (await guest(true))!;
  return NextResponse.json({ project: await saveProject(owner, input) });
});
