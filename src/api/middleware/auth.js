const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const config = req.app && req.app.locals && req.app.locals.config ? req.app.locals.config : {};
  const JWT_SECRET = config.JWT_SECRET;

  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'JWT secret is not configured' });
  }

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring('Bearer '.length).trim();
  } else if (req.query && typeof req.query.token === 'string' && req.query.token.trim() !== '') {
    // Fallback for transports that cannot set headers easily (e.g. EventSource)
    token = req.query.token.trim();
  }

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization token' });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = payload;
    next();
  });
}

module.exports = authMiddleware;

