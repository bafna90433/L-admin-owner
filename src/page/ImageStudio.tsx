import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ImagePlus,
  Sparkles,
  Upload,
  X,
  Download,
  RotateCw,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Loader,
  Maximize2,
  CornerUpRight
} from 'lucide-react';
import '../styles/ImageStudio.css';

/* ------------------------------------------------------------------
   Image Studio — describe a design, attach reference photos, and let
   Gemini's image models draw it. Built for packaging artwork: upload
   the toy photo and the character's face, write the brief, generate.

   Finished images are stored on ImageKit by the backend, so the URLs
   in history keep working on any device.
   ------------------------------------------------------------------ */

type ModelId = 'pro' | 'flash' | 'flash-lite';
type Aspect = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

interface ModelOption {
  id: ModelId;
  name: string;
  hint: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'pro', name: 'Pro', hint: 'Best quality — packaging, detailed art' },
  { id: 'flash', name: 'Flash', hint: 'Faster and cheaper' },
  { id: 'flash-lite', name: 'Lite', hint: 'Quick drafts' }
];

const ASPECTS: { id: Aspect; label: string }[] = [
  { id: '1:1', label: 'Square' },
  { id: '16:9', label: 'Wide' },
  { id: '4:3', label: 'Landscape' },
  { id: '3:4', label: 'Portrait' },
  { id: '9:16', label: 'Tall' }
];

interface Reference {
  id: string;
  name: string;
  mimeType: string;
  data: string; // base64, no prefix
  preview: string; // data URL for the thumbnail
}

interface Creation {
  id: string;
  url: string;
  prompt: string;
  model: ModelId;
  aspect: Aspect;
  note?: string;
  stored: boolean;
  at: string;
  ms: number;
}

const HISTORY_KEY = 'image_studio_history';
const MAX_REFERENCES = 4;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_HISTORY = 60;

const EXAMPLE_PROMPT =
  'Toy packaging design, front and back side by side. Bright orange jet with lime green ' +
  'missiles. Header reads "FIGHTER Z ELITE PILOTS". Premium 2D vector comic style, looks ' +
  'like a real product photograph.';

interface ImageStudioProps {
  apiBase?: string;
  token?: string | null;
}

const DEFAULT_API_BASE =
  import.meta.env.VITE_API_BASE || 'https://l-backend-production-ff32.up.railway.app/api';

export default function ImageStudio({ apiBase, token }: ImageStudioProps = {}) {
  const base = apiBase || DEFAULT_API_BASE;
  const authToken = token ?? localStorage.getItem('admin_token');

  const [prompt, setPrompt] = useState('');
  const [references, setReferences] = useState<Reference[]>([]);
  const [model, setModel] = useState<ModelId>('pro');
  const [aspect, setAspect] = useState<Aspect>('1:1');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Creation | null>(null);
  const [history, setHistory] = useState<Creation[]>([]);
  const [zoom, setZoom] = useState(false);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  /* ---------- history ---------- */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      /* unreadable storage — start empty */
    }
  }, []);

  const writeHistory = (next: Creation[]) => {
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, MAX_HISTORY)));
    } catch {
      /* storage full — keep it in memory for this session */
    }
  };

  /* ---------- reference images ---------- */

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const room = MAX_REFERENCES - references.length;
      if (room <= 0) {
        setError(`Zyada se zyada ${MAX_REFERENCES} reference images bhej sakte hain.`);
        return;
      }

      Array.from(files)
        .filter(file => file.type.startsWith('image/'))
        .slice(0, room)
        .forEach(file => {
          if (file.size > MAX_FILE_BYTES) {
            setError(`"${file.name}" 5 MB se bada hai — chhoti file chunein.`);
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = String(reader.result || '');
            const base64 = dataUrl.split(',')[1];
            if (!base64) return;
            setReferences(prev =>
              prev.length >= MAX_REFERENCES
                ? prev
                : [
                    ...prev,
                    {
                      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                      name: file.name,
                      mimeType: file.type,
                      data: base64,
                      preview: dataUrl
                    }
                  ]
            );
            setError(null);
          };
          reader.readAsDataURL(file);
        });
    },
    [references.length]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files || []);
    if (files.length) addFiles(files);
  };

  const removeReference = (id: string) =>
    setReferences(prev => prev.filter(ref => ref.id !== id));

  /* ---------- generate ---------- */

  const generate = async () => {
    const text = prompt.trim();
    if (!text || busy) return;

    if (!authToken) {
      setError('Login zaroori hai — page refresh karke dobara login kijiye.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`${base}/image/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          prompt: text,
          model,
          aspect,
          references: references.map(ref => ({ mimeType: ref.mimeType, data: ref.data }))
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || `Request failed (${res.status}).`);
        return;
      }

      const creation: Creation = {
        id: `img${Date.now()}`,
        url: data.url,
        prompt: text,
        model,
        aspect,
        note: data.note || undefined,
        stored: !!data.stored,
        at: new Date().toISOString(),
        ms: data.ms || 0
      };

      setCurrent(creation);
      // Only ImageKit-backed images survive a refresh; inline ones would
      // blow up localStorage, so they stay in this session only.
      if (creation.stored) writeHistory([creation, ...history]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Server se baat nahi ho paayi.');
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      generate();
    }
  };

  /* ---------- result actions ---------- */

  const download = async (creation: Creation) => {
    try {
      const res = await fetch(creation.url);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `design-${creation.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch {
      window.open(creation.url, '_blank', 'noopener');
    }
  };

  const copyLink = async (creation: Creation) => {
    try {
      await navigator.clipboard.writeText(creation.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  /** Feed a finished image back in as a reference, to refine the design. */
  const useAsReference = async (creation: Creation) => {
    try {
      const res = await fetch(creation.url);
      const blob = await res.blob();
      const file = new File([blob], `design-${creation.id}.jpg`, { type: blob.type || 'image/jpeg' });
      addFiles([file]);
      promptRef.current?.focus();
    } catch {
      setError('Image ko reference banane me dikkat aayi — download karke upload kar dijiye.');
    }
  };

  const openCreation = (creation: Creation) => {
    setCurrent(creation);
    setPrompt(creation.prompt);
    setModel(creation.model);
    setAspect(creation.aspect);
  };

  const referenceHint = useMemo(() => {
    if (!references.length) return 'Reference images optional hain';
    return `${references.length} reference ${references.length === 1 ? 'image' : 'images'} attached`;
  }, [references.length]);

  return (
    <div className="ims-shell" onPaste={handlePaste}>
      {/* ---------------- Left: controls ---------------- */}
      <aside className="ims-panel">
        <div className="ims-brand">
          <div className="ims-brand-mark"><ImagePlus size={17} /></div>
          <div>
            <div className="ims-brand-name">Image Studio</div>
            <div className="ims-brand-tag">Gemini image models</div>
          </div>
        </div>

        <label className="ims-label">Reference images</label>

        <div
          className="ims-drop"
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <Upload size={17} />
          <span>Click, drag ya paste kijiye</span>
          <small>{referenceHint} · max {MAX_REFERENCES}, 5 MB each</small>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={e => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {!!references.length && (
          <div className="ims-refs">
            {references.map(ref => (
              <div key={ref.id} className="ims-ref">
                <img src={ref.preview} alt={ref.name} />
                <button
                  type="button"
                  className="ims-ref-x"
                  onClick={() => removeReference(ref.id)}
                  title="Hataiye"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="ims-label" htmlFor="ims-prompt">
          Prompt
          {!prompt && (
            <button type="button" className="ims-example" onClick={() => setPrompt(EXAMPLE_PROMPT)}>
              example daalein
            </button>
          )}
        </label>

        <textarea
          id="ims-prompt"
          ref={promptRef}
          className="ims-prompt"
          placeholder="Design kaisa chahiye, detail me likhiye — colours, style, text, layout sab..."
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <label className="ims-label">Quality</label>
        <div className="ims-models">
          {MODEL_OPTIONS.map(option => (
            <button
              key={option.id}
              type="button"
              className={`ims-model ${model === option.id ? 'active' : ''}`}
              onClick={() => setModel(option.id)}
              title={option.hint}
            >
              {option.name}
            </button>
          ))}
        </div>
        <p className="ims-hint">{MODEL_OPTIONS.find(o => o.id === model)?.hint}</p>

        <label className="ims-label">Shape</label>
        <div className="ims-aspects">
          {ASPECTS.map(option => (
            <button
              key={option.id}
              type="button"
              className={`ims-aspect ${aspect === option.id ? 'active' : ''}`}
              onClick={() => setAspect(option.id)}
            >
              <i className={`ims-aspect-box ar-${option.id.replace(':', '-')}`} />
              {option.label}
            </button>
          ))}
        </div>

        <button type="button" className="ims-go" onClick={generate} disabled={!prompt.trim() || busy}>
          {busy ? <Loader size={17} className="ims-spin" /> : <Sparkles size={17} />}
          {busy ? 'Ban rahi hai...' : 'Image banaiye'}
        </button>

        <p className="ims-note">Ctrl + Enter se bhi chalega · har image ka API charge lagta hai</p>
      </aside>

      {/* ---------------- Right: canvas ---------------- */}
      <main className="ims-main">
        {error && (
          <div className="ims-error">
            <AlertTriangle size={15} />
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}><X size={14} /></button>
          </div>
        )}

        <div className="ims-canvas">
          {busy && (
            <div className="ims-loading">
              <div className="ims-orb" />
              <p>Gemini design bana raha hai...</p>
              <small>Pro model me 15-30 second lagte hain</small>
            </div>
          )}

          {!busy && !current && (
            <div className="ims-empty">
              <ImagePlus size={34} />
              <h2>Yahan aapka design aayega</h2>
              <p>
                Reference images upload kijiye, prompt likhiye, aur <strong>Image banaiye</strong> dabaiye.
                Packaging design ke liye toy ka photo aur character ka face — dono attach karna behtar rehta hai.
              </p>
            </div>
          )}

          {!busy && current && (
            <div className="ims-result">
              <img src={current.url} alt={current.prompt} onClick={() => setZoom(true)} />

              <div className="ims-result-bar">
                <span className="ims-meta">
                  {MODEL_OPTIONS.find(o => o.id === current.model)?.name} · {current.aspect}
                  {current.ms ? ` · ${(current.ms / 1000).toFixed(1)}s` : ''}
                  {!current.stored && ' · sirf is session me'}
                </span>

                <button type="button" className="ims-act" onClick={() => setZoom(true)}>
                  <Maximize2 size={13} /> Bada karein
                </button>
                <button type="button" className="ims-act" onClick={() => download(current)}>
                  <Download size={13} /> Download
                </button>
                <button type="button" className="ims-act" onClick={() => copyLink(current)}>
                  {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copy hua' : 'Link copy'}
                </button>
                <button type="button" className="ims-act" onClick={() => useAsReference(current)}>
                  <CornerUpRight size={13} /> Isi par aage kaam
                </button>
                <button type="button" className="ims-act primary" onClick={generate} disabled={busy}>
                  <RotateCw size={13} /> Dobara banaiye
                </button>
              </div>

              {current.note && <p className="ims-model-note">{current.note}</p>}
            </div>
          )}
        </div>

        {!!history.length && (
          <div className="ims-history">
            <div className="ims-history-head">
              <span>Purani designs</span>
              <button type="button" onClick={() => writeHistory([])}>
                <Trash2 size={12} /> saaf karein
              </button>
            </div>
            <div className="ims-strip">
              {history.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`ims-thumb ${current?.id === item.id ? 'active' : ''}`}
                  onClick={() => openCreation(item)}
                  title={item.prompt}
                >
                  <img src={item.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {zoom && current && (
        <div className="ims-zoom" onClick={() => setZoom(false)} role="presentation">
          <button type="button" className="ims-zoom-x" onClick={() => setZoom(false)}>
            <X size={18} />
          </button>
          <img src={current.url} alt={current.prompt} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
