'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { detectClarification } = require('./summary-deriver');

test('detectClarification ignores planning text that mentions specific rules and current behavior', () => {
  const agentOutput = [
    'I am setting up the first TDD cycle by loading the project\'s Go-specific TDD rules and current CLI behavior.',
    'Confirmed next behavior: the CLI should print the arithmetic difference when invoked as calc subtract <left> <right>.',
  ].join('\n');

  assert.equal(detectClarification(agentOutput), false);
});

test('detectClarification recognizes an explicit clarification request', () => {
  const agentOutput = 'Which arithmetic subcommand should I implement before making any changes?';

  assert.equal(detectClarification(agentOutput), true);
});