import { AppError, toAppError, type ErrorCode } from '@maploom/core';
import { decrypt, encrypt, newToken } from './crypto';
import { getDb, type Db } from './db';
import { env } from './env';
import { log } from './log';

/**
 * A small Postgres-backed job queue. Rows are claimed with
 * FOR UPDATE SKIP LOCKED, so any number of worker processes can share it; in
 * development the web server runs a worker in-process. Moving to a dedicated
 * queue (pg-boss, BullMQ, SQS) later only means re-implementing this file.
 *
 * Job inputs may contain coordinates, so they are encrypted at rest and rows
 * are purged a day after finishing.
 */
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface JobRow {
  id: string;
  type: string;
  status: JobStatus;
  owner_hash: string | null;
  result: unknown;
  error_code: ErrorCode | null;
  error_detail: string | null;
  progress: number;
  stage: string | null;
  attempts: number;
  max_attempts: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface JobContext {
  jobId: string;
  ownerHash: string | null;
  progress(fraction: number, stage?: string): void;
}

export type JobHandler<I = unknown, R = unknown> = (input: I, ctx: JobContext) => Promise<R>;

const RETRYABLE: ErrorCode[] = ['GEODATA_UNAVAILABLE', 'GEOCODER_UNAVAILABLE', 'PRINT_PROVIDER_UNAVAILABLE', 'AI_FAILED'];
const COLS = 'id, type, status, owner_hash, result, error_code, error_detail, progress, stage, attempts, max_attempts, created_at, started_at, finished_at';

export class JobQueue {
  private handlers = new Map<string, JobHandler>();
  private active = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;

  constructor(private db: Db, private secret: string, private concurrency = 2) {}

  register<I, R>(type: string, handler: JobHandler<I, R>) {
    this.handlers.set(type, handler as JobHandler);
  }

  async enqueue(type: string, input: unknown, ownerHash: string | null, maxAttempts = 3): Promise<string> {
    if (!this.handlers.has(type)) throw new AppError('INVALID_INPUT', `unknown job type ${type}`);
    const id = `job_${newToken(12)}`;
    await this.db.query('INSERT INTO jobs (id, type, owner_hash, input_enc, max_attempts) VALUES ($1,$2,$3,$4,$5)', [id, type, ownerHash, encrypt(this.secret, JSON.stringify(input)), maxAttempts]);
    this.kick();
    return id;
  }

  async get(id: string): Promise<JobRow | null> {
    const rows = await this.db.query<JobRow>(`SELECT ${COLS} FROM jobs WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  /** Re-queue a failed job (admin action). */
  async retry(id: string): Promise<boolean> {
    const rows = await this.db.query(`UPDATE jobs SET status='queued', attempts=0, error_code=NULL, error_detail=NULL, progress=0, stage=NULL, run_after=now(), finished_at=NULL WHERE id=$1 AND status='failed' RETURNING id`, [id]);
    this.kick();
    return rows.length > 0;
  }

  start(pollMs = 2000) {
    this.stopped = false;
    if (!this.timer) {
      this.timer = setInterval(() => this.kick(), pollMs);
      this.timer.unref?.();
    }
    // Jobs left 'running' by a crashed process go back to the queue.
    void this.db.query(`UPDATE jobs SET status='queued', run_after=now() WHERE status='running' AND started_at < now() - interval '15 minutes'`).catch(() => undefined);
    this.kick();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Resolves when nothing is queued or running (tests). */
  async drain(timeoutMs = 60_000): Promise<void> {
    const t0 = Date.now();
    for (;;) {
      this.kick();
      const rows = await this.db.query<{ n: string }>(`SELECT count(*) AS n FROM jobs WHERE status IN ('queued','running')`);
      if (Number(rows[0].n) === 0 && this.active === 0) return;
      if (Date.now() - t0 > timeoutMs) throw new Error('job queue did not drain');
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  kick() {
    if (this.stopped) return;
    while (this.active < this.concurrency) {
      this.active++;
      void this.runOne()
        .then((ran) => {
          this.active--;
          if (ran) this.kick();
        })
        .catch((err) => {
          this.active--;
          log.error('job.loop_error', { message: err instanceof Error ? err.message : String(err) });
        });
    }
  }

  private async runOne(): Promise<boolean> {
    const claimed = await this.db.query<JobRow & { input_enc: string }>(
      `UPDATE jobs SET status='running', started_at=now(), attempts=attempts+1
       WHERE id = (SELECT id FROM jobs WHERE status='queued' AND run_after <= now() ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
       RETURNING ${COLS}, input_enc`,
    );
    const job = claimed[0];
    if (!job) return false;
    const handler = this.handlers.get(job.type);
    const t0 = Date.now();
    let lastWrite = 0;
    const ctx: JobContext = {
      jobId: job.id,
      ownerHash: job.owner_hash,
      progress: (fraction, stage) => {
        const now = Date.now();
        if (now - lastWrite < 200 && fraction < 1) return;
        lastWrite = now;
        void this.db.query('UPDATE jobs SET progress=$2, stage=COALESCE($3, stage) WHERE id=$1', [job.id, Math.max(0, Math.min(1, fraction)), stage ?? null]).catch(() => undefined);
      },
    };
    try {
      if (!handler) throw new AppError('INTERNAL', `no handler for ${job.type}`);
      const result = await handler(JSON.parse(decrypt(this.secret, job.input_enc)), ctx);
      await this.db.query(`UPDATE jobs SET status='succeeded', result=$2::jsonb, progress=1, finished_at=now() WHERE id=$1`, [job.id, JSON.stringify(result ?? null)]);
      log.info('job.succeeded', { jobId: job.id, type: job.type, ms: Date.now() - t0 });
    } catch (raw) {
      const err = toAppError(raw);
      const retry = RETRYABLE.includes(err.code) && job.attempts < job.max_attempts;
      if (retry) {
        await this.db.query(`UPDATE jobs SET status='queued', run_after = now() + ($2 || ' seconds')::interval, error_code=$3, error_detail=$4 WHERE id=$1`, [job.id, String(2 ** job.attempts * 2), err.code, err.detail ?? null]);
      } else {
        await this.db.query(`UPDATE jobs SET status='failed', error_code=$2, error_detail=$3, finished_at=now() WHERE id=$1`, [job.id, err.code, (err.detail ?? '').slice(0, 500)]);
      }
      log.warn('job.failed', { jobId: job.id, type: job.type, code: err.code, detail: err.detail, willRetry: retry, ms: Date.now() - t0 });
    }
    return true;
  }
}

const g = globalThis as unknown as { __maploomQueue?: Promise<JobQueue> };

/** Process-wide queue with all handlers registered. */
export function getQueue(): Promise<JobQueue> {
  if (!g.__maploomQueue) {
    g.__maploomQueue = (async () => {
      const queue = new JobQueue(await getDb(), env().APP_SECRET);
      const { registerHandlers } = await import('./handlers');
      registerHandlers(queue);
      if (env().MAPLOOM_INLINE_WORKER === '1') queue.start();
      return queue;
    })();
    g.__maploomQueue.catch(() => {
      g.__maploomQueue = undefined;
    });
  }
  return g.__maploomQueue;
}
