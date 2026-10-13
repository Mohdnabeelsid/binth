/**
 * BINTH.IN — JWT Authentication Middleware
 *
 * Attaches `req.user = { id, email, role }` on success.
 * Returns 401 if no token, 403 if token is invalid/expired.
 */

const jwt = require('jsonwebtoken');
const pool = require('../db');

/**
 * Require a valid Bearer JWT from the Authorization header,
 * and verify the account exists and is active in the database.
 */
async function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Authentication required. Please provide a Bearer token.' });
  }

  const token = header.slice(7);
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ ok: false, error: 'Server authentication configuration error.' });
    }

    const payload = jwt.verify(token, secret);

    // Validate account against database: ensure account still exists and is active
    const { rows } = await pool.query(
      `SELECT id, email, role, is_active FROM admin_users WHERE id = $1 LIMIT 1`,
      [payload.sub]
    );

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: 'User account not found.' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ ok: false, error: 'Account has been deactivated. Please contact an administrator.' });
    }

    // Attach verified user identity and current database role
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ ok: false, error: 'Session expired. Please log in again.' });
    }
    return res.status(403).json({ ok: false, error: 'Invalid authentication token.' });
  }
}

/**
 * Require authenticated user to have one of the allowed roles.
 * Call AFTER requireAuth.
 *
 * Usage:
 *   router.post('/campaigns', requireAuth, requireRole(['super_admin', 'campaign_manager']), handler);
 */
function requireRole(allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        ok: false,
        error: `Access denied. This action requires one of: ${allowedRoles.join(', ')}.`
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
