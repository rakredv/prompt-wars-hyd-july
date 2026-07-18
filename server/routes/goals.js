/**
 * goals.js routes — User goal management with streak tracking
 */

const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_HABIT_TYPES = ['screen_time', 'steps', 'sleep', 'mindfulness', 'exercise'];
const VALID_UNITS = ['hours', 'minutes', 'steps', 'kcal', 'days'];

// GET /api/goals
router.get('/', requireAuth, async (req, res) => {
  const db = getDb();
  try {
    const { rows } = await db.query(
      'SELECT * FROM goals WHERE user_id = $1 AND is_active = 1 ORDER BY created_at DESC',
      [req.session.userId]
    );

    // Augment with progress from today's health data
    const { rows: todayData } = await db.query(
      `SELECT * FROM health_data WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [req.session.userId]
    );

    const today = todayData[0];
    const goalsWithProgress = rows.map((goal) => {
      let current_value = 0;
      if (today) {
        if (goal.habit_type === 'screen_time') current_value = (today.screen_time_minutes || 0) / 60;
        else if (goal.habit_type === 'steps') current_value = today.steps || 0;
        else if (goal.habit_type === 'sleep') current_value = today.sleep_hours || 0;
        else if (goal.habit_type === 'mindfulness') current_value = (today.mindful_minutes || 0) / 60;
        else if (goal.habit_type === 'exercise') current_value = (today.active_energy_kcal || 0);
      }

      const progress = goal.habit_type === 'screen_time'
        ? Math.min(100, (current_value / goal.target_value) * 100) // lower is better
        : Math.min(100, (current_value / goal.target_value) * 100);

      return { ...goal, current_value: parseFloat(current_value.toFixed(1)), progress: Math.round(progress) };
    });

    return res.json({ goals: goalsWithProgress });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// POST /api/goals
router.post('/', requireAuth, async (req, res) => {
  const { habit_type, target_value, target_unit } = req.body;

  if (!habit_type || !target_value || !target_unit) {
    return res.status(400).json({ error: 'habit_type, target_value, and target_unit are required' });
  }
  if (!VALID_HABIT_TYPES.includes(habit_type)) {
    return res.status(400).json({ error: `habit_type must be one of: ${VALID_HABIT_TYPES.join(', ')}` });
  }
  if (!VALID_UNITS.includes(target_unit)) {
    return res.status(400).json({ error: `target_unit must be one of: ${VALID_UNITS.join(', ')}` });
  }
  if (isNaN(parseFloat(target_value)) || parseFloat(target_value) <= 0) {
    return res.status(400).json({ error: 'target_value must be a positive number' });
  }

  try {
    const db = getDb();
    const { rows, lastID } = await db.query(
      `INSERT INTO goals (user_id, habit_type, target_value, target_unit) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.session.userId, habit_type, parseFloat(target_value), target_unit]
    );
    return res.status(201).json({ goal: rows[0] || { id: lastID, ...req.body } });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create goal' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const db = getDb();
  try {
    await db.query(
      'UPDATE goals SET is_active = 0 WHERE id = $1 AND user_id = $2',
      [req.params.id, req.session.userId]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// PATCH /api/goals/:id/streak — Update streak (called by scheduler)
router.patch('/:id/streak', requireAuth, async (req, res) => {
  const { increment } = req.body;
  const db = getDb();
  try {
    if (increment) {
      await db.query(
        'UPDATE goals SET streak_days = streak_days + 1 WHERE id = $1 AND user_id = $2',
        [req.params.id, req.session.userId]
      );
    } else {
      await db.query(
        'UPDATE goals SET streak_days = 0 WHERE id = $1 AND user_id = $2',
        [req.params.id, req.session.userId]
      );
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update streak' });
  }
});

module.exports = router;
