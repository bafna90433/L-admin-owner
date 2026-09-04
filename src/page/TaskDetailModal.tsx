import React, { useState, useEffect } from 'react';
import { Loader, Send, Bell, X, User, Check, RotateCcw, AlertTriangle, CheckCheck, Clock3 } from 'lucide-react';
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
  const cleanDescription = (task.description || '').replace(/\[lang:(en|hi|ta)\]\s*/g, '').trim();

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal-window" onClick={e => e.stopPropagation()}>

        {/* =========================================================================
            TOP EXECUTIVE HERO & SPEC COMMAND BAR
           ========================================================================= */}
        <div style={{
          background: '#ffffff',
          borderBottom: '1px solid #eef2f6',
          padding: '14px 22px 14px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flexShrink: 0
        }}>
          {/* Row 1: Top Navigation & Utility Micro-Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            {/* Breadcrumb Path & Badges */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.72rem',
              color: '#64748b',
              flexWrap: 'wrap'
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.72rem',
                fontWeight: 750,
                color: '#1e293b',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '3px 9px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                👑 Managing Director
              </span>
              <span style={{ color: '#cbd5e1', fontWeight: 700 }}>/</span>
              <span style={{
                textTransform: 'capitalize',
                fontWeight: 650,
                color: '#475569',
                background: '#f1f5f9',
                padding: '3px 8px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                {task.taskType}
              </span>
              <span style={{ color: '#cbd5e1', fontWeight: 700 }}>/</span>
              <span style={{
                textTransform: 'capitalize',
                fontWeight: 650,
                color: '#475569',
                background: '#f1f5f9',
                padding: '3px 8px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                {task.frequency}
              </span>

              {/* Assigned Staff Chip */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.70rem',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.08)',
                color: '#4f46e5',
                border: '1px solid rgba(99, 102, 241, 0.18)',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                <User size={11} />
                <span>{task.assignedTo?.name || 'All Staff'}</span>
              </span>

              {/* Live Status Pill */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                background: isCompleted ? '#ecfdf5' : isAwaitingApproval ? '#f5f3ff' : '#fef2f2',
                color: isCompleted ? '#059669' : isAwaitingApproval ? '#6366f1' : '#dc2626',
                border: isCompleted ? '1px solid #a7f3d0' : isAwaitingApproval ? '1px solid #ddd6fe' : '1px solid #fecaca',
                boxShadow: isAwaitingApproval ? '0 1px 3px rgba(99, 102, 241, 0.1)' : 'none'
              }}>
                {!isCompleted && !isAwaitingApproval && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />}
                {isAwaitingApproval ? <><Clock3 size={12} /> Review Needed</> : task.status}
              </span>
            </div>

            {/* Top Right Utility Controls (Alarm & Close) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}>
              <button
                type="button"
                onClick={() => setShowReminderSettings(!showReminderSettings)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 11px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 650,
                  background: hasActiveReminder ? '#fffbeb' : showReminderSettings ? '#eef2ff' : '#f8fafc',
                  color: hasActiveReminder ? '#d97706' : showReminderSettings ? '#4f46e5' : '#475569',
                  border: hasActiveReminder ? '1px solid #fcd34d' : showReminderSettings ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
                title={hasActiveReminder ? `Alarm: ${formattedActiveReminder}` : 'Configure Reminder Alarm'}
              >
                <Bell size={12} />
                <span>{hasActiveReminder ? 'Alarm Active' : 'Set Alarm'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#64748b',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
                title="Close modal"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Row 2: Main Task Title & Primary Action Command Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            {/* Task Title */}
            <div style={{ flex: '1 1 280px' }}>
              <h1 style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                margin: 0,
                lineHeight: 1.35
              }}>
                {task.title}
              </h1>
            </div>

            {/* Primary Action Buttons */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
              flexWrap: 'nowrap'
            }}>
              {isAwaitingApproval && (
                <>
                  <button
                    type="button"
                    onClick={handleCompleteTask}
                    disabled={isCompleting}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 16px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      border: 'none',
                      cursor: isCompleting ? 'wait' : 'pointer',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.28)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                    title="Approve work and mark task completed"
                  >
                    {isCompleting ? <Loader className="spinner" size={13} /> : <Check size={14} strokeWidth={2.8} />}
                    <span>Approve & Complete</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(!showRejectInput)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #fecdd3',
                      background: showRejectInput ? '#f1f5f9' : '#fff1f2',
                      color: showRejectInput ? '#475569' : '#e11d48',
                      fontSize: '0.78rem',
                      fontWeight: 750,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                    title="Send work back for revision"
                  >
                    <RotateCcw size={13} />
                    <span>{showRejectInput ? 'Cancel' : 'Reject / Revise'}</span>
                  </button>
                </>
              )}

              {!isCompleted && !isAwaitingApproval && (
                <button
                  type="button"
                  onClick={handleCompleteTask}
                  disabled={isCompleting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 16px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: isCompleting ? 'wait' : 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.28)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                  title="Directly complete task"
                >
                  {isCompleting ? <Loader className="spinner" size={13} /> : <Check size={14} strokeWidth={3} />}
                  <span>Finish Work</span>
                </button>
              )}

              {isCompleted && (
                <button
                  type="button"
                  onClick={handleResetTask}
                  disabled={isCompleting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 750,
                    border: '1.5px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#475569',
                    cursor: isCompleting ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {isCompleting ? <Loader className="spinner" size={12} /> : '↺ Reopen Task'}
                </button>
              )}
            </div>
          </div>

          {/* Row 3: Status Notice if awaiting approval */}
          {isAwaitingApproval && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f5f3ff 0%, #fdf4ff 100%)',
              border: '1px solid #e0e7ff',
              borderLeft: '4px solid #6366f1',
              fontSize: '0.76rem',
              color: '#4338ca',
              boxShadow: '0 1px 3px rgba(99, 102, 241, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 650 }}>
                <Clock3 size={14} style={{ color: '#6366f1' }} />
                <span>Staff submitted work for completion review ({new Date(task.completionRequestedAt!).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })})</span>
              </div>
            </div>
          )}

          {/* BESPOKE SPEC TILES */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
            marginTop: '4px'
          }}>
            {/* Tile 1: Description */}
            <div style={{
              background: 'linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)',
              border: '1px solid #e9d5ff',
              borderLeft: '4px solid #9333ea',
              borderRadius: '10px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              boxShadow: '0 2px 6px rgba(147, 51, 234, 0.04)'
            }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#7e22ce', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>📋</span> Overview & Scope
              </div>
              <div style={{ fontSize: '0.80rem', color: '#3b0764', fontWeight: 550, lineHeight: 1.4 }}>
                {cleanDescription || <span style={{ color: '#a855f7', fontStyle: 'italic' }}>No overview provided</span>}
              </div>
            </div>

            {/* Tile 2: Remarks / Live Notes */}
            <div style={{
              background: 'linear-gradient(135deg, #fffdf5 0%, #fef3c7 100%)',
              border: '1px solid #fde68a',
              borderLeft: '4px solid #f59e0b',
              borderRadius: '10px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              boxShadow: '0 2px 6px rgba(245, 158, 11, 0.05)'
            }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>⚡</span> Staff Remarks
              </div>
              <div style={{ fontSize: '0.82rem', color: '#78350f', fontWeight: 700, lineHeight: 1.4 }}>
                {task.remarks || <span style={{ color: '#d97706', fontStyle: 'italic', fontWeight: 400 }}>No remarks yet</span>}
              </div>
            </div>

            {/* Tile 3: Follow-up & Reminder */}
            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '1px solid #bbf7d0',
              borderLeft: '4px solid #10b981',
              borderRadius: '10px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.05)'
            }}>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  📅 Follow-up Date
                </div>
                <div style={{ fontSize: '0.82rem', color: '#065f46', fontWeight: 800, marginTop: '2px' }}>
                  {task.nextFollowup ? task.nextFollowup : 'Not scheduled'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  ⏰ Alarm
                </div>
                <div style={{
                  fontSize: '0.74rem',
                  color: hasActiveReminder ? '#d97706' : '#64748b',
                  fontWeight: 750,
                  marginTop: '2px',
                  background: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: hasActiveReminder ? '1px solid #fcd34d' : '1px solid #e2e8f0',
                  display: 'inline-block'
                }}>
                  {hasActiveReminder ? '🔔 Active' : 'Off'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Slide-out Revision Note Box (Directly below header) */}
        {showRejectInput && (
          <div className="approval-revision-box animate-fade-in" style={{ marginBottom: '14px' }}>
            <div className="revision-box-header">
              <AlertTriangle size={13} style={{ color: '#e11d48' }} />
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
                {isRejecting ? <Loader className="spinner" size={12} /> : <Send size={12} />}
                <span>Send</span>
              </button>
            </div>
            <div className="revision-quick-tags">
              <span onClick={() => setRejectReason('Please recheck and verify all bill details.')}>⚡ Verify bill</span>
              <span onClick={() => setRejectReason('Pending confirmation from customer.')}>⚡ Customer pending</span>
              <span onClick={() => setRejectReason('Work is incomplete, please update remarks.')}>⚡ Incomplete work</span>
            </div>
          </div>
        )}

        {/* Slide-out Reminder Alarm Drawer (Directly below header) */}
        {showReminderSettings && (
          <div className="task-reminder-compact-card animate-fade-in" style={{ marginBottom: '14px' }}>
            <div className="compact-card-header">
              <div className="compact-requester-info">
                <div className={`compact-alarm-icon ${hasActiveReminder ? 'alarm-icon-active' : ''}`}>
                  <Bell size={15} />
                </div>
                <div>
                  <div className="compact-card-title">
                    <span>Reminder Alarm</span>
                    {hasActiveReminder && <span className="compact-alarm-tag">Active</span>}
                  </div>
                  <div className="compact-card-time">
                    {hasActiveReminder ? (
                      <span>⏰ Scheduled: {formattedActiveReminder}</span>
                    ) : (
                      <span>Schedule alarm for MD & Staff</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="compact-reminder-settings">
              {/* Quick Presets */}
              <div className="compact-presets-row">
                <button type="button" onClick={() => applyPreset(15)} className="task-preset-btn">+15m</button>
                <button type="button" onClick={() => applyPreset(30)} className="task-preset-btn">+30m</button>
                <button type="button" onClick={() => applyPreset(60)} className="task-preset-btn">+1h</button>
                <button type="button" onClick={applyTodayEvening} className="task-preset-btn">5 PM</button>
                <button type="button" onClick={applyTomorrowMorning} className="task-preset-btn">10 AM</button>
              </div>

              {/* Date & Time Pickers */}
              <div className="compact-time-grid">
                <div>
                  <label>Date</label>
                  <input
                    type="date"
                    className="task-form-input compact-form-input"
                    value={remDate}
                    onChange={e => setRemDate(e.target.value)}
                    min={formatDateToYMD(new Date())}
                  />
                </div>
                <div>
                  <label>Hour</label>
                  <select
                    className="task-form-input compact-form-input"
                    value={remHour}
                    onChange={e => setRemHour(e.target.value)}
                  >
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Min</label>
                  <select
                    className="task-form-input compact-form-input"
                    value={remMinute}
                    onChange={e => setRemMinute(e.target.value)}
                  >
                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>AM/PM</label>
                  <div className="compact-period-toggle">
                    <button
                      type="button"
                      onClick={() => setRemPeriod('AM')}
                      className={remPeriod === 'AM' ? 'active' : ''}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemPeriod('PM')}
                      className={remPeriod === 'PM' ? 'active' : ''}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="compact-alarm-actions">
                <button
                  type="button"
                  onClick={handleSaveReminder}
                  disabled={isSavingReminder}
                  className="btn-save-alarm-compact"
                >
                  {isSavingReminder ? <Loader className="spinner" size={13} /> : <Bell size={13} />}
                  <span>{hasActiveReminder ? 'Update Alarm' : 'Set Alarm'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowReminderSettings(false)}
                  className="btn-close-alarm-compact"
                >
                  Close
                </button>
                {hasActiveReminder && (
                  <button
                    type="button"
                    onClick={handleClearReminder}
                    disabled={isSavingReminder}
                    className="btn-remove-alarm-compact"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

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
              <span>Discussion History</span>
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

                if (isRevisionNotice) {
                  return (
                    <div key={index} className="task-chat-system-notice animate-fade-in">
                      <div className="system-notice-card">
                        <AlertTriangle size={15} className="notice-icon" />
                        <div className="notice-content">
                          <span className="notice-title">Revision Feedback (Sent to Staff)</span>
                          <span className="notice-body">{c.text}</span>
                        </div>
                        <span className="notice-time">
                          {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  );
                }

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
                      {/* Author label only on staff side */}
                      {!isMD && (
                        <div className="bubble-meta-header">
                          <span className="bubble-author-name">
                            {c.authorName || task.assignedTo?.name || 'Staff'}
                          </span>
                        </div>
                      )}

                      <p className="bubble-text">
                        {c.text}
                      </p>

                      {/* Bubble Time & Status */}
                      <div className="bubble-meta-footer">
                        <span className="bubble-timestamp">
                          {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                        </span>
                        {isMD && (
                          <span className="bubble-ticks" title="Sent & Delivered">
                            <CheckCheck size={14} />
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

          {/* Comment Input Dock */}
          <form onSubmit={handlePostComment} className="task-chat-dock">
            <div className="chat-input-wrapper">
              <input
                type="text"
                className="task-chat-input"
                placeholder={`Type a message to ${task.assignedTo?.name || 'staff'}... (Press Enter to send)`}
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
