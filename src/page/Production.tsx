import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Factory, Lightbulb, RefreshCw, Search, Trophy } from 'lucide-react';
import { sameJob } from '../names';
import '../styles/Production.css';

interface ProductionEntry {
  id: string; date?: string; labourId?: string; processId?: string; workerName: string; typeName?: string; toyName: string; processName: string;
  minutes: number; pieces: number; enteredByName: string; note: string;
  isTraining?: boolean; workType?: string; createdAt?: string; updatedAt?: string;
}
interface ProductionMasters { processes: { id: string; targetPerHour?: number; target8h?: number; target12h?: number }[] }
interface LeaderRow { id: string; name: string; entryCount: number; pieces: number; hours: number; expected: number; percent: number | null; untargetedHours: number; works: { label: string; pieces: number; expected: number }[] }
interface ProductionWorker {
  id: string; name: string; pieces: number; hours: number; perHour: number;
  daysWorked: number;
  training?: ProductionSubtotal; regular?: ProductionSubtotal;
}
interface ProductionFlag {
  date: string; workerId: string; workerName: string; toyName?: string; processName?: string;
  rate: number; usualRate: number; drop: number; baselineDate?: string; baselineDays?: number;
}
interface ProductionRecord {
  date: string; workerName: string; previousWorkerName: string; toyName: string; processName: string;
  rate: number; previousRate: number; improvement: number; pieces: number; hours: number; previousDate: string;
}
interface ProductionTrend { date: string; pieces: number; hours: number; perHour: number; workers: number }
interface ProductionSubtotal { pieces: number; hours: number; perHour: number; entries: number; workers: number }
interface ProductionReport {
  from: string; to: string;
  totals: { pieces: number; hours: number; perHour: number; entries: number; workers: number };
  trend: ProductionTrend[]; workers: ProductionWorker[]; flags: ProductionFlag[]; records?: ProductionRecord[];
  toys?: BreakdownRow[]; processes?: (BreakdownRow & { toyName?: string })[];
  entries?: ProductionEntry[];
  trainingTotals?: ProductionSubtotal; regularTotals?: ProductionSubtotal;
  trainingWorkers?: (ProductionSubtotal & { id: string; name: string; trainingStart?: string; trainingEnd?: string })[];
}

export const number = (value: number) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
// A rate is whole pieces: half a piece an hour is not a thing anyone counts.
export const rateLabel = (value: number) => Math.round(Number(value) || 0).toLocaleString('en-IN');
// Green from 90% of target, amber from 70, red below that.
const band = (percent: number | null) => percent === null ? '' : percent >= 90 ? 'is-good' : percent >= 70 ? 'is-mid' : 'is-low';
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const shiftDay = (key: string, days: number) => new Date(new Date(`${key}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
// A date can be missing — training is now also marked on the entry itself, with
// no dates behind it — and a missing date must read as a dash, never take the
// whole page down.
export const dateLabel = (value?: string | null) => {
  const day = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '—';
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const workerKey = (entry: ProductionEntry) => entry.labourId ? `id:${entry.labourId}` : `name:${entry.workerName || 'Archived worker'}`;
const timeLabel = (minutes: number) => `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
const viewParams = () => new URL(window.location.href).searchParams;
const viewDate = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(viewParams().get(key) || '') ? viewParams().get(key)! : today();
interface WorkerRecords { key: string; rowKey: string; date: string; name: string; entries: ProductionEntry[]; minutes: number; pieces: number; works: number; trainingEntries: number }
/**
 * One row per worker per day, because a shift is the unit the floor works in.
 * Rolling several days into one row produced totals like "18 hr 30 min" that
 * no eleven-hour shift could hold, and called a job on Monday and another on
 * Tuesday "multi work".
 */
function groupWorkerRecords(entries: ProductionEntry[]): WorkerRecords[] {
  const rows = new Map<string, WorkerRecords & { seen: Set<string> }>();
  for (const entry of entries) {
    const key = workerKey(entry), date = entry.date || '', rowKey = `${key}|${date}`;
    const row = rows.get(rowKey) || { key, rowKey, date, name: entry.workerName || 'Archived worker', entries: [], minutes: 0, pieces: 0, works: 0, trainingEntries: 0, seen: new Set<string>() };
    row.entries.push(entry); row.minutes += entry.minutes; row.pieces += entry.pieces;
    row.seen.add(`${entry.toyName}|${entry.processId || entry.processName}`);
    row.works = row.seen.size;
    if (entry.isTraining) row.trainingEntries++;
    rows.set(rowKey, row);
  }
  return [...rows.values()].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

function WorkerRecordTable({ rows, onOpen }: { rows: WorkerRecords[]; onOpen: (row: WorkerRecords) => void }) {
  return rows.length ? <div className="production-table-wrap" role="region" aria-label="Production records by worker" tabIndex={0}><table><thead><tr>{['Date', 'Worker', 'Work entries', 'Shift time', 'Process pcs', 'Production type', 'Details'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.rowKey}><td>{row.date ? dateLabel(row.date) : '—'}</td><th scope="row"><button type="button" className="production-worker-name" onClick={() => onOpen({ ...row, key: row.rowKey })} aria-label={`View work details for ${row.name} on ${row.date || 'this date'}`}>{row.name}</button></th><td>{row.entries.length}{row.works > 1 && <span className="production-work-count" title={`${row.works} different jobs in this shift`}>Multi work</span>}</td><td>{timeLabel(row.minutes)}</td><td>{number(row.pieces)}</td><td>{row.trainingEntries === 0 ? 'Regular' : row.trainingEntries === row.entries.length ? 'Training' : 'Regular + Training'}</td><td><button type="button" className="production-detail-button" onClick={() => onOpen({ ...row, key: row.rowKey })} aria-label={`Open production details for ${row.name} on ${row.date || 'this date'}`}>View details <ArrowRight size={16} aria-hidden="true" /></button></td></tr>)}</tbody></table></div> : <p className="production-empty">No production records for this selection.</p>;
}

// Each resource refreshes independently, so an audit failure does not hide production.
export function useProductionRead<T>(url: string, token: string | null, refresh: number) {
  const key = `${url}|${refresh}`;
  const [snapshot, setSnapshot] = useState<{ key: string; token: string | null; data: T | null; error: string; busy: boolean; updatedAt: Date | null }>({ key, token, data: null, error: '', busy: true, updatedAt: null });
  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    // Switching away and back fires focus and visibilitychange together, and
    // often. Cancelling the request in flight each time meant a first load
    // could be cut short over and over and never arrive, so a refresh while
    // one is already running is simply dropped.
    let running = false;
    const read = async () => {
      if (running) return;
      running = true;
      controller = new AbortController();
      const request = controller;
      await Promise.resolve();
      if (disposed || request.signal.aborted) { running = false; return; }
      // A request that never answers would otherwise hold the gate shut, so it
      // is given up on and the next refresh is free to try again.
      const giveUp = window.setTimeout(() => request.abort(), 20000);
      setSnapshot(previous => previous.key === key && previous.token === token ? { ...previous, busy: true } : { key, token, data: null, error: '', busy: true, updatedAt: null });
      try {
        if (!token) throw new Error('Please sign in to view production.');
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: request.signal });
        if (!response.ok) throw new Error(response.status === 401 ? 'Your session has expired. Please sign in again.' : response.status === 403 ? 'Production access is not available for this account.' : `Could not load production (HTTP ${response.status}).`);
        const body = await response.json() as T;
        if (!disposed && !request.signal.aborted) setSnapshot({ key, token, data: body, error: '', busy: false, updatedAt: new Date() });
      } catch (reason) {
        if (!disposed && !request.signal.aborted) setSnapshot(previous => ({ ...previous, error: reason instanceof Error ? reason.message : 'Could not load production.', busy: false }));
      } finally {
        window.clearTimeout(giveUp);
        running = false;
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

interface BreakdownRow { id: string; name: string; sub?: string; pieces: number; minutes?: number; hours: number; perHour: number }
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
    <div className="production-output-summary">{[{ label:'Work steps', value:rows.length },{ label:'Total pcs', value:number(total.pieces) },{ label:'Recorded time', value:timeLabel(total.minutes) }].map(metric=><div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</div>
    {!!rows.length&&<label className="production-output-search">Search work steps<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Toy name or work step" /></label>}
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
    {!!search&&<p className="production-output-match" role="status">{shown.length} of {rows.length} work steps</p>}
  </section>;
}

interface ChangeRow { id: string; action: string; summary: string; byName: string; at: string; entryId?: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }
const CHANGED_FIELDS: [string, string][] = [['pieces', 'Process pcs'], ['minutes', 'Minutes'], ['toyId', 'Toy'], ['processId', 'Work step'], ['labourId', 'Worker'], ['date', 'Date'], ['workType', 'Work type'], ['note', 'Note']];
const whenLabel = (value: string) => new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * What happened to one saved entry since it was first written.
 *
 * A corrected figure looks exactly like an original one in the table, so the
 * record of who changed what, and when, is the only way to tell them apart.
 */
function EntryChanges({ entry, token, apiBase }: { entry: ProductionEntry; token: string | null; apiBase: string }) {
  const log = useProductionRead<{ history: ChangeRow[] }>(`${apiBase}/production/history?entryId=${encodeURIComponent(entry.id)}&limit=50`, token, 0);
  if (log.busy && !log.data) return <p className="production-empty" role="status">Loading the changes…</p>;
  if (log.error) return <p className="production-error" role="alert">{log.error}</p>;
  // Only this entry, and only the corrections. The server filters this too, but
  // doing it here as well means an older server cannot pour the whole audit
  // trail into one row.
  const rows = (log.data?.history || []).filter(row => row.action === 'entry-updated' && (!row.entryId || row.entryId === entry.id));
  if (!rows.length) return <p className="production-empty">No correction was recorded for this entry.</p>;
  return <ol className="production-changes">{rows.map(row => {
    const moved = row.before && row.after
      ? CHANGED_FIELDS.filter(([key]) => String(row.before?.[key] ?? '') !== String(row.after?.[key] ?? ''))
      : [];
    return <li key={row.id}>
      <div className="production-change-head"><strong>{row.action.replaceAll('-', ' ')}</strong><span>{whenLabel(row.at)} · {row.byName || 'Not recorded'}</span></div>
      {moved.length ? <dl className="production-change-fields">{moved.map(([key, label]) => <div key={key}>
        <dt>{label}</dt><dd><s>{String(row.before?.[key] ?? '—') || '—'}</s> → <b>{String(row.after?.[key] ?? '—') || '—'}</b></dd>
      </div>)}</dl> : <p className="production-change-note">{row.summary}</p>}
    </li>;
  })}</ol>;
}
function EntryTable({ entries, hideWorker = false, targets, token, apiBase }: { entries: ProductionEntry[]; hideWorker?: boolean; targets?: Map<string, number>; token?: string | null; apiBase?: string }) {
  const [open, setOpen] = useState('');
  // An entry written once keeps the moment it was written; a corrected one moves on.
  const editedAt = (entry: ProductionEntry) => entry.updatedAt && entry.createdAt && new Date(entry.updatedAt).getTime() - new Date(entry.createdAt).getTime() > 1000 ? entry.updatedAt : '';
  // What the work step's own target asks for in the time recorded. A step with
  // no target set shows nothing rather than a zero that reads as a failure.
  const targetFor = (entry: ProductionEntry) => {
    const perHour = targets?.get(entry.processId || '') || 0;
    return perHour ? Math.round(perHour * entry.minutes / 60) : null;
  };
  const total = entries.reduce((sum, entry) => ({ minutes: sum.minutes + entry.minutes, pieces: sum.pieces + entry.pieces, target: sum.target + (targetFor(entry) || 0) }), { minutes: 0, pieces: 0, target: 0 });
  // On one worker's own page the share says how the day was split between jobs.
  // Across workers it would compare people's days, which means nothing, so the
  // column only appears on the detail. One date behind it makes it a shift.
  const oneDay = new Set(entries.map(entry => entry.date || '')).size === 1;
  const showShare = hideWorker;
  const share = (entry: ProductionEntry) => total.minutes ? Math.round(entry.minutes / total.minutes * 100) : 0;
  return entries.length ? <><div className="production-table-wrap production-work-table" tabIndex={0} role="region" aria-label="Production records, scroll for all columns"><table>
    <thead><tr>{['#', 'Date', ...(hideWorker ? [] : ['Worker']), 'Category', 'Toy', 'Work step', 'Time', ...(showShare ? [oneDay ? 'Share of shift' : 'Share of time'] : []), 'Process pcs', 'Target pcs', 'Pcs/hour', 'Production type', 'Entry by', 'Note'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
    <tbody>{entries.flatMap((entry, index) => [<tr key={entry.id} className={editedAt(entry) ? 'is-edited' : ''}>
      <td>{index + 1}</td>
      <td>{entry.date ? dateLabel(entry.date) : '—'}{editedAt(entry) && apiBase ? <button type="button" className="production-edited" aria-expanded={open === entry.id} onClick={() => setOpen(open === entry.id ? '' : entry.id)}>Edited {whenLabel(editedAt(entry))}</button> : null}</td>{!hideWorker && <th scope="row">{entry.workerName || 'Archived worker'}</th>}
      <td>{entry.typeName || '—'}</td><td>{entry.toyName || '—'}</td><td>{sameJob(entry.toyName, entry.processName) ? '—' : (entry.processName || '—')}</td><td>{timeLabel(entry.minutes)}</td>
      {showShare && <td><span className="production-share"><span className="production-share-bar" aria-hidden="true"><span style={{ width: `${Math.max(2, share(entry))}%` }} /></span><small>{share(entry)}%</small></span></td>}
      <td>{number(entry.pieces)}</td><td>{targetFor(entry) === null ? '—' : number(targetFor(entry)!)}</td><td>{rateLabel(entry.minutes > 0 ? entry.pieces * 60 / entry.minutes : 0)}</td>
      <td>{entry.isTraining ? 'Training' : entry.workType === 'cover' ? 'Cover' : 'Regular'}</td>
      <td>{entry.enteredByName || 'Not recorded'}</td><td className="production-note">{entry.note || '—'}</td>
    </tr>,
    ...(open === entry.id && apiBase ? [<tr key={`${entry.id}-changes`} className="production-change-row"><td colSpan={12 + (hideWorker ? 0 : 1) + (showShare ? 1 : 0)}><EntryChanges entry={entry} token={token ?? null} apiBase={apiBase} /></td></tr>] : [])
    ])}</tbody>
    <tfoot><tr><th scope="row" colSpan={hideWorker ? 5 : 6}>Total</th><td>{timeLabel(total.minutes)}</td>{showShare && <td>100%</td>}<td><strong>{number(total.pieces)} pcs</strong></td><td>{total.target ? `${number(total.target)} pcs` : '—'}</td><td>{rateLabel(total.minutes > 0 ? total.pieces * 60 / total.minutes : 0)}</td><td colSpan={3}>{entries.length} work entries</td></tr></tfoot>
  </table></div><div className="production-entry-cards" role="list" aria-label="Worker work entries">{entries.map(entry => <article className="production-entry-card" key={entry.id} role="listitem"><header><strong>{entry.toyName || 'Toy not recorded'}</strong><span>{entry.date ? dateLabel(entry.date) : '—'}</span></header><p>{entry.typeName ? `${entry.typeName} · ` : ''}{sameJob(entry.toyName, entry.processName) ? 'The model is the work itself' : (entry.processName || 'Work step not recorded')}</p><dl><div><dt>Time</dt><dd>{timeLabel(entry.minutes)}</dd></div><div><dt>Process pcs</dt><dd>{number(entry.pieces)}</dd></div><div><dt>Target pcs</dt><dd>{targetFor(entry) === null ? 'Not set' : number(targetFor(entry)!)}</dd></div><div><dt>Pcs/hour</dt><dd>{rateLabel(entry.minutes > 0 ? entry.pieces * 60 / entry.minutes : 0)}</dd></div></dl><p>{entry.isTraining ? 'Training' : 'Regular'} · Entry by {entry.enteredByName || 'Not recorded'}</p>{entry.note && <p className="production-note">{entry.note}</p>}</article>)}</div><p className="production-entry-total">Total: {number(total.pieces)} pcs · {timeLabel(total.minutes)} · {entries.length} work entries</p></> : <p className="production-empty">No production records for this selection.</p>;
}

interface Suggestion {
  id: string; name: string; overall: number; records: number;
  best: { work: string; percent: number; records: number; minutes: number } | null;
  worst: { work: string; percent: number } | null;
  firm: boolean;
}
/**
 * Which work each person is actually good at.
 *
 * Comparing raw output would only find whoever was given the fastest step, so
 * every pairing is scored against that step's own target. A suggestion is
 * marked as an early read until it rests on more than one record — one good
 * afternoon is not a reason to move somebody's job.
 */
function WorkSuggestions({ entries, targets }: { entries: ProductionEntry[]; targets: Map<string, number> }) {
  const rows = useMemo<Suggestion[]>(() => {
    const pair = new Map<string, { worker: string; work: string; pieces: number; minutes: number; expected: number; records: number }>();
    const whole = new Map<string, { name: string; pieces: number; expected: number; records: number }>();
    for (const entry of entries) {
      if (entry.isTraining) continue;
      const perHour = targets.get(entry.processId || '') || 0;
      if (!perHour) continue;
      const who = entry.labourId || entry.workerName;
      const key = `${who}|${entry.processId}`;
      const row = pair.get(key) || { worker: entry.workerName || 'Archived worker', work: sameJob(entry.toyName, entry.processName) ? (entry.toyName || 'Toy') : `${entry.toyName || 'Toy'} — ${entry.processName || 'Work step'}`, pieces: 0, minutes: 0, expected: 0, records: 0 };
      row.pieces += entry.pieces; row.minutes += entry.minutes; row.expected += perHour * entry.minutes / 60; row.records += 1;
      pair.set(key, row);
      const all = whole.get(who) || { name: entry.workerName || 'Archived worker', pieces: 0, expected: 0, records: 0 };
      all.pieces += entry.pieces; all.expected += perHour * entry.minutes / 60; all.records += 1;
      whole.set(who, all);
    }
    const byWorker = new Map<string, { work: string; percent: number; records: number; minutes: number }[]>();
    for (const [key, row] of pair) {
      const who = key.slice(0, key.lastIndexOf('|'));
      const list = byWorker.get(who) || [];
      list.push({ work: row.work, percent: Math.round(row.pieces / row.expected * 100), records: row.records, minutes: row.minutes });
      byWorker.set(who, list);
    }
    return [...whole].map(([who, all]) => {
      const list = (byWorker.get(who) || []).sort((a, b) => b.percent - a.percent);
      const best = list[0] || null;
      return {
        id: who, name: all.name, records: all.records,
        overall: all.expected ? Math.round(all.pieces / all.expected * 100) : 0,
        best, worst: list.length > 1 ? list[list.length - 1] : null,
        firm: !!best && best.records > 1 && best.minutes >= 120
      };
    }).filter(row => row.best).sort((a, b) => (b.best!.percent - b.overall) - (a.best!.percent - a.overall));
  }, [entries, targets]);

  const advice = (row: Suggestion) => {
    const gain = row.best!.percent - row.overall;
    if (gain >= 10) return { text: `Put more of their hours on ${row.best!.work}`, lift: `+${gain} points above their own average` };
    if (row.overall >= 100) return { text: 'Working at target across their jobs — leave as is', lift: '' };
    if (row.overall < 70) return { text: `Below target on everything so far. ${row.best!.work} is their least weak job — check materials, machine or training first`, lift: '' };
    return { text: 'No single job stands out yet — give it a few more days', lift: '' };
  };

  return <section className="production-card">
    <div className="production-section-heading"><div><h2>Who should do what</h2><p>Each worker scored on every job they did, against that job's own target. Sorted by how much they would gain from moving.</p></div><Lightbulb size={22} aria-hidden="true" /></div>
    {rows.length ? <ul className="production-advice">{rows.map(row => {
      const note = advice(row);
      return <li key={row.id} className={band(row.best!.percent)}>
        <div className="production-advice-head"><strong>{row.name}</strong><span>Overall {number(row.overall)}% of target · {row.records} {row.records === 1 ? 'record' : 'records'}</span></div>
        <p className="production-advice-call">{note.text}{note.lift && <em>{note.lift}</em>}</p>
        <dl className="production-advice-jobs">
          <div><dt>Best job</dt><dd>{row.best!.work} <b>{number(row.best!.percent)}%</b><small>{row.best!.records} {row.best!.records === 1 ? 'record' : 'records'} · {timeLabel(row.best!.minutes)}</small></dd></div>
          {row.worst && <div><dt>Weakest job</dt><dd>{row.worst.work} <b>{number(row.worst.percent)}%</b></dd></div>}
        </dl>
        {!row.firm && <p className="production-advice-thin">Early read — resting on {row.best!.records === 1 ? 'a single record' : 'very little time'}. Treat it as a hint, not a decision.</p>}
      </li>;
    })}</ul> : <p className="production-empty">Not enough recorded work with targets to suggest anything yet.</p>}
  </section>;
}

export default function Production({ token, apiBase, view = 'report' }: { token: string | null; apiBase: string; view?: 'report' | 'records' }) {
  const [days, setDays] = useState(() => ['1','7','30','90'].includes(viewParams().get('productionDays') || '') ? viewParams().get('productionDays')! : '30');
  const [to, setTo] = useState(() => viewDate('productionTo'));
  const [date, setDate] = useState(() => viewDate('productionDate'));
  const [recordScope, setRecordScope] = useState(() => viewParams().get('productionScope') === 'period' ? 'period' : 'day');
  // Thirty-five workers over a month is more rows than anybody reads at once,
  // so the list is searched by name and walked a page at a time.
  const [recordSearch, setRecordSearch] = useState('');
  const [recordPage, setRecordPage] = useState(1);
  const [selectedWorker, setSelectedWorker] = useState(() => viewParams().get('productionWorker') || '');
  const [detailSource, setDetailSource] = useState(() => viewParams().get('productionSource') === 'leaders' ? 'leaders' : 'records');
  const [openedHere, setOpenedHere] = useState(false);
  const detailHeading = useRef<HTMLHeadingElement>(null), recordsHeading = useRef<HTMLHeadingElement>(null), leadersHeading = useRef<HTMLHeadingElement>(null), hadDetail = useRef(!!selectedWorker);
  useEffect(() => {
    if (selectedWorker) { hadDetail.current = true; detailHeading.current?.focus({ preventScroll: true }); detailHeading.current?.closest('header')?.scrollIntoView({ block: 'start' }); }
    else if (hadDetail.current) { hadDetail.current = false; const heading = detailSource === 'leaders' ? leadersHeading.current : recordsHeading.current; heading?.focus({ preventScroll: true }); heading?.scrollIntoView({ block: 'start' }); }
  }, [selectedWorker, detailSource]);
  const [refresh, setRefresh] = useState(0);
  const report = useProductionRead<ProductionReport>(`${apiBase}/production/report?days=${days}&to=${to}`, token, refresh);
  const masters = useProductionRead<ProductionMasters>(`${apiBase}/production/masters`, token, refresh);
  const dayEntries = useProductionRead<{ entries: ProductionEntry[] }>(`${apiBase}/production/day?date=${date}`, token, refresh);
  const viewScope = selectedWorker && detailSource === 'leaders' ? 'period' : recordScope;
  // Moving between Overview and Records should show that page, not whichever
  // worker was open when you left. The first run is skipped so a link that
  // carries a worker in the URL still opens on them.
  const lastView = useRef(view);
  useEffect(() => {
    if (lastView.current === view) return;
    lastView.current = view;
    setSelectedWorker('');
    setOpenedHere(false);
  }, [view]);
  const records = viewScope === 'day' ? dayEntries : report;
  const entries = viewScope === 'day' ? (dayEntries.data?.entries || []).map(entry => ({ ...entry, date: entry.date || date })) : report.data?.entries || [];
  const workerRows = groupWorkerRecords(entries);
  // A screen's worth is a scroll, not a page turn: fifty rows cover a whole
  // day's workforce, so the pager is for going further back, not for reading
  // one day in four clicks.
  const PER_PAGE = 50;
  const foundRows = workerRows.filter(row => !recordSearch.trim() || row.name.toLowerCase().includes(recordSearch.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(foundRows.length / PER_PAGE));
  const page = Math.min(recordPage, pages);
  const pagedRows = foundRows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  // A row opened from the records table is one shift; one opened from the
  // ranking is the whole period, so every day of that worker is merged.
  const detailRows = workerRows.filter(row => row.rowKey === selectedWorker || row.key === selectedWorker);
  const detailWorker = detailRows.length ? detailRows.reduce((all, row) => ({
    ...row, entries: [...all.entries, ...row.entries], minutes: all.minutes + row.minutes,
    pieces: all.pieces + row.pieces, trainingEntries: all.trainingEntries + row.trainingEntries
  }), { ...detailRows[0], entries: [], minutes: 0, pieces: 0, trainingEntries: 0 }) : undefined;
  useEffect(() => {
    const onPop = () => {
      const params = viewParams(), key = params.get('productionWorker') || '';
      setSelectedWorker(key);
      if (key) setDetailSource(params.get('productionSource') === 'leaders' ? 'leaders' : 'records');
      if (key) { setRecordScope(params.get('productionScope') === 'period' ? 'period' : 'day'); setDate(viewDate('productionDate')); setTo(viewDate('productionTo')); const range = params.get('productionDays'); setDays(range && ['1','7','30','90'].includes(range) ? range : '30'); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openWorker = (row: Pick<WorkerRecords, 'key'>, source = 'records') => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries({ productionWorker: row.key, productionSource: source, productionScope: recordScope, productionDate: date, productionDays: days, productionTo: to })) url.searchParams.set(key, value);
    window.history.pushState(window.history.state, '', url);
    setDetailSource(source); setSelectedWorker(row.key); setOpenedHere(true);
  };
  const backToRecords = () => {
    if (openedHere) { window.history.back(); setOpenedHere(false); return; }
    const url = new URL(window.location.href);
    ['productionWorker','productionSource','productionScope','productionDate','productionDays','productionTo'].forEach(key => url.searchParams.delete(key));
    window.history.replaceState(window.history.state, '', url); setSelectedWorker('');
  };
  const dateChange = (value: string, setter: (date: string) => void) => { if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setter(value); };
  // Ranking on raw output would only say who was given the fastest work step,
  // so each worker is measured against the target of the steps they actually
  // did. Pieces from a step with no target set are left out of the comparison
  // rather than counted as free credit.
  const rate = useMemo(() => new Map((masters.data?.processes || []).map(step => [step.id, step.targetPerHour || (step.target8h ? step.target8h / 8 : step.target12h ? step.target12h / 12 : 0)])), [masters.data]);
  const leaders = useMemo<LeaderRow[]>(() => {
    const rows = new Map<string, Omit<LeaderRow, 'works'> & { targetedPieces: number; work: Map<string, { pieces: number; expected: number }> }>();
    for (const entry of report.data?.entries || []) {
      if (entry.isTraining) continue;
      const key = workerKey(entry);
      const row = rows.get(key) || { id: key, name: entry.workerName || 'Archived worker', entryCount: 0, pieces: 0, hours: 0, expected: 0, percent: null, untargetedHours: 0, targetedPieces: 0, work: new Map<string, { pieces: number; expected: number }>() };
      row.entryCount++; row.pieces += entry.pieces; row.hours += entry.minutes / 60;
      const label = sameJob(entry.toyName, entry.processName)
        ? (entry.toyName || 'Toy not recorded')
        : `${entry.toyName || 'Toy not recorded'} — ${entry.processName || 'Work step not recorded'}`;
      // Each job keeps its own target as well as its pieces: a worker who did
      // three different jobs is read job by job, which is the only way the
      // figures mean anything — a packing target says nothing about gumming.
      const perHour = rate.get(entry.processId || '') || 0;
      const job = row.work.get(label) || { pieces: 0, expected: 0 };
      job.pieces += entry.pieces;
      job.expected += perHour * entry.minutes / 60;
      row.work.set(label, job);
      if (perHour) { row.expected += perHour * entry.minutes / 60; row.targetedPieces += entry.pieces; }
      else row.untargetedHours += entry.minutes / 60;
      rows.set(key, row);
    }
    return [...rows.values()]
      .map(row => ({ ...row, percent: row.expected ? Math.round(row.targetedPieces / row.expected * 100) : null, works: [...row.work].map(([label, job]) => ({ label, pieces: job.pieces, expected: job.expected })).sort((a, b) => b.pieces - a.pieces) }))
      .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || b.pieces - a.pieces);
  }, [report.data, rate]);
  // The bar always leaves room for the 100% mark, so beating the target shows.
  // The bar stops at a full 100% of target; the figure beside it keeps counting,
  // so beating the target is visible instead of being flattened to 100.
  const capped = (percent: number | null) => percent === null ? null : Math.min(100, percent);
  // Green from 90% of target, amber from 70, red below that.
  const todayKey = today(), yesterdayKey = shiftDay(todayKey, -1);
  // The dropdown reads back from the two values it sets, so moving the ending
  // date by hand can never leave it still claiming "Yesterday".
  const period = days !== '1' ? days : to === todayKey ? 'today' : to === yesterdayKey ? 'yesterday' : 'day';
  const choosePeriod = (value: string) => {
    if (value === 'today' || value === 'yesterday') { setDays('1'); setTo(value === 'today' ? todayKey : yesterdayKey); return; }
    setDays(value === 'day' ? '1' : value);
  };
  if (selectedWorker) return <div className="production-page production-worker-detail">
    <header className="production-header"><div><button type="button" className="production-refresh production-back" onClick={backToRecords}><ArrowLeft size={17} aria-hidden="true" />{detailSource === 'leaders' ? 'Back to top performers' : 'Back to production records'}</button><span className="production-eyebrow">Worker work details · Read only</span><h1 ref={detailHeading} tabIndex={-1}>{detailWorker?.name || 'Worker details'}</h1><p>{viewScope === 'day' ? dateLabel(date) : `${dateLabel(report.data?.from || to)} — ${dateLabel(to)}`}</p></div><button type="button" className="production-refresh" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} aria-hidden="true" />Refresh</button></header>
    {records.error && <p className="production-error" role="alert">{records.error} {records.data && 'Showing the last successful records.'}</p>}
    {records.busy && !records.data ? <p className="production-empty" role="status">Loading worker details…</p> : detailWorker ? <>
      <div className="production-metrics">{[{ label: 'Total work entries', value: detailWorker.entries.length },{ label: 'Total recorded time', value: timeLabel(detailWorker.minutes) },{ label: 'Total pcs', value: number(detailWorker.pieces) },{ label: 'Training entries', value: detailWorker.trainingEntries }].map(metric => <div key={metric.label} className="production-card production-metric"><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</div>
      <section className="production-card"><h2>All work details</h2><p>Toy, work step, time, pieces against the work step's target, entry by and remarks for every saved work.</p><EntryTable entries={detailWorker.entries} hideWorker targets={rate} token={token} apiBase={apiBase} /></section>
    </> : <section className="production-card"><h2>No work records in this selection</h2><p>The records may have been removed or changed. Return to production records to choose another worker or date.</p></section>}
  </div>;
  return <div className="production-page">
    {/* Records is a working screen, not a page to be introduced: the sidebar
        already says where you are, so it opens straight on the rows and keeps
        only the button that does something. */}
    {view === 'records'
      ? null
      : <header className="production-header">
          <div><span className="production-eyebrow"><Factory size={16} aria-hidden="true" /> Owner overview · Read only</span><h1>Production</h1><p>Output, worker performance and the record of every change.</p></div>
          <button type="button" className="production-refresh" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} aria-hidden="true" />Refresh</button>
        </header>}
    {view === 'report' && <>
    <div className="production-filters production-card">
      <label>Report period<select value={period} onChange={event => choosePeriod(event.target.value)}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="day">Single day</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
      <label>{days === '1' ? 'Date' : 'Period ending'}<input type="date" value={to} max={todayKey} onChange={event => dateChange(event.target.value, setTo)} /></label>
      <div className="production-sync" role="status" aria-live="polite">{report.busy ? 'Updating report…' : report.updatedAt ? `Updated ${report.updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Report unavailable'}<span>Refreshes every 30 seconds and on focus</span></div>
    </div>
    </>}
    {report.error && <p className="production-error" role="alert">{report.error} {report.data && 'Showing the last successful report; it may be out of date.'} Use Refresh to retry.</p>}
    {view === 'report' && report.data && <>
      <div className="production-period">{dateLabel(report.data.from)} — {dateLabel(report.data.to)}</div>
      <section className="production-card">
        <div className="production-section-heading"><div><h2 ref={leadersHeading} tabIndex={-1}>Top performers</h2><p>Regular production only, ranked against each work step's own target. Training records are excluded. A full bar is 100% of target; above that the figure keeps rising. Green from 90%, amber from 70%, red below 70%. Click a worker to see their work details for this report period.</p></div><Trophy size={22} aria-hidden="true" /></div>
        {leaders.length ? <ol className="production-board">{leaders.map((row, index) => <li key={row.id} className={`${band(row.percent)}${row.percent !== null && index === 0 ? ' is-first' : ''}`}>
          <button type="button" className="production-performer" aria-label={`View performance details for ${row.name}`} onClick={() => openWorker({ key: row.id }, 'leaders')}>
          <span className="production-rank">{index + 1}</span>
          <span className="production-board-body">
            <span className="production-board-name"><span className="production-performer-identity"><strong>{row.name}</strong>{row.entryCount > 1 && <span className="production-work-count" title={`${row.entryCount} regular work entries in this report period`}>Multi work</span>}</span>{row.percent === null ? <em>No target set for this work</em> : <b>{number(row.percent)}%</b>}</span>
            <span className="production-board-track"><span className="production-board-fill" style={{ width: `${Math.max(2, capped(row.percent) ?? 0)}%` }} /></span>
            {/* Job by job, because that is the question behind the ranking:
                what did this worker do, what was it meant to make, what did it
                make. A run-on list of names answered none of the three. */}
            {row.works.length ? <span className="production-board-jobs">
              {row.works.slice(0, 4).map(work => <span className="production-board-job" key={work.label}>
                <span>{work.label}</span>
                <b>{number(work.pieces)} pcs</b>
                <em>{work.expected ? `target ${number(Math.round(work.expected))}` : 'no target'}</em>
              </span>)}
              {row.works.length > 4 && <span className="production-board-job is-more"><span>+{row.works.length - 4} more {row.works.length - 4 === 1 ? 'job' : 'jobs'}</span></span>}
            </span> : null}
            <small>Total {number(row.pieces)} pcs · {number(row.hours)} hr{row.expected ? ` · target ${number(Math.round(row.expected))} pcs` : ''}{row.untargetedHours ? ` · ${number(row.untargetedHours)} hr not compared` : ''}</small>
          </span></button>
        </li>)}</ol> : <p className="production-empty">No regular production to rank in this period. Training output is shown separately above.</p>}
      </section>
      <WorkSuggestions entries={report.data.entries || []} targets={rate} />
      <section className="production-card"><h2>Training production</h2><p>Included in factory output. Training records are excluded from rankings, performance flags and their baseline.</p><strong>{number(report.data.trainingTotals?.pieces || 0)} pcs · {number(report.data.trainingTotals?.hours || 0)} hours · {report.data.trainingTotals?.entries || 0} entries</strong>{!!report.data.trainingWorkers?.length&&<div className="production-table-wrap" role="region" aria-label="Training production" tabIndex={0}><table><thead><tr><th>Worker</th><th>Training dates</th><th>Pcs</th><th>Hours</th></tr></thead><tbody>{report.data.trainingWorkers.map(worker=><tr key={worker.id}><th scope="row">{worker.name}</th><td>{worker.trainingStart || worker.trainingEnd ? `${dateLabel(worker.trainingStart)} — ${dateLabel(worker.trainingEnd)}` : 'Marked on the entry'}</td><td>{number(worker.pieces)}</td><td>{number(worker.hours)}</td></tr>)}</tbody></table></div>}</section>
      <WorkStepOutput rows={(report.data.processes || []).map(row => ({ ...row, sub: row.toyName }))} entries={report.data.entries || []} targets={rate} />
    </>}
    {view === 'records' && <section className="production-card production-flat">
      {/* The page title says what this is; saying it again above the filters
          only pushed the rows down. The controls and the count share one bar. */}
      <div className="production-report-head">
        <h2 ref={recordsHeading} tabIndex={-1}>Production report</h2>
        <p>Worker activity and production records.</p>
      </div>
      <div className="production-record-filters production-record-bar"><label>Show records<select aria-label="Show records" value={recordScope} onChange={event => setRecordScope(event.target.value)}><option value="day">Selected day</option><option value="period">Report period</option></select></label>{recordScope === 'day' && <label>Record date<input type="date" value={date} onChange={event => dateChange(event.target.value, setDate)} /></label>}{recordScope === 'period' && <><label>Days<select value={days} onChange={event => setDays(event.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>{days === '1' && <option value="1">Single day</option>}</select></label><label>Ending date<input type="date" value={to} max={todayKey} onChange={event => dateChange(event.target.value, setTo)} /></label></>}<label className="production-search"><span className="production-sr-only">Search worker</span><Search size={16} aria-hidden="true" /><input value={recordSearch} placeholder="Search worker by name" onChange={event => { setRecordSearch(event.target.value); setRecordPage(1); }} /></label><span className="production-count">{workerRows.length} workers · {entries.length} work entries</span><button type="button" className="production-refresh" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} aria-hidden="true" />Refresh</button></div>
      {records.error && <p className="production-error" role="alert">{records.error} {records.data && 'Records may be out of date.'} Use Refresh to retry.</p>}
      {records.busy && !records.data ? <p className="production-empty" role="status">Loading records…</p> : <>
        <WorkerRecordTable rows={pagedRows} onOpen={openWorker} />
        {foundRows.length > 0 && <div className="production-pager">
          <span>Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, foundRows.length)} of {foundRows.length} {foundRows.length === 1 ? 'row' : 'rows'}</span>
          {pages > 1 && <div className="production-pager-pages">
            <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setRecordPage(page - 1)}><ChevronLeft size={16} /></button>
            {Array.from({ length: pages }, (_, at) => at + 1)
              .filter(number => number === 1 || number === pages || Math.abs(number - page) <= 2)
              .map((number, at, list) => <span key={number}>
                {at > 0 && number - list[at - 1] > 1 && <em>…</em>}
                <button type="button" className={number === page ? 'is-on' : ''} aria-current={number === page ? 'page' : undefined} onClick={() => setRecordPage(number)}>{number}</button>
              </span>)}
            <button type="button" aria-label="Next page" disabled={page === pages} onClick={() => setRecordPage(page + 1)}><ChevronRight size={16} /></button>
          </div>}
        </div>}
      </>}
    </section>}
  </div>;
}
