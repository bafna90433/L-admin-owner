import { useState } from 'react';
import { Award, Medal, RefreshCw, TrendingUp, Trophy } from 'lucide-react';
import { dateLabel, number, rateLabel, today, useProductionRead } from './Production';

interface Broken {
  date: string; workerName: string; previousWorkerName: string; toyName: string; processName: string;
  rate: number; previousRate: number; improvement: number; pieces: number; hours: number; previousDate: string;
}
interface Standing {
  toyId: string; processId: string; workerName: string; toyName: string; processName: string;
  rate: number; pieces: number; hours: number; date: string; attempts: number;
}
interface BoardReport { from: string; to: string; records?: Broken[]; recordBoard?: Standing[] }

/**
 * The factory's record board: what the best rate on each job is, who holds it,
 * and which of those marks fell inside the chosen period.
 *
 * Kept apart from the ranking, which says who is doing well now. A record says
 * what the job has been proved capable of, and it stands until somebody beats
 * it.
 */
export default function RecordBoard({ token, apiBase }: { token: string | null; apiBase: string }) {
  const [days, setDays] = useState('30');
  const [to, setTo] = useState(today);
  const [refresh, setRefresh] = useState(0);
  const report = useProductionRead<BoardReport>(`${apiBase}/production/report?days=${days}&to=${to}`, token, refresh);
  const broken = report.data?.records || [];
  const board = report.data?.recordBoard || [];

  return <div className="production-page">
    <header className="production-header">
      <div><span className="production-eyebrow"><Trophy size={16} aria-hidden="true" /> Bafna Toys · Production record</span><h1>Record board</h1><p>The fastest anybody has ever worked each toy and work step, and who holds the mark.</p></div>
      <button type="button" className="production-refresh" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} aria-hidden="true" />Refresh</button>
    </header>

    <div className="production-filters production-card">
      <label>Broken during<select value={days} onChange={event => setDays(event.target.value)}><option value="1">Single day</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
      <label>{days === '1' ? 'Date' : 'Period ending'}<input type="date" value={to} max={today()} onChange={event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) setTo(event.target.value); }} /></label>
      <div className="production-sync" role="status" aria-live="polite">{report.busy ? 'Updating…' : report.updatedAt ? `Updated ${report.updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Unavailable'}<span>The board below is all-time, whatever period is chosen</span></div>
    </div>

    {report.error && <p className="production-error" role="alert">{report.error} Use Refresh to retry.</p>}
    <p className="production-explanation">A record needs at least an hour of work behind it, so a short burst cannot take one, and the first time a job is ever done sets the mark rather than breaking one. Training work never counts.</p>

    {report.data && <>
      <section className="production-card production-records-broken">
        <div className="production-section-heading"><div><h2>Broken in this period</h2><p>{broken.length ? 'Each of these passed a mark that had stood until then.' : 'Nothing was beaten in the chosen period.'}</p></div><Medal size={22} aria-hidden="true" /></div>
        {broken.length ? <ol className="production-break-list">{broken.map(row => <li key={`${row.date}-${row.workerName}-${row.processName}`}>
          <span className="production-break-badge"><Trophy size={13} aria-hidden="true" />New record</span>
          <div className="production-break-head"><span className="production-break-icon" aria-hidden="true"><Award size={20} /></span><div><strong>{row.workerName}</strong><small>{row.toyName} — {row.processName}</small></div><span className="production-break-date">{dateLabel(row.date)}</span></div>
          <div className="production-break-rates">
            <b>{rateLabel(row.rate)}<small>pcs/hour</small></b>
            <span>beat {row.previousWorkerName}&rsquo;s {rateLabel(row.previousRate)} from {dateLabel(row.previousDate)}</span>
            <em><TrendingUp size={13} aria-hidden="true" />+{number(row.improvement)}%</em>
          </div>
          <small className="production-break-work">{number(row.pieces)} pcs in {number(row.hours)} hr</small>
        </li>)}</ol> : <p className="production-empty">Choose a longer period to look further back.</p>}
      </section>

      <section className="production-card">
        <div className="production-section-heading"><div><h2>Standing records<em>{board.length}</em></h2><p>The mark to beat on every job, fastest first.</p></div><Trophy size={22} aria-hidden="true" /></div>
        {board.length ? <div className="production-table-wrap" tabIndex={0} role="region" aria-label="Standing records"><table>
          <thead><tr>{['Rank & toy', 'Work step', 'Record', 'Held by', 'Set on', 'That day', 'Days tried'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{board.map((row, index) => <tr key={`${row.toyId}-${row.processId}`}>
            <th scope="row"><span className={`production-rank-badge rank-${index < 3 ? index + 1 : 'plain'}`}>{index < 3 ? <Medal size={13} aria-hidden="true" /> : null}{index + 1}</span>{row.toyName}</th>
            <td>{row.processName}</td>
            <td><strong>{rateLabel(row.rate)}</strong> pcs/hr</td>
            <td>{row.workerName}</td>
            <td>{dateLabel(row.date)}</td>
            <td>{number(row.pieces)} pcs in {number(row.hours)} hr</td>
            <td>{row.attempts}</td>
          </tr>)}</tbody>
        </table></div> : <p className="production-empty">No job has an hour of recorded work behind it yet, so there is nothing to beat.</p>}
      </section>
    </>}
  </div>;
}
