import React, { useState } from 'react';
import { 
  Plus, 
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
  onlineBalance?: number;
  handCashBalance?: number;
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
  // Helper to parse description into details and reason
  const parseDescription = (description: string, category: string, txType: string) => {
    let details = '';
    let reason = '';

    const reasonMarker = '. Reason: ';
    const directReasonMarker = 'Reason: ';
    
    if (description.includes(reasonMarker)) {
      const parts = description.split(reasonMarker);
      details = parts[0];
      reason = parts.slice(1).join(reasonMarker);
    } else if (description.includes(directReasonMarker)) {
      const parts = description.split(directReasonMarker);
      details = parts[0];
      reason = parts.slice(1).join(directReasonMarker);
    } else {
      if (txType === 'received') {
        details = 'Cash Received from MD';
      } else {
        details = category.replace('-', ' ').toUpperCase();
      }
      reason = description || '--';
    }

    if (details.endsWith('.')) {
      details = details.slice(0, -1);
    }

    return { details, reason };
  };

  // Helper to render details with styled status badges
  const renderDetailsCell = (detailsText: string) => {
    let text = detailsText;
    let badgeText = '';
    let badgeClass = '';

    if (detailsText.includes('(Auto-Approved)')) {
      text = detailsText.replace('(Auto-Approved)', '').trim();
      badgeText = 'Auto-Approved';
      badgeClass = 'badge-success';
    } else if (detailsText.includes('(Approved by Owner)')) {
      text = detailsText.replace('(Approved by Owner)', '').trim();
      badgeText = 'MD Approved';
      badgeClass = 'badge-info';
    } else if (detailsText.includes('(By Owner)')) {
      text = detailsText.replace('(By Owner)', '').trim();
      badgeText = 'Direct Advance';
      badgeClass = 'badge-warning';
    }

    text = text.replace(/\s+/g, ' ').trim();
    if (text.endsWith('.')) text = text.slice(0, -1);

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>{text}</span>
        {badgeText && (
          <span className={`badge ${badgeClass}`} style={{ fontSize: '0.65rem', padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {badgeText}
          </span>
        )}
      </div>
    );
  };

  const [showCashModal, setShowCashModal] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [cashDesc, setCashDesc] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [cashSubmitting, setCashSubmitting] = useState(false);
  const [cashPaymentMode, setCashPaymentMode] = useState<'handcash' | 'online'>('handcash');

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
          staffId: selectedStaffId,
          paymentMode: cashPaymentMode
        })
      });

      if (res.ok) {
        setShowCashModal(false);
        setCashAmount('');
        setCashDesc('');
        setCashPaymentMode('handcash');
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
      <div className="stats-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Card 1: Total Cash Sent */}
        <div className="glass-panel stat-card" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          textAlign: 'center',
          gap: '16px',
          padding: '24px',
          border: '1px solid var(--glass-border)'
        }}>
          <img 
            src="https://ik.imagekit.io/rishii/total_cash_sent.png" 
            alt="Total Cash Sent" 
            style={{ 
              width: '100%', 
              maxWidth: '120px', 
              height: 'auto', 
              aspectRatio: '1 / 1', 
              borderRadius: '16px', 
              objectFit: 'cover', 
              boxShadow: '0 6px 18px rgba(79, 70, 229, 0.25)' 
            }} 
          />
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Cash Sent</span>
            <div className="stat-value gradient-text" style={{ fontSize: '1.8rem', fontWeight: 850, marginTop: '4px' }}>₹{balanceData.totalReceived.toLocaleString('en-IN')}</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>Handed to Office Staff</p>
          </div>
        </div>

        {/* Card 2: Total Expenses */}
        <div className="glass-panel stat-card" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          textAlign: 'center',
          gap: '16px',
          padding: '24px',
          border: '1px solid var(--glass-border)'
        }}>
          <img 
            src="https://ik.imagekit.io/rishii/total_expenses.png" 
            alt="Total Expenses" 
            style={{ 
              width: '100%', 
              maxWidth: '120px', 
              height: 'auto', 
              aspectRatio: '1 / 1', 
              borderRadius: '16px', 
              objectFit: 'cover', 
              boxShadow: '0 6px 18px rgba(220, 38, 38, 0.25)' 
            }} 
          />
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Expenses</span>
            <div className="stat-value" style={{ color: 'var(--color-danger)', fontSize: '1.8rem', fontWeight: 850, marginTop: '4px' }}>₹{balanceData.totalSpent.toLocaleString('en-IN')}</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>Spent by Office Staff</p>
          </div>
        </div>

        {/* Card 3: Online Cash */}
        <div className="glass-panel stat-card" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          textAlign: 'center',
          gap: '16px',
          padding: '24px',
          border: '1px solid rgba(59, 130, 246, 0.4)'
        }}>
          <img 
            src="https://ik.imagekit.io/rishii/online_bank.png" 
            alt="Online Bank" 
            style={{ 
              width: '100%', 
              maxWidth: '120px', 
              height: 'auto', 
              aspectRatio: '1 / 1', 
              borderRadius: '16px', 
              objectFit: 'cover', 
              boxShadow: '0 6px 18px rgba(59, 130, 246, 0.25)' 
            }} 
          />
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ONLINE CASH</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              ₹{(balanceData.onlineBalance ?? 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Card 4: Hand Cash */}
        <div className="glass-panel stat-card" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          textAlign: 'center',
          gap: '16px',
          padding: '24px',
          border: '1px solid rgba(16, 185, 129, 0.4)'
        }}>
          <img 
            src="https://ik.imagekit.io/rishii/hand_cash_drawer.png" 
            alt="Hand Cash Drawer" 
            style={{ 
              width: '100%', 
              maxWidth: '120px', 
              height: 'auto', 
              aspectRatio: '1 / 1', 
              borderRadius: '16px', 
              objectFit: 'cover', 
              boxShadow: '0 6px 18px rgba(16, 185, 129, 0.25)' 
            }} 
          />
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>HAND CASH</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              ₹{(balanceData.handCashBalance ?? 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Card 5: Active Staff Balance */}
        <div className="glass-panel stat-card" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          textAlign: 'center',
          gap: '16px',
          padding: '24px',
          border: '1px solid rgba(16, 185, 129, 0.4)'
        }}>
          <img 
            src="https://ik.imagekit.io/rishii/total_vault.png" 
            alt="Total Petty Cash" 
            style={{ 
              width: '100%', 
              maxWidth: '120px', 
              height: 'auto', 
              aspectRatio: '1 / 1', 
              borderRadius: '16px', 
              objectFit: 'cover', 
              boxShadow: '0 6px 18px rgba(16, 185, 129, 0.25)' 
            }} 
          />
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>AVAILABLE TOTAL CASH</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-success)', marginTop: '4px' }}>
              ₹{balanceData.activeBalance.toLocaleString('en-IN')}
            </div>
          </div>
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
                {expenses.map((tx) => {
                  const { details, reason } = parseDescription(tx.description, tx.category, tx.txType);
                  return (
                    <tr key={tx._id}>
                      <td>{new Date(tx.date).toLocaleDateString('en-GB')}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {renderDetailsCell(details)}
                          {reason && reason !== '--' && (
                            <small style={{ color: 'var(--text-secondary)', fontStyle: 'italic', display: 'block' }}>
                              Reason: {reason}
                            </small>
                          )}
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                            By {tx.staffId?.name || 'Staff'}
                          </div>
                        </div>
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
                  );
                })}
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
                <label className="form-label">Payment Mode</label>
                <select 
                  className="form-input"
                  value={cashPaymentMode}
                  onChange={e => setCashPaymentMode(e.target.value as any)}
                  required
                >
                  <option value="handcash">💵 Cash (Handcash)</option>
                  <option value="online">🌐 Online (Bank / UPI)</option>
                </select>
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
