import React, { useState, useEffect } from 'react';
import InsightCard from './InsightCard';
import { getHealthData, getGoals, getLatestInsight, saveInsight } from '../services/firestore';
import { aiModel } from '../firebase';

const METRICS = [
  { key: 'screen_time_minutes', label: 'Screen Time', icon: '📱', color: 'var(--red)', good: 'below',
    format: v => `${Math.floor(v / 60)}h ${v % 60}m` },
  { key: 'steps', label: 'Steps', icon: '🏃', color: 'var(--green)', good: 'above',
    format: v => v.toLocaleString() },
  { key: 'sleep_hours', label: 'Sleep', icon: '😴', color: 'var(--blue)', good: 'above',
    format: v => `${v.toFixed(1)}h` },
  { key: 'mindful_minutes', label: 'Mindfulness', icon: '🧘', color: 'var(--accent)', good: 'above',
    format: v => `${v}min` },
];

export default function Dashboard({ user, showToast }) {
  const [healthData, setHealthData] = useState([]);
  const [insight, setInsight] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingInsight, setLoadingInsight] = useState(true);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const data = await getHealthData(user.uid, 30);
      setHealthData(data);
    } catch (e) {
      console.error('Failed to fetch health data:', e);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchInsight = async (forceRefresh = false) => {
    setLoadingInsight(true);
    try {
      // Check for a recent cached insight (< 4 hours old)
      if (!forceRefresh) {
        const cached = await getLatestInsight(user.uid);
        if (cached) {
          const age = Date.now() - (cached.generated_at?.toMillis?.() || 0);
          if (age < 4 * 60 * 60 * 1000) {
            setInsight(cached);
            setLoadingInsight(false);
            return;
          }
        }
      }

      // Get fresh data for AI analysis
      const data = await getHealthData(user.uid, 14);
      if (!data.length) { setLoadingInsight(false); return; }

      const goals = await getGoals(user.uid);

      const summary = data.map((d, i) =>
        `Day ${i + 1}: Screen ${Math.round((d.screen_time_minutes || 0) / 60 * 10) / 10}h, Steps ${d.steps || 0}, Sleep ${d.sleep_hours || 0}h, Exercise ${d.active_energy_kcal || 0}kcal, Mindful ${d.mindful_minutes || 0}min`
      ).join('\n');

      const goalSummary = goals.length ? goals.map(g => `${g.habit_type}: ${g.target_value} ${g.target_unit}`).join(', ') : 'No goals set';
      
      const prompt = `You are MindYou, an empathetic AI habit coach. Analyze this health data and return a JSON object with: 
"risk_score" (0-100 integer), 
"risk_level" ("Low", "Moderate", or "High"), 
"nudge" (one warm, specific insight sentence), 
"recommendations" (array of 3 short action items). 
Be compassionate, never judgmental.

User goals: ${goalSummary}
Health data:
${summary}`;

      const result = await aiModel.generateContent(prompt);
      const text = result.response.text();
      
      // Clean up markdown block if present
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const aiResult = JSON.parse(jsonStr);

      // Save to Firestore
      await saveInsight(user.uid, {
        insight_type: 'daily_nudge',
        content: JSON.stringify(aiResult),
        risk_score: aiResult.risk_score,
      });

      setInsight({ content: JSON.stringify(aiResult), risk_score: aiResult.risk_score });
    } catch (e) {
      console.error('Insight error:', e);
      showToast('Could not load AI insight: ' + e.message, 'error');
    } finally {
      setLoadingInsight(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.uid]);

  useEffect(() => {
    if (!loadingData && healthData.length > 0) fetchInsight();
    else if (!loadingData) setLoadingInsight(false);
  }, [loadingData]);

  const latest = healthData[0];
  const chartData = [...healthData].reverse().slice(-14);
  const hasData = healthData.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {hasData ? (
        <InsightCard insight={insight} loading={loadingInsight} onRefresh={() => fetchInsight(true)} />
      ) : !loadingData ? (
        <div className="empty-state">
          <span style={{ fontSize: '2rem' }}>📊</span>
          <p style={{ marginTop: 'var(--space-md)' }}>No data logged yet.</p>
        </div>
      ) : null}

      {hasData && (
        <>
          <div>
            <div className="section-header">
              <span className="section-title">Today's Metrics</span>
              {loadingData && <span className="spinner" style={{ width: 16, height: 16 }} />}
            </div>
            <div className="grid-auto">
              {METRICS.map(m => {
                const val = latest?.[m.key];
                return (
                  <div key={m.key} className="stat-card" role="region" aria-label={m.label}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="stat-label">{m.label}</span>
                      <span style={{ fontSize: '1.25rem' }}>{m.icon}</span>
                    </div>
                    <div className="stat-value" style={{ color: m.color }}>
                      {val != null ? m.format(val) : '—'}
                    </div>
                    <TrendIndicator data={healthData} metricKey={m.key} good={m.good} />
                  </div>
                );
              })}
            </div>
          </div>

          {chartData.length > 1 && (
            <div className="card">
              <div className="section-header" style={{ marginBottom: 'var(--space-lg)' }}>
                <span className="section-title">📱 Screen Time — Last {chartData.length} Days</span>
              </div>
              <ScreenTimeChart data={chartData} />
            </div>
          )}

          {chartData.length > 1 && (
            <div className="grid-2">
              <div className="card">
                <div className="section-title mb-md">🏃 Activity Trend</div>
                <MiniChart data={chartData} metricKey="steps" color="var(--green)" />
              </div>
              <div className="card">
                <div className="section-title mb-md">😴 Sleep Trend</div>
                <MiniChart data={chartData} metricKey="sleep_hours" color="var(--blue)" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TrendIndicator({ data, metricKey, good }) {
  if (data.length < 2) return null;
  const latest = data[0]?.[metricKey], prev = data[1]?.[metricKey];
  if (latest == null || prev == null || prev === 0) return null;
  const change = latest - prev;
  const pct = Math.round((Math.abs(change) / prev) * 100);
  if (pct === 0) return <span className="stat-change">No change</span>;
  const isGood = good === 'above' ? change > 0 : change < 0;
  return <span className={`stat-change ${isGood ? 'positive' : 'negative'}`}>{change > 0 ? '↑' : '↓'} {pct}% vs yesterday</span>;
}

function ScreenTimeChart({ data }) {
  const maxVal = Math.max(...data.map(d => d.screen_time_minutes || 0), 1);
  return (
    <div className="chart-container" role="img" aria-label="Screen time chart">
      <div className="bar-chart">
        {data.map((d, i) => {
          const val = d.screen_time_minutes || 0;
          const h = val / 60;
          const color = h > 4 ? 'var(--red)' : h > 2 ? 'var(--orange)' : 'var(--green)';
          const day = new Date(d.recorded_at?.toDate?.() || d.recorded_at).toLocaleDateString('en', { weekday: 'short' });
          return (
            <div key={i} className="bar-item" title={`${day}: ${Math.floor(val/60)}h ${val%60}m`}>
              <div className="bar-fill" style={{ height: `${Math.max((val/maxVal)*100, 4)}%`, background: `linear-gradient(180deg, ${color}cc, ${color}55)` }} />
              <span className="bar-label">{day}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-lg)', marginTop: 'var(--space-md)' }}>
        {[['var(--green)', '< 2h'], ['var(--orange)', '2-4h'], ['var(--red)', '> 4h']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniChart({ data, metricKey, color }) {
  const maxVal = Math.max(...data.map(d => d[metricKey] || 0), 1);
  return (
    <div className="bar-chart" style={{ height: 80 }}>
      {data.map((d, i) => {
        const val = d[metricKey] || 0;
        const day = new Date(d.recorded_at?.toDate?.() || d.recorded_at).toLocaleDateString('en', { weekday: 'narrow' });
        return (
          <div key={i} className="bar-item">
            <div className="bar-fill" style={{ height: `${Math.max((val/maxVal)*100, 4)}%`, background: `linear-gradient(180deg, ${color}cc, ${color}33)` }} />
            <span className="bar-label">{day}</span>
          </div>
        );
      })}
    </div>
  );
}
