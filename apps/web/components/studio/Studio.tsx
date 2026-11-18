'use client';

import { useEffect, useState } from 'react';
import { Logo } from '@/components/Brand';
import { Editor } from './Editor';
import { FinishStep, PreviewStep } from './Finish';
import { AreaStep, GenerateStep, LocationStep, PersonalizeStep, PlacesStep, StyleStep } from './steps';
import { STEPS, useStudio, type StepId } from './store';
import { Notice } from './ui';

export function Studio() {
  const step = useStudio((s) => s.step);
  const go = useStudio((s) => s.go);
  const location = useStudio((s) => s.location);
  const geoReady = useStudio((s) => s.geoStatus.state === 'ready' && !!s.geo);
  const dirty = useStudio((s) => s.dirty);
  const projectId = useStudio((s) => s.projectId);
  const [mounted, setMounted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const id = new URLSearchParams(window.location.search).get('project');
    if (id) {
      window.history.replaceState(null, '', '/create');
      useStudio.getState().loadProject(id).catch(() => setLoadError("We couldn't open that saved map. It may have been deleted, or saved from a different browser."));
    }
  }, []);

  // Warm up the map data as soon as the area is settled, so "Create" feels instant.
  useEffect(() => {
    if (mounted && location && (step === 'places' || step === 'personalize' || step === 'style')) void useStudio.getState().generate();
  }, [mounted, location, step]);

  if (!mounted) return <div className="flex h-dvh items-center justify-center text-ink-soft">Loading…</div>;

  const index = STEPS.findIndex((s) => s.id === step);
  const prev: StepId | null = step === 'edit' ? 'style' : index > 0 ? STEPS[index - 1].id : null;
  const next: StepId | null = step === 'finish' || step === 'generate' ? null : STEPS[index + 1].id;
  const canNext = step === 'location' ? !!location : step === 'edit' || step === 'preview' ? geoReady : true;
  const reachable = (id: StepId) => {
    const i = STEPS.findIndex((s) => s.id === id);
    if (i === 0) return true;
    if (!location) return false;
    if (i >= 6) return geoReady;
    return true;
  };
  const isEditor = step === 'edit';
  const nextLabel = step === 'style' ? 'Create my map' : step === 'edit' ? 'Preview' : step === 'preview' ? 'Finish' : 'Next';

  return (
    <div className={`flex flex-col ${isEditor ? 'h-dvh' : 'min-h-dvh'}`}>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:px-5">
          <div className="hidden sm:block"><Logo /></div>
          <button className="btn-ghost min-h-10 px-3 sm:ml-3" disabled={!prev} onClick={() => prev && go(prev)} aria-label="Back" data-testid="back">
            ← <span className="hidden sm:inline">Back</span>
          </button>
          <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Steps">
            {STEPS.map((s, i) => (
              <button key={s.id} disabled={!reachable(s.id)} aria-current={s.id === step ? 'step' : undefined} onClick={() => go(s.id)} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-extrabold transition disabled:opacity-35 ${s.id === step ? 'bg-ink text-white' : i < index ? 'text-ink hover:bg-ink/5' : 'text-ink-soft hover:bg-ink/5'}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${s.id === step ? 'bg-white text-ink' : i < index ? 'bg-leaf text-white' : 'bg-line text-ink-soft'}`}>{i < index ? '✓' : i + 1}</span>
                {s.label}
              </button>
            ))}
          </nav>
          <div className="mx-auto text-center lg:hidden" aria-live="polite">
            <div className="text-[11px] font-extrabold tracking-wide text-ink-soft uppercase">Step {index + 1} of {STEPS.length}</div>
            <div className="-mt-0.5 font-display text-[17px] font-semibold">{STEPS[index].label}</div>
          </div>
          <span className="hidden text-[12px] font-bold whitespace-nowrap text-ink-soft xl:inline" data-testid="save-state">{projectId ? (dirty ? 'Unsaved changes' : 'Saved') : location ? 'Autosaved on this device' : ''}</span>
          {next ? (
            <button className="btn-primary min-h-10 px-4 whitespace-nowrap" disabled={!canNext} onClick={() => go(next)} data-testid="next">
              {nextLabel} →
            </button>
          ) : (
            <span className="w-[72px]" />
          )}
        </div>
        <div className="h-1 bg-line lg:hidden"><div className="h-full bg-coral transition-all" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} /></div>
      </header>

      <main className={`mx-auto w-full max-w-7xl flex-1 px-3 sm:px-5 ${isEditor ? 'min-h-0 pt-3 pb-[calc(68px+env(safe-area-inset-bottom))] lg:pb-4' : 'py-6 sm:py-10'}`}>
        {loadError && <div className="mb-4"><Notice tone="error">{loadError}</Notice></div>}
        {step === 'location' && <LocationStep />}
        {step === 'area' && <AreaStep />}
        {step === 'places' && <PlacesStep />}
        {step === 'personalize' && <PersonalizeStep />}
        {step === 'style' && <StyleStep />}
        {step === 'generate' && <GenerateStep />}
        {step === 'edit' && <Editor />}
        {step === 'preview' && <PreviewStep />}
        {step === 'finish' && <FinishStep />}

        {!isEditor && next && step !== 'location' && (
          <div className="mx-auto mt-8 flex max-w-4xl justify-end">
            <button className="btn-primary px-7" disabled={!canNext} onClick={() => go(next)} data-testid="continue">{nextLabel} →</button>
          </div>
        )}
        {step === 'finish' && (
          <div className="mx-auto mt-8 max-w-5xl text-center">
            <button className="btn-ghost text-sm" onClick={() => confirm('Start a brand new map? Your current design will be cleared from this device (saved maps are kept).') && useStudio.getState().startOver()}>Start a new map</button>
          </div>
        )}
      </main>
    </div>
  );
}
