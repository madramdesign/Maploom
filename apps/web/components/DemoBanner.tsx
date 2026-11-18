import Link from 'next/link';

/** Shown only in the static demo build, so visitors know exactly what this version is. */
export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_STATIC !== '1') return null;
  return (
    <div className="bg-ink px-4 py-1.5 text-center text-[12.5px] font-bold text-white" data-testid="demo-banner">
      Demo — runs entirely in your browser. Ordering and full-size print files are not available here.{' '}
      <Link href="/privacy" className="underline">What happens to my address?</Link>
    </div>
  );
}
