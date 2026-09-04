import React, { useState, useEffect } from 'react';
import { Loader, Send, Lock, Bell, BellOff, CheckCircle2, Zap, X, Layers, User, MessageSquare, Check, ShieldCheck } from 'lucide-react';
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
        
        {/* Top Executive Header Bar: Status, MD Authority, Finish Work Button & Close Button */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '16px',
          marginBottom: '16px',
          borderBottom: '1.5px solid #f1f5f9',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Left: Status & MD Authority info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {isCompleted ? (
              <span className="badge badge-status-completed" style={{ textTransform: 'uppercase', padding: '6px 12px', fontSize: '0.76rem' }}>
                <CheckCircle2 size={13} style={{ marginRight: 3 }} />
                COMPLETED
              </span>
            ) : isAwaitingApproval ? (
              <span className="task-approval-status-pill" style={{ padding: '6px 14px', fontSize: '0.76rem' }}>
                <ShieldCheck size={14} /> MD APPROVAL PENDING
              </span>
            ) : (
              <span className="badge badge-status-pending" style={{ textTransform: 'uppercase', padding: '6px 12px', fontSize: '0.76rem' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffffff', display: 'inline-block', marginRight: 4 }} />
                IN-PROGRESS / PENDING
              </span>
            )}

            {task.taskType === 'reminder-sir' && (
              <span className="task-tag-chip" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b', fontWeight: 800 }}>
                <Lock size={12} /> MD Directive
              </span>
            )}

            {hasActiveReminder && (
              <span className="task-tag-chip task-tag-reminder" style={{ fontWeight: 800 }}>
                <Bell size={12} /> Alarm Armed
              </span>
            )}

            <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 550, marginLeft: '4px' }}>
              {isCompleted ? '• Verified by MD' : isAwaitingApproval ? '• Staff has requested finish approval' : '• Only MD has authority to approve & finish'}
            </span>
          </div>

          {/* Right: Finish Work Action & Close Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isCompleted ? (
              <button
                type="button"
                onClick={handleResetTask}
                disabled={isCompleting}
                style={{
                  padding: '7px 16px',
                  fontWeight: 750,
                  fontSize: '0.8rem',
                  color: '#d97706',
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease'
                }}
              >
                {isCompleting ? <Loader className="spinner" size={14} /> : '↺ Reopen Task'}
              </button>
            ) : isAwaitingApproval ? (
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
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  borderRadius: '12px',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
                title="Approve staff finish request and mark task completed"
              >
                {isCompleting ? <Loader className="spinner" size={14} /> : <ShieldCheck size={16} strokeWidth={2.5} />}
                <span>Approve Finish</span>
              </button>
            ) : (
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
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  borderRadius: '12px',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title="Mark this task as finished"
              >
                {isCompleting ? <Loader className="spinner" size={14} /> : <Check size={16} strokeWidth={3} />}
                <span>Finish Work</span>
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

        {/* Task Title */}
        <h2 className="task-modal-title" style={{ marginTop: 0 }}>
          {task.title}
        </h2>

        {/* Metadata Strip */}
        <div className="task-modal-meta-bar" style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Category:</span>
            <span className="task-tag-chip task-tag-category" style={{ textTransform: 'capitalize' }}>
              <Layers size={11} />
              {task.taskType === 'regular' ? 'Regular Work' : 'Custom Task'} ({task.frequency})
            </span>
          </div>

          <span style={{ color: '#cbd5e1' }}>•</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Assigned to:</span>
            <span style={{
              background: 'rgba(99, 102, 241, 0.08)',
              color: '#4f46e5',
              padding: '3px 10px 3px 8px',
              borderRadius: '12px',
              fontWeight: 750,
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <User size={12} />
              {task.assignedTo?.name || '👥 All Staff'}
            </span>
          </div>

          {isCompleted && task.completedBy && (
            <>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Completed by:</span>
                <span style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#059669',
                  padding: '3px 10px 3px 8px',
                  borderRadius: '12px',
                  fontWeight: 750,
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <CheckCircle2 size={12} />
                  {task.completedBy.name} {task.completedAt ? `on ${new Date(task.completedAt).toLocaleDateString('en-GB')}` : ''}
                </span>
              </div>
            </>
          )}
        </div>

        {/* MD APPROVAL REQUEST CALLOUT BANNER */}
        {isAwaitingApproval && (
          <div style={{
            padding: '16px 20px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #eef2ff 0%, #ecfeff 100%)',
            border: '1.5px solid rgba(99, 102, 241, 0.35)',
            boxShadow: '0 4px 16px rgba(79, 70, 229, 0.12)',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 850, fontSize: '0.95rem', color: '#1e1b4b' }}>
                    🛡️ Finish Approval Requested by {task.completionRequestedBy?.name || task.assignedTo?.name || 'Staff'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#4338ca' }}>
                    Requested on {new Date(task.completionRequestedAt || '').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} • Review work and approve to mark completed.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    borderRadius: '12px',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  {isCompleting ? <Loader className="spinner" size={14} /> : <Check size={16} strokeWidth={3} />}
                  <span>Approve & Complete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectInput(!showRejectInput)}
                  style={{
                    padding: '8px 14px',
                    fontWeight: 750,
                    fontSize: '0.82rem',
                    color: '#dc2626',
                    background: '#fef2f2',
                    border: '1.5px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {showRejectInput ? 'Cancel' : 'Reject / Revise'}
                </button>
              </div>
            </div>
            {showRejectInput && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', paddingTop: '10px', borderTop: '1px solid rgba(99, 102, 241, 0.15)' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Explain what needs revision or correction (optional)..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  style={{ flexGrow: 1, fontSize: '0.85rem' }}
                />
                <button
                  type="button"
                  onClick={handleRejectCompletion}
                  disabled={isRejecting}
                  className="btn btn-danger"
                  style={{ padding: '8px 16px', fontSize: '0.82rem', fontWeight: 800, whiteSpace: 'nowrap' }}
                >
                  {isRejecting ? <Loader className="spinner" size={14} /> : 'Send Back'}
                </button>
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

        {/* Discussion / Follow-up Notes Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MessageSquare size={15} style={{ color: '#4f46e5' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Follow-Up Discussion Notes
            </span>
          </div>
          <span style={{
            background: 'rgba(99, 102, 241, 0.1)',
            color: '#4f46e5',
            fontSize: '0.72rem',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            {task.comments?.length || 0} {task.comments?.length === 1 ? 'message' : 'messages'}
          </span>
        </div>

        {/* Discussion Feed */}
        <div className="task-modal-chat-feed">
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
                  className={isMD ? 'task-bubble-md' : 'task-bubble-staff'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
                    <span style={{
                      fontWeight: 850,
                      fontSize: '0.74rem',
                      color: isMD ? '#e0e7ff' : '#4f46e5',
                      letterSpacing: '0.02em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {isMD ? '👑 You (MD / Owner)' : `👤 ${c.authorName || 'Staff'} (Staff)`}
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      color: isMD ? 'rgba(255, 255, 255, 0.75)' : '#94a3b8'
                    }}>
                      {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '0.9rem',
                    color: isMD ? '#ffffff' : '#1e293b',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.45
                  }}>
                    {c.text}
                  </p>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '28px 16px', fontSize: '0.86rem' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>💬</div>
              <div style={{ fontWeight: 650, color: '#64748b' }}>No discussion notes yet.</div>
              <div style={{ fontSize: '0.78rem', marginTop: '2px' }}>Write a message below to give instructions or ask staff for an update.</div>
            </div>
          )}
        </div>

        {/* Comment Input Form */}
        <form onSubmit={handlePostComment} className="task-modal-input-bar">
          <input
            type="text"
            className="task-modal-input"
            placeholder="Ask for update, give instructions or reply..."
            value={newCommentText}
            onChange={e => setNewCommentText(e.target.value)}
            required
          />
          <button
            type="submit"
            className="task-modal-send-btn"
            disabled={commentSubmitting}
            title="Send note"
          >
            {commentSubmitting ? <Loader className="spinner" size={16} /> : <Send size={16} />}
          </button>
        </form>

      </div>
    </div>
  );
}
