'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCopilotArgs, getEvalRunConfig, withEvalRunConfig } = require('./agent-runner');

test('getEvalRunConfig defaults to the harness condition with no model', () => {
  assert.deepEqual(getEvalRunConfig({}), { model: null, condition: 'harness' });
});

test('getEvalRunConfig reads model and condition from the environment', () => {
  assert.deepEqual(
    getEvalRunConfig({ EVAL_MODEL: ' gpt-5 ', EVAL_CONDITION: 'Baseline' }),
    { model: 'gpt-5', condition: 'baseline' },
  );
});

test('getEvalRunConfig rejects an unknown condition', () => {
  assert.throws(() => getEvalRunConfig({ EVAL_CONDITION: 'skills-off' }), /EVAL_CONDITION/);
});

test('WhenProvidersRunConcurrently_ShouldKeepEachModelAndConditionIsolated', async () => {
  const configs = await Promise.all([
    withEvalRunConfig({ model: 'model-a', condition: 'harness' }, async () => {
      await new Promise((resolve) => setImmediate(resolve));
      return getEvalRunConfig({ EVAL_MODEL: 'shared', EVAL_CONDITION: 'baseline' });
    }),
    withEvalRunConfig({ model: 'model-b', condition: 'baseline' }, async () => {
      await new Promise((resolve) => setImmediate(resolve));
      return getEvalRunConfig({ EVAL_MODEL: 'shared', EVAL_CONDITION: 'harness' });
    }),
  ]);

  assert.deepEqual(configs, [
    { model: 'model-a', condition: 'harness' },
    { model: 'model-b', condition: 'baseline' },
  ]);
});

test('buildCopilotArgs selects the harness agent and model in the harness condition', () => {
  const args = buildCopilotArgs({
    agentName: 'tdd',
    prompt: 'Add subtract',
    runConfig: { model: 'claude-sonnet-4.5', condition: 'harness' },
  });

  assert.deepEqual(args, [
    '--agent=tdd', '--model', 'claude-sonnet-4.5', '--prompt', 'Add subtract', '--allow-all-tools',
  ]);
});

test('buildCopilotArgs omits the agent in the baseline condition', () => {
  const args = buildCopilotArgs({
    agentName: 'tdd',
    prompt: 'Add subtract',
    runConfig: { model: null, condition: 'baseline' },
  });

  assert.deepEqual(args, ['--prompt', 'Add subtract', '--allow-all-tools']);
});

test('buildCopilotArgs omits the agent when agentName is false', () => {
  const args = buildCopilotArgs({
    agentName: false,
    prompt: 'Write one failing test',
    runConfig: { model: 'gpt-5', condition: 'harness' },
  });

  assert.deepEqual(args, ['--model', 'gpt-5', '--prompt', 'Write one failing test', '--allow-all-tools']);
});
