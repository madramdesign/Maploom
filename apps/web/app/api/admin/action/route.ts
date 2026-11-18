import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError } from '@maploom/core';
import { getDb, getQueue, log, purgeExpired, setOrderStatus } from '@maploom/server';
import { requireAdmin, route } from '@/lib/http';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('retry-job'), id: z.string().max(60) }),
  z.object({ action: z.literal('order-status'), id: z.string().max(60), status: z.string().max(30) }),
  z.object({ action: z.literal('delete-project'), id: z.string().max(60) }),
  z.object({ action: z.literal('purge') }),
]);

export const POST = route('admin.action', async (req) => {
  await requireAdmin();
  const input = schema.parse(await req.json());
  log.info('admin.action', { action: input.action });
  switch (input.action) {
    case 'retry-job':
      if (!(await (await getQueue()).retry(input.id))) throw new AppError('NOT_FOUND');
      return NextResponse.json({ ok: true });
    case 'order-status':
      await setOrderStatus(input.id, input.status, 'admin');
      return NextResponse.json({ ok: true });
    case 'delete-project': {
      const rows = await (await getDb()).query('DELETE FROM projects WHERE id=$1 RETURNING id', [input.id]);
      if (!rows.length) throw new AppError('NOT_FOUND');
      return NextResponse.json({ ok: true });
    }
    case 'purge':
      return NextResponse.json({ ok: true, ...(await purgeExpired()) });
  }
});
