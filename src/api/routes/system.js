const express = require('express');
const { getSystemInfo } = require('../../services/systemInfo');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const info = await getSystemInfo();
    res.json(info);
  } catch (err) {
    console.error('[ServerDock] Failed to get system info:', err);
    res.status(500).json({ error: 'Failed to retrieve system info' });
  }
});

module.exports = router;

