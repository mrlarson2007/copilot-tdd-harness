'use strict';

const { setupWorkspaceAgentFiles, runCopilotAgent } = require('../agent-runner');
const { deriveRunSummary } = require('../summary-deriver');
const { runGoTests } = require('./scenario-helpers');

/**
 * Ambiguous-prompt scenario: the task is intentionally vague ("add another
 * arithmetic subcommand"). The agent must ask a clarifying question before
 * starting RED rather than self-resolving the ambiguity.
 *
 * We use a short 2-minute timeout. In non-interactive mode the agent will
 * output the question and then wait for a response that never comes — the
 * timeout kills the process. The captured output is enough to verify the
 * agent paused for clarification instead of proceeding unilaterally.
 */
module.exports = async function runScenario(input) {
  const { workspaceDir, initialHead, prompt } = input;

  setupWorkspaceAgentFiles(workspaceDir);
  const agentResult = await runCopilotAgent(workspaceDir, prompt, {
    progressLabel: `${input.scenarioId || 'feature-add-multiply-command'}.clarify`,
    timeout: 2 * 60 * 1000,
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