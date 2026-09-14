import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  IndianRupee,
  Paperclip,
  Mic,
  Volume2,
  ArrowUp,
  ArrowRight,
  Copy,
  Check,
  RotateCw,
  Plus,
  AlertTriangle,
  Languages,
  Trash2,
  Users,
  X,
  Globe,
  ExternalLink
} from 'lucide-react';
import '../styles/AiCouncil.css';

/* ------------------------------------------------------------------
   AI Council — ask one question, get answers from Gemini, ChatGPT and
   Claude side by side. If one answer is clearly better, continue the
   conversation with that model alone; switch back to all three anytime.

   Reply language: English by default. If the question asks for Hinglish
   (or is written in Hindi) the replies switch to Hinglish, and stay
   there until English is asked for again.

   DEMO MODE: sample answers are generated locally so the page can be
   reviewed before the API keys are purchased. The layout stays
   identical once the real backend route is connected.
   ------------------------------------------------------------------ */

type ModelId = 'gemini' | 'gpt' | 'claude';
type AnswerStatus = 'thinking' | 'streaming' | 'done' | 'error';
type Lang = 'en' | 'hinglish';

interface ModelMeta {
  id: ModelId;
  name: string;
  vendor: string;
  initials: string;
  c1: string;
  c2: string;
}

const MODELS: ModelMeta[] = [
  { id: 'gemini', name: 'Gemini', vendor: 'Google', initials: 'G', c1: '#4f8bff', c2: '#a86cff' },
  { id: 'gpt', name: 'ChatGPT', vendor: 'OpenAI', initials: 'O', c1: '#10a37f', c2: '#34d399' },
  { id: 'claude', name: 'Claude', vendor: 'Anthropic', initials: 'C', c1: '#e07b39', c2: '#f5b467' }
];

const ALL_IDS: ModelId[] = ['gemini', 'gpt', 'claude'];
const metaOf = (id: ModelId) => MODELS.find(m => m.id === id)!;

const modelStyle = (m: ModelMeta) =>
  ({ ['--m1' as string]: m.c1, ['--m2' as string]: m.c2 }) as React.CSSProperties;

/** A page the model cited, shown as a card under the answer. */
interface SourceCard {
  url: string;
  title: string;
  site: string;
  host: string;
  image: string | null;
  favicon: string | null;
}

interface AnswerState {
  status: AnswerStatus;
  text: string;
  ms: number;
  error?: string;
  sources?: SourceCard[];
}

/** The single answer built out of all three, when the MD asks for one. */
interface Summary {
  status: 'idle' | 'working' | 'done' | 'error';
  text: string;
  by?: ModelId;
  error?: string;
}

interface Turn {
  id: string;
  question: string;
  lang: Lang;
  /** Thumbnails of any photos sent with the question. */
  shots?: { name: string; preview: string }[];
  summary?: Summary;
  /** Which models answered this question — all three, or the one being continued with. */
  models: ModelId[];
  answers: Record<ModelId, AnswerState>;
}

/** What each provider has cost so far, and what is left of any top-up. */
interface Spend {
  calls: number;
  input: number;
  output: number;
  usd: number;
}

interface Balance {
  addedUsd: number;
  spentUsd: number;
  leftUsd: number;
  tracked: boolean;
}

interface UsageReport {
  month: string;
  thisMonth: Record<ModelId, Spend>;
  allTime: Record<ModelId, Spend>;
  balance: Record<ModelId, Balance>;
}

/** A photo attached to a question. */
interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  data: string;
  preview: string;
}

/** The browser's dictation API, typed only as far as this page uses it. */
interface SpeechResultEvent {
  resultIndex: number;
  results: { isFinal: boolean; 0: { transcript: string }; length: number }[];
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface Chat {
  id: string;
  title: string;
  lang: Lang;
  /** null = every question goes to all three models. */
  activeModel: ModelId | null;
  turns: Turn[];
  updatedAt: string;
}

const blankAnswers = (): Record<ModelId, AnswerState> => ({
  gemini: { status: 'thinking', text: '', ms: 0 },
  gpt: { status: 'thinking', text: '', ms: 0 },
  claude: { status: 'thinking', text: '', ms: 0 }
});

const CHATS_KEY = 'ai_council_chats';
const ACTIVE_KEY = 'ai_council_active';
const MAX_CHATS = 40;

const STARTERS = [
  'How should I negotiate rates with a new supplier?',
  'Write a polite payment reminder email to a client',
  '5 practical ways to improve staff productivity',
  'Explain GST input credit in simple terms'
];

/* ---------- Reply language ---------- */

const HINGLISH_REQUEST = /\b(hinglish|hindi\s*(me|mein|m\b|language)?|roman\s*hindi)\b|mix(ed)?\s*(hindi|language)/i;
const ENGLISH_REQUEST = /\b(in\s*english|english\s*(me|mein|only|please)?|angrezi)\b/i;
const DEVANAGARI = /[ऀ-ॿ]/;
const ROMAN_HINDI = /\b(mujhe|chahiye|chaye|kaise|kya|hai|hain|mein|mera|meri|mere|batao|dikhao|karo|wala|wali|liye|acha|achha|sabse|kitna|under)\b/gi;

/** Returns the language the message asks for, or null if it asks for nothing. */
function requestedLang(text: string): Lang | null {
  if (ENGLISH_REQUEST.test(text)) return 'en';
  const romanHindiWords = text.match(ROMAN_HINDI)?.length || 0;
  if (HINGLISH_REQUEST.test(text) || DEVANAGARI.test(text) || romanHindiWords >= 2) return 'hinglish';
  return null;
}

/* ---------- Demo answers (replaced by the real API later) ---------- */

function demoAnswer(model: ModelId, question: string, lang: Lang): string {
  const q = question.trim().replace(/\s+/g, ' ');
  const short = q.length > 80 ? q.slice(0, 80) + '...' : q;

  if (lang === 'hinglish') {
    if (model === 'gemini') {
      return `Aapke sawaal "${short}" ka structured jawab:

1. Sabse pehle situation ko clearly define karein — exact requirement aur deadline likh lein.
2. Do ya teen options banayein aur har option ka cost, time aur risk compare karein.
3. Jo option sabse kam risk par sabse zyada value de, usko choose karein.
4. Decision ko likhit me record karein taaki baad me review ho sake.

Quick summary: problem define karein, options compare karein, evidence ke basis par decide karein, aur decision document karein.`;
    }

    if (model === 'gpt') {
      return `Good question. Let me break "${short}" down step by step.

Step 1 — Understand the goal
Sabse pehle yeh clear karein ki aap actually kya achieve karna chahte hain. Bina clear goal ke koi bhi plan kaam nahi karega.

Step 2 — Gather the facts
Jo bhi numbers, dates ya documents available hain, unhe ek jagah rakh lein.

Step 3 — Make the plan
Chhote steps me todein. Har step ka ek owner aur ek deadline ho.

Step 4 — Review after a week
Ek hafte baad check karein ki plan chal raha hai ya nahi, aur zarurat pade to adjust karein.

Bottom line: clarity, chhote steps, aur regular review — yeh teen cheezein zyadatar problems solve kar deti hain.`;
    }

    return `"${short}" — is par sochne ka tareeka main aise rakhunga.

Pehle yeh dekhna zaroori hai ki iska jawab har situation me alag ho sakta hai, isliye ek hi formula dena theek nahi hoga. Do cheezein maayne rakhti hain: aapke paas time kitna hai, aur galti hone par nuksaan kitna hoga.

Agar nuksaan kam hai — jaldi decision le lein aur aage badhein. Detail me atakna yahan waqt ki barbaadi hai.

Agar nuksaan bada hai — thoda ruk kar do-teen logon ki raay lein, aur likhit me compare karein.

Ek baat dhyan rakhein: zyadatar log yahan galti karte hain ki chhote decisions par zyada sochte hain aur bade decisions jaldbaazi me le lete hain. Isko ulta kar dein, to results apne aap behtar ho jayenge.`;
  }

  if (model === 'gemini') {
    return `Here is a structured answer to "${short}":

1. Define the situation clearly — write down the exact requirement and the deadline.
2. Prepare two or three options and compare each one on cost, time and risk.
3. Pick the option that delivers the most value at the lowest risk.
4. Record the decision in writing so it can be reviewed later.

Quick summary: define the problem, compare the options, decide on evidence, and document the decision.`;
  }

  if (model === 'gpt') {
    return `Good question. Let me break "${short}" down step by step.

Step 1 — Understand the goal
Be clear about what you are actually trying to achieve. Without a defined goal, no plan will work.

Step 2 — Gather the facts
Collect every relevant number, date and document in one place before you decide anything.

Step 3 — Make the plan
Split the work into small steps. Every step needs one owner and one deadline.

Step 4 — Review after a week
Check whether the plan is holding up, and adjust it where reality turned out different.

Bottom line: clarity, small steps and regular review will solve most problems on their own.`;
  }

  return `"${short}" — here is how I would think about it.

The honest starting point is that the right answer changes with the situation, so a single formula would mislead you. Two things matter most: how much time you have, and how expensive a mistake would be.

If a mistake is cheap, decide quickly and move on. Getting stuck in detail here simply costs you time.

If a mistake is expensive, slow down, ask two or three people you trust, and compare the options in writing.

One thing worth watching: most people do this backwards — they agonise over small decisions and rush the big ones. Reverse that, and the results improve on their own.`;
}

interface AiCouncilProps {
  apiBase?: string;
  token?: string | null;
}

const DEFAULT_API_BASE =
  import.meta.env.VITE_API_BASE || 'https://l-backend-production-ff32.up.railway.app/api';

export default function AiCouncil({ apiBase, token }: AiCouncilProps = {}) {
  const base = apiBase || DEFAULT_API_BASE;
  const authToken = token ?? localStorage.getItem('admin_token');

  const [draft, setDraft] = useState('');
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState<Record<ModelId, boolean>>({ gemini: false, gpt: false, claude: false });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [lang, setLang] = useState<Lang>('en');
  const [activeModel, setActiveModel] = useState<ModelId | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [spend, setSpend] = useState<UsageReport | null>(null);
  // The MD can switch a provider off entirely; the page then acts as if it
  // never existed — no column, no chip, no meter row.
  const [enabled, setEnabled] = useState<Record<ModelId, boolean>>({
    gemini: true,
    gpt: true,
    claude: true
  });
  const [shots, setShots] = useState<Attachment[]>([]);
  const [listening, setListening] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);

  const speechRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shotInputRef = useRef<HTMLInputElement>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);

  const busy = useMemo(
    () =>
      turns.some(t =>
        t.models.some(
          id => t.answers?.[id]?.status === 'thinking' || t.answers?.[id]?.status === 'streaming'
        )
      ),
    [turns]
  );

  /* ---------- which providers have a key on the server ---------- */

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${base}/ai/status`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const next = {
          gemini: !!data.gemini,
          gpt: !!data.gpt,
          claude: !!data.claude
        };
        setReady(next);
        setLive(next.gemini || next.gpt || next.claude);
      } catch {
        /* backend unreachable — stay in demo mode */
      }
    })();

    return () => { cancelled = true; };
  }, [base, authToken]);

  /* ---------- chat history ---------- */

  /**
   * Chats live with the account on the server, so they follow the MD to any
   * PC. The browser copy is kept only as an offline fallback — if the server
   * cannot be reached, at least this machine's history still opens.
   */
  const saveToServer = useCallback(
    async (next: Chat[]) => {
      if (!apiBase || !authToken) return;
      try {
        await fetch(`${apiBase}/ai/chats`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ chats: next.slice(0, MAX_CHATS) })
        });
      } catch {
        /* offline — the local copy below still has it */
      }
    },
    [apiBase, authToken]
  );

  /** Old chats can be missing fields that newer code expects. */
  const normalise = (list: Chat[]): Chat[] =>
    (Array.isArray(list) ? list : []).map(c => ({
      ...c,
      activeModel: c.activeModel ?? null,
      turns: (c.turns || []).map(t => ({
        ...t,
        models: Array.isArray(t.models) && t.models.length ? t.models : ALL_IDS,
        answers: t.answers || blankAnswers()
      }))
    }));

  useEffect(() => {
    let cancelled = false;

    const open = (stored: Chat[]) => {
      if (cancelled) return;
      setChats(stored);

      const last = localStorage.getItem(ACTIVE_KEY);
      const chat = stored.find(c => c.id === last);
      if (chat) {
        setActiveId(chat.id);
        setTurns(chat.turns);
        setLang(chat.lang);
        setActiveModel(chat.activeModel ?? null);
      }
    };

    const load = async () => {
      let local: Chat[] = [];
      try {
        const raw = localStorage.getItem(CHATS_KEY);
        local = normalise(raw ? JSON.parse(raw) : []);
      } catch {
        /* unreadable storage — ignore it */
      }

      if (!apiBase || !authToken) {
        open(local);
        return;
      }

      try {
        const res = await fetch(`${apiBase}/ai/chats`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error('history unavailable');
        const data = await res.json();
        const remote = normalise(data?.chats || []);

        // First run after the move: push what this browser already had up.
        if (!remote.length && local.length) {
          open(local);
          void saveToServer(local);
          return;
        }

        open(remote);
      } catch {
        open(local);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [apiBase, authToken, saveToServer]);

  const writeChats = (next: Chat[]) => {
    setChats(next);
    void saveToServer(next);
    try {
      localStorage.setItem(CHATS_KEY, JSON.stringify(next.slice(0, MAX_CHATS)));
    } catch {
      /* storage blocked — the server copy is the real one */
    }
  };

  // Save the open chat once its answers have finished streaming, so the
  // history survives a refresh without writing on every animation frame.
  useEffect(() => {
    if (!activeId || turns.length === 0 || busy) return;

    const chat: Chat = {
      id: activeId,
      title: turns[0].question.slice(0, 70),
      lang,
      activeModel,
      turns,
      updatedAt: new Date().toISOString()
    };

    setChats(prev => {
      const next = [chat, ...prev.filter(c => c.id !== activeId)].slice(0, MAX_CHATS);
      void saveToServer(next);
      try {
        localStorage.setItem(CHATS_KEY, JSON.stringify(next));
      } catch {
        /* storage blocked */
      }
      return next;
    });
  }, [turns, busy, activeId, lang, activeModel, saveToServer]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* storage blocked */
    }
  }, [activeId]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  const schedule = (fn: () => void, delay: number) => {
    timersRef.current.push(window.setTimeout(fn, delay));
  };

  const stopTimers = () => {
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];
  };

  const patchAnswer = (turnId: string, model: ModelId, patch: Partial<AnswerState>) => {
    setTurns(prev =>
      prev.map(t =>
        t.id === turnId
          ? { ...t, answers: { ...t.answers, [model]: { ...t.answers[model], ...patch } } }
          : t
      )
    );
  };

  /* ---------- typewriter reveal ---------- */

  const streamText = useCallback((turnId: string, model: ModelId, full: string, startedAt: number) => {
    const chunk = Math.max(2, Math.round(full.length / 150));
    let i = 0;

    const tick = () => {
      i = Math.min(full.length, i + chunk);
      patchAnswer(turnId, model, { status: 'streaming', text: full.slice(0, i) });
      if (i < full.length) {
        schedule(tick, 18);
      } else {
        patchAnswer(turnId, model, { status: 'done', text: full, ms: Date.now() - startedAt });
      }
    };

    tick();
  }, []);

  /** What this model has already said in this chat, for follow-up questions. */
  const historyFor = useCallback(
    (model: ModelId, upToTurnId: string): { role: 'user' | 'assistant'; content: string }[] => {
      const out: { role: 'user' | 'assistant'; content: string }[] = [];
      for (const t of turns) {
        if (t.id === upToTurnId) break;
        const a = t.answers[model];
        if (!t.models.includes(model) || a.status !== 'done' || !a.text) continue;
        out.push({ role: 'user', content: t.question });
        out.push({ role: 'assistant', content: a.text });
      }
      return out;
    },
    [turns]
  );

  const runModel = useCallback(
    (turnId: string, model: ModelId, question: string, replyLang: Lang, images: Attachment[] = []) => {
      const startedAt = Date.now();
      patchAnswer(turnId, model, { status: 'thinking', text: '', ms: 0, error: undefined });

      // In Live mode a model without a key must say so — showing it a sample
      // answer next to real ones would read as a genuine reply.
      if (live && authToken && !ready[model]) {
        patchAnswer(turnId, model, {
          status: 'error',
          error: `${metaOf(model).name} ki API key abhi add nahi hui hai — Settings me daal dijiye.`
        });
        return;
      }

      // Demo mode: sample answer with a staggered delay so each model feels independent.
      if (!live || !authToken) {
        const delay = { gemini: 800, gpt: 1400, claude: 1100 }[model];
        schedule(() => streamText(turnId, model, demoAnswer(model, question, replyLang), startedAt), delay);
        return;
      }

      (async () => {
        try {
          const res = await fetch(`${base}/ai/ask`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({
              model,
              question,
              lang: replyLang,
              history: historyFor(model, turnId),
              images: images.map(img => ({ mimeType: img.mimeType, data: img.data }))
            })
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            patchAnswer(turnId, model, {
              status: 'error',
              error: data.message || `Request failed (${res.status}).`
            });
            return;
          }

          if (Array.isArray(data.sources) && data.sources.length) {
            patchAnswer(turnId, model, { sources: data.sources });
          }
          streamText(turnId, model, data.text || '', startedAt);
          // The server records the cost just after it replies, so give that
          // write a moment before asking for the new total.
          schedule(() => void loadSpend(), 1500);
        } catch (err) {
          patchAnswer(turnId, model, {
            status: 'error',
            error: err instanceof Error ? err.message : 'Could not reach the server.'
          });
        }
      })();
    },
    [streamText, live, ready, authToken, base, historyFor]
  );

  /* ---------- what it has cost ---------- */

  useEffect(() => {
    if (!base || !authToken) return;

    const check = async () => {
      try {
        const res = await fetch(`${base}/ai/visibility`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.providers) setEnabled(data.providers);
      } catch {
        /* leave every model on if the check fails */
      }
    };

    void check();
    const timer = window.setInterval(check, 30000);

    const onLocalChange = (event: Event) => {
      const detail = (event as CustomEvent<{ providers?: Record<ModelId, boolean> }>).detail;
      if (detail?.providers) setEnabled(detail.providers);
    };
    window.addEventListener('ai-council-visibility', onLocalChange);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('ai-council-visibility', onLocalChange);
    };
  }, [base, authToken]);

  const shownModels = useMemo(() => MODELS.filter(m => enabled[m.id]), [enabled]);
  const shownIds = useMemo(() => shownModels.map(m => m.id), [shownModels]);

  const loadSpend = useCallback(async () => {
    if (!base || !authToken) return;
    try {
      const res = await fetch(`${base}/ai/usage`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (!res.ok) return;
      setSpend(await res.json());
    } catch {
      /* the meter is not worth an error message */
    }
  }, [base, authToken]);

  useEffect(() => {
    void loadSpend();
  }, [loadSpend]);

  /* ---------- photos ---------- */

  const addShots = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked: Attachment[] = [];

    for (const file of Array.from(files).slice(0, 4)) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 5 * 1024 * 1024) continue;
      const dataUrl: string = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });
      picked.push({
        id: `s${Date.now()}${picked.length}`,
        name: file.name,
        mimeType: file.type,
        data: dataUrl.split(',')[1] || '',
        preview: dataUrl
      });
    }

    setShots(current => [...current, ...picked].slice(0, 4));
  };

  /* ---------- speaking and listening ---------- */

  /** Read an answer out loud, using the same voice the announcements use. */
  const speakAnswer = async (key: string, text: string) => {
    if (speakingKey) {
      speechRef.current?.pause();
      speechRef.current = null;
      setSpeakingKey(null);
      if (speakingKey === key) return;
    }
    if (!base || !authToken || !text.trim()) return;

    setSpeakingKey(key);
    try {
      const res = await fetch(`${base}/announce/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        // The voice service caps the line length, so read the opening out.
        body: JSON.stringify({ text: text.replace(/[#*`_>|-]/g, ' ').slice(0, 400) })
      });
      const data = await res.json();
      if (!res.ok || !data?.audioContent) throw new Error('no audio');

      const audio = new Audio(`data:${data.mimeType || 'audio/mp3'};base64,${data.audioContent}`);
      speechRef.current = audio;
      audio.addEventListener('ended', () => setSpeakingKey(null));
      await audio.play();
    } catch {
      setSpeakingKey(null);
    }
  };

  /** Dictate the question instead of typing it. */
  const toggleDictation = () => {
    const Recognition =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

    if (!Recognition) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Recognition();
    recognition.lang = lang === 'hinglish' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalText = '';
    recognition.onresult = (event: SpeechResultEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      setDraft((finalText + interim).trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const handleAsk = () => {
    const q = draft.trim();
    // A photo on its own is a fair question — "what is this?" is implied.
    if ((!q && !shots.length) || busy) return;
    const question = q || 'What does this image show? Read any text in it.';

    const asked = requestedLang(question);
    const replyLang: Lang = asked ?? lang;
    if (asked && asked !== lang) setLang(asked);

    const models: ModelId[] = activeModel ? [activeModel] : shownIds;
    const turnId = `t${Date.now()}`;

    if (!activeId) setActiveId(`c${Date.now()}`);
    setTurns(prev => [
      ...prev,
      {
        id: turnId,
        question,
        lang: replyLang,
        models,
        answers: blankAnswers(),
        shots: shots.map(img => ({ name: img.name, preview: img.preview }))
      }
    ]);

    const attached = shots;
    setDraft('');
    setShots([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    models.forEach(id => runModel(turnId, id, question, replyLang, attached));
    schedule(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(200, el.scrollHeight) + 'px';
  };

  /** Merge the three answers into one, using whichever model is available. */
  const combineTurn = async (turn: Turn) => {
    const ready = turn.models
      .map(id => ({
        model: id,
        name: metaOf(id).name,
        text: turn.answers?.[id]?.text || '',
        status: turn.answers?.[id]?.status
      }))
      .filter(a => a.status === 'done' && a.text.trim());

    if (ready.length < 2) return;

    setTurns(prev =>
      prev.map(t => (t.id === turn.id ? { ...t, summary: { status: 'working', text: '' } } : t))
    );

    try {
      const res = await fetch(`${apiBase}/ai/combine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          question: turn.question,
          lang: turn.lang,
          answers: ready.map(a => ({ model: a.model, name: a.name, text: a.text }))
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.text) throw new Error(data?.message || 'Could not combine the answers.');

      setTurns(prev =>
        prev.map(t =>
          t.id === turn.id
            ? { ...t, summary: { status: 'done', text: String(data.text), by: data.by as ModelId } }
            : t
        )
      );
    } catch (error) {
      setTurns(prev =>
        prev.map(t =>
          t.id === turn.id
            ? {
                ...t,
                summary: {
                  status: 'error',
                  text: '',
                  error: error instanceof Error ? error.message : 'Could not combine the answers.'
                }
              }
            : t
        )
      );
    }
  };

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      schedule(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  /** Send the rest of this chat to one model only. */
  const continueWith = (model: ModelId) => {
    setActiveModel(model);
    textareaRef.current?.focus();
  };

  const backToAll = () => {
    setActiveModel(null);
    textareaRef.current?.focus();
  };

  const handleNewChat = () => {
    stopTimers();
    setTurns([]);
    setActiveId(null);
    setActiveModel(null);
    setDraft('');
    setLang('en');
    textareaRef.current?.focus();
  };

  const openChat = (chat: Chat) => {
    stopTimers();
    setActiveId(chat.id);
    setTurns(chat.turns);
    setLang(chat.lang);
    setActiveModel(chat.activeModel ?? null);
    setDraft('');
  };

  const deleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    writeChats(chats.filter(c => c.id !== id));
    if (id === activeId) {
      stopTimers();
      setTurns([]);
      setActiveId(null);
      setActiveModel(null);
      setLang('en');
    }
  };


  const anyReady = shownIds.some(id => ready[id]);
  const askedOne = turns.length > 0;
  const activeMeta = activeModel ? metaOf(activeModel) : null;

  return (
    <div className="aic-shell">
      {/* ---------------- Sidebar ---------------- */}
      <aside className="aic-side">
        <div className="aic-side-brand">
          <div className="aic-side-mark"><Sparkles size={17} /></div>
          <div>
            <div className="aic-side-name">AI Council</div>
            <div className="aic-side-tag">{shownModels.map(m => m.name).join(' · ')}</div>
          </div>
        </div>

        <button type="button" className="aic-new-btn" onClick={handleNewChat}>
          <Plus size={16} />
          New question
        </button>

        <div className="aic-side-label">
          <span>History</span>
          {chats.length > 0 && (
            <button
              type="button"
              className="aic-side-clear"
              onClick={() => { writeChats([]); handleNewChat(); }}
            >
              clear all
            </button>
          )}
        </div>

        <div className="aic-side-list">
          {chats.length === 0 ? (
            <p className="aic-side-empty">
              Your past questions and answers will be saved here.
            </p>
          ) : (
            chats.map(c => {
              const m = c.activeModel ? metaOf(c.activeModel) : null;
              return (
                <div
                  key={c.id}
                  className={`aic-side-item ${c.id === activeId ? 'active' : ''}`}
                  style={m ? modelStyle(m) : undefined}
                  role="button"
                  tabIndex={0}
                  onClick={() => openChat(c)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openChat(c);
                    }
                  }}
                  title={m ? `Continuing with ${m.name}` : c.title}
                >
                  <i className={`aic-side-dot ${m ? 'won' : ''}`} />
                  <span>{c.title}</span>
                  <button
                    type="button"
                    className="aic-side-del"
                    onClick={e => deleteChat(e, c.id)}
                    title="Delete this chat"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="aic-side-foot">
          <div className="aic-spend-head">
            <IndianRupee size={13} />
            Spend this month
            {spend?.month && <em>{spend.month}</em>}
          </div>

          {shownModels.map(m => {
            const month = spend?.thisMonth?.[m.id];
            const bal = spend?.balance?.[m.id];
            const pct = bal?.tracked && bal.addedUsd > 0
              ? Math.min(100, Math.round((bal.spentUsd / bal.addedUsd) * 100))
              : 0;

            return (
              <div key={m.id} className="aic-spend-row" style={modelStyle(m)}>
                <div className="aic-spend-name">
                  {m.name}
                  <b>${(month?.usd || 0).toFixed(3)}</b>
                </div>

                {bal?.tracked ? (
                  <>
                    <div className="aic-mini-bar">
                      <div className="aic-mini-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <small>
                      ${bal.leftUsd.toFixed(2)} left of ${bal.addedUsd.toFixed(2)}
                    </small>
                  </>
                ) : (
                  <small className="muted">
                    {month?.calls || 0} {month?.calls === 1 ? 'call' : 'calls'} · add your top-up in
                    Settings to see the balance
                  </small>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* ---------------- Main ---------------- */}
      <main className="aic-main">
        <div className="aic-topbar">
          <h1>AI Council</h1>
          <div className="aic-models-chip">
            {shownModels.map(m => (
              <i
                key={m.id}
                className={activeModel && activeModel !== m.id ? 'off' : ''}
                style={{ background: `linear-gradient(135deg, ${m.c1}, ${m.c2})` }}
                title={m.name}
              >
                {m.initials}
              </i>
            ))}
          </div>
          <span
            className="aic-chip-lang"
            title="Ask for Hinglish in the chat to switch; ask for English to switch back."
          >
            <Languages size={12} />
            {lang === 'en' ? 'Replies in English' : 'Replies in Hinglish'}
          </span>
          <button
            type="button"
            className={`aic-chip-mode ${live ? 'is-live' : ''}`}
            onClick={() => setLive(v => !v)}
            disabled={!anyReady}
            title={
              anyReady
                ? 'Switch between real AI answers and sample answers'
                : 'No API key is set on the server yet'
            }
          >
            <i className="aic-dot" />
            {live ? 'Live' : 'Demo Mode'}
          </button>
        </div>

        <div className="aic-thread">
          {!askedOne ? (
            <div className="aic-welcome">
              <div className="aic-welcome-mark"><Sparkles size={28} /></div>
              <h2>What would you like to ask?</h2>
              <p>
                {shownModels.length > 1
                  ? `Ask one question — ${shownModels
                      .slice(0, -1)
                      .map(m => m.name)
                      .join(', ')} and ${shownModels[shownModels.length - 1].name} will each answer.`
                  : `Ask ${shownModels[0]?.name || 'the AI'} anything.`}
                Like one of them? Continue the conversation with that one alone.
              </p>
              <div className="aic-welcome-grid">
                {STARTERS.map(s => (
                  <button
                    key={s}
                    type="button"
                    className="aic-welcome-card"
                    onClick={() => { setDraft(s); textareaRef.current?.focus(); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="aic-welcome-note">
                Answers come in English by default. Ask for Hinglish in the chat
                (“reply in Hinglish”) and all three will switch until you ask for English again.
                {!live && ' Right now the page is in Demo Mode — the answers shown are samples.'}
              </p>
            </div>
          ) : (
            <div className="aic-thread-inner">
              {turns.map(turn => (
                <section key={turn.id} className="aic-turn">
                  <div className="aic-user-row">
                    <div className="aic-user-bubble">
                      {!!turn.shots?.length && (
                        <div className="aic-bubble-shots">
                          {turn.shots.map(shot => (
                            <img key={shot.preview} src={shot.preview} alt={shot.name} />
                          ))}
                        </div>
                      )}
                      {turn.question}
                    </div>
                  </div>

                  <div className="aic-answers">
                  {turn.models.filter(id => enabled[id]).map(id => {
                    const m = metaOf(id);
                    // A chat saved by an older build — or one cut short — can be
                    // missing an answer. Render an error rather than crashing.
                    const a: AnswerState = turn.answers?.[id] || {
                      status: 'error',
                      text: '',
                      ms: 0,
                      error: 'This answer was not saved.'
                    };
                    const copyKey = `${turn.id}:${id}`;
                    const solo = turn.models.length === 1;

                    return (
                      <article key={id} className="aic-msg" style={modelStyle(m)}>
                        <div className="aic-msg-avatar">{m.initials}</div>

                        <div className="aic-msg-col">
                          <div className="aic-msg-head">
                            <span className="aic-msg-name">{m.name}</span>
                            <span className="aic-msg-vendor">{m.vendor}</span>
                            {a.status === 'done' && a.ms > 0 && (
                              <span className="aic-msg-time">{(a.ms / 1000).toFixed(1)}s</span>
                            )}
                          </div>

                          {a.status === 'thinking' && (
                            <div className="aic-typing"><i /><i /><i /></div>
                          )}

                          {a.status === 'error' && (
                            <div className="aic-msg-err">
                              <AlertTriangle size={14} />
                              {a.error || 'Could not get an answer.'}
                            </div>
                          )}

                          {(a.status === 'streaming' || a.status === 'done') && (
                            <div className="aic-msg-text">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  a: props => <a {...props} target="_blank" rel="noopener noreferrer" />,
                                  img: props => <img {...props} loading="lazy" referrerPolicy="no-referrer" alt={props.alt || 'AI result'} />
                                }}
                              >
                                {a.text}
                              </ReactMarkdown>
                              {a.status === 'streaming' && <i className="aic-caret" />}
                            </div>
                          )}

                          {a.status === 'done' && !!a.sources?.length && (
                            <div className="aic-sources">
                              <div className="aic-sources-label">
                                <Globe size={12} />
                                Sources &amp; links
                              </div>
                              <div className="aic-source-grid">
                                {a.sources.map(src => (
                                  <a
                                    key={src.url}
                                    className="aic-source"
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <div className="aic-source-thumb">
                                      {src.image ? (
                                        <img
                                          src={src.image}
                                          alt=""
                                          loading="lazy"
                                          referrerPolicy="no-referrer"
                                          onError={e => {
                                            // Hotlink blocked — fall back to the site icon.
                                            const img = e.currentTarget;
                                            img.style.display = 'none';
                                            img.parentElement?.classList.add('is-icon');
                                          }}
                                        />
                                      ) : null}
                                      {src.favicon && (
                                        <img className="aic-source-fav" src={src.favicon} alt="" loading="lazy" />
                                      )}
                                    </div>
                                    <div className="aic-source-body">
                                      <span className="aic-source-title">{src.title}</span>
                                      <span className="aic-source-site">
                                        {src.site || src.host}
                                        <ExternalLink size={11} />
                                      </span>
                                    </div>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="aic-msg-acts">
                            <button
                              type="button"
                              className="aic-act"
                              onClick={() => handleCopy(copyKey, a.text)}
                              disabled={a.status !== 'done'}
                            >
                              {copied === copyKey ? <Check size={13} /> : <Copy size={13} />}
                              {copied === copyKey ? 'Copied' : 'Copy'}
                            </button>

                            <button
                              type="button"
                              className={`aic-act ${speakingKey === copyKey ? 'on' : ''}`}
                              onClick={() => void speakAnswer(copyKey, a.text)}
                              disabled={a.status !== 'done'}
                              title="Read this answer out loud"
                            >
                              <Volume2 size={13} />
                              {speakingKey === copyKey ? 'Stop' : 'Listen'}
                            </button>

                            <button
                              type="button"
                              className="aic-act"
                              onClick={() => runModel(turn.id, id, turn.question, turn.lang)}
                              disabled={a.status === 'thinking' || a.status === 'streaming'}
                              title={`Ask ${m.name} again`}
                            >
                              <RotateCw size={13} />
                              Retry
                            </button>

                            {!solo && activeModel !== id && (
                              <button
                                type="button"
                                className="aic-act continue"
                                onClick={() => continueWith(id)}
                                disabled={a.status !== 'done'}
                                title={`Send every next question to ${m.name} only`}
                              >
                                <ArrowRight size={13} />
                                Continue with {m.name}
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  </div>

                  {turn.models.length > 1 && (
                    <div className="aic-merge">
                      {(!turn.summary || turn.summary.status === 'idle') && (
                        <button
                          type="button"
                          className="aic-merge-btn"
                          onClick={() => void combineTurn(turn)}
                          disabled={
                            turn.models.filter(id => turn.answers?.[id]?.status === 'done').length < 2
                          }
                        >
                          <Sparkles size={14} />
                          Make one answer out of these
                        </button>
                      )}

                      {turn.summary?.status === 'working' && (
                        <div className="aic-merge-card working">
                          <div className="aic-typing"><i /><i /><i /></div>
                          Reading all three answers...
                        </div>
                      )}

                      {turn.summary?.status === 'error' && (
                        <div className="aic-merge-card error">
                          <AlertTriangle size={14} />
                          {turn.summary.error}
                          <button
                            type="button"
                            className="aic-act"
                            onClick={() => void combineTurn(turn)}
                          >
                            <RotateCw size={13} />
                            Try again
                          </button>
                        </div>
                      )}

                      {turn.summary?.status === 'done' && (
                        <div className="aic-merge-card">
                          <div className="aic-merge-head">
                            <Sparkles size={14} />
                            <strong>Final answer</strong>
                            {turn.summary.by && <em>written by {metaOf(turn.summary.by).name}</em>}
                            <button
                              type="button"
                              className="aic-act"
                              onClick={() => handleCopy(`${turn.id}:merged`, turn.summary!.text)}
                            >
                              {copied === `${turn.id}:merged` ? <Check size={13} /> : <Copy size={13} />}
                              {copied === `${turn.id}:merged` ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <div className="aic-msg-text">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                a: props => <a {...props} target="_blank" rel="noopener noreferrer" />
                              }}
                            >
                              {turn.summary.text}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              ))}
              <div ref={threadEndRef} />
            </div>
          )}
        </div>

        {/* ---------------- Composer ---------------- */}
        <div className="aic-composer-wrap">
          {activeMeta && (
            <div className="aic-active-bar" style={modelStyle(activeMeta)}>
              <i className="aic-active-avatar">{activeMeta.initials}</i>
              <span>
                Continuing with <strong>{activeMeta.name}</strong> — your next questions go to this model only.
              </span>
              <button type="button" className="aic-active-back" onClick={backToAll}>
                <Users size={13} />
                Ask all three
                <X size={13} />
              </button>
            </div>
          )}

          {shots.length > 0 && (
            <div className="aic-shots">
              {shots.map(shot => (
                <div key={shot.id} className="aic-shot">
                  <img src={shot.preview} alt={shot.name} />
                  <button
                    type="button"
                    onClick={() => setShots(current => current.filter(s => s.id !== shot.id))}
                    aria-label={`Remove ${shot.name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <span>Ask anything about {shots.length > 1 ? 'these photos' : 'this photo'}</span>
            </div>
          )}

          <div className="aic-composer">
            <input
              ref={shotInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={e => {
                void addShots(e.target.files);
                e.target.value = '';
              }}
            />

            <button
              type="button"
              className="aic-tool"
              onClick={() => shotInputRef.current?.click()}
              title="Attach a photo — a bill, a product, anything"
            >
              <Paperclip size={18} />
            </button>

            <textarea
              ref={textareaRef}
              className="aic-textarea"
              placeholder={activeMeta ? `Message ${activeMeta.name}...` : 'Ask anything...'}
              value={draft}
              rows={1}
              onChange={e => { setDraft(e.target.value); autoGrow(e.target); }}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className={`aic-tool ${listening ? 'live' : ''}`}
              onClick={toggleDictation}
              title={listening ? 'Stop listening' : 'Speak your question'}
            >
              <Mic size={18} />
            </button>

            <button
              type="button"
              className="aic-send"
              onClick={handleAsk}
              disabled={(!draft.trim() && !shots.length) || busy}
              title={activeMeta ? `Ask ${activeMeta.name}` : 'Ask all three'}
            >
              <ArrowUp size={19} />
            </button>
          </div>

          <p className="aic-foot-note">
            Enter to send, Shift + Enter for a new line
            {live
              ? ' · Live: answers come from the real AI models.'
              : ' · Demo Mode: these answers are samples; real answers start once the API keys are added.'}
          </p>
        </div>
      </main>
    </div>
  );
}
