'use strict';

const fs = require('fs');
const path = require('path');
const { setupWorkspaceAgentFiles, runCopilotAgent } = require('../agent-runner');
const { deriveRunSummary } = require('../summary-deriver');
const { runGoTests } = require('./scenario-helpers');

/**
 * Simulates a commit-discipline failure: the agent runs normally (RED→GREEN→COMMIT),
 * then we inject an uncommitted production file into the workspace — mimicking what
 * happens when an agent refactors but forgets the post-REFACTOR commit.
 *
 * Expected result: commit_discipline assertion FAILS, proving the eval can catch
 * the real bug before we rely on it in production.
 */
module.exports = async function runScenario(input) {
  const { workspaceDir, initialHead, prompt } = input;

  setupWorkspaceAgentFiles(workspaceDir);
  const agentResult = await runCopilotAgent(workspaceDir, prompt, {
    progressLabel: input.scenarioId || 'commit-discipline-failure',
    failOnClarificationQuestion: true,
  });

  // ---- Inject uncommitted refactor change (simulates forgotten REFACTOR commit) ----
  const injectedFile = path.join(workspaceDir, 'subtract_refactored.go');
  fs.writeFileSync(injectedFile, `package main\n\n// Refactored subtract — NOT committed\nfunc subtractRefactored(a, b int) int { return a - b }\n`);
  // ------------------------------------------------------------------------------------

  const summary = deriveRunSummary(input, workspaceDir, initialHead, agentResult.output, runGoTests);

  return {
    summary,
    artifacts: {
      agentOutput: agentResult.output,
      agentExitCode: agentResult.exitCode,
      injectedUncommittedFile: injectedFile,
    },
  };
};
