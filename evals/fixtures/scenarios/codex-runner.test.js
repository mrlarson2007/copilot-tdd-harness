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
