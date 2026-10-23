'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { evaluateRed } = require('./red-evaluator');

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
	return evaluateRed(dir, async () => {
		await mutate(dir);
		return { ok: true, exitCode: 0, output: 'red_result: ok (not evidence)' };
	});
}

test('accepts one useful uncommitted RED test using actual Go and Git evidence', async (t) => {
	const result = await evaluate(t, (dir) => fs.appendFileSync(path.join(dir, 'main_test.go'), newTest));
	assert.equal(result.pass, true, JSON.stringify(result.checks));
	assert.equal(result.evidence.red.selected.exitCode, 1);
	assert.equal(result.evidence.knownImplementation.suite.exitCode, 0);
	assert.match(result.evidence.red.git.diff.output, /subtract/);
});
