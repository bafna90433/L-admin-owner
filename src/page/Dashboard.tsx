import React, { useState } from 'react';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  IndianRupee, 
  Loader 
} from 'lucide-react';
import '../styles/Dashboard.css';

interface User {
  id: string;
  _id?: string;
  username: string;
  name: string;
  role: string;
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

interface BalanceData {
  totalReceived: number;
  totalSpent: number;
  activeBalance: number;
  categoryTotals: Record<string, number>;
}

interface DashboardProps {
  token: string | null;
  apiBase: string;
  expenses: CashTx[];
  balanceData: BalanceData;
  allStaff: User[];
  onGiveCashSuccess: () => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export default function Dashboard({
  token,
  apiBase,
  expenses,
  balanceData,
  allStaff,
  onGiveCashSuccess,
  showToast
}: DashboardProps) {
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [cashDesc, setCashDesc] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [cashSubmitting, setCashSubmitting] = useState(false);

  // Initialize selected staff ID if list changes
  React.useEffect(() => {
    if (allStaff.length > 0 && !selectedStaffId) {
      setSelectedStaffId(allStaff[0].id || allStaff[0]._id || '');
    }
  }, [allStaff, selectedStaffId]);

  const handleGiveCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashAmount || !selectedStaffId) return;
    setCashSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/expenses/cash-received`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          amount: parseFloat(cashAmount),
          date: new Date(),
          description: cashDesc || 'Cash handed over to office staff',
          staffId: selectedStaffId
        })
      });

      if (res.ok) {
        setShowCashModal(false);
        setCashAmount('');
        setCashDesc('');
        onGiveCashSuccess();
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

  return (
    <div className="dashboard-page-container">
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <h1>Financial Overview</h1>
          <p>Track office staff cash flow and expenses book live.</p>
        </div>
        <button onClick={() => setShowCashModal(true)} className="btn btn-primary">
          <Plus size={18} /> Send Cash to Staff
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <div className="stat-header">
            <span>Total Cash Sent</span>
            <ArrowUpRight size={20} style={{ color: 'var(--accent-secondary)' }} />
          </div>
          <div className="stat-value gradient-text">₹{balanceData.totalReceived.toLocaleString('en-IN')}</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Handed to Office Staff</p>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-header">
            <span>Total Expenses</span>
            <ArrowDownLeft size={20} style={{ color: 'var(--color-danger)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--color-danger)' }}>₹{balanceData.totalSpent.toLocaleString('en-IN')}</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Spent by Office Staff</p>
        </div>

        <div className="glass-panel stat-card" style={{ border: '1px solid rgba(16, 185, 129, 0.4)' }}>
          <div className="stat-header">
            <span>Active Staff Balance</span>
            <IndianRupee size={20} style={{ color: 'var(--color-success)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>₹{balanceData.activeBalance.toLocaleString('en-IN')}</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cash currently with Staff</p>
        </div>
      </div>

      {/* Expenses breakdown & Logs */}
      <div className="dashboard-grid-layout">
        
        {/* Transaction history */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.25rem' }}>Recent Expenses Ledger</h3>
          <div className="table-container" style={{ maxHeight: '400px' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Details</th>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((tx) => (
                  <tr key={tx._id}>
                    <td>{new Date(tx.date).toLocaleDateString('en-GB')}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{tx.description}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>By {tx.staffId?.name || 'Staff'}</div>
                    </td>
                    <td>
                      <span className={`badge ${
                        tx.txType === 'received' ? 'badge-success' :
                        tx.category === 'petrol' ? 'badge-info' :
                        tx.category === 'porter-vehicle' ? 'badge-warning' :
                        tx.category === 'staff-welfare' ? 'badge-success' :
                        tx.category === 'salary-advance' ? 'badge-danger' :
                        'badge-info'
                      }`}>
                        {tx.txType === 'received' ? 'RECEIVED' : tx.category.replace('-', ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: tx.txType === 'received' ? 'var(--color-success)' : 'var(--text-primary)' }}>
                      {tx.txType === 'received' ? '+' : '-'}₹{tx.amount}
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                      No recent expenses logged.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Category-wise spending visualizer */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h3 style={{ fontSize: '1.25rem' }}>Category Expenses Breakdown</h3>
          <div className="breakdown-container">
            {Object.entries(balanceData.categoryTotals || {}).map(([cat, val]) => {
              const pct = balanceData.totalSpent > 0 ? (val / balanceData.totalSpent) * 100 : 0;
              return (
                <div key={cat} className="breakdown-item">
                  <div className="breakdown-label">
                    <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{cat.replace('-', ' ')}</span>
                    <span style={{ fontWeight: 700 }}>₹{val.toLocaleString('en-IN')} ({Math.round(pct)}%)</span>
                  </div>
                  <div className="breakdown-progress-bar">
                    <div className="breakdown-progress-fill" style={{ 
                      width: `${pct}%`, 
                      background: cat === 'petrol' ? 'var(--accent-secondary)' :
                                 cat === 'porter-vehicle' ? 'var(--color-warning)' :
                                 cat === 'staff-welfare' ? 'var(--color-success)' :
                                 cat === 'salary-advance' ? 'var(--color-danger)' :
                                 'var(--accent-primary)'
                    }}></div>
                  </div>
                </div>
              );
            })}
            {Object.keys(balanceData.categoryTotals || {}).length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                No category data available.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL: GIVE CASH */}
      {showCashModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass-panel glass-panel-glow" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>
            <h2 className="gradient-text" style={{ marginBottom: '20px' }}>Send Cash to Staff</h2>
            <form onSubmit={handleGiveCash}>
              <div className="form-group">
                <label className="form-label">Select Staff Member</label>
                <select 
                  className="form-input"
                  value={selectedStaffId}
                  onChange={e => setSelectedStaffId(e.target.value)}
                  required
                >
                  <option value="" disabled>-- Select Staff Member --</option>
                  {allStaff.map(s => (
                    <option key={s.id || s._id} value={s.id || s._id}>{s.name} ({s.username})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="e.g. 50000"
                  value={cashAmount}
                  onChange={e => setCashAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Remarks</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Monthly cash expenses budget"
                  value={cashDesc}
                  onChange={e => setCashDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={cashSubmitting}>
                  {cashSubmitting ? <Loader className="spinner" size={16} /> : 'Send Cash'}
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
