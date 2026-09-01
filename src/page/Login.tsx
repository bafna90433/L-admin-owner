import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BarChart3,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  Loader,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRound
} from 'lucide-react';
import heroArtwork from '../assets/hero.png';
import '../styles/Login.css';

interface OwnerUser {
  role: string;
  [key: string]: unknown;
}

interface LoginProps {
  apiBase: string;
  onLoginSuccess: (token: string, user: OwnerUser) => void;
}

const getSsoCredentials = () => {
  const sso = new URLSearchParams(window.location.search).get('sso');
  if (!sso) return null;

  try {
    const [username, password] = atob(sso).split(':');
    return username && password ? { username, password } : null;
  } catch {
    return null;
  }
};

export default function Login({ apiBase, onLoginSuccess }: LoginProps) {
  const [ssoCredentials] = useState(getSsoCredentials);
  const [username, setUsername] = useState(ssoCredentials?.username ?? '');
  const [password, setPassword] = useState(ssoCredentials?.password ?? '');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    if (!ssoCredentials) return;

    const performAutoLogin = async () => {
      setLoginLoading(true);
      setLoginError('');
      try {
        const res = await fetch(`${apiBase}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ssoCredentials)
        });
        const data = await res.json();
        if (res.ok) {
          if (data.user.role !== 'owner') {
            setLoginError('Access denied: Owners only.');
          } else {
            window.history.replaceState({}, document.title, window.location.pathname);
            onLoginSuccess(data.token, data.user);
          }
        } else {
          setLoginError(data.message || 'Auto-login failed.');
        }
      } catch {
        setLoginError('Server connection failed.');
      } finally {
        setLoginLoading(false);
      }
    };

    performAutoLogin();
  }, [apiBase, onLoginSuccess, ssoCredentials]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
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
    } catch {
      setLoginError('Server connection failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <main className="owner-login-shell">
      <section className="owner-login-form-panel">
        <div className="owner-login-brand">
          <span className="owner-brand-mark" aria-hidden="true"><Crown size={20} /></span>
          <span className="owner-brand-copy">
            <strong>OFFICE PRO</strong>
            <small>OWNER CONSOLE</small>
          </span>
        </div>

        <div className="owner-login-card">
          <div className="owner-access-label">
            <KeyRound size={15} aria-hidden="true" />
            PRIVATE ACCESS
          </div>
          <h1>Welcome, Owner.</h1>
          <p className="owner-login-subtitle">Sign in to open your business command centre.</p>

          <form onSubmit={handleLogin}>
            <div className="owner-login-field">
              <label htmlFor="owner-username">Owner username</label>
              <div className="owner-input-wrap">
                <UserRound size={19} aria-hidden="true" />
                <input
                  id="owner-username"
                  type="text"
                  placeholder="Enter owner username"
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="owner-login-field">
              <label htmlFor="owner-password">Password</label>
              <div className="owner-input-wrap">
                <LockKeyhole size={19} aria-hidden="true" />
                <input
                  id="owner-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="owner-password-toggle"
                  onClick={() => setShowPassword(current => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            {loginError && <p className="owner-login-error" role="alert">{loginError}</p>}

            <button className="owner-login-button" type="submit" disabled={loginLoading}>
              {loginLoading ? (
                <><Loader className="owner-login-spinner" size={19} /> Verifying access...</>
              ) : (
                <>Open owner console <ArrowRight size={19} /></>
              )}
            </button>
          </form>

          <div className="owner-login-security">
            <ShieldCheck size={15} aria-hidden="true" />
            Encrypted and restricted to authorised owners
          </div>
        </div>

        <p className="owner-login-footer">© 2026 Office Pro · Executive workspace</p>
      </section>

      <section className="owner-login-visual" aria-label="Office Pro owner command centre preview">
        <div className="owner-visual-grid" aria-hidden="true" />
        <div className="owner-visual-glow owner-visual-glow-one" aria-hidden="true" />
        <div className="owner-visual-glow owner-visual-glow-two" aria-hidden="true" />

        <div className="owner-visual-topline">
          <span><span className="owner-online-dot" /> OWNER SYSTEM ONLINE</span>
          <strong>01 / EXECUTIVE</strong>
        </div>

        <div className="owner-visual-copy">
          <span className="owner-visual-kicker"><Sparkles size={14} /> COMPLETE CONTROL</span>
          <h2>Your business.<br /><em>One clear view.</em></h2>
          <p>People, cash flow, attendance and operations—ready when you are.</p>
        </div>

        <div className="owner-command-art" aria-hidden="true">
          <span className="owner-orbit owner-orbit-one" />
          <span className="owner-orbit owner-orbit-two" />
          <div className="owner-art-halo" />
          <img src={heroArtwork} alt="" />

          <div className="owner-metric-card owner-metric-card-one">
            <span className="owner-metric-icon"><BarChart3 size={16} /></span>
            <span><small>Operations</small><strong>Live overview</strong></span>
            <i>↗</i>
          </div>
          <div className="owner-metric-card owner-metric-card-two">
            <span className="owner-shield"><ShieldCheck size={16} /></span>
            <span><small>Owner access</small><strong>Fully protected</strong></span>
          </div>
        </div>

        <div className="owner-visual-status">
          <span>Preparing executive workspace</span>
          <div className="owner-status-track"><i /></div>
          <strong>SECURE · SYNCED · READY</strong>
        </div>
      </section>
    </main>
  );
}
