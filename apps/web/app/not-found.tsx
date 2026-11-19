import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-8 text-center">
      <h1 className="text-4xl font-semibold">This street doesn’t exist</h1>
      <p className="mt-2 text-ink-soft">We couldn’t find that page.</p>
      <Link href="/" className="btn-primary mt-6">Back home</Link>
    </main>
  );
}
