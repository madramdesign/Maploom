'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { STYLES } from '@maploom/render';
import type { StyleId } from '@maploom/core';
import { api, type ProjectSummary } from '@/components/studio/api';

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.listProjects().then(setProjects).catch(() => setError("We couldn't load your maps. Please refresh."));
  useEffect(() => void load(), []);

  const remove = async (p: ProjectSummary) => {
    if (!confirm(`Delete “${p.name}” permanently? This can’t be undone.`)) return;
    await api.deleteProject(p.id).catch(() => setError("We couldn't delete that map. Please try again."));
    void load();
  };
  const wipe = async () => {
    if (!confirm('Delete ALL your saved maps, downloads and this browser’s link to them? This can’t be undone.')) return;
    await api.deleteEverything().catch(() => setError('Something went wrong. Please try again.'));
    localStorage.removeItem('maploom-studio-v1');
    void load();
  };

  if (error) return <p role="alert" className="mt-6 rounded-xl border-2 border-coral/60 bg-coral/10 px-4 py-3 font-semibold">{error}</p>;
  if (!projects) return <div className="mt-8 h-24 animate-pulse rounded-2xl bg-line/60" />;
  return (
    <div className="mt-8" data-testid="project-list">
      {projects.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-lg font-bold">Nothing saved yet</p>
          <p className="mt-1 text-ink-soft">Design a map and press Save on the last step — it will show up here.</p>
          <Link href="/create" className="btn-primary mt-5">Create your map</Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id} className="card flex items-center gap-4 p-4">
              <img src={`/styles/${p.styleId}.svg`} alt="" className="h-20 w-16 rounded-md border border-line object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg font-semibold">{p.name}</div>
                <div className="text-sm text-ink-soft">{STYLES[p.styleId as StyleId]?.name ?? p.styleId} · saved {new Date(p.updatedAt).toLocaleDateString()}</div>
                <div className="mt-2 flex gap-2">
                  <Link href={`/create?project=${p.id}`} className="btn-secondary min-h-9 px-4 text-sm" data-testid="open-project">Open</Link>
                  <button className="btn-ghost min-h-9 px-3 text-sm" onClick={() => remove(p)} data-testid="delete-project">Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-10 rounded-2xl border border-line bg-cream p-5">
        <h2 className="text-lg font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-ink-soft">Remove every saved map, every download and the anonymous cookie that links this browser to them.</p>
        <button className="btn-secondary mt-3 text-coral-dark" onClick={wipe} data-testid="delete-everything">Delete everything</button>
      </div>
    </div>
  );
}
