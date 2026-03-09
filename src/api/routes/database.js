const express = require('express');
const authMiddleware = require('../middleware/auth');
const { exec, execSync } = require('child_process');

const router = express.Router();

router.use(authMiddleware);

function sanitizeName(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error('Name must be alphanumeric with underscores only');
  }
  return name;
}

function runCmd(cmd) {
  return execSync(cmd, { encoding: 'utf8' });
}

router.get('/status', (req, res) => {
  const result = {
    postgres: { running: false, version: null },
    mysql: { running: false, version: null },
    redis: { running: false, version: null }
  };

  try {
    const status = runCmd('systemctl is-active postgresql || echo inactive').trim();
    result.postgres.running = status === 'active';
    if (result.postgres.running) {
      const v = runCmd('psql --version').trim();
      result.postgres.version = v;
    }
  } catch {}

  try {
    const status = runCmd('systemctl is-active mysql || echo inactive').trim();
    result.mysql.running = status === 'active';
    if (result.mysql.running) {
      const v = runCmd('mysql --version').trim();
      result.mysql.version = v;
    }
  } catch {}

  try {
    const status = runCmd('systemctl is-active redis-server || echo inactive').trim();
    result.redis.running = status === 'active';
    if (result.redis.running) {
      const v = runCmd('redis-server --version').trim();
      result.redis.version = v;
    }
  } catch {}

  res.json(result);
});

// PostgreSQL
router.post('/postgres/create', (req, res) => {
  try {
    const { dbName, username, password } = req.body || {};
    if (!dbName || !username || !password) {
      return res.status(400).json({ error: 'dbName, username and password are required' });
    }
    const db = sanitizeName(dbName);
    const user = sanitizeName(username);

    runCmd(`sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${user}'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER \\"${user}\\" WITH PASSWORD '${password}'"`);
    runCmd(`sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${db}'" | grep -q 1 || sudo -u postgres createdb -O "${user}" "${db}"`);

    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to create postgres db:', err);
    res.status(500).json({ error: err.message || 'Failed to create database' });
  }
});

router.post('/postgres/drop', (req, res) => {
  try {
    const { dbName } = req.body || {};
    if (!dbName) {
      return res.status(400).json({ error: 'dbName is required' });
    }
    const db = sanitizeName(dbName);
    runCmd(`sudo -u postgres dropdb "${db}"`);
    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to drop postgres db:', err);
    res.status(500).json({ error: err.message || 'Failed to drop database' });
  }
});

router.get('/postgres/list', (req, res) => {
  try {
    const dbsRaw = runCmd(
      `sudo -u postgres psql -Atc "SELECT datname, pg_catalog.pg_get_userbyid(datdba) FROM pg_database WHERE datistemplate = false;"`
    );
    const dbs = dbsRaw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [name, owner] = line.split('|');
        return { name, owner };
      });

    const usersRaw = runCmd(
      `sudo -u postgres psql -Atc "SELECT rolname FROM pg_roles WHERE rolcanlogin = true;"`
    );
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
router.post('/mysql/create', (req, res) => {
  try {
    const { dbName, username, password } = req.body || {};
    if (!dbName || !username || !password) {
      return res.status(400).json({ error: 'dbName, username and password are required' });
    }
    const db = sanitizeName(dbName);
    const user = sanitizeName(username);

    const sql = `
CREATE DATABASE IF NOT EXISTS \\\`${db}\\\`;
CREATE USER IF NOT EXISTS '${user}'@'%' IDENTIFIED BY '${password}';
GRANT ALL PRIVILEGES ON \\\`${db}\\\`.* TO '${user}'@'%';
FLUSH PRIVILEGES;
`;
    runCmd(`mysql -uroot -e "${sql.replace(/\n/g, ' ')}"`);
    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to create mysql db:', err);
    res.status(500).json({ error: err.message || 'Failed to create database' });
  }
});

router.get('/mysql/list', (req, res) => {
  try {
    const dbsRaw = runCmd(
      `mysql -uroot -N -e "SHOW DATABASES WHERE \\\`Database\\\` NOT IN ('mysql','information_schema','performance_schema','sys');"`
    );
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
router.post('/redis/flush', (req, res) => {
  try {
    runCmd('redis-cli FLUSHALL');
    res.json({ success: true });
  } catch (err) {
    console.error('[ServerDock] Failed to flush redis:', err);
    res.status(500).json({ error: err.message || 'Failed to flush redis' });
  }
});

module.exports = router;

