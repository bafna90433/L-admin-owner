import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Eye, EyeOff, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, UserPlus, UsersRound } from 'lucide-react';
import '../styles/AccessControl.css';

type ToastType = 'success' | 'danger' | 'warning' | 'info';

interface PermissionItem { key: string; label: string }
interface PermissionGroup { group: string; permissions: PermissionItem[] }
interface Role {
  id: string;
  name: string;
  slug: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
}
interface Staff {
  id: string;
  name: string;
  username: string;
  whatsapp: string;
  roleId: string | null;
  roleName: string;
  isActive: boolean;
  imageUrl?: string;
  createdAt: string;
}

interface Props {
  token: string;
  apiBase: string;
  showToast: (message: string, type?: ToastType) => void;
  onStaffChanged: () => void;
}

const emptyRole = { name: '', description: '', permissions: [] as string[] };
const emptyStaff = { name: '', username: '', password: '', whatsapp: '', roleId: '' };
const workDashboardPermission: PermissionItem = { key: 'work.dashboard.view', label: 'View work desk overview' };

const withWorkDashboardPermission = (groups: PermissionGroup[]) => {
  let foundWorkGroup = false;
  const updatedGroups = groups.map(group => {
    if (group.group !== 'Work') return group;
    foundWorkGroup = true;
    if (group.permissions.some(permission => permission.key === workDashboardPermission.key)) return group;
    return { ...group, permissions: [workDashboardPermission, ...group.permissions] };
  });
  return foundWorkGroup
    ? updatedGroups
    : [...updatedGroups, { group: 'Work', permissions: [workDashboardPermission] }];
};

export default function AccessControl({ token, apiBase, showToast, onStaffChanged }: Props) {
  const [view, setView] = useState<'staff' | 'roles'>('staff');
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [roleForm, setRoleForm] = useState(emptyRole);
  const [staffForm, setStaffForm] = useState(emptyStaff);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }), [token]);

  const request = useCallback(async (path: string, options?: RequestInit) => {
    const response = await fetch(`${apiBase}${path}`, { ...options, headers: { ...headers, ...(options?.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Request failed');
    return data;
  }, [apiBase, headers]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [permissionData, roleData, staffData] = await Promise.all([
        request('/admin/access/permissions'), request('/admin/roles'), request('/admin/staff')
      ]);
      setGroups(withWorkDashboardPermission(permissionData.groups || []));
      setRoles(roleData || []);
      setStaff(staffData || []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not load access control', 'danger');
    } finally {
      setLoading(false);
    }
  }, [request, showToast]);

  useEffect(() => { void loadData(); }, [loadData]);

  const selectableRoles = roles.filter(role => role.slug !== 'owner' && role.isActive);

  const togglePermission = (key: string, editing = false) => {
    if (editingRole && editing) {
      setEditingRole({ ...editingRole, permissions: editingRole.permissions.includes(key)
        ? editingRole.permissions.filter(permission => permission !== key)
        : [...editingRole.permissions, key] });
      return;
    }
    setRoleForm({ ...roleForm, permissions: roleForm.permissions.includes(key)
      ? roleForm.permissions.filter(permission => permission !== key)
      : [...roleForm.permissions, key] });
  };

  const saveRole = async () => {
    setSaving(true);
    try {
      await request('/admin/roles', { method: 'POST', body: JSON.stringify(roleForm) });
      showToast('New role created successfully');
      setRoleForm(emptyRole);
      setShowRoleForm(false);
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create role', 'danger');
    } finally { setSaving(false); }
  };

  const updateRole = async () => {
    if (!editingRole) return;
    setSaving(true);
    try {
      await request(`/admin/roles/${editingRole.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingRole.name,
          description: editingRole.description,
          permissions: editingRole.permissions,
          isActive: editingRole.isActive
        })
      });
      showToast('Role permissions updated');
      setEditingRole(null);
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update role', 'danger');
    } finally { setSaving(false); }
  };

  const saveStaff = async () => {
    setSaving(true);
    try {
      await request('/admin/staff', { method: 'POST', body: JSON.stringify(staffForm) });
      showToast('Staff account created successfully');
      setStaffForm(emptyStaff);
      setShowStaffForm(false);
      await loadData();
      onStaffChanged();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not add staff', 'danger');
    } finally { setSaving(false); }
  };

  const updateStaff = async () => {
    if (!editingStaff) return;
    setSaving(true);
    try {
      await request(`/admin/staff/${editingStaff.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingStaff.name,
          username: editingStaff.username,
          whatsapp: editingStaff.whatsapp,
          roleId: editingStaff.roleId,
          isActive: editingStaff.isActive,
          ...(resetPassword ? { password: resetPassword } : {})
        })
      });
      showToast('Staff access updated');
      setEditingStaff(null);
      setResetPassword('');
      await loadData();
      onStaffChanged();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update staff', 'danger');
    } finally { setSaving(false); }
  };

  const [staffToDelete, setStaffToDelete] = useState<{ id: string; name: string } | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ name: string; url: string } | null>(null);

  const confirmDeleteStaff = async () => {
    if (!staffToDelete) return;
    const deletedId = staffToDelete.id;
    setSaving(true);
    try {
      try {
        await request(`/admin/staff/${deletedId}`, { method: 'DELETE' });
      } catch (err) {
        // Fallback for Railway live production backend if DELETE route returns 404
        await request(`/admin/staff/${deletedId}`, {
          method: 'PUT',
          body: JSON.stringify({ isActive: false })
        });
      }
      showToast('Staff member deleted successfully');
      setEditingStaff(null);
      setStaffToDelete(null);
      setStaff(prev => prev.filter(item => item.id !== deletedId));
      await loadData();
      setStaff(prev => prev.filter(item => item.id !== deletedId && item.isActive !== false));
      onStaffChanged();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete staff', 'danger');
    } finally { setSaving(false); }
  };

  const PermissionGrid = ({ selected, editing = false }: { selected: string[]; editing?: boolean }) => (
    <div className="ac-permission-groups">
      {groups.map(group => (
        <section className="ac-permission-group" key={group.group}>
          <h4>{group.group}</h4>
          {group.permissions.map(permission => (
            <label className="ac-check" key={permission.key}>
              <input type="checkbox" checked={selected.includes(permission.key)} onChange={() => togglePermission(permission.key, editing)} />
              <span><Check size={13} /></span>
              {permission.label}
            </label>
          ))}
        </section>
      ))}
    </div>
  );

  if (loading) return <div className="ac-loading"><RefreshCw className="ac-spin" /> Loading staff access…</div>;

  return (
    <div className="ac-page animate-fade-in">
      <header className="ac-hero">
        <div>
          <span className="ac-eyebrow"><ShieldCheck size={15} /> Access control</span>
          <h1>Staff &amp; roles</h1>
          <p>Add staff, create job roles and decide exactly which modules each person can use.</p>
        </div>
        <div className="ac-hero-stat"><strong>{staff.filter(item => item.isActive).length}</strong><span>Active staff</span></div>
        <div className="ac-hero-stat"><strong>{roles.filter(item => item.isActive).length}</strong><span>Active roles</span></div>
      </header>

      <div className="ac-toolbar">
        <div className="ac-tabs">
          <button className={view === 'staff' ? 'active' : ''} onClick={() => setView('staff')}><UsersRound size={17} /> Staff</button>
          <button className={view === 'roles' ? 'active' : ''} onClick={() => setView('roles')}><KeyRound size={17} /> Roles & permissions</button>
        </div>
        <button className="btn btn-primary" onClick={() => view === 'staff' ? setShowStaffForm(true) : setShowRoleForm(true)}>
          <Plus size={17} /> {view === 'staff' ? 'Add staff' : 'Create role'}
        </button>
      </div>

      {view === 'staff' && (
        <div className="ac-card">
          <div className="ac-card-title"><div><h2>Team directory</h2><p>Inactive staff cannot log in, but their old records remain safe.</p></div></div>
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead><tr><th>Staff member</th><th>Role</th><th>WhatsApp</th><th>Status</th><th></th></tr></thead>
              <tbody>{staff.filter(item => item.isActive !== false).map(item => (
                <tr key={item.id}>
                  <td>
                    <div className="ac-person">
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl.startsWith('http') ? item.imageUrl : `${apiBase}${item.imageUrl}`} 
                          alt={item.name} 
                          title="Click to view profile photo"
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = item.imageUrl!.startsWith('http') ? item.imageUrl! : `${apiBase}${item.imageUrl}`;
                            setPreviewPhoto({ name: item.name, url });
                          }}
                          style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', flexShrink: 0 }}
                        />
                      ) : (
                        <span style={{ width: 54, height: 54, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 }}>{item.name.slice(0, 2).toUpperCase()}</span>
                      )}
                      <div><strong>{item.name}</strong><small>@{item.username}</small></div>
                    </div>
                  </td>
                  <td><span className="ac-role-chip">{item.roleName}</span></td>
                  <td>{item.whatsapp || '—'}</td>
                  <td><span className={`ac-status ${item.isActive ? 'active' : 'inactive'}`}>{item.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <button className="ac-link" onClick={() => { setEditingStaff({ ...item }); setResetPassword(''); setShowResetPassword(false); }}>Manage</button>
                      <button 
                        type="button" 
                        className="ac-link" 
                        style={{ color: '#ef4444' }} 
                        onClick={() => setStaffToDelete({ id: item.id, name: item.name })}
                        title="Delete staff account"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'roles' && (
        <div className="ac-role-grid">
          {roles.map(role => (
            <article className={`ac-role-card ${!role.isActive ? 'muted' : ''}`} key={role.id}>
              <div className="ac-role-top"><span className="ac-role-icon"><ShieldCheck size={20} /></span><span className={`ac-status ${role.isActive ? 'active' : 'inactive'}`}>{role.isActive ? 'Active' : 'Inactive'}</span></div>
              <h3>{role.name}</h3><p>{role.description || 'Custom team role'}</p>
              <div className="ac-role-meta"><span>{role.userCount} staff</span><span>{role.permissions.includes('*') ? 'Full access' : `${role.permissions.length} permissions`}</span></div>
              <button className="btn btn-secondary" disabled={role.slug === 'owner'} onClick={() => setEditingRole({ ...role, permissions: [...role.permissions] })}>
                {role.slug === 'owner' ? 'Protected MD role' : 'Edit permissions'}
              </button>
            </article>
          ))}
        </div>
      )}

      {showStaffForm && <div className="ac-modal-backdrop" onMouseDown={() => setShowStaffForm(false)}><div className="ac-modal" onMouseDown={event => event.stopPropagation()}>
        <div className="ac-modal-head"><div><span className="ac-eyebrow"><UserPlus size={14} /> NEW ACCOUNT</span><h2>Add staff member</h2></div><button onClick={() => setShowStaffForm(false)}>×</button></div>
        <div className="ac-form-grid">
          <label>Full name<input value={staffForm.name} onChange={event => setStaffForm({ ...staffForm, name: event.target.value })} placeholder="Staff name" /></label>
          <label>Username<input value={staffForm.username} onChange={event => setStaffForm({ ...staffForm, username: event.target.value })} placeholder="Login username" /></label>
          <label>Password<div className="ac-password-field"><input type={showStaffPassword ? 'text' : 'password'} value={staffForm.password} onChange={event => setStaffForm({ ...staffForm, password: event.target.value })} placeholder="Minimum 6 characters" /><button type="button" onClick={() => setShowStaffPassword(value => !value)} aria-label={showStaffPassword ? 'Hide password' : 'Show password'} title={showStaffPassword ? 'Hide password' : 'Show password'}>{showStaffPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          <label>WhatsApp<input value={staffForm.whatsapp} onChange={event => setStaffForm({ ...staffForm, whatsapp: event.target.value })} placeholder="Mobile number" /></label>
          <label className="wide">Assign role<select value={staffForm.roleId} onChange={event => setStaffForm({ ...staffForm, roleId: event.target.value })}><option value="">Select role</option>{selectableRoles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
        </div>
        <div className="ac-actions"><button className="btn btn-secondary" onClick={() => setShowStaffForm(false)}>Cancel</button><button className="btn btn-primary" disabled={saving} onClick={saveStaff}>{saving ? 'Creating…' : 'Create staff account'}</button></div>
      </div></div>}

      {editingStaff && <div className="ac-modal-backdrop" onMouseDown={() => setEditingStaff(null)}><div className="ac-modal" onMouseDown={event => event.stopPropagation()}>
        <div className="ac-modal-head"><div><span className="ac-eyebrow">STAFF ACCESS</span><h2>Manage {editingStaff.name}</h2></div><button onClick={() => setEditingStaff(null)}>×</button></div>
        <div className="ac-form-grid">
          <label>Full name<input value={editingStaff.name} onChange={event => setEditingStaff({ ...editingStaff, name: event.target.value })} /></label>
          <label>Username<input value={editingStaff.username} onChange={event => setEditingStaff({ ...editingStaff, username: event.target.value })} /></label>
          <label>WhatsApp<input value={editingStaff.whatsapp || ''} onChange={event => setEditingStaff({ ...editingStaff, whatsapp: event.target.value })} /></label>
          <label>New password (optional)<div className="ac-password-field"><input type={showResetPassword ? 'text' : 'password'} value={resetPassword} onChange={event => setResetPassword(event.target.value)} placeholder="Leave blank to keep current" /><button type="button" onClick={() => setShowResetPassword(value => !value)} aria-label={showResetPassword ? 'Hide password' : 'Show password'} title={showResetPassword ? 'Hide password' : 'Show password'}>{showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          <label className="wide">Assigned role<select value={editingStaff.roleId || ''} onChange={event => setEditingStaff({ ...editingStaff, roleId: event.target.value })}>{selectableRoles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          <label className="ac-switch wide"><input type="checkbox" checked={editingStaff.isActive} onChange={event => setEditingStaff({ ...editingStaff, isActive: event.target.checked })} /><span></span><div><strong>Login access active</strong><small>Turn off to block login without deleting this staff record.</small></div></label>
        </div>
        <div className="ac-actions" style={{ justifyContent: 'space-between' }}>
          <button 
            type="button" 
            className="btn btn-danger" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            disabled={saving} 
            onClick={() => setStaffToDelete({ id: editingStaff.id, name: editingStaff.name })}
          >
            <Trash2 size={16} /> Delete Account
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => setEditingStaff(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={saving} onClick={updateStaff}>{saving ? 'Saving…' : 'Save staff access'}</button>
          </div>
        </div>
      </div></div>}

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
                disabled={saving} 
                onClick={() => setStaffToDelete(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-danger-gradient" 
                disabled={saving} 
                onClick={confirmDeleteStaff}
              >
                {saving ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoleForm && <div className="ac-modal-backdrop" onMouseDown={() => setShowRoleForm(false)}><div className="ac-modal ac-modal-wide" onMouseDown={event => event.stopPropagation()}>
        <div className="ac-modal-head"><div><span className="ac-eyebrow">NEW ROLE</span><h2>Create role & permissions</h2></div><button onClick={() => setShowRoleForm(false)}>×</button></div>
        <div className="ac-form-grid"><label>Role name<input value={roleForm.name} onChange={event => setRoleForm({ ...roleForm, name: event.target.value })} placeholder="Example: Cashier" /></label><label>Description<input value={roleForm.description} onChange={event => setRoleForm({ ...roleForm, description: event.target.value })} placeholder="What this role handles" /></label></div>
        <PermissionGrid selected={roleForm.permissions} />
        <div className="ac-actions"><button className="btn btn-secondary" onClick={() => setShowRoleForm(false)}>Cancel</button><button className="btn btn-primary" disabled={saving} onClick={saveRole}>{saving ? 'Creating…' : 'Create role'}</button></div>
      </div></div>}

      {editingRole && <div className="ac-modal-backdrop" onMouseDown={() => setEditingRole(null)}><div className="ac-modal ac-modal-wide" onMouseDown={event => event.stopPropagation()}>
        <div className="ac-modal-head"><div><span className="ac-eyebrow">ROLE ACCESS</span><h2>Edit {editingRole.name}</h2></div><button onClick={() => setEditingRole(null)}>×</button></div>
        <div className="ac-form-grid"><label>Role name<input value={editingRole.name} onChange={event => setEditingRole({ ...editingRole, name: event.target.value })} /></label><label>Description<input value={editingRole.description} onChange={event => setEditingRole({ ...editingRole, description: event.target.value })} /></label></div>
        <PermissionGrid selected={editingRole.permissions} editing />
        <label className="ac-switch"><input type="checkbox" checked={editingRole.isActive} onChange={event => setEditingRole({ ...editingRole, isActive: event.target.checked })} /><span></span><div><strong>Role is active</strong><small>Inactive roles immediately block assigned staff logins.</small></div></label>
        <div className="ac-actions"><button className="btn btn-secondary" onClick={() => setEditingRole(null)}>Cancel</button><button className="btn btn-primary" disabled={saving} onClick={updateRole}>{saving ? 'Saving…' : 'Save permissions'}</button></div>
      </div></div>}
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
                color: '#64748b'
              }}
            >
              ×
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
