import { useState } from 'react';
import { Loader, Edit2, Trash2, Volume2 } from 'lucide-react';
import '../styles/Reminders.css';

interface Reminder {
  _id: string;
  message: string;
  targetDate: string;
  status: 'pending' | 'acknowledged';
  type?: 'general' | 'salary-delay' | 'self';
  language?: 'en' | 'hi' | 'ta';
  createdBy?: {
    _id?: string;
    name: string;
    username?: string;
  };
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
  const [newRemMsg, setNewRemMsg] = useState('');
  const [targetStaffId, setTargetStaffId] = useState('');
  const [remVoiceLang, setRemVoiceLang] = useState<'en' | 'hi' | 'ta'>('en');
  const [remSubmitting, setRemSubmitting] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [deletingReminderId, setDeletingReminderId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'broadcast' | 'personal'>('all');
  const [selectedStaffId, setSelectedStaffId] = useState<string | 'all'>('all');

  const broadcastCount = reminders.filter(r => r.type !== 'self').length;
  const personalCount = reminders.filter(r => r.type === 'self').length;

  const filteredReminders = reminders.filter(rem => {
    if (filterType === 'broadcast' && rem.type === 'self') return false;
    if (filterType === 'personal' && rem.type !== 'self') return false;

    if (selectedStaffId !== 'all') {
      const staffObj = allStaff.find(s => (s.id || s._id) === selectedStaffId);
      const staffName = staffObj?.name?.trim().toLowerCase();
      
      const createdById = rem.createdBy?._id;
      const createdByName = rem.createdBy?.name?.trim().toLowerCase();
      
      const targetId = (rem.targetStaffId as any)?._id || (rem.targetStaffId as any)?.id;
      const targetName = rem.targetStaffId?.name?.trim().toLowerCase();
      
      const ackById = (rem.acknowledgedBy as any)?._id || (rem.acknowledgedBy as any)?.id;
      const ackByName = rem.acknowledgedBy?.name?.trim().toLowerCase();

      const matchesCreated = (createdById && createdById === selectedStaffId) || (Boolean(staffName) && createdByName === staffName);
      const matchesTarget = (targetId && targetId === selectedStaffId) || (Boolean(staffName) && targetName === staffName);
      const matchesAck = (ackById && ackById === selectedStaffId) || (Boolean(staffName) && ackByName === staffName);

      if (!matchesCreated && !matchesTarget && !matchesAck) {
        return false;
      }
    }

    return true;
  });

  const handleCreateOrUpdateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemMsg.trim()) return;
    setRemSubmitting(true);
    try {
      const url = editingReminderId 
        ? `${apiBase}/reminders/${editingReminderId}` 
        : `${apiBase}/reminders`;
      const method = editingReminderId ? 'PUT' : 'POST';

      const cleanMsg = newRemMsg.replace(/\[lang:(en|hi|ta)\]\s*/g, '').trim();
      const finalMsg = `[lang:${remVoiceLang}] ${cleanMsg}`;

      const payload: {
        message: string;
        targetStaffId: string | null;
        targetDate?: string;
        language?: string;
      } = {
        message: finalMsg,
        targetStaffId: targetStaffId || null,
        language: remVoiceLang
      };

      if (!editingReminderId) {
        // Set placeholder future date until staff sets the exact date/time in Staff Desk
        payload.targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
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
        setNewRemMsg('');
        setTargetStaffId('');
        setRemVoiceLang('en');
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
    const langMatch = rem.message?.match(/\[lang:(en|hi|ta)\]/);
    if (langMatch) {
      setRemVoiceLang(langMatch[1] as any);
    } else {
      setRemVoiceLang(rem.language || 'en');
    }
    setNewRemMsg((rem.message || '').replace(/\[lang:(en|hi|ta)\]\s*/g, '').trim());
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
        <div className="glass-panel reminders-create-panel" style={{ height: 'fit-content' }}>
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
                placeholder="Enter instructions or reminder notice (e.g. Me kall room jaunga mujhe yaad dilao)..."
                value={newRemMsg}
                onChange={e => setNewRemMsg(e.target.value)}
                style={{ minHeight: '80px', resize: 'vertical' }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Assign To Staff Member</label>
                <select 
                  className="form-input"
                  value={targetStaffId}
                  onChange={e => setTargetStaffId(e.target.value)}
                >
                  <option value="">All Staff (Broadcast)</option>
                  {allStaff.map(s => (
                    <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Volume2 size={14} style={{ color: '#4f46e5' }} />
                  Voice Alert Language
                </label>
                <select 
                  className="form-input"
                  value={remVoiceLang}
                  onChange={e => setRemVoiceLang(e.target.value as any)}
                  style={{ fontWeight: 600 }}
                >
                  <option value="en">🇬🇧 English (Default)</option>
                  <option value="hi">🇮🇳 Hindi (हिन्दी)</option>
                  <option value="ta">🌴 Tamil (தமிழ்)</option>
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={remSubmitting}>
              {remSubmitting ? <Loader className="spinner" size={16} /> : (editingReminderId ? 'Update Reminder' : 'Broadcast Reminder')}
            </button>
          </form>
        </div>

        {/* List of existing reminders */}
        <div className="glass-panel reminders-list-panel">
          {/* Sticky Header Section */}
          <div className="reminders-sticky-header">
            <div className="flex-between" style={{ flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Reminders & Broadcast History</h3>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  type="button" 
                  className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`} 
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => setFilterType('all')}
                >
                  All ({reminders.length})
                </button>
                <button 
                  type="button" 
                  className={`btn ${filterType === 'broadcast' ? 'btn-primary' : 'btn-secondary'}`} 
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => setFilterType('broadcast')}
                >
                  Broadcasts ({broadcastCount})
                </button>
                <button 
                  type="button" 
                  className={`btn ${filterType === 'personal' ? 'btn-primary' : 'btn-secondary'}`} 
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => setFilterType('personal')}
                >
                  Staff Personal ({personalCount})
                </button>
              </div>
            </div>

            {/* Horizontal Staff Tabs (Extra Large Circular Avatars with Name Below) */}
            <div style={{ display: 'flex', gap: '22px', overflowX: 'auto', padding: '10px 4px 4px 4px', marginTop: '6px', alignItems: 'flex-start' }}>
              {/* All Staff / All Notices Button */}
              <button
                type="button"
                onClick={() => setSelectedStaffId('all')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  minWidth: '76px',
                  transition: 'transform 0.15s ease'
                }}
              >
                <div
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: '50%',
                    background: selectedStaffId === 'all'
                      ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                      : '#f1f5f9',
                    color: selectedStaffId === 'all' ? '#ffffff' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.75rem',
                    border: selectedStaffId === 'all' ? '3.5px solid #6366f1' : '2px solid #cbd5e1',
                    boxShadow: selectedStaffId === 'all' ? '0 6px 18px rgba(99, 102, 241, 0.45)' : 'none',
                    transition: 'all 0.18s ease'
                  }}
                >
                  📋
                </div>
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: selectedStaffId === 'all' ? 700 : 550,
                    color: selectedStaffId === 'all' ? '#4f46e5' : '#475569',
                    whiteSpace: 'nowrap'
                  }}
                >
                  All Notices
                </span>
              </button>

              {/* Staff Members List */}
              {allStaff.map(staff => {
                const staffId = staff.id || staff._id || '';
                const isSelected = selectedStaffId === staffId;
                const avatarUrl = staff.imageUrl ? (staff.imageUrl.startsWith('http') ? staff.imageUrl : `${apiBase}${staff.imageUrl}`) : null;
                
                return (
                  <button
                    key={staffId}
                    type="button"
                    onClick={() => setSelectedStaffId(staffId)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      minWidth: '76px',
                      transition: 'transform 0.15s ease'
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        width: 70,
                        height: 70,
                        borderRadius: '50%',
                        padding: isSelected ? '3px' : '0px',
                        border: isSelected ? '3.5px solid #6366f1' : '2px solid #e2e8f0',
                        boxShadow: isSelected ? '0 6px 18px rgba(99, 102, 241, 0.4)' : '0 2px 8px rgba(0,0,0,0.06)',
                        background: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.18s ease',
                        pointerEvents: 'none'
                      }}
                    >
                      {avatarUrl ? (
                        <img 
                          src={avatarUrl} 
                          alt={staff.name} 
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                        />
                      ) : (
                        <div 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            borderRadius: '50%', 
                            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            color: '#ffffff', 
                            fontWeight: 700, 
                            fontSize: '1.4rem' 
                          }}
                        >
                          {staff.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: isSelected ? 700 : 550,
                        color: isSelected ? '#4f46e5' : '#475569',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {staff.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="reminder-history-list" style={{ padding: '0 20px 20px 20px' }}>
            {filteredReminders.map((rem) => {
              const timeDiff = new Date(rem.targetDate).getTime() - Date.now();
              const isUrgent = rem.status === 'acknowledged' && timeDiff <= 10 * 60 * 1000 && timeDiff > -1000 * 60 * 60 * 24;
              const isPersonal = rem.type === 'self';
              const cleanDisplayMsg = (rem.message || '').replace(/\[lang:(en|hi|ta)\]\s*/g, '').trim();
              
              return (
              <div key={rem._id} className={`reminder-history-card ${isUrgent ? 'urgent-pulse' : ''}`} style={isUrgent ? { border: '2px solid var(--color-danger)' } : isPersonal ? { borderLeft: '4px solid #6366f1' } : {}}>
                <div className="flex-between" style={{ marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  {rem.status === 'acknowledged' || isPersonal ? (
                    <span className={`badge ${isUrgent ? 'badge-danger' : 'badge-info'}`} style={{ fontWeight: 700 }}>
                      {isUrgent && <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#fff', marginRight: '6px', animation: 'blinkDot 1s infinite' }} />}
                      ⏰ ALARM: {new Date(rem.targetDate).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  ) : (
                    <span className="badge badge-warning" style={{ fontWeight: 700 }}>
                      ⏳ Awaiting Staff Schedule
                    </span>
                  )}

                  {isPersonal ? (
                    <span className="badge badge-info" style={{ fontSize: '0.7rem', background: '#e0e7ff', color: '#3730a3', fontWeight: 600 }}>
                      👤 Staff Personal: {rem.createdBy?.name || 'Staff Member'}
                    </span>
                  ) : (
                    rem.targetStaffId && (
                      <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                        👤 Assigned to: {rem.targetStaffId.name}
                      </span>
                    )
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`badge ${
                      rem.status === 'acknowledged' ? 'badge-success' : 'badge-warning'
                    }`}>
                      {rem.status}
                    </span>
                    {!isPersonal && (
                      <button onClick={() => handleEdit(rem)} className="btn btn-secondary" style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }} title="Edit">
                        <Edit2 size={16} />
                      </button>
                    )}
                    <button onClick={() => confirmDelete(rem._id || (rem as any).id)} className="btn btn-secondary" style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--color-danger)' }} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <p style={{ fontWeight: 600, fontSize: '1.05rem', margin: '8px 0', color: 'var(--text-primary)' }}>
                  {cleanDisplayMsg}
                </p>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  {rem.status === 'acknowledged' ? (
                    <div>
                      ✅ Acknowledged by <span style={{ fontWeight: 600 }}>{rem.acknowledgedBy?.name || rem.createdBy?.name}</span> on {new Date(rem.acknowledgedAt || '').toLocaleString('en-GB')}
                    </div>
                  ) : isPersonal ? (
                    <div>📌 Personal Reminder created by <span style={{ fontWeight: 600 }}>{rem.createdBy?.name || 'Staff'}</span></div>
                  ) : (
                    <div>⏳ Awaiting staff acknowledgement</div>
                  )}
                </div>
              </div>
            )})}

            {filteredReminders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                {filterType === 'personal' ? 'No staff personal reminders found.' : filterType === 'broadcast' ? 'No broadcast notices found.' : 'No reminders found.'}
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
