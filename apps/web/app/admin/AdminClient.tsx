'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdminLogin() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState(false);
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-3xl font-semibold">Admin sign-in</h1>
      <form
        className="mt-5 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
          if (res.ok) router.refresh();
          else setError(true);
        }}
      >
        <input type="password" className="field" placeholder="Admin token" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="current-password" aria-label="Admin token" />
        {error && <p role="alert" className="text-sm font-bold text-coral-dark">That token isn’t right.</p>}
        <button className="btn-primary w-full">Sign in</button>
      </form>
    </main>
  );
}

export function AdminAction({ label, body, logout, confirm: ask }: { label: string; body?: Record<string, unknown>; logout?: boolean; confirm?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-secondary min-h-8 px-3 text-xs"
      disabled={busy}
      onClick={async () => {
        if (ask && !window.confirm(ask)) return;
        setBusy(true);
        const res = logout ? await fetch('/api/admin/login', { method: 'DELETE' }) : await fetch('/api/admin/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        setBusy(false);
        if (!res.ok) alert('That action failed.');
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
