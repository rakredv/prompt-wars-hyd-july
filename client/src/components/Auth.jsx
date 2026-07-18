import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { setUserProfile } from '../services/firestore';

export default function Auth({ showToast }) {
  const [tab, setTab] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    if (tab === 'register' && !name.trim()) {
      setError('Name is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await setUserProfile(cred.user.uid, {
          name: name.trim(),
          email,
          demo_mode: 1,
        });
        showToast(`Welcome, ${name}! 🎉`, 'success');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('Welcome back! 👋', 'success');
      }
    } catch (err) {
      const msg = firebaseErrorMessage(err.code);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen" role="main">
      <div className="auth-bg-glow" aria-hidden="true" />

      <div className="auth-card" role="region" aria-label="Authentication">
        <div className="auth-logo">
          <div className="auth-logo-icon" aria-hidden="true">🧠</div>
          <h1 className="auth-title">MindYou</h1>
          <p className="auth-subtitle">Your AI-powered habit reduction companion</p>
        </div>

        <div className="auth-tabs" role="tablist">
          <button id="tab-login" role="tab" aria-selected={tab === 'login'} className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}>Sign In</button>
          <button id="tab-register" role="tab" aria-selected={tab === 'register'} className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setError(''); }}>Create Account</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {tab === 'register' && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-name">Your name</label>
                <input id="auth-name" className="form-input" type="text" placeholder="e.g. Alex"
                  value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="auth-email">Email</label>
              <input id="auth-email" className="form-input" type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="auth-password">Password</label>
              <input id="auth-password" className="form-input" type="password"
                placeholder={tab === 'register' ? 'Min. 6 characters' : '••••••••'}
                value={password} onChange={e => setPassword(e.target.value)}
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'} />
            </div>

            {error && (
              <div role="alert" style={{
                background: 'rgba(255, 69, 58, 0.1)', border: '1px solid rgba(255, 69, 58, 0.2)',
                borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                fontSize: '0.875rem', color: 'var(--red)',
              }}>
                {error}
              </div>
            )}

            <button id="btn-auth-submit" type="submit" className="btn btn-primary w-full"
              disabled={loading} style={{ justifyContent: 'center', padding: '14px', marginTop: 4 }}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : null}
              {loading ? 'Please wait...' : tab === 'register' ? 'Create Account' : 'Sign In'}
            </button>
          </div>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          {tab === 'register' ? 'Your data is private and secured by Firebase.' : 'New to MindYou? Create an account above.'}
        </p>
      </div>
    </div>
  );
}

function firebaseErrorMessage(code) {
  const map = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/operation-not-allowed': '⚠️ Email/Password sign-in is not enabled yet. Go to Firebase Console → Build → Authentication → Sign-in method → Enable Email/Password.',
    'auth/configuration-not-found': '⚠️ Firebase Auth not configured. Enable Email/Password in Firebase Console → Build → Authentication.',
  };
  return map[code] || `Something went wrong (${code}). Please try again.`;
}
