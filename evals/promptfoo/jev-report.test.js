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
