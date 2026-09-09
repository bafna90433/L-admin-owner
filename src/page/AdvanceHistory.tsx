import { useState, useEffect, useRef } from 'react';
import { History, Calendar, ArrowDownCircle, ArrowUpCircle, Send, Printer, Download, FileText, Wallet, Receipt, BarChart3, UserRound } from 'lucide-react';
import jsPDF from 'jspdf';
import '../styles/AdvanceHistory.css';

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
  expenseTxId?: any;
}

interface CashTx {
  _id: string;
  txType: 'received' | 'expense';
  category: string;
  amount: number;
  date: string;
  description: string;
  paymentMode?: 'online' | 'handcash';
  labourId?: {
    _id: string;
    name: string;
  } | string;
}

// Wages are worked out on a 30-day month by default; MD can switch it to 28,
// 31 or anything else per settlement.
const DEFAULT_DAYS_IN_MONTH = 30;

/** Everything printed on one salary slip. */
interface SalarySlip {
  name: string;
  month: string;
  monthDays: number;
  perDay: number;
  salary: number;
  ot: number;
  absentDays: number;
  absent: number;
  halfDays: number;
  half: number;
  permission: number;
  toys: number;
  old: number;
  total: number;
  mode: 'handcash' | 'online';
  note: string;
  paidOn: string;
}

// CashTx has no room for a structured breakdown, so the slip rides along in
// the description as a compact base64 tag. Every description parser in the
// apps strips it, so it is never shown to anyone as raw text.
const encodeSlipTag = (slip: SalarySlip): string => {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(slip));
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return `[SLIP:${btoa(binary)}]`;
  } catch {
    return '';
  }
};

const decodeSlipTag = (description: string): SalarySlip | null => {
  const match = String(description || '').match(/\[SLIP:([^\]]*)\]/);
  if (!match || !match[1]) return null;
  try {
    const binary = atob(match[1]);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as SalarySlip;
  } catch {
    return null;
  }
};

const rupees = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** The seven rows of the paper slip, in order. */
const slipRows = (slip: SalarySlip) => [
  { label: 'SALARY +', value: slip.salary, sign: '+', note: slip.perDay > 0 ? `${slip.monthDays} days × ${rupees(slip.perDay)}` : '' },
  { label: 'OT +', value: slip.ot, sign: '+', note: '' },
  { label: 'ABSENT −', value: slip.absent, sign: '-', note: slip.absentDays > 0 ? `${slip.absentDays} day${slip.absentDays === 1 ? '' : 's'}` : '' },
  { label: 'HALF DAY −', value: slip.half, sign: '-', note: slip.halfDays > 0 ? `${slip.halfDays} day${slip.halfDays === 1 ? '' : 's'} × ½` : '' },
  { label: 'PERMISSION −', value: slip.permission, sign: '-', note: '' },
  { label: 'TOYS −', value: slip.toys, sign: '-', note: '' },
  { label: 'OLD BALANCE −', value: slip.old, sign: '-', note: '' }
];

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

/**
 * Searchable employee picker. The chosen employee stays visible as a chip and
 * the search box only ever holds what is being typed, so a different employee
 * can be picked at any time without clearing anything first.
 */
function EmployeePicker({
  labours,
  value,
  onChange,
  hint
}: {
  labours: Labour[];
  value: string;
  onChange: (id: string) => void;
  hint?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const selected = labours.find(l => l._id === value);
  const filtered = labours.filter(lab => lab.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const choose = (id: string) => {
    onChange(id);
    setQuery('');
    setOpen(false);
    setHighlight(0);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setHighlight(0);
    setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (filtered.length === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight(prev => (prev + step + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      if (open && filtered[highlight]) {
        e.preventDefault();
        choose(filtered[highlight]._id);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && !query && value) {
      clear();
    }
  };

  return (
    <>
      <div ref={boxRef} style={{ position: 'relative' }}>
        <div
          onClick={() => setOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            border: `1px solid ${open ? 'var(--btn-primary-bg)' : 'var(--glass-border)'}`,
            boxShadow: open ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
            borderRadius: '10px', background: 'var(--bg-secondary)',
            minHeight: '46px', padding: '0 10px', cursor: 'text',
            transition: 'border-color 0.15s, box-shadow 0.15s'
          }}
        >
          <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>🔍</span>

          {selected && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.32)',
              color: 'var(--text-primary)',
              borderRadius: '9999px', padding: '4px 6px 4px 10px',
              fontSize: '0.85rem', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap'
            }}>
              {selected.name}
              <small style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                ({selected.employeeType || 'labourer'})
              </small>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); clear(); }}
                title="Clear and choose someone else"
                style={{
                  border: 'none', background: 'rgba(99, 102, 241, 0.2)',
                  color: 'var(--text-primary)', cursor: 'pointer',
                  width: '19px', height: '19px', borderRadius: '50%',
                  display: 'grid', placeItems: 'center', fontSize: '0.72rem',
                  lineHeight: 1, padding: 0
                }}
              >
                ✕
              </button>
            </span>
          )}

          <input
            type="text"
            placeholder={selected ? 'Change employee...' : 'Search employee by name...'}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
            onKeyDown={handleKeyDown}
            style={{ flex: 1, minWidth: '110px', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.95rem', height: '44px', padding: 0 }}
          />

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
            title={open ? 'Hide list' : 'Show all employees'}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: '0.8rem', flexShrink: 0,
              padding: '4px 2px', transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s'
            }}
          >
            ▼
          </button>
        </div>

        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            maxHeight: '280px', overflowY: 'auto',
            background: 'var(--bg-primary, #ffffff)',
            border: '1px solid var(--glass-border)',
            borderRadius: '12px',
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
            zIndex: 80, padding: '6px'
          }}>
            <div style={{ padding: '6px 10px 8px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              {filtered.length} {filtered.length === 1 ? 'employee' : 'employees'}
              {query ? ` matching "${query}"` : ' available'}
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '14px 12px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                No employee found. Try a different name.
              </div>
            ) : (
              filtered.map((lab, idx) => {
                const isChosen = lab._id === value;
                const isActive = idx === highlight;
                return (
                  <button
                    key={lab._id}
                    type="button"
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => choose(lab._id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: '10px',
                      padding: '9px 11px', borderRadius: '8px',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                      color: 'var(--text-primary)', fontSize: '0.9rem',
                      fontWeight: isChosen ? 750 : 500
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      {isChosen && <span aria-hidden="true" style={{ color: 'var(--color-success)' }}>✓</span>}
                      {lab.name}
                    </span>
                    <small style={{
                      color: 'var(--text-secondary)', fontSize: '0.72rem',
                      textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700
                    }}>
                      {lab.employeeType || 'labourer'}
                    </small>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {!selected && hint && (
        <small style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{hint}</small>
      )}
    </>
  );
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

  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'ledger' | 'give-advance' | 'settle' | 'slips'>('give-advance');
  const [openSlip, setOpenSlip] = useState<SalarySlip | null>(null);

  // Form states for recovering an outstanding advance out of a salary payment
  const [settleLabId, setSettleLabId] = useState<string>('');
  const [settleSalary, setSettleSalary] = useState<string>('');
  const [settlePerDay, setSettlePerDay] = useState<string>('');
  const [settleMonthDays, setSettleMonthDays] = useState<string>(String(DEFAULT_DAYS_IN_MONTH));
  const [settleOt, setSettleOt] = useState<string>('');
  const [settleAbsentDays, setSettleAbsentDays] = useState<string>('');
  const [settleHalfDayCount, setSettleHalfDayCount] = useState<string>('');
  const [settlePermission, setSettlePermission] = useState<string>('');
  const [settleToys, setSettleToys] = useState<string>('');
  const [settleDeduct, setSettleDeduct] = useState<string>('');
  const [settleNote, setSettleNote] = useState<string>('');
  const [settleMode, setSettleMode] = useState<'handcash' | 'online'>('handcash');
  const [settleConfirmOpen, setSettleConfirmOpen] = useState(false);
  const [submittingSettle, setSubmittingSettle] = useState(false);

  // Form states for giving Direct Advance
  const [directLabId, setDirectLabId] = useState<string>('');
  const [directAmount, setDirectAmount] = useState<string>('');
  const [directReason, setDirectReason] = useState<string>('');
  const [submittingDirect, setSubmittingDirect] = useState<boolean>(false);
  const [monthlyAttendance, setMonthlyAttendance] = useState<any[]>([]);

  // Salary starts as a full 30-day month at the per-day rate. Absent and
  // half days are then cut off it in days, exactly like the paper slip.
  useEffect(() => {
    setSettleOt('');
    setSettlePermission('');
    setSettleToys('');
    if (!settleLabId) {
      setSettleSalary('');
      setSettlePerDay('');
      setSettleAbsentDays('');
      setSettleHalfDayCount('');
      setSettleDeduct('');
      return;
    }

    const emp = labours.find(l => l._id === settleLabId);
    const days = Math.max(1, Number(settleMonthDays) || DEFAULT_DAYS_IN_MONTH);
    const monthly = emp?.monthlySalary || 0;
    setSettleSalary(monthly > 0 ? String(monthly) : '');
    setSettlePerDay(monthly > 0 ? String(Math.round((monthly / days) * 100) / 100) : '');

    // Prefill the day counts from whatever attendance is already marked.
    const records = monthlyAttendance.filter(rec => {
      const id = typeof rec.labourId === 'object' ? rec.labourId?._id : rec.labourId;
      return id === settleLabId;
    });
    setSettleAbsentDays(String(records.filter(r => r.status === 'absent').length));
    setSettleHalfDayCount(String(records.filter(r => r.status === 'half-day').length));

    const outstanding = getOutstandingStats(settleLabId).balance;
    setSettleDeduct(outstanding > 0 ? String(outstanding) : '0');
    // Recomputing on every advances change would fight MD's own edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleLabId]);

  // Salary and per-day rate are two views of the same number, tied together by
  // the days in the month. Editing either one refreshes the other, and changing
  // the month length keeps the monthly salary and re-derives the daily rate.
  const settleMonthDaysNum = Math.max(1, Number(settleMonthDays) || DEFAULT_DAYS_IN_MONTH);

  const handlePerDayChange = (value: string) => {
    setSettlePerDay(value);
    const perDay = Math.max(0, Number(value) || 0);
    setSettleSalary(perDay > 0 ? String(Math.round(perDay * settleMonthDaysNum)) : '');
  };

  const handleSalaryChange = (value: string) => {
    setSettleSalary(value);
    const salary = Math.max(0, Number(value) || 0);
    setSettlePerDay(salary > 0 ? String(Math.round((salary / settleMonthDaysNum) * 100) / 100) : '');
  };

  const handleMonthDaysChange = (value: string) => {
    setSettleMonthDays(value);
    const days = Math.max(1, Number(value) || 0);
    const salary = Math.max(0, Number(settleSalary) || 0);
    if (salary > 0) {
      setSettlePerDay(String(Math.round((salary / days) * 100) / 100));
    }
  };

  // Fetch current month's attendance records to calculate duties
  useEffect(() => {
    if (token) {
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      fetch(`${apiBase}/attendance?month=${month}&year=${year}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : [])
        .then(data => setMonthlyAttendance(data))
        .catch(err => console.error('Error fetching attendance in advance history:', err));
    }
  }, [token, apiBase]);

  const handleCreateDirectAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directLabId) {
      showToast('Select the employee who is receiving this advance', 'warning');
      return;
    }
    if (!directAmount) return;
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
          reason: directReason
        })
      });

      if (res.ok) {
        setDirectAmount('');
        setDirectReason('');
        setDirectLabId('');
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

  const handleSettleSalary = async () => {
    if (!settleLabEmp) return;
    setSubmittingSettle(true);
    setSettleConfirmOpen(false);

    const monthLabel = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    const slip: SalarySlip = {
      name: settleLabEmp.name,
      month: monthLabel,
      monthDays: settleMonthDaysNum,
      perDay: settlePerDayNum,
      salary: settleSalaryNum,
      ot: settleOtNum,
      absentDays: settleAbsentDaysNum,
      absent: settleAbsentNum,
      halfDays: settleHalfDayCountNum,
      half: settleHalfDayNum,
      permission: settlePermissionNum,
      toys: settleToysNum,
      old: settleDeductNum,
      total: settleNetPayable,
      mode: settleMode,
      note: settleNote.trim(),
      paidOn: new Date().toISOString()
    };

    // Keep the whole slip in the description so the ledger shows the same
    // breakdown MD writes on paper.
    const basis = settlePerDayNum > 0
      ? ` (${settleMonthDaysNum}-day month at ${money(settlePerDayNum)}/day, ${settleDutyDaysNum} duty days worked)`
      : '';
    const parts: string[] = [`Salary ${money(settleSalaryNum)}${basis}`];
    if (settleOtNum > 0) parts.push(`OT +${money(settleOtNum)}`);
    if (settleAbsentNum > 0) parts.push(`Absent ${settleAbsentDaysNum}d -${money(settleAbsentNum)}`);
    if (settleHalfDayNum > 0) parts.push(`Half day ${settleHalfDayCountNum}d -${money(settleHalfDayNum)}`);
    if (settlePermissionNum > 0) parts.push(`Permission -${money(settlePermissionNum)}`);
    if (settleToysNum > 0) parts.push(`Toys -${money(settleToysNum)}`);
    if (settleDeductNum > 0) parts.push(`Old balance -${money(settleDeductNum)}`);

    const summary = `Salary paid to ${settleLabEmp.name} for ${monthLabel}. ${parts.join(', ')} = ${money(settleNetPayable)}`;
    const readable = settleNote.trim()
      ? `${summary}. Reason: ${settleNote.trim()}`
      : `${summary}.`;
    const description = `${readable} ${encodeSlipTag(slip)}`.trim();

    try {
      const res = await fetch(`${apiBase}/expenses/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: settleNetPayable,
          date: new Date(),
          category: 'salary-payment',
          description,
          labourId: settleLabId,
          advanceDeducted: settleDeductNum,
          paymentMode: settleMode
        })
      });

      if (res.ok) {
        showToast(
          settleDeductNum > 0
            ? `Salary settled. ₹${settleDeductNum.toLocaleString('en-IN')} advance recovered from ${settleLabEmp.name}.`
            : `Salary paid to ${settleLabEmp.name}.`,
          'success'
        );
        setSettleLabId('');
        setSettleSalary('');
        setSettlePerDay('');
        setSettleOt('');
        setSettleAbsentDays('');
        setSettleHalfDayCount('');
        setSettlePermission('');
        setSettleToys('');
        setSettleDeduct('');
        setSettleNote('');
        fetchAdvances();
        fetchDashboardData();
        fetchFullExpenses();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'Failed to record the salary payment', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setSubmittingSettle(false);
    }
  };

  // The slip is printed from its own window so the dashboard's styles, sidebar
  // and dark theme cannot leak into the printout.
  const printSlip = (slip: SalarySlip) => {
    const win = window.open('', '_blank', 'width=420,height=640');
    if (!win) {
      showToast('Allow pop-ups for this site to print the slip', 'warning');
      return;
    }
    const rows = slipRows(slip).map(row => `
      <tr>
        <td class="label">${row.label}${row.note ? `<span class="note">${row.note}</span>` : ''}</td>
        <td class="value ${row.sign === '+' ? 'plus' : 'minus'}">${row.value === 0 ? '—' : `${row.sign === '+' ? '' : '- '}${rupees(row.value)}`}</td>
      </tr>`).join('');

    win.document.write(`<!doctype html><html><head><meta charset="utf-8" />
      <title>Salary Slip - ${slip.name}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 18px; color: #111; }
        h1 { font-size: 17px; margin: 0 0 2px; }
        .sub { font-size: 12px; color: #555; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; border: 1px solid #111; }
        td { border-bottom: 1px solid #111; padding: 9px 11px; font-size: 13px; }
        td.label { font-weight: bold; letter-spacing: 0.4px; }
        td.value { text-align: right; font-weight: bold; white-space: nowrap; }
        .note { display: block; font-weight: normal; font-size: 10px; color: #555; letter-spacing: 0; }
        .plus { color: #067647; }
        .minus { color: #b42318; }
        tr.total td { border-bottom: none; font-size: 16px; background: #f0f0f0; }
        .foot { margin-top: 14px; font-size: 11px; color: #555; }
        .sign { margin-top: 34px; display: flex; justify-content: space-between; font-size: 11px; }
        .sign span { border-top: 1px solid #111; padding-top: 4px; width: 42%; text-align: center; }
        @media print { body { padding: 8px; } }
      </style></head><body>
      <h1>OFFICE PRO — Salary Slip</h1>
      <div class="sub">${slip.name} · ${slip.month}</div>
      <table>${rows}
        <tr class="total"><td class="label">TOTAL</td><td class="value">${rupees(slip.total)}</td></tr>
      </table>
      <div class="foot">
        Paid by ${slip.mode === 'online' ? 'Online / Bank' : 'Handcash'} on ${new Date(slip.paidOn).toLocaleDateString('en-GB')}
        ${slip.note ? `<br/>Note: ${slip.note}` : ''}
      </div>
      <div class="sign"><span>Employee Signature</span><span>Managing Director</span></div>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const downloadSlipPdf = (slip: SalarySlip) => {
    // jsPDF's built-in fonts have no rupee glyph, so the PDF says Rs.
    const rs = (n: number) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
    const doc = new jsPDF({ unit: 'pt', format: 'a5' });
    const left = 40;
    const right = 380;
    let y = 56;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('OFFICE PRO - Salary Slip', left, y);

    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(90);
    doc.text(`${slip.name}  ·  ${slip.month}`, left, y);
    doc.setTextColor(0);

    y += 18;
    doc.setLineWidth(1);
    doc.rect(left, y, right - left, 0.1);

    slipRows(slip).forEach(row => {
      y += 26;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(row.label.replace('−', '-'), left + 8, y);
      const amount = row.value === 0 ? '-' : `${row.sign === '+' ? '' : '- '}${rs(row.value)}`;
      doc.text(amount, right - 8, y, { align: 'right' });
      if (row.note) {
        y += 11;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(110);
        doc.text(row.note.replace('×', 'x').replace('½', '1/2'), left + 8, y);
        doc.setTextColor(0);
      }
      doc.setLineWidth(0.5);
      doc.line(left, y + 8, right, y + 8);
    });

    y += 32;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('TOTAL', left + 8, y);
    doc.text(rs(slip.total), right - 8, y, { align: 'right' });
    doc.setLineWidth(1);
    doc.line(left, y + 10, right, y + 10);

    y += 34;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Paid by ${slip.mode === 'online' ? 'Online / Bank' : 'Handcash'} on ${new Date(slip.paidOn).toLocaleDateString('en-GB')}`, left, y);
    if (slip.note) {
      y += 13;
      doc.text(`Note: ${slip.note}`, left, y);
    }

    y += 46;
    doc.setTextColor(0);
    doc.setLineWidth(0.5);
    doc.line(left, y, left + 130, y);
    doc.line(right - 130, y, right, y);
    y += 12;
    doc.setFontSize(8);
    doc.text('Employee Signature', left, y);
    doc.text('Managing Director', right, y, { align: 'right' });

    const safeName = slip.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
    doc.save(`salary-slip-${safeName}-${slip.month.replace(/\s+/g, '-')}.pdf`);
  };

  // Every salary settlement already recorded, newest first.
  const savedSlips = localExpenses
    .filter(t => t.category === 'salary-payment')
    .map(t => ({ tx: t, slip: decodeSlipTag(t.description || '') }))
    .sort((a, b) => new Date(b.tx.date).getTime() - new Date(a.tx.date).getTime());

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

  // Each advance still owed by an employee, with when it was taken and how
  // much of it is left, so MD can see what a recovery is actually clearing.
  const getPendingAdvanceDetails = (labId: string) => {
    const labAdvances = advances.filter(a => {
      const id = typeof a.labourId === 'object' ? a.labourId?._id : a.labourId;
      return id === labId && a.status === 'approved';
    });

    const linkedTxIds = new Set(
      labAdvances
        .map(a => a.expenseTxId ? (typeof a.expenseTxId === 'object' ? (a.expenseTxId as any)._id : a.expenseTxId) : '')
        .filter(Boolean)
    );

    const fromRequests = labAdvances.map(a => ({
      id: String(a._id),
      date: a.date,
      amount: a.amount,
      recovered: a.deductedAmount || 0,
      remaining: a.amount - (a.deductedAmount || 0),
      reason: String(a.reason || ''),
      by: a.requestedBy?.name || ''
    }));

    const fromOrphanTxs = localExpenses
      .filter(t => {
        const id = typeof t.labourId === 'object' ? t.labourId?._id : t.labourId;
        const isAdv = t.category === 'salary-advance'
          || t.category === 'Labour Advance'
          || (t.category || '').toLowerCase().includes('advance');
        return id === labId && isAdv && !linkedTxIds.has(t._id);
      })
      .map(t => ({
        id: String(t._id),
        date: t.date,
        amount: t.amount,
        recovered: 0,
        remaining: t.amount,
        reason: String(t.description || ''),
        by: ''
      }));

    return [...fromRequests, ...fromOrphanTxs]
      .filter(entry => entry.remaining > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const daysAgo = (date: string) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (diff <= 0) return 'today';
    if (diff === 1) return 'yesterday';
    if (diff < 30) return `${diff} days ago`;
    const months = Math.floor(diff / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  };

  // Strip the tags and markers so the note reads like a plain reason.
  const cleanAdvanceReason = (raw: string) => {
    const text = String(raw || '')
      .replace(/\[Staff:\s*[^\]]+\]/g, '')
      .replace(/\[SLIP:[^\]]*\]/g, '')
      .replace(/\((Auto-Approved|Approved by Owner|By Owner|MD Instructed)\)/g, '')
      .replace(/^(direct\s+)?advance\s+paid\s+to\s*/i, '')
      .replace(/\s+/g, ' ')
      .replace(/^[-–—:\s]+|[-–—:\s.]+$/g, '')
      .trim();
    return text;
  };

  const getOutstandingStats = (labId: string) => {
    const labAdvances = advances.filter(a => {
      const id = typeof a.labourId === 'object' ? a.labourId?._id : a.labourId;
      return id === labId && a.status === 'approved';
    });

    // Also include any CashTx direct advance expenses that don't have an AdvanceRequest linked yet
    const existingTxIds = new Set(
      labAdvances.map(a => a.expenseTxId ? (typeof a.expenseTxId === 'object' ? (a.expenseTxId as any)._id : a.expenseTxId) : '').filter(Boolean)
    );

    const orphanAdvanceTxs = localExpenses.filter(t => {
      const id = typeof t.labourId === 'object' ? t.labourId?._id : t.labourId;
      const isAdv = t.category === 'salary-advance' || t.category === 'Labour Advance' || (t.category || '').toLowerCase().includes('advance');
      return id === labId && isAdv && !existingTxIds.has(t._id);
    });

    const orphanTotal = orphanAdvanceTxs.reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalTaken = labAdvances.reduce((sum, a) => sum + a.amount, 0) + orphanTotal;
    const totalDeducted = labAdvances.reduce((sum, a) => sum + (a.deductedAmount || 0), 0);
    const balance = totalTaken - totalDeducted;

    // Calculate source breakdowns for outstanding balance
    let ownerBalance = 0;
    let staffBalance = orphanTotal;

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

    // Also include any orphan direct advances from CashTx if not linked to AdvanceRequest
    const existingTxIds = new Set(
      labAdvances.map(a => a.expenseTxId ? (typeof a.expenseTxId === 'object' ? (a.expenseTxId as any)._id : a.expenseTxId) : '').filter(Boolean)
    );

    const orphanAdvanceTxs = localExpenses.filter(t => {
      const id = typeof t.labourId === 'object' ? t.labourId?._id : t.labourId;
      const isAdv = t.category === 'salary-advance' || t.category === 'Labour Advance' || (t.category || '').toLowerCase().includes('advance');
      return id === labId && isAdv && !existingTxIds.has(t._id);
    });

    orphanAdvanceTxs.forEach(t => {
      timeline.push({
        date: t.date,
        type: 'advance',
        amount: t.amount,
        description: `Direct Advance (Petty Cash): ${t.description || 'Advance logged by staff'}`,
        referenceId: t._id,
        source: 'staff',
        requestedByName: 'Staff'
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

  // Salary settlement working values
  const settleLabEmp = labours.find(l => l._id === settleLabId);
  const settleOutstanding = settleLabEmp ? getOutstandingStats(settleLabEmp._id).balance : 0;
  const settlePendingAdvances = settleLabEmp ? getPendingAdvanceDetails(settleLabEmp._id) : [];
  // The slip MD writes by hand: salary + OT, minus absent, permission, toys
  // taken from the company, and whatever old balance is still pending.
  const settlePerDayNum = Math.max(0, Number(settlePerDay) || 0);
  const settleSalaryNum = Math.max(0, Number(settleSalary) || 0);
  const settleOtNum = Math.max(0, Number(settleOt) || 0);

  // Absent and half days are entered as days; the money is worked out from the
  // per-day rate, and a half day costs half a day's pay.
  const settleAbsentDaysNum = Math.max(0, Number(settleAbsentDays) || 0);
  const settleHalfDayCountNum = Math.max(0, Number(settleHalfDayCount) || 0);
  const settleAbsentNum = Math.round(settleAbsentDaysNum * settlePerDayNum);
  const settleHalfDayNum = Math.round(settleHalfDayCountNum * settlePerDayNum * 0.5);
  const settleDutyDaysNum = Math.max(0, settleMonthDaysNum - settleAbsentDaysNum - (settleHalfDayCountNum * 0.5));
  const settlePermissionNum = Math.max(0, Number(settlePermission) || 0);
  const settleToysNum = Math.max(0, Number(settleToys) || 0);
  const settleDeductNum = Math.max(0, Number(settleDeduct) || 0);

  const settleEarnings = settleSalaryNum + settleOtNum;
  const settleDeductions = settleAbsentNum + settleHalfDayNum + settlePermissionNum + settleToysNum + settleDeductNum;
  const settleTotal = settleEarnings - settleDeductions;
  const settleNetPayable = Math.max(0, settleTotal);
  const settleRemainingAdvance = Math.max(0, settleOutstanding - settleDeductNum);
  const settleOverRecovering = settleDeductNum > settleOutstanding;
  const settleNegative = settleTotal < 0;
  const settleReady = Boolean(settleLabEmp) && settleEarnings > 0 && !settleOverRecovering && !settleNegative;

  // Current month attendance for the employee being settled, shown only as a
  // reference so MD can work out the absent / permission cuts.
  const settleAttendance = settleLabEmp ? monthlyAttendance.filter(rec => {
    const id = typeof rec.labourId === 'object' ? rec.labourId?._id : rec.labourId;
    return id === settleLabEmp._id;
  }) : [];
  const settlePresentDays = settleAttendance.filter(r => r.status === 'present').length;
  const settleAbsentDays_fromAttendance = settleAttendance.filter(r => r.status === 'absent').length;
  const settleHalfDays = settleAttendance.filter(r => r.status === 'half-day').length;
  const settlePermissionDays = settleAttendance.filter(r => r.status === 'permission').length;
  const settleMarkedDuties = settlePresentDays + (settleHalfDays * 0.5);

  // The slip as it stands in the form right now, so it can be printed or saved
  // as a PDF before the payment is even recorded.
  const currentSlipDraft: SalarySlip = {
    name: settleLabEmp?.name || '',
    month: new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    monthDays: settleMonthDaysNum,
    perDay: settlePerDayNum,
    salary: settleSalaryNum,
    ot: settleOtNum,
    absentDays: settleAbsentDaysNum,
    absent: settleAbsentNum,
    halfDays: settleHalfDayCountNum,
    half: settleHalfDayNum,
    permission: settlePermissionNum,
    toys: settleToysNum,
    old: settleDeductNum,
    total: settleNetPayable,
    mode: settleMode,
    note: settleNote.trim(),
    paidOn: new Date().toISOString()
  };

  // Selected employee details for direct advance entry
  const selectedEmp = labours.find(l => l._id === directLabId);
  const selectedEmpStats = selectedEmp ? getOutstandingStats(selectedEmp._id) : null;

  // Attendance stats (present, half-day, permission, absent, sunday) for selected employee in current month
  const selectedEmpAttendance = selectedEmp ? monthlyAttendance.filter(rec => {
    const id = typeof rec.labourId === 'object' ? rec.labourId?._id : rec.labourId;
    return id === selectedEmp._id;
  }) : [];

  const presentCount = selectedEmpAttendance.filter(r => r.status === 'present').length;
  const halfDayCount = selectedEmpAttendance.filter(r => r.status === 'half-day').length;
  const permissionCount = selectedEmpAttendance.filter(r => r.status === 'permission').length;
  const absentCount = selectedEmpAttendance.filter(r => r.status === 'absent').length;
  const sundayCount = selectedEmpAttendance.filter(r => r.status === 'sunday').length;
  const totalDuties = presentCount + (halfDayCount * 0.5);
  return (
    <div className="advance-history-page-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* One header strip: the tabs on the left, the tab's own filter on the
          right, so the page opens straight into the work instead of a title. */}
      <div className="advance-tabs-bar">
        <div className="advance-tabs-group" role="tablist">
          {([
            { key: 'give-advance', icon: <Wallet size={15} />, label: 'Give Advance' },
            { key: 'settle', icon: <Receipt size={15} />, label: 'Salary Settlement' },
            { key: 'slips', icon: <FileText size={15} />, label: 'Salary Slips', count: savedSlips.length },
            { key: 'summary', icon: <BarChart3 size={15} />, label: 'Outstanding' },
            { key: 'ledger', icon: <UserRound size={15} />, label: 'Individual Ledgers' }
          ] as const).map(tab => {
            const active = activeSubTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setActiveSubTab(tab.key);
                  if (tab.key === 'summary') setSelectedLabourId('all');
                  if (tab.key === 'ledger' && selectedLabourId === 'all' && labours.length > 0) {
                    setSelectedLabourId(labours[0]._id);
                  }
                }}
                className={`advance-tab ${active ? 'active' : ''}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {'count' in tab && tab.count !== undefined && (
                  <span className="advance-tab-count">{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {activeSubTab === 'ledger' && (
          <div className="advance-tabs-filter">
            <span>Employee</span>
            <select
              className="form-input"
              value={selectedLabourId}
              onChange={e => setSelectedLabourId(e.target.value)}
            >
              {labours.map(lab => (
                <option key={lab._id} value={lab._id}>
                  {lab.name} ({lab.employeeType || 'labourer'})
                </option>
              ))}
            </select>
          </div>
        )}

        {activeSubTab === 'summary' && (
          <div className="advance-tabs-filter">
            <span>Source</span>
            <select
              className="form-input"
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value as 'all' | 'owner' | 'staff')}
            >
              <option value="all">All sources</option>
              <option value="owner">Direct by MD</option>
              <option value="staff">Staff approval</option>
            </select>
          </div>
        )}
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

      {/* Saved slips: every settlement already recorded, openable any time */}
      {activeSubTab === 'slips' && (
        <div className="glass-panel" style={{ padding: '28px' }}>
          <h3 className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Saved Salary Slips</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: '18px' }}>
            Every salary settlement recorded so far. Open any slip to view, print or download it.
          </p>

          {savedSlips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '44px', color: 'var(--text-secondary)' }}>
              No salary has been settled yet. Use the Salary Settlement tab to record the first one.
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Period</th>
                    <th>Advance Recovered</th>
                    <th>Paid</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'center' }}>Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {savedSlips.map(({ tx, slip }) => {
                    const employeeName = slip?.name
                      || (typeof tx.labourId === 'object' ? tx.labourId?.name : '')
                      || 'Employee';
                    return (
                      <tr key={tx._id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(tx.date).toLocaleDateString('en-GB')}</td>
                        <td><strong>{employeeName}</strong></td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{slip?.month || '--'}</td>
                        <td style={{ whiteSpace: 'nowrap', color: slip && slip.old > 0 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                          {slip ? (slip.old > 0 ? `− ${rupees(slip.old)}` : '—') : '--'}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{tx.paymentMode === 'online' ? '🌐 Online' : '💵 Cash'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{rupees(tx.amount)}</td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {slip ? (
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => setOpenSlip(slip)}
                                className="btn btn-secondary"
                                style={{ padding: '5px 11px', fontSize: '0.78rem' }}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => printSlip(slip)}
                                title="Print this slip"
                                className="btn btn-secondary"
                                style={{ padding: '5px 9px' }}
                              >
                                <Printer size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadSlipPdf(slip)}
                                title="Download as PDF"
                                className="btn btn-secondary"
                                style={{ padding: '5px 9px' }}
                              >
                                <Download size={13} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Older entry</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* A saved slip, opened for a closer look */}
      {openSlip && (
        <div
          onClick={() => setOpenSlip(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)', zIndex: 99999,
            display: 'grid', placeItems: 'center', padding: '16px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="glass-panel glass-panel-glow"
            style={{ width: '100%', maxWidth: '440px', padding: '28px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div>
              <h3 className="gradient-text" style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Salary Slip</h3>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                {openSlip.name} · {openSlip.month}
              </p>
            </div>

            <div style={{ border: '1px solid var(--glass-border)', borderRadius: '10px', overflow: 'hidden' }}>
              {slipRows(openSlip).map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', borderBottom: '1px solid var(--glass-border)', fontSize: '0.88rem' }}>
                  <span style={{ fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                    {row.label}
                    {row.note && (
                      <small style={{ display: 'block', fontWeight: 600, letterSpacing: 0, fontSize: '0.72rem' }}>{row.note}</small>
                    )}
                  </span>
                  <strong style={{ color: row.value === 0 ? 'var(--text-secondary)' : (row.sign === '+' ? '#059669' : '#dc2626') }}>
                    {row.value === 0 ? '—' : `${row.sign === '+' ? '' : '− '}${rupees(row.value)}`}
                  </strong>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 15px', background: 'rgba(99, 102, 241, 0.09)' }}>
                <span style={{ fontWeight: 850, letterSpacing: '0.05em' }}>TOTAL</span>
                <strong style={{ fontSize: '1.35rem', color: 'var(--btn-primary-bg)' }}>{rupees(openSlip.total)}</strong>
              </div>
            </div>

            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Paid by <strong style={{ color: 'var(--text-primary)' }}>{openSlip.mode === 'online' ? 'Online / Bank' : 'Handcash'}</strong>
              {' '}on <strong style={{ color: 'var(--text-primary)' }}>{new Date(openSlip.paidOn).toLocaleDateString('en-GB')}</strong>
              {openSlip.note && <span style={{ display: 'block', marginTop: '4px', fontStyle: 'italic' }}>Note: {openSlip.note}</span>}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => printSlip(openSlip)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '9px' }}
              >
                <Printer size={15} /> Print
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => downloadSlipPdf(openSlip)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '9px' }}
              >
                <Download size={15} /> PDF
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setOpenSlip(null)}
                style={{ padding: '9px 18px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Salary Settlement View: MD's paper salary slip, done in the app */}
      {activeSubTab === 'settle' && (
        <div className="split-screen-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', width: '100%' }}>
          <div className="glass-panel glass-panel-glow" style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '32px' }}>
            <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
              <h3 className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                🧾 Salary Slip &amp; Advance Recovery
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: 0 }}>
                Fill the same slip you write by hand. The old balance you recover is cut from the employee's pending advance automatically.
              </p>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select Employee (Staff / Labourer)</label>
              <EmployeePicker
                labours={labours}
                value={settleLabId}
                onChange={setSettleLabId}
                hint="Pick the employee to fill their salary slip."
              />
            </div>

            {settleLabEmp && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.28)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Monthly Salary</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 850, color: '#059669' }}>₹{(settleLabEmp.monthlySalary || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.07)', border: '1px solid rgba(239, 68, 68, 0.26)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Old Balance (Advance)</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 850, color: '#dc2626' }}>₹{settleOutstanding.toLocaleString('en-IN')}</div>
                  </div>
                </div>

                {settleAttendance.length > 0 && (
                  <div style={{ padding: '10px 13px', borderRadius: '9px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>This month:</strong>{' '}
                    ✅ {settlePresentDays} present · 🌗 {settleHalfDays} half-day · 🕒 {settlePermissionDays} permission · ❌ {settleAbsentDays_fromAttendance} absent
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', flexWrap: 'wrap' }}>
                      <span>Duty days worked: <strong style={{ color: 'var(--text-primary)' }}>{settleMarkedDuties}</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          setSettleAbsentDays(String(settleAbsentDays_fromAttendance));
                          setSettleHalfDayCount(String(settleHalfDays));
                        }}
                        style={{ border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Use these day counts
                      </button>
                    </span>
                  </div>
                )}

                {/* EARNINGS */}
                <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', color: '#059669', textTransform: 'uppercase' }}>
                  Earnings (+)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Days in Month</label>
                    <input
                      type="number" className="form-input" placeholder="30"
                      value={settleMonthDays} onChange={e => handleMonthDaysChange(e.target.value)}
                      style={{ height: '42px' }} min={1} max={31} step={1}
                    />
                    <div style={{ display: 'flex', gap: '5px', marginTop: '6px' }}>
                      {[28, 30, 31].map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleMonthDaysChange(String(d))}
                          style={{
                            border: `1px solid ${settleMonthDaysNum === d ? 'var(--btn-primary-bg)' : 'var(--glass-border)'}`,
                            background: settleMonthDaysNum === d ? 'rgba(99, 102, 241, 0.14)' : 'transparent',
                            color: settleMonthDaysNum === d ? 'var(--btn-primary-bg)' : 'var(--text-secondary)',
                            borderRadius: '6px', padding: '2px 9px', fontSize: '0.72rem',
                            fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Per Day Rate (₹)</label>
                    <input
                      type="number" className="form-input" placeholder="e.g. 500"
                      value={settlePerDay} onChange={e => handlePerDayChange(e.target.value)}
                      style={{ height: '42px' }} min={0}
                    />
                    <small style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginTop: '5px' }}>
                      Salary ÷ {settleMonthDaysNum} days
                    </small>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Monthly Salary +</label>
                    <input
                      type="number" className="form-input" placeholder="e.g. 15000"
                      value={settleSalary} onChange={e => handleSalaryChange(e.target.value)}
                      style={{ height: '42px' }} min={0}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>OT +</label>
                    <input
                      type="number" className="form-input" placeholder="e.g. 500"
                      value={settleOt} onChange={e => setSettleOt(e.target.value)}
                      style={{ height: '42px' }} min={0}
                    />
                  </div>
                </div>

                <div style={{
                  padding: '11px 14px', borderRadius: '9px',
                  background: 'rgba(16, 185, 129, 0.07)',
                  border: '1px solid rgba(16, 185, 129, 0.26)',
                  fontSize: '0.85rem', color: 'var(--text-secondary)'
                }}>
                  <strong style={{ color: '#059669' }}>
                    ₹{settleSalaryNum.toLocaleString('en-IN')} ÷ {settleMonthDaysNum} days = ₹{settlePerDayNum.toLocaleString('en-IN')} per day
                  </strong>
                  <span style={{ display: 'block', marginTop: '3px', fontSize: '0.79rem' }}>
                    Type in either box — the other one updates itself.
                  </span>
                </div>

                {/* DEDUCTIONS */}
                <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', color: '#dc2626', textTransform: 'uppercase', marginTop: '4px' }}>
                  Deductions (−)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Absent (days) −</label>
                    <input
                      type="number" className="form-input" placeholder="0"
                      value={settleAbsentDays} onChange={e => setSettleAbsentDays(e.target.value)}
                      style={{ height: '42px' }} min={0} max={settleMonthDaysNum} step={1}
                    />
                    <small style={{ fontSize: '0.74rem', color: settleAbsentNum > 0 ? 'var(--color-danger)' : 'var(--text-secondary)', display: 'block', marginTop: '5px', fontWeight: settleAbsentNum > 0 ? 700 : 400 }}>
                      {settleAbsentDaysNum} × ₹{settlePerDayNum.toLocaleString('en-IN')} = − ₹{settleAbsentNum.toLocaleString('en-IN')}
                    </small>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Half Day (days) −</label>
                    <input
                      type="number" className="form-input" placeholder="0"
                      value={settleHalfDayCount} onChange={e => setSettleHalfDayCount(e.target.value)}
                      style={{ height: '42px' }} min={0} max={settleMonthDaysNum} step={1}
                    />
                    <small style={{ fontSize: '0.74rem', color: settleHalfDayNum > 0 ? 'var(--color-danger)' : 'var(--text-secondary)', display: 'block', marginTop: '5px', fontWeight: settleHalfDayNum > 0 ? 700 : 400 }}>
                      {settleHalfDayCountNum} × ₹{settlePerDayNum.toLocaleString('en-IN')} ÷ 2 = − ₹{settleHalfDayNum.toLocaleString('en-IN')}
                    </small>
                  </div>
                </div>

                <div style={{
                  padding: '11px 14px', borderRadius: '9px',
                  background: 'rgba(99, 102, 241, 0.07)',
                  border: '1px solid rgba(99, 102, 241, 0.26)',
                  fontSize: '0.85rem', color: 'var(--text-secondary)'
                }}>
                  Duty days paid:{' '}
                  <strong style={{ color: 'var(--btn-primary-bg)' }}>{settleDutyDaysNum}</strong>
                  {' '}of {settleMonthDaysNum}
                  <span style={{ display: 'block', marginTop: '3px', fontSize: '0.79rem' }}>
                    {settleMonthDaysNum} − {settleAbsentDaysNum} absent − {settleHalfDayCountNum} half day{settleHalfDayCountNum === 1 ? '' : 's'} × 0.5
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Permission −</label>
                    <input
                      type="number" className="form-input" placeholder="0"
                      value={settlePermission} onChange={e => setSettlePermission(e.target.value)}
                      style={{ height: '42px' }} min={0}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Toys −</label>
                    <input
                      type="number" className="form-input" placeholder="0"
                      value={settleToys} onChange={e => setSettleToys(e.target.value)}
                      style={{ height: '42px' }} min={0}
                    />
                    <small style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'block', marginTop: '5px' }}>
                      Company toys bought by this employee.
                    </small>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600, margin: 0 }}>Old Balance −</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setSettleDeduct(String(settleOutstanding))}
                        disabled={settleOutstanding <= 0}
                        style={{ border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '7px', padding: '3px 9px', fontSize: '0.74rem', fontWeight: 700, cursor: settleOutstanding > 0 ? 'pointer' : 'not-allowed' }}
                      >
                        Recover full
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettleDeduct(String(Math.round(settleOutstanding / 2)))}
                        disabled={settleOutstanding <= 0}
                        title="Recover half now, carry the rest to next month"
                        style={{ border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '7px', padding: '3px 9px', fontSize: '0.74rem', fontWeight: 700, cursor: settleOutstanding > 0 ? 'pointer' : 'not-allowed' }}
                      >
                        Half
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettleDeduct('0')}
                        style={{ border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '7px', padding: '3px 9px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Recover nothing
                      </button>
                    </div>
                  </div>
                  <input
                    type="number" className="form-input" placeholder="0"
                    value={settleDeduct} onChange={e => setSettleDeduct(e.target.value)}
                    style={{ height: '42px', marginTop: '8px' }} min={0}
                  />
                  {settleOverRecovering ? (
                    <small style={{ color: 'var(--color-danger)', fontSize: '0.78rem', display: 'block', marginTop: '6px', fontWeight: 600 }}>
                      {settleLabEmp.name} only owes ₹{settleOutstanding.toLocaleString('en-IN')}. You cannot recover more than that.
                    </small>
                  ) : settleRemainingAdvance > 0 && settleDeductNum > 0 ? (
                    <div style={{
                      marginTop: '8px', padding: '9px 12px', borderRadius: '8px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.32)',
                      fontSize: '0.8rem', color: '#b45309', fontWeight: 600
                    }}>
                      Part recovery: ₹{settleDeductNum.toLocaleString('en-IN')} is cut now and{' '}
                      <strong>₹{settleRemainingAdvance.toLocaleString('en-IN')} carries over to next month.</strong>
                    </div>
                  ) : (
                    <small style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'block', marginTop: '5px' }}>
                      Pending advance to be cut from this salary.
                    </small>
                  )}

                  {settlePendingAdvances.length > 0 && (
                    <div style={{
                      marginTop: '10px', border: '1px solid var(--glass-border)',
                      borderRadius: '9px', overflow: 'hidden'
                    }}>
                      <div style={{
                        padding: '8px 12px', background: 'var(--bg-secondary)',
                        fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em',
                        color: 'var(--text-secondary)', textTransform: 'uppercase'
                      }}>
                        Where this ₹{settleOutstanding.toLocaleString('en-IN')} came from
                        {' '}({settlePendingAdvances.length} advance{settlePendingAdvances.length === 1 ? '' : 's'}, oldest first)
                      </div>
                      {settlePendingAdvances.map(entry => {
                        const reason = cleanAdvanceReason(entry.reason);
                        return (
                          <div
                            key={entry.id}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                              gap: '12px', padding: '9px 12px',
                              borderTop: '1px solid var(--glass-border)', fontSize: '0.82rem'
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ color: 'var(--text-primary)' }}>
                                {new Date(entry.date).toLocaleDateString('en-GB')}
                              </strong>
                              <span style={{ color: 'var(--text-secondary)' }}> · {daysAgo(entry.date)}</span>
                              {(reason || entry.by) && (
                                <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {reason || 'No note'}{entry.by ? ` · by ${entry.by}` : ''}
                                </span>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <strong style={{ color: 'var(--color-danger)' }}>
                                ₹{entry.remaining.toLocaleString('en-IN')} left
                              </strong>
                              {entry.recovered > 0 && (
                                <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                  of ₹{entry.amount.toLocaleString('en-IN')} · ₹{entry.recovered.toLocaleString('en-IN')} recovered
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ padding: '7px 12px', borderTop: '1px solid var(--glass-border)', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        Recovery always clears the oldest advance first.
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Payment Mode</label>
                    <select
                      className="form-input" value={settleMode}
                      onChange={e => setSettleMode(e.target.value as 'handcash' | 'online')}
                      style={{ height: '42px' }}
                    >
                      <option value="handcash">💵 Handcash</option>
                      <option value="online">🌐 Online / Bank</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Note (optional)</label>
                    <input
                      type="text" className="form-input" placeholder="e.g. August salary"
                      value={settleNote} onChange={e => setSettleNote(e.target.value)}
                      style={{ height: '42px' }}
                    />
                  </div>
                </div>

                <div style={{
                  padding: '16px 18px', borderRadius: '12px',
                  background: settleNegative ? 'rgba(239, 68, 68, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                  border: `1px solid ${settleNegative ? 'rgba(239, 68, 68, 0.35)' : 'rgba(99, 102, 241, 0.3)'}`
                }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Total to hand over
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 850, color: settleNegative ? 'var(--color-danger)' : 'var(--btn-primary-bg)', lineHeight: 1.2 }}>
                    ₹{settleTotal.toLocaleString('en-IN')}
                  </div>
                  {settleNegative ? (
                    <div style={{ fontSize: '0.84rem', color: 'var(--color-danger)', marginTop: '4px', fontWeight: 600 }}>
                      Deductions are bigger than the earnings. Lower a deduction and recover the rest next month.
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Earnings ₹{settleEarnings.toLocaleString('en-IN')} − Deductions ₹{settleDeductions.toLocaleString('en-IN')}
                    </div>
                  )}
                  <div style={{ fontSize: '0.85rem', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(99, 102, 241, 0.3)', color: 'var(--text-secondary)' }}>
                    {settleLabEmp.name}'s advance after this:{' '}
                    <strong style={{ color: settleRemainingAdvance === 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      ₹{settleRemainingAdvance.toLocaleString('en-IN')}
                    </strong>
                    {settleRemainingAdvance === 0 && settleDeductNum > 0 && ' — fully cleared'}
                    {settleRemainingAdvance > 0 && settleDeductNum > 0 && ' — carries to next month'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSettleConfirmOpen(true)}
                  className="btn btn-primary btn-glow"
                  style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                  disabled={!settleReady || submittingSettle}
                >
                  <Send size={18} /> {submittingSettle
                    ? 'Recording...'
                    : settleDeductNum > 0
                      ? `Pay ₹${settleNetPayable.toLocaleString('en-IN')} & Recover ₹${settleDeductNum.toLocaleString('en-IN')} Advance`
                      : `Pay Full Salary ₹${settleNetPayable.toLocaleString('en-IN')}`}
                </button>
              </>
            )}
          </div>

          {/* Right: the slip exactly as it is written on paper. It sticks in place
              so MD can watch the totals while filling the form below. */}
          <div
            className="glass-panel"
            style={{
              display: 'flex', flexDirection: 'column', gap: '20px', padding: '32px',
              position: 'sticky', top: '16px', alignSelf: 'start',
              maxHeight: 'calc(100vh - 32px)', overflowY: 'auto'
            }}
          >
            {settleLabEmp ? (
              <>
                <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
                  <h3 className="gradient-text" style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                    Salary Slip Preview
                  </h3>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: 0 }}>
                    {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <img
                    src={settleLabEmp.imageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150'}
                    alt={settleLabEmp.name}
                    style={{ width: '58px', height: '58px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: 750, margin: 0, color: 'var(--text-primary)' }}>{settleLabEmp.name}</h4>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {settleLabEmp.employeeType || 'labourer'}{settleLabEmp.department ? ` • ${settleLabEmp.department}` : ''}
                    </span>
                  </div>
                </div>

                {/* The paper slip, row for row */}
                <div style={{ border: '1px solid var(--glass-border)', borderRadius: '10px', overflow: 'hidden' }}>
                  {[
                    { label: 'SALARY +', value: settleSalaryNum, sign: '+', note: settlePerDayNum > 0 ? `${settleMonthDaysNum} days × ₹${settlePerDayNum.toLocaleString('en-IN')}` : '' },
                    { label: 'OT +', value: settleOtNum, sign: '+', note: '' },
                    { label: 'ABSENT −', value: settleAbsentNum, sign: '-', note: settleAbsentDaysNum > 0 ? `${settleAbsentDaysNum} day${settleAbsentDaysNum === 1 ? '' : 's'}` : '' },
                    { label: 'HALF DAY −', value: settleHalfDayNum, sign: '-', note: settleHalfDayCountNum > 0 ? `${settleHalfDayCountNum} day${settleHalfDayCountNum === 1 ? '' : 's'} × ½` : '' },
                    { label: 'PERMISSION −', value: settlePermissionNum, sign: '-', note: '' },
                    { label: 'TOYS −', value: settleToysNum, sign: '-', note: '' },
                    { label: 'OLD BALANCE −', value: settleDeductNum, sign: '-', note: '' }
                  ].map(row => (
                    <div
                      key={row.label}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '11px 16px', borderBottom: '1px solid var(--glass-border)',
                        fontSize: '0.9rem'
                      }}
                    >
                      <span style={{ fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                        {row.label}
                        {row.note && (
                          <small style={{ display: 'block', fontWeight: 600, letterSpacing: 0, fontSize: '0.72rem', textTransform: 'none' }}>
                            {row.note}
                          </small>
                        )}
                      </span>
                      <strong style={{ color: row.value === 0 ? 'var(--text-secondary)' : (row.sign === '+' ? '#059669' : '#dc2626') }}>
                        {row.value === 0 ? '—' : `${row.sign === '+' ? '' : '− '}₹${row.value.toLocaleString('en-IN')}`}
                      </strong>
                    </div>
                  ))}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '15px 16px', background: 'rgba(99, 102, 241, 0.09)'
                  }}>
                    <span style={{ fontWeight: 850, letterSpacing: '0.05em' }}>TOTAL</span>
                    <strong style={{ fontSize: '1.4rem', color: settleNegative ? 'var(--color-danger)' : 'var(--btn-primary-bg)' }}>
                      ₹{settleTotal.toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                  <span>Paid by</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{settleMode === 'online' ? '🌐 Online / Bank' : '💵 Handcash'}</strong>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => printSlip(currentSlipDraft)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '9px' }}
                  >
                    <Printer size={15} /> Print
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => downloadSlipPdf(currentSlipDraft)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '9px' }}
                  >
                    <Download size={15} /> PDF
                  </button>
                </div>

                <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.09)', border: '1px solid rgba(245, 158, 11, 0.32)', fontSize: '0.85rem', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                  <strong style={{ color: '#b45309', display: 'block', marginBottom: '4px' }}>What gets recorded</strong>
                  A salary payment of ₹{settleNetPayable.toLocaleString('en-IN')} for {settleLabEmp.name} with the full slip breakdown.{' '}
                  {settleDeductNum > 0
                    ? `₹${settleDeductNum.toLocaleString('en-IN')} is knocked off their oldest pending advances first, leaving ₹${settleRemainingAdvance.toLocaleString('en-IN')} outstanding.`
                    : `No advance is recovered, so their ₹${settleOutstanding.toLocaleString('en-IN')} pending advance stays as it is.`}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                Please select an employee to fill their salary slip.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation before any money is recorded */}
      {settleConfirmOpen && settleLabEmp && (
        <div
          onClick={() => setSettleConfirmOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)', zIndex: 99999,
            display: 'grid', placeItems: 'center', padding: '16px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="glass-panel glass-panel-glow"
            style={{ width: '100%', maxWidth: '460px', padding: '28px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <h3 className="gradient-text" style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>
              Confirm Salary Payment
            </h3>

            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Hand over{' '}
              <strong style={{ color: 'var(--text-primary)' }}>₹{settleNetPayable.toLocaleString('en-IN')}</strong>{' '}
              to <strong style={{ color: 'var(--text-primary)' }}>{settleLabEmp.name}</strong>
              {settleDeductNum > 0 ? (
                <>
                  {' '}and cut{' '}
                  <strong style={{ color: 'var(--color-danger)' }}>₹{settleDeductNum.toLocaleString('en-IN')}</strong>{' '}
                  from their pending advance.
                </>
              ) : ' with no advance recovery.'}
            </p>

            <div style={{ border: '1px solid var(--glass-border)', borderRadius: '10px', overflow: 'hidden', fontSize: '0.86rem' }}>
              {[
                { label: 'SALARY +', value: settleSalaryNum, sign: '+' },
                { label: 'OT +', value: settleOtNum, sign: '+' },
                { label: 'ABSENT −', value: settleAbsentNum, sign: '-' },
                { label: 'HALF DAY −', value: settleHalfDayNum, sign: '-' },
                { label: 'PERMISSION −', value: settlePermissionNum, sign: '-' },
                { label: 'TOYS −', value: settleToysNum, sign: '-' },
                { label: 'OLD BALANCE −', value: settleDeductNum, sign: '-' }
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid var(--glass-border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{row.label}</span>
                  <strong style={{ color: row.value === 0 ? 'var(--text-secondary)' : (row.sign === '+' ? '#059669' : '#dc2626') }}>
                    {row.value === 0 ? '—' : `${row.sign === '+' ? '' : '− '}₹${row.value.toLocaleString('en-IN')}`}
                  </strong>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(99, 102, 241, 0.09)' }}>
                <span style={{ fontWeight: 850 }}>TOTAL</span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--btn-primary-bg)' }}>₹{settleTotal.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              Advance left after this:{' '}
              <strong style={{ color: settleRemainingAdvance === 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                ₹{settleRemainingAdvance.toLocaleString('en-IN')}
              </strong>
              {settleRemainingAdvance > 0 && settleDeductNum > 0 && ' — it carries over to next month.'}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSettleConfirmOpen(false)}
                style={{ padding: '9px 18px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSettleSalary}
                style={{ padding: '9px 18px' }}
              >
                Confirm &amp; Pay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Give Direct Advance View */}
      {activeSubTab === 'give-advance' && (
        <div className="split-screen-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', width: '100%' }}>
          {/* Left Column: Give Direct Advance Form */}
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
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select Employee (Staff / Labourer)</label>

                <EmployeePicker
                  labours={labours}
                  value={directLabId}
                  onChange={setDirectLabId}
                  hint="Pick the employee first — the profile and outstanding advance appear on the right."
                />
              </div>


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

          {/* Right Column: Selected Employee Details */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '32px', justifyContent: 'flex-start' }}>
            {selectedEmp ? (
              <>
                <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
                  <h3 className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
                    👤 Employee Profile Details
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: 0 }}>
                    Overview of the selected employee's current salary, advance stats, and duty ledger.
                  </p>
                </div>

                {/* Profile Picture and Type */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '16px', padding: '16px', border: '1px solid var(--glass-border)' }}>
                  <img
                    src={selectedEmp.imageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150'}
                    alt={selectedEmp.name}
                    style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--btn-primary-bg)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <div>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 750, margin: 0, color: 'var(--text-primary)' }}>{selectedEmp.name}</h4>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                        {selectedEmp.employeeType || 'labourer'}
                      </span>
                      {selectedEmp.department && (
                        <span className="badge" style={{ fontSize: '0.75rem', background: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                          {selectedEmp.department}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Financial Summary</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600, textTransform: 'uppercase' }}>Outstanding Advance</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: '6px' }}>
                        ₹{selectedEmpStats ? selectedEmpStats.balance.toLocaleString('en-IN') : '0'}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600, textTransform: 'uppercase' }}>Monthly Salary</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-success)', marginTop: '6px' }}>
                        ₹{selectedEmp.monthlySalary.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                  {selectedEmpStats && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '0 4px', marginTop: '4px' }}>
                      <span>Gross Advances Taken: <strong>₹{selectedEmpStats.totalTaken.toLocaleString('en-IN')}</strong></span>
                      <span>Total Recovered: <strong>₹{selectedEmpStats.totalDeducted.toLocaleString('en-IN')}</strong></span>
                    </div>
                  )}
                </div>

                {/* Duty / Attendance Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attendance & Duty Summary (Current Month)</h4>
                  
                  <div style={{ background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Calculated Duties</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 850, color: 'var(--btn-primary-bg)', marginTop: '6px' }}>
                        {totalDuties} Days
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <div>✅ Present: <strong>{presentCount} d</strong></div>
                      <div>🌗 Half-day: <strong>{halfDayCount} d</strong></div>
                      <div>🕒 Permission: <strong>{permissionCount} d</strong></div>
                      {absentCount > 0 && <div style={{ color: 'var(--color-danger)' }}>❌ Absent: <strong>{absentCount} d</strong></div>}
                      {sundayCount > 0 && <div>☀️ Sundays: <strong>{sundayCount} d</strong></div>}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                Please select an employee to view details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
