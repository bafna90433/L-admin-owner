import React, { useState, useRef, useEffect } from 'react';
import { Loader, Edit3, Trash2, X, Sparkles, Volume2, FileSpreadsheet, Bell, ChevronDown, Users, Check } from 'lucide-react';
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
  const [taskFilterStatus, setTaskFilterStatus] = useState<'all' | 'pending' | 'discussion' | 'completed'>('all');
  const [taskFilterType, setTaskFilterType] = useState<'all' | 'regular' | 'reminder-sir' | 'custom'>('all');

  // Tab state for staff filtering
  const [selectedStaffId, setSelectedStaffId] = useState<string | 'all' | 'unassigned'>('all');
  const [previewPhoto, setPreviewPhoto] = useState<{ name: string; url: string } | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

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

  const _handleCompleteTask = (id: string, title?: string) => {
    setConfirmModal({
      title: 'Finish & Complete Task',
      message: `Are you sure you want to mark "${title || 'this task'}" as Finished & Completed?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`${apiBase}/tasks/${id}/complete`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchTasks();
            showToast('✅ Task marked as Finished & Completed by MD!', 'success');
          } else {
            showToast('Failed to complete task', 'danger');
          }
        } catch (err) {
          console.error(err);
          showToast('Error connecting to server', 'danger');
        }
      }
    });
  };

  const _handleResetTask = (id: string) => {
    setConfirmModal({
      title: 'Reset Task',
      message: 'Are you sure you want to reset this task back to pending?',
      onConfirm: async () => {
        try {
          const res = await fetch(`${apiBase}/tasks/${id}/reset`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchTasks();
            showToast('Task status reset to pending.', 'success');
          } else {
            showToast('Failed to reset task', 'danger');
          }
        } catch (err) {
          console.error(err);
          showToast('Error connecting to server', 'danger');
        }
      }
    });
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
      if (taskFilterStatus === 'discussion') {
        return t.status !== 'completed' && (t.comments?.length || 0) > 0;
      }
      if (taskFilterStatus === 'pending') {
        return t.status !== 'completed' && (!t.comments || t.comments.length === 0);
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
      <div style={{ marginBottom: '8px' }}>
        <h1 style={{ margin: '0 0 6px 0' }}>Task Management & Follow-ups</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Assign duties to staff, monitor Excel regular checklists, and write feedback comments.</p>
      </div>

      <div className="tasks-grid">
        
        {/* Form to Assign Work */}
        <div className="glass-panel tasks-create-panel" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>{editingTask ? 'Edit Task Details' : 'Assign New Task'}</h3>
          <form onSubmit={handleTaskSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>TASK DESCRIPTION / TITLE</label>
                <button 
                  type="button" 
                  onClick={handleGenerateWithGemini}
                  disabled={isAiGenerating}
                  style={{
                    padding: '3px 10px',
                    fontSize: '0.75rem',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)'
                  }}
                  title="Click to refine task description using Gemini AI"
                >
                  {isAiGenerating ? <Loader className="spinner" size={12} /> : <Sparkles size={12} />} ✨ Auto-Refine with Gemini AI
                </button>
              </div>
              <textarea 
                className="form-input"
                placeholder="e.g. Check boys room EB bill receipt, check stickers inventory"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onBlur={async () => {
                  if (newTaskTitle.trim() && !isAiGenerating) {
                    const refined = await refineTitleWithAi(newTaskTitle);
                    setNewTaskTitle(refined);
                  }
                }}
                style={{ minHeight: '80px', resize: 'vertical' }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Task Category</label>
                <select 
                  className="form-input"
                  value={newTaskType}
                  onChange={e => setNewTaskType(e.target.value as any)}
                  required
                >
                  <option value="custom">Custom Task</option>
                  <option value="regular">Regular Work</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Frequency</label>
                <select 
                  className="form-input"
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
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '6px',
                    background: '#ffffff',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: '14px',
                    boxShadow: '0 15px 35px -5px rgba(15, 23, 42, 0.22), 0 5px 15px rgba(0, 0, 0, 0.08)',
                    zIndex: 9999,
                    overflow: 'hidden',
                    animation: 'fadeInSlideDown 0.18s ease'
                  }}>
                    {/* Header with Quick Actions */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569' }}>
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
                            fontWeight: 700,
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
                            fontWeight: 700,
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
                    <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '0 8px 6px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
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
                          padding: '4px 12px',
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
            <div style={{
              background: hasTaskReminder ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' : '#f8fafc',
              border: hasTaskReminder ? '1.5px solid #fcd34d' : '1.5px solid #e2e8f0',
              borderRadius: '14px',
              padding: '14px 16px',
              transition: 'all 0.2s ease'
            }}>
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
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: hasTaskReminder ? '#92400e' : '#334155' }}>
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
                      style={{ padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      ⚡ +15 Min
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormPreset(30)}
                      style={{ padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      ⚡ +30 Min
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormPreset(60)}
                      style={{ padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      ⚡ +1 Hour
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.9fr', gap: '8px', alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>📅 Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={taskRemDate}
                        onChange={e => setTaskRemDate(e.target.value)}
                        style={{ padding: '6px 8px', fontSize: '0.8rem', borderRadius: '8px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>⏰ Hour (1-12)</label>
                      <select
                        className="form-input"
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
                        className="form-input"
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

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={taskSubmitting}>
                {taskSubmitting ? <Loader className="spinner" size={16} /> : (editingTask ? 'Save Changes' : 'Assign Task')}
              </button>
              {editingTask && (
                <button type="button" onClick={handleCancelEditTask} className="btn btn-secondary">
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
              <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Active Task List</h3>
              
              {/* Filters & Export */}
              <div className="tasks-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <select 
                  className="form-input" 
                  value={taskFilterStatus} 
                  onChange={e => setTaskFilterStatus(e.target.value as any)}
                  style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="discussion">💬 Discussion</option>
                  <option value="completed">Completed</option>
                </select>

                <select 
                  className="form-input" 
                  value={taskFilterType} 
                  onChange={e => setTaskFilterType(e.target.value as any)}
                  style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto' }}
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
                    padding: '6px 14px',
                    fontSize: '0.85rem',
                    fontWeight: 650,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '8px',
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

            {/* Horizontal Staff Tabs (Extra Large Circular Avatars with Name Below & Image Preview) */}
            <div style={{ display: 'flex', gap: '22px', overflowX: 'auto', padding: '10px 4px 4px 4px', marginTop: '6px', alignItems: 'flex-start' }}>
              {/* All Tasks Button */}
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
                  All Tasks
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

          <div className="tasks-scroll-list" style={{ padding: '0 20px 20px 20px' }}>
            {(() => {
              let displayTasks = filteredTasks;
              if (selectedStaffId !== 'all') {
                displayTasks = filteredTasks.filter(t => t.assignedTo && (t.assignedTo._id === selectedStaffId));
              }
              displayTasks = [...displayTasks].sort((a, b) => {
                if (a.status !== b.status) {
                  return a.status === 'completed' ? 1 : -1;
                }
                // Same status: newest tasks first (latest createdAt first, oldest at the bottom)
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA;
              });

              if (displayTasks.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                    No tasks match the selected staff/filters.
                  </div>
                );
              }

              return displayTasks.map((t) => {
                const isCompleted = t.status === 'completed';
                // isPending = !isCompleted (reserved for future use)
                const isTargetHighlighted = highlightedTaskId === t._id;
                const commentCount = t.comments?.length || 0;
                const hasActiveCommunication = !isCompleted && commentCount > 0;
                const cardStatusClass = isCompleted 
                  ? 'task-completed-card' 
                  : hasActiveCommunication 
                    ? 'task-discussion-card' 
                    : 'task-pending-card';

                return (
                  <div 
                    key={t._id} 
                    id={`task-item-${t._id}`}
                    className={`task-item-card animate-fade-in ${cardStatusClass} ${isTargetHighlighted ? 'task-highlighted-card' : ''}`}
                    style={{ 
                      border: isTargetHighlighted
                        ? '2.5px solid #4f46e5'
                        : isCompleted 
                          ? '1px solid rgba(16, 185, 129, 0.4)' 
                          : hasActiveCommunication
                            ? '1.5px solid rgba(245, 158, 11, 0.5)'
                            : '1.5px solid rgba(239, 68, 68, 0.45)',
                      borderLeft: isTargetHighlighted
                        ? '6px solid #4f46e5'
                        : isCompleted
                          ? '5px solid #10b981'
                          : hasActiveCommunication
                            ? '6px solid #f59e0b'
                            : '6px solid #ef4444',
                      background: isTargetHighlighted
                        ? 'rgba(79, 70, 229, 0.08)'
                        : isCompleted 
                          ? 'rgba(16, 185, 129, 0.05)' 
                          : hasActiveCommunication
                            ? 'linear-gradient(135deg, rgba(254, 243, 199, 0.55) 0%, rgba(255, 255, 255, 0.98) 100%)'
                            : 'linear-gradient(135deg, rgba(254, 242, 242, 0.95) 0%, rgba(255, 255, 255, 0.98) 100%)',
                      boxShadow: isTargetHighlighted 
                        ? '0 0 20px rgba(79, 70, 229, 0.35)' 
                        : isCompleted
                          ? 'none'
                          : hasActiveCommunication
                            ? '0 3px 12px rgba(245, 158, 11, 0.1)'
                            : '0 3px 12px rgba(239, 68, 68, 0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      position: 'relative'
                    }}
                    onClick={() => {
                      if (!t.seenByOwner) {
                        handleMarkAsSeen(t._id, false);
                      }
                      setSelectedTaskForComments(t);
                    }}
                  >
                    <div className="flex-between" style={{ marginBottom: '8px', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className={`badge ${
                          t.taskType === 'regular' ? 'badge-info' : 
                          t.taskType === 'reminder-sir' ? 'badge-warning' : 
                          'badge-success'
                        }`} style={{ textTransform: 'capitalize' }}>
                          {t.taskType === 'reminder-sir' ? 'sir reminder' : t.taskType}
                        </span>
                        <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>
                          {t.frequency}
                        </span>
                        {!isCompleted && t.createdAt && (
                          <span className="badge" style={{ 
                            background: 'rgba(79, 70, 229, 0.1)', 
                            color: 'var(--accent-primary)',
                            textTransform: 'lowercase',
                            fontWeight: 700
                          }}>
                            {getDaysElapsed(t.createdAt)} {getDaysElapsed(t.createdAt) === 1 ? 'day' : 'days'}
                          </span>
                        )}
                        {!isCompleted && t.reminderDateTime && (
                          <span className="badge" style={{ 
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
                            color: '#ffffff',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 6px rgba(245, 158, 11, 0.35)'
                          }}>
                            <Bell size={11} />
                            <span>
                              {new Date(t.reminderDateTime).toLocaleDateString([], { month: 'short', day: 'numeric' })},{' '}
                              {new Date(t.reminderDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          </span>
                        )}
                        {!isCompleted && !t.seenByOwner && (
                          <span className="badge" style={{ 
                            background: 'rgba(239, 68, 68, 0.1)', 
                            color: '#ef4444',
                            fontWeight: 700,
                            animation: 'newBadgePulseWB 1.5s infinite',
                          }}>
                            🔴 New / Unseen
                          </span>
                        )}
                      </div>
                      
                      {isCompleted ? (
                        <span className="badge badge-status-completed" style={{ textTransform: 'uppercase' }}>
                          {t.status}
                        </span>
                      ) : hasActiveCommunication ? (
                        <span className="badge badge-status-discussion" style={{ textTransform: 'uppercase' }} title="Active discussion on this task">
                          💬 DISCUSSION ({commentCount})
                        </span>
                      ) : (
                        <span className="badge badge-status-pending" style={{ textTransform: 'uppercase' }} title="Pending task without discussion">
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffffff', display: 'inline-block', marginRight: 4 }} />
                          PENDING
                        </span>
                      )}
                    </div>

                    <p style={{ 
                      fontWeight: 600, 
                      fontSize: '1.05rem', 
                      margin: '8px 0', 
                      color: isCompleted ? '#059669' : 'var(--text-primary)', 
                      textDecoration: isCompleted ? 'line-through' : 'none', 
                      opacity: isCompleted ? 0.75 : 1 
                    }}>
                      {t.title}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                        {isCompleted ? (
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <span>✅ Completed by</span>
                            <span style={{ 
                              background: 'rgba(16, 185, 129, 0.1)', 
                              color: 'var(--color-success)', 
                              padding: '2px 10px 2px 6px', 
                              borderRadius: '14px', 
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              {t.completedBy?.imageUrl ? (
                                <img src={t.completedBy.imageUrl.startsWith('http') ? t.completedBy.imageUrl : `${apiBase}${t.completedBy.imageUrl}`} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                              ) : null}
                              {t.completedBy?.name || 'Staff'}
                            </span>
                            <span>on {new Date(t.completedAt || '').toLocaleDateString('en-GB')}</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <span>👤 Assigned to:</span>
                            <span style={{ 
                              background: 'rgba(79, 70, 229, 0.1)', 
                              color: 'var(--accent-primary)', 
                              padding: '2px 10px 2px 6px', 
                              borderRadius: '14px', 
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              {t.assignedTo?.imageUrl ? (
                                <img src={t.assignedTo.imageUrl.startsWith('http') ? t.assignedTo.imageUrl : `${apiBase}${t.assignedTo.imageUrl}`} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                              ) : null}
                              {t.assignedTo?.name || 'All Staff'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleStartEditTask(t); }}
                          className="btn btn-secondary" 
                          style={{ padding: '6px', fontSize: '0.8rem' }}
                          title="Edit task"
                        >
                          <Edit3 size={14} />
                        </button>

                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteTask(t._id); }}
                          className="btn btn-danger" 
                          style={{ padding: '6px', fontSize: '0.8rem' }}
                          title="Delete task"
                        >
                          <Trash2 size={14} />
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
