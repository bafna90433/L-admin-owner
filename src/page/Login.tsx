import React, { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import '../styles/Login.css';

interface LoginProps {
  apiBase: string;
  onLoginSuccess: (token: string, user: any) => void;
}

export default function Login({ apiBase, onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sso = params.get('sso');
    if (sso) {
      try {
        const decoded = atob(sso);
        const [u, p] = decoded.split(':');
        if (u && p) {
          setUsername(u);
          setPassword(p);
          
          const performAutoLogin = async () => {
            setLoginLoading(true);
            setLoginError('');
            try {
              const res = await fetch(`${apiBase}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
              });
              const data = await res.json();
              if (res.ok) {
                if (data.user.role !== 'owner') {
                  setLoginError('Access denied: Owners only.');
                } else {
                  // Clean up the SSO token from the URL bar immediately
                  window.history.replaceState({}, document.title, window.location.pathname);
                  onLoginSuccess(data.token, data.user);
                }
              } else {
                setLoginError(data.message || 'Auto-login failed.');
              }
            } catch (err) {
              setLoginError('Server connection failed.');
            } finally {
              setLoginLoading(false);
            }
          };
          performAutoLogin();
        }
      } catch (e) {
        console.error('SSO decoding failed', e);
      }
    }
  }, [apiBase, onLoginSuccess]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.user.role !== 'owner') {
          setLoginError('Access denied: Owners only.');
        } else {
          onLoginSuccess(data.token, data.user);
        }
      } else {
        setLoginError(data.message || 'Login failed.');
      }
    } catch (err) {
      setLoginError('Server connection failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="login-container animate-fade-in">
      <div className="glass-panel glass-panel-glow login-card">
        <h2 className="gradient-text login-title">LABOUR PRO</h2>
        <p className="login-subtitle">Owner Login Portal</p>
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Enter owner username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          
          {loginError && (
            <p className="login-error">
              {loginError}
            </p>
          )}
          
          <button type="submit" className="btn btn-primary login-btn" disabled={loginLoading}>
            {loginLoading ? <Loader className="spinner" style={{ width: '18px', height: '18px' }} /> : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
