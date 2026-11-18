/**
 * Structured JSON logging with a hard rule: no addresses, coordinates or
 * design contents. Known-sensitive keys are redacted even if passed by mistake.
 */
const SENSITIVE = /^(q|query|address|label|context|lat|lon|lng|lngLat|center|home|design|input|street|postcode|email|token|secret|authorization|cookie)$/i;

function scrub(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object' || depth > 4) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? '[redacted]' : scrub(v, depth + 1);
  return out;
}

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, event: string, fields?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'test' && level !== 'error') return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...(scrub(fields ?? {}) as object) });
  (level === 'error' || level === 'warn' ? console.error : console.log)(line);
}

export const log = {
  debug: (event: string, fields?: Record<string, unknown>) => emit('debug', event, fields),
  info: (event: string, fields?: Record<string, unknown>) => emit('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit('error', event, fields),
};

export const __test = { scrub };
