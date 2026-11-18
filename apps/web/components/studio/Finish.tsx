'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { findVariant, formatMoney, quote } from '@maploom/core';
import { ApiError, api, waitForJob } from './api';
import { artworkSvg } from './MapCanvas';
import { Mockup } from './Mockup';
import { StepHeading } from './steps';
import { useStudio, variantsForShape } from './store';
import { Field, Notice } from './ui';
import { useFonts } from './useFonts';

/** Object URL of the current artwork, revoked when it changes. */
function useArtworkUrl(): string | null {
  const geo = useStudio((s) => s.geo);
  const design = useStudio((s) => s.design);
  const fonts = useFonts(design.styleId);
  const svg = useMemo(() => (geo && fonts ? artworkSvg(geo, design, fonts) : null), [geo, design, fonts]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!svg) return setUrl(null);
    const u = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [svg]);
  return url;
}

export function PreviewStep() {
  const { design, shape, orientation, edit, go, geo } = useStudio();
  const url = useArtworkUrl();
  const fits = variantsForShape(shape);
  const current = findVariant(design.product.productId, design.product.variantId);
  const byProduct = [...new Set(fits.map((f) => f.product))];
  const aspect = design.frame.widthM / design.frame.heightM;
  if (!geo) return <Notice>Your map needs to be drawn first.</Notice>;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] rise">
      <div>
        {url && current ? <Mockup src={url} scene={current.product.mockup} aspect={aspect} label={`${design.title.title} as a ${current.product.name.toLowerCase()}`} /> : <div className="aspect-[4/3] animate-pulse rounded-2xl bg-line/60" />}
        <p className="mt-2 text-center text-[13px] text-ink-soft">Illustrative preview — colours and scale vary slightly by product.</p>
      </div>
      <div>
        <StepHeading title="See it in your home" sub="Pick how you’d like it made. Your design stays the same." />
        <div className="space-y-3" role="radiogroup" aria-label="Product">
          {byProduct.map((p) => {
            const variants = fits.filter((f) => f.product.id === p.id).map((f) => f.variant);
            const on = design.product.productId === p.id;
            return (
              <div key={p.id} className={`rounded-2xl border-2 bg-white p-4 transition ${on ? 'border-ink shadow-pop' : 'border-line'}`}>
                <button role="radio" aria-checked={on} data-testid={`product-${p.id}`} className="flex w-full items-start justify-between gap-3 text-left" onClick={() => edit((d) => void (d.product = { productId: p.id, variantId: variants[0].id, orientation }))}>
                  <span>
                    <span className="block font-display text-lg font-semibold">{p.name} {!p.orderable && <span className="ml-1 rounded-full bg-sun px-2 py-0.5 align-middle font-sans text-[11px] font-extrabold">Coming soon</span>}</span>
                    <span className="block text-sm text-ink-soft">{p.tagline}</span>
                  </span>
                  <span className="shrink-0 font-extrabold">{variants.length > 1 ? 'from ' : ''}{formatMoney(Math.min(...variants.map((v) => v.priceCents)))}</span>
                </button>
                {on && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {variants.map((v) => (
                      <button key={v.id} aria-pressed={design.product.variantId === v.id} className={`chip ${design.product.variantId === v.id ? 'chip-on' : ''}`} onClick={() => edit((d) => void (d.product = { productId: p.id, variantId: v.id, orientation }))}>
                        {v.label} · {formatMoney(v.priceCents)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-ink-soft">
          Looking for a different size? Sizes follow your map’s shape.{' '}
          <button className="font-bold text-ink underline" onClick={() => go('area')}>Change the shape</button> to see others — your map will be redrawn.
        </p>
      </div>
    </div>
  );
}

type Busy = { kind: string; progress: number; stage: string } | null;

export function FinishStep() {
  const s = useStudio();
  const { design, geo } = s;
  const url = useArtworkUrl();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const found = findVariant(design.product.productId, design.product.variantId);
  if (!geo || !found) return <Notice>Your map needs to be drawn first.</Notice>;
  const { product, variant } = found;
  const q = quote(product.id, variant.id);

  const run = async (kind: string, preset: 'preview' | 'print', format: 'png' | 'svg') => {
    setError(null);
    setMessage(null);
    setBusy({ kind, progress: 0.02, stage: 'Getting ready' });
    try {
      const { jobId } = await api.startExport({ design, geographyKey: geo.key, preset, format });
      const result = await waitForJob<{ downloadUrl: string; width: number; height: number; bytes: number }>(jobId, (j) => setBusy({ kind, progress: Math.max(0.02, j.progress), stage: j.stage ?? 'Drawing' }));
      const a = document.createElement('a');
      a.href = result.downloadUrl;
      a.download = '';
      a.dataset.testid = 'download-link';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage(`Your file is ready (${result.width} × ${result.height} px, ${(result.bytes / 1e6).toFixed(1)} MB). The download should start on its own.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't prepare your file. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await s.save();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't save your map. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const order = async () => {
    setError(null);
    setMessage(null);
    try {
      if (!useStudio.getState().projectId || useStudio.getState().dirty) await s.save();
      const res = await api.checkout({ projectId: useStudio.getState().projectId ?? undefined, productId: product.id, variantId: variant.id, quantity: 1 });
      setMessage(res.testMode ? `Test order ${res.orderId} recorded for ${formatMoney(res.quote.totalCents)}. Checkout isn’t live yet, so no payment was taken and nothing will be printed.` : `Order ${res.orderId} placed.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const px = { w: Math.round((design.frame.widthM >= design.frame.heightM ? variant.longIn : variant.shortIn) * variant.dpi), h: Math.round((design.frame.widthM >= design.frame.heightM ? variant.shortIn : variant.longIn) * variant.dpi) };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[300px_1fr] rise">
      <div className="mx-auto w-full max-w-[300px]">
        {url && (
          <img src={url} alt={design.title.title} className="w-full rounded-lg border-2 border-ink shadow-card" />
        )}
      </div>
      <div className="space-y-4">
        <StepHeading title="It’s ready!" sub="Save it to come back later, download it, or have it made." />
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success"><span data-testid="finish-message">{message}</span></Notice>}

        <section className="card p-5">
          <h2 className="text-xl font-semibold">Save your design</h2>
          <p className="mt-1 mb-3 text-sm text-ink-soft">No account needed. Saving stores your design (encrypted) on our servers so you can reopen it from this browser. Until you save, it only lives on this device.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1"><Field label="Name" value={s.projectName || design.title.title} max={80} testId="project-name" onChange={(v) => useStudio.setState({ projectName: v })} /></div>
            <button className="btn-primary" data-testid="save-project" disabled={saving} onClick={save}>{saving ? 'Saving…' : s.projectId ? 'Save changes' : 'Save'}</button>
          </div>
          {s.savedAt && !s.dirty && <p className="mt-2 text-sm font-bold text-leaf" data-testid="saved-state">✓ Saved. Find it any time in <Link href="/projects" className="underline">My maps</Link>.</p>}
        </section>

        <section className="card p-5">
          <h2 className="text-xl font-semibold">Download</h2>
          <p className="mt-1 mb-3 text-sm text-ink-soft">Files stay available for 24 hours. Map data © OpenStreetMap contributors — the small credit line on the artwork needs to stay.</p>
          {busy ? (
            <div data-testid="export-progress">
              <div className="mb-1 flex justify-between text-sm font-bold"><span>{busy.stage}</span><span>{Math.round(busy.progress * 100)}%</span></div>
              <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-white"><div className="h-full bg-coral transition-all" style={{ width: `${busy.progress * 100}%` }} /></div>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              <button className="btn-secondary h-auto flex-col py-2.5" data-testid="download-preview" onClick={() => run('preview', 'preview', 'png')}><span>Preview image</span><span className="text-[12px] font-semibold text-ink-soft">PNG · for sharing</span></button>
              <button className="btn-secondary h-auto flex-col py-2.5" data-testid="download-print" onClick={() => run('print', 'print', 'png')}><span>Print-ready file</span><span className="text-[12px] font-semibold text-ink-soft">PNG · {px.w} × {px.h} px · {variant.dpi} DPI</span></button>
              <button className="btn-secondary h-auto flex-col py-2.5" data-testid="download-svg" onClick={() => run('svg', 'print', 'svg')}><span>Vector file</span><span className="text-[12px] font-semibold text-ink-soft">SVG · any size</span></button>
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{product.name} · {variant.label}</h2>
              <p className="text-sm text-ink-soft">{variant.material}</p>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-semibold">{formatMoney(q.totalCents)}</div>
              <div className="text-[12px] text-ink-soft">{q.shippingCents ? `incl. ${formatMoney(q.shippingCents)} shipping` : 'free shipping'}</div>
            </div>
          </div>
          {product.orderable ? (
            <>
              <button className="btn-primary mt-4 w-full" data-testid="order" onClick={order}>Place a test order</button>
              <p className="mt-2 text-[13px] text-ink-soft">Checkout and printing aren’t switched on in this preview build. This records a test order only — you won’t be charged.</p>
            </>
          ) : (
            <p className="mt-3 rounded-xl bg-sun/40 px-3 py-2 text-sm font-semibold">Play mats are coming soon — we’re sampling suppliers. Download the print-ready file in the meantime.</p>
          )}
          <button className="btn-ghost mt-1 w-full text-sm" onClick={() => s.go('preview')}>Choose a different product</button>
        </section>
      </div>
    </div>
  );
}
