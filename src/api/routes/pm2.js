const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  listProcesses,
  startProcess,
  deleteProcess,
  restartProcess,
  stopProcess,
  startExistingProcess,
  getLogs,
  streamLogsSSE
} = require('../../services/pm2Manager');

const router = express.Router();

router.use(authMiddleware);

router.get('/processes', async (req, res) => {
  try {
    const processes = await listProcesses();
    res.json(processes);
  } catch (err) {
    console.error('[ServerDock] Failed to list pm2 processes:', err);
    res.status(500).json({ error: 'Failed to list processes' });
  }
});

router.post('/processes', async (req, res) => {
  try {
    const { name, script, cwd, args, envVars, instances, watch } = req.body || {};
    if (!name || !script) {
      return res.status(400).json({ error: 'name and script are required' });
    }
    await startProcess({ name, script, cwd, args, envVars, instances, watch });
    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to start pm2 process:', err);
    res.status(500).json({ error: err.message || 'Failed to start process' });
  }
});

router.delete('/processes/:name', async (req, res) => {
  try {
    await deleteProcess(req.params.name);
    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to delete pm2 process:', err);
    res.status(500).json({ error: err.message || 'Failed to delete process' });
  }
});

router.post('/processes/:name/restart', async (req, res) => {
  try {
    await restartProcess(req.params.name);
    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to restart pm2 process:', err);
    res.status(500).json({ error: err.message || 'Failed to restart process' });
  }
});

router.post('/processes/:name/stop', async (req, res) => {
  try {
    await stopProcess(req.params.name);
    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to stop pm2 process:', err);
    res.status(500).json({ error: err.message || 'Failed to stop process' });
  }
});

router.post('/processes/:name/start', async (req, res) => {
  try {
    await startExistingProcess(req.params.name);
    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to start existing pm2 process:', err);
    res.status(500).json({ error: err.message || 'Failed to start process' });
  }
});

router.get('/processes/:name/logs', async (req, res) => {
  const lines = Number(req.query.lines || 100);
  try {
    const logs = await getLogs(req.params.name, lines);
    res.type('text/plain').send(logs);
  } catch (err) {
    console.error('[ServerDock] Failed to get pm2 logs:', err);
    res.status(500).json({ error: err.message || 'Failed to get logs' });
  }
});

function setupSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
}

router.get('/processes/:name/logs/stream', (req, res) => {
  const lines = Number(req.query.lines || 100);
  setupSSE(res);
  try {
    streamLogsSSE({ name: req.params.name, lines, res });
  } catch (err) {
    console.error('[ServerDock] Failed to stream pm2 logs:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
  }
});

module.exports = router;

