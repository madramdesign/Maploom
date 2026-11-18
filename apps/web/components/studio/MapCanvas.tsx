'use client';

import { useMemo, useRef } from 'react';
import type { Design, Geography, LngLat } from '@maploom/core';
import { LocalProjection } from '@maploom/geo';
import { artSize, renderBaseLayer, renderOverlayLayer, wrapSvg, type FontBook, type RenderItem } from '@maploom/render';

export interface CanvasHandlers {
  selection?: string | null;
  tool?: 'select' | 'erase' | 'place';
  onSelect?(id: string | null): void;
  onDragStart?(id: string): void;
  /** Delta in art units since the gesture started. */
  onDrag?(id: string, kind: RenderItem['kind'], dx: number, dy: number): void;
  onErase?(id: string): void;
  onPlace?(lngLat: LngLat): void;
}

/** Builds the two SVG layers; the heavy base layer is only recomputed when geography-affecting inputs change. */
export function useArtwork(geo: Geography | null, design: Design, fonts: Partial<FontBook> | null) {
  const size = useMemo(() => (geo ? artSize(geo.frame) : null), [geo]);
  const base = useMemo(() => (geo && fonts ? renderBaseLayer(geo, design, fonts) : ''), [geo, fonts, design.styleId, design.layers, design.hidden]);
  const overlay = useMemo(() => (geo && fonts ? renderOverlayLayer(geo, design, fonts) : { markup: '', items: [] as RenderItem[] }), [geo, fonts, design]);
  return { size, base, overlay };
}

/** Complete artwork as a standalone SVG string (for mockups and client-side downloads). */
export function artworkSvg(geo: Geography, design: Design, fonts: Partial<FontBook>): string {
  return wrapSvg(renderBaseLayer(geo, design, fonts) + renderOverlayLayer(geo, design, fonts).markup, design, artSize(geo.frame));
}

export function MapCanvas({ geo, design, fonts, handlers = {}, className = '' }: { geo: Geography; design: Design; fonts: Partial<FontBook>; handlers?: CanvasHandlers; className?: string }) {
  const { size, base, overlay } = useArtwork(geo, design, fonts);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; kind: RenderItem['kind']; x: number; y: number; moved: boolean; pointer: number } | null>(null);
  const { selection, tool = 'select' } = handlers;
  if (!size) return null;

  const toArt = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * size.width, y: ((e.clientY - r.top) / r.height) * size.height };
  };
  const hit = (target: EventTarget | null) => (target as Element | null)?.closest?.('[data-id]') as SVGElement | null;

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const el = hit(e.target);
    const kind = el?.getAttribute('data-kind');
    const id = el?.getAttribute('data-id');
    if (tool === 'place') {
      const p = toArt(e);
      const proj = new LocalProjection(geo.frame.center);
      handlers.onPlace?.(proj.unproject([p.x / size.scale - geo.frame.widthM / 2, p.y / size.scale - geo.frame.heightM / 2]));
      return;
    }
    if (tool === 'erase') {
      if (id && (kind === 'road' || kind === 'building' || kind === 'area' || kind === 'waterway')) handlers.onErase?.(id);
      return;
    }
    if (id && (kind === 'landmark' || kind === 'home' || kind === 'text' || kind === 'title')) {
      handlers.onSelect?.(id);
      if (kind !== 'title') {
        const p = toArt(e);
        drag.current = { id, kind, x: p.x, y: p.y, moved: false, pointer: e.pointerId };
        svgRef.current?.setPointerCapture(e.pointerId);
      }
      e.preventDefault();
    } else handlers.onSelect?.(null);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const p = toArt(e);
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      handlers.onDragStart?.(d.id);
    }
    handlers.onDrag?.(d.id, d.kind, dx, dy);
  };
  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointer === e.pointerId) drag.current = null;
  };

  const sel = selection ? overlay.items.find((i) => i.id === selection) : null;
  const cursor = tool === 'place' ? 'crosshair' : tool === 'erase' ? 'cell' : 'default';

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${size.width} ${size.height}`}
      className={`block h-full w-full touch-none select-none ${className}`}
      style={{ cursor, background: '#fff' }}
      role="img"
      aria-label={`Illustrated map: ${design.title.title}`}
      data-testid="map-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <style>{`[data-kind="landmark"],[data-kind="home"],[data-kind="text"],[data-kind="title"]{cursor:${tool === 'select' ? 'grab' : cursor}}${tool === 'erase' ? '[data-kind="road"]:hover,[data-kind="building"]:hover,[data-kind="area"]:hover,[data-kind="waterway"]:hover{opacity:.45}' : ''}`}</style>
      <g dangerouslySetInnerHTML={{ __html: base }} />
      <g dangerouslySetInnerHTML={{ __html: overlay.markup }} />
      {sel && tool === 'select' && (
        <rect x={sel.box[0] - 6} y={sel.box[1] - 6} width={sel.box[2] - sel.box[0] + 12} height={sel.box[3] - sel.box[1] + 12} rx={10} fill="none" stroke="#4DABF7" strokeWidth={3} strokeDasharray="9 6" pointerEvents="none" data-testid="selection-box" />
      )}
    </svg>
  );
}
