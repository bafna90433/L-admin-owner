import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, Languages, Loader2, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as XLSX from 'xlsx';
import { today } from './Production';
import '../styles/Production.css';
import '../styles/Ask.css';

interface AskReply {
  answer: string;
  model: string;
  period: { from: string; to: string; days: number };
  data: Record<string, unknown>;
}
interface Turn {
  id: string;
  question: string;
  answer: string;
  model: string;
  at: string;
  data?: Record<string, unknown> | null;
  failed?: boolean;
}
interface Thread { id: string; title: string; at: string; turns: Turn[] }

const STORE = 'production_ask_threads';
// One window wide enough for "last week", "last month" and "last quarter", so
// the page needs no date picker: the question itself says which part matters.
const LOOK_BACK_DAYS = 90;
const EXAMPLES = [
  'Last 7 days me kitna production hua?',
  'Kitna damage nikla, kaunse toy me sabse zyada?',
  'Sabse achha production kisne diya aur kisne kam?',
  'Kaunse work step target se peeche chal rahe hain?',
  'Kis worker ko kaunsa kaam dena chahiye?'
];

/**
 * The answer's own tables, turned into sheets.
 *
 * The workbook used to hold the whole data pack whatever was asked, so the
 * damage question and the worker question downloaded the same file. What the
 * reader wants is the table they are looking at, which the answer already
 * contains.
 */
const plain = (cell: string) => cell.replace(/\*\*/g, '').replace(/`/g, '').trim();
function tablesFromAnswer(answer: string) {
  const lines = answer.split('\n');
  const tables: { title: string; rows: string[][] }[] = [];
  let heading = '';
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (/^#{1,6}\s/.test(line)) { heading = plain(line.replace(/^#+\s*/, '')); continue; }
    if (/^\*\*[^*]+\*\*:?$/.test(line)) { heading = plain(line.replace(/:$/, '')); continue; }
    const divider = (lines[index + 1] || '').trim();
    const isTableStart = line.startsWith('|') && /^\|[\s:|-]+\|$/.test(divider);
    if (!isTableStart) continue;
    const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map(plain);
    const rows = [cells(line)];
    let cursor = index + 2;
    while (cursor < lines.length && lines[cursor].trim().startsWith('|')) rows.push(cells(lines[cursor++]));
    tables.push({ title: heading || `Table ${tables.length + 1}`, rows });
    index = cursor - 1;
    heading = '';
  }
  return tables;
}

/** Whatever the data pack holds, for when the answer carried no table. */
function packSheets(book: XLSX.WorkBook, data: Record<string, unknown>) {
  const add = (name: string, rows: unknown) => {
    if (!Array.isArray(rows) || !rows.length) return;
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows as object[]), name.slice(0, 31));
  };
  const damage = data.damage as Record<string, unknown> | undefined;
  const totals = data.totals as Record<string, unknown> | undefined;
  if (totals) add('Totals', [totals]);
  add('Day by day', data.dailyTotals);
  add('Workers', data.workers);
  add('Toys', data.toys);
  add('Work steps', data.workSteps);
  add('Review flags', data.reviewFlags);
  add('Records broken', data.recordsBroken);
  add('Standing records', data.standingRecords);
  if (damage) { add('Damage by toy', damage.byToy); add('Damage by part', damage.byPart); }
}

function toWorkbook(turn: { question: string; answer: string; data?: Record<string, unknown> | null }) {
  const book = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const table of tablesFromAnswer(turn.answer)) {
    let name = (table.title || 'Table').slice(0, 28).replace(/[\/?*[\]:]/g, ' ').trim() || 'Table';
    let n = 2;
    while (used.has(name)) name = `${name.slice(0, 26)} ${n++}`;
    used.add(name);
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(table.rows), name);
  }
  // No table in the answer, so give the figures it was drawn from instead.
  if (!book.SheetNames.length && turn.data) packSheets(book, turn.data);
  if (!book.SheetNames.length) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Question', turn.question], ['Answer', turn.answer]]), 'Answer');
  return book;
}

/**
 * Models sometimes wrap figures in LaTeX — \( 1,234 \), $19,740$ — which the
 * markdown renderer shows raw. The numbers are plain numbers, so the wrappers
 * come off.
 */
const cleanMath = (text: string) => text
  .replace(/\\\((.+?)\\\)/gs, '$1')
  .replace(/\\\[(.+?)\\\]/gs, '$1')
  .replace(/\$\$(.+?)\$\$/gs, '$1')
  .replace(/\$([^$\n]{1,80})\$/g, '$1')
  .replace(/\\text\{(.*?)\}/g, '$1')
  .replace(/\\times/g, '×')
  .replace(/\\approx/g, '≈');

/** Did the question actually ask for a file? */
const wantsFile = (text: string) => /(excel|xlsx|spreadsheet|sheet|csv|file|download)/i.test(text) || /(file|sheet|excel)\s*(me|mein|banake|bana ke|bana do|chahiye|chaiye|chaye|do)/i.test(text);
/**
 * The answer counts too: when it says "the Excel button is below this message",
 * there had better be one. Tying the button to both halves means the promise
 * and the button can never disagree.
 */
const offersFile = (turn: { question: string; answer: string }) =>
  wantsFile(turn.question) || /(excel|xlsx|spreadsheet|download)/i.test(turn.answer);

/**
 * Threads are kept in this browser so the history is still there tomorrow.
 * The figures behind an answer are the bulky part, so they are dropped from
 * the older turns first when the browser's storage runs out, rather than
 * losing the conversation itself.
 */
function saveThreads(threads: Thread[]) {
  const trim = (level: number): Thread[] => threads.slice(0, 25).map((thread, index) => ({
    ...thread,
    turns: thread.turns.map((turn, turnIndex) => (index === 0 && turnIndex >= thread.turns.length - level) ? turn : { ...turn, data: null })
  }));
  for (const level of [3, 1, 0]) {
    try { localStorage.setItem(STORE, JSON.stringify(trim(level))); return; } catch { /* try with less */ }
  }
}
function loadThreads(): Thread[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '[]') as Thread[];
    return Array.isArray(saved) ? saved.filter(thread => thread && Array.isArray(thread.turns)) : [];
  } catch { return []; }
}

export default function ProductionAsk({ token, apiBase }: { token: string | null; apiBase: string }) {
  const [threads, setThreads] = useState<Thread[]>(loadThreads);
  const [openId, setOpenId] = useState<string>(() => loadThreads()[0]?.id || '');
  const [question, setQuestion] = useState('');
  const [hinglish, setHinglish] = useState(() => localStorage.getItem('production_ask_lang') === 'hinglish');
  const [busy, setBusy] = useState(false);
  const thread = useRef<HTMLDivElement>(null);

  const open = threads.find(row => row.id === openId) || null;
  const turns = open?.turns || [];

  useEffect(() => { saveThreads(threads); }, [threads]);
  useEffect(() => { localStorage.setItem('production_ask_lang', hinglish ? 'hinglish' : 'en'); }, [hinglish]);
  useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: 'smooth' }); }, [turns.length, busy]);

  const ask = async (text: string) => {
    const asked = text.trim();
    if (!asked || busy) return;
    setBusy(true);
    setQuestion('');
    const threadId = open?.id || `t${Date.now()}`;
    const turnId = `${Date.now()}`;
    // A follow-up should know what was already said in this thread.
    // The whole thread goes along; the server decides how much of it fits.
    const history = turns.filter(turn => !turn.failed).map(turn => ({ question: turn.question, answer: turn.answer }));
    const place = (turn: Turn) => setThreads(all => {
      const existing = all.find(row => row.id === threadId);
      if (existing) return all.map(row => row.id === threadId ? { ...row, turns: [...row.turns, turn] } : row);
      return [{ id: threadId, title: asked.slice(0, 60), at: new Date().toISOString(), turns: [turn] }, ...all];
    });
    setOpenId(threadId);
    try {
      const response = await fetch(`${apiBase}/production/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: asked, days: LOOK_BACK_DAYS, to: today(), lang: hinglish ? 'hinglish' : 'en', history })
      });
      const raw = await response.text();
      let body: (AskReply & { message?: string }) | null = null;
      try { body = JSON.parse(raw) as AskReply & { message?: string }; } catch { body = null; }
      if (!body) throw new Error('The connected server does not have the assistant yet. It arrives with the next backend update.');
      if (!response.ok) throw new Error(body.message || `The assistant could not answer (HTTP ${response.status}).`);
      place({ id: turnId, question: asked, answer: body.answer, model: body.model, at: new Date().toISOString(), data: body.data });
    } catch (reason) {
      place({ id: turnId, question: asked, answer: reason instanceof Error ? reason.message : 'The assistant could not answer.', model: '', at: new Date().toISOString(), data: null, failed: true });
    } finally {
      setBusy(false);
    }
  };

  const download = (turn: Turn) => {
    const period = turn.data?.period as { from: string; to: string } | undefined;
    // Named after what was asked, so two downloads are never the same file.
    const name = turn.question.replace(/[^a-z0-9]+/gi, '-').slice(0, 44).replace(/^-|-$/g, '').toLowerCase() || 'answer';
    XLSX.writeFile(toWorkbook(turn), `bafna-${name}-${period?.to || ''}.xlsx`);
  };
  const when = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return <div className="production-page ask-page">
    <aside className="ask-side">
      <button type="button" className="ask-new" onClick={() => { setOpenId(''); setQuestion(''); }}><Plus size={17} aria-hidden="true" />New question</button>
      <div className="ask-side-head"><span>History</span>{threads.length > 0 && <button type="button" onClick={() => { setThreads([]); setOpenId(''); }}>clear all</button>}</div>
      <ul className="ask-history">
        {threads.map(row => <li key={row.id}>
          <button type="button" className={row.id === openId ? 'on' : ''} onClick={() => setOpenId(row.id)}>
            <span className="ask-dot" aria-hidden="true" />
            <span className="ask-history-title">{row.title}</span>
          </button>
          <button type="button" className="ask-history-drop" aria-label={`Delete ${row.title}`} onClick={() => { setThreads(all => all.filter(item => item.id !== row.id)); if (openId === row.id) setOpenId(''); }}><Trash2 size={14} /></button>
        </li>)}
        {!threads.length && <li className="ask-history-empty">Nothing asked yet.</li>}
      </ul>
      <p className="ask-side-foot">Kept in this browser. Answers use the last {LOOK_BACK_DAYS} days of records.</p>
    </aside>

    <section className="ask-main">
      <header className="ask-bar">
        <h1>Ask the factory</h1>
        <div className="ask-languages" role="group" aria-label="Reply language">
          <Languages size={15} aria-hidden="true" />
          <button type="button" className={`ask-lang ${!hinglish ? 'on' : ''}`} aria-pressed={!hinglish} onClick={() => setHinglish(false)}>English</button>
          <button type="button" className={`ask-lang ${hinglish ? 'on' : ''}`} aria-pressed={hinglish} onClick={() => setHinglish(true)}>Hinglish</button>
        </div>
      </header>

      <div className="ask-thread" ref={thread}>
        {!turns.length && !busy && <div className="ask-welcome">
          <span className="ask-welcome-mark" aria-hidden="true"><Sparkles size={26} /></span>
          <h2>What would you like to know?</h2>
          <p>Answers come from this factory&rsquo;s own production, damage, target and record data — and every answer can be downloaded as an Excel file.</p>
          <div className="ask-examples">
            {EXAMPLES.map(text => <button key={text} type="button" onClick={() => void ask(text)}>{text}</button>)}
          </div>
        </div>}

        {turns.map(turn => <div className="ask-turn" key={turn.id}>
          <div className="ask-bubble ask-mine"><p>{turn.question}</p></div>
          <div className={`ask-reply ${turn.failed ? 'is-failed' : ''}`}>
            <span className="ask-avatar" aria-hidden="true">{turn.failed ? <AlertTriangle size={16} /> : <Sparkles size={16} />}</span>
            <div className="ask-reply-body">
              {turn.failed
                ? <p className="ask-failed-text">{turn.answer}</p>
                : <div className="ask-answer"><ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanMath(turn.answer)}</ReactMarkdown></div>}
              <div className="ask-reply-foot">
                {!turn.failed && <span>{turn.model} · {when(turn.at)}</span>}
                {!turn.failed && offersFile(turn) && <button type="button" onClick={() => download(turn)}><Download size={15} aria-hidden="true" />Download Excel</button>}
              </div>
            </div>
          </div>
        </div>)}

        {busy && <div className="ask-reply">
          <span className="ask-avatar" aria-hidden="true"><Loader2 size={16} className="production-spin" /></span>
          <div className="ask-reply-body"><p className="ask-thinking">Reading the records…</p></div>
        </div>}
      </div>

      <form className="ask-composer" onSubmit={event => { event.preventDefault(); void ask(question); }}>
        <textarea
          value={question}
          onChange={event => setQuestion(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(question); } }}
          placeholder="Ask about production, damage, targets or workers…"
          rows={1}
          maxLength={1000}
          disabled={busy}
        />
        <button type="submit" aria-label="Ask" disabled={busy || !question.trim()}>
          {busy ? <Loader2 size={18} className="production-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
        </button>
      </form>
      <p className="ask-note">Enter sends · Shift + Enter for a new line.</p>
    </section>
  </div>;
}
