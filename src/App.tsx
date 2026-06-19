import { useState, useEffect } from 'react';
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
  History
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

const API_BASE = 'https://l-backend-production-ff32.up.railway.app/api';

interface User {
  id: string;
  _id?: string;
  username: string;
  name: string;
  role: string;
  whatsapp?: string;
  imageUrl?: string;
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
  const adminValidTabs = ['dashboard', 'labourers', 'attendance', 'salary', 'advances', 'advance-history', 'reminders', 'tasks', 'chat', 'settings', 'profile'] as const;
  type AdminTabType = typeof adminValidTabs[number];
  const adminSavedTab = localStorage.getItem('admin_active_tab') as AdminTabType | null;
  const [activeTab, setActiveTab] = useState<AdminTabType>(adminSavedTab && adminValidTabs.includes(adminSavedTab) ? adminSavedTab : 'dashboard');

  const navigateTo = (tab: AdminTabType) => {
    localStorage.setItem('admin_active_tab', tab);
    setActiveTab(tab);
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
    categoryTotals: {} as Record<string, number>
  });
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

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

  const showToast = (message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

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

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
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

  const fetchUnreadCounts = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/messages/unread/count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCounts(data);
      }
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
            token={token}
            apiBase={API_BASE}
            expenses={expenses}
            balanceData={balanceData}
            allStaff={allStaff}
            onGiveCashSuccess={fetchDashboardData}
            showToast={showToast}
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
            onProfileUpdate={setUser}
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
          <h2 className="gradient-text" style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '4px' }}>LABOUR PRO</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Owner Dashboard</p>
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
      <main className="main-content">
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

    </div>
  );
}
