'use strict';

const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { runCodex } = require('./codex-runner');

const INSTALLER = path.resolve(__dirname, '../../../scripts/install-tdd-harness.sh');

function runCommand(command, args, cwd) {
  const startedAt = Date.now();
  try {
    const stdout = execFileSync(command, args, {
      cwd, encoding: 'utf8', shell: false, timeout: 120000,
      maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, exitCode: 0, stdout, stderr: '', infrastructureError: false, durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false, exitCode: error.status ?? null,
      stdout: String(error.stdout || ''), stderr: String(error.stderr || ''),
      error: error.message, infrastructureError: error.status == null,
      durationMs: Date.now() - startedAt,
    };
  }
}

async function runScenario(input, dependencies = {}) {
  const command = dependencies.runCommand || runCommand;
  const runner = dependencies.runCodex || runCodex;
  const artifacts = { setup: [], verification: [] };
  const summary = {
    schemaVersion: 'codex-eval/1',
    fixtureId: input.fixtureId, baselineId: input.baselineId,
    scenarioId: input.scenarioId, scenarioFamily: input.scenarioFamily,
    runMode: 'codex-exec', runtime: 'codex', prompt: input.prompt,
    infrastructure: { ok: false, error: null },
    behavior: { passed: false },
    protocol: { phaseOrderVerified: null, redVerified: null, greenVerified: null },
    phaseTransitions: [],
    evidence: {
      phaseFidelity: 'unsupported',
      agentMessagesAreTestEvidence: false,
      verification: 'external commands only',
    },
  };
  const fail = (error) => {
    summary.infrastructure.error = error;
    return { summary, artifacts };
  };
  if (!input.workspaceDir) return fail('Disposable workspace required');
  for (const [executable, args] of [
    ['bash', [INSTALLER, '--agent', 'codex', input.workspaceDir]],
    ['git', ['add', '--all']],
    ['git', ['commit', '--quiet', '--allow-empty', '-m', 'baseline:codex-harness']],
    ['git', ['rev-parse', 'HEAD']],
  ]) {
    const result = command(executable, args, input.workspaceDir);
    artifacts.setup.push({ command: executable, args, ...result });
    if (!result.ok) return fail(`Setup failed: ${result.error || result.stderr || executable}`);
    if (args[0] === 'rev-parse') artifacts.setupBaselineHead = result.stdout.trim();
  }
  const setupFiles = command('git', ['diff', '--name-only', `${input.initialHead}..${artifacts.setupBaselineHead}`], input.workspaceDir);
  artifacts.setup.push({ command: 'git', args: ['diff', '--name-only'], ...setupFiles });
  if (!setupFiles.ok) return fail('Cannot record setup baseline files');
  artifacts.setupFiles = setupFiles.stdout.trim().split('\n').filter(Boolean);
  artifacts.runner = await runner(input.workspaceDir, input.prompt, {
    model: input.vars?.model, timeoutMs: input.vars?.timeoutMs,
  });
  summary.model = artifacts.runner.model;
  if (!artifacts.runner.ok) return fail(`Codex failed: ${artifacts.runner.error}`);
  const tests = command('go', ['test', './...'], input.workspaceDir);
  artifacts.verification.push({ command: 'go', args: ['test', './...'], ...tests });
  if (tests.infrastructureError) return fail(`Verification failed: ${tests.error}`);
  summary.behavior.testsPassed = tests.ok;
  summary.behavior.functionalPassed = true;
  for (const [left, right] of [[9, 4], [4, 9], [-3, -4]]) {
    const args = ['run', '.', 'subtract', String(left), String(right)];
    const check = command('go', args, input.workspaceDir);
    artifacts.verification.push({ command: 'go', args, expected: String(left - right), ...check });
    if (check.infrastructureError) return fail(`Verification failed: ${check.error}`);
    summary.behavior.functionalPassed &&= check.ok && check.stdout.trim() === String(left - right);
  }
  for (const args of [
    ['status', '--porcelain'],
    ['rev-list', '--count', `${artifacts.setupBaselineHead}..HEAD`],
  ]) {
    const result = command('git', args, input.workspaceDir);
    artifacts.verification.push({ command: 'git', args, ...result });
    if (!result.ok) return fail(`Git inspection failed: ${result.error || result.stderr}`);
    if (args[0] === 'status') summary.worktreeClean = result.stdout.trim() === '';
    else summary.commitCount = Number(result.stdout.trim());
  }
  summary.infrastructure.ok = true;
  summary.behavior.passed = summary.behavior.testsPassed && summary.behavior.functionalPassed;
  return { summary, artifacts };
}

module.exports = { runScenario };
