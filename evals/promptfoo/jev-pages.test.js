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

test('WhenCompleteRowsHaveLowOrFractionalJudgments_ShouldPublishRecordedCanonicalScorecardsAndExecutionCounts', (t) => {
	const files = workspace(t);
	const fractional = execution();
	fractional.phases.red.response.answers.focused_test.score = 1.25;
	fractional.phases.red.response.answers.meaningful_failure.noul = 0.125;
	fractional.phases.red.response.answers.meaningful_failure.confidence = 0;
	writeRows(files, [execution(), fractional]);
	const recorded = JSON.parse(fs.readFileSync(files.input));
	recorded.results.stats = { successes: 999, failures: 999 };
	fs.writeFileSync(files.input, JSON.stringify(recorded));
	const result = run(files);
	assert.equal(result.status, 0, result.stderr);
	for (const name of ['jev.html', 'promptfoo.html']) {
		const html = fs.readFileSync(path.join(files.output, name), 'utf8');
		assert.match(html, /Complete executions: 2/);
		assert.match(html, /Incomplete executions: 0/);
		assert.match(html, /Execution 1/);
		assert.match(html, /Execution 2/);
		assert.match(html, /Execution status: complete/);
		assert.match(html, /Collection status: collected/);
		assert.match(html, /calculator-cli-go/);
		assert.match(html, /jev-phase-subtract/);
		assert.match(html, /<td>1.25<\/td>/);
		assert.match(html, /<td>0.125<\/td>/);
		assert.match(html, /<td>0<\/td>/);
		assert.match(html, /<td>0.75<\/td>/);
		assert.match(html, /Elapsed \(ms\): 12.5/);
		assert.match(html, /Input tokens: 21/);
		assert.match(html, /Output tokens: 34/);
		assert.match(html, /Raw score \(0–2\)/);
		assert.match(html, /Noul yes probability \(0–1\)/);
		assert.match(html, /Confidence \(0–1\)/);
		assert.match(html, /Complete execution does not imply compliance or a favorable judgment/);
		assert.match(html, /Assertion-free execution is not a compliance check/);
		assert.doesNotMatch(html, /999|average|threshold|never-publish-model/);
		for (const phase of phases) {
			assert.match(html, new RegExp(`<summary>${phase.toUpperCase()}: scored`));
			for (const [id, question] of Object.entries(questionsForPhase(phase))) {
				assert.ok(html.includes(id), id);
				assert.ok(html.includes(question.instructions.replace(/&/g, '&amp;')), id);
				for (const criterion of question.criteria || []) assert.ok(html.includes(criterion), criterion);
			}
		}
	}
});

test('WhenAnyExecutionOrOutputBoundaryIsUnsafe_ShouldRejectBeforeChangingInputOrExistingPages', (t) => {
	const files = workspace(t);
	fs.mkdirSync(files.output);
	const previous = path.join(files.output, 'index.html');
	fs.writeFileSync(previous, 'previous deployment');
	const invalidRows = [
		null, {}, { ...execution(), status: 'incomplete' }, { ...execution(), status: 'complete-hostile' },
		{ ...execution(), collectionStatus: 'incomplete' },
		{ ...execution(), revision: 'b'.repeat(40) }, { ...execution(), revision: undefined },
		{ ...execution(), phases: null },
		...phases.flatMap((phase) => [undefined, 'unavailable', 'invalid-response', 'missing-evidence', '<script>'].map((status) => {
			const row = execution();
			if (status === undefined) delete row.phases[phase];
			else row.phases[phase].status = status;
			return row;
		})),
	];
	for (const invalid of invalidRows) {
		for (const rows of [[invalid], [execution(), invalid], [invalid, execution()]]) {
			writeRows(files, rows);
			const original = fs.readFileSync(files.input);
			const result = run(files);
			assert.equal(result.status, 1);
			assert.match(result.stderr, /Evaluation is incomplete or invalid/);
			assert.equal(fs.readFileSync(previous, 'utf8'), 'previous deployment');
			assert.deepEqual(fs.readdirSync(files.output), ['index.html']);
			assert.deepEqual(fs.readFileSync(files.input), original);
		}
	}
	writeRows(files, [execution()]);
	for (const sha of [undefined, '', 'not-a-sha', 'b'.repeat(40)]) {
		assert.equal(run(files, { ...environment, GITHUB_SHA: sha }).status, 1);
		assert.equal(fs.readFileSync(previous, 'utf8'), 'previous deployment');
	}
	fs.rmSync(previous);
	fs.symlinkSync(files.input, previous);
	const original = fs.readFileSync(files.input);
	assert.equal(run(files).status, 1, 'must reject symlinked destination pages');
	assert.deepEqual(fs.readFileSync(files.input), original);
	assert.deepEqual(fs.readdirSync(files.output), ['index.html']);
	fs.rmSync(previous);
	fs.writeFileSync(path.join(files.output, 'raw.json'), 'must not publish');
	assert.equal(run(files).status, 1, 'must not publish a directory containing other artifacts');
});

test('WhenJudgmentValuesAreMalformedNonfiniteOrOutsideCanonicalRanges_ShouldShowUnavailableWithoutInventingScores', (t) => {
	const files = workspace(t);
	const invalid = [null, false, '', '1', 'PRIVATE_NUMERIC_FIELD', {}, [], -0.1, 2.1, 'RAW_INFINITY', 'RAW_NEGATIVE_INFINITY'];
	for (const [id, kind, maximum] of [['focused_test', 'score', 2], ['meaningful_failure', 'noul', 1]]) {
		for (const value of [...invalid, maximum + 0.01]) {
			const row = execution();
			row.phases.red.response.answers[id] = { type: kind, [kind]: value, confidence: 0.5 };
			row.phases.green.elapsedMs = -1;
			row.phases.green.response.usage = { input_tokens: 'PRIVATE_TOKEN_FIELD', output_tokens: null };
			writeRows(files, [row]);
			fs.writeFileSync(files.input, fs.readFileSync(files.input, 'utf8')
				.replaceAll('"RAW_INFINITY"', '1e999').replaceAll('"RAW_NEGATIVE_INFINITY"', '-1e999'));
			const result = run(files);
			assert.equal(result.status, 0, result.stderr);
			for (const name of ['jev.html', 'promptfoo.html']) {
				const html = fs.readFileSync(path.join(files.output, name), 'utf8');
				const questionRow = html.match(new RegExp(`<tr><th scope="row">${id}</th>[\\s\\S]*?</tr>`))?.[0];
				assert.ok(questionRow);
				assert.match(questionRow, /<td>unavailable<\/td><td>unavailable<\/td><td>unavailable<\/td><td>unavailable<\/td>/);
				assert.match(html, /Elapsed \(ms\): unavailable · Input tokens: unavailable · Output tokens: unavailable/);
				assert.doesNotMatch(html, /PRIVATE_|Infinity|NaN/);
			}
		}
	}
	for (const answer of [undefined, [], 'PRIVATE_ANSWER', { type: 'noul', score: 1 },
		{ type: 'PRIVATE_TYPE', score: 1 }, { type: 'score' }]) {
		const row = execution();
		row.phases.red.response.answers.focused_test = answer;
		writeRows(files, [row]);
		assert.equal(run(files).status, 0);
		const html = fs.readFileSync(path.join(files.output, 'jev.html'), 'utf8');
		assert.match(html.match(/<tr><th scope="row">focused_test<\/th>[\s\S]*?<\/tr>/)[0],
			/<td>unavailable<\/td><td>unavailable<\/td><td>unavailable<\/td><td>unavailable<\/td>/);
		assert.doesNotMatch(html, /PRIVATE_/);
	}
	const endpoints = execution();
	endpoints.phases.red.response.answers.focused_test.score = 2;
	endpoints.phases.red.response.answers.meaningful_failure.noul = 1;
	endpoints.phases.red.response.answers.focused_test.confidence = 1.01;
	endpoints.phases.red.response.answers.meaningful_failure.confidence = -1;
	writeRows(files, [endpoints]);
	assert.equal(run(files).status, 0);
	const html = fs.readFileSync(path.join(files.output, 'jev.html'), 'utf8');
	assert.match(html, /<td>2<\/td><td>unavailable<\/td><td>unavailable<\/td><td>recorded<\/td>/);
	assert.match(html, /<td>unavailable<\/td><td>1<\/td><td>unavailable<\/td><td>recorded<\/td>/);
});

test('WhenSourceContainsSensitiveFields_ShouldPublishOnlySafeProjectionWithoutEverOverwritingTheSource', (t) => {
	const files = workspace(t);
	const secret = 'PRIVATE_SENTINEL_<img src=x onerror=alert(1)>_"\'&';
	const row = execution();
	row.fixtureId = secret;
	row.scenarioId = secret;
	row.metadata = { secret };
	row.state = secret;
	row.transcript = secret;
	row.path = secret;
	row.error = secret;
	row.phases[secret] = { status: secret };
	for (const phase of phases) {
		const judgment = row.phases[phase];
		judgment.phase = secret;
		judgment.request = { state: secret, questions: { [secret]: { instructions: secret, criteria: [secret] } } };
		judgment.error = { message: secret };
		judgment.response.model = secret;
		judgment.response.metadata = { secret };
		judgment.response.usage.secret = secret;
		judgment.response.answers[secret] = { type: 'score', score: 2 };
		for (const answer of Object.values(judgment.response.answers)) {
			answer.evidence = secret;
			answer.explanation = secret;
			answer.transcript = secret;
		}
	}
	writeRows(files, [execution(), row]);
	const raw = JSON.parse(fs.readFileSync(files.input));
	raw.metadata = { secret };
	raw.results.stats = { description: secret };
	for (const item of raw.results.results) {
		item.provider = { id: secret };
		item.prompt = secret;
		item.vars = { secret };
		item.error = secret;
		item.response.error = secret;
		item.gradingResult = { reason: secret };
	}
	fs.writeFileSync(files.input, JSON.stringify(raw));
	const original = fs.readFileSync(files.input);
	assert.equal(run(files).status, 0);
	assert.deepEqual(fs.readFileSync(files.input), original);
	for (const name of ['index.html', 'jev.html', 'promptfoo.html']) {
		const html = fs.readFileSync(path.join(files.output, name), 'utf8');
		assert.doesNotMatch(html, /PRIVATE_SENTINEL|onerror|&lt;img|<img|never-publish-model/);
	}
	assert.match(fs.readFileSync(path.join(files.output, 'jev.html'), 'utf8'), /Fixture: unavailable · Scenario: unavailable/);
	fs.rmSync(files.output, { recursive: true });
	fs.mkdirSync(files.output);
	for (const name of ['index.html', 'jev.html', 'promptfoo.html']) {
		const colliding = { ...files, input: path.join(files.output, name) };
		fs.writeFileSync(colliding.input, original);
		assert.equal(run(colliding).status, 1, 'must reject a source file that would be overwritten by a generated page');
		assert.deepEqual(fs.readFileSync(colliding.input), original);
		assert.deepEqual(fs.readdirSync(files.output), [name]);
		fs.rmSync(colliding.input);
	}
});

test('WhenRunMetadataIsHostileOrUnavailable_ShouldOmitUnsafeLinksAndGenerateTimestampAtExecution', (t) => {
	const files = workspace(t);
	writeRows(files, [execution()]);
	for (const server of ['https://PRIVATE_SERVER.invalid', 'javascript:alert(1)', 'http://github.com',
		'https://github.com.PRIVATE_SERVER.invalid', 'https://github.com@PRIVATE_SERVER.invalid',
		'https://github.com/PRIVATE_PATH', 'https://github.com?PRIVATE_QUERY',
		'https://github.com#PRIVATE_FRAGMENT', undefined]) {
		const start = Date.now();
		const result = run(files, { ...environment, GITHUB_SERVER_URL: server, EVAL_TIMESTAMP: undefined });
		assert.equal(result.status, 0, result.stderr);
		const end = Date.now();
		for (const name of ['index.html', 'jev.html', 'promptfoo.html']) {
			const html = fs.readFileSync(path.join(files.output, name), 'utf8');
			assert.doesNotMatch(html, /PRIVATE_|javascript:|href="https?:/);
			assert.match(html, /Source commit unavailable/);
			assert.match(html, /Source run unavailable/);
			const timestamp = html.match(/Timestamp: ([^<]+)</)?.[1];
			assert.ok(Date.parse(timestamp) >= start && Date.parse(timestamp) <= end);
		}
	}
	for (const repository of ['../..', 'example/..', './repo', '<script>/PRIVATE_REPOSITORY', undefined]) {
		assert.equal(run(files, { ...environment, GITHUB_REPOSITORY: repository,
			GITHUB_RUN_ID: 'PRIVATE_RUN', GITHUB_RUN_ATTEMPT: 'PRIVATE_ATTEMPT',
			EVAL_TIMESTAMP: 'PRIVATE_TIMESTAMP' }).status, 0);
		for (const name of ['index.html', 'jev.html', 'promptfoo.html']) {
			const html = fs.readFileSync(path.join(files.output, name), 'utf8');
			assert.match(html, /Repository: unavailable/);
			assert.match(html, /Run: unavailable · Attempt: unavailable · Timestamp: unavailable/);
			assert.doesNotMatch(html, /PRIVATE_|<script|href="https?:/);
		}
	}
});
