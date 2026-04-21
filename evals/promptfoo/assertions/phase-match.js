module.exports = function assertPhaseMatch(output, context) {
  const expectedPhase = context.vars.phase;
  if (output.phase !== expectedPhase) {
    return {
      pass: false,
      score: 0,
      reason: `Expected phase ${expectedPhase}, got ${output.phase}`,
    };
  }

  return {
    pass: true,
    score: 1,
    reason: `Phase matched expected value ${expectedPhase}.`,
  };
};