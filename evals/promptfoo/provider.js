const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');

const execFileAsync = promisify(execFile);

function resolveVars(options, context) {
  const candidate = context || options || {};
  if (candidate && typeof candidate === 'object' && candidate.vars && typeof candidate.vars === 'object') {
    return candidate.vars;
  }
  if (candidate && typeof candidate === 'object') {
    return candidate;
  }
  return {};
}

async function runCommand(command, args, cwd, env) {
  return execFileAsync(command, args, {
    cwd,
    env,
    windowsHide: true,
  });
}

async function invokeRunner(repoRoot, mode, env) {
  if (process.platform === 'win32') {
    const windowsArgs = ['-NoProfile', '-File', path.join(repoRoot, 'scripts', 'tdd-run-tests.ps1'), mode];
    try {
      return await runCommand('pwsh', windowsArgs, repoRoot, env);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      return runCommand('powershell', windowsArgs, repoRoot, env);
    }
  }

  return runCommand('bash', [path.join(repoRoot, 'scripts', 'tdd-run-tests.sh'), mode], repoRoot, env);
}

module.exports = class TddRunTestsProvider {
  id() {
    return 'tdd-run-tests-provider';
  }

  async callApi(_prompt, _options, context) {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const vars = resolveVars(_options, context);
    const mode = vars.mode || 'eval';
    const env = {
      ...process.env,
      TDD_PHASE: vars.phase || process.env.TDD_PHASE || '',
      STOP_HOOK_ACTIVE: String(vars.stopHookActive ?? process.env.STOP_HOOK_ACTIVE ?? ''),
      TDD_TEST_COMMAND: vars.testCommand || process.env.TDD_TEST_COMMAND || '',
      TDD_TEST_WORKING_DIR: vars.testWorkingDir || process.env.TDD_TEST_WORKING_DIR || '.',
    };

    const { stdout, stderr } = await invokeRunner(repoRoot, mode, env);
    const combinedOutput = `${stdout}${stderr}`.trim();
    const parsed = JSON.parse(stdout || '{}');

    return {
      output: parsed,
      metadata: {
        mode,
        rawOutput: combinedOutput,
      },
    };
  }
};