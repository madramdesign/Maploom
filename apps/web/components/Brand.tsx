import Link from 'next/link';

/** Temporary working identity — see docs/DECISIONS.md (D-012). */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-display text-[22px] font-semibold text-ink ${className}`} aria-label="Maploom home">
      <svg width="30" height="30" viewBox="0 0 48 48" aria-hidden>
        <rect x="3" y="3" width="42" height="42" rx="12" fill="#DDEFB4" stroke="#2F3447" strokeWidth="3" />
        <path d="M3 30c10-8 16 6 24-2s10-10 18-8" fill="none" stroke="#59607A" strokeWidth="7" strokeLinecap="round" />
        <path d="M3 30c10-8 16 6 24-2s10-10 18-8" fill="none" stroke="#fff" strokeWidth="1.4" strokeDasharray="3 3.4" />
        <path d="M24 26s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z" fill="#FF5A5F" stroke="#2F3447" strokeWidth="2.4" strokeLinejoin="round" />
        <circle cx="24" cy="14" r="2.6" fill="#fff" />
      </svg>
      Maploom
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Logo className="text-lg" />
          <span>Working title · pre-launch preview</span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
          <Link href="/create" className="hover:text-ink">Create a map</Link>
          <Link href="/projects" className="hover:text-ink">My maps</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:text-ink">
            Map data © OpenStreetMap contributors
          </a>
        </nav>
      </div>
    </footer>
  );
}
