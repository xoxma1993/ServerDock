const express = require('express');
const authMiddleware = require('../middleware/auth');
const { execFile } = require('child_process');
const util = require('util');

const execFileAsync = util.promisify(execFile);
const router = express.Router();

router.use(authMiddleware);

function sanitizeName(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error('Name must be alphanumeric with underscores only');
  }
  return name;
}

// Helper to run safely without shell evaluation
async function runCmdSafe(cmd, args) {
  const { stdout } = await execFileAsync(cmd, args);
  return stdout;
}

router.get('/status', async (req, res) => {
  const result = {
    postgres: { running: false, version: null },
    mysql: { running: false, version: null },
    redis: { running: false, version: null }
  };

  try {
    const stdout = await runCmdSafe('systemctl', ['is-active', 'postgresql']);
    result.postgres.running = stdout.trim() === 'active';
  } catch {
    result.postgres.running = false;
  }
  if (result.postgres.running) {
    try {
      const v = await runCmdSafe('psql', ['--version']);
      result.postgres.version = v.trim();
    } catch {}
  }

  try {
    const stdout = await runCmdSafe('systemctl', ['is-active', 'mysql']);
    result.mysql.running = stdout.trim() === 'active';
  } catch {
    result.mysql.running = false;
  }
  if (result.mysql.running) {
    try {
      const v = await runCmdSafe('mysql', ['--version']);
      result.mysql.version = v.trim();
    } catch {}
  }

  try {
    const stdout = await runCmdSafe('systemctl', ['is-active', 'redis-server']);
    result.redis.running = stdout.trim() === 'active';
  } catch {
    result.redis.running = false;
  }
  if (result.redis.running) {
    try {
      const v = await runCmdSafe('redis-server', ['--version']);
      result.redis.version = v.trim();
    } catch {}
  }

  res.json(result);
});

// PostgreSQL
router.post('/postgres/create', async (req, res) => {
  try {
    const { dbName, username, password } = req.body || {};
    if (!dbName || !username || !password) {
      return res.status(400).json({ error: 'dbName, username and password are required' });
    }
    const db = sanitizeName(dbName);
    const user = sanitizeName(username);

    // Check if role exists
    try {
      await runCmdSafe('sudo', ['-u', 'postgres', 'psql', '-tc', `SELECT 1 FROM pg_roles WHERE rolname='${user}'`]);
    } catch {
      // Create user if not exists
      await runCmdSafe('sudo', ['-u', 'postgres', 'psql', '-c', `CREATE USER "${user}" WITH PASSWORD '${password}'`]);
    }

    // Check if database exists
    try {
      await runCmdSafe('sudo', ['-u', 'postgres', 'psql', '-tc', `SELECT 1 FROM pg_database WHERE datname='${db}'`]);
    } catch {
      // Create db if not exists
      await runCmdSafe('sudo', ['-u', 'postgres', 'createdb', '-O', user, db]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to create postgres db:', err);
    res.status(500).json({ error: err.message || 'Failed to create database' });
  }
});

router.post('/postgres/drop', async (req, res) => {
  try {
    const { dbName } = req.body || {};
    if (!dbName) {
      return res.status(400).json({ error: 'dbName is required' });
    }
    const db = sanitizeName(dbName);
    await runCmdSafe('sudo', ['-u', 'postgres', 'dropdb', db]);
    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to drop postgres db:', err);
    res.status(500).json({ error: err.message || 'Failed to drop database' });
  }
});

router.get('/postgres/list', async (req, res) => {
  try {
    const dbsRaw = await runCmdSafe('sudo', [
      '-u', 'postgres', 'psql', '-Atc',
      "SELECT datname, pg_catalog.pg_get_userbyid(datdba) FROM pg_database WHERE datistemplate = false;"
    ]);
    const dbs = dbsRaw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [name, owner] = line.split('|');
        return { name, owner };
      });

    const usersRaw = await runCmdSafe('sudo', [
      '-u', 'postgres', 'psql', '-Atc',
      "SELECT rolname FROM pg_roles WHERE rolcanlogin = true;"
    ]);
    const users = usersRaw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((name) => ({ name }));

    res.json({ databases: dbs, users });
  } catch (err) {
    console.error('[ServerDock] Failed to list postgres dbs:', err);
    res.status(500).json({ error: err.message || 'Failed to list databases' });
  }
});

// MySQL
router.post('/mysql/create', async (req, res) => {
  try {
    const { dbName, username, password } = req.body || {};
    if (!dbName || !username || !password) {
      return res.status(400).json({ error: 'dbName, username and password are required' });
    }
    const db = sanitizeName(dbName);
    const user = sanitizeName(username);

    const sql = `
CREATE DATABASE IF NOT EXISTS \`${db}\`;
CREATE USER IF NOT EXISTS '${user}'@'%' IDENTIFIED BY '${password.replace(/'/g, "''")}';
GRANT ALL PRIVILEGES ON \`${db}\`.* TO '${user}'@'%';
FLUSH PRIVILEGES;
`;
    await runCmdSafe('mysql', ['-uroot', '-e', sql.trim()]);
    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to create mysql db:', err);
    res.status(500).json({ error: err.message || 'Failed to create database' });
  }
});

router.get('/mysql/list', async (req, res) => {
  try {
    const dbsRaw = await runCmdSafe('mysql', [
      '-uroot', '-N', '-e',
      "SHOW DATABASES WHERE `Database` NOT IN ('mysql','information_schema','performance_schema','sys');"
    ]);
    const dbs = dbsRaw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((name) => ({ name }));
    res.json({ databases: dbs });
  } catch (err) {
    console.error('[ServerDock] Failed to list mysql dbs:', err);
    res.status(500).json({ error: err.message || 'Failed to list databases' });
  }
});

// Redis
router.post('/redis/flush', async (req, res) => {
  try {
    await runCmdSafe('redis-cli', ['FLUSHALL']);
    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to flush redis:', err);
    res.status(500).json({ error: err.message || 'Failed to flush redis' });
  }
});

module.exports = router;

