import { Loader, Edit3, Settings as SettingsIcon, Trash2 } from 'lucide-react';
import '../styles/Settings.css';

import { useState, useEffect } from 'react';

interface User {
  id: string;
  _id?: string;
  username: string;
  name: string;
  role: string;
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
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [newName, setNewName] = useState('');
  const [updating, setUpdating] = useState(false);

  // Departments State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [addingDept, setAddingDept] = useState(false);

  useEffect(() => {
    if (token) {
      fetchDepartments();
    }
  }, [token]);

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
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !newName.trim()) return;
    
    setUpdating(true);
    const staffId = selectedStaff.id || selectedStaff._id;
    try {
      const res = await fetch(`${apiBase}/staff/${staffId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName })
      });

      if (res.ok) {
        showToast('Staff name updated successfully!', 'success');
        setSelectedStaff(null);
        setNewName('');
        fetchStaffUsers();
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

  return (
    <div className="settings-page-container">
      <div>
        <h1 style={{ fontSize: '2.2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SettingsIcon size={32} /> System Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage portal configuration, staff names, and control system variables.</p>
      </div>

      <div className="settings-grid">
        {/* Left column: Staff List */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.25rem' }}>Office Staff Accounts</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Select an office staff member to edit their system name.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {allStaff.map(staff => {
              const isSelected = selectedStaff && (selectedStaff.id === staff.id || selectedStaff._id === staff._id);
              return (
                <div 
                  key={staff.id || staff._id} 
                  className="staff-settings-card"
                  style={{
                    borderColor: isSelected ? 'var(--accent-primary)' : 'var(--glass-border)',
                    background: isSelected ? 'rgba(79, 70, 229, 0.04)' : 'var(--bg-tertiary)'
                  }}
                >
                  <div className="staff-info-block">
                    <div className="staff-avatar">
                      {staff.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="staff-name-text">{staff.name}</div>
                      <div className="staff-username-text">@{staff.username} • <span style={{ textTransform: 'capitalize' }}>{staff.role}</span></div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleSelectStaff(staff)}
                    className="btn btn-secondary"
                    style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                  >
                    <Edit3 size={14} /> Rename
                  </button>
                </div>
              );
            })}
            {allStaff.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px', fontStyle: 'italic' }}>
                No office staff registered in system.
              </div>
            )}
          </div>
        </div>

        {/* Right column: Edit Form */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Edit Staff Name</h3>
          {selectedStaff ? (
            <form onSubmit={handleUpdateName} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={`@${selectedStaff.username}`} 
                  disabled 
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={selectedStaff.role} 
                  disabled 
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'not-allowed', textTransform: 'capitalize' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter new display name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={updating}>
                  {updating ? <Loader className="spinner" size={16} /> : 'Save Changes'}
                </button>
                <button type="button" onClick={() => { setSelectedStaff(null); setNewName(''); }} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              Select a staff member from the list to update their name.
            </div>
          )}
        </div>
      </div>

      {/* Manage Departments Section */}
      <div style={{ marginTop: '48px' }}>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SettingsIcon size={24} /> Manage Departments
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Configure department names for your employee badges and search filters.</p>
      </div>

      <div className="settings-grid" style={{ marginBottom: '40px' }}>
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

    </div>
  );
}
