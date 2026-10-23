'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeBundle, readBundle } = require('./jev-evidence');

const revision = 'a'.repeat(40);
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
