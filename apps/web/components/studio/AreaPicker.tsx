'use client';

import { useEffect, useRef, useState } from 'react';
import type { LngLat } from '@maploom/core';
import { zoomForWidth } from '@maploom/geo';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Props {
  home: LngLat;
  center: LngLat;
  widthM: number;
  heightM: number;
  onChange(center: LngLat, widthM: number): void;
}

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/**
 * Interactive area picker. The dashed rectangle is the printable boundary:
 * whatever sits inside it is what gets drawn. Pan to move the area, zoom to
 * cover more or less ground. If WebGL or the basemap is unavailable the
 * picker degrades to a plain diagram and the size buttons keep working.
 */
export function AreaPicker({ home, center, widthM, heightM, onChange }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [rect, setRect] = useState({ w: 0, h: 0, fw: 0, fh: 0 });
  const synced = useRef(false);
  const latest = useRef({ center, widthM, onChange, fw: 0 });
  latest.current = { center, widthM, onChange, fw: rect.fw };
  const aspect = widthM / heightM;

  // Fit the printable frame inside the viewport with a margin.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const pad = Math.min(w, h) * 0.09 + 10;
      let fw = w - pad * 2;
      let fh = fw / aspect;
      if (fh > h - pad * 2) {
        fh = h - pad * 2;
        fw = fh * aspect;
      }
      setRect({ w, h, fw, fh });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: import('maplibre-gl').Map | undefined;
    (async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        if (cancelled || !box.current) return;
        maplibregl.setWorkerUrl('/vendor/maplibre-gl-worker.mjs');
        const m = new maplibregl.Map({
          container: box.current.querySelector<HTMLDivElement>('[data-map]')!,
          style: STYLE_URL,
          center: [latest.current.center.lon, latest.current.center.lat],
          zoom: 13,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          minZoom: 9,
          maxZoom: 17.5,
        });
        map = m;
        m.touchZoomRotate.disableRotation();
        m.keyboard.disableRotation();
        const el = document.createElement('div');
        el.innerHTML = '<svg width="34" height="34" viewBox="0 0 48 48"><path d="M24 44S9 28 9 18a15 15 0 0 1 30 0c0 10-15 26-15 26z" fill="#FF5A5F" stroke="#2F3447" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="18" r="6" fill="#fff" stroke="#2F3447" stroke-width="3"/></svg>';
        new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([home.lon, home.lat]).addTo(m);
        m.on('error', (e) => {
          // A failed style load means no basemap at all; tile hiccups are tolerated.
          const msg = String(e.error?.message ?? '');
          if (/Worker failed/i.test(msg) || (!m.isStyleLoaded() && /style|Failed to fetch|NetworkError/i.test(msg))) setFailed(true);
        });
        m.on('moveend', (e) => {
          if (!(e as { originalEvent?: unknown }).originalEvent && !(e as { user?: boolean }).user) return;
          const c = m.getCenter();
          const fw = latest.current.fw;
          if (!fw) return;
          const metersPerPx = (40075016.686 * Math.cos((c.lat * Math.PI) / 180)) / (512 * 2 ** m.getZoom());
          latest.current.onChange({ lat: Math.round(c.lat * 1e6) / 1e6, lon: Math.round(c.lng * 1e6) / 1e6 }, Math.round(metersPerPx * fw));
        });
        // If nothing has rendered after a while (blocked tiles, no WebGL), fall back gracefully.
        const watchdog = setTimeout(() => !m.loaded() && !m.isStyleLoaded() && setFailed(true), 12000);
        m.once('load', () => (clearTimeout(watchdog), setFailed(false)));
        mapRef.current = m;
        setReady(true);
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [home.lat, home.lon]);

  // Keep the map in sync when size/centre change from the buttons.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !rect.fw) return;
    const zoom = zoomForWidth(widthM, center.lat, rect.fw);
    const c = map.getCenter();
    if (Math.abs(map.getZoom() - zoom) > 0.01 || Math.abs(c.lat - center.lat) > 1e-6 || Math.abs(c.lng - center.lon) > 1e-6) {
      map.easeTo({ center: [center.lon, center.lat], zoom, duration: synced.current ? 350 : 0 });
    }
    synced.current = true;
  }, [center.lat, center.lon, widthM, rect.fw, ready]);

  return (
    <div ref={box} className="relative h-full min-h-[280px] w-full overflow-hidden rounded-2xl border-2 border-ink bg-[#eef1ea]" data-testid="area-picker">
      {/* MapLibre forces position:relative on its container, so size it via a wrapper. */}
      <div className="absolute inset-0">
        <div data-map style={{ width: '100%', height: '100%' }} />
      </div>
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#eef1ea] p-6 text-center text-sm font-semibold text-ink-soft">
          The preview map couldn’t load here. That’s okay — choose a size below and we’ll centre the map on your place.
        </div>
      )}
      {rect.fw > 0 && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute rounded-md border-[3px] border-dashed border-ink shadow-[0_0_0_9999px_rgba(255,248,234,.62)]"
            style={{ width: rect.fw, height: rect.fh, left: (rect.w - rect.fw) / 2, top: (rect.h - rect.fh) / 2 }}
          />
          <div className="absolute rounded-full bg-ink px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-white uppercase" style={{ left: (rect.w - rect.fw) / 2 + 8, top: (rect.h - rect.fh) / 2 + 8 }}>
            Your map
          </div>
        </div>
      )}
    </div>
  );
}
