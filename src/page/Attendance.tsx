import { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import '../styles/Attendance.css';

interface Labour {
  _id: string;
  name: string;
  whatsapp: string;
  monthlySalary: number;
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
}

interface AttendanceProps {
  token: string | null;
  apiBase: string;
  labours: Labour[];
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export default function Attendance({
  token,
  apiBase,
  labours,
  showToast
}: AttendanceProps) {
  const [attYear, setAttYear] = useState(new Date().getFullYear());
  const [attMonth, setAttMonth] = useState(new Date().getMonth() + 1); // 1-indexed
  const [attendanceGrid, setAttendanceGrid] = useState<Record<string, Record<number, { status: string; permissionHours?: number; remarks: string }>>>({});
  const [attLoading, setAttLoading] = useState(false);
  const [attSaving, setAttSaving] = useState(false);

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
        
        // Convert array to grid lookup: grid[labourId][day] = { status, permissionHours, remarks }
        const grid: Record<string, Record<number, { status: string; permissionHours?: number; remarks: string }>> = {};
        data.forEach(rec => {
          const date = new Date(rec.date);
          const day = date.getDate();
          if (!grid[rec.labourId]) {
            grid[rec.labourId] = {};
          }
          grid[rec.labourId][day] = { 
            status: rec.status, 
            permissionHours: rec.permissionHours || 0,
            remarks: rec.remarks || '' 
          };
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

  const handleAttendanceChange = (labourId: string, day: number, status: string) => {
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

  const daysInMonth = new Date(attYear, attMonth, 0).getDate();
  const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="attendance-page-container">
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '2.2rem' }}>Attendance Ledger</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Add or modify daily duties: Present (Full day), Half day, Absent, or Sunday.</p>
        </div>
        
        <div className="attendance-header-actions">
          <select 
            className="form-input" 
            value={attMonth} 
            onChange={e => setAttMonth(parseInt(e.target.value))}
            style={{ width: '120px' }}
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
            style={{ width: '100px' }}
          >
            {[2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button 
            onClick={handleSaveAttendance} 
            className="btn btn-primary"
            disabled={attSaving || labours.length === 0}
          >
            {attSaving ? <Loader className="spinner" size={16} /> : 'Save Attendance'}
          </button>
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
                {labours.map(lab => (
                  <tr key={lab._id}>
                    <td className="sticky-row-cell">
                      {lab.name}
                    </td>
                    {dayColumns.map(day => {
                      const date = new Date(attYear, attMonth - 1, day);
                      const isSunday = date.getDay() === 0;
                      const cell = attendanceGrid[lab._id]?.[day] || { status: isSunday ? 'sunday' : 'absent', permissionHours: 0, remarks: '' };

                      return (
                        <td key={day} className="attendance-day-cell">
                          <select
                            value={cell.status}
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
                                'var(--color-danger)'
                            }}
                          >
                            <option value="present">P</option>
                            <option value="half-day">H</option>
                            <option value="absent">A</option>
                            <option value="sunday">SUN</option>
                            <option value="permission">PRM</option>
                          </select>
                          {cell.status === 'permission' && (
                            <input 
                              type="number"
                              min={1}
                              max={8}
                              title="Permission Hours"
                              value={cell.permissionHours || 2}
                              onChange={e => handlePermissionHoursChange(lab._id, day, Math.min(8, Math.max(1, parseInt(e.target.value) || 2)))}
                              className="permission-hours-input"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {labours.length === 0 && (
                  <tr>
                    <td colSpan={dayColumns.length + 1} style={{ textAlign: 'center', padding: '24px' }}>
                      No labourers registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
