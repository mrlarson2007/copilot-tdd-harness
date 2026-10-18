'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

function mockProcess(onStart) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = new EventEmitter();
  child.stdin.end = (prompt) => { child.prompt = prompt; };
  child.kills = [];
  child.kill = (signal) => { child.kills.push(signal); };
  process.nextTick(() => onStart(child));
  return child;
}

test('WhenCodexCannotLaunch_ShouldReturnInfrastructureFailure', async () => {
  const { runCodex } = require('./codex-runner');
  for (const throws of [false, true]) {
    const result = await runCodex('/workspace', 'task', {
      spawn: () => {
        if (throws) throw new Error('ENOENT');
        return mockProcess((child) => child.emit('error', new Error('ENOENT')));
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.runtime, 'codex');
    assert.match(result.error, /ENOENT/);
  }
});

test('WhenCliFailsOrOmitsCompletion_ShouldFailClosedWithSeparateDiagnostics', async () => {
  const { runCodex } = require('./codex-runner');
  for (const [stdout, exitCode, error] of [
    ['{"type":"turn.completed"}\n', 2, /exit.*2/i],
    ['', 0, /completion/i],
    ['{"type":"turn.failed","error":{"message":"not authenticated"}}\n', 0, /not authenticated/],
    ['{"type":"error","message":"invalid model"}\n{"type":"turn.completed"}\n', 0, /invalid model/],
    ['not json\n', 0, /JSON/i],
    ['null\n', 0, /event/i],
  ]) {
    const result = await runCodex('/workspace', 'task', {
      spawn: () => mockProcess((child) => {
        child.stdout.emit('data', Buffer.from(stdout));
        child.stderr.emit('data', Buffer.from('diagnostic'));
        child.emit('close', exitCode);
      }),
    });
    assert.equal(result.ok, false);
    assert.match(result.error, error);
    assert.equal(result.stdout, stdout);
    assert.equal(result.stderr, 'diagnostic');
    assert.equal(result.exitCode, exitCode);
  }
});

test('WhenEventsAreFragmented_ShouldCaptureSuccessfulRunUsingSafeModelArguments', async () => {
  const { runCodex } = require('./codex-runner');
  const prompt = '--dangerously-bypass-approvals-and-sandbox $(touch unsafe)';
  const events = [
    { type: 'thread.started', thread_id: 'thread' },
    { type: 'item.completed', item: { type: 'agent_message', text: 'Done ✓' } },
    { type: 'item.completed', item: { type: 'command_execution', command: 'go test ./...', exit_code: 0 } },
    { type: 'turn.completed', usage: { input_tokens: 12, output_tokens: 4 } },
  ];
  const stdout = events.map(JSON.stringify).join('\n');
  for (const [model, env, selected] of [
    ['explicit model', { EVAL_MODEL: 'fallback' }, 'explicit model'],
    [undefined, { EVAL_MODEL: 'fallback' }, 'fallback'],
    [undefined, {}, null],
  ]) {
    let invocation;
    let child;
    const result = await runCodex('/workspace', prompt, {
      model, env,
      spawn: (command, args, options) => {
        invocation = { command, args, options };
        child = mockProcess((proc) => {
          const bytes = Buffer.from(stdout);
          for (let i = 0; i < bytes.length; i += 2) proc.stdout.emit('data', bytes.subarray(i, i + 2));
          proc.stderr.emit('data', Buffer.from('diagnostic'));
          proc.emit('close', 0);
        });
        return child;
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.model, selected);
    assert.equal(result.stdout, stdout);
    assert.deepEqual(result.events, events);
    assert.deepEqual(result.agentMessages, ['Done ✓']);
    assert.deepEqual(result.commandExecutions, [events[2].item]);
    assert.deepEqual(result.usage, [events[3].usage]);
    assert.equal(typeof result.durationMs, 'number');
    assert.equal(invocation.command, 'codex');
    assert.deepEqual(invocation.args, [
      'exec', '--json', '--sandbox', 'workspace-write',
      ...(selected ? ['--model', selected] : []), '-',
    ]);
    assert.equal(invocation.options.shell, false);
    assert.equal(invocation.options.cwd, '/workspace');
    assert.deepEqual(invocation.options.stdio, ['pipe', 'pipe', 'pipe']);
    assert.equal(child.prompt, prompt);
    assert.deepEqual(child.kills, []);
  }
});

test('WhenRuntimeOrOutputExceedsLimit_ShouldKillChildAndReturnBoundedFailure', async () => {
  const { runCodex } = require('./codex-runner');
  for (const mode of ['timeout', 'stdout', 'stderr', 'stdin']) {
    let child;
    const result = await runCodex('/workspace', 'task', {
      timeoutMs: 10,
      maxOutputBytes: 64,
      spawn: () => {
        child = mockProcess((proc) => {
          if (mode === 'stdout' || mode === 'stderr') proc[mode].emit('data', Buffer.alloc(1000, 'x'));
          if (mode === 'stdin') proc.stdin.emit('error', new Error('EPIPE'));
        });
        return child;
      },
    });
    assert.equal(result.ok, false);
    assert.match(result.error, mode === 'timeout' ? /timeout/i : mode === 'stdin' ? /EPIPE/ : /output limit/i);
    assert.ok(Buffer.byteLength(result.stdout + result.stderr) <= 64);
    assert.deepEqual(child.kills, ['SIGKILL']);
    child.emit('close', 0);
    child.stdout.emit('data', Buffer.from('ignored'));
    assert.ok(Buffer.byteLength(result.stdout + result.stderr) <= 64);
  }
});
