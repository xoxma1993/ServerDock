const { execFile, execFileSync, spawn } = require('child_process');
const util = require('util');

const execFileAsync = util.promisify(execFile);

function listProcesses() {
  return execFileAsync('pm2', ['jlist'])
    .then(({ stdout }) => {
      try {
        const list = JSON.parse(stdout);
        return list.map((p) => {
          const m = p.monit || {};
          const pm2Env = p.pm2_env || {};
          return {
            name: pm2Env.name,
            script: pm2Env.pm_exec_path,
            status: pm2Env.status,
            cpu: m.cpu,
            memory: m.memory,
            uptime: pm2Env.pm_uptime,
            restarts: pm2Env.restart_time
          };
        });
      } catch (e) {
        throw new Error('Failed to parse PM2 output');
      }
    });
}

function runPm2Command(args) {
  return execFileAsync('pm2', args).then(({ stdout, stderr }) => stdout || stderr);
}

function startProcess({ name, script, cwd, args = [], envVars = {}, instances = 1, watch = false }) {
  const parts = ['start', script, '--name', name];
  if (cwd) {
    parts.push('--cwd', cwd);
  }
  if (args && args.length) {
    parts.push('--', ...args);
  }
  if (instances && instances > 1) {
    parts.push('-i', String(instances));
  }
  if (watch) {
    parts.push('--watch');
  }
  if (envVars && Object.keys(envVars).length) {
    const envStr = Object.entries(envVars)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    parts.push(`--env`, `"${envStr}"`);
  }
  return runPm2Command(parts);
}

function deleteProcess(name) {
  return runPm2Command(['delete', name]);
}

function restartProcess(name) {
  return runPm2Command(['restart', name]);
}

function stopProcess(name) {
  return runPm2Command(['stop', name]);
}

function startExistingProcess(name) {
  return runPm2Command(['start', name]);
}

async function getLogs(name, lines = 100) {
  try {
    const { stdout } = await execFileAsync('pm2', ['logs', name, '--lines', String(lines), '--raw', '--nostream']);
    return stdout;
  } catch (err) {
    throw new Error(err.message || 'Failed to get logs');
  }
}

function streamLogsSSE({ name, lines = 100, res }) {
  const cmd = 'pm2';
  const cmdArgs = ['logs', name, '--lines', String(lines), '--raw'];

  const child = spawn(cmd, cmdArgs);

  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  child.stdout.on('data', (chunk) => {
    send({ type: 'stdout', text: chunk.toString() });
  });

  child.stderr.on('data', (chunk) => {
    send({ type: 'stderr', text: chunk.toString() });
  });

  child.on('error', (err) => {
    send({ type: 'error', message: err.message || 'Failed to start pm2 logs' });
  });

  child.on('close', (code) => {
    send({ type: 'done', success: code === 0, code });
    res.end();
  });

  res.on('close', () => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  });
}

module.exports = {
  listProcesses,
  startProcess,
  deleteProcess,
  restartProcess,
  stopProcess,
  startExistingProcess,
  getLogs,
  streamLogsSSE
};

