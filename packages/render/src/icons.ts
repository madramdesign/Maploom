import type { IconId } from '@maploom/core';

/**
 * Original icon set, drawn for Maploom. Every icon lives in a 48×48 box and is
 * painted with four roles so one drawing adapts to every map style:
 *   {o} outline   {a} main colour   {b} accent colour   {w} light/paper
 * {sw} is the outline width. Shapes are deliberately chunky so they survive
 * being woven into a rug as well as printed on paper.
 */
const S = 'stroke="{o}" stroke-linejoin="round" stroke-linecap="round"';

const ICONS: Record<IconId, string> = {
  house: `<path d="M8 23 24 9l16 14v17H8z" fill="{w}" ${S}/><path d="M5 24 24 7l19 17" fill="none" stroke="{a}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="20" y="28" width="8" height="12" rx="1.5" fill="{b}" ${S}/><rect x="11.500" y="26" width="6" height="6" rx="1" fill="{b}" fill-opacity=".55" ${S}/><rect x="30.500" y="26" width="6" height="6" rx="1" fill="{b}" fill-opacity=".55" ${S}/><path d="M31 10v-4h5v8" fill="{a}" ${S}/>`,
  heart: `<path d="M24 41C10 31 5 24 5 16.500 5 10.500 9.500 6 15 6c4 0 7 2 9 5 2-3 5-5 9-5 5.500 0 10 4.500 10 10.500C43 24 38 31 24 41z" fill="{a}" ${S}/><path d="M12 15c.5-2.500 2.500-4 4.500-4" fill="none" stroke="{w}" stroke-width="2.500" stroke-linecap="round"/>`,
  star: `<path d="m24 4 6 13 14 1.700-10.300 9.600L36.500 42 24 35 11.500 42l2.800-13.700L4 18.700 18 17z" fill="{a}" ${S}/>`,
  pin: `<path d="M24 44S9 28 9 18a15 15 0 0 1 30 0c0 10-15 26-15 26z" fill="{a}" ${S}/><circle cx="24" cy="18" r="6" fill="{w}" ${S}/>`,
  flag: `<path d="M11 44V5" fill="none" ${S} stroke-width="3.500"/><path d="M11 7c9-4 13 4 26 0v18c-13 4-17-4-26 0z" fill="{a}" ${S}/>`,
  school: `<path d="M5 22h38v20H5z" fill="{w}" ${S}/><path d="M16 22 24 12l8 10v20H16z" fill="{a}" ${S}/><path d="M24 12V4" fill="none" ${S}/><path d="M24 4h8l-2 3 2 3h-8z" fill="{b}" ${S}/><circle cx="24" cy="24" r="3.500" fill="{w}" ${S}/><rect x="21" y="33" width="6" height="9" fill="{b}" ${S}/><rect x="8" y="27" width="5" height="5" fill="{b}" fill-opacity=".6" ${S}/><rect x="35" y="27" width="5" height="5" fill="{b}" fill-opacity=".6" ${S}/>`,
  daycare: `<rect x="6" y="20" width="16" height="16" rx="2" fill="{a}" ${S}/><rect x="26" y="20" width="16" height="16" rx="2" fill="{b}" ${S}/><rect x="16" y="6" width="16" height="16" rx="2" fill="{w}" ${S}/><path d="M11 32l3-8 3 8M12 30h4" fill="none" ${S}/><path d="M31 24h4a2 2 0 0 1 0 4h-4zm0 4h5a2 2 0 0 1 0 4h-5z" fill="none" ${S}/><path d="M28 11a4 4 0 1 0 0 6" fill="none" ${S}/>`,
  playground: `<path d="M8 42 16 8h16l8 34" fill="none" ${S} stroke-width="3"/><path d="M14 8h20" fill="none" stroke="{a}" stroke-width="5" stroke-linecap="round"/><path d="M20 9v20M28 9v20" fill="none" ${S}/><rect x="17" y="28" width="14" height="4.500" rx="2" fill="{b}" ${S}/>`,
  tree: `<rect x="21" y="28" width="6" height="15" rx="1.500" fill="{b}" ${S}/><path d="M24 4c7 0 12 5 12 11 4 1 6 4.500 6 8 0 5-4 9-10 9H16c-6 0-10-4-10-9 0-3.500 2-7 6-8 0-6 5-11 12-11z" fill="{a}" ${S}/><path d="M17 15c1-3 3.500-5 6-5" fill="none" stroke="{w}" stroke-width="2.500" stroke-linecap="round" stroke-opacity=".8"/>`,
  library: `<path d="M5 12c7-3 13-2 19 2v27c-6-4-12-5-19-2z" fill="{w}" ${S}/><path d="M43 12c-7-3-13-2-19 2v27c6-4 12-5 19-2z" fill="{a}" ${S}/><path d="M10 19c3-.7 6-.4 9 1M10 26c3-.7 6-.4 9 1" fill="none" ${S} stroke-width="1.800"/>`,
  community: `<path d="M6 42V20L24 7l18 13v22z" fill="{w}" ${S}/><circle cx="16" cy="26" r="3.500" fill="{a}" ${S}/><circle cx="32" cy="26" r="3.500" fill="{b}" ${S}/><circle cx="24" cy="22" r="4" fill="{a}" ${S}/><path d="M10 42c0-6 3-9 6-9s4 2 4 2M38 42c0-6-3-9-6-9s-4 2-4 2M17 42c0-7 3-11 7-11s7 4 7 11" fill="{w}" ${S}/>`,
  restaurant: `<circle cx="24" cy="26" r="14" fill="{w}" ${S}/><circle cx="24" cy="26" r="8" fill="{a}" fill-opacity=".35" ${S}/><path d="M7 5v10a3 3 0 0 0 6 0V5M10 5v38" fill="none" ${S} stroke-width="2.600"/><path d="M38 43V5c-4 3-5 9-5 14h5" fill="{b}" ${S}/>`,
  cafe: `<path d="M9 18h24v12a12 12 0 0 1-24 0z" fill="{a}" ${S}/><path d="M33 21h3a5 5 0 0 1 0 10h-4" fill="none" ${S} stroke-width="3"/><path d="M6 43h30" fill="none" ${S} stroke-width="3"/><path d="M16 12c-2-3 2-4 0-7M24 12c-2-3 2-4 0-7" fill="none" stroke="{b}" stroke-width="2.500" stroke-linecap="round"/>`,
  bakery: `<path d="M14 24c0-9 4-15 10-15s10 6 10 15c5 0 8 3 8 8s-4 9-9 9H15c-5 0-9-4-9-9s3-8 8-8z" fill="{a}" ${S}/><path d="M19 16c3 1 7 1 10 0M16 24c5 2 11 2 16 0M12 32c8 2.500 16 2.500 24 0" fill="none" stroke="{w}" stroke-width="2.500" stroke-linecap="round"/>`,
  ice_cream: `<path d="M15 24h18L24 45z" fill="{b}" ${S}/><path d="M19 30l8 5M17 26l11 7" fill="none" ${S} stroke-width="1.500"/><circle cx="24" cy="15" r="11" fill="{a}" ${S}/><path d="M13 22c2 3 5 3 6.500 1 1.500 3 5 3 7 0 1.800 2.500 5 2.500 8-1" fill="{w}" ${S}/><circle cx="24" cy="5" r="2.800" fill="{b}" ${S}/>`,
  pizza: `<path d="M24 44 6 12c11-7 25-7 36 0z" fill="{w}" ${S}/><path d="M6 12c11-7 25-7 36 0" fill="none" stroke="{b}" stroke-width="5" stroke-linecap="round"/><circle cx="19" cy="19" r="3.500" fill="{a}" ${S}/><circle cx="29" cy="22" r="3.500" fill="{a}" ${S}/><circle cx="23" cy="31" r="3" fill="{a}" ${S}/>`,
  grocery: `<path d="M4 8h6l5 22h22l4-15H13" fill="none" ${S} stroke-width="3"/><path d="M13.500 15H41l-4 15H15z" fill="{a}" ${S}/><circle cx="18" cy="38" r="4" fill="{b}" ${S}/><circle cx="34" cy="38" r="4" fill="{b}" ${S}/>`,
  sports: `<circle cx="24" cy="24" r="19" fill="{w}" ${S}/><path d="m24 14 9 6.500-3.400 10.500H18.400L15 20.500z" fill="{a}" ${S}/><path d="M24 14V5.500M33 20.500l8-3.500M29.600 31l5 7.500M18.400 31l-5 7.500M15 20.500 7 17" fill="none" ${S}/>`,
  pool: `<path d="M16 30V11a5 5 0 0 1 10 0M30 30V11a5 5 0 0 1 10 0M16 17h14M16 24h14" fill="none" ${S} stroke-width="3"/><path d="M4 33c4-4 7-4 10 0s7 4 10 0 7-4 10 0 7 4 10 0v9H4z" fill="{a}" ${S}/><path d="M9 40c3-2 5-2 8 0s5 2 8 0" fill="none" stroke="{w}" stroke-width="2.200" stroke-linecap="round"/>`,
  gym: `<rect x="17" y="21" width="14" height="6" fill="{b}" ${S}/><rect x="10" y="12" width="7" height="24" rx="2.500" fill="{a}" ${S}/><rect x="31" y="12" width="7" height="24" rx="2.500" fill="{a}" ${S}/><rect x="4" y="17" width="6" height="14" rx="2" fill="{w}" ${S}/><rect x="38" y="17" width="6" height="14" rx="2" fill="{w}" ${S}/>`,
  beach: `<path d="M4 42c8-5 32-5 40 0z" fill="{b}" ${S}/><path d="M26 40 20 14" fill="none" ${S} stroke-width="3"/><path d="M4 20C8 8 26 2 38 12c-7-1-13 1-18 2s-10 3-16 6z" fill="{a}" ${S}/><path d="M20 14c-3-4-2-8 0-9M20 14c2-5 8-6 18-2" fill="none" ${S} stroke-width="1.800"/><circle cx="39" cy="26" r="4" fill="{w}" ${S}/>`,
  trail: `<path d="M4 42 18 16l8 12 5-7 13 21z" fill="{a}" ${S}/><path d="m18 16-4.500 8.500 4 2 3-3 2.500 2.500 1.500-2.500z" fill="{w}" ${S}/><path d="M24 42c-2-4 4-5 2-9" fill="none" stroke="{w}" stroke-width="2.500" stroke-linecap="round" stroke-dasharray="1 4.500"/><circle cx="37" cy="10" r="4.500" fill="{b}" ${S}/>`,
  historic: `<path d="M5 42V16h6v6h5v-6h6v6h4v-6h6v6h5v-6h6v26z" fill="{w}" ${S}/><path d="M19 42V32a5 5 0 0 1 10 0v10z" fill="{a}" ${S}/><path d="M10 12V5h7l-2 2.500 2 2.500h-7" fill="{b}" ${S}/>`,
  monument: `<path d="M19 38 21.500 12 24 5l2.500 7L29 38z" fill="{w}" ${S}/><rect x="13" y="38" width="22" height="5" rx="1" fill="{a}" ${S}/><path d="M21.500 12h5" fill="none" ${S} stroke-width="1.800"/><path d="M36 10l1.500 3.500L41 15l-3.500 1.500L36 20l-1.500-3.500L31 15l3.500-1.500z" fill="{b}" ${S} stroke-width="1.500"/>`,
  museum: `<path d="M4 18 24 5l20 13z" fill="{a}" ${S}/><rect x="5" y="38" width="38" height="5" rx="1" fill="{a}" ${S}/><rect x="9" y="19" width="5" height="19" fill="{w}" ${S}/><rect x="21.500" y="19" width="5" height="19" fill="{w}" ${S}/><rect x="34" y="19" width="5" height="19" fill="{w}" ${S}/><circle cx="24" cy="12.500" r="2.200" fill="{b}" ${S} stroke-width="1.500"/>`,
  worship: `<path d="M10 43V25l14-9 14 9v18z" fill="{w}" ${S}/><path d="M17 20V12l7-7 7 7v8" fill="{a}" ${S}/><path d="M20 43v-8a4 4 0 0 1 8 0v8z" fill="{b}" ${S}/><circle cx="24" cy="25" r="3" fill="{b}" fill-opacity=".6" ${S}/><path d="M24 1v6M21.500 3.500h5" fill="none" ${S} stroke-width="2"/>`,
  government: `<path d="M8 40V22h32v18z" fill="{w}" ${S}/><path d="M12 22a12 12 0 0 1 24 0z" fill="{a}" ${S}/><path d="M24 10V3" fill="none" ${S}/><path d="M24 3h7v4.500h-7z" fill="{b}" ${S} stroke-width="1.800"/><rect x="4" y="40" width="40" height="4" rx="1" fill="{a}" ${S}/><path d="M14 27v9M20.500 27v9M27.500 27v9M34 27v9" fill="none" ${S} stroke-width="2.800"/>`,
  water: `<path d="M24 4c8 10 13 17 13 25a13 13 0 0 1-26 0c0-8 5-15 13-25z" fill="{a}" ${S}/><path d="M17 29c0 4 3 7 7 7" fill="none" stroke="{w}" stroke-width="2.800" stroke-linecap="round"/>`,
  train: `<rect x="10" y="5" width="28" height="30" rx="6" fill="{a}" ${S}/><rect x="14" y="10" width="20" height="11" rx="2" fill="{w}" ${S}/><circle cx="16.500" cy="28" r="2.500" fill="{b}" ${S} stroke-width="1.800"/><circle cx="31.500" cy="28" r="2.500" fill="{b}" ${S} stroke-width="1.800"/><path d="m15 35-6 9M33 35l6 9M12 40h24" fill="none" ${S}/>`,
  bus: `<rect x="6" y="9" width="36" height="27" rx="5" fill="{a}" ${S}/><path d="M6 24h36" fill="none" ${S}/><rect x="10" y="13" width="12" height="8" rx="1.500" fill="{w}" ${S} stroke-width="1.800"/><rect x="26" y="13" width="12" height="8" rx="1.500" fill="{w}" ${S} stroke-width="1.800"/><circle cx="14" cy="37" r="4.500" fill="{b}" ${S}/><circle cx="34" cy="37" r="4.500" fill="{b}" ${S}/>`,
  airport: `<path d="M21 5c0-2 6-2 6 0v13l17 10v5l-17-5v9l5 4v3l-8-2-8 2v-3l5-4v-9L4 33v-5l17-10z" fill="{a}" ${S}/>`,
  shop: `<path d="M7 20h34v23H7z" fill="{w}" ${S}/><path d="M4 20 8 6h32l4 14a5 5 0 0 1-10 0 5 5 0 0 1-10 0 5 5 0 0 1-10 0 5 5 0 0 1-10 0z" fill="{a}" ${S}/><rect x="12" y="28" width="10" height="15" fill="{b}" ${S}/><rect x="27" y="28" width="9" height="8" fill="{b}" fill-opacity=".55" ${S}/>`,
  hospital: `<path d="M8 43V11a3 3 0 0 1 3-3h26a3 3 0 0 1 3 3v32z" fill="{w}" ${S}/><path d="M20 13h8v6h6v8h-6v6h-8v-6h-6v-8h6z" fill="{a}" ${S}/><rect x="20" y="36" width="8" height="7" fill="{b}" ${S}/>`,
  fire_station: `<path d="M4 27h26V15h8l6 8v13H4z" fill="{a}" ${S}/><path d="M33 19h4l3.500 5H33z" fill="{w}" ${S} stroke-width="1.800"/><circle cx="13" cy="37" r="5" fill="{w}" ${S}/><circle cx="35" cy="37" r="5" fill="{w}" ${S}/><path d="M6 21h22M6 15h22M9 15v6M15 15v6M21 15v6M27 15v6" fill="none" stroke="{b}" stroke-width="2.200" stroke-linecap="round"/>`,
  police: `<path d="M24 4 41 10v12c0 11-7 18-17 22C14 40 7 33 7 22V10z" fill="{a}" ${S}/><path d="m24 14 2.800 6 6.500.700-4.800 4.500 1.300 6.500L24 28.500l-5.800 3.200 1.300-6.500-4.800-4.500 6.500-.700z" fill="{w}" ${S} stroke-width="1.800"/>`,
  post_office: `<rect x="5" y="11" width="38" height="27" rx="3" fill="{w}" ${S}/><path d="m5 14 19 14 19-14" fill="none" ${S}/><path d="M5 36 18 24M43 36 30 24" fill="none" ${S} stroke-width="1.800"/><circle cx="37" cy="13" r="6" fill="{a}" ${S}/>`,
  cinema: `<path d="M6 20h36v22H6z" fill="{a}" ${S}/><path d="m6 20 34-9 1.500 5.500L8 25z" fill="{w}" ${S}/><path d="m13 18 3 5M22 15.600l3 5M31 13.200l3 5" fill="none" ${S} stroke-width="2.500"/><path d="m21 26 9 5-9 5z" fill="{w}" ${S}/>`,
  zoo: `<circle cx="24" cy="27" r="14" fill="{a}" ${S}/><circle cx="10" cy="13" r="6" fill="{a}" ${S}/><circle cx="38" cy="13" r="6" fill="{a}" ${S}/><circle cx="10" cy="13" r="2.500" fill="{b}"/><circle cx="38" cy="13" r="2.500" fill="{b}"/><ellipse cx="24" cy="32" rx="7" ry="5.500" fill="{w}" ${S} stroke-width="1.800"/><circle cx="18.500" cy="23" r="1.900" fill="{o}"/><circle cx="29.500" cy="23" r="1.900" fill="{o}"/><path d="M21.500 30h5l-2.500 3z" fill="{o}"/>`,
  hotel: `<path d="M4 42V10M4 30h40v12M44 36H4" fill="none" ${S} stroke-width="3"/><path d="M20 30v-8h17a7 7 0 0 1 7 7v1z" fill="{a}" ${S}/><circle cx="12" cy="23" r="4.500" fill="{b}" ${S}/>`,
  bar: `<path d="M8 8h32L24 27z" fill="{a}" ${S}/><path d="M24 27v14M15 42h18" fill="none" ${S} stroke-width="3"/><circle cx="33" cy="9" r="4.500" fill="{b}" ${S}/><path d="M13 13h22" fill="none" stroke="{w}" stroke-width="2.200" stroke-linecap="round"/>`,
  castle: `<path d="M7 43V9h7v5h5V9h10v5h5V9h7v34z" fill="{w}" ${S}/><path d="M19 43V32a5 5 0 0 1 10 0v11z" fill="{a}" ${S}/><rect x="12" y="20" width="4.500" height="7" rx="2" fill="{b}" ${S} stroke-width="1.800"/><rect x="31.500" y="20" width="4.500" height="7" rx="2" fill="{b}" ${S} stroke-width="1.800"/>`,
  camera: `<path d="M5 15h9l3-5h14l3 5h9v24H5z" fill="{a}" ${S}/><circle cx="24" cy="26" r="8.500" fill="{w}" ${S}/><circle cx="24" cy="26" r="4" fill="{b}" ${S} stroke-width="1.800"/>`,
};

export interface IconPaint {
  outline: string;
  main: string;
  accent: string;
  light: string;
  strokeWidth: number;
}

/** SVG fragment for an icon, painted, in its native 48×48 box. */
export function iconMarkup(id: IconId, paint: IconPaint): string {
  return `<g stroke-width="{sw}">${ICONS[id] ?? ICONS.pin}</g>`
    .replaceAll('{o}', paint.outline)
    .replaceAll('{a}', paint.main)
    .replaceAll('{b}', paint.accent)
    .replaceAll('{w}', paint.light)
    .replaceAll('{sw}', String(paint.strokeWidth));
}

export function hasIcon(id: string): id is IconId {
  return id in ICONS;
}
