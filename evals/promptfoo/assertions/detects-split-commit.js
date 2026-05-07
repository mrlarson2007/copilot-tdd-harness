module.exports = (output) => {
  const failureModes = Array.isArray(output?.failureModes) ? output.failureModes : [];
  const pass = output?.testAndCodeCommittedTogether === false || failureModes.includes('test-and-code-split-commit');
  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? 'Detected split-commit behavior as expected.'
      : 'Expected split-commit behavior was not detected.',
  };
};