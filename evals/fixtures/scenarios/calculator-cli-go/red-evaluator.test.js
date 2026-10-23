'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { evaluateRed } = require('./red-evaluator');
const { addSubtractImplementation } = require('./scenario-helpers');

const fixture = path.resolve(__dirname, '../../projects/calculator-cli-go/clean');
const newTest = `
func TestWhenSubtractRequested_ShouldPrintDifference(t *testing.T) {
	cmd := exec.Command("go", "run", ".", "subtract", "9", "4")
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("expected subtract to succeed: %v: %s", err, output)
	}
	if strings.TrimSpace(string(output)) != "5" {
		t.Fatalf("expected difference 5, got %q", output)
	}
}
`;

function git(dir, ...args) {
	return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

async function evaluate(t, mutate) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'red-evaluator-test-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	fs.cpSync(fixture, dir, { recursive: true });
	git(dir, 'init', '--quiet');
	git(dir, 'config', 'user.name', 'eval-test');
	git(dir, 'config', 'user.email', 'eval-test@local.invalid');
	git(dir, 'config', 'commit.gpgsign', 'false');
	git(dir, 'add', '.');
	git(dir, 'commit', '--quiet', '-m', 'baseline');
	const result = await evaluateRed(dir, async () => {
		await mutate(dir);
		return { ok: true, exitCode: 0, output: 'red_result: ok (not evidence)' };
	});
	if (process.env.RED_EVAL_TEST_ARTIFACT_DIR) {
		const artifactDir = path.resolve(process.env.RED_EVAL_TEST_ARTIFACT_DIR);
		fs.mkdirSync(artifactDir, { recursive: true });
		const name = t.name.replace(/[^a-zA-Z0-9-]+/g, '-');
		fs.writeFileSync(path.join(artifactDir, `${name}.json`), JSON.stringify({
			kind: 'synthetic-evaluator-unit-test',
			testName: t.name,
			...result,
		}, null, 2));
	}
	return result;
}

test('accepts one useful uncommitted RED test using actual Go and Git evidence', async (t) => {
	const result = await evaluate(t, (dir) => fs.appendFileSync(path.join(dir, 'main_test.go'), newTest));
	assert.equal(result.pass, true, JSON.stringify(result.checks));
	assert.equal(result.evidence.red.selected.exitCode, 1);
	assert.equal(result.evidence.knownImplementation.suite.exitCode, 0);
	assert.match(result.evidence.red.git.diff.output, /subtract/);
});

test('rejects no new test despite an agent claiming RED success', async (t) => {
	const result = await evaluate(t, () => {});
	assert.equal(result.pass, false);
	assert.equal(result.checks.oneNewTest, false);
});

test('rejects a new test already passing on the baseline', async (t) => {
	const result = await evaluate(t, (dir) => fs.appendFileSync(path.join(dir, 'main_test.go'),
		newTest.replace('"subtract"', '"add"').replace('!= "5"', '!= "13"')));
	assert.equal(result.pass, false);
	assert.equal(result.checks.expectedAssertionFailure, false);
	assert.equal(result.evidence.red.selected.exitCode, 0);
});

test('rejects agent production edits', async (t) => {
	const result = await evaluate(t, (dir) => {
		fs.appendFileSync(path.join(dir, 'main_test.go'), newTest);
		addSubtractImplementation(dir);
	});
	assert.equal(result.pass, false);
	assert.equal(result.checks.onlyTestsChanged, false);
});

test('rejects compilation failure rather than counting it as RED', async (t) => {
	const result = await evaluate(t, (dir) =>
		fs.appendFileSync(path.join(dir, 'main_test.go'), newTest.replace('cmd :=', 'cmd =')));
	assert.equal(result.pass, false);
	assert.equal(result.checks.oneNewTest, false);
	assert.match(result.evidence.red.list.output, /undefined: cmd/);
});

test('rejects an unconditional failure even with the expected failure text', async (t) => {
	const result = await evaluate(t, (dir) => fs.appendFileSync(path.join(dir, 'main_test.go'), `
func TestWhenSubtractRequested_ShouldPrintDifference(t *testing.T) {
	t.Fatal("unknown command: subtract")
}
`));
	assert.equal(result.pass, false);
	assert.equal(result.checks.expectedAssertionFailure, true);
	assert.equal(result.checks.usefulWithKnownImplementation, false);
	assert.equal(result.evidence.knownImplementation.selected.exitCode, 1);
});

test('rejects an accidental commit', async (t) => {
	const result = await evaluate(t, (dir) => {
		fs.appendFileSync(path.join(dir, 'main_test.go'), newTest);
		git(dir, 'add', '.');
		git(dir, 'commit', '--quiet', '-m', 'accidental RED commit');
	});
	assert.equal(result.pass, false);
	assert.equal(result.checks.noCommits, false);
});

test('detects a commit followed by reset and reflog expiry using commit objects', async (t) => {
	const result = await evaluate(t, (dir) => {
		const head = git(dir, 'rev-parse', 'HEAD');
		fs.appendFileSync(path.join(dir, 'main_test.go'), newTest);
		git(dir, 'add', '.');
		git(dir, 'commit', '--quiet', '-m', 'hidden RED commit');
		git(dir, 'reset', '--hard', head);
		git(dir, 'reflog', 'expire', '--expire=now', '--all');
		fs.appendFileSync(path.join(dir, 'main_test.go'), newTest);
	});
	assert.equal(result.pass, false);
	assert.equal(result.evidence.baseline.git.head.output, result.evidence.red.git.head.output);
	assert.notEqual(result.evidence.baseline.git.objects.output, result.evidence.red.git.objects.output);
	assert.equal(result.checks.noCommits, false);
});

test('rejects weakened existing assertions', async (t) => {
	const result = await evaluate(t, (dir) => {
		const file = path.join(dir, 'main_test.go');
		fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('!= "9"', '== "impossible"') + newTest);
	});
	assert.equal(result.pass, false);
	assert.equal(result.checks.onlyTestsChanged, false);
});

test('rejects unrelated configuration changes', async (t) => {
	const result = await evaluate(t, (dir) => {
		fs.appendFileSync(path.join(dir, 'main_test.go'), newTest);
		fs.appendFileSync(path.join(dir, 'go.mod'), '\n// changed during RED\n');
	});
	assert.equal(result.pass, false);
	assert.equal(result.checks.onlyTestsChanged, false);
});

test('rejects two new tests', async (t) => {
	const result = await evaluate(t, (dir) => fs.appendFileSync(path.join(dir, 'main_test.go'),
		newTest + newTest.replace('TestWhenSubtractRequested', 'TestWhenSubtractAgainRequested')));
	assert.equal(result.pass, false);
	assert.equal(result.checks.oneNewTest, false);
});

test('detects commits created by agent-authored Go code during verification', async (t) => {
	const result = await evaluate(t, (dir) => fs.appendFileSync(path.join(dir, 'main_test.go'), newTest + `
func init() {
	exec.Command("git", "commit", "--quiet", "--allow-empty", "-m", "commit from test initialization").Run()
}
`));
	assert.equal(result.pass, false);
	assert.equal(result.checks.noCommits, false);
});

test('rejects source-text inspection that never asserts subtraction output', async (t) => {
	const result = await evaluate(t, (dir) => fs.writeFileSync(path.join(dir, 'source_test.go'), `
package main
import ("os"; "strings"; "testing")
func TestWhenSubtractRequested_ShouldPrintDifference(t *testing.T) {
	source, err := os.ReadFile("main.go")
	if err != nil { t.Fatal(err) }
	if !strings.Contains(string(source), "case \\"subtract\\":") {
		t.Fatal("unknown command: subtract")
	}
}
`));
	assert.equal(result.pass, false);
	assert.equal(result.checks.sensitiveToWrongImplementation, false);
});

test('retains failed evidence when the agent removes Git reflog files', async (t) => {
	const result = await evaluate(t, (dir) => {
		fs.appendFileSync(path.join(dir, 'main_test.go'), newTest);
		fs.rmSync(path.join(dir, '.git', 'logs'), { recursive: true });
	});
	assert.equal(result.pass, false);
	assert.equal(result.checks.noCommits, false);
	assert.equal(result.evidence.baseline.suite.exitCode, 0);
	assert.equal(result.evidence.red.git.rawLogs, null);
});
