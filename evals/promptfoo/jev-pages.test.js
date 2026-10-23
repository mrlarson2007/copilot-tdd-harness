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

function execution() {
	return {
		status: 'complete', collectionStatus: 'collected', revision,
		fixtureId: 'calculator-cli-go', scenarioId: 'jev-phase-subtract',
		phases: Object.fromEntries(phases.map((phase) => [phase, {
			status: 'scored', elapsedMs: 12.5,
			response: { model: 'never-publish-model', usage: { input_tokens: 21, output_tokens: 34 },
				answers: Object.fromEntries(Object.entries(questionsForPhase(phase)).map(([id, question]) =>
					[id, { type: question.type, [question.type]: 0, confidence: 0.75 }])) },
		}])),
	};
}

function writeRows(files, rows) {
	fs.writeFileSync(files.input, JSON.stringify({
		results: { results: rows.map((output) => ({ response: { output } })) },
	}));
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

test('WhenRecordedExecutionIsComplete_ShouldWriteThreeLinkedStandalonePagesWithRunMetadata', (t) => {
	const files = workspace(t);
	writeRows(files, [execution()]);
	const original = fs.readFileSync(files.input);
	const result = run(files);
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(fs.readdirSync(files.output).sort(), ['index.html', 'jev.html', 'promptfoo.html']);
	assert.deepEqual(fs.readFileSync(files.input), original);
	for (const name of ['index.html', 'jev.html', 'promptfoo.html']) {
		const html = fs.readFileSync(path.join(files.output, name), 'utf8');
		assert.match(html, /<!doctype html>/i);
		assert.match(html, /example\/reviewed-repo/);
		assert.match(html, new RegExp(revision));
		assert.match(html, /Run: 12345/);
		assert.match(html, /Attempt: 2/);
		assert.match(html, /2026-10-23T16:00:00.000Z/);
		assert.match(html, /href="https:\/\/github.com\/example\/reviewed-repo\/actions\/runs\/12345\/attempts\/2"/);
		assert.match(html, new RegExp(`href="https://github.com/example/reviewed-repo/commit/${revision}"`));
		assert.match(html, /href="index.html"/);
		assert.match(html, /href="jev.html"/);
		assert.match(html, /href="promptfoo.html"/);
		assert.doesNotMatch(html, /<script|<iframe|<link|https:\/\/(?!github.com)/i);
	}
	const landing = fs.readFileSync(path.join(files.output, 'index.html'), 'utf8');
	assert.match(landing, /complete/i);
	assert.match(landing, /Complete executions: 1/);
	assert.match(landing, /Incomplete executions: 0/);
});
