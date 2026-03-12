const express = require('express');
const { execFile } = require('child_process');
const util = require('util');
const { runCommandSSE } = require('../../services/executor');

const execFileAsync = util.promisify(execFile);
const router = express.Router();

// Definition of installable packages
const PACKAGES = [
  // RUNTIMES
  {
    id: 'nodejs_18',
    name: 'Node.js 18',
    category: 'runtimes',
    checkCmd: 'node',
    checkArgs: ['-v'],
    versionRegex: /^v18\./,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'nodejs'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'nodejs']
  },
  {
    id: 'nodejs_20',
    name: 'Node.js 20',
    category: 'runtimes',
    checkCmd: 'node',
    checkArgs: ['-v'],
    versionRegex: /^v20\./,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'nodejs'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'nodejs']
  },
  {
    id: 'nodejs_22',
    name: 'Node.js 22',
    category: 'runtimes',
    checkCmd: 'node',
    checkArgs: ['-v'],
    versionRegex: /^v22\./,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'nodejs'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'nodejs']
  },
  {
    id: 'python3',
    name: 'Python 3',
    category: 'runtimes',
    checkCmd: 'python3',
    checkArgs: ['--version'],
    versionRegex: /^Python 3\./,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'python3'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'python3']
  },
  {
    id: 'python3-pip',
    name: 'pip for Python 3',
    category: 'runtimes',
    checkCmd: 'pip3',
    checkArgs: ['--version'],
    versionRegex: /^pip /,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'python3-pip'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'python3-pip']
  },
  {
    id: 'php83',
    name: 'PHP 8.3',
    category: 'runtimes',
    checkCmd: 'php',
    checkArgs: ['-v'],
    versionRegex: /^PHP 8\.3\./,
    installCmd: 'apt-get',
    installArgs: [
      'install',
      '-y',
      'php8.3',
      'php8.3-fpm',
      'php8.3-cli',
      'php8.3-mbstring',
      'php8.3-xml',
      'php8.3-curl'
    ],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'php8.3', 'php8.3-fpm', 'php8.3-cli']
  },
  // WEB SERVERS
  {
    id: 'nginx',
    name: 'Nginx',
    category: 'web',
    checkCmd: 'nginx',
    checkArgs: ['-v'],
    versionRegex: /nginx\/([\d.]+)/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'nginx'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'nginx']
  },
  {
    id: 'apache2',
    name: 'Apache 2',
    category: 'web',
    checkCmd: 'apache2',
    checkArgs: ['-v'],
    versionRegex: /Server version: Apache\/([\d.]+)/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'apache2'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'apache2']
  },
  // DATABASES
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    category: 'databases',
    checkCmd: 'psql',
    checkArgs: ['--version'],
    versionRegex: /^psql \(PostgreSQL\) ([\d.]+)/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'postgresql', 'postgresql-contrib'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'postgresql', 'postgresql-contrib']
  },
  {
    id: 'mysql-server',
    name: 'MySQL Server',
    category: 'databases',
    checkCmd: 'mysql',
    checkArgs: ['--version'],
    versionRegex: /^mysql\s+Ver\s+[\d.]+\s+/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'mysql-server'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'mysql-server']
  },
  {
    id: 'redis-server',
    name: 'Redis Server',
    category: 'databases',
    checkCmd: 'redis-server',
    checkArgs: ['--version'],
    versionRegex: /^Redis server v=([\d.]+)/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'redis-server'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'redis-server']
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    category: 'databases',
    checkCmd: 'mongod',
    checkArgs: ['--version'],
    versionRegex: /^db version v([\d.]+)/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'mongodb-org'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'mongodb-org']
  },
  // TOOLS
  {
    id: 'git',
    name: 'Git',
    category: 'tools',
    checkCmd: 'git',
    checkArgs: ['--version'],
    versionRegex: /^git version ([\d.]+)/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'git'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'git']
  },
  {
    id: 'curl',
    name: 'curl',
    category: 'tools',
    checkCmd: 'curl',
    checkArgs: ['--version'],
    versionRegex: /^curl ([\d.]+)/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'curl'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'curl']
  },
  {
    id: 'wget',
    name: 'wget',
    category: 'tools',
    checkCmd: 'wget',
    checkArgs: ['--version'],
    versionRegex: /^GNU Wget ([\d.]+)/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'wget'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'wget']
  },
  {
    id: 'htop',
    name: 'htop',
    category: 'tools',
    checkCmd: 'htop',
    checkArgs: ['--version'],
    versionRegex: /^htop ([\d.]+)/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'htop'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'htop']
  },
  {
    id: 'zip',
    name: 'zip',
    category: 'tools',
    checkCmd: 'zip',
    checkArgs: ['-v'],
    versionRegex: /^Zip ([\d.]+)/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'zip'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'zip']
  },
  {
    id: 'unzip',
    name: 'unzip',
    category: 'tools',
    checkCmd: 'unzip',
    checkArgs: ['-v'],
    versionRegex: /^UnZip ([\d.]+)/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'unzip'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'unzip']
  },
  {
    id: 'certbot',
    name: 'Certbot',
    category: 'tools',
    checkCmd: 'certbot',
    checkArgs: ['--version'],
    versionRegex: /^certbot\s+([\d.]+)/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'certbot', 'python3-certbot-nginx'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'certbot', 'python3-certbot-nginx']
  },
  {
    id: 'fail2ban',
    name: 'Fail2Ban',
    category: 'tools',
    checkCmd: 'fail2ban-client',
    checkArgs: ['--version'],
    versionRegex: /^Fail2Ban v([\d.]+)/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'fail2ban'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'fail2ban']
  },
  {
    id: 'ufw',
    name: 'UFW Firewall',
    category: 'tools',
    checkCmd: 'ufw',
    checkArgs: ['status'],
    versionRegex: null,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'ufw'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'ufw']
  },
  // PROCESS MANAGERS
  {
    id: 'pm2',
    name: 'PM2',
    category: 'process-managers',
    checkCmd: 'pm2',
    checkArgs: ['-v'],
    versionRegex: /^([\d.]+)/,
    installCmd: 'npm',
    installArgs: ['install', '-g', 'pm2'],
    removeCmd: 'npm',
    removeArgs: ['uninstall', '-g', 'pm2']
  },
  {
    id: 'supervisor',
    name: 'Supervisor',
    category: 'process-managers',
    checkCmd: 'supervisord',
    checkArgs: ['-v'],
    versionRegex: /^([\d.]+)/,
    installCmd: 'apt-get',
    installArgs: ['install', '-y', 'supervisor'],
    removeCmd: 'apt-get',
    removeArgs: ['remove', '-y', 'supervisor']
  }
];

function findPackage(id) {
  return PACKAGES.find((p) => p.id === id);
}

router.get('/status', async (req, res) => {
  if (PACKAGES.length === 0) {
    return res.json([]);
  }

  try {
    const results = await Promise.all(
      PACKAGES.map(async (pkg) => {
        let installed = false;
        let version = null;

        try {
          const { stdout, stderr } = await execFileAsync(pkg.checkCmd, pkg.checkArgs || []);
          installed = true;
          const out = `${stdout} ${stderr}`;
          if (pkg.versionRegex) {
            const match = out.match(pkg.versionRegex);
            if (match) {
              version = match[1] || match[0];
            }
          }
        } catch {
          installed = false;
        }

        return {
          id: pkg.id,
          name: pkg.name,
          category: pkg.category,
          installed,
          version
        };
      })
    );

    res.json(results);
  } catch (err) {
    console.error('[ServerDock] Failed to check package statuses:', err);
    res.status(500).json({ error: 'Failed to check package statuses' });
  }
});

// SSE helpers
function setupSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
}

router.post('/install', (req, res) => {
  const { id } = req.body || {};
  const pkg = findPackage(id);

  setupSSE(res);

  if (!pkg) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unknown package id' })}\n\n`);
    return res.end();
  }

  runCommandSSE({
    cmd: pkg.installCmd,
    args: pkg.installArgs,
    res
  });
});

// GET variant for SSE clients (EventSource cannot send a body)
router.get('/install', (req, res) => {
  const { id } = req.query || {};
  const pkg = findPackage(id);

  setupSSE(res);

  if (!pkg) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unknown package id' })}\n\n`);
    return res.end();
  }

  runCommandSSE({
    cmd: pkg.installCmd,
    args: pkg.installArgs,
    res
  });
});

router.post('/remove', (req, res) => {
  const { id } = req.body || {};
  const pkg = findPackage(id);

  setupSSE(res);

  if (!pkg) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unknown package id' })}\n\n`);
    return res.end();
  }

  runCommandSSE({
    cmd: pkg.removeCmd,
    args: pkg.removeArgs,
    res
  });
});

// GET variant for SSE clients (EventSource cannot send a body)
router.get('/remove', (req, res) => {
  const { id } = req.query || {};
  const pkg = findPackage(id);

  setupSSE(res);

  if (!pkg) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unknown package id' })}\n\n`);
    return res.end();
  }

  runCommandSSE({
    cmd: pkg.removeCmd,
    args: pkg.removeArgs,
    res
  });
});

module.exports = router;

