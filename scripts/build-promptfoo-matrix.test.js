'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildMatrixConfig } = require('./build-promptfoo-matrix');
const script = path.join(__dirname, 'build-promptfoo-matrix.js');

test('WhenMultipleModelsAndConditionsAreSelected_ShouldCreateOnePromptfooProviderPerMatrixCell', () => {
  const source = [
    'description: benchmark',
    'providers:',
    '  - id: file://./benchmark-provider.js',
    '    label: existing-provider',
    'tests:',
    '  - description: scenario one',
    'outputPath:',
    '  - results/latest.json',
    '',
  ].join('\n');

  const config = buildMatrixConfig(source, ['model-a', 'model-b'], ['harness', 'baseline']);

  for (const model of ['model-a', 'model-b']) {
    for (const condition of ['harness', 'baseline']) {
      assert.ok(config.includes(`label: "${model} (${condition})"`));
      assert.ok(config.includes(`evalModel: "${model}"`));
      assert.ok(config.includes(`evalCondition: "${condition}"`));
    }
  }
  assert.equal((config.match(/- id: file:\/\/\.\/benchmark-provider\.js/g) || []).length, 4);
  assert.ok(config.includes('tests:\n  - description: scenario one'));
  assert.ok(config.includes('outputPath:\n  - results/latest.json'));
});

test('WhenMatrixConfigCommandIsInvoked_ShouldWriteTheCombinedPromptfooConfig', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfoo-matrix-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const input = path.join(directory, 'input.yaml');
  const output = path.join(directory, 'matrix.yaml');
  fs.writeFileSync(input, 'providers:\n  - id: old\ntests:\n  - description: scenario\n');

  const result = spawnSync(process.execPath, [
    script, input, output,
    '--model', 'model-a', '--model', 'model-b',
    '--condition', 'harness', '--condition', 'baseline',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const config = fs.readFileSync(output, 'utf8');
  assert.ok(config.includes('model-a (harness)'));
  assert.ok(config.includes('model-b (baseline)'));
  assert.ok(config.includes('tests:\n  - description: scenario'));
});
