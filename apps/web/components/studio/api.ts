import { AppError, designSchema, type Design, type Frame, type GeocodeResult, type Geography } from '@maploom/core';
import { buildGeographyFromTiles, cachedGeocoder, createOsmGeocoder, openTileSource, type GeocodeProvider, type TileSource } from '@maploom/geo';

/** Static demo build: everything runs in the browser, there is no Maploom server. */
export const STATIC = process.env.NEXT_PUBLIC_STATIC === '1';
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
/** Prefix a public asset path with the deployment base path. */
export const asset = (path: string) => `${BASE}${path}`;

export class ApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers });
  } catch {
    throw new ApiError('OFFLINE', "We can't reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
    throw new ApiError(body?.error?.code ?? 'INTERNAL', body?.error?.message ?? 'Something went wrong. Please try again.');
  }
  return res.json() as Promise<T>;
}

const serverApi = {
  suggest: (q: string, signal?: AbortSignal) => call<{ results: GeocodeResult[] }>(`/api/geocode/suggest?q=${encodeURIComponent(q)}`, { signal }).then((r) => r.results),
  search: (q: string) => call<{ results: GeocodeResult[] }>('/api/geocode/search', { method: 'POST', body: JSON.stringify({ q }) }).then((r) => r.results),
  startGeography: (frame: Frame) => call<{ jobId: string }>('/api/geography', { method: 'POST', body: JSON.stringify({ frame }) }),
  geography: (key: string) => call<Geography>(`/api/geography/${key}`),
  buildGeography: async (frame: Frame, onProgress: (fraction: number, stage: string) => void): Promise<Geography> => {
    const { jobId } = await serverApi.startGeography(frame);
    const result = await waitForJob<{ geographyKey: string }>(jobId, (j) => onProgress(Math.max(0.05, j.progress * 0.9), j.stage ?? 'Finding your streets'));
    onProgress(0.95, 'Drawing your map');
    return serverApi.geography(result.geographyKey);
  },
  job: <R>(id: string) => call<JobView<R>>(`/api/jobs/${id}`),
  startExport: (input: { design: Design; geographyKey: string; preset: 'preview' | 'print'; format: 'png' | 'svg' }) => call<{ jobId: string }>('/api/exports', { method: 'POST', body: JSON.stringify(input) }),
  saveProject: (input: { id?: string; name: string; design: Design; location: { label: string; context: string } }) => call<{ project: ProjectSummary }>('/api/projects', { method: 'POST', body: JSON.stringify(input) }).then((r) => r.project),
  listProjects: () => call<{ projects: ProjectSummary[] }>('/api/projects').then((r) => r.projects),
  getProject: (id: string) => call<{ project: ProjectSummary & { design: Design; location: { label: string; context: string }; geographyKey: string | null } }>(`/api/projects/${id}`).then((r) => r.project),
  deleteProject: (id: string) => call<{ ok: true }>(`/api/projects/${id}`, { method: 'DELETE' }),
  deleteEverything: () => call<{ ok: true }>('/api/me', { method: 'DELETE' }),
  checkout: (input: { projectId?: string; productId: string; variantId: string; quantity: number }) => call<{ orderId: string; testMode: boolean; quote: { totalCents: number } }>('/api/checkout', { method: 'POST', body: JSON.stringify(input) }),
};


/* ---------------------------------------------------------------- static demo backend */

const plainFetch = (url: string, init?: { signal?: AbortSignal }) => fetch(url, { signal: init?.signal });
let demoGeocoder: GeocodeProvider | undefined;
let demoTiles: Promise<TileSource> | undefined;
const geocoder = () => (demoGeocoder ??= cachedGeocoder(createOsmGeocoder({ fetch: plainFetch, userAgent: 'maploom-demo' })));
const tiles = () => {
  demoTiles ??= openTileSource({ fetch: plainFetch as never, userAgent: 'maploom-demo' });
  demoTiles.catch(() => (demoTiles = undefined));
  return demoTiles;
};
const friendly = async <T,>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) throw new ApiError(err.code, err.message);
    throw new ApiError('INTERNAL', 'Something went wrong. Please try again.');
  }
};

const PROJECTS_KEY = 'maploom-projects-v1';
type StoredProject = ProjectSummary & { design: Design; location: { label: string; context: string } };
const readProjects = (): StoredProject[] => {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? '[]') as StoredProject[];
  } catch {
    return [];
  }
};
const writeProjects = (list: StoredProject[]) => localStorage.setItem(PROJECTS_KEY, JSON.stringify(list.slice(0, 30)));
const unavailable = () => Promise.reject(new ApiError('INVALID_INPUT', "That isn't available in the demo."));

const staticApi: typeof serverApi = {
  suggest: (q, signal) => friendly(() => geocoder().suggest(q, { limit: 6, signal })),
  search: (q) => friendly(() => geocoder().search(q, { limit: 5 })),
  startGeography: unavailable,
  geography: unavailable,
  buildGeography: (frame, onProgress) => friendly(async () => buildGeographyFromTiles(frame, (await tiles()).fetchTile, (await tiles()).info, { onProgress })),
  job: unavailable,
  startExport: unavailable,
  saveProject: async (input) => {
    const design = designSchema.parse(input.design);
    const list = readProjects();
    const existing = list.find((p) => p.id === input.id);
    const project: StoredProject = {
      id: existing?.id ?? `local_${Date.now().toString(36)}`,
      name: input.name.trim().slice(0, 80) || 'My map',
      styleId: design.styleId,
      productId: design.product.productId,
      variantId: design.product.variantId,
      version: (existing?.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      design,
      location: input.location,
    };
    writeProjects([project, ...list.filter((p) => p.id !== project.id)]);
    return project;
  },
  listProjects: async () => readProjects(),
  getProject: async (id) => {
    const p = readProjects().find((x) => x.id === id);
    if (!p) throw new ApiError('NOT_FOUND', "We couldn't find that.");
    return { ...p, geographyKey: null };
  },
  deleteProject: async (id) => {
    writeProjects(readProjects().filter((p) => p.id !== id));
    return { ok: true };
  },
  deleteEverything: async () => {
    localStorage.removeItem(PROJECTS_KEY);
    return { ok: true };
  },
  checkout: unavailable,
};

export const api = STATIC ? staticApi : serverApi;

export interface JobView<R> {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  progress: number;
  stage: string | null;
  result: R | null;
  error: { code: string; message: string } | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  styleId: string;
  productId: string;
  variantId: string;
  version: number;
  updatedAt: string;
}

/** Poll a background job until it settles. */
export async function waitForJob<R>(id: string, onProgress?: (j: JobView<R>) => void, signal?: AbortSignal): Promise<R> {
  let delay = 350;
  for (;;) {
    if (signal?.aborted) throw new ApiError('ABORTED', 'Cancelled');
    const job = await api.job<R>(id);
    onProgress?.(job);
    if (job.status === 'succeeded' && job.result) return job.result;
    if (job.status === 'failed') throw new ApiError(job.error?.code ?? 'INTERNAL', job.error?.message ?? 'Something went wrong. Please try again.');
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(1500, delay * 1.25);
  }
}
