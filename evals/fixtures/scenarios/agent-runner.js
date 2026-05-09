'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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

function logRunnerProgress(label, message) {
  console.error(`[agent-runner:${label}] ${message}`);
}

function createQuestionDetector() {
  const questionPattern = /(^|\n)(?:which|what|should\s+i|would\s+you\s+like|do\s+you\s+want|can\s+you\s+clarify|could\s+you\s+clarify)[^\n]*\?\s*$/im;
  let scannedLength = 0;

  return {
    scan(output) {
      const slice = output.slice(scannedLength);
      scannedLength = output.length;
      const match = slice.match(questionPattern);
      return match ? match[0].trim() : null;
    },
  };
}

/**
 * Run `copilot --agent=tdd` non-interactively inside the workspace.
 * Returns { ok, output, exitCode } where output combines stdout + stderr.
 */
function runCopilotAgent(workspaceDir, prompt, options = {}) {
  const timeout = options.timeout ?? 10 * 60 * 1000;
  const progressLabel = options.progressLabel || path.basename(workspaceDir);
  const heartbeatMs = options.heartbeatMs ?? 15 * 1000;
  const questionDetector = createQuestionDetector();

  return new Promise((resolve) => {
    const proc = spawn('copilot', [
      '--agent=tdd',
      '--prompt', prompt,
      '--allow-all-tools',
    ], {
      cwd: workspaceDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    let settled = false;
    let killedForClarification = false;
    const startedAt = Date.now();

    logRunnerProgress(progressLabel, `starting prompt: ${JSON.stringify(prompt)}`);

    function finish(exitCode) {
      if (settled) {
        return;
      }

      settled = true;
      clearInterval(heartbeatHandle);
      clearTimeout(timeoutHandle);

      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      const resolvedExitCode = exitCode ?? (killedForClarification ? 2 : -1);
      logRunnerProgress(
        progressLabel,
        `finished in ${elapsedSeconds}s with exit code ${resolvedExitCode}${killedForClarification ? ' (clarification detected)' : ''}`,
      );

      resolve({ ok: resolvedExitCode === 0, output, exitCode: resolvedExitCode });
    }

    function appendOutput(chunk) {
      output += chunk.toString();

      const detectedQuestion = options.failOnClarificationQuestion
        ? questionDetector.scan(output)
        : null;
      if (detectedQuestion && !settled) {
        killedForClarification = true;
        logRunnerProgress(progressLabel, `detected clarification question and stopping early: ${detectedQuestion}`);
        proc.kill();
      }
    }

    proc.stdout.on('data', appendOutput);
    proc.stderr.on('data', appendOutput);

    proc.on('close', (code) => finish(code));
    proc.on('error', () => finish(1));

    const heartbeatHandle = setInterval(() => {
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      logRunnerProgress(progressLabel, `still running after ${elapsedSeconds}s`);
    }, heartbeatMs);

    const timeoutHandle = setTimeout(() => {
      logRunnerProgress(progressLabel, `timed out after ${Math.round(timeout / 1000)}s`);
      proc.kill();
      finish(-1);
    }, timeout);
  });
}

/**
 * Run `copilot --agent=tdd` interactively with piped stdin so the agent can
 * ask clarifying questions that we answer from the `responses` array.
 *
 * Strategy:
 *   - Start copilot without --prompt so it enters conversational mode.
 *   - Write `initialPrompt` to stdin after a short startup delay.
 *   - Poll collected output every 2 s; when a line ending in `?` appears and
 *     we have a pending response, write it to stdin.
 *   - Kill the process after `timeout` ms if it hasn't exited.
 *
 * Returns { ok, output, exitCode } where output combines stdout + stderr.
 */
function runCopilotAgentInteractive(workspaceDir, initialPrompt, responses = [], options = {}) {
  const timeout = options.timeout ?? 10 * 60 * 1000;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const startupDelayMs = options.startupDelayMs ?? 3000;

  return new Promise((resolve) => {
    const proc = spawn('copilot', ['--agent=tdd', '--allow-all-tools'], {
      cwd: workspaceDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let lastCheckedLen = 0;
    let responseIdx = 0;
    let settled = false;

    function finish(exitCode) {
      if (settled) return;
      settled = true;
      clearInterval(pollHandle);
      clearTimeout(killHandle);
      resolve({ ok: exitCode === 0, output, exitCode: exitCode ?? -1 });
    }

    proc.stdout.on('data', (chunk) => { output += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { output += chunk.toString(); });

    proc.on('close', (code) => finish(code));
    proc.on('error', () => finish(1));

    // Send the initial prompt after startup
    setTimeout(() => {
      if (!settled) proc.stdin.write(initialPrompt + '\n');
    }, startupDelayMs);

    // Poll for clarification questions and send prepared answers
    const QUESTION_RE = /\?\s*$/m;
    const pollHandle = setInterval(() => {
      if (settled || responseIdx >= responses.length) return;
      const newOutput = output.slice(lastCheckedLen);
      if (QUESTION_RE.test(newOutput)) {
        proc.stdin.write(responses[responseIdx++] + '\n');
      }
      lastCheckedLen = output.length;
    }, pollIntervalMs);

    const killHandle = setTimeout(() => {
      proc.kill();
      finish(-1);
    }, timeout);
  });
}

module.exports = { setupWorkspaceAgentFiles, runCopilotAgent, runCopilotAgentInteractive };
