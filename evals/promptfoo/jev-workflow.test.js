'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('WhenDispatchingJev_ShouldUseImmutableDispatchShaWithOptionalExactReviewedShaCheck', () => {
	const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/jev-live-eval.yml'), 'utf8');
	const validation = workflow.match(/      - name: Validate reviewed revision\n([\s\S]*?)(?=\n      - name:)/);
	assert.ok(validation, 'Validation step must exist');
	assert.match(validation[1], /shell: bash/);
	assert.match(validation[1], /REVIEWED_SHA: \$\{\{ inputs\.reviewed_sha \}\}/);
	const run = validation[1].match(/        run: \|\n((?:          .*\n|\n)+)/);
	assert.ok(run, 'Execute the actual validation run block, not a reimplementation');
	const script = run[1].replace(/^          /gm, '');
	const sha = 'abcdef0123456789abcdef0123456789abcdef01';
	for (const [label, reviewed, expected] of [
		['blank', '', 0],
		['omitted', undefined, 0],
		['exact dispatch revision', sha, 0],
		['older revision', '1234567890abcdef1234567890abcdef12345678', 1],
		['case mismatch', sha.toUpperCase(), 1],
		['short SHA', sha.slice(1), 1],
		['long SHA', `${sha}0`, 1],
		['non-hexadecimal', 'g'.repeat(40), 1],
		['branch ref', 'refs/heads/main', 1],
		['whitespace', ` ${sha}`, 1],
		['trailing newline', `${sha}\n`, 1],
	]) {
		const env = { PATH: process.env.PATH, GITHUB_SHA: sha };
		if (reviewed !== undefined) env.REVIEWED_SHA = reviewed;
		const result = spawnSync('bash', ['-c', script], { env, encoding: 'utf8', timeout: 5000 });
		assert.equal(result.error, undefined, label);
		assert.equal(result.status, expected, `${label}: ${result.stderr}`);
	}

	assert.match(workflow, /reviewed_sha:\n\s+description: [^\n]+\n\s+required: false\n\s+type: string/);
	assert.match(workflow, /^on:\n  workflow_dispatch:\n    inputs:/m);
	assert.doesNotMatch(workflow, /^  (?:push|pull_request|pull_request_target|schedule|workflow_run):/m);
	assert.match(workflow, /^permissions:\n  contents: read\n/m);
	for (const [job, environment] of [['collect', 'jev-agent'], ['score', 'jev-score']]) {
		const section = workflow.match(new RegExp(`^  ${job}:\\n([\\s\\S]*?)(?=^  [a-z]+:|$(?![\\s\\S]))`, 'm'));
		assert.ok(section, `${job} job exists`);
		const guard = section[1].match(/^    if: >-\n((?:      .*\n)+)/m);
		assert.ok(guard, `${job} has a job guard`);
		for (const safeguard of [
			"github.event_name == 'workflow_dispatch'",
			"github.ref == format('refs/heads/{0}', github.event.repository.default_branch)",
			"(inputs.reviewed_sha == '' || inputs.reviewed_sha == github.sha)",
			"vars.JEV_LIVE_ENABLED == 'true'",
		]) assert.ok(guard[1].includes(safeguard), `${job}: ${safeguard}`);
		assert.match(section[1], new RegExp(`^    environment: ${environment}$`, 'm'));
		const checkouts = [...section[1].matchAll(/uses: actions\/checkout@([0-9a-f]{40})[^\n]*\n        with:\n          ref: ([^\n]+)\n          persist-credentials: false/g)];
		assert.equal(checkouts.length, 1, `${job} has one pinned, credential-free checkout`);
		assert.equal(checkouts[0][2], '${{ github.sha }}', `${job} checks out the immutable dispatch revision`);
		if (job === 'score') {
			assert.match(section[1], /^    needs: collect$/m);
			assert.ok(guard[1].includes("needs.collect.result == 'success'"));
		}
	}
});

test('WhenScoringJev_ShouldAlwaysPublishDiagnosticReportWithoutChangingCompletionGate', () => {
	const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/jev-live-eval.yml'), 'utf8');
	const score = workflow.slice(workflow.indexOf('\n  score:\n'));
	const steps = [...score.matchAll(/^      - name: ([^\n]+)\n([\s\S]*?)(?=^      - name: |$(?![\s\S]))/gm)];
	const scoringIndex = steps.findIndex(step => step[1] === 'Score public fixture evidence with Jev');
	const gateIndex = steps.findIndex(step => step[1] === 'Require complete execution, not favorable judgments');
	assert.ok(scoringIndex >= 0 && gateIndex > scoringIndex, 'Scoring precedes the independent gate');
	const gate = steps[gateIndex][2];
	assert.equal(gate, `        if: \${{ always() }}
        shell: bash
        run: |
          node <<'NODE'
          const fs = require('node:fs');
          const path = require('node:path');
          const file = path.join(process.env.GITHUB_WORKSPACE, 'evals/promptfoo/results/promptfoo-jev-recorded.json');
          const report = JSON.parse(fs.readFileSync(file, 'utf8'));
          const rows = report?.results?.results;
          if (!Array.isArray(rows) || rows.length === 0 ||
              rows.some(row => row?.response?.output?.status !== 'complete')) {
            throw new Error('Jev evaluation is incomplete; assertion-free green rows are not proof of completion.');
          }
          NODE

`, 'The original always-running completion gate stays byte-for-byte unchanged');
	const script = gate.match(/          node <<'NODE'\n([\s\S]*?)          NODE/)[1].replace(/^          /gm, '');
	const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-workflow-'));
	try {
		const results = path.join(workspace, 'evals/promptfoo/results');
		fs.mkdirSync(results, { recursive: true });
		const input = path.join(results, 'promptfoo-jev-recorded.json');
		const complete = { response: { output: { status: 'complete', score: 0, noul: 0 } } };
		for (const [label, content, expected] of [
			['missing file', undefined, 1],
			['malformed JSON', '{', 1],
			['missing rows', '{}', 1],
			['non-array rows', '{"results":{"results":{}}}', 1],
			['empty rows', '{"results":{"results":[]}}', 1],
			['missing output', JSON.stringify({ results: { results: [{}] } }), 1],
			['incomplete row', JSON.stringify({ results: { results: [{ response: { output: { status: 'incomplete' } } }] } }), 1],
			['mixed rows', JSON.stringify({ results: { results: [complete, null] } }), 1],
			['unfavorable but complete rows', JSON.stringify({ results: { results: [complete, complete] } }), 0],
		]) {
			if (content !== undefined) fs.writeFileSync(input, content);
			const result = spawnSync(process.execPath, ['-e', script], {
				env: { GITHUB_WORKSPACE: workspace }, encoding: 'utf8', timeout: 5000,
			});
			assert.equal(result.error, undefined, label);
			assert.equal(result.status, expected, `${label}: ${result.stderr}`);
		}
	} finally {
		fs.rmSync(workspace, { recursive: true, force: true });
	}

	const invocation = 'node "$GITHUB_WORKSPACE/evals/promptfoo/jev-report.js" "$GITHUB_WORKSPACE/evals/promptfoo/results/promptfoo-jev-recorded.json" "$GITHUB_WORKSPACE/evals/promptfoo/results/jev-recorded-report.md"';
	const formatterIndex = steps.findIndex(step => step[2].includes(invocation));
	assert.ok(formatterIndex > scoringIndex && formatterIndex < gateIndex, 'Deterministic formatter must run after scoring and before the unchanged completion gate');
	assert.match(steps[formatterIndex][2], /^        if: \$\{\{ always\(\) \}\}$/m);
	assert.match(steps[formatterIndex][2], /^        shell: bash$/m);
	assert.ok(steps[formatterIndex][2].includes(`        run: ${invocation}\n`));
	assert.doesNotMatch(steps[formatterIndex][2], /GITHUB_STEP_SUMMARY|continue-on-error/, 'The CLI owns summary appending');
	const artifactIndex = steps.findIndex(step => step[1] === 'Preserve scoring reports only');
	assert.ok(artifactIndex > gateIndex, 'Artifact preservation follows the gate even when it fails');
	const artifact = steps[artifactIndex][2];
	assert.match(artifact, /^        if: \$\{\{ always\(\) \}\}$/m);
	assert.match(artifact, /uses: actions\/upload-artifact@/);
	assert.match(artifact, /^          name: jev-scores$/m);
	assert.match(artifact, /^          path: \|\n            evals\/promptfoo\/results\/promptfoo-jev-recorded\.json\n            evals\/promptfoo\/results\/jev-recorded-score\.json\n            evals\/promptfoo\/results\/jev-recorded-report\.md\n          if-no-files-found: warn$/m);
});
