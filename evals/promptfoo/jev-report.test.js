'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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
