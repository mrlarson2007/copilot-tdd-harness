module.exports = function assertDetectsProductionBeforeRed(output) {
  const detected = Array.isArray(output.failureModes)
    && output.failureModes.includes('production-before-red');

  return {
    pass: detected,
    score: detected ? 1 : 0,
    reason: detected
      ? 'Detected production-before-red as expected.'
      : 'Failed to detect production-before-red.',
  };
};
