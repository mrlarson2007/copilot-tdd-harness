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

function appendSubtractTest(workspaceDir) {
  const testPath = path.join(workspaceDir, 'main_test.go');
  const content = fs.readFileSync(testPath, 'utf8');
  const addition = `

func TestSubtractCommand_PrintsDifference(t *testing.T) {
	cmd := exec.Command("go", "run", ".", "subtract", "9", "4")
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("expected subtract command to succeed, got error %v with output %s", err, string(output))
	}

	if strings.TrimSpace(string(output)) != "5" {
		t.Fatalf("expected output 5, got %q", strings.TrimSpace(string(output)))
	}
}
`;

  fs.writeFileSync(testPath, `${content.trimEnd()}${addition}`, 'utf8');
}

function addSubtractImplementation(workspaceDir) {
  const mainPath = path.join(workspaceDir, 'main.go');
  const content = fs.readFileSync(mainPath, 'utf8');
  const updatedUsage = content.replace(
    'fmt.Println("usage: calc <add> <left> <right>")',
    'fmt.Println("usage: calc <add|subtract> <left> <right>")',
  );
  const updated = updatedUsage.replace(
    /case "add":\r?\n([ \t]+)fmt\.Println\(left \+ right\)/,
    'case "add":\n$1fmt.Println(left + right)\n\tcase "subtract":\n\t\tfmt.Println(left - right)',
  );

  if (updated === content || updated === updatedUsage) {
    throw new Error('Failed to apply subtract implementation to fixture main.go');
  }

  fs.writeFileSync(mainPath, updated, 'utf8');
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
    coverageDelta: null,
    ...overrides,
  };
}

module.exports = {
  appendSubtractTest,
  addSubtractImplementation,
  buildSummary,
  commitAll,
  commitRangeCount,
  latestCommitRef,
  runGoTests,
  stageAll,
};