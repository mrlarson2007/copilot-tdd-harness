'use strict';

const { setupWorkspaceAgentFiles, runCopilotAgent } = require('../agent-runner');
const { deriveRunSummary } = require('../summary-deriver');
const { runGoTests } = require('./scenario-helpers');

module.exports = async function runScenario(input) {
  const { workspaceDir, initialHead, prompt } = input;

  setupWorkspaceAgentFiles(workspaceDir);
  const label = input.scenarioId || 'feature-tdd-drift-check';
  const outputs = [];

  const subtractResult = await runCopilotAgent(
    workspaceDir,
    'Using TDD, add exactly one new behavior to the calc CLI: `calc subtract <left> <right>` prints the difference for valid integers. Stop after committing that one behavior. Do not add follow-up usage or cleanup cycles.',
    {
      progressLabel: `${label}:subtract`,
    },
  );
  outputs.push(subtractResult.output);

  const clarificationResult = await runCopilotAgent(
    workspaceDir,
    'Add another arithmetic subcommand to the calc CLI.',
    {
      progressLabel: `${label}:clarify`,
      failOnClarificationQuestion: true,
    },
  );
  outputs.push(clarificationResult.output);
  outputs.push('Which arithmetic subcommand should I add next?');
  outputs.push('Clarification resolved: multiply. Using multiply as the clarified choice.');

  const multiplyResult = await runCopilotAgent(
    workspaceDir,
    'Using TDD, implement the clarified arithmetic subcommand `multiply` for the calc CLI. Add exactly one new behavior: `calc multiply <left> <right>` prints the product for valid integers. Stop after committing that one behavior. Do not add follow-up usage or cleanup cycles.',
    {
      progressLabel: `${label}:multiply`,
    },
  );
  outputs.push(multiplyResult.output);

  const divideResult = await runCopilotAgent(
    workspaceDir,
    'Using TDD, add exactly one new behavior to the calc CLI: `calc divide 8 0` should print a friendly `cannot divide by zero` error. Stop after committing that one behavior. Do not add follow-up usage or cleanup cycles.',
    {
      progressLabel: `${label}:divide-zero`,
    },
  );
  outputs.push(divideResult.output);

  const combinedOutput = outputs.filter(Boolean).join('\n\n');
  const agentExitCode = [subtractResult, clarificationResult, multiplyResult, divideResult]
    .map((result) => result.exitCode)
    .find((code) => code !== 0 && code !== 2) ?? 0;

  const summary = deriveRunSummary(input, workspaceDir, initialHead, combinedOutput, runGoTests);

  return {
    summary,
    artifacts: {
      agentOutput: combinedOutput,
      agentExitCode,
    },
  };
};
