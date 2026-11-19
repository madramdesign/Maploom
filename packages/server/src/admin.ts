import { getDb } from './db';

/** Read models for the admin dashboard. Never returns decrypted designs or addresses. */
export async function adminOverview() {
  const db = await getDb();
  const [projects, jobs, exportsRows, orders, usage, failed, counts] = await Promise.all([
    db.query(`SELECT id, name, status, style_id, product_id, variant_id, version, created_at, updated_at FROM projects ORDER BY updated_at DESC LIMIT 50`),
    db.query(`SELECT id, type, status, error_code, error_detail, progress, stage, attempts, created_at, started_at, finished_at FROM jobs ORDER BY created_at DESC LIMIT 60`),
    db.query(`SELECT id, job_id, preset, format, width, height, bytes, created_at, expires_at FROM exports ORDER BY created_at DESC LIMIT 40`),
    db.query(`SELECT id, status, product_id, variant_id, quantity, currency, total_cents, payment_provider, print_provider, created_at FROM orders ORDER BY created_at DESC LIMIT 50`),
    db.query(`SELECT day, provider, calls, errors FROM api_usage ORDER BY day DESC, provider LIMIT 30`),
    db.query(`SELECT id, type, error_code, error_detail, attempts, finished_at FROM jobs WHERE status='failed' ORDER BY finished_at DESC LIMIT 30`),
    db.query<{ k: string; n: string }>(
      `SELECT 'projects' AS k, count(*) AS n FROM projects UNION ALL SELECT 'jobs_24h', count(*) FROM jobs WHERE created_at > now() - interval '24 hours'
       UNION ALL SELECT 'failed_24h', count(*) FROM jobs WHERE status='failed' AND created_at > now() - interval '24 hours'
       UNION ALL SELECT 'exports', count(*) FROM exports UNION ALL SELECT 'orders', count(*) FROM orders`,
    ),
  ]);
  return { projects, jobs, exports: exportsRows, orders, usage, failed, counts: Object.fromEntries(counts.map((c) => [c.k, Number(c.n)])) };
}
