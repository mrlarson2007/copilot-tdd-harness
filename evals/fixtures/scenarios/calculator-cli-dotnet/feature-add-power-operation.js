'use strict';

const { setupWorkspaceAgentFiles, runCopilotAgent } = require('../agent-runner');
const { deriveRunSummary } = require('../summary-deriver');
const { runDotnetTests } = require('./scenario-helpers');

module.exports = async function runScenario(input) {
  const { workspaceDir, initialHead, prompt } = input;

  setupWorkspaceAgentFiles(workspaceDir);
  const agentResult = runCopilotAgent(workspaceDir, prompt);
  const summary = deriveRunSummary(input, workspaceDir, initialHead, agentResult.output, runDotnetTests);

  return {
    summary,
    artifacts: {
      agentOutput: agentResult.output,
      agentExitCode: agentResult.exitCode,
    },
  };
};
