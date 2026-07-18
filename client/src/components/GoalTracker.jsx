import React, { useState, useEffect } from 'react';
import { getGoals, addGoal, deleteGoal, getHealthData } from '../services/firestore';

const HABIT_OPTIONS = [
  { value: 'screen_time', label: 'Screen Time', icon: '📱', unit: 'hours', defaultVal: 3, hint: 'Max hours/day', color: 'var(--red)' },
  { value: 'steps', label: 'Daily Steps', icon: '🏃', unit: 'steps', defaultVal: 8000, hint: 'Min steps/day', color: 'var(--green)' },
  { value: 'sleep', label: 'Sleep', icon: '😴', unit: 'hours', defaultVal: 8, hint: 'Min hours/night', color: 'var(--blue)' },
  { value: 'mindfulness', label: 'Mindfulness', icon: '🧘', unit: 'hours', defaultVal: 0.5, hint: 'Min hours/day', color: 'var(--accent)' },
  { value: 'exercise', label: 'Exercise', icon: '🏋️', unit: 'kcal', defaultVal: 400, hint: 'Min calories burned', color: 'var(--orange)' },
];

export default function GoalTracker({ user, demoMode, showToast }) {
  const [goals, setGoals] = useState([]);
  const [todayData, setTodayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState(HABIT_OPTIONS[0]);
  const [targetValue, setTargetValue] = useState(HABIT_OPTIONS[0].defaultVal);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const [g, health] = await Promise.all([
        getGoals(user.uid),
        getHealthData(user.uid, demoMode, 1),
      ]);
      setGoals(g);
      setTodayData(health[0] || null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGoals(); }, [user.uid, demoMode]);

  const getProgress = (goal) => {
    if (!todayData) return { current: 0, pct: 0 };
    let current = 0;
    if (goal.habit_type === 'screen_time') current = (todayData.screen_time_minutes || 0) / 60;
    else if (goal.habit_type === 'steps') current = todayData.steps || 0;
    else if (goal.habit_type === 'sleep') current = todayData.sleep_hours || 0;
    else if (goal.habit_type === 'mindfulness') current = (todayData.mindful_minutes || 0) / 60;
    else if (goal.habit_type === 'exercise') current = todayData.active_energy_kcal || 0;
    const raw = goal.target_value > 0 ? (current / goal.target_value) * 100 : 0;
    const isReduction = goal.habit_type === 'screen_time';
    const pct = isReduction ? Math.max(0, 100 - raw) : Math.min(100, raw);
    return { current: parseFloat(current.toFixed(1)), pct: Math.round(pct) };
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      await addGoal(user.uid, { habit_type: selectedHabit.value, target_value: parseFloat(targetValue), target_unit: selectedHabit.unit });
      showToast(`Goal set: ${selectedHabit.label} 🎯`, 'success');
      setShowModal(false);
      fetchGoals();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await deleteGoal(user.uid, id);
      setGoals(g => g.filter(x => x.id !== id));
      showToast('Goal removed', 'info');
    } catch { showToast('Failed to remove', 'error'); }
    finally { setDeleting(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      <div className="section-header">
        <div>
          <h2 style={{ margin: 0 }}>Your Goals</h2>
          <p style={{ marginTop: 4, fontSize: '0.875rem' }}>{goals.length} active goal{goals.length !== 1 ? 's' : ''}</p>
        </div>
        <button id="btn-add-goal" className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Add Goal</button>
      </div>

      {loading ? (
        [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-md)' }} />)
      ) : goals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <div className="empty-title">No goals yet</div>
          <div className="empty-desc">Set a goal to start your habit reduction journey.</div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>Set your first goal</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }} role="list">
          {goals.map(goal => {
            const opt = HABIT_OPTIONS.find(h => h.value === goal.habit_type);
            const { current, pct } = getProgress(goal);
            const isGood = pct >= 80;
            const barColor = isGood ? 'var(--green)' : opt?.color || 'var(--accent)';
            return (
              <div key={goal.id} className="goal-item" role="listitem">
                <div className="goal-icon" style={{ background: `${opt?.color || 'var(--accent)'}18` }}>{opt?.icon || '🎯'}</div>
                <div className="goal-info">
                  <div className="goal-name">{opt?.label || goal.habit_type}</div>
                  <div className="goal-target">
                    {goal.habit_type === 'screen_time' ? 'Max' : 'Min'} {goal.target_value} {goal.target_unit}/day
                    {current > 0 && <span style={{ marginLeft: 8, color: 'var(--text-tertiary)' }}>· Today: {current} {goal.target_unit}</span>}
                  </div>
                  <div className="goal-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="goal-progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                </div>
                <div className="goal-streak">
                  <span className="streak-num">🔥 {goal.streak_days || 0}</span>
                  <span className="streak-label">days</span>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(goal.id)} disabled={deleting === goal.id} style={{ color: 'var(--text-tertiary)' }}>
                  {deleting === goal.id ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '×'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-card">
            <div><h3 style={{ margin: 0 }}>New Goal</h3><p style={{ marginTop: 4, fontSize: '0.875rem' }}>Choose a habit to track</p></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-sm)' }}>
              {HABIT_OPTIONS.map(h => (
                <button key={h.value} onClick={() => { setSelectedHabit(h); setTargetValue(h.defaultVal); }}
                  style={{ padding: '10px 8px', borderRadius: 'var(--radius-md)', border: `1px solid ${selectedHabit.value === h.value ? h.color : 'var(--border)'}`, background: selectedHabit.value === h.value ? `${h.color}18` : 'var(--bg-card)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontFamily: 'var(--font)', transition: 'var(--transition)' }}>
                  <span style={{ fontSize: '1.25rem' }}>{h.icon}</span>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{h.label}</span>
                </button>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="goal-target-input">{selectedHabit.hint} ({selectedHabit.unit})</label>
              <input id="goal-target-input" className="form-input" type="number" min="0" step={selectedHabit.unit === 'hours' ? '0.5' : '100'} value={targetValue} onChange={e => setTargetValue(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button id="btn-save-goal" className="btn btn-primary" style={{ flex: 1 }} onClick={handleAdd} disabled={saving || !targetValue}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Set Goal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
