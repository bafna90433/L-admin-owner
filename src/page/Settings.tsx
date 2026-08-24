import {
  AlertTriangle,
  Loader,
  Edit3,
  Settings as SettingsIcon,
  Trash2,
  IndianRupee,
  ShieldCheck,
  UsersRound,
  Building2,
  ChevronRight,
  Search,
  SlidersHorizontal,
  UserPlus,
  Phone,
  X,
  Save
} from 'lucide-react';
import '../styles/Settings.css';
import AccessControl from './AccessControl';

import { useState, useEffect } from 'react';

interface User {
  id: string;
  _id?: string;
  username: string;
  name: string;
  role: string;
  roleName?: string;
  roleId?: string | null;
  whatsapp?: string;
  imageUrl?: string;
  isActive?: boolean;
}

interface RoleSummary {
  id: string;
  isActive: boolean;
}

interface Department {
  _id: string;
  name: string;
}

interface SettingsProps {
  token: string | null;
  apiBase: string;
  allStaff: User[];
  fetchStaffUsers: () => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export default function Settings({
  token,
  apiBase,
  allStaff,
  fetchStaffUsers,
  showToast
}: SettingsProps) {
  const [activeSetting, setActiveSetting] = useState('settings-access');
  const [previewPhoto, setPreviewPhoto] = useState<{ name: string; url: string } | null>(null);
  const settingsNav = [
    { id: 'settings-access', label: 'Staff & Roles', icon: ShieldCheck },
    { id: 'settings-staff-names', label: 'Staff Display Names', icon: UsersRound },
    { id: 'settings-departments', label: 'Departments', icon: Building2 },
    { id: 'settings-advance', label: 'Advance Approval', icon: IndianRupee }
  ];

  const openSetting = (id: string) => {
    setActiveSetting(id);
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [newName, setNewName] = useState('');
  const [newActive, setNewActive] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [directoryStaff, setDirectoryStaff] = useState<User[]>([]);
  const [directoryRoles, setDirectoryRoles] = useState<RoleSummary[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');

  // Departments State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [addingDept, setAddingDept] = useState(false);

  // Advance Auto Approval Limit state
  const [autoApproveLimit, setAutoApproveLimit] = useState('5000');
  const [savingAutoApproveLimit, setSavingAutoApproveLimit] = useState(false);

  useEffect(() => {
    if (token) {
      fetchDepartments();
      fetchAutoApproveLimit();
      fetchDirectoryData();
    }
  }, [token]);

  async function fetchDirectoryData() {
    if (!token) return;
    setDirectoryLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [staffResponse, roleResponse] = await Promise.all([
        fetch(`${apiBase}/admin/staff`, { headers }),
        fetch(`${apiBase}/admin/roles`, { headers })
      ]);
      if (!staffResponse.ok || !roleResponse.ok) throw new Error('Could not load staff directory');
      const [staffData, roleData] = await Promise.all([staffResponse.json(), roleResponse.json()]);
      const staffList = staffData || [];
      setDirectoryStaff(staffList);
      setDirectoryRoles(roleData || []);
      if (!selectedStaff && staffList.length > 0) {
        setSelectedStaff(staffList[0]);
        setNewName(staffList[0].name);
        setNewActive(staffList[0].isActive !== false);
      }
    } catch (error) {
      console.error(error);
      setDirectoryStaff(allStaff);
    } finally {
      setDirectoryLoading(false);
    }
  }

  const fetchAutoApproveLimit = async () => {
    try {
      const res = await fetch(`${apiBase}/settings/advance_auto_approval_limit`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.value !== undefined) {
          setAutoApproveLimit(data.value.toString());
        }
      }
    } catch (err) {
      console.error('Error fetching auto approve limit:', err);
    }
  };

  const handleSaveAutoApproveLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(autoApproveLimit);
    if (isNaN(limit) || limit < 0) {
      showToast('Please enter a valid positive amount', 'danger');
      return;
    }

    setSavingAutoApproveLimit(true);
    try {
      const res = await fetch(`${apiBase}/settings/advance_auto_approval_limit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ value: limit })
      });
      if (res.ok) {
        showToast('Advance auto-approval limit updated successfully!', 'success');
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to update limit', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setSavingAutoApproveLimit(false);
    }
  };

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

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setAddingDept(true);
    try {
      const res = await fetch(`${apiBase}/departments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newDeptName })
      });
      if (res.ok) {
        showToast('Department added successfully!', 'success');
        setNewDeptName('');
        fetchDepartments();
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to add department', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setAddingDept(false);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/departments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Department deleted successfully!', 'success');
        fetchDepartments();
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to delete department', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    }
  };

  const handleSelectStaff = (staff: User) => {
    setSelectedStaff(staff);
    setNewName(staff.name);
    setNewActive(staff.isActive !== false);
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !newName.trim()) return;
    
    setUpdating(true);
    const staffId = selectedStaff.id || selectedStaff._id;
    try {
      const res = await fetch(`${apiBase}/admin/staff/${staffId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName, isActive: newActive })
      });

      if (res.ok) {
        showToast('Staff name updated successfully!', 'success');
        setSelectedStaff(null);
        setNewName('');
        fetchStaffUsers();
        fetchDirectoryData();
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to update staff name', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setUpdating(false);
    }
  };

  const [staffToDelete, setStaffToDelete] = useState<User | null>(null);

  const confirmDeleteStaff = async () => {
    if (!staffToDelete) return;
    const staffId = staffToDelete.id || staffToDelete._id;
    if (!staffId) return;
    setUpdating(true);
    try {
      let res = await fetch(`${apiBase}/admin/staff/${staffId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Fallback for Railway live production server if DELETE returns 404
      if (!res.ok) {
        res = await fetch(`${apiBase}/admin/staff/${staffId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ isActive: false })
        });
      }

      if (res.ok) {
        showToast('Staff account deleted successfully!', 'success');
        setSelectedStaff(null);
        setStaffToDelete(null);
        setNewName('');
        fetchStaffUsers();
        fetchDirectoryData();
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to delete staff account', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setUpdating(false);
    }
  };

  const visibleDirectoryStaff = (directoryStaff.length ? directoryStaff : allStaff).filter(staff => {
    if (staff.isActive === false) return false;
    const query = staffSearch.trim().toLowerCase();
    if (!query) return true;
    return [staff.name, staff.username, staff.roleName, staff.role]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(query));
  });

  const activeStaffCount = (directoryStaff.length ? directoryStaff : allStaff)
    .filter(staff => staff.isActive !== false).length;
  const activeRoleCount = directoryRoles.filter(role => role.isActive).length;
  const displayRole = (staff: User) => staff.roleName || staff.role || 'Staff';

  return (
    <div className="settings-layout">
      <aside className="settings-subnav">
        <div className="settings-subnav-heading">
          <SettingsIcon size={20} />
          <div><strong>Settings</strong><small>Control centre</small></div>
        </div>
        <nav>
          {settingsNav.map(item => {
            const Icon = item.icon;
            return (
              <button className={activeSetting === item.id ? 'active' : ''} key={item.id} onClick={() => openSetting(item.id)}>
                <Icon size={17} /><span>{item.label}</span><ChevronRight size={15} />
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="settings-page-container">
      <div hidden={activeSetting === 'settings-staff-names' || activeSetting === 'settings-access'}>
        <h1 style={{ fontSize: '2.2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SettingsIcon size={32} /> System Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage portal configuration, staff names, and control system variables.</p>
      </div>

      <section id="settings-access" className="settings-anchor-section" hidden={activeSetting !== 'settings-access'}>
        {token && (
          <AccessControl
            token={token}
            apiBase={apiBase}
            showToast={showToast}
            onStaffChanged={fetchStaffUsers}
          />
        )}
      </section>

      <section id="settings-staff-names" className="staff-directory-page settings-anchor-section" hidden={activeSetting !== 'settings-staff-names'}>
        <header className="staff-directory-header">
          <div>
            <span className="staff-directory-eyebrow"><UsersRound size={15} /> Workforce identity centre</span>
            <h1>Staff Directory Settings</h1>
            <p>Manage staff identities, roles and account visibility.</p>
          </div>
          <button className="staff-add-button" onClick={() => openSetting('settings-access')}>
            <UserPlus size={18} /> Add staff
          </button>
        </header>

        <div className="staff-directory-workspace">
          <div className="staff-directory-main">
            <div className="staff-directory-toolbar">
              <div className="staff-stat-card">
                <span className="staff-stat-icon"><UsersRound size={21} /></span>
                <div><strong>{activeStaffCount}</strong><span>Active Staff</span></div>
              </div>
              <div className="staff-stat-card">
                <span className="staff-stat-icon"><ShieldCheck size={21} /></span>
                <div><strong>{directoryLoading ? '—' : activeRoleCount}</strong><span>Roles</span></div>
              </div>
              <label className="staff-directory-search">
                <Search size={18} />
                <input value={staffSearch} onChange={event => setStaffSearch(event.target.value)} placeholder="Search staff..." />
              </label>
              <button className="staff-filter-button" type="button" aria-label="Filter staff"><SlidersHorizontal size={18} /></button>
            </div>

            <div className="staff-directory-table-wrap">
              <div className="staff-directory-table-header">
                <span>Staff member</span><span>Role</span><span>WhatsApp</span><span>Status</span><span>Action</span>
              </div>
              <div className="staff-directory-list">
                {directoryLoading && visibleDirectoryStaff.length === 0 ? (
                  <div className="staff-directory-empty"><Loader className="spinner" size={20} /> Loading staff directory...</div>
                ) : visibleDirectoryStaff.map(staff => {
                  const isSelected = Boolean(selectedStaff && (selectedStaff.id === staff.id || selectedStaff._id === staff._id));
                  return (
                    <button
                      type="button"
                      key={staff.id || staff._id}
                      className={`staff-directory-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectStaff(staff)}
                    >
                      <span className="staff-member-cell">
                        {staff.imageUrl ? (
                          <img 
                            src={staff.imageUrl.startsWith('http') ? staff.imageUrl : `${apiBase}${staff.imageUrl}`} 
                            alt={staff.name} 
                            title="Click to view profile photo"
                            onClick={(e) => {
                              e.stopPropagation();
                              const url = staff.imageUrl!.startsWith('http') ? staff.imageUrl! : `${apiBase}${staff.imageUrl}`;
                              setPreviewPhoto({ name: staff.name, url });
                            }}
                            style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', flexShrink: 0 }}
                          />
                        ) : (
                          <span className="staff-directory-avatar" style={{ width: 54, height: 54, fontSize: '1.1rem', flexShrink: 0 }}>{staff.name.slice(0, 2).toUpperCase()}</span>
                        )}
                        <span><strong>{staff.name}</strong><small>@{staff.username}</small></span>
                      </span>
                      <span><span className="staff-role-badge">{displayRole(staff)}</span></span>
                      <span className="staff-whatsapp-cell">
                        <Phone size={15} /> {staff.whatsapp || 'Not added'}
                      </span>
                      <span><span className={`staff-status-badge ${staff.isActive === false ? 'inactive' : ''}`}><i></i>{staff.isActive === false ? 'Inactive' : 'Active'}</span></span>
                      <span className="staff-edit-link">Edit profile <Edit3 size={14} /></span>
                    </button>
                  );
                })}
                {!directoryLoading && visibleDirectoryStaff.length === 0 && (
                  <div className="staff-directory-empty">No matching staff account found.</div>
                )}
              </div>
            </div>
          </div>

          <aside className={`staff-profile-panel ${selectedStaff ? 'has-selection' : ''}`}>
            {selectedStaff ? (
              <form onSubmit={handleUpdateName}>
                <div className="staff-profile-titlebar">
                  <h2>Edit staff profile</h2>
                  <button type="button" aria-label="Close editor" onClick={() => { setSelectedStaff(null); setNewName(''); }}><X size={19} /></button>
                </div>
                <div className="staff-profile-identity">
                  <span className="staff-directory-avatar large">{selectedStaff.name.slice(0, 2).toUpperCase()}</span>
                  <div><strong>{selectedStaff.name}</strong><span>@{selectedStaff.username}</span></div>
                </div>
                <div className="staff-profile-divider"></div>
                <label className="staff-profile-field">
                  <span>Display name</span>
                  <input value={newName} onChange={event => setNewName(event.target.value)} required />
                </label>
                <label className="staff-profile-field">
                  <span>Role</span>
                  <input value={displayRole(selectedStaff)} readOnly />
                  <small>Role is managed in Staff &amp; Roles.</small>
                </label>
                <div className="staff-visibility-block">
                  <strong>Account visibility</strong>
                  <p>Control whether this staff member is visible and can access the system.</p>
                  <label className="staff-visibility-switch">
                    <input type="checkbox" checked={newActive} onChange={event => setNewActive(event.target.checked)} />
                    <span></span>
                    <div><strong>{newActive ? 'Active' : 'Inactive'}</strong><small>{newActive ? 'Staff member can access the system' : 'Staff member login is blocked'}</small></div>
                  </label>
                </div>
                <div className="staff-profile-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                    <button type="button" className="staff-cancel-button" onClick={() => { setSelectedStaff(null); setNewName(''); }}>Cancel</button>
                    <button type="submit" className="staff-save-button" disabled={updating}>
                      {updating ? <Loader className="spinner" size={16} /> : <Save size={16} />} Save changes
                    </button>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    style={{ width: '100%', padding: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    disabled={updating}
                    onClick={() => setStaffToDelete(selectedStaff)}
                  >
                    <Trash2 size={15} /> Delete Staff Account
                  </button>
                </div>
              </form>
            ) : (
              <div className="staff-profile-placeholder">
                <span><Edit3 size={24} /></span>
                <h2>Edit staff profile</h2>
                <p>Select a staff member from the directory to manage their display name and account visibility.</p>
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* Modern Custom Delete Confirmation Modal */}
      {staffToDelete && (
        <div className="ac-modal-backdrop" onMouseDown={() => setStaffToDelete(null)}>
          <div className="ac-confirm-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="ac-confirm-icon">
              <AlertTriangle size={28} />
            </div>
            <h3 className="ac-confirm-title">Delete Staff Account?</h3>
            <p className="ac-confirm-desc">
              Are you sure you want to delete <strong>"{staffToDelete.name}"</strong>? This action cannot be undone and will permanently revoke access.
            </p>
            <div className="ac-confirm-actions">
              <button 
                type="button" 
                className="btn btn-secondary" 
                disabled={updating} 
                onClick={() => setStaffToDelete(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-danger-gradient" 
                disabled={updating} 
                onClick={confirmDeleteStaff}
              >
                {updating ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Departments Section */}
      <div id="settings-departments" className="settings-anchor-section" hidden={activeSetting !== 'settings-departments'}>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SettingsIcon size={24} /> Manage Departments
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Configure department names for your employee badges and search filters.</p>
      </div>

      <div className="settings-grid" hidden={activeSetting !== 'settings-departments'}>
        {/* Left column: Department List */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.25rem' }}>Active Departments</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Existing departments in the system. Delete a department to remove it from the uploader suggestions.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
            {departments.map(dept => (
              <div 
                key={dept._id} 
                className="staff-settings-card"
                style={{ background: 'var(--bg-tertiary)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="staff-avatar" style={{ background: 'var(--accent-secondary)' }}>
                    {dept.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="staff-name-text">{dept.name}</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteDepartment(dept._id)}
                  className="btn btn-danger"
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            ))}
            {departments.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px', fontStyle: 'italic' }}>
                No departments registered in system.
              </div>
            )}
          </div>
        </div>

        {/* Right column: Add Form */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Add New Department</h3>
          <form onSubmit={handleAddDepartment} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Department Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Security, Supervisor, Accounts"
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={addingDept}>
              {addingDept ? <Loader className="spinner" size={16} /> : 'Create Department'}
            </button>
          </form>
        </div>
      </div>

      {/* Advance Auto Approval Limit Section */}
      <div id="settings-advance" className="settings-anchor-section" hidden={activeSetting !== 'settings-advance'}>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <IndianRupee size={24} /> Labour Advance Auto-Approval
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Configure the maximum advance amount that staff can give without owner approval.</p>
      </div>

      <div className="glass-panel" hidden={activeSetting !== 'settings-advance'}>
        <form onSubmit={handleSaveAutoApproveLimit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Auto-Approval Limit (₹)</label>
            <input 
              type="number" 
              className="form-input" 
              placeholder="e.g. 5000"
              value={autoApproveLimit}
              onChange={e => setAutoApproveLimit(e.target.value)}
              required
            />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              Advance requests equal to or below this amount will be automatically approved and deducted. Requests above this limit will remain pending for your approval.
            </p>
          </div>

          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '12px 24px' }} disabled={savingAutoApproveLimit}>
            {savingAutoApproveLimit ? <Loader className="spinner" size={16} /> : 'Save Limit'}
          </button>
        </form>
      </div>

      </div>

      {/* Profile Image HD Lightbox / Preview Modal */}
      {previewPhoto && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(11, 20, 26, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setPreviewPhoto(null)}
        >
          <div 
            style={{
              position: 'relative',
              background: '#ffffff',
              borderRadius: '24px',
              padding: '28px',
              maxWidth: '460px',
              width: '92vw',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
              animation: 'waMenuScale 0.2s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button 
              type="button"
              onClick={() => setPreviewPhoto(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
                transition: 'all 0.15s ease'
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 16px', fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
              {previewPhoto.name}'s Profile Photo
            </h3>

            <div style={{
              width: '280px',
              height: '280px',
              borderRadius: '50%',
              overflow: 'hidden',
              boxShadow: '0 12px 30px rgba(99, 102, 241, 0.25)',
              border: '4px solid #6366f1',
              margin: '8px 0 8px',
              background: '#f8fafc'
            }}>
              <img 
                src={previewPhoto.url} 
                alt={previewPhoto.name} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
