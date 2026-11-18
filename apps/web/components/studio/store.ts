'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PRODUCTS, clampText, type Design, type Geography, type IconId, type Landmark, type LngLat, type Orientation, type StyleId } from '@maploom/core';
import { COVERAGE_PRESETS, makeFrame } from '@maploom/geo';
import { createDesign, suggestLandmarks } from '@maploom/render';
import { ApiError, api, waitForJob } from './api';

export const STEPS = [
  { id: 'location', label: 'Place' },
  { id: 'area', label: 'Area' },
  { id: 'places', label: 'Places' },
  { id: 'personalize', label: 'Names' },
  { id: 'style', label: 'Style' },
  { id: 'generate', label: 'Create' },
  { id: 'edit', label: 'Edit' },
  { id: 'preview', label: 'Preview' },
  { id: 'finish', label: 'Finish' },
] as const;
export type StepId = (typeof STEPS)[number]['id'];

export const SHAPES = [
  { id: '3x4', label: 'Classic', hint: '12×16 · 18×24 in', ratio: 3 / 4 },
  { id: '2x3', label: 'Tall', hint: '24×36 in · 4×6 ft mat', ratio: 2 / 3 },
  { id: '4x5', label: 'Gallery', hint: '16×20 in canvas', ratio: 4 / 5 },
  { id: '5x7', label: 'Big mat', hint: '5×7 ft play mat', ratio: 5 / 7 },
  { id: '3x5', label: 'Runner', hint: '3×5 ft play mat', ratio: 3 / 5 },
] as const;
export type ShapeId = (typeof SHAPES)[number]['id'];

export function variantsForShape(shapeId: ShapeId) {
  const ratio = SHAPES.find((s) => s.id === shapeId)!.ratio;
  return PRODUCTS.flatMap((product) => product.variants.filter((v) => Math.abs(v.shortIn / v.longIn - ratio) < 0.012).map((variant) => ({ product, variant })));
}

export interface StudioLocation {
  label: string;
  context: string;
  lngLat: LngLat;
}

type GeoStatus = { state: 'idle' } | { state: 'loading'; progress: number; stage: string } | { state: 'ready' } | { state: 'error'; message: string };

interface StudioState {
  step: StepId;
  location: StudioLocation | null;
  /** Centre of the map area (may be nudged away from the home marker). */
  center: LngLat | null;
  shortEdgeM: number;
  shape: ShapeId;
  orientation: Exclude<Orientation, 'square'>;
  forName: string;
  titleTouched: boolean;
  design: Design;
  projectId: string | null;
  projectName: string;
  savedAt: string | null;

  // Not persisted
  geo: Geography | null;
  geoFrameSig: string | null;
  geoStatus: GeoStatus;
  past: Design[];
  future: Design[];
  selection: string | null;
  tool: 'select' | 'erase' | 'place';
  dirty: boolean;
  hydrated: boolean;

  go(step: StepId): void;
  setLocation(loc: StudioLocation): void;
  setArea(patch: Partial<Pick<StudioState, 'center' | 'shortEdgeM' | 'shape' | 'orientation'>>): void;
  setForName(name: string): void;
  /** Apply a change and record it for undo. */
  edit(fn: (d: Design) => void): void;
  /** Apply a change without an undo step (used while dragging; call beginGesture first). */
  nudge(fn: (d: Design) => void): void;
  beginGesture(): void;
  undo(): void;
  redo(): void;
  resetEdits(): void;
  select(id: string | null): void;
  setTool(tool: StudioState['tool']): void;
  addCustomPlace(lngLat: LngLat, label?: string, icon?: IconId): string;
  refreshLandmarks(): void;
  generate(force?: boolean): Promise<void>;
  loadProject(id: string): Promise<void>;
  save(): Promise<void>;
  startOver(): void;
}

const PLACEHOLDER: LngLat = { lat: 0, lon: 0 };
const aspectOf = (shape: ShapeId, orientation: 'portrait' | 'landscape') => {
  const r = SHAPES.find((s) => s.id === shape)!.ratio;
  return orientation === 'portrait' ? r : 1 / r;
};
const freshDesign = () => createDesign({ frame: makeFrame(PLACEHOLDER, COVERAGE_PRESETS[2].shortEdgeM, 3 / 4), home: PLACEHOLDER });
const frameSig = (d: Design) => JSON.stringify(d.frame);
const clone = <T,>(v: T): T => structuredClone(v);
const HISTORY = 60;

let generateRun = 0;

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => {
      /** Recompute everything that hangs off location / area choices. */
      const syncFrame = (s: StudioState): Partial<StudioState> => {
        if (!s.location || !s.center) return {};
        const design = clone(s.design);
        design.frame = makeFrame(s.center, s.shortEdgeM, aspectOf(s.shape, s.orientation));
        design.home.lngLat = s.location.lngLat;
        const fits = variantsForShape(s.shape);
        const current = fits.find((f) => f.variant.id === design.product.variantId);
        const pick = current ?? fits.find((f) => f.product.id === 'poster') ?? fits[0];
        design.product = { productId: pick.product.id, variantId: pick.variant.id, orientation: s.orientation };
        return { design };
      };

      return {
        step: 'location',
        location: null,
        center: null,
        shortEdgeM: COVERAGE_PRESETS[2].shortEdgeM,
        shape: '3x4',
        orientation: 'portrait',
        forName: '',
        titleTouched: false,
        design: freshDesign(),
        projectId: null,
        projectName: '',
        savedAt: null,
        geo: null,
        geoFrameSig: null,
        geoStatus: { state: 'idle' },
        past: [],
        future: [],
        selection: null,
        tool: 'select',
        dirty: false,
        hydrated: false,

        go: (step) => set({ step, selection: null, tool: 'select' }),

        setLocation: (location) =>
          set((s) => {
            const next = { ...s, location, center: location.lngLat };
            const design = syncFrame(next).design!;
            if (!s.titleTouched) design.title.subtitle = clampText(location.context || location.label, 80);
            // A new place invalidates everything that was derived from the old one.
            design.landmarks = [];
            design.hidden = [];
            design.home.dx = design.home.dy = 0;
            delete design.geographyKey;
            return { location, center: location.lngLat, design, geo: null, geoFrameSig: null, geoStatus: { state: 'idle' }, past: [], future: [], dirty: true };
          }),

        setArea: (patch) => set((s) => ({ ...patch, ...syncFrame({ ...s, ...patch }), dirty: true })),

        setForName: (forName) =>
          set((s) => {
            const design = clone(s.design);
            if (!s.titleTouched) design.title.title = forName.trim() ? `${clampText(forName.trim(), 30)}${/s$/i.test(forName.trim()) ? '’' : '’s'} Neighborhood` : 'Our Neighborhood';
            return { forName, design, dirty: true };
          }),

        edit: (fn) =>
          set((s) => {
            const design = clone(s.design);
            fn(design);
            return { design, past: [...s.past.slice(-HISTORY + 1), s.design], future: [], dirty: true };
          }),
        beginGesture: () => set((s) => ({ past: [...s.past.slice(-HISTORY + 1), s.design], future: [] })),
        nudge: (fn) =>
          set((s) => {
            const design = clone(s.design);
            fn(design);
            return { design, dirty: true };
          }),
        undo: () =>
          set((s) => {
            const prev = s.past[s.past.length - 1];
            if (!prev) return {};
            // Never let undo silently change the map area out from under the loaded geography.
            return { design: { ...prev, frame: s.design.frame, geographyKey: s.design.geographyKey }, past: s.past.slice(0, -1), future: [s.design, ...s.future], selection: null, dirty: true };
          }),
        redo: () =>
          set((s) => {
            const next = s.future[0];
            if (!next) return {};
            return { design: { ...next, frame: s.design.frame, geographyKey: s.design.geographyKey }, past: [...s.past, s.design], future: s.future.slice(1), selection: null, dirty: true };
          }),
        resetEdits: () => {
          const s = get();
          if (!s.geo) return;
          s.edit((d) => {
            d.hidden = [];
            d.texts = [];
            d.home.dx = d.home.dy = 0;
            d.home.scale = 1;
            delete d.home.color;
            d.landmarks = suggestLandmarks(s.geo!, d.preferences, d.landmarkTarget, [], d.title);
          });
          set({ selection: null });
        },

        select: (selection) => set({ selection }),
        setTool: (tool) => set({ tool, selection: null }),

        addCustomPlace: (lngLat, label = 'Special place', icon = 'heart') => {
          const id = `custom-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
          const lm: Landmark = { id, source: 'custom', label, category: 'other', icon, lngLat, visible: true, dx: 0, dy: 0, scale: 1.1 };
          get().edit((d) => {
            d.landmarks.unshift(lm);
          });
          set({ selection: id, tool: 'select' });
          return id;
        },

        refreshLandmarks: () => {
          const s = get();
          if (!s.geo) return;
          s.edit((d) => {
            d.landmarks = suggestLandmarks(s.geo!, d.preferences, d.landmarkTarget, d.landmarks, d.title);
          });
        },

        generate: async (force = false) => {
          const s = get();
          if (!s.location) return;
          const sig = frameSig(s.design);
          if (!force && s.geo && s.geoFrameSig === sig) {
            set({ geoStatus: { state: 'ready' } });
            return;
          }
          if (!force && s.geoStatus.state === 'loading' && s.geoFrameSig === sig) return;
          const run = ++generateRun;
          set({ geoStatus: { state: 'loading', progress: 0.02, stage: 'Finding your streets' }, geoFrameSig: sig, geo: null });
          try {
            const { jobId } = await api.startGeography(s.design.frame);
            const result = await waitForJob<{ geographyKey: string }>(jobId, (j) => {
              if (run === generateRun) set({ geoStatus: { state: 'loading', progress: Math.max(0.05, j.progress * 0.9), stage: j.stage ?? 'Finding your streets' } });
            });
            if (run !== generateRun) return;
            set({ geoStatus: { state: 'loading', progress: 0.95, stage: 'Drawing your map' } });
            const geo = await api.geography(result.geographyKey);
            if (run !== generateRun) return;
            set((cur) => {
              const design = clone(cur.design);
              design.geographyKey = geo.key;
              design.landmarks = suggestLandmarks(geo, design.preferences, design.landmarkTarget, design.landmarks, design.title);
              return { geo, design, geoStatus: { state: 'ready' }, past: [], future: [] };
            });
          } catch (err) {
            if (run !== generateRun) return;
            set({ geoStatus: { state: 'error', message: err instanceof ApiError ? err.message : 'Something went wrong while drawing your map. Please try again.' }, geoFrameSig: null });
          }
        },

        loadProject: async (id) => {
          const p = await api.getProject(id);
          const short = Math.min(p.design.frame.widthM, p.design.frame.heightM);
          const ratio = short / Math.max(p.design.frame.widthM, p.design.frame.heightM);
          const shape = SHAPES.reduce((best, s) => (Math.abs(s.ratio - ratio) < Math.abs(best.ratio - ratio) ? s : best), SHAPES[0] as (typeof SHAPES)[number]).id;
          set({
            step: 'edit',
            location: { label: p.location.label, context: p.location.context, lngLat: p.design.home.lngLat },
            center: p.design.frame.center,
            shortEdgeM: short,
            shape,
            orientation: p.design.frame.widthM > p.design.frame.heightM ? 'landscape' : 'portrait',
            design: p.design,
            titleTouched: true,
            projectId: p.id,
            projectName: p.name,
            savedAt: p.updatedAt,
            geo: null,
            geoFrameSig: null,
            geoStatus: { state: 'idle' },
            past: [],
            future: [],
            dirty: false,
          });
          await get().generate();
          set({ dirty: false });
        },

        save: async () => {
          const s = get();
          if (!s.location) return;
          const name = s.projectName.trim() || s.design.title.title || 'My map';
          const project = await api.saveProject({ id: s.projectId ?? undefined, name, design: s.design, location: { label: s.location.label, context: s.location.context } });
          set({ projectId: project.id, projectName: project.name, savedAt: project.updatedAt, dirty: false });
        },

        startOver: () => {
          generateRun++;
          set({ step: 'location', location: null, center: null, forName: '', titleTouched: false, design: freshDesign(), projectId: null, projectName: '', savedAt: null, geo: null, geoFrameSig: null, geoStatus: { state: 'idle' }, past: [], future: [], selection: null, tool: 'select', dirty: false });
        },
      };
    },
    {
      name: 'maploom-studio-v1',
      version: 1,
      // Local autosave only — this is the customer's own browser, nothing is sent anywhere.
      partialize: (s) => ({ step: s.step, location: s.location, center: s.center, shortEdgeM: s.shortEdgeM, shape: s.shape, orientation: s.orientation, forName: s.forName, titleTouched: s.titleTouched, design: s.design, projectId: s.projectId, projectName: s.projectName, savedAt: s.savedAt }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.hydrated = true;
        // Geography is never persisted, so steps that need it re-create it on return.
        if (!state.location) state.step = 'location';
        else if (['edit', 'preview', 'finish', 'generate'].includes(state.step)) state.step = 'generate';
      },
    },
  ),
);

export const STYLE_ORDER: StyleId[] = ['playful', 'watercolor', 'vintage', 'minimal', 'poster', 'blueprint'];
