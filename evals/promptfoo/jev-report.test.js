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
