/** Small deterministic hashing + PRNG helpers shared by geo and render (no crypto needed). */

export function hash32(str: string, seed = 2166136261): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hashHex(str: string): string {
  const a = hash32(str, 2166136261);
  const b = hash32(str, 0x9e3779b9);
  const c = hash32(str, 0x85ebca6b);
  return [a, b, c].map((n) => n.toString(16).padStart(8, '0')).join('');
}

/** mulberry32 — tiny, fast, deterministic PRNG. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
