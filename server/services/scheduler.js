/**
 * scheduler.js — Cron-based proactive nudges
 * Runs every hour, checks if users are exceeding goals, generates nudges
 */

const cron = require('node-cron');
const { getDb } = require('../db');
const { generateNudge } = require('./openai');

function startScheduler() {
  // Run every hour at :00
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Running hourly nudge check...');
    try {
      await checkAndNudgeUsers();
    } catch (err) {
      console.error('[Scheduler] Error:', err.message);
    }
  });

  console.log('[Scheduler] Started — hourly nudge checks active');
}

async function checkAndNudgeUsers() {
  const db = getDb();

  // Get all active users with goals
  const { rows: users } = await db.query(`
    SELECT DISTINCT u.id FROM users u
    JOIN goals g ON g.user_id = u.id AND g.is_active = 1
  `);

  for (const user of users) {
    try {
      // Get last nudge time (avoid spam — max 1 nudge per 4 hours)
      const { rows: recentNudges } = await db.query(
        `SELECT created_at FROM nudges 
         WHERE user_id = $1 AND created_at > datetime('now', '-4 hours')
         ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      );

      if (recentNudges.length > 0) continue;

      // Get today's health data
      const { rows: healthData } = await db.query(
        `SELECT * FROM health_data WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
        [user.id]
      );

      // Get user's goals
      const { rows: goals } = await db.query(
        `SELECT * FROM goals WHERE user_id = $1 AND is_active = 1`,
        [user.id]
      );

      if (!healthData.length || !goals.length) continue;

      const nudgeText = await generateNudge(healthData, goals);
      if (!nudgeText) continue;

      await db.query(
        `INSERT INTO nudges (user_id, content, is_read) VALUES ($1, $2, 0)`,
        [user.id, nudgeText]
      );

      console.log(`[Scheduler] Nudge sent to user ${user.id}`);
    } catch (err) {
      console.error(`[Scheduler] Error for user ${user.id}:`, err.message);
    }
  }
}

module.exports = { startScheduler };
