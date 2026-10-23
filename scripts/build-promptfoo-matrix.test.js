'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMatrixConfig } = require('./build-promptfoo-matrix');

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
