import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { getUserProfile, setUserProfile } from './services/firestore';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import CoachChat from './components/CoachChat';
import GoalTracker from './components/GoalTracker';
import HealthSync from './components/HealthSync';
import NudgePanel from './components/NudgePanel';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⬡' },
  { id: 'coach', label: 'AI Coach', icon: '💬' },
  { id: 'goals', label: 'Goals', icon: '🎯' },
  { id: 'nudges', label: 'Nudges', icon: '🔔' },
  { id: 'health', label: 'Apple Health', icon: '❤️' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [demoMode, setDemoMode] = useState(true);
  const [toast, setToast] = useState(null);
  const [unreadNudges, setUnreadNudges] = useState(0);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Load or create user profile in Firestore
        let prof = await getUserProfile(firebaseUser.uid).catch(() => null);
        if (!prof) {
          prof = { demo_mode: 1, name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User' };
          await setUserProfile(firebaseUser.uid, prof).catch(() => {});
        }
        setProfile(prof);
        setDemoMode(!!prof.demo_mode);
      } else {
        setUser(null);
        setProfile(null);
      }
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  const showToast = (message, type = 'info') => {
    const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
    setToast({ message, icon: icons[type] });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLogout = async () => {
    await signOut(auth);
    showToast('Signed out', 'info');
  };

  const handleModeToggle = async (isDemo) => {
    setDemoMode(isDemo);
    setProfile(p => ({ ...p, demo_mode: isDemo ? 1 : 0 }));
    if (user) {
      await setUserProfile(user.uid, { demo_mode: isDemo ? 1 : 0 }).catch(() => {});
    }
    showToast(isDemo ? '🧪 Demo mode — AI-generated data' : '🍎 Live mode — connect Apple Health', 'info');
  };

  if (!authChecked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--accent-start), var(--accent-end))', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🧠</div>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={(u) => { showToast(`Welcome! 👋`, 'success'); }} showToast={showToast} />;
  }

  const userName = profile?.name || user.displayName || user.email?.split('@')[0] || 'there';

  const pageInfo = {
    dashboard: { title: 'Dashboard', subtitle: `Good ${getTimeOfDay()}, ${userName}` },
    coach: { title: 'AI Coach', subtitle: 'Personalized behavior change coaching' },
    goals: { title: 'Goals', subtitle: 'Track your habit reduction progress' },
    nudges: { title: 'Nudges', subtitle: 'AI-generated moments of awareness' },
    health: { title: 'Apple Health', subtitle: 'Connect your health data' },
  };

  const renderPage = () => {
    const props = { user, demoMode, showToast };
    switch (activePage) {
      case 'dashboard': return <Dashboard {...props} />;
      case 'coach': return <CoachChat {...props} />;
      case 'goals': return <GoalTracker {...props} />;
      case 'nudges': return <NudgePanel {...props} onRead={() => setUnreadNudges(0)} onUnreadCount={setUnreadNudges} />;
      case 'health': return <HealthSync {...props} />;
      default: return null;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🧠</div>
          <span className="sidebar-logo-text">MindYou</span>
        </div>

        <nav className="sidebar-nav" role="navigation" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
              aria-current={activePage === item.id ? 'page' : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.id === 'nudges' && unreadNudges > 0 && (
                <span style={{ marginLeft: 'auto', background: 'var(--accent)', color: 'white', fontSize: '0.625rem', fontWeight: 700, borderRadius: 'var(--radius-full)', padding: '2px 7px' }}>
                  {unreadNudges}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="mode-toggle-container">
            <span className="mode-toggle-label">Data Mode</span>
            <div className="mode-buttons">
              <button id="btn-demo-mode" className={`mode-btn ${demoMode ? 'active' : ''}`} onClick={() => handleModeToggle(true)}>🧪 Demo</button>
              <button id="btn-live-mode" className={`mode-btn ${!demoMode ? 'active' : ''}`} onClick={() => handleModeToggle(false)}>🍎 Live</button>
            </div>
            {demoMode && <span className="demo-badge">⚡ AI data</span>}
          </div>
          <div style={{ marginTop: 8, padding: '8px 4px', fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>·· {user.email}</span>
            <button id="btn-logout" className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ fontSize: '0.75rem', padding: '4px 8px' }}>Sign out</button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="page-header">
          <div className="page-title-area">
            <h1 style={{ fontSize: '1.125rem', margin: 0 }}>{pageInfo[activePage]?.title}</h1>
            <span className="page-subtitle">{pageInfo[activePage]?.subtitle}</span>
          </div>
          {demoMode && (
            <div className="demo-badge" style={{ fontSize: '0.75rem', padding: '4px 12px' }}>
              🧪 Demo Mode —{' '}
              <button onClick={() => { setActivePage('health'); handleModeToggle(false); }}
                style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontWeight: 600, fontSize: 'inherit', padding: 0 }}>
                Connect Apple Health →
              </button>
            </div>
          )}
        </header>

        <div className="page-body">{renderPage()}</div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="toast-container" role="alert" aria-live="polite">
          <div className="toast">
            <span className="toast-icon">{toast.icon}</span>
            <span className="toast-text">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
