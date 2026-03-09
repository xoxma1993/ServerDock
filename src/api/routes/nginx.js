const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  listDomains,
  createOrUpdateDomain,
  deleteDomain,
  enableDomain,
  disableDomain,
  testConfig,
  reloadNginx,
  runCertbotForDomain
} = require('../../services/nginxManager');

const router = express.Router();

// All routes here are protected; middleware also applied at mount level
router.use(authMiddleware);

router.get('/domains', (req, res) => {
  try {
    const domains = listDomains();
    res.json(domains);
  } catch (err) {
    console.error('[ServerDock] Failed to list nginx domains:', err);
    res.status(500).json({ error: 'Failed to list domains' });
  }
});

router.post('/domains', (req, res) => {
  try {
    const id = createOrUpdateDomain(req.body || {});
    res.json({ id });
  } catch (err) {
    console.error('[ServerDock] Failed to create nginx domain:', err);
    res.status(400).json({ error: err.message || 'Failed to create domain' });
  }
});

router.put('/domains/:id', (req, res) => {
  try {
    const id = req.params.id;
    createOrUpdateDomain({ ...req.body, id });
    res.json({ id });
  } catch (err) {
    console.error('[ServerDock] Failed to update nginx domain:', err);
    res.status(400).json({ error: err.message || 'Failed to update domain' });
  }
});

router.delete('/domains/:id', (req, res) => {
  try {
    deleteDomain(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to delete nginx domain:', err);
    res.status(400).json({ error: err.message || 'Failed to delete domain' });
  }
});

router.post('/domains/:id/enable', (req, res) => {
  try {
    enableDomain(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to enable nginx domain:', err);
    res.status(400).json({ error: err.message || 'Failed to enable domain' });
  }
});

router.post('/domains/:id/disable', (req, res) => {
  try {
    disableDomain(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to disable nginx domain:', err);
    res.status(400).json({ error: err.message || 'Failed to disable domain' });
  }
});

router.post('/domains/:id/ssl/letsencrypt', async (req, res) => {
  const { email, domain } = req.body || {};
  if (!email || !domain) {
    return res.status(400).json({ error: 'email and domain are required' });
  }
  try {
    const output = await runCertbotForDomain({ domain, email });
    res.json({ success: true, output });
  } catch (err) {
    console.error('[ServerDock] Certbot failed:', err);
    res.status(500).json({ error: err.message || 'Certbot failed' });
  }
});

router.post('/test', (req, res) => {
  try {
    const output = testConfig();
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'nginx -t failed' });
  }
});

router.post('/reload', (req, res) => {
  try {
    const output = reloadNginx();
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'reload failed' });
  }
});

module.exports = router;

