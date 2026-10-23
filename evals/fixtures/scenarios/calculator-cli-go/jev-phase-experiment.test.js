'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { appendSubtractTest, addSubtractImplementation } = require('./scenario-helpers');
const { runExperiment } = require('./jev-phase-experiment');

test('captures each real phase boundary and records Jev outputs rather than inferring phases from commits', async (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-phase-test-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	fs.cpSync(path.resolve(__dirname, '../../projects/calculator-cli-go/clean'), dir, { recursive: true });
	const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
	git('init', '--quiet');
	git('config', 'user.name', 'eval-test');
	git('config', 'user.email', 'eval-test@local.invalid');
	git('config', 'commit.gpgsign', 'false');
	git('add', '.');
	git('commit', '--quiet', '-m', 'baseline');
	const calls = [];
	const judged = [];
	const result = await runExperiment({
		workspaceDir: dir, fixtureId: 'calculator-cli-go', scenarioId: 'jev-phases',
		initialHead: git('rev-parse', 'HEAD'),
	}, {
		runAgent: async (_dir, prompt, options) => {
			const phase = options.progressLabel.replace('jev-', '');
			calls.push(phase);
			assert.match(prompt, new RegExp(`tdd-${phase}/SKILL.md`));
			if (phase === 'red') appendSubtractTest(dir);
			if (phase === 'green') addSubtractImplementation(dir);
			if (phase === 'commit') {
				git('add', 'main.go', 'main_test.go');
				git('commit', '--quiet', '-m', 'Add subtract command');
			}
			return { ok: true, exitCode: 0, output: `<phase_result>{"phase":"${phase}","status":"ok"}</phase_result>` };
		},
		judge: async ({ phase, evidence }) => {
			judged.push({ phase, evidence });
			return { phase, status: 'scored', response: { model: 'fake-jev', answers: { synthetic: true } } };
		},
	});
	assert.deepEqual(calls, ['red', 'green', 'commit', 'refactor']);
	assert.deepEqual(judged.map(({ phase }) => phase), calls);
	assert.equal(judged[0].evidence.testResults[0].exitCode, 1);
	assert.equal(judged[1].evidence.testResults[0].exitCode, 0);
	assert.equal(judged[2].evidence.commits.length, 1);
	assert.match(judged[1].evidence.diff.output, /subtract/);
	assert.match(judged[0].evidence.after.tests['main_test.go'], /TestSubtract/);
	assert.equal(judged[1].evidence.phaseResult.phase, 'green');
	assert.equal(result.summary.phases.red.response.model, 'fake-jev');
	assert.equal(result.summary.status, 'complete');
	assert.equal('pass' in result.summary, false);
	assert.equal(result.artifacts.phases.length, 4);
});
