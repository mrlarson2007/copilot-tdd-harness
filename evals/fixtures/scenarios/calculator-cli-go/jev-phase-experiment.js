'use strict';

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { runCopilotAgent } = require('../agent-runner');
const { command, snapshot, gitEvidence, goTests } = require('./red-evaluator');
const { scorePhase } = require('../../../promptfoo/jev-scorer');

const phases = ['red', 'green', 'commit', 'refactor'];
const repoRoot = path.resolve(__dirname, '../../../..');
const scenario = 'Given the calculator CLI, when invoked as "go run . subtract 9 4", it should exit successfully and print 5.';
const boundaries = {
	red: 'Write and verify exactly one failing unit test for this scenario, then stop. Do not implement production behavior or commit.',
	green: 'Make the RED test pass using the smallest production change. Preserve tests. Follow the skill, including its immediate GREEN commit requirement. Stop before REFACTOR.',
	commit: 'Commit the verified GREEN test and production change together if GREEN has not already committed. If it already committed, inspect and report that commit without creating a duplicate. Do not refactor.',
	refactor: 'Evaluate whether local refactoring is warranted after the GREEN commit. A justified no-op is acceptable. If refactoring is performed, verify it and commit it before stopping. Do not add a new behavior or test.',
};

function setup(workspaceDir) {
	for (const skill of [...phases.map((phase) => `tdd-${phase}`), 'tdd-test-run']) {
		fs.cpSync(path.join(repoRoot, '.github', 'skills', skill),
			path.join(workspaceDir, '.github', 'skills', skill), { recursive: true });
	}
	fs.cpSync(path.join(repoRoot, '.github', 'contracts'),
		path.join(workspaceDir, '.github', 'contracts'), { recursive: true });
	// The scaffold is evaluator setup, before the measured cycle begins.
	for (const args of [
		['add', '.github/skills', '.github/contracts'],
		['commit', '--quiet', '-m', 'eval: install phase skills before measurement'],
	]) {
		const result = command(workspaceDir, 'git', args);
		if (result.exitCode !== 0) throw new Error('Unable to baseline phase evaluation scaffold');
	}
}

function state(workspaceDir) {
	const files = snapshot(workspaceDir);
	const tests = {};
	const production = {};
	const configuration = {};
	const manifest = {};
	for (const [name, file] of Object.entries(files)) {
		manifest[name] = {
			type: file.type, mode: file.mode,
			sha256: createHash('sha256').update(file.content).digest('hex'),
		};
		if (file.type !== 'file') continue;
		const content = Buffer.from(file.content, 'base64').toString('utf8');
		if (/^[^/]+_test\.go$/.test(name)) tests[name] = content;
		else if (/^[^/]+\.go$/.test(name)) production[name] = content;
		else if (['go.mod', '.github/instructions/tdd-patterns.instructions.md'].includes(name)) configuration[name] = content;
	}
	const git = gitEvidence(workspaceDir);
	return {
		tests, production, configuration, manifest,
		git: {
			head: git.head, status: git.status, diff: git.diff, staged: git.staged,
			reflog: git.reflog, objects: git.objects, refs: git.refs,
		},
	};
}

function commits(workspaceDir, baselineHead) {
	const refs = command(workspaceDir, 'git', ['rev-list', '--reverse', `${baselineHead}..HEAD`]);
	if (refs.exitCode !== 0) return { error: 'Unable to enumerate cycle commits', result: refs };
	return refs.output.trim().split('\n').filter(Boolean).map((ref) => ({
		ref,
		details: command(workspaceDir, 'git', ['show', '--no-ext-diff', '--no-textconv',
			'--format=%H%n%P%n%B', ref, '--']),
	}));
}

function phaseResult(output) {
	const blocks = [...output.matchAll(/<phase_result>([\s\S]*?)<\/phase_result>/g)];
	try {
		const result = JSON.parse(blocks.at(-1)?.[1] || '');
		return result && typeof result === 'object' && !Array.isArray(result) ? result : null;
	} catch {
		return null;
	}
}

function summary(input, records, status) {
	return {
		fixtureId: input.fixtureId,
		baselineId: input.baselineId || 'clean',
		scenarioId: input.scenarioId,
		runMode: 'jev-phase-experiment',
		evaluator: 'typesafe-jev',
		status,
		phases: Object.fromEntries(phases.map((phase) => [
			phase, records.find((record) => record.phase === phase)?.judgment
				|| { phase, status: 'not-run', response: null },
		])),
	};
}

async function runExperiment(input, dependencies = {}) {
	const runAgent = dependencies.runAgent || runCopilotAgent;
	const judge = dependencies.judge || scorePhase;
	const workspaceDir = input.workspaceDir;
	setup(workspaceDir);
	const baseline = { state: state(workspaceDir), tests: goTests(workspaceDir) };
	const records = [];
	if (baseline.tests.exitCode !== 0 || baseline.tests.error || baseline.tests.signal) {
		return { summary: summary(input, records, 'baseline-failed'), artifacts: { baseline, phases: records } };
	}
	const baselineHead = baseline.state.git.head.output.trim();
	let before = baseline.state;
	let status = 'complete';
	for (const phase of phases) {
		const prompt = `${scenario}
Read and execute .github/skills/tdd-${phase}/SKILL.md, its available assets,
.github/skills/tdd-test-run/SKILL.md and assets for verification,
.github/instructions/tdd-patterns.instructions.md, and .github/contracts/tdd-cycle-contracts.md.
${boundaries[phase]}
The evaluator will capture this boundary before invoking any next phase.
Return your phase contract JSON inside <phase_result>...</phase_result>.
Do not start a cycle runner or another phase.
Previous phase result: ${JSON.stringify(records.at(-1)?.evidence.phaseResult || null)}`;
		let agent;
		try {
			agent = await runAgent(workspaceDir, prompt, {
				agentName: false, processGroup: true, progressLabel: `jev-${phase}`,
				env: { ...process.env, TYPESAFE_API_KEY: '' },
			});
		} catch (error) {
			agent = { ok: false, exitCode: null, output: String(error) };
		}
		const after = state(workspaceDir);
		const testResults = [goTests(workspaceDir)];
		const afterVerification = state(workspaceDir);
		const evidence = {
			fixtureId: input.fixtureId, scenario, phase, before, after, afterVerification,
			testResults,
			phaseResult: phaseResult(agent.output),
			agentExecution: { ok: agent.ok, exitCode: agent.exitCode },
			diff: command(workspaceDir, 'git', ['diff', '--no-ext-diff', '--no-textconv',
				before.git.head.output.trim(), '--']),
			cycleDiff: command(workspaceDir, 'git', ['diff', '--no-ext-diff', '--no-textconv', baselineHead, '--']),
			commits: commits(workspaceDir, baselineHead),
			priorPhases: records.map((record) => ({
				phase: record.phase, testResults: record.evidence.testResults,
				phaseResult: record.evidence.phaseResult,
			})),
		};
		// Raw agent output is kept locally, not included in the Jev state.
		const judgment = await judge({ phase, evidence });
		records.push({ phase, agent, evidence, judgment });
		before = afterVerification;
		if (!agent.ok || agent.exitCode !== 0) {
			status = 'agent-failed';
			break;
		}
		if (judgment.status !== 'scored') {
			status = 'judge-unavailable';
			break;
		}
	}
	return {
		summary: summary(input, records, status),
		artifacts: { fixtureInitialHead: input.initialHead, baseline, phases: records },
	};
}

async function runScenario(input) {
	const reason = process.env.TDD_JEV_ALLOW_PUBLIC_FIXTURE_UPLOAD !== '1'
		? 'Set TDD_JEV_ALLOW_PUBLIC_FIXTURE_UPLOAD=1 only for non-sensitive public calculator fixture evidence'
		: !process.env.TYPESAFE_API_KEY ? 'TYPESAFE_API_KEY is required' : null;
	if (reason) {
		return {
			summary: summary(input, [], 'unavailable'),
			artifacts: { reason },
		};
	}
	return runExperiment(input);
}

module.exports = { runScenario, runExperiment };
