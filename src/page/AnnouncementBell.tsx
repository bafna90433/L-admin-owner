import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BellRing,
  Megaphone,
  Sparkles,
  Check,
  CheckCheck,
  Loader2,
  Music4,
  Play,
  RefreshCw,
  Upload,
  Users,
  Volume2
} from 'lucide-react';
import {
  TONES,
  previewTone,
  playSpeech,
  unlockAudio,
  armAudioUnlock,
  isAudioReady,
  type ToneId
} from '../utils/ringtones';
import '../styles/AnnouncementBell.css';

/**
 * Announcement Bell — the MD picks staff, hits the bell, and their PCs ring.
 *
 * Delivery rides the same Server-Sent Events stream the staff listen on, so a
 * ring lands in a few hundred milliseconds. This page also keeps the stream
 * open for itself, which is how the acknowledgement ticks arrive live.
 */

const IMAGEKIT_PUBLIC_KEY = 'public_LB0AyCgim15VO491kDtVm0Fo798=';

/** Stand-in name used only for the MD's own preview. */
const SAMPLE_NAME = 'Deepa';

/** Lines the office actually uses, so the MD rarely has to type. */
const TEMPLATES = [
  'MD sir is calling you to the office.',
  'Please come to the meeting room now.',
  'Please report to the MD cabin.',
  'Please come to the accounts desk.',
  'Please collect your work sheet from the front desk.'
];

const LANGUAGES: { id: 'en' | 'hi' | 'ta'; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'Hindi' },
  { id: 'ta', label: 'Tamil' }
];

interface StaffRow {
  _id: string;
  name: string;
  username: string;
  online: boolean;
}

/** One ringtone for the whole office, chosen by the MD. */
interface Ringtone {
  tone: ToneId;
  customUrl: string;
  customName: string;
}

interface LogTarget {
  userId: string;
  name: string;
  online: boolean;
  acknowledgedAt: number | null;
}

interface LogEntry {
  ringId: string;
  message: string;
  byName: string;
  sentAt: number;
  targets: LogTarget[];
}

interface Props {
  apiBase: string;
  token: string;
}

const AnnouncementBell = ({ apiBase, token }: Props) => {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'ring' | 'announce'>('ring');
  const [lang, setLang] = useState<'en' | 'hi' | 'ta'>('en');
  const [polishing, setPolishing] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [ringtone, setRingtone] = useState<Ringtone>({ tone: 'telephone', customUrl: '', customName: '' });
  const [durationMs, setDurationMs] = useState(30000);
  const [ringing, setRinging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [soundReady, setSoundReady] = useState(isAudioReady());

  const sourceRef = useRef<EventSource | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  /* ---------- data ---------- */

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/announce/status`, { headers: authHeaders });
      if (!res.ok) throw new Error('status failed');
      const data = await res.json();
      setStaff(Array.isArray(data.staff) ? data.staff : []);
      setLog(Array.isArray(data.log) ? data.log : []);
      if (data.ringtone) setRingtone(data.ringtone);
    } catch {
      setNotice('Could not load the status — please try again.');
    } finally {
      setLoading(false);
    }
  }, [apiBase, token]);

  useEffect(() => {
    void loadStatus();
    // Online/offline changes when a staff member opens or closes their desk,
    // so refresh the roster on a slow timer.
    const timer = window.setInterval(() => void loadStatus(), 15000);
    return () => window.clearInterval(timer);
  }, [loadStatus]);

  useEffect(() => {
    // The MD may arrive on a saved session too, so the previews need the same
    // first-click unlock the staff desk uses.
    const disarm = armAudioUnlock(ready => setSoundReady(ready));
    return disarm;
  }, []);

  /* ---------- live acknowledgements ---------- */

  useEffect(() => {
    let closed = false;
    let retry: number | null = null;

    const connect = async () => {
      if (closed) return;
      try {
        const res = await fetch(`${apiBase}/announce/ticket`, { method: 'POST', headers: authHeaders });
        if (!res.ok) throw new Error('ticket refused');
        const { ticket } = await res.json();

        const source = new EventSource(`${apiBase}/announce/stream?ticket=${encodeURIComponent(ticket)}`);
        sourceRef.current = source;

        source.addEventListener('ack', event => {
          try {
            const data = JSON.parse((event as MessageEvent).data);
            setLog(prev =>
              prev.map(entry =>
                entry.ringId === data.ringId
                  ? {
                      ...entry,
                      targets: entry.targets.map(t =>
                        t.userId === data.userId ? { ...t, acknowledgedAt: data.acknowledgedAt } : t
                      )
                    }
                  : entry
              )
            );
          } catch {
            // Ignore a malformed push rather than dropping the stream.
          }
        });

        source.onerror = () => {
          source.close();
          sourceRef.current = null;
          if (!closed) retry = window.setTimeout(() => void connect(), 4000);
        };
      } catch {
        if (!closed) retry = window.setTimeout(() => void connect(), 4000);
      }
    };

    void connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [apiBase, token]);

  /* ---------- selection ---------- */

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = staff.length > 0 && selected.size === staff.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(staff.map(s => s._id)));
  };

  const selectOnline = () => {
    setSelected(new Set(staff.filter(s => s.online).map(s => s._id)));
  };

  /* ---------- ringtone assignment ---------- */

  const saveTone = async (tone: ToneId, customUrl = '', customName = '') => {
    setRingtone({ tone, customUrl, customName });
    try {
      const res = await fetch(`${apiBase}/announce/ringtones`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone, customUrl, customName })
      });
      if (!res.ok) throw new Error('save failed');
    } catch {
      setNotice('Could not save the ringtone.');
      void loadStatus();
    }
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setNotice('');
    try {
      const authRes = await fetch(`${apiBase}/imagekit/auth`, { headers: authHeaders });
      if (!authRes.ok) throw new Error('imagekit auth failed');
      const auth = await authRes.json();

      const body = new FormData();
      body.append('file', file);
      body.append('fileName', file.name);
      body.append('publicKey', IMAGEKIT_PUBLIC_KEY);
      body.append('signature', auth.signature);
      body.append('expire', String(auth.expire));
      body.append('token', auth.token);

      const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        body
      });
      const uploaded = await uploadRes.json();
      if (!uploadRes.ok || !uploaded?.url) throw new Error('upload failed');

      await saveTone('custom', uploaded.url, file.name);
      setNotice(`${file.name} is now the office ringtone.`);
    } catch {
      setNotice('Upload failed — try an mp3 file.');
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  /* ---------- ringing ---------- */

  const ring = async () => {
    if (!selected.size || ringing) return;
    setRinging(true);
    setNotice('');
    try {
      const res = await fetch(`${apiBase}/announce/ring`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffIds: Array.from(selected),
          message: message.trim(),
          mode,
          lang,
          urgent,
          durationMs
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'ring failed');

      setNotice(
        data.offline?.length
          ? `Rang on ${data.delivered} PC(s). Offline: ${data.offline.join(', ')}`
          : `Rang on ${data.delivered} PC(s).`
      );
      void loadStatus();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not ring.');
    } finally {
      setRinging(false);
    }
  };

  /** Let Gemini turn a rough note into a clean announcement line. */
  const polishMessage = async () => {
    const draft = message.trim();
    if (!draft || polishing) return;
    setPolishing(true);
    setNotice('');
    try {
      const res = await fetch(`${apiBase}/announce/polish`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: draft })
      });
      const data = await res.json();
      if (!res.ok || !data?.reply) throw new Error(data?.message || 'no reply');
      setMessage(String(data.reply));
    } catch (error) {
      setNotice(
        error instanceof Error && error.message !== 'no reply'
          ? error.message
          : 'Could not improve the message — keeping what you wrote.'
      );
    } finally {
      setPolishing(false);
    }
  };

  /** Hear the announcement exactly as the staff will hear it. */
  const previewAnnouncement = async () => {
    const draft = message.trim();
    if (!draft) return;
    try {
      const res = await fetch(`${apiBase}/announce/speech`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `${SAMPLE_NAME}, ${draft}`, lang })
      });
      const data = await res.json();
      if (!res.ok || !data?.audioContent) throw new Error('no audio');

      if (!isAudioReady()) setSoundReady(await unlockAudio());
      const played = await playSpeech(data.audioContent, { repeat: 1 });
      if (!played) throw new Error('blocked');
    } catch {
      setNotice('Could not play the preview.');
    }
  };

  const preview = async () => {
    if (!isAudioReady()) {
      const ok = await unlockAudio();
      setSoundReady(ok);
    }
    previewTone(ringtone.tone, ringtone.customUrl);
  };

  const onlineCount = staff.filter(s => s.online).length;

  return (
    <div className="anb-page">
      <input
        ref={uploadInputRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={e => void handleUpload(e.target.files?.[0])}
      />

      <header className="anb-head">
        <div>
          <h1>
            Announcement <span>Bell</span>
          </h1>
          <p>
            {mode === 'announce'
              ? 'Pick the staff — a voice announces your message on their PC, name first.'
              : 'Pick the staff, press the bell — their PC keeps ringing until they answer.'}
          </p>
        </div>
        <div className="anb-head-stats">
          <span className="anb-pill online">
            <Users size={14} /> {onlineCount} online
          </span>
          <span className="anb-pill">{staff.length} total staff</span>
          <button type="button" className="anb-ghost" onClick={() => void loadStatus()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </header>

      {notice && <div className="anb-notice">{notice}</div>}

      <div className="anb-grid">
        {/* ---------- compose ---------- */}
        <section className="anb-card anb-compose">
          <h2>What do you want to send?</h2>

          <div className="anb-modes">
            <button
              type="button"
              className={`anb-mode ${mode === 'ring' ? 'on' : ''}`}
              onClick={() => setMode('ring')}
            >
              <BellRing size={20} />
              <span>
                Ringtone
                <small>Their PC rings until they answer</small>
              </span>
            </button>

            <button
              type="button"
              className={`anb-mode ${mode === 'announce' ? 'on' : ''}`}
              onClick={() => setMode('announce')}
            >
              <Megaphone size={20} />
              <span>
                Announcement
                <small>A voice calls them by name</small>
              </span>
            </button>
          </div>

          <label className="anb-label">
            {mode === 'announce' ? 'What should be announced' : 'Message (optional)'}
          </label>
          <textarea
            className="anb-textarea"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="e.g. MD sir is calling you to the office."
            rows={3}
            maxLength={400}
          />

          {mode === 'announce' && (
            <>
              <p className="anb-hint">
                Each person hears their own name first — <strong>"{SAMPLE_NAME}, {message.trim() || 'MD sir is calling you to the office.'}"</strong>
              </p>

              <label className="anb-label">Ready-made lines</label>
              <div className="anb-templates">
                {TEMPLATES.map(line => (
                  <button
                    key={line}
                    type="button"
                    className={message.trim() === line ? 'on' : ''}
                    onClick={() => setMessage(line)}
                  >
                    {line}
                  </button>
                ))}
              </div>

              <label className="anb-label">Voice language</label>
              <div className="anb-repeat">
                {LANGUAGES.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    className={lang === option.id ? 'on' : ''}
                    onClick={() => setLang(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="anb-tone-actions">
                <button
                  type="button"
                  className="anb-ghost"
                  onClick={() => void previewAnnouncement()}
                  disabled={!message.trim()}
                >
                  <Play size={14} /> Hear it
                </button>
                <button
                  type="button"
                  className="anb-ghost"
                  onClick={() => void polishMessage()}
                  disabled={!message.trim() || polishing}
                >
                  {polishing ? <Loader2 size={14} className="anb-spin" /> : <Sparkles size={14} />}
                  {polishing ? 'Improving...' : 'Improve with AI'}
                </button>
              </div>
            </>
          )}

          <div className="anb-options">
            <button
              type="button"
              className={`anb-switch ${urgent ? 'on' : ''}`}
              onClick={() => setUrgent(v => !v)}
            >
              <i />
              <span>
                Urgent
                <small>Shows a red alert on the staff screen</small>
              </span>
            </button>
          </div>

          {mode === 'ring' && (
            <>
              <label className="anb-label">Keep ringing for</label>
              <div className="anb-repeat">
                {[
                  { ms: 15000, label: '15 sec' },
                  { ms: 30000, label: '30 sec' },
                  { ms: 60000, label: '1 min' },
                  { ms: 120000, label: '2 min' }
                ].map(option => (
                  <button
                    key={option.ms}
                    type="button"
                    className={durationMs === option.ms ? 'on' : ''}
                    onClick={() => setDurationMs(option.ms)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="anb-hint">The ring stops as soon as the staff member answers it.</p>
            </>
          )}

          <button
            type="button"
            className={`anb-ring-btn ${urgent ? 'urgent' : ''}`}
            onClick={() => void ring()}
            disabled={!selected.size || ringing || (mode === 'announce' && !message.trim())}
          >
            {ringing ? (
              <Loader2 size={22} className="anb-spin" />
            ) : mode === 'announce' ? (
              <Megaphone size={22} />
            ) : (
              <BellRing size={22} />
            )}
            {ringing
              ? 'Sending...'
              : mode === 'announce'
                ? `Announce to ${selected.size}`
                : `Ring the bell (${selected.size})`}
          </button>

          {!soundReady && (
            <button type="button" className="anb-ghost wide" onClick={() => void preview()}>
              <Volume2 size={14} /> Test the sound on this PC
            </button>
          )}
        </section>

        {/* ---------- the one office ringtone ---------- */}
        <section className="anb-card anb-tone">
          <h2>Office ringtone</h2>
          <p className="anb-hint">
            Every staff PC plays this same tone. Change it once here.
          </p>

          <div className="anb-tone-pick">
            <Music4 size={16} />
            <select
              value={ringtone.tone}
              onChange={e => void saveTone(e.target.value as ToneId)}
            >
              {TONES.map(tone => (
                <option key={tone.id} value={tone.id}>
                  {tone.name} — {tone.hint}
                </option>
              ))}
              {ringtone.tone === 'custom' && (
                <option value="custom">{ringtone.customName || 'Custom tone'} — your own file</option>
              )}
            </select>
          </div>

          <div className="anb-tone-actions">
            <button type="button" className="anb-ghost" onClick={() => void preview()}>
              <Play size={14} /> Listen
            </button>
            <button
              type="button"
              className="anb-ghost"
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 size={14} className="anb-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading...' : 'Upload your own mp3'}
            </button>
          </div>

          {ringtone.tone === 'custom' && ringtone.customName && (
            <p className="anb-hint">Currently using: <strong>{ringtone.customName}</strong></p>
          )}
        </section>

        {/* ---------- staff ---------- */}
        <section className="anb-card anb-staff">
          <div className="anb-staff-head">
            <h2>Who to ring</h2>
            <div className="anb-staff-actions">
              <button type="button" className="anb-ghost" onClick={selectOnline}>
                Select online
              </button>
              <button type="button" className="anb-ghost" onClick={toggleAll}>
                {allSelected ? 'Clear' : 'Select all'}
              </button>
            </div>
          </div>

          {loading ? (
            <p className="anb-empty">
              <Loader2 size={16} className="anb-spin" /> Loading...
            </p>
          ) : staff.length === 0 ? (
            <p className="anb-empty">No staff found.</p>
          ) : (
            <ul className="anb-list">
              {staff.map(person => (
                <li key={person._id} className={selected.has(person._id) ? 'picked' : ''}>
                  <label className="anb-person">
                    <input
                      type="checkbox"
                      checked={selected.has(person._id)}
                      onChange={() => toggle(person._id)}
                    />
                    <span className="anb-name">
                      {person.name}
                      <small>@{person.username}</small>
                    </span>
                    <span className={`anb-dot ${person.online ? 'on' : ''}`}>
                      {person.online ? 'Online' : 'Offline'}
                    </span>
                  </label>

                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------- history ---------- */}
      <section className="anb-card anb-log">
        <h2>Recent announcements</h2>
        {log.length === 0 ? (
          <p className="anb-empty">No announcements yet.</p>
        ) : (
          <ul>
            {log.map(entry => (
              <li key={entry.ringId}>
                <div className="anb-log-head">
                  <strong>{entry.message || 'Bell with no message'}</strong>
                  <span>{new Date(entry.sentAt).toLocaleString()}</span>
                </div>
                <div className="anb-log-targets">
                  {entry.targets.map(target => (
                    <span
                      key={target.userId}
                      className={`anb-chip ${target.acknowledgedAt ? 'ack' : target.online ? 'sent' : 'miss'}`}
                    >
                      {target.acknowledgedAt ? (
                        <CheckCheck size={12} />
                      ) : target.online ? (
                        <Check size={12} />
                      ) : null}
                      {target.name}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default AnnouncementBell;
