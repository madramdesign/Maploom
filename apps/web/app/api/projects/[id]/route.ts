import { NextResponse } from 'next/server';
import { deleteProject, getProject, listVersions } from '@maploom/server';
import { requireGuest, route } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route('projects.get', async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const owner = await requireGuest();
  const v = new URL(req.url).searchParams.get('version');
  const [project, versions] = await Promise.all([getProject(owner, id, v ? Number(v) : undefined), listVersions(owner, id)]);
  return NextResponse.json({ project, versions }, { headers: { 'Cache-Control': 'no-store' } });
});

export const DELETE = route('projects.delete', async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteProject(await requireGuest(), id);
  return NextResponse.json({ ok: true });
});
