import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight, Check, Clock3, Flag, MessageSquare, Plus, Repeat, RotateCcw, Search, Send, Trash2, Undo2, X } from 'lucide-react';
import '../styles/Tasks.css';
import '../styles/Operations.css';

interface Hop {
  from?: string; fromName?: string; fromRole?: string;
  to?: string; toName?: string; reason?: string; at?: string;
  /** Who made the move, which is not always who the work came from. */
  byName?: string; byRole?: string;
}
interface Line { by?: string; byName?: string; byRole?: string; text?: string; at?: string }
interface Operation {
  _id: string;
  title: string;
  details?: string;
  urgent?: boolean;
  status: 'open' | 'done';
  assignedTo?: string;
  assignedToName?: string;
  assignments?: Hop[];
  messages?: Line[];
  nextFollowup?: string;
  followupNote?: string;
  createdByName?: string;
  doneByName?: string;
  doneRequestedByName?: string;
  doneRequestedAt?: string | null;
  doneAt?: string | null;
  createdAt: string;
}
interface Staff { _id: string; name: string; role?: string }

const when = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const day = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Operations — work the MD hands out and then follows.
 *
 * It keeps its own records; the office task list is a different thing and is
 * not shown here. What this page is for is the trail: a piece of work starts
 * with one person, and when that person is already loaded they pass it on with
 * a reason. The table shows both ends of that trail and how many hands it went
 * through, because work that keeps moving is usually work nobody is doing.
 */
export default function Operations({ token, apiBase, showToast }: {
  token: string | null; apiBase: string;
  showToast?: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}) {
  const [rows, setRows] = useState<Operation[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [filter, setFilter] = useState<'all' | 'open' | 'urgent' | 'moved' | 'waiting' | 'done'>('open');
  const [who, setWho] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState('');
  const [moving, setMoving] = useState('');
  const [moveTo, setMoveTo] = useState('');
  const [reason, setReason] = useState('');

  const [form, setForm] = useState({ title: '', details: '', assignedTo: '', nextFollowup: '', urgent: false });
  const [chatId, setChatId] = useState('');
  const [draft, setDraft] = useState('');
  const feed = useRef<HTMLDivElement>(null);

  const headers = useMemo(() => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, people] = await Promise.all([
        fetch(`${apiBase}/operations`, { headers }).then(res => res.json()),
        fetch(`${apiBase}/operations/staff`, { headers }).then(res => res.json())
      ]);
      setRows(Array.isArray(list) ? list : []);
      setStaff(Array.isArray(people) ? people : []);
      if (!Array.isArray(list)) setError((list as { message?: string })?.message || 'Could not load operations.');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not load operations.');
    } finally {
      setLoading(false);
    }
  }, [apiBase, headers]);
  useEffect(() => { void load(); }, [load]);

  const call = async (path: string, method: string, body?: Record<string, unknown>, done?: string) => {
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/operations${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message || 'That did not go through.');
      if (done) showToast?.(done, 'success');
      await load();
      return true;
    } catch (problem) {
      showToast?.(problem instanceof Error ? problem.message : 'That did not go through.', 'danger');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const hops = (row: Operation) => row.assignments || [];
  const handovers = (row: Operation) => Math.max(0, hops(row).length - 1);

  const shown = rows.filter(row => {
    if (filter === 'open' && row.status !== 'open') return false;
    if (filter === 'done' && row.status !== 'done') return false;
    if (filter === 'urgent' && !(row.urgent && row.status === 'open')) return false;
    if (filter === 'moved' && !handovers(row)) return false;
    if (filter === 'waiting' && !(row.status === 'open' && row.doneRequestedByName)) return false;
    if (who && row.assignedTo !== who && !hops(row).some(hop => hop.from === who || hop.to === who)) return false;
    const text = `${row.title} ${row.details || ''} ${row.assignedToName || ''} ${hops(row).map(hop => `${hop.fromName} ${hop.toName}`).join(' ')}`.toLowerCase();
    return !search.trim() || text.includes(search.trim().toLowerCase());
  });

  const counts = {
    open: rows.filter(row => row.status === 'open').length,
    urgent: rows.filter(row => row.urgent && row.status === 'open').length,
    moved: rows.filter(row => handovers(row)).length,
    done: rows.filter(row => row.status === 'done').length,
    waiting: rows.filter(row => row.status === 'open' && row.doneRequestedByName).length,
    busiest: (() => {
      const tally = new Map<string, number>();
      for (const row of rows) for (const hop of hops(row).slice(1)) if (hop.fromName) tally.set(hop.fromName, (tally.get(hop.fromName) || 0) + 1);
      const top = [...tally].sort((a, b) => b[1] - a[1])[0];
      return top ? `${top[0]} (${top[1]})` : 'Nobody yet';
    })()
  };

  const chat = rows.find(row => row._id === chatId);
  // Who is on this work: everyone the trail names, newest holder first.
  const chatWith = chat ? [...new Set([chat.assignedToName, ...(chat.assignments || []).map(hop => hop.toName)].filter(Boolean))] as string[] : [];
  useEffect(() => {
    if (chat) feed.current?.scrollTo({ top: feed.current.scrollHeight });
  }, [chat, chat?.messages?.length]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.assignedTo) return;
    const ok = await call('', 'POST', { ...form, title: form.title.trim(), details: form.details.trim() }, 'Work handed out.');
    if (ok) setForm({ title: '', details: '', assignedTo: '', nextFollowup: '', urgent: false });
  };

  return <div className="ops-page">
    <header className="ops-head">
      <div>
        <span className="ops-eyebrow"><Repeat size={15} aria-hidden="true" /> Operations · who is actually doing the work</span>
        <h1>Operations</h1>
        <p>Work you hand out and then follow: who got it first, who holds it now, and why it moved.</p>
      </div>
    </header>

    <div className="ops-metrics">
      <div className="ops-metric"><span>Open</span><strong>{counts.open}</strong></div>
      <div className="ops-metric is-urgent"><span><Flag size={14} aria-hidden="true" /> Urgent open</span><strong>{counts.urgent}</strong></div>
      <div className="ops-metric is-waiting"><span><Clock3 size={14} aria-hidden="true" /> Says done</span><strong>{counts.waiting}</strong></div>
      <div className="ops-metric"><span>Handed over</span><strong>{counts.moved}</strong></div>
      <div className="ops-metric"><span>Hands over most</span><strong className="ops-name">{counts.busiest}</strong></div>
    </div>

    <form className="ops-new" onSubmit={create}>
      <h2><Plus size={16} aria-hidden="true" />Hand out new work</h2>
      <div className="ops-new-grid">
        <label className="ops-field ops-grow"><span>What is the work</span>
          <input required maxLength={200} value={form.title} placeholder="e.g. Meta scrap payment follow-up" onChange={event => setForm({ ...form, title: event.target.value })} />
        </label>
        <label className="ops-field"><span>Give it to</span>
          <select required value={form.assignedTo} onChange={event => setForm({ ...form, assignedTo: event.target.value })}>
            <option value="">Choose a staff member</option>
            {staff.map(member => <option key={member._id} value={member._id}>{member.name}</option>)}
          </select>
        </label>
        <label className="ops-field"><span>Next follow-up</span>
          <input type="date" value={form.nextFollowup} onChange={event => setForm({ ...form, nextFollowup: event.target.value })} />
        </label>
        <label className="ops-field ops-grow"><span>Details <small>(optional)</small></span>
          <input maxLength={1000} value={form.details} placeholder="Anything they should know" onChange={event => setForm({ ...form, details: event.target.value })} />
        </label>
        <label className="ops-check">
          <input type="checkbox" checked={form.urgent} onChange={event => setForm({ ...form, urgent: event.target.checked })} />
          <span><Flag size={13} aria-hidden="true" /> Urgent</span>
        </label>
        <button type="submit" className="ops-primary" disabled={busy || !form.title.trim() || !form.assignedTo}>Hand it out</button>
      </div>
    </form>

    <div className="ops-filters">
      <div className="ops-scope" role="group" aria-label="Which work to show">
        {([['open', `Open (${counts.open})`], ['waiting', `Says done (${counts.waiting})`], ['urgent', `Urgent (${counts.urgent})`], ['moved', `Handed over (${counts.moved})`], ['done', `Done (${counts.done})`], ['all', `All (${rows.length})`]] as const).map(([key, label]) => (
          <button key={key} type="button" className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>
      <label className="ops-field"><span>Staff</span>
        <select value={who} onChange={event => setWho(event.target.value)}>
          <option value="">Everyone</option>
          {staff.map(member => <option key={member._id} value={member._id}>{member.name}</option>)}
        </select>
      </label>
      <label className="ops-field ops-search"><span><Search size={13} aria-hidden="true" /> Search</span>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Work or person" />
      </label>
    </div>

    {error && <p className="ops-error" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

    <section className="ops-card">
      <div className="ops-table-wrap" tabIndex={0} role="region" aria-label="Operations">
        <table className="ops-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Task</th>
              <th scope="col">Assign</th>
              <th scope="col">Reassign</th>
              <th scope="col">Hands</th>
              <th scope="col">Last assign</th>
              <th scope="col">Next follow-up</th>
              <th scope="col">Updates</th>
              <th scope="col">Status</th>
              <th scope="col"><span className="ops-sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map(row => {
              const trail = hops(row);
              const moves = handovers(row);
              const last = trail[trail.length - 1];
              return <>
                <tr key={row._id} className={`${moves > 1 ? 'is-bouncing' : ''}${row.urgent && row.status === 'open' ? ' is-urgent' : ''}`}>
                  <td>{day(row.createdAt)}</td>
                  <th scope="row">
                    <button type="button" className="ops-title" onClick={() => setOpen(open === row._id ? '' : row._id)}>
                      {row.urgent && row.status === 'open' && <span className="ops-flag"><Flag size={12} aria-hidden="true" />URGENT</span>}
                      {row.title}
                    </button>
                    {row.details && <small className="ops-details">{row.details}</small>}
                  </th>
                  <td>{trail[0]?.toName || '—'}<small>by {trail[0]?.fromName || row.createdByName || '—'}</small></td>
                  <td>{moves ? <>{row.assignedToName || '—'}<small>from {last?.fromName}</small></> : '—'}</td>
                  <td>{moves === 0 ? '—' : `${moves} ${moves === 1 ? 'time' : 'times'}`}</td>
                  <td>{moves ? <>{when(last?.at)}<small>by {last?.byName || last?.fromName}</small></> : '—'}</td>
                  <td className="ops-followup">{row.nextFollowup || '—'}{row.followupNote && <small>{row.followupNote}</small>}</td>
                  <td>
                    <button type="button" className="ops-chat-count" onClick={() => { setChatId(row._id); setDraft(''); }} title="Open the conversation on this work">
                      <MessageSquare size={14} aria-hidden="true" />{(row.messages || []).length || 0}
                    </button>
                  </td>
                  <td>
                    {row.status === 'open' && row.doneRequestedByName
                      ? <span className="ops-status is-waiting"><Clock3 size={12} aria-hidden="true" /> Says done</span>
                      : <span className={`ops-status is-${row.status}`}>{row.status === 'done' ? 'Done' : 'Open'}</span>}
                    {row.status === 'done' && row.doneByName && <small>by {row.doneByName}</small>}
                    {row.status === 'open' && row.doneRequestedByName && <small>{row.doneRequestedByName} · {when(row.doneRequestedAt)}</small>}
                  </td>
                  <td>
                    <div className="ops-row-actions">
                      <button type="button" className={`ops-ghost ${row.urgent ? 'is-on' : ''}`} disabled={busy} title={row.urgent ? 'Remove the urgent flag' : 'Mark as urgent'}
                        onClick={() => void call(`/${row._id}`, 'PUT', { urgent: !row.urgent }, row.urgent ? 'Urgent flag removed.' : 'Marked urgent.')}>
                        <Flag size={15} />
                      </button>
                      {row.status === 'open' && <button type="button" className="ops-ghost" disabled={busy} title="Hand this work to someone else"
                        onClick={() => { setMoving(moving === row._id ? '' : row._id); setMoveTo(''); setReason(''); }}>
                        <Send size={15} />
                      </button>}
                      {row.status === 'open' && row.doneRequestedByName && <button type="button" className="ops-ghost" disabled={busy}
                        title={`${row.doneRequestedByName} says it is finished — put it back as open`}
                        onClick={() => void call(`/${row._id}`, 'PUT', { doneRequested: false }, 'Put back as open.')}>
                        <Undo2 size={15} />
                      </button>}
                      <button type="button" className={`ops-ghost ${row.status === 'open' && row.doneRequestedByName ? 'is-confirm' : ''}`} disabled={busy} title={row.status === 'done' ? 'Open it again' : row.doneRequestedByName ? `Close it — ${row.doneRequestedByName} says it is finished` : 'Mark as done'}
                        onClick={() => void call(`/${row._id}`, 'PUT', { status: row.status === 'done' ? 'open' : 'done' }, row.status === 'done' ? 'Opened again.' : 'Marked done.')}>
                        {row.status === 'done' ? <RotateCcw size={15} /> : <Check size={15} />}
                      </button>
                      <button type="button" className="ops-ghost is-danger" disabled={busy} title="Remove this work"
                        onClick={() => void call(`/${row._id}`, 'DELETE', undefined, 'Removed.')}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
                {moving === row._id && <tr key={`${row._id}-move`} className="ops-sub">
                  <td colSpan={11}>
                    <form className="ops-move" onSubmit={event => { event.preventDefault(); void call(`/${row._id}/reassign`, 'POST', { to: moveTo, reason }, 'Handed over.').then(ok => { if (ok) { setMoving(''); setMoveTo(''); setReason(''); } }); }}>
                      <label className="ops-field"><span>Hand over to</span>
                        <select required value={moveTo} onChange={event => setMoveTo(event.target.value)}>
                          <option value="">Choose a staff member</option>
                          {staff.filter(member => member._id !== row.assignedTo).map(member => <option key={member._id} value={member._id}>{member.name}</option>)}
                        </select>
                      </label>
                      <label className="ops-field ops-grow"><span>Reason</span>
                        <input required maxLength={300} value={reason} placeholder="Why is it moving?" onChange={event => setReason(event.target.value)} />
                      </label>
                      <button type="submit" className="ops-primary" disabled={busy || !moveTo || !reason.trim()}>Hand over</button>
                      <button type="button" className="ops-ghost" onClick={() => setMoving('')}><X size={15} /></button>
                    </form>
                  </td>
                </tr>}
                {open === row._id && <tr key={`${row._id}-trail`} className="ops-sub">
                  <td colSpan={11}>
                    <h3>Where it has been</h3>
                    {trail.length ? <ol className="ops-trail">
                      {trail.map((hop, index) => <li key={`${hop.at}-${index}`}>
                        <span className="ops-trail-mark">{index + 1}</span>
                        <div>
                          <strong>{hop.fromName || 'Not recorded'} <ArrowRight size={13} aria-hidden="true" /> {hop.toName || 'Not recorded'}</strong>
                          <small>{when(hop.at)}{hop.byName && hop.byName !== hop.fromName ? ` · moved by ${hop.byName}` : ''}</small>
                          <p>{hop.reason || 'No reason given'}</p>
                        </div>
                      </li>)}
                    </ol> : <p className="ops-empty">No trail on this one yet.</p>}
                  </td>
                </tr>}
              </>;
            })}
          </tbody>
        </table>
      </div>
      {loading && !rows.length && <p className="ops-empty">Loading…</p>}
      {!loading && !shown.length && <p className="ops-empty"><AlertTriangle size={16} aria-hidden="true" /> {rows.length ? 'Nothing matches this selection.' : 'No work handed out yet. Use the form above.'}</p>}
    </section>

    {chat && createPortal(<div className="ops-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setChatId(''); }}>
      {/* The same messenger the task discussion uses, so both read alike. */}
      <div className="task-chat-card ops-chat-card" role="dialog" aria-modal="true" aria-label={`Discussion on ${chat.title}`}>
        <div className="task-chat-header">
          <div className="task-chat-header-info">
            <div className="task-chat-avatar-stack">
              <div className="chat-avatar-pill avatar-md" title="Managing Director (You)">👑</div>
              <div className="chat-avatar-pill avatar-staff" title={chat.assignedToName || 'Staff'}>
                {(chat.assignedToName || 'S').charAt(0).toUpperCase()}
              </div>
            </div>
            <div>
              <div className="task-chat-title">
                <span>{chat.title}</span>
                <span className="task-chat-live-pulse" />
              </div>
              <div className="task-chat-subtitle">
                {chatWith.length ? `Direct line with ${chatWith.join(', ')}` : 'Nobody on this work yet'}
              </div>
            </div>
          </div>
          <span className="task-chat-counter-pill">
            {(chat.messages || []).length} {(chat.messages || []).length === 1 ? 'message' : 'messages'}
          </span>
          <button type="button" className="ops-chat-close" onClick={() => setChatId('')} aria-label="Close"><X size={17} /></button>
        </div>

        <div className="task-chat-feed" ref={feed}>
          <div className="task-chat-date-divider"><span>Where it has been</span></div>
          <ol className="ops-chat-trail">
            {(chat.assignments || []).map((hop, index) => <li key={`${hop.at}-${index}`}>
              <strong>{hop.fromName} <ArrowRight size={12} aria-hidden="true" /> {hop.toName}</strong>
              <small>{when(hop.at)}{hop.byName && hop.byName !== hop.fromName ? ` · moved by ${hop.byName}` : ''}</small>
              <span>{hop.reason}</span>
            </li>)}
          </ol>

          <div className="task-chat-date-divider"><span>Discussion History</span></div>
          {(chat.messages || []).length ? (chat.messages || []).map((line, index) => {
            const fromMD = line.byRole === 'owner';
            return <div key={`${line.at}-${index}`} className={`task-chat-row ${fromMD ? 'row-owner' : 'row-staff'}`}>
              {!fromMD && <div className="chat-bubble-avatar"><span>{(line.byName || 'S').charAt(0).toUpperCase()}</span></div>}
              <div className={fromMD ? 'task-chat-bubble-owner' : 'task-chat-bubble-staff'}>
                {!fromMD && <div className="bubble-meta-header"><span className="bubble-author-name">{line.byName || 'Staff'}</span></div>}
                <p className="bubble-text">{line.text}</p>
                <div className="bubble-meta-footer">
                  <span className="bubble-timestamp">{when(line.at)}</span>
                  {fromMD && <span className="bubble-ticks" title="Sent"><Check size={14} /></span>}
                </div>
              </div>
            </div>;
          }) : (
            <div className="task-chat-empty-state">
              <div className="chat-empty-icon">💬</div>
              <div className="chat-empty-title">No discussion notes yet</div>
              <div className="chat-empty-desc">Send a message below to give instructions, check status, or guide staff.</div>
            </div>
          )}
        </div>

        <form className="task-chat-dock" onSubmit={event => {
          event.preventDefault();
          const text = draft.trim();
          if (!text) return;
          void call(`/${chat._id}/message`, 'POST', { text }).then(ok => { if (ok) setDraft(''); });
        }}>
          <div className="chat-input-wrapper">
            <input
              autoFocus
              type="text"
              className="task-chat-input"
              maxLength={1000}
              value={draft}
              placeholder={`Type a message to ${chatWith[0] || 'the team'}... (Press Enter to send)`}
              onChange={event => setDraft(event.target.value)}
            />
            <button type="submit" className="task-chat-send-btn" disabled={busy || !draft.trim()} title="Send message">
              <Send size={15} /><span>Send</span>
            </button>
          </div>
        </form>
      </div>
    </div>, document.body)}
  </div>;
}
