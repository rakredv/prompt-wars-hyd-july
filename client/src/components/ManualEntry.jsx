import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function ManualEntry({ user, showToast }) {
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    screen_time_minutes: '',
    steps: '',
    sleep_hours: '',
    heart_rate_avg: '',
    active_energy_kcal: '',
    mindful_minutes: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSeed = async () => {
    setLoading(true);
    try {
      const today = new Date();
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        
        const payload = {
          date: dateStr,
          recorded_at: d.toISOString(),
          screen_time_minutes: isWeekend ? 350 + Math.floor(Math.random()*120) : 220 + Math.floor(Math.random()*90),
          steps: isWeekend ? 4000 + Math.floor(Math.random()*3000) : 8000 + Math.floor(Math.random()*4000),
          sleep_hours: isWeekend ? +(8 + Math.random()).toFixed(1) : +(6 + Math.random()*1.5).toFixed(1),
          heart_rate_avg: 65 + Math.floor(Math.random()*10),
          active_energy_kcal: isWeekend ? 200 + Math.floor(Math.random()*200) : 400 + Math.floor(Math.random()*300),
          mindful_minutes: Math.random() > 0.5 ? Math.floor(Math.random()*20) : 0,
        };

        const docRef = doc(db, 'users', user.uid, 'health_data', dateStr);
        await setDoc(docRef, payload, { merge: true });
      }
      showToast('Successfully seeded 14 days of realistic data!', 'success');
    } catch (err) {
      showToast('Failed to seed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate all required fields
      for (const [key, val] of Object.entries(formData)) {
        if (!val && val !== 0) throw new Error('All fields are required');
      }

      const dateStr = formData.date;
      const docId = dateStr; // e.g. "2026-07-18"
      
      const payload = {
        date: dateStr,
        recorded_at: new Date(dateStr).toISOString(),
        screen_time_minutes: parseInt(formData.screen_time_minutes),
        steps: parseInt(formData.steps),
        sleep_hours: parseFloat(formData.sleep_hours),
        heart_rate_avg: parseInt(formData.heart_rate_avg),
        active_energy_kcal: parseInt(formData.active_energy_kcal),
        mindful_minutes: parseInt(formData.mindful_minutes),
      };

      const docRef = doc(db, 'users', user.uid, 'health_data', docId);
      await setDoc(docRef, payload, { merge: true });

      showToast('Data saved successfully! ✨', 'success');
      
      // Reset form but keep date
      setFormData({
        date: dateStr,
        screen_time_minutes: '',
        steps: '',
        sleep_hours: '',
        heart_rate_avg: '',
        active_energy_kcal: '',
        mindful_minutes: ''
      });
      
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 'var(--space-xs)' }}>Manual Data Entry</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
          Manually log your health metrics for MindYou to analyze.
        </p>
        <button className="btn btn-ghost btn-sm" onClick={handleSeed} disabled={loading} style={{ fontSize: '0.75rem' }}>
          {loading ? 'Seeding...' : '🌱 Seed 14 Days'}
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Date</label>
          <input 
            type="date" 
            name="date" 
            value={formData.date} 
            onChange={handleChange} 
            required 
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          />
        </div>

        <div className="grid-2">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>📱 Screen Time (minutes)</label>
            <input type="number" name="screen_time_minutes" value={formData.screen_time_minutes} onChange={handleChange} required min="0" placeholder="e.g. 240" 
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>🏃 Steps</label>
            <input type="number" name="steps" value={formData.steps} onChange={handleChange} required min="0" placeholder="e.g. 8500" 
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>😴 Sleep (hours)</label>
            <input type="number" name="sleep_hours" value={formData.sleep_hours} onChange={handleChange} required min="0" step="0.1" placeholder="e.g. 7.5" 
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>❤️ Resting Heart Rate (bpm)</label>
            <input type="number" name="heart_rate_avg" value={formData.heart_rate_avg} onChange={handleChange} required min="30" max="200" placeholder="e.g. 62" 
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>🔥 Active Energy (kcal)</label>
            <input type="number" name="active_energy_kcal" value={formData.active_energy_kcal} onChange={handleChange} required min="0" placeholder="e.g. 450" 
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>🧘 Mindful Minutes</label>
            <input type="number" name="mindful_minutes" value={formData.mindful_minutes} onChange={handleChange} required min="0" placeholder="e.g. 15" 
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 'var(--space-md)' }}>
          {loading ? 'Saving...' : 'Save Data'}
        </button>
      </form>
    </div>
  );
}
