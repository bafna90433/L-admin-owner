import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BellRing,
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
import { TONES, previewTone, unlockAudio, isAudioReady, type ToneId } from '../utils/ringtones';
import '../styles/AnnouncementBell.css';

/**
 * Announcement Bell — the MD picks staff, hits the bell, and their PCs ring.
 *
 * Delivery rides the same Server-Sent Events stream the staff listen on, so a
 * ring lands in a few hundred milliseconds. This page also keeps the stream
 * open for itself, which is how the "sun liya" ticks arrive live.
 */

const IMAGEKIT_PUBLIC_KEY = 'public_LB0AyCgim15VO491kDtVm0Fo798=';

interface StaffRow {
  _id: string;
  name: string;
  username: string;
  online: boolean;
  tone: ToneId;
  customName?: string;
}

interface LogTarget {
  userId: string;
  name: string;
  tone: string;
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
  const [speak, setSpeak] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [repeat, setRepeat] = useState(3);
  const [ringing, setRinging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [soundReady, setSoundReady] = useState(isAudioReady());

  const sourceRef = useRef<EventSource | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  /* ---------- data ---------- */

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/announce/status`, { headers: authHeaders });
      if (!res.ok) throw new Error('status failed');
      const data = await res.json();
      setStaff(Array.isArray(data.staff) ? data.staff : []);
      setLog(Array.isArray(data.log) ? data.log : []);
    } catch {
      setNotice('Status load nahi hua — dubara try kijiye.');
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

  const saveTone = async (userId: string, tone: ToneId, customUrl = '', customName = '') => {
    setStaff(prev => prev.map(s => (s._id === userId ? { ...s, tone, customName } : s)));
    try {
      const res = await fetch(`${apiBase}/announce/ringtones`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tone, customUrl, customName })
      });
      if (!res.ok) throw new Error('save failed');
    } catch {
      setNotice('Ringtone save nahi hua.');
      void loadStatus();
    }
  };

  const openUpload = (userId: string) => {
    uploadTargetRef.current = userId;
    uploadInputRef.current?.click();
  };

  const handleUpload = async (file: File | undefined) => {
    const userId = uploadTargetRef.current;
    if (!file || !userId) return;
    setUploadingFor(userId);
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

      await saveTone(userId, 'custom', uploaded.url, file.name);
      setNotice(`${file.name} set ho gaya.`);
    } catch {
      setNotice('Upload nahi hua — mp3 file try kijiye.');
    } finally {
      setUploadingFor(null);
      uploadTargetRef.current = null;
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
          speak,
          urgent,
          repeat
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'ring failed');

      setNotice(
        data.offline?.length
          ? `${data.delivered} PC par baja. Offline: ${data.offline.join(', ')}`
          : `${data.delivered} PC par baj gaya.`
      );
      void loadStatus();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Bell nahi baji.');
    } finally {
      setRinging(false);
    }
  };

  const preview = async (tone: ToneId, customUrl = '') => {
    if (!isAudioReady()) {
      const ok = await unlockAudio();
      setSoundReady(ok);
    }
    previewTone(tone, customUrl);
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
          <p>Staff select kijiye, bell dabaiye — unke PC par unka apna ringtone bajega.</p>
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
          <h2>Ring karein</h2>

          <label className="anb-label">Message (optional)</label>
          <textarea
            className="anb-textarea"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="e.g. Sab log meeting room me aaiye"
            rows={3}
            maxLength={400}
          />

          <div className="anb-options">
            <button
              type="button"
              className={`anb-switch ${speak ? 'on' : ''}`}
              onClick={() => setSpeak(v => !v)}
            >
              <i />
              <span>
                Message bol kar sunaiye
                <small>Ringtone ke baad awaaz me padha jayega</small>
              </span>
            </button>

            <button
              type="button"
              className={`anb-switch ${urgent ? 'on' : ''}`}
              onClick={() => setUrgent(v => !v)}
            >
              <i />
              <span>
                Urgent
                <small>Staff screen par laal alert dikhega</small>
              </span>
            </button>
          </div>

          <label className="anb-label">Kitni baar bajega</label>
          <div className="anb-repeat">
            {[1, 3, 5, 8].map(n => (
              <button
                key={n}
                type="button"
                className={repeat === n ? 'on' : ''}
                onClick={() => setRepeat(n)}
              >
                {n}x
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`anb-ring-btn ${urgent ? 'urgent' : ''}`}
            onClick={() => void ring()}
            disabled={!selected.size || ringing}
          >
            {ringing ? <Loader2 size={22} className="anb-spin" /> : <BellRing size={22} />}
            {ringing ? 'Bhej raha hai...' : `Bell bajaiye (${selected.size})`}
          </button>

          {!soundReady && (
            <button type="button" className="anb-ghost wide" onClick={() => void preview('chime')}>
              <Volume2 size={14} /> Is PC par sound test kijiye
            </button>
          )}
        </section>

        {/* ---------- staff + tones ---------- */}
        <section className="anb-card anb-staff">
          <div className="anb-staff-head">
            <h2>Staff aur unke ringtone</h2>
            <div className="anb-staff-actions">
              <button type="button" className="anb-ghost" onClick={selectOnline}>
                Online select
              </button>
              <button type="button" className="anb-ghost" onClick={toggleAll}>
                {allSelected ? 'Clear' : 'Select all'}
              </button>
            </div>
          </div>

          {loading ? (
            <p className="anb-empty">
              <Loader2 size={16} className="anb-spin" /> Load ho raha hai...
            </p>
          ) : staff.length === 0 ? (
            <p className="anb-empty">Koi staff nahi mila.</p>
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

                  <div className="anb-tone-row">
                    <Music4 size={14} />
                    <select
                      value={person.tone}
                      onChange={e => void saveTone(person._id, e.target.value as ToneId)}
                    >
                      {TONES.map(tone => (
                        <option key={tone.id} value={tone.id}>
                          {tone.name}
                        </option>
                      ))}
                      {person.tone === 'custom' && (
                        <option value="custom">{person.customName || 'Custom tone'}</option>
                      )}
                    </select>

                    <button
                      type="button"
                      className="anb-icon-btn"
                      title="Sun kar dekhiye"
                      onClick={() => void preview(person.tone)}
                    >
                      <Play size={13} />
                    </button>

                    <button
                      type="button"
                      className="anb-icon-btn"
                      title="Apni mp3 upload kijiye"
                      onClick={() => openUpload(person._id)}
                      disabled={uploadingFor === person._id}
                    >
                      {uploadingFor === person._id ? (
                        <Loader2 size={13} className="anb-spin" />
                      ) : (
                        <Upload size={13} />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------- history ---------- */}
      <section className="anb-card anb-log">
        <h2>Pichhli announcements</h2>
        {log.length === 0 ? (
          <p className="anb-empty">Abhi tak koi bell nahi baji.</p>
        ) : (
          <ul>
            {log.map(entry => (
              <li key={entry.ringId}>
                <div className="anb-log-head">
                  <strong>{entry.message || 'Bina message ke bell'}</strong>
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
