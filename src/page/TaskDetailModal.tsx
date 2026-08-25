import React, { useState, useEffect } from 'react';
import { Loader, Send, Lock } from 'lucide-react';
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
  seenByOwner?: boolean;
  seenAt?: string;
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
      background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      padding: '16px'
    }}>
      <div className="glass-panel animate-fade-in" style={{ 
        width: '100%', 
        maxWidth: '560px', 
        padding: '24px 28px', 
        display: 'flex', 
        flexDirection: 'column', 
        maxHeight: '90vh',
        background: '#ffffff',
        borderRadius: '20px',
        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
        border: '1.5px solid rgba(226, 232, 240, 0.95)'
      }}>
        {/* Header */}
        <div className="flex-between" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`badge ${task.status === 'completed' ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'uppercase', fontWeight: 800 }}>
              {task.status}
            </span>
            {task.taskType === 'reminder-sir' && (
              <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={12} /> MD Directive
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

        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', lineHeight: 1.3 }}>
          {task.title}
        </h3>
        
        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 16px 0', paddingBottom: '12px', borderBottom: '1px solid rgba(226, 232, 240, 0.8)' }}>
          Category: <span style={{ fontWeight: 700, textTransform: 'capitalize', color: '#0f172a' }}>{task.taskType} ({task.frequency})</span> • Assigned to: <span style={{ fontWeight: 700, color: '#4f46e5' }}>{task.assignedTo?.name || 'All Staff'}</span>
        </p>

        {/* Discussion / Follow-up Notes (Chat View) */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px', 
          maxHeight: '340px', 
          overflowY: 'auto', 
          padding: '14px', 
          background: '#f8fafc', 
          border: '1.5px solid rgba(226, 232, 240, 0.95)',
          borderRadius: '16px', 
          marginBottom: '16px' 
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
                    padding: '12px 16px',
                    maxWidth: '82%',
                    alignSelf: isMD ? 'flex-end' : 'flex-start',
                    background: isMD 
                      ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' 
                      : '#ffffff',
                    color: isMD ? '#ffffff' : '#0f172a',
                    borderRadius: isMD ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    border: isMD ? 'none' : '1.5px solid rgba(226, 232, 240, 0.95)',
                    boxShadow: isMD 
                      ? '0 4px 14px rgba(79, 70, 229, 0.25)' 
                      : '0 2px 6px rgba(15, 23, 42, 0.03)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '4px' }}>
                    <span style={{ 
                      fontWeight: 800, 
                      fontSize: '0.76rem', 
                      color: isMD ? '#e0e7ff' : '#4f46e5',
                      letterSpacing: '0.02em'
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
                    fontSize: '0.92rem', 
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
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 16px', fontSize: '0.88rem' }}>
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
