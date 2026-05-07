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

    return {
      ok: true,
      exitCode: 0,
      output,
    };
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

function appendOperationTest(workspaceDir, options) {
  const {
    commandName,
    leftOperand,
    rightOperand,
    expectedOutput,
    testName,
  } = options;
  const testPath = path.join(workspaceDir, 'main_test.go');
  const content = fs.readFileSync(testPath, 'utf8');
  const addition = `

func ${testName}(t *testing.T) {
	cmd := exec.Command("go", "run", ".", "${commandName}", "${leftOperand}", "${rightOperand}")
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("expected ${commandName} command to succeed, got error %v with output %s", err, string(output))
	}

	if strings.TrimSpace(string(output)) != "${expectedOutput}" {
		t.Fatalf("expected output ${expectedOutput}, got %q", strings.TrimSpace(string(output)))
	}
}
`;

  fs.writeFileSync(testPath, `${content.trimEnd()}${addition}`, 'utf8');
}

function appendSubtractTest(workspaceDir) {
  appendOperationTest(workspaceDir, {
    commandName: 'subtract',
    leftOperand: 9,
    rightOperand: 4,
    expectedOutput: 5,
    testName: 'TestSubtractCommand_PrintsDifference',
  });
}

function addOperationImplementation(workspaceDir, options) {
  const { commandName, usageLabel, expression } = options;
  const mainPath = path.join(workspaceDir, 'main.go');
  const content = fs.readFileSync(mainPath, 'utf8');
  const updatedUsage = content.replace(
    'fmt.Println("usage: calc <add> <left> <right>")',
    `fmt.Println("usage: calc <add|${usageLabel}> <left> <right>")`,
  );
  const updated = updatedUsage.replace(
    /case "add":\r?\n([ \t]+)fmt\.Println\(left \+ right\)/,
    `case "add":\n$1fmt.Println(left + right)\n\tcase "${commandName}":\n\t\tfmt.Println(${expression})`,
  );

  if (updated === content || updated === updatedUsage) {
    throw new Error(`Failed to apply ${commandName} implementation to fixture main.go`);
  }

  fs.writeFileSync(mainPath, updated, 'utf8');
}

function addSubtractImplementation(workspaceDir) {
  addOperationImplementation(workspaceDir, {
    commandName: 'subtract',
    usageLabel: 'subtract',
    expression: 'left - right',
  });
}

function addMultiplyImplementation(workspaceDir) {
  addOperationImplementation(workspaceDir, {
    commandName: 'multiply',
    usageLabel: 'multiply',
    expression: 'left * right',
  });
}

function addDivideImplementation(workspaceDir) {
  const mainPath = path.join(workspaceDir, 'main.go');
  const content = fs.readFileSync(mainPath, 'utf8');
  const updated = content.replace(
    /default:\r?\n\t\tfmt\.Printf\("unknown command: %s\\n", os\.Args\[1\]\)\r?\n\t\tos\.Exit\(1\)/,
    'case "divide":\n\t\tif right == 0 {\n\t\t\tfmt.Println("cannot divide by zero")\n\t\t\tos.Exit(1)\n\t\t}\n\t\tfmt.Println(left / right)\n\tdefault:\n\t\tfmt.Printf("unknown command: %s\\n", os.Args[1])\n\t\tos.Exit(1)',
  );

  if (updated === content) {
    throw new Error('Failed to apply divide implementation to fixture main.go');
  }

  fs.writeFileSync(mainPath, updated, 'utf8');
}

function appendMultiplyTest(workspaceDir) {
  appendOperationTest(workspaceDir, {
    commandName: 'multiply',
    leftOperand: 6,
    rightOperand: 7,
    expectedOutput: 42,
    testName: 'TestMultiplyCommand_PrintsProduct',
  });
}

function appendDivideByZeroTest(workspaceDir) {
  const testPath = path.join(workspaceDir, 'main_test.go');
  const content = fs.readFileSync(testPath, 'utf8');
  const addition = `

func TestDivideCommand_WhenRightOperandIsZero_PrintsFriendlyError(t *testing.T) {
  cmd := exec.Command("go", "run", ".", "divide", "8", "0")
  output, err := cmd.CombinedOutput()
  if err == nil {
    t.Fatalf("expected divide command to fail for zero divisor, got output %s", string(output))
  }

  if !strings.Contains(string(output), "cannot divide by zero") {
    t.Fatalf("expected friendly divide by zero error, got %q", strings.TrimSpace(string(output)))
  }
}
`;

  fs.writeFileSync(testPath, `${content.trimEnd()}${addition}`, 'utf8');
}

function runGoTests(workspaceDir) {
  return runCommand('go', ['test', './...'], workspaceDir);
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
  addDivideImplementation,
  addMultiplyImplementation,
  addOperationImplementation,
  appendDivideByZeroTest,
  appendSubtractTest,
  appendMultiplyTest,
  appendOperationTest,
  addSubtractImplementation,
  buildSummary,
  commitAll,
  commitRangeCount,
  latestCommitRef,
  runGoTests,
  stageAll,
};