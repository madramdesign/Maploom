import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, toAppError } from '@maploom/core';
import { env, log, newToken, rateLimit, safeEqual, sha256, sign, verifySignature, LIMITS } from '@maploom/server';

const GUEST_COOKIE = 'ml_guest';
const ADMIN_COOKIE = 'ml_admin';

/** Wrap a route handler: uniform JSON errors, no stack traces, privacy-safe logs. */
export function route<A extends unknown[]>(name: string, fn: (req: Request, ...args: A) => Promise<Response>) {
  return async (req: Request, ...args: A): Promise<Response> => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') await assertSameOrigin(req);
      return await fn(req, ...args);
    } catch (raw) {
      const err = raw instanceof ZodError ? new AppError('INVALID_INPUT', raw.issues.map((i) => i.path.join('.')).join(',')) : toAppError(raw);
      if (err.status >= 500) log.error('http.error', { route: name, code: err.code, detail: err.detail });
      else log.info('http.rejected', { route: name, code: err.code });
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
  };
}

/** CSRF defence for cookie-authenticated mutations: the Origin must be our own. */
async function assertSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) {
    // Non-browser clients send no Origin; browsers always do on cross-site POSTs.
    if (req.headers.get('sec-fetch-site') && req.headers.get('sec-fetch-site') !== 'same-origin') throw new AppError('UNAUTHORIZED', 'cross-site');
    return;
  }
  const host = (await headers()).get('x-forwarded-host') ?? req.headers.get('host');
  if (new URL(origin).host !== host) throw new AppError('UNAUTHORIZED', 'bad origin');
}

/** Anonymous guest identity: a random token in an httpOnly cookie; only its hash is stored. */
export async function guest(create = false): Promise<string | null> {
  const jar = await cookies();
  let token = jar.get(GUEST_COOKIE)?.value;
  if (!token || token.length < 20) {
    if (!create) return null;
    token = newToken(32);
    jar.set(GUEST_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  return sha256(token);
}

export async function requireGuest(): Promise<string> {
  const g = await guest(false);
  if (!g) throw new AppError('NOT_FOUND');
  return g;
}

export async function clearGuest() {
  (await cookies()).delete(GUEST_COOKIE);
}

export async function limit(kind: keyof typeof LIMITS, req: Request) {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
  const who = (await guest(false)) ?? '';
  rateLimit(`${kind}:${sha256(ip + who).slice(0, 16)}`, LIMITS[kind]);
  void req;
}

/* ------------------------------------------------------------- admin auth */

export async function adminLogin(token: string): Promise<boolean> {
  const expected = env().ADMIN_TOKEN;
  if (!expected || !safeEqual(token, expected)) return false;
  const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
  (await cookies()).set(ADMIN_COOKIE, `${exp}.${sign(env().APP_SECRET, 'admin', exp)}`, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 8 * 3600 });
  return true;
}

export async function isAdmin(): Promise<boolean> {
  if (!env().ADMIN_TOKEN) return false;
  const raw = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!raw) return false;
  const [exp, sig] = raw.split('.');
  return verifySignature(env().APP_SECRET, 'admin', Number(exp), sig ?? '');
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new AppError('UNAUTHORIZED');
}

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export function downloadUrl(exportId: string, ttlSec = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  return `/api/exports/${exportId}/download?exp=${exp}&sig=${sign(env().APP_SECRET, `export:${exportId}`, exp)}`;
}

export function verifyDownload(exportId: string, exp: string | null, sig: string | null): boolean {
  return verifySignature(env().APP_SECRET, `export:${exportId}`, Number(exp), sig ?? '');
}
