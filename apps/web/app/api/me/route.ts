import { NextResponse } from 'next/server';
import { deleteAllForOwner } from '@maploom/server';
import { clearGuest, guest, route } from '@/lib/http';

/** "Delete everything": removes all saved projects, exports and jobs for this browser. */
export const DELETE = route('me.delete', async () => {
  const owner = await guest(false);
  const result = owner ? await deleteAllForOwner(owner) : { projects: 0 };
  await clearGuest();
  return NextResponse.json({ ok: true, ...result });
});
