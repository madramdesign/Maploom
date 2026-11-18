import Link from 'next/link';
import { PRODUCTS, formatMoney } from '@maploom/core';
import { STYLE_LIST } from '@maploom/render';
import { Logo, SiteFooter } from '@/components/Brand';

const STEPS = [
  { n: '1', title: 'Tell us where', body: 'A home address, a town, grandma’s street, the place you met — anywhere that matters.' },
  { n: '2', title: 'We draw it', body: 'Real streets, parks and water from OpenStreetMap become an illustration, and we pick out the landmarks worth showing.' },
  { n: '3', title: 'Make it yours', body: 'Add names and special places, move things around, choose a style. Then download it or have it made.' },
];

export default function Landing() {
  const fromPrice = Math.min(...PRODUCTS.flatMap((p) => p.variants.map((v) => v.priceCents)));
  return (
    <div className="min-h-full">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/projects" className="btn-ghost hidden sm:inline-flex">My maps</Link>
          <Link href="/create" className="btn-secondary">Create your map</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pt-6 pb-16 md:grid-cols-[1.05fr_1fr] md:pt-12 md:pb-24">
          <div className="rise">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-[13px] font-extrabold text-ink-soft">
              <span className="h-2 w-2 rounded-full bg-leaf" /> Made from your real streets
            </p>
            <h1 className="text-[42px] leading-[1.05] font-semibold text-ink sm:text-6xl">
              Turn your neighborhood into a <span className="text-coral">one-of-a-kind</span> map
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              Type in an address and watch your streets, parks and favourite places become illustrated artwork — for a nursery wall, a housewarming gift, or a play mat of the roads they actually live on.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/create" className="btn-primary px-7 text-[17px]" data-testid="cta">
                Create your map
              </Link>
              <span className="text-sm font-semibold text-ink-soft">Free to design · no account needed · from {formatMoney(fromPrice)}</span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[460px] rise">
            <div className="absolute -bottom-6 -left-4 z-10 w-[40%] -rotate-6 sm:-left-8 overflow-hidden rounded-xl border-2 border-ink bg-white shadow-card">
              <img src="/styles/hero-watercolor.svg" alt="" width={300} height={400} className="block h-auto w-full" />
            </div>
            <div className="-rotate-2 overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-[0_18px_40px_-18px_rgba(47,52,71,.55)]">
              <img src="/styles/hero-playful.svg" alt="An illustrated map of a real neighborhood, titled “Emma’s Neighborhood”" width={750} height={1000} className="block h-auto w-full" />
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-cream">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sun font-display text-xl font-semibold">{s.n}</div>
                <div>
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="mt-1 leading-relaxed text-ink-soft">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-3xl font-semibold sm:text-4xl">Six looks, one neighborhood</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">Every style is drawn from the same real map data, so you can switch at any time without losing your changes.</p>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
            {STYLE_LIST.map((s) => (
              <figure key={s.id} className="card overflow-hidden">
                <img src={`/styles/${s.id}.svg`} alt={`${s.name} style sample`} loading="lazy" width={400} height={500} className="block aspect-[4/5] w-full object-cover" />
                <figcaption className="px-4 py-3">
                  <div className="font-display text-lg font-semibold">{s.name}</div>
                  <div className="text-sm text-ink-soft">{s.tagline}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="border-t border-line bg-cream">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-3xl font-semibold sm:text-4xl">One design, many keepsakes</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {PRODUCTS.map((p) => (
                <div key={p.id} className="card p-5">
                  <div className="font-display text-lg font-semibold">{p.name}</div>
                  <p className="mt-1 min-h-12 text-sm text-ink-soft">{p.tagline}</p>
                  <div className="mt-3 text-sm font-extrabold">
                    {p.orderable ? `from ${formatMoney(Math.min(...p.variants.map((v) => v.priceCents)))}` : <span className="rounded-full bg-sun px-2 py-0.5">Coming soon</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-12 flex flex-col items-start gap-5 rounded-2xl border-2 border-ink bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <h3 className="text-2xl font-semibold">Your address stays yours</h3>
                <p className="mt-1 max-w-2xl text-ink-soft">
                  We look up the place you type, and that’s it. Nothing is stored on our servers unless you press Save, addresses never appear in links, and you can delete everything in one click.{' '}
                  <Link href="/privacy" className="font-bold text-ink underline">How we handle your data</Link>
                </p>
              </div>
              <Link href="/create" className="btn-primary shrink-0">Start designing</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
