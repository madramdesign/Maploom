'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  // Never render error.message: it may contain internals.
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-8 text-center">
      <h1 className="text-4xl font-semibold">We took a wrong turn</h1>
      <p className="mt-2 text-ink-soft">Something went wrong on our side. Your design is safe on this device.</p>
      <button className="btn-primary mt-6" onClick={reset}>Try again</button>
    </main>
  );
}
