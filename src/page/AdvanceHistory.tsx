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
}

export default function AdvanceHistory({
  token,
  apiBase,
  labours,
  advances,
  expenses,
  showToast
}: AdvanceHistoryProps) {
  const [selectedLabourId, setSelectedLabourId] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'owner' | 'staff'>('all');
  const [localExpenses, setLocalExpenses] = useState<CashTx[]>(expenses || []);

  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'ledger' | 'delay-alerts'>('summary');

  // Form states for Salary Delay notice
  const [delayDays, setDelayDays] = useState<number>(5);
  const [delayMonth, setDelayMonth] = useState<number>(new Date().getMonth() + 1);
  const [delayYear, setDelayYear] = useState<number>(new Date().getFullYear());
  
  const getDefaultExpectedDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };
  const [expectedDate, setExpectedDate] = useState<string>(getDefaultExpectedDate(5));
  const [delayReason, setDelayReason] = useState<string>('');
  const [submittingNotice, setSubmittingNotice] = useState<boolean>(false);
  const [delayNotices, setDelayNotices] = useState<any[]>([]);
  const [loadingNotices, setLoadingNotices] = useState<boolean>(false);

  // Fetch salary delay notices on mount
  useEffect(() => {
    if (token) {
      fetchDelayNotices();
    }
  }, [token]);

  const fetchDelayNotices = async () => {
    setLoadingNotices(true);
    try {
      const res = await fetch(`${apiBase}/reminders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Filter only salary-delay type notices
        const filtered = data.filter((rem: any) => rem.type === 'salary-delay');
        setDelayNotices(filtered);
      }
    } catch (err) {
      console.error('Error fetching delay notices:', err);
    } finally {
      setLoadingNotices(false);
    }
  };

  const handleCreateDelayNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delayDays || !expectedDate) return;
    setSubmittingNotice(true);

    const monthName = new Date(0, delayMonth - 1).toLocaleString('default', { month: 'long' });
    const formattedExpDate = new Date(expectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    
    // Construct the standard message
    const message = `⚠️ Salary for ${monthName} ${delayYear} is delayed by ${delayDays} days. It will be paid around ${formattedExpDate}. If anyone needs an advance, please apply now.${delayReason ? ` Reason: ${delayReason}` : ''}`;

    try {
      const res = await fetch(`${apiBase}/reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message,
          targetDate: expectedDate,
          type: 'salary-delay'
        })
      });

      if (res.ok) {
        setDelayReason('');
        showToast('Salary delay notice broadcasted successfully!', 'success');
        fetchDelayNotices();
      } else {
        showToast('Failed to broadcast salary delay notice', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setSubmittingNotice(false);
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
  const stats = selectedLabourId !== 'all' ? getOutstandingStats(selectedLabourId) :  return (
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
          onClick={() => setActiveSubTab('delay-alerts')}
          className={`btn ${activeSubTab === 'delay-alerts' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          📢 Salary Delay Alerts
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

      {/* Salary Delay Broadcast & History View */}
      {activeSubTab === 'delay-alerts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Post notice card */}
          <div className="glass-panel" style={{ height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📢 Broadcast Salary Delay Notice
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Announce a salary payout delay to all office staff and workers, prompting them to request advances if needed.
            </p>

            <form onSubmit={handleCreateDelayNotice} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Salary Month</label>
                  <select
                    className="form-input"
                    value={delayMonth}
                    onChange={e => setDelayMonth(parseInt(e.target.value, 10))}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Salary Year</label>
                  <input
                    type="number"
                    className="form-input"
                    value={delayYear}
                    onChange={e => setDelayYear(parseInt(e.target.value, 10))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Delay Days</label>
                  <input
                    type="number"
                    className="form-input"
                    value={delayDays}
                    onChange={e => {
                      const days = parseInt(e.target.value, 10) || 0;
                      setDelayDays(days);
                      setExpectedDate(getDefaultExpectedDate(days));
                    }}
                    min={1}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Expected Payout Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={expectedDate}
                    onChange={e => setExpectedDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Additional Note / Reason (Optional)</label>
                <textarea
                  className="form-input"
                  placeholder="e.g. Due to bank holiday weekend / cash flow clearance delay..."
                  value={delayReason}
                  onChange={e => setDelayReason(e.target.value)}
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              {/* Preview Box */}
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px dashed rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '12px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-danger)', display: 'block', marginBottom: '4px' }}>
                  Live Preview of Notice:
                </span>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: '1.4' }}>
                  ⚠️ Salary for {new Date(0, delayMonth - 1).toLocaleString('default', { month: 'long' })} {delayYear} is delayed by {delayDays} days. It will be paid around {new Date(expectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}. If anyone needs an advance, please apply now.{delayReason ? ` Reason: ${delayReason}` : ''}
                </p>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={submittingNotice}>
                <Send size={16} /> {submittingNotice ? 'Broadcasting...' : 'Broadcast Notice to Staff'}
              </button>
            </form>
          </div>

          {/* Notice history card */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📢 Broadcast History
            </h3>

            {loadingNotices ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading history...</div>
            ) : delayNotices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                No salary delay notices broadcasted yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '480px', paddingRight: '4px' }}>
                {delayNotices.map((notice) => (
                  <div key={notice._id} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="badge badge-danger" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                        Expected Payout: {new Date(notice.targetDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className={`badge ${notice.status === 'acknowledged' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                        {notice.status}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.92rem', fontWeight: 600, margin: '8px 0', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                      {notice.message}
                    </p>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '12px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '8px' }}>
                      Broadcasted on {new Date(notice.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {notice.status === 'acknowledged' && notice.acknowledgedBy && (
                        <div style={{ marginTop: '4px', color: 'var(--color-success)', fontWeight: 600 }}>
                          ✅ Acknowledged by {notice.acknowledgedBy.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
