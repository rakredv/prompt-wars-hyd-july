require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const app = express();
const PORT = process.env.PORT || 3002;

// ── Firebase Admin SDK ────────────────────────────────────────────────────────
let firebaseAdminApp;
if (!getApps().length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      let rawJson = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      if (rawJson.startsWith("'") && rawJson.endsWith("'")) rawJson = rawJson.slice(1, -1);
      const serviceAccount = JSON.parse(rawJson);
      firebaseAdminApp = initializeApp({ credential: cert(serviceAccount) });
    } catch (e) {
      console.error('❌ [Firebase Admin] FATAL: FIREBASE_SERVICE_ACCOUNT environment variable is not valid JSON!');
    }
  } else {
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

// ── Gemini ────────────────────────────────────────────────────────────────────
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
if (!gemini) console.warn('[Gemini] No GEMINI_API_KEY set — AI features will fail');

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', process.env.FRONTEND_URL].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Verify Firebase ID token middleware
async function verifyToken(req, res, next) {
  if (!firebaseAdminApp) return next();
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

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', gemini: !!gemini, firebase: !!firebaseAdminApp, ts: new Date().toISOString() });
});

// ── AI: Daily Insight ─────────────────────────────────────────────────────────
app.post('/api/ai/insight', verifyToken, async (req, res) => {
  if (!gemini) return res.status(503).json({ error: 'Gemini API key not configured' });
  const { healthData = [], goals = [] } = req.body;

  const summary = healthData.slice(0, 14).map((d, i) =>
    `Day ${i + 1}: Screen ${Math.round((d.screen_time_minutes || 0) / 60 * 10) / 10}h, Steps ${d.steps || 0}, Sleep ${d.sleep_hours || 0}h, Exercise ${d.active_energy_kcal || 0}kcal, Mindful ${d.mindful_minutes || 0}min`
  ).join('\n');

  const goalSummary = goals.length ? goals.map(g => `${g.habit_type}: ${g.target_value} ${g.target_unit}`).join(', ') : 'No goals set';
  
  const prompt = `You are MindYou, an empathetic AI habit coach. Analyze this health data and return a JSON object with: 
"risk_score" (0-100 integer), 
"risk_level" ("Low", "Moderate", or "High"), 
"nudge" (one warm, specific insight sentence), 
"recommendations" (array of 3 short action items). 
Be compassionate, never judgmental.

User goals: ${goalSummary}
Health data:
${summary}`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7
      }
    });
    const result = JSON.parse(response.text);
    res.json({ 
      risk_score: result.risk_score || 50, 
      risk_level: result.risk_level || 'Moderate', 
      nudge: result.nudge || '', 
      recommendations: result.recommendations || [] 
    });
  } catch (e) {
    console.error('[AI Insight]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── AI: Coaching Chat ─────────────────────────────────────────────────────────
app.post('/api/ai/coach', verifyToken, async (req, res) => {
  if (!gemini) return res.status(503).json({ error: 'Gemini API key not configured' });
  const { message, history = [], healthSummary = '' } = req.body;

  const systemInstruction = `You are MindYou, a compassionate AI behavior-change coach using motivational interviewing. You help users reduce harmful habits like excessive screen time. Be warm, specific, and empowering. Current health context: ${healthSummary || 'No data available yet'}.`;
  
  // Format history for Gemini
  const contents = history.slice(-10).map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));
  
  // Add the new user message
  contents.push({ role: 'user', parts: [{ text: message }] });

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.8,
        maxOutputTokens: 400
      }
    });
    res.json({ response: response.text });
  } catch (e) {
    console.error('[AI Coach]', e.message);
    res.status(500).json({ error: e.message });
  }
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
  console.log(`   Gemini: ${gemini ? '✓ Connected' : '✗ No API key'}\n`);
});
module.exports = app;
