import {
  Loader,
  Edit3,
  Settings as SettingsIcon,
  Trash2,
  Clock,
  MapPin,
  Bell,
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
  const settingsNav = [
    { id: 'settings-access', label: 'Staff & Roles', icon: ShieldCheck },
    { id: 'settings-staff-names', label: 'Staff Display Names', icon: UsersRound },
    { id: 'settings-departments', label: 'Departments', icon: Building2 },
    { id: 'settings-advance', label: 'Advance Approval', icon: IndianRupee },
    { id: 'settings-kiosk-hours', label: 'Kiosk Hours', icon: Clock },
    { id: 'settings-kiosk-advanced', label: 'Location & Alarm', icon: MapPin },
    { id: 'settings-grace', label: 'Grace Period', icon: Bell }
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

  // Kiosk operational hours state
  const [startHour, setStartHour] = useState('08');
  const [startMinute, setStartMinute] = useState('30');
  const [endHour, setEndHour] = useState('20');
  const [endMinute, setEndMinute] = useState('30');
  const [savingKioskHours, setSavingKioskHours] = useState(false);

  // Kiosk Location state
  const [lat, setLat] = useState('10.997544');
  const [lng, setLng] = useState('76.878663');
  const [savingLocation, setSavingLocation] = useState(false);

  // Kiosk Alarm state
  const [alarmHour, setAlarmHour] = useState('08');
  const [alarmMinute, setAlarmMinute] = useState('30');
  const [savingAlarm, setSavingAlarm] = useState(false);

  // Grace Period state
  const [gracePeriod, setGracePeriod] = useState('10');
  const [savingGracePeriod, setSavingGracePeriod] = useState(false);

  // Advance Auto Approval Limit state
  const [autoApproveLimit, setAutoApproveLimit] = useState('5000');
  const [savingAutoApproveLimit, setSavingAutoApproveLimit] = useState(false);

  useEffect(() => {
    if (token) {
      fetchDepartments();
      fetchKioskHours();
      fetchKioskLocation();
      fetchKioskAlarm();
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

  const fetchKioskHours = async () => {
    try {
      const res = await fetch(`${apiBase}/settings/kiosk_hours`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.value) {
          const { startHour: sh, startMinute: sm, endHour: eh, endMinute: em } = data.value;
          setStartHour(sh.toString().padStart(2, '0'));
          setStartMinute(sm.toString().padStart(2, '0'));
          setEndHour(eh.toString().padStart(2, '0'));
          setEndMinute(em.toString().padStart(2, '0'));
        }
      }
    } catch (err) {
      console.error('Error fetching kiosk hours:', err);
    }
  };

  const fetchKioskLocation = async () => {
    try {
      const res = await fetch(`${apiBase}/settings/kiosk_location`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.value) {
          setLat(data.value.lat.toString());
          setLng(data.value.lng.toString());
        }
      }
    } catch (err) {
      console.error('Error fetching kiosk location:', err);
    }
  };

  const fetchKioskAlarm = async () => {
    try {
      // Fetch alarm
      fetch(`${apiBase}/settings/kiosk_alarm`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (data && data.value && data.value.alarmHour !== undefined) {
            setAlarmHour(data.value.alarmHour.toString().padStart(2, '0'));
            setAlarmMinute(data.value.alarmMinute.toString().padStart(2, '0'));
          }
        })
        .catch(err => console.error(err));

      // Fetch grace period
      fetch(`${apiBase}/settings/grace_period`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (data && data.value) {
            setGracePeriod(data.value.toString());
          }
        })
        .catch(err => console.error(err));
    } catch (err) {
      console.error('Error fetching kiosk alarm:', err);
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

  const handleSaveKioskHours = async (e: React.FormEvent) => {
    e.preventDefault();
    const sh = parseInt(startHour, 10);
    const sm = parseInt(startMinute, 10);
    const eh = parseInt(endHour, 10);
    const em = parseInt(endMinute, 10);

    if (isNaN(sh) || sh < 0 || sh > 23 || isNaN(sm) || sm < 0 || sm > 59 ||
        isNaN(eh) || eh < 0 || eh > 23 || isNaN(em) || em < 0 || em > 59) {
      showToast('Please enter valid hours (0-23) and minutes (0-59)', 'danger');
      return;
    }

    setSavingKioskHours(true);
    try {
      const res = await fetch(`${apiBase}/settings/kiosk_hours`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          value: {
            startHour: sh,
            startMinute: sm,
            endHour: eh,
            endMinute: em
          }
        })
      });
      if (res.ok) {
        showToast('Kiosk operational hours updated successfully!', 'success');
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to update operational hours', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setSavingKioskHours(false);
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const l = parseFloat(lat);
    const g = parseFloat(lng);

    if (isNaN(l) || isNaN(g)) {
      showToast('Please enter valid latitude and longitude', 'danger');
      return;
    }

    setSavingLocation(true);
    try {
      const res = await fetch(`${apiBase}/settings/kiosk_location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          value: { lat: l, lng: g }
        })
      });
      if (res.ok) {
        showToast('Kiosk location updated successfully!', 'success');
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to update location', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSaveAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    const ah = parseInt(alarmHour, 10);
    const am = parseInt(alarmMinute, 10);

    if (isNaN(ah) || ah < 0 || ah > 23 || isNaN(am) || am < 0 || am > 59) {
      showToast('Please enter valid hours (0-23) and minutes (0-59)', 'danger');
      return;
    }

    setSavingAlarm(true);
    try {
      const res = await fetch(`${apiBase}/settings/kiosk_alarm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          value: { alarmHour: ah, alarmMinute: am }
        })
      });
      if (res.ok) {
        showToast('Kiosk alarm time updated successfully!', 'success');
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to update alarm time', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setSavingAlarm(false);
    }
  };

  const handleSaveGracePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    const gp = parseInt(gracePeriod, 10);

    if (isNaN(gp) || gp < 0) {
      showToast('Please enter a valid number of minutes', 'danger');
      return;
    }

    setSavingGracePeriod(true);
    try {
      const res = await fetch(`${apiBase}/settings/grace_period`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ value: gp })
      });
      if (res.ok) {
        showToast('Grace period updated successfully!', 'success');
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to update grace period', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setSavingGracePeriod(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toFixed(6));
          setLng(position.coords.longitude.toFixed(6));
          showToast('Location fetched successfully!', 'success');
        },
        (error) => {
          console.error(error);
          showToast('Failed to get location. Please allow location access.', 'danger');
        }
      );
    } else {
      showToast('Geolocation is not supported by your browser', 'danger');
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

  const visibleDirectoryStaff = (directoryStaff.length ? directoryStaff : allStaff).filter(staff => {
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
                        <span className="staff-directory-avatar">{staff.name.slice(0, 2).toUpperCase()}</span>
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
                <div className="staff-profile-actions">
                  <button type="button" className="staff-cancel-button" onClick={() => { setSelectedStaff(null); setNewName(''); }}>Cancel</button>
                  <button type="submit" className="staff-save-button" disabled={updating}>
                    {updating ? <Loader className="spinner" size={16} /> : <Save size={16} />} Save changes
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

      {/* Kiosk Operational Hours Section */}
      <div id="settings-kiosk-hours" className="settings-anchor-section" hidden={activeSetting !== 'settings-kiosk-hours'}>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Clock size={24} /> Kiosk Operational Hours
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Configure the working hours for the attendance kiosk app. Outside of these hours, biometric scans will be blocked.</p>
      </div>

      <div className="settings-grid" hidden={activeSetting !== 'settings-kiosk-hours'}>
        {/* Left Card: Information & Helper */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.25rem' }}>Timing Restrictions</h3>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
            Attendance registration is locked outside the configured operational window.
            This prevents employees from registering attendance too early or marking attendance after work hours have ended.
          </p>
          <div style={{
            background: 'rgba(79, 70, 229, 0.04)',
            border: '1px solid var(--glass-border)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              background: 'var(--accent-primary)',
              borderRadius: '50%',
              width: '10px',
              height: '10px',
              boxShadow: '0 0 8px var(--accent-primary)'
            }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Active Window: {startHour}:{startMinute} to {endHour}:{endMinute} (24h format)
            </span>
          </div>
        </div>

        {/* Right Card: Form Input */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Set Kiosk Timing</h3>
          <form onSubmit={handleSaveKioskHours} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Start Time</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    min="0" 
                    max="23"
                    className="form-input" 
                    placeholder="HH"
                    value={startHour}
                    onChange={e => setStartHour(e.target.value.slice(0, 2))}
                    required
                    style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}
                  />
                  <span style={{ fontWeight: 'bold' }}>:</span>
                  <input 
                    type="number" 
                    min="0" 
                    max="59"
                    className="form-input" 
                    placeholder="MM"
                    value={startMinute}
                    onChange={e => setStartMinute(e.target.value.slice(0, 2))}
                    required
                    style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">End Time</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    min="0" 
                    max="23"
                    className="form-input" 
                    placeholder="HH"
                    value={endHour}
                    onChange={e => setEndHour(e.target.value.slice(0, 2))}
                    required
                    style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}
                  />
                  <span style={{ fontWeight: 'bold' }}>:</span>
                  <input 
                    type="number" 
                    min="0" 
                    max="59"
                    className="form-input" 
                    placeholder="MM"
                    value={endMinute}
                    onChange={e => setEndMinute(e.target.value.slice(0, 2))}
                    required
                    style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={savingKioskHours}>
              {savingKioskHours ? <Loader className="spinner" size={16} /> : 'Save Operational Hours'}
            </button>
          </form>
        </div>
      </div>

      <div id="settings-kiosk-advanced" className="settings-anchor-section" hidden={activeSetting !== 'settings-kiosk-advanced'}>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MapPin size={24} /> Advanced Kiosk Settings
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Configure factory location for geofencing and set the default alarm time for un-punched attendance.</p>
      </div>

      <div className="settings-grid settings-anchor-section" hidden={activeSetting !== 'settings-kiosk-advanced'}>
        {/* Left Card: Location */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={18} /> Geofencing Location
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Set the latitude and longitude of the factory. The kiosk app allows punching only within 100 meters.
          </p>
          <form onSubmit={handleSaveLocation} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Latitude</label>
                <input 
                  type="number" step="any"
                  className="form-input" 
                  value={lat}
                  onChange={e => setLat(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Longitude</label>
                <input 
                  type="number" step="any"
                  className="form-input" 
                  value={lng}
                  onChange={e => setLng(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1, fontSize: '0.85rem' }} 
                onClick={handleGetCurrentLocation}
              >
                📍 Use My Location
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1, fontSize: '0.85rem' }} 
                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank')}
              >
                🗺️ View on Map
              </button>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={savingLocation}>
              {savingLocation ? <Loader className="spinner" size={16} /> : 'Save Location'}
            </button>
          </form>
        </div>

        {/* Right Card: Alarm */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} /> Daily App Alarm
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Set the time when the kiosk app alarm starts ringing if an employee hasn't punched.
          </p>
          <form onSubmit={handleSaveAlarm} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Alarm Time (24h)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="number" min="0" max="23"
                  className="form-input" 
                  placeholder="HH"
                  value={alarmHour}
                  onChange={e => setAlarmHour(e.target.value.slice(0, 2))}
                  required
                  style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}
                />
                <span style={{ fontWeight: 'bold' }}>:</span>
                <input 
                  type="number" min="0" max="59"
                  className="form-input" 
                  placeholder="MM"
                  value={alarmMinute}
                  onChange={e => setAlarmMinute(e.target.value.slice(0, 2))}
                  required
                  style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={savingAlarm}>
              {savingAlarm ? <Loader className="spinner" size={16} /> : 'Save Alarm Time'}
            </button>
          </form>
        </div>
      </div>

      {/* Grace Period Card */}
      <div id="settings-grace" className="settings-grid settings-anchor-section" hidden={activeSetting !== 'settings-grace'}>
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} /> Grace Period
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Allow a delay in punch times before calculating short duty.
          </p>
          <form onSubmit={handleSaveGracePeriod} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Grace Period (Minutes)</label>
              <input 
                type="number" min="0" max="120"
                className="form-input" 
                value={gracePeriod}
                onChange={e => setGracePeriod(e.target.value)}
                required
                style={{ fontWeight: 'bold', fontSize: '1.1rem' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={savingGracePeriod}>
              {savingGracePeriod ? <Loader className="spinner" size={16} /> : 'Save Grace Period'}
            </button>
          </form>
        </div>
      </div>

      </div>
    </div>
  );
}
