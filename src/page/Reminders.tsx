import { useState } from 'react';
import { Loader } from 'lucide-react';
import '../styles/Reminders.css';

interface Reminder {
  _id: string;
  message: string;
  targetDate: string;
  status: 'pending' | 'acknowledged';
  acknowledgedBy?: {
    name: string;
  };
  acknowledgedAt?: string;
}

interface RemindersProps {
  token: string | null;
  apiBase: string;
  reminders: Reminder[];
  fetchReminders: () => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export default function Reminders({
  token,
  apiBase,
  reminders,
  fetchReminders,
  showToast
}: RemindersProps) {
  const [newRemMsg, setNewRemMsg] = useState('');
  const [newRemDate, setNewRemDate] = useState('');
  const [remSubmitting, setRemSubmitting] = useState(false);

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemMsg || !newRemDate) return;
    setRemSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: newRemMsg,
          targetDate: newRemDate
        })
      });
      if (res.ok) {
        setNewRemMsg('');
        setNewRemDate('');
        fetchReminders();
        showToast('Notice broadcasted to office staff successfully!', 'success');
      } else {
        showToast('Failed to send notice', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setRemSubmitting(false);
    }
  };

  return (
    <div className="reminders-page-container">
      <div>
        <h1 style={{ fontSize: '2.2rem' }}>Broadcast Notices & Reminders</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Send alerts, itineraries, or task warnings to the Office Staff panel.</p>
      </div>

      <div className="reminders-grid">
        {/* Form to create reminder */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>Create New Reminder</h3>
          <form onSubmit={handleCreateReminder} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Message / Itinerary</label>
              <textarea 
                className="form-input"
                placeholder="e.g. Owner going to Mumbai for client meeting on June 15"
                value={newRemMsg}
                onChange={e => setNewRemMsg(e.target.value)}
                style={{ minHeight: '120px', resize: 'vertical' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Target Date</label>
              <input 
                type="date"
                className="form-input"
                value={newRemDate}
                onChange={e => setNewRemDate(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={remSubmitting}>
              {remSubmitting ? <Loader className="spinner" size={16} /> : 'Broadcast Reminder'}
            </button>
          </form>
        </div>

        {/* List of existing reminders */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.25rem' }}>Broadcast History</h3>
          <div className="reminder-history-list">
            {reminders.map((rem) => (
              <div key={rem._id} className="reminder-history-card">
                <div className="flex-between" style={{ marginBottom: '8px' }}>
                  <span className="badge badge-info" style={{ fontWeight: 700 }}>
                    Target: {new Date(rem.targetDate).toLocaleDateString('en-GB')}
                  </span>
                  <span className={`badge ${
                    rem.status === 'acknowledged' ? 'badge-success' : 'badge-warning'
                  }`}>
                    {rem.status}
                  </span>
                </div>
                
                <p style={{ fontWeight: 600, fontSize: '1.05rem', margin: '8px 0', color: 'var(--text-primary)' }}>
                  {rem.message}
                </p>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  {rem.status === 'acknowledged' ? (
                    <div>
                      ✅ Acknowledged by <span style={{ fontWeight: 600 }}>{rem.acknowledgedBy?.name}</span> on {new Date(rem.acknowledgedAt || '').toLocaleString('en-GB')}
                    </div>
                  ) : (
                    <div>⏳ Awaiting staff acknowledgement</div>
                  )}
                </div>
              </div>
            ))}

            {reminders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                No notices broadcasted yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
