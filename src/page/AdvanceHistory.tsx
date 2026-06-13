import { useState, useEffect } from 'react';
import { History, Calendar, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Send } from 'lucide-react';

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
  requestedBy?: {
    _id: string;
    name: string;
    username: string;
    role: string;
  };
  approvedBy?: {
    _id: string;
    name: string;
    username: string;
    role: string;
  };
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
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
  fetchAdvances: () => void;
  fetchDashboardData: () => void;
}

export default function AdvanceHistory({
  token,
  apiBase,
  labours,
  advances,
  expenses,
  showToast,
  fetchAdvances,
  fetchDashboardData
}: AdvanceHistoryProps) {
  const [selectedLabourId, setSelectedLabourId] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'owner' | 'staff'>('all');
  const [localExpenses, setLocalExpenses] = useState<CashTx[]>(expenses || []);

  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'ledger' | 'give-advance'>('summary');

  // Form states for giving Direct Advance
  const [directLabId, setDirectLabId] = useState<string>('');
  const [directAmount, setDirectAmount] = useState<string>('');
  const [directReason, setDirectReason] = useState<string>('');
  const [directDate, setDirectDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [submittingDirect, setSubmittingDirect] = useState<boolean>(false);

  // Initialize selected employee for direct advance form
  useEffect(() => {
    if (labours.length > 0 && !directLabId) {
      setDirectLabId(labours[0]._id);
    }
  }, [labours, directLabId]);

  const handleCreateDirectAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directLabId || !directAmount) return;
    setSubmittingDirect(true);

    try {
      const res = await fetch(`${apiBase}/advances/direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          labourId: directLabId,
          amount: parseFloat(directAmount),
          reason: directReason,
          date: directDate
        })
      });

      if (res.ok) {
        setDirectAmount('');
        setDirectReason('');
        setDirectDate(new Date().toISOString().split('T')[0]);
        showToast('Direct advance recorded and issued successfully!', 'success');
        fetchAdvances();
        fetchDashboardData();
        fetchFullExpenses();
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to issue direct advance', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setSubmittingDirect(false);
    }
  };

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

    // Calculate source breakdowns for outstanding balance
    let ownerBalance = 0;
    let staffBalance = 0;

    labAdvances.forEach(a => {
      const remaining = a.amount - (a.deductedAmount || 0);
      if (remaining > 0) {
        const isOwner = a.requestedBy?.role === 'owner' || !a.requestedBy || (typeof a.requestedBy === 'object' && a.requestedBy.username === 'owner');
        if (isOwner) {
          ownerBalance += remaining;
        } else {
          staffBalance += remaining;
        }
      }
    });

    return { totalTaken, totalDeducted, balance, ownerBalance, staffBalance };
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
      const isOwner = a.requestedBy?.role === 'owner' || !a.requestedBy || (typeof a.requestedBy === 'object' && a.requestedBy.username === 'owner');
      timeline.push({
        date: a.date,
        type: 'advance',
        amount: a.amount,
        description: `New Advance: ${a.reason || 'Approved advance request'}`,
        referenceId: a._id,
        source: isOwner ? 'owner' : 'staff',
        requestedByName: a.requestedBy?.name || 'Staff'
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
          referenceId: t._id,
          source: 'owner',
          requestedByName: 'Owner'
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

        {/* Filter selectors (only show if matching the active sub-tab) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Employee Filter - only show in Ledger tab */}
          {activeSubTab === 'ledger' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Employee:</span>
              <select
                className="form-input"
                value={selectedLabourId}
                onChange={e => setSelectedLabourId(e.target.value)}
                style={{ width: '200px', fontWeight: 600 }}
              >
                {labours.map(lab => (
                  <option key={lab._id} value={lab._id}>
                    👤 {lab.name} ({lab.employeeType || 'labourer'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Source Filter - only show in Summary tab */}
          {activeSubTab === 'summary' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Source:</span>
              <select
                className="form-input"
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value as 'all' | 'owner' | 'staff')}
                style={{ width: '160px', fontWeight: 600 }}
              >
                <option value="all">📁 All Sources</option>
                <option value="owner">👑 Direct Owner</option>
                <option value="staff">👤 Staff Approval</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Beautiful Sub tab Navigation */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px', marginBottom: '8px' }}>
        <button
          onClick={() => {
            setActiveSubTab('summary');
            setSelectedLabourId('all');
          }}
          className={`btn ${activeSubTab === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          📊 Outstanding Summary
        </button>
        <button
          onClick={() => {
            setActiveSubTab('ledger');
            if (selectedLabourId === 'all' && labours.length > 0) {
              setSelectedLabourId(labours[0]._id);
            }
          }}
          className={`btn ${activeSubTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          👤 Individual Ledgers
        </button>
        <button
          onClick={() => setActiveSubTab('give-advance')}
          className={`btn ${activeSubTab === 'give-advance' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          💸 Give Direct Advance
        </button>
      </div>

      {/* Summary View (All Employees) */}
      {activeSubTab === 'summary' && (
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
                {(() => {
                  const activeLabours = labours.filter(lab => {
                    const s = getOutstandingStats(lab._id);
                    return s.balance > 0;
                  });

                  if (activeLabours.length === 0) {
                    return (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                          No employees with outstanding advance balance.
                        </td>
                      </tr>
                    );
                  }

                  return activeLabours.map(lab => {
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
                        <td style={{ textAlign: 'right', fontWeight: 750, color: s.balance > 0 ? 'var(--color-danger)' : 'var(--text-muted)', padding: '12px 10px' }}>
                          <div style={{ fontSize: '1.05rem' }}>₹{s.balance.toLocaleString('en-IN')}</div>
                          {s.balance > 0 && sourceFilter === 'all' && (
                            <div style={{ fontSize: '0.72rem', fontWeight: 550, color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {s.ownerBalance > 0 && s.staffBalance > 0 ? (
                                <span>👑 ₹{s.ownerBalance.toLocaleString('en-IN')} + 👤 ₹{s.staffBalance.toLocaleString('en-IN')}</span>
                              ) : s.ownerBalance > 0 ? (
                                <span style={{ color: 'var(--accent-secondary)' }}>👑 Owner Direct</span>
                              ) : (
                                <span>👤 Staff Request</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setSelectedLabourId(lab._id);
                              setActiveSubTab('ledger');
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          >
                            View Ledger
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Individual Employee Ledger View */}
      {activeSubTab === 'ledger' && selectedLabour && stats && (
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
                onClick={() => {
                  setSelectedLabourId('all');
                  setActiveSubTab('summary');
                }}
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
                    <th>Given By / Source</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'right', color: 'var(--accent-secondary)' }}>Outstanding Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData.map((entry, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Calendar size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
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
                      <td>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                          {entry.type === 'advance' ? (
                            entry.source === 'owner' ? (
                              <span style={{ color: 'var(--accent-secondary)' }}>👑 Owner (Direct)</span>
                            ) : (
                              <span>👤 Staff: {entry.requestedByName}</span>
                            )
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>👑 Owner (Payout)</span>
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
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
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

      {/* Give Direct Advance View */}
      {activeSubTab === 'give-advance' && (
        <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          {/* Give Direct Advance Card */}
          <div className="glass-panel glass-panel-glow" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '32px' }}>
            <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
              <h3 className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                💸 Give Direct Advance to Employee
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: 0 }}>
                Record and issue an advance payment directly to any office staff or labourer (pre-approved).
              </p>
            </div>

            <form onSubmit={handleCreateDirectAdvance} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select Employee (Staff / Labourer)</label>
                <select
                  className="form-input"
                  value={directLabId}
                  onChange={e => setDirectLabId(e.target.value)}
                  style={{ height: '42px', fontWeight: 600 }}
                  required
                >
                  {labours.map(lab => (
                    <option key={lab._id} value={lab._id}>
                      👤 {lab.name} ({lab.employeeType || 'labourer'}) - Salary: ₹{lab.monthlySalary.toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Advance Amount (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 5000"
                    value={directAmount}
                    onChange={e => setDirectAmount(e.target.value)}
                    style={{ height: '42px' }}
                    min={1}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Payment Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={directDate}
                    onChange={e => setDirectDate(e.target.value)}
                    style={{ height: '42px' }}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Reason / Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Medical emergency / festival advance"
                  value={directReason}
                  onChange={e => setDirectReason(e.target.value)}
                  style={{ height: '42px' }}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-glow" style={{ width: '100%', marginTop: '12px', padding: '12px', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }} disabled={submittingDirect}>
                <Send size={18} /> {submittingDirect ? 'Issuing...' : 'Issue Direct Advance'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
