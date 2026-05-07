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

function sanitizePathSegment(value, fallback) {
  const normalized = String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-');

  return normalized || fallback;
}

function readGitArtifact(workspaceDir, args) {
  try {
    return runGitCommand(args, workspaceDir);
  } catch {
    return '';
  }
}

function persistScenarioArtifacts(workspace, output, scenarioResult, vars) {
  if (!workspace) {
    return null;
  }

  const artifactRoot = resolvePath(
    vars.artifactOutputDir || './results/run-artifacts',
    __dirname,
  );
  const runId = sanitizePathSegment(
    vars.runArtifactId || `${Date.now()}-${process.pid}`,
    'run',
  );
  const artifactDir = path.join(
    artifactRoot,
    sanitizePathSegment(output.fixtureId, 'fixture'),
    sanitizePathSegment(output.scenarioId, 'scenario'),
    runId,
  );

  fs.mkdirSync(artifactDir, { recursive: true });

  fs.writeFileSync(
    path.join(artifactDir, 'summary.json'),
    `${JSON.stringify(output, null, 2)}\n`,
    'utf8',
  );

  fs.writeFileSync(
    path.join(artifactDir, 'scenario-artifacts.json'),
    `${JSON.stringify(scenarioResult?.artifacts || {}, null, 2)}\n`,
    'utf8',
  );

  fs.writeFileSync(
    path.join(artifactDir, 'git-status.txt'),
    `${readGitArtifact(workspace.workspaceDir, ['status', '--short'])}\n`,
    'utf8',
  );

  fs.writeFileSync(
    path.join(artifactDir, 'git-log.txt'),
    `${readGitArtifact(workspace.workspaceDir, ['log', '--oneline', '--decorate', '--graph', '--max-count=20'])}\n`,
    'utf8',
  );

  fs.writeFileSync(
    path.join(artifactDir, 'git-diff.txt'),
    `${readGitArtifact(workspace.workspaceDir, ['diff', `${workspace.initialHead}..HEAD`])}\n`,
    'utf8',
  );

  return artifactDir;
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
    const scenarioModulePath = vars.scenarioModulePath;
    let workspace = null;

    if (!scenarioModulePath) {
      throw new Error('Missing vars.scenarioModulePath for promptfoo benchmark provider');
    }

    try {
      workspace = prepareDisposableWorkspace(vars);
      const scenarioResult = await executeScenarioModule(scenarioModulePath, {
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
      const output = scenarioResult.summary;
      const artifactDir = persistScenarioArtifacts(workspace, output, scenarioResult, vars);

      return {
        output,
        metadata: {
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
          artifactDir,
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