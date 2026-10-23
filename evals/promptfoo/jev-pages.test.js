'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { questionsForPhase } = require('./jev-scorer');

const script = path.join(__dirname, 'jev-pages.js');
const phases = ['red', 'green', 'commit', 'refactor'];
const revision = 'a'.repeat(40);
const environment = {
	...process.env,
	GITHUB_REPOSITORY: 'example/reviewed-repo',
	GITHUB_SHA: revision,
	GITHUB_RUN_ID: '12345',
	GITHUB_RUN_ATTEMPT: '2',
	GITHUB_SERVER_URL: 'https://github.com',
	EVAL_TIMESTAMP: '2026-10-23T16:00:00.000Z',
};

function workspace(t) {
	const directory = fs.mkdtempSync(path.join(__dirname, '.jev-pages-test-'));
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
	return { directory, input: path.join(directory, 'input.json'), output: path.join(directory, 'site') };
}

function run(files, env = environment) {
	return spawnSync(process.execPath, [script, files.input, files.output], { env, encoding: 'utf8' });
}

test('WhenRecordedRowsAreMissingMalformedOrEmpty_ShouldRejectWithoutCreatingOutput', (t) => {
	const files = workspace(t);
	for (const input of [undefined, 'not JSON', 'null', '{}', '{"results":[]}',
		'{"results":{"results":{}}}', '{"results":{"results":[]}}',
		'{"results":{"results":[null]}}']) {
		if (input === undefined) fs.rmSync(files.input, { force: true });
		else fs.writeFileSync(files.input, input);
		const result = run(files);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /Evaluation is incomplete or invalid/);
		assert.equal(fs.existsSync(files.output), false);
	}
});
