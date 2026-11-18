'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { CATEGORY_GROUPS, PERSONAL_PLACE_PRESETS, clampText, type IconId } from '@maploom/core';
import { COVERAGE_PRESETS, DEMO_LOCATIONS, METERS_PER_MILE } from '@maploom/geo';
import { STYLES } from '@maploom/render';
import { STATIC, asset } from './api';
import { SHAPES, STYLE_ORDER, useStudio } from './store';
import { Field, IconPicker, MapIcon, Notice, PlaceSearch, Toggle } from './ui';

const AreaPicker = dynamic(() => import('./AreaPicker').then((m) => m.AreaPicker), { ssr: false, loading: () => <div className="h-full min-h-[280px] animate-pulse rounded-2xl bg-line/60" /> });

export function StepHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-[28px] leading-tight font-semibold sm:text-4xl">{title}</h1>
      {sub && <p className="mt-2 text-[17px] text-ink-soft">{sub}</p>}
    </div>
  );
}

export function LocationStep() {
  const setLocation = useStudio((s) => s.setLocation);
  const go = useStudio((s) => s.go);
  const location = useStudio((s) => s.location);
  const choose = (label: string, context: string, lngLat: { lat: number; lon: number }) => {
    setLocation({ label, context, lngLat });
    go('area');
  };
  return (
    <div className="mx-auto max-w-2xl rise">
      <StepHeading title="Where should we center your map?" sub="A home address, a town, a school, grandma’s street — any place that matters to you." />
      <PlaceSearch autoFocus placeholder="Try “123 Main Street, Clifton, NJ”" onPick={(r) => choose(r.label, r.context, r.lngLat)} />
      {location && (
        <button className="btn-secondary mt-4" onClick={() => go('area')}>
          Continue with {location.label} →
        </button>
      )}
      <div className="mt-8">
        <div className="label">Or explore a sample neighborhood</div>
        <div className="flex flex-wrap gap-2">
          {DEMO_LOCATIONS.map((d) => (
            <button key={d.id} className="chip" data-testid={`demo-${d.id}`} onClick={() => choose(d.label, d.context, d.lngLat)}>
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-8 flex items-start gap-2 text-sm text-ink-soft">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        {STATIC ? 'Demo: your search goes directly from your browser to public OpenStreetMap search services. Nothing is stored by Maploom — or pick a sample below instead.' : 'We only use your address to find the spot on the map. It isn’t stored on our servers unless you choose to save your design.'}
      </p>
    </div>
  );
}

export function AreaStep() {
  const { location, center, design, shortEdgeM, shape, orientation, setArea } = useStudio();
  if (!location || !center) return null;
  const miles = shortEdgeM / METERS_PER_MILE;
  const homeOutside = (() => {
    const dLat = Math.abs(location.lngLat.lat - center.lat) * 111_320;
    const dLon = Math.abs(location.lngLat.lon - center.lon) * 111_320 * Math.cos((center.lat * Math.PI) / 180);
    return dLon > design.frame.widthM / 2 || dLat > design.frame.heightM / 2;
  })();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] rise">
      <div className="order-2 h-[52vh] min-h-[300px] lg:order-1 lg:h-[calc(100vh-230px)]">
        <AreaPicker home={location.lngLat} center={center} widthM={design.frame.widthM} heightM={design.frame.heightM} onChange={(c, widthM) => setArea({ center: c, shortEdgeM: Math.max(400, Math.min(20000, Math.round(Math.min(widthM, widthM * (design.frame.heightM / design.frame.widthM))))) })} />
      </div>
      <div className="order-1 lg:order-2">
        <StepHeading title="How much should it show?" sub="Drag the map to move the area. Pinch or scroll to show more or less." />
        <div className="label">Coverage</div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Coverage">
          {COVERAGE_PRESETS.map((p) => {
            const on = Math.abs(p.shortEdgeM - shortEdgeM) < 30;
            return (
              <button key={p.id} role="radio" aria-checked={on} data-testid={`coverage-${p.id}`} onClick={() => setArea({ shortEdgeM: p.shortEdgeM })} className={`rounded-xl border-2 px-3 py-2 text-left transition ${on ? 'border-ink bg-sun/40' : 'border-line bg-white hover:border-ink/40'}`}>
                <span className="block text-[15px] font-extrabold">{p.label}</span>
                <span className="block text-[13px] text-ink-soft">{p.hint}</span>
              </button>
            );
          })}
          <div className="flex items-center rounded-xl border-2 border-dashed border-line px-3 py-2 text-[13px] font-bold text-ink-soft">
            Now: {miles < 0.95 ? `${Math.round(shortEdgeM / 10) * 10} m` : `${miles.toFixed(1)} mi`} across
          </div>
        </div>
        <div className="label mt-5">Shape</div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Shape">
          {SHAPES.map((s) => (
            <button key={s.id} role="radio" aria-checked={shape === s.id} onClick={() => setArea({ shape: s.id })} className={`chip h-auto flex-col items-start !rounded-xl py-1.5 ${shape === s.id ? 'chip-on' : ''}`}>
              <span>{s.label}</span>
              <span className={`text-[11px] font-semibold ${shape === s.id ? 'text-white/75' : 'text-ink-soft'}`}>{s.hint}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Orientation">
          {(['portrait', 'landscape'] as const).map((o) => (
            <button key={o} role="radio" aria-checked={orientation === o} data-testid={`orient-${o}`} onClick={() => setArea({ orientation: o })} className={`chip capitalize ${orientation === o ? 'chip-on' : ''}`}>
              <span className={`inline-block border-2 border-current ${o === 'portrait' ? 'h-4 w-3' : 'h-3 w-4'} rounded-[3px]`} /> {o}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {homeOutside && <Notice tone="error">Your place is outside the dashed area, so it won’t appear on the map. Drag the map to bring the pin back in.</Notice>}
          <button className="btn-ghost -ml-3 text-sm" onClick={() => setArea({ center: location.lngLat })}>
            ↺ Re-centre on {location.label}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlacesStep() {
  const design = useStudio((s) => s.design);
  const edit = useStudio((s) => s.edit);
  const addCustomPlace = useStudio((s) => s.addCustomPlace);
  const custom = design.landmarks.filter((l) => l.source === 'custom');
  const amounts = [
    { n: 7, label: 'Just a few' },
    { n: 12, label: 'A nice mix' },
    { n: 18, label: 'Lots!' },
  ];
  return (
    <div className="mx-auto max-w-3xl rise">
      <StepHeading title="What places matter to you?" sub="We’ll find the best real landmarks nearby. Pick what you’d like to see — you can fine-tune every one later." />
      <div className="grid gap-2 sm:grid-cols-2">
        {CATEGORY_GROUPS.map((g) => {
          const on = design.preferences[g.id] !== false;
          return (
            <button key={g.id} role="switch" aria-checked={on} data-testid={`pref-${g.id}`} onClick={() => edit((d) => void (d.preferences[g.id] = !on))} className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${on ? 'border-ink bg-white shadow-pop' : 'border-line bg-white/50 opacity-70'}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-ink ${on ? 'bg-leaf text-white' : 'bg-white'}`} aria-hidden>
                {on && '✓'}
              </span>
              <span>
                <span className="block font-extrabold">{g.label}</span>
                <span className="block text-sm text-ink-soft">{g.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="label mt-7">How many landmarks?</div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How many landmarks">
        {amounts.map((a) => (
          <button key={a.n} role="radio" aria-checked={design.landmarkTarget === a.n} className={`chip ${design.landmarkTarget === a.n ? 'chip-on' : ''}`} onClick={() => edit((d) => void (d.landmarkTarget = a.n))}>
            {a.label}
          </button>
        ))}
      </div>
      <div className="mt-8 card p-5">
        <h2 className="text-xl font-semibold">Add your own special places</h2>
        <p className="mt-1 mb-4 text-sm text-ink-soft">Grandma’s house, a best friend’s, your favourite pizza place. Search for it here, or tap the map later to drop it exactly where you like.</p>
        <PlaceSearch testId="custom-place-search" placeholder="Search for a special place" onPick={(r) => addCustomPlace(r.lngLat, clampText(r.label, 60), 'heart')} />
        {custom.length > 0 && (
          <ul className="mt-4 space-y-2">
            {custom.map((l) => (
              <li key={l.id} className="flex items-center gap-2 rounded-xl border border-line bg-cream p-2">
                <MapIcon id={l.icon} />
                <input aria-label="Place name" className="field min-h-10 flex-1 border-transparent bg-transparent px-2" value={l.label} maxLength={60} onChange={(e) => edit((d) => void (d.landmarks.find((x) => x.id === l.id)!.label = e.target.value))} />
                <button className="btn-ghost min-h-10 px-3" aria-label={`Remove ${l.label}`} onClick={() => edit((d) => void (d.landmarks = d.landmarks.filter((x) => x.id !== l.id)))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-1.5 text-[13px] text-ink-soft">
          Ideas:
          {PERSONAL_PLACE_PRESETS.slice(0, 5).map((p) => (
            <span key={p.label} className="rounded-full bg-cream px-2 py-0.5 font-semibold">{p.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const HOME_ICONS: IconId[] = ['house', 'heart', 'star', 'pin', 'flag', 'castle', 'tree'];

export function PersonalizeStep() {
  const { design, forName, edit, setForName } = useStudio();
  const setTitle = (patch: Partial<typeof design.title>) => {
    useStudio.setState({ titleTouched: true });
    edit((d) => void Object.assign(d.title, patch));
  };
  return (
    <div className="mx-auto max-w-2xl rise">
      <StepHeading title="Who is this map for?" sub="Add a name and a few words. Everything here is optional and easy to change later." />
      <div className="space-y-4">
        <Field label="A name" value={forName} max={30} placeholder="Emma, The Mekita Family…" testId="for-name" onChange={setForName} />
        <Field label="Title on the map" value={design.title.title} max={60} placeholder="Emma’s Neighborhood" testId="title-input" onChange={(v) => setTitle({ title: v })} />
        <Field label="Subtitle" value={design.title.subtitle} max={80} placeholder="Clifton, New Jersey" onChange={(v) => setTitle({ subtitle: v })} />
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field label="Dedication" value={design.title.dedication} max={140} placeholder="With love from Grandma & Grandpa" onChange={(v) => setTitle({ dedication: v })} />
          <Field label="Date" value={design.title.date} max={40} placeholder="Est. 2026" onChange={(v) => setTitle({ date: v })} />
        </div>
        <div className="card p-5">
          <h2 className="text-xl font-semibold">The centre of it all</h2>
          <p className="mt-1 mb-4 text-sm text-ink-soft">How should we mark the place you entered?</p>
          <Field label="Label" value={design.home.label} max={40} placeholder="Home, Grandma & Grandpa…" testId="home-label" onChange={(v) => edit((d) => void (d.home.label = v))} />
          <div className="label mt-4">Marker</div>
          <IconPicker value={design.home.icon} options={HOME_ICONS} onChange={(icon) => edit((d) => void (d.home.icon = icon))} />
          <div className="mt-3">
            <Toggle label="Show this marker" hint="Turn off if you’d rather not mark the exact spot." checked={design.home.visible} onChange={(v) => edit((d) => void (d.home.visible = v))} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function StyleStep() {
  const styleId = useStudio((s) => s.design.styleId);
  const edit = useStudio((s) => s.edit);
  return (
    <div className="mx-auto max-w-4xl rise">
      <StepHeading title="Choose a style" sub="Don’t worry about getting it perfect — you can switch styles any time, even after editing." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3" role="radiogroup" aria-label="Map style">
        {STYLE_ORDER.map((id) => {
          const s = STYLES[id];
          const on = styleId === id;
          return (
            <button key={id} role="radio" aria-checked={on} data-testid={`style-${id}`} onClick={() => edit((d) => void (d.styleId = id))} className={`overflow-hidden rounded-2xl border-2 bg-white text-left transition ${on ? 'border-ink shadow-pop' : 'border-line hover:border-ink/40'}`}>
              <img src={asset(`/styles/${id}.svg`)} alt="" loading="lazy" className="block aspect-[4/5] w-full object-cover" />
              <span className="flex items-start justify-between gap-2 px-3 py-2.5 sm:px-4">
                <span>
                  <span className="block font-display text-lg leading-tight font-semibold">{s.name}</span>
                  <span className="block text-[13px] text-ink-soft">{s.tagline}</span>
                </span>
                {on && <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf text-sm font-black text-white">✓</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GenerateStep() {
  const status = useStudio((s) => s.geoStatus);
  const generate = useStudio((s) => s.generate);
  const go = useStudio((s) => s.go);
  const title = useStudio((s) => s.design.title.title);
  useEffect(() => {
    void generate();
  }, [generate]);
  useEffect(() => {
    if (status.state !== 'ready') return;
    const t = setTimeout(() => go('edit'), 500);
    return () => clearTimeout(t);
  }, [status.state, go]);
  const pct = status.state === 'loading' ? Math.round(status.progress * 100) : status.state === 'ready' ? 100 : 0;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center rise" data-testid="generate-step">
      <svg width="220" height="150" viewBox="0 0 220 150" aria-hidden className="mb-6">
        <rect x="6" y="6" width="208" height="138" rx="18" fill="#DDEFB4" stroke="#2F3447" strokeWidth="4" />
        <path d="M6 100c40-30 60 20 100-10s60-40 108-20" fill="none" stroke="#59607A" strokeWidth="16" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - pct / 100} style={{ transition: 'stroke-dashoffset .6s ease' }} />
        <path d="M70 6c-10 50 30 80 20 138" fill="none" stroke="#59607A" strokeWidth="12" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - Math.max(0, pct - 30) / 70} style={{ transition: 'stroke-dashoffset .6s ease' }} />
        <circle cx="150" cy="50" r="16" fill="#9AD576" stroke="#2F3447" strokeWidth="3" opacity={pct > 60 ? 1 : 0.15} />
        <path d="M110 86s-12-12-12-21a12 12 0 0 1 24 0c0 9-12 21-12 21z" fill="#FF5A5F" stroke="#2F3447" strokeWidth="3" />
      </svg>
      {status.state === 'error' ? (
        <>
          <h1 className="text-3xl font-semibold">We hit a bump in the road</h1>
          <div className="mt-4 w-full"><Notice tone="error">{status.message}</Notice></div>
          <div className="mt-6 flex gap-3">
            <button className="btn-secondary" onClick={() => go('area')}>Change the area</button>
            <button className="btn-primary" data-testid="retry-generate" onClick={() => void generate(true)}>Try again</button>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-semibold">Drawing {title || 'your map'}…</h1>
          <p className="mt-2 min-h-6 text-ink-soft" aria-live="polite">{status.state === 'loading' ? status.stage : status.state === 'ready' ? 'All done!' : 'Getting ready'}</p>
          <div className="mt-6 h-4 w-full overflow-hidden rounded-full border-2 border-ink bg-white" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-coral transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-3 text-sm text-ink-soft">Real streets, parks and water from OpenStreetMap — this usually takes a few seconds.</p>
        </>
      )}
    </div>
  );
}
