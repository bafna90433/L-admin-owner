import { Loader, Edit3, Settings as SettingsIcon, Trash2, Clock, MapPin, Bell } from 'lucide-react';
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

  useEffect(() => {
    if (token) {
      fetchDepartments();
      fetchKioskHours();
      fetchKioskLocation();
      fetchKioskAlarm();
    }
  }, [token]);

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
      const res = await fetch(`${apiBase}/settings/kiosk_alarm`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.value) {
          const { alarmHour: ah, alarmMinute: am } = data.value;
          setAlarmHour(ah.toString().padStart(2, '0'));
          setAlarmMinute(am.toString().padStart(2, '0'));
        }
      }
    } catch (err) {
      console.error('Error fetching kiosk alarm:', err);
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

      {/* Kiosk Operational Hours Section */}
      <div style={{ marginTop: '48px' }}>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Clock size={24} /> Kiosk Operational Hours
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Configure the working hours for the attendance kiosk app. Outside of these hours, biometric scans will be blocked.</p>
      </div>

      <div className="settings-grid" style={{ marginBottom: '48px' }}>
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

      {/* Kiosk Location & Alarm Section */}
      <div style={{ marginTop: '48px' }}>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MapPin size={24} /> Advanced Kiosk Settings
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Configure factory location for geofencing and set the default alarm time for un-punched attendance.</p>
      </div>

      <div className="settings-grid" style={{ marginBottom: '48px' }}>
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

    </div>
  );
}
