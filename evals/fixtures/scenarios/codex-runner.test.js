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
