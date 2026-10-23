'use strict';

const fs = require('fs');
const path = require('path');
const { runCopilotAgent } = require('../agent-runner');
const { evaluateRed } = require('./red-evaluator');

const repoRoot = path.resolve(__dirname, '../../../..');
const redPrompt = `
Execute RED in isolation for this concrete scenario:
Given the calculator CLI, when invoked as "go run . subtract 9 4",
it should exit successfully and print 5.

Read and execute .github/skills/tdd-red/SKILL.md and its referenced assets.
Use its real .github/skills/tdd-test-run/SKILL.md dependency and assets
to verify one new failing test. Load .github/contracts/tdd-cycle-contracts.md
and the fixture's .github/instructions/tdd-patterns.instructions.md.
The expected baseline assertion failure is the unsupported subtract command
("unknown command: subtract"), not a compiler or dependency error.

Append one test to main_test.go without altering any existing bytes, or create
one new root-level *_test.go file. Do not change production, configuration,
or existing assertions. Return the RED result and STOP; do not proceed to GREEN,
COMMIT, REFACTOR, or the cycle runner. Do not commit.
`;

function setupRedWorkspace(workspaceDir) {
	for (const skill of ['tdd-red', 'tdd-test-run']) {
		fs.cpSync(path.join(repoRoot, '.github', 'skills', skill),
			path.join(workspaceDir, '.github', 'skills', skill), { recursive: true });
	}
	fs.cpSync(path.join(repoRoot, '.github', 'contracts'),
		path.join(workspaceDir, '.github', 'contracts'), { recursive: true });
}

async function runScenario(input) {
	setupRedWorkspace(input.workspaceDir);
	const result = await evaluateRed(input.workspaceDir, () => runCopilotAgent(input.workspaceDir, redPrompt, {
		agentName: false,
		processGroup: true,
		progressLabel: 'red-only',
	}));
	return {
		summary: {
			fixtureId: input.fixtureId,
			baselineId: input.baselineId,
			scenarioId: input.scenarioId,
			runMode: 'red-only',
			pass: result.pass,
			checks: result.checks,
		},
		artifacts: {
			redPrompt,
			agent: result.agent,
			...result.evidence,
		},
	};
}

module.exports = { runScenario, setupRedWorkspace };
