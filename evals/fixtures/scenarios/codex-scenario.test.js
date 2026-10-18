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

test('WhenFeatureCompletes_ShouldScoreOnlyExternalTestsAndRecordInstalledBaseline', async () => {
  const { runScenario } = require('./codex-scenario');
  for (const mode of ['pass', 'suite-fail', 'wrong-result', 'git-error']) {
    const commands = [];
    let modelOptions;
    const result = await runScenario(input, {
      runCommand: (command, args, cwd) => {
        commands.push({ command, args, cwd });
        if (command === 'git' && args[0] === 'rev-parse') return success('setup-head\n');
        if (command === 'git' && args[0] === 'diff') return success('AGENTS.md\n.agents/skills/tdd-workflow/SKILL.md\n');
        if (command === 'git' && args[0] === 'status' && mode === 'git-error') return { ok: false, error: 'git error' };
        if (command === 'git' && args[0] === 'rev-list') return success('1\n');
        if (command === 'go' && args[0] === 'test') return { ...success(), ok: mode !== 'suite-fail', exitCode: mode === 'suite-fail' ? 1 : 0 };
        if (command === 'go' && args[0] === 'run') {
          const [left, right] = args.slice(-2).map(Number);
          return success(`${mode === 'wrong-result' ? 999 : left - right}\n`);
        }
        return success();
      },
      runCodex: async (_cwd, _prompt, options) => {
        modelOptions = options;
        return completedRun();
      },
    });
    assert.equal(result.summary.infrastructure.ok, mode !== 'git-error');
    assert.equal(result.summary.behavior.passed, mode === 'pass');
    assert.equal(result.summary.behavior.testsPassed, mode !== 'suite-fail');
    assert.equal(result.summary.protocol.phaseOrderVerified, null);
    assert.equal(result.summary.evidence.agentMessagesAreTestEvidence, false);
    assert.equal(modelOptions.model, 'selected-model');
    assert.equal(result.artifacts.setupBaselineHead, 'setup-head');
    assert.deepEqual(result.artifacts.setupFiles, ['AGENTS.md', '.agents/skills/tdd-workflow/SKILL.md']);
    const installer = commands.find(({ command }) => command === 'bash');
    assert.match(installer.args[0], /scripts\/install-tdd-harness.sh$/);
    assert.deepEqual(installer.args.slice(1), ['--agent', 'codex', '/workspace']);
    assert.equal(commands.every(({ cwd }) => cwd === '/workspace'), true);
    if (mode !== 'git-error') {
      assert.ok(commands.find(({ command, args }) => command === 'git' && args[0] === 'rev-list' && args.at(-1) === 'setup-head..HEAD'));
    }
    assert.equal(result.artifacts.verification.filter(({ command, args }) => command === 'go' && args[0] === 'run').length, 3);
    if (mode === 'pass') assert.equal(result.summary.worktreeClean, true);
  }
});

test('WhenClarificationIsRequested_ShouldRequireQuestionAndNoPostSetupChanges', async () => {
  const { runScenario } = require('./codex-scenario');
  for (const mode of ['question', 'no-question', 'dirty', 'commit']) {
    const commands = [];
    const result = await runScenario({ ...input, scenarioFamily: 'clarification' }, {
      runCommand: (command, args) => {
        commands.push([command, args]);
        if (args[0] === 'rev-parse') return success('setup-head\n');
        if (args[0] === 'status') return success(mode === 'dirty' ? ' M main.go\n' : '');
        if (args[0] === 'rev-list') return success(mode === 'commit' ? '1\n' : '0\n');
        return success();
      },
      runCodex: async () => completedRun({
        agentMessages: mode === 'no-question' ? ['I implemented subtract.'] : ['Which arithmetic operation should I implement?'],
      }),
    });
    assert.equal(result.summary.infrastructure.ok, true);
    assert.equal(result.summary.behavior.passed, mode === 'question');
    assert.equal(result.summary.clarificationAsked, mode !== 'no-question');
    assert.equal(result.summary.clarificationResolved, false);
    assert.equal(result.summary.protocol.phaseOrderVerified, null);
    assert.equal(commands.filter(([command, args]) => command === 'go' && args[0] === 'run').length, 0);
    assert.equal(result.summary.evidence.clarificationDetection, 'agent-message question heuristic');
  }
});
