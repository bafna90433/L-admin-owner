import { useState } from 'react';
import { Loader, Edit2, Trash2 } from 'lucide-react';
import '../styles/Reminders.css';

interface Reminder {
  _id: string;
  message: string;
  targetDate: string;
  status: 'pending' | 'acknowledged';
  acknowledgedBy?: {
    name: string;
  };
  targetStaffId?: {
    name: string;
    username: string;
  };
  acknowledgedAt?: string;
}

interface RemindersProps {
  token: string | null;
  apiBase: string;
  reminders: Reminder[];
  allStaff: any[];
  fetchReminders: () => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export default function Reminders({
  token,
  apiBase,
  reminders,
  allStaff,
  fetchReminders,
  showToast
}: RemindersProps) {
  const [newRemMsg, setNewRemMsg] = useState('remind me');
  const [targetStaffId, setTargetStaffId] = useState('');
  const [remSubmitting, setRemSubmitting] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [deletingReminderId, setDeletingReminderId] = useState<string | null>(null);

  const handleCreateOrUpdateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemMsg) return;
    setRemSubmitting(true);
    try {
      const url = editingReminderId 
        ? `${apiBase}/reminders/${editingReminderId}`
        : `${apiBase}/reminders`;
      const method = editingReminderId ? 'PUT' : 'POST';
      const payload: {
        message: string;
        targetStaffId: string | null;
        targetDate?: string;
      } = {
        message: newRemMsg,
        targetStaffId: targetStaffId || null
      };

      if (!editingReminderId) {
        payload.targetDate = new Date().toISOString();
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setNewRemMsg('remind me');
        setTargetStaffId('');
        setEditingReminderId(null);
        fetchReminders();
        showToast(editingReminderId ? 'Notice updated successfully!' : 'Notice broadcasted to office staff successfully!', 'success');
      } else {
        showToast('Failed to save notice', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setRemSubmitting(false);
    }
  };

  const handleEdit = (rem: Reminder) => {
    setEditingReminderId(rem._id);
    setNewRemMsg(rem.message);
    setTargetStaffId(rem.targetStaffId ? (rem.targetStaffId as any)._id || (rem.targetStaffId as any).id : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = (id: string | undefined) => {
    console.log("Confirm delete clicked for id:", id);
    if (id) {
      setDeletingReminderId(id);
    } else {
      showToast('Error: Reminder ID is missing', 'danger');
    }
  };

  const handleDelete = async () => {
    if (!deletingReminderId) return;
    setRemSubmitting(true);
    try {
      console.log("Sending DELETE request for:", deletingReminderId);
      const res = await fetch(`${apiBase}/reminders/${deletingReminderId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log("DELETE response status:", res.status);
      
      if (res.ok) {
        setDeletingReminderId(null);
        fetchReminders();
        showToast('Reminder deleted successfully', 'success');
      } else {
        let errMessage = 'Failed to delete reminder';
        try {
          const errData = await res.json();
          errMessage = errData.message || errMessage;
        } catch (e) {
          console.error("Could not parse error response", e);
        }
        console.error('Delete error:', errMessage);
        showToast(errMessage, 'danger');
        setDeletingReminderId(null);
      }
    } catch (err) {
      console.error('Network/Server error during delete:', err);
      showToast('Error connecting to server', 'danger');
      setDeletingReminderId(null);
    } finally {
      setRemSubmitting(false);
    }
  };

  return (
    <div className="reminders-page-container">
      <style>{`
        @keyframes urgentPulse {
          0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.6); }
          70% { box-shadow: 0 0 0 12px rgba(220, 38, 38, 0); }
          100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
        }
        .urgent-pulse {
          animation: urgentPulse 2s infinite;
        }
        @keyframes blinkDot {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>
      <div>
        <h1 style={{ fontSize: '2.2rem' }}>Broadcast Notices & Reminders</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Send alerts, itineraries, or task warnings to the Office Staff panel.</p>
      </div>

      <div className="reminders-grid">
        {/* Form to create reminder */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <div className="flex-between" style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.25rem' }}>{editingReminderId ? 'Update Reminder' : 'Create New Reminder'}</h3>
            {editingReminderId && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                onClick={() => {
                  setEditingReminderId(null);
                  setNewRemMsg('remind me');
                  setTargetStaffId('');
                }}
              >
                Cancel Edit
              </button>
            )}
          </div>
          <form onSubmit={handleCreateOrUpdateReminder} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Message / Itinerary</label>
              <textarea 
                className="form-input"
                placeholder="e.g. Owner going to Mumbai for client meeting on June 15"
                value={newRemMsg}
                onChange={e => setNewRemMsg(e.target.value)}
                style={{ minHeight: '80px', resize: 'vertical' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Assign To Staff Member</label>
              <select 
                className="form-input"
                value={targetStaffId}
                onChange={e => setTargetStaffId(e.target.value)}
              >
                <option value="">All Office Staff (Broadcast to Everyone)</option>
                {allStaff.map(s => (
                  <option key={s.id || s._id} value={s.id || s._id}>{s.name} ({s.username})</option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={remSubmitting}>
              {remSubmitting ? <Loader className="spinner" size={16} /> : (editingReminderId ? 'Update Reminder' : 'Broadcast Reminder')}
            </button>
          </form>
        </div>

        {/* List of existing reminders */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.25rem' }}>Broadcast History</h3>
          <div className="reminder-history-list">
            {reminders.map((rem) => {
              const timeDiff = new Date(rem.targetDate).getTime() - Date.now();
              const isUrgent = rem.status === 'pending' && timeDiff <= 10 * 60 * 1000;
              
              return (
              <div key={rem._id} className={`reminder-history-card ${isUrgent ? 'urgent-pulse' : ''}`} style={isUrgent ? { border: '2px solid var(--color-danger)' } : {}}>
                <div className="flex-between" style={{ marginBottom: '8px' }}>
                  <span className={`badge ${isUrgent ? 'badge-danger' : 'badge-info'}`} style={{ fontWeight: 700 }}>
                    {isUrgent && <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#fff', marginRight: '6px', animation: 'blinkDot 1s infinite' }} />}
                    TARGET: {new Date(rem.targetDate).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  {rem.targetStaffId && (
                    <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                      👤 Assigned to: {rem.targetStaffId.name}
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`badge ${
                      rem.status === 'acknowledged' ? 'badge-success' : 'badge-warning'
                    }`}>
                      {rem.status}
                    </span>
                    <button onClick={() => handleEdit(rem)} className="btn btn-secondary" style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }} title="Edit">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => confirmDelete(rem._id || (rem as any).id)} className="btn btn-secondary" style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--color-danger)' }} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
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
            )})}

            {reminders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                No notices broadcasted yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {deletingReminderId && (
        <div 
          onClick={() => setDeletingReminderId(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div 
            className="glass-panel animate-scale-up" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              maxWidth: '400px', 
              width: '90%',
              textAlign: 'center',
              padding: '32px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--glass-border)',
              borderRadius: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--color-danger)' }}>
              <Trash2 size={32} />
            </div>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>Delete Reminder?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: 1.5 }}>
              Are you sure you want to delete this reminder? This action cannot be undone and will remove it from the staff's broadcast history.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button className="btn btn-secondary" style={{ flex: 1, padding: '12px' }} onClick={() => setDeletingReminderId(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" style={{ flex: 1, padding: '12px', background: 'var(--color-danger)' }} onClick={handleDelete}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
