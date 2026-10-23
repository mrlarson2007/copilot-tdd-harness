'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { questionsForPhase } = require('./jev-scorer');

test('WhenProviderExecutionIsComplete_ShouldReportCompletionWithoutAnIncompleteDiagnostic', (t) => {
	const dir = fs.mkdtempSync(path.join(__dirname, '.jev-report-complete-test-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const input = path.join(dir, 'recorded-results.json');
	const output = path.join(dir, 'report.md');
	const phases = Object.fromEntries(['red', 'green', 'commit', 'refactor'].map((phase) => {
		const questions = questionsForPhase(phase);
		return [phase, {
			phase, status: 'scored', elapsedMs: 42,
			request: { questions },
			response: {
				model: 'recorded-jev',
				answers: Object.fromEntries(Object.entries(questions).map(([id, question]) => [
					id, { type: question.type, [question.type]: 0, confidence: 0.9 },
				])),
				usage: { input_tokens: 123, output_tokens: 12 },
			},
		}];
	}));
	const rawInput = JSON.stringify({ results: { results: [{
		response: {
			output: {
				fixtureId: 'calculator-cli-go', scenarioId: 'jev-phase-subtract',
				revision: 'a'.repeat(40), runMode: 'jev-recorded-evidence',
				status: 'complete', collectionStatus: 'collected', phases,
			},
			metadata: { evidenceSchemaVersion: 1, recordedOnly: true },
		},
	}] } });
	fs.writeFileSync(input, rawInput);
	const env = { ...process.env };
	delete env.GITHUB_STEP_SUMMARY;

	const result = spawnSync(process.execPath, [
		path.join(__dirname, 'jev-report.js'), input, output,
	], { encoding: 'utf8', env });

	assert.equal(result.error, undefined);
	assert.equal(result.status, 0);
	const report = fs.readFileSync(output, 'utf8');
	assert.match(report, /^Status: complete$/m);
	assert.match(report, /^Execution status: complete$/m);
	assert.match(report, /^Collection status: collected$/m);
	for (const phase of Object.keys(phases)) {
		assert.ok(report.includes(`${phase.toUpperCase()}: status: scored; model: recorded-jev`));
	}
	assert.match(report, /Complete execution does not imply a favorable judgment\./);
	assert.match(report, /The existing completion gate remains authoritative\./);
	assert.doesNotMatch(report, /This diagnostic does not indicate a completed evaluation\.|Status: incomplete/);
	assert.equal(fs.readFileSync(input, 'utf8'), rawInput);
});

test('WhenReportingToMissingOutputDirectories_ShouldAppendIdenticalMarkdownToExistingSummaryWhenSet', (t) => {
	const dir = fs.mkdtempSync(path.join(__dirname, '.jev-report-summary-test-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const summary = path.join(dir, 'summary.md');
	let expectedSummary = Buffer.from('Existing summary: résumé\n');
	fs.writeFileSync(summary, expectedSummary);

	for (const recorded of [false, true]) {
		for (const withSummary of [true, false]) {
			const results = path.join(dir, `${recorded}-${withSummary}`, 'results');
			const input = path.join(results, 'raw', 'recorded-results.json');
			const output = path.join(results, 'reports', 'nested', 'report.md');
			assert.equal(fs.existsSync(results), false, 'Results directory starts absent');
			if (recorded) {
				fs.mkdirSync(path.dirname(input), { recursive: true });
				fs.writeFileSync(input, JSON.stringify({ results: { results: [{ response: { output: {
					revision: 'recorded-revision', fixtureId: 'fixture', scenarioId: 'scenario',
					status: 'complete', collectionStatus: 'collected',
					phases: Object.fromEntries(['red', 'green', 'commit', 'refactor'].map((phase) => [
						phase, { status: 'scored' },
					])),
				} } }] } }));
			}
			const env = { ...process.env };
			delete env.GITHUB_STEP_SUMMARY;
			if (withSummary) env.GITHUB_STEP_SUMMARY = summary;
			const result = spawnSync(process.execPath, [
				path.join(__dirname, 'jev-report.js'), input, output,
			], { encoding: 'utf8', env });

			assert.equal(result.error, undefined);
			assert.equal(result.status, 0, `Reporting must create nested output parents: ${result.stderr}`);
			const report = fs.readFileSync(output);
			assert.match(report.toString('utf8'), /^# Jev Recorded Results Report\n/);
			assert.match(report.toString('utf8'), recorded
				? /Status: complete\n[\s\S]*Revision: recorded-revision/
				: /Status: incomplete\n[\s\S]*The recorded-results JSON is missing\./);
			if (withSummary) expectedSummary = Buffer.concat([expectedSummary, report]);
			assert.deepEqual(fs.readFileSync(summary), expectedSummary,
				'Preserve existing bytes and append exactly the standalone report only when configured');
			assert.equal(fs.existsSync(input), recorded, 'Missing recorded results must remain absent');
			if (!recorded) assert.equal(fs.existsSync(path.dirname(input)), false);
		}
	}
});

test('WhenScoredPhasesAreRecorded_ShouldRenderDeterministicTypedJudgmentsWithoutInventingAnswers', (t) => {
	const dir = fs.mkdtempSync(path.join(__dirname, '.jev-report-test-'));
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
	const dir = fs.mkdtempSync(path.join(__dirname, '.jev-report-test-'));
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
	const dir = fs.mkdtempSync(path.join(__dirname, '.jev-report-test-'));
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
	const dir = fs.mkdtempSync(path.join(__dirname, '.jev-report-test-'));
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
	const dir = fs.mkdtempSync(path.join(__dirname, '.jev-report-test-'));
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

test('WhenRecordedResultsAreUnavailableOrIncomplete_ShouldShowDiagnosticScorecardAndAppendIdenticalSummary', (t) => {
	const dir = fs.mkdtempSync(path.join(__dirname, '.jev-report-diagnostic-test-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const input = path.join(dir, 'recorded-results.json');
	const output = path.join(dir, 'report.md');
	const summary = path.join(dir, 'summary.md');
	const cases = [
		[undefined, 'The recorded-results JSON is missing.'],
		['{"private":"PRIVATE_DIAGNOSTIC",', 'The recorded-results JSON is malformed.'],
		['{}', 'The recorded-results wrapper results.results is absent.'],
		['{"results":{"results":{}}}', 'The recorded-results wrapper results.results is malformed.'],
		['{"results":{"results":[]}}', 'The recorded-results wrapper results.results is empty.'],
		[JSON.stringify({ results: { results: [{ response: { output: {
			revision: 'partial-revision', fixtureId: 'partial-fixture', scenarioId: 'partial-scenario',
			status: 'incomplete', collectionStatus: 'interrupted',
			phases: { red: { status: 'scored', response: { model: 'recorded-model' } } },
		} } }] } }), 'Questions: unavailable (answers absent).'],
	];
	for (const [raw, diagnostic] of cases) {
		if (raw !== undefined) fs.writeFileSync(input, raw);
		const prefix = 'Existing summary: résumé\n';
		fs.writeFileSync(summary, prefix);
		const result = spawnSync(process.execPath, [path.join(__dirname, 'jev-report.js'), input, output],
			{ encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: summary } });
		assert.equal(result.error, undefined);
		assert.equal(result.status, 0);
		const report = fs.readFileSync(output, 'utf8');
		assert.match(report, /^Status: incomplete$/m);
		assert.ok(report.includes(diagnostic));
		assert.ok(report.includes('Scores: unavailable. No scores were invented.'));
		assert.match(report, /This diagnostic does not indicate a completed evaluation\./);
		assert.equal(fs.readFileSync(summary, 'utf8'), prefix + report);
		assert.doesNotMatch(report + result.stdout + result.stderr, /PRIVATE_DIAGNOSTIC|leaderboard|baseline|average|threshold|grade/i);
		if (raw === undefined) assert.equal(fs.existsSync(input), false);
		else assert.equal(fs.readFileSync(input, 'utf8'), raw);
		if (raw?.includes('partial-revision')) {
			const [scorecard, ...disclosures] = report.split('<details>');
			assert.match(scorecard, /Revision: partial-revision[\s\S]*Fixture: partial-fixture[\s\S]*Scenario: partial-scenario/);
			assert.match(scorecard, /Execution status: incomplete[\s\S]*Collection status: interrupted/);
			assert.match(scorecard, /\| Phase \| Status \| Raw score \(0–2\) \| Noul yes probability \(0–1\) \|/);
			assert.equal(disclosures.length, 4);
			for (const phase of ['RED', 'GREEN', 'COMMIT', 'REFACTOR']) {
				assert.ok(scorecard.includes(`| ${phase} | ${phase === 'RED' ? 'scored' : 'unavailable'} | unavailable | unavailable |`));
				assert.ok(report.includes(`<summary>${phase} question details</summary>\n\n`));
			}
			assert.equal((report.match(/<\/details>/g) || []).length, 4);
			assert.equal((scorecard.match(/^\| (?:RED|GREEN|COMMIT|REFACTOR) \|/gm) || []).length, 4);
			assert.doesNotMatch(scorecard, /elapsedMs:|Questions:/);
		}
	}
});

test('WhenTypedJudgmentsAreRecorded_ShouldShowOnlyRawPerQuestionValuesBeforeSafeExpandableDetails', (t) => {
	const dir = fs.mkdtempSync(path.join(__dirname, '.jev-report-scorecard-test-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const input = path.join(dir, 'recorded-results.json');
	const output = path.join(dir, 'report.md');
	const summary = path.join(dir, 'summary.md');
	const privateText = 'PRIVATE_SCORECARD_SENTINEL';
	const hostile = '</details><details open><summary>injected</summary>|[x](url)\n';
	for (const complete of [false, true]) {
		const phases = Object.fromEntries(['red', 'green', 'commit', 'refactor'].map((phase) => [
			phase, {
				status: 'scored', elapsedMs: 0,
				request: { questions: questionsForPhase(phase), state: privateText },
				response: {
					model: hostile, usage: { input_tokens: 0, output_tokens: 8, extra: privateText },
					answers: Object.fromEntries(Object.entries(questionsForPhase(phase)).map(([id, question]) => [
						id, { type: question.type, [question.type]: question.type === 'score' ? 1.375 : 0.625,
							confidence: 0.875, evidence: privateText },
					])),
				},
				error: privateText,
			},
		]));
		phases.red.response.answers.focused_test.score = 0;
		phases.red.response.answers.meaningful_failure.noul = 0;
		phases.red.response.answers.scope_preserved = { type: 'score', score: 2 };
		phases.red.response.answers[hostile] = { type: 'score', score: 2, evidence: privateText };
		phases.red.request.questions.focused_test.criteria = [privateText];
		if (!complete) {
			phases.green.status = 'unavailable';
			phases.green.response.answers.minimal_change.score = 3;
			phases.green.response.answers.tests_unchanged.noul = '0.9';
			delete phases.commit.response.answers.message_quality;
		}
		const raw = JSON.stringify({ results: { results: [{ response: { output: {
			revision: hostile, fixtureId: 'actual-fixture', scenarioId: 'actual-scenario',
			status: complete ? 'complete' : 'incomplete', collectionStatus: complete ? 'collected' : 'interrupted',
			phases, evidence: privateText, request: privateText, error: privateText,
		} } }] } });
		fs.writeFileSync(input, raw);
		fs.writeFileSync(summary, 'Existing summary\n');
		const result = spawnSync(process.execPath, [path.join(__dirname, 'jev-report.js'), input, output],
			{ encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: summary } });
		assert.equal(result.error, undefined);
		assert.equal(result.status, 0);
		const report = fs.readFileSync(output, 'utf8');
		assert.match(report, new RegExp(`^Status: ${complete ? 'complete' : 'incomplete'}$`, 'm'));
		const [scorecard, ...details] = report.split('<details>');
		assert.equal(details.length, 4, 'Metadata and question IDs cannot inject disclosures');
		const rows = scorecard.split('\n').filter((line) => /^\| (RED|GREEN|COMMIT|REFACTOR) \|/.test(line));
		assert.equal(rows.length, 4);
		const escapedId = (id) => id.replaceAll('_', '\\_');
		for (const [index, phase] of ['red', 'green', 'commit', 'refactor'].entries()) {
			const expectedCells = { score: [], noul: [] };
			for (const [id, question] of Object.entries(questionsForPhase(phase))) {
				const answer = phases[phase].response.answers[id];
				const valid = answer?.type === question.type && typeof answer[question.type] === 'number'
					&& answer[question.type] <= (question.type === 'score' ? 2 : 1);
				expectedCells[question.type].push(`${escapedId(id)}: ${valid ? answer[question.type] : 'unavailable'}`);
			}
			assert.equal(rows[index], `| ${phase.toUpperCase()} | ${phases[phase].status} | ${expectedCells.score.join('<br>')} | ${expectedCells.noul.join('<br>')} |`);
			assert.ok(details[index].startsWith(`\n<summary>${phase.toUpperCase()} question details</summary>\n\n`));
			assert.match(details[index], /elapsedMs: 0; input_tokens: 0; output_tokens: 8/);
			assert.match(details[index], /\| Confidence \| Diagnostic \|/);
			assert.match(details[index], /\| 0.875 \| recorded \|/);
			for (const question of Object.values(questionsForPhase(phase))) {
				for (const label of question.criteria || []) assert.ok(details[index].includes(label));
			}
		}
		assert.match(details[0], /unavailable: answer or question type mismatch/);
		assert.match(details[0], /unavailable: unknown question/);
		if (!complete) {
			assert.match(details[1], /unavailable: answer out of range/);
			assert.match(details[1], /unavailable: answer missing or nonfinite/);
			assert.match(details[2], /unavailable: answer absent or malformed/);
		}
		assert.ok(report.includes('&lt;/details&gt;&lt;details open&gt;&lt;summary&gt;injected&lt;/summary&gt;\\|\\[x\\]\\(url\\)'));
		assert.equal((report.match(/<\/details>/g) || []).length, 4);
		assert.doesNotMatch(scorecard, /Criteria labels|Confidence|elapsedMs:|recorded \|/);
		assert.doesNotMatch(report + result.stdout + result.stderr,
			/PRIVATE_SCORECARD_SENTINEL|<details open>|leaderboard|baseline|sample|average|threshold|grade|"(?:request|evidence|error)"\s*:/i);
		assert.equal(fs.readFileSync(summary, 'utf8'), 'Existing summary\n' + report);
		assert.equal(fs.readFileSync(input, 'utf8'), raw);
	}
});
