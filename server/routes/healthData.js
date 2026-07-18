/**
 * healthData.js routes — Ingest Apple Health data via iOS Shortcut webhook
 */

const express = require('express');
const { getDb } = require('../db');
const { requireAuth, requireHealthApiKey } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/health-data
 * Called by iOS Shortcut with x-api-key header
 * Body: { user_id, recorded_at, screen_time_minutes, steps, sleep_hours, heart_rate_avg, active_energy_kcal, mindful_minutes }
 */
router.post('/', requireHealthApiKey, async (req, res) => {
  const {
    user_id,
    recorded_at,
    screen_time_minutes,
    steps,
    sleep_hours,
    heart_rate_avg,
    active_energy_kcal,
    mindful_minutes,
  } = req.body;

  if (!user_id || !recorded_at) {
    return res.status(400).json({ error: 'user_id and recorded_at are required' });
  }

  try {
    const db = getDb();

    // Verify user exists
    const { rows: users } = await db.query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (!users.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const rawPayload = JSON.stringify(req.body);

    await db.query(
      `INSERT INTO health_data 
        (user_id, recorded_at, screen_time_minutes, steps, sleep_hours, heart_rate_avg, active_energy_kcal, mindful_minutes, is_demo, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9)`,
      [
        user_id,
        recorded_at,
        screen_time_minutes || null,
        steps || null,
        sleep_hours || null,
        heart_rate_avg || null,
        active_energy_kcal || null,
        mindful_minutes || null,
        rawPayload,
      ]
    );

    // Auto-switch user out of demo mode when real data arrives
    await db.query('UPDATE users SET demo_mode = 0 WHERE id = $1', [user_id]);

    return res.json({ success: true, message: 'Health data recorded' });
  } catch (err) {
    console.error('[HealthData] Error:', err);
    return res.status(500).json({ error: 'Failed to store health data' });
  }
});

/**
 * GET /api/health-data
 * Get current user's health data (last 30 days)
 */
router.get('/', requireAuth, async (req, res) => {
  const db = getDb();
  const { rows: user } = await db.query('SELECT demo_mode FROM users WHERE id = $1', [req.session.userId]);
  const demoMode = user[0]?.demo_mode;

  try {
    const { rows } = await db.query(
      `SELECT * FROM health_data 
       WHERE user_id = $1 AND is_demo = $2
       ORDER BY recorded_at DESC 
       LIMIT 30`,
      [req.session.userId, demoMode ? 1 : 0]
    );

    return res.json({ data: rows, demo_mode: !!demoMode });
  } catch (err) {
    console.error('[HealthData] Fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch health data' });
  }
});

module.exports = router;
