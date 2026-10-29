import { useMemo, useState } from 'react';
import { Factory, RefreshCw } from 'lucide-react';
import { band, dateLabel, number, rateLabel, timeLabel, today, useProductionRead, type BreakdownRow, type ProductionEntry, type ProductionReport } from './Production';

/**
 * Every work step against the target it was due, with the people behind it.
 *
 * Kept apart from the ranking on Overview: that page says how a worker is
 * doing, this one says how a job is doing — which is a different question,
 * and the busiest step is not always the one that needs a look.
 */
function WorkStepOutput({ rows, entries, targets }: { rows: BreakdownRow[]; entries: ProductionEntry[]; targets: Map<string, number> }) {
  const [search, setSearch] = useState('');
  // Pieces alone say which step is busiest, not which one is going well. The
  // step's own target, the people on it and the records behind it do.
  const detail = useMemo(() => {
    const map = new Map<string, { target: number; workers: Set<string>; records: number }>();
    for (const entry of entries) {
      const key = entry.processId || '';
      const row = map.get(key) || { target: 0, workers: new Set<string>(), records: 0 };
      row.target += (targets.get(key) || 0) * entry.minutes / 60;
      row.workers.add(entry.labourId || entry.workerName);
      row.records += 1;
      map.set(key, row);
    }
    return map;
  }, [entries, targets]);
  const sorted = [...rows].sort((a, b) => b.pieces - a.pieces || a.name.localeCompare(b.name));
  const shown = sorted.filter(row => `${row.name} ${row.sub || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const total = rows.reduce((sum, row) => ({ pieces: sum.pieces + row.pieces, minutes: sum.minutes + (row.minutes ?? Math.round(row.hours * 60)) }), { pieces: 0, minutes: 0 });
  const max = Math.max(1, ...rows.map(row => row.pieces));
  return <section className="production-card production-work-output" aria-labelledby="work-output-title">
    <div className="production-section-heading"><div><h2 id="work-output-title">Output by work step</h2><p>Every work step against the target it was due in the time recorded, with the people behind it. Largest output first.</p></div><Factory size={22} aria-hidden="true" /></div>
    <div className="production-output-summary">{[{ label: 'Work steps', value: rows.length }, { label: 'Total pcs', value: number(total.pieces) }, { label: 'Recorded time', value: timeLabel(total.minutes) }].map(metric => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</div>
    {!!rows.length && <label className="production-output-search">Search work steps<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Toy name or work step" /></label>}
    {shown.length ? <ol className="production-step-grid">{shown.map(row => {
      const extra = detail.get(row.id);
      const target = Math.round(extra?.target || 0);
      const percent = target ? Math.round(row.pieces / target * 100) : null;
      const minutes = row.minutes ?? Math.round(row.hours * 60);
      const share = total.pieces ? row.pieces / total.pieces * 100 : 0;
      return <li key={row.id} className={percent === null ? 'is-untargeted' : band(percent)}>
        <div className="production-step-top">
          <span className="production-step-rank">{sorted.indexOf(row) + 1}</span>
          <div className="production-step-name"><strong>{row.name}</strong>{row.sub && <span>{row.sub}</span>}</div>
          <div className="production-step-count"><b>{number(row.pieces)}</b><small>pcs</small></div>
        </div>
        <div className="production-step-track" aria-hidden="true"><span style={{ width: `${percent === null ? Math.max(1, row.pieces / max * 100) : Math.max(2, Math.min(100, percent))}%` }} /></div>
        <p className="production-step-vs">{percent === null
          ? <>No target set for this step · <em>{number(share)}% of output</em></>
          : <><b>{number(percent)}%</b> of the {number(target)} pcs this step was due · <em>{number(share)}% of output</em></>}</p>
        <dl className="production-step-stats">
          <div><dt>Time</dt><dd>{timeLabel(minutes)}</dd></div>
          <div><dt>Rate</dt><dd>{rateLabel(row.perHour)}/hr</dd></div>
          <div><dt>{extra && extra.workers.size === 1 ? 'Worker' : 'Workers'}</dt><dd>{extra?.workers.size || 0}</dd></div>
          <div><dt>Records</dt><dd>{extra?.records || 0}</dd></div>
        </dl>
      </li>;
    })}</ol> : <p className="production-empty">{rows.length ? 'No work steps match this search.' : 'No work step output recorded in this period.'}</p>}
    {!!search && <p className="production-output-match" role="status">{shown.length} of {rows.length} work steps</p>}
  </section>;
}

/**
 * Work-step output and training production, apart from Overview.
 *
 * Both read the same report as Overview but answer a different question —
 * not who is doing well, but what each job produced and who is still in
 * training — so they keep their own page and their own period filter.
 */
export default function WorkOutput({ token, apiBase }: { token: string | null; apiBase: string }) {
  const [days, setDays] = useState('30');
  const [to, setTo] = useState(today());
  const [refresh, setRefresh] = useState(0);
  const report = useProductionRead<ProductionReport>(`${apiBase}/production/report?days=${days}&to=${to}`, token, refresh);
  const masters = useProductionRead<{ processes: { id: string; targetPerHour?: number; target8h?: number; target12h?: number }[] }>(`${apiBase}/production/masters`, token, refresh);
  const rate = useMemo(() => new Map((masters.data?.processes || []).map(step => [step.id, step.targetPerHour || (step.target8h ? step.target8h / 8 : step.target12h ? step.target12h / 12 : 0)])), [masters.data]);

  return <div className="production-page">
    <header className="production-header">
      <div><span className="production-eyebrow"><Factory size={16} aria-hidden="true" /> Owner overview · Read only</span><h1>Work output</h1><p>What each work step produced, and who is still in training.</p></div>
      <button type="button" className="production-refresh" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} aria-hidden="true" />Refresh</button>
    </header>
    <div className="production-filters production-card">
      <label>Report period<select value={days} onChange={event => setDays(event.target.value)}><option value="1">Single day</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
      <label>{days === '1' ? 'Date' : 'Period ending'}<input type="date" value={to} max={today()} onChange={event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) setTo(event.target.value); }} /></label>
      <div className="production-sync" role="status" aria-live="polite">{report.busy ? 'Updating report…' : report.updatedAt ? `Updated ${report.updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Report unavailable'}<span>Refreshes every 30 seconds and on focus</span></div>
    </div>
    {report.error && <p className="production-error" role="alert">{report.error} {report.data && 'Showing the last successful report; it may be out of date.'} Use Refresh to retry.</p>}
    {report.data && <>
      <div className="production-period">{dateLabel(report.data.from)} — {dateLabel(report.data.to)}</div>
      <section className="production-card"><h2>Training production</h2><p>Included in factory output. Training records are excluded from rankings, performance flags and their baseline.</p><strong>{number(report.data.trainingTotals?.pieces || 0)} pcs · {number(report.data.trainingTotals?.hours || 0)} hours · {report.data.trainingTotals?.entries || 0} entries</strong>{!!report.data.trainingWorkers?.length && <div className="production-table-wrap" role="region" aria-label="Training production" tabIndex={0}><table><thead><tr><th>Worker</th><th>Training dates</th><th>Pcs</th><th>Hours</th></tr></thead><tbody>{report.data.trainingWorkers.map(worker => <tr key={worker.id}><th scope="row">{worker.name}</th><td>{worker.trainingStart || worker.trainingEnd ? `${dateLabel(worker.trainingStart)} — ${dateLabel(worker.trainingEnd)}` : 'Marked on the entry'}</td><td>{number(worker.pieces)}</td><td>{number(worker.hours)}</td></tr>)}</tbody></table></div>}</section>
      <WorkStepOutput rows={(report.data.processes || []).map(row => ({ ...row, sub: row.toyName }))} entries={report.data.entries || []} targets={rate} />
    </>}
  </div>;
}
