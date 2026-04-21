module.exports = function assertEvalShape(output) {
  if (!output || typeof output !== 'object') {
    return {
      pass: false,
      score: 0,
      reason: 'Expected object output from eval provider.',
    };
  }

  const requiredKeys = [
    'event',
    'framework',
    'phase',
    'phaseConstraint',
    'passed',
    'failed',
    'failingTests',
    'recommendedNextAction',
    'testExitCode',
  ];

  const missing = requiredKeys.filter((key) => !(key in output));
  if (missing.length > 0) {
    return {
      pass: false,
      score: 0,
      reason: `Missing keys: ${missing.join(', ')}`,
    };
  }

  if (output.event !== 'Evaluation' || output.framework !== 'promptfoo') {
    return {
      pass: false,
      score: 0,
      reason: `Unexpected event/framework: ${output.event}/${output.framework}`,
    };
  }

  return {
    pass: true,
    score: 1,
    reason: 'Eval payload exposes the expected Promptfoo schema.',
  };
};