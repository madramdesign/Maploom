import { Logo, SiteFooter } from '@/components/Brand';
import { ProjectList } from './ProjectList';

export const metadata = { title: 'My maps — Maploom' };

export default function ProjectsPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto w-full max-w-4xl px-5 py-4"><Logo /></header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pt-4 pb-16">
        <h1 className="text-4xl font-semibold">My maps</h1>
        <p className="mt-2 text-ink-soft">Maps you saved from this browser. No account needed.</p>
        <ProjectList />
      </main>
      <SiteFooter />
    </div>
  );
}
