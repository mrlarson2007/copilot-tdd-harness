'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { AsyncLocalStorage } = require('async_hooks');

// This file lives at evals/fixtures/scenarios/agent-runner.js — 3 levels up is the repo root.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const EVAL_CONDITIONS = ['harness', 'baseline'];
const evalRunContext = new AsyncLocalStorage();

/**
 * Reads the eval matrix cell for this process from the environment.
 *   EVAL_MODEL     - optional model id passed to `copilot --model`.
 *   EVAL_CONDITION - `harness` (default) installs the agent + skills and runs
 *                    `copilot --agent=<name>`; `baseline` installs nothing and
 *                    runs the default Copilot agent with the same prompt.
 */
function getEvalRunConfig(env = process.env, providerConfig = {}) {
  const scopedConfig = evalRunContext.getStore();
  if (scopedConfig) return scopedConfig;

  const modelValue = Object.hasOwn(providerConfig, 'evalModel') ? providerConfig.evalModel : env.EVAL_MODEL;
  const conditionValue = Object.hasOwn(providerConfig, 'evalCondition')
    ? providerConfig.evalCondition : env.EVAL_CONDITION;
  const model = (typeof modelValue === 'string' ? modelValue : '').trim() || null;
  const condition = (typeof conditionValue === 'string' ? conditionValue : 'harness').trim().toLowerCase();
  if (!EVAL_CONDITIONS.includes(condition)) {
    throw new Error(`EVAL_CONDITION must be one of ${EVAL_CONDITIONS.join(', ')}; got "${conditionValue}"`);
  }
  return { model, condition };
}

function withEvalRunConfig(config, callback) {
  if (!config || (config.model !== null && typeof config.model !== 'string')
    || !EVAL_CONDITIONS.includes(config.condition) || typeof callback !== 'function') {
    throw new Error('Invalid eval run context');
  }
  return evalRunContext.run(config, callback);
}

function buildCopilotArgs({ agentName, prompt, runConfig = getEvalRunConfig() }) {
  const args = [];
  if (runConfig.condition === 'harness' && agentName !== false) {
    args.push(`--agent=${agentName}`);
  }
  if (runConfig.model) {
    args.push('--model', runConfig.model);
  }
  if (prompt !== undefined) {
    args.push('--prompt', prompt);
  }
  args.push('--allow-all-tools');
  return args;
}

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
  if (getEvalRunConfig().condition === 'baseline') {
    return;
  }

  const agentSrc = path.join(REPO_ROOT, '.github', 'agents', 'tdd.agent.md');
  const agentDest = path.join(workspaceDir, '.github', 'agents', 'tdd.agent.md');
  fs.mkdirSync(path.dirname(agentDest), { recursive: true });
  fs.copyFileSync(agentSrc, agentDest);

  const cycleRunnerSrc = path.join(REPO_ROOT, '.github', 'agents', 'tdd-cycle-runner.agent.md');
  const cycleRunnerDest = path.join(workspaceDir, '.github', 'agents', 'tdd-cycle-runner.agent.md');
  fs.copyFileSync(cycleRunnerSrc, cycleRunnerDest);

  for (const skillName of [
    'tdd-planning',
    'tdd-workflow',
    'tdd-cycle-runner',
    'tdd-red',
    'tdd-green',
    'tdd-commit',
    'tdd-refactor',
  ]) {
    const skillSrc = path.join(REPO_ROOT, '.github', 'skills', skillName);
    const skillDest = path.join(workspaceDir, '.github', 'skills', skillName);
    copyDir(skillSrc, skillDest);
  }

  const contractsSrc = path.join(REPO_ROOT, '.github', 'contracts');
  const contractsDest = path.join(workspaceDir, '.github', 'contracts');
  copyDir(contractsSrc, contractsDest);
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
  const agentName = options.agentName || 'tdd';
  const processGroup = Boolean(options.processGroup) && process.platform !== 'win32';
  const questionDetector = createQuestionDetector();

  return new Promise((resolve) => {
    const proc = spawn('copilot', buildCopilotArgs({
      agentName: options.agentName === false ? false : agentName,
      prompt,
    }), {
      cwd: workspaceDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: processGroup,
      env: options.env || process.env,
    });

    let output = '';
    let settled = false;
    let killedForClarification = false;
    let timedOut = false;
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
      const resolvedExitCode = timedOut ? -1 : (exitCode ?? (killedForClarification ? 2 : -1));
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
    proc.on('error', (error) => {
      output += `\n${error.message}`;
      finish(1);
    });

    const heartbeatHandle = setInterval(() => {
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      logRunnerProgress(progressLabel, `still running after ${elapsedSeconds}s`);
    }, heartbeatMs);

    const timeoutHandle = setTimeout(() => {
      logRunnerProgress(progressLabel, `timed out after ${Math.round(timeout / 1000)}s`);
      if (options.processGroup) {
        timedOut = true;
        if (proc.pid) {
          try {
            if (processGroup) {
              process.kill(-proc.pid, 'SIGKILL');
            } else {
              execFileSync('taskkill', ['/pid', String(proc.pid), '/T', '/F']);
            }
          } catch (error) {
            output += `\nUnable to stop agent process tree: ${error.message}`;
            proc.kill('SIGKILL');
          }
        }
        // Wait for close before collecting artifacts from the workspace.
        return;
      }
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
  const agentName = options.agentName || 'tdd';

  return new Promise((resolve) => {
    const proc = spawn('copilot', buildCopilotArgs({ agentName }), {
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

module.exports = {
  buildCopilotArgs,
  getEvalRunConfig,
  withEvalRunConfig,
  setupWorkspaceAgentFiles,
  runCopilotAgent,
  runCopilotAgentInteractive,
};
