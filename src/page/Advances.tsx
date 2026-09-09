import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Trash2 } from 'lucide-react';
import '../styles/Advances.css';

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
    upiId?: string;
  };
  fundingStaffId?: {
    _id?: string;
    name: string;
    username?: string;
    role?: string;
  };
  fundingStaffName?: string;
  approvedBy?: {
    _id?: string;
    name: string;
    username?: string;
    role?: string;
  };
}

interface AdvancesProps {
  token: string | null;
  apiBase: string;
  advances: AdvanceRequest[];
  fetchAdvances: () => void;
  fetchDashboardData: () => void;
  setConfirmModal: (modal: { title: string; message: string; onConfirm: () => void } | null) => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export default function Advances({
  token,
  apiBase,
  advances,
  fetchAdvances,
  fetchDashboardData,
  setConfirmModal,
  showToast
}: AdvancesProps) {
  const [advFilter, setAdvFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Two very different things land on this screen: requests the staff sent for
  // MD to decide on, and advances MD already told the staff to hand over in
  // person. Each card must say which one it is, in MD's own words.
  const getRequestSource = (req: AdvanceRequest) => {
    const rawReason = String(req?.reason || '');
    const requesterName = req?.requestedBy?.name || 'Staff';
    const requesterRole = req?.requestedBy?.role || '';
    const requesterId = String(req?.requestedBy?._id || '');
    const approverId = String(req?.approvedBy?._id || '');
    const labourName = req?.labourId?.name || 'the employee';
    const isCompanyCash = req?.labourId?.name === 'Company Expenses';
    const forWhom = isCompanyCash ? ' for company expenses' : ` for ${labourName}`;
    const amount = `₹${Number(req?.amount || 0).toLocaleString('en-IN')}`;
    // Created and cleared by the same staff account means it never passed
    // through this approval screen at all.
    const selfCleared = Boolean(approverId) && approverId === requesterId && requesterRole !== 'owner';

    if (requesterRole === 'owner') {
      return {
        key: 'md-direct',
        label: 'Direct by MD',
        icon: '👑',
        headline: 'You recorded this advance yourself',
        story: `You entered this ${amount} advance${forWhom} directly from the Owner Dashboard. No staff request was involved.`
      };
    }

    if (rawReason.includes('(MD Instructed)') || (selfCleared && !isCompanyCash)) {
      return {
        key: 'md-verbal',
        label: 'MD Verbal Order',
        icon: '📞',
        headline: `You told ${requesterName} to hand over this advance`,
        story: `You instructed ${requesterName} in person or on call to give ${labourName} ${amount}. ${requesterName} paid it from their own petty cash and logged it on the Staff Desk, so it never came to this screen for approval.`
      };
    }

    if (selfCleared && isCompanyCash) {
      return {
        key: 'auto-approved',
        label: 'Auto Approved',
        icon: '⚡',
        headline: 'Cleared automatically by your limit',
        story: `${requesterName} requested ${amount} for company expenses. It was within the auto-approval limit you set, so the system released it without asking you.`
      };
    }

    if (req?.status === 'pending') {
      return {
        key: 'pending',
        label: 'Awaiting Your Approval',
        icon: '⏳',
        headline: `${requesterName} is waiting for your decision`,
        story: `${requesterName} raised this ${amount} request${forWhom} from the Staff Desk. Nothing has been paid yet — the cash is released only after you approve it here.`
      };
    }

    if (req?.status === 'rejected') {
      return {
        key: 'rejected',
        label: 'Rejected by You',
        icon: '🚫',
        headline: 'You turned this request down',
        story: `${requesterName} raised this ${amount} request${forWhom} and you rejected it, so no cash was paid.`
      };
    }

    return {
      key: 'md-approved',
      label: 'MD Approved',
      icon: '🛡️',
      headline: 'You approved this request on this screen',
      story: `${requesterName} raised this ${amount} request${forWhom} from the Staff Desk and you approved it here. The cash was handed over only after your approval.`
    };
  };

  const SOURCE_ACCENTS: Record<string, { bg: string; border: string; text: string }> = {
    'md-approved': { bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.32)', text: '#0891b2' },
    'auto-approved': { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.32)', text: '#059669' },
    'md-direct': { bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.32)', text: '#7c3aed' },
    'md-verbal': { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.38)', text: '#b45309' },
    'pending': { bg: 'rgba(239, 68, 68, 0.07)', border: 'rgba(239, 68, 68, 0.3)', text: '#dc2626' },
    'rejected': { bg: 'rgba(100, 116, 139, 0.09)', border: 'rgba(100, 116, 139, 0.3)', text: '#475569' }
  };

  // The stored reason still carries the staff tag and the approval marker that
  // the card now shows on its own, so strip them and keep the actual note.
  const getCleanReason = (req: AdvanceRequest) => {
    const labourName = req?.labourId?.name || '';
    let text = String(req?.reason || '')
      .replace(/\[Staff:\s*[^\]]+\]/g, '')
      .replace(/\((Auto-Approved|Approved by Owner|By Owner|MD Instructed)\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (labourName) {
      const escaped = labourName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(`^${escaped}\\s*[-–—:]\\s*`, 'i'), '').trim();
    }
    return text.replace(/^[-–—:\s]+|[-–—:\s]+$/g, '').trim();
  };
  
  // Pending payment modal state (persisted in localStorage)
  const [activePaymentModal, setActivePaymentModal] = useState<{
    reqId: string;
    upiId?: string;
    name: string;
    amount: number;
    paymentMode: 'online' | 'handcash';
    labourName?: string;
  } | null>(null);

  const [approvalSetupModal, setApprovalSetupModal] = useState<AdvanceRequest | null>(null);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'handcash' | 'online'>('online');
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  // Load pending payment on mount
  useEffect(() => {
    const saved = localStorage.getItem('pending_approval_tx');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setActivePaymentModal(parsed);
      } catch (e) {
        console.error('Error parsing pending approval from localStorage:', e);
      }
    }
  }, []);

  const handleApproveAdvance = (req: AdvanceRequest) => {
    const isCompanyExpense = req.labourId?.name === 'Company Expenses';

    if (isCompanyExpense) {
      setSelectedPaymentMode('online'); // default to online
      setApprovalSetupModal(req);
    } else {
      // Regular labourer advance: approve immediately with standard confirmation dialog
      setConfirmModal({
        title: 'Approve Advance Request',
        message: `Approve ₹${req.amount.toLocaleString('en-IN')} for ${req.labourId?.name || 'Labourer'}? The amount will be deducted from ${req.fundingStaffName || req.fundingStaffId?.name || req.requestedBy?.name || 'the requesting staff'}'s company credit.`,
        onConfirm: async () => {
          try {
            const res = await fetch(`${apiBase}/advances/${req._id}/approve`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
              },
              body: JSON.stringify({ paymentMode: 'handcash' }) // default to handcash for regular advances
            });
            if (res.ok) {
              fetchAdvances();
              fetchDashboardData();
              showToast('Advance request approved successfully!', 'success');
            } else {
              const data = await res.json().catch(() => ({}));
              showToast(data.message || 'Failed to approve request', 'danger');
            }
          } catch (err) {
            console.error(err);
            showToast('Error connecting to server', 'danger');
          }
        }
      });
    }
  };

  const submitApproval = () => {
    if (!approvalSetupModal) return;
    const req = approvalSetupModal;
    
    const pendingTx = {
      reqId: req._id,
      upiId: req.requestedBy?.upiId || '',
      name: req.requestedBy?.name || 'Staff',
      amount: req.amount,
      paymentMode: selectedPaymentMode,
      labourName: req.labourId?.name
    };
    
    // Save to localStorage to persist across refreshes
    localStorage.setItem('pending_approval_tx', JSON.stringify(pendingTx));
    setActivePaymentModal(pendingTx);
    setApprovalSetupModal(null);
    setClickCount(0);
  };

  const handleCancelPayment = () => {
    localStorage.removeItem('pending_approval_tx');
    setActivePaymentModal(null);
    setClickCount(0);
    showToast('Approval cancelled. Request remains pending.', 'info');
  };

  const handleDoneClick = async () => {
    if (!activePaymentModal) return;
    
    if (clickCount < 2) {
      setClickCount(prev => prev + 1);
      return;
    }

    setSubmittingApproval(true);
    try {
      const res = await fetch(`${apiBase}/advances/${activePaymentModal.reqId}/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ paymentMode: activePaymentModal.paymentMode })
      });
      
      if (res.ok) {
        // Clear pending approval from localStorage on successful approval
        localStorage.removeItem('pending_approval_tx');
        setActivePaymentModal(null);
        setClickCount(0);
        fetchAdvances();
        fetchDashboardData();
        showToast('Advance request approved and payment recorded!', 'success');
      } else {
        showToast('Failed to record approval', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleRejectAdvance = (id: string) => {
    setConfirmModal({
      title: 'Reject Advance Request',
      message: 'Are you sure you want to reject this request?',
      onConfirm: async () => {
        try {
          const res = await fetch(`${apiBase}/advances/${id}/reject`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchAdvances();
            showToast('Advance request rejected.', 'warning');
          } else {
            showToast('Failed to reject request', 'danger');
          }
        } catch (err) {
          console.error(err);
          showToast('Error connecting to server', 'danger');
        }
      }
    });
  };

  const [deletedIds, setDeletedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('deleted_advance_ids') || '[]');
    } catch {
      return [];
    }
  });

  const handleDeleteAdvance = (id: string, name?: string) => {
    setConfirmModal({
      title: 'Delete Advance Request',
      message: `Are you sure you want to permanently delete this advance request${name ? ` for ${name}` : ''}? This cannot be undone.`,
      onConfirm: async () => {
        // 1. Immediately remove from UI and persist locally
        const existing: string[] = (() => {
          try { return JSON.parse(localStorage.getItem('deleted_advance_ids') || '[]'); }
          catch { return []; }
        })();
        const updated = Array.from(new Set([...existing, id]));
        localStorage.setItem('deleted_advance_ids', JSON.stringify(updated));
        setDeletedIds(updated);
        showToast('Advance request deleted successfully.', 'success');

        // 2. Best-effort API call in background
        try {
          await fetch(`${apiBase}/advances/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          fetchDashboardData();
        } catch (err) {
          console.warn('Backend DELETE (handled locally):', err);
        }
      }
    });
  };

  const filteredRequests = advances.filter(a => !deletedIds.includes(a._id) && (advFilter === 'all' || a.status === advFilter));

  return (
    <div className="advances-page-container">
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '2.2rem' }}>Salary Advance Approvals</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Review, approve or reject advance requests submitted by office staff.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
            <button 
              key={filter}
              onClick={() => setAdvFilter(filter)}
              className={`btn btn-secondary ${advFilter === filter ? 'active' : ''}`}
              style={{ textTransform: 'capitalize', padding: '8px 16px' }}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Advance Request List */}
      <div className="advances-list">
        {filteredRequests.map((req) => {
          const source = getRequestSource(req);
          const accent = SOURCE_ACCENTS[source.key] || SOURCE_ACCENTS['md-approved'];
          const cleanReason = getCleanReason(req);
          return (
          <div key={req._id} className="glass-panel animate-fade-in advance-card-item">
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexGrow: 1 }}>
              <img 
                src={req.labourId?.imageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=80'} 
                alt={req.labourId?.name || 'Deleted'} 
                style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{req.labourId?.name || 'Deleted Employee'}</span>
                  <span className={`badge ${
                    req.status === 'approved' ? 'badge-success' :
                    req.status === 'rejected' ? 'badge-danger' :
                    'badge-warning'
                  }`}>
                    {req.status}
                  </span>
                  <span
                    title={source.story}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      background: accent.bg,
                      border: `1px solid ${accent.border}`,
                      color: accent.text,
                      padding: '3px 10px', borderRadius: '9999px',
                      fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.04em',
                      textTransform: 'uppercase', whiteSpace: 'nowrap'
                    }}
                  >
                    <span aria-hidden="true">{source.icon}</span>
                    <span>{source.label}</span>
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                  Requested by <span style={{ fontWeight: 600 }}>{req.requestedBy?.name}</span> on {new Date(req.date).toLocaleDateString('en-GB')}
                </div>
                {(req.fundingStaffName || req.fundingStaffId?.name) && req.labourId?.name !== 'Company Expenses' && (
                  <div style={{ color: 'var(--accent-primary)', fontSize: '0.82rem', marginTop: '4px', fontWeight: 650 }}>
                    Deduct from: {req.fundingStaffName || req.fundingStaffId?.name}'s company credit
                  </div>
                )}
                <div style={{
                  marginTop: '10px',
                  padding: '10px 13px',
                  background: accent.bg,
                  border: `1px solid ${accent.border}`,
                  borderRadius: '10px',
                  maxWidth: '620px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                    <span aria-hidden="true">{source.icon}</span>
                    <strong style={{ color: accent.text, fontSize: '0.88rem' }}>{source.headline}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.83rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                    {source.story}
                  </p>
                </div>

                <div style={{ fontSize: '0.95rem', marginTop: '8px', fontStyle: 'italic', color: 'var(--text-primary)' }}>
                  <span style={{ fontStyle: 'normal', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.04em' }}>REASON / NOTE: </span>
                  &ldquo;{cleanReason || 'No reason provided'}&rdquo;
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Requested Amt</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>₹{req.amount.toLocaleString('en-IN')}</div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {req.status === 'pending' && (
                  <>
                    <button onClick={() => handleApproveAdvance(req)} className="btn btn-success" style={{ padding: '9px 18px' }}>
                      <CheckCircle size={16} /> Approve
                    </button>
                    <button onClick={() => handleRejectAdvance(req._id)} className="btn btn-danger" style={{ padding: '9px 18px' }}>
                      <XCircle size={16} /> Reject
                    </button>
                  </>
                )}
                <button 
                  onClick={() => handleDeleteAdvance(req._id, req.labourId?.name)} 
                  className="btn btn-secondary" 
                  style={{ 
                    padding: '9px 14px', 
                    background: 'rgba(239, 68, 68, 0.08)', 
                    color: '#ef4444', 
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Delete permanently"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          </div>
          );
        })}

        {filteredRequests.length === 0 && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            No advance requests matching this filter.
          </div>
        )}
      </div>

      {/* MODAL: UPI PAYMENT OR CASH HANDOVER DISPLAY */}
      {activePaymentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300
        }}>
          <div className="glass-panel glass-panel-glow animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '32px', borderRadius: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
            <h3 className="gradient-text" style={{ fontSize: '1.55rem', fontWeight: 800, margin: 0 }}>
              {activePaymentModal.paymentMode === 'online' ? '💸 Scan to Pay Staff' : '💵 Hand Cash Payment'}
            </h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, lineHeight: '1.5' }}>
              {activePaymentModal.paymentMode === 'online' 
                ? 'Scan this QR code with PhonePe, GPay, Paytm to transfer funds. After paying, click the button below 3 times.' 
                : 'Please hand over the physical cash to the staff member. After paying, click the button below 3 times.'}
            </p>

            {/* QR Code Container (Only for Online Mode and when UPI ID exists) */}
            {activePaymentModal.paymentMode === 'online' && activePaymentModal.upiId ? (
              (() => {
                const note = activePaymentModal.labourName 
                  ? `Advance for ${activePaymentModal.labourName}` 
                  : 'Company Expenses Advance';
                const upiLink = `upi://pay?pa=${encodeURIComponent(activePaymentModal.upiId!)}&pn=${encodeURIComponent(activePaymentModal.name)}&am=${activePaymentModal.amount}&cu=INR&tn=${encodeURIComponent(note)}`;
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}&margin=10`;
                
                return (
                  <div style={{ background: '#ffffff', padding: '16px', borderRadius: '16px', border: '1px solid var(--glass-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <img 
                      src={qrUrl} 
                      alt="UPI QR Code" 
                      style={{ width: '180px', height: '180px', display: 'block' }} 
                    />
                  </div>
                );
              })()
            ) : activePaymentModal.paymentMode === 'online' ? (
              <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed var(--color-danger)', borderRadius: '16px', padding: '24px 16px', color: 'var(--color-danger)', fontSize: '0.9rem', fontWeight: 500 }}>
                ⚠️ No UPI ID saved for this staff member. Please transfer the funds manually to their bank account.
              </div>
            ) : (
              <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px dashed var(--color-success)', borderRadius: '16px', padding: '24px 16px', color: 'var(--color-success)', fontSize: '1.4rem' }}>
                🤝 Cash Handover
              </div>
            )}

            {/* Payment Details */}
            <div style={{ width: '100%', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Receiver:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{activePaymentModal.name}</strong>
              </div>
              {activePaymentModal.paymentMode === 'online' && activePaymentModal.upiId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>UPI ID:</span>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{activePaymentModal.upiId}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Purpose:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {activePaymentModal.labourName ? `Advance for ${activePaymentModal.labourName}` : 'Company Expenses'}
                </strong>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600 }}>Amount:</span>
                <strong style={{ color: 'var(--accent-secondary)', fontSize: '1.4rem', fontWeight: 800 }}>
                  ₹{activePaymentModal.amount.toLocaleString('en-IN')}
                </strong>
              </div>
            </div>

            {/* Actions: Done & Paid (3-clicks) + Cancel */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={handleDoneClick} 
                className="btn" 
                style={{ 
                  width: '100%', 
                  height: '46px', 
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  color: '#ffffff',
                  background: submittingApproval 
                    ? 'var(--bg-tertiary)' 
                    : clickCount === 0 
                      ? 'linear-gradient(135deg, var(--accent-primary) 0%, #4338ca 100%)' 
                      : clickCount === 1 
                        ? 'linear-gradient(135deg, var(--color-warning) 0%, #b45309 100%)' 
                        : 'linear-gradient(135deg, var(--color-success) 0%, #047857 100%)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  transition: 'background 0.25s ease'
                }}
                disabled={submittingApproval}
              >
                {submittingApproval 
                  ? 'Completing Approval...' 
                  : clickCount === 0 
                    ? 'Done & Paid (Click 3 times)' 
                    : clickCount === 1 
                      ? 'Confirm Payment (2 clicks left)' 
                      : 'Confirm Payment (1 click left)'}
              </button>

              <button 
                onClick={handleCancelPayment}
                className="btn btn-secondary" 
                style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                disabled={submittingApproval}
              >
                Cancel & Close (Keep Pending)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APPROVAL SETUP (CHOOSE PAYMENT MODE) */}
      {approvalSetupModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250
        }}>
          <div className="glass-panel glass-panel-glow animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '32px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, textAlign: 'center' }}>
              Approve Advance
            </h3>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, textAlign: 'center', lineHeight: '1.5' }}>
              Select how you want to pay this advance request for **{approvalSetupModal.labourId?.name || 'Company Expenses'}**.
            </p>

            {/* Request Details Card */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Requested Amt:</span>
                <strong style={{ color: 'var(--accent-secondary)', fontSize: '1.1rem' }}>
                  ₹{approvalSetupModal.amount.toLocaleString('en-IN')}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Requested By:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{approvalSetupModal.requestedBy?.name}</strong>
              </div>
              {approvalSetupModal.reason && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--glass-border)', paddingTop: '8px', marginTop: '4px' }}>
                  <span>Reason:</span>
                  <span style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>&ldquo;{approvalSetupModal.reason}&rdquo;</span>
                </div>
              )}
            </div>

            {/* Payment Mode Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Payment Mode</label>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Online Mode */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMode('online')}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: selectedPaymentMode === 'online' ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                    background: selectedPaymentMode === 'online' ? 'rgba(79, 70, 229, 0.05)' : 'transparent',
                    color: selectedPaymentMode === 'online' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>🌐</span>
                  <span>Online (UPI)</span>
                </button>

                {/* Cash Mode */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMode('handcash')}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: selectedPaymentMode === 'handcash' ? '2px solid var(--color-success)' : '1px solid var(--glass-border)',
                    background: selectedPaymentMode === 'handcash' ? 'rgba(5, 150, 105, 0.05)' : 'transparent',
                    color: selectedPaymentMode === 'handcash' ? 'var(--color-success)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>💵</span>
                  <span>Hand Cash</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button 
                type="button" 
                onClick={submitApproval}
                className="btn btn-primary" 
                style={{ flexGrow: 1, height: '44px', fontWeight: 700 }}
                disabled={submittingApproval}
              >
                {submittingApproval ? 'Approving...' : 'Confirm & Approve'}
              </button>
              <button 
                type="button" 
                onClick={() => setApprovalSetupModal(null)} 
                className="btn btn-secondary"
                style={{ height: '44px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
