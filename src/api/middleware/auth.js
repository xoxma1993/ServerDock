const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const config = req.app && req.app.locals && req.app.locals.config ? req.app.locals.config : {};
  const JWT_SECRET = config.JWT_SECRET;

  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'JWT secret is not configured' });
  }

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.substring('Bearer '.length).trim();

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = payload;
    next();
  });
}

module.exports = authMiddleware;

