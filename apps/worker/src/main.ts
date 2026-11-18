/**
 * Standalone job worker. Use when the web app runs with MAPLOOM_INLINE_WORKER=0.
 * Requires DATABASE_URL (the embedded dev database is single-process).
 */
import { env, getQueue, log } from '@maploom/server';

process.env.MAPLOOM_INLINE_WORKER = '1'; // this process IS the worker
if (!env().DATABASE_URL) {
  console.error('The standalone worker needs DATABASE_URL (shared Postgres). In development the web app runs jobs in-process.');
  process.exit(1);
}
const queue = await getQueue();
log.info('worker.started', {});
// Retention sweep every hour.
setInterval(() => void queue.enqueue('maintenance', {}, null, 1).catch(() => undefined), 3600_000);
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => (queue.stop(), process.exit(0)));
