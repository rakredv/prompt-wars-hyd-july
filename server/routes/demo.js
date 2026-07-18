/**
 * demo.js routes — Demo mode toggle and AI-generated data seeding
 */

const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { generateDemoHealthData } = require('../services/openai');

const router = express.Router();

/**
 * POST /api/demo/seed
 * Generate AI demo data and store in DB for this user
 */
router.post('/seed', requireAuth, async (req, res) => {
  const db = getDb();

  try {
    // Check if demo data already exists
    const { rows: existing } = await db.query(
      'SELECT COUNT(*) as count FROM health_data WHERE user_id = $1 AND is_demo = 1',
      [req.session.userId]
    );
    const count = parseInt(existing[0]?.count || existing[0]?.['COUNT(*)'] || 0);

    if (count > 0) {
      return res.json({ success: true, seeded: false, message: 'Demo data already exists' });
    }

    // Ask OpenAI to generate realistic demo data
    const demoData = await generateDemoHealthData();

    if (!Array.isArray(demoData)) {
      throw new Error('Invalid demo data format from AI');
    }

    // Insert 14 days of data going backwards from today
    const now = new Date();
    for (let i = 0; i < Math.min(demoData.length, 14); i++) {
      const d = demoData[i];
      const recordedAt = new Date(now);
      recordedAt.setDate(recordedAt.getDate() - (13 - i));

      await db.query(
        `INSERT INTO health_data 
          (user_id, recorded_at, screen_time_minutes, steps, sleep_hours, heart_rate_avg, active_energy_kcal, mindful_minutes, is_demo, raw_payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9)`,
        [
          req.session.userId,
          recordedAt.toISOString(),
          Math.round(d.screen_time_minutes),
          Math.round(d.steps),
          parseFloat(d.sleep_hours),
          Math.round(d.heart_rate_avg),
          Math.round(d.active_energy_kcal),
          Math.round(d.mindful_minutes),
          JSON.stringify(d),
        ]
      );
    }

    // Seed default goals for demo mode
    const defaultGoals = [
      { habit_type: 'screen_time', target_value: 3, target_unit: 'hours' },
      { habit_type: 'steps', target_value: 8000, target_unit: 'steps' },
      { habit_type: 'sleep', target_value: 8, target_unit: 'hours' },
    ];

    const { rows: existingGoals } = await db.query(
      'SELECT COUNT(*) as count FROM goals WHERE user_id = $1',
      [req.session.userId]
    );
    const goalCount = parseInt(existingGoals[0]?.count || existingGoals[0]?.['COUNT(*)'] || 0);

    if (goalCount === 0) {
      for (const g of defaultGoals) {
        await db.query(
          'INSERT INTO goals (user_id, habit_type, target_value, target_unit, streak_days) VALUES ($1, $2, $3, $4, $5)',
          [req.session.userId, g.habit_type, g.target_value, g.target_unit, Math.floor(Math.random() * 5)]
        );
      }
    }

    return res.json({ success: true, seeded: true, days: demoData.length });
  } catch (err) {
    console.error('[Demo] Seed error:', err);
    return res.status(500).json({ error: 'Failed to seed demo data: ' + err.message });
  }
});

/**
 * POST /api/demo/toggle
 * Switch between demo and live mode
 */
router.post('/toggle', requireAuth, async (req, res) => {
  const { demo_mode } = req.body;
  const db = getDb();

  try {
    await db.query(
      'UPDATE users SET demo_mode = $1 WHERE id = $2',
      [demo_mode ? 1 : 0, req.session.userId]
    );
    return res.json({ success: true, demo_mode: !!demo_mode });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to toggle mode' });
  }
});

/**
 * DELETE /api/demo/clear
 * Clear all demo data for fresh start
 */
router.delete('/clear', requireAuth, async (req, res) => {
  const db = getDb();
  try {
    await db.query('DELETE FROM health_data WHERE user_id = $1 AND is_demo = 1', [req.session.userId]);
    await db.query('DELETE FROM insights WHERE user_id = $1 AND is_demo = 1', [req.session.userId]);
    await db.query('DELETE FROM chat_messages WHERE user_id = $1 AND is_demo = 1', [req.session.userId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to clear demo data' });
  }
});

module.exports = router;
