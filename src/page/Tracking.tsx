import { useState } from 'react';
import { AlertTriangle, ImageOff, PackageSearch, RefreshCw } from 'lucide-react';
import { number, useProductionRead } from './Production';

interface Step { id: string; name: string; under: string; underType: string; imageUrl: string; pieces: number }
interface Waiting { after: string; before: string; pieces: number }
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
  notStarted: number | null;
  waiting: Waiting[];
  steps: Step[];
}

const sentence = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : text);
const share = (value: number, of: number) => (of > 0 ? Math.min(100, Math.round((value / of) * 100)) : 0);

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
  const [search, setSearch] = useState('');
  const tracking = useProductionRead<{ toys: Card[] }>(`${apiBase}/production/tracking`, token, refresh);

  const cards = (tracking.data?.toys || [])
    .filter(card => card.isModel)
    .filter(card => !search.trim() || `${card.name} ${card.typeName}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => (b.intake || 0) - (a.intake || 0) || b.ready - a.ready || a.name.localeCompare(b.name));

  return <div className="production-page">
    <header className="production-header">
      <div>
        <span className="production-eyebrow"><PackageSearch size={16} aria-hidden="true" /> Owner overview · Read only</span>
        <h1>Toy tracking</h1>
        <p>One card per model: what the parts could make, how far down the line it has got, and what is waiting in between. Counted from the beginning, not over a period.</p>
      </div>
      <button type="button" className="production-refresh" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} aria-hidden="true" />Refresh</button>
    </header>

    <div className="production-filters production-card">
      <label>Find a model<input value={search} placeholder="Bird, fighter-jet, packing…" onChange={event => setSearch(event.target.value)} /></label>
      <span className="production-count">{cards.length} {cards.length === 1 ? 'model' : 'models'}</span>
    </div>

    {tracking.error && <p className="production-error" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {tracking.error} Use Refresh to retry.</p>}
    {tracking.busy && !tracking.data && <p className="production-empty" role="status">Reading the line…</p>}
    {!tracking.busy && tracking.data && !cards.length && <p className="production-empty">No model has work recorded against it yet.</p>}

    <div className="track-grid">
      {cards.map(card => {
        const first = card.steps[0];
        // What the breakdown adds up to: pieces waiting between steps, parts
        // never started, and anything reported broken.
        const total = card.waiting.reduce((sum, row) => sum + row.pieces, 0) + (card.notStarted || 0) + card.damage;
        // How many pieces of this model exist at all. Assembly is where a toy
        // becomes the toy, so that is the step to read — but only if it has
        // been recorded. Where it has not, the busiest of the model's own steps
        // says it instead, named so the figure explains itself.
        const own = card.steps.filter(step => !step.under);
        const assembled = own.find(step => /assembl/i.test(step.name) && step.pieces > 0);
        const busiest = own.reduce<Step | undefined>((best, step) => (!best || step.pieces > best.pieces ? step : best), undefined);
        const made = assembled || (busiest && busiest.pieces > 0 ? busiest : first);
        const top = Math.max(card.intake || 0, ...card.steps.map(step => step.pieces), 1);
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

          <ol className="track-steps">
            {card.steps.map(step => (
              <li key={step.id}>
                <span className="track-step-name">
                  {sentence(step.name)}
                  {step.under && <em>in {sentence(step.under)}{step.underType ? ` · ${sentence(step.underType)}` : ''}</em>}
                </span>
                <span className="track-bar"><span style={{ width: `${Math.max(2, share(step.pieces, top))}%` }} /></span>
                <span className="track-step-pcs">{number(step.pieces)}<small>{card.intake ? `${share(step.pieces, card.intake)}%` : ''}</small></span>
              </li>
            ))}
            {!card.steps.length && <li className="track-none">No work steps set up for this model yet.</li>}
          </ol>

          <div className="track-totals">
            {/* Ready is what the first step has made — the pieces that exist as
                this model at all. The rest of the line is read off the steps
                above and the breakdown below. */}
            <div><span>Ready{made ? ` · ${sentence(made.name)}` : ''}</span><strong>{number(made?.pieces || 0)}</strong></div>
            <div><span>Damage</span><strong>{number(card.damage)}</strong></div>
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
