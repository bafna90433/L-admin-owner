import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Search, 
  Phone, 
  Edit3, 
  Trash2, 
  Loader 
} from 'lucide-react';
import '../styles/Labourers.css';

const IMAGEKIT_PUBLIC_KEY = 'public_LB0AyCgim15VO491kDtVm0Fo798=';

interface Labour {
  _id: string;
  name: string;
  whatsapp: string;
  monthlySalary: number;
  imageUrl: string;
  status: string;
  employeeType?: 'labourer' | 'staff';
  department?: string;
  phonePeNumber?: string;
  upiId?: string;
  phonePeQrUrl?: string;
  empCode?: string;
}

const getDepartmentColor = (dept: string) => {
  if (!dept) return { bg: 'rgba(255,255,255,0.05)', text: 'var(--text-secondary)', border: 'transparent' };
  let hash = 0;
  for (let i = 0; i < dept.length; i++) {
    hash = dept.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsla(${hue}, 40%, 25%, 0.25)`,
    text: `hsl(${hue}, 85%, 75%)`,
    border: `hsla(${hue}, 40%, 30%, 0.4)`
  };
};

interface LabourersProps {
  token: string | null;
  apiBase: string;
  labours: Labour[];
  fetchLabours: () => void;
  setConfirmModal: (modal: { title: string; message: string; onConfirm: () => void } | null) => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export default function Labourers({
  token,
  apiBase,
  labours,
  fetchLabours,
  setConfirmModal,
  showToast
}: LabourersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'labourer' | 'staff'>('all');
  
  // Modal / Form States
  const [showLabourModal, setShowLabourModal] = useState(false);
  const [editingLabour, setEditingLabour] = useState<Labour | null>(null);
  const [labourName, setLabourName] = useState('');
  const [labourWhatsapp, setLabourWhatsapp] = useState('');
  const [labourSalary, setLabourSalary] = useState('');
  const [labourImage, setLabourImage] = useState<File | null>(null);
  const [labourImagePreview, setLabourImagePreview] = useState('');
  const [labourImageUrl, setLabourImageUrl] = useState('');
  const [labourStatus, setLabourStatus] = useState('active');
  const [employeeType, setEmployeeType] = useState<'labourer' | 'staff'>('labourer');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [labourSubmitting, setLabourSubmitting] = useState(false);

  // Payment States
  const [phonePeNumber, setPhonePeNumber] = useState('');
  const [upiId, setUpiId] = useState('');
  const [phonePeQrFile, setPhonePeQrFile] = useState<File | null>(null);
  const [phonePeQrPreview, setPhonePeQrPreview] = useState('');
  const [phonePeQrUrl, setPhonePeQrUrl] = useState('');

  // Payment Validation States
  const [phonePeNumberError, setPhonePeNumberError] = useState('');
  const [upiIdError, setUpiIdError] = useState('');
  const [empCode, setEmpCode] = useState('');

  const handlePhonePeNumberChange = (value: string) => {
    setPhonePeNumber(value);
    if (value && !/^\d{10}$/.test(value)) {
      setPhonePeNumberError('Must be exactly 10 digits');
    } else {
      setPhonePeNumberError('');
    }
  };

  const handleUpiIdChange = (value: string) => {
    setUpiId(value);
    if (value && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(value)) {
      setUpiIdError('Invalid UPI format (e.g. name@ybl)');
    } else {
      setUpiIdError('');
    }
  };

  const filteredLabours = labours
    .filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(l => {
      if (selectedFilter === 'all') return true;
      if (selectedFilter === 'labourer') return (l.employeeType || 'labourer') === 'labourer';
      if (selectedFilter === 'staff') return l.employeeType === 'staff';
      return true;
    });

  useEffect(() => {
    if (token) {
      fetchDepartments();
    }
  }, [token, showLabourModal]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${apiBase}/departments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    const authRes = await fetch(`${apiBase}/imagekit/auth`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!authRes.ok) {
      throw new Error('Could not fetch ImageKit signature');
    }
    const authParams = await authRes.json();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);
    formData.append('publicKey', IMAGEKIT_PUBLIC_KEY);
    formData.append('signature', authParams.signature);
    formData.append('expire', authParams.expire.toString());
    formData.append('token', authParams.token);

    const upRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      body: formData
    });

    if (!upRes.ok) {
      throw new Error('Image upload to ImageKit failed');
    }
    const upData = await upRes.json();
    return upData.url;
  };

  const handleLabourSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labourName || !labourWhatsapp || !labourSalary) return;

    if (phonePeNumber && !/^\d{10}$/.test(phonePeNumber)) {
      showToast('PhonePe Number must be a valid 10-digit number', 'warning');
      return;
    }

    if (upiId && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)) {
      showToast('UPI ID format is invalid (e.g. name@ybl)', 'warning');
      return;
    }

    setLabourSubmitting(true);

    try {
      let finalUrl = labourImageUrl;
      if (labourImage) {
        try {
          finalUrl = await handleImageUpload(labourImage);
        } catch (err) {
          showToast('Image upload failed. Default image will be used.', 'warning');
        }
      }

      let finalQrUrl = phonePeQrUrl;
      if (phonePeQrFile) {
        try {
          finalQrUrl = await handleImageUpload(phonePeQrFile);
        } catch (err) {
          showToast('QR Code upload failed.', 'warning');
        }
      }

      const body = {
        name: labourName,
        whatsapp: labourWhatsapp,
        monthlySalary: parseFloat(labourSalary),
        imageUrl: finalUrl,
        status: labourStatus,
        employeeType,
        department,
        phonePeNumber,
        upiId,
        phonePeQrUrl: finalQrUrl,
        empCode
      };

      const url = editingLabour 
        ? `${apiBase}/labours/${editingLabour._id}` 
        : `${apiBase}/labours`;
      const method = editingLabour ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setShowLabourModal(false);
        setEditingLabour(null);
        setLabourName('');
        setLabourWhatsapp('');
        setLabourSalary('');
        setLabourImage(null);
        setLabourImagePreview('');
        setLabourImageUrl('');
        setLabourStatus('active');
        setEmployeeType('labourer');
        setDepartment('');
        setEmpCode('');
        setPhonePeNumber('');
        setUpiId('');
        setPhonePeQrFile(null);
        setPhonePeQrPreview('');
        setPhonePeQrUrl('');
        setPhonePeNumberError('');
        setUpiIdError('');
        fetchLabours();
        showToast(editingLabour ? 'Labourer updated successfully!' : 'Labourer added successfully!', 'success');
      } else {
        showToast('Failed to save labourer', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setLabourSubmitting(false);
    }
  };

  const handleDeleteLabour = (id: string) => {
    setConfirmModal({
      title: 'Delete Labourer',
      message: 'Are you sure you want to delete this labourer?',
      onConfirm: async () => {
        try {
          const res = await fetch(`${apiBase}/labours/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchLabours();
            showToast('Labourer deleted successfully!', 'success');
          } else {
            showToast('Failed to delete labourer', 'danger');
          }
        } catch (err) {
          console.error(err);
          showToast('Error connecting to server', 'danger');
        }
      }
    });
  };

  const handleOpenEditLabour = (lab: Labour) => {
    setEditingLabour(lab);
    setLabourName(lab.name);
    setLabourWhatsapp(lab.whatsapp);
    setLabourSalary(lab.monthlySalary.toString());
    setLabourImageUrl(lab.imageUrl || '');
    setLabourImagePreview(lab.imageUrl || '');
    setLabourStatus(lab.status || 'active');
    setEmployeeType(lab.employeeType || 'labourer');
    setDepartment(lab.department || '');
    setEmpCode(lab.empCode || '');
    setPhonePeNumber(lab.phonePeNumber || '');
    setUpiId(lab.upiId || '');
    setPhonePeQrUrl(lab.phonePeQrUrl || '');
    setPhonePeQrPreview(lab.phonePeQrUrl || '');
    setPhonePeQrFile(null);
    setPhonePeNumberError('');
    setUpiIdError('');
    setShowLabourModal(true);
  };

  return (
    <div className="labour-page-container">
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '2.2rem' }}>Labourers & Staff Directory</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your active labourers and staff profiles, monthly salaries and contact details.</p>
        </div>
        <button onClick={() => { 
          setEditingLabour(null); 
          setLabourName(''); 
          setLabourWhatsapp(''); 
          setLabourSalary(''); 
          setLabourImage(null); 
          setLabourImagePreview(''); 
          setLabourImageUrl(''); 
          setLabourStatus('active'); 
          setEmployeeType('labourer'); 
          setDepartment(''); 
          setEmpCode('');
          setPhonePeNumber('');
          setUpiId('');
          setPhonePeQrFile(null);
          setPhonePeQrPreview('');
          setPhonePeQrUrl('');
          setPhonePeNumberError('');
          setUpiIdError('');
          setShowLabourModal(true); 
        }} className="btn btn-primary">
          <UserPlus size={18} /> Add Employee
        </button>
      </div>

      {/* Search & Filters */}
      <div className="glass-panel search-panel" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexGrow: 1 }}>
          <Search size={20} style={{ color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search employees by name..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid var(--glass-border)', paddingLeft: '16px' }}>
          <button 
            type="button" 
            onClick={() => setSelectedFilter('all')} 
            className={`btn ${selectedFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            All
          </button>
          <button 
            type="button" 
            onClick={() => setSelectedFilter('labourer')} 
            className={`btn ${selectedFilter === 'labourer' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Labourers
          </button>
          <button 
            type="button" 
            onClick={() => setSelectedFilter('staff')} 
            className={`btn ${selectedFilter === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Staff
          </button>
        </div>
      </div>

      {/* Labour Cards Grid */}
      <div className="labour-grid">
        {filteredLabours.map(lab => (
          <div key={lab._id} className="glass-panel animate-fade-in labour-card">
            <div className="labour-card-header">
              <img 
                src={lab.imageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'} 
                alt={lab.name} 
                className="labour-card-avatar"
              />
              <div className="labour-card-info">
                <h3>{lab.name}</h3>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <span className={`badge ${lab.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                    {lab.status}
                  </span>
                  <span className={`badge ${lab.employeeType === 'staff' ? 'badge-warning' : 'badge-info'}`}>
                    {lab.employeeType || 'labourer'}
                  </span>
                  {lab.department && (
                    <span 
                      style={{
                        backgroundColor: getDepartmentColor(lab.department).bg,
                        color: getDepartmentColor(lab.department).text,
                        border: `1px solid ${getDepartmentColor(lab.department).border}`,
                        padding: '2px 8px',
                        borderRadius: '20px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      {lab.department}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="labour-card-details">
              <div className="flex-between">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Monthly Salary</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>₹{lab.monthlySalary.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex-between">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>WhatsApp No.</span>
                <a 
                  href={`https://wa.me/${lab.whatsapp}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}
                >
                  <Phone size={14} style={{ color: 'var(--color-success)' }} /> {lab.whatsapp}
                </a>
              </div>
            </div>

            <div className="labour-card-actions">
              <button onClick={() => handleOpenEditLabour(lab)} className="btn btn-secondary" style={{ flexGrow: 1, padding: '10px' }}>
                <Edit3 size={16} /> Edit
              </button>
              <button onClick={() => handleDeleteLabour(lab._id)} className="btn btn-danger" style={{ padding: '10px' }}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {filteredLabours.length === 0 && (
          <div className="glass-panel" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            No employees found matching current filter and search query.
          </div>
        )}
      </div>

      {/* MODAL: ADD/EDIT LABOUR */}
      {showLabourModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass-panel glass-panel-glow" style={{ width: '100%', maxWidth: '520px', padding: '24px 32px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px' }}>
            <h2 className="gradient-text" style={{ marginBottom: '20px' }}>
              {editingLabour ? 'Edit Labourer' : 'Add New Labourer'}
            </h2>
            <form onSubmit={handleLabourSubmit}>
              <div className="form-group">
                <label className="form-label">Labourer Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter full name"
                  value={labourName}
                  onChange={e => setLabourName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">WhatsApp Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. 919876543210"
                  value={labourWhatsapp}
                  onChange={e => setLabourWhatsapp(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Monthly Salary (₹)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="e.g. 15000"
                  value={labourSalary}
                  onChange={e => setLabourSalary(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Employee Type</label>
                <select 
                  className="form-input"
                  value={employeeType}
                  onChange={e => setEmployeeType(e.target.value as 'labourer' | 'staff')}
                >
                  <option value="labourer">Labourer</option>
                  <option value="staff">Staff</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Department</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Fabrication, Security, Supervisor, Admin"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  list="departments-list"
                />
                <datalist id="departments-list">
                  {departments.map((dept: any) => (
                    <option key={dept._id} value={dept.name} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label className="form-label">Biometric Device ID (empCode)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. 71, 72 (Optional)"
                  value={empCode}
                  onChange={e => setEmpCode(e.target.value)}
                />
              </div>

              {editingLabour && (
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select 
                    className="form-input"
                    value={labourStatus}
                    onChange={e => setLabourStatus(e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}

              {/* Payment details section header */}
              <div style={{ margin: '20px 0 10px 0', borderTop: '1px solid var(--glass-border)', paddingTop: '15px' }}>
                <h4 style={{ color: 'var(--accent-secondary)', fontSize: '0.95rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Payment Details (for Salaries)</h4>
              </div>

              <div className="form-group">
                <label className="form-label">PhonePe Mobile Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ borderColor: phonePeNumberError ? 'var(--color-danger)' : 'var(--glass-border)' }}
                  placeholder="e.g. 9876543210 (Optional)"
                  value={phonePeNumber}
                  onChange={e => handlePhonePeNumberChange(e.target.value)}
                />
                {phonePeNumberError && (
                  <span style={{ color: 'var(--color-danger)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                    {phonePeNumberError}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">UPI ID (VPA)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ borderColor: upiIdError ? 'var(--color-danger)' : 'var(--glass-border)' }}
                  placeholder="e.g. name@ybl or mobile@paytm (Optional)"
                  value={upiId}
                  onChange={e => handleUpiIdChange(e.target.value)}
                />
                {upiIdError && (
                  <span style={{ color: 'var(--color-danger)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                    {upiIdError}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">PhonePe QR Code (Static Image)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPhonePeQrFile(file);
                      setPhonePeQrPreview(URL.createObjectURL(file));
                    }
                  }}
                  className="form-input"
                  style={{ background: 'transparent', padding: '4px 0' }}
                />
                {phonePeQrPreview && (
                  <div style={{ position: 'relative', display: 'inline-block', marginTop: '10px' }}>
                    <img 
                      src={phonePeQrPreview} 
                      alt="QR Preview" 
                      style={{ width: '100px', height: '100px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--glass-border)', padding: '4px', background: '#fff' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        setPhonePeQrFile(null);
                        setPhonePeQrPreview('');
                        setPhonePeQrUrl('');
                      }} 
                      style={{
                        position: 'absolute', top: '-6px', right: '-6px', background: 'var(--color-danger)', 
                        color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', 
                        fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              <div style={{ margin: '20px 0 10px 0', borderTop: '1px solid var(--glass-border)', paddingTop: '15px' }}>
                <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Profile Details</h4>
              </div>

              <div className="form-group">
                <label className="form-label">Profile Image</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setLabourImage(file);
                      setLabourImagePreview(URL.createObjectURL(file));
                    }
                  }}
                  className="form-input"
                  style={{ background: 'transparent', padding: '4px 0' }}
                />
                {labourImagePreview && (
                  <img 
                    src={labourImagePreview} 
                    alt="Preview" 
                    style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', marginTop: '10px', border: '1px solid var(--glass-border)' }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={labourSubmitting}>
                  {labourSubmitting ? <Loader className="spinner" size={16} /> : 'Save Employee'}
                </button>
                <button type="button" onClick={() => {
                  setShowLabourModal(false);
                  setEditingLabour(null);
                  setLabourName('');
                  setLabourWhatsapp('');
                  setLabourSalary('');
                  setLabourImage(null);
                  setLabourImagePreview('');
                  setLabourImageUrl('');
                  setLabourStatus('active');
                  setEmployeeType('labourer');
                  setDepartment('');
                  setEmpCode('');
                  setPhonePeNumber('');
                  setUpiId('');
                  setPhonePeQrFile(null);
                  setPhonePeQrPreview('');
                  setPhonePeQrUrl('');
                  setPhonePeNumberError('');
                  setUpiIdError('');
                }} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
