'use client';

import type { MockupScene } from '@maploom/core';

/**
 * Product mockups drawn entirely in CSS/SVG (no stock photos), so they stay
 * crisp at any size and update instantly as the design changes.
 */
export function Mockup({ src, scene, aspect, label }: { src: string; scene: MockupScene; aspect: number; label: string }) {
  const art = <img src={src} alt={label} className="block h-full w-full" draggable={false} />;
  const landscape = aspect > 1;

  if (scene === 'floor-mat') {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border-2 border-ink" data-testid="mockup" data-scene={scene}>
        <div className="absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-[#F6EDE0] to-[#EFE3D2]" />
        <div className="absolute inset-x-0 top-[36%] h-[3%] bg-white/90 shadow-sm" />
        <div className="absolute inset-x-0 bottom-0 h-[61%]" style={{ background: 'repeating-linear-gradient(90deg,#D9B48A 0 11.5%,#D2AB80 11.5% 12%,#DDBA91 12% 24%,#CFA679 24% 24.5%)' }} />
        <div className="absolute top-[7%] left-[9%] h-[20%] w-[15%] rounded-md border-[5px] border-white bg-[#CFE3EE] shadow-md" />
        <svg className="absolute top-[14%] right-[8%] w-[20%]" viewBox="0 0 100 70" aria-hidden>
          <rect x="0" y="22" width="100" height="48" rx="6" fill="#fff" stroke="#E3D5C0" strokeWidth="3" />
          <rect x="8" y="30" width="24" height="16" rx="3" fill="#FFD166" />
          <rect x="38" y="30" width="24" height="16" rx="3" fill="#6EC6FF" />
          <rect x="68" y="30" width="24" height="16" rx="3" fill="#FF8A65" />
        </svg>
        <div className="absolute inset-x-0 bottom-[5%] flex justify-center" style={{ perspective: '900px' }}>
          <div className="origin-bottom overflow-hidden rounded-[6px] shadow-[0_26px_30px_-14px_rgba(60,40,20,.55)]" style={{ width: landscape ? '78%' : '50%', aspectRatio: String(aspect), transform: `rotateX(${landscape ? 52 : 60}deg)`, outline: '5px solid rgba(255,255,255,.25)', outlineOffset: '-5px' }}>
            {art}
          </div>
        </div>
        <svg className="absolute bottom-[7%] left-[9%] w-[13%] drop-shadow-md" viewBox="0 0 100 52" aria-hidden>
          <path d="M6 34V24l16-4 12-14h30l14 14 14 4v10z" fill="#FF5A5F" stroke="#2F3447" strokeWidth="4" strokeLinejoin="round" />
          <path d="M38 12h12v10H30zM56 12h8l8 10H56z" fill="#CFEFFF" stroke="#2F3447" strokeWidth="3" />
          <circle cx="26" cy="38" r="10" fill="#2F3447" /><circle cx="26" cy="38" r="4" fill="#fff" />
          <circle cx="76" cy="38" r="10" fill="#2F3447" /><circle cx="76" cy="38" r="4" fill="#fff" />
        </svg>
      </div>
    );
  }

  if (scene === 'flat') {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl border-2 border-ink bg-[#EDEAE2] p-[5%]" data-testid="mockup" data-scene={scene}>
        <div className="max-h-full overflow-hidden rounded-sm shadow-[0_14px_34px_-14px_rgba(47,52,71,.6)]" style={{ aspectRatio: String(aspect), height: landscape ? 'auto' : '100%', width: landscape ? '86%' : 'auto' }}>{art}</div>
      </div>
    );
  }

  const frame = scene === 'wall-frame';
  const canvas = scene === 'wall-canvas';
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border-2 border-ink" data-testid="mockup" data-scene={scene}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#EFEBE3] via-[#E8E3D8] to-[#DDD6C8]" />
      <div className="absolute inset-x-0 bottom-0 h-[20%] bg-gradient-to-b from-[#C9A77E] to-[#B9966C]" />
      <div className="absolute inset-x-0 bottom-[20%] h-[2.5%] bg-white/80" />
      <svg className="absolute bottom-[14%] left-[5%] w-[17%]" viewBox="0 0 100 140" aria-hidden>
        <path d="M50 90C30 70 22 44 30 14M50 90c4-30 20-52 40-60M50 92C40 70 20 60 6 58" fill="none" stroke="#5E8C5A" strokeWidth="7" strokeLinecap="round" />
        <path d="M30 96h40l-6 42H36z" fill="#E9E2D6" stroke="#CFC5B4" strokeWidth="3" />
      </svg>
      <div className="absolute inset-x-0 top-[7%] bottom-[25%] flex items-center justify-center">
        <div
          className="max-h-full"
          style={{
            aspectRatio: String(aspect),
            height: landscape ? 'auto' : '100%',
            width: landscape ? '62%' : 'auto',
            padding: frame ? '2.2%' : 0,
            background: frame ? 'linear-gradient(135deg,#C99A62,#A87B45)' : undefined,
            borderRadius: frame ? 3 : canvas ? 2 : 1,
            boxShadow: canvas ? '10px 14px 26px -8px rgba(40,30,20,.5), inset -6px 0 0 rgba(0,0,0,.12), inset 0 -6px 0 rgba(0,0,0,.1)' : '6px 12px 26px -10px rgba(40,30,20,.55)',
          }}
        >
          <div className="h-full w-full overflow-hidden" style={{ padding: frame ? '5%' : 0, background: frame ? '#FBF9F4' : undefined, boxShadow: frame ? 'inset 0 0 0 1px rgba(0,0,0,.08)' : undefined }}>
            {art}
          </div>
        </div>
      </div>
    </div>
  );
}
