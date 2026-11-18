import { formatMoney } from '@maploom/core';
import { adminOverview, env } from '@maploom/server';
import { isAdmin } from '@/lib/http';
import { AdminAction, AdminLogin } from './AdminClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Maploom' };

type Row = Record<string, unknown>;
const when = (v: unknown) => (v ? new Date(v as string).toLocaleString() : '—');

function Table({ title, cols, rows, empty, actions }: { title: string; cols: string[]; rows: Row[]; empty: string; actions?: (r: Row) => React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-line px-4 py-3 text-lg font-semibold">{title} <span className="font-sans text-sm font-bold text-ink-soft">({rows.length})</span></h2>
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-sm text-ink-soft">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-cream text-[11px] tracking-wide text-ink-soft uppercase">
              <tr>{cols.map((c) => <th key={c} className="px-3 py-2 font-extrabold whitespace-nowrap">{c.replace(/_/g, ' ')}</th>)}{actions && <th />}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={String(r.id ?? i)}>
                  {cols.map((c) => (
                    <td key={c} className="max-w-[260px] truncate px-3 py-2 whitespace-nowrap">
                      {c.endsWith('_at') || c === 'day' ? when(r[c]) : c === 'total_cents' ? formatMoney(Number(r[c])) : c === 'progress' ? `${Math.round(Number(r[c]) * 100)}%` : c === 'bytes' ? `${(Number(r[c]) / 1e6).toFixed(1)} MB` : String(r[c] ?? '—')}
                    </td>
                  ))}
                  {actions && <td className="px-3 py-1.5 text-right whitespace-nowrap">{actions(r)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function AdminPage() {
  if (!env().ADMIN_TOKEN) {
    return <main className="mx-auto max-w-lg p-8"><h1 className="text-3xl font-semibold">Admin is disabled</h1><p className="mt-2 text-ink-soft">Set <code>ADMIN_TOKEN</code> (16+ characters) in the environment to enable the admin area.</p></main>;
  }
  if (!(await isAdmin())) return <AdminLogin />;
  const o = await adminOverview();
  const stats: [string, number][] = [['Saved projects', o.counts.projects], ['Jobs (24h)', o.counts.jobs_24h], ['Failed (24h)', o.counts.failed_24h], ['Exports on disk', o.counts.exports], ['Orders', o.counts.orders]];
  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Admin</h1>
        <div className="flex gap-2"><AdminAction label="Run retention sweep" body={{ action: 'purge' }} /><AdminAction label="Sign out" logout /></div>
      </div>
      <p className="text-sm text-ink-soft">Designs and addresses are encrypted and are deliberately not shown here.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map(([k, v]) => <div key={k} className="card p-4"><div className="text-[12px] font-extrabold text-ink-soft uppercase">{k}</div><div className="font-display text-3xl font-semibold">{v}</div></div>)}
      </div>
      <Table title="Failed jobs" empty="No failed jobs. 🎉" cols={['id', 'type', 'error_code', 'error_detail', 'attempts', 'finished_at']} rows={o.failed as Row[]} actions={(r) => <AdminAction label="Retry" body={{ action: 'retry-job', id: r.id }} />} />
      <Table title="Orders" empty="No orders yet." cols={['id', 'status', 'product_id', 'variant_id', 'quantity', 'total_cents', 'payment_provider', 'created_at']} rows={o.orders as Row[]} actions={(r) => (<span className="inline-flex gap-1"><AdminAction label="Approve" body={{ action: 'order-status', id: r.id, status: 'approved' }} /><AdminAction label="Reject" body={{ action: 'order-status', id: r.id, status: 'rejected' }} /><AdminAction label="Refund" body={{ action: 'order-status', id: r.id, status: 'refunded' }} /></span>)} />
      <Table title="Recent jobs (renders, exports, map data)" empty="No jobs yet." cols={['id', 'type', 'status', 'progress', 'stage', 'attempts', 'created_at', 'finished_at']} rows={o.jobs as Row[]} />
      <Table title="Exports" empty="No exports on disk." cols={['id', 'preset', 'format', 'width', 'height', 'bytes', 'created_at', 'expires_at']} rows={o.exports as Row[]} />
      <Table title="Saved projects" empty="No saved projects." cols={['id', 'name', 'style_id', 'product_id', 'variant_id', 'version', 'updated_at']} rows={o.projects as Row[]} actions={(r) => <AdminAction label="Delete" confirm="Delete this customer project permanently?" body={{ action: 'delete-project', id: r.id }} />} />
      <Table title="External API usage" empty="No calls recorded." cols={['day', 'provider', 'calls', 'errors']} rows={o.usage as Row[]} />
    </main>
  );
}
