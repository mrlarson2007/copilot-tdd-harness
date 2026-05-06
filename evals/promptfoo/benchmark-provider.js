const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function getVars(context) {
  return context?.vars || context?.test?.vars || context?.prompt?.vars || {};
}

function resolvePath(relativePath, baseDir = __dirname) {
  return path.resolve(baseDir, relativePath);
}

function runGitCommand(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function initializeWorkspaceRepo(workspaceDir, fixtureId, baselineId) {
  runGitCommand(['init', '--quiet'], workspaceDir);
  runGitCommand(['config', 'user.name', 'promptfoo-eval'], workspaceDir);
  runGitCommand(['config', 'user.email', 'promptfoo-eval@local.invalid'], workspaceDir);
  runGitCommand(['config', 'commit.gpgsign', 'false'], workspaceDir);
  runGitCommand(['add', '--all'], workspaceDir);
  runGitCommand(
    ['commit', '--quiet', '--allow-empty', '-m', `baseline:${fixtureId}/${baselineId}`],
    workspaceDir,
  );

  return runGitCommand(['rev-parse', 'HEAD'], workspaceDir);
}

function prepareDisposableWorkspace(vars) {
  if (!vars.fixtureSourcePath) {
    return null;
  }

  const fixtureId = vars.fixtureId || 'fixture';
  const baselineId = vars.baselineId || 'clean';
  const fixtureSourcePath = resolvePath(vars.fixtureSourcePath);

  if (!fs.existsSync(fixtureSourcePath)) {
    throw new Error(`Fixture source path does not exist: ${fixtureSourcePath}`);
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-tdd-harness-'));
  const workspaceDir = path.join(tempRoot, `${fixtureId}-${baselineId}`);
  fs.cpSync(fixtureSourcePath, workspaceDir, { recursive: true });

  const initialHead = initializeWorkspaceRepo(workspaceDir, fixtureId, baselineId);

  return {
    tempRoot,
    workspaceDir,
    initialHead,
    fixtureSourcePath,
  };
}

function removeDisposableWorkspace(workspace) {
  if (!workspace) {
    return;
  }

  fs.rmSync(workspace.tempRoot, { recursive: true, force: true });
}

function readSummary(summaryPath) {
  const raw = fs.readFileSync(summaryPath, 'utf8');
  return JSON.parse(raw);
}

async function executeScenarioModule(scenarioModulePath, input) {
  const absoluteScenarioModulePath = resolvePath(scenarioModulePath);
  const loadedModule = require(absoluteScenarioModulePath);
  const runScenario =
    typeof loadedModule === 'function' ? loadedModule : loadedModule?.runScenario;

  if (typeof runScenario !== 'function') {
    throw new Error(`Scenario module must export a function: ${absoluteScenarioModulePath}`);
  }

  const result = await runScenario(input);
  if (!result || typeof result !== 'object' || typeof result.summary !== 'object') {
    throw new Error(`Scenario module must return an object containing { summary }: ${absoluteScenarioModulePath}`);
  }

  return {
    ...result,
    scenarioModulePath: absoluteScenarioModulePath,
  };
}

class BenchmarkProvider {
  constructor(options = {}) {
    this.options = options;
  }

  id() {
    return this.options.id || 'tdd-agent-benchmark-provider';
  }

  async callApi(_prompt, context) {
    const vars = getVars(context);
    const summaryPath = vars.summaryPath;
    const scenarioModulePath = vars.scenarioModulePath;
    let workspace = null;

    if (!summaryPath && !scenarioModulePath) {
      throw new Error('Missing vars.summaryPath or vars.scenarioModulePath for promptfoo benchmark provider');
    }

    try {
      workspace = prepareDisposableWorkspace(vars);
      let output;
      let absoluteSummaryPath = null;
      let scenarioResult = null;

      if (scenarioModulePath) {
        scenarioResult = await executeScenarioModule(scenarioModulePath, {
          workspaceDir: workspace?.workspaceDir || null,
          fixtureId: vars.fixtureId || null,
          baselineId: vars.baselineId || 'clean',
          scenarioId: vars.scenarioId || null,
          scenarioFamily: vars.scenarioFamily || null,
          runMode: vars.runMode || null,
          prompt: vars.taskPrompt || _prompt,
          initialHead: workspace?.initialHead || null,
          vars,
        });
        output = scenarioResult.summary;
      } else {
        absoluteSummaryPath = resolvePath(summaryPath);
        output = readSummary(absoluteSummaryPath);
      }

      return {
        output,
        metadata: {
          summaryPath: absoluteSummaryPath,
          fixtureId: output.fixtureId,
          scenarioId: output.scenarioId,
          scenarioFamily: output.scenarioFamily,
          runMode: output.runMode,
          workspacePrepared: Boolean(workspace),
          workspaceInitialHead: workspace?.initialHead || null,
          workspaceSourcePath: workspace?.fixtureSourcePath || null,
          workspaceDisposed: !vars.persistWorkspace,
          scenarioModulePath: scenarioResult?.scenarioModulePath || null,
          scenarioArtifacts: scenarioResult?.artifacts || null,
        },
      };
    } finally {
      if (!vars.persistWorkspace) {
        removeDisposableWorkspace(workspace);
      }
    }
  }
}

module.exports = BenchmarkProvider;