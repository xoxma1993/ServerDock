const { spawn } = require('child_process');

// Allowed base commands (first word only)
const ALLOWED_CMDS = new Set([
  'apt',
  'apt-get',
  'nginx',
  'pm2',
  'certbot',
  'systemctl',
  'node',
  'npm',
  'psql',
  'mysql'
]);

// Very strict check: disallow obvious shell metacharacters and pipes/redirection
const FORBIDDEN_PATTERN = /[;&|`$<>]/;

function validateCommand(cmd, args = []) {
  if (!cmd || typeof cmd !== 'string') {
    throw new Error('Command must be a non-empty string');
  }

  const base = cmd.split(/\s+/)[0];
  if (!ALLOWED_CMDS.has(base)) {
    throw new Error(`Command "${base}" is not allowed`);
  }

  const allParts = [cmd, ...args.map(String)];
  for (const part of allParts) {
    if (FORBIDDEN_PATTERN.test(part)) {
      throw new Error(`Forbidden characters in command arguments: "${part}"`);
    }
  }
}

/**
 * Spawn a long-running command and stream output via SSE.
 * @param {object} options
 * @param {string} options.cmd - base command, e.g. "apt-get"
 * @param {string[]} options.args - arguments array
 * @param {object} options.res - Express response configured for SSE
 */
function runCommandSSE({ cmd, args = [], res }) {
  try {
    validateCommand(cmd, args);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
    return;
  }

  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

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
    send({ type: 'error', message: err.message || 'Failed to start process' });
  });

  child.on('close', (code) => {
    send({ type: 'done', success: code === 0, code });
    res.end();
  });

  // Ensure connection closed if client disconnects
  res.on('close', () => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  });
}

module.exports = {
  runCommandSSE,
  validateCommand
};

