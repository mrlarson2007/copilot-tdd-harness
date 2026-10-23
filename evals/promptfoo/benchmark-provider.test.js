'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const BenchmarkProvider = require('./benchmark-provider');

test('the Jev experiment retains evidence and its workspace if artifact persistence fails', async (t) => {
	const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-persistence-test-'));
	t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
	const blocker = path.join(temp, 'not-a-directory');
	fs.writeFileSync(blocker, 'simulate an invalid artifact output directory');
	const original = process.env.TDD_JEV_ALLOW_PUBLIC_FIXTURE_UPLOAD;
	delete process.env.TDD_JEV_ALLOW_PUBLIC_FIXTURE_UPLOAD;
	t.after(() => {
		if (original === undefined) delete process.env.TDD_JEV_ALLOW_PUBLIC_FIXTURE_UPLOAD;
		else process.env.TDD_JEV_ALLOW_PUBLIC_FIXTURE_UPLOAD = original;
	});
	const result = await new BenchmarkProvider().callApi('record Jev output', { vars: {
		fixtureId: 'calculator-cli-go',
		scenarioId: 'jev-phase-subtract',
		fixtureSourcePath: '../fixtures/projects/calculator-cli-go/clean',
		scenarioModulePath: '../fixtures/scenarios/calculator-cli-go/jev-phase-experiment.js',
		artifactOutputDir: blocker,
		preserveWorkspaceOnArtifactFailure: true,
	} });
	t.after(() => fs.rmSync(result.metadata.retainedWorkspace.tempRoot, { recursive: true, force: true }));
	assert.equal(result.output.status, 'artifact-persistence-failed');
	assert.equal(result.output.executionStatus, 'unavailable');
	assert.equal(result.metadata.workspaceDisposed, false);
	assert.equal(result.metadata.artifactPersistenceError.code, 'ENOTDIR');
	assert.equal(fs.existsSync(result.metadata.retainedWorkspace.workspaceDir), true);
	const recovery = JSON.parse(fs.readFileSync(result.metadata.recoveryFilePath, 'utf8'));
	assert.equal(recovery.summary.phases.red.status, 'not-run');
	assert.match(recovery.artifacts.reason, /UPLOAD/);
});
