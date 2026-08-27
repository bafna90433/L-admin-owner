import { useState, useMemo } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Search,
  Trash2,
  Sparkles,
  ListTodo,
  Zap
} from 'lucide-react';
import '../styles/Notifications.css';

export interface NotificationItem {
  id: string;
  type: 'new_task' | 'task_completed' | 'task_comment' | 'task_update' | 'advance_request' | 'reminder';
  title: string;
  description: string;
  timestamp: string | Date;
  taskId?: string;
  advanceId?: string;
  reminderId?: string;
  staffName?: string;
  staffImage?: string;
  badge: string;
  badgeColor: 'warning' | 'success' | 'info' | 'primary' | 'danger' | 'purple' | 'secondary';
  targetTab: 'tasks' | 'advances' | 'reminders';
  action?: 'open_task' | 'open_comments' | 'open_advance';
  isRead?: boolean;
}

interface NotificationsProps {
  notifications: NotificationItem[];
  reminders?: any[];
  allStaff?: any[];
  onNotificationClick: (notif: NotificationItem) => void;
  onMarkAllAsRead: () => void;
  onToggleRead: (id: string) => void;
  onClearHistory?: () => void;
  onRefreshFeed?: () => void;
}

export default function Notifications({
  notifications,
  onNotificationClick,
  onMarkAllAsRead,
  onToggleRead,
  onClearHistory,
  onRefreshFeed
}: NotificationsProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Stats calculation (Active Unread counts)
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const newTasksCount = notifications.filter(n => !n.isRead && n.type === 'new_task').length;
  const completedTasksCount = notifications.filter(n => !n.isRead && n.type === 'task_completed').length;
  const commentsCount = notifications.filter(n => !n.isRead && n.type === 'task_comment').length;
  const advancesCount = notifications.filter(n => !n.isRead && n.type === 'advance_request').length;
  const readHistoryCount = notifications.filter(n => n.isRead).length;

  // Filter and Search Logic: Hide already viewed/selected/read items from the active view
  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      // If viewed/read history tab is selected, show read items
      if (filterType === 'read_history') {
        if (!item.isRead) return false;
      } else {
        // In all active feeds, hide items that have been viewed / read / selected by MD
        if (item.isRead) return false;
      }

      if (filterType === 'new_task' && item.type !== 'new_task') return false;
      if (filterType === 'task_completed' && item.type !== 'task_completed') return false;
      if (filterType === 'task_comment' && item.type !== 'task_comment') return false;
      if (filterType === 'advance_request' && item.type !== 'advance_request') return false;
      if (filterType === 'reminder' && item.type !== 'reminder') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchStaff = (item.staffName || '').toLowerCase().includes(q);
        const matchBadge = item.badge.toLowerCase().includes(q);
        return matchTitle || matchDesc || matchStaff || matchBadge;
      }

      return true;
    });
  }, [notifications, filterType, searchQuery]);

  // Relative Time Formatter
  const formatTimeAgo = (timeInput: string | Date) => {
    if (!timeInput) return 'Recently';
    const date = new Date(timeInput);
    if (isNaN(date.getTime())) return 'Recently';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="notifications-container animate-fade-in">
      
      {/* =========================================================================
          EXECUTIVE CONTROL DECK HEADER
          ========================================================================= */}
      <div className="notifications-control-deck">
        
        {/* Tier 1: Title + Live Status + Header Actions */}
        <div className="deck-top-row">
          <div className="deck-title-area">
            <div className="deck-glow-icon">
              <Zap size={22} />
            </div>
            <div className="deck-title-text">
              <h2>Real-Time Activity Feed</h2>
              <div className="deck-status-badges">
                <span className="live-feed-badge">
                  <span className="live-feed-dot" /> Live Connected
                </span>
                {unreadCount > 0 ? (
                  <span className="pill-tag blinking-tag">
                    🔴 {unreadCount} New Alerts
                  </span>
                ) : (
                  <span className="pill-tag" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                    ✅ All Caught Up
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="deck-actions-group">
            {onRefreshFeed && (
              <button
                onClick={onRefreshFeed}
                className="deck-action-btn"
              >
                <Sparkles size={14} /> Refresh
              </button>
            )}
            {onMarkAllAsRead && unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="deck-action-btn"
                title="Mark all notifications as read / seen"
              >
                <CheckCircle2 size={14} /> Mark All Read
              </button>
            )}
            {onClearHistory && readHistoryCount > 0 && (
              <button
                onClick={onClearHistory}
                className="deck-action-btn"
                title="Clear read notifications from history"
              >
                <Trash2 size={14} /> Clear Read
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: Interactive KPI Metric Pills (Clickable) */}
        <div className="deck-metrics-grid">
          <div 
            className={`deck-metric-card total ${filterType === 'all' ? 'active-metric' : ''}`}
            onClick={() => setFilterType('all')}
          >
            <div className="metric-icon-box">
              <Bell size={17} />
            </div>
            <div className="metric-info">
              <span className="metric-label">Active Alerts</span>
              <span className="metric-value">{unreadCount}</span>
            </div>
          </div>

          <div 
            className={`deck-metric-card new-tasks ${filterType === 'new_task' ? 'active-metric' : ''}`}
            onClick={() => setFilterType('new_task')}
          >
            <div className="metric-icon-box">
              <ListTodo size={17} />
            </div>
            <div className="metric-info">
              <span className="metric-label">New Tasks</span>
              <span className="metric-value">{newTasksCount}</span>
            </div>
          </div>

          <div 
            className={`deck-metric-card done ${filterType === 'task_completed' ? 'active-metric' : ''}`}
            onClick={() => setFilterType('task_completed')}
          >
            <div className="metric-icon-box">
              <CheckCircle2 size={17} />
            </div>
            <div className="metric-info">
              <span className="metric-label">Done</span>
              <span className="metric-value">{completedTasksCount}</span>
            </div>
          </div>

          <div 
            className={`deck-metric-card advances ${filterType === 'advance_request' ? 'active-metric' : ''}`}
            onClick={() => setFilterType('advance_request')}
          >
            <div className="metric-icon-box">
              <ArrowUpRight size={17} />
            </div>
            <div className="metric-info">
              <span className="metric-label">Advances</span>
              <span className="metric-value">{advancesCount}</span>
            </div>
          </div>

          <div 
            className={`deck-metric-card unread ${filterType === 'read_history' ? 'active-metric' : ''}`}
            onClick={() => setFilterType('read_history')}
          >
            <div className="metric-icon-box">
              <Clock size={17} />
            </div>
            <div className="metric-info">
              <span className="metric-label">Viewed / Read</span>
              <span className="metric-value">{readHistoryCount}</span>
            </div>
          </div>
        </div>

        {/* Tier 3: Segmented Filters + Modern Search */}
        <div className="deck-bottom-bar">
          <div className="deck-filter-tabs">
            <button
              type="button"
              className={`deck-filter-tab ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              ⚡ Active Alerts <span className="deck-tab-count">{unreadCount}</span>
            </button>
            <button
              type="button"
              className={`deck-filter-tab ${filterType === 'new_task' ? 'active' : ''}`}
              onClick={() => setFilterType('new_task')}
            >
              📌 New Tasks <span className="deck-tab-count">{newTasksCount}</span>
            </button>
            <button
              type="button"
              className={`deck-filter-tab ${filterType === 'task_completed' ? 'active' : ''}`}
              onClick={() => setFilterType('task_completed')}
            >
              ✅ Done <span className="deck-tab-count">{completedTasksCount}</span>
            </button>
            <button
              type="button"
              className={`deck-filter-tab ${filterType === 'task_comment' ? 'active' : ''}`}
              onClick={() => setFilterType('task_comment')}
            >
              💬 Notes <span className="deck-tab-count">{commentsCount}</span>
            </button>
            <button
              type="button"
              className={`deck-filter-tab ${filterType === 'advance_request' ? 'active' : ''}`}
              onClick={() => setFilterType('advance_request')}
            >
              💸 Advances <span className="deck-tab-count">{advancesCount}</span>
            </button>
            <button
              type="button"
              className={`deck-filter-tab ${filterType === 'read_history' ? 'active' : ''}`}
              onClick={() => setFilterType('read_history')}
            >
              📁 Viewed / Read <span className="deck-tab-count">{readHistoryCount}</span>
            </button>
          </div>

          <div className="deck-search-wrap">
            <Search size={15} className="deck-search-icon" />
            <input
              type="text"
              className="deck-search-input"
              placeholder="Search staff, tasks, comments, advances..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* =========================================================================
          INDIVIDUAL NOTIFICATION CARDS (MY WORK DESK STYLE)
          ========================================================================= */}
      <div className="notifications-feed-list">
        {filteredNotifications.length === 0 ? (
          <div className="notif-empty-state-pro">
            <div className="notif-empty-icon-pro">
              <Bell size={24} />
            </div>
            <h3>No Notifications Found</h3>
            <p>
              {searchQuery
                ? `No activity match "${searchQuery}".`
                : filterType !== 'all'
                  ? `No notifications in this filter category.`
                  : `You're all caught up! Real-time staff tasks and ledger activities will appear here.`}
            </p>
          </div>
        ) : (
          filteredNotifications.map(notif => {
            const isUnread = !notif.isRead;
            const isCompleted = notif.type === 'task_completed';
            const isComment = notif.type === 'task_comment';
            const isAdvance = notif.type === 'advance_request';
            const staffInitial = (notif.staffName || 'S').charAt(0).toUpperCase();

            return (
              <div
                key={notif.id}
                className={`notif-task-row ${isUnread ? 'unread' : ''}`}
                onClick={() => onNotificationClick(notif)}
                title="Click to open in Active Task List"
              >
                {/* Left: Large Staff Profile Image */}
                <div className="notif-side-avatar-wrap">
                  {notif.staffImage ? (
                    <img 
                      src={notif.staffImage} 
                      alt={notif.staffName || 'Staff'} 
                      className="notif-side-avatar-img"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.notif-side-avatar-fallback') as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="notif-side-avatar-fallback"
                    style={{ display: notif.staffImage ? 'none' : 'flex' }}
                  >
                    {staffInitial}
                  </div>
                  <span className="notif-avatar-role-badge">
                    {isAdvance ? '💸' : isComment ? '💬' : isCompleted ? '✅' : '👤'}
                  </span>
                </div>

                {/* Right: Content details */}
                <div className="notif-side-content">
                  {/* Top Badges Row */}
                  <div className="notif-row-top">
                    <div className="notif-row-tags">
                      <span className={`badge ${
                        notif.type === 'new_task' ? 'badge-info' : 
                        notif.type === 'task_completed' ? 'badge-success' : 
                        notif.type === 'advance_request' ? 'badge-warning' : 
                        'badge-secondary'
                      }`} style={{ textTransform: 'capitalize' }}>
                        {notif.badge}
                      </span>
                      <span className="badge badge-secondary">
                        {formatTimeAgo(notif.timestamp)}
                      </span>
                      {isUnread && (
                        <span className="badge" style={{ 
                          background: 'rgba(239, 68, 68, 0.1)', 
                          color: '#ef4444',
                          fontWeight: 700
                        }}>
                          🔴 New / Unseen
                        </span>
                      )}
                    </div>
                    <span className={`badge ${isCompleted ? 'badge-success' : isComment ? 'badge-info' : isAdvance ? 'badge-warning' : 'badge-danger'}`} style={{ textTransform: 'uppercase' }}>
                      {isCompleted ? 'COMPLETED' : isComment ? 'NOTE' : isAdvance ? 'ADVANCE' : 'PENDING'}
                    </span>
                  </div>

                  {/* Middle Title */}
                  <p className="notif-row-title">
                    {notif.title}
                  </p>

                  {/* Remark (if present) */}
                  {notif.description && (
                    <p className="notif-row-desc">
                      {notif.description}
                    </p>
                  )}

                  {/* Footer Row */}
                  <div className="notif-row-footer">
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <span>👤 Activity by:</span>
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
                          {notif.staffImage ? (
                            <img src={notif.staffImage} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : null}
                          {notif.staffName || 'Staff Member'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button 
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          onNotificationClick(notif); 
                        }}
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        💬 View & Open ({notif.targetTab === 'tasks' ? 'Task' : notif.targetTab === 'advances' ? 'Ledger' : 'Notice'})
                      </button>

                      <button 
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          onToggleRead(notif.id); 
                        }}
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', fontSize: '0.76rem', color: isUnread ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                      >
                        {isUnread ? 'Mark Read' : 'Mark Unread'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
