import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Loader, Edit3, Trash2, X, Sparkles, Volume2, FileSpreadsheet, Bell, ChevronDown, Users, Check, CheckCircle2, MessageSquare, PlusCircle, Layers, Clock, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import '../styles/Tasks.css';

interface User {
  id: string;
  _id?: string;
  username: string;
  name: string;
  role: string;
  imageUrl?: string;
}

interface Task {
  _id: string;
  title: string;
  taskType: 'regular' | 'reminder-sir' | 'custom';
  frequency: 'daily' | 'weekly' | 'monthly' | 'one-time';
  status: 'pending' | 'completed';
  assignedTo?: {
    _id: string;
    name: string;
    username: string;
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
  comments?: any[];
  createdAt: string;
  seenByOwner?: boolean;
  seenAt?: string;
  reminderDateTime?: string | null;
  reminderAlarmArmed?: boolean;
  reminderNote?: string;
}

interface TasksProps {
  token: string | null;
  apiBase: string;
  tasks: Task[];
  allStaff: User[];
  fetchTasks: () => void;
  setSelectedTaskForComments: (task: Task) => void;
  setConfirmModal: (modal: { title: string; message: string; onConfirm: () => void } | null) => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
  onTaskCreatedLocally?: (taskId: string) => void;
  targetTaskId?: string | null;
  onClearTargetTaskId?: () => void;
}

export default function Tasks({
  token,
  apiBase,
  tasks,
  allStaff,
  fetchTasks,
  setSelectedTaskForComments,
  setConfirmModal,
  showToast,
  onTaskCreatedLocally,
  targetTaskId,
  onClearTargetTaskId
}: TasksProps) {
  // New task form fields
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<'regular' | 'reminder-sir' | 'custom'>('custom');
  const [newTaskFreq, setNewTaskFreq] = useState<'daily' | 'weekly' | 'monthly' | 'one-time'>('one-time');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const staffDropdownRef = useRef<HTMLDivElement>(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  // Form Voice Language State (Default English)
  const [taskVoiceLang, setTaskVoiceLang] = useState<'en' | 'hi' | 'ta'>('en');

  // Form Reminder State
  const [hasTaskReminder, setHasTaskReminder] = useState(false);
  const [taskRemDate, setTaskRemDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [taskRemHour, setTaskRemHour] = useState('10');
  const [taskRemMinute, setTaskRemMinute] = useState('00');
  const [taskRemPeriod, setTaskRemPeriod] = useState<'AM' | 'PM'>('AM');

  const buildIsoFromParts = (dateStr: string, hourStr: string, minStr: string, period: 'AM' | 'PM') => {
    let h = parseInt(hourStr, 10) || 12;
    const m = parseInt(minStr, 10) || 0;
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    const [year, month, day] = dateStr.split('-').map(Number);
    const target = new Date(year, month - 1, day, h, m, 0, 0);
    return target.toISOString();
  };

  const applyFormPreset = (minutesFromNow: number) => {
    const target = new Date(Date.now() + minutesFromNow * 60 * 1000);
    let hours = target.getHours();
    const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const mins = target.getMinutes();
    const ymd = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
    setTaskRemDate(ymd);
    setTaskRemHour(String(hours).padStart(2, '0'));
    setTaskRemMinute(String(mins).padStart(2, '0'));
    setTaskRemPeriod(period);
    setHasTaskReminder(true);
  };

  // Edit task state
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // List filters
  const [taskFilterStatus, setTaskFilterStatus] = useState<'all' | 'pending' | 'discussion' | 'approval' | 'completed'>('all');
  const [taskFilterType, setTaskFilterType] = useState<'all' | 'regular' | 'reminder-sir' | 'custom'>('all');

  // Tab state for staff filtering
  const [selectedStaffId, setSelectedStaffId] = useState<string | 'all' | 'unassigned'>('all');
  const [previewPhoto, setPreviewPhoto] = useState<{ name: string; url: string } | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

  // Global realtime metric stats
  const stats = useMemo(() => {
    let pending = 0;
    let discussion = 0;
    let approval = 0;
    let completed = 0;
    tasks.forEach(t => {
      if (t.status === 'completed') {
        completed++;
      } else if (t.completionRequestedAt) {
        approval++;
      } else if (t.comments && t.comments.length > 0) {
        discussion++;
      } else {
        pending++;
      }
    });
    return { total: tasks.length, pending, discussion, approval, completed };
  }, [tasks]);

  // Pending count per staff for avatar badges
  const staffPendingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(t => {
      if (t.status !== 'completed' && t.assignedTo) {
        const sId = t.assignedTo._id || (t.assignedTo as any).id;
        if (sId) {
          counts[sId] = (counts[sId] || 0) + 1;
        }
      }
    });
    return counts;
  }, [tasks]);

  // Auto-scroll and highlight target task if navigated from Notifications
  React.useEffect(() => {
    if (targetTaskId) {
      setHighlightedTaskId(targetTaskId);
      setSelectedStaffId('all');
      setTaskFilterStatus('all');
      setTaskFilterType('all');

      const timer = setTimeout(() => {
        const el = document.getElementById(`task-item-${targetTaskId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);

      const clearTimer = setTimeout(() => {
        setHighlightedTaskId(null);
        if (onClearTargetTaskId) onClearTargetTaskId();
      }, 5000);

      return () => {
        clearTimeout(timer);
        clearTimeout(clearTimer);
      };
    }
  }, [targetTaskId, onClearTargetTaskId]);

  // Outside click listener for multi-select staff dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(event.target as Node)) {
        setIsStaffDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const sanitizeTitle = (text: string) => {
    return text.split('•')[0].split('\n')[0].replace(/^📌\s*Task:\s*/i, '').trim();
  };

  const refineTitleWithAi = async (rawTitle: string): Promise<string> => {
    const cleanRaw = rawTitle.trim();
    if (!cleanRaw) return cleanRaw;
    try {
      const res = await fetch(`${apiBase}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: `Refine and improve this task description into a clear, professional corporate work assignment title: "${cleanRaw}"`,
          systemInstruction: `You are an AI assistant for executive task management. Output only the refined clean task title text without quotes or intro text.`
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          return sanitizeTitle(data.reply);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return cleanRaw;
  };

  const handleGenerateWithGemini = async () => {
    if (!newTaskTitle.trim()) {
      showToast('Please type a draft task title or duty first', 'warning');
      return;
    }
    setIsAiGenerating(true);
    try {
      const refined = await refineTitleWithAi(newTaskTitle);
      setNewTaskTitle(refined);
      showToast('✨ Task refined with Gemini AI!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to refine title', 'danger');
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Calculate days elapsed since task creation
  const getDaysElapsed = (createdAt: string) => {
    if (!createdAt) return 0;
    const createdDate = new Date(createdAt);
    const today = new Date();
    const createdZero = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffTime = todayZero.getTime() - createdZero.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays < 0 ? 0 : diffDays;
  };

  const handleStartEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskType(task.taskType);
    setNewTaskFreq(task.frequency);
    const assignedId = task.assignedTo?._id || (task.assignedTo as any)?.id || '';
    setSelectedStaffIds(assignedId ? [assignedId] : []);
    setIsStaffDropdownOpen(false);
    const langMatch = (task as any).description?.match(/\[lang:(en|hi|ta)\]/);
    setTaskVoiceLang((task as any).language || (langMatch ? langMatch[1] : 'en'));

    if (task.reminderDateTime) {
      setHasTaskReminder(true);
      const d = new Date(task.reminderDateTime);
      let hours = d.getHours();
      const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      setTaskRemDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      setTaskRemHour(String(hours).padStart(2, '0'));
      setTaskRemMinute(String(d.getMinutes()).padStart(2, '0'));
      setTaskRemPeriod(period);
    } else {
      setHasTaskReminder(false);
    }
  };

  const handleCancelEditTask = () => {
    setEditingTask(null);
    setNewTaskTitle('');
    setNewTaskType('custom');
    setNewTaskFreq('one-time');
    setSelectedStaffIds([]);
    setIsStaffDropdownOpen(false);
    setTaskVoiceLang('en');
    setHasTaskReminder(false);
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setTaskSubmitting(true);
    try {
      // 100% Automatic Gemini AI Background Refinement before assigning!
      const finalTitle = await refineTitleWithAi(newTaskTitle);

      let finalReminderDateTime: string | null = null;
      if (hasTaskReminder && taskRemDate) {
        finalReminderDateTime = buildIsoFromParts(taskRemDate, taskRemHour, taskRemMinute, taskRemPeriod);
      }

      const url = editingTask
        ? `${apiBase}/tasks/${editingTask._id}`
        : `${apiBase}/tasks`;
      const method = editingTask ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: finalTitle,
          taskType: newTaskType,
          frequency: newTaskFreq,
          assignedTo: selectedStaffIds.length === 1 ? selectedStaffIds[0] : (selectedStaffIds.length === 0 ? null : selectedStaffIds[0]),
          assignedToStaffIds: selectedStaffIds.length > 1 ? selectedStaffIds : (selectedStaffIds.length === 1 ? [selectedStaffIds[0]] : []),
          createdByRole: 'owner',
          language: taskVoiceLang,
          description: `[lang:${taskVoiceLang}]`,
          reminderDateTime: finalReminderDateTime,
          reminderAlarmArmed: Boolean(finalReminderDateTime)
        })
      });
      if (res.ok) {
        const savedData = await res.json();
        if (savedData && savedData._id && onTaskCreatedLocally) {
          onTaskCreatedLocally(savedData._id);
        }
        setNewTaskTitle('');
        setNewTaskType('custom');
        setNewTaskFreq('one-time');
        setSelectedStaffIds([]);
        setIsStaffDropdownOpen(false);
        setTaskVoiceLang('en');
        setHasTaskReminder(false);
        setEditingTask(null);
        fetchTasks();
        showToast(editingTask ? 'Task updated successfully!' : '✨ Task assigned successfully with Reminder Alarm!', 'success');
      } else {
        showToast(editingTask ? 'Failed to update task' : 'Failed to create task', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setTaskSubmitting(false);
    }
  };


  const handleDeleteTask = (id: string) => {
    setConfirmModal({
      title: 'Delete Task',
      message: 'Are you sure you want to delete this task?',
      onConfirm: async () => {
        try {
          const res = await fetch(`${apiBase}/tasks/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            if (editingTask && editingTask._id === id) {
              handleCancelEditTask();
            }
            fetchTasks();
            showToast('Task deleted successfully!', 'success');
          } else {
            showToast('Failed to delete task', 'danger');
          }
        } catch (err) {
          console.error(err);
          showToast('Error connecting to server', 'danger');
        }
      }
    });
  };

  const handleApproveCompletion = (task: Task) => {
    const requesterName = task.completionRequestedBy?.name || task.assignedTo?.name || 'Staff';
    setConfirmModal({
      title: 'Approve Finished Work',
      message: `${requesterName} ne "${task.title}" ko finish mark kiya hai. Approve karne ke baad task completed ho jayega.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`${apiBase}/tasks/${task._id}/complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            showToast(data.message || 'Could not approve finished work', 'danger');
            return;
          }
          fetchTasks();
          showToast(`Approved — ${requesterName}'s work is completed!`, 'success');
        } catch (err) {
          console.error(err);
          showToast('Error connecting to server', 'danger');
        }
      }
    });
  };

  const handleRejectCompletion = (task: Task) => {
    const requesterName = task.completionRequestedBy?.name || task.assignedTo?.name || 'Staff';
    setConfirmModal({
      title: 'Send Back for Revision',
      message: `Kya aap ${requesterName} ki "${task.title}" finish request ko reject karke wapas pending karna chahte hain?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`${apiBase}/tasks/${task._id}/reject-completion`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reason: 'Work reviewed by MD - needs revision.' })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            showToast(data.message || 'Could not reject request', 'danger');
            return;
          }
          fetchTasks();
          showToast(`Request rejected — "${task.title}" sent back to pending`, 'info');
        } catch (err) {
          console.error(err);
          showToast('Error connecting to server', 'danger');
        }
      }
    });
  };

  const handleMarkAsSeen = async (id: string, showNotification = true) => {
    try {
      const res = await fetch(`${apiBase}/tasks/${id}/seen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchTasks();
        if (showNotification) {
          showToast('Task marked as seen', 'success');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTasks = tasks
    .filter(t => {
      if (taskFilterStatus === 'all') return true;
      if (taskFilterStatus === 'completed') return t.status === 'completed';
      if (taskFilterStatus === 'approval') {
        return t.status !== 'completed' && Boolean(t.completionRequestedAt);
      }
      if (taskFilterStatus === 'discussion') {
        return t.status !== 'completed' && !t.completionRequestedAt && (t.comments?.length || 0) > 0;
      }
      if (taskFilterStatus === 'pending') {
        return t.status !== 'completed' && !t.completionRequestedAt && (!t.comments || t.comments.length === 0);
      }
      return true;
    })
    .filter(t => taskFilterType === 'all' || t.taskType === taskFilterType);

  const handleExportExcel = () => {
    let exportList = filteredTasks;
    if (selectedStaffId && selectedStaffId !== 'all') {
      exportList = filteredTasks.filter(t => t.assignedTo && (t.assignedTo._id === selectedStaffId || (t.assignedTo as any).id === selectedStaffId));
    }

    if (exportList.length === 0) {
      showToast('No tasks available to export with current filters', 'warning');
      return;
    }

    const selectedStaffName = selectedStaffId !== 'all'
      ? allStaff.find(s => (s.id || s._id) === selectedStaffId)?.name || 'Staff'
      : 'All Staff';

    const sheetData: any[][] = [];

    // Title and Meta header rows
    sheetData.push(['OFFICE PRO - ACTIVE TASKS & DUTIES REPORT']);
    sheetData.push([`Generated On: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`, '', `Staff Filter: ${selectedStaffName}`, '', `Status Filter: ${taskFilterStatus.toUpperCase()}`, '', `Category Filter: ${taskFilterType.toUpperCase()}`]);
    sheetData.push([]); // blank row

    // Table Headers
    sheetData.push([
      'S.No',
      'Task Title / Duty',
      'Assigned To',
      'Category',
      'Frequency',
      'Status',
      'Assigned Date',
      'Completed Date',
      'Completed By',
      'Owner Seen',
      'Feedback / Notes Count',
      'Latest Comment / Note'
    ]);

    // Data Rows
    exportList.forEach((t, idx) => {
      const createdDateStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB') + ' ' + new Date(t.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';
      const completedDateStr = t.completedAt ? new Date(t.completedAt).toLocaleDateString('en-GB') + ' ' + new Date(t.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';

      const categoryLabel = t.taskType === 'regular' ? 'Regular Work' : t.taskType === 'reminder-sir' ? 'Sir Reminder' : 'Custom Duty';
      const freqLabel = t.frequency === 'daily' ? 'Daily' : t.frequency === 'weekly' ? 'Weekly' : t.frequency === 'monthly' ? 'Monthly' : 'One-Time';
      const statusLabel = t.status === 'completed' ? 'COMPLETED' : 'PENDING';
      const assignedStaff = t.assignedTo?.name || 'All Staff';
      const completedStaff = t.completedBy?.name || (t.status === 'completed' ? 'Staff' : '--');
      const seenLabel = t.seenByOwner ? 'Seen' : 'Unseen / New';
      const commentCount = t.comments?.length || 0;

      let latestComment = '--';
      if (t.comments && t.comments.length > 0) {
        const last = t.comments[t.comments.length - 1];
        latestComment = `${last.author?.name || 'Staff'}: ${last.text || ''}`;
      }

      sheetData.push([
        idx + 1,
        t.title,
        assignedStaff,
        categoryLabel,
        freqLabel,
        statusLabel,
        createdDateStr,
        completedDateStr,
        completedStaff,
        seenLabel,
        commentCount,
        latestComment
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 6 },   // S.No
      { wch: 48 },  // Task Title
      { wch: 18 },  // Assigned To
      { wch: 16 },  // Category
      { wch: 12 },  // Frequency
      { wch: 14 },  // Status
      { wch: 22 },  // Assigned Date
      { wch: 22 },  // Completed Date
      { wch: 18 },  // Completed By
      { wch: 14 },  // Owner Seen
      { wch: 14 },  // Comments Count
      { wch: 42 }   // Latest Comment
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');

    const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const safeStaffName = selectedStaffName.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(workbook, `Active_Tasks_${safeStaffName}_${dateStr}.xlsx`);
    showToast('📥 Tasks Excel exported & downloaded successfully!', 'success');
  };

  return (
    <div className="tasks-page-container">
      {/* Top Hero Stats Banner */}
      <div className="tasks-hero-banner">
        <div className="tasks-hero-title-group">
          <h1>
            <span className="gradient-text">Task Management</span> & Follow-ups
          </h1>
          <p>Assign duties to staff, monitor real-time checklists, and track discussion feedback.</p>
        </div>

        <div className="tasks-hero-stats">
          <div className="tasks-stat-chip stat-total" title="Total active tasks">
            <Layers size={14} />
            <span>{stats.total} Total Tasks</span>
          </div>
          <div className="tasks-stat-chip stat-pending" title="Pending tasks">
            <Clock size={14} />
            <span>{stats.pending} Pending</span>
          </div>
          {stats.approval > 0 && (
            <div className="tasks-stat-chip stat-approval" title="Finish requests waiting for MD approval">
              <ShieldCheck size={14} />
              <span>{stats.approval} Approval</span>
            </div>
          )}
          {stats.discussion > 0 && (
            <div className="tasks-stat-chip stat-discussion" title="Tasks with discussion">
              <MessageSquare size={14} />
              <span>{stats.discussion} Discussion</span>
            </div>
          )}
          <div className="tasks-stat-chip stat-completed" title="Completed tasks">
            <CheckCircle2 size={14} />
            <span>{stats.completed} Done</span>
          </div>
        </div>
      </div>

      <div className="tasks-grid">

        {/* Form to Assign Work */}
        <div className="glass-panel tasks-create-panel" style={{ height: 'fit-content' }}>
          <h3 className="tasks-panel-title">
            <div className="tasks-panel-title-icon">
              {editingTask ? <Edit3 size={18} /> : <PlusCircle size={18} />}
            </div>
            <span>{editingTask ? 'Edit Task Details' : 'Assign New Task'}</span>
          </h3>
          <form onSubmit={handleTaskSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                <label className="task-form-label" style={{ margin: 0 }}>TASK DESCRIPTION / TITLE</label>
                <button
                  type="button"
                  onClick={handleGenerateWithGemini}
                  disabled={isAiGenerating}
                  className="btn-ai-refine"
                  title="Click to refine task description using Gemini AI"
                >
                  {isAiGenerating ? <Loader className="spinner" size={12} /> : <Sparkles size={12} />}
                  <span>Auto-Refine with Gemini AI</span>
                </button>
              </div>
              <textarea
                className="task-form-input"
                placeholder="e.g. Check boys room EB bill receipt, check stickers inventory"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onBlur={async () => {
                  if (newTaskTitle.trim() && !isAiGenerating) {
                    const refined = await refineTitleWithAi(newTaskTitle);
                    setNewTaskTitle(refined);
                  }
                }}
                style={{ minHeight: '82px', resize: 'vertical', lineHeight: 1.5 }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="task-form-label">
                  <Layers size={13} style={{ color: '#6366f1' }} />
                  Task Category
                </label>
                <select
                  className="task-form-input"
                  value={newTaskType}
                  onChange={e => setNewTaskType(e.target.value as any)}
                  required
                >
                  <option value="custom">Custom Task</option>
                  <option value="regular">Regular Work</option>
                </select>
              </div>

              <div className="form-group">
                <label className="task-form-label">
                  <Clock size={13} style={{ color: '#6366f1' }} />
                  Frequency
                </label>
                <select
                  className="task-form-input"
                  value={newTaskFreq}
                  onChange={e => setNewTaskFreq(e.target.value as any)}
                  required
                >
                  <option value="one-time">One-Time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" ref={staffDropdownRef} style={{ position: 'relative' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Users size={14} style={{ color: '#4f46e5' }} />
                    Assign To Staff Member(s)
                  </span>
                  {selectedStaffIds.length > 0 && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#4f46e5' }}>
                      {selectedStaffIds.length} Selected
                    </span>
                  )}
                </label>

                {/* Trigger Box */}
                <div
                  onClick={() => setIsStaffDropdownOpen(!isStaffDropdownOpen)}
                  className="form-input"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: '#ffffff',
                    border: isStaffDropdownOpen ? '1.5px solid #4f46e5' : '1.5px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    boxShadow: isStaffDropdownOpen ? '0 0 0 3.5px rgba(79, 70, 229, 0.15)' : 'none',
                    transition: 'all 0.18s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: selectedStaffIds.length === 0 ? '#475569' : '#0f172a',
                      fontWeight: selectedStaffIds.length > 0 ? 700 : 550,
                      fontSize: '0.88rem'
                    }}>
                      {(() => {
                        if (selectedStaffIds.length === 0) return '👥 All Office Staff';
                        if (selectedStaffIds.length === 1) {
                          const found = allStaff.find(s => (s.id || s._id) === selectedStaffIds[0]);
                          return found ? found.name : '1 Staff Member';
                        }
                        if (selectedStaffIds.length === allStaff.length) {
                          return 'All Office Staff (All Selected)';
                        }
                        const names = selectedStaffIds
                          .map(id => allStaff.find(s => (s.id || s._id) === id)?.name)
                          .filter(Boolean);
                        return names.join(', ');
                      })()}
                    </span>

                    {selectedStaffIds.length > 1 && (
                      <span style={{
                        background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                        color: '#ffffff',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '12px',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)'
                      }}>
                        +{selectedStaffIds.length} Staff
                      </span>
                    )}
                  </div>

                  <ChevronDown
                    size={16}
                    style={{
                      color: isStaffDropdownOpen ? '#4f46e5' : '#64748b',
                      transform: isStaffDropdownOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0
                    }}
                  />
                </div>

                {/* Dropdown Menu Panel */}
                {isStaffDropdownOpen && (
                  <div className="task-staff-dropdown-menu">
                    {/* Header with Quick Actions */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569' }}>
                        Select Assignees
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const allIds = allStaff.map(s => (s.id || s._id || '') as string).filter(Boolean);
                            setSelectedStaffIds(allIds);
                          }}
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 750,
                            color: '#4f46e5',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px 4px'
                          }}
                        >
                          Select All
                        </button>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedStaffIds([])}
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 750,
                            color: '#dc2626',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px 4px'
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    {/* All Office Staff Option Row */}
                    <div style={{ padding: '6px 8px 4px 8px' }}>
                      <div
                        onClick={() => setSelectedStaffIds([])}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '8px 10px',
                          borderRadius: '10px',
                          background: selectedStaffIds.length === 0 ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                          border: selectedStaffIds.length === 0 ? '1px solid rgba(79, 70, 229, 0.25)' : '1px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Custom Modern Checkbox */}
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '5px',
                          border: selectedStaffIds.length === 0 ? '1.5px solid #4f46e5' : '1.5px solid #94a3b8',
                          background: selectedStaffIds.length === 0 ? '#4f46e5' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s ease'
                        }}>
                          {selectedStaffIds.length === 0 && <Check size={12} color="#ffffff" strokeWidth={3} />}
                        </div>

                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                          boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
                          flexShrink: 0
                        }}>
                          👥
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.86rem', fontWeight: selectedStaffIds.length === 0 ? 800 : 600, color: selectedStaffIds.length === 0 ? '#4f46e5' : '#1e293b' }}>
                            All Office Staff
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            Duty will be visible to everyone
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 8px' }} />

                    {/* Staff List */}
                    <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '0 8px 6px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {allStaff.map(s => {
                        const sId = (s.id || s._id || '') as string;
                        if (!sId) return null;
                        const isChecked = selectedStaffIds.includes(sId);
                        const sAvatar = s.imageUrl ? (s.imageUrl.startsWith('http') ? s.imageUrl : `${apiBase}${s.imageUrl}`) : null;

                        return (
                          <div
                            key={sId}
                            onClick={() => {
                              if (isChecked) {
                                const next = selectedStaffIds.filter(id => id !== sId);
                                setSelectedStaffIds(next);
                              } else {
                                setSelectedStaffIds([...selectedStaffIds, sId]);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '7px 10px',
                              borderRadius: '10px',
                              background: isChecked ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                              border: isChecked ? '1px solid rgba(79, 70, 229, 0.22)' : '1px solid transparent',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {/* Custom Modern Checkbox */}
                            <div style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '5px',
                              border: isChecked ? '1.5px solid #4f46e5' : '1.5px solid #94a3b8',
                              background: isChecked ? '#4f46e5' : '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'all 0.15s ease'
                            }}>
                              {isChecked && <Check size={12} color="#ffffff" strokeWidth={3} />}
                            </div>

                            {sAvatar ? (
                              <img
                                src={sAvatar}
                                alt={s.name}
                                style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 5px rgba(0,0,0,0.08)', flexShrink: 0 }}
                              />
                            ) : (
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                color: '#ffffff',
                                fontSize: '0.78rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                flexShrink: 0
                              }}>
                                {s.name.charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.86rem', fontWeight: isChecked ? 750 : 600, color: isChecked ? '#4f46e5' : '#1e293b' }}>
                                {s.name}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                {s.role === 'staff' ? 'Office Staff' : s.role}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Action Footer */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderTop: '1px solid #e2e8f0'
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 650, color: '#64748b' }}>
                        {selectedStaffIds.length === 0 ? '👥 All staff will receive' : `✓ ${selectedStaffIds.length} staff selected`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsStaffDropdownOpen(false)}
                        style={{
                          padding: '5px 14px',
                          borderRadius: '8px',
                          background: '#4f46e5',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)'
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Volume2 size={14} style={{ color: '#4f46e5' }} />
                  Voice Alert Language
                </label>
                <select
                  className="form-input"
                  value={taskVoiceLang}
                  onChange={e => setTaskVoiceLang(e.target.value as any)}
                  style={{ fontWeight: 600 }}
                >
                  <option value="en">🇬🇧 English (Default)</option>
                  <option value="hi">🇮🇳 Hindi (हिन्दी)</option>
                  <option value="ta">🌴 Tamil (தமிழ்)</option>
                </select>
              </div>
            </div>

            {/* Set Reminder Alarm Section */}
            <div className={`task-reminder-card ${!hasTaskReminder ? 'reminder-inactive' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasTaskReminder ? '10px' : '0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={hasTaskReminder}
                    onChange={e => setHasTaskReminder(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#f59e0b', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bell size={16} style={{ color: hasTaskReminder ? '#d97706' : '#64748b' }} />
                    <span style={{ fontSize: '0.86rem', fontWeight: 800, color: hasTaskReminder ? '#92400e' : '#334155' }}>
                      Set Reminder Alarm (Date & Time AM/PM)
                    </span>
                  </div>
                </label>

                {hasTaskReminder && (
                  <button
                    type="button"
                    onClick={() => setHasTaskReminder(false)}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #fca5a5',
                      cursor: 'pointer'
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>

              {hasTaskReminder && (
                <div style={{ marginTop: '10px' }}>
                  {/* Preset quick buttons */}
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '8px' }}>
                    <button
                      type="button"
                      onClick={() => applyFormPreset(15)}
                      className="task-preset-btn"
                    >
                      ⚡ +15 Min
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormPreset(30)}
                      className="task-preset-btn"
                    >
                      ⚡ +30 Min
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormPreset(60)}
                      className="task-preset-btn"
                    >
                      ⚡ +1 Hour
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.9fr', gap: '8px', alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>📅 Date</label>
                      <input
                        type="date"
                        className="task-form-input"
                        value={taskRemDate}
                        onChange={e => setTaskRemDate(e.target.value)}
                        style={{ padding: '6px 8px', fontSize: '0.8rem', borderRadius: '8px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>⏰ Hour (1-12)</label>
                      <select
                        className="task-form-input"
                        value={taskRemHour}
                        onChange={e => setTaskRemHour(e.target.value)}
                        style={{ padding: '6px 8px', fontSize: '0.8rem', borderRadius: '8px', fontWeight: 700 }}
                      >
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>⏱ Minute</label>
                      <select
                        className="task-form-input"
                        value={taskRemMinute}
                        onChange={e => setTaskRemMinute(e.target.value)}
                        style={{ padding: '6px 8px', fontSize: '0.8rem', borderRadius: '8px', fontWeight: 700 }}
                      >
                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>☀️/🌙 Period</label>
                      <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid #cbd5e1' }}>
                        <button
                          type="button"
                          onClick={() => setTaskRemPeriod('AM')}
                          style={{
                            flex: 1,
                            padding: '5px 2px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            background: taskRemPeriod === 'AM' ? '#4f46e5' : '#ffffff',
                            color: taskRemPeriod === 'AM' ? '#ffffff' : '#64748b',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          AM
                        </button>
                        <button
                          type="button"
                          onClick={() => setTaskRemPeriod('PM')}
                          style={{
                            flex: 1,
                            padding: '5px 2px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            background: taskRemPeriod === 'PM' ? '#4f46e5' : '#ffffff',
                            color: taskRemPeriod === 'PM' ? '#ffffff' : '#64748b',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          PM
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  flexGrow: 1,
                  padding: '12px 20px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(79, 70, 229, 0.35)',
                  fontSize: '0.92rem',
                  fontWeight: 750
                }}
                disabled={taskSubmitting}
              >
                {taskSubmitting ? <Loader className="spinner" size={16} /> : (editingTask ? '💾 Save Changes' : '🚀 Assign Task')}
              </button>
              {editingTask && (
                <button type="button" onClick={handleCancelEditTask} className="btn btn-secondary" style={{ borderRadius: '12px' }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Task list and tracking */}
        <div className="glass-panel tasks-list-panel">
          {/* Sticky Controls & Staff Avatars Header */}
          <div className="tasks-sticky-header">
            <div className="flex-between" style={{ gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800 }}>Active Task List</h3>
                <span style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  color: '#4f46e5',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {filteredTasks.length} Active
                </span>
              </div>

              {/* Filters & Export */}
              <div className="tasks-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  className="task-form-input"
                  value={taskFilterStatus}
                  onChange={e => setTaskFilterStatus(e.target.value as any)}
                  style={{ padding: '6px 12px', fontSize: '0.82rem', width: 'auto', borderRadius: '10px' }}
                >
                  <option value="all">All Status</option>
                  <option value="pending">⏳ Pending</option>
                  <option value="discussion">💬 Discussion</option>
                  <option value="approval">🛡️ MD Approval</option>
                  <option value="completed">✅ Completed</option>
                </select>

                <select
                  className="task-form-input"
                  value={taskFilterType}
                  onChange={e => setTaskFilterType(e.target.value as any)}
                  style={{ padding: '6px 12px', fontSize: '0.82rem', width: 'auto', borderRadius: '10px' }}
                >
                  <option value="all">All Categories</option>
                  <option value="regular">Regular Work</option>
                  <option value="custom">Custom Duties</option>
                </select>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="btn btn-success"
                  style={{
                    padding: '7px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    border: 'none',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Download Active Tasks Excel spreadsheet to send to owner"
                >
                  <FileSpreadsheet size={15} />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            {/* Horizontal Staff Tabs Carousel */}
            <div className="tasks-staff-carousel">
              {/* All Tasks Button */}
              <button
                type="button"
                onClick={() => setSelectedStaffId('all')}
                className="tasks-staff-chip-btn"
              >
                <div className={`tasks-avatar-ring ${selectedStaffId === 'all' ? 'active-ring' : ''}`}>
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: selectedStaffId === 'all'
                        ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                        : '#f1f5f9',
                      color: selectedStaffId === 'all' ? '#ffffff' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 700
                    }}
                  >
                    📋
                  </div>
                </div>
                <span className={`tasks-staff-name-label ${selectedStaffId === 'all' ? 'active-name' : ''}`}>
                  All Tasks
                </span>
              </button>

              {/* Staff Members List */}
              {allStaff.map(staff => {
                const staffId = staff.id || staff._id || '';
                const isSelected = selectedStaffId === staffId;
                const avatarUrl = staff.imageUrl ? (staff.imageUrl.startsWith('http') ? staff.imageUrl : `${apiBase}${staff.imageUrl}`) : null;
                const pendingCount = staffPendingCounts[staffId] || 0;

                return (
                  <button
                    key={staffId}
                    type="button"
                    onClick={() => setSelectedStaffId(staffId)}
                    className="tasks-staff-chip-btn"
                  >
                    <div className={`tasks-avatar-ring ${isSelected ? 'active-ring' : ''}`}>
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
                            fontWeight: 800,
                            fontSize: '1.25rem'
                          }}
                        >
                          {staff.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Pending count overlay badge on avatar */}
                      {pendingCount > 0 && (
                        <span className="tasks-avatar-badge" title={`${pendingCount} pending tasks`}>
                          {pendingCount}
                        </span>
                      )}
                    </div>
                    <span className={`tasks-staff-name-label ${isSelected ? 'active-name' : ''}`}>
                      {staff.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="tasks-scroll-list">
            {(() => {
              let displayTasks = filteredTasks;
              if (selectedStaffId !== 'all') {
                displayTasks = filteredTasks.filter(t => t.assignedTo && (t.assignedTo._id === selectedStaffId || (t.assignedTo as any).id === selectedStaffId));
              }
              displayTasks = [...displayTasks].sort((a, b) => {
                const priority = (task: Task) => task.status === 'completed' ? 2 : task.completionRequestedAt ? 0 : 1;
                if (priority(a) !== priority(b)) return priority(a) - priority(b);
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA;
              });

              if (displayTasks.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '56px 20px', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>✨</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#334155' }}>No tasks found</div>
                    <div style={{ fontSize: '0.85rem', marginTop: '4px', color: '#64748b' }}>No tasks match the selected staff or filter criteria.</div>
                  </div>
                );
              }

              return displayTasks.map((t) => {
                const isCompleted = t.status === 'completed';
                const isAwaitingApproval = !isCompleted && Boolean(t.completionRequestedAt);
                const isTargetHighlighted = highlightedTaskId === t._id;
                const commentCount = t.comments?.length || 0;
                const hasActiveCommunication = !isCompleted && !isAwaitingApproval && commentCount > 0;

                const displayTitle = t.title || (t as any).description || 'Untitled Task';

                const cardBackground = isCompleted
                  ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)'
                  : isAwaitingApproval
                    ? 'linear-gradient(135deg, #eef2ff 0%, #ecfeff 100%)'
                    : hasActiveCommunication
                      ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                      : 'linear-gradient(135deg, #fff5f5 0%, #fff1f2 100%)';

                const cardBorder = isCompleted
                  ? '1.5px solid rgba(16, 185, 129, 0.35)'
                  : isAwaitingApproval
                    ? '1.5px solid rgba(79, 70, 229, 0.4)'
                    : hasActiveCommunication
                      ? '1.5px solid rgba(245, 158, 11, 0.38)'
                      : '1.5px solid rgba(244, 63, 94, 0.32)';

                const cardBorderLeft = isCompleted
                  ? '5.5px solid #10b981'
                  : isAwaitingApproval
                    ? '5.5px solid #4f46e5'
                    : hasActiveCommunication
                      ? '5.5px solid #f59e0b'
                      : '5.5px solid #f43f5e';

                return (
                  <div
                    key={t._id}
                    id={`task-item-${t._id}`}
                    className={`animate-fade-in ${isTargetHighlighted ? 'task-highlighted-row' : ''}`}
                    style={{
                      padding: '16px 20px',
                      marginBottom: '14px',
                      borderRadius: '16px',
                      background: cardBackground,
                      border: cardBorder,
                      borderLeft: cardBorderLeft,
                      boxShadow: isCompleted
                        ? '0 3px 12px rgba(16, 185, 129, 0.08)'
                        : isAwaitingApproval
                          ? '0 8px 22px rgba(79, 70, 229, 0.14)'
                          : hasActiveCommunication
                            ? '0 3px 12px rgba(245, 158, 11, 0.1)'
                            : '0 3px 12px rgba(244, 63, 94, 0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                    onClick={() => {
                      if (!t.seenByOwner) {
                        handleMarkAsSeen(t._id, false);
                      }
                      setSelectedTaskForComments(t);
                    }}
                  >
                    {/* Line 1: Tags on Left, Status Pill on Right */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Category Tag */}
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 750,
                          padding: '3px 9px',
                          borderRadius: '7px',
                          background: 'rgba(99, 102, 241, 0.12)',
                          color: '#4338ca',
                          border: '1px solid rgba(99, 102, 241, 0.25)',
                          textTransform: 'capitalize'
                        }}>
                          {t.taskType === 'reminder-sir' ? 'Sir Reminder' : t.taskType === 'regular' ? 'Regular Work' : 'Custom Task'}
                        </span>

                        {/* Frequency */}
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 650,
                          padding: '3px 9px',
                          borderRadius: '7px',
                          background: '#ffffff',
                          color: '#475569',
                          border: '1px solid #cbd5e1'
                        }}>
                          {t.frequency}
                        </span>

                        {/* Elapsed Days */}
                        {!isCompleted && t.createdAt && (
                          <span style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: '7px',
                            background: '#ede9fe',
                            color: '#6d28d9',
                            border: '1px solid rgba(139, 92, 246, 0.25)'
                          }}>
                            ⏳ {getDaysElapsed(t.createdAt)} {getDaysElapsed(t.createdAt) === 1 ? 'day' : 'days'}
                          </span>
                        )}

                        {/* Alarm Date/Time */}
                        {t.reminderDateTime && (
                          <span style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: '7px',
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fcd34d'
                          }}>
                            🔔 {new Date(t.reminderDateTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}, {new Date(t.reminderDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        )}

                        {!isCompleted && !t.seenByOwner && (
                          <span style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            fontWeight: 850,
                            fontSize: '0.68rem',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            border: '1px solid #fca5a5'
                          }}>
                            🔴 NEW
                          </span>
                        )}
                      </div>

                      {/* Right: Status Pill */}
                      <div>
                        {isCompleted ? (
                          <span style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#ffffff',
                            fontWeight: 850,
                            fontSize: '0.75rem',
                            letterSpacing: '0.04em',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                            textTransform: 'uppercase'
                          }}>
                            <CheckCircle2 size={12} /> COMPLETED
                          </span>
                        ) : isAwaitingApproval ? (
                          <span className="task-approval-status-pill">
                            <ShieldCheck size={13} /> MD APPROVAL
                          </span>
                        ) : hasActiveCommunication ? (
                          <span style={{
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            color: '#ffffff',
                            fontWeight: 850,
                            fontSize: '0.75rem',
                            letterSpacing: '0.04em',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
                            textTransform: 'uppercase'
                          }}>
                            <MessageSquare size={12} /> DISCUSSION ({commentCount})
                          </span>
                        ) : (
                          <span style={{
                            background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                            color: '#ffffff',
                            fontWeight: 850,
                            fontSize: '0.75rem',
                            letterSpacing: '0.04em',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 2px 8px rgba(244, 63, 94, 0.35)',
                            textTransform: 'uppercase'
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffffff', display: 'inline-block' }} />
                            PENDING
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Line 2: Main Task Title */}
                    <div style={{ margin: '4px 0 6px 0' }}>
                      <h3 style={{
                        margin: 0,
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: isCompleted ? '#059669' : '#0f172a',
                        textDecoration: isCompleted ? 'line-through' : 'none',
                        opacity: isCompleted ? 0.82 : 1,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.4
                      }}>
                        {displayTitle}
                      </h3>
                    </div>

                    {/* Line 3: Assignee on Left, Action buttons on Right */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%', flexWrap: 'wrap', paddingTop: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isCompleted ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#059669', fontWeight: 650 }}>
                            <span>✅ Completed by</span>
                            <span style={{
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#059669',
                              padding: '2px 9px 2px 5px',
                              borderRadius: '12px',
                              fontWeight: 750,
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {t.completedBy?.imageUrl ? (
                                <img src={t.completedBy.imageUrl.startsWith('http') ? t.completedBy.imageUrl : `${apiBase}${t.completedBy.imageUrl}`} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                              ) : null}
                              {t.completedBy?.name || 'Staff'}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>on {new Date(t.completedAt || '').toLocaleDateString('en-GB')}</span>
                          </span>
                        ) : isAwaitingApproval ? (
                          <span className="task-approval-requester">
                            <span>🛡️ Finish requested by</span>
                            <strong>{t.completionRequestedBy?.name || t.assignedTo?.name || 'Staff'}</strong>
                            {t.completionRequestedAt && (
                              <small>{new Date(t.completionRequestedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small>
                            )}
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#64748b' }}>
                            <span style={{ fontWeight: 600 }}>👤 Assigned to:</span>
                            <span style={{
                              background: 'rgba(99, 102, 241, 0.1)',
                              color: '#4f46e5',
                              padding: '2px 10px 2px 6px',
                              borderRadius: '12px',
                              fontWeight: 750,
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}>
                              {t.assignedTo?.imageUrl ? (
                                <img src={t.assignedTo.imageUrl.startsWith('http') ? t.assignedTo.imageUrl : `${apiBase}${t.assignedTo.imageUrl}`} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                              ) : null}
                              {t.assignedTo?.name || '👥 All Staff'}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                        {isAwaitingApproval && (
                          <>
                            <button
                              type="button"
                              className="approve-finish-button"
                              onClick={(e) => { e.stopPropagation(); handleApproveCompletion(t); }}
                              title="Approve and mark this task completed"
                            >
                              <ShieldCheck size={15} /> Approve Finish
                            </button>
                            <button
                              type="button"
                              className="reject-finish-button"
                              onClick={(e) => { e.stopPropagation(); handleRejectCompletion(t); }}
                              title="Reject finish request and send back for revision"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {!isCompleted && !isAwaitingApproval && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#059669', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', fontWeight: 750 }}
                            onClick={(e) => { e.stopPropagation(); handleApproveCompletion(t); }}
                            title="Directly mark task as finished by MD"
                          >
                            <Check size={13} strokeWidth={2.5} /> Finish
                          </button>
                        )}
                        {commentCount > 0 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedTaskForComments(t); }}
                            className="btn btn-secondary"
                            style={{ padding: '3px 8px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#b45309', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', fontWeight: 750 }}
                            title="View feedback discussion"
                          >
                            <MessageSquare size={13} />
                            <span>{commentCount}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleStartEditTask(t); }}
                          className="btn btn-secondary"
                          style={{ padding: '5px 8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', cursor: 'pointer' }}
                          title="Edit task"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteTask(t._id); }}
                          className="btn btn-secondary"
                          style={{ padding: '5px 8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#dc2626', cursor: 'pointer' }}
                          title="Delete task"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

      </div>

      {/* Profile Image HD Lightbox / Preview Modal */}
      {previewPhoto && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(11, 20, 26, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            style={{
              position: 'relative',
              background: '#ffffff',
              borderRadius: '24px',
              padding: '28px',
              maxWidth: '460px',
              width: '92vw',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
              animation: 'waMenuScale 0.2s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
                transition: 'all 0.15s ease'
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 16px', fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
              {previewPhoto.name}'s Profile Photo
            </h3>

            <div style={{
              width: '280px',
              height: '280px',
              borderRadius: '50%',
              overflow: 'hidden',
              boxShadow: '0 12px 30px rgba(99, 102, 241, 0.25)',
              border: '4px solid #6366f1',
              margin: '8px 0 8px',
              background: '#f8fafc'
            }}>
              <img
                src={previewPhoto.url}
                alt={previewPhoto.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
