'use strict';

const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');

function runCodex(workspaceDir, prompt, options = {}) {
  const model = options.model || (options.env || process.env).EVAL_MODEL || null;
  const startedAt = Date.now();
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const events = [];
    const decoder = new StringDecoder('utf8');
    let error = null;
    const finish = (exitCode) => {
      const completed = events.some((event) => event.type === 'turn.completed');
      error ||= exitCode !== 0 ? `Codex exit code ${exitCode}` : null;
      error ||= completed ? null : 'Missing completion event';
      resolve({
        ok: !error, runtime: 'codex', model, error, stdout, stderr, events, exitCode,
        durationMs: Date.now() - startedAt,
        agentMessages: events.filter((event) => event.type === 'item.completed' && event.item?.type === 'agent_message').map((event) => event.item.text),
        commandExecutions: events.filter((event) => event.type === 'item.completed' && event.item?.type === 'command_execution').map((event) => event.item),
        usage: events.filter((event) => event.type === 'turn.completed' && event.usage).map((event) => event.usage),
      });
    };
    try {
      const child = (options.spawn || spawn)('codex', [
        'exec', '--json', '--sandbox', 'workspace-write',
        ...(model ? ['--model', model] : []), '-',
      ], {
        cwd: workspaceDir,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (chunk) => { stdout += decoder.write(chunk); });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('close', (code) => {
        stdout += decoder.end();
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
