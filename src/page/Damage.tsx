import { useMemo, useState } from 'react';
import { AlertTriangle, PackageX, RefreshCw } from 'lucide-react';
import { dateLabel, number, today, useProductionRead } from './Production';

interface DamageRow { id: string; date: string; toyName: string; partName: string; qty: number; enteredByName: string; createdAt: string }
interface DamageView { from: string; to: string; entries: DamageRow[]; total: number; toyNames: string[]; partNames: string[] }

const shiftDay = (key: string, days: number) => new Date(new Date(`${key}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

/**
 * Broken pieces, logged from the app against a typed toy and part.
 *
 * Damage carries no worker and no work step on purpose: a broken part turns up
 * in a box long after the shift that made it, and pinning it on whoever was on
 * the line that day would be a guess. So it is reported on its own, and never
 * mixed into anybody's output.
 */
export default function Damage({ token, apiBase }: { token: string | null; apiBase: string }) {
  const [from, setFrom] = useState(() => shiftDay(today(), -29));
  const [to, setTo] = useState(today);
  const [refresh, setRefresh] = useState(0);
  const damage = useProductionRead<DamageView>(`${apiBase}/production/damage?from=${from}&to=${to}`, token, refresh);

  const entries = damage.data?.entries || [];
  const byPart = useMemo(() => {
    const rows = new Map<string, { label: string; qty: number; records: number }>();
    for (const row of entries) {
      const label = `${row.toyName} — ${row.partName}`;
      const found = rows.get(label) || { label, qty: 0, records: 0 };
      found.qty += row.qty;
      found.records += 1;
      rows.set(label, found);
    }
    return [...rows.values()].sort((a, b) => b.qty - a.qty);
  }, [entries]);
  const worst = Math.max(1, ...byPart.map(row => row.qty));

  return <div className="production-page">
    <header className="production-header">
      <div><span className="production-eyebrow"><PackageX size={16} aria-hidden="true" /> Owner overview · Read only</span><h1>Damage pcs</h1><p>Broken pieces logged from the app. Counted on their own, never mixed into production or a worker&rsquo;s figures.</p></div>
      <button type="button" className="production-refresh" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} aria-hidden="true" />Refresh</button>
    </header>

    <div className="production-filters production-card">
      <label>From<input type="date" value={from} max={to} onChange={event => { if (event.target.value) setFrom(event.target.value); }} /></label>
      <label>To<input type="date" value={to} max={today()} onChange={event => { if (event.target.value) setTo(event.target.value); }} /></label>
      <div className="production-sync" role="status" aria-live="polite">{damage.busy ? 'Updating…' : damage.updatedAt ? `Updated ${damage.updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Unavailable'}<span>Logged by the supervisor in the app</span></div>
    </div>

    {damage.error && <p className="production-error" role="alert">{damage.error} Use Refresh to retry.</p>}

    {damage.data && <>
      <div className="production-metrics">
        <div className="production-card production-metric"><PackageX size={20} aria-hidden="true" /><span>Damaged pcs</span><strong>{number(damage.data.total)}</strong></div>
        <div className="production-card production-metric"><span>Parts affected</span><strong>{byPart.length}</strong></div>
        <div className="production-card production-metric"><AlertTriangle size={20} aria-hidden="true" /><span>Worst single part</span><strong>{byPart.length ? number(byPart[0].qty) : 0}</strong></div>
      </div>

      <section className="production-card">
        <div className="production-section-heading"><div><h2>Most damaged<em>{byPart.length}</em></h2><p>Toy and part counted together, worst first. This is where a mould or a machine is usually at fault.</p></div><PackageX size={22} aria-hidden="true" /></div>
        {byPart.length ? <ul className="damage-bars">{byPart.map(row => <li key={row.label}>
          <div className="damage-bar-head"><strong>{row.label}</strong><b>{number(row.qty)} pcs</b></div>
          <div className="damage-bar-track"><span style={{ width: `${Math.max(2, row.qty / worst * 100)}%` }} /></div>
          <small>{row.records} {row.records === 1 ? 'record' : 'records'}</small>
        </li>)}</ul> : <p className="production-empty">No damage recorded in this range.</p>}
      </section>

      <section className="production-card">
        <h2>Every record<em>{entries.length}</em></h2>
        {entries.length ? <div className="production-table-wrap" tabIndex={0} role="region" aria-label="Damage records"><table>
          <thead><tr>{['Date', 'Toy name', 'Damage part', 'Qty', 'Entry by'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{entries.map(row => <tr key={row.id}>
            <td>{dateLabel(row.date)}</td>
            <th scope="row">{row.toyName}</th>
            <td>{row.partName}</td>
            <td><strong>{number(row.qty)}</strong></td>
            <td>{row.enteredByName || 'Not recorded'}</td>
          </tr>)}</tbody>
        </table></div> : <p className="production-empty">Nothing logged in this range.</p>}
      </section>
    </>}
  </div>;
}
