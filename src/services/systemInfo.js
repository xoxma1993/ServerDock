const os = require('os');
const { execSync } = require('child_process');

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  seconds -= days * 86400;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

function getDiskInfo() {
  try {
    const output = execSync('df -BG / | tail -1', { encoding: 'utf8' }).trim();
    // Filesystem  Size  Used Avail Use% Mounted on
    const parts = output.split(/\s+/);
    const size = parseInt(parts[1].replace('G', ''), 10);
    const used = parseInt(parts[2].replace('G', ''), 10);
    const free = size - used;
    return { total: size, used, free };
  } catch (e) {
    return { total: 0, used: 0, free: 0 };
  }
}

function getPrivateIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

async function getSystemInfo() {
  let osName = '';
  try {
    osName =
      execSync('lsb_release -ds 2>/dev/null || cat /etc/os-release 2>/dev/null | head -1', {
        encoding: 'utf8'
      }).trim() || os.type();
  } catch {
    osName = os.type();
  }

  const hostname = os.hostname();
  const uptimeSeconds = os.uptime();
  const uptime = formatUptime(uptimeSeconds);

  const cpus = os.cpus() || [];
  const cpuModel = cpus[0] ? cpus[0].model : 'Unknown';
  const cpuCores = cpus.length || 1;
  const loadAvg = os.loadavg(); // [1m, 5m, 15m]
  const cpuUsage = Math.round(((loadAvg[0] / cpuCores) * 100 + Number.EPSILON) * 10) / 10;

  const totalMemMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeMemMb = Math.round(os.freemem() / 1024 / 1024);
  const usedMemMb = totalMemMb - freeMemMb;

  const disk = getDiskInfo();
  const privateIp = getPrivateIp();

  return {
    os: osName,
    hostname,
    uptime,
    cpu: {
      model: cpuModel,
      cores: cpuCores,
      usage: cpuUsage
    },
    ram: {
      total: totalMemMb,
      used: usedMemMb,
      free: freeMemMb
    },
    disk,
    ip: {
      public: null, // can be filled later using an external service if desired
      private: privateIp
    },
    loadAvg
  };
}

module.exports = {
  getSystemInfo
};

