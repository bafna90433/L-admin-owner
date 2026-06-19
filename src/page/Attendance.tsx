import { useState, useEffect } from 'react';
import { Loader, Save, Clock } from 'lucide-react';
import '../styles/Attendance.css';

interface Labour {
  _id: string;
  name: string;
  whatsapp: string;
  monthlySalary: number;
  workingHours?: number;
  imageUrl: string;
  status: string;
}

interface AttendanceRecord {
  _id?: string;
  labourId: string;
  date: string;
  status: 'present' | 'half-day' | 'absent' | 'sunday' | 'permission';
  permissionHours?: number;
  remarks?: string;
  checkIn?: string;
  checkOut?: string;
  punches?: string[];
  activeHours?: number;
  awayHours?: number;
  isPermissionApproved?: boolean;
  overtimeHours?: number;
}

interface AttendanceProps {
  token: string | null;
  apiBase: string;
  labours: Labour[];
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

const getAvatarColor = (name: string) => {
  if (!name) return { bg: 'rgba(99,102,241,0.15)', text: '#4f46e5' };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsla(${hue}, 85%, 93%, 1)`,
    text: `hsl(${hue}, 85%, 32%)`
  };
};

const isFutureDate = (day: number, month: number, year: number) => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth() + 1; // 1-indexed
  const currentYear = today.getFullYear();

  if (year > currentYear) return true;
  if (year < currentYear) return false;
  
  if (month > currentMonth) return true;
  if (month < currentMonth) return false;

  return day > currentDay;
};

export default function Attendance({
  token,
  apiBase,
  labours,
  showToast
}: AttendanceProps) {
  const [attYear, setAttYear] = useState(new Date().getFullYear());
  const [attMonth, setAttMonth] = useState(new Date().getMonth() + 1); // 1-indexed
  const [attendanceGrid, setAttendanceGrid] = useState<Record<string, Record<number, AttendanceRecord>>>({});
  const [attLoading, setAttLoading] = useState(false);
  const [attSaving, setAttSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBiometric, setSelectedBiometric] = useState<{
    labourName: string;
    day: number;
    workingHours?: number;
    record: AttendanceRecord;
  } | null>(null);

  useEffect(() => {
    if (token) {
      fetchAttendanceGrid();
    }
  }, [attMonth, attYear, token]);

  const fetchAttendanceGrid = async () => {
    setAttLoading(true);
    try {
      const res = await fetch(`${apiBase}/attendance?month=${attMonth}&year=${attYear}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data: AttendanceRecord[] = await res.json();
        
        // Convert array to grid lookup: grid[labourId][day] = record
        const grid: Record<string, Record<number, AttendanceRecord>> = {};
        data.forEach(rec => {
          const date = new Date(rec.date);
          const day = date.getDate();
          if (!grid[rec.labourId]) {
            grid[rec.labourId] = {};
          }
          grid[rec.labourId][day] = rec;
        });
        setAttendanceGrid(grid);
      } else {
        showToast('Failed to fetch attendance grid', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setAttLoading(false);
    }
  };

  const handleAttendanceChange = (labourId: string, day: number, status: any) => {
    setAttendanceGrid(prev => {
      const grid = { ...prev };
      if (!grid[labourId]) grid[labourId] = {};
      grid[labourId][day] = {
        ...grid[labourId][day],
        status,
        permissionHours: grid[labourId][day]?.permissionHours || 2, // Default 2 hours
        remarks: grid[labourId][day]?.remarks || ''
      };
      return grid;
    });
  };

  const handlePermissionHoursChange = (labourId: string, day: number, hours: number) => {
    setAttendanceGrid(prev => {
      const grid = { ...prev };
      if (!grid[labourId]) grid[labourId] = {};
      grid[labourId][day] = {
        ...grid[labourId][day],
        permissionHours: hours
      };
      return grid;
    });
  };

  const handleSaveAttendance = async () => {
    setAttSaving(true);
    try {
      const records: any[] = [];
      const daysInMonth = new Date(attYear, attMonth, 0).getDate();

      Object.entries(attendanceGrid).forEach(([labourId, days]) => {
        Object.entries(days).forEach(([dayStr, data]) => {
          const day = parseInt(dayStr, 10);
          if (day <= daysInMonth) {
            const date = new Date(attYear, attMonth - 1, day);
            records.push({
              labourId,
              date: date.toISOString(),
              status: data.status,
              permissionHours: data.permissionHours || 0,
              remarks: data.remarks || ''
            });
          }
        });
      });

      const res = await fetch(`${apiBase}/attendance/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ records })
      });

      if (res.ok) {
        showToast('Attendance saved successfully!', 'success');
      } else {
        showToast('Failed to save attendance', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setAttSaving(false);
    }
  };

  const handleTogglePermission = async (recordId: string, approve: boolean) => {
    try {
      const res = await fetch(`${apiBase}/attendance/${recordId}/permission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isApproved: approve })
      });
      if (res.ok) {
        const json = await res.json();
        const updatedRecord = json.record;
        
        // Update grid state
        setAttendanceGrid(prev => {
          const grid = { ...prev };
          const date = new Date(updatedRecord.date);
          const day = date.getDate();
          const labourId = updatedRecord.labourId;
          
          if (!grid[labourId]) grid[labourId] = {};
          grid[labourId][day] = updatedRecord;
          return grid;
        });

        // Update active biometric details state to refresh modal UI
        setSelectedBiometric(prev => prev ? { ...prev, record: updatedRecord } : null);
        showToast(`Permission ${approve ? 'approved' : 'removed'} successfully!`, 'success');
      } else {
        showToast('Failed to update permission status', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    }
  };

  const daysInMonth = new Date(attYear, attMonth, 0).getDate();
  const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const filteredLabours = labours.filter(lab => 
    lab.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="attendance-page-container">
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '2.2rem' }} className="gradient-text">Attendance Ledger</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Add or modify daily duties: Present (Full day), Half day, Absent, or Sunday.</p>
        </div>
        
        <div className="attendance-header-actions">
          <input 
            type="text"
            className="form-input"
            placeholder="Search employee..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '200px', fontWeight: 500 }}
          />
          <select 
            className="form-input" 
            value={attMonth} 
            onChange={e => setAttMonth(parseInt(e.target.value))}
            style={{ width: '150px', fontWeight: 600 }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <select 
            className="form-input" 
            value={attYear} 
            onChange={e => setAttYear(parseInt(e.target.value))}
            style={{ width: '110px', fontWeight: 600 }}
          >
            {[2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button 
            onClick={handleSaveAttendance} 
            className="btn btn-primary"
            disabled={attSaving || labours.length === 0}
            style={{ padding: '12px 28px', gap: '8px' }}
          >
            {attSaving ? <Loader className="spinner" size={16} /> : <><Save size={18} /> Save Attendance</>}
          </button>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="glass-panel attendance-legend-card" style={{ padding: '16px 24px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status Legend:</span>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--color-success)' }}></span> Present (P)</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--color-warning)' }}></span> Half-day (H)</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--color-danger)' }}></span> Absent (A)</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--accent-primary)' }}></span> Sunday (SUN)</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: '#818cf8' }}></span> Permission (PRM)</span>
        </div>
      </div>

      {/* Attendance Grid */}
      <div className="glass-panel">
        {attLoading ? (
          <div className="loading-container"><div className="spinner"></div></div>
        ) : (
          <div className="table-container attendance-table-scroll">
            <table className="custom-table" style={{ width: 'auto', minWidth: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="sticky-name-col" style={{ zIndex: 10 }}>Labourer</th>
                  {dayColumns.map(day => {
                    const date = new Date(attYear, attMonth - 1, day);
                    const isSunday = date.getDay() === 0;
                    return (
                      <th key={day} style={{ width: '60px', textAlign: 'center', background: isSunday ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-tertiary)' }}>
                        <div>{day}</div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>
                          {date.toLocaleString('default', { weekday: 'short' }).slice(0, 2)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredLabours.map(lab => (
                  <tr key={lab._id}>
                    <td className="sticky-row-cell">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {lab.imageUrl ? (
                          <img 
                            src={lab.imageUrl} 
                            alt={lab.name} 
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--glass-border)', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%', 
                            background: getAvatarColor(lab.name).bg, 
                            color: getAvatarColor(lab.name).text, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '1.15rem', 
                            fontWeight: '800', 
                            flexShrink: 0 
                          }}>
                            {lab.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lab.name}</span>
                      </div>
                    </td>
                    {dayColumns.map(day => {
                      const date = new Date(attYear, attMonth - 1, day);
                      const isSunday = date.getDay() === 0;
                      const cell = attendanceGrid[lab._id]?.[day] || { status: isSunday ? 'sunday' : 'absent', permissionHours: 0, remarks: '' } as AttendanceRecord;

                      const isFuture = isFutureDate(day, attMonth, attYear);

                      return (
                        <td key={day} className="attendance-day-cell" style={{ background: isSunday ? 'rgba(99, 102, 241, 0.05)' : 'transparent' }}>
                          {isFuture ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ 
                                color: isSunday ? 'var(--accent-primary)' : 'var(--text-muted)', 
                                fontSize: '0.75rem', 
                                fontWeight: isSunday ? 750 : 400, 
                                opacity: 0.5 
                              }}>
                                {isSunday ? 'SUN' : '-'}
                              </span>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <select
                                  value={cell.status}
                                  disabled={isFutureDate(day, attMonth, attYear)}
                                  onChange={e => handleAttendanceChange(lab._id, day, e.target.value)}
                                  className="attendance-status-select"
                                  style={{
                                    background: 
                                      cell.status === 'present' ? 'rgba(16, 185, 129, 0.2)' :
                                      cell.status === 'half-day' ? 'rgba(245, 158, 11, 0.2)' :
                                      cell.status === 'sunday' ? 'rgba(99, 102, 241, 0.2)' :
                                      cell.status === 'permission' ? 'rgba(165, 180, 252, 0.3)' :
                                      'rgba(239, 68, 68, 0.1)',
                                    color:
                                      cell.status === 'present' ? 'var(--color-success)' :
                                      cell.status === 'half-day' ? 'var(--color-warning)' :
                                      cell.status === 'sunday' ? 'var(--accent-primary)' :
                                      cell.status === 'permission' ? '#4f46e5' :
                                      'var(--color-danger)',
                                    opacity: isFutureDate(day, attMonth, attYear) ? 0.5 : 1,
                                    cursor: isFutureDate(day, attMonth, attYear) ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  <option value="present">P</option>
                                  <option value="half-day">H</option>
                                  <option value="absent">A</option>
                                  <option value="sunday">SUN</option>
                                  <option value="permission">PRM</option>
                                </select>
                                  <button 
                                    className="punch-badge pulse"
                                    onClick={() => setSelectedBiometric({ labourName: lab.name, day, workingHours: lab.workingHours, record: cell })}
                                    title="Show/Edit Biometric Punch Times"
                                    style={{ 
                                      background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                                      color: cell.isPermissionApproved ? '#818cf8' : (cell.checkIn ? 'var(--text-primary)' : 'rgba(156, 163, 175, 0.4)'),
                                      display: 'flex', alignItems: 'center'
                                    }}
                                  >
                                    <Clock size={14} />
                                  </button>
                                </div>
                              {cell.status === 'permission' && !cell.checkIn && (
                                <input 
                                  type="number"
                                  min={1}
                                  max={8}
                                  title="Permission Hours"
                                  disabled={isFutureDate(day, attMonth, attYear)}
                                  value={cell.permissionHours || 2}
                                  onChange={e => handlePermissionHoursChange(lab._id, day, Math.min(8, Math.max(1, parseInt(e.target.value) || 2)))}
                                  className="permission-hours-input"
                                  style={{
                                    opacity: isFutureDate(day, attMonth, attYear) ? 0.5 : 1,
                                    cursor: isFutureDate(day, attMonth, attYear) ? 'not-allowed' : 'text'
                                  }}
                                />
                              )}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {filteredLabours.length === 0 && (
                  <tr>
                    <td colSpan={dayColumns.length + 1} style={{ textAlign: 'center', padding: '24px' }}>
                      {labours.length === 0 ? 'No labourers registered yet.' : 'No employees matched your search.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedBiometric && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
        }}>
          <div className="glass-panel glass-panel-glow" style={{ width: '100%', maxWidth: '440px', padding: '24px 32px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {(() => {
                  const selectedLabourObj = labours.find(l => l.name === selectedBiometric.labourName);
                  const selectedLabourImage = selectedLabourObj?.imageUrl;
                  const avatarColor = getAvatarColor(selectedBiometric.labourName);
                  return selectedLabourImage ? (
                    <img 
                      src={selectedLabourImage} 
                      alt={selectedBiometric.labourName} 
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--glass-border)' }}
                    />
                  ) : (
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      background: avatarColor.bg, 
                      color: avatarColor.text, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '1.4rem', 
                      fontWeight: '800' 
                    }}>
                      {selectedBiometric.labourName.charAt(0).toUpperCase()}
                    </div>
                  );
                })()}
                <div>
                  <h3 className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Biometric Swipes</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{selectedBiometric.labourName}</span>
                </div>
              </div>
              <button onClick={() => setSelectedBiometric(null)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Close</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 600 }}>Date:</span>
                <span style={{ color: 'var(--text-primary)' }}>{selectedBiometric.day} {new Date(attYear, attMonth - 1).toLocaleString('default', { month: 'long' })}, {attYear}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 600 }}>First In:</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>
                  {selectedBiometric.record.checkIn ? new Date(selectedBiometric.record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 600 }}>Last Out:</span>
                <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>
                  {selectedBiometric.record.checkOut ? new Date(selectedBiometric.record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 600 }}>Active Hours:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{selectedBiometric.record.activeHours?.toFixed(1) || '0.0'} hrs</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 600 }}>Away Hours:</span>
                <span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>{selectedBiometric.record.awayHours?.toFixed(1) || '0.0'} hrs</span>
              </div>

              {selectedBiometric.record.overtimeHours !== undefined && selectedBiometric.record.overtimeHours > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 600 }}>Overtime:</span>
                  <span style={{ color: '#c084fc', fontWeight: 700 }}>{selectedBiometric.record.overtimeHours.toFixed(1)} hrs</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 600 }}>Current Status:</span>
                <span style={{ 
                  color: selectedBiometric.record.status === 'present' ? 'var(--color-success)' : 'var(--color-warning)',
                  fontWeight: 700, textTransform: 'capitalize' 
                }}>
                  {selectedBiometric.record.status}
                </span>
              </div>

              {/* All punches list */}
              <div style={{ marginTop: '12px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>All Punch Logs:</span>
                <div style={{ 
                  background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', 
                  borderRadius: '8px', padding: '8px 12px', marginTop: '6px', maxHeight: '100px', overflowY: 'auto',
                  display: 'flex', flexDirection: 'column', gap: '4px' 
                }}>
                  {selectedBiometric.record.punches?.map((p, idx) => (
                    <div key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Punch #{idx + 1}</span>
                      <span>{new Date(p).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                  ))}
                  {(!selectedBiometric.record.punches || selectedBiometric.record.punches.length === 0) && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No logs recorded.</span>
                  )}
                </div>
              </div>

              {/* Permission Action Panel */}
              {selectedBiometric.record.awayHours !== undefined && selectedBiometric.record.awayHours > 0 && selectedBiometric.record._id && (
                <div style={{ 
                  marginTop: '16px', background: 'rgba(129, 140, 248, 0.1)', border: '1px dashed rgba(129, 140, 248, 0.3)',
                  borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px'
                }}>
                  <p style={{ fontSize: '0.8rem', color: '#a5b4fc', lineHeight: 1.4 }}>
                    Employee was away for <b>{selectedBiometric.record.awayHours.toFixed(1)} hours</b>. Approve this outing as permission to deduct it from their required {selectedBiometric.workingHours || 8}h shift?
                  </p>
                  
                  {selectedBiometric.record.isPermissionApproved ? (
                    <button 
                      type="button"
                      onClick={() => handleTogglePermission(selectedBiometric.record._id!, false)}
                      className="btn btn-secondary" 
                      style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', border: 'none', padding: '8px 12px', width: '100%', fontSize: '0.85rem', fontWeight: 'bold' }}
                    >
                      Remove Approved Permission
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => handleTogglePermission(selectedBiometric.record._id!, true)}
                      className="btn btn-primary" 
                      style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '8px 12px', width: '100%', fontSize: '0.85rem', fontWeight: 'bold' }}
                    >
                      Approve Permission
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
