'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCopilotArgs, getEvalRunConfig } = require('./agent-runner');

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
