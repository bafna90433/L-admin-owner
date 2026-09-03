import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Users,
  ArrowUpRight,
  TrendingUp,
  LogOut,
  CheckCircle,
  Bell,
  MessageSquare,
  Settings as SettingsIcon,
  History,
  Receipt,
  Loader,
  Trash2,
  Clock
} from 'lucide-react';

// Import Modular Page Components
import Login from './page/Login';
import Notifications, { type NotificationItem } from './page/Notifications';
import Dashboard from './page/Dashboard';
import Labourers from './page/Labourers';
import Advances from './page/Advances';
import Reminders from './page/Reminders';
import Tasks from './page/Tasks';
import Chat from './page/Chat';
import TaskDetailModal from './page/TaskDetailModal';
import Settings from './page/Settings';
import Profile from './page/Profile';
import AdvanceHistory from './page/AdvanceHistory';
import TransactionHistory from './page/TransactionHistory';
import DeletedLogs from './page/DeletedLogs';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://l-backend-production-ff32.up.railway.app/api';

interface User {
  id: string;
  _id?: string;
  username: string;
  name: string;
  role: string;
  whatsapp?: string;
  imageUrl?: string;
  upiId?: string;
}

interface Labour {
  _id: string;
  name: string;
  whatsapp: string;
  monthlySalary: number;
  imageUrl: string;
  status: string;
}

interface CashTx {
  _id: string;
  txType: 'received' | 'expense';
  category: string;
  amount: number;
  date: string;
  description: string;
  staffId?: {
    _id: string;
    name: string;
    username: string;
  };
}

interface AdvanceRequest {
  _id: string;
  labourId: {
    _id: string;
    name: string;
    imageUrl?: string;
    monthlySalary?: number;
    whatsapp?: string;
  };
  amount: number;
  deductedAmount?: number;
  date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy?: {
    _id?: string;
    name: string;
    username?: string;
    role?: string;
    upiId?: string;
  };
  approvedBy?: {
    _id?: string;
    name: string;
    username?: string;
    role?: string;
  };
}

// Synthesize loud urgent digital alarm WAV in-memory (No server or asset dependency)
function generateUrgentAlarmWav(): string {
  const sampleRate = 44100;
  const duration = 0.88; // 880ms total loop
  const totalSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + totalSamples * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, totalSamples * 2, true);

  // 2 piercing digital alarm beeps (0-140ms and 200-340ms)
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    const isBeep1 = t >= 0 && t < 0.14;
    const isBeep2 = t >= 0.20 && t < 0.34;
    if (isBeep1 || isBeep2) {
      const tone1 = Math.sin(2 * Math.PI * 960 * t);
      const tone2 = Math.sin(2 * Math.PI * 1920 * t);
      const tone3 = Math.sin(2 * Math.PI * 480 * t);
      sample = (tone1 * 0.50 + tone2 * 0.30 + tone3 * 0.20);
    }
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

// Multi-layered Alarm Sound Engine (HTML5 Audio Loop + Web Audio API Dual Tone Siren)
class AlarmSoundEngine {
  private audioCtx: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  public isRinging: boolean = false;
  private intervalId: any = null;
  private wavDataUrl: string | null = null;

  constructor() {
    try {
      this.wavDataUrl = generateUrgentAlarmWav();
    } catch (e) { }

    const unlock = () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass && !this.audioCtx) {
          this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
      } catch (e) {}
    };
    ['click', 'keydown', 'touchstart', 'mousemove', 'focus'].forEach(evt => {
      window.addEventListener(evt, unlock, { passive: true });
    });
  }

  start() {
    if (this.isRinging) return;
    this.isRinging = true;

    // 1. HTML5 Audio Loop (Piercing continuous digital alarm)
    try {
      if (!this.audioElement && this.wavDataUrl) {
        this.audioElement = new Audio(this.wavDataUrl);
        this.audioElement.loop = true;
        this.audioElement.volume = 1.0;
      }
      if (this.audioElement) {
        this.audioElement.currentTime = 0;
        const playPromise = this.audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => console.warn('Audio waiting for user gesture:', e));
        }
      }
    } catch (e) {
      console.error('HTML5 audio error:', e);
    }

    // 2. Web Audio API Dual-Tone Siren
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        if (!this.audioCtx) {
          this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }

        const playBeep = () => {
          if (!this.isRinging || !this.audioCtx) return;
          try {
            if (this.audioCtx.state === 'suspended') {
              this.audioCtx.resume().catch(() => {});
            }
            const osc1 = this.audioCtx.createOscillator();
            const osc2 = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(960, this.audioCtx.currentTime);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1920, this.audioCtx.currentTime);

            gain.gain.setValueAtTime(0.50, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.16);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc1.start(this.audioCtx.currentTime);
            osc2.start(this.audioCtx.currentTime);
            osc1.stop(this.audioCtx.currentTime + 0.16);
            osc2.stop(this.audioCtx.currentTime + 0.16);
          } catch (e) {}
        };

        playBeep();
        setTimeout(playBeep, 160);

        this.intervalId = setInterval(() => {
          if (!this.isRinging) return;
          playBeep();
          setTimeout(playBeep, 160);
        }, 850);
      }
    } catch (e) {
      console.error('Alarm WebAudio error:', e);
    }

    // Auto-resume audio immediately on any user gesture while ringing
    const onGestureWhileRinging = () => {
      if (!this.isRinging) return;
      if (this.audioElement && this.audioElement.paused) {
        this.audioElement.play().catch(() => {});
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    };
    ['click', 'keydown', 'touchstart', 'mousemove', 'focus'].forEach(evt => {
      window.addEventListener(evt, onGestureWhileRinging, { passive: true });
    });
  }

  stop() {
    this.isRinging = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}

const pcAlarmEngine = new AlarmSoundEngine();

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [user, setUser] = useState<User | null>(null);

  // Router Tab
  const adminValidTabs = ['notifications', 'dashboard', 'labourers', 'advances', 'advance-history', 'transaction-history', 'deleted-logs', 'reminders', 'tasks', 'chat', 'settings', 'profile'] as const;
  type AdminTabType = typeof adminValidTabs[number];
  const adminSavedTab = localStorage.getItem('admin_active_tab') as AdminTabType | null;
  const [activeTab, setActiveTab] = useState<AdminTabType>(adminSavedTab && adminValidTabs.includes(adminSavedTab) ? adminSavedTab : 'dashboard');
  const [targetTaskId, setTargetTaskId] = useState<string | null>(null);

  const navigateTo = (tab: AdminTabType) => {
    localStorage.setItem('admin_active_tab', tab);
    setActiveTab(tab);
    if (tab === 'notifications') {
      fetchTasks();
      fetchAdvances();
      fetchReminders();
    } else if (tab === 'reminders') {
      fetchReminders();
    } else if (tab === 'tasks') {
      fetchTasks();
    } else if (tab === 'advances') {
      fetchAdvances();
    } else if (tab === 'dashboard') {
      fetchReminders();
      fetchTasks();
      fetchAdvances();
    }
  };

  useEffect(() => {
    const createPremiumRipple = (event: PointerEvent) => {
      const source = event.target as HTMLElement | null;
      const interactive = source?.closest<HTMLElement>('button:not(:disabled), .nav-link, .profile-bottom-btn, [role="button"]');
      if (!interactive || !interactive.closest('.dashboard-layout')) return;

      const bounds = interactive.getBoundingClientRect();
      const size = Math.max(bounds.width, bounds.height) * 1.35;
      const ripple = document.createElement('span');
      ripple.className = 'premium-click-ripple';
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - bounds.left - size / 2}px`;
      ripple.style.top = `${event.clientY - bounds.top - size / 2}px`;

      interactive.querySelector('.premium-click-ripple')?.remove();
      interactive.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 650);
    };

    document.addEventListener('pointerdown', createPremiumRipple);
    return () => document.removeEventListener('pointerdown', createPremiumRipple);
  }, []);

  // Shared Data States
  const [labours, setLabours] = useState<Labour[]>([]);
  const [expenses, setExpenses] = useState<CashTx[]>([]);
  const [advances, setAdvances] = useState<AdvanceRequest[]>([]);

  const [reminders, setReminders] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [balanceData, setBalanceData] = useState({
    totalReceived: 0,
    totalSpent: 0,
    activeBalance: 0,
    onlineBalance: 0,
    handCashBalance: 0,
    categoryTotals: {} as Record<string, number>
  });
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Send Cash Modal States
  const [showCashModal, setShowCashModal] = useState(false);

  const [cashAmount, setCashAmount] = useState('');
  const [cashDesc, setCashDesc] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [cashSubmitting, setCashSubmitting] = useState(false);
  const [cashPaymentMode, setCashPaymentMode] = useState<'handcash' | 'online'>('handcash');

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'warning' | 'info' } | null>(null);

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Selected Task comments overlay
  const [selectedTaskForComments, setSelectedTaskForComments] = useState<any | null>(null);

  // Notification persistent read tracking state
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('officepro_read_notif_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const saveReadNotifIds = (newSet: Set<string>) => {
    setReadNotifIds(newSet);
    try {
      localStorage.setItem('officepro_read_notif_ids', JSON.stringify(Array.from(newSet)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleNotificationRead = (id: string) => {
    const next = new Set(readNotifIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    saveReadNotifIds(next);
  };

  const handleMarkAllNotificationsAsRead = () => {
    const allIds = new Set(readNotifIds);
    allNotifications.forEach(n => allIds.add(n.id));
    saveReadNotifIds(allIds);
    showToast('All notifications marked as read', 'success');
  };

  // Build aggregated notifications list from tasks, comments, advances, and reminders
  const allNotifications = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];

    const getAvatarUrl = (userOrStaffObj?: any, nameOrUsername?: string) => {
      if (userOrStaffObj?.imageUrl) {
        const url = userOrStaffObj.imageUrl;
        return url.startsWith('http') ? url : `${API_BASE}${url}`;
      }

      const targetKey = String(userOrStaffObj?._id || userOrStaffObj?.id || userOrStaffObj || nameOrUsername || '').trim().toLowerCase();
      if (!targetKey) return undefined;

      if (user) {
        const ownerId = String(user.id || user._id || '').toLowerCase();
        const ownerName = String(user.name || '').toLowerCase();
        const ownerUsername = String(user.username || '').toLowerCase();
        if (targetKey === ownerId || targetKey === ownerName || targetKey === ownerUsername || targetKey.includes('owner') || targetKey.includes('md') || targetKey.includes('admin')) {
          if (user.imageUrl) {
            return user.imageUrl.startsWith('http') ? user.imageUrl : `${API_BASE}${user.imageUrl}`;
          }
        }
      }

      const foundStaff = allStaff.find(s => {
        const sId = String(s.id || s._id || '').toLowerCase();
        const sName = String(s.name || '').toLowerCase();
        const sUsername = String(s.username || '').toLowerCase();
        return (targetKey && sId === targetKey) || (targetKey && sName === targetKey) || (targetKey && sUsername === targetKey) || (sName && sName.includes(targetKey)) || (targetKey && targetKey.includes(sName));
      });

      if (foundStaff?.imageUrl) {
        return foundStaff.imageUrl.startsWith('http') ? foundStaff.imageUrl : `${API_BASE}${foundStaff.imageUrl}`;
      }

      const foundLabour = labours.find(l => {
        const lId = String(l._id || '').toLowerCase();
        const lName = String(l.name || '').toLowerCase();
        return (targetKey && lId === targetKey) || (targetKey && lName === targetKey) || (lName && lName.includes(targetKey)) || (targetKey && targetKey.includes(lName));
      });

      if (foundLabour?.imageUrl) {
        return foundLabour.imageUrl.startsWith('http') ? foundLabour.imageUrl : `${API_BASE}${foundLabour.imageUrl}`;
      }

      return undefined;
    };

    // 1. Tasks: New tasks logged by staff, completed tasks, staff comments, follow-ups
    tasks.forEach(t => {
      const taskId = String(t._id);
      const isMDTask = t.createdByRole === 'owner' || t.taskType === 'reminder-sir';
      const staffName = t.assignedTo?.name || t.createdBy?.name || 'Staff';
      const staffImage = getAvatarUrl(t.assignedTo || t.createdBy, staffName);
      const cleanDesc = (t.description || '').replace(/\[lang:(en|hi|ta)\]\s*/g, '').trim();

      // Event A: New task logged by staff (EXCLUDE MD's own assigned tasks)
      if (!isMDTask) {
        list.push({
          id: `notif_task_new_${taskId}`,
          type: 'new_task',
          title: `📌 New Task: ${t.title}`,
          description: `Assigned to ${staffName}${cleanDesc ? ` • ${cleanDesc}` : ''}`,
          timestamp: t.createdAt || new Date(),
          taskId: taskId,
          staffName: staffName,
          staffImage: staffImage,
          badge: 'New Task',
          badgeColor: 'warning',
          targetTab: 'tasks',
          action: 'open_task',
          isRead: readNotifIds.has(`notif_task_new_${taskId}`) || !!t.seenByOwner
        });
      }

      // Event B: Task completed by staff
      if (t.status === 'completed') {
        const compByName = t.completedBy?.name || staffName;
        const compImage = getAvatarUrl(t.completedBy, compByName) || staffImage;
        list.push({
          id: `notif_task_comp_${taskId}`,
          type: 'task_completed',
          title: `✅ Completed: ${t.title}`,
          description: `Completed by ${compByName}${t.remarks ? ` • Remarks: ${t.remarks}` : ''}`,
          timestamp: t.completedAt || t.createdAt || new Date(),
          taskId: taskId,
          staffName: compByName,
          staffImage: compImage,
          badge: 'Completed',
          badgeColor: 'success',
          targetTab: 'tasks',
          action: 'open_task',
          isRead: readNotifIds.has(`notif_task_comp_${taskId}`) || !!t.seenByOwner
        });
      }

      // Event C: Comments & discussion notes (ONLY from staff, exclude MD/Owner comments)
      if (Array.isArray(t.comments) && t.comments.length > 0) {
        t.comments.forEach((c: any, cIdx: number) => {
          const isMDComment = c.authorRole === 'owner' || 
                              c.authorRole === 'admin' || 
                              (c.authorName && (
                                c.authorName.toLowerCase().includes('owner') || 
                                c.authorName.toLowerCase().includes('director') || 
                                c.authorName.toLowerCase().includes('sir') || 
                                c.authorName.toLowerCase().includes('md')
                              ));
          
          // Exclude MD's own comments from MD's feed!
          if (isMDComment) return;

          const commentId = `notif_task_comment_${taskId}_${c._id || cIdx || c.createdAt}`;
          const authorImage = getAvatarUrl(undefined, c.authorName);
          list.push({
            id: commentId,
            type: 'task_comment',
            title: `💬 Staff Note on: ${t.title}`,
            description: `${c.authorName || 'Staff'}: "${c.text}"`,
            timestamp: c.createdAt || t.createdAt || new Date(),
            taskId: taskId,
            staffName: c.authorName || staffName,
            staffImage: authorImage,
            badge: 'Task Note',
            badgeColor: 'info',
            targetTab: 'tasks',
            action: 'open_comments',
            isRead: readNotifIds.has(commentId)
          });
        });
      }

      // Event D: Follow-up details updated by staff (only if task is staff-managed)
      if (!isMDTask && (t.remarks || t.nextFollowup)) {
        const updateId = `notif_task_update_${taskId}_${t.nextFollowup || ''}`;
        list.push({
          id: updateId,
          type: 'task_update',
          title: `📝 Follow-up: ${t.title}`,
          description: `${t.remarks ? `Remarks: ${t.remarks}` : ''}${t.nextFollowup ? ` • Next: ${t.nextFollowup}` : ''}`.trim(),
          timestamp: t.updatedAt || t.createdAt || new Date(),
          taskId: taskId,
          staffName: staffName,
          staffImage: staffImage,
          badge: 'Follow-up',
          badgeColor: 'primary',
          targetTab: 'tasks',
          action: 'open_task',
          isRead: readNotifIds.has(updateId)
        });
      }
    });

    // 2. Advance Requests from Staff
    advances.forEach(a => {
      const advId = String(a._id);
      const notifId = `notif_advance_${advId}`;
      const requesterName = a.requestedBy?.name || 'Staff';
      const labourName = a.labourId?.name || 'Labourer';
      const advImage = getAvatarUrl(a.labourId, labourName) || getAvatarUrl(a.requestedBy, requesterName);
      list.push({
        id: notifId,
        type: 'advance_request',
        title: `💸 Advance Request: ₹${a.amount.toLocaleString('en-IN')} for ${labourName}`,
        description: `Requested by ${requesterName}${a.reason ? ` • Reason: ${a.reason}` : ''} • Status: ${a.status.toUpperCase()}`,
        timestamp: a.date || new Date(),
        advanceId: advId,
        staffName: requesterName,
        staffImage: advImage,
        badge: a.status === 'pending' ? 'Pending Advance' : `Advance ${a.status}`,
        badgeColor: a.status === 'pending' ? 'danger' : 'secondary',
        targetTab: 'advances',
        action: 'open_advance',
        isRead: readNotifIds.has(notifId)
      });
    });

    // 3. Staff Reminders (Only include staff self-reminders or staff alarms)
    reminders.forEach(r => {
      const isMDNotice = r.type !== 'self' && r.createdByRole === 'owner';
      // Exclude MD's own broadcast notices from MD Panel
      if (isMDNotice) return;

      const remId = String(r._id);
      const notifId = `notif_reminder_${remId}`;
      const staffName = r.createdBy?.name || 'Staff';
      list.push({
        id: notifId,
        type: 'reminder',
        title: `🔔 Staff Reminder: ${r.message}`,
        description: `Staff: ${staffName} • Target: ${new Date(r.targetDate).toLocaleDateString('en-GB')}`,
        timestamp: r.createdAt || new Date(),
        reminderId: remId,
        staffName: staffName,
        staffImage: getAvatarUrl(r.createdBy, staffName),
        badge: 'Staff Reminder',
        badgeColor: 'purple',
        targetTab: 'reminders',
        isRead: readNotifIds.has(notifId)
      });
    });

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [tasks, advances, reminders, readNotifIds]);

  const unreadNotificationCount = allNotifications.filter(n => !n.isRead).length;

  const handleNotificationClick = (notif: NotificationItem) => {
    // Mark as read immediately
    const next = new Set(readNotifIds);
    next.add(notif.id);
    saveReadNotifIds(next);

    // If task notification, mark seen on server
    if (notif.taskId) {
      fetch(`${API_BASE}/tasks/${notif.taskId}/seen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }).then(() => fetchTasks()).catch(() => {});
    }

    // Redirect to Active Task List (or other specific tab)
    if (notif.targetTab === 'tasks' || notif.taskId) {
      if (notif.taskId) {
        setTargetTaskId(notif.taskId);
        if (notif.action === 'open_comments') {
          const targetTask = tasks.find(t => String(t._id) === String(notif.taskId));
          if (targetTask) {
            setSelectedTaskForComments(targetTask);
          }
        }
      }
      navigateTo('tasks');
    } else if (notif.targetTab === 'advances') {
      navigateTo('advances');
    } else if (notif.targetTab === 'reminders') {
      navigateTo('reminders');
    } else {
      navigateTo('tasks');
    }
  };

  const showToast = useCallback((message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  // Fetch current user if token exists
  useEffect(() => {
    if (token) {
      fetchUser();
    }
  }, [token]);

  useEffect(() => {
    if (user && user.role === 'owner') {
      fetchDashboardData();
      fetchLabours();
      fetchAdvances();
      fetchStaffUsers();
      fetchReminders();
      fetchTasks();
    }
  }, [user]);

  // Fetch tasks on activeTab change
  useEffect(() => {
    if (user && user.role === 'owner' && activeTab === 'tasks') {
      fetchTasks();
    }
  }, [activeTab, user]);

  // Initialize selected staff ID if list changes
  useEffect(() => {
    if (allStaff.length > 0 && !selectedStaffId) {
      setSelectedStaffId(allStaff[0].id || allStaff[0]._id || '');
    }
  }, [allStaff, selectedStaffId]);

  const handleGiveCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashAmount || !selectedStaffId) return;
    setCashSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/expenses/cash-received`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(cashAmount),
          date: new Date(),
          description: cashDesc || 'Cash handed over to office staff',
          staffId: selectedStaffId,
          paymentMode: cashPaymentMode
        })
      });

      if (res.ok) {
        setShowCashModal(false);
        setCashAmount('');
        setCashDesc('');
        setCashPaymentMode('handcash');
        fetchDashboardData();
        showToast('Cash transferred to staff successfully!', 'success');
      } else {
        showToast('Failed to send cash', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setCashSubmitting(false);
    }
  };

  // Poll chat unread counts in background
  useEffect(() => {
    if (!token) return;
    fetchUnreadCounts();
    const interval = setInterval(() => {
      fetchUnreadCounts();
    }, 4000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user.role !== 'owner') {
          showToast('Access denied: Owners only.', 'danger');
          handleLogout();
        } else {
          setUser(data.user);
        }
      } else {
        handleLogout();
      }
    } catch (err) {
      handleLogout();
    }
  };

  const handleLoginSuccess = (newToken: string, newUser: any) => {
    localStorage.setItem('admin_token', newToken);
    setToken(newToken);
    setUser(newUser);
    showToast('Logged in successfully!', 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_active_tab');
    setToken(null);
    setUser(null);
    setActiveTab('dashboard');
  };

  const fetchDashboardData = async () => {
    try {
      // Balance data
      const balRes = await fetch(`${API_BASE}/expenses/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (balRes.ok) {
        const data = await balRes.json();
        setBalanceData(data);
      }

      // Recent Transactions
      const txRes = await fetch(`${API_BASE}/expenses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (txRes.ok) {
        const data = await txRes.json();
        setExpenses(data.slice(0, 15)); // Get top 15
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLabours = async () => {
    try {
      const res = await fetch(`${API_BASE}/labours`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLabours(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdvances = async () => {
    try {
      const res = await fetch(`${API_BASE}/advances`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdvances(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReminders = async () => {
    try {
      const res = await fetch(`${API_BASE}/reminders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReminders(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Loud multi-tone chime synthesizer for staff activity & task alerts
  const playLoudNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

        gain.gain.setValueAtTime(0.01, ctx.currentTime + startTime);
        gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
      };

      // Crisp ascending alert chime
      playTone(523.25, 0.0, 0.35);  // C5
      playTone(659.25, 0.15, 0.35); // E5
      playTone(783.99, 0.30, 0.35); // G5
      playTone(1046.5, 0.45, 0.7);  // C6
    } catch (err) {
      console.error('Audio error:', err);
    }
  };

  // Browser Autoplay Audio Unlocker
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const dummyCtx = new AudioContextClass();
          if (dummyCtx.state === 'suspended') {
            dummyCtx.resume();
          }
        }
        if ('speechSynthesis' in window) {
          window.speechSynthesis.resume();
        }
      } catch (e) {
        console.error('Audio unlock error:', e);
      }
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
    window.addEventListener('mousemove', unlockAudio, { once: true });
    window.addEventListener('focus', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('mousemove', unlockAudio);
      window.removeEventListener('focus', unlockAudio);
    };
  }, []);

  const triggerDesktopPushNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body: body,
          tag: title + body,
          requireInteraction: true
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (e) {
        console.error('Notification error:', e);
      }
    }
  };

  const speechQueueRef = useRef<{ text: string; lang: 'en' | 'hi' | 'ta' }[]>([]);
  const isSpeakingRef = useRef(false);

  const getMaleVoice = (lang: string) => {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    const isFemale = (name: string) => /zira|jenny|aria|ava|samantha|victoria|karen|female|woman|neerja|susan|catherine|hazel|heera|ayumi|haruka|yating|zhiyu/i.test(name);

    // Strict priority for verified male voices
    const maleVoice = voices.find(v =>
      !isFemale(v.name) &&
      (v.name.toLowerCase().includes('david') ||
        v.name.toLowerCase().includes('mark') ||
        v.name.toLowerCase().includes('george') ||
        v.name.toLowerCase().includes('male') ||
        v.name.toLowerCase().includes('guy') ||
        v.name.toLowerCase().includes('madhur') ||
        v.name.toLowerCase().includes('valluvar') ||
        v.name.toLowerCase().includes('andrew') ||
        v.name.toLowerCase().includes('brian')) &&
      (lang ? v.lang.startsWith(lang) : true)
    );
    if (maleVoice) return maleVoice;

    // Fallback: any voice that is NOT explicitly female
    const nonFemale = voices.find(v => !isFemale(v.name) && (lang ? v.lang.startsWith(lang) : true));
    return nonFemale || null;
  };

  const speakWebSpeech = (textToSpeak: string, lang: 'en' | 'hi' | 'ta', onDone: () => void) => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = lang === 'hi' ? 'hi-IN' : (lang === 'ta' ? 'ta-IN' : 'en-US');
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.onend = () => onDone();
        utterance.onerror = () => onDone();

        const voice = getMaleVoice(utterance.lang.slice(0, 2));
        if (voice) utterance.voice = voice;

        window.speechSynthesis.speak(utterance);
        setTimeout(onDone, 7000);
      } catch (err) {
        console.error('Speech synthesis error:', err);
        onDone();
      }
    } else {
      onDone();
    }
  };

  const playSingleAnnouncement = (textToSpeak: string, langOverride?: 'en' | 'hi' | 'ta'): Promise<void> => {
    return new Promise(async (resolve) => {
      const activeLang = langOverride || announcementLang || 'en';
      let resolved = false;
      const safeResolve = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      try {
        const cleanText = (textToSpeak || '').replace(/[^\w\s\u0900-\u097F\u0B80-\u0BFF]/gi, '');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(`${API_BASE}/ai/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            text: cleanText,
            lang: activeLang
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.audioContent) {
            const mimeType = data.mimeType || 'audio/mp3';
            if (mimeType.includes('pcm') || mimeType.includes('raw')) {
              const binaryString = atob(data.audioContent);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
              const int16Array = new Int16Array(bytes.buffer);
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              const audioCtx = new AudioContextClass({ sampleRate: 24000 });
              if (audioCtx.state === 'suspended') audioCtx.resume();
              const buffer = audioCtx.createBuffer(1, int16Array.length, 24000);
              const channelData = buffer.getChannelData(0);
              for (let i = 0; i < int16Array.length; i++) channelData[i] = int16Array[i] / 32768.0;
              const source = audioCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(audioCtx.destination);
              source.onended = () => safeResolve();
              source.start();
              setTimeout(safeResolve, 8000);
              return;
            } else {
              const audio = new Audio(`data:${mimeType};base64,${data.audioContent}`);
              audio.volume = 1.0;
              audio.onended = () => safeResolve();
              audio.onerror = () => safeResolve();
              const playPromise = audio.play();
              if (playPromise !== undefined) {
                playPromise.catch(() => {
                  speakWebSpeech(textToSpeak, activeLang, safeResolve);
                });
              }
              setTimeout(safeResolve, 8000);
              return;
            }
          }
        }
      } catch (err) {
        // Fall through to Web Speech
      }

      speakWebSpeech(textToSpeak, activeLang, safeResolve);
    });
  };

  const processSpeechQueue = async () => {
    if (isSpeakingRef.current || speechQueueRef.current.length === 0) return;
    isSpeakingRef.current = true;

    while (speechQueueRef.current.length > 0) {
      const item = speechQueueRef.current.shift();
      if (item) {
        await playSingleAnnouncement(item.text, item.lang);
        await new Promise(r => setTimeout(r, 450));
      }
    }

    isSpeakingRef.current = false;
  };

  const speakOwnerAnnouncement = (textToSpeak: string, langOverride?: 'en' | 'hi' | 'ta') => {
    const activeLang = langOverride || announcementLang || 'en';
    if (speechQueueRef.current.length >= 3) {
      speechQueueRef.current = speechQueueRef.current.slice(-2);
    }
    speechQueueRef.current.push({ text: textToSpeak, lang: activeLang });
    processSpeechQueue();
  };

  // Voice Announcement Language State ('en' | 'hi' | 'ta') - Default English
  const [announcementLang] = useState<'en' | 'hi' | 'ta'>(() => {
    return (localStorage.getItem('officepro_voice_lang') as any) || 'en';
  });

  useEffect(() => {
    if (token && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    // Pre-unlock speech synthesis audio on user click or key press
    const unlockAudio = () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
        const silentUtterance = new SpeechSynthesisUtterance('');
        silentUtterance.volume = 0;
        window.speechSynthesis.speak(silentUtterance);
      }
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [token]);

  const getOwnerAnnouncementText = (
    type: 'new_task' | 'task_completed' | 'task_updated' | 'task_comment',
    params: { staffName: string; title: string; commentText?: string },
    lang: 'en' | 'hi' | 'ta' = 'en'
  ) => {
    const { staffName } = params;
    if (lang === 'hi') {
      if (type === 'new_task') return `Notification: ${staffName} ji ne naya task add kiya hai.`;
      if (type === 'task_completed') return `Notification: ${staffName} ji ne kaam complete kiya.`;
      if (type === 'task_comment') return `Notification: ${staffName} ji ka naya message.`;
      return `Notification: ${staffName} ji ka follow-up update.`;
    }
    if (lang === 'ta') {
      if (type === 'new_task') return `Notification: ${staffName} pudhiya task.`;
      if (type === 'task_completed') return `Notification: ${staffName} velai mudithaar.`;
      if (type === 'task_comment') return `Notification from ${staffName}.`;
      return `Notification: ${staffName} follow-up update.`;
    }
    // Default English - Short, Crisp Notification for MD
    if (type === 'new_task') return `Notification: New task from ${staffName}.`;
    if (type === 'task_completed') return `Notification: Task completed by ${staffName}.`;
    if (type === 'task_comment') return `Notification from ${staffName}.`;
    return `Notification: Update from ${staffName}.`;
  };

  const isInitialOwnerTaskFetchRef = useRef(true);
  const knownTaskMapRef = useRef<Map<string, {
    status: string;
    remarks: string;
    nextFollowup: string;
    description: string;
    commentsCount: number;
  }>>(new Map());
  const mdCreatedTaskIdsRef = useRef<Set<string>>(new Set());

  const registerMDTaskLocally = (taskId: string) => {
    if (!taskId) return;
    mdCreatedTaskIdsRef.current.add(String(taskId));
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();

        if (isInitialOwnerTaskFetchRef.current) {
          data.forEach((t: any) => {
            knownTaskMapRef.current.set(String(t._id), {
              status: t.status || 'pending',
              remarks: String(t.remarks || '').trim(),
              nextFollowup: String(t.nextFollowup || '').trim(),
              description: String(t.description || '').trim(),
              commentsCount: Array.isArray(t.comments) ? t.comments.length : 0
            });
          });
          isInitialOwnerTaskFetchRef.current = false;
        } else {
          let chimePlayedInBatch = false;
          const pendingAnnouncements: { text: string; lang: 'en' | 'hi' | 'ta' }[] = [];

          data.forEach((t: any) => {
            const taskId = String(t._id);
            const prev = knownTaskMapRef.current.get(taskId);
            const staffName = t.assignedTo?.name || t.createdBy?.name || 'Staff';
            const currentCommentsCount = Array.isArray(t.comments) ? t.comments.length : 0;
            const currentRemarks = String(t.remarks || '').trim();
            const currentNextFollowup = String(t.nextFollowup || '').trim();
            const currentDescription = String(t.description || '').trim();

            const currentOwnerId = user?._id || user?.id || '';
            const isCreatedByMD = mdCreatedTaskIdsRef.current.has(taskId) ||
              (t.createdBy?._id && String(t.createdBy._id) === String(currentOwnerId)) ||
              (t.createdBy?.id && String(t.createdBy.id) === String(currentOwnerId)) ||
              (typeof t.createdBy === 'string' && String(t.createdBy) === String(currentOwnerId)) ||
              t.createdByRole === 'owner' ||
              t.createdBy?.role === 'owner' ||
              t.taskType === 'reminder-sir';

            const taskLangMatch = t.description?.match(/\[lang:(en|hi|ta)\]/);
            const taskLang = ((t as any).language || (taskLangMatch ? taskLangMatch[1] : announcementLang) || 'en') as 'en' | 'hi' | 'ta';

            // Event 1: New task logged by Staff
            if (!prev) {
              knownTaskMapRef.current.set(taskId, {
                status: t.status || 'pending',
                remarks: currentRemarks,
                nextFollowup: currentNextFollowup,
                description: currentDescription,
                commentsCount: currentCommentsCount
              });

              // If MD created it -> SILENT. If Staff created it -> Announce to MD!
              if (!isCreatedByMD) {
                if (!chimePlayedInBatch) {
                  playLoudNotificationSound();
                  chimePlayedInBatch = true;
                }
                showToast(`📌 New Work Logged by ${staffName}: "${t.title}"`, 'warning');
                triggerDesktopPushNotification(`📌 New Work by ${staffName}!`, t.title);
                const announceText = getOwnerAnnouncementText('new_task', { staffName, title: t.title }, taskLang);
                pendingAnnouncements.push({ text: announceText, lang: taskLang });
              }
            } else {
              // Event 2: Task completed by Staff
              if (prev.status !== 'completed' && t.status === 'completed') {
                knownTaskMapRef.current.set(taskId, {
                  status: t.status,
                  remarks: currentRemarks,
                  nextFollowup: currentNextFollowup,
                  description: currentDescription,
                  commentsCount: currentCommentsCount
                });
                const completedByName = t.completedBy?.name || staffName;
                if (!chimePlayedInBatch) {
                  playLoudNotificationSound();
                  chimePlayedInBatch = true;
                }
                showToast(`✅ Work Completed by ${completedByName}: "${t.title}"`, 'success');
                triggerDesktopPushNotification(`✅ Work Completed by ${completedByName}!`, t.title);
                const announceText = getOwnerAnnouncementText('task_completed', { staffName: completedByName, title: t.title }, taskLang);
                pendingAnnouncements.push({ text: announceText, lang: taskLang });
              }
              // Event 3: Staff posted a new comment / discussion note
              else if (currentCommentsCount > prev.commentsCount) {
                knownTaskMapRef.current.set(taskId, {
                  status: t.status,
                  remarks: currentRemarks,
                  nextFollowup: currentNextFollowup,
                  description: currentDescription,
                  commentsCount: currentCommentsCount
                });

                // Check who sent the new comment(s) - EXCLUDE MD/Owner comments from announcing back to MD!
                const newComments = Array.isArray(t.comments) ? t.comments.slice(prev.commentsCount) : [];
                const staffComments = newComments.filter((c: any) => {
                  const isMD = c.authorRole === 'owner' || 
                               c.authorRole === 'admin' || 
                               (c.authorName && (
                                 c.authorName.toLowerCase().includes('owner') || 
                                 c.authorName.toLowerCase().includes('director') || 
                                 c.authorName.toLowerCase().includes('sir') || 
                                 c.authorName.toLowerCase().includes('md')
                               ));
                  return !isMD;
                });

                if (staffComments.length > 0) {
                  const latestStaffComment = staffComments[staffComments.length - 1];
                  const commenterName = latestStaffComment.authorName || staffName;
                  if (!chimePlayedInBatch) {
                    playLoudNotificationSound();
                    chimePlayedInBatch = true;
                  }
                  showToast(`💬 New update note from ${commenterName}: "${t.title}"`, 'info');
                  triggerDesktopPushNotification(`💬 New Note from ${commenterName}!`, latestStaffComment.text || t.title);
                  const announceText = getOwnerAnnouncementText('task_comment', { staffName: commenterName, title: t.title, commentText: latestStaffComment.text }, taskLang);
                  pendingAnnouncements.push({ text: announceText, lang: taskLang });
                }
              }
              // Event 4: Staff updated remarks, follow-up date, or description
              else if (
                prev.nextFollowup !== currentNextFollowup ||
                prev.remarks !== currentRemarks ||
                prev.description !== currentDescription
              ) {
                knownTaskMapRef.current.set(taskId, {
                  status: t.status,
                  remarks: currentRemarks,
                  nextFollowup: currentNextFollowup,
                  description: currentDescription,
                  commentsCount: currentCommentsCount
                });
                if (!chimePlayedInBatch) {
                  playLoudNotificationSound();
                  chimePlayedInBatch = true;
                }
                showToast(`📝 Follow-up details updated by ${staffName}: "${t.title}"`, 'info');
                triggerDesktopPushNotification(`📝 Follow-up Updated by ${staffName}!`, t.title);
                const announceText = getOwnerAnnouncementText('task_updated', { staffName, title: t.title }, taskLang);
                pendingAnnouncements.push({ text: announceText, lang: taskLang });
              }
            }
          });

          // Smart Batch Announcement Delivery:
          if (pendingAnnouncements.length > 2) {
            let batchSummary = `Hello Sir, you have ${pendingAnnouncements.length} new task updates from your staff.`;
            if (announcementLang === 'hi') {
              batchSummary = `Namaste Sir! Aapke staff se ${pendingAnnouncements.length} naye task updates aaye hain.`;
            } else if (announcementLang === 'ta') {
              batchSummary = `Vanakkam Sir! Ungal paniyaalargalidamirundhu ${pendingAnnouncements.length} pudhiya velaip pathivugal vandhullaana.`;
            }
            speakOwnerAnnouncement(batchSummary, announcementLang);
          } else {
            pendingAnnouncements.forEach(a => speakOwnerAnnouncement(a.text, a.lang));
          }
        }

        setTasks(data);
        // If comments modal is open, update comments inside it
        if (selectedTaskForComments) {
          const updated = data.find((t: any) => t._id === selectedTaskForComments._id);
          if (updated) {
            setSelectedTaskForComments(updated);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Active Alarm State for MD Panel
  const [activeAlarmReminder, setActiveAlarmReminder] = useState<{
    id: string;
    alarmKey?: string;
    title: string;
    targetDate?: string;
    staffName?: string;
    language?: string;
    isTask?: boolean;
    taskData?: any;
  } | null>(null);

  const triggeredAlarmKeysRef = useRef<Set<string>>(new Set());
  const snoozedAlarmMapRef = useRef<Map<string, number>>(new Map());

  const getStoppedAlarmKeys = (): Set<string> => {
    try {
      const stored = localStorage.getItem('officepro_md_stopped_alarm_keys');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const markAlarmStoppedLocally = (alarmKey: string) => {
    try {
      const set = getStoppedAlarmKeys();
      set.add(alarmKey);
      const arr = Array.from(set).slice(-150);
      localStorage.setItem('officepro_md_stopped_alarm_keys', JSON.stringify(arr));
    } catch {}
  };

  const speakAlarmVoice = async (staffName: string, reminderMessage: string, lang?: string, isTask: boolean = false) => {
    const chosenLang = (lang || announcementLang || 'en') as 'en' | 'hi' | 'ta';
    const cleanMsg = (reminderMessage || '').replace(/\[lang:(en|hi|ta)\]\s*/g, '').replace(/[^\w\s\u0900-\u097F\u0B80-\u0BFF]/gi, '');
    const senderTag = staffName && staffName !== 'Staff' ? ` with ${staffName}` : '';
    
    let textToSpeak = `Managing Director Sir! Scheduled ${isTask ? 'Task' : ''} Reminder Alert${senderTag}: ${cleanMsg}.`;
    if (chosenLang === 'hi') {
      textToSpeak = `Namaste Managing Director Sir! ${staffName ? `${staffName} ji ka ` : ''}${isTask ? 'Task ' : ''}Zaroori Reminder Alert: ${cleanMsg}.`;
    } else if (chosenLang === 'ta') {
      textToSpeak = `Vanakkam Managing Director Sir! ${staffName ? `${staffName} ` : ''}Mukkiya ninaivuttal: ${cleanMsg}.`;
    }

    speakOwnerAnnouncement(textToSpeak, chosenLang);
  };

  // Check reminders and tasks every 2 seconds to trigger MD PC Alarm
  useEffect(() => {
    if (!token || !user || user.role !== 'owner') return;

    const checkRemindersForAlarm = () => {
      const now = Date.now();
      const stoppedKeys = getStoppedAlarmKeys();

      // 1. Check Broadcast Notices / Reminders
      if (reminders && reminders.length > 0) {
        reminders.forEach((r: any) => {
          if (!r.targetDate || r.status === 'completed') return;

          const isBroadcastNotice = r.type !== 'self';
          if (isBroadcastNotice && r.status !== 'acknowledged') {
            return;
          }

          const targetTime = new Date(r.targetDate).getTime();
          if (isNaN(targetTime)) return;

          const alarmKey = `${r._id}_${targetTime}`;
          if (stoppedKeys.has(alarmKey)) return;

          const isSnoozed = snoozedAlarmMapRef.current.has(alarmKey) && now < snoozedAlarmMapRef.current.get(alarmKey)!;
          const isAlreadyTriggered = triggeredAlarmKeysRef.current.has(alarmKey);

          if (targetTime <= now && !isSnoozed && !isAlreadyTriggered && !activeAlarmReminder) {
            // Ring Continuous Loud Alarm in MD Panel!
            pcAlarmEngine.start();
            const cleanMsg = (r.message || '').replace(/\[lang:(en|hi|ta)\]\s*/g, '');
            const staffLabel = r.targetStaffId?.name || r.acknowledgedBy?.name || 'Staff';
            
            setActiveAlarmReminder({
              id: r._id,
              alarmKey: alarmKey,
              title: cleanMsg,
              targetDate: r.targetDate,
              staffName: staffLabel,
              language: r.language,
              isTask: false
            });

            speakAlarmVoice(staffLabel, cleanMsg, r.language, false);
            triggerDesktopPushNotification('⏰ REMINDER ALARM RINGING!', cleanMsg);
            showToast(`⏰ REMINDER ALARM RINGING: ${cleanMsg}`, 'danger');
          }
        });
      }

      // 2. Check Tasks with Scheduled Reminders
      if (tasks && tasks.length > 0) {
        tasks.forEach((t: any) => {
          if (!t.reminderDateTime || t.status === 'completed' || t.reminderAlarmArmed === false) return;

          const targetTime = new Date(t.reminderDateTime).getTime();
          if (isNaN(targetTime)) return;

          const alarmKey = `${t._id}_${targetTime}`;
          if (stoppedKeys.has(alarmKey)) return;

          const isSnoozed = snoozedAlarmMapRef.current.has(alarmKey) && now < snoozedAlarmMapRef.current.get(alarmKey)!;
          const isAlreadyTriggered = triggeredAlarmKeysRef.current.has(alarmKey);

          if (targetTime <= now && !isSnoozed && !isAlreadyTriggered && !activeAlarmReminder) {
            // Ring Continuous Loud Alarm in MD Panel!
            pcAlarmEngine.start();
            const staffLabel = t.assignedTo?.name || 'All Office Staff';
            
            setActiveAlarmReminder({
              id: t._id,
              alarmKey: alarmKey,
              title: t.title,
              targetDate: t.reminderDateTime,
              staffName: staffLabel,
              language: t.language,
              isTask: true,
              taskData: t
            });

            speakAlarmVoice(staffLabel, t.title, t.language, true);
            triggerDesktopPushNotification('⏰ TASK REMINDER ALARM!', `${t.title} (Assigned to: ${staffLabel})`);
            showToast(`⏰ TASK REMINDER ALARM: ${t.title}`, 'danger');
          }
        });
      }
    };

    checkRemindersForAlarm();
    const interval = setInterval(checkRemindersForAlarm, 2000);
    return () => clearInterval(interval);
  }, [token, user, reminders, tasks, activeAlarmReminder]);

  // Poll reminders every 3.5 seconds in background so MD gets updated target dates from staff in real time
  useEffect(() => {
    if (!token || !user || user.role !== 'owner') return;
    fetchReminders();
    const interval = setInterval(fetchReminders, 3500);
    return () => clearInterval(interval);
  }, [token, user]);

  // Poll tasks every 2.5 seconds in background for real-time sound & voice notifications
  useEffect(() => {
    if (!token || !user || user.role !== 'owner') return;
    fetchTasks();
    const interval = setInterval(fetchTasks, 2500);
    return () => clearInterval(interval);
  }, [token, user]);

  const fetchUnreadCounts = async () => {
    if (!token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [directRes, groupRes] = await Promise.all([
        fetch(`${API_BASE}/messages/unread/count`, { headers }),
        fetch(`${API_BASE}/chat/groups`, { headers })
      ]);

      const directCounts: Record<string, number> = directRes.ok ? await directRes.json() : {};
      const groups = groupRes.ok ? await groupRes.json() : [];
      const groupCounts = Array.isArray(groups)
        ? groups.reduce((counts: Record<string, number>, group: any) => {
          const unread = Number(group?.unreadCount || 0);
          if (unread > 0) counts[`group:${group.id}`] = unread;
          return counts;
        }, {})
        : {};

      setUnreadCounts({ ...directCounts, ...groupCounts });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStaffUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/staff`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setAllStaff(data.map((s: any) => ({
            id: s._id,
            username: s.username,
            name: s.name,
            role: s.role || 'staff',
            whatsapp: s.whatsapp || '',
            imageUrl: s.imageUrl || ''
          })));
          return;
        }
      }

      // Fallback: build staff from expenses database
      const expRes = await fetch(`${API_BASE}/expenses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (expRes.ok) {
        const txs: CashTx[] = await expRes.json();
        const staffMap = new Map();
        txs.forEach(t => {
          if (t.staffId) {
            staffMap.set(t.staffId._id, t.staffId);
          }
        });
        const list = Array.from(staffMap.values());
        if (list.length > 0) {
          setAllStaff(list.map(s => ({ id: s._id, username: s.username, name: s.name, role: 'staff' })));
          return;
        }
      }

      // Secondary fallback
      setAllStaff([{ id: 'mock_staff_id', username: 'staff', name: 'Office Staff', role: 'staff' }]);
    } catch (err) {
      console.error('Error fetching staff:', err);
    }
  };


  if (!token) {
    return <Login apiBase={API_BASE} onLoginSuccess={handleLoginSuccess} />;
  }

  const totalUnreadMessages = Object.values(unreadCounts).reduce((sum: number, val: number) => sum + val, 0);

  const renderContent = () => {
    switch (activeTab) {
      case 'notifications':
        return (
          <Notifications
            notifications={allNotifications}
            onNotificationClick={handleNotificationClick}
            onMarkAllAsRead={handleMarkAllNotificationsAsRead}
            onToggleRead={handleToggleNotificationRead}
            onClearHistory={() => {
              setReadNotifIds(new Set());
              try {
                localStorage.removeItem('officepro_read_notif_ids');
              } catch (e) {}
              showToast('Read history cleared', 'success');
            }}
            onRefreshFeed={() => {
              fetchTasks();
              fetchAdvances();
              fetchReminders();
              showToast('Notifications refreshed', 'info');
            }}
          />
        );
      case 'dashboard':
        return (
          <Dashboard
            expenses={expenses}
            balanceData={balanceData}
            onViewHistoryClick={() => navigateTo('transaction-history')}
          />
        );
      case 'labourers':
        return (
          <Labourers
            token={token}
            apiBase={API_BASE}
            labours={labours}
            advances={advances}
            fetchLabours={fetchLabours}
            setConfirmModal={setConfirmModal}
            showToast={showToast}
          />
        );

      case 'advances':
        return (
          <Advances
            token={token}
            apiBase={API_BASE}
            advances={advances}
            fetchAdvances={fetchAdvances}
            fetchDashboardData={fetchDashboardData}
            setConfirmModal={setConfirmModal}
            showToast={showToast}
          />
        );
      case 'advance-history':
        return (
          <AdvanceHistory
            token={token}
            apiBase={API_BASE}
            labours={labours}
            advances={advances}
            expenses={expenses}
            showToast={showToast}
            fetchAdvances={fetchAdvances}
            fetchDashboardData={fetchDashboardData}
          />
        );
      case 'transaction-history':
        return (
          <TransactionHistory
            token={token}
            apiBase={API_BASE}
            allStaff={allStaff}
            showToast={showToast}
          />
        );
      case 'deleted-logs':
        return (
          <DeletedLogs
            token={token}
            apiBase={API_BASE}
            showToast={showToast}
          />
        );
      case 'reminders':
        return (
          <Reminders
            token={token}
            apiBase={API_BASE}
            reminders={reminders}
            fetchReminders={fetchReminders}
            allStaff={allStaff}
            showToast={showToast}
          />
        );
      case 'tasks':
        return (
          <Tasks
            token={token}
            apiBase={API_BASE}
            tasks={tasks}
            allStaff={allStaff}
            fetchTasks={fetchTasks}
            setSelectedTaskForComments={setSelectedTaskForComments}
            setConfirmModal={setConfirmModal}
            showToast={showToast}
            onTaskCreatedLocally={registerMDTaskLocally}
            targetTaskId={targetTaskId}
            onClearTargetTaskId={() => setTargetTaskId(null)}
          />
        );
      case 'chat':
        return (
          <Chat
            token={token}
            user={user}
            apiBase={API_BASE}
            allStaff={allStaff}
            showToast={showToast}
            onUnreadChange={setUnreadCounts}
          />
        );
      case 'settings':
        return (
          <Settings
            token={token}
            apiBase={API_BASE}
            allStaff={allStaff}
            fetchStaffUsers={fetchStaffUsers}
            showToast={showToast}
          />
        );
      case 'profile':
        return (
          <Profile
            token={token}
            user={user}
            apiBase={API_BASE}
            onProfileUpdate={(updatedUser) => setUser(prev => prev ? { ...prev, ...updatedUser } : updatedUser)}
            showToast={showToast}
          />
        );
      default:
        return <div>Page Not Found</div>;
    }
  };

  return (
    <div className="dashboard-layout animate-fade-in">
      {/* Sidebar */}
      <aside className="sidebar">
        <div>
          <h2 className="gradient-text" style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '4px' }}>OFFICE PRO</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Owner Dashboard</p>
        </div>


        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1, marginTop: '16px' }}>
          <button
            onClick={() => navigateTo('notifications')}
            className={`nav-link btn-secondary ${activeTab === 'notifications' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <Bell size={18} /> Notifications
            {unreadNotificationCount > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: 'auto', padding: '2px 6px' }}>
                {unreadNotificationCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigateTo('reminders')}
            className={`nav-link btn-secondary ${activeTab === 'reminders' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <Bell size={18} /> Staff Reminders
          </button>
          <button
            onClick={() => navigateTo('tasks')}
            className={`nav-link btn-secondary ${activeTab === 'tasks' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <CheckCircle size={18} /> Task Manager
            {tasks.filter(t => t.status === 'pending').length > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: 'auto', padding: '2px 6px' }}>
                {tasks.filter(t => t.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => navigateTo('chat')}
            className={`nav-link btn-secondary ${activeTab === 'chat' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <MessageSquare size={18} /> Chat Hub
            {totalUnreadMessages > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: 'auto', padding: '2px 6px' }}>
                {totalUnreadMessages}
              </span>
            )}
          </button>
          <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '8px 0' }} />

          <button
            onClick={() => navigateTo('labourers')}
            className={`nav-link btn-secondary ${activeTab === 'labourers' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <Users size={18} /> Labour Directory
          </button>
          <button
            onClick={() => navigateTo('advances')}
            className={`nav-link btn-secondary ${activeTab === 'advances' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <ArrowUpRight size={18} /> Advance Approvals
            {advances.filter(a => a.status === 'pending').length > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: 'auto', padding: '2px 6px' }}>
                {advances.filter(a => a.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => navigateTo('advance-history')}
            className={`nav-link btn-secondary ${activeTab === 'advance-history' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <History size={18} /> Advance Ledger
          </button>
          <button
            onClick={() => navigateTo('dashboard')}
            className={`nav-link btn-secondary ${activeTab === 'dashboard' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <TrendingUp size={18} /> Expenses Desk
          </button>
          <button
            onClick={() => navigateTo('transaction-history')}
            className={`nav-link btn-secondary ${activeTab === 'transaction-history' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <Receipt size={18} /> Transaction History
          </button>
          <button
            onClick={() => navigateTo('deleted-logs')}
            className={`nav-link btn-secondary ${activeTab === 'deleted-logs' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <Trash2 size={18} /> Deleted History
          </button>
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <button
            onClick={() => navigateTo('settings')}
            className={`nav-link btn-secondary ${activeTab === 'settings' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', marginBottom: '12px' }}
          >
            <SettingsIcon size={18} /> Settings
          </button>
          <div
            onClick={() => navigateTo('profile')}
            className={`profile-bottom-btn ${activeTab === 'profile' ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              transition: 'background 0.2s',
              background: activeTab === 'profile' ? 'rgba(0,0,0,0.05)' : 'transparent'
            }}
          >
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.name}
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--glass-border)' }}
              />
            ) : (
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                MD
              </div>
            )}
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user?.name === 'Owner Admin' ? 'MD' : (user?.name || 'MD')}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Managing Director</p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-danger" style={{ width: '100%', padding: '10px' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`main-content ${activeTab === 'settings' ? 'settings-main-content' : ''} ${activeTab === 'notifications' ? 'notifications-main-content' : ''}`}>
        <div key={activeTab} className="premium-page-stage">
          {renderContent()}
        </div>
      </main>

      {/* MODAL: TASK COMMENTS / FOLLOW-UP */}
      {selectedTaskForComments && (
        <TaskDetailModal
          task={selectedTaskForComments}
          token={token}
          apiBase={API_BASE}
          onClose={() => setSelectedTaskForComments(null)}
          onTaskUpdated={fetchTasks}
          showToast={showToast}
        />
      )}

      {/* Toast Notification overlay */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' && <span>✅</span>}
            {toast.type === 'danger' && <span>❌</span>}
            {toast.type === 'warning' && <span>⚠️</span>}
            {toast.type === 'info' && <span>ℹ️</span>}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
        }}>
          <div className="glass-panel glass-panel-glow animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '32px', textAlign: 'center' }}>
            <h3 className="gradient-text" style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '16px' }}>{confirmModal.title}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.6', fontSize: '1.05rem' }}>{confirmModal.message}</p>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="btn btn-primary"
                style={{ padding: '10px 28px', fontWeight: 'bold' }}
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                className="btn btn-secondary"
                style={{ padding: '10px 28px', fontWeight: 'bold' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GIVE CASH */}
      {showCashModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass-panel glass-panel-glow" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>
            <h2 className="gradient-text" style={{ marginBottom: '20px', fontSize: '1.5rem', fontWeight: 700 }}>Send Cash to Staff</h2>
            <form onSubmit={handleGiveCash}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Select Staff Member</label>
                <select
                  className="form-input"
                  value={selectedStaffId}
                  onChange={e => setSelectedStaffId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px' }}
                >
                  <option value="" disabled>-- Select Staff Member --</option>
                  {allStaff.map(s => (
                    <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Amount (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 50000"
                  value={cashAmount}
                  onChange={e => setCashAmount(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Payment Mode</label>
                <select
                  className="form-input"
                  value={cashPaymentMode}
                  onChange={e => setCashPaymentMode(e.target.value as any)}
                  required
                  style={{ width: '100%', padding: '8px 12px' }}
                >
                  <option value="handcash">💵 Cash (Handcash)</option>
                  <option value="online">🌐 Online (Bank / UPI)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Description / Remarks</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Monthly cash expenses budget"
                  value={cashDesc}
                  onChange={e => setCashDesc(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={cashSubmitting}>
                  {cashSubmitting ? <Loader className="spinner" size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Send Cash'}
                </button>
                <button type="button" onClick={() => setShowCashModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Alarm Fullscreen Popup Alert */}
      {activeAlarmReminder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #1e293b, #0f172a)',
            border: '2px solid #ef4444',
            borderRadius: '24px',
            padding: '36px',
            maxWidth: '520px',
            width: '100%',
            color: '#ffffff',
            boxShadow: '0 25px 60px -15px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.35)',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'inline-flex',
              padding: '16px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              marginBottom: '20px',
              fontSize: '2.2rem'
            }}>
              🔔
            </div>

            <div style={{
              fontSize: '0.85rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#f87171',
              marginBottom: '8px'
            }}>
              ⏰ {activeAlarmReminder.isTask ? 'TASK REMINDER ALARM RINGING!' : 'NOTICE REMINDER ALARM RINGING!'}
            </div>

            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 12px 0', lineHeight: 1.3 }}>
              {activeAlarmReminder.title}
            </h2>

            {activeAlarmReminder.staffName && (
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '8px' }}>
                Assigned to / Set by: <strong style={{ color: '#ffffff' }}>{activeAlarmReminder.staffName}</strong>
              </p>
            )}

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '24px' }}>
              Scheduled reminder time has arrived. Alarm is ringing on both MD & Staff screens.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    pcAlarmEngine.stop();
                    snoozedAlarmMapRef.current.set(activeAlarmReminder.id, Date.now() + 5 * 60 * 1000);
                    if (activeAlarmReminder.isTask) {
                      try {
                        await fetch(`${API_BASE}/tasks/${activeAlarmReminder.id}/snooze-alarm`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ minutes: 5 })
                        });
                        fetchTasks();
                      } catch (e) {}
                    }
                    setActiveAlarmReminder(null);
                    showToast('⏰ Alarm snoozed for 5 minutes', 'info');
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Clock size={16} /> Snooze 5 Min
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    pcAlarmEngine.stop();
                    const key = activeAlarmReminder.alarmKey || activeAlarmReminder.id;
                    snoozedAlarmMapRef.current.set(key, Date.now() + 5 * 60 * 1000);
                    if (activeAlarmReminder.isTask) {
                      try {
                        await fetch(`${API_BASE}/tasks/${activeAlarmReminder.id}/snooze-alarm`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ minutes: 5 })
                        });
                        fetchTasks();
                      } catch (e) {}
                    }
                    setActiveAlarmReminder(null);
                    showToast('⏰ Alarm snoozed for 5 minutes', 'info');
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Clock size={16} /> Snooze 5 Min
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    pcAlarmEngine.stop();
                    const key = activeAlarmReminder.alarmKey || activeAlarmReminder.id;
                    triggeredAlarmKeysRef.current.add(key);
                    markAlarmStoppedLocally(key);
                    if (activeAlarmReminder.isTask) {
                      try {
                        await fetch(`${API_BASE}/tasks/${activeAlarmReminder.id}/stop-alarm`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        fetchTasks();
                      } catch (e) {}
                    } else {
                      try {
                        await fetch(`${API_BASE}/reminders/${activeAlarmReminder.id}/stop-alarm`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        fetchReminders();
                      } catch (e) {}
                    }
                    setActiveAlarmReminder(null);
                    showToast('🔕 Alarm stopped', 'success');
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  🔕 Stop Alarm
                </button>
              </div>

              {activeAlarmReminder.isTask && activeAlarmReminder.taskData && (
                <button
                  type="button"
                  onClick={() => {
                    pcAlarmEngine.stop();
                    const key = activeAlarmReminder.alarmKey || activeAlarmReminder.id;
                    triggeredAlarmKeysRef.current.add(key);
                    markAlarmStoppedLocally(key);
                    const tData = activeAlarmReminder.taskData;
                    setActiveAlarmReminder(null);
                    setSelectedTaskForComments(tData);
                  }}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  👁 View Task & Follow-up Details
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
