import { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
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
  };
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

  const handleApproveAdvance = (id: string) => {
    setConfirmModal({
      title: 'Approve Advance Request',
      message: 'Are you sure you want to approve this advance request? It will deduct from salary and add to office expenses.',
      onConfirm: async () => {
        try {
          const res = await fetch(`${apiBase}/advances/${id}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchAdvances();
            fetchDashboardData();
            showToast('Advance request approved successfully!', 'success');
          } else {
            showToast('Failed to approve request', 'danger');
          }
        } catch (err) {
          console.error(err);
          showToast('Error connecting to server', 'danger');
        }
      }
    });
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

  const filteredRequests = advances.filter(a => advFilter === 'all' || a.status === advFilter);

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
        {filteredRequests.map((req) => (
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
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                  Requested by <span style={{ fontWeight: 600 }}>{req.requestedBy?.name}</span> on {new Date(req.date).toLocaleDateString('en-GB')}
                </div>
                <div style={{ fontSize: '0.95rem', marginTop: '6px', fontStyle: 'italic', color: 'var(--text-primary)' }}>
                  &ldquo;{req.reason || 'No reason provided'}&rdquo;
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Requested Amt</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>₹{req.amount.toLocaleString('en-IN')}</div>
              </div>

              {req.status === 'pending' && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => handleApproveAdvance(req._id)} className="btn btn-success" style={{ padding: '10px 20px' }}>
                    <CheckCircle size={16} /> Approve
                  </button>
                  <button onClick={() => handleRejectAdvance(req._id)} className="btn btn-danger" style={{ padding: '10px 20px' }}>
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredRequests.length === 0 && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            No advance requests matching this filter.
          </div>
        )}
      </div>
    </div>
  );
}
