'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// This file lives at evals/fixtures/scenarios/agent-runner.js — 3 levels up is the repo root.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Copy the tdd agent and skill files from the AgentTdd repo into the
 * disposable workspace so `copilot --agent=tdd` can resolve them.
 */
function setupWorkspaceAgentFiles(workspaceDir) {
  const agentSrc = path.join(REPO_ROOT, '.github', 'agents', 'tdd.agent.md');
  const agentDest = path.join(workspaceDir, '.github', 'agents', 'tdd.agent.md');
  fs.mkdirSync(path.dirname(agentDest), { recursive: true });
  fs.copyFileSync(agentSrc, agentDest);

  const skillSrc = path.join(REPO_ROOT, '.github', 'skills', 'tdd-workflow');
  const skillDest = path.join(workspaceDir, '.github', 'skills', 'tdd-workflow');
  copyDir(skillSrc, skillDest);
}

/**
 * Run `copilot --agent=tdd` non-interactively inside the workspace.
 * Returns { ok, output, exitCode }.
 */
function runCopilotAgent(workspaceDir, prompt, options = {}) {
  const timeout = options.timeout ?? 10 * 60 * 1000;
  try {
    const output = execFileSync('copilot', [
      '--agent=tdd',
      '--prompt', prompt,
      '--allow-all-tools',
    ], {
      cwd: workspaceDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });
    return { ok: true, output, exitCode: 0 };
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}`;
    return { ok: error.status === 0, output, exitCode: error.status ?? 1 };
  }
}

module.exports = { setupWorkspaceAgentFiles, runCopilotAgent };
