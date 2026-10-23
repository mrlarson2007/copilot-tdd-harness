'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const script = path.join(repoRoot, 'scripts', 'run-evals.sh');
const powershellScript = path.join(repoRoot, 'scripts', 'run-evals.ps1');

test('WhenSeveralModelsAndConditionsAreRequested_ShouldRunOneNativePromptfooMatrix', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfoo-runner-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bin = path.join(directory, 'bin');
  fs.mkdirSync(bin);
  const callLog = path.join(directory, 'calls.txt');
  const configCapture = path.join(directory, 'config.yaml');
  const configPathCapture = path.join(directory, 'config-path.txt');
  fs.writeFileSync(path.join(bin, 'npx'), [
    '#!/bin/sh',
    'printf "%s\\n" "$*" >> "$PROMPTFOO_CALL_LOG"',
    'while [ "$#" -gt 0 ]; do',
    '  if [ "$1" = "-c" ]; then',
    '    printf "%s" "$2" > "$PROMPTFOO_CONFIG_PATH"',
    '    cat "$2" > "$PROMPTFOO_CONFIG_CAPTURE"',
    '    break',
    '  fi',
    '  shift',
    'done',
    '',
  ].join('\n'), { mode: 0o755 });

  const result = spawnSync('bash', [script, '--condition', 'both', '--model', 'model-a,model-b'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      PROMPTFOO_CALL_LOG: callLog,
      PROMPTFOO_CONFIG_CAPTURE: configCapture,
      PROMPTFOO_CONFIG_PATH: configPathCapture,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const calls = fs.readFileSync(callLog, 'utf8').trim().split('\n');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /promptfoo eval -c/);
  assert.match(calls[0], /results\/promptfoo-benchmark\.json/);
  assert.match(calls[0], /results\/runs\/[^ ]+-promptfooconfig-matrix\.json/);
  const config = fs.readFileSync(configCapture, 'utf8');
  for (const cell of ['model-a (harness)', 'model-a (baseline)', 'model-b (harness)', 'model-b (baseline)']) {
    assert.ok(config.includes(cell), cell);
  }
  assert.equal(fs.existsSync(fs.readFileSync(configPathCapture, 'utf8')), false);
});

test('WhenSeveralModelsAndConditionsAreRequestedInPowerShell_ShouldRunOneNativePromptfooMatrix', (t) => {
  const probe = spawnSync('pwsh', ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()']);
  if (probe.error || probe.status !== 0) return t.skip('PowerShell is unavailable');

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfoo-powershell-runner-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bin = path.join(directory, 'bin');
  fs.mkdirSync(bin);
  const callLog = path.join(directory, 'calls.txt');
  const configCapture = path.join(directory, 'config.yaml');
  const configPathCapture = path.join(directory, 'config-path.txt');
  fs.writeFileSync(path.join(bin, 'npx'), [
    '#!/bin/sh',
    'printf "%s\\n" "$*" >> "$PROMPTFOO_CALL_LOG"',
    'while [ "$#" -gt 0 ]; do',
    '  if [ "$1" = "-c" ]; then',
    '    printf "%s" "$2" > "$PROMPTFOO_CONFIG_PATH"',
    '    cat "$2" > "$PROMPTFOO_CONFIG_CAPTURE"',
    '    break',
    '  fi',
    '  shift',
    'done',
    '',
  ].join('\n'), { mode: 0o755 });

  const result = spawnSync('pwsh', [
    '-NoLogo', '-NoProfile', '-File', powershellScript,
    '-Condition', 'both', '-Model', 'model-a,model-b',
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      PROMPTFOO_CALL_LOG: callLog,
      PROMPTFOO_CONFIG_CAPTURE: configCapture,
      PROMPTFOO_CONFIG_PATH: configPathCapture,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const calls = fs.readFileSync(callLog, 'utf8').trim().split('\n');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /promptfoo eval -c/);
  assert.match(calls[0], /results\/promptfoo-benchmark\.json/);
  assert.match(calls[0], /results\/runs\/[^ ]+-promptfooconfig-matrix\.json/);
  const config = fs.readFileSync(configCapture, 'utf8');
  for (const cell of ['model-a (harness)', 'model-a (baseline)', 'model-b (harness)', 'model-b (baseline)']) {
    assert.ok(config.includes(cell), cell);
  }
  assert.equal(fs.existsSync(fs.readFileSync(configPathCapture, 'utf8')), false);
});
