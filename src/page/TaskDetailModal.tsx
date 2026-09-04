import React, { useState, useEffect } from 'react';
import { Loader, Send, Bell, BellOff, CheckCircle2, Zap, X, Layers, User, Check, ShieldCheck, Clock, RotateCcw, AlertTriangle, CheckCheck } from 'lucide-react';
import '../styles/Tasks.css';

interface Task {
  _id: string;
  title: string;
  taskType: 'regular' | 'reminder-sir' | 'custom';
  frequency: 'daily' | 'weekly' | 'monthly' | 'one-time';
  status: 'pending' | 'completed';
  assignedTo?: {
    _id?: string;
    id?: string;
    name: string;
    username?: string;
    imageUrl?: string;
  };
  completedBy?: {
    name: string;
    imageUrl?: string;
  };
  completedAt?: string;
  completionRequestedBy?: {
    _id?: string;
    id?: string;
    name: string;
    username?: string;
    imageUrl?: string;
  };
  completionRequestedAt?: string;
  description?: string;
  remarks?: string;
  nextFollowup?: string;
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
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

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

  const handleRejectCompletion = async () => {
    setIsRejecting(true);
    try {
      const res = await fetch(`${apiBase}/tasks/${task._id}/reject-completion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: rejectReason.trim() })
      });
      if (res.ok) {
        showToast('Finish request rejected. Work sent back for revision.', 'info');
        onTaskUpdated();
        setShowRejectInput(false);
        setRejectReason('');
      } else {
        showToast('Failed to reject finish request', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setIsRejecting(false);
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

  const isCompleted = task.status === 'completed';
  const isAwaitingApproval = !isCompleted && Boolean(task.completionRequestedAt);

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal-window" onClick={e => e.stopPropagation()}>
        
        {/* Top Header Bar */}
        <div className="task-modal-header-row">
          <div className="task-modal-badges">
            {isCompleted ? (
              <span className="task-status-badge badge-completed">
                <CheckCircle2 size={13} strokeWidth={2.5} /> Completed
              </span>
            ) : isAwaitingApproval ? (
              <span className="task-status-badge badge-approval-pending">
                <span className="pulsing-dot" />
                <ShieldCheck size={13} /> MD Approval Pending
              </span>
            ) : (
              <span className="task-status-badge badge-pending">
                <span className="status-dot" /> Pending
              </span>
            )}

            <span className="task-type-badge">
              <Layers size={11} />
              {task.taskType === 'regular' ? 'Regular Work' : task.taskType === 'reminder-sir' ? 'Sir Reminder' : 'Custom Task'} ({task.frequency})
            </span>

            {hasActiveReminder && (
              <span className="task-reminder-badge">
                <Bell size={11} /> Alarm Active
              </span>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="task-modal-header-actions">
            {isCompleted && (
              <button
                type="button"
                onClick={handleResetTask}
                disabled={isCompleting}
                className="task-header-reopen-btn"
              >
                {isCompleting ? <Loader className="spinner" size={13} /> : '↺ Reopen Task'}
              </button>
            )}

            {!isCompleted && !isAwaitingApproval && (
              <button
                type="button"
                onClick={handleCompleteTask}
                disabled={isCompleting}
                className="task-header-finish-btn"
                title="Directly complete task"
              >
                {isCompleting ? <Loader className="spinner" size={13} /> : <Check size={14} strokeWidth={3} />}
                <span>Finish</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="task-modal-close-btn"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Task Title & Meta Card */}
        <div className="task-modal-title-card">
          <h2 className="task-modal-main-title">
            {task.title}
          </h2>

          <div className="task-modal-meta-strip">
            <div className="task-meta-item">
              <span className="task-meta-label">Assigned to:</span>
              <span className="task-meta-user-chip">
                {task.assignedTo?.imageUrl ? (
                  <img src={task.assignedTo.imageUrl.startsWith('http') ? task.assignedTo.imageUrl : `${apiBase}${task.assignedTo.imageUrl}`} alt="" />
                ) : (
                  <User size={13} />
                )}
                <span>{task.assignedTo?.name || '👥 All Staff'}</span>
              </span>
            </div>

            {isCompleted && task.completedBy && (
              <div className="task-meta-item">
                <span className="task-meta-label">Completed by:</span>
                <span className="task-meta-user-chip chip-completed">
                  <CheckCircle2 size={13} />
                  <span>{task.completedBy.name} {task.completedAt ? `on ${new Date(task.completedAt).toLocaleDateString('en-GB')}` : ''}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* EXECUTIVE APPROVAL CALLOUT CARD */}
        {isAwaitingApproval && (
          <div className="task-modal-approval-hero animate-fade-in">
            <div className="approval-hero-header">
              <div className="approval-hero-requester">
                <div className="approval-hero-avatar">
                  {task.completionRequestedBy?.imageUrl ? (
                    <img
                      src={task.completionRequestedBy.imageUrl.startsWith('http') ? task.completionRequestedBy.imageUrl : `${apiBase}${task.completionRequestedBy.imageUrl}`}
                      alt=""
                    />
                  ) : (
                    <div className="approval-avatar-fallback">
                      {(task.completionRequestedBy?.name || task.assignedTo?.name || 'S').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="approval-avatar-badge" title="Pending MD Approval">
                    <ShieldCheck size={11} />
                  </span>
                </div>
                <div className="approval-hero-meta">
                  <div className="approval-hero-title">
                    <span>Finish Approval Requested</span>
                    <span className="approval-tag-staff">by {task.completionRequestedBy?.name || task.assignedTo?.name || 'Staff'}</span>
                  </div>
                  <div className="approval-hero-time">
                    <Clock size={12} />
                    <span>Requested on {new Date(task.completionRequestedAt || '').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="approval-hero-actions">
                <button
                  type="button"
                  onClick={handleCompleteTask}
                  disabled={isCompleting}
                  className="btn-approve-primary"
                  title="Approve work and officially mark task completed"
                >
                  {isCompleting ? <Loader className="spinner" size={14} /> : <Check size={16} strokeWidth={2.8} />}
                  <span>{isCompleting ? 'Completing...' : 'Approve & Complete'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectInput(!showRejectInput)}
                  className={`btn-reject-secondary ${showRejectInput ? 'active' : ''}`}
                  title="Send work back for revision"
                >
                  <RotateCcw size={13} />
                  <span>{showRejectInput ? 'Cancel' : 'Reject / Revise'}</span>
                </button>
              </div>
            </div>

            {/* Slide-out Revision Note Box */}
            {showRejectInput && (
              <div className="approval-revision-box animate-fade-in">
                <div className="revision-box-header">
                  <AlertTriangle size={14} style={{ color: '#e11d48' }} />
                  <span>Send task back to staff with revision feedback:</span>
                </div>
                <div className="revision-box-input-row">
                  <input
                    type="text"
                    className="form-input revision-input"
                    placeholder="e.g. Please verify bill calculation / check customer details..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleRejectCompletion}
                    disabled={isRejecting}
                    className="btn-send-revision"
                  >
                    {isRejecting ? <Loader className="spinner" size={13} /> : <Send size={13} />}
                    <span>{isRejecting ? 'Sending...' : 'Send Revision'}</span>
                  </button>
                </div>
                <div className="revision-quick-tags">
                  <span onClick={() => setRejectReason('Please recheck and verify all bill details.')}>⚡ Verify bill details</span>
                  <span onClick={() => setRejectReason('Pending confirmation from customer.')}>⚡ Customer confirmation pending</span>
                  <span onClick={() => setRejectReason('Work is incomplete, please update remarks.')}>⚡ Incomplete work</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SET REMINDER ALARM SECTION */}
        <div className={`task-modal-alarm-box ${hasActiveReminder ? 'alarm-active' : 'alarm-idle'}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: hasActiveReminder ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: hasActiveReminder ? '0 3px 8px rgba(245, 158, 11, 0.3)' : '0 3px 8px rgba(79, 70, 229, 0.25)',
                flexShrink: 0
              }}>
                <Bell size={18} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
                  Set Reminder Alarm (MD & Staff)
                </h4>
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                  Continuous alarm will ring simultaneously on MD & Staff devices
                </p>
              </div>
            </div>

            {!showReminderSettings && (
              <button
                type="button"
                onClick={() => setShowReminderSettings(true)}
                style={{
                  padding: '7px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 750,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 3px 8px rgba(79, 70, 229, 0.25)'
                }}
              >
                + Configure Alarm
              </button>
            )}
          </div>

          {/* Active Reminder Status Strip */}
          {hasActiveReminder && (
            <div style={{
              background: '#ffffff',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1.5px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: showReminderSettings ? '14px' : '0',
              flexWrap: 'wrap',
              gap: '10px',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={20} style={{ color: '#d97706', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#92400e' }}>
                    ⏰ Scheduled: {formattedActiveReminder}
                  </div>
                  <div style={{ fontSize: '0.73rem', color: '#b45309', marginTop: '1px' }}>
                    Alarm active for MD & Assigned Staff ({task.assignedTo?.name || 'All Staff'})
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearReminder}
                disabled={isSavingReminder}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.76rem',
                  fontWeight: 750,
                  borderRadius: '8px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fca5a5',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <BellOff size={13} />
                <span>Remove Alarm</span>
              </button>
            </div>
          )}

          {/* Date, Time AM/PM Picker and Controls */}
          {showReminderSettings && (
            <div style={{ marginTop: '10px' }}>
              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => applyPreset(15)}
                  className="task-preset-btn"
                >
                  <Zap size={11} style={{ color: '#f59e0b' }} /> +15 Min
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(30)}
                  className="task-preset-btn"
                >
                  <Zap size={11} style={{ color: '#f59e0b' }} /> +30 Min
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(60)}
                  className="task-preset-btn"
                >
                  <Zap size={11} style={{ color: '#f59e0b' }} /> +1 Hour
                </button>
                <button
                  type="button"
                  onClick={applyTodayEvening}
                  className="task-preset-btn"
                >
                  🌆 Today 5:00 PM
                </button>
                <button
                  type="button"
                  onClick={applyTomorrowMorning}
                  className="task-preset-btn"
                >
                  🌅 Tomorrow 10:00 AM
                </button>
              </div>

              {/* Date & Time AM/PM Pickers Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.9fr', gap: '8px', alignItems: 'flex-end', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 750, color: '#475569', marginBottom: '4px' }}>
                    📅 Date
                  </label>
                  <input
                    type="date"
                    className="task-form-input"
                    value={remDate}
                    onChange={e => setRemDate(e.target.value)}
                    min={formatDateToYMD(new Date())}
                    style={{ padding: '7px 10px', fontSize: '0.82rem', borderRadius: '10px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 750, color: '#475569', marginBottom: '4px' }}>
                    ⏰ Hour (1-12)
                  </label>
                  <select
                    className="task-form-input"
                    value={remHour}
                    onChange={e => setRemHour(e.target.value)}
                    style={{ padding: '7px 10px', fontSize: '0.82rem', borderRadius: '10px', fontWeight: 750 }}
                  >
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 750, color: '#475569', marginBottom: '4px' }}>
                    ⏱ Minute
                  </label>
                  <select
                    className="task-form-input"
                    value={remMinute}
                    onChange={e => setRemMinute(e.target.value)}
                    style={{ padding: '7px 10px', fontSize: '0.82rem', borderRadius: '10px', fontWeight: 750 }}
                  >
                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 750, color: '#475569', marginBottom: '4px' }}>
                    ☀️/🌙 Period
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

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleSaveReminder}
                  disabled={isSavingReminder}
                  style={{
                    flexGrow: 1,
                    padding: '10px 18px',
                    borderRadius: '12px',
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#ffffff',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px'
                  }}
                >
                  {isSavingReminder ? <Loader className="spinner" size={15} /> : <Bell size={16} />}
                  <span>{hasActiveReminder ? 'Update & Arm Reminder Alarm' : 'Set & Arm Reminder Alarm'}</span>
                </button>

                {hasActiveReminder && (
                  <button
                    type="button"
                    onClick={handleClearReminder}
                    disabled={isSavingReminder}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '12px',
                      fontSize: '0.84rem',
                      fontWeight: 750,
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

        {/* PREMIUM TASK MESSENGER / CHAT SECTION */}
        <div className="task-chat-card">
          {/* Chat Header Bar */}
          <div className="task-chat-header">
            <div className="task-chat-header-info">
              <div className="task-chat-avatar-stack">
                <div className="chat-avatar-pill avatar-md" title="Managing Director (You)">
                  👑
                </div>
                <div className="chat-avatar-pill avatar-staff" title={task.assignedTo?.name || 'Staff'}>
                  {task.assignedTo?.imageUrl ? (
                    <img src={task.assignedTo.imageUrl.startsWith('http') ? task.assignedTo.imageUrl : `${apiBase}${task.assignedTo.imageUrl}`} alt="" />
                  ) : (
                    (task.assignedTo?.name || 'S').charAt(0).toUpperCase()
                  )}
                </div>
              </div>
              <div>
                <div className="task-chat-title">
                  <span>Task Discussion & Activity</span>
                  <span className="task-chat-live-pulse" />
                </div>
                <div className="task-chat-subtitle">
                  Direct line with {task.assignedTo?.name || 'Assigned Staff'}
                </div>
              </div>
            </div>

            <span className="task-chat-counter-pill">
              {task.comments?.length || 0} {task.comments?.length === 1 ? 'message' : 'messages'}
            </span>
          </div>

          {/* Chat Feed Canvas */}
          <div className="task-chat-feed">
            {/* Timeline date chip */}
            <div className="task-chat-date-divider">
              <span>Today • Discussion History</span>
            </div>

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

                const isRevisionNotice = c.text && c.text.includes('Work sent back for revision');

                return (
                  <div
                    key={index}
                    className={`task-chat-row ${isMD ? 'row-owner' : 'row-staff'}`}
                  >
                    {!isMD && (
                      <div className="chat-bubble-avatar">
                        {task.assignedTo?.imageUrl ? (
                          <img src={task.assignedTo.imageUrl.startsWith('http') ? task.assignedTo.imageUrl : `${apiBase}${task.assignedTo.imageUrl}`} alt="" />
                        ) : (
                          <span>{(c.authorName || task.assignedTo?.name || 'S').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                    )}

                    <div className={isMD ? 'task-chat-bubble-owner' : 'task-chat-bubble-staff'}>
                      {/* Bubble Sender Label */}
                      <div className="bubble-meta-header">
                        <span className="bubble-author-name">
                          {isMD ? '👑 You (MD / Owner)' : `👤 ${c.authorName || 'Staff'}`}
                        </span>
                      </div>

                      {/* Message Content */}
                      {isRevisionNotice ? (
                        <div className="bubble-revision-alert">
                          <AlertTriangle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
                          <div>{c.text}</div>
                        </div>
                      ) : (
                        <p className="bubble-text">
                          {c.text}
                        </p>
                      )}

                      {/* Bubble Time & Status */}
                      <div className="bubble-meta-footer">
                        <span className="bubble-timestamp">
                          {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                        </span>
                        {isMD && (
                          <span className="bubble-ticks" title="Sent & Delivered">
                            <CheckCheck size={13} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="task-chat-empty-state">
                <div className="chat-empty-icon">💬</div>
                <div className="chat-empty-title">No discussion notes yet</div>
                <div className="chat-empty-desc">Send a message below to give instructions, check status, or guide staff.</div>
              </div>
            )}
          </div>

          {/* Quick Suggestion Chips */}
          <div className="task-chat-quick-bar">
            <span className="quick-chip-label">Quick Prompts:</span>
            <button
              type="button"
              className="task-quick-prompt-btn"
              onClick={() => setNewCommentText('Please provide a quick status update on this task.')}
            >
              ⚡ Status Update?
            </button>
            <button
              type="button"
              className="task-quick-prompt-btn"
              onClick={() => setNewCommentText('Please upload / share the final bill copy.')}
            >
              ⚡ Share Bill Copy
            </button>
            <button
              type="button"
              className="task-quick-prompt-btn"
              onClick={() => setNewCommentText('Please confirm once customer confirmation is received.')}
            >
              ⚡ Customer Confirmation
            </button>
            <button
              type="button"
              className="task-quick-prompt-btn"
              onClick={() => setNewCommentText('Work approved! Please proceed with next steps.')}
            >
              ⚡ Approved, Proceed!
            </button>
          </div>

          {/* Comment Input Dock */}
          <form onSubmit={handlePostComment} className="task-chat-dock">
            <div className="chat-input-wrapper">
              <input
                type="text"
                className="task-chat-input"
                placeholder="Type a message or instruction... (Press Enter to send)"
                value={newCommentText}
                onChange={e => setNewCommentText(e.target.value)}
                required
              />
              <button
                type="submit"
                className="task-chat-send-btn"
                disabled={commentSubmitting || !newCommentText.trim()}
                title="Send message"
              >
                {commentSubmitting ? <Loader className="spinner" size={15} /> : <Send size={15} />}
                <span>Send</span>
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
