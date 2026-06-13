import { useState, useEffect } from 'react';
import { History, Calendar, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

interface Labour {
  _id: string;
  name: string;
  whatsapp: string;
  monthlySalary: number;
  imageUrl: string;
  employeeType?: 'labourer' | 'staff';
  department?: string;
}

interface AdvanceRequest {
  _id: string;
  labourId: {
    _id: string;
    name: string;
  } | string;
  amount: number;
  deductedAmount?: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
}

interface CashTx {
  _id: string;
  txType: 'received' | 'expense';
  category: string;
  amount: number;
  date: string;
  description: string;
  labourId?: {
    _id: string;
    name: string;
  } | string;
}

interface AdvanceHistoryProps {
  token: string | null;
  apiBase: string;
  labours: Labour[];
  advances: AdvanceRequest[];
  expenses: CashTx[];
}

export default function AdvanceHistory({
  token,
  apiBase,
  labours,
  advances,
  expenses
}: AdvanceHistoryProps) {
  const [selectedLabourId, setSelectedLabourId] = useState<string>('all');
  const [localExpenses, setLocalExpenses] = useState<CashTx[]>(expenses || []);

  // Fetch full expenses history to get all past salary deductions accurately
  useEffect(() => {
    if (token) {
      fetchFullExpenses();
    }
  }, [token]);

  const fetchFullExpenses = async () => {
    try {
      const res = await fetch(`${apiBase}/expenses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLocalExpenses(data);
      }
    } catch (err) {
      console.error('Error fetching expenses for ledger:', err);
    }
  };

  const getOutstandingStats = (labId: string) => {
    const labAdvances = advances.filter(a => {
      const id = typeof a.labourId === 'object' ? a.labourId?._id : a.labourId;
      return id === labId && a.status === 'approved';
    });

    const totalTaken = labAdvances.reduce((sum, a) => sum + a.amount, 0);
    const totalDeducted = labAdvances.reduce((sum, a) => sum + (a.deductedAmount || 0), 0);
    const balance = totalTaken - totalDeducted;

    return { totalTaken, totalDeducted, balance };
  };

  // Build running ledger for selected employee
  const getEmployeeLedger = (labId: string) => {
    if (labId === 'all') return [];

    const timeline: any[] = [];

    // 1. Add all approved advances
    const labAdvances = advances.filter(a => {
      const id = typeof a.labourId === 'object' ? a.labourId?._id : a.labourId;
      return id === labId && a.status === 'approved';
    });

    labAdvances.forEach(a => {
      timeline.push({
        date: a.date,
        type: 'advance',
        amount: a.amount,
        description: `New Advance: ${a.reason || 'Approved advance request'}`,
        referenceId: a._id
      });
    });

    // 2. Add all salary deductions parsed from CashTx salary payments
    const salaryPayments = localExpenses.filter(t => {
      const id = typeof t.labourId === 'object' ? t.labourId?._id : t.labourId;
      return id === labId && t.category === 'salary-payment';
    });

    salaryPayments.forEach(t => {
      // Parse deduction from description, e.g., "(Deducted ₹500 advance)"
      const match = t.description.match(/Deducted ₹([\d,]+) advance/);
      const deducted = match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;

      if (deducted > 0) {
        timeline.push({
          date: t.date,
          type: 'deduction',
          amount: deducted,
          description: `Deducted during salary payout: ${t.description.split('.')[0] || 'Monthly wages'}`,
          referenceId: t._id
        });
      }
    });

    // Sort chronologically (oldest first)
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = 0;
    const ledger = timeline.map(entry => {
      if (entry.type === 'advance') {
        runningBalance += entry.amount;
      } else {
        runningBalance -= entry.amount;
      }
      return {
        ...entry,
        balance: runningBalance
      };
    });

    // Return descending for display (newest first)
    return ledger.reverse();
  };

  const selectedLabour = labours.find(l => l._id === selectedLabourId);
  const ledgerData = getEmployeeLedger(selectedLabourId);
  const stats = selectedLabourId !== 'all' ? getOutstandingStats(selectedLabourId) : null;

  return (
    <div className="advance-history-page-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '2.2rem' }} className="gradient-text">Advance Ledgers & History</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Track running outstanding advance balances and historical deductions for all employees.</p>
        </div>

        {/* Dropdown selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Filter Employee:</span>
          <select
            className="form-input"
            value={selectedLabourId}
            onChange={e => setSelectedLabourId(e.target.value)}
            style={{ width: '220px', fontWeight: 600 }}
          >
            <option value="all">📁 All Employees Summary</option>
            {labours.map(lab => (
              <option key={lab._id} value={lab._id}>
                👤 {lab.name} ({lab.employeeType || 'labourer'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary View (All Employees) */}
      {selectedLabourId === 'all' && (
        <div className="glass-panel">
          <h3 className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px' }}>Outstanding Advance Summary</h3>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Monthly Salary</th>
                  <th style={{ textAlign: 'right' }}>Total Advance Taken</th>
                  <th style={{ textAlign: 'right' }}>Total Deducted (Paid)</th>
                  <th style={{ textAlign: 'right', color: 'var(--color-danger)' }}>Outstanding Balance</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {labours.map(lab => {
                  const s = getOutstandingStats(lab._id);
                  return (
                    <tr key={lab._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={lab.imageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=50'}
                            alt={lab.name}
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <div>
                            <span style={{ fontWeight: 600, display: 'block' }}>{lab.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{lab.employeeType || 'labourer'}</span>
                          </div>
                        </div>
                      </td>
                      <td>₹{lab.monthlySalary.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{s.totalTaken.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>₹{s.totalDeducted.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 750, color: s.balance > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                        ₹{s.balance.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedLabourId(lab._id)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          View Ledger
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Individual Employee Ledger View */}
      {selectedLabourId !== 'all' && selectedLabour && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Stats Breakdown cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '16px 24px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Gross Advances Taken</span>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>₹{stats.totalTaken.toLocaleString('en-IN')}</h3>
            </div>
            <div className="glass-panel" style={{ padding: '16px 24px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Deducted / Recovered</span>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--color-success)' }}>₹{stats.totalDeducted.toLocaleString('en-IN')}</h3>
            </div>
            <div className="glass-panel" style={{ padding: '16px 24px', border: stats.balance > 0 ? '1px solid rgba(220, 38, 38, 0.3)' : '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Current Outstanding Balance</span>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: stats.balance > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                ₹{stats.balance.toLocaleString('en-IN')}
              </h3>
            </div>
          </div>

          {/* Running Ledger Timeline */}
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} /> Running Ledger Statement - {selectedLabour.name}
              </h3>
              <button
                onClick={() => setSelectedLabourId('all')}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                ← Back to Summary
              </button>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'right', color: 'var(--accent-secondary)' }}>Outstanding Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData.map((entry, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                          {new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        #{entry.referenceId.slice(-6).toUpperCase()}
                      </td>
                      <td>
                        <span style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          color: entry.type === 'advance' ? 'var(--color-danger)' : 'var(--color-success)',
                          fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase'
                        }}>
                          {entry.type === 'advance' ? (
                            <><ArrowUpCircle size={14} /> Received</>
                          ) : (
                            <><ArrowDownCircle size={14} /> Paid Back</>
                          )}
                        </span>
                      </td>
                      <td style={{ 
                        textAlign: 'right', fontWeight: 700,
                        color: entry.type === 'advance' ? 'var(--color-danger)' : 'var(--color-success)'
                      }}>
                        {entry.type === 'advance' ? '+' : '-'} ₹{entry.amount.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                        ₹{entry.balance.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}

                  {ledgerData.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                        No advance ledger entries found for this employee.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
