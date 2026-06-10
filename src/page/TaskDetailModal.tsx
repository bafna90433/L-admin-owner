import React, { useState } from 'react';
import { Loader, Send } from 'lucide-react';
import '../styles/Tasks.css';

interface Task {
  _id: string;
  title: string;
  taskType: 'regular' | 'reminder-sir' | 'custom';
  frequency: 'daily' | 'weekly' | 'monthly' | 'one-time';
  status: 'pending' | 'completed';
  assignedTo?: {
    name: string;
  };
  comments?: any[];
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

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }}>
      <div className="glass-panel glass-panel-glow animate-fade-in" style={{ width: '100%', maxWidth: '540px', padding: '32px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <span className={`badge ${task.status === 'completed' ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'uppercase' }}>
            {task.status}
          </span>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-secondary"
            style={{ padding: '4px 8px', borderRadius: '50%' }}
          >
            ✕
          </button>
        </div>

        <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          {task.title}
        </h3>
        
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          Category: <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{task.taskType} ({task.frequency})</span> | Assigned to: <span style={{ fontWeight: 600 }}>{task.assignedTo?.name || 'All Staff'}</span>
        </p>

        {/* Comments List */}
        <div className="task-comments-wrapper">
          {task.comments && task.comments.length > 0 ? (
            task.comments.map((c: any, index: number) => {
              const isOwner = c.authorRole === 'owner';
              return (
                <div 
                  key={index}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    maxWidth: '85%',
                    alignSelf: isOwner ? 'flex-end' : 'flex-start',
                    background: isOwner ? 'rgba(79, 70, 229, 0.1)' : 'var(--bg-tertiary)',
                    border: isOwner ? '1px solid rgba(79, 70, 229, 0.2)' : '1px solid var(--glass-border)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: isOwner ? '#4f46e5' : 'var(--text-primary)' }}>
                      {c.authorName} ({isOwner ? 'Owner' : 'Staff'})
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {c.text}
                  </p>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px', fontStyle: 'italic' }}>
              No updates or follow-up comments on this task yet.
            </div>
          )}
        </div>

        {/* Comment Form */}
        <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Ask for update or reply..."
            value={newCommentText}
            onChange={e => setNewCommentText(e.target.value)}
            required
            style={{ flexGrow: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={commentSubmitting} style={{ padding: '10px 16px' }}>
            {commentSubmitting ? <Loader className="spinner" size={14} /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
