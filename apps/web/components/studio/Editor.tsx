'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CATEGORY_META, type Design, type IconId, type Landmark } from '@maploom/core';
import { STYLES, artSize } from '@maploom/render';
import { MapCanvas } from './MapCanvas';
import { STYLE_ORDER, useStudio } from './store';
import { Field, IconPicker, MapIcon, Notice, Range, Toggle } from './ui';
import { useFonts } from './useFonts';

type Tab = 'places' | 'text' | 'look' | 'home';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'places', label: 'Places', icon: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.800-7 11-7 11zm0-8.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z' },
  { id: 'text', label: 'Text', icon: 'M5 6h14M12 6v13M9 19h6' },
  { id: 'look', label: 'Look', icon: 'M12 3a9 9 0 1 0 0 18c1.500 0 2-1 2-2s-.5-1.500.5-2.500S18 16 19 15a6.500 6.500 0 0 0 2-4.500C21 6 17 3 12 3zM7.500 11h.01M10.500 7h.01M15 7.500h.01' },
  { id: 'home', label: 'Home', icon: 'M4 11 12 4l8 7v9H4zM10 20v-6h4v6' },
];

/** Size an aspect-ratio box to fit inside its parent. */
function useFit(aspect: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const fw = Math.min(w, h * aspect);
      setBox({ w: Math.floor(fw), h: Math.floor(fw / aspect) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);
  return { ref, box };
}

function ToolButton({ label, active, disabled, onClick, children, testId }: { label: string; active?: boolean; disabled?: boolean; onClick(): void; children: React.ReactNode; testId?: string }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={active} disabled={disabled} data-testid={testId} onClick={onClick} className={`flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border-2 px-2.5 text-sm font-extrabold transition disabled:opacity-35 ${active ? 'border-ink bg-ink text-white' : 'border-ink bg-white text-ink hover:bg-cream'}`}>
      {children}
    </button>
  );
}

const Svg = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export function Editor() {
  const s = useStudio();
  const { geo, design, selection, tool } = s;
  const fonts = useFonts(design.styleId);
  const [tab, setTab] = useState<Tab>('places');
  const [sheet, setSheet] = useState(false);
  const [zoom, setZoom] = useState(1);
  const size = geo ? artSize(geo.frame) : { width: 3, height: 4, scale: 1 };
  const { ref, box } = useFit(size.width / size.height);
  const dragBase = useRef<{ dx: number; dy: number; x: number; y: number } | null>(null);

  // Opening the inspector on selection is the mobile "edit this" gesture.
  useEffect(() => {
    if (selection) setSheet(true);
  }, [selection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') (e.preventDefault(), e.shiftKey ? s.redo() : s.undo());
      if (e.key === 'Escape') (s.select(null), s.setTool('select'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s]);

  if (!geo) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <Notice>Your map needs to be drawn first.</Notice>
        <button className="btn-primary mt-4" onClick={() => s.go('generate')}>Draw my map</button>
      </div>
    );
  }

  const panel = selection ? <Inspector id={selection} /> : tab === 'places' ? <PlacesPanel /> : tab === 'text' ? <TextPanel /> : tab === 'look' ? <LookPanel /> : <HomePanel />;

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row lg:gap-5" data-testid="editor">
      {/* Panel: side column on desktop, bottom sheet on mobile */}
      <aside className={`z-20 flex flex-col border-ink bg-white lg:static lg:order-1 lg:h-full lg:w-[350px] lg:shrink-0 lg:rounded-2xl lg:border-2 ${sheet ? 'fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] max-h-[54vh] rounded-t-3xl border-t-2 shadow-[0_-12px_30px_-12px_rgba(47,52,71,.35)]' : 'hidden lg:flex'}`} aria-label="Editing tools">
        <div className="flex items-center justify-between px-4 pt-3 lg:hidden">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
          <button className="absolute right-3 btn-ghost min-h-9 px-3 text-sm" onClick={() => (setSheet(false), s.select(null))}>Done</button>
        </div>
        {!selection && (
          <div className="hidden gap-1 border-b border-line p-2 lg:flex" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`flex-1 rounded-xl px-2 py-2 text-sm font-extrabold ${tab === t.id ? 'bg-ink text-white' : 'text-ink-soft hover:bg-cream'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{panel}</div>
      </aside>

      {/* Canvas */}
      <section className="flex min-h-0 flex-1 flex-col lg:order-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <ToolButton label="Undo" testId="undo" disabled={!s.past.length} onClick={s.undo}><Svg d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></ToolButton>
            <ToolButton label="Redo" testId="redo" disabled={!s.future.length} onClick={s.redo}><Svg d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" /></ToolButton>
          </div>
          <div className="flex gap-1.5">
            <ToolButton label="Select and move" active={tool === 'select'} onClick={() => s.setTool('select')}><Svg d="m5 3 14 8-6 2-2 6z" /></ToolButton>
            <ToolButton label="Add a place" testId="tool-place" active={tool === 'place'} onClick={() => s.setTool(tool === 'place' ? 'select' : 'place')}>
              <Svg d="M12 21s-7-6.200-7-11a7 7 0 0 1 14 0c0 4.800-7 11-7 11zM12 7v6M9 10h6" /> <span className="hidden sm:inline">Add place</span>
            </ToolButton>
            <ToolButton label="Remove roads and buildings" testId="tool-erase" active={tool === 'erase'} onClick={() => s.setTool(tool === 'erase' ? 'select' : 'erase')}>
              <Svg d="m7 21-4-4L14 6l7 7-8 8zM10 10l7 7M7 21h14" /> <span className="hidden sm:inline">Remove</span>
            </ToolButton>
          </div>
          <div className="flex gap-1.5">
            <ToolButton label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z / 1.5))}><Svg d="M5 12h14" /></ToolButton>
            <ToolButton label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3.375, z * 1.5))}><Svg d="M12 5v14M5 12h14" /></ToolButton>
          </div>
        </div>
        {tool !== 'select' && (
          <div className="mb-2"><Notice>{tool === 'place' ? 'Tap the map where your special place is.' : 'Tap any road, building or park to remove it. Undo brings it back.'}</Notice></div>
        )}
        <div ref={ref} className={`flex min-h-0 flex-1 items-start justify-center rounded-2xl bg-ink/5 p-0 ${zoom > 1 ? 'overflow-auto' : 'overflow-hidden'} ${sheet ? 'max-lg:mb-[46vh]' : ''}`} style={{ minHeight: 260 }}>
          {fonts && box.w > 0 ? (
            <div className="shrink-0 overflow-hidden rounded-lg shadow-[0_10px_30px_-12px_rgba(47,52,71,.5)]" style={{ width: box.w * zoom, height: box.h * zoom, touchAction: zoom > 1 ? 'pan-x pan-y' : 'none' }}>
              <MapCanvas
                geo={geo}
                design={design}
                fonts={fonts}
                handlers={{
                  selection,
                  tool,
                  onSelect: s.select,
                  onErase: (id) => s.edit((d) => void d.hidden.push(id)),
                  onPlace: (lngLat) => s.addCustomPlace(lngLat),
                  onDragStart: (id) => {
                    s.beginGesture();
                    const d = useStudio.getState().design;
                    const lm = d.landmarks.find((l) => l.id === id);
                    const tx = d.texts.find((t) => t.id === id);
                    dragBase.current = { dx: id === 'home' ? d.home.dx : (lm?.dx ?? 0), dy: id === 'home' ? d.home.dy : (lm?.dy ?? 0), x: tx?.x ?? 0, y: tx?.y ?? 0 };
                  },
                  onDrag: (id, kind, ax, ay) => {
                    const b = dragBase.current;
                    if (!b) return;
                    s.nudge((d) => {
                      if (kind === 'text') {
                        const t = d.texts.find((x) => x.id === id);
                        if (t) (t.x = Math.max(0, Math.min(1, b.x + ax / size.width)), (t.y = Math.max(0, Math.min(1, b.y + ay / size.height))));
                        return;
                      }
                      const target = kind === 'home' ? d.home : d.landmarks.find((x) => x.id === id);
                      if (target) (target.dx = Math.round(b.dx + ax / size.scale), (target.dy = Math.round(b.dy + ay / size.scale)));
                    });
                  },
                }}
              />
            </div>
          ) : (
            <div className="m-auto text-sm font-bold text-ink-soft">Loading your map…</div>
          )}
        </div>
      </section>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t-2 border-ink bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Editing sections">
        {TABS.map((t) => (
          <button key={t.id} data-testid={`mtab-${t.id}`} aria-pressed={sheet && tab === t.id && !selection} onClick={() => (s.select(null), setTab(t.id), setSheet(!(sheet && tab === t.id && !selection)))} className={`flex h-[60px] flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-extrabold ${sheet && tab === t.id && !selection ? 'text-coral' : 'text-ink-soft'}`}>
            <Svg d={t.icon} />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ panels */

function PanelTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-xl font-semibold">{children}</h2>
      {sub && <p className="text-sm text-ink-soft">{sub}</p>}
    </div>
  );
}

function PlacesPanel() {
  const { design, edit, select, setTool, refreshLandmarks } = useStudio();
  const [more, setMore] = useState(false);
  const shown = design.landmarks.filter((l) => l.visible);
  const hidden = design.landmarks.filter((l) => !l.visible);
  const row = (l: Landmark) => (
    <li key={l.id} className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-cream">
      <button className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => l.visible && select(l.id)} aria-label={`Edit ${l.label}`}>
        <MapIcon id={l.icon} size={26} />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold">{l.label || 'Unnamed place'}</span>
          <span className="block text-[12px] text-ink-soft">{l.source === 'custom' ? 'Your place' : CATEGORY_META[l.category].label}</span>
        </span>
      </button>
      <input type="checkbox" className="h-6 w-6 shrink-0 accent-[#4caf6a]" checked={l.visible} aria-label={`Show ${l.label}`} onChange={(e) => edit((d) => void (d.landmarks.find((x) => x.id === l.id)!.visible = e.target.checked))} />
    </li>
  );
  return (
    <div>
      <PanelTitle sub="Tap a place on the map to rename, restyle or move it.">Places on your map</PanelTitle>
      <button className="btn-secondary mb-3 w-full" onClick={() => setTool('place')} data-testid="add-place">+ Add your own place</button>
      <ul>{shown.map(row)}</ul>
      {shown.length === 0 && <p className="py-3 text-sm text-ink-soft">No places shown yet. Switch some on below.</p>}
      {hidden.length > 0 && (
        <>
          <button className="btn-ghost mt-2 w-full justify-between text-sm" aria-expanded={more} onClick={() => setMore(!more)}>
            {more ? 'Hide' : 'Show'} {hidden.length} more nearby places <span>{more ? '▴' : '▾'}</span>
          </button>
          {more && <ul>{hidden.slice(0, 60).map(row)}</ul>}
        </>
      )}
      <button className="btn-ghost mt-2 w-full text-sm" onClick={refreshLandmarks}>↻ Re-pick the best places for me</button>
    </div>
  );
}

function TitleFields() {
  const { design, edit } = useStudio();
  const set = (patch: Partial<Design['title']>) => {
    useStudio.setState({ titleTouched: true });
    edit((d) => void Object.assign(d.title, patch));
  };
  return (
    <div className="space-y-3">
      <Toggle label="Show the title" checked={design.title.show} onChange={(v) => set({ show: v })} />
      <Field label="Title" value={design.title.title} testId="editor-title" onChange={(v) => set({ title: v })} />
      <Field label="Subtitle" value={design.title.subtitle} max={80} onChange={(v) => set({ subtitle: v })} />
      <Field label="Dedication" value={design.title.dedication} max={140} onChange={(v) => set({ dedication: v })} />
      <Field label="Date" value={design.title.date} max={40} onChange={(v) => set({ date: v })} />
      <div>
        <div className="label">Position</div>
        <div className="flex gap-2">
          {(['top', 'bottom'] as const).map((p) => (
            <button key={p} className={`chip capitalize ${design.title.position === p ? 'chip-on' : ''}`} onClick={() => set({ position: p })}>{p}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TextPanel() {
  const { edit, select } = useStudio();
  const add = () => {
    const id = `text-${Date.now().toString(36)}`;
    edit((d) => void d.texts.push({ id, text: 'Your words here', x: 0.5, y: 0.82, scale: 1, font: 'display' }));
    select(id);
  };
  return (
    <div>
      <PanelTitle>Words on your map</PanelTitle>
      <TitleFields />
      <button className="btn-secondary mt-5 w-full" onClick={add} data-testid="add-text">+ Add a line of text</button>
    </div>
  );
}

function LookPanel() {
  const { design, edit } = useStudio();
  const L = design.layers;
  const toggles: [keyof Design['layers'], string][] = [
    ['roadLabels', 'Street names'],
    ['landmarkLabels', 'Place names'],
    ['buildings', 'Buildings'],
    ['parks', 'Parks & green space'],
    ['water', 'Water'],
    ['minorRoads', 'Small streets'],
    ['paths', 'Footpaths & trails'],
    ['rail', 'Railways'],
    ['decorations', 'Trees & little details'],
    ['border', 'Border'],
    ['compass', 'Compass'],
  ];
  return (
    <div>
      <PanelTitle>Look & layers</PanelTitle>
      <div className="label">Style</div>
      <div className="grid grid-cols-3 gap-2">
        {STYLE_ORDER.map((id) => (
          <button key={id} aria-pressed={design.styleId === id} data-testid={`quick-style-${id}`} onClick={() => edit((d) => void (d.styleId = id))} className={`overflow-hidden rounded-xl border-2 text-left ${design.styleId === id ? 'border-ink' : 'border-line'}`}>
            <img src={`/styles/${id}.svg`} alt="" loading="lazy" className="aspect-square w-full object-cover" />
            <span className="block truncate px-1.5 py-1 text-[12px] font-extrabold">{STYLES[id].name}</span>
          </button>
        ))}
      </div>
      <div className="label mt-5">Show on the map</div>
      <div className="divide-y divide-line">
        {toggles.map(([k, label]) => (
          <Toggle key={k} label={label} checked={L[k]} onChange={(v) => edit((d) => void (d.layers[k] = v))} />
        ))}
      </div>
      {design.hidden.length > 0 && (
        <button className="btn-secondary mt-4 w-full" onClick={() => edit((d) => void (d.hidden = []))}>
          Bring back {design.hidden.length} removed item{design.hidden.length === 1 ? '' : 's'}
        </button>
      )}
      <button className="btn-ghost mt-2 w-full text-sm" onClick={() => confirm('Reset places, removed items and extra text to the automatic design?') && useStudio.getState().resetEdits()}>
        Reset my edits
      </button>
    </div>
  );
}

const HOME_ICONS: IconId[] = ['house', 'heart', 'star', 'pin', 'flag', 'castle', 'tree'];

function Swatches({ value, colors, onChange }: { value?: string; colors: string[]; onChange(c: string | undefined): void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
      <button role="radio" aria-checked={!value} onClick={() => onChange(undefined)} className={`h-9 rounded-full border-2 px-3 text-xs font-extrabold ${!value ? 'border-ink' : 'border-line'}`}>Auto</button>
      {colors.map((c) => (
        <button key={c} role="radio" aria-checked={value === c} aria-label={c} onClick={() => onChange(c)} className={`h-9 w-9 rounded-full border-2 ${value === c ? 'border-ink ring-2 ring-sky' : 'border-ink/30'}`} style={{ background: c }} />
      ))}
    </div>
  );
}

const paletteOf = (d: Design) => [...new Set([STYLES[d.styleId].colors.home, ...STYLES[d.styleId].colors.iconPalette.map((p) => p[0]), '#FF6B6B', '#4DABF7', '#51CF66', '#B197FC', '#FF922B', '#2F3447'])].slice(0, 8);

function HomePanel() {
  const { design, edit } = useStudio();
  const h = design.home;
  return (
    <div className="space-y-4">
      <PanelTitle sub="The place this map is all about.">Your marker</PanelTitle>
      <Toggle label="Show the marker" checked={h.visible} onChange={(v) => edit((d) => void (d.home.visible = v))} />
      <Field label="Label" value={h.label} max={40} onChange={(v) => edit((d) => void (d.home.label = v))} />
      <div><div className="label">Marker</div><IconPicker value={h.icon} options={HOME_ICONS} onChange={(icon) => edit((d) => void (d.home.icon = icon))} /></div>
      <div><div className="label">Colour</div><Swatches value={h.color} colors={paletteOf(design)} onChange={(c) => edit((d) => void (c ? (d.home.color = c) : delete d.home.color))} /></div>
      <Range label="Size" min={0.6} max={2} step={0.05} value={h.scale} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => edit((d) => void (d.home.scale = v))} />
      {(h.dx !== 0 || h.dy !== 0) && <button className="btn-ghost w-full text-sm" onClick={() => edit((d) => void (d.home.dx = d.home.dy = 0))}>Put it back in its true spot</button>}
    </div>
  );
}

function Inspector({ id }: { id: string }) {
  const { design, edit, select } = useStudio();
  const back = (
    <button className="btn-ghost -ml-3 mb-1 hidden min-h-9 text-sm lg:inline-flex" onClick={() => select(null)}>← All tools</button>
  );
  if (id === 'home') return <div data-testid="inspector">{back}<HomePanel /></div>;
  if (id === 'title') return <div data-testid="inspector">{back}<PanelTitle>Title</PanelTitle><TitleFields /></div>;

  const text = design.texts.find((t) => t.id === id);
  if (text) {
    const upd = (fn: (t: Design['texts'][number]) => void) => edit((d) => fn(d.texts.find((t) => t.id === id)!));
    return (
      <div className="space-y-4" data-testid="inspector">
        {back}
        <PanelTitle sub="Drag it anywhere on the map.">Text</PanelTitle>
        <Field label="Words" value={text.text} max={120} onChange={(v) => upd((t) => void (t.text = v))} />
        <div className="flex gap-2">
          {(['display', 'label'] as const).map((f) => (
            <button key={f} className={`chip ${text.font === f ? 'chip-on' : ''}`} onClick={() => upd((t) => void (t.font = f))}>{f === 'display' ? 'Title lettering' : 'Label lettering'}</button>
          ))}
        </div>
        <Range label="Size" min={0.4} max={4} step={0.05} value={text.scale} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd((t) => void (t.scale = v))} />
        <div><div className="label">Colour</div><Swatches value={text.color} colors={paletteOf(design)} onChange={(c) => upd((t) => void (c ? (t.color = c) : delete t.color))} /></div>
        <button className="btn-secondary w-full text-coral-dark" onClick={() => (edit((d) => void (d.texts = d.texts.filter((t) => t.id !== id))), select(null))}>Delete this text</button>
      </div>
    );
  }

  const lm = design.landmarks.find((l) => l.id === id);
  if (!lm) return <div>{back}<p className="text-sm text-ink-soft">Nothing selected.</p></div>;
  const upd = (fn: (l: Landmark) => void) => edit((d) => fn(d.landmarks.find((l) => l.id === id)!));
  return (
    <div className="space-y-4" data-testid="inspector">
      {back}
      <PanelTitle sub={lm.source === 'custom' ? 'Your own place. Drag it to move it.' : `${CATEGORY_META[lm.category].label} · from OpenStreetMap`}>Edit place</PanelTitle>
      <Field label="Name on the map" value={lm.label} testId="landmark-label" onChange={(v) => upd((l) => void (l.label = v))} />
      <div><div className="label">Icon</div><IconPicker value={lm.icon} onChange={(icon) => upd((l) => void (l.icon = icon))} /></div>
      <div><div className="label">Colour</div><Swatches value={lm.color} colors={paletteOf(design)} onChange={(c) => upd((l) => void (c ? (l.color = c) : delete l.color))} /></div>
      <Range label="Size" min={0.5} max={2.5} step={0.05} value={lm.scale} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd((l) => void (l.scale = v))} />
      {(lm.dx !== 0 || lm.dy !== 0) && <button className="btn-ghost w-full text-sm" onClick={() => upd((l) => void (l.dx = l.dy = 0))}>Put it back in its true spot</button>}
      <button
        className="btn-secondary w-full text-coral-dark"
        data-testid="remove-landmark"
        onClick={() => {
          if (lm.source === 'custom') edit((d) => void (d.landmarks = d.landmarks.filter((l) => l.id !== id)));
          else upd((l) => void (l.visible = false));
          select(null);
        }}
      >
        {lm.source === 'custom' ? 'Delete this place' : 'Remove from map'}
      </button>
    </div>
  );
}
