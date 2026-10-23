'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { appendSubtractTest, addSubtractImplementation } = require('./scenario-helpers');
const { runExperiment } = require('./jev-phase-experiment');

function workspace(t) {
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
	return { dir, git };
}

test('captures each real phase boundary and records Jev outputs rather than inferring phases from commits', async (t) => {
	const { dir, git } = workspace(t);
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
			const contract = phase === 'refactor' ? 'cycle_result' : `${phase}_result`;
			return { ok: true, exitCode: 0, output: `<phase_result>{"contract":"${contract}","phase":"${phase}","status":"ok"}</phase_result>` };
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

test('fixture verification cannot read the Jev API credential from its environment', async (t) => {
	const { dir } = workspace(t);
	const original = process.env.TYPESAFE_API_KEY;
	process.env.TYPESAFE_API_KEY = 'synthetic-service-credential';
	t.after(() => {
		if (original === undefined) delete process.env.TYPESAFE_API_KEY;
		else process.env.TYPESAFE_API_KEY = original;
	});
	const result = await runExperiment({ workspaceDir: dir, fixtureId: 'calculator-cli-go' }, {
		runAgent: async () => {
			appendSubtractTest(dir);
			fs.writeFileSync(path.join(dir, 'env_test.go'), `package main
import ("fmt"; "os")
func init() { fmt.Println("fixture environment: " + os.Getenv("TYPESAFE_API_KEY")) }
`);
			return { ok: true, exitCode: 0, output: '<phase_result>{"contract":"red_result","status":"escalate"}</phase_result>' };
		},
		judge: async () => ({ status: 'scored', response: {} }),
	});
	assert.equal(JSON.stringify(result).includes('synthetic-service-credential'), false);
});

test('records an escalated RED result but never transitions into GREEN', async (t) => {
	const { dir } = workspace(t);
	let calls = 0;
	const result = await runExperiment({ workspaceDir: dir, fixtureId: 'calculator-cli-go' }, {
		runAgent: async () => {
			if (++calls === 1) appendSubtractTest(dir);
			return { ok: true, exitCode: 0, output: '<phase_result>{"contract":"red_result","status":"escalate"}</phase_result>' };
		},
		judge: async () => ({ status: 'scored', response: {} }),
	});
	assert.equal(calls, 1);
	assert.equal(result.summary.status, 'phase-failed');
	assert.equal(result.summary.phases.red.status, 'scored');
	assert.equal(result.summary.phases.green.status, 'not-run');
	assert.equal(result.artifacts.phases[0].evidence.phaseResult.status, 'escalate');
});

test('a failing GREEN verification never advances to COMMIT or REFACTOR despite a claimed success', async (t) => {
	const { dir } = workspace(t);
	const calls = [];
	const result = await runExperiment({ workspaceDir: dir, fixtureId: 'calculator-cli-go' }, {
		runAgent: async (_dir, _prompt, options) => {
			const phase = options.progressLabel.replace('jev-', '');
			calls.push(phase);
			if (phase === 'red') appendSubtractTest(dir);
			return { ok: true, exitCode: 0,
				output: `<phase_result>{"contract":"${phase}_result","status":"ok"}</phase_result>` };
		},
		judge: async () => ({ status: 'scored', response: {} }),
	});
	assert.deepEqual(calls, ['red', 'green']);
	assert.equal(result.summary.status, 'phase-failed');
	assert.equal(result.summary.phases.commit.status, 'not-run');
	assert.equal(result.artifacts.phases[1].evidence.testResults[0].exitCode, 1);
});

test('collection-only mode checkpoints phase evidence without calling Jev or needing its key', async (t) => {
	const { dir, git } = workspace(t);
	const captured = [];
	const result = await runExperiment({ workspaceDir: dir, fixtureId: 'calculator-cli-go' }, {
		collectOnly: true,
		onRecord: (record) => captured.push(record),
		judge: async () => { throw new Error('Collection must never invoke the scorer'); },
		runAgent: async (_dir, _prompt, options) => {
			const phase = options.progressLabel.replace('jev-', '');
			if (phase === 'red') appendSubtractTest(dir);
			if (phase === 'green') addSubtractImplementation(dir);
			if (phase === 'commit') {
				git('add', 'main.go', 'main_test.go');
				git('commit', '--quiet', '-m', 'Add subtract command');
			}
			return { ok: true, exitCode: 0, output: `<phase_result>${JSON.stringify({
				contract: phase === 'refactor' ? 'cycle_result' : `${phase}_result`, status: 'ok',
			})}</phase_result>` };
		},
	});
	assert.equal(result.summary.status, 'collected');
	assert.equal(captured.length, 4);
	assert.ok(captured.every((record) => record.judgment.status === 'pending-scoring'));
	assert.equal(captured[0].evidence.testResults[0].exitCode, 1);
});
