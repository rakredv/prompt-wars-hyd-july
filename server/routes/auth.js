/**
 * auth.js routes — Register and login with PIN
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, pin } = req.body;

  if (!name || !pin) {
    return res.status(400).json({ error: 'Name and PIN are required' });
  }
  if (pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be 4-8 digits' });
  }

  try {
    const db = getDb();

    // Check if name already taken
    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE name = $1',
      [name.trim()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const pinHash = await bcrypt.hash(pin, 12);
    const { rows, lastID } = await db.query(
      'INSERT INTO users (name, pin_hash, demo_mode) VALUES ($1, $2, $3) RETURNING id',
      [name.trim(), pinHash, 1]
    );

    const userId = rows?.[0]?.id || lastID;
    req.session.userId = userId;
    req.session.userName = name.trim();

    return res.json({ success: true, user: { id: userId, name: name.trim(), demo_mode: true } });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { name, pin } = req.body;

  if (!name || !pin) {
    return res.status(400).json({ error: 'Name and PIN are required' });
  }

  try {
    const db = getDb();
    const { rows } = await db.query(
      'SELECT id, name, pin_hash, demo_mode FROM users WHERE name = $1',
      [name.trim()]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(pin, user.pin_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    req.session.userName = user.name;

    return res.json({
      success: true,
      user: { id: user.id, name: user.name, demo_mode: !!user.demo_mode },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  try {
    const db = getDb();
    const { rows } = await db.query(
      'SELECT id, name, demo_mode FROM users WHERE id = $1',
      [req.session.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    return res.json({ user: { id: user.id, name: user.name, demo_mode: !!user.demo_mode } });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
