import { useMemo } from 'react';
import '../styles/Dashboard.css';

interface CashTx {
  _id: string;
  txType: 'received' | 'expense';
  category: string;
  amount: number;
  date: string;
  description: string;
  staffId?: {
    _id?: string;
    id?: string;
    name?: string;
    username?: string;
  } | string;
  staffName?: string;
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
  expenses: CashTx[];
  balanceData: BalanceData;
  onViewHistoryClick?: () => void;
}

export default function Dashboard({
  expenses,
  balanceData,
  onViewHistoryClick
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

  // Calculate Company Expenses by Selected Staff / Employee Member
  const staffCompanyExpenses = useMemo(() => {
    const staffMap: Record<string, { name: string; totalCompany: number; companyCount: number }> = {};
    
    (expenses || []).forEach(tx => {
      if (tx.txType !== 'received' && tx.category === 'company-expenses') {
        const labourObj = typeof (tx as any).labourId === 'object' ? (tx as any).labourId : null;
        
        const selectedPerson = labourObj;
        if (selectedPerson && selectedPerson.name) {
          const personName = selectedPerson.name;
          const personId = selectedPerson._id || selectedPerson.id || personName;
          
          if (!staffMap[personId]) {
            staffMap[personId] = { name: personName, totalCompany: 0, companyCount: 0 };
          }
          
          const amt = Number(tx.amount) || 0;
          staffMap[personId].totalCompany += amt;
          staffMap[personId].companyCount += 1;
        }
      }
    });


    return Object.values(staffMap).filter(s => s.totalCompany > 0).sort((a, b) => b.totalCompany - a.totalCompany);
  }, [expenses]);



  return (
    <div className="dashboard-page-container">

      {/* Stats Grid */}
      <div className="stats-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '24px',
        marginBottom: '24px'
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
              boxShadow: '0 6px 18px rgba(239, 68, 68, 0.25)' 
            }} 
          />
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Expenses</span>
            <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 850, marginTop: '4px', color: 'var(--color-danger)' }}>₹{balanceData.totalSpent.toLocaleString('en-IN')}</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>Logged by Staff</p>
          </div>
        </div>

        {/* Card 3: Online Balance */}
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
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Online Cash</span>
            <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 850, marginTop: '4px', color: 'var(--text-primary)' }}>₹{(balanceData.onlineBalance ?? 0).toLocaleString('en-IN')}</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>Bank / UPI Balance</p>
          </div>
        </div>

        {/* Card 4: Hand Cash Balance */}
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
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hand Cash</span>
            <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 850, marginTop: '4px', color: 'var(--color-success)' }}>₹{(balanceData.handCashBalance ?? 0).toLocaleString('en-IN')}</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>Cash in Hand</p>
          </div>
        </div>
      </div>

      {/* Staff Company Expenses Desk Card View */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              🏢 Staff Company Expenses Desk
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0' }}>
              Total company expenses logged per staff member
            </p>
          </div>
          <span className="badge badge-info" style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '20px' }}>
            {staffCompanyExpenses.length} Staff Members Active
          </span>
        </div>

        {staffCompanyExpenses.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '16px'
          }}>
            {staffCompanyExpenses.map((s, idx) => (
              <div key={s.name + idx} style={{
                background: 'white',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '16px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: 'linear-gradient(90deg, #6366f1, #4f46e5)'
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4f46e5, #3b82f6)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    flexShrink: 0
                  }}>
                    {s.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: '1rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </strong>
                    <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                      {s.companyCount} {s.companyCount === 1 ? 'entry' : 'entries'} · Company Expense
                    </small>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4px' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Total Company Spent</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 850, color: '#ef4444' }}>
                      ₹{s.totalCompany.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>
            ))}

          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '28px', background: '#f8fafc', borderRadius: '12px' }}>
            No staff company expenses recorded yet.
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px'
      }}>
        {/* Transaction history */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '1.25rem' }}>Recent Expenses Ledger</h3>
            {onViewHistoryClick && (
              <button 
                type="button" 
                onClick={onViewHistoryClick} 
                className="btn btn-secondary" 
                style={{ 
                  padding: '6px 12px', 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px' 
                }}
              >
                👁️ View History
              </button>
            )}
          </div>
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
                            By {typeof tx.staffId === 'object' ? tx.staffId?.name : (tx as any).staffName || 'Staff'}
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

    </div>
  );
}
