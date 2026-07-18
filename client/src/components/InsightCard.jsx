import React, { useEffect, useRef } from 'react';

const RISK_COLORS = {
  Low: 'var(--green)',
  Moderate: 'var(--orange)',
  High: 'var(--red)',
};

export default function InsightCard({ insight, loading, onRefresh }) {
  if (loading) {
    return (
      <div className="insight-card" aria-busy="true">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
          <div className="skeleton" style={{ width: 100, height: 22, borderRadius: 'var(--radius-full)' }} />
          <div className="skeleton" style={{ width: 120, height: 22, borderRadius: 'var(--radius-full)', marginLeft: 'auto' }} />
        </div>
        <div className="skeleton" style={{ width: '100%', height: 18, borderRadius: 4, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: '85%', height: 18, borderRadius: 4, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: '70%', height: 18, borderRadius: 4, marginBottom: 'var(--space-lg)' }} />
        <div className="skeleton" style={{ width: '100%', height: 60, borderRadius: 'var(--radius-md)' }} />
      </div>
    );
  }

  if (!insight) return null;

  let parsed;
  try {
    parsed = typeof insight.content === 'string' ? JSON.parse(insight.content) : insight.content;
  } catch {
    parsed = { nudge: insight.content, risk_score: insight.risk_score, risk_label: 'Moderate', action: '' };
  }

  const { nudge, risk_score, risk_label, action } = parsed;
  const riskColor = RISK_COLORS[risk_label] || RISK_COLORS.Moderate;
  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference - (risk_score / 100) * circumference;

  return (
    <div className="insight-card" role="region" aria-label="Daily AI Insight">
      <div className="insight-header">
        <span className="insight-tag">✦ Daily Insight</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          {/* Risk Meter */}
          <RiskRing score={risk_score} label={risk_label} color={riskColor} />
          <button
            id="btn-refresh-insight"
            className="btn btn-ghost btn-sm"
            onClick={onRefresh}
            aria-label="Refresh insight"
            title="Generate new insight"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <p className="insight-nudge">{nudge}</p>

      {action && (
        <div className="insight-action" role="note" aria-label="Today's action">
          <span className="insight-action-icon">⚡</span>
          <span className="insight-action-text">
            <strong style={{ color: 'var(--text-primary)' }}>Today's action: </strong>
            {action}
          </span>
        </div>
      )}
    </div>
  );
}

function RiskRing({ score, label, color }) {
  const circumference = 2 * Math.PI * 44;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div
      className="risk-ring"
      style={{ width: 80, height: 80 }}
      role="meter"
      aria-label={`Risk score: ${score} — ${label}`}
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
        <circle
          cx="40" cy="40" r="30"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="6"
        />
        <RingArc dashOffset={dashOffset} circumference={circumference} color={color} />
      </svg>
      <div className="risk-ring-text" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
        <div className="risk-score-num" style={{ fontSize: '1.25rem', color }}>{score}</div>
        <div className="risk-score-label" style={{ fontSize: '0.5625rem' }}>{label}</div>
      </div>
    </div>
  );
}

function RingArc({ dashOffset, circumference, color }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.strokeDashoffset = dashOffset;
    }
  }, [dashOffset]);

  return (
    <circle
      ref={ref}
      cx="40" cy="40" r="30"
      fill="none"
      stroke={color}
      strokeWidth="6"
      strokeLinecap="round"
      strokeDasharray={circumference}
      strokeDashoffset={circumference}
      style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), stroke 0.5s ease' }}
    />
  );
}
