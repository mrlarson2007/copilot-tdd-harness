'use strict';

const { setupWorkspaceAgentFiles, runCopilotAgent } = require('../agent-runner');

function deriveRequirementsFromOutput(agentOutput) {
  if (!agentOutput) return null;

  const plan = {
    schemaVersion: '1.0.0',
    hasPlan: false,
    hasGivenWhenThen: false,
    scenarioCount: 0,
    hasFeatureSummary: false,
    hasStakeholders: false,
    hasAssumptions: false,
    clarificationAsked: false,
    fileOutputOffered: false,
    agentOutputLength: agentOutput.length,
  };

  // Check if a Given/When/Then block exists
  const givenWhenThenPattern = /(?:^|\n)\s*(?:Given|Scenario|Feature)[^\n]*\n\s*(?:Given|When|And)[^\n]*\n\s*(?:Then|And)[^\n]*/im;
  if (givenWhenThenPattern.test(agentOutput)) {
    plan.hasGivenWhenThen = true;
  }

  // Count scenario blocks using a single canonical marker to avoid over-counting.
  const scenarioMatches = agentOutput.match(/^\s*Scenario:/gm);
  if (scenarioMatches) {
    plan.scenarioCount = scenarioMatches.length;
  }

  // Check for feature summary heading
  if (/^#+\s+(?:Feature|Feature Summary)/im.test(agentOutput)) {
    plan.hasFeatureSummary = true;
    plan.hasPlan = true;
  }

  // Check for stakeholders section
  if (/stakeholders?|users?|affected parties/i.test(agentOutput)) {
    plan.hasStakeholders = true;
  }

  // Check for assumptions or open questions
  if (/assumptions?|open questions?|clarifications needed/i.test(agentOutput)) {
    plan.hasAssumptions = true;
  }

  // Check if a clarification question was asked
  const explicitQuestionPattern = /\?/m;
  const clarificationPromptPattern = /(which\s+authentication\s+outcome|clarify|before\s+guessing|without\s+guessing)/i;
  if (explicitQuestionPattern.test(agentOutput) || clarificationPromptPattern.test(agentOutput)) {
    plan.clarificationAsked = true;
  }

  // Check if file output was offered
  if (/docs\/requirements|save.*to|write.*file|confirm.*location|confirm.*path|confirm.*filename/i.test(agentOutput)) {
    plan.fileOutputOffered = true;
  }

  return plan;
}

module.exports = async function runScenario(input) {
  const { workspaceDir, prompt } = input;
  const fs = require('fs');

  // Requirements-planning needs agent files but not fixture code.
  // Set up a minimal workspace with just the requirements-planning agent/skill.
  let runDir = workspaceDir || process.cwd();
  let tempWorkspace = null;
  
  if (!workspaceDir) {
    // Create a minimal workspace in temp for agent file setup
    const path = require('path');
    const os = require('os');
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-requirements-planning-'));
    
    // Copy requirements-planning agent and skill
    const REPO_ROOT = path.resolve(__dirname, '../../../../');
    const agentSrc = path.join(REPO_ROOT, '.github', 'agents', 'requirements-planning.agent.md');
    const agentDest = path.join(tempWorkspace, '.github', 'agents', 'requirements-planning.agent.md');
    fs.mkdirSync(path.dirname(agentDest), { recursive: true });
    fs.copyFileSync(agentSrc, agentDest);
    
    const skillSrc = path.join(REPO_ROOT, '.github', 'skills', 'requirements-planning');
    const skillDest = path.join(tempWorkspace, '.github', 'skills', 'requirements-planning');
    const copyDir = (src, dest) => {
      fs.mkdirSync(dest, { recursive: true });
      for (const file of fs.readdirSync(src)) {
        const srcFile = path.join(src, file);
        const destFile = path.join(dest, file);
        if (fs.statSync(srcFile).isDirectory()) {
          copyDir(srcFile, destFile);
        } else {
          fs.copyFileSync(srcFile, destFile);
        }
      }
    };
    copyDir(skillSrc, skillDest);
    
    runDir = tempWorkspace;
  } else {
    setupWorkspaceAgentFiles(workspaceDir);
  }

  try {
    const agentResult = await runCopilotAgent(runDir, prompt, {
      progressLabel: input.scenarioId || 'requirements-planning',
      agentName: 'requirements-planning',
      failOnClarificationQuestion: false,
      timeout: 2 * 60 * 1000,
    });

    const summary = deriveRequirementsFromOutput(agentResult.output);

    return {
      summary,
      artifacts: {
        agentOutput: agentResult.output,
        agentExitCode: agentResult.exitCode,
      },
    };
  } finally {
    if (tempWorkspace) {
      try {
        fs.rmSync(tempWorkspace, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 100,
        });
      } catch (cleanupError) {
        // Best-effort cleanup only; do not fail the scenario on transient OS file locks.
        if (!cleanupError || !['EPERM', 'EBUSY'].includes(cleanupError.code)) {
          throw cleanupError;
        }
      }
    }
  }
};
