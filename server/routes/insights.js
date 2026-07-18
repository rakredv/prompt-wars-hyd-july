/**
 * insights.js routes — AI-generated insights and nudges
 */

const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { generateDailyInsight } = require('../services/openai');

const router = express.Router();

/**
 * GET /api/insights/daily
 * Returns today's insight (cached if generated in last 4h, otherwise regenerates)
 */
router.get('/daily', requireAuth, async (req, res) => {
  const db = getDb();

  try {
    const { rows: userRows } = await db.query(
      'SELECT demo_mode FROM users WHERE id = $1',
      [req.session.userId]
    );
    const demoMode = !!userRows[0]?.demo_mode;

    // Check for recent cached insight
    const { rows: cached } = await db.query(
      `SELECT * FROM insights 
       WHERE user_id = $1 AND insight_type = 'daily_nudge' AND is_demo = $2
       AND generated_at > datetime('now', '-4 hours')
       ORDER BY generated_at DESC LIMIT 1`,
      [req.session.userId, demoMode ? 1 : 0]
    );

    if (cached.length > 0) {
      return res.json({ insight: cached[0], cached: true });
    }

    // Fetch health data for AI analysis
    const { rows: healthData } = await db.query(
      `SELECT * FROM health_data WHERE user_id = $1 AND is_demo = $2 ORDER BY recorded_at DESC LIMIT 14`,
      [req.session.userId, demoMode ? 1 : 0]
    );

    const { rows: goals } = await db.query(
      'SELECT * FROM goals WHERE user_id = $1 AND is_active = 1',
      [req.session.userId]
    );

    if (!healthData.length) {
      return res.json({
        insight: {
          insight_type: 'daily_nudge',
          content: JSON.stringify({
            nudge: "Welcome to MindYou! Sync your Apple Health data or explore demo mode to get your first personalized insight.",
            risk_score: 0,
            risk_label: "Low",
            action: "Set your first goal to get started."
          }),
          risk_score: 0,
        },
        cached: false,
      });
    }

    // Generate fresh insight
    const aiResult = await generateDailyInsight(healthData, goals);

    const { rows: inserted, lastID } = await db.query(
      `INSERT INTO insights (user_id, insight_type, content, risk_score, is_demo) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        req.session.userId,
        'daily_nudge',
        JSON.stringify(aiResult),
        aiResult.risk_score,
        demoMode ? 1 : 0,
      ]
    );

    const newInsight = inserted?.[0] || { insight_type: 'daily_nudge', content: JSON.stringify(aiResult), risk_score: aiResult.risk_score };
    return res.json({ insight: newInsight, cached: false });
  } catch (err) {
    console.error('[Insights] Error:', err);
    return res.status(500).json({ error: 'Failed to generate insight: ' + err.message });
  }
});

/**
 * GET /api/insights/nudges
 * Returns unread nudges for the user
 */
router.get('/nudges', requireAuth, async (req, res) => {
  const db = getDb();
  try {
    const { rows } = await db.query(
      `SELECT * FROM nudges WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.session.userId]
    );
    return res.json({ nudges: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch nudges' });
  }
});

/**
 * PATCH /api/insights/nudges/:id/read
 */
router.patch('/nudges/:id/read', requireAuth, async (req, res) => {
  const db = getDb();
  try {
    await db.query(
      'UPDATE nudges SET is_read = 1 WHERE id = $1 AND user_id = $2',
      [req.params.id, req.session.userId]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to mark nudge as read' });
  }
});

module.exports = router;
