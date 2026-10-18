'use strict';

const { spawn } = require('node:child_process');

function runCodex(workspaceDir, prompt, options = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const events = [];
    let error = null;
    const finish = (exitCode) => {
      const completed = events.some((event) => event.type === 'turn.completed');
      error ||= exitCode !== 0 ? `Codex exit code ${exitCode}` : null;
      error ||= completed ? null : 'Missing completion event';
      resolve({ ok: !error, runtime: 'codex', error, stdout, stderr, events, exitCode });
    };
    try {
      const child = (options.spawn || spawn)('codex', ['exec', '--json', '--sandbox', 'workspace-write', '-'], {
        cwd: workspaceDir,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('close', (code) => {
        for (const line of stdout.split('\n').filter((line) => line.trim())) {
          try {
            const event = JSON.parse(line);
            if (!event || typeof event.type !== 'string') {
              error ||= 'Invalid event';
              continue;
            }
            events.push(event);
            if (event.type === 'turn.failed' || event.type === 'error') {
              error ||= event.error?.message || event.message || event.type;
            }
          } catch {
            error ||= 'Malformed JSON event';
          }
        }
        finish(code);
      });
      child.on('error', (cause) => { error ||= cause.message; finish(null); });
      child.stdin.end(prompt);
    } catch (cause) {
      error = cause.message;
      finish(null);
    }
  });
}

module.exports = { runCodex };
