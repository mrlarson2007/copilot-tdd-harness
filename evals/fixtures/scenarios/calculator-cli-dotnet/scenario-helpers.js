const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function runCommand(command, args, cwd) {
  try {
    const output = execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return { ok: true, exitCode: 0, output };
  } catch (error) {
    return {
      ok: false,
      exitCode: error.status ?? 1,
      output: `${error.stdout || ''}${error.stderr || ''}`,
    };
  }
}

function git(cwd, args) {
  return runCommand('git', args, cwd);
}

function commitRangeCount(cwd, initialHead) {
  const result = git(cwd, ['rev-list', '--count', `${initialHead}..HEAD`]);
  return result.ok ? Number.parseInt(result.output.trim(), 10) : 0;
}

function latestCommitRef(cwd) {
  const result = git(cwd, ['rev-parse', 'HEAD']);
  return result.ok ? result.output.trim() : null;
}

function appendPowerTest(workspaceDir) {
  const testPath = path.join(workspaceDir, 'CalculatorTui.Tests', 'CalculatorEngineTests.cs');
  const content = fs.readFileSync(testPath, 'utf8');
  const trimmed = content.trimEnd();
  const withoutClosingBrace = trimmed.replace(/\}\s*$/, '');
  const addition = `

    [Fact]
    public void Power_WhenTwoNumbersProvided_ShouldReturnExponentResult()
    {
        var calculator = new CalculatorEngine();

        var result = calculator.Power(2m, 3m);

        Assert.Equal(8m, result);
    }
}`;

  fs.writeFileSync(testPath, `${withoutClosingBrace}${addition}
`, 'utf8');
}

function addPowerImplementation(workspaceDir) {
  const enginePath = path.join(workspaceDir, 'CalculatorTui', 'CalculatorEngine.cs');
  const content = fs.readFileSync(enginePath, 'utf8');
  const updated = content.replace(
    /    public decimal Subtract\(decimal left, decimal right\)\r?\n    \{\r?\n        return left - right;\r?\n    \}\r?\n\}/,
    '    public decimal Subtract(decimal left, decimal right)\n    {\n        return left - right;\n    }\n\n    public decimal Power(decimal left, decimal right)\n    {\n        return (decimal)Math.Pow((double)left, (double)right);\n    }\n}',
  );

  if (updated === content) {
    throw new Error('Failed to apply Power implementation to CalculatorEngine.cs');
  }

  fs.writeFileSync(enginePath, updated, 'utf8');
}

function runDotnetTests(workspaceDir) {
  return runCommand('dotnet', ['test', 'CalculatorCliDotnet.slnx'], workspaceDir);
}

function stageAll(workspaceDir) {
  return git(workspaceDir, ['add', '--all']);
}

function commitAll(workspaceDir, message) {
  return git(workspaceDir, ['commit', '--quiet', '-m', message]);
}

function buildSummary(base, overrides) {
  return {
    schemaVersion: '1.0.0',
    fixtureId: base.fixtureId,
    baselineId: base.baselineId,
    scenarioId: base.scenarioId,
    scenarioFamily: base.scenarioFamily,
    runMode: base.runMode,
    prompt: base.prompt,
    clarificationAsked: false,
    clarificationResolved: false,
    clarificationResolution: null,
    coverageDelta: null,
    ...overrides,
  };
}

module.exports = {
  appendPowerTest,
  addPowerImplementation,
  buildSummary,
  commitAll,
  commitRangeCount,
  latestCommitRef,
  runDotnetTests,
  stageAll,
};