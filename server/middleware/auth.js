/**
 * BINTH.IN — JWT Authentication Middleware
 *
 * Attaches `req.user = { id, email, role }` on success.
 * Returns 401 if no token, 403 if token is invalid/expired.
 */

const jwt = require('jsonwebtoken');

/**
 * Require a valid Bearer JWT from the Authorization header.
 */
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Authentication required. Please provide a Bearer token.' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
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
