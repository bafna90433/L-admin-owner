import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Users, 
  Calendar, 
  IndianRupee, 
  ArrowUpRight, 
  TrendingUp, 
  LogOut, 
  CheckCircle, 
  Bell, 
  MessageSquare,
  Settings as SettingsIcon,
  History,
  Receipt,
  Plus,
  Loader,
  Trash2
} from 'lucide-react';

// Import Modular Page Components
import Login from './page/Login';
import Dashboard from './page/Dashboard';
import Labourers from './page/Labourers';
import Attendance from './page/Attendance';
import Salary from './page/Salary';
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

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [user, setUser] = useState<User | null>(null);
  
  // Router Tab
  const adminValidTabs = ['dashboard', 'labourers', 'attendance', 'salary', 'advances', 'advance-history', 'transaction-history', 'deleted-logs', 'reminders', 'tasks', 'chat', 'settings', 'profile'] as const;
  type AdminTabType = typeof adminValidTabs[number];
  const adminSavedTab = localStorage.getItem('admin_active_tab') as AdminTabType | null;
  const [activeTab, setActiveTab] = useState<AdminTabType>(adminSavedTab && adminValidTabs.includes(adminSavedTab) ? adminSavedTab : 'dashboard');

  const navigateTo = (tab: AdminTabType) => {
    localStorage.setItem('admin_active_tab', tab);
    setActiveTab(tab);
    if (tab === 'reminders') {
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
          navigateTo('tasks');
          notif.close();
        };
      } catch (e) {
        console.error('Desktop notification error:', e);
      }
    }
  };

  const speakWebSpeechFallback = (textToSpeak: string) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      utterance.pitch = 0.95;
      utterance.volume = 1.0;

      const getAndSetVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (!voices || voices.length === 0) return;
        const isFemale = (name: string) => /zira|jenny|aria|ava|samantha|victoria|karen|female|woman|neerja|susan|catherine|hazel|heera|ayumi|haruka|yating|zhiyu/i.test(name);
        
        // Strictly Select Real Man / Male Voice
        const maleVoice = voices.find(v => 
          !isFemale(v.name) && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Online')) && (v.name.includes('Andrew') || v.name.includes('Brian') || v.name.includes('Guy') || v.name.includes('Christopher') || v.name.includes('Prabhat') || v.name.includes('David'))
        ) || voices.find(v => 
          !isFemale(v.name) && v.lang.startsWith('en') && (
            v.name.includes('Andrew') ||
            v.name.includes('Brian') || 
            v.name.includes('Guy') || 
            v.name.includes('David') || 
            v.name.includes('Mark') || 
            v.name.includes('Prabhat') || 
            v.name.includes('George') ||
            v.name.includes('Male') ||
            v.name.includes('Desktop')
          )
        ) || voices.find(v => !isFemale(v.name) && v.lang.startsWith('en')) || voices[0];

        if (maleVoice) {
          utterance.voice = maleVoice;
        }
      };

      getAndSetVoice();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = getAndSetVoice;
      }

      (window as any)._activeSpeechUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Web Speech error:', e);
    }
  };

  const playHumanAudio = (audioBase64: string, mimeType: string = 'audio/mp3', fallbackText?: string) => {
    try {
      if (mimeType.includes('pcm') || mimeType.includes('raw')) {
        const binaryString = atob(audioBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        const int16Array = new Int16Array(bytes.buffer);
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass({ sampleRate: 24000 });
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        const buffer = audioCtx.createBuffer(1, int16Array.length, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < int16Array.length; i++) channelData[i] = int16Array[i] / 32768.0;
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start();
      } else {
        const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
        audio.volume = 1.0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.warn('HTML5 Audio playback blocked, using Web Speech fallback:', e);
            if (fallbackText) speakWebSpeechFallback(fallbackText);
          });
        }
      }
    } catch (e) {
      console.error('Audio decode error:', e);
      if (fallbackText) speakWebSpeechFallback(fallbackText);
    }
  };

  const speakOwnerAnnouncement = async (textToSpeak: string) => {
    try {
      const cleanText = (textToSpeak || '').replace(/[^\w\s\u0900-\u097F]/gi, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);

      const res = await fetch(`${API_BASE}/ai/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: cleanText, lang: 'en', voice: 'en-US-AndrewNeural' }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.audioContent) {
          playHumanAudio(data.audioContent, data.mimeType || 'audio/mp3', textToSpeak);
          return;
        }
      }
    } catch (err) {
      console.warn('Owner TTS fetch fallback to Web Speech:', err);
    }

    speakWebSpeechFallback(textToSpeak);
  };

  const isInitialOwnerTaskFetchRef = useRef(true);
  const knownTaskMapRef = useRef<Map<string, { status: string; remarks: string; nextFollowup: string }>>(new Map());
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
            knownTaskMapRef.current.set(t._id, {
              status: t.status,
              remarks: t.remarks || '',
              nextFollowup: t.nextFollowup || ''
            });
          });
          isInitialOwnerTaskFetchRef.current = false;
        } else {
          data.forEach((t: any) => {
            const prev = knownTaskMapRef.current.get(t._id);
            const staffName = t.createdBy?.name || t.assignedTo?.name || 'Staff';

            const currentOwnerId = user?._id || user?.id || '';
            const isCreatedByMD = mdCreatedTaskIdsRef.current.has(String(t._id)) ||
                                  (t.createdBy?._id && String(t.createdBy._id) === String(currentOwnerId)) ||
                                  (t.createdBy?.id && String(t.createdBy.id) === String(currentOwnerId)) ||
                                  (typeof t.createdBy === 'string' && String(t.createdBy) === String(currentOwnerId)) ||
                                  t.createdByRole === 'owner' ||
                                  t.createdBy?.role === 'owner' ||
                                  t.taskType === 'reminder-sir';

            // Event 1: New task logged by Staff
            if (!prev) {
              knownTaskMapRef.current.set(t._id, {
                status: t.status,
                remarks: t.remarks || '',
                nextFollowup: t.nextFollowup || ''
              });

              // If MD created it -> SILENT. If Staff created it -> Announce to MD!
              if (!isCreatedByMD) {
                playLoudNotificationSound();
                showToast(`📌 New Work Logged by ${staffName}: "${t.title}"`, 'warning');
                triggerDesktopPushNotification(`📌 New Work by ${staffName}!`, t.title);
                speakOwnerAnnouncement(`Office Pro Alert! Attention Sir! ${staffName} has logged a new work task: ${t.title}.`);
              }
            } else {
              // Event 2: Task completed by Staff
              if (prev.status !== 'completed' && t.status === 'completed') {
                knownTaskMapRef.current.set(t._id, {
                  status: t.status,
                  remarks: t.remarks || '',
                  nextFollowup: t.nextFollowup || ''
                });
                const completedByName = t.completedBy?.name || staffName;
                playLoudNotificationSound();
                showToast(`✅ Work Completed by ${completedByName}: "${t.title}"`, 'success');
                triggerDesktopPushNotification(`✅ Work Completed by ${completedByName}!`, t.title);
                speakOwnerAnnouncement(`Office Pro Alert! Attention Sir! ${completedByName} has marked work completed: ${t.title}.`);
              }
              // Event 3: Staff updated remarks or follow-up
              else if (prev.remarks !== (t.remarks || '') || prev.nextFollowup !== (t.nextFollowup || '')) {
                knownTaskMapRef.current.set(t._id, {
                  status: t.status,
                  remarks: t.remarks || '',
                  nextFollowup: t.nextFollowup || ''
                });
                playLoudNotificationSound();
                showToast(`📝 Work details updated by ${staffName}: "${t.title}"`, 'info');
                speakOwnerAnnouncement(`Office Pro Alert! Attention Sir! ${staffName} has updated work details for: ${t.title}.`);
              }
            }
          });
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

      case 'attendance':
        return (
          <Attendance 
            token={token}
            apiBase={API_BASE}
            labours={labours}
            showToast={showToast}
          />
        );
      case 'salary':
        return (
          <Salary 
            token={token}
            apiBase={API_BASE}
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


        <div style={{ marginTop: '16px', marginBottom: '16px', padding: '0 4px' }}>
          <button 
            onClick={() => setShowCashModal(true)} 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            <Plus size={16} /> Send Cash to Staff
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
          <button 
            onClick={() => navigateTo('dashboard')} 
            className={`nav-link btn-secondary ${activeTab === 'dashboard' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <TrendingUp size={18} /> Dashboard
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
          <button 
            onClick={() => navigateTo('settings')} 
            className={`nav-link btn-secondary ${activeTab === 'settings' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <SettingsIcon size={18} /> Settings
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
            onClick={() => navigateTo('attendance')} 
            className={`nav-link btn-secondary ${activeTab === 'attendance' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <Calendar size={18} /> Attendance Ledger
          </button>
          <button 
            onClick={() => navigateTo('salary')} 
            className={`nav-link btn-secondary ${activeTab === 'salary' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <IndianRupee size={18} /> Salary Generator
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
      <main className={`main-content ${activeTab === 'settings' ? 'settings-main-content' : ''}`}>
        {renderContent()}
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

    </div>
  );
}
