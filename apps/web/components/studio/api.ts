import type { Design, Frame, GeocodeResult, Geography } from '@maploom/core';

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

export const api = {
  suggest: (q: string, signal?: AbortSignal) => call<{ results: GeocodeResult[] }>(`/api/geocode/suggest?q=${encodeURIComponent(q)}`, { signal }).then((r) => r.results),
  search: (q: string) => call<{ results: GeocodeResult[] }>('/api/geocode/search', { method: 'POST', body: JSON.stringify({ q }) }).then((r) => r.results),
  startGeography: (frame: Frame) => call<{ jobId: string }>('/api/geography', { method: 'POST', body: JSON.stringify({ frame }) }),
  geography: (key: string) => call<Geography>(`/api/geography/${key}`),
  job: <R>(id: string) => call<JobView<R>>(`/api/jobs/${id}`),
  startExport: (input: { design: Design; geographyKey: string; preset: 'preview' | 'print'; format: 'png' | 'svg' }) => call<{ jobId: string }>('/api/exports', { method: 'POST', body: JSON.stringify(input) }),
  saveProject: (input: { id?: string; name: string; design: Design; location: { label: string; context: string } }) => call<{ project: ProjectSummary }>('/api/projects', { method: 'POST', body: JSON.stringify(input) }).then((r) => r.project),
  listProjects: () => call<{ projects: ProjectSummary[] }>('/api/projects').then((r) => r.projects),
  getProject: (id: string) => call<{ project: ProjectSummary & { design: Design; location: { label: string; context: string }; geographyKey: string | null } }>(`/api/projects/${id}`).then((r) => r.project),
  deleteProject: (id: string) => call<{ ok: true }>(`/api/projects/${id}`, { method: 'DELETE' }),
  deleteEverything: () => call<{ ok: true }>('/api/me', { method: 'DELETE' }),
  checkout: (input: { projectId?: string; productId: string; variantId: string; quantity: number }) => call<{ orderId: string; testMode: boolean; quote: { totalCents: number } }>('/api/checkout', { method: 'POST', body: JSON.stringify(input) }),
};

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
