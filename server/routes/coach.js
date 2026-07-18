/**
 * coach.js routes — AI coaching chat
 */

const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getCoachResponse } = require('../services/openai');

const router = express.Router();

/**
 * GET /api/coach/history
 * Get chat history for current user
 */
router.get('/history', requireAuth, async (req, res) => {
  const db = getDb();
  try {
    const { rows: userRows } = await db.query('SELECT demo_mode FROM users WHERE id = $1', [req.session.userId]);
    const demoMode = !!userRows[0]?.demo_mode;

    const { rows } = await db.query(
      `SELECT id, role, content, created_at FROM chat_messages 
       WHERE user_id = $1 AND is_demo = $2
       ORDER BY created_at ASC LIMIT 50`,
      [req.session.userId, demoMode ? 1 : 0]
    );
    return res.json({ messages: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

/**
 * POST /api/coach/message
 * Send a message to the AI coach
 */
router.post('/message', requireAuth, async (req, res) => {
  const { message } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (message.trim().length > 1000) {
    return res.status(400).json({ error: 'Message too long (max 1000 chars)' });
  }

  const db = getDb();

  try {
    const { rows: userRows } = await db.query('SELECT demo_mode FROM users WHERE id = $1', [req.session.userId]);
    const demoMode = !!userRows[0]?.demo_mode;
    const isDemoFlag = demoMode ? 1 : 0;

    // Get last 10 messages for context
    const { rows: history } = await db.query(
      `SELECT role, content FROM chat_messages 
       WHERE user_id = $1 AND is_demo = $2
       ORDER BY created_at ASC`,
      [req.session.userId, isDemoFlag]
    );

    // Get health summary for context
    const { rows: healthData } = await db.query(
      `SELECT screen_time_minutes, steps, sleep_hours, recorded_at 
       FROM health_data WHERE user_id = $1 AND is_demo = $2
       ORDER BY recorded_at DESC LIMIT 3`,
      [req.session.userId, isDemoFlag]
    );

    const healthSummary = healthData.length
      ? `Recent data: ${healthData.map(d => `${new Date(d.recorded_at).toLocaleDateString()} - Screen: ${d.screen_time_minutes}min, Steps: ${d.steps}, Sleep: ${d.sleep_hours}h`).join('; ')}`
      : 'No health data available yet';

    // Save user message
    await db.query(
      'INSERT INTO chat_messages (user_id, role, content, is_demo) VALUES ($1, $2, $3, $4)',
      [req.session.userId, 'user', message.trim(), isDemoFlag]
    );

    // Get AI response
    const aiResponse = await getCoachResponse(
      req.session.userId,
      message.trim(),
      history,
      healthSummary
    );

    // Save assistant response
    await db.query(
      'INSERT INTO chat_messages (user_id, role, content, is_demo) VALUES ($1, $2, $3, $4)',
      [req.session.userId, 'assistant', aiResponse, isDemoFlag]
    );

    return res.json({ response: aiResponse });
  } catch (err) {
    console.error('[Coach] Error:', err);
    return res.status(500).json({ error: 'Coach unavailable: ' + err.message });
  }
});

/**
 * DELETE /api/coach/history
 * Clear chat history
 */
router.delete('/history', requireAuth, async (req, res) => {
  const db = getDb();
  try {
    const { rows: userRows } = await db.query('SELECT demo_mode FROM users WHERE id = $1', [req.session.userId]);
    const demoMode = !!userRows[0]?.demo_mode;
    await db.query(
      'DELETE FROM chat_messages WHERE user_id = $1 AND is_demo = $2',
      [req.session.userId, demoMode ? 1 : 0]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to clear history' });
  }
});

module.exports = router;
