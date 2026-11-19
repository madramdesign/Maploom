import { AppError, designSchema, frameSchema, type Design, type Frame } from '@maploom/core';
import { z } from 'zod';
import { newToken } from './crypto';
import { getDb } from './db';
import { env } from './env';
import { exportPng, exportSvgFile, planExport, type ExportFormat, type ExportPreset } from './export';
import type { JobQueue } from './jobs';
import { buildGeography } from './services';
import { exportStore, geographyStore, purgeOldFiles } from './store';

export interface GeographyJobResult {
  geographyKey: string;
  counts: { roads: number; areas: number; buildings: number; pois: number };
}

export interface ExportJobResult {
  exportId: string;
  width: number;
  height: number;
  bytes: number;
  format: ExportFormat;
}

export const exportInputSchema = z.object({
  design: designSchema,
  geographyKey: z.string().regex(/^[0-9a-f]{24}$/),
  preset: z.enum(['preview', 'print']),
  format: z.enum(['png', 'svg']),
  projectId: z.string().max(40).optional(),
});
export type ExportJobInput = z.infer<typeof exportInputSchema>;

export const EXPORT_TTL_HOURS = 24;

export function registerHandlers(queue: JobQueue) {
  queue.register<{ frame: Frame }, GeographyJobResult>('geography', async (input, ctx) => {
    const frame = frameSchema.parse(input.frame);
    const geo = await buildGeography(frame, (f, stage) => ctx.progress(f, stage));
    return { geographyKey: geo.key, counts: { roads: geo.roads.length, areas: geo.areas.length, buildings: geo.buildings.length, pois: geo.pois.length } };
  });

  queue.register<ExportJobInput, ExportJobResult>('export', async (raw, ctx) => {
    const input = exportInputSchema.parse(raw);
    const design: Design = input.design;
    ctx.progress(0.02, 'Loading your map');
    let geo = await geographyStore.get(input.geographyKey);
    if (!geo) {
      // Snapshot expired from the cache: rebuild from the (versioned) source data.
      geo = await buildGeography(design.frame);
    }
    const plan = planExport(design, geo, input.preset, env().MAPLOOM_MAX_EXPORT_MP);
    const exportId = `exp_${newToken(12)}`;
    const fileKey = `${exportId}.${input.format}`;
    ctx.progress(0.05, input.preset === 'print' ? 'Drawing at print resolution' : 'Drawing your preview');
    if (input.format === 'svg') await exportSvgFile(geo, design, plan, exportStore.path(fileKey));
    else await exportPng(geo, design, plan, exportStore.path(fileKey), (f) => ctx.progress(0.05 + f * 0.93, undefined));
    const bytes = exportStore.size(fileKey);
    const db = await getDb();
    await db.query(
      `INSERT INTO exports (id, job_id, project_id, owner_hash, preset, format, width, height, bytes, file_key, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now() + ($11 || ' hours')::interval)`,
      [exportId, ctx.jobId, null, ctx.ownerHash, input.preset satisfies ExportPreset, input.format, plan.width, plan.height, bytes, fileKey, String(EXPORT_TTL_HOURS)],
    );
    return { exportId, width: plan.width, height: plan.height, bytes, format: input.format };
  });

  queue.register('maintenance', async () => purgeExpired());
}

/** Data-retention sweep. See docs/architecture/PRIVACY.md for the policy this enforces. */
export async function purgeExpired(): Promise<{ exports: number; jobs: number; snapshots: number }> {
  const db = await getDb();
  const expired = await db.query<{ id: string; file_key: string }>('DELETE FROM exports WHERE expires_at < now() RETURNING id, file_key');
  for (const e of expired) exportStore.remove(e.file_key);
  const jobs = await db.query(`DELETE FROM jobs WHERE status IN ('succeeded','failed') AND finished_at < now() - interval '24 hours' RETURNING id`);
  const keep = await db.query<{ geography_key: string }>('SELECT DISTINCT geography_key FROM projects WHERE geography_key IS NOT NULL');
  const snapshots = purgeOldFiles('geo', 30 * 24 * 3600_000, new Set(keep.map((k) => k.geography_key)));
  purgeOldFiles('exports', (EXPORT_TTL_HOURS + 1) * 3600_000);
  return { exports: expired.length, jobs: jobs.length, snapshots };
}

export function assertOwner(rowOwner: string | null, ownerHash: string) {
  if (!rowOwner || rowOwner !== ownerHash) throw new AppError('NOT_FOUND');
}
