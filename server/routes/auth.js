/**
 * BINTH.IN — Auth Routes
 *
 * POST /api/auth/login   — Verify credentials, issue JWT
 * POST /api/auth/logout  — Client-side only (stateless JWT), acknowledged
 * GET  /api/auth/me      — Return current user profile from token
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

// ─── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password are required.' });
  }

  try {
    // Fetch admin user by email
    const { rows } = await pool.query(
      `SELECT id, full_name, email, password_hash, role, is_active
       FROM admin_users
       WHERE email = $1
       LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    const user = rows[0];

    // Always compare (avoids timing side-channel even on missing user)
    const dummyHash = '$2a$12$dummyhashfortimingresistancethatisnotreal.nope';
    const hashToCompare = user ? user.password_hash : dummyHash;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch) {
      return res.status(401).json({ ok: false, error: 'Incorrect email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ ok: false, error: 'This account has been deactivated. Contact the administrator.' });
    }

    // Update last_login_at
    await pool.query(
      `UPDATE admin_users SET last_login_at = NOW() WHERE id = $1`,
      [user.id]
    );

    // Issue JWT
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error during authentication.' });
  }
});

// ─── POST /api/auth/logout ─────────────────────────────────────────────────
// JWT is stateless — actual invalidation is client-side.
// If you add a token denylist in Redis later, add the token here.
router.post('/logout', requireAuth, (req, res) => {
  res.json({ ok: true, message: 'Logged out. Please discard your local token.' });
});

// ─── GET /api/auth/me ──────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, email, role, last_login_at, created_at
       FROM admin_users
       WHERE id = $1 AND is_active = true
       LIMIT 1`,
      [req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ ok: false, error: 'User account not found or deactivated.' });
    }

    res.json({ ok: true, user: { id: rows[0].id, name: rows[0].full_name, email: rows[0].email, role: rows[0].role, lastLoginAt: rows[0].last_login_at } });
  } catch (err) {
    console.error('[Auth] /me error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error.' });
  }
});

module.exports = router;
