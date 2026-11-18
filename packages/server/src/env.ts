import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_SECRET: z.string().min(32).optional(),
  ADMIN_TOKEN: z.string().min(16).optional(),
  MAPLOOM_DATA_DIR: z.string().default('.data'),
  DATABASE_URL: z.string().url().optional(),
  MAPLOOM_TILEJSON_URL: z.string().url().default('https://tiles.openfreemap.org/planet'),
  MAPLOOM_PHOTON_URL: z.string().url().default('https://photon.komoot.io'),
  MAPLOOM_NOMINATIM_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
  /** Directory of z-x-y.pbf tiles + manifest.json: serve map data from disk (offline demo / e2e). */
  MAPLOOM_FIXTURE_TILES: z.string().optional(),
  MAPLOOM_USER_AGENT: z.string().min(3).default('maploom-dev/0.1'),
  MAPLOOM_MAX_EXPORT_MP: z.coerce.number().min(1).max(400).default(320),
  MAPLOOM_INLINE_WORKER: z.enum(['0', '1']).default('1'),
});

export type Env = z.infer<typeof schema> & { APP_SECRET: string; dataDir: string };

let cached: Env | undefined;

/** Validated environment. Fails fast (and loudly) on misconfiguration. */
export function env(): Env {
  if (cached) return cached;
  const empty = (v: string | undefined) => (v === '' ? undefined : v);
  const raw = Object.fromEntries(Object.keys(schema.shape).map((k) => [k, empty(process.env[k])]));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration — ${problems}`);
  }
  // Anchor relative data dirs at the repo root so web, worker and scripts share one store.
  const dataDir = resolve(process.env.MAPLOOM_ROOT ?? findRoot(), parsed.data.MAPLOOM_DATA_DIR);
  mkdirSync(dataDir, { recursive: true });
  let secret = parsed.data.APP_SECRET;
  if (!secret) {
    if (parsed.data.NODE_ENV === 'production') throw new Error('APP_SECRET is required in production');
    const file = join(dataDir, 'secret');
    if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o600 });
    secret = readFileSync(file, 'utf8').trim();
  }
  cached = { ...parsed.data, APP_SECRET: secret, dataDir };
  return cached;
}

function findRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { name?: string };
      if (pkg.name === 'maploom') return dir;
    } catch {
      /* keep climbing */
    }
    dir = resolve(dir, '..');
  }
  return process.cwd();
}

export function resetEnvForTests() {
  cached = undefined;
}
