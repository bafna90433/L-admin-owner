import { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Filter, 
  Download, 
  RefreshCw,
  Loader,
  DollarSign,
  Wallet
} from 'lucide-react';
import '../styles/Tasks.css'; // Leverage styles

interface UserType {
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
  paymentMode: 'online' | 'handcash';
  staffId?: {
    _id: string;
    name: string;
    username: string;
  };
  labourId?: {
    _id: string;
    name: string;
  };
}

interface TransactionHistoryProps {
  token: string | null;
  apiBase: string;
  allStaff: UserType[];
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export default function TransactionHistory({
  token,
  apiBase,
  allStaff,
  showToast
}: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<CashTx[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [txType, setTxType] = useState<'all' | 'received' | 'expense'>('all');
  const [category, setCategory] = useState('all');
  const [paymentMode, setPaymentMode] = useState<'all' | 'online' | 'handcash'>('all');
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Transactions from API
  const fetchTxs = async () => {
    setLoading(true);
    try {
      let queryParams = [];
      if (startDate) queryParams.push(`startDate=${startDate}`);
      if (endDate) queryParams.push(`endDate=${endDate}`);
      if (txType !== 'all') queryParams.push(`txType=${txType}`);
      if (category !== 'all') queryParams.push(`category=${category}`);

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const res = await fetch(`${apiBase}/expenses${queryString}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      } else {
        showToast('Failed to fetch transactions', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on filters change
  useEffect(() => {
    fetchTxs();
  }, [startDate, endDate, txType, category]);

  // Client-side dynamic filters
  const filteredTxs = transactions.filter(tx => {
    // Payment mode filter
    if (paymentMode !== 'all' && tx.paymentMode !== paymentMode) {
      return false;
    }
    // Staff filter
    if (selectedStaff !== 'all') {
      const txStaffId = tx.staffId?._id;
      if (txStaffId !== selectedStaff) return false;
    }
    // Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const desc = tx.description ? tx.description.toLowerCase() : '';
      const amountStr = tx.amount.toString();
      const cat = tx.category ? tx.category.toLowerCase() : '';
      const staff = tx.staffId?.name ? tx.staffId.name.toLowerCase() : '';
      const labour = tx.labourId?.name ? tx.labourId.name.toLowerCase() : '';

      return desc.includes(q) || 
             amountStr.includes(q) || 
             cat.includes(q) || 
             staff.includes(q) || 
             labour.includes(q);
    }
    return true;
  });

  // Calculate dynamic totals for filtered transactions
  const totalReceived = filteredTxs
    .filter(t => t.txType === 'received')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSpent = filteredTxs
    .filter(t => t.txType === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalReceived - totalSpent;

  // Extract all categories dynamically from the loaded transactions
  const dynamicCategories = Array.from(new Set(transactions.map(tx => tx.category))).filter(Boolean);

  // Helper to parse description
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

  // Helper to render details with status badges
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

  // Export filtered transactions to CSV
  const exportToCSV = () => {
    if (filteredTxs.length === 0) {
      showToast('No transactions to export', 'warning');
      return;
    }
    
    // Header
    const headers = ['Date', 'Type', 'Category', 'Details', 'Staff', 'Labourer', 'Payment Mode', 'Amount (Rs)'];
    
    // Rows
    const rows = filteredTxs.map(tx => {
      const dateStr = new Date(tx.date).toLocaleDateString('en-GB');
      const typeStr = tx.txType === 'received' ? 'Inflow (Received)' : 'Outflow (Expense)';
      const catStr = tx.category.replace('-', ' ').toUpperCase();
      const descClean = tx.description ? `"${tx.description.replace(/"/g, '""')}"` : '""';
      const staffName = tx.staffId?.name || 'Staff';
      const labourName = tx.labourId?.name || '--';
      const modeStr = tx.paymentMode === 'online' ? 'Online' : 'Hand Cash';
      
      return [
        dateStr,
        typeStr,
        catStr,
        descClean,
        staffName,
        labourName,
        modeStr,
        tx.amount
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Transaction_History_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV file exported successfully', 'success');
  };

  return (
    <div className="tasks-page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>Transaction History Ledger</h1>
          <p style={{ color: 'var(--text-secondary)' }}>View, search, filter, and export the complete financial inflow/outflow ledger.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchTxs} className="btn btn-secondary" style={{ padding: '10px 16px' }} title="Refresh ledger">
            <RefreshCw size={16} className={loading ? 'spinner' : ''} />
          </button>
          <button onClick={exportToCSV} className="btn btn-primary" style={{ padding: '10px 20px', gap: '8px' }}>
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filtered Sums Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '10px'
      }}>
        {/* Total Inflow */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 24px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', color: '#10b981', justifyContent: 'center' }}>
            <ArrowUpRight size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>TOTAL CASH SENT</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-success)', marginTop: '2px' }}>₹{totalReceived.toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* Total Outflow */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 24px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', color: '#ef4444', justifyContent: 'center' }}>
            <ArrowDownRight size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>TOTAL EXPENSES</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', marginTop: '2px' }}>₹{totalSpent.toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* Net Flow */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 24px', border: `1px solid ${netBalance >= 0 ? 'rgba(79, 70, 229, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: netBalance >= 0 ? 'rgba(79, 70, 229, 0.1)' : 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', color: netBalance >= 0 ? 'var(--accent-primary)' : '#ef4444', justifyContent: 'center' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>AVAILABLE TOTAL CASH</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: netBalance >= 0 ? 'var(--accent-primary)' : '#ef4444', marginTop: '2px' }}>
              {netBalance < 0 && '-'}₹{Math.abs(netBalance).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} /> Filter & Search Controls
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {/* Start Date */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Start Date</label>
            <input 
              type="date" 
              className="form-input" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
            />
          </div>

          {/* End Date */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">End Date</label>
            <input 
              type="date" 
              className="form-input" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
            />
          </div>

          {/* Tx Type */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Transaction Type</label>
            <select className="form-input" value={txType} onChange={e => setTxType(e.target.value as any)}>
              <option value="all">All Transactions</option>
              <option value="received">Inflow (Cash Sent to Staff)</option>
              <option value="expense">Outflow (Logged Expenses)</option>
            </select>
          </div>

          {/* Category */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Category</label>
            <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="all">All Categories</option>
              <option value="received">Cash Transferred (received)</option>
              <option value="petrol">Petrol</option>
              <option value="porter-vehicle">Porter Vehicle</option>
              <option value="staff-welfare">Staff Welfare</option>
              <option value="salary-advance">Salary Advance</option>
              <option value="company-expenses">Company Expenses</option>
              <option value="sir-expenses">Sir Expenses</option>
              <option value="miscellaneous">Miscellaneous</option>
              {dynamicCategories.map(cat => (
                !['petrol', 'porter-vehicle', 'staff-welfare', 'salary-advance', 'company-expenses', 'sir-expenses', 'miscellaneous', 'received'].includes(cat) && (
                  <option key={cat} value={cat}>{cat.replace('-', ' ')}</option>
                )
              ))}
            </select>
          </div>

          {/* Payment Mode */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Payment Mode</label>
            <select className="form-input" value={paymentMode} onChange={e => setPaymentMode(e.target.value as any)}>
              <option value="all">All Modes</option>
              <option value="online">Online Cash</option>
              <option value="handcash">Hand Cash</option>
            </select>
          </div>

          {/* Staff Member */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Staff Member</label>
            <select className="form-input" value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}>
              <option value="all">All Staff Users</option>
              {allStaff.map(staff => (
                <option key={staff.id || staff._id} value={staff.id || staff._id}>{staff.name} ({staff.username})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Search Ledger</label>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search description, reason, staff, labourer, or amount..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '40px' }}
            />
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>

      {/* Ledger Table Panel */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px', gap: '16px' }}>
            <Loader className="spinner" size={32} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading ledger data...</span>
          </div>
        ) : (
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Details & Remarks</th>
                  <th>Category</th>
                  <th>Payment Mode</th>
                  <th>Staff</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxs.map((tx) => {
                  const { details, reason } = parseDescription(tx.description, tx.category, tx.txType);
                  return (
                    <tr key={tx._id}>
                      {/* Date */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                          {new Date(tx.date).toLocaleDateString('en-GB')}
                        </div>
                      </td>

                      {/* Details & Remarks */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {renderDetailsCell(details)}
                          {reason && reason !== '--' && (
                            <small style={{ color: 'var(--text-secondary)', fontStyle: 'italic', display: 'block' }}>
                              Reason: {reason}
                            </small>
                          )}
                          {tx.labourId && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                              Labourer: {tx.labourId.name}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td>
                        <span className={`badge ${
                          tx.txType === 'received' ? 'badge-success' :
                          tx.category === 'petrol' ? 'badge-info' :
                          tx.category === 'porter-vehicle' ? 'badge-warning' :
                          tx.category === 'staff-welfare' ? 'badge-success' :
                          tx.category === 'salary-advance' ? 'badge-danger' :
                          'badge-info'
                        }`} style={{ textTransform: 'capitalize' }}>
                          {tx.txType === 'received' ? 'Received Cash' : tx.category.replace('-', ' ')}
                        </span>
                      </td>

                      {/* Payment Mode */}
                      <td>
                        <span className="badge" style={{ 
                          background: tx.paymentMode === 'online' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                          color: tx.paymentMode === 'online' ? 'var(--accent-secondary)' : 'var(--color-success)',
                          border: tx.paymentMode === 'online' ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          textTransform: 'uppercase',
                          fontSize: '0.7rem'
                        }}>
                          {tx.paymentMode === 'online' ? <Wallet size={12} /> : <DollarSign size={12} />}
                          {tx.paymentMode === 'online' ? 'Online' : 'Handcash'}
                        </span>
                      </td>

                      {/* Staff */}
                      <td style={{ fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
                            {tx.staffId?.name ? tx.staffId.name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          {tx.staffId?.name || 'Staff'}
                        </div>
                      </td>

                      {/* Amount */}
                      <td style={{ 
                        fontWeight: 800, 
                        color: tx.txType === 'received' ? 'var(--color-success)' : 'var(--text-primary)',
                        fontSize: '1.05rem',
                        whiteSpace: 'nowrap'
                      }}>
                        {tx.txType === 'received' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
                {filteredTxs.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      No transactions match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
