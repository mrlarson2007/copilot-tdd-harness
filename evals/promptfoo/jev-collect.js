'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { command } = require('../fixtures/scenarios/calculator-cli-go/red-evaluator');
const { runExperiment } = require('../fixtures/scenarios/calculator-cli-go/jev-phase-experiment');
const { writeBundle } = require('./jev-evidence');

const repoRoot = path.resolve(__dirname, '../..');

async function collect(filePath, options = {}) {
	if (!filePath || !path.isAbsolute(filePath)) throw new Error('An absolute evidence output path is required');
	if (process.env.TYPESAFE_API_KEY) throw new Error('Collection must run without TYPESAFE_API_KEY');
	if (!options.runAgent && !process.env.COPILOT_GITHUB_TOKEN) throw new Error('COPILOT_GITHUB_TOKEN is required');
	const revision = process.env.GITHUB_SHA || command(repoRoot, 'git', ['rev-parse', 'HEAD']).output.trim();
	const secrets = Object.entries(process.env)
		.filter(([name]) => /TOKEN|KEY|SECRET|PASSWORD/i.test(name)).map(([, value]) => value);
	const bundle = {
		schemaVersion: 1, revision,
		fixtureId: 'calculator-cli-go', scenarioId: 'jev-phase-subtract',
		status: 'collecting', records: [],
	};
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-collection-'));
	const workspaceDir = path.join(tempRoot, 'calculator');
	let persisted = false;
	try {
		writeBundle(filePath, bundle, secrets);
		fs.cpSync(path.join(repoRoot, 'evals/fixtures/projects/calculator-cli-go/clean'), workspaceDir, { recursive: true });
		for (const args of [
			['init', '--quiet'], ['config', 'user.name', 'promptfoo-eval'],
			['config', 'user.email', 'promptfoo-eval@local.invalid'],
			['config', 'commit.gpgsign', 'false'], ['add', '--all'],
			['commit', '--quiet', '-m', 'baseline:calculator-cli-go/clean'],
		]) {
			const result = command(workspaceDir, 'git', args);
			if (result.exitCode !== 0) throw new Error('Unable to prepare disposable Git baseline');
		}
		const result = await runExperiment({
			workspaceDir, fixtureId: bundle.fixtureId, scenarioId: bundle.scenarioId,
			initialHead: command(workspaceDir, 'git', ['rev-parse', 'HEAD']).output.trim(),
		}, {
			collectOnly: true,
			...(options.runAgent ? { runAgent: options.runAgent } : {}),
			onRecord: (record) => {
				// No transcript, executable path, or module is transferred to scoring.
				bundle.records.push({ phase: record.phase, evidence: record.evidence });
				writeBundle(filePath, bundle, secrets);
			},
		});
		bundle.status = result.summary.status;
		writeBundle(filePath, bundle, secrets);
		persisted = true;
		return bundle.status;
	} catch {
		bundle.status = 'collection-failed';
		try {
			writeBundle(filePath, bundle, secrets);
			persisted = true;
		} catch {
			// Keep the last atomic checkpoint and the disposable workspace.
			console.error('Evidence persistence failed; retain temporary workspace for recovery.');
		}
		return 'collection-failed';
	} finally {
		if (persisted) fs.rmSync(tempRoot, { recursive: true, force: true });
	}
}

if (require.main === module) {
	collect(process.argv[2]).then((status) => {
		console.log(`Jev evidence collection: ${status}`);
		process.exitCode = status === 'collected' ? 0 : 1;
	}).catch(() => {
		console.error('Collection prerequisites unavailable; check the Copilot secret and output path.');
		process.exitCode = 1;
	});
}

module.exports = { collect };
