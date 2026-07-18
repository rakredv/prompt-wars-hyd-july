/**
 * auth.js middleware — Validates session-based authentication
 */

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized — please log in' });
}

function requireHealthApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.HEALTH_API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  return next();
}

module.exports = { requireAuth, requireHealthApiKey };
