'use strict';

const { spawn } = require('node:child_process');

function runCodex(workspaceDir, prompt, options = {}) {
  return new Promise((resolve) => {
    const fail = (error) => resolve({ ok: false, runtime: 'codex', error: error.message });
    try {
      const child = (options.spawn || spawn)('codex', ['exec', '--json', '--sandbox', 'workspace-write', '-'], {
        cwd: workspaceDir,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.on('error', fail);
      child.stdin.end(prompt);
    } catch (error) {
      fail(error);
    }
  });
}

module.exports = { runCodex };
