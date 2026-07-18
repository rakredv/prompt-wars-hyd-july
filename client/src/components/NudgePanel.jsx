import React, { useState, useEffect } from 'react';
import { getNudges, markNudgeRead } from '../services/firestore';

export default function NudgePanel({ user, showToast, onRead, onUnreadCount }) {
  const [nudges, setNudges] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNudges = async () => {
    setLoading(true);
    try {
      const data = await getNudges(user.uid);
      setNudges(data);
      const unread = data.filter(n => !n.is_read).length;
      onUnreadCount?.(unread);
      if (unread === 0) onRead?.();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNudges(); }, [user.uid]);

  const handleMarkRead = async (id) => {
    await markNudgeRead(user.uid, id);
    setNudges(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    const stillUnread = nudges.filter(n => n.id !== id && !n.is_read).length;
    if (stillUnread === 0) onRead?.();
    onUnreadCount?.(stillUnread);
  };

  const handleMarkAllRead = async () => {
    const unread = nudges.filter(n => !n.is_read);
    await Promise.all(unread.map(n => markNudgeRead(user.uid, n.id)));
    setNudges(prev => prev.map(n => ({ ...n, is_read: 1 })));
    onRead?.();
    onUnreadCount?.(0);
    showToast('All nudges marked as read', 'info');
  };

  const unreadCount = nudges.filter(n => !n.is_read).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      <div className="section-header">
        <div>
          <h2 style={{ margin: 0 }}>Nudges</h2>
          <p style={{ marginTop: 4, fontSize: '0.875rem' }}>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up ✓'}</p>
        </div>
        {unreadCount > 0 && <button id="btn-mark-all-read" className="btn btn-ghost btn-sm" onClick={handleMarkAllRead}>Mark all read</button>}
      </div>

      <div className="card card-sm" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.125rem' }}>✦</span>
          <p style={{ fontSize: '0.875rem', margin: 0 }}>MindYou checks your habits hourly and sends gentle, AI-generated nudges when you're approaching your limits.</p>
        </div>
      </div>

      {loading ? [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 'var(--radius-md)' }} />) :
        nudges.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔔</div>
            <div className="empty-title">No nudges yet</div>
            <div className="empty-desc">Set goals and sync health data — nudges appear when you need them.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }} role="list">
            {nudges.map(nudge => (
              <div key={nudge.id} className={`nudge-item ${!nudge.is_read ? 'unread' : ''}`} role="listitem">
                {!nudge.is_read ? <div className="nudge-dot" /> : <div style={{ width: 8 }} />}
                <div style={{ flex: 1 }}>
                  <p className="nudge-text">{nudge.content}</p>
                  <time className="nudge-time">{formatRelTime(nudge.created_at)}</time>
                </div>
                {!nudge.is_read && (
                  <button id={`btn-read-nudge-${nudge.id}`} className="btn btn-ghost btn-sm" onClick={() => handleMarkRead(nudge.id)} style={{ flexShrink: 0, fontSize: '0.75rem' }}>✓</button>
                )}
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

function formatRelTime(ts) {
  if (!ts) return '';
  const date = ts.toDate?.() || new Date(ts);
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
