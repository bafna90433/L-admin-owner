import { useMemo, useState } from 'react';
import { Award, Medal, RefreshCw, TrendingUp, Trophy } from 'lucide-react';
import { dateLabel, number, today, useProductionRead } from './Production';
import { dailyRecords, type DailyEntry } from '../daily-records';

interface Broken {
  toyId: string; processId: string;
  date: string; workerName: string; previousWorkerName: string; toyName: string; categoryName: string; processName: string;
  competitorName?: string; competitorPieces?: number; competitorDate?: string;
  previousPieces: number; improvement: number; pieces: number; hours: number; previousDate: string;
}
interface Standing {
  toyId: string; processId: string; workerName: string; toyName: string; categoryName: string; processName: string;
  pieces: number; hours: number; date: string; attempts: number;
}
interface BoardReport { from: string; to: string; entries?: DailyEntry[]; dailyRecordsBroken?: Broken[]; dailyRecordBoard?: Standing[] }
interface TargetMasters { processes: { id: string; targetPerHour?: number; target8h?: number; target12h?: number }[] }

/**
 * The factory's record board: the highest daily quantity on each job, who holds it,
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
  const masters = useProductionRead<TargetMasters>(`${apiBase}/production/masters`, token, refresh);
  const targets = useMemo(() => new Map((masters.data?.processes || []).map(step => [step.id, step.targetPerHour || (step.target8h ? step.target8h / 8 : step.target12h ? step.target12h / 12 : 0)])), [masters.data]);
  const needsHistory = !!report.data && !report.data.dailyRecordBoard;
  const history = useProductionRead<BoardReport>(needsHistory ? `${apiBase}/production/report?days=3660&to=${to}` : `${apiBase}/production/report?days=${days}&to=${to}`, token, refresh);
  const fallback = useMemo(() => dailyRecords(history.data?.entries || []), [history.data]);
  const ready = !!report.data && (!needsHistory || !!history.data);
  const board = report.data?.dailyRecordBoard ?? fallback.board;
  const broken = (report.data?.dailyRecordsBroken ?? fallback.broken).filter(row => row.date >= (report.data?.from || to) && board.some(best => best.date === row.date && best.workerName === row.workerName && best.toyId === row.toyId && best.processId === row.processId && best.pieces === row.pieces));


  return <div className="production-page">
    <header className="production-header">
      <div><span className="production-eyebrow"><Trophy size={16} aria-hidden="true" /> Bafna Toys · Production record</span><h1>Record board</h1><p>The highest daily production for each category, toy and work step, and the worker who holds it.</p></div>
      <button type="button" className="production-refresh" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} aria-hidden="true" />Refresh</button>
    </header>

    <div className="production-filters production-card">
      <label>Broken during<select value={days} onChange={event => setDays(event.target.value)}><option value="1">Single day</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
      <label>{days === '1' ? 'Date' : 'Period ending'}<input type="date" value={to} max={today()} onChange={event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) setTo(event.target.value); }} /></label>
      <div className="production-sync" role="status" aria-live="polite">{report.busy ? 'Updating…' : report.updatedAt ? `Updated ${report.updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Unavailable'}<span>Best daily records through the period ending date</span></div>
    </div>

    {report.error && <p className="production-error" role="alert">{report.error} Use Refresh to retry.</p>}
    {masters.error && <p className="production-error" role="alert">{masters.error} Target pcs could not be updated. Use Refresh to retry.</p>}
    <p className="production-explanation">Each job has one current record holder. All saves for the same worker, date, toy and work step are added together. A higher daily pcs total replaces the previous record, including when the same worker improves it. Equal totals keep the first holder. Training is excluded.</p>

    {needsHistory && history.error && <p className="production-error" role="alert">{history.error} Use Refresh to retry.</p>}
    {needsHistory && !history.data && <p role="status">Loading daily record history…</p>}
    {needsHistory && <p className="production-explanation">Records cover the last 3,660 days through the ending date.</p>}
    {ready && <>
      <section className="production-card production-records-broken">
        <div className="production-section-heading"><div><h2>Current records improved in this period</h2><p>{broken.length ? 'These are the latest standing records that improved during this period.' : 'Nothing was beaten in the chosen period.'}</p></div><Medal size={22} aria-hidden="true" /></div>
        {broken.length ? <ol className="production-break-list">{broken.map(row => <li key={`${row.date}-${row.workerName}-${row.processName}`}>
          <span className="production-break-badge"><Trophy size={13} aria-hidden="true" />New record</span>
          <div className="production-break-head"><span className="production-break-icon" aria-hidden="true"><Award size={20} /></span><div><strong>{row.workerName}</strong><small>{row.categoryName} · {row.toyName} — {row.processName}</small></div><span className="production-break-date">{dateLabel(row.date)}</span></div>
          <div className="production-break-rates">
            <b>{number(row.pieces)}<small>pcs/day</small></b>
            <span>{row.competitorName && row.competitorDate ? <>beat {row.competitorName}&rsquo;s {number(row.competitorPieces || 0)} pcs from {dateLabel(row.competitorDate)}</> : row.previousWorkerName !== row.workerName ? <>beat {row.previousWorkerName}&rsquo;s {number(row.previousPieces)} pcs from {dateLabel(row.previousDate)}</> : <>Previous best: {number(row.previousPieces)} pcs from {dateLabel(row.previousDate)}</>}</span>
            <em><TrendingUp size={13} aria-hidden="true" />+{number(row.competitorPieces ? Math.round((row.pieces / row.competitorPieces - 1) * 100) : row.improvement)}%</em>
          </div>
          <small className="production-break-work">{number(row.pieces)} pcs in {number(row.hours)} hr</small>
        </li>)}</ol> : <p className="production-empty">Choose a longer period to look further back.</p>}
      </section>

      <section className="production-card">
        <div className="production-section-heading"><div><h2>Standing records<em>{board.length}</em></h2><p>One best daily total per job, highest pcs first. A newer higher total replaces the old record.</p></div><Trophy size={22} aria-hidden="true" /></div>
        {board.length ? <div className="production-table-wrap" tabIndex={0} role="region" aria-label="Standing records"><table>
          <thead><tr>{['Rank & worker', 'Category', 'Toy / model', 'Work step', 'Best daily pcs', 'Target pcs', 'Set on', 'Work time', 'Days tried'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{board.map((row, index) => <tr key={`${row.toyId}-${row.processId}`}>
            <th scope="row"><span className={`production-rank-badge rank-${index < 3 ? index + 1 : 'plain'}`}>{index < 3 ? <Medal size={13} aria-hidden="true" /> : null}{index + 1}</span>{row.workerName || 'Archived worker'}</th>
            <td>{row.categoryName}</td>
            <td>{row.toyName}</td>
            <td>{row.processName}</td>
            <td><strong>{number(row.pieces)}</strong> pcs</td>
            <td title="Current work-step target for the recorded work time">{targets.get(row.processId) ? `${number(Math.round(targets.get(row.processId)! * row.hours))} pcs` : masters.busy && !masters.data ? 'Loading…' : masters.error && !masters.data ? 'Unavailable' : 'Not set'}</td>
            <td>{dateLabel(row.date)}</td>
            <td>{number(row.hours)} hr</td>
            <td>{row.attempts}</td>
          </tr>)}</tbody>
        </table></div> : <p className="production-empty">No regular production records yet.</p>}
      </section>
    </>}
  </div>;
}
