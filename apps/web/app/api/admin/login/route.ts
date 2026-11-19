import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError } from '@maploom/core';
import { adminLogin, adminLogout, limit, route } from '@/lib/http';

export const POST = route('admin.login', async (req) => {
  await limit('admin', req);
  const { token } = z.object({ token: z.string().max(200) }).parse(await req.json());
  if (!(await adminLogin(token))) throw new AppError('UNAUTHORIZED');
  return NextResponse.json({ ok: true });
});

export const DELETE = route('admin.logout', async () => {
  await adminLogout();
  return NextResponse.json({ ok: true });
});
