const express = require('express');
const jwt = require('jsonwebtoken');

module.exports = function createAuthRouter(loginLimiter) {
  const router = express.Router();

  router.post('/login', loginLimiter, (req, res) => {
    const app = req.app;
    const config = app && app.locals && app.locals.config ? app.locals.config : {};
    const SECRET_TOKEN = config.SECRET_TOKEN;
    const JWT_SECRET = config.JWT_SECRET;

    if (!SECRET_TOKEN || !JWT_SECRET) {
      return res
        .status(500)
        .json({ error: 'Panel is not configured correctly: secrets are missing.' });
    }

    const { token } = req.body || {};
    if (!token || token !== SECRET_TOKEN) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    try {
      const jwtToken = jwt.sign(
        {
          type: 'panel',
          issuedAt: Date.now()
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({ token: jwtToken });
    } catch (err) {
      console.error('[ServerDock] Failed to sign JWT:', err);
      return res.status(500).json({ error: 'Failed to generate auth token' });
    }
  });

  return router;
};

