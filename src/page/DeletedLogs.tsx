import { useState, useEffect, useMemo } from 'react';
import { Search, Loader, Trash2, Calendar, User, FileText } from 'lucide-react';
import '../styles/Dashboard.css';


interface DeletedLog {
  _id: string;
  originalId: string;
  itemType: string;
  category: string;
  txType: 'received' | 'expense';
  amount: number;
  paymentMode: 'online' | 'handcash';
  date: string;
  description: string;
  taggedPerson?: string;
  loggedByStaff?: string;
  deletedBy?: {
    _id: string;
    name: string;
    username: string;
    role: string;
  };
  deletedByName?: string;
  deletedAt: string;
}

interface DeletedLogsProps {
  token: string | null;
  apiBase: string;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export default function DeletedLogs({ token, apiBase, showToast }: DeletedLogsProps) {
  const [logs, setLogs] = useState<DeletedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDeletedLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/deleted-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      } else {
        showToast('Failed to fetch deleted logs audit', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDeletedLogs();
    }
  }, [token]);

  // Filter logs by search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const query = searchQuery.toLowerCase().trim();
    return logs.filter((log) => {
      const category = (log.category || '').toLowerCase();
      const desc = (log.description || '').toLowerCase();
      const amount = String(log.amount || '');
      const deletedBy = (log.deletedBy?.name || log.deletedByName || '').toLowerCase();
      const tagged = (log.taggedPerson || '').toLowerCase();

      return category.includes(query) ||
             desc.includes(query) ||
             amount.includes(query) ||
             deletedBy.includes(query) ||
             tagged.includes(query);
    });
  }, [logs, searchQuery]);

  // Totals
  const totalDeletedAmount = useMemo(() => {
    return filteredLogs.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [filteredLogs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
            <Trash2 size={28} style={{ color: '#ef4444' }} /> Deleted History & Audit Log
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '4px 0 0' }}>
            Permanent record of all deleted transactions, who deleted them, and original details.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 18px', borderRadius: '12px', textAlign: 'center' }}>
            <small style={{ color: '#991b1b', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 700 }}>Total Deleted</small>
            <div style={{ fontSize: '1.2rem', fontWeight: 850, color: '#dc2626' }}>{filteredLogs.length} Entries</div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 18px', borderRadius: '12px', textAlign: 'center' }}>
            <small style={{ color: '#475569', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 700 }}>Total Deleted Amount</small>
            <div style={{ fontSize: '1.2rem', fontWeight: 850, color: '#0f172a' }}>₹{totalDeletedAmount.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      {/* Main Table Glass Panel */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '400px' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search deleted logs by description, category, staff..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '38px', borderRadius: '10px' }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="table-container" style={{ maxHeight: '600px', margin: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <Loader className="spinner" size={32} />
              <p style={{ marginTop: '12px' }}>Loading deleted audit records...</p>
            </div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Deleted At</th>
                  <th>Deleted By</th>
                  <th>Type / Category</th>
                  <th>Payment Mode</th>
                  <th>Original Date</th>
                  <th>Description / Notes</th>
                  <th>Original Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const deleterName = log.deletedBy?.name || log.deletedByName || 'Unknown Staff';
                  const delDateStr = new Date(log.deletedAt).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const origDateStr = new Date(log.date).toLocaleDateString('en-GB');

                  return (
                    <tr key={log._id}>
                      <td style={{ fontSize: '0.85rem', fontWeight: 600, color: '#dc2626' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={14} /> {delDateStr}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#1e293b' }}>
                          <User size={14} style={{ color: '#4f46e5' }} /> {deleterName}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${log.txType === 'received' ? 'badge-success' : 'badge-danger'}`}>
                          {log.txType === 'received' ? 'RECEIVED' : (log.category || 'EXPENSE').replace('-', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>
                          {log.paymentMode === 'online' ? '🌐 Online' : '💵 Cash'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {origDateStr}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 600 }}>{log.description || '--'}</span>
                          {log.taggedPerson && (
                            <small style={{ color: '#4f46e5', fontWeight: 500 }}>
                              👤 Tagged: {log.taggedPerson}
                            </small>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 800, color: '#dc2626', fontSize: '1rem' }}>
                        ₹{log.amount?.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      <FileText size={36} style={{ opacity: 0.4, marginBottom: '8px' }} />
                      <br />
                      No deleted log entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
