'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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
