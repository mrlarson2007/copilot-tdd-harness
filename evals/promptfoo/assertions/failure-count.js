module.exports = function assertFailureCount(output, context) {
  const expected = Number(context.vars.expectedFailed);
  if (output.failed !== expected) {
    return {
      pass: false,
      score: 0,
      reason: `Expected failed=${expected}, got ${output.failed}`,
    };
  }

  return {
    pass: true,
    score: 1,
    reason: `Failure count matched expected value ${expected}.`,
  };
};