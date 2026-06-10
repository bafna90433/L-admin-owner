import React, { useState } from 'react';
import { Loader, Camera } from 'lucide-react';
import '../styles/Profile.css';

const IMAGEKIT_PUBLIC_KEY = 'public_LB0AyCgim15VO491kDtVm0Fo798=';

interface User {
  id: string;
  _id?: string;
  username: string;
  name: string;
  role: string;
  whatsapp?: string;
  imageUrl?: string;
}

interface ProfileProps {
  token: string | null;
  user: User | null;
  apiBase: string;
  onProfileUpdate: (updatedUser: User) => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export default function Profile({
  token,
  user,
  apiBase,
  onProfileUpdate,
  showToast
}: ProfileProps) {
  const [name, setName] = useState(user?.name || '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '');
  const [imageUrl, setImageUrl] = useState(user?.imageUrl || '');
  const [imagePreview, setImagePreview] = useState(user?.imageUrl || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [updating, setUpdating] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
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
      throw new Error('Image upload failed');
    }
    const upData = await upRes.json();
    return upData.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name is required', 'danger');
      return;
    }

    setUpdating(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageFile) {
        try {
          finalImageUrl = await handleImageUpload(imageFile);
          setImageUrl(finalImageUrl);
        } catch (err) {
          showToast('Image upload failed. Profile details will be saved without image update.', 'warning');
        }
      }

      const res = await fetch(`${apiBase}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          whatsapp,
          imageUrl: finalImageUrl
        })
      });

      if (res.ok) {
        const data = await res.json();
        onProfileUpdate(data.user);
        showToast('Profile updated successfully!', 'success');
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to update profile', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to server', 'danger');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="profile-page-container">
      <div>
        <h1 style={{ fontSize: '2.2rem' }}>My Profile Settings</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Update your personal profile, contact information and display photo.</p>
      </div>

      <div className="glass-panel profile-card">
        <div className="profile-avatar-container">
          {imagePreview ? (
            <img src={imagePreview} alt="Profile Avatar" className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar-placeholder">
              {name.slice(0, 2).toUpperCase() || 'OA'}
            </div>
          )}
          <label className="profile-file-label" title="Change Avatar">
            <Camera size={18} />
            <input 
              type="file" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleImageChange}
            />
          </label>
        </div>

        <form onSubmit={handleSubmit} className="profile-details-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input 
              type="text" 
              className="form-input" 
              value={`@${user?.username}`} 
              disabled 
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Role</label>
            <input 
              type="text" 
              className="form-input" 
              value={user?.role} 
              disabled 
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'not-allowed', textTransform: 'capitalize' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Enter your name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">WhatsApp Number</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. 919876543210"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }} disabled={updating}>
            {updating ? <Loader className="spinner" size={16} /> : 'Save Profile Details'}
          </button>
        </form>
      </div>
    </div>
  );
}
