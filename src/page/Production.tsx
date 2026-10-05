import { useEffect, useId, useState } from 'react';
import { Activity, AlertTriangle, Clock, Factory, History, RefreshCw, Users } from 'lucide-react';
import '../styles/Production.css';

interface ProductionEntry {
  id: string; date?: string; workerName: string; toyName: string; processName: string;
  minutes: number; pieces: number; enteredByName: string; note: string;
}
interface ProductionWorker {
  id: string; name: string; pieces: number; hours: number; perHour: number;
  daysWorked: number; loggedPercent: number | null;
}
interface ProductionFlag {
  date: string; workerId: string; workerName: string; toyName?: string; processName?: string;
  rate: number; usualRate: number; drop: number; baselineDate?: string; baselineDays?: number;
}
interface ProductionTrend { date: string; pieces: number; hours: number; perHour: number; workers: number }
interface ProductionReport {
  from: string; to: string;
  totals: { pieces: number; hours: number; perHour: number; entries: number; workers: number };
  trend: ProductionTrend[]; workers: ProductionWorker[]; flags: ProductionFlag[];
  entries?: ProductionEntry[];
}
interface ProductionDay {
  entries: ProductionEntry[];
  workers: { id: string; name: string; status: string; inTime: string; outTime: string; availableMinutes: number; workedMinutes: number; note: string }[];
}
interface ProductionHistory { history: { id: string; action: string; summary: string; byName: string; at: string }[] }

const number = (value: number) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Each resource refreshes independently, so an audit failure does not hide production.
function useProductionRead<T>(url: string, token: string | null, refresh: number) {
  const key = `${url}|${refresh}`;
  const [snapshot, setSnapshot] = useState<{ key: string; token: string | null; data: T | null; error: string; busy: boolean; updatedAt: Date | null }>({ key, token, data: null, error: '', busy: true, updatedAt: null });
  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    const read = async () => {
      controller?.abort();
      controller = new AbortController();
      const request = controller;
      await Promise.resolve();
      if (disposed || request.signal.aborted) return;
      setSnapshot(previous => previous.key === key && previous.token === token ? { ...previous, busy: true } : { key, token, data: null, error: '', busy: true, updatedAt: null });
      try {
        if (!token) throw new Error('Please sign in to view production.');
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: request.signal });
        if (!response.ok) throw new Error(response.status === 401 ? 'Your session has expired. Please sign in again.' : response.status === 403 ? 'Production access is not available for this account.' : `Could not load production (HTTP ${response.status}).`);
        const body = await response.json() as T;
        if (!disposed && !request.signal.aborted) setSnapshot({ key, token, data: body, error: '', busy: false, updatedAt: new Date() });
      } catch (reason) {
        if (!disposed && !request.signal.aborted) setSnapshot(previous => ({ ...previous, error: reason instanceof Error ? reason.message : 'Could not load production.', busy: false }));
      }
    };
    void read();
    const interval = window.setInterval(() => { if (!document.hidden) void read(); }, 30000);
    const onFocus = () => { void read(); };
    const onVisible = () => { if (!document.hidden) void read(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true; controller?.abort(); window.clearInterval(interval);
      window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisible);
    };
  }, [url, token, key]);
  return snapshot.key === key && snapshot.token === token ? snapshot : { data: null, error: '', busy: true, updatedAt: null };
}

function TrendChart({ rows, metric, title }: { rows: ProductionTrend[]; metric: 'pieces' | 'perHour'; title: string }) {
  const id = useId();
  const max = Math.max(1, ...rows.map(row => row[metric]));
  const x = (index: number) => 52 + index * 544 / Math.max(1, rows.length - 1);
  const y = (value: number) => 170 - value * 142 / max;
  const points = rows.map((row, index) => `${x(index)},${y(row[metric])}`).join(' ');
  return <section className="production-card">
    <h2>{title}</h2>
    <p>{metric === 'pieces' ? 'Recorded output across work steps' : 'Process pcs divided by recorded hours'}</p>
    {rows.length ? <>
      <svg className="production-chart" viewBox="0 0 620 216" role="img" aria-labelledby={id}>
        <title id={id}>{title}. {dateLabel(rows[0].date)} to {dateLabel(rows[rows.length - 1].date)}. Maximum {number(max)}.</title>
        {[0, 0.5, 1].map(fraction => <g key={fraction}>
          <line x1="52" x2="596" y1={y(max * fraction)} y2={y(max * fraction)} className="production-gridline" />
          <text x="44" y={y(max * fraction) + 4} textAnchor="end">{number(max * fraction)}</text>
        </g>)}
        <polyline points={points} className={`production-line ${metric === 'perHour' ? 'production-line-rate' : ''}`} />
        {rows.map((row, index) => <circle key={row.date} cx={x(index)} cy={y(row[metric])} r={rows.length > 35 ? 2 : 3} className={metric === 'pieces' ? 'production-dot' : 'production-dot-rate'}>
          <title>{dateLabel(row.date)}: {number(row[metric])} {metric === 'pieces' ? 'process pcs' : 'pcs/hour'}</title>
        </circle>)}
        <text x="52" y="199">{dateLabel(rows[0].date)}</text>
        <text x="596" y="199" textAnchor="end">{dateLabel(rows[rows.length - 1].date)}</text>
      </svg>
      <details className="production-chart-data"><summary>View daily chart data</summary><div className="production-table-wrap" tabIndex={0} role="region" aria-label={`${title} data`}><table>
        <thead><tr><th scope="col">Date</th><th scope="col">Process pcs</th><th scope="col">Hours</th><th scope="col">Pcs/hour</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.date}><td>{dateLabel(row.date)}</td><td>{number(row.pieces)}</td><td>{number(row.hours)}</td><td>{number(row.perHour)}</td></tr>)}</tbody>
      </table></div></details>
    </> : <p className="production-empty">No recorded production in this period.</p>}
  </section>;
}

function EntryTable({ entries }: { entries: ProductionEntry[] }) {
  return entries.length ? <div className="production-table-wrap" tabIndex={0} role="region" aria-label="Production records, scroll for all columns"><table>
    <thead><tr>{['Date', 'Worker', 'Toy', 'Work step', 'Hours', 'Process pcs', 'Pcs/hour', 'Entry by', 'Note'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
    <tbody>{entries.map(entry => <tr key={entry.id}>
      <td>{entry.date ? dateLabel(entry.date) : '—'}</td><th scope="row">{entry.workerName || 'Archived worker'}</th>
      <td>{entry.toyName || '—'}</td><td>{entry.processName || '—'}</td><td>{number(entry.minutes / 60)}</td>
      <td>{number(entry.pieces)}</td><td>{number(entry.minutes > 0 ? entry.pieces * 60 / entry.minutes : 0)}</td>
      <td>{entry.enteredByName || 'Not recorded'}</td><td className="production-note">{entry.note || '—'}</td>
    </tr>)}</tbody>
  </table></div> : <p className="production-empty">No production records for this selection.</p>;
}

export default function Production({ token, apiBase }: { token: string | null; apiBase: string }) {
  const [days, setDays] = useState('30');
  const [to, setTo] = useState(today);
  const [date, setDate] = useState(today);
  const [recordScope, setRecordScope] = useState('day');
  const [refresh, setRefresh] = useState(0);
  const report = useProductionRead<ProductionReport>(`${apiBase}/production/report?days=${days}&to=${to}`, token, refresh);
  const day = useProductionRead<ProductionDay>(`${apiBase}/production/day?date=${date}`, token, refresh);
  const history = useProductionRead<ProductionHistory>(`${apiBase}/production/history?limit=200`, token, refresh);
  const records = recordScope === 'day' ? day : report;
  const entries = recordScope === 'day' ? (day.data?.entries || []).map(entry => ({ ...entry, date: entry.date || date })) : report.data?.entries || [];
  const dateChange = (value: string, setter: (date: string) => void) => { if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setter(value); };
  return <div className="production-page">
    <header className="production-header">
      <div><span className="production-eyebrow"><Factory size={16} aria-hidden="true" /> Owner overview · Read only</span><h1>Production</h1><p>Output, worker performance and the record of every change.</p></div>
      <button type="button" className="production-refresh" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} aria-hidden="true" />Refresh</button>
    </header>
    <div className="production-filters production-card">
      <label>Report period<select value={days} onChange={event => setDays(event.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
      <label>Period ending<input type="date" value={to} onChange={event => dateChange(event.target.value, setTo)} /></label>
      <div className="production-sync" role="status" aria-live="polite">{report.busy ? 'Updating report…' : report.updatedAt ? `Updated ${report.updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Report unavailable'}<span>Refreshes every 30 seconds and on focus</span></div>
    </div>
    <p className="production-explanation">All quantities are <strong>process pieces</strong>. A toy can pass through multiple work steps; these totals do not count finished toys.</p>
    {report.error && <p className="production-error" role="alert">{report.error} {report.data && 'Showing the last successful report; it may be out of date.'} Use Refresh to retry.</p>}
    {report.data && <>
      <div className="production-period">{dateLabel(report.data.from)} — {dateLabel(report.data.to)}</div>
      <div className="production-metrics">
        {[
          { label: 'Process pcs', value: report.data.totals.pieces, Icon: Factory },
          { label: 'Recorded hours', value: report.data.totals.hours, Icon: Clock },
          { label: 'Process pcs/hour', value: report.data.totals.perHour, Icon: Activity },
          { label: 'Workers with records', value: report.data.totals.workers, Icon: Users }
        ].map(({ label, value, Icon }) => <div className="production-card production-metric" key={label}><Icon size={20} aria-hidden="true" /><span>{label}</span><strong>{number(value)}</strong></div>)}
      </div>
      <div className="production-charts"><TrendChart rows={report.data.trend} metric="pieces" title="Daily process output" /><TrendChart rows={report.data.trend} metric="perHour" title="Daily output per hour" /></div>
      <section className="production-card">
        <div className="production-section-heading"><div><h2>Performance flags</h2><p>Lower output per hour versus the weighted rate across earlier days for the same worker, toy and work step. Review the context with the supervisor.</p></div><AlertTriangle size={22} aria-hidden="true" /></div>
        {report.data.flags.length ? <div className="production-flags">{report.data.flags.map((flag, index) => <article className="production-flag" key={`${flag.date}-${flag.workerId}-${index}`}>
          <div><strong>{flag.workerName || 'Archived worker'}</strong><span>{dateLabel(flag.date)}</span></div>
          <p>{flag.toyName || 'Toy not recorded'} · {flag.processName || 'Work step not recorded'}</p>
          <div className="production-flag-rates"><strong>{number(flag.drop)}% below baseline</strong><span>{number(flag.rate)} pcs/hour · prior {number(flag.usualRate)} pcs/hour</span></div>
          {flag.baselineDate && <small>Baseline through {dateLabel(flag.baselineDate)}</small>}
          {flag.baselineDays != null && <small>Compared with {flag.baselineDays} prior comparable {flag.baselineDays === 1 ? 'day' : 'days'}</small>}
        </article>)}</div> : <p className="production-empty">No performance flags in this period. Flags require prior comparable work records.</p>}
      </section>
      <section className="production-card"><h2>Worker performance</h2><p>Rates span recorded work steps and can vary with the task mix. Time coverage is recorded production time as a share of available attendance time.</p>
        {report.data.workers.length ? <div className="production-table-wrap" tabIndex={0} role="region" aria-label="Worker performance"><table>
          <thead><tr>{['Worker', 'Process pcs', 'Hours', 'Pcs/hour', 'Days recorded', 'Time coverage'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{report.data.workers.map(worker => <tr key={worker.id}><th scope="row">{worker.name || 'Archived worker'}</th><td>{number(worker.pieces)}</td><td>{number(worker.hours)}</td><td>{number(worker.perHour)}</td><td>{worker.daysWorked}</td><td>{worker.loggedPercent === null ? 'Not available' : `${number(worker.loggedPercent)}%`}</td></tr>)}</tbody>
        </table></div> : <p className="production-empty">No workers with production records in this period.</p>}
      </section>
    </>}
    <section className="production-card">
      <div className="production-section-heading"><div><h2>Production records</h2><p>Every recorded work step, including the authenticated person who entered it.</p></div><span className="production-count">{entries.length} records</span></div>
      <div className="production-record-filters"><label>Show records<select value={recordScope} onChange={event => setRecordScope(event.target.value)}><option value="day">Selected day</option><option value="period">Report period</option></select></label>{recordScope === 'day' && <label>Record date<input type="date" value={date} onChange={event => dateChange(event.target.value, setDate)} /></label>}</div>
      {records.error && <p className="production-error" role="alert">{records.error} {records.data && 'Records may be out of date.'} Use Refresh to retry.</p>}
      {records.busy && !records.data ? <p className="production-empty" role="status">Loading records…</p> : <EntryTable entries={entries} />}
      {recordScope === 'day' && day.data && <details className="production-attendance"><summary>Attendance and time coverage · {dateLabel(date)}</summary><div className="production-table-wrap" tabIndex={0} role="region" aria-label="Daily attendance"><table><thead><tr>{['Worker', 'Status', 'In', 'Out', 'Available hours', 'Recorded hours', 'Note'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{day.data.workers.map(worker => <tr key={worker.id}><th scope="row">{worker.name}</th><td>{worker.status.replaceAll('_', ' ')}</td><td>{worker.inTime || '—'}</td><td>{worker.outTime || '—'}</td><td>{number(worker.availableMinutes / 60)}</td><td>{number(worker.workedMinutes / 60)}</td><td className="production-note">{worker.note || '—'}</td></tr>)}</tbody></table></div></details>}
    </section>
    <section className="production-card">
      <div className="production-section-heading"><div><h2>Audit history</h2><p>Latest 200 changes across production, attendance and catalogue, independent of the report filters.</p></div><History size={22} aria-hidden="true" /></div>
      {history.error && <p className="production-error" role="alert">{history.error} {history.data && 'History may be out of date.'} Use Refresh to retry.</p>}
      {history.busy && !history.data ? <p className="production-empty" role="status">Loading audit history…</p> : history.data?.history.length ? <ol className="production-history">{history.data.history.map(item => <li key={item.id}>
        <div><strong>{item.summary || item.action}</strong><span>{item.action.replaceAll('_', ' ')}</span></div><p>By {item.byName || 'Not recorded'} · <time dateTime={item.at}>{new Date(item.at).toLocaleString('en-IN')}</time></p>
      </li>)}</ol> : <p className="production-empty">No audit history available.</p>}
    </section>
  </div>;
}
