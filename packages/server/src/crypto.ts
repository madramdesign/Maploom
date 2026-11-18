import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

/** Derive independent keys per purpose from the one APP_SECRET. */
function key(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'maploom', purpose, 32));
}

/** AES-256-GCM. Output: base64url(iv | tag | ciphertext). Used for saved designs & locations. */
export function encrypt(secret: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret, 'enc'), iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

export function decrypt(secret: string, payload: string): string {
  const buf = Buffer.from(payload, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key(secret, 'enc'), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(sha256(a));
  const y = Buffer.from(sha256(b));
  return timingSafeEqual(x, y);
}

/** Signed, expiring reference to a resource (download links). */
export function sign(secret: string, resource: string, expiresAtSec: number): string {
  return createHmac('sha256', key(secret, 'sign')).update(`${resource}.${expiresAtSec}`).digest('base64url');
}

export function verifySignature(secret: string, resource: string, expiresAtSec: number, signature: string, nowSec = Date.now() / 1000): boolean {
  if (!Number.isFinite(expiresAtSec) || expiresAtSec < nowSec) return false;
  return safeEqual(sign(secret, resource, expiresAtSec), signature);
}
