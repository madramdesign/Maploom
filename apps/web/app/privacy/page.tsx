import Link from 'next/link';
import { Logo, SiteFooter } from '@/components/Brand';

export const metadata = { title: 'Privacy — Maploom' };

const STATIC = process.env.NEXT_PUBLIC_STATIC === '1';

/** The static demo has no Maploom server at all, so the facts are different — say so plainly. */
const DEMO_POINTS: [string, string][] = [
  ['This is a demo', 'This version runs entirely in your browser. There is no Maploom server, database or account behind it.'],
  ['What you type', 'To find a place, your browser sends your search text directly to public OpenStreetMap search services (Photon by Komoot, and Nominatim as a fallback). Those services see the text you type and your IP address, under their own policies. If you would rather not send an address, pick a sample neighborhood or search for a nearby street or town instead.'],
  ['Map data', 'Your browser downloads public map tiles for the area from OpenFreeMap. That service can see which area was requested.'],
  ['Your design', 'Designs, including saved ones, are kept in this browser’s local storage only. Nothing is uploaded. Clearing your browser data, or “Delete everything” in My maps, removes them.'],
  ['Downloads', 'Image and vector files are created in your browser and saved straight to your device.'],
  ['What we do not do', 'No advertising trackers, no analytics, no selling of data, and no public gallery of maps.'],
];

const SERVER_POINTS: [string, string][] = [
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
        <h1 className="text-4xl font-semibold">{STATIC ? 'What happens to my address?' : 'Your address stays yours'}</h1>
        <p className="mt-3 text-ink-soft">
          This page describes how the current pre-launch build behaves. It is a plain-language summary, not yet a reviewed legal privacy policy — that will replace this placeholder before launch.
        </p>
        <dl className="mt-8 space-y-4">
          {(STATIC ? DEMO_POINTS : SERVER_POINTS).map(([t, d]) => (
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
