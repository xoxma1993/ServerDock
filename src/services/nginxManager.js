const fs = require('fs');
const path = require('path');
const { exec, execFile } = require('child_process');
const util = require('util');

const execFileAsync = util.promisify(execFile);

const SITES_AVAILABLE = '/etc/nginx/sites-available';
const SITES_ENABLED = '/etc/nginx/sites-enabled';

function safeId(str) {
  return String(str).replace(/[^a-zA-Z0-9_-]/g, '-');
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function parseVhost(id, content) {
  // Very simple parsing based on common directives
  const domainMatch = content.match(/server_name\s+([^;]+);/);
  const rootMatch = content.match(/root\s+([^;]+);/);
  const proxyMatch = content.match(/proxy_pass\s+([^;]+);/);
  const sslCertMatch = content.match(/ssl_certificate\s+([^;]+);/);
  const sslKeyMatch = content.match(/ssl_certificate_key\s+([^;]+);/);
  const accessLogMatch = content.match(/access_log\s+([^;]+);/);
  const errorLogMatch = content.match(/error_log\s+([^;]+);/);

  const domainLine = domainMatch ? domainMatch[1].trim() : '';
  const names = domainLine.split(/\s+/).filter(Boolean);
  const domain = names[0] || '';
  const aliases = names.slice(1);

  let type = 'static';
  let target = null;
  if (proxyMatch) {
    type = 'proxy';
    target = proxyMatch[1].trim();
  } else if (rootMatch) {
    type = 'static';
  }
  if (content.match(/fastcgi_pass\s+unix:/)) {
    type = 'php';
  }

  const ssl = !!sslCertMatch;

  return {
    id,
    domain,
    aliases,
    type,
    target,
    root: rootMatch ? rootMatch[1].trim() : null,
    ssl,
    sslCertPath: sslCertMatch ? sslCertMatch[1].trim() : null,
    sslKeyPath: sslKeyMatch ? sslKeyMatch[1].trim() : null,
    sslMode: 'none', // cannot reliably infer, default
    enabled: fileExists(path.join(SITES_ENABLED, id)),
    accessLog: accessLogMatch ? accessLogMatch[1].trim() : null,
    errorLog: errorLogMatch ? errorLogMatch[1].trim() : null,
    customConfig: '' // not parsed back for now
  };
}

function listDomains() {
  let files = [];
  try {
    files = fs.readdirSync(SITES_AVAILABLE);
  } catch {
    return [];
  }

  return files
    .filter((f) => !f.startsWith('.') && f.endsWith('.conf'))
    .map((filename) => {
      const id = filename.replace(/\.conf$/, '');
      const content = readFileSafe(path.join(SITES_AVAILABLE, filename));
      if (!content) return null;
      return parseVhost(id, content);
    })
    .filter(Boolean);
}

function buildServerBlock(domainConfig) {
  const {
    id,
    domain,
    aliases = [],
    type,
    target,
    root,
    ssl,
    sslCertPath,
    sslKeyPath,
    sslMode,
    accessLog,
    errorLog,
    spaMode,
    clientMaxBodySize,
    customConfig
  } = domainConfig;

  const serverNames = [domain, ...aliases].filter(Boolean).join(' ');
  const accessLogPath = accessLog || `/var/log/nginx/${id}.access.log`;
  const errorLogPath = errorLog || `/var/log/nginx/${id}.error.log`;
  const bodySize = clientMaxBodySize || '100m';

  let server = `
server {
    listen 80;
    listen [::]:80;
    server_name ${serverNames};

    access_log ${accessLogPath};
    error_log ${errorLogPath};

    client_max_body_size ${bodySize};

    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;
`;

  if (type === 'proxy') {
    const proxyTarget = target || 'http://127.0.0.1:3000';
    server += `
    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass ${proxyTarget};

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
`;
  } else if (type === 'php') {
    const rootPath = root || `/var/www/${id}`;
    const phpSocket = domainConfig.phpSocket || 'unix:/run/php/php8.3-fpm.sock';
    server += `
    root ${rootPath};
    index index.php index.html index.htm;

    location / {
        try_files $uri $uri/ ${spaMode ? '/index.html' : '=404'};
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass ${phpSocket};
    }
`;
  } else {
    const rootPath = root || `/var/www/${id}`;
    server += `
    root ${rootPath};
    index index.html index.htm;

    location / {
        try_files $uri $uri/ ${spaMode ? '/index.html' : '=404'};
    }
`;
  }

  if (customConfig) {
    server += `
    ${customConfig}
`;
  }

  server += `
}
`;

  if (ssl) {
    const cert = sslCertPath || `/etc/letsencrypt/live/${domain}/fullchain.pem`;
    const key = sslKeyPath || `/etc/letsencrypt/live/${domain}/privkey.pem`;

    server += `
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${serverNames};

    ssl_certificate ${cert};
    ssl_certificate_key ${key};

    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    access_log ${accessLogPath};
    error_log ${errorLogPath};

    client_max_body_size ${bodySize};

    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # HSTS (optional)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Redirect HTTP to HTTPS
    if ($scheme != "https") {
        return 301 https://$host$request_uri;
    }
`;

    if (type === 'proxy') {
      const proxyTarget = target || 'http://127.0.0.1:3000';
      server += `
    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass ${proxyTarget};

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
`;
    } else if (type === 'php') {
      const rootPath = root || `/var/www/${id}`;
      const phpSocket = domainConfig.phpSocket || 'unix:/run/php/php8.3-fpm.sock';
      server += `
    root ${rootPath};
    index index.php index.html index.htm;

    location / {
        try_files $uri $uri/ ${spaMode ? '/index.html' : '=404'};
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass ${phpSocket};
    }
`;
    } else {
      const rootPath = root || `/var/www/${id}`;
      server += `
    root ${rootPath};
    index index.html index.htm;

    location / {
        try_files $uri $uri/ ${spaMode ? '/index.html' : '=404'};
    }
`;
    }

    if (customConfig) {
      server += `
    ${customConfig}
`;
    }

    server += `
}
`;
  }

  return server;
}

async function writeConfigWithTest(id, configContent) {
  const filename = `${id}.conf`;
  const fullPath = path.join(SITES_AVAILABLE, filename);
  const backupPath = fileExists(fullPath) ? `${fullPath}.bak-${Date.now()}` : null;

  if (backupPath) {
    fs.copyFileSync(fullPath, backupPath);
  }

  fs.writeFileSync(fullPath, configContent, 'utf8');

  try {
    await execFileAsync('nginx', ['-t']);
  } catch (err) {
    // rollback
    if (backupPath) {
      fs.copyFileSync(backupPath, fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
    throw new Error('nginx configuration test failed: ' + (err.stderr || err.message));
  }

  if (backupPath) {
    fs.unlinkSync(backupPath);
  }
}

async function createOrUpdateDomain(config) {
  const id = safeId(config.id || config.domain);
  const serverBlock = buildServerBlock({ ...config, id });
  await writeConfigWithTest(id, serverBlock);
  return id;
}

function deleteDomain(id) {
  const safe = safeId(id);
  const filename = `${safe}.conf`;
  const fullPath = path.join(SITES_AVAILABLE, filename);
  const enabledPath = path.join(SITES_ENABLED, filename);

  if (fileExists(enabledPath)) {
    fs.unlinkSync(enabledPath);
  }
  if (fileExists(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

function enableDomain(id) {
  const safe = safeId(id);
  const filename = `${safe}.conf`;
  const src = path.join(SITES_AVAILABLE, filename);
  const dest = path.join(SITES_ENABLED, filename);
  if (!fileExists(src)) {
    throw new Error('Vhost configuration does not exist');
  }
  if (!fileExists(dest)) {
    fs.symlinkSync(src, dest);
  }
}

function disableDomain(id) {
  const safe = safeId(id);
  const filename = `${safe}.conf`;
  const dest = path.join(SITES_ENABLED, filename);
  if (fileExists(dest)) {
    fs.unlinkSync(dest);
  }
}

async function testConfig() {
  const { stdout, stderr } = await execFileAsync('nginx', ['-t']);
  return stdout || stderr;
}

async function reloadNginx() {
  const { stdout, stderr } = await execFileAsync('systemctl', ['reload', 'nginx']);
  return stdout || stderr;
}

function runCertbotForDomain({ domain, email }) {
  return new Promise((resolve, reject) => {
    // Using exec here as certbot args are complex and strictly generated locally
    const cmd = `certbot --nginx -d ${domain} --non-interactive --agree-tos -m ${email}`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || err.message));
      }
      resolve(stdout || stderr);
    });
  });
}

module.exports = {
  listDomains,
  createOrUpdateDomain,
  deleteDomain,
  enableDomain,
  disableDomain,
  testConfig,
  reloadNginx,
  runCertbotForDomain
};

