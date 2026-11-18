'use client';

import { useEffect, useRef, useState } from 'react';
import { ICON_IDS, type GeocodeResult, type IconId } from '@maploom/core';
import { iconMarkup } from '@maploom/render';
import { ApiError, api } from './api';

const PAINT = { outline: '#2F3447', main: '#FF6B6B', accent: '#FFD166', light: '#FFFFFF', strokeWidth: 2.6 };

export function MapIcon({ id, size = 28 }: { id: IconId; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden dangerouslySetInnerHTML={{ __html: iconMarkup(id, PAINT) }} />;
}

export function IconPicker({ value, onChange, options = ICON_IDS as readonly IconId[] }: { value: IconId; onChange(id: IconId): void; options?: readonly IconId[] }) {
  return (
    <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Icon">
      {options.map((id) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} aria-label={id.replace('_', ' ')} onClick={() => onChange(id)} className={`flex aspect-square items-center justify-center rounded-xl border-2 bg-white transition ${value === id ? 'border-ink bg-sun/40' : 'border-transparent hover:border-line'}`}>
          <MapIcon id={id} size={26} />
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange(v: boolean): void; label: string; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-1">
      <span>
        <span className="block text-[15px] font-bold">{label}</span>
        {hint && <span className="block text-[13px] text-ink-soft">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-ink transition peer-focus-visible:outline-3 peer-focus-visible:outline-sky ${checked ? 'bg-leaf' : 'bg-white'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full border-2 border-ink bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </label>
  );
}

export function Field({ label, value, onChange, placeholder, max = 60, testId }: { label: string; value: string; onChange(v: string): void; placeholder?: string; max?: number; testId?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="field" value={value} maxLength={max} placeholder={placeholder} data-testid={testId} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Range({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange(v: number): void; format?(v: number): string }) {
  return (
    <label className="block">
      <span className="label flex justify-between">
        {label} <span className="text-ink normal-case">{format ? format(value) : value}</span>
      </span>
      <input type="range" className="h-8 w-full accent-[#ff5a5f]" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: React.ReactNode }) {
  const tones = { info: 'border-sky/50 bg-sky/10', error: 'border-coral/60 bg-coral/10', success: 'border-leaf/60 bg-leaf/10' };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border-2 px-4 py-3 text-[15px] font-semibold ${tones[tone]}`}>
      {children}
    </div>
  );
}

/** Address / place search with type-ahead. Nothing typed here is stored. */
export function PlaceSearch({ onPick, placeholder, autoFocus, testId = 'place-search' }: { onPick(r: GeocodeResult): void; placeholder: string; autoFocus?: boolean; testId?: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    setError(null);
    if (query.length < 3) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await api.suggest(query, ctrl.signal);
        if (mine === seq.current) {
          setResults(r);
          setOpen(true);
          setActive(-1);
        }
      } catch (err) {
        if (mine === seq.current && !ctrl.signal.aborted && err instanceof ApiError && err.code !== 'RATE_LIMITED') setError(err.message);
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const pick = (r: GeocodeResult) => {
    setOpen(false);
    setQ('');
    setResults([]);
    onPick(r);
  };

  const submit = async () => {
    if (active >= 0 && results[active]) return pick(results[active]);
    if (q.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.search(q.trim());
      if (r.length === 1) pick(r[0]);
      else {
        setResults(r);
        setOpen(true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="relative flex-1">
          <svg className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="field h-14 rounded-2xl border-ink pl-12 text-[17px] shadow-pop"
            value={q}
            autoFocus={autoFocus}
            placeholder={placeholder}
            data-testid={testId}
            // Addresses are personal: keep them out of browser autofill history and analytics.
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={open}
            aria-controls="place-results"
            aria-autocomplete="list"
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(results.length - 1, a + 1)));
              if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(-1, a - 1)));
              if (e.key === 'Escape') setOpen(false);
            }}
          />
        </div>
        <button className="btn-primary h-14 shrink-0 px-5" disabled={busy && !results.length} aria-label="Search">
          {busy ? '…' : 'Find'}
        </button>
      </form>
      {open && results.length > 0 && (
        <ul id="place-results" role="listbox" className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-2xl border-2 border-ink bg-white p-1.5 shadow-card" data-testid="place-results">
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === active}>
              <button type="button" onClick={() => pick(r)} className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left ${i === active ? 'bg-sun/40' : 'hover:bg-cream'}`}>
                <span className="mt-0.5 text-coral" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 48 48"><path d="M24 44S9 28 9 18a15 15 0 0 1 30 0c0 10-15 26-15 26z" fill="currentColor" /></svg>
                </span>
                <span>
                  <span className="block font-bold">{r.label}</span>
                  <span className="block text-sm text-ink-soft">{r.context}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}
