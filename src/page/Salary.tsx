import { useState, useEffect } from 'react';
import { FileText, QrCode, Copy, Check, X } from 'lucide-react';
import '../styles/Salary.css';

interface Labour {
  _id: string;
  name: string;
  whatsapp: string;
  monthlySalary: number;
  workingHours?: number;
  imageUrl: string;
  employeeType?: 'labourer' | 'staff';
  department?: string;
  phonePeNumber?: string;
  upiId?: string;
  phonePeQrUrl?: string;
}

interface AttendanceRecord {
  labourId: string;
  date: string;
  status: 'present' | 'half-day' | 'absent' | 'sunday' | 'permission';
  permissionHours?: number;
}

interface AdvanceRequest {
  _id: string;
  labourId: {
    _id: string;
  };
  amount: number;
  deductedAmount?: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface SalaryRecord {
  labour: Labour;
  present: number;
  halfDay: number;
  absent: number;
  sundays: number;
  permissions: number;
  permissionHoursTotal: number;
  totalPaidDays: number;
  dailyRate: number;
  grossSalary: number;
  totalAdvance: number;
  netSalary: number;
  isPaid?: boolean;
  paymentMethod?: 'online' | 'cash';
}

interface SalaryProps {
  token: string | null;
  apiBase: string;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export default function Salary({
  token,
  apiBase,
  showToast
}: SalaryProps) {
  const [salYear, setSalYear] = useState(new Date().getFullYear());
  const [salMonth, setSalMonth] = useState(new Date().getMonth() + 1);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [salLoading, setSalLoading] = useState(false);

  // Payment states
  const [selectedPayRecord, setSelectedPayRecord] = useState<SalaryRecord | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dynamic' | 'static' | 'cash'>('dynamic');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRecordingCash, setIsRecordingCash] = useState(false);
  const [advanceToDeduct, setAdvanceToDeduct] = useState(0);
  const [newAdvanceGiven, setNewAdvanceGiven] = useState(0);

  const calculatedNetSalary = selectedPayRecord 
    ? Math.max(0, selectedPayRecord.grossSalary - advanceToDeduct + newAdvanceGiven)
    : 0;

  const remainingAdvance = selectedPayRecord 
    ? Math.max(0, selectedPayRecord.totalAdvance - advanceToDeduct + newAdvanceGiven)
    : 0;

  const handleAdvanceDeductChange = (val: number) => {
    const capped = Math.min(Math.max(0, val), selectedPayRecord?.totalAdvance || 0);
    setAdvanceToDeduct(capped);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getEmployeeUpiId = (lab: Labour) => {
    if (lab.upiId) return lab.upiId;
    if (lab.phonePeNumber) return `${lab.phonePeNumber}@ybl`;
    return '';
  };

  const getMonthName = (monthNum: number) => {
    return new Date(0, monthNum - 1).toLocaleString('default', { month: 'long' });
  };

  const handleRecordCashPayment = async () => {
    if (!selectedPayRecord) return;
    setIsRecordingCash(true);
    try {
      const res = await fetch(`${apiBase}/expenses/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: calculatedNetSalary,
          date: new Date(),
          category: 'salary-payment',
          description: `Salary paid in cash to ${selectedPayRecord.labour.name} for ${getMonthName(salMonth)} ${salYear}${advanceToDeduct > 0 ? ` (Deducted ₹${advanceToDeduct} advance)` : ''}${newAdvanceGiven > 0 ? ` (Gave ₹${newAdvanceGiven} new advance)` : ''}. Total: ₹${calculatedNetSalary}`,
          labourId: selectedPayRecord.labour._id,
          advanceDeducted: advanceToDeduct,
          newAdvanceGiven: newAdvanceGiven
        })
      });

      if (res.ok) {
        showToast(`Hand cash payment of ₹${calculatedNetSalary.toLocaleString('en-IN')} recorded in expenses ledger!`, 'success');
        setPayModalOpen(false);
        setSelectedPayRecord(null);
        fetchSalarySheet();
      } else {
        showToast('Failed to record cash payment in expenses', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setIsRecordingCash(false);
    }
  };

  const handleRecordOnlinePayment = async () => {
    if (!selectedPayRecord) return;
    setIsRecordingCash(true);
    try {
      const res = await fetch(`${apiBase}/expenses/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: calculatedNetSalary,
          date: new Date(),
          category: 'salary-payment',
          description: `Salary paid online (UPI) to ${selectedPayRecord.labour.name} for ${getMonthName(salMonth)} ${salYear}${advanceToDeduct > 0 ? ` (Deducted ₹${advanceToDeduct} advance)` : ''}${newAdvanceGiven > 0 ? ` (Gave ₹${newAdvanceGiven} new advance)` : ''}. Total: ₹${calculatedNetSalary}`,
          labourId: selectedPayRecord.labour._id,
          advanceDeducted: advanceToDeduct,
          newAdvanceGiven: newAdvanceGiven
        })
      });

      if (res.ok) {
        showToast(`Online payment of ₹${calculatedNetSalary.toLocaleString('en-IN')} marked as paid!`, 'success');
        setPayModalOpen(false);
        setSelectedPayRecord(null);
        fetchSalarySheet();
      } else {
        showToast('Failed to log payment transaction', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setIsRecordingCash(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSalarySheet();
    }
  }, [salMonth, salYear, token]);

  const fetchSalarySheet = async () => {
    setSalLoading(true);
    try {
      // 1. Fetch labours
      const labRes = await fetch(`${apiBase}/labours`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!labRes.ok) throw new Error('Failed to fetch labourers');
      const laboursList: Labour[] = await labRes.json();

      // 2. Fetch attendance for that month
      const attRes = await fetch(`${apiBase}/attendance?month=${salMonth}&year=${salYear}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!attRes.ok) throw new Error('Failed to fetch attendance');
      const attendanceList: AttendanceRecord[] = await attRes.json();

      // 3. Fetch approved advances
      const advRes = await fetch(`${apiBase}/advances?status=approved`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!advRes.ok) throw new Error('Failed to fetch advances');
      const advancesList: AdvanceRequest[] = await advRes.json();

      // 4. Fetch salary payments for this month
      const startDate = new Date(salYear, salMonth - 1, 1).toISOString();
      const endDate = new Date(salYear, salMonth, 0, 23, 59, 59).toISOString();
      const payRes = await fetch(`${apiBase}/expenses?category=salary-payment&startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let paidLabourMap: Record<string, 'online' | 'cash'> = {};
      if (payRes.ok) {
        const paymentsList: any[] = await payRes.json();
        paymentsList.forEach(p => {
          if (!p.labourId) return;
          const id = typeof p.labourId === 'object' ? p.labourId._id : p.labourId;
          const desc = (p.description || '').toLowerCase();
          const method = (desc.includes('online') || desc.includes('upi')) ? 'online' : 'cash';
          paidLabourMap[id] = method;
        });
      }

      const daysInMonth = new Date(salYear, salMonth, 0).getDate();

      // Calculate details for each labourer
      const records = laboursList.map(lab => {
        const labAtt = attendanceList.filter(a => a.labourId === lab._id);
        const labAdv = advancesList.filter(a => a.labourId._id === lab._id);

        let present = 0;
        let halfDay = 0;
        let absent = 0;
        let sundays = 0;
        let permissions = 0;
        let permissionHoursTotal = 0;

        // Iterate through month days to check attendance
        for (let day = 1; day <= daysInMonth; day++) {
          const checkDate = new Date(salYear, salMonth - 1, day);
          const isSunday = checkDate.getDay() === 0;

          const record = labAtt.find(a => new Date(a.date).getDate() === day);
          if (record) {
            if (record.status === 'present') present++;
            else if (record.status === 'half-day') halfDay++;
            else if (record.status === 'absent') absent++;
            else if (record.status === 'sunday') sundays++;
            else if (record.status === 'permission') {
              permissions++;
              permissionHoursTotal += (record.permissionHours || 0);
            }
          } else {
            // Default Sunday
            if (isSunday) sundays++;
            else absent++; // Default is absent if not recorded
          }
        }

        // Use staff's assigned workingHours, defaulting to 8
        const shiftHours = lab.workingHours || 8;
        const permissionPaidContribution = permissions - (permissionHoursTotal / shiftHours);
        const totalPaidDays = Number((present + (halfDay * 0.5) + sundays + permissionPaidContribution).toFixed(2));
        const dailyRate = lab.monthlySalary / daysInMonth;
        const grossSalary = dailyRate * totalPaidDays;

        const totalAdvance = labAdv.reduce((sum, item) => sum + (item.amount - (item.deductedAmount || 0)), 0);
        const netSalary = Math.max(0, grossSalary - totalAdvance);
        const isPaid = !!paidLabourMap[lab._id];
        const paymentMethod = paidLabourMap[lab._id] || undefined;

        return {
          labour: lab,
          present,
          halfDay,
          absent,
          sundays,
          permissions,
          permissionHoursTotal,
          totalPaidDays,
          dailyRate: Math.round(dailyRate),
          grossSalary: Math.round(grossSalary),
          totalAdvance,
          netSalary: Math.round(netSalary),
          isPaid,
          paymentMethod
        };
      });

      setSalaryRecords(records);
    } catch (err) {
      console.error(err);
      showToast('Error calculating salary sheet', 'danger');
    } finally {
      setSalLoading(false);
    }
  };

  return (
    <div className="salary-page-container">
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '2.2rem' }}>Salary Calculations Sheet</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Live salary calculations based on attendance weights and advance deductions.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            className="form-input" 
            value={salMonth} 
            onChange={e => setSalMonth(parseInt(e.target.value))}
            style={{ width: '120px' }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <select 
            className="form-input" 
            value={salYear} 
            onChange={e => setSalYear(parseInt(e.target.value))}
            style={{ width: '100px' }}
          >
            {[2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={() => window.print()} className="btn btn-secondary">
            <FileText size={18} /> Print Sheet
          </button>
        </div>
      </div>

      {/* Salary Table */}
      <div className="glass-panel">
        {salLoading ? (
          <div className="loading-container"><div className="spinner"></div></div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Monthly Salary</th>
                  <th style={{ textAlign: 'center' }}>Present (P)</th>
                  <th style={{ textAlign: 'center' }}>Half-Day (H)</th>
                  <th style={{ textAlign: 'center' }}>Sunday (SUN)</th>
                  <th style={{ textAlign: 'center' }}>Permission (PRM)</th>
                  <th style={{ textAlign: 'center' }}>Absent (A)</th>
                  <th>Paid Days</th>
                  <th>Gross Earned</th>
                  <th>Total Advance</th>
                  <th style={{ color: 'var(--accent-secondary)' }}>Net Payable</th>
                </tr>
              </thead>
              <tbody>
                {salaryRecords.map((rec, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img 
                          src={rec.labour.imageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=50'} 
                          alt={rec.labour.name} 
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                          <span style={{ fontWeight: 600, display: 'block' }}>{rec.labour.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                            {rec.labour.employeeType || 'labourer'} {rec.labour.department ? `• ${rec.labour.department}` : ''}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>₹{rec.labour.monthlySalary.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{rec.present}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{rec.halfDay}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{rec.sundays}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {rec.permissions > 0 ? `${rec.permissions} (${rec.permissionHoursTotal}h)` : '0'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--color-danger)' }}>{rec.absent}</td>
                    <td style={{ fontWeight: 700 }}>{rec.totalPaidDays}</td>
                    <td style={{ fontWeight: 600 }}>₹{rec.grossSalary.toLocaleString('en-IN')}</td>
                    <td style={{ color: rec.totalAdvance > 0 ? 'var(--color-danger)' : 'var(--text-secondary)', fontWeight: 600 }}>
                      ₹{rec.totalAdvance.toLocaleString('en-IN')}
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--color-success)', fontSize: '1.05rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span>₹{rec.netSalary.toLocaleString('en-IN')}</span>
                        {rec.netSalary > 0 && (
                          rec.isPaid ? (
                            rec.paymentMethod === 'online' ? (
                              <span 
                                className="badge badge-success" 
                                style={{ 
                                  padding: '6px 12px', 
                                  fontSize: '0.8rem', 
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: 'var(--color-success)',
                                  border: '1px solid var(--color-success)'
                                }}
                              >
                                Paid (UPI) ✓
                              </span>
                            ) : (
                              <span 
                                className="badge badge-warning" 
                                style={{ 
                                  padding: '6px 12px', 
                                  fontSize: '0.8rem', 
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: '#d97706',
                                  border: '1px solid #f59e0b'
                                }}
                              >
                                Paid (Cash) ✓
                              </span>
                            )
                          ) : (
                            <button 
                              onClick={() => {
                                setSelectedPayRecord(rec);
                                setAdvanceToDeduct(Math.min(rec.grossSalary, rec.totalAdvance));
                                setNewAdvanceGiven(0);
                                setPayModalOpen(true);
                                setActiveTab('dynamic');
                                setIsRecordingCash(false);
                              }}
                              className="btn btn-secondary" 
                              style={{ 
                                padding: '6px 10px', 
                                fontSize: '0.8rem', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                background: 'rgba(108, 92, 231, 0.15)',
                                borderColor: 'var(--accent-secondary)',
                                color: 'var(--accent-secondary)'
                              }}
                              title="Pay via PhonePe / UPI QR"
                            >
                              <QrCode size={14} /> Pay
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {salaryRecords.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '24px' }}>No labourers registered yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: PAY SALARY */}
      {payModalOpen && selectedPayRecord && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          backdropFilter: 'blur(8px)'
        }}>
          <div className="glass-panel glass-panel-glow animate-fade-in" style={{ width: '100%', maxWidth: '460px', padding: '24px 30px', position: 'relative' }}>
            
            {/* Close button */}
            <button 
              onClick={() => { setPayModalOpen(false); setSelectedPayRecord(null); }}
              style={{
                position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none',
                color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>

            <h2 className="gradient-text" style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>₹</span> Pay Salary
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Transfer wages to <strong>{selectedPayRecord.labour.name}</strong> for {getMonthName(salMonth)} {salYear}.
            </p>

            {/* Salary Breakdown & Dynamic Advance Deduction Card */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
              padding: '16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px'
            }}>
              <div className="flex-between">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Gross Salary:</span>
                <span style={{ fontWeight: 600 }}>₹{selectedPayRecord.grossSalary.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex-between">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Existing Advance Balance:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>₹{selectedPayRecord.totalAdvance.toLocaleString('en-IN')}</span>
              </div>

              {/* Advance to Deduct Field */}
              {selectedPayRecord.totalAdvance > 0 && (
                <div style={{ borderTop: '1px dashed var(--glass-border)', paddingTop: '10px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Advance to Deduct from Salary (Minus):</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      type="number"
                      className="form-input"
                      min={0}
                      max={selectedPayRecord.totalAdvance}
                      value={advanceToDeduct}
                      onChange={e => handleAdvanceDeductChange(parseFloat(e.target.value) || 0)}
                      style={{ flexGrow: 1, padding: '6px 12px', fontSize: '0.9rem', fontWeight: 'bold' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setAdvanceToDeduct(0)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                    >
                      Deduct 0
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setAdvanceToDeduct(Math.min(selectedPayRecord.grossSalary, selectedPayRecord.totalAdvance))}
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                    >
                      Deduct Max
                    </button>
                  </div>
                </div>
              )}

              {/* New Advance to Give Field */}
              <div style={{ borderTop: '1px dashed var(--glass-border)', paddingTop: '10px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>New Advance to Give Today (Plus):</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="number"
                    className="form-input"
                    min={0}
                    value={newAdvanceGiven}
                    onChange={e => setNewAdvanceGiven(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ flexGrow: 1, padding: '6px 12px', fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--color-success)' }}
                    placeholder="Enter new advance amount"
                  />
                  <button 
                    type="button" 
                    onClick={() => setNewAdvanceGiven(0)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  >
                    Reset 0
                  </button>
                </div>
              </div>

              {/* Carryover Advance calculation feedback */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                <span>Carryover Advance Balance: <b style={{ color: 'var(--color-danger)' }}>₹{remainingAdvance.toLocaleString('en-IN')}</b></span>
              </div>

              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '10px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Payable Amount</span>
                  <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-success)' }}>
                    ₹{calculatedNetSalary.toLocaleString('en-IN')}
                  </span>
                </div>
                <span className={`badge ${selectedPayRecord.labour.employeeType === 'staff' ? 'badge-warning' : 'badge-info'}`} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                  {selectedPayRecord.labour.employeeType || 'labourer'}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('dynamic')}
                className={`btn ${activeTab === 'dynamic' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flexGrow: 1, padding: '8px 12px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              >
                🚀 Auto QR
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('static')}
                className={`btn ${activeTab === 'static' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flexGrow: 1, padding: '8px 12px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              >
                🖼️ Uploaded QR
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cash')}
                className={`btn ${activeTab === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flexGrow: 1, padding: '8px 12px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              >
                💵 Hand Cash
              </button>
            </div>

            {/* Tab content */}
            {activeTab === 'dynamic' && (
              !selectedPayRecord.labour.upiId && !selectedPayRecord.labour.phonePeNumber ? (
                <div style={{
                  background: 'rgba(235, 77, 75, 0.1)', border: '1px solid rgba(235, 77, 75, 0.3)',
                  padding: '16px', borderRadius: '12px', textAlign: 'center', color: 'var(--color-danger)', fontSize: '0.9rem'
                }}>
                  <p style={{ fontWeight: 600, marginBottom: '8px' }}>Payment Details Missing</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    This employee does not have a PhonePe Number or UPI ID configured. Please configure them in the <strong>Labourers Directory</strong> to generate a QR code.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  {/* UPI QR Display */}
                  <div style={{
                    background: 'white', padding: '16px', borderRadius: '12px', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                        `upi://pay?pa=${getEmployeeUpiId(selectedPayRecord.labour)}&pn=${encodeURIComponent(selectedPayRecord.labour.name)}&am=${calculatedNetSalary}&cu=INR&tn=${encodeURIComponent(`Salary ${getMonthName(salMonth)} ${salYear}`)}`
                      )}`} 
                      alt="Dynamic UPI QR" 
                      style={{ width: '200px', height: '200px' }}
                    />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '-8px' }}>
                    Scan using Google Pay, PhonePe, Paytm or any BHIM UPI App.
                  </p>

                  {/* VPA display and copy */}
                  <div style={{ width: '100%' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Target UPI Address</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        readOnly 
                        className="form-input" 
                        value={getEmployeeUpiId(selectedPayRecord.labour)}
                        style={{ fontFamily: 'monospace', fontSize: '0.9rem', flexGrow: 1 }}
                      />
                      <button 
                        onClick={() => copyToClipboard(getEmployeeUpiId(selectedPayRecord.labour), 'upi')}
                        className="btn btn-secondary"
                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {copiedField === 'upi' ? <Check size={16} style={{ color: 'var(--color-success)' }} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Mark as paid button */}
                  <button
                    type="button"
                    onClick={handleRecordOnlinePayment}
                    className="btn btn-primary"
                    disabled={isRecordingCash}
                    style={{
                      width: '100%', padding: '12px', background: 'rgba(16, 185, 129, 0.15)', borderColor: 'var(--color-success)',
                      color: 'var(--color-success)', fontWeight: 700, fontSize: '0.9rem', marginTop: '8px'
                    }}
                  >
                    {isRecordingCash ? 'Processing...' : 'Mark as Paid (UPI)'}
                  </button>
                </div>
              )
            )}

            {activeTab === 'static' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                {selectedPayRecord.labour.phonePeQrUrl ? (
                  <>
                    <div style={{
                      background: 'white', padding: '12px', borderRadius: '12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <img 
                        src={selectedPayRecord.labour.phonePeQrUrl} 
                        alt="Static PhonePe QR" 
                        style={{ width: '220px', height: '220px', objectFit: 'contain' }}
                      />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '-8px' }}>
                      This is the employee's uploaded static QR Code image.
                    </p>

                    {/* Mark as paid button */}
                    <button
                      type="button"
                      onClick={handleRecordOnlinePayment}
                      className="btn btn-primary"
                      disabled={isRecordingCash}
                      style={{
                        width: '100%', padding: '12px', background: 'rgba(16, 185, 129, 0.15)', borderColor: 'var(--color-success)',
                        color: 'var(--color-success)', fontWeight: 700, fontSize: '0.9rem', marginTop: '8px'
                      }}
                    >
                      {isRecordingCash ? 'Processing...' : 'Mark as Paid (UPI)'}
                    </button>
                  </>
                ) : (
                  <div style={{
                    padding: '32px 16px', background: 'rgba(255,255,255,0.02)',
                    border: '1px dashed var(--glass-border)', borderRadius: '12px',
                    textAlign: 'center', width: '100%', color: 'var(--text-secondary)', fontSize: '0.85rem'
                  }}>
                    No static PhonePe QR Code image uploaded for this employee.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'cash' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '10px 0' }}>
                <div style={{
                  background: 'rgba(255, 159, 67, 0.1)', border: '1px solid rgba(255, 159, 67, 0.3)',
                  padding: '16px', borderRadius: '12px', textAlign: 'center', width: '100%'
                }}>
                  <p style={{ color: 'var(--color-warning)', fontWeight: 600, fontSize: '1.05rem', marginBottom: '6px' }}>Hand Cash Payment</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    If you are paying the salary in physical cash, you can record this as an expense in the cash book instantly.
                  </p>
                </div>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Expense Book Description</span>
                  <textarea
                    className="form-input"
                    style={{ width: '100%', height: '60px', resize: 'none', fontSize: '0.85rem', padding: '8px 12px' }}
                    value={`Salary paid in cash to ${selectedPayRecord.labour.name} for ${getMonthName(salMonth)} ${salYear}`}
                    readOnly
                  />
                </div>

                <button
                  type="button"
                  onClick={handleRecordCashPayment}
                  className="btn btn-primary"
                  disabled={isRecordingCash}
                  style={{
                    width: '100%', padding: '14px', background: 'var(--color-success)', borderColor: 'var(--color-success)',
                    fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  {isRecordingCash ? 'Recording...' : `Record Payment of ₹${calculatedNetSalary.toLocaleString('en-IN')}`}
                </button>
              </div>
            )}

            {/* Additional Payment Info Fields (PhonePe Phone number & UPI ID copy cards) */}
            {activeTab !== 'cash' && (selectedPayRecord.labour.phonePeNumber || selectedPayRecord.labour.upiId) && (
              <div style={{ marginTop: '24px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  
                  {selectedPayRecord.labour.phonePeNumber && (
                    <div style={{
                      display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
                      padding: '10px 14px', borderRadius: '10px'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>PhonePe Number</span>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{selectedPayRecord.labour.phonePeNumber}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => copyToClipboard(selectedPayRecord.labour.phonePeNumber || '', 'phone')}
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                      >
                        {copiedField === 'phone' ? (
                          <>
                            <Check size={14} style={{ color: 'var(--color-success)' }} /> Copied
                          </>
                        ) : (
                          <>
                            <Copy size={14} /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {selectedPayRecord.labour.upiId && (
                    <div style={{
                      display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
                      padding: '10px 14px', borderRadius: '10px'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Original UPI ID</span>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{selectedPayRecord.labour.upiId}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => copyToClipboard(selectedPayRecord.labour.upiId || '', 'orig-upi')}
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                      >
                        {copiedField === 'orig-upi' ? (
                          <>
                            <Check size={14} style={{ color: 'var(--color-success)' }} /> Copied
                          </>
                        ) : (
                          <>
                            <Copy size={14} /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  )}

                </div>
              )}

            {/* Bottom Actions */}
            <div style={{ display: 'flex', marginTop: '24px' }}>
              <button 
                onClick={() => { setPayModalOpen(false); setSelectedPayRecord(null); }}
                className="btn btn-secondary" 
                style={{ width: '100%', padding: '12px' }}
              >
                Close Payment Modal
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
