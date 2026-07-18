require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const OpenAI = require('openai');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const app = express();
const PORT = process.env.PORT || 3002;

// ── Firebase Admin SDK (for token verification + Firestore writes from server) ──
let firebaseAdminApp;
if (!getApps().length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    firebaseAdminApp = initializeApp({ credential: cert(serviceAccount) });
  } else {
    // Dev: initialize without credentials — token verification skipped
    try {
      firebaseAdminApp = initializeApp({ projectId: 'mindyou-2c6c4' });
    } catch (e) {
      console.warn('[Firebase Admin] Could not initialize — running without token verification');
    }
  }
} else {
  firebaseAdminApp = getApps()[0];
}

const firestoreAdmin = firebaseAdminApp ? getFirestore() : null;

// ── OpenAI ────────────────────────────────────────────────────────────────────
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

if (!openai) console.warn('[OpenAI] No OPENAI_API_KEY set — AI features will fail');

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', process.env.FRONTEND_URL].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Verify Firebase ID token middleware
async function verifyToken(req, res, next) {
  if (!firebaseAdminApp) return next(); // Dev fallback: skip verification
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = await getAuth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// API key middleware for Apple Health webhook
function verifyApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!process.env.HEALTH_API_KEY || key === process.env.HEALTH_API_KEY) return next();
  res.status(401).json({ error: 'Invalid API key' });
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', openai: !!openai, firebase: !!firebaseApp, ts: new Date().toISOString() });
});

// ── AI: Daily Insight ─────────────────────────────────────────────────────────
app.post('/api/ai/insight', verifyToken, async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'OpenAI not configured' });
  const { healthData = [], goals = [] } = req.body;

  const summary = healthData.slice(0, 14).map((d, i) =>
    `Day ${i + 1}: Screen ${Math.round((d.screen_time_minutes || 0) / 60 * 10) / 10}h, Steps ${d.steps || 0}, Sleep ${d.sleep_hours || 0}h, Exercise ${d.active_energy_kcal || 0}kcal, Mindful ${d.mindful_minutes || 0}min`
  ).join('\n');

  const goalSummary = goals.length ? goals.map(g => `${g.habit_type}: ${g.target_value} ${g.target_unit}`).join(', ') : 'No goals set';

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are MindYou, an empathetic AI habit coach. Analyze health data and return a JSON object with: risk_score (0-100 integer), risk_level ("Low"|"Moderate"|"High"), nudge (one warm, specific insight sentence), recommendations (array of 3 short action items). Be compassionate, never judgmental.' },
        { role: 'user', content: `Health data (most recent first):\n${summary}\n\nUser goals: ${goalSummary}\n\nReturn valid JSON only.` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });
    const result = JSON.parse(completion.choices[0].message.content);
    res.json({ risk_score: result.risk_score || 50, risk_level: result.risk_level || 'Moderate', nudge: result.nudge || '', recommendations: result.recommendations || [] });
  } catch (e) {
    console.error('[AI Insight]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── AI: Coaching Chat ─────────────────────────────────────────────────────────
app.post('/api/ai/coach', verifyToken, async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'OpenAI not configured' });
  const { message, history = [], healthSummary = '' } = req.body;

  const messages = [
    { role: 'system', content: `You are MindYou, a compassionate AI behavior-change coach using motivational interviewing. You help users reduce harmful habits like excessive screen time. Be warm, specific, and empowering. Current health context: ${healthSummary || 'No data available yet'}.` },
    ...history.slice(-10),
    { role: 'user', content: message }
  ];

  try {
    const completion = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages, temperature: 0.8, max_tokens: 400 });
    res.json({ response: completion.choices[0].message.content });
  } catch (e) {
    console.error('[AI Coach]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── AI: Demo Data Seed ────────────────────────────────────────────────────────
app.post('/api/ai/demo-seed', verifyToken, async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'OpenAI not configured' });
  const uid = req.uid || req.body.uid;
  if (!uid) return res.status(400).json({ error: 'Missing uid' });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Generate realistic 14-day health data for a stressed professional trying to reduce phone addiction. Return JSON with key "days" as array of 14 objects: {recorded_at (ISO date, going back from today), screen_time_minutes (150-480), steps (3000-12000), sleep_hours (5-8.5), heart_rate_avg (62-88), active_energy_kcal (100-600), mindful_minutes (0-30)}. Show a realistic pattern with weekends different from weekdays.' },
        { role: 'user', content: 'Generate the 14-day health data array as JSON.' }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.9,
    });

    const { days } = JSON.parse(completion.choices[0].message.content);
    if (!days?.length || !firestoreAdmin) {
      // Return data for client-side saving if no Admin SDK
      return res.json({ days });
    }

    // Save to Firestore via Admin SDK
    const batch = firestoreAdmin.batch();
    const colRef = firestoreAdmin.collection('users').doc(uid).collection('health_data');
    for (const day of days) {
      const docRef = colRef.doc();
      batch.set(docRef, { ...day, is_demo: 1, created_at: FieldValue.serverTimestamp() });
    }
    await batch.commit();

    res.json({ success: true, count: days.length });
  } catch (e) {
    console.error('[Demo Seed]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Apple Health Webhook ──────────────────────────────────────────────────────
app.post('/api/health-data', verifyApiKey, async (req, res) => {
  const { user_id, uid, ...payload } = req.body;
  const firebaseUid = uid || user_id;
  if (!firebaseUid) return res.status(400).json({ error: 'uid required' });

  if (firestoreAdmin) {
    try {
      await firestoreAdmin.collection('users').doc(firebaseUid).collection('health_data').add({
        ...payload,
        recorded_at: payload.recorded_at || new Date().toISOString(),
        is_demo: 0,
        created_at: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  res.json({ success: true });
});

// ── Serve React app in production ──────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));
  app.get('*', (req, res) => res.sendFile(path.join(publicPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`\n🧠 MindYou server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Database: Firestore (Firebase)`);
  console.log(`   OpenAI: ${openai ? '✓ Connected' : '✗ No API key'}\n`);
});

module.exports = app;
