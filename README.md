# 🧠 MindYou — AI-Powered Habit Reduction

> GenAI-powered web app that helps users reduce harmful habits like excessive screen time using Apple Health data, personalized coaching, and intelligent nudges.

[![Built with Node.js](https://img.shields.io/badge/Node.js-22-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![OpenAI](https://img.shields.io/badge/AI-GPT--4o--mini-purple)](https://platform.openai.com)
[![Railway](https://img.shields.io/badge/Deploy-Railway-blueviolet)](https://railway.app)

---

## Features

- **🧠 AI Daily Insights** — GPT-4o-mini analyzes your last 14 days and generates a personalized nudge + risk score
- **💬 Adaptive Coaching Chat** — Real-time chat with an AI coach that knows your health history, uses motivational interviewing
- **🎯 Goal Tracking** — Set habit-reduction goals with progress bars and streak tracking
- **🔔 Smart Nudges** — Hourly cron checks generate compassionate nudges when you exceed goals
- **🧪 Demo Mode** — AI-generated realistic health data to explore all features without an iPhone
- **🍎 Apple Health Integration** — iOS Shortcut webhook bridge (no native app needed)
- **📊 Visual Analytics** — Screen time bar charts, trend indicators, activity vs. sleep correlation

---

## Architecture

```
iOS Shortcut → POST /api/health-data (with x-api-key)
                    ↓
             PostgreSQL (Railway)
                    ↓
             OpenAI GPT-4o-mini
                    ↓
             React Dashboard (Vite)
```

---

## Quick Start (Local Dev)

### 1. Clone & Install

```bash
git clone <your-repo>
cd GoodforU-App
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add:
# OPENAI_API_KEY=sk-your-key
# HEALTH_API_KEY=any-random-string
# SESSION_SECRET=any-random-string
```

> Leave `DATABASE_URL` blank to use SQLite for local dev.

### 3. Run

```bash
npm run dev
```

- **App**: http://localhost:5173
- **API**: http://localhost:3001

---

## Deploy to Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Add **PostgreSQL** addon (Railway auto-sets `DATABASE_URL`)
4. Add environment variables:
   ```
   OPENAI_API_KEY=sk-...
   HEALTH_API_KEY=your-random-secret
   SESSION_SECRET=your-random-secret
   NODE_ENV=production
   ```
5. Railway runs `npm run build && npm start` automatically

---

## Apple Health Integration (iOS Shortcut)

1. Open **Shortcuts** app on iPhone → tap **+**
2. Add **"Get Health Sample"** actions for: Screen Time, Step Count, Sleep Analysis, Heart Rate, Active Energy, Mindful Minutes
3. Add **"Get Contents of URL"**:
   - URL: `https://your-app.up.railway.app/api/health-data`
   - Method: `POST`
   - Header: `x-api-key: YOUR_HEALTH_API_KEY`
   - Body (JSON):
     ```json
     {
       "user_id": <your user ID from app>,
       "recorded_at": "<current date>",
       "screen_time_minutes": <screen time in minutes>,
       "steps": <step count>,
       "sleep_hours": <sleep hours>,
       "heart_rate_avg": <avg heart rate>,
       "active_energy_kcal": <active energy>,
       "mindful_minutes": <mindful minutes>
     }
     ```
4. Set **Automation** → Personal Automation → Time of Day (8am) → Run Shortcut

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Sign in |
| GET | `/api/auth/me` | Session | Get current user |
| POST | `/api/health-data` | x-api-key | Ingest Apple Health data |
| GET | `/api/health-data` | Session | Get user health data |
| GET | `/api/insights/daily` | Session | Get/generate daily AI insight |
| GET | `/api/insights/nudges` | Session | Get nudge notifications |
| POST | `/api/coach/message` | Session | Chat with AI coach |
| GET | `/api/coach/history` | Session | Get chat history |
| GET | `/api/goals` | Session | Get active goals |
| POST | `/api/goals` | Session | Create a goal |
| DELETE | `/api/goals/:id` | Session | Remove a goal |
| POST | `/api/demo/seed` | Session | Generate AI demo data |
| POST | `/api/demo/toggle` | Session | Switch demo/live mode |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key (GPT-4o-mini) |
| `HEALTH_API_KEY` | Yes | Secret for iOS Shortcut webhook |
| `SESSION_SECRET` | Yes | Express session signing secret |
| `DATABASE_URL` | Prod | PostgreSQL connection string (Railway) |
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | `production` or `development` |

---

## Security

- **No sensitive data in code** — all secrets via environment variables
- **bcrypt PIN hashing** — 12 salt rounds
- **HTTP-only session cookies** — XSS protection
- **Helmet.js** — security headers
- **Input validation** — all endpoints validate and sanitize inputs
- **API key auth** — webhook endpoint requires `x-api-key` header
- **OpenAI API policy** — API calls are NOT used for model training

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 |
| Styling | Vanilla CSS (Apple-inspired dark system) |
| Backend | Node.js + Express 4 |
| Database | PostgreSQL (Railway) / SQLite (local) |
| AI | OpenAI GPT-4o-mini |
| Auth | Express-session + bcryptjs |
| Deployment | Railway |
| Scheduling | node-cron |

---

## License

MIT — Built for a hackathon. Use freely.
