'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeBundle, readBundle } = require('./jev-evidence');
const JevEvidenceProvider = require('./jev-evidence-provider');
const { collect } = require('./jev-collect');
const { appendSubtractTest, addSubtractImplementation } = require('../fixtures/scenarios/calculator-cli-go/scenario-helpers');
const { execFileSync } = require('node:child_process');

const revision = process.env.GITHUB_SHA || 'a'.repeat(40);
const phases = ['red', 'green', 'commit', 'refactor'];

function bundle(status = 'collected') {
	return {
		schemaVersion: 1, revision, fixtureId: 'calculator-cli-go',
		scenarioId: 'jev-phase-subtract', status,
		records: phases.map((phase) => ({ phase, evidence: {
			fixtureId: 'calculator-cli-go', phase, scenario: 'subtract 9 4 prints 5',
			before: {}, after: {}, afterVerification: {},
			testResults: [{ command: ['go', 'test'], exitCode: phase === 'red' ? 1 : 0, output: 'test evidence' }],
			phaseResult: { contract: phase === 'refactor' ? 'cycle_result' : `${phase}_result`, status: 'ok' },
			commits: [], diff: {}, cycleDiff: {}, priorPhases: [],
		} })),
	};
}

function file(t) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-recorded-test-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	return path.join(dir, 'evidence.json');
}

test('the artifact boundary redacts credentials and reads only bounded JSON for the reviewed revision', (t) => {
	const target = file(t);
	const original = bundle();
	original.records[0].evidence.testResults[0].output = 'synthetic-secret-value';
	writeBundle(target, original, ['synthetic-secret-value']);
	const result = readBundle(target, revision);
	assert.equal(result.records.length, 4);
	assert.equal(result.records[0].evidence.testResults[0].output, '[REDACTED]');
	assert.equal(fs.statSync(target).mode & 0o777, 0o600);
	assert.throws(() => readBundle(target, 'b'.repeat(40)), /revision/);
});

test('recorded scoring submits only captured evidence and preserves raw Jev outputs without running fixture code', async (t) => {
	const target = file(t);
	const source = bundle();
	source.records[0].evidence.after.tests = { 'dangerous_test.go': 'panic("must never execute")' };
	writeBundle(target, source);
	const calls = [];
	const provider = new JevEvidenceProvider({ judge: async (request) => {
		calls.push(request);
		return { phase: request.phase, status: 'scored', response: { model: 'synthetic-jev', answers: {} } };
	} });
	const result = await provider.callApi('', { vars: { evidenceFilePath: target, reviewedRevision: revision } });
	assert.deepEqual(calls.map(({ phase }) => phase), phases);
	assert.equal(calls[0].evidence.after.tests['dangerous_test.go'], 'panic("must never execute")');
	assert.equal(result.output.status, 'complete');
	assert.equal(result.output.phases.red.response.model, 'synthetic-jev');
	assert.equal('pass' in result.output, false);
});

test('the standalone collector creates a redacted four-phase artifact without a scorer or TypeSafe key', async (t) => {
	const target = file(t);
	const savedKey = process.env.TYPESAFE_API_KEY;
	const savedToken = process.env.COPILOT_GITHUB_TOKEN;
	delete process.env.TYPESAFE_API_KEY;
	process.env.COPILOT_GITHUB_TOKEN = 'synthetic-collection-token';
	t.after(() => {
		if (savedKey === undefined) delete process.env.TYPESAFE_API_KEY;
		else process.env.TYPESAFE_API_KEY = savedKey;
		if (savedToken === undefined) delete process.env.COPILOT_GITHUB_TOKEN;
		else process.env.COPILOT_GITHUB_TOKEN = savedToken;
	});
	const status = await collect(target, { runAgent: async (dir, _prompt, options) => {
		const phase = options.progressLabel.replace('jev-', '');
		if (phase === 'red') appendSubtractTest(dir);
		if (phase === 'green') addSubtractImplementation(dir);
		if (phase === 'commit') {
			const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
			git('add', 'main.go', 'main_test.go');
			git('commit', '--quiet', '-m', 'Add subtract command');
		}
		return { ok: true, exitCode: 0, output: `<phase_result>${JSON.stringify({
			contract: phase === 'refactor' ? 'cycle_result' : `${phase}_result`,
			status: 'ok', notes: ['synthetic-collection-token'],
		})}</phase_result>` };
	} });
	assert.equal(status, 'collected');
	const artifact = readBundle(target, process.env.GITHUB_SHA);
	assert.equal(artifact.records.length, 4);
	assert.equal(artifact.records[0].evidence.phaseResult.notes[0], '[REDACTED]');
	assert.equal('agent' in artifact.records[0], false);
	assert.equal('judgment' in artifact.records[0], false);
});

test('recorded scoring rejects malformed, oversized, symlinked, reordered, and incomplete evidence before judging', async (t) => {
	const target = file(t);
	let calls = 0;
	const provider = new JevEvidenceProvider({ judge: async () => { calls++; } });
	for (const value of [
		'not JSON',
		JSON.stringify({ ...bundle(), revision: 'not-a-sha' }),
		JSON.stringify({ ...bundle(), records: [] }),
		JSON.stringify({ ...bundle(), records: bundle().records.reverse() }),
		' '.repeat(5 * 1024 * 1024 + 1),
	]) {
		fs.writeFileSync(target, value);
		await assert.rejects(() => provider.callApi('', { vars: { evidenceFilePath: target } }));
	}
	fs.writeFileSync(target, JSON.stringify(bundle()));
	const link = `${target}.link`;
	fs.symlinkSync(target, link);
	await assert.rejects(() => provider.callApi('', { vars: { evidenceFilePath: link } }), /regular JSON/);
	assert.equal(calls, 0);
});

test('a Jev service failure remains incomplete rather than a successful recording', async (t) => {
	const target = file(t);
	writeBundle(target, bundle());
	const provider = new JevEvidenceProvider({ judge: async ({ phase }) => ({
		phase, status: 'unavailable', response: null,
	}) });
	const result = await provider.callApi('', { vars: { evidenceFilePath: target } });
	assert.equal(result.output.status, 'incomplete');
	assert.equal(result.output.phases.red.response, null);
});
