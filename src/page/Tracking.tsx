import { useEffect, useState } from 'react';
import { AlertTriangle, ImageOff, PackageSearch, RefreshCw } from 'lucide-react';
import { number, today, useProductionRead } from './Production';

interface Step { id: string; name: string; under: string; underType: string; imageUrl: string; pieces: number }
interface Waiting { after: string; before: string; pieces: number }
interface Broken { name: string; qty: number }
interface Card {
  id: string;
  name: string;
  imageUrl: string;
  typeName: string;
  /** False for a packing or checking bench, which is a job rather than a model. */
  isModel: boolean;
  /** How many pieces the parts that arrived could make; null when nothing is mapped. */
  intake: number | null;
  intakeFrom: string;
  ready: number;
  damage: number;
  /** Every part of the toy with what has broken of it, largest first. */
  damageParts?: Broken[];
  notStarted: number | null;
  waiting: Waiting[];
  steps: Step[];
  /** Work the model still goes through after its line is marked finished —
   *  the cleaning or packing bench it is sent to afterwards. */
  after?: Step[];
  /** Shared by the models that go into one packet, so their cards sit together. */
  pairKey: string;
  /** True when a step has been marked as finishing the toy, so the line ends there. */
  markedEnd?: boolean;
}

const sentence = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : text);
/** Names are typed by many hands, so compare them bare. */
const flat = (text: string) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const share = (value: number, of: number) => (of > 0 ? Math.min(100, Math.round((value / of) * 100)) : 0);
const shiftDay = (key: string, days: number) => new Date(new Date(`${key}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

/**
 * Where every model's work has got to.
 *
 * The floor's question is never "how many pieces this week". It is "parts came
 * in for fifty thousand, forty thousand are packed — where are the other ten
 * thousand", and the answer is always a pile sitting between two work steps.
 * So each model is one card: what arrived, what each step has done, and what
 * is waiting in the gaps.
 *
 * Everything counts from the beginning rather than over a period. Parts that
 * came in last month are still parts, and a piece left half-finished in
 * September is still half-finished today.
 */
export default function Tracking({ token, apiBase }: { token: string | null; apiBase: string }) {
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState<string>('');
  const [broken, setBroken] = useState<string>('');
  // What broke opens over the page rather than pushing the card about: the
  // toy, then its parts, which is how the floor asks the question.
  useEffect(() => {
    if (!broken) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setBroken(''); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [broken]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [doing, setDoing] = useState<'all' | 'working' | 'idle'>('all');
  const [order, setOrder] = useState<'line' | 'ready' | 'name'>('line');
  // When the owner asks about a stretch of days rather than the whole story.
  const [period, setPeriod] = useState<'all' | 'today' | 'yesterday' | '7' | '30' | 'custom'>('all');
  const [from, setFrom] = useState(() => shiftDay(today(), -29));
  const [to, setTo] = useState(today);
  const span = (() => {
    const day = today();
    if (period === 'today') return { from: day, to: day };
    if (period === 'yesterday') return { from: shiftDay(day, -1), to: shiftDay(day, -1) };
    if (period === '7') return { from: shiftDay(day, -6), to: day };
    if (period === '30') return { from: shiftDay(day, -29), to: day };
    if (period === 'custom') return { from, to };
    return { from: '', to: '' };
  })();
  const tracking = useProductionRead<{ toys: Card[] }>(
    `${apiBase}/production/tracking${span.from ? `?from=${span.from}&to=${span.to}` : ''}`,
    token,
    refresh
  );

  const models = (tracking.data?.toys || []).filter(card => card.isModel);
  const categories = [...new Set(models.map(card => card.typeName).filter(Boolean))].sort();
  /** Pieces recorded anywhere on this model's line — what "working" means here. */
  const done = (card: Card) => card.steps.reduce((sum, step) => sum + step.pieces, 0);
  const shown = models
    .filter(card => !category || card.typeName === category)
    .filter(card => (doing === 'all' ? true : doing === 'working' ? done(card) > 0 : done(card) === 0))
    .filter(card => !search.trim() || `${card.name} ${card.typeName}`.toLowerCase().includes(search.trim().toLowerCase()));
  // Models packed together are read together, so they travel as one block —
  // a helicopter and the plane that shares its packet sit side by side. The
  // blocks themselves go tallest first, because a card with ten work steps is
  // three times the height of one with a single step and mixing the two leaves
  // holes down the grid.
  const group = (card: Card) => card.pairKey || card.id;
  const tallest = new Map<string, number>();
  const rows = (card: Card) => card.steps.length + (card.after || []).length;
  for (const card of shown) tallest.set(group(card), Math.max(tallest.get(group(card)) || 0, rows(card)));
  const cards = [...shown].sort((a, b) => {
    if (order === 'name') return a.name.localeCompare(b.name);
    if (order === 'ready') return done(b) - done(a) || a.name.localeCompare(b.name);
    return (tallest.get(group(b)) || 0) - (tallest.get(group(a)) || 0)
      || group(a).localeCompare(group(b))
      || rows(b) - rows(a)
      || (b.intake || 0) - (a.intake || 0)
      || a.name.localeCompare(b.name);
  });

  return <div className="production-page">
    <header className="production-header">
      <div>
        <span className="production-eyebrow"><PackageSearch size={16} aria-hidden="true" /> Owner overview · Read only</span>
        <h1>Toy tracking</h1>
        <p>One card per model: what the parts could make, how far down the line it has got, and what is waiting in between. {span.from ? `Counting ${span.from === span.to ? span.from : `${span.from} to ${span.to}`} only — parts and pieces from before it are left out.` : 'Counted from the beginning.'}</p>
      </div>
      <button type="button" className="production-refresh" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} aria-hidden="true" />Refresh</button>
    </header>

    <div className="production-filters production-card">
      <label>Find a model<input value={search} placeholder="Bird, fighter-jet, packing…" onChange={event => setSearch(event.target.value)} /></label>
      <label>Dates
        <select value={period} onChange={event => setPeriod(event.target.value as typeof period)}>
          <option value="all">From the beginning</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="custom">Pick the dates</option>
        </select>
      </label>
      {/* The two dates are always here, showing whatever the choice above works
          out to. Typing in one is itself the choice: it switches to the dates
          picked rather than making the owner find the option first. */}
      <label>From
        <input type="date" value={span.from} max={span.to || undefined}
          onChange={event => { if (event.target.value) { setFrom(event.target.value); setTo(span.to || today()); setPeriod('custom'); } }} />
      </label>
      <label>To
        <input type="date" value={span.to} min={span.from || undefined}
          onChange={event => { if (event.target.value) { setTo(event.target.value); setFrom(span.from || event.target.value); setPeriod('custom'); } }} />
      </label>
      <label>Category
        <select value={category} onChange={event => setCategory(event.target.value)}>
          <option value="">Every category</option>
          {categories.map(name => <option key={name} value={name}>{sentence(name)}</option>)}
        </select>
      </label>
      <label>Show
        <select value={doing} onChange={event => setDoing(event.target.value as 'all' | 'working' | 'idle')}>
          <option value="all">All models</option>
          <option value="working">Work recorded</option>
          <option value="idle">Nothing recorded yet</option>
        </select>
      </label>
      <label>Order
        <select value={order} onChange={event => setOrder(event.target.value as 'line' | 'ready' | 'name')}>
          <option value="line">Longest line first</option>
          <option value="ready">Most made first</option>
          <option value="name">Name A–Z</option>
        </select>
      </label>
      {(search || category || doing !== 'all' || order !== 'line' || period !== 'all') && <button type="button" className="track-clear" onClick={() => { setSearch(''); setCategory(''); setDoing('all'); setOrder('line'); setPeriod('all'); }}>Clear</button>}
      <span className="production-count">{cards.length} of {models.length} {models.length === 1 ? 'model' : 'models'}</span>
    </div>

    {tracking.error && <p className="production-error" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {tracking.error} Use Refresh to retry.</p>}
    {tracking.busy && !tracking.data && <p className="production-empty" role="status">Reading the line…</p>}
    {!tracking.busy && tracking.data && !cards.length && <p className="production-empty">No model has work recorded against it yet.</p>}

    <div className="track-grid">
      {cards.map(card => {
        // What the breakdown adds up to: pieces waiting between steps, parts
        // never started, and anything reported broken.
        const total = card.waiting.reduce((sum, row) => sum + row.pieces, 0) + (card.notStarted || 0) + card.damage;
        const top = Math.max(card.intake || 0, ...card.steps.map(step => step.pieces), ...(card.after || []).map(step => step.pieces), 1);
        // The card shows one list at a time: the line, or what broke on it.
        const showBroken = broken === card.id;
        const worst = Math.max(1, ...(card.damageParts || []).map(part => part.qty));

        const showing = open === card.id;
        return <article className="production-card track-card" key={card.id}>
          <header>
            {card.imageUrl
              ? <img src={card.imageUrl} alt="" loading="lazy" />
              : <span className="track-nophoto" aria-hidden="true"><ImageOff size={22} /></span>}
            <div>
              <h2>{sentence(card.name)}</h2>
              <p>{card.typeName ? sentence(card.typeName) : 'No category'}</p>
            </div>
            <span className="track-intake">
              {card.intake === null
                ? <em>Parts not mapped</em>
                : <><strong>{number(card.intake)}</strong><small>parts came in for</small></>}
            </span>
          </header>

          {card.intakeFrom && <p className="track-limit">Limited by <strong>{card.intakeFrom}</strong> — the part that runs out first.</p>}

          {showBroken ? <ol className="track-steps">
            {(card.damageParts || []).map(part => (
              <li key={part.name}>
                <span className="track-step-name">{sentence(part.name)}</span>
                <span className="track-bar"><span style={{ width: `${Math.max(2, share(part.qty, worst))}%` }} /></span>
                <span className="track-step-pcs">{number(part.qty)}</span>
              </li>
            ))}
            {!(card.damageParts || []).length && <li className="track-none">No parts listed for this model yet.</li>}
          </ol> : <ol className="track-steps">
            {card.steps.map(step => {
              // A bench step is named after the model it is doing, so printing
              // both reads "Fish in Bopp checking" four lines deep. The bench
              // and its job say it in two words; a step named something else
              // keeps its own name and says where it is done.
              const echo = flat(step.name) === flat(card.name);
              const title = step.under && echo ? sentence(step.under) : sentence(step.name);
              const where = step.under ? (echo ? sentence(step.underType) : `in ${sentence(step.under)}`) : '';
              return (
              <li key={step.id}>
                <span className="track-step-name">
                  {title}
                  {where && <em>{where}</em>}
                </span>
                <span className="track-bar"><span style={{ width: `${Math.max(2, share(step.pieces, top))}%` }} /></span>
                <span className="track-step-pcs">{number(step.pieces)}<small>{card.intake ? `${share(step.pieces, card.intake)}%` : ''}</small></span>
              </li>
              );
            })}
            {!card.steps.length && <li className="track-none">No work steps set up for this model yet.</li>}
          </ol>}

          {/* The line is marked to end, but the floor still cleans and packs
              the model afterwards and records it. Those figures are shown
              apart so the ready count the mark was set for stays as it is. */}
          {!showBroken && (card.after || []).length > 0 && <div className="track-after">
            <h3>After it is finished</h3>
            <ol className="track-steps">
              {(card.after || []).map(step => {
                const echo = flat(step.name) === flat(card.name);
                const title = step.under && echo ? sentence(step.under) : sentence(step.name);
                const where = step.under ? (echo ? sentence(step.underType) : `in ${sentence(step.under)}`) : '';
                return (
                  <li key={step.id}>
                    <span className="track-step-name">{title}{where && <em>{where}</em>}</span>
                    <span className="track-bar"><span style={{ width: `${Math.max(2, share(step.pieces, top))}%` }} /></span>
                    <span className="track-step-pcs">{number(step.pieces)}</span>
                  </li>
                );
              })}
            </ol>
          </div>}

          <div className="track-totals">
            {/* Every step's count is on the card already, so a ready tile only
                repeated one of them. What is left is the switch to what broke. */}
            <button type="button" className={`track-tile${showBroken ? ' is-on' : ''}`} aria-pressed={showBroken} onClick={() => setBroken(showBroken ? '' : card.id)}>
              <span>Damage{(card.damageParts || []).length ? ` · ${(card.damageParts || []).length} ${(card.damageParts || []).length === 1 ? 'part' : 'parts'}` : ''}</span>
              <strong>{number(card.damage)}</strong>
            </button>
          </div>

          {(card.waiting.length > 0 || card.notStarted) ? <>
            <button type="button" className="track-open" onClick={() => setOpen(showing ? '' : card.id)} aria-expanded={showing}>
              {showing ? 'Hide where it is sitting' : 'Where is it sitting?'}
            </button>
            {showing && <table className="track-gaps">
              <tbody>
                {card.notStarted ? <tr>
                  <th scope="row">Not started</th>
                  <td>parts on the shelf, {first ? sentence(first.name) : 'the first step'} not done</td>
                  <td>{number(card.notStarted)}</td>
                </tr> : null}
                {card.waiting.map(row => <tr key={`${row.after}|${row.before}`}>
                  <th scope="row">After {sentence(row.after)}</th>
                  <td>waiting for {sentence(row.before)}</td>
                  <td>{number(row.pieces)}</td>
                </tr>)}
                {card.damage > 0 && <tr>
                  <th scope="row">Damage</th>
                  <td>reported broken</td>
                  <td>{number(card.damage)}</td>
                </tr>}
                <tr className="track-gaps-total">
                  <th scope="row">Total</th>
                  <td />
                  <td>{number(total)}</td>
                </tr>
              </tbody>
            </table>}
          </> : null}
        </article>;
      })}
    </div>

  </div>;
}
