/**
 * db.js — Database connection layer
 * Uses PostgreSQL when DATABASE_URL is set (Railway production),
 * falls back to SQLite (better-sqlite3) for local development.
 */

const path = require('path');

let db;
let dbType;

function initDb() {
  if (process.env.DATABASE_URL) {
    // ── PostgreSQL ──────────────────────────────────────────────────────────
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    dbType = 'pg';
    db = {
      query: (text, params) => pool.query(text, params),
      pool,
    };

    console.log('[DB] Connected to PostgreSQL');
  } else {
    // ── SQLite fallback ─────────────────────────────────────────────────────
    const Database = require('better-sqlite3');
    const sqliteDb = new Database(path.join(__dirname, '..', 'database.db'));
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');

    dbType = 'sqlite';
    db = {
      // Wrap SQLite in a Promise-based interface matching pg
      query: (text, params = []) => {
        // Convert $1, $2 placeholders → ? for SQLite
        const sqliteText = text.replace(/\$\d+/g, '?');
        try {
          if (/^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sqliteText)) {
            const stmt = sqliteDb.prepare(sqliteText);
            const info = stmt.run(...params);
            return Promise.resolve({
              rows: [],
              rowCount: info.changes,
              lastID: info.lastInsertRowid,
            });
          } else {
            const stmt = sqliteDb.prepare(sqliteText);
            const rows = stmt.all(...params);
            return Promise.resolve({ rows, rowCount: rows.length });
          }
        } catch (err) {
          return Promise.reject(err);
        }
      },
    };

    console.log('[DB] Connected to SQLite (local dev)');
  }
}

async function migrate() {
  const isPostgres = dbType === 'pg';

  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      demo_mode INTEGER NOT NULL DEFAULT 1,
      created_at ${isPostgres ? 'TIMESTAMPTZ' : 'DATETIME'} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'}
    )`,
    `CREATE TABLE IF NOT EXISTS health_data (
      id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recorded_at ${isPostgres ? 'TIMESTAMPTZ' : 'DATETIME'} NOT NULL,
      screen_time_minutes INTEGER,
      steps INTEGER,
      sleep_hours REAL,
      heart_rate_avg INTEGER,
      active_energy_kcal INTEGER,
      mindful_minutes INTEGER,
      is_demo INTEGER NOT NULL DEFAULT 0,
      raw_payload ${isPostgres ? 'JSONB' : 'TEXT'},
      created_at ${isPostgres ? 'TIMESTAMPTZ' : 'DATETIME'} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'}
    )`,
    `CREATE TABLE IF NOT EXISTS insights (
      id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      insight_type TEXT NOT NULL,
      content TEXT NOT NULL,
      risk_score INTEGER,
      is_demo INTEGER NOT NULL DEFAULT 0,
      generated_at ${isPostgres ? 'TIMESTAMPTZ' : 'DATETIME'} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'}
    )`,
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at ${isPostgres ? 'TIMESTAMPTZ' : 'DATETIME'} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'}
    )`,
    `CREATE TABLE IF NOT EXISTS goals (
      id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      habit_type TEXT NOT NULL,
      target_value REAL NOT NULL,
      target_unit TEXT NOT NULL,
      current_value REAL DEFAULT 0,
      streak_days INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at ${isPostgres ? 'TIMESTAMPTZ' : 'DATETIME'} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'}
    )`,
    `CREATE TABLE IF NOT EXISTS nudges (
      id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at ${isPostgres ? 'TIMESTAMPTZ' : 'DATETIME'} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'}
    )`,
  ];

  for (const stmt of statements) {
    await db.query(stmt);
  }

  console.log('[DB] Schema migrated successfully');
}

module.exports = { initDb, migrate, getDb: () => db, getDbType: () => dbType };
