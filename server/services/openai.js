/**
 * openai.js — OpenAI GPT-4o-mini service wrapper
 * Handles: nudge generation, risk scoring, coaching, demo data generation
 */

const OpenAI = require('openai');

let openai;

function getClient() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Generate a daily insight + risk score from recent health data
 */
async function generateDailyInsight(healthData, goals) {
  const client = getClient();

  const dataStr = healthData
    .slice(0, 14)
    .map(
      (d) =>
        `Date: ${d.recorded_at}, Screen: ${d.screen_time_minutes}min, Steps: ${d.steps}, Sleep: ${d.sleep_hours}h, HR: ${d.heart_rate_avg}bpm, Mindful: ${d.mindful_minutes}min`
    )
    .join('\n');

  const goalsStr = goals.length
    ? goals.map((g) => `${g.habit_type}: target ${g.target_value}${g.target_unit}/day, streak ${g.streak_days} days`).join(', ')
    : 'No goals set yet';

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are MindYou, a compassionate AI wellness coach specializing in habit reduction and behavior change. 
You analyze Apple Health data and provide warm, science-backed, actionable nudges.
Always respond in valid JSON with keys: "nudge" (2-3 sentence personalized insight), "risk_score" (0-100 integer, higher = more at risk), "risk_label" ("Low"|"Moderate"|"High"), "action" (one specific actionable step for today).
Be empathetic, never judgmental. Focus on progress, not perfection.`,
      },
      {
        role: 'user',
        content: `Here is my health data for the past ${healthData.length} days:\n${dataStr}\n\nMy goals: ${goalsStr}\n\nAnalyze my patterns and give me today's insight.`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 500,
    temperature: 0.7,
  });

  const result = JSON.parse(response.choices[0].message.content);
  return {
    nudge: result.nudge || 'Keep going — every small step counts.',
    risk_score: Math.min(100, Math.max(0, parseInt(result.risk_score) || 50)),
    risk_label: result.risk_label || 'Moderate',
    action: result.action || 'Take a 10-minute mindful walk today.',
  };
}

/**
 * Single coaching message response (non-streaming for reliability)
 */
async function getCoachResponse(userId, userMessage, chatHistory, healthSummary) {
  const client = getClient();

  const systemPrompt = `You are MindYou, a warm, empathetic AI wellness coach helping users reduce harmful habits like excessive screen time. 
You use motivational interviewing techniques and CBT-based approaches.
Keep responses concise (2-4 sentences), warm, and actionable.
You have access to the user's health data: ${healthSummary}
Never be preachy. Meet the user where they are.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 300,
    temperature: 0.8,
  });

  return response.choices[0].message.content;
}

/**
 * Generate realistic demo health data for 14 days
 * This is called once to seed the demo — AI generates plausible patterns
 */
async function generateDemoHealthData() {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Generate realistic Apple Health data for a person who uses their phone too much (averaging 5-7 hours screen time/day) and is trying to reduce it. Show some days being better and some worse — realistic human patterns with weekends being worse. Return JSON array of 14 objects with keys: screen_time_minutes, steps, sleep_hours, heart_rate_avg, active_energy_kcal, mindful_minutes. Steps should be 3000-12000, sleep 5.5-8.5, HR 62-85, energy 200-600, mindful 0-20. Vary day to day realistically.`,
      },
      {
        role: 'user',
        content: 'Generate the 14-day health data array. Return only a valid JSON object with key "data" containing the array.',
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1500,
    temperature: 0.9,
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return parsed.data || parsed;
}

/**
 * Generate a proactive nudge when thresholds are exceeded
 */
async function generateNudge(healthData, goals) {
  const client = getClient();

  const latest = healthData[0];
  if (!latest) return null;

  const violations = goals.filter((g) => {
    if (g.habit_type === 'screen_time' && g.target_unit === 'hours') {
      return latest.screen_time_minutes > g.target_value * 60;
    }
    return false;
  });

  if (violations.length === 0) return null;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are MindYou. Generate a brief, warm, non-judgmental nudge notification (1 sentence, max 120 chars) to help the user get back on track.',
      },
      {
        role: 'user',
        content: `User's screen time today: ${latest.screen_time_minutes} minutes. Goal: ${violations[0].target_value} hours. Send a gentle nudge.`,
      },
    ],
    max_tokens: 80,
    temperature: 0.8,
  });

  return response.choices[0].message.content.replace(/^["']|["']$/g, '');
}

module.exports = { generateDailyInsight, getCoachResponse, generateDemoHealthData, generateNudge };
