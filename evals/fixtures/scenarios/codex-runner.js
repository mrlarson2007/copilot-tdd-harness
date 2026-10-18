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
    let pending = '';
    let error = null;
    let settled = false;
    let timer;
    let child;
    let outputBytes = 0;
    const maxOutputBytes = options.maxOutputBytes ?? 4 * 1024 * 1024;
    const parseLine = (line) => {
      if (!line.trim()) return;
      try {
        const event = JSON.parse(line);
        if (!event || typeof event.type !== 'string') {
          error ||= 'Invalid event';
          return;
        }
        events.push(event);
        if (event.type === 'turn.failed' || event.type === 'error') {
          error ||= event.error?.message || event.message || event.type;
        }
      } catch {
        error ||= 'Malformed JSON event';
      }
    };
    const finish = (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
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
    const stop = (message) => {
      if (settled) return;
      error ||= message;
      if (child) {
        try {
          if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
          else child.kill('SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }
      finish(null);
    };
    const collect = (stream, chunk) => {
      if (settled) return;
      const bytes = Buffer.from(chunk);
      const remaining = Math.max(0, maxOutputBytes - outputBytes);
      const bounded = bytes.subarray(0, remaining);
      outputBytes += bounded.length;
      if (stream === 'stdout') {
        const text = decoder.write(bounded);
        stdout += text;
        pending += text;
        const lines = pending.split('\n');
        pending = lines.pop();
        for (const line of lines) parseLine(line);
      } else stderr += bounded.toString();
      if (bytes.length > remaining) stop('Codex output limit exceeded');
    };
    try {
      child = (options.spawn || spawn)('codex', [
        'exec', '--json', '--sandbox', 'workspace-write',
        ...(model ? ['--model', model] : []), '-',
      ], {
        cwd: workspaceDir,
        shell: false,
        detached: process.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (chunk) => collect('stdout', chunk));
      child.stderr.on('data', (chunk) => collect('stderr', chunk));
      child.on('close', (code) => {
        if (settled) return;
        const tail = decoder.end();
        stdout += tail;
        parseLine(pending + tail);
        finish(code);
      });
      child.on('error', (cause) => stop(cause.message));
      child.stdin.on('error', (cause) => stop(cause.message));
      timer = setTimeout(() => stop('Codex timeout exceeded'), options.timeoutMs ?? 10 * 60 * 1000);
      child.stdin.end(prompt);
    } catch (cause) {
      stop(cause.message);
    }
  });
}

module.exports = { runCodex };
