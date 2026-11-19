import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createOrder } from '@maploom/server';
import { guest, limit, route } from '@/lib/http';

const schema = z.object({
  projectId: z.string().regex(/^prj_[\w-]+$/).optional(),
  productId: z.string().max(40),
  variantId: z.string().max(40),
  quantity: z.number().int().min(1).max(20),
});

/** Creates an order. Amounts are computed server-side from the product configuration. */
export const POST = route('checkout.create', async (req) => {
  await limit('checkout', req);
  const input = schema.parse(await req.json());
  const owner = (await guest(true))!;
  const order = await createOrder(owner, { ...input, successUrl: '/create?order=placed', cancelUrl: '/create' });
  return NextResponse.json(order);
});
