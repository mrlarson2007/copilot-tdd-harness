'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { questionsForPhase } = require('./jev-scorer');

test('WhenScoredPhasesAreRecorded_ShouldRenderDeterministicTypedJudgmentsWithoutInventingAnswers', (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-report-test-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const input = path.join(dir, 'recorded-results.json');
	const output = path.join(dir, 'report.md');
	const secret = 'PRIVATE_JUDGMENT_SENTINEL';
	const maliciousId = '<img>\n|[id](x)\u202e';
	const phases = Object.fromEntries(['red', 'green', 'commit', 'refactor'].map((phase) => [
		phase, {
			status: 'scored',
			request: { questions: questionsForPhase(phase), instructions: secret, state: secret },
			response: { model: `jev-${phase}`, answers: {}, usage: {
				input_tokens: 123, output_tokens: 12, total_tokens: secret, details: secret,
			}, evidence: secret },
			elapsedMs: 42, error: secret,
		},
	]));
	phases.red.response.answers = {
		focused_test: { type: 'score', score: 1.8, confidence: 0.9, evidence: secret },
		meaningful_failure: { type: 'noul', noul: 0.95, confidence: 0 },
		no_commit: { type: 'score', score: 2 },
		[maliciousId]: { type: 'noul', noul: 0.9 },
	};
	phases.red.request.questions[maliciousId] = { type: 'noul', instructions: secret, criteria: [secret] };
	phases.green.response.answers = {
		minimal_change: { type: 'score', score: 0, confidence: 'NONFINITE' },
		tests_unchanged: { type: 'noul', noul: 0 },
		verified_green: { type: 'noul', noul: 1.1 },
		commit_scope: { type: 'noul', noul: '0.9' },
	};
	phases.green.response.usage = { input_tokens: 'NONFINITE', output_tokens: -1 };
	phases.green.elapsedMs = 'NONFINITE';
	phases.commit.response.answers = {
		atomic_commit: { type: 'noul', noul: null },
		message_quality: { type: 'score', score: 1, confidence: 0.75 },
		no_scope_creep: { type: 'noul', noul: -0.1 },
	};
	phases.commit.response.usage = { input_tokens: 0, output_tokens: '12' };
	phases.commit.request.questions.message_quality.criteria = [secret, secret, secret];
	phases.refactor.response.answers = {
		design_quality: { type: 'score', score: 2, confidence: null },
		behavior_preserved: { type: 'noul', noul: 'NONFINITE' },
		committed_if_changed: { type: 'noul', noul: 1 },
	};
	const execution = { revision: 'abc123', fixtureId: 'fixture', scenarioId: 'scenario',
		status: 'complete', collectionStatus: 'complete', phases, evidence: secret };
	const invalid = { status: 'complete', phases: {
		red: { status: 'scored', response: { answers: { focused_test: { type: 'score', score: 2.1 } } } },
		green: { status: 'scored', response: { answers: { minimal_change: { type: 'score', score: -1 } } } },
		commit: { status: 'scored', response: { answers: { message_quality: { type: 'score', score: 'NONFINITE' } } } },
		refactor: { status: 'scored', response: { model: 'omitted-answers' } },
	} };
	const rawInput = JSON.stringify({ results: { results: [execution, invalid].map((value) => ({
		response: { output: value },
	})) } }).replaceAll('"NONFINITE"', '1e400');
	fs.writeFileSync(input, rawInput);

	const render = () => {
		const result = spawnSync(process.execPath, [path.join(__dirname, 'jev-report.js'), input, output],
			{ encoding: 'utf8' });
		assert.equal(result.error, undefined);
		assert.equal(result.status, 0);
		assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_JUDGMENT_SENTINEL/);
		return fs.readFileSync(output, 'utf8');
	};
	const report = render();
	assert.match(report, /Raw score \(0–2\)/);
	assert.match(report, /Noul yes probability \(0–1\)/);
	assert.match(report, /Confidence/);
	assert.match(report, /Complete execution does not imply a favorable judgment/);
	assert.match(report, /0, 1, and 2.*criteria/);
	assert.match(report, /noul.*probability of yes/i);
	for (const phase of Object.keys(phases)) {
		assert.ok(report.includes(`${phase.toUpperCase()}: status: scored; model: jev-${phase}`));
		for (const [id, question] of Object.entries(questionsForPhase(phase))) {
			const escapedId = id.replaceAll('_', '\\_');
			assert.ok(report.includes(`| ${escapedId} |`), `Question ID ${id} must be present`);
			for (const label of question.criteria || []) assert.ok(report.includes(label));
		}
	}
	const rows = report.split('\n').filter((line) => line.startsWith('| '));
	const rowFor = (id) => rows.find((line) => line.startsWith(`| ${id.replaceAll('_', '\\_')} |`));
	for (const [id, cells] of [
		['focused_test', '| 1.8 | — | 0.9 |'],
		['meaningful_failure', '| — | 0.95 | 0 |'],
		['minimal_change', '| 0 | — | unavailable |'],
		['tests_unchanged', '| — | 0 | unavailable |'],
		['message_quality', '| 1 | — | 0.75 |'],
		['design_quality', '| 2 | — | unavailable |'],
		['committed_if_changed', '| — | 1 | unavailable |'],
	]) assert.ok(rowFor(id).includes(cells), `Typed numeric cells for ${id}`);
	for (const id of ['scope_preserved', 'no_commit', 'verified_green', 'commit_scope',
		'atomic_commit', 'no_scope_creep', 'behavior_preserved']) {
		assert.match(rowFor(id), /\| unavailable \| unavailable \| unavailable \| unavailable:/);
	}
	assert.ok(rows.some((line) => line.startsWith('| &lt;img&gt;\\|\\[id\\]\\(x\\) |')
		&& line.includes('unavailable:')));
	assert.equal(rows.filter((line) => line.includes('unavailable:')).length, 22,
		'Seven invalid/missing answers plus one unknown ID and all fourteen answers in the second execution');
	assert.ok(report.includes('elapsedMs: 42; input_tokens: 123; output_tokens: 12'));
	assert.ok(report.includes('elapsedMs: unavailable; input_tokens: unavailable; output_tokens: unavailable'));
	assert.ok(report.includes('elapsedMs: 42; input_tokens: 0; output_tokens: unavailable'));
	assert.doesNotMatch(report, /PRIVATE_JUDGMENT_SENTINEL|Infinity|NaN|<img>|total_tokens|instructions|threshold|average|aggregate grade/i);
	assert.doesNotMatch(report, /Scores: unavailable\. No scores were invented\./);
	assert.equal(render(), report, 'Repeated rendering must be byte-for-byte deterministic');
	assert.equal(fs.readFileSync(input, 'utf8'), rawInput);
});

test('WhenRecordedResultsAreMissing_ShouldWriteIncompleteDiagnosticAndExitSuccessfully', (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-report-test-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const input = path.join(dir, 'recorded-results.json');
	const output = path.join(dir, 'report.md');

	const result = spawnSync(process.execPath, [
		path.join(__dirname, 'jev-report.js'), input, output,
	], { encoding: 'utf8' });

	assert.equal(fs.existsSync(output), true, 'Missing recorded results should produce a Markdown diagnostic');
	assert.equal(result.error, undefined);
	assert.equal(result.status, 0, 'Diagnostic reporting must not replace the completion gate');
	const report = fs.readFileSync(output, 'utf8');
	assert.match(report, /^# Jev Recorded Results Report\n/m);
	assert.match(report, /Status: incomplete/i);
	assert.match(report, /recorded-results JSON (?:is )?missing/i);
	assert.match(report, /scores: unavailable/i);
	assert.match(report, /no scores (?:were )?(?:invented|fabricated)/i);
	assert.match(report, /existing completion gate remains authoritative/i);
	assert.doesNotMatch(report, /\b\d+(?:\.\d+)?\s*(?:%|\/\s*\d+)|\bscore\s*:\s*\d/i);
	assert.equal(fs.existsSync(input), false, 'Reporting must not create recorded results');
});

test('WhenRecordedResultsContainMalformedJson_ShouldWriteIncompleteDiagnosticWithoutDisclosingInput', (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-report-test-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const input = path.join(dir, 'recorded-results.json');
	const output = path.join(dir, 'report.md');
	const rawInput = '{"privateNote":"PRIVATE_INPUT_SENTINEL", malformed';
	fs.writeFileSync(input, rawInput, 'utf8');

	const result = spawnSync(process.execPath, [
		path.join(__dirname, 'jev-report.js'), input, output,
	], { encoding: 'utf8' });

	assert.equal(fs.existsSync(output), true, 'Malformed recorded results should produce a Markdown diagnostic');
	assert.equal(result.error, undefined);
	assert.equal(result.status, 0, 'Diagnostic reporting must not replace the completion gate');
	const report = fs.readFileSync(output, 'utf8');
	assert.match(report, /^# Jev Recorded Results Report\n/m);
	assert.match(report, /Status: incomplete/i);
	assert.match(report, /recorded-results JSON (?:is )?(?:malformed|invalid)/i);
	assert.match(report, /scores: unavailable/i);
	assert.match(report, /no scores (?:were )?(?:invented|fabricated)/i);
	assert.match(report, /existing completion gate remains authoritative/i);
	assert.doesNotMatch(report, /\b\d+(?:\.\d+)?\s*(?:%|\/\s*\d+)|\bscore\s*:\s*\d/i);
	assert.doesNotMatch(report + result.stdout + result.stderr, /PRIVATE_INPUT_SENTINEL|privateNote/);
	assert.equal(fs.readFileSync(input, 'utf8'), rawInput, 'Reporting must not change recorded results');
});

test('WhenRecordedExecutionIsIncomplete_ShouldReportIdentityStatusesAndUnavailablePhasesWithoutScores', (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-report-test-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const input = path.join(dir, 'recorded-results.json');
	const output = path.join(dir, 'report.md');
	const rawInput = JSON.stringify({ results: { results: [{ response: { output: {
		revision: 'a'.repeat(40),
		fixtureId: 'calculator-cli-go',
		scenarioId: 'jev-phase-subtract',
		status: 'incomplete',
		collectionStatus: 'interrupted',
		phases: {
			red: { status: 'scored', response: { model: 'synthetic-jev' } },
			green: { status: 'unavailable', response: null },
		},
	} } }] } });
	fs.writeFileSync(input, rawInput, 'utf8');

	const result = spawnSync(process.execPath, [
		path.join(__dirname, 'jev-report.js'), input, output,
	], { encoding: 'utf8' });

	assert.equal(result.error, undefined);
	assert.equal(result.status, 0, 'Diagnostic reporting must not replace the completion gate');
	assert.equal(fs.existsSync(output), true, 'Incomplete recorded execution should produce a report');
	const report = fs.readFileSync(output, 'utf8');
	assert.match(report, /^# Jev Recorded Results Report\n/m);
	assert.match(report, /Status: incomplete/);
	assert.match(report, new RegExp(`Revision: ${'a'.repeat(40)}`));
	assert.match(report, /Fixture: calculator-cli-go/);
	assert.match(report, /Scenario: jev-phase-subtract/);
	assert.match(report, /Execution status: incomplete/);
	assert.match(report, /Collection status: interrupted/);
	assert.match(report, /RED: status: scored; model: synthetic-jev/);
	assert.match(report, /GREEN: status: unavailable; model: unavailable/);
	assert.match(report, /COMMIT: status: unavailable; model: unavailable/);
	assert.match(report, /REFACTOR: status: unavailable; model: unavailable/);
	assert.match(report, /Scores: unavailable\. No scores were invented\./);
	assert.match(report, /existing completion gate remains authoritative/i);
	assert.doesNotMatch(report, /\b\d+(?:\.\d+)?\s*(?:%|\/\s*\d+)|\bscore\s*:\s*\d/i);
	assert.equal(fs.readFileSync(input, 'utf8'), rawInput, 'Reporting must not change recorded results');
});

test('WhenUntrustedRecordedValuesContainMarkup_ShouldRenderLiteralTextWithoutDisclosingEvidence', (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-report-test-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const input = path.join(dir, 'recorded-results.json');
	const output = path.join(dir, 'report.md');
	const secret = 'PRIVATE_EVIDENCE_SENTINEL';
	const rawInput = JSON.stringify({ results: { results: [{ response: { output: {
		revision: 'rev\r\n# injected heading',
		fixtureId: '[fixture](https://example.invalid) <img src=x onerror=alert(1)>',
		scenarioId: 'scenario\n| injected | table |\n---\t\u0000\u007f\u0085\u2028\u2029\u202e',
		status: '**incomplete**\u001b[31m',
		collectionStatus: '&lt;script&gt; `collection`',
		phases: {
			red: {
				status: '_scored_',
				response: { model: '![model](https://example.invalid)\\~{x}+!' },
				request: { state: { evidence: secret }, source: secret },
				evidence: { state: secret },
				error: { body: secret },
			},
		},
		request: { state: { evidence: secret }, source: secret },
		source: secret,
		evidence: { state: secret },
		error: { body: secret },
	} } }] } });
	fs.writeFileSync(input, rawInput, 'utf8');

	const result = spawnSync(process.execPath, [
		path.join(__dirname, 'jev-report.js'), input, output,
	], { encoding: 'utf8' });

	assert.equal(result.error, undefined);
	assert.equal(result.status, 0);
	const report = fs.readFileSync(output, 'utf8');
	const expectedLines = [
		'Revision: rev\\# injected heading',
		'Fixture: \\[fixture\\]\\(https://example.invalid\\) &lt;img src=x onerror=alert\\(1\\)&gt;',
		'Scenario: scenario\\| injected \\| table \\|---',
		'Execution status: \\*\\*incomplete\\*\\*\\[31m',
		'Collection status: &amp;lt;script&amp;gt; \\`collection\\`',
		'RED: status: \\_scored\\_; model: \\!\\[model\\]\\(https://example.invalid\\)\\\\\\~\\{x\\}\\+\\!',
	];
	for (const line of expectedLines) {
		assert.ok(report.split('\n').includes(line), `Untrusted text must be escaped on its report line: ${line}`);
	}
	assert.deepEqual(report.match(/^#.*$/gm), ['# Jev Recorded Results Report']);
	assert.doesNotMatch(report, /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029\u202e]/u);
	assert.doesNotMatch(report + result.stdout + result.stderr, /PRIVATE_EVIDENCE_SENTINEL|\b(?:request|source|evidence|error)\b|<img/);
	assert.match(report, /Scores: unavailable\. No scores were invented\./);
	assert.equal(fs.readFileSync(input, 'utf8'), rawInput, 'Reporting must not change recorded results');
});
