import React, { useState } from 'react';

export default function HealthSync({ user, demoMode, showToast }) {
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${window.location.origin}/api/health-data`;
  const userId = user?.id;

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(false), 2000);
      showToast(`${label} copied!`, 'success');
    } catch {
      showToast('Copy failed — please copy manually', 'error');
    }
  };

  const shortcutJson = JSON.stringify({
    user_id: userId,
    recorded_at: '[[Current Date]]',
    screen_time_minutes: '[[Screen Time Hours]] * 60',
    steps: '[[Step Count]]',
    sleep_hours: '[[Sleep Analysis Hours]]',
    heart_rate_avg: '[[Heart Rate]]',
    active_energy_kcal: '[[Active Energy]]',
    mindful_minutes: '[[Mindful Minutes]]',
  }, null, 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      <div>
        <h2 style={{ margin: 0 }}>Apple Health Integration</h2>
        <p style={{ marginTop: 4, fontSize: '0.875rem' }}>
          Connect your iPhone to send real health data to MindYou
        </p>
      </div>

      {/* Status banner */}
      {demoMode ? (
        <div style={{
          background: 'rgba(255, 159, 10, 0.08)',
          border: '1px solid rgba(255, 159, 10, 0.2)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md)',
          display: 'flex',
          gap: 'var(--space-sm)',
          alignItems: 'center',
        }}>
          <span>⚠️</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            You're in Demo Mode. Switch to Live Mode in the sidebar to enable Apple Health sync.
          </span>
        </div>
      ) : (
        <div style={{
          background: 'rgba(48, 209, 88, 0.08)',
          border: '1px solid rgba(48, 209, 88, 0.2)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md)',
          display: 'flex',
          gap: 'var(--space-sm)',
          alignItems: 'center',
        }}>
          <span>✅</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Live Mode active — follow the steps below to start syncing Apple Health data.
          </span>
        </div>
      )}

      {/* Main setup card */}
      <div className="health-sync-card" role="region" aria-label="Apple Health setup instructions">
        <div className="health-sync-icon" aria-hidden="true">❤️</div>
        <h3 style={{ marginBottom: 'var(--space-sm)' }}>Set Up iOS Shortcut</h3>
        <p style={{ fontSize: '0.875rem', marginBottom: 0 }}>
          iOS Shortcuts can read Apple Health data and send it to MindYou. Set it up once, run it daily.
        </p>

        <div className="divider" />

        <div className="step-list" role="list">
          <div className="step-item" role="listitem">
            <div className="step-num" aria-hidden="true">1</div>
            <div className="step-text">
              Open the <strong>Shortcuts</strong> app on your iPhone and tap <strong>+</strong> to create a new shortcut.
            </div>
          </div>

          <div className="step-item" role="listitem">
            <div className="step-num" aria-hidden="true">2</div>
            <div className="step-text">
              Add a <strong>"Get Health Sample"</strong> action. Repeat for: Screen Time, Step Count, Sleep Analysis, Heart Rate, Active Energy, Mindful Minutes.
            </div>
          </div>

          <div className="step-item" role="listitem">
            <div className="step-num" aria-hidden="true">3</div>
            <div className="step-text">
              Add a <strong>"Get Contents of URL"</strong> action with:
              <div style={{ marginTop: 'var(--space-sm)' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Webhook URL</div>
                <div
                  className="code-block"
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-sm)' }}
                  onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
                  role="button"
                  tabIndex={0}
                  aria-label="Copy webhook URL"
                  onKeyDown={(e) => e.key === 'Enter' && copyToClipboard(webhookUrl, 'Webhook URL')}
                >
                  <span style={{ wordBreak: 'break-all' }}>{webhookUrl}</span>
                  <span style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {copied === 'Webhook URL' ? '✓ Copied' : 'Copy'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="step-item" role="listitem">
            <div className="step-num" aria-hidden="true">4</div>
            <div className="step-text">
              Set Method to <strong>POST</strong> and add header:
              <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 'var(--space-sm)' }}>
                <div
                  className="code-block"
                  style={{ flex: 1, cursor: 'default' }}
                >
                  x-api-key: <span style={{ color: 'var(--orange)' }}>[your HEALTH_API_KEY]</span>
                </div>
              </div>
              <p style={{ fontSize: '0.8125rem', marginTop: 4 }}>
                Find your HEALTH_API_KEY in your Railway environment variables.
              </p>
            </div>
          </div>

          <div className="step-item" role="listitem">
            <div className="step-num" aria-hidden="true">5</div>
            <div className="step-text">
              Set the Request Body to JSON with your user ID ({userId}):
              <div
                className="code-block"
                style={{ marginTop: 'var(--space-sm)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-sm)' }}
                onClick={() => copyToClipboard(shortcutJson, 'JSON body')}
                role="button"
                tabIndex={0}
                aria-label="Copy JSON body template"
                onKeyDown={(e) => e.key === 'Enter' && copyToClipboard(shortcutJson, 'JSON body')}
              >
                <pre style={{ margin: 0, fontSize: '0.75rem', overflow: 'hidden', flex: 1, whiteSpace: 'pre-wrap' }}>
                  {`{
  "user_id": ${userId},
  "recorded_at": "[[Current Date]]",
  "screen_time_minutes": "...",
  "steps": "...",
  "sleep_hours": "...",
  ...
}`}
                </pre>
                <span style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  {copied === 'JSON body' ? '✓' : 'Copy'}
                </span>
              </div>
            </div>
          </div>

          <div className="step-item" role="listitem">
            <div className="step-num" aria-hidden="true">6</div>
            <div className="step-text">
              Set an <strong>Automation</strong> to run this shortcut every morning at 8am. Your data will sync automatically!
            </div>
          </div>
        </div>
      </div>

      {/* Data types card */}
      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-lg)' }}>📊 Data MindYou uses from Apple Health</h3>
        <div className="grid-2">
          {[
            { icon: '📱', label: 'Screen Time', desc: 'Daily app usage duration' },
            { icon: '🏃', label: 'Step Count', desc: 'Daily steps walked' },
            { icon: '😴', label: 'Sleep Analysis', desc: 'Sleep duration & quality' },
            { icon: '❤️', label: 'Heart Rate', desc: 'Average resting heart rate' },
            { icon: '🔥', label: 'Active Energy', desc: 'Calories burned through activity' },
            { icon: '🧘', label: 'Mindful Minutes', desc: 'Meditation & mindfulness time' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-md)',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy note */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-sm)',
        padding: 'var(--space-md)',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '1rem', flexShrink: 0 }}>🔒</span>
        <p style={{ fontSize: '0.8125rem', margin: 0 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Privacy first.</strong>{' '}
          Your health data is stored securely in your private database and is never shared. The OpenAI API
          only receives anonymized statistics — never raw personal data. OpenAI does not use API calls for model training.
        </p>
      </div>
    </div>
  );
}
