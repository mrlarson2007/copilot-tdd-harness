'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const input = {
  workspaceDir: '/workspace',
  initialHead: 'fixture-head',
  fixtureId: 'calculator-cli-go',
  baselineId: 'clean',
  scenarioId: 'feature-add-subtract-command',
  scenarioFamily: 'feature',
  prompt: 'Use $tdd-workflow to add subtract.',
  vars: { model: 'selected-model' },
};

function success(stdout = '') {
  return { ok: true, exitCode: 0, stdout, stderr: '', infrastructureError: false };
}

function completedRun(overrides = {}) {
  return {
    ok: true, runtime: 'codex', model: 'selected-model', events: [],
    agentMessages: ['Tests passed; RED then GREEN complete.'],
    stdout: '', stderr: '', usage: [], commandExecutions: [], durationMs: 10,
    ...overrides,
  };
}

test('WhenScenarioInfrastructureFails_ShouldFailClosedAndRetainEvidenceWithoutProtocolClaims', async () => {
  const { runScenario } = require('./codex-scenario');
  for (const failure of ['workspace', 'setup', 'baseline', 'runner', 'tests']) {
    const commands = [];
    const result = await runScenario({ ...input, workspaceDir: failure === 'workspace' ? null : input.workspaceDir }, {
      runCommand: (command, args) => {
        commands.push([command, args]);
        if ((failure === 'setup' && command === 'bash') ||
            (failure === 'baseline' && command === 'git') ||
            (failure === 'tests' && command === 'go')) {
          return { ok: false, infrastructureError: true, error: 'missing dependency', stderr: 'diagnostic' };
        }
        return success(command === 'git' && args[0] === 'rev-parse' ? 'setup-head\n' : '');
      },
      runCodex: async () => completedRun(failure === 'runner' ? { ok: false, error: 'authentication failed' } : {}),
    });
    assert.equal(result.summary.infrastructure.ok, false);
    assert.equal(result.summary.behavior.passed, false);
    assert.equal(result.summary.runtime, 'codex');
    assert.equal(result.summary.protocol.phaseOrderVerified, null);
    assert.equal(result.summary.protocol.redVerified, null);
    assert.equal(result.summary.protocol.greenVerified, null);
    assert.deepEqual(result.summary.phaseTransitions, []);
    assert.ok(result.artifacts);
    if (failure === 'runner') {
      assert.equal(result.artifacts.runner.error, 'authentication failed');
      assert.equal(commands.some(([command]) => command === 'go'), false);
    }
  }
});
