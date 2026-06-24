import React, { useState } from 'react';
import { Loader, Edit3, Trash2 } from 'lucide-react';
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
  };
  completedBy?: {
    name: string;
  };
  completedAt?: string;
  comments?: any[];
  createdAt: string;
  seenByOwner?: boolean;
  seenAt?: string;
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
}

export default function Tasks({
  token,
  apiBase,
  tasks,
  allStaff,
  fetchTasks,
  setSelectedTaskForComments,
  setConfirmModal,
  showToast
}: TasksProps) {
  // New task form fields
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<'regular' | 'reminder-sir' | 'custom'>('custom');
  const [newTaskFreq, setNewTaskFreq] = useState<'daily' | 'weekly' | 'monthly' | 'one-time'>('one-time');
  const [taskAssignedTo, setTaskAssignedTo] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  
  // Edit task state
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // List filters
  const [taskFilterStatus, setTaskFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [taskFilterType, setTaskFilterType] = useState<'all' | 'regular' | 'reminder-sir' | 'custom'>('all');

  // Tab state for staff filtering
  const [selectedStaffId, setSelectedStaffId] = useState<string | 'all' | 'unassigned'>('all');

  // Calculate days elapsed since task creation
  const getDaysElapsed = (createdAt: string) => {
    if (!createdAt) return 0;
    const createdDate = new Date(createdAt);
    const today = new Date();
    // Set to start of day for exact calendar day difference
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
    setTaskAssignedTo(task.assignedTo?._id || '');
  };

  const handleCancelEditTask = () => {
    setEditingTask(null);
    setNewTaskTitle('');
    setNewTaskType('custom');
    setNewTaskFreq('one-time');
    setTaskAssignedTo('');
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;
    setTaskSubmitting(true);
    try {
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
          title: newTaskTitle,
          taskType: newTaskType,
          frequency: newTaskFreq,
          assignedTo: taskAssignedTo || null
        })
      });
      if (res.ok) {
        setNewTaskTitle('');
        setNewTaskType('custom');
        setNewTaskFreq('one-time');
        setTaskAssignedTo('');
        setEditingTask(null);
        fetchTasks();
        showToast(editingTask ? 'Task updated successfully!' : 'Task created successfully!', 'success');
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

  const handleResetTask = (id: string) => {
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

  const filteredTasks = tasks
    .filter(t => taskFilterStatus === 'all' || t.status === taskFilterStatus)
    .filter(t => taskFilterType === 'all' || t.taskType === taskFilterType);

  return (
    <div className="tasks-page-container">
      <div>
        <h1>Task Management & Follow-ups</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Assign duties to staff, monitor Excel regular checklists, and write feedback comments.</p>
      </div>

      <div className="tasks-grid">
        
        {/* Form to Assign Work */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>{editingTask ? 'Edit Task Details' : 'Assign New Task'}</h3>
          <form onSubmit={handleTaskSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div className="form-group">
              <label className="form-label">Task Description / Title</label>
              <textarea 
                className="form-input"
                placeholder="e.g. Check boys room EB bill receipt, check stickers inventory"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
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

            <div className="form-group">
              <label className="form-label">Assign To Staff Member</label>
              <select 
                className="form-input"
                value={taskAssignedTo}
                onChange={e => setTaskAssignedTo(e.target.value)}
              >
                <option value="">All Office Staff</option>
                {allStaff.map(s => (
                  <option key={s.id || s._id} value={s.id || s._id}>{s.name} ({s.username})</option>
                ))}
              </select>
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
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="flex-between" style={{ gap: '12px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1.25rem' }}>Active Task List</h3>
            
            {/* Filters */}
            <div className="tasks-filter-bar">
              <select 
                className="form-input" 
                value={taskFilterStatus} 
                onChange={e => setTaskFilterStatus(e.target.value as any)}
                style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto' }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
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
            </div>
          </div>

          {/* Horizontal Staff Tabs */}
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '12px', borderBottom: '1px solid var(--glass-border)', marginTop: '8px' }}>
            <button
              onClick={() => setSelectedStaffId('all')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                background: selectedStaffId === 'all' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: selectedStaffId === 'all' ? '#fff' : 'var(--text-primary)',
                border: selectedStaffId === 'all' ? 'none' : '1px solid var(--glass-border)',
                borderRadius: '24px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', fontWeight: 600
              }}
            >
              📑 All Tasks
            </button>

            {allStaff.map(staff => {
              const staffId = staff.id || staff._id || '';
              const isSelected = selectedStaffId === staffId;
              
              return (
                <button
                  key={staffId}
                  onClick={() => setSelectedStaffId(staffId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 16px 4px 4px',
                    background: isSelected ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: isSelected ? '#fff' : 'var(--text-primary)',
                    border: isSelected ? 'none' : '1px solid var(--glass-border)',
                    borderRadius: '24px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', fontWeight: 600
                  }}
                >
                  {staff.imageUrl ? (
                    <img src={`${apiBase}${staff.imageUrl}`} alt={staff.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.2)' : 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '0.8rem' }}>
                      {staff.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {staff.name}
                </button>
              );
            })}
          </div>

          <div className="tasks-scroll-list">
            {(() => {
              let displayTasks = filteredTasks;
              if (selectedStaffId !== 'all') {
                displayTasks = filteredTasks.filter(t => t.assignedTo && (t.assignedTo._id === selectedStaffId));
              }
              displayTasks = [...displayTasks].sort((a, b) => {
                if (a.status !== b.status) {
                  return a.status === 'completed' ? 1 : -1;
                }
                // Same status: oldest tasks first (earliest createdAt first, i.e., highest days elapsed first)
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeA - timeB;
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
                return (
                  <div 
                    key={t._id} 
                    className="task-item-card animate-fade-in"
                    style={{ 
                      border: `1px solid ${isCompleted ? 'rgba(16, 185, 129, 0.4)' : 'var(--glass-border)'}`,
                      background: isCompleted ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-tertiary)',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedTaskForComments(t)}
                  >
                    <div className="flex-between" style={{ marginBottom: '8px', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                      <span className={`badge ${isCompleted ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'uppercase' }}>
                        {t.status}
                      </span>
                    </div>

                    <p style={{ 
                      fontWeight: 600, 
                      fontSize: '1.05rem', 
                      margin: '8px 0', 
                      color: 'var(--text-primary)', 
                      textDecoration: isCompleted ? 'line-through' : 'none', 
                      opacity: isCompleted ? 0.7 : 1 
                    }}>
                      {t.title}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {isCompleted ? (
                          <div>
                            ✅ Completed by <span style={{ fontWeight: 600 }}>{t.completedBy?.name || 'Staff'}</span> on {new Date(t.completedAt || '').toLocaleDateString('en-GB')}
                          </div>
                        ) : (
                          <div>
                            👤 Assigned to: <span style={{ fontWeight: 600 }}>{t.assignedTo?.name || 'All Staff'}</span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedTaskForComments(t); }}
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          💬 {t.comments?.length || 0} Comments
                        </button>
                        
                        {isCompleted && (
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleResetTask(t._id); }}
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--color-warning)' }}
                          >
                            Reopen
                          </button>
                        )}

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
    </div>
  );
}
