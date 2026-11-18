import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppError, PRODUCTS, aspectRatio, findVariant, formatMoney, printPixels, quote, trimSizeIn } from '@maploom/core';
import { createDesign } from '@maploom/render';
import { CLIFTON, cliftonFrame } from './fixture-tiles';

process.env.MAPLOOM_DATA_DIR = mkdtempSync(join(tmpdir(), 'maploom-data-'));
process.env.MAPLOOM_ROOT = '/';
process.env.MAPLOOM_INLINE_WORKER = '0';
process.env.APP_SECRET = 'test-secret-test-secret-test-secret-0123';

const server = await import('@maploom/server');

describe('pricing & product configuration', () => {
  it('quotes from configuration with shipping', () => {
    const q = quote('poster', 'poster-18x24', 2);
    const v = findVariant('poster', 'poster-18x24')!.variant;
    expect(q.itemCents).toBe(v.priceCents * 2);
    expect(q.totalCents).toBe(v.priceCents * 2 + v.shippingCents);
    expect(formatMoney(q.totalCents)).toMatch(/^\$\d+\.\d\d$/);
    expect(() => quote('poster', 'nope')).toThrow();
    expect(() => quote('poster', 'poster-18x24', 0)).toThrow();
    expect(() => quote('poster', 'poster-18x24', 1.5)).toThrow();
  });
  it('derives print pixels and aspect from size + dpi + orientation', () => {
    const mat = findVariant('play-mat', 'mat-4x6')!.variant;
    expect(printPixels(mat, 'portrait', 300)).toEqual({ width: 14400, height: 21600 });
    expect(trimSizeIn(mat, 'landscape')).toEqual({ widthIn: 72, heightIn: 48 });
    expect(aspectRatio(mat, 'square')).toBe(1);
    for (const p of PRODUCTS) for (const v of p.variants) expect(v.priceCents > 0 && v.longIn >= v.shortIn && v.dpi >= 150).toBe(true);
  });
});

describe('crypto & logging hygiene', () => {
  it('encrypts and authenticates', () => {
    const secret = 's'.repeat(40);
    const box = server.encrypt(secret, '123 Main Street');
    expect(box).not.toContain('Main');
    expect(server.decrypt(secret, box)).toBe('123 Main Street');
    expect(() => server.decrypt(secret, box.slice(0, -3) + 'AAA')).toThrow();
    expect(() => server.decrypt('x'.repeat(40), box)).toThrow();
  });
  it('signs expiring links', () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const sig = server.sign('k'.repeat(40), 'exp_1', exp);
    expect(server.verifySignature('k'.repeat(40), 'exp_1', exp, sig)).toBe(true);
    expect(server.verifySignature('k'.repeat(40), 'exp_2', exp, sig)).toBe(false);
    expect(server.verifySignature('k'.repeat(40), 'exp_1', exp + 1, sig)).toBe(false);
    expect(server.verifySignature('k'.repeat(40), 'exp_1', exp, sig, exp + 10)).toBe(false);
  });
  it('never logs addresses or coordinates', () => {
    const scrubbed = JSON.stringify(server.__test.scrub({ jobId: 'j1', query: '123 Main St', frame: { center: { lat: 1, lon: 2 } }, nested: { address: 'x', ok: 1 } }));
    expect(scrubbed).not.toMatch(/Main|"lat":1/);
    expect(scrubbed).toContain('j1');
  });
  it('rate limits per key', () => {
    server.resetRateLimits();
    const opts = { capacity: 3, refillPerSec: 0 };
    for (let i = 0; i < 3; i++) server.rateLimit('a', opts);
    expect(() => server.rateLimit('a', opts)).toThrow(AppError);
    expect(() => server.rateLimit('b', opts)).not.toThrow();
  });
});

describe('database-backed features (embedded Postgres)', () => {
  let db: Awaited<ReturnType<typeof server.getDb>>;
  beforeAll(async () => {
    db = await server.getDb();
  });

  const design = () => createDesign({ frame: cliftonFrame, home: CLIFTON, title: 'Secret Family Name' });

  it('saves, versions, lists, loads and deletes projects — encrypted at rest, owner-scoped', async () => {
    const saved = await server.saveProject('owner-a', { name: 'Emma', design: design(), location: { label: '123 Main Street', context: 'Clifton, NJ' } });
    expect(saved.version).toBe(1);
    const raw = JSON.stringify(await db.query('SELECT * FROM projects UNION ALL SELECT id, project_id, NULL, design_enc, NULL, NULL, NULL, NULL, NULL, NULL, NULL, now(), now() FROM design_versions').catch(async () => [await db.query('SELECT * FROM projects'), await db.query('SELECT * FROM design_versions')]));
    expect(raw).not.toMatch(/Main Street|Secret Family|40\.865/);

    const d2 = design();
    d2.styleId = 'vintage';
    const v2 = await server.saveProject('owner-a', { id: saved.id, name: 'Emma', design: d2, location: { label: 'x', context: 'y' } });
    expect(v2.version).toBe(2);
    expect((await server.getProject('owner-a', saved.id)).design.styleId).toBe('vintage');
    expect((await server.getProject('owner-a', saved.id, 1)).design.styleId).toBe('playful');
    expect((await server.listVersions('owner-a', saved.id)).map((v) => v.version)).toEqual([2, 1]);

    await expect(server.getProject('owner-b', saved.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(server.saveProject('owner-b', { id: saved.id, name: 'x', design: design(), location: { label: '', context: '' } })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(server.deleteProject('owner-b', saved.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await server.listProjects('owner-b')).toEqual([]);

    await server.deleteProject('owner-a', saved.id);
    expect(await server.listProjects('owner-a')).toEqual([]);
    expect(await db.query('SELECT 1 FROM design_versions WHERE project_id=$1', [saved.id])).toEqual([]);
  });

  it('rejects malformed designs', async () => {
    await expect(server.saveProject('o', { name: 'x', design: { ...design(), styleId: 'nope' }, location: { label: '', context: '' } })).rejects.toThrow();
    await expect(server.saveProject('o', { name: 'x', design: { ...design(), frame: { center: { lat: 999, lon: 0 }, widthM: 1, heightM: 1 } }, location: { label: '', context: '' } })).rejects.toThrow();
  });

  it('runs jobs with progress, retries transient failures and records permanent ones', async () => {
    const queue = new server.JobQueue(db, process.env.APP_SECRET!, 2);
    let flaky = 0;
    queue.register<{ n: number }, { doubled: number }>('double', async (input, ctx) => {
      ctx.progress(0.5, 'halfway');
      return { doubled: input.n * 2 };
    });
    queue.register('flaky', async () => {
      if (flaky++ === 0) throw new AppError('GEODATA_UNAVAILABLE', 'first try');
      return { ok: true };
    });
    queue.register('broken', async () => {
      throw new Error('kaboom with internal detail');
    });
    const a = await queue.enqueue('double', { n: 21, address: 'top secret lane' }, 'owner-a');
    const c = await queue.enqueue('broken', {}, null);
    await queue.drain();
    expect(await queue.get(a)).toMatchObject({ status: 'succeeded', result: { doubled: 42 }, progress: 1 });
    expect(await queue.get(c)).toMatchObject({ status: 'failed', error_code: 'INTERNAL' });
    expect(JSON.stringify(await db.query('SELECT input_enc FROM jobs WHERE id=$1', [a]))).not.toContain('secret lane');
    await expect(queue.enqueue('nope', {}, null)).rejects.toMatchObject({ code: 'INVALID_INPUT' });

    const b = await queue.enqueue('flaky', {}, null);
    await new Promise((r) => setTimeout(r, 300));
    expect(await queue.get(b)).toMatchObject({ status: 'queued', attempts: 1, error_code: 'GEODATA_UNAVAILABLE' });
    await db.query('UPDATE jobs SET run_after = now() WHERE id=$1', [b]);
    await queue.drain();
    expect(await queue.get(b)).toMatchObject({ status: 'succeeded', attempts: 2 });

    expect(await queue.retry(c)).toBe(true);
    await queue.drain();
    expect((await queue.get(c))!.status).toBe('failed');
    queue.stop();
  });

  it('creates orders with server-side prices through swappable providers', async () => {
    const order = await server.createOrder('owner-a', { productId: 'poster', variantId: 'poster-18x24', quantity: 1, successUrl: '/ok', cancelUrl: '/no' });
    expect(order.testMode).toBe(true);
    expect(order.quote.totalCents).toBe(quote('poster', 'poster-18x24').totalCents);
    await server.setOrderStatus(order.orderId, 'approved', 'admin');
    await expect(server.setOrderStatus(order.orderId, 'whatever', 'admin')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(server.createOrder('o', { productId: 'play-mat', variantId: 'mat-4x6', quantity: 1, successUrl: '/', cancelUrl: '/' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(server.createOrder('o', { productId: 'poster', variantId: 'poster-18x24', quantity: 500, successUrl: '/', cancelUrl: '/' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });

    const print = server.getPrintProvider();
    expect(print.validateArtwork('poster', 'poster-18x24', { url: 'x', width: 5400, height: 7200, dpi: 300 }).ok).toBe(true);
    expect(print.validateArtwork('poster', 'poster-18x24', { url: 'x', width: 1000, height: 1400, dpi: 72 }).problems.length).toBe(2);
    const overview = await server.adminOverview();
    expect(overview.orders[0]).toMatchObject({ id: order.orderId, status: 'approved' });
    expect(overview.counts.orders).toBe(1);
  });
});
