'use strict';

const { setupWorkspaceAgentFiles, runCopilotAgent } = require('../agent-runner');
const { deriveRunSummary } = require('../summary-deriver');
const { runGoTests } = require('./scenario-helpers');

module.exports = async function runScenario(input) {
  const { workspaceDir, initialHead, prompt } = input;

  setupWorkspaceAgentFiles(workspaceDir);
  const agentResult = await runCopilotAgent(workspaceDir, prompt, {
    progressLabel: input.scenarioId || 'feature-add-subtract-command',
    failOnClarificationQuestion: true,
  });
  const summary = deriveRunSummary(input, workspaceDir, initialHead, agentResult.output, runGoTests);

  return {
    summary,
    artifacts: {
      agentOutput: agentResult.output,
      agentExitCode: agentResult.exitCode,
    },
  };
};
