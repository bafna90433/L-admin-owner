import { useState, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getCategoryEmoji } from '../utils/categoryTheme';
import '../styles/Dashboard.css';

interface CashTx {
  _id: string;
  txType: 'received' | 'expense';
  category: string;
  amount: number;
  date: string;
  description: string;
  paymentMode?: 'handcash' | 'online';
  labourId?: string | { _id?: string; id?: string; name?: string } | null;
  labourName?: string;
  staffId?: {
    _id?: string;
    id?: string;
    name?: string;
    username?: string;
  } | string;
  staffName?: string;
}

interface StaffCreditSummaryItem {
  id: string;
  name: string;
  totalCredit: number;
  creditCount: number;
  onlineCredit: number;
  handCashCredit: number;
  totalSpent: number;
  spentCount: number;
  netHold: number;
  transactions: CashTx[];
  creditTransactions: CashTx[];
  expenseTransactions: CashTx[];
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
  labours?: any[];
  onViewHistoryClick?: () => void;
}

export default function Dashboard({
  expenses,
  balanceData,
  labours = [],
  onViewHistoryClick
}: DashboardProps) {
  const [selectedCreditPersonId, setSelectedCreditPersonId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'credit' | 'expense'>('all');
  // Helper to format date and time
  const formatDateTime = (dateStr: string | Date) => {
    if (!dateStr) return { date: '--', time: '' };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: String(dateStr), time: '' };
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { date, time };
  };

  // Helper to parse description into details and reason
  const parseDescription = (description: string = '', category: string = '', txType: string = '') => {
    let raw = (description || '').trim();
    if (raw.includes('[Staff: ')) {
      raw = raw.replace(/\[Staff:\s*[^\]]+\]\s*/g, '').trim();
    }
    
    // Extract legacy [Category: XYZ] or [Custom Category] if present
    let extractedCategory = '';
    const catMatch = raw.match(/\[Category:\s*([^\]]+)\]/i);
    if (catMatch) {
      extractedCategory = catMatch[1].trim();
      raw = raw.replace(/\[Category:\s*[^\]]+\]\s*/gi, '').trim();
    }
    if (raw.includes('[Custom Category]')) {
      raw = raw.replace(/\[Custom Category\]\s*/gi, '').trim();
    }

    let details = '';
    let reason = '';

    const reasonMarker = '. Reason: ';
    const directReasonMarker = 'Reason: ';
    
    if (raw.includes(reasonMarker)) {
      const parts = raw.split(reasonMarker);
      details = parts[0].trim();
      reason = parts.slice(1).join(reasonMarker).trim();
    } else if (raw.startsWith(directReasonMarker)) {
      details = raw.replace(/^Reason:\s*/i, '').trim();
      reason = '';
    } else if (raw.includes(directReasonMarker)) {
      const parts = raw.split(directReasonMarker);
      details = parts[0].trim() || parts.slice(1).join(directReasonMarker).trim();
      reason = parts[0].trim() ? parts.slice(1).join(directReasonMarker).trim() : '';
    } else {
      details = raw || (txType === 'received' ? 'Cash Received from MD' : '--');
      reason = '';
    }

    // Clean up trailing dots if any
    if (details.endsWith('.')) {
      details = details.slice(0, -1);
    }

    // If details happened to be just the category name (e.g. legacy "MISCELLANEOUS"), replace with reason or notes
    const effectiveCat = (category === 'miscellaneous' && extractedCategory) ? extractedCategory : (category || '');
    if (effectiveCat && details.toLowerCase() === effectiveCat.toLowerCase() && reason) {
      details = reason;
      reason = '';
    }

    return { details, reason, extractedCategory };
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


  // Helper to format any category name to Title Case
  const formatCategoryName = (name: string) => {
    return name.replace(/[-_]/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
  };

  // Color palette for categories
  const CATEGORY_COLORS = [
    'linear-gradient(90deg, #6366f1, #8b5cf6)',
    'linear-gradient(90deg, #10b981, #059669)',
    'linear-gradient(90deg, #06b6d4, #3b82f6)',
    'linear-gradient(90deg, #f59e0b, #ea580c)',
    'linear-gradient(90deg, #ec4899, #f43f5e)',
    'linear-gradient(90deg, #8b5cf6, #a855f7)',
    'linear-gradient(90deg, #d946ef, #ec4899)',
    'linear-gradient(90deg, #14b8a6, #0d9488)',
  ];

  // Dynamic Category Breakdown based purely on actual active transactions and totals
  const categoryBreakdownList = useMemo(() => {
    const categoryMap: Record<string, { label: string; amount: number; color: string }> = {};
    let colorIdx = 0;

    // 1. Add amounts from backend balanceData.categoryTotals
    if (balanceData?.categoryTotals) {
      Object.entries(balanceData.categoryTotals).forEach(([catKey, rawVal]) => {
        const amt = Number(rawVal) || 0;
        const lowerKey = catKey.trim().toLowerCase();
        if (lowerKey === 'received' || lowerKey === 'inflow') return;
        if (amt > 0) {
          const formattedLabel = formatCategoryName(catKey);
          const color = CATEGORY_COLORS[colorIdx % CATEGORY_COLORS.length];
          colorIdx++;
          categoryMap[lowerKey] = {
            label: formattedLabel,
            amount: amt,
            color,
          };
        }
      });
    }

    // 2. Scan all logged expenses to capture any category transactions
    (expenses || []).forEach((tx) => {
      if (tx.txType !== 'received') {
        const { extractedCategory } = parseDescription(tx.description, tx.category, tx.txType);
        const rawCat = (tx.category === 'miscellaneous' && extractedCategory) ? extractedCategory : (tx.category || 'Expense');
        const trimmedCat = rawCat.trim();
        const lowerKey = trimmedCat.toLowerCase();
        const amt = Number(tx.amount) || 0;

        if (categoryMap[lowerKey]) {
          if (categoryMap[lowerKey].amount === 0 && amt > 0) {
            categoryMap[lowerKey].amount += amt;
          }
        } else if (amt > 0) {
          const formattedLabel = formatCategoryName(trimmedCat);
          const color = CATEGORY_COLORS[colorIdx % CATEGORY_COLORS.length];
          colorIdx++;
          categoryMap[lowerKey] = {
            label: formattedLabel,
            amount: amt,
            color,
          };
        }
      }
    });

    // Compute effective total spent for percentage calculation
    const totalSpent = (balanceData?.totalSpent ?? 0) > 0 
      ? (balanceData?.totalSpent ?? 0) 
      : Object.values(categoryMap).reduce((sum, item) => sum + item.amount, 0);

    return Object.entries(categoryMap).map(([key, item]) => {
      const pct = totalSpent > 0 ? (item.amount / totalSpent) * 100 : 0;
      return {
        key,
        label: item.label,
        amount: item.amount,
        pct: Math.round(pct),
        color: item.color,
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [expenses, balanceData]);

  // Resolve person details from transaction (either labourId, staffId, labourName, staffName, or [Staff: Name])
  const resolvePersonFromTx = (tx: CashTx) => {
    let rawRecipientName = '';
    let rawRecipientId = '';

    if (typeof tx.labourId === 'object' && tx.labourId?.name) {
      rawRecipientName = tx.labourId.name;
      rawRecipientId = (tx.labourId._id || (tx.labourId as any).id || '').toString();
    } else if (typeof tx.labourId === 'string' && tx.labourId) {
      rawRecipientId = tx.labourId;
      const found = (labours || []).find((l: any) => (l._id || l.id) === tx.labourId);
      if (found?.name) {
        rawRecipientName = found.name;
      } else {
        rawRecipientName = tx.labourName || tx.labourId;
      }
    } else if (tx.labourName) {
      rawRecipientName = tx.labourName;
    } else if (tx.description && tx.description.includes('[Staff: ')) {
      const match = tx.description.match(/\[Staff:\s*([^\]]+)\]/);
      if (match && match[1]) {
        rawRecipientName = match[1].trim();
      }
    } else if (typeof tx.staffId === 'object' && tx.staffId?.name) {
      rawRecipientName = tx.staffId.name;
      rawRecipientId = (tx.staffId._id || (tx.staffId as any).id || '').toString();
    } else if (typeof tx.staffId === 'string' && tx.staffId) {
      rawRecipientId = tx.staffId;
      const foundStaff = (labours || []).find((l: any) => (l._id || l.id) === tx.staffId);
      if (foundStaff?.name) {
        rawRecipientName = foundStaff.name;
      } else {
        rawRecipientName = tx.staffName || tx.staffId;
      }
    } else if (tx.staffName) {
      rawRecipientName = tx.staffName;
    }

    const cleanForMatching = (rawRecipientName || '').replace(/\s*\(ID:[^)]+\)/gi, '').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    
    let canonicalId = '';
    let canonicalName = '';

    if (cleanForMatching === 'deepa' || cleanForMatching.startsWith('deepa ') || cleanForMatching === 'deepa v' || rawRecipientId === '6a3540d19419b8c3f3d3867a' || rawRecipientId === '6a3b9a8df3f904ac9ef242ae' || rawRecipientId === '6a26bc3639b6e1cc5f4fef8d') {
      canonicalId = 'staff_deepa';
      canonicalName = 'Deepa';
    } else if (cleanForMatching === 'ramya' || cleanForMatching.startsWith('ramya ') || rawRecipientId === '6a2971a53246f539763fd1ed') {
      canonicalId = 'staff_ramya';
      canonicalName = 'Ramya';
    } else {
      canonicalId = rawRecipientId || (cleanForMatching ? `staff_${cleanForMatching.replace(/[^a-z0-9]/g, '_')}` : '');
      canonicalName = rawRecipientName;
    }

    return { rawRecipientName, rawRecipientId, cleanForMatching, canonicalId, canonicalName };
  };

  // Staff Credit & Expense Ledger Summary:
  // Aggregates both Cash Received (Inflows) and Deductions/Expenses (Outflows tagged to the staff)
  const staffCreditSummary = useMemo(() => {
    const creditMap: Record<string, StaffCreditSummaryItem> = {};

    // 1. Process all received transactions (Credit Inflows)
    (expenses || []).forEach(tx => {
      if (tx.txType !== 'received') return;

      const { canonicalId, canonicalName } = resolvePersonFromTx(tx);
      if (!canonicalName) return;

      if (!creditMap[canonicalId]) {
        creditMap[canonicalId] = {
          id: canonicalId,
          name: canonicalName,
          totalCredit: 0,
          creditCount: 0,
          onlineCredit: 0,
          handCashCredit: 0,
          totalSpent: 0,
          spentCount: 0,
          netHold: 0,
          transactions: [],
          creditTransactions: [],
          expenseTransactions: []
        };
      }

      const amount = Number(tx.amount) || 0;
      creditMap[canonicalId].totalCredit += amount;
      creditMap[canonicalId].creditCount += 1;
      creditMap[canonicalId].transactions.push(tx);
      creditMap[canonicalId].creditTransactions.push(tx);
      if (tx.paymentMode === 'online') {
        creditMap[canonicalId].onlineCredit += amount;
      } else {
        creditMap[canonicalId].handCashCredit += amount;
      }
    });

    // 2. Process all expense transactions (Minus / Deductions tagged to staff)
    (expenses || []).forEach(tx => {
      if (tx.txType === 'received') return;

      const { rawRecipientId, cleanForMatching, canonicalId } = resolvePersonFromTx(tx);
      if (!cleanForMatching && !rawRecipientId) return;

      // Match against credit recipients in creditMap:
      let targetPerson: StaffCreditSummaryItem | undefined = creditMap[canonicalId];
      if (!targetPerson && rawRecipientId) {
        targetPerson = Object.values(creditMap).find(p => p.id === rawRecipientId);
      }
      if (!targetPerson && cleanForMatching) {
        targetPerson = Object.values(creditMap).find(p => {
          const pClean = p.name.replace(/\s*\(ID:[^)]+\)/gi, '').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
          return pClean === cleanForMatching || pClean.includes(cleanForMatching) || cleanForMatching.includes(pClean);
        });
      }

      if (targetPerson) {
        const amount = Number(tx.amount) || 0;
        targetPerson.totalSpent += amount;
        targetPerson.spentCount += 1;
        targetPerson.expenseTransactions.push(tx);
        targetPerson.transactions.push(tx);
      }
    });

    // 3. Compute netHold and sort transactions chronologically descending (newest first)
    Object.values(creditMap).forEach(person => {
      person.netHold = person.totalCredit - person.totalSpent;
      person.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      person.creditTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      person.expenseTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    // In MD Panel, show ALL staff with credit > 0 (Deepa, AnilDas, Badrinath, etc.)
    return Object.values(creditMap)
      .filter(person => person.totalCredit > 0)
      .sort((a, b) => b.totalCredit - a.totalCredit);
  }, [expenses, labours]);

  // Per-person expense deductions (expenses tagged to each staff member)
  const staffTaggedExpenses = useMemo(() => {
    const expMap: Record<string, number> = {};
    (expenses || []).forEach(tx => {
      if (tx.txType === 'received') return;
      const labourObj = typeof (tx as any).labourId === 'object' ? (tx as any).labourId : null;
      if (labourObj?.name) {
        const key = labourObj.name.trim().toLowerCase();
        expMap[key] = (expMap[key] || 0) + (Number(tx.amount) || 0);
      }
    });
    return expMap;
  }, [expenses]);

  // Active selected person for View History modal
  const selectedCreditHistory = useMemo(() => {
    if (!selectedCreditPersonId) return null;
    return staffCreditSummary.find(p => p.id === selectedCreditPersonId || p.name === selectedCreditPersonId) || null;
  }, [staffCreditSummary, selectedCreditPersonId]);

  // Transactions to show in the View History modal based on selected tab filter
  const displayedHistoryTransactions = useMemo(() => {
    if (!selectedCreditHistory) return [];
    if (historyFilter === 'credit') return selectedCreditHistory.creditTransactions;
    if (historyFilter === 'expense') return selectedCreditHistory.expenseTransactions;
    return selectedCreditHistory.transactions;
  }, [selectedCreditHistory, historyFilter]);

  const getLabourRecipientName = (tx: any) => {
    if (!tx) return '';
    const staffPaying = (selectedCreditHistory?.name || '').trim().toLowerCase();

    if (typeof tx.labourId === 'object' && tx.labourId?.name) {
      const name = tx.labourId.name.trim();
      if (!staffPaying || name.toLowerCase() !== staffPaying) {
        return name;
      }
    }
    if (typeof tx.labourId === 'string' && tx.labourId) {
      const found = (labours || []).find((l: any) => (l._id || l.id) === tx.labourId);
      if (found?.name && (!staffPaying || found.name.trim().toLowerCase() !== staffPaying)) {
        return found.name;
      }
    }
    if (tx.labourName && (!staffPaying || tx.labourName.trim().toLowerCase() !== staffPaying)) {
      return tx.labourName;
    }

    if (tx.description) {
      const descWithoutStaff = tx.description.replace(/\[Staff:\s*[^\]]+\]/gi, '').toLowerCase();
      const matched = (labours || []).find((l: any) => {
        if (!l.name) return false;
        const lName = l.name.trim().toLowerCase();
        if (lName.length < 3) return false;
        if (staffPaying && lName === staffPaying) return false;
        if (lName.includes('badrinath') || lName === 'deepa' || lName === 'ramya') return false;
        return descWithoutStaff.includes(lName);
      });
      if (matched?.name) return matched.name;
    }

    return '';
  };

  // Helper to resolve clean recipient and clean notes separately
  const resolveTransactionItem = (tx: any) => {
    const isCredit = tx.txType === 'received';
    const { details, reason, extractedCategory } = parseDescription(tx.description, tx.category, tx.txType);

    if (isCredit) {
      return {
        recipient: '',
        notes: details,
        reason,
        extractedCategory
      };
    }

    let recipient = getLabourRecipientName(tx);
    let cleanNotes = details;

    if (cleanNotes) {
      cleanNotes = cleanNotes.replace(/^(badrinath mandal\.?\s*g|deepa|ramya)\s*[-–—:]\s*/i, '').trim();
      if (selectedCreditHistory?.name) {
        const staffRegex = new RegExp(`^${selectedCreditHistory.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—:]\\s*`, 'i');
        cleanNotes = cleanNotes.replace(staffRegex, '').trim();
      }
    }

    if (!recipient && (labours || []).length > 0) {
      const staffPaying = (selectedCreditHistory?.name || '').trim().toLowerCase();
      const lowerNotes = cleanNotes.toLowerCase();
      const foundLabour = (labours || []).find((l: any) => {
        if (!l.name) return false;
        const lName = l.name.trim().toLowerCase();
        if (lName.length < 3) return false;
        if (staffPaying && lName === staffPaying) return false;
        if (lName.includes('badrinath') || lName === 'deepa' || lName === 'ramya') return false;
        return lowerNotes.includes(lName);
      });
      if (foundLabour) {
        recipient = foundLabour.name;
      }
    }

    if (recipient && cleanNotes) {
      const recRegex = new RegExp(`(^|[-–—:]\\s*)${recipient.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*[-–—:]|$)`, 'gi');
      cleanNotes = cleanNotes.replace(recRegex, ' ').replace(/\s+/g, ' ').replace(/^[-–—:]\s*|\s*[-–—:]$/g, '').trim();
      
      const compactRec = recipient.replace(/\s+/g, '');
      const compactRegex = new RegExp(`(^|[-–—:]\\s*)${compactRec}(\\s*[-–—:]|$)`, 'gi');
      cleanNotes = cleanNotes.replace(compactRegex, ' ').replace(/\s+/g, ' ').replace(/^[-–—:]\s*|\s*[-–—:]$/g, '').trim();
    }

    if (!cleanNotes || cleanNotes === '--') {
      const cat = (tx.category || '').toLowerCase();
      cleanNotes = cat.includes('advance') ? 'Salary advance' : 'Expense';
    }

    return {
      recipient,
      notes: cleanNotes,
      reason,
      extractedCategory
    };
  };

  if (selectedCreditHistory) {
    return (
      <div className="credit-history-page-container animate-fade-in" style={{ width: '100%', maxWidth: '100%' }}>
        {/* Top Navigation Bar */}
        <div className="credit-history-page-nav">
          <button
            type="button"
            className="credit-history-back-btn"
            onClick={() => setSelectedCreditPersonId(null)}
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>
          <span className="badge badge-info" style={{ fontSize: '0.75rem', padding: '5px 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {selectedCreditHistory.transactions.length} Total Records
          </span>
        </div>

        {/* Page Banner Header */}
        <div className="credit-history-page-header">
          <div className="credit-history-person">
            <span aria-hidden="true">
              {selectedCreditHistory.name.trim().slice(0, 2).toUpperCase() || 'ST'}
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <small>Staff Credit & Expense Ledger</small>
              </div>
              <h2 style={{ margin: '2px 0 0', color: '#172033', fontSize: '1.5rem', fontWeight: 800 }}>
                {selectedCreditHistory.name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSelectedCreditPersonId(null)}
            style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: '8px' }}
          >
            Close Ledger
          </button>
        </div>

        {/* Top Totals Summary (Full-Width Responsive Grid) */}
        <div className="credit-history-totals-page">
          <div className="credit-summary-card credit-inflow-card">
            <small>Total Credit (+)</small>
            <strong>+₹{selectedCreditHistory.totalCredit.toLocaleString('en-IN')}</strong>
            <span className="credit-summary-sub">{selectedCreditHistory.creditCount} Inflow {selectedCreditHistory.creditCount === 1 ? 'entry' : 'entries'}</span>
          </div>
          <div className="credit-summary-card credit-outflow-card">
            <small>Total Spent / Minus (-)</small>
            <strong>-₹{selectedCreditHistory.totalSpent.toLocaleString('en-IN')}</strong>
            <span className="credit-summary-sub">{selectedCreditHistory.spentCount} Deduction {selectedCreditHistory.spentCount === 1 ? 'entry' : 'entries'}</span>
          </div>
          <div className="credit-summary-card credit-balance-card">
            <small>Net Hold Balance</small>
            <strong style={{ color: selectedCreditHistory.netHold >= 0 ? '#0284c7' : '#dc2626' }}>
              ₹{selectedCreditHistory.netHold.toLocaleString('en-IN')}
            </strong>
            <span className="credit-summary-sub">In-hand remaining</span>
          </div>
          <div className="credit-summary-card">
            <small>Online Received</small>
            <strong style={{ color: '#2563eb' }}>₹{selectedCreditHistory.onlineCredit.toLocaleString('en-IN')}</strong>
            <span className="credit-summary-sub">Bank / UPI</span>
          </div>
          <div className="credit-summary-card">
            <small>Cash Received</small>
            <strong style={{ color: '#059669' }}>₹{selectedCreditHistory.handCashCredit.toLocaleString('en-IN')}</strong>
            <span className="credit-summary-sub">Handcash</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="credit-history-filter-bar" style={{ padding: '0 0 16px 0', border: 'none' }}>
          <button
            type="button"
            className={`history-filter-btn ${historyFilter === 'all' ? 'active' : ''}`}
            onClick={() => setHistoryFilter('all')}
          >
            All Activity ({selectedCreditHistory.transactions.length})
          </button>
          <button
            type="button"
            className={`history-filter-btn filter-inflow ${historyFilter === 'credit' ? 'active' : ''}`}
            onClick={() => setHistoryFilter('credit')}
          >
            📥 Credits Received (+₹{selectedCreditHistory.totalCredit.toLocaleString('en-IN')})
          </button>
          <button
            type="button"
            className={`history-filter-btn filter-outflow ${historyFilter === 'expense' ? 'active' : ''}`}
            onClick={() => setHistoryFilter('expense')}
          >
            📤 Deductions / Minus (-₹{selectedCreditHistory.totalSpent.toLocaleString('en-IN')})
          </button>
        </div>

        {/* Detailed Full-Width Transaction Table */}
        <div className="table-container credit-history-page-table-wrap">
          <table className="custom-table credit-history-table">
            <thead>
              <tr>
                <th style={{ width: '135px' }}>Date & Time</th>
                <th style={{ width: '125px' }}>Type</th>
                <th style={{ width: '135px' }}>Category</th>
                <th style={{ width: '180px' }}>Advance Recipient (Labour)</th>
                <th>Details / Notes</th>
                <th style={{ width: '120px' }}>Payment Mode</th>
                <th style={{ width: '125px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {displayedHistoryTransactions.length > 0 ? (
                displayedHistoryTransactions.map((tx, idx) => {
                  const isCredit = tx.txType === 'received';
                  const { recipient, notes, reason, extractedCategory } = resolveTransactionItem(tx);
                  const { date: txDate, time: txTime } = formatDateTime(tx.date);
                  const categoryLabel = isCredit
                    ? 'CASH RECEIVED'
                    : ((tx.category === 'miscellaneous' && extractedCategory) ? extractedCategory : (tx.category || 'MISCELLANEOUS')).replace(/[-_]/g, ' ').toUpperCase();
                  const staffLogger = (typeof tx.staffId === 'object' && tx.staffId?.name) 
                    ? tx.staffId.name 
                    : (tx.staffName || '');

                  return (
                    <tr key={tx._id || idx} style={{ background: isCredit ? 'transparent' : 'rgba(254, 242, 242, 0.3)' }}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 600 }}>{txDate}</span>
                          {txTime && (
                            <small style={{ color: 'var(--text-secondary)', fontSize: '0.73rem' }}>
                              {txTime}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        {isCredit ? (
                          <span className="credit-type-pill credit-inflow">
                            📥 Credit Inflow
                          </span>
                        ) : (
                          <span className="credit-type-pill credit-outflow">
                            📤 Minus (Spent)
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${isCredit ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.67rem', padding: '2px 8px', letterSpacing: '0.04em' }}>
                          {categoryLabel}
                        </span>
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        {recipient ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '3px 8px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '8px' }}>
                            <span style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                              color: '#ffffff',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: '0.65rem',
                              fontWeight: 850,
                              flexShrink: 0
                            }}>
                              {recipient.trim().slice(0, 2).toUpperCase()}
                            </span>
                            <strong style={{ color: '#1e1b4b', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                              {recipient}
                            </strong>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>--</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <strong style={{ color: '#1e293b', fontSize: '0.85rem' }}>{notes}</strong>
                          {reason && reason !== '--' && (
                            <small style={{ color: '#64748b', fontStyle: 'italic' }}>
                              Reason: {reason}
                            </small>
                          )}
                          {!isCredit && staffLogger && (
                            <small style={{ color: '#0284c7', fontSize: '0.72rem', fontWeight: 600 }}>
                              👤 Logged by: {staffLogger}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 500 }}>
                          {tx.paymentMode === 'online' ? '🌐 Online' : '💵 Cash'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{ 
                          fontWeight: 800, 
                          fontSize: '0.95rem',
                          color: isCredit ? '#059669' : '#dc2626'
                        }}>
                          {isCredit ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-secondary)' }}>
                    {historyFilter === 'expense'
                      ? 'No deductions / spent entries recorded for this staff member yet.'
                      : historyFilter === 'credit'
                      ? 'No cash received / credit records found for this staff member.'
                      : 'No transactions found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 4px 0', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Showing <strong>{displayedHistoryTransactions.length}</strong> of <strong>{selectedCreditHistory.transactions.length}</strong> total transaction{selectedCreditHistory.transactions.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>
    );
  }

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
            <div className="stat-value gradient-text" style={{ fontSize: '1.8rem', fontWeight: 850, marginTop: '4px' }}>₹{(balanceData?.totalReceived ?? 0).toLocaleString('en-IN')}</div>
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
            <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 850, marginTop: '4px', color: 'var(--color-danger)' }}>₹{(balanceData?.totalSpent ?? 0).toLocaleString('en-IN')}</div>
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
            <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 850, marginTop: '4px', color: 'var(--text-primary)' }}>₹{(balanceData?.onlineBalance ?? 0).toLocaleString('en-IN')}</div>
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
            <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 850, marginTop: '4px', color: 'var(--color-success)' }}>₹{(balanceData?.handCashBalance ?? 0).toLocaleString('en-IN')}</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>Cash in Hand</p>
          </div>
        </div>
      </div>

      {/* Staff Credit Summary */}
      <section className="glass-panel dashboard-credit-summary" style={{ marginBottom: '24px' }}>
        <div className="dashboard-credit-heading">
          <div>
            <h3>💵 Staff Credit Summary</h3>
            <p>Cash received total for every selected staff or employee name</p>
          </div>
          <span>{staffCreditSummary.length} Credit Holders</span>
        </div>

        {staffCreditSummary.length > 0 ? (
          <div className="dashboard-credit-grid">
            {staffCreditSummary.map((person, index) => (
              <article className="dashboard-credit-card" key={`${person.name}-${index}`}>
                <div className="dashboard-credit-card-top">
                  <span className="dashboard-credit-avatar" aria-hidden="true">
                    {person.name.trim().slice(0, 2).toUpperCase() || 'ST'}
                  </span>
                  <div>
                    <strong>{person.name}</strong>
                    <small>{person.creditCount} {person.creditCount === 1 ? 'credit entry' : 'credit entries'}</small>
                  </div>
                </div>
                <div className="dashboard-credit-amount">
                  <small>Total Credit</small>
                  <strong>+₹{person.totalCredit.toLocaleString('en-IN')}</strong>
                </div>
                {(() => {
                  const spent = person.totalSpent || staffTaggedExpenses[person.name.trim().toLowerCase()] || 0;
                  const net = person.netHold !== undefined ? person.netHold : (person.totalCredit - spent);
                  return spent > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', marginBottom: '4px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.63rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Spent</div>
                        <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.95rem' }}>-₹{spent.toLocaleString('en-IN')}</div>
                      </div>
                      <div style={{ width: '1px', height: '30px', background: 'rgba(239,68,68,0.2)' }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.63rem', color: net > 0 ? '#059669' : '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Net Hold</div>
                        <div style={{ fontWeight: 800, color: net > 0 ? '#059669' : '#ef4444', fontSize: '0.95rem' }}>₹{Math.max(0, net).toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                  ) : null;
                })()}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                  <div style={{ background: 'rgba(59, 130, 246, 0.07)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '10px', padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '3px' }}>🌐 Online</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e40af' }}>₹{person.onlineCredit.toLocaleString('en-IN')}</div>
                  </div>
                  <div style={{ background: 'rgba(16, 185, 129, 0.07)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '3px' }}>💵 Cash</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#065f46' }}>₹{person.handCashCredit.toLocaleString('en-IN')}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="dashboard-credit-history-button"
                  onClick={() => {
                    setSelectedCreditPersonId(person.id || person.name);
                    setHistoryFilter('all');
                  }}
                >
                  View History <span aria-hidden="true">→</span>
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="dashboard-credit-empty">
            No named staff credits recorded yet. Select a staff member while recording Cash Received.
          </div>
        )}
      </section>

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
                  <th>Category</th>
                  <th>Details</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(expenses || []).slice(0, 10).map((tx) => {
                  const { details, reason, extractedCategory } = parseDescription(tx.description, tx.category, tx.txType);
                  const { date: txDate, time: txTime } = formatDateTime(tx.date);
                  return (
                    <tr key={tx._id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 600 }}>{txDate}</span>
                          {txTime && (
                            <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                              {txTime}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        {tx.txType === 'received' ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>--</span>
                        ) : (
                          <span className={`badge ${
                            tx.category === 'petrol' ? 'badge-info' :
                            tx.category === 'porter-vehicle' ? 'badge-warning' :
                            tx.category === 'staff-welfare' ? 'badge-success' :
                            tx.category === 'salary-advance' ? 'badge-danger' :
                            'badge-info'
                          }`}>
                            {getCategoryEmoji((tx.category === 'miscellaneous' && extractedCategory) ? extractedCategory : (tx.category || 'MISCELLANEOUS'))} {((tx.category === 'miscellaneous' && extractedCategory) ? extractedCategory : (tx.category || 'MISCELLANEOUS')).replace(/[-_]/g, ' ').toUpperCase()}
                          </span>
                        )}
                      </td>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Category Expenses Breakdown</h3>
            <span className="badge badge-info" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
              {categoryBreakdownList.length} Categories
            </span>
          </div>
          <div className="breakdown-container">
            {categoryBreakdownList.map((item) => (
              <div key={item.key} className="breakdown-item">
                <div className="breakdown-label">
                  <span style={{ fontWeight: item.amount > 0 ? 600 : 500, color: item.amount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>{getCategoryEmoji(item.label)}</span>
                    <span>{item.label}</span>
                  </span>
                  <span style={{ fontWeight: 700, color: item.amount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    ₹{item.amount.toLocaleString('en-IN')} ({item.pct}%)
                  </span>
                </div>
                <div className="breakdown-progress-bar">
                  <div
                    className="breakdown-progress-fill"
                    style={{ 
                      width: `${item.pct}%`, 
                      background: item.color
                    }}
                  />
                </div>
              </div>
            ))}
            {categoryBreakdownList.length === 0 && (
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
