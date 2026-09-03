import React, { useState, useEffect } from 'react';
import { Loader, Send, Lock, Bell, BellOff, CheckCircle2, Zap } from 'lucide-react';
import '../styles/Tasks.css';

interface Task {
  _id: string;
  title: string;
  taskType: 'regular' | 'reminder-sir' | 'custom';
  frequency: 'daily' | 'weekly' | 'monthly' | 'one-time';
  status: 'pending' | 'completed';
  assignedTo?: {
    name: string;
    username?: string;
  };
  comments?: any[];
  seenByOwner?: boolean;
  seenAt?: string;
  reminderDateTime?: string | null;
  reminderAlarmArmed?: boolean;
  reminderNote?: string;
}

interface TaskDetailModalProps {
  task: Task;
  token: string | null;
  apiBase: string;
  onClose: () => void;
  onTaskUpdated: () => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export default function TaskDetailModal({
  task,
  token,
  apiBase,
  onClose,
  onTaskUpdated,
  showToast
}: TaskDetailModalProps) {
  const [newCommentText, setNewCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Helper to format Date to YYYY-MM-DD
  const formatDateToYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Extract initial reminder state
  const parseReminderDate = (isoStr?: string | null) => {
    if (!isoStr) {
      const now = new Date(Date.now() + 30 * 60 * 1000); // default 30 mins ahead
      let hours = now.getHours();
      const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const minutes = Math.ceil(now.getMinutes() / 5) * 5 % 60;
      return {
        date: formatDateToYMD(now),
        hour: String(hours).padStart(2, '0'),
        minute: String(minutes).padStart(2, '0'),
        period
      };
    }
    const d = new Date(isoStr);
    let hours = d.getHours();
    const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const minutes = d.getMinutes();
    return {
      date: formatDateToYMD(d),
      hour: String(hours).padStart(2, '0'),
      minute: String(minutes).padStart(2, '0'),
      period
    };
  };

  const initialParsed = parseReminderDate(task.reminderDateTime);
  const [remDate, setRemDate] = useState(initialParsed.date);
  const [remHour, setRemHour] = useState(initialParsed.hour);
  const [remMinute, setRemMinute] = useState(initialParsed.minute);
  const [remPeriod, setRemPeriod] = useState<'AM' | 'PM'>(initialParsed.period);
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const [showReminderSettings, setShowReminderSettings] = useState(Boolean(task.reminderDateTime) || false);

  useEffect(() => {
    if (task && !task.seenByOwner) {
      const markAsSeen = async () => {
        try {
          await fetch(`${apiBase}/tasks/${task._id}/seen`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          onTaskUpdated();
        } catch (err) {
          console.error('Failed to mark task as seen', err);
        }
      };
      markAsSeen();
    }
  }, [task, token, apiBase, onTaskUpdated]);

  // Sync reminder inputs if task changes
  useEffect(() => {
    if (task.reminderDateTime) {
      const p = parseReminderDate(task.reminderDateTime);
      setRemDate(p.date);
      setRemHour(p.hour);
      setRemMinute(p.minute);
      setRemPeriod(p.period);
      setShowReminderSettings(true);
    }
  }, [task.reminderDateTime]);

  // Construct final Date object from Date + 12h Hour + Minute + AM/PM
  const buildIsoDateTime = (dateStr: string, hourStr: string, minStr: string, period: 'AM' | 'PM') => {
    let h = parseInt(hourStr, 10) || 12;
    const m = parseInt(minStr, 10) || 0;
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;

    const [year, month, day] = dateStr.split('-').map(Number);
    const target = new Date(year, month - 1, day, h, m, 0, 0);
    return target.toISOString();
  };

  const applyPreset = (minutesFromNow: number) => {
    const target = new Date(Date.now() + minutesFromNow * 60 * 1000);
    let hours = target.getHours();
    const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const mins = target.getMinutes();
    setRemDate(formatDateToYMD(target));
    setRemHour(String(hours).padStart(2, '0'));
    setRemMinute(String(mins).padStart(2, '0'));
    setRemPeriod(period);
  };

  const applyTodayEvening = () => {
    const today = new Date();
    today.setHours(17, 0, 0, 0); // 5:00 PM
    if (today.getTime() <= Date.now()) {
      today.setDate(today.getDate() + 1); // Tomorrow 5 PM if today past 5 PM
    }
    setRemDate(formatDateToYMD(today));
    setRemHour('05');
    setRemMinute('00');
    setRemPeriod('PM');
  };

  const applyTomorrowMorning = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0); // 10:00 AM
    setRemDate(formatDateToYMD(tomorrow));
    setRemHour('10');
    setRemMinute('00');
    setRemPeriod('AM');
  };

  const handleSaveReminder = async () => {
    if (!remDate) {
      showToast('Please select a reminder date', 'warning');
      return;
    }
    setIsSavingReminder(true);
    try {
      const isoStr = buildIsoDateTime(remDate, remHour, remMinute, remPeriod);
      
      const res = await fetch(`${apiBase}/tasks/${task._id}/set-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reminderDateTime: isoStr
        })
      });

      if (res.ok) {
        onTaskUpdated();
        const formattedTime = new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        const formattedDate = new Date(isoStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        showToast(`⏰ Reminder alarm set for ${formattedDate} at ${formattedTime}! It will ring for both MD & Staff.`, 'success');
      } else {
        showToast('Failed to set reminder', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setIsSavingReminder(false);
    }
  };

  const handleClearReminder = async () => {
    setIsSavingReminder(true);
    try {
      const res = await fetch(`${apiBase}/tasks/${task._id}/set-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reminderDateTime: null
        })
      });

      if (res.ok) {
        onTaskUpdated();
        showToast('🔕 Reminder alarm removed for this task.', 'info');
      } else {
        showToast('Failed to clear reminder', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setIsSavingReminder(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText || !task) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/tasks/${task._id}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: newCommentText })
      });
      if (res.ok) {
        setNewCommentText('');
        onTaskUpdated();
      } else {
        showToast('Failed to add comment', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const [isCompleting, setIsCompleting] = useState(false);

  const handleCompleteTask = async () => {
    setIsCompleting(true);
    try {
      const res = await fetch(`${apiBase}/tasks/${task._id}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('✅ Task marked as Finished & Completed by MD!', 'success');
        onTaskUpdated();
        onClose();
      } else {
        showToast('Failed to complete task', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleResetTask = async () => {
    setIsCompleting(true);
    try {
      const res = await fetch(`${apiBase}/tasks/${task._id}/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Task reopened back to pending.', 'success');
        onTaskUpdated();
      } else {
        showToast('Failed to reset task', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setIsCompleting(false);
    }
  };

  const hasActiveReminder = Boolean(task.reminderDateTime);
  const formattedActiveReminder = task.reminderDateTime 
    ? `${new Date(task.reminderDateTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at ${new Date(task.reminderDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`
    : null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      padding: '16px'
    }}>
      <div className="glass-panel animate-fade-in" style={{ 
        width: '100%', 
        maxWidth: '620px', 
        padding: '24px 28px', 
        display: 'flex', 
        flexDirection: 'column', 
        maxHeight: '92vh',
        background: '#ffffff',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
        border: '1.5px solid rgba(226, 232, 240, 0.95)',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div className="flex-between" style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className={`badge ${task.status === 'completed' ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'uppercase', fontWeight: 800 }}>
              {task.status}
            </span>
            {task.taskType === 'reminder-sir' && (
              <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={12} /> MD Directive
              </span>
            )}
            {hasActiveReminder && (
              <span className="badge" style={{ 
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
                color: '#ffffff',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)'
              }}>
                <Bell size={12} /> Alarm Armed
              </span>
            )}
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-secondary"
            style={{ padding: '6px 10px', borderRadius: '50%', fontSize: '0.85rem' }}
          >
            ✕
          </button>
        </div>

        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', lineHeight: 1.3 }}>
          {task.title}
        </h3>
        
        <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '0 0 14px 0', paddingBottom: '10px', borderBottom: '1px solid rgba(226, 232, 240, 0.8)' }}>
          Category: <span style={{ fontWeight: 700, textTransform: 'capitalize', color: '#0f172a' }}>{task.taskType} ({task.frequency})</span> • Assigned to: <span style={{ fontWeight: 700, color: '#4f46e5' }}>{task.assignedTo?.name || 'All Staff'}</span>
        </p>

        {/* MD Authority Action Bar (Finish Work / Reopen) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: '14px',
          background: task.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(79, 70, 229, 0.06)',
          border: task.status === 'completed' ? '1.5px solid rgba(16, 185, 129, 0.3)' : '1.5px solid rgba(79, 70, 229, 0.18)',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: task.status === 'completed' ? '#065f46' : '#1e293b' }}>
              {task.status === 'completed' ? '✅ Work Completed & Approved' : '⏳ Status: In-Progress / Pending'}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
              {task.status === 'completed' ? 'This task has been completed and verified.' : 'Only MD has authority to mark this task as finished.'}
            </div>
          </div>

          <div>
            {task.status !== 'completed' ? (
              <button
                type="button"
                onClick={handleCompleteTask}
                disabled={isCompleting}
                className="btn btn-success"
                style={{
                  padding: '8px 18px',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 3px 8px rgba(16, 185, 129, 0.3)',
                  borderRadius: '10px'
                }}
              >
                {isCompleting ? <Loader className="spinner" size={14} /> : <CheckCircle2 size={16} />}
                Finish Work
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetTask}
                disabled={isCompleting}
                className="btn btn-secondary"
                style={{
                  padding: '6px 14px',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: 'var(--color-warning)'
                }}
              >
                {isCompleting ? <Loader className="spinner" size={14} /> : 'Reopen Task'}
              </button>
            )}
          </div>
        </div>

        {/* SET REMINDER ALARM SECTION (Highlighted for MD) */}
        <div style={{
          background: hasActiveReminder 
            ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' 
            : '#f8fafc',
          border: hasActiveReminder 
            ? '1.5px solid #fcd34d' 
            : '1.5px solid #e2e8f0',
          borderRadius: '16px',
          padding: '16px 18px',
          marginBottom: '16px',
          boxShadow: hasActiveReminder ? '0 4px 12px rgba(245, 158, 11, 0.12)' : 'none'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: hasActiveReminder ? '#f59e0b' : '#4f46e5',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Bell size={18} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
                  Set Reminder Alarm (MD & Staff)
                </h4>
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>
                  At scheduled time, continuous alarm will ring simultaneously on MD & Staff screens
                </p>
              </div>
            </div>

            {!showReminderSettings && (
              <button
                type="button"
                onClick={() => setShowReminderSettings(true)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  background: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                + Configure Alarm
              </button>
            )}
          </div>

          {/* Active Reminder Status Banner */}
          {hasActiveReminder && (
            <div style={{
              background: '#ffffff',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: showReminderSettings ? '12px' : '0',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} style={{ color: '#d97706' }} />
                <div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#92400e' }}>
                    ⏰ Scheduled: {formattedActiveReminder}
                  </span>
                  <div style={{ fontSize: '0.72rem', color: '#b45309' }}>
                    Alarm active for both Managing Director and Staff ({task.assignedTo?.name || 'All Staff'})
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearReminder}
                disabled={isSavingReminder}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fca5a5',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <BellOff size={13} /> Remove Alarm
              </button>
            </div>
          )}

          {/* Date, Time AM/PM Picker and Controls */}
          {showReminderSettings && (
            <div style={{ marginTop: '8px' }}>
              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => applyPreset(15)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Zap size={11} style={{ color: '#f59e0b' }} /> +15 Min
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(30)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Zap size={11} style={{ color: '#f59e0b' }} /> +30 Min
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(60)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Zap size={11} style={{ color: '#f59e0b' }} /> +1 Hour
                </button>
                <button
                  type="button"
                  onClick={applyTodayEvening}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🌆 Today 5:00 PM
                </button>
                <button
                  type="button"
                  onClick={applyTomorrowMorning}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🌅 Tomorrow 10:00 AM
                </button>
              </div>

              {/* Date & Time AM/PM Pickers Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.9fr', gap: '8px', alignItems: 'flex-end', marginBottom: '12px' }}>
                {/* Date Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    📅 Date
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={remDate}
                    onChange={e => setRemDate(e.target.value)}
                    min={formatDateToYMD(new Date())}
                    style={{ padding: '7px 10px', fontSize: '0.82rem', borderRadius: '10px' }}
                  />
                </div>

                {/* Hour Select (1-12) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    ⏰ Hour (1-12)
                  </label>
                  <select
                    className="form-input"
                    value={remHour}
                    onChange={e => setRemHour(e.target.value)}
                    style={{ padding: '7px 10px', fontSize: '0.82rem', borderRadius: '10px', fontWeight: 700 }}
                  >
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Minute Select (00-55) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    ⏱ Minute
                  </label>
                  <select
                    className="form-input"
                    value={remMinute}
                    onChange={e => setRemMinute(e.target.value)}
                    style={{ padding: '7px 10px', fontSize: '0.82rem', borderRadius: '10px', fontWeight: 700 }}
                  >
                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* AM / PM Toggle */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    ☀️ / 🌙 Period
                  </label>
                  <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', border: '1.5px solid #cbd5e1' }}>
                    <button
                      type="button"
                      onClick={() => setRemPeriod('AM')}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        background: remPeriod === 'AM' ? '#4f46e5' : '#ffffff',
                        color: remPeriod === 'AM' ? '#ffffff' : '#64748b',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemPeriod('PM')}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        background: remPeriod === 'PM' ? '#4f46e5' : '#ffffff',
                        color: remPeriod === 'PM' ? '#ffffff' : '#64748b',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleSaveReminder}
                  disabled={isSavingReminder}
                  style={{
                    flexGrow: 1,
                    padding: '9px 16px',
                    borderRadius: '10px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#ffffff',
                    border: 'none',
                    boxShadow: '0 3px 10px rgba(245, 158, 11, 0.3)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {isSavingReminder ? <Loader className="spinner" size={15} /> : <Bell size={15} />}
                  <span>{hasActiveReminder ? 'Update & Arm Reminder Alarm' : 'Set & Arm Reminder Alarm'}</span>
                </button>

                {hasActiveReminder && (
                  <button
                    type="button"
                    onClick={handleClearReminder}
                    disabled={isSavingReminder}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '10px',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      background: '#f1f5f9',
                      color: '#64748b',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer'
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Discussion / Follow-up Notes (Chat View) Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            💬 Follow-up Discussion Notes
          </span>
          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
            {task.comments?.length || 0} messages
          </span>
        </div>

        {/* Discussion / Follow-up Notes (Chat View) */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '10px', 
          maxHeight: '260px', 
          overflowY: 'auto', 
          padding: '14px', 
          background: '#f8fafc', 
          border: '1.5px solid rgba(226, 232, 240, 0.95)',
          borderRadius: '16px', 
          marginBottom: '14px' 
        }}>
          {task.comments && task.comments.length > 0 ? (
            task.comments.map((c: any, index: number) => {
              const isMD = c.authorRole === 'owner' || 
                           c.authorRole === 'admin' || 
                           (c.authorName && (
                             c.authorName.toLowerCase().includes('owner') || 
                             c.authorName.toLowerCase().includes('director') || 
                             c.authorName.toLowerCase().includes('sir') || 
                             c.authorName.toLowerCase().includes('md')
                           ));

              return (
                <div 
                  key={index}
                  style={{
                    padding: '10px 14px',
                    maxWidth: '84%',
                    alignSelf: isMD ? 'flex-end' : 'flex-start',
                    background: isMD 
                      ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' 
                      : '#ffffff',
                    color: isMD ? '#ffffff' : '#0f172a',
                    borderRadius: isMD ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    border: isMD ? 'none' : '1.5px solid rgba(226, 232, 240, 0.95)',
                    boxShadow: isMD 
                      ? '0 4px 14px rgba(79, 70, 229, 0.25)' 
                      : '0 2px 6px rgba(15, 23, 42, 0.03)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: '3px' }}>
                    <span style={{ 
                      fontWeight: 800, 
                      fontSize: '0.74rem', 
                      color: isMD ? '#e0e7ff' : '#4f46e5',
                      letterSpacing: '0.02em'
                    }}>
                      {isMD ? '👑 You (MD / Owner)' : `👤 ${c.authorName || 'Staff'} (Staff)`}
                    </span>
                    <span style={{ 
                      fontSize: '0.66rem', 
                      color: isMD ? 'rgba(255, 255, 255, 0.75)' : '#94a3b8' 
                    }}>
                      {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                    </span>
                  </div>
                  <p style={{ 
                    fontSize: '0.88rem', 
                    color: isMD ? '#ffffff' : '#1e293b', 
                    margin: 0, 
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.4 
                  }}>
                    {c.text}
                  </p>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 14px', fontSize: '0.84rem' }}>
              💬 No discussion notes yet. Write a message below to give instructions or ask staff for an update.
            </div>
          )}
        </div>

        {/* Comment Form */}
        <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Ask for update, give instructions or reply..."
            value={newCommentText}
            onChange={e => setNewCommentText(e.target.value)}
            required
            style={{ 
              flexGrow: 1, 
              padding: '10px 14px', 
              fontSize: '0.88rem', 
              borderRadius: '12px',
              border: '1.5px solid rgba(226, 232, 240, 0.95)'
            }}
          />
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={commentSubmitting} 
            style={{ 
              padding: '10px 18px', 
              borderRadius: '12px',
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' 
            }}
          >
            {commentSubmitting ? <Loader className="spinner" size={16} /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
