import Link from 'next/link';
import { Logo, SiteFooter } from '@/components/Brand';

export const metadata = { title: 'Privacy — Maploom' };

const POINTS: [string, string][] = [
  ['What you type', 'Address searches are sent to our server, forwarded to an OpenStreetMap-based geocoder, and answered. They are not written to our database or our logs. Full addresses are sent in the request body, never in a link.'],
  ['While you design', 'Your design lives in this browser (local storage) so a refresh does not lose your work. To draw the map our server fetches public map tiles for the area and keeps a temporary, anonymous copy of that map data.'],
  ['When you press Save', 'Only then is your design stored on our servers. The design and the place name are encrypted at rest. Saved maps are tied to an anonymous cookie in this browser — no account or email is required.'],
  ['Downloads', 'Files you export are kept for 24 hours behind a signed, expiring link, then deleted.'],
  ['Deleting', 'Delete any saved map from “My maps”, or use “Delete everything” there to remove all saved maps, exports and the cookie in one step.'],
  ['What we do not do', 'No advertising trackers, no selling of data, no addresses in analytics, and no public gallery of customer maps.'],
];

export default function Privacy() {
  return (
    <div className="min-h-full">
      <header className="mx-auto max-w-3xl px-5 py-4"><Logo /></header>
      <main className="mx-auto max-w-3xl px-5 pt-6 pb-20">
        <h1 className="text-4xl font-semibold">Your address stays yours</h1>
        <p className="mt-3 text-ink-soft">
          This page describes how the current pre-launch build behaves. It is a plain-language summary, not yet a reviewed legal privacy policy — that will replace this placeholder before launch.
        </p>
        <dl className="mt-8 space-y-4">
          {POINTS.map(([t, d]) => (
            <div key={t} className="card p-5">
              <dt className="font-display text-xl font-semibold">{t}</dt>
              <dd className="mt-1 leading-relaxed text-ink-soft">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-sm text-ink-soft">
          Map data © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>, available under the Open Database License. Tiles by OpenFreeMap / OpenMapTiles.
        </p>
        <Link href="/create" className="btn-primary mt-8">Create your map</Link>
      </main>
      <SiteFooter />
    </div>
  );
}
